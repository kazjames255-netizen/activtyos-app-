// Plain-English "who pays what" text for the franchise invite email. Pure: the
// numbers come from the live pricing catalogue (DEFAULT_PLANS shape) and the
// head office's royalty settings, so an HQ price edit flows straight into the mail.
export type FranchiseTier = { upTo: number | null; price: number };

const gbp = (n: number) => `£${Number.isInteger(n) ? n : n.toFixed(2)}`;

/** "£39 each for the first 5, £31 each for the next 10, then £25 each". */
export function tierText(tiers: FranchiseTier[], flat?: number): string {
  if (!tiers.length) return flat != null ? `${gbp(flat)} each` : "";
  let prev = 0;
  return tiers.map((t, i) => {
    const n = t.upTo == null ? null : t.upTo - prev;
    if (t.upTo != null) prev = t.upTo;
    if (t.upTo == null) return i === 0 ? `${gbp(t.price)} each` : `then ${gbp(t.price)} each`;
    return `${gbp(t.price)} each for ${i === 0 ? "the first" : "the next"} ${n}`;
  }).join(", ");
}

export function royaltyText(s?: { basis?: string; rate?: number; perBookingFee?: number } | null): string {
  if (s?.basis === "perBooking") return `${gbp(s.perBookingFee ?? 0)} per booking`;
  return `${s?.rate ?? 10}% of revenue`;
}

/** Who pays what, as one short paragraph for the invite email. */
export function franchiseCostParagraph(plan: { price?: number; franchiseTiers?: FranchiseTier[]; perFranchise?: number } | undefined, settings?: Parameters<typeof royaltyText>[0]): string {
  const base = plan?.price ?? 99;
  const tiers = tierText(plan?.franchiseTiers ?? [{ upTo: 5, price: 39 }, { upTo: 15, price: 31 }, { upTo: null, price: 25 }], plan?.perFranchise);
  return `Who pays what: head office pays for your ActivityOS access (${gbp(base)}/month for the network plus ${tiers} per franchisee). You pay nothing to ActivityOS. Head office takes a royalty of ${royaltyText(settings)} on your bookings, and that rate is set by head office.`;
}
