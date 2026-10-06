// PURE listing-wizard rules (extracted from ListingWizard.tsx, behaviour unchanged) so they can be regression-tested. See tests/regression/.

export function isOnlineVenue(v: { kind?: string } | null | undefined): boolean {
  return v?.kind === "online";
}

/** A date box typed as "26/10/20" yields the year 0020 (and 20 weeks becomes 58 weeks of nothing). Two-digit years mean 20xx; three-digit
 *  years are still being typed, so they are left alone until there are four digits. */
export function fixYear(v: string): string {
  const m = /^(\d{1,6})-(\d{2})-(\d{2})$/.exec(v);
  if (!m) return v;
  const y = Number(m[1]);
  if (y >= 1000 && y <= 9999) return v;
  if (y < 100) return `${2000 + y}-${m[2]}-${m[3]}`;
  return v;
}

/** The "check the dates" warning: a run of over 40 weeks, or a start year before 2000, is almost always a typo. */
export const runLooksWrong = (weeks: number, runFrom: string | undefined): boolean => weeks > 40 || (!!runFrom && Number(runFrom.slice(0, 4)) < 2000);

/** The top-right "Save" button must NEVER take a live listing offline: it saves a live listing as live, anything else as a draft. */
export const saveStatusFor = (current: "draft" | "live"): "draft" | "live" => (current === "live" ? "live" : "draft");

/** Picking "Online": use the account's existing online place, or create one (the caller supplies the new id). */
export function onlineVenueChoice(venues: { id: string; kind?: string }[], newId: string): { id: string; create: boolean } {
  const existing = venues.find((v) => isOnlineVenue(v));
  return existing ? { id: existing.id, create: false } : { id: newId, create: true };
}

/** The draft changes when the provider picks a delivery mode. Any NON-online choice clears a leftover online place, so a listing can never be
 *  published as "At a venue" with the Online place still attached; Home visits starts a blank postcode list. */
export function deliveryPatch(mode: "venue" | "home-visit" | "both", venues: { id: string; kind?: string }[], venueId: string | null | undefined, hasCoverage: boolean) {
  const clearsOnline = isOnlineVenue(venues.find((v) => v.id === venueId));
  return {
    deliveryMode: mode,
    ...(clearsOnline ? { venueId: null } : {}),
    ...(mode === "home-visit" && !hasCoverage ? { coverageArea: { mode: "postcodePrefixes" as const, postcodePrefixes: [] as string[] } } : {}),
  };
}
