import type { RequestHandler } from "express";

/** A checkout id is internal plumbing (it ties the references of one checkout together for the provider's screens). Families must never read it. */
export function withoutCheckoutId<T>(v: T): T {
  if (Array.isArray(v)) return v.map(withoutCheckoutId) as unknown as T;
  if (v && typeof v === "object" && !(v instanceof Date)) {
    const out: Record<string, unknown> = {};
    for (const [k, x] of Object.entries(v as Record<string, unknown>)) if (k !== "checkoutId") out[k] = withoutCheckoutId(x);
    return out as T;
  }
  return v;
}

/** Mount in front of every family-facing router: whatever it sends back has no checkoutId in it, at any depth. */
export const stripCheckoutId: RequestHandler = (_req, res, next) => {
  const json = res.json.bind(res);
  res.json = ((body: unknown) => json(withoutCheckoutId(body))) as typeof res.json;
  next();
};
