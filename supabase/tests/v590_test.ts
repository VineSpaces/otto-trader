// v5.9 (11 Nov 2026) — OTTOPILOT, the REAL fn=autopilot route (the one the app calls). The trading logic is tested in v313_test.ts
// (the "v5.9 OttoPilot" tests, through the real proposeAction); here: the route is reachable for a Desk login only, switches on / off,
// saves the numbers, and answers a bad number with an error the app can show. Nothing touches the network.
// Run: deno test -A --no-check supabase/tests/v590_test.ts
const RealDate = Date; let NOW = RealDate.parse("2026-11-10T15:30:00Z");   // Tue 10 Nov 2026, 10:30 AM ET
class FakeDate extends RealDate { constructor(...a: any[]) { if (a.length) super(...(a as [any])); else super(NOW); } static now() { return NOW; } }
(globalThis as any).Date = FakeDate;
const SET: Record<string, any> = {};
const desk: string[] = [], rhCalls: string[] = [];
(globalThis as any).__OTTO_TEST__ = {
  db: (path: string, init: any = {}) => {
    const m = (init.method || "GET").toUpperCase();
    if (path.startsWith("otto_desk")) { if (m === "POST") desk.push(String(JSON.parse(init.body || "{}").content || "")); return Promise.resolve([]); }
    if (path.startsWith("otto_settings")) {
      if (m === "POST") { const b = JSON.parse(init.body); SET[b.key] = b.value; return Promise.resolve([]); }
      const k = /key=eq\.([\w]+)/.exec(path)?.[1] || "";
      return Promise.resolve(k in SET ? [{ value: SET[k] }] : []);
    }
    return Promise.resolve([]);
  },
  call: (_s: string, tool: string) => { rhCalls.push(tool); return Promise.resolve({ content: [{ type: "text", text: "{}" }] }); },
  brain: () => [], notify: () => {}, extract: () => [],
};
(globalThis as any).fetch = (u: any) => Promise.reject(new Error("network disabled in tests: " + String(u).slice(0, 80)));
let HANDLER: any = null;
(Deno as any).serve = (h: any) => { HANDLER = h; return { finished: Promise.resolve() }; };
await import("../otto-proxy.ts");
const b64 = (o: any) => btoa(JSON.stringify(o)).replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
const jwt = (claims: any) => b64({ alg: "none" }) + "." + b64(claims) + ".x";
const GOOD = jwt({ role: "authenticated", sub: "u1", email: "ottotrader@vinecreativestudio.com" });
const BAD = jwt({ role: "authenticated", sub: "u2", email: "stranger@example.com" });
const U = "https://x.test/functions/v1/otto-proxy?fn=autopilot";
const get = (tok = GOOD) => HANDLER(new Request(U, { headers: { authorization: "Bearer " + tok } }));
const post = (body: any, tok = GOOD) => HANDLER(new Request(U, { method: "POST", headers: { authorization: "Bearer " + tok, "content-type": "application/json" }, body: JSON.stringify(body) }));
function assert(c: unknown, msg: string) { if (!c) throw new Error("ASSERT: " + msg); }

Deno.test("v5.9 route fn=autopilot: off by default; a stranger is locked out; on by Josh, off by Ifoma; nothing is sent to Robinhood's order tools", async () => {
  const r0 = await get(); const j0 = await r0.json();
  assert(r0.status === 200 && j0.ok && j0.on === false && j0.cfg.max_trades === 3 && j0.cfg.max_losses === 2 && j0.cfg.last_entry_min === 900 && j0.clock === "open", "default: " + JSON.stringify(j0));
  const rs = await get(BAD);
  assert(rs.status === 403, "stranger: " + rs.status);
  const rp = await post({ on: true, author: "Josh" }, BAD);
  assert(rp.status === 403 && !SET.autopilot, "a stranger cannot switch it on");
  const j1 = await (await post({ on: true, author: "Josh" })).json();
  assert(j1.ok && j1.on === true && j1.by === "Josh" && j1.day === "2026-11-10" && j1.left === 3, "on: " + JSON.stringify(j1));
  assert(desk.some((d) => /🛫 OttoPilot ON — switched on by Josh/.test(d)), "desk: " + desk.join(" | "));
  const j2 = await (await post({ on: false, author: "Ifoma" })).json();
  assert(j2.ok && j2.on === false && j2.off.by === "Ifoma" && /switched off by Ifoma/.test(j2.off.reason), "off: " + JSON.stringify(j2));
  assert(desk.some((d) => /🛬 OttoPilot OFF — switched off by Ifoma\. OttoPilot took no trades\./.test(d)), "off line: " + desk.join(" | "));
  assert(!rhCalls.some((t) => /place_|cancel_|exercise/.test(t)), "no order tool: " + rhCalls.join(","));
});
Deno.test("v5.9 route fn=autopilot: the numbers save; a bad number comes back as an error and changes nothing; not a trading day → refused", async () => {
  const j = await (await post({ cfg: { max_trades: 4, max_losses: 1, last_entry: "14:45" }, author: "Ifoma" })).json();
  assert(j.ok && j.cfg.max_trades === 4 && j.cfg.max_losses === 1 && j.cfg.last_entry_min === 885, "saved: " + JSON.stringify(j.cfg));
  const rb = await post({ cfg: { max_trades: 99 }, author: "Ifoma" }); const jb = await rb.json();
  assert(jb.ok === false && /Trades a day must be between 1 and 10/.test(jb.error), "bad number: " + rb.status + " " + JSON.stringify(jb));
  const j3 = await (await get()).json();
  assert(j3.cfg.max_trades === 4, "unchanged after the bad save");
  NOW = RealDate.parse("2026-11-14T15:30:00Z");   // Saturday
  const js = await (await post({ on: true, author: "Josh" })).json();
  assert(js.ok === false && /market is closed today/.test(js.error), "weekend: " + JSON.stringify(js));
});
