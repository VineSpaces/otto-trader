// v5.7 (6 Nov 2026) — practice fill at the TAP, the why right after, and Josh's own target.
// Josh's ask: "enter me when I press the button, not after my why — but still make me answer."
// The MU 695P on 6 Nov: the fill was read when the why was SUBMITTED (56 s after the tap), the card's TP1 was $1.19 from the fill,
// the rule exit fired for +$52 on a trade meant to ride to 683 (~$900–1,000). Nothing touches the network: Supabase and Robinhood are faked.
// Run: deno test -A --no-check supabase/tests/v570_test.ts
const ID = "57575757-5757-4757-8757-575757575757", ID2 = "58585858-5858-4858-8858-585858585858";
const mk = (id: string, status: string, extra: any = {}) => ({
  id, title: "PAPER — SCALP · MU 695P 11/09 @ 17.25 — 716.5 breakdown", status, created_at: new Date(Date.now() - 60e3).toISOString(), created_by: "watcher",
  summary: "", review: "", result: null, decided_at: null,
  calls: [{ service: "rh", tool: "place_option_order", args: { legs: [{ option_id: "opt-mu", side: "buy", position_effect: "open" }], quantity: "1", type: "limit", price: "17.25" } }],
  plan: { tv_symbol: "NASDAQ:MU", direction: "down", tp1: 700, stop: 716.5, entry_underlying: 707.51, origin: "coach_level", setup: "breakdown", ...(extra.plan || {}) },
  exit: { state: "planned", entry_limit: 17.25, qty: 1, tp1: 700, wrong_if: 716.5 }, checks: [], risk: {}, banner: null, outcome: null, ...extra,
});
let ROWS: any[] = [];
let UNDER = "701.19";
const rhCalls: string[] = [], dbWrites: string[] = [], desk: string[] = [];
(globalThis as any).__OTTO_TEST__ = {
  db: (path: string, init: any = {}) => {
    const m = (init.method || "GET").toUpperCase();
    if (m !== "GET") dbWrites.push(m + " " + path);
    if (path.startsWith("otto_desk")) { if (m === "POST") desk.push(String(JSON.parse(init.body || "{}").content || "")); return Promise.resolve([]); }
    if (path.startsWith("otto_actions?")) {
      const id = /id=eq\.([0-9a-f-]{36})/i.exec(path)?.[1];
      let rows = ROWS.filter((r) => !id || r.id === id);
      const st = /status=eq\.(\w+)/.exec(path)?.[1];
      if (st) rows = rows.filter((r) => r.status === st);
      if (m === "PATCH") { rows.forEach((r) => Object.assign(r, JSON.parse(init.body))); return Promise.resolve(rows.map((r) => ({ ...r }))); }
      return Promise.resolve(rows.map((r) => ({ ...r })));
    }
    return Promise.resolve([]);
  },
  call: (_s: string, tool: string) => {
    rhCalls.push(tool);
    const j = (o: any) => ({ content: [{ type: "text", text: JSON.stringify(o) }] });
    if (tool === "get_option_quotes") return Promise.resolve(j({ data: { results: [{ quote: { ask_price: "20.75", delta: "-0.438691" } }] } }));
    if (tool === "get_equity_quotes") return Promise.resolve(j({ data: { results: [{ quote: { symbol: "MU", last_trade_price: UNDER } }] } }));
    return Promise.reject(new Error("unexpected Robinhood tool: " + tool));
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
const WHY = { setup: "broke past support on the 10", why_now: "breakdown past support confirmed", kills: "MU 5-min close over 716.5" };
const post = (body: any) => HANDLER(new Request("https://x.test/functions/v1/otto-proxy?fn=act", { method: "POST", headers: { authorization: "Bearer " + GOOD, "content-type": "application/json" }, body: JSON.stringify(body) }));
function assert(c: unknown, msg: string) { if (!c) throw new Error("ASSERT: " + msg); }
const reset = () => { rhCalls.length = 0; dbWrites.length = 0; desk.length = 0; UNDER = "701.19"; };

Deno.test("v5.7 fill_now: Approve fills at the TAP with no why — paper_taken, why_pending, fill stamped, target checked, no order tool", async () => {
  ROWS = [mk(ID, "paper_wait")]; reset();
  const t0 = Date.now();
  const r = await post({ id: ID, decision: "approve", fill_now: true }); const j = await r.json();
  assert(r.status === 200 && j.ok && j.action.status === "paper_taken", "taken: " + JSON.stringify(j).slice(0, 200));
  const p = j.action.plan;
  assert(p.why_pending === true && !p.josh_why, "why pending, none attached: " + JSON.stringify(p).slice(0, 200));
  assert(p.paper_fill.ask === 20.75 && p.paper_fill.underlying === 701.19 && Math.abs(Date.parse(p.paper_fill.at) - t0) < 5000, "fill at the tap: " + JSON.stringify(p.paper_fill));
  assert(p.tp_check && p.tp_check.close === true && p.tp_check.dist === 1.19, "TP1 700 is $1.19 from a 701.19 fill → close: " + JSON.stringify(p.tp_check));
  assert(rhCalls.every((t) => /^get_(option|equity)_quotes$/.test(t)) && !rhCalls.some((t) => /place_/.test(t)), "only quotes: " + rhCalls.join(","));
  assert(desk.some((d) => /Practice trade taken/.test(d) && /at the tap/.test(d) && /not answered yet/.test(d) && /target 700 is only \$1\.19/.test(d)), "desk line: " + desk.join(" | "));
});
Deno.test("v5.7 why_only: the three lines land on the taken card; Josh's own target 683 replaces the card's 700 on plan and exit", async () => {
  ROWS = [mk(ID, "paper_wait")]; reset();
  await post({ id: ID, decision: "approve", fill_now: true });
  const r = await post({ id: ID, why_only: true, why: WHY, tp1: "683" }); const j = await r.json();
  assert(r.status === 200 && j.ok && j.action.status === "paper_taken", "ok: " + JSON.stringify(j).slice(0, 200));
  const p = j.action.plan;
  assert(p.josh_why && p.josh_why.setup === WHY.setup && p.why_pending === false, "why attached: " + JSON.stringify(p.josh_why));
  assert(p.tp1 === 683 && p.tp1_card === 700 && j.action.exit.tp1 === 683, "target moved: plan " + p.tp1 + " card " + p.tp1_card + " exit " + j.action.exit.tp1);
  assert(desk.some((d) => /Why for/.test(d) && /Josh set his target: 683 \(the card said 700\)/.test(d)), "desk: " + desk.join(" | "));
  assert(ROWS[0].plan.tp1 === 683 && ROWS[0].exit.tp1 === 683, "stored");
});
Deno.test("v5.7 why_only: a short why is refused and nothing changes; a target on the wrong side of the fill is ignored; a second attach is a no-op", async () => {
  ROWS = [mk(ID, "paper_wait")]; reset();
  await post({ id: ID, decision: "approve", fill_now: true });
  const bad = await post({ id: ID, why_only: true, why: { setup: "short", why_now: "x", kills: "y" } });
  const jb = await bad.json();
  assert(!(bad.status === 200 && jb.ok && jb.action?.plan?.josh_why), "short why refused: " + JSON.stringify(jb).slice(0, 160));
  assert(ROWS[0].plan.why_pending === true && !ROWS[0].plan.josh_why, "still pending");
  const r = await post({ id: ID, why_only: true, why: WHY, tp1: 710 });      // a DOWN trade filled at 701.19: 710 is above the fill → not a target
  const j = await r.json();
  assert(j.action.plan.josh_why && j.action.plan.tp1 === 700 && j.action.plan.tp1_card == null && j.action.exit.tp1 === 700, "bad target ignored: " + JSON.stringify(j.action.plan).slice(0, 200));
  const n = dbWrites.length;
  const again = await (await post({ id: ID, why_only: true, why: { ...WHY, setup: "a different setup line entirely" }, tp1: 683 })).json();
  assert(again.action.plan.josh_why.setup === WHY.setup && again.action.plan.tp1 === 700 && dbWrites.length === n, "second attach changed nothing");
});
Deno.test("v5.7 the old path is unchanged: Approve WITH a why (no fill_now) attaches it in one step; without a why and without fill_now the gate still refuses", async () => {
  ROWS = [mk(ID, "paper_wait"), mk(ID2, "paper_wait")]; reset();
  const j = await (await post({ id: ID, decision: "approve", why: WHY })).json();
  assert(j.action.status === "paper_taken" && j.action.plan.josh_why.kills === WHY.kills && j.action.plan.why_pending === false, "one-step approve: " + JSON.stringify(j.action.plan).slice(0, 200));
  const r2 = await post({ id: ID2, decision: "approve" }); const j2 = await r2.json();
  assert(!(r2.status === 200 && j2.ok && j2.action?.status === "paper_taken"), "no why, no fill_now → refused: " + JSON.stringify(j2).slice(0, 160));
  assert(ROWS[1].status === "paper_wait", "card untouched");
});
Deno.test("v5.7 tpCheck: close when the target is within 0.5% of the fill or already passed; not close with room; both directions", () => {
  const down = { direction: "down", tp1: 700 };
  assert(P.tpCheck(down, 701.19).close === true, "701.19 → 700 is close");
  assert(P.tpCheck(down, 699).close === true && P.tpCheck(down, 699).dist === -1, "already passed");
  assert(P.tpCheck(down, 707.51).close === false && P.tpCheck(down, 707.51).dist === 7.51, "707.51 → 700 has room (1.06%)");
  const up = { direction: "up", tp1: 226.4 };
  assert(P.tpCheck(up, 225.5).close === true && P.tpCheck(up, 222).close === false, "calls");
  assert(P.tpCheck({ direction: "down" }, 700) === null && P.tpCheck(down, null) === null, "no target / no price → null");
});
Deno.test("v5.7 noWhy: a why left unanswered counts as an override after 5 minutes, not before, and never once answered", () => {
  const now = Date.now();
  const c = (min: number, extra: any = {}) => ({ status: "paper_taken", plan: { why_pending: true, paper_fill: { at: new Date(now - min * 60e3).toISOString() }, ...extra } });
  assert(P.noWhy(c(2), now) === false, "2 min: not yet");
  assert(P.noWhy(c(6), now) === true, "6 min: counts");
  assert(P.noWhy(c(6, { josh_why: WHY }), now) === false, "answered → no");
  assert(P.noWhy({ ...c(6), status: "rejected" }, now) === false, "only taken trades");
  assert(P.noWhy(mk(ID, "paper_taken"), now) === false, "a pre-v5.7 card (no why_pending) is not an override");
});
