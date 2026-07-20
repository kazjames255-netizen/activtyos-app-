// Staff:child ratios (Run the day → Ratios & groups).
//
// UK activity-camp / out-of-school defaults, as working ratios a provider
// runs to (their risk assessment can be stricter). The exact statutory EYFS
// figures apply under 5; over 5s are risk-assessment-led, and 1:8 (5–7) /
// 1:10 (8+) are the common camp choices. A provider can override the table
// later; these are the sensible starting point.

export interface RatioBand {
  /** Inclusive upper age for this band. */
  maxAge: number;
  /** Children per adult. */
  ratio: number;
  label: string;
}

export const DEFAULT_BANDS: RatioBand[] = [
  { maxAge: 1, ratio: 3, label: "Under 2" },
  { maxAge: 2, ratio: 4, label: "Age 2" },
  { maxAge: 4, ratio: 8, label: "Age 3–4" },
  { maxAge: 7, ratio: 8, label: "Age 5–7" },
  { maxAge: 99, ratio: 10, label: "Age 8+" },
];

export function bandFor(age: number, bands = DEFAULT_BANDS): RatioBand {
  return bands.find((b) => age <= b.maxAge) ?? bands[bands.length - 1];
}

/**
 * Staff required for a set of children's ages. Mixed ages are summed as
 * fractional demand (a child needs 1/ratio of an adult) and rounded up, with
 * a floor of one adult whenever any child is present. SEND children who need
 * extra support are the operator's call — surfaced, never auto-applied.
 */
export function requiredStaff(ages: number[], bands = DEFAULT_BANDS): number {
  if (!ages.length) return 0;
  const demand = ages.reduce((sum, age) => sum + 1 / bandFor(age, bands).ratio, 0);
  return Math.max(1, Math.ceil(Math.round(demand * 1000) / 1000));
}
