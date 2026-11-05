// v4.9 (4 Nov 2026) LIVE PLUMBING, dry first. Nothing touches the network: Supabase and the live gateway (lv) are faked.
// Run: deno test -A --no-check supabase/tests/v490_test.ts
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
// ---- the fake live gateway (what otto-proxy's winston_live returns). Records every call. ----
const CALLS: { tool: string; args: any }[] = [];
const WORKING: any[] = [], POS: any[] = [], ORDERS: any[] = [];
let KILL_ALIVE = true, REVIEW_FAIL = false, ACCOUNTS: any = { data: { accounts: [{ account_number: "945257012", agentic_allowed: true, option_level: "option_level_2" }] } };
let PORTFOLIO: any = { data: { buying_power: { buying_power: "5012.00" } } }, APPROVAL: any = { data: { human_must_approve_trades: false } };
let SEQ = 0;
function fakeLv(tool: string, args: any) {
  CALLS.push({ tool, args });
  if (tool === "get_accounts") return ACCOUNTS;
  if (tool === "get_portfolio") return PORTFOLIO;
  if (tool === "get_trade_approval_setting") return APPROVAL;
  if (tool === "get_option_positions") return { data: { positions: POS } };
  if (tool === "get_option_orders") return { data: { orders: args.order_id ? ORDERS.filter((o) => o.id === args.order_id) : [...ORDERS, ...WORKING] } };
  if (tool === "review_option_order") { if (REVIEW_FAIL) throw new Error("Robinhood refused the review"); return { data: { ok: true, alerts: [] } }; }
  if (tool === "place_option_order") return { data: { order: { id: "ord-" + (++SEQ) } } };
  if (tool === "cancel_option_order") return { data: { ok: true } };
  throw new Error("fake lv: " + tool);
}
(globalThis as any).__WINSTON_TEST__ = { db: fakeDb, md: () => { throw new Error("md not used here"); }, ai: () => ({ out: {}, usage: { input: 0, output: 0 } }), now: () => NOW, lv: fakeLv, killPing: () => Promise.resolve(KILL_ALIVE), secret: "test-secret-0123456789abcdef" };
(globalThis as any).fetch = (u: any) => Promise.reject(new Error("network disabled in tests: " + String(u).slice(0, 80)));
(Deno as any).serve = () => ({ finished: Promise.resolve() });
const X: any = await import("../winston.ts");
function assert(c: unknown, msg: string) { if (!c) throw new Error("ASSERT: " + msg); }
const placed = () => CALLS.filter((c) => /^(place|cancel)_/.test(c.tool));
const logs = (k: string) => TABLES.winston_log.filter((r) => r.kind === k);
const L = X.liveLimitsOf({});
const snap = (o: any = {}) => ({ qty: 1, premium: 200, source: "coach:571", min: 600, openLive: 0, dayPnl: 0, weekPnl: 0, killed: false, blocked: null, mismatchToday: false, ...o });
const D: any = { ticker: "MSFT", side: "call", source: "coach:571", thesis: "t", wrong_if_level: 520, target_level: 535, trigger_level: 525, cites: [{ type: "coach", ref: "571" }] };
const ROW: any = { id: "opt-msft", exp: "2026-11-06", strike: 525, type: "call", bid: 2.3, ask: 2.4, delta: 0.4, vol: 1, oi: 1, label: "525C 11/06" };
const mkCtx = (cfg: any) => ({ cfg, day: "2026-11-04", min: 600 });
async function openTrade(plan: any = {}, extra: any = {}) {
  const r = await fakeDb("winston_trades", { method: "POST", body: JSON.stringify({ day: "2026-11-04", status: "open", ticker: "MSFT", side: "call", option_id: "opt-msft", label: "525C 11/06", qty: 1, entry_fill: 2.4, plan: { stop_option: 1.9, ...plan }, ...extra }) });
  return r[0];
}

