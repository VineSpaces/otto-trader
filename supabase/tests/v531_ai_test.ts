// v5.3.1 (3 Nov 2026): Winston's AI call against a stand-in for api.anthropic.com that behaves like the real one did on 3 Nov:
// Opus 5.5 answers a FORCED tool choice with HTTP 400 "tool_choice: type "tool" and "any" are not supported for this model."
// Run: deno test -A --no-check supabase/tests/v531_ai_test.ts     Nothing touches the network.
Deno.env.set("ANTHROPIC_KEY", "test-key");
const LOG: { kind: string; data: any }[] = [];
(globalThis as any).__WINSTON_TEST__ = {
  db: (path: string, init: any = {}) => { if (path.startsWith("winston_log") && init.method === "POST") LOG.push(JSON.parse(init.body)); return Promise.resolve([]); },
};
type Call = { model: string; body: any; hasSignal: boolean };
let CALLS: Call[] = [], OPUS: "ok" | "text" | "overloaded" | "hang_error", SONNET: "ok" | "error";
const TOOL = { name: "decide", description: "x", input_schema: { type: "object", properties: {} } };
const reply = (o: any, status = 200) => Promise.resolve(new Response(JSON.stringify(o), { status, headers: { "content-type": "application/json" } }));
(globalThis as any).fetch = (u: any, init: any) => {
  if (!String(u).startsWith("https://api.anthropic.com/")) return Promise.reject(new Error("network disabled in tests: " + String(u).slice(0, 80)));
  const body = JSON.parse(init.body); CALLS.push({ model: body.model, body, hasSignal: !!init.signal });
  const toolUse = { content: [{ type: "text", text: "thinking out loud" }, { type: "tool_use", id: "t1", name: "decide", input: { answer: body.model } }], usage: { input_tokens: 100, output_tokens: 20 } };
  if (body.model === "claude-opus-5-5") {
    if (body.tool_choice) return reply({ type: "error", error: { type: "invalid_request_error", message: 'tool_choice: type "tool" and "any" are not supported for this model.' } }, 400);   // the real 3 Nov behaviour
    if (OPUS === "ok") return reply(toolUse);
    if (OPUS === "text") return reply({ content: [{ type: "text", text: "I would pass on everything." }], usage: { input_tokens: 90, output_tokens: 8 } });
    if (OPUS === "overloaded") return reply({ type: "error", error: { type: "overloaded_error", message: "Overloaded" } }, 529);
    return Promise.reject(new DOMException("The signal has been aborted", "TimeoutError"));
  }
  if (SONNET === "error") return reply({ type: "error", error: { type: "api_error", message: "sonnet down" } }, 500);
  if (body.tool_choice?.type !== "tool") return reply({ content: [{ type: "text", text: "no tool" }], usage: {} });
  return reply(toolUse);
};
const W: any = await import("../winston.ts");
function assert(c: unknown, msg: string) { if (!c) throw new Error("ASSERT: " + msg); }
const reset = (o: any, s: any) => { CALLS = []; LOG.length = 0; OPUS = o; SONNET = s; };

