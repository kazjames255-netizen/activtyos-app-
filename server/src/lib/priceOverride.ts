// Pure helpers for the operator's checkout "Override the total" (BQ-006). No Firestore.

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Rescale `amounts` so they sum to exactly `wanted`, keeping their proportions; the last line absorbs rounding.
 *  All-zero input puts the whole total on the first line. */
export function scaleToTotal(amounts: number[], wanted: number): number[] {
  if (!amounts.length) return [];
  const sum = amounts.reduce((s, a) => s + a, 0);
  const out = sum > 0 ? amounts.map((a) => round2((a / sum) * wanted)) : amounts.map((_, i) => (i === 0 ? round2(wanted) : 0));
  const drift = round2(wanted - out.reduce((s, a) => round2(s + a), 0));
  out[out.length - 1] = round2(out[out.length - 1] + drift);
  return out;
}

export type PriceOverride = { originalAmount: number; amount: number; by: string; reason: string; at: string };

/** Split the basket's pre-override total across the bookings that came out of it, in proportion to what each
 *  now costs, so the originals sum to `originalTotal` exactly. */
export function splitOriginal(newAmounts: number[], originalTotal: number): number[] {
  return scaleToTotal(newAmounts, originalTotal);
}
