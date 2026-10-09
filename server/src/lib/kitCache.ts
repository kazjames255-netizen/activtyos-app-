// A few seconds' memory for the cheap Add-on orders summaries (sidebar flag, dashboard card, days strip, month tally). They are read on every page load, so
// they are cached - but the per-day list is not, so right after a cancel the two disagreed. Any successful write request now empties this memory
// (kitCacheInvalidator, mounted in front of every route), and a calculation that was in flight while a write happened is never stored.
import type { NextFunction, Request, Response } from "express";

const memo = new Map<string, { at: number; v: unknown }>();
let epoch = 0;

export async function cached<T>(key: string, ttlMs: number, make: () => Promise<T>): Promise<T> {
  const hit = memo.get(key);
  if (hit && Date.now() - hit.at < ttlMs) return hit.v as T;
  const started = epoch;
  const v = await make();
  if (started === epoch) {
    memo.set(key, { at: Date.now(), v });
    if (memo.size > 500) for (const k of memo.keys()) { memo.delete(k); if (memo.size < 400) break; }
  }
  return v;
}

/** Forget everything (a booking, a block, a request or a refund changed). */
export function clearKitCache(): void { memo.clear(); epoch += 1; }

/** Express middleware: when a POST / PUT / PATCH / DELETE has finished successfully, the data may have changed - empty the cache. */
export function kitCacheInvalidator(req: Request, res: Response, next: NextFunction): void {
  if (req.method !== "GET" && req.method !== "HEAD" && req.method !== "OPTIONS") res.on("finish", () => { if (res.statusCode < 400) clearKitCache(); });
  next();
}
