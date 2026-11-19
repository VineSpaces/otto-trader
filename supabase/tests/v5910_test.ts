// v5.9.10 (19 Nov 2026): the stop-missing false alarm on the look that places the stop; broker stop to break-even after Profit 1.
// Run: deno test -A --no-check supabase/tests/v5910_test.ts
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
let CANCEL_OK = true;
let ON_CANCEL: (() => void) | null = null;
function fakeLv(tool: string, args: any) {
  CALLS.push({ tool, args });
  if (tool === "get_option_positions") return { data: { positions: POS } };
  if (tool === "get_option_orders") return { data: { orders: args.order_id ? ORDERS.filter((o) => o.id === args.order_id) : [...ORDERS, ...WORKING] } };
  if (tool === "review_option_order") return { data: { ok: true, alerts: [] } };
  if (tool === "place_option_order") {
    if (args.type === "stop_market" && !STOP_OK(Number(args.stop_price))) throw new Error('API error 400: {"detail":"Stop price does not satisfy the min tick value."}');
    return { data: { order: { id: "ord-" + (++SEQ) } } };
  }
  if (tool === "cancel_option_order") { if (!CANCEL_OK) throw new Error("API error 409: order is not cancellable"); if (ON_CANCEL) ON_CANCEL(); return { data: { ok: true } }; }
  throw new Error("fake lv: " + tool);
}
(globalThis as any).__WINSTON_TEST__ = { db: fakeDb, md: () => { throw new Error("no quotes in this test"); }, ai: () => ({ out: {}, usage: { input: 0, output: 0 } }), now: () => NOW, lv: fakeLv, killPing: () => Promise.resolve(true), secret: "test-secret-0123456789abcdef" };
(globalThis as any).fetch = (u: any) => Promise.reject(new Error("network disabled in tests: " + String(u).slice(0, 80)));
(Deno as any).serve = () => ({ finished: Promise.resolve() });
const X: any = await import("../winston.ts");
function assert(c: unknown, msg: string) { if (!c) throw new Error("ASSERT: " + msg); }
const stops = () => CALLS.filter((c) => c.tool === "place_option_order" && c.args.type === "stop_market").map((c) => c.args.stop_price);
const cents = (p: number) => Math.round(p * 100);

const cancels = () => CALLS.filter((c) => c.tool === "cancel_option_order").map((c) => c.args.order_id);
const sells = () => CALLS.filter((c) => c.tool === "place_option_order" && c.args.legs[0].side === "sell" && c.args.type !== "stop_market");
const cfg = { live_mode: "on" };
const st = () => TABLES.winston_settings.find((s) => s.key === "live_state")?.value || {};
// 19 Nov's trade: SPY 727P 11/27, 1 contract, filled $6.82, plan stop $5.51 -> broker stop $5.55.
async function spyTrade(o: { live?: any; plan?: any; p1?: boolean; stop?: boolean } = {}) {
  const withStop = o.stop !== false;
  const r = await fakeDb("winston_trades", { method: "POST", body: JSON.stringify({ day: "2026-11-04", status: "open", ticker: "SPY", side: "put", option_id: "opt-spy", label: "SPY 727P 11/27", qty: 1,
    entry_ask: 6.89, entry_mid: 6.85, entry_fill: 6.89, opened_at: new RealDate(NOW - 12 * 60e3).toISOString(),
    plan: { stop_option: 5.51, planned_loss: 137.8, last_mark: { bid: 8.51, ask: 8.59, under: 730.7 }, ...(o.p1 === false ? {} : { p1: { at: new RealDate(NOW - 60e3).toISOString(), qty: 0, bid: 8.51, pct: 20 } }), ...(o.plan || {}),
      live: { mode: "on", ticket: { ask: 6.89, qty: 1, premium: 689 }, entry_order_id: "E1", placed_at: new RealDate(NOW - 12 * 60e3).toISOString(),
        ...(withStop ? { filled: true, fill: 6.82, stop_order_id: "S1", stop_price: 5.55, stop_tries: 1 } : {}), ...(o.live || {}) } } }) });
  ORDERS.push({ id: "E1", state: "filled", legs: [{ executions: [{ price: "6.82", quantity: "1" }] }] });
  POS.push({ type: "long", option_id: "opt-spy", quantity: "1", chain_symbol: "SPY" });
  if (withStop) WORKING.push({ id: "S1", state: "confirmed" });
  return r[0];
}
const live = () => TABLES.winston_trades[0].plan.live;

