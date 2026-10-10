// Learning Hub — abuse limits for the child-facing write routes (owner-accepted defaults, 10 Oct 2026). Pure: no Firestore.
//  • a quiz start creates an attempt document: 30 per hour per child;
//  • a draft save rewrites the attempt document: 300 per hour per attempt, and the draft itself is capped (a 300-question paper of long
//    answers does not need more; the old cap was 200 KB per call).
// Per process, like lib/rateLimit.ts (swap for a shared counter when the API runs on several instances).

export const START_PER_HOUR = 30;
export const DRAFT_SAVES_PER_HOUR = 300;
export const HOUR_MS = 3_600_000;
export const DRAFT_MAX_BYTES = 60_000;

type Bucket = { n: number; resetAt: number };
const buckets = new Map<string, Bucket>();
const MAX_BUCKETS = 50_000;

/** Count one hit against `key`. `ok:false` = over the limit (retry after `retryAfterSec`). `now` is injectable for tests. */
export function takeToken(key: string, max: number, windowMs: number, now = Date.now()): { ok: boolean; retryAfterSec: number } {
  let b = buckets.get(key);
  if (!b || b.resetAt <= now) {
    if (buckets.size >= MAX_BUCKETS) buckets.clear();
    b = { n: 0, resetAt: now + windowMs };
    buckets.set(key, b);
  }
  b.n += 1;
  return b.n > max ? { ok: false, retryAfterSec: Math.max(1, Math.ceil((b.resetAt - now) / 1000)) } : { ok: true, retryAfterSec: 0 };
}

setInterval(() => {
  const now = Date.now();
  for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k);
}, 5 * 60_000).unref();
