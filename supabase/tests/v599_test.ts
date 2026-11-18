// v5.9.9 (18 Nov 2026) first live day fixes: stop on Robinhood price steps + retry, sell when no stop, live-size reconcile, Close by hand.
// Run: deno test -A --no-check supabase/tests/v599_test.ts
const RealDate = Date;
let NOW = RealDate.parse("2026-11-04T15:00:00Z");           // Wed 4 Nov 2026, 10:00 AM ET (EST)
const TABLES: Record<string, any[]> = {};
let SERIAL = 0;
function seed(cfg: any = {}) {
  for (const k of Object.keys(TABLES)) delete TABLES[k];
  for (const k of ["winston_settings", "winston_trades", "winston_log", "winston_shadows", "winston_ideas", "winston_days", "winston_rules", "otto_settings"]) TABLES[k] = [];
  SERIAL = 0; CALLS.length = 0; WORKING.length = 0; POS.length = 0; ORDERS.length = 0;
  TABLES.winston_settings.push({ key: "config", value: { enabled: true, paper_balance: 5000, ...cfg } });
}
function matches(row: any, params: URLSearchParams) {
  for (const [k, v] of params) {
    if (["select", "order", "limit", "on_conflict"].includes(k)) continue;
    const have = row[k];
    if (v.startsWith("eq.")) { if (String(have) !== decodeURIComponent(v.slice(3))) return false; continue; }
    if (v.startsWith("gte.")) { if (!(String(have ?? "") >= decodeURIComponent(v.slice(4)))) return false; continue; }
    throw new Error("fake db: unsupported filter " + k + "=" + v);
  }
  return true;
}
async function fakeDb(path: string, init: RequestInit = {}) {
  const [table, q = ""] = path.split("?");
  const method = (init.method || "GET").toUpperCase();
  const params = new URLSearchParams(q);
  const rows = TABLES[table] ||= [];
  const body = init.body ? JSON.parse(String(init.body)) : null;
  if (method === "GET") { let out = rows.filter((r) => matches(r, params)); const lim = params.get("limit"); if (lim) out = out.slice(0, Number(lim)); return JSON.parse(JSON.stringify(out)); }
  if (method === "POST") {
    const list = Array.isArray(body) ? body : [body], made: any[] = [], conflict = params.get("on_conflict");
    for (const b of list) {
      if (conflict) { const ex = rows.find((r) => String(r[conflict]) === String(b[conflict])); if (ex) { Object.assign(ex, b); made.push(ex); continue; } }
      const row = { ...b }; if (table !== "winston_settings" && row.id == null) row.id = ++SERIAL; row.at ||= new RealDate(NOW).toISOString();
      rows.push(row); made.push(row);
    }
    return JSON.parse(JSON.stringify(made));
  }
  if (method === "PATCH") { const hit = rows.filter((r) => matches(r, params)); for (const r of hit) Object.assign(r, body); return JSON.parse(JSON.stringify(hit)); }
  throw new Error("fake db " + method);
}
const CALLS: { tool: string; args: any }[] = [];
const WORKING: any[] = [], POS: any[] = [], ORDERS: any[] = [];
let SEQ = 0;
let STOP_OK: (p: number) => boolean = () => true;   // which stop prices Robinhood accepts
function fakeLv(tool: string, args: any) {
  CALLS.push({ tool, args });
  if (tool === "get_option_positions") return { data: { positions: POS } };
  if (tool === "get_option_orders") return { data: { orders: args.order_id ? ORDERS.filter((o) => o.id === args.order_id) : [...ORDERS, ...WORKING] } };
  if (tool === "review_option_order") return { data: { ok: true, alerts: [] } };
  if (tool === "place_option_order") {
    if (args.type === "stop_market" && !STOP_OK(Number(args.stop_price))) throw new Error('API error 400: {"detail":"Stop price does not satisfy the min tick value."}');
    return { data: { order: { id: "ord-" + (++SEQ) } } };
  }
  if (tool === "cancel_option_order") return { data: { ok: true } };
  throw new Error("fake lv: " + tool);
}
(globalThis as any).__WINSTON_TEST__ = { db: fakeDb, md: () => { throw new Error("no quotes in this test"); }, ai: () => ({ out: {}, usage: { input: 0, output: 0 } }), now: () => NOW, lv: fakeLv, killPing: () => Promise.resolve(true), secret: "test-secret-0123456789abcdef" };
(globalThis as any).fetch = (u: any) => Promise.reject(new Error("network disabled in tests: " + String(u).slice(0, 80)));
(Deno as any).serve = () => ({ finished: Promise.resolve() });
const X: any = await import("../winston.ts");
function assert(c: unknown, msg: string) { if (!c) throw new Error("ASSERT: " + msg); }
const stops = () => CALLS.filter((c) => c.tool === "place_option_order" && c.args.type === "stop_market").map((c) => c.args.stop_price);
const cents = (p: number) => Math.round(p * 100);
const onTick = (step: number) => (p: number) => cents(p) % cents(step) === 0;
// Today's trade: COIN 110P, paper 2 contracts, live 1, filled $4.30, stop_option $3.74.
async function coinTrade(live: any = {}) {
  const r = await fakeDb("winston_trades", { method: "POST", body: JSON.stringify({ day: "2026-11-04", status: "open", ticker: "COIN", side: "put", option_id: "opt-coin", label: "COIN 110P 11/27", qty: 2,
    entry_ask: 4.3, entry_mid: 4.25, entry_fill: 4.3, opened_at: new RealDate(NOW - 60e3).toISOString(),
    plan: { stop_option: 3.74, planned_loss: 112, last_mark: { bid: 4.1, ask: 4.3, under: 112.2 }, live: { mode: "on", ticket: { ask: 4.3, qty: 1, premium: 430 }, entry_order_id: "E1", placed_at: new RealDate(NOW - 30e3).toISOString(), ...live } } }) });
  ORDERS.push({ id: "E1", state: "filled", legs: [{ executions: [{ price: "4.30", quantity: "1" }] }] });
  POS.push({ type: "long", option_id: "opt-coin", quantity: "1", chain_symbol: "COIN" });
  return r[0];
}
const cfg = { live_mode: "on" };

