// Restart-scenario benchmark for the hub caches (read-only: it only READS Firestore, exactly what an API restart does).
//   cd server && npx tsx src/hubCacheBench.ts [seconds=90] [tenantId,...]
// Boots the hub index loaders in a FRESH process (empty memory, disk snapshots as left by the last API run), asks for
// every big index like the first paint after a restart would, and for `seconds` measures what a tiny request would
// feel: event-loop lag (20ms ticker) and the latency of a 1-document Firestore read (what /api/me does), while any
// background rebuilds run. Prints p50/p95/max and how many `[hub-cache] … loaded in` rebuilds happened.
import { performance } from "node:perf_hooks";
import { db } from "./firebase";
import { assessmentRows, cardIndex, noteIndex, questionIndex, tenantTopics } from "./lib/hubIndex";

const secs = Number(process.argv[2]) || 90;
const tenants = (process.argv[3] || "jYp5XNZGT7bgSUMuEgHN,0h0Ud6sBvvKJgfVD5Lim").split(",");

const lag: number[] = [];
let last = performance.now();
const tick = setInterval(() => { const n = performance.now(); lag.push(Math.max(0, n - last - 20)); last = n; }, 20);

const tiny: number[] = [];
let stop = false;
const sampler = (async () => {
  while (!stop) {
    const t = performance.now();
    try { await db.collection("users").doc("bench-nonexistent").get(); } catch { /* ignore */ }
    tiny.push(performance.now() - t);
    await new Promise((r) => setTimeout(r, 300));
  }
})();

let rebuilds = 0;
const origLog = console.log;
console.log = (...a: unknown[]) => { const s = String(a[0] ?? ""); if (s.includes("[hub-cache]") && s.includes("loaded in")) rebuilds++; origLog(...a); };

const t0 = performance.now();
const first: Record<string, number> = {};
await Promise.all(tenants.flatMap((t) => [
  ["questions", questionIndex], ["notes", noteIndex], ["assessments", assessmentRows], ["cards", cardIndex], ["topics", tenantTopics],
].map(async ([name, fn]) => { const s = performance.now(); await (fn as (t: string) => Promise<unknown>)(t); first[`${name}|${t.slice(0, 4)}`] = Math.round(performance.now() - s); })));
const firstMs = Math.round(performance.now() - t0);
await new Promise((r) => setTimeout(r, Math.max(0, secs * 1000 - (performance.now() - t0))));
stop = true; clearInterval(tick); await sampler;

const q = (a: number[], p: number) => { const s = [...a].sort((x, y) => x - y); return Math.round(s[Math.min(s.length - 1, Math.floor(s.length * p))] ?? 0); };
console.log = origLog;
console.log(JSON.stringify({
  tenants, seconds: secs, firstIndexesReadyMs: firstMs, perKindFirstMs: first,
  backgroundRebuildsLogged: rebuilds,
  tinyReadMs: { n: tiny.length, p50: q(tiny, 0.5), p95: q(tiny, 0.95), max: q(tiny, 1) },
  eventLoopLagMs: { p95: q(lag, 0.95), max: q(lag, 1), over100ms: lag.filter((x) => x > 100).length },
}, null, 1));
process.exit(0);
