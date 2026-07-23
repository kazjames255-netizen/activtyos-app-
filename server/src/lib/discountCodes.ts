// Discount codes (Marketing) — customer-entered coupons, distinct from the
// automatic per-listing discount RULES (features/listings/discounts.ts). This
// pure helper is the single source of truth for "is this code usable, and how
// much does it take off", shared by the validate endpoint and checkout so the
// preview a parent sees and the price they're charged can never disagree.

export interface DiscountCodeDoc {
  tenantId: string;
  code: string; // stored upper-cased
  type: "percent" | "amount" | "perAttendee"; // % of order · £ off order · £ off × attendees
  value: number; // percent (0–100) or pounds
  minSpend?: number;
  expiry?: string; // ISO date, inclusive last valid day
  usageLimit?: number; // total redemptions allowed
  usedCount?: number;
  active?: boolean;
  assignedTo?: string; // email — if set, ONLY this family can redeem it
  assignedEmails?: string[]; // reserved for a GROUP of families (e.g. "NHS parents")
  assignedGroupId?: string; // the group it was reserved for (for editing/display)
  assignedGroupName?: string;
  listingId?: string; // if set, ONLY bookings for this listing qualify
  perCustomerLimit?: boolean; // one redemption per customer (enforced in the route)
  exclusive?: boolean; // can't be combined with any other code (codes stack by default)
  // Refer-a-friend: a per-family code that only a NEW customer can use, and whose
  // redemption rewards the referrer. Enforced in the route (needs a bookings read).
  referral?: boolean;
  referrerEmail?: string;
  newCustomerOnly?: boolean;
  maxOff?: number; // hard £ ceiling on the discount (e.g. a referral reward capped to what the friend spent)
}

/** The emails a reserved code is limited to (single family + group members). */
export function reservedEmails(c: DiscountCodeDoc): string[] {
  return [c.assignedTo, ...(c.assignedEmails ?? [])]
    .filter(Boolean)
    .map((e) => (e as string).trim().toLowerCase());
}

export type CodeCheck = { ok: true; off: number } | { ok: false; reason: string };

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Validate a code against an order subtotal and return the pounds it removes.
 *  ctx carries the redeemer's email (family-assigned codes), the listing being
 *  booked (listing-scoped codes) and the attendee count (per-attendee codes).
 *  The per-customer limit needs a DB read, so it's enforced in the route, not here. */
export function checkCode(c: DiscountCodeDoc, subtotal: number, today: string, ctx?: { email?: string; listingId?: string; attendees?: number }): CodeCheck {
  if (c.active === false) return { ok: false, reason: "This code is no longer active" };
  const reserved = reservedEmails(c);
  if (reserved.length && (!ctx?.email || !reserved.includes(ctx.email.trim().toLowerCase())))
    return { ok: false, reason: "This code is reserved for another customer" };
  if (c.listingId && ctx?.listingId && c.listingId !== ctx.listingId)
    return { ok: false, reason: "This code doesn’t apply to this activity" };
  if (c.expiry && c.expiry < today) return { ok: false, reason: "This code has expired" };
  if (c.usageLimit != null && (c.usedCount ?? 0) >= c.usageLimit) return { ok: false, reason: "This code has reached its usage limit" };
  if (c.minSpend != null && subtotal < c.minSpend) return { ok: false, reason: `Spend at least £${c.minSpend.toFixed(2)} to use this code` };
  const raw = c.type === "percent" ? subtotal * (c.value / 100) : c.type === "perAttendee" ? c.value * Math.max(1, ctx?.attendees ?? 1) : c.value;
  const ceiling = c.maxOff != null && c.maxOff >= 0 ? Math.min(subtotal, c.maxOff) : subtotal;
  const off = round2(Math.min(Math.max(0, raw), ceiling));
  if (off <= 0) return { ok: false, reason: "This code gives no discount on this order" };
  return { ok: true, off };
}

export const normaliseCode = (s: string) => s.trim().toUpperCase();