/* ---------------------------------------------------------------- pure rules */
Deno.test("v4.9 caps: each approved cap refuses on its own, and a clean coach ticket passes", () => {
  assert(X.liveCapRefusal(L, snap()) === null, "clean ticket passes");
  assert(/over the cap/.test(X.liveCapRefusal(L, snap({ qty: 2 }))), "2 contracts");
  assert(/\$250 cap/.test(X.liveCapRefusal(L, snap({ premium: 250.01 }))), "premium over 250");
  assert(X.liveCapRefusal(L, snap({ premium: 250 })) === null, "premium exactly 250 is allowed");
  assert(/day loss/.test(X.liveCapRefusal(L, snap({ dayPnl: -300 }))), "day -300 kills");
  assert(X.liveCapRefusal(L, snap({ dayPnl: -299.99 })) === null, "day -299.99 still ok");
  assert(/week loss/.test(X.liveCapRefusal(L, snap({ weekPnl: -750 }))), "week -750 kills");
  assert(/open is the cap/.test(X.liveCapRefusal(L, snap({ openLive: 2 }))), "2 open is full");
  assert(X.liveCapRefusal(L, snap({ openLive: 1 })) === null, "1 open leaves room");
  assert(/no live entry/.test(X.liveCapRefusal(L, snap({ min: 900 }))), "3:00 PM is the last entry minute");
  assert(X.liveCapRefusal(L, snap({ min: 899 })) === null, "2:59 PM ok");
  assert(/coach ideas only/.test(X.liveCapRefusal(L, snap({ source: "own" }))), "week 1: own ideas stay paper");
  assert(X.liveCapRefusal({ ...L, coach_only: false }, snap({ source: "own" })) === null, "coach_only off lets own ideas through");
  assert(/kill/.test(X.liveCapRefusal(L, snap({ killed: true }))), "killed");
  assert(/blocked/.test(X.liveCapRefusal(L, snap({ blocked: "Trade-approval setting is OFF: Robinhood says ON" }))), "blocked by preflight");
  assert(/reconcile/.test(X.liveCapRefusal(L, snap({ mismatchToday: true }))), "mismatch day");
  assert(L.contracts === 1 && L.max_premium === 250 && L.day_kill === -300 && L.week_kill === -750 && L.max_open === 2 && L.last_entry_min === 900 && L.coach_only === true, "defaults are the approved caps");
});

Deno.test("v4.9 reconcile: each mismatch kind is caught; clean books are clean (dry and on)", () => {
  const pos = (id: string, q = 1) => ({ type: "long", option_id: id, quantity: String(q), chain_symbol: "MSFT" });
  assert(X.reconcileDiff("dry", [], [], []).length === 0, "dry, nothing anywhere = clean");
  assert(X.reconcileDiff("dry", [pos("a")], [], [])[0].kind === "unknown_position", "dry: any long option is unknown");
  assert(X.reconcileDiff("dry", [], [{ id: "o1", state: "queued" }], [])[0].kind === "unknown_order", "dry: any working order is unknown");
  assert(X.reconcileDiff("dry", [], [{ id: "o1", state: "filled" }], []).length === 0, "a filled order is history, not a mismatch");
  const t = { status: "open", ticker: "MSFT", option_id: "a", qty: 1, plan: { live: { filled: true, entry_order_id: "e1", stop_order_id: "s1" } } };
  assert(X.reconcileDiff("on", [pos("a")], [{ id: "s1", state: "confirmed" }], [t]).length === 0, "on: held + stop working = clean");
  assert(X.reconcileDiff("on", [pos("a", 2)], [{ id: "s1", state: "confirmed" }], [t])[0].kind === "qty_mismatch", "qty");
  assert(X.reconcileDiff("on", [], [{ id: "s1", state: "confirmed" }], [t])[0].kind === "missing_position", "missing");
  assert(X.reconcileDiff("on", [pos("a"), pos("b")], [{ id: "s1", state: "confirmed" }], [t]).some((m: any) => m.kind === "unknown_position"), "unknown extra position");
  assert(X.reconcileDiff("on", [pos("a")], [{ id: "s1", state: "confirmed" }, { id: "zz", state: "queued" }], [t]).some((m: any) => m.kind === "unknown_order"), "unknown order");
  assert(X.reconcileDiff("on", [pos("a")], [], [t]).some((m: any) => m.kind === "stop_missing"), "no working stop");
  const done = { ...t, status: "closed", plan: { live: { ...t.plan.live, filled: true, exit_fill: 2.5 } } };
  assert(X.reconcileDiff("on", [], [], [done]).length === 0, "an exited trade expects nothing");
});

