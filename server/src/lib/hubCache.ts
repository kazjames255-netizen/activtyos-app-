// Learning Hub — a tiny per-process, per-tenant TTL cache for the reads every hub request repeats (the topic
// tree, the question/assessment/notes indexes, the roster, "which topics have content"…). A provider's hub is
// ~700 topics, ~5,000 questions, ~500 assessments and ~450 notes, so re-reading them on every page load was the
// dominant cost of the hub (each read is one Firestore document billed + a network round trip).
//
// Rules of the road:
//  · Keys are `${kind}|${tenantId}|…`. A write route calls `forgetHub(tenantId, "kind", …)` so the writer (and
//    everyone after them) sees the change at once; the TTL is only the backstop for writes that bypass the API
//    (seed scripts, another server instance).
//  · Cached values are SHARED between requests: treat them as read-only (copy before you sort or mutate).
//  · Concurrent misses share ONE load (single-flight), so a burst of first-paint requests reads once.
//  · Access control is never cached here: callers filter a cached tenant-wide list through hubCore's
//    canSee/subjectAllowed on every request. Only raw, tenant-scoped data lives in the cache.
//
// Disk snapshot (`opts.disk`): the big per-tenant indexes (notes/questions/assessments/cards — see hubIndex.ts)
// cost a multi-second-to-multi-minute Firestore scan to rebuild (a real tenant can hold 15k+ notes). Without a
// snapshot, the FIRST request after every dev restart (or deploy) pays that full cost before it can answer at
// all — the "landing page is really slow" complaint was this, not a per-request cost. Every successful build of
// a `disk`-flagged kind is written to a tmp-dir JSON file (write-then-rename, like routes/leads.ts); on a cold
// miss for such a kind, that snapshot (however old) is loaded synchronously and served immediately, while a
// real rebuild runs in the background exactly like an ordinary stale-while-revalidate refresh — so a restart is
// never worse than "serves yesterday's counts for a few seconds," not "blocks the tab for a minute."