Deno.test("v5.3.1 Opus: asked with the tool offered and a plain instruction, never a forced tool_choice; its answer is used, no fallback", async () => {
  reset("ok", "ok");
  const r = await W.aiJson("SYS", "USER", TOOL);
  assert(CALLS.length === 1 && CALLS[0].model === "claude-opus-5-5", "one call, to Opus");
  assert(CALLS[0].body.tool_choice === undefined, "no tool_choice on the Opus request");
  assert(CALLS[0].body.tools?.[0]?.name === "decide" && /call(ing)? the tool "decide"/.test(CALLS[0].body.system) && CALLS[0].body.system.startsWith("SYS"), "tool offered, system prompt tells it to call the tool");
  assert(CALLS[0].hasSignal, "the Opus attempt has a timeout");
  assert(r.out.answer === "claude-opus-5-5" && r.model === "claude-opus-5-5" && r.usage.input === 100 && r.usage.output === 20, "Opus answer and its token usage returned");
  assert(!LOG.some((l) => l.kind === "ai_fallback"), "no fallback logged");
});
Deno.test("v5.3.1 Opus answers with text only (no tool call): one retry on Sonnet 4.6 with the forced choice, the switch is logged", async () => {
  reset("text", "ok");
  const r = await W.aiJson("SYS", "USER", TOOL);
  assert(CALLS.length === 2 && CALLS[1].model === "claude-sonnet-4-6", "second call goes to Sonnet 4.6");
  assert(CALLS[1].body.tool_choice?.type === "tool" && CALLS[1].body.tool_choice.name === "decide", "Sonnet gets the forced tool choice");
  assert(CALLS[1].body.system === "SYS" && !CALLS[1].hasSignal, "Sonnet request is the original shape: unchanged system prompt, no extra timeout");
  assert(r.out.answer === "claude-sonnet-4-6" && r.model === "claude-sonnet-4-6", "the Sonnet answer is returned");
  const fb = LOG.find((l) => l.kind === "ai_fallback");
  assert(fb && fb.data.from === "claude-opus-5-5" && fb.data.to === "claude-sonnet-4-6" && /no structured answer/.test(fb.data.msg), "ai_fallback logged with the reason");
});
Deno.test("v5.3.1 Opus overloaded (529) or timed out: same fallback to Sonnet", async () => {
  for (const mode of ["overloaded", "hang_error"] as const) {
    reset(mode, "ok");
    const r = await W.aiJson("SYS", "USER", TOOL);
    assert(CALLS.length === 2 && r.model === "claude-sonnet-4-6", mode + ": answered by Sonnet");
    assert(LOG.filter((l) => l.kind === "ai_fallback").length === 1, mode + ": one fallback logged");
  }
});
Deno.test("v5.3.1 both models fail: the error reaches the caller (so the tick logs ai_error as before) — nothing is swallowed or made up", async () => {
  reset("overloaded", "error");
  let err = ""; try { await W.aiJson("SYS", "USER", TOOL); } catch (e) { err = String((e as Error).message); }
  assert(/sonnet down/.test(err), "the Sonnet error is thrown, got: " + err);
  assert(CALLS.length === 2, "exactly two attempts, no loop");
});
Deno.test("v5.3.1 token usage is whatever the answering model reported (the cost line stays honest after a fallback)", async () => {
  reset("text", "ok");
  const r = await W.aiJson("SYS", "USER", TOOL);
  assert(r.usage.input === 100 && r.usage.output === 20, "usage comes from the Sonnet answer, not the discarded Opus reply");
});

// ---------- v5.4.1 (4 Nov 2026): Opus answers with SEVERAL tool calls; every one is read ----------
Deno.test("v5.4.1 Opus replies with three decide calls (one per idea): all three are merged into one answer; blocks and stop_reason are reported; max_tokens is 6000", async () => {
  reset("ok", "ok");
  const saved = (globalThis as any).fetch;
  (globalThis as any).fetch = (u: any, init: any) => {
    const body = JSON.parse(init.body); CALLS.push({ model: body.model, body, hasSignal: !!init.signal });
    return reply({ stop_reason: "end_turn", content: [
      { type: "text", text: "Looking at the four posts." },
      { type: "tool_use", id: "t1", name: "decide", input: { decisions: [{ ticker: "GOOGL", source: "coach:611" }], passes: [], notes: "" } },
      { type: "tool_use", id: "t2", name: "decide", input: { decisions: [], passes: [{ ticker: "FSLR", source: "coach:612", reason: "not in my list" }], notes: "mixed tape" } },
      { type: "tool_use", id: "t3", name: "decide", input: { decisions: [{ ticker: "AMD", source: "coach:616" }], passes: [{ ticker: "AAPL", source: "coach:614", reason: "past 5%" }] } },
    ], usage: { input_tokens: 5000, output_tokens: 900 } });
  };
  try {
    const r = await W.aiJson("SYS", "USER", TOOL);
    assert(CALLS.length === 1 && CALLS[0].body.max_tokens === 6000, "one Opus call with the 6000 cap: " + JSON.stringify(CALLS[0]?.body.max_tokens));
    assert(r.out.decisions.length === 2 && r.out.passes.length === 2 && r.out.notes === "mixed tape", "all three calls merged: " + JSON.stringify(r.out));
    assert(r.meta?.blocks === 3 && r.meta?.stop === "end_turn", "meta reports 3 blocks + stop reason: " + JSON.stringify(r.meta));
    assert(!LOG.some((l) => l.kind === "ai_fallback"), "no fallback");
  } finally { (globalThis as any).fetch = saved; }
});