Deno.test("v4.9 preflight: every check can fail on its own and blocks live with the reason", () => {
  const ok = { accounts: ACCOUNTS, portfolio: PORTFOLIO, approval: APPROVAL, killAlive: true, mismatches: [], longs: 0, minBp: 4500 };
  const good = X.preflightEval(ok);
  assert(good.ok && good.checks.length === 5 && good.blocked === null, "all five pass");
  assert(!X.preflightEval({ ...ok, accounts: { data: { accounts: [{ account_number: "1", agentic_allowed: false }] } } }).ok, "no agentic account");
  assert(!X.preflightEval({ ...ok, accounts: { data: { accounts: [{ account_number: "1", agentic_allowed: true, option_level: "option_level_1" }] } } }).ok, "not Level 2");
  assert(!X.preflightEval({ ...ok, portfolio: { data: { buying_power: { buying_power: "4000" } } } }).ok, "buying power under 4,500");
  assert(!X.preflightEval({ ...ok, portfolio: {} }).ok, "buying power unknown fails closed");
  const ap = X.preflightEval({ ...ok, approval: { data: { human_must_approve_trades: true } } });
  assert(!ap.ok && /ON/.test(ap.blocked), "approval ON blocks: " + ap.blocked);
  assert(!X.preflightEval({ ...ok, approval: {} }).ok, "approval unreadable fails closed");
  assert(!X.preflightEval({ ...ok, killAlive: false }).ok && !X.preflightEval({ ...ok, killAlive: null }).ok, "kill route silent");
  assert(!X.preflightEval({ ...ok, mismatches: [{ kind: "x", detail: "y" }] }).ok && !X.preflightEval({ ...ok, mismatches: null }).ok, "reconcile");
  assert(!X.preflightEval({ ...ok, longs: 1 }).ok && !X.preflightEval({ ...ok, longs: null }).ok, "not flat");
});

Deno.test("v4.9 kill key: signed per person, wrong person or key refused", async () => {
  const k = await X.killKey("ifoma"), j = await X.killKey("josh");
  assert(k.length === 32 && j.length === 32 && k !== j, "two different 32-char keys");
  assert(await X.killOk("ifoma", k) && await X.killOk("josh", j), "each key opens its own link");
  assert(!(await X.killOk("josh", k)) && !(await X.killOk("ifoma", "")) && !(await X.killOk("hazel", k)) && !(await X.killOk("ifoma", k.slice(0, 31) + "0" + "")) || k.endsWith("0"), "wrong person / empty / unknown person / tampered key refused");
});

