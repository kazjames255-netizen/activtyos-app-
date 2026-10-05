// A tiny in-memory TTL cache with in-flight de-duplication, for read-heavy
// endpoints whose result is the same for every caller of that route (HQ admin
// aggregates). Firestore bills per document read, so N page loads inside the TTL
// cost one read of the data, not N.
//
// SAFETY RULES for callers: only cache results that are NOT per-user / per-tenant
// unless the key includes tenant + role + scope. Failures are never cached.

export interface TtlCache<T> {
  /** Cached value for `key`, or compute it once (concurrent callers share the same promise). */
  wrap(key: string, load: () => Promise<T>): Promise<T>;
  /** Drop one key, or everything when no key is given. */
  clear(key?: string): void;
  size(): number;
}

export function ttlCache<T>(ttlMs: number, now: () => number = Date.now, maxKeys = 200): TtlCache<T> {
  const done = new Map<string, { at: number; value: T }>();
  const inflight = new Map<string, Promise<T>>();
  return {
    wrap(key, load) {
      const hit = done.get(key);
      if (hit && now() - hit.at < ttlMs) return Promise.resolve(hit.value);
      const running = inflight.get(key);
      if (running) return running;
      let p!: Promise<T>;
      p = (async () => {
        const startedAt = now();
        const value = await load();
        // A clear() that landed while we were loading wins: do not store a copy read before the write.
        if (inflight.get(key) === p) {
          if (done.size >= maxKeys) done.clear();
          done.set(key, { at: startedAt, value });
        }
        return value;
      })();
      inflight.set(key, p);
      const drop = () => { if (inflight.get(key) === p) inflight.delete(key); };
      p.then(drop, drop);
      return p;
    },
    clear(key) {
      if (key === undefined) { done.clear(); inflight.clear(); } else { done.delete(key); inflight.delete(key); }
    },
    size: () => done.size,
  };
}
