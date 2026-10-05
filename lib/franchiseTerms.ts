// Pure helpers behind the head-office "Invite franchises" cost note. The numbers come from the live
// pricing catalogue (GET /api/subscription -> plans[franchise]) so an HQ price edit shows up here.
export type FranchiseTier = { upTo: number | null; price: number };
export type TierPart = { kind: "first" | "next" | "then" | "flat"; price: number; n?: number };

/** [{upTo:5,£39},{upTo:15,£31},{null,£25}] -> first 5 at £39, next 10 at £31, then £25. */
export function tierParts(tiers: FranchiseTier[] | undefined, flat?: number): TierPart[] {
  if (!tiers?.length) return flat != null ? [{ kind: "flat", price: flat }] : [];
  let prev = 0;
  return tiers.map((t, i) => {
    if (t.upTo == null) return i === 0 ? { kind: "flat" as const, price: t.price } : { kind: "then" as const, price: t.price };
    const n = t.upTo - prev;
    prev = t.upTo;
    return { kind: i === 0 ? ("first" as const) : ("next" as const), price: t.price, n };
  });
}

/** What the franchisee-count adds to the head-office bill, e.g. 3 franchisees on 5 @ £39 -> £117. */
export function franchiseFeeFor(count: number, tiers: FranchiseTier[] | undefined, flat = 0): number {
  if (!tiers?.length) return count * flat;
  let left = count, prev = 0, total = 0;
  for (const t of tiers) {
    const cap = t.upTo == null ? left : Math.min(left, t.upTo - prev);
    total += cap * t.price;
    left -= cap;
    if (t.upTo != null) prev = t.upTo;
    if (left <= 0) break;
  }
  return total;
}

/** A royalty percentage typed into the invite form: 0-100, max 2 decimals; null when unusable. */
export function parseRoyaltyPct(raw: string): number | null {
  const n = Number(raw.trim());
  if (!raw.trim() || !Number.isFinite(n) || n < 0 || n > 100) return null;
  return Math.round(n * 100) / 100;
}

/** Franchisee side: which Setup tabs still run on head office's copy (branding, referrals, memberships); everything else is the franchisee's own. */
const HO_OWNED_TABS = new Set(["branding", "refer", "memberships"]);
export function settingsOwner(tab: string): "headOffice" | "yours" {
  return HO_OWNED_TABS.has(tab) ? "headOffice" : "yours";
}
