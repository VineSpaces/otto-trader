// v5.9.13 (28 Nov 2026): the PAPER / REAL lines on Winston's trade rows. winPR / winPRHtml are lifted out of index.html and run here.
// The fixtures are the live rows from 16-25 Nov (plan.live as stored), trimmed to the fields the card reads.
// Run: deno test -A --no-check supabase/tests/v5913_test.ts
const html = await Deno.readTextFile(new URL("../../index.html", import.meta.url));
function assert(c: unknown, msg: string) { if (!c) throw new Error("ASSERT: " + msg); }
function eq(a: any, b: any, msg: string) { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`ASSERT ${msg}: got ${JSON.stringify(a)} want ${JSON.stringify(b)}`); }
const i0 = html.indexOf("function winPR(t){"), i1 = html.indexOf("function winToday(j){");
assert(i0 > 0 && i1 > i0, "winPR and winPRHtml sit just above winToday");
const esc = (s: any) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const wm = (v: any) => v == null || !isFinite(+v) ? "—" : ((+v < 0 ? "−" : +v > 0 ? "+" : "") + "$" + Math.abs(+v).toLocaleString(undefined, { maximumFractionDigits: 0 }));
const F: any = new Function("esc", "wm", html.slice(i0, i1) + "\nreturn { winPR, winPRHtml };")(esc, wm);
const text = (h: string) => h.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

const SPY = { id: 74, status: "closed", qty: 1, entry_fill: "6.89", exit_fill: "9.65", pnl_realistic: "276", plan: { live: { mode: "on", filled: true, fill: 6.82, exit_fill: 9.65, pnl: 283, entry_order_id: "a", ticket: { qty: 1 } } } };
const AAPL = { id: 75, status: "closed", qty: 2, entry_fill: "5.6", exit_fill: "6.05", pnl_realistic: "90", plan: { live: { mode: "on", filled: true, fill: 5.6, exit_fill: 6.05, pnl: 45, entry_order_id: "b", ticket: { qty: 1 } } } };
const NVDA = { id: 77, status: "closed", qty: 2, entry_fill: "5.95", exit_fill: "5.75", pnl_realistic: "-40", plan: { live: { mode: "on", filled: true, fill: 5.89, exit_fill: 5.75, pnl: -14, entry_order_id: "c", ticket: { qty: 1 } } } };
const COIN = { id: 73, status: "closed", qty: 2, entry_fill: "4.3", exit_fill: "4.1", pnl_realistic: "-40", plan: { live: { mode: "on", filled: true, fill: 4.3, exit_fill: 4.35, pnl_live: 5, live_qty: 1, entry_order_id: "d", ticket: { qty: 1 } } } };
const AMZN = { id: 76, status: "closed", qty: 2, entry_fill: "4.45", exit_fill: "4.15", pnl_realistic: "-60", plan: { live: { mode: "on", ticket: { qty: 1 }, refused: "1 open is the cap of 1" } } };
const DRY = { id: 71, status: "closed", qty: 2, entry_fill: "6.47", exit_fill: "6.24", pnl_realistic: "-46", plan: { live: { mode: "dry", ticket: { qty: 1 } } } };

Deno.test("v5.9.13 REAL line: filled trades show the real fills and result from plan.live, next to the paper ones", () => {
  eq(F.winPR(SPY), { paper: { qty: 1, inP: 6.89, outP: 9.65, pnl: 276, open: false }, real: { kind: "filled", qty: 1, inP: 6.82, outP: 9.65, pnl: 283, open: false, note: null } }, "SPY 727P 19 Nov");
  eq(text(F.winPRHtml(SPY)), "PAPER 1 contract · $6.89 → $9.65 +$276 REAL 1 contract · $6.82 → $9.65 +$283", "SPY row");
  eq(text(F.winPRHtml(AAPL)), "PAPER 2 contracts · $5.60 → $6.05 +$90 REAL 1 contract · $5.60 → $6.05 +$45", "paper 2, real 1");
  eq(text(F.winPRHtml(NVDA)), "PAPER 2 contracts · $5.95 → $5.75 −$40 REAL 1 contract · $5.89 → $5.75 −$14", "the NVDA put");
  eq(text(F.winPRHtml(COIN)), "PAPER 2 contracts · $4.30 → $4.10 −$40 REAL 1 contract · $4.30 → $4.35 +$5", "COIN 18 Nov: closed by hand, the result is pnl_live");
  // the four real trades of the live test add up to +$319
  eq([SPY, AAPL, NVDA, COIN].reduce((s, t) => s + F.winPR(t).real.pnl, 0), 319, "real total");
});
Deno.test("v5.9.13 REAL line: no line on a rehearsal (dry / off); a refused or unfilled order says so in words; nothing is guessed", () => {
  eq(F.winPR(DRY).real, null, "dry = paper only"); assert(!/REAL/.test(F.winPRHtml(DRY)), "no REAL line on a dry trade");
  eq(F.winPR({ ...DRY, plan: {} }).real, null, "no live block = paper only");
  eq(text(F.winPRHtml(AMZN)), "PAPER 2 contracts · $4.45 → $4.15 −$60 REAL Not sent to Robinhood: 1 open is the cap of 1.", "AMZN 23 Nov: refused by the real cap");
  const open = { id: 9, status: "open", qty: 2, entry_fill: "2.58", plan: { live: { mode: "on", entry_order_id: "e", ticket: { qty: 1 } } } };
  eq(text(F.winPRHtml(open)), "PAPER 2 contracts · in at $2.58 — REAL Buy order sent. Fill not known yet.", "open, waiting for the fill");
  eq(F.winPR({ ...open, status: "closed", exit_fill: "2.6", pnl_realistic: "4" }).real.note, "Buy order never filled. No real money in this trade.", "closed with the buy never filled");
  const held = { ...open, plan: { live: { mode: "on", entry_order_id: "e", filled: true, fill: 2.55, ticket: { qty: 1 } } } };
  eq(text(F.winPRHtml(held)), "PAPER 2 contracts · in at $2.58 — REAL 1 contract · in at $2.55 —", "open and filled: no result yet");
  const noPrice = { ...open, plan: { live: { mode: "on", entry_order_id: "e", filled: true, ticket: { qty: 1 } } } };
  eq(text(F.winPRHtml(noPrice)), "PAPER 2 contracts · in at $2.58 — REAL Filled. Fill price not known yet.", "filled, price unknown");
  const noRes = { ...SPY, plan: { live: { ...SPY.plan.live, pnl: undefined } } };
  eq(text(F.winPRHtml(noRes)), "PAPER 1 contract · $6.89 → $9.65 +$276 REAL 1 contract · $6.82 → $9.65 result not on file", "sold, result missing: says so");
  eq(F.winPR({ ...open, plan: { live: { mode: "on", ticket: { qty: 1 } } } }).real.note, "Real order not placed yet.", "open, no order yet");
});
Deno.test("v5.9.13 the trade row uses the lines; the labels are words, not colour alone", () => {
  assert(html.includes("${winPRHtml(t)}</div></div>`};"), "the row renders winPRHtml");
  assert(!html.includes('<div class="p ${wn?"up":ls?"dn":""}">${o?"—":wm(+t.pnl_realistic)}</div>'), "the old single P&L column is gone");
  assert(/\.win43-pr \.tg\.re\{background:var\(--gold/.test(html), "REAL tag is gold");
  assert(html.includes('const BUILD="5.9.13"'), "BUILD bumped");
});