/* ---------------------------------------------------------------- config_set */
Deno.test("v4.9 config_set: live_mode off|dry|on, a standing kill clears on dry/on, limits are range-checked", async () => {
  seed();
  let r = await X.setEnabled({ live_mode: "dry" }); assert(r.live_mode === "dry", "dry");
  assert(TABLES.winston_settings.find((s) => s.key === "config").value.live_mode === "dry", "stored");
  let threw = false; try { await X.setEnabled({ live_mode: "maybe" }); } catch { threw = true; } assert(threw, "bad mode refused");
  await fakeDb("winston_settings?on_conflict=key", { method: "POST", body: JSON.stringify({ key: "kill_now", value: { at: "x", by: "ifoma" } }) });
  await X.setEnabled({ live_mode: "on" });
  assert(!TABLES.winston_settings.find((s) => s.key === "kill_now").value.at, "kill cleared when he turns it back on");
  assert(TABLES.winston_settings.find((s) => s.key === "config").value.live_since === "2026-11-04", "live_since stamped");
  r = await X.setEnabled({ live_limits: { max_open: 3, coach_only: false } }); assert(r.live_limits.max_open === 3 && r.live_limits.coach_only === false, "limits merged");
  for (const bad of [{ contracts: 9 }, { max_premium: 0 }, { day_kill: 100 }, { nope: 1 }]) { threw = false; try { await X.setEnabled({ live_limits: bad }); } catch { threw = true; } assert(threw, "refused " + JSON.stringify(bad)); }
  await X.setEnabled({ reconcile_ack: "2026-11-04" });
  assert(TABLES.winston_settings.find((s) => s.key === "live_state").value.ack_day === "2026-11-04", "ack stored");
});

/* ---------------------------------------------------------------- DRY never places */
Deno.test("v4.9 DRY: an entry, an exit and a sync make reviews and reads only — never place_* or cancel_*", async () => {
  seed({ live_mode: "dry" });
  await X.liveAfterOpen(mkCtx({ live_mode: "dry" }), 1, D, ROW, { ask: 2.4, fill: 2.4 }, { stop_option: 1.9 }, 524);
  const t = await openTrade({ live: { mode: "dry", ticket: { qty: 1 } } });
  await X.liveOnClose({ ...t, plan: { live: { mode: "dry", ticket: { qty: 1 } } } }, { bid: 2.3 });
  await X.liveSync({ live_mode: "dry" }, "2026-11-04", 600);
  assert(placed().length === 0, "no place/cancel in dry: " + JSON.stringify(placed()));
  const rv = CALLS.filter((c) => c.tool === "review_option_order");
  assert(rv.length === 3, "entry + stop + exit reviewed, got " + rv.length);
  assert(rv[0].args.legs[0].side === "buy" && rv[0].args.price === "2.40" && rv[0].args.type === "limit" && rv[0].args.time_in_force === "gfd" && rv[0].args.quantity === "1", "entry ticket = 1 contract, limit at the ask, GFD");
  assert(rv[1].args.type === "stop_market" && rv[1].args.stop_price === "1.90" && rv[1].args.legs[0].side === "sell", "stop ticket");
  assert(rv[2].args.type === "limit" && rv[2].args.price === "2.30" && rv[2].args.legs[0].position_effect === "close", "exit ticket = sell-to-close limit at the bid");
  assert(logs("live_review").length === 3, "three ledger rows");
  const day = TABLES.winston_settings.find((s) => s.key === "live_days").value["2026-11-04"];
  assert(day.reviews === 3 && day.review_fail === 0, "day counters");
});

Deno.test("v4.9 DRY: a stop at or above the ask is logged stop_too_close and not reviewed; a failed review is counted", async () => {
  seed({ live_mode: "dry" });
  await X.liveAfterOpen(mkCtx({ live_mode: "dry" }), 1, D, ROW, { ask: 2.4, fill: 2.4 }, { stop_option: 2.4 }, 524);
  assert(logs("live_stop_too_close").length === 1, "stop_too_close logged");
  assert(CALLS.filter((c) => c.tool === "review_option_order").length === 1, "only the entry was reviewed");
  seed({ live_mode: "dry" }); REVIEW_FAIL = true;
  await X.liveAfterOpen(mkCtx({ live_mode: "dry" }), 1, D, ROW, { ask: 2.4, fill: 2.4 }, { stop_option: 1.9 }, 524);
  REVIEW_FAIL = false;
  assert(TABLES.winston_settings.find((s) => s.key === "live_days").value["2026-11-04"].review_fail === 2, "two failed reviews counted");
  assert(logs("live_review").every((r) => r.data.result === "REVIEW FAILED"), "rows say so");
});

