// v5.9.3 (12 Nov 2026) — USAGE STAMPS on the Otto side: every Claude answer is metered on its way out and the answer itself is untouched.
// Run: deno test -A --no-check supabase/tests/v593_test.ts
const LOG: any[] = [];
(globalThis as any).__OTTO_TEST__ = { db: () => Promise.resolve([]), aiLog: (row: any) => LOG.push(row) };
Deno.env.set("SUPABASE_URL", "http://localhost"); Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "x");
const X: any = await import("../otto-proxy.ts");
const eq = (a: any, b: any, m: string) => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(m + ": got " + JSON.stringify(a) + " want " + JSON.stringify(b)); };
const SSE = [
  'event: message_start\ndata: {"type":"message_start","message":{"id":"m1","usage":{"input_tokens":1200,"cache_creation_input_tokens":8000,"cache_read_input_tokens":300,"output_tokens":1}}}',
  'event: content_block_delta\ndata: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"usage is a word in the answer"}}',
  'event: message_delta\ndata: {"type":"message_delta","delta":{"stop_reason":"end_turn"},"usage":{"output_tokens":412}}',
  'event: message_stop\ndata: {"type":"message_stop"}', ""].join("\n\n");

Deno.test("v5.9.3 aiUsage: a streamed answer (input + cache on message_start, final output on message_delta), a plain JSON answer, and junk", () => {
  eq(X.aiUsage(SSE), { tin: 1200, tout: 412, cache_w: 8000, cache_r: 300 }, "stream");
  eq(X.aiUsage(JSON.stringify({ content: [], usage: { input_tokens: 50, output_tokens: 7 } })), { tin: 50, tout: 7, cache_w: 0, cache_r: 0 }, "json");
  eq(X.aiUsage("not an answer"), null, "junk");
  eq(X.aiUsage(JSON.stringify({ error: { message: "overloaded" } })), null, "an error body has no usage");
});
Deno.test("v5.9.3 aiMeter: the answer reaches the caller byte for byte, in pieces, and one row is stamped with the tag and the model", async () => {
  LOG.length = 0;
  const enc = new TextEncoder(), bytes = enc.encode(SSE);
  const body = new ReadableStream({ start(c) { for (let i = 0; i < bytes.length; i += 37) c.enqueue(bytes.slice(i, i + 37)); c.close(); } });   // 37-byte pieces: events are split mid-line
  const out = await X.aiMeter(new Response(body, { status: 200, headers: { "content-type": "text/event-stream" } }), "run:signals", "claude-sonnet-4-6").text();
  eq(out, SSE, "untouched");
  eq(LOG.length, 1, "one stamp");
  eq([LOG[0].tag, LOG[0].model, LOG[0].tin, LOG[0].tout, LOG[0].cache_w, LOG[0].cache_r], ["run:signals", "claude-sonnet-4-6", 1200, 412, 8000, 300], "the row");
});
Deno.test("v5.9.3 aiMeter: an error answer or an answer with no usage is passed through and nothing is stamped", async () => {
  LOG.length = 0;
  const bad = new Response("overloaded", { status: 529 });
  if (X.aiMeter(bad, "x", "m") !== bad) throw new Error("an error response must be returned as is");
  eq(await X.aiMeter(new Response("hello"), "x", "m").text(), "hello", "passes through");
  eq(LOG.length, 0, "no stamp");
});
