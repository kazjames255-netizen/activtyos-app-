import type { NextFunction, Request, Response } from "express";

// A small fixed-window rate limit for the PUBLIC endpoints (no account needed:
// the provider directory, demo-lead form, referee form, invite preview, pay
// page, unsubscribe). There was none anywhere — the directory could be walked
// in a few hundred requests and the lead form spammed without limit.
//
// In-memory and per process: enough to stop casual scraping and form abuse on
// one box. Behind several instances it's per instance — swap for a shared
// store (Redis / Firestore counter) when there's more than one.

type Bucket = { n: number; resetAt: number };
const buckets = new Map<string, Bucket>();

/** The caller's address, as Express resolves it. index.ts sets `trust proxy`
 *  (TRUST_PROXY, default 1 hop in production), so behind the host's proxy
 *  req.ip is the real client — never a raw X-Forwarded-For the caller wrote,
 *  which would let anyone reset their own limit on every request. */
function clientKey(req: Request): string {
  return req.ip || req.socket.remoteAddress || "unknown";
}
const MAX_BUCKETS = 50_000;

export function rateLimit(name: string, max: number, windowMs = 60_000) {
  return (req: Request, res: Response, next: NextFunction) => {
    const now = Date.now();
    const key = `${name}:${clientKey(req)}`;
    let b = buckets.get(key);
    if (!b || b.resetAt <= now) {
      // Bounded memory, whatever arrives.
      if (buckets.size >= MAX_BUCKETS) buckets.clear();
      b = { n: 0, resetAt: now + windowMs }; buckets.set(key, b);
    }
    b.n += 1;
    res.setHeader("RateLimit-Limit", String(max));
    res.setHeader("RateLimit-Remaining", String(Math.max(0, max - b.n)));
    if (b.n > max) {
      res.setHeader("Retry-After", String(Math.ceil((b.resetAt - now) / 1000)));
      res.status(429).json({ error: "Too many requests — please wait a moment and try again." });
      return;
    }
    next();
  };
}

// Drop expired buckets so the map can't grow without bound.
setInterval(() => {
  const now = Date.now();
  for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k);
}, 5 * 60_000).unref();
