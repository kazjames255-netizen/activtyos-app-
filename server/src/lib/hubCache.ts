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

import { readFileSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

interface Entry { at: number; v: unknown }
const store = new Map<string, Entry>();
const inflight = new Map<string, Promise<unknown>>();
const MAX_ENTRIES = 600;

// Map values (all the disk-eligible kinds are `Map<id, row>`) don't survive JSON.stringify as-is; tag them so
// the reader knows to rebuild a Map instead of handing back a plain array.
const diskPath = (kind: HubKind, tenantId: string) => join(tmpdir(), `aos-hub-cache.${kind}.${tenantId}.json`);
function diskWrite(kind: HubKind, tenantId: string, v: unknown) {
  try {
    const payload = JSON.stringify(v instanceof Map ? { __map: true, entries: [...v.entries()] } : { __map: false, v });
    const p = diskPath(kind, tenantId);
    const tmp = `${p}.${process.pid}.tmp`;
    writeFileSync(tmp, payload);
    renameSync(tmp, p);
  } catch { /* best effort — a rebuild still happens on the next restart */ }
}
function diskRead<T>(kind: HubKind, tenantId: string): T | null {
  try {
    const parsed = JSON.parse(readFileSync(diskPath(kind, tenantId), "utf8")) as { __map: boolean; entries?: [string, unknown][]; v?: unknown };
    return (parsed.__map ? new Map(parsed.entries) : parsed.v) as T;
  } catch { return null; }
}

export type HubKind =
  | "topics" | "notes" | "questions" | "assessments" | "roster" | "mastery" | "cards" | "reviews";

const keyOf = (kind: HubKind, tenantId: string, extra = "") => `${kind}|${tenantId}|${extra}`;

/** The cached value for (kind, tenant, extra), loading it (once, shared) when missing or older than `ttlMs`. */
export async function hubCached<T>(kind: HubKind, tenantId: string, extra: string, ttlMs: number, load: () => Promise<T>, opts: { swr?: boolean; disk?: boolean } = {}): Promise<T> {
  const key = keyOf(kind, tenantId, extra);
  let hit = store.get(key);
  // Nothing in memory (a fresh process): a disk-flagged kind may have yesterday's build sitting in the tmp dir.
  // Seed the memory entry from it (timestamped 0, i.e. already "expired") so the code below falls straight into
  // the normal SWR path — serve this now, kick off a real rebuild in the background.
  if (!hit && opts.disk && !extra) {
    const disk = diskRead<T>(kind, tenantId);
    if (disk !== null) { hit = { at: 0, v: disk }; store.set(key, hit); }
  }
  if (hit && Date.now() - hit.at < ttlMs) return hit.v as T;
  const running = inflight.get(key);

  const start = (): Promise<T> => {
    // A write that lands while this load is in flight must not be papered over by the (older) result:
    // remember the generation and refuse to store if the kind was forgotten meanwhile.
    const gen = generation(kind, tenantId);
    let self: Promise<T> | null = null;
    const p: Promise<T> = (async () => {
      try {
        await Promise.resolve(); // let `self` be assigned before anything below can run its `finally`
        const t0 = Date.now();
        const v = await load();
        const took = Date.now() - t0;
        if (took > 1_000) { // a slow index build is the main cold-start cost of the hub: say so (with its size) in the API log
          const n = v instanceof Map ? v.size : Array.isArray(v) ? v.length : null;
          console.log(`[hub-cache] ${kind}|${tenantId}${extra ? `|${extra}` : ""} loaded in ${(took / 1000).toFixed(1)}s${n === null ? "" : ` (${n} rows)`}`);
        }
        if (generation(kind, tenantId) === gen) {
          if (store.size >= MAX_ENTRIES) { const oldest = [...store.entries()].sort((a, b) => a[1].at - b[1].at).slice(0, 100); for (const [k] of oldest) store.delete(k); }
          store.set(key, { at: Date.now(), v });
          if (opts.disk && !extra) diskWrite(kind, tenantId, v);
        }
        return v;
      } finally { if (inflight.get(key) === self) inflight.delete(key); }
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
    try { unlinkSync(diskPath(kind, tenantId)); } catch { /* no snapshot for this kind, or already gone */ }
  }
}

/** Mutate a tenant's cached value of `kind` IN PLACE (a write route keeping the cache exact instead of dropping it and
 *  paying a whole-collection re-read). A load in flight when this runs is invalidated (its snapshot may predate the
 *  write), so the next read reloads instead of resurrecting stale data. No cached copy = nothing to do. */
export function patchHub<T>(kind: HubKind, tenantId: string, fn: (value: T) => void) {
  const prefix = `${kind}|${tenantId}|`;
  for (const [k, e] of store) if (k.startsWith(prefix)) fn(e.v as T);
  gens.set(`${kind}|${tenantId}`, generation(kind, tenantId) + 1);
  for (const k of inflight.keys()) if (k.startsWith(prefix)) inflight.delete(k);
}

/** Test/ops hook. */
export const hubCacheSize = () => store.size;
