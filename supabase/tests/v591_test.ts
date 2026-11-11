// v5.9.1 (11 Nov 2026) — the BAR DOWNLOADER for the backtest (checklist item 1), through the REAL fn=bars_pull route.
// Read-only market data: only get_equity_historicals is called; rows land in otto_bars; interpolated and bad bars are dropped and counted.
// Run: deno test -A --no-check supabase/tests/v591_test.ts
const RealDate = Date; let NOW = RealDate.parse("2026-11-11T15:00:00Z");
class FakeDate extends RealDate { constructor(...a: any[]) { if (a.length) super(...(a as [any])); else super(NOW); } static now() { return NOW; } }
(globalThis as any).Date = FakeDate;
let BARS: any[] = [];                       // what otto_bars would hold (upsert on symbol, tf, t)
const rh: { tool: string; args: any }[] = [];
let failOn = "";                            // a chunk start date that errors
const bar = (t: string, c: number, v: number, extra: any = {}) => ({ begins_at: t, open_price: String(c - 0.1), high_price: String(c + 0.3), low_price: String(c - 0.4), close_price: String(c), volume: v, session: "reg", ...extra });
(globalThis as any).__OTTO_TEST__ = {
  db: (path: string, init: any = {}) => {
    const m = (init.method || "GET").toUpperCase();
    if (path.startsWith("otto_bars")) {
      if (m === "POST") { for (const r of JSON.parse(init.body)) { const i = BARS.findIndex((x) => x.symbol === r.symbol && x.tf === r.tf && x.t === r.t); if (i >= 0) BARS[i] = r; else BARS.push(r); } }
      return Promise.resolve([]);
    }
    if (path.startsWith("otto_users") && /member9/.test(path) && m === "GET") return Promise.resolve([{ email: "member9@example.com", name: "Jay", role: "member", status: "active" }]);
    return Promise.resolve([]);
  },
  call: (_s: string, tool: string, args: any) => {
    rh.push({ tool, args });
    const j = (o: any) => ({ content: [{ type: "text", text: JSON.stringify(o) }] });
    if (tool !== "get_equity_historicals") return Promise.reject(new Error("unexpected Robinhood tool: " + tool));
    const day = String(args.start_time).slice(0, 10);
    if (day === failOn) return Promise.reject(new Error("API error 400: too many bars"));
    return Promise.resolve(j({ data: { results: (args.symbols as string[]).map((sy) => ({ symbol: sy, interval: args.interval, bars: [
      bar(day + "T14:30:00Z", sy === "SPY" ? 671.4 : 600.2, 2044316), bar(day + "T14:40:00Z", sy === "SPY" ? 670.18 : 599.5, 1661165),
      bar(day + "T14:50:00Z", 749.96, 0, { interpolated: true }),                                  // gap-fill: dropped
      { begins_at: day + "T15:00:00Z", open_price: "0", high_price: "1", low_price: "1", close_price: "1", volume: 5 },   // bad price: dropped
    ] })) } }));
  },
  brain: () => [], notify: () => {}, extract: () => [],
};
(globalThis as any).fetch = (u: any) => Promise.reject(new Error("network disabled in tests: " + String(u).slice(0, 80)));
let HANDLER: any = null;
(Deno as any).serve = (h: any) => { HANDLER = h; return { finished: Promise.resolve() }; };
const P: any = await import("../otto-proxy.ts");
const b64 = (o: any) => btoa(JSON.stringify(o)).replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
const jwt = (claims: any) => b64({ alg: "none" }) + "." + b64(claims) + ".x";
const GOOD = jwt({ role: "authenticated", sub: "u1", email: "ottotrader@vinecreativestudio.com" });
const BAD = jwt({ role: "authenticated", sub: "u2", email: "stranger@example.com" });
const post = (body: any, tok = GOOD) => HANDLER(new Request("https://x.test/functions/v1/otto-proxy?fn=bars_pull", { method: "POST", headers: { authorization: "Bearer " + tok, "content-type": "application/json" }, body: JSON.stringify(body) }));
function assert(c: unknown, msg: string) { if (!c) throw new Error("ASSERT: " + msg); }
const reset = () => { BARS = []; rh.length = 0; failOn = ""; };