Deno.test("v5.9.9 price steps: stops round UP to Robinhood's step (penny $0.01 under $3, $0.05 from $3; coarse $0.05 / $0.10)", () => {
  assert(X.roundStopUp(3.74) === 3.75, "3.74 -> 3.75 (today's refused stop)");
  assert(X.roundStopUp(3.75) === 3.75, "already on the step stays");
  assert(X.roundStopUp(2.87) === 2.87, "under $3 the penny step is fine");
  assert(X.roundStopUp(2.999) === 3, "2.999 -> 3.00");
  assert(X.roundStopUp(3.74, true) === 3.8, "coarse: 3.74 -> 3.80");
  assert(X.roundStopUp(1.92, true) === 1.95, "coarse under $3: 1.92 -> 1.95");
  assert(X.liveStopArgs("o", 3.74, 1).stop_price === "3.75" && X.liveStopArgs("o", 3.74, 1, true).stop_price === "3.80", "the ticket carries the rounded price");
  assert(X.roundStopUp(3.74) >= 3.74 && X.roundStopUp(0.47) === 0.47, "never rounds the stop down (the loss never grows)");
});

Deno.test("v5.9.9 today's case: COIN filled at $4.30 with a $3.74 stop -> broker stop placed at $3.75, books clean", async () => {
  seed(cfg); STOP_OK = onTick(0.05);
  await coinTrade();
  await X.liveSync(cfg, "2026-11-04", 611);
  assert(stops().join(",") === "3.75", "one stop at 3.75, got " + stops().join(","));
  const live = TABLES.winston_trades[0].plan.live;
  assert(live.stop_order_id && live.stop_price === 3.75 && !live.stop_error, "stop id + price kept: " + JSON.stringify(live));
  WORKING.push({ id: live.stop_order_id, state: "confirmed" });
  await X.liveSync(cfg, "2026-11-04", 612);
  const st = TABLES.winston_settings.find((s) => s.key === "live_state").value;
  assert(st.recon.ok, "no mismatch (paper 2, live 1, Robinhood 1, stop working): " + JSON.stringify(st.recon));
  assert(stops().length === 1, "no second stop once one is working");
  assert(TABLES.winston_trades[0].status === "open", "trade keeps running with its stop");
});