Deno.test("v4.9 DRY reconcile: Josh's live position or order shows up as a mismatch and is logged once", async () => {
  seed({ live_mode: "dry" });
  POS.push({ type: "long", option_id: "josh-spy", quantity: "1", chain_symbol: "SPY" });
  await X.liveSync({ live_mode: "dry" }, "2026-11-04", 600);
  await X.liveSync({ live_mode: "dry" }, "2026-11-04", 610);
  assert(logs("reconcile_mismatch").length === 1, "logged once, not every tick");
  const st = TABLES.winston_settings.find((s) => s.key === "live_state").value;
  assert(st.mismatch_day === "2026-11-04" && st.recon.ok === false, "state remembers the mismatch day");
  assert(placed().length === 0, "still nothing placed");
});

Deno.test("v4.9 preflight: all green stores the checks, clears the block; a failure writes live_blocked and paper is untouched", async () => {
  seed({ live_mode: "dry" });
  let r = await X.livePreflight({ live_mode: "dry" }, "2026-11-04");
  assert(r.ok && r.blocked === null, "clean");
  let st = TABLES.winston_settings.find((s) => s.key === "live_state").value;
  assert(st.pf.ok && st.pf.checks.length === 5 && st.blocked === null, "stored");
  seed({ live_mode: "dry" }); APPROVAL = { data: { human_must_approve_trades: true } };
  r = await X.livePreflight({ live_mode: "dry" }, "2026-11-04"); APPROVAL = { data: { human_must_approve_trades: false } };
  st = TABLES.winston_settings.find((s) => s.key === "live_state").value;
  assert(!r.ok && /approval/i.test(st.blocked), "blocked with a reason: " + st.blocked);
  assert(logs("live_blocked").length === 1, "live_blocked row");
  assert((await X.livePreflight({ live_mode: "off" }, "2026-11-04")).skipped === "off", "off does nothing");
});

/* ---------------------------------------------------------------- ON: caps before place */
Deno.test("v4.9 ON: a ticket over the premium cap, in a kill, blocked, or on a mismatch day is refused BEFORE any place_*", async () => {
  const cases: [string, any, any, any][] = [
    ["premium", { ask: 3.1 }, {}, {}],
    ["kill", { ask: 2.4 }, {}, { kill: true }],
    ["blocked", { ask: 2.4 }, { blocked: "Trade-approval setting is OFF: Robinhood says ON" }, {}],
    ["mismatch", { ask: 2.4 }, { mismatch_day: "2026-11-04" }, {}],
    ["own idea", { ask: 2.4 }, {}, { source: "own" }],
  ];
  for (const [name, ef, state, o] of cases) {
    seed({ live_mode: "on" });
    if (Object.keys(state).length) await fakeDb("winston_settings?on_conflict=key", { method: "POST", body: JSON.stringify({ key: "live_state", value: state }) });
    if (o.kill) await fakeDb("winston_settings?on_conflict=key", { method: "POST", body: JSON.stringify({ key: "kill_now", value: { at: "x", by: "ifoma" } }) });
    const t = await openTrade();
    await X.liveAfterOpen(mkCtx({ live_mode: "on" }), t.id, { ...D, source: o.source || "coach:571" }, ROW, { ask: ef.ask, fill: ef.ask }, { stop_option: 1.9 }, 524);
    assert(placed().length === 0, name + ": nothing placed");
    assert(logs("live_cap_refused").length === 1, name + ": live_cap_refused logged");
    assert(TABLES.winston_trades[0].plan.live.refused, name + ": refusal stored on the trade");
    assert(TABLES.winston_shadows.length === 1 && TABLES.winston_shadows[0].rule === "LIVE_CAP", name + ": booked a shadow");
  }
});

