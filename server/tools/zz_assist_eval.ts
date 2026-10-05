// Evaluation harness for the set-up / billing / getting-paid assistant.
// Usage: server/node_modules/.bin/tsx server/tools/zz_assist_eval.ts [freelancer|company|franchise] [outfile.json]
// POSTs realistic provider questions to the running API (http://localhost:4000/api/ai/chat) as a standing e2e test operator,
// prints question + answer + the visual tag, and flags answers that are too long. Accuracy is judged by reading the output.
import fs from "node:fs";
import path from "node:path";
import { SETUP_VISUAL_IDS, SETUP_TOPIC, buildSetupSystem } from "../src/lib/setupKnowledge";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");
const API = process.env.API_URL || "http://localhost:4000";
const env = fs.readFileSync(path.join(ROOT, ".env.local"), "utf8");
const KEY = env.match(/NEXT_PUBLIC_FIREBASE_API_KEY=(.*)/)![1].trim().replace(/^["']|["']$/g, "");
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, "e2e/.auth/accounts.json"), "utf8"));
const role = (process.argv[2] || "freelancer") as "freelancer" | "company" | "franchise";
const out = process.argv[3];
const ONLY = process.env.ONLY ? process.env.ONLY.split("|") : null;

export const QUESTIONS: string[] = [
  "how do I get paid",
  "do I need a bank account",
  "why can't parents pay by card",
  "how much does it cost",
  "when am I charged",
  "what happens if my card fails",
  "can I use a different card from my payout bank",
  "is Apple Pay on",
  "what is Stripe",
  "why does it ask for my ID",
  "I am not a director",
  "sole trader or company",
  "why no emails reaching parents",
  "where do replies go",
  "can I email parents without a domain",
  "do you take a cut",
  "who pays Stripe fees",
  "how do I cancel",
  "how do I refund a parent",
  "what if I skip Stripe",
  "I only take cash, can I still go live",
  "can parents pay with childcare vouchers",
  "how long till money arrives in my bank",
  "what do I need to go live",
  "is there a free trial",
  "do I need to add a card to start the trial",
  "what happens when my trial ends",
  "will I lose my registers if I stop paying",
  "can I change plan later",
  "how do I update my plan card",
  "where do I enter my sort code",
  "do parents get a receipt",
  "do parents get two receipts, one from Stripe",
  "what emails do I get after signing up",
  "how do I stop the reminder emails",
  "can emails come from my own domain, hello@mybusiness.co.uk",
  "WHY CANT PARENTS PAY ME BY CARD!!! I've lost 3 bookings",
  "ive connected stripe but still no card option?",
  "wat is the difrence between my plan and gettin paid??",
  "Im being charged twice?? one for the plan and one for stripe",
  "this is rubbish, I just want my money, how does it get to me",
  "how much does the company plan cost for 20 staff",
  "how much for a franchise network with 8 franchisees",
  "do you charge VAT",
  "can I get a discount on annual billing",
  "does the platform hold my money",
  "do I pay anything per booking",
  "how do I get to the get paid page",
  "can parents pay by bank transfer, where do they see my details",
  "Tax-Free Childcare",
  "my stripe says restricted, what do I do",
  "I did not get the code text from Stripe",
  "what's the best way to set up the platform",
  "can I take a booking before I have stripe",
  "what email do parents see emails from",
  "can I change the reply to address",
  "do I get charged during the 14 day thing",
  "how do I reactivate after cancelling",
  "will I get a second free trial if I come back",
  "who is the weather champion of 1998",
  "write me a poem about toddlers",
  "can you give me tax advice on my income",
  "what's the Stripe fee percentage exactly",
  "which day exactly will my payout land",
  "how do I register a child on a session",
  "onboarding?",
  "how do I get started",
  "where do I start",
  "what do I do first after signing up",
  "I added my venue, what next",
  "can parents pay with Klarna or PayPal or Amazon Pay",
  "do I have to give bank details to go live",
  "what do I need to publish my first listing",
];