Deno.test("v5.9.9 a non-penny name: the nickel stop is refused -> retried once on the dime step", async () => {
  seed(cfg); STOP_OK = onTick(0.1);
  await coinTrade();
  await X.liveSync(cfg, "2026-11-04", 611);
  assert(stops().join(",") === "3.75,3.80", "tries " + stops().join(","));
  assert(TABLES.winston_trades[0].plan.live.stop_price === 3.8 && TABLES.winston_trades[0].status === "open", "stop on the dime, trade open");
});

Deno.test("v5.9.9 no stop after 2 tries -> Winston sells right away (paper and live close together)", async () => {
  seed(cfg); STOP_OK = () => false;
  await coinTrade();
  await X.liveSync(cfg, "2026-11-04", 611);
  let t = TABLES.winston_trades[0];
  assert(t.status === "open" && t.plan.live.stop_tries === 1 && /min tick/.test(t.plan.live.stop_error), "try 1 failed, still open");
  assert(!CALLS.some((c) => c.tool === "place_option_order" && c.args.type !== "stop_market"), "no sell yet after one try");
  await X.liveSync(cfg, "2026-11-04", 612);
  t = TABLES.winston_trades[0];
  assert(t.plan.live.stop_tries === 2 && stops().join(",") === "3.75,3.80,3.75,3.80", "2 tries, each on the nickel then the dime: " + stops().join(","));
  assert(t.status === "closed" && t.exit_reason === "no_broker_stop" && (t.flags || []).includes("live_no_stop"), "paper closed: " + t.status + " " + t.exit_reason);
  const sell = CALLS.find((c) => c.tool === "place_option_order" && c.args.legs[0].side === "sell" && c.args.type !== "stop_market");
  assert(sell && sell.args.quantity === "1" && sell.args.price === "4.10", "live sell of 1 at the last bid: " + JSON.stringify(sell?.args));
  assert(t.plan.live.exit_order_id && t.plan.live.no_stop_exit, "exit id kept, marked");
  const n = CALLS.length;
  await X.liveSync(cfg, "2026-11-04", 613);
  assert(stops().length === 4 && !CALLS.slice(n).some((c) => c.tool === "place_option_order" && c.args.type === "stop_market"), "no more stop tries after the exit: " + stops().join(",") + " / after: " + JSON.stringify(CALLS.slice(n).map((c) => c.tool + ":" + (c.args.type || "")) ));
});

Deno.test("v5.9.9 a stop too close to the fill after rounding counts as no stop (sold on the next look, never held naked)", async () => {
  seed(cfg); STOP_OK = () => true;
  const r = await coinTrade(); TABLES.winston_trades[0].plan.stop_option = 4.27;   // rounds to 4.30 = the fill
  await X.liveSync(cfg, "2026-11-04", 611);
  assert(stops().length === 0, "no stop sent at or above the fill");
  assert(TABLES.winston_trades[0].status === "closed" && TABLES.winston_trades[0].exit_reason === "no_broker_stop", "closed right away: " + TABLES.winston_trades[0].exit_reason + " " + r.id);
});

Deno.test("v5.9.9 reconcile counts the LIVE size: paper 2 / live 1 / Robinhood 1 is clean; Robinhood 2 is a mismatch", () => {
  const t = { status: "open", ticker: "COIN", option_id: "a", qty: 2, plan: { live: { filled: true, entry_order_id: "e1", stop_order_id: "s1", ticket: { qty: 1 } } } };
  const pos = (q: number) => [{ type: "long", option_id: "a", quantity: String(q), chain_symbol: "COIN" }];
  assert(X.reconcileDiff("on", pos(1), [{ id: "s1", state: "confirmed" }], [t]).length === 0, "1 live = clean");
  const m = X.reconcileDiff("on", pos(2), [{ id: "s1", state: "confirmed" }], [t]);
  assert(m.length === 1 && m[0].detail === "COIN: books 1, Robinhood 2", "2 held = mismatch: " + JSON.stringify(m));
});