Deno.test("v4.9 ON: a clean coach ticket is reviewed first, then placed once with a ref_id; a failed review stops it", async () => {
  seed({ live_mode: "on" });
  const t = await openTrade();
  await X.liveAfterOpen(mkCtx({ live_mode: "on" }), t.id, D, ROW, { ask: 2.4, fill: 2.4 }, { stop_option: 1.9 }, 524);
  const order = CALLS.map((c) => c.tool);
  assert(order.indexOf("review_option_order") >= 0 && order.indexOf("review_option_order") < order.indexOf("place_option_order"), "review comes before place");
  const pl = CALLS.filter((c) => c.tool === "place_option_order");
  assert(pl.length === 1 && pl[0].args.ref_id && pl[0].args.price === "2.40" && pl[0].args.quantity === "1" && pl[0].args.legs[0].position_effect === "open", "one buy, 1 contract at the ask");
  assert(TABLES.winston_trades[0].plan.live.entry_order_id === "ord-" + SEQ, "order id kept");
  seed({ live_mode: "on" }); REVIEW_FAIL = true;
  const t2 = await openTrade();
  await X.liveAfterOpen(mkCtx({ live_mode: "on" }), t2.id, D, ROW, { ask: 2.4, fill: 2.4 }, { stop_option: 1.9 }, 524); REVIEW_FAIL = false;
  assert(placed().length === 0 && /review failed/i.test(TABLES.winston_trades[0].plan.live.refused), "a failed review means nothing is sent");
});

Deno.test("v4.9 ON lifecycle: entry fill -> broker stop; exit -> limit at the bid; fill -> live P&L; stale exit -> market", async () => {
  seed({ live_mode: "on" });
  const t = await openTrade({ live: { mode: "on", ticket: { ask: 2.4, qty: 1 }, entry_order_id: "E1", placed_at: new RealDate(NOW).toISOString() } });
  const cfg = { live_mode: "on" };
  ORDERS.push({ id: "E1", state: "filled", legs: [{ executions: [{ price: "2.38", quantity: "1" }] }] });
  POS.push({ type: "long", option_id: "opt-msft", quantity: "1", chain_symbol: "MSFT" });
  await X.liveSync(cfg, "2026-11-04", 600);
  let live = TABLES.winston_trades[0].plan.live;
  assert(live.filled && live.fill === 2.38, "fill recorded at the real price");
  const stop = CALLS.find((c) => c.tool === "place_option_order" && c.args.type === "stop_market");
  assert(stop && stop.args.stop_price === "1.90", "broker stop placed at plan.stop_option");
  assert(live.stop_order_id, "stop id kept");
  // paper trade exits: cancel the stop, sell at the bid
  CALLS.length = 0; WORKING.push({ id: live.stop_order_id, state: "confirmed" });
  ORDERS.length = 0; ORDERS.push({ id: "E1", state: "filled" });
  await X.liveOnClose({ ...TABLES.winston_trades[0], status: "closed", day: "2026-11-04" }, { bid: 2.6 });
  assert(CALLS.some((c) => c.tool === "cancel_option_order" && c.args.order_id === live.stop_order_id), "stop cancelled first");
  const sell = CALLS.find((c) => c.tool === "place_option_order");
  assert(sell && sell.args.type === "limit" && sell.args.price === "2.60" && sell.args.legs[0].side === "sell", "sell-to-close limit at the bid");
  live = TABLES.winston_trades[0].plan.live; assert(live.exit_order_id, "exit id kept");
  // 61 s later it has not filled -> cancelled and re-sent at market
  CALLS.length = 0; WORKING.length = 0; WORKING.push({ id: live.exit_order_id, state: "confirmed" });
  TABLES.winston_trades[0].plan.live.exit_placed_at = new RealDate(NOW - 61e3).toISOString();
  await X.liveSync(cfg, "2026-11-04", 601);
  assert(CALLS.some((c) => c.tool === "cancel_option_order") && CALLS.some((c) => c.tool === "place_option_order" && c.args.type === "market"), "escalated to market");
  // it fills
  live = TABLES.winston_trades[0].plan.live; ORDERS.push({ id: live.exit_order_id, state: "filled", legs: [{ executions: [{ price: "2.55", quantity: "1" }] }] }); WORKING.length = 0; POS.length = 0;
  await X.liveSync(cfg, "2026-11-04", 602);
  live = TABLES.winston_trades[0].plan.live;
  assert(live.exit_fill === 2.55 && live.pnl === 17, "live P&L = (2.55 - 2.38) x 100 = +$17, got " + live.pnl);
});

