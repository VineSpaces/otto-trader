// v4.6 (26 Oct 2026): EARS — live call audio → Whisper → levels → Desk draft / auto-arm.
// Run: deno test -A --no-check supabase/tests/v460_test.ts
const RealDate = Date; let NOW = RealDate.parse("2026-10-26T15:00:00Z");
class FakeDate extends RealDate { constructor(...a: any[]) { if (a.length) super(...(a as [any])); else super(NOW); } static now() { return NOW; } }
(globalThis as any).Date = FakeDate;
const setNow = (iso: string) => { NOW = RealDate.parse(iso); };
Deno.env.set("OTTO_RH_ACCOUNT", "945257012");
let WATCH: any[] = [], SET: Record<string, any> = {}, DESK: string[] = [], ACT: string[] = [], BRAINROWS: any[] = [], SEEDS: any[] = [];
let PX: Record<string, string> = { MU: "900", NVDA: "214", AAPL: "345", AMZN: "250", TSLA: "387", SPY: "760", PLTR: "194", AMD: "520", INTC: "89", SKHY: "140", MSFT: "520", GOOGL: "330", META: "640", NOC: "560", PANW: "390", TXN: "286", DLTR: "125", XOM: "180", FCX: "66", VZ: "44" };
let wId = 1; let TRANS: string[] = [], SAY: string[] = [], LEV: any[][] = [], BOOM = false;
const J = (o: any) => ({ content: [{ type: "text", text: JSON.stringify(o) }] });
(globalThis as any).__OTTO_TEST__ = {
  db: (path: string, init: any = {}) => {
    const m = (init.method || "GET").toUpperCase();
    if (path.startsWith("otto_watch")) {
      if (m === "POST") {
        const out: any[] = [];
        for (const r of JSON.parse(init.body)) { if (WATCH.some((x) => x.day === r.day && x.ticker === r.ticker && x.level === r.level && x.dir === r.dir)) continue; const n = { id: wId++, fired: {}, ...r }; WATCH.push(n); out.push(n); }
        return Promise.resolve(out);
      }
      if (m === "PATCH") { const id = Number(/id=eq\.(\d+)/.exec(path)?.[1]); const w = WATCH.find((x) => x.id === id); if (w) Object.assign(w, JSON.parse(init.body)); return Promise.resolve([]); }
      const t = /ticker=eq\.([A-Z.]+)/.exec(path)?.[1], lv = /level=eq\.([\d.]+)/.exec(path)?.[1];
      return Promise.resolve(WATCH.filter((r) => (!t || r.ticker === t) && (!lv || r.level === Number(lv)) && (!/status=eq\.watching/.test(path) || r.status === "watching")).map((r) => ({ ...r })));
    }
    if (path.startsWith("otto_settings")) {
      if (m === "POST") { const b = JSON.parse(init.body); SET[b.key] = b.value; return Promise.resolve([]); }
      const k = /key=eq\.([^&]+)/.exec(path)?.[1] || ""; return Promise.resolve(k in SET ? [{ value: SET[k] }] : []);
    }
    if (path.startsWith("otto_desk")) { if (m === "POST") DESK.push(JSON.parse(init.body).content || ""); return Promise.resolve([{ id: 1 }]); }
    if (path.startsWith("otto_activity")) { if (m === "POST") { const b = JSON.parse(init.body); ACT.push((Array.isArray(b) ? b[0] : b).text || ""); } return Promise.resolve([]); }
    return Promise.resolve([]);
  },
  call: (_s: string, tool: string, args: any) => {
    if (tool === "get_equity_quotes") return Promise.resolve(J({ data: { results: (args.symbols || []).filter((s: string) => PX[s]).map((s: string) => ({ quote: { symbol: s, last_trade_price: PX[s] } })) } }));
    return Promise.reject(new Error("unexpected tool " + tool));
  },
  brain: () => BRAINROWS, notify: () => {}, extract: () => [],
  transcribe: (a: string) => { TRANS.push(a); if (BOOM) throw new Error("transcription failed: OpenAI HTTP 401"); return Promise.resolve(SAY.shift() ?? ""); },
  earsExtract: (t: string) => Promise.resolve(LEV.shift() ?? []),
};
(globalThis as any).fetch = (u: any, init: any) => {
  const s = String(u);
  if (s.includes("/rest/v1/brain_versions")) { SEEDS.push(JSON.parse(init.body)); return Promise.resolve(new Response(JSON.stringify([{ version: 10 }]), { status: 201 })); }
  return Promise.reject(new Error("network disabled in tests: " + s.slice(0, 80)));
};
let HANDLER: any = null;
(Deno as any).serve = (h: any) => { HANDLER = h; return { finished: Promise.resolve() }; };
const M: any = await import("../otto-proxy.ts");
const b64 = (o: any) => btoa(JSON.stringify(o)).replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
const GOOD = b64({ alg: "none" }) + "." + b64({ role: "authenticated", sub: "u1", email: "ottotrader@vinecreativestudio.com" }) + ".x";
const route = async (fn: string, body: any = {}, qs = "") => (await HANDLER(new Request("https://x.test/functions/v1/otto-proxy?fn=" + fn + qs, { method: "POST", headers: { authorization: "Bearer " + GOOD, "content-type": "application/json" }, body: JSON.stringify(body) }))).json();
function assert(c: unknown, msg: string) { if (!c) throw new Error("ASSERT: " + msg); }
const reset = (iso = "2026-10-26T15:00:00Z") => { (M as any).clearCacheForTest?.(); WATCH = []; SET = { ears_mode: "draft" }; DESK = []; ACT = []; SEEDS = []; wId = 1; TRANS = []; SAY = []; LEV = []; BOOM = false; setNow(iso); };
const dropBrain = async () => { Deno.env.set("SUPABASE_URL", "https://x.supabase.co"); Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "svc"); await route("seed", [{ call: { date: "2000-01-01" }, levels: [] }]); DESK.length = 0; };   // the seed route clears the cached brain