Deno.test("v5.9.9 Close by hand (Winston page): signed in only; closes paper + live through Winston", async () => {
  seed(cfg); STOP_OK = () => true;
  const t = await coinTrade({ filled: true, fill: 4.3, stop_order_id: "S1" });
  WORKING.push({ id: "S1", state: "confirmed" });
  assert((await X.closeByHand(null, t.id)).status === 401, "not signed in");
  assert((await X.closeByHand("ifoma@x.com", 999)).status === 404, "unknown trade");
  const r = await X.closeByHand("ifoma@x.com", t.id);
  assert(r.status === 200 && r.body.ok && r.body.live, "closed: " + JSON.stringify(r.body));
  const row = TABLES.winston_trades[0];
  assert(row.status === "closed" && row.exit_reason === "closed_by_hand" && row.flags.includes("hand:ifoma"), "books: " + row.exit_reason);
  assert(CALLS.some((c) => c.tool === "cancel_option_order" && c.args.order_id === "S1"), "stop cancelled first");
  assert(CALLS.some((c) => c.tool === "place_option_order" && c.args.legs[0].side === "sell" && c.args.quantity === "1"), "live contract sold");
  assert((await X.closeByHand("ifoma@x.com", t.id)).status === 404, "a second tap does nothing");
});

Deno.test("v5.9.9 entry: a stop that rounds up to the ask is 'no room for a broker stop' -> nothing is sent", async () => {
  seed(cfg); STOP_OK = () => true;
  TABLES.winston_settings.push({ key: "live_limits", value: { min_bp: 600, day_kill: -200, max_open: 1, contracts: 1, week_kill: -400, max_premium: 800 } });   // today's approved caps
  const r = await fakeDb("winston_trades", { method: "POST", body: JSON.stringify({ day: "2026-11-04", status: "open", ticker: "COIN", side: "put", option_id: "opt-coin", label: "110P", qty: 1, entry_fill: 4.3, plan: { stop_option: 4.27 } }) });
  const D: any = { ticker: "COIN", side: "put", source: "own", thesis: "t", wrong_if_level: 114, target_level: 107, cites: [] };
  await X.liveAfterOpen({ cfg, day: "2026-11-04", min: 600 }, r[0].id, D, { id: "opt-coin", label: "110P" }, { ask: 4.3, fill: 4.3 }, { stop_option: 4.27 }, 112);
  const live = TABLES.winston_trades[0].plan.live;
  assert(live.stop_too_close && /no room for a broker stop/.test(live.refused || ""), "refused: " + JSON.stringify(live.refused));
  assert(!CALLS.some((c) => c.tool === "place_option_order"), "no buy sent");
});

Deno.test("v5.9.9 live_ids: only open trades holding a real, unsold contract (the Desk hides Close Now on these)", async () => {
  seed(cfg);
  const add = (o: any) => fakeDb("winston_trades", { method: "POST", body: JSON.stringify({ day: "2026-11-04", status: "open", ticker: "X", ...o }) });
  await add({ option_id: "coin", plan: { live: { entry_order_id: "E1", filled: true } } });
  await add({ option_id: "paper", plan: {} });
  await add({ option_id: "sold", plan: { live: { entry_order_id: "E2", exit_fill: 4.35 } } });
  await add({ option_id: "stopped", plan: { live: { entry_order_id: "E3", stop_filled: true } } });
  await add({ option_id: "closed", status: "closed", plan: { live: { entry_order_id: "E4" } } });
  const ids = await X.liveOptionIds();
  assert(ids.join(",") === "coin", "only coin: " + ids.join(","));
});
