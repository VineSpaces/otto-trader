// Otto v3.13 test suite — replays the failures from Tue 6 Oct 2026 against the new code.
// Run: deno test -A supabase/tests/v313_test.ts
// Nothing here touches the network: Supabase, Robinhood/TradingView and Claude are faked.

/* ---------------- fake clock (pinned to 6 Oct 2026, moved by tests) ---------------- */
const RealDate = Date;
let NOW = RealDate.parse("2026-10-06T15:51:30Z"); // 11:51:30 AM ET — the SPY fill
class FakeDate extends RealDate {
  constructor(...a: any[]) { if (a.length) super(...(a as [any])); else super(NOW); }
  static now() { return NOW; }
}
(globalThis as any).Date = FakeDate;
const setNow = (iso: string) => { NOW = RealDate.parse(iso); };

/* ---------------- fake Supabase (PostgREST subset) ---------------- */
const T: Record<string, any[]> = { otto_actions: [], otto_desk: [], otto_settings: [], otto_trades: [], otto_watch: [], otto_feedback: [] };
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
function parse(path: string) {
  const [table, q = ""] = path.split("?");
  const params = new URLSearchParams(q);
  return { table, params };
}
function matches(row: any, params: URLSearchParams) {
  for (const [k, v] of params) {
    if (["select", "order", "limit", "on_conflict"].includes(k)) continue;
    if (k === "or") {
      // or=(exit_lock.is.null,exit_lock.lt.ISO)
      const m = /^\(exit_lock\.is\.null,exit_lock\.lt\.(.+)\)$/.exec(v);
      if (m) { if (!(row.exit_lock == null || row.exit_lock < m[1])) return false; continue; }
      continue;
    }
    const val = (key: string) => {           // col, col->>key, col->key->>key2
      const m = /^(\w+)(?:->(\w+))?->>(\w+)$/.exec(key);
      if (!m) return row[key];
      const base = row[m[1]] || {}; const obj = m[2] ? (base[m[2]] || {}) : base; return obj[m[3]];
    };
    if (v === "is.null") { if (val(k) != null) return false; continue; }
    if (v === "not.is.null") { if (val(k) == null) return false; continue; }
    if (v.startsWith("neq.")) { if (String(val(k)) === v.slice(4)) return false; continue; }
    if (v.startsWith("eq.")) { const want = decodeURIComponent(v.slice(3)); const have = k === "exit->>state" ? row.exit?.state : k === "owner" ? (row.owner ?? "ottotrader@vinecreativestudio.com") : val(k); if (String(have) !== want) return false; }   // v5.0: a row without owner is the house's (the SQL DEFAULT)
    else if (v.startsWith("gte.")) { if (!(String(row[k]) >= v.slice(4))) return false; }
    else if (v.startsWith("lte.")) { if (!(String(row[k]) <= v.slice(4))) return false; }
    else if (v.startsWith("lt.")) { if (!(String(row[k]) < v.slice(3))) return false; }
    else if (v.startsWith("in.(")) { const set = v.slice(4, -1).split(","); const have = val(k); if (!set.includes(String(have))) return false; }
  }
  return true;
}
let ID = 0;
async function fakeDb(path: string, init: RequestInit = {}) {
  const { table, params } = parse(path);
  const method = (init.method || "GET").toUpperCase();
  const body = init.body ? JSON.parse(String(init.body)) : null;
  const rows = T[table] ||= [];
  await sleep(5); // let concurrent runs interleave, like the real network
  if (method === "GET") return rows.filter((r) => matches(r, params));
  if (method === "POST") {
    if (params.get("on_conflict")) {
      const keys = params.get("on_conflict")!.split(",");
      const ignore = /ignore-duplicates/.test(String((init.headers as any)?.prefer || ""));
      const made: any[] = [];
      for (const b of [].concat(body) as any[]) {
        const i = rows.findIndex((r) => keys.every((k) => String(r[k]) === String(b[k])));
        if (i >= 0) { if (!ignore) rows[i] = { ...rows[i], ...b }; }
        else { const row = { id: b.id || ++ID, created_at: new Date().toISOString(), fired: {}, ...b }; rows.push(row); made.push({ ...row }); }
      }
      return ignore ? made : null;
    }
    const out = [].concat(body).map((b: any) => ({ id: b.id || `id-${++ID}`, created_at: new Date().toISOString(), ...b }));
    rows.push(...out);
    return out;
  }
  if (method === "PATCH") {
    const hit = rows.filter((r) => matches(r, params));
    await sleep(3);
    // re-check after the await so the update is atomic per row, like Postgres
    const still = hit.filter((r) => matches(r, params));
    still.forEach((r) => Object.assign(r, body));
    return still.map((r) => ({ ...r }));
  }
  return [];
}

/* ---------------- fake Robinhood / TradingView ---------------- */
import { SPY_5M, NVDA_5M, toRh } from "./fixtures_2026-10-06.ts";
const FIX: Record<string, any> = { SPY: toRh("SPY", SPY_5M), NVDA: toRh("NVDA", NVDA_5M) };
// v3.42: the Watcher fires on 10-minute closes, so the fake answers a 10minute request with the 5-minute fixture paired up (9:30+9:35 → the 9:30 bar, …).
function to10(f: any) {
  if (!f) return f;
  const out: any[] = [];
  for (const b of f.bars) {
    const m = new RealDate(b.begins_at).getUTCMinutes();
    const prev = out[out.length - 1];
    if (m % 10 !== 0 && prev && new RealDate(b.begins_at).getTime() - new RealDate(prev.begins_at).getTime() === 5 * 60e3) {
      prev.high_price = String(Math.max(+prev.high_price, +b.high_price)); prev.low_price = String(Math.min(+prev.low_price, +b.low_price)); prev.close_price = b.close_price; prev.volume = String((+prev.volume || 0) + (+b.volume || 0));
    } else out.push({ ...b });
  }
  return { ...f, interval: "10minute", bars: out };
}
const ACCT = "945257012";
const OPT = "opt-spy-781c-1009";
let orders: any[] = [];
let calls: { tool: string; args: any }[] = [];
let quote = { delta: "0.527", volume: 6911, open_interest: 2898 };
let callHook: ((tool: string, args: any) => any) | null = null;   // v3.16 tests: per-test Robinhood answers
async function fakeCall(service: string, tool: string, args: any) {
  calls.push({ tool, args });
  await sleep(4);
  const j = (o: any) => ({ content: [{ type: "text", text: JSON.stringify(o) }] });
  if (callHook) { const h = callHook(tool, args); if (h) return j(h); }
  switch (tool) {
    case "get_accounts": return j({ data: { accounts: [{ account_number: ACCT, agentic_allowed: true }, { account_number: "650006166", agentic_allowed: false }] } });
    case "get_portfolio": return j({ data: { total_value: "1196.91" } });
    case "get_option_orders": {
      if (args.order_id) return j({ data: { orders: orders.filter((o) => o.id === args.order_id) } });
      return j({ data: { orders } });
    }
    case "place_option_order": {
      const working = orders.some((o) => ["queued", "confirmed"].includes(o.state) && o.legs[0].side === "sell");
      if (args.type === "stop_market" && working) throw new Error('API error 400: {"detail":"This order is invalid because you do not have enough contracts to close your position."}');
      const o = { id: "ord-" + (++ID), state: "confirmed", type: args.type, stop_price: args.stop_price, legs: args.legs.map((l: any) => ({ ...l })) };
      orders.push(o);
      return j({ data: { order: { id: o.id } } });
    }
    case "get_option_positions": return j({ data: { positions: [{ type: "long", quantity: "1", option_id: OPT }] } });
    case "get_option_instruments": return j({ data: { instruments: [{ id: OPT, expiration_date: "2026-10-09", chain_symbol: "SPY" }] } });
    case "get_option_quotes": return j({ data: { results: [{ quote }] } });
    case "review_option_order": return j({ ok: true, review: "fine" });
    case "get_earnings_calendar": return j({ data: { results: [] } });
    case "mcp-tv-create-alert": return j({ alert_id: 1000 + (++ID) });
    case "mcp-tv-get-economic-calendar": return j({ events: [] });
    case "get_realized_pnl": return j({ data: { data_points: [] } });
    case "get_equity_historicals": return j({ data: { results: (args.symbols || []).map((sy: string) => args.interval === "10minute" ? to10(FIX[sy]) : FIX[sy]).filter(Boolean) } });
    default: return j({});
  }
}

/* ---------------- fake Claude (SSE) ---------------- */
let claudeScript: ((body: any) => any[]) | null = null;
const claudeBodies: any[] = [];
function sse(events: any[]) {
  const enc = new TextEncoder();
  return new Response(new ReadableStream({ start(c) { for (const e of events) c.enqueue(enc.encode("data: " + JSON.stringify(e) + "\n\n")); c.close(); } }), { status: 200 });
}
const textReply = (t: string) => [
  { type: "content_block_start", index: 0, content_block: { type: "text", text: "" } },
  { type: "content_block_delta", index: 0, delta: { type: "text_delta", text: t } },
  { type: "message_delta", delta: { stop_reason: "end_turn" } }];
const toolReply = (name: string, input: any) => [
  { type: "content_block_start", index: 0, content_block: { type: "tool_use", id: "tu" + (++ID), name, input: {} } },
  { type: "content_block_delta", index: 0, delta: { type: "input_json_delta", partial_json: JSON.stringify(input) } },
  { type: "message_delta", delta: { stop_reason: "tool_use" } }];

const pings: { kind: string; title: string; body: string }[] = [];
let extractHook: ((text: string) => any[]) | null = null;
(globalThis as any).__OTTO_TEST__ = {
  db: fakeDb, call: fakeCall,
  brain: () => [{ call: { date: "2026-10-01", title: "t" }, rules: [], setups: [], levels: [], _transcript: "x" }],   // v3.24: Postgres only, no public file
  notify: (kind: string, title: string, body: string) => pings.push({ kind, title, body }),
  extract: (text: string) => (extractHook ? extractHook(text) : []),
  claude: async (body: any) => { claudeBodies.push(body); if (!claudeScript) return sse(textReply("ok")); const ev = claudeScript(body); if (ev instanceof Error) throw ev; return sse(ev); },
};
(globalThis as any).fetch = (u: any) => Promise.reject(new Error("network disabled in tests: " + String(u).slice(0, 80)));
(Deno as any).serve = () => ({ finished: Promise.resolve() });

const M = await import("../otto-proxy.ts");

function assert(c: unknown, msg: string) { if (!c) throw new Error("ASSERT: " + msg); }
// v3.26: the size cap and the kill switch are ON in production; the older tests below test other things, so they start
// with both off (the v3.26 tests at the end turn them on).
// v3.27: the older tests predate the LIVE-source switches, so they run with every source allowed to go live.
const PRE326 = () => [{ key: "limits", value: { size_cap_on: false, kill_on: false, live_coach_call: true, live_coach_level: true, live_jarvis: true } }];
function reset() {
  T.otto_actions = []; T.otto_desk = []; T.otto_settings = PRE326(); T.otto_trades = []; T.otto_watch = []; T.otto_activity = [];
  T.otto_checks = []; T.otto_jason = []; T.otto_prep = []; T.otto_prep_imgs = []; T.otto_signal_batches = []; T.otto_signal_msgs = []; T.otto_signal_imgs = [];
  orders = []; calls = []; claudeBodies.length = 0; claudeScript = null; callHook = null; extractHook = null; pings.length = 0;
  quote = { delta: "0.527", volume: 6911, open_interest: 2898 };
}
const deskText = () => T.otto_desk.map((r) => `[${r.author}] ${r.content}`).join("\n");

/* =============================== 1. CLOCK =============================== */
Deno.test("clock: 12:28 PM ET Tuesday is OPEN, Tuesday Oct 6, this Friday = Oct 9", () => {
  const c = M.marketClock(new RealDate("2026-10-06T16:28:00Z") as any);
  assert(c.status === "open", "status " + c.status);
  assert(c.line.includes("Tuesday, Oct 6, 2026, 12:28 PM ET"), c.line);
  assert(c.line.includes("3h 32m left"), c.line);
  assert(c.thisExp === "2026-10-09" && c.nextExp === "2026-10-16", c.thisExp + " " + c.nextExp);
  assert(!/Oct 7/.test(c.line), "never Oct 7");
});
Deno.test("clock: pre-market, first 30 minutes, after hours, weekend, holiday, half day", () => {
  assert(M.marketClock(new RealDate("2026-10-06T11:13:00Z") as any).status === "pre", "7:13 AM is pre-market");
  const f30 = M.marketClock(new RealDate("2026-10-06T13:40:00Z") as any);
  assert(f30.status === "open" && f30.line.includes("first 30 minutes"), f30.line);
  const after = M.marketClock(new RealDate("2026-10-06T20:30:00Z") as any);
  assert(after.status === "after" && after.line.includes("Wednesday, Oct 7"), after.line);
  const sat = M.marketClock(new RealDate("2026-10-10T15:00:00Z") as any);
  assert(sat.status === "closed" && sat.line.includes("Monday, Oct 12"), sat.line);
  const tg = M.marketClock(new RealDate("2026-11-26T15:00:00Z") as any);
  assert(tg.status === "closed" && tg.line.includes("holiday"), tg.line);
  const half = M.marketClock(new RealDate("2026-11-27T18:30:00Z") as any); // 1:30 PM ET on the half day
  assert(half.status === "after", "half day closes at 1 PM: " + half.status);
  const gf = M.marketClock(new RealDate("2027-03-24T15:00:00Z") as any); // Good Friday week → Thursday expiry
  assert(gf.thisExp === "2027-03-25", "Good Friday week expiry " + gf.thisExp);
});
Deno.test("clock: Robinhood UTC timestamps get their ET time written next to them", () => {
  const out = M.etAnnotate(`{"updated_at":"2026-10-06T16:08:00Z","begins_at":"2026-10-06T14:35:00.000000Z","prev":"2026-10-05T20:00:00+00:00","time":1759761300}`,
    new RealDate("2026-10-06T16:30:00Z") as any);
  assert(out.includes("16:08:00Z (= 12:08 PM ET)"), out);
  assert(out.includes("(= 10:35 AM ET)"), out);
  assert(out.includes("(= Mon Oct 5 4:00 PM ET)"), out);
  assert(/1759761300 \/\* = .*ET \*\//.test(out), out);
});

/* =============================== 2. EXIT ENGINE =============================== */
function filledTrade() {
  orders.push({ id: "entry-1", state: "filled", processed_quantity: "1", price: "3.50",
    legs: [{ option_id: OPT, side: "buy", position_effect: "open", executions: [{ price: "3.44", quantity: "1" }] }] });
  const a = { id: "card-spy", title: "Buy 1 SPY 781C 10/9 @ $3.50", status: "done", decided_at: "2026-10-06T15:51:20Z", created_at: "2026-10-06T15:51:00Z",
    exit: { state: "waiting_fill", order_id: "entry-1", option_id: OPT, qty: 1, entry_limit: 3.5, stop_option: 2.0, tv_symbol: "AMEX:SPY", direction: "up", wrong_if: 778.6, tp1: 784.5, log: [] } };
  T.otto_actions.push(a);
  return a;
}
Deno.test("exits: 3 runs on the same fill at once (cron + Approve + panel) → ONE stop, no false NO-stop alarm", async () => {
  reset(); setNow("2026-10-06T15:51:35Z");
  const a = filledTrade();
  const res = await Promise.all([M.exitTick({ ...a }), M.exitTick({ ...a }), M.exitTick({ ...a })]);
  const stops = calls.filter((c) => c.tool === "place_option_order" && c.args.type === "stop_market");
  assert(stops.length === 1, "stop orders placed: " + stops.length);
  assert(!/NO stop/.test(deskText()), "false alarm on the Desk:\n" + deskText());
  assert((deskText().match(/filled at \$3\.44/g) || []).length === 1, "one fill message:\n" + deskText());
  assert(res.filter((r: any) => r.skipped).length === 2, "two runs skipped: " + JSON.stringify(res));
  assert(T.otto_actions[0].exit.state === "armed" && T.otto_actions[0].exit.stop_order_id, "armed with a stop id");
  assert(T.otto_actions[0].exit_lock === null, "lock released");
});
Deno.test("exits: a stop already working is adopted, never re-placed or alarmed", async () => {
  reset(); setNow("2026-10-06T15:52:00Z");
  const a = filledTrade();
  orders.push({ id: "stop-existing", state: "confirmed", type: "stop_market", stop_price: "2.00", legs: [{ option_id: OPT, side: "sell", position_effect: "close" }] });
  await M.exitTick({ ...a });
  const stops = calls.filter((c) => c.tool === "place_option_order" && c.args.type === "stop_market");
  assert(stops.length === 0, "no second stop");
  assert(T.otto_actions[0].exit.stop_order_id === "stop-existing", "adopted " + T.otto_actions[0].exit.stop_order_id);
  assert(!/NO stop/.test(deskText()), deskText());
  assert(/Stop on at \$2\.00/.test(deskText()), "fill message says the stop is on:\n" + deskText());
});
Deno.test("exits: a crashed run's stale lock (>90 s) doesn't freeze the trade", async () => {
  reset(); setNow("2026-10-06T15:55:00Z");
  const a = filledTrade();
  T.otto_actions[0].exit_lock = "2026-10-06T15:50:00.000Z";
  const r: any = await M.exitTick({ ...a });
  assert(!r.skipped && T.otto_actions[0].exit.state === "armed", JSON.stringify(r));
});

/* =============================== 3. GUARDRAILS =============================== */
const spyCard = () => ({
  title: "Buy 1 SPY 781C 10/9 @ $3.50", summary: "test",
  calls: [{ service: "rh", tool: "place_option_order", args: { legs: [{ option_id: OPT, side: "buy", position_effect: "open" }], quantity: "1", type: "limit", price: "3.50", time_in_force: "gfd" } }],
  plan: { tv_symbol: "AMEX:SPY", direction: "up", setup: "trend continuation", tp1: 784.5, stop: 778.6, stop_option: 2.0, expires: "2026-10-09" },
});
Deno.test("guardrails: today's SPY card ($144 at the stop on a $1,197 account) is BUILT with a red flag, not blocked", async () => {
  reset(); setNow("2026-10-06T15:51:00Z");
  const card: any = await M.proposeAction(spyCard(), "ottotrader@vinecreativestudio.com");
  assert(card && card.status === "pending", "card created");
  const flags = card.checks.filter((c: any) => c.ok === false).map((c: any) => c.text);
  assert(flags.some((t: string) => /OVER your 10% max, \$120/.test(t)), "loss-at-stop flag: " + JSON.stringify(flags));
  assert(flags.some((t: string) => /Delta 0\.53/.test(t)), "delta flagged: " + JSON.stringify(flags));
  assert(!card.checks.some((c: any) => /Jason/.test(c.text)), "no name in checks");
});
Deno.test("guardrails: daily stop after 2 losing Agentic trades — flagged, still built", async () => {
  reset(); setNow("2026-10-06T17:30:00Z");
  // v3.24 (A7): counted from Robinhood's own order records (two losing round trips in the Agentic account).
  const leg = (id: string, side: string, eff: string, px: string) => ({ option_id: id, side, position_effect: eff, chain_symbol: "SPY", strike_price: "780", option_type: "call", executions: [{ price: px, quantity: "1" }] });
  orders.push({ id: "b1", state: "filled", chain_symbol: "SPY", created_at: "2026-10-06T14:10:00Z", legs: [leg("o1", "buy", "open", "1.00")] },
    { id: "s1", state: "filled", chain_symbol: "SPY", created_at: "2026-10-06T16:29:00Z", legs: [leg("o1", "sell", "close", "0.47")] },
    { id: "b2", state: "filled", chain_symbol: "SPY", created_at: "2026-10-06T16:40:00Z", legs: [leg("o2", "buy", "open", "1.00")] },
    { id: "s2", state: "filled", chain_symbol: "SPY", created_at: "2026-10-06T17:00:00Z", legs: [leg("o2", "sell", "close", "0.80")] });
  const c: any[] = await M.limitChecks(100, 50);
  const d = c.find((x) => /DAILY STOP/.test(x.text));
  assert(d && d.ok === false, JSON.stringify(c));
  assert(/2 losing trades today, \$-73/.test(d.text), d.text);
});
Deno.test("guardrails: first 30 minutes is fine (not red) on a pre-posted Signal level", async () => {
  reset(); setNow("2026-10-06T13:35:00Z");
  const out = [{ tool: "place_option_order", args: { legs: [{ option_id: OPT, side: "buy", position_effect: "open" }] } }];
  const a = await M.ruleChecks(out, { signal_level: true, direction: "up" }, {}, null);
  const b = await M.ruleChecks(out, { direction: "up" }, {}, null);
  assert(a.find((x: any) => /first 30/.test(x.text)).ok === null, JSON.stringify(a[0]));
  assert(b.find((x: any) => /first 30/.test(x.text)).ok === false, JSON.stringify(b[0]));
});

/* =============================== 4. JARVIS RUNS =============================== */
const run = (o: any) => M.runDesk({ msgs: [{ role: "user", content: "hi" }], sys: "SYS", tools: [], cs: [], who: "t", send: () => {}, allowPropose: false, ...o });
Deno.test("jarvis: every run carries the clock, the guardrail rule and the House Rules", async () => {
  reset(); setNow("2026-10-06T16:28:00Z");
  await run({});
  const sys = claudeBodies[0].system;
  assert(sys[1].text.includes("Tuesday, Oct 6, 2026, 12:28 PM ET") && sys[1].text.includes("OPEN"), sys[1].text.slice(0, 300));
  assert(sys[1].text.includes("HOUSE RULES") && sys[1].text.includes("Intraday only"), "house rules present");
  assert(/NEVER BLOCK/.test(sys[0].text) && /Never say "I'm watching"/.test(sys[0].text), "guard rule present");
  assert(sys[0].cache_control && !sys[1].cache_control, "clock block is outside the cache");
});
Deno.test("jarvis: tool results get ET times and a clock line every round", async () => {
  reset(); setNow("2026-10-06T16:28:00Z");
  let n = 0;
  claudeScript = () => (n++ === 0 ? toolReply("rh__get_option_orders", {}) : textReply("done"));
  // allow the tool through the read allowlist
  orders.push({ id: "x", state: "filled", updated_at: "2026-10-06T16:11:00Z", legs: [] });
  await run({});
  const second = claudeBodies[1].messages.at(-1).content;
  const tr = second.find((b: any) => b.type === "tool_result");
  assert(/16:11:00Z \(= 12:11 PM ET\)/.test(tr.content), tr.content.slice(0, 300));
  assert(second.some((b: any) => b.type === "text" && /clock: 12:28 PM ET Tue 2026-10-06, market OPEN/.test(b.text)), JSON.stringify(second.at(-1)));
});
Deno.test("jarvis: a slow turn ends with a visible out-of-time note instead of silence", async () => {
  reset(); setNow("2026-10-06T14:03:00Z");
  claudeScript = () => { NOW += 60_000; return toolReply("rh__get_option_orders", {}); }; // every round eats a minute
  const r: any = await run({});
  assert(r.timedOut && /ran out of time/.test(r.said), JSON.stringify(r));
});
Deno.test("jarvis: a standing instruction is saved to the House Rules", async () => {
  reset(); setNow("2026-10-06T16:51:00Z");
  let n = 0;
  claudeScript = () => (n++ === 0 ? toolReply("save_house_rule", { text: "Watch 5m and 10m candles for entries." }) : textReply("Saved."));
  await run({ author: "Josh" });
  const list = await M.houseRules();
  assert(list.some((r: any) => /5m and 10m/.test(r.text) && /Josh/.test(r.by)), JSON.stringify(list.slice(-1)));
  assert(/House rule saved/.test(deskText()), deskText());
});
Deno.test("jarvis: Desk failure is posted on the Desk (no more silent 10:03–10:06)", async () => {
  reset(); setNow("2026-10-06T14:03:54Z");
  claudeScript = () => new Error("claude HTTP 529 overloaded") as any;
  const req = new Request("https://x/?fn=desk", { method: "POST", body: JSON.stringify({ author: "Josh", messages: [{ role: "user", content: "Any setups on the other MAG7 and QQQ" }] }) });
  const res = await M.desk(req, "ottotrader@vinecreativestudio.com", "k");
  await res.text();
  assert(/Jarvis couldn't answer Josh's last message \(Claude is overloaded/.test(deskText()), deskText());
});

/* =============================== 5. ROUTES =============================== */
// Added after the first v3.13 deploy: house_rules_get answered "unknown fn" because it was
// missing from the Desk route allow-list. Every route the Desk block handles must be listed.
Deno.test("routes: every Desk route is in the signed-in allow-list", async () => {
  const src = await Deno.readTextFile(new URL("../otto-proxy.ts", import.meta.url));
  const i = src.indexOf('if (["desk", "act", "panel"');
  const list = src.slice(i, src.indexOf("].includes(fn)", i));
  const allowed = new Set([...list.matchAll(/"([a-z_]+)"/g)].map((m) => m[1]));
  const blockEnd = src.indexOf('if (fn === "market")', i);
  const handled = [...src.slice(i, blockEnd).matchAll(/fn === "([a-z_]+)"/g)].map((m) => m[1]);
  const missing = handled.filter((f) => !allowed.has(f));
  assert(missing.length === 0, "routes handled but not allowed: " + missing.join(", "));
});


/* =============================== v3.14 WATCHER + SCOREBOARD =============================== */
const at = (hhmmss: string) => RealDate.parse(`2026-10-06T${hhmmss}Z`);
const spyBars = () => M.parseRhBars({ data: { results: [FIX.SPY] } }).SPY;
const nvdaBars = () => M.parseRhBars({ data: { results: [FIX.NVDA] } }).NVDA;
function replay(level: number, d: "up" | "down", bars: any[], earliest: number, from = "13:31:00", to = "15:30:00", rearm = true) {
  const hits: string[] = []; let firedAt = 0;
  for (let t = at(from); t <= at(to); t += 60e3) {
    if (firedAt && (!rearm || t - firedAt < 15 * 60e3)) continue;
    const h = M.evalLevel(level, d, bars, 5, { now: t, earliestMin: earliest });
    if (h) { hits.push(`${new RealDate(t).toISOString().slice(11, 16)} ${h.trigger}`); firedAt = t; }
  }
  return hits;
}
Deno.test("watcher replay, real 6 Oct bars: SPY 778.60 Signal level — break at 9:45, then the 10:30 pullback-and-hold", () => {
  const hits = replay(778.60, "up", spyBars(), 575);
  // 13:45Z = 9:45 ET (the 9:40 bar closed 778.65 over 778.60); 14:35Z = 10:35 ET (the 10:30 bar: low 778.565, closed green 779.18).
  assert(hits[0] === "13:45 break", JSON.stringify(hits));
  assert(hits.includes("14:35 pullback-hold"), JSON.stringify(hits));
});
Deno.test("watcher replay: the bar right after a break is NOT a pullback (price must move away first)", () => {
  const hits = replay(778.60, "up", spyBars(), 575, "13:46:00", "14:20:00", false);
  assert(!hits.some((h) => /pullback/.test(h)), JSON.stringify(hits));
});
Deno.test("watcher replay: a Desk level waits until 10:00 — first trigger is the 10:35 pullback-and-hold", () => {
  const hits = replay(778.60, "up", spyBars(), 600);
  assert(hits[0] === "14:35 pullback-hold", JSON.stringify(hits));
});
Deno.test("watcher replay: NVDA 242 is flagged as chop (many crossings)", () => {
  const n = M.crossings(242, nvdaBars());
  assert(n === 6, "crossings " + n);   // 9:30–11:30 ET closes crossed 242 six times (≥ 4 = chop warning)
});
Deno.test("watcher: stale bars never fire late (a missed cron minute)", () => {
  const h = M.evalLevel(778.60, "up", spyBars(), 5, { now: at("13:55:00"), earliestMin: 575 });
  assert(h === null, JSON.stringify(h));
});
Deno.test("watcher: Signal words become levels with a side", () => {
  const a = M.levelsFromWords("SPY ABOVE 778.60 GO / SUPPORT 776 AND 775");
  assert(JSON.stringify(a) === JSON.stringify([{ level: 778.6, dir: "up" }, { level: 776, dir: "up" }, { level: 775, dir: "up" }]), JSON.stringify(a));
  const b = M.levelsFromWords("NVDA BELOW 240 PUTS", "down");
  assert(b.length === 1 && b[0].level === 240 && b[0].dir === "down", JSON.stringify(b));
  assert(M.levelsFromWords("AMD PLAYING OUT").length === 0, "no numbers, no levels");
});
Deno.test("watcher tick: two overlapping cron runs fire ONE trigger; Desk line posted; Jarvis asked", async () => {
  reset(); setNow("2026-10-06T13:50:30Z");   // v3.42: the 10-minute 9:40 bar closes 9:50 (779.05 over 778.60); the 5-minute 9:45 fire is gone
  T.otto_watch.push({ id: 7, day: "2026-10-06", ticker: "SPY", level: 778.6, dir: "up", source: "signal", status: "watching", fired: {} });
  claudeScript = () => textReply("Checked it. READ: SPY broke 778.60 on the 9:40 bar. No card — first 30 minutes and the banner is mixed.");
  const [a, b] = await Promise.all([M.watchTick(NOW), M.watchTick(NOW)]);
  const hits = [...(a.hits || []), ...(b.hits || [])];
  assert(hits.length === 1 && /SPY 778.6 up break/.test(hits[0]), JSON.stringify([a, b]));
  await sleep(150);
  assert(/👁 Watcher\] SPY 778.6 — break-and-close \(calls side ▲\) on the 10-minute bar/.test(deskText()), deskText());
  assert(/Jarvis · watcher\] For: 👁 SPY 778.6 ▲ break-and-close\nSPY broke 778.60/.test(deskText()), deskText());
  assert(T.otto_watch[0].fired.up.read && !T.otto_watch[0].fired.up.cards.length, JSON.stringify(T.otto_watch[0].fired));
});
Deno.test("watcher tick: a passed trigger re-arms after 15 min and the 10:30 bounce fires", async () => {
  reset(); setNow("2026-10-06T14:40:20Z");   // v3.42: the 10-minute 10:30 bar closes 10:40 (held 778.60, closed 779.69)
  T.otto_watch.push({ id: 8, day: "2026-10-06", ticker: "SPY", level: 778.6, dir: "up", source: "signal", status: "watching",
    fired: { up: { at: "2026-10-06T13:50:30.000Z", trigger: "break", read: "no card", cards: [] } } });
  claudeScript = () => textReply("READ: Held 778.60 and closed green. No card in this test.");
  const r: any = await M.watchTick(NOW);
  assert(r.hits?.[0] === "SPY 778.6 up pullback-hold", JSON.stringify(r));
  assert(T.otto_watch[0].fired.up.passed?.[0]?.trigger === "break", JSON.stringify(T.otto_watch[0].fired));
});
Deno.test("watcher tick: a level that already produced a card never fires again that day", async () => {
  reset(); setNow("2026-10-06T14:35:20Z");
  T.otto_watch.push({ id: 9, day: "2026-10-06", ticker: "SPY", level: 778.6, dir: "up", source: "signal", status: "watching",
    fired: { up: { at: "2026-10-06T13:45:30.000Z", trigger: "break", read: "card", cards: ["c1"] } } });
  const r: any = await M.watchTick(NOW);
  assert(!(r.hits || []).length, JSON.stringify(r));
});
Deno.test("scoreboard: the 10:35 SPY call idea is a WIN (TP1 780.50 touched 10:55); the mirror put is a LOSS on the 15-min close", () => {
  const win: any = M.gradeIdea({ created: at("14:35:40"), direction: "up", tp1: 780.5, wrong: 778.4, delta: 0.52, premium: 3.6 }, spyBars(), at("15:30:00"));
  assert(win.state === "win" && new RealDate(win.at).toISOString().slice(11, 16) === "14:55", JSON.stringify(win));
  assert(win.pnl_est > 0, JSON.stringify(win));
  const loss: any = M.gradeIdea({ created: at("14:35:40"), direction: "down", tp1: 778.0, wrong: 780.0, delta: 0.5, premium: 3.0 }, spyBars(), at("15:30:00"));
  assert(loss.state === "loss" && loss.pnl_est < 0 && loss.pnl_est >= -300, JSON.stringify(loss));
});
Deno.test("scoreboard: cards carry their source and Watcher trigger", async () => {
  reset(); setNow("2026-10-06T14:35:40Z");
  const c1: any = await M.proposeAction(spyCard(), "watcher", { planExtra: { source: "signal", trigger: "pullback-hold", watch_id: 8 } });
  T.otto_actions[0].status = "rejected";        // v3.21: a 2nd SPY calls card is refused while the 1st is pending
  const c2: any = await M.proposeAction(spyCard(), "ottotrader@vinecreativestudio.com");
  assert(c1.plan.source === "signal" && c1.plan.trigger === "pullback-hold" && c1.plan.watch_id === 8, JSON.stringify(c1.plan));
  assert(c2.plan.source === "desk" && !c2.plan.trigger, JSON.stringify(c2.plan));
});

/* =============================== v3.15 PLAYBOOK + DAILY RECAP + FEEDBACK =============================== */
const idea = (rules: string[], state: string, r: number, setup = "support bounce", trigger?: string) => ({
  id: "i" + (++ID), created_at: new Date().toISOString(), status: "done",
  calls: [{ tool: "place_option_order", args: { legs: [{ position_effect: "open" }] } }],
  plan: { setup, rules, ...(trigger ? { trigger } : {}) }, outcome: { state, r } });