import { createHash, randomBytes } from "node:crypto";
import { lstatSync, mkdirSync, renameSync, unlinkSync } from "node:fs";
import { open, readdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { overReadBudget, withReadLabel } from "./readMeter";

interface Entry { at: number; v: unknown; seeded?: boolean }
// A snapshot read back from disk is served as-is only while it is younger than this (default 30 min, HUB_SNAPSHOT_TRUST_MIN): a restart minutes after
// the last build re-reads nothing, but writes made behind the API's back (Admin-SDK scripts, another instance) while it was down become visible within
// this window instead of waiting out the (long) TTL. Older snapshots are served immediately and revalidated in the background once (stale-while-revalidate).
const SEED_TRUST_MS = Number(process.env.HUB_SNAPSHOT_TRUST_MIN || 30) * 60_000;
const store = new Map<string, Entry>();
const inflight = new Map<string, Promise<unknown>>();
const MAX_ENTRIES = 600;

// Map values (all the disk-eligible kinds are `Map<id, row>`) don't survive JSON.stringify as-is; tag them so
// the reader knows to rebuild a Map instead of handing back a plain array.
// Snapshot integrity: EVERY kind is versioned (bump SNAPSHOT_VERSION whenever any cached row shape changes, e.g. the notes index
// gained `oakKey`) and every file embeds {kind, tenantId, version} that is verified on load, so an old-shape or foreign file is ignored.
const SNAPSHOT_VERSION = "v3";
// Snapshots hold a tenant's notes / questions / cards, so they live in a PRIVATE directory (0700, owned by this user, never a
// symlink) and are written 0600 through an exclusive random temp name — no other local user can read, pre-create or redirect them.
let snapDir: string | null | undefined;
function privateDir(): string | null {
  if (snapDir !== undefined) return snapDir;
  try {
    const d = join(tmpdir(), `aos-hub-cache-${process.getuid?.() ?? "u"}`);
    mkdirSync(d, { recursive: true, mode: 0o700 });
    const st = lstatSync(d);
    snapDir = st.isDirectory() && !st.isSymbolicLink() && (process.getuid === undefined || st.uid === process.getuid()) && (st.mode & 0o077) === 0 ? d : null;
  } catch { snapDir = null; }
  return snapDir;
}
const diskPath = (kind: HubKind, tenantId: string): string | null => {
  const d = privateDir();
  return d ? join(d, `${kind}.${createHash("sha256").update(`${kind}|${tenantId}`).digest("hex").slice(0, 32)}.json`) : null;
};
// Fire-and-forget from the caller (never awaited): a snapshot write is best-effort bookkeeping, not something a
// request should wait on. The big kinds serialize to tens of MB (the shared-library questions snapshot alone is
// ~47MB) — the async `fs/promises` write (still write-then-rename for atomicity) keeps a rebuild's disk write from
// stalling every other in-flight request on the process.
async function diskWrite(kind: HubKind, tenantId: string, v: unknown): Promise<void> {
  try {
    const p = diskPath(kind, tenantId);
    if (!p) return;
    const payload = JSON.stringify({ version: SNAPSHOT_VERSION, kind, tenantId, ...(v instanceof Map ? { __map: true, entries: [...v.entries()] } : { __map: false, v }) });
    const tmp = `${p}.${randomBytes(8).toString("hex")}.tmp`;
    await writeFile(tmp, payload, { mode: 0o600, flag: "wx" });
    renameSync(tmp, p);
  } catch { /* best effort — a rebuild still happens on the next restart */ }
}
// Async on purpose: a per-request cold-miss (the store has nothing yet — right after a restart, before
// warmHubCacheFromDisk finishes, or after an entry was evicted) used to call this with a blocking readFileSync,
// and the biggest snapshot (questions, ~45MB) measured 143ms of readFileSync+JSON.parse — 59ms of that was disk
// I/O alone, stalling every other in-flight request on this single-threaded process for no reason (JSON.parse
// itself can't be made non-blocking without extra deps, but the read can). Moving the read to fs/promises keeps
// that 59ms off the event loop; only the unavoidable JSON.parse still blocks.
async function diskRead<T>(kind: HubKind, tenantId: string): Promise<{ v: T; mtimeMs: number } | null> {
  try {
    const p = diskPath(kind, tenantId);
    if (!p) return null;
    const st = lstatSync(p);
    if (!st.isFile() || (process.getuid !== undefined && st.uid !== process.getuid()) || (st.mode & 0o077) !== 0) return null;
    const parsed = JSON.parse(await readFile(p, "utf8")) as { version?: string; kind?: string; tenantId?: string; __map: boolean; entries?: [string, unknown][]; v?: unknown };
    if (parsed.version !== SNAPSHOT_VERSION || parsed.kind !== kind || parsed.tenantId !== tenantId) return null;
    return { v: (parsed.__map ? new Map(parsed.entries) : parsed.v) as T, mtimeMs: st.mtimeMs };
  } catch { return null; }
}

// ── Big-index rebuild limiter ────────────────────────────────────────────────────────────────────────────────────
// Every disk-flagged rebuild is a sharded scan (hubIndex.shardedTenantRead opens 8 parallel Firestore streams). After an API
// restart every kind of every active tenant used to rebuild AT ONCE (2 tenants x 5 kinds + the shared library = 50-100 streams
// on one gRPC channel), and a 1-document read (/api/me's auth lookup) queued behind them for 10-25 s — measured, see
// docs/hub-slow-loads.md. Now at most BIG_LOADS run at a time (FIFO) and each yields to the event loop before it starts, so
// small requests keep a free stream. A caller waiting on a queued load just waits a little longer; nobody starves.
const BIG_LOADS = Number(process.env.HUB_CACHE_BIG_LOADS) || 2;
// A request that has NOTHING to serve (cold miss, no snapshot) is "blocking" and jumps the queue; a background refresh of a copy
// we are already serving (SWR) is "background" and may only ever hold ONE of the slots, so it can never crowd out a blocking load.
let bigRunning = 0, bgRunning = 0;
const blockingQueue: (() => void)[] = [];
const bgQueue: (() => void)[] = [];
const canRun = (background: boolean) => bigRunning < BIG_LOADS && (!background || bgRunning < 1);
// A slot is RESERVED at the moment it is granted (counters bumped here, not when the waiter resumes a microtask later) — otherwise one
// pump() would wake every waiter at once and the cap would not hold.
function pump() {
  while (blockingQueue.length && canRun(false)) { bigRunning++; blockingQueue.shift()!(); }
  while (bgQueue.length && canRun(true)) { bigRunning++; bgRunning++; bgQueue.shift()!(); }
}
// `probeEmpty` (opt-in, see hubIndex.ts's shardedTenantRead): a cheap `limit(1)` check a caller can supply to find out,
// BEFORE joining the FIFO queue, that there is nothing to read at all (a tenant with zero rows of this kind). Without
// this, an empty tenant's near-instant probe queued behind other tenants' full multi-megabyte rebuilds under the
// BIG_LOADS cap exactly like a real rebuild would — e.g. a 0-row `cards` load measured 137.7s stuck FIFO behind a
// 167.3s shared-library rebuild (docs/hub-slow-loads.md). The probe itself is real Firestore work either way (not
// skipped, not cached more aggressively) — it just no longer has to wait its turn behind unrelated big loads.
async function withBigSlot<T>(fn: () => Promise<T>, background: boolean, probeEmpty?: () => Promise<boolean>): Promise<T> {
  if (probeEmpty) {
    try { if (await probeEmpty()) return await fn(); } catch { /* probe failed — fall through to the normal gated path */ }
  }
  if (canRun(background) && !(background ? bgQueue.length : blockingQueue.length)) { bigRunning++; if (background) bgRunning++; }
  else await new Promise<void>((r) => (background ? bgQueue : blockingQueue).push(r)); // pump() reserves the slot before calling r
  try { await new Promise((r) => setImmediate(r)); return await fn(); }
  finally { bigRunning--; if (background) bgRunning--; pump(); }
}
/** Test/ops hook: loads running / waiting for a slot. */
export const hubCacheLoads = () => ({ running: bigRunning, background: bgRunning, queuedBlocking: blockingQueue.length, queuedBackground: bgQueue.length });

// Snapshot writes: one at a time, deferred a moment (JSON.stringify of a 40 MB index blocks the event loop for ~1 s — never
// stack several, and never right in the middle of a burst of requests), and skipped when a snapshot <5 min old exists.
let diskChain: Promise<unknown> = Promise.resolve();
const SNAP_MIN_GAP_MS = 5 * 60_000;
function scheduleDiskWrite(kind: HubKind, tenantId: string, v: unknown) {
  diskChain = diskChain.then(async () => {
    try {
      const p = diskPath(kind, tenantId);
      if (!p) return;
      try { if (Date.now() - lstatSync(p).mtimeMs < SNAP_MIN_GAP_MS) return; } catch { /* no snapshot yet */ }
      await new Promise((r) => setTimeout(r, 1_500));
      await diskWrite(kind, tenantId, v);
    } catch { /* best effort */ }
  });
}

/** Startup warm-up (no Firestore reads): load every valid disk snapshot into memory, one file at a time with a yield between
 *  files, so the first request after a restart neither pays the synchronous 40 MB JSON.parse nor triggers a rebuild of a
 *  snapshot that is still inside its TTL. Call once after the server is listening. Returns how many snapshots were loaded. */
export async function warmHubCacheFromDisk(): Promise<number> {
  const d = privateDir();
  if (!d) return 0;
  let loaded = 0;
  let names: string[] = [];
  try { names = (await readdir(d)).filter((n) => n.endsWith(".json") && !n.endsWith(".tmp")); } catch { return 0; }
  for (const name of names) {
    try {
      const full = join(d, name);
      const st = lstatSync(full);
      if (!st.isFile() || (process.getuid !== undefined && st.uid !== process.getuid()) || (st.mode & 0o077) !== 0) continue;
      // The header is `{"version":"v3","kind":"…","tenantId":"…",…` — read just enough to know what it is before parsing it all.
      const fh = await open(full, "r");
      const head = Buffer.alloc(512);
      const { bytesRead } = await fh.read(head, 0, 512, 0);
      await fh.close();
      const m = head.toString("utf8", 0, bytesRead).match(/^\{"version":"([^"]+)","kind":"([a-zA-Z]+)","tenantId":"([^"]+)"/);
      if (!m || m[1] !== SNAPSHOT_VERSION) continue;
      const kind = m[2] as HubKind, tenantId = m[3]!;
      if (diskPath(kind, tenantId) !== full) continue; // not the file this (kind, tenant) maps to — ignore
      if (store.has(keyOf(kind, tenantId))) continue;
      const parsed = JSON.parse(await readFile(full, "utf8")) as { version?: string; kind?: string; tenantId?: string; __map: boolean; entries?: [string, unknown][]; v?: unknown };
      if (parsed.version !== SNAPSHOT_VERSION || parsed.kind !== kind || parsed.tenantId !== tenantId) continue;
      if (store.has(keyOf(kind, tenantId))) continue; // a request got there first
      store.set(keyOf(kind, tenantId), { at: st.mtimeMs, v: parsed.__map ? new Map(parsed.entries) : parsed.v, seeded: true });
      loaded++;
    } catch { /* unreadable / foreign file: ignore */ }
    await new Promise((r) => setImmediate(r));
  }
  return loaded;
}

export type HubKind =
  | "topics" | "notes" | "questions" | "assessments" | "roster" | "mastery" | "cards" | "reviews" | "assignedNotes";

const keyOf = (kind: HubKind, tenantId: string, extra = "") => `${kind}|${tenantId}|${extra}`;

/** The cached value for (kind, tenant, extra), loading it (once, shared) when missing or older than `ttlMs`. */
export async function hubCached<T>(kind: HubKind, tenantId: string, extra: string, ttlMs: number, load: () => Promise<T>, opts: { swr?: boolean; disk?: boolean; probeEmpty?: () => Promise<boolean> } = {}): Promise<T> {
  const key = keyOf(kind, tenantId, extra);
  let hit = store.get(key);
  // Nothing in memory (a fresh process): a disk-flagged kind may have yesterday's build sitting in the tmp dir.
  // Seed the memory entry from it, timestamped with the SNAPSHOT'S OWN AGE (not 0): a snapshot younger than the TTL is served
  // as-is with no rebuild (a restart minutes after the last build used to re-scan everything); an older one falls into the
  // normal SWR path — serve this now, rebuild in the background (through the limiter below).
  if (!hit && opts.disk && !extra) {
    const disk = await diskRead<T>(kind, tenantId);
    if (disk !== null) { hit = { at: disk.mtimeMs, v: disk.v, seeded: true }; store.set(key, hit); }
  }
  if (hit && Date.now() - hit.at < (hit.seeded ? Math.min(ttlMs, SEED_TRUST_MS) : ttlMs)) return hit.v as T;
  // A stale copy we can serve, and a budget already spent: keep serving it rather than re-read the whole index (lib/readMeter.ts).
  if (hit && opts.swr && !inflight.get(key) && overReadBudget(`hub-cache:${kind}|${tenantId}`)) return hit.v as T;
  const running = inflight.get(key);

  const start = (): Promise<T> => {
    const background = !!(hit && opts.swr); // we already have a copy to serve while this runs
    // A write that lands while this load is in flight must not be papered over by the (older) result:
    // remember the generation and refuse to store if the kind was forgotten meanwhile.
    const gen = generation(kind, tenantId);
    // In-place patches (patchHub) that land while this load runs are REPLAYED onto its result instead of discarding it:
    // a 40-90s index rebuild used to be thrown away by any single note edit made meanwhile, so under steady write
    // traffic the big indexes could never finish caching (and their disk snapshot was never written) — every request
    // then paid a fresh full rebuild. Only an explicit forgetHub (a structural change) still invalidates a load.
    const patches: ((v: unknown) => void)[] = [];
    const fk = `${kind}|${tenantId}`;
    (flightPatches.get(fk) ?? flightPatches.set(fk, []).get(fk)!).push(patches);
    let self: Promise<T> | null = null;
    const p: Promise<T> = (async () => {
      try {
        await Promise.resolve(); // let `self` be assigned before anything below can run its `finally`
        const t0 = Date.now();
        const v = await withReadLabel(`cache:${kind}|${tenantId}${extra ? `|${extra}` : ""}`, () => (opts.disk ? withBigSlot(load, background, opts.probeEmpty) : load()));
        const took = Date.now() - t0;
        if (took > 1_000) { // a slow index build is the main cold-start cost of the hub: say so (with its size) in the API log
          const n = v instanceof Map ? v.size : Array.isArray(v) ? v.length : null;
          console.log(`[hub-cache] ${kind}|${tenantId}${extra ? `|${extra}` : ""} loaded in ${(took / 1000).toFixed(1)}s${n === null ? "" : ` (${n} rows)`}`);
        }
        if (generation(kind, tenantId) === gen) {
          for (const f of patches) f(v);
          if (store.size >= MAX_ENTRIES) { const oldest = [...store.entries()].sort((a, b) => a[1].at - b[1].at).slice(0, 100); for (const [k] of oldest) store.delete(k); }
          store.set(key, { at: Date.now(), v });
          if (opts.disk && !extra) scheduleDiskWrite(kind, tenantId, v);
        }
        return v;
      } finally {
        if (inflight.get(key) === self) inflight.delete(key);
        const l = flightPatches.get(fk); if (l) { const i = l.indexOf(patches); if (i >= 0) l.splice(i, 1); if (!l.length) flightPatches.delete(fk); }
      }
    })();
    self = p;
    inflight.set(key, p);
    return p;
  };

  // Stale-while-revalidate (the big indexes, which API writes patch in place anyway): once the TTL passes, keep serving the
  // copy we have and refresh it in the background — a request never waits for a 5,000-document re-read after the first one.
  if (hit && opts.swr) { if (!running) start().catch(() => undefined); return hit.v as T; }
  return running ? (running as Promise<T>) : start();
}

const gens = new Map<string, number>();
/** `${kind}|${tenantId}` → the patch lists of the loads currently in flight for it (see start() in hubCached). */
const flightPatches = new Map<string, ((v: unknown) => void)[][]>();
const generation = (kind: HubKind, tenantId: string) => gens.get(`${kind}|${tenantId}`) ?? 0;

/** Drop a tenant's cached data of the given kinds (all kinds when none named). Call it from every write route. */
export function forgetHub(tenantId: string, ...kinds: HubKind[]) {
  const which = kinds.length ? kinds : (["topics", "notes", "questions", "assessments", "roster", "mastery", "cards", "reviews"] as HubKind[]);
  for (const kind of which) {
    gens.set(`${kind}|${tenantId}`, generation(kind, tenantId) + 1);
    const prefix = `${kind}|${tenantId}|`;
    for (const k of store.keys()) if (k.startsWith(prefix)) store.delete(k);
    for (const k of inflight.keys()) if (k.startsWith(prefix)) inflight.delete(k);
    // An explicit forget means "the memory copy is now known wrong" — the disk snapshot (if this kind has one) was
    // built from the same stale state, so it must not be resurrected by the next cold-miss disk read either. Rare
    // (structural edits: topic rename/delete, roster changes), so paying one real rebuild here is the same cost
    // this call always had — this just stops it from being skipped by the disk shortcut.
    try { const dp = diskPath(kind, tenantId); if (dp) unlinkSync(dp); } catch { /* no snapshot for this kind, or already gone */ }
  }
}

/** Mutate a tenant's cached value of `kind` IN PLACE (a write route keeping the cache exact instead of dropping it and
 *  paying a whole-collection re-read). A load in flight when this runs is invalidated (its snapshot may predate the
 *  write), so the next read reloads instead of resurrecting stale data. No cached copy = nothing to do. */
export function patchHub<T>(kind: HubKind, tenantId: string, fn: (value: T) => void) {
  const prefix = `${kind}|${tenantId}|`;
  for (const [k, e] of store) if (k.startsWith(prefix)) fn(e.v as T);
  // A load in flight keeps running; this patch is replayed onto its result when it lands (its snapshot may predate the write).
  for (const list of flightPatches.get(`${kind}|${tenantId}`) ?? []) list.push(fn as (v: unknown) => void);
}

/** Test/ops hook. */
export const hubCacheSize = () => store.size;
