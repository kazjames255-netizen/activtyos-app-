// Discount codes (Marketing) — customer-entered coupons, distinct from the
// automatic per-listing discount RULES (features/listings/discounts.ts). This
// pure helper is the single source of truth for "is this code usable, and how
// much does it take off", shared by the validate endpoint and checkout so the
// preview a parent sees and the price they're charged can never disagree.

export interface DiscountCodeDoc {
  tenantId: string;
  code: string; // stored upper-cased
  type: "percent" | "amount";
  value: number; // percent (0–100) or pounds
  minSpend?: number;
  expiry?: string; // ISO date, inclusive last valid day
  usageLimit?: number; // total redemptions allowed
  usedCount?: number;
  active?: boolean;
}

export type CodeCheck = { ok: true; off: number } | { ok: false; reason: string };

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Validate a code against an order subtotal and return the pounds it removes. */
export function checkCode(c: DiscountCodeDoc, subtotal: number, today: string): CodeCheck {
  if (c.active === false) return { ok: false, reason: "This code is no longer active" };
  if (c.expiry && c.expiry < today) return { ok: false, reason: "This code has expired" };
  if (c.usageLimit != null && (c.usedCount ?? 0) >= c.usageLimit) return { ok: false, reason: "This code has reached its usage limit" };
  if (c.minSpend != null && subtotal < c.minSpend) return { ok: false, reason: `Spend at least £${c.minSpend.toFixed(2)} to use this code` };
  const raw = c.type === "percent" ? subtotal * (c.value / 100) : c.value;
  const off = round2(Math.min(Math.max(0, raw), subtotal));
  if (off <= 0) return { ok: false, reason: "This code gives no discount on this order" };
  return { ok: true, off };
}

export const normaliseCode = (s: string) => s.trim().toUpperCase();