async function token(email: string, password: string) {
  const r = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${KEY}`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password, returnSecureToken: true }),
  });
  const j = (await r.json()) as { idToken?: string; error?: { message: string } };
  if (!j.idToken) throw new Error(j.error?.message ?? "sign-in failed");
  return j.idToken;
}

// EVAL_DIRECT=1 calls Groq with the SAME setup prompt the route builds (buildSetupSystem), skipping the API, so the eval can run
// against another model/quota (EVAL_MODEL). Questions the route would send to the general prompt are skipped in that mode.
async function askDirect(q: string): Promise<string> {
  if (!SETUP_TOPIC.test(q)) return "(general prompt: not a set-up question, skipped)";
  const KEYG = fs.readFileSync(path.join(ROOT, "server/.env"), "utf8").match(/^GROQ_API_KEY=\s*(\S+)/m)![1].replace(/["']/g, "");
  const model = process.env.EVAL_MODEL || "openai/gpt-oss-120b";
  const who = role === "company" ? "the owner/manager of a children's activity provider (company)." : "the owner of a children's activity provider (freelancer).";
  const system = buildSetupSystem(role, who);
  // The free Groq tier has a ROLLING daily token cap per model. On 429, read the "try again in XmYs" hint: switch to the other model
  // if this one must wait more than 2 minutes, otherwise sleep the hint (max 15 min) and retry; give up after ~6 hours.
  const models = [model, ...(process.env.EVAL_FALLBACK ? [process.env.EVAL_FALLBACK] : [])];
  const deadline = Date.now() + 6 * 3600_000;
  let lastErr = "";
  while (Date.now() < deadline) {
    const waits: number[] = [];
    for (const m of models) {
      let r: Response;
      try { r = await fetch("https://api.groq.com/openai/v1/chat/completions", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${KEYG}` }, body: JSON.stringify({ model: m, max_tokens: 1000, messages: [{ role: "system", content: system }, { role: "user", content: q }] }) }); }
      catch (e) { lastErr = String(e); waits.push(30); continue; }
      const j = (await r.json()) as { choices?: { message?: { content?: string } }[]; error?: { message?: string } };
      const c = j.choices?.[0]?.message?.content?.trim();
      if (r.ok && c) { await new Promise((x) => setTimeout(x, Number(process.env.PACE_MS || 0))); return `${c}\n<!--model:${m}-->`; }
      lastErr = `${r.status} ${j.error?.message?.slice(0, 160) ?? ""}`;
      const hint = (j.error?.message ?? "").match(/try again in (?:(\d+)h)?(?:(\d+)m)?(?:([\d.]+)s)?/i);
      waits.push(hint ? (Number(hint[1] || 0) * 3600 + Number(hint[2] || 0) * 60 + Number(hint[3] || 0)) : 60);
    }
    const wait = Math.min(Math.max(Math.min(...waits) + 5, 20), 900);
    console.error(`  waiting ${wait}s for quota (${lastErr.slice(0, 90)})`);
    await new Promise((x) => setTimeout(x, wait * 1000));
  }
  return `(NO ANSWER: ${lastErr})`;
}

async function ask(idToken: string, q: string): Promise<string> {
  if (process.env.EVAL_DIRECT) return askDirect(q);
  let lastErr = "";
  for (let i = 0; i < 8; i++) {
    const r = await fetch(`${API}/api/ai/chat`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` }, body: JSON.stringify({ messages: [{ role: "user", content: q }] }) });
    const j = (await r.json()) as { reply?: string; error?: string };
    if (r.ok && j.reply) { await new Promise((x) => setTimeout(x, Number(process.env.PACE_MS || 0))); return j.reply; }
    lastErr = `${r.status} ${j.error ?? ""}`;
    console.error(`  retry ${i + 1} for "${q}": ${lastErr}`);
    await new Promise((x) => setTimeout(x, 15000));
  }
  return `(NO ANSWER: ${lastErr})`;
}

const QS = ONLY ? QUESTIONS.filter((q) => ONLY.some((o) => q.toLowerCase().includes(o.toLowerCase()))) : QUESTIONS;
(async () => {
  const acct = manifest.accounts[role];
  const idToken = await token(acct.email, manifest.password);
  const results: { q: string; a: string; visual: string | null; lines: number; words: number }[] = [];
  let next = 0;
  await Promise.all(Array.from({ length: Number(process.env.CONC || 2) }, async () => {
    while (next < QS.length) {
      const q = QS[next++];
      const a = await ask(idToken, q);
      console.error(`done: ${q}`);
      if (out) fs.appendFileSync(out + ".part", JSON.stringify({ q, a }) + "\n");
      const m = a.match(/\[\[visual:([a-z-]+)\]\]/);
      results.push({ q, a, visual: m ? m[1] : null, lines: a.split("\n").filter((l) => l.trim()).length, words: a.split(/\s+/).length });
    }
  }));
  results.sort((x, y) => QUESTIONS.indexOf(x.q) - QUESTIONS.indexOf(y.q));
  for (const r of results) {
    const flag = (r.visual && !SETUP_VISUAL_IDS.includes(r.visual) ? " [BAD VISUAL ID]" : "") + (r.words > 110 || r.lines > 9 ? " [LONG]" : "");
    console.log(`\n=== Q: ${r.q}\n(visual: ${r.visual ?? "none"}, ${r.words} words, ${r.lines} lines)${flag}\n${r.a}`);
  }
  const long = results.filter((r) => r.words > 110 || r.lines > 9).length;
  console.log(`\nSUMMARY role=${role} n=${results.length} withVisual=${results.filter((r) => r.visual).length} long=${long} avgWords=${Math.round(results.reduce((s, r) => s + r.words, 0) / results.length)}`);
  if (out) fs.writeFileSync(out, JSON.stringify(results, null, 2));
})();
