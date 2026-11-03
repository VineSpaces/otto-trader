// v5.3.1 (3 Nov 2026): who spends the TradingView quota — tallies by tool and route, a 14-day history, and a record of the first quota error.
// Run: deno test -A --no-check supabase/tests/v531_test.ts     Nothing touches the network.
const RealDate = Date; let NOW = RealDate.parse("2026-11-03T15:00:00Z");
class FakeDate extends RealDate { constructor(...a: any[]) { if (a.length) super(...(a as [any])); else super(NOW); } static now() { return NOW; } }
(globalThis as any).Date = FakeDate;
Deno.env.set("OTTO_RH_ACCOUNT", "945257012");
let SETTINGS: Record<string, any> = {}, FAIL: string | null = null;
(globalThis as any).__OTTO_TEST__ = {
  db: (path: string, init: any = {}) => {
    const m = (init.method || "GET").toUpperCase();
    if (path.startsWith("otto_settings?key=eq.")) { const k = /key=eq\.([^&]+)/.exec(path)![1]; return Promise.resolve(SETTINGS[k] != null ? [{ value: SETTINGS[k] }] : []); }
    if (path.startsWith("otto_settings")) { if (m !== "GET") { try { const b = JSON.parse(init.body); const row = Array.isArray(b) ? b[0] : b; if (row?.key) SETTINGS[row.key] = row.value; } catch { /* */ } } return Promise.resolve([]); }
    return Promise.resolve([]);
  },
  call: (service: string, tool: string) => {
    if (service === "tv") { if (FAIL) return Promise.reject(new Error(FAIL)); return Promise.resolve({ content: [{ type: "text", text: "{}" }] }); }
    return Promise.reject(new Error("unexpected tool: " + tool));
  },
  brain: () => [], notify: () => {}, extract: () => [],
};
(globalThis as any).fetch = (u: any) => Promise.reject(new Error("network disabled in tests: " + String(u).slice(0, 80)));
(Deno as any).serve = (_h: any) => ({ finished: Promise.resolve() });
const M: any = await import("../otto-proxy.ts");
function assert(c: unknown, msg: string) { if (!c) throw new Error("ASSERT: " + msg); }
const tick = () => new Promise((r) => setTimeout(r, 10));

Deno.test("v5.3.1 every counted TradingView call is tallied by tool and by route; the history keeps the finished day; the first quota error is recorded once", async () => {
  assert(typeof M.setTvRoute === "function", "setTvRoute exported");
  assert(typeof M.tvCallsToday === "function", "tvCallsToday exported");
  // Drive the counter through the real alerts poll (it calls mcp-tv-list-alerts when a protected trade is open) is covered in v502;
  // here we call the exported gateway path, which goes through call().
  const g = async (tool: string, route: string) => { M.setTvRoute(route); return await M.winstonGateway({ service: "tv", tool, args: {} }); };
  await g("mcp-tv-get-economic-calendar", "winston_data");
  await g("mcp-tv-get-economic-calendar", "winston_data");
  await g("mcp-tv-get-news", "winston_data");
  await g("mcp-tv-get-ohlcv", "market");
  const t = M.tvCallsToday();
  assert(t.n === 4 && t.day === "2026-11-03", "four calls counted for the day, got " + t.n);
  assert(t.by["mcp-tv-get-economic-calendar"] === 2 && t.by["mcp-tv-get-news"] === 1 && t.by["mcp-tv-get-ohlcv"] === 1, "tallied by tool");
  assert(t.fn["winston_data"] === 3 && t.fn["market"] === 1, "tallied by route");
  // first quota error: recorded once, with the tallies as they stood
  FAIL = "TradingView quota exceeded (QUOTA_EXCEEDED)";
  const r = await g("mcp-tv-get-news", "winston_data");
  assert(r.status === 502, "the failed call still fails the same way");
  await tick();
  const trip = SETTINGS.tv_quota_trip;
  assert(trip && trip.day === "2026-11-03" && trip.n === 5 && trip.route === "winston_data" && trip.by["mcp-tv-get-news"] === 2, "trip recorded with count, tallies and route");
  const at1 = trip.at; NOW += 60_000;
  await g("mcp-tv-get-news", "market"); await tick();
  assert(SETTINGS.tv_quota_trip.at === at1, "a second quota error the same day does not overwrite the first");
  FAIL = null;
  // next ET day: the finished day moves into the history, the counter restarts
  NOW = RealDate.parse("2026-11-04T15:00:00Z");
  await g("mcp-tv-get-news", "market"); await tick();
  const h = SETTINGS.tv_calls_hist;
  assert(Array.isArray(h) && h.length === 1 && h[0].day === "2026-11-03" && h[0].n >= 6 && h[0].by["mcp-tv-get-news"] >= 3, "history holds the finished day");
  assert(M.tvCallsToday().day === "2026-11-04" && M.tvCallsToday().n === 1, "new day restarts at 1");
});

Deno.test("v5.3.1 a non-quota TradingView error records no trip", async () => {
  SETTINGS = {}; FAIL = "TradingView timed out"; NOW = RealDate.parse("2026-11-05T15:00:00Z");
  await M.winstonGateway({ service: "tv", tool: "mcp-tv-get-news", args: {} }); await tick();
  assert(SETTINGS.tv_quota_trip == null, "no trip for a timeout");
});
