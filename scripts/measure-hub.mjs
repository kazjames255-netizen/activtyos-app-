// Time the calls every portal page makes, as a throwaway e2e freelancer (never a real user).
//   node scripts/measure-hub.mjs [apiBase=http://localhost:4000] [label]
// Prints per-endpoint ms (cold-ish first call, then warm), and a concurrent "page load" burst.
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const API = process.argv[2] || "http://localhost:4000";
const label = process.argv[3] || "";
const manifest = JSON.parse(fs.readFileSync(path.join(root, "e2e/.auth/accounts.json"), "utf8"));
const acct = manifest.accounts.freelancer;
const key = (fs.readFileSync(path.join(root, ".env.local"), "utf8").match(/NEXT_PUBLIC_FIREBASE_API_KEY=(.*)/) || [])[1]?.trim().replace(/^["']|["']$/g, "");
if (!key) throw new Error("no NEXT_PUBLIC_FIREBASE_API_KEY in .env.local");

const login = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${key}`, {
  method: "POST", headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email: acct.email, password: manifest.password, returnSecureToken: true }),
}).then((r) => r.json());
if (!login.idToken) throw new Error("sign-in failed: " + JSON.stringify(login.error?.message));
const H = { Authorization: `Bearer ${login.idToken}` };

const PATHS = ["/api/me", "/api/subscription/access", "/api/rota", "/api/learning-hub/students", "/api/learning-hub/topics", "/api/learning-hub/notes/counts"];
const time = async (p) => { const t = performance.now(); let s = 0; try { s = (await fetch(API + p, { headers: H })).status; } catch { s = -1; } return { p, s, ms: Math.round(performance.now() - t) }; };

const out = { label, api: API, at: new Date().toISOString(), first: [], second: [], burst: null };
for (const p of PATHS) out.first.push(await time(p));
for (const p of PATHS) out.second.push(await time(p));
const t0 = performance.now();
const burst = await Promise.all(["/api/me", "/api/subscription/access", "/api/rota", "/api/learning-hub/students", "/api/learning-hub/topics"].map(time));
out.burst = { totalMs: Math.round(performance.now() - t0), calls: burst };
const fmt = (a) => a.map((x) => `${x.p.replace("/api/", "")}:${x.s}:${x.ms}ms`).join("  ");
console.log(`# ${label} ${API}\nfirst : ${fmt(out.first)}\nsecond: ${fmt(out.second)}\nburst : ${out.burst.totalMs}ms  ${fmt(burst)}`);

// Storm probe: fire the big-index list calls at once (what the hub does on first paint after a restart) and sample the
// tiny /api/me every 400ms for up to `--storm` seconds. p95/max of /api/me is the "small requests starved" number.
const stormIdx = process.argv.indexOf("--storm");
if (stormIdx > 0) {
  const secs = Number(process.argv[stormIdx + 1]) || 60;
  const heavy = ["/api/learning-hub/notes?limit=20", "/api/learning-hub/flashcards?limit=20", "/api/learning-hub/assessments", "/api/learning-hub/notes/counts", "/api/learning-hub/students", "/api/learning-hub/topics"];
  const heavyDone = Promise.all(heavy.map(time));
  const samples = [];
  const end = Date.now() + secs * 1000;
  let done = false; heavyDone.then(() => { done = true; });
  while (Date.now() < end && !(done && samples.length >= 20)) { samples.push((await time("/api/me")).ms); await new Promise((r) => setTimeout(r, 400)); }
  const sorted = [...samples].sort((a, b) => a - b);
  const q = (x) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * x))];
  out.storm = { heavy: await heavyDone, meSamples: samples.length, meP50: q(0.5), meP95: q(0.95), meMax: sorted[sorted.length - 1] };
  console.log(`storm : /api/me over ${samples.length} samples p50=${out.storm.meP50}ms p95=${out.storm.meP95}ms max=${out.storm.meMax}ms | heavy: ${fmt(out.storm.heavy)}`);
}
fs.mkdirSync(path.join(root, "scratch"), { recursive: true });
fs.appendFileSync(path.join(root, "scratch/hub-measure.jsonl"), JSON.stringify(out) + "\n");