Deno.test("playbook: cleanRules keeps only real book ids, max 6", () => {
  const r = M.cleanRules(["t-1", "T-2", "X-9", "D-1", "M-2", "T-3", "T-4", "T-5", "T-1"]);
  assert(JSON.stringify(r) === JSON.stringify(["T-1", "T-2", "D-1", "M-2", "T-3", "T-4"]), JSON.stringify(r));
  assert(M.cleanRules("T-1, D-4").join() === "T-1,D-4" && M.cleanRules(null).length === 0, "string / null");
});
Deno.test("playbook: a rule is WEAK only after 20 graded trades with average R below 0", () => {
  const ideas: any[] = [];
  for (let i = 0; i < 19; i++) ideas.push(idea(["T-1"], i < 5 ? "win" : "loss", i < 5 ? 1 : -1, "breakout", "break"));
  let st: any = M.playbookStats(ideas);
  assert(st.records["T-1"].scored === 19 && !st.records["T-1"].weak && st.records["T-1"].leads === "material", JSON.stringify(st.records["T-1"]));
  ideas.push(idea(["T-1"], "loss", -1, "breakout", "break"));
  st = M.playbookStats(ideas);
  assert(st.records["T-1"].weak && st.records["setup:breakout"].weak && st.records["trigger:break"].weak, JSON.stringify(st.records));
  assert(st.weak.length === 3 && st.weak.some((w: any) => /T-1/.test(w.label)), JSON.stringify(st.weak));
  // a winning rule with 20 trades leads on results but is not weak
  const good = Array.from({ length: 20 }, (_, i) => idea(["M-2"], i % 2 ? "win" : "loss", i % 2 ? 2 : -1));
  const g: any = M.playbookStats(good).records["M-2"];
  assert(!g.weak && g.leads === "results" && g.avg_r > 0, JSON.stringify(g));
});
Deno.test("playbook: every Jarvis run gets the book rules and the weak list; cards keep their rule ids", async () => {
  reset(); T.otto_settings = [];
  for (let i = 0; i < 20; i++) T.otto_actions.push(idea(["D-1"], "loss", -1));
  await M.playbookRefresh("test");
  const txt = await M.playbookText();
  assert(/T-1 \[Tharp\]/.test(txt) && /M-6 \[McMillan\]/.test(txt) && /RESULTS SAY WEAK[\s\S]*D-1/.test(txt), txt.slice(0, 400));
  T.otto_actions = [];
  const card: any = await M.proposeAction({ ...spyCard(), plan: { ...spyCard().plan, rules: ["T-1", "nope", "m-2"] } }, "ottotrader@vinecreativestudio.com");
  assert(JSON.stringify(card.plan.rules) === '["T-1","M-2"]', JSON.stringify(card.plan));
  const log = T.otto_settings.find((r: any) => r.key === "playbook_log")?.value?.items || [];
  assert(log.some((x: any) => x.kind === "weak") && log.some((x: any) => x.kind === "books"), JSON.stringify(log));
});
Deno.test("daily recap: posts one Desk note and runs once per trading day", async () => {
  reset(); T.otto_settings = []; T.otto_feedback = []; setNow("2026-10-06T21:15:30Z"); // 5:15 PM ET
  T.otto_desk.push({ id: 1, created_at: "2026-10-06T14:40:00Z", role: "user", author: "Josh", content: "Should I move the stop up?" });
  T.otto_feedback.push({ id: 1, created_at: "2026-10-06T19:00:00Z", kind: "bug", note: "NVDA card said Friday expiry", author: "Josh", screen: "Desk" });
  claudeScript = (body: any) => { assert(/Should I move the stop up/.test(body.messages[0].content) && /NVDA card said Friday/.test(body.messages[0].content), "recap input"); return textReply("### Today in one line\nOne question about the stop."); };
  await M.dailyRecap(false);
  const notes = T.otto_desk.filter((r) => r.author === "Jarvis · daily recap");
  assert(notes.length === 1 && /Today in one line/.test(notes[0].content), deskText());
  const again: any = await M.dailyRecap(false);
  assert(again.skipped === "already done" && T.otto_desk.filter((r) => r.author === "Jarvis · daily recap").length === 1, JSON.stringify(again));
});

/* =============================== v3.16 SIGNALS + HONEST JARVIS (replays of 6 Oct) =============================== */
// A fake Robinhood for MU at $1,053.77 with $1,140.82 buying power (the 3:12 PM "SHORTED. SEE THE BREAK" moment).
const MU_SPOT = 1053.77, BP = 1140.82;
const MU_EXPS = ["2026-10-07", "2026-10-09", "2026-10-12", "2026-10-14", "2026-10-16"];
function muHook(spot = MU_SPOT, sym = "MU") {
  const strikes: number[] = []; for (let k = 5; k <= 2000; k += 5) strikes.push(k);
  const inst = (exp: string, type: string, k: number) => ({ id: `${sym}-${exp}-${type}-${k}`, chain_symbol: sym, expiration_date: exp, strike_price: k.toFixed(4), type, state: "active", tradability: "tradable" });
  return (tool: string, args: any) => {
    if (tool === "get_equity_quotes") return { data: { results: [{ quote: { symbol: sym, last_trade_price: String(spot), venue_last_trade_time: new Date().toISOString() } }] } };
    if (tool === "get_option_chains") return { data: { chains: [{ symbol: sym, can_open_position: true, expiration_dates: MU_EXPS }] } };
    if (tool === "get_portfolio") return { data: { total_value: String(BP), buying_power: { buying_power: String(BP) } } };
    if (tool === "get_option_instruments" && args.chain_symbol) {
      // Like Robinhood: 100 strikes a page from the bottom; the cursor is base64("p=<strike>").
      const from = args.cursor ? Number(atob(args.cursor).slice(2)) : 0;
      const list = strikes.filter((k) => k > from).slice(0, 100).map((k) => inst(args.expiration_dates, args.type, k));
      return { data: { instruments: list } };
    }
    if (tool === "get_option_quotes") {
      return { data: { results: (args.instrument_ids || []).map((id: string) => {
        const [, exp, type, ks] = id.split("-").length === 4 ? id.split("-") : [null, id.split("-").slice(1, 4).join("-"), id.split("-")[4], id.split("-")[5]];
        const k = Number(ks), m = (k - spot) * (type === "put" ? 1 : -1), t = 1 + MU_EXPS.indexOf(exp) * 0.25;
        const delta = Math.max(0.03, Math.min(0.97, 0.5 + m / 90)) * (type === "put" ? -1 : 1);
        const ask = Math.max(0.3, (20 + m * 0.55) * t);
        return { quote: { instrument_id: id, ask_price: ask.toFixed(2), bid_price: (ask - 0.3).toFixed(2), mark_price: (ask - 0.15).toFixed(2), delta: delta.toFixed(3), volume: 3000, open_interest: 1500 } };
      }) } };
    }
    return null;
  };
}
const optIdIn = (body: any) => { const t = JSON.stringify(body.messages); const m = /option_id (MU-[0-9-]+-put-\d+)/.exec(t); return m?.[1]; };

Deno.test("shortlist: MU puts start at the money (cursor), not at $5; ★ by the rules, ◆ fits $1,140 buying power", async () => {
  reset(); setNow("2026-10-06T19:12:55Z"); callHook = muHook();
  const sl: any = await M.optionShortlist("MU", "put");
  const inst = calls.filter((c) => c.tool === "get_option_instruments");
  assert(inst.length === 3 && inst.every((c) => c.args.cursor && Number(atob(c.args.cursor).slice(2)) > 980), JSON.stringify(inst.map((c) => c.args)));
  assert(sl.exps.join() === "2026-10-07,2026-10-09,2026-10-12", sl.exps.join());
  assert(sl.rows.every((r: any) => r.strike > 990 && r.strike < 1120), "near the money only");
  assert(sl.best && Math.abs(sl.best.delta) >= 0.3 && Math.abs(sl.best.delta) <= 0.4, JSON.stringify(sl.best));
  assert(sl.bestFit && sl.bestFit.cost <= BP, JSON.stringify(sl.bestFit));
  assert(/★/.test(sl.text) && /◆|fits/.test(sl.text) && /buying power \$1140\.82/.test(sl.text), sl.text.slice(0, 400));
});
Deno.test("pickContracts: when nothing in the delta band fits, ◆ is the closest affordable contract below the band", () => {
  const row = (k: number, d: number, cost: number) => ({ option_id: "o" + k, exp: "2026-10-09", strike: k, type: "put", bid: 1, ask: cost / 100, mark: 1, delta: -d, vol: 10, oi: 5, cost, fits: cost <= 1140, band: d >= .3 && d <= .4, liq: true, label: "MU " + k });
  const { best, bestFit } = M.pickContracts([row(1040, .44, 2300), row(1030, .36, 1700), row(1020, .29, 1200), row(1010, .24, 900), row(990, .12, 300)] as any);
  assert(best.strike === 1030 && bestFit.strike === 1010, JSON.stringify({ best, bestFit }));
});

// Replays batch #8 (6 Oct, 3:12 PM): a live MU short call. Jarvis keeps browsing; the last step is forced to the card.
function seedMuBatch(words = "SHORTED. SEE THE BREAK / OR MISS IT") {
  T.otto_jason.push({ id: 801, created_at: "2026-10-06T19:12:54Z", day: "2026-10-06", posted_at: "2026-10-06T19:12:40Z", posted_label: "3:12 PM", kind: "call", ticker: "MU", direction: "short", late: false, words, source: "watcher" });
  T.otto_signal_batches.push({ id: 8, created_at: "2026-10-06T19:12:54Z", day: "2026-10-06", msg_ids: ["m1"], rows: [801], status: "jarvis" });
}
Deno.test("signal replay (MU 3:12 PM): the server pre-fetches the contracts and the call ALWAYS ends in a card + ping", async () => {
  reset(); setNow("2026-10-06T19:12:55Z"); callHook = muHook(); seedMuBatch();
  let forced = false;
  claudeScript = (body: any) => {
    assert(/ONE STEP/.test(JSON.stringify(body.messages[0])) && /CONTRACTS:/.test(JSON.stringify(body.messages[0])), "v3.23: one-step prefetch in the prompt");
    if (body.tool_choice?.name === "propose_action") {
      forced = true;
      const id = optIdIn(body);
      return toolReply("propose_action", { title: "Buy 1 MU 1020P 10/7 @ 10.00", summary: "test", read: "MU short: he shorted the break. Puts. Wrong on a 5-min close back over 1060.", plan: { tv_symbol: "NASDAQ:MU", direction: "down", setup: "otto signal", jason_id: 801, tp1: 1040, stop: 1060, stop_option: 6, expires: "2026-10-07" },
        calls: [{ service: "rh", tool: "place_option_order", args: { legs: [{ option_id: id, side: "buy", position_effect: "open" }], quantity: "1", type: "limit", price: "10.00", time_in_force: "gfd" } }] });
    }
    return toolReply("rh__get_option_instruments", { chain_symbol: "MU", expiration_dates: "2026-10-16", type: "put" });   // the 6 Oct habit
  };
  await M.signalJarvis(8);
  const b = T.otto_signal_batches[0];
  assert(forced, "v3.23: the first (only) step is forced to propose_action");
  assert(/^MU short: he shorted the break/.test(T.otto_signal_batches[0].read || ""), "the card's read is the feed read: " + T.otto_signal_batches[0].read);
  assert(b.status === "done" && b.cards.length === 1, JSON.stringify(b));
  assert(T.otto_jason[0].action_id === b.cards[0], "card linked to the call");
  assert(!/enormous|Let me/.test(b.read || ""), "no working notes in the feed: " + b.read);
  assert(pings.some((p) => /Card ready: MU SHORT/.test(p.title)), JSON.stringify(pings));
  assert(b.timing && b.timing.cards === 1, JSON.stringify(b.timing));
  assert(T.otto_actions[0].pinged_at, "card marked pinged");
});
Deno.test("signal replay: a call that ends with NO card pings the reason (6 Oct MU was silent)", async () => {
  reset(); setNow("2026-10-06T19:12:55Z"); callHook = muHook(); seedMuBatch();
  claudeScript = () => textReply("MU is up $21 past the level, chasing.\nREAD: MU short signal. Not building a card — it already ran.");
  await M.signalJarvis(8);
  const b = T.otto_signal_batches[0];
  assert(b.status === "done" && !b.cards.length && /No card for MU/.test(b.read), JSON.stringify(b));
  assert(pings.some((p) => /MU SHORT — NO card/.test(p.title) && /decided against/.test(p.body)), JSON.stringify(pings));
  assert(/no card — Jarvis decided against/.test(deskText()), deskText());
});
Deno.test("signal replay: ran out of steps with no READ line → plain server read, never the working notes", async () => {
  reset(); setNow("2026-10-06T19:12:55Z"); callHook = muHook(); seedMuBatch();
  claudeScript = (body: any) => body.tool_choice ? textReply("The chain response is enormous.") : toolReply("rh__get_option_quotes", { instrument_ids: [] });
  await M.signalJarvis(8);
  const b = T.otto_signal_batches[0];
  assert(!/enormous/.test(b.read) && /MU short call at 3:12 PM/.test(b.read) && /ran out of steps|decided/.test(b.read), b.read);
  assert(pings.some((p) => /NO card/.test(p.title)), JSON.stringify(pings));
});
Deno.test("signal results: '$1000 for 2 PUTS ON MU' is a result, linked to his MU call, no card, no ping", async () => {
  reset(); setNow("2026-10-06T19:40:00Z");
  T.otto_jason.push({ id: 801, day: "2026-10-06", kind: "call", ticker: "MU", direction: "short", words: "SHORTED" });
  T.otto_jason.push({ id: 802, day: "2026-10-06", kind: "result", ticker: "MU", words: "$1000 FOR 2 PUTS ON MU" });
  await M.linkResults([T.otto_jason[1]]);
  assert(T.otto_jason[1].result_for === 801, JSON.stringify(T.otto_jason[1]));
});

