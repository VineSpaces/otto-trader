// v4.9 (4 Nov 2026): the winston_live gateway in otto-proxy. Run: deno test -A --no-check supabase/tests/v490_proxy_test.ts   Nothing touches the network.
Deno.env.set("OTTO_RH_ACCOUNT", "945257012");
const SET: Record<string, any> = {}, SEEN: { tool: string; args: any }[] = [];
(globalThis as any).__OTTO_TEST__ = {
  db: (path: string) => {
    const m = /^winston_settings\?key=eq\.([a-z_]+)/.exec(path);
    if (m) return Promise.resolve(SET[m[1]] != null ? [{ value: SET[m[1]] }] : []);
    return Promise.resolve([]);
  },
  call: (service: string, tool: string, args: any) => { SEEN.push({ tool, args }); return Promise.resolve({ content: [{ type: "text", text: JSON.stringify({ data: { ok: true } }) }] }); },
  brain: () => [], notify: () => {}, extract: () => [],
};
(globalThis as any).fetch = (u: any) => Promise.reject(new Error("network disabled in tests: " + String(u).slice(0, 80)));
(Deno as any).serve = (_h: any) => ({ finished: Promise.resolve() });
const P: any = await import("../otto-proxy.ts");
function assert(c: unknown, msg: string) { if (!c) throw new Error("ASSERT: " + msg); }
const buy = (q = 1) => ({ legs: [{ option_id: "o", side: "buy", position_effect: "open" }], quantity: String(q), price: "2.40", type: "limit", time_in_force: "gfd", ref_id: "r" });
const sell = (q = 1) => ({ legs: [{ option_id: "o", side: "sell", position_effect: "close" }], quantity: String(q), type: "market", time_in_force: "gfd", ref_id: "r" });

Deno.test("v4.9 gateway check: closed when off; dry reads + reviews only; on adds place/cancel; caps and kill on the BUY", () => {
  const C = P.winstonLiveCheck;
  assert(!C("get_accounts", {}, "off", false, 1).ok, "off is closed, even for reads");
  for (const t of ["get_accounts", "get_portfolio", "get_option_positions", "get_option_orders", "get_trade_approval_setting"]) assert(C(t, {}, "dry", false, 1).ok, "dry may read " + t);
  assert(C("review_option_order", buy(), "dry", false, 1).ok, "dry may review");
  for (const t of ["place_option_order", "cancel_option_order"]) assert(!C(t, buy(), "dry", false, 1).ok, "dry refuses " + t);
  assert(C("place_option_order", buy(), "on", false, 1).ok && C("cancel_option_order", { order_id: "x" }, "on", false, 1).ok, "on allows place and cancel");
  assert(!C("place_option_order", buy(2), "on", false, 1).ok, "a buy over the contract cap is refused");
  assert(C("place_option_order", buy(2), "on", false, 2).ok, "…unless the cap was raised");
  assert(!C("place_option_order", buy(), "on", true, 1).ok, "kill is set: no new buy");
  assert(C("place_option_order", sell(3), "on", true, 1).ok, "kill is set: closing still allowed (that is the kill)");
  assert(!C("place_option_order", { ...buy(), ref_id: "" }, "on", false, 1).ok, "ref_id required");
  assert(!C("place_option_order", { ...buy(), legs: [buy().legs[0], buy().legs[0]] }, "on", false, 1).ok, "one leg only");
  assert(!C("place_option_order", { ...buy(), legs: [{ option_id: "o", side: "sell", position_effect: "open" }] }, "on", false, 1).ok, "no short opens");
  for (const t of ["place_equity_order", "cancel_equity_order", "exercise_option", "review_equity_order", "get_equity_positions", "get_pnl_trade_history", "create_alert", "place_crypto_order"]) assert(!C(t, {}, "on", false, 1).ok, "never on the list: " + t);
});

Deno.test("v4.9 gateway: forces the agentic account, reads the mode from winston_settings, refuses when off, never lets a buy through during a kill", async () => {
  SEEN.length = 0; SET.config = { live_mode: "off" };
  let g = await P.winstonLive({ tool: "get_option_positions", args: { account_number: "someone-else" } });
  assert(g.status === 403 && SEEN.length === 0, "off: refused and nothing called");
  SET.config = { live_mode: "dry" };
  g = await P.winstonLive({ tool: "get_option_positions", args: { account_number: "someone-else", nonzero: true } });
  assert(g.status === 200 && SEEN[0].args.account_number === "945257012", "the account argument is overwritten with the agentic account");
  g = await P.winstonLive({ tool: "place_option_order", args: buy() }); assert(g.status === 403, "dry: place refused");
  SET.config = { live_mode: "on" }; SET.kill_now = { at: "2026-11-04T15:00:00Z", by: "josh" };
  g = await P.winstonLive({ tool: "place_option_order", args: buy() }); assert(g.status === 403, "kill set: buy refused");
  g = await P.winstonLive({ tool: "place_option_order", args: sell() }); assert(g.status === 200, "kill set: sell-to-close goes through");
  SET.kill_now = {}; g = await P.winstonLive({ tool: "place_option_order", args: buy() }); assert(g.status === 200 && SEEN.at(-1).args.account_number === "945257012", "kill cleared: buy goes through on the agentic account");
  g = await P.winstonLive({ tool: "get_trade_approval_setting", args: {} }); assert(g.status === 200 && SEEN.at(-1).args.account_number === "945257012", "the approval setting is read for the agentic account (Robinhood requires it; found by the 4 Nov live probe)");
  g = await P.winstonLive({ tool: "get_accounts", args: {} }); assert(g.status === 200 && !("account_number" in SEEN.at(-1).args), "get_accounts is not given an account");
});