Deno.test("v5.9.1 bars_pull: a 10-day range for SPY + QQQ is pulled in 5-day pieces and saved with volume; gap-fill and bad bars are dropped and counted; only market data is read", async () => {
  reset();
  const r = await post({ symbols: ["spy", "QQQ"], from: "2026-03-02", to: "2026-03-11" }); const j = await r.json();
  assert(r.status === 200 && j.ok && j.tf === "10minute" && j.calls === 2, "two 5-day calls: " + JSON.stringify(j).slice(0, 300));
  assert(rh.length === 2 && rh.every((x) => x.tool === "get_equity_historicals" && x.args.interval === "10minute" && x.args.bounds === "regular" && x.args.symbols.join() === "SPY,QQQ"), "calls: " + JSON.stringify(rh.map((x) => x.args)));
  assert(rh[0].args.start_time === "2026-03-02T00:00:00.000Z" && rh[0].args.end_time === "2026-03-07T00:00:00.000Z" && rh[1].args.end_time === "2026-03-12T00:00:00.000Z", "pieces cover from → to inclusive: " + rh.map((x) => x.args.start_time + "…" + x.args.end_time).join(" | "));
  assert(j.saved === 8 && j.by.SPY === 4 && j.by.QQQ === 4 && j.dropped.interpolated === 4 && j.dropped.bad === 4 && j.errors.length === 0, "counts: " + JSON.stringify(j));
  assert(BARS.length === 8 && BARS.every((b) => b.tf === "10minute" && b.v > 0 && b.h >= b.l), "rows: " + JSON.stringify(BARS[0]));
  const s0 = BARS.find((b) => b.symbol === "SPY" && b.t === "2026-03-02T14:30:00.000Z");
  assert(s0 && s0.c === 671.4 && s0.o === 671.3 && s0.v === 2044316, "the first SPY bar, exactly: " + JSON.stringify(s0));
  assert(j.first === "2026-03-02T14:30:00.000Z" && j.last === "2026-03-07T14:40:00.000Z", "first/last: " + j.first + " " + j.last);
  // pulling the same range again overwrites, it does not double
  await post({ symbols: ["SPY", "QQQ"], from: "2026-03-02", to: "2026-03-11" });
  assert(BARS.length === 8, "re-pull is idempotent: " + BARS.length);
});
Deno.test("v5.9.1 bars_pull: one failing piece is reported and the rest still saves; bad input is refused; a stranger is locked out", async () => {
  reset(); failOn = "2026-03-07";
  const j = await (await post({ symbols: ["SPY"], from: "2026-03-02", to: "2026-03-16", tf: "5minute" })).json();
  assert(j.ok && j.calls === 3 && j.errors.length === 1 && /2026-03-07: .*too many bars/.test(j.errors[0]) && j.saved === 4 && BARS.every((b) => b.tf === "5minute"), "partial: " + JSON.stringify(j));
  for (const [body, re] of [[{ symbols: [], from: "2026-03-02", to: "2026-03-03" }, /symbols/], [{ symbols: ["SPY; drop"], from: "2026-03-02", to: "2026-03-03" }, /symbols/],
    [{ symbols: ["SPY"], from: "2026-03-02", to: "2026-05-02" }, /at most 35 days/], [{ symbols: ["SPY"], from: "3/2/2026", to: "2026-03-03" }, /dates like/],
    [{ symbols: ["SPY"], from: "2026-03-05", to: "2026-03-02" }, /before from/], [{ symbols: ["SPY"], from: "2026-03-02", to: "2026-03-03", tf: "minute" }, /tf must be/]] as any[]) {
    const n = rh.length; const jb = await (await post(body)).json();
    assert(jb.ok === false && re.test(jb.error) && rh.length === n, "refused without a call: " + JSON.stringify(body) + " → " + JSON.stringify(jb));
  }
  const n = rh.length, rs = await post({ symbols: ["SPY"], from: "2026-03-02", to: "2026-03-03" }, BAD);
  assert(rs.status === 403 && rh.length === n, "stranger: " + rs.status);
  const MEMBER = jwt({ role: "authenticated", sub: "u3", email: "member9@example.com" });
  const rm = await post({ symbols: ["SPY"], from: "2026-03-02", to: "2026-03-03" }, MEMBER); const jm = await rm.json();
  assert(rm.status === 403 && /admin only/.test(jm.error) && rh.length === n, "a member (not the owner) cannot pull: " + rm.status + " " + JSON.stringify(jm));
  // a range that reaches past "now" stops at now (no call for the future)
  reset(); const jf = await (await post({ symbols: ["SPY"], from: "2026-11-10", to: "2026-11-20" })).json();
  assert(jf.calls === 1 && rh[0].args.end_time === "2026-11-11T15:00:00.000Z", "stops at now: " + JSON.stringify(rh.map((x) => x.args.end_time)));
  const g = P.barsRows({ data: { results: [{ symbol: "spy", bars: [bar("2026-03-02T14:30:00Z", 10, 3), { begins_at: "x", open_price: "1", high_price: "1", low_price: "1", close_price: "1" }, { begins_at: "2026-03-02T14:40:00Z", open_price: "5", high_price: "4", low_price: "6", close_price: "5", volume: 1 }] }] } }, "10minute");
  assert(g.rows.length === 1 && g.rows[0].symbol === "SPY" && g.bad === 2, "barsRows drops a bad time and high < low: " + JSON.stringify(g));
});