Deno.test("v4.9 ON: a stale unfilled entry is cancelled after 3 minutes; a day loss of -$300 fires the kill", async () => {
  seed({ live_mode: "on" });
  await openTrade({ live: { mode: "on", ticket: { ask: 2.4, qty: 1 }, entry_order_id: "E9", placed_at: new RealDate(NOW - 200e3).toISOString() } });
  WORKING.push({ id: "E9", state: "queued" });
  await X.liveSync({ live_mode: "on" }, "2026-11-04", 600);
  assert(CALLS.some((c) => c.tool === "cancel_option_order" && c.args.order_id === "E9"), "stale entry cancelled");
  assert(TABLES.winston_trades[0].plan.live.entry_state === "cancelled_timeout", "state kept");
  seed({ live_mode: "on" });
  await fakeDb("winston_trades", { method: "POST", body: JSON.stringify({ day: "2026-11-04", status: "closed", ticker: "AAPL", option_id: "a", qty: 1, plan: { live: { filled: true, fill: 3, exit_fill: 0, pnl: -301, entry_order_id: "x" } } }) });
  await X.liveSync({ live_mode: "on" }, "2026-11-04", 700);
  assert(logs("kill").length === 1, "the loss stop killed it");
  assert(TABLES.winston_settings.find((s) => s.key === "config").value.live_mode === "off", "and flipped the mode OFF");
});

/* ---------------------------------------------------------------- kill */
Deno.test("v4.9 kill ON: cancels every working order, sells every position at market, sets mode OFF, writes the kill row", async () => {
  seed({ live_mode: "on" });
  WORKING.push({ id: "w1", state: "confirmed" }, { id: "w2", state: "queued" }); POS.push({ type: "long", option_id: "opt-a", quantity: "2", chain_symbol: "AAPL" });
  const r = await X.liveKill("ifoma", "kill link");
  assert(r.cancelled === 2 && r.closed === 1, "2 cancelled, 1 closed: " + JSON.stringify(r));
  const mk = CALLS.find((c) => c.tool === "place_option_order");
  assert(mk.args.type === "market" && mk.args.quantity === "2" && mk.args.legs[0].side === "sell" && mk.args.legs[0].position_effect === "close", "market sell-to-close of the whole position");
  assert(TABLES.winston_settings.find((s) => s.key === "config").value.live_mode === "off", "mode OFF");
  assert(TABLES.winston_settings.find((s) => s.key === "kill_now").value.by === "ifoma", "kill_now stored");
  assert(logs("kill").length === 1 && logs("kill")[0].data.result === "DONE", "kill row");
});

Deno.test("v4.9 kill in DRY or OFF: sets the standing kill and the mode OFF without calling the broker", async () => {
  for (const m of ["dry", "off"]) { seed({ live_mode: m }); await X.liveKill("josh", "kill link"); assert(CALLS.length === 0, m + ": no broker calls"); assert(TABLES.winston_settings.find((s) => s.key === "config").value.live_mode === "off", m + ": OFF"); }
});

Deno.test("v4.9 kill route: GET never kills, bad key 401, ping answers, POST with the right key kills", async () => {
  seed({ live_mode: "on" });
  const k = await X.killKey("josh");
  const call = (qs: string, method = "GET") => X.handle(new Request("https://x.test/functions/v1/winston?fn=kill" + qs, { method }));
  assert((await call("&who=josh&k=nope", "POST")).status === 401, "bad key");
  assert((await call("&who=hazel&k=" + k, "POST")).status === 401, "unknown person");
  const ping = await call("&who=josh&ping=1&k=" + k); assert(ping.status === 200 && (await ping.json()).alive === true, "ping alive");
  assert((await call("&who=josh&k=" + k)).status === 405 && CALLS.length === 0, "a GET (link preview, prefetch) does nothing");
  const ok = await call("&who=josh&k=" + k, "POST"); const j = await ok.json();
  assert(ok.status === 200 && j.killed === true, "POST kills");
  assert(TABLES.winston_settings.find((s) => s.key === "config").value.live_mode === "off", "mode OFF");
});

