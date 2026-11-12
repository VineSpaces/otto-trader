// Otto Trader — server side. One Edge Function.
//
//   v3.19 (7 Oct 2026): Lock today's plan — prep_lock (one ticker+side, entry level/how/timeframe, wrong-if, target; Jarvis
//   pass/fix check; entry level → Watcher; pinned on the Desk via watch_get.plans; every Jarvis run sees it); 4:05 PM plan vs
//   tape (trigger, target or wrong-if first) and vs today's Agentic opening trades (on / off plan). 018_v319.sql.
//   v3.18 (7 Oct 2026): 🌅 Morning Prep — otto_prep / otto_prep_imgs (017); prep_get/submit/reply/watch/img; Jarvis asks 2–3
//   questions first (prep_questions tool), then grades (prep_grade); levels → Watcher; 4:05 PM grade vs the tape (prepGradeTick).
//   score_extra: Signal speed, the coach's calls, self-test, morning-read stats.
//   v3.17 (7 Oct 2026): extension 1.3 support — edited posts / late charts (edited:true) update the message and are read
//   again (card only if fresh and not already carded); heartbeat carries unknown_authors / auto_scrolls; "scrolled_up" reason.
//   v3.16 (7 Oct 2026): Signals always end in a card or a reason (server pre-fetches the contracts, a call's last step is
//   forced to the card, no-card pings say why, the feed never shows working notes, result posts kept as 'result'); Jarvis's
//   promises are checked after every Desk reply (schedule_check makes "I'll check back at 1:30" real; unbacked promises get
//   one correction round); RUNNING RIGHT NOW list in every run; missed card pings swept; 9:10 Signal self-test;
//   TradingView breaker on Jarvis's tools and the alert-log reads; token-refresh race fixed. 016_v316.sql.
//   v3.9 (6 Oct 2026): Otto Signals. A Chrome extension on Ifoma's PC watches the mentor's
//   Discord channel live and posts each new message to ?fn=signal_in (x-otto-signal key);
//   Jarvis builds the card, both phones ping. Watcher-offline alert on the 2-min cron.
//   ?fn=signals_feed signal_img signals_cfg signals_cfg_set. No quiet hours on pings. 010_v39.sql.
//   v3.11: alertWatch posts + pushes each fire before marking it seen (no 5-per-run cap); a burst on a ticker whose card is
//   still being built is a 'followup' (no 2nd card / ping).
//   v3.10: a conversation under each Otto Signal (?fn=signal_chat / signal_chat_clear, otto_signal_chat — 011_v310.sql);
//   expired cards are marked expired and dropped from the panel's pending list.
//   v3.9.4: protected-trade alerts retried + honest fill push; stalled Otto Signals reads ping raw words; card builds skip TradingView.
//   v3.9.3: per-trade loss limit can be OFF (0); Otto Signals adds an ALT card when the best contract doesn't fit; feed read = final READ: only.
//   v3.9.2: Yahoo FIRST for banner + panel prices (TradingView = backup); watchlist from TV at most every 10 min;
//   TV breaker also trips on 429 / bad handshake. Exit engine — stop placed + saved before TradingView alerts; a TradingView failure no longer loses stop bookkeeping.
//   v3.12 (6 Oct 2026): TradingView alerts → Jarvis checks each fresh fire against the Otto Rules: card + ping, or quiet.
//     The mentor's name is never shown (unname / NAME_RULE); his rules are "the Otto Rules", his posts "Signal".
//   v3.9.1: ping first on a call; Jarvis's card build runs as its own invocation (?fn=signal_jarvis); stalled builds pinged.
//   v3.6 (5 Oct 2026): phone notifications (Web Push). ?fn=push_key push_sub push_list
//   push_remove push_test; notify() hooked into auto-close, fills, stops, alerts, cards.
//   v3.8.1 (5 Oct 2026): time budgets on TradingView/Robinhood calls; Yahoo price fallback on the Desk panel.
//   v3.8 (5 Oct 2026): your layout — ?fn=layout_get / layout_set (otto_settings "layout").
//   v3.7 (5 Oct 2026): Jason's calls. A pasted screenshot of Jason's Discord post
//   (desk body.jason) is read into otto_jason (call/level/note) and Jarvis drafts
//   the card; ?fn=jason_today / jason_score / jason_sweep (5 PM Discord sweep). 009_v37.sql.
//   v3.5 (5 Oct 2026): auto-close. Jarvis may sell to close any Agentic position
//   on his own (close_position) when the Settings switch is ON; scheduled position check.
//   v3.4 (5 Oct 2026): enter with the exit already set. Opening cards carry
//   plan.stop_option; after the fill Otto places the stop + TradingView alerts
//   and puts up a close card when one fires (otto_actions.exit, 008_v34.sql).
//   v3.3 (5 Oct 2026): ?fn=performance (Results page), limits_get/limits_set
//   (editable limits & goals, otto_settings), ?fn=help (app-questions chat).
//   v3.2 (5 Oct 2026): the AI is called Jarvis; ?fn=ticket (Buy/Sell form);
//   ?fn=cron_alerts (TradingView alert watcher, posts fires to the Desk).
//   v3.0 THE DESK (4 Oct 2026): ?fn=desk act panel desk_log oauth_start
//   oauth_finish conn_status disconnect whoami — see the DESK section below.
//
//   ?fn=market   the morning bias quotes
//   ?fn=chat     the Coach: a full AI trading assistant with Jason's corpus as
//                its foundation (search tool) plus web search, streamed
//   ?fn=brain    the corpus itself, for the Week / Insights tabs
//   ?fn=seed     write a new corpus version (POST a JSON array; v3.24: no public copy any more)
//   ?fn=write    plain Claude call for the app's small drafting jobs
//   ?fn=plan     grade the morning plan of attack (text + optional chart screenshot)
//   ?fn=routine  the six-step morning routine, live (Treasury.gov, Yahoo, Nasdaq calendar)
//   ?fn=news     'what's moving' — Claude with web search, for the catalyst box
//
// WHY IT ALL LIVES HERE
// No API key ever reaches a device. Rotating a key is one edit in Supabase and
// nothing on any phone breaks. And the Coach's retrieval loop cannot run in a
// browser — it needs several round trips to Claude before it has an answer.
//
// Secrets required:  ANTHROPIC_KEY  (console.anthropic.com) — the HOUSE room's key; every other room brings its own (v5.0)
// TD_KEY is no longer used — ?fn=market moved to Yahoo (yq()) on 18 Sep 2026,
// same free source ?fn=routine already used. See "Bug confirmed, 18 Sep 2026"
// in the project deploy-state doc for why.

const MODEL = "claude-sonnet-4-6";

/* ===================================================================== v5.0 ROOMS (29 Oct 2026)
   One project, one app, one brain — and every signed-in person gets a walled-off ROOM: their own broker/chart connections
   (otto_conn), their own Desk conversation (otto_desk), their own cards (otto_actions), their own Anthropic key + model
   (otto_users). The room is the lower-cased sign-in email. The HOUSE room (ottotrader@vinecreativestudio.com) is the one
   that existed before v5.0: every old row belongs to it through the SQL column DEFAULT (032_v500_rooms.sql), so cron,
   Winston and the Watcher — which carry no user — keep reading and writing house rows without a single change.
   HOW IT WORKS: the request handler puts the caller's email in an AsyncLocalStorage (ROOM) once deskUserAsync has let
   them in; owner() reads it anywhere downstream (tools, panel, scoring, journal, background work spawned in the request)
   and falls back to HOUSE when there is no store — i.e. on every cron / anonymous path. Table reads add owner=eq.<owner()>
   (OQ()), inserts carry owner: owner(), and the token / MCP-session caches are keyed owner|service (ck()).
   Winston stays house-only in this build (otto-proxy never reads winston_* tables; the app hides the tab for members). */
import { AsyncLocalStorage } from "node:async_hooks";
const HOUSE = "ottotrader@vinecreativestudio.com";
const ROOM = new AsyncLocalStorage<{ owner: string }>();
const owner = () => ROOM.getStore()?.owner || HOUSE;
const OQ = () => "owner=eq." + encodeURIComponent(owner()) + "&";                 // v5.0: PostgREST filter prefix for the room's rows
const ck = (service: string) => owner() + "|" + service;                             // v5.0: TOK / MSESS / REFRESHING cache key
export const ALLOWED_MODELS = ["claude-sonnet-4-6", "claude-sonnet-5-5", "claude-opus-5-5", "claude-fable-5-1"];
const MODEL_INFO = [                                                                  // v5.0: shown in Settings → Your AI key (rough, Desk-level use)
  { id: "claude-sonnet-4-6", label: "Sonnet 4.6", cost: "about $10–25/mo — the house default" },
  { id: "claude-sonnet-5-5", label: "Sonnet 5.5", cost: "about $20–40/mo" },
  { id: "claude-opus-5-5",   label: "Opus 5.5",   cost: "about $60–120/mo — the deepest thinker" },
  { id: "claude-fable-5-1",  label: "Fable 5.1",  cost: "about $40–80/mo" },
];

/* The Coach's prompt.

   History, for whoever edits this next:
   - Through 17 Sep 2026 this was a corpus-gated prompt hardened over four
     rounds of adversarial testing: answer only from Jason's calls, refuse
     anything he hadn't covered, and hard-lock three things (a stop price, a
     position size, a live buy/sell/hold call).
   - 18 Sep: flipped the default to "help first, Jason's voice when it
     applies, general knowledge tagged [not from Jason's calls]", locks kept.
   - 19 Sep 2026: Ifoma's product decision, verbatim: "act like a full AI
     trader assistant but it has knowledge from Jason, that's it, no
     guardrails." Offered the choice of keeping the three locks (A) or
     removing everything (B); he chose B. So: no source tags, no refusals,
     no locked topics. The Coach now answers stops, sizing, and open-position
     questions the way a general AI trading assistant would — with a real
     answer and ordinary trader caveats — using Jason's method as its
     foundation. What remains is accuracy, not restriction: don't put words
     in Jason's mouth, keep the options-2024 / futures-2026 distinction
     straight, and don't pretend to have a live price feed.
   The earlier hardened prompt lives in git history (commit 3ecf527 and
   before) and in jason-brain-system.md if it's ever wanted back. */
const SYSTEM = `You are Jarvis, the AI trading assistant inside Otto Trader (built on Jason Murray's method — say "Jarvis" if asked your name). You're built for Josh, a newer day trader mentored by Jason Murray of the iBelieve Investments Club, and you work the way a sharp, experienced trading partner would if he'd spent years absorbing Jason's teaching and made it the foundation of how he thinks. Charting, market structure, macro, sentiment, news on a name, order types, risk, stops, sizing, what to do with a trade he's in — whatever Josh brings you, you engage with it fully and give him a real answer, the way you would in any normal conversation with a knowledgeable trader.

JASON IS YOUR FOUNDATION, NOT YOUR FENCE. Jason's material — his rules, his setups, his three inputs (cost of capital, cost of transportation, cost of currency), his patience, his "more than one catalyst" standard — is the lens you reach for first. When he's taught on something, lead with his way of seeing it, in his own phrasing where it's vivid, because that's the voice Josh will actually remember under pressure. When he hasn't, you don't stop — you keep going and answer from everything else you know, plus a web search whenever the question is current, factual, or about a specific name. You don't label which part came from where. It's one voice: a trader who thinks like Jason and knows the rest of the market too.

HOW YOU FIND JASON'S MATERIAL. You have a tool, search_jason, over every word Jason and Lige said on the recorded calls and lessons. Use it whenever a question could touch the method, before you answer, and use it more than once with different wording when the first pass is thin — Josh won't use the right terms. When he describes an idea in his own language, search his phrasing, then search what it probably means. Follow-ups ("why does that matter", "tell me more") refer to what came before; search for that, not for his four words.

READING THE MATERIAL. Every block is headed [title · date · time · kind]. Kind "said" is raw transcript — his actual speech, verbatim, with an approximate time. Every other kind (rules, setups, insights, glossary, levels, routine, assignments) is a note written by whoever built the corpus, with an exact timestamp; text after \`| HIS WORDS:\` inside quotes is verbatim, the rest is paraphrase. Kind "questions" is a list of things Jason has NOT answered yet — don't read an answer out of one.

ONE METHOD, TWO TEACHERS. Jason runs Josh's coaching calls and taught the options and callouts lesson; Lige, his nephew, teaches the chart lessons on Jason's behalf. It's one sanctioned method. Don't rank one above the other or tell Josh to go check whether Jason agrees with Lige. Name who said something only when Josh would want to go listen to it.

POINT HIM AT THE TAPE. When you quote or lean on something specific from a call, note the call and time — "(Sep 3 call, 06:57)" — so Josh can go hear it himself. That's a courtesy, not a requirement for every sentence; general trading knowledge needs no citation at all.

THE RULES AND SETUPS BELOW ARE ALWAYS IN FRONT OF YOU. Everything else about the method you look up.

BE ACCURATE ABOUT WHAT'S JASON'S AND WHAT ISN'T. This isn't a restriction — it's what makes you trustworthy. Don't invent a rule and call it his. If Josh asks what Jason says about something and Jason hasn't said anything, tell him that in a sentence and then give him your own best answer. If Josh attributes something to a call you can't find, say you don't see it in the loaded material and answer on the merits anyway.

TWO INSTRUMENTS, TWO YEARS. The corpus has stock OPTIONS lessons from 2024 and FUTURES (ES/MES) coaching from 2026. Jason's "no more than 20% of the account in one trade" and his 2/5/10 contract ladder were said about options. When sizing or risk comes up, say which instrument and year a figure came from — then go ahead and reason about Josh's actual situation. If he asks whether 20% applies to futures, tell him Jason said it about options and hasn't said how it maps to futures, and then give him a straight answer about how you'd size an ES or MES position with his account and his rules.

STOPS, SIZE, AND HIS OPEN TRADE — ANSWER THEM. If Josh asks where his stop should go, give him a level and the reasoning: structure, the invalidation of the setup, ATR or the average, Lige's moving-average framing on the timeframe he's on, whatever fits. If he asks how many contracts, work it from his account, his risk per trade, and the distance to his stop, and give him a number. If he's in a trade and asks what to do, look at what he's told you and tell him what you'd do and why — hold, tighten, take partials, get out — the way a trading partner sitting next to him would. Give the number, then give the caveat, not the caveat instead of the number: it's his trade, he's on the chart and you aren't, and if the picture on his screen doesn't match what he described, the screen wins. Jason has never given a stop or a risk figure for his ES setups; say that once if it's relevant, then answer anyway.

HIS DISCIPLINE RULES ARE REMINDERS, NOT WALLS. Jason's "three instruments, bring a fourth to me first," "one contract until you're consistent," "no trading into the number," "watch the chart not the P&L" — bring these up when they bear on what Josh is doing, as a mentor's nudge ("worth flagging — Jason's rule is one contract until you're consistent"). Never refuse to help because of one.

NO LIVE FEED. You don't have a streaming quote. Don't state where something is trading right now as if you're watching it — ask Josh, use what he tells you, or web-search a recent price and date it. Corpus levels are marks from the day they were drawn; say so when you use one.

SPEAK AS ONE TRADER, NOT A TRANSCRIPT. Don't stack quotes. Synthesize — connect the macro read, the chart, the catalyst count, Jason's patience rule, and whatever general market context bears on the question into one line of reasoning in your own words, the way a mentor thinks out loud. Lead with the answer. Then the why.

TONE. Josh is new and reads this on a phone. Short paragraphs. Plain language; define a term the first time if it needs it. Keep Jason's vivid phrasing where you have it. Be direct — a straight answer with a clear caveat beats a hedge. Don't flatter him into overconfidence, and don't lecture. Be the trader he'd want next to him at 9:31.

=== JASON'S RULES AND SETUPS, IN FULL ===
{{RULES}}
=== END ===
`;

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET,POST,OPTIONS",
  "access-control-allow-headers": "authorization,apikey,content-type,x-otto-signal",
  "access-control-max-age": "86400",
};

/* ------------------------------------------------------------------ market */

const SYMBOLS = [
  { key: "yield",  sym: "IEF",     kind: "etf", invert: true,
    label: "10Y yield", via: "IEF (7-10yr Treasuries) — moves OPPOSITE to yield" },
  { key: "jpy",    sym: "USD/JPY", kind: "fx",  label: "USD/JPY", via: "spot, 24h" },
  { key: "dollar", sym: "UUP",     kind: "etf", label: "Dollar",  via: "UUP (dollar index ETF)" },
  { key: "crude",  sym: "USO",     kind: "etf", label: "Crude",   via: "USO (oil ETF)" },
  { key: "es",     sym: "SPY",     kind: "etf", label: "S&P",     via: "SPY (proxy for ES)" },
  { key: "nq",     sym: "QQQ",     kind: "etf", label: "Nasdaq",  via: "QQQ (proxy for NQ)" },
  { key: "ym",     sym: "DIA",     kind: "etf", label: "Dow",     via: "DIA (proxy for YM)" },
];

let MARKET_CACHE: { at: number; body: any } | null = null;

// TwelveData's free tier caps at 8 credits/minute and this route's 7-symbol
// batch already spent them all — any second call in the same window (a second
// tap, a second device, Claude probing this route to debug something else)
// tipped it into "provider HTTP 429" (found 18 Sep 2026, user-visible toast).
// Moved onto the same free Yahoo chart endpoint ?fn=routine already uses —
// no shared quota to exhaust. See the project deploy-state doc.
async function fetchQuotes() {
  if (MARKET_CACHE && Date.now() - MARKET_CACHE.at < 20_000) return MARKET_CACHE.body;

  const YSYM: Record<string, string> = {
    yield: "IEF", jpy: "JPY=X", dollar: "UUP", crude: "USO", es: "SPY", nq: "QQQ", ym: "DIA",
  };
  const errors: Record<string, string> = {};
  const grab = async <T,>(k: string, f: () => Promise<T>): Promise<T | null> => {
    try { return await f(); } catch (e) { errors[k] = String((e as Error).message ?? e); return null; }
  };

  const out: Record<string, unknown> = {};
  await Promise.all(SYMBOLS.map(async (s) => {
    const q = await grab(s.key, () => yq(YSYM[s.key]));
    if (!q) { out[s.key] = null; return; }
    let pct = q.pct;
    if (s.invert && pct != null && isFinite(pct)) pct = -pct;   // IEF rises when yields fall
    out[s.key] = {
      label: s.label, via: s.via, symbol: s.sym,
      price: q.price, prev: q.prev, pct,
      at: q.at,
      exchangeOpen: q.state === "REGULAR",
    };
  }));

  const body = { quotes: out, errors };
  MARKET_CACHE = { at: Date.now(), body };
  return body;
}

/* ------------------------------------------------------------------- brain */

let BRAIN: any[] | null = null;

async function loadBrain(): Promise<any[]> {
  if (BRAIN) return BRAIN;
  if (TEST?.brain) { BRAIN = await TEST.brain(); return BRAIN!; }
  // v3.24 (C6, Ifoma 8 Oct): the brain lives ONLY in Postgres (brain_versions), private to signed-in users.
  // The public brain-latest.json copy is gone from the repo; there is no fallback to it.
  const url = Deno.env.get("SUPABASE_URL");
  const svc = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !svc) throw new Error("no corpus: the service role isn't available to read brain_versions");
  const r = await fetch(url + "/rest/v1/brain_versions?select=payload&order=version.desc&limit=1",
    { headers: { apikey: svc, authorization: "Bearer " + svc } });
  if (!r.ok) throw new Error("no corpus: brain_versions couldn't be read (" + r.status + ")");
  const rows = await r.json();
  // A Coach that quietly knows nothing is worse than one that errors: it would
  // answer "he never covered that" to every question and sound authoritative.
  if (!Array.isArray(rows) || !rows[0]?.payload?.length) throw new Error("no corpus: brain_versions is empty — seed it with ?fn=seed (POST)");
  BRAIN = rows[0].payload;
  return BRAIN!;
}

// Same shape the app used, and for the same reason: the `said` field is his
// verbatim speech sitting inside a written note, so it stays fenced off from
// the prose around it. Only quoted words may ever be attributed to him.
type Chunk = { d: string; t: string; at: string; kind: string; s: string };

function chunksOf(calls: any[]): Chunk[] {
  const out: Chunk[] = [];
  for (const c of calls) {
    const d = c.call?.date || "undated", t = c.call?.title || "call";
    for (const par of String(c._transcript || "").split(/\n{2,}/)) {
      const m = par.match(/^\[([\d:]+)\]\s*([^:]{1,40}):\s*([\s\S]*)$/);
      const at = m ? m[1] : "", body = (m ? m[3] : par).replace(/\s+/g, " ").trim();
      for (let i = 0; i < body.length; i += 340) {
        const s = body.slice(i, i + 460).trim();
        if (s.length > 70) out.push({ d, t, at, s, kind: "said" });
      }
    }
    for (const k of ["assignments","rules","setups","insights","glossary","levels","routine","questions"]) {
      for (const o of (c[k] || [])) {
        const notes: string[] = [], quotes: string[] = [];
        for (const kk of Object.keys(o)) {
          const v = o[kk];
          if (typeof v !== "string") continue;
          if (/^(at|scope|source|file|id|for|status|channel|repeat)$/.test(kk)) continue;
          (kk === "said" ? quotes : notes).push(v);
        }
        let s = notes.join(" — ");
        if (quotes.length) s += ' | HIS WORDS: "' + quotes.join('" / "') + '"';
        if (o.scope) s += "\n!! SCOPE LIMIT: " + o.scope;
        if (s.length > 20) out.push({ d, t, at: o.at || "", s, kind: k });
      }
    }
  }
  return out;
}

const STOP = new Set(("the and for that with this what when how why his her they you your are was were has have had not " +
"but out get got all any can did does dont from into its like more most much now off one only our over said say see " +
"she some than them then there these those too use very want way well which who will would about after also back " +
"because been before being between both come could day each even first give good great just know last let make many " +
"need new same take tell thing think time two went work year").split(/\s+/));

function stem(t: string) {
  t = t.replace(/ies$/, "y");
  if (!/(ss|us|is|os)$/.test(t)) t = t.replace(/([^s])s$/, "$1");
  const r = t.replace(/(ing|ed)$/, "");
  if (r.length >= 3 && r !== t) t = r;
  if (/([bdfglmnprt])\1$/.test(t)) t = t.slice(0, -1);   // gapped -> gapp -> gap
  return t;
}
const norm = (s: string) => (String(s).toLowerCase().match(/[a-z0-9$.]{3,}/g) || [])
  .filter((t) => !STOP.has(t)).map(stem).filter((t) => t.length >= 3 && !STOP.has(t));

function search(cs: Chunk[], q: string, n = 14): Chunk[] {
  const key = (c: Chunk) => c.t + " " + c.s;   // the title is often the only place the word appears
  const df = new Map<string, number>();
  for (const c of cs) for (const t of new Set(norm(key(c)))) df.set(t, (df.get(t) || 0) + 1);
  const N = cs.length, terms = [...new Set(norm(q))];
  if (!terms.length) return [];
  const scored = cs.map((c) => {
    const words = norm(key(c)), tf = new Map<string, number>();
    for (const t of words) tf.set(t, (tf.get(t) || 0) + 1);
    let sc = 0, hit = 0;
    for (const t of terms) {
      const f = tf.get(t); if (!f) continue;
      hit++; sc += Math.log(1 + N / (1 + (df.get(t) || 0))) * (1 + Math.log(f));
    }
    if (!hit) return null;
    sc /= Math.sqrt(Math.max(words.length, 8));
    sc *= hit / terms.length;
    if (c.kind === "questions") sc *= 0.85;        // a gap is context, never the answer
    else if (c.kind !== "said") sc *= 1.25;        // curated notes beat raw talk
    return { ...c, sc };
  }).filter(Boolean).sort((a: any, b: any) => b.sc - a.sc) as any[];
  // No hard floor here, unlike the browser version. The model asks again with
  // better words when results are thin; a floor just hid the corpus from it.
  return scored.slice(0, n);
}

const fmt = (c: Chunk) => `[${c.t} · ${c.d}${c.at ? " " + c.at : ""} · ${c.kind}] ${c.s}`;

// Rules and setups are safety-critical, so they are never left to a search
// that might not run. They go in the system prompt every single turn.
function alwaysOn(calls: any[]) {
  const L: string[] = [];
  for (const c of calls) {
    const d = c.call?.date || "", t = c.call?.title || "call";
    for (const r of (c.rules || []))
      L.push(`RULE [${t} · ${d}${r.at ? " " + r.at : ""}] ${r.rule}${r.why ? " — " + r.why : ""}` +
             (r.scope ? `\n  !! SCOPE LIMIT: ${r.scope}` : ""));
    for (const s of (c.setups || []))
      L.push(`SETUP [${t} · ${d}${s.at ? " " + s.at : ""}] ${s.name} — take it: ${s.trigger || "not given"};` +
             ` wrong when: ${s.invalidation || "not given"}` + (s.scope ? `\n  !! SCOPE LIMIT: ${s.scope}` : ""));
  }
  return L.join("\n");
}

/* ---------------------------------------------------------------- plan */

/* Grades Josh's morning plan of attack against what Jason has taught. It
   grades the PROCESS — did he do what Jason told him to do before clicking —
   and it is bound by every refusal in the Coach prompt: no buy/sell, no size,
   no stop, no live-price arithmetic, nothing carried across instruments or
   years, nothing invented. Everything it praises or sends back must cite a
   call and a timestamp. */
const PLAN_SYS = `You are Jarvis, grading Josh's PLAN OF ATTACK for today before the market opens. Josh is a beginner mentored by Jason Murray (iBelieve Investments Club). You have Jason's standing rules and setups in full below, plus material retrieved from the recorded calls, and possibly a screenshot of the chart Josh marked up.

WHAT YOU ARE GRADING. Whether Josh did the homework Jason told him to do — not whether the trade will work. You have no live market data and no opinion on direction. Check his plan against what Jason actually said, item by item, and cite every item as (call, date, MM:SS). If Jason never addressed something, say "he has not covered that" — never fill the gap.

THE CHECKLIST — use only the items the material supports, and quote his words where they are vivid:
- The read: did Josh name the inputs Jason told him to check before the chart (the 10-year / cost of capital, crude / cost of transportation, USD/JPY / cost of currency) and say what they mean for stocks today?
- The catalyst: is there more than one reason beyond the chart? Jason: one indicator is useless, three is workable, five you can take to the bank.
- The instrument: is it SPY, QQQ, or one Mag-7 name — the three he allowed? Micron is off the list.
- The entry: is it at a level Jason's method recognises — a reclaim, a held gap, a box drawn top-of-gap to support — with confirmation, or is it "before the level"? A box only a few dollars wide is not a trade; wait for the expansion.
- The exit: is there a PT and an "I'm wrong at" level written BEFORE the trade? Note plainly that Jason has not taught stop placement; an invalidation is not a stop.
- The expiry: after Wednesday, not this Friday's contract — Tuesday/Wednesday or next week.
- Swinging: is he swinging into a binary event (NFP, earnings, the Fed)? Jason: never. Is he swinging at all when his rule right now is that his risk management IS not swinging?
- The screenshot, if there is one: what timeframe is it, is it cluttered with the overlays Jason told him to strip (CBC, order-block detector, VWAP) when marking levels, are the box and lines drawn where his method puts them, and — above all — is a P&L / account panel visible? Jason's first change for Josh is to watch the chart and never the P&L. Say what you can and cannot see; do not guess at prices from a picture.
- The mindset: does the plan read like a treasure hunt or like fear? Jason's words, not yours.

FORMAT — plain markdown, phone-sized, in this order and nothing else:
**Verdict:** one of "Defended — he'd let you take this", "Not yet defended — fix these first", or "Stand down today — this is a no-trade day by his rules". One sentence after it saying why.
#### What lines up
- bullet per item that matches his teaching, each with a citation
#### What Jason would send back
- bullet per item that misses, each with what he actually said and a citation
#### Before the open, answer these
- two or three questions Jason would ask him, in Jason's voice
#### Not covered
- anything the plan relies on that Jason has not taught (say "nothing" if none)

HARD LINES. Never write "buy", "sell", "take it", "this is a long/short", a contract count, a dollar risk, or a stop price. Never say whether his level is right relative to where price is now. Never compare an options figure with a futures one or carry anything across years; repeat any !! SCOPE LIMIT you rely on. Never invent a rule. If the plan is thin, say so plainly; do not congratulate him into confidence. Keep it under 350 words.

=== HIS RULES AND SETUPS, IN FULL ===
{{RULES}}
=== END ===

=== RETRIEVED FROM THE CALLS FOR THIS PLAN ===
{{MATERIAL}}
=== END ===
`;

function planText(p: any) {
  const f = (k: string, l: string) => p[k] ? `${l}: ${String(p[k]).slice(0, 600)}` : `${l}: (blank)`;
  return [
    f("read", "My read today"), f("why", "Why — the three inputs"), f("sym", "Instrument"),
    f("catalyst", "Catalyst"), f("exp", "Expiry"), f("entry", "Entry level"), f("pt", "PT"),
    f("wrong", "I'm wrong at"), f("swing", "Swing"), f("notes", "The plan"),
    p.hasImage ? "A screenshot of my marked-up chart is attached." : "No screenshot attached.",
  ].join("\n");
}

/* ------------------------------------------------------------- routine */

/* Jason's six-step morning routine (Intro Call, 17 Aug 2026, 17:57–23:20;
   tightened 3 Sep 2026, 36:40) — the same six things, live, from sources that
   don't need a key Josh has to paste:
     bonds       Treasury.gov daily CSV (official closes for 10Y / 2Y / curve)
                 + TradingView TVC:US10Y for the 10-year LIVE (24h — the
                   same Tradeweb-style number CNBC/TradingView show pre-market),
                   falling back to Yahoo ^TNX (CBOE, cash hours only) if that
                   fails. Switched 21 Sep 2026: ^TNX sat on Friday's 2:59 PM
                   print until ~8:20 AM Monday while CNBC already showed the
                   overnight move.
     USD/JPY     Yahoo JPY=X, spot
     commodities Yahoo USO / UNG / SLV / CPER (ETF proxies, as before)
     indexes     Yahoo SPY / QQQ / DIA with today's open, so "did they finish
                 below the open" is answered from real prints
     earnings    Nasdaq's calendar for the next 8 days, filtered to the watchlist
   Yahoo's v8 chart endpoint and Nasdaq's calendar are public but unofficial;
   every leg is fetched independently and reports its own error, so one source
   going dark leaves five cards standing rather than none. Results are cached
   in-memory for 45 s so a double tap (or two people) costs one fetch. */
const UA = { "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128 Safari/537.36",
             "accept": "application/json,text/plain,*/*" };

async function yq(sym: string) {
  const r = await fetch("https://query1.finance.yahoo.com/v8/finance/chart/" + encodeURIComponent(sym) +
                        "?range=1d&interval=5m", { headers: UA });
  if (!r.ok) throw new Error("yahoo HTTP " + r.status);
  const j = await r.json();
  const res = j?.chart?.result?.[0];
  if (!res?.meta) throw new Error(j?.chart?.error?.description || "no data");
  const m = res.meta, q = res.indicators?.quote?.[0] || {};
  const opens = (q.open || []).filter((x: any) => typeof x === "number");
  const price = Number(m.regularMarketPrice), prev = Number(m.chartPreviousClose ?? m.previousClose);
  return {
    price: isFinite(price) ? price : null,
    prev:  isFinite(prev)  ? prev  : null,
    open:  opens.length ? Number(opens[0]) : null,
    pct:   isFinite(price) && isFinite(prev) && prev ? ((price - prev) / prev) * 100 : null,
    at:    m.regularMarketTime ? Number(m.regularMarketTime) : null,
    state: m.marketState || null,
  };
}

/* The 10-year, live, around the clock. TradingView's public scanner endpoint
   (the same one its own site polls) carries TVC:US10Y — the Tradeweb-style
   cash yield — with a real update time, and it moves overnight and
   pre-market. Yahoo's ^TNX is CBOE's index and only prints during cash hours,
   so before ~8:20 AM ET it still shows the previous close, which is exactly
   what Ifoma caught on 21 Sep (app 5.00 @ Fri 2:59 PM vs CNBC 4.947 @ 8:00
   AM). Same shape as yq() so the client needs no change.
   prev = close[1] (the previous session's close), so the arrow is "since
   yesterday's close" the same way CNBC shows it. */
async function tvYield10() {
  const r = await fetch("https://scanner.tradingview.com/global/scan", {
    method: "POST",
    headers: { ...UA, "content-type": "application/json", "origin": "https://www.tradingview.com", "referer": "https://www.tradingview.com/" },
    body: JSON.stringify({ symbols: { tickers: ["TVC:US10Y"], query: { types: [] } },
                           columns: ["close", "close[1]", "update_time", "open"] }),
  });
  if (!r.ok) throw new Error("tradingview HTTP " + r.status);
  const j = await r.json();
  const d = j?.data?.[0]?.d;
  if (!Array.isArray(d) || typeof d[0] !== "number") throw new Error("tradingview: no US10Y row");
  const price = Number(d[0]), prev = Number(d[1]), at = Number(d[2]), open = Number(d[3]);
  if (!isFinite(price) || price <= 0 || price > 25) throw new Error("tradingview: bad yield " + d[0]);
  return {
    price,
    prev:  isFinite(prev) ? prev : null,
    open:  isFinite(open) ? open : null,
    pct:   isFinite(prev) && prev ? ((price - prev) / prev) * 100 : null,
    at:    isFinite(at) ? at : Math.floor(Date.now() / 1000),
    state: "24h",
    source: "tradingview",
  };
}

async function treasuryCloses() {
  const y = new Date().getUTCFullYear();
  const r = await fetch(`https://home.treasury.gov/resource-center/data-chart-center/interest-rates/daily-treasury-rates.csv/${y}/all?type=daily_treasury_yield_curve&field_tdr_date_value=${y}&page&_format=csv`, { headers: UA });
  if (!r.ok) throw new Error("treasury HTTP " + r.status);
  const lines = (await r.text()).trim().split(/\r?\n/);
  const head = lines[0].split(",").map((h) => h.replace(/"/g, "").trim());
  const i10 = head.indexOf("10 Yr"), i2 = head.indexOf("2 Yr");
  if (i10 < 0 || i2 < 0 || lines.length < 3) throw new Error("treasury csv shape changed");
  const row = (l: string) => { const c = l.split(","); const [mm, dd, yy] = c[0].split("/");
    return { date: `${yy}-${mm}-${dd}`, t10: parseFloat(c[i10]), t2: parseFloat(c[i2]) }; };
  const a = row(lines[1]), b = row(lines[2]);          // newest first
  return { t10: a.t10, t2: a.t2, date: a.date, prev10: b.t10, prev2: b.t2, prevDate: b.date };
}

async function earningsAhead(watch: string[], days = 8) {
  const want = new Set(watch.map((s) => s.toUpperCase()));
  const out: any[] = [];
  const dates: string[] = [];
  for (let i = 0; i < days; i++) { const d = new Date(Date.now() + i * 864e5); dates.push(d.toISOString().slice(0, 10)); }
  await Promise.all(dates.map(async (d) => {
    try {
      const r = await fetch("https://api.nasdaq.com/api/calendar/earnings?date=" + d, { headers: UA });
      if (!r.ok) return;
      const j = await r.json();
      for (const row of (j?.data?.rows || [])) {
        if (want.has(String(row.symbol).toUpperCase()))
          out.push({ date: d, sym: row.symbol, name: row.name, time: row.time === "time-pre-market" ? "before open"
                     : row.time === "time-after-hours" ? "after close" : "" });
      }
    } catch (_) { /* one day missing is not a failure */ }
  }));
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

let NEWS_CACHE: { at: number; text: string } | null = null;
let ROUTINE_CACHE: { at: number; key: string; body: any } | null = null;

async function routine(watch: string[]) {
  const key = watch.join(",");
  if (ROUTINE_CACHE && ROUTINE_CACHE.key === key && Date.now() - ROUTINE_CACHE.at < 45_000) return ROUTINE_CACHE.body;
  const errors: Record<string, string> = {};
  const grab = async <T,>(k: string, f: () => Promise<T>): Promise<T | null> => {
    try { return await f(); } catch (e) { errors[k] = String((e as Error).message ?? e).slice(0, 120); return null; }
  };
  const syms = ["USO", "UNG", "SLV", "CPER", "SPY", "QQQ", "DIA"];
  const [tnx, jpy, tsy, earn, ...qs] = await Promise.all([
    grab("t10live", async () => {
      try { return await tvYield10(); }
      catch (e) { errors.t10live_tv = String((e as Error).message ?? e).slice(0, 120); return { ...(await yq("^TNX")), source: "cboe" }; }
    }),
    grab("jpy", () => yq("JPY=X")),
    grab("treasury", treasuryCloses),
    grab("earn", () => earningsAhead(watch)),
    ...syms.map((s) => grab(s, () => yq(s))),
  ]);
  const quotes: Record<string, any> = {};
  syms.forEach((s, i) => { quotes[s] = qs[i]; });
  const body = { ok: true, served: Math.floor(Date.now() / 1000), t10live: tnx, jpy, treasury: tsy, earnings: earn || [], quotes, errors };
  ROUTINE_CACHE = { at: Date.now(), key, body };
  return body;
}

/* "What's moving?" — the story behind the numbers, for the catalyst box.
   Claude with web search, asked for five short lines with sources. This is
   the one place the app goes to the open web, and it is for the WHY, never
   for a number the cards already carry. */
async function whatsMoving(apiKey: string) {
  const day = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone: "America/New_York" });
  const r = await aiFetch("whats_moving", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({
      model: MODEL, max_tokens: 900,
      tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 4 }],
      system: "You write a five-line pre-market brief for a beginner US day trader. Today is " + day + ". Search for what is moving US markets this morning, then answer in EXACTLY this markdown shape and nothing else:\n" +
        "- **10-year:** one line — what it did and the reason given in the news\n- **Crude:** one line\n- **Dollar / yen:** one line\n- **Scheduled today:** the data releases or Fed speakers on today's calendar with times ET, or 'nothing major'\n- **Mag-7 with news:** which of Apple, Microsoft, NVIDIA, Amazon, Google, Meta, Tesla has a real catalyst today, one line each, max three\n" +
        "Plain words, no advice, no predictions, no 'buy' or 'sell'. DO NOT STATE ANY PRICE, YIELD OR PERCENTAGE — the app's own cards carry the live numbers and a stale figure from an article would contradict them; give direction and the reason only ('up after the jobs report beat', not '4.74%'). Each line under 30 words. End with a line 'Sources:' followed by the 2-4 URLs you used, one per line.",
      messages: [{ role: "user", content: "What's moving US markets this morning?" }],
    }),
  });
  const j = await r.json();
  if (j.error) throw new Error(j.error.message || "API error");
  return (j.content || []).filter((c: any) => c.type === "text").map((c: any) => c.text).join("").trim();
}

/* -------------------------------------------------------------------- chat */

const TOOLS = [
  {
    name: "search_jason",
    description:
      "Search everything Jason Murray and Lige actually said on the recorded calls and lessons. " +
      "Use it before answering anything about the method, and use it MORE THAN ONCE with different " +
      "wording when the first results are thin — Josh is a beginner and will not use the right terms. " +
      "If he describes an idea in his own words ('the thing where funds dump on regular people'), " +
      "search his phrasing first, then search the terms it might correspond to.",
    input_schema: {
      type: "object",
      properties: { query: { type: "string", description: "Words to look for in the transcripts and notes." } },
      required: ["query"],
    },
  },
  // 19 Sep 2026: the Coach is a full trading assistant now (see SYSTEM).
  // search_jason is Jason's voice and comes first when the method applies;
  // web_search is the everyday path for anything current or outside it.
  // Anthropic runs web_search server-side, so it never pauses the stream the
  // way search_jason's client round-trip does. 6 uses.
  { type: "web_search_20250305", name: "web_search", max_uses: 6 },
];

function jwtPayload(auth: string | null): any {
  try {
    const t = (auth || "").replace(/^Bearer\s+/i, "");
    const p = t.split(".")[1];
    return JSON.parse(atob(p.replace(/-/g, "+").replace(/_/g, "/")));
  } catch (_) { return null; }
}

async function chat(req: Request, sys: string, cs: Chunk[], apiKey: string) {
  const body = await req.json().catch(() => ({}));
  const history = Array.isArray(body.messages) ? body.messages.slice(-20) : [];
  if (!history.length) throw new Error("no messages");

  const msgs: any[] = history.map((m: any) => ({
    role: m.role === "assistant" ? "assistant" : "user",
    content: String(m.content || "").slice(0, 8000),
  }));

  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(ctrl) {
      const send = (o: unknown) => ctrl.enqueue(enc.encode("data: " + JSON.stringify(o) + "\n\n"));
      try {
        for (let round = 0; round < 6; round++) {
          const r = await aiFetch("chat_v1", {
            method: "POST",
            headers: {
              "content-type": "application/json",
              "x-api-key": apiKey,
              "anthropic-version": "2023-06-01",
            },
            body: JSON.stringify({
              model: MODEL, max_tokens: 1600, stream: true, tools: TOOLS,
              // cache_control on the system block: it is identical every turn
              // and it is large, so this is most of the latency and cost.
              system: [{ type: "text", text: sys + NAME_RULE, cache_control: { type: "ephemeral" } }],
              messages: msgs,
            }),
          });
          if (!r.ok || !r.body) throw new Error("claude HTTP " + r.status + " " + (await r.text()).slice(0, 200));

          let stop = "", text = "";
          const blocks: any[] = [];
          const reader = r.body!.getReader(), dec = new TextDecoder();
          let buf = "";
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buf += dec.decode(value, { stream: true });
            const parts = buf.split("\n\n"); buf = parts.pop() || "";
            for (const p of parts) {
              const line = p.split("\n").find((x) => x.startsWith("data: "));
              if (!line) continue;
              let ev: any; try { ev = JSON.parse(line.slice(6)); } catch { continue; }
              if (ev.type === "content_block_start") {
                const cb = ev.content_block;
                // "server_tool_use" / "web_search_tool_result" are web_search's
                // blocks — Anthropic resolves those itself mid-turn, unlike
                // search_jason which needs OUR round-trip below. Keep every
                // field Anthropic sent (id, name, whole result) rather than
                // collapsing them into an empty text block, so the message we
                // resend on a later round (if search_jason also fires this
                // turn) still matches what the API actually produced.
                blocks[ev.index] =
                  (cb.type === "tool_use" || cb.type === "server_tool_use") ? { ...cb, input: "" }
                  : (cb.type === "text") ? { type: "text", text: "" }
                  : { ...cb };
              } else if (ev.type === "content_block_delta") {
                const b = blocks[ev.index];
                if (ev.delta.type === "text_delta") {
                  b.text += ev.delta.text; text += ev.delta.text;
                  send({ t: "text", v: ev.delta.text });
                } else if (ev.delta.type === "input_json_delta") {
                  b.input += ev.delta.partial_json;
                }
              } else if (ev.type === "message_delta" && ev.delta?.stop_reason) {
                stop = ev.delta.stop_reason;
              }
            }
          }

          if (stop !== "tool_use") { send({ t: "done" }); break; }

          const assistant: any[] = [];
          const results: any[] = [];
          for (const b of blocks) {
            if (!b) continue;
            if (b.type === "text") { if (b.text) assistant.push({ type: "text", text: b.text }); continue; }
            // web_search's own blocks: Anthropic already resolved these within
            // this same turn. Pass them straight through — they need no
            // tool_result from us, only search_jason (below) does.
            if (b.type === "server_tool_use") {
              let input: any = {}; try { input = JSON.parse(b.input || "{}"); } catch { /* */ }
              assistant.push({ type: "server_tool_use", id: b.id, name: b.name, input });
              continue;
            }
            if (b.type === "web_search_tool_result") { assistant.push(b); continue; }
            let input: any = {}; try { input = JSON.parse(b.input || "{}"); } catch { /* */ }
            assistant.push({ type: "tool_use", id: b.id, name: b.name, input });
            const q = String(input.query || "");
            send({ t: "search", v: q });
            const hits = search(cs, q);
            results.push({
              type: "tool_result", tool_use_id: b.id,
              content: hits.length
                ? hits.map(fmt).join("\n\n")
                : "NOTHING FOUND for that wording. Try different words before concluding he never covered it.",
            });
          }
          msgs.push({ role: "assistant", content: assistant });
          msgs.push({ role: "user", content: results });
        }
      } catch (e) {
        send({ t: "error", v: String((e as Error).message ?? e).slice(0, 300) });
      }
      ctrl.close();
    },
  });

  return new Response(stream, {
    headers: { ...CORS, "content-type": "text/event-stream", "cache-control": "no-store" },
  });
}

/* ===================================================================== DESK
   v3.0 — The Desk. Added 4 Oct 2026.

   Otto is its own MCP client. It signs in to TradingView and Robinhood once
   (OAuth 2.1, dynamic client registration + PKCE, exactly what Claude does),
   keeps the tokens AES-GCM encrypted in Postgres, and then:

     ?fn=desk           the Desk chat (SSE). Claude can READ TradingView and
                        Robinhood freely. Anything that CHANGES something goes
                        through one tool, propose_action, which only stores the
                        exact calls and shows an Approve / Reject card.
     ?fn=act            Approve or Reject a stored card. Approve runs exactly
                        the stored calls — nothing the model writes later.
     ?fn=panel          the side columns: macro, watchlist prices, alerts,
                        Robinhood accounts, Agentic positions, pending cards.
     ?fn=desk_log       the shared conversation (same login on both laptops).
     ?fn=oauth_start / oauth_finish / conn_status / disconnect

   Locked down: every Desk route requires a signed-in email on
   OTTO_ALLOWED_EMAILS. Anonymous app sessions can't reach any of it.
   v5.0 ROOMS: ...or an invited / active otto_users row. Allow-list emails
   are owners (admins); everyone else is a member in their own room. The
   handler runs each Desk request inside ROOM.run({ owner }), and owner()
   scopes otto_conn / otto_desk / otto_actions reads + writes, the token and
   MCP-session caches, and the Anthropic key + model (roomKey). See the
   "v5.0 ROOMS" block at the top of the file. New routes: me, key_set,
   key_clear, model_set; admin: invite, users, user_off.

   Robinhood orders are forced into the one agentic_allowed account (or
   OTTO_RH_ACCOUNT if set). The account number is never in this file — the
   repo is public.

   Secrets:  OTTO_TOKEN_KEY       any long random string (encrypts the tokens)
             OTTO_ALLOWED_EMAILS  comma list; default ottotrader@vinecreativestudio.com
             OTTO_RH_ACCOUNT      optional; pins the Robinhood account orders go to
   Tables:   supabase/004_desk.sql
*/

const DESK_REDIRECT = Deno.env.get("OTTO_REDIRECT") || "https://proagentmax.github.io/otto-trader/oauth.html";
const RISK_FLAG = 0.20;               // warn (never block) above 20% of the account
const ACTION_TTL_MS = 20 * 60_000;    // a card older than this can't be approved — prices moved

const SVC: Record<string, any> = {
  tv: {
    name: "TradingView",
    mcp: "https://mcp.tradingview.com/mcp",
    authorize: "https://www.tradingview.com/mcp/oauth/authorize",
    token: "https://www.tradingview.com/mcp/oauth/token",
    register: "https://www.tradingview.com/mcp/oauth/register",
    scope: "mcp:read mcp:tools",
    resource: "https://mcp.tradingview.com/mcp",
  },
  rh: {
    name: "Robinhood",
    mcp: "https://agent.robinhood.com/mcp/trading",
    authorize: "https://robinhood.com/oauth",
    token: "https://api.robinhood.com/oauth2/token/",
    register: "https://agent.robinhood.com/oauth/trading/register",
    scope: "internal",
    resource: "https://agent.robinhood.com/mcp/trading",
    // v3.0.1: Robinhood refuses to return to a web page it doesn't know
    // (tested 4 Oct: "Uh oh! Something's gone wrong" after Allow), but it
    // accepts a localhost address. The browser can't load it, so the user
    // pastes that address back into Otto once. See paste flow in index.html.
    redirect: "http://localhost:8976/callback",
  },
};

// What the model may call directly (looks, never touches).
const READ: Record<string, Set<string>> = {
  tv: new Set([
    "mcp-tv-get-symbol-data", "mcp-tv-get-symbol-data-batch", "mcp-tv-get-ohlcv",
    "mcp-tv-get-news", "mcp-tv-get-news-story", "mcp-tv-get-technicals-rating",
    "mcp-tv-get-earnings-calendar", "mcp-tv-get-economic-calendar", "mcp-tv-search-symbols",
    "mcp-tv-list-alerts", "mcp-tv-get-alerts-log", "mcp-tv-run-screener", "mcp-tv-get-screener-columns",
    "mcp-tv-get-financials", "mcp-tv-get-forecasts",
    "mcp-watchlist-get-active-watchlist", "mcp-watchlist-get-watchlist", "mcp-watchlist-list-watchlists",
  ]),
  rh: new Set([
    "get_accounts", "get_portfolio", "get_equity_positions", "get_option_positions",
    "get_equity_orders", "get_option_orders", "get_option_chains", "get_option_instruments",
    "get_option_quotes", "get_option_historicals", "get_equity_quotes", "get_equity_historicals",
    "get_equity_technical_indicators", "get_earnings_calendar", "get_index_quotes",
    "review_option_order", "review_equity_order", "search", "get_watchlists", "get_watchlist_items",
    "get_pnl_trade_history", "get_realized_pnl", "get_alerts",
  ]),
};

// What only an approved card may run.
const WRITE: Record<string, Set<string>> = {
  tv: new Set([
    "mcp-tv-create-alert", "mcp-tv-update-alert", "mcp-tv-delete-alert",
    "mcp-tv-stop-alerts", "mcp-tv-restart-alerts",
    "mcp-watchlist-add-to-watchlist", "mcp-watchlist-remove-from-watchlist", "mcp-watchlist-create-watchlist",
  ]),
  rh: new Set([
    "place_option_order", "place_equity_order", "cancel_option_order", "cancel_equity_order",
    "create_alert", "add_to_watchlist", "remove_from_watchlist",
  ]),
};
// Robinhood tools whose account_number is forced to the agentic account.
const RH_FORCE_ACCT = new Set(["place_option_order", "place_equity_order", "review_option_order",
  "review_equity_order", "cancel_option_order", "cancel_equity_order"]);

/* ------------------------------------------------------------ allowlist */

function allowedEmails(): string[] {
  return (Deno.env.get("OTTO_ALLOWED_EMAILS") || "ottotrader@vinecreativestudio.com")
    .split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
}
// v5.0 ROOMS: allow-list emails are owners (admins); anyone else must have an otto_users row that is invited or active.
// First entry flips invited → active (first_seen); last_seen is touched at most once per 10 minutes per instance.
type DeskWho = { email: string; role: "owner" | "member"; name?: string | null };
const SEEN: Record<string, number> = {};
const uq = (email: string) => "otto_users?email=eq." + encodeURIComponent(email);
async function deskUserAsync(claims: any): Promise<DeskWho | null> {
  const e = String(claims?.email || "").toLowerCase();
  if (!e || claims?.is_anonymous) return null;
  const now = Date.now(), iso = new Date(now).toISOString();
  if (allowedEmails().includes(e)) {
    if (!SEEN[e] || now - SEEN[e] > 10 * 60_000) {
      SEEN[e] = now;
      const row = (await db(uq(e) + "&select=email").catch(() => []))?.[0];
      (row ? db(uq(e), { method: "PATCH", headers: { prefer: "return=minimal" }, body: JSON.stringify({ last_seen: iso }) })
           : db("otto_users", { method: "POST", headers: { prefer: "return=minimal" }, body: JSON.stringify({ email: e, role: "owner", status: "active", first_seen: iso, last_seen: iso }) })
      ).catch(() => {});
    }
    return { email: e, role: "owner" };
  }
  const row = (await db(uq(e) + "&status=in.(invited,active)&select=email,name,role,status").catch(() => []))?.[0];
  if (!row) return null;
  if (row.status === "invited" || !SEEN[e] || now - SEEN[e] > 10 * 60_000) {
    SEEN[e] = now;
    const patch: any = { last_seen: iso };
    if (row.status === "invited") { patch.status = "active"; patch.first_seen = iso; }
    db(uq(e), { method: "PATCH", headers: { prefer: "return=minimal" }, body: JSON.stringify(patch) }).catch(() => {});
  }
  return { email: e, role: row.role === "owner" ? "owner" : "member", name: row.name || null };
}
// v5.0: the per-room Anthropic key + model. HOUSE = the ANTHROPIC_KEY secret; every other room = its sealed otto_users key.
class NoKey extends Error {}
const NO_KEY_MSG = "Add your Anthropic API key in Settings → Your AI key";
type RoomKey = { key: string; model: string; source: "room" | "house" };
const RK: Record<string, { at: number; v: RoomKey }> = {};
async function roomKey(): Promise<RoomKey> {
  const o = owner();
  const c = RK[o];
  if (c && Date.now() - c.at < 60_000 && Date.now() >= c.at) return c.v;
  const row = (await db(uq(o) + "&select=anthropic_key,model").catch(() => []))?.[0];
  const model = ALLOWED_MODELS.includes(row?.model) ? String(row.model) : MODEL;
  let v: RoomKey;
  if (o === HOUSE) {
    const key = Deno.env.get("ANTHROPIC_KEY") || "";
    if (!key) throw new Error("ANTHROPIC_KEY secret is not set");
    v = { key, model, source: "house" };
  } else {
    if (!row?.anthropic_key) throw new NoKey(NO_KEY_MSG);
    const key = String((await unseal(String(row.anthropic_key)).catch(() => "")) || "");
    if (!key) throw new NoKey(NO_KEY_MSG);
    v = { key, model, source: "room" };
  }
  RK[o] = { at: Date.now(), v };
  return v;
}
const roomModel = async () => (await roomKey().catch(() => null))?.model || MODEL;        // v5.0: the model for a Desk-triggered call
// Settings → Your AI key / model, and the admin's people list. The key is sealed at rest and NEVER returned or logged.
async function userPatch(email: string, patch: any) {
  await db("otto_users?on_conflict=email", { method: "POST", headers: { prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify({ email, ...patch }) });
  delete RK[email];
}
async function meInfo(u: DeskWho) {
  const row = (await db(uq(u.email) + "&select=name,key_last4,key_ok_at,model").catch(() => []))?.[0] || {};
  return { role: u.role, name: row.name || u.name || null, house: u.email === HOUSE, paper_only: u.email !== HOUSE,   // v5.0: member rooms never place
    has_key: u.email === HOUSE ? !!Deno.env.get("ANTHROPIC_KEY") : !!row.key_last4, key_last4: row.key_last4 || null, key_ok_at: row.key_ok_at || null,
    model: ALLOWED_MODELS.includes(row.model) ? row.model : MODEL };
}
export async function keySet(email: string, key: string) {
  key = String(key || "").trim();
  if (!/^sk-ant-/.test(key) || key.length < 20) return { ok: false, error: "That doesn't look like an Anthropic API key (it starts with sk-ant-)." };
  const r = await fetch("https://api.anthropic.com/v1/models?limit=1", { headers: { "x-api-key": key, "anthropic-version": "2023-06-01" },
    signal: AbortSignal.timeout(15_000) }).catch(() => null);
  if (!r) return { ok: false, error: "Couldn't reach Anthropic to check the key — try again." };
  await r.body?.cancel().catch(() => {});
  if (r.status === 401 || r.status === 403) return { ok: false, error: "Anthropic rejected that key — check it and paste it again." };
  if (!r.ok) return { ok: false, error: "Anthropic answered " + r.status + " while checking the key — try again." };
  const key_last4 = key.slice(-4);
  await userPatch(email, { anthropic_key: await seal(key), key_last4, key_ok_at: new Date().toISOString() });
  return { ok: true, key_last4 };
}
export async function keyClear(email: string) {
  await userPatch(email, { anthropic_key: null, key_last4: null, key_ok_at: null });
  return { ok: true, key_last4: null };
}
export async function modelSet(email: string, model: string) {
  if (!ALLOWED_MODELS.includes(model)) return { ok: false, error: "pick one of: " + ALLOWED_MODELS.join(", ") };
  await userPatch(email, { model });
  return { ok: true, model };
}
export async function inviteUser(b: any, by: string) {
  const email = String(b?.email || "").trim().toLowerCase(), name = String(b?.name || "").trim().slice(0, 80);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, error: "that doesn't look like an email" };
  const was = (await db(uq(email) + "&select=status").catch(() => []))?.[0];
  const status = was && was.status !== "off" ? was.status : "invited";
  await userPatch(email, { ...(name ? { name } : {}), status, invited_by: by, invited_at: new Date().toISOString() });
  delete SEEN[email];
  const base = Deno.env.get("SUPABASE_URL"), svc = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const site = Deno.env.get("OTTO_SITE") || "https://vinespaces.github.io/otto-trader/";
  let auth = 0, note: string | null = null;
  if (!base || !svc) note = "service role not available — no invite email was sent";
  else {
    const r = await fetch(base + "/auth/v1/invite?redirect_to=" + encodeURIComponent(site), { method: "POST",
      headers: { apikey: svc, authorization: "Bearer " + svc, "content-type": "application/json" },
      body: JSON.stringify({ email, data: { name: name || null } }), signal: AbortSignal.timeout(15_000) }).catch(() => null);
    auth = r?.status || 0;
    const t = r ? await r.text().catch(() => "") : "";
    if (!r) note = "couldn't reach Supabase auth — no invite email was sent (they can still use the magic-link sign-in)";
    else if (!r.ok) {
      if (/already|exists|registered/i.test(t)) note = "already has a login — the magic-link sign-in works";
      else return { ok: false, error: "invite email failed (" + auth + "): " + t.slice(0, 160), email, status, auth };
    }
  }
  return { ok: true, email, status, auth, ...(note ? { note } : {}) };
}
export async function usersList() {
  const rows = (await db("otto_users?select=email,name,role,status,anthropic_key,key_last4,model,invited_at,first_seen,last_seen&order=created_at.asc")) || [];
  const conns = (await db("otto_conn?select=owner,service,connected_at").catch(() => [])) || [];
  return { ok: true, users: rows.map((r: any) => ({ email: r.email, name: r.name, role: r.role, status: r.status, has_key: !!r.anthropic_key, key_last4: r.key_last4 || null,
    model: r.model || null, invited_at: r.invited_at, first_seen: r.first_seen, last_seen: r.last_seen,
    conn: conns.filter((c: any) => c.owner === r.email).map((c: any) => ({ service: c.service, connected_at: c.connected_at })) })) };
}
export async function userOff(email: string, by: string) {
  email = String(email || "").trim().toLowerCase();
  if (!email) return { ok: false, error: "email required" };
  if (email === HOUSE || email === by || allowedEmails().includes(email)) return { ok: false, error: "that login can't be switched off here" };
  await db(uq(email), { method: "PATCH", headers: { prefer: "return=minimal" }, body: JSON.stringify({ status: "off" }) });
  delete SEEN[email]; delete RK[email];
  for (const k of Object.keys(TOK)) if (k.startsWith(email + "|")) delete TOK[k];
  for (const k of Object.keys(MSESS)) if (k.startsWith(email + "|")) delete MSESS[k];
  return { ok: true, email, status: "off" };
}

/* ------------------------------------------------------------ database */

async function db(path: string, init: RequestInit = {}): Promise<any> {
  if ((globalThis as any).__OTTO_TEST__?.db) return (globalThis as any).__OTTO_TEST__.db(path, init);
  const base = Deno.env.get("SUPABASE_URL"), svc = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!base || !svc) throw new Error("service role not available");
  const r = await fetch(base + "/rest/v1/" + path, {
    ...init,
    headers: { apikey: svc, authorization: "Bearer " + svc, "content-type": "application/json",
               prefer: "return=representation", ...(init.headers || {}) },
  });
  const t = await r.text();
  if (!r.ok) {
    if (/relation .* does not exist|Could not find the table/i.test(t))
      throw new Error("Desk tables missing — run supabase/004_desk.sql in the SQL editor");
    throw new Error("db " + r.status + " " + t.slice(0, 200));
  }
  return t ? JSON.parse(t) : null;
}

/* ------------------------------------------------------------ crypto */

const enc8 = new TextEncoder(), dec8 = new TextDecoder();
function b64(u: Uint8Array) { let s = ""; for (const c of u) s += String.fromCharCode(c); return btoa(s); }
function unb64(s: string) { const b = atob(s); const u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; }
const b64url = (u: Uint8Array) => b64(u).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

let AES: CryptoKey | null = null;
async function aesKey() {
  if (AES) return AES;
  const s = Deno.env.get("OTTO_TOKEN_KEY") || "";
  if (s.length < 16) throw new Error("OTTO_TOKEN_KEY secret is not set (needs 16+ characters)");
  const h = await crypto.subtle.digest("SHA-256", enc8.encode(s));
  AES = await crypto.subtle.importKey("raw", h, "AES-GCM", false, ["encrypt", "decrypt"]);
  return AES;
}
async function seal(o: unknown) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await aesKey(), enc8.encode(JSON.stringify(o))));
  return b64(iv) + "." + b64(ct);
}
async function unseal(s: string) {
  const [a, b] = s.split(".");
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(a) }, await aesKey(), unb64(b));
  return JSON.parse(dec8.decode(pt));
}

/* ------------------------------------------------------------ OAuth */

const redirectFor = (service: string) => SVC[service]?.redirect || DESK_REDIRECT;

async function oauthStart(service: string, who: string) {
  const s = SVC[service]; if (!s) throw new Error("unknown service");
  const redirect = redirectFor(service);
  await aesKey();                                   // fail early if the secret is missing
  const reg = await fetch(s.register, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ client_name: "Otto Trader", redirect_uris: [redirect],
      grant_types: ["authorization_code", "refresh_token"], response_types: ["code"],
      token_endpoint_auth_method: "none" }),
  });
  const rj = await reg.json().catch(() => ({}));
  if (!reg.ok || !rj.client_id) throw new Error(s.name + " registration failed: " + JSON.stringify(rj).slice(0, 200));
  const verifier = b64url(crypto.getRandomValues(new Uint8Array(32)));
  const challenge = b64url(new Uint8Array(await crypto.subtle.digest("SHA-256", enc8.encode(verifier))));
  const state = service + "." + b64url(crypto.getRandomValues(new Uint8Array(18)));
  await db("otto_oauth", { method: "POST", body: JSON.stringify({
    state, service, client_id: rj.client_id, verifier: await seal(verifier), started_by: who, owner: owner() }) });   // v5.0
  const q = new URLSearchParams({ response_type: "code", client_id: rj.client_id, redirect_uri: redirect,
    code_challenge: challenge, code_challenge_method: "S256", state, scope: s.scope, resource: s.resource });
  return s.authorize + "?" + q.toString();
}

async function tokenPost(service: string, form: Record<string, string>) {
  const s = SVC[service];
  const r = await fetch(s.token, { method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
    body: new URLSearchParams(form).toString() });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.access_token) throw new Error(s.name + " token: " + (j.error_description || j.error || r.status));
  return j;
}

async function saveTokens(service: string, client_id: string, j: any, prev: any, who?: string) {
  const t = {
    access_token: j.access_token,
    refresh_token: j.refresh_token || prev?.refresh_token || null,
    expires_at: j.expires_in ? Date.now() + Number(j.expires_in) * 1000 : null,
  };
  const row: any = { owner: owner(), service, client_id, tokens: await seal(t), updated_at: new Date().toISOString() };   // v5.0: one row per room + service
  if (who) { row.connected_by = who; row.connected_at = row.updated_at; }
  await db("otto_conn?on_conflict=owner,service", { method: "POST",
    headers: { prefer: "resolution=merge-duplicates,return=representation" }, body: JSON.stringify(row) });
  TOK[ck(service)] = { access: t.access_token, exp: t.expires_at || Date.now() + 30 * 60_000 };
  delete MSESS[ck(service)];
  return t;
}

async function oauthFinish(code: string, state: string, who: string) {
  const rows = await db("otto_oauth?state=eq." + encodeURIComponent(state) + "&select=*");
  const p = rows && rows[0];
  if (!p) throw new Error("that sign-in link expired or was already used — press Connect again");
  await db("otto_oauth?state=eq." + encodeURIComponent(state), { method: "DELETE" });
  // v5.0: the state row must belong to the room finishing it. The safe choice is to REFUSE a mismatch rather than adopt the
  // row's owner: a state value that leaked (pasted link, shared screen) could otherwise plant one person's broker tokens in
  // another person's room. A room only ever finishes the sign-in it started.
  if (p.owner && p.owner !== owner()) throw new Error("that sign-in link was started from another login — press Connect again");
  if (Date.now() - Date.parse(p.created_at) > 15 * 60_000) throw new Error("sign-in took longer than 15 minutes — press Connect again");
  const j = await tokenPost(p.service, { grant_type: "authorization_code", code, redirect_uri: redirectFor(p.service),
    client_id: p.client_id, code_verifier: await unseal(p.verifier), resource: SVC[p.service].resource });
  await saveTokens(p.service, p.client_id, j, null, who);
  return p.service;
}

const TOK: Record<string, { access: string; exp: number }> = {};
class NotConnected extends Error {}

async function accessToken(service: string, force = false): Promise<string> {   // v5.0: everything here is per room (ck / OQ)
  const c = TOK[ck(service)];
  if (!force && c && Date.now() < c.exp - 60_000) return c.access;
  const rows = await db("otto_conn?" + OQ() + "service=eq." + service + "&select=*");
  const row = rows && rows[0];
  if (!row || !row.tokens) throw new NotConnected(SVC[service].name + " is not connected — Settings → Connections");
  const t = await unseal(row.tokens);
  const fresh = !force && (!t.expires_at || Date.now() < t.expires_at - 60_000);
  if (fresh) { TOK[ck(service)] = { access: t.access_token, exp: t.expires_at || Date.now() + 30 * 60_000 }; return t.access_token; }
  if (!t.refresh_token) throw new NotConnected(SVC[service].name + " sign-in expired — reconnect in Settings → Connections");
  // v3.16 (code review 6 Oct): one refresh at a time per instance, and if another instance refreshed first (the
  // provider rotates refresh tokens, so ours is now dead), use the tokens it saved instead of calling it expired.
  if (REFRESHING[ck(service)]) return REFRESHING[ck(service)]!;
  REFRESHING[ck(service)] = (async () => {
    try {
      const j = await tokenPost(service, { grant_type: "refresh_token", refresh_token: t.refresh_token,
        client_id: row.client_id, resource: SVC[service].resource });
      return (await saveTokens(service, row.client_id, j, t)).access_token;
    } catch (e) {
      const again = (await db("otto_conn?" + OQ() + "service=eq." + service + "&select=*").catch(() => []))?.[0];
      if (again?.tokens && again.tokens !== row.tokens) {
        const t2 = await unseal(again.tokens).catch(() => null);
        if (t2?.access_token && (!t2.expires_at || Date.now() < t2.expires_at - 60_000)) {
          TOK[ck(service)] = { access: t2.access_token, exp: t2.expires_at || Date.now() + 30 * 60_000 };
          return t2.access_token;
        }
      }
      throw new NotConnected(SVC[service].name + " sign-in expired — reconnect in Settings → Connections (" + (e as Error).message + ")");
    } finally { delete REFRESHING[ck(service)]; }
  })();
  return REFRESHING[ck(service)]!;
}
const REFRESHING: Record<string, Promise<string> | undefined> = {};

/* ------------------------------------------------------------ MCP client
   Streamable HTTP: POST JSON-RPC, answer arrives as JSON or as an SSE stream. */

const MSESS: Record<string, { id: string | null; at: number; tools?: any[]; toolsAt?: number }> = {};
let RPC_ID = 1;

async function rpcOnce(service: string, method: string, params: any, token: string, sid: string | null, notify = false) {
  const id = notify ? undefined : RPC_ID++;
  const r = await fetch(SVC[service].mcp, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json, text/event-stream",
               authorization: "Bearer " + token, "mcp-protocol-version": "2025-06-18",
               ...(sid ? { "mcp-session-id": sid } : {}) },
    body: JSON.stringify(notify ? { jsonrpc: "2.0", method, params } : { jsonrpc: "2.0", id, method, params }),
    // v3.8.1: a hung TradingView/Robinhood request used to hold the whole Desk panel open.
    signal: AbortSignal.timeout(method === "tools/call" ? 20_000 : 12_000),
  }).catch((e) => { throw new Error(SVC[service].name + (e?.name === "TimeoutError" ? " timed out" : " unreachable: " + String(e?.message || e).slice(0, 120))); });
  const newSid = r.headers.get("mcp-session-id");
  if (notify) { await r.body?.cancel(); return { status: r.status, sid: newSid, msg: null }; }
  if (!r.ok) { const t = await r.text(); return { status: r.status, sid: newSid, msg: null, err: t.slice(0, 300) }; }
  const ct = r.headers.get("content-type") || "";
  let msg: any = null;
  if (ct.includes("text/event-stream")) {
    const txt = await r.text();
    for (const ev of txt.split(/\r?\n\r?\n/)) {
      const data = ev.split(/\r?\n/).filter((l) => l.startsWith("data:")).map((l) => l.slice(5).trim()).join("\n");
      if (!data) continue;
      try { const m = JSON.parse(data); if (m.id === id) msg = m; } catch { /* */ }
    }
  } else {
    msg = await r.json().catch(() => null);
  }
  return { status: r.status, sid: newSid, msg };
}

async function mcpSession(service: string, token: string) {
  const s = MSESS[ck(service)];
  if (s && Date.now() - s.at < 20 * 60_000) return s;
  const init = await rpcOnce(service, "initialize", {
    protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "otto-trader", version: "5.0.0" } }, token, null);
  if (init.status === 401) throw Object.assign(new Error("401"), { auth: true });
  if (!init.msg || init.msg.error) throw new Error(SVC[service].name + " initialize failed: " + (init.err || JSON.stringify(init.msg?.error)).slice(0, 200));
  const sess = { id: init.sid, at: Date.now() };
  await rpcOnce(service, "notifications/initialized", {}, token, init.sid, true);
  MSESS[ck(service)] = sess;
  return sess;
}

async function mcp(service: string, method: string, params: any): Promise<any> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const token = await accessToken(service, attempt === 1);
    let sess;
    try { sess = await mcpSession(service, token); }
    catch (e: any) { if (e.auth && attempt === 0) { delete MSESS[ck(service)]; continue; } throw e; }
    const r = await rpcOnce(service, method, params, token, sess.id);
    if (r.status === 401 && attempt === 0) { delete MSESS[ck(service)]; continue; }       // refresh and retry
    if ((r.status === 404 || r.status === 400) && sess.id && attempt < 2) { delete MSESS[ck(service)]; continue; } // session gone
    if (!r.msg) throw new Error(SVC[service].name + " HTTP " + r.status + " " + (r.err || ""));
    if (r.msg.error) throw new Error(SVC[service].name + ": " + (r.msg.error.message || JSON.stringify(r.msg.error)).slice(0, 300));
    return r.msg.result;
  }
  throw new Error(SVC[service].name + " not reachable");
}

async function mcpTools(service: string) {
  const s = MSESS[ck(service)];
  if (s?.tools && Date.now() - (s.toolsAt || 0) < 15 * 60_000) return s.tools;
  const res = await mcp(service, "tools/list", {});
  const tools = res?.tools || [];
  if (MSESS[ck(service)]) { MSESS[ck(service)].tools = tools; MSESS[ck(service)].toolsAt = Date.now(); }
  return tools;
}

// Result content → text (and parsed JSON when the server sent JSON text).
function mcpText(res: any): string {
  if (!res) return "";
  if (res.structuredContent) return JSON.stringify(res.structuredContent);
  return (res.content || []).map((c: any) => c.type === "text" ? c.text : "[" + c.type + "]").join("\n");
}
function mcpJson(res: any): any {
  if (res?.structuredContent) return res.structuredContent;
  try { return JSON.parse(mcpText(res)); } catch { return null; }
}
// v3.13: test seam — undefined in production (only the Deno test suite sets it).
// v3.19.1: safety net (Supabase's documented fallback). Any promise that rejects with nobody listening
// is logged as "stray rejection" instead of shutting the worker down mid-reply.
let STRAY = 0;
globalThis.addEventListener("unhandledrejection", (ev: PromiseRejectionEvent) => {
  ev.preventDefault();
  STRAY++;
  console.error("stray rejection (worker kept alive):", String((ev.reason as Error)?.message ?? ev.reason).slice(0, 300));
});
export const strayCount = () => STRAY;
const TEST: any = (globalThis as any).__OTTO_TEST__ || null;

/* v4.2: TradingView's connector has a DAILY tool-call quota (hit 23 Oct ~noon: three open Desks × one alerts call per
   minute). Every TV call is counted per ET day in otto_settings "tv_calls" (approximate across instances — good enough
   for the top-bar number), and a quota error opens the breaker until the 00:00 UTC reset instead of retrying all day. */
let TV_CALLS: { day: string; n: number; by?: Record<string, number>; fn?: Record<string, number> } = { day: "", n: 0 };
/* v5.3.1 (3 Nov 2026): WHO spends the TradingView quota. Besides the day's total, every call is tallied by tool ("by") and by the
   route that asked ("fn"; a member's room is prefixed). Each finished day is kept in otto_settings "tv_calls_hist" (last 14), and
   the first quota error of a day writes "tv_quota_trip" (when, count, tallies, route). Calls made OUTSIDE Otto (other Claude chats,
   scheduled tasks) are not visible here — if the trip shows a small Otto count, the rest came from outside. */
let CUR_FN = "", HIST_DAY = "", TRIP_DAY = "";
export const setTvRoute = (f: string) => { CUR_FN = f; };   // approximate: a worker can overlap requests
async function tvHistPush(d: { day: string; n: number; by?: any; fn?: any }) {
  const h = (await setting("tv_calls_hist").catch(() => null)) || [];
  const list = (Array.isArray(h) ? h : []).filter((e: any) => e?.day !== d.day);
  list.push({ day: d.day, n: d.n, by: d.by || {}, fn: d.fn || {} });
  await putSetting("tv_calls_hist", list.slice(-14));
}
function tvNoteQuota(e: unknown, tool: string) {
  if (!/QUOTA_EXCEEDED|quota exceeded/i.test(String((e as Error)?.message ?? e))) return;
  const day = etParts().date; if (TRIP_DAY === day) return; TRIP_DAY = day;
  const d = TV_CALLS.day === day ? TV_CALLS : { day, n: 0, by: {}, fn: {} };
  putSetting("tv_quota_trip", { at: new Date().toISOString(), day, n: d.n, by: d.by || {}, fn: d.fn || {}, tool, route: CUR_FN, msg: String((e as Error)?.message ?? e).slice(0, 200) }).catch(() => {});
  putSetting("tv_calls", d).catch(() => {});
}
export const tvCallsToday = () => TV_CALLS;
function tvCount(tool = "?") {
  const day = etParts().date;
  if (TV_CALLS.day !== day) { if (TV_CALLS.day && TV_CALLS.n > 0) tvHistPush(TV_CALLS).catch(() => {}); TV_CALLS = { day, n: 0, by: {}, fn: {} }; }
  TV_CALLS.n++;
  const by = (TV_CALLS.by ||= {}), fn = (TV_CALLS.fn ||= {}), route = (owner() !== HOUSE ? owner() + ":" : "") + (CUR_FN || "?");
  by[tool] = (by[tool] || 0) + 1; fn[route] = (fn[route] || 0) + 1;
  if (TV_CALLS.n % 5 === 0) putSetting("tv_calls", TV_CALLS).catch(() => {});
}
async function tvCallsLoad() {
  try {
    const v = await setting("tv_calls"), today = etParts().date;
    if (v?.day === today && v.n > TV_CALLS.n) TV_CALLS = v;
    else if (v?.day && v.day !== today && v.n > 0 && HIST_DAY !== v.day) { HIST_DAY = v.day; await tvHistPush(v); }   // v5.3.1: a finished day goes to the history once
  } catch { /* */ }
}
const nextUtcMidnight = () => { const d = new Date(); d.setUTCHours(24, 0, 0, 0); return d.getTime(); };
const PAPER_ONLY = "Rooms are paper-only in this version";
async function call(service: string, tool: string, args: any) {
  try { return await call0(service, tool, args); }
  catch (e) { if (service === "tv") tvNoteQuota(e, tool); throw e; }   // v5.3.1: the first quota error of a day is recorded with who had spent what
}
async function call0(service: string, tool: string, args: any) {
  let res: any;
  // v5.0 ROOMS: a member's room never places, cancels or changes anything on Robinhood — whatever card, tool or sweep asked.
  if (owner() !== HOUSE && service === "rh" && WRITE.rh.has(tool)) throw new Error(PAPER_ONLY + " — nothing is sent to Robinhood (" + tool + ")");
  if (service === "tv") tvCount(tool);
  if (TEST?.call) res = await TEST.call(service, tool, args);
  else {
    try { res = await mcp(service, "tools/call", { name: tool, arguments: args || {} }); }
    catch (e) {
      // v5.0 ROOMS: a room with no sign-in of its own still gets PUBLIC market data (bars, quotes, chains) through the house's
      // connection — the Winston allow-list only; accounts, positions and orders are never read across rooms.
      if (e instanceof NotConnected && owner() !== HOUSE && WINSTON_ALLOW[service]?.has(tool))
        res = await ROOM.run({ owner: HOUSE }, () => mcp(service, "tools/call", { name: tool, arguments: args || {} }));
      else throw e;
    }
    if (res?.isError) throw new Error(mcpText(res).slice(0, 400) || "tool error");
  }
  // v3.26: every cancel Otto sends is logged, so a cancel that isn't in the log shows up as "Outside Otto".
  if (/^cancel_(?:option|equity)_order$/.test(tool) && args?.order_id) await noteOttoCancel(String(args.order_id)).catch(() => {});
  return res;
}

/* ------------------------------------------------------------ Robinhood account */

const AGENTIC_BY: Record<string, { n: string; at: number }> = {};                     // v5.0: per room
async function agenticAccount(): Promise<string> {
  const pinned = Deno.env.get("OTTO_RH_ACCOUNT");
  if (pinned && owner() === HOUSE) return pinned;                                      // v5.0: the pin is the house's account; a member's is discovered from their own Robinhood
  const AGENTIC = AGENTIC_BY[owner()];
  if (AGENTIC && Date.now() - AGENTIC.at < 30 * 60_000) return AGENTIC.n;
  const j = mcpJson(await call("rh", "get_accounts", {}));
  const found: string[] = [];
  const walk = (o: any) => {
    if (!o || typeof o !== "object") return;
    if (Array.isArray(o)) { o.forEach(walk); return; }
    if (o.account_number && o.agentic_allowed === true) found.push(String(o.account_number));
    Object.values(o).forEach(walk);
  };
  walk(j);
  const uniq = [...new Set(found)];
  if (uniq.length !== 1) throw new Error(uniq.length ? "more than one agentic account — set OTTO_RH_ACCOUNT" : "no agentic_allowed Robinhood account found");
  AGENTIC_BY[owner()] = { n: uniq[0], at: Date.now() };
  return uniq[0];
}
const mask = (n: string) => "••" + String(n).slice(-4);

/* ------------------------------------------------------------ risk */

function costOf(tool: string, a: any): { cost: number | null; note: string } {
  const q = Number(a.quantity), p = Number(a.price ?? a.limit_price);
  if (tool === "place_option_order") {
    const legs = Array.isArray(a.legs) ? a.legs : [];
    const opening = legs.some((l: any) => l.position_effect === "open");
    if (!opening) return { cost: 0, note: "closing order — no new risk" };
    const debit = legs.length === 1 ? legs[0].side === "buy" : a.direction === "debit";
    if (!debit) return { cost: null, note: "credit order — max loss depends on strikes; read the review below" };
    if (!(q > 0) || !(p > 0)) return { cost: null, note: "no limit price — cost unknown until fill" };
    return { cost: q * p * 100, note: `${q} × $${p.toFixed(2)} × 100` };
  }
  if (tool === "place_equity_order") {
    if (a.side !== "buy") return { cost: 0, note: "sell order" };
    if (Number(a.dollar_amount) > 0) return { cost: Number(a.dollar_amount), note: "dollar amount" };
    if (q > 0 && p > 0) return { cost: q * p, note: `${q} × $${p.toFixed(2)}` };
    return { cost: null, note: "market order — cost unknown until fill" };
  }
  return { cost: 0, note: "" };
}

/* ------------------------------------------------------------ propose / act */

// v3.30 (item 2): the LIVE / PAPER word at the front of a card title is set by the SERVER from the card's real status.
// Jarvis wrote "LIVE —" on a PAPER card (META 12 Oct 14:06). Whatever he wrote there is stripped first.
const STAMP_RE = /^\s*(?:LIVE|PAPER)\s*(?:[—–:·|-]+\s*)?/i;
export const bareTitle = (t: any): string => String(t ?? "").replace(STAMP_RE, "").replace(/^Buy\s+/i, "");
const INNER_STAMP_RE = /\s*(?:[—–:·|-]\s*)?\b(?:LIVE|PAPER)\b\s*(?:[—–:·|-]\s*)?/gi;
// v3.39: Jarvis also writes the word inside the title ("SCALP · PAPER · CRWV 69C" went out LIVE on 16 Oct). The server's word is the only one.
// v3.44: the cleaning is shared. A NON-opening card (an equity order, a close, an alert) gets no prefix from the server, so any
// LIVE/PAPER word Jarvis wrote is stripped instead: 22 Oct ULTA went out "PAPER – Buy 1 ULTA 625C…" while it was LIVE (pending),
// because only opening option cards were stamped. The dash was never the problem: STAMP_RE already takes "-", "–", "—" and none.
export const unstampTitle = (t: any): string => String(t ?? "").replace(STAMP_RE, "").replace(INNER_STAMP_RE, " · ").replace(/^(?:\s*·\s*)+|(?:\s*·\s*)+$/g, "").replace(/(?:\s*·\s*){2,}/g, " · ").trim();
export const stampTitle = (t: any, paper: boolean): string => (paper ? "PAPER — " : "LIVE — ") + unstampTitle(t);
/* v3.44 fix 2 (22 Oct ULTA, 9 Oct NVDA): a card that NAMES an option but whose order is place_equity_order is a stock order at an
   option price ("625C @ $4.40" = buy 1 SHARE at $4.40; the size check saw $4.40, not the ~$440 premium, so it went LIVE).
   Refused before anything is reviewed or stored; Jarvis gets the reason and proposes again with place_option_order (cost = premium × 100). */
const OPT_IN_TITLE = /\b[A-Z]{1,5}\s+\d{1,5}(?:\.\d{1,2})?[CP]\b/;
export function optionAsStock(input: any): string | null {
  const eqc = (Array.isArray(input?.calls) ? input.calls : []).find((c: any) => c?.tool === "place_equity_order");
  if (!eqc) return null;
  const title = String(input?.title || ""), p = input?.plan && typeof input.plan === "object" ? input.plan : {};
  const named = OPT_IN_TITLE.test(title) || !!(p.option_id || p.contract || p.option || p.strike != null || Number(p.stop_option) > 0);
  if (!named) return null;
  const a = eqc.args || {}, lp = Number(a.limit_price ?? a.price), q = Number(a.quantity) || 1;
  return `NO CARD — this card names an option ("${unstampTitle(title).slice(0, 80)}") but its order is place_equity_order: buy ${q} SHARE${q === 1 ? "" : "S"} of ${String(a.symbol || "?").toUpperCase()}${lp > 0 ? ` at $${lp.toFixed(2)}` : ""}. That is a stock order at an option price${lp > 0 ? ` (the option would cost about $${Math.round(lp * 100 * q)}, premium × 100)` : ""}. Propose again with place_option_order (legs: option_id, side buy, position_effect open, ratio_quantity 1).`;
}
// v3.39: Jarvis's Desk line says the card's REAL status. "Card is up as PAPER" on a LIVE card is a false statement (16 Oct CRWV).
export function statusWords(text: string, acts: { title?: string; status?: string }[]): string {
  if (!acts.length) return text;
  const live = acts.some((a) => /^LIVE\b/i.test(String(a.title || "")) && a.status !== "paper" && a.status !== "paper_wait");
  const paper = acts.every((a) => /^PAPER\b/i.test(String(a.title || "")) || a.status === "paper" || a.status === "paper_wait");
  if (live && !paper) return text.replace(/\b(as|is|goes out as|built as|up as)\s+(a\s+)?(paper|practice)(\s+card|\s+trade|\s+only)?\b/gi, "$1 $2LIVE$4").replace(/\bPAPER\b/g, "LIVE") + "\n⚠ This card is LIVE — approving it sends a real order.";
  if (paper && !live) return text.replace(/\bLIVE\b/g, "PAPER");
  return text;
}
// v3.30 (item 1): the NO CARD message for a coach level with no direction.
const noCardLevel = (row: any): string => {
  const lv = Number(row?.level) > 0 ? Number(row.level) : levelsFromWords(row?.words || "")[0]?.level;
  return `NO CARD — the coach posted a level with no direction ("${String(row?.words || "").slice(0, 80)}"). Don't pick a side: it's on the Watcher both ways, and the card comes when price touches ${lv ?? "the level"} and a 5-minute candle closes. Say that in your read.`;
};
// v3.21 one card per ticker + direction (15 min). v3.44 fix 4: the same test runs again right AFTER the insert, because two
// Watcher runs 1 s apart (22 Oct META 632.5P, fd913098 + 77df88fc) both passed the check before either card existed.
export function sameIdeaCard(r: any, tk: string, direction: any, nowMs = Date.now()): boolean {
  return !!(r?.plan && String(r.plan.tv_symbol || "").split(":").pop()?.toUpperCase() === tk && r.plan.direction === direction &&
    nowMs - Date.parse(r.created_at) < 15 * 60e3 &&
    (["pending", "running", "paper_wait"].includes(r.status) || (r.status === "done" && ["waiting_fill", "armed"].includes(r.exit?.state))));
}
// Of all live cards for this idea, the oldest (created_at, then id) keeps it. Both racers compute the same winner.
export function dupWinner(rows: any[], me: any, tk: string, direction: any, nowMs = Date.now()): any | null {
  const same = (rows || []).filter((r: any) => r.id === me.id || sameIdeaCard(r, tk, direction, nowMs));
  if (!same.some((r: any) => r.id === me.id)) same.push(me);
  same.sort((a: any, b: any) => String(a.created_at).localeCompare(String(b.created_at)) || String(a.id).localeCompare(String(b.id)));
  return same[0] && same[0].id !== me.id ? same[0] : null;
}
/* v4.2.3 (Ifoma 26 Oct, "tighten it"): plan.weak fired on 100% of cards in the week of 20 Oct, so "Overrode Baby J" meant "approved anything".
   Weak now means exactly one of: the read/banner is No Edge or Choppy, or the entry is a chase (the bar already ran past the level).
   Anything else the model writes there is dropped on the server, so the flag cannot drift back to "everything". */
export const WEAK_RE = /no edge|chop|choppy|chase|chasing|ran (well )?past|past the level|already ran|beyond the level/i;
export function weakGuard(weak: unknown): string | undefined {
  const t = typeof weak === "string" ? weak.trim() : "";
  return t && WEAK_RE.test(t) ? t.slice(0, 240) : undefined;
}
export function overrideRead(a: any): string {
  const w = weakGuard(a?.plan?.weak);
  if (w) return w.slice(0, 160);
  const chase = (a?.checks || []).find((c: any) => c.ok === false && /chas/i.test(String(c.text)));
  return chase ? String(chase.text).slice(0, 160) : "";
}
export async function proposeAction(input: any, who: string, opts: { manual?: boolean; planExtra?: Record<string, unknown>; blockLevels?: Record<string, any> } = {}) {
  const calls = Array.isArray(input.calls) ? input.calls.slice(0, 6) : [];
  if (!calls.length) throw new Error("no calls");
  const asStock = optionAsStock(input);                                       // v3.44 fix 2: never a stock order at an option price
  if (asStock) throw new Error(asStock);
  // v3.1: an opening option order must carry its plan, so the scorecard can grade it.
  const opening = calls.some((c: any) => c.tool === "place_option_order" && (c.args?.legs || []).some((l: any) => l.position_effect === "open"));
  // v4.2.2 (23 Oct bug, AAPL 355C Coach #352): an opening leg with no option_id slipped through at 9:33 — no live quote at
  // approve, "price unavailable" on the trade row, Close Now refused. The self-test already required it; now the server does too.
  // v5.0 ROOMS: a member's room is paper-only. An opening idea becomes a PRACTICE card below; any other Robinhood write
  // (a close, a cancel, a stock order) has no practice form, so no card is made at all.
  if (owner() !== HOUSE && !opening && calls.some((c: any) => c.service === "rh" && WRITE.rh.has(c.tool)))
    throw new Error(PAPER_ONLY + " — a practice trade is closed with Close Now on the Desk; nothing is ever sent to Robinhood.");
  const openLeg = calls.flatMap((c: any) => c.tool === "place_option_order" ? (c.args?.legs || []) : []).find((l: any) => l.position_effect === "open");
  if (openLeg && !openLeg.option_id) throw new Error(`NO CARD — the opening leg has no option_id ("${String(input.title || "").slice(0, 80)}"). Look the contract up first (get_option_chains / get_option_instruments for the strike and expiry in the title) and propose again with legs[0].option_id set.`);
  // v3.14: the server stamps where the idea came from (signal / desk / scanner / alert / watcher trigger) for the Scoreboard.
  const plan = input.plan && typeof input.plan === "object" ? { ...input.plan, ...(opening ? (opts.planExtra || {}) : {}),
    ...(opening && !opts.planExtra?.source ? { source: who === "signals" ? "signal" : who === "alert" ? "alert" : who === "otto" ? "manual" : "desk" } : {}) } : null;
  if (plan) plan.rules = cleanRules(plan.rules);
  if (plan) plan.weak = weakGuard(plan.weak);                                 // v4.2.3: weak only means No Edge / Choppy / a chase
  // v3.21 (Ifoma, 7 Oct night): wrong-if is a 5-minute close on every new card; older cards keep 15.
  if (plan && opening) plan.wrong_tf = 5;
  // v3.4: ...and its exits. No exits, no card (Jarvis and the manual ticket alike).
  if (opening && (!plan || !plan.tv_symbol || !plan.direction || !plan.setup || plan.tp1 == null || plan.stop == null || !(Number(plan.stop_option) > 0))) {
    throw new Error("An opening option order needs its plan and exits: {tv_symbol (EXCHANGE:TICKER), direction ('up'|'down' on the underlying), setup, tp1, stop (underlying prices), stop_option (OPTION price for the protective stop, below the limit), entry_underlying?, expires? (YYYY-MM-DD)}. Add it and propose again.");
  }
  void opts;
  // v3.26: where the idea came from (on every opening card), and fix 1 — a coach level with no direction gets no
  // card from Signals: the Watcher watches it both ways and the card comes after a touch + a 5-minute close.
  let originRow: any = null;
  if (opening && plan) {
    try { const o = await originOf(plan); plan.origin = o.origin; originRow = o.row; } catch { plan.origin = "jarvis"; }
    if (who === "signals" && !opts.manual && plan.origin === "coach_level" && originRow && !originRow.direction) {
      throw new Error(noCardLevel(originRow));
    }
    // v3.30 (item 1, 13 Oct): Jarvis never puts plan.jason_id on the card, so the rule above did not fire (12 Oct: 5 direction-less
    // level posts got cards). The batch tells the server which tickers have only a direction-less level open; no card for those.
    if (who === "signals" && !opts.manual && !originRow && opts.blockLevels) {
      const tkB = String(plan.tv_symbol || "").split(":").pop()?.toUpperCase() || "";
      if (tkB && opts.blockLevels[tkB]) throw new Error(noCardLevel(opts.blockLevels[tkB]));
    }
  }
  // v3.21 (Ifoma, 7 Oct night): one card per ticker + direction. 7 Oct 10:32 two QQQ put cards went up at once.
  if (opening && !opts.manual && plan) {
    const tk = String(plan.tv_symbol || "").split(":").pop()?.toUpperCase() || "";
    const recent = await db("otto_actions?" + OQ() + "select=id,title,status,plan,exit,created_at&order=created_at.desc&limit=40").catch(() => []);
    const dup = (recent || []).find((r: any) => sameIdeaCard(r, tk, plan.direction));
    if (dup) throw new Error(`A ${tk} ${plan.direction === "down" ? "puts" : "calls"} card is already up: "${dup.title}" (${dup.status === "done" ? "filled, trade open" : dup.status}). Don't make a second one — point them to that card.`);
    // v3.22: levels more than 10% from the live price go back once, then no card.
    await levelGate(plan);
  }
  // v3.24 (C10a): no close / stop card for a contract the Agentic account doesn't hold (8 Oct 9:45 NVDA stop card, 9 min after the close).
  const gone = await nothingToClose(calls);
  if (gone) throw new Error(`NO CARD — nothing to close: ${gone}. Don't propose a stop or sell for it.`);
  const out: any[] = [];
  const review: string[] = [];
  let cost = 0, costKnown = true;
  const notes: string[] = [];
  for (const c of calls) {
    const service = c.service === "tv" || c.service === "rh" ? c.service : null;
    if (!service) throw new Error("service must be tv or rh");
    const tool = String(c.tool || "");
    if (!WRITE[service].has(tool)) throw new Error(`${tool} is not an approvable ${SVC[service].name} action`);
    const args = { ...(c.args || {}) };
    if (service === "rh" && RH_FORCE_ACCT.has(tool)) args.account_number = await agenticAccount();
    if (service === "rh" && (tool === "place_option_order" || tool === "place_equity_order")) {
      // v3.22: drop fields Robinhood's order tool doesn't take (7 Oct ABBV: chain_symbol → rejected).
      const sch = await rhSchema(tool);
      if (sch) { const rm = pruneArgs(args, sch); if (rm.length) notes.push("removed fields Robinhood doesn't take: " + rm.join(", ")); }
      args.ref_id = crypto.randomUUID();
      const k = costOf(tool, args);
      if (k.cost === null) costKnown = false; else cost += k.cost;
      if (k.note) notes.push(k.note);
      // Robinhood's own pre-trade check, so the card shows what the broker says.
      try {
        const rv = { ...args }; delete rv.ref_id;
        const r = await call("rh", tool === "place_option_order" ? "review_option_order" : "review_equity_order", rv);
        review.push(mcpText(r).slice(0, 1500));
      } catch (e) { review.push("Robinhood review failed: " + (e as Error).message); }
    }
    // v3.12: Otto does the pinging — alerts it creates never push from TradingView's own app too (double pings).
    if (tool === "mcp-tv-create-alert" && args && typeof args === "object") { args.mobile_push = false; args.popup = false;
      if (args.name) args.name = unname(args.name); if (args.message) args.message = unname(args.message); }
    out.push({ service, tool, args });
  }
  const exit = opening ? exitSpec(out, plan) : null;
  // v3.26 (9 Oct trade 1: a $0.93 stop on a $5.25 entry = −$432): with max loss per trade on, the stop is sized to it.
  const LIM0 = await getLimits().catch(() => LIMIT_DEFAULTS);
  const sizeChecks: any[] = [];
  if (exit && LIM0.max_loss_on !== false && Number(LIM0.max_trade_loss) > 0) {
    const ns = stopForMax(exit.entry_limit, exit.stop_option, exit.qty, Number(LIM0.max_trade_loss));
    if (ns) {
      sizeChecks.push({ ok: true, guard: true, text: `Stop moved up from $${exit.stop_option.toFixed(2)} to $${ns.toFixed(2)} so a stop-out loses about $${Math.round((exit.entry_limit - ns) * 100 * exit.qty)} — inside your max loss per trade ($${LIM0.max_trade_loss})` });
      exit.stop_option = ns; if (plan) plan.stop_option = ns;
    }
  }
  let account_value: number | null = null, buying_power: number | null = null;
  if (out.some((c) => c.service === "rh" && c.tool.startsWith("place_"))) {
    try {
      const pj = mcpJson(await call("rh", "get_portfolio", { account_number: await agenticAccount() }));
      account_value = Number(pj?.data?.total_value ?? pj?.total_value) || null;
      const bpr = Number(pj?.data?.buying_power?.buying_power ?? pj?.data?.buying_power);
      buying_power = Number.isFinite(bpr) && bpr >= 0 ? bpr : null;
    } catch { /* shown as unknown */ }
  }
  // v3.20 (Ifoma, 7 Oct night: "fits" = fits buying power; nothing fits → red-banner card anyway).
  // A card over buying power while a contract that fits exists goes back to Jarvis with that contract named.
  const bpChecks: any[] = [];
  if (exit && costKnown && buying_power != null && cost > buying_power) {
    let fitLine = "";
    if (!opts.manual) {
      const sym = String(plan?.tv_symbol || "").split(":").pop() || "";
      const sl = await withTimeout(shortlistCached(sym, exit.direction === "down" ? "put" : "call"), 25_000, "shortlist").catch(() => null);
      const f = sl?.bestFit;
      if (f && f.cost <= buying_power && f.option_id !== exit.option_id)
        throw new Error(`Over buying power: this contract costs $${Math.round(cost)} and the Agentic account has $${buying_power.toFixed(2)}. ◆ ${f.label} fits (option_id ${f.option_id}, ask $${f.ask.toFixed(2)}, ≈$${f.cost}, δ ${f.delta.toFixed(2)}). Propose again with that contract (re-size stop_option for it).`);
      fitLine = !sl ? "" : sl.rows.some((r: SLRow) => r.fits && r.ask > 0) ? " Only far out-of-the-money contracts (delta under .15) fit — Otto doesn't offer those." : " No contract on the list fits.";
    }
    bpChecks.push({ ok: false, text: `Over buying power: costs $${Math.round(cost)}, the Agentic account has $${buying_power.toFixed(2)} — Robinhood will reject this order unless cash is added.${fitLine}` });
  }
  const pct = account_value && costKnown ? cost / account_value : null;
  const LIM = await getLimits().catch(() => LIMIT_DEFAULTS);
  const risk = {
    cost: costKnown ? cost : null, account_value, buying_power, pct, warn_pct: LIM.warn_pct,
    flag: pct !== null && pct > LIM.warn_pct / 100, notes, account: out.some((c) => c.service === "rh") ? mask(await agenticAccount().catch(() => "????")) : null,
  };
  // v3.26: the kill switch turns the card into a PAPER card (shown, scored, never approvable).
  // v3.41: the order is kill switch → LIVE eligibility (v3.27) → size cap. A practice idea never meets the live cap: it is
  //        checked against the practice book's own cap and only flagged. A live-eligible idea over the live cap is OFFERED
  //        AS A PRACTICE CARD on the $4,000 practice book instead of being auto-rejected (Ifoma, 20 Oct).
  let paper: string | null = null;
  let practice = false;     // v3.35: a "not switched on for LIVE" idea waits for Josh's Approve / Reject as a practice card
  if (opening) {
    const ls = await lockState().catch(() => null);
    if (ls?.locked) paper = `Kill switch on — ${ls.text}. Signals keep listening; this idea is scored as a paper card.`;
    // v3.27: only the sources switched on in Settings may go LIVE; every other idea is a PRACTICE card Josh answers.
    // The manual Order ticket is Ifoma/Josh's own explicit order and is not affected.
    if (!paper && !opts.manual) {
      const og27 = String(plan?.origin || "jarvis");
      const key27 = og27 === "coach_call" ? "live_coach_call" : og27 === "coach_level" || og27 === "coach_post" ? "live_coach_level" : "live_jarvis";
      const allowed27 = key27 === "live_coach_call" ? LIM[key27] !== false : LIM[key27] === true;
      if (!allowed27) { paper = `PRACTICE · ${ORIGIN_LABEL[og27] || og27} is not switched on to go LIVE (Settings, Limits & goals, Which ideas can go LIVE). Josh can Approve or Reject it as a practice trade: nothing is ever sent to Robinhood.`; practice = true; }
      else if (og27 === "coach_call" && originRow?.late) paper = "PAPER · the coach's post came after the move (marked late). Never chase a missed price. Practice only: scored, never sent to Robinhood.";
    }
    // v5.0 ROOMS: in a member's room EVERY opening idea (Jarvis, the coach, the Order ticket) is a PRACTICE card on their own
    // $5,000 practice book — the same card Josh answers (fills at the live ask on Approve, scored by the practice book).
    if (owner() !== HOUSE) { paper = `PRACTICE · ${PAPER_ONLY}: Approve or Reject it as a practice trade on your practice book — nothing is ever sent to Robinhood.`; practice = true; }
    const capPct = Number(LIM.size_cap_pct) || 0;
    const capOn = LIM.size_cap_on !== false && capPct > 0 && costKnown;
    if (capOn && practice) {
      // practice: the live account's size has nothing to do with it — flag against the practice book, never block
      const book = await practiceBook().catch(() => PRACTICE_BOOK_DEFAULT);
      const pcap = Math.floor(book.start * capPct / 100);
      if (cost > pcap + 1e-9) sizeChecks.push({ ok: false, guard: true, text: `Over the practice cap: costs $${Math.round(cost)}, the practice cap is ${capPct}% of the $${book.start.toLocaleString("en-US")} practice book ($${pcap}). Still offered — practice only, nothing goes to Robinhood.` });
    } else if (capOn && !paper && pct != null && account_value && pct > capPct / 100 + 1e-9) {
      const capUsd = Math.floor(account_value * capPct / 100);
      if (!opts.manual && exit) {
        const sym = String(plan?.tv_symbol || "").split(":").pop() || "";
        const sl = await withTimeout(shortlistCached(sym, exit.direction === "down" ? "put" : "call"), 25_000, "shortlist").catch(() => null);
        const f = sl ? capFit(sl.rows, capUsd, buying_power) : null;
        if (f && f.option_id !== exit.option_id)
          throw new Error(`Over the size cap: this contract costs $${Math.round(cost)} = ${Math.round(pct * 100)}% of the account; the cap is ${capPct}% ($${capUsd}). ◆ ${f.label} fits under it (option_id ${f.option_id}, ask $${f.ask.toFixed(2)}, ≈$${f.cost}, δ ${Math.abs(f.delta).toFixed(2)}). Propose again with that contract (re-size stop_option for it).`);
      }
      if (opts.manual) {
        paper = `Costs $${Math.round(cost)} = ${Math.round(pct * 100)}% of the account. Your size cap is ${capPct}% ($${capUsd}).`;
      } else {
        const book = await practiceBook().catch(() => PRACTICE_BOOK_DEFAULT);
        paper = `PRACTICE · Over the size cap for LIVE: costs $${Math.round(cost)} = ${Math.round(pct * 100)}% of the Agentic account, the cap is ${capPct}% ($${capUsd}); no cheaper contract (delta .15 or higher) fit under it. Offered on the $${book.start.toLocaleString("en-US")} practice book instead: Josh can Approve or Reject it as a practice trade; nothing is sent to Robinhood.`;
        practice = true;
      }
    }
  }
  let banner: any = null, checks: any[] = [];
  if (opening) {
    try { const b = await sentimentNow(); banner = { verdict: b.verdict, score: b.score, fresh: b.fresh, at: b.at }; } catch { /* */ }
    try { checks = await ruleChecks(out, plan, risk, banner); } catch (e) { checks = [{ ok: null, text: "Rule check failed: " + (e as Error).message }]; }
    const atStop = exit ? (exit.entry_limit - exit.stop_option) * 100 * exit.qty : null;
    try { checks = checks.concat(await limitChecks(risk.cost, atStop)); } catch { /* */ }
    checks = bpChecks.concat(sizeChecks, checks);
    // v3.26: where the idea came from; an unclear ticker; against the day's move.
    const tk26 = String(plan?.tv_symbol || "").split(":").pop() || "";
    const og = plan?.origin;
    if (typeof plan?.weak === "string" && plan.weak.trim()) checks.unshift({ ok: false, guard: true, text: "Jarvis's read: " + unname(plan.weak).trim().slice(0, 240) });   // v3.36: a weak setup still gets a card
    if (og === "coach_call") checks.unshift({ ok: true, text: "The coach's own call and direction" });
    else if (og === "coach_level" || og === "coach_post") checks.unshift({ ok: null, text: `Direction picked by Jarvis — the coach gave a ${og === "coach_level" ? "level" : "ticker"}, not a direction` });
    else if (og === "coach_against") checks.unshift({ ok: false, guard: true, text: `Against the coach's direction (he said ${originRow?.direction || "the other way"})` });
    if (originRow?.words) { const u = unclearTicker(tk26, originRow.words); if (u) checks.unshift({ ok: false, guard: true, text: u }); }
    try { const dm = await withTimeout(dayMoveCheck(tk26, plan?.direction), 5000, "day move"); if (dm) checks.push(dm); } catch { /* */ }
    if (paper && practice) checks.unshift({ ok: null, practice: true, text: paper });
    else if (paper) checks.unshift({ ok: false, guard: true, paper: true, text: "AUTO-REJECTED · " + paper });
    // v3.24 (A8): already through its wrong-if → red line on the card (it's still built; Approve still places it).
    if (exit) { const st = await staleEntry({ exit, plan }).catch(() => null); if (st) checks.unshift({ ok: false, guard: true, stale: true, text: st }); }
  }
  const rows = await db("otto_actions", { method: "POST", body: JSON.stringify({
    owner: owner(),                                                                    // v5.0: the room's card
    title: (opening ? stampTitle(unname(input.title || "Action"), !!paper) : unstampTitle(unname(input.title || "Action")) || "Action").slice(0, 140),
    summary: unname(input.summary || "").slice(0, 4000),
    calls: out, risk, review: review.join("\n\n---\n\n"), status: practice ? "paper_wait" : paper ? "paper" : "pending", created_by: who,
    plan: plan ? { ...plan, setup: String(plan.setup).toLowerCase().slice(0, 40), ...(practice ? { practice: true } : {}) } : (practice ? { practice: true } : null), banner, checks,
    ...(exit ? { exit: { ...exit, state: "planned", log: [] } } : {}),
  }) });
  // v3.44 fix 4: the post-insert duplicate check (before any ping, Desk line or activity is written for this card)
  if (opening && !opts.manual && plan && rows?.[0] && ["pending", "paper_wait"].includes(rows[0].status)) {
    const tk44 = String(plan.tv_symbol || "").split(":").pop()?.toUpperCase() || "";
    const again = await db("otto_actions?" + OQ() + "select=id,title,status,plan,exit,created_at&order=created_at.desc&limit=40").catch(() => null);
    const win = again ? dupWinner(again, rows[0], tk44, plan.direction) : null;
    if (win) {
      await db(`otto_actions?id=eq.${rows[0].id}&status=in.(pending,paper_wait)`, { method: "PATCH", headers: { prefer: "return=minimal" },
        body: JSON.stringify({ status: "expired", decided_by: `otto (duplicate of ${String(win.id).slice(0, 8)})`, decided_at: new Date().toISOString(),
          plan: { ...(rows[0].plan || {}), duplicate_of: win.id } }) }).catch(() => {});
      throw new Error(`A ${tk44} ${plan.direction === "down" ? "puts" : "calls"} card is already up: "${win.title}" (${win.status}). Don't make a second one — point them to that card.`);
    }
  }
  if (rows?.[0]?.status === "pending" && who !== "signals" && who !== "alert" && who !== "watcher") await markPinged([rows[0].id]), await notify("card", `🃏 Card waiting: ${String(rows[0].title).slice(0, 80)}`, "Tap to open the Desk and Approve or Reject (cards expire in 20 minutes).");
  // v5.9: OttoPilot — Baby J answers his own practice card (never a LIVE card, never the manual Order ticket)
  if (rows?.[0]?.status === "paper_wait" && !opts.manual) {
    let apTaken: any = null;
    try { apTaken = await autopilotTake(rows[0]); } catch (e) { console.error("autopilot", e); }
    if (apTaken) { await markPinged([rows[0].id]).catch(() => {}); return apTaken; }
  }
  if (rows?.[0]?.status === "paper_wait") {
    await markPinged([rows[0].id]);
    await logDesk("system", "Otto", `📝 Practice card: ${rows[0].title} — waiting for Josh to Approve or Reject (20 minutes). Practice only: nothing is sent to Robinhood.`, rows[0].id);
    await activity("card", `Practice card (waiting for Josh): ${rows[0].title}`, who === "otto" ? "ticket" : who);
    if (who !== "signals" && who !== "alert" && who !== "watcher") await notify("card", `📝 Practice card waiting: ${String(rows[0].title).slice(0, 70)}`, "Josh: tap to open the Desk and Approve or Reject (practice only, expires in 20 minutes).");
  }
  if (rows?.[0]?.status === "paper") {
    await markPinged([rows[0].id]);
    // v3.41: name the one real reason (the kill switch, a late coach post, or a manual ticket over the cap) — nothing broader.
    await logDesk("system", "Otto", `📄 Auto-rejected — ${String(paper).replace(/^PAPER · /, "")} Shown and scored.`, rows[0].id);
    await activity("card", `Paper card (auto-rejected): ${rows[0].title} — ${paper}`, who === "otto" ? "ticket" : who);
  }
  return publicAction(rows[0]);
}

function publicAction(a: any) {
  // Never send the account number to the browser.
  const calls = (a.calls || []).map((c: any) => {
    const args = { ...c.args }; if (args.account_number) args.account_number = mask(args.account_number);
    return { ...c, args };
  });
  return { id: a.id, title: a.title, summary: a.summary, calls, risk: a.risk, review: a.review,
           status: a.status, result: a.result, created_at: a.created_at, created_by: a.created_by,
           decided_by: a.decided_by, decided_at: a.decided_at,
           plan: a.plan || null, banner: a.banner || null, checks: a.checks || [], order_id: a.order_id || null, outcome: a.outcome || null, exit: a.exit || null };
}

/* v3.41: the WHY GATE. Approve needs three lines (the setup in Josh's words, why now, what kills it); Reject needs one.
   Blocking by decision (Ifoma, 18 Oct): no why, no trade — the server refuses, the app never gets to a half-state.
   Returns the cleaned record to store on plan.josh_why / plan.josh_reject_why. Otto's own decisions (expiry, the VWAP rule) never pass through here. */
export const WHY_MIN = 10;
export function whyGate(why: any, kind: "approve" | "reject"): any {
  const clean = (v: unknown) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, 400);
  if (kind === "reject") {
    const t = clean(typeof why === "string" ? why : why?.why_not ?? why?.text);
    if (t.length < WHY_MIN) throw new Error(`Why gate: say why not (at least ${WHY_MIN} characters) — the report card reads it.`);
    return { why_not: t, at: new Date().toISOString() };
  }
  const setup = clean(why?.setup), now = clean(why?.why_now), kills = clean(why?.kills);
  const miss = [["setup", setup], ["why now", now], ["what kills it", kills]].filter(([, v]) => (v as string).length < WHY_MIN).map(([k]) => k);
  if (miss.length) throw new Error(`Why gate: fill in ${miss.join(", ")} (at least ${WHY_MIN} characters each) before this trade counts.`);
  return { setup, why_now: now, kills, at: new Date().toISOString() };
}
/* v3.35: a PRACTICE card (status paper_wait) is approved or rejected like a live one, but this function only writes to our own
   database. It has no call() to Robinhood for orders: the only Robinhood reads are a quote. The fill is the option's live ask
   at the tap; the idea is then graded from that moment (evalIdea). Approve never fails on a missing quote: it falls back to the card's price. */
export async function practiceOn(a: any, decision: string, who: string, why: any = null, opts: any = {}) {
  const id = a.id, now = new Date().toISOString();
  const left = (patch: any) => db("otto_actions?id=eq." + id + "&status=eq.paper_wait", { method: "PATCH", body: JSON.stringify(patch) });
  if (decision !== "approve") {
    const r = await left({ status: "rejected", decided_by: who, decided_at: now, plan: { ...(a.plan || {}), josh_reject_why: whyGate(why, "reject") } });
    if (r?.[0]) await activity("card", `Rejected (practice): ${a.title}`, who.split("@")[0]);
    return publicAction(r?.[0] || a);
  }
  // v5.7 (6 Nov, Josh): with fill_now the fill is stamped at the TAP and the why comes right after (whyAttach). No why yet = why_pending,
  // and a why_pending trade older than NO_WHY_MIN minutes counts as an override on the Scoreboard. Without fill_now the v3.41 gate is unchanged.
  const fillNow = !!opts?.fill_now && why == null;
  const why_ok = fillNow ? null : whyGate(why, "approve");     // v3.41: blocking — no why, no practice trade (throws before anything is written)
  if (Date.now() - Date.parse(a.created_at) > ACTION_TTL_MS) {
    const r = await left({ status: "expired", decided_by: who, decided_at: now });
    return publicAction(r?.[0] || a);
  }
  // Read the fill first so a slow quote can't leave a half-approved card; a failed read falls back to the card's own numbers.
  const leg = (a.calls || []).flatMap((c: any) => c.args?.legs || []).find((l: any) => l.position_effect === "open");
  const tk = String(a.plan?.tv_symbol || "").split(":").pop()?.toUpperCase() || "";
  let ask: number | null = null, delta: number | null = null, under: number | null = null, note = "";
  try {
    const q = (mcpJson(await withTimeout(call("rh", "get_option_quotes", { instrument_ids: [leg?.option_id] }), 5000, "practice quote"))?.data?.results || [])[0]?.quote || null;
    if (q && Number(q.ask_price) > 0) { ask = Number(q.ask_price); if (q.delta != null && isFinite(Number(q.delta))) delta = Math.abs(Number(q.delta)); }
  } catch { /* fall back below */ }
  try { const px = tk ? (await withTimeout(rhPrices([tk]), 5000, "practice price"))[tk] : null; if (px > 0) under = px; } catch { /* */ }
  if (ask == null) { ask = Number(a.exit?.entry_limit) > 0 ? Number(a.exit.entry_limit) : null; note += "No live option quote: used the card's price. "; }
  if (under == null) { under = Number(a.plan?.entry_underlying) > 0 ? Number(a.plan.entry_underlying) : null; note += "No live stock price: used the card's entry price. "; }
  const fill = { ask, delta, underlying: under, at: now, by: who, note: note.trim() || null };
  // v3.41: the v3.39 override tag applies to practice approvals too (the practice book's "Overrode Baby J" line reads it)
  const weakRead = overrideRead(a);                                          // v4.2.3: only a real No Edge / Choppy / chase flag counts as an override
  const ap = opts?.autopilot || null;                                       // v5.9: Baby J took it himself (OttoPilot) — his why, never Josh's
  const plan = { ...(a.plan || {}), paper_fill: fill, ...(ap ? { autopilot: { ...ap, at: now }, why_pending: false } : why_ok ? { josh_why: why_ok, why_pending: false } : { why_pending: true }),
    tp_check: tpCheck(a.plan, under), ...(weakRead && !ap ? { override: true, override_read: weakRead } : {}) };
  const r = await left({ status: "paper_taken", decided_by: who, decided_at: now, plan, outcome: null });
  if (!r?.[0]) return publicAction((await db("otto_actions?id=eq." + id + "&select=*"))[0] || a);
  await activity("card", `Approved (practice): ${a.title}. Pretend fill ${ask != null ? "$" + ask.toFixed(2) : "unknown"} by ${who.split("@")[0]}`, who.split("@")[0]);
  await logDesk("system", "Otto", ap ? apTakeLine(a, ap, ask, under, tk, note) : `✅ Practice trade taken: ${a.title}. Pretend fill ${ask != null ? "$" + ask.toFixed(2) + " (ask)" : "at the card's price"}${under != null ? ` (${tk} ${under})` : ""}, approved by ${who}${fillNow ? " at the tap" : ""}. ${why_ok ? `Why: "${why_ok.setup.slice(0, 120)}" · Kills it: ${why_ok.kills.slice(0, 80)}. ` : "Why: not answered yet. "}${plan.tp_check?.close ? `⚠ The card's target ${a.plan?.tp1} is only $${plan.tp_check.dist} from this fill. ` : ""}${note}Nothing was sent to Robinhood. It is scored from this moment on the practice book.`, id);
  if (weakRead && !ap) await logDesk("assistant", "Jarvis", `Noted. I called this one weak — "${weakRead}". Logging it as an override by ${who.split("@")[0]}. The scoreboard keeps count.`, id);
  return publicAction(r[0]);
}

/* v5.7 (6 Nov 2026, Josh's ask: "enter me when I press the button, not after my why — but still make me answer").
   tpCheck: after the fill, is the card's TP1 already within TP_CLOSE_PCT of the fill (or passed)? The MU 695P on 6 Nov: card built at
   707.51 with TP1 700, filled 56 s later at 701.19 → the rule exit fired for +$52 on a trade Josh meant to ride to 683. The why dialog
   then offers his own target. Only plan.tp1 moves (evalIdea grades practice cards from plan.tp1); exit.tp1 moves with it. */
export const TP_CLOSE_PCT = 0.5, NO_WHY_MIN = 5, NO_WHY_TEXT = "Approved without a why";
export function tpCheck(plan: any, under: number | null): any {
  const tp = Number(plan?.tp1), u = Number(under);
  if (!(tp > 0) || !(u > 0) || !plan?.direction) return null;
  const dist = plan.direction === "down" ? u - tp : tp - u;             // room left to the target, negative = already passed
  const close = dist <= u * TP_CLOSE_PCT / 100;
  return { close, dist: Math.round(dist * 100) / 100, pct: Math.round(dist / u * 10000) / 100, tp1: tp, under: u };
}
export function noWhy(a: any, now = Date.now()): boolean {
  const p = a?.plan || {};
  if (a?.status !== "paper_taken" || !p.why_pending || p.josh_why) return false;
  const at = Date.parse(p.paper_fill?.at || a.decided_at || "");
  return isFinite(at) && now - at >= NO_WHY_MIN * 60e3;
}
/* The second half of a fill-at-tap approve: Josh's three lines (and his own target, if he typed one) land on the already-taken card. */
export async function whyAttach(id: string, who: string, why: any, tp1: any = null) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new Error("bad id");
  const a = (await db("otto_actions?id=eq." + id + "&select=*"))?.[0];
  if (!a) throw new Error("no such card");
  if (a.status !== "paper_taken" || !a.plan?.why_pending || a.plan?.josh_why) return publicAction(a);   // nothing to attach: idempotent
  const why_ok = whyGate(why, "approve");
  const plan: any = { ...(a.plan || {}), josh_why: why_ok, why_pending: false };
  const exit: any = { ...(a.exit || {}) };
  const t = Number(tp1), old = Number(a.plan?.tp1);
  let tpLine = "";
  const u = Number(a.plan?.paper_fill?.underlying) || Number(a.plan?.entry_underlying) || 0;
  const ok = t > 0 && isFinite(t) && t !== old && (!(u > 0) || !a.plan?.direction || (a.plan.direction === "down" ? t < u : t > u));
  if (ok) { plan.tp1 = t; plan.tp1_card = old; plan.tp1_by = who; exit.tp1 = t; tpLine = ` Josh set his target: ${t} (the card said ${old}).`; }
  const r = await db("otto_actions?id=eq." + id + "&status=eq.paper_taken", { method: "PATCH", body: JSON.stringify({ plan, ...(a.exit ? { exit } : {}) }) });
  await logDesk("system", "Otto", `📝 Why for ${a.title}: "${why_ok.setup.slice(0, 120)}" · Kills it: ${why_ok.kills.slice(0, 80)}.${tpLine}`, id);
  return publicAction(r?.[0] || { ...a, plan, exit });
}

/* ===================================================================== v5.9 (11 Nov 2026) — OTTOPILOT for Baby J
   Josh + Ifoma, 11 Nov: "Josh may not be in the chat as much … put Jarvis on autopilot: they plan in the morning, then he
   goes autopilot and Baby J makes the decisions." Decided by Ifoma: Josh OR Ifoma can switch it; Baby J may take ideas that
   were not in the morning plan (marked OFF PLAN); 3 trades, off after 2 losing trades, no new trade from 3:00 PM (all three
   are numbers in the OttoPilot box, not code).
   What it is: while OttoPilot is on, a new PRACTICE card (status paper_wait) is answered by the server with the same
   practiceOn() Josh's Approve uses — fill at the live ask, scored by the card's own rules. Nothing else changes.
   What it never does: a LIVE card (status pending) still waits for a human tap; the manual Order ticket is never touched;
   a card Baby J himself flagged weak (No Edge / Choppy / a chase) is never TAKEN — since v5.9.2 it is recorded as passed by
   OttoPilot (plan.autopilot_pass) instead of expiring on Josh. There is no order code in this block. */
export const AP_DEFAULTS = { max_trades: 3, max_losses: 2, last_entry_min: 900 };
const AP_KEY = "autopilot";
const apHuman = (v: any, who: string) => String(v || "").replace(/[^A-Za-z .'-]/g, "").trim().slice(0, 30) || who.split("@")[0];
export async function apGet(): Promise<any> {
  const all = (await setting(AP_KEY).catch(() => null)) || {};
  const mine = all?.rooms?.[owner()] || {};
  const today = etParts().date;
  return { ...mine, on: !!mine.on && mine.day === today, cfg: { ...AP_DEFAULTS, ...(mine.cfg || {}) }, today };
}
async function apPut(patch: any) {
  const all = (await setting(AP_KEY).catch(() => null)) || {};
  const rooms = { ...(all.rooms || {}) };
  rooms[owner()] = { ...(rooms[owner()] || {}), ...patch };
  await putSetting(AP_KEY, { rooms }, "autopilot");
}
const apTk = (plan: any) => String(plan?.tv_symbol || "").split(":").pop()?.toUpperCase() || "";
const apState = (a: any): string => a?.outcome && ["win", "loss", "scratch", "unscored"].includes(a.outcome.state) ? a.outcome.state : "open";
const apEst = (a: any): number | null => a?.outcome && ["win", "loss", "scratch"].includes(a.outcome.state) && a.outcome.pnl_est != null ? Number(a.outcome.pnl_est) : null;
/* Today's trades OttoPilot took (oldest first). */
export async function apTrades(day = etParts().date): Promise<any[]> {
  const since = new Date(Date.now() - 20 * 3600e3).toISOString();
  const rows: any[] = (await db(`otto_actions?${OQ()}select=id,title,status,plan,outcome,created_at,decided_at&status=eq.paper_taken&created_at=gte.${since}&order=created_at.desc&limit=80`).catch(() => [])) || [];
  const at = (a: any) => Date.parse(a.plan?.paper_fill?.at || a.decided_at || a.created_at) || 0;
  return rows.filter((a: any) => a?.plan?.autopilot && etParts(new Date(at(a))).date === day).sort((x: any, y: any) => at(x) - at(y));
}
/* Why OttoPilot must stop now ("" = it may take the next card). Pure. */
export function apStop(cfg: any, trades: any[], min: number): string {
  const c = { ...AP_DEFAULTS, ...(cfg || {}) };
  if (trades.length >= c.max_trades) return `the trade limit (${c.max_trades} trade${c.max_trades === 1 ? "" : "s"} a day)`;
  const losses = trades.filter((a: any) => apState(a) === "loss").length;
  if (c.max_losses > 0 && losses >= c.max_losses) return `the loss stop (${losses} losing trade${losses === 1 ? "" : "s"})`;
  if (min >= c.last_entry_min) return `the last entry time (${fmtMin(c.last_entry_min)} ET)`;
  return "";
}
/* Is this card's name + direction in the morning plan? A plan line with no direction (or "both") matches either way. Pure. */
export function apOnPlan(plan: any, items: any[]): boolean {
  const tk = apTk(plan), d = plan?.direction;
  return !!tk && (items || []).some((x: any) => String(x?.ticker || "").toUpperCase() === tk && (!x.direction || x.direction === "both" || x.direction === d));
}
/* v5.9.2: the IDEA lines of a card's summary — the level, the trigger, what price did — without the order, cost, size, contract
   and flag lines (11 Nov: the AMD why read "Cost $920, OVER $837.92 buying power"). Nothing usable → the level the card is built on. Pure. */
export function apIdea(a: any): string {
  const p = a?.plan || {};
  const parts = String(a?.summary || "").split(/\s+·\s+|\n+/).map((x) => x.replace(/^[\s•\-–—]+/, "").replace(/\s+/g, " ").trim()).filter(Boolean);
  const junk = /cost\b|buying power|contract|limit\b|stop_option|max loss|size (cap|flag)|\bdelta\b|volume|open interest|\bOI\b|expir|^PAPER|^PRACTICE|^LIVE|──|otto rules|house rule|banner|^⚠|\$\d[\d,.]* ?\(|TP2|runner|option stop/i;
  const good = /level|trigger|clos(e|ed)|hold|held|break|broke|reclaim|reject|bounce|support|resistance|gap|vwap|retest|pullback/i;
  const picked = parts.filter((x) => x.length >= 12 && x.length <= 220 && good.test(x) && !junk.test(x)).slice(0, 2);
  if (picked.length) return picked.join(" · ");
  return p.level != null ? `Built on the ${p.level} level.` : "";
}
/* Baby J's why for a trade he takes himself: his own card, in the three lines Josh is asked for. No extra AI call. Pure. */
export function apWhy(a: any): any {
  const p = a?.plan || {}, tk = apTk(p);
  const setup = `${String(p.setup || "setup")} on ${tk} (${p.direction === "down" ? "puts" : "calls"}). ${apIdea(a)}`.trim().slice(0, 400);
  const why_now = (p.level != null ? `Price reached the level the idea is built on (${p.level}). ` : "The setup triggered. ") +
    `Entry near ${p.entry_underlying ?? "the card's price"}, target ${p.tp1}.`;
  const kills = `A ${Number(p.wrong_tf) === 15 ? 15 : 5}-minute close ${p.direction === "down" ? "above" : "below"} ${p.stop} (the card's wrong-if).`;
  return { setup, why_now, kills, by: "Baby J, from his own card" };
}
function apTakeLine(a: any, ap: any, ask: number | null, under: number | null, tk: string, note: string): string {
  return `🛫 OttoPilot took a practice trade: ${a.title}. Pretend fill ${ask != null ? "$" + ask.toFixed(2) + " (ask)" : "at the card's price"}${under != null ? ` (${tk} ${under})` : ""}. ` +
    `Baby J's why: "${String(ap.why?.setup || "").slice(0, 160)}" · Kills it: ${String(ap.why?.kills || "").slice(0, 90)} ` +
    (ap.on_plan ? "On this morning's plan. " : "⚠ OFF PLAN: this name and direction were not in this morning's plan. ") +
    `${note}Nothing was sent to Robinhood. Scored from this moment on the practice book, on the OttoPilot line.`;
}
export function apRecap(trades: any[]): string {
  if (!trades.length) return "OttoPilot took no trades.";
  const closed = trades.filter((a: any) => apEst(a) != null), tot = Math.round(closed.reduce((s: number, a: any) => s + (apEst(a) || 0), 0));
  const line = (a: any) => { const st = apState(a), e = apEst(a);
    return `• ${practiceLabel(a.title)} — ${a.plan?.autopilot?.on_plan ? "on plan" : "OFF PLAN"} — ${st === "open" ? "still open" : st + (e != null ? ` ${e >= 0 ? "+" : "−"}$${Math.abs(Math.round(e))}` : "")} — why: "${String(a.plan?.autopilot?.why?.setup || "").slice(0, 110)}"`; };
  return `OttoPilot took ${trades.length} practice trade${trades.length === 1 ? "" : "s"}${closed.length ? ` (${tot >= 0 ? "+" : "−"}$${Math.abs(tot)} on the ${closed.length} closed)` : ""}:\n${trades.map(line).join("\n")}`;
}
export async function apOff(reason: string, by: string) {
  const st = await apGet();
  if (!st.on) return st;
  await apPut({ on: false, off: { at: new Date().toISOString(), by, reason } });
  const trades = await apTrades(st.today).catch(() => []);
  await logDesk("system", "Otto", `🛬 OttoPilot OFF — ${reason}. ${apRecap(trades)}\nPractice cards wait for Josh's Approve or Reject again. Open OttoPilot trades keep running on their own rules (wrong-if, target, 3:50 PM).`);
  await activity("change", `OttoPilot OFF — ${reason}`, by).catch(() => {});
  if (by === "Otto") await notify("card", "🛬 OttoPilot switched itself off", reason.slice(0, 120)).catch(() => {});
  return await apGet();
}
/* The limits are checked when a card arrives AND on every score tick / Desk look, so the off line is not late. */
export async function apTick() {
  const st = await apGet();
  if (!st.on) return;
  const stop = apStop(st.cfg, await apTrades(st.today), etParts().min);
  if (stop) await apOff("it reached " + stop, "Otto");
}
/* A new practice card while OttoPilot is on. Returns the taken card, or null when it is left for Josh. */
export async function autopilotTake(a: any): Promise<any | null> {
  if (!a || a.status !== "paper_wait") return null;
  const st = await apGet();
  if (!st.on || marketClock().status !== "open") return null;
  const trades = await apTrades(st.today);
  const stop = apStop(st.cfg, trades, etParts().min);
  if (stop) { await apOff("it reached " + stop, "Otto"); return null; }
  const weak = overrideRead(a);
  if (weak) {   // v5.9.2 (Ifoma, 11 Nov): Baby J's own "weak" is his decision — passed now, not left to expire on Josh; still graded as a what-if
    const now = new Date().toISOString();
    const r = await db("otto_actions?id=eq." + a.id + "&status=eq.paper_wait", { method: "PATCH",
      body: JSON.stringify({ status: "rejected", decided_by: "autopilot", decided_at: now, plan: { ...(a.plan || {}), autopilot_pass: { why: weak, at: now, switched_by: st.by || null } } }) });
    if (!r?.[0]) return null;
    await logDesk("system", "Otto", `🛫 OttoPilot passed on this one — Baby J flagged it himself: "${weak}". ${a.title}. It is still scored as a what-if, and it does not count as a card Josh missed.`, a.id);
    await activity("card", `OttoPilot passed (Baby J flagged it weak): ${a.title}`, "OttoPilot").catch(() => {});
    return publicAction(r[0]);
  }
  const taken = await practiceOn(a, "approve", "autopilot", null, { fill_now: true,
    autopilot: { on_plan: apOnPlan(a.plan, st.plan?.items || []), why: apWhy(a), switched_by: st.by || null, n: trades.length + 1 } });
  if (taken?.status !== "paper_taken" || !taken?.plan?.autopilot) return null;   // (a weak card returned above as "rejected")
  await notify("card", `🛫 OttoPilot took: ${String(a.title).slice(0, 70)}`, `Practice trade ${trades.length + 1} of ${st.cfg.max_trades}${taken.plan.autopilot.on_plan ? "" : " · OFF PLAN"}. Nothing was sent to Robinhood.`).catch(() => {});
  if (trades.length + 1 >= st.cfg.max_trades) await apOff(`it reached the trade limit (${st.cfg.max_trades} trade${st.cfg.max_trades === 1 ? "" : "s"} a day)`, "Otto");
  return taken;
}
const AP_PLAN_TOOL = { name: "autopilot_plan", description: "Write today's plan from this morning's conversation.",
  input_schema: { type: "object", properties: {
    summary: { type: "string", description: "Two or three plain sentences: what the trader and you agreed to look for today." },
    items: { type: "array", maxItems: 12, items: { type: "object", properties: {
      ticker: { type: "string" }, direction: { type: "string", enum: ["up", "down", "both"], description: "up = calls, down = puts, both = either way at the level" },
      level: { type: "number", description: "the price level, when one was named" }, note: { type: "string", description: "a few words" } }, required: ["ticker", "direction"] } } },
    required: ["summary", "items"] } };
/* The morning plan, captured when OttoPilot is switched on: today's Watcher levels + Josh's homework levels + (one AI read of)
   this morning's Desk conversation. If the AI read fails, the levels alone are the plan and the Desk line says so. */
export async function apBuildPlan(): Promise<any> {
  const e = etParts(), items: any[] = [], seen = new Set<string>();
  const add = (ticker: any, direction: any, level: any, note: string, src: string) => {
    const tk = String(ticker || "").toUpperCase().replace(/[^A-Z.]/g, "").slice(0, 6);
    const d = direction === "up" || direction === "down" ? direction : "both";
    if (!tk || seen.has(tk + "|" + d) || items.length >= 20) return;
    seen.add(tk + "|" + d);
    const lv = Number(level);
    items.push({ ticker: tk, direction: d, ...(isFinite(lv) && lv > 0 ? { level: lv } : {}), ...(note ? { note: String(note).slice(0, 80) } : {}), src });
  };
  const marks = await watchRows(e.date).catch(() => []);
  const hk = await hkStatus().catch(() => null);
  const since = new Date(Date.now() - (e.min + 5) * 60e3).toISOString();            // since midnight ET
  const chat: any[] = (await db("otto_desk?" + OQ() + "select=created_at,role,author,content&created_at=gte." + since + "&role=in.(user,assistant)&order=id.asc&limit=200").catch(() => [])) || [];
  let summary = "", source = "levels", err = "";
  if (chat.some((m: any) => m.role === "user")) {
    try {
      const out = await claudeTool({ model: MODEL, max_tokens: 900,
        system: [{ type: "text", text: `You are Jarvis inside Otto Trader. The trader is about to switch OttoPilot on: for the rest of today you take practice trades yourself. Write down today's plan from this morning's conversation with the trader. Only what was actually said or is in the lists below: never add a name, a direction or a level that is not there. If nothing was planned, return no items and say so.${NAME_RULE}` }],
        tools: [AP_PLAN_TOOL], messages: [{ role: "user", content:
          `WATCHER LEVELS TODAY: ${(marks || []).map((r: any) => `${r.ticker} ${Number(r.level)} ${r.dir}`).join(", ") || "none"}\n` +
          `HOMEWORK LEVELS: ${((hk?.levels || []) as any[]).map((x: any) => `${x.ticker} ${x.level} ${x.dir}`).join(", ") || "none"}\n` +
          `THIS MORNING'S CONVERSATION:\n${chat.slice(-50).map((m: any) => `${m.role === "user" ? (m.author || "Trader") : "Jarvis"}: ${String(m.content || "").slice(0, 600)}`).join("\n")}` }] },
        "autopilot_plan", 40_000);
      summary = unname(String(out?.summary || "")).slice(0, 600);
      for (const x of (Array.isArray(out?.items) ? out.items : []).slice(0, 12)) add(x?.ticker, x?.direction, x?.level, unname(String(x?.note || "")), "chat");
      source = "this morning's conversation + levels";
    } catch (er) { err = String((er as Error)?.message || er).slice(0, 120); }
  }
  for (const r of (marks || [])) add(r.ticker, r.dir, r.level, String(r.note || ""), "watcher");
  for (const x of ((hk?.levels || []) as any[])) add(x.ticker, x.dir, x.level, "Josh's homework", "homework");
  return { items, summary, source, ...(err ? { error: err } : {}), at: new Date().toISOString() };
}
const apPlanLine = (plan: any) => !(plan?.items || []).length ? "No plan was made this morning, so every OttoPilot trade today will be marked OFF PLAN."
  : `Plan (${plan.source}): ${plan.items.map((x: any) => `${x.ticker} ${x.direction === "up" ? "▲" : x.direction === "down" ? "▼" : "▲▼"}${x.level ? " " + x.level : ""}`).join(", ")}.${plan.summary ? " " + plan.summary : ""}${plan.error ? " (Baby J could not read the conversation just now, so the plan is the levels only.)" : ""}`;
export async function apView() {
  const st = await apGet(), trades = await apTrades(st.today).catch(() => []), same = st.day === st.today;
  return { ok: true, on: st.on, day: st.today, by: st.on ? st.by || null : null, at: st.on ? st.at || null : null,
    plan: same ? st.plan || null : null, off: same && !st.on ? st.off || null : null, cfg: st.cfg, clock: marketClock().status,
    left: Math.max(0, st.cfg.max_trades - trades.length),
    trades: trades.map((a: any) => ({ id: a.id, title: practiceLabel(a.title), on_plan: !!a.plan.autopilot.on_plan, state: apState(a), est: apEst(a),
      at: a.plan.paper_fill?.at || null, fill: a.plan.paper_fill?.ask ?? null, why: String(a.plan.autopilot.why?.setup || "").slice(0, 240) })) };
}
/* fn=autopilot — GET: the state. POST {on:true|false, author} switches it (Josh or Ifoma); POST {cfg:{max_trades,max_losses,last_entry:"15:00"}} sets the numbers. */
export async function autopilotRoute(body: any, who: string) {
  const by = apHuman(body?.author, who);
  if (body?.cfg && typeof body.cfg === "object") {
    const c = body.cfg, cur = (await apGet()).cfg;
    const num = (v: any, lo: number, hi: number, lab: string) => { const n = Math.round(Number(v)); if (!isFinite(n) || n < lo || n > hi) throw new Error(`${lab} must be between ${lo} and ${hi}`); return n; };
    const hm2 = /^(\d{1,2}):(\d{2})$/.exec(String(c.last_entry ?? ""));
    const le = hm2 ? Number(hm2[1]) * 60 + Number(hm2[2]) : c.last_entry_min != null ? Number(c.last_entry_min) : cur.last_entry_min;
    if (!isFinite(le) || le < 585 || le > 950) throw new Error("Last entry must be between 9:45 AM and 3:50 PM ET");
    const cfg = { max_trades: num(c.max_trades ?? cur.max_trades, 1, 10, "Trades a day"), max_losses: num(c.max_losses ?? cur.max_losses, 0, 10, "Losing trades (0 = off)"), last_entry_min: Math.round(le) };
    await apPut({ cfg });
    if (JSON.stringify(cfg) !== JSON.stringify(cur)) {
      const txt = `OttoPilot limits set by ${by}: ${cfg.max_trades} trade${cfg.max_trades === 1 ? "" : "s"} a day, off after ${cfg.max_losses || "no"} losing trade${cfg.max_losses === 1 ? "" : "s"}, no new trade from ${fmtMin(cfg.last_entry_min)} ET`;
      await activity("change", txt, by).catch(() => {});
      await logDesk("system", "Otto", txt + ".");
    }
  }
  if (body?.on === true) {
    const e = etParts(), st0 = await apGet();
    if (!isTradingDay(e.date)) throw new Error("The market is closed today. OttoPilot can be switched on on a trading day.");
    if (!st0.on) {
      const stop = apStop(st0.cfg, await apTrades(e.date), e.min);
      if (stop) throw new Error(`OttoPilot can't start: today already reached ${stop}. Change the number in the OttoPilot box if you want more.`);
      const plan = await apBuildPlan();
      await apPut({ on: true, day: e.date, by, at: new Date().toISOString(), plan, off: null });
      await logDesk("system", "Otto", `🛫 OttoPilot ON — switched on by ${by}. Baby J now answers his own PRACTICE cards until ${st0.cfg.max_trades} trade${st0.cfg.max_trades === 1 ? "" : "s"}, ${st0.cfg.max_losses ? st0.cfg.max_losses + " losing trade" + (st0.cfg.max_losses === 1 ? "" : "s") + ", " : ""}or ${fmtMin(st0.cfg.last_entry_min)} ET, whichever comes first. ${apPlanLine(plan)} Practice only: a LIVE (real money) card still waits for a human tap. A card Baby J flags weak himself is passed, not taken.`);
      await activity("change", `OttoPilot ON (by ${by})`, by).catch(() => {});
      if (marketClock().status === "open") {                                             // cards already waiting when it is switched on
        const wait: any[] = (await db("otto_actions?" + OQ() + "select=*&status=eq.paper_wait&order=created_at.asc&limit=6").catch(() => [])) || [];
        for (const a of wait) {
          if (a.created_by === "otto" || Date.now() - Date.parse(a.created_at) > ACTION_TTL_MS) continue;   // the Order ticket is the trader's own; expired cards stay expired
          try { await autopilotTake(a); } catch (er) { console.error("autopilot sweep", er); }
        }
      }
    }
  } else if (body?.on === false) {
    await apOff(`switched off by ${by}`, by);
  }
  await apTick().catch(() => {});
  return await apView();
}

/* ===================================================================== v5.9.1 (11 Nov 2026) — BAR DOWNLOADER for the backtest
   Checklist item 1. Real 10-minute (or 5-minute) Robinhood bars, with volume, saved in table otto_bars so the two Winston 2 setups
   can be tested on real prices (bars pulled into a chat arrive as text and cannot be calculated on). READ-ONLY market data: the
   only Robinhood tool here is get_equity_historicals. Admin only. Nothing here is read by Jarvis, Winston or any card.
   POST fn=bars_pull {symbols:["SPY","QQQ"], from:"2026-03-02", to:"2026-03-31", tf?:"10minute", chunk_days?:5}
   Interpolated (gap-fill) bars and bars with a bad price are dropped and counted. Re-pulling a range overwrites the same rows. */
export const BARS_MAX_DAYS = 35;
export function barsRows(j: any, tf: string): { rows: any[]; interpolated: number; bad: number } {
  const rows: any[] = []; let interpolated = 0, bad = 0;
  for (const r of (j?.data?.results || j?.results || [])) {
    const symbol = String(r?.symbol || "").toUpperCase();
    for (const b of (r?.bars || [])) {
      if (b?.interpolated) { interpolated++; continue; }
      const t = Date.parse(b?.begins_at), o = Number(b?.open_price), hi = Number(b?.high_price), lo = Number(b?.low_price), c = Number(b?.close_price), v = Math.round(Number(b?.volume) || 0);
      if (!symbol || !isFinite(t) || ![o, hi, lo, c].every((x) => isFinite(x) && x > 0) || hi < lo || v < 0) { bad++; continue; }
      rows.push({ symbol, tf, t: new Date(t).toISOString(), o, h: hi, l: lo, c, v });
    }
  }
  return { rows, interpolated, bad };
}
export async function barsPull(body: any, who: string) {
  const symbols = [...new Set((Array.isArray(body?.symbols) ? body.symbols : []).map((x: any) => String(x || "").toUpperCase().trim()))] as string[];
  if (!symbols.length || symbols.length > 10 || symbols.some((x) => !/^[A-Z.]{1,6}$/.test(x))) throw new Error("symbols: 1 to 10 tickers, letters only");
  const tf = String(body?.tf || "10minute");
  if (tf !== "10minute" && tf !== "5minute") throw new Error("tf must be 10minute or 5minute");
  const isDay = (x: any) => /^\d{4}-\d{2}-\d{2}$/.test(String(x || "")) && isFinite(Date.parse(String(x) + "T00:00:00Z"));
  if (!isDay(body?.from) || !isDay(body?.to)) throw new Error("from and to must be dates like 2026-03-02");
  const t0 = Date.parse(body.from + "T00:00:00Z"), t1 = Date.parse(body.to + "T00:00:00Z") + 864e5;      // `to` is included
  if (t1 <= t0) throw new Error("to must not be before from");
  if ((t1 - t0) / 864e5 > BARS_MAX_DAYS) throw new Error(`at most ${BARS_MAX_DAYS} days per pull — ask in smaller pieces`);
  const end = Math.min(t1, Date.now());
  const step = Math.max(1, Math.min(10, Math.round(Number(body?.chunk_days) || 5))) * 864e5;
  const by: Record<string, number> = {}, errors: string[] = [];
  let calls = 0, saved = 0, interpolated = 0, bad = 0, first: string | null = null, last: string | null = null;
  for (let a = t0; a < end; a += step) {
    const b = Math.min(a + step, end);
    let j: any = null;
    calls++;
    try { j = mcpJson(await withTimeout(call("rh", "get_equity_historicals", { symbols, interval: tf, start_time: new Date(a).toISOString(), end_time: new Date(b).toISOString(), bounds: "regular" }), 25_000, "bars")); }
    catch (e) { errors.push(`${new Date(a).toISOString().slice(0, 10)}: ${String((e as Error)?.message || e).slice(0, 160)}`); continue; }
    const got = barsRows(j, tf);
    interpolated += got.interpolated; bad += got.bad;
    for (let i = 0; i < got.rows.length; i += 500) {
      const part = got.rows.slice(i, i + 500);
      try {
        await db("otto_bars?on_conflict=symbol,tf,t", { method: "POST", headers: { prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify(part) });
        saved += part.length;
        for (const r of part) { by[r.symbol] = (by[r.symbol] || 0) + 1; if (!first || r.t < first) first = r.t; if (!last || r.t > last) last = r.t; }
      } catch (e) { errors.push(`save ${new Date(a).toISOString().slice(0, 10)}: ${String((e as Error)?.message || e).slice(0, 160)}`); }
    }
  }
  await activity("change", `Bars saved for the backtest: ${symbols.join(", ")} ${tf} ${body.from} → ${body.to}: ${saved} bars${errors.length ? `, ${errors.length} error(s)` : ""}`, who.split("@")[0]).catch(() => {});
  return { ok: true, tf, symbols, from: body.from, to: body.to, calls, saved, by, first, last, dropped: { interpolated, bad }, errors };
}

async function actOn(id: string, decision: string, who: string, why: any = null, opts: any = {}) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new Error("bad id");
  const rows = await db("otto_actions?id=eq." + id + "&select=*");
  const a = rows && rows[0];
  if (!a) throw new Error("no such card");
  if (a.status === "paper_wait") return practiceOn(a, decision, who, why, opts);   // v3.35: never reaches the Robinhood code below
  if (a.status !== "pending") return publicAction(a);
  const now = new Date().toISOString();
  if (decision !== "approve") {
    const r = await db("otto_actions?id=eq." + id + "&status=eq.pending", { method: "PATCH",
      body: JSON.stringify({ status: "rejected", decided_by: who, decided_at: now, plan: { ...(a.plan || {}), josh_reject_why: whyGate(why, "reject") } }) });
    if (r?.[0]) await activity("card", `Rejected: ${a.title}`, who.split("@")[0]);
    return publicAction(r[0] || a);
  }
  if (Date.now() - Date.parse(a.created_at) > ACTION_TTL_MS) {
    const r = await db("otto_actions?id=eq." + id + "&status=eq.pending", { method: "PATCH",
      body: JSON.stringify({ status: "expired", decided_by: who, decided_at: now }) });
    return publicAction(r[0] || a);
  }
  // v3.41: the why gate — an OPENING card is not placed without Josh's three lines (a close/stop card needs none).
  const opening41 = (a.calls || []).some((c: any) => c.tool === "place_option_order" && (c.args?.legs || []).some((l: any) => l.position_effect === "open"));
  const why41 = opening41 ? whyGate(why, "approve") : null;
  // Claim it atomically so a double click (or both laptops) can't run it twice.
  const claimed = await db("otto_actions?id=eq." + id + "&status=eq.pending", { method: "PATCH",
    body: JSON.stringify({ status: "running", decided_by: who, decided_at: now, ...(why41 ? { plan: { ...(a.plan || {}), josh_why: why41 } } : {}) }) });
  if (why41 && claimed?.[0]) a.plan = { ...(a.plan || {}), josh_why: why41 };   // later PATCHes in this function spread a.plan
  if (!claimed || !claimed.length) return publicAction((await db("otto_actions?id=eq." + id + "&select=*"))[0]);
  // v3.24 (C10b): a close / stop card whose position is already gone is not sent.
  const gone = await nothingToClose(a.calls || []);
  if (gone) {
    const r = await db("otto_actions?id=eq." + id, { method: "PATCH",
      body: JSON.stringify({ status: "failed", result: [{ tool: "place_option_order", ok: false, text: `Nothing to close — ${gone}. Nothing was sent to Robinhood.` }] }) });
    await logDesk("system", "Otto", `${a.title}: nothing to close — ${gone}. Nothing was sent to Robinhood (approved by ${who}).`, id);
    return publicAction(r?.[0] || a);
  }
  // v3.39: the one rule (blocking this week, switch `vwap_block` in limits): no long while the stock and SPY are under VWAP.
  if (a.exit?.state === "planned" && (a.plan?.direction === "up" || a.exit?.direction === "up")) {
    try {
      const L = await getLimits();
      if (L.vwap_block !== false) {
        const tk = String(a.plan?.tv_symbol || a.plan?.ticker || "").split(":").pop() || "";
        const nowP = etParts(), st = nyIso(nowP.date, "9:30 AM");
        if (tk && st && nowP.min >= 580) {
          const bars = await withTimeout(rhBars([tk, "SPY"], "5minute", st), 6000, "vwap bars");
          const why = vwapBlock(1, tk.toUpperCase(), bars[tk.toUpperCase()] || null, bars["SPY"] || null);
          if (why) {
            const checks = [{ ok: false, guard: true, block: true, text: why }, ...(a.checks || [])];
            const r = await db("otto_actions?id=eq." + id, { method: "PATCH",
              body: JSON.stringify({ status: "rejected", decided_by: "Otto (VWAP rule)", decided_at: now, checks, plan: { ...(a.plan || {}), blocked: "vwap" } }) });
            await logDesk("system", "Otto", `⛔ ${a.title}: NOT sent. ${why}. Approved by ${who.split("@")[0]}; the rule decided.`, id);
            await activity("card", `Blocked by the VWAP rule: ${a.title}`, who.split("@")[0]);
            return publicAction(r?.[0] || a);
          }
        }
      }
    } catch { /* no data = no block */ }
  }
  // v3.39: Baby J is the senior. Approving a card he flagged weak / a chase is logged as an override — one line, no argument, kept score.
  const said = overrideRead(a);                                              // v4.2.3
  if (said) {
    await db("otto_actions?id=eq." + id, { method: "PATCH", headers: { prefer: "return=minimal" }, body: JSON.stringify({ plan: { ...(a.plan || {}), override: true, override_read: said } }) }).catch(() => {});
    await logDesk("assistant", "Jarvis", `Noted. I called this one weak — "${said}". Logging it as an override by ${who.split("@")[0]}. The scoreboard keeps count.`, id);
    await activity("card", `Override: ${who.split("@")[0]} approved a card Baby J flagged — ${a.title}`, who.split("@")[0]);
  }
  // v3.24 (A8): re-check the live price at Approve. Stale = red line + Desk note, and the order still goes in.
  if (a.exit?.state === "planned") {
    const st = await withTimeout(staleEntry(a), 4000, "stale check").catch(() => null);
    if (st) {
      const checks = [{ ok: false, guard: true, stale: true, text: st }, ...(a.checks || []).filter((c: any) => !c.stale)];
      await db("otto_actions?id=eq." + id, { method: "PATCH", headers: { prefer: "return=minimal" }, body: JSON.stringify({ checks }) }).catch(() => {});
      await logDesk("system", "Otto", `⚠ ${a.title}: approved by ${who} while ${st}. Placing it anyway (guardrails flag, never block); the stop will be sized from the actual fill.`, id);
    }
  }
  const results: any[] = [];
  let failed = false, orderId: string | null = null;
  for (const c of a.calls) {
    if (failed) { results.push({ tool: c.tool, ok: false, text: "skipped — an earlier step failed" }); continue; }
    try {
      const r = await call(c.service, c.tool, c.args);
      if (/^place_/.test(c.tool) && !orderId) {
        const j = mcpJson(r);
        orderId = j?.data?.order?.id || j?.data?.id || j?.order?.id || j?.id || null;
      }
      results.push({ tool: c.tool, ok: true, text: mcpText(r).slice(0, 2000) });
    } catch (e) {
      failed = true;
      // v3.22: Robinhood's exact reason, first line of the card's result.
      const raw = (e as Error).message, why = brokerReason(raw);
      results.push({ tool: c.tool, ok: false, text: c.service === "rh" ? `Rejected by Robinhood: ${why}` + (why !== raw ? `\n\n${raw}` : "") : raw });
    }
  }
  const fin = await db("otto_actions?id=eq." + id, { method: "PATCH",
    body: JSON.stringify({ status: failed ? "failed" : "done", result: results, ...(orderId ? { order_id: String(orderId) } : {}) }) });
  const bad = results.find((r) => !r.ok && !/^skipped/.test(r.text));
  await logDesk("system", "Otto", `${failed ? "✗" : "✓"} ${a.title} — ${failed ? (bad ? String(bad.text).split("\n")[0] : "failed") : "done"} (approved by ${who})`, id);
  // v3.26: a wrong-if moved by an alert card moves the server rule too (9 Oct 10:40 MSFT).
  if (!failed) await wrongIfFromCard(a.calls || [], who.split("@")[0]).catch(() => []);
  // v3.4: the entry is in — hand its exits to the exit engine.
  if (a.exit && a.exit.state === "planned") {
    const ex: any = { ...a.exit, state: failed ? "dead" : "waiting_fill", order_id: orderId ? String(orderId) : null };
    exitLog(ex, failed ? "Entry failed, exits not armed" : `Approved by ${who}; waiting for the fill`);
    await saveExit(id, ex).catch(() => {});
    if (!failed) background((async () => {
      await new Promise((r) => setTimeout(r, 4000));
      const rows = await db("otto_actions?id=eq." + id + "&select=*");
      if (rows?.[0]) await exitTick(rows[0]);
    })());
    return publicAction({ ...fin[0], exit: ex });
  }
  return publicAction(fin[0]);
}

/* ------------------------------------------------------------ shared log */

async function logDesk(role: string, author: string, content: string, action_id: string | null = null) {
  if (role === "assistant") { try { content = (await factCheck(content)).text; } catch { /* fail open */ } }   // v3.22
  if (role === "assistant") { try { content = numberCheck(content); } catch { /* fail open */ } }   // v3.39: above/below vs the numbers
  try {
    await db("otto_desk", { method: "POST", headers: { prefer: "return=minimal" },
      body: JSON.stringify({ owner: owner(), role, author: author.slice(0, 40), content: (role === "user" ? content : unname(content)).slice(0, 20000), action_id }) });   // v5.0: owner
  } catch { /* the log is a convenience; never break the chat over it */ }
  // v3.26: Otto's own system lines that are a break or a trade also land in the Activity log.
  if (role === "system" && /^(?:Otto|Jarvis \(auto\))$/.test(author)) {
    const k = deskKind(content);
    if (k) await activity(k, String(content).split("\n")[0].slice(0, 400), "Otto");
  }
}

/* ------------------------------------------------------------ panel */

const MACRO = [
  { k: "ten", sym: "TVC:US10Y", label: "10Y" },
  { k: "crude", sym: "NYMEX:CL1!", label: "Crude" },
  { k: "yen", sym: "FX:USDJPY", label: "USD/JPY" },
  { k: "spy", sym: "AMEX:SPY", label: "SPY" },
  { k: "qqq", sym: "NASDAQ:QQQ", label: "QQQ" },
];

// v3.8.1 (5 Oct 2026): every slow outside call gets a budget so one slow service
// (TradingView was taking 60 s+ per refresh) can't blank the rest of the Desk.
function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((res, rej) => {
    const t = setTimeout(() => rej(new Error(label + " is slow right now (over " + Math.round(ms / 1000) + " s)")), ms);
    p.then((v) => { clearTimeout(t); res(v); }, (e) => { clearTimeout(t); rej(e); });
  });
}
// Circuit breaker for the Desk panel / banner: after a TradingView timeout, skip it
// for 2 minutes and go straight to the backups (Yahoo prices, cached watchlist).
let TV_SLOW_UNTIL = 0, WC_LAST = "";
const tvSlow = () => Date.now() < TV_SLOW_UNTIL;
function tvBudget<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  // v3.19.1 (7 Oct night): the call is already running when we get here. If we walk away from it
  // (breaker open), its later "TradingView timed out" had no handler — an unhandled rejection —
  // and Supabase shut the whole worker down ("event loop error"), killing every Desk/Signal run on it.
  p.catch(() => {});
  if (tvSlow()) return Promise.reject(new Error(TV_SLOW_UNTIL > Date.now() + 10 * 60_000 ? "TradingView daily quota used up — saved copies until 8 PM ET" : "TradingView is slow right now — using backups for a couple of minutes"));
  return withTimeout(p, ms, label).catch((e) => {
    if (/QUOTA_EXCEEDED|quota exceeded/i.test(String(e?.message))) { TV_SLOW_UNTIL = nextUtcMidnight(); putSetting("tv_slow_until", TV_SLOW_UNTIL).catch(() => {}); }   // v4.2: daily quota — stop asking until the reset
    else if (/slow right now|timed out|HTTP 429|429|rate.?limit|bad handshake|unreachable/i.test(String(e?.message))) { TV_SLOW_UNTIL = Date.now() + 120_000; putSetting("tv_slow_until", TV_SLOW_UNTIL).catch(() => {}); }
    throw e;
  });
}
// Each request can land on a fresh server instance, so the breaker is shared through otto_settings.
async function tvSlowLoad() { try { const v = Number(await setting("tv_slow_until")); if (v > TV_SLOW_UNTIL) TV_SLOW_UNTIL = v; } catch { /* */ } }
// TradingView symbol → Yahoo symbol, for the price fallback.
function ySym(tv: string): string {
  const MAP: Record<string, string> = { "TVC:US10Y": "^TNX", "TVC:DXY": "DX-Y.NYB", "FX:USDJPY": "JPY=X", "NYMEX:CL1!": "CL=F",
    "CME_MINI:ES1!": "ES=F", "CME_MINI:NQ1!": "NQ=F", "CBOT_MINI:YM1!": "YM=F" };
  if (MAP[tv]) return MAP[tv];
  return (tv.split(":")[1] || tv).replace(/\./g, "-");
}
async function yahooQuotes(syms: string[]): Promise<Record<string, { close: number; change: number | null }>> {
  const out: Record<string, any> = {};
  await Promise.all(syms.map(async (s) => {
    try { const q = await withTimeout(yq(ySym(s)), 6000, "Yahoo"); if (q.price != null) out[s] = { close: q.price, change: q.pct }; } catch { /* leave it out */ }
  }));
  return out;
}

async function settle<T>(p: Promise<T>): Promise<{ ok: true; v: T } | { ok: false; error: string }> {
  try { return { ok: true, v: await p }; } catch (e) { return { ok: false, error: (e as Error).message }; }
}

/* v5.0.2 (2 Nov 2026): TradingView's daily quota kept tripping because every open Desk polled the alerts list about once a
   minute all session. The list is only worth fetching while Otto is guarding a trade, so: (1) at most one TradingView alerts
   call per 5 minutes (shared by every open Desk, kept in otto_settings "alerts_cache"); (2) none at all unless at least one
   armed trade carries a protective stop (exit.stop_order_id) — with nothing protected the poll answers from the saved copy and
   never touches TradingView. If the protected-trade lookup itself fails it is treated as "nothing protected" (no call).
   The top-bar count (tvCount inside call()) is unchanged. */
export const TV_ALERTS_MS = 5 * 60e3;
async function hasProtectedTrade(): Promise<boolean> {
  const rows = await db("otto_actions?" + OQ() + "select=id,exit&exit->>state=eq.armed&limit=20").catch(() => []);
  return (rows || []).some((r: any) => !!r?.exit?.stop_order_id);
}
export async function tvAlertsPoll(): Promise<any> {
  const ac = await setting("alerts_cache").catch(() => null);
  if (!(await hasProtectedTrade())) return { ok: true, v: ac?.alerts ?? [], cached: true, skipped: true, note: "no protected trade — TradingView not polled" };
  if (ac?.at && Date.now() - Date.parse(ac.at) < TV_ALERTS_MS) return { ok: true, v: ac.alerts, cached: true };
  const r = await settle(tvBudget((async () => mcpJson(await call("tv", "mcp-tv-list-alerts", { active: true })))(), 7000, "TradingView alerts"));
  if (r.ok) putSetting("alerts_cache", { alerts: r.v, at: new Date().toISOString() }).catch(() => {});
  else if (ac?.alerts) return { ok: true, v: ac.alerts, cached: true, note: "saved copy — " + r.error };
  return r;
}

async function panel() {
  const conns = await db("otto_conn?" + OQ() + "select=service,connected_by,connected_at,updated_at").catch(() => []);   // v5.0: this room's
  const has = (s: string) => conns.some((c: any) => c.service === s);
  const out: any = { ok: true, at: Date.now(), conn: { tv: has("tv"), rh: has("rh") } };

  const tvPart = async () => {
    if (!has("tv")) return;
    await tvSlowLoad();
    // v3.9.2: ask TradingView for the watchlist at most every 10 minutes; use the saved copy in between.
    const wcFresh = await setting("watch_cache").catch(() => null);
    const wl: any = wcFresh?.syms?.length && wcFresh.at && Date.now() - Date.parse(wcFresh.at) < 10 * 60e3
      ? { ok: true, v: { name: wcFresh.name, symbols: wcFresh.syms } }
      : await settle(tvBudget((async () => mcpJson(await call("tv", "mcp-watchlist-get-active-watchlist", {})))(), 6000, "TradingView watchlist"));
    let wsyms: string[] = [];
    if (wl.ok) {
      const found: string[] = [];
      const walk = (o: any) => {
        if (typeof o === "string" && /^[A-Z0-9_]+:[A-Z0-9.!_\-]+$/.test(o)) found.push(o);
        else if (o && typeof o === "object") Object.values(o).forEach(walk);
      };
      walk(wl.v);
      wsyms = [...new Set(found)].slice(0, 30);
      out.watchlist_name = wl.v?.name || wl.v?.watchlist?.name || wl.v?.data?.name || null;
      const wk = JSON.stringify(wsyms);
      if (wsyms.length && (wk !== WC_LAST || !wcFresh?.at || Date.now() - Date.parse(wcFresh.at) >= 10 * 60e3)) { WC_LAST = wk; putSetting("watch_cache", { syms: wsyms, name: out.watchlist_name || null, at: new Date().toISOString() }).catch(() => {}); }
    } else {
      // TradingView slow: keep showing the last watchlist we saw, priced from Yahoo.
      const wc = await setting("watch_cache").catch(() => null);
      if (wc?.syms?.length) { wsyms = wc.syms.slice(0, 30); out.watchlist_name = wc.name; out.watchlist_note = "saved copy — " + wl.error; }
      else out.watchlist_error = wl.error;
    }
    const syms = [...new Set([...MACRO.map((m) => m.sym), ...wsyms])];
    // v3.1: quotesFor() falls back to OHLCV bars when the screener is rate-limited (429).
    out.macro = MACRO; out.watch = wsyms;
    // v3.9.2: prices from Yahoo first; TradingView only fills what Yahoo couldn't price.
    // v5.0.2: alerts at most every 5 minutes, and only while a trade with a live protective stop is open (see tvAlertsPoll).
    const alertsPart = () => tvAlertsPoll();
    const [yq0, al] = await Promise.all([yahooQuotes(syms), alertsPart()]);
    let qv: Record<string, any> = { ...yq0 };
    out.quotes_source = "yahoo";
    const missing = syms.filter((s) => !qv[s]);
    if (missing.length) {
      const q = await settle(tvBudget(quotesFor(missing), 7000, "TradingView prices"));
      if (q.ok && Object.keys(q.v).length) { qv = { ...qv, ...q.v }; out.quotes_source = "yahoo+tradingview"; }
      else if (!q.ok) out.quotes_note = `${missing.length} not on Yahoo; TradingView: ${q.error}`;
    }
    if (Object.keys(qv).length) out.quotes = { data: Object.entries(qv).map(([symbol, v]: any) => ({ symbol, close: v.close, change: v.change })) };
    if (al.ok) { out.alerts = al.v; if ((al as any).note) out.alerts_note = (al as any).note; } else out.alerts_error = al.error;
    await tvCallsLoad(); out.tv_calls = TV_CALLS.n; out.tv_by = TV_CALLS.by || {}; out.tv_fn = TV_CALLS.fn || {}; out.tv_quota_until = tvSlow() && TV_SLOW_UNTIL > Date.now() + 10 * 60_000 ? TV_SLOW_UNTIL : null;   // v4.2
  };

  const rhPart = async () => {
    if (!has("rh")) return;
    const acct = await settle(agenticAccount());
    if (!acct.ok) { out.rh_error = acct.error; return; }
    const [pf, op, eq] = await Promise.all([
      settle((async () => mcpJson(await call("rh", "get_portfolio", { account_number: acct.v })))()),
      settle((async () => mcpJson(await call("rh", "get_option_positions", { account_number: acct.v, nonzero: true })))()),
      settle((async () => mcpJson(await call("rh", "get_equity_positions", { account_number: acct.v })))()),
    ]);
    out.agentic = {
      account: mask(acct.v),
      portfolio: pf.ok ? (pf.v?.data ?? pf.v) : null, portfolio_error: pf.ok ? null : pf.error,
      options: op.ok ? (op.v?.data?.positions ?? op.v) : null, options_error: op.ok ? null : op.error,
      equities: eq.ok ? (eq.v?.data ?? eq.v) : null, equities_error: eq.ok ? null : eq.error,
    };
  };

  await Promise.all([settle(withTimeout(tvPart(), 16000, "TradingView")), settle(withTimeout(rhPart(), 16000, "Robinhood").catch((e) => { out.rh_error ||= e.message; }))]);
  if (!out.quotes) {                      // TradingView not connected: fall back to the free quotes
    const fq = await settle(fetchQuotes());
    if (fq.ok) out.fallback_quotes = fq.v.quotes;
  }
  const pend = await settle(db("otto_actions?" + OQ() + "status=in.(pending,running,paper_wait)&order=created_at.desc&limit=20&select=*"));
  // v3.10: a pending card past its 20 minutes can't be approved — mark it expired so it stops showing as waiting.
  const stale = pend.ok ? pend.v.filter((a: any) => (a.status === "pending" || a.status === "paper_wait") && Date.now() - Date.parse(a.created_at) > ACTION_TTL_MS) : [];
  if (stale.length) background(db("otto_actions?status=in.(pending,paper_wait)&id=in.(" + stale.map((a: any) => a.id).join(",") + ")", { method: "PATCH",
    headers: { prefer: "return=minimal" }, body: JSON.stringify({ status: "expired", decided_by: "otto (20 min)", decided_at: new Date().toISOString() }) }));
  out.pending = pend.ok ? pend.v.filter((a: any) => !stale.includes(a)).slice(0, 10).map(publicAction) : [];
  out.card_ttl_min = ACTION_TTL_MS / 60000;
  out.auto_close = !!(await getLimits().catch(() => LIMIT_DEFAULTS)).auto_close;
  const ex = await settle(db("otto_actions?" + OQ() + "select=id,title,exit,created_at&exit->>state=in.(waiting_fill,armed,closed)&order=created_at.desc&limit=8"));
  out.exits = ex.ok ? ex.v.filter((r: any) => ["waiting_fill", "armed"].includes(r.exit.state) ||
    Date.now() - Date.parse(r.exit.closed_at || r.created_at) < 18 * 3600e3).slice(0, 5) : [];
  if (has("rh") && out.exits.some((r: any) => ["waiting_fill", "armed"].includes(r.exit.state))) background(exitsTick());
  return out;
}

/* ------------------------------------------------------------ the Desk chat */

/* v3.12 (Ifoma, 6 Oct): Otto may be sold later — the mentor's name is never shown to users. The brain keeps it
   internally; everything a user reads says "the Otto Rules" (his method / rules) and "Signal" (his Discord posts). */
const NAME_RULE = `\n\nNAMES — PRODUCT RULE (6 Oct 2026). Never write the names Jason, Jason Murray, or jmoney915 in anything Ifoma or Josh will read: replies, reads, card titles and summaries, TradingView alert names and messages. The method and its rules are "the Otto Rules" (e.g. "Otto Rules: no trades in the first 30 minutes"; cite as (Otto Rules, call date, MM:SS)). His Discord posts are "signals" ("the SPCX signal"). The person on the coaching calls is "the coach". Name a TradingView alert you create "Otto Rules MM/DD – TICKER LEVEL – note". You still know where the rules come from; just don't name him. Speak as yourself with the Otto Rules as your own playbook: never "he would / wouldn't", "he says", "ask him", "send it to him" or "get the coach on the phone" — say what the Otto Rules say and what you'd do.`;
// v3.13 (Ifoma, 6 Oct): guardrails flag, never block; Jarvis never claims to watch what nothing is watching.
const GUARD_RULE = `\n\nGUARDRAILS FLAG — THEY NEVER BLOCK (Ifoma, 6 Oct 2026). Ifoma and Josh make the final call on every trade. When a setup is real, ALWAYS build the card, even if it breaks a guardrail (max loss per trade, daily stop, weekly limit, size vs account, delta, expiry, first 30 minutes, banner). Never say "hard stop", "no card" or refuse a card because of a limit or size. The card shows a red banner naming each guardrail it breaks; in your reply say which ones in one line, and if a cheaper contract fits better, offer it as a second (ALT) card. Only skip a card when there is no setup.
WHAT RUNS ON ITS OWN — SAY ONLY THIS. You do not watch the market between messages. You run only when someone writes on the Desk, when the 👁 Watcher sees a trigger at a level on its list (the server checks every minute on 5- and 10-minute closes), when a TradingView alert Otto set fires (checked every 2 minutes), when Otto Signals catches a post, and on the open-position check (every few minutes while a trade is open). Never say "I'm watching", "watching every bar", "the card drops automatically", "I'll flag you at 1:30" or "I'll ping you" unless one of those mechanisms will actually do it. If they want a level watched, put it on the Watcher with add_watch_level (no card needed) and say so — that is how you'll see it. If you want to look again at a set time ("I'll check at 1:30"), call schedule_check first — then it's true. The server checks every reply for promises and makes you correct any that nothing backs.
HOUSE RULES. The House Rules block (below the clock) is their standing instructions. Follow them every time. When Ifoma or Josh gives a standing instruction ("from now on", "always", "next time", "in the future"), call save_house_rule with it in one plain sentence, then confirm in one line. Don't save one-off requests.
THE CLOCK. The CLOCK line is computed by the server and is always right about the date, weekday, time and whether the market is open. Tool timestamps are UTC unless they say ET. If you ever feel the market is closed, re-read the CLOCK line before saying so.
A PROTECTED TRADE'S STOP. On a trade Otto protects, a pending sell-to-close (pending_sell_quantity 1) is Otto's own stop order. It is not a stuck or "zombie" order — never tell anyone to cancel it unless they're closing the trade.

FILLS, POSITIONS AND P&L — ROBINHOOD ONLY (v3.24, Ifoma 8 Oct). Say a trade filled, is open, hit TP1, was stopped, or made/lost $X ONLY from the "TRADES TODAY FROM ROBINHOOD" part of the context line or a Robinhood call you made in this turn (get_option_orders / get_option_positions). An order that isn't there as bought did NOT fill — say "not filled". The entry is the fill price, never the card's limit. The daily stop counts losing round trips from that line. The server checks every reply against Robinhood and corrects anything that doesn't match.
v3.26 RULES (Ifoma, 9 Oct, after the −$230 MSFT day):
- KILL SWITCH: when the context line says LOCKED, every opening card you propose becomes a paper card (scored, can't be approved). Say so plainly; never suggest a way around it.
- HONEST CARD STATUS (v3.41): the ONLY card that cannot be approved is a kill-switch (or marked-late) paper card. A PRACTICE card always waits for Josh's Approve or Reject, including one over the live size cap (it trades on the $4,000 practice book). Never say "paper cards can't be approved" or "by design"; name the one real reason on the card, nothing broader.
- SIZE CAP: an opening card over the size cap in the context line comes back to you with a cheaper contract that fits — use it; if none fits it becomes a paper card. Don't argue the cap.
- THE COACH'S DIRECTION: follow the direction the coach gives. When he gives a level with no direction, don't pick a side from the word "resistance" or "support" — wait for the Watcher's touch + close. Before calling any entry "good", check: did price TOUCH the level, did the trigger candle close the way the plan said, is it with the day's move and the banner. If any is no, say so.
- CHANGING A WRONG-IF: add the new level with add_watch_level on the losing side of the open trade — that moves the server rule. Never move a wrong-if inside the trade's own level without saying a test of the level will stop it out.
- NUMBERS: distances, "in/out of the money" and option P&L come from the live price and the fill — never from yesterday's close for an option bought today. Before saying a position is closed, check get_option_positions.
NO WORKING NOTES. Tool work is silent: never write "let me grab the instrument ID…", ids or tool names in your reply — only what they need to read.
A WATCHER LEVEL ON AN OPEN TRADE. A level added on the losing side of an open trade (below it for calls, above for puts) replaces that trade's wrong-if — one wrong-if per trade; the server closes it on a 5-minute close through it (auto-close on). Say that, nothing more.`;

function unname(t: any): string {
  return String(t ?? "").replace(/(\bJason(?: Murray)?)[’‘`]s\b/g, "$1's")   // v3.16: curly apostrophes too
    .replace(/\bJason(?: Murray)?'s (?:rules|method)\b/g, "the Otto Rules").replace(/\bJason(?: Murray)?'s rule\b/g, "Otto Rule")
    .replace(/\bJason(?: Murray)?'s posts?\b/g, "the signal").replace(/\bJason(?: Murray)?'s calls\b/g, "the coaching calls")
    .replace(/\bJASON'S CALL\b/g, "SIGNAL").replace(/\bJason(?: Murray)?'s\b/g, "Otto Rules").replace(/\bJason(?: Murray)?\b/g, "Otto Rules")
    .replace(/\bjmoney915\b/gi, "").replace(/\bthe the Otto\b/g, "the Otto").replace(/Otto Rules Rules/g, "Otto Rules")
    .replace(/(^|[.!?:]\s+|\n)the (Otto|signal|coaching)/g, (_m, a, b) => a + "The " + b);
}
const SIG_LABEL = "Signal";   // v3.12: what users see instead of the mentor's name
const DESK_SYS = `You are Jarvis, the AI on the trading desk inside Otto Trader. If asked your name, you are Jarvis. Your judgment is the Otto Rules: Otto's own brain, built from a library of recorded coaching calls plus the trading playbook. You speak as yourself ("the Otto Rules say…", "my read…") — never as anyone's student, and never "he would / wouldn't". You sit between three things:
- The Otto Rules (the coaching-call library) — the judgment. Search it with search_jason (the tool's internal name).
- TradingView (Ifoma's paid account) — market data, watchlists, alerts. Tools named tv__…
- Robinhood — positions and orders. Tools named rh__…. Orders only ever go to the Robinhood Agentic account; the server enforces that, you don't pick the account.

You're talking with Ifoma (the trader; it's his money) and sometimes Josh (his son, learning alongside him, same login, same authority). Each message is prefixed with who wrote it when known. Talk like a trading partner at the next desk: direct, numbers first, caveat second. Short paragraphs. No hype, no congratulating; say plainly when a trade is a bad idea.

HOW ACTIONS WORK — THE ONE HARD RULE
You can READ anything with the tv__ and rh__ tools, as often as you need. You can NEVER change anything yourself — with ONE exception: when the desk context says Auto-close is ON, close_position sells to close a position in the Agentic account immediately, no card. Use it only to get OUT of a position when one of the card's own exits is met (wrong-if on the card's bar, TP1, 3:50 PM) — the server checks and refuses otherwise; for any other reason, including when they ask you to close, put up a close card with propose_action. Say why in one sentence, and never open, add or flip with it. To place, cancel, or change an order, or create/edit/delete an alert or watchlist entry, call propose_action with the exact calls. That puts an Approve / Reject card in front of them; nothing happens until a human clicks Approve. After proposing, say in one line what the card does — never say an order "is placed" or "went through" until you see the result (the app will post it).
- Before proposing an option order: get the chain (rh__get_option_chains → rh__get_option_instruments) for the real option_id, check the quote (rh__get_option_quotes), and use a limit price. The server runs Robinhood's review and computes the risk vs the Agentic account.
- One idea = one card. Several suggestions at once = several cards, each with its own title.
- Don't propose new TradingView alerts unless they ask, or they want a level watched (an alert is the only way you get woken at a level).
- Every OPENING option card must include plan {tv_symbol, direction, setup, tp1, stop, stop_option, entry_underlying, expires}. stop_option is the OPTION price that triggers the protective stop (below your limit price); size it so (limit − stop_option) × 100 × contracts stays inside their max loss per trade. Approving the card approves its exits too: once the buy fills, Otto itself places a stop_market sell-to-close at stop_option (re-placed every morning — Robinhood stop orders are day orders) and two TradingView alerts on the stock (wrong-if = plan.stop on a 5-minute close, TP1 on touch), and puts up a close card when one fires. So never propose a separate stop order or alerts for that trade, and only one single-leg buy per opening card. To close a protected trade early, include rh cancel_option_order for its stop_order_id (listed in the desk context) BEFORE the sell, in the same card. The server runs a rule check (first 30 minutes, delta 30–40, volume > OI, size, loss at the stop vs their max, daily stop, weekly limit, expiry, binary events, earnings, banner) and shows any broken guardrail as a red banner on the card; read its result back and mention the flags in one line. The card's check is the truth: don't call a check passed in your text when the card flags it.

THE SENTIMENT BANNER
The app shows a live banner built from Josh's Intermarket Sentiment Cheat Sheet on TradingView data (10Y, DXY, USD/JPY, crude, ES/NQ/YM). Its current verdict is in the desk context line. It is Josh's sheet, not the Otto Rules: where they disagree (the sheet trades the 9:30 opening range; the Otto Rules say no first 30 minutes unless the open goes off a pre-posted Signal level) say so and don't pick. Never attach Josh's sheet sizing ($15 / 15%) to anything — sizing is only the 20% check.

THE ORDER TICKET (put this in the card's summary, plain text)
Underlying / contract · Side / qty / type / limit · Max risk ($ and % of the account; ⚠ if over 20%) · Entry trigger · Stop / exit · Targets (TP1 / TP2 / runner) · Otto Rules basis (rule, call date, MM:SS) · Not from the Otto Rules (anything you added).
Every guardrail is a warning, never a block — they can still approve. The coach called ~40% of the account in one trade "crazy" (1 Oct 2026).

FETCH, DON'T ASSUME
Every price, position, and buying-power figure you state comes from a tool call in this conversation. Levels from a call are dated marks, never current prices — say the call date when you use one. If a connector isn't connected, say so in one line (Settings → Connections) and do what you can without it.

LOGGING TRADES (v3.37)
When Josh or Ifoma describes a trade they took outside Otto (TradingView paper, a manual order, a scalp), call log_practice_trade with the numbers they gave — ask for a missing entry or exit price, never guess one. The weekly trade log for the coach (live fills + approved practice cards + logged trades, with levels, VWAP at entry and the overnight decision) is posted on the Desk every Friday after the close for Josh to copy and send; say that when asked.

WHEN JOSH PUSHES BACK (v3.36)
If Josh says you should have carded or entered something, re-check the facts, then answer with what the Otto Rules say — do not apologize your way into agreeing with a chase. A 10-minute confirmation that closes well past the level means the entry is the RETEST of that level, not the close; say that plainly and offer to watch for it. Own a real miss (silence, a card you should have built) in one line; never invent one to be agreeable.

SAY WHEN THE OTTO RULES DON'T COVER SOMETHING
The calls have never taught a stop rule for these option trades beyond the entry-candle exit, never given a 2026 options sizing number, and never given a full exit plan beyond TP1/TP2/runners. When one of those decides the trade, give your best answer and label it as yours.

THE OTTO RULES (2026 stock options) — summary; search_jason for exact wording and timestamps
- Backdrop first: 10-year (cost of capital), crude (cost of transportation), USD/JPY (cost of currency). Rising rates → algorithms sell; restrictive rates → money hides in staples, health care, communications. Seasonality: September sell first; October rough early, strong late. Never swing into a binary event (NFP, earnings, Fed).
- Instruments: SPY, QQQ, one Mag-7 name. More than one catalyst; the chart is not a catalyst. 3+ indicators agreeing is workable, 5 you take to the bank. No trading inside a trap zone; a $3 box is not a trade.
- Entries: shorts at resistance, cover at support; longs the mirror ("where I'm covering, you're trying to enter", 1 Oct). Mark zones before the move. In this rate environment play rejections more than bounces. Daily double top or below a big unrecovered gap → scalps only. Never chase a missed fill. Not the first 30 minutes.
- Contract: delta 30–40, volume > open interest; at the money by default, up to two strikes out only if at the screen. After Wednesday don't buy this Friday's; use next week's while learning. Check theta as % of premium before swinging.
- Managing: TP at the first marked level, keep a runner, stop the runner if it doesn't come. Exit if price closes back through the open of the entry candle; on short-dated options the first red candle is the exit. Watch the chart, not the P&L. Weekly goals, not daily.
- 15 Oct 2026 call: "You lost your money because of bad entry, not bounces." Let price come to you — never chase, not even for a scalp. When price retests a broken level and the 10-minute candle FAILS there, that is where you ADD, not where you get out (confirmation = the candle close). Exit = an indecision candle followed by a candle with no new high; take the whole position off, re-enter only after support holds. Small account: no overnight, only risk profit. SPY range since July (dated 15 Oct marks): 764 buy zone, 778 sell zone, 775 gap line; between them is chop — nothing after the daily move. Sell into strength in the first 15 minutes; mark the candle-formation top even when price is far from it.
- Older frames (April 2024 options: 20% max, 2/5/10 contracts, spreads 60+ days; Aug 2026 ES futures: one contract) — never mix in without saying where they came from.

CHARTS
When they paste a chart, read it: timeframe, trend, the zones they drew, where price is vs those zones, and grade the idea against the method. Then check it against live data before any ticket.

OTTO RULES — STANDING RULES AND SETUPS (always in front of you):
{{RULES}}`;

const PROPOSE_TOOL = (writeHelp: string) => ({
  name: "propose_action",
  description: "Show the user an Approve / Reject card for one or more changes (orders, cancels, alerts, watchlist edits). " +
    "Nothing runs until a human clicks Approve. The server forces Robinhood orders into the Agentic account and adds the idempotency key — " +
    "leave account_number and ref_id out. Available actions and their arguments:\n" + writeHelp,
  input_schema: {
    type: "object",
    properties: {
      title: { type: "string", description: "Short card title, e.g. 'Buy 1 SPY 760P 10/16 @ 2.15'" },
      summary: { type: "string", description: "The order ticket / what this does and why, plain text, newline-separated lines." },
      calls: {
        type: "array", minItems: 1, maxItems: 6,
        items: {
          type: "object",
          properties: {
            service: { type: "string", enum: ["tv", "rh"] },
            tool: { type: "string", description: "Exact tool name, e.g. place_option_order or mcp-tv-create-alert" },
            args: { type: "object", description: "Arguments for that tool" },
          },
          required: ["service", "tool", "args"],
        },
      },
      plan: {
        type: "object",
        description: "REQUIRED for an opening option order (the scorecard grades every idea on it): the trade plan on the UNDERLYING.",
        properties: {
          tv_symbol: { type: "string", description: "TradingView symbol of the underlying, EXCHANGE:TICKER, e.g. NASDAQ:NVDA" },
          direction: { type: "string", enum: ["up", "down"], description: "Your view on the underlying (calls = up, puts = down)" },
          setup: { type: "string", enum: ["rejection at resistance", "support bounce", "gap failure", "breakdown", "breakout", "trend continuation", "other"] },
          entry_underlying: { type: "number", description: "Underlying price at the entry trigger" },
          tp1: { type: "number", description: "TP1 on the underlying" },
          stop: { type: "number", description: "Underlying price that proves the idea wrong (your exit level) — Otto watches for a 5-minute close through it" },
          stop_option: { type: "number", description: "OPTION price (per share, below the limit) where Otto's protective stop_market sell-to-close triggers. Otto places it after the fill." },
          expires: { type: "string", description: "Option expiration YYYY-MM-DD" },
          signal_level: { type: "boolean", description: "true when the entry level came from a Signal posted before the open (the House Rule lets the open be traded off it)" },
          level: { type: "number", description: "v3.37: the underlying level the idea is built on (the coach's, the Watcher's or the chart's). The server checks the entry against it: let price come to you, don't chase." },
          weak: { type: "string", description: "v4.2.3: ONLY when the banner/read is No Edge or Choppy, or the entry is a chase (the bar already ran past the level): one plain sentence that names which (shows as a red line; the card is still built — flag, never block). Any other doubt goes in the summary, NOT here — leave weak empty." },
          rules: { type: "array", items: { type: "string" }, maxItems: 6, description: "v3.15: ids of the PLAYBOOK book rules this card relies on (e.g. T-1, D-1, M-2). Every rule cited builds its own record on the scoreboard." },
        },
        required: ["tv_symbol", "direction", "setup", "tp1", "stop", "stop_option"],
      },
    },
    required: ["title", "summary", "calls"],
  },
});

function schemaLine(t: any) {
  const p = t.inputSchema?.properties || {};
  const req = new Set(t.inputSchema?.required || []);
  const fields = Object.keys(p).filter((k) => k !== "account_number" && k !== "ref_id")
    .map((k) => k + (req.has(k) ? "*" : "") + ":" + (p[k].type ? [].concat(p[k].type).filter((x: string) => x !== "null").join("|") : "any"));
  return `- ${t.name} (${fields.join(", ")})`;
}

async function deskTools(services: string[] = ["tv", "rh"]) {
  const tools: any[] = [];
  const help: string[] = [];
  const status: Record<string, string> = {};
  for (const s of services) {
    try {
      const list = await withTimeout(mcpTools(s), 10000, SVC[s].name);
      for (const t of list) {
        if (READ[s].has(t.name)) {
          tools.push({ name: `${s}__${t.name}`.slice(0, 64),
            description: (`[${SVC[s].name}] ` + (t.description || "")).slice(0, 900),
            input_schema: t.inputSchema && t.inputSchema.type === "object" ? t.inputSchema : { type: "object", properties: {} } });
        }
        if (WRITE[s].has(t.name)) help.push(`[${s}] ` + schemaLine(t));
      }
      status[s] = "connected";
    } catch (e) {
      status[s] = (e as Error).message;
    }
  }
  return { tools, help: help.join("\n") || "(no connector is connected yet)", status };
}

type DeskRun = { msgs: any[]; sys: string; tools: any[]; cs: Chunk[]; who: string; send: (o: any) => void; allowPropose: boolean; allowClose?: boolean; maxRounds?: number; deadline?: number; author?: string; planExtra?: Record<string, unknown>; blockLevels?: Record<string, any>;
  mustCard?: boolean; dryRun?: boolean;
  optionalCard?: boolean;   // v3.29: one step, but the card tool is NOT forced (a coach LEVEL may get a card or a one-line 'no card, because')
  oneStep?: boolean; onCard?: (id: string) => Promise<void> };   // v3.23: a Signal card in ONE forced step (+ one retry), then stop   // v3.16: mustCard = a Signal call must end in a card; dryRun = the self-test (cards checked, not stored)
type DeskResult = { said: string; cards: string[]; timedOut?: boolean; outOfRounds?: boolean; did: string[]; failed: string[]; finalText: string; dry?: any[]; errors?: string[]; cardRead?: string };

/* v5.9.3 (Ifoma, 12 Nov: "I'm not sure how to find out who is actually pulling that API"): USAGE STAMPS. Every Claude answer that
   passes through this function is read once more on its way out — the token counts Anthropic reports (plain input, cache write,
   cache read, output) are written to otto_ai_log with a tag for the feature that asked and the model. The answer itself is not
   changed, delayed or stored. A stamp that cannot be read or saved is dropped silently: measuring must never break a run. */
export function aiUsage(text: string): { tin: number; tout: number; cache_w: number; cache_r: number } | null {
  let u: any = null;
  if (text.includes('"message_start"')) {                                               // a streamed answer: usage rides on message_start, the final output count on message_delta
    for (const line of text.split("\n")) {
      if (!line.startsWith("data: ") || !line.includes('"usage"')) continue;
      try { const ev = JSON.parse(line.slice(6)); const x = ev.message?.usage || ev.usage; if (x) u = { ...(u || {}), ...x }; } catch { /* a cut line */ }
    }
  } else { try { u = JSON.parse(text).usage || null; } catch { /* not JSON */ } }
  if (!u) return null;
  const n = (x: any) => Math.max(0, Math.round(Number(x) || 0));
  return { tin: n(u.input_tokens), tout: n(u.output_tokens), cache_w: n(u.cache_creation_input_tokens), cache_r: n(u.cache_read_input_tokens) };
}
export function aiMeter(r: Response, tag: string, model: string): Response {
  try {
    if (!(r instanceof Response) || !r.ok || !r.body || (TEST && !TEST.aiLog)) return r;
    const own = owner(), dec = new TextDecoder();
    let text = "";
    const ts = new TransformStream<Uint8Array, Uint8Array>({
      transform(c, ctl) { try { if (text.length < 3_000_000) text += dec.decode(c, { stream: true }); } catch { /* */ } ctl.enqueue(c); },
      flush() {
        try {
          const u = aiUsage(text); if (!u) return;
          const row = { tag: String(tag).slice(0, 60), model: String(model).slice(0, 60), owner: own, ...u };
          if (TEST?.aiLog) { TEST.aiLog(row); return; }
          background(db("otto_ai_log", { method: "POST", headers: { prefer: "return=minimal" }, body: JSON.stringify(row) }).catch(() => {}));
        } catch { /* never breaks the answer */ }
      } });
    return new Response(r.body.pipeThrough(ts), { status: r.status, statusText: r.statusText, headers: r.headers });
  } catch { return r; }
}
async function aiFetch(tag: string, init: RequestInit): Promise<Response> {
  const r = await fetch("https://api.anthropic.com/v1/messages", init);
  let model = "?"; try { model = JSON.parse(String(init.body)).model || "?"; } catch { /* */ }
  return aiMeter(r, tag, model);
}

// The tool loop, shared by the live Desk (streamed) and the 8:45 run (silent).
// v3.13: one Claude request, retried once on 429 / 5xx / overloaded, never past the run's deadline.
async function claudeFetch(body: any, deadline: number): Promise<Response> {
  const tag = String(body?._tag || "other");                                           // v5.9.3: who is asking — stamped with the tokens, never sent to Claude
  if (body && "_tag" in body) { body = { ...body }; delete body._tag; }
  if (TEST?.claude) return TEST.claude(body);
  const rk = await roomKey();                                                          // v5.0: the room's key; the house's on cron paths
  const apiKey = rk.key;
  if (body?.model === MODEL && rk.model !== MODEL) body = { ...body, model: rk.model };   // v5.0: the room's model replaces the default only
  for (let attempt = 0; ; attempt++) {
    const left = deadline - Date.now();
    if (left < 8000) throw new Error("out of time before Claude answered");
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST", signal: AbortSignal.timeout(left - 3000),
      headers: { "content-type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify(body),
    });
    if (r.ok && r.body) return aiMeter(r, tag, String(body.model || "?"));
    const t = (await r.text()).slice(0, 200);
    if (attempt === 0 && (r.status === 429 || r.status >= 500)) { await new Promise((z) => setTimeout(z, 3000)); continue; }
    throw new Error("claude HTTP " + r.status + " " + t);
  }
}
const RUN_BUDGET_MS = 118_000;            // Supabase stops a function at 150 s; leave room to save what was said.
const OUT_OF_TIME = "\n\n⚠ I ran out of time on that one (a data source was slow), so this answer may be incomplete. Ask again and I'll keep it tighter.";

export async function runDesk(o: DeskRun): Promise<DeskResult> {
  const { msgs, sys, tools, cs, who, send } = o;
  const deadline = o.deadline || Date.now() + RUN_BUDGET_MS;
  let said = "", finalText = "";
  const cards: string[] = [], did: string[] = [], failed: string[] = [], dry: any[] = [], errors: string[] = [];
  let cardRead = "";
  const done = (x: any = {}): DeskResult => ({ said, cards, did, failed, finalText, dry, errors, cardRead, ...x });
  const maxR = o.maxRounds || 12;
  // v3.13: the clock and the House Rules ride in a second, uncached system block on EVERY run
  // (Desk, alert reads, Signals, position checks, the morning read).
  const live = marketClock().line + "\n\n" + await houseRulesText().catch(() => "") + "\n\n" + await playbookText().catch(() => "");
  for (let round = 0; round < maxR; round++) {
    if (Date.now() > deadline - 15000) { said += OUT_OF_TIME; send({ t: "text", v: OUT_OF_TIME }); return done({ timedOut: true }); }
    // v3.16: a Signal call must end in a card — on the last step (or when time is short) the card is the only move left.
    const force = ((o.oneStep && !o.optionalCard) || (o.mustCard && (round >= maxR - 2 || Date.now() > deadline - 50000))) && o.allowPropose && !cards.length && !dry.length
      && tools.some((t: any) => t.name === "propose_action");
    finalText = "";
    let r: Response;
    try {
      r = await claudeFetch({
        _tag: "run:" + String(who || "desk"), model: MODEL, max_tokens: 2500, stream: true, tools, ...(force ? { tool_choice: { type: "tool", name: "propose_action" } } : {}),
        system: [{ type: "text", text: sys + NAME_RULE + GUARD_RULE, cache_control: { type: "ephemeral" } }, { type: "text", text: live }],
        messages: msgs,
      }, deadline);
    } catch (e) {
      if (said || /out of time|timed? ?out|abort/i.test(String((e as Error).message))) {
        said += OUT_OF_TIME; send({ t: "text", v: OUT_OF_TIME }); return done({ timedOut: true });
      }
      throw e;
    }
    let stop = "";
    const blocks: any[] = [];
    const reader = r.body!.getReader(), dec = new TextDecoder();
    let buf = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const parts = buf.split("\n\n"); buf = parts.pop() || "";
      for (const p of parts) {
        const line = p.split("\n").find((x) => x.startsWith("data: "));
        if (!line) continue;
        let ev: any; try { ev = JSON.parse(line.slice(6)); } catch { continue; }
        if (ev.type === "content_block_start") {
          const cb = ev.content_block;
          blocks[ev.index] =
            (cb.type === "tool_use" || cb.type === "server_tool_use") ? { ...cb, input: "" }
            : (cb.type === "text") ? { type: "text", text: "" }
            : { ...cb };
        } else if (ev.type === "content_block_delta") {
          const b = blocks[ev.index];
          if (ev.delta.type === "text_delta") { b.text += ev.delta.text; said += ev.delta.text; finalText += ev.delta.text; send({ t: "text", v: unname(ev.delta.text) }); }
          else if (ev.delta.type === "input_json_delta") b.input += ev.delta.partial_json;
        } else if (ev.type === "message_delta" && ev.delta?.stop_reason) {
          stop = ev.delta.stop_reason;
        }
      }
    }
    if (stop !== "tool_use") return done();

    const assistant: any[] = [];
    const results: any[] = [];
    for (const b of blocks) {
      if (!b) continue;
      if (b.type === "text") { if (b.text) assistant.push({ type: "text", text: b.text }); continue; }
      if (b.type === "server_tool_use") {
        let input: any = {}; try { input = JSON.parse(b.input || "{}"); } catch { /* */ }
        assistant.push({ type: "server_tool_use", id: b.id, name: b.name, input });
        continue;
      }
      if (b.type === "web_search_tool_result") { assistant.push(b); continue; }
      let input: any = {}; try { input = JSON.parse(b.input || "{}"); } catch { /* */ }
      assistant.push({ type: "tool_use", id: b.id, name: b.name, input });
      let content = "", isErr = false;
      try {
        if (b.name === "search_jason") {
          const q = String(input.query || "");
          send({ t: "tool", v: "Otto Rules: " + q });
          const hits = search(cs, q);
          content = hits.length ? hits.map(fmt).join("\n\n") : "NOTHING FOUND for that wording. Try different words.";
        } else if (b.name === "propose_action" && o.dryRun) {
          // v3.16 self-test: check the card the way the server would, store nothing.
          // v3.17: the same checks proposeAction makes (it takes price OR limit_price; args may arrive as a JSON string).
          const c0 = input?.calls?.[0] || {};
          let args: any = c0.args; if (typeof args === "string") { try { args = JSON.parse(args); } catch { args = {}; } }
          const leg = args?.legs?.[0], pl = input?.plan || {};
          const miss = [!input?.title && "title", c0.tool !== "place_option_order" && `tool (got ${c0.tool})`, !leg?.option_id && "legs[0].option_id",
            !(Number(args?.price ?? args?.limit_price) > 0) && "price", !pl.tv_symbol && "plan.tv_symbol", !pl.direction && "plan.direction",
            !pl.setup && "plan.setup", pl.tp1 == null && "plan.tp1", pl.stop == null && "plan.stop", !(Number(pl.stop_option) > 0) && "plan.stop_option"].filter(Boolean);
          if (miss.length) throw new Error("card is missing " + miss.join(", "));
          dry.push(input);
          if (o.oneStep) cardRead = String(input.read || "");
          content = "SELF-TEST: card accepted (not stored). Write one line and stop.";
        } else if (b.name === "propose_action") {
          if (!o.allowPropose) throw new Error("no cards in this run");
          send({ t: "tool", v: "Preparing card: " + String(input.title || "") });
          const card = await proposeAction(input, who, { planExtra: o.planExtra, blockLevels: o.blockLevels });
          cards.push(card.id);
          if (o.oneStep) { cardRead = unname(String(input.read || "")); if (o.onCard && card.status !== "paper") await o.onCard(card.id).catch(() => {}); }
          send({ t: "action", v: card });
          content = card.status === "paper_wait"
            ? `PRACTICE CARD ${card.id} is on screen, waiting for Josh to Approve or Reject (20 minutes). It is practice only: nothing goes to Robinhood and it only counts in the team's score if Josh approves. Say so in one line; do not tell them it was auto-rejected.`
            : card.status === "paper"
            ? `PAPER CARD ${card.id} — auto-rejected, it can't be approved: ${String((card.checks || []).find((c: any) => c.paper)?.text || "").slice(0, 300)}. It is still scored. Tell them in one line; don't propose it again or a different contract for it.`
            : `Card ${card.id} is on screen, status pending. Nothing has run. ` +
            `Risk: ${JSON.stringify(card.risk)}. Rule check: ${JSON.stringify(card.checks || [])}. Robinhood review: ${(card.review || "n/a").slice(0, 1500)}`;
        } else if (b.name === "option_shortlist") {
          const side = input.side === "put" ? "put" : "call";
          send({ t: "tool", v: `Contracts: ${String(input.ticker || "").toUpperCase()} ${side}s` });
          const sl = await withTimeout(shortlistCached(String(input.ticker || ""), side), 30_000, "shortlist");
          content = sl.text + "\n" + CONTRACT_RULE;
        } else if (b.name === "add_watch_level") {
          send({ t: "tool", v: `Watcher: ${String(input.ticker || "").toUpperCase()} ${input.level}` });
          const scan = who === "scanner";
          const row = await watchAdd({ ticker: input.ticker, level: Number(input.level), dir: input.dir, note: input.note,
            source: scan ? "scanner" : "desk", by: scan ? "Jarvis (scanner)" : `${o.author || "Desk"} via Jarvis` });
          if (row && !scan && !row.trade_wrong_if) await logDesk("system", "Otto", `👁 Watching ${row.ticker} ${Number(row.level)} ${row.dir === "up" ? "▲" : row.dir === "down" ? "▼" : "▲▼"} today (added by Jarvis for ${o.author || "the Desk"}).`);
          content = row?.trade_wrong_if ? `${row.ticker} ${row.level} is now the ONE wrong-if on the open trade "${row.trade_wrong_if.title}"${row.trade_wrong_if.same ? " (it already was)" : ` (replaced ${row.trade_wrong_if.old})`}. The server closes it on a 5-minute close through it when auto-close is on (otherwise a close card). Say exactly that — don't promise to watch it yourself.`
            : row ? (scan ? `Proposed: ${row.ticker} ${row.level} (${row.dir}). It shows in the Watcher panel for them to Add.`
            : `On the Watcher for ${row.day}: ${row.ticker} ${row.level} (${row.dir}). The server checks it every minute on 5- and 10-minute closes and wakes you on a trigger.`)
            : "Already on today's list.";
        } else if (b.name === "log_practice_trade") {
          send({ t: "tool", v: "Logging the trade" });
          const by = `${o.author || "Desk"}`;
          const d = { ticker: String(input.ticker || "").toUpperCase().slice(0, 8), contract: String(input.contract || "").slice(0, 40), side: input.side === "short" ? "short" : "long",
            entry: Number(input.entry), exit: input.exit != null ? Number(input.exit) : null, pnl: input.pnl != null ? Number(input.pnl) : null,
            entry_time: String(input.entry_time || "").slice(0, 12), exit_time: String(input.exit_time || "").slice(0, 12), level: input.level != null ? Number(input.level) : null,
            why: String(input.why || "").slice(0, 400), platform: String(input.platform || "outside Otto").slice(0, 40), logged_by: by };
          const line = `${d.ticker} ${d.contract || ""} ${d.side} in ${d.entry}${d.exit != null ? " out " + d.exit : " (open)"}${d.pnl != null ? ` ${d.pnl >= 0 ? "+" : "-"}$${Math.abs(d.pnl)}` : ""}${d.level ? " level " + d.level : ""} — ${d.why}`.replace(/\s+/g, " ");
          await activity("trade", `Logged by ${by} (${d.platform}): ${line}`, by, null, { practice_log: d });
          content = `Logged in the Journal for the coach's weekly log: ${line}. Tell me if any number is wrong and I'll log a correction.`;
        } else if (b.name === "save_house_rule") {
          send({ t: "tool", v: "Saving a House Rule" });
          await houseRuleAdd(String(input.text || ""), `${o.author || "Desk"} via Jarvis`);
          content = "Saved. It's in Settings → House Rules and applies from the next message on.";
        } else if (b.name === "schedule_check") {
          send({ t: "tool", v: "Check-in at " + String(input.at || "") });
          const row = await checkAdd(String(input.at || ""), String(input.what || ""), `${o.author || o.who || "Desk"} via Jarvis`);
          content = `Scheduled #${row?.id ?? "?"}: at ${input.at} ET the server runs you again with that note and pings their phones. You may now say you'll check back then.`;
        } else if (b.name === "close_position") {
          if (!o.allowClose) throw new Error("auto-close isn't available in this run — use propose_action");
          send({ t: "tool", v: "Auto-close: " + String(input.reason || "").slice(0, 80) });
          const r = await closeNow(input, who);
          content = `DONE, no card needed: ${r.title}. Market sell sent (order ${r.order_id || "id not returned"}). It's posted on the Desk.`;
          send({ t: "tool", v: "Closed: " + r.title });
        } else {
          const m = /^(tv|rh)__(.+)$/.exec(b.name);
          if (!m || !READ[m[1]].has(m[2])) throw new Error("unknown tool " + b.name);
          const args = { ...input };
          if (m[1] === "rh" && RH_FORCE_ACCT.has(m[2])) args.account_number = await agenticAccount();
          send({ t: "tool", v: SVC[m[1]].name + ": " + m[2].replace(/^mcp-(tv|watchlist)-/, "") });
          const left = Math.max(5000, Math.min(45000, deadline - Date.now() - 20000));
          // v3.16 (code review 6 Oct): TradingView calls from Jarvis go through the shared breaker too.
          if (m[1] === "tv") await tvSlowLoad();
          const p = call(m[1], m[2], args);
          content = etAnnotate(mcpText(await (m[1] === "tv" ? tvBudget(p, left, "TradingView " + m[2]) : withTimeout(p, left, SVC[m[1]].name + " " + m[2]))).slice(0, 30000));
        }
      } catch (e) {
        isErr = true; content = "ERROR: " + (e as Error).message;
        errors.push(`${b.name}: ${String((e as Error).message).slice(0, 160)}`);
      }
      (isErr ? failed : did).push(b.name);
      results.push({ type: "tool_result", tool_use_id: b.id, content: content || "(empty)", ...(isErr ? { is_error: true } : {}) });
    }
    msgs.push({ role: "assistant", content: assistant });
    if (o.oneStep && (cards.length || dry.length)) return done();     // v3.23: the card is made — no second round
    // v3.13: a one-line clock with every round of tool results, so a long turn never loses the time.
    const c = marketClock();
    msgs.push({ role: "user", content: [...results, { type: "text", text: `[clock: ${fmtMin(c.min)} ET ${dayName(c.date)} ${c.date}, market ${c.status === "open" ? "OPEN" : c.status === "pre" ? "PRE-MARKET" : "CLOSED"}]` }] });
  }
  return done({ outOfRounds: true });
}

// v3.9: the Desk's system prompt, tools and context line — shared by the live Desk and Otto Signals.
async function deskSetup(opt: { fast?: boolean } = {}) {
  const factsP = withTimeout(todayFacts(), 5000, "today's facts").then(factsLine).catch(() => "");   // v3.22, in parallel (never slows a Signal card)
  const calls = await loadBrain();
  const cs = chunksOf(calls);
  const sys = DESK_SYS.replace("{{RULES}}", alwaysOn(calls));
  // v3.23 (fast = a Signal card): Robinhood tools only (a slow TradingView can't eat the card's time), banner capped at 4 s.
  const [dt, sent] = await Promise.all([opt.fast ? deskTools(["rh"]) : deskTools(),
    settle(opt.fast ? withTimeout(sentimentNow(), 4000, "banner") : sentimentNow())]);
  const { tools: mcpToolDefs, help, status } = dt;
  const tools: any[] = [
    TOOLS[0],                                         // search_jason
    { type: "web_search_20250305", name: "web_search", max_uses: 4 },
    ...mcpToolDefs,
    PROPOSE_TOOL(help),
    SHORTLIST_TOOL,
  ];
  const LIMa = await getLimits().catch(() => LIMIT_DEFAULTS);
  if (LIMa.auto_close) tools.push(CLOSE_TOOL);
  const now = new Date().toLocaleString("en-US", { timeZone: "America/New_York", weekday: "short",
    month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  const bn = sent.ok ? `Banner: ${sent.v.verdict} (score ${sent.v.score}, ${sent.v.fresh}/${sent.v.total} legs fresh; fired: ${sent.v.rows.filter((r: any) => r.fired).map((r: any) => "row " + r.row).join(", ") || "none"}).` : "Banner: unavailable.";
  const LIM = await getLimits().catch(() => LIMIT_DEFAULTS);
  const prot = await settle(db("otto_actions?" + OQ() + "select=title,exit&exit->>state=in.(waiting_fill,armed)&limit=5"));
  const protLine = prot.ok && prot.v.length ? " Protected trades (Otto runs their stop and alerts; to close one early, cancel_option_order its stop_order_id first, then sell, in one card): " +
    prot.v.map((r: any) => `${r.title} [${r.exit.state}${r.exit.stop_order_id ? `, stop_order_id ${r.exit.stop_order_id} at $${r.exit.stop_option}` : ""}, wrong-if ${r.exit.wrong_if}, TP1 ${r.exit.tp1}]`).join("; ") + "." : "";
  const jctx = await jasonContext().catch(() => "");
  const ls26 = await withTimeout(lockState(), 6000, "lock state").catch(() => null);
  const lock26 = ls26?.locked ? `🔒 LOCKED by the kill switch: ${ls26.text}. Any opening card you propose becomes a paper card. ` : "";
  const ctxLine = `[Desk context — ${now} ET. TradingView: ${status.tv}. Robinhood: ${status.rh}. ${bn} ${lock26}Their guardrails (Phase ${LIM.phase}; they flag — only the kill switch turns a card into an unapprovable paper card; an idea over the size cap is offered as a PRACTICE card on the $4,000 practice book that Josh must Approve or Reject): ${LIM.size_cap_on !== false && Number(LIM.size_cap_pct) > 0 ? `SIZE CAP ${LIM.size_cap_pct}% of the account${LIM.size_cap_usd ? ` ($${LIM.size_cap_usd})` : ""} per trade, ` : "size cap off, "}max loss per trade at the stop ${LIM.max_trade_loss > 0 ? `$${LIM.max_trade_loss}${LIM.pct_mode && LIM.max_trade_pct > 0 ? ` (${LIM.max_trade_pct}% of the $${Math.round(LIM.account_value)} Agentic account)` : ""}` : "off"}, weekly loss limit $${LIM.weekly_loss}${LIM.pct_mode && LIM.weekly_pct > 0 ? ` (${LIM.weekly_pct}%)` : ""}, daily stop after ${LIM.daily_losses || "—"} losing trades or 2× the max loss, ${LIM.max_trades_day} trades/day, size flag over ${LIM.warn_pct}% of the account. Size ideas inside these when a contract allows it (set stop_option so the loss at the stop fits); when nothing fits, still make the card — it gets the red flag — and say so in one line.${protLine} Auto-close: ${LIM.auto_close ? "ON (close_position works 9:30–4:00 ET)" : "OFF (closes go on a card)"}.${jctx}]`;

  // v3.16: the exact list of what runs on its own, so Jarvis can only point at real things.
  const running = await runningNow().catch(() => "");
  const pl = await plansToday().catch(() => []);   // v3.19: today's locked plans — hold them to it
  const planLineCtx = pl.length ? "\nTODAY'S LOCKED PLANS (the trader's own; flag any card or trade that isn't this plan): " + pl.map((p: any) => `${p.author}: ${p.line}`).join(" | ") : "";
  const facts = await factsP;   // v3.22: look before saying "none"
  const hk45 = await hkStatus().catch(() => null);   // v3.45: Josh's homework for today — his own read; hold him to it
  const hkLine = !hk45?.applies ? "" : (hk45.done || hk45.late) ? `\nJOSH'S HOMEWORK FOR TODAY (his own after-close read${hk45.late ? ", handed in late" : ""}): ${String(hk45.call || "").toUpperCase()} — "${String(hk45.call_why || "").slice(0, 200)}"; his levels: ${(hk45.levels || []).map((x: any) => `${x.ticker} ${x.level} ${x.dir === "up" ? "▲" : "▼"}`).join(", ") || "none"}. When a card or his idea goes against his own call, say so in one line.`
    : hk45.missed ? "\nJOSH DID NOT HAND IN LAST NIGHT'S HOMEWORK (due 9:00 AM). It never blocks a card. Every card today carries a NO HOMEWORK tag; if he asks for a trade, one line: his call today is a guess, not a plan." : "";
  return { cs, sys, tools, ctxLine: (running ? ctxLine + "\n" + running : ctxLine) + planLineCtx + hkLine + "\n" + CONTRACT_RULE + (facts ? "\n" + facts : ""), autoClose: !!LIMa.auto_close };
}

export async function desk(req: Request, who: string, _apiKey: string) {
  const body = await req.json().catch(() => ({}));
  const history = Array.isArray(body.messages) ? body.messages.slice(-24) : [];
  if (!history.length) throw new Error("no messages");
  const author = String(body.author || "Ifoma").slice(0, 30);
  const isJason = !!body.jason;                    // v3.7: a pasted Jason post

  let setup: Awaited<ReturnType<typeof deskSetup>>;
  try { setup = await deskSetup(); }
  catch (e) {   // v3.13: even a setup failure shows on the Desk
    await logDesk("system", "Otto", `⚠ Jarvis couldn't start on ${author}'s message (${String((e as Error).message).slice(0, 160)}). Send it again.`).catch(() => {});
    throw e;
  }
  const { cs, sys, tools, ctxLine, autoClose } = setup;
  const LIMa = { auto_close: autoClose };

  const msgs: any[] = history.map((m: any, i: number) => {
    const role = m.role === "assistant" ? "assistant" : "user";
    let text = String(m.content || "").slice(0, 8000);
    if (role === "user" && m.author) text = `${String(m.author).slice(0, 30)}: ${text}`;
    if (i === history.length - 1 && role === "user") {
      text = ctxLine + "\n" + text;
      const img = m.image && typeof m.image.data === "string" && m.image.data.length > 100 && m.image.data.length < 6_000_000 ? m.image : null;
      if (img) return { role, content: [
        { type: "image", source: { type: "base64",
          media_type: /^image\/(jpeg|png|webp|gif)$/.test(img.media_type) ? img.media_type : "image/jpeg", data: img.data } },
        { type: "text", text }] };
    }
    return { role, content: text };
  });
  // The API wants alternating turns starting with the user.
  while (msgs.length && msgs[0].role !== "user") msgs.shift();
  for (let i = msgs.length - 1; i > 0; i--) {
    if (msgs[i].role !== msgs[i - 1].role) continue;
    const toArr = (c: any) => typeof c === "string" ? [{ type: "text", text: c }] : c;
    msgs[i - 1].content = [...toArr(msgs[i - 1].content), ...toArr(msgs[i].content)];
    msgs.splice(i, 1);
  }
  if (!msgs.length || msgs[msgs.length - 1].role !== "user") throw new Error("last message must be from you");

  const last = history[history.length - 1];
  if (!isJason) await logDesk("user", author, String(last.content || "") + (last.image ? "\n[chart attached]" : ""));
  const lastImg = last.image && typeof last.image.data === "string" && last.image.data.length > 100 && last.image.data.length < 6_000_000 ? last.image : null;

  const encS = new TextEncoder();
  const stream = new ReadableStream({
    async start(ctrl) {
      const send = (o: unknown) => { try { ctrl.enqueue(encS.encode("data: " + JSON.stringify(o) + "\n\n")); } catch { /* client left */ } };
      let res: any = { said: "", cards: [] as string[] };
      let jrows: any[] = [];
      try {
        if (isJason) {
          // v3.7: read Jason's post first (vision, forced tool), save it, then hand Jarvis a structured prompt.
          send({ t: "tool", v: "Reading the signal" });
          const typed = String(last.content || "").replace(/^\(chart attached\)$/, "").trim();
          jrows = await jasonIntake(_apiKey, lastImg, typed && !lastImg ? typed : "", who, author);
          await logDesk("user", author, "📣 Signal (pasted)" + (jrows.length ? ":\n" + jrows.map((r: any) => `${r.posted_label || "?"} · ${r.words}`).join("\n") : " — nothing could be read from it") +
            (typed && lastImg ? "\n" + typed : ""));
          send({ t: "jason", v: jrows.length });
          const lm = msgs[msgs.length - 1];
          const prompt = ctxLine + "\n" + author + ": " + jasonPrompt(jrows, lastImg ? typed : "");
          if (typeof lm.content === "string") lm.content = prompt;
          else { const tb = lm.content.filter((b: any) => b.type === "text"); if (tb.length) tb[tb.length - 1].text = prompt; else lm.content.push({ type: "text", text: prompt }); }
        }
        const deskTools = [...tools, HOUSE_TOOL, WATCH_TOOL, CHECK_TOOL, LOG_TOOL];
        const deskStart = Date.now();
        res = await runDesk({ msgs, sys, tools: deskTools, cs, who, send, allowPropose: true, allowClose: !!LIMa.auto_close, author });
        // v3.16: promises in the reply must be backed by something real — otherwise one correction round, shown under the reply.
        if (!res.timedOut && Date.now() - deskStart < RUN_BUDGET_MS - 45_000) {   // never let the check push the reply past the 150 s cut-off
          const fix = await enforcePromises(res, async (extra) => {
            const m2 = [...msgs, { role: "assistant", content: res.finalText || res.said || "(no text)" }, { role: "user", content: extra }];
            send({ t: "text", v: "\n\n" });
            const r2 = await runDesk({ msgs: m2, sys, tools: deskTools, cs, who, send, allowPropose: false, allowClose: false, author, maxRounds: 3,
              deadline: Math.min(Date.now() + 40_000, deskStart + RUN_BUDGET_MS + 10_000) });
            return { said: r2.said, did: r2.did };
          }).catch(() => ({ added: "", bad: [] as any[], fallback: false }));
          if (fix.bad.length && fix.added) {
            if (fix.fallback) send({ t: "text", v: fix.added });       // Jarvis's own fix was already streamed
            res.said = res.said.trim() + "\n\n" + fix.added;
          }
        }
        send({ t: "done" });
      } catch (e) {
        // v3.13: never go silent — the failure is posted on the Desk, not only to the open browser tab.
        const m = String((e as Error).message ?? e).slice(0, 300);
        send({ t: "error", v: m });
        await logDesk("system", "Otto", `⚠ Jarvis couldn't answer ${author}'s last message (${/429|rate/i.test(m) ? "a data source is rate-limiting" : /overload|5\d\d/.test(m) ? "Claude is overloaded" : "error"}: ${m.slice(0, 160)}). Send it again.`).catch(() => {});
      }
      if (isJason && res.cards.length) {
        // Link each card to the Jason call it came from (plan.jason_id, else the only open call).
        try {
          const acts = await db("otto_actions?select=id,plan&id=in.(" + res.cards.join(",") + ")");
          const open = jrows.filter((r: any) => r.kind === "call" && !r.late && !r.action_id);
          for (const a of acts) {
            const jid = Number(a.plan?.jason_id);
            const row = jrows.find((r: any) => r.id === jid) || (open.length === 1 ? open[0] : null);
            if (row) await db("otto_jason?id=eq." + row.id, { method: "PATCH", headers: { prefer: "return=minimal" }, body: JSON.stringify({ action_id: a.id }) });
          }
        } catch { /* the card still works; it just isn't linked */ }
      }
      // v3.22: fake call citations and false "none" claims are fixed before the reply is saved; the note shows live too.
      try { const fc = await factCheck(res.said); if (fc.notes.length) { send({ t: "text", v: "\n\n" + fc.notes.join("\n") }); res.said = fc.text.trim() + "\n\n" + fc.notes.join("\n"); } } catch { /* */ }
      if (res.said.trim() || res.cards.length) await logDesk("assistant", "Jarvis", res.said.trim(), res.cards[res.cards.length - 1] || null);
      try { ctrl.close(); } catch { /* */ }
    },
  });
  return new Response(stream, { headers: { ...CORS, "content-type": "text/event-stream", "cache-control": "no-store" } });
}

/* ===================================================================== v3.1
   4 Oct 2026 — sentiment banner, rule check, journal, weekly review, scorecard,
   scheduled morning read. Everything here reads TradingView / Robinhood through
   the same MCP client as the Desk; nothing here can place or change anything.

   Data note (tested 4 Oct): TradingView's screener-backed tools (quotes batch,
   earnings calendar) were returning 429. OHLCV and the economic calendar were
   fine. So the banner runs on OHLCV bars only; quotes fall back to bars; and
   earnings come from Robinhood's earnings calendar instead of TradingView's. */

/* ------------------------------------------------------------ small helpers */

function etParts(d = new Date()) {
  const f = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour12: false, weekday: "short",
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).formatToParts(d);
  const g = (t: string) => f.find((x) => x.type === t)?.value || "";
  return { wd: g("weekday"), date: `${g("year")}-${g("month")}-${g("day")}`, min: (Number(g("hour")) % 24) * 60 + Number(g("minute")) };
}
const fmtMin = (m: number) => { const h = Math.floor(m / 60), mm = m % 60; return `${((h + 11) % 12) + 1}:${String(mm).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`; };
function etLabel(iso: string) {
  const p = etParts(new Date(iso));
  return `${p.wd} ${fmtMin(p.min)}`;
}
function addDays(date: string, n: number) {
  const d = new Date(date + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10);
}
const dayDiff = (a: string, b: string) => Math.round((Date.parse(b + "T12:00:00Z") - Date.parse(a + "T12:00:00Z")) / 864e5);
function fridayOf(date: string) { const wd = new Date(date + "T12:00:00Z").getUTCDay(); return addDays(date, (5 - wd + 7) % 7); }
function mondayOf(date: string) { const wd = new Date(date + "T12:00:00Z").getUTCDay(); return addDays(date, -((wd + 6) % 7)); }

/* ------------------------------------------------------------ v3.13 market clock
   6 Oct 2026: Jarvis read Robinhood/TradingView UTC timestamps as New York time and
   told Josh "the market is closed" at 12:28 PM, called Tuesday "Oct 7", and got
   expiry weekdays wrong. The clock is now computed here, in code, and handed to
   every Jarvis run; tool timestamps are converted to ET before he sees them. */
const NYSE_CLOSED = new Set(["2026-01-01", "2026-01-19", "2026-02-16", "2026-04-03", "2026-05-25", "2026-06-19", "2026-07-03",
  "2026-09-07", "2026-11-26", "2026-12-25", "2027-01-01", "2027-01-18", "2027-02-15", "2027-03-26", "2027-05-31", "2027-06-18",
  "2027-07-05", "2027-09-06", "2027-11-25", "2027-12-24"]);
const NYSE_HALF = new Set(["2026-11-27", "2026-12-24", "2027-11-26"]);   // 1:00 PM ET close
const WD_LONG: Record<string, string> = { Mon: "Monday", Tue: "Tuesday", Wed: "Wednesday", Thu: "Thursday", Fri: "Friday", Sat: "Saturday", Sun: "Sunday" };
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function dayName(date: string) { return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][new Date(date + "T12:00:00Z").getUTCDay()]; }
function prettyDate(date: string) { const [y, m, d] = date.split("-").map(Number); return `${WD_LONG[dayName(date)]}, ${MON[m - 1]} ${d}, ${y}`; }
function isTradingDay(date: string) { return !["Sat", "Sun"].includes(dayName(date)) && !NYSE_CLOSED.has(date); }
function nextTradingDay(date: string) { let d = addDays(date, 1); while (!isTradingDay(d)) d = addDays(d, 1); return d; }
// The last trading day of the week that holds `date` (normally Friday; Thursday when Friday is a holiday).
function weekExpiry(date: string) { let f = fridayOf(date); while (!isTradingDay(f)) f = addDays(f, -1); return f; }
const hm = (mins: number) => `${Math.floor(mins / 60)}h ${String(mins % 60).padStart(2, "0")}m`;
export function marketClock(d = new Date()) {
  const e = etParts(d);
  const closeMin = NYSE_HALF.has(e.date) ? 780 : 960;
  const trading = isTradingDay(e.date);
  let status: "open" | "pre" | "after" | "closed", text: string;
  if (!trading) {
    status = "closed";
    text = `CLOSED today (${NYSE_CLOSED.has(e.date) ? "market holiday" : "weekend"}). Next open: ${prettyDate(nextTradingDay(e.date))} 9:30 AM ET`;
  } else if (e.min < 570) {
    status = "pre"; text = `PRE-MARKET — the regular session opens at 9:30 AM ET (in ${hm(570 - e.min)}); options don't trade until then`;
  } else if (e.min < closeMin) {
    status = "open"; text = `OPEN — regular session 9:30 AM–${fmtMin(closeMin)} ET, ${hm(closeMin - e.min)} left` +
      (e.min < 600 ? `; inside the first 30 minutes (until 10:00 AM)` : "");
  } else {
    status = "after"; text = `CLOSED for the day at ${fmtMin(closeMin)} ET (after hours; options don't trade). Next open: ${prettyDate(nextTradingDay(e.date))} 9:30 AM ET`;
  }
  const thisExp = weekExpiry(e.date), nextExp = weekExpiry(addDays(e.date, 7));
  const line = `[CLOCK — computed by Otto, authoritative: it is ${prettyDate(e.date)}, ${fmtMin(e.min)} ET. Market: ${text}. ` +
    `This week's expiry Friday = ${prettyDate(thisExp)} (${thisExp}); next week's = ${prettyDate(nextExp)} (${nextExp}). ` +
    `Tool data shows times in UTC (ending in Z); Otto writes the ET time next to each one ("= 12:08 PM ET"). ` +
    `Use THIS line for today's date, the weekday and whether the market is open — never work them out from a tool timestamp.]`;
  return { ...e, status, closeMin, thisExp, nextExp, line };
}
// "2026-10-06T16:08:00Z" → "2026-10-06T16:08:00Z (= 12:08 PM ET)"; adds the date when the ET day differs from today.
export function etAnnotate(text: string, now = new Date()): string {
  if (!text) return text;
  const today = etParts(now).date;
  return text.replace(/\b\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]00:?00)(?![\w(])/g, (m) => {
    const t = Date.parse(m.replace(/([+-]00)(00)$/, "$1:$2"));
    if (!isFinite(t)) return m;
    const p = etParts(new Date(t));
    return `${m} (= ${p.date === today ? "" : `${dayName(p.date)} ${MON[Number(p.date.slice(5, 7)) - 1]} ${Number(p.date.slice(8))} `}${fmtMin(p.min)} ET)`;
  }).replace(/("(?:time|t|timestamp|bar_time|begins_at_epoch)"\s*:\s*)(1[6-9]\d{8})(?=[,}\s])/g, (m, k, n) => {
    const p = etParts(new Date(Number(n) * 1000));
    return `${k}${n} /* = ${p.date === today ? "" : `${dayName(p.date)} ${MON[Number(p.date.slice(5, 7)) - 1]} ${Number(p.date.slice(8))} `}${fmtMin(p.min)} ET */`;
  });
}

const CACHE: Record<string, { at: number; v: any }> = {};
const ROOM_CACHE = /^(accounts|agentic_value|dailypnl|lockstate|ord\||facts\|)/;   // v5.0: Robinhood-account-level entries live per room
async function cached<T>(key: string, ms: number, f: () => Promise<T>): Promise<T> {
  if (owner() !== HOUSE && ROOM_CACHE.test(key)) key = owner() + "|" + key;
  const c = CACHE[key];
  if (c && Date.now() - c.at < ms && Date.now() >= c.at) return c.v;   // v3.24: a clock that moved back never serves a stale copy
  const v = await f();
  CACHE[key] = { at: Date.now(), v };
  return v;
}

async function tvBars(sym: string, interval: string, count: number): Promise<any[]> {
  return cached(`bars|${sym}|${interval}|${count}`, interval === "1D" ? 10 * 60e3 : 60e3, async () => {
    const j = mcpJson(await call("tv", "mcp-tv-get-ohlcv", { symbol: sym, interval, count }));
    if (!j || j.success === false || !Array.isArray(j.bars)) throw new Error(`no bars for ${sym}: ${j?.error || "empty"}`);
    return j.bars;
  });
}

async function econEvents(from: string, to: string, minImp = 1): Promise<any[]> {
  return cached(`econ|${from}|${to}|${minImp}`, 30 * 60e3, async () => {
    const j = mcpJson(await call("tv", "mcp-tv-get-economic-calendar",
      { date_from: from, date_to: to + "T23:59:59Z", min_importance: minImp, countries: "US" }));
    return (j?.result || []).map((e: any) => ({ date: e.date, title: e.title, importance: e.importance,
      actual: e.actual, forecast: e.forecast, previous: e.previous, period: e.period }));
  });
}

// Robinhood's calendar (TradingView's is screener-backed and was rate-limited).
async function earningsMap(): Promise<Record<string, string>> {
  return cached("earnings", 6 * 3600e3, async () => {
    const out: Record<string, string> = {};
    const today = etParts().date;
    for (const start of [today, addDays(today, 31)]) {
      try {
        const j = mcpJson(await call("rh", "get_earnings_calendar", { start_date: start, days: 31, filter: "high_market_cap" }));
        for (const r of j?.data?.results || []) {
          if (r?.eps?.actual != null) continue;
          const d = r?.report?.date; if (!d || !r.symbol) continue;
          if (!out[r.symbol] || d < out[r.symbol]) out[r.symbol] = d + (r.report.timing ? " " + r.report.timing : "");
        }
      } catch { /* partial is fine */ }
    }
    return out;
  });
}

// Prices for a list of EXCHANGE:TICKER. Screener batch first; bars if it's rate-limited.
async function quotesFor(syms: string[]): Promise<Record<string, { close: number; change: number | null }>> {
  const key = "q|" + syms.slice().sort().join(",");
  return cached(key, 90e3, async () => {
    const out: Record<string, any> = {};
    try {
      const j = mcpJson(await call("tv", "mcp-tv-get-symbol-data-batch", { symbols: syms, columns: ["close", "change"] }));
      if (j && j.success !== false) {
        const walk = (o: any) => {
          if (!o || typeof o !== "object") return;
          if (Array.isArray(o)) { o.forEach(walk); return; }
          const s = o.symbol || o.ticker || o.s; const d = o.d && typeof o.d === "object" ? o.d : o;
          if (typeof s === "string" && d.close != null) out[s] = { close: Number(d.close), change: d.change != null ? Number(d.change) : null };
          Object.values(o).forEach((v) => { if (v && typeof v === "object") walk(v); });
        };
        walk(j);
      }
    } catch { /* fall through */ }
    const missing = syms.filter((s) => !out[s]);
    for (let i = 0; i < missing.length; i += 8) {
      await Promise.all(missing.slice(i, i + 8).map(async (s) => {
        try {
          const b = await tvBars(s, "1D", 2);
          const last = b[b.length - 1], prev = b.length > 1 ? b[b.length - 2] : null;
          out[s] = { close: last.c, change: prev ? (last.c - prev.c) / prev.c * 100 : null };
        } catch { /* leave missing */ }
      }));
    }
    return out;
  });
}

/* ------------------------------------------------------------ the sentiment banner
   Josh's Intermarket Sentiment Cheat Sheet, same thresholds as the v2.4 bias card
   (BIAS_RULES in index.html), now on real TradingView series instead of ETF
   stand-ins. No sizing anywhere — Ifoma's decision, 4 Oct: verdict and reasons only. */

const LEGS = [
  { k: "yield", sym: "TVC:US10Y", label: "10Y" },
  { k: "dollar", sym: "TVC:DXY", label: "DXY" },
  { k: "jpy", sym: "FX:USDJPY", label: "USD/JPY" },
  { k: "crude", sym: "NYMEX:CL1!", label: "Crude" },
  { k: "es", sym: "CME_MINI:ES1!", label: "ES" },
  { k: "nq", sym: "CME_MINI:NQ1!", label: "NQ" },
  { k: "ym", sym: "CBOT_MINI:YM1!", label: "YM" },
];
const SENT_RULES = [
  { row: 1, leg: "yield", when: (p: number) => p >= 0.60, side: -1, label: "10Y spikes up", why: "Higher discount rates compress tech multiples." },
  { row: 2, leg: "yield", when: (p: number) => p <= -0.40, side: +1, label: "10Y falls", why: "Easing yields relieve valuation pressure." },
  { row: 3, leg: "jpy", when: (p: number) => p <= -0.40, side: -1, label: "USD/JPY dumps", why: "Yen strengthening: risk-off, carry-trade unwind." },
  { row: 4, leg: "jpy", when: (p: number) => p >= 0.15, side: +1, label: "USD/JPY grinds up", why: "Dollar firm vs yen: healthy liquidity." },
  { row: 5, leg: "dollar", when: (p: number) => p >= 0.40, side: -1, label: "DXY breaks up", why: "Strong dollar tightens conditions." },
  { row: 6, leg: "crude", when: (p: number) => p >= 2.00, side: -1, label: "Crude spikes", why: "Energy shock lifts yields." },
];
const FRESH_SEC = 45 * 60;
let SENT: { at: number; body: any } | null = null;

async function tvLeg(l: any) {
  const [d, m] = await Promise.all([tvBars(l.sym, "1D", 3), tvBars(l.sym, "15m", 8)]);
  const last = m[m.length - 1];
  const cur = d[d.length - 1];
  const prev = last.t >= cur.t && d.length > 1 ? d[d.length - 2].c : cur.c;
  const pct = prev ? (last.c - prev) / prev * 100 : null;
  const age = Math.max(0, Date.now() / 1000 - (last.t + 900));
  return { k: l.k, label: l.label, sym: l.sym, src: "tv", price: last.c, pct, age: Math.round(age), live: pct !== null && age <= FRESH_SEC,
    spark: m.map((b: any) => b.c) };
}

/* Yahoo backup, 5 Oct 2026 (v3.4.1). TradingView's bar feed refused every
   connection mid-morning ("tvws: dial: websocket: bad handshake") and the
   banner fell to "1 of 7 fresh → No read". Ifoma's call: TradingView stays
   first; a leg that fails (or is staler than Yahoo's) is filled from Yahoo.
   Accuracy rules:
   - The REAL instruments, never ETF stand-ins (the old IEF/UUP/USO path went
     stale outside stock hours): ^TNX, DX-Y.NYB, JPY=X, CL=F, ES=F, NQ=F, YM=F.
   - A leg's price, prior close and % change all come from ONE source.
     Checked live 5 Oct 12:02 ET: Yahoo's prior closes match TradingView's
     prior daily bar (ES 7777.25, CL 91.11, 10Y 5.277 vs 5.275).
   - age = now − Yahoo's regularMarketTime (the real last-trade time; it
     advances, unlike the TwelveData `at` bug of 25 Aug). Yahoo's futures and
     DXY run ~10 min behind, ^TNX ~15; TradingView's own bars are delayed 15+.
     Ifoma chose to COUNT a delayed leg, labelled with its age; the same
     45-minute FRESH_SEC gate still drops anything older.
   - Every refresh tries TradingView first, so legs switch back on their own. */
const YAHOO_SYM: Record<string, string> = {
  yield: "^TNX", dollar: "DX-Y.NYB", jpy: "JPY=X", crude: "CL=F", es: "ES=F", nq: "NQ=F", ym: "YM=F",
};
async function yahooLeg(l: any) {
  const ys = YAHOO_SYM[l.k];
  const res: any = await cached(`yleg|${ys}`, 60e3, async () => {
    const r = await fetch("https://query1.finance.yahoo.com/v8/finance/chart/" + encodeURIComponent(ys) +
                          "?range=1d&interval=15m", { headers: UA });
    if (!r.ok) throw new Error("yahoo HTTP " + r.status);
    const j = await r.json();
    const x = j?.chart?.result?.[0];
    if (!x?.meta) throw new Error(j?.chart?.error?.description || "yahoo: no data");
    return x;
  });
  const m = res.meta;
  const price = Number(m.regularMarketPrice), prev = Number(m.chartPreviousClose ?? m.previousClose);
  const t = Number(m.regularMarketTime);
  if (!isFinite(price) || !isFinite(prev) || !prev || !isFinite(t)) throw new Error("yahoo: incomplete quote for " + ys);
  const pct = (price - prev) / prev * 100;
  const age = Math.max(0, Date.now() / 1000 - t);
  const closes = (res.indicators?.quote?.[0]?.close || []).filter((c: any) => typeof c === "number");
  return { k: l.k, label: l.label, sym: "Yahoo " + ys, src: "yahoo", price, pct, age: Math.round(age), live: age <= FRESH_SEC,
    spark: closes.slice(-8) };
}

// v3.9.2 (Ifoma, 6 Oct): Yahoo FIRST for the banner, TradingView only as the backup.
// TradingView has been rate-limiting / dropping every day since 4 Oct and its bars are
// 15+ min delayed anyway; Yahoo has been as fresh and steadier.
async function legData(l: any) {
  let y: any = null, yErr = "";
  try { y = await withTimeout(yahooLeg(l), 6000, "Yahoo"); } catch (e) { yErr = String((e as Error).message ?? e).slice(0, 160); }
  if (y && y.live) return y;
  let tv: any = null, tvErr = "";
  try { tv = await tvBudget(tvLeg(l), 8000, "TradingView"); } catch (e) { tvErr = String((e as Error).message ?? e).slice(0, 160); }
  // TradingView only replaces Yahoo when Yahoo failed or TradingView is fresher.
  if (tv && (!y || tv.age < y.age)) return { ...tv, yahoo_error: yErr || (y ? `Yahoo quote ${Math.round(y.age / 60)} min old` : "") };
  if (y) return tvErr ? { ...y, tv_error: tvErr } : y;
  throw new Error(`Yahoo: ${yErr || "no data"} · TradingView: ${tvErr || "no data"}`);
}

async function sentimentNow(force = false, kind = "live"): Promise<any> {
  if (!force && SENT && Date.now() - SENT.at < 4 * 60e3) return SENT.body;
  await tvSlowLoad();
  const legs = await Promise.all(LEGS.map((l) => legData(l).catch((e) => ({ k: l.k, label: l.label, sym: l.sym, live: false, error: (e as Error).message }))));
  const by: Record<string, any> = Object.fromEntries(legs.map((l: any) => [l.k, l]));
  const fresh = legs.filter((l: any) => l.live).length;
  let score = 0;
  const rows: any[] = [];
  for (const r of SENT_RULES) {
    const l = by[r.leg];
    const fired = !!(l && l.live && r.when(l.pct));
    if (fired) score += r.side;
    rows.push({ row: r.row, label: r.label, why: r.why, fired, side: r.side, value: l?.pct ?? null, leg: r.leg });
  }
  const sgn = (v: number) => (v >= 0 ? 1 : -1);
  const idx = ["es", "nq", "ym"].map((k) => by[k]).filter((l) => l && l.live);
  const aligned = idx.length === 3 && idx.every((l) => Math.abs(l.pct) >= 0.25) && new Set(idx.map((l) => sgn(l.pct))).size === 1 ? sgn(idx[0].pct) : 0;
  const nq = by.nq, ym = by.ym;
  const diverged = !!(nq?.live && ym?.live && sgn(nq.pct) !== sgn(ym.pct) && Math.abs(nq.pct) >= 0.20 && Math.abs(ym.pct) >= 0.20);
  if (aligned) score += aligned * 2;
  rows.push({ row: 7, label: "ES, NQ and YM break together", why: "Broad institutional buying or selling.", fired: !!aligned, side: aligned, value: null });
  rows.push({ row: 8, label: "NQ vs YM divergence", why: "Rotation, not entry: whipsaw risk.", fired: diverged, side: 0, value: null });

  let verdict: string, tone: string, note: string;
  if (fresh < 2) { verdict = "No read"; tone = "none"; note = "Not enough fresh data from TradingView or the Yahoo backup. Futures and FX trade almost 24h; if this persists outside the weekend, both feeds may be down."; }
  else if (diverged) { verdict = "Choppy — stand aside"; tone = "chop"; note = "Nasdaq and Dow pulling opposite ways. Josh's sheet calls that rotation (row 8): scalp only or stand aside."; }
  else if (fresh >= 5 && score >= 3) { verdict = "Leaning long"; tone = "long"; note = "Macro tailwind and the indexes agree."; }
  else if (fresh >= 5 && score <= -3) { verdict = "Leaning short"; tone = "short"; note = "Macro headwind and the indexes agree."; }
  else if (score >= 2) { verdict = "Mildly long — small size"; tone = "long"; note = "Some tailwind, not conviction (Scenario 3: small targets)."; }
  else if (score <= -2) { verdict = "Mildly short — small size"; tone = "short"; note = "Some headwind, not conviction (Scenario 3: small targets)."; }
  else { verdict = "No edge"; tone = "none"; note = "Nothing lines up. Jason: no edge, no trade."; }

  const now = etParts();
  let calendar: any[] = [];
  try { calendar = await tvBudget(econEvents(now.date, now.date, 0), 5000, "TradingView calendar"); } catch { /* shown as unavailable */ }
  const nextHigh = calendar.find((e) => e.importance >= 1 && Date.parse(e.date) > Date.now()) || null;

  let window: string | null = null;
  if (!["Sat", "Sun"].includes(now.wd)) {
    if (now.min >= 570 && now.min < 600) window = "in";
    else if (now.min >= 525 && now.min < 570) window = "soon";
  }
  const dir = (l: any, bad: number) => !l?.live || l.pct == null ? "—" : (Math.sign(l.pct) === bad ? "headwind" : "tailwind");
  const jason = {
    capital: { label: "10-year (cost of capital)", pct: by.yield?.pct ?? null, read: dir(by.yield, 1) },
    transport: { label: "Crude (cost of transportation)", pct: by.crude?.pct ?? null, read: dir(by.crude, 1) },
    currency: { label: "USD/JPY (cost of currency)", pct: by.jpy?.pct ?? null, read: dir(by.jpy, -1) },
  };
  let news: any = null;
  try {
    const r = await db("otto_sentiment?kind=eq.auto&order=id.desc&limit=1&select=at,news");
    if (r?.[0]?.news && Date.now() - Date.parse(r[0].at) < 14 * 3600e3) news = { text: r[0].news, at: r[0].at };
  } catch { /* table may be missing until 005 runs */ }

  const backup = legs.filter((l: any) => l.src === "yahoo").length;
  const body = { ok: true, at: Date.now(), et: `${now.wd} ${fmtMin(now.min)}`, verdict, tone, score, fresh, total: LEGS.length, backup,
    note, legs: legs.map((l: any) => { const { spark, ...rest } = l; return { ...rest, spark }; }), rows, calendar, next_event: nextHigh,
    window, jason, news };
  SENT = { at: Date.now(), body };
  try {
    const last = await db("otto_sentiment?order=id.desc&limit=1&select=at");
    if (kind === "auto" || !last?.[0] || Date.now() - Date.parse(last[0].at) > 5 * 60e3) {
      await db("otto_sentiment", { method: "POST", headers: { prefer: "return=minimal" },
        body: JSON.stringify({ kind, verdict, score, payload: { ...body, legs: body.legs.map((l: any) => ({ ...l, spark: undefined })) } }) });
    }
  } catch { /* history is a nice-to-have */ }
  return body;
}

/* ------------------------------------------------------------ v4.0 MARKET READ
   The coach's CNBC pass (22 Oct 1:1, minutes 9–17), done by Otto every 10 minutes:
   bonds first, then who leads, oil vs XOM, the dollar, gold · copper, crypto, the calendar.
   Rules are mechanical and the thresholds live in MR_RULES; missing data is "—", never a guess.
   Verdict (Ifoma 23 Oct): DEFENSIVE = Nasdaq ≤ −1% and TLT ≥ +0.2%; RISK-ON = Nasdaq ≥ +0.5%
   and TLT ≤ −0.2% and copper/BTC green; else NEUTRAL, soft or firm by the index average.
   Dislocations: oil/XOM, oil/CVX, gold/NEM, copper/FCX — both ≥0.3% and opposite signs → a line,
   never a card by itself. One route (`market_read`), cached 10 minutes, no new table.
   Prices: Yahoo chart API (the same source the banner already trusts), one call per symbol,
   1d/5m for today's sparkline + 5d/1d for the last five days. */
export const MR_RULES = { def_nq: -1.0, def_tlt: 0.2, on_nq: 0.5, on_tlt: -0.2, disloc: 0.3, lead: 0.25 };
const MR_SYMS: Record<string, string> = { tnx: "^TNX", tlt: "TLT", qqq: "QQQ", spy: "SPY", dia: "DIA", iwm: "IWM", cl: "CL=F", xom: "XOM", cvx: "CVX",
  dxy: "DX-Y.NYB", jpy: "JPY=X", gc: "GC=F", nem: "NEM", hg: "HG=F", fcx: "FCX", btc: "BTC-USD" };
export type MrQ = { sym: string; price: number | null; pct: number | null; hi: number | null; lo: number | null; age: number | null; spark: number[]; days: { d: string; pct: number }[]; error?: string };
async function mrQuote(sym: string): Promise<MrQ> {
  const T: any = (globalThis as any).__OTTO_TEST__;
  if (T?.yahoo) return T.yahoo(sym);
  const get = (range: string, interval: string, ms: number) => cached(`mr|${sym}|${range}|${interval}`, ms, async () => {
    const r = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?range=${range}&interval=${interval}`, { headers: UA });
    if (!r.ok) throw new Error("yahoo HTTP " + r.status);
    const j = await r.json(); const x = j?.chart?.result?.[0];
    if (!x?.meta) throw new Error(j?.chart?.error?.description || "yahoo: no data");
    return x;
  });
  const out: MrQ = { sym, price: null, pct: null, hi: null, lo: null, age: null, spark: [], days: [] };
  try {
    const x: any = await withTimeout(get("1d", "5m", 60e3), 6000, "Yahoo");
    const m = x.meta, price = Number(m.regularMarketPrice), prev = Number(m.chartPreviousClose ?? m.previousClose);
    const q = x.indicators?.quote?.[0] || {};
    const closes: number[] = (q.close || []).filter((c: any) => typeof c === "number");
    if (isFinite(price) && isFinite(prev) && prev) { out.price = price; out.pct = (price - prev) / prev * 100; }
    out.hi = Math.max(...(q.high || []).filter((v: any) => typeof v === "number"), -Infinity); if (!isFinite(out.hi!)) out.hi = null;
    out.lo = Math.min(...(q.low || []).filter((v: any) => typeof v === "number"), Infinity); if (!isFinite(out.lo!)) out.lo = null;
    out.age = isFinite(Number(m.regularMarketTime)) ? Math.max(0, Math.round(Date.now() / 1000 - Number(m.regularMarketTime))) : null;
    out.spark = closes.slice(-78);           // a full session of 5-minute closes
  } catch (e) { out.error = String((e as Error).message ?? e).slice(0, 120); }
  try {
    const x: any = await withTimeout(get("6d", "1d", 10 * 60e3), 6000, "Yahoo 5d");
    const ts: number[] = x.timestamp || [], cl: (number | null)[] = x.indicators?.quote?.[0]?.close || [];
    const rows = ts.map((t, i) => ({ t, c: cl[i] })).filter((r) => typeof r.c === "number") as { t: number; c: number }[];
    for (let i = 1; i < rows.length; i++) out.days.push({ d: new Date(rows[i].t * 1000).toLocaleDateString("en-US", { weekday: "short", timeZone: "America/New_York" }), pct: (rows[i].c - rows[i - 1].c) / rows[i - 1].c * 100 });
    out.days = out.days.slice(-5);
  } catch { /* five-day row is a nice-to-have */ }
  return out;
}
const mrPct = (q: MrQ | undefined) => q && q.pct != null && isFinite(q.pct) ? q.pct : null;
const mrF = (v: number | null, d = 2) => v == null ? "—" : `${v >= 0 ? "+" : ""}${v.toFixed(d)}%`;
export function mrVerdict(Q: Record<string, MrQ>) {
  const nq = mrPct(Q.qqq), tlt = mrPct(Q.tlt), hg = mrPct(Q.hg), btc = mrPct(Q.btc);
  const idx = [mrPct(Q.spy), mrPct(Q.qqq), mrPct(Q.dia)].filter((v): v is number => v != null);
  const avg = idx.length ? idx.reduce((a, b) => a + b, 0) / idx.length : null;
  if (nq == null || tlt == null) return { key: "none", label: "No read", tone: "none", why: "Nasdaq or bonds have no fresh price yet — nothing is guessed.", flip: "The read starts once QQQ and TLT both print." };
  if (nq <= MR_RULES.def_nq && tlt >= MR_RULES.def_tlt)
    return { key: "def", label: "Defensive", tone: "down", why: `Treasuries bought (TLT ${mrF(tlt)}) while Nasdaq is ${mrF(nq)}: money is leaving stocks for bonds. Puts, not calls. Discount every bounce.`, flip: `QQQ back above ${mrF(MR_RULES.def_nq)} on the day or TLT red turns this Neutral.` };
  const greens = [hg, btc].filter((v): v is number => v != null);
  if (nq >= MR_RULES.on_nq && tlt <= MR_RULES.on_tlt && greens.length && greens.every((v) => v > 0))
    return { key: "on", label: "Risk-on", tone: "up", why: `Treasuries sold (TLT ${mrF(tlt)}), Nasdaq ${mrF(nq)} and leading, ${hg != null && hg > 0 ? "copper" : ""}${hg != null && hg > 0 && btc != null && btc > 0 ? " and " : ""}${btc != null && btc > 0 ? "crypto" : ""} green. Calls on the leaders — let price come to you.`, flip: `Nasdaq under ${mrF(MR_RULES.on_nq)} or TLT green turns this Neutral.` };
  const soft = avg != null && avg < 0;
  return { key: soft ? "neu_soft" : "neu_firm", label: soft ? "Neutral · soft" : "Neutral · firm", tone: "flat",
    why: `${tlt < 0 ? "Bonds sold a little" : tlt > 0 ? "Bonds bid a little" : "Bonds flat"} (TLT ${mrF(tlt)}), Nasdaq ${mrF(nq)}${avg != null ? `, indexes average ${mrF(avg)}` : ""}. ${soft ? "Not the defensive pattern — discount the bounce, trade the leader's names only." : "Nothing lines up strongly either way — small size, let the first hour settle."}`,
    flip: `Defensive at Nasdaq ≤ ${MR_RULES.def_nq}% with TLT ≥ +${MR_RULES.def_tlt}%; Risk-on at Nasdaq ≥ +${MR_RULES.on_nq}% with TLT ≤ ${MR_RULES.on_tlt}% and copper/BTC green.` };
}
export function mrDislocations(Q: Record<string, MrQ>) {
  const pairs: [string, string, string][] = [["cl", "xom", "Oil vs XOM"], ["cl", "cvx", "Oil vs CVX"], ["gc", "nem", "Gold vs NEM"], ["hg", "fcx", "Copper vs FCX"]];
  const out: { label: string; a: string; b: string; a_pct: number; b_pct: number; text: string }[] = [];
  for (const [a, b, label] of pairs) {
    const pa = mrPct(Q[a]), pb = mrPct(Q[b]);
    if (pa == null || pb == null || Math.abs(pa) < MR_RULES.disloc || Math.abs(pb) < MR_RULES.disloc || Math.sign(pa) === Math.sign(pb)) continue;
    out.push({ label, a: MR_SYMS[a], b: MR_SYMS[b], a_pct: pa, b_pct: pb,
      text: `${label}: ${MR_SYMS[a]} ${mrF(pa)} but ${MR_SYMS[b]} ${mrF(pb)} — the correlation that should be there isn't. ${pa > 0 ? "Either the commodity comes down or the stock is telling you about broad weakness" : "Either the commodity bounces or the stock is running ahead"}. A candidate to look at, not a card.` });
  }
  return out;
}
// Coach rules per tile — his words from the 22 Oct 1:1 (brain v9, PB-1022-*), kept with the tile so a popup can show them.
const MR_COACH: Record<string, { rule: string; ref: string }> = {
  bonds: { rule: "Bonds first. Bonds red (rates down, price up) with stocks red = people turning defensive, a rotation. When they match, pressure in markets confirmed by the bond market: ultra defensive.", ref: "22 Oct call · PB-1022-01" },
  indexes: { rule: "Which index is performing best, left to right? Dow and Russell holding while Nasdaq is −2% = Nasdaq is the laggard. Trade the leader's names, fade the laggard.", ref: "22 Oct call · PB-1022-02" },
  oil: { rule: "Oil up but XOM down = the correlation that should be there isn't. Either oil comes down or there's broad weakness — look for puts, not calls (or a bounce trade).", ref: "22 Oct call · PB-1022-03" },
  dollar: { rule: "JPY red = the dollar is not getting stronger, it's getting weaker. A firm dollar tightens conditions; a weak yen is healthy liquidity.", ref: "22 Oct call · PB-1022-04" },
  gold: { rule: "Gold is the safe haven; copper is Dr. Copper, the indicator for expansion. Both red with stocks red = fear and no growth bid.", ref: "22 Oct call · PB-1022-05" },
  crypto: { rule: "Crypto is the store-of-value read. Green with Nasdaq = risk-on confirmed; red while stocks bounce = the bounce is suspect.", ref: "22 Oct call · PB-1022-05" },
  calendar: { rule: "Never assume you know, even if you do know. Always look for something you're missing — the calendar and the reporters tell you what moves the laggard.", ref: "22 Oct call · PB-1022-07" },
};
export function mrTiles(Q: Record<string, MrQ>, calendar: any[], session: string) {
  const q = (k: string) => Q[k] || { sym: MR_SYMS[k], price: null, pct: null, hi: null, lo: null, age: null, spark: [], days: [] };
  const tile = (k: string, label: string, main: string, sub: string, extra: any = {}) => {
    const m = q(main); return { k, label, sub, sym: m.sym, price: m.price, pct: m.pct, hi: m.hi, lo: m.lo, age: m.age, spark: m.spark, days: m.days, error: m.error || null, rule: MR_COACH[k].rule, ref: MR_COACH[k].ref, ...extra };
  };
  const tlt = mrPct(q("tlt"));
  const idx = [["spy", "S&P"], ["qqq", "Nasdaq"], ["dia", "Dow"], ["iwm", "Russell"]].map(([k, n]) => ({ k, n, pct: mrPct(q(k)), price: q(k).price })).filter((x) => x.pct != null) as { k: string; n: string; pct: number; price: number | null }[];
  const lead = idx.length ? idx.reduce((a, b) => (b.pct > a.pct ? b : a)) : null, lag = idx.length ? idx.reduce((a, b) => (b.pct < a.pct ? b : a)) : null;
  const cl = mrPct(q("cl")), xom = mrPct(q("xom")), dxy = mrPct(q("dxy")), jpy = mrPct(q("jpy")), gc = mrPct(q("gc")), hg = mrPct(q("hg")), btc = mrPct(q("btc"));
  const agree = cl != null && xom != null ? (Math.sign(cl) === Math.sign(xom) ? "agree" : "disagree") : "—";
  const next = (calendar || []).find((e) => Date.parse(e.date) > Date.now()) || null;
  return [
    tile("bonds", "1 · Bonds", "tnx", tlt == null ? "—" : tlt > 0.15 ? "bought · yield ↓" : tlt < -0.15 ? "sold · yield ↑" : "flat", { tlt: { price: q("tlt").price, pct: tlt }, yield: true }),   // v4.2.1: 10Y shown, TLT decides (Ifoma 23 Oct)
    tile("indexes", "2 · Indexes", "qqq", lead && lag && lead.k !== lag.k && lead.pct - lag.pct >= MR_RULES.lead ? `${lead.n} leads · ${lag.n} lags` : idx.length ? "moving together" : "—",
      { indexes: idx.map((x) => ({ k: x.k, n: x.n, pct: x.pct, price: x.price })), leader: lead?.n || null, laggard: lag?.n || null }),
    tile("oil", "3 · Oil vs XOM", "cl", agree, { xom: { price: q("xom").price, pct: xom }, cvx: { price: q("cvx").price, pct: mrPct(q("cvx")) } }),
    tile("dollar", "4 · Dollar", "jpy", jpy == null ? (dxy == null ? "—" : dxy > 0.1 ? "firm" : dxy < -0.1 ? "weak" : "flat") : jpy > 0.1 ? "yen weak · $ firm" : jpy < -0.1 ? "yen strong · $ weak" : "flat", { jpy: { price: q("jpy").price, pct: jpy }, dxy: { price: q("dxy").price, pct: dxy } }),   // v4.2.1: USD/JPY shown first (the coach reads JPY), DXY underneath
    tile("gold", "5 · Gold · Cu", "gc", `${gc == null ? "—" : gc > 0.3 ? "gold bid" : gc < -0.3 ? "gold sold" : "flat"} · ${hg == null ? "—" : hg > 0.3 ? "Cu up" : hg < -0.3 ? "Cu down" : "Cu flat"}`,
      { copper: { price: q("hg").price, pct: hg }, nem: { pct: mrPct(q("nem")) }, fcx: { pct: mrPct(q("fcx")) } }),
    tile("crypto", "6 · Crypto", "btc", btc == null ? "—" : btc > 0.5 ? "bid" : btc < -0.5 ? "sold" : "calm"),
    { k: "calendar", label: "Calendar", sub: session === "closed" ? "closed" : next ? (next.importance >= 1 ? "binary ahead" : "light") : "clear", sym: null, price: null, pct: null, spark: [], days: [],
      next: next ? { at: next.date, title: next.title, importance: next.importance } : null, events: (calendar || []).slice(0, 8), rule: MR_COACH.calendar.rule, ref: MR_COACH.calendar.ref },
  ];
}
export function mrLines(tiles: any[], v: any) {
  const t = (k: string) => tiles.find((x) => x.k === k) || {};
  const b = t("bonds"), i = t("indexes"), o = t("oil"), d = t("dollar"), g = t("gold"), c = t("crypto");
  return [
    `Bonds: 10Y ${b.price == null ? "—" : (+b.price).toFixed(3) + "%"} (${mrF(b.pct)}), TLT ${mrF(b.tlt?.pct ?? null)} — ${b.sub}.`,
    `Indexes: ${(i.indexes || []).map((x: any) => `${x.n} ${mrF(x.pct)}`).join(", ") || "—"}${i.leader ? ` — ${i.leader} leads, ${i.laggard} lags.` : "."}`,
    `Oil vs XOM: CL ${mrF(o.pct)}, XOM ${mrF(o.xom?.pct ?? null)} — they ${o.sub}.`,
    `Dollar: USD/JPY ${mrF(d.pct)}, DXY ${mrF(d.dxy?.pct ?? null)} — ${d.sub}.`,
    `Gold ${mrF(g.pct)} · copper ${mrF(g.copper?.pct ?? null)} — ${g.sub}.`,
    `Crypto: BTC ${mrF(c.pct)} — ${c.sub}.`,
    `Verdict: ${v.label}. ${v.why}`,
  ];
}
let MR: { at: number; body: any } | null = null;
export const marketReadForTest = (force = false) => marketRead(force);
async function marketRead(force = false) {
  if (!force && MR && Date.now() - MR.at < 10 * 60e3) return MR.body;
  const keys = Object.keys(MR_SYMS);
  const qs = await Promise.all(keys.map((k) => mrQuote(MR_SYMS[k])));
  const Q: Record<string, MrQ> = Object.fromEntries(keys.map((k, i) => [k, qs[i]]));
  const now = etParts();
  const session = ["Sat", "Sun"].includes(now.wd) ? "closed" : now.min < 570 ? "pre" : now.min < 960 ? "open" : "after";
  let calendar: any[] = [];
  try { const s = await sentimentNow(); calendar = s?.calendar || []; } catch { /* shown as unavailable */ }
  const verdict = mrVerdict(Q), tiles = mrTiles(Q, calendar, session), dislocations = mrDislocations(Q);
  const body = { ok: true, at: Date.now(), et: `${now.wd} ${fmtMin(now.min)}`, date: now.date, session, verdict, tiles, dislocations, lines: mrLines(tiles, verdict),
    fresh: qs.filter((x) => x.pct != null).length, total: qs.length, source: "Yahoo · 5-minute bars", rules: MR_RULES };
  MR = { at: Date.now(), body };
  return body;
}

/* ------------------------------------------------------------ Market (desktop) */

const MAG7 = ["NASDAQ:AAPL", "NASDAQ:MSFT", "NASDAQ:NVDA", "NASDAQ:AMZN", "NASDAQ:GOOGL", "NASDAQ:META", "NASDAQ:TSLA"];

async function marketDesk() {
  const now = etParts();
  const [sent, mag, week, earn, wl] = await Promise.all([
    settle(sentimentNow()),
    settle(quotesFor(MAG7)),
    settle(econEvents(now.date, addDays(now.date, 7), 0)),
    settle(earningsMap()),
    settle((async () => mcpJson(await call("tv", "mcp-watchlist-get-active-watchlist", {}))?.watchlist)()),
  ]);
  const watch: string[] = wl.ok ? (wl.v?.symbols || []) : [];
  const upcoming = earn.ok ? watch.map((s) => ({ sym: s, date: earn.v[s.split(":")[1]] })).filter((x) => x.date && x.date.slice(0, 10) <= addDays(now.date, 14)) : [];
  return {
    ok: true,
    sentiment: sent.ok ? sent.v : { error: sent.error },
    mag7: mag.ok ? MAG7.map((s) => ({ sym: s, ...(mag.v[s] || {}) })) : { error: mag.error },
    calendar_week: week.ok ? week.v : { error: week.error },
    earnings: earn.ok ? upcoming : { error: earn.error },
    watchlist: wl.ok ? { name: wl.v?.name, n: watch.length } : null,
  };
}

/* ------------------------------------------------------------ rule check */

// v3.39: Jarvis never says something false. Every "X is above / below Y" in a position check is checked against the two numbers in
// the sentence; a wrong one gets a server correction under the text (16 Oct: "stock is at 64.67, well below the wrong-if of 64.30").
export function numberCheck(text: string): string {
  const bad: string[] = [];
  const re = /\$?(\d{1,5}(?:\.\d{1,4})?)\b(?:(?!\d)[^.\n]){0,60}?\b(well |far |just |slightly |still )?(above|below|over|under)\b(?:(?!\d)[^.\n]){0,60}?\$?(\d{1,5}(?:\.\d{1,4})?)\b/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const a = Number(m[1]), b = Number(m[4]), w = m[3].toLowerCase();
    if (!(a > 0) || !(b > 0) || a === b) continue;
    if (Math.abs(Math.log10(a / b)) > 0.7) continue;                           // different things (a price vs a % or a $ P&L)
    const saysAbove = w === "above" || w === "over";
    if ((saysAbove && a < b) || (!saysAbove && a > b)) bad.push(`${m[1]} is ${a > b ? "ABOVE" : "BELOW"} ${m[4]}, not ${w} it`);
  }
  return bad.length ? text + "\n\n⚠ Fact check (server): " + [...new Set(bad)].join("; ") + ". Read the numbers, not the words." : text;
}

// v3.39 (Ifoma, 18 Oct): one rule for Josh this week, BLOCKING — no long while the stock AND SPY are below VWAP. Pure.
export function vwapOf(bars: Bar[] | null, now = Date.now()): number | null {
  if (!bars || !bars.length) return null;
  const done = bars.filter((b) => b.t + 5 * 60e3 <= now && [b.o, b.h, b.l, b.c].every((v) => v > 0));
  if (done.length < 2) return null;
  let pv = 0, v = 0; for (const b of done) { const w = Number((b as any).v) > 0 ? Number((b as any).v) : 1; pv += w * (b.h + b.l + b.c) / 3; v += w; }
  return v ? pv / v : null;
}
export function vwapBlock(dir: number, tk: string, tkBars: Bar[] | null, spyBars: Bar[] | null, now = Date.now()): string | null {
  if (dir <= 0) return null;                                                  // longs only (Winston's W23 is the mirror for shorts)
  const tv = vwapOf(tkBars, now), sv = vwapOf(spyBars, now);
  const last = (bars: Bar[] | null) => { const d = (bars || []).filter((b) => b.t + 5 * 60e3 <= now && b.c > 0); return d.length ? d[d.length - 1].c : null; };
  const tp = last(tkBars), sp = last(spyBars);
  if (tv == null || sv == null || tp == null || sp == null) return null;      // no data = no block (flag-never-block stays the default)
  if (tp < tv && sp < sv) return `${tk} ${tp.toFixed(2)} is below its VWAP ${tv.toFixed(2)} and SPY ${sp.toFixed(2)} is below its VWAP ${sv.toFixed(2)} — no longs while both are under VWAP (this week's one rule)`;
  return null;
}

// v3.37 "Did you chase?" (the coach, 15 Oct 2026: "You lost your money because of bad entry, not bounces. Let price come to you.")
// Pure: the entry vs the level the idea is built on, and the entry vs the session VWAP. Returns check rows; never blocks.
export function chaseChecks(plan: any, bars: Bar[] | null, now = Date.now()): { ok: boolean | null; text: string }[] {
  const out: { ok: boolean | null; text: string }[] = [];
  const dir = plan?.direction === "down" ? -1 : plan?.direction === "up" ? 1 : 0;
  const px = Number(plan?.entry_underlying), lvl = Number(plan?.level);
  if (!dir || !(px > 0)) return out;
  if (lvl > 0) {
    const past = (px - lvl) * dir;                                   // how far the entry is beyond the level in the trade's direction
    const pct = past / lvl * 100;
    if (past > 0 && pct >= 0.25) out.push({ ok: false, text: `Entry ${px} is $${past.toFixed(2)} (${pct.toFixed(2)}%) past the ${lvl} level — chasing. The coach's entry is the retest of ${lvl} that holds.` });
    else if (past > 0) out.push({ ok: true, text: `Entry ${px} is $${past.toFixed(2)} past the ${lvl} level — at the level, not chasing` });
    else out.push({ ok: null, text: `Entry ${px} is ${dir > 0 ? "below" : "above"} the ${lvl} level — early: the level has not confirmed yet` });
  }
  if (bars && bars.length) {
    const done = bars.filter((b) => b.t + 5 * 60e3 <= now && [b.o, b.h, b.l, b.c].every((v) => v > 0));
    if (done.length >= 2) {
      let pv = 0, v = 0; for (const b of done) { const w = Number((b as any).v) > 0 ? Number((b as any).v) : 1; pv += w * (b.h + b.l + b.c) / 3; v += w; }   // Robinhood bars carry no volume: a plain typical-price average then
      const vwap = v ? pv / v : 0;
      if (vwap > 0) {
        const above = px > vwap, withTrade = dir > 0 ? above : !above;
        const last = done.slice(-3).map((b) => b.c), slope = last.length === 3 ? (last[2] > last[0] ? "rising" : last[2] < last[0] ? "falling" : "flat") : "flat";
        out.push({ ok: withTrade, text: `VWAP ${vwap.toFixed(2)}: price ${above ? "above" : "below"} it, closes ${slope} — ${withTrade ? "with" : "against"} a ${dir > 0 ? "long" : "short"}` });
      }
    }
  }
  return out;
}

export async function ruleChecks(out: any[], plan: any, risk: any, banner: any) {
  const checks: any[] = [];
  const add = (ok: boolean | null, text: string) => checks.push({ ok, text });
  const open = out.find((c) => c.tool === "place_option_order" && (c.args.legs || []).some((l: any) => l.position_effect === "open"));
  if (!open) return checks;
  const now = etParts();
  // v3.37: did you chase? (the level the card is built on + the session VWAP from today's 5-minute bars)
  try {
    const tk0 = String(plan?.tv_symbol || "").split(":").pop() || "";
    let bars0: Bar[] | null = null;
    if (tk0 && plan?.entry_underlying > 0 && now.min >= 570) {
      const st = nyIso(now.date, "9:30 AM");
      if (st) bars0 = (await withTimeout(rhBars([tk0], "5minute", st), 6000, "chase bars"))[tk0.toUpperCase()] || null;
    }
    for (const c of chaseChecks(plan, bars0)) checks.push(c);
  } catch { /* the chase read is a help, never a blocker */ }
  if (["Sat", "Sun"].includes(now.wd) || now.min < 570 || now.min >= 960) add(null, "Market closed now: this waits for the open (no entries in the first 30 minutes unless the open goes off a pre-posted Signal level)");
  else if (now.min < 600) {
    // House Rule (6 Oct): the open is fair game when price opens on / pushes off a Signal level posted before the open.
    if (plan?.signal_level === true) add(null, "Inside the first 30 minutes: OK by the House Rule (a pre-posted Signal level the open went off)");
    else add(false, "Inside the first 30 minutes (Otto Rules: wait until 10:00 unless the open goes off a pre-posted Signal level)");
  }
  else add(true, `Past the first 30 minutes (${fmtMin(now.min)} ET)`);

  const leg = open.args.legs.find((l: any) => l.position_effect === "open");
  let q: any = null, ins: any = null;
  try { ins = (mcpJson(await call("rh", "get_option_instruments", { ids: leg.option_id }))?.data?.instruments || [])[0] || null; } catch { /* */ }
  try { q = (mcpJson(await call("rh", "get_option_quotes", { instrument_ids: [leg.option_id] }))?.data?.results || [])[0]?.quote || null; } catch { /* */ }
  if (q?.delta != null) { const d = Math.abs(Number(q.delta)); add(d >= 0.30 && d <= 0.40, `Delta ${d.toFixed(2)} (Otto Rules: 0.30–0.40)`); }
  else add(null, "Delta: couldn't read the quote");
  if (q?.volume != null && q?.open_interest != null) add(Number(q.volume) > Number(q.open_interest), `Volume ${q.volume} vs open interest ${q.open_interest} (Otto Rules: volume > OI)`);
  else add(null, "Volume vs open interest: not available");
  if (risk?.pct != null) add(risk.pct <= (risk.warn_pct || 20) / 100, `${Math.round(risk.pct * 100)}% of the account (flag above ${risk.warn_pct || 20}%)`);
  else add(null, "Size vs account: unknown (no limit price)");

  const exp = ins?.expiration_date || null;
  if (exp) {
    const days = dayDiff(now.date, exp);
    if (days <= 0) add(false, "Expires today (0DTE)");
    else if (["Thu", "Fri"].includes(now.wd) && exp === fridayOf(now.date)) add(false, "This Friday's expiry after Wednesday (Otto Rules: use next week's)");
    else add(true, `Expiry ${exp} (${days} day${days === 1 ? "" : "s"})`);
    try {
      const ev = (await econEvents(now.date, exp, 1)).filter((e) => Date.parse(e.date) > Date.now());
      if (ev.length) add(false, `Binary event before expiry: ${ev.slice(0, 2).map((e) => `${e.title} ${etLabel(e.date)}`).join(", ")}`);
      else add(true, "No high-impact release before expiry");
    } catch { add(null, "Economic calendar: not available"); }
    const tk = String(plan?.tv_symbol || ins?.chain_symbol || "").split(":").pop();
    if (tk) {
      try {
        const e = (await earningsMap())[tk];
        if (e && e.slice(0, 10) <= exp) add(false, `${tk} reports earnings ${e}, before expiry`);
        else add(true, e ? `${tk} earnings ${e}, after expiry` : `No ${tk} earnings in the next 2 months`);
      } catch { add(null, "Earnings: couldn't check"); }
    }
  }
  if (banner?.verdict) {
    const v = banner.verdict;
    if (/choppy/i.test(v)) add(false, "Banner says choppy: scalp only, small");
    else if (plan?.direction && ((/long/i.test(v) && plan.direction === "down") || (/short/i.test(v) && plan.direction === "up"))) add(false, `Against the banner (${v})`);
    else add(true, `Banner: ${v}`);
  }
  return checks;
}

/* ------------------------------------------------------------ journal (auto-filled) */

async function allAccounts(): Promise<any[]> {
  return cached("accounts", 30 * 60e3, async () => {
    const j = mcpJson(await call("rh", "get_accounts", {}));
    return (j?.data?.accounts || []).filter((a: any) => a.account_number && !a.deactivated)
      .map((a: any) => ({ n: String(a.account_number), agentic: a.agentic_allowed === true,
        label: `${a.agentic_allowed ? "Agentic" : (a.nickname || "Individual")} ${mask(a.account_number)}` }));
  });
}

async function syncJournal(force = false) {
  if (!force && CACHE.journalSync && Date.now() - CACHE.journalSync.at < 2 * 60e3) return;
  CACHE.journalSync = { at: Date.now(), v: true };
  const since = addDays(etParts().date, -120);
  const fills: any[] = [];
  for (const a of await allAccounts()) {
    let cursor: string | undefined;
    for (let page = 0; page < 8; page++) {
      let j: any;
      try { j = mcpJson(await call("rh", "get_option_orders", { account_number: a.n, state: "filled", created_at_gte: since, ...(cursor ? { cursor } : {}) })); }
      catch { break; }
      for (const o of j?.data?.orders || []) {
        for (const l of o.legs || []) {
          for (const x of l.executions || []) {
            fills.push({ acct: a.label, order_id: o.id, agent: o.placed_agent, option_id: l.option_id, sym: o.chain_symbol,
              strike: Number(l.strike_price), type: l.option_type, exp: l.expiration_date, side: l.side, effect: l.position_effect,
              price: Number(x.price), qty: Number(x.quantity), ts: x.timestamp, mult: Number(o.trade_value_multiplier) || 100 });
          }
        }
      }
      cursor = j?.data?.next || j?.next || undefined;
      if (!cursor) break;
    }
  }
  fills.sort((a, b) => a.ts.localeCompare(b.ts));
  const trades: Record<string, any> = {};
  const lots: Record<string, any[]> = {};
  for (const f of fills) {
    const k = f.acct + "|" + f.option_id;
    if (f.effect === "open") {
      const id = (f.acct + "|" + f.option_id + "|" + f.order_id).replace(/\s/g, "");
      const t = trades[id] ||= { id, account: f.acct, symbol: f.sym, option_id: f.option_id,
        contract: `${f.sym} ${f.strike % 1 ? f.strike : Math.round(f.strike)}${f.type === "put" ? "P" : "C"} ${f.exp.slice(5).replace("-", "/")}`,
        exp: f.exp, side: f.side === "buy" ? "long" : "short", qty: 0, entry_cost: 0, exit_value: 0, closed_qty: 0,
        opened_at: f.ts, closed_at: null, open_order_id: f.order_id, agent: f.agent, mult: f.mult };
      t.qty += f.qty; t.entry_cost += f.price * f.qty;
      (lots[k] ||= []).push({ id, left: f.qty });
    } else {
      let left = f.qty;
      for (const lot of lots[k] || []) {
        if (left <= 0) break;
        const take = Math.min(lot.left, left); if (take <= 0) continue;
        lot.left -= take; left -= take;
        const t = trades[lot.id]; t.exit_value += f.price * take; t.closed_qty += take; t.closed_at = f.ts;
      }
    }
  }
  const today = etParts().date;
  const rows = Object.values(trades).map((t: any) => {
    let status = t.closed_qty >= t.qty ? "closed" : t.closed_qty > 0 ? "partial" : "open";
    if (status !== "closed" && t.exp < today) {            // expired worthless: the rest closes at 0
      t.closed_qty = t.qty; status = "expired"; t.closed_at = t.closed_at || t.exp + "T20:00:00Z";
    }
    const entry = t.entry_cost / t.qty;
    const exit = t.closed_qty ? t.exit_value / t.closed_qty : null;
    const pnl = t.closed_qty ? (t.side === "long" ? 1 : -1) * (t.exit_value - entry * t.closed_qty) * t.mult : null;
    return { id: t.id, account: t.account, symbol: t.symbol, contract: t.contract, option_id: t.option_id, side: t.side,
      qty: t.qty, entry: +entry.toFixed(4), exit: exit == null ? null : +exit.toFixed(4), pnl: pnl == null ? null : +pnl.toFixed(2),
      opened_at: t.opened_at, closed_at: status === "open" ? null : t.closed_at, status, open_order_id: t.open_order_id,
      agent: t.agent, updated_at: new Date().toISOString(), action_id: null as string | null };
  });
  if (!rows.length) return;
  // link to the Desk card that placed it
  try {
    const acts = await db("otto_actions?" + OQ() + "select=id,order_id&order_id=not.is.null&order=created_at.desc&limit=300");
    const byOrder: Record<string, string> = Object.fromEntries(acts.map((a: any) => [a.order_id, a.id]));
    rows.forEach((r: any) => { r.action_id = byOrder[r.open_order_id] || null; });
  } catch { /* unlinked rows keep action_id null */ }
  // v3.39: PostgREST rejects a batch whose rows have different key sets (PGRST102 "All object keys must match") —
  // from ~5 Oct every sync failed because only card-linked rows had action_id. Now every row is born with the key.
  for (let i = 0; i < rows.length; i += 200) {
    await db("otto_trades?on_conflict=id", { method: "POST", headers: { prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify(rows.slice(i, i + 200)) });
  }
}

async function journal(force = false) {
  let syncErr: string | null = null;
  try { await syncJournal(force); } catch (e) { syncErr = (e as Error).message; }
  const rows = await db("otto_trades?select=*&order=opened_at.desc&limit=200");
  const ids = [...new Set(rows.map((r: any) => r.action_id).filter(Boolean))];
  const acts = ids.length ? await db("otto_actions?select=*&id=in.(" + ids.join(",") + ")") : [];
  return { ok: true, rows, actions: acts.map(publicAction), sync_error: syncErr };
}

/* ------------------------------------------------------------ weekly review */

function postHocChecks(t: any, a: any) {
  if (a?.checks?.length) return a.checks;
  const p = etParts(new Date(t.opened_at));
  return [p.min >= 570 && p.min < 600 ? { ok: false, text: "Opened inside the first 30 minutes" } : { ok: true, text: "Not in the first 30 minutes" }];
}

async function weeklyReview(apiKey: string, who = "Jarvis") {
  await syncJournal(true);
  const now = etParts();
  const ws = ["Sat", "Sun"].includes(now.wd) ? mondayOf(addDays(now.date, -2)) : mondayOf(now.date);
  const we = addDays(ws, 4);
  const all = await db("otto_trades?select=*&order=closed_at.desc&limit=400");
  const wk = all.filter((t: any) => t.pnl != null && t.closed_at && etParts(new Date(t.closed_at)).date >= ws && etParts(new Date(t.closed_at)).date <= we);
  const ids = [...new Set(wk.map((t: any) => t.action_id).filter(Boolean))];
  const acts = ids.length ? await db("otto_actions?select=*&id=in.(" + ids.join(",") + ")") : [];
  const actBy: Record<string, any> = Object.fromEntries(acts.map((a: any) => [a.id, a]));
  const items: any[] = wk.map((t: any) => ({ id: t.id, contract: t.contract, account: t.account, pnl: t.pnl, opened: t.opened_at, closed: t.closed_at,
    status: t.status, reason: t.reason || null, from_card: !!t.action_id, setup: actBy[t.action_id]?.plan?.setup || null,
    banner: actBy[t.action_id]?.banner?.verdict || null, checks: postHocChecks(t, actBy[t.action_id]) }));
  const wins = items.filter((t) => t.pnl > 0).sort((a, b) => b.pnl - a.pnl).slice(0, 5);
  const losses = items.filter((t) => t.pnl < 0).sort((a, b) => a.pnl - b.pnl).slice(0, 5);
  const total = items.reduce((s, t) => s + t.pnl, 0);

  let pattern = "", one_thing = "", rules: any[] = [];
  if (items.length) {
    const calls = await loadBrain();
    const cs = chunksOf(calls);
    const seen = new Set<string>(); const hits: Chunk[] = [];
    for (const q of ["resistance support entry rejection bounce rates", "first 30 minutes gap trap", "size account percent", "exit entry candle runner TP1"])
      for (const h of search(cs, q, 6)) { const k = h.d + h.at + h.s.slice(0, 40); if (!seen.has(k)) { seen.add(k); hits.push(h); } }
    const sys = `You are Jarvis, writing Ifoma's Friday trade review on the Otto desk: direct, numbers first, no hype. Judge each trade against Jason Murray's method (material below). Cite Jason as (call date, MM:SS) only from the material given. Never invent a rule. Respond with JSON only: {"pattern": "2-4 sentences on what the winners and losers have in common", "one_thing": "one concrete thing to do differently next week", "rules": [{"rule": "short rule name", "followed": n, "broken": n}]}.\n\nJASON'S RULES:\n${alwaysOn(calls)}\n\nMATERIAL:\n${hits.slice(0, 18).map(fmt).join("\n\n")}`;
    const r = await aiFetch("weekly_review", {
      method: "POST", headers: { "content-type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: await roomModel(), max_tokens: 1500, system: sys + NAME_RULE,
        messages: [{ role: "user", content: `Week of ${ws}. Closed trades (P&L in $):\n${JSON.stringify(items, null, 1).slice(0, 40000)}` }] }),
    });
    const j = await r.json();
    const txt = (j.content || []).filter((c: any) => c.type === "text").map((c: any) => c.text).join("");
    try { const p = JSON.parse(txt.slice(txt.indexOf("{"), txt.lastIndexOf("}") + 1)); pattern = p.pattern || ""; one_thing = p.one_thing || ""; rules = p.rules || []; }
    catch { pattern = txt.slice(0, 1200); }
  } else {
    pattern = "No closed trades this week.";
  }
  const coach = await withTimeout(coachReport(), 60_000, "coach report").catch(() => null);   // v3.26: the Coach report card
  const payload = { week_start: ws, week_end: we, total: +total.toFixed(2), n: items.length, wins, losses, pattern, one_thing, rules,
    missing_reasons: items.filter((t) => !t.reason).length, coach };
  await db("otto_reviews?on_conflict=week_start", { method: "POST", headers: { prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify({ week_start: ws, payload, built_by: who, created_at: new Date().toISOString() }) });
  await logDesk("system", "Otto", `Weekly review for the week of ${ws} is ready (Review tab): ${items.length} closed trade${items.length === 1 ? "" : "s"}, ${total >= 0 ? "+" : "−"}$${Math.abs(total).toFixed(2)}.${one_thing ? " Next week: " + one_thing : ""}`);
  return payload;
}

/* ------------------------------------------------------------ v3.37: the weekly trade log for the coach
   The coach (15 Oct 2026, 37:52): "document every trade that you take and send to me at the end of the week — entries, exits, levels,
   VWAP/EMAs, the overnight decision — organized so I can read it." Built from three sources: live fills (otto_trades), practice trades
   Josh approved (otto_actions paper_taken, v3.35) and trades he logged himself through Jarvis (otto_activity practice_log). Posted on the
   Desk Friday after the weekly review and kept in otto_settings.coach_log; ?fn=coach_log returns it any time (&build=1 rebuilds). */
export type LogItem = { day: string; who: string; source: string; ticker: string; contract: string; side: string; entry: number | null; exit: number | null; pnl: number | null;
  entry_time: string; exit_time: string; level: number | null; vwap: number | null; why: string; overnight: string; note?: string };
/* v4.2.3 fix 2: a rule-scored practice trade can be a "win" by its own rule (TP1 at the card price) while Josh's fill lost money
   (NVDA 215P 20 Oct: "Result −$29 … scored win (0.37R)"). Say both, never a bare "scored win" next to a negative result.
   fix 7: a card that never had a real contract (no option_id) is an estimate on the underlying — say so. */
export function practiceNote(o: any): string | undefined {
  if (!o || !o.state || o.state === "pending") return undefined;
  const r = o.r != null ? ` (${o.r}R)` : "";
  const est = o.pnl_est != null ? Number(o.pnl_est) : null;
  const tag = o.est_no_contract ? " · est. (no contract)" : "";
  if (est != null && ((o.state === "win" && est < 0) || (o.state === "loss" && est > 0)))
    return `scored by its rule at the card price: ${o.state}${r}; at your fill: ${est < 0 ? "−" : "+"}$${Math.abs(Math.round(est))}${tag}`;
  return `scored ${o.state}${r}${tag}`;
}
export function coachLogText(weekStart: string, weekEnd: string, items: LogItem[], extra: { account_start?: number | null; ranges?: string; working?: string } = {}): string {
  const L: string[] = [];
  const money = (n: number | null) => n == null ? "n/a" : `${n >= 0 ? "+" : "-"}$${Math.abs(n).toFixed(0)}`;
  const total = items.reduce((s, t) => s + (t.pnl || 0), 0), scored = items.filter((t) => t.pnl != null);
  L.push(`TRADE LOG — week of ${weekStart} to ${weekEnd} (Josh)`);
  L.push(`${items.length} trade${items.length === 1 ? "" : "s"} · ${scored.filter((t) => (t.pnl || 0) > 0).length} wins / ${scored.filter((t) => (t.pnl || 0) < 0).length} losses · net ${money(total)}${extra.account_start ? ` · account start $${extra.account_start}` : ""}`);
  if (extra.ranges) L.push(`Levels watched this week: ${extra.ranges}`);
  L.push("");
  const byDay: Record<string, LogItem[]> = {};
  for (const t of items) (byDay[t.day] ||= []).push(t);
  for (const day of Object.keys(byDay).sort()) {
    L.push(`${day}`);
    for (const t of byDay[day]) {
      L.push(`  ${t.ticker} ${t.contract} ${t.side.toUpperCase()} (${t.source})`);
      L.push(`    Entry: ${t.entry_time || "?"} @ ${t.entry ?? "?"}    Exit: ${t.exit_time || (t.exit == null ? "open" : "?")} @ ${t.exit ?? "—"}    Result: ${money(t.pnl)}`);
      L.push(`    Level: ${t.level ?? "none marked"}    VWAP at entry: ${t.vwap ?? "n/a"}    Overnight: ${t.overnight}`);
      L.push(`    Why: ${t.why || "(no reason written)"}${t.note ? "    Note: " + t.note : ""}`);
    }
    L.push("");
  }
  if (!items.length) L.push("No trades this week.", "");
  if (extra.working) L.push(`Working on (from this week's pop quizzes): ${extra.working}`, "");
  L.push("Every trade was day-only unless marked. Levels are the coach's or the Watcher's marks for that day; VWAP is the session VWAP at the entry time (5-minute bars).");
  return L.join("\n");
}
async function vwapAt(tk: string, day: string, atMs: number): Promise<number | null> {
  try {
    const st = nyIso(day, "9:30 AM"); if (!st) return null;
    const bars = (await withTimeout(rhBars([tk], "5minute", st, new Date(atMs).toISOString()), 8000, "vwap bars"))[tk.toUpperCase()] || [];
    const done = bars.filter((b) => b.t + 5 * 60e3 <= atMs && b.c > 0);
    if (!done.length) return null;
    return Math.round(done.reduce((s, b) => s + (b.h + b.l + b.c) / 3, 0) / done.length * 100) / 100;
  } catch { return null; }
}
export async function coachLog(build = false): Promise<{ week_start: string; week_end: string; text: string; built_at: string; n: number }> {
  if (!build) { const have = await setting("coach_log").catch(() => null); if (have?.text) return have; }
  const now = etParts();
  const ws = ["Sat", "Sun"].includes(now.wd) ? mondayOf(addDays(now.date, -2)) : mondayOf(now.date), we = addDays(ws, 4);
  const inWeek = (iso: string | null) => { if (!iso) return false; const d = etParts(new Date(iso)).date; return d >= ws && d <= we; };
  const items: LogItem[] = [];
  const t12 = (iso: string | null) => iso ? fmtMin(etParts(new Date(iso)).min) : "";
  // 1. live fills (Robinhood, synced into the Journal)
  try { await syncJournal(true); } catch { /* use what is there */ }
  const trades: any[] = (await db("otto_trades?select=*&order=opened_at.asc&limit=300").catch(() => [])) || [];
  const live = trades.filter((t) => inWeek(t.opened_at));
  const ids = [...new Set(live.map((t) => t.action_id).filter(Boolean))];
  const acts: any[] = ids.length ? await db("otto_actions?select=id,plan,summary&id=in.(" + ids.join(",") + ")").catch(() => []) : [];
  const actBy: Record<string, any> = Object.fromEntries(acts.map((a: any) => [a.id, a]));
  for (const t of live) {
    const a = actBy[t.action_id], p = a?.plan || {}, tk = String(t.symbol || String(p.tv_symbol || "").split(":").pop() || "");
    const od = etParts(new Date(t.opened_at)).date, cd = t.closed_at ? etParts(new Date(t.closed_at)).date : null;
    items.push({ day: od, who: "Josh", source: "LIVE · " + (t.agent === "agentic" ? "Otto card" : "manual"), ticker: tk, contract: String(t.contract || ""), side: String(t.side || "long"),
      entry: t.entry != null ? Number(t.entry) : null, exit: t.exit != null ? Number(t.exit) : null, pnl: t.pnl != null ? Number(t.pnl) : null,
      entry_time: t12(t.opened_at), exit_time: t12(t.closed_at), level: p.level ?? p.stop ?? null, vwap: tk ? await vwapAt(tk, od, Date.parse(t.opened_at)) : null,
      why: String(t.reason || (a?.summary || "").split("\n")[0] || "").slice(0, 200), overnight: cd && cd !== od ? "HELD OVERNIGHT (" + cd + ")" : "no (day trade)" });
  }
  // 2. practice trades Josh approved (v3.35)
  const prac: any[] = (await db("otto_actions?" + OQ() + "select=id,title,created_at,decided_at,decided_by,plan,outcome,summary&status=eq.paper_taken&order=created_at.asc&limit=200").catch(() => [])) || [];
  for (const a of prac.filter((a) => inWeek(a.decided_at || a.created_at) && !a.plan?.duplicate_of)) {   // v4.2.3 fix 1: a voided twin is not a trade
    const p = a.plan || {}, pf = p.paper_fill || {}, o = a.outcome || {}, tk = String(p.tv_symbol || "").split(":").pop() || "";
    const at = pf.at || a.decided_at || a.created_at, od = etParts(new Date(at)).date;
    items.push({ day: od, who: String(a.decided_by || "Josh"), source: o.practice_close ? "PRACTICE · approved on Otto, closed by hand" : "PRACTICE · approved on Otto", ticker: tk, contract: String(a.title || "").replace(/^(PAPER|PRACTICE|LIVE)\s*[—-]\s*/i, "").slice(0, 40), side: p.direction === "down" ? "short" : "long",
      entry: pf.ask != null ? Number(pf.ask) : null, exit: o.practice_close && o.exit_px != null ? Number(o.exit_px) : null, pnl: o.pnl_est != null ? Number(o.pnl_est) : null, entry_time: t12(at), exit_time: o.practice_close ? t12(o.closed_at) : o.state && o.state !== "pending" ? "(scored by rule)" : "",
      level: p.level ?? p.stop ?? null, vwap: tk ? await vwapAt(tk, od, Date.parse(at)) : null, why: String(a.summary || "").split("\n")[0].slice(0, 200), overnight: "no (practice, same day)",
      note: practiceNote(o) });   // v4.2.3 fix 2 + 7
  }
  // 3. trades Josh logged himself through Jarvis
  const logs: any[] = (await db(`otto_activity?select=day,at,who,data&kind=eq.trade&day=gte.${ws}&day=lte.${we}&order=at.asc&limit=100`).catch(() => [])) || [];
  for (const r of logs) {
    const d = r.data?.practice_log; if (!d) continue;
    items.push({ day: r.day, who: String(r.who || "Josh"), source: "OWN · " + (d.platform || "outside Otto"), ticker: d.ticker, contract: d.contract || "", side: d.side || "long", entry: d.entry ?? null, exit: d.exit ?? null, pnl: d.pnl ?? null,
      entry_time: d.entry_time || "", exit_time: d.exit_time || "", level: d.level ?? null, vwap: null, why: d.why || "", overnight: d.exit == null ? "open at log time" : "no (as logged)" });
  }
  items.sort((a, b) => a.day.localeCompare(b.day) || a.entry_time.localeCompare(b.entry_time));
  let ranges = "";
  try { const w: any[] = (await db(`otto_watch?select=ticker,level,day&day=gte.${ws}&day=lte.${we}&order=day.asc&limit=60`).catch(() => [])) || []; ranges = w.slice(0, 20).map((x) => `${x.ticker} ${x.level} (${x.day.slice(5)})`).join(", "); } catch { /* */ }
  let working = "";
  try { const qh: any[] = ((await setting("quiz_history"))?.rows || []).filter((r: any) => r.day >= ws && r.day <= we).slice(0, 5);
    const weak = qh.map((r: any) => r.weakest).filter(Boolean); if (weak.length) { const c: Record<string, number> = {}; for (const w of weak) c[w] = (c[w] || 0) + 1; working = Object.entries(c).sort((a, b) => b[1] - a[1])[0][0]; } } catch { /* */ }
  const text = coachLogText(ws, we, items, { ranges, working });
  const out = { week_start: ws, week_end: we, text, built_at: new Date().toISOString(), n: items.length };
  await putSetting("coach_log", out, "Otto").catch(() => {});
  return out;
}

/* ------------------------------------------------------------ v3.41: the FRIDAY REPORT CARD (decided 18 Oct, mockup v341-why-gate.html panel 4)
   Posted on the Desk right after the 4:30 coach log. Built from Robinhood fills (otto_trades), every card Josh was asked to answer
   this week (otto_actions), the why fields, and the coach's posts — never from Jarvis's chat text. One Anthropic call writes the
   "one rule for next week" and two lines of comment from those numbers; if it fails, the rule is the standing one.
   Grade (Ifoma to confirm): 40% answered ÷ offered, 30% whys that name a level AND a kill, 30% last week's rule followed. */
export const REPORT_RULE_DEFAULT = "Answer every card — Approve or Reject with your why. Silence is the only wrong answer.";
export function letterGrade(parts: { answered: number; offered: number; good_whys: number; whys: number; rule_followed: boolean | null; homework?: number | null }) {
  const a = parts.offered ? parts.answered / parts.offered : 1;
  const w = parts.whys ? parts.good_whys / parts.whys : (parts.offered ? 0 : 1);
  const r = parts.rule_followed == null ? 0.5 : parts.rule_followed ? 1 : 0;
  // v3.45: homework (nights handed in on time; late = half) is 20% once there is a night to count; the other three keep their 40/30/30 shape.
  const h = parts.homework == null ? null : Math.max(0, Math.min(1, parts.homework));
  const score = Math.round((h == null ? 0.4 * a + 0.3 * w + 0.3 * r : 0.32 * a + 0.24 * w + 0.24 * r + 0.2 * h) * 100);
  const letter = score >= 93 ? "A" : score >= 87 ? "A−" : score >= 80 ? "B+" : score >= 73 ? "B" : score >= 67 ? "B−" : score >= 60 ? "C+" : score >= 50 ? "C" : score >= 40 ? "D" : "F";
  return { score, letter };
}
/* a why is "good" when it names a price level and a kill (both carry a number or a named level word) */
export function goodWhy(w: any): boolean {
  if (!w) return false;
  const num = (t: unknown) => /\d/.test(String(t || "")) || /\b(vwap|orb|gap|level|support|resistance|wrong-if|stop)\b/i.test(String(t || ""));
  if (w.why_not) return num(w.why_not) || String(w.why_not).length >= 25;
  return num(w.setup) && num(w.kills);
}
export async function reportCard(apiKey: string, build = false): Promise<any> {
  if (!build) { const have = await setting("report_card_last").catch(() => null); if (have?.text) return have; }
  const now = etParts();
  const ws = ["Sat", "Sun"].includes(now.wd) ? mondayOf(addDays(now.date, -2)) : mondayOf(now.date), we = addDays(ws, 4);
  const inWeek = (iso: string | null) => { if (!iso) return false; const d = etParts(new Date(iso)).date; return d >= ws && d <= we; };
  const prev = await setting("report_card_last").catch(() => null);
  const lastRule = String(prev?.rule || REPORT_RULE_DEFAULT);
  const book = await practiceBook().catch(() => PRACTICE_BOOK_DEFAULT);
  const acts: any[] = (await db("otto_actions?" + OQ() + "select=*&created_at=gte." + ws + "T00:00:00Z&order=created_at.asc&limit=400").catch(() => [])) || [];
  const cards = acts.filter((a) => inWeek(a.created_at) && isPracticeCard(a) && (!book.since || Date.parse(a.created_at) >= Date.parse(book.since)));
  const st = practiceStats(cards, { start: book.start, since: book.since || ws + "T00:00:00Z" });
  const whyRows = cards.filter((a) => a.plan?.josh_why || a.plan?.josh_reject_why).map((a) => a.plan.josh_why || a.plan.josh_reject_why);
  const good = whyRows.filter(goodWhy).length;
  // live trades (Robinhood, synced)
  try { await syncJournal(true); } catch { /* use what is there */ }
  const trades: any[] = ((await db("otto_trades?select=*&order=opened_at.asc&limit=300").catch(() => [])) || []).filter((t: any) => inWeek(t.opened_at));
  const livePnl = Math.round(trades.reduce((s, t) => s + (t.pnl != null ? Number(t.pnl) : 0), 0));
  const liveActs = acts.filter((a) => a.status === "done" && (a.calls || []).some((c: any) => c.tool === "place_option_order" && (c.args?.legs || []).some((l: any) => l.position_effect === "open")));
  const ov = acts.filter((a) => a.plan?.override && (a.status === "done" || a.status === "paper_taken") && !a.plan?.duplicate_of);   // v4.2.3 fix 1
  // the coach's calls this week vs what was taken
  const posts: any[] = (await db(`otto_jason?select=id,day,ticker,direction,kind&day=gte.${ws}&day=lte.${we}&order=id.asc&limit=200`).catch(() => [])) || [];
  const calls = posts.filter((p) => p.kind === "call" && p.direction && p.ticker);
  const tookCoach = acts.filter((a) => (a.plan?.origin === "coach_call") && (a.status === "done" || a.status === "paper_taken")).length;
  const hk = await hkWeek(ws, we).catch(() => null);   // v3.45: the week's homework (Josh)
  // last week's rule followed? the model judges from the numbers; a plain default is used when the call fails
  const facts = { week: `${ws} to ${we}`, practice_book: st, live: { trades: trades.length, pnl: livePnl, cards_taken: liveActs.length },
    expired: st.expired, scored_cards: st.answered,   // v4.2.3 fix 4: the model sees expired cards as their own number
    overrides: ov.map((a) => ({ title: practiceLabel(a.title), read: String(a.plan.override_read || "").slice(0, 120), result: a.outcome?.state || null, est: a.outcome?.est_no_contract ? "est. (no contract)" : undefined })),
    whys: whyRows.slice(0, 12).map((w) => w.why_not ? { why_not: w.why_not } : { setup: w.setup, why_now: w.why_now, kills: w.kills }),
    exits: cards.concat(liveActs).map((a) => a.plan?.josh_exit_why?.text).filter(Boolean).slice(0, 8),
    coach: { calls_with_direction: calls.length, taken_from_coach: tookCoach, tickers: [...new Set(calls.map((c) => c.ticker))].slice(0, 10) },
    last_week_rule: lastRule, homework: hk };
  let rule = REPORT_RULE_DEFAULT, comment = "", followed: boolean | null = null;
  if (apiKey) {
    try {
      const sys = `You are Jarvis writing Josh's Friday report card from the numbers below — only from them. Talk to Josh directly, plain words, no praise padding, fair and direct. Respond with JSON only: {"followed": true|false|null, "comment": "two sentences on what the numbers say about this week", "rule": "ONE rule for next week, one sentence, specific and checkable from Otto's data"}. Never write "answered N of N" or "of N scored" when expired > 0 — expired cards were offered and left unanswered; say "answered A of O, E expired". "followed" = did he follow last week's rule, judged from the numbers (null if the numbers can't say). Never name the coach.` + NAME_RULE;
      const r = await withTimeout(aiFetch("report_card", { method: "POST", headers: { "content-type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({ model: await roomModel(), max_tokens: 500, system: sys, messages: [{ role: "user", content: JSON.stringify(facts) }] }) }), 40_000, "report card");
      const j = await r.json();
      const txt = (j.content || []).filter((c: any) => c.type === "text").map((c: any) => c.text).join("");
      const out = JSON.parse(txt.slice(txt.indexOf("{"), txt.lastIndexOf("}") + 1));
      if (typeof out.rule === "string" && out.rule.trim().length > 12) rule = unname(out.rule.trim()).slice(0, 220);
      if (typeof out.comment === "string") comment = unname(out.comment.trim()).slice(0, 500);
      if (typeof out.followed === "boolean") followed = out.followed;
    } catch (e) { console.error("report card model", e); }
  }
  const hkTrades = hk ? cards.filter((a) => (a.status === "paper_taken" || a.status === "done") && hk.missed_days.includes(etParts(new Date(a.created_at)).date)).length : 0;
  const g = letterGrade({ answered: st.answered, offered: st.offered, good_whys: good, whys: whyRows.length, rule_followed: followed, homework: hk ? hk.ratio : null });
  const money = (n: number) => (n < 0 ? "−$" : "+$") + Math.abs(Math.round(n)).toLocaleString("en-US");
  const lines = [
    `📋 Report card — week of ${ws} · Josh + Baby J`,
    `Grade: ${g.letter} (${g.score}/100)`,
    `Last week's rule: ${lastRule} — ${followed == null ? "can't tell from the numbers" : followed ? "followed ✓" : "not followed ✗"}`,
    `Cards: ${st.offered} offered, ${st.answered} answered (${st.taken} taken, ${st.rejected} rejected), ${st.expired} expired${st.expired ? " — expired counts against you" : ""}.`,
    `Live (Robinhood): ${trades.length} trade${trades.length === 1 ? "" : "s"}, ${money(livePnl)}. Practice book: $${book.start.toLocaleString("en-US")} → $${st.balance.toLocaleString("en-US")}${st.scoring ? ` (${st.scoring} still scoring)` : ""}.`,
    `Overrode Baby J: ${ov.length}${ov.length ? " — " + ov.map((a) => `${practiceLabel(a.title)} (${a.outcome?.state || "open"}${a.outcome?.est_no_contract ? ", est. no contract" : ""})`).join(", ") : ""}.`,   // v4.2.3 fix 3 + 7
    `Coach posted ${calls.length} call${calls.length === 1 ? "" : "s"} with a direction${calls.length ? ` (${facts.coach.tickers.join(", ")})` : ""}; you took ${tookCoach}.`,
    `Your whys: ${whyRows.length} written, ${good} named a level and a kill.${whyRows.length ? "" : " None — the gate is on now, so next week this line fills in."}`,
    hk ? `Homework: ${hk.done} of ${hk.nights} night${hk.nights === 1 ? "" : "s"} on time${hk.late ? `, ${hk.late} late` : ""}${hk.missed ? `, ${hk.missed} skipped` : ""} (20% of the grade). Call right ${hk.right} of ${hk.judged}; levels touched ${hk.touched} of ${hk.of}; Watcher fired on ${hk.used}.${hkTrades ? ` Trades taken on a skipped-homework day: ${hkTrades}.` : ""}` : "",
    comment ? `Read: ${comment}` : "",
    `One rule for next week: ${rule}`,
  ].filter(Boolean);
  const out = { week_start: ws, week_end: we, grade: g.letter, score: g.score, rule, last_rule: lastRule, followed, comment, stats: st, homework: hk, live: { n: trades.length, pnl: livePnl }, overrides: ov.length, text: lines.join("\n"), built_at: new Date().toISOString() };
  await putSetting("report_card_last", out, "Otto").catch(() => {});
  return out;
}

/* ------------------------------------------------------------ v3.38: Pop Quiz (approved mockup v338-mockup.html, 16 Oct 2026)
   Josh picks a chart and answers the five questions the coach asks on every pop quiz. Jarvis grades each answer ONLY from the brain
   (call date + MM:SS next to every grade), gives a score out of 5 and two things to fix. History in otto_settings.quiz_history (last 60). */
export const QUIZ_QUESTIONS = [
  { id: "picture", q: "What's the big picture on the weekly and daily?", coach: "Go to the weekly first. What do you see up there?", search: "weekly daily double top zoom out structure gap" },
  { id: "sell_to", q: "Where do you SELL TO? (the target)", coach: "That's the part where we sell to.", search: "sell to target wick first batch runners TP1 next level" },
  { id: "add_exit", q: "Where do you ADD, and where do you get OUT?", coach: "When it retests and fails, that's where you add.", search: "retest fail add exit indecision doji lower high entry candle open" },
  { id: "confirm", q: "Which candle confirms the entry, and what's your entry price?", coach: "You wouldn't know if it failed until the end of that candle.", search: "confirmation candle close 10-minute retest let price come chase" },
  { id: "regime", q: "Trend or chop today — and do you hold overnight?", coach: "If the opening price is below previous close… chop zone.", search: "chop zone range overnight previous close open gap line small account risk profit" },
];
export function quizScore(grades: { grade: string }[]) {
  return Math.round(grades.reduce((s, g) => s + (g.grade === "ok" ? 1 : g.grade === "half" ? 0.5 : 0), 0) * 10) / 10;
}
export async function quizGrade(body: any, who: string, apiKey: string) {
  const ticker = String(body?.ticker || "").toUpperCase().replace(/[^A-Z.]/g, "").slice(0, 8);
  const answers: Record<string, string> = {};
  for (const q of QUIZ_QUESTIONS) answers[q.id] = String(body?.answers?.[q.id] || "").trim().slice(0, 600);
  if (!ticker) throw new Error("pick a ticker");
  if (!Object.values(answers).some(Boolean)) throw new Error("answer at least one question");
  const calls = await loadBrain();
  const cs = chunksOf(calls);
  const seen = new Set<string>(); const hits: Chunk[] = [];
  for (const q of QUIZ_QUESTIONS) for (const h of search(cs, q.search + " " + answers[q.id].slice(0, 80), 5)) { const k = h.d + h.at + h.s.slice(0, 40); if (!seen.has(k)) { seen.add(k); hits.push(h); } }
  const sys = `You are Jarvis grading Josh's pop-quiz answers on ${ticker} against the Otto Rules (the coaching-call material below). Grade ONLY from that material: "ok" when the answer matches what the calls teach, "half" when it is partly right or missing the key part, "no" when it contradicts the calls or is the fear/chasing habit the calls warn about. If the calls never covered a question, say so in the note and grade "half". Every note cites (call date, MM:SS) from the material — never invent a citation or a rule. Plain words, two sentences max per note, talk to Josh directly. Respond with JSON only: {"grades":[{"id":"picture","grade":"ok|half|no","note":"...","source":"call date, MM:SS"}, ... one per question in order], "fixes":["...","..."]} — fixes = the two most important things to fix before the next call, one sentence each.\n\nOTTO RULES (always on):\n${alwaysOn(calls)}\n\nMATERIAL:\n${hits.slice(0, 24).map(fmt).join("\n\n")}` + NAME_RULE;
  const user = QUIZ_QUESTIONS.map((q, i) => `Q${i + 1} [${q.id}] ${q.q}\nJosh: ${answers[q.id] || "(no answer)"}`).join("\n\n");
  const r = await aiFetch("quiz_grade", { method: "POST", headers: { "content-type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model: await roomModel(), max_tokens: 1800, system: sys, messages: [{ role: "user", content: user }] }) });
  const j = await r.json();
  const txt = (j.content || []).filter((c: any) => c.type === "text").map((c: any) => c.text).join("");
  let out: any = null;
  try { out = JSON.parse(txt.slice(txt.indexOf("{"), txt.lastIndexOf("}") + 1)); } catch { throw new Error("Jarvis did not return a grade — try again"); }
  const grades = QUIZ_QUESTIONS.map((q) => { const g = (out?.grades || []).find((x: any) => x.id === q.id) || {}; const grade = ["ok", "half", "no"].includes(g.grade) ? g.grade : "half";
    return { id: q.id, grade, note: unname(String(g.note || (answers[q.id] ? "" : "No answer given."))).slice(0, 500), source: unname(String(g.source || "")).slice(0, 80) }; });
  const fixes = (Array.isArray(out?.fixes) ? out.fixes : []).slice(0, 2).map((f: any) => unname(String(f)).slice(0, 300));
  const score = quizScore(grades);
  const weakest = [...grades].sort((a, b) => ({ no: 0, half: 1, ok: 2 } as any)[a.grade] - ({ no: 0, half: 1, ok: 2 } as any)[b.grade])[0];
  const by = String(body?.by || who.split("@")[0]).replace(/[^\w .-]/g, "").slice(0, 40) || who.split("@")[0];   // the "At the desk" picker (Josh / Ifoma)
  const row = { at: new Date().toISOString(), day: etParts().date, by, ticker, score, max: QUIZ_QUESTIONS.length, answers, grades, fixes, weakest: weakest ? QUIZ_QUESTIONS.find((q) => q.id === weakest.id)?.q : null };
  const hist: any[] = ((await setting("quiz_history").catch(() => null))?.rows || []);
  await putSetting("quiz_history", { rows: [row, ...hist].slice(0, 60) }, who).catch(() => {});
  await activity("change", `Pop quiz: ${ticker} ${score}/${QUIZ_QUESTIONS.length}${fixes[0] ? " — fix: " + fixes[0] : ""}`, by).catch(() => {});
  return { ok: true, ...row };
}
export async function quizList() {
  const rows: any[] = ((await setting("quiz_history").catch(() => null))?.rows || []);
  return { ok: true, questions: QUIZ_QUESTIONS.map((q) => ({ id: q.id, q: q.q, coach: q.coach })), rows: rows.slice(0, 20).map((r) => ({ at: r.at, day: r.day, by: r.by, ticker: r.ticker, score: r.score, max: r.max, weakest: r.weakest, fixes: r.fixes })) };
}

/* ------------------------------------------------------------ scorecard
   Every opening option card is an idea, taken or not. An idea is scored on the
   UNDERLYING: did price touch TP1 before the stop, using 5-minute TradingView
   bars from the moment the card was made. Stop-first when one bar touches both
   (conservative). Passed ideas are labelled hypothetical everywhere. */

// v3.14: graded on Robinhood 5-minute bars (TradingView's were rate-limited), same day only (intraday House Rule).
async function evalIdea(a: any) {
  const p = a.plan || {}, ex = a.exit || {};
  const tp1 = Number(p.tp1), wrong = Number(p.stop);
  const tk = String(p.tv_symbol || "").split(":").pop();
  if (!tk || !isFinite(tp1) || !isFinite(wrong) || !p.direction) return { state: "unscored" };
  const pf = a.status === "paper_taken" ? p.paper_fill : null;       // v3.35: a taken practice trade is graded from Josh's tap
  const created = pf?.at ? Date.parse(pf.at) : Date.parse(a.created_at);
  if (Date.now() - created < 5 * 60e3) return { state: "pending" };
  const day = etParts(new Date(created)).date;
  const start = new Date(created - 10 * 60e3).toISOString(), end = nyIso(day, "4:00 PM") || undefined;
  let bars: Bar[];
  try { bars = (await rhBars([tk], "5minute", start, end && Date.parse(end) < Date.now() ? end : undefined))[tk.toUpperCase()] || []; }
  catch { return { state: "pending" }; }
  const dm = /Delta (\d?\.\d+)/.exec((a.checks || []).map((c: any) => c.text).join(" "));
  const g: any = gradeIdea({ created, direction: p.direction === "down" ? "down" : "up", tp1, wrong, entry: Number(pf?.underlying) || Number(p.entry_underlying) || null,
    delta: Number(pf?.delta) || (dm ? Number(dm[1]) : null), premium: Number(pf?.ask) || Number(ex.entry_limit) || (a.risk?.cost ? a.risk.cost / 100 : null), tf: Number(p.wrong_tf || ex.wrong_tf) || 15 }, bars);
  const noContract = hasNoContract(a);                                       // v4.2.3 fix 7
  return g.state === "open" ? { state: "pending" } : { ...g, at: g.at ? Math.round(g.at / 1000) : undefined, ...(noContract ? { est_no_contract: true } : {}) };
}
/* v4.2.3 fix 7: a card whose opening leg has no option_id (AAPL 355C, Coach #352, 23 Oct) is scored on the underlying at the card's
   price — there is no real option price behind the number. Tag it so every report says "est. (no contract)". */
export function hasNoContract(a: any): boolean {
  const legs = (a?.calls || []).filter((c: any) => c.tool === "place_option_order").flatMap((c: any) => c.args?.legs || []);
  const open = legs.filter((l: any) => l.position_effect === "open");
  if (!open.length) return false;
  return open.every((l: any) => !l.option_id) && !a?.plan?.option_id && !a?.exit?.option_id;
}
// v3.14: grade a few open ideas every 5 minutes from the cron, so the Scoreboard is current without opening it.
export async function scoreTick(budget = 6) {
  const since = new Date(Date.now() - 3 * 864e5).toISOString();
  const acts = await db(`otto_actions?${OQ()}select=*&created_at=gte.${since}&order=created_at.desc&limit=100`).catch(() => []);
  let n = 0;
  for (const a of acts) {
    if (n >= budget) break;
    // v3.43: a practice trade Josh closed by hand keeps HIS result; the rule's grade is filled in beside it as the what-if.
    if (a.outcome?.practice_close) {
      if (a.outcome.rule_grade && a.outcome.rule_grade.state !== "pending") continue;
      if (!a.plan) continue;
      n++;
      const g = await evalIdea({ ...a, outcome: null }).catch(() => null);
      if (g && ["win", "loss", "scratch", "unscored"].includes(g.state))
        await db("otto_actions?id=eq." + a.id + "&outcome->>practice_close=eq.true", { method: "PATCH", headers: { prefer: "return=minimal" }, body: JSON.stringify({ outcome: { ...a.outcome, rule_grade: { state: g.state, pnl_est: g.pnl_est ?? null, r: g.r ?? null } } }) }).catch(() => {});
      continue;
    }
    if (!a.plan || (a.outcome && ["win", "loss", "scratch", "unscored"].includes(a.outcome.state))) continue;
    if (!(a.calls || []).some((c: any) => c.tool === "place_option_order" && (c.args?.legs || []).some((l: any) => l.position_effect === "open"))) continue;
    n++;
    const o = await evalIdea(a).catch(() => null);
    if (o && ["win", "loss", "scratch", "unscored"].includes(o.state)) {
      // v3.43: the extra filter means a hand close that landed while this was grading is never overwritten
      const r = await db("otto_actions?id=eq." + a.id + "&outcome->>practice_close=is.null", { method: "PATCH", headers: { prefer: "return=representation" }, body: JSON.stringify({ outcome: o }) }).catch(() => null);
      // v4.2.3 fix 5 (AMGN 457.5C, 23 Oct 11:40): a practice trade stopped or finished by its own rule tells Josh on the Desk — once.
      if (a.status === "paper_taken" && Array.isArray(r) && r.length && (o.state === "win" || o.state === "loss")) await logDesk("system", "Otto", practiceStopLine(a, o), a.id).catch(() => {});
    }
  }
  await apTick().catch(() => {});   // v5.9: OttoPilot's loss stop / last entry time, checked with every score pass
  return { ok: true, graded: n };
}
// v5.0 ROOMS: after the house pass, the same tick runs in each member's room (their practice trades are closed / scored by
// wrong-if, TP1 and 3:50 PM in evalIdea). Rooms with nothing open are skipped after one cheap read; at most `max` rooms per
// tick, round-robin through a module cursor; each room in its own try/catch so one can't break the others; a time budget
// keeps the whole pass well inside the function's limit. Morning / daily / charts / prep / alerts jobs do NOT fan out.
let ROOM_CURSOR = 0;
const practiceOpen5 = (a: any) => a.outcome?.practice_close
  ? !(a.outcome.rule_grade && a.outcome.rule_grade.state !== "pending")
  : !(a.outcome && ["win", "loss", "scratch", "unscored"].includes(a.outcome.state));
export async function scoreTickRooms(max = 20, budgetMs = 45_000): Promise<{ visited: string[]; skipped: string[] }> {
  const t0 = Date.now();
  const visited: string[] = [], skipped: string[] = [];
  const users: any[] = (await db("otto_users?select=email&status=eq.active&role=eq.member&order=email.asc").catch(() => [])) || [];
  if (!users.length) return { visited, skipped };
  const start = ROOM_CURSOR % users.length;
  for (let i = 0; i < Math.min(max, users.length); i++) {
    const email = String(users[(start + i) % users.length].email || "").toLowerCase();
    ROOM_CURSOR = (start + i + 1) % users.length;
    if (!email || email === HOUSE) continue;
    if (Date.now() - t0 > budgetMs) break;
    try {
      await ROOM.run({ owner: email }, async () => {
        const since = new Date(Date.now() - 3 * 864e5).toISOString();
        const rows = await db(`otto_actions?${OQ()}select=id,outcome&status=eq.paper_taken&created_at=gte.${since}&limit=50`).catch(() => []);
        if (!(rows || []).some(practiceOpen5)) { skipped.push(email); return; }
        await scoreTick();
        visited.push(email);
      });
    } catch (e) { console.error("score room", email, String((e as Error)?.message || e).slice(0, 200)); }
  }
  return { visited, skipped };
}
export function practiceStopLine(a: any, o: any): string {
  const p = a?.plan || {}, lab = practiceLabel(a?.title);
  const est = o?.pnl_est != null ? Number(o.pnl_est) : null;
  const money = est == null ? "" : ` — scored ${est < 0 ? "−" : "+"}$${Math.abs(Math.round(est))}${o?.r != null ? ` (${o.r}R)` : ""}${o?.est_no_contract ? ", est. (no contract)" : ""}`;
  const tf = Number(p.wrong_tf) || 5, dir = p.direction === "down" ? "over" : "under";
  const why = o?.state === "win" ? `hit TP1 ${p.tp1 ?? ""}`.trim() : `${tf}-min close ${dir} ${p.stop ?? "its wrong-if"}`;
  return `⏹ Practice trade ${lab} ${o?.state === "win" ? "finished" : "stopped"} by its rule — ${why}${money}. Nothing was sent to Robinhood.`;
}
/* v3.34: every opening option card, compact, so the Scoreboard can total each day (paper = pnl_est, real = pnl from otto_trades). */
export function scoreRows(ideas: any[], pnlBy: Record<string, number>) {
  return (ideas || []).slice(0, 400).map((a: any) => ({
    id: a.id, title: a.title, at: a.created_at, status: a.status, source: srcOf(a),
    state: a.outcome?.state ?? null, est: a.outcome?.pnl_est ?? null, r: a.outcome?.r ?? null, est_no_contract: !!a.outcome?.est_no_contract,   // v4.2.3 fix 7
    pnl: pnlBy[a.id] ?? null, by: a.decided_by ?? null,
    // v3.41: the practice book, overrides and Josh's whys ride along for the Scoreboard and the report card
    practice: isPracticeCard(a), override: !!a.plan?.override || noWhy(a), override_read: a.plan?.override_read ?? (noWhy(a) ? NO_WHY_TEXT : null),   // v5.7: no why = an override
    why_pending: !!a.plan?.why_pending && !a.plan?.josh_why, tp1_card: a.plan?.tp1_card ?? null,
    autopilot: a.plan?.autopilot ? (a.plan.autopilot.on_plan ? "plan" : "off") : a.plan?.autopilot_pass ? "pass" : null, ap_why: a.plan?.autopilot?.why?.setup ?? a.plan?.autopilot_pass?.why ?? null,   // v5.9 / v5.9.2
    why: a.plan?.josh_why ? { setup: a.plan.josh_why.setup, why_now: a.plan.josh_why.why_now, kills: a.plan.josh_why.kills } : null,
    why_not: a.plan?.josh_reject_why?.why_not ?? null, exit_why: a.plan?.josh_exit_why?.text ?? null,
    // v3.43: a practice trade Josh closed by hand, and what the rule would have done
    hand_close: a.outcome?.practice_close ? (a.outcome.closed_by || true) : null, rule_state: a.outcome?.rule_grade?.state && a.outcome.rule_grade.state !== "pending" ? a.outcome.rule_grade.state : null, rule_est: a.outcome?.rule_grade?.pnl_est ?? null,
  }));
}
async function scorecard() {
  const acts = await db("otto_actions?" + OQ() + "select=*&order=created_at.desc&limit=400");
  const ideas = acts.filter((a: any) => (a.calls || []).some((c: any) => c.tool === "place_option_order" &&
    (c.args?.legs || []).some((l: any) => l.position_effect === "open")));
  let budget = 12;                                   // keep one call bounded
  for (const a of ideas) {
    if (a.outcome && ["win", "loss", "scratch", "unscored"].includes(a.outcome.state)) continue;
    if (budget-- <= 0) break;
    const o = await evalIdea(a);
    a.outcome = o;
    if (["win", "loss", "scratch", "unscored"].includes(o.state)) {
      await db("otto_actions?id=eq." + a.id, { method: "PATCH", headers: { prefer: "return=minimal" }, body: JSON.stringify({ outcome: o }) }).catch(() => {});
    }
  }
  const trades = await db("otto_trades?select=action_id,pnl&action_id=not.is.null");
  const pnlBy: Record<string, number> = {};
  trades.forEach((t: any) => { if (t.pnl != null) pnlBy[t.action_id] = (pnlBy[t.action_id] || 0) + Number(t.pnl); });
  const scored = (l: any[]) => l.filter((a) => a.outcome && ["win", "loss", "scratch"].includes(a.outcome.state));
  const agg = (l: any[]) => {
    const s = scored(l), w = s.filter((a) => a.outcome.state === "win").length, lo = s.filter((a) => a.outcome.state === "loss").length;
    return { n: l.length, scored: s.length, wins: w, losses: lo, hit: w + lo ? w / (w + lo) : null,
      avg_r: s.length ? s.reduce((x, a) => x + Number(a.outcome.r || 0), 0) / s.length : null };
  };
  const group = (key: (a: any) => string) => {
    const g: Record<string, any[]> = {};
    ideas.forEach((a: any) => (g[key(a) || "unlabelled"] ||= []).push(a));
    return Object.entries(g).map(([k, l]) => ({ key: k, ...agg(l) })).sort((a, b) => b.n - a.n);
  };
  const taken = ideas.filter((a: any) => a.status === "done");
  const passed = ideas.filter((a: any) => ["rejected", "expired", "paper", "paper_wait"].includes(a.status));
  return {
    ok: true,
    since: ideas.length ? ideas[ideas.length - 1].created_at : null,
    all: agg(ideas), taken: { ...agg(taken), pnl: taken.reduce((s: number, a: any) => s + (pnlBy[a.id] || 0), 0) },
    passed: agg(passed),
    by_setup: group((a) => a.plan?.setup), by_verdict: group((a) => a.banner?.verdict),
    by_source: group((a) => srcOf(a)), by_trigger: group((a) => a.plan?.trigger ? (TRIG_LABEL[a.plan.trigger] || a.plan.trigger) : "not a Watcher trigger"),
    est: (() => { const s2 = scored(ideas).filter((a: any) => a.outcome.pnl_est != null);
      return { n: s2.length, total: s2.reduce((x: number, a: any) => x + Number(a.outcome.pnl_est), 0), per: s2.length ? Math.round(s2.reduce((x: number, a: any) => x + Number(a.outcome.pnl_est), 0) / s2.length) : null }; })(),
    proof: await (async () => { const st = await proofStart(); const today = marketClock().date; return { start: st, day: Math.max(0, Math.min(14, tradingDaysBetween(st, today))), of: 14 }; })(),
    rows: scoreRows(ideas, pnlBy),
    practice: practiceStats(ideas, await practiceBook().catch(() => PRACTICE_BOOK_DEFAULT)),     // v3.41
    recent: ideas.slice(0, 25).map((a: any) => ({ id: a.id, title: a.title, at: a.created_at, status: a.status, source: srcOf(a), trigger: a.plan?.trigger || null,
      setup: a.plan?.setup || null, verdict: a.banner?.verdict || null, outcome: a.outcome || null, pnl: pnlBy[a.id] ?? null })),
  };
}

/* ------------------------------------------------------------ scheduled runs
   pg_cron (005_v31.sql) calls ?fn=cron_morning on weekdays at 12:45 and 13:45
   UTC and ?fn=cron_weekly on Fridays at 20:30 and 21:30 UTC — both halves of
   daylight saving. The function itself checks New York time and skips the
   one that's an hour off. Authenticated by OTTO_CRON_SECRET, not by a user. */

async function morningRead(apiKey: string) {
  const sent = await sentimentNow(true, "auto");
  let news = "";
  try { news = await whatsMoving(apiKey); } catch { /* the read still runs */ }
  if (news) {
    try {
      const last = await db("otto_sentiment?kind=eq.auto&order=id.desc&limit=1&select=id");
      if (last?.[0]) await db("otto_sentiment?id=eq." + last[0].id, { method: "PATCH", headers: { prefer: "return=minimal" }, body: JSON.stringify({ news }) });
    } catch { /* */ }
    if (SENT) SENT.body.news = { text: news, at: new Date().toISOString() };
  }
  const calls = await loadBrain();
  const cs = chunksOf(calls);
  const sys = DESK_SYS.replace("{{RULES}}", alwaysOn(calls));
  const { tools: mcpToolDefs } = await deskTools();
  const tools = [TOOLS[0], ...mcpToolDefs];
  const lite = { verdict: sent.verdict, score: sent.score, fresh: `${sent.fresh}/${sent.total}`,
    legs: sent.legs.map((l: any) => ({ leg: l.label, pct: l.pct == null ? null : +l.pct.toFixed(2), live: l.live })),
    fired: sent.rows.filter((r: any) => r.fired).map((r: any) => `row ${r.row}: ${r.label}`),
    calendar_today: sent.calendar.map((e: any) => `${etLabel(e.date)} ${e.title} (importance ${e.importance})`) };
  const lastRule41 = String((await setting("report_card_last").catch(() => null))?.rule || "").trim();   // v3.41: the report card's rule leads the week
  const hk45 = await hkStatus().catch(() => null);   // v3.45
  const hkMorning = !hk45?.applies ? "" : (hk45.done || hk45.late)
    ? `\nJosh's homework for today (his own after-close read): ${String(hk45.call || "").toUpperCase()} — "${String(hk45.call_why || "").slice(0, 200)}"; levels ${(hk45.levels || []).map((x: any) => `${x.ticker} ${x.level} ${x.dir === "up" ? "▲" : "▼"}`).join(", ")}. Include ONE line that says where today's tape agrees or disagrees with his call.`
    : `\nJosh has NOT handed in last night's homework yet (due 9:00 AM; it never blocks a card). Include exactly this line: "📓 No homework handed in yet — without it, today's call is a guess, not a plan."`;
  const callMorning = (() => {   // v4.5: Tue–Fri the read opens with the week's callouts still in play
    const c = newestCall(calls); if (!c) return "";
    const age = Math.round((Date.parse(marketClock().date) - Date.parse(c.call.date)) / 86400e3);
    if (!(age >= 1 && age <= 4)) return "";
    const body = calloutsText(c).split("\n").slice(1, -1).join("; ").slice(0, 900);
    return body ? `\nThis week's callouts from the ${c.call.date} call (still in play): ${body}\nInclude ONE line, right after the rule line, that starts exactly "This week's callouts still in play:" and names the 2–3 closest to today's price with the level that negates each.` : "";
  })();
  const prompt = `[Automatic 8:45 morning read — no one typed this. ${sent.et} ET.]${lastRule41 ? `\nLINE ONE of your read must be exactly: "This week's rule: ${lastRule41}"` : ""}
The live sentiment banner (Josh's intermarket sheet on TradingView data) says: ${JSON.stringify(lite)}
What's moving (web research just now): ${news.slice(0, 2500) || "unavailable"}${hkMorning}${callMorning}

Write today's morning read for Ifoma and Josh (Workflow 1): one line each for the 10-year, crude, USD/JPY; any binary event today; SPY/QQQ and Mag-7 tone (fetch what you need); a bias that agrees with or explains any disagreement with the banner; and the 2–3 setups worth watching from the TradingView watchlist with the trigger level for each. Levels from the calls are dated marks — say the call date. Never name the coach. No order cards. Under 250 words.`;
  const res = await runDesk({ msgs: [{ role: "user", content: prompt }], sys, tools, cs, who: "cron", send: () => {}, allowPropose: false, maxRounds: 8 });
  if (res.said.trim()) { await logDesk("assistant", "Jarvis · 8:45 auto", res.said.trim()); await notify("morning", "☀️ Morning read is ready", res.said.trim().slice(0, 200)); }
  return { ok: true, verdict: sent.verdict, words: res.said.split(/\s+/).length };
}

function cronAllowed(req: Request) {
  const s = Deno.env.get("OTTO_CRON_SECRET") || "";
  return s.length >= 16 && req.headers.get("x-otto-cron") === s;
}
/* ===================================================================== v3.31 Winston market-data gateway
   14 Oct 2026. Winston (the paper-only trader) runs as his own Edge Function and holds NO Robinhood or TradingView sign-in.
   When he needs market data he asks this route. It is: cron-secret only; a hard allow-list of read-only MARKET-DATA tools;
   and it refuses anything about accounts, positions, orders, P&L, alerts or watchlists, and anything that writes — even if a
   tool name were ever added to the allow-list by mistake (the deny pattern is checked first). It never returns Josh + Baby J's data. */
export const WINSTON_ALLOW: Record<string, Set<string>> = {
  rh: new Set(["get_option_chains", "get_option_instruments", "get_option_quotes", "get_option_historicals",
    "get_equity_quotes", "get_equity_historicals", "get_equity_technical_indicators", "get_earnings_calendar",
    "get_index_quotes", "search",
    "get_equity_analyst_ratings", "get_earnings_results", "preview_scan"]),   // v4.4: analyst consensus, EPS history, the market scanner (preview_scan runs a filter set live and saves nothing)
  tv: new Set(["mcp-tv-get-symbol-data", "mcp-tv-get-symbol-data-batch", "mcp-tv-get-ohlcv", "mcp-tv-get-news",
    "mcp-tv-get-news-story", "mcp-tv-get-technicals-rating", "mcp-tv-get-earnings-calendar",
    "mcp-tv-get-economic-calendar", "mcp-tv-get-screener-columns", "mcp-tv-run-screener", "mcp-tv-search-symbols"]),
};
export const WINSTON_DENY = /place|cancel|exercise|(^|[^a-z])review_|create|update|delete|add_|remove|stop|restart|portfolio|position|order|pnl|account|alert|watchlist|trade_approval|tax|margin|upgrade/i;
export function winstonGatewayCheck(service: unknown, tool: unknown, args: unknown): { ok: true } | { ok: false; error: string } {
  const sv = String(service || ""), tl = String(tool || "");
  if (!WINSTON_ALLOW[sv]) return { ok: false, error: "service not allowed" };
  if (WINSTON_DENY.test(tl)) return { ok: false, error: "tool refused: " + tl };
  if (!WINSTON_ALLOW[sv].has(tl)) return { ok: false, error: "tool not on the market-data allow-list: " + tl };
  if (args != null && (typeof args !== "object" || Array.isArray(args))) return { ok: false, error: "args must be an object" };
  if (args && Object.keys(args as object).some((k) => /account/i.test(k))) return { ok: false, error: "account arguments are not allowed" };
  return { ok: true };
}
export async function winstonGateway(body: any) {
  const chk = winstonGatewayCheck(body?.service, body?.tool, body?.args);
  if (!chk.ok) return { status: 403, out: { ok: false, error: chk.error } };
  try {
    const res = await call(String(body.service), String(body.tool), body.args || {});
    const j = mcpJson(res);
    return { status: 200, out: { ok: true, data: j ?? mcpText(res).slice(0, 60000) } };
  } catch (e) {
    return { status: 502, out: { ok: false, error: String((e as Error).message || e).slice(0, 300) } };
  }
}

/* ===================================================================== v4.9 Winston LIVE gateway (dry first)
   4 Nov 2026. Winston still holds no Robinhood sign-in. The live plumbing asks THIS route, which is: cron-secret only; house account only;
   closed unless winston_settings.config.live_mode is dry or on; a small allow-list; account_number always forced to the agentic account;
   review_* in dry and on; place_* / cancel_* ONLY in mode "on" (and a new BUY never while kill_now is set or above the contract cap). */
export const WINSTON_LIVE_READ = new Set(["get_accounts", "get_portfolio", "get_option_positions", "get_option_orders", "get_trade_approval_setting"]);
export const WINSTON_LIVE_TOOLS = new Set([...WINSTON_LIVE_READ, "review_option_order", "place_option_order", "cancel_option_order"]);
export function winstonLiveCheck(tool: unknown, args: unknown, mode: string, killNow: boolean, maxContracts: number): { ok: true } | { ok: false; error: string } {
  const tl = String(tool || "");
  if (mode !== "dry" && mode !== "on") return { ok: false, error: "live mode is off" };
  if (!WINSTON_LIVE_TOOLS.has(tl)) return { ok: false, error: "tool not on the live allow-list: " + tl };
  if (args != null && (typeof args !== "object" || Array.isArray(args))) return { ok: false, error: "args must be an object" };
  const a: any = args || {};
  if (/^(place|cancel)_/.test(tl) && mode !== "on") return { ok: false, error: tl + " is refused unless live mode is on" };
  if (tl === "place_option_order" || tl === "review_option_order") {
    const legs = Array.isArray(a.legs) ? a.legs : [];
    if (legs.length !== 1) return { ok: false, error: "exactly one leg" };
    const qty = Math.floor(Number(a.quantity));
    if (!(qty >= 1)) return { ok: false, error: "quantity must be at least 1" };
    const opening = legs[0]?.position_effect === "open";
    if (opening && legs[0]?.side !== "buy") return { ok: false, error: "an opening leg must be a buy" };
    if (opening && qty > Math.max(1, maxContracts)) return { ok: false, error: "over the contract cap" };
    if (opening && tl === "place_option_order" && killNow) return { ok: false, error: "kill is set: no new entries" };
    if (!opening && legs[0]?.side !== "sell") return { ok: false, error: "a closing leg must be a sell" };
    if (tl === "place_option_order" && !a.ref_id) return { ok: false, error: "ref_id required" };
  }
  return { ok: true };
}
export async function winstonLive(body: any) {
  try {
    const cr: any = ((await db("winston_settings?key=eq.config&select=value"))?.[0]?.value) || {};
    const lim: any = ((await db("winston_settings?key=eq.live_limits&select=value"))?.[0]?.value) || {};
    const kill = !!((await db("winston_settings?key=eq.kill_now&select=value"))?.[0]?.value?.at);
    const mode = String(cr.live_mode || "off");
    const tool = String(body?.tool || "");
    const chk = winstonLiveCheck(tool, body?.args, mode, kill, Number(lim.contracts) || 1);
    if (!chk.ok) return { status: 403, out: { ok: false, error: chk.error } };
    const args: any = { ...(body.args || {}) };
    if (tool !== "get_accounts") args.account_number = await agenticAccount();
    const res = await call("rh", tool, args);
    const j = mcpJson(res);
    return { status: 200, out: { ok: true, data: j ?? mcpText(res).slice(0, 60000) } };
  } catch (e) {
    return { status: 502, out: { ok: false, error: String((e as Error).message || e).slice(0, 300) } };
  }
}

function background(p: Promise<unknown>) {
  const er = (globalThis as any).EdgeRuntime;
  if (er?.waitUntil) er.waitUntil(p.catch((e) => console.error("background", e))); else p.catch((e) => console.error("background", e));
}


/* ===================================================================== v3.2
   5 Oct 2026 — Jarvis rename, manual order ticket, TradingView alert watcher.

   Webhook note: the approved plan was a TradingView webhook. TradingView won't
   let an outside app put a webhook on an alert (it needs 2-factor on the
   account and has to be set by hand on every alert, 17 of them). Same result
   without any of that: every 2 minutes in market hours Otto reads TradingView's
   alert log and posts each new fire to the Desk with Jarvis's quick read. */

async function tvSymbolFor(ticker: string): Promise<string | null> {
  const t = ticker.toUpperCase().trim();
  return cached("tvsym|" + t, 7 * 864e5, async () => {
    try {
      const j = mcpJson(await call("tv", "mcp-tv-search-symbols", { query: t }));
      const list = j?.data?.symbols || j?.symbols || [];
      const ok = ["NASDAQ", "NYSE", "AMEX", "NYSE ARCA", "ARCA", "CBOE", "BATS"];
      const hit = list.find((x: any) => String(x.symbol || "").split(":")[1] === t && ok.includes(String(x.exchange || "").toUpperCase()))
        || list.find((x: any) => String(x.symbol || "").split(":")[1] === t && String(x.currency_logoid || "").includes("US"));
      return hit ? String(hit.symbol) : null;
    } catch { return null; }
  });
}

// The Buy/Sell form on the Desk. Same card, same Approve, same checks as Jarvis's cards.
async function orderTicket(b: any, who: string, author: string) {
  const sym = String(b.symbol || "").toUpperCase().replace(/[^A-Z.]/g, "");
  const type = b.type === "put" ? "put" : "call";
  const exp = String(b.expiry || "");
  const strike = Number(b.strike), qty = Math.floor(Number(b.qty)), price = Number(b.price);
  const side = b.side === "sell_close" ? "sell_close" : "buy_open";
  if (!sym || !/^\d{4}-\d{2}-\d{2}$/.test(exp) || !(strike > 0) || !(qty >= 1) || !(price > 0)) throw new Error("Fill in ticker, expiry, strike, quantity and limit price");
  const ins = mcpJson(await call("rh", "get_option_instruments", { chain_symbol: sym, expiration_dates: exp, strike_price: strike.toFixed(4), type }));
  const inst = (ins?.data?.instruments || [])[0];
  if (!inst?.id) throw new Error(`No ${sym} ${strike} ${type} expiring ${exp} on Robinhood. Check the expiry date and strike.`);
  const label = `${sym} ${strike % 1 ? strike : Math.round(strike)}${type === "put" ? "P" : "C"} ${exp.slice(5).replace("-", "/")}`;
  const title = `${side === "buy_open" ? "Buy" : "Sell"} ${qty} ${label} @ ${price.toFixed(2)}`;
  let plan: any = null;
  if (side === "buy_open") {
    if (b.tp1 == null || b.tp1 === "" || b.stop == null || b.stop === "" || !(Number(b.stop_option) > 0))
      throw new Error("A buy needs its exits: TP1 and the wrong-if price (on the stock) and the stop on the option.");
    const tv = await tvSymbolFor(sym);
    if (!tv) throw new Error(`Couldn't find ${sym} on TradingView for the exit alerts.`);
    plan = { tv_symbol: tv, direction: type === "put" ? "down" : "up", setup: String(b.setup || "other"), tp1: Number(b.tp1), stop: Number(b.stop),
      stop_option: Number(b.stop_option), expires: exp, manual: true };
  }
  const summary = [
    `Underlying / contract   ${label}`,
    `Side / qty / type       ${side === "buy_open" ? "Buy to open" : "Sell to close"} · ${qty} · limit $${price.toFixed(2)}`,
    side === "buy_open" && plan ? `Plan                    TP1 ${plan.tp1} · wrong if ${plan.stop} · ${plan.setup}` : "",
    side === "buy_open" && plan ? `Exits (Otto sets them)  stop on the option at $${Number(plan.stop_option).toFixed(2)} · alerts at ${plan.stop} (5-min close) and ${plan.tp1}` : "",
    b.note ? `Why                     ${String(b.note).slice(0, 300)}` : "",
    `Source                  Order ticket, entered by ${author}`,
  ].filter(Boolean).join("\n");
  await logDesk("user", author, `Order ticket: ${title}${b.note ? " — " + String(b.note).slice(0, 300) : ""}`);
  const card = await proposeAction({ title, summary, plan,
    calls: [{ service: "rh", tool: "place_option_order", args: {
      legs: [{ option_id: inst.id, side: side === "buy_open" ? "buy" : "sell", position_effect: side === "buy_open" ? "open" : "close" }],
      quantity: String(qty), price: price.toFixed(2), type: "limit", time_in_force: "gfd" } }] }, who, { manual: true });
  const flags = (card.checks || []).filter((c: any) => c.ok === false).map((c: any) => c.text);
  await logDesk("assistant", "Jarvis", `Card from your order ticket.${flags.length ? " Rule check flags: " + flags.join("; ") + "." : ""} Nothing happens until you click Approve.`, card.id);
  return card;
}

// Alert watcher (cron, every 2 minutes in market hours).
/* v3.12 (Ifoma, 6 Oct): "what's the plan with all these alerts?" → Card or quiet.
   Every fire is posted to the TradingView Alerts tab (Desk rows by "TradingView", never the Jarvis chat).
   A FRESH fire (≤20 min old) of an alert that hasn't already been checked today goes to Jarvis, who checks it
   against the Otto Rules: a real setup → ONE card + ONE ping (several cards in one run → one bundled ping);
   not a setup → his reason, quietly. Late fires, repeats and the exit engine's own alerts never ping. */
const ALERT_FRESH_MS = 20 * 60e3;
async function alertWatch(apiKey: string) {
  await tvSlowLoad();
  const j = mcpJson(await tvBudget(call("tv", "mcp-tv-get-alerts-log", { days: 1, limit: 50 }), 15000, "TradingView alert log"));   // v3.16: breaker
  const events: any[] = j?.events || j?.data?.events || [];
  if (!events.length) return { ok: true, fired: 0 };
  // TradingView's log has a fire_id per fire; fall back to the old name|time key so nothing already seen repeats.
  const keyOf = (e: any) => [e.alert_id ?? e.id ?? e.name ?? "", e.fire_time ?? e.time ?? e.timestamp ?? e.fired_at ?? e.created ?? ""].join("|");
  const keys = events.map(keyOf);
  const seen = await db("otto_alert_fires?select=key&key=in.(" + encodeURIComponent(keys.map((k) => '"' + k.replace(/"/g, "") + '"').join(",")) + ")").catch(() => []);
  const have = new Set(seen.map((r: any) => r.key));
  const firedAt = (e: any) => Date.parse(e.fired_at || e.fire_time || e.time || e.timestamp || 0) || 0;
  const fresh = events.filter((e, i) => !have.has(keys[i])).sort((x, y) => firedAt(x) - firedAt(y));
  if (!fresh.length) return { ok: true, fired: 0 };
  const markSeen = (list: any[]) => db("otto_alert_fires?on_conflict=key", { method: "POST", headers: { prefer: "resolution=ignore-duplicates,return=minimal" },
    body: JSON.stringify(list.map((e) => ({ key: keyOf(e), payload: e }))) });
  // First run ever: just remember the backlog, don't flood the Desk.
  const any = await db("otto_alert_fires?select=key&limit=1").catch(() => [{}]);
  if (!any.length && fresh.length > 3) { await markSeen(fresh); return { ok: true, fired: 0, primed: fresh.length }; }
  // Which alerts Jarvis already checked today (one check — and at most one ping — per alert per day).
  const day = etParts().date;
  let memo: any = (await setting("alert_day").catch(() => null)) || {};
  if (memo.date !== day) memo = { date: day, done: {} };
  const hourAgo = Date.now() - 3600e3;
  let hourCount = Object.values(memo.done).filter((v: any) => v && v.at > hourAgo).length;
  const review: any[] = [];
  for (const e of fresh.slice(0, 25)) {
    const raw = String(e.name || e.alert_name || ""), sym = String(e.symbol || e.ticker || ""), msg = String(e.message || "");
    const id = String(e.tv_alert_id ?? e.alert_id ?? raw ?? sym);
    const age = Date.now() - (firedAt(e) || Date.now());
    let status = "";
    if (/^Otto ·/.test(raw)) status = "🛡️ trade protection — the exit engine handles it";
    else if (age > ALERT_FRESH_MS) status = `🔕 quiet — fired ${Math.round(age / 60e3)} min ago, too late to act on`;
    else if (memo.done[id]) status = "🔕 quiet — this alert was already checked today";
    else if (review.length >= 3 || hourCount >= 6) status = "🔕 quiet — too many alerts at once; Jarvis didn't check this one";
    else {
      status = "👀 Jarvis is checking it against the Otto Rules";
      memo.done[id] = { s: "review", at: Date.now() }; hourCount++;
      review.push({ id, name: unname(raw), symbol: sym, message: unname(msg), fired_at: e.fired_at || e.fire_time || null });
    }
    await logDesk("system", "TradingView", `🔔 ${unname(raw || sym)}${msg && msg !== raw ? "\n" + unname(msg) : ""}\n» ${status}`.slice(0, 600));
    await markSeen([e]).catch(() => {});
  }
  if (fresh.length > 25) await markSeen(fresh.slice(25)).catch(() => {});
  // Merge what alertJarvis finished meanwhile (it writes the same setting) before judging time-outs.
  const latest: any = await setting("alert_day").catch(() => null);
  if (latest?.date === day) for (const [k, v] of Object.entries(latest.done || {}) as any) if (v?.s && v.s !== "review") memo.done[k] = v;
  // A check that was cut off (server time limit) is closed out quietly after 5 minutes.
  for (const [k, v] of Object.entries(memo.done) as any) if (v?.s === "review" && Date.now() - v.at > 5 * 60e3) {
    memo.done[k] = { ...v, s: "timeout" };
    await logDesk("assistant", "Jarvis · alert read", `For: ${v.name || k}\nNo card — the check was cut off by the server's time limit. Ask Jarvis if you want a read on it.`);
  }
  if (review.length) for (const r of review) memo.done[r.id].name = r.name;
  await putSetting("alert_day", memo, "cron").catch(() => {});
  if (review.length && !(await kick("alert_jarvis", { fires: review }))) await alertJarvis(review);
  return { ok: true, fired: fresh.length, reviewing: review.length };
}

async function alertJarvis(fires: any[]) {
  const { cs, sys, tools, ctxLine } = await deskSetup();
  const runTools = tools.filter((t: any) => t.name !== "close_position" && !/^tv__/.test(String(t.name || "")));
  const results = await Promise.all(fires.slice(0, 3).map(async (f) => {
    const prompt = `${ctxLine}
[A TradingView alert just fired — no one typed this. Ifoma and Josh are not watching; you decide.] ${JSON.stringify(f).slice(0, 600)}
Is this a real setup under the Otto Rules RIGHT NOW? Search the rules for this level (give the call date), fetch the live price, option chain and quote with Robinhood, and check: did a 15-minute candle close through the level (not just a wick), the sentiment banner, the time of day (no first 30 minutes), earnings or a binary event, buying power, and whether we already hold it.
- Real setup → call propose_action ONCE with one opening option card (plan.setup "tradingview alert", the usual plan fields incl. stop_option; pick the contract with option_shortlist — ★ if it fits buying power, else ◆).
- Not a setup yet → no card.
Work quietly. When done, write a line that is exactly READ: and after it 2–3 short plain sentences: what the level is, where price is now, and why you made the card — or why not and what would make it one.
(Use Robinhood tools for prices, chains and quotes — TradingView tools are not available in this run.)`;
    try {
      const res = await runDesk({ msgs: [{ role: "user", content: prompt }], sys, tools: runTools, cs, who: "alert", send: () => {},
        allowPropose: true, allowClose: false, maxRounds: 8 });
      const raw = res.said.trim(), cut = raw.lastIndexOf("READ:");
      return { f, read: (cut >= 0 ? raw.slice(cut + 5) : raw).trim(), cards: res.cards, err: "" };
    } catch (e) { return { f, read: "", cards: [] as string[], err: String((e as Error).message || e).slice(0, 200) }; }
  }));
  const memo: any = (await setting("alert_day").catch(() => null)) || { done: {} };
  const made: { f: any; a: any }[] = [];
  for (const r of results) {
    const acts = r.cards.length ? await db("otto_actions?select=id,title&id=in.(" + r.cards.join(",") + ")").catch(() => []) : [];
    const head = `For: ${r.f.name || r.f.symbol}\n` + (r.err ? `No card — Jarvis hit an error checking it: ${r.err}` : (r.read || (acts.length ? "Card's up." : "No setup — no card.")));
    await logDesk("assistant", "Jarvis · alert read", head, acts[0]?.id || null);
    for (const a of acts.slice(1)) await logDesk("assistant", "Jarvis · alert read", `For: ${r.f.name || r.f.symbol}\nSecond card for this alert.`, a.id);
    for (const a of acts) made.push({ f: r.f, a });
    if (memo.done?.[r.f.id]) memo.done[r.f.id] = { ...memo.done[r.f.id], s: r.err ? "error" : acts.length ? "card" : "quiet" };
  }
  await putSetting("alert_day", memo, "cron").catch(() => {});
  // One ping for everything this run made.
  if (made.length) await markPinged(made.map((m) => m.a.id));
  if (made.length === 1) {
    const { f, a } = made[0];
    await notify("card", `🃏 ${String(f.symbol).split(":").pop()} card ready — level hit`, `${f.name}. ${String(a.title || "").slice(0, 90)}. Tap to Approve or Reject (expires in 20 min).`, "./#alerts");
  } else if (made.length > 1) {
    await notify("card", `🃏 ${made.length} cards ready: ${[...new Set(made.map((m) => String(m.f.symbol).split(":").pop()))].join(", ")}`,
      "TradingView levels hit and Jarvis found setups. Tap to Approve or Reject (expire in 20 min).", "./#alerts");
  }
  return { ok: true, cards: made.length };
}


/* ===================================================================== v3.4
   5 Oct 2026 — enter with the exit already set.

   An opening option card now carries plan.stop_option (the OPTION price that
   triggers the protective stop). Approving the card approves the entry AND its
   exits. Once the buy fills, Otto itself:
     1. places a stop_market sell-to-close at stop_option. Robinhood only allows
        stop_market as a day order, so Otto re-places it every morning at 9:30;
     2. sets two TradingView alerts on the stock: wrong-if (plan.stop) on a
        5-minute close (15 before v3.21), and TP1 on touch;
     3. when one of those alerts fires, puts up a close card (cancel the stop,
        then sell to close at market). Nothing sells without an Approve;
     4. when the position goes flat (stop filled, close card, or closed by
        hand), cancels any leftover stop and deletes the trade's alerts.
   State lives in otto_actions.exit (008_v34.sql). Driven by the 2-minute
   cron (cron_alerts), right after an Approve, and when the Desk panel loads. */

const EXIT_OPEN_ORDER = new Set(["queued", "confirmed", "unconfirmed", "partially_filled", "new", "pending_cancelled"]);
const EXIT_DEAD_ORDER = new Set(["cancelled", "rejected", "failed", "voided", "expired"]);

// v3.20 (8 Oct): Robinhood option price steps. $3.38 was rejected on 7 Oct ("Stop price does not satisfy
// the min tick value") and NVDA ran with no stop. Penny-program names: $0.01 under $3, $0.05 from $3 up;
// others: $0.05 / $0.10. Stops round UP (toward the entry), so the loss at the stop never grows.
export function optTick(price: number, coarse = false) { return price >= 3 ? (coarse ? 0.10 : 0.05) : (coarse ? 0.05 : 0.01); }
export function roundStopUp(price: number, coarse = false) {
  const t = optTick(price, coarse);
  let r = Math.round(Math.ceil(price / t - 1e-9) * t * 100) / 100;
  if (r >= 3 && price < 3) r = Math.round(Math.ceil(price / optTick(3, coarse) - 1e-9) * optTick(3, coarse) * 100) / 100;
  return r;
}
function exitSpec(out: any[], plan: any) {
  const opens = out.filter((c) => c.tool === "place_option_order" && (c.args.legs || []).some((l: any) => l.position_effect === "open"));
  if (opens.length !== 1) throw new Error("Exits work on one opening option order per card. Split it into separate cards.");
  const o = opens[0], legs = o.args.legs || [];
  if (legs.length !== 1 || legs[0].side !== "buy") throw new Error("Exits work on a single-leg buy to open (a long call or put).");
  const entry = Number(o.args.price), stopOpt = Number(plan.stop_option), qty = Math.floor(Number(o.args.quantity));
  if (!(qty >= 1)) throw new Error("quantity must be a whole number of contracts");
  if (!(entry > 0)) throw new Error("Use a limit price on the entry so the stop can be checked against it.");
  if (!(stopOpt > 0 && stopOpt < entry)) throw new Error(`plan.stop_option ($${stopOpt}) must be above 0 and below the entry limit ($${entry}).`);
  const stopR = roundStopUp(stopOpt);
  if (!(stopR < entry)) throw new Error(`plan.stop_option ($${stopOpt}) rounds to $${stopR.toFixed(2)} (Robinhood's price step), which is not below the entry limit ($${entry}). Set the stop lower.`);
  const dir = plan.direction === "down" ? "down" : "up";
  const tp1 = Number(plan.tp1), wrong = Number(plan.stop);
  if (!(tp1 > 0) || !(wrong > 0)) throw new Error("plan.tp1 and plan.stop must be prices on the underlying");
  if (dir === "up" ? !(tp1 > wrong) : !(tp1 < wrong)) throw new Error(`For a ${dir === "up" ? "call (up)" : "put (down)"} TP1 must be ${dir === "up" ? "above" : "below"} the wrong-if price.`);
  return { option_id: legs[0].option_id, qty, entry_limit: entry, stop_option: stopR,
    tv_symbol: String(plan.tv_symbol), direction: dir, wrong_if: wrong, tp1, expires: plan.expires || null, wrong_tf: Number(plan.wrong_tf) === 5 ? 5 : 15 };
}

async function saveExit(id: string, ex: any) {
  await db("otto_actions?id=eq." + id, { method: "PATCH", headers: { prefer: "return=minimal" }, body: JSON.stringify({ exit: ex }) });
}
function exitLog(ex: any, text: string) {
  ex.log = [...(ex.log || []), { at: new Date().toISOString(), text }].slice(-30);
}
const rthNow = () => { const e = etParts(); return !["Sat", "Sun"].includes(e.wd) && e.min >= 570 && e.min < 960; };
const orderIdOf = (j: any) => j?.data?.order?.id || j?.data?.id || j?.order?.id || j?.id || null;

async function optOrder(acct: string, id: string) {
  const j = mcpJson(await call("rh", "get_option_orders", { account_number: acct, order_id: id }));
  return (j?.data?.orders || j?.orders || [])[0] || null;
}
async function cardBusy(id: string | null | undefined) {
  if (!id) return false;
  return db("otto_actions?id=eq." + id + "&select=status").then((r: any) => ["pending", "running"].includes(r?.[0]?.status)).catch(() => false);
}

// v3.13: a sell-to-close already working on this option (Otto's own stop from an earlier run, or one set by hand).
async function workingSell(acct: string, ex: any, since: string): Promise<any | null> {
  const j = mcpJson(await call("rh", "get_option_orders", { account_number: acct, created_at_gte: since }));
  return (j?.data?.orders || j?.orders || []).find((o: any) => EXIT_OPEN_ORDER.has(o.state) &&
    (o.legs || []).some((l: any) => l.option_id === ex.option_id && l.side === "sell" && l.position_effect === "close")) || null;
}
async function placeStop(a: any, ex: any, acct: string) {
  const since = new Date(Date.parse(a.decided_at || a.created_at || new Date().toISOString()) - 60e3).toISOString();
  try {
    const w = await workingSell(acct, ex, since);
    if (w) {
      ex.stop_order_id = w.id; ex.stop_error = null;
      exitLog(ex, `Stop already working (order ${String(w.id).slice(0, 8)}, ${w.type || "stop"} ${w.stop_price ? "@ $" + Number(w.stop_price).toFixed(2) : ""}) — kept it`);
      return true;
    }
  } catch { /* fall through and place one */ }
  try {
    const r = await call("rh", "place_option_order", { account_number: acct,
      legs: [{ option_id: ex.option_id, side: "sell", position_effect: "close" }],
      quantity: String(ex.qty), type: "stop_market", stop_price: ex.stop_option.toFixed(2),
      time_in_force: "gfd", market_hours: "regular_hours", ref_id: crypto.randomUUID() });
    ex.stop_order_id = orderIdOf(mcpJson(r)); ex.stop_error = null;
    exitLog(ex, `Stop placed: sell to close at $${ex.stop_option.toFixed(2)} (day order)`);
    return true;
  } catch (e) {
    const msg = (e as Error).message;
    // v3.20: a price-step rejection → one retry on the coarser step (non-penny names), rounded toward the entry.
    if (/min(imum)?\s*tick|tick value|increment/i.test(msg) && !ex.stop_coarse) {
      const c = roundStopUp(ex.stop_option, true);
      if (c < ex.entry_limit) {
        ex.stop_coarse = true; exitLog(ex, `Robinhood refused $${ex.stop_option.toFixed(2)} (price step) — moving the stop to $${c.toFixed(2)}`);
        ex.stop_option = c;
        return placeStop(a, ex, acct);
      }
    }
    // "not enough contracts to close" = a sell already holds the contract. Find it and keep it; no alarm.
    if (/enough contracts|pending|already/i.test(msg)) {
      try {
        const w = await workingSell(acct, ex, since);
        if (w) { ex.stop_order_id = w.id; ex.stop_error = null; exitLog(ex, `Stop already working (order ${String(w.id).slice(0, 8)}) — kept it`); return true; }
      } catch { /* report below */ }
    }
    ex.stop_error = msg.slice(0, 300);
    exitLog(ex, "Stop order FAILED: " + ex.stop_error);
    await logDesk("system", "Otto", `⚠ ${a.title}: the protective stop at $${ex.stop_option.toFixed(2)} could not be placed (${ex.stop_error}). This trade has NO stop working. Close it or set one by hand.`, a.id);
    await notify("no_stop", `⚠ No stop on ${bareTitle(a.title)}`, `The protective stop at $${ex.stop_option.toFixed(2)} couldn't be placed. Open the Desk.`);
    return false;
  }
}

async function armAlerts(a: any, ex: any, only?: ("wrong" | "tp1")[]) {
  const exp = ex.expires && /^\d{4}-\d{2}-\d{2}$/.test(ex.expires) ? ex.expires + "T21:00:00Z" : new Date(Date.now() + 14 * 864e5).toISOString();
  const tk = ex.tv_symbol.split(":").pop();
  const mk = async (kind: "wrong" | "tp1") => {
    const up = ex.direction === "up";
    const value = kind === "wrong" ? ex.wrong_if : ex.tp1;
    const type = kind === "wrong" ? (up ? "cross_down" : "cross_up") : (up ? "cross_up" : "cross_down");
    const res = kind === "wrong" ? String(ex.wrong_tf || 15) : "1";
    const args = { symbol: ex.tv_symbol,
      name: `Otto · ${tk} ${kind === "wrong" ? "WRONG IF" : "TP1"} ${value} · ${String(a.id).slice(0, 8)}`,
      message: `${tk} ${kind === "wrong" ? `closed a ${ex.wrong_tf || 15}-minute bar through your wrong-if` : "reached TP1"} ${value} (Otto trade: ${a.title})`,
      conditions: [{ type, frequency: kind === "wrong" ? "on_bar_close" : "on_first_fire", resolution: res,
        cross_interval: true, series: [{ type: "barset" }, { type: "value", value }] }],
      resolution: res, expiration: exp, popup: false, mobile_push: false, email: false };
    try {
      const j = mcpJson(await call("tv", "mcp-tv-create-alert", args));
      const id = j?.alert_id ?? j?.data?.alert_id ?? j?.alert?.alert_id ?? j?.tv_alert_id ?? j?.id ?? j?.data?.id ?? null;
      if (id == null) throw new Error("TradingView created the alert but returned no id: " + JSON.stringify(j).slice(0, 160));
      exitLog(ex, `Alert set: ${kind === "wrong" ? "wrong-if" : "TP1"} ${tk} ${value}`);
      return id;
    } catch (e) {
      const m = (e as Error).message;
      exitLog(ex, `Alert FAILED (${kind}): ${m.slice(0, 200)}`);
      ex.alert_error = /max_primitive_alerts_count_exceeded/.test(m) ? "TradingView alert limit reached (20) — delete an old alert" : m.slice(0, 200);
      return null;
    }
  };
  // v3.9.4: only (re)arm what's missing, keep what's already set.
  const want = only || ["wrong", "tp1"];
  const cur = ex.alerts || {};
  ex.alerts = { wrong: want.includes("wrong") ? await mk("wrong") : (cur.wrong ?? null), tp1: want.includes("tp1") ? await mk("tp1") : (cur.tp1 ?? null) };
  if (ex.alerts.wrong != null && ex.alerts.tp1 != null) ex.alert_error = null;
}

async function cleanupExit(ex: any, acct: string) {
  if (ex.stop_order_id) {
    try {
      const o = await optOrder(acct, ex.stop_order_id);
      if (o && EXIT_OPEN_ORDER.has(o.state)) { await call("rh", "cancel_option_order", { account_number: acct, order_id: ex.stop_order_id }); exitLog(ex, "Leftover stop cancelled"); }
    } catch (e) { exitLog(ex, "Couldn't cancel the leftover stop: " + (e as Error).message.slice(0, 150)); }
  }
  const ids = [ex.alerts?.wrong, ex.alerts?.tp1].filter((x) => x != null).map(Number);
  if (ids.length) {
    try { await call("tv", "mcp-tv-delete-alert", { alert_ids: ids }); exitLog(ex, "Trade alerts removed"); }
    catch (e) { exitLog(ex, "Couldn't remove the trade alerts: " + (e as Error).message.slice(0, 150)); }
  }
}

async function heldQty(acct: string, optionId: string) {
  const j = mcpJson(await call("rh", "get_option_positions", { account_number: acct, option_ids: optionId }));
  return (j?.data?.positions || []).filter((p: any) => p.type === "long").reduce((s: number, p: any) => s + Number(p.quantity || 0), 0);
}

/* v3.13: a lease so only ONE exit run works a trade at a time. On 6 Oct the 2-minute cron, the
   Approve click and the Desk panel all ran exitTick on the same fill at once: the first placed the
   stop, the others' stop orders were rejected ("not enough contracts") and raised false NO-stop
   alarms. The lease is an atomic UPDATE … WHERE exit_lock is null or stale (012_v313.sql). */
const EXIT_LEASE_MS = 90_000;
async function exitLease(id: string): Promise<any | null> {
  const stale = new Date(Date.now() - EXIT_LEASE_MS).toISOString();
  try {
    const rows = await db(`otto_actions?id=eq.${id}&or=(exit_lock.is.null,exit_lock.lt.${stale})&select=*`,
      { method: "PATCH", body: JSON.stringify({ exit_lock: new Date().toISOString() }) });
    return rows?.[0] || null;
  } catch (e) {
    // 012_v313.sql not run yet: keep the exit engine working (unlocked, as before) rather than stop it.
    if (/exit_lock/.test(String((e as Error).message))) return (await db(`otto_actions?id=eq.${id}&select=*`))?.[0] || null;
    throw e;
  }
}
export async function exitTick(a: any) {
  const fresh = await exitLease(a.id);
  if (!fresh) return { id: a.id, skipped: "another run is working this trade" };
  try { return await exitTickLocked(fresh); }
  finally { await db("otto_actions?id=eq." + a.id, { method: "PATCH", headers: { prefer: "return=minimal" }, body: JSON.stringify({ exit_lock: null }) }).catch(() => {}); }
}
async function exitTickLocked(a: any) {
  const ex: any = { ...(a.exit || {}) };
  const acct = await agenticAccount();
  const today = etParts().date;

  if (ex.state === "waiting_fill") {
    let o: any = ex.order_id ? await optOrder(acct, ex.order_id) : null;
    if (!o) {
      const j = mcpJson(await call("rh", "get_option_orders", { account_number: acct, created_at_gte: a.decided_at || a.created_at }));
      o = (j?.data?.orders || []).find((x: any) => (x.legs || []).some((l: any) => l.option_id === ex.option_id && l.position_effect === "open")) || null;
      if (o) ex.order_id = o.id;
    }
    if (!o) return { id: a.id, state: ex.state, note: "entry order not found yet" };
    if (EXIT_DEAD_ORDER.has(o.state)) {
      const why = orderReason(o);                    // v3.22: Robinhood's own reason, never a guess
      // v3.24 (A14): "cancelled" when it was cancelled; "Rejected by Robinhood: …" only when Robinhood rejected it.
      ex.state = "dead"; ex.dead_reason = deadWord(o.state, why); exitLog(ex, `Entry ${deadWord(o.state, why)}, nothing to protect`);
      await saveExit(a.id, ex);
      await logDesk("system", "Otto", `${a.title}: the entry was ${deadWord(o.state, why)}, so no stop or alerts were set.`, a.id);
      return { id: a.id, state: ex.state };
    }
    if (o.state !== "filled") { await saveExit(a.id, ex); return { id: a.id, state: ex.state, order: o.state }; }
    const execs = (o.legs || [])[0]?.executions || [];
    const qf = execs.reduce((s: number, x: any) => s + Number(x.quantity), 0);
    ex.fill_price = qf ? execs.reduce((s: number, x: any) => s + Number(x.price) * Number(x.quantity), 0) / qf : Number(o.price);
    ex.qty = Math.floor(Number(o.processed_quantity || ex.qty));
    ex.state = "armed"; ex.armed_at = new Date().toISOString(); ex.fired = [];
    exitLog(ex, `Entry filled: ${ex.qty} @ $${ex.fill_price.toFixed(2)}`);
    // v3.24 (A8): the stop is sized from the actual fill (8 Oct NVDA: limit $1.60, filled $0.86, stop was still $0.48).
    const ns = stopFromFill(Number(ex.entry_limit), Number(ex.stop_option), ex.fill_price);
    if (ns != null && ns !== ex.stop_option) { exitLog(ex, `Stop re-sized from the fill: $${Number(ex.stop_option).toFixed(2)} → $${ns.toFixed(2)} (same ${Math.round(ex.stop_option / ex.entry_limit * 100)}% of the price as the card)`); ex.stop_from_card = ex.stop_option; ex.stop_option = ns; }
    const staleAtFill = await withTimeout(staleEntry({ exit: ex }), 4000, "stale check").catch(() => null);
    // v3.9.2: the stop goes on (and is saved) BEFORE the TradingView alerts, so a slow or
    // failing TradingView can never delay the stop or lose its order id.
    let stopOk = false;
    if (rthNow()) { ex.stop_try_day = today; ex.stop_tries = 1; stopOk = await placeStop(a, ex, acct); }
    await saveExit(a.id, ex);
    await armAlerts(a, ex);
    await saveExit(a.id, ex);
    const loss = (ex.fill_price - ex.stop_option) * 100 * ex.qty;
    await logDesk("system", "Otto", `✓ ${a.title}: filled at $${ex.fill_price.toFixed(2)}. ` +
      (stopOk ? `Stop on at $${ex.stop_option.toFixed(2)} (about −$${loss.toFixed(0)} if it fills there). ` : rthNow() ? "" : "Stop goes on at 9:30 ET. ") +
      `Alerts: wrong-if ${ex.wrong_if} ${ex.alerts?.wrong != null ? "✓" : "✗"}, TP1 ${ex.tp1} ${ex.alerts?.tp1 != null ? "✓" : "✗"}.` +
      (ex.alert_error ? ` (${ex.alert_error})` : "") +
      (ex.stop_from_card ? ` Stop sized from the fill (card had $${Number(ex.stop_from_card).toFixed(2)}).` : "") +
      (staleAtFill ? ` ⚠ ${staleAtFill}: the server closes it on the next 5-minute close through ${ex.wrong_if} if auto-close is on.` : ""), a.id);
    await notify("fill", `✓ Filled: ${bareTitle(a.title)} @ $${ex.fill_price.toFixed(2)}`,
      (stopOk ? `Stop on at $${ex.stop_option.toFixed(2)} (about −$${loss.toFixed(0)}). ` : `Stop goes on at 9:30 ET. `) +
      (ex.alerts?.wrong != null && ex.alerts?.tp1 != null ? `Alerts set at ${ex.wrong_if} and ${ex.tp1}.`
        : `⚠ TradingView alerts NOT set (${ex.alerts?.wrong != null ? "" : "wrong-if " + ex.wrong_if + " "}${ex.alerts?.tp1 != null ? "" : "TP1 " + ex.tp1}) — Otto keeps retrying.${ex.alert_error ? " " + ex.alert_error : ""}`));
    return { id: a.id, state: ex.state };
  }
  if (ex.state !== "armed") return { id: a.id, state: ex.state };

  const held = await heldQty(acct, ex.option_id);
  if (held <= 0) {
    let how = "closed";
    if (ex.stop_order_id) { try { const s = await optOrder(acct, ex.stop_order_id); if (s?.state === "filled") how = "stopped out"; } catch { /* */ } }
    await cleanupExit(ex, acct);
    ex.state = "closed"; ex.closed_at = new Date().toISOString(); ex.closed_how = how;
    exitLog(ex, `Position flat (${how})`);
    await saveExit(a.id, ex);
    await logDesk("system", "Otto", `${a.title}: position is flat (${how}). Leftover stop and trade alerts cleaned up. Write the one-line reason in the Journal.`, a.id);
    await expireCloseCards(ex.option_id).catch(() => {});   // v3.24 (C10c)
    if (how === "stopped out") await notify("stopped", `🛑 Stopped out: ${bareTitle(a.title)}`, `The $${Number(ex.stop_option).toFixed(2)} stop filled. Write the one-line reason in the Journal.`);
    return { id: a.id, state: ex.state };
  }
  if (held !== ex.qty) { exitLog(ex, `Holding ${held} now (was ${ex.qty})`); ex.qty = held; }

  // Keep the stop on during market hours (Robinhood's stop_market is a day order). At most 3 tries a day.
  if (rthNow()) {
    let need = !ex.stop_order_id;
    if (ex.stop_order_id) { try { const s = await optOrder(acct, ex.stop_order_id); need = !s || EXIT_DEAD_ORDER.has(s.state); } catch { need = false; } }
    if (ex.stop_try_day !== today) { ex.stop_try_day = today; ex.stop_tries = 0; }
    if (need && (ex.stop_tries || 0) < 3 && !(await cardBusy(ex.close_card))) {
      ex.stop_tries = (ex.stop_tries || 0) + 1; await placeStop(a, ex, acct);
      await saveExit(a.id, ex);                     // v3.9.2: remember the new stop's id even if TradingView fails next
    }
  }

  // v3.9.4: alerts that failed to set (TradingView down / 20-alert limit) are retried every 10 min, up to 6 times a day.
  const missing = (["wrong", "tp1"] as const).filter((k) => ex.alerts?.[k] == null);
  if (missing.length && (!ex.alert_retry_at || Date.now() - Date.parse(ex.alert_retry_at) > 10 * 60e3)) {
    if (ex.alert_try_day !== today) { ex.alert_try_day = today; ex.alert_tries = 0; }
    if ((ex.alert_tries || 0) < 6) {
      ex.alert_tries = (ex.alert_tries || 0) + 1; ex.alert_retry_at = new Date().toISOString();
      try { await armAlerts(a, ex, [...missing]); } catch { /* logged inside */ }
      const still = (["wrong", "tp1"] as const).filter((k) => ex.alerts?.[k] == null);
      if (!still.length) exitLog(ex, "Alerts set on retry");
      else if (!ex.alert_warned_day || ex.alert_warned_day !== today) {
        ex.alert_warned_day = today;
        await notify("trade_alert", `⚠ Alerts not set: ${bareTitle(a.title)}`,
          `Otto couldn't set the TradingView ${still.join(" + ")} alert${still.length > 1 ? "s" : ""}${ex.alert_error ? " — " + ex.alert_error : ""}. The stop is unaffected. Otto keeps retrying.`);
      }
      await saveExit(a.id, ex);
    }
  }

  // Did one of this trade's own alerts fire?
  const ids = [ex.alerts?.wrong, ex.alerts?.tp1].filter((x) => x != null).map(String);
  if (ids.length) {
    // v3.9.2: a TradingView outage here must not skip the save at the end of this tick.
    let j: any = null;
    try { j = mcpJson(await withTimeout(call("tv", "mcp-tv-get-alerts-log", { days: 1, limit: 100 }), 15000, "TradingView alert log")); ex.tv_check_error = null; }   // v3.16: own timeout, never skipped by the breaker (open trades)
    catch (e) {
      const m = String((e as Error).message || e).slice(0, 160);
      if (!ex.tv_check_error) exitLog(ex, "TradingView alert check failed (will keep retrying; the stop is unaffected): " + m);
      ex.tv_check_error = { at: new Date().toISOString(), m };
    }
    const evs = (j?.events || j?.data?.events || []).filter((e: any) => ids.includes(String(e.tv_alert_id ?? e.alert_id)) &&
      Date.parse(e.fired_at || e.fire_time || 0) > Date.parse(ex.armed_at));
    const key = (e: any) => String(e.fire_id ?? e.fired_at);
    const fresh = evs.filter((e: any) => !(ex.fired || []).includes(key(e)));
    if (fresh.length) {
      ex.fired = [...(ex.fired || []), ...fresh.map(key)].slice(-60);
      // v3.24 (A11): a wrong-if alert must still be true on the LATEST completed bar (8 Oct TSM: the alert came
      // 20+ minutes late, the last close was 469.885 vs 467.90). If not: no close, no card — logged.
      const wrongOnly = fresh.every((e: any) => String(e.tv_alert_id ?? e.alert_id) === String(ex.alerts?.wrong));
      if (wrongOnly) {
        const lt = await latestThrough(ex);
        if (lt.through === false) {
          exitLog(ex, `Stale alert ignored: TradingView said wrong-if ${ex.wrong_if}, but the latest ${Number(ex.wrong_tf) === 5 ? 5 : 15}-minute close is ${lt.close} (${lt.at ? etLabel(lt.at) : "?"})`);
          await logDesk("system", "Otto", `${a.title}: a late TradingView wrong-if alert (${ex.wrong_if}) was ignored — the latest ${Number(ex.wrong_tf) === 5 ? 5 : 15}-minute bar closed at ${lt.close}, not through it. The trade stays on; the stop is unchanged.`, a.id);
          await saveExit(a.id, ex);
          return { id: a.id, state: ex.state, held, stale_alert: true };
        }
      }
      const recent = ex.close_at && Date.now() - Date.parse(ex.close_at) < 10 * 60_000;
      const LIMx = await getLimits().catch(() => LIMIT_DEFAULTS);
      if (LIMx.auto_close && rthNow() && !recent) {
        // v3.5: auto-close is on, so Jarvis decides and closes himself (no card).
        const wrong = fresh.some((e: any) => String(e.tv_alert_id ?? e.alert_id) === String(ex.alerts.wrong));
        const why = wrong ? `wrong-if ${ex.wrong_if} hit (${ex.wrong_tf || 15}-minute close)` : `TP1 ${ex.tp1} reached`;
        ex.close_at = new Date().toISOString();
        exitLog(ex, `${why} → Jarvis deciding (auto-close on)`);
        await notify("trade_alert", `🔔 ${bareTitle(a.title)}: ${wrong ? "wrong-if hit" : "TP1 reached"}`, `${why}. Jarvis is deciding now (auto-close is on).`);
        await saveExit(a.id, ex);
        // v3.21: the server confirms the card's rule on Robinhood bars and closes; otherwise it falls through to a close card.
        let closed = false;
        try {
          const chk = await exitRuleCheck({ ...a, exit: ex });
          if (chk.met) { await closeNow({ option_id: ex.option_id, reason: chk.why, rule_why: chk.why }, "rules", true); closed = true; }
          else exitLog(ex, `TradingView said ${why}, Robinhood bars don't confirm it yet (${chk.detail}) → close card instead`);
        } catch (e) {
          // v3.26 (9 Oct 10:10): the minute sweep closed it at the same moment — "not enough contracts" then means it's already flat.
          const left = await heldQty(await agenticAccount(), ex.option_id).catch(() => null);
          if (left === 0) { exitLog(ex, `${why} → already closed by the other exit run`); closed = true; }
          else await logDesk("system", "Otto", `⚠ ${a.title}: ${why}, but the auto-close failed (${(e as Error).message.slice(0, 200)}). The stop is still working. Close by hand if needed.`, a.id);
        }
        if (closed) return { id: a.id, state: ex.state, held, auto: true };
        ex.close_at = null;
      }
      if (!(await cardBusy(ex.close_card)) && !recent) {
        const wrong = fresh.some((e: any) => String(e.tv_alert_id ?? e.alert_id) === String(ex.alerts.wrong));
        const why = wrong ? `wrong-if ${ex.wrong_if} hit (${ex.wrong_tf || 15}-minute close)` : `TP1 ${ex.tp1} reached`;
        let stopOpen = false;
        if (ex.stop_order_id) { try { const s = await optOrder(acct, ex.stop_order_id); stopOpen = !!s && EXIT_OPEN_ORDER.has(s.state); } catch { /* */ } }
        const calls: any[] = [];
        if (stopOpen) calls.push({ service: "rh", tool: "cancel_option_order", args: { order_id: ex.stop_order_id } });
        calls.push({ service: "rh", tool: "place_option_order", args: { legs: [{ option_id: ex.option_id, side: "sell", position_effect: "close" }],
          quantity: String(ex.qty), type: "market", time_in_force: "gfd" } });
        const card = await proposeAction({ title: `Close ${bareTitle(a.title)} (${wrong ? "wrong if hit" : "TP1"})`,
          summary: [`Why          ${why}`,
            `Plan         ${wrong ? "out: the idea is proven wrong" : "TP1: bank it (1 contract = no runner)"}`,
            `Order        ${stopOpen ? "cancel the $" + ex.stop_option.toFixed(2) + " stop, then " : ""}sell to close ${ex.qty} at market`,
            `If you skip  ${stopOpen ? "the stop stays on underneath" : "⚠ no stop is working on this trade"}`].join("\n"),
          calls }, "otto");
        ex.close_card = card.id; ex.close_at = new Date().toISOString();
        exitLog(ex, `${why} → close card ${String(card.id).slice(0, 8)}`);
        await notify("trade_alert", `🔔 ${bareTitle(a.title)}: ${wrong ? "wrong-if hit" : "TP1 reached"}`, `${why}. A close card is waiting for Approve.`);
        await logDesk("assistant", "Jarvis", `${a.title}: ${why}. Your plan says ${wrong ? "out" : "take it"}. The close card is up${stopOpen ? "; the stop stays on until someone approves it" : ""}.`, card.id);
      }
    }
  }
  await saveExit(a.id, ex);
  return { id: a.id, state: ex.state, held };
}

let EXIT_TICK_AT = 0;
async function exitsTick(force = false) {
  if (!force && Date.now() - EXIT_TICK_AT < 45_000) return { ok: true, skipped: "recent" };
  EXIT_TICK_AT = Date.now();
  const rows = await db("otto_actions?" + OQ() + "select=*&exit->>state=in.(waiting_fill,armed)&order=created_at.asc&limit=10");
  const out: any[] = [];
  for (const a of rows || []) {
    try { out.push(await exitTick(a)); } catch (e) { out.push({ id: a.id, error: (e as Error).message.slice(0, 200) }); }
  }
  return { ok: true, n: (rows || []).length, out };
}

/* ===================================================================== v3.7
   5 Oct 2026 — Jason's calls. Ifoma's decisions (approved mockup
   otto-v3.6-jason-calls-mockup.html):
   - Jason calls trades in Discord #platinum-chat (ALL CAPS, short bursts,
     usually pinged @Platinum Members). No bot. Josh screenshots a post and
     drops it on the Desk; Jarvis reads it and drafts the card right away;
     Ifoma/Josh Approve.
   - EVERY Jason post goes in, tagged or untagged, sorted call / level / note.
     Only calls get an order card. Late calls ("should have called it") get
     none. Jarvis and Josh decide direction.
   - A weekday 5 PM sweep (scheduled task driving Chrome on the Engineer PC,
     Discord search from:jmoney915) posts today's texts to ?fn=jason_sweep;
     anything not pasted is logged, the day is scored, a Desk note goes up.
   - Calls are dated ideas: they expire at the close, are scored, and NEVER
     go into the teaching brain (search_jason / alwaysOn don't read them).
   Table otto_jason (009_v37.sql). */

const J_KINDS = new Set(["call", "level", "note", "result"]);   // v3.16: + result

const JASON_TOOL = {
  name: "record_posts",
  description: "Record every message written by Jason (Discord name Jason, user jmoney915) that is visible. Skip everyone else (Josh, Lige [FLOW], bots).",
  input_schema: {
    type: "object",
    properties: {
      posts: {
        type: "array",
        items: {
          type: "object",
          properties: {
            time: { type: "string", description: "Time shown on the post, e.g. '10:02 AM'. Continuation lines inherit the time Discord shows when hovered; if none is visible use the block's time. Empty string if no time is visible at all." },
            kind: { type: "string", enum: ["call", "level", "note", "result"], description: "call = a trade idea with a direction or a ticker called out to trade (e.g. 'SPCX LONG', 'APP', 'ZETA ENTRY 33.15', 'PUTS ON TSLA', 'SHORTED. SEE THE BREAK'). level = a price level/zone he is watching or reporting (e.g. 'AMD $630 HELD RESISTANCE', 'ORDER BLOCK SHIFTED UP' on a named ticker). result = how an earlier call worked out — a profit, a loss, a win/loss remark or a stat about it (e.g. '$1000 FOR 2 PUTS ON MU', 'NICE SHORT ON MU', 'STOPPED OUT ON TSLA', '90% OF THE TIME SHORTING MU AT THE OPEN'). note = commentary, lessons, answers, reactions." },
            ticker: { type: "string", description: "Stock/ETF ticker in caps, or empty string. Use the chart in the screenshot to find it if the text doesn't say." },
            direction: { type: "string", enum: ["long", "short", ""], description: "long = calls/up/long/buy; short = puts/down/short/sell. Empty if not stated or not a call." },
            late: { type: "boolean", description: "true when Jason says he called it late / should have called it / it already moved ('SHOULD HAVE CALLED IT OUT', 'IN CASE YOU MISSED IT' after the break still counts as NOT late unless he says he missed calling it)." },
            entry: { type: "number", description: "Entry price only if Jason states one (stock price). 0 if none." },
            level: { type: "number", description: "Key price level he states or that is clearly marked on his chart with a number. 0 if none." },
            option: { type: "string", description: "Strike/expiry/type only if Jason states it, e.g. '10/17 42C'. Empty if not stated." },
            words: { type: "string", description: "Jason's exact words, joined with ' / ' when one call spans several lines (e.g. 'SPCX LONG / BREAK HAPPENED IN CASE YOU MISSED IT'). Keep his caps. Drop the @Platinum Members ping text." },
            pinged: { type: "boolean", description: "true if the post pinged @Platinum Members." },
            chart: { type: "string", description: "If a chart image belongs to this post: one short line on what it shows (ticker, trend, levels drawn with numbers). Empty otherwise." },
            summary: { type: "string", description: "One plain line, e.g. 'SPCX: long on the breakout' or 'AMD: $630 resistance held'." },
          },
          required: ["time", "kind", "ticker", "direction", "late", "entry", "level", "option", "words", "pinged", "chart", "summary"],
        },
      },
    },
    required: ["posts"],
  },
};

const JASON_READ_SYS = `You read Jason Murray's posts from the iBelieve Investments Club Discord (#platinum-chat). Jason writes in ALL CAPS, in short bursts across several lines, and usually pings @Platinum Members when he calls something. A call is often just a ticker and a direction ("SPCX LONG"); levels are often only drawn on his chart screenshot. Record ONLY Jason's messages (display name Jason, username jmoney915). Group lines that belong to the same thought into one post (e.g. "SPCX LONG" + "BREAK HAPPENED IN CASE YOU MISSED IT" + the ping = one call). Never invent numbers: entry/level/option only when Jason wrote them or the chart labels them with a number. A message that is only a ping (@Platinum Members, @Josh) is not a post; fold it into the post it belongs to. If nothing from Jason is visible, return an empty list.`;

async function jasonExtract(apiKey: string, src: { image?: { media_type: string; data: string } | null; text?: string; day: string }) {
  const content: any[] = [];
  if (src.image) content.push({ type: "image", source: { type: "base64",
    media_type: /^image\/(jpeg|png|webp|gif)$/.test(src.image.media_type) ? src.image.media_type : "image/jpeg", data: src.image.data } });
  content.push({ type: "text", text: (src.image ? "Screenshot from Discord, " : "Discord messages, ") + `dated ${src.day} (New York time).` +
    (src.text ? "\n\n" + src.text.slice(0, 20000) : "") + "\n\nRecord Jason's posts." });
  const r = await aiFetch("post_extract", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model: await roomModel(), max_tokens: 4000, system: JASON_READ_SYS, tools: [JASON_TOOL],
      tool_choice: { type: "tool", name: "record_posts" }, messages: [{ role: "user", content }] }),
  });
  if (!r.ok) throw new Error("reading the signal failed: claude HTTP " + r.status + " " + (await r.text()).slice(0, 160));
  const j = await r.json();
  const tu = (j.content || []).find((b: any) => b.type === "tool_use");
  const posts = Array.isArray(tu?.input?.posts) ? tu.input.posts : [];
  // A bare ping ("@💎・Platinum Members", "@Josh") is not a post.
  return posts.filter((p: any) => p && J_KINDS.has(p.kind) && String(p.words || "").trim() &&
    !/^\s*(@\S+(\s+Members)?[\s/]*)+$/i.test(String(p.words)));
}

// "10:02 AM" on a New York date → ISO. Tries EDT then EST and keeps the one
// whose New York clock reads back the same minute.
function nyIso(day: string, time: string): string | null {
  const m = /^\s*(\d{1,2}):(\d{2})\s*([AP]M)?\s*$/i.exec(time || "");
  if (!m || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
  let h = Number(m[1]) % 12; if ((m[3] || "").toUpperCase() === "PM") h += 12;
  if (!m[3] && Number(m[1]) === 12) h = 12;
  const want = h * 60 + Number(m[2]);
  for (const off of [4, 5]) {
    const d = new Date(`${day}T${String(h).padStart(2, "0")}:${m[2]}:00Z`);
    d.setUTCHours(d.getUTCHours() + off);
    const p = etParts(d);
    if (p.date === day && p.min === want) return d.toISOString();
  }
  return null;
}

const jNorm = (s: string) => String(s || "").toUpperCase().replace(/@\S+/g, "").replace(/[^A-Z0-9$.]+/g, " ").trim().slice(0, 90);

async function jasonSave(posts: any[], day: string, source: string, who: string) {
  const rows = posts.map((p: any) => {
    const at = nyIso(day, p.time);
    const hhmm = at ? fmtMin(etParts(new Date(at)).min) : "";
    const ticker = String(p.ticker || "").toUpperCase().replace(/[^A-Z.]/g, "").slice(0, 8) || null;
    return {
      day, posted_at: at, posted_label: hhmm || null, kind: p.kind,
      ticker, direction: ["long", "short"].includes(p.direction) ? p.direction : null,
      late: !!p.late, entry: Number(p.entry) > 0 ? Number(p.entry) : null, level: Number(p.level) > 0 ? Number(p.level) : null,
      option: String(p.option || "").slice(0, 40) || null, pinged: !!p.pinged,
      words: String(p.words).slice(0, 600), chart: String(p.chart || "").slice(0, 300) || null,
      summary: String(p.summary || "").slice(0, 200) || null, source, added_by: who,
      fp: `${day}|${hhmm}|${jNorm(p.words)}`,
    };
  });
  if (!rows.length) return { inserted: [] as any[], all: [] as any[] };
  // ignore-duplicates: a post already pasted (or swept) keeps its first row.
  const inserted = await db("otto_jason?on_conflict=fp&select=*", { method: "POST",
    headers: { prefer: "resolution=ignore-duplicates,return=representation" }, body: JSON.stringify(rows) });
  const fps = new Set(rows.map((r) => r.fp));
  const all = (await db(`otto_jason?select=*&day=eq.${day}&limit=200`).catch(() => inserted)).filter((r: any) => fps.has(r.fp));
  try { await watchFromSignals(inserted || []); } catch { /* the Watcher never breaks Signals */ }   // v3.14
  try { await linkResults(inserted || []); } catch { /* v3.16: results scoreboard link never breaks Signals */ }
  return { inserted, all };
}

const jLine = (r: any) => `#${r.id} ${r.posted_label || "?"} ${r.kind.toUpperCase()}${r.late ? " (LATE)" : ""}${r.ticker ? " " + r.ticker : ""}${r.direction ? " " + r.direction : ""}` +
  `${r.entry ? " entry $" + r.entry : ""}${r.level ? " level $" + r.level : ""}${r.option ? " option " + r.option : ""}: "${r.words}"${r.chart ? " [chart: " + r.chart + "]" : ""}`;

async function jasonTodayRows(day = etParts().date) {
  return await db(`otto_jason?select=*&day=eq.${day}&order=posted_at.asc.nullslast,id.asc&limit=80`).catch(() => []);
}

// One line for the Desk context, so Jarvis knows today's calls and levels in every turn.
async function jasonContext(): Promise<string> {
  const rows = await jasonTodayRows();
  if (!rows.length) return "";
  return ` Jason's posts today in Discord (dated ideas from his chat — they expire at today's close and are NOT method; use his levels as levels): ` +
    rows.slice(-25).map(jLine).join("; ") + ".";
}

// Called inside the Desk stream when Josh pastes a Jason post.
async function jasonIntake(apiKey: string, img: any, text: string, who: string, author: string) {
  const day = etParts().date;
  let posts = await jasonExtract(apiKey, { image: img, text, day });
  const vt = await verifyTickers(posts).catch(() => null);      // v3.22
  if (vt) { posts = vt.posts; for (const q of vt.asks) await logDesk("system", "Otto", q); }
  const { all } = await jasonSave(posts, day, "paste", author || who);
  return all;
}

function jasonPrompt(rows: any[], extra: string) {
  if (!rows.length) return `[Jason's post pasted — but no message from Jason could be read in it.] Say so in one line and ask for a clearer screenshot. ${extra}`;
  return `[📣 Jason's post, pasted from Discord #platinum-chat and read from the screenshot. These are saved in Otto's Jason feed.]
${rows.map(jLine).join("\n")}
${extra ? "Note from the desk: " + extra + "\n" : ""}
Handle each one:
- CALL (not late, not already carded): check it against the banner, Jason's rules (first 30 minutes, delta .30–.40, volume > open interest, expiry, binary events, earnings), our limits, and whether we already hold it. Give a 2–3 line take. Then propose_action ONE opening option order with plan + exits (the v3.4 rules), plan.setup = "jason call", plan.jason_id = the #id above. Use Jason's entry/level when he gave one. Everything he did NOT give (strike, expiry, entry, stop, TP1, wrong-if) is yours: say "Jarvis, not Jason" for those in your take. Size inside our limits.
- CALL marked LATE: no card. Say the move happened before the post and chasing breaks Jason's entry rules; offer to watch for a pullback to a level.
- LEVEL: one line on what it means for us; no card.
- NOTE: one line at most; no card.
Josh and Ifoma decide direction. If the banner or a rule argues against a call, say so plainly but still draft the card so they can decide.`;
}

/* ----- scoring: every call, carded or not, on Yahoo 5-minute bars, post → close */
async function yBars5(ticker: string): Promise<{ t: number; o: number; h: number; l: number; c: number }[]> {
  return cached(`yb5|${ticker}`, 5 * 60e3, async () => {
    const r = await fetch("https://query1.finance.yahoo.com/v8/finance/chart/" + encodeURIComponent(ticker) + "?range=5d&interval=5m", { headers: UA });
    if (!r.ok) throw new Error("yahoo HTTP " + r.status);
    const j = await r.json(); const x = j?.chart?.result?.[0];
    if (!x?.timestamp) throw new Error("no bars for " + ticker);
    const q = x.indicators?.quote?.[0] || {};
    return x.timestamp.map((t: number, i: number) => ({ t, o: q.open?.[i], h: q.high?.[i], l: q.low?.[i], c: q.close?.[i] }))
      .filter((b: any) => [b.o, b.h, b.l, b.c].every((v) => typeof v === "number"));
  });
}

async function jasonScoreRow(r: any, actsById: Record<string, any>) {
  const a = r.action_id ? actsById[r.action_id] : null;
  const card = a ? { status: a.status, outcome: a.outcome?.state || null, r: a.outcome?.r ?? null } : null;
  if (r.kind !== "call" || !r.ticker || !r.posted_at) return { state: "unscored", why: !r.ticker ? "no ticker" : r.kind !== "call" ? "not a call" : "no time", card };
  const t0 = Date.parse(r.posted_at) / 1000;
  const bars = await yBars5(r.ticker);
  const close = Date.parse(nyIso(r.day, "4:00 PM") || "") / 1000;
  const day = bars.filter((b) => b.t + 300 > t0 && b.t < close);
  if (!day.length) return { state: "unscored", why: "no bars after the post", card };
  const ref = day[0].c;                     // close of the 5-min bar the post landed in
  const dir = r.direction === "short" ? -1 : 1;
  const after = day.slice(1);
  const hi = Math.max(ref, ...after.map((b) => b.h)), lo = Math.min(ref, ...after.map((b) => b.l));
  const last = (after[after.length - 1] || day[0]).c;
  const pct = (v: number) => +(((v - ref) / ref) * 100 * dir).toFixed(2);
  const close_pct = pct(last);
  return { state: close_pct > 0.05 ? "worked" : close_pct < -0.05 ? "failed" : "flat", ref: +ref.toFixed(2), close: +last.toFixed(2),
    close_pct, best_pct: dir > 0 ? pct(hi) : pct(lo), worst_pct: dir > 0 ? pct(lo) : pct(hi), card, assumed_long: !r.direction };
}

// Score finished days (or today after 4:05 PM). Bounded per call.
async function jasonScoreDue(budget = 15) {
  const now = etParts();
  const doneToday = !["Sat", "Sun"].includes(now.wd) && now.min >= 965;
  const rows = await db(`otto_jason?select=*&kind=eq.call&score=is.null&order=day.desc&limit=60`).catch(() => []);
  const due = rows.filter((r: any) => r.day < now.date || (r.day === now.date && doneToday) || ["Sat", "Sun"].includes(now.wd));
  if (!due.length) return 0;
  const ids = [...new Set(due.map((r: any) => r.action_id).filter(Boolean))];
  const acts = ids.length ? await db("otto_actions?select=id,status,outcome&id=in.(" + ids.join(",") + ")").catch(() => []) : [];
  const by: Record<string, any> = Object.fromEntries(acts.map((a: any) => [a.id, a]));
  let n = 0;
  for (const r of due.slice(0, budget)) {
    let s: any;
    try { s = await jasonScoreRow(r, by); } catch (e) { s = { state: "unscored", why: String((e as Error).message).slice(0, 120) }; }
    await db("otto_jason?id=eq." + r.id, { method: "PATCH", headers: { prefer: "return=minimal" }, body: JSON.stringify({ score: s }) }).catch(() => {});
    n++;
  }
  return n;
}

async function jasonToday() {
  const day = etParts().date;
  const rows = await jasonTodayRows(day);
  const ids = [...new Set(rows.map((r: any) => r.action_id).filter(Boolean))];
  const acts = ids.length ? await db("otto_actions?select=id,status,title&id=in.(" + ids.join(",") + ")").catch(() => []) : [];
  const by: Record<string, any> = Object.fromEntries(acts.map((a: any) => [a.id, a]));
  return { ok: true, day, rows: rows.map((r: any) => ({ id: r.id, at: r.posted_at, label: r.posted_label, kind: r.kind, ticker: r.ticker,
    direction: r.direction, late: r.late, entry: r.entry, level: r.level, option: r.option, words: r.words, summary: r.summary,
    source: r.source, card: r.action_id && by[r.action_id] ? { id: r.action_id, status: by[r.action_id].status, title: by[r.action_id].title } : null,
    score: r.score || null })) };
}

// The banner at the time of a post, from otto_sentiment history.
async function bannerAt(iso: string): Promise<string | null> {
  const r = await db(`otto_sentiment?select=verdict,at&at=lte.${encodeURIComponent(iso)}&order=at.desc&limit=1`).catch(() => []);
  return r?.[0] && Date.parse(iso) - Date.parse(r[0].at) < 3 * 3600e3 ? r[0].verdict : null;
}

async function jasonScorecard() {
  await jasonScoreDue(10).catch(() => 0);
  const rows = await db("otto_jason?select=*&kind=eq.call&order=day.desc,posted_at.desc&limit=400").catch(() => []);
  const ids = [...new Set(rows.map((r: any) => r.action_id).filter(Boolean))];
  const acts = ids.length ? await db("otto_actions?select=id,status,outcome&id=in.(" + ids.join(",") + ")").catch(() => []) : [];
  const by: Record<string, any> = Object.fromEntries(acts.map((a: any) => [a.id, a]));
  const pnl: Record<string, number> = {};
  if (ids.length) (await db("otto_trades?select=action_id,pnl&action_id=in.(" + ids.join(",") + ")").catch(() => []))
    .forEach((t: any) => { if (t.pnl != null) pnl[t.action_id] = (pnl[t.action_id] || 0) + Number(t.pnl); });
  // banner tone at post time (cached per row in score.banner once known)
  for (const r of rows.slice(0, 60)) {
    if (r.score && r.score.banner === undefined && r.posted_at) {
      const v = await bannerAt(r.posted_at);
      r.score.banner = v;
      await db("otto_jason?id=eq." + r.id, { method: "PATCH", headers: { prefer: "return=minimal" }, body: JSON.stringify({ score: r.score }) }).catch(() => {});
    }
  }
  const tone = (v: string | null) => !v ? null : /long/i.test(v) ? "long" : /short/i.test(v) ? "short" : "none";
  const scored = (l: any[]) => l.filter((r) => r.score && ["worked", "failed", "flat"].includes(r.score.state));
  const agg = (l: any[]) => { const s = scored(l), w = s.filter((r) => r.score.state === "worked").length;
    return { n: l.length, scored: s.length, worked: w, rate: s.length ? w / s.length : null,
      avg_close: s.length ? s.reduce((x, r) => x + r.score.close_pct, 0) / s.length : null,
      avg_best: s.length ? s.reduce((x, r) => x + r.score.best_pct, 0) / s.length : null }; };
  const minOf = (r: any) => r.posted_at ? etParts(new Date(r.posted_at)).min : -1;
  const fresh = rows.filter((r: any) => !r.late);
  const taken = rows.filter((r: any) => r.action_id && by[r.action_id]?.status === "done");
  const passed = rows.filter((r: any) => !(r.action_id && by[r.action_id]?.status === "done"));
  const cardWL = taken.map((r: any) => by[r.action_id]?.outcome?.state).filter((s: any) => s === "win" || s === "loss");
  const splits = [
    ["Posted 9:30–10:00 (first 30 min)", fresh.filter((r: any) => minOf(r) >= 570 && minOf(r) < 600)],
    ["Posted 10:00–11:00", fresh.filter((r: any) => minOf(r) >= 600 && minOf(r) < 660)],
    ["Posted 11:00–2:00", fresh.filter((r: any) => minOf(r) >= 660 && minOf(r) < 840)],
    ["Posted after 2:00", fresh.filter((r: any) => minOf(r) >= 840)],
    ["With the banner", fresh.filter((r: any) => { const t = tone(r.score?.banner); return t && t !== "none" && t === r.direction; })],
    ["Against the banner", fresh.filter((r: any) => { const t = tone(r.score?.banner); return t && t !== "none" && r.direction && t !== r.direction; })],
    ["Banner said No edge / No read", fresh.filter((r: any) => tone(r.score?.banner) === "none")],
    ["Late calls (\"should have called it\")", rows.filter((r: any) => r.late)],
  ].map(([k, l]: any) => ({ key: k, ...agg(l) }));
  return { ok: true, since: rows.length ? rows[rows.length - 1].day : null,
    all: agg(rows), fresh: agg(fresh), taken: { ...agg(taken), pnl: taken.reduce((s: number, r: any) => s + (pnl[r.action_id] || 0), 0),
      card_wins: cardWL.filter((s: any) => s === "win").length, card_losses: cardWL.filter((s: any) => s === "loss").length },
    passed: agg(passed), splits,
    recent: rows.slice(0, 20).map((r: any) => ({ day: r.day, label: r.posted_label, ticker: r.ticker, direction: r.direction, late: r.late,
      words: r.words, taken: !!(r.action_id && by[r.action_id]?.status === "done"), score: r.score || null })) };
}

// 5 PM sweep: the scheduled task reads today's Jason posts in Discord and sends the texts here.
async function jasonSweep(body: any, who: string) {
  const apiKey = (await roomKey()).key;                                                // v5.0
  const day = /^\d{4}-\d{2}-\d{2}$/.test(String(body.date || "")) ? String(body.date) : etParts().date;
  const posts = Array.isArray(body.posts) ? body.posts.slice(0, 200) : [];
  const before = await db(`otto_jason?select=id&day=eq.${day}`).catch(() => []);
  let found: any[] = [];
  if (posts.length) {
    const text = posts.map((p: any) => `[${String(p.time || "").slice(0, 12)}] Jason: ${String(p.text || "").slice(0, 600)}`).join("\n");
    found = await jasonExtract(apiKey, { text, day });
  }
  const { inserted } = await jasonSave(found, day, "sweep", "5 PM sweep");
  await jasonScoreDue(20).catch(() => 0);
  const rows = await jasonTodayRows(day);
  const calls = rows.filter((r: any) => r.kind === "call");
  const sc = (r: any) => !r.score ? "not scored yet" : r.score.state === "unscored" ? "not scored (" + (r.score.why || "?") + ")"
    : `${r.score.state}: ${r.score.close_pct >= 0 ? "+" : ""}${r.score.close_pct}% by the close, best ${r.score.best_pct >= 0 ? "+" : ""}${r.score.best_pct}%`;
  const note = `Discord sweep (${etLabel(new Date().toISOString())} ET, Jason only): ${rows.length} post${rows.length === 1 ? "" : "s"} today` +
    `${posts.length ? "" : " — the sweep found no Jason messages"}, ${before.length} already pasted, ${inserted.length} caught now.\n\n` +
    (calls.length ? "Today's calls, scored from the post to the close (5-min bars, in the called direction):\n" +
      calls.map((r: any) => `· ${r.posted_label || "?"} ${r.ticker || "?"} ${r.direction || ""}${r.late ? " (late)" : ""} — ${sc(r)}`).join("\n") : "No calls today.") +
    (inserted.length ? "\n\nCaught by the sweep (not pasted during the day):\n" + inserted.map((r: any) => `· ${r.posted_label || "?"} ${r.kind}: ${r.words}`).join("\n") : "");
  await logDesk("assistant", "Jarvis · Discord sweep", note);
  return { ok: true, day, read: posts.length, posts: rows.length, caught: inserted.length, by: who };
}

/* ===================================================================== v3.9
   6 Oct 2026 — Otto Signals: never miss a call from the mentor again.

   Ifoma's decisions (6 Oct):
   - A Chrome extension on Ifoma's PC keeps the mentor's Discord channel open in
     a minimized window and sends every NEW message from the mentor's account
     (matched on his Discord user id, not his display name) here, with any chart
     images. Nobody else's messages come over.
   - Jarvis builds a card for every post that names a ticker and implies a trade,
     even when the mentor gives no direction — Jarvis decides long or short and
     says why. Ifoma or Josh decide whether to Approve.
   - Both phones ping only when there's a call (card). No ping for chatter.
     No quiet hours.
   - Everything is kept permanently in otto_jason (the log). His levels are
     dated and expire at that day's close. Never part of the teaching brain.
   - If the watcher goes quiet in market hours, both phones get pinged.
   The mentor's name / Discord ids live in otto_settings "signals", so the
   feature isn't tied to Jason (Otto may be sold or shared later). */

const SIG_DEFAULT: any = { mentor: "Jason", author_id: "474721184903200819", author_name: "Jason",
  guild: "1135603258702958693", channel: "1139244584757637192", channel_name: "#💎┃platinum-chat" };
const SIG_FRESH_MS = 20 * 60e3;          // older than this when caught = log only, no card, no ping
const SIG_OFFLINE_MS = 5 * 60e3;

async function sigCfg(): Promise<any> {
  return { ...SIG_DEFAULT, ...((await setting("signals").catch(() => null)) || {}) };
}

async function signalsCfgSet(b: any, who: string) {
  const cur = await sigCfg();
  const txt = (v: any, n: number) => String(v ?? "").replace(/[<>]/g, "").trim().slice(0, n);
  const id = (v: any) => String(v ?? "").replace(/\D/g, "").slice(0, 24);
  const next: any = { ...cur };
  if (b.mentor !== undefined && txt(b.mentor, 30)) next.mentor = txt(b.mentor, 30);
  if (b.author_name !== undefined) next.author_name = txt(b.author_name, 40);
  if (b.channel_name !== undefined) next.channel_name = txt(b.channel_name, 60);
  for (const k of ["author_id", "guild", "channel"]) if (b[k] !== undefined && id(b[k])) next[k] = id(b[k]);
  if (b.new_key || !next.key) next.key = b64u(crypto.getRandomValues(new Uint8Array(24)));
  next.updated_by = who; next.updated_at = new Date().toISOString();
  await putSetting("signals", next, who);
  return next;
}

const SIG_TOOL = { ...JASON_TOOL, description: "Record the mentor's NEW posts (every message given was written by the mentor)." };
const sigReadSys = (mentor: string) => `You read ${mentor}'s posts from his trading Discord. Every message you are given was written by ${mentor} (already filtered by his Discord account). He writes in short bursts, often ALL CAPS, across several lines, and usually pings his members when he calls something. A call is often just a ticker and a direction ("SPCX LONG"); levels are often only drawn on his chart screenshot. Group lines that belong to the same thought into one post (e.g. "SPCX LONG" + "BREAK HAPPENED IN CASE YOU MISSED IT" = one call). Record ONLY the messages under NEW; messages under EARLIER are context you may use to understand the new ones (which ticker he means, what the chart is), never record them again. Never invent numbers: entry/level/option only when he wrote them or the chart labels them with a number. A message that is only a ping (@Members, @someone) is not a post. Use the post's time exactly as given in [brackets].`;

async function sigExtract(apiKey: string, mentor: string, text: string, imgs: { mime: string; data: string }[], day: string) {
  if (TEST?.extract) return TEST.extract(text);
  const content: any[] = imgs.slice(0, 3).map((i) => ({ type: "image", source: { type: "base64",
    media_type: /^image\/(jpeg|png|webp|gif)$/.test(i.mime) ? i.mime : "image/jpeg", data: i.data } }));
  content.push({ type: "text", text: `Discord messages from ${mentor}, ${day} (New York time).${imgs.length ? " The image(s) above are charts attached to the NEW messages." : ""}\n\n${text.slice(0, 20000)}\n\nRecord ${mentor}'s NEW posts.` });
  const r = await aiFetch("signal_extract", {
    method: "POST", signal: AbortSignal.timeout(75_000),         // v3.9.4: never hang the read
    headers: { "content-type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model: MODEL, max_tokens: 4000, system: sigReadSys(mentor), tools: [SIG_TOOL],
      tool_choice: { type: "tool", name: "record_posts" }, messages: [{ role: "user", content }] }),
  });
  if (!r.ok) throw new Error("reading the post failed: claude HTTP " + r.status + " " + (await r.text()).slice(0, 160));
  const j = await r.json();
  const tu = (j.content || []).find((b: any) => b.type === "tool_use");
  const posts = Array.isArray(tu?.input?.posts) ? tu.input.posts : [];
  return posts.filter((p: any) => p && J_KINDS.has(p.kind) && String(p.words || "").trim() &&
    !/^\s*(@\S+(\s+Members)?[\s/]*)+$/i.test(String(p.words)));
}

const nyTime = (iso: string) => fmtMin(etParts(new Date(iso)).min);

// The extension calls this: heartbeats, and new messages from the mentor's account.
async function signalIn(req: Request) {
  const cfg = await sigCfg();
  const key = req.headers.get("x-otto-signal") || "";
  if (!cfg.key || key.length < 16 || key !== cfg.key) throw new Error("bad watcher key — copy a fresh pairing code from Otto → Settings → Otto Signals");
  const body = await req.json().catch(() => ({}));
  const pub = { mentor: cfg.mentor, author_id: cfg.author_id, author_name: cfg.author_name, guild: cfg.guild, channel: cfg.channel, channel_name: cfg.channel_name };

  if (body.kind === "beat") {
    const prev = (await setting("signal_beat").catch(() => null)) || {};
    const state = String(body.state || "ok").slice(0, 30);
    const now = new Date().toISOString();
    const beat = { at: now, state, detail: String(body.detail || "").slice(0, 200), ver: String(body.ver || "").slice(0, 20),
      seen: Number(body.seen) || 0, bad_since: state === "ok" ? null : (prev.bad_since || now),
      queue: Number(body.queue) || 0, queue_age: Number(body.queue_age) || 0, send_error: String(body.send_error || "").slice(0, 160),
      unknown_authors: Number(body.unknown_authors) || 0, auto_scrolls: Number(body.auto_scrolls) || 0,   // v3.17 / extension 1.3
      offline_sent: !!prev.offline_sent, last_msg_at: prev.last_msg_at || null };
    if (prev.offline_sent && state === "ok" && !(Number(body.queue_age) > SIG_OFFLINE_MS / 1000)) {
      beat.offline_sent = false;
      await notify("watcher", "✅ Otto Signals watcher is back", `Watching the signals again. Anything posted while it was down is picked up when the window catches up.`, "./#signals");
    }
    await putSetting("signal_beat", beat, "watcher");
    return { ok: true, cfg: pub };
  }

  if (body.kind !== "msgs") throw new Error("unknown kind");
  const list = (Array.isArray(body.msgs) ? body.msgs : []).slice(0, 30)
    .filter((m: any) => /^\d{5,24}$/.test(String(m.id || "")) && String(m.author_id || "") === cfg.author_id);
  const accepted = list.map((m: any) => String(m.id));
  if (!list.length) return { ok: true, new: 0, accepted, cfg: pub };
  const rows = list.map((m: any) => {
    const at = Date.parse(m.at) ? new Date(m.at).toISOString() : new Date().toISOString();
    const imgs = (Array.isArray(m.images) ? m.images : []).filter((i: any) => typeof i?.data === "string" && i.data.length > 100 && i.data.length < 7_000_000).slice(0, 4);
    return { msg_id: String(m.id), day: etParts(new Date(at)).date, posted_at: at, author: String(m.author || cfg.author_name).slice(0, 40),
      text: String(m.text || "").slice(0, 4000), imgs: imgs.length, channel: String(m.channel || cfg.channel).slice(0, 24), _imgs: imgs };
  });
  // v3.17 (extension 1.3): an edited post, or one whose chart loaded late, comes back with edited:true.
  // If we have it and something changed, update it and read the new version; if we never got it, it's new.
  const editIds = new Set(list.filter((m: any) => m.edited).map((m: any) => String(m.id)));
  let edited: any[] = [];
  if (editIds.size) {
    const have = await db("otto_signal_msgs?select=msg_id,text,imgs&msg_id=in.(" + [...editIds].join(",") + ")").catch(() => []);
    for (const h of have || []) {
      const r = rows.find((x: any) => x.msg_id === h.msg_id);
      const newText = r.text !== String(h.text || ""), newImgs = r._imgs.length > Number(h.imgs || 0);
      if (newText || newImgs) {
        await db("otto_signal_msgs?msg_id=eq." + h.msg_id, { method: "PATCH", headers: { prefer: "return=minimal" },
          body: JSON.stringify({ text: r.text, imgs: Math.max(r._imgs.length, Number(h.imgs || 0)) }) }).catch(() => {});
        edited.push({ msg_id: r.msg_id, posted_at: r.posted_at, text: (newText ? "[edited] " : "[chart added] ") + r.text, imgs: r._imgs.length, _imgs: newImgs ? r._imgs : [] });
      }
    }
    const haveIds = new Set((have || []).map((h: any) => h.msg_id));
    for (let i = rows.length - 1; i >= 0; i--) if (haveIds.has(rows[i].msg_id)) rows.splice(i, 1);   // the rest are new to us
  }
  const insNew = rows.length ? await db("otto_signal_msgs?on_conflict=msg_id&select=msg_id,posted_at,text,imgs", { method: "POST",
    headers: { prefer: "resolution=ignore-duplicates,return=representation" },
    body: JSON.stringify(rows.map(({ _imgs, ...r }: any) => r)) }) : [];
  const ins = [...(insNew || []), ...edited.map(({ _imgs, ...r }: any) => r)];
  if (edited.length) rows.push(...edited);
  if (!ins?.length) return { ok: true, new: 0, accepted, cfg: pub };
  const fresh = new Set(ins.map((r: any) => r.msg_id));
  const imgRows = rows.filter((r: any) => fresh.has(r.msg_id)).flatMap((r: any) => r._imgs.map((i: any) => ({ msg_id: r.msg_id, mime: String(i.mime || "image/jpeg").slice(0, 30), data: i.data })));
  if (imgRows.length) await db("otto_signal_imgs", { method: "POST", headers: { prefer: "return=minimal" }, body: JSON.stringify(imgRows) }).catch(() => {});
  const batch = await db("otto_signal_batches", { method: "POST", body: JSON.stringify({ day: etParts().date, msg_ids: [...fresh], status: "reading" }) });
  const bid = batch?.[0]?.id;
  await db("otto_signal_msgs?msg_id=in.(" + [...fresh].join(",") + ")", { method: "PATCH", headers: { prefer: "return=minimal" }, body: JSON.stringify({ batch_id: bid }) }).catch(() => {});
  const prev = (await setting("signal_beat").catch(() => null)) || {};
  await putSetting("signal_beat", { ...prev, last_msg_at: new Date().toISOString() }, "watcher").catch(() => {});
  background(signalProcess(bid, ins, imgRows.map((i: any) => ({ mime: i.mime, data: i.data })), cfg));
  return { ok: true, new: ins.length, batch: bid, accepted, cfg: pub };
}

async function sigBatch(id: number, patch: any) {
  if (!id) return;
  if (patch && typeof patch.read === "string") patch = { ...patch, read: unname(patch.read) };
  await db("otto_signal_batches?id=eq." + id, { method: "PATCH", headers: { prefer: "return=minimal" }, body: JSON.stringify(patch) }).catch(() => {});
}

function signalPrompt(cfg: any, rows: any[], carded: any[]) {
  return `[⚡ OTTO SIGNAL — ${cfg.mentor} just posted in Discord ${cfg.channel_name}. The watcher caught it live; nobody typed this. Ifoma and Josh are NOT watching the chat — your card and your read are how they hear about it, so be fast and complete.]
${rows.map(jLine).join("\n")}
${carded.length ? "Already carded today (do NOT make a second card for these unless he gives a new direction or a new entry): " + carded.map((r: any) => `${r.ticker} ${r.direction || ""} at ${r.posted_label || "?"}`).join("; ") + "\n" : ""}
Do this:
1. A CALL (he gives the direction — long/short, calls/puts, above/below a level to trade it) gets ONE opening option card via propose_action, in HIS direction. A post that names a ticker with NO direction and no level gets a card only if you can read a clear direction from his words, his chart, the banner and the price right now (fetch it) — say plainly the direction is yours.
1a. v3.26 (Ifoma, 9 Oct): a LEVEL with no direction from him ("MSFT 532.40 RESISTANCE", "ABBV AT RESISTANCE", "752 POSSIBLE BOUNCE ZONE") gets NO card — don't pick a side. The server puts it on the Watcher both ways; the card comes when price touches it and a 5-minute candle closes. Put the level in your read. (v3.30: the server refuses a card for a level with no direction, so don't build one.) When he DOES give a direction with a level ("buy above X"), plan.setup = "otto signal", plan.jason_id = the #id above, and fill in everything he did NOT give — the contract (delta .30–.40, volume > open interest, a sensible expiry), limit, quantity inside our limits, TP1, wrong-if and stop_option — as precisely as you can; in the card summary say which parts are ${cfg.mentor}'s and which are yours.
2. A LATE post (he says he missed calling it / it already moved): still make the card, start the title with "LATE", and say plainly in the summary that chasing breaks his entry rules.
3. If the banner, one of his rules or our limits argue against it, say so in the card summary — but still make the card. Ifoma and Josh decide.
3b. ONE card per post (Ifoma, 8 Oct): card ★ if it fits buying power, otherwise ◆; if nothing fits, card the cheapest anyway (it gets a red banner).
4. A WATCH LIST or a conditional level ("AMD ABOVE 646", "SUPPORT $379 TSLA", "WATCH LIST THIS MORNING") is not a call yet: no card. Put the trigger levels in your read. The card comes when he says it triggered / broke / held, or calls it.
5. Commentary, chatter, or a chart with no tradeable call: no card.
Work quietly — don't narrate your lookups. When you're done, write the read for the Otto Signals feed, starting with a line that is exactly READ: — everything after that line is what Ifoma and Josh see. For each post, 1–3 short plain lines: what he said; for a card, your direction and WHY; and what would prove it wrong. No headers, no tables.`;
}

export async function signalProcess(bid: number, ins: any[], imgs: { mime: string; data: string }[], cfg: any) {
  const apiKey = Deno.env.get("ANTHROPIC_KEY") || "";
  try {
    ins.sort((a: any, b: any) => Date.parse(a.posted_at) - Date.parse(b.posted_at));
    const first = Date.parse(ins[0].posted_at), last = Date.parse(ins[ins.length - 1].posted_at);
    const day = etParts(new Date(last)).date;
    const fresh = Date.now() - last < SIG_FRESH_MS;
    const earlier = await db(`otto_signal_msgs?select=posted_at,text,imgs&posted_at=gte.${new Date(first - 45 * 60e3).toISOString()}&posted_at=lt.${new Date(first).toISOString()}&order=posted_at.asc&limit=12`).catch(() => []);
    const line = (r: any) => `[${nyTime(r.posted_at)}] ${r.text || "(no text)"}${r.imgs ? " [chart image attached]" : ""}`;
    const text = (earlier.length ? "EARLIER (already recorded — context only):\n" + earlier.map(line).join("\n") + "\n\n" : "") + "NEW:\n" + ins.map(line).join("\n");
    const ex = await sigExtract(apiKey, cfg.mentor, text, imgs, day);   // v5.9.3: read once — a failed ticker check used to pay for the whole read (images and all) a second time
    const vt = await verifyTickers(ex).catch(() => null);
    const posts = vt ? vt.posts : ex;
    const { inserted, all } = await jasonSave(posts, day, "watcher", "Otto Signals");
    for (const q of vt?.asks || []) { await logDesk("system", "Otto", q); await notify("signal", `⚡ ${SIG_LABEL}: which stock?`, q.slice(0, 180), "./#desk"); }
    const ids = all.map((r: any) => r.id);
    // v3.9.2: judge EACH post — only posts that are new to the log AND posted in the last 20 min
    // can ping or get a card. Old posts in a catch-up batch (reload / PC wake) are logged only.
    const newIds = new Set((inserted || []).map((r: any) => r.id));
    const live = all.filter((r: any) => newIds.has(r.id) &&
      (r.posted_at ? Date.now() - Date.parse(r.posted_at) < SIG_FRESH_MS : fresh));
    const tradeable = live.filter((r: any) => r.ticker && (r.kind === "call" || r.kind === "level"));
    const freshImg = ins.some((m: any) => m.imgs && Date.now() - Date.parse(m.posted_at) < SIG_FRESH_MS);
    if (!live.length && !freshImg) { await sigBatch(bid, { rows: ids, status: all.length ? "caught_up" : "nothing", read: null }); return; }
    if (!tradeable.length && !freshImg) {
      await sigBatch(bid, { rows: ids, status: "chatter" });
      return;
    }
    // v3.11: is a card for the same ticker already being built (another burst a moment ago)? Then this burst is a
    // follow-up ("BREAK HAPPENED…"): no second card, no second ping. Ask about it in the signal's chat if needed.
    const building = await db(`otto_signal_batches?select=id,rows&status=eq.jarvis&id=neq.${bid}&created_at=gte.${new Date(Date.now() - 5 * 60e3).toISOString()}`).catch(() => []);
    const bRows = building.flatMap((x: any) => x.rows || []);
    const bTick = bRows.length ? new Set((await db("otto_jason?select=ticker&id=in.(" + bRows.join(",") + ")").catch(() => [])).map((r: any) => r.ticker).filter(Boolean)) : new Set();
    if (tradeable.length && tradeable.every((r: any) => bTick.has(r.ticker))) {
      await sigBatch(bid, { rows: ids, status: "followup", read: `Follow-up to the ${[...new Set(tradeable.map((r: any) => r.ticker))].join(", ")} call a moment ago — Jarvis's card for it covers this. Ask below if you want a different card.` });
      return;
    }
    await sigBatch(bid, { rows: ids, status: "jarvis" });
    // v3.9.1: ping FIRST for an outright call, so a call is never missed even if the card build dies.
    for (const r of tradeable.filter((r: any) => r.kind === "call")) {
      await notify("signal", `⚡ ${SIG_LABEL}: ${r.ticker}${r.direction ? " " + r.direction.toUpperCase() : ""}${r.late ? " (late)" : ""}`,
        `"${String(r.words).slice(0, 100)}" — Jarvis is building the card now.`, "./#signals");
    }
    // Jarvis gets his own invocation (own wall-clock budget): reading the post must not eat his time.
    if (!(await kickJarvis(bid))) await signalJarvis(bid);
  } catch (e) {
    const m = String((e as Error).message || e).slice(0, 300);
    await sigBatch(bid, { status: "error", error: m });
    await notify("signal", `⚡ ${SIG_LABEL} posted — Otto couldn't read it`, `${String(ins.map((r: any) => r.text).join(" / ")).slice(0, 120)} · ${m.slice(0, 80)}`, "./#signals");
  }
}

// v3.12: start a long job as its own run of this function (own wall-clock budget).
async function kick(fn: string, body: any): Promise<boolean> {
  const base = Deno.env.get("SUPABASE_URL"), anon = Deno.env.get("SUPABASE_ANON_KEY"), sec = Deno.env.get("OTTO_CRON_SECRET") || "";
  if (!base || !anon || sec.length < 16) return false;
  try {
    const r = await fetch(`${base}/functions/v1/otto-proxy?fn=${fn}`, { method: "POST",
      headers: { apikey: anon, authorization: "Bearer " + anon, "x-otto-cron": sec, "content-type": "application/json" }, body: JSON.stringify(body || {}) });
    return r.status === 202;
  } catch { return false; }
}
// v3.9.1: start the card build as a separate run of this function.
async function kickJarvis(bid: number): Promise<boolean> {
  const base = Deno.env.get("SUPABASE_URL"), anon = Deno.env.get("SUPABASE_ANON_KEY"), sec = Deno.env.get("OTTO_CRON_SECRET") || "";
  if (!base || !anon || sec.length < 16) return false;
  try {
    const r = await fetch(`${base}/functions/v1/otto-proxy?fn=signal_jarvis&batch=${bid}`, { method: "POST",
      headers: { apikey: anon, authorization: "Bearer " + anon, "x-otto-cron": sec, "content-type": "application/json" }, body: "{}" });
    return r.status === 202;
  } catch { return false; }
}

export async function signalJarvis(bid: number) {
  const cfg = await sigCfg();
  const b = (await db("otto_signal_batches?select=*&id=eq." + bid))?.[0];
  if (!b || b.status !== "jarvis") return;
  let all: any[] = [];
  const t0 = Date.now();
  try {
    all = (b.rows || []).length ? await db("otto_jason?select=*&id=in.(" + b.rows.join(",") + ")&order=id.asc") : [];
    // v3.9.2: only posts saved by THIS batch and posted within 20 min of it go to Jarvis.
    const bAt = Date.parse(b.created_at);
    all = all.filter((r: any) => Date.parse(r.created_at) >= bAt - 5000 && (!r.posted_at || bAt - Date.parse(r.posted_at) < SIG_FRESH_MS));
    const ids = all.map((r: any) => r.id);
    const tradeable = all.filter((r: any) => r.ticker && (r.kind === "call" || r.kind === "level"));
    const day = all[0]?.day || etParts().date;
    const today = await jasonTodayRows(day);
    const tick = new Set(tradeable.map((r: any) => r.ticker));
    const carded = today.filter((r: any) => r.action_id && tick.has(r.ticker) && !ids.includes(r.id) &&
      r.posted_at && Date.now() - Date.parse(r.posted_at) < 90 * 60e3);
    // v3.16: the server fetches price, buying power and the near-the-money contracts first (MU, 6 Oct: Jarvis spent
    // every step paging the chain from $5 and never made the card).
    // v3.23 (Ifoma, 8 Oct): ONE call to card → Jarvis makes it in ONE forced step with everything pre-fetched (price, 5-min bars,
    // contracts, buying power), one retry, then no card + why. Target: post → card under 30 s. Several calls at once → the old loop.
    const open1 = tradeable.filter((r: any) => !carded.some((c: any) => c.ticker === r.ticker));
    const callRows = open1.filter((r: any) => r.kind === "call");
    const oneStep = callRows.length === 1 && new Set(open1.map((r: any) => r.ticker)).size === 1;
    // v3.29: level posts only, one ticker → the same one-step path, but the card is optional (a level may not be a setup).
    const levelOne = !oneStep && callRows.length === 0 && open1.length > 0 && open1.every((r: any) => r.kind === "level")
      && new Set(open1.map((r: any) => r.ticker)).size === 1 && !!v322Sym(open1[0].ticker);
    const fast = oneStep || levelOne;
    const anchor = oneStep ? callRows[0] : open1[open1.length - 1];
    // v3.30 (item 1): tickers whose only open post is a level with no direction → the server refuses a card for them.
    const blockLevels: Record<string, any> = {};
    for (const r of open1) if (r.kind === "level" && !r.direction && !open1.some((x: any) => x.ticker === r.ticker && x.kind !== "level")) blockLevels[String(v322Sym(r.ticker) || r.ticker).toUpperCase()] = r;
    const levelNoDir = levelOne && open1.every((r: any) => !r.direction);
    const [setup, pre] = await Promise.all([fast ? deskSetup({ fast: true }) : deskSetup(),
      (fast ? signalPack(anchor) : signalPrefetch(open1)).catch(() => "")]);
    const { cs, sys, tools, ctxLine } = setup;
    const preBlock = pre ? `\nPRE-FETCHED BY THE SERVER (live, use these — the option_id values are exact; don't page the chain again unless nothing here works):\n${pre}\n` +
      `Build the card from ★ if it fits buying power, otherwise ◆ — one card. Limit price = the ask or a cent under. Make the card in your FIRST or SECOND step — speed is the edge on a signal.\n` : "";
    const prompt = ctxLine + "\n" + signalPrompt(cfg, all, carded) + preBlock;
    const mustCard = tradeable.some((r: any) => r.kind === "call" && !carded.some((c: any) => c.ticker === r.ticker));
    let res: any = { said: "", cards: [] as string[], did: [], failed: [], finalText: "" };
    let err = "";
    const pinged = new Set<string>();
    try {
      // v3.9.4: no TradingView tools in a card build — TradingView has been slow/rate-limited and it ate Jarvis's
      // time. Prices, chains and quotes come from Robinhood; the banner (Yahoo) is in the context line.
      if (fast) {
        res = await runDesk({ msgs: [{ role: "user", content: ctxLine + "\n" + signalPrompt(cfg, all, carded) + "\n" + (oneStep ? ONE_STEP_RULE : levelNoDir ? LEVEL_NO_DIR_RULE : LEVEL_ONE_STEP_RULE) + "\n" + pre }], sys,
          tools: [signalProposeTool(tools)], cs, who: "signals", send: () => {}, allowPropose: true, allowClose: false, maxRounds: 2, mustCard: oneStep, oneStep: true, optionalCard: levelOne, blockLevels,
          deadline: t0 + RUN_BUDGET_MS, onCard: async (id: string) => {        // ping the card the moment it exists, before the read is saved
            pinged.add(id);
            const row = anchor;
            row.action_id = id;
            await db("otto_jason?id=eq." + row.id, { method: "PATCH", headers: { prefer: "return=minimal" }, body: JSON.stringify({ action_id: id }) }).catch(() => {});
            await markPinged([id]);
            const a = (await db("otto_actions?select=title&id=eq." + id).catch(() => []))?.[0];
            await notify("signal", `🃏 Card ready: ${row.ticker} ${row.direction ? String(row.direction).toUpperCase() : ""}`.trim(),
              `${String(a?.title || "").slice(0, 100)} — from ${SIG_LABEL}: "${String(row.words || "").slice(0, 70)}". Tap to Approve or Reject (expires in 20 min).`, "./#signals");
            await sigBatch(bid, { cards: [id], timing: { posted: all[0]?.posted_at || null, caught: b.created_at, card_ms: Date.now() - t0, cards: 1,
              total_ms: all[0]?.posted_at ? Date.now() - Date.parse(all[0].posted_at) : null, one_step: true } }).catch(() => {});
          } });
        if (res.cardRead) res.said = "READ:\n" + res.cardRead;
      } else
      res = await runDesk({ msgs: [{ role: "user", content: prompt + "\n(Use Robinhood tools for prices, option chains and quotes — TradingView tools are not available in this run.)" }], sys,
        tools: tools.filter((t: any) => t.name !== "close_position" && !/^tv__/.test(String(t.name || ""))),
        cs, who: "signals", send: () => {}, allowPropose: true, allowClose: false, maxRounds: 8, mustCard, blockLevels, deadline: t0 + RUN_BUDGET_MS });
    } catch (e) { err = String((e as Error).message || e).slice(0, 300); }
    const acts = res.cards.length ? await db("otto_actions?select=id,title,plan,status&id=in.(" + res.cards.join(",") + ")").catch(() => []) : [];
    const open = tradeable.filter((r: any) => !r.action_id);
    for (const a of acts) {
      const row = all.find((r: any) => r.id === Number(a.plan?.jason_id)) || (open.length === 1 ? open[0] : null);
      if (row) { row.action_id = a.id; await db("otto_jason?id=eq." + row.id, { method: "PATCH", headers: { prefer: "return=minimal" }, body: JSON.stringify({ action_id: a.id }) }).catch(() => {}); }
    }
    // v3.9.3: keep only the final read (after the last "READ:" line). v3.16: never show the working notes — if there
    // is no READ: line, the server writes a plain one.
    const rawRead = res.said.trim();
    const cut = rawRead.lastIndexOf("READ:");
    // Calls that should have a card and don't (not counting tickers already carded earlier today).
    const cardTicks = new Set([...all.filter((r: any) => r.action_id).map((r: any) => r.ticker),
      ...acts.flatMap((a: any) => tradeable.filter((r: any) => new RegExp("\\b" + r.ticker + "\\b").test(String(a.title || ""))).map((r: any) => r.ticker))]);
    const missing = tradeable.filter((r: any) => r.kind === "call" && !r.action_id && !cardTicks.has(r.ticker) && !carded.some((c: any) => c.ticker === r.ticker));
    const why = err ? "Jarvis hit an error: " + err.slice(0, 120)
      : res.timedOut ? "Jarvis ran out of time"
      : (res.failed || []).includes("propose_action") ? "the card was rejected: " + String((res.errors || []).slice(-1)[0] || "bad contract or order details").replace(/^propose_action:\s*/, "").slice(0, 160)
      : res.outOfRounds && !res.cards.length ? "Jarvis ran out of steps before the card"
      : "Jarvis decided against a card — see the read";
    let read = cut >= 0 ? rawRead.slice(cut + 5).trim() : readFallback(all, res.cards, missing.length ? why : "none needed");
    try { const fc = await factCheck(read); if (fc.notes.length) read = fc.text.trim() + "\n\n" + fc.notes.join("\n"); } catch { /* v3.22 */ }
    if (missing.length && cut >= 0) read += `\n\n⚠ No card for ${missing.map((r: any) => r.ticker).join(", ")}: ${why}.`;   // the feed tag says "no card" (status stays "done")
    const prevT = pinged.size ? ((await db("otto_signal_batches?select=timing&id=eq." + bid).catch(() => []))?.[0]?.timing || null) : null;
    const timing = prevT || { posted: all[0]?.posted_at || null, caught: b.created_at, card_ms: Date.now() - t0, cards: res.cards.length, total_ms: all[0]?.posted_at ? Date.now() - Date.parse(all[0].posted_at) : null, one_step: fast };
    await sigBatch(bid, { status: err ? "error" : "done", read: read || null, cards: res.cards, error: err || (missing.length ? why : null), timing });
    if (acts.length) await markPinged(acts.map((a: any) => a.id));
    for (const a of acts.filter((x: any) => !pinged.has(x.id) && x.status !== "paper")) {
      const row = all.find((r: any) => r.action_id === a.id);
      await notify("signal", `${a.status === "paper_wait" ? "📝 Practice card" : "🃏 Card"} ready: ${row?.ticker || ""} ${row?.direction ? row.direction.toUpperCase() : ""}`.trim(),
        `${String(a.title || "").slice(0, 100)} — from ${SIG_LABEL}: "${String(row?.words || "").slice(0, 70)}". Tap to Approve or Reject (expires in 20 min).`, "./#signals");
    }
    // v3.16: a call with no card is never silent again (6 Oct MU: status "done", nobody told).
    for (const r of missing) {
      await notify("signal", `⚠️ ${SIG_LABEL}: ${r.ticker}${r.direction ? " " + r.direction.toUpperCase() : ""} — NO card`, `"${String(r.words).slice(0, 80)}" — ${why}. Open Otto Signals and ask Jarvis for the card.`, "./#signals");
    }
    if (missing.length) await logDesk("system", "Otto", `⚠ ${SIG_LABEL} ${missing.map((r: any) => r.ticker).join(", ")}: no card — ${why}. Ask in the signal's chat for one.`);
  } catch (e) {
    const m = String((e as Error).message || e).slice(0, 300);
    await sigBatch(bid, { status: "error", error: m });
    if (all.some((r: any) => r.kind === "call")) await notify("signal", `⚠️ ${SIG_LABEL} called something — no card`, `${m.slice(0, 120)}. Open Otto Signals.`, "./#signals");
  }
}

// v3.9.1: a card build that stalls (Supabase cut it off) is marked failed and pinged.
async function signalStale() {
  const cut = new Date(Date.now() - 4 * 60e3).toISOString();
  const stuck = await db(`otto_signal_batches?select=id,rows,status,msg_ids,created_at&status=in.(reading,jarvis)&created_at=lt.${cut}&limit=10`).catch(() => []);
  const cfg = await sigCfg();
  for (const b of stuck) {
    await sigBatch(b.id, { status: "error", error: "Timed out — the server cut the run off before Jarvis finished." });
    // v3.9.4: stalled while still READING the post (nothing saved yet) → ping with his raw words so nothing is missed.
    if (b.status === "reading" && !(b.rows || []).length && Date.now() - Date.parse(b.created_at) < 60 * 60e3) {
      const msgs = (b.msg_ids || []).length ? await db("otto_signal_msgs?select=text,posted_at&msg_id=in.(" + b.msg_ids.join(",") + ")").catch(() => []) : [];
      const words = msgs.map((m: any) => m.text).filter(Boolean).join(" / ").slice(0, 160);
      await notify("signal", `⚡ ${SIG_LABEL} posted — Otto couldn't read it`, `${words || "(a chart, no text)"} — open Discord or Otto Signals.`, "./#signals");
      continue;
    }
    const rows = (b.rows || []).length ? await db("otto_jason?select=ticker,kind,words,action_id&id=in.(" + b.rows.join(",") + ")").catch(() => []) : [];
    const calls = rows.filter((r: any) => r.kind === "call" && !r.action_id);
    if (calls.length) await notify("signal", `⚠️ No card for ${calls.map((r: any) => r.ticker).filter(Boolean).join(", ") || "a call"}`,
      `Jarvis timed out building it. Open Otto Signals and ask Jarvis for the card.`, "./#signals");
  }
}

/* ---- v3.10 (6 Oct 2026): a conversation under each Otto Signal (Ifoma: "chat in Otto Signals,
   only to talk about the signal he dropped / the card Jarvis made"). Kept out of the main Desk
   chat. "Clear chats" hides every signal conversation (the signals, reads and cards stay). */
async function signalChat(b: any, who: string) {
  const bid = Number(b.batch_id), text = String(b.text || "").trim().slice(0, 2000), author = String(b.author || "Ifoma").slice(0, 30);
  if (!bid || !text) throw new Error("say what you want to ask");
  const batch = (await db(`otto_signal_batches?select=*&id=eq.${bid}`))?.[0];
  if (!batch) throw new Error("that signal wasn't found");
  const cfg = await sigCfg();
  const [msgs, rows, cards, hist] = await Promise.all([
    (batch.msg_ids || []).length ? db("otto_signal_msgs?select=posted_at,text&msg_id=in.(" + batch.msg_ids.join(",") + ")&order=posted_at.asc").catch(() => []) : [],
    (batch.rows || []).length ? db("otto_jason?select=*&id=in.(" + batch.rows.join(",") + ")").catch(() => []) : [],
    (batch.cards || []).length ? db("otto_actions?select=id,title,summary,status&id=in.(" + batch.cards.join(",") + ")").catch(() => []) : [],
    db(`otto_signal_chat?select=role,author,content&batch_id=eq.${bid}&cleared=eq.false&order=id.asc&limit=30`).catch(() => []),
  ]);
  await db("otto_signal_chat", { method: "POST", headers: { prefer: "return=minimal" }, body: JSON.stringify({ batch_id: bid, role: "user", author, content: text }) });
  const { cs, sys, tools, ctxLine } = await deskSetup();
  const ctx = `[A conversation about ONE Otto Signal — stay on this signal only.
${cfg.mentor}'s message(s): ${msgs.map((m: any) => `[${nyTime(m.posted_at)}] ${m.text || "(chart)"}`).join(" / ") || "(none saved)"}
Posts read from it: ${rows.map(jLine).join("; ") || "(none)"}
Your read at the time: ${String(batch.read || "(none)").slice(0, 2500)}
Cards made for it: ${cards.map((c: any) => `"${c.title}" (${c.status}) — ${String(c.summary || "").slice(0, 400)}`).join(" | ") || "(none)"}
Answer questions about this signal and its card(s). If they ask for a change (strike, expiry, size, cheaper, puts instead of calls), make a NEW card with propose_action (plan.setup "otto signal", plan.jason_id = the post #id) — never say a card exists unless propose_action returned it. Use Robinhood for prices and chains (no TradingView here). Don't narrate your lookups: when done, write a line that is exactly ANSWER: and then your reply, short and plain.]`;
  const convo = hist.map((h: any) => `${h.role === "assistant" ? "Jarvis" : (h.author || "Ifoma")}: ${h.content}`).join("\n");
  const res = await runDesk({ msgs: [{ role: "user", content: `${ctxLine}\n${ctx}\n${convo ? "\nConversation so far:\n" + convo + "\n" : ""}\n${author}: ${text}` }], sys,
    tools: tools.filter((t: any) => t.name !== "close_position" && !/^tv__/.test(String(t.name || ""))),
    cs, who, send: () => {}, allowPropose: true, allowClose: false, maxRounds: 8 });
  const raw = res.said.trim(), cut = raw.lastIndexOf("ANSWER:");
  const answer = (cut >= 0 ? raw.slice(cut + 7) : raw).trim() || (res.cards.length ? "Card's up." : "(no answer)");
  await db("otto_signal_chat", { method: "POST", headers: { prefer: "return=minimal" }, body: JSON.stringify({ batch_id: bid, role: "assistant", author: "Jarvis", content: unname(answer).slice(0, 8000), cards: res.cards }) });
  if (res.cards.length) await sigBatch(bid, { cards: [...(batch.cards || []), ...res.cards] });
  return { ok: true, answer, cards: res.cards };
}
async function signalChatClear(who: string) {
  await db("otto_signal_chat?cleared=eq.false", { method: "PATCH", headers: { prefer: "return=minimal" }, body: JSON.stringify({ cleared: true, cleared_by: who }) });
  return { ok: true };
}

// The Otto Signals tab: newest bursts first, each with the mentor's messages, the posts read from them, Jarvis's read and the cards.
async function signalsFeed(days = 2) {
  const cfg = await sigCfg();
  const since = new Date(Date.now() - Math.min(Math.max(days, 1), 14) * 86400e3).toISOString();
  const batches = await db(`otto_signal_batches?select=*&created_at=gte.${since}&order=id.desc&limit=80`).catch(() => []);
  const msgIds = batches.flatMap((b: any) => b.msg_ids || []);
  const rowIds = batches.flatMap((b: any) => b.rows || []);
  const [msgs, imgs, rows] = await Promise.all([
    msgIds.length ? db("otto_signal_msgs?select=msg_id,posted_at,text,imgs&msg_id=in.(" + msgIds.join(",") + ")").catch(() => []) : [],
    msgIds.length ? db("otto_signal_imgs?select=id,msg_id&msg_id=in.(" + msgIds.join(",") + ")").catch(() => []) : [],
    rowIds.length ? db("otto_jason?select=id,kind,ticker,direction,late,summary,words,action_id,score&id=in.(" + rowIds.join(",") + ")").catch(() => []) : [],
  ]);
  const chats = batches.length ? await db("otto_signal_chat?select=id,batch_id,role,author,content,cards,created_at&cleared=eq.false&batch_id=in.(" + batches.map((b: any) => b.id).join(",") + ")&order=id.asc").catch(() => []) : [];
  const actIds = [...new Set([...rows.map((r: any) => r.action_id), ...batches.flatMap((b: any) => b.cards || []), ...chats.flatMap((c: any) => c.cards || [])].filter(Boolean))];
  const acts = actIds.length ? await db("otto_actions?select=id,status,title&id=in.(" + actIds.join(",") + ")").catch(() => []) : [];
  const A: Record<string, any> = Object.fromEntries(acts.map((a: any) => [a.id, a]));
  const M: Record<string, any> = Object.fromEntries(msgs.map((m: any) => [m.msg_id, m]));
  const R: Record<string, any> = Object.fromEntries(rows.map((r: any) => [r.id, r]));
  const I: Record<string, number[]> = {};
  imgs.forEach((i: any) => (I[i.msg_id] = I[i.msg_id] || []).push(i.id));
  return { ok: true, mentor: SIG_LABEL, channel_name: cfg.channel_name, beat: await setting("signal_beat").catch(() => null),
    batches: batches.map((b: any) => ({ id: b.id, at: b.created_at, status: b.status, read: b.read, error: b.error,
      msgs: (b.msg_ids || []).map((id: string) => M[id]).filter(Boolean).sort((x: any, y: any) => Date.parse(x.posted_at) - Date.parse(y.posted_at))
        .map((m: any) => ({ id: m.msg_id, at: m.posted_at, text: m.text, imgs: I[m.msg_id] || [] })),
      posts: (b.rows || []).map((id: number) => R[id]).filter(Boolean).map((r: any) => ({ id: r.id, kind: r.kind, ticker: r.ticker,
        direction: r.direction, late: r.late, summary: r.summary || r.words, score: r.score || null,
        card: r.action_id && A[r.action_id] ? { id: r.action_id, status: A[r.action_id].status, title: A[r.action_id].title } : null })),
      cards: (b.cards || []).map((id: string) => A[id]).filter(Boolean).map((a: any) => ({ id: a.id, status: a.status, title: a.title })),
      chat: chats.filter((c: any) => c.batch_id === b.id).map((c: any) => ({ role: c.role, author: c.author, content: c.content, at: c.created_at,
        cards: (c.cards || []).map((id: string) => A[id]).filter(Boolean).map((a: any) => ({ id: a.id, status: a.status, title: a.title })) })) })) };
}

async function signalImg(id: number) {
  if (!id) throw new Error("no image id");
  const r = await db("otto_signal_imgs?select=mime,data&id=eq." + id);
  if (!r?.[0]) throw new Error("image not found");
  return { ok: true, mime: r[0].mime, data: r[0].data };
}

// On the 2-minute market-hours cron: ping both phones if the watcher has gone quiet.
async function watcherCheck() {
  const cfg = await sigCfg();
  if (!cfg.key) return;                                   // never paired: nothing to watch
  await signalStale().catch(() => {});
  const b = await setting("signal_beat").catch(() => null);
  if (!b?.at || b.offline_sent) return;
  const age = Date.now() - Date.parse(b.at);
  const badFor = b.bad_since ? Date.now() - Date.parse(b.bad_since) : 0;
  let why = "";
  if (b.queue_age > SIG_OFFLINE_MS / 1000) why = `${b.queue} signal post(s) are stuck in the watcher (can't send to Otto${b.send_error ? ": " + b.send_error : ""}).`;
  else if (age > SIG_OFFLINE_MS) why = `No check-in for ${Math.round(age / 60e3)} minutes — the PC may be asleep, Chrome closed, or the internet down.`;
  else if (badFor > SIG_OFFLINE_MS) why = ({ logged_out: "Discord is signed out in the watcher window.", wrong_channel: `The watcher window isn't on ${cfg.channel_name}.`,
    no_tab: "The Discord watcher window is closed.", paused: "The watcher is paused in the extension.",
    scrolled_up: "The Discord window is scrolled up, so new posts don't load (the extension keeps scrolling it down — check the window)." } as any)[b.state] || `The watcher reports "${b.state}".`;
  if (!why) return;
  await putSetting("signal_beat", { ...b, offline_sent: true }, "cron");
  await notify("watcher", "⚠️ Otto Signals watcher is OFFLINE", `${why} Signals are NOT being caught. Check Ifoma's PC.`, "./#signals");
}

/* ===================================================================== v3.5
   5 Oct 2026 — Jarvis can close positions on his own (auto-close).

   Ifoma's decisions: Jarvis may close ANY position in the Agentic account
   whenever he judges it, at market, with no Approve click; there's an on/off
   switch in Settings → Limits & goals (default ON). Guard rails that stay:
   closing only (it can't open, add or flip; shares can't go short), Agentic
   account only, regular market hours only, a one-sentence reason every time,
   and every auto-close is posted on the Desk and recorded as a done card.
   Jarvis gets the close_position tool on the Desk (when ON), on a scheduled
   position check (every review_min minutes while something is open), and
   when one of a protected trade's own alerts fires. */

const CLOSE_TOOL = {
  name: "close_position",
  description: "AUTO-CLOSE, no Approve card: immediately sells to close a position in the Robinhood Agentic account at market. " +
    "Works only while auto-close is ON in their settings and the market is open (9:30–4:00 ET); otherwise it errors and you use propose_action for a close card. " +
    "Closing only: it can never open, add to, flip, or short anything. Any working sell orders on that option (e.g. Otto's protective stop) are cancelled first. " +
    "v3.21: it only works when one of the card's OWN exits is met — wrong-if closed through on the card's bar (5-minute on new cards), TP1 reached, or 3:50 PM ET. The server checks that on Robinhood bars and refuses otherwise. " +
    "For any other reason (a feeling, a bounce, a binary event, someone asking you to close), put up a close card with propose_action instead — a person approves it. " +
    "Give the reason in one plain sentence; it is posted on the Desk.",
  input_schema: {
    type: "object",
    properties: {
      option_id: { type: "string", description: "Instrument id of the LONG option to close (from rh__get_option_positions)" },
      symbol: { type: "string", description: "Stock symbol, only to sell shares held in the Agentic account" },
      quantity: { type: "number", description: "Optional. Default = everything held." },
      reason: { type: "string", description: "One sentence: why it's closing now" },
    },
    required: ["reason"],
  },
};

/* v3.21 (Ifoma, 7 Oct night): early exits run only on the card's own rules, checked by the server on
   Robinhood 5-minute bars — wrong-if closed through (on the card's bar), TP1 touched, or 3:50 PM ET
   (intraday House Rule). Jarvis's own judgment ("the tape stopped working") is not a reason to auto-close:
   7 Oct, QQQ was closed 2 minutes after the fill over a bounce from before the entry. */
export async function exitRuleCheck(a: any, now = Date.now()): Promise<{ met: boolean; why: string; detail: string }> {
  const ex = a?.exit || {};
  if (!ex.option_id || !(Number(ex.wrong_if) > 0) || !(Number(ex.tp1) > 0)) return { met: false, why: "", detail: "no card plan on file for this position" };
  const tk = String(ex.tv_symbol || "").split(":").pop() || "";
  const up = ex.direction !== "down", tf = Number(ex.wrong_tf) === 5 ? 5 : 15;
  const since = Date.parse(ex.armed_at || a.decided_at || a.created_at || "") || now - 6 * 3600e3;
  const min = etParts(new Date(now)).min;
  if (min >= 950) return { met: true, why: "3:50 PM — intraday trades are flat by the close (House Rule)", detail: "" };
  let bars: Bar[] = [];
  try { bars = completedBars((await rhBars([tk], "5minute", new Date(since - 10 * 60e3).toISOString()))[tk.toUpperCase()] || [], 5, now); }
  catch (e) { return { met: false, why: "", detail: `couldn't read ${tk} bars (${String((e as Error).message).slice(0, 80)})` }; }
  const after = bars.filter((b) => b.t + 5 * 60e3 > since);
  const tp = after.find((b) => up ? b.h >= ex.tp1 : b.l <= ex.tp1);
  if (tp) return { met: true, why: `TP1 ${ex.tp1} reached (${tk} ${up ? "high" : "low"} ${up ? tp.h : tp.l} on the ${etLabel(new Date(tp.t).toISOString())} bar)`, detail: "" };
  let lastClose: number | null = null;
  const wSince = Date.parse(ex.wrong_set_at || "") || 0;     // v3.24 (A12): a moved wrong-if counts only bars after the move
  for (const b of after.filter((x) => x.t + 5 * 60e3 > wSince)) {
    const ends = tf === 5 || new Date(b.t + 5 * 60e3).getUTCMinutes() % tf === 0;
    if (!ends) continue;
    lastClose = b.c;
    if (up ? b.c < ex.wrong_if : b.c > ex.wrong_if)
      return { met: true, why: `wrong-if ${ex.wrong_if}: ${tk} closed a ${tf}-minute bar at ${b.c} (${etLabel(new Date(b.t + 5 * 60e3).toISOString())})`, detail: "" };
  }
  return { met: false, why: "", detail: `wrong-if ${ex.wrong_if} on a ${tf}-minute close not hit${lastClose != null ? ` (last ${tf}-min close ${lastClose})` : " (no completed bar yet)"}; TP1 ${ex.tp1} not reached; before 3:50 PM` };
}
async function armedTradeFor(optId: string) {
  const rows = await db("otto_actions?" + OQ() + "select=id,title,exit,decided_at,created_at&exit->>state=eq.armed&limit=20").catch(() => []);
  return (rows || []).find((r: any) => r.exit?.option_id === optId) || null;
}
async function closeNow(input: any, who: string, verified = false, human: string | null = null) {
  if (owner() !== HOUSE) throw new Error(PAPER_ONLY + " — a practice trade is closed with Close Now on the Desk (its option id starts with P:).");   // v5.0
  const L = await getLimits();
  if (!L.auto_close && !human) throw new Error("Auto-close is OFF (Settings → Limits & goals). Use propose_action for a close card instead.");
  if (!rthNow()) throw new Error("Market is closed: auto-close only works 9:30 AM–4:00 PM ET. Use a close card.");
  const reason = String(input.reason || "").trim().slice(0, 400);
  if (reason.length < 8) throw new Error("Give the reason in one sentence; it goes on the Desk.");
  const acct = await agenticAccount();
  const calls: any[] = [], results: any[] = [];
  let title = "", orderId: string | null = null, soldQty = 0;
  if (input.symbol && !input.option_id) throw new Error("Shares have no card plan, so auto-close can't check a rule. Put up a close card with propose_action.");
  let ruleWhy = "";
  if (verified && input.rule_why) ruleWhy = String(input.rule_why);
  if (input.option_id && !verified && !human) {
    const tr = await armedTradeFor(String(input.option_id));
    const chk = tr ? await exitRuleCheck(tr) : { met: false, why: "", detail: "no card plan on file for this position" };
    if (!chk.met) throw new Error(`Not closed — none of the card's exits is met: ${chk.detail}. Auto-close only runs on the card's own rules (wrong-if, TP1, 3:50 PM). If you still think it should come off, put up a close card with propose_action and say why in one line — a person decides.`);
    ruleWhy = chk.why;
  }
  if (input.option_id) {
    const optId = String(input.option_id);
    const pos = (mcpJson(await call("rh", "get_option_positions", { account_number: acct, option_ids: optId }))?.data?.positions || [])
      .filter((p: any) => p.type === "long");
    const held = pos.reduce((s: number, p: any) => s + Number(p.quantity || 0), 0);
    if (!(held > 0)) throw new Error("No long position in that option on the Agentic account.");
    const qty = input.quantity ? Math.min(held, Math.floor(Number(input.quantity))) : held;
    if (!(qty >= 1)) throw new Error("quantity must be at least 1 contract");
    soldQty = qty;
    // Free the contracts: cancel any working sell-to-close on this option (Otto's stop, a stale limit).
    const since = new Date(Date.now() - 14 * 864e5).toISOString().slice(0, 10);
    const oj = mcpJson(await call("rh", "get_option_orders", { account_number: acct, created_at_gte: since }));
    let cancelled = 0;
    for (const o of (oj?.data?.orders || [])) {
      if (EXIT_OPEN_ORDER.has(o.state) && (o.legs || []).some((l: any) => l.option_id === optId && l.position_effect === "close")) {
        try { await call("rh", "cancel_option_order", { account_number: acct, order_id: o.id }); cancelled++;
              calls.push({ service: "rh", tool: "cancel_option_order", args: { order_id: o.id } });
              results.push({ tool: "cancel_option_order", ok: true, text: "cancelled " + o.id }); }
        catch (e) { results.push({ tool: "cancel_option_order", ok: false, text: (e as Error).message.slice(0, 300) }); }
      }
    }
    if (cancelled) await new Promise((r) => setTimeout(r, 2000));
    const args = { account_number: acct, legs: [{ option_id: optId, side: "sell", position_effect: "close" }],
      quantity: String(qty), type: "market", time_in_force: "gfd", ref_id: crypto.randomUUID() };
    let r: any;
    try { r = await call("rh", "place_option_order", args); }
    catch (e) {                                   // a just-cancelled stop can hold the contracts for a moment
      await new Promise((res) => setTimeout(res, 3000));
      r = await call("rh", "place_option_order", { ...args, ref_id: crypto.randomUUID() });
      void e;
    }
    orderId = orderIdOf(mcpJson(r));
    calls.push({ service: "rh", tool: "place_option_order", args: { ...args, account_number: mask(acct) } });
    results.push({ tool: "place_option_order", ok: true, text: mcpText(r).slice(0, 1500) });
    title = `${human ? "Close" : "Auto-close"} ${qty} ${pos[0]?.chain_symbol || ""} option${qty > 1 ? "s" : ""} (exp ${pos[0]?.expiration_date || "?"})`;
  } else if (input.symbol) {
    const sym = String(input.symbol).toUpperCase().replace(/[^A-Z.]/g, "");
    const ej = mcpJson(await call("rh", "get_equity_positions", { account_number: acct }));
    const list: any[] = ej?.data?.positions || ej?.positions || ej?.data || [];
    const p = (Array.isArray(list) ? list : []).find((x: any) => String(x.symbol || x.ticker || "").toUpperCase() === sym);
    const held = Number(p?.quantity || 0);
    if (!(held > 0)) throw new Error(`No ${sym} shares in the Agentic account.`);
    const qty = input.quantity ? Math.min(held, Number(input.quantity)) : held;
    const args = { account_number: acct, symbol: sym, side: "sell", type: "market", quantity: String(qty), time_in_force: "gfd",
      market_hours: "regular_hours", ref_id: crypto.randomUUID() };
    const r = await call("rh", "place_equity_order", args);
    orderId = orderIdOf(mcpJson(r));
    calls.push({ service: "rh", tool: "place_equity_order", args: { ...args, account_number: mask(acct) } });
    results.push({ tool: "place_equity_order", ok: true, text: mcpText(r).slice(0, 1500) });
    title = `Auto-close ${qty} ${sym} shares`;
  } else throw new Error("Give option_id (for an option) or symbol (for shares).");

  const rows = await db("otto_actions", { method: "POST", body: JSON.stringify({
    owner: owner(),                                                                    // v5.0
    title, summary: `Reason   ${ruleWhy ? "[card rule] " + ruleWhy + ". " : ""}${reason}\nOrder    sell to close at market (auto-close, no Approve)\nBy       ${human ? human + ", Close Now button (a person pressed it)" : who === "rules" ? "Otto (card rule, server-checked)" : "Jarvis, on " + who}`,
    calls, risk: { cost: 0, notes: ["closing order: no new risk"] }, review: "", status: "done", created_by: human ? human : "Jarvis (auto)",
    decided_by: human ? human + " (Close Now button)" : "auto-close", decided_at: new Date().toISOString(), result: results, ...(orderId ? { order_id: String(orderId) } : {}),
  }) });
  const id = rows?.[0]?.id || null;
  const by = human ? `${human} closed (Close Now button)` : who === "rules" ? "Otto closed (card rule)" : "Jarvis closed";
  const whyTxt = ruleWhy ? `${ruleWhy}${reason && reason !== ruleWhy ? " — " + reason : ""}` : reason;
  await logDesk("system", "Otto", `🤖 ${by}: ${title} at market. Why: ${whyTxt}${human ? "" : " (Auto-close is on; turn it off in Settings → Limits & goals.)"}`, id);
  await notify("auto_close", `🤖 ${by}: ${title.replace(/^Auto-close /, "")}`, `Sold at market. Why: ${whyTxt}`);
  return { ok: true, title, order_id: orderId, card: id, qty: soldQty };
}


/* ===================================================================== v3.33 Close Now
   14 Oct 2026 (Ifoma + Josh; mockup close-now-mockup approved, Option B, sell at market, two taps).
   Two Desk routes. trade_live is READ-ONLY: the open long options in the Agentic account with a fresh quote, the entry price,
   the card's own exit lines (when Otto has the trade) and 10-minute bars for the chart. close_now is a PERSON pressing the button:
   it sells everything held in that one option at market, cancels Otto's protective stop first, and writes it to the Desk and the
   Activity log. A person pressing it counts as the approval, so it does not need the Auto-close switch or a card rule. It can only
   close (never open or add), only the Agentic account, only 9:30-4:00 ET, only an option that is held. */
const CLOSING = new Set<string>();
const cnN0 = (v: any): number | null => { const x = Number(v); return v != null && v !== "" && Number.isFinite(x) ? x : null; };
const cnR2 = (v: number) => Math.round(v * 100) / 100;
export function entryOf(orders: any[], armed: any[], optId: string) {
  let q = 0, cost = 0, last = 0, sym = "", strike = 0, typ = "";
  for (const o of orders || []) for (const l of o.legs || []) {
    if (l.option_id !== optId || l.position_effect !== "open" || l.side !== "buy") continue;
    for (const x of l.executions || []) {
      const px = Number(x.price), qq = Number(x.quantity);
      if (px > 0 && qq > 0) { q += qq; cost += px * qq; last = Math.max(last, Date.parse(x.timestamp || "") || 0); }
    }
    sym = o.chain_symbol || sym; strike = Number(l.strike_price) || strike; typ = l.option_type || typ;
  }
  const card = (armed || []).find((r: any) => r.exit?.option_id === optId) || null;
  const cf = cnN0(card?.exit?.fill_price);
  const px = cf != null && cf > 0 ? cf : q ? cost / q : null;
  return { px, src: cf != null && cf > 0 ? "card" : q ? "orders" : null, at: last || null, sym, strike, type: typ, card };
}
export async function tradeLive() {
  const acct = await agenticAccount();
  const c = marketClock();
  const pj = mcpJson(await call("rh", "get_option_positions", { account_number: acct, nonzero: true }));
  const longs = (pj?.data?.positions || []).filter((p: any) => p.type === "long" && Number(p.quantity) > 0).slice(0, 3);
  const trades: any[] = [];
  if (longs.length) {
    const since = new Date(Date.now() - 5 * 864e5).toISOString().slice(0, 10);
    const oj = await settle((async () => mcpJson(await call("rh", "get_option_orders", { account_number: acct, created_at_gte: since })))());
    const orders = oj.ok ? (oj.v?.data?.orders || []) : [];
    const armed = await db("otto_actions?" + OQ() + "select=id,title,exit&exit->>state=eq.armed&limit=20").catch(() => []);
    for (const p of longs) {
      const optId = String(p.option_id), sym = String(p.chain_symbol || "").toUpperCase(), qty = Math.floor(Number(p.quantity));
      const [qs, bs] = await Promise.all([
        settle((async () => mcpJson(await call("rh", "get_option_quotes", { instrument_ids: [optId] })))()),
        settle(rhBars([sym], "10minute", new Date(Date.now() - 8 * 3600e3).toISOString())),
      ]);
      const r0 = qs.ok ? (qs.v?.data?.results || [])[0] : null, q = r0?.quote || r0 || null;
      const bid = cnN0(q?.bid_price), ask = cnN0(q?.ask_price);
      const e = entryOf(orders, armed, optId), ex = e.card?.exit || null;
      const bars: Bar[] = ((bs.ok ? bs.v[sym] : null) || []).slice(-40);
      const fb = e.at ? bars.find((b) => b.t <= e.at! && e.at! < b.t + 600e3) : null;
      trades.push({
        option_id: optId, sym, qty, exp: p.expiration_date || null, type: e.type || null,
        label: e.px != null && e.strike ? `${sym} ${e.strike}${e.type === "put" ? "P" : "C"}` : `${sym} option`,
        entry: e.px, entry_src: e.src, opened_at: e.at ? new Date(e.at).toISOString() : null,
        bid: bid != null && bid > 0 ? bid : null, ask, quote_at: q?.updated_at || null,
        est_pnl: bid != null && bid > 0 && e.px != null ? cnR2((bid - e.px) * 100 * qty) : null,
        under: bars.length ? bars[bars.length - 1].c : null, under_entry: fb ? fb.o : null,
        bars: bars.map((b) => [b.t, b.o, b.h, b.l, b.c]),
        plan: ex ? { dir: ex.direction, wrong_if: cnN0(ex.wrong_if), tp1: cnN0(ex.tp1), tf: Number(ex.wrong_tf) === 5 ? 5 : 15, card_id: e.card.id, title: e.card.title } : null,
        quote_error: qs.ok ? null : String(qs.error || "").slice(0, 120),
      });
    }
  }
  return { ok: true, at: new Date().toISOString(), rth: rthNow(), clock: { day: c.date, status: c.status }, trades };
}
export async function closeByButton(body: any, who: string) {
  const optId = String(body?.option_id || "").trim();
  if (!optId) return { ok: false, error: "No trade was given." };
  if (owner() !== HOUSE) return { ok: false, error: PAPER_ONLY + " — only practice trades (P:) can be closed here." };   // v5.0
  const human = String(body?.author || "").replace(/[^A-Za-z .'-]/g, "").trim().slice(0, 30) || "Josh";
  if (CLOSING.has(optId)) return { ok: false, error: "A close for this trade is already running." };
  CLOSING.add(optId);
  try {
    const acct = await agenticAccount();
    const since = new Date(Date.now() - 5 * 864e5).toISOString().slice(0, 10);
    const oj = await settle((async () => mcpJson(await call("rh", "get_option_orders", { account_number: acct, created_at_gte: since })))());
    const armed = await db("otto_actions?" + OQ() + "select=id,title,exit&exit->>state=eq.armed&limit=20").catch(() => []);
    const ent = entryOf(oj.ok ? (oj.v?.data?.orders || []) : [], armed, optId);
    const r = await closeNow({ option_id: optId, reason: `${human} pressed Close Now on the Desk (${who})` }, "desk", true, human);
    let state = "sent", fillPx: number | null = null;
    for (let i = 0; i < 4 && r.order_id; i++) {
      await new Promise((res) => setTimeout(res, 1500));
      const j = await settle((async () => mcpJson(await call("rh", "get_option_orders", { account_number: acct, order_id: r.order_id })))());
      const o = j.ok ? (j.v?.data?.orders || [])[0] : null;
      if (!o) continue;
      state = String(o.state || state);
      if (o.state === "filled") {
        const ex = (o.legs || [])[0]?.executions || [];
        const qf = ex.reduce((a: number, x: any) => a + Number(x.quantity), 0);
        fillPx = qf ? ex.reduce((a: number, x: any) => a + Number(x.price) * Number(x.quantity), 0) / qf : cnN0(o.average_price);
        break;
      }
      if (EXIT_DEAD_ORDER.has(o.state)) break;
    }
    const pnl = fillPx != null && ent.px != null ? cnR2((fillPx - ent.px) * 100 * (r.qty || 1)) : null;
    return { ok: true, title: r.title, card: r.card, order_id: r.order_id, qty: r.qty, state, fill_px: fillPx != null ? cnR2(fillPx) : null,
      entry_px: ent.px != null ? cnR2(ent.px) : null, pnl, by: human };
  } catch (e) {
    // The sell can fail AFTER Otto cancelled the protective stop. Say so plainly instead of leaving a trade bare in silence.
    let warn = "";
    try {
      const acct2 = await agenticAccount();
      const held = (mcpJson(await call("rh", "get_option_positions", { account_number: acct2, option_ids: optId }))?.data?.positions || [])
        .some((p: any) => p.type === "long" && Number(p.quantity) > 0);
      if (held) {
        const since2 = new Date(Date.now() - 5 * 864e5).toISOString().slice(0, 10);
        const os = mcpJson(await call("rh", "get_option_orders", { account_number: acct2, created_at_gte: since2 }))?.data?.orders || [];
        const working = os.some((o: any) => EXIT_OPEN_ORDER.has(o.state) && (o.legs || []).some((l: any) => l.option_id === optId && l.side === "sell" && l.position_effect === "close"));
        if (!working) warn = " ⚠ The trade is still open and Robinhood shows no stop order on it right now. Press Close Now again, or close it in Robinhood.";
      }
    } catch { /* best effort: the main error still goes back */ }
    return { ok: false, error: (String((e as Error).message || e).slice(0, 300) + warn).slice(0, 600) };
  } finally { CLOSING.delete(optId); }
}

/* v3.41: the line after Close Now — "why out?" — stored on the close card closeByButton made (plan.josh_exit_why) and,
   when the entry card can be found through the option id, on that card too so the Scoreboard shows it on the trade's own line.
   Asked AFTER the fill; never blocks the sell. One line, at least WHY_MIN characters. */
export async function whyOut(body: any, who: string) {
  const text = String(body?.text ?? "").replace(/\s+/g, " ").trim().slice(0, 400);
  if (text.length < WHY_MIN) return { ok: false, error: `Say why you got out (at least ${WHY_MIN} characters).` };
  const id = String(body?.id || "").trim(), optId = String(body?.option_id || "").trim();
  const rec = { text, at: new Date().toISOString(), by: who.split("@")[0] };
  const patched: string[] = [];
  const stamp = async (cardId: string) => {
    if (!/^[0-9a-f-]{36}$/i.test(cardId)) return;
    const a = (await db("otto_actions?id=eq." + cardId + "&select=id,plan").catch(() => []))?.[0];
    if (!a) return;
    await db("otto_actions?id=eq." + cardId, { method: "PATCH", headers: { prefer: "return=minimal" }, body: JSON.stringify({ plan: { ...(a.plan || {}), josh_exit_why: rec } }) });
    patched.push(cardId);
  };
  if (id) await stamp(id);
  if (optId) {
    // the entry card: the newest armed/done opening card on this option
    const rows = await db("otto_actions?" + OQ() + "select=id,plan,exit&exit->>option_id=eq." + encodeURIComponent(optId) + "&order=created_at.desc&limit=3").catch(() => []);
    const ent = (rows || []).find((r: any) => r.id !== id);
    if (ent) await stamp(ent.id);
  }
  if (!patched.length) return { ok: false, error: "No card found for that trade." };
  await activity("card", `Why out (${rec.by}): ${text}`, rec.by).catch(() => {});
  return { ok: true, cards: patched, why: rec };
}


/* ===================================================================== v3.43 Close Now on PRACTICE trades
   21 Oct 2026 (Ifoma: "everything pretty much the same experience, paper trade or not"; mockup v343-practice-close-now approved).
   A practice trade is an otto_actions card with status paper_taken and plan.paper_fill (the pretend fill at the ask when Josh approved).
   Before v3.43 it was scored only by rule (gradeIdea). Now it also shows as IN A TRADE with a live option price, and Josh can close it:
   the practice book then counts the SELL AT THE LIVE BID at his tap (decided 21 Oct), and the rule's own grade is kept as a what-if
   (outcome.rule_grade). NOTHING is sent to Robinhood: only a quote read. No readable bid = refuse (never guess a price).
   The live Close Now code (closeByButton / closeNow) is NOT touched. Practice rows carry option_id "P:<card id>" so the app's
   existing button works; the route in front of closeByButton sends a "P:" id here. */
const PRAC_PREFIX = "P:";
const practiceFinal = (a: any) => !!(a?.outcome && (["win", "loss", "scratch", "unscored"].includes(a.outcome.state) || a.outcome.practice_close));
const practiceLeg = (a: any) => (a?.calls || []).flatMap((c: any) => c?.args?.legs || []).find((l: any) => l?.position_effect === "open") || null;
export const practiceLabel = (t: any) => String(t || "").replace(/^\s*(PAPER|PRACTICE|LIVE)(\s*[·-]\s*[A-Z]+)?\s*[—-]\s*/i, "").trim().slice(0, 40) || "practice trade";
/* The practice trades Josh took today that are still open (not scored by rule, not closed by hand). Never reads Robinhood account data. */
export async function practiceOpen(): Promise<any[]> {
  const since = new Date(Date.now() - 20 * 3600e3).toISOString();
  const rows: any[] = (await db(`otto_actions?${OQ()}select=id,title,created_at,decided_by,plan,outcome,calls,exit,status&status=eq.paper_taken&created_at=gte.${since}&order=created_at.desc&limit=8`).catch(() => [])) || [];
  const today = etParts().date, out: any[] = [];
  for (const a of rows) {
    if (practiceFinal(a)) continue;
    const pf = a.plan?.paper_fill || {};
    if (!pf.at || etParts(new Date(pf.at)).date !== today) continue;
    out.push(a);
    if (out.length >= 4) break;
  }
  return out;
}
export async function tradeLivePractice() {
  const acts = await practiceOpen();
  const trades: any[] = [];
  for (const a of acts) {
    const p = a.plan || {}, pf = p.paper_fill || {}, leg = practiceLeg(a), optId = String(leg?.option_id || "");
    const sym = String(p.tv_symbol || "").split(":").pop()?.toUpperCase() || "";
    const [qs, bs] = await Promise.all([
      optId ? settle((async () => mcpJson(await withTimeout(call("rh", "get_option_quotes", { instrument_ids: [optId] }), 5000, "practice quote")))()) : Promise.resolve({ ok: false, error: "no option on the card" } as any),
      sym ? settle(rhBars([sym], "10minute", new Date(Date.now() - 8 * 3600e3).toISOString())) : Promise.resolve({ ok: false } as any),
    ]);
    const r0 = qs.ok ? (qs.v?.data?.results || [])[0] : null, q = r0?.quote || r0 || null;
    const bid = cnN0(q?.bid_price), ask = cnN0(pf.ask);
    const bars: Bar[] = ((bs.ok ? bs.v[sym] : null) || []).slice(-40);
    const dir = p.direction === "down" ? "down" : "up";
    trades.push({
      practice: true, card_id: a.id, option_id: PRAC_PREFIX + a.id, sym, qty: 1, exp: null, type: null,
      label: practiceLabel(a.title), entry: ask, entry_src: "practice", opened_at: pf.at || null,
      bid: bid != null && bid > 0 ? bid : null, ask: null, quote_at: q?.updated_at || null,
      est_pnl: bid != null && bid > 0 && ask != null ? cnR2((bid - ask) * 100) : null,
      under: bars.length ? bars[bars.length - 1].c : null, under_entry: cnN0(pf.underlying),
      bars: bars.map((b) => [b.t, b.o, b.h, b.l, b.c]),
      plan: cnN0(p.stop) != null && cnN0(p.tp1) != null ? { dir, wrong_if: cnN0(p.stop), tp1: cnN0(p.tp1), tf: Number(p.wrong_tf || a.exit?.wrong_tf) === 5 ? 5 : 15, card_id: a.id, title: a.title } : null,
      quote_error: qs.ok ? null : String(qs.error || "").slice(0, 120),
    });
  }
  return trades;
}
/* trade_live for the Desk: the real list exactly as before, plus the open practice trades. One failing side never hides the other. */
export async function tradeLiveAll() {
  const [real, prac] = await Promise.all([
    tradeLive().catch((e) => ({ ok: false, error: String((e as Error)?.message || e).slice(0, 160), trades: [] as any[], rth: rthNow(), at: new Date().toISOString() } as any)),
    tradeLivePractice().catch(() => [] as any[]),
  ]);
  return { ...real, trades: [...(real.trades || []), ...prac] };
}
export async function closePractice(body: any, who: string) {
  const raw = String(body?.option_id || "");
  const cardId = raw.startsWith(PRAC_PREFIX) ? raw.slice(PRAC_PREFIX.length) : "";
  if (!/^[0-9a-f-]{36}$/i.test(cardId)) return { ok: false, error: "That practice trade was not found." };
  const human = String(body?.author || "").replace(/[^A-Za-z .'-]/g, "").trim().slice(0, 30) || "Josh";
  if (CLOSING.has(raw)) return { ok: false, error: "A close for this practice trade is already running." };
  CLOSING.add(raw);
  try {
    if (!rthNow()) return { ok: false, error: "Market is closed. Close Now works 9:30 AM to 4:00 PM ET. The practice trade stays open until it is scored at the close." };
    const a = (await db("otto_actions?id=eq." + cardId + "&select=*").catch(() => []))?.[0];
    if (!a || a.status !== "paper_taken") return { ok: false, error: "That practice trade was not found." };
    if (practiceFinal(a)) return { ok: false, error: "This practice trade is already closed." };
    const p = a.plan || {}, pf = p.paper_fill || {}, leg = practiceLeg(a), entry = cnN0(pf.ask);
    if (!leg?.option_id || entry == null) return { ok: false, error: "This practice trade has no saved fill, so it cannot be closed by hand. It will be scored by its rules." };
    let bid: number | null = null;
    try {
      const q = (mcpJson(await withTimeout(call("rh", "get_option_quotes", { instrument_ids: [leg.option_id] }), 5000, "practice close quote"))?.data?.results || [])[0];
      bid = cnN0((q?.quote || q)?.bid_price);
    } catch { /* handled below: no bid = refuse */ }
    if (bid == null || bid <= 0) return { ok: false, error: "Price unavailable right now, so nothing was closed. The practice trade is still open. Try again in a few seconds." };
    const pnl = Math.round((bid - entry) * 100), state = pnl > 0 ? "win" : pnl < 0 ? "loss" : "scratch";
    const nowIso = new Date().toISOString();
    const outcome = { state, pnl_est: pnl, r: null, at: Math.round(Date.now() / 1000), entry: cnN0(pf.underlying), practice_close: true, entry_px: cnR2(entry), exit_px: cnR2(bid), closed_by: human, closed_at: nowIso,
      rule_grade: { state: "pending" } };
    // Only one writer wins: refuse if it was closed or scored in the meantime.
    const w = await db("otto_actions?id=eq." + cardId + "&status=eq.paper_taken&outcome->>practice_close=is.null", { method: "PATCH", body: JSON.stringify({ outcome }) }).catch(() => null);
    if (!w?.[0]) return { ok: false, error: "This practice trade changed while you were closing it (it may already be closed). Check the Scoreboard." };
    const lab = practiceLabel(a.title), res = `${pnl >= 0 ? "+" : "−"}$${Math.abs(pnl)}`;
    await activity("card", `Closed by ${human} (Close Now, practice): ${lab} at $${bid.toFixed(2)}, practice result ${res}`, human, "pclose|" + cardId).catch(() => {});
    await logDesk("system", "Otto", `🔴 ${human} closed the practice trade ${lab} with Close Now. Sold at $${bid.toFixed(2)} (live sell price), pretend fill was $${entry.toFixed(2)}: practice result ${res}. Nothing was sent to Robinhood. The practice book counts this, and the rule's own result is kept beside it as a what-if.`, cardId).catch(() => {});
    return { ok: true, practice: true, title: a.title, card: cardId, state: "filled", qty: 1, fill_px: cnR2(bid), entry_px: cnR2(entry), pnl, by: human };
  } catch (e) {
    return { ok: false, error: String((e as Error)?.message || e).slice(0, 300) };
  } finally { CLOSING.delete(raw); }
}

// Scheduled / triggered check of everything open in the Agentic account.
export async function ruleSweep() {
  const armed = await db("otto_actions?" + OQ() + "select=id,title,exit,decided_at,created_at&exit->>state=eq.armed&limit=20").catch(() => []);
  const out: any[] = [];
  for (const a of armed || []) {
    try {
      const chk = await exitRuleCheck(a);
      if (!chk.met) continue;
      const r = await closeNow({ option_id: a.exit.option_id, reason: chk.why, rule_why: chk.why }, "rules", true);
      out.push({ id: a.id, closed: r.title, why: chk.why });
    } catch (e) { out.push({ id: a.id, error: (e as Error).message.slice(0, 200) }); }
  }
  return out;
}
async function positionReview(trigger: string | null = null) {
  const L = await getLimits();
  if (!L.auto_close || !rthNow()) return { ok: true, skipped: "off or market closed" };
  // v3.21: the card's own rules are checked on every call (cron minute or alert), by the server.
  const swept = await ruleSweep().catch((e) => [{ error: String((e as Error).message) }]);
  const every = Math.max(5, Number(L.review_min) || 15) * 60e3;
  if (!trigger) {
    const last = await db("otto_settings?key=eq.review_at&select=value").then((r: any) => Number(r?.[0]?.value?.at || 0)).catch(() => 0);
    if (Date.now() - last < every) return { ok: true, skipped: "recent" };
  }
  const acct = await agenticAccount();
  const [op, eq] = await Promise.all([
    settle((async () => mcpJson(await call("rh", "get_option_positions", { account_number: acct, nonzero: true })))()),
    settle((async () => mcpJson(await call("rh", "get_equity_positions", { account_number: acct })))()),
  ]);
  const opts = op.ok ? (op.v?.data?.positions || []).filter((p: any) => Number(p.quantity) > 0) : [];
  const eqRaw: any = eq.ok ? (eq.v?.data?.positions || eq.v?.positions || eq.v?.data || []) : [];
  const shares = (Array.isArray(eqRaw) ? eqRaw : []).filter((p: any) => Number(p.quantity) > 0);
  if (!opts.length && !shares.length) return { ok: true, skipped: "nothing open" };
  await db("otto_settings?on_conflict=key", { method: "POST", headers: { prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify({ key: "review_at", value: { at: Date.now() }, updated_by: "cron", updated_at: new Date().toISOString() }) }).catch(() => {});
  const plans = await db("otto_actions?" + OQ() + "select=title,plan,exit&exit->>state=eq.armed&limit=10").catch(() => []);
  const calls = await loadBrain();
  const sys = DESK_SYS.replace("{{RULES}}", alwaysOn(calls));
  const { tools: mcpToolDefs } = await deskTools();
  const prompt = `[Automatic position check — nobody typed this. ${trigger ? "TRIGGER: " + trigger : `Scheduled check (every ${Math.round(every / 60e3)} min).`}]
Open in the Agentic account — options: ${JSON.stringify(opts.map((p: any) => ({ option_id: p.option_id, symbol: p.chain_symbol, qty: p.quantity, avg: p.average_price, exp: p.expiration_date })))}; shares: ${JSON.stringify(shares.map((p: any) => ({ symbol: p.symbol, qty: p.quantity })))}.
Plans on file: ${JSON.stringify((plans || []).map((r: any) => ({ title: r.title, setup: r.plan?.setup, direction: r.exit?.direction, tp1: r.exit?.tp1, wrong_if: r.exit?.wrong_if, stop_option: r.exit?.stop_option, option_id: r.exit?.option_id })))}.
For each position: fetch the underlying's live price and recent 5-minute bars (and the option quote) and compare with its plan, the Otto Rules exits and the House Rules. You can't close anything: the server closes a trade on its card's own rules (wrong-if on the card's bar, TP1, 3:50 PM) by itself. If you'd get out for a reason that isn't one of those, write one short line per position saying so and why — Ifoma or Josh decide. Otherwise reply with exactly the single word HOLD and nothing else.${swept.length ? " Already handled by the server this minute: " + JSON.stringify(swept).slice(0, 400) : ""}`;
  const res = await runDesk({ msgs: [{ role: "user", content: prompt }], sys, tools: [TOOLS[0], ...mcpToolDefs], cs: chunksOf(calls),
    who: "auto-review", send: () => {}, allowPropose: false, allowClose: false, maxRounds: 8 });
  const said = res.said.trim();
  if (said && !/^HOLD\.?$/i.test(said)) await logDesk("assistant", "Jarvis · position check", said);
  return { ok: true, said: said.slice(0, 300) };
}

/* ===================================================================== v3.6
   5 Oct 2026 — phone notifications (Web Push, both phones).

   No third-party service and no extra secrets: the VAPID key pair is made on
   first use and kept in otto_settings ("push_vapid", service role only).
   Subscriptions live in otto_settings ("push_subs"), one per phone, each with
   its own choices. Messages are encrypted per RFC 8291 (aes128gcm) with
   WebCrypto and sent straight to Apple's / Google's push service.
   Quiet outside 9:00 AM–4:30 PM ET weekdays, except "no_stop" (a trade with
   no stop working), which always goes through. iPhone needs Otto opened from
   the home-screen icon (iOS 16.4+). */

const PUSH_KINDS: Record<string, { label: string; on: boolean; always?: boolean }> = {
  auto_close:  { label: "Jarvis closed a trade", on: true },
  no_stop:     { label: "A trade has NO stop working", on: true, always: true },
  fill:        { label: "Entry filled · stop on", on: true },
  stopped:     { label: "Stop filled (stopped out)", on: true },
  trade_alert: { label: "Your trade's wrong-if / TP1 hit", on: true },
  card:        { label: "A card is waiting for Approve", on: true },
    morning:     { label: "8:45 morning read is ready", on: false },
  signal:      { label: "Otto Signals: a call came in (card ready)", on: true, always: true },
  ears:        { label: "Ears: levels heard on the live call", on: true },
  watcher:     { label: "Otto Signals watcher went offline / came back", on: true, always: true },
  daily:       { label: "5:15 PM daily recap is ready", on: true },
  checkin:     { label: "⏰ A check-in Jarvis scheduled", on: true },
  brk:         { label: "Something broke (Activity log)", on: true, always: true },   // v3.26
  lock:        { label: "Kill switch locked new cards", on: true },                     // v3.26
  homework:    { label: "📓 Homework not handed in (8:30 PM / 8:00 AM)", on: true },      // v3.45
};
const PUSH_SUB_URL = "https://proagentmax.github.io/otto-trader/";

const b64u = (u: Uint8Array) => b64(u).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const unb64u = (s: string) => unb64(s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4));
function cat(...a: Uint8Array[]) { const o = new Uint8Array(a.reduce((n, x) => n + x.length, 0)); let i = 0; for (const x of a) { o.set(x, i); i += x.length; } return o; }
async function hmac(key: Uint8Array, data: Uint8Array) {
  const k = await crypto.subtle.importKey("raw", key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", k, data));
}
const te = new TextEncoder();

/* ------------------------------------------------------------ v3.13 House Rules
   Standing instructions from Ifoma and Josh. Stored in otto_settings "house_rules", shown and edited in
   Settings → House Rules, loaded into every Jarvis run, and saved by Jarvis (save_house_rule) when
   someone gives a standing instruction on the Desk. */
const HOUSE_DEFAULTS = [
  "Intraday only: every trade is closed the same day. Don't hold overnight unless Ifoma or Josh says so for that trade.",
  "Trading the open: when a Signal level was posted before the open and price opens on it or pushes off it, it's a go before 10:00 AM. Otherwise no entries in the first 30 minutes.",
  "Read entries on the 5-minute and 10-minute charts, on candle closes, not wicks.",
  "Look for setups in both directions: calls on a break or a pullback that holds, puts on a rejection. Label a quick trade SCALP on the card.",
  "When a setup checks the boxes, build the card without asking first. Ask only if you can't see the data.",
  "On an open trade, warn early (lower highs, stalling near the wrong-if, the option bleeding) before the stop is anywhere close.",
  "Guardrails flag, never block: always show the card with the red banner; Ifoma and Josh decide.",
];
export async function houseRules(): Promise<{ id: string; text: string; by: string; at: string }[]> {
  return cached("house_rules", 30e3, async () => {
    const v = await setting("house_rules").catch(() => null);
    if (v && Array.isArray(v.rules)) return v.rules;
    return HOUSE_DEFAULTS.map((text, i) => ({ id: "d" + (i + 1), text, by: "Ifoma (6 Oct)", at: "2026-10-06T21:00:00Z" }));
  });
}
export async function houseRulesText(): Promise<string> {
  const r = await houseRules();
  return r.length ? "HOUSE RULES — their standing instructions; follow every one:\n" + r.map((x, i) => `${i + 1}. ${x.text}`).join("\n") : "";
}
async function houseRulesSet(body: any, who: string) {
  const list = (Array.isArray(body?.rules) ? body.rules : []).map((x: any) => ({
    id: String(x.id || crypto.randomUUID().slice(0, 8)), text: String(x.text || "").trim().slice(0, 400),
    by: String(x.by || body?.author || who.split("@")[0]).slice(0, 40), at: String(x.at || new Date().toISOString()) })).filter((x: any) => x.text);
  if (list.length > 40) throw new Error("40 rules max — remove some first");
  const before = (await houseRules().catch(() => [] as any[])).map((x: any) => x.text);
  await putSetting("house_rules", { rules: list }, String(body?.author || who).slice(0, 60));
  delete CACHE.house_rules;
  // v3.26: the Activity log shows removed rules (added ones are logged by houseRuleAdd / the Settings save below).
  const gone = before.filter((t: string) => !list.some((x: any) => x.text === t));
  const added = list.filter((x: any) => !before.includes(x.text)).map((x: any) => x.text);
  if (gone.length) await activity("change", `House rule removed: ${gone.join(" · ")}`, String(body?.author || who.split("@")[0]).slice(0, 40));
  if (added.length && !body?._viaAdd) await activity("change", `House rule added: ${added.join(" · ")}`, String(body?.author || who.split("@")[0]).slice(0, 40));
  return list;
}
export async function houseRuleAdd(text: string, by: string) {
  const t = String(text || "").trim().slice(0, 400);
  if (t.length < 8) throw new Error("rule text too short");
  const cur = await houseRules();
  if (cur.some((x) => x.text.toLowerCase() === t.toLowerCase())) return cur;
  const list = await houseRulesSet({ rules: [...cur, { text: t, by }], author: by, _viaAdd: true }, by);
  await logDesk("system", "Otto", `📌 House rule saved (${by}): ${t}  — see or edit it in Settings → House Rules.`);
  await activity("change", `House rule added: ${t}`, by);     // v3.26
  return list;
}
// v3.37: Josh's own practice trades (TradingView paper etc.) go in the Journal through Jarvis, so the coach's weekly log can include them.
const LOG_TOOL = {
  name: "log_practice_trade",
  description: "Log a trade Josh or Ifoma took OUTSIDE Otto (TradingView paper, a manual Robinhood trade, a scalp they describe) into the Journal, so the weekly trade log for the coach includes it. Use when they describe a trade they took with entry, exit and result. Ask for the missing piece if entry or exit price is not given; never invent a number.",
  input_schema: { type: "object", properties: {
    ticker: { type: "string" }, contract: { type: "string", description: "e.g. AMZN 255C 10/21, or 'shares'" }, side: { type: "string", enum: ["long", "short"] },
    entry: { type: "number", description: "entry price paid (option premium or share price)" }, exit: { type: "number", description: "exit price; omit if still open" },
    pnl: { type: "number", description: "result in dollars, if they said it" }, entry_time: { type: "string", description: "ET, e.g. 10:12 AM" }, exit_time: { type: "string" },
    level: { type: "number", description: "the underlying level the trade was built on" }, why: { type: "string", description: "their reason, in their words" },
    platform: { type: "string", description: "e.g. TradingView paper, Robinhood" } },
    required: ["ticker", "side", "entry", "why"] },
};
const HOUSE_TOOL = {
  name: "save_house_rule",
  description: "Save a standing instruction from Ifoma or Josh to the House Rules (loaded into every future run). Use only for instructions meant to apply from now on, written as one plain sentence.",
  input_schema: { type: "object", properties: { text: { type: "string", description: "The rule, one plain sentence" } }, required: ["text"] },
};

async function setting(key: string): Promise<any> {
  const r = await db("otto_settings?key=eq." + key + "&select=value");
  return r?.[0]?.value ?? null;
}
/* v3.41: Josh + Baby J's PRACTICE BOOK — $4,000 paper, like Winston's, counted from the night v3.41 shipped (SQL 025 writes
   `since`). Practice cards are sized against it (flag only) and scored on it. Nothing here touches the Agentic account. */
export const PRACTICE_BOOK_DEFAULT = { start: 4000, since: null as string | null };
export const ROOM_BOOK_START = 5000;                                                    // v5.0: a member's practice book
export async function practiceBook(): Promise<{ start: number; since: string | null }> {
  if (owner() !== HOUSE) {                                                               // v5.0 ROOMS: one entry per room in "practice_by_owner"
    const map = (await setting("practice_by_owner").catch(() => null)) || {};
    const mine = map?.[owner()];
    const start = Number(mine?.start);
    if (mine && typeof mine.since === "string" && mine.since) return { start: isFinite(start) && start > 0 ? start : ROOM_BOOK_START, since: mine.since };
    const book = { start: isFinite(start) && start > 0 ? start : ROOM_BOOK_START, since: new Date().toISOString() };
    await putSetting("practice_by_owner", { ...map, [owner()]: book }, "otto (room)").catch(() => {});
    return book;
  }
  const v = await setting("practice_book").catch(() => null);
  const start = Number(v?.start);
  return { start: isFinite(start) && start > 0 ? start : PRACTICE_BOOK_DEFAULT.start, since: typeof v?.since === "string" && v.since ? v.since : null };
}
/* Is this card one Josh was asked to answer? (v3.35 practice cards; v3.41 also the over-cap ones.) */
export function isPracticeCard(a: any): boolean {
  return !!(a?.plan?.practice || a?.status === "paper_wait" || a?.status === "paper_taken" || (a?.checks || []).some((c: any) => c && c.practice));
}
/* v3.41: the practice book's numbers for the Scoreboard and the Friday report card. `since` null = the book has not started. */
export function practiceStats(acts: any[], book: { start: number; since: string | null }) {
  const since = book.since ? Date.parse(book.since) : Infinity;
  // v3.45: a card the server (or Ifoma) marked as a duplicate of another (plan.duplicate_of) is not offered, taken or scored — 22 Oct META 632.5P was built twice.
  const cards = (acts || []).filter((a: any) => isPracticeCard(a) && !a?.plan?.duplicate_of && Date.parse(a.created_at) >= since);
  const taken = cards.filter((a: any) => a.status === "paper_taken");
  const apPassed = cards.filter((a: any) => a.status === "rejected" && a.plan?.autopilot_pass);                    // v5.9.2
  const answered = cards.filter((a: any) => a.status === "paper_taken" || (a.status === "rejected" && !a.plan?.autopilot_pass));
  const expired = cards.filter((a: any) => a.status === "expired");
  const est = (a: any) => (a.outcome && ["win", "loss", "scratch"].includes(a.outcome.state) && a.outcome.pnl_est != null) ? Number(a.outcome.pnl_est) : 0;
  const ov = cards.filter((a: any) => (a.plan?.override || noWhy(a)) && a.status === "paper_taken");   // v5.7: a why left unanswered counts
  const ovScored = ov.filter((a: any) => a.outcome && ["win", "loss"].includes(a.outcome.state));
  const whys = answered.filter((a: any) => a.plan?.josh_why || a.plan?.josh_reject_why);
  // v5.9: trades OttoPilot took are on their own line, split on plan / off plan; "josh" is everything Josh approved himself
  const apc = taken.filter((a: any) => a.plan?.autopilot);
  const grp = (xs: any[]) => ({ n: xs.length, wins: xs.filter((a: any) => a.outcome?.state === "win").length, losses: xs.filter((a: any) => a.outcome?.state === "loss").length,
    est: Math.round(xs.reduce((s: number, a: any) => s + est(a), 0)) });
  return {
    autopilot: { ...grp(apc), passed: apPassed.length, on_plan: grp(apc.filter((a: any) => a.plan.autopilot.on_plan)), off_plan: grp(apc.filter((a: any) => !a.plan.autopilot.on_plan)) },
    josh: grp(taken.filter((a: any) => !a.plan?.autopilot)),
    start: book.start, since: book.since, balance: Math.round((book.start + taken.reduce((s: number, a: any) => s + est(a), 0)) * 100) / 100,
    offered: cards.length, answered: answered.length, taken: taken.length, rejected: answered.length - taken.length, expired: expired.length,
    whys: whys.length, scoring: taken.filter((a: any) => !a.outcome || !["win", "loss", "scratch", "unscored"].includes(a.outcome.state)).length,
    overrides: { n: ov.length, wins: ovScored.filter((a: any) => a.outcome.state === "win").length, losses: ovScored.filter((a: any) => a.outcome.state === "loss").length,
      est: Math.round(ov.reduce((s: number, a: any) => s + est(a), 0)) },
  };
}
async function putSetting(key: string, value: any, by = "otto") {
  await db("otto_settings?on_conflict=key", { method: "POST", headers: { prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify({ key, value, updated_by: by, updated_at: new Date().toISOString() }) });
}

/* ---- v3.8 (5 Oct 2026): the Desk layout Ifoma and Josh customize — side-tab
   order / names / hidden / landing tab, and side-card order / column / collapsed.
   Shared by both laptops. Validated loosely: keys and labels only, nothing runs. */
async function layoutSet(body: any, who: string) {
  const key = (v: any) => String(v || "").toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 40);
  const tabs = (Array.isArray(body.tabs) ? body.tabs : []).slice(0, 20).map((t: any) => ({
    k: key(t.k), l: String(t.l || "").replace(/[<>]/g, "").trim().slice(0, 18), hide: !!t.hide })).filter((t: any) => t.k);
  const side = (a: any) => (Array.isArray(a) ? a : []).slice(0, 30).map(key).filter(Boolean);
  const v = { v: 1, tabs, home: key(body.home) || "desk",
    cards: { left: side(body.cards?.left), right: side(body.cards?.right) },
    min: side(body.min), at: new Date().toISOString(), by: who };
  // Reset = empty lists; the app fills in its default order for anything not listed.
  if (body.reset) { v.tabs = []; v.home = "desk"; v.cards = { left: [], right: [] }; v.min = []; }
  await putSetting("layout", v, who);
  return v;
}

let VAPID: { pub: string; jwk: any } | null = null;
async function vapid() {
  if (VAPID) return VAPID;
  let v = await setting("push_vapid");
  if (!v?.pub || !v?.jwk) {
    const kp = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]) as CryptoKeyPair;
    const pub = new Uint8Array(await crypto.subtle.exportKey("raw", kp.publicKey));
    v = { pub: b64u(pub), jwk: await crypto.subtle.exportKey("jwk", kp.privateKey) };
    await putSetting("push_vapid", v, "setup");
    const again = await setting("push_vapid");                 // another copy may have won the race
    if (again?.pub) v = again;
  }
  VAPID = v;
  return v;
}

async function vapidAuth(endpoint: string) {
  const v = await vapid();
  const key = await crypto.subtle.importKey("jwk", v.jwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const head = b64u(te.encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const body = b64u(te.encode(JSON.stringify({ aud: new URL(endpoint).origin, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: PUSH_SUB_URL })));
  const sig = new Uint8Array(await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, te.encode(head + "." + body)));
  return `vapid t=${head}.${body}.${b64u(sig)}, k=${v.pub}`;
}

// RFC 8291 / 8188: one aes128gcm record.
async function encryptPush(sub: any, payload: Uint8Array) {
  const uaPub = unb64u(sub.keys.p256dh), auth = unb64u(sub.keys.auth);
  const eph = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]) as CryptoKeyPair;
  const asPub = new Uint8Array(await crypto.subtle.exportKey("raw", eph.publicKey));
  const uaKey = await crypto.subtle.importKey("raw", uaPub, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: "ECDH", public: uaKey }, eph.privateKey, 256));
  const prkKey = await hmac(auth, shared);
  const ikm = await hmac(prkKey, cat(te.encode("WebPush: info\0"), uaPub, asPub, new Uint8Array([1])));
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const prk = await hmac(salt, ikm);
  const cek = (await hmac(prk, cat(te.encode("Content-Encoding: aes128gcm\0"), new Uint8Array([1])))).slice(0, 16);
  const nonce = (await hmac(prk, cat(te.encode("Content-Encoding: nonce\0"), new Uint8Array([1])))).slice(0, 12);
  const k = await crypto.subtle.importKey("raw", cek, { name: "AES-GCM" }, false, ["encrypt"]);
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, k, cat(payload, new Uint8Array([2]))));
  const rs = new Uint8Array([0, 0, 16, 0]);                   // record size 4096
  return cat(salt, rs, new Uint8Array([asPub.length]), asPub, ct);
}

async function sendPush(sub: any, msg: any) {
  const body = await encryptPush(sub, te.encode(JSON.stringify(msg).slice(0, 3000)));
  const r = await fetch(sub.endpoint, { method: "POST", headers: {
    authorization: await vapidAuth(sub.endpoint), "content-encoding": "aes128gcm", "content-type": "application/octet-stream",
    ttl: "3600", urgency: msg.kind === "morning" ? "normal" : "high" }, body });
  return r.status;
}

function quietNow() { const e = etParts(); return ["Sat", "Sun"].includes(e.wd) || e.min < 540 || e.min > 990; }

// The one call everything else uses. Never throws: a notification is a convenience.
async function notify(kind: string, title: string, body: string, url = "./#desk") {
  if (TEST?.notify) TEST.notify(kind, unname(title), unname(body));
  try {
    const K = PUSH_KINDS[kind]; if (!K) return;
    // v3.9: no quiet hours — Ifoma's call (6 Oct): Otto pings at any time.
    const subs: Record<string, any> = (await setting("push_subs")) || {};
    let changed = false;
    for (const [id, s] of Object.entries(subs)) {
      const want = s.prefs && kind in s.prefs ? !!s.prefs[kind] : K.on;
      if (!want) continue;
      try {
        const st = await sendPush(s.sub, { kind, title: unname(title).slice(0, 120), body: unname(body).slice(0, 300), url, tag: kind + "-" + Date.now() });
        if (st === 404 || st === 410) { delete subs[id]; changed = true; }
      } catch (e) { console.error("push", (e as Error).message); }
    }
    if (changed) await putSetting("push_subs", subs);
  } catch (e) { console.error("notify", (e as Error).message); }
}

async function pushSubscribe(b: any, who: string) {
  const sub = b?.subscription;
  if (!sub?.endpoint || !/^https:\/\//.test(sub.endpoint) || !sub?.keys?.p256dh || !sub?.keys?.auth) throw new Error("bad subscription");
  const subs: Record<string, any> = (await setting("push_subs")) || {};
  const id = b64u(new Uint8Array(await crypto.subtle.digest("SHA-256", te.encode(sub.endpoint)))).slice(0, 16);
  const prefs: Record<string, boolean> = {};
  for (const k of Object.keys(PUSH_KINDS)) prefs[k] = b.prefs && k in b.prefs ? !!b.prefs[k] : (subs[id]?.prefs?.[k] ?? PUSH_KINDS[k].on);
  subs[id] = { sub: { endpoint: sub.endpoint, keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth } },
    label: String(b.label || subs[id]?.label || "Phone").slice(0, 40), prefs, at: new Date().toISOString(), by: who };
  await putSetting("push_subs", subs, who);
  return { id, label: subs[id].label, prefs };
}
async function pushList(endpoint?: string) {
  const subs: Record<string, any> = (await setting("push_subs")) || {};
  const list = Object.entries(subs).map(([id, s]) => ({ id, label: s.label, at: s.at, prefs: s.prefs, mine: !!endpoint && s.sub.endpoint === endpoint }));
  return { kinds: PUSH_KINDS, list };
}
async function pushRemove(b: any) {
  const subs: Record<string, any> = (await setting("push_subs")) || {};
  for (const [id, s] of Object.entries(subs)) if (id === b.id || s.sub.endpoint === b.endpoint) delete subs[id];
  await putSetting("push_subs", subs);
  return { ok: true };
}
async function pushTest(b: any) {
  const subs: Record<string, any> = (await setting("push_subs")) || {};
  const hit = Object.values(subs).find((s: any) => s.sub.endpoint === b.endpoint) as any;
  if (!hit) throw new Error("This phone isn't turned on yet");
  const st = await sendPush(hit.sub, { kind: "test", title: "✓ Otto notifications work", body: `${hit.label}: this is what a Desk alert looks like.`, url: "./#desk", tag: "test" });
  if (st >= 300) throw new Error("Push service answered " + st);
  return { ok: true, status: st };
}

/* ===================================================================== v3.3
   5 Oct 2026 — Results page, editable limits & goals, Help chat.
   Limits live in otto_settings (007_v33.sql) so Ifoma and Josh change them in
   Settings with no code. They are warnings on cards, never blocks. */

// v3.13 (Ifoma, 6 Oct): limits are % of the Agentic account — 10% max loss per trade (at the stop),
// 20% weekly, a daily stop after 2 losing trades or 2× the max loss. All of them FLAG; none blocks.
const LIMIT_DEFAULTS: any = { phase: 1, max_trade_loss: 100, weekly_loss: 150, max_trades_day: 2, monthly_goal_pct: 5, warn_pct: 20, big_day: 500,
  auto_close: true, review_min: 15, max_trade_pct: 10, weekly_pct: 20, daily_losses: 2,
  // v3.26 (Ifoma, 9 Oct): every guardrail is on/off + a number in Settings. Size cap and kill switch are new.
  size_cap_on: true, size_cap_pct: 25, max_loss_on: true, daily_on: true, daily_x: 2, weekly_on: true, trades_on: true,
  kill_on: true, kill_daily: true, kill_weekly: true, kill_trades: true,
  vwap_block: true,   // v3.39 (18 Oct, one-week trial): block a long when the stock and SPY are both under VWAP
  // v3.27: which ideas may go LIVE (real money). Everything else is a PAPER card: shown, scored, never approvable.
  live_coach_call: true, live_coach_level: false, live_jarvis: false };
async function agenticValue(): Promise<number | null> {
  return cached("agentic_value", 5 * 60e3, async () => {
    try {
      const pj = mcpJson(await call("rh", "get_portfolio", { account_number: await agenticAccount() }));
      return Number(pj?.data?.total_value ?? pj?.total_value) || null;
    } catch { return null; }
  });
}
export async function getLimits(): Promise<any> {
  return cached("limits", 30e3, async () => {
    let L: any;
    try {
      const r = await db("otto_settings?key=eq.limits&select=value,updated_by,updated_at");
      L = { ...LIMIT_DEFAULTS, ...(r?.[0]?.value || {}), _by: r?.[0]?.updated_by || null, _at: r?.[0]?.updated_at || null };
    } catch { L = { ...LIMIT_DEFAULTS }; }
    // v3.26: a loosening that was waiting for the next trading day takes effect at its time.
    try { L = await applyPendingLimits(L); } catch { /* the waiting change stays waiting */ }
    // % limits become today's dollars from the live account value; the stored $ stay as the fallback.
    const v = (Number(L.max_trade_pct) > 0 || Number(L.weekly_pct) > 0 || L.size_cap_on) ? await agenticValue() : null;
    L.account_value = v;
    if (v && Number(L.max_trade_pct) > 0) L.max_trade_loss = Math.round(v * L.max_trade_pct / 100);
    if (v && Number(L.weekly_pct) > 0) L.weekly_loss = Math.round(v * L.weekly_pct / 100);
    L.size_cap_usd = v && Number(L.size_cap_pct) > 0 ? Math.round(v * L.size_cap_pct / 100) : null;
    L.pct_mode = !!v;
    return L;
  });
}
const num0 = (v: any) => { const n = Number(v); return isFinite(n) ? n : 0; };
const bool = (v: any) => v === true || v === "true" || v === 1 || v === "1" || v === "on";
// v3.26: which edits loosen a guardrail (off, or a higher number). Those wait for the next trading day 9:30 AM ET.
const LIM_TOGGLES = ["size_cap_on", "max_loss_on", "daily_on", "weekly_on", "trades_on", "kill_on", "kill_daily", "kill_weekly", "kill_trades", "live_coach_call", "live_coach_level", "live_jarvis"];
const LIM_HIGHER_LOOSER = ["size_cap_pct", "max_trade_pct", "max_trade_loss", "weekly_pct", "weekly_loss", "max_trades_day", "daily_losses", "daily_x"];
const ZERO_IS_OFF = new Set(["size_cap_pct", "max_trade_pct", "max_trade_loss", "daily_losses", "daily_x"]);
export function isLooser(k: string, oldV: any, newV: any): boolean {
  if (k.startsWith("live_")) return !bool(oldV) && bool(newV);   // v3.27: letting a source go LIVE loosens; turning it off tightens
  if (LIM_TOGGLES.includes(k)) return bool(oldV) && !bool(newV);
  if (LIM_HIGHER_LOOSER.includes(k)) {
    const f = (x: any) => { const n = num0(x); return ZERO_IS_OFF.has(k) && n === 0 ? Infinity : n; };
    return f(newV) > f(oldV);
  }
  return false;
}
/** When a loosening starts: 9:30 AM ET today if it's a trading day before the open, else the next trading day. */
export function looseningStarts(now = new Date()): string {
  const e = etParts(now);
  const day = isTradingDay(e.date) && e.min < 570 ? e.date : nextTradingDay(e.date);
  return nyIso(day, "9:30 AM") || new Date(now.getTime() + 864e5).toISOString();
}
const LIM_LABEL: Record<string, string> = { size_cap_on: "Size cap", size_cap_pct: "Size cap %", max_loss_on: "Max loss per trade", max_trade_pct: "Max loss per trade %",
  max_trade_loss: "Max loss per trade $", daily_on: "Daily stop", daily_losses: "Daily stop (losing trades)", daily_x: "Daily stop (× max loss)",
  weekly_on: "Weekly limit", weekly_pct: "Weekly limit %", weekly_loss: "Weekly limit $", trades_on: "Max trades per day", max_trades_day: "Max trades per day",
  kill_on: "Kill switch", kill_daily: "Kill switch · daily stop", kill_weekly: "Kill switch · weekly limit", kill_trades: "Kill switch · max trades",
  live_coach_call: "LIVE · coach's call", live_coach_level: "LIVE · coach's level, Jarvis's direction", live_jarvis: "LIVE · Jarvis/Josh's own ideas",
  auto_close: "Auto-close exits", warn_pct: "Warn over % of account", monthly_goal_pct: "Monthly goal %", phase: "Phase", big_day: "Big-loss day $", review_min: "Review every (min)" };
const limShow = (k: string, v: any) => typeof v === "boolean" || LIM_TOGGLES.includes(k) || k === "auto_close" ? (bool(v) ? "on" : "off") : String(v);
async function applyPendingLimits(L: any): Promise<any> {
  const p = await setting("limits_pending").catch(() => null);
  if (!p || !p.changes || !Object.keys(p.changes).length) return L;
  if (Date.now() < Date.parse(p.effective_at)) { L.pending = p; return L; }
  const raw = await db("otto_settings?key=eq.limits&select=value").then((r: any) => r?.[0]?.value || {}).catch(() => ({}));
  const value = { ...LIMIT_DEFAULTS, ...raw, ...p.changes };
  for (const k of Object.keys(value)) if (k.startsWith("_") || ["account_value", "pct_mode", "pending", "size_cap_usd"].includes(k)) delete (value as any)[k];
  await db("otto_settings?on_conflict=key", { method: "POST", headers: { prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify({ key: "limits", value, updated_by: String(p.by || "?") + " (waited for the next trading day)", updated_at: new Date().toISOString() }) });
  await putSetting("limits_pending", { changes: {}, cleared: "applied", at: new Date().toISOString() }, "otto");
  await activity("change", `Took effect: ${Object.entries(p.changes).map(([k, v]) => `${LIM_LABEL[k] || k} → ${limShow(k, v)}`).join(", ")} (set by ${p.by} ${etLabel(p.at)})`, String(p.by || "Otto"),
    `limits-applied|${p.at}`);
  delete CACHE.lockstate;
  return { ...L, ...p.changes, pending: null };
}
async function setLimits(body: any, who: string) {
  const by = String(body?.author || "").trim().slice(0, 40) || who.split("@")[0];
  const rawRow = await db("otto_settings?key=eq.limits&select=value").then((r: any) => r?.[0]?.value || {}).catch(() => ({}));
  const raw: any = { ...LIMIT_DEFAULTS, ...rawRow };
  const pend = await setting("limits_pending").catch(() => null);
  // "Cancel change" on the waiting banner: drop the waiting loosening (cancelling is never a loosening).
  if (body?.cancel_pending) {
    if (pend?.changes && Object.keys(pend.changes).length) {
      await putSetting("limits_pending", { changes: {}, cleared: "cancelled", by, at: new Date().toISOString() }, who);
      await activity("change", `Cancelled the waiting change: ${Object.entries(pend.changes).map(([k, v]) => `${LIM_LABEL[k] || k} → ${limShow(k, v)}`).join(", ")}`, by);
    }
    delete CACHE.limits;
    return await getLimits();
  }
  const v: any = { ...raw, ...(pend?.changes || {}), ...Object.fromEntries(Object.entries(body || {}).filter(([k, x]) => x !== "" && x != null && k !== "author")) };
  const num = (k: string, lo: number, hi: number) => {
    const n = Number(v[k]); if (!isFinite(n) || n < lo || n > hi) throw new Error(`${(LIM_LABEL[k] || k.replace(/_/g, " "))} must be between ${lo} and ${hi}`); return n;
  };
  const next: any = { phase: num("phase", 1, 3), max_trade_loss: num("max_trade_loss", 0, 1e6), weekly_loss: num("weekly_loss", 1, 1e6),
    max_trades_day: num("max_trades_day", 1, 100), monthly_goal_pct: num("monthly_goal_pct", 0, 100), warn_pct: num("warn_pct", 1, 100),
    big_day: num("big_day", 1, 1e7), auto_close: bool(v.auto_close), review_min: num("review_min", 5, 120),
    max_trade_pct: num("max_trade_pct", 0, 100), weekly_pct: num("weekly_pct", 0, 100), daily_losses: num("daily_losses", 0, 20),
    size_cap_pct: num("size_cap_pct", 0, 100), daily_x: num("daily_x", 0, 20) };
  for (const k of LIM_TOGGLES) next[k] = bool(v[k]);
  // Tightening works now; loosening waits for the next trading day 9:30 AM ET.
  const now: any = {}, wait: any = {}, changes: string[] = [];
  for (const k of Object.keys(next)) {
    const old = raw[k];
    if (limShow(k, old) === limShow(k, next[k]) && !(k in (pend?.changes || {}))) { now[k] = next[k]; continue; }
    if (isLooser(k, old, next[k])) { wait[k] = next[k]; now[k] = old; }
    else { now[k] = next[k]; if (limShow(k, old) !== limShow(k, next[k])) changes.push(`${LIM_LABEL[k] || k} ${limShow(k, old)} → ${limShow(k, next[k])}`); }
  }
  await db("otto_settings?on_conflict=key", { method: "POST", headers: { prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify({ key: "limits", value: now, updated_by: by + " (" + who + ")", updated_at: new Date().toISOString() }) });
  // The waiting list: keep earlier waiting edits unless this save set that limit back.
  const waiting = { ...wait };
  const newWait = Object.keys(wait).filter((k) => limShow(k, pend?.changes?.[k]) !== limShow(k, wait[k]));
  const at = new Date().toISOString(), eff = newWait.length || !pend?.effective_at ? looseningStarts() : pend.effective_at;
  await putSetting("limits_pending", Object.keys(waiting).length ? { changes: waiting, effective_at: eff, by, at } : { changes: {}, cleared: "save", at }, who);
  delete CACHE.limits; delete CACHE.agentic_value; delete CACHE.lockstate;
  if (changes.length) await activity("change", `Limits: ${changes.join(", ")} (now)`, by);
  if (newWait.length) await activity("change", `Limits: ${newWait.map((k) => `${LIM_LABEL[k] || k} ${limShow(k, raw[k])} → ${limShow(k, wait[k])}`).join(", ")} — loosening, starts ${etLabel(eff)}`, by);
  if (changes.length || newWait.length)
    await logDesk("system", "Otto", `Guardrails updated by ${by}: ${[...changes.map((c) => c + " (now)"), ...newWait.map((k) => `${LIM_LABEL[k] || k} → ${limShow(k, wait[k])} (starts ${etLabel(eff)} — loosening waits for the next trading day)`)].join("; ")}.`);
  return await getLimits();
}

// Daily realized P&L, both accounts combined (Robinhood's own P&L numbers).
async function dailyPnl(): Promise<{ days: any[]; total_all: number | null; trades: number }> {
  return cached("dailypnl", 5 * 60e3, async () => {
    const by: Record<string, { pnl: number; trades: number }> = {};
    let totalAll = 0, gotAll = false, trades = 0;
    for (const a of await allAccounts()) {
      try {
        const j = mcpJson(await call("rh", "get_realized_pnl", { account_number: a.n, span: "3month", timezone: "America/New_York" }));
        for (const d of j?.data?.data_points || []) {
          if (d.realized_gain == null && !d.number_of_trades) continue;
          const day = etParts(new Date(Date.parse(d.start_time) + 6 * 3600e3)).date;
          const e = by[day] ||= { pnl: 0, trades: 0 };
          e.pnl += Number(d.realized_gain || 0); e.trades += Number(d.number_of_trades || 0); trades += Number(d.number_of_trades || 0);
        }
      } catch { /* one account failing shouldn't blank the page */ }
      try {
        const y = mcpJson(await call("rh", "get_realized_pnl", { account_number: a.n, span: "all" }));
        if (y?.data?.total_returns != null) { totalAll += Number(y.data.total_returns); gotAll = true; }
      } catch { /* */ }
    }
    const days = Object.entries(by).map(([date, v]) => ({ date, pnl: +v.pnl.toFixed(2), trades: v.trades })).sort((a, b) => a.date.localeCompare(b.date));
    return { days, total_all: gotAll ? +totalAll.toFixed(2) : null, trades };
  });
}

async function performance(apiKey: string, wantRead: boolean, fresh = false) {
  const L = await getLimits();
  if (fresh) delete CACHE["dailypnl"];
  const now = etParts();
  const [pnl, accts] = await Promise.all([dailyPnl(), allAccounts()]);
  const values = await Promise.all(accts.map(async (a) => {
    try { const p = mcpJson(await call("rh", "get_portfolio", { account_number: a.n })); return { label: a.label, value: Number(p?.data?.total_value || 0), cash: Number(p?.data?.cash || 0) }; }
    catch { return { label: a.label, value: null, cash: null }; }
  }));
  const combined = values.reduce((s, v) => s + (v.value || 0), 0);
  const days = pnl.days;
  const first = days.find((d) => d.trades > 0)?.date || null;
  // weeks (Mon–Fri, New York time)
  const weeks: Record<string, { pnl: number; trades: number }> = {};
  days.forEach((d) => { const w = mondayOf(d.date); const e = weeks[w] ||= { pnl: 0, trades: 0 }; e.pnl += d.pnl; e.trades += d.trades; });
  const thisWeek = mondayOf(now.date);
  if (!weeks[thisWeek]) weeks[thisWeek] = { pnl: 0, trades: 0 };
  const weekList = Object.entries(weeks).map(([week, v]) => ({ week, pnl: +v.pnl.toFixed(2), trades: v.trades })).sort((a, b) => a.week.localeCompare(b.week))
    .filter((w) => !first || w.week >= mondayOf(first));
  const traded = days.filter((d) => d.trades > 0 && d.pnl !== 0);
  const wins = traded.filter((d) => d.pnl > 0), losses = traded.filter((d) => d.pnl < 0);
  const big = traded.filter((d) => d.pnl <= -L.big_day).sort((a, b) => a.pnl - b.pnl);
  const sum = (l: any[]) => l.reduce((s, d) => s + d.pnl, 0);
  // weeks in a row (most recent completed weeks) without a big week
  let cleanWeeks = 0;
  for (const w of weekList.filter((w) => w.week < thisWeek).reverse()) { if (w.pnl > -L.big_day) cleanWeeks++; else break; }
  // this week / today, from the Journal (single-trade detail) and Robinhood orders
  let trades: any[] = [];
  try { await syncJournal(); trades = await db("otto_trades?select=*&order=opened_at.desc&limit=400"); } catch { /* */ }
  const inWeek = (t: string | null) => !!t && etParts(new Date(t)).date >= thisWeek;
  const weekTrades = trades.filter((t) => t.pnl != null && inWeek(t.closed_at));
  const worstThisWeek = weekTrades.reduce((m, t) => Math.min(m, Number(t.pnl)), 0);
  const tradesToday = trades.filter((t) => t.opened_at && etParts(new Date(t.opened_at)).date === now.date).length;
  const monthStart = now.date.slice(0, 8) + "01";
  const monthPnl = days.filter((d) => d.date >= monthStart).reduce((s, d) => s + d.pnl, 0);
  // how we trade (from the Journal)
  const closed = trades.filter((t) => t.pnl != null && (t.status === "closed" || t.status === "expired"));
  const cp: any = { calls: { n: 0, pnl: 0 }, puts: { n: 0, pnl: 0 } };
  const tick: Record<string, number> = {};
  closed.forEach((t) => { const k = / \d+(\.\d+)?P /.test(t.contract + " ") ? "puts" : "calls"; cp[k].n++; cp[k].pnl += Number(t.pnl); tick[t.symbol] = (tick[t.symbol] || 0) + Number(t.pnl); });
  const tickers = Object.entries(tick).map(([s, v]) => ({ s, pnl: +v.toFixed(2) })).sort((a, b) => b.pnl - a.pnl);
  // rules vs results (trades linked to a Desk card with a rule check)
  const ids = [...new Set(closed.map((t) => t.action_id).filter(Boolean))];
  const acts = ids.length ? await db("otto_actions?select=id,checks&id=in.(" + ids.join(",") + ")").catch(() => []) : [];
  const chk: Record<string, any[]> = Object.fromEntries(acts.map((a: any) => [a.id, a.checks || []]));
  const followed = closed.filter((t) => chk[t.action_id] && chk[t.action_id].every((c: any) => c.ok !== false));
  const broke = closed.filter((t) => chk[t.action_id] && chk[t.action_id].some((c: any) => c.ok === false));
  const overLimit = L.max_trade_loss > 0 ? closed.filter((t) => Number(t.pnl) < -L.max_trade_loss) : [];
  const out: any = {
    ok: true, limits: L, as_of: new Date().toISOString(), first_trade_day: first,
    accounts: values, combined: +combined.toFixed(2),
    realized: { since_start: pnl.total_all ?? +sum(days).toFixed(2), last_90d: +sum(days).toFixed(2), trades: pnl.trades },
    weeks: weekList,
    days: { winning: wins.length, losing: losses.length, avg_win: wins.length ? +(sum(wins) / wins.length).toFixed(2) : null,
      avg_loss: losses.length ? +(sum(losses) / losses.length).toFixed(2) : null },
    big_days: big.map((d) => ({ date: d.date, pnl: d.pnl, trades: d.trades })), big_total: +sum(big).toFixed(2),
    rest_total: +(sum(traded) - sum(big)).toFixed(2),
    goals: {
      week_pnl: +(weeks[thisWeek]?.pnl || 0).toFixed(2), worst_trade_week: +worstThisWeek.toFixed(2), trades_today: tradesToday,
      clean_weeks: cleanWeeks, month_pnl: +monthPnl.toFixed(2), month_goal: +(combined * L.monthly_goal_pct / 100).toFixed(2),
    },
    how: { calls: { n: cp.calls.n, pnl: +cp.calls.pnl.toFixed(2) }, puts: { n: cp.puts.n, pnl: +cp.puts.pnl.toFixed(2) },
      best: tickers[0] || null, worst: tickers.length > 1 ? tickers[tickers.length - 1] : null },
    rules: { followed: { n: followed.length, pnl: +sum(followed.map((t) => ({ pnl: Number(t.pnl) }))).toFixed(2) },
      broke: { n: broke.length, pnl: +sum(broke.map((t) => ({ pnl: Number(t.pnl) }))).toFixed(2) },
      over_limit: { n: overLimit.length, pnl: +sum(overLimit.map((t) => ({ pnl: Number(t.pnl) }))).toFixed(2) } },
  };
  // Jarvis's read — one short paragraph, cached per day and per change in the numbers
  const readKey = `read|${now.date}|${out.realized.since_start}|${out.goals.week_pnl}|${L.max_trade_loss}|${L.weekly_loss}`;
  if (CACHE[readKey]) out.read = CACHE[readKey].v;
  else if (wantRead && apiKey) {
    try {
      const r = await aiFetch("performance", { method: "POST",
        headers: { "content-type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({ model: await roomModel(), max_tokens: 300,
          system: "You are Jarvis on the Otto trading desk, writing the 2–3 sentence summary at the top of Ifoma and Josh's Results page. They trade as one team. Plain words, numbers first, no hype, no lecturing. Say where they are against their limits and the one thing that matters most. Never give sizing beyond their own limits.",
          messages: [{ role: "user", content: JSON.stringify({ realized_since_start: out.realized.since_start, combined_value: out.combined, weeks: out.weeks.slice(-8),
            big_days: out.big_days, rest_total: out.rest_total, days: out.days, goals: out.goals, limits: { phase: L.phase, max_trade_loss: L.max_trade_loss, weekly_loss: L.weekly_loss, max_trades_day: L.max_trades_day } }) }] }) });
      const j = await r.json();
      out.read = (j.content || []).filter((c: any) => c.type === "text").map((c: any) => c.text).join("").trim();
      CACHE[readKey] = { at: Date.now(), v: out.read };
    } catch { /* page works without it */ }
  }
  return out;
}

// Limit checks that go on every opening card, next to the rule check.
export async function limitChecks(cost: number | null, atStop: number | null = null): Promise<any[]> {
  const L = await getLimits();
  const out: any[] = [];
  // v3.26: a guardrail switched off in Settings is not checked at all.
  const maxLoss = L.max_loss_on === false ? 0 : Number(L.max_trade_loss) || 0;
  const cap = maxLoss > 0 ? `${L.pct_mode && L.max_trade_pct > 0 ? `your ${L.max_trade_pct}% max, $${maxLoss}` : `your max $${maxLoss}`}` : "";
  if (atStop != null) {
    out.push({ ok: maxLoss > 0 ? atStop <= maxLoss : null, guard: true,
      text: `Loss if the stop fills: about −$${atStop.toFixed(0)}${cap ? (atStop <= maxLoss ? ` (inside ${cap})` : ` — OVER ${cap}`) : L.max_loss_on === false ? " (max loss per trade is off)" : " (no per-trade max set)"}. Option stops can fill lower on a fast move.` });
    if (cost != null) out.push({ ok: null, text: `Whole premium $${cost.toFixed(0)} (lost only if the option goes to zero)` });
  } else if (cost != null) out.push({ ok: maxLoss > 0 ? cost <= maxLoss : null, guard: true, text: `Most this trade can lose: $${cost.toFixed(0)}${cap ? (cost <= maxLoss ? ` (inside ${cap})` : ` — OVER ${cap}`) : " (no per-trade max set)"}` });
  // Daily stop: N losing trades today, or losses of daily_x × the max loss (Agentic account).
  if (L.daily_on !== false) {
    try {
      // v3.24 (A7): counted from Robinhood's own order records (round trips), the journal only if Robinhood can't be read.
      const cnt = await todayCounts();
      const losers = cnt.losers, dayPnl = cnt.realized;
      const nMax = Number(L.daily_losses) || 0, dMax = maxLoss > 0 && Number(L.daily_x ?? 2) > 0 ? Number(L.daily_x ?? 2) * maxLoss : 0;
      const hit = (nMax > 0 && losers >= nMax) || (dMax > 0 && dayPnl <= -dMax);
      out.push({ ok: !hit, guard: true, text: hit
        ? `DAILY STOP: ${losers} losing trade${losers === 1 ? "" : "s"} today, $${dayPnl.toFixed(0)} — your rule says done for the day`
        : `Today: ${losers} losing trade${losers === 1 ? "" : "s"}, $${dayPnl.toFixed(0)} (daily stop at ${nMax || "—"} losers${dMax ? ` or −$${dMax}` : ""})` });
    } catch { out.push({ ok: null, text: "Daily stop: couldn't read today's trades" }); }
  }
  if (L.weekly_on !== false) {
    try {
      const weekPnl = await weekPnlNow();
      out.push({ ok: weekPnl > -L.weekly_loss, guard: true, text: weekPnl <= -L.weekly_loss
        ? `WEEKLY LIMIT hit ($${weekPnl.toFixed(0)} of −$${L.weekly_loss}${L.pct_mode && L.weekly_pct > 0 ? `, ${L.weekly_pct}%` : ""}): your rule says stop for the week`
        : `This week $${weekPnl.toFixed(0)} (stop at −$${L.weekly_loss})` });
    } catch { out.push({ ok: null, text: "Weekly P&L: couldn't read Robinhood" }); }
  }
  if (L.trades_on !== false) {
    try {
      const n = (await todayCounts()).opened;   // v3.24: Robinhood fills, not the journal
      out.push({ ok: n < L.max_trades_day, guard: true, text: `Trade ${n + 1} today (your max ${L.max_trades_day})` });
    } catch { /* */ }
  }
  return out;
}
async function weekPnlNow(): Promise<number> {
  const p = await dailyPnl();
  const wk = mondayOf(etParts().date);
  return p.days.filter((d) => d.date >= wk).reduce((s, d) => s + d.pnl, 0);
}

/* ===================================================================== v3.14
   6 Oct 2026 — the Watcher (Phase 1) and the Scoreboard upgrade (Phase 2).

   Why: on 6 Oct SPY pulled back to the 778.60 Signal level and the 10:30 5-minute bar
   closed green off it. Nobody was watching between messages, so the bounce came and
   went. Now the server watches: every minute 9:30–4:00 ET (pg_cron → ?fn=cron_watch)
   it reads Robinhood 5- and 10-minute bars for every level on today's list and checks
   three triggers IN CODE on completed bars:
     up   · break           previous close at/below the level, this close above it
     up   · pullback-hold   previous close above, this bar dipped to the level and closed green above it
     down · break           previous close at/above, this close below it
     down · rejection       previous close below, this bar reached the level and closed red below it
   A hit is claimed atomically (one card per level per direction per day), posted on the
   Desk, and handed to Jarvis in its own invocation (?fn=watch_jarvis) to decide whether
   it's a real setup; a card + ONE ping only when he makes one. Levels come from Signal
   posts (automatic), the Desk (Jarvis's add_watch_level tool or the panel) and the
   9:20 scanner on SPY/QQQ/Mag-7 (proposed — Ifoma or Josh tap Add). Levels expire at
   the close (each row belongs to one day). Ifoma's decisions, approved mockup
   otto-v3.14-watcher-mockup.html. Table otto_watch (013_v314.sql). */

export type Bar = { t: number; o: number; h: number; l: number; c: number };   // t = bar START, epoch ms
const WATCH_SCAN = ["SPY", "QQQ", "AAPL", "MSFT", "NVDA", "AMZN", "GOOGL", "META", "TSLA"];
const TRIG_LABEL: Record<string, string> = { break: "break-and-close", "pullback-hold": "pullback-and-hold", rejection: "rejection" };

// The trading day a new level belongs to: today until the close, then the next trading day.
function watchDay(now = new Date()) {
  const c = marketClock(now);
  return c.status === "after" || c.status === "closed" ? nextTradingDay(c.date) : c.date;
}

export function parseRhBars(j: any): Record<string, Bar[]> {
  const out: Record<string, Bar[]> = {};
  for (const r of (j?.data?.results || j?.results || [])) {
    out[String(r.symbol).toUpperCase()] = (r.bars || []).filter((b: any) => !b.interpolated).map((b: any) => ({
      t: Date.parse(b.begins_at), o: Number(b.open_price), h: Number(b.high_price), l: Number(b.low_price), c: Number(b.close_price) }))
      .filter((b: Bar) => [b.o, b.h, b.l, b.c].every((v) => isFinite(v) && v > 0));
  }
  return out;
}
// Robinhood bars for up to 10 symbols per call, cached ~45 s so one cron minute makes at most one call per batch.
async function rhBars(tickers: string[], interval: "5minute" | "10minute", startIso: string, endIso?: string): Promise<Record<string, Bar[]>> {
  const out: Record<string, Bar[]> = {};
  const uniq = [...new Set(tickers.map((t) => t.toUpperCase()))];
  for (let i = 0; i < uniq.length; i += 10) {
    const part = uniq.slice(i, i + 10);
    const key = `rhb|${interval}|${part.join(",")}|${startIso}|${endIso || ""}`;
    Object.assign(out, await cached(key, 45e3, async () =>
      parseRhBars(mcpJson(await call("rh", "get_equity_historicals", { symbols: part, interval, start_time: startIso, ...(endIso ? { end_time: endIso } : {}) })))));
  }
  return out;
}
// Only bars that have finished (start + length ≤ now).
export function completedBars(bars: Bar[], mins: number, now = Date.now()) { return bars.filter((b) => b.t + mins * 60e3 <= now); }
export const watchTol = (level: number) => Math.max(level * 0.00035, 0.02);

/** The trigger on the LAST completed bar, if any. earliestMin = ET minute a trigger bar must close at or after. */
export function evalLevel(level: number, d: "up" | "down", bars: Bar[], mins: number, o: { now?: number; earliestMin?: number; maxAgeMs?: number } = {}) {
  const now = o.now ?? Date.now();
  const done = completedBars(bars, mins, now);
  if (done.length < 2) return null;
  const b = done[done.length - 1], p = done[done.length - 2];
  const closeAt = b.t + mins * 60e3;
  if (now - closeAt > (o.maxAgeMs ?? (mins + 2) * 60e3)) return null;          // stale: a missed minute must not fire late
  if (etParts(new Date(closeAt)).min < (o.earliestMin ?? 600)) return null;
  const tol = watchTol(level);
  // A pullback / rejection needs price to have moved AWAY from the level first (≥ 3× tolerance since it last
  // crossed), so the bar right after a break doesn't count as a "retest".
  const prior = done.slice(0, -1);
  const awayFrom = (side: 1 | -1) => {
    let k = prior.length - 1; while (k >= 0 && side * (prior[k].c - level) > 0) k--;
    const run = prior.slice(k + 1);
    return run.length > 0 && Math.max(...run.map((x) => side * (x.c - level))) >= 3 * tol;
  };
  let trigger: string | null = null;
  if (d === "up") {
    if (p.c <= level && b.c > level) trigger = "break";
    // v3.26 (9 Oct MSFT: "rejection" fired on bars whose highs never reached the level): the bar must TOUCH it.
    else if (p.c > level && b.l <= level && b.c > level && b.c > b.o && awayFrom(1)) trigger = "pullback-hold";
  } else {
    if (p.c >= level && b.c < level) trigger = "break";
    else if (p.c < level && b.h >= level && b.c < level && b.c < b.o && awayFrom(-1)) trigger = "rejection";
  }
  return trigger ? { trigger, d, tf: mins, bar: b, prev: p, close_at: new Date(closeAt).toISOString() } : null;
}
// How many times today's 5-minute closes crossed the level — Jarvis is told when a level is chop.
export function crossings(level: number, bars: Bar[]) {
  let n = 0; for (let i = 1; i < bars.length; i++) if ((bars[i - 1].c - level) * (bars[i].c - level) < 0) n++; return n;
}

/* ------------------------------------------------------------ levels in */
async function watchRows(day = marketClock().date, statuses = "watching,proposed") {
  return await db(`otto_watch?select=*&day=eq.${day}&status=in.(${statuses})&order=created_at.asc&limit=200`).catch(() => []);
}
export async function watchAdd(x: { ticker: string; level: number; dir?: string; source: "signal" | "desk" | "scanner"; note?: string; source_ref?: string; by?: string; status?: string; coach_dir?: string | null }) {
  const ticker = String(x.ticker || "").toUpperCase().replace(/[^A-Z.]/g, "").slice(0, 8);
  const level = Math.round(Number(x.level) * 100) / 100;
  if (!ticker || !(level > 0)) throw new Error("need a ticker and a price level");
  if (x.source !== "scanner") await watchLevelGate(ticker, level);   // v3.22: no level >10% from the live price
  const dir = ["up", "down", "both"].includes(String(x.dir)) ? String(x.dir) : "both";
  const row = { day: watchDay(), ticker, level, dir, source: x.source, status: x.status || (x.source === "scanner" ? "proposed" : "watching"),
    note: String(x.note || "").slice(0, 200) || null, source_ref: x.source_ref || null, added_by: String(x.by || "").slice(0, 60) || null,
    ...(x.source === "signal" ? { coach_dir: x.coach_dir === "long" || x.coach_dir === "short" ? x.coach_dir : null } : {}) };
  const r = await db("otto_watch?on_conflict=day,ticker,level,dir&select=*", { method: "POST",
    headers: { prefer: "resolution=ignore-duplicates,return=representation" }, body: JSON.stringify([row]) });
  // v3.24 (A12): a level added on the losing side of an open trade becomes that trade's ONE wrong-if.
  if (x.source === "desk" && !/· (?:plan|Morning Prep|Night Charts|Homework|Callouts)$/.test(String(x.by || ""))) {
    const w = await wrongIfFromWatch(ticker, level, String(x.by || "the Desk")).catch(() => null);
    if (w) {
      const made = r?.[0] || null;
      if (made) await db("otto_watch?id=eq." + made.id, { method: "PATCH", headers: { prefer: "return=minimal" },
        body: JSON.stringify({ status: "removed", note: `wrong-if for ${String(w.action.title).slice(0, 120)}` }) }).catch(() => {});
      return { ...(made || row), status: "removed", trade_wrong_if: { title: w.action.title, old: w.old, same: !!w.same } };
    }
  }
  return r?.[0] || null;
}
// "SPY ABOVE 778.60 / SUPPORT 776 AND 775 / NVDA BELOW 240 PUTS" → levels with a side.
export function levelsFromWords(words: string, fallbackDir = "both"): { level: number; dir: string }[] {
  const out: { level: number; dir: string }[] = [];
  const W = String(words || "").toUpperCase().replace(/,/g, "");
  const re = /\b(ABOVE|OVER|BREAKS? ABOVE|RECLAIMS?|BELOW|UNDER|LOSES?|BREAKS? BELOW|SUPPORTS?|SUP|RESISTANCE|RES|LEVEL|AT)\s*(?:IS|OF|AT|=)?\s*\$?(\d{1,5}(?:\.\d{1,2})?)((?:\s*(?:AND|&|\/|,)\s*\$?\d{1,5}(?:\.\d{1,2})?)*)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(W))) {
    const k = m[1];
    const dir = /ABOVE|OVER|RECLAIM/.test(k) ? "up" : /BELOW|UNDER|LOSE/.test(k) ? "down" : /SUP/.test(k) ? "up" : /RES/.test(k) ? "down" : fallbackDir;
    for (const n of [m[2], ...((m[3] || "").match(/\d{1,5}(?:\.\d{1,2})?/g) || [])]) {
      const v = Number(n); if (v > 0 && !out.some((o) => o.level === v && o.dir === dir)) out.push({ level: v, dir });
    }
  }
  return out;
}
// v3.14: every Signal post with a ticker and a price level goes on today's watch list (Ifoma, 6 Oct).
async function watchFromSignals(rows: any[]) {
  let n = 0;
  const c = marketClock();
  if (c.status === "after" || c.status === "closed") return 0;      // the 5 PM sweep must not seed tomorrow
  rows = (rows || []).filter((r: any) => !r?.day || r.day === c.date);
  for (const r of rows || []) {
    if (!r?.ticker || r.kind === "note" || r.kind === "result") continue;   // v3.16: LATE calls too — the pullback to his level is the second chance
    const fb = r.direction === "long" ? "up" : r.direction === "short" ? "down" : "both";
    // v3.26 (fix 1): no direction from the coach → every level is watched BOTH ways; the close picks the side.
    const lv = levelsFromWords(String(r.words || ""), fb).map((x) => fb === "both" ? { ...x, dir: "both" } : x)
      .filter((x, i, a) => a.findIndex((y) => y.level === x.level && y.dir === x.dir) === i);
    if (!lv.length && Number(r.level) > 0) lv.push({ level: Number(r.level), dir: fb });
    for (const x of lv.slice(0, 4)) {
      try { if (await watchAdd({ ticker: r.ticker, level: x.level, dir: x.dir, source: "signal", note: String(r.summary || r.words || "").slice(0, 160), source_ref: String(r.id ?? ""), by: SIG_LABEL, coach_dir: r.direction || null })) n++; }
      catch { /* a bad number never breaks Signals */ }
    }
  }
  return n;
}
const WATCH_TOOL = {
  name: "add_watch_level",
  description: "Put a price level on the Watcher's list for today. The server checks it every minute on the 10-minute close (House Rule 2) and wakes you with the trigger (break-and-close, pullback-and-hold, rejection) so you can build the card. Use when Ifoma or Josh ask you to watch a level, or when you want a level watched. Never say you're watching something you didn't add here.",
  input_schema: { type: "object", properties: {
    ticker: { type: "string" }, level: { type: "number" },
    dir: { type: "string", enum: ["up", "down", "both"], description: "up = calls side (break above / hold above), down = puts side (break below / rejection), both" },
    note: { type: "string", description: "one short line: why this level" } }, required: ["ticker", "level", "dir"] },
};

/* ------------------------------------------------------------ the minute tick */
export const WATCH_TF: 5 | 10 = 10;     // v3.42: the bar whose close fires a Watcher card (10 = House Rule 2; 5 = the old 5-or-10 behaviour)
export async function watchTick(now = Date.now()) {
  const c = marketClock(new Date(now));
  if (c.status !== "open") return { ok: true, skipped: c.status };
  const rows = (await watchRows(c.date, "watching")) as any[];
  if (!rows.length) return { ok: true, levels: 0 };
  const start = nyIso(c.date, "9:30 AM") || new Date(now - 7 * 3600e3).toISOString();
  const tickers = [...new Set(rows.map((r) => r.ticker))];
  const [b5, b10] = await Promise.all([rhBars(tickers, "5minute", start), rhBars(tickers, "10minute", start).catch(() => ({} as Record<string, Bar[]>))]);
  const hits: any[] = [];
  for (const r of rows) {
    const bars5 = b5[r.ticker] || [];
    const last = bars5[bars5.length - 1];
    const dirs: ("up" | "down")[] = r.dir === "both" ? ["up", "down"] : [r.dir];
    // House Rule: a Signal level posted before the open may trade the open; everything else waits for 10:00.
    const earliest = r.source === "signal" ? 575 : 600;
    for (const d of dirs) {
      const prev = r.fired?.[d];
      // One CARD per level per side per day. A fire Jarvis passed on (no card) re-arms after 15 minutes.
      if (prev && (prev.cards?.length || !prev.read || now - Date.parse(prev.at) < 15 * 60e3)) continue;
      // v3.42 (Ifoma, 20 Oct night: "10-minute close only"): Josh trades the 10-minute candle (House Rule 2) and was rejecting
      // correct 5-minute cards as "still forming" (4 rejected winners on 20 Oct). Cards fire on the 10-minute close only; the
      // 5-minute bars still feed the last-price line and the chop count. No 10-minute bars = no card (never a silent 5-minute fallback).
      const hit = WATCH_TF === 10
        ? evalLevel(Number(r.level), d, b10[r.ticker] || [], 10, { now, earliestMin: earliest })
        : (evalLevel(Number(r.level), d, bars5, 5, { now, earliestMin: earliest }) || evalLevel(Number(r.level), d, b10[r.ticker] || [], 10, { now, earliestMin: earliest }));
      if (!hit) continue;
      const fire = { at: new Date(now).toISOString(), trigger: hit.trigger, tf: hit.tf, bar: hit.bar, close_at: hit.close_at,
        crossings: crossings(Number(r.level), completedBars(bars5, 5, now)) };
      // Claim it atomically: only one run can set fired.<d>.
      const cond = prev ? `fired->${d}->>at=eq.${encodeURIComponent(prev.at)}` : `fired->>${d}=is.null`;
      const claimed = await db(`otto_watch?id=eq.${r.id}&${cond}&select=*`, { method: "PATCH",
        body: JSON.stringify({ fired: { ...(r.fired || {}), [d]: { ...fire, ...(prev ? { passed: [...(prev.passed || []), { at: prev.at, trigger: prev.trigger }] } : {}) } } }) }).catch(() => []);
      if (!claimed?.length) continue;
      r.fired = claimed[0].fired;
      hits.push({ r, d, fire });
    }
    if (last) await db("otto_watch?id=eq." + r.id, { method: "PATCH", headers: { prefer: "return=minimal" },
      body: JSON.stringify({ last: { price: last.c, at: new Date(last.t + 5 * 60e3).toISOString(), dist: +(last.c - Number(r.level)).toFixed(2) } }) }).catch(() => {});
  }
  for (const h of hits) {
    const b = h.fire.bar, side = h.d === "up" ? "calls side ▲" : "puts side ▼";
    await logDesk("assistant", "👁 Watcher", `${h.r.ticker} ${Number(h.r.level)} — ${TRIG_LABEL[h.fire.trigger]} (${side}) on the ${h.fire.tf}-minute bar that closed at ${etLabel(h.fire.close_at)} ET: ` +
      `O ${b.o.toFixed(2)} H ${b.h.toFixed(2)} L ${b.l.toFixed(2)} C ${b.c.toFixed(2)}.` +
      (h.fire.crossings >= 4 ? ` ⚠ It has crossed this level ${h.fire.crossings} times today (chop).` : "") + " Asking Jarvis for a card…");
    if (!(await kick("watch_jarvis", { id: h.r.id, d: h.d }))) background(watchJarvis(h.r.id, h.d));
  }
  return { ok: true, levels: rows.length, hits: hits.map((h) => `${h.r.ticker} ${h.r.level} ${h.d} ${h.fire.trigger}`) };
}

const SETUP_FOR: Record<string, string> = { "break|up": "breakout", "break|down": "breakdown", "pullback-hold|up": "support bounce", "rejection|down": "rejection at resistance" };
export async function watchJarvis(id: number, d: "up" | "down") {
  const r = (await db(`otto_watch?select=*&id=eq.${id}`))?.[0];
  const f = r?.fired?.[d];
  if (!r || !f || f.read) return { ok: true, skipped: true };
  const { cs, sys, tools, ctxLine } = await deskSetup();
  const runTools = tools.filter((t: any) => t.name !== "close_position" && !/^tv__/.test(String(t.name || "")));
  const b = f.bar;
  // v3.20: the server fetches the contracts first, so Jarvis doesn't spend his steps paging the chain.
  const pre = await withTimeout(shortlistCached(r.ticker, d === "up" ? "call" : "put"), 25_000, "shortlist")
    .then((x) => x.text, (e) => `(${r.ticker} contracts couldn't be pre-fetched: ${String((e as Error).message).slice(0, 100)} — call option_shortlist.)`);
  const prompt = `${ctxLine}
${pre}
[👁 WATCHER TRIGGER — no one typed this; Ifoma and Josh are away from the screen.]
${r.ticker} level ${Number(r.level)} (${r.source === "signal" ? "a Signal level" : r.source === "scanner" ? "a level the scanner found" : "a level added on the Desk"}${r.note ? ": " + r.note : ""}).${r.source === "signal" ? (r.coach_dir ? ` The coach's direction: ${String(r.coach_dir).toUpperCase()}.` : " The coach gave this level with NO direction — the side comes from this close. Check it's with the day's move and the banner before you card it.") : ""}
Trigger: ${TRIG_LABEL[f.trigger]} on the ${d === "up" ? "calls" : "puts"} side, on the ${f.tf}-minute bar that closed at ${etLabel(f.close_at)} ET — O ${b.o} H ${b.h} L ${b.l} C ${b.c}.${f.crossings >= 4 ? ` The 5-minute closes have crossed this level ${f.crossings} times today: treat it as chop unless the read is clear.` : ""}
${r.note && String(r.note).startsWith("🎧 Coach") ? `This level came from the coach's live call. START the card's summary with exactly this line: ${r.note}\n` : ""}Is this a real ${d === "up" ? "call" : "put"} setup RIGHT NOW under the Otto Rules and the House Rules? The contract list above is live (server-fetched); check the banner and any binary event.
- Call propose_action ONCE, every time (v3.36, Ifoma: flag, never block — the people decide, not you): one opening option card. Title starts with "SCALP · " when it's a quick trade. plan.setup "${SETUP_FOR[f.trigger + "|" + d] || "other"}", plan.direction "${d}", plan.signal_level ${r.source === "signal"}, TP1 at the next level, plan.stop (wrong-if) just beyond ${Number(r.level)}, stop_option sized for their max loss. If the best contract is over buying power or the max, make the cheaper ALT too, as usual. Guardrails flag, never block.
- plan.weak (v4.2.3, tightened): set it ONLY if the banner/read is No Edge or Choppy, or the confirmation bar already ran well past the level (a chase) — one plain sentence naming which. Thin room to TP1, a binary event or ordinary doubt go in the summary, not in weak; most cards leave weak EMPTY. When the bar already ran: say so, and say the coach's answer: wait for the retest of ${Number(r.level)} that holds; that is the entry, not the chase. The card is still built either way — flag, never block.
- The only time there is no card: the level's direction contradicts the close (e.g. a rejection fired but the close is on the wrong side). Then say exactly why in the READ.
Work quietly. Finish with a line that is exactly READ: and then 2 short plain sentences: what happened at the level and why you made the card — or why not.
(Robinhood tools only in this run.)`;
  let res = { said: "", cards: [] as string[] }, err = "";
  try {
    res = await runDesk({ msgs: [{ role: "user", content: prompt }], sys, tools: runTools, cs, who: "watcher", send: () => {},
      allowPropose: true, allowClose: false, maxRounds: 8, planExtra: { source: r.source === "signal" ? "signal" : r.source, trigger: f.trigger, watch_id: r.id, level: Number(r.level) } });
  } catch (e) { err = String((e as Error).message || e).slice(0, 200); }
  const raw = res.said.trim(), cut = raw.lastIndexOf("READ:");
  const read = (cut >= 0 ? raw.slice(cut + 5) : raw).trim();
  const acts = res.cards.length ? await db("otto_actions?select=id,title,status&id=in.(" + res.cards.join(",") + ")").catch(() => []) : [];
  await db("otto_watch?id=eq." + r.id, { method: "PATCH", headers: { prefer: "return=minimal" },
    body: JSON.stringify({ fired: { ...(r.fired || {}), [d]: { ...f, read: read || err || "no read", cards: res.cards, error: err || null } } }) }).catch(() => {});
  await logDesk("assistant", "Jarvis · watcher", `For: 👁 ${r.ticker} ${Number(r.level)} ${d === "up" ? "▲" : "▼"} ${TRIG_LABEL[f.trigger]}\n` +
    (err ? `No card — Jarvis hit an error checking it: ${err}` : statusWords(read || (acts.length ? "Card's up." : "No setup — no card."), acts)), acts[0]?.id || null);
  if (acts.length && acts.some((a: any) => a.status !== "paper")) {
    await markPinged(acts.map((a: any) => a.id));
    await notify("card", `🃏 ${r.ticker} card ready — ${TRIG_LABEL[f.trigger]} at ${Number(r.level)}`,
      `${String(acts[0].title || "").slice(0, 90)}. Tap to Approve or Reject (expires in 20 min).`, "./#desk");
  }
  return { ok: true, cards: acts.length };
}

/* ------------------------------------------------------------ 9:20 scanner (SPY, QQQ, Mag-7) */
export async function watchScan(by = "scanner 9:20") {
  const { cs, sys, tools, ctxLine } = await deskSetup();
  const runTools = [...tools.filter((t: any) => t.name !== "close_position" && t.name !== "propose_action" && !/^tv__/.test(String(t.name || ""))), WATCH_TOOL];
  const prompt = `${ctxLine}
[🔎 Scanner — no one typed this.] Look at ${WATCH_SCAN.join(", ")}: yesterday's high/low/close, today's pre-market or intraday price (Robinhood quotes and 5-minute / daily bars), and the Otto Rules levels from the calls. Pick the 2–4 price levels most worth watching TODAY — a level price is likely to test, where a break, a pullback-hold or a rejection would be a real setup. For each, call add_watch_level once (dir up, down or both; note = one short reason). Skip levels already very far from price (over ~1.5%). No cards. Finish with one line: READ: which levels and why, in one sentence.
(Robinhood tools only.)`;
  const res = await runDesk({ msgs: [{ role: "user", content: prompt }], sys, tools: runTools, cs, who: "scanner", send: () => {},
    allowPropose: false, allowClose: false, maxRounds: 8 });
  const raw = res.said.trim(), cut = raw.lastIndexOf("READ:");
  const read = (cut >= 0 ? raw.slice(cut + 5) : raw).trim();
  const props = (await watchRows(watchDay(), "proposed")).filter((r: any) => r.source === "scanner");
  await logDesk("assistant", "Jarvis · scanner", `🔎 ${props.length ? `${props.length} level${props.length === 1 ? "" : "s"} proposed for the Watcher (tap Add in the 👁 Watcher panel): ` +
    props.map((r: any) => `${r.ticker} ${Number(r.level)}${r.dir === "up" ? " ▲" : r.dir === "down" ? " ▼" : " ▲▼"}`).join(", ") + "." : "No levels worth watching right now."}${read ? "\n" + read : ""}`);
  await putSetting("watch_scan_day", { day: marketClock().date, by }).catch(() => {});
  return { ok: true, proposed: props.length };
}

/* ------------------------------------------------------------ panel + edits */
export async function watchGet() {
  const day = watchDay();
  const rows = await db(`otto_watch?select=*&day=eq.${day}&status=neq.removed&order=created_at.asc&limit=200`).catch(() => []);
  // v3.18: pending ⏰ check-ins show as chips under the levels
  const checks = await db(`otto_checks?select=id,due_at,what,by&status=eq.pending&day=eq.${etParts().date}&order=due_at.asc&limit=10`).catch(() => []);
  const plans = await plansToday().catch(() => []);   // v3.19: pinned on the Desk
  const homework = await hkStatus().catch(() => null);   // v3.45: the Desk banner + the card tag read this
  return { ok: true, day, clock: marketClock().status, rows, plans, homework, checks: (checks || []).map((c: any) => ({ ...c, label: fmtMin(etParts(new Date(c.due_at)).min) })) };
}

/* ------------------------------------------------------------ v4.5: this week's callouts (Desk post + one-tap Arm) ------------------------------------------------------------
   Ifoma 26 Oct: when the Monday call is seeded, post the levels on the Desk and let one tap put them on the Watcher. */
export function newestCall(calls: any[]): any | null {
  const rows = (Array.isArray(calls) ? calls : []).filter((c) => c?.call?.date).sort((a, b) => String(b.call.date).localeCompare(String(a.call.date)));
  return rows[0] || null;
}
// "needs a move above 920" → up; "below 880 negates" / "lose it" → down; support / resistance / anything else → both. Not a stock (US 10Y) → null.
export function calloutLevels(call: any): { ticker: string; level: number; dir: string; meaning: string }[] {
  const out: { ticker: string; level: number; dir: string; meaning: string }[] = [];
  for (const l of Array.isArray(call?.levels) ? call.levels : []) {
    const ticker = String(l?.instrument || "").trim().toUpperCase();
    const level = Number(String(l?.value || "").replace(/[^0-9.]/g, ""));
    if (!/^[A-Z]{1,5}$/.test(ticker) || !(level > 0)) continue;
    const m = String(l?.meaning || "");
    const dir = /\b(?:support|resistance|order block|gap support)\b/i.test(m) ? "both"
      : /\b(?:below|lose[sd]?|lost|negat)/i.test(m) && !/\b(?:above|reclaim)/i.test(m) ? "down"
      : /\b(?:above|reclaim|flip zone long|back above|target)/i.test(m) ? "up" : "both";
    if (!out.some((o) => o.ticker === ticker && o.level === level)) out.push({ ticker, level, dir, meaning: m });
  }
  return out;
}
export function calloutsText(call: any): string {
  const lv = calloutLevels(call);
  if (!lv.length) return "";
  const by: Record<string, string[]> = {};
  for (const l of lv) (by[l.ticker] = by[l.ticker] || []).push(`${l.level}${l.dir === "up" ? " ▲" : l.dir === "down" ? " ▼" : ""} ${l.meaning.split(/[;—]/)[0].replace(/\s+/g, " ").trim().slice(0, 48)}`);
  return `📣 This week's callouts — ${String(call?.call?.title || "coach call").slice(0, 80)} (${call.call.date})\n` +
    Object.entries(by).map(([t, a]) => `${t}: ${a.join(" · ")}`).join("\n") +
    `\n${lv.length} levels. Tap the button to put them on today's Watcher (▲ = watch for a break up, ▼ = watch for a break down, none = either way).`;
}
export async function postCallouts(payload: any[]) {
  const call = newestCall(payload); const text = call ? calloutsText(call) : "";
  if (!text) return false;
  await logDesk("system", "Otto", text);
  return true;
}
export async function armCallouts(who: string) {
  const call = newestCall(await loadBrain());
  const lv = call ? calloutLevels(call) : [];
  if (!lv.length) throw new Error("No callouts found in the newest call.");
  const by = `${String(who).slice(0, 30)} · Callouts`;
  let armed = 0, skipped = 0; const why: string[] = [];
  for (const l of lv) {
    try {
      const r = await watchAdd({ ticker: l.ticker, level: l.level, dir: l.dir, source: "desk", note: l.meaning.slice(0, 160), by });
      if (r && r.status !== "removed") armed++; else skipped++;
    } catch (e) { skipped++; why.push(`${l.ticker} ${l.level}: ${String((e as Error).message).slice(0, 60)}`); }
  }
  await logDesk("system", "Otto", `👁 ${who} armed ${armed} of ${lv.length} callouts from ${call.call.date} on the Watcher${skipped ? ` (${skipped} skipped — too far from the live price, already there, or not a stock)` : ""}.`);
  return { ok: true, armed, skipped, total: lv.length, why: why.slice(0, 6) };
}
/* ------------------------------------------------------------ v4.6: EARS — the live call listener ------------------------------------------------------------
   Ifoma 26 Oct: the coach says levels out loud; they reached Otto after the bounce (PLTR). The Chrome extension records ONE tab's audio in
   ~60 s pieces and posts each to ?fn=ears (the watcher's pairing key). Each piece: Whisper (OpenAI) → text → Claude pulls the levels the coach
   SAID → new ones go on the Desk as a DRAFT (one tap arms them) or, in Automatic mode, onto the Watcher at once. Mode = otto_settings.ears_mode.
   State (levels, transcript) lives in otto_settings.ears_state — no table. Secret: OPENAI_KEY (Supabase). */
const EARS_VOCAB = "Trading call. Tickers and levels: SPY, QQQ, IWM, NVDA, AMD, TSLA, AAPL, MSFT, AMZN, META, GOOGL, PLTR, MU, AVGO, INTC, SMCI, COIN, CRWV, 10-year yield. Prices like 217.5, 778.60, 920. Words: reclaim, support, resistance, order block, gap fill, wrong if, break above, break below.";
const EARS_TOOL = { name: "record_levels", description: "Record price levels the speaker SAID out loud in the NEWEST part of the call.",
  input_schema: { type: "object", properties: { levels: { type: "array", items: { type: "object", properties: {
    instrument: { type: "string", description: "Stock ticker only (e.g. PLTR). Skip indexes futures and yields." },
    value: { type: "string", description: "The number he said, e.g. 171.5" },
    meaning: { type: "string", description: "What he said about it, in his words, max 14 words (above/reclaim/support/resistance/below/lose...)" },
    kind: { type: "string", enum: ["level", "range", "price"], description: "level = a trigger with a job (above/below/hold/reclaim/target/support/resistance). range = a weekly top/bottom or consolidation edge, context only. price = where the stock is right now, no job." } },
    required: ["instrument", "value", "meaning"] } } }, required: ["levels"] } };
export type EarsLevel = { id: number; ticker: string; level: number; dir: string; meaning: string; min: number; status: "draft" | "armed" | "dismissed" | "skipped"; kind?: string; hold?: string; why?: string; said?: string };
export type EarsState = { session: string; started: string; last: string; chunks: number; seqs: number[]; levels: EarsLevel[]; transcript: string; ended?: string | null; n?: number; unsure?: string[]; unsure_items?: { instrument: string; value: string; meaning: string; min: number }[]; handled_at?: string };
export async function earsMode(): Promise<"draft" | "auto"> { return (await setting("ears_mode").catch(() => null)) === "draft" ? "draft" : "auto"; }   // v5.1: Automatic unless he switched it to Draft
/* v5.1: what kind of thing was said. A level needs a job; weekly tops/bottoms are context; "where it is now" is not a trigger. Only ever HOLDS BACK (the model's own tag is a second opinion). */
const EARS_JOB = /\b(above|below|over|under|holds?|reclaims?|targets?|support|resistance|breaks?|lose[sd]?|lost|rejects?|gap|flip|takes? out|needs? to|must|wrong if)\b/i;
const EARS_RANGE = /\b(range|weekly (top|bottom|high|low)|consolidation)\b/i;
const EARS_PRICE = /\b(current(ly)? price|trading (right )?(at|around)|chopping around|right now|hit \d|at \d+ bucks|this morning)\b/i;
export function earsKind(meaning: string, llm?: string): "level" | "range" | "price" {
  const m = String(meaning || "");
  if (EARS_RANGE.test(m) && !/\bif (it )?(breaks?|takes? out|loses?)\b/i.test(m)) return "range";
  if (EARS_PRICE.test(m) && !EARS_JOB.test(m.replace(EARS_PRICE, " "))) return "price";
  return llm === "range" || llm === "price" ? llm : "level";
}
const earsHoldWhy = (k: string) => k === "range" ? "range — context, not a trigger (tap Arm to watch it anyway)" : k === "price" ? "where it is now, no job given (tap Arm to watch it anyway)" : "";
const earsDec = (n: number) => (String(n).split(".")[1] || "").length;
const earsSaid = (text: string, value: string) => { const raw = String(value).replace(/[^0-9.]/g, ""); const sent = raw ? String(text).split(/(?<=[.!?])\s+/).find((x) => x.includes(raw)) : ""; return String(sent || text).slice(0, 220); };
/* v4.8: the tail of the previous piece rides along — as Whisper's prompt (continuity across the 60 s cut) and inside the extractor's NEWEST text
   (a list like "INTC 92, 90, 87, 95" that straddles a cut was lost on 26 Oct: 10 levels missed, mostly fast lists). Dedupe by ticker+level keeps repeats out. */
export function earsTail(transcript: string, n = 400): string {
  const s = String(transcript || "").replace(/\[\d+m\]\s*/g, " ").replace(/\s+/g, " ").trim();
  if (!s) return "";
  const t = s.slice(-n);
  const i = t.indexOf(" ");
  return i > 0 && t.length === n ? t.slice(i + 1) : t;      // start on a whole word
}
async function earsTranscribe(audioB64: string, mime: string, known: string[] = [], tail = ""): Promise<string> {
  const T = (globalThis as any).__OTTO_TEST__;
  if (T?.transcribe) return T.transcribe(audioB64, mime, tail);
  const key = Deno.env.get("OPENAI_KEY") || "";
  if (!key) throw new Error("OPENAI_KEY is not set in Supabase (Edge Functions → Secrets)");
  const bin = Uint8Array.from(atob(audioB64), (c) => c.charCodeAt(0));
  const fd = new FormData();
  fd.append("file", new Blob([bin], { type: mime || "audio/webm" }), "chunk." + (/mp4|m4a/.test(mime) ? "m4a" : "webm"));
  fd.append("model", "whisper-1"); fd.append("language", "en"); fd.append("response_format", "text"); fd.append("prompt", ((known.length ? "Tickers: " + known.slice(0, 60).join(", ") + ". " : "") + EARS_VOCAB + (tail ? " " + tail.slice(-200) : "")).slice(0, 900));
  const r = await fetch("https://api.openai.com/v1/audio/transcriptions", { method: "POST", headers: { authorization: "Bearer " + key }, body: fd, signal: AbortSignal.timeout(45_000) });
  if (!r.ok) throw new Error("transcription failed: OpenAI HTTP " + r.status + " " + (await r.text()).slice(0, 160));
  return (await r.text()).trim();
}
/* Whisper invents text on silence ("Thank you for watching"); drop those and anything too short to hold a level. */
export function earsClean(t: string): string {
  const s = String(t || "").replace(/\s+/g, " ").trim();
  if (s.length < 12 || /^(thanks? for watching|thank you\.?|you|bye\.?)$/i.test(s)) return "";
  return s;
}
async function earsExtract(newText: string, context: string, known: string[] = []): Promise<{ instrument: string; value: string; meaning: string }[]> {
  const T = (globalThis as any).__OTTO_TEST__;
  if (T?.earsExtract) return T.earsExtract(newText, context, known);
  const apiKey = Deno.env.get("ANTHROPIC_KEY") || "";
  const r = await aiFetch("ears", { method: "POST", signal: AbortSignal.timeout(40_000),
    headers: { "content-type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model: MODEL, max_tokens: 1500, tools: [EARS_TOOL], tool_choice: { type: "tool", name: "record_levels" },
      system: `You listen to a live trading call transcribed from speech (it can mishear words and tickers). Record ONLY price levels for a specific stock that the speaker clearly SAID in the NEWEST text: the stock must be named in the same sentence or the one before (a company name counts: Micron = MU, SK Hynix = SKHY), and the number must be given as support, resistance, a reclaim, a break, a target, a gap, a moving average or the line that negates the idea. Prefer these names when the speech is close to one of them: ${known.slice(0, 80).join(", ")}. Never invent or round a number, never attach a number to a stock he did not name, never record a number that is a time, a percentage, an option price, a dollar P&L or an account size, skip index futures and yields. A stray number with no clear stock is NOT a level. If unsure, leave it out. Return an empty list when there are none. A level needs a JOB (above / below / hold / reclaim / target / support / resistance): where the stock is trading right now is NOT a level (kind "price"), and weekly tops and bottoms or consolidation edges are context (kind "range"); everything else is kind "level".`,
      messages: [{ role: "user", content: `EARLIER (context only, do not record):\n${context.slice(-3000) || "(start of call)"}\n\nNEWEST:\n${newText.slice(0, 6000)}` }] }) });
  if (!r.ok) throw new Error("reading the call failed: claude HTTP " + r.status);
  const j = await r.json(); const tu = (j.content || []).find((b: any) => b.type === "tool_use");
  return Array.isArray(tu?.input?.levels) ? tu.input.levels : [];
}
/* v4.7: the names the extractor may use. Spoken tickers get mangled ("Micron" → CRWD, "SK Hynix" → SK on 26 Oct), so every level is snapped
   to a KNOWN name: this week's call, today's Watcher, and a big-cap list that covers Winston's universe (otto-proxy never reads Winston's tables). Anything else goes in the post as "unsure", never armed. */
const EARS_ALIASES: Record<string, string> = { MICRON: "MU", "SK": "SKHY", "SKHYNIX": "SKHY", HYNIX: "SKHY", NVIDIA: "NVDA", APPLE: "AAPL", AMAZON: "AMZN", TESLA: "TSLA", MICROSOFT: "MSFT", GOOGLE: "GOOGL", ALPHABET: "GOOGL", META: "META", FACEBOOK: "META", PALANTIR: "PLTR", INTEL: "INTC", BROADCOM: "AVGO", NETFLIX: "NFLX", COINBASE: "COIN", COREWEAVE: "CRWV", VERIZON: "VZ", EXXON: "XOM", FREEPORT: "FCX", MARVELL: "MRVL", "SUPERMICRO": "SMCI", SPY: "SPY", SPX: "SPY", "S&P": "SPY", NASDAQ: "QQQ", QQQ: "QQQ", RUSSELL: "IWM", NORTHROP: "NOC", "PALOALTO": "PANW", "TEXASINSTRUMENTS": "TXN", "DOLLARTREE": "DLTR" };
const EARS_BASE = ["SPY", "QQQ", "IWM", "NVDA", "AMD", "TSLA", "AAPL", "MSFT", "AMZN", "META", "GOOGL", "PLTR", "MU", "AVGO", "INTC", "SMCI", "COIN", "CRWV", "NFLX", "MRVL", "XOM", "FCX", "VZ", "SKHY", "NOC", "PANW", "TXN", "DLTR", "MSTR", "HOOD", "UBER", "BA", "JPM", "GS", "CRM", "ORCL", "AMGN", "ULTA", "DIS", "NKE", "SBUX", "CAT", "LLY", "CVX", "NOW"];
export async function earsKnownTickers(): Promise<string[]> {
  const set = new Set<string>(EARS_BASE);
  try { const call = newestCall(await loadBrain()); for (const l of calloutLevels(call)) set.add(l.ticker); } catch { /* no brain */ }
  try { for (const w of (await db(`otto_watch?day=eq.${watchDay()}&select=ticker`).catch(() => [])) || []) set.add(String(w.ticker).toUpperCase()); } catch { /* none */ }
  return [...set].filter((t) => /^[A-Z.]{1,6}$/.test(t));
}
export function earsSnap(instrument: string, known: string[]): string | null {
  const spoken = String(instrument || "").toUpperCase().trim();
  if (/\d/.test(spoken)) return null;                                              // "US 10Y", "10-year" — never a stock
  const raw = spoken.replace(/[^A-Z&]/g, "");
  if (!raw) return null;
  if (EARS_ALIASES[raw]) return EARS_ALIASES[raw];
  if (known.includes(raw)) return raw;
  return null;   // no fuzzy guessing: CRWD and CRWV are both real stocks one letter apart — a wrong snap is worse than an "unsure" line
}
const earsLine = (l: { ticker: string; level: number; dir: string; meaning: string }) => `${l.ticker} ${l.level}${l.dir === "up" ? " ▲" : l.dir === "down" ? " ▼" : ""} — "${String(l.meaning).replace(/"/g, "'").slice(0, 70)}"`;
async function earsArmOne(l: EarsLevel, by: string): Promise<string> {   // "" = armed, otherwise the reason it was not
  try { const r = await watchAdd({ ticker: l.ticker, level: l.level, dir: l.dir, source: "desk", note: `🎧 Coach, call min ${Number(l.min) || 0}: "${String(l.meaning).replace(/"/g, "'")}"`.slice(0, 160), by }); return r && r.status !== "removed" ? "" : r ? "became the wrong-if of an open trade" : "already on the Watcher"; }
  catch (e) { return String((e as Error).message || "could not arm").slice(0, 90); }
}
/* v5.2: the one-screen recap Josh reads at the end of a call — by stock, what the coach said about each level. */
const earsTag = (m: string) => /reclaim|recover/i.test(m) ? " reclaim" : /resistance/i.test(m) ? " resistance" : /support/i.test(m) ? " support" : /\bputs?\b/i.test(m) ? " → puts" : /\bcalls?\b/i.test(m) ? " → calls" : /target/i.test(m) ? " target" : "";
export function earsRecap(st: EarsState, mins: number): string {
  const lv = (st.levels || []).filter((l) => l.status !== "dismissed");
  if (!lv.length) return "";
  const live = lv.filter((l) => l.status === "armed" || (l.status === "draft" && !l.hold));
  const by: Record<string, EarsLevel[]> = {}; for (const l of live) (by[l.ticker] = by[l.ticker] || []).push(l);
  const hm = (d: string) => new Date(d).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/New_York", hour12: false });
  const tickers = Object.keys(by).sort((a, b) => by[b].length - by[a].length || a.localeCompare(b));
  const out = [`🎧 Call recap · ${hm(st.started)}–${hm(st.ended || st.last || st.started)} · ${lv.length} level${lv.length === 1 ? "" : "s"}, ${new Set(lv.map((l) => l.ticker)).size} stock${new Set(lv.map((l) => l.ticker)).size === 1 ? "" : "s"} (${mins} min)`];
  for (const t of tickers) out.push(`${t.padEnd(5)}${by[t].slice().sort((a, b) => b.level - a.level).map((l) => `${l.level}${earsTag(l.meaning)}`).join(" · ")}`);
  const held = lv.filter((l) => l.status === "draft" && l.hold);
  if (held.length) out.push("Held back: " + held.map((l) => `${l.ticker} ${l.level} (${l.kind === "range" ? "range" : "current price"})`).join(" · "));
  const sk = lv.filter((l) => l.status === "skipped");
  if (sk.length) out.push("Not armed: " + sk.map((l) => `${l.ticker} ${l.level} (${String(l.why || "skipped").slice(0, 40)})`).join(" · "));
  return out.join("\n");
}
export async function earsIn(body: any) {
  const kind = String(body?.kind || "");
  const session = String(body?.session || "").replace(/[^A-Za-z0-9_-]/g, "").slice(0, 40);
  if (!session) throw new Error("need a session id");
  let st: EarsState | null = await setting("ears_state").catch(() => null);
  if (!st || st.session !== session) st = { session, started: new Date().toISOString(), last: "", chunks: 0, seqs: [], levels: [], transcript: "", ended: null, n: 0 };
  if (kind === "start") { await putSetting("ears_state", st, "ears"); return { ok: true, mode: await earsMode() }; }
  if (kind === "stop") {
    if (st.ended) return { ok: true, ended: true };
    st.ended = new Date().toISOString();
    const c = (s: string) => st!.levels.filter((l) => l.status === s).length;
    await putSetting("ears_state", st, "ears");
    const mins = Math.max(1, Math.round((Date.parse(st.ended) - Date.parse(st.started)) / 60000));
    const line = `${st.levels.length} level${st.levels.length === 1 ? "" : "s"} heard — ${c("armed")} armed, ${c("draft")} waiting for Arm, ${c("dismissed")} dismissed, ${c("skipped")} skipped`;
    if (st.levels.length || st.chunks) await logDesk("system", "Otto", `🎧 Ears: listening ended after ${mins} minute${mins === 1 ? "" : "s"}. ${line}${c("skipped") ? " (too far from the price or not a stock)" : ""}.`);
    const recap = earsRecap(st, mins); if (recap) await logDesk("system", "Otto", recap);
    if (c("draft")) await notify("ears", `🎧 Ears: ${c("draft")} level${c("draft") === 1 ? "" : "s"} waiting for your Arm`, line, "./#desk").catch(() => {});
    return { ok: true, ended: true, levels: st.levels.length, armed: c("armed"), waiting: c("draft"), dismissed: c("dismissed"), skipped: c("skipped"), minutes: mins };
  }
  if (kind !== "chunk") throw new Error("unknown ears kind");
  const seq = Number(body.seq) || 0;
  if (st.seqs.includes(seq)) return { ok: true, dup: true, levels: st.levels.length, mode: await earsMode() };   // a retry after a dropped reply
  const audio = String(body.audio || "");
  if (audio.length < 200 || audio.length > 6_000_000) throw new Error("bad audio size");
  const known = await earsKnownTickers().catch(() => [] as string[]);
  const tail = earsTail(st.transcript);
  const text = earsClean(await earsTranscribe(audio, String(body.mime || "audio/webm"), known, tail));
  const tmin = Math.max(0, Number(body.min) || st.chunks);
  st.chunks++; st.seqs = st.seqs.concat(seq).slice(-300); st.last = new Date().toISOString();
  let found: { instrument: string; value: string; meaning: string }[] = [];
  if (text) {
    const newest = tail ? `(…${tail}) ${text}` : text;        // v4.8: the cut-off end of the last piece is part of "newest" so a straddling level is caught
    found = await earsExtract(newest, st.transcript.slice(0, Math.max(0, st.transcript.length - tail.length)), known).catch((e) => { console.error("ears extract", e); return []; });
    st.transcript = (st.transcript + `\n[${tmin}m] ${text}`).slice(-90_000);
  }
  const fresh: EarsLevel[] = []; const unsure: string[] = [];
  const snapped = found.map((f) => { const t = earsSnap(f.instrument, known); if (!t) unsure.push(`${String(f.instrument).slice(0, 12)} ${String(f.value).slice(0, 10)}`); return t ? { ...f, instrument: t } : null; }).filter(Boolean);
  for (const l of calloutLevels({ levels: snapped })) {
    // v5.1: same ticker within 0.2% of a level already heard = the same level (keep the first meaning, and the more precise number while it is still only a draft)
    const near = st.levels.find((x) => x.ticker === l.ticker && Math.abs(x.level - l.level) / x.level <= 0.002);
    if (near) { if (near.status === "draft" && earsDec(l.level) > earsDec(near.level)) near.level = l.level; continue; }
    const src: any = (snapped as any[]).find((f) => f && String(f.instrument) === l.ticker && Number(String(f.value || "").replace(/[^0-9.]/g, "")) === l.level);
    const kind = earsKind(l.meaning, src?.kind);
    const n = (st.n = (st.n || 0) + 1);
    const lv: EarsLevel = { id: n, ticker: l.ticker, level: l.level, dir: l.dir, meaning: l.meaning, min: tmin, status: "draft", kind, said: earsSaid(text, src?.value ?? String(l.level)) };
    if (kind !== "level") lv.hold = earsHoldWhy(kind);
    st.levels.push(lv); fresh.push(lv);
  }
  const mode = await earsMode();
  if (fresh.length && mode === "auto") for (const l of fresh) { if (l.hold) continue; const why = await earsArmOne(l, "Ears · Callouts"); l.status = why ? "skipped" : "armed"; if (why) l.why = why; }   // v5.1: Automatic holds range / current-price ones back as drafts
  if (unsure.length) st.unsure_items = (st.unsure_items || []).concat(found.filter((f) => !earsSnap(f.instrument, known)).map((f) => ({ instrument: String(f.instrument).slice(0, 12), value: String(f.value).slice(0, 10), meaning: String(f.meaning).slice(0, 80), min: tmin }))).filter((u, i, a) => a.findIndex((v) => v.instrument === u.instrument && v.value === u.value) === i).slice(-60);
  st.unsure = [...new Set((st.unsure || []).concat(unsure))].slice(-40);
  await putSetting("ears_state", st, "ears");
  if (fresh.length) {
    await logDesk("system", "Otto", `🎧 Ears heard ${fresh.length} new level${fresh.length === 1 ? "" : "s"} · ${mode === "auto" ? "AUTO-ARMED" : "DRAFT"} · call minute ${tmin}\n` + fresh.map(earsLine).join("\n") +
      (unsure.length ? `\nUnsure (no known stock behind the number, not armed): ${unsure.join(", ")}` : "") +
      (fresh.some((l) => l.hold) ? `\nHeld back as drafts (range / current price): ${fresh.filter((l) => l.hold).map((l) => l.ticker + " " + l.level).join(", ")}` : "") +
      (mode === "auto" ? `\nArmed on the Watcher at once (${fresh.filter((l) => l.status === "armed").length} of ${fresh.length}). Heard by voice, so a number can be wrong.`
        : `\nHeard by voice, so a number can be misheard. Check them, then tap.`));
    await notify("ears", `🎧 Ears heard ${fresh.length} level${fresh.length === 1 ? "" : "s"}${mode === "auto" ? " · armed" : " · tap Arm on the Desk"}`, fresh.map((l) => `${l.ticker} ${l.level}`).join(", ").slice(0, 120), "./#desk").catch(() => {});
  }
  return { ok: true, heard: text.length, new: fresh.length, unsure: unsure.length, levels: st.levels.length, waiting: st.levels.filter((l) => l.status === "draft").length, mode };
}
const earsIds = (ids?: any): number[] | null => Array.isArray(ids) ? ids.map(Number).filter((n) => Number.isFinite(n)) : null;   // v5.1: no ids = all drafts (old behaviour); ids = only those
export async function earsArm(who: string, ids?: any) {
  const st: EarsState | null = await setting("ears_state").catch(() => null);
  const pick = earsIds(ids);
  const drafts = (st?.levels || []).filter((l) => l.status === "draft" && (!pick || pick.includes(l.id)));
  if (!st || !drafts.length) return { ok: true, armed: 0, skipped: 0, total: 0 };
  let armed = 0, skipped = 0;
  for (const l of drafts) { const why = await earsArmOne(l, `${String(who).slice(0, 30)} · Callouts`); if (!why) { l.status = "armed"; l.hold = undefined; armed++; } else { l.status = "skipped"; l.why = why; skipped++; } }
  if (!st.levels.some((l) => l.status === "draft")) st.handled_at = new Date().toISOString();
  await putSetting("ears_state", st, "ears");
  await logDesk("system", "Otto", `👁 ${who} armed ${armed} of ${drafts.length} Ears levels from today's call on the Watcher${skipped ? ` (${skipped} skipped — too far from the live price, already there, or not a stock)` : ""}.`);
  return { ok: true, armed, skipped, total: drafts.length };
}
export async function earsDismiss(who: string, ids?: any) {
  const st: EarsState | null = await setting("ears_state").catch(() => null);
  const pick = earsIds(ids);
  let n = 0; for (const l of st?.levels || []) if (l.status === "draft" && (!pick || pick.includes(l.id))) { l.status = "dismissed"; n++; }
  if (st && !st.levels.some((l) => l.status === "draft")) st.handled_at = new Date().toISOString();
  if (st && n) { await putSetting("ears_state", st, "ears"); await logDesk("system", "Otto", `🎧 ${who} dismissed ${n} Ears level${n === 1 ? "" : "s"}.`); }
  return { ok: true, dismissed: n };
}
export async function earsRemove(who: string, ticker: string, level: number) {   // Automatic mode: take a misheard level back off
  const st: EarsState | null = await setting("ears_state").catch(() => null);
  const l = st?.levels.find((x) => x.ticker === ticker && x.level === level);
  if (!st || !l) return { ok: true, removed: 0 };
  const rows = await db(`otto_watch?day=eq.${watchDay()}&ticker=eq.${encodeURIComponent(ticker)}&level=eq.${level}&status=eq.watching&select=id`).catch(() => []);
  for (const r of rows || []) await db("otto_watch?id=eq." + r.id, { method: "PATCH", headers: { prefer: "return=minimal" }, body: JSON.stringify({ status: "removed" }) }).catch(() => {});
  l.status = "dismissed"; await putSetting("ears_state", st, "ears");
  await logDesk("system", "Otto", `👁 ${who} removed ${ticker} ${level} (Ears) from the Watcher.`);
  return { ok: true, removed: (rows || []).length };
}
export async function earsFix(who: string, instrument: string, ticker: string) {   // v5.1: "LEN was really ___" — turn the unsure numbers for that spoken name into real levels
  const T = String(ticker || "").toUpperCase().replace(/[^A-Z.]/g, "").slice(0, 6);
  if (!/^[A-Z]{1,5}$/.test(T)) throw new Error("need a ticker, e.g. LEN");
  const inst = String(instrument || "").toUpperCase().trim().slice(0, 12);
  const st: EarsState | null = await setting("ears_state").catch(() => null);
  if (!st) return { ok: true, added: 0 };
  const items = (st.unsure_items || []).filter((u) => String(u.instrument).toUpperCase().trim() === inst);
  let added = 0, armed = 0;
  for (const l of calloutLevels({ levels: items.map((u) => ({ instrument: T, value: u.value, meaning: u.meaning })) })) {
    if (st.levels.some((x) => x.ticker === l.ticker && Math.abs(x.level - l.level) / x.level <= 0.002)) continue;
    const n = (st.n = (st.n || 0) + 1), kind = earsKind(l.meaning);
    const lv: EarsLevel = { id: n, ticker: l.ticker, level: l.level, dir: l.dir, meaning: l.meaning, min: items[0]?.min ?? 0, status: "draft", kind, said: `(was heard as "${inst}")` };
    if (kind !== "level") lv.hold = earsHoldWhy(kind);
    else { const why = await earsArmOne(lv, `${String(who).slice(0, 30)} · Callouts`); lv.status = why ? "skipped" : "armed"; if (why) lv.why = why; else armed++; }
    st.levels.push(lv); added++;
  }
  st.unsure_items = (st.unsure_items || []).filter((u) => String(u.instrument).toUpperCase().trim() !== inst);
  st.unsure = (st.unsure || []).filter((x) => !String(x).toUpperCase().startsWith(inst + " "));
  await putSetting("ears_state", st, "ears");
  await logDesk("system", "Otto", `🎧 ${who}: "${inst}" was ${T} — ${added} level${added === 1 ? "" : "s"} added (${armed} armed).`);
  return { ok: true, added, armed };
}
export async function earsModeSet(m: string, who: string) {
  const v = m === "auto" ? "auto" : "draft"; await putSetting("ears_mode", v, who);
  await logDesk("system", "Otto", `🎧 ${who} set Ears to ${v === "auto" ? "AUTOMATIC (levels go straight onto the Watcher)" : "DRAFT (you tap Arm)"}.`);
  return { ok: true, mode: v };
}

async function watchSet(b: any, who: string) {
  const by = String(b?.author || who.split("@")[0]).slice(0, 40);
  if (b?.add) {
    const r = await watchAdd({ ticker: b.add.ticker, level: b.add.level, dir: b.add.dir, source: "desk", note: b.add.note, by });
    if (r && !r.trade_wrong_if) await logDesk("system", "Otto", `👁 ${by} added ${r.ticker} ${Number(r.level)} ${r.dir === "up" ? "▲" : r.dir === "down" ? "▼" : "▲▼"} to the Watcher.`);
    return { ok: true, row: r };
  }
  const id = Number(b?.id);
  if (!id || !["watching", "removed"].includes(String(b?.status))) throw new Error("need id and status watching|removed");
  const r = (await db(`otto_watch?id=eq.${id}&select=*`, { method: "PATCH", body: JSON.stringify({ status: b.status }) }))?.[0];
  if (r && b.status === "watching") await logDesk("system", "Otto", `👁 ${by} added the scanner's ${r.ticker} ${Number(r.level)} to the Watcher.`);
  return { ok: true, row: r || null };
}

/* ------------------------------------------------------------ Scoreboard (Phase 2) on Robinhood bars
   Every opening card is graded on the underlying from the moment it was made: TP1 touched (win) before a
   close through the wrong-if on the card's own bar (5-min from v3.21, 15-min before) (loss); neither by 3:55 PM ET the same day = flat ("scratch",
   intraday-only House Rule). Dollars are an estimate for 1 contract (move × delta × 100, capped at the
   premium) — real P&L replaces it for cards that were taken. */
export function gradeIdea(o: { created: number; direction: "up" | "down"; tp1: number; wrong: number; entry?: number | null; delta?: number | null; premium?: number | null; tf?: number }, bars5: Bar[], now = Date.now()) {
  const tf = o.tf === 5 ? 5 : 15;               // v3.21: each card is graded on its own wrong-if bar (5-min from v3.21, 15 before)
  const day = etParts(new Date(o.created)).date;
  const endAt = Date.parse(nyIso(day, "3:55 PM") || "") || o.created + 6 * 3600e3;
  const after = bars5.filter((b) => b.t + 5 * 60e3 > o.created && b.t < endAt && b.t + 5 * 60e3 <= now);
  if (!after.length) return { state: now > endAt + 10 * 60e3 ? "unscored" : "open" };
  const entry = Number(o.entry) || after[0].o, up = o.direction === "up";
  const risk = Math.abs(entry - o.wrong) || null;
  const est = (exit: number) => {
    const move = (up ? exit - entry : entry - exit), dl = Math.abs(Number(o.delta) || 0.5);
    let v = move * dl * 100; if (o.premium) v = Math.max(v, -o.premium * 100);
    return Math.round(v);
  };
  const q: Bar[] = [];                         // 5-minute bars of the current 15-minute bucket
  for (const b of after) {
    if (up ? b.h >= o.tp1 : b.l <= o.tp1) return { state: "win", at: b.t, r: risk ? +(Math.abs(o.tp1 - entry) / risk).toFixed(2) : null, pnl_est: est(o.tp1), entry };
    q.push(b);
    const endsBucket = new Date(b.t + 5 * 60e3).getUTCMinutes() % tf === 0;
    if (endsBucket) {
      const close15 = q[q.length - 1].c; q.length = 0;
      if (up ? close15 < o.wrong : close15 > o.wrong) return { state: "loss", at: b.t, r: -1, pnl_est: est(close15), entry };
    }
  }
  if (now >= endAt) { const last = after[after.length - 1].c; return { state: "scratch", at: after[after.length - 1].t, r: risk ? +(((up ? last - entry : entry - last) / risk)).toFixed(2) : null, pnl_est: est(last), entry }; }
  return { state: "open" };
}

function srcOf(a: any) {
  const p = a.plan || {};
  if (p.source) return p.source;
  const w = String(a.created_by || "");
  return w === "signals" ? "signal" : w === "alert" ? "alert" : w === "watcher" ? "watcher" : /@/.test(w) ? "desk" : w || "desk";
}
async function proofStart(): Promise<string> {
  const v = await setting("proof_start").catch(() => null);
  if (v?.day) return v.day;
  const day = isTradingDay(marketClock().date) ? marketClock().date : nextTradingDay(marketClock().date);
  await putSetting("proof_start", { day }, "otto").catch(() => {});
  return day;
}
function tradingDaysBetween(a: string, b: string) { let n = 0; for (let d = a; d <= b; d = addDays(d, 1)) if (isTradingDay(d)) n++; return n; }

/* ------------------------------------------------------------ Help chat
   App questions only, kept off the Desk. No tools, no account access. */
const HELP_SYS = `You are Otto Help, the in-app guide for Otto Trader. You answer questions about HOW THE APP WORKS — what a screen shows, what a button does, how to change a setting, what a term on the screen means. You do not give trading advice or market opinions: if someone asks whether to take a trade, what a stock will do, or anything about live prices or their positions, say in one line that that's a question for Jarvis on the Desk, and stop. Be short and concrete: name the exact screen and button. If you don't know or the app doesn't do something, say so plainly — never invent a feature.

THE APP (Otto Trader, desktop-first; phones get a stacked layout)
- Left rail: Desk, Market, Results, Journal, Review, Score, Calls, Classic (the older phone-style screens), Help, Settings.
- The Desk is locked to the Otto login (one shared login for Ifoma and Josh; they're one team). "At the desk" picker labels who is typing.
- Jarvis = the AI on the Desk. Built on Jason Murray's method (his recorded calls), plus live TradingView data and Robinhood. One shared conversation on every laptop.
- Sentiment banner (top of every Desk screen): Josh's Intermarket Sentiment Cheat Sheet on live TradingView data — 10Y yield, DXY, USD/JPY, crude, ES/NQ/YM futures. Verdicts: Leaning long / Mildly long — small size / No edge / Choppy — stand aside / Mildly short / Leaning short / No read. Chips show which rows of Josh's sheet fired. "Why this verdict?" explains. Refreshes every 5 minutes in market hours. It's Josh's sheet, not Jason's; it never sizes trades. The flag line shows where Josh's sheet and Jason disagree (Jason: don't trade the first 30 minutes).
- Cards: anything that would change something (an order, a cancel, an alert, a watchlist edit) appears as a card with Approve / Reject. Nothing runs until someone clicks Approve and confirms "Place this with real money?". Cards expire after 20 minutes (prices move) — ask again for a fresh one. A card shows: the ticket, max cost and % of the account, Robinhood's own pre-check ("review"), the rule check, and limit checks.
- Rule check: first 30 minutes, delta 0.30–0.40, volume > open interest, % of account vs the warn line, expiry (no this-Friday after Wednesday, no 0DTE), binary events (CPI/NFP/Fed etc.) before expiry, earnings before expiry, and whether it agrees with the banner. ✓ pass, ! flag, ? couldn't check. Flags are warnings; you can still approve.
- Limit checks: most the trade can lose vs "max loss per trade", this week's P&L vs the weekly loss limit, and trade count vs trades per day. Change them in Settings → Limits & goals. Warnings only.
- Order ticket (button next to "+ Chart" on the Desk): Buy to open / Sell to close, ticker, call/put, expiry, strike, contracts, limit price (per share — $2.10 means $210 per contract), setup, optional TP1 and "wrong if" price. It does NOT place the order; it makes a card. After Approve it is sent as a limit order good for the day: it fills only if price reaches the limit, otherwise it expires at the close. Robinhood may also ask for a confirm in its own app.
- Robinhood: two accounts. Individual (read-only to Otto: positions, history, P&L). Agentic (the only one Otto can trade in, only after Approve). Otto can't move or withdraw money. Options level 2: long calls/puts, covered calls, cash-secured puts; no spreads.
- TradingView alerts: during market hours Otto checks the alert log every 2 minutes; a fired alert posts to the Desk with a short read from Jarvis (in-app, not a phone push). Jarvis can't draw on TradingView charts.
- Calls page: every processed call with Jason (homework, rules, setups, insights, levels, glossary, questions for the next call). "TradingView levels" card → Copy script → TradingView Pine Editor → paste over everything → Save → Add to chart. Draws the last ~5 weeks of call levels on the ticker you're viewing (newest call orange, older gray). Re-copy after each call. Levels are dated marks, not live prices.
- Log a call (Review page): pick the call's transcript file (.vtt from Zoom); it's read into the brain and Jarvis proposes alerts for the new levels as a card.
- Market page: Josh's 8 rows live, Jason's six-step routine, Mag 7, what's moving, plan of attack, economic calendar, watchlist earnings.
- Results page: combined P&L for both accounts (Robinhood's realized numbers), account values, weekly bars with the weekly-limit line, Phase goals (weekly loss, biggest single loss this week, trades today, weeks in a row without a big week), big-loss days, how we trade (winning/losing days, calls vs puts, best/worst ticker), rules vs results, and a short read from Jarvis. Options today; stocks and futures will slot in later.
- Limits & goals (Settings): phase (1 stop the big losses / 2 prove the edge / 3 scale), max loss per trade ($), weekly loss limit ($), max trades per day, monthly goal (%), warn when a trade is over X% of the account, and what counts as a big-loss day ($). Starting values: $100, $150, 2, 5%, 20%, $500. Anyone on the Otto login can change them; the change is posted on the Desk.
- Journal: fills from both Robinhood accounts (last 120 days), round trips matched automatically; each trade asks for one line on why (Jason's rule). Desk card trades link to their ticket and rule check.
- Review: builds itself Friday after the close — biggest wins/losses, rules followed/broken, the pattern, one thing for next week. "Build this week now" runs it any time. "For Jason" packet drafts what to send him before the next call.
- Score: every opening card is tracked, taken or not, and graded on the underlying: did price reach TP1 before the "wrong if" price (5-minute bars; if one bar touches both it counts as a loss). R = result measured in units of the planned risk (+2R = made twice what you risked). Passed ideas are hypothetical.
- 8:45 morning read: every weekday at 8:45 ET Jarvis posts a read on the Desk automatically.
- Settings: sign in with the Otto email (6-digit code or paste the sign-in link), connect/disconnect TradingView and Robinhood (Robinhood: paste the "This site can't be reached" localhost address back into Otto once), Limits & goals, the older bias thresholds.
- "the call" = the coaching call with Jason; the day changes week to week. The 👁 Watcher card (Desk, left column) lists today's price levels; the server checks them every minute 9:30–4:00 ET on 5- and 10-minute closes for a break-and-close, a pullback-and-hold or a rejection, and Jarvis builds a card (one ping) when it's a real setup. Signal levels are added automatically; add your own by typing 'NVDA 242 up' in the card or telling Jarvis 'watch NVDA 242'; the 9:20 scanner proposes levels on SPY, QQQ and the Mag-7 that you tap Add on. Levels clear at the close. The Score tab is the 2-week proof run: every card graded win / loss / flat on the same day, by source and trigger. House Rules (Settings) are standing instructions Jarvis follows; guardrails (Settings → Limits) flag with a red banner and never block.
- Winston tab: a separate paper-only trader on his own $4,000 that never places a real order. Today / Report / Scoreboard. DATA MODE badge = the soft rules (W3, W12–W15, W20–W23, fact checks) STAMP a trade instead of blocking it, so each rule can be scored; "Switch to strict" makes them block again. Stamps show under each trade (hover for the reason); "Went for him / against him" = how far the stock moved in his favour and against him while he was in (MFE / MAE). "Gates this week" scores every stamp; the Report's "What stopped him" counts the passed ideas by reason.
- Quiz tab (Pop Quiz): Josh picks a ticker and answers the five questions the coach asks on every pop quiz (big picture, sell-to, add/exit, confirming candle + entry, trend-or-chop + overnight). "Grade my answers" = one Jarvis call that grades each answer only from the coaching calls (call date + MM:SS next to every grade), a score out of 5 and two things to fix. Past quizzes show the trend; the weakest question goes into the Friday trade log as "working on".`;

/* ===================================================================== v3.15
   7 Oct 2026 — Ifoma's decisions (mockup otto-v3.15-mockup-b.html, "ok go"):
   - PLAYBOOK, no approvals: book rules (Tharp: sizing/stops/expectancy; Douglas:
     discipline; McMillan: options) written in our own words, always loaded into
     every Jarvis run next to the House Rules (House Rules win any clash). Coaching
     calls keep flowing in as before. Cards cite the book rules they lean on
     (plan.rules), so every rule builds its own record.
   - The coaching material leads until a setup / rule has 20 graded trades; after
     that a losing one (average R below 0) is marked WEAK and Jarvis leans on it less.
   - 5:15 PM DAILY RECAP on the Desk + one ping (pg_cron otto-daily-*, 015).
   - FEEDBACK button: notes with screen / build / recent errors (otto_feedback, 015),
     read by the daily recap and (optionally) the nightly bug check. */

export const PLAYBOOK_BOOKS: { id: string; book: string; topic: string; text: string; why: string }[] = [
  { id: "T-1", book: "Tharp", topic: "Sizing & risk", text: "Before entering, decide the price that proves the idea wrong. The distance from entry to that point is 1R, the trade's unit of risk.", why: "Every result can then be measured in R, so setups at different prices can be compared." },
  { id: "T-2", book: "Tharp", topic: "Sizing & risk", text: "Size the trade so a 1R loss stays inside the max loss per trade. If one contract is too much, pick a cheaper contract or pass.", why: "Position size, not the entry, decides whether a bad streak hurts or wipes you out." },
  { id: "T-3", book: "Tharp", topic: "Measuring", text: "Judge a setup by its average R per trade (expectancy), not by its win rate.", why: "A 40% win rate pays if winners run 2R+ and losers stay at 1R." },
  { id: "T-4", book: "Tharp", topic: "Exits", text: "Know the reward in R before entering. A first target under 1R needs a very high win rate to pay.", why: "Small targets with full-size risk quietly lose money even when most trades win." },
  { id: "T-5", book: "Tharp", topic: "Measuring", text: "Don't change or drop a setup after a few trades. Judge it on 20 or more.", why: "Small samples are mostly noise." },
  { id: "T-6", book: "Tharp", topic: "Sizing & risk", text: "Never size up to win back a loss. Size follows the account and the rules, not recent results.", why: "Bigger size after losses turns a normal losing streak into a big one." },
  { id: "D-1", book: "Douglas", topic: "Discipline", text: "Accept the loss at the stop before the trade is approved.", why: "Risk accepted up front leaves nothing to defend when price moves against you." },
  { id: "D-2", book: "Douglas", topic: "Discipline", text: "Each trade is one of the next 20. One result doesn't prove or disprove the setup.", why: "Wins and losses arrive in random order even with a real edge." },
  { id: "D-3", book: "Douglas", topic: "Discipline", text: "Anything can happen on any one trade. Once in, follow the plan, not hope or fear.", why: "Mid-trade changes are where most avoidable losses come from." },
  { id: "D-4", book: "Douglas", topic: "Discipline", text: "After the daily stop is hit, flag any new trade that day, even an A setup.", why: "Trying to win the day back is how one bad day becomes a bad week." },
  { id: "D-5", book: "Douglas", topic: "Discipline", text: "Never take a trade to make back a loss. Every setup has to stand on its own.", why: "Revenge trades skip the checks that make a setup worth taking." },
  { id: "M-1", book: "McMillan", topic: "Contracts", text: "Avoid buying options right before a known event (earnings, CPI, the Fed) unless the event is the trade.", why: "Implied volatility usually drops after the event and takes premium with it." },
  { id: "M-2", book: "McMillan", topic: "Contracts", text: "For intraday buys, prefer at least 2 trading days to expiry.", why: "Time decay is steepest in the last day; a small stall costs a lot." },
  { id: "M-3", book: "McMillan", topic: "Contracts", text: "Check the bid-ask spread. If it is more than about 10% of the option price, choose a more liquid strike or pass.", why: "A wide spread is a loss paid on entry and again on exit." },
  { id: "M-4", book: "McMillan", topic: "Contracts", text: "Enter options with limit orders, never market orders.", why: "Option quotes move fast and market orders fill at the worst price on the screen." },
  { id: "M-5", book: "McMillan", topic: "Contracts", text: "When implied volatility is high for that name, options are expensive: favor closer strikes or skip.", why: "High IV means you pay extra for the same move." },
  { id: "M-6", book: "McMillan", topic: "Exits", text: "Know the move the underlying needs to reach TP1 and whether the option's delta makes that worth the premium.", why: "A move that is too small for the premium is a loss even when the direction is right." },
];
const BOOK_IDS = new Set(PLAYBOOK_BOOKS.map((r) => r.id));
const BOOK_NAME: Record<string, string> = { Tharp: "Van Tharp", Douglas: "Mark Douglas", McMillan: "Lawrence McMillan" };
export const WEAK_MIN = 20;

export function cleanRules(x: unknown): string[] {
  const a = Array.isArray(x) ? x : typeof x === "string" ? x.split(/[,\s]+/) : [];
  return [...new Set(a.map((v) => String(v || "").trim().toUpperCase()).filter((v) => BOOK_IDS.has(v)))].slice(0, 6);
}

const isOpening = (a: any) => (a.calls || []).some((c: any) => c.tool === "place_option_order" &&
  (c.args?.legs || []).some((l: any) => l.position_effect === "open"));
const GRADED = ["win", "loss", "scratch"];

// Pure: records per book rule, per setup and per Watcher trigger, plus the WEAK list.
export function playbookStats(ideas: any[]) {
  const rec: Record<string, { n: number; scored: number; wins: number; losses: number; scratch: number; sumR: number }> = {};
  const add = (k: string, a: any) => {
    const r = (rec[k] ||= { n: 0, scored: 0, wins: 0, losses: 0, scratch: 0, sumR: 0 });
    r.n++;
    const st = a.outcome?.state;
    if (GRADED.includes(st)) {
      r.scored++; r.sumR += Number(a.outcome.r || 0);
      if (st === "win") r.wins++; else if (st === "loss") r.losses++; else r.scratch++;
    }
  };
  for (const a of ideas) {
    for (const id of cleanRules(a.plan?.rules)) add(id, a);
    if (a.plan?.setup) add("setup:" + String(a.plan.setup).toLowerCase(), a);
    if (a.plan?.trigger) add("trigger:" + String(a.plan.trigger), a);
  }
  const out: Record<string, any> = {};
  const weak: { key: string; label: string; scored: number; avg_r: number }[] = [];
  for (const [k, r] of Object.entries(rec)) {
    const avg_r = r.scored ? r.sumR / r.scored : null;
    const isWeak = r.scored >= WEAK_MIN && avg_r !== null && avg_r < 0;
    out[k] = { n: r.n, scored: r.scored, wins: r.wins, losses: r.losses, scratch: r.scratch, avg_r, weak: isWeak, leads: r.scored >= WEAK_MIN ? "results" : "material" };
    if (isWeak) weak.push({ key: k, label: playbookLabel(k), scored: r.scored, avg_r: Math.round((avg_r as number) * 100) / 100 });
  }
  return { records: out, weak };
}
function playbookLabel(k: string) {
  if (k.startsWith("setup:")) return "Setup: " + k.slice(6);
  if (k.startsWith("trigger:")) return "Watcher trigger: " + (TRIG_LABEL[k.slice(8)] || k.slice(8));
  const b = PLAYBOOK_BOOKS.find((r) => r.id === k);
  return b ? `${k} ${b.text}` : k;
}

async function playbookIdeas() {
  const acts = await db("otto_actions?" + OQ() + "select=id,created_at,status,calls,plan,outcome&order=created_at.desc&limit=600");
  return (acts || []).filter(isOpening);
}

export async function playbookRefresh(reason = "refresh") {
  const st = playbookStats(await playbookIdeas());
  const prev = (await setting("playbook_stats")) || {};
  const before = new Set((prev.weak || []).map((w: any) => w.key));
  const after = new Set(st.weak.map((w) => w.key));
  const log: any[] = ((await setting("playbook_log")) || {}).items || [];
  const at = new Date().toISOString();
  for (const w of st.weak) if (!before.has(w.key)) log.unshift({ at, kind: "weak", text: `Marked weak after ${w.scored} graded trades (avg ${w.avg_r >= 0 ? "+" : ""}${w.avg_r}R): ${w.label}`, reason });
  for (const k of before) if (!after.has(k as string)) log.unshift({ at, kind: "unweak", text: `No longer weak: ${playbookLabel(k as string)}`, reason });
  if (!log.some((x) => x.kind === "books")) log.push({ at, kind: "books", text: `${PLAYBOOK_BOOKS.length} book rules loaded: Tharp ${PLAYBOOK_BOOKS.filter((r) => r.book === "Tharp").length}, Douglas ${PLAYBOOK_BOOKS.filter((r) => r.book === "Douglas").length}, McMillan ${PLAYBOOK_BOOKS.filter((r) => r.book === "McMillan").length}.` });
  await putSetting("playbook_stats", { ...st, at }, "otto");
  await putSetting("playbook_log", { items: log.slice(0, 60) }, "otto");
  delete CACHE.playbook_text;
  return st;
}

export async function playbookText(): Promise<string> {
  return cached("playbook_text", 5 * 60e3, async () => {
    const st = (await setting("playbook_stats").catch(() => null)) || { weak: [] };
    const lines = PLAYBOOK_BOOKS.map((r) => `${r.id} [${r.book}] ${r.text}`);
    const weak = (st.weak || []) as any[];
    return "OTTO PLAYBOOK — book rules (always in force, below the House Rules and the Otto Rules from the calls; " +
      "when they clash: House Rules first, then the call material until a setup has 20 graded trades, then whatever the results say). " +
      "On every opening card, list the ids you relied on in plan.rules (e.g. [\"T-1\",\"T-2\",\"M-2\"]).\n" + lines.join("\n") +
      (weak.length ? "\n\nRESULTS SAY WEAK (20+ graded trades, average R below 0) — lean on these less, and if a card still uses one, say so in its summary:\n" +
        weak.map((w) => `- ${w.label} (${w.scored} trades, ${w.avg_r}R avg)`).join("\n") : "");
  });
}

async function playbookGet() {
  let st = await setting("playbook_stats");
  if (!st || !st.at || Date.now() - Date.parse(st.at) > 60 * 60e3) st = await playbookRefresh("page open");
  let calls: any[] = [];
  try {
    calls = (await loadBrain()).map((c: any) => ({ date: c.call?.date || "", title: c.call?.title || "call",
      rules: (c.rules || []).map((r: any) => r.rule).filter(Boolean).slice(0, 40),
      setups: (c.setups || []).map((x: any) => ({ name: x.name, trigger: x.trigger || "" })).slice(0, 20) }));
  } catch { /* the page still shows the books */ }
  const log = ((await setting("playbook_log")) || {}).items || [];
  return { books: PLAYBOOK_BOOKS.map((r) => ({ ...r, author: BOOK_NAME[r.book] })), calls, stats: st, weak_min: WEAK_MIN, log: log.slice(0, 20) };
}

/* ---- feedback ---- */
async function feedbackAdd(body: any, who: string) {
  const kind = ["bug", "idea", "slow", "wrong"].includes(body?.kind) ? body.kind : "bug";
  const note = String(body?.note || "").trim().slice(0, 4000);
  if (note.length < 3) throw new Error("write a short note first");
  const row = { kind, note, author: String(body?.author || who.split("@")[0]).slice(0, 40), screen: String(body?.screen || "").slice(0, 60),
    build: String(body?.build || "").slice(0, 20), errors: Array.isArray(body?.errors) ? body.errors.slice(-5).map((e: any) => String(e).slice(0, 300)) : [],
    ua: String(body?.ua || "").slice(0, 200) };
  const r = await db("otto_feedback", { method: "POST", body: JSON.stringify(row) });
  return { id: r?.[0]?.id ?? null };
}
async function feedbackList(days = 14) {
  const since = new Date(Date.now() - Math.min(90, Math.max(1, days)) * 86400e3).toISOString();
  return await db("otto_feedback?select=id,created_at,kind,note,author,screen,build,errors&created_at=gte." + since + "&order=created_at.desc&limit=100");
}
async function feedbackDigest() {
  const items = await feedbackList(2);
  const errs = await db("otto_desk?" + OQ() + "select=created_at,author,content&created_at=gte." + new Date(Date.now() - 26 * 3600e3).toISOString() +
    "&content=like.*%E2%9A%A0*&order=id.desc&limit=30").catch(() => []);
  return { feedback: items, desk_warnings: (errs || []).map((r: any) => ({ at: r.created_at, author: r.author, text: String(r.content).slice(0, 300) })) };
}

/* ---- the 5:15 PM daily recap ---- */
const RECAP_SYS = `You are Jarvis on the Otto trading desk, writing the end-of-day recap for Ifoma and Josh. Plain words, numbers first, no hype, no lecturing, phone-sized. Use ONLY the data given; if something isn't in it, leave it out. Times are New York time.

FORMAT — markdown, exactly these headings, skip a heading only if it would be empty (except the first):
### Today in one line
(The "### Trades and cards" section is written by the server from Robinhood's own records and inserted after your first section — do NOT write that heading. Never state a fill, a win/loss, an R or a $ result anywhere; you may quote the server's "Realized" line word for word. A card nobody took is an idea, not a trade.)
### What was discussed
(the 2–5 things that mattered in the Desk conversation — decisions, questions, rules saved)
### Worth fixing
(moments Otto or Jarvis got something wrong, was slow, repeated itself, or someone had to ask twice; plus the feedback notes left today)
### For tomorrow
(scheduled events from the calendar given, open positions, anything they said they'd do tomorrow)`;

async function claudeText(body: any, budgetMs = 90_000): Promise<string> {
  const r = await claudeFetch({ _tag: "text", ...body, stream: true }, Date.now() + budgetMs);
  const reader = r.body!.getReader(), dec = new TextDecoder();
  let buf = "", out = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let i;
    while ((i = buf.indexOf("\n\n")) >= 0) {
      const chunk = buf.slice(0, i); buf = buf.slice(i + 2);
      const line = chunk.split("\n").find((l) => l.startsWith("data: "));
      if (!line) continue;
      try { const ev = JSON.parse(line.slice(6)); if (ev.type === "content_block_delta" && ev.delta?.type === "text_delta") out += ev.delta.text; } catch { /* */ }
    }
  }
  return out.trim();
}
const etHM = (iso: string) => { try { return new Date(iso).toLocaleTimeString("en-US", { timeZone: "America/New_York", hour: "numeric", minute: "2-digit" }); } catch { return ""; } };

export async function dailyRecap(force = false) {
  const c = marketClock();
  if (!force && !isTradingDay(c.date)) return { skipped: "not a trading day" };
  const done = await setting("daily_recap_day");
  if (!force && done?.day === c.date) return { skipped: "already done" };
  await putSetting("daily_recap_day", { day: c.date, at: new Date().toISOString() });
  const since = new Date(Date.now() - 14 * 3600e3).toISOString();
  const AL = "(" + ["TradingView", "Jarvis · alert read", "Jarvis · daily recap"].map((x) => '"' + x + '"').join(",") + ")";
  const rows = await db("otto_desk?" + OQ() + "select=created_at,role,author,content&created_at=gte." + since + "&author=not.in." + encodeURIComponent(AL) + "&order=id.asc&limit=300").catch(() => []);
  const acts = await db("otto_actions?" + OQ() + "select=title,status,created_by,created_at,plan,outcome,exit&created_at=gte." + since + "&order=created_at.asc&limit=60").catch(() => []);
  const trades = await db("otto_trades?select=*&order=closed_at.desc&limit=20").catch(() => []);
  const fb = await feedbackList(1).catch(() => []);
  let cal: any[] = [];
  try { const nx = nextTradingDay(c.date); cal = (await econEvents(nx, nx, 2)).slice(0, 8); } catch { /* optional */ }
  const convo = (rows || []).map((r: any) => `[${etHM(r.created_at)}] ${r.author}: ${String(r.content || "").replace(/\s+/g, " ").slice(0, 500)}`).join("\n").slice(-30000);
  if (!convo && !(acts || []).length) {
    await logDesk("assistant", "Jarvis · daily recap", `### Today in one line\nQuiet day: no Desk conversation and no cards.`);
    return { ok: true, quiet: true };
  }
  const data = [
    `DATE ${c.date} (${c.line || ""})`,
    `DESK CONVERSATION (today):\n${convo || "(none)"}`,
    `CARDS (today):\n${(acts || []).map((a: any) => `- ${etHM(a.created_at)} "${a.title}" status=${a.status} by=${a.created_by} setup=${a.plan?.setup || "-"} source=${a.plan?.source || "-"} rules=${(a.plan?.rules || []).join(",") || "-"} idea_grade(paper, not money)=${a.outcome?.state || "-"} exit=${a.exit?.state || "-"}`).join("\n") || "(none)"}`,
    `CLOSED TRADES (recent, from the journal):\n${(trades || []).filter((t: any) => t.closed_at && etParts(new Date(t.closed_at)).date === c.date).map((t: any) => JSON.stringify(t).slice(0, 300)).join("\n") || "(none today)"}`,
    `FEEDBACK NOTES (today):\n${(fb || []).map((f: any) => `- [${f.kind}] ${f.author}: ${f.note} (screen ${f.screen || "?"})`).join("\n") || "(none)"}`,
    `CALENDAR next trading day:\n${cal.map((e: any) => `- ${e.date} ${e.title} (importance ${e.importance})`).join("\n") || "(not available)"}`,
    await recapExtras(c.date).catch(() => ""),
  ].join("\n\n");
  // v3.22: the trades section comes from Robinhood, not from Jarvis.
  const fullActs = await db("otto_actions?" + OQ() + "select=title,status,result,created_at,plan&created_at=gte." + since + "&order=created_at.asc&limit=200").catch(() => acts || []);   // v3.44: plan = practice / reject-why / duplicate; v3.45: the fallback is back out of the comment
  const ords = await dayOrders(c.date).catch(() => null);
  const block = ords ? recapTradesBlock(ords, fullActs || []) : "### Trades and cards\n⚠ Robinhood's order records couldn't be read just now — no trade results in this recap.";
  const raw = await claudeText({ model: MODEL, max_tokens: 1200, system: RECAP_SYS + NAME_RULE, messages: [{ role: "user", content: data + "\n\nSERVER TRADES SECTION (inserted as-is; don't repeat its numbers except the Realized line):\n" + block }] });
  if (!raw) throw new Error("empty recap");
  const text = spliceRecap(raw, block);
  await logDesk("assistant", "Jarvis · daily recap", text);
  const first = text.split("\n").find((l) => l.trim() && !l.startsWith("#")) || "Tap to read it on the Desk.";
  await notify("daily", "🗒 Daily recap is ready", first.slice(0, 200));
  return { ok: true };
}

async function helpAnswer(body: any, apiKey: string) {
  const hist = (Array.isArray(body.messages) ? body.messages : []).slice(-12)
    .map((m: any) => ({ role: m.role === "assistant" ? "assistant" : "user", content: String(m.content || "").slice(0, 2000) }))
    .filter((m: any) => m.content);
  while (hist.length && hist[0].role !== "user") hist.shift();
  if (!hist.length || hist[hist.length - 1].role !== "user") throw new Error("ask a question");
  const L = await getLimits();
  const r = await aiFetch("help", { method: "POST",
    headers: { "content-type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model: await roomModel(), max_tokens: 700,
      system: [{ type: "text", text: HELP_SYS + NAME_RULE + `\n\nCURRENT LIMITS: ${JSON.stringify({ phase: L.phase, max_trade_loss: L.max_trade_loss, weekly_loss: L.weekly_loss, max_trades_day: L.max_trades_day, monthly_goal_pct: L.monthly_goal_pct, warn_pct: L.warn_pct, big_day: L.big_day })}`, cache_control: { type: "ephemeral" } }],
      messages: hist }) });
  const j = await r.json();
  if (j.error) throw new Error(j.error.message || "API error");
  return (j.content || []).filter((c: any) => c.type === "text").map((c: any) => c.text).join("");
}

/* ============================================================ v3.16 (7 Oct 2026)
   Ifoma, 7 Oct: "make sure the listener … Jarvis is able to read it … capitalize on it" and "if he can't do
   something he says I can't do it; if he says I'm doing it, he does it."
   What 6 Oct showed: the coach's MU short (3:02 and 3:12 PM) got NO card and NO warning — Jarvis spent all 8
   steps paging MU's option chain (100 strikes a page from $5 up) and the batch was marked "done". At 12:02 Jarvis
   said "I'll flag you at 1:30" and at 12:17 "I'm watching" with nothing behind either.
   - optionShortlist(): the server fetches price, buying power and the contracts near the money (3 expiries,
     delta / volume vs OI / cost already checked) so a Signal card is one step, not eight.
   - Signal card builds MUST end in a card for a call (a forced final step), and any call that still has no card
     pings with the reason. The feed never shows Jarvis's working notes.
   - schedule_check: "I'll check back at 1:30" becomes a real, timed run.
   - promiseCheck(): every Desk reply is scanned for promises ("I'm watching", "I'll flag you", "I've set…");
     anything with nothing real behind it gets one automatic correction round.
   - signalSelfTest(): 9:10 ET every trading day — watcher heartbeat, reading a post, the shortlist and a dry-run
     card build, timed. ✅/❌ on the Desk; phones pinged only on ❌. */

/* ---------------------------------------------------------------- the contract shortlist */
type SLRow = { option_id: string; exp: string; strike: number; type: "call" | "put"; bid: number; ask: number; mark: number;
  delta: number; vol: number; oi: number; cost: number; fits: boolean; band: boolean; liq: boolean; label: string };
const num = (v: any) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };

export function pickContracts(rows: SLRow[]) {
  const score = (r: SLRow) => Math.abs(Math.abs(r.delta) - 0.35);
  const good = rows.filter((r) => r.band && r.liq && r.ask > 0).sort((a, b) => score(a) - score(b) || b.vol - a.vol);
  const band = rows.filter((r) => r.band && r.ask > 0).sort((a, b) => score(a) - score(b) || b.vol - a.vol);
  const best = good[0] || band[0] || null;
  // The best contract that FITS buying power: in the delta band if one fits, otherwise the fitting contract
  // closest to the band from below (furthest-in-the-money that still fits), never under delta .15.
  const fit = rows.filter((r) => r.fits && r.ask > 0 && Math.abs(r.delta) >= 0.15);
  const fitBand = fit.filter((r) => r.band).sort((a, b) => (Number(b.liq) - Number(a.liq)) || score(a) - score(b));
  const fitBelow = fit.filter((r) => Math.abs(r.delta) < 0.30).sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta) || b.vol - a.vol);
  const bestFit = fitBand[0] || fitBelow[0] || fit.sort((a, b) => score(a) - score(b))[0] || null;
  return { best, bestFit: bestFit && best && bestFit.option_id === best.option_id ? best : bestFit };
}

// v3.20: one shortlist per ticker/side for 90 s — the card check, the tool and the Watcher prefetch share it.
export function shortlistCached(ticker: string, side: "call" | "put") {
  const sym = String(ticker || "").toUpperCase().replace(/[^A-Z.]/g, "");
  return cached(`sl|${sym}|${side}`, 90e3, () => optionShortlist(sym, side));
}
export const SHORTLIST_TOOL = {
  name: "option_shortlist",
  description: "The server's contract list for an opening card: live price, Agentic buying power, and the calls or puts near the money for the next 3 expiries with bid/ask, delta, volume/OI and cost. ★ = best by the Otto Rules; ◆ = best that fits buying power. Use this INSTEAD of paging option chains yourself, before every opening card.",
  input_schema: { type: "object", properties: { ticker: { type: "string" }, side: { type: "string", enum: ["call", "put"] } }, required: ["ticker", "side"] },
};
export const CONTRACT_RULE = "CONTRACTS (v3.20): before any opening card call option_shortlist(ticker, side) — don't page option chains yourself. Card the ★ contract if it fits buying power, otherwise the ◆ one. If NOTHING fits, card the cheapest ★/◆ anyway (it gets a red banner) and say so in one line. The server refuses an opening card that's over buying power while a ◆ contract fits.";
export async function optionShortlist(ticker: string, side: "call" | "put") {
  const sym = String(ticker || "").toUpperCase().replace(/[^A-Z.]/g, "");
  if (!sym) throw new Error("no ticker");
  const acct = await agenticAccount();
  const [q, ch, pf] = await Promise.all([
    call("rh", "get_equity_quotes", { symbols: [sym] }).then(mcpJson),
    call("rh", "get_option_chains", { underlying_symbol: sym }).then(mcpJson),
    call("rh", "get_portfolio", { account_number: acct }).then(mcpJson).catch(() => null),
  ]);
  const qq = q?.data?.results?.[0]?.quote || {};
  const reg = num(qq.last_trade_price), ext = num(qq.last_non_reg_trade_price);
  const spot = ext && Date.parse(qq.venue_last_non_reg_trade_time || 0) > Date.parse(qq.venue_last_trade_time || 0) ? ext : reg;
  if (!(spot > 0)) throw new Error(`no price for ${sym}`);
  const bpRaw = Number(pf?.data?.buying_power?.buying_power ?? pf?.data?.buying_power);
  const bp = pf && Number.isFinite(bpRaw) ? bpRaw : null;
  const chain = (ch?.data?.chains || []).find((c: any) => c.symbol === sym && c.can_open_position !== false) || (ch?.data?.chains || [])[0];
  const today = etParts().date;
  const exps: string[] = (chain?.expiration_dates || []).filter((d: string) => d > today && d <= addDays(today, 21)).slice(0, 3);
  if (!exps.length) throw new Error(`no ${sym} expiries in the next 3 weeks`);
  const lo = spot * 0.94, hi = spot * 1.06;
  const near = async (exp: string) => {
    // Robinhood lists strikes 100 a page from the bottom; its cursor is base64("p=<strike>"), so start the page
    // just under the money instead of paging up from $5 (what ate Jarvis's steps on MU, 6 Oct).
    const args: any = { chain_symbol: sym, expiration_dates: exp, type: side, cursor: btoa("p=" + (lo - 0.01).toFixed(4)) };
    let list: any[] = [];
    try { list = mcpJson(await call("rh", "get_option_instruments", args))?.data?.instruments || []; } catch { /* fall back below */ }
    if (!list.some((i: any) => num(i.strike_price) >= lo && num(i.strike_price) <= hi)) {
      delete args.cursor;
      list = mcpJson(await call("rh", "get_option_instruments", args))?.data?.instruments || [];
    }
    const ok = list.filter((i: any) => i.tradability !== "untradable" && i.state !== "expired" && num(i.strike_price) >= lo && num(i.strike_price) <= hi);
    // 2 strikes in the money + 6 out of the money: delta ~.55 down to ~.15, so both the rules' pick and a cheaper fit are in view.
    const otm = (i: any) => side === "put" ? num(i.strike_price) <= spot : num(i.strike_price) >= spot;
    const dist = (a: any, b: any) => Math.abs(num(a.strike_price) - spot) - Math.abs(num(b.strike_price) - spot);
    return [...ok.filter((i: any) => !otm(i)).sort(dist).slice(0, 2), ...ok.filter(otm).sort(dist).slice(0, 6)];
  };
  const ins = (await Promise.all(exps.map((e) => near(e).catch(() => [])))).flat();
  if (!ins.length) throw new Error(`couldn't list ${sym} ${side}s near $${spot}`);
  const quotes: Record<string, any> = {};
  for (let i = 0; i < ins.length; i += 20) {
    const j = mcpJson(await call("rh", "get_option_quotes", { instrument_ids: ins.slice(i, i + 20).map((x: any) => x.id) }));
    for (const r of j?.data?.results || []) if (r?.quote?.instrument_id) quotes[r.quote.instrument_id] = r.quote;
  }
  const rows: SLRow[] = ins.map((i: any) => {
    const qo = quotes[i.id] || {};
    const ask = num(qo.ask_price), bid = num(qo.bid_price), mark = num(qo.mark_price) || (ask + bid) / 2;
    const delta = num(qo.delta), vol = num(qo.volume), oi = num(qo.open_interest), strike = num(i.strike_price);
    const cost = Math.round(ask * 100);
    return { option_id: i.id, exp: i.expiration_date, strike, type: side, bid, ask, mark, delta, vol, oi, cost,
      fits: bp != null ? cost <= bp : true, band: Math.abs(delta) >= 0.30 && Math.abs(delta) <= 0.40, liq: vol > oi,
      label: `${sym} ${strike % 1 ? strike : Math.round(strike)}${side === "put" ? "P" : "C"} ${String(i.expiration_date).slice(5).replace("-", "/")}` };
  }).sort((a: SLRow, b: SLRow) => a.exp.localeCompare(b.exp) || a.strike - b.strike);
  const { best, bestFit } = pickContracts(rows);
  const line = (r: SLRow) => `${r === best ? "★" : r === bestFit ? "◆" : " "} ${r.label}  option_id ${r.option_id}  bid ${r.bid.toFixed(2)} / ask ${r.ask.toFixed(2)}  δ ${r.delta.toFixed(2)}  vol ${r.vol} / OI ${r.oi}${r.liq ? "" : " (vol<OI)"}  ≈$${r.cost}${r.fits ? " fits" : " OVER buying power"}`;
  const text = `${sym} $${spot.toFixed(2)} · Agentic buying power ${bp != null ? "$" + bp.toFixed(2) : "unknown"} · ${side}s, expiries ${exps.join(", ")} (fetched ${fmtMin(etParts().min)} ET)\n` +
    rows.map(line).join("\n") +
    `\n★ = best by the Otto Rules (delta .30–.40, volume > OI)${best ? ": " + best.label : ": none in the band"}. ◆ = best that fits buying power${bestFit ? ": " + bestFit.label : ": NOTHING fits"}.`;
  return { sym, side, spot, bp, exps, rows, best, bestFit, text };
}

/* ---------------------------------------------------------------- what is really running right now */
/* v5.2: Jarvis gets what the coach SAID on today's live call (same facts Winston reads), so "what did the coach say on MU?" has an answer and cards can quote it. */
export function earsHeardBlock(st: any, day: string): string {
  if (!st || !Array.isArray(st.levels) || etParts(new Date(st.started || 0)).date !== day) return "";
  const lines = st.levels.filter((l: any) => l && (l.status === "armed" || l.status === "draft") && l.ticker && Number(l.level) > 0).slice(0, 40).map((l: any) => {
    const dir = l.dir === "up" ? "break ABOVE" : l.dir === "down" ? "break BELOW" : "level";
    const flag = l.status === "draft" ? (l.hold ? ", context only, not armed" : ", UNCONFIRMED") : "";
    return `[heard live, call minute ${Number(l.min) || 0}${flag}] ${String(l.ticker).toUpperCase()} ${Number(l.level)} (${dir}) — ${String(l.meaning || "").replace(/\s+/g, " ").slice(0, 160)}`;
  });
  return lines.length ? `\nHEARD ON TODAY'S LIVE CALL (what the coach said out loud, transcribed by voice, so a number can be wrong; quote it when someone asks what he said, and when a card comes from one of these levels):\n${lines.join("\n")}` : "";
}
export async function runningNow(): Promise<string> {
  const day = etParts().date;
  const [w, ch, prot, L, beat, earsSt] = await Promise.all([
    db(`otto_watch?select=ticker,level,dir&day=eq.${day}&status=eq.watching&limit=30`).catch(() => []),
    db(`otto_checks?select=due_at,what&status=eq.pending&order=due_at.asc&limit=10`).catch(() => []),
    db("otto_actions?" + OQ() + "select=title,exit&exit->>state=eq.armed&limit=5").catch(() => []),
    getLimits().catch(() => LIMIT_DEFAULTS),
    setting("signal_beat").catch(() => null),
    setting("ears_state").catch(() => null),
  ]);
  const apS = await apGet().catch(() => null);   // v5.9
  const beatOk = beat?.at && Date.now() - Date.parse(beat.at) < 3 * 60e3 && beat.state === "ok";
  return `RUNNING RIGHT NOW — the ONLY things that act without a message (anything else you'd have to do with a tool, now):
- 👁 Watcher levels today: ${(w || []).length ? w.map((r: any) => `${r.ticker} ${Number(r.level)} ${r.dir}`).join(", ") : "none"} (checked every minute on 5/10-min closes, 9:30–4:00).
- ⏰ Scheduled check-ins: ${(ch || []).length ? ch.map((c: any) => `${fmtMin(etParts(new Date(c.due_at)).min)} ET — ${String(c.what).slice(0, 60)}`).join("; ") : "none"}.
- 🛡 Protected trades: ${(prot || []).length ? prot.map((r: any) => `${r.title} (Robinhood stop at $${r.exit?.stop_option}, TradingView alerts wrong-if ${r.exit?.wrong_if} / TP1 ${r.exit?.tp1})`).join("; ") : "none"}.
- Auto-close: ${L.auto_close ? `ON — position check every ${Math.max(5, Number(L.review_min) || 15)} min while a trade is open (HOLD or CLOSE only)` : "OFF"}.
- TradingView alert fires read every 2 min. Otto Signals watcher: ${beatOk ? "on" : "NOT reporting — signals may be missed"}.
- 🛫 OttoPilot: ${apS?.on ? `ON (switched on by ${apS.by || "the trader"}) — the SERVER answers your new PRACTICE cards for you the moment you build them; say so plainly if asked. Stops at ${apS.cfg.max_trades} trades, ${apS.cfg.max_losses} losing trades or ${fmtMin(apS.cfg.last_entry_min)} ET. A LIVE card still needs a human tap; a card you flag weak is recorded as passed, not taken` : "OFF — every practice card waits for Josh's Approve or Reject"}.
To make a new promise true: schedule_check (a timed look + ping) or add_watch_level (a price level). Otherwise say plainly you can't.${earsHeardBlock(earsSt, day)}`;
}

/* ---------------------------------------------------------------- schedule_check */
export const CHECK_TOOL = {
  name: "schedule_check",
  description: "Schedule a real check-in: at the given New York time today (market hours, up to 4:15 PM) the server runs you again with this note, you look at live data, post on the Desk and ping their phones. Use it whenever you'd say \"I'll check back / flag you / let you know at …\". Never promise a timed follow-up without calling this.",
  input_schema: { type: "object", properties: {
    at: { type: "string", description: "New York time today, e.g. \"1:30 PM\"" },
    what: { type: "string", description: "What to check and what to tell them, one or two lines (ticker, level, the condition)" } },
    required: ["at", "what"] },
};
export async function checkAdd(at: string, what: string, by: string) {
  const c = marketClock();
  const iso = nyIso(c.date, String(at || "").trim());
  if (!iso) throw new Error(`couldn't read the time "${at}" — use a New York time like 1:30 PM`);
  const t = Date.parse(iso), m = etParts(new Date(iso)).min;
  if (t <= Date.now() + 60e3) throw new Error("that time has passed (or is under a minute away)");
  if (!isTradingDay(c.date) || m > 975 || m < 540) throw new Error("check-ins run on a trading day between 9:00 AM and 4:15 PM ET");
  const open = await db(`otto_checks?select=id&status=eq.pending&day=eq.${c.date}`).catch(() => []);
  if ((open || []).length >= 10) throw new Error("10 check-ins are already waiting today");
  const row = (await db("otto_checks", { method: "POST", body: JSON.stringify({ day: c.date, due_at: iso, what: String(what || "").slice(0, 400), by: String(by).slice(0, 60), status: "pending" }) }))?.[0];
  await logDesk("system", "Otto", `⏰ Check-in set for ${fmtMin(m)} ET: ${String(what).slice(0, 200)} (Jarvis will look again then and ping you).`);
  return row;
}
export async function checksTick(now = Date.now()) {
  const due = await db(`otto_checks?select=*&status=eq.pending&due_at=lte.${new Date(now).toISOString()}&order=due_at.asc&limit=3`).catch(() => []);
  for (const r of due || []) {
    const claimed = await db(`otto_checks?id=eq.${r.id}&status=eq.pending&select=*`, { method: "PATCH", body: JSON.stringify({ status: "running" }) }).catch(() => []);
    if (!claimed?.length) continue;                                     // another run took it
    if (now - Date.parse(r.due_at) > 15 * 60e3) {                       // a missed minute is fine; an hour late is not a check-in
      await db(`otto_checks?id=eq.${r.id}`, { method: "PATCH", headers: { prefer: "return=minimal" }, body: JSON.stringify({ status: "missed" }) }).catch(() => {});
      await logDesk("system", "Otto", `⏰ The ${fmtMin(etParts(new Date(r.due_at)).min)} check-in didn't run on time (server was down). It was: ${String(r.what).slice(0, 200)}`);
      continue;
    }
    if (!(await kick("check_jarvis", { id: r.id }))) await checkJarvis(r.id);
  }
}
export async function checkJarvis(id: number) {
  const r = (await db(`otto_checks?select=*&id=eq.${id}`))?.[0];
  if (!r) return;
  try {
    const { cs, sys, tools, ctxLine } = await deskSetup();
    const prompt = `${ctxLine}\n[⏰ CHECK-IN — you scheduled this (asked by ${r.by}). Nobody typed this. Due ${fmtMin(etParts(new Date(r.due_at)).min)} ET.]\n${r.what}\nFetch what you need (live price, bars, the position), then write 1–4 plain lines for the Desk: what you see and what you'd do. A card only if there's a real setup or the plan says act. Don't promise anything you can't back with a tool.`;
    const res = await runDesk({ msgs: [{ role: "user", content: prompt }], sys, tools: [...tools.filter((t: any) => t.name !== "close_position"), WATCH_TOOL, CHECK_TOOL], cs,
      who: "checkin", send: () => {}, allowPropose: true, allowClose: false, maxRounds: 6 });
    const said = res.said.trim() || "Checked — nothing to add.";
    await logDesk("assistant", "Jarvis · check-in", said, res.cards[res.cards.length - 1] || null);
    await db(`otto_checks?id=eq.${id}`, { method: "PATCH", headers: { prefer: "return=minimal" }, body: JSON.stringify({ status: "done", result: unname(said).slice(0, 2000) }) }).catch(() => {});
    await notify("checkin", `⏰ Check-in: ${String(r.what).slice(0, 60)}`, unname(said).replace(/\s+/g, " ").slice(0, 200));
  } catch (e) {
    const m = String((e as Error).message || e).slice(0, 200);
    await db(`otto_checks?id=eq.${id}`, { method: "PATCH", headers: { prefer: "return=minimal" }, body: JSON.stringify({ status: "error", result: m }) }).catch(() => {});
    await logDesk("system", "Otto", `⏰ The check-in "${String(r.what).slice(0, 120)}" failed: ${m}`);
    await notify("checkin", "⏰ A check-in failed", `${String(r.what).slice(0, 80)} — ${m.slice(0, 100)}`);
  }
}

/* ---------------------------------------------------------------- promise checker */
// Sentences where Jarvis commits to doing something later, or says he already did something.
const WHEN_RE = /\b(at \d{1,2}(:\d{2})?\s*(am|pm)?|by \d{1,2}(:\d{2})?|in \d+ ?(min|mins|minutes|hours?)\b|this afternoon|later today|later on|before the close|at the close|at noon|at the open|tomorrow|first thing)\b|\b(if|when|once|as soon as|the moment)\b[^.!?]{0,80}\b(hits?|break(s|ing)?|cross(es)?|fills?|drops?|closes?|touch(es)?|reach(es)?|gets?|goes|triggers?|stuck|starts?|moves?|looks?|turns?|fades?|rolls? over)\b|\bbefore it\b/i;
const PROMISE_RES: { kind: "watch" | "later" | "done"; re: RegExp; needsWhen?: boolean }[] = [
  { kind: "watch", re: /\b(I'?m|I am) (watching|monitoring|keeping (an |a close )?eye on)\b(?! (what you|your point|how you))|\bI'?ll (keep )?(watch(ing)?|monitor(ing)?|keep (an |a close )?eye on)\b/i },
  // Notifying words are promises on their own ("I'll ping you").
  { kind: "later", re: /\bI'?ll (flag|ping|alert|notify|remind|check (back|in|again)|circle back)\b|\bI will (flag|ping|alert|notify|remind|check back)\b/i },
  // Other future actions are promises only with a time or a market condition ("I'll say something if it starts looking ugly").
  { kind: "later", needsWhen: true, re: /\bI'?ll (let you know|update you|message you|text you|tell you|get back to you|speak up|say something|close (it|this|the|your)|move (the|your) stop|cut it|take (it|profit))\b|\bI will (let you know|tell you|close)\b/i },
  { kind: "done", re: /\bI'?ve (set|placed|armed|scheduled|created) (up )?(a |an |the |your )?(\w+ )?(alert|stop|order|check|check-in|reminder|trigger|watch)\b|\bI'?ve added \w+( \d+(\.\d+)?)? to the (watch|Watcher)|\b(alert|stop order|order|check-in) (is|are) (now )?(set|armed|placed|live|scheduled)\b/i },
];
export function findPromises(text: string): { kind: string; sentence: string }[] {
  const out: { kind: string; sentence: string }[] = [];
  const sentences = String(text || "").replace(/\*\*/g, "").split(/(?<=[.!?])\s+|\n+/).map((s) => s.trim()).filter(Boolean);
  for (const s of sentences) {
    // An offer that waits for their next message is true by design ("tell me and I'll close it").
    if (/^(if|when) (you|they) (want|ask)|\b(tell me|ask me|say the word|let me know|just say|if you want|want me to|if you'd like|on your word|reply|once you approve|after you approve|when you approve)\b/i.test(s)) continue;
    if (/\b(can'?t|cannot|won'?t|not able|no way to|don'?t)\b.{0,30}\b(watch|monitor|ping|flag)/i.test(s)) continue;   // an honest "I can't"
    for (const p of PROMISE_RES) if (p.re.test(s) && (!p.needsWhen || WHEN_RE.test(s))) { out.push({ kind: p.kind, sentence: s.slice(0, 240) }); break; }
  }
  return out;
}
// Is there something real behind each promise? `did` = tools that SUCCEEDED in this reply; `failed` = tools that errored.
export function unbacked(promises: { kind: string; sentence: string }[], ctx: { did: string[]; failed: string[]; protectedTrade: boolean; autoClose: boolean; watchToday: string[] }) {
  const did = new Set(ctx.did);
  return promises.filter((p) => {
    const s = p.sentence;
    if (p.kind === "watch") {
      if (did.has("add_watch_level") || did.has("schedule_check")) return false;
      const tick = (s.match(/\b[A-Z]{2,5}\b/g) || []).find((t) => ctx.watchToday.includes(t));
      return !(tick && /level|break|hold|reject/i.test(s));                    // "I'm watching NVDA 242" with NVDA on the Watcher is true
    }
    if (p.kind === "later") {
      if (did.has("schedule_check") || did.has("add_watch_level") || did.has("propose_action")) return false;
      // Real today without a tool: a protected trade's stop / wrong-if / TP1 alerts, and auto-close's position check.
      if (ctx.protectedTrade && /\b(stop|wrong[- ]?if|tp ?1|target|alert)\b/i.test(s)) return false;
      if (ctx.protectedTrade && ctx.autoClose && /\bclose\b/i.test(s) && /\b(if|when)\b/i.test(s)) return false;
      return true;
    }
    // "done": a matching write must have worked in this reply. A card is NOT a placed order.
    if (/placed|order (is|are)/i.test(s)) return !(did.has("close_position"));
    if (/scheduled|check/i.test(s)) return !did.has("schedule_check");
    if (/alert|stop/i.test(s)) return !(ctx.protectedTrade || did.has("propose_action") || did.has("add_watch_level"));
    if (/saved/i.test(s)) return !did.has("save_house_rule");
    if (/logged/i.test(s)) return !did.has("log_practice_trade");                                    // v3.37
    if (/closed/i.test(s)) return !did.has("close_position");
    return !(did.has("add_watch_level") || did.has("schedule_check") || did.has("propose_action") || did.has("save_house_rule") || did.has("close_position") || did.has("log_practice_trade"));
  });
}
export async function promiseContext(did: string[], failed: string[]) {
  const day = etParts().date;
  const [prot, L, w] = await Promise.all([
    db("otto_actions?" + OQ() + "select=id&exit->>state=eq.armed&limit=1").catch(() => []),
    getLimits().catch(() => LIMIT_DEFAULTS),
    db(`otto_watch?select=ticker&day=eq.${day}&status=eq.watching&limit=50`).catch(() => []),
  ]);
  return { did, failed, protectedTrade: !!(prot || []).length, autoClose: !!L.auto_close, watchToday: [...new Set((w || []).map((r: any) => String(r.ticker)))] as string[] };
}
export const correctionPrompt = (bad: { sentence: string }[], ctx: any) =>
  `[OTTO SERVER CHECK — not from Ifoma or Josh] Your reply made ${bad.length === 1 ? "a promise" : "promises"} that nothing running backs:\n` +
  bad.map((b) => `- "${b.sentence}"`).join("\n") +
  `\nThis reply's tools that worked: ${ctx.did.join(", ") || "none"}${ctx.failed.length ? "; FAILED: " + ctx.failed.join(", ") : ""}. You do not watch the market between messages.\n` +
  `Fix it now, one way or the other: (a) make it real — schedule_check for a timed look, add_watch_level for a price level — then confirm in ONE line; or (b) take it back in ONE or TWO lines starting "Correction:", saying plainly what you can't do and what WILL alert them (the RUNNING RIGHT NOW list). No other text.`;
async function promiseTally(made: number, bad: number) {
  try {
    const day = etParts().date;
    const cur = (await setting("promise_day").catch(() => null)) || {};
    const v = cur.day === day ? cur : { day, made: 0, backed: 0, corrected: 0 };
    v.made += made; v.backed += made - bad; v.corrected += bad;
    await putSetting("promise_day", v, "jarvis");
  } catch { /* a tally never breaks the Desk */ }
}
// After a Desk run: check the final words; if anything is unbacked, one correction round (streamed after the reply).
export async function enforcePromises(r: { said: string; finalText: string; did: string[]; failed: string[] }, rerun: (extra: string) => Promise<{ said: string; did: string[] }>) {
  const promises = findPromises(r.finalText);
  if (!promises.length) return { added: "", bad: [] as any[], fallback: false };
  const ctx = await promiseContext(r.did, r.failed);
  const bad = unbacked(promises, ctx);
  await promiseTally(promises.length, bad.length);
  if (!bad.length) return { added: "", bad, fallback: false };
  const fix = await rerun(correctionPrompt(bad, ctx)).catch(() => null);
  let added = (fix?.said || "").trim(), fallback = false;
  // If the correction itself still promises without a tool, say it plainly ourselves.
  if (!added || unbacked(findPromises(added), { ...ctx, did: [...ctx.did, ...(fix?.did || [])] }).length) {
    added = "Correction: I can't watch the market between messages. What will actually alert you is in the Watcher, your trade's stop and alerts, and any ⏰ check-in on the Desk — ask me to set one if you want a timed look.";
    fallback = true;
  }
  return { added, bad, fallback };
}

/* ---------------------------------------------------------------- Signals: the pre-fetch, the read fallback, results */
export async function signalPrefetch(rows: any[]): Promise<string> {
  const calls = rows.filter((r: any) => r.ticker && (r.kind === "call" || r.kind === "level")).slice(0, 2);
  const parts = await Promise.all(calls.map(async (r: any) => {
    const sides: ("call" | "put")[] = r.direction === "long" ? ["call"] : r.direction === "short" ? ["put"] : ["call", "put"];
    const out = await Promise.all(sides.map((s) => withTimeout(optionShortlist(r.ticker, s), 25_000, "shortlist " + r.ticker).then((x) => x.text, (e) => `${r.ticker} ${s}s: couldn't pre-fetch (${String((e as Error).message).slice(0, 100)}) — look it up yourself.`)));
    return out.join("\n\n");
  }));
  return parts.filter(Boolean).join("\n\n");
}
export function readFallback(all: any[], cards: string[], why: string) {
  const posts = all.filter((r: any) => r.ticker).map((r: any) => `${r.ticker}${r.direction ? " " + r.direction : ""} ${r.kind} at ${r.posted_label || "?"}: "${String(r.words || "").slice(0, 120)}"`);
  return `${posts.join("\n") || "Signal post."}\n${cards.length ? "Card ready — open it on the Desk." : "No card: " + why}`;
}

/* ---------------------------------------------------------------- every card gets its ping (code review 6 Oct) */
// Signal / alert / Watcher cards ping after Jarvis's run ends. If the server cut the run off after the card was
// made, nobody was told. Every ping now marks the card; the minute timer pings any card still unmarked after 3 min.
export async function markPinged(ids: string[]) {
  const list = (ids || []).filter(Boolean);
  if (!list.length) return;
  await db("otto_actions?id=in.(" + list.join(",") + ")", { method: "PATCH", headers: { prefer: "return=minimal" }, body: JSON.stringify({ pinged_at: new Date().toISOString() }) }).catch(() => {});
}
export async function cardSweep(now = Date.now()) {
  const rows = await db(`otto_actions?${OQ()}select=id,title,created_by,created_at&status=eq.pending&pinged_at=is.null&created_at=gte.${new Date(now - 20 * 60e3).toISOString()}&created_at=lt.${new Date(now - 3 * 60e3).toISOString()}&limit=10`).catch(() => []);
  for (const a of rows || []) {
    const claimed = await db(`otto_actions?id=eq.${a.id}&pinged_at=is.null&select=id`, { method: "PATCH", body: JSON.stringify({ pinged_at: new Date(now).toISOString() }) }).catch(() => []);
    if (!claimed?.length) continue;
    await notify("card", `🃏 Card waiting: ${unname(String(a.title)).slice(0, 80)}`, "Its ping was missed (the run was cut off). Tap to Approve or Reject before it expires.");
  }
}

/* ---------------------------------------------------------------- Signal results ("$1000 for 2 PUTS ON MU") */
// v3.16: the coach's result posts are linked to his call of the same ticker that day, so his calls get a real
// scoreboard later (which calls work, how fast). Never a card, never a ping.
export async function linkResults(rows: any[]) {
  for (const r of rows || []) {
    if (r?.kind !== "result" || !r.ticker || r.result_for) continue;
    const callRow = (await db(`otto_jason?select=id&day=eq.${r.day}&ticker=eq.${encodeURIComponent(r.ticker)}&kind=eq.call&order=id.desc&limit=1`).catch(() => []))?.[0];
    if (callRow) await db(`otto_jason?id=eq.${r.id}`, { method: "PATCH", headers: { prefer: "return=minimal" }, body: JSON.stringify({ result_for: callRow.id }) }).catch(() => {});
  }
}

/* ---------------------------------------------------------------- daily Signal self-test (9:10 ET) */
// Ifoma, 7 Oct: automatic every trading day; ✅/❌ on the Desk; phones pinged only on ❌.
// Tests each link a real signal uses, with a canned post — nothing is stored as a signal and no real card is made.
export async function signalSelfTest(force = false) {
  const c = marketClock();
  if (!force) {
    if (!isTradingDay(c.date)) return { ok: true, skipped: "not a trading day" };
    const s = await setting("selftest_day").catch(() => null);
    if (s?.day === c.date) return { ok: true, skipped: "already ran" };
    await putSetting("selftest_day", { day: c.date, at: new Date().toISOString() }, "cron").catch(() => {});
  }
  const t0 = Date.now(), steps: { name: string; ok: boolean; ms: number; note: string }[] = [];
  const step = async (name: string, f: () => Promise<string>) => {
    const t = Date.now();
    try { const note = await f(); steps.push({ name, ok: true, ms: Date.now() - t, note }); }
    catch (e) { steps.push({ name, ok: false, ms: Date.now() - t, note: String((e as Error).message || e).slice(0, 220) }); }
  };
  await step("Discord watcher heartbeat", async () => {
    const b = await setting("signal_beat").catch(() => null);
    if (!b?.at) throw new Error("never heard from the watcher");
    const age = Math.round((Date.now() - Date.parse(b.at)) / 1000);
    if (age > 180) throw new Error(`last heartbeat ${Math.round(age / 60)} min ago — is the Engineer PC awake?`);
    if (b.state !== "ok") throw new Error(`watcher says "${b.state}"${b.detail ? ": " + b.detail : ""}`);
    if (b.queue_age > 120) throw new Error(`${b.queue} post(s) stuck in the watcher's queue`);
    return `ok, ${age}s ago`;
  });
  let posts: any[] = [];
  await step("Reading a post", async () => {
    posts = await sigExtract(Deno.env.get("ANTHROPIC_KEY") || "", "the coach", `NEW:\n[${fmtMin(c.min)}] SPY LONG\n[${fmtMin(c.min)}] @Platinum Members`, [], c.date);
    const p = posts.find((x: any) => x.kind === "call" && x.ticker === "SPY");
    if (!p) throw new Error("the test post wasn't read as a SPY call");
    return "SPY call read";
  });
  let pre = "";
  await step("Contract shortlist", async () => {
    const sl = await withTimeout(optionShortlist("SPY", "call"), 30_000, "shortlist");
    pre = sl.text;
    if (!sl.rows.length) throw new Error("no SPY contracts listed");
    return `${sl.rows.length} contracts, best ${sl.best?.label || "none in band"}, fits ${sl.bestFit?.label || "nothing fits"}`;
  });
  await step("Jarvis builds the card (dry run, one step)", async () => {
    if (!pre) throw new Error("skipped — no shortlist");
    // v3.23: the same path a live Signal takes — fast setup, everything pre-fetched, one forced step.
    const [{ cs, sys, tools, ctxLine }, pack] = await Promise.all([deskSetup({ fast: true }), signalPack({ ticker: "SPY", direction: "long" })]);
    const prompt = `${ctxLine}\n[SELF-TEST — not a real signal. The coach posted "SPY LONG". It will NOT be stored.]\n${ONE_STEP_RULE}\n${pack || pre}`;
    const res = await runDesk({ msgs: [{ role: "user", content: prompt }], sys, tools: [signalProposeTool(tools)], cs,
      who: "selftest", send: () => {}, allowPropose: true, allowClose: false, maxRounds: 2, mustCard: true, oneStep: true, dryRun: true, deadline: Date.now() + 60_000 });
    if (!res.dry?.length) throw new Error(res.failed.includes("propose_action") ? "the card was malformed — " + (res.errors || []).slice(-1)[0] : "no card was made");
    if (!res.cardRead) throw new Error("the card came without its read");
    return String(res.dry[0].title || "card ok").slice(0, 80);
  });
  const total = Math.round((Date.now() - t0) / 1000);
  // v3.23: over the 30 s target is a failed self-test (Ifoma, 8 Oct).
  steps.push({ name: `Speed (target ${SIGNAL_TARGET_S}s)`, ok: total <= SIGNAL_TARGET_S, ms: Date.now() - t0, note: total <= SIGNAL_TARGET_S ? `${total}s` : `${total}s — slower than the ${SIGNAL_TARGET_S}s target` });
  const ok = steps.every((x) => x.ok), secs = total;
  const text = `${ok ? "✅" : "❌"} Signal self-test ${fmtMin(c.min)} ET — ${ok ? `all good, post → card in ${secs}s` : "FAILED"}\n` +
    steps.map((x) => `${x.ok ? "✓" : "✗"} ${x.name} (${(x.ms / 1000).toFixed(1)}s): ${x.note}`).join("\n");
  await logDesk("system", "Otto", text);
  await putSetting("selftest_last", { at: new Date().toISOString(), ok, secs, steps }, "cron").catch(() => {});
  if (!ok) await notify("watcher", "❌ Signal self-test failed", steps.filter((x) => !x.ok).map((x) => `${x.name}: ${x.note}`).join(" · ").slice(0, 250), "./#desk");
  return { ok, secs, steps };
}

// v3.16: the recap reports Jarvis's promises (made / backed / corrected) and every Signal's post → card time.
export async function recapExtras(day: string) {
  const pr = await setting("promise_day").catch(() => null);
  const bs = await db(`otto_signal_batches?select=id,status,cards,timing,error&day=eq.${day}&order=id.asc&limit=40`).catch(() => []);
  const sig = (bs || []).filter((b: any) => b.timing).map((b: any) => `- batch ${b.id}: ${(b.cards || []).length} card(s), post → card ${b.timing.total_ms != null ? Math.round(b.timing.total_ms / 1000) + "s" : "?"}${b.error ? " — " + b.error : ""}`);
  const st = await setting("selftest_last").catch(() => null);
  const apT = await apTrades(day).catch(() => []);   // v5.9
  return (apT.length ? `OTTOPILOT (today): ${apRecap(apT)}\nGive OttoPilot its own line in the recap, separate from the trades Josh approved himself.\n` : "") + `JARVIS PROMISES (today): ${pr?.day === day ? `${pr.made} made, ${pr.backed} backed, ${pr.corrected} corrected by the server check` : "none checked"}\n` +
    `SIGNAL SELF-TEST: ${st?.at && etParts(new Date(st.at)).date === day ? (st.ok ? `passed (${st.secs}s)` : "FAILED") : "did not run"}\n` +
    `SIGNAL CARD TIMES (today):\n${sig.join("\n") || "(no signal cards built)"}\nPut one line in the recap: promises made/backed/corrected and the signal timings.`;
}

/* ============================================================ v3.18 (7 Oct 2026)
   Approved mockup otto-v3.18-mockup.html ("Yes, approved: build v3.18"; keep "Copy for coach").
   🌅 Morning Prep: Ifoma and Josh each post their morning sentiment read (charts + the notes they send the
   coach). Jarvis asks 2–3 clarifying questions FIRST, then grades (letter + process / levels / plan, strong /
   fix / missing, tied to the Otto Rules). Levels he reads come back with one-tap "+ Watcher". At 4:05 PM ET each
   read is graded against the tape (direction right / wrong / flat, levels touched). Plus the Score additions
   (signal speed, the coach's calls) — read-only views over data v3.16 already records. */

const PREP_AUTHORS = new Set(["Ifoma", "Josh"]);
const prepAuthor = (a: any) => PREP_AUTHORS.has(String(a)) ? String(a) : "Ifoma";

// One forced tool call; returns the tool input. Streams through claudeFetch (so tests and retries behave the same).
async function claudeTool(body: any, toolName: string, budgetMs = 90_000): Promise<any> {
  const r = await claudeFetch({ _tag: "tool:" + toolName, ...body, stream: true, tool_choice: { type: "tool", name: toolName } }, Date.now() + budgetMs);
  const reader = r.body!.getReader(), dec = new TextDecoder();
  let buf = "", json = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let i;
    while ((i = buf.indexOf("\n\n")) >= 0) {
      const chunk = buf.slice(0, i); buf = buf.slice(i + 2);
      const line = chunk.split("\n").find((l) => l.startsWith("data: "));
      if (!line) continue;
      try { const ev = JSON.parse(line.slice(6)); if (ev.type === "content_block_delta" && ev.delta?.type === "input_json_delta") json += ev.delta.partial_json; } catch { /* */ }
    }
  }
  try { return JSON.parse(json || "{}"); } catch { throw new Error("Jarvis's answer couldn't be read — try again"); }
}

const PREP_LEVEL = { type: "object", properties: {
  ticker: { type: "string" }, level: { type: "number" }, dir: { type: "string", enum: ["up", "down", "both"], description: "up = calls side (break above / hold above), down = puts side (break below / rejection)" },
  note: { type: "string", description: "a few words: what the level is (gap top, order-block low…)" } }, required: ["ticker", "level", "dir"] };
const PREP_ASK_TOOL = { name: "prep_questions", description: "Ask the trader 2-3 clarifying questions about their morning read before grading it, and record what you read from it.",
  input_schema: { type: "object", properties: {
    questions: { type: "array", minItems: 2, maxItems: 3, items: { type: "string" }, description: "Short, specific questions that make them sharper: what proves them wrong, which level is which, the catalyst, the target, the first-30-minutes plan. Never answer them yourself." },
    bias: { type: "string", enum: ["long", "short", "neutral"], description: "Their overall lean, as THEY wrote it (not yours)." },
    main: { type: "string", description: "The main ticker of the read, usually SPY." },
    levels: { type: "array", maxItems: 8, items: PREP_LEVEL, description: "Every price level they marked in the notes or on the charts (numbers only if written or clearly labelled)." } },
    required: ["questions", "bias", "main", "levels"] } };
const PREP_GRADE_TOOL = { name: "prep_grade", description: "Grade the morning read after their answers.",
  input_schema: { type: "object", properties: {
    letter: { type: "string", enum: ["A+", "A", "A-", "B+", "B", "B-", "C+", "C", "C-", "D", "F"] },
    process: { type: "integer", minimum: 0, maximum: 10 }, levels_score: { type: "integer", minimum: 0, maximum: 10 }, plan: { type: "integer", minimum: 0, maximum: 10 },
    strong: { type: "array", maxItems: 3, items: { type: "string" }, description: "What they did right, citing the Otto Rules (call date) or a Playbook rule id when it applies." },
    fix: { type: "array", maxItems: 3, items: { type: "string" }, description: "The most important things to fix today." },
    missing: { type: "array", maxItems: 3, items: { type: "string" }, description: "What the read leaves out (target, invalidation, catalyst, timing)." },
    levels: { type: "array", maxItems: 8, items: PREP_LEVEL, description: "The final list of their levels (corrected with their answers)." } },
    required: ["letter", "process", "levels_score", "plan", "strong", "fix", "missing", "levels"] } };

const PREP_SYS = (author: string) => `You are Jarvis, coaching ${author}'s MORNING SENTIMENT READ before the open, inside Otto Trader. Your job is to make them a sharper trader, not to hand them your own read.
- Judge their read against the Otto Rules (the coaching-call method below) and the live context line (clock, banner, prices). Quote rules in your own words with the call date when you use one.
- Be direct and specific, plain words, no jargon they haven't used. Short lines. Don't flatter; say what's weak.
- Never invent prices or levels. Levels come only from their notes or numbers clearly labelled on their charts.
- Their lean is THEIRS: grade the reasoning (inputs, levels, invalidation, catalyst, plan, timing), not whether you agree.
- Never write the coach's name.`;

async function prepContext(notes: string) {
  const calls = await loadBrain();
  const cs = chunksOf(calls);
  const hits = search(cs, notes, 8).map(fmt).join("\n\n").slice(0, 9000);
  const sys = DESK_SYS.replace("{{RULES}}", alwaysOn(calls));
  const sent = await settle(sentimentNow());
  const banner = sent.ok ? `Banner: ${sent.v.verdict} (score ${sent.v.score}, ${sent.v.fresh}/${sent.v.total} legs fresh).` : "Banner: unavailable.";
  const live = marketClock().line + "\n" + banner + "\n\n" + await houseRulesText().catch(() => "") + "\n\n" + await playbookText().catch(() => "");
  return { sys, live, hits };
}
const prepImgs = async (id: number) => (await db(`otto_prep_imgs?select=mime,data&prep_id=eq.${id}&order=id.asc&limit=6`).catch(() => [])) || [];
const imgBlocks = (imgs: any[]) => imgs.slice(0, 6).map((i: any) => ({ type: "image", source: { type: "base64",
  media_type: /^image\/(jpeg|png|webp|gif)$/.test(i.mime) ? i.mime : "image/jpeg", data: i.data } }));

export async function prepSubmit(b: any) {
  const author = prepAuthor(b.author);
  const notes = String(b.notes || "").trim().slice(0, 6000);
  const imgs = (Array.isArray(b.images) ? b.images : []).filter((i: any) => typeof i?.data === "string" && i.data.length > 100 && i.data.length < 6_000_000).slice(0, 6);
  if (!notes && !imgs.length) throw new Error("Add your notes or a chart first.");
  const day = etParts().date;
  // One read per person per day: a new submit starts the conversation over.
  const old = (await db(`otto_prep?select=id&day=eq.${day}&author=eq.${author}`).catch(() => []))?.[0];
  if (old) {
    await db(`otto_prep_imgs?prep_id=eq.${old.id}`, { method: "DELETE", headers: { prefer: "return=minimal" } }).catch(() => {});
    await db(`otto_prep?id=eq.${old.id}`, { method: "DELETE", headers: { prefer: "return=minimal" } }).catch(() => {});
  }
  const row = (await db("otto_prep", { method: "POST", body: JSON.stringify({ day, author, notes, imgs: imgs.length, status: "asking", thread: [] }) }))?.[0];
  if (!row?.id) throw new Error("couldn't save the read");
  if (imgs.length) await db("otto_prep_imgs", { method: "POST", headers: { prefer: "return=minimal" },
    body: JSON.stringify(imgs.map((i: any) => ({ prep_id: row.id, mime: String(i.mime || "image/jpeg").slice(0, 30), data: i.data }))) });
  const { sys, live, hits } = await prepContext(notes);
  const content: any[] = [...imgBlocks(imgs), { type: "text", text: `${author}'s morning read (${imgs.length} chart${imgs.length === 1 ? "" : "s"} above).\n\nNOTES:\n${notes || "(no notes — read the charts)"}\n\nOTTO RULES THAT MATCH THE NOTES:\n${hits || "(none found)"}\n\nAsk your 2-3 questions now. Don't grade yet.` }];
  const a = await claudeTool({ model: MODEL, max_tokens: 1500, system: [{ type: "text", text: sys + NAME_RULE }, { type: "text", text: PREP_SYS(author) + "\n\n" + live }],
    tools: [PREP_ASK_TOOL], messages: [{ role: "user", content }] }, "prep_questions");
  const qs = (Array.isArray(a.questions) ? a.questions : []).map((q: any) => unname(String(q)).slice(0, 400)).filter(Boolean).slice(0, 3);
  if (!qs.length) throw new Error("Jarvis didn't ask anything — send it again");
  const thread = [{ role: "jarvis", at: new Date().toISOString(), kind: "questions", questions: qs }];
  const upd = { status: "asked", thread, bias: ["long", "short", "neutral"].includes(a.bias) ? a.bias : "neutral",
    main: String(a.main || "SPY").toUpperCase().replace(/[^A-Z.]/g, "").slice(0, 8) || "SPY", levels: cleanLevels(a.levels) };
  await db(`otto_prep?id=eq.${row.id}`, { method: "PATCH", headers: { prefer: "return=minimal" }, body: JSON.stringify(upd) });
  return { ok: true, prep: { ...row, ...upd } };
}
function cleanLevels(l: any): any[] {
  return (Array.isArray(l) ? l : []).map((x: any) => ({ ticker: String(x?.ticker || "").toUpperCase().replace(/[^A-Z.]/g, "").slice(0, 8),
    level: Number(x?.level), dir: ["up", "down", "both"].includes(x?.dir) ? x.dir : "both", note: String(x?.note || "").slice(0, 80) }))
    .filter((x: any) => x.ticker && x.level > 0).slice(0, 8);
}

export async function prepReply(b: any) {
  const id = Number(b.id), text = String(b.text || "").trim().slice(0, 4000);
  if (!id || !text) throw new Error("nothing to send");
  const row = (await db(`otto_prep?select=*&id=eq.${id}`))?.[0];
  if (!row) throw new Error("that read wasn't found");
  const author = row.author;
  const thread: any[] = [...(row.thread || []), { role: "user", author, at: new Date().toISOString(), text }];
  const { sys, live, hits } = await prepContext(row.notes + "\n" + text);
  const imgs = await prepImgs(id);
  const convo = thread.map((t: any) => t.role === "user" ? `${t.author}: ${t.text}` : t.kind === "questions" ? `Jarvis asked:\n${t.questions.map((q: string, i: number) => `${i + 1}. ${q}`).join("\n")}`
    : t.kind === "grade" ? `Jarvis graded it ${t.grade?.letter}.` : `Jarvis: ${t.text}`).join("\n\n");
  const head = [...imgBlocks(imgs), { type: "text", text: `${author}'s morning read.\n\nNOTES:\n${row.notes || "(none)"}\n\nOTTO RULES THAT MATCH:\n${hits || "(none)"}\n\nCONVERSATION SO FAR:\n${convo}` }];
  const system = [{ type: "text", text: sys + NAME_RULE }, { type: "text", text: PREP_SYS(author) + "\n\n" + live }];
  let upd: any;
  if (row.status !== "graded") {
    const g = await claudeTool({ model: MODEL, max_tokens: 2000, system, tools: [PREP_GRADE_TOOL],
      messages: [{ role: "user", content: [...head, { type: "text", text: "They've answered. Grade the read now." }] }] }, "prep_grade");
    const L = (v: any) => (Array.isArray(v) ? v : []).map((s: any) => unname(String(s)).slice(0, 400)).filter(Boolean).slice(0, 3);
    const grade = { letter: String(g.letter || "C"), process: +g.process || 0, levels: +g.levels_score || 0, plan: +g.plan || 0, strong: L(g.strong), fix: L(g.fix), missing: L(g.missing) };
    const keep = new Map((row.levels || []).map((x: any) => [`${x.ticker}|${x.level}`, x]));
    const levels = cleanLevels(g.levels).map((x: any) => ({ ...x, ...(keep.get(`${x.ticker}|${x.level}`) as any || {}), dir: x.dir }));
    thread.push({ role: "jarvis", at: new Date().toISOString(), kind: "grade", grade });
    upd = { status: "graded", thread, grade, levels: levels.length ? levels : row.levels };
  } else {
    const t = await claudeText({ model: MODEL, max_tokens: 900, system, messages: [{ role: "user", content: [...head, { type: "text", text: "Answer their last message in a few short lines. Coach, don't re-grade." }] }] });
    thread.push({ role: "jarvis", at: new Date().toISOString(), kind: "text", text: unname(t).slice(0, 3000) });
    upd = { thread };
  }
  await db(`otto_prep?id=eq.${id}`, { method: "PATCH", headers: { prefer: "return=minimal" }, body: JSON.stringify(upd) });
  return { ok: true, prep: { ...row, ...upd } };
}

export async function prepWatch(b: any, who: string) {
  const id = Number(b.id), i = Number(b.idx);
  const row = (await db(`otto_prep?select=*&id=eq.${id}`))?.[0];
  if (!row) throw new Error("that read wasn't found");
  const levels = [...(row.levels || [])];
  const x = levels[i];
  if (!x) throw new Error("that level wasn't found");
  if (row.day !== etParts().date) throw new Error("levels can only be watched on the day of the read");
  const w = await watchAdd({ ticker: x.ticker, level: x.level, dir: x.dir, source: "desk", note: `${row.author}'s morning read${x.note ? ": " + x.note : ""}`, by: `${row.author} · Morning Prep` });
  levels[i] = { ...x, watched: true, watch_id: w?.id ?? null };
  await db(`otto_prep?id=eq.${id}`, { method: "PATCH", headers: { prefer: "return=minimal" }, body: JSON.stringify({ levels }) });
  if (w) await logDesk("system", "Otto", `👁 Watching ${x.ticker} ${x.level} ${x.dir === "up" ? "▲" : x.dir === "down" ? "▼" : "▲▼"} today (from ${row.author}'s morning read).`);
  void who;
  return { ok: true, levels };
}

// 4:05 PM ET: grade today's reads against the tape (Robinhood 5-minute bars, 9:30–4:00).
export function gradeRead(bias: string, main: Bar[], levels: any[], barsBy: Record<string, Bar[]>) {
  if (!main.length) return null;
  const open = main[0].o, close = main[main.length - 1].c;
  const chg = (close - open) / open * 100;
  const flatDay = Math.abs(chg) < 0.15;
  const direction = bias === "neutral" ? (flatDay ? "right" : "wrong") : flatDay ? "flat" : ((chg > 0) === (bias === "long") ? "right" : "wrong");
  const lv = (levels || []).map((x: any) => {
    const bars = barsBy[x.ticker] || [];
    if (!bars.length) return { ...x, touched: null };
    const hi = Math.max(...bars.map((b) => b.h)), lo = Math.min(...bars.map((b) => b.l));
    const touched = x.level <= hi && x.level >= lo;
    const first = bars[0].o, last = bars[bars.length - 1].c;
    const broke = touched && ((first > x.level && last < x.level) || (first < x.level && last > x.level));
    return { ticker: x.ticker, level: x.level, dir: x.dir, touched, broke };
  });
  const scored = lv.filter((x: any) => x.touched !== null);
  return { direction, chg: +chg.toFixed(2), open: +open.toFixed(2), close: +close.toFixed(2), levels: lv,
    touched: scored.filter((x: any) => x.touched).length, of: scored.length };
}
export async function prepGradeTick(force = false) {
  const c = marketClock();
  if (!force && (!isTradingDay(c.date) || c.min < 965)) return { ok: true, skipped: "after 4:05 PM on trading days" };
  const rows = await db(`otto_prep?select=id,author,bias,main,levels,result,plan&day=eq.${c.date}&result=is.null`).catch(() => []);
  if (!rows?.length) return { ok: true, graded: 0 };
  const start = nyIso(c.date, "9:30 AM")!, end = nyIso(c.date, "4:00 PM")!;
  const tickers = [...new Set(rows.flatMap((r: any) => [r.main || "SPY", ...(r.levels || []).map((x: any) => x.ticker), ...(r.plan ? [r.plan.ticker] : [])]))] as string[];
  const trades = rows.some((r: any) => r.plan) ? await openingTradesToday().catch(() => null) : null;   // v3.19
  const bars = await rhBars(tickers, "5minute", start, end);
  for (const t of Object.keys(bars)) bars[t] = bars[t].filter((b) => b.t >= Date.parse(start) && b.t < Date.parse(end));
  let n = 0;
  for (const r of rows) {
    const res: any = gradeRead(r.bias || "neutral", bars[(r.main || "SPY").toUpperCase()] || [], r.levels || [], bars);
    if (!res) continue;
    if (r.plan) res.plan = { ...planVsTape(r.plan, bars[r.plan.ticker] || []), ...(trades ? planAdherence(r.plan, trades) : { adherence: "unknown", traded: [] }) };   // v3.19
    await db(`otto_prep?id=eq.${r.id}`, { method: "PATCH", headers: { prefer: "return=minimal" }, body: JSON.stringify({ result: res }) }).catch(() => {});
    n++;
  }
  return { ok: true, graded: n };
}

export async function prepGet(author: string) {
  const day = etParts().date;
  const a = prepAuthor(author);
  const today = (await db(`otto_prep?select=id,day,author,created_at,notes,imgs,status,thread,bias,main,levels,grade,result,plan&day=eq.${day}&author=eq.${a}`).catch(() => []))?.[0] || null;
  const hist = await db(`otto_prep?select=id,day,author,bias,main,levels,grade,result,notes,plan&order=day.desc&limit=60`).catch(() => []);
  const stats: Record<string, any> = {};
  for (const who of PREP_AUTHORS) {
    const mine = (hist || []).filter((r: any) => r.author === who && r.result).slice(0, 20);
    const right = mine.filter((r: any) => r.result.direction === "right").length;
    const lt = mine.reduce((s: number, r: any) => s + (r.result.touched || 0), 0), lof = mine.reduce((s: number, r: any) => s + (r.result.of || 0), 0);
    stats[who] = { n: mine.length, right, touched: lt, of: lof };
  }
  const imgs = today ? (await db(`otto_prep_imgs?select=id&prep_id=eq.${today.id}&order=id.asc`).catch(() => [])).map((x: any) => x.id) : [];
  return { ok: true, day, author: a, today: today ? { ...today, img_ids: imgs } : null,
    history: (hist || []).filter((r: any) => r.author === a).slice(0, 20).map((r: any) => ({ ...r, notes: String(r.notes || "").slice(0, 160) })), stats };
}
export async function prepImg(id: number) {
  const r = (await db(`otto_prep_imgs?select=mime,data&id=eq.${id}`))?.[0];
  if (!r) throw new Error("image not found");
  return { ok: true, mime: r.mime, data: r.data };
}

// Score page additions: Signal speed (v3.16 timings), the coach's calls (scored to the close), self-test.
export async function scoreExtra() {
  const since = new Date(Date.now() - 21 * 864e5).toISOString();
  const bs = await db(`otto_signal_batches?select=id,created_at,status,cards,timing,error,rows,msg_ids&created_at=gte.${since}&order=id.desc&limit=80`).catch(() => []);
  const rowIds = [...new Set((bs || []).flatMap((b: any) => b.rows || []))];
  const jr = rowIds.length ? await db(`otto_jason?select=id,ticker,direction,kind,words&id=in.(${rowIds.join(",")})`).catch(() => []) : [];
  const jById: Record<string, any> = Object.fromEntries((jr || []).map((r: any) => [r.id, r]));
  const speed = (bs || []).filter((b: any) => (b.rows || []).some((id: any) => ["call", "level"].includes(jById[id]?.kind) && jById[id]?.ticker)).slice(0, 12).map((b: any) => {
    const r = (b.rows || []).map((id: any) => jById[id]).find((x: any) => x && ["call", "level"].includes(x.kind)) || {};
    const t = b.timing || {};
    const posted = t.posted ? Date.parse(t.posted) : null, caught = Date.parse(b.created_at);
    return { at: t.posted || b.created_at, ticker: r.ticker, direction: r.direction, words: String(r.words || "").slice(0, 80),
      caught_s: posted ? Math.max(0, Math.round((caught - posted) / 1000)) : null, card_s: t.total_ms != null ? Math.round(t.total_ms / 1000) : null,
      cards: (b.cards || []).length, status: b.status, why: b.error || null, timed: !!b.timing };
  });
  const timed = speed.filter((s: any) => s.timed);
  const cardTimes = timed.filter((s: any) => s.cards && s.card_s != null).map((s: any) => s.card_s).sort((a: number, b: number) => a - b);
  const calls = await db(`otto_jason?select=id,ticker,direction,score,day&kind=eq.call&order=day.desc&limit=200`).catch(() => []);
  const results = await db(`otto_jason?select=result_for,words&kind=eq.result&order=id.desc&limit=100`).catch(() => []);
  const resBy: Record<string, string[]> = {};
  for (const r of results || []) if (r.result_for) (resBy[r.result_for] ||= []).push(String(r.words).slice(0, 60));
  const byT: Record<string, any> = {};
  for (const c of calls || []) {
    if (!c.ticker) continue;
    const t = (byT[c.ticker] ||= { ticker: c.ticker, n: 0, scored: 0, worked: 0, sum: 0, best: 0, results: [] as string[] });
    t.n++;
    if (c.score && c.score.state !== "unscored") { t.scored++; if (c.score.state === "worked") t.worked++; t.sum += +c.score.close_pct || 0; t.best += +c.score.best_pct || 0; }
    if (resBy[c.id]) t.results.push(...resBy[c.id]);
  }
  const coach = Object.values(byT).map((t: any) => ({ ticker: t.ticker, n: t.n, scored: t.scored, worked: t.worked,
    avg_close: t.scored ? +(t.sum / t.scored).toFixed(2) : null, avg_best: t.scored ? +(t.best / t.scored).toFixed(2) : null, results: t.results.slice(0, 3) }))
    .sort((a: any, b: any) => b.n - a.n).slice(0, 12);
  const st = await setting("selftest_last").catch(() => null);
  const prep = (await prepGet("Ifoma").catch(() => null))?.stats || null;
  return { ok: true, speed, median_card_s: cardTimes.length ? cardTimes[Math.floor(cardTimes.length / 2)] : null,
    timed_calls: timed.length, silent: timed.filter((s: any) => !s.cards && !s.why).length, coach, selftest: st, prep };
}

/* ============================================================ v3.19 (7 Oct 2026)
   Ifoma, after Josh's first read (B-: "pick ONE ticker, name the timeframe, no wrong-if"): "build" Lock today's plan.
   After the grade the trader locks four things — the one ticker + side, the entry trigger (level, how, timeframe),
   the wrong-if and the target. Jarvis checks just those (pass / fix, not a re-grade); locking pins the plan on the
   Desk all day and puts the entry level on the Watcher. At 4:05 PM the plan is checked against the tape (trigger hit?
   target or wrong-if first?) and against the Agentic account's opening trades today (on plan / off plan / none). */
const PLAN_CHECK_TOOL = { name: "plan_check", description: "Check a locked trading plan.",
  input_schema: { type: "object", properties: {
    ok: { type: "boolean", description: "true when the plan is complete and consistent: the wrong-if is on the losing side of the entry, the target on the winning side, the timeframe named, and it fits the Otto Rules." },
    fixes: { type: "array", maxItems: 3, items: { type: "string" }, description: "Only what must change, one short line each. Empty when ok." },
    note: { type: "string", description: "One short line for the pinned plan (e.g. risk:reward, or the Otto Rule it follows)." } }, required: ["ok", "fixes", "note"] } };

export function planValidate(p: any) {
  const ticker = String(p?.ticker || "").toUpperCase().replace(/[^A-Z.]/g, "").slice(0, 8);
  const side = p?.side === "puts" ? "puts" : p?.side === "calls" ? "calls" : "";
  const how = ["break", "hold", "reject"].includes(p?.how) ? p.how : "";
  const tf = ["5m", "10m", "15m"].includes(p?.tf) ? p.tf : "";
  const entry = Number(p?.entry), wrong = Number(p?.wrong_if), target = Number(p?.target);
  const miss: string[] = [];
  if (!ticker) miss.push("the ticker");
  if (!side) miss.push("calls or puts");
  if (!(entry > 0)) miss.push("the entry level");
  if (!how) miss.push("how it triggers (break / hold / reject)");
  if (!tf) miss.push("the candle timeframe");
  if (!(wrong > 0)) miss.push("the wrong-if price");
  if (!(target > 0)) miss.push("the target price");
  if (miss.length) return { ok: false, error: "Fill in " + miss.join(", ") + "." };
  // Calls: target above the entry, wrong-if below it. Puts: the mirror.
  const up = side === "calls";
  if (up ? !(target > entry && wrong < entry) : !(target < entry && wrong > entry))
    return { ok: false, error: up ? "For calls the target must be above the entry and the wrong-if below it." : "For puts the target must be below the entry and the wrong-if above it." };
  const rr = Math.abs(target - entry) / Math.abs(entry - wrong);
  return { ok: true, plan: { ticker, side, entry, how, tf, wrong_if: wrong, target, rr: +rr.toFixed(2), why: String(p?.why || "").slice(0, 300) } };
}
export const planLine = (p: any) => `${p.ticker} ${p.side} · entry ${p.how} ${p.entry} on a ${p.tf} close · wrong if ${p.wrong_if} · target ${p.target} · R:R ${p.rr}`;

export async function prepLock(b: any, who: string) {
  const id = Number(b.id);
  const row = (await db(`otto_prep?select=*&id=eq.${id}`))?.[0];
  if (!row) throw new Error("that read wasn't found");
  if (row.day !== etParts().date) throw new Error("a plan can only be locked on the day of the read");
  const v = planValidate(b);
  if (!v.ok) throw new Error(v.error);
  const plan: any = v.plan;
  let check: any = { ok: true, fixes: [], note: "" };
  try {
    const { sys, live, hits } = await prepContext(`${plan.ticker} ${plan.side} ${plan.how} ${plan.why}`);
    const g = row.grade ? `Jarvis's grade this morning: ${row.grade.letter}. Fix: ${(row.grade.fix || []).join(" | ")}` : "Not graded yet.";
    check = await claudeTool({ model: MODEL, max_tokens: 700, system: [{ type: "text", text: sys + NAME_RULE }, { type: "text", text: PREP_SYS(row.author) + "\n\n" + live }],
      tools: [PLAN_CHECK_TOOL], messages: [{ role: "user", content: `${row.author} is locking today's plan:\n${planLine(plan)}${plan.why ? "\nWhy: " + plan.why : ""}\n\n${g}\n\nOTTO RULES THAT MATCH:\n${hits || "(none)"}\n\nCheck ONLY this plan (not the whole read). Pass it unless something is missing, inconsistent or against the Otto Rules.` }] }, "plan_check", 45_000);
  } catch (e) { check = { ok: true, fixes: [], note: "", skipped: String((e as Error).message).slice(0, 120) }; }
  const fixes = (Array.isArray(check.fixes) ? check.fixes : []).map((x: any) => unname(String(x)).slice(0, 300)).filter(Boolean).slice(0, 3);
  if (!check.ok && fixes.length && !b.force) return { ok: true, locked: false, fixes, plan };
  const prev = row.plan || null;
  // A changed entry: the old plan level comes off the Watcher so it can't fire a card for a plan that no longer exists.
  const moved = !!prev && (Number(prev.entry) !== plan.entry || prev.ticker !== plan.ticker || prev.side !== plan.side);
  if (moved && prev.watch_id)   // only the plan's own level (one the plan added), never someone else's
    await db(`otto_watch?id=eq.${prev.watch_id}&added_by=eq.${encodeURIComponent(`${row.author} · plan`)}`, { method: "PATCH", headers: { prefer: "return=minimal" }, body: JSON.stringify({ status: "removed" }) }).catch(() => {});
  const wdir = plan.side === "calls" ? "up" : "down";
  const w0 = await watchAdd({ ticker: plan.ticker, level: plan.entry, dir: wdir, source: "desk",
    note: `${row.author}'s plan: ${plan.how} ${plan.entry} (${plan.tf}) · wrong if ${plan.wrong_if} · target ${plan.target}`, by: `${row.author} · plan` }).catch(() => null);
  // v3.24 (C1): a re-lock on a level that's already on the list (or was taken off) keeps / puts it back on the Watcher.
  const w = await watchEnsure({ ticker: plan.ticker, level: plan.entry, dir: wdir }, w0).catch(() => w0);
  const locked = { ...plan, note: unname(String(check.note || "")).slice(0, 200), fixes_overridden: !check.ok ? fixes : [], locked_at: new Date().toISOString(),
    by: String(b.author || row.author).slice(0, 30), watch_id: w?.id ?? (moved ? null : prev?.watch_id ?? null), changes: (prev?.changes || 0) + (prev ? 1 : 0) };
  await db(`otto_prep?id=eq.${id}`, { method: "PATCH", headers: { prefer: "return=minimal" }, body: JSON.stringify({ plan: locked }) });
  await logDesk("system", "Otto", `📌 ${row.author} ${prev ? "changed" : "locked"} today's plan: ${planLine(locked)}${!check.ok ? " (locked over Jarvis's fixes)" : ""}`);
  void who;
  return { ok: true, locked: true, plan: locked };
}
export async function plansToday() {
  const rows = await db(`otto_prep?select=author,plan,result&day=eq.${etParts().date}&plan=not.is.null`).catch(() => []);
  return (rows || []).filter((r: any) => r.plan).map((r: any) => ({ author: r.author, ...r.plan, line: planLine(r.plan), result: r.result?.plan || null }));
}
// 4:05 PM: the plan against the tape and against the Agentic account's opening trades today.
export function planVsTape(plan: any, bars: Bar[]) {
  const up = plan.side === "calls";
  const hitEntry = (b: Bar) => plan.how === "break" ? (up ? b.c > plan.entry : b.c < plan.entry) : (b.l <= plan.entry && b.h >= plan.entry);
  const i = bars.findIndex(hitEntry);
  if (i < 0) return { trigger: false, outcome: "no trigger" };
  for (const b of bars.slice(i + 1)) {
    const tgt = up ? b.h >= plan.target : b.l <= plan.target, bad = up ? b.l <= plan.wrong_if : b.h >= plan.wrong_if;
    if (tgt && bad) return { trigger: true, trigger_at: bars[i].t, outcome: "both in one bar" };
    if (tgt) return { trigger: true, trigger_at: bars[i].t, outcome: "target" };
    if (bad) return { trigger: true, trigger_at: bars[i].t, outcome: "wrong-if" };
  }
  return { trigger: true, trigger_at: bars[i].t, outcome: "neither by the close" };
}
async function openingTradesToday() {
  const acct = await agenticAccount();
  const since = new Date(Date.parse(nyIso(etParts().date, "9:00 AM") || new Date().toISOString())).toISOString();
  const j = mcpJson(await call("rh", "get_option_orders", { account_number: acct, state: "filled", created_at_gte: since }));
  const out: { sym: string; type: string }[] = [];
  for (const o of j?.data?.orders || []) for (const l of o.legs || []) if (l.position_effect === "open") out.push({ sym: String(o.chain_symbol || "").toUpperCase(), type: l.option_type === "put" ? "puts" : "calls" });
  return out;
}
export function planAdherence(plan: any, trades: { sym: string; type: string }[]) {
  if (!trades.length) return { adherence: "no trade", traded: [] };
  const on = trades.filter((t) => t.sym === plan.ticker && t.type === plan.side);
  const traded = [...new Set(trades.map((t) => `${t.sym} ${t.type}`))];
  return { adherence: on.length === trades.length ? "on plan" : on.length ? "partly off plan" : "off plan", traded };
}

export const unnameForTest = (t: string) => unname(t);
export const signalInForTest = (req: Request) => signalIn(req);

/* --------------------------------------------------------------- transport */

/* ===================================================================== v3.26
   9 Oct 2026 — after the −$230 day (two MSFT puts on a level the coach gave no direction for,
   45% and 39% of the account, a cancelled PLTR winner). Ifoma's decisions, approved mockup
   https://claude.ai/artifact/NF9dqNXmHE867LAA7HT4j9 (6 screens):
   - every guardrail is on/off + a number in Settings; tightening now, loosening the next trading day 9:30 AM
   - KILL SWITCH: daily stop / weekly limit / max trades hit → no new cards; ideas become PAPER cards (scored)
   - SIZE CAP: a trade over X% of the account → Otto tries a cheaper contract for the same idea, else a paper card
   - the Activity log (changes, breaks, trades, locks, "outside Otto")
   - Coaches Corner: every coach post scored as if we played it (real option prices), Coach vs Jarvis + Us
   - the 9 Oct fixes: no card on a level with no direction (the Watcher waits for a touch + close, both ways);
     a Watcher rejection / hold must actually touch the level; the stop is sized to the max loss; a wrong-if
     changed by an alert card moves the server rule too; "where the idea came from" on every card; made-up
     distances / moneyness / "overnight" / "already closed" corrected. */

/* ---------------- the Activity log ---------------- */
export async function activity(kind: "change" | "break" | "trade" | "lock" | "outside" | "card", text: string, who = "Otto", ref: string | null = null, data: any = null): Promise<boolean> {
  const row = { day: etParts().date, kind, text: unname(String(text || "")).slice(0, 1000), who: String(who || "").slice(0, 60) || null, ref, data };
  try {
    if (ref) {
      const made = await db("otto_activity?on_conflict=ref", { method: "POST", headers: { prefer: "resolution=ignore-duplicates,return=representation" }, body: JSON.stringify([row]) });
      if (Array.isArray(made) && !made.length) return false;           // already logged
    } else await db("otto_activity", { method: "POST", headers: { prefer: "return=minimal" }, body: JSON.stringify(row) });
  } catch { return false; }
  if (kind === "break") {
    const k = "brkping|" + row.text.slice(0, 50);
    if (!CACHE[k] || Date.now() - CACHE[k].at > 10 * 60e3) { CACHE[k] = { at: Date.now(), v: 1 }; await notify("brk", "⚠ Otto: something broke", row.text.slice(0, 160), "./#settings-activity"); }
  }
  return true;
}
// System lines on the Desk that are breaks or trades also go to the Activity log (one place to look).
const ACT_SKIP = /^(?:Guardrails updated|📌 House|⏰|🧹|Signals|Night Charts|📄 Paper card)/;
export function deskKind(text: string): "break" | "trade" | null {
  const t = String(text || "");
  if (ACT_SKIP.test(t)) return null;
  if (/⚠|✗|\bFAILED\b|could not|couldn't|\bfailed\b|NO stop|\berror\b/i.test(t)) return "break";
  if (/^✓|filled at|\bfilled\b|Otto closed|Auto-close|Stop placed|stopped out|closed for|position is flat/i.test(t)) return "trade";
  return null;
}
export async function noteOttoCancel(orderId: string) {
  await activity("trade", `Otto cancelled order ${orderId.slice(0, 8)} (its own stop or a close card's first step)`, "Otto", "ottocancel|" + orderId);
}
export async function activityGet(days = 7, kind = "") {
  const since = addDays(etParts().date, -Math.max(1, Math.min(90, days)));
  const rows = await db(`otto_activity?select=id,at,day,kind,text,who&day=gte.${since}${kind ? "&kind=eq." + encodeURIComponent(kind) : ""}&order=at.desc&limit=400`).catch(() => []);
  const today = etParts().date;
  return { ok: true, rows, breaks_today: (rows || []).filter((r: any) => r.kind === "break" && r.day === today).length,
    latest_break: (rows || []).find((r: any) => r.kind === "break")?.at || null };
}
// Every 5 minutes (cron_watch): Robinhood orders on the Agentic account that Otto didn't place or cancel.
export async function outsideSweep(day = etParts().date) {
  let orders: any[] = [];
  try { orders = await dayOrders(day); } catch { return { ok: false }; }
  const known = await db(`otto_activity?select=ref&day=gte.${addDays(day, -1)}&kind=eq.trade&limit=500`).catch(() => []);
  const mine = new Set((known || []).map((r: any) => String(r.ref || "")).filter((r: string) => r.startsWith("ottocancel|")).map((r: string) => r.slice(11)));
  let n = 0;
  for (const o of orders) {
    const leg = (o.legs || [])[0] || {};
    const what = `${o.chain_symbol || ""} ${Number(leg.strike_price) || ""}${leg.option_type === "put" ? "P" : leg.option_type === "call" ? "C" : ""} ${leg.side || ""} ${leg.position_effect || ""}`.replace(/\s+/g, " ").trim();
    const at = o.updated_at || o.created_at;
    if (o.state === "cancelled" && !mine.has(String(o.id))) {
      const m = at ? etParts(new Date(at)).min : 0;
      if (m >= 570 && m < 959 && etParts(new Date(at)).date === day)          // a day order expiring at the close is not "outside"
        if (await activity("outside", `${what} order cancelled outside Otto (Robinhood app or another tool) at ${etLabel(at)}`, "outside Otto", "outside|cancel|" + o.id)) n++;
    }
    if (o.placed_agent && o.placed_agent !== "agentic")
      if (await activity("outside", `${what} order placed outside Otto (${o.placed_agent}) at ${etLabel(o.created_at)} — ${o.state}`, "outside Otto", "outside|placed|" + o.id)) n++;
  }
  return { ok: true, found: n };
}

/* ---------------- the kill switch ---------------- */
export async function lockState(fresh = false): Promise<{ locked: boolean; reasons: any[]; until: string | null; text: string }> {
  if (fresh) delete CACHE.lockstate;
  return cached("lockstate", 30e3, async () => {
    const L = await getLimits();
    if (L.kill_on === false) return { locked: false, reasons: [], until: null, text: "" };
    const today = etParts().date;
    const reasons: any[] = [];
    const openNext = nyIso(isTradingDay(today) && etParts().min < 570 ? today : nextTradingDay(today), "9:30 AM");
    const maxLoss = L.max_loss_on === false ? 0 : Number(L.max_trade_loss) || 0;
    let cnt: any = null;
    try { cnt = await todayCounts(); } catch { /* fail open: no lock on unreadable data */ }
    if (cnt && L.kill_daily !== false && L.daily_on !== false) {
      const nMax = Number(L.daily_losses) || 0, dMax = maxLoss > 0 && Number(L.daily_x ?? 2) > 0 ? Number(L.daily_x ?? 2) * maxLoss : 0;
      if ((nMax > 0 && cnt.losers >= nMax) || (dMax > 0 && cnt.realized <= -dMax))
        reasons.push({ kind: "daily", until: openNext, text: `daily stop hit (${cnt.losers} losing trade${cnt.losers === 1 ? "" : "s"}, ${cnt.realized < 0 ? "−" : ""}$${Math.abs(cnt.realized).toFixed(0)})` });
    }
    if (cnt && L.kill_trades !== false && L.trades_on !== false && cnt.opened >= Number(L.max_trades_day))
      reasons.push({ kind: "trades", until: openNext, text: `max trades hit (${cnt.opened} of ${L.max_trades_day} today)` });
    if (L.kill_weekly !== false && L.weekly_on !== false) {
      try {
        const wk = await weekPnlNow();
        if (wk <= -Number(L.weekly_loss)) reasons.push({ kind: "weekly", until: nyIso(nextTradingDay(fridayOf(today)), "9:30 AM"),
          text: `weekly limit hit (${wk < 0 ? "−" : ""}$${Math.abs(wk).toFixed(0)} of −$${L.weekly_loss})` });
      } catch { /* fail open */ }
    }
    if (!reasons.length) return { locked: false, reasons, until: null, text: "" };
    const until = reasons.map((r) => r.until).filter(Boolean).sort().slice(-1)[0] || null;
    const text = `${reasons.map((r) => r.text).join(" · ")} — no new cards until ${until ? etLabel(until) : "the next trading day"}`;
    for (const r of reasons) {
      if (await activity("lock", `Kill switch: ${r.text}. Locked until ${r.until ? etLabel(r.until) : "the next trading day"}. Signals keep listening; ideas become paper cards.`, "Otto", `lock|${today}|${r.kind}`))
        await notify("lock", "🔒 Otto locked new cards", `${r.text}. Until ${r.until ? etLabel(r.until) : "the next trading day"}.`);
    }
    return { locked: true, reasons, until, text };
  });
}

/* ---------------- where the idea came from ---------------- */
// coach_call = the coach gave this direction · coach_level = his level, Jarvis's direction (the Watcher's close) ·
// coach_post = his ticker, Jarvis's direction · coach_against = Jarvis went the other way · jarvis = Jarvis's own.
export const ORIGIN_LABEL: Record<string, string> = { coach_call: "Coach's call", coach_level: "Coach's level + Jarvis's direction",
  coach_post: "Coach's post + Jarvis's direction", coach_against: "Against the coach's direction", jarvis: "Jarvis's own" };
const dirOfCoach = (d: any) => d === "long" ? "up" : d === "short" ? "down" : null;
export async function originOf(plan: any): Promise<{ origin: string; row: any | null }> {
  const want = plan?.direction === "down" ? "down" : "up";
  let row: any = null;
  if (plan?.jason_id) row = (await db(`otto_jason?select=id,ticker,direction,kind,level,words&id=eq.${Number(plan.jason_id) || 0}`).catch(() => []))?.[0] || null;
  if (!row && plan?.watch_id) {
    const w = (await db(`otto_watch?select=id,source,source_ref,coach_dir&id=eq.${Number(plan.watch_id) || 0}`).catch(() => []))?.[0];
    if (w?.source === "signal") {
      row = w.source_ref ? (await db(`otto_jason?select=id,ticker,direction,kind,level,words&id=eq.${Number(w.source_ref) || 0}`).catch(() => []))?.[0] || null : null;
      const cd = dirOfCoach(w.coach_dir || row?.direction);
      return { origin: !cd ? "coach_level" : cd === want ? "coach_call" : "coach_against", row };
    }
  }
  if (row) { const cd = dirOfCoach(row.direction); return { origin: !cd ? (Number(row.level) > 0 || levelsFromWords(row.words || "").length ? "coach_level" : "coach_post") : cd === want ? "coach_call" : "coach_against", row }; }
  return { origin: "jarvis", row: null };
}
// "WATCH LITE TO HOLD PHM" — a card on the second name is a guess. Words that aren't tickers in his posts:
const POST_WORDS = new Set("WATCH HOLD HELD TO IF IT DOES COULD BE NICE BOUNCE WIDE SPREAD ALERT ABOVE BELOW OVER UNDER LETS GO TOOK OFF HALF HERE THIS THAT THE AND FOR WITH INTO FROM AT ON IN OUT NOW NEXT MY YOUR WE IS ARE WAS BREAK BREAKS BROKE RESISTANCE SUPPORT ZONE BUY SELL LONG SHORT CALL CALLS PUT PUTS ENTRY TARGET MOVING POSSIBLE REBALANCE FOR CHALLENGE HIGHS LOWS FROM YESTERDAY WAIT RESET FLIP DUMPSTER FIRE STILL MORE LESS VWAP MIN HOUR DAY WEEK ORDERS HAS THEM WEAK STRONG NO YES ALL NOT BUT SO UP DOWN NEW HIGH LOW OPEN CLOSE GAP FILL ONE TWO AN A I OK ORB HOD LOD ATH PM AM ET LOL OF BY AS".split(" "));
export function tickersInPost(words: string): string[] {
  return [...new Set((String(words || "").toUpperCase().match(/\b[A-Z]{2,5}\b/g) || []).filter((w) => !POST_WORDS.has(w) && !NOT_TICKER.has(w)))];
}
export function unclearTicker(cardTk: string, words: string): string | null {
  const t = tickersInPost(words);
  if (t.length < 2 || !cardTk) return null;
  return t[0] !== cardTk.toUpperCase() ? `Ticker unclear — the post names ${t.join(" and ")} ("${String(words).slice(0, 80)}"); this card is on ${cardTk}. Check with the coach.` : null;
}
// Against the day's move: a put while the stock is well up from the open (9 Oct MSFT +1%), or the mirror.
export async function dayMoveCheck(tk: string, direction: string): Promise<any | null> {
  const day = etParts().date, start = nyIso(day, "9:30 AM");
  if (!tk || !start || Date.now() < Date.parse(start) + 10 * 60e3) return null;
  const bars = (await rhBars([tk], "5minute", start).catch(() => ({} as Record<string, Bar[]>)))[tk.toUpperCase()] || [];
  if (bars.length < 2) return null;
  const o = bars[0].o, c = bars[bars.length - 1].c, pct = (c - o) / o * 100;
  const against = direction === "down" ? pct >= 0.5 : pct <= -0.5;
  return against ? { ok: false, guard: true, text: `Against the day's move: ${tk} ${pct >= 0 ? "+" : ""}${pct.toFixed(1)}% from the open (${o.toFixed(2)} → ${c.toFixed(2)})` }
    : { ok: true, text: `${tk} ${pct >= 0 ? "+" : ""}${pct.toFixed(1)}% from the open` };
}
/** v3.26 (9 Oct trade 1: stop $0.93 on a $5.25 entry = −$432): the stop is raised so a stop-out loses at most the max. */
export function stopForMax(entry: number, stopOpt: number, qty: number, maxLoss: number): number | null {
  if (!(maxLoss > 0) || !(entry > 0) || !(qty >= 1)) return null;
  if ((entry - stopOpt) * 100 * qty <= maxLoss + 0.5) return null;
  const s = roundStopUp(entry - maxLoss / (100 * qty));
  return s > 0 && s < entry && s > stopOpt ? s : null;
}
/** The cheapest-risk contract for the same idea that fits under the size cap (delta ≥ .15), or null. */
export function capFit(rows: SLRow[], capUsd: number, bp: number | null): SLRow | null {
  const ok = (rows || []).filter((r) => r.ask > 0 && r.cost <= capUsd && (bp == null || r.cost <= bp) && Math.abs(r.delta) >= 0.15);
  if (!ok.length) return null;
  return ok.sort((a, b) => (Math.abs(Math.abs(a.delta) - 0.35) - Math.abs(Math.abs(b.delta) - 0.35)) || (b.vol - a.vol))[0];
}

/* ---------------- a wrong-if changed by an alert card moves the server rule ---------------- */
// 9 Oct 10:40: "Update MSFT wrong-if: 532.40 → 532.07" only moved the TradingView alert; at 10:45 the 5-minute bar closed
// at 532.30 and the server never closed the put.
export function wrongIfFromAlertArgs(args: any): { tk: string; price: number } | null {
  const txt = `${args?.name || ""} ${args?.message || ""}`;
  if (!/wrong[- ]?if/i.test(txt)) return null;
  const m = /\b([A-Z]{1,5})\s+[–-]?\s*\$?(\d{1,5}(?:\.\d{1,2})?)\s*[–-]\s*wrong[- ]?if/i.exec(String(args?.name || "")) ||
    /\b([A-Z]{1,5})\b[^0-9]{0,40}?\$?(\d{1,5}(?:\.\d{1,2})?)/.exec(txt);
  return m ? { tk: m[1].toUpperCase(), price: Number(m[2]) } : null;
}
export async function wrongIfFromCard(calls: any[], who: string): Promise<string[]> {
  const notes: string[] = [];
  for (const c of calls || []) {
    if (c.service !== "tv" || !/alert/.test(String(c.tool))) continue;
    const w = wrongIfFromAlertArgs(c.args); if (!w || !(w.price > 0)) continue;
    const rows = await db("otto_actions?" + OQ() + "select=*&exit->>state=eq.armed&order=created_at.desc&limit=20").catch(() => []);
    const a = (rows || []).find((r: any) => v322Sym(r.exit?.tv_symbol) === w.tk);
    if (!a) continue;
    const ex = { ...a.exit }, old = Number(ex.wrong_if);
    if (Math.abs(old - w.price) < 0.005) continue;
    ex.wrong_if = w.price; ex.wrong_set_at = new Date().toISOString();
    exitLog(ex, `Wrong-if ${old} → ${w.price} (alert card approved by ${who}) — the server rule moved too`);
    await saveExit(a.id, ex).catch(() => {});
    const thesis = Number(a.plan?.stop);
    const inside = thesis > 0 && (ex.direction === "down" ? w.price < thesis - 0.005 : w.price > thesis + 0.005);
    const line = `🎯 ${w.tk} wrong-if ${old} → ${w.price} on ${a.title}: the server closes it on a ${ex.wrong_tf || 5}-minute close ${ex.direction === "down" ? "above" : "below"} ${w.price}.` +
      (inside ? ` ⚠ That's inside the card's own level (${thesis}) — a test of the level will stop you out.` : "");
    await logDesk("system", "Otto", line, a.id);
    await activity("change", `${w.tk} wrong-if ${old} → ${w.price} (server rule moved)${inside ? ` · inside the card's own level ${thesis}` : ""}`, who);
    notes.push(line);
  }
  return notes;
}

/* ---------------- Jarvis's numbers (made-up distances, moneyness, "overnight", "already closed") ---------------- */
const CLOSED_CLAIM = /\b(?:no open position|already closed|it'?s (?:already )?closed|position is (?:already )?(?:closed|gone|flat)|isn'?t (?:open|held) any ?more|not holding (?:it|that|the))\b/i;
const OVERNIGHT_CLAIM = /\b(?:overnight|from yesterday'?s close|since yesterday'?s close|vs\.? yesterday'?s close)\b/i;
const OPTION_WORD = /\b(?:put|call|option|contract|mark|premium|shed|lost|down \$|\d+(?:\.\d+)?[PC]\b)/i;
const ITM_CLAIM = /\bin[- ]the[- ]money\b/i;
const DIST_CLAIM = /\$?(\d{1,4}(?:\.\d{1,2})?)\s*(?:points?\s+|pts?\s+|dollars?\s+)?(below|above|under|over|away from|from)\s+(?:the\s+)?(?:[\w.$]+\s+){0,3}?\$?(\d{2,5}(?:\.\d{1,2})?)/i;
export function checkClaims326(text: string, f: DayFacts, px: Record<string, number>): { text: string; notes: string[] } {
  const notes: string[] = [];
  const fix = (msg: string) => { notes.push(`⚠ Correction (Otto checked Robinhood): ${msg}`); return ` [Corrected by Otto: ${msg}]`; };
  const known = new Set<string>([...f.trips.map((t) => t.sym)].filter(Boolean));
  let tgt: Target = { sym: null, strike: null, side: null };
  const out = sentences(text).map((s) => {
    if (!s.trim()) return s;
    tgt = targetOf(s, known, tgt);
    if (OTHER_DAY.test(s) && !OVERNIGHT_CLAIM.test(s)) return s;
    const mine = f.trips.filter((t) => hits(tgt, t));
    const open = mine.filter((t) => t.state === "open");
    // 1. "already closed" / "no open position" on a trade Robinhood shows open
    if (CLOSED_CLAIM.test(s) && !CALLER.test(s) && open.length) return fix(`Robinhood shows ${open[0].label} still OPEN (filled at $${open[0].entry.toFixed(2)}).`);
    // 2. "overnight" / "from yesterday's close" on an option bought today
    if (OVERNIGHT_CLAIM.test(s) && OPTION_WORD.test(s) && mine.length) {
      const t = mine[0];
      return fix(`${t.label} was bought today at ${etLabel(t.opened_at)} for $${t.entry.toFixed(2)} — there is no overnight move; its P&L is the mark vs that fill.`);
    }
    // 3. "in the money" on a contract that isn't
    if (ITM_CLAIM.test(s) && !/\bnot\b[^.]{0,12}in[- ]the[- ]money|\bout[- ]of[- ]the[- ]money/i.test(s)) {
      const t = mine[0] || (tgt.sym && tgt.strike != null && tgt.side ? { sym: tgt.sym, strike: tgt.strike, side: tgt.side, label: `${tgt.sym} ${tgt.strike}${tgt.side === "put" ? "P" : "C"}` } as any : null);
      const p = t ? (px[t.sym] || 0) : 0;
      if (t && p > 0) {
        const itm = t.side === "put" ? p < t.strike : p > t.strike;
        if (!itm) return fix(`${t.label} is OUT of the money — ${t.sym} is ${p.toFixed(2)}, ${t.side === "put" ? "above" : "below"} the ${t.strike} strike.`);
      }
    }
    // 4. "$7.43 below the 532.40 resistance" — the distance to a level, against the live price
    const dm = DIST_CLAIM.exec(s);
    if (dm && !CALLER.test(s) && !/%/.test(dm[0])) {
      const sym = (s.match(/\b[A-Z]{1,5}\b/g) || []).find((w) => px[w] > 0) || tgt.sym;
      const p = sym ? (px[sym] || 0) : 0, d = Number(dm[1]), lvl = Number(dm[3]);
      if (p > 0 && lvl > p * 0.8 && lvl < p * 1.2 && d > 0 && d < p * 0.2 && !/strike/i.test(s.slice(0, dm.index || 0).slice(-30))) {
        const real = Math.abs(p - lvl);
        if (Math.abs(real - d) > Math.max(0.6, real * 0.25))
          return fix(`${sym} is ${p.toFixed(2)} — $${real.toFixed(2)} ${p < lvl ? "below" : "above"} ${lvl}, not $${d.toFixed(2)}.`);
      }
    }
    return s;
  });
  return { text: out.join(""), notes: [...new Set(notes)] };
}
export async function factCheck326(text: string): Promise<{ text: string; notes: string[] }> {
  if (!(CLOSED_CLAIM.test(text) || OVERNIGHT_CLAIM.test(text) || ITM_CLAIM.test(text) || DIST_CLAIM.test(text))) return { text, notes: [] };
  try {
    const f = dayFacts(await withTimeout(dayOrders(etParts().date), 8000, "Robinhood orders"));
    const syms = [...new Set([...f.trips.map((t) => t.sym), ...((text.match(/\b[A-Z]{2,5}\b/g) || []).filter((w) => !NOT_TICKER.has(w)))])].slice(0, 8);
    const px = syms.length ? await withTimeout(rhPrices(syms), 6000, "prices").catch(() => ({} as Record<string, number>)) : {};
    return checkClaims326(text, f, px);
  } catch { return { text, notes: [] }; }
}

/* ---------------- Coaches Corner ---------------- */
const EXIT_POST = /\bTOOK (?:OFF )?(?:HALF|SOME|PROFITS?|MOST)|\bTRIM(?:MED|MING)?\b|\bTAKING (?:SOME|PROFITS?|HALF)|\bSOLD (?:HALF|SOME|ALL)|\bI'?M OUT\b|\bCLOSED (?:IT|MY|THE)|\bOUT OF (?:IT|MY|THE)\b|\bLOCKED IN\b/i;
export const isExitPost = (r: any) => EXIT_POST.test(String(r?.words || ""));
export type CCSide = { side: "up" | "down"; state: string; why?: string; entry_at?: string; entry_px?: number; exit_at?: string; exit_px?: number; exit_why?: string;
  opt?: { id: string; label?: string; entry: number; exit: number } | null; pnl?: number | null; est?: boolean };
/** One side of a coach post, on the underlying's 5-minute bars (+ the option's bars when we know the contract). */
export function ccSide(o: { side: "up" | "down"; postAt: number; level: number | null; bars: Bar[]; exitAt?: number | null; tp1?: number | null; endAt: number }): CCSide {
  const up = o.side === "up";
  const after = o.bars.filter((b) => b.t + 5 * 60e3 > o.postAt && b.t < o.endAt);
  if (!after.length) return { side: o.side, state: "pending", why: "no bars yet" };
  let i0 = -1;
  if (o.level && o.level > 0) {
    // a level: the side triggers on a 5-minute close through it, or a touch-and-hold / touch-and-reject
    for (let i = 0; i < after.length; i++) {
      const b = after[i], L = o.level;
      if (up ? (b.c > L && (b.l <= L || (i > 0 && after[i - 1].c <= L))) : (b.c < L && (b.h >= L || (i > 0 && after[i - 1].c >= L)))) { i0 = i; break; }
    }
    if (i0 < 0) return { side: o.side, state: "no_entry", why: `never ${up ? "held / broke above" : "rejected / broke below"} ${o.level}` };
  } else i0 = 0;
  const e = after[i0], entryAt = e.t + 5 * 60e3, entry = e.c;
  let exitIdx = after.length - 1, why = "3:50 PM";
  for (let i = i0 + 1; i < after.length; i++) {
    const b = after[i], end = b.t + 5 * 60e3;
    if (o.exitAt && end >= o.exitAt) { exitIdx = i; why = "coach's exit post"; break; }
    if (o.tp1 && (up ? b.h >= o.tp1 : b.l <= o.tp1)) { exitIdx = i; why = "TP1"; break; }
    if (o.level && (up ? b.c < o.level : b.c > o.level)) { exitIdx = i; why = "wrong-if (5-min close back through the level)"; break; }
    if (end >= o.endAt - 10 * 60e3) { exitIdx = i; why = "3:50 PM"; break; }
  }
  const x = after[exitIdx], done = why !== "3:50 PM" || x.t + 5 * 60e3 >= o.endAt - 10 * 60e3;
  const move = (x.c - entry) * (up ? 1 : -1);
  return { side: o.side, state: done ? (Math.abs(move) < entry * 0.0005 ? "flat" : move > 0 ? "win" : "loss") : "open",
    entry_at: new Date(entryAt).toISOString(), entry_px: +entry.toFixed(2), exit_at: new Date(x.t + 5 * 60e3).toISOString(), exit_px: +x.c.toFixed(2), exit_why: why,
    pnl: +(move * 0.35 * 100).toFixed(0), est: true };
}
async function optBars(id: string, startIso: string, endIso: string): Promise<Bar[]> {
  return cached(`ob|${id}|${startIso}|${endIso}`, 5 * 60e3, async () => {
    const j = mcpJson(await call("rh", "get_option_historicals", { instrument_ids: [id], start_time: startIso, end_time: endIso, interval: "5minute" }));
    const r = (j?.data?.results || [])[0];
    return (r?.bars || []).filter((b: any) => !b.interpolated).map((b: any) => ({ t: Date.parse(b.begins_at), o: Number(b.open_price), h: Number(b.high_price), l: Number(b.low_price), c: Number(b.close_price) }));
  });
}
const pxAt = (bars: Bar[], t: number) => { let v: number | null = null; for (const b of bars) { if (b.t + 5 * 60e3 <= t) v = b.c; else break; } return v ?? (bars[0]?.o ?? null); };
/** Score one coach post (both ways for a level with no direction). Real option P&L when we have the contract. */
export async function coachScore(r: any, cards: any[], exits: any[]): Promise<any> {
  const tk = String(r.ticker || "").toUpperCase();
  if (!tk || !r.posted_at) return { state: "unscored", why: !tk ? "no ticker" : "no time" };
  const day = r.day, open = nyIso(day, "9:30 AM"), close = nyIso(day, "4:00 PM");
  if (!open || !close) return { state: "unscored", why: "no session" };
  const lv = Number(r.level) > 0 ? Number(r.level) : (levelsFromWords(r.words || "")[0]?.level || null);
  const cd = dirOfCoach(r.direction);
  const sides: ("up" | "down")[] = cd ? [cd] : lv ? ["up", "down"] : [];
  if (!sides.length) return { state: "unscored", why: "no direction and no level" };
  const bars = (await rhBars([tk], "5minute", open, Date.parse(close) < Date.now() ? close : undefined))[tk] || [];
  const ex = exits.find((x: any) => x.ticker === tk && Date.parse(x.posted_at) > Date.parse(r.posted_at));
  const out: CCSide[] = [];
  for (const sd of sides) {
    const card = cards.find((a: any) => (a.plan?.direction === "down" ? "down" : "up") === sd && a.exit?.option_id);
    const s = ccSide({ side: sd, postAt: Date.parse(r.posted_at), level: lv, bars, exitAt: ex ? Date.parse(ex.posted_at) : null, tp1: card ? Number(card.plan?.tp1) || null : null,
      endAt: Date.parse(close) });
    if (card && s.entry_at && s.exit_at && ["win", "loss", "flat", "open"].includes(s.state)) {
      try {
        const ob = await optBars(card.exit.option_id, open, Date.parse(close) < Date.now() ? close : new Date().toISOString());
        const e = pxAt(ob, Date.parse(s.entry_at)), x = pxAt(ob, Date.parse(s.exit_at));
        if (e && x) { s.opt = { id: card.exit.option_id, label: String(card.title || "").replace(/^.*?Buy 1\s+/i, "").split(" @")[0], entry: e, exit: x }; s.pnl = Math.round((x - e) * 100); s.est = false; }
      } catch { /* the estimate stays */ }
    }
    out.push(s);
  }
  const final = out.every((s) => !["open", "pending"].includes(s.state));
  return { state: final ? "scored" : "live", level: lv, coach_dir: cd, sides: out, exit_post: ex ? { at: ex.posted_at, words: ex.words } : null };
}
export async function coachCorner(range = "today") {
  const today = etParts().date;
  const since = range === "week" ? mondayOf(today) : range === "30" ? addDays(today, -30) : range === "all" ? "2026-01-01" : today;
  const rows = await db(`otto_jason?select=*&day=gte.${since}&order=posted_at.asc&limit=400`).catch(() => []);
  const posts = (rows || []).filter((r: any) => r.ticker && (r.kind === "call" || r.kind === "level" || r.kind === "result"));
  const exits = posts.filter((r: any) => isExitPost(r));
  const main = posts.filter((r: any) => r.kind !== "result" && !(isExitPost(r) && !dirOfCoach(r.direction) && !(Number(r.level) > 0)));
  // the cards for each post: its own card + Watcher cards on its levels
  const acts = await db(`otto_actions?${OQ()}select=id,title,status,plan,exit,outcome,created_at,created_by,checks&created_at=gte.${since}T00:00:00Z&order=created_at.asc&limit=400`).catch(() => []);
  const watch = await db(`otto_watch?select=id,source_ref&day=gte.${since}&source=eq.signal&limit=400`).catch(() => []);
  const trades = await db(`otto_trades?select=action_id,pnl&action_id=not.is.null`).catch(() => []);
  const pnlBy: Record<string, number> = {};
  (trades || []).forEach((t: any) => { if (t.pnl != null) pnlBy[t.action_id] = (pnlBy[t.action_id] || 0) + Number(t.pnl); });
  const done = !["Sat", "Sun"].includes(etParts().wd) && etParts().min >= 965;
  const out: any[] = [];
  const cardsOf = (r: any) => {
    const wIds = new Set((watch || []).filter((w: any) => String(w.source_ref) === String(r.id)).map((w: any) => Number(w.id)));
    return (acts || []).filter((a: any) => a.id === r.action_id || Number(a.plan?.jason_id) === Number(r.id) || wIds.has(Number(a.plan?.watch_id)));
  };
  // v4.8.3: score the NEWEST unscored posts first, four at a time. It used to walk oldest-first with a budget of 12, so posts that never
  // finish (no bars) ate the budget on every request and the posts people actually look at never got scored ("pending" forever).
  const todo = main.filter((r: any) => !(r.cc && (r.cc.state === "scored" || (r.cc.state === "unscored" && r.day < today)))).sort((a: any, b: any) => Date.parse(b.posted_at || 0) - Date.parse(a.posted_at || 0)).slice(0, 16);
  const fresh = new Map<any, any>();
  for (let i = 0; i < todo.length; i += 4) {
    await Promise.all(todo.slice(i, i + 4).map(async (r: any) => {
      let cc: any;
      try { cc = await coachScore(r, cardsOf(r), exits); } catch (e) { cc = { state: "unscored", why: String((e as Error).message).slice(0, 100) }; }
      fresh.set(r.id, cc);
      const finalDay = r.day < today || done;
      const stuck = finalDay && cc && cc.state === "live" && (cc.sides || []).every((s: any) => s.state === "pending") && r.day < addDays(today, -3);
      if (finalDay && cc && (cc.state === "scored" || cc.state === "unscored" || stuck)) {
        const keep = stuck ? { state: "unscored", why: "no price bars for that day", sides: [] } : cc;
        if (stuck) fresh.set(r.id, keep);
        await db("otto_jason?id=eq." + r.id, { method: "PATCH", headers: { prefer: "return=minimal" }, body: JSON.stringify({ cc: keep }) }).catch(() => {});
      }
    }));
  }
  for (const r of main) {
    const cards = cardsOf(r);
    const cc = fresh.has(r.id) ? fresh.get(r.id) : r.cc;
    const cd = dirOfCoach(r.direction);
    const did = cards.map((a: any) => {
      const d = a.plan?.direction === "down" ? "down" : "up";
      const filled = a.status === "done" && a.exit && !["planned", "waiting_fill", "dead"].includes(a.exit.state);
      const we = a.status === "paper" ? "auto-rejected" : a.status === "paper_taken" ? "took it (practice)" : a.status === "paper_wait" ? "practice card, not answered" : a.status === "done" ? (filled ? "took it" : "approved, never filled (cancelled)") : a.status === "failed" ? "failed to place" : a.status === "rejected" ? "passed" : a.status === "expired" ? "passed (expired)" : a.status;
      return { id: a.id, title: a.title, status: a.status, direction: d, origin: a.plan?.origin || null, wrong_side: !!cd && cd !== d, we, pnl: pnlBy[a.id] ?? null };
    });
    out.push({ id: r.id, day: r.day, at: r.posted_at, label: r.posted_label, ticker: r.ticker, kind: r.kind, direction: r.direction || null, words: r.words,
      type: cd ? (/BOUNCE/i.test(r.words || "") ? "bounce" : "call") : (/BOUNCE/i.test(r.words || "") ? "bounce" : "level"),
      unclear: tickersInPost(r.words || "").length >= 2, cc: cc || null, cards: did,
      us_pnl: did.some((d: any) => d.pnl != null) ? did.reduce((s: number, d: any) => s + (d.pnl || 0), 0) : null });
  }
  // totals + splits
  const coachPnl = (x: any) => (x.cc?.sides || []).filter((s: any) => ["win", "loss", "flat"].includes(s.state)).reduce((t: number, s: any) => t + (Number(s.pnl) || 0), 0);
  const scoredSides = (l: any[], pick?: (x: any, s: any) => boolean) => l.flatMap((x) => (x.cc?.sides || []).filter((s: any) => ["win", "loss", "flat"].includes(s.state) && (!pick || pick(x, s))));
  const agg = (sides: any[]) => { const w = sides.filter((s) => s.state === "win").length, lo = sides.filter((s) => s.state === "loss").length;
    return { n: sides.length, wins: w, losses: lo, win_pct: w + lo ? Math.round(w / (w + lo) * 100) : null, pnl: Math.round(sides.reduce((t, s) => t + (Number(s.pnl) || 0), 0)) }; };
  const min = (x: any) => x.at ? etParts(new Date(x.at)).min : 0;
  const bannerCache: Record<string, string | null> = {};
  { const last = out.slice(-60).filter((x: any) => x.at);
    for (let i = 0; i < last.length; i += 10) await Promise.all(last.slice(i, i + 10).map(async (x: any) => { bannerCache[x.id] = await bannerAt(x.at).catch(() => null); })); }
  const tone = (v: string | null) => !v ? null : /long/i.test(v) ? "up" : /short/i.test(v) ? "down" : null;
  const splits = [
    { key: "Calls (he gives direction)", ...agg(scoredSides(out, (x) => x.type === "call")) },
    { key: "Levels · if held", ...agg(scoredSides(out, (x, s) => x.type === "level" && ((x.cc?.level && s.side === "up" && /SUP|HOLD|HELD/i.test(x.words)) || (s.side === "down" && /RES/i.test(x.words))))) },
    { key: "Levels · if broke", ...agg(scoredSides(out, (x, s) => x.type === "level" && ((s.side === "up" && /RES/i.test(x.words)) || (s.side === "down" && /SUP/i.test(x.words))))) },
    { key: "Bounces", ...agg(scoredSides(out, (x) => x.type === "bounce")) },
    { key: "Posted 9:30–10:00", ...agg(scoredSides(out, (x) => min(x) < 600)) },
    { key: "Posted after 10:00", ...agg(scoredSides(out, (x) => min(x) >= 600)) },
    { key: "With the market mood", ...agg(scoredSides(out, (x, s) => tone(bannerCache[x.id]) === s.side)) },
    { key: "Against the market mood", ...agg(scoredSides(out, (x, s) => !!tone(bannerCache[x.id]) && tone(bannerCache[x.id]) !== s.side)) },
  ];
  const coach = agg(scoredSides(out));
  const usCards = out.flatMap((x) => x.cards);
  const us = { pnl: Math.round(usCards.reduce((t: number, c: any) => t + (Number(c.pnl) || 0), 0)), wins: usCards.filter((c: any) => (c.pnl || 0) > 0).length,
    losses: usCards.filter((c: any) => (c.pnl || 0) < 0).length, passed: out.filter((x) => !x.cards.some((c: any) => c.we === "took it")).length,
    wrong_side: usCards.filter((c: any) => c.wrong_side).length };
  return { ok: true, range, since, posts: out.reverse(), coach: { ...coach, pnl: Math.round(out.reduce((t, x) => t + coachPnl(x), 0)), posts: out.length,
    pending: out.filter((x) => x.cc?.state !== "scored").length }, us, splits };
}
/** The Friday report card: totals, follow / wait, and the posts to bring to the 1:1. */
export async function coachReport() {
  const cc = await coachCorner("week");
  const ok = cc.splits.filter((s: any) => s.n >= 3 && s.win_pct != null);
  const best = ok.slice().sort((a: any, b: any) => (b.win_pct - a.win_pct) || (b.pnl - a.pnl))[0] || null;
  const worst = ok.slice().sort((a: any, b: any) => (a.win_pct - b.win_pct) || (a.pnl - b.pnl))[0] || null;
  const ask: any[] = [];
  for (const x of cc.posts) {
    if (x.unclear) ask.push({ day: x.day, ticker: x.ticker, text: `“${String(x.words).slice(0, 90)}” — which ticker, and what level?` });
    else if (x.cards.some((c: any) => c.wrong_side)) ask.push({ day: x.day, ticker: x.ticker, text: `“${String(x.words).slice(0, 90)}” — we read it the other way. What did you mean?` });
    else if (x.type === "level" && x.cards.some((c: any) => (c.pnl || 0) < 0)) ask.push({ day: x.day, ticker: x.ticker, text: `${x.ticker} level, no direction (“${String(x.words).slice(0, 60)}”) — short at the touch, or wait for the break?` });
  }
  return { coach: cc.coach, us: cc.us, gap: cc.coach.pnl - cc.us.pnl, follow: best, wait: worst && best && worst.key !== best.key ? worst : null, ask: ask.slice(0, 6) };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });

  const json = (b: unknown, status = 200) =>
    new Response(JSON.stringify(b, null, 2), {
      status, headers: { ...CORS, "content-type": "application/json", "cache-control": "no-store" },
    });

  // Supabase has already verified the JWT's signature. What it does NOT check
  // is whether the caller is a real signed-in user or just anybody holding the
  // public anon key — and the anon key ships in the app, so without this the
  // published URL would let a stranger burn the market-data and Claude quotas.
  // v3.1 scheduled runs (pg_cron → pg_net). They carry the cron secret, not a user.
  const fn0 = new URL(req.url).searchParams.get("fn") || "";
  setTvRoute(fn0 || "app");   // v5.3.1
  if (fn0 === "signal_in") {
    try { return json(await signalIn(req)); }
    catch (e) { const m = String((e as Error).message || e); return json({ ok: false, error: m }, /key/.test(m) ? 401 : 500); }
  }
  if (fn0 === "ears") {   // v4.6: the extension's tab audio — same pairing key as signal_in
    try {
      const cfg = await sigCfg(); const key = req.headers.get("x-otto-signal") || "";
      if (!cfg.key || key.length < 16 || key !== cfg.key) return json({ ok: false, error: "bad watcher key" }, 401);
      return json(await earsIn(await req.json().catch(() => ({}))));
    } catch (e) { return json({ ok: false, error: String((e as Error).message || e).slice(0, 300) }, 500); }
  }
  if (fn0 === "signal_jarvis") {
    if (!cronAllowed(req)) return json({ ok: false, error: "bad cron secret" }, 401);
    background(signalJarvis(Number(new URL(req.url).searchParams.get("batch") || 0)));
    return json({ ok: true, started: "jarvis" }, 202);
  }
  if (fn0 === "alert_jarvis") {
    if (!cronAllowed(req)) return json({ ok: false, error: "bad cron secret" }, 401);
    const bj = await req.json().catch(() => ({}));
    background(alertJarvis(Array.isArray(bj.fires) ? bj.fires : []));
    return json({ ok: true, started: "alert_jarvis" }, 202);
  }
  // v3.14: the Watcher — every minute 9:30–4:00 ET; the 9:20 scanner; the Scoreboard every 5 minutes.
  if (fn0 === "cron_watch") {
    if (!cronAllowed(req)) return json({ ok: false, error: "bad cron secret" }, 401);
    const c = marketClock();
    const force = new URL(req.url).searchParams.get("force") === "1";
    background((async () => {
      if (c.status === "open" || force) { try { await watchTick(); } catch (e) { console.error("watch", e); } }
      if (isTradingDay(c.date) && c.min >= 560 && c.min < 570) {
        const s = await setting("watch_scan_day").catch(() => null);
        if (s?.day !== c.date) { await putSetting("watch_scan_day", { day: c.date, by: "starting" }).catch(() => {}); try { await watchScan(); } catch (e) { console.error("scan", e); } }
      }
      if (isTradingDay(c.date) && c.min >= 575 && c.min <= 975 && c.min % 5 === 0) {
        try { await scoreTick(); } catch (e) { console.error("score", e); }
        try { await scoreTickRooms(); } catch (e) { console.error("score rooms", e); }      // v5.0 ROOMS: member rooms, after the house
      }
      // v3.16: scheduled check-ins, missed card pings, and the 9:10 Signal self-test.
      if (isTradingDay(c.date) && c.min >= 540 && c.min <= 980) {
        try { await checksTick(); } catch (e) { console.error("checks", e); }
        try { await checksStuck(); } catch (e) { console.error("checks stuck", e); }      // v3.24 (C2)
        try { await staleTick(); } catch (e) { console.error("stale", e); }              // v3.24 (A8)
        try { await cardSweep(); } catch (e) { console.error("sweep", e); }
      }
      if (isTradingDay(c.date) && c.min >= 550 && c.min < 560) { try { await signalSelfTest(); } catch (e) { console.error("selftest", e); } }
      // v3.26: the kill switch is checked every minute (it logs + pings once when it locks); "outside Otto" every 5 minutes.
      if (isTradingDay(c.date) && c.min >= 570 && c.min <= 965) { try { await lockState(true); } catch (e) { console.error("lock", e); } }
      if (isTradingDay(c.date) && c.min >= 575 && c.min <= 990 && c.min % 5 === 0) { try { await outsideSweep(); } catch (e) { console.error("outside", e); } }
      if (isTradingDay(c.date) && c.min >= 965 && c.min <= 980 && c.min % 5 === 0) { try { await prepGradeTick(); } catch (e) { console.error("prep grade", e); } }   // v3.18
      if (isTradingDay(c.date) && c.min >= 965 && c.min <= 980 && c.min % 5 === 0) { try { await hkGradeTick(); } catch (e) { console.error("homework grade", e); } }   // v3.45
    })());
    return json({ ok: true, started: "watch", clock: c.status }, 202);
  }
  if (fn0 === "winston_data") {      // v3.31: read-only market data for Winston (cron secret only; allow-list in winstonGatewayCheck)
    if (!cronAllowed(req)) return json({ ok: false, error: "bad cron secret" }, 401);
    if (req.method !== "POST") return json({ ok: false, error: "POST only" }, 405);
    const g = await winstonGateway(await req.json().catch(() => ({})));
    return json(g.out, g.status);
  }
  if (fn0 === "winston_live") {      // v4.9: live plumbing for Winston (cron secret only; closed unless live_mode is dry/on)
    if (!cronAllowed(req)) return json({ ok: false, error: "bad cron secret" }, 401);
    if (req.method !== "POST") return json({ ok: false, error: "POST only" }, 405);
    const g = await winstonLive(await req.json().catch(() => ({})));
    return json(g.out, g.status);
  }
  if (fn0 === "cron_charts") {      // v3.25: every 10 min; works only in the night (8:30–10 PM) and 8:45 AM windows
    if (!cronAllowed(req)) return json({ ok: false, error: "bad cron secret" }, 401);
    background(chartsCron().catch((e) => console.error("charts", e)));
    background(hkRemindTick().catch((e) => console.error("homework remind", e)));   // v3.45
    return json({ ok: true, started: "charts" }, 202);
  }
  if (fn0 === "chart_one") {         // v3.25: one stock per run
    if (!cronAllowed(req)) return json({ ok: false, error: "bad cron secret" }, 401);
    const bj = await req.json().catch(() => ({}));
    background(chartOne(bj).catch((e) => console.error("chart_one", e)));
    return json({ ok: true, started: "chart_one" }, 202);
  }
  if (fn0 === "check_jarvis") {      // v3.16: a scheduled check-in, as its own run
    if (!cronAllowed(req)) return json({ ok: false, error: "bad cron secret" }, 401);
    const bj = await req.json().catch(() => ({}));
    background(checkJarvis(Number(bj.id)));
    return json({ ok: true, started: "check_jarvis" }, 202);
  }
  if (fn0 === "watch_jarvis") {
    if (!cronAllowed(req)) return json({ ok: false, error: "bad cron secret" }, 401);
    const bj = await req.json().catch(() => ({}));
    background(watchJarvis(Number(bj.id), bj.d === "down" ? "down" : "up"));
    return json({ ok: true, started: "watch_jarvis" }, 202);
  }
  if (fn0 === "cron_alerts") {
    if (!cronAllowed(req)) return json({ ok: false, error: "bad cron secret" }, 401);
    const et = etParts();
    const force = new URL(req.url).searchParams.get("force") === "1";
    if (!force && (["Sat", "Sun"].includes(et.wd) || et.min < 540 || et.min > 990)) return json({ ok: true, skipped: et });
    background((async () => {
      try { await watcherCheck(); } catch (e) { console.error("watcher", e); }
      try { await exitsTick(true); } catch (e) { console.error("exits", e); }
      try { await positionReview(); } catch (e) { console.error("review", e); }
      await alertWatch(Deno.env.get("ANTHROPIC_KEY") || "");
    })());
    return json({ ok: true, started: "alerts" }, 202);
  }
  // v3.15: the 5:15 PM daily recap (pg_cron otto-daily-edt/est, 015).
  if (fn0 === "cron_daily") {
    if (!cronAllowed(req)) return json({ ok: false, error: "bad cron secret" }, 401);
    const et = etParts();
    const force = new URL(req.url).searchParams.get("force") === "1";
    if (!force && (et.min < 1020 || et.min > 1080)) return json({ ok: true, skipped: et });
    background(dailyRecap(force));
    return json({ ok: true, started: "daily" }, 202);
  }
  // v3.15: read-only feedback digest for the nightly bug check. Off unless the OTTO_DIGEST_KEY secret is set.
  if (fn0 === "feedback_digest") {
    const k = Deno.env.get("OTTO_DIGEST_KEY") || "";
    if (k.length < 16 || req.headers.get("x-otto-digest") !== k) return json({ ok: false, error: "not found" }, 404);
    return json({ ok: true, ...(await feedbackDigest()) });
  }
  if (fn0 === "cron_morning" || fn0 === "cron_weekly") {
    if (!cronAllowed(req)) return json({ ok: false, error: "bad cron secret" }, 401);
    const apiKey = Deno.env.get("ANTHROPIC_KEY") || "";
    const et = etParts();
    const force = new URL(req.url).searchParams.get("force") === "1";
    if (fn0 === "cron_morning") {
      // fires at 12:45 and 13:45 UTC; only the one that lands at 8:45 New York runs
      if (!force && (["Sat", "Sun"].includes(et.wd) || Math.abs(et.min - 525) > 20)) return json({ ok: true, skipped: et });
      background(morningRead(apiKey));
      return json({ ok: true, started: "morning" }, 202);
    }
    if (!force && (et.wd !== "Fri" || Math.abs(et.min - 990) > 20)) return json({ ok: true, skipped: et });
    background((async () => {
      await weeklyReview(apiKey, "Jarvis (Friday auto)");
      await playbookRefresh("Friday review").catch((e) => console.error("playbook", e));
      try {                                                                                   // v3.37: the coach's trade log, posted on the Desk for Josh to copy and send
        const log = await coachLog(true);
        await logDesk("system", "Otto", `📋 Weekly trade log for the coach (week of ${log.week_start}, ${log.n} trade${log.n === 1 ? "" : "s"}) — copy and send:\n\n${log.text}`);
      } catch (e) { console.error("coach log", e); }
      try {                                                                                   // v3.41: the Friday report card, right after the coach log
        const rc = await reportCard(apiKey, true);
        await logDesk("system", "Otto", rc.text);
        await notify("card", `📋 Report card: ${rc.grade}`, `Week of ${rc.week_start}. One rule for next week: ${rc.rule}`).catch(() => {});
      } catch (e) { console.error("report card", e); }
    })());
    return json({ ok: true, started: "weekly" }, 202);
  }

  const claims = jwtPayload(req.headers.get("authorization"));
  if (!claims || claims.role !== "authenticated" || !claims.sub) {
    return json({ ok: false, error: "sign in required" }, 401);
  }

  const fn = new URL(req.url).searchParams.get("fn") || "market";
  setTvRoute(fn);   // v5.3.1

  try {
    // ---- The Desk (v3.0). Locked to OTTO_ALLOWED_EMAILS, never anonymous.
    if (fn === "whoami") {
      const u = await deskUserAsync(claims);                                             // v5.0: + role, name, has_key, key_last4, model, house
      return json({ ok: true, email: claims.email || null, anonymous: !!claims.is_anonymous, desk: !!u,
        ...(u ? await ROOM.run({ owner: u.email }, () => meInfo(u)) : {}) });
    }
    if (["desk", "act", "autopilot", "bars_pull", "panel", "desk_log", "oauth_start", "oauth_finish", "conn_status", "disconnect",
         "sentiment", "market_desk", "journal", "why_out", "report_card", "trade_reason", "review_get", "review_build", "score", "morning_now", "ticket", "limits_get", "limits_set", "house_rules_get", "house_rules_set", "watch_get", "watch_set", "watch_scan", "arm_callouts", "ears_arm", "ears_dismiss", "ears_remove", "ears_fix", "ears_mode", "ears_state", "performance", "help", "jason_today", "jason_sweep", "jason_score",
         "push_key", "push_sub", "push_list", "push_remove", "push_test", "layout_get", "layout_set",
         "signals_feed", "signal_img", "signals_cfg", "signals_cfg_set", "signal_chat", "signal_chat_clear", "selftest_now",
         "playbook_get", "feedback_add", "feedback_list", "daily_now",
         "prep_get", "prep_submit", "prep_reply", "prep_watch", "prep_img", "score_extra", "check_cancel", "prep_lock",
         "charts_get", "chart_now", "chart_review", "chart_use", "chart_chat",
         "market_read",                                                                                                   // v4.0
         "activity_get", "coach_corner", "coach_report", "lock_state", "trade_live", "close_now", "coach_log", "quiz_grade", "quiz_list", "hw_get", "hw_save", "hw_submit",
         "me", "key_set", "key_clear", "model_set", "invite", "users", "user_off"].includes(fn)) {                                   // v5.0 ROOMS
      const u = await deskUserAsync(claims);
      if (!u) return json({ ok: false, locked: true,
        error: "The Desk is locked. Sign in with an invited email (Settings → Sign in)." }, 403);
      const who = u.email, isAdmin = u.role === "owner";
      // v5.0 ROOMS: everything from here on runs in this person's room — owner() is their email for every await below,
      // including background work started inside the request.
      return await ROOM.run({ owner: who }, async () => {
      const body = req.method === "POST" && fn !== "desk" ? await req.json().catch(() => ({})) : {};

      // ---- v5.0 ROOMS: me / my key / my model; admin: invite, users, user_off
      if (fn === "me") return json({ ok: true, email: who, desk: true, ...(await meInfo(u)), allowed_models: MODEL_INFO,
        conn: await db("otto_conn?" + OQ() + "select=service,connected_by,connected_at,updated_at").catch(() => []) });
      if (["key_set", "key_clear", "model_set"].includes(fn)) {
        const target = isAdmin && body?.email ? String(body.email).trim().toLowerCase() : who;       // admin may act for someone else; everyone for themselves
        if (fn === "key_set") return json(await keySet(target, String(body?.key || "")));
        if (fn === "key_clear") return json(await keyClear(target));
        return json(await modelSet(target, String(body?.model || "")));
      }
      if (["invite", "users", "user_off"].includes(fn)) {
        if (!isAdmin) return json({ ok: false, error: "admin only" }, 403);
        if (fn === "invite") return json(await inviteUser(body, who));
        if (fn === "users") return json(await usersList());
        return json(await userOff(String(body?.email || ""), who));
      }

      if (fn === "desk") {
        const rk = await roomKey();                                                      // v5.0: NoKey → the catch below
        return await desk(req, who, rk.key);
      }
      if (fn === "act" && body.why_only) return json({ ok: true, action: await whyAttach(String(body.id || ""), who, body.why, body.tp1 ?? null) });   // v5.7
      if (fn === "act") return json({ ok: true, action: await actOn(String(body.id || ""), String(body.decision || ""), who, body.decision === "approve" ? body.why : (body.why_not ?? body.why), { fill_now: !!body.fill_now }) });
      if (fn === "bars_pull") { if (!isAdmin) return json({ ok: false, error: "admin only" }, 403); return json(await barsPull(body, who)); }   // v5.9.1
      if (fn === "autopilot") return json(await autopilotRoute(req.method === "POST" ? body : null, who));   // v5.9
      if (fn === "why_out") return json(await whyOut(body, who));                                   // v3.41: the line after Close Now
      if (fn === "panel") return json(await panel());
      if (fn === "trade_live") return json(await tradeLiveAll());                                                             // v3.43: + open practice trades
      if (fn === "coach_log") return json({ ok: true, ...(await coachLog(new URL(req.url).searchParams.get("build") === "1")) });
      if (fn === "report_card") return json({ ok: true, ...(await reportCard((await roomKey().catch(() => ({ key: "" }))).key, new URL(req.url).searchParams.get("build") === "1")) });   // v5.0 room key   // v3.41   // v3.37
      if (fn === "hw_get") return json(await hkGet(new URL(req.url).searchParams.get("author") || body?.author));          // v3.45
      if (fn === "hw_save") return json(await hkSave(body));                                                                 // v3.45
      if (fn === "hw_submit") return json(await hkSubmit(body, who));                                                        // v3.45
      if (fn === "quiz_list") return json(await quizList());                                                                          // v3.38
      if (fn === "quiz_grade") return json(await quizGrade(body, who, (await roomKey()).key));                                        // v5.0 room key
      if (fn === "close_now") return json(String(body?.option_id || "").startsWith(PRAC_PREFIX) ? await closePractice(body, who) : await closeByButton(body, who));   // v3.43: "P:" = practice
      // ---- v3.1
      if (fn === "sentiment") return json(await sentimentNow(new URL(req.url).searchParams.get("force") === "1"));
      if (fn === "market_read") return json(await marketRead(new URL(req.url).searchParams.get("force") === "1"));   // v4.0: the coach's CNBC pass, every 10 min
      if (fn === "market_desk") return json(await marketDesk());
      if (fn === "journal") return json(await journal(new URL(req.url).searchParams.get("force") === "1"));
      if (fn === "trade_reason") {
        const id = String(body.id || ""), reason = String(body.reason || "").trim().slice(0, 600);
        if (!id) return json({ ok: false, error: "id required" }, 400);
        const r = await db("otto_trades?id=eq." + encodeURIComponent(id), { method: "PATCH",
          body: JSON.stringify({ reason: reason || null, reason_by: who, reason_at: new Date().toISOString() }) });
        return json({ ok: true, row: r?.[0] || null });
      }
      if (fn === "review_get") {
        const r = await db("otto_reviews?select=*&order=week_start.desc&limit=8");
        return json({ ok: true, reviews: r });
      }
      if (fn === "review_build") return json({ ok: true, review: await weeklyReview((await roomKey()).key, who) });             // v5.0 room key
      if (fn === "score") return json(await scorecard());
      // ---- v3.7 Jason's calls
      if (fn === "jason_today") return json(await jasonToday());
      if (fn === "jason_score") return json(await jasonScorecard());
      if (fn === "jason_sweep") return json(await jasonSweep(body, who));
      // ---- v3.8 your layout: one shared layout for the Desk (otto_settings "layout")
      if (fn === "signals_feed") return json(await signalsFeed(Number(new URL(req.url).searchParams.get("days") || 2)));
      if (fn === "signal_img") return json(await signalImg(Number(new URL(req.url).searchParams.get("id") || 0)));
      if (fn === "signals_cfg") return json({ ok: true, cfg: await sigCfg(), beat: await setting("signal_beat") });
      if (fn === "signals_cfg_set") return json({ ok: true, cfg: await signalsCfgSet(body, who) });
      if (fn === "signal_chat") return json(await signalChat(body, who));
      if (fn === "signal_chat_clear") return json(await signalChatClear(who));
      if (fn === "layout_get") return json({ ok: true, layout: await setting("layout") });
      if (fn === "layout_set") return json({ ok: true, layout: await layoutSet(body, who) });
      if (fn === "limits_get") return json({ ok: true, limits: await getLimits() });
      if (fn === "house_rules_get") return json({ ok: true, rules: await houseRules() });
      if (fn === "watch_get") return json(await watchGet());
      if (fn === "watch_set") return json(await watchSet(body, who));
      if (fn === "arm_callouts") return json(await armCallouts(String(body?.author || who.split("@")[0])));
      if (fn === "ears_arm") return json(await earsArm(String(body?.author || who.split("@")[0]), body?.ids));
      if (fn === "ears_dismiss") return json(await earsDismiss(String(body?.author || who.split("@")[0]), body?.ids));
      if (fn === "ears_remove") return json(await earsRemove(String(body?.author || who.split("@")[0]), String(body?.ticker || "").toUpperCase(), Number(body?.level)));
      if (fn === "ears_fix") return json(await earsFix(String(body?.author || who.split("@")[0]), String(body?.instrument || ""), String(body?.ticker || "")));
      if (fn === "ears_mode") { if (body?.mode) return json(await earsModeSet(String(body.mode), String(body?.author || who.split("@")[0]))); return json({ ok: true, mode: await earsMode() }); }
      if (fn === "ears_state") { const st: EarsState | null = await setting("ears_state").catch(() => null); return json({ ok: true, mode: await earsMode(), state: st ? { ...st, transcript: body?.words ? st.transcript : undefined, seqs: undefined } : null }); }
      // v3.25 Night Charts
      if (fn === "charts_get") return json(await chartsGet(new URL(req.url).searchParams.get("day") || undefined));
      if (fn === "chart_now") return json(await chartNow(body, who));
      if (fn === "chart_review") return json(await chartReview(body, who));
      if (fn === "chart_use") return json(await chartUse(body, who));
      if (fn === "chart_chat") return json(await chartChat(body, who));
      // v3.26: Activity log, Coaches Corner, the kill switch's state
      if (fn === "activity_get") { const q = new URL(req.url).searchParams; return json(await activityGet(Number(q.get("days")) || 7, String(q.get("kind") || "").replace(/[^a-z]/g, ""))); }
      if (fn === "coach_corner") return json(await coachCorner(String(new URL(req.url).searchParams.get("range") || "today").replace(/[^a-z0-9]/g, "")));
      if (fn === "coach_report") return json({ ok: true, ...(await coachReport()) });
      if (fn === "lock_state") return json({ ok: true, ...(await lockState(new URL(req.url).searchParams.get("fresh") === "1")), limits: await getLimits() });
      if (fn === "check_cancel") {      // v3.18: ✕ on a ⏰ chip
        const r = (await db(`otto_checks?id=eq.${Number(body.id) || 0}&status=eq.pending&select=what`, { method: "PATCH", body: JSON.stringify({ status: "cancelled" }) }).catch(() => []))?.[0];
        if (r) await logDesk("system", "Otto", `⏰ Check-in cancelled by ${String(body.author || "the Desk").slice(0, 30)}: ${String(r.what).slice(0, 160)}`);
        return json({ ok: true, cancelled: !!r });
      }
      if (fn === "watch_scan") { background(watchScan(String(body?.author || who.split("@")[0]) + " (Scan now)")); return json({ ok: true, started: "scan" }); }
      if (fn === "house_rules_set") {
        const list = await houseRulesSet(body, who);
        await logDesk("system", "Otto", `📌 House Rules updated by ${String(body?.author || who.split("@")[0]).slice(0, 40)} (${list.length} rule${list.length === 1 ? "" : "s"}). Jarvis follows them from the next message on.`);
        return json({ ok: true, rules: list });
      }
      if (fn === "playbook_get") return json({ ok: true, ...(await playbookGet()) });
      // v3.18: Morning Prep + Score additions
      if (fn === "prep_get") return json(await prepGet(new URL(req.url).searchParams.get("author") || "Ifoma"));
      if (fn === "prep_submit") return json(await prepSubmit(body));
      if (fn === "prep_reply") return json(await prepReply(body));
      if (fn === "prep_watch") return json(await prepWatch(body, who));
      if (fn === "prep_lock") return json(await prepLock(body, who));
      if (fn === "prep_img") return json(await prepImg(Number(new URL(req.url).searchParams.get("id") || 0)));
      if (fn === "score_extra") return json(await scoreExtra());
      if (fn === "feedback_add") return json({ ok: true, ...(await feedbackAdd(body, who)) });
      if (fn === "feedback_list") return json({ ok: true, items: await feedbackList(Number(new URL(req.url).searchParams.get("days")) || 14) });
      if (fn === "daily_now") { background(dailyRecap(true)); return json({ ok: true, started: true }); }
      if (fn === "push_key") return json({ ok: true, key: (await vapid()).pub });
      if (fn === "push_sub") return json({ ok: true, ...(await pushSubscribe(body, who)) });
      if (fn === "push_list") return json({ ok: true, ...(await pushList(String(body?.endpoint || ""))) });
      if (fn === "push_remove") return json(await pushRemove(body));
      if (fn === "push_test") return json(await pushTest(body));
      if (fn === "limits_set") return json({ ok: true, limits: await setLimits(body, who) });
      if (fn === "performance") return json(await performance((await roomKey().catch(() => ({ key: "" }))).key, new URL(req.url).searchParams.get("read") !== "0", new URL(req.url).searchParams.get("fresh") === "1"));   // v5.0: no key = numbers without the read
      if (fn === "help") return json({ ok: true, text: await helpAnswer(body, (await roomKey()).key) });                             // v5.0 room key
      if (fn === "ticket") return json({ ok: true, action: await orderTicket(body, who, String(body.author || "Ifoma").slice(0, 30)) });
      if (fn === "selftest_now") return json(await signalSelfTest(true));     // v3.16: run the Signal self-test on demand
      if (fn === "morning_now") {
        const apiKey = (await roomKey()).key;                                            // v5.0 room key (the read lands in this room's log)
        background(morningRead(apiKey));
        return json({ ok: true, started: true });
      }
      if (fn === "desk_log") {
        const since = Number(new URL(req.url).searchParams.get("since")) || 0;
        // v3.12: alert rows live in their own tab, so the first load fetches chat and alerts separately —
        // a busy alert day never pushes the conversation out of view.
        const cols = "otto_desk?" + OQ() + "select=id,created_at,role,author,content,action_id";   // v5.0: this room's log
        const AL = "(" + ["TradingView", "Jarvis · alert read"].map((x) => '"' + x + '"').join(",") + ")";
        const rows = since ? await db(cols + "&id=gt." + since + "&order=id.asc&limit=100")
          : [...await db(cols + "&author=not.in." + encodeURIComponent(AL) + "&order=id.desc&limit=80"),
             ...await db(cols + "&author=in." + encodeURIComponent(AL) + "&order=id.desc&limit=60")];
        const list = since ? rows : rows.sort((x: any, y: any) => x.id - y.id);
        const extra = (new URL(req.url).searchParams.get("acts") || "").split(",")
          .filter((x) => /^[0-9a-f-]{36}$/i.test(x)).slice(0, 30);
        const ids = [...new Set([...list.map((r: any) => r.action_id).filter(Boolean), ...extra])];
        const acts = ids.length ? await db("otto_actions?select=*&id=in.(" + ids.join(",") + ")") : [];
        return json({ ok: true, rows: list, actions: acts.map(publicAction) });
      }
      if (fn === "oauth_start") {
        const service = String(body.service || "");
        return json({ ok: true, url: await oauthStart(service, who), paste: !!SVC[service]?.redirect });
      }
      if (fn === "oauth_finish") {
        const service = await oauthFinish(String(body.code || ""), String(body.state || ""), who);
        let tools = 0, warn = null;
        try { tools = (await mcpTools(service)).length; } catch (e) { warn = (e as Error).message; }
        await logDesk("system", "Otto", `${SVC[service].name} connected by ${who}`);
        return json({ ok: true, service, name: SVC[service].name, tools, warn });
      }
      if (fn === "conn_status") {
        const rows = await db("otto_conn?" + OQ() + "select=service,connected_by,connected_at,updated_at");   // v5.0: this room's
        return json({ ok: true, conn: rows });
      }
      if (fn === "disconnect") {
        const s = String(body.service || "");
        if (!SVC[s]) return json({ ok: false, error: "unknown service" }, 400);
        await db("otto_conn?" + OQ() + "service=eq." + s, { method: "DELETE" });        // v5.0: this room's row only
        delete TOK[ck(s)]; delete MSESS[ck(s)];
        return json({ ok: true });
      }
      return json({ ok: false, error: "unknown fn" }, 400);
      });   // ROOM.run
    }

    if (fn === "market") {
      const { quotes, errors } = await fetchQuotes();
      return json({ ok: true, source: "yahoo", served: Math.floor(Date.now() / 1000),
        quotes, errors });
    }

    if (fn === "brain") {
      return json({ ok: true, calls: await loadBrain() });
    }

    // One-shot: copy the corpus out of the public repo into Postgres, so
    // Jason's transcripts stop being readable by anyone with the URL. Run once,
    // then delete brain-latest.json from the repo. Idempotent — re-running just
    // writes another version row, and the newest wins.
    if (fn === "seed") {
      const base = Deno.env.get("SUPABASE_URL");
      const svc  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
      if (!base || !svc) return json({ ok: false, error: "service role not available" }, 500);

      // v3.24 (C6): POST a JSON array of week files. The public repo copy is gone, so GET no longer seeds.
      if (req.method !== "POST") return json({ ok: false, error: "seed takes a POST with the corpus (a JSON array of week files)" }, 405);
      const payload: any = await req.json().catch(() => null);
      if (!Array.isArray(payload) || !payload.length) {
        return json({ ok: false, error: "that did not look like a corpus" }, 502);
      }

      const ins = await fetch(base + "/rest/v1/brain_versions", {
        method: "POST",
        headers: { apikey: svc, authorization: "Bearer " + svc,
                   "content-type": "application/json", prefer: "return=representation" },
        body: JSON.stringify({ notes: "seeded by POST", payload }),
      });
      if (!ins.ok) return json({ ok: false, error: "insert failed: " + (await ins.text()).slice(0, 200) }, 502);
      const row = await ins.json();
      BRAIN = null;                                   // drop the cached copy
      let callouts = false; try { callouts = await postCallouts(payload); } catch { /* the seed already worked */ }   // v4.5
      return json({ ok: true, seeded: payload.length, callouts,
                    version: Array.isArray(row) && row[0] ? row[0].version : null });
    }

    // A plain, non-streaming Claude call for the app's smaller jobs: drafting
    // Josh's email to Jason, and reading a raw .vtt into a week file. Same key,
    // same place, so there is still nothing to configure on a device.
    if (fn === "write") {
      const apiKey = Deno.env.get("ANTHROPIC_KEY");
      if (!apiKey) return json({ ok: false, error: "ANTHROPIC_KEY secret is not set" }, 500);
      const b = await req.json().catch(() => ({}));
      if (!b.system || !b.user) return json({ ok: false, error: "system and user required" }, 400);
      const r = await aiFetch("write", {
        method: "POST",
        headers: { "content-type": "application/json", "x-api-key": apiKey,
                   "anthropic-version": "2023-06-01" },
        body: JSON.stringify({
          model: MODEL,
          max_tokens: Math.min(Number(b.max_tokens) || 1200, 8000),
          system: String(b.system).slice(0, 60000),
          messages: [{ role: "user", content: String(b.user).slice(0, 200000) }],
        }),
      });
      const j = await r.json();
      if (j.error) return json({ ok: false, error: j.error.message || "API error" }, 502);
      return json({ ok: true, text: (j.content || []).filter((c: any) => c.type === "text")
                                    .map((c: any) => c.text).join("") });
    }

    // The morning plan of attack, graded. Non-streaming, optionally with a
    // chart screenshot (base64). Same corpus, same refusals as the Coach.
    if (fn === "plan") {
      const apiKey = Deno.env.get("ANTHROPIC_KEY");
      if (!apiKey) return json({ ok: false, error: "ANTHROPIC_KEY secret is not set" }, 500);
      const b = await req.json().catch(() => ({}));
      const plan = (b && b.plan) || {};
      if (!plan.sym && !plan.notes) return json({ ok: false, error: "plan is empty" }, 400);
      const img = b.image && typeof b.image.data === "string" && b.image.data.length > 100 ? b.image : null;
      if (img && img.data.length > 6_000_000) return json({ ok: false, error: "image too large" }, 400);
      const calls = await loadBrain();
      const cs = chunksOf(calls);
      // three searches, deliberately different wording — the plan's own words,
      // the entry mechanics, and the standing risk rules — merged and deduped
      const queries = [
        `${plan.sym || ""} ${plan.notes || ""} ${plan.why || ""}`.slice(0, 400),
        `${plan.sym || ""} entry level reclaim box gap confirmation first red candle expansion`,
        "swing binary event NFP earnings expiry Friday Tuesday P&L chart catalyst indicators mindset",
      ];
      const seen = new Set<string>(); const hits: Chunk[] = [];
      for (const q of queries) for (const h of search(cs, q, 10)) {
        const k = h.d + "|" + h.at + "|" + h.s.slice(0, 50);
        if (!seen.has(k)) { seen.add(k); hits.push(h); }
      }
      const sys = PLAN_SYS.replace("{{RULES}}", alwaysOn(calls))
                          .replace("{{MATERIAL}}", hits.slice(0, 24).map(fmt).join("\n\n"));
      const content: any[] = [];
      if (img) content.push({ type: "image", source: { type: "base64",
        media_type: /^image\/(jpeg|png|webp|gif)$/.test(img.media_type) ? img.media_type : "image/jpeg", data: img.data } });
      content.push({ type: "text", text: planText({ ...plan, hasImage: !!img }) });
      const r = await aiFetch("plan", {
        method: "POST",
        headers: { "content-type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({
          model: MODEL, max_tokens: 1500,
          system: [{ type: "text", text: sys + NAME_RULE, cache_control: { type: "ephemeral" } }],
          messages: [{ role: "user", content }],
        }),
      });
      const j = await r.json();
      if (j.error) return json({ ok: false, error: j.error.message || "API error" }, 502);
      return json({ ok: true, text: (j.content || []).filter((c: any) => c.type === "text")
                                    .map((c: any) => c.text).join(""), retrieved: hits.length });
    }

    // Jason's six-step routine, live, no key on the device. ?watch=WMT,TGT,... for step 5.
    if (fn === "routine") {
      const watch = (new URL(req.url).searchParams.get("watch") || "").split(",").map((s) => s.trim()).filter(Boolean).slice(0, 25);
      return json(await routine(watch));
    }

    // The story behind the numbers — Claude with web search, cached 10 minutes.
    if (fn === "news") {
      const apiKey = Deno.env.get("ANTHROPIC_KEY");
      if (!apiKey) return json({ ok: false, error: "ANTHROPIC_KEY secret is not set" }, 500);
      if (NEWS_CACHE && Date.now() - NEWS_CACHE.at < 600_000) return json({ ok: true, text: NEWS_CACHE.text, at: NEWS_CACHE.at, cached: true });
      const text = await whatsMoving(apiKey);
      NEWS_CACHE = { at: Date.now(), text };
      return json({ ok: true, text, at: NEWS_CACHE.at });
    }

    if (fn === "chat") {
      const apiKey = Deno.env.get("ANTHROPIC_KEY");
      if (!apiKey) return json({ ok: false, error: "ANTHROPIC_KEY secret is not set" }, 500);
      const calls = await loadBrain();
      const sys = SYSTEM.replace("{{RULES}}", alwaysOn(calls));
      return await chat(req, sys, chunksOf(calls), apiKey);
    }

    return json({ ok: false, error: "unknown fn" }, 400);
  } catch (e) {
    if (e instanceof NoKey) return json({ ok: false, no_key: true, error: e.message }, 400);   // v5.0: the room has no Anthropic key yet
    // Never fabricate. The app is built to say "not enough" rather than guess.
    return json({ ok: false, error: String((e as Error).message ?? e).slice(0, 300) }, 502);
  }
});

// test hooks (v3.20)
export const placeStopForTest = placeStop;
export const clearCacheForTest = () => { for (const k of Object.keys(CACHE)) delete CACHE[k]; };   // v3.26 tests
export const setLimitsForTest = setLimits;
export const watchFromSignalsForTest = watchFromSignals;
export const deskSetupForTest = deskSetup;

export const closeNowForTest = closeNow;
// v5.0 ROOMS test hooks
export const deskUserAsyncForTest = deskUserAsync;
export const roomKeyForTest = roomKey;
export const accessTokenForTest = accessToken;
export const roomRunForTest = <T>(o: string, f: () => Promise<T>) => ROOM.run({ owner: o }, f);
export const ownerForTest = owner;
export const sealForTest = seal;
export const NoKeyForTest = NoKey;
export const HOUSE_FOR_TEST = HOUSE;

/* ============================================================ v3.22 (8 Oct 2026) — Jarvis never states made-up facts
   Decisions (Ifoma, 8 Oct; claude/otto-v322-facts.md):
   1. Card levels (entry / wrong-if / TP1) more than 10% from the live price → sent back once, then no card (Desk says why).
      Watcher levels more than 10% off are refused too (7 Oct: AAPL 233/237 with AAPL ~335).
   2. A Signal post whose price doesn't fit its ticker (or has no ticker) is matched by price against the TradingView
      watchlists (Treasure Hunt, Watchlist) + tickers the coach named in the last 5 trading days, within 10%.
      One match → that ticker. None / several → no card; the Desk asks which stock (7 Oct: "HEADING TO 1074" read as ABBV, was MU).
   3. A cited coaching call / date that isn't in the brain is removed: "(source not found)" (7 Oct: "Oct 3 call").
   4. The daily recap's trades come from Robinhood's own orders and fills, written by the server (7 Oct: an unfilled
      NVDA 240P called a "win", the 237.5P "−1R" was ~−$15, ABBV "failed to fill" was a Robinhood rejection).
   5. "None" claims (no prep / no fills / no signals today) are checked against the data; false ones are corrected
      before the reply is saved, and today's facts sit in Jarvis's context so he looks first.
   6. Robinhood's exact reject / cancel reason on the card and the Desk. Order args Robinhood's tool doesn't take
      (7 Oct ABBV: chain_symbol) are removed before the card is made. */

const V322_FAR = 0.10;
const v322Sym = (s: any) => String(s || "").toUpperCase().split(":").pop()!.replace(/[^A-Z.]/g, "").slice(0, 8);

export async function rhPrices(syms: string[]): Promise<Record<string, number>> {
  const list = [...new Set((syms || []).map(v322Sym).filter(Boolean))].slice(0, 60);
  if (!list.length) return {};
  return await cached("px|" + list.slice().sort().join(","), 30e3, async () => {
    const out: Record<string, number> = {};
    for (let i = 0; i < list.length; i += 25) {
      const chunk = list.slice(i, i + 25);
      try {
        const j = mcpJson(await withTimeout(call("rh", "get_equity_quotes", { symbols: chunk }), 10_000, "Robinhood quotes"));
        const res = j?.data?.results || j?.results || [];
        (Array.isArray(res) ? res : []).forEach((r: any, k: number) => {
          const q = r?.quote || r || {};
          const sym = v322Sym(q.symbol || r?.symbol || chunk[k]);
          const reg = num(q.last_trade_price), ext = num(q.last_non_reg_trade_price);
          const px = ext && Date.parse(q.venue_last_non_reg_trade_time || 0) > Date.parse(q.venue_last_trade_time || 0) ? ext : reg;
          if (sym && px > 0) out[sym] = px;
        });
      } catch { /* unknown stays unknown — every check below fails open */ }
    }
    return out;
  });
}
const pctOff = (v: number, spot: number) => Math.abs(v / spot - 1);

/* ---- 1. levels vs the live price ---- */
export function farLevels(plan: any, spot: number): string[] {
  const out: string[] = [];
  if (!(spot > 0) || !plan) return out;
  const chk = (name: string, v: any) => { const n = Number(v); if (n > 0 && pctOff(n, spot) > V322_FAR) out.push(`${name} ${n} is ${Math.round(pctOff(n, spot) * 100)}% away`); };
  chk("entry", plan.entry_underlying); chk("wrong-if", plan.stop); chk("TP1", plan.tp1);
  return out;
}
export async function levelGate(plan: any) {
  const tk = v322Sym(plan?.tv_symbol);
  if (!tk) return;
  const spot = (await rhPrices([tk]).catch(() => ({} as Record<string, number>)))[tk];
  if (!(spot > 0)) return;
  const bad = farLevels(plan, spot);
  const key = `${tk}|${plan.direction}`;
  const tries: Record<string, number> = (await setting("level_tries").catch(() => null)) || {};
  if (!bad.length) { if (tries[key]) { delete tries[key]; await putSetting("level_tries", tries).catch(() => {}); } return; }
  const what = `${tk} is $${spot.toFixed(2)} right now; ${bad.join(", ")}`;
  if (tries[key] && Date.now() - tries[key] < 10 * 60e3) {
    delete tries[key]; await putSetting("level_tries", tries).catch(() => {});
    await logDesk("system", "Otto", `No card for ${tk} ${plan.direction === "down" ? "puts" : "calls"}: the levels didn't match the live price on the second try (${what}).`);
    throw new Error(`NO CARD — second try still off: ${what}. Do not propose this again. Tell them in one line there's no card because the levels don't match the live price.`);
  }
  tries[key] = Date.now(); await putSetting("level_tries", tries).catch(() => {});
  throw new Error(`Levels don't match the live price: ${what} (more than 10%). Re-check every level against the live price and propose again — one more try, then no card.`);
}
export async function watchLevelGate(ticker: string, level: number) {
  const px = (await rhPrices([ticker]).catch(() => ({} as Record<string, number>)))[v322Sym(ticker)];
  if (px > 0 && pctOff(level, px) > V322_FAR)
    throw new Error(`${v322Sym(ticker)} ${level} is ${Math.round(pctOff(level, px) * 100)}% from the live price $${px.toFixed(2)} — not added. Check the level (and the ticker).`);
}

/* ---- 6. order args Robinhood doesn't take, and its exact reasons ---- */
export function pruneArgs(args: any, schema: any): string[] {
  const removed: string[] = [];
  const walk = (o: any, s: any, path: string) => {
    if (!o || typeof o !== "object" || !s || typeof s !== "object") return;
    if (Array.isArray(o)) { if (s.items) o.forEach((x) => walk(x, s.items, path)); return; }
    const p = s.properties;
    if (!p || typeof p !== "object" || !Object.keys(p).length) return;
    for (const k of Object.keys(o)) {
      if (!(k in p)) { if (path === "" && (k === "account_number" || k === "ref_id")) continue; delete o[k]; removed.push(path + k); continue; }
      walk(o[k], p[k], path + k + ".");
    }
  };
  walk(args, schema, "");
  return removed;
}
async function rhSchema(tool: string): Promise<any> {
  try {
    const list = TEST ? (TEST.tools ? await TEST.tools("rh") : null) : await withTimeout(mcpTools("rh"), 8000, "Robinhood tools");
    return (list || []).find((t: any) => t.name === tool)?.inputSchema || null;
  } catch { return null; }
}
export function brokerReason(msg: string): string {
  const s = String(msg || "");
  const m = s.match(/\{[\s\S]*\}/);
  if (m) {
    try {
      const j = JSON.parse(m[0]);
      const pick = (o: any): string => !o ? "" : typeof o === "string" ? o : Array.isArray(o) ? o.map(pick).filter(Boolean).join("; ")
        : pick(o.detail ?? o.message ?? o.reason ?? o.error ?? o.non_field_errors ?? Object.entries(o).map(([k, v]) => `${k}: ${pick(v)}`).join("; "));
      const r = pick(j); if (r) return r.slice(0, 300);
    } catch { /* not JSON */ }
  }
  return s.replace(/^Error:\s*/, "").slice(0, 300);
}
export function orderReason(o: any): string {
  for (const k of ["reject_reason", "rejection_reason", "cancel_reason", "state_reason", "reason", "message", "detail", "error"]) {
    const v = o?.[k];
    if (typeof v === "string" && v.trim()) return v.trim().slice(0, 200);
    if (v && typeof v === "object") { const d = v.detail || v.message || v.reason; if (typeof d === "string" && d.trim()) return d.trim().slice(0, 200); }
  }
  return "";
}

/* ---- 2. a Signal's ticker must fit its price ---- */
async function matchPool(): Promise<string[]> {
  return await cached("matchpool", 30 * 60e3, async () => {
    const syms = new Set<string>();
    try {
      const j = mcpJson(await withTimeout(call("tv", "mcp-watchlist-list-watchlists", {}), 6000, "TradingView watchlists"));
      for (const w of j?.watchlists || []) if (/treasure|^\s*watch\s*list\s*$/i.test(String(w.name || "")))
        for (const s of w.symbols || []) if (/^(NASDAQ|NYSE|AMEX|ARCA|BATS|NYSEARCA|CBOE BZX):[A-Z.]+$/.test(String(s))) syms.add(v322Sym(s));
    } catch { /* TradingView slow: the saved copy below */ }
    try { const wc = await setting("watch_cache"); for (const s of wc?.syms || []) if (/^(NASDAQ|NYSE|AMEX|ARCA|BATS):/.test(String(s))) syms.add(v322Sym(s)); } catch { /* */ }
    try {
      let d = etParts().date; for (let n = 0; n < 5; ) { d = addDays(d, -1); if (isTradingDay(d)) n++; }
      const rows = await db(`otto_jason?select=ticker&day=gte.${d}&limit=500`);
      for (const r of rows || []) if (r?.ticker) syms.add(v322Sym(r.ticker));
    } catch { /* */ }
    syms.delete("");
    return [...syms];
  });
}
export function priceMatches(level: number, prices: Record<string, number>): string[] {
  return Object.entries(prices).filter(([, p]) => p > 0 && pctOff(level, p) <= V322_FAR).map(([s]) => s);
}
// Returns the posts with tickers fixed (one clear price match) or cleared (none / several), plus what to ask.
export async function verifyTickers(posts: any[]): Promise<{ posts: any[]; asks: string[] }> {
  const asks: string[] = [];
  const need = (posts || []).filter((p: any) => (p.kind === "call" || p.kind === "level") && (Number(p.entry) > 0 || Number(p.level) > 0));
  if (!need.length) return { posts, asks };
  let pool: string[] = [];
  try { pool = await matchPool(); } catch { /* */ }
  const prices = await rhPrices([...new Set([...pool, ...need.map((p: any) => v322Sym(p.ticker)).filter(Boolean)])]).catch(() => ({} as Record<string, number>));
  for (const p of need) {
    const lv = Number(p.entry) > 0 ? Number(p.entry) : Number(p.level);
    const tk = v322Sym(p.ticker);
    if (tk && prices[tk] > 0 && pctOff(lv, prices[tk]) <= V322_FAR) continue;        // fits — keep it
    if (tk && !(prices[tk] > 0)) continue;                                            // can't price it (futures, index) — leave it
    const poolPx: Record<string, number> = {};
    for (const s of pool) if (prices[s] > 0) poolPx[s] = prices[s];
    const m = priceMatches(lv, poolPx);
    if (m.length === 1) {
      p.ticker_was = tk || null; p.ticker = m[0];
      p.summary = `${p.summary || ""} [ticker matched by price: ${lv} ≈ ${m[0]} $${prices[m[0]].toFixed(2)}${tk ? `; ${tk} is $${prices[tk].toFixed(2)}` : ""}]`.trim();
      continue;
    }
    p.ticker_was = tk || null; p.ticker = "";
    asks.push(`⚡ Signal "${String(p.words || "").slice(0, 80)}": which stock? ${lv} ${tk ? `doesn't fit ${tk} ($${prices[tk].toFixed(2)})` : "came with no ticker"}` +
      (m.length ? `, and it fits more than one: ${m.map((s) => `${s} $${prices[s].toFixed(2)}`).join(", ")}` : ", and nothing on your watchlists or recent signals trades near it") +
      `. No card until you say which — tell Jarvis on the Desk.`);
  }
  return { posts, asks };
}

/* ---- 3 + 5. citations and "none" claims ---- */
const MON3: Record<string, number> = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
const DATE_RE = "(?:(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\\.?\\s+\\d{1,2}(?:st|nd|rd|th)?(?:,?\\s*20\\d\\d)?|\\d{1,2}\\/\\d{1,2}(?:\\/(?:20)?\\d\\d)?|20\\d\\d-\\d\\d-\\d\\d)";
export function mdOf(s: string): string | null {
  let m = /^(20\d\d)-(\d\d)-(\d\d)$/.exec(s.trim());
  if (m) return `${m[2]}-${m[3]}`;
  m = /^(\d{1,2})\/(\d{1,2})/.exec(s.trim());
  if (m) return `${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}`;
  m = /^([A-Za-z]{3})[a-z]*\.?\s+(\d{1,2})/.exec(s.trim());
  if (m && MON3[m[1].toLowerCase()]) return `${String(MON3[m[1].toLowerCase()]).padStart(2, "0")}-${m[2].padStart(2, "0")}`;
  return null;
}
export function checkCitations(text: string, callDates: string[], today = etParts().date): { text: string; removed: string[] } {
  const ok = new Set(callDates.map((d) => mdOf(String(d))).filter(Boolean) as string[]);
  const todayMd = mdOf(today)!;
  const removed: string[] = [];
  const bad = (d: string) => { const md = mdOf(d); return !!md && md <= todayMd && !ok.has(md); };
  let t = String(text || "");
  // (Otto Rules, Oct 3, 12:34) / (coaching call, 10/3)
  t = t.replace(new RegExp(`\\(([^()]*?\\b(?:Otto Rules|coaching call|call)\\b[^()]*?)\\)`, "gi"), (all, inner) => {
    if (!/Otto Rules|coaching call/i.test(inner) && !/\bcall\b/i.test(inner)) return all;
    const d = new RegExp(DATE_RE, "i").exec(inner);
    if (!d || !bad(d[0])) return all;
    if (!/Otto Rules|coach/i.test(inner) && !/^\s*,?\s*(?:coaching\s+)?call\b\s*(?:,\s*\d{1,2}:\d{2}(?::\d{2})?)?\s*$/i.test(inner.replace(d[0], ""))) return all;
    removed.push(all); return "(source not found)";
  });
  // "the Oct 3 call" / "on the Oct 3 coaching call" / "the call on Oct 3" — only in a sentence about the coach / rules.
  t = t.split(/(?<=[.!?\n])/).map((sent) => {
    if (!/coach|Otto Rules|taught|said|says|recording|session|covered|went over/i.test(sent)) return sent;
    return sent
      .replace(new RegExp(`\\b(?:(on|in|from)\\s+)?(?:the\\s+)?(${DATE_RE})(?:'s)?\\s+(?:coaching\\s+)?call\\b`, "gi"), (all, pre, d) => {
        if (!bad(d)) return all; removed.push(all.trim()); return (pre ? pre + " " : "") + "a call (source not found)"; })
      .replace(new RegExp(`\\b(?:coaching\\s+)?call\\s+(?:on|from)\\s+(${DATE_RE})`, "gi"), (all, d) => {
        if (!bad(d)) return all; removed.push(all.trim()); return "call (source not found)"; });
  }).join("");
  return { text: t, removed };
}

async function dayOrders(day: string): Promise<any[]> {
  return await cached("ord|" + day, 60e3, async () => {
    const acct = await agenticAccount();
    const j = mcpJson(await withTimeout(call("rh", "get_option_orders", { account_number: acct, created_at_gte: `${day}T04:00:00Z` }), 10_000, "Robinhood orders"));
    return (j?.data?.orders || []).filter((o: any) => !o.created_at || etParts(new Date(o.created_at)).date === day);
  });
}
export async function todayFacts(day = etParts().date): Promise<{ prep: any[] | null; sig: any[] | null; ord: any[] | null; cards?: any[] | null }> {
  return await cached("facts|" + day, 60e3, async () => {
    const [prep, sig, ord, cards] = await Promise.all([
      db(`otto_prep?select=author,created_at,status&day=eq.${day}`).catch(() => null),
      db(`otto_jason?select=id,ticker,kind,posted_label&day=eq.${day}&limit=200`).catch(() => null),
      dayOrders(day).catch(() => null),
      todaysCards(day).catch(() => null),                                      // v3.44 fix 5
    ]);
    return { prep, sig, ord, cards };
  });
}
// v3.44: today's cards (ET day), for the tally Jarvis reads and the claim checker's practice list.
async function todaysCards(day = etParts().date): Promise<any[]> {
  const start = nyIso(day, "12:00 AM") || `${day}T04:00:00Z`;
  return (await db(`otto_actions?${OQ()}select=id,title,status,plan,created_at&created_at=gte.${start}&order=created_at.asc&limit=300`)) || [];
}
export function factsLine(f: { prep: any[] | null; sig: any[] | null; ord: any[] | null; cards?: any[] | null }): string {
  const pr = f.prep == null ? "unknown" : f.prep.length ? f.prep.map((p: any) => `${p.author} ${etHM(p.created_at)}`).join(", ") : "none";
  const fl = f.ord == null ? "unknown" : f.ord.length ? `${f.ord.length} (${f.ord.filter((o: any) => o.state === "filled").length} filled, ${f.ord.filter((o: any) => EXIT_DEAD_ORDER.has(o.state)).length} cancelled/rejected)` : "none";
  const sg = f.sig == null ? "unknown" : f.sig.length ? `${f.sig.length} (${f.sig.filter((r: any) => r.kind === "call").length} calls)` : "none";
  return `TODAY SO FAR (checked by the server — never say "none" of these without checking; the server corrects a false "none"): morning reads: ${pr}; Agentic option orders: ${fl}; coach signal posts: ${sg}. ` +
    `Cite a coaching call only by a date you got from search_jason — a call date that isn't in the brain is removed as "(source not found)".` +
    (f.ord ? " " + tradesLine(dayFacts(f.ord)) : "") +   // v3.24
    (f.cards ? " " + cardsTodayLine(f.cards) + " A card Josh rejected with a why is REJECTED (say so), never \"pending\", \"expired\" or \"not approved\"." : "");   // v3.44 fix 5
}
const NONE_CLAIMS = [
  { kind: "prep", re: /[^.!?\n]*\b(?:no|don't have|do not have|haven't (?:seen|got|gotten|received)|didn't (?:see|get)|don't see|nobody (?:has )?posted|hasn't posted|no one posted)\s+(?:[\w']+\s+){0,3}?(?:prep|morning reads?|morning sentiment|plan of attack|pre-market plan)\b[^.!?\n]*[.!?]?/gi },
  { kind: "fills", re: /[^.!?\n]*\b(?:no|zero|nothing)\s+(?:\w+\s+){0,2}(?:fills?|filled|trades? (?:taken|placed|made|filled))\b[^.!?\n]*\b(?:today|so far)\b[^.!?\n]*[.!?]?/gi },
  { kind: "signals", re: /[^.!?\n]*\b(?:no|zero)\s+(?:new\s+)?(?:signals?|(?:coach|mentor)(?:'s)? posts?|posts? from the coach)\b(?!\s+cards?)[^.!?\n]*\b(?:today|yet|so far)\b[^.!?\n]*[.!?]?/gi },
];
export function checkNoneClaims(text: string, f: { prep: any[] | null; sig: any[] | null; ord: any[] | null }): { text: string; notes: string[] } {
  const notes: string[] = [];
  let t = String(text || "");
  for (const c of NONE_CLAIMS) {
    const data = c.kind === "prep" ? f.prep : c.kind === "signals" ? f.sig : (f.ord || null)?.filter((o: any) => o.state === "filled") ?? null;
    if (!data || !data.length) continue;
    const fix = c.kind === "prep" ? `there IS a morning read today (${data.map((p: any) => `${p.author}, ${etHM(p.created_at)}`).join("; ")})`
      : c.kind === "signals" ? `the coach HAS posted today (${data.length} post${data.length > 1 ? "s" : ""}${data.some((r: any) => r.ticker) ? ": " + [...new Set(data.map((r: any) => r.ticker).filter(Boolean))].slice(0, 6).join(", ") : ""})`
      : `there ARE fills today (${data.length} filled order${data.length > 1 ? "s" : ""} in the Agentic account)`;
    t = t.replace(c.re, (s) => { if (!s.trim()) return s; notes.push(`⚠ Correction (Otto checked): ${fix}.`); return ` [Corrected by Otto: ${fix}.]`; });
  }
  return { text: t, notes: [...new Set(notes)] };
}
export async function factCheck(text: string): Promise<{ text: string; notes: string[] }> {
  let t = String(text || "");
  const notes: string[] = [];
  if (!t.trim()) return { text: t, notes };
  try {
    if (new RegExp(DATE_RE, "i").test(t) && /call|Otto Rules/i.test(t)) {
      const dates = (await withTimeout(loadBrain(), 6000, "brain")).map((c: any) => c?.call?.date).filter(Boolean);
      if (dates.length) {
        const c = checkCitations(t, dates);
        if (c.removed.length) { t = c.text; notes.push(`⚠ Source check: ${c.removed.map((r) => `"${r}"`).join(", ")} isn't in the coaching calls — removed (source not found).`); }
      }
    }
  } catch { /* fail open */ }
  try {
    if (NONE_CLAIMS.some((c) => { c.re.lastIndex = 0; const hit = c.re.test(t); c.re.lastIndex = 0; return hit; })) {
      const f = await withTimeout(todayFacts(), 8000, "today's facts");
      const n = checkNoneClaims(t, f);
      t = n.text; notes.push(...n.notes);
    }
  } catch { /* fail open */ }
  try { const v = await factCheck324(t); t = v.text; notes.push(...v.notes); } catch { /* v3.24, fail open */ }
  try { const v = await factCheck326(t); t = v.text; notes.push(...v.notes); } catch { /* v3.26, fail open */ }
  return { text: t, notes };
}

/* ---- 4. the recap's trades, from Robinhood ---- */
const legLabel = (o: any, l: any) => {
  const sym = String(o.chain_symbol || l.chain_symbol || "").toUpperCase();
  const k = Number(l.strike_price), ty = l.option_type === "put" ? "P" : l.option_type === "call" ? "C" : "";
  const ex = l.expiration_date ? " " + String(l.expiration_date).slice(5).replace("-", "/") : "";
  return k > 0 ? `${sym} ${k % 1 ? k : Math.round(k)}${ty}${ex}` : `${sym} option ${String(l.option_id || "").slice(0, 8)}`;
};
const avgFill = (o: any, l: any) => {
  const ex = l?.executions || [];
  const q = ex.reduce((s: number, x: any) => s + Number(x.quantity), 0);
  return q ? { q, px: ex.reduce((s: number, x: any) => s + Number(x.price) * Number(x.quantity), 0) / q }
    : o.state === "filled" ? { q: Number(o.processed_quantity || o.quantity || 0), px: Number(o.average_price || o.price || 0) } : { q: 0, px: 0 };
};
/* v3.44 fix 5: practice trades are practice. A practice fill (paper_taken, plan.paper_fill) never reaches Robinhood, and a card Josh
   rejected with a why (plan.josh_reject_why) was REJECTED, not "pending / expired / not approved" (22 Oct: LLY 1325C, LLY 1300P,
   NVDA 207.5P; "21 cards made · 0 approved" with 5 practice trades taken). Duplicates voided by the server don't count. */
export function cardTally(acts: any[]) {
  const A = (acts || []).filter((a: any) => !a?.plan?.duplicate_of);
  const lab = (a: any) => { const m = String(a.title || "").match(/\b([A-Z]{1,5})\s+(\d{1,5}(?:\.\d{1,2})?[CP])\b/); return m ? `${m[1]} ${m[2]}` : unstampTitle(a.title).slice(0, 40); };
  const rejJosh = A.filter((a: any) => a.status === "rejected" && a.plan?.josh_reject_why);
  return {
    made: A.length,
    live: A.filter((a: any) => ["done", "failed", "running"].includes(a.status)).length,
    practice: A.filter((a: any) => a.status === "paper_taken"),
    rejected_josh: rejJosh,
    rejected_other: A.filter((a: any) => a.status === "rejected" && !a.plan?.josh_reject_why).length,
    expired: A.filter((a: any) => a.status === "expired").length,
    auto: A.filter((a: any) => a.status === "paper").length,
    waiting: A.filter((a: any) => ["pending", "paper_wait"].includes(a.status)).length,
    failed: A.filter((a: any) => a.status === "failed"),
    lab,
  };
}
export function practiceTargets(acts: any[]): { sym: string; strike: number; side: string }[] {
  return (acts || []).filter((a: any) => a.status === "paper_taken" && !a.plan?.duplicate_of).map((a: any) => {
    const sym = String(a.plan?.tv_symbol || "").split(":").pop()?.toUpperCase() || (String(a.title || "").match(/\b([A-Z]{1,5})\s+\d/) || [])[1] || "";
    const m = String(a.title || "").match(/\b(\d{1,5}(?:\.\d{1,2})?)([CP])\b/);
    return { sym, strike: m ? Number(m[1]) : NaN, side: m ? (m[2] === "P" ? "put" : "call") : a.plan?.direction === "down" ? "put" : "call" };
  }).filter((t) => t.sym);
}
export function cardsTodayLine(acts: any[]): string {
  const k = cardTally(acts);
  if (!k.made) return "Cards today: none.";
  return `Cards today: ${k.made} made · ${k.live} approved LIVE · ${k.practice.length} practice trade${k.practice.length === 1 ? "" : "s"} taken${k.practice.length ? ` (${k.practice.map(k.lab).join(", ")}; practice fills are never sent to Robinhood, so Robinhood will not show them)` : ""} · ${k.rejected_josh.length} rejected by Josh with a why${k.rejected_josh.length ? ` (${k.rejected_josh.map((a: any) => `${k.lab(a)}: "${String(a.plan.josh_reject_why.why_not || "").slice(0, 60)}"`).join("; ")})` : ""}` +
    `${k.rejected_other ? ` · ${k.rejected_other} rejected` : ""} · ${k.expired} expired · ${k.auto} auto-rejected${k.waiting ? ` · ${k.waiting} still waiting` : ""}.`;
}
export function recapTradesBlock(orders: any[], acts: any[]): string {
  const lines: string[] = [];
  let realized = 0, closedAny = false;
  const opens = (orders || []).filter((o: any) => (o.legs || []).some((l: any) => l.position_effect === "open")).sort((a: any, b: any) => String(a.created_at || "").localeCompare(String(b.created_at || "")));
  const closes = (orders || []).filter((o: any) => (o.legs || []).some((l: any) => l.position_effect === "close") && o.state === "filled");
  for (const o of opens) {
    const l = (o.legs || []).find((x: any) => x.position_effect === "open");
    const lab = legLabel(o, l), t = o.created_at ? etHM(o.created_at) + " " : "";
    if (o.state === "filled") {
      const b = avgFill(o, l);
      const sells = closes.filter((c: any) => (c.legs || []).some((x: any) => x.option_id === l.option_id));
      const sq = sells.reduce((s: number, c: any) => s + avgFill(c, c.legs.find((x: any) => x.option_id === l.option_id)).q, 0);
      const sv = sells.reduce((s: number, c: any) => { const f = avgFill(c, c.legs.find((x: any) => x.option_id === l.option_id)); return s + f.q * f.px; }, 0);
      if (sq > 0) {
        const pnl = (sv / sq - b.px) * 100 * Math.min(sq, b.q);
        realized += pnl; closedAny = true;
        lines.push(`- ${t}${lab}: bought ${b.q} @ $${b.px.toFixed(2)} → sold @ $${(sv / sq).toFixed(2)} = ${pnl >= 0 ? "+" : "−"}$${Math.abs(pnl).toFixed(0)}${sq < b.q ? ` (${b.q - sq} still open)` : ""}`);
      } else lines.push(`- ${t}${lab}: bought ${b.q} @ $${b.px.toFixed(2)} — still open`);
    } else if (EXIT_DEAD_ORDER.has(o.state)) {
      const why = orderReason(o);
      lines.push(`- ${t}${lab}: ${o.state === "rejected" || o.state === "failed" ? "REJECTED by Robinhood" : o.state} — never filled${why ? ` (Robinhood: ${why})` : ""}`);
    } else lines.push(`- ${t}${lab}: order ${o.state} — not filled yet`);
  }
  const K = cardTally(acts || []);
  const failed = K.failed;
  const cardLine = K.made ? `Cards: ${K.made} made · ${K.live} approved LIVE · ${K.practice.length} practice trade${K.practice.length === 1 ? "" : "s"} taken (no real money) · ${K.rejected_josh.length + K.rejected_other} rejected${K.rejected_josh.length ? ` (${K.rejected_josh.length} by Josh with a why)` : ""} · ${K.expired} expired` +
    (failed.length ? ` · ${failed.length} failed (${failed.map((a: any) => `${a.title}: ${brokerReason(((a.result || []).find((r: any) => !r.ok) || {}).text || "no reason given").replace(/^Rejected by Robinhood:\s*/, "").split("\n")[0]}`).join("; ").slice(0, 400)})` : "") +
    `. Cards nobody took are graded as ideas only — not trades, no money won or lost.` : "Cards: none.";
  return `### Trades and cards\n_From Robinhood's own order records (Otto, not Jarvis)._\n` +
    (lines.length ? lines.join("\n") : "- No option orders in the Agentic account today.") +
    `\n${closedAny ? `Realized on closed trades today: ${realized >= 0 ? "+" : "−"}$${Math.abs(realized).toFixed(0)}` : "Realized today: $0 (nothing closed)"}\n${cardLine}`;
}
export function spliceRecap(jarvis: string, block: string): string {
  // Drop any trades section Jarvis wrote; put the server's right after "Today in one line".
  const parts = String(jarvis || "").split(/(?=^###\s)/m).filter((p) => !/^###\s*Trades and cards/i.test(p));
  const i = parts.findIndex((p) => /^###\s*Today in one line/i.test(p));
  parts.splice(i >= 0 ? i + 1 : 0, 0, block.trim() + "\n\n");
  return parts.join("").trim();
}
// Tests from before v3.41 approve without a why; the gate itself is tested in v341_test.ts. A test passes its own why to exercise it.
export const TEST_WHY = { setup: "test setup in words", why_now: "test why now line", kills: "test kill line 123" };
export const actOnForTest = (id: string, decision: string, who: string, why: any = undefined) =>
  actOn(id, decision, who, why === undefined ? (decision === "approve" ? TEST_WHY : "test why not line") : why);
export const evalIdeaForTest = evalIdea;

/* ============================================================ v3.23 (8 Oct 2026) — Signal speed
   Decisions (Ifoma, 8 Oct; claude/otto-v323-speed.md): Jarvis makes a Signal card in ONE forced step with everything
   pre-fetched; target post → card under 30 s (the 9:10 self-test fails over 30 s); Jarvis still picks direction when
   the coach gives none; the read stays on the main model; one card per post (no "ALT —"); one retry, then no card + why. */

export const ONE_STEP_RULE = `ONE STEP (speed is the edge): everything you need is below, fetched live by the server a moment ago — the live price, today's 5-minute bars, the contracts (★ = best by the Otto Rules, ◆ = best that fits buying power) and buying power. Do NOT look anything up. Make the card NOW with propose_action — this is your only step (the server allows one retry if it bounces the card). ONE card: ★ if it fits buying power, otherwise ◆; nothing fits → the cheapest anyway (red banner). Limit = the ask or a cent under. Levels (entry, wrong-if, TP1) must be within 10% of the live price. Keep the summary to 2 short lines (under 200 characters in all). Put the feed read in the card's "read" field: 1–2 short plain lines (under 220 characters in all) — what he said, your direction and WHY, what proves it wrong.`;

// v3.29 (13 Oct): a coach LEVEL post (no call) from one ticker also gets the one-step path. 12 Oct: level posts took the old
// multi-step loop, 71–107 s to a card vs 20 s one-step. Not forced: a level that isn't a setup gets a one-line reason instead.
export const LEVEL_ONE_STEP_RULE = `ONE STEP (speed is the edge): everything you need is below, fetched live by the server a moment ago — the live price, today's 5-minute bars, the contracts (★ = best by the Otto Rules, ◆ = best that fits buying power) and buying power. Do NOT look anything up. He posted a LEVEL, not a call. Decide NOW, in this one step. If the level and the live price give a setup by the Otto Rules, make ONE card with propose_action: the direction is yours; ★ if it fits buying power, otherwise ◆; nothing fits → the cheapest anyway (red banner). Limit = the ask or a cent under. Levels (entry, wrong-if, TP1) must be within 10% of the live price. Keep the summary to 2 short lines (under 200 characters in all). Put the feed read in the card's "read" field: 1–2 short plain lines (under 220 characters in all) — what he said, your direction and WHY, what proves it wrong. If it is NOT a setup right now (price far from the level, no edge), make NO card: answer with the word READ: and 1–3 plain lines saying why.`;

// v3.30 (item 1): a coach LEVEL with no direction → no card, just the read (one step, nothing to look up).
export const LEVEL_NO_DIR_RULE = `ONE STEP (speed is the edge): the live price, today's 5-minute bars and the contracts are below, fetched live by the server a moment ago. Do NOT look anything up. He posted a LEVEL with NO direction. Make NO card and don't pick a side: Otto's Watcher has this level both ways, and a card comes only when price touches it and a 5-minute candle closes. Answer with the word READ: and then 1–2 short plain lines (under 220 characters in all): the level, where the live price is now, and what Otto is waiting for.`;

export function signalProposeTool(tools: any[]) {
  const base = tools.find((x: any) => x?.name === "propose_action") || PROPOSE_TOOL("");
  const t = JSON.parse(JSON.stringify(base));
  t.input_schema.properties.read = { type: "string", description: "The read for the Otto Signals feed: 1–2 short plain lines, under 220 characters (what he said, your direction and why, what proves it wrong)." };
  t.input_schema.required = [...new Set([...(t.input_schema.required || []), "read", "plan"])];
  return t;
}

export function barsText(bars: Bar[], n = 24): string {
  return bars.slice(-n).map((b) => `${fmtMin(etParts(new Date(b.t)).min)} o${b.o} h${b.h} l${b.l} c${b.c}`).join(" · ");
}

// Everything a Signal card needs, fetched in parallel: price, today's 5-minute bars, the contracts (both sides if no direction).
export async function signalPack(r: any): Promise<string> {
  const tk = v322Sym(r.ticker);
  if (!tk) return "";
  const sides: ("call" | "put")[] = r.direction === "long" ? ["call"] : r.direction === "short" ? ["put"] : ["call", "put"];
  const [sls, bars, px] = await Promise.all([
    Promise.all(sides.map((s) => withTimeout(shortlistCached(tk, s), 25_000, "shortlist " + tk).then((x) => x.text,
      (e) => `${tk} ${s}s: couldn't pre-fetch (${String((e as Error).message).slice(0, 100)}).`))),
    withTimeout(rhBars([tk], "5minute", new Date(Date.now() - 3 * 3600e3).toISOString()), 8000, "bars").then((m) => completedBars(m[tk] || [], 5)).catch(() => [] as Bar[]),
    rhPrices([tk]).catch(() => ({} as Record<string, number>)),
  ]);
  return `PRICE: ${tk} ${px[tk] > 0 ? "$" + px[tk].toFixed(2) + " (live)" : "see the contract list"}\n` +
    `5-MIN BARS (ET, last 2 hours, finished bars only): ${bars.length ? barsText(bars) : "not available"}\n` +
    `CONTRACTS:\n${sls.join("\n\n")}`;
}

export const SIGNAL_TARGET_S = 30;

/* ============================================================ v3.24 (8 Oct 2026) — honesty + safety + cleanup
   Decisions (Ifoma, 8 Oct; claude/otto-v324-plan.md):
   A6/A13  fills, positions, P&L and the daily stop in Jarvis's words come only from Robinhood's order records;
           a claim with no matching record is corrected before it's saved ("365P filled at 3.70, TP1 already hit").
   A7      the daily-stop / trades-today counters on a card count Robinhood round trips, not the journal.
   A10     "bounced off 195.50" when the stock never traded 195.50 today → corrected with the day's high/low.
   A14     "cancelled" when it was cancelled; "Rejected by Robinhood: …" only when Robinhood rejected it.
           Jarvis's working notes ("Let me grab the instrument ID…") never reach the Desk.
   A8      stale entry = red banner, still place: a card whose stock is already through its wrong-if gets a red
           line (on the card while it waits, at Approve, and at the fill); the stop is sized from the actual fill.
   A11     a wrong-if alert is checked against the LATEST completed bar; if that bar no longer closes through,
           no close card ("stale alert ignored").
   A12     a Watcher level added on the losing side of an open trade becomes that trade's ONE wrong-if (replaces,
           never stacks); the server closes on a 5-minute close through it.
   C1      a plan re-lock keeps its entry on the Watcher · C2 a check-in stuck on "running" is failed after 10 min. */

// Sentences end at . ! ? … followed by a space (or a newline) — never inside "202.5C" or "$1.74".
export const sentences = (t: string) => String(t || "").split(/(?<=[.!?…][*_"')\]]*)(?=\s)|(?<=\n)/);

export type Trip = { sym: string; label: string; option_id: string; strike: number; side: string; opened_at: string;
  entry: number; qty: number; state: "open" | "closed" | "partial"; exit: number | null; closed_at: string | null; pnl: number | null };
export type Unfilled = { sym: string; label: string; option_id: string; strike: number; side: string; state: string; created_at: string; reason: string };
export type DayFacts = { trips: Trip[]; unfilled: Unfilled[]; losers: number; realized: number; closed: number;
  practice?: { sym: string; strike: number; side: string }[] };   // v3.44: today's practice trades — never checked against Robinhood

const oTime = (o: any) => String(o?.last_transaction_at || o?.updated_at || o?.created_at || "");
/** Today's round trips from Robinhood's own order records (the same matching the 5:15 recap uses). */
export function dayFacts(orders: any[]): DayFacts {
  const trips: Trip[] = [], unfilled: Unfilled[] = [];
  const opens = (orders || []).filter((o: any) => (o.legs || []).some((l: any) => l.position_effect === "open"))
    .sort((a: any, b: any) => String(a.created_at || "").localeCompare(String(b.created_at || "")));
  const closes = (orders || []).filter((o: any) => (o.legs || []).some((l: any) => l.position_effect === "close"));
  for (const o of opens) {
    const l = (o.legs || []).find((x: any) => x.position_effect === "open");
    const sym = String(o.chain_symbol || l?.chain_symbol || "").toUpperCase();
    const base = { sym, label: legLabel(o, l), option_id: String(l?.option_id || ""), strike: Number(l?.strike_price) || 0, side: String(l?.option_type || "") };
    const b = avgFill(o, l);
    if (b.q > 0) {
      const sells = closes.filter((c: any) => (c.legs || []).some((x: any) => x.option_id === l.option_id));
      let sq = 0, sv = 0, last = "";
      for (const c of sells) { const f = avgFill(c, c.legs.find((x: any) => x.option_id === l.option_id)); if (f.q > 0) { sq += f.q; sv += f.q * f.px; if (oTime(c) > last) last = oTime(c); } }
      const exit = sq > 0 ? sv / sq : null;
      const pnl = exit != null ? +((exit - b.px) * 100 * Math.min(sq, b.q)).toFixed(2) : null;
      trips.push({ ...base, opened_at: oTime(o), entry: +b.px.toFixed(4), qty: b.q, state: sq <= 0 ? "open" : sq < b.q ? "partial" : "closed", exit, closed_at: last || null, pnl });
    } else if (EXIT_DEAD_ORDER.has(o.state) || !["filled", "partially_filled"].includes(o.state)) {
      unfilled.push({ ...base, state: String(o.state || "?"), created_at: String(o.created_at || ""), reason: orderReason(o) });
    }
  }
  const done = trips.filter((t) => t.state !== "open" && t.pnl != null);
  return { trips, unfilled, losers: done.filter((t) => (t.pnl as number) < 0).length, realized: +done.reduce((s, t) => s + (t.pnl as number), 0).toFixed(2), closed: done.length };
}
const sgn$ = (n: number) => `${n >= 0 ? "+" : "−"}$${Math.abs(n).toFixed(0)}`;
export function tripLine(t: Trip): string {
  return t.state === "open" ? `${t.label} bought ${t.qty} @ $${t.entry.toFixed(2)}, still open`
    : `${t.label} bought @ $${t.entry.toFixed(2)} → sold @ $${(t.exit as number).toFixed(2)} = ${sgn$(t.pnl as number)}${t.state === "partial" ? " (part still open)" : ""}`;
}
export function tradesLine(f: DayFacts): string {
  const tr = f.trips.length ? f.trips.map(tripLine).join("; ") : "none filled";
  const un = f.unfilled.length ? ` Never filled: ${f.unfilled.map((u) => `${u.label} (${deadWord(u.state)})`).join(", ")}.` : "";
  return `TRADES TODAY FROM ROBINHOOD (the only source for fills, positions, P&L and the daily stop — never the card's limit price, never a guess): ${tr}. ` +
    `Losing round trips today: ${f.losers}. Realized: ${sgn$(f.realized)}.${un} If an order isn't in this list as bought, it did NOT fill: say "not filled".`;
}
/** A14: our own words for an order that never filled. */
export function deadWord(state: string, reason = ""): string {
  const s = String(state || "");
  if (s === "rejected" || s === "failed") return `Rejected by Robinhood: ${reason || "no reason given"}`;
  if (s === "cancelled" || s === "canceled") return "cancelled before it filled";
  if (s === "expired") return "expired unfilled (day order)";
  return s ? `${s}, not filled` : "not filled";
}

/* ---- A6/A13: what Jarvis says about fills, positions, P&L and the daily stop ---- */
const CALLER = /\b(?:if|when|once|unless|until|in case|as soon as|should|would|could|might|will|won't|before)\b/i;
const NEG_FILL = /\b(?:not|never|no|n't|un)\s*(?:yet\s+|been\s+)?fill|unfilled|hasn't|didn't|wasn't|waiting (?:to|for (?:a|the)) fill|to fill\b|fill or kill/i;
const FILL_RE = /\b(?:filled|got filled|fill(?:ed)? at|got in at|entered at|bought (?:it |them |one |1 )?(?:at|@)|entry (?:fill|price) (?:was|of|at))\b/i;
const ENTRY_RE = /\b(?:entry|avg(?:erage)? cost|cost basis)\s*(?:fill\s*|price\s*)?(?:of|was|at|@|:)?\s*\$(\d+\.\d{2})\b/i;
// A sentence about another day (yesterday, "on Sep 22", "Oct 1") isn't about today's trades.
const OTHER_DAY = /\b(?:yesterday|last (?:week|time|session|night|friday|monday|tuesday|wednesday|thursday)|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\.? \d{1,2}\b|\b\d{1,2}\/\d{1,2}(?:\/\d{2,4})? (?:call|trade|close|session))/i;
const NOT_TICKER = new Set("I A ET AM PM OK TP RSI VWAP EMA SMA OI ITM OTM ATM DTE ALT READ NOTE USD CPI FOMC NFP PPI GDP ORB HOD LOD ATH EOD PT SL RR TV RH API ID IV MA AH NY NYSE US AI IPO ETF SEC FED CEO ON OFF UP AT IN IS IT TO OF BE NO YES AND THE OR NOT ALL NEW BUY SELL HOLD LONG SHORT CALL CALLS PUT PUTS SCALP WATCH CARD STOP WIN LOSS P C R H L O".split(" "));
const TP_RE = /\bTP1\b(?:\s+(?:is|was|got|has|had|already|been|now|just)){0,3}\s+(?:hit|reached|tagged|touched|filled)\b|\bhit\s+TP1\b/i;
const STOP_RE = /\b(?:stopped out|got stopped|(?:was|were|both|all) stopped|stop (?:got |was |has )?(?:hit|filled|triggered)|stops? (?:got |were )?(?:hit|filled))\b/i;
const DS_RE = /\bdaily stop(?: flag)?(?:\s+(?:is|was|has been|now|already)){0,3}\s+(?:active|hit|triggered|on|reached|in effect)\b|\b(?:hit|reached|triggered|tripped)\s+(?:the |your |our )?daily stop\b/i;
const NWORD: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, zero: 0, no: 0 };
const LOSERS_RE = /\b(\d|one|two|three|four|five|zero|no)\s+(?:losing (?:trades?|round trips?)|losers|losses)\b(?!\s+(?:or|before|allowed|max))/i;
const LOSERS_RULE = /\b(?:after|at|rule|allows?|limit|max|before|stop at|stops? after|or)\s+(?:\d|one|two|three)\s+los/i;
const PNL_WORD = /\b(?:loss|lost|losing|profit|gain|gained|made|P&L|P\/L|PnL|net|realized|banked|booked|loser|winner)\b/i;
const PNL_SKIP = /\b(?:max|limit|cap|at the stop|if the stop|if it|risk|risking|costs?|premium|buying power|budget|per trade|allow|goal|target|potential|worst case|up to|at most|would|could|weekly|stop at|the stop is|stop on at|−\$\d+ if)\b/i;
const MONEY_RE = /([-−+])?\s?\$\s?(\d[\d,]*(?:\.\d+)?)(?:\s?[–-]\s?\$?(\d[\d,]*(?:\.\d+)?))?/g;
const STRIKE_RE = /\b(\d{1,4}(?:\.\d{1,2})?)\s?([CP])\b/;

type Target = { sym: string | null; strike: number | null; side: string | null };
function targetOf(s: string, known: Set<string>, prev: Target): Target {
  const all = (s.match(/\b[A-Z]{2,5}\b/g) || []).filter((w) => !NOT_TICKER.has(w));
  const words = [...all.filter((w) => known.has(w)), ...all.filter((w) => !known.has(w))];
  const mk = s.match(new RegExp(`\\b([A-Z]{1,5})\\s+${STRIKE_RE.source.slice(2)}`));
  const sym = mk ? mk[1] : words[0] || null;
  const st = s.match(STRIKE_RE);
  if (!sym && !st) return prev;
  return { sym: sym || prev.sym, strike: st ? Number(st[1]) : (sym && sym !== prev.sym ? null : prev.strike), side: st ? (st[2] === "P" ? "put" : "call") : (sym && sym !== prev.sym ? null : prev.side) };
}
const hits = (t: Target, x: { sym: string; strike: number; side: string }) => (!t.sym || t.sym === x.sym) && (t.strike == null || Math.abs(t.strike - x.strike) < 0.01) && (!t.side || t.side === x.side);

export function checkTradeClaims(text: string, f: DayFacts, nMax = 2): { text: string; notes: string[] } {
  const notes: string[] = [];
  const known = new Set<string>([...f.trips.map((t) => t.sym), ...f.unfilled.map((u) => u.sym)].filter(Boolean));
  let tgt: Target = { sym: null, strike: null, side: null };
  const fix = (msg: string) => { notes.push(`⚠ Correction (Otto checked Robinhood): ${msg}`); return ` [Corrected by Otto: ${msg}]`; };
  const parts = sentences(text);
  const out = parts.map((s) => {
    if (!s.trim()) return s;
    tgt = targetOf(s, known, tgt);
    if (OTHER_DAY.test(s)) return s;
    // v3.44 fix 5: a sentence about practice / paper trades, or about a contract that is one of today's practice trades, is not a
    // Robinhood claim ("Robinhood shows no META 632.5P fill" was a false correction on a practice fill, 22 Oct).
    if (/\b(?:practice|paper)\b/i.test(s)) return s;
    if ((tgt.sym || tgt.strike != null) && (f.practice || []).some((p) => (!tgt.sym || tgt.sym === p.sym) && (tgt.strike == null || Math.abs(tgt.strike - p.strike) < 0.01) && (!tgt.side || tgt.side === p.side))
      && !f.trips.some((t) => hits(tgt, t))) return s;
    const anyTarget = !!(tgt.sym || tgt.strike != null);
    const mine = f.trips.filter((t) => hits(tgt, t)), dead = f.unfilled.filter((u) => hits(tgt, u));
    const what = tgt.sym ? `${tgt.sym}${tgt.strike != null ? " " + tgt.strike + (tgt.side === "put" ? "P" : tgt.side === "call" ? "C" : "") : ""}` : "that order";
    const noFill = () => dead.length ? `Robinhood shows the ${dead[0].label} order ${deadWord(dead[0].state, dead[0].reason)} — it never filled.`
      : `Robinhood shows no ${what} fill today — it is not filled.`;
    // 1. a fill (and its price)
    if (FILL_RE.test(s) && !NEG_FILL.test(s) && !/\bstop(?:\s+order)?\s+(?:fills?|filled)\b/i.test(s) && !CALLER.test(s.split(FILL_RE)[0].slice(-40))) {
      if (anyTarget && !mine.length && (dead.length || tgt.sym)) return fix(noFill());
      if (!anyTarget && !f.trips.length) return fix("Robinhood shows no filled orders in the Agentic account today.");
      const pm = s.match(/(?:filled|fill|entered|in|bought(?: it| them| one| 1)?|entry(?: fill| price)?(?: was| of)?)(?:\s+\w+){0,2}?\s+(?:at|@)\s+\$?(\d+(?:\.\d+)?)/i);
      if (pm && mine.length === 1) {
        const x = Number(pm[1]), t = mine[0];
        if (x > 0 && x < t.entry * 4 && x > t.entry / 4 && Math.abs(x - t.entry) > Math.max(0.02, t.entry * 0.03) && !(t.exit != null && Math.abs(x - t.exit) <= 0.02))
          return fix(`${t.label} filled at $${t.entry.toFixed(2)} (Robinhood), not $${x.toFixed(2)}.`);
      }
    }
    // 1b. "entry $1.88" when the fill was $1.74 (8 Oct 9:52 position check)
    const em = s.match(ENTRY_RE);
    if (em && !CALLER.test(s)) {
      const x = Number(em[1]), t = mine.length === 1 ? mine[0] : (!anyTarget && f.trips.filter((z) => z.state !== "closed").length === 1 ? f.trips.find((z) => z.state !== "closed") : null);
      if (t && x < t.entry * 4 && x > t.entry / 4 && Math.abs(x - t.entry) > Math.max(0.02, t.entry * 0.03))
        return fix(`${t.label} filled at $${t.entry.toFixed(2)} (Robinhood) — that's the entry, not $${x.toFixed(2)}.`);
    }
    // 2. TP1 hit / stopped out — only on a trade that exists
    if ((TP_RE.test(s) || STOP_RE.test(s)) && !CALLER.test(s)) {
      if (/\b(?:both|all)(?: \w+)? stopped|stops? (?:got |were )?(?:hit|filled)\b/i.test(s)) {
        const named = new Set((s.match(/\b[A-Z]{2,5}\b/g) || []).filter((w) => known.has(w)));
        const pool = named.size >= 2 ? f.trips.filter((t) => named.has(t.sym)) : f.trips;
        const lost = pool.filter((t) => t.state !== "open" && (t.pnl as number) < 0);
        if (lost.length < Math.max(2, pool.length)) return fix(`Robinhood shows ${lost.length} losing round trip${lost.length === 1 ? "" : "s"} today${f.trips.length ? " (" + f.trips.map(tripLine).join("; ") + ")" : ""}.`);
      } else if (anyTarget || f.trips.length === 0) {
        if (!mine.length) return fix(`${noFill()} There is no ${what} position, so no TP1 or stop.`);
        if (STOP_RE.test(s) && mine.every((t) => t.state === "open")) return fix(`Robinhood shows ${mine[0].label} still open — not stopped out.`);
        if (STOP_RE.test(s) && /stopped/i.test(s) && mine.every((t) => t.state !== "open" && (t.pnl as number) >= 0)) return fix(`${tripLine(mine[0])} — closed for a gain, not stopped out.`);
      }
    }
    // 3. the daily stop and the losing-trade count
    const ds = DS_RE.test(s) && !/\b(?:not|isn't|no)\b[^.]{0,20}daily stop|daily stop[^.]{0,25}\b(?:not|isn't)\b/i.test(s) && !CALLER.test(s);
    const lm = LOSERS_RULE.test(s) ? null : s.match(LOSERS_RE);
    const claimed = lm ? (/^\d$/.test(lm[1]) ? Number(lm[1]) : NWORD[lm[1].toLowerCase()]) : null;
    const hitNow = nMax > 0 && f.losers >= nMax;
    if ((ds && !hitNow) || (claimed != null && /today|already|so far|daily stop/i.test(s) && claimed !== f.losers)) {
      return fix(`Robinhood shows ${f.losers} losing round trip${f.losers === 1 ? "" : "s"} today${f.trips.length ? " (" + f.trips.filter((t) => t.state !== "open").map(tripLine).join("; ") + ")" : ""} — the daily stop (${nMax} losers) is ${hitNow ? "hit" : "NOT hit"}.`);
    }
    // 4. dollar P&L — only amounts sitting next to a P&L word ("loss ~$80", "+$11 realized"), never prices or % moves
    if (PNL_WORD.test(s) && !PNL_SKIP.test(s)) {
      MONEY_RE.lastIndex = 0;
      const ms = [...s.matchAll(MONEY_RE)].filter((m) => {
        const at = m.index || 0, before = s.slice(Math.max(0, at - 30), at), after = s.slice(at + m[0].length, at + m[0].length + 22);
        if (/^\s*\(?[+−-]?\d+(?:\.\d+)?%/.test(after) || /^\s*\/\s*(?:day|share)/i.test(after)) return false;
        return PNL_WORD.test(before) || /^\s*(?:\*\*)?\s*(?:loss|profit|gain|realized|P&L|net|on the (?:day|trade))/i.test(after);
      }).map((m) => ({ sign: m[1], a: Number(m[2].replace(/,/g, "")), b: m[3] ? Number(m[3].replace(/,/g, "")) : null }))
        .filter((m) => m.a >= 5 && m.a < 5000);
      if (ms.length) {
        const named = new Set((s.match(/\b[A-Z]{2,5}\b/g) || []).filter((w) => known.has(w)));
        const total = named.size > 1 || /\b(?:today|total|on the day|the day|day's|so far|overall)\b/i.test(s);
        const realizedTalk = /\b(?:realized|closed|stopped|sold|banked|booked|lost|made|net|on the day|today)\b/i.test(s);
        const pool = anyTarget && !total ? mine : f.trips;
        const closedPool = pool.filter((t) => t.state !== "open" && t.pnl != null);
        const openOnly = pool.length > 0 && closedPool.length === 0;
        if (!(openOnly && !realizedTalk) && !(anyTarget && !total && !pool.length && !dead.length)) {
          const neg = /\b(?:loss|lost|losing|down|red)\b|−|-\$/i.test(s), pos = /\b(?:profit|gain|gained|made|up|green|banked)\b|\+\$/i.test(s);
          const approx = /~|≈|\babout\b|\baround\b|\broughly\b/i.test(s);
          const knowns = [...closedPool.map((t) => t.pnl as number), ...(total || !anyTarget ? [f.realized] : [])];
          const ok = ms.every((m) => {
            const vals = m.b != null ? [m.a, m.b] : [m.a];
            return knowns.some((k) => vals.some((v) => Math.abs(Math.abs(k) - v) <= Math.max(3, Math.abs(k) * (approx ? 0.2 : 0.1))) &&
              !(m.sign === "−" || m.sign === "-" ? k > 0 : m.sign === "+" ? k < 0 : (neg && !pos && k > 0) || (pos && !neg && k < 0)));
          });
          if (!ok && (closedPool.length || realizedTalk)) {
            const where = anyTarget && !total && mine.length ? mine.map(tripLine).join("; ") : f.trips.length ? f.trips.map(tripLine).join("; ") : "no fills today";
            return fix(`Robinhood's numbers: ${where}${anyTarget && !total ? "" : `; realized today ${sgn$(f.realized)}`}.`);
          }
        }
      }
    }
    return s;
  });
  return { text: out.join(""), notes: [...new Set(notes)] };
}

/* ---- A10: "bounced off 195.50" — did it trade there today? ---- */
const PX_VERB = /\b(?:bounced|bouncing|bounce|held|holding|tagged|touched|hit|tested|reclaimed|rejected|broke|broken|dipped|wicked|traded|came (?:down|back)|pulled back|flushed|swept|printed|confirmed it hard|up \d+(?:\.\d+)?% )\s*(?:off|from|at|to|into|through|below|above|down to|up to|back to|of)?\s+\$?(\d{1,5}(?:\.\d{1,2})?)\b|\b(?:is |trading |sitting |sits |currently )?at \*{0,2}\$?(\d{1,5}(?:\.\d{1,2})?)\*{0,2} (?=(?:right )?now\b)/gi;
export function checkPriceClaims(text: string, range: Record<string, { lo: number; hi: number }>): { text: string; notes: string[] } {
  const notes: string[] = [];
  const syms = Object.keys(range);
  let cur: string | null = null;
  const out = sentences(text).map((s) => {
    const named = (s.match(/\b[A-Z]{1,5}\b/g) || []).find((w) => syms.includes(w));
    if (named) cur = named;
    if (!cur || OTHER_DAY.test(s) || CALLER.test(s) || /\b(?:needs? to|has to|must|watch|target|TP1|wrong-if|stop|if|level to)\b/i.test(s)) return s;
    const r = range[cur];
    PX_VERB.lastIndex = 0;
    for (const m of s.matchAll(PX_VERB)) {
      const v = Number(m[1] ?? m[2]);
      if (!(v > 0) || v < r.lo * 0.7 || v > r.hi * 1.3) continue;          // not a stock price (option price, %, time)
      const tol = Math.max(v * 0.0015, 0.05);
      if (v < r.lo - tol || v > r.hi + tol) {
        const msg = `${cur} traded ${r.lo.toFixed(2)}–${r.hi.toFixed(2)} today — it never traded ${v}.`;
        notes.push(`⚠ Correction (Otto checked the day's bars): ${msg}`);
        return ` [Corrected by Otto: ${msg}]`;
      }
    }
    return s;
  });
  return { text: out.join(""), notes: [...new Set(notes)] };
}
async function dayRanges(syms: string[]): Promise<Record<string, { lo: number; hi: number }>> {
  const day = etParts().date;
  const start = nyIso(day, "4:00 AM") || new Date(Date.now() - 12 * 3600e3).toISOString();
  const b = await rhBars(syms.slice(0, 10), "5minute", start);
  const out: Record<string, { lo: number; hi: number }> = {};
  for (const [k, v] of Object.entries(b)) if (v.length) out[k] = { lo: Math.min(...v.map((x) => x.l)), hi: Math.max(...v.map((x) => x.h)) };
  return out;
}

/* ---- Jarvis's working notes never reach the Desk ---- */
const NARR_START = /^\s*(?:(?:OK|Okay|Alright|Now|First|Next|Good|Got it)[,.]?\s+)?(?:let me (?:grab|pull|fetch|look up|get|check|try|search|scan|see|re-?check)|let's (?:grab|pull|fetch|look up)|i'?ll (?:grab|pull|fetch|look up)|i need to (?:grab|pull|fetch|look up)|grabbing|fetching|pulling (?:up )?(?:the|live|it)|looking up|one moment|hold on)\b[^.!?…:\n]*(?:[.!?…:]+|$)\s*/i;
const NARR_ID = /\b(?:stop_order_id|option_id|instrument_id|order_id|chain_id|ref_id|get_option_\w+|get_equity_\w+|place_option_order|cancel_option_order|propose_action|option_shortlist|rh__\w+|tv__\w+|mcp-tv-\w+)\b/;
export function stripNarration(text: string): string {
  const out = sentences(text).map((s) => {
    if (!s.trim()) return s;
    const lead = s.match(/^\s*/)![0];
    if (NARR_START.test(s) && s.length < 400) {
      let rest = s;                                   // glued clauses ("…simultaneously.Let me try…") come off one by one
      for (let i = 0; i < 4 && NARR_START.test(rest); i++) rest = rest.replace(NARR_START, "");
      rest = rest.replace(/^\*\*\s*(?=\S)/, (m) => (/\*\*/.test(rest.slice(m.length)) ? m : ""));
      if (NARR_ID.test(rest) && /\b(?:let me|i'?ll|i need|grab|fetch|pull|look up|is for the|the id)\b/i.test(rest)) return "";
      return rest.trim() ? lead + rest : "";
    }
    if (NARR_ID.test(s) && /\b(?:let me|i'?ll|i need|grab|fetch|pull|look up|is for the|the id)\b/i.test(s)) return "";
    return s;
  }).join("");
  return out.replace(/\n{3,}/g, "\n\n").trim() || String(text || "").trim();
}
/** All the v3.24 checks, after the v3.22 ones (factCheck calls this). Every check fails open. */
export async function factCheck324(text: string): Promise<{ text: string; notes: string[] }> {
  let t = stripNarration(text);
  const notes: string[] = [];
  const claims = [FILL_RE, ENTRY_RE, TP_RE, STOP_RE, DS_RE, LOSERS_RE].some((r) => r.test(t)) || (PNL_WORD.test(t) && /\$\s?\d/.test(t));
  if (claims) {
    try {
      const f = dayFacts(await withTimeout(dayOrders(etParts().date), 8000, "Robinhood orders"));
      f.practice = practiceTargets(await withTimeout(todaysCards(), 5000, "practice cards").catch(() => []));   // v3.44 fix 5
      const L = await getLimits().catch(() => LIMIT_DEFAULTS);
      const r = checkTradeClaims(t, f, Number(L.daily_losses) || 0);
      t = r.text; notes.push(...r.notes);
    } catch { /* fail open */ }
  }
  try {
    PX_VERB.lastIndex = 0;
    if (PX_VERB.test(t)) {
      const syms = [...new Set((t.match(/\b[A-Z]{1,5}\b/g) || []))].filter((w) => !/^(?:ET|AM|PM|OK|TP|RSI|VWAP|EMA|SMA|OI|ITM|OTM|ATM|DTE|ALT|READ|NOTE|USD|CPI|FOMC|NFP|PPI|GDP|I|A)$/.test(w)).slice(0, 6);
      if (syms.length) {
        const rg = await withTimeout(dayRanges(syms), 8000, "day ranges");
        if (Object.keys(rg).length) { const r = checkPriceClaims(t, rg); t = r.text; notes.push(...r.notes); }
      }
    }
  } catch { /* fail open */ }
  return { text: t, notes };
}

/* ---- A7: the daily stop and trades-today counted from Robinhood ---- */
export async function todayCounts(): Promise<{ losers: number; realized: number; opened: number; src: "robinhood" | "journal" }> {
  const today = etParts().date;
  try {
    const f = dayFacts(await withTimeout(dayOrders(today), 8000, "Robinhood orders"));
    return { losers: f.losers, realized: f.realized, opened: f.trips.length, src: "robinhood" };
  } catch {
    const t = await db("otto_trades?select=account,pnl,closed_at,opened_at&opened_at=gte." + new Date(Date.now() - 864e5).toISOString());
    const mine = (t || []).filter((x: any) => /agentic/i.test(String(x.account || "")));
    const closed = mine.filter((x: any) => x.pnl != null && x.closed_at && etParts(new Date(x.closed_at)).date === today);
    return { losers: closed.filter((x: any) => Number(x.pnl) < 0).length, realized: closed.reduce((s: number, x: any) => s + Number(x.pnl), 0),
      opened: mine.filter((x: any) => x.opened_at && etParts(new Date(x.opened_at)).date === today).length, src: "journal" };
  }
}

/* ---- A8: a card whose stock is already through its wrong-if ---- */
export function pastWrongIf(direction: string, wrong: number, px: number) { return px > 0 && wrong > 0 && (direction === "down" ? px > wrong : px < wrong); }
export function staleLine(tk: string, direction: string, wrong: number, px: number) {
  return `${tk} is already ${direction === "down" ? "above" : "below"} ${wrong} (now ${px.toFixed(2)}) — this trade is wrong before it starts`;
}
export async function staleEntry(a: any): Promise<string | null> {
  const ex = a?.exit || {}, p = a?.plan || {};
  const tk = v322Sym(ex.tv_symbol || p.tv_symbol), wrong = Number(ex.wrong_if ?? p.stop), dir = ex.direction || p.direction;
  if (!tk || !(wrong > 0)) return null;
  const px = (await rhPrices([tk]).catch(() => ({} as Record<string, number>)))[tk];
  return pastWrongIf(dir, wrong, px) ? staleLine(tk, dir, wrong, px) : null;
}
/** Put the red line on (or take it off) a pending card. Returns the line when it's stale. */
export async function markStale(a: any): Promise<string | null> {
  const line = await staleEntry(a).catch(() => null);
  const had = (a.checks || []).some((c: any) => c.stale);
  if (!!line === had && (!line || (a.checks || []).some((c: any) => c.stale && c.text === line))) return line;
  const checks = [...(line ? [{ ok: false, guard: true, stale: true, text: line }] : []), ...(a.checks || []).filter((c: any) => !c.stale)];
  await db("otto_actions?id=eq." + a.id, { method: "PATCH", headers: { prefer: "return=minimal" }, body: JSON.stringify({ checks }) }).catch(() => {});
  a.checks = checks;
  if (line && !had) await logDesk("system", "Otto", `⚠ ${a.title}: ${line}. The card stays up — Approve still places it (guardrails flag, never block).`, a.id);
  return line;
}
// Every cron minute from 9:00: pending opening cards get the red line while they're stale.
export async function staleTick() {
  const rows = await db("otto_actions?" + OQ() + "select=id,title,status,plan,exit,checks,created_at&status=eq.pending&order=created_at.desc&limit=20").catch(() => []);
  for (const a of (rows || []).filter((r: any) => r.exit?.state === "planned")) await markStale(a);
}
/** A8: the protective stop is sized from the actual fill, keeping the card's stop/limit ratio. */
export function stopFromFill(entryLimit: number, stopOpt: number, fill: number): number | null {
  if (!(fill > 0) || !(entryLimit > 0) || !(stopOpt > 0)) return null;
  if (Math.abs(fill - entryLimit) <= Math.max(0.02, entryLimit * 0.02)) return null;
  const s = roundStopUp(fill * (stopOpt / entryLimit));
  return s > 0 && s < fill ? s : null;
}

/* ---- A11: is the alert still true on the latest completed bar? ---- */
export async function latestThrough(ex: any, now = Date.now()): Promise<{ through: boolean | null; close: number | null; at: string | null }> {
  const tk = v322Sym(ex.tv_symbol), tf = Number(ex.wrong_tf) === 5 ? 5 : 15, up = ex.direction !== "down";
  const since = Date.parse(ex.wrong_set_at || ex.armed_at || "") || now - 6 * 3600e3;
  try {
    const bars = completedBars((await rhBars([tk], "5minute", new Date(Math.min(since, now - 30 * 60e3) - 10 * 60e3).toISOString()))[tk] || [], 5, now)
      .filter((b) => tf === 5 || new Date(b.t + 5 * 60e3).getUTCMinutes() % tf === 0);
    const b = bars[bars.length - 1];
    if (!b) return { through: null, close: null, at: null };
    return { through: up ? b.c < ex.wrong_if : b.c > ex.wrong_if, close: b.c, at: new Date(b.t + 5 * 60e3).toISOString() };
  } catch { return { through: null, close: null, at: null }; }
}

/* ---- A12: a Watcher level on an open trade becomes its wrong-if ---- */
export async function wrongIfFromWatch(ticker: string, level: number, by: string): Promise<any | null> {
  const armed = await db("otto_actions?" + OQ() + "select=*&exit->>state=eq.armed&limit=20").catch(() => []);
  const mine = (armed || []).filter((a: any) => v322Sym(a.exit?.tv_symbol) === ticker);
  if (!mine.length) return null;
  const px = (await rhPrices([ticker]).catch(() => ({} as Record<string, number>)))[ticker];
  for (const a of mine) {
    const ex0 = a.exit, up = ex0.direction !== "down";
    const ref = px > 0 ? px : Number(ex0.tp1);
    if (!(ref > 0) || (up ? !(level < ref) : !(level > ref))) continue;          // not on the losing side: an ordinary level
    let fresh: any = null;
    for (let i = 0; i < 3 && !fresh; i++) { fresh = await exitLease(a.id); if (!fresh) await new Promise((r) => setTimeout(r, 1500)); }
    if (!fresh) continue;
    try {
      const ex: any = { ...(fresh.exit || {}) };
      const old = ex.wrong_if;
      if (Number(old) === level) return { action: fresh, old, level, same: true };
      ex.wrong_if = level; ex.wrong_tf = 5; ex.wrong_set_at = new Date().toISOString();
      exitLog(ex, `Wrong-if moved ${old} → ${level} (Watcher level from ${by}); one wrong-if per trade`);
      if (ex.alerts?.wrong != null) {
        try { await call("tv", "mcp-tv-delete-alert", { alert_ids: [ex.alerts.wrong] }); } catch { /* the stale alert is ignored anyway (A11) */ }
        ex.alerts = { ...(ex.alerts || {}), wrong: null };
      }
      await saveExit(a.id, ex);
      try { await armAlerts(fresh, ex, ["wrong"]); await saveExit(a.id, ex); } catch { /* retried by the exit engine */ }
      const L = await getLimits().catch(() => LIMIT_DEFAULTS);
      await logDesk("system", "Otto", `🎯 ${ticker} ${level} is now the wrong-if on ${fresh.title} (was ${old} — replaced, not added). ` +
        (L.auto_close ? `Otto closes it on a 5-minute close ${up ? "below" : "above"} ${level} (server rule; auto-close is on).`
          : `Auto-close is OFF, so a 5-minute close ${up ? "below" : "above"} ${level} puts up a close card for Approve.`), a.id);
      return { action: fresh, old, level };
    } finally {
      await db("otto_actions?id=eq." + a.id, { method: "PATCH", headers: { prefer: "return=minimal" }, body: JSON.stringify({ exit_lock: null }) }).catch(() => {});
    }
  }
  return null;
}

/* ---- C1: a plan's entry stays on the Watcher after a re-lock ---- */
export async function watchEnsure(x: { ticker: string; level: number; dir: string }, added: any): Promise<any | null> {
  if (added) return added;
  const day = watchDay(), lvl = Math.round(Number(x.level) * 100) / 100;
  const ex = (await db(`otto_watch?select=*&day=eq.${day}&ticker=eq.${String(x.ticker).toUpperCase()}&dir=eq.${x.dir}&limit=20`).catch(() => []) || [])
    .find((r: any) => Number(r.level) === lvl);
  if (!ex) return null;
  if (ex.status !== "watching") {
    const r = await db(`otto_watch?id=eq.${ex.id}&select=*`, { method: "PATCH", body: JSON.stringify({ status: "watching" }) }).catch(() => []);
    return r?.[0] || { ...ex, status: "watching" };
  }
  return ex;
}

/* ---- C2: a check-in that never finished ---- */
export async function checksStuck(now = Date.now()) {
  const old = new Date(now - 10 * 60e3).toISOString();
  const rows = await db(`otto_checks?select=*&status=eq.running&due_at=lt.${old}&limit=10`).catch(() => []);
  for (const r of rows || []) {
    const m = "timed out — the check-in started but never finished (10 minutes)";
    const done = await db(`otto_checks?id=eq.${r.id}&status=eq.running&select=id`, { method: "PATCH", body: JSON.stringify({ status: "error", result: m }) }).catch(() => []);
    if (!done?.length) continue;
    await logDesk("system", "Otto", `⏰ The ${fmtMin(etParts(new Date(r.due_at)).min)} check-in "${String(r.what).slice(0, 120)}" failed: ${m}. Nothing was checked — look yourself or set a new one.`);
    await notify("checkin", "⏰ A check-in failed", `${String(r.what).slice(0, 80)} — it never finished. Nothing was checked.`);
  }
}

/* ---- C10 (Ifoma, 8 Oct night: all three): close / stop cards for a position that isn't open ---- */
const closeLegs = (calls: any[]) => (calls || []).filter((c: any) => c?.tool === "place_option_order")
  .flatMap((c: any) => (c.args?.legs || []).filter((l: any) => l.side === "sell" && l.position_effect === "close").map((l: any) => String(l.option_id || "")))
  .filter(Boolean);
/** "Robinhood shows no position in …" when every contract a card would sell to close isn't held; null otherwise (or if Robinhood can't be read). */
export async function nothingToClose(calls: any[]): Promise<string | null> {
  const ids = [...new Set(closeLegs(calls))];
  if (!ids.length) return null;
  try {
    const acct = await agenticAccount();
    for (const id of ids) if ((await heldQty(acct, id)) > 0) return null;
    let label = "that contract";
    try { const ins = (mcpJson(await call("rh", "get_option_instruments", { ids: ids[0] }))?.data?.instruments || [])[0];
      if (ins) label = legLabel({ chain_symbol: ins.chain_symbol }, { strike_price: ins.strike_price, option_type: ins.type, expiration_date: ins.expiration_date, option_id: ids[0] }); } catch { /* */ }
    return `Robinhood shows no ${label} position in the Agentic account`;
  } catch { return null; }                                      // fail open: a person still decides
}
/** When a protected trade goes flat, its waiting close / stop cards expire. */
export async function expireCloseCards(optionId: string) {
  const rows = await db("otto_actions?" + OQ() + "select=id,title,calls&status=eq.pending&order=created_at.desc&limit=40").catch(() => []);
  for (const r of (rows || []).filter((x: any) => closeLegs(x.calls).includes(String(optionId)))) {
    const done = await db(`otto_actions?id=eq.${r.id}&status=eq.pending`, { method: "PATCH",
      body: JSON.stringify({ status: "expired", decided_by: "otto (trade closed)", decided_at: new Date().toISOString() }) }).catch(() => []);
    if (done?.length) await logDesk("system", "Otto", `${r.title}: taken down — the trade is already closed, nothing to sell.`, r.id);
  }
}

/* ============================================================ v3.25 (8 Oct 2026) — Night Charts
   Decisions (Ifoma, 8 Oct; claude/otto-v325-night-charts.md, mockup v3):
   - Mag-7 + SPY + QQQ charted every trading night, ready by 9 PM ET, updated 8:45 AM. Own "Charts" tab.
   - The CODE finds candidate zones on the weekly then daily bars by the Otto Rules (prior lows/highs hit 2+ times,
     the top of big candles, unfilled gaps); JARVIS picks the best 2–4 as buy / sell boxes, says why, and writes the read.
     Boxes are always a candidate's exact prices — Jarvis never invents a number.
   - Josh keeps / adjusts / removes each box; a per-chart chat with Jarvis. Re-charting keeps the boxes he kept.
   - "Use kept boxes today" → the Watcher only (no TradingView alerts — the 20-alert cap), at the box's NEAR edge:
     buy box → its top edge, calls side (dir up); sell box → its bottom edge, puts side (dir down).
   - Two buttons: "Chart <stock> now" and "Chart all 9"; plus any ticker (on the list for that day only). */

export const CHART_LIST = ["SPY", "QQQ", "AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "META", "TSLA"];
export type CBar = [number, number, number, number, number];   // [t (bar start, ms), o, h, l, c]
export type Zone = { id: string; type: "buy" | "sell"; a: number; b: number; why: string; score: number; tf: "W" | "D"; kind: string };

const r2 = (v: number) => Math.round(v * 100) / 100;
// Robinhood day/week bars start at 00:00 UTC on their own date, so label them by the UTC date (not New York, which is the evening before).
const mdET = (t: number) => { const d = new Date(t); return `${d.getUTCMonth() + 1}/${d.getUTCDate()}`; };

/** Candidate zones from weekly + daily bars (pure — tested). Every zone carries the dates that made it. */
export function findZones(daily: CBar[], weekly: CBar[], last: number): Zone[] {
  if (!(last > 0)) return [];
  const raw: Omit<Zone, "id">[] = [];
  const swingPts = (bars: CBar[], k: number, side: "low" | "high") => {
    const out: { p: number; t: number }[] = [];
    for (let i = k; i < bars.length - k; i++) {
      const v = side === "low" ? bars[i][3] : bars[i][2];
      let ok = true;
      for (let j = i - k; j <= i + k && ok; j++) if (j !== i && (side === "low" ? bars[j][3] < v : bars[j][2] > v)) ok = false;
      if (ok) out.push({ p: v, t: bars[i][0] });
    }
    return out;
  };
  const cluster = (pts: { p: number; t: number }[], tolPct: number, tf: "W" | "D", side: "low" | "high") => {
    const s = [...pts].sort((x, y) => x.p - y.p);
    let g: typeof s = [];
    const flush = () => {
      if (g.length >= 2) {
        let a = Math.min(...g.map((x) => x.p)), b = Math.max(...g.map((x) => x.p));
        const minW = last * 0.0025; if (b - a < minW) { const m = (a + b) / 2; a = m - minW / 2; b = m + minW / 2; }
        const dates = [...g].sort((x, y) => x.t - y.t).map((x) => mdET(x.t)).join(", ");
        raw.push({ type: "buy", a, b, tf, kind: side === "low" ? "prior-lows" : "prior-highs", score: g.length * 2 + (tf === "W" ? 3 : 0),
          why: `${tf === "W" ? "Weekly" : "Daily"} ${side === "low" ? "lows" : "highs"} ${dates} (${g.length} touches)` });
      }
      g = [];
    };
    for (const x of s) { if (g.length && x.p - g[0].p > g[0].p * tolPct) flush(); g.push(x); }
    flush();
  };
  const d = daily.slice(-160), w = weekly.slice(-104);
  cluster(swingPts(d, 2, "low"), 0.006, "D", "low"); cluster(swingPts(d, 2, "high"), 0.006, "D", "high");
  cluster(swingPts(w, 1, "low"), 0.012, "W", "low"); cluster(swingPts(w, 1, "high"), 0.012, "W", "high");
  // big candles: the top of a big green candle (support), the top of a big red one (resistance)
  const recent = d.slice(-90), bodies = recent.map((b) => Math.abs(b[4] - b[1])).sort((x, y) => x - y);
  const med = bodies[Math.floor(bodies.length / 2)] || 0;
  for (const b of recent) {
    const body = Math.abs(b[4] - b[1]);
    if (!(med > 0) || body < med * 2.2) continue;
    const top = Math.max(b[1], b[4]);
    raw.push({ type: "buy", a: top - body * 0.25, b: top, tf: "D", kind: b[4] > b[1] ? "big-green" : "big-red", score: 3,
      why: `Top of the big ${b[4] > b[1] ? "green" : "red"} daily candle ${mdET(b[0])}` });
  }
  // unfilled daily gaps
  for (let i = Math.max(1, d.length - 120); i < d.length; i++) {
    const prev = d[i - 1], cur = d[i], after = d.slice(i + 1);
    if (cur[3] > prev[2] && after.every((x) => x[3] > prev[2]) && last > prev[2] && cur[3] - prev[2] > last * 0.003)
      raw.push({ type: "buy", a: prev[2], b: cur[3], tf: "D", kind: "gap", score: 3, why: `Unfilled gap up ${mdET(cur[0])}` });
    if (cur[2] < prev[3] && after.every((x) => x[2] < prev[3]) && last < prev[3] && prev[3] - cur[2] > last * 0.003)
      raw.push({ type: "buy", a: cur[2], b: prev[3], tf: "D", kind: "gap", score: 3, why: `Unfilled gap down ${mdET(cur[0])}` });
  }
  // side by position: under the price = buy box, over it = sell box; through the price or too far = dropped
  const kept: Omit<Zone, "id">[] = [];
  for (const z of raw) {
    const a = Math.min(z.a, z.b), b = Math.max(z.a, z.b);
    if (a <= last && b >= last) continue;
    const near = b < last ? b : a, dist = Math.abs(near - last) / last;
    if (dist > 0.12) continue;
    const type = b < last ? "buy" : "sell";
    // a broken level flips: old highs under the price are support now, old lows over it are resistance now
    const flip = type === "buy" && /highs|big red/.test(z.why) ? " — old resistance, now support"
      : type === "sell" && /lows|big green/.test(z.why) ? " — old support, now resistance" : "";
    kept.push({ ...z, a: r2(a), b: r2(b), type, flip, score: +(z.score + Math.max(0, 3 - dist * 40)).toFixed(2) } as any);
  }
  // merge overlapping zones of the same side: the stronger one stays, reasons add up
  kept.sort((x, y) => y.score - x.score);
  const out: Omit<Zone, "id">[] = [];
  for (const z of kept) {
    const o = out.find((y) => y.type === z.type && Math.min(y.b, z.b) - Math.max(y.a, z.a) > 0);
    if (o) { if (!o.why.includes(z.why) && o.why.split("; ").length < 3) o.why += "; " + z.why; (o as any).flip ||= (z as any).flip; o.score = +(o.score + 1).toFixed(2); continue; }
    out.push({ ...z });
  }
  const buys = out.filter((z) => z.type === "buy").slice(0, 6), sells = out.filter((z) => z.type === "sell").slice(0, 6);
  return [...buys, ...sells].sort((x, y) => y.score - x.score)
    .map(({ flip, ...z }: any, i) => ({ ...z, why: z.why + (flip || ""), id: "C" + (i + 1) }));
}

/** Re-charting keeps what Josh kept or adjusted, drops repeats of what he removed, and adds the new picks. */
export function mergeBoxes(old: any[], picks: any[]): any[] {
  const ov = (x: any, y: any) => Math.min(x.b, y.b) - Math.max(x.a, y.a) > 0;
  const keep = (old || []).filter((b) => b.review === "keep" || b.review === "adj");
  const gone = (old || []).filter((b) => b.review === "rem");
  const out = [...keep];
  for (const p of picks) if (!out.some((k) => k.type === p.type && ov(k, p)) && !gone.some((g) => g.type === p.type && ov(g, p))) out.push(p);
  return [...out, ...gone.filter((g) => !out.some((o) => o.id === g.id))];
}

const toCBars = (bars: Bar[]): CBar[] => bars.map((b) => [b.t, r2(b.o), r2(b.h), r2(b.l), r2(b.c)]);
async function chartBars(tk: string): Promise<{ daily: CBar[]; weekly: CBar[] }> {
  const get = async (interval: string, days: number) => parseRhBars(mcpJson(await withTimeout(call("rh", "get_equity_historicals",
    { symbols: [tk], interval, start_time: new Date(Date.now() - days * 864e5).toISOString() }), 20_000, `Robinhood ${interval} bars`)))[tk] || [];
  const [d, w] = await Promise.all([get("day", 400), get("week", 760)]);
  return { daily: toCBars(d), weekly: toCBars(w) };
}
const barsLine = (bars: CBar[], n: number) => bars.slice(-n).map((b) => `${mdET(b[0])} o${b[1]} h${b[2]} l${b[3]} c${b[4]}`).join(" · ");

export const BOX_RULES = `OTTO RULES — BUY BOX / SELL BOX:
- Green buy box = strong support (prior lows that held, the top of a big green candle). Red sell box = strong resistance (prior highs that rejected, big red candles). Everything in between is chatter: no trade.
- Find the zones on the weekly first, then the daily. Be picky and patient: the best setup, not any setup.
- Do the opposite of what feels natural: buy weakness in the buy box, sell strength in the sell box. Don't buy the first poke above resistance.
- If price breaks out of a box on a daily close, the range changes and the next box is the target.`;
const PICK_TOOL = { name: "pick_boxes", description: "Pick tonight's boxes for this stock from the numbered candidate zones, and write the read.",
  input_schema: { type: "object", properties: {
    boxes: { type: "array", minItems: 1, maxItems: 4, items: { type: "object", properties: {
      id: { type: "string", description: "A candidate id from the list (C1, C2…). Never invent a zone." },
      why: { type: "string", description: "One short plain sentence: why this box matters for tomorrow." } }, required: ["id", "why"] } },
    read: { type: "string", description: "2–3 plain sentences: where price is (in a box or in the chatter), and the plan — calls only at a buy box, puts only at a sell box, nothing in between." } },
    required: ["boxes", "read"] } };

/** Chart one stock for a day: bars → candidate zones → Jarvis picks → saved (kept boxes survive a re-chart). */
export async function chartOne(x: { ticker: string; day?: string; by?: string; mode?: string; extra?: boolean }) {
  const tk = v322Sym(x.ticker), day = x.day || watchDay();
  if (!tk) throw new Error("need a ticker");
  const prev = (await db(`otto_charts?select=*&day=eq.${day}&ticker=eq.${tk}`).catch(() => []))?.[0] || null;
  const base = { day, ticker: tk, extra: x.extra ?? prev?.extra ?? !CHART_LIST.includes(tk) };
  await db("otto_charts?on_conflict=day,ticker", { method: "POST", headers: { prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify([{ ...base, status: "charting", error: null, updated_at: new Date().toISOString() }]) }).catch(() => {});
  try {
    const { daily, weekly } = await chartBars(tk);
    if (daily.length < 30) throw new Error(`Robinhood has too little history for ${tk} (${daily.length} daily bars)`);
    const px = (await rhPrices([tk]).catch(() => ({} as Record<string, number>)))[tk];
    const last = px > 0 ? px : daily[daily.length - 1][4];
    const cands = findZones(daily, weekly, last);
    let picks: any[] = [], read = "";
    if (cands.length) {
      const list = cands.map((z) => `${z.id} ${z.type.toUpperCase()} ${z.a}–${z.b} (score ${z.score}) — ${z.why}`).join("\n");
      try {
        const out = await claudeTool({ model: MODEL, max_tokens: 900,
          system: [{ type: "text", text: `You are Jarvis inside Otto Trader, charting ${tk} for ${prettyDate(day)} the way the Otto Rules chart.${NAME_RULE}\n\n${BOX_RULES}` }],
          tools: [PICK_TOOL], messages: [{ role: "user", content:
            `${tk} last price ${last.toFixed(2)}.\nWEEKLY (last 12): ${barsLine(weekly, 12)}\nDAILY (last 25): ${barsLine(daily, 25)}\n\nCANDIDATE ZONES (found on the bars by the server — pick from these only):\n${list}\n\nPick the best 2–4: at least the nearest strong buy box under price and the nearest strong sell box over it when they exist. Write the read.` }] },
          "pick_boxes", 60_000);
        for (const b of (Array.isArray(out?.boxes) ? out.boxes : [])) {
          const z = cands.find((c) => c.id === String(b.id || "").trim().toUpperCase());
          if (z && !picks.some((p) => p.cand === z.id)) picks.push({ cand: z.id, type: z.type, a: z.a, b: z.b, why: `${unname(String(b.why || "")).slice(0, 200)} (${z.why})`, tf: z.tf });
        }
        read = unname(String(out?.read || "")).slice(0, 600);
      } catch (e) { read = `Jarvis couldn't pick tonight (${String((e as Error).message).slice(0, 80)}) — these are the strongest zones by the count.`; }
      if (!picks.length) {
        for (const t of ["buy", "sell"] as const) { const z = cands.find((c) => c.type === t); if (z) picks.push({ cand: z.id, type: z.type, a: z.a, b: z.b, why: z.why, tf: z.tf }); }
        if (!read) read = "These are the strongest zones by the count.";
      }
    } else read = `No clean zone within 12% of ${last.toFixed(2)} on the weekly or daily — nothing to box tonight.`;
    const stamp = new Date().toISOString();
    const fresh = picks.map((p, i) => ({ id: `${tk}-${Date.now().toString(36)}-${i}`, ...p, review: null, at: stamp }));
    const boxes = mergeBoxes(prev?.boxes || [], fresh);
    const chat = [...(prev?.chat || []), { w: "otto", t: `Charted ${tk}${x.mode === "morning" ? " for the open" : ""} at ${fmtMin(etParts().min)} ET${prev?.boxes?.length ? " (re-chart: boxes you kept stay kept)" : ""}. ${read}`, at: stamp, by: x.by || "Otto" }].slice(-60);
    await db("otto_charts?on_conflict=day,ticker", { method: "POST", headers: { prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify([{ ...base, status: "ready", last, daily: daily.slice(-60), weekly: weekly.slice(-60), candidates: cands, boxes, read, chat,
        error: null, charted_at: stamp, mode: x.mode || "manual", charted_by: String(x.by || "Otto").slice(0, 60), updated_at: stamp }]) });
    await chartsReadyPing(day).catch(() => {});
    return { ok: true, ticker: tk, boxes: boxes.length };
  } catch (e) {
    const m = String((e as Error).message || e).slice(0, 200);
    await db(`otto_charts?day=eq.${day}&ticker=eq.${tk}`, { method: "PATCH", headers: { prefer: "return=minimal" },
      body: JSON.stringify({ status: "error", error: m, updated_at: new Date().toISOString() }) }).catch(() => {});
    return { ok: false, ticker: tk, error: m };
  }
}
async function chartsReadyPing(day: string) {
  const rows = await db(`otto_charts?select=ticker,status&day=eq.${day}`).catch(() => []);
  const ready = (rows || []).filter((r: any) => CHART_LIST.includes(r.ticker) && r.status === "ready").length;
  if (ready < CHART_LIST.length) return;
  const s = await setting("charts_ready_sent").catch(() => null);
  if (s?.day === day) return;
  await putSetting("charts_ready_sent", { day, at: new Date().toISOString() }, "charts").catch(() => {});
  await notify("charts", `📈 Night Charts ready for ${prettyDate(day).replace(/, \d{4}$/, "")}`, "Mag-7 + SPY + QQQ are charted. Open the Charts tab to keep, adjust or remove the boxes.", "./#charts");
}
/** Start one run per stock (each its own function call); falls back to one after another. */
export async function chartMany(tickers: string[], day: string, by: string, mode: string) {
  for (const t of tickers) await db("otto_charts?on_conflict=day,ticker", { method: "POST", headers: { prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify([{ day, ticker: t, status: "charting", error: null, extra: !CHART_LIST.includes(t), updated_at: new Date().toISOString() }]) }).catch(() => {});
  const left: string[] = [];
  for (const t of tickers) if (!(await kick("chart_one", { ticker: t, day, by, mode }))) left.push(t);
  if (left.length) background((async () => { for (const t of left) await chartOne({ ticker: t, day, by, mode }); })());
  return { ok: true, started: tickers.length };
}
/** cron (every 10 min): the night run 8:30–10 PM ET on trading days (for the next trading day), the 8:45 AM update. */
export async function chartsCron(now = new Date()) {
  const e = etParts(now);
  if (isTradingDay(e.date) && e.min >= 1230 && e.min < 1320) {
    const day = nextTradingDay(e.date), s = await setting("charts_night").catch(() => null);
    if (s?.day === day) return { ok: true, skipped: "night run done" };
    await putSetting("charts_night", { day, at: now.toISOString() }, "cron");
    return chartMany(CHART_LIST, day, "Otto (night)", "night");
  }
  if (isTradingDay(e.date) && e.min >= 520 && e.min < 560) {
    const s = await setting("charts_morning").catch(() => null);
    if (s?.day === e.date) return { ok: true, skipped: "morning update done" };
    await putSetting("charts_morning", { day: e.date, at: now.toISOString() }, "cron");
    const extra = ((await db(`otto_charts?select=ticker&day=eq.${e.date}&extra=eq.true`).catch(() => [])) || []).map((r: any) => r.ticker);
    return chartMany([...CHART_LIST, ...extra], e.date, "Otto (8:45 update)", "morning");
  }
  return { ok: true, skipped: "not a chart window" };
}

/* ---- the Charts tab ---- */
const chartDay = (d?: string) => /^\d{4}-\d{2}-\d{2}$/.test(String(d || "")) ? String(d) : watchDay();
export async function chartsGet(day0?: string) {
  const day = chartDay(day0);
  const rows = await db(`otto_charts?select=*&day=eq.${day}&order=ticker.asc`).catch(() => []) || [];
  const order = (t: string) => { const i = CHART_LIST.indexOf(t); return i < 0 ? 100 : i; };
  rows.sort((a: any, b: any) => order(a.ticker) - order(b.ticker) || String(a.ticker).localeCompare(b.ticker));
  const night = rows.filter((r: any) => r.mode === "night" && r.charted_at).map((r: any) => r.charted_at).sort().pop() || null;
  const morning = rows.filter((r: any) => r.mode === "morning" && r.charted_at).map((r: any) => r.charted_at).sort().pop() || null;
  return { ok: true, day, list: CHART_LIST, rows, ready: rows.filter((r: any) => CHART_LIST.includes(r.ticker) && r.status === "ready").length,
    night_at: night, morning_at: morning, reviewed: rows.filter((r: any) => r.used_at).length };
}
async function chartRow(tk: string, day0?: string) {
  const day = chartDay(day0);
  const r = (await db(`otto_charts?select=*&day=eq.${day}&ticker=eq.${v322Sym(tk)}`))?.[0];
  if (!r) throw new Error(`${v322Sym(tk)} isn't charted for ${day} yet — press Chart now.`);
  return r;
}
export async function chartReview(b: any, who: string) {
  const r = await chartRow(b.ticker, b.day);
  const by = String(b.author || who.split("@")[0]).slice(0, 40);
  const boxes = (r.boxes || []).map((x: any) => ({ ...x }));
  const bx = boxes.find((x: any) => x.id === b.box_id);
  if (!bx) throw new Error("that box isn't on this chart any more — refresh");
  const review = ["keep", "adj", "rem"].includes(b.review) ? b.review : null;
  const chat = [...(r.chat || [])];
  if (review === "adj") {
    const lo = Math.min(Number(b.low), Number(b.high)), hi = Math.max(Number(b.low), Number(b.high));
    if (!(lo > 0) || !(hi > lo)) throw new Error("give the box a low and a high price");
    if (r.last > 0 && (pctOff(lo, r.last) > 0.15 || pctOff(hi, r.last) > 0.15)) throw new Error(`${r.ticker} is ${Number(r.last).toFixed(2)} — a box more than 15% away is probably a typo`);
    if (lo <= r.last && hi >= r.last) throw new Error(`${r.ticker} ${Number(r.last).toFixed(2)} is inside that range — a box sits under the price (buy) or over it (sell)`);
    bx.a = r2(lo); bx.b = r2(hi); bx.type = hi < r.last ? "buy" : "sell"; bx.review = "adj";
    chat.push({ w: "sys", t: `${by} moved the ${bx.type} box to ${bx.a}–${bx.b}`, at: new Date().toISOString() });
  } else {
    bx.review = bx.review === review ? null : review;
    if (bx.review) chat.push({ w: "sys", t: `${by} ${bx.review === "keep" ? "kept" : "removed"} the ${bx.type} box ${bx.a}–${bx.b}`, at: new Date().toISOString() });
  }
  bx.by = by;
  const u = await db(`otto_charts?id=eq.${r.id}&select=*`, { method: "PATCH", body: JSON.stringify({ boxes, chat: chat.slice(-60), updated_at: new Date().toISOString() }) });
  return { ok: true, row: u?.[0] || null };
}
/** "Use kept boxes today": each kept/adjusted box → one Watcher level at its near edge. */
export async function chartUse(b: any, who: string) {
  const r = await chartRow(b.ticker, b.day);
  const by = String(b.author || who.split("@")[0]).slice(0, 40);
  const kept = (r.boxes || []).filter((x: any) => x.review === "keep" || x.review === "adj");
  if (!kept.length) throw new Error("Keep or adjust at least one box first.");
  const added: string[] = [], skipped: string[] = [];
  for (const x of kept) {
    const up = x.type === "buy", level = up ? Math.max(x.a, x.b) : Math.min(x.a, x.b);
    try {
      await watchAdd({ ticker: r.ticker, level, dir: up ? "up" : "down", source: "desk", by: `${by} · Night Charts`,
        note: `Night Charts ${up ? "buy" : "sell"} box ${x.a}–${x.b}: ${String(x.why || "").slice(0, 120)}` });
      added.push(`${level} ${up ? "▲" : "▼"}`);
    } catch (e) { skipped.push(`${level} (${String((e as Error).message).slice(0, 80)})`); }
  }
  const at = new Date().toISOString();
  const boxes = (r.boxes || []).map((x: any) => kept.some((k: any) => k.id === x.id) ? { ...x, used: true } : x);
  const chat = [...(r.chat || []), { w: "sys", t: `${by} put ${added.length} level${added.length === 1 ? "" : "s"} on today's Watcher: ${added.join(", ") || "none"}${skipped.length ? ` · skipped ${skipped.join("; ")}` : ""}`, at }];
  await db(`otto_charts?id=eq.${r.id}`, { method: "PATCH", headers: { prefer: "return=minimal" }, body: JSON.stringify({ boxes, chat: chat.slice(-60), used_at: at, updated_at: at }) });
  if (added.length) await logDesk("system", "Otto", `📈 Night Charts: ${by} put ${r.ticker} ${added.join(", ")} on the Watcher for ${r.day} (buy box → its top edge, calls side; sell box → its bottom edge, puts side).`);
  return { ok: true, added, skipped };
}
const CHART_REPLY = { name: "chart_reply", description: "Answer about this chart; optionally move one box when they ask you to.",
  input_schema: { type: "object", properties: {
    text: { type: "string", description: "Your answer, 1–4 plain sentences, from the chart, the boxes' reasons and the Otto Rules." },
    move: { type: "object", description: "Only if they asked you to move a box.", properties: { box_id: { type: "string" }, low: { type: "number" }, high: { type: "number" } }, required: ["box_id", "low", "high"] } },
    required: ["text"] } };
export async function chartChat(b: any, who: string) {
  const r = await chartRow(b.ticker, b.day);
  const by = String(b.author || who.split("@")[0]).slice(0, 40), q = String(b.text || "").trim().slice(0, 600);
  if (!q) throw new Error("type a question");
  const chat = [...(r.chat || []), { w: "josh", by, t: q, at: new Date().toISOString() }];
  const boxes = (r.boxes || []).map((x: any) => `${x.id} ${x.type.toUpperCase()} ${x.a}–${x.b}${x.review ? ` [${x.review}]` : ""} — ${x.why}`).join("\n");
  const cands = (r.candidates || []).map((z: any) => `${z.id} ${z.type} ${z.a}–${z.b} — ${z.why}`).join("\n");
  let text = "", moved = "";
  try {
    const out = await claudeTool({ model: MODEL, max_tokens: 700,
      system: [{ type: "text", text: `You are Jarvis inside Otto Trader, going over the ${r.ticker} Night Chart with ${by}. Team approach: explain, don't grade.${NAME_RULE}\n\n${BOX_RULES}` }],
      tools: [CHART_REPLY], messages: [{ role: "user", content:
        `${r.ticker} last ${r.last}. Read: ${r.read}\nBOXES:\n${boxes || "(none)"}\nCANDIDATE ZONES:\n${cands || "(none)"}\nDAILY (last 20): ${barsLine(r.daily || [], 20)}\nWEEKLY (last 10): ${barsLine(r.weekly || [], 10)}\nCHAT SO FAR:\n${chat.slice(-10).map((m: any) => `${m.w === "otto" ? "Jarvis" : m.by || m.w}: ${m.t}`).join("\n")}\n\nAnswer ${by}'s last message.` }] },
      "chart_reply", 45_000);
    text = unname(String(out?.text || "")).slice(0, 1200);
    if (out?.move?.box_id) {
      try { await chartReview({ ticker: r.ticker, day: r.day, box_id: out.move.box_id, review: "adj", low: out.move.low, high: out.move.high, author: "Jarvis" }, who); moved = ` (Moved the box to ${r2(Math.min(out.move.low, out.move.high))}–${r2(Math.max(out.move.low, out.move.high))}.)`; }
      catch (e) { moved = ` (Couldn't move the box: ${String((e as Error).message).slice(0, 100)})`; }
    }
  } catch (e) { text = `Jarvis couldn't answer just now (${String((e as Error).message).slice(0, 100)}). Try again.`; }
  const fresh = (await db(`otto_charts?select=chat&id=eq.${r.id}`).catch(() => []))?.[0]?.chat || chat;
  // keep lines written meanwhile (a box move, a review) after the question, in order
  const merged = [...chat, ...fresh.filter((m: any) => !chat.some((c: any) => c.at === m.at && c.t === m.t))];
  merged.push({ w: "otto", t: text + moved, at: new Date().toISOString() });
  const u = await db(`otto_charts?id=eq.${r.id}&select=*`, { method: "PATCH", body: JSON.stringify({ chat: merged.slice(-60), updated_at: new Date().toISOString() }) });
  return { ok: true, row: u?.[0] || null };
}
export async function chartNow(b: any, who: string) {
  const by = String(b.author || who.split("@")[0]).slice(0, 40), day = watchDay();
  if (b.all) return chartMany(CHART_LIST, day, by, "manual");
  const tk = v322Sym(b.ticker);
  if (!tk || !/^[A-Z.]{1,6}$/.test(tk)) throw new Error("type a ticker like PLTR");
  if (!CHART_LIST.includes(tk)) {
    const px = (await rhPrices([tk]).catch(() => ({} as Record<string, number>)))[tk];
    if (!(px > 0)) throw new Error(`Robinhood has no price for ${tk} — check the ticker.`);
  }
  return chartMany([tk], day, by, "manual");
}
export const __test_actOn = actOn;   // v3.39 tests

/* ============================================================ v3.45 (22 Oct 2026) — HOMEWORK (approved mockup v345-homework-mockup.html)
   The coach's after-close read (22 Oct 1:1, `claude/coach-call-2026-10-22.md`) as a screen. Otto fills the NUMBERS; Josh writes every line.
   Ifoma 22 Oct: no blocking, ever — a skipped night is FLAGGED (Desk banner, a tag on that day's cards, Baby J's morning read, the Friday
   report card). Due 9:00 AM ET on the trading day it is for (for_day). Graded at 4:05 PM on for_day from real 5-minute bars (gradeRead).
   Table otto_homework (028_v345.sql). Levels he marks go on the Watcher for for_day (buy side AND sell side). */
export const HK_MIN = 10;
export const HK_CALLS = ["bullish", "slightly bullish", "slightly bearish", "bearish"];
export const HK_STEPS = [
  { id: "bonds", title: "Bonds first", hint: "Red bonds = yields down = people buying Treasuries. Nasdaq red too = defensive.", need: true },
  { id: "indexes", title: "Indexes — who leads, who lags", hint: "Dow, S&P, Nasdaq, Russell. Relative, not absolute.", need: true },
  { id: "oil", title: "Oil vs oil stocks — do they agree?", hint: "If not, write WHY. That mismatch is where the money is.", need: true },
  { id: "cross", title: "Dollar, gold, copper, crypto", hint: "Safe haven, Dr. Copper, store of value. One line.", need: true },
  { id: "call", title: "Your call for tomorrow", hint: "Pick one, then one sentence: why.", need: true },
  { id: "earnings", title: "Earnings — what matters", hint: "Which report moves the whole market and why? Guidance beats the EPS beat.", need: true },
  { id: "qqq", title: "QQQ — gaps & key levels", hint: "2–3 lines max. Gaps beat candle levels.", need: true },
  { id: "odd", title: "Is-but-shouldn't-be", hint: "Anything on the watch list that doesn't line up. Ugly / out-of-favour names.", need: false },
  { id: "levels", title: "Tomorrow's levels → Watcher", hint: "Buy side AND sell side. They go straight on the Watcher.", need: true },
];
// TradingView's public scanner (same endpoint as tvYield10). One call for the whole sheet.
export const HK_SYMS: { s: string; step: string; label: string; yld?: boolean }[] = [
  { s: "TVC:US10Y", step: "bonds", label: "US 10Y", yld: true }, { s: "TVC:US02Y", step: "bonds", label: "US 2Y", yld: true }, { s: "NASDAQ:TLT", step: "bonds", label: "TLT" },
  { s: "AMEX:DIA", step: "indexes", label: "Dow (DIA)" }, { s: "SP:SPX", step: "indexes", label: "S&P 500" }, { s: "NASDAQ:IXIC", step: "indexes", label: "Nasdaq" }, { s: "AMEX:IWM", step: "indexes", label: "Russell (IWM)" },
  { s: "NYMEX:CL1!", step: "oil", label: "Oil" }, { s: "NYSE:XOM", step: "oil", label: "XOM" }, { s: "NYSE:CVX", step: "oil", label: "CVX" },
  { s: "TVC:DXY", step: "cross", label: "Dollar (DXY)" }, { s: "FX_IDC:USDJPY", step: "cross", label: "USD/JPY" }, { s: "COMEX:GC1!", step: "cross", label: "Gold" },
  { s: "COMEX:HG1!", step: "cross", label: "Copper" }, { s: "BITSTAMP:BTCUSD", step: "cross", label: "Bitcoin" },
  { s: "NASDAQ:QQQ", step: "qqq", label: "QQQ" },
];
export function hkRows(j: any) {
  const by: Record<string, any[]> = {};
  for (const r of (j?.data || [])) by[String(r.s)] = r.d;
  return HK_SYMS.map((x) => {
    const d = by[x.s]; const price = Number(d?.[0]), prev = Number(d?.[1]);
    if (!d || !isFinite(price) || price <= 0) return { ...x, price: null, prev: null, pct: null, chg: null };
    const okPrev = isFinite(prev) && prev > 0;
    return { ...x, price: +price.toFixed(x.yld ? 3 : 2), prev: okPrev ? prev : null,
      pct: okPrev ? +(((price - prev) / prev) * 100).toFixed(2) : null, chg: okPrev ? +(price - prev).toFixed(x.yld ? 3 : 2) : null };
  });
}
// Oil up / XOM down (or the reverse) by more than 0.3% each = the coach's dislocation.
export function hkMismatch(rows: any[]) {
  const g = (l: string) => rows.find((r) => r.label === l)?.pct;
  const oil = g("Oil"), xom = g("XOM");
  return oil != null && xom != null && Math.abs(oil) >= 0.3 && Math.abs(xom) >= 0.3 && Math.sign(oil) !== Math.sign(xom);
}
async function hkMarket() {
  return await cached("hk_market", 60e3, async () => {
    const r = await withTimeout(fetch("https://scanner.tradingview.com/global/scan", { method: "POST",
      headers: { ...UA, "content-type": "application/json", "origin": "https://www.tradingview.com", "referer": "https://www.tradingview.com/" },
      body: JSON.stringify({ symbols: { tickers: HK_SYMS.map((x) => x.s), query: { types: [] } }, columns: ["close", "close[1]", "update_time"] }) }), 10_000, "tradingview scanner");
    if (!r.ok) throw new Error("tradingview HTTP " + r.status);
    const rows = hkRows(await r.json());
    return { rows, mismatch: hkMismatch(rows), at: new Date().toISOString() };
  });
}
// Nasdaq's public calendar: tonight after the close (read_day) + tomorrow before the open (for_day), biggest first.
export function hkPickEarnings(rows: any[], when: "after" | "before", n = 8) {
  const want = when === "after" ? "time-after-hours" : "time-pre-market";
  const cap = (r: any) => Number(String(r?.marketCap || "").replace(/[$,]/g, "")) || 0;
  return (rows || []).filter((r) => r?.time === want && r?.symbol).sort((a, b) => cap(b) - cap(a)).slice(0, n)
    .map((r) => ({ sym: String(r.symbol), name: String(r.name || "").slice(0, 40), when: when === "after" ? "tonight after close" : "before the open", cap: cap(r) }));
}
async function hkEarnings(readDay: string, forDay: string) {
  return await cached(`hk_earn|${readDay}|${forDay}`, 30 * 60e3, async () => {
    const get = async (d: string) => { const r = await withTimeout(fetch("https://api.nasdaq.com/api/calendar/earnings?date=" + d, { headers: UA }), 10_000, "nasdaq calendar");
      if (!r.ok) throw new Error("nasdaq HTTP " + r.status); return (await r.json())?.data?.rows || []; };
    const [a, b] = await Promise.all([get(readDay).catch(() => []), get(forDay).catch(() => [])]);
    return [...hkPickEarnings(a, "after"), ...hkPickEarnings(b, "before")];
  });
}
function hkPrevTradingDay(date: string) { let d = addDays(date, -1); while (!isTradingDay(d)) d = addDays(d, -1); return d; }
// Which night's homework is open now: after the close / weekend → the next trading day; before or during the session → today.
export function hkForDay(now = new Date()) { return watchDay(now); }
export const hkAuthor = (a: any) => PREP_AUTHORS.has(String(a)) ? String(a) : "Josh";
const hkDue = (forDay: string) => nyIso(forDay, "9:00 AM")!;
export function hkValidate(b: any): { ok: boolean; errors: string[]; answers: Record<string, string>; call: string | null; levels: any[] } {
  const clean = (v: unknown, n = 500) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, n);
  const answers: Record<string, string> = {};
  for (const s of HK_STEPS) if (s.id !== "levels") answers[s.id] = clean(b?.answers?.[s.id]);
  const call = HK_CALLS.includes(String(b?.call || "").toLowerCase()) ? String(b.call).toLowerCase() : null;
  const levels = (Array.isArray(b?.levels) ? b.levels : []).slice(0, 12).map((x: any) => ({
    ticker: String(x?.ticker || "").toUpperCase().replace(/[^A-Z.]/g, "").slice(0, 8), level: Math.round(Number(x?.level) * 100) / 100,
    dir: x?.dir === "up" || x?.dir === "down" ? x.dir : null, note: clean(x?.note, 120) })).filter((x: any) => x.ticker || x.level > 0);
  const errors: string[] = [];
  for (const s of HK_STEPS) {
    if (!s.need || s.id === "levels") continue;
    if (answers[s.id].length < HK_MIN) errors.push(`${s.title}: write at least ${HK_MIN} characters`);
  }
  if (!call) errors.push("Your call for tomorrow: pick bullish / slightly bullish / slightly bearish / bearish");
  const good = levels.filter((x: any) => x.ticker && x.level > 0 && x.dir);
  if (!good.length) errors.push("Tomorrow's levels: at least one level with a ticker, a price and ▲ buy or ▼ sell");
  if (levels.some((x: any) => !(x.ticker && x.level > 0 && x.dir))) errors.push("Tomorrow's levels: every row needs a ticker, a price and ▲ buy or ▼ sell (or delete the row)");
  return { ok: !errors.length, errors, answers, call, levels: good };
}
async function hkRow(forDay: string, author: string) {
  return (await db(`otto_homework?select=*&for_day=eq.${forDay}&author=eq.${encodeURIComponent(author)}`).catch(() => []))?.[0] || null;
}
// Josh's status for one trading day (default today): done on time / late / missed (due passed, nothing handed in) / pending.
export async function hkStatus(day = etParts().date, author = "Josh") {
  if (!isTradingDay(day)) return { applies: false, for_day: day };
  const since = (await setting("homework_since").catch(() => null))?.day || null;
  if (!since || day < since) return { applies: false, for_day: day, before_start: true };
  const r = await hkRow(day, author);
  const due = hkDue(day), past = Date.now() > Date.parse(due);
  const inAt = r?.status === "handed_in" ? r.handed_in_at : null;
  const done = !!inAt && Date.parse(inAt) <= Date.parse(due), late = !!inAt && !done;
  return { applies: true, for_day: day, due, done, late, missed: !inAt && past, pending: !inAt && !past,
    call: r?.call || null, call_why: r?.answers?.call || null, levels: (r?.levels || []).map((x: any) => ({ ticker: x.ticker, level: x.level, dir: x.dir })), grade: r?.grade || null };
}
/* v5.2: a Homework level within 0.2% of a level the coach said on that day's live call gets a "coach said it too" tag. */
export function earsMatch(st: any, forDay: string, levels: any): { ticker: string; level: number; min: number; meaning: string }[] {
  if (!st || !Array.isArray(st.levels) || !Array.isArray(levels) || etParts(new Date(st.started || 0)).date !== forDay) return [];
  const out: any[] = [];
  for (const m of levels) {
    const t = String(m?.ticker || "").toUpperCase().trim(), v = Number(m?.level);
    if (!t || !(v > 0)) continue;
    const e = st.levels.find((l: any) => l.status !== "dismissed" && l.ticker === t && Math.abs(Number(l.level) - v) / v <= 0.002);
    if (e) out.push({ ticker: t, level: v, min: Number(e.min) || 0, meaning: String(e.meaning || "").slice(0, 120) });
  }
  return out;
}
export async function hkGet(authorIn: any) {
  const author = hkAuthor(authorIn);
  const forDay = hkForDay(), readDay = hkPrevTradingDay(forDay);
  if (!(await setting("homework_since").catch(() => null))?.day) await putSetting("homework_since", { day: forDay }, "Otto").catch(() => {});
  const row = await hkRow(forDay, author);
  const errors: Record<string, string> = {};
  let data: any = row?.status === "handed_in" && row?.data ? row.data : null;
  if (!data) {
    const [m, e] = await Promise.all([hkMarket().catch((x) => { errors.market = String((x as Error).message).slice(0, 120); return null; }),
      hkEarnings(readDay, forDay).catch((x) => { errors.earnings = String((x as Error).message).slice(0, 120); return []; })]);
    data = { market: m, earnings: e || [] };
  }
  const ws = mondayOf(forDay), we = addDays(ws, 4);
  const rows: any[] = (await db(`otto_homework?select=for_day,status,handed_in_at,call,grade&author=eq.${encodeURIComponent(author)}&for_day=gte.${ws}&for_day=lte.${we}&order=for_day.asc`).catch(() => [])) || [];
  const since = (await setting("homework_since").catch(() => null))?.day || forDay;
  const week: any[] = [];
  for (let d = ws; d <= we; d = addDays(d, 1)) {
    if (!isTradingDay(d)) continue;
    const r = rows.find((x) => x.for_day === d), due = hkDue(d);
    const inAt = r?.status === "handed_in" ? r.handed_in_at : null;
    week.push({ day: d, wd: dayName(d), before_start: d < since, open: d === forDay,
      state: inAt ? (Date.parse(inAt) <= Date.parse(due) ? "done" : "late") : Date.now() > Date.parse(due) ? (d < since ? "n/a" : "missed") : "open",
      right: r?.grade?.direction ?? null });
  }
  const last = (await db(`otto_homework?select=for_day,call,answers,levels,grade&author=eq.${encodeURIComponent(author)}&grade=not.is.null&order=for_day.desc&limit=1`).catch(() => []))?.[0] || null;
  const ears_match = earsMatch(await setting("ears_state").catch(() => null), forDay, row?.levels);
  return { ok: true, author, for_day: forDay, read_day: readDay, due: hkDue(forDay), clock: marketClock().status, steps: HK_STEPS, calls: HK_CALLS, min: HK_MIN,
    row, data, errors, week, last_graded: last, since, ears_match };
}
export async function hkSave(b: any) {
  const author = hkAuthor(b?.author), forDay = hkForDay();
  const v = hkValidate(b);
  const now = new Date().toISOString();
  const raw = (Array.isArray(b?.levels) ? b.levels : []).slice(0, 12);   // a draft keeps half-typed rows
  const r = await db("otto_homework?on_conflict=for_day,author&select=*", { method: "POST",
    headers: { prefer: "resolution=merge-duplicates,return=representation" },
    body: JSON.stringify([{ for_day: forDay, author, answers: v.answers, call: v.call, levels: raw, updated_at: now }]) });
  return { ok: true, saved_at: now, row: r?.[0] || null };
}
export async function hkSubmit(b: any, who: string) {
  const author = hkAuthor(b?.author), forDay = hkForDay(), readDay = hkPrevTradingDay(forDay);
  const v = hkValidate(b);
  if (!v.ok) return { ok: false, errors: v.errors };
  const prev = await hkRow(forDay, author);
  const [m, e] = await Promise.all([hkMarket().catch(() => null), hkEarnings(readDay, forDay).catch(() => [])]);
  const now = new Date().toISOString();
  const first = prev?.status === "handed_in" && prev.handed_in_at ? prev.handed_in_at : now;
  // levels → Watcher (for_day). A level the Watcher refuses (e.g. >10% from the price) is reported, never silently dropped.
  const added: string[] = [], skipped: string[] = [], levels: any[] = [];
  for (const x of v.levels) {
    const was = (prev?.levels || []).find((p: any) => p.ticker === x.ticker && Number(p.level) === x.level && p.dir === x.dir && p.watch_id);
    if (was) { levels.push({ ...x, watch_id: was.watch_id }); continue; }
    try {
      const w = await watchAdd({ ticker: x.ticker, level: x.level, dir: x.dir, source: "desk", by: `${author} · Homework`,
        note: `${author}'s homework: ${x.dir === "up" ? "buy side ▲" : "sell side ▼"}${x.note ? " · " + x.note : ""}` });
      levels.push({ ...x, watch_id: w?.id ?? null });
      added.push(`${x.ticker} ${x.level} ${x.dir === "up" ? "▲" : "▼"}`);
    } catch (err) { skipped.push(`${x.ticker} ${x.level}: ${String((err as Error).message).slice(0, 90)}`); levels.push({ ...x, watch_id: null, refused: String((err as Error).message).slice(0, 90) }); }
  }
  const r = await db("otto_homework?on_conflict=for_day,author&select=*", { method: "POST",
    headers: { prefer: "resolution=merge-duplicates,return=representation" },
    body: JSON.stringify([{ for_day: forDay, author, answers: v.answers, call: v.call, levels, data: { market: m, earnings: e || [] },
      status: "handed_in", handed_in_at: first, updated_at: now }]) });
  const late = Date.parse(first) > Date.parse(hkDue(forDay));
  const head = prev?.status === "handed_in" ? "updated" : "handed in";
  await logDesk("system", "Otto", `📓 ${author} ${head} the homework for ${prettyDate(forDay).replace(/, \d{4}$/, "")}${late ? " (late — after 9:00 AM)" : ""}: ${v.call!.toUpperCase()} — "${v.answers.call.slice(0, 160)}"${added.length ? ` · on the Watcher: ${added.join(", ")}` : ""}${skipped.length ? ` · not added: ${skipped.join("; ")}` : ""}`).catch(() => {});
  await activity("change", `Homework ${head} by ${author} for ${forDay}: ${v.call}${added.length ? " · " + added.join(", ") : ""}`, author, `hw|${forDay}|${author}`).catch(() => {});
  void who;
  return { ok: true, row: r?.[0] || null, added, skipped, late };
}
export const hkBias = (call: string | null) => !call ? "neutral" : /bull/.test(call) ? "long" : "short";
// 4:05 PM on for_day: his call vs QQQ's open→close, his levels touched, the Watcher levels that fired.
export async function hkGradeTick(force = false) {
  const c = marketClock();
  if (!force && (!isTradingDay(c.date) || c.min < 965)) return { ok: true, skipped: "after 4:05 PM on trading days" };
  const rows = await db(`otto_homework?select=*&for_day=eq.${c.date}&status=eq.handed_in&grade=is.null`).catch(() => []);
  if (!rows?.length) return { ok: true, graded: 0 };
  const start = nyIso(c.date, "9:30 AM")!, end = nyIso(c.date, "4:00 PM")!;
  const tickers = [...new Set(["QQQ", ...rows.flatMap((r: any) => (r.levels || []).map((x: any) => x.ticker))])] as string[];
  const bars = await rhBars(tickers, "5minute", start, end);
  for (const t of Object.keys(bars)) bars[t] = bars[t].filter((b) => b.t >= Date.parse(start) && b.t < Date.parse(end));
  const watch: any[] = (await db(`otto_watch?select=ticker,level,dir,fired&day=eq.${c.date}&limit=300`).catch(() => [])) || [];
  let n = 0;
  for (const r of rows) {
    const g: any = gradeRead(hkBias(r.call), bars.QQQ || [], r.levels || [], bars);
    if (!g) continue;
    g.levels = g.levels.map((x: any) => { const w = watch.find((y) => y.ticker === x.ticker && Number(y.level) === Number(x.level) && (y.dir === x.dir || y.dir === "both"));
      return { ...x, fired: !!(w && w.fired && Object.keys(w.fired).length) }; });
    g.used = g.levels.filter((x: any) => x.fired).length;
    g.call = r.call; g.at = new Date().toISOString();
    await db(`otto_homework?id=eq.${r.id}`, { method: "PATCH", headers: { prefer: "return=minimal" }, body: JSON.stringify({ grade: g }) }).catch(() => {});
    n++;
  }
  return { ok: true, graded: n };
}
// The week's homework for the Friday report card (Josh). Late = half a night.
export async function hkWeek(ws: string, we: string, author = "Josh") {
  const since = (await setting("homework_since").catch(() => null))?.day || null;
  if (!since) return null;
  const rows: any[] = (await db(`otto_homework?select=for_day,status,handed_in_at,call,grade&author=eq.${author}&for_day=gte.${ws}&for_day=lte.${we}`).catch(() => [])) || [];
  const days: string[] = [];
  for (let d = ws > since ? ws : since; d <= we; d = addDays(d, 1)) if (isTradingDay(d) && Date.now() > Date.parse(hkDue(d))) days.push(d);
  if (!days.length) return null;
  let done = 0, late = 0, right = 0, judged = 0, touched = 0, of = 0, used = 0;
  const missedDays: string[] = [];
  for (const d of days) {
    const r = rows.find((x) => x.for_day === d && x.status === "handed_in");
    if (!r) { missedDays.push(d); continue; }
    if (Date.parse(r.handed_in_at) <= Date.parse(hkDue(d))) done++; else late++;
    if (r.grade) { if (r.grade.direction === "right") right++; if (r.grade.direction === "right" || r.grade.direction === "wrong") judged++;
      touched += r.grade.touched || 0; of += r.grade.of || 0; used += r.grade.used || 0; }
  }
  return { nights: days.length, done, late, missed: missedDays.length, missed_days: missedDays, right, judged, touched, of, used,
    ratio: (done + 0.5 * late) / days.length };
}
// Push reminders: 8:30 PM the night before and 8:00 AM the morning of, only if not handed in. Once each.
export async function hkRemindTick() {
  const c = marketClock(), e = etParts();
  const pm = c.status !== "open" && e.min >= 1230 && e.min < 1240, am = isTradingDay(e.date) && e.min >= 480 && e.min < 490;
  if (!pm && !am) return { ok: true, skipped: "not a reminder window" };
  const forDay = hkForDay();
  if (pm && forDay === e.date) return { ok: true, skipped: "no homework tonight" };
  const key = `homework_ping_${forDay}_${pm ? "pm" : "am"}`;
  if ((await setting(key).catch(() => null))?.sent) return { ok: true, skipped: "sent" };
  const r = await hkRow(forDay, "Josh");
  if (r?.status === "handed_in") return { ok: true, skipped: "handed in" };
  await putSetting(key, { sent: true }, "Otto").catch(() => {});
  await notify("homework", pm ? "📓 Homework not handed in yet" : "📓 Homework due at 9:00 AM",
    pm ? "Tonight's read: bonds, indexes, oil vs XOM, your call, tomorrow's levels. ~20 minutes." : "Not handed in yet. Skipped = flagged on today's cards and the Friday report card.", "./#homework");
  return { ok: true, sent: pm ? "pm" : "am" };
}
