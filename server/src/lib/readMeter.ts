// Firestore READ METER — counts every document the Admin SDK reads, attributed to a label, so a cost leak has a name.
//
// Why: Firestore bills per document read (and per GB sent out). Sept 2026 cost £60 in reads (137M docs) with no way to see WHO read them.
// How: firebase.ts imports this file, which patches the Admin SDK's read entry points once (Query.get/stream/onSnapshot,
// DocumentReference.get/onSnapshot, Transaction.get, Firestore.getAll). Count-aggregations are excluded (billed per 1000 index entries).
// Attribution: an AsyncLocalStorage label set by (a) the HTTP middleware (`http:GET /api/hub/notes`), (b) the scheduler
// (`sweep:task-reminders`), (c) the hub cache (`cache:questions|tenant`) or (d) `withReadLabel()` anywhere else. A read with no label
// is attributed to the first server/src stack frame that caused it (`unattributed:lib/leads.ts:88`).
//
// Output: GET /internal/read-stats (defined in index.ts: READ_STATS_KEY header, or loopback-only in dev), a top-10 line in scratch/read-meter.log every 10 minutes and on
// shutdown, and `readStats()` for tests. Off with READ_METER=0; on by default. Overhead: one Map increment per read call.
import { AsyncLocalStorage } from "node:async_hooks";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DocumentReference, Firestore, Query, Transaction } from "firebase-admin/firestore";

type Counter = { reads: number; calls: number };
const store = new AsyncLocalStorage<{ label: string }>();
const counters = new Map<string, Counter>();
const hourly: { t: number; reads: number }[] = []; // (minute bucket, reads) for reads/hour
const startedAt = Date.now();
let total = 0;

const ENABLED = process.env.READ_METER !== "0";

/** Run `fn` with every Firestore read inside it (including async continuations) attributed to `label`. */
export function withReadLabel<T>(label: string, fn: () => T): T {
  return store.run({ label }, fn);
}
/** The current attribution label, or undefined. */
export const currentReadLabel = (): string | undefined => store.getStore()?.label;

function stackLabel(): string {
  const lines = (new Error().stack ?? "").split("\n").slice(2);
  for (const l of lines) {
    const m = l.match(/server\/src\/(.+?):(\d+):\d+/);
    if (m && !m[1].includes("readMeter")) return `unattributed:${m[1]}:${m[2]}`;
  }
  return "unattributed:unknown";
}

function record(n: number): void {
  if (n <= 0) n = 1; // an empty result still bills one read
  const label = store.getStore()?.label ?? stackLabel();
  const c = counters.get(label) ?? counters.set(label, { reads: 0, calls: 0 }).get(label)!;
  c.reads += n; c.calls += 1; total += n;
  const bucket = Math.floor(Date.now() / 60_000);
  const last = hourly[hourly.length - 1];
  if (last && last.t === bucket) last.reads += n; else { hourly.push({ t: bucket, reads: n }); if (hourly.length > 120) hourly.shift(); }
}

/** Reads seen in the last `minutes` minutes (default 60). Used by the hourly budget guard. */
export function readsInLast(minutes = 60): number {
  const from = Math.floor(Date.now() / 60_000) - minutes + 1;
  let s = 0; for (const b of hourly) if (b.t >= from) s += b.reads; return s;
}

export function readStats(top = 50): { since: string; uptimeMin: number; total: number; lastHour: number; perHourAvg: number; top: { label: string; reads: number; calls: number }[] } {
  const rows = [...counters.entries()].map(([label, c]) => ({ label, reads: c.reads, calls: c.calls })).sort((a, b) => b.reads - a.reads).slice(0, top);
  const hrs = Math.max((Date.now() - startedAt) / 3_600_000, 1 / 60);
  return { since: new Date(startedAt).toISOString(), uptimeMin: Math.round((Date.now() - startedAt) / 60_000), total, lastHour: readsInLast(60), perHourAvg: Math.round(total / hrs), top: rows };
}
export function resetReadStats(): void { counters.clear(); hourly.length = 0; total = 0; }

const here = path.dirname(fileURLToPath(import.meta.url));
const LOG = path.resolve(here, "../../../scratch/read-meter.log");
function logSummary(why: string): void {
  try {
    const s = readStats(10);
    if (s.total === 0 && why !== "OVER-BUDGET") return; // scripts that read nothing leave no line
    const line = `${new Date().toISOString()} [${why}] port=${process.env.PORT || 4000} up=${s.uptimeMin}m total=${s.total} last60m=${s.lastHour} avg/h=${s.perHourAvg} | ${s.top.map((r) => `${r.label}=${r.reads}`).join(" ; ")}\n`;
    fs.mkdirSync(path.dirname(LOG), { recursive: true });
    fs.appendFileSync(LOG, line);
  } catch { /* logging must never break the API */ }
}