Deno.test("v5.9.10 the 19 Nov false alarm: the look that places the stop does not call it missing (books stay clean, no mismatch day)", async () => {
  seed(cfg); STOP_OK = () => true; CANCEL_OK = true;
  await spyTrade({ stop: false, p1: false });
  await X.liveSync(cfg, "2026-11-04", 622);
  assert(stops().join(",") === "5.55" && live().stop_order_id, "stop placed at 5.55: " + stops().join(","));
  assert(st().recon.ok === true && st().recon.n === 0, "books clean on the SAME look: " + JSON.stringify(st().recon));
  assert(!st().mismatch_day, "no mismatch day set: " + st().mismatch_day);
  assert(!TABLES.winston_log.some((l) => l.kind === "reconcile_mismatch"), "no mismatch logged");
});

Deno.test("v5.9.10 a stop that really is gone is still a mismatch (the grace covers only this look's own order)", async () => {
  seed(cfg); STOP_OK = () => true; CANCEL_OK = true;
  await spyTrade({ p1: false }); WORKING.length = 0;            // books say S1 is working; Robinhood shows nothing
  await X.liveSync(cfg, "2026-11-04", 622);
  assert(st().recon.ok === false && st().recon.mismatches.some((m: any) => m.kind === "stop_missing"), "stop_missing: " + JSON.stringify(st().recon));
  assert(st().mismatch_day === "2026-11-04", "mismatch day set");
});

Deno.test("v5.9.10 after Profit 1 the broker stop moves up once to break-even ($6.82 fill -> $6.85), books clean", async () => {
  seed(cfg); STOP_OK = () => true; CANCEL_OK = true;
  await spyTrade();
  await X.liveSync(cfg, "2026-11-04", 634);
  assert(cancels().join(",") === "S1", "old stop cancelled: " + cancels().join(","));
  assert(stops().join(",") === "6.85", "new stop at break-even on the nickel: " + stops().join(","));
  const l = live();
  assert(l.stop_price === 6.85 && l.stop_order_id && l.stop_order_id !== "S1" && l.stop_prev_order_id === "S1", "books carry the new stop: " + JSON.stringify(l));
  assert(l.stop_be && l.stop_be.from === 5.55 && l.stop_be.to === 6.85 && !l.stop_be.error, "move recorded: " + JSON.stringify(l.stop_be));
  assert(l.stop_tries === 1, "the move does not use up a stop try: " + l.stop_tries);
  assert(st().recon.ok === true, "books clean although Robinhood's list still shows S1 and not the new one: " + JSON.stringify(st().recon));
  assert(TABLES.winston_trades[0].status === "open" && sells().length === 0, "trade keeps running");
  assert(TABLES.winston_log.some((x) => x.kind === "live_order" && /MOVED/.test(JSON.stringify(x.data))), "MOVED logged");
  // next look: Robinhood shows S1 pending cancel and the new stop working -> nothing more happens
  WORKING.length = 0; WORKING.push({ id: "S1", state: "pending_cancelled" }, { id: l.stop_order_id, state: "confirmed" });
  const n = CALLS.length;
  await X.liveSync(cfg, "2026-11-04", 635);
  assert(!CALLS.slice(n).some((c) => c.tool === "cancel_option_order" || c.tool === "place_option_order"), "moved once only");
  assert(st().recon.ok === true, "still clean (the old stop is one Winston sent): " + JSON.stringify(st().recon));
});

Deno.test("v5.9.10 no move without Profit 1, with the switch off, when the stop is already there, or when the bid is not above break-even", async () => {
  const quiet = async (label: string) => { await X.liveSync(cfg, "2026-11-04", 634); assert(cancels().length === 0 && stops().length === 0 && !live().stop_be, label + ": " + JSON.stringify(CALLS.map((c) => c.tool))); assert(st().recon.ok === true, label + " books clean"); };
  seed(cfg); STOP_OK = () => true; CANCEL_OK = true; await spyTrade({ p1: false }); await quiet("no Profit 1");
  seed(cfg); TABLES.winston_settings.push({ key: "live_limits", value: { stop_be_after_p1: false } }); await spyTrade(); await quiet("switch off");
  seed(cfg); await spyTrade({ live: { stop_price: 6.85 } }); await quiet("already at break-even");
  seed(cfg); await spyTrade({ plan: { last_mark: { bid: 6.9, ask: 7.0 } } }); await quiet("bid 6.90 is not above 6.90 (the coarse step)");
  assert(X.liveLimitsOf(null).stop_be_after_p1 === true && X.liveLimitsOf({ stop_be_after_p1: false }).stop_be_after_p1 === false, "switch: on by default, off when set");
});