Deno.test("promises: yesterday's exact lines are caught; honest lines are not", () => {
  const said = "Stop is protected at $2.00 ✅. I'll flag you at 1:30 if it's still stuck. Watch the chart, not the P&L.\nNo flag from me yet. I'm watching. You don't need to do anything.\nI can't watch between messages, so set an alert.";
  const p = M.findPromises(said);
  assert(p.length === 2 && p[0].kind === "later" && p[1].kind === "watch", JSON.stringify(p));
  const ctx = { did: [], failed: [], protectedTrade: true, autoClose: true, watchToday: [] };
  assert(M.unbacked(p, ctx).length === 2, "both unbacked with nothing scheduled");
  assert(M.unbacked(p, { ...ctx, did: ["schedule_check"] }).length === 0, "a check-in backs both");
  const stop = M.findPromises("If SPY closes under 778.60 the wrong-if alert fires and I'll close it via auto-close.");
  assert(stop.length === 1 && M.unbacked(stop, ctx).length === 0, "protected trade + auto-close backs that one");
  assert(!M.findPromises("Tell me and I'll close it at market on the first print.").length, "an offer waiting on them is fine");
  const honest = ["I'll tell you why: the 15-minute candle closed through.", "I'll move on to NVDA next.", "I'll close with the key levels: 242 and 245.",
    "I'm tracking with you — that's a fair read.", "I've added context below.", "Your stop is set at 1.20 in the plan.", "Robinhood says the order is working.",
    "Once you approve, I'll post the fill.", "I'll let you know what I find in a sec."];
  for (const h of honest) assert(!M.findPromises(h).length, "false positive: " + h);
  const real = ["I'm watching.", "If anything starts looking ugly I'll say something before it becomes a problem.", "I'll ping you when SPY hits 784.50.",
    "I'll check back in 20 minutes.", "I've set an alert at 778.60."];
  for (const r of real) assert(M.findPromises(r).length === 1, "missed: " + r);
  const placed = M.findPromises("I've placed the order for 1 SPY 781C.");
  assert(M.unbacked(placed, { ...ctx, did: ["propose_action"] }).length === 1, "a card is not a placed order");
});
Deno.test("desk (12:02 PM replay): 'I'll flag you at 1:30' → server check → Jarvis schedules a real 1:30 check-in", async () => {
  reset(); setNow("2026-10-06T16:02:00Z");
  let n = 0;
  claudeScript = (body: any) => {
    n++;
    const last = JSON.stringify(body.messages.at(-1));
    if (/OTTO SERVER CHECK/.test(last)) return toolReply("schedule_check", { at: "1:30 PM", what: "SPY 781C: still stuck under 784.50 TP1? Tell Ifoma." });
    if (/Scheduled #/.test(last)) return textReply("Set — I'll check back at 1:30 PM ET and ping you.");
    return textReply("Holding. I'll flag you at 1:30 if it's still stuck. I'm watching.");
  };
  const req = new Request("https://x/?fn=desk", { method: "POST", body: JSON.stringify({ author: "Ifoma", messages: [{ role: "user", content: "anything I should do on SPY?" }] }) });
  const res = await M.desk(req, "ottotrader@vinecreativestudio.com", "k");
  const streamed = await res.text();
  assert(n === 3, "reply, correction, confirmation: " + n);
  assert(T.otto_checks.length === 1 && /2026-10-06T17:30:00/.test(T.otto_checks[0].due_at), JSON.stringify(T.otto_checks));
  assert(/⏰ Check-in set for 1:30 PM ET/.test(deskText()), deskText());
  assert(/I'll check back at 1:30 PM/.test(streamed), "the fix is streamed under the reply");
  const pr = T.otto_settings.find((r: any) => r.key === "promise_day")?.value;
  assert(pr && pr.made === 2 && pr.corrected === 2, JSON.stringify(pr));
});
Deno.test("desk: a promise Jarvis won't back gets the plain server correction", async () => {
  reset(); setNow("2026-10-06T16:17:00Z");
  claudeScript = () => textReply("No flag from me yet. I'm watching. You don't need to do anything.");
  const req = new Request("https://x/?fn=desk", { method: "POST", body: JSON.stringify({ author: "Ifoma", messages: [{ role: "user", content: "ok?" }] }) });
  const res = await M.desk(req, "ottotrader@vinecreativestudio.com", "k");
  const streamed = await res.text();
  assert(/Correction: I can't watch the market between messages/.test(streamed), streamed.slice(-400));
  assert(/Correction: I can't watch/.test(deskText()), deskText());
});
Deno.test("check-ins: due at 1:30 → Jarvis runs, posts on the Desk, pings; never twice", async () => {
  reset(); setNow("2026-10-06T17:30:20Z");
  T.otto_checks.push({ id: 5, day: "2026-10-06", due_at: "2026-10-06T17:30:00.000Z", what: "SPY 781C still stuck?", by: "Ifoma via Jarvis", status: "pending" });
  claudeScript = () => textReply("SPY 782.10, still under TP1 784.50. Plan says hold; the stop is working.");
  await Promise.all([M.checksTick(NOW), M.checksTick(NOW)]);
  await sleep(50);
  assert(T.otto_checks[0].status === "done", JSON.stringify(T.otto_checks[0]));
  assert(T.otto_desk.filter((r) => r.author === "Jarvis · check-in").length === 1, deskText());
  assert(pings.filter((p) => p.kind === "checkin").length === 1, JSON.stringify(pings));
});
Deno.test("check-ins: a time that has passed or is after 4:15 is refused (Jarvis must say so)", async () => {
  reset(); setNow("2026-10-06T16:02:00Z");
  let e1 = "", e2 = "";
  try { await M.checkAdd("11:30 AM", "x", "t"); } catch (e) { e1 = (e as Error).message; }
  try { await M.checkAdd("5:00 PM", "x", "t"); } catch (e) { e2 = (e as Error).message; }
  assert(/passed/.test(e1) && /4:15/.test(e2), e1 + " | " + e2);
});
Deno.test("missed pings: a Signal card whose run was cut off is pinged after 3 min, once", async () => {
  reset(); setNow("2026-10-06T19:16:00Z");
  T.otto_actions.push({ id: "a1", title: "Buy 1 MU 1020P", status: "pending", created_by: "signals", created_at: "2026-10-06T19:12:30Z", pinged_at: null });
  await M.cardSweep(NOW); await M.cardSweep(NOW);
  assert(pings.filter((p) => /Card waiting: Buy 1 MU/.test(p.title)).length === 1, JSON.stringify(pings));
});
Deno.test("self-test: 9:10 AM — heartbeat, read, shortlist, dry-run card → ✅ on the Desk, no ping, no card stored", async () => {
  reset(); setNow("2026-10-07T13:10:00Z"); callHook = muHook(781.2, "SPY");
  T.otto_settings.push({ key: "signal_beat", value: { at: "2026-10-07T13:09:30Z", state: "ok", queue: 0, queue_age: 0 } });
  extractHook = () => [{ kind: "call", ticker: "SPY", direction: "long", words: "SPY LONG", time: "9:10 AM" }];
  claudeScript = (body: any) => {
    const t = JSON.stringify(body.messages);
    const m = /option_id (SPY-[0-9-]+-call-\d+)/.exec(t);
    return /SELF-TEST: card accepted/.test(t) ? textReply("ok") : toolReply("propose_action", { title: "TEST Buy 1 SPY", summary: "t", read: "SPY long — test.", plan: { tv_symbol: "AMEX:SPY", direction: "up", setup: "otto signal", tp1: 784, stop: 779, stop_option: 1.5 },
      calls: [{ service: "rh", tool: "place_option_order", args: { legs: [{ option_id: m?.[1], side: "buy", position_effect: "open" }], quantity: "1", type: "limit", price: "3.00", time_in_force: "gfd" } }] });
  };
  const r: any = await M.signalSelfTest(false);
  assert(r.ok, JSON.stringify(r.steps));
  assert(/✅ Signal self-test 9:10 AM/.test(deskText()), deskText());
  assert(!T.otto_actions.length && !pings.length, "nothing stored, nobody pinged");
  const again: any = await M.signalSelfTest(false);
  assert(again.skipped === "already ran", JSON.stringify(again));
});
Deno.test("self-test: a sleeping Engineer PC fails the test and pings", async () => {
  reset(); setNow("2026-10-07T13:10:00Z"); callHook = muHook(781.2, "SPY");
  T.otto_settings.push({ key: "signal_beat", value: { at: "2026-10-07T12:40:00Z", state: "ok" } });
  extractHook = () => [{ kind: "call", ticker: "SPY", direction: "long", words: "SPY LONG", time: "9:10 AM" }];
  claudeScript = () => textReply("no");
  const r: any = await M.signalSelfTest(true);
  assert(!r.ok && /Engineer PC awake/.test(r.steps[0].note), JSON.stringify(r.steps));
  assert(pings.some((p) => /self-test failed/.test(p.title)), JSON.stringify(pings));
});
Deno.test("names: curly apostrophes don't leak the coach's name; streamed text is filtered too", async () => {
  const out = M.unnameForTest("held Jason’s 778.60 trigger level");
  assert(!/Jason/.test(out), out);
});

/* =============================== v3.17: extension 1.3 edits =============================== */
Deno.test("edits (ext 1.3): an edited post updates the message and is read again; an unchanged re-send is ignored", async () => {
  reset(); setNow("2026-10-06T19:12:50Z"); callHook = muHook();
  T.otto_settings.push({ key: "signals", value: { key: "k".repeat(20) } });
  const seenTexts: string[] = [];
  extractHook = (text: string) => { seenTexts.push(text); return /1020P/.test(text) ? [{ kind: "call", ticker: "MU", direction: "short", words: "MU SHORT 1020P", time: "3:12 PM" }] : [{ kind: "note", ticker: "MU", words: "MU", time: "3:12 PM" }]; };
  claudeScript = () => textReply("READ: MU short, see the card chat.");
  const post = (msgs: any[]) => M.signalInForTest(new Request("https://x/?fn=signal_in", { method: "POST", headers: { "x-otto-signal": "k".repeat(20) },
    body: JSON.stringify({ kind: "msgs", msgs }) }));
  const id = "1424790000000000001", base = { id, at: "2026-10-06T19:12:40.000Z", author: "Jason", author_id: "474721184903200819", channel: "1139244584757637192" };
  const a: any = await post([{ ...base, text: "MU" }]);
  await sleep(120);
  const b: any = await post([{ ...base, text: "MU SHORT 1020P", edited: true }]);
  await sleep(200);
  const c: any = await post([{ ...base, text: "MU SHORT 1020P", edited: true }]);
  assert(a.new === 1 && b.new === 1 && c.new === 0, JSON.stringify([a, b, c]));
  assert(T.otto_signal_msgs.find((m) => m.msg_id === id).text === "MU SHORT 1020P", JSON.stringify(T.otto_signal_msgs));
  assert(seenTexts.some((t) => /\[edited\] MU SHORT 1020P/.test(t)), seenTexts.join(" || "));
  assert(T.otto_jason.some((r) => r.kind === "call" && r.words === "MU SHORT 1020P"), JSON.stringify(T.otto_jason));
});
Deno.test("edits (ext 1.3): an 'edit' for a post we never got is treated as new", async () => {
  reset(); setNow("2026-10-06T19:12:50Z");
  T.otto_settings.push({ key: "signals", value: { key: "k".repeat(20) } });
  extractHook = () => [];
  const r: any = await M.signalInForTest(new Request("https://x/?fn=signal_in", { method: "POST", headers: { "x-otto-signal": "k".repeat(20) },
    body: JSON.stringify({ kind: "msgs", msgs: [{ id: "1424790000000000002", at: "2026-10-06T19:12:40.000Z", author: "Jason", author_id: "474721184903200819", text: "NVDA", edited: true }] }) }));
  assert(r.new === 1 && T.otto_signal_msgs.length === 1, JSON.stringify(r));
});
Deno.test("self-test dry run: accepts limit_price and string args like the real card path; names what's missing", async () => {
  reset(); setNow("2026-10-07T13:10:00Z");
  let n = 0;
  claudeScript = () => n++ === 0
    ? toolReply("propose_action", { title: "T", summary: "s", plan: { tv_symbol: "AMEX:SPY", direction: "up", setup: "otto signal", tp1: 1, stop: 1 },
        calls: [{ service: "rh", tool: "place_option_order", args: { legs: [{ option_id: "x", side: "buy", position_effect: "open" }], quantity: "1", limit_price: "3" } }] })
    : n === 2 ? toolReply("propose_action", { title: "T", summary: "s", plan: { tv_symbol: "AMEX:SPY", direction: "up", setup: "otto signal", tp1: 1, stop: 1, stop_option: 1.5 },
        calls: [{ service: "rh", tool: "place_option_order", args: JSON.stringify({ legs: [{ option_id: "x", side: "buy", position_effect: "open" }], quantity: "1", limit_price: "3" }) }] })
    : textReply("ok");
  const r: any = await M.runDesk({ msgs: [{ role: "user", content: "x" }], sys: "S", tools: [{ name: "propose_action" }], cs: [], who: "selftest", send: () => {}, allowPropose: true, dryRun: true, maxRounds: 3 });
  assert(/missing plan\.stop_option/.test(r.errors[0]) && r.dry.length === 1, JSON.stringify(r.errors));
});

/* =============================== v3.18 MORNING PREP + SCORE EXTRA =============================== */
Deno.test("prep: submit → Jarvis asks 2–3 questions first (no grade yet) and reads the levels", async () => {
  reset(); setNow("2026-10-07T12:41:00Z");   // 8:41 AM ET
  let sawImage = false;
  claudeScript = (body: any) => {
    sawImage = JSON.stringify(body.messages).includes('"type":"image"');
    assert(body.tool_choice?.name === "prep_questions", "forced questions tool");
    return toolReply("prep_questions", { questions: ["What makes 783.40 a rejection?", "778.60: open or order-block low?", "NVDA catalyst?"], bias: "short", main: "SPY",
      levels: [{ ticker: "SPY", level: 783.4, dir: "down", note: "gap top" }, { ticker: "spy", level: 778.6, dir: "down" }, { ticker: "", level: 5 }] });
  };
  const r: any = await M.prepSubmit({ author: "Ifoma", notes: "Leaning short. SPY 783.40 gap top, 778.60 support.", images: [{ mime: "image/jpeg", data: "x".repeat(200) }] });
  assert(sawImage, "the chart goes to Jarvis");
  assert(r.prep.status === "asked" && r.prep.thread[0].questions.length === 3 && !r.prep.grade, JSON.stringify(r.prep));
  assert(r.prep.levels.length === 2 && r.prep.levels[1].ticker === "SPY" && r.prep.bias === "short", JSON.stringify(r.prep.levels));
  assert(T.otto_prep_imgs.length === 1, "image stored");
});
Deno.test("prep: the answer → a grade (letter, scores, strong/fix/missing); a later message is coaching, not a re-grade", async () => {
  reset(); setNow("2026-10-07T12:46:00Z");
  T.otto_prep.push({ id: 31, day: "2026-10-07", author: "Ifoma", notes: "Leaning short", status: "asked", thread: [{ role: "jarvis", kind: "questions", questions: ["q1", "q2"] }],
    bias: "short", main: "SPY", levels: [{ ticker: "SPY", level: 783.4, dir: "down", note: "gap top" }] });
  claudeScript = (body: any) => body.tool_choice?.name === "prep_grade"
    ? toolReply("prep_grade", { letter: "B+", process: 8, levels_score: 9, plan: 7, strong: ["Short at resistance — Otto Rules, 1 Oct"], fix: ["NVDA has no catalyst"], missing: ["target"],
        levels: [{ ticker: "SPY", level: 783.4, dir: "down", note: "gap top" }, { ticker: "SPY", level: 776, dir: "down", note: "next support" }] })
    : textReply("776 is your cover zone.");
  const g: any = await M.prepReply({ id: 31, text: "1) close above 783.40 = wrong 2) order-block low" });
  assert(g.prep.status === "graded" && g.prep.grade.letter === "B+" && g.prep.grade.fix[0] === "NVDA has no catalyst" && g.prep.levels.length === 2, JSON.stringify(g.prep));
  T.otto_prep[0] = { ...T.otto_prep[0], ...g.prep };
  const f: any = await M.prepReply({ id: 31, text: "where do I cover?" });
  assert(f.prep.thread.at(-1).kind === "text" && /776/.test(f.prep.thread.at(-1).text) && T.otto_prep[0].grade.letter === "B+", JSON.stringify(f.prep.thread.at(-1)));
});
Deno.test("prep: + Watcher puts the level on today's Watcher (and only on the day of the read)", async () => {
  reset(); setNow("2026-10-07T12:50:00Z");
  T.otto_prep.push({ id: 32, day: "2026-10-07", author: "Josh", status: "graded", levels: [{ ticker: "SPY", level: 778.6, dir: "down", note: "ob low" }] });
  const r: any = await M.prepWatch({ id: 32, idx: 0 }, "x");
  assert(r.levels[0].watched && T.otto_watch.some((w) => w.ticker === "SPY" && Number(w.level) === 778.6 && w.dir === "down"), JSON.stringify(T.otto_watch));
  assert(/Josh's morning read/.test(deskText()), deskText());
  T.otto_prep[0].day = "2026-10-06";
  let e = ""; try { await M.prepWatch({ id: 32, idx: 0 }, "x"); } catch (x) { e = (x as Error).message; }
  assert(/day of the read/.test(e), e);
});
Deno.test("prep grade at 4:05 (real 6 Oct SPY bars): a long read off 778.60 is RIGHT; 778.60 was touched", async () => {
  reset(); setNow("2026-10-06T20:05:30Z");
  T.otto_prep.push({ id: 33, day: "2026-10-06", author: "Ifoma", bias: "long", main: "SPY", levels: [{ ticker: "SPY", level: 778.6, dir: "up" }, { ticker: "SPY", level: 790, dir: "up" }], result: null });
  const r: any = await M.prepGradeTick(false);
  const res = T.otto_prep[0].result;
  assert(r.graded === 1 && res && ["right", "wrong", "flat"].includes(res.direction), JSON.stringify(res));
  assert(res.levels[0].touched === true && res.levels[1].touched === false && res.of === 2, JSON.stringify(res.levels));
});
Deno.test("prep grade: neutral on a flat day is right; a short on an up day is wrong", () => {
  const bar = (o: number, c: number) => ({ t: 0, o, h: Math.max(o, c), l: Math.min(o, c), c });
  assert(M.gradeRead("neutral", [bar(100, 100.05)], [], {})!.direction === "right", "flat");
  assert(M.gradeRead("short", [bar(100, 101)], [], {})!.direction === "wrong", "short on up day");
  assert(M.gradeRead("long", [bar(100, 100.1)], [], {})!.direction === "flat", "long on a flat day");
});
Deno.test("score extra: Signal speed from v3.16 timings + the coach's calls scoreboard", async () => {
  reset(); setNow("2026-10-07T20:30:00Z");
  T.otto_jason.push({ id: 1, ticker: "MU", direction: "short", kind: "call", words: "SHORTED", day: "2026-10-06", score: { state: "worked", close_pct: 1.9, best_pct: 2.6 } });
  T.otto_jason.push({ id: 2, kind: "result", result_for: 1, words: "$1000 FOR 2 PUTS ON MU" });
  T.otto_signal_batches.push({ id: 9, created_at: "2026-10-07T14:02:05Z", status: "done", cards: ["c"], rows: [1], timing: { posted: "2026-10-07T14:02:01Z", total_ms: 41000 } });
  const r: any = await M.scoreExtra();
  assert(r.speed[0].caught_s === 4 && r.speed[0].card_s === 41 && r.median_card_s === 41, JSON.stringify(r.speed));
  assert(r.coach[0].ticker === "MU" && r.coach[0].worked === 1 && /1000/.test(r.coach[0].results[0]), JSON.stringify(r.coach));
});

/* =============================== v3.19 LOCK TODAY'S PLAN =============================== */
const PLAN = { ticker: "spy", side: "puts", entry: 783.4, how: "reject", tf: "5m", wrong_if: 784.5, target: 778.6, why: "gap top rejection" };
Deno.test("plan: the four lines must be complete and on the right sides (calls up, puts down)", () => {
  const ok: any = M.planValidate(PLAN);
  assert(ok.ok && ok.plan.ticker === "SPY" && ok.plan.rr === 4.36, JSON.stringify(ok));
  assert(/the candle timeframe/.test((M.planValidate({ ...PLAN, tf: "" }) as any).error), "timeframe required");
  assert(/wrong-if price/.test((M.planValidate({ ...PLAN, wrong_if: "" }) as any).error), "wrong-if required");
  assert(/For puts/.test((M.planValidate({ ...PLAN, target: 790 }) as any).error), "puts target above entry is refused");
  assert(/For calls/.test((M.planValidate({ ...PLAN, side: "calls" }) as any).error), "calls with a target below is refused");
  assert((M.planValidate({ ...PLAN, side: "calls", wrong_if: 782, target: 790 }) as any).ok, "a good calls plan passes");
});
Deno.test("plan lock: Jarvis passes it → entry goes on the Watcher, plan saved, Desk line posted", async () => {
  reset(); setNow("2026-10-07T13:05:00Z");
  T.otto_prep.push({ id: 41, day: "2026-10-07", author: "Josh", status: "graded", grade: { letter: "B-", fix: ["pick ONE ticker"] }, levels: [] });
  claudeScript = (body: any) => { assert(body.tool_choice?.name === "plan_check", "forced plan_check"); return toolReply("plan_check", { ok: true, fixes: [], note: "R:R 4.4 — short at resistance" }); };
  const r: any = await M.prepLock({ id: 41, ...PLAN }, "x");
  assert(r.locked && T.otto_prep[0].plan.ticker === "SPY" && T.otto_prep[0].plan.note && T.otto_prep[0].plan.changes === 0, JSON.stringify(r));
  assert(T.otto_watch.some((w) => w.ticker === "SPY" && Number(w.level) === 783.4 && w.dir === "down"), JSON.stringify(T.otto_watch));
  assert(/📌 Josh locked today's plan: SPY puts/.test(deskText()), deskText());
  const pl: any[] = await M.plansToday();
  assert(pl.length === 1 && pl[0].author === "Josh" && /wrong if 784.5/.test(pl[0].line), JSON.stringify(pl));
});
Deno.test("plan lock: Jarvis wants fixes → NOT locked; 'Lock anyway' locks it and keeps the fixes on record; a change counts", async () => {
  reset(); setNow("2026-10-07T13:05:00Z");
  T.otto_prep.push({ id: 42, day: "2026-10-07", author: "Josh", status: "graded", levels: [] });
  claudeScript = () => toolReply("plan_check", { ok: false, fixes: ["Wrong-if is only 1.10 away on a 5m chart — that's noise"], note: "" });
  const a: any = await M.prepLock({ id: 42, ...PLAN }, "x");
  assert(!a.locked && a.fixes.length === 1 && !T.otto_prep[0].plan && !T.otto_watch.length, JSON.stringify(a));
  const b: any = await M.prepLock({ id: 42, ...PLAN, force: true }, "x");
  assert(b.locked && T.otto_prep[0].plan.fixes_overridden.length === 1 && /over Jarvis's fixes/.test(deskText()), JSON.stringify(b));
  claudeScript = () => toolReply("plan_check", { ok: true, fixes: [], note: "" });
  await M.prepLock({ id: 42, ...PLAN, wrong_if: 785.2 }, "x");
  assert(T.otto_prep[0].plan.changes === 1 && /Josh changed today's plan/.test(deskText()), JSON.stringify(T.otto_prep[0].plan));
  await M.prepLock({ id: 42, ...PLAN, entry: 783.9, wrong_if: 785.2 }, "x");
  const live = T.otto_watch.filter((w) => w.status === "watching").map((w) => Number(w.level));
  assert(live.length === 1 && live[0] === 783.9 && T.otto_prep[0].plan.changes === 2, "a moved entry takes the old level off the Watcher: " + JSON.stringify(T.otto_watch));
});
Deno.test("plan lock: refused on another day; Jarvis down → still locks (check skipped, never blocks)", async () => {
  reset(); setNow("2026-10-07T13:05:00Z");
  T.otto_prep.push({ id: 43, day: "2026-10-06", author: "Ifoma", status: "graded", levels: [] });
  let e = ""; try { await M.prepLock({ id: 43, ...PLAN }, "x"); } catch (x) { e = (x as Error).message; }
  assert(/day of the read/.test(e), e);
  T.otto_prep[0].day = "2026-10-07";
  claudeScript = () => new Error("overloaded") as any;
  const r: any = await M.prepLock({ id: 43, ...PLAN }, "x");
  assert(r.locked && T.otto_prep[0].plan, JSON.stringify(r));
});
Deno.test("plan vs tape: trigger then target / wrong-if / both / no trigger", () => {
  const b = (t: number, o: number, h: number, l: number, c: number) => ({ t, o, h, l, c });
  const p = { side: "puts", how: "reject", entry: 783.4, wrong_if: 784.5, target: 778.6 };
  assert(M.planVsTape(p, [b(1, 782, 783, 781, 782)]).outcome === "no trigger", "never reached");
  assert(M.planVsTape(p, [b(1, 783, 783.6, 782.8, 783), b(2, 783, 783, 778.5, 779)]).outcome === "target", "target");
  assert(M.planVsTape(p, [b(1, 783, 783.6, 782.8, 783), b(2, 783, 784.6, 782, 784)]).outcome === "wrong-if", "wrong-if");
  assert(M.planVsTape(p, [b(1, 783, 783.6, 782.8, 783), b(2, 783, 785, 778, 780)]).outcome === "both in one bar", "both");
  const c = { side: "calls", how: "break", entry: 780, wrong_if: 779, target: 783 };
  assert(M.planVsTape(c, [b(1, 779, 780.5, 779, 779.8)]).outcome === "no trigger", "a wick isn't a break — needs the close");
  assert(M.planVsTape(c, [b(1, 779, 780.5, 779, 780.3), b(2, 780, 781, 780, 781)]).outcome === "neither by the close", "neither");
});
Deno.test("plan adherence: no trade / on plan / partly off / off plan", () => {
  const p = { ticker: "SPY", side: "puts" };
  assert(M.planAdherence(p, []).adherence === "no trade", "none");
  assert(M.planAdherence(p, [{ sym: "SPY", type: "puts" }]).adherence === "on plan", "on");
  assert(M.planAdherence(p, [{ sym: "SPY", type: "puts" }, { sym: "NVDA", type: "calls" }]).adherence === "partly off plan", "partly");
  const off: any = M.planAdherence(p, [{ sym: "SPY", type: "calls" }]);
  assert(off.adherence === "off plan" && off.traded[0] === "SPY calls", JSON.stringify(off));
});
Deno.test("plan at 4:05 (real 6 Oct bars): the plan is graded with the read, against the Agentic account's opening trades", async () => {
  reset(); setNow("2026-10-06T20:05:30Z");
  T.otto_prep.push({ id: 44, day: "2026-10-06", author: "Josh", bias: "long", main: "SPY", levels: [], result: null,
    plan: { ticker: "SPY", side: "calls", entry: 778.6, how: "hold", tf: "5m", wrong_if: 777.5, target: 781, rr: 2.18 } });
  callHook = (tool, args) => tool === "get_option_orders" && args.state === "filled"
    ? { data: { orders: [{ chain_symbol: "SPY", legs: [{ position_effect: "open", option_type: "call" }] }, { chain_symbol: "SPY", legs: [{ position_effect: "close", option_type: "call" }] }] } } : null;
  const r: any = await M.prepGradeTick(false);
  const res = T.otto_prep[0].result;
  assert(r.graded === 1 && res.plan && typeof res.plan.trigger === "boolean" && res.plan.adherence === "on plan", JSON.stringify(res.plan));
});
Deno.test("plans: the Desk context carries today's locked plans", async () => {
  reset(); setNow("2026-10-07T14:00:00Z");
  T.otto_prep.push({ id: 45, day: "2026-10-07", author: "Josh", plan: { ticker: "SPY", side: "puts", entry: 783.4, how: "reject", tf: "5m", wrong_if: 784.5, target: 778.6, rr: 4.36 } });
  const w: any = await M.watchGet();
  assert(w.plans?.length === 1 && w.plans[0].author === "Josh", JSON.stringify(w.plans));
});

/* ======================= v3.19.1 — TradingView timeout must not crash the worker ======================= */
// 7 Oct: 100+ "event loop error: TradingView timed out" in the Supabase logs. With the breaker open,
// tvBudget walked away from a TradingView call that was already running; when it later failed nobody
// was listening, and Supabase shut the worker down — killing Josh's Desk replies and Signal runs with it.
Deno.test("v3.19.1: breaker open + TradingView fails later → no stray rejection, Desk reply and a Robinhood run both finish", async () => {
  reset();
  const saved = (globalThis as any).__OTTO_TEST__.call;
  (globalThis as any).__OTTO_TEST__.call = async (service: string, tool: string, args: any) => {
    if (service === "tv") { await sleep(150); throw new Error("TradingView timed out"); }
    if (tool === "get_equity_quotes") { await sleep(400); return { content: [{ type: "text", text: JSON.stringify({ data: { results: [{ quote: { last_trade_price: "236.76" } }] } }) }] }; }
    return fakeCall(service, tool, args);
  };
  try {
    T.otto_settings.push({ key: "tv_slow_until", value: Date.now() + 3600_000 });
    const before = (M as any).strayCount();
    claudeScript = (body: any) => {
      const n = body.messages.length;
      if (n === 1) return JSON.stringify(body.messages[0]).includes("JOSH") ? toolReply("tv__mcp-tv-get-ohlcv", { symbol: "NASDAQ:NVDA", interval: "5", count: 3 }) : toolReply("rh__get_equity_quotes", { symbols: ["NVDA"] });
      return textReply(JSON.stringify(body.messages[n - 1]).includes("236.76") ? "RH-DONE" : "JOSH-REPLY");
    };
    const go = (who: string, t: string) => M.runDesk({ msgs: [{ role: "user", content: t }], sys: "S", tools: [], cs: [], who, send: () => {}, allowPropose: false });
    const [a, b] = await Promise.all([go("josh", "JOSH: check nvda"), go("signals", "SIGNAL: card")]);
    await sleep(500);   // the abandoned TradingView call fails in here
    assert(String(a.said).includes("JOSH-REPLY"), "Josh got no reply: " + a.said);
    assert(String(b.said).includes("RH-DONE"), "Robinhood run cut off: " + b.said);
    assert((M as any).strayCount() === before, "a TradingView failure went unhandled");
  } finally { (globalThis as any).__OTTO_TEST__.call = saved; }
});
Deno.test("v3.19.1: the stray-rejection safety net is installed", async () => {
  const src = await Deno.readTextFile(new URL("../otto-proxy.ts", import.meta.url));
  assert(/addEventListener\("unhandledrejection"[\s\S]{0,80}preventDefault\(\)/.test(src), "safety net missing");
  assert(/function tvBudget[\s\S]{0,600}p\.catch\(\(\) => \{\}\);[\s\S]{0,40}if \(tvSlow\(\)\)/.test(src), "tvBudget must handle the call before the breaker check");
});

/* ======================= v3.20 — contracts the account can take; stops on Robinhood's price steps ======================= */
// Synthetic chains built from 7 Oct's real numbers (MU ~1,080, QQQ ~756, NVDA ~237; Agentic buying power ~$1,121).
function fakeChain(sym: string, spot: number, step: number, premAtm: number, bp: number) {
  const exps = ["2026-10-09", "2026-10-16", "2026-10-23"];
  const strikes: number[] = []; for (let k = Math.round(spot / step) * step - 6 * step; k <= spot + 6 * step; k += step) strikes.push(+k.toFixed(2));
  const ins: any[] = [];
  for (const e of exps) for (const ty of ["call", "put"]) for (const k of strikes) ins.push({ id: `${sym}-${e}-${ty}-${k}`, strike_price: String(k), expiration_date: e, type: ty, tradability: "tradable", state: "active" });
  const q = (id: string) => {
    const [, e, ty, ks] = id.split("-").length > 4 ? [id.split("-")[0], id.split("-").slice(1, 4).join("-"), id.split("-")[4], id.split("-")[5]] : ["", "", "", ""];
    const k = Number(ks), m = ty === "call" ? (spot - k) / spot : (k - spot) / spot;          // moneyness
    const dlt = Math.max(0.05, Math.min(0.95, 0.5 + m * 12)), ask = Math.max(0.05, premAtm * Math.exp(m * 18) * (e === "2026-10-09" ? 0.7 : e === "2026-10-23" ? 1.3 : 1));
    return { instrument_id: id, ask_price: ask.toFixed(2), bid_price: (ask * 0.98).toFixed(2), mark_price: (ask * 0.99).toFixed(2), delta: (ty === "put" ? -dlt : dlt).toFixed(3), volume: 900, open_interest: 600 };
  };
  return (tool: string, args: any) => {
    if (tool === "get_equity_quotes") return { data: { results: [{ quote: { last_trade_price: String(spot) } }] } };
    if (tool === "get_option_chains") return { data: { chains: [{ symbol: sym, can_open_position: true, expiration_dates: exps }] } };
    if (tool === "get_portfolio") return { data: { total_value: "1121.64", buying_power: { buying_power: String(bp) } } };
    if (tool === "get_option_instruments") return { data: { instruments: ins.filter((i) => i.expiration_date === args.expiration_dates && i.type === args.type) } };
    if (tool === "get_option_quotes") return { data: { results: (args.instrument_ids || [args.instrument_id]).filter(Boolean).map((id: string) => ({ quote: q(id) })) } };
    return null;
  };
}
const optCard = (sym: string, id: string, price: number, dir: "up" | "down", stopOpt: number, tp1: number, stop: number) => ({
  title: `Buy 1 ${sym}`, summary: "t",
  calls: [{ service: "rh", tool: "place_option_order", args: { legs: [{ option_id: id, side: "buy", position_effect: "open" }], type: "limit", price, quantity: "1", time_in_force: "gfd" } }],
  plan: { tv_symbol: `NASDAQ:${sym}`, direction: dir, setup: "breakdown", tp1, stop, stop_option: stopOpt, entry_underlying: stop },
});
let v320clock = 0;
const v320reset = () => { reset(); v320clock += 10; setNow(new RealDate(RealDate.parse("2026-10-06T16:00:00Z") + v320clock * 60e3).toISOString()); };

Deno.test("v3.20: stop prices round UP to Robinhood's step — the 7 Oct $3.38 becomes $3.40 and the loss at the stop shrinks", () => {
  assert(M.roundStopUp(3.38) === 3.4, "3.38 → " + M.roundStopUp(3.38));
  assert(M.roundStopUp(2.61) === 2.61 && M.roundStopUp(2.605) === 2.61, "pennies under $3");
  assert(M.roundStopUp(4.7) === 4.7 && M.roundStopUp(16.83) === 16.85, "nickels from $3");
  assert(M.roundStopUp(3.43, true) === 3.5 && M.roundStopUp(1.83, true) === 1.85, "coarse steps for non-penny names");
  for (let i = 0; i < 20000; i++) {                 // property check: on the step, never below the input, less than one step above it
    const p = Math.round((0.05 + Math.random() * 60) * 1000) / 1000, coarse = Math.random() < 0.5;
    const r = M.roundStopUp(p, coarse), t = M.optTick(r, coarse);
    assert(r >= p - 1e-9, `${p} → ${r} went DOWN (bigger loss)`);
    assert(Math.abs(Math.round(r / t) * t - r) < 1e-6, `${p} → ${r} not on the $${t} step`);
    assert(r - p < M.optTick(p, coarse) + M.optTick(r, coarse) + 1e-9, `${p} → ${r} moved more than a step`);
  }
});

Deno.test("v3.20: the NVDA 237.5P card from 7 Oct gets a $3.40 stop on the card itself (not $3.38)", async () => {
  v320reset();
  T.otto_settings[0].value.max_loss_on = false;     // v3.26 sizes the stop to the max loss — this test is only the price-step rounding
  callHook = fakeChain("NVDA", 236.73, 2.5, 4.53, 1151.73);
  const c: any = await M.proposeAction(optCard("NVDA", "NVDA-2026-10-16-put-237.5", 4.55, "down", 3.38, 235, 237), "watcher");
  assert(c.exit.stop_option === 3.4, "stop on the card: " + c.exit.stop_option);
  assert(!c.checks.some((x: any) => /buying power/i.test(x.text)), "fits buying power — no BP flag");
});

Deno.test("v3.20: Robinhood refuses a nickel stop (non-penny name) → Otto retries once on the dime step, toward the entry", async () => {
  v320reset();
  const tries: string[] = [];
  callHook = (tool: string, args: any) => {
    if (tool === "place_option_order" && args.type === "stop_market") {
      tries.push(args.stop_price);
      if (Number(args.stop_price) * 100 % 10 !== 0) throw new Error('API error 400: {"detail":"Stop price does not satisfy the min tick value."}');
    }
    return null;
  };
  const a = { id: "a1", title: "Buy 1 X", decided_at: new Date().toISOString() };
  const ex: any = { option_id: OPT, qty: 1, entry_limit: 4.55, stop_option: 3.45, log: [] };
  const ok = await (M as any).placeStopForTest(a, ex, ACCT);
  assert(ok === true, "stop placed after retry; log: " + JSON.stringify(ex.log));
  assert(tries.join(",") === "3.45,3.50", "tries " + tries.join(","));
  assert(ex.stop_option === 3.5 && ex.stop_option < ex.entry_limit, "stop moved up to 3.50");
});

Deno.test("v3.20: a card over buying power goes back to Jarvis when a contract that fits exists (QQQ 756C, 7 Oct)", async () => {
  v320reset();
  callHook = fakeChain("QQQ", 756.11, 1, 8.29, 706.69);
  let err = "";
  try { await M.proposeAction(optCard("QQQ", "QQQ-2026-10-16-call-756", 8.29, "up", 7.9, 759, 755.5), "watcher"); } catch (e) { err = (e as Error).message; }
  assert(/Over buying power: this contract costs \$829/.test(err) && /◆ QQQ \d+C/.test(err) && /option_id QQQ-/.test(err), "bounced with the fitting contract named: " + err);
  assert(!T.otto_actions.length, "no card stored");
});

Deno.test("v3.20: nothing fits → the card is still built, with a red 'over buying power' banner (Ifoma's rule)", async () => {
  v320reset();
  callHook = fakeChain("MU", 1080.7, 5, 17.9, 120);     // even the cheapest MU contract is over $120
  const c: any = await M.proposeAction(optCard("MU", "MU-2026-10-09-call-1080", 17.9, "up", 16.8, 1090, 1079.5), "signals");
  assert(c.status === "pending", "card built");
  const bp = c.checks.find((x: any) => /Over buying power/.test(x.text));   // v3.24: a stale-entry line may come first
  assert(bp && bp.ok === false && /Over buying power: costs \$1790/.test(bp.text) && /No contract on the list fits/.test(bp.text), JSON.stringify(c.checks));
});

Deno.test("v3.20: Ifoma's own ticket over buying power is never bounced — only flagged", async () => {
  v320reset();
  callHook = fakeChain("MU", 1076.8, 5, 30.2, 1121.64);
  const c: any = await M.proposeAction(optCard("MU", "MU-2026-10-16-put-1075", 30.2, "down", 26, 1074, 1082), "ottotrader@vinecreativestudio.com", { manual: true });
  assert(c.status === "pending" && /Over buying power/.test(c.checks[0].text), "flagged, not bounced");
});

Deno.test("v3.20: Watcher trigger → contracts pre-fetched into the prompt; Jarvis's oversized card bounces and the ◆ card is built", async () => {
  v320reset();
  const fit = fakeChain("MU", 1076.84, 5, 15, 1121.64);
  const seen: string[] = [];
  callHook = (tool: string, args: any) => { seen.push(tool); return fit(tool, args); };
  T.otto_watch.push({ id: 77, day: "2026-10-06", ticker: "MU", level: 1080, dir: "down", source: "signal", status: "watching",
    fired: { down: { trigger: "break-close", tf: 5, close_at: new Date().toISOString(), bar: { o: 1081.08, h: 1081.2, l: 1076.61, c: 1076.84 } } } });
  let firstPrompt = "", round = 0, picked = "";
  claudeScript = (body: any) => {
    round++;
    if (round === 1) { firstPrompt = JSON.stringify(body.messages[0]);
      const m = /◆ = best that fits buying power: MU (\d+(?:\.\d+)?)P (\d\d)\/(\d\d)/.exec(firstPrompt); picked = m ? `MU-2026-${m[2]}-${m[3]}-put-${m[1]}` : "";
      return toolReply("propose_action", optCard("MU", "MU-2026-10-16-put-1075", 30.2, "down", 26, 1074, 1082)); }   // the 7 Oct oversized pick
    const last = JSON.stringify(body.messages[body.messages.length - 1]);
    if (round === 2) { const m = /option_id (MU-[^ ,]+), ask \$([\d.]+)/.exec(last); assert(m, "bounce names a contract: " + last.slice(0, 400));
      const ask = Number(m![2]); return toolReply("propose_action", optCard("MU", m![1], ask, "down", +(ask * 0.85).toFixed(2), 1074, 1082)); }
    return textReply("READ: MU rejected 1080. Card is the ◆ contract that fits.");
  };
  await M.watchJarvis(77, "down");
  assert(/◆ = best that fits buying power: MU/.test(firstPrompt), "shortlist pre-fetched into the Watcher prompt: " + firstPrompt.slice(-700) + " ROUND " + round + " DESK " + deskText().slice(-400));
  assert(T.otto_actions.length === 1, "one card: " + T.otto_actions.length);
  const leg = T.otto_actions[0].calls[0].args.legs[0].option_id;
  assert(leg === picked, `card uses the ◆ contract ${picked}, got ${leg}`);
  assert(T.otto_actions[0].risk.cost <= 1121.64, "card fits buying power: " + T.otto_actions[0].risk.cost);
});

Deno.test("v3.20: Desk — Jarvis has option_shortlist and every run carries the contract rule", async () => {
  v320reset();
  callHook = fakeChain("NVDA", 236.73, 2.5, 4.53, 1151.73);
  let toolNames: string[] = [], sysCtx = "", round = 0, toolResult = "";
  claudeScript = (body: any) => {
    round++;
    if (round === 1) { toolNames = (body.tools || []).map((t: any) => t.name); sysCtx = JSON.stringify(body.messages[0]); return toolReply("option_shortlist", { ticker: "NVDA", side: "put" }); }
    toolResult = JSON.stringify(body.messages[body.messages.length - 1]); return textReply("ok");
  };
  const { ctxLine, tools, cs, sys } = await (M as any).deskSetupForTest();
  await M.runDesk({ msgs: [{ role: "user", content: ctxLine + "\nJOSH: nvda puts?" }], sys, tools, cs, who: "josh", send: () => {}, allowPropose: true });
  assert(toolNames.includes("option_shortlist"), "tool offered: " + toolNames.join(","));
  assert(/CONTRACTS \(v3\.20\)/.test(sysCtx), "rule in the context line");
  assert(/★ = best by the Otto Rules/.test(toolResult) && /NVDA 2\d\d(\.5)?P/.test(toolResult), "shortlist came back: " + toolResult.slice(0, 300));
});

/* ======================= v3.21 — exits only by the card's own rules; one card per ticker + direction ======================= */
// 7 Oct numbers replayed on the test clock (times below are UTC; ET = UTC − 4).
const barsHook = (sym: string, rows: [string, number, number, number, number][]) => (tool: string, args: any) =>
  tool === "get_equity_historicals" && (args.symbols || []).includes(sym) ? { data: { results: [toRh(sym, rows)] } } : null;
const armed = (sym: string, dir: "up" | "down", wrong: number, tp1: number, armedAt: string, tf = 5) => ({
  id: "ar-" + (++ID), title: `Buy 1 ${sym} test`, status: "done", created_at: armedAt, decided_at: armedAt,
  exit: { option_id: OPT, qty: 1, entry_limit: 4.55, stop_option: 3.4, tv_symbol: `NASDAQ:${sym}`, direction: dir, wrong_if: wrong, tp1, wrong_tf: tf, state: "armed", armed_at: armedAt, alerts: {}, log: [] } });

Deno.test("v3.21: NVDA (7 Oct) — the 11:35 bar closed 237.32 over the 237 wrong-if: the rule is met at 11:40, not before", async () => {
  reset();
  callHook = barsHook("NVDX", [["15:30", 237.14, 237.16, 236.64, 236.76], ["15:35", 236.76, 237.4, 236.7, 237.32], ["15:40", 237.3, 237.45, 237.2, 237.4]]);
  const a = armed("NVDX", "down", 237, 235, "2026-10-06T15:32:30Z");
  const early: any = await M.exitRuleCheck(a, RealDate.parse("2026-10-06T15:38:00Z"));
  assert(!early.met && /last 5-min close 236\.76/.test(early.detail), "11:38 — not met yet: " + JSON.stringify(early));
  const at: any = await M.exitRuleCheck(a, RealDate.parse("2026-10-06T15:41:00Z"));
  assert(at.met && /closed a 5-minute bar at 237\.32/.test(at.why), "11:41 — met: " + JSON.stringify(at));
});

Deno.test("v3.21: QQQ (7 Oct) — Jarvis's 10:34 close 2 minutes after the fill is REFUSED (no card rule met)", async () => {
  reset(); setNow("2026-10-06T14:34:10Z");
  callHook = barsHook("QQQ", [["14:25", 754.1, 754.8, 754.0, 754.74], ["14:30", 754.74, 755.09, 753.96, 754.38]]);
  T.otto_actions.push(armed("QQQ", "down", 755, 752, "2026-10-06T14:32:40Z"));
  let err = "";
  try { await (M as any).closeNowForTest({ option_id: OPT, reason: "QQQ bounced off 751.76 and the tape stopped working" }, "auto-review"); } catch (e) { err = (e as Error).message; }
  assert(/Not closed — none of the card's exits is met/.test(err) && /wrong-if 755 on a 5-minute close not hit/.test(err), "refused: " + err);
  assert(!orders.some((o) => o.type === "market"), "no sell sent");
});

Deno.test("v3.21: old cards keep their 15-minute wrong-if — a 5-min close through that recovers by the 15-min close is not an exit", async () => {
  reset();
  callHook = barsHook("OLDX", [["15:30", 100.2, 100.3, 99.7, 99.8], ["15:35", 99.8, 100.4, 99.8, 100.3], ["15:40", 100.3, 100.5, 100.2, 100.4], ["15:45", 100.4, 100.4, 99.6, 99.7]]);
  const a = armed("OLDX", "up", 100, 102, "2026-10-06T15:29:00Z", 15);
  const mid: any = await M.exitRuleCheck(a, RealDate.parse("2026-10-06T15:46:00Z"));
  assert(!mid.met && /15-minute close not hit \(last 15-min close 100\.4\)/.test(mid.detail), "15-min bucket closed 100.4: " + JSON.stringify(mid));
  const five: any = await M.exitRuleCheck({ ...a, exit: { ...a.exit, wrong_tf: 5 } }, RealDate.parse("2026-10-06T15:36:00Z"));
  assert(five.met && /99\.8/.test(five.why), "same bars on a 5-min card: met at the first close through: " + JSON.stringify(five));
});

Deno.test("v3.21: TP1 touched and 3:50 PM are rules too", async () => {
  reset();
  callHook = barsHook("TPX", [["15:30", 50, 50.2, 49.1, 49.3]]);
  const tp: any = await M.exitRuleCheck(armed("TPX", "down", 51, 49.2, "2026-10-06T15:29:00Z"), RealDate.parse("2026-10-06T15:36:00Z"));
  assert(tp.met && /TP1 49\.2 reached/.test(tp.why), JSON.stringify(tp));
  const late: any = await M.exitRuleCheck(armed("TPX", "down", 51, 40, "2026-10-06T15:29:00Z"), RealDate.parse("2026-10-06T19:51:00Z"));
  assert(late.met && /3:50 PM/.test(late.why), JSON.stringify(late));
  const noPlan: any = await M.exitRuleCheck({ exit: {} });
  assert(!noPlan.met && /no card plan/.test(noPlan.detail), "no plan → never auto-closed");
});

Deno.test("v3.21: the server sweep closes an armed trade when its rule is met — and leaves it when not", async () => {
  reset(); setNow("2026-10-06T15:41:00Z");
  callHook = barsHook("NVDY", [["15:30", 237.14, 237.16, 236.64, 236.76], ["15:35", 236.76, 237.4, 236.7, 237.32]]);
  T.otto_actions.push(armed("NVDY", "down", 237, 235, "2026-10-06T15:32:30Z"));
  const r: any[] = await M.ruleSweep();
  assert(r.length === 1 && r[0].closed && /wrong-if 237/.test(r[0].why), "closed by rule: " + JSON.stringify(r));
  assert(orders.some((o) => o.type === "market" && o.legs[0].side === "sell"), "market sell sent");
  assert(/Otto closed \(card rule\)/.test(deskText()), "Desk says the card rule closed it: " + deskText().slice(-300));
  reset(); setNow("2026-10-06T15:38:00Z");
  callHook = barsHook("NVDZ", [["15:30", 237.14, 237.16, 236.64, 236.76]]);
  T.otto_actions.push(armed("NVDZ", "down", 237, 235, "2026-10-06T15:32:30Z"));
  const r2: any[] = await M.ruleSweep();
  assert(r2.length === 0 && !orders.some((o) => o.type === "market"), "nothing closed: " + JSON.stringify(r2));
});

Deno.test("v3.21: the scheduled position check can't close anything itself any more", async () => {
  const src = await Deno.readTextFile(new URL("../otto-proxy.ts", import.meta.url));
  const pr = src.slice(src.indexOf("async function positionReview"), src.indexOf("async function positionReview") + 4000);
  assert(/tools: \[TOOLS\[0\], \.\.\.mcpToolDefs\]/.test(pr) && /allowClose: false/.test(pr), "no close tool in the position check");
  assert(/await ruleSweep\(\)/.test(pr), "server rule sweep runs first");
});

Deno.test("v3.21: a 2nd card on the same ticker + direction is refused (7 Oct 10:32, two QQQ puts); other side or after a reject is fine", async () => {
  reset(); setNow("2026-10-06T14:32:00Z");
  const c1: any = await M.proposeAction(spyCard(), "watcher");
  let err = "";
  try { await M.proposeAction(spyCard(), "ottotrader@vinecreativestudio.com"); } catch (e) { err = (e as Error).message; }
  assert(/A SPY calls card is already up: "LIVE — Buy 1 SPY 781C/.test(err) && /pending/.test(err), "refused: " + err);
  const puts = spyCard(); puts.plan = { ...puts.plan, direction: "down", tp1: 776, stop: 780 };
  const cp: any = await M.proposeAction(puts, "watcher");
  assert(cp.status === "pending", "puts on SPY still allowed");
  T.otto_actions.find((r: any) => r.id === c1.id).status = "rejected";
  const c3: any = await M.proposeAction(spyCard(), "watcher");
  assert(c3.status === "pending", "after a reject a new calls card is fine");
  T.otto_actions.find((r: any) => r.id === c3.id).status = "done"; T.otto_actions.find((r: any) => r.id === c3.id).exit.state = "armed";
  let err2 = ""; try { await M.proposeAction(spyCard(), "signals"); } catch (e) { err2 = (e as Error).message; }
  assert(/filled, trade open/.test(err2), "filled trade blocks a 2nd entry: " + err2);
  setNow("2026-10-06T14:48:00Z");
  const c4: any = await M.proposeAction(spyCard(), "signals");
  assert(c4.status === "pending", "after 15 minutes it's allowed again");
  const m: any = await M.proposeAction(spyCard(), "ottotrader@vinecreativestudio.com", { manual: true });
  assert(m.status === "pending", "Ifoma's own ticket is never refused");
});

Deno.test("v3.21: new cards carry a 5-minute wrong-if; scoring follows each card's own bar", async () => {
  reset(); setNow("2026-10-06T14:35:40Z");
  const c: any = await M.proposeAction(spyCard(), "watcher");
  assert(c.plan.wrong_tf === 5 && c.exit.wrong_tf === 5, "5 on the card: " + JSON.stringify([c.plan.wrong_tf, c.exit.wrong_tf]));
  const at = (hms: string) => RealDate.parse("2026-10-06T" + hms + "Z");
  const bars = [{ t: at("14:35:00"), o: 100.1, h: 100.2, l: 99.6, c: 99.7 }, { t: at("14:40:00"), o: 99.7, h: 100.6, l: 99.7, c: 100.5 }, { t: at("14:45:00"), o: 100.5, h: 101.2, l: 100.4, c: 101.1 }];
  const g5: any = M.gradeIdea({ created: at("14:33:00"), direction: "up", tp1: 101, wrong: 100, tf: 5 }, bars, at("15:00:00"));
  const g15: any = M.gradeIdea({ created: at("14:33:00"), direction: "up", tp1: 101, wrong: 100 }, bars, at("15:00:00"));
  assert(g5.state === "loss" && g15.state === "win", `5-min card loses at the first close through, 15-min card wins: ${g5.state} / ${g15.state}`);
  const src = await Deno.readTextFile(new URL("../otto-proxy.ts", import.meta.url));
  assert(/const res = kind === "wrong" \? String\(ex\.wrong_tf \|\| 15\) : "1";/.test(src), "TradingView alert uses the card's bar");
});

/* ======================= v3.22 — Jarvis never states made-up facts (replays of the 7 Oct misses) ======================= */
const pxHook = (px: Record<string, number>, extra?: (tool: string, args: any) => any) => (tool: string, args: any) => {
  if (extra) { const r = extra(tool, args); if (r) return r; }
  if (tool === "get_equity_quotes") return { data: { results: (args.symbols || []).map((s: string) => px[s] ? { quote: { symbol: s, last_trade_price: String(px[s]) } } : { quote: { symbol: s } }) } };
  if (tool === "mcp-watchlist-list-watchlists") return { watchlists: [
    { name: "💰Treasure Hunt", symbols: ["NASDAQ:NVDA", "NASDAQ:AAPL", "NASDAQ:MU", "AMEX:SPY", "NASDAQ:QQQ"] },
    { name: "Watchlist", symbols: ["###Indices", "SP:SPX", "NASDAQ:TSLA"] }, { name: "FUTURES", symbols: ["CME_MINI:MES1!"] }] };
  return null;
};
let v322clock = 0;
const v322reset = (day = "2026-10-07") => { reset(); v322clock += 7; setNow(new RealDate(RealDate.parse(day + "T15:00:00Z") + v322clock * 60e3).toISOString()); };

Deno.test("v3.22: AAPL card with 233/237 levels while AAPL is ~335 → sent back once, then NO card and the Desk says why", async () => {
  v322reset();
  callHook = pxHook({ AAPZ: 335.2 }, fakeChain("AAPZ", 335.2, 2.5, 4.1, 1151));
  let e1 = "", e2 = "";
  try { await M.proposeAction(optCard("AAPZ", "AAPZ-2026-10-16-put-335", 4.1, "down", 3.2, 233, 237), "watcher"); } catch (e) { e1 = (e as Error).message; }
  assert(/Levels don't match the live price: AAPZ is \$335\.20/.test(e1) && /TP1 233 is 30% away/.test(e1) && /one more try/.test(e1), "first try bounced: " + e1);
  try { await M.proposeAction(optCard("AAPZ", "AAPZ-2026-10-16-put-335", 4.1, "down", 3.2, 233, 237), "watcher"); } catch (e) { e2 = (e as Error).message; }
  assert(/^NO CARD — second try still off/.test(e2), "second try: " + e2);
  assert(!T.otto_actions.length, "no card stored");
  assert(/No card for AAPZ puts: the levels didn't match the live price/.test(deskText()), deskText());
  // the fixed card goes through
  const c: any = await M.proposeAction(optCard("AAPZ", "AAPZ-2026-10-16-put-335", 4.1, "down", 3.2, 331, 337), "watcher");
  assert(c.status === "pending", "real levels → card");
});

Deno.test("v3.22: a level within 10% passes; price unknown (no quote) never blocks a card", async () => {
  v322reset();
  callHook = pxHook({}, fakeChain("NVQX", 236.73, 2.5, 4.53, 1151.73));
  const c: any = await M.proposeAction(optCard("NVQX", "NVQX-2026-10-16-put-237.5", 4.55, "down", 3.38, 225, 245), "watcher");
  assert(c.status === "pending", "card built with 5% levels");
});

Deno.test("v3.22: the Watcher refuses AAPL 233 when AAPL is 335, takes 336", async () => {
  v322reset();
  callHook = pxHook({ AAPW: 335 });
  let e = ""; try { await M.watchAdd({ ticker: "AAPW", level: 233, dir: "down", source: "desk" }); } catch (x) { e = (x as Error).message; }
  assert(/AAPW 233 is 30% from the live price \$335\.00 — not added/.test(e), e);
  const r: any = await M.watchAdd({ ticker: "AAPW", level: 336, dir: "up", source: "desk" });
  assert(r && r.level === 336, "336 added");
});

Deno.test("v3.22: 'HEADING TO 1074' read as ABBV → matched by price to MU (Treasure Hunt), one clear match", async () => {
  v322reset("2026-10-05");
  callHook = pxHook({ ABBV: 231.4, MU: 1068.2, NVDA: 236.7, AAPL: 335.1, SPY: 668, QQQ: 600, TSLA: 440 });
  const { posts, asks } = await M.verifyTickers([{ kind: "call", ticker: "ABBV", direction: "long", entry: 0, level: 1074, words: "HEADING TO 1074", summary: "x" }]);
  assert(posts[0].ticker === "MU" && posts[0].ticker_was === "ABBV", JSON.stringify(posts[0]));
  assert(/matched by price: 1074 ≈ MU \$1068\.20; ABBV is \$231\.40/.test(posts[0].summary), posts[0].summary);
  assert(!asks.length, "no question needed");
});

Deno.test("v3.22: no ticker and nothing near the price → ticker cleared, no card, the Desk asks which stock", async () => {
  v322reset("2026-10-04");
  callHook = pxHook({ MU: 1068.2, NVDA: 236.7, AAPL: 335.1, SPY: 668, QQQ: 600, TSLA: 440 });
  const r1 = await M.verifyTickers([{ kind: "call", ticker: "", direction: "", entry: 0, level: 1600, words: "1600 NEXT", summary: "" }]);
  assert(r1.posts[0].ticker === "" && /which stock\? 1600 came with no ticker, and nothing on your watchlists/.test(r1.asks[0]), JSON.stringify(r1));
  // two stocks near the price → ask, list both
  const r2 = await M.verifyTickers([{ kind: "level", ticker: "", direction: "", entry: 0, level: 605, words: "605 HOLDS", summary: "" }]);
  assert(r2.posts[0].ticker === "" && /fits more than one: SPY \$668\.00, QQQ \$600\.00|fits more than one: QQQ \$600\.00, SPY \$668\.00/.test(r2.asks[0]), JSON.stringify(r2.asks));
  // a ticker that fits is never touched; an unpriceable one (futures) is left alone
  const r3 = await M.verifyTickers([{ kind: "call", ticker: "NVDA", entry: 237, level: 0, words: "NVDA 237", summary: "" }, { kind: "call", ticker: "MES", entry: 0, level: 6700, words: "MES 6700", summary: "" }]);
  assert(r3.posts[0].ticker === "NVDA" && r3.posts[1].ticker === "MES" && !r3.asks.length, JSON.stringify(r3));
});

Deno.test("v3.22: a Signal batch with a mismatched ticker never becomes an ABBV card (live path)", async () => {
  v322reset("2026-10-03");
  callHook = pxHook({ ABBV: 231.4, MU: 1068.2, NVDA: 236.7 });
  extractHook = () => [{ time: "10:05 AM", kind: "call", ticker: "ABBV", direction: "long", late: false, entry: 0, level: 1074, option: "", words: "HEADING TO 1074", pinged: true, chart: "", summary: "ABBV long" }];
  await M.signalProcess(1, [{ posted_at: new Date().toISOString(), text: "HEADING TO 1074", imgs: 0 }], [], { mentor: "Coach", channel_name: "#x" }).catch(() => {});
  const j = (T.otto_jason || [])[0];
  assert(j && j.ticker === "MU", "saved as MU: " + JSON.stringify(j));
});

Deno.test("v3.22: the made-up 'Oct 3 call' is removed; real call dates and option contracts are left alone", () => {
  const dates = ["2026-09-24", "2026-10-01"];
  const a = M.checkCitations("The coach said on the Oct 3 call to wait for the 5-minute close.", dates, "2026-10-07");
  assert(a.removed.length === 1 && /said on a call \(source not found\) to wait/.test(a.text), JSON.stringify(a));
  const b = M.checkCitations("Otto Rules: no trades in the first 30 minutes (Otto Rules, Oct 3, 14:22).", dates, "2026-10-07");
  assert(b.text.endsWith("minutes (source not found).") && b.removed.length === 1, b.text);
  const c = M.checkCitations("The coach covered this on the Oct 1 call (Otto Rules, Oct 1, 12:10) and the 9/24 call.", dates, "2026-10-07");
  assert(!c.removed.length && c.text.includes("Oct 1 call") && c.text.includes("9/24 call"), JSON.stringify(c));
  const d = M.checkCitations("Buy the Oct 9 call at $3.50 — the 10/16 call is too pricey. The Oct 3 call option expired.", dates, "2026-10-07");
  assert(!d.removed.length, "option talk untouched: " + JSON.stringify(d));
  const e = M.checkCitations("Otto Rules say it (coaching call, 2026-08-30).", dates, "2026-10-07");
  assert(e.removed.length === 1 && e.text.includes("(source not found)"), JSON.stringify(e));
});

Deno.test("v3.22: 'no prep today' when Josh's morning read exists → corrected before it's saved on the Desk", async () => {
  v322reset("2026-10-02");
  callHook = pxHook({});
  T.otto_prep = [{ id: 1, day: "2026-10-02", author: "Josh", created_at: "2026-10-02T12:41:00Z", status: "graded" }];
  T.otto_jason = [];
  await (M as any).checkAdd;   // (module loaded)
  const fc = await M.factCheck("Quick note: there's no prep from anyone this morning, so I'm working off the banner.");
  assert(/\[Corrected by Otto: there IS a morning read today \(Josh, 8:41 AM\)\.\]/.test(fc.text) && !/no prep from anyone/.test(fc.text), fc.text);
  assert(/⚠ Correction \(Otto checked\)/.test(fc.notes[0]), JSON.stringify(fc.notes));
  // a true "none" stays
  T.otto_prep = [];
  const ok = M.checkNoneClaims("No signals from the coach yet today.", { prep: [], sig: [], ord: [] });
  assert(ok.text === "No signals from the coach yet today." && !ok.notes.length, JSON.stringify(ok));
  // 'no signal card' is not a 'no signals' claim
  const sc = M.checkNoneClaims("No signal card for TSLA today — it was a watch list.", { prep: [], sig: [{ ticker: "TSLA", kind: "level" }], ord: [] });
  assert(!sc.notes.length, JSON.stringify(sc));
  // false 'no fills today'
  const fl = M.checkNoneClaims("We have no fills today.", { prep: [], sig: [], ord: [{ state: "filled" }] });
  assert(/there ARE fills today \(1 filled order/.test(fl.text), fl.text);
});

Deno.test("v3.22: today's facts are in Jarvis's context (look first)", () => {
  const l = M.factsLine({ prep: [{ author: "Josh", created_at: "2026-10-07T12:41:00Z" }], sig: [{ kind: "call" }, { kind: "note" }], ord: [{ state: "filled" }, { state: "rejected" }] });
  assert(/morning reads: Josh 8:41 AM; Agentic option orders: 2 \(1 filled, 1 cancelled\/rejected\); coach signal posts: 2 \(1 calls\)/.test(l), l);
  assert(/unknown/.test(M.factsLine({ prep: null, sig: null, ord: null })), "unknown when it can't check");
});

Deno.test("v3.22: the 7 Oct recap from Robinhood's records — unfilled 240P is not a win, 237.5P is −$15, ABBV shows Robinhood's reason", () => {
  const orders = [
    { id: "o1", state: "cancelled", created_at: "2026-10-07T14:12:00Z", chain_symbol: "NVDA", legs: [{ option_id: "p240", side: "buy", position_effect: "open", strike_price: "240.0000", option_type: "put", expiration_date: "2026-10-09", executions: [] }] },
    { id: "o2", state: "filled", created_at: "2026-10-07T15:20:00Z", chain_symbol: "NVDA", legs: [{ option_id: "p2375", side: "buy", position_effect: "open", strike_price: "237.5000", option_type: "put", expiration_date: "2026-10-16", executions: [{ price: "4.55", quantity: "1" }] }] },
    { id: "o3", state: "filled", created_at: "2026-10-07T15:58:00Z", chain_symbol: "NVDA", legs: [{ option_id: "p2375", side: "sell", position_effect: "close", executions: [{ price: "4.40", quantity: "1" }] }] },
    { id: "o4", state: "rejected", created_at: "2026-10-07T16:30:00Z", chain_symbol: "ABBV", reject_reason: "Invalid field: chain_symbol", legs: [{ option_id: "abbv", side: "buy", position_effect: "open", strike_price: "230", option_type: "call", expiration_date: "2026-10-16" }] },
  ];
  const acts = [{ title: "Buy NVDA 240P", status: "expired" }, { title: "Buy NVDA 237.5P", status: "done" }, { title: "Buy ABBV 230C", status: "failed", result: [{ ok: false, text: "Rejected by Robinhood: Invalid field: chain_symbol" }] }, { title: "QQQ", status: "rejected" }];
  const b = M.recapTradesBlock(orders, acts);
  assert(/NVDA 240P 10\/09: cancelled — never filled/.test(b), b);
  assert(/NVDA 237\.5P 10\/16: bought 1 @ \$4\.55 → sold @ \$4\.40 = −\$15/.test(b), b);
  assert(/ABBV 230C 10\/16: REJECTED by Robinhood — never filled \(Robinhood: Invalid field: chain_symbol\)/.test(b), b);
  assert(/Realized on closed trades today: −\$15/.test(b) && !/win/i.test(b), b);
  assert(/Cards: 4 made · 2 approved LIVE · 0 practice trades taken \(no real money\) · 1 rejected · 1 expired · 1 failed \(Buy ABBV 230C: Invalid field: chain_symbol\)/.test(b), b);   // v3.44: live vs practice split
  const j = "### Today in one line\nRough day.\n\n### Trades and cards\n- NVDA 240P: WIN +1R\n\n### What was discussed\nstuff";
  const s = M.spliceRecap(j, b);
  assert(!/WIN \+1R/.test(s) && s.indexOf("Rough day") < s.indexOf("From Robinhood's own") && s.indexOf("From Robinhood's own") < s.indexOf("What was discussed"), s);
});

Deno.test("v3.22: a chain_symbol field on the order is removed before the card; Robinhood's rejection shows its exact reason", async () => {
  v322reset("2026-10-01");
  (globalThis as any).__OTTO_TEST__.tools = async () => [{ name: "place_option_order", inputSchema: { type: "object", properties: {
    account_number: {}, legs: { type: "array", items: { type: "object", properties: { option_id: {}, side: {}, position_effect: {}, ratio_quantity: {} } } },
    type: {}, price: {}, quantity: {}, time_in_force: {}, direction: {}, ref_id: {} } } }];
  callHook = fakeChain("ABBX", 231, 2.5, 3.1, 1151);
  const card = optCard("ABBX", "ABBX-2026-10-16-call-230", 3.1, "up", 2.4, 236, 229);
  (card.calls[0].args as any).chain_symbol = "ABBX"; (card.calls[0].args.legs[0] as any).chain_symbol = "ABBX";
  const c: any = await M.proposeAction(card, "watcher");
  const args = T.otto_actions[0].calls[0].args;
  assert(!("chain_symbol" in args) && !("chain_symbol" in args.legs[0]) && args.ref_id && args.account_number, JSON.stringify(args));
  assert(c.risk.notes.some((n: string) => /removed fields Robinhood doesn't take: (chain_symbol, legs\.chain_symbol|legs\.chain_symbol, chain_symbol)/.test(n)), JSON.stringify(c.risk.notes));
  delete (globalThis as any).__OTTO_TEST__.tools;
  // the approve fails at Robinhood → exact reason on the card and the Desk
  callHook = (tool: string) => { if (tool === "place_option_order") throw new Error('API error 400: {"detail":"Order price is outside the allowed collar."}'); return null; };
  const uid = "0b0b0b0b-1111-2222-3333-444455556666";
  T.otto_actions[0].id = uid; T.otto_actions[0].created_at = new Date().toISOString();
  const r: any = await (M as any).actOnForTest(uid, "approve", "ifoma@x");
  assert(r.status === "failed" && /^Rejected by Robinhood: Order price is outside the allowed collar\./.test(T.otto_actions[0].result[0].text), JSON.stringify(T.otto_actions[0].result));
  assert(/✗ LIVE — Buy 1 ABBX — Rejected by Robinhood: Order price is outside the allowed collar\. \(approved by ifoma@x\)/.test(deskText()), deskText());
});

Deno.test("v3.22: an entry Robinhood rejects after Approve → the Desk and the card show Robinhood's reason", async () => {
  v322reset("2026-09-30");
  orders.push({ id: "e-rej", state: "rejected", reject_reason: "Insufficient buying power.", legs: [{ option_id: OPT, side: "buy", position_effect: "open", executions: [] }] });
  T.otto_actions = [{ id: "card-rej", title: "Buy 1 SPY 781C", status: "done", created_at: new Date().toISOString(), decided_at: new Date().toISOString(),
    exit: { state: "waiting_fill", order_id: "e-rej", option_id: OPT, qty: 1, entry_limit: 3.5, stop_option: 2, tv_symbol: "AMEX:SPY", direction: "up", wrong_if: 778, tp1: 784, log: [] } }];
  await M.exitTick(T.otto_actions[0]);
  assert(T.otto_actions[0].exit.state === "dead" && T.otto_actions[0].exit.dead_reason === "Rejected by Robinhood: Insufficient buying power.", JSON.stringify(T.otto_actions[0].exit));
  assert(/the entry was Rejected by Robinhood: Insufficient buying power\., so no stop or alerts were set/.test(deskText()), deskText());   // v3.24 wording
});

Deno.test("v3.22: the exact 7 Oct lines — '(Oct 3 call, 29:20)' removed, \"I don't have a prep section\" corrected, 'No card: the coach's own morning read' left alone", () => {
  const a = M.checkCitations("- **Never swing into a binary event** (Oct 3 call, 29:20) — hard out at 1:45 covers it.", ["2026-10-01"], "2026-10-07");
  assert(a.removed[0] === "(Oct 3 call, 29:20)" && a.text.includes("(source not found)"), JSON.stringify(a));
  const f = { prep: [{ author: "Josh", created_at: "2026-10-07T12:41:00Z" }], sig: [], ord: [] };
  const b = M.checkNoneClaims("No, I don't have a prep section or a pre-market plan from you for today.", f);
  assert(b.notes.length === 1 && /Corrected by Otto: there IS a morning read today/.test(b.text), JSON.stringify(b));
  const c = M.checkNoneClaims("No card: the coach's own morning read was long-biased on NVDA making new highs.", f);
  assert(!c.notes.length, JSON.stringify(c));
});

/* ======================= v3.23 — Signal cards in one step (target: post → card under 30 s) ======================= */
const muCard = (body: any, extra: any = {}) => toolReply("propose_action", { title: "Buy 1 MU 1020P 10/7 @ 10.00", summary: "test", read: "MU short: he shorted the break. Wrong on a 5-min close back over 1060.",
  plan: { tv_symbol: "NASDAQ:MU", direction: "down", setup: "otto signal", jason_id: 801, tp1: 1040, stop: 1060, stop_option: 6, expires: "2026-10-07", ...extra },
  calls: [{ service: "rh", tool: "place_option_order", args: { legs: [{ option_id: optIdIn(body), side: "buy", position_effect: "open" }], quantity: "1", type: "limit", price: "10.00", time_in_force: "gfd" } }] });

Deno.test("v3.23: one Signal call → ONE Claude request, forced card, pinged once, read saved from the card", async () => {
  reset(); setNow("2026-10-06T19:12:55Z"); callHook = muHook(); seedMuBatch();
  let bad = "";
  claudeScript = (body: any) => {
    const chk = (c: unknown, m: string) => { if (!c && !bad) bad = m; };
    chk(body.tool_choice?.name === "propose_action", "forced from the first step");
    chk(body.tools.length === 1 && body.tools[0].name === "propose_action" && body.tools[0].input_schema.required.includes("read"), "only the card tool, read required");
    const p = JSON.stringify(body.messages[0]);
    chk(/PRICE: MU \$/.test(p), "price"); chk(/5-MIN BARS/.test(p), "bars"); chk(/CONTRACTS:/.test(p), "contracts"); chk(!/ALT —/.test(p), "no ALT"); chk(/ONE card per post/.test(p), "one card rule");
    return muCard(body);
  };
  await M.signalJarvis(8);
  assert(!bad, bad);
  const b = T.otto_signal_batches[0];
  assert(claudeBodies.length === 1, "one Claude request, got " + claudeBodies.length);
  assert(b.cards.length === 1 && T.otto_actions.length === 1, "one card");
  assert(pings.filter((p) => /Card ready/.test(p.title)).length === 1, "pinged once: " + JSON.stringify(pings));
  assert(b.timing?.one_step === true && b.timing.cards === 1, JSON.stringify(b.timing));
  assert(/^MU short: he shorted the break/.test(b.read), b.read);
});

Deno.test("v3.23: the server bounces the first card → one retry makes it; never a third try", async () => {
  reset(); setNow("2026-10-06T19:12:55Z"); callHook = muHook(); seedMuBatch();
  let n = 0;
  claudeScript = (body: any) => { n++; return n === 1 ? toolReply("propose_action", { title: "x", summary: "x", read: "x", calls: [{ service: "rh", tool: "place_option_order", args: { legs: [{ option_id: optIdIn(body), side: "buy", position_effect: "open" }], quantity: "1", type: "limit", price: "10.00" } }] }) : muCard(body); };
  await M.signalJarvis(8);
  assert(n === 2 && T.otto_signal_batches[0].cards.length === 1, "retry made the card; requests " + n);
});

Deno.test("v3.23: bounced twice → no card, the ping says the server's reason", async () => {
  reset(); setNow("2026-10-06T19:12:55Z"); callHook = muHook(); seedMuBatch();
  let n = 0;
  claudeScript = (body: any) => { n++; return toolReply("propose_action", { title: "x", summary: "x", read: "x", calls: [{ service: "rh", tool: "place_option_order", args: { legs: [{ option_id: optIdIn(body), side: "buy", position_effect: "open" }], quantity: "1", type: "limit", price: "10.00" } }] }); };
  await M.signalJarvis(8);
  const b = T.otto_signal_batches[0];
  assert(n === 2, "two tries only: " + n);
  assert(!b.cards.length && /No card: the card was rejected: An opening option order needs its plan/.test(b.read), b.read.replace(/\n/g, " | "));
  assert(pings.some((p) => /MU SHORT — NO card/.test(p.title) && /rejected: An opening option order needs its plan/.test(p.body)), JSON.stringify(pings));
});

Deno.test("v3.23: a call with no direction → both calls and puts pre-fetched; Jarvis still decides", async () => {
  reset(); setNow("2026-10-06T19:12:55Z"); callHook = muHook();
  const pack = await M.signalPack({ ticker: "MU", direction: "" });
  assert(/calls, expiries/.test(pack) && /puts, expiries/.test(pack), pack.slice(0, 300).replace(/\n/g, " | "));
});

Deno.test("v3.23: two tickers at once keep the old multi-step loop (not forced on step one)", async () => {
  reset(); setNow("2026-10-06T19:12:55Z"); callHook = muHook(); seedMuBatch();
  T.otto_jason.push({ id: 802, created_at: "2026-10-06T19:12:54Z", day: "2026-10-06", posted_at: "2026-10-06T19:12:40Z", posted_label: "3:12 PM", kind: "call", ticker: "AMD", direction: "long", late: false, words: "AMD LONG", source: "watcher" });
  T.otto_signal_batches[0].rows = [801, 802];
  let first: any = null;
  claudeScript = (body: any) => { first ||= body; return textReply("READ: two calls"); };
  await M.signalJarvis(8);
  assert(first && !first.tool_choice && first.tools.length > 1, "old loop for two calls");
});

/* ======================= v3.29 — a coach LEVEL post gets the one-step path too (12 Oct: 71–107 s on the old loop) ======================= */
function seedMuLevel(extra: any = {}) {
  T.otto_jason.push({ id: 811, created_at: "2026-10-06T19:12:54Z", day: "2026-10-06", posted_at: "2026-10-06T19:12:40Z", posted_label: "3:12 PM", kind: "level", ticker: "MU", direction: null, level: 1060, late: false, words: "MU 1060 KEY LEVEL", source: "watcher", ...extra });
  T.otto_signal_batches.push({ id: 8, created_at: "2026-10-06T19:12:54Z", day: "2026-10-06", msg_ids: ["m1"], rows: [811], status: "jarvis" });
}

Deno.test("v3.29: one level post WITH a direction → ONE request, card tool not forced, that side pre-fetched, card made + pinged once", async () => {
  reset(); setNow("2026-10-06T19:12:55Z"); callHook = muHook(); seedMuLevel({ direction: "short" });
  let bad = "";
  claudeScript = (body: any) => {
    const chk = (c: unknown, m: string) => { if (!c && !bad) bad = m; };
    chk(!body.tool_choice, "card NOT forced for a level");
    chk(body.tools.length === 1 && body.tools[0].name === "propose_action", "only the card tool");
    const p = JSON.stringify(body.messages[0]);
    chk(/He posted a LEVEL/.test(p), "level rule"); chk(/PRICE: MU \$/.test(p), "price"); chk(/5-MIN BARS/.test(p), "bars");
    chk(/puts, expiries/.test(p) && !/calls, expiries/.test(p), "puts side pre-fetched");
    return muCard(body);   // like production: Jarvis does not put the level row id in the plan
  };
  await M.signalJarvis(8);
  assert(!bad, bad);
  const b = T.otto_signal_batches[0];
  assert(claudeBodies.length === 1, "one Claude request, got " + claudeBodies.length);
  assert(b.cards.length === 1 && T.otto_actions.length === 1, "one card");
  assert(pings.filter((p) => /Card ready/.test(p.title)).length === 1, "pinged once: " + JSON.stringify(pings));
  assert(b.timing?.one_step === true && b.timing.cards === 1, JSON.stringify(b.timing));
  assert(T.otto_jason[0].action_id === b.cards[0], "the level row is linked to its card");
});

Deno.test("v3.29: a level that is not a setup → ONE request, no card, Jarvis's one-line reason is the read (no 'ran out of steps')", async () => {
  reset(); setNow("2026-10-06T19:12:55Z"); callHook = muHook(); seedMuLevel();
  claudeScript = () => textReply("READ: MU 1060 is 40 points above the live price and the 5-minute bars are flat, so there is no setup yet.");
  await M.signalJarvis(8);
  const b = T.otto_signal_batches[0];
  assert(claudeBodies.length === 1, "one request, got " + claudeBodies.length);
  assert(!b.cards.length && T.otto_actions.length === 0, "no card");
  assert(/no setup yet/.test(b.read) && !/ran out of steps/.test(String(b.read) + String(b.error)), String(b.read) + " | " + String(b.error));
  assert(!pings.some((p) => /Card ready/.test(p.title)), "no card ping");
});

Deno.test("v3.29: two level posts for DIFFERENT tickers, or a level + a call for different tickers, keep the old multi-step loop", async () => {
  reset(); setNow("2026-10-06T19:12:55Z"); callHook = muHook(); seedMuLevel();
  T.otto_jason.push({ id: 812, created_at: "2026-10-06T19:12:54Z", day: "2026-10-06", posted_at: "2026-10-06T19:12:41Z", posted_label: "3:12 PM", kind: "level", ticker: "AMD", direction: null, level: 160, late: false, words: "AMD 160", source: "watcher" });
  T.otto_signal_batches[0].rows = [811, 812];
  let first: any = null;
  claudeScript = (body: any) => { first ||= body; return textReply("READ: two levels"); };
  await M.signalJarvis(8);
  assert(first && !first.tool_choice && first.tools.length > 1, "old loop for two tickers");
});

/* ======================= v3.30 — 13 Oct: direction-less level posts get no card; the server stamps LIVE/PAPER; shorter cards; faster extension ======================= */
Deno.test("v3.30 item 1: a level with NO direction → no card even when Jarvis tries one without plan.jason_id (12 Oct: 5 such cards)", async () => {
  reset(); setNow("2026-10-06T19:12:55Z"); callHook = muHook(); seedMuLevel();   // no direction
  let first: any = null; let n = 0;
  claudeScript = (body: any) => { first ||= body; n++; return n === 1 ? muCard(body, { jason_id: undefined }) : textReply("READ: no card for a level with no direction; the Watcher has it both ways."); };
  await M.signalJarvis(8);
  const b = T.otto_signal_batches[0];
  assert(/Make NO card/.test(JSON.stringify(first.messages[0])), "the no-direction rule is in the prompt");
  assert(T.otto_actions.length === 0 && !b.cards.length, "no card was stored: " + JSON.stringify(b.cards));
  assert(!pings.some((p: any) => /Card ready/.test(p.title)), "no card ping");
  assert(claudeBodies.length <= 2, "at most 2 requests, got " + claudeBodies.length);
});

Deno.test("v3.30 item 1: proposeAction refuses a card for a blocked ticker from Signals only (Watcher touch cards and the manual ticket are unaffected)", async () => {
  reset(); (M as any).clearCacheForTest();
  const row = { id: 811, ticker: "SPY", kind: "level", direction: null, level: 778, words: "SPY 778 Resistance / 777 Support super tight" };
  let err = "";
  try { await M.proposeAction(spyCard(), "signals", { blockLevels: { SPY: row } }); } catch (e) { err = (e as Error).message; }
  assert(/^NO CARD — the coach posted a level with no direction/.test(err) && /778/.test(err), "refused: " + err);
  const w: any = await M.proposeAction(spyCard(), "watcher", { blockLevels: { SPY: row } });
  assert(w.status === "pending", "watcher card allowed");
  T.otto_actions = [];
  const m: any = await M.proposeAction(spyCard(), "ottotrader@vinecreativestudio.com", { manual: true, blockLevels: { SPY: row } });
  assert(m.status === "pending", "manual ticket allowed");
  T.otto_actions = [];
  const other: any = await M.proposeAction(spyCard(), "signals", { blockLevels: { QQQ: row } });
  assert(other.status === "pending", "a different ticker is not blocked");
});

Deno.test("v3.30 item 2: the server sets LIVE / PAPER at the front of an opening card's title; what Jarvis wrote there is replaced (META 12 Oct 14:06)", async () => {
  reset(); (M as any).clearCacheForTest(); T.otto_settings = [{ key: "limits", value: { size_cap_on: false, kill_on: false } }];   // only the coach's call may go live
  const paper: any = await M.proposeAction({ ...spyCard(), title: "LIVE — Buy 1 SPY 781C 10/9 @ $3.50" }, "watcher");
  assert(paper.status === "paper_wait" && paper.title === "PAPER — Buy 1 SPY 781C 10/9 @ $3.50", "practice card: " + paper.status + " " + paper.title);   // v3.35
  T.otto_actions = []; (M as any).clearCacheForTest();
  T.otto_settings = [{ key: "limits", value: { size_cap_on: false, kill_on: false, live_coach_call: true, live_coach_level: true, live_jarvis: true } }];
  const live: any = await M.proposeAction({ ...spyCard(), title: "paper: Buy 1 SPY 781C 10/9 @ $3.50" }, "watcher");
  assert(live.status === "pending" && live.title === "LIVE — paper: Buy 1 SPY 781C 10/9 @ $3.50".replace("paper: ", ""), "live card: " + live.title);
  T.otto_actions = [];
  const plain: any = await M.proposeAction(spyCard(), "watcher");
  assert(plain.title === "LIVE — Buy 1 SPY 781C 10/9 @ $3.50", "no prefix written → LIVE added: " + plain.title);
  assert(M.bareTitle("LIVE — Buy 1 SPY 781C") === "1 SPY 781C" && M.bareTitle("PAPER - Buy 1 X") === "1 X" && M.bareTitle("Buy 1 X") === "1 X", "close/notify titles still strip the stamp");
  assert(M.stampTitle("LIVE: Buy 1 X", true) === "PAPER — Buy 1 X" && M.stampTitle("Paper · SCALP · Buy 1 X", false) === "LIVE — SCALP · Buy 1 X", "variants are replaced");
});

Deno.test("v3.30 item 4: the Signal card rules ask for a 2-line summary and a 1–2 line read; item 3: the extension waits 3 s / 8 s", async () => {
  assert(/summary to 2 short lines/.test(M.ONE_STEP_RULE) && /summary to 2 short lines/.test(M.LEVEL_ONE_STEP_RULE) && !/4 short lines/.test(M.ONE_STEP_RULE + M.LEVEL_ONE_STEP_RULE), "summary trimmed");
  assert(/1–2 short plain lines/.test(M.ONE_STEP_RULE) && /1–2 short plain lines/.test(M.signalProposeTool([]).input_schema.properties.read.description), "read trimmed");
  const bg = await Deno.readTextFile(new URL("../../extension/background.js", import.meta.url));
  assert(/const QUIET_MS = 3000;/.test(bg) && /const MAX_WAIT_MS = 8000;/.test(bg) && /const VER = "1\.5\.0"/.test(bg), "extension 1\.4\.4 waits 3 s quiet / 8 s max");
  const mf = JSON.parse(await Deno.readTextFile(new URL("../../extension/manifest.json", import.meta.url)));
  assert(mf.version === "1.5.0", "manifest version " + mf.version);
});

Deno.test("v3.23: the 9:10 self-test fails (and pings) when post → card is slower than 30 s", async () => {
  reset(); setNow("2026-10-07T13:10:00Z"); callHook = muHook(781.2, "SPY");
  T.otto_settings.push({ key: "signal_beat", value: { at: "2026-10-07T13:09:50Z", state: "ok", queue: 0, queue_age: 0 } });
  extractHook = () => [{ kind: "call", ticker: "SPY", direction: "long", words: "SPY LONG", time: "9:10 AM" }];
  claudeScript = (body: any) => {
    NOW += 31_000;                                         // a slow Claude
    const m = /option_id (SPY-[0-9-]+-call-\d+)/.exec(JSON.stringify(body.messages));
    return toolReply("propose_action", { title: "TEST Buy 1 SPY", summary: "t", read: "SPY long — test.", plan: { tv_symbol: "AMEX:SPY", direction: "up", setup: "otto signal", tp1: 784, stop: 779, stop_option: 1.5 },
      calls: [{ service: "rh", tool: "place_option_order", args: { legs: [{ option_id: m?.[1], side: "buy", position_effect: "open" }], quantity: "1", type: "limit", price: "3.00", time_in_force: "gfd" } }] });
  };
  const r: any = await M.signalSelfTest(true);
  const sp = r.steps.find((s: any) => /^Speed/.test(s.name));
  assert(!r.ok && sp && !sp.ok && /slower than the 30s target/.test(sp.note), JSON.stringify(r.steps));
  assert(pings.some((p) => /self-test failed/.test(p.title) && /Speed/.test(p.body)), JSON.stringify(pings));
});

/* ======================= v3.24 — honesty + safety (replays of the 8 Oct misses) ======================= */
import { ORDERS_1008, ordersAt, BARS_1008 } from "./fixtures_2026-10-08.ts";
const bars1008 = (tool: string, args: any) => tool === "get_equity_historicals"
  ? { data: { results: (args.symbols || []).filter((s: string) => BARS_1008[s]).map((s: string) => ({ symbol: s, interval: "5minute", bars: BARS_1008[s] })) } } : null;
const px1008 = (px: Record<string, number>) => (tool: string, args: any) =>
  tool === "get_equity_quotes" ? { data: { results: (args.symbols || []).map((s: string) => ({ quote: { symbol: s, last_trade_price: px[s] ? String(px[s]) : undefined } })) } } : null;
const hooks = (...hs: ((t: string, a: any) => any)[]) => (t: string, a: any) => { for (const h of hs) { const r = h(t, a); if (r) return r; } return null; };
const at1008 = (iso: string) => { reset(); setNow(iso); orders = ordersAt(iso) as any[]; };

Deno.test("v3.24 (A13): TSLA 1:07 PM — '365P filled at 3.70, TP1 already hit' is corrected: never filled", async () => {
  at1008("2026-10-08T17:07:30Z");
  callHook = hooks(bars1008, px1008({ TSLA: 370.45 }));
  const r = await M.factCheck("TSLA is at $370.45 right now — the 365P filled at 3.70 with TP1 at 368. TP1 is already hit.");
  assert(/\[Corrected by Otto: Robinhood shows the TSLA 365P 10\/14 order confirmed, not filled — it never filled\.\]/.test(r.text), r.text);
  assert(!/365P filled at 3\.70/.test(r.text) && !/TP1 is already hit/.test(r.text), "both false sentences replaced: " + r.text);
  assert(r.notes.length >= 1 && r.notes.every((n: string) => /never filled/.test(n)), JSON.stringify(r.notes));
});
Deno.test("v3.24 (A6): the 9:58 PLTR review — fake loss, 'both stopped', 'daily stop active' corrected; true lines stay", async () => {
  at1008("2026-10-08T13:58:20Z");
  callHook = hooks(bars1008, px1008({ PLTR: 201.2 }));
  const said = "NVDA 240C closed at $0.60 for −$26. Then the 9:55 bar closed at $199.33 — wrong-if triggered, out at roughly ~$0.90–$1.00 on the option (entry $1.74, loss ~$74–$84). " +
    "Two trades done today (NVDA 240C, PLTR 202.5C), both stopped. **Daily stop flag is active** — any new trade today gets a red banner per the guardrails.";
  const r = await M.factCheck(said);
  assert(/NVDA 240C closed at \$0\.60 for −\$26\./.test(r.text), "true NVDA line kept: " + r.text);
  assert(/PLTR 202\.5C 10\/09 bought @ \$1\.74 → sold @ \$1\.87 = \+\$13/.test(r.text), "real PLTR result shown: " + r.text);
  assert(/1 losing round trip today/.test(r.text) && /daily stop \(2 losers\) is NOT hit/.test(r.text), r.text);
  assert(!/loss ~\$74/.test(r.text) && !/both stopped/.test(r.text) && !/Daily stop flag is active/.test(r.text), "false lines gone: " + r.text);
});
Deno.test("v3.24 (A6): 9:52 position check — 'entry $1.88' (the limit) corrected to the $1.74 fill", async () => {
  at1008("2026-10-08T13:52:10Z");
  callHook = hooks(bars1008, px1008({}));
  const r = await M.factCheck("**PLTR 202.5C 10/09 — position check**\n| Option mark | $2.43 (entry $1.88, +$0.55 / +29%) |");
  assert(/filled at \$1\.74 \(Robinhood\) — that's the entry, not \$1\.88/.test(r.text), r.text);
});
Deno.test("v3.24 (A7): the 9:50 PLTR card counts NVDA's −$26 — '1 losing trade', from Robinhood (the journal was empty)", async () => {
  at1008("2026-10-08T13:50:30Z");
  callHook = hooks(bars1008, px1008({}));
  const c: any[] = await M.limitChecks(174, 80);
  const d = c.find((x) => /losing trade/.test(x.text));
  assert(d && /Today: 1 losing trade, \$-26/.test(d.text) && d.ok === true, JSON.stringify(c));
  assert(c.some((x) => /Trade 2 today/.test(x.text)), "NVDA was trade 1: " + JSON.stringify(c));
});
Deno.test("v3.24 (A7): a second loser hits the daily stop — flagged red, card still built", async () => {
  at1008("2026-10-08T16:00:00Z");
  orders = [...ordersAt("2026-10-08T16:00:00Z"),
    { id: "x-b", chain_symbol: "AMD", state: "filled", created_at: "2026-10-08T15:30:00Z", updated_at: "2026-10-08T15:30:00Z", legs: [{ option_id: "amd", side: "buy", position_effect: "open", strike_price: "630", option_type: "put", executions: [{ price: "2.00", quantity: "1" }] }] },
    { id: "x-s", chain_symbol: "AMD", state: "filled", created_at: "2026-10-08T15:45:00Z", updated_at: "2026-10-08T15:45:00Z", legs: [{ option_id: "amd", side: "sell", position_effect: "close", strike_price: "630", option_type: "put", executions: [{ price: "1.50", quantity: "1" }] }] }] as any[];
  const c: any[] = await M.limitChecks(150, 50);
  const d = c.find((x) => /DAILY STOP/.test(x.text));
  assert(d && d.ok === false && /2 losing trades today/.test(d.text), JSON.stringify(c));
});
Deno.test("v3.24 (A10): 'PLTR at 195.50 right now' (it never traded below 197.00) → corrected with the day's range", async () => {
  at1008("2026-10-08T13:47:40Z");
  callHook = hooks(bars1008, px1008({ PLTR: 199.9 }));
  const r = await M.factCheck("**PLTR at 195.50 right now** is the hottest thing on the board — coach posted the bounce zone call at 9:47 AM (#77). If PLTR holds 195.50 on a 5-min close I'll build the card.");
  assert(/\[Corrected by Otto: PLTR traded 197\.00–204\.44 today — it never traded 195\.5\.\]/.test(r.text), r.text);
  assert(/If PLTR holds 195\.50 on a 5-min close/.test(r.text), "the 'if' line is left alone: " + r.text);
});
Deno.test("v3.24: true trade talk is left alone (recap total, QQQ +$24, quotes table, yesterday's trade)", async () => {
  at1008("2026-10-08T21:15:00Z");
  callHook = hooks(bars1008, px1008({}));
  const ok = ["Four trades closed, Realized on closed trades today: +$45 — TSM and QQQ puts carried the day; NVDA was the only red trade.",
    "QQQ 751P: sold at $2.82 for +$24 realized on the $2.58 fill.",
    "| **META** | $722.81 | +$1.50 (+0.2%) | Barely green, grinding. |",
    "QQQ — yesterday sold at $3.65, **+$11 realized.** Small but clean.",
    "Not filled yet — the TSLA order is still working.",
    "If PLTR fills at 1.80 the stop goes on at 0.94."];
  for (const s of ok) { const r = await M.factCheck(s); assert(r.text.trim() === s.trim() && !r.notes.length, "changed: " + s + " → " + r.text); }
});
Deno.test("v3.24: Jarvis's working notes come off the Desk text (8 Oct QQQ check-in); the rest stays", () => {
  const raw = "Let me grab the position and quote simultaneously.Let me try the correct Agentic account number.**QQQ 751P is +$24 on the $2.58 fill.** The stop_order_id is for the stop order, let me grab it.\nHolding — TP1 752.";
  const t = M.stripNarration(raw);
  assert(!/Let me/.test(t) && !/stop_order_id/.test(t), t);
  assert(/\*\*QQQ 751P is \+\$24 on the \$2\.58 fill\.\*\*/.test(t) && /Holding — TP1 752\./.test(t), t);
  assert(M.stripNarration("I'll check the 10:30 bar close at 10:31 AM ET.") === "I'll check the 10:30 bar close at 10:31 AM ET.", "a promise is not narration");
});
Deno.test("v3.24 (A14): Josh's cancelled TSLA entry says 'cancelled before it filled' — no 'Robinhood gave no reason'", async () => {
  at1008("2026-10-08T17:09:00Z");
  T.otto_actions = [{ id: "card-tsla", title: "Buy 1 TSLA 365P 10/14 @ $3.70", status: "done", created_at: "2026-10-08T17:06:30Z", decided_at: "2026-10-08T17:06:34Z",
    exit: { state: "waiting_fill", order_id: "tsla-buy", option_id: "4b0d0ed3-b9ea-46d3-af93-72685509d6f8", qty: 1, entry_limit: 3.7, stop_option: 2.6, tv_symbol: "NASDAQ:TSLA", direction: "down", wrong_if: 372, tp1: 368, log: [] } }];
  await M.exitTick(T.otto_actions[0]);
  assert(T.otto_actions[0].exit.state === "dead" && T.otto_actions[0].exit.dead_reason === "cancelled before it filled", JSON.stringify(T.otto_actions[0].exit));
  assert(/the entry was cancelled before it filled/.test(deskText()) && !/gave no reason/.test(deskText()), deskText());
});
Deno.test("v3.24 (A14): a real Robinhood rejection still says 'Rejected by Robinhood: <reason>'", () => {
  assert(M.deadWord("rejected", "Insufficient buying power.") === "Rejected by Robinhood: Insufficient buying power.", "rejected");
  assert(M.deadWord("failed") === "Rejected by Robinhood: no reason given", "failed");
  assert(M.deadWord("cancelled") === "cancelled before it filled", "cancelled");
});

/* ---- A8: the NVDA card from 7 Oct, approved 9:28, filled 9:30 at $0.86 already below its 235 wrong-if ---- */
const nvdaCard = () => ({ title: "Buy 1 NVDA 240C 10/12 @ $1.60", summary: "Signal #72",
  calls: [{ service: "rh", tool: "place_option_order", args: { legs: [{ option_id: OPT, side: "buy", position_effect: "open" }], type: "limit", price: "1.60", quantity: "1", time_in_force: "gfd" } }],
  plan: { tv_symbol: "NASDAQ:NVDA", direction: "up", setup: "otto signal", tp1: 240, stop: 235, stop_option: 0.48, entry_underlying: 237.5 } });
Deno.test("v3.24 (A8): stale entry — red line on the card, Approve still places it, Desk says so", async () => {
  at1008("2026-10-08T13:20:00Z");
  orders = [];
  callHook = hooks(bars1008, px1008({ NVDA: 236.1 }), fakeChain("NVDA", 236.1, 2.5, 1.6, 1166));
  const card: any = await M.proposeAction(nvdaCard(), "signals");
  card.id = T.otto_actions[T.otto_actions.length - 1].id = crypto.randomUUID();
  assert(!card.checks.some((c: any) => c.stale), "not stale at 236.10: " + JSON.stringify(card.checks));
  // pre-open: NVDA slips to 234.88 while the card waits → the cron puts the red line on
  setNow("2026-10-08T13:27:00Z"); callHook = hooks(bars1008, px1008({ NVDA: 234.88 }), fakeChain("NVDA", 234.88, 2.5, 1.6, 1166));
  await M.staleTick();
  const row = T.otto_actions.find((a) => a.id === card.id);
  assert(row.checks[0].stale && /NVDA is already below 235 \(now 234\.88\) — this trade is wrong before it starts/.test(row.checks[0].text), JSON.stringify(row.checks));
  assert(/The card stays up — Approve still places it/.test(deskText()), deskText());
  setNow("2026-10-08T13:28:39Z");
  const done: any = await M.actOnForTest(card.id, "approve", "Josh");
  assert(done.status === "done" && calls.some((c) => c.tool === "place_option_order" && c.args.price === "1.60"), "order still placed");
  assert(/approved by Josh while NVDA is already below 235/.test(deskText()), deskText());
});
Deno.test("v3.24 (A8): the stop is sized from the actual fill — $1.60 limit, $0.86 fill → stop $0.26 (not $0.48)", async () => {
  assert(M.stopFromFill(1.6, 0.48, 0.86) === 0.26, "0.86 × 30% = 0.258 → 0.26: " + M.stopFromFill(1.6, 0.48, 0.86));
  assert(M.stopFromFill(1.6, 0.48, 1.6) === null && M.stopFromFill(1.6, 0.48, 1.59) === null, "same price → card's stop");
  at1008("2026-10-08T13:30:10Z");
  orders = [{ id: "nv-b", chain_symbol: "NVDA", state: "filled", processed_quantity: "1", price: "1.60", created_at: "2026-10-08T13:28:39Z", updated_at: "2026-10-08T13:30:01Z",
    legs: [{ option_id: OPT, side: "buy", position_effect: "open", executions: [{ price: "0.86", quantity: "1" }] }] }];
  callHook = hooks(bars1008, px1008({ NVDA: 234.6 }));
  T.otto_actions = [{ id: "card-nv", title: "Buy 1 NVDA 240C 10/12 @ $1.60", status: "done", created_at: "2026-10-07T19:00:00Z", decided_at: "2026-10-08T13:28:39Z",
    exit: { state: "waiting_fill", order_id: "nv-b", option_id: OPT, qty: 1, entry_limit: 1.6, stop_option: 0.48, tv_symbol: "NASDAQ:NVDA", direction: "up", wrong_if: 235, tp1: 240, wrong_tf: 5, log: [] } }];
  await M.exitTick(T.otto_actions[0]);
  const stop = calls.find((c) => c.tool === "place_option_order" && c.args.type === "stop_market");
  assert(stop && stop.args.stop_price === "0.26", "stop placed at 0.26: " + JSON.stringify(stop?.args));
  assert(/Stop sized from the fill \(card had \$0\.48\)/.test(deskText()) && /NVDA is already below 235/.test(deskText()), deskText());
});

/* ---- A11 + A12: TSM, 8 Oct ---- */
const tsmTrade = (wrong = 467.9) => ({ id: "card-tsm", title: "Buy 1 TSM 472.5C 10/09 @ $1.57", status: "done", created_at: "2026-10-08T14:06:00Z", decided_at: "2026-10-08T14:06:32Z",
  exit: { state: "armed", option_id: OPT, qty: 1, entry_limit: 1.57, stop_option: 0.47, stop_order_id: "tsm-stop", tv_symbol: "NYSE:TSM", direction: "up", wrong_if: wrong, tp1: 473, wrong_tf: 5,
    armed_at: "2026-10-08T14:09:00Z", alerts: { wrong: 501, tp1: 502 }, fired: [], log: [] } });
Deno.test("v3.24 (A11): the late 10:37 TSM wrong-if alert is ignored — the latest 5-min close (10:30–10:35) is 469.60, no close card", async () => {
  at1008("2026-10-08T14:37:10Z");
  orders = [{ id: "tsm-stop", state: "confirmed", type: "stop_market", legs: [{ option_id: OPT, side: "sell", position_effect: "close" }] }];
  callHook = hooks(bars1008, px1008({ TSM: 469.9 }), (t: string) => t === "mcp-tv-get-alerts-log" ? { events: [{ tv_alert_id: 501, fire_id: "f1", fired_at: "2026-10-08T14:36:50Z" }] } : null);
  T.otto_actions = [tsmTrade()];
  const r: any = await M.exitTick(T.otto_actions[0]);
  assert(r.stale_alert === true, JSON.stringify(r));
  assert(T.otto_actions.length === 1 && !orders.some((o) => o.type === "market"), "no close card, nothing sold");
  assert(/late TradingView wrong-if alert \(467\.9\) was ignored — the latest 5-minute bar closed at 469\.6,/.test(deskText()), deskText());
});
Deno.test("v3.24 (A11): a wrong-if alert that IS true on the latest bar still closes by the card rule", async () => {
  at1008("2026-10-08T14:15:10Z");
  orders = [{ id: "tsm-stop", state: "confirmed", type: "stop_market", legs: [{ option_id: OPT, side: "sell", position_effect: "close" }] }];
  callHook = hooks(bars1008, px1008({ TSM: 467.9 }), (t: string) => t === "mcp-tv-get-alerts-log" ? { events: [{ tv_alert_id: 501, fire_id: "f2", fired_at: "2026-10-08T14:15:02Z" }] } : null);
  T.otto_actions = [tsmTrade(468)];
  const r: any = await M.exitTick(T.otto_actions[0]);
  assert(!r.stale_alert && (r.auto || T.otto_actions.length > 1), "not ignored: " + JSON.stringify(r));
});
Deno.test("v3.24 (A12): Josh's 469.44 Watcher level becomes the TSM wrong-if (replaces 467.90); the server closes on a 5-min close below it", async () => {
  at1008("2026-10-08T14:32:20Z");
  callHook = hooks(bars1008, px1008({ TSM: 469.6 }));
  T.otto_actions = [tsmTrade()];
  const row: any = await M.watchAdd({ ticker: "TSM", level: 469.44, dir: "down", source: "desk", by: "Josh via Jarvis" });
  const ex = T.otto_actions[0].exit;
  assert(ex.wrong_if === 469.44 && ex.wrong_tf === 5 && ex.wrong_set_at, JSON.stringify(ex));
  assert(row?.trade_wrong_if?.old === 467.9, JSON.stringify(row));
  assert(calls.some((c) => c.tool === "mcp-tv-delete-alert" && c.args.alert_ids[0] === 501), "old 467.90 alert removed (one wrong-if)");
  assert(T.otto_watch.every((w) => w.status !== "watching"), "not a separate entry level: " + JSON.stringify(T.otto_watch));
  assert(/TSM 469\.44 is now the wrong-if on Buy 1 TSM 472\.5C 10\/09 @ \$1\.57 \(was 467\.9 — replaced, not added\)/.test(deskText()), deskText());
  // the 10:10 bar (467.90) was before the move: it doesn't count. 10:35 closed 469.885 (above). 10:40 closed 469.12 → met at 10:45.
  const before: any = await M.exitRuleCheck(T.otto_actions[0], RealDate.parse("2026-10-08T14:40:30Z"));
  assert(!before.met, "not met yet: " + JSON.stringify(before));
  const after: any = await M.exitRuleCheck(T.otto_actions[0], RealDate.parse("2026-10-08T14:45:10Z"));
  assert(after.met && /wrong-if 469\.44: TSM closed a 5-minute bar at 469\.12/.test(after.why), JSON.stringify(after));
});
Deno.test("v3.24 (A12): a level ABOVE an open call (or a ticker with no trade) is an ordinary Watcher level", async () => {
  at1008("2026-10-08T14:50:20Z");
  callHook = hooks(bars1008, px1008({ TSM: 469.6, PLTR: 199.9 }));
  T.otto_actions = [tsmTrade()];
  const r1: any = await M.watchAdd({ ticker: "TSM", level: 471.5, dir: "up", source: "desk", by: "Josh" });
  const r2: any = await M.watchAdd({ ticker: "PLTR", level: 198.5, dir: "down", source: "desk", by: "Josh" });
  assert(r1 && !r1.trade_wrong_if && r1.status === "watching" && r2 && !r2.trade_wrong_if, JSON.stringify([r1, r2]));
  assert(T.otto_actions[0].exit.wrong_if === 467.9, "trade untouched");
});

/* ---- C1 / C2 ---- */
Deno.test("v3.24 (C1): a re-lock on a level that was taken off puts it back on the Watcher", async () => {
  at1008("2026-10-08T13:00:00Z");
  T.otto_watch = [{ id: 901, day: "2026-10-08", ticker: "NVDA", level: 237.5, dir: "up", status: "removed", source: "desk", fired: {} }];
  const w: any = await M.watchEnsure({ ticker: "NVDA", level: 237.5, dir: "up" }, null);
  assert(w && w.id === 901 && T.otto_watch[0].status === "watching", JSON.stringify(T.otto_watch));
});
Deno.test("v3.24 (C2): a check-in stuck on 'running' for 10+ minutes is failed, and the Desk and phone are told", async () => {
  at1008("2026-10-08T17:30:00Z");
  T.otto_checks = [{ id: 7, day: "2026-10-08", due_at: "2026-10-08T17:15:00Z", what: "Look at QQQ 751P vs 752", by: "Jarvis", status: "running" },
    { id: 8, day: "2026-10-08", due_at: "2026-10-08T17:27:00Z", what: "recent", by: "Jarvis", status: "running" }];
  await M.checksStuck();
  assert(T.otto_checks[0].status === "error" && /timed out/.test(T.otto_checks[0].result), JSON.stringify(T.otto_checks[0]));
  assert(T.otto_checks[1].status === "running", "a 3-minute-old run is left alone");
  assert(/check-in "Look at QQQ 751P vs 752" failed: timed out/.test(deskText()) && pings.some((p) => /check-in failed/.test(p.title)), deskText());
});
Deno.test("v3.24: today's Robinhood trades go into Jarvis's context line", () => {
  const line = M.tradesLine(M.dayFacts(ORDERS_1008 as any[]));
  assert(/NVDA 240C 10\/12 bought @ \$0\.86 → sold @ \$0\.60 = −\$26/.test(line) && /Losing round trips today: 1/.test(line) && /Realized: \+\$45/.test(line), line);
  assert(/Never filled: TSLA 365P 10\/14 \(cancelled before it filled\)/.test(line), line);
});

/* ---- C10 (Ifoma, 8 Oct night: all three) ---- */
const noPos = (t: string) => t === "get_option_positions" ? { data: { positions: [] } } : t === "get_option_instruments" ? { data: { instruments: [{ chain_symbol: "NVDA", strike_price: "240.0000", type: "call", expiration_date: "2026-10-12" }] } } : null;
const stopCard = () => ({ title: "Stop-Market STC — NVDA 240C 10/12 @ $0.48", summary: "check-in",
  calls: [{ service: "rh", tool: "place_option_order", args: { legs: [{ option_id: OPT, side: "sell", position_effect: "close" }], quantity: "1", type: "stop_market", stop_price: "0.48", time_in_force: "gfd" } }] });
Deno.test("v3.24 (C10a): the 9:45 check-in stop card for NVDA (closed at 9:36) is not made — nothing to close", async () => {
  at1008("2026-10-08T13:45:31Z");
  callHook = noPos;
  let err = "";
  try { await M.proposeAction(stopCard(), "checkin"); } catch (e) { err = (e as Error).message; }
  assert(/NO CARD — nothing to close: Robinhood shows no NVDA 240C 10\/12 position/.test(err) && !T.otto_actions.length, err);
});
Deno.test("v3.24 (C10b): a stop card approved after the position is gone is NOT sent to Robinhood", async () => {
  at1008("2026-10-08T13:46:36Z");
  const id = crypto.randomUUID();
  T.otto_actions = [{ id, ...stopCard(), status: "pending", created_at: "2026-10-08T13:45:31Z", created_by: "checkin" }];
  callHook = noPos;
  const r: any = await M.actOnForTest(id, "approve", "ottotrader@vinecreativestudio.com");
  assert(r.status === "failed" && /Nothing to close/.test(r.result[0].text), JSON.stringify(r));
  assert(!calls.some((c) => c.tool === "place_option_order"), "nothing sent");
  assert(/nothing to close — Robinhood shows no NVDA 240C 10\/12 position/.test(deskText()), deskText());
});
Deno.test("v3.24 (C10c): when a protected trade goes flat, its waiting stop/close cards come down", async () => {
  at1008("2026-10-08T13:36:30Z");
  callHook = noPos;
  T.otto_actions = [{ ...tsmTrade(), id: "nv-tr", title: "Buy 1 NVDA 240C", exit: { ...tsmTrade().exit, stop_order_id: null, alerts: {} } },
    { id: "nv-stop", ...stopCard(), status: "pending", created_at: "2026-10-08T13:35:40Z" },
    { id: "other", title: "Buy 1 QQQ", calls: [{ service: "rh", tool: "place_option_order", args: { legs: [{ option_id: "qqq", side: "buy", position_effect: "open" }] } }], status: "pending", created_at: "2026-10-08T13:35:00Z" }];
  await M.exitTick(T.otto_actions[0]);
  assert(T.otto_actions[0].exit.state === "closed", JSON.stringify(T.otto_actions[0].exit));
  assert(T.otto_actions[1].status === "expired" && T.otto_actions[2].status === "pending", JSON.stringify(T.otto_actions.map((a) => a.status)));
});
Deno.test("v3.24 (C10): a real stop for a held contract still goes up (Robinhood shows the position)", async () => {
  at1008("2026-10-08T13:33:00Z");
  callHook = null;
  const c: any = await M.proposeAction(stopCard(), "ottotrader@vinecreativestudio.com");
  assert(c.status === "pending", JSON.stringify(c));
});

/* =============================== v3.25 — NIGHT CHARTS =============================== */
import { NVDA_DAILY, NVDA_WEEKLY, NVDA_LAST_1008 } from "./fixtures_nvda_daily_weekly.ts";
const rhBarsOf = (sym: string, bars: any[], interval: string) => ({ symbol: sym, interval, bars: bars.map((b: any) => ({
  begins_at: new RealDate(b[0]).toISOString(), open_price: String(b[1]), high_price: String(b[2]), low_price: String(b[3]), close_price: String(b[4]) })) });
const chartHook = (px = NVDA_LAST_1008) => hooks((tool: string, args: any) => {
  if (tool !== "get_equity_historicals") return null;
  const s = (args.symbols || [])[0];
  if (s !== "NVDA") return { data: { results: [] } };
  return { data: { results: [rhBarsOf("NVDA", args.interval === "week" ? NVDA_WEEKLY : NVDA_DAILY, args.interval)] } };
}, px1008({ NVDA: px, PLTR: 199.9 }));
const chartsIdle = async () => { for (let i = 0; i < 400 && T.otto_charts.some((r) => r.status === "charting"); i++) await sleep(20); };   // let background chart runs finish
const nightReset = (iso = "2026-10-09T01:00:00Z") => { reset(); T.otto_charts = []; setNow(iso); };   // 9:00 PM ET Thu 8 Oct
const pickScript = (ids: string[], read = "NVDA sits in the chatter between the boxes.") => (body: any) =>
  toolReply("pick_boxes", { boxes: ids.map((id) => ({ id, why: `box ${id} matters` })), read });

Deno.test("v3.25: findZones on real NVDA bars (8 Oct, 230.50) — buy boxes under the price, sell boxes over it, every one with its dates", () => {
  const z = M.findZones(NVDA_DAILY as any, NVDA_WEEKLY as any, NVDA_LAST_1008);
  assert(z.length >= 3 && z.length <= 12, "count " + z.length);
  for (const x of z) {
    assert(x.a < x.b, "a<b " + JSON.stringify(x));
    assert(x.type === "buy" ? x.b < NVDA_LAST_1008 : x.a > NVDA_LAST_1008, "side by position " + JSON.stringify(x));
    assert(Math.abs((x.type === "buy" ? x.b : x.a) - NVDA_LAST_1008) / NVDA_LAST_1008 <= 0.12, "within 12% " + JSON.stringify(x));
    assert(/\d+\/\d+/.test(x.why), "dates in the reason " + x.why);
  }
  const sell = z.find((x) => x.type === "sell")!;
  assert(sell && sell.a === 232.28 && sell.b === 234.76 && /Weekly highs 6\/1, 8\/31/.test(sell.why), JSON.stringify(sell));
  assert(!z.some((x) => /gap up 10\/2/.test(x.why)), "the 10/2 gap is filled at 230.50 — not 'unfilled'");
  const flip = z.find((x) => x.type === "buy" && /highs/.test(x.why))!;
  assert(/old resistance, now support/.test(flip.why), flip.why);
  assert(z.map((x) => x.id).join() === z.map((_, i) => "C" + (i + 1)).join(), "ids C1..");
});
Deno.test("v3.25: findZones — no price or no bars → no zones (never a made-up box)", () => {
  assert(M.findZones(NVDA_DAILY as any, NVDA_WEEKLY as any, 0).length === 0, "no price");
  assert(M.findZones([], [], 230).length === 0, "no bars");
});
Deno.test("v3.25: mergeBoxes — a re-chart keeps kept/adjusted boxes, never brings back a removed one, adds new picks", () => {
  const old = [{ id: "k", type: "buy", a: 226, b: 228, review: "keep" }, { id: "r", type: "sell", a: 232, b: 235, review: "rem" }, { id: "n", type: "buy", a: 210, b: 212, review: null }];
  const picks = [{ id: "p1", type: "buy", a: 227, b: 228.5 }, { id: "p2", type: "sell", a: 233, b: 234 }, { id: "p3", type: "buy", a: 215, b: 216 }];
  const m = M.mergeBoxes(old, picks);
  const ids = m.map((x: any) => x.id);
  assert(ids.includes("k") && !ids.includes("p1"), "kept stays, overlapping pick skipped " + ids);
  assert(!ids.includes("p2"), "removed zone not re-added " + ids);
  assert(ids.includes("p3") && !ids.includes("n"), "new pick in, unreviewed old box replaced " + ids);
  assert(m.find((x: any) => x.id === "r")?.review === "rem", "removed box stays marked removed");
});
Deno.test("v3.25: chartOne — Jarvis picks only from the candidates; a made-up id is dropped; the row is ready with the read", async () => {
  nightReset();
  callHook = chartHook();
  claudeScript = (b: any) => toolReply("pick_boxes", { boxes: [{ id: "C1", why: "strong support" }, { id: "C99", why: "invented" }, { id: "c2", why: "resistance" }], read: "In the chatter. Calls only at the buy box." });
  const r: any = await M.chartOne({ ticker: "NVDA", day: "2026-10-09", by: "Otto (night)", mode: "night" });
  assert(r.ok && r.boxes === 2, JSON.stringify(r));
  const row = T.otto_charts.find((x) => x.ticker === "NVDA");
  assert(row.status === "ready" && row.day === "2026-10-09" && row.last === NVDA_LAST_1008 && row.extra === false, JSON.stringify({ ...row, daily: 0, weekly: 0, candidates: 0 }));
  for (const bx of row.boxes) { const c = row.candidates.find((z: any) => z.id === bx.cand); assert(c && c.a === bx.a && c.b === bx.b, "box = candidate's exact prices " + JSON.stringify(bx)); }
  assert(row.read === "In the chatter. Calls only at the buy box.", row.read);
  assert(/^Charted NVDA/.test(row.chat[0].t), row.chat[0].t);
  const sys = claudeBodies[0].system[0].text;
  assert(/OTTO RULES/.test(sys) && /pick from these only/.test(claudeBodies[0].messages[0].content), "rules + candidates sent");
});
Deno.test("v3.25: chartOne — Claude down → the strongest buy and sell zone, and the read says so", async () => {
  nightReset();
  callHook = chartHook();
  claudeScript = () => new Error("overloaded") as any;
  const r: any = await M.chartOne({ ticker: "NVDA", day: "2026-10-09", mode: "night" });
  const row = T.otto_charts[0];
  assert(r.ok && row.boxes.length === 2 && row.boxes.some((b: any) => b.type === "buy") && row.boxes.some((b: any) => b.type === "sell"), JSON.stringify(row.boxes));
  assert(/couldn't pick tonight/.test(row.read), row.read);
});
Deno.test("v3.25: chartOne — Robinhood has no bars → status error with the reason (no empty 'ready' chart)", async () => {
  nightReset();
  callHook = chartHook();
  const r: any = await M.chartOne({ ticker: "ZZZZ", day: "2026-10-09" });
  assert(!r.ok && T.otto_charts[0].status === "error" && /too little history/.test(T.otto_charts[0].error), JSON.stringify(T.otto_charts[0]));
});
Deno.test("v3.25: re-chart keeps the box Josh kept; the ready ping goes out once when all 9 are ready", async () => {
  nightReset();
  callHook = chartHook();
  claudeScript = pickScript(["C1", "C2"]);
  await M.chartOne({ ticker: "NVDA", day: "2026-10-09", mode: "night" });
  const row = T.otto_charts[0], keep = row.boxes[0];
  await M.chartReview({ ticker: "NVDA", day: "2026-10-09", box_id: keep.id, review: "keep", author: "Josh" }, "josh@x");
  await M.chartOne({ ticker: "NVDA", day: "2026-10-09", mode: "morning" });
  const b2 = T.otto_charts[0].boxes;
  assert(b2.some((b: any) => b.id === keep.id && b.review === "keep"), "kept box survived " + JSON.stringify(b2));
  assert(b2.filter((b: any) => b.type === keep.type && Math.min(b.b, keep.b) - Math.max(b.a, keep.a) > 0).length === 1, "no duplicate over the kept box");
  assert(/re-chart: boxes you kept stay kept/.test(T.otto_charts[0].chat.at(-1).t), T.otto_charts[0].chat.at(-1).t);
  assert(pings.length === 0, "not all 9 yet");
  for (const t of M.CHART_LIST.filter((t: string) => t !== "NVDA")) T.otto_charts.push({ id: ++ID, day: "2026-10-09", ticker: t, status: "ready" });
  await M.chartOne({ ticker: "NVDA", day: "2026-10-09", mode: "night" });
  await M.chartOne({ ticker: "NVDA", day: "2026-10-09", mode: "night" });
  assert(pings.filter((p) => p.kind === "charts").length === 1 && /Night Charts ready for Fri/.test(pings[0].title), JSON.stringify(pings));
});
Deno.test("v3.25: chartReview — adjust checks the numbers; keep/remove toggle; each logs a line", async () => {
  nightReset();
  callHook = chartHook();
  claudeScript = pickScript(["C1", "C2"]);
  await M.chartOne({ ticker: "NVDA", day: "2026-10-09" });
  const id = T.otto_charts[0].boxes.find((b: any) => b.type === "buy").id;
  const bad = async (low: number, high: number) => { try { await M.chartReview({ ticker: "NVDA", day: "2026-10-09", box_id: id, review: "adj", low, high, author: "Josh" }, "j@x"); return ""; } catch (e) { return (e as Error).message; } };
  assert(/inside that range/.test(await bad(229, 232)), "straddles the price");
  assert(/15% away/.test(await bad(150, 152)), "typo guard");
  await M.chartReview({ ticker: "NVDA", day: "2026-10-09", box_id: id, review: "adj", low: 228.5, high: 227, author: "Josh" }, "j@x");
  let bx = T.otto_charts[0].boxes.find((b: any) => b.id === id);
  assert(bx.a === 227 && bx.b === 228.5 && bx.review === "adj" && bx.type === "buy", JSON.stringify(bx));
  await M.chartReview({ ticker: "NVDA", day: "2026-10-09", box_id: id, review: "rem", author: "Josh" }, "j@x");
  await M.chartReview({ ticker: "NVDA", day: "2026-10-09", box_id: id, review: "rem", author: "Josh" }, "j@x");
  bx = T.otto_charts[0].boxes.find((b: any) => b.id === id);
  assert(bx.review === null, "second tap undoes");
  assert(/Josh moved the buy box to 227–228\.5/.test(T.otto_charts[0].chat.map((c: any) => c.t).join("\n")), "log line");
});
Deno.test("v3.25: Use kept boxes today → Watcher at the NEAR edge (buy = top, up; sell = bottom, down); never a TradingView alert", async () => {
  nightReset("2026-10-09T12:50:00Z");   // 8:50 AM ET Fri 9 Oct
  callHook = chartHook();
  claudeScript = pickScript(["C1", "C2"]);
  await M.chartOne({ ticker: "NVDA", day: "2026-10-09" });
  for (const b of T.otto_charts[0].boxes) await M.chartReview({ ticker: "NVDA", day: "2026-10-09", box_id: b.id, review: "keep", author: "Josh" }, "j@x");
  const buy = T.otto_charts[0].boxes.find((b: any) => b.type === "buy"), sell = T.otto_charts[0].boxes.find((b: any) => b.type === "sell");
  const r: any = await M.chartUse({ ticker: "NVDA", day: "2026-10-09", author: "Josh" }, "j@x");
  assert(r.added.length === 2, JSON.stringify(r));
  const w = T.otto_watch.filter((x) => x.ticker === "NVDA");
  assert(w.some((x) => x.level === buy.b && x.dir === "up") && w.some((x) => x.level === sell.a && x.dir === "down"), JSON.stringify(w));
  assert(w.every((x) => x.status === "watching" && /Night Charts$/.test(x.added_by) && x.day === "2026-10-09"), JSON.stringify(w));
  assert(!calls.some((c) => c.tool === "mcp-tv-create-alert"), "no TradingView alert (Watcher only)");
  assert(T.otto_charts[0].used_at && T.otto_charts[0].boxes.every((b: any) => b.used), "marked used");
  assert(/Night Charts: Josh put NVDA/.test(deskText()), deskText());
});
Deno.test("v3.25: Use kept boxes with nothing kept → a plain error; a Night Charts level never replaces a trade's wrong-if (A12)", async () => {
  nightReset("2026-10-09T12:50:00Z");
  callHook = chartHook();
  claudeScript = pickScript(["C1", "C2"]);
  await M.chartOne({ ticker: "NVDA", day: "2026-10-09" });
  let msg = ""; try { await M.chartUse({ ticker: "NVDA", day: "2026-10-09" }, "j@x"); } catch (e) { msg = (e as Error).message; }
  assert(/Keep or adjust at least one box/.test(msg), msg);
  T.otto_actions = [{ ...tsmTrade(), exit: { ...tsmTrade().exit, tv_symbol: "NASDAQ:NVDA" } }];
  const buy = T.otto_charts[0].boxes.find((b: any) => b.type === "buy");
  await M.chartReview({ ticker: "NVDA", day: "2026-10-09", box_id: buy.id, review: "keep", author: "Josh" }, "j@x");
  await M.chartUse({ ticker: "NVDA", day: "2026-10-09", author: "Josh" }, "j@x");
  assert(T.otto_actions[0].exit.wrong_if === 467.9, "wrong-if untouched: " + T.otto_actions[0].exit.wrong_if);
  assert(T.otto_watch.some((x) => x.ticker === "NVDA" && x.level === buy.b && x.status === "watching"), "ordinary Watcher level");
});
Deno.test("v3.25: chartsCron — 9:00 PM Thu runs once for Fri; 8:50 AM Fri updates the 9 + Josh's extra ticker; 3 PM does nothing", async () => {
  nightReset("2026-10-09T01:00:00Z");
  callHook = chartHook();
  claudeScript = pickScript(["C1"]);
  const a: any = await M.chartsCron(new RealDate("2026-10-09T01:00:00Z") as any);
  assert(a.started === 9 && T.otto_charts.length === 9 && T.otto_charts.every((r) => r.day === "2026-10-09"), JSON.stringify(a));
  const b: any = await M.chartsCron(new RealDate("2026-10-09T01:10:00Z") as any);
  assert(b.skipped === "night run done", JSON.stringify(b));
  T.otto_charts.push({ id: ++ID, day: "2026-10-09", ticker: "PLTR", status: "ready", extra: true });
  const c: any = await M.chartsCron(new RealDate("2026-10-09T12:50:00Z") as any);
  assert(c.started === 10, "9 + PLTR: " + JSON.stringify(c));
  const d: any = await M.chartsCron(new RealDate("2026-10-09T19:00:00Z") as any);
  assert(d.skipped === "not a chart window", JSON.stringify(d));
  const sat: any = await M.chartsCron(new RealDate("2026-10-11T01:00:00Z") as any);   // Sat 9 PM
  assert(sat.skipped === "not a chart window", "no weekend run " + JSON.stringify(sat));
  await chartsIdle();
  assert(!T.otto_charts.some((r) => r.status === "charting"), "background runs finished");
});
Deno.test("v3.25: Chart now — any ticker is checked on Robinhood first; a bad one is refused in plain words", async () => {
  nightReset("2026-10-09T01:00:00Z");
  callHook = chartHook();
  claudeScript = pickScript(["C1"]);
  let msg = ""; try { await M.chartNow({ ticker: "QQQQQ" }, "j@x"); } catch (e) { msg = (e as Error).message; }
  assert(/Robinhood has no price for QQQQQ/.test(msg), msg);
  msg = ""; try { await M.chartNow({ ticker: "12$" }, "j@x"); } catch (e) { msg = (e as Error).message; }
  assert(/type a ticker/.test(msg), msg);
  const r: any = await M.chartNow({ ticker: "pltr", author: "Josh" }, "j@x");
  assert(r.started === 1 && T.otto_charts.find((x) => x.ticker === "PLTR")?.extra === true, JSON.stringify(T.otto_charts));
  await chartsIdle();
  assert(!T.otto_charts.some((r) => r.status === "charting"), "background runs finished");
});
Deno.test("v3.25: chart chat — Jarvis answers, can move a box (checked like Josh's own move), the chat keeps both lines", async () => {
  nightReset();
  callHook = chartHook();
  claudeScript = pickScript(["C1", "C2"]);
  await M.chartOne({ ticker: "NVDA", day: "2026-10-09" });
  const buy = T.otto_charts[0].boxes.find((b: any) => b.type === "buy");
  claudeScript = () => toolReply("chart_reply", { text: "Tightened it to the gap.", move: { box_id: buy.id, low: buy.a + 0.2, high: buy.b } });
  await M.chartChat({ ticker: "NVDA", day: "2026-10-09", text: "tighten the buy box", author: "Josh" }, "j@x");
  const row = T.otto_charts[0], bx = row.boxes.find((b: any) => b.id === buy.id);
  assert(bx.review === "adj" && Math.abs(bx.a - (buy.a + 0.2)) < 0.01, JSON.stringify(bx));
  const t = row.chat.map((c: any) => `${c.w}:${c.t}`).join("\n");
  assert(/^otto:Charted NVDA at 9:00 PM ET[^\n]*\njosh:tighten the buy box\nsys:Jarvis moved[^\n]*\notto:Tightened/.test(t), "order: " + t);
  assert(/josh:tighten the buy box/.test(t) && /otto:Tightened it to the gap\. \(Moved the box to/.test(t) && /sys:Jarvis moved the buy box/.test(t), t);
  claudeScript = () => toolReply("chart_reply", { text: "Moved.", move: { box_id: buy.id, low: 229, high: 232 } });
  await M.chartChat({ ticker: "NVDA", day: "2026-10-09", text: "put it on the price", author: "Josh" }, "j@x");
  assert(/Couldn't move the box: .*inside that range/.test(T.otto_charts[0].chat.at(-1).t), T.otto_charts[0].chat.at(-1).t);
});

/* =============================== v3.26 — 9 Oct 2026 replays =============================== */
// The day: MSFT 522.5P bought 9:41 @5.25 (stop $0.93!) out 10:10 @3.75 (−$150); MSFT 527.5P bought 10:36 @4.00 out 10:46 @3.20
// (−$80). Account $1,166 → $936. Both puts were on "MSFT 532.40 RESISTANCE" — a level the coach gave no direction for.
const o26 = (id: string, created: string, strike: number, eff: "open" | "close", px: number, state = "filled", extra: any = {}) => ({
  id, created_at: created, updated_at: created, state, chain_symbol: "MSFT", placed_agent: "agentic", ...extra,
  legs: [{ option_id: `msft-${strike}p`, side: eff === "open" ? "buy" : "sell", position_effect: eff, strike_price: String(strike), option_type: "put",
    expiration_date: "2026-10-16", executions: state === "filled" ? [{ price: String(px), quantity: "1", timestamp: created }] : [] }] });
const MSFT_DAY = () => [
  o26("e1", "2026-10-09T13:41:34Z", 522.5, "open", 5.25), o26("x1", "2026-10-09T14:10:06Z", 522.5, "close", 3.75),
  o26("e2", "2026-10-09T14:36:24Z", 527.5, "open", 4.00), o26("x2", "2026-10-09T14:46:44Z", 527.5, "close", 3.20)];
function r26(iso = "2026-10-09T15:00:00Z", limits: any = {}) {
  reset(); setNow(iso); (M as any).clearCacheForTest();
  T.otto_settings = [{ key: "limits", value: { live_coach_call: true, live_coach_level: true, live_jarvis: true, size_cap_pct: 30, ...limits } }];   // v3.27: every source may go live here, so these tests still prove the kill-switch / size-cap paper path       // v3.26 defaults: size cap 30% ON, kill switch ON
  T.otto_activity = []; T.otto_jason = [];
}
const port = (v: number, bp = v) => (tool: string) => tool === "get_portfolio" ? { data: { total_value: String(v), buying_power: { buying_power: String(bp) } } } : null;

Deno.test("v3.26 limits: tightening works now; loosening waits for the next trading day 9:30 AM (3 ways)", async () => {
  r26("2026-10-09T15:00:00Z"); callHook = port(936.18);
  // 1. tighten: size cap 30 → 25 now
  let L: any = await (M as any).setLimitsForTest({ size_cap_pct: 25, author: "Ifoma" }, "ottotrader@x");
  assert(L.size_cap_pct === 25 && !L.pending?.changes?.size_cap_pct, "tightened now: " + JSON.stringify(L.pending));
  // 2. loosen: cap 25 → 40 and kill switch off → both wait for Mon Oct 12 9:30 AM
  L = await (M as any).setLimitsForTest({ size_cap_pct: 40, kill_on: false, author: "Josh" }, "ottotrader@x");
  assert(L.size_cap_pct === 25 && L.kill_on === true, "still the old values today: " + L.size_cap_pct + " " + L.kill_on);
  assert(L.pending.changes.size_cap_pct === 40 && L.pending.changes.kill_on === false, "waiting: " + JSON.stringify(L.pending));
  assert(L.pending.effective_at === "2026-10-12T13:30:00.000Z" || /2026-10-12T13:30/.test(L.pending.effective_at), "Monday 9:30 AM ET: " + L.pending.effective_at);
  assert(T.otto_activity.some((a: any) => a.kind === "change" && /loosening, starts/.test(a.text) && a.who === "Josh"), "activity: " + JSON.stringify(T.otto_activity));
  // saving another field keeps the waiting change
  L = await (M as any).setLimitsForTest({ max_trades_day: 1, author: "Ifoma" }, "ottotrader@x");
  assert(L.max_trades_day === 1 && L.pending.changes.size_cap_pct === 40, "other save keeps the waiting change: " + JSON.stringify(L.pending));
  // 3. Monday 9:31 AM: it took effect, and the log says so
  setNow("2026-10-12T13:31:00Z"); (M as any).clearCacheForTest();
  L = await M.getLimits();
  assert(L.size_cap_pct === 40 && L.kill_on === false && !L.pending, "took effect Monday: " + JSON.stringify({ c: L.size_cap_pct, k: L.kill_on, p: L.pending }));
  assert(T.otto_activity.some((a: any) => /^Took effect: /.test(a.text)), "logged");
  // before the open on a trading day, a loosening starts at 9:30 the same morning
  assert(/2026-10-13T13:30/.test(M.looseningStarts(new RealDate("2026-10-13T11:00:00Z") as any)), "7 AM Tue → 9:30 Tue");
  assert(M.isLooser("size_cap_pct", 30, 0) && M.isLooser("kill_daily", true, false) && !M.isLooser("weekly_pct", 20, 15) && !M.isLooser("auto_close", true, false), "isLooser");
  assert(M.isLooser("live_jarvis", false, true) && !M.isLooser("live_jarvis", true, false) && !M.isLooser("live_coach_call", true, true), "v3.27 isLooser live_*");
});

Deno.test("v3.26 limits: Cancel change drops the waiting loosening; turning a limit back on is immediate", async () => {
  r26("2026-10-09T15:00:00Z"); callHook = port(936.18);
  await (M as any).setLimitsForTest({ weekly_on: false, author: "Josh" }, "x@y");
  let L: any = await (M as any).setLimitsForTest({ cancel_pending: true, author: "Ifoma" }, "x@y");
  assert(L.weekly_on === true && !(L.pending?.changes?.weekly_on === false), "cancelled: " + JSON.stringify(L.pending));
  assert(T.otto_activity.some((a: any) => /Cancelled the waiting change/.test(a.text) && a.who === "Ifoma"), "logged");
  T.otto_settings[0].value.daily_on = false; (M as any).clearCacheForTest();
  L = await (M as any).setLimitsForTest({ daily_on: true, author: "Ifoma" }, "x@y");
  assert(L.daily_on === true, "turning ON is a tightening — now");
});

Deno.test("v3.26 kill switch: 9 Oct after the 2nd MSFT loss — the next card is a PAPER card (3 ways: daily, weekly, max trades)", async () => {
  r26("2026-10-09T14:51:00Z");
  orders = MSFT_DAY();
  const fit = fakeChain("MSFT", 533.03, 2.5, 1.84, 936.18);
  callHook = (tool: string, args: any) => tool === "get_portfolio" ? { data: { total_value: "936.18", buying_power: { buying_power: "936.18" } } } : fit(tool, args);
  // 1. daily stop (2 losers) — the 10:51 MSFT 537.5C card
  const c: any = await M.proposeAction(optCard("MSFT", "MSFT-2026-10-16-call-537.5", 1.84, "up", 1.2, 536, 532.4), "watcher");
  assert(c.status === "paper", "paper card: " + c.status);
  assert(c.checks[0].paper && /Kill switch on/.test(c.checks[0].text) && /daily stop hit \(2 losing trades/.test(c.checks[0].text), c.checks[0].text);
  assert(!pings.some((p) => p.kind === "card"), "no 'card waiting' ping for a paper card");
  assert(T.otto_activity.filter((a: any) => a.kind === "lock").length >= 1 && pings.filter((p) => p.kind === "lock").length >= 1, "lock logged + pinged");
  const uid = "33333333-3333-3333-3333-333333333333"; T.otto_actions.find((x: any) => x.id === c.id).id = uid;
  const r: any = await M.actOnForTest(uid, "approve", "ottotrader@x");
  assert(r.status === "paper" && !calls.some((x) => x.tool === "place_option_order"), "Approve does nothing on a paper card");
  // the lock is logged once a day, not every card
  (M as any).clearCacheForTest();
  await M.proposeAction(optCard("MSFT", "MSFT-2026-10-16-call-537.5", 1.84, "up", 1.2, 536, 532.4), "desk");
  assert(T.otto_activity.filter((a: any) => a.kind === "lock" && /daily/.test(a.ref)).length === 1, "daily lock logged once");
  // 2. weekly limit alone (daily stop off): −$238 this week
  r26("2026-10-09T14:51:00Z", { daily_on: false, trades_on: false });
  orders = MSFT_DAY();
  callHook = (tool: string, args: any) => tool === "get_realized_pnl" ? { data: { data_points: [{ start_time: "2026-10-09T04:00:00Z", realized_gain: "-238", number_of_trades: 4 }] } }
    : tool === "get_portfolio" ? { data: { total_value: "936.18", buying_power: { buying_power: "936.18" } } } : fit(tool, args);
  const ls: any = await M.lockState(true);
  assert(ls.locked && ls.reasons.length === 1 && ls.reasons[0].kind === "weekly" && /2026-10-12T13:30/.test(ls.until), "weekly lock until Monday: " + JSON.stringify(ls));
  // 3. max trades alone: 2 trades opened, max 2
  r26("2026-10-09T14:51:00Z", { daily_on: false, weekly_on: false });
  orders = MSFT_DAY(); callHook = port(936.18);
  const ls3: any = await M.lockState(true);
  assert(ls3.locked && ls3.reasons[0].kind === "trades", "max trades lock: " + JSON.stringify(ls3));
  // kill switch OFF → the card is pending with red flags (the old behavior)
  r26("2026-10-09T14:51:00Z", { kill_on: false, size_cap_on: false });
  orders = MSFT_DAY(); callHook = (tool: string, args: any) => tool === "get_portfolio" ? { data: { total_value: "936.18", buying_power: { buying_power: "936.18" } } } : fit(tool, args);
  const c4: any = await M.proposeAction(optCard("MSFT", "MSFT-2026-10-16-call-537.5", 1.84, "up", 1.2, 536, 532.4), "watcher");
  assert(c4.status === "pending" && c4.checks.some((x: any) => /DAILY STOP/.test(x.text) && x.ok === false), "flag only when off");
});

Deno.test("v3.26 size cap: the 9:41 MSFT 522.5P ($525 = 45% of $1,166) — cheaper contract named, else paper; a ticket is papered; cap off = flag only", async () => {
  // 1. a contract under the cap exists → Jarvis gets it back by name
  r26("2026-10-09T13:41:00Z");
  let fit = fakeChain("MSFT", 527.37, 2.5, 5.25, 1166.28);
  callHook = (tool: string, args: any) => tool === "get_portfolio" ? { data: { total_value: "1166.28", buying_power: { buying_power: "1166.28" } } } : fit(tool, args);
  let err = "";
  try { await M.proposeAction(optCard("MSFT", "MSFT-2026-10-16-put-522.5", 5.25, "down", 4.2, 520, 532.4), "desk"); } catch (e) { err = (e as Error).message; }
  assert(/Over the size cap: this contract costs \$525 = 45% of the account; the cap is 30% \(\$349\)/.test(err) && /◆ MSFT \d+(\.\d+)?P/.test(err), "bounced with a fitting contract: " + err);
  assert(!T.otto_actions.length, "no card stored");
  // 2. nothing fits (every contract over $349) → paper card, shown + scored, no ping
  r26("2026-10-09T13:41:00Z");
  fit = fakeChain("MSFT", 527.37, 2.5, 30, 1166.28);
  callHook = (tool: string, args: any) => tool === "get_portfolio" ? { data: { total_value: "1166.28", buying_power: { buying_power: "5000" } } } : fit(tool, args);
  // v3.41: nothing fits under the LIVE cap → a PRACTICE card on the $4,000 practice book (Josh answers it), not an auto-reject
  const c: any = await M.proposeAction(optCard("MSFT", "MSFT-2026-10-16-put-522.5", 5.25, "down", 4.2, 520, 532.4), "desk");
  assert(c.status === "paper_wait" && c.checks[0].practice && /PRACTICE · Over the size cap for LIVE: costs \$525 = 45% of the Agentic account, the cap is 30% \(\$349\)/.test(c.checks[0].text) && /\$4,000 practice book/.test(c.checks[0].text), JSON.stringify(c.checks[0]));
  assert(c.plan.practice === true, "plan.practice stamped");
  assert(/📝 Practice card/.test(deskText()) && T.otto_activity.some((a: any) => a.kind === "card" && /Practice card/.test(a.text)), "Desk + Activity");
  // 3. Ifoma's own ticket over the cap → paper, never bounced
  r26("2026-10-09T13:41:00Z");
  callHook = (tool: string, args: any) => tool === "get_portfolio" ? { data: { total_value: "1166.28", buying_power: { buying_power: "1166.28" } } } : fakeChain("MSFT", 527.37, 2.5, 5.25, 1166.28)(tool, args);
  const t: any = await M.proposeAction(optCard("MSFT", "MSFT-2026-10-16-put-522.5", 5.25, "down", 4.2, 520, 532.4), "ottotrader@x", { manual: true });
  assert(t.status === "paper" && !/looked for a cheaper/.test(t.checks[0].text), "ticket papered: " + t.checks[0].text);
  assert(/📄 Auto-rejected — Costs \$525 = 45% of the account\. Your size cap is 30% \(\$349\)\. Shown and scored\./.test(deskText()), "v3.41 wording names the one reason: " + deskText().slice(-300));
  // cap off → pending, the old 20% flag only
  r26("2026-10-09T13:41:00Z", { size_cap_on: false });
  callHook = (tool: string, args: any) => tool === "get_portfolio" ? { data: { total_value: "1166.28", buying_power: { buying_power: "1166.28" } } } : fakeChain("MSFT", 527.37, 2.5, 5.25, 1166.28)(tool, args);
  const p: any = await M.proposeAction(optCard("MSFT", "MSFT-2026-10-16-put-522.5", 5.25, "down", 4.2, 520, 532.4), "desk");
  assert(p.status === "pending" && p.checks.some((x: any) => /45% of the account \(flag above 20%\)/.test(x.text)), "flag only");
});

Deno.test("v3.26 stop sized to the max loss: the 9:41 card's $0.93 stop (−$432) becomes $4.09 (−$116) — 3 ways", () => {
  assert(M.stopForMax(5.25, 0.93, 1, 116) === 4.1, "5.25 / 0.93 / max 116 → " + M.stopForMax(5.25, 0.93, 1, 116));   // nickel step above $3: 4.09 → 4.10
  assert(M.stopForMax(4.0, 2.98, 1, 102) === null, "trade 2's $2.98 stop already fits (−$102)");
  assert(M.stopForMax(2.0, 1.0, 2, 100) === 1.5, "2 contracts: 2.00 − 100/200 = 1.50");
  assert(M.stopForMax(1.0, 0.5, 1, 0) === null, "max off → unchanged");
});

Deno.test("v3.26 Watcher: a 'rejection' needs a TOUCH — the 10:25 and 10:35 MSFT bars (H 532.02 / 532.32 under 532.07 / 532.40) don't fire", () => {
  const t0 = RealDate.parse("2026-10-09T13:30:00Z");
  const mk = (rows: number[][]) => rows.map((r, i) => ({ t: t0 + i * 5 * 60e3, o: r[0], h: r[1], l: r[2], c: r[3] }));
  // a run up away from 532.40, then the 10:35 bar: O 531.70 H 532.32 L 531.24 C 531.57
  const base = [[527, 528, 526.9, 527.4], [527.4, 528, 527, 527.8], [528, 529, 527.8, 528.9], [529, 530, 528.6, 529.4], [529.4, 530.3, 529.2, 529.6], [529.6, 531.6, 529.5, 530.0]];
  const near = mk([...base, [531.7, 532.32, 531.24, 531.57]]);
  const now = t0 + near.length * 5 * 60e3 + 30e3;
  assert(M.evalLevel(532.4, "down", near, 5, { now, earliestMin: 570 }) === null, "no touch → no rejection");
  const touch = mk([...base, [531.7, 532.45, 531.24, 531.57]]);
  const h = M.evalLevel(532.4, "down", touch, 5, { now, earliestMin: 570 });
  assert(h && h.trigger === "rejection", "touched 532.45 and closed red below → rejection: " + JSON.stringify(h));
  // pullback-hold must touch too
  const up = mk([[530, 531, 529.9, 530.8], [530.8, 532, 530.7, 531.9], [531.9, 533, 531.8, 532.9], [532.9, 533.2, 532.5, 533.1], [533.1, 533.3, 532.42, 533.2]]);
  const now2 = t0 + up.length * 5 * 60e3 + 30e3;
  assert(M.evalLevel(532.4, "up", up, 5, { now: now2, earliestMin: 570 }) === null, "low 532.42 doesn't touch 532.40 → no hold");
});

Deno.test("v3.26 fix 1: the coach's level with no direction → NO card from Signals, Watcher both ways; his call → 'Coach's call' (3 ways)", async () => {
  r26("2026-10-09T13:24:00Z", { size_cap_on: false });
  T.otto_jason.push({ id: 87, day: "2026-10-09", posted_at: "2026-10-09T13:23:00Z", kind: "level", ticker: "MSFT", direction: null, level: 532.4, words: "MSFT 532.40 RESISTANCE" });
  T.otto_jason.push({ id: 83, day: "2026-10-09", posted_at: "2026-10-09T13:21:00Z", kind: "call", ticker: "PLTR", direction: "long", level: 201.5, words: "PLTR ABOVE 201.50 TO CHALLENGE HIGHS FROM YESTERDAY." });
  const fit = fakeChain("MSFT", 528.05, 2.5, 2.63, 1166.28);
  callHook = (tool: string, args: any) => tool === "get_portfolio" ? { data: { total_value: "1166.28", buying_power: { buying_power: "1166.28" } } } : fit(tool, args);
  // 1. Signals card on the level → refused, the read is told why
  const card = { ...optCard("MSFT", "MSFT-2026-10-12-put-517.5", 2.63, "down", 1.46, 520, 532.4) }; (card.plan as any).jason_id = 87;
  let err = ""; try { await M.proposeAction(card, "signals"); } catch (e) { err = (e as Error).message; }
  assert(/^NO CARD — the coach posted a level with no direction/.test(err) && /Watcher both ways/.test(err), err);
  // 2. the Watcher list: both ways, coach_dir null
  await (M as any).watchFromSignalsForTest([T.otto_jason[0]]);
  const w = T.otto_watch.find((x: any) => x.ticker === "MSFT");
  assert(w && w.dir === "both" && w.coach_dir === null, "watched both ways: " + JSON.stringify(w));
  // 3. a Watcher card on that level → "Coach's level + Jarvis's direction"; PLTR's own call → "Coach's call"
  setNow("2026-10-09T14:36:00Z"); (M as any).clearCacheForTest();
  const wc = { ...optCard("MSFT", "MSFT-2026-10-14-put-527.5", 4.0, "down", 2.98, 527.5, 532.4) };
  const c: any = await M.proposeAction(wc, "watcher", { planExtra: { source: "signal", trigger: "rejection", watch_id: w.id } });
  assert(c.plan.origin === "coach_level" && c.checks.some((x: any) => /Direction picked by Jarvis — the coach gave a level/.test(x.text)), JSON.stringify(c.checks.slice(0, 3)));
  const fp = fakeChain("PLTR", 202.06, 2.5, 1.0, 1166.28);
  callHook = (tool: string, args: any) => tool === "get_portfolio" ? { data: { total_value: "1166.28", buying_power: { buying_power: "1166.28" } } } : fp(tool, args);
  const pc = { ...optCard("PLTR", "PLTR-2026-10-23-call-210", 1.0, "up", 0.6, 205, 201.5) }; (pc.plan as any).jason_id = 83;
  const p: any = await M.proposeAction(pc, "signals");
  assert(p.plan.origin === "coach_call" && p.checks.some((x: any) => x.ok === true && /coach's own call/.test(x.text)), "coach's call");
});

Deno.test("v3.26 unclear ticker: 'WATCH LITE TO HOLD PHM' → a PHM card gets a red line; one-ticker posts don't", () => {
  assert(/Ticker unclear — the post names LITE and PHM/.test(String(M.unclearTicker("PHM", "WATCH LITE TO HOLD PHM. IF IT DOES. COULD BE NICE BOUNCE. WATCH WIDE SPREAD ALERT"))), "PHM flagged");
  assert(M.unclearTicker("LITE", "WATCH LITE TO HOLD PHM") === null, "first-named ticker is fine");
  assert(M.unclearTicker("PLTR", "PLTR ABOVE 201.50 TO CHALLENGE HIGHS FROM YESTERDAY. BELOW 198.50 WAIT FOR RESET") === null, "one ticker → fine");
  assert(M.unclearTicker("ABBV", "ABBV ABOVE $275.10 = LETS GO. TOOK OFF HALF HERE") === null, "ABBV fine");
});

Deno.test("v3.26 wrong-if alert card moves the SERVER rule (9 Oct 10:40 MSFT 532.40 → 532.07) and warns it's inside the level", async () => {
  r26("2026-10-09T14:40:00Z");
  T.otto_actions.push({ id: "11111111-1111-1111-1111-111111111111", title: "SCALP · MSFT 527.5P 10/14 @ $4.00", status: "done", created_at: "2026-10-09T14:35:43Z",
    plan: { stop: 532.4, direction: "down", tv_symbol: "NASDAQ:MSFT" },
    exit: { state: "armed", option_id: "msft-527.5p", tv_symbol: "NASDAQ:MSFT", direction: "down", wrong_if: 532.4, wrong_tf: 5, tp1: 527.5, log: [] } });
  const id = "22222222-2222-2222-2222-222222222222";
  T.otto_actions.push({ id, title: "Update MSFT wrong-if: 532.40 → 532.07", status: "pending", created_at: "2026-10-09T14:40:31Z",
    calls: [{ service: "tv", tool: "mcp-tv-update-alert", args: { name: "Otto Rules 10/09 – MSFT 532.07 – wrong-if", message: "MSFT 5-min close above 532.07" } }] });
  await M.actOnForTest(id, "approve", "ottotrader@x");
  const ex = T.otto_actions[0].exit;
  assert(ex.wrong_if === 532.07 && ex.wrong_set_at, "server rule moved: " + JSON.stringify(ex));
  assert(/inside the card's own level \(532\.4\)/.test(deskText()), deskText());
  assert(T.otto_activity.some((a: any) => a.kind === "change" && /MSFT wrong-if 532\.4 → 532\.07 \(server rule moved\)/.test(a.text)), JSON.stringify(T.otto_activity));
  assert(M.wrongIfFromAlertArgs({ name: "Otto Rules 10/09 – NVDA 233.92 – TP1" }) === null, "a TP1 alert is not a wrong-if");
});

Deno.test("v3.26 Jarvis's numbers: '$7.43 below', 'in the money', 'shed $3 overnight', 'already closed' corrected; true lines kept", () => {
  const f: any = M.dayFacts([o26("e2", "2026-10-09T14:36:24Z", 527.5, "open", 4.00)]);    // MSFT 527.5P open
  const px = { MSFT: 530.93 };
  const a = M.checkClaims326("Price: MSFT $530.93 — still $7.43 below the 532.40 resistance.", f, px);
  assert(/\$1\.47 below 532\.4, not \$7\.43/.test(a.text), a.text);
  const b = M.checkClaims326("The MSFT 527.5P put is in the money direction.", f, px);
  assert(/OUT of the money — MSFT is 530\.93, above the 527\.5 strike/.test(b.text), b.text);
  const c = M.checkClaims326("The MSFT put has shed $5.00 from yesterday's close ($8.85 → $3.85).", f, px);
  assert(/bought today .* for \$4\.00 — there is no overnight move/.test(c.text), c.text);
  const d = M.checkClaims326("Robinhood shows no open position on the MSFT 527.5P — it's already closed.", f, px);
  assert(/still OPEN/.test(d.text), d.text);
  const ok = M.checkClaims326("MSFT is $1.47 below 532.40. The 527.5P is out of the money.", f, px);
  assert(ok.text === "MSFT is $1.47 below 532.40. The 527.5P is out of the money." && !ok.notes.length, "true lines untouched: " + ok.text);
});

Deno.test("v3.26 Activity: 'outside Otto' catches the 10:27 PLTR cancel in the app; Otto's own cancels and the 4 PM expiry don't count", async () => {
  r26("2026-10-09T15:00:00Z");
  orders = [
    { ...o26("p1", "2026-10-09T14:26:31Z", 210, "open", 3.55, "cancelled"), chain_symbol: "PLTR", updated_at: "2026-10-09T14:27:09Z" },
    { ...o26("s1", "2026-10-09T14:36:28Z", 527.5, "close", 0, "cancelled"), updated_at: "2026-10-09T14:45:52Z" },
    { ...o26("s2", "2026-10-09T14:46:03Z", 527.5, "close", 0, "cancelled"), updated_at: "2026-10-09T20:00:05Z" },     // expired at the close
    { ...o26("u1", "2026-10-09T14:50:00Z", 530, "open", 2.0, "filled"), placed_agent: "user" }];
  await (M as any).noteOttoCancel("s1");             // Otto's close card cancelled its stop
  const r: any = await M.outsideSweep("2026-10-09");
  const out = T.otto_activity.filter((a: any) => a.kind === "outside").map((a: any) => a.text);
  assert(out.length === 2 && out.some((t: string) => /PLTR 210P? .*cancelled outside Otto .*10:27 AM/.test(t)) && out.some((t: string) => /placed outside Otto \(user\)/.test(t)), JSON.stringify(out));
  await M.outsideSweep("2026-10-09");
  assert(T.otto_activity.filter((a: any) => a.kind === "outside").length === 2, "logged once each");
  assert(M.deskKind("⚠ SCALP: the protective stop at $2.98 could not be placed") === "break" && M.deskKind("✓ Close MSFT 527.5P — done (approved by x)") === "trade" && M.deskKind("Guardrails updated by Ifoma") === null, "deskKind");
  void r;
});

Deno.test("v3.26 Coaches Corner: MSFT 532.40 scored both ways; ABBV exits at his 'took off half' post; real option P&L when we had the contract", async () => {
  const t0 = RealDate.parse("2026-10-09T13:30:00Z");
  const bars = (rows: number[][]) => rows.map((r, i) => ({ t: t0 + i * 5 * 60e3, o: r[0], h: r[1], l: r[2], c: r[3] }));
  // MSFT: never rejected at 532.40 (no touch-and-close-below), broke above at bar 15 (10:45–10:50) and held
  const ms: number[][] = []; let p = 527;
  for (let i = 0; i < 14; i++) { ms.push([p, p + 0.6, p - 0.3, p + 0.35]); p += 0.35; }
  ms.push([531.9, 532.3, 531.6, 532.2], [532.3, 533.3, 532.25, 533.02], [533, 533.5, 532.9, 533.4]);
  for (let i = 0; i < 70; i++) ms.push([533.4, 533.8, 533.0, 533.4]);
  const end = t0 + 390 * 60e3;
  const held = M.ccSide({ side: "down", postAt: RealDate.parse("2026-10-09T13:23:00Z"), level: 532.4, bars: bars(ms), endAt: end });
  const broke = M.ccSide({ side: "up", postAt: RealDate.parse("2026-10-09T13:23:00Z"), level: 532.4, bars: bars(ms), endAt: end });
  assert(held.state === "no_entry", "puts side never triggered: " + JSON.stringify(held));
  assert(broke.state === "win" && broke.entry_px === 533.02, "calls side: broke 532.40 at 10:50 and held: " + JSON.stringify(broke));
  // ABBV long above 275.10 → exit at his 9:58 post
  const ab = bars([[270.4, 274.7, 270.4, 273.8], [274, 274.6, 273.5, 274.4], [274.7, 275.4, 274.2, 275.3], [275.2, 275.9, 275.07, 275.75], [275.9, 276.6, 275.1, 275.13], [275.13, 275.9, 275.0, 275.8]]);
  const s = M.ccSide({ side: "up", postAt: RealDate.parse("2026-10-09T13:35:00Z"), level: 275.1, bars: ab, exitAt: RealDate.parse("2026-10-09T13:58:00Z"), endAt: end });
  assert(s.exit_why === "coach's exit post" && s.state === "win", "his exit post: " + JSON.stringify(s));
  assert(M.isExitPost({ words: "ABBV ABOVE $275.10 = LETS GO. TOOK OFF HALF HERE" }) && !M.isExitPost({ words: "MSFT 532.40 RESISTANCE" }), "exit post detection");
  // real option prices: with the card's contract, P&L = (exit − entry) × 100 from Robinhood's option bars
  r26("2026-10-09T21:00:00Z");
  T.otto_jason.push({ id: 87, day: "2026-10-09", posted_at: "2026-10-09T13:23:00Z", posted_label: "9:23 AM", kind: "level", ticker: "MSFT", direction: null, level: 532.4, words: "MSFT 532.40 RESISTANCE" });
  T.otto_actions.push({ id: "c-up", title: "SCALP · Buy 1 MSFT 537.5C 10/12 @ $1.84", status: "rejected", created_at: "2026-10-09T14:51:00Z",
    plan: { direction: "up", tp1: 536, watch_id: 9, jason_id: 87 }, exit: { option_id: "msft-537.5c" } });
  T.otto_watch.push({ id: 9, day: "2026-10-09", ticker: "MSFT", level: 532.4, source: "signal", source_ref: "87" });
  callHook = (tool: string, args: any) => {
    if (tool === "get_equity_historicals") return { data: { results: [{ symbol: "MSFT", bars: ms.map((r, i) => ({ begins_at: new RealDate(t0 + i * 5 * 60e3).toISOString(), open_price: r[0], high_price: r[1], low_price: r[2], close_price: r[3] })) }] } };
    if (tool === "get_option_historicals") return { data: { results: [{ bars: ms.map((r, i) => ({ begins_at: new RealDate(t0 + i * 5 * 60e3).toISOString(), open_price: 1, high_price: 1, low_price: 1, close_price: i < 16 ? 1.84 : 2.40 })) }] } };
    return null;
  };
  const cc: any = await M.coachCorner("today");
  const row = cc.posts.find((x: any) => x.ticker === "MSFT");
  const up = row.cc.sides.find((x: any) => x.side === "up");
  assert(up.opt && up.est === false && up.pnl === 56, "real option P&L 1.84 → 2.40 = +$56: " + JSON.stringify(up));
  assert(row.cards[0].we === "passed" && row.type === "level", JSON.stringify(row.cards));
  assert(T.otto_jason[0].cc?.state === "scored", "saved once the day is done");
});

Deno.test("v3.27: a source that is not switched on to go LIVE becomes a PAPER card (never approvable); the manual ticket is unaffected", async () => {
  reset(); (M as any).clearCacheForTest(); T.otto_settings = [{ key: "limits", value: { size_cap_on: false, kill_on: false } }];   // defaults: only the coach's call may go live
  const c: any = await M.proposeAction(spyCard(), "watcher");
  assert(c.status === "paper_wait", "jarvis/watcher idea is a practice card by default (v3.35: waits for Josh): " + c.status);
  assert(c.checks.some((x: any) => x.practice && !x.paper && /PRACTICE/.test(x.text) && /nothing is ever sent to Robinhood/.test(x.text)), JSON.stringify(c.checks));
  T.otto_actions = []; (M as any).clearCacheForTest();
  T.otto_settings = [{ key: "limits", value: { size_cap_on: false, kill_on: false, live_coach_call: true, live_coach_level: true, live_jarvis: true } }];
  const d: any = await M.proposeAction(spyCard(), "watcher");
  assert(d.status === "pending", "switched on, so it can be approved: " + d.status);
  T.otto_actions = []; (M as any).clearCacheForTest();
  T.otto_settings = [{ key: "limits", value: { size_cap_on: false, kill_on: false } }];
  const m: any = await M.proposeAction(spyCard(), "ottotrader@vinecreativestudio.com", { manual: true });
  assert(m.status === "pending", "manual ticket is not paper: " + m.status);
});

/* =============================== v3.33 CLOSE NOW (Ifoma + Josh, 14 Oct 2026) =============================== */
const CN_NOW = "2026-10-14T14:43:00Z";   // 10:43 AM ET Wednesday
const cnPos = (tool: string, args: any) => tool === "get_option_positions"
  ? { data: { positions: [{ type: "long", quantity: "1", option_id: OPT, chain_symbol: "AAPL", expiration_date: "2026-10-17" }] } } : null;
const cnBuy = () => ({ id: "buy-aapl", state: "filled", chain_symbol: "AAPL", legs: [{ option_id: OPT, side: "buy", position_effect: "open", strike_price: "350.0000", option_type: "call", expiration_date: "2026-10-17",
  executions: [{ price: "1.45", quantity: "1", timestamp: "2026-10-14T14:21:10Z" }] }] });
const cnBars = [["14:00", 349.9, 350.1, 349.6, 349.8], ["14:10", 349.8, 350.3, 349.7, 350.2], ["14:20", 350.2, 350.5, 350.0, 350.1], ["14:30", 350.1, 351.0, 350.0, 350.9], ["14:40", 350.9, 351.2, 350.6, 350.95]] as [string, number, number, number, number][];
const cnRh: any = (() => { const r: any = toRh("AAPL", cnBars); r.bars = r.bars.map((b: any) => ({ ...b, begins_at: String(b.begins_at).replace("2026-10-06", "2026-10-14") })); r.interval = "10minute"; return r; })();
const cnHook = (extra?: (t: string, a: any) => any) => (tool: string, args: any) => {
  const e = extra && extra(tool, args); if (e) return e;
  const p = cnPos(tool, args); if (p) return p;
  if (tool === "get_option_quotes") return { data: { results: [{ quote: { bid_price: "1.62", ask_price: "1.66", updated_at: "2026-10-14T14:42:50Z" } }] } };
  if (tool === "get_equity_historicals" && (args.symbols || []).includes("AAPL")) return { data: { results: [cnRh] } };
  return null;
};
const cnSells = () => orders.filter((o) => o.type === "market" && o.legs[0].side === "sell");

Deno.test("v3.33 Close Now: trade_live shows the open trade with a fresh sell price, the entry from the fill, the card's lines and bars — and writes nothing", async () => {
  reset(); setNow(CN_NOW); (M as any).clearCacheForTest();
  orders.push(cnBuy());
  T.otto_actions.push({ ...armed("AAPL", "up", 349.2, 352.4, "2026-10-14T14:21:30Z", 10), id: "card-aapl" });
  callHook = cnHook();
  const j: any = await M.tradeLive();
  assert(j.ok && j.rth === true && j.trades.length === 1, "one trade: " + JSON.stringify(j).slice(0, 300));
  const t = j.trades[0];
  assert(t.label === "AAPL 350C" && t.qty === 1 && t.entry === 1.45 && t.entry_src === "orders", "label/entry " + JSON.stringify([t.label, t.entry, t.entry_src]));
  assert(t.bid === 1.62 && t.est_pnl === 17, "estimate is (sell price now − paid) × 100: " + t.est_pnl);
  assert(t.plan && t.plan.wrong_if === 349.2 && t.plan.tp1 === 352.4 && t.plan.card_id === "card-aapl", "card lines " + JSON.stringify(t.plan));
  assert(t.bars.length === 5 && t.under === 350.95 && t.under_entry === 350.2, "bars/under " + t.bars.length + " " + t.under + " " + t.under_entry);
  assert(!calls.some((c) => /place_|cancel_/.test(c.tool)), "read-only: no order calls");
  assert(T.otto_actions.length === 1 && T.otto_desk.length === 0, "wrote nothing");
});

Deno.test("v3.33 Close Now: the card's own fill price wins over the order lookup; no card = still works (no plan lines)", async () => {
  reset(); setNow(CN_NOW); (M as any).clearCacheForTest();
  orders.push(cnBuy());
  const a: any = armed("AAPL", "up", 349.2, 352.4, "2026-10-14T14:21:30Z", 10); a.exit.fill_price = 1.5; T.otto_actions.push(a);
  callHook = cnHook();
  let t: any = (await M.tradeLive() as any).trades[0];
  assert(t.entry === 1.5 && t.entry_src === "card" && t.est_pnl === 12, "card fill: " + JSON.stringify([t.entry, t.entry_src, t.est_pnl]));
  T.otto_actions = [];
  t = (await M.tradeLive() as any).trades[0];
  assert(t.plan === null && t.entry === 1.45, "no card: " + JSON.stringify([t.plan, t.entry]));
});

Deno.test("v3.33 Close Now: no position → no trades; quote or bars failing → the trade still shows with unavailable numbers", async () => {
  reset(); setNow(CN_NOW); (M as any).clearCacheForTest();
  callHook = (tool: string) => tool === "get_option_positions" ? { data: { positions: [] } } : null;
  const none: any = await M.tradeLive();
  assert(none.ok && none.trades.length === 0, "none: " + JSON.stringify(none));
  reset(); setNow(CN_NOW); (M as any).clearCacheForTest(); orders.push(cnBuy());
  callHook = (tool: string, args: any) => { const p = cnPos(tool, args); if (p) return p; if (tool === "get_option_quotes" || tool === "get_equity_historicals") throw new Error("boom"); return null; };
  const bad: any = await M.tradeLive();
  const t = bad.trades[0];
  assert(bad.ok && t && t.bid === null && t.est_pnl === null && t.bars.length === 0 && /boom/.test(t.quote_error), "degrades: " + JSON.stringify(t).slice(0, 300));
});

Deno.test("v3.33 Close Now: a person's press sells it all at market, cancels the stop first, works with Auto-close OFF and with no card rule met, and is written to the Desk", async () => {
  reset(); setNow(CN_NOW); (M as any).clearCacheForTest();
  T.otto_settings = [{ key: "limits", value: { auto_close: false, size_cap_on: false, kill_on: false } }];
  orders.push(cnBuy());
  orders.push({ id: "stop-1", state: "confirmed", type: "stop_market", legs: [{ option_id: OPT, side: "sell", position_effect: "close" }] });
  T.otto_actions.push({ ...armed("AAPL", "up", 349.2, 352.4, "2026-10-14T14:21:30Z", 10), id: "card-aapl" });
  callHook = cnHook((tool, args) => tool === "get_option_orders" && args.order_id && args.order_id !== "stop-1"
    ? { data: { orders: [{ id: args.order_id, state: "filled", legs: [{ executions: [{ price: "1.61", quantity: "1" }] }] }] } } : null);
  const r: any = await M.closeByButton({ option_id: OPT, author: "Josh" }, "ottotrader@vinecreativestudio.com");
  assert(r.ok && r.state === "filled" && r.fill_px === 1.61 && r.entry_px === 1.45 && r.pnl === 16 && r.qty === 1, "result " + JSON.stringify(r));
  const order = calls.map((c) => c.tool);
  assert(order.indexOf("cancel_option_order") >= 0 && order.indexOf("cancel_option_order") < order.lastIndexOf("place_option_order"), "stop cancelled before the sell: " + order.join(","));
  const sells = cnSells();
  assert(sells.length === 1 && sells[0].legs[0].position_effect === "close" && sells[0].legs[0].option_id === OPT, "one market close order");
  const row = T.otto_actions.find((x: any) => x.decided_by === "Josh (Close Now button)");
  assert(row && row.status === "done" && row.created_by === "Josh" && /Close 1 AAPL option/.test(row.title), "done card " + JSON.stringify(row));
  assert(/Josh closed \(Close Now button\)/.test(deskText()) && !/Auto-close is on/.test(deskText()), "Desk line:\n" + deskText());
});

Deno.test("v3.33 Close Now: market closed → refused, nothing sent; no position → refused; second press while one is running → only one sell", async () => {
  reset(); setNow("2026-10-14T21:00:00Z");   // 5:00 PM ET
  callHook = cnHook();
  const shut: any = await M.closeByButton({ option_id: OPT, author: "Josh" }, "x");
  assert(!shut.ok && /Market is closed/.test(shut.error) && cnSells().length === 0, "closed: " + JSON.stringify(shut));
  reset(); setNow(CN_NOW); (M as any).clearCacheForTest();
  callHook = (tool: string) => tool === "get_option_positions" ? { data: { positions: [] } } : null;
  const flat: any = await M.closeByButton({ option_id: OPT, author: "Josh" }, "x");
  assert(!flat.ok && /No long position/.test(flat.error) && cnSells().length === 0, "flat: " + JSON.stringify(flat));
  const nothing: any = await M.closeByButton({}, "x");
  assert(!nothing.ok, "needs a trade");
  reset(); setNow(CN_NOW); (M as any).clearCacheForTest(); orders.push(cnBuy()); callHook = cnHook();
  const [a, b]: any[] = await Promise.all([M.closeByButton({ option_id: OPT, author: "Josh" }, "x"), M.closeByButton({ option_id: OPT, author: "Josh" }, "x")]);
  assert([a, b].filter((x) => x.ok).length === 1 && [a, b].some((x) => /already running/.test(x.error || "")), "one wins: " + JSON.stringify([a, b]).slice(0, 300));
  assert(cnSells().length === 1, "exactly one sell order: " + cnSells().length);
});

Deno.test("v3.33 Close Now: Jarvis's own auto-close is unchanged — still refused without a card rule (human flag does not leak)", async () => {
  reset(); setNow("2026-10-14T14:43:00Z");
  callHook = cnHook();
  T.otto_actions.push({ ...armed("AAPL", "up", 349.2, 352.4, "2026-10-14T14:21:30Z", 10), id: "card-aapl" });
  let err = "";
  try { await (M as any).closeNowForTest({ option_id: OPT, reason: "the tape stopped working, closing it" }, "auto-review"); } catch (e) { err = (e as Error).message; }
  assert(/Not closed — none of the card's exits is met/.test(err) && cnSells().length === 0, "refused: " + err);
});

Deno.test("v3.33 Close Now: if the sell fails after the stop was cancelled, the answer says plainly that no stop is on the trade (never silent)", async () => {
  reset(); setNow(CN_NOW); (M as any).clearCacheForTest();
  orders.push(cnBuy());
  orders.push({ id: "stop-9", state: "confirmed", type: "stop_market", legs: [{ option_id: OPT, side: "sell", position_effect: "close" }] });
  callHook = cnHook((tool, args) => {
    if (tool === "cancel_option_order") { orders = orders.filter((o) => o.id !== args.order_id); return {}; }
    if (tool === "place_option_order" && args.type === "market") throw new Error("API error 400: market is halted");
    return null;
  });
  const r: any = await M.closeByButton({ option_id: OPT, author: "Josh" }, "x");
  assert(!r.ok && /market is halted/.test(r.error) && /no stop order on it right now/.test(r.error), "warns: " + JSON.stringify(r));
  assert(cnSells().length === 0, "nothing sold");
  assert(!T.otto_actions.some((a: any) => a.decided_by === "Josh (Close Now button)"), "no 'done' card for a sell that failed");
  // and when the stop is still there, no false alarm
  reset(); setNow(CN_NOW); (M as any).clearCacheForTest();
  orders.push(cnBuy());
  callHook = cnHook((tool, args) => tool === "place_option_order" && args.type === "market" ? (() => { throw new Error("API error 400: market is halted"); })() : null);
  orders.push({ id: "stop-10", state: "confirmed", type: "stop_market", legs: [{ option_id: OPT, side: "sell", position_effect: "close" }] });
  callHook = cnHook((tool, args) => {
    if (tool === "cancel_option_order") return {};   // cancel did not take
    if (tool === "place_option_order" && args.type === "market") throw new Error("API error 400: market is halted");
    return null;
  });
  const r2: any = await M.closeByButton({ option_id: OPT, author: "Josh" }, "x");
  assert(!r2.ok && !/no stop order/.test(r2.error), "no false alarm when a stop is still on: " + r2.error);
});


/* =============================== v3.35 PRACTICE CARDS NEED JOSH'S APPROVE (Ifoma, 15 Oct 2026) =============================== */
const practiceHook = (ask: string | null) => (tool: string, args: any) => {
  if (tool === "get_option_quotes") return ask ? { data: { results: [{ quote: { ask_price: ask, bid_price: "3.40", delta: "0.31" } }] } } : { data: { results: [] } };
  if (tool === "get_equity_quotes") return { data: { results: [{ quote: { symbol: "SPY", last_trade_price: "780.25" } }] } };
  return null;
};
async function practiceCard(who = "watcher") {
  reset(); (M as any).clearCacheForTest(); setNow("2026-10-06T15:51:00Z");
  T.otto_settings = [{ key: "limits", value: { size_cap_on: false, kill_on: false } }];
  const c: any = await M.proposeAction(spyCard(), who);
  const uid = "35353535-3535-4535-8535-353535353535"; T.otto_actions[0].id = uid; c.id = uid;   // the server wants a UUID
  return c;
}
Deno.test("v3.35: Josh approves a practice card: pretend fill = the live ask at the tap, nothing goes to Robinhood, the idea is re-scored from the tap", async () => {
  const c = await practiceCard();
  assert(c.status === "paper_wait" && c.title.startsWith("PAPER — "), "waits for Josh: " + c.status);
  T.otto_actions[0].outcome = { state: "loss", pnl_est: -90 };   // graded while it waited: must be cleared by the tap
  callHook = practiceHook("3.60"); (M as any).clearCacheForTest(); setNow("2026-10-06T15:58:00Z");
  const r: any = await M.actOnForTest(c.id, "approve", "josh@x");
  assert(r.status === "paper_taken" && r.decided_by === "josh@x", "taken: " + r.status);
  const pf = r.plan.paper_fill;
  assert(pf.ask === 3.6 && pf.delta === 0.31 && pf.underlying === 780.25 && pf.by === "josh@x" && pf.at, JSON.stringify(pf));
  assert(r.outcome === null, "old grade cleared so it is scored from the tap");
  assert(!calls.some((x) => /^place_|cancel_/.test(x.tool)) && orders.length === 0, "no order tool touched: " + calls.map((x) => x.tool).join(","));
  assert(/Practice trade taken/.test(deskText()) && /Nothing was sent to Robinhood/.test(deskText()), deskText());
  const again: any = await M.actOnForTest(c.id, "approve", "josh@x");
  assert(again.status === "paper_taken", "a second tap does nothing more");
});
Deno.test("v3.35: Reject a practice card = rejected; a card past 20 minutes cannot be approved (expired); no order either way", async () => {
  const c = await practiceCard();
  const r: any = await M.actOnForTest(c.id, "reject", "josh@x");
  assert(r.status === "rejected" && r.decided_by === "josh@x", r.status);
  const d = await practiceCard();
  T.otto_actions[0].created_at = new RealDate(NOW - 21 * 60e3).toISOString();
  const e: any = await M.actOnForTest(d.id, "approve", "josh@x");
  assert(e.status === "expired", "late approve: " + e.status);
  assert(!calls.some((x) => /^place_/.test(x.tool)) && orders.length === 0, "no order");
});
Deno.test("v3.35: no quote at the tap = Approve still works, fills at the card's price and says so", async () => {
  const c = await practiceCard();
  callHook = practiceHook(null);
  const r: any = await M.actOnForTest(c.id, "approve", "josh@x");
  assert(r.status === "paper_taken", r.status);
  assert(r.plan.paper_fill.ask === 3.5 && /card's price/.test(r.plan.paper_fill.note || ""), JSON.stringify(r.plan.paper_fill));
});
Deno.test("v3.35: safety paper cards (kill switch, size cap, late coach call) stay auto-rejected and cannot be approved; a switched-on source is still a LIVE pending card", async () => {
  reset(); (M as any).clearCacheForTest(); setNow("2026-10-06T15:51:00Z");
  T.otto_settings = [{ key: "limits", value: { size_cap_on: true, size_cap_pct: 5, kill_on: false, live_jarvis: true } }];
  // v3.41: the size cap no longer makes an unapprovable card — it becomes a practice card (the kill switch still does; see the v3.26 lock tests)
  const c: any = await M.proposeAction(spyCard(), "watcher");
  assert(c.status === "paper_wait" && c.checks[0].practice && /Over the size cap for LIVE/.test(c.checks[0].text), "size cap → practice: " + c.status + " " + JSON.stringify(c.checks[0]));
  T.otto_actions[0].id = "36363636-3636-4636-8636-363636363636";
  const r: any = await M.actOnForTest("36363636-3636-4636-8636-363636363636", "approve", "josh@x");
  assert(r.status === "paper_taken" && !calls.some((x) => /^place_/.test(x.tool)), "Josh can take it on paper, nothing to Robinhood: " + r.status);
  reset(); (M as any).clearCacheForTest(); setNow("2026-10-06T15:51:00Z");
  T.otto_settings = [{ key: "limits", value: { size_cap_on: false, kill_on: false, live_jarvis: true } }];
  const l: any = await M.proposeAction(spyCard(), "watcher");
  assert(l.status === "pending" && l.title.startsWith("LIVE — "), "live path unchanged: " + l.status);
});
Deno.test("v3.35: a waiting practice card blocks a duplicate on the same ticker + direction; the practice ping goes out", async () => {
  const c = await practiceCard("ottotrader@vinecreativestudio.com");
  assert(pings.some((p) => p.kind === "card" && /Practice card waiting/.test(p.title)), "ping: " + JSON.stringify(pings));
  let msg = ""; try { await M.proposeAction(spyCard(), "watcher"); } catch (e) { msg = (e as Error).message; }
  assert(/card is already up/.test(msg), "duplicate refused: " + msg);
  assert(T.otto_actions.length === 1, "only one card");
});
Deno.test("v3.35: the practice trade is graded from Josh's tap (not from when Jarvis made the card), on the tap's entry price and ask", async () => {
  const c = await practiceCard();
  callHook = practiceHook("3.60"); (M as any).clearCacheForTest(); setNow("2026-10-06T15:58:00Z");
  await M.actOnForTest(c.id, "approve", "josh@x");
  const row = T.otto_actions[0];
  // 5-minute bars: a spike to the target BEFORE the tap (15:55 UTC), then a drop through the stop AFTER the tap (16:00, 16:05)
  const bar = (iso: string, o: number, h: number, l: number, cl: number) => ({ begins_at: iso, open_price: String(o), high_price: String(h), low_price: String(l), close_price: String(cl) });
  callHook = (tool: string) => tool === "get_equity_historicals" ? { data: { results: [{ symbol: "SPY", interval: "5minute", bars: [
    bar("2026-10-06T15:50:00Z", 780, 785, 779.8, 784), bar("2026-10-06T16:00:00Z", 780.2, 780.4, 777.9, 778.0), bar("2026-10-06T16:05:00Z", 778.0, 778.2, 777.5, 777.8) ] }] } } : null;
  setNow("2026-10-06T16:20:00Z");
  const o: any = await M.evalIdeaForTest(row);
  assert(o.state === "loss" && o.entry === 780.25, "graded after the tap, not a win from the earlier spike: " + JSON.stringify(o));
  assert(o.pnl_est < 0 && o.pnl_est >= -360, "loss capped at the paid ask $3.60 x 100: " + o.pnl_est);
});

Deno.test("v3.42 watcher: cards fire on the 10-minute close only — at 9:45 (5-minute break, 10-minute bar still open) nothing fires; at 9:50 it does; no 10-minute bars = no card", async () => {
  reset(); setNow("2026-10-06T13:45:30Z");
  T.otto_watch.push({ id: 42, day: "2026-10-06", ticker: "SPY", level: 778.6, dir: "up", source: "signal", status: "watching", fired: {} });
  const a: any = await M.watchTick(NOW);
  assert(a.levels === 1 && !(a.hits || []).length, "9:45: the 5-minute fire is gone: " + JSON.stringify(a));
  assert(M.WATCH_TF === 10, "WATCH_TF is 10");
  setNow("2026-10-06T13:50:30Z");
  claudeScript = () => textReply("READ: no card in this test.");
  const b: any = await M.watchTick(NOW);
  assert((b.hits || [])[0] === "SPY 778.6 up break", "9:50: the 10-minute bar fires: " + JSON.stringify(b));
  reset(); setNow("2026-10-06T13:50:30Z"); (M as any).clearCacheForTest();   // the 45-s bar cache would otherwise serve the previous 10-minute bars
  T.otto_watch.push({ id: 43, day: "2026-10-06", ticker: "SPY", level: 778.6, dir: "up", source: "signal", status: "watching", fired: {} });
  const keep = callHook; callHook = (tool: string, args: any) => tool === "get_equity_historicals" && args.interval === "10minute" ? { data: { results: [] } } : null;
  const c: any = await M.watchTick(NOW);
  callHook = keep;
  assert(!(c.hits || []).length, "no 10-minute bars = no card, never a silent 5-minute fallback: " + JSON.stringify(c));
});

/* =============================== v3.44 (22 Oct day review: 5 fixes) =============================== */
// The exact ULTA card from 22 Oct (20cc74a7…, signals, 13:59 UTC): an option title on a STOCK order.
const ultaCard = () => ({
  title: "PAPER – Buy 1 ULTA 625C 10/23 @ $4.40 (Coach Call – Long)", summary: "coach ULTA call 9:58",
  calls: [{ service: "rh", tool: "place_equity_order", args: { side: "buy", type: "limit", symbol: "ULTA", quantity: 1, limit_price: 4.40, time_in_force: "gfd", account_number: "945257012" } }],
  plan: { tv_symbol: "NASDAQ:ULTA", direction: "up", setup: "coach call", tp1: 640, stop: 615, stop_option: 3.0 },
});
Deno.test("v3.44 fix 2: an option-titled card built as a STOCK order is refused before anything is reviewed or stored (ULTA 625C @ $4.40, 22 Oct)", async () => {
  const why = M.optionAsStock(ultaCard());
  assert(why && /buy 1 SHARE of ULTA at \$4\.40/.test(why) && /about \$440, premium × 100/.test(why) && /place_option_order/.test(why), String(why));
  assert(M.optionAsStock({ ...ultaCard(), title: "Buy 1 NVDA 190C 10/10 @ $2.15", plan: null }), "9 Oct NVDA family: the title alone is enough");
  assert(M.optionAsStock({ ...ultaCard(), title: "Buy 1 share", plan: { stop_option: 3 } }), "a plan with an option stop is enough");
  assert(M.optionAsStock({ ...ultaCard(), title: "Buy 5 C @ $50 (Citigroup shares)", plan: null }) === null, "a real stock order (ticker C) is not refused");
  assert(M.optionAsStock(spyCard()) === null, "a real option order is untouched");
  reset(); setNow("2026-10-22T13:59:00Z");
  let err = ""; try { await M.proposeAction(ultaCard(), "signals"); } catch (e) { err = (e as Error).message; }
  assert(/^NO CARD — this card names an option/.test(err), err);
  assert(!T.otto_actions.length, "no card stored");
  assert(!calls.some((c) => /review_|place_/.test(c.tool)), "nothing sent to Robinhood, not even a review: " + calls.map((c) => c.tool).join(","));
});
Deno.test("v4.2.2: an opening option leg with no option_id is refused before anything is stored (AAPL 355C Coach #352, 23 Oct 9:33)", async () => {
  reset(); setNow("2026-10-23T13:33:00Z");
  const bad = spyCard(); bad.title = "Buy 1 AAPL 355C 10/28 @ 2.25 (Coach #352)"; bad.calls[0].args.legs = [{ side: "buy", ratio_quantity: 1, position_effect: "open" }]; bad.calls[0].args.price = "2.25";
  let err = ""; try { await M.proposeAction(bad, "signals"); } catch (e) { err = (e as Error).message; }
  assert(/^NO CARD — the opening leg has no option_id/.test(err) && /get_option_instruments/.test(err), err);
  assert(!T.otto_actions.length, "no card stored");
  assert(!calls.some((c) => /review_|place_/.test(c.tool)), "nothing sent to Robinhood: " + calls.map((c) => c.tool).join(","));
  reset(); setNow("2026-10-06T15:51:00Z");
  const ok: any = await M.proposeAction(spyCard(), "ottotrader@vinecreativestudio.com");
  assert(ok && ok.id, "a leg with option_id still builds");
});
Deno.test("v3.44 fix 3: the server's LIVE/PAPER word wins whatever dash Jarvis used; a non-opening card loses Jarvis's word", () => {
  for (const t of ["PAPER – Buy 1 ULTA 625C", "PAPER - Buy 1 ULTA 625C", "PAPER — Buy 1 ULTA 625C", "PAPER Buy 1 ULTA 625C", "paper:  Buy 1 ULTA 625C", "LIVE – Buy 1 ULTA 625C"])
    assert(M.stampTitle(t, false) === "LIVE — Buy 1 ULTA 625C", `${t} → ${M.stampTitle(t, false)}`);
  assert(M.stampTitle("SCALP · PAPER – CRWV 69C", false) === "LIVE — SCALP · CRWV 69C", M.stampTitle("SCALP · PAPER – CRWV 69C", false));
  assert(M.unstampTitle("PAPER – Sell 10 SPY shares") === "Sell 10 SPY shares", M.unstampTitle("PAPER – Sell 10 SPY shares"));
  assert(M.unstampTitle("Alert: SPY 780 — PAPER – watch") === "Alert: SPY 780 · watch", M.unstampTitle("Alert: SPY 780 — PAPER – watch"));
});
Deno.test("v3.44 fix 3: a live stock-order card titled \"PAPER –\" by Jarvis is stored without the false word", async () => {
  reset(); setNow("2026-10-22T14:30:00Z");
  const c: any = await M.proposeAction({ title: "PAPER – Buy 1 SPY share @ $735", summary: "x",
    calls: [{ service: "rh", tool: "place_equity_order", args: { side: "buy", type: "limit", symbol: "SPY", quantity: 1, limit_price: 735, time_in_force: "gfd" } }], plan: null }, "ottotrader@vinecreativestudio.com");
  assert(c.status === "pending" && c.title === "Buy 1 SPY share @ $735", c.status + " · " + c.title);
});
Deno.test("v3.44 fix 4: two Watcher cards for the same idea 1 s apart (META 632.5P, 22 Oct) → exactly one card stays", async () => {
  reset(); setNow("2026-10-22T18:30:56Z");
  const r = await Promise.allSettled([M.proposeAction(spyCard(), "watcher", { planExtra: { source: "watcher", watch_id: 21 } }), M.proposeAction(spyCard(), "watcher", { planExtra: { source: "watcher", watch_id: 21 } })]);
  const live = T.otto_actions.filter((a) => a.status === "pending"), voided = T.otto_actions.filter((a) => a.status === "expired");
  assert(live.length === 1, "one live card: " + JSON.stringify(T.otto_actions.map((a) => [a.id, a.status, a.decided_by])));
  assert(voided.length === T.otto_actions.length - 1 && voided.every((a) => a.plan.duplicate_of === live[0].id && /^otto \(duplicate of /.test(a.decided_by)), "the other is voided as a duplicate");
  assert(r.filter((x) => x.status === "rejected").length === T.otto_actions.length - 1 && r.every((x) => x.status === "fulfilled" || /already up/.test(String((x as any).reason?.message))), "the loser gets the 'already up' answer");
  assert(M.cardTally(T.otto_actions).made === 1, "a voided duplicate is not counted in the tally");
  const pinged = pings.filter((p) => /Card waiting/.test(p.title)).length;
  assert(pinged <= 1, "no second ping for the duplicate: " + pinged);
  // the pure rule: the oldest wins, ties by id; a different ticker or direction is not a duplicate
  const at = (s: string) => `2026-10-22T18:30:${s}Z`;
  const p = { tv_symbol: "NASDAQ:META", direction: "down" };
  const a = { id: "fd913098", created_at: at("56.1"), status: "paper_wait", plan: p }, b = { id: "77df88fc", created_at: at("57.0"), status: "paper_wait", plan: p };
  const now = RealDate.parse(at("58"));
  assert(M.dupWinner([a, b], b, "META", "down", now)?.id === "fd913098" && M.dupWinner([a, b], a, "META", "down", now) === null, "the 18:30:56 card keeps it");
  assert(M.dupWinner([a, { ...b, plan: { ...p, direction: "up" } }], { ...b, plan: { ...p, direction: "up" } }, "META", "up", now) === null, "calls vs puts are different ideas");
});
Deno.test("v3.44 fix 5: the recap and Jarvis's facts count practice trades as practice, and a reject-with-why as rejected (22 Oct)", () => {
  const c = (title: string, status: string, plan: any = {}) => ({ title, status, plan: { tv_symbol: "NASDAQ:" + (title.match(/\b([A-Z]{2,5}) \d/) || [])[1], ...plan }, result: null, created_at: "2026-10-22T15:00:00Z" });
  const acts = [
    c("PRACTICE — Buy LLY 1325C 10/23", "rejected", { josh_reject_why: { why_not: "chasing the open, no level" } }),
    c("PRACTICE — Buy LLY 1300P 10/23", "rejected", { josh_reject_why: { why_not: "against the bounce at support" } }),
    c("PRACTICE — Buy NVDA 207.5P 10/23", "rejected", { josh_reject_why: { why_not: "three touches at 213, no short" } }),
    c("PRACTICE — Buy META 632.5P 10/26", "paper_taken", { direction: "down", paper_fill: { ask: 1.2 } }),
    c("PRACTICE — Buy META 632.5P 10/26", "expired", { direction: "down", duplicate_of: "fd913098" }),
    c("PRACTICE — Buy TSLA 400C 10/23", "paper_taken", { direction: "up", paper_fill: { ask: 2.1 } }),
    c("LIVE — Buy ULTA 625C 10/23", "expired"), c("PAPER — Buy AMD 230C 10/23", "paper"),
  ];
  const b = M.recapTradesBlock([], acts);
  assert(/Cards: 7 made · 0 approved LIVE · 2 practice trades taken \(no real money\) · 3 rejected \(3 by Josh with a why\) · 1 expired/.test(b), b);
  assert(!/0 approved ·/.test(b.replace("0 approved LIVE", "")), "never a bare '0 approved' next to practice trades");
  const line = M.cardsTodayLine(acts);
  assert(/2 practice trades taken \(META 632\.5P, TSLA 400C; practice fills are never sent to Robinhood/.test(line), line);
  assert(/3 rejected by Josh with a why \(LLY 1325C: "chasing the open, no level"; LLY 1300P/.test(line), line);
  assert(/never \\"pending\\"|never "pending"/.test(M.factsLine({ prep: [], sig: [], ord: null, cards: acts })), "Jarvis is told a rejected card is rejected");
  eq3(M.practiceTargets(acts), [{ sym: "META", strike: 632.5, side: "put" }, { sym: "TSLA", strike: 400, side: "call" }], "practice targets (the voided duplicate is not one)");
});
const eq3 = (a: any, b: any, m: string) => assert(JSON.stringify(a) === JSON.stringify(b), `${m}: ${JSON.stringify(a)} vs ${JSON.stringify(b)}`);
Deno.test("v3.44 fix 5: numberCheck never 'corrects' a practice fill against Robinhood; real claims are still checked", () => {
  const f: any = M.dayFacts([]);
  f.practice = [{ sym: "META", strike: 632.5, side: "put" }];
  const t1 = "META 632.5P filled at $1.20 and is working.";
  const r1 = M.checkTradeClaims(t1, f, 2);
  assert(r1.text === t1 && !r1.notes.length, "practice fill left alone: " + r1.text);
  const t2 = "Josh's practice trade on TSLA filled at $2.10.";
  assert(M.checkTradeClaims(t2, f, 2).text === t2, "a sentence about a practice trade is not a Robinhood claim");
  const t3 = "NVDA 207.5P filled at $1.40.";
  const r3 = M.checkTradeClaims(t3, f, 2);
  assert(/Corrected by Otto: Robinhood shows no NVDA 207\.5P fill today/.test(r3.text), "a real (non-practice) false fill is still corrected: " + r3.text);
});
Deno.test("v3.44 fix 1: the app asks the one-line why on EVERY reject of a waiting card (live or practice); approve keeps the 3-line gate for opening cards", async () => {
  const app = await Deno.readTextFile(new URL("../../index.html", import.meta.url));
  const fn = app.slice(app.indexOf("async function dkCardClick"), app.indexOf("async function dkCardClick") + 2600);
  assert(/const waiting=a\.status==="pending"\|\|a\.status==="paper_wait";/.test(fn), "waiting = pending or paper_wait");
  assert(/if\(no&&waiting\)\{why=await whyAsk\("reject",\{card:a\}\);if\(why==null\)return\}/.test(fn), "reject asks on any waiting card");
  assert(/else if\(ok&&opening\)\{why=await whyAsk\("approve",\{card:a\}\);if\(why==null\)return\}/.test(fn), "approve asks on opening cards");
  assert(!/if\(opening\)\{why=await whyAsk\(ok\?/.test(fn), "the old opening-only gate is gone");
  // and the server side it must match: a live non-opening card's reject with a why goes through; with none it is refused
  reset(); setNow("2026-10-22T14:00:00Z");
  T.otto_actions.push({ id: "20cc74a7-0000-4000-8000-000000000001", title: "LIVE — Buy 1 SPY share", status: "pending", created_at: "2026-10-22T13:59:00Z", calls: [{ service: "rh", tool: "place_equity_order", args: {} }], plan: null });
  let err = ""; try { await M.actOnForTest("20cc74a7-0000-4000-8000-000000000001", "reject", "Josh", null); } catch (e) { err = (e as Error).message; }
  assert(/Why gate: say why not/.test(err) && T.otto_actions[0].status === "pending", "no why → refused (what the app used to hit): " + err);
  const r: any = await M.actOnForTest("20cc74a7-0000-4000-8000-000000000001", "reject", "Josh", "wrong instrument — that is a stock order");
  assert(r.status === "rejected" && T.otto_actions[0].plan.josh_reject_why.why_not === "wrong instrument — that is a stock order", JSON.stringify(r));
});

/* ===================================================================== v5.9 (11 Nov 2026) — OTTOPILOT for Baby J
   Josh or Ifoma switches it on; Baby J then answers his own PRACTICE cards (fill at the ask, his own why), on plan or OFF PLAN,
   until 3 trades / 2 losing trades / 3:00 PM. A LIVE card, the manual ticket and a card he flagged weak are never touched. */
const HOUSE9 = "ottotrader@vinecreativestudio.com";
const ap9 = () => { reset(); (M as any).clearCacheForTest(); T.otto_settings = [{ key: "limits", value: { size_cap_on: false, kill_on: false } }]; setNow("2026-10-06T14:32:00Z"); };   // 10:32 AM ET, only the coach's call may go live
const spyWatch9 = () => T.otto_watch.push({ id: 901, day: "2026-10-06", ticker: "SPY", level: 778.6, dir: "up", status: "watching", created_at: "2026-10-06T13:00:00Z" });
const nvda9 = () => optCard("NVDA", "NVDA-2026-10-16-put-237.5", 4.55, "down", 3.38, 235, 237);
const mu9 = () => optCard("MU", "MU-2026-10-16-put-1075", 3.2, "down", 2.6, 1074, 1082);
const spyPut9 = () => { const c: any = spyCard(); c.plan = { ...c.plan, direction: "down", tp1: 776, stop: 780 }; return c; };
const apRow9 = () => (T.otto_settings.find((r: any) => r.key === "autopilot")?.value?.rooms || {})[HOUSE9] || {};

Deno.test("v5.9 OttoPilot OFF (the default): a practice card waits for Josh exactly as before; the route reports off with the default numbers", async () => {
  ap9();
  const v: any = await (M as any).autopilotRoute(null, HOUSE9);
  assert(v.ok && v.on === false && v.cfg.max_trades === 3 && v.cfg.max_losses === 2 && v.cfg.last_entry_min === 900 && v.trades.length === 0, JSON.stringify(v));
  const c: any = await M.proposeAction(spyCard(), "watcher");
  assert(c.status === "paper_wait" && !c.plan.autopilot && !c.plan.paper_fill, "waits for Josh: " + c.status);
  assert(T.otto_desk.some((d: any) => /waiting for Josh to Approve or Reject/.test(d.content)), "the waiting line is still written");
});

Deno.test("v5.9 OttoPilot ON: Baby J takes his own practice card at the ask with his own why; on plan vs OFF PLAN; no order tool; Josh's why is never faked", async () => {
  ap9(); spyWatch9();
  const on: any = await (M as any).autopilotRoute({ on: true, author: "Josh" }, HOUSE9);
  assert(on.on === true && on.by === "Josh" && on.plan.items.length === 1 && on.plan.items[0].ticker === "SPY" && on.plan.items[0].direction === "up" && on.plan.items[0].src === "watcher", "plan from the Watcher level: " + JSON.stringify(on.plan));
  assert(claudeBodies.length === 0, "no AI call when nobody talked this morning");
  assert(T.otto_desk.some((d: any) => /🛫 OttoPilot ON — switched on by Josh/.test(d.content) && /3 trades, 2 losing trades, or 3:00 PM ET/.test(d.content) && /SPY ▲ 778\.6/.test(d.content) && /LIVE \(real money\) card still waits for a human tap/.test(d.content)), "the ON line: " + T.otto_desk.map((d: any) => d.content).join(" | ").slice(0, 600));
  calls = [];
  const c: any = await M.proposeAction(spyCard(), "watcher");
  assert(c.status === "paper_taken" && c.decided_by === "autopilot", "taken by autopilot: " + c.status + " " + c.decided_by);
  const p = c.plan;
  assert(p.autopilot && p.autopilot.on_plan === true && p.autopilot.n === 1 && p.autopilot.switched_by === "Josh" && p.autopilot.at, "stamp: " + JSON.stringify(p.autopilot));
  assert(/trend continuation on SPY \(calls\)/.test(p.autopilot.why.setup) && /5-minute close below 778\.6/.test(p.autopilot.why.kills) && /target 784\.5/.test(p.autopilot.why.why_now), "Baby J's why from his card: " + JSON.stringify(p.autopilot.why));
  assert(p.why_pending === false && !p.josh_why && !p.override, "not Josh's why, not pending, not an override");
  assert(p.paper_fill && p.paper_fill.by === "autopilot" && p.paper_fill.at, "fill stamped: " + JSON.stringify(p.paper_fill));
  assert(!calls.some((x) => /^place_|cancel_|exercise/.test(x.tool)) && orders.length === 0, "no order tool: " + calls.map((x) => x.tool).join(","));
  assert(T.otto_desk.some((d: any) => /🛫 OttoPilot took a practice trade/.test(d.content) && /On this morning's plan/.test(d.content) && /Nothing was sent to Robinhood/.test(d.content)), "take line");
  assert(!T.otto_desk.some((d: any) => /waiting for Josh to Approve or Reject/.test(d.content)), "no 'waiting for Josh' line for a card OttoPilot took");
  assert(pings.some((x) => /OttoPilot took/.test(x.title) && /1 of 3/.test(x.body)), "push: " + JSON.stringify(pings));
  const c2: any = await M.proposeAction(nvda9(), "watcher");
  assert(c2.status === "paper_taken" && c2.plan.autopilot.on_plan === false && c2.plan.autopilot.n === 2, "NVDA was not in the plan → OFF PLAN: " + JSON.stringify(c2.plan.autopilot));
  assert(T.otto_desk.some((d: any) => /⚠ OFF PLAN/.test(d.content)) && pings.some((x) => /OFF PLAN/.test(x.body)), "off-plan is said out loud");
  const v: any = await (M as any).autopilotRoute(null, HOUSE9);
  assert(v.on && v.trades.length === 2 && v.left === 1 && v.trades[0].on_plan === true && v.trades[1].on_plan === false && v.trades[0].state === "open", "view: " + JSON.stringify(v.trades));
});

Deno.test("v5.9 OttoPilot limits: off by itself at the 3rd trade; the 4th card waits for Josh; it cannot be restarted past the limit", async () => {
  ap9();
  await (M as any).autopilotRoute({ on: true, author: "Ifoma" }, HOUSE9);
  assert(T.otto_desk.some((d: any) => /No plan was made this morning/.test(d.content)), "empty plan is said plainly");
  const a: any = await M.proposeAction(spyCard(), "watcher"), b: any = await M.proposeAction(nvda9(), "watcher"), c: any = await M.proposeAction(mu9(), "signals");
  assert([a, b, c].every((x) => x.status === "paper_taken" && x.plan.autopilot.on_plan === false), "three taken, all off plan: " + [a, b, c].map((x) => x.status).join(","));
  const st = apRow9();
  assert(st.on === false && /trade limit \(3 trades a day\)/.test(st.off.reason) && st.off.by === "Otto", "off at the limit: " + JSON.stringify(st.off));
  const off = T.otto_desk.find((d: any) => /🛬 OttoPilot OFF/.test(d.content));
  assert(off && /OttoPilot took 3 practice trades/.test(off.content) && /OFF PLAN — still open/.test(off.content) && /wait for Josh's Approve or Reject again/.test(off.content), "recap in the off line: " + off?.content);
  assert(pings.some((x) => /switched itself off/.test(x.title)), "push on auto-off");
  const d: any = await M.proposeAction(spyPut9(), "watcher");
  assert(d.status === "paper_wait" && !d.plan.autopilot, "4th waits for Josh: " + d.status);
  let err = ""; try { await (M as any).autopilotRoute({ on: true, author: "Josh" }, HOUSE9); } catch (e) { err = (e as Error).message; }
  assert(/can't start: today already reached the trade limit/.test(err), "no restart past the limit: " + err);
  const up: any = await (M as any).autopilotRoute({ cfg: { max_trades: 5 }, on: true, author: "Ifoma" }, HOUSE9);
  assert(up.on === true && up.cfg.max_trades === 5 && up.left === 1 && up.trades.length === 4, "raising the number lets it start again (and the waiting card is the 4th): " + JSON.stringify(up.cfg) + " left " + up.left);
  assert(T.otto_actions.find((r: any) => r.id === d.id).status === "paper_taken", "the card that was waiting is taken when it is switched on");
});

Deno.test("v5.9 OttoPilot loss stop and last entry time: 2 losing trades or 3:00 PM switch it off; a later card waits for Josh", async () => {
  ap9();
  await (M as any).autopilotRoute({ on: true, author: "Josh" }, HOUSE9);
  const a: any = await M.proposeAction(spyCard(), "watcher"), b: any = await M.proposeAction(nvda9(), "watcher");
  for (const x of [a, b]) T.otto_actions.find((r: any) => r.id === x.id).outcome = { state: "loss", pnl_est: -80 };
  const c: any = await M.proposeAction(mu9(), "watcher");
  assert(c.status === "paper_wait", "after 2 losses the next card is not taken: " + c.status);
  assert(apRow9().on === false && /loss stop \(2 losing trades\)/.test(apRow9().off.reason), "off: " + JSON.stringify(apRow9().off));
  assert(T.otto_desk.some((d: any) => /🛬 OttoPilot OFF/.test(d.content) && /loss −\$80/.test(d.content) && /\(−\$160 on the 2 closed\)/.test(d.content)), "the recap carries the results");
  // the clock: on at 2:50 PM, a card at 3:00 PM is not taken
  ap9(); setNow("2026-10-06T18:50:00Z");
  await (M as any).autopilotRoute({ on: true, author: "Josh" }, HOUSE9);
  setNow("2026-10-06T19:00:00Z");
  const late: any = await M.proposeAction(spyCard(), "watcher");
  assert(late.status === "paper_wait" && /last entry time \(3:00 PM ET\)/.test(apRow9().off.reason), "3:00 PM: " + late.status + " " + JSON.stringify(apRow9().off));
  let err = ""; try { await (M as any).autopilotRoute({ on: true, author: "Josh" }, HOUSE9); } catch (e) { err = (e as Error).message; }
  assert(/last entry time/.test(err), "cannot start after the last entry time: " + err);
  // the score tick switches it off too (nobody has to have the Desk open)
  ap9(); setNow("2026-10-06T18:50:00Z");
  await (M as any).autopilotRoute({ on: true, author: "Josh" }, HOUSE9);
  setNow("2026-10-06T19:01:00Z");
  await M.scoreTick();
  assert(apRow9().on === false && apRow9().off.by === "Otto", "score tick: " + JSON.stringify(apRow9().off));
  // the next day it is off without anyone touching it
  ap9(); await (M as any).autopilotRoute({ on: true, author: "Josh" }, HOUSE9); setNow("2026-10-07T14:32:00Z");
  assert((await (M as any).autopilotRoute(null, HOUSE9)).on === false, "a new day starts off");
  assert((await M.proposeAction(spyCard(), "watcher")).status === "paper_wait", "and cards wait for Josh");
});

Deno.test("v5.9 OttoPilot never touches: a card Baby J flagged weak, a LIVE card, the manual Order ticket", async () => {
  ap9();
  await (M as any).autopilotRoute({ on: true, author: "Josh" }, HOUSE9);
  const weak: any = spyCard(); weak.plan = { ...weak.plan, weak: "This is a chase — the bar already ran past the level." };
  const w: any = await M.proposeAction(weak, "watcher");
  assert(w.status === "rejected" && w.decided_by === "autopilot" && !w.plan.autopilot && !w.plan.paper_fill && /chase/.test(w.plan.autopilot_pass.why) && !w.plan.josh_reject_why, "weak card is PASSED by OttoPilot, never taken, never Josh's reject: " + w.status + " " + JSON.stringify(w.plan.autopilot_pass));
  assert(T.otto_desk.some((d: any) => /OttoPilot passed on this one/.test(d.content) && /chase/.test(d.content) && /does not count as a card Josh missed/.test(d.content)), "and it says why");
  assert(!T.otto_desk.some((d: any) => /waiting for Josh to Approve or Reject/.test(d.content)) && !pings.some((x) => /card waiting/i.test(x.title)), "no 'waiting for Josh' line or ping for it");
  assert((await (M as any).autopilotRoute(null, HOUSE9)).trades.length === 0 && apRow9().on === true, "a pass is not a trade and does not use up the limit");
  const nx: any = await M.proposeAction(nvda9(), "watcher");
  assert(nx.status === "paper_taken" && nx.plan.autopilot.n === 1, "the next clean card is still taken: " + nx.status);
  // LIVE: Jarvis's own ideas switched on to go live → pending, a human tap
  ap9(); T.otto_settings = [{ key: "limits", value: { size_cap_on: false, kill_on: false, live_jarvis: true } }]; (M as any).clearCacheForTest();
  await (M as any).autopilotRoute({ on: true, author: "Josh" }, HOUSE9);
  calls = [];
  const live: any = await M.proposeAction(spyCard(), "watcher");
  assert(live.status === "pending" && !live.plan.autopilot, "a LIVE card waits for a human: " + live.status);
  assert(!calls.some((x) => x.tool === "place_option_order") && orders.length === 0, "nothing placed");
  // the manual ticket is the trader's own
  ap9();
  await (M as any).autopilotRoute({ on: true, author: "Josh" }, HOUSE9);
  const tk: any = await M.proposeAction(spyCard(), HOUSE9, { manual: true });
  assert(tk.status !== "paper_taken" && !tk.plan?.autopilot, "ticket untouched: " + tk.status);
});

Deno.test("v5.9 OttoPilot plan: one AI read of the morning's conversation + the levels; a failed read falls back to the levels and says so; switching off (Ifoma) writes the recap", async () => {
  ap9(); spyWatch9();
  T.otto_desk.push({ id: 1, created_at: "2026-10-06T13:10:00Z", role: "user", author: "Josh", content: "I like MU puts under 1075 today and SPY calls if 778.60 holds." });
  T.otto_desk.push({ id: 2, created_at: "2026-10-06T13:11:00Z", role: "assistant", author: "Jarvis", content: "Agreed. MU short under 1075, SPY long over 778.60." });
  claudeScript = (body: any) => { assert(body.tool_choice?.name === "autopilot_plan" && /I like MU puts under 1075/.test(body.messages[0].content) && /SPY 778\.6 up/.test(body.messages[0].content), "plan prompt: " + JSON.stringify(body.messages[0].content).slice(0, 300));
    return toolReply("autopilot_plan", { summary: "MU puts under 1075; SPY calls over 778.60.", items: [{ ticker: "mu", direction: "down", level: 1075 }, { ticker: "SPY", direction: "up", level: 778.6 }] }); };
  const on: any = await (M as any).autopilotRoute({ on: true, author: "Josh" }, HOUSE9);
  assert(on.plan.items.length === 2 && on.plan.items[0].ticker === "MU" && on.plan.items[0].src === "chat" && on.plan.items[0].level === 1075 && /conversation/.test(on.plan.source) && !on.plan.error, "plan: " + JSON.stringify(on.plan));
  claudeScript = null;
  const m: any = await M.proposeAction(mu9(), "watcher"), n: any = await M.proposeAction(nvda9(), "watcher");
  assert(m.plan.autopilot.on_plan === true && n.plan.autopilot.on_plan === false, "MU on plan, NVDA off plan");
  const off: any = await (M as any).autopilotRoute({ on: false, author: "Ifoma" }, HOUSE9);
  assert(off.on === false && off.off.by === "Ifoma" && /switched off by Ifoma/.test(off.off.reason) && off.trades.length === 2, "off: " + JSON.stringify(off.off));
  assert(T.otto_desk.some((d: any) => /🛬 OttoPilot OFF — switched off by Ifoma/.test(d.content) && /on plan — still open/.test(d.content) && /OFF PLAN — still open/.test(d.content)), "recap");
  assert((await M.proposeAction(spyCard(), "watcher")).status === "paper_wait", "off again: cards wait for Josh");
  // the AI read fails → the levels are the plan
  ap9(); spyWatch9();
  T.otto_desk.push({ id: 1, created_at: "2026-10-06T13:10:00Z", role: "user", author: "Josh", content: "MU puts today." });
  claudeScript = () => new Error("claude HTTP 529 overloaded") as any;
  const on2: any = await (M as any).autopilotRoute({ on: true, author: "Josh" }, HOUSE9);
  assert(on2.on && on2.plan.items.length === 1 && on2.plan.items[0].ticker === "SPY" && /529/.test(on2.plan.error), "fallback: " + JSON.stringify(on2.plan));
  assert(T.otto_desk.some((d: any) => /could not read the conversation just now/.test(d.content)), "and the Desk says so");
});

Deno.test("v5.9 OttoPilot numbers, the Scoreboard line and the pure helpers", async () => {
  ap9();
  for (const [cfg, re] of [[{ max_trades: 0 }, /Trades a day must be between 1 and 10/], [{ max_losses: 11 }, /Losing trades/], [{ last_entry: "16:10" }, /between 9:45 AM and 3:50 PM/]] as any[]) {
    let err = ""; try { await (M as any).autopilotRoute({ cfg, author: "Ifoma" }, HOUSE9); } catch (e) { err = (e as Error).message; }
    assert(re.test(err), "refused " + JSON.stringify(cfg) + ": " + err);
  }
  const v: any = await (M as any).autopilotRoute({ cfg: { max_trades: 2, max_losses: 1, last_entry: "14:30" }, author: "Ifoma" }, HOUSE9);
  assert(v.cfg.max_trades === 2 && v.cfg.max_losses === 1 && v.cfg.last_entry_min === 870 && v.on === false, JSON.stringify(v.cfg));
  assert(T.otto_desk.some((d: any) => /OttoPilot limits set by Ifoma: 2 trades a day, off after 1 losing trade, no new trade from 2:30 PM ET/.test(d.content)), "limits line");
  const S = (M as any).apStop, t = (st: string) => ({ outcome: st === "open" ? null : { state: st, pnl_est: -1 } });
  assert(S({}, [], 600) === "" && /trade limit/.test(S({}, [t("open"), t("win"), t("open")], 600)) && /loss stop/.test(S({}, [t("loss"), t("loss")], 600)) && S({}, [t("loss"), t("win")], 600) === "", "apStop counts");
  assert(/last entry/.test(S({}, [], 900)) && S({}, [], 899) === "" && S({ max_losses: 0 }, [t("loss"), t("loss")], 600) === "", "apStop clock, and 0 = loss stop off");
  const OP = (M as any).apOnPlan;
  assert(OP({ tv_symbol: "NASDAQ:MU", direction: "down" }, [{ ticker: "MU", direction: "down" }]) && !OP({ tv_symbol: "NASDAQ:MU", direction: "up" }, [{ ticker: "MU", direction: "down" }]) && OP({ tv_symbol: "NASDAQ:MU", direction: "up" }, [{ ticker: "mu", direction: "both" }]) && !OP({ tv_symbol: "NASDAQ:MU", direction: "up" }, []), "apOnPlan");
  // the practice book: OttoPilot on its own line, split on / off plan; Josh's trades separate
  const mkA = (id: string, st: string, est: number, ap: any) => ({ id, status: "paper_taken", created_at: "2026-10-21T14:00:00Z", plan: { practice: true, ...(ap ? { autopilot: ap } : { josh_why: { setup: "x" } }) }, outcome: { state: st, pnl_est: est } });
  const ps: any = M.practiceStats([mkA("1", "win", 120, { on_plan: true }), mkA("2", "loss", -70, { on_plan: false }), mkA("3", "loss", -40, { on_plan: false }), mkA("4", "win", 60, null)], { start: 4000, since: "2026-10-20T00:00:00Z" });
  assert(ps.autopilot.n === 3 && ps.autopilot.est === 10 && ps.autopilot.on_plan.n === 1 && ps.autopilot.on_plan.est === 120 && ps.autopilot.off_plan.n === 2 && ps.autopilot.off_plan.losses === 2 && ps.autopilot.off_plan.est === -110, "autopilot line: " + JSON.stringify(ps.autopilot));
  assert(ps.josh.n === 1 && ps.josh.est === 60 && ps.taken === 4 && ps.balance === 4070 && ps.overrides.n === 0, "Josh's own line and the book total: " + JSON.stringify(ps.josh) + " " + ps.balance);
  const rows: any[] = M.scoreRows([mkA("1", "win", 120, { on_plan: true, why: { setup: "s" } }), mkA("2", "loss", -70, { on_plan: false }), mkA("4", "win", 60, null)] as any, {});
  assert(rows[0].autopilot === "plan" && rows[0].ap_why === "s" && rows[1].autopilot === "off" && rows[2].autopilot === null && rows[0].override === false, "scoreboard rows: " + JSON.stringify(rows.map((r) => r.autopilot)));
  // v5.9.2: an OttoPilot pass is not Josh's answer, reject or missed card
  const mkP = (id: string) => ({ id, status: "rejected", created_at: "2026-10-21T14:00:00Z", plan: { practice: true, autopilot_pass: { why: "No Edge banner" } }, outcome: { state: "loss", pnl_est: -90 } });
  const ps2: any = M.practiceStats([mkA("1", "win", 120, { on_plan: true }), mkA("4", "win", 60, null), mkP("5"), { id: "6", status: "rejected", created_at: "2026-10-21T14:00:00Z", plan: { practice: true, josh_reject_why: { why_not: "x" } } }], { start: 4000, since: "2026-10-20T00:00:00Z" });
  assert(ps2.autopilot.passed === 1 && ps2.answered === 3 && ps2.rejected === 1 && ps2.expired === 0 && ps2.offered === 4 && ps2.balance === 4180, "pass kept out of Josh's numbers and out of the book: " + JSON.stringify({ a: ps2.answered, r: ps2.rejected, p: ps2.autopilot.passed, b: ps2.balance }));
  const rw: any[] = M.scoreRows([mkP("5")] as any, {});
  assert(rw[0].autopilot === "pass" && rw[0].ap_why === "No Edge banner", "row: " + JSON.stringify(rw[0].autopilot));
  // v5.9.2: Baby J's why reads the idea, not the cost line (the real 11 Nov AMD and SPY cards)
  const I = (M as any).apIdea;
  const amd = I({ plan: { level: 528 }, summary: "PAPER — Coach Signal long AMD · 1× 542.5C 11/13 @ $9.20 limit · Cost $920, OVER $837.92 buying power (red banner — nothing fits) · Coach's level: bottom of the gap; direction: long (his) · Entry trigger: 10-min candle close confirming hold at gap bottom · Stop: entry candle open violated on 5-min close · TP1: top of gap (Jarvis estimate ~$543–545 on underlying) · stop_option $4.50 (loss ~$470 at stop — OVER $84 max; size flag) · ALL contracts over buying power; cheapest ★ carded per rules." });
  assert(amd === "Coach's level: bottom of the gap; direction: long (his) · Entry trigger: 10-min candle close confirming hold at gap bottom", "AMD idea: " + amd);
  const spy = I({ plan: { level: 755.32 }, summary: "PAPER — Autopilot card (Watcher trigger, Josh away)\n\n── ORDER ──\nUnderlying: SPY @ ~756.33\nContract: SPY 759C 11/12 · 1 contract · limit $1.47\nMax cost: $147 (17.5% of $838 account)\n\n── ENTRY TRIGGER ──\n10-min candle 9:50–10:00 ET closed 756.33 — above Josh's 755.32 buy-side level (▲). Hold confirmed.\n\n── FLAGS ──\n⚠ Banner: NO EDGE (score 0)" });
  assert(/^10-min candle 9:50–10:00 ET closed 756\.33 — above Josh's 755\.32 buy-side level/.test(spy) && !/cost|contract|banner/i.test(spy), "SPY idea: " + spy);
  assert(I({ plan: { level: 700 }, summary: "Cost $300 · limit $3.00" }) === "Built on the 700 level." && I({ plan: {}, summary: "t" }) === "", "fallbacks");
  const wy = (M as any).apWhy({ plan: { tv_symbol: "NASDAQ:AMD", direction: "up", setup: "support bounce", tp1: 544, stop: 525, level: 528, entry_underlying: 528 }, summary: "Cost $920, OVER $837.92 buying power · Coach's level: bottom of the gap" });
  assert(wy.setup === "support bounce on AMD (calls). Coach's level: bottom of the gap" && !/buying power/.test(wy.setup), "why: " + wy.setup);
  // Jarvis is told the truth about what runs on its own
  ap9();
  assert(/OttoPilot: OFF — every practice card waits for Josh/.test(await M.runningNow()), "running list, off");
  await (M as any).autopilotRoute({ on: true, author: "Josh" }, HOUSE9);
  assert(/OttoPilot: ON \(switched on by Josh\) — the SERVER answers your new PRACTICE cards/.test(await M.runningNow()), "running list, on");
});

Deno.test("v5.9 OttoPilot in a member's room: their own practice ideas are taken, their Order ticket is not; the house is not switched on by it", async () => {
  ap9();
  const MEM = "member9@example.com";
  await (M as any).roomRunForTest(MEM, async () => {
    const on: any = await (M as any).autopilotRoute({ on: true, author: "Jay" }, MEM);
    assert(on.on === true && on.by === "Jay", "on in the room: " + JSON.stringify(on).slice(0, 200));
    const tk: any = await M.proposeAction(spyCard(), MEM, { manual: true });
    assert(tk.status === "paper_wait" && !tk.plan.autopilot, "a member's own ticket is a practice card that waits for them: " + tk.status);
    const c: any = await M.proposeAction(nvda9(), "watcher");
    assert(c.status === "paper_taken" && c.plan.autopilot && c.decided_by === "autopilot", "their Baby J idea is taken: " + c.status);
  });
  const rooms = T.otto_settings.find((r: any) => r.key === "autopilot")?.value?.rooms || {};
  assert(rooms[MEM]?.on === true && !rooms[HOUSE9], "only the member's room is on: " + JSON.stringify(Object.keys(rooms)));
  assert((await (M as any).autopilotRoute(null, HOUSE9)).on === false, "the house stays off");
  assert((await M.proposeAction(spyPut9(), "watcher")).status === "paper_wait", "house cards still wait for Josh");
});
