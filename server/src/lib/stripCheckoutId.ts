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

/** Mounted ONCE, early, for the whole API: the decision is taken when the response is sent, by then the caller's role is known. Only providers' own
 *  accounts (company, freelancer, franchise, staff, platform) receive a checkoutId; a parent, or anybody not signed in, never does - whatever route
 *  they hit (privacy export, wallet, invoices, calendar feeds, public pages...). */
export const stripCheckoutIdForFamilies: RequestHandler = (req, res, next) => {
  const json = res.json.bind(res);
  res.json = ((body: unknown) => {
    const role = (req as { auth?: { role?: string } }).auth?.role;
    return json(role && role !== "parent" ? body : withoutCheckoutId(body));
  }) as typeof res.json;
  next();
};