Deno.test("v5.9.10 new stop refused -> the old price goes back on, trade keeps its stop, no second attempt", async () => {
  seed(cfg); CANCEL_OK = true; STOP_OK = (p) => cents(p) === 555;
  await spyTrade();
  await X.liveSync(cfg, "2026-11-04", 634);
  assert(stops().join(",") === "6.85,6.90,5.55", "tried break-even (nickel, then dime), then the old price: " + stops().join(","));
  const l = live();
  assert(l.stop_price === 5.55 && l.stop_order_id && l.stop_order_id !== "S1" && l.stop_be.to === 5.55 && /refused/.test(l.stop_be.error), "old price back: " + JSON.stringify(l));
  assert(TABLES.winston_trades[0].status === "open" && sells().length === 0 && l.stop_tries === 1, "still open with a stop");
  assert(st().recon.ok === true, "books clean: " + JSON.stringify(st().recon));
  WORKING.length = 0; WORKING.push({ id: l.stop_order_id, state: "confirmed" });
  const n = CALLS.length;
  await X.liveSync(cfg, "2026-11-04", 635);
  assert(!CALLS.slice(n).some((c) => c.tool === "cancel_option_order" || c.tool === "place_option_order"), "no second attempt");
});

Deno.test("v5.9.10 new stop AND the old price refused -> sold at once (a real trade never runs without a stop)", async () => {
  seed(cfg); CANCEL_OK = true; STOP_OK = () => false;
  await spyTrade();
  await X.liveSync(cfg, "2026-11-04", 634);
  const t = TABLES.winston_trades[0];
  assert(t.status === "closed" && t.exit_reason === "no_broker_stop", "closed: " + t.status + " " + t.exit_reason);
  assert(sells().length === 1 && sells()[0].args.quantity === "1" && sells()[0].args.price === "8.51", "live contract sold at the bid: " + JSON.stringify(sells().map((c) => c.args)));
  assert(t.plan.live.exit_order_id && t.plan.live.no_stop_exit, "exit kept and marked");
});

Deno.test("v5.9.10 the old stop cannot be cancelled (it may have just filled) -> nothing is placed, the old stop stays in the books", async () => {
  seed(cfg); STOP_OK = () => true; CANCEL_OK = false;
  await spyTrade();
  await X.liveSync(cfg, "2026-11-04", 634);
  const l = live();
  assert(stops().length === 0 && l.stop_order_id === "S1" && l.stop_price === 5.55, "old stop untouched: " + JSON.stringify(l));
  assert(/cancel/.test(l.stop_be.error) && TABLES.winston_trades[0].status === "open" && sells().length === 0, "noted, trade open");
  CANCEL_OK = true;
});

Deno.test("v5.9.10 the old stop fills while it is being cancelled -> no new stop; the next look books the stop-out", async () => {
  seed(cfg); STOP_OK = () => true; CANCEL_OK = true;
  await spyTrade();
  ON_CANCEL = () => { ORDERS.push({ id: "S1", state: "filled", legs: [{ executions: [{ price: "5.50", quantity: "1" }] }] }); };   // it fills between the list read and the cancel
  await X.liveSync(cfg, "2026-11-04", 634); ON_CANCEL = null;
  const l = live();
  assert(stops().length === 0 && l.stop_order_id === "S1" && /filled first/.test(l.stop_be.error), "no new stop, old id kept: " + JSON.stringify(l));
  WORKING.length = 0; POS.length = 0;
  await X.liveSync(cfg, "2026-11-04", 635);
  assert(live().stop_filled === true && live().exit_fill === 5.5 && live().pnl === -132, "stop-out booked: " + JSON.stringify(live()));
  assert(stops().length === 0, "still no new stop");
});
