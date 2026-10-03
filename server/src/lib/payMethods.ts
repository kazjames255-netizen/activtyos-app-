// Pure payment-method rules for POST /api/my/bookings (no Firestore, no
// express — unit-tested in tests/pay-methods.test.mts).
//
// The checkout offers the rails a provider enabled in Setup (payMethods, a list
// of human labels) narrowed by the listing's own payMethods. The browser
// filters, but the server is the authority: a stale or hand-built request must
// not be able to book "Cash on the day" with a Card-only provider.

export const TFC_METHOD = "Tax-Free Childcare";
export const TFC_SCHEME = "HMRC Tax-Free Childcare";

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Is this method string (or scheme name) the HMRC Tax-Free Childcare rail? */
export const isTfcMethod = (m: unknown) => /tax.?free|\btfc\b/i.test(String(m ?? ""));

/**
 * A rail's canonical key, from either the checkout's method ("card", "tfc",
 * "Childcare voucher — Edenred") or a Setup label ("Cash on the day",
 * "Childcare vouchers", "Tax-Free Childcare"). Unknown labels slug to
 * themselves, mirroring parentMethodEntry() in features/listings/checkout.tsx.
 */
export function methodKey(m: unknown): string {
  const s = String(m ?? "").trim().toLowerCase();
  if (/haf|funded|free place/.test(s)) return "haf";
  if (/voucher/.test(s)) return "voucher";
  if (isTfcMethod(s)) return "tfc";
  if (/card|stripe/.test(s)) return "card";
  if (/bank|transfer/.test(s)) return "bank";
  if (/cash/.test(s)) return "cash";
  return s.replace(/[^a-z0-9]+/g, "-");
}

/** The method we STORE on a booking: TFC is always the canonical label, so the
 *  operator UI, reconciliation and refund wording all recognise it. */
export const canonicalMethod = (m: string) => (isTfcMethod(m) && methodKey(m) === "tfc" ? TFC_METHOD : m);

/**
 * May a parent book with `method`? Mirrors the checkout's payList filter:
 *  - the tenant's Setup list (empty/absent = legacy, everything allowed);
 *  - then, if the listing carries its own payMethods, a non-card rail must be on it
 *    (card is governed by the tenant list alone, as in the checkout).
 * Funded (HAF) places are policed elsewhere and always pass here.
 */
export function methodAllowed(
  method: unknown,
  tenantMethods: unknown,
  listingMethods?: unknown,
): { ok: true } | { ok: false; reason: string } {
  const key = methodKey(method);
  if (key === "haf") return { ok: true };
  const keys = (v: unknown) => (Array.isArray(v) ? v.map(methodKey) : null);
  const tenant = keys(tenantMethods);
  if (tenant && tenant.length && !tenant.includes(key))
    return { ok: false, reason: "This provider doesn't accept that payment method." };
  const listing = keys(listingMethods);
  if (listing && key !== "card" && !listing.includes(key))
    return { ok: false, reason: "This activity doesn't accept that payment method." };
  return { ok: true };
}

/**
 * Share a Tax-Free Childcare amount across a basket's bookings, proportionally
 * (last booking takes the rounding), so EVERY booking in a split basket is part
 * TFC and part remainder. Returns each booking's TFC portion. A request of 0, or
 * of the whole total or more, is not a split: all zeros (the caller then treats
 * the booking as wholly TFC). Money stays server-side.
 */
export function splitTfc(amounts: number[], tfcTotal: number): number[] {
  const grand = round2(amounts.reduce((s, a) => s + Math.max(0, a), 0));
  const want = round2(Math.max(0, Number.isFinite(tfcTotal) ? tfcTotal : 0));
  if (want <= 0 || want >= grand || amounts.length === 0) return amounts.map(() => 0);
  let left = want;
  return amounts.map((a, i) => {
    const part = i === amounts.length - 1 ? left : round2((Math.max(0, a) * want) / grand);
    const p = Math.min(round2(part), round2(a), left);
    left = round2(left - p);
    return p;
  });
}