// ---------- v5.8 (10 Nov 2026): prompt cache on the rulebook; a cache refusal can never make Winston blind ----------
Deno.test("v5.8 cache: the stable block goes first as its own text block with a 1-hour cache mark, the changing part second; cache tokens come back in usage", async () => {
  reset("ok", "ok");
  const saved = (globalThis as any).fetch;
  (globalThis as any).fetch = (u: any, init: any) => {
    const body = JSON.parse(init.body); CALLS.push({ model: body.model, body, hasSignal: !!init.signal });
    return reply({ content: [{ type: "tool_use", id: "t1", name: "decide", input: { ok: 1 } }], usage: { input_tokens: 700, output_tokens: 40, cache_creation_input_tokens: 5200, cache_read_input_tokens: 0 } });
  };
  try {
    const r = await W.aiJson("SYS", "DYNAMIC DATA", TOOL, 6000, "STABLE RULEBOOK");
    const m = CALLS[0].body.messages[0].content;
    assert(Array.isArray(m) && m.length === 2, "content is two blocks");
    assert(m[0].text === "STABLE RULEBOOK" && m[0].cache_control?.type === "ephemeral" && m[0].cache_control?.ttl === "1h", "stable block first, 1-hour cache mark");
    assert(m[1].text === "DYNAMIC DATA" && !m[1].cache_control, "dynamic block second, not cached");
    assert(r.usage.input === 700 && r.usage.cache_w === 5200 && r.usage.cache_r === 0, "usage carries the cache write: " + JSON.stringify(r.usage));
    reset("ok", "ok"); await W.aiJson("SYS", "PLAIN", TOOL);
    assert(CALLS[0].body.messages[0].content === "PLAIN", "no stable block: the request is exactly as before (plain string)");
  } finally { (globalThis as any).fetch = saved; }
});
Deno.test("v5.8 cache refused by the API (400): the same question is asked again as plain text on the SAME model, answered, and logged as ai_cache_off — no fallback, no blind tick", async () => {
  reset("ok", "ok");
  const saved = (globalThis as any).fetch;
  (globalThis as any).fetch = (u: any, init: any) => {
    const body = JSON.parse(init.body); CALLS.push({ model: body.model, body, hasSignal: !!init.signal });
    if (Array.isArray(body.messages[0].content)) return reply({ type: "error", error: { type: "invalid_request_error", message: "cache_control.ttl: extra inputs are not permitted" } }, 400);
    return reply({ content: [{ type: "tool_use", id: "t1", name: "decide", input: { answer: "plain" } }], usage: { input_tokens: 6000, output_tokens: 50 } });
  };
  try {
    const r = await W.aiJson("SYS", "DYNAMIC", TOOL, 6000, "STABLE");
    assert(CALLS.length === 2 && CALLS[1].body.messages[0].content === "STABLE\nDYNAMIC", "second call is the plain text, stable first: " + JSON.stringify(CALLS[1]?.body.messages[0].content));
    assert(CALLS[0].model === CALLS[1].model && r.out.answer === "plain", "same model answered");
    assert(LOG.some((l) => l.kind === "ai_cache_off" && /ttl/.test(l.data.msg)) && !LOG.some((l) => l.kind === "ai_fallback"), "ai_cache_off logged, no model fallback");
  } finally { (globalThis as any).fetch = saved; }
});
