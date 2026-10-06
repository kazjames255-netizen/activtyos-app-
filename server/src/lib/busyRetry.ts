// When Firestore is busy (many writers on the same documents) a transaction can fail with ABORTED / "Too much contention" /
// DEADLINE_EXCEEDED. The SDK already retries a few times quietly; this adds a short jittered backoff on top, and gives the route
// error handler a way to say "we're busy, try again" (HTTP 503) instead of a raw "Internal server error".

export const BUSY_MESSAGE = "We're busy right now, please try again in a moment.";

/** True for the transient "database is busy" family of errors. */
export function isBusyError(err: unknown): boolean {
  const e = err as { code?: number | string; message?: string } | null | undefined;
  if (!e) return false;
  const code = typeof e.code === "number" ? e.code : Number.NaN;
  // gRPC: 4 DEADLINE_EXCEEDED, 10 ABORTED, 14 UNAVAILABLE
  if (code === 4 || code === 10 || code === 14) return true;
  const msg = String(e.message ?? "");
  return /too much contention|\bABORTED\b|DEADLINE_EXCEEDED|transaction was aborted|\bUNAVAILABLE\b/i.test(msg);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Run `fn`; if it fails with a busy error, wait 150-600ms (jittered, growing) and try again, up to `tries` attempts in total. */
export async function withBusyRetry<T>(fn: () => Promise<T>, tries = 3, base = 150): Promise<T> {
  let last: unknown;
  for (let i = 0; i < tries; i++) {
    try {
      return await fn();
    } catch (err) {
      last = err;
      if (!isBusyError(err) || i === tries - 1) throw err;
      const wait = Math.min(600, base * 2 ** i) * (0.6 + Math.random() * 0.8);
      await sleep(wait);
    }
  }
  throw last;
}