const AUD = "A".repeat(400);
const chunk = (session: string, seq: number, min = seq) => ({ kind: "chunk", session, seq, min, audio: AUD, mime: "audio/webm" });
const L = (i: string, v: string, m: string) => ({ instrument: i, value: v, meaning: m });

Deno.test("v5.1 ears: Arm and Dismiss can be told which levels (ids); no ids still means every draft", async () => {
  reset(); await M.earsIn({ kind: "start", session: "t1" });
  SAY = ["NVDA and SPY and AMD and TSLA words"]; LEV = [[L("NVDA", "217", "above 217"), L("SPY", "778", "sell point"), L("AMD", "515", "break of 515"), L("TSLA", "383", "flip zone")]];
  await M.earsIn(chunk("t1", 1));
  const st0 = (await route("ears_state")).state; const ids = st0.levels.map((l: any) => l.id);
  assert(ids.length === 4 && st0.levels.every((l: any) => l.status === "draft"), "4 drafts");
  const a = await route("ears_arm", { author: "Ifoma", ids: [ids[0], ids[2]] });
  assert(a.armed === 2 && a.total === 2 && WATCH.length === 2, "armed only the 2 ticked: " + JSON.stringify(a));
  assert(WATCH.map((w) => w.ticker).sort().join() === "AMD,NVDA", "right two");
  let s = (await route("ears_state")).state;
  assert(s.levels.filter((l: any) => l.status === "draft").length === 2, "two still waiting");
  assert(!s.handled_at, "not marked handled while drafts remain");
  const d = await route("ears_dismiss", { author: "Ifoma", ids: [ids[1]] });
  assert(d.dismissed === 1, "dismissed one: " + JSON.stringify(d));
  s = (await route("ears_state")).state;
  assert(s.levels.find((l: any) => l.id === ids[1]).status === "dismissed" && s.levels.find((l: any) => l.id === ids[3]).status === "draft", "only the ticked one went");
  assert(!s.handled_at, "one draft still waiting → not handled");
  const rest = await route("ears_arm", { author: "Ifoma" });
  assert(rest.armed === 1 && WATCH.length === 3, "no ids = all remaining drafts");
  s = (await route("ears_state")).state; assert(!!s.handled_at, "handled once no drafts remain");
  const none = await route("ears_arm", { author: "Ifoma", ids: [999] });
  assert(none.total === 0, "unknown id arms nothing");
});

