// v5.0.2 (2 Nov 2026): TradingView alerts poll — at most every 5 minutes, and only while a trade with a live protective stop
// (exit.stop_order_id) is open. With nothing protected the poll never calls TradingView. The top-bar count keeps counting.
// Run: deno test -A --no-check supabase/tests/v502_test.ts     Nothing touches the network.
const RealDate = Date; let NOW = RealDate.parse("2026-11-02T15:00:00Z");
class FakeDate extends RealDate { constructor(...a: any[]) { if (a.length) super(...(a as [any])); else super(NOW); } static now() { return NOW; } }
(globalThis as any).Date = FakeDate;
Deno.env.set("OTTO_RH_ACCOUNT", "945257012");
let ROWS: any[] = [], SETTINGS: Record<string, any> = {}, TVCALLS: string[] = [];
(globalThis as any).__OTTO_TEST__ = {
  db: (path: string, init: any = {}) => {
    const m = (init.method || "GET").toUpperCase();
    if (path.startsWith("otto_actions?")) {
      let rows = ROWS;
      if (/exit->>state=eq\.armed/.test(path)) rows = rows.filter((r) => r.exit?.state === "armed");
      return Promise.resolve(rows.map((r) => ({ ...r })));
    }
    if (path.startsWith("otto_settings?key=eq.")) { const k = /key=eq\.([^&]+)/.exec(path)![1]; return Promise.resolve(SETTINGS[k] != null ? [{ value: SETTINGS[k] }] : []); }
    if (path.startsWith("otto_settings")) { if (m !== "GET") { try { const b = JSON.parse(init.body); const row = Array.isArray(b) ? b[0] : b; if (row?.key) SETTINGS[row.key] = row.value; } catch { /* */ } } return Promise.resolve([]); }
    return Promise.resolve([]);
  },
  call: (service: string, tool: string) => {
    if (service === "tv") { TVCALLS.push(tool); return Promise.resolve({ content: [{ type: "text", text: JSON.stringify([{ id: 1, symbol: "NASDAQ:TSLA" }]) }] }); }
    return Promise.reject(new Error("unexpected tool: " + tool));
  },
  brain: () => [], notify: () => {}, extract: () => [],
};
(globalThis as any).fetch = (u: any) => Promise.reject(new Error("network disabled in tests: " + String(u).slice(0, 80)));
(Deno as any).serve = (_h: any) => ({ finished: Promise.resolve() });
const M: any = await import("../otto-proxy.ts");
function assert(c: unknown, msg: string) { if (!c) throw new Error("ASSERT: " + msg); }
const armed = (stop: string | null) => ({ id: crypto.randomUUID(), title: "TSLA 420C", exit: { state: "armed", ...(stop ? { stop_order_id: stop } : {}) } });
const reset = (rows: any[] = []) => { (M as any).clearCacheForTest?.(); ROWS = rows; SETTINGS = {}; TVCALLS = []; NOW = RealDate.parse("2026-11-02T15:00:00Z"); };
const counted = () => M.tvCallsToday().n;

Deno.test("v5.0.2 nothing protected: the alerts poll makes NO TradingView call (no trade, or a trade with no stop), and answers from the saved copy", async () => {
  reset([]);
  const n0 = counted();
  let r = await M.tvAlertsPoll();
  assert(TVCALLS.length === 0 && counted() === n0, "no open trade -> zero TV calls, count unchanged");
  assert(r.ok && r.skipped === true && Array.isArray(r.v) && r.v.length === 0, "answers ok with an empty list");
  reset([armed(null), { id: "x", title: "closed", exit: { state: "closed", stop_order_id: "old" } }]);
  SETTINGS.alerts_cache = { alerts: [{ id: 9 }], at: "2026-11-02T10:00:00Z" };              // hours old — still no call
  r = await M.tvAlertsPoll();
  assert(TVCALLS.length === 0, "armed without a stop_order_id, and a closed trade with one -> zero TV calls");
  assert(r.v.length === 1 && r.v[0].id === 9 && r.skipped, "serves the saved copy, flagged as not polled");
  for (let i = 0; i < 30; i++) { NOW += 60_000; await M.tvAlertsPoll(); }                 // a half-hour of one-minute Desk polls
  assert(TVCALLS.length === 0, "30 minutes of polling with nothing protected -> still zero TV calls");
});

Deno.test("v5.0.2 a protected trade is open: one TradingView call, then at most one per 5 minutes; the top-bar count counts each", async () => {
  reset([armed("stop-123")]);
  const n0 = counted();
  let r = await M.tvAlertsPoll();
  assert(TVCALLS.length === 1 && TVCALLS[0] === "mcp-tv-list-alerts", "first poll calls TradingView once");
  assert(counted() === n0 + 1, "top-bar count went up by 1");
  assert(r.ok && !r.cached && r.v.length === 1, "fresh result returned");
  await new Promise((res) => setTimeout(res, 5));                                          // let the cache write land
  NOW += 60_000; r = await M.tvAlertsPoll();
  assert(TVCALLS.length === 1 && r.cached === true, "1 minute later: served from cache, no call");
  NOW += 3 * 60_000 + 50_000; r = await M.tvAlertsPoll();                                   // 4 min 50 s after the first
  assert(TVCALLS.length === 1 && r.cached === true, "4:50 after: still cached");
  NOW += 20_000; r = await M.tvAlertsPoll();                                                // 5 min 10 s after the first
  assert(TVCALLS.length === 2 && counted() === n0 + 2 && !r.cached, "5:10 after: exactly one more call (5-minute interval, not 10)");
  await new Promise((res) => setTimeout(res, 5));
  for (let i = 0; i < 4; i++) { NOW += 60_000; await M.tvAlertsPoll(); }                    // 4 more one-minute polls
  assert(TVCALLS.length === 2, "four more one-minute polls inside the window -> no extra call");
  ROWS = [];                                                                                 // the trade closes: the poll stops calling
  NOW += 10 * 60_000; await M.tvAlertsPoll();
  assert(TVCALLS.length === 2, "trade closed -> no further TradingView call even with an expired cache");
});
