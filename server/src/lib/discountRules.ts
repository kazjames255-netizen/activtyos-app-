// PURE discount-rule guards (extracted from routes/listings.ts and lib/earlyBird.ts, behaviour unchanged). See tests/regression/.

/** The scope a fixed-GBP early bird is limited within: once per family per SEASON, or once per LISTING when the listing has no season. */
export const earlyBirdScopeOf = (listingId: string, seasonId?: string | null) => (seasonId ? `season:${seasonId}` : `listing:${listingId}`);

/** A cancelled or declined booking does not count as having used the early bird. */
export const countsAsEarlyBirdUse = (status: unknown): boolean => !/cancel|declin/i.test(String(status ?? ""));

// Multi-person (sibling) discounts are percentage-only: a GBP amount is taken per child per line, so a family could split a week into single days and
// out-discount the weekly pass. Rules already saved with another method keep working (stored id + method unchanged); only NEW or CHANGED ones are refused.
export function personRuleProblem(next: unknown, stored: unknown): string | null {
  const have = new Map(((stored as { id?: string; method?: string; value?: number }[] | undefined) ?? []).map((r) => [r.id, r]));
  for (const r of (next as { id: string; kind: string; method: string; value: number }[] | undefined) ?? []) {
    if (r.kind !== "person" || r.method === "percent") continue;
    const old = have.get(r.id);
    if (!old || old.method !== r.method || old.value !== r.value || (old as { kind?: string }).kind !== r.kind) return "A multi-person discount must be a percentage (a fixed £ amount per child can be beaten by splitting a week into single days).";
  }
  return null;
}