Deno.test("v4.9 live_card shape: mode, caps, preflight, today's ledger, clean dry days", async () => {
  seed({ live_mode: "dry" });
  await X.livePreflight({ live_mode: "dry" }, "2026-11-04");
  await X.liveAfterOpen(mkCtx({ live_mode: "dry" }), 1, D, ROW, { ask: 2.4, fill: 2.4 }, { stop_option: 1.9 }, 524);
  await fakeDb("winston_settings?on_conflict=key", { method: "POST", body: JSON.stringify({ key: "live_days", value: { ...TABLES.winston_settings.find((s) => s.key === "live_days").value, "2026-11-03": { reviews: 5, review_fail: 0, mismatches: 0, pf_ok: true }, "2026-11-02": { reviews: 4, review_fail: 1, mismatches: 0, pf_ok: true } } }) });
  const c = await X.liveCard();
  assert(c.mode === "dry" && c.limits.max_premium === 250 && c.pf.ok && c.pf.checks.length === 5, "mode, caps, preflight");
  assert(c.ledger.length === 2 && c.ledger[0].result === "REVIEWED", "ledger rows");
  assert(c.clean_days === 1 && c.need_days === 5, "only 3 Nov is clean (2 Nov had a failed review, today is not finished)");
  assert(c.kill === null && c.mismatch_today === false, "no kill, no mismatch");
});

/* ---------------------------------------------------------------- static walls inside the live block */
Deno.test("v4.9 static: every place_/cancel_ call in the live block sits behind mode === 'on' (or the kill, which flips mode OFF)", async () => {
  const src = await Deno.readTextFile(new URL("../winston.ts", import.meta.url));
  const a = src.indexOf("v4.9 LIVE PLUMBING"), b = src.indexOf("/* ------------------------------------------------------------------ HTTP */");
  const blk = src.slice(a, b);
  const fn = (name: string) => { const i = blk.indexOf("export async function " + name); assert(i > 0, "found " + name); const j = blk.indexOf("\nexport ", i + 10); return blk.slice(i, j > 0 ? j : undefined); };
  const open = fn("liveAfterOpen"); assert(open.indexOf('if (mode === "on") {') > 0 && open.indexOf("place_option_order") > open.indexOf('if (mode === "on") {'), "liveAfterOpen: place only after the on-branch starts");
  assert(!/cancel_option_order/.test(open), "liveAfterOpen never cancels");
  const close = fn("liveOnClose"); assert(close.indexOf('if (mode === "dry") {') > 0 && close.indexOf("return;") < close.indexOf("place_option_order") && close.indexOf('if (mode === "dry") {') < close.indexOf("place_option_order"), "liveOnClose: the dry branch returns before any place");
  const sync = fn("liveSync"); assert(sync.indexOf('if (mode === "on") for (const t of trades)') > 0 && sync.indexOf("place_option_order") > sync.indexOf('if (mode === "on") for'), "liveSync: orders only inside the on-loop");
  const kill = fn("liveKill"); assert(kill.indexOf('if (mode === "on") {') > 0 && kill.indexOf("place_option_order") > kill.indexOf('if (mode === "on") {'), "liveKill: orders only when the mode is on");
  assert(!/place_option_order|cancel_option_order/.test(fn("livePreflight")) && !/place_option_order|cancel_option_order/.test(fn("liveCard")), "preflight and the card never order");
  assert(!/place_equity_order|cancel_equity_order|review_equity_order/.test(blk), "no equity orders anywhere");
});