Deno.test("v5.1 ears replay of 2 Nov: current-price + range levels are held back (not armed) in Automatic, near-duplicates merge, real calls arm, skip reasons and the unsure fix work", async () => {
  reset(); SET.ears_mode = "auto"; await M.earsIn({ kind: "start", session: "t2" });
  SAY = ["PANW chopping at 370 and MU above 930 and QQQ weekly top 715 and weekly bottom 680 words words"];
  LEV = [[
    L("PANW", "370", "current price, chopping"), L("MU", "930", "above 930 targets 960"), L("MU", "931.5", "above 931.5 again"),
    L("QQQ", "715", "weekly top"), L("QQQ", "680", "weekly bottom"), L("XOM", "183", "current price, down 2%"),
    L("INTC", "65", "Intel at 65 bucks this morning"), L("SPY", "761.5", "must hold 761.5"), L("SPY", "762", "hold 762"),
    L("LEN", "88.5", "support 88.5"), L("LEN", "90", "above 90"),
  ]];
  const r = await M.earsIn(chunk("t2", 1));
  const st = (await route("ears_state")).state;
  const by = (t: string, v?: number) => st.levels.filter((l: any) => l.ticker === t && (v === undefined || l.level === v));
  assert(by("MU").length === 1 && by("MU")[0].status === "armed", "MU 930/931.5 merged and armed: " + JSON.stringify(by("MU")));
  assert(by("SPY").length === 1, "SPY 761.5/762 merged");
  for (const [t, v] of [["PANW", 370], ["XOM", 183], ["INTC", 65], ["QQQ", 715], ["QQQ", 680]] as [string, number][]) {
    const l = by(t, v)[0]; assert(l && l.status === "draft" && l.hold, `${t} ${v} held back as a draft: ` + JSON.stringify(l));
  }
  assert(by("QQQ", 715)[0].kind === "range" && by("PANW")[0].kind === "price", "kinds");
  assert(WATCH.map((w) => w.ticker).sort().join() === "MU,SPY", "only real calls on the Watcher: " + WATCH.map((w) => w.ticker + w.level).join());
  assert(st.levels.every((l: any) => l.said), "every level keeps the words around it");
  assert(DESK.some((d) => /Held back as drafts \(range \/ current price\): .*PANW 370/.test(d)), "post names the held ones");
  assert(r.waiting === 5 && st.unsure.length === 2 && st.unsure_items.length === 2, "unsure de-duped: " + JSON.stringify(st.unsure));
  // one-tap fix: LEN was really LEN-like ticker -> use a known name
  const f = await route("ears_fix", { author: "Ifoma", instrument: "LEN", ticker: "LEN" });
  assert(f.added === 2 && f.armed === 2, "fix adds and arms: " + JSON.stringify(f));
  assert((await route("ears_state")).state.unsure.length === 0, "unsure cleared");
  // words are only sent when asked for
  assert((await route("ears_state")).state.transcript === undefined, "no transcript by default");
  assert(/PANW chopping/.test((await route("ears_state", { words: true })).state.transcript), "transcript on request");
  // tap Arm on a held one
  const a = await route("ears_arm", { author: "Ifoma", ids: [by("QQQ", 715)[0].id] });
  assert(a.armed + a.skipped === 1, "held level can be armed anyway");
});

Deno.test("v5.1 ears: a level the 10%-from-price gate refuses keeps its reason", async () => {
  reset(); SET.ears_mode = "auto"; PX.AMGN = 300; await M.earsIn({ kind: "start", session: "t3" });
  SAY = ["AMGN add level at three eighty words here"]; LEV = [[L("AMGN", "380", "the add level, above 380")]];
  await M.earsIn(chunk("t3", 1));
  const l = (await route("ears_state")).state.levels[0];
  assert(l.status === "skipped" && /10%|far|from/i.test(l.why || ""), "skip reason kept: " + JSON.stringify(l));
});