// Snapshot-listener helper: count the initial documents, then each later change.
function wrapNext<S extends { size?: number; docChanges?: () => unknown[] }>(orig: (s: S) => void) {
  let first = true;
  return (snap: S) => {
    try { record(first ? (snap.size ?? 1) : (snap.docChanges?.().length ?? 1)); } catch { /* ignore */ }
    first = false;
    orig(snap);
  };
}

let installed = false;
function install(): void {
  if (installed || !ENABLED) return;
  installed = true;
  const QP = Query.prototype as unknown as Record<string, (...a: unknown[]) => unknown>;
  const DP = DocumentReference.prototype as unknown as Record<string, (...a: unknown[]) => unknown>;
  const TP = Transaction.prototype as unknown as Record<string, (...a: unknown[]) => unknown>;
  const FP = Firestore.prototype as unknown as Record<string, (...a: unknown[]) => unknown>;

  const qGet = QP.get;
  QP.get = function (this: unknown, ...a: unknown[]) {
    return (qGet.apply(this, a) as Promise<{ size: number }>).then((s) => { record(s.size); return s; });
  };
  const qStream = QP.stream;
  QP.stream = function (this: unknown, ...a: unknown[]) {
    const s = qStream.apply(this, a) as { push: (c: unknown, ...r: unknown[]) => boolean };
    const push = s.push.bind(s); // count documents as they are pushed — adding a 'data' listener would change the stream's flow mode
    s.push = (chunk: unknown, ...r: unknown[]) => { if (chunk != null) record(1); return push(chunk, ...r); };
    return s;
  };
  const qSnap = QP.onSnapshot;
  QP.onSnapshot = function (this: unknown, ...a: unknown[]) {
    if (typeof a[0] === "function") a[0] = wrapNext(a[0] as (s: never) => void);
    return qSnap.apply(this, a);
  };
  // DocumentReference.get() is implemented on top of Firestore.getAll(), which is counted below — counting it here too would double every single-document read.
  const dSnap = DP.onSnapshot;
  DP.onSnapshot = function (this: unknown, ...a: unknown[]) {
    if (typeof a[0] === "function") { const o = a[0] as (s: unknown) => void; a[0] = (s: unknown) => { record(1); o(s); }; }
    return dSnap.apply(this, a);
  };
  const tGet = TP.get;
  TP.get = function (this: unknown, ...a: unknown[]) {
    const target = a[0] as { constructor?: { name?: string } } | undefined;
    const p = tGet.apply(this, a) as Promise<{ size?: number }>;
    if (target?.constructor?.name === "AggregateQuery") return p; // counts are billed differently
    return p.then((s) => { record(typeof s?.size === "number" ? s.size : 1); return s; });
  };
  const fGetAll = FP.getAll;
  FP.getAll = function (this: unknown, ...a: unknown[]) {
    return (fGetAll.apply(this, a) as Promise<unknown[]>).then((r) => { record(r.length); return r; });
  };

  const every = Number(process.env.READ_METER_LOG_MIN || 10) * 60_000;
  const t = setInterval(() => logSummary("interval"), every); t.unref();
  // Log on the way out, then re-raise so any other shutdown handler (or the default) still runs.
  for (const sig of ["SIGINT", "SIGTERM"] as const) process.once(sig, () => { logSummary(sig); if (process.listenerCount(sig) === 0) process.kill(process.pid, sig); });
  process.once("beforeExit", () => logSummary("exit"));
}

install();

/** LOW_COST_DEV=1 (default whenever NODE_ENV is not "production"): no background scans that nobody asked for. */
export const LOW_COST = process.env.LOW_COST_DEV ? process.env.LOW_COST_DEV === "1" : process.env.NODE_ENV !== "production";

const BUDGET = Number(process.env.HUB_READ_BUDGET_PER_HOUR || 500_000);
let lastBudgetLog = 0;
/** True (and loud, at most once per 10 min) when this process has read more than HUB_READ_BUDGET_PER_HOUR documents in the last hour.
 *  Callers use it to SKIP non-essential refreshes (a stale cache is fine; a surprise bill is not). Reads a user is waiting for are never blocked. */
export function overReadBudget(what: string): boolean {
  if (!ENABLED) return false;
  const n = readsInLast(60);
  if (n <= BUDGET) return false;
  if (Date.now() - lastBudgetLog > 10 * 60_000) {
    lastBudgetLog = Date.now();
    const top = readStats(3).top.map((r) => `${r.label}=${r.reads}`).join(", ");
    console.warn(`[read-budget] ${n} Firestore reads in the last hour exceeds HUB_READ_BUDGET_PER_HOUR=${BUDGET}; pausing non-essential refresh (${what}). Top: ${top}`);
    logSummary("OVER-BUDGET");
  }
  return true;
}
