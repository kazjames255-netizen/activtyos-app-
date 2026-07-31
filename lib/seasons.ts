// ─────────────────────────────────────────────────────────────────────────
// Seasons — the trading periods a kids'-activity business runs on.
//
// A season is just a NAME you assign listings to — no dates. This sidesteps
// the whole "UK holiday dates vary by council" problem: your listings already
// ARE your seasonal products ("Summer Holiday Camp"), so a booking's season is
// simply the season its listing belongs to. Define the names once in Setup and
// tick which listings belong to each.
//
// Pages that hang off a listing (Bookings, Audiences, booking income) can scope
// to a season; pages with no listing behind them (general expenses, campaign
// history) don't offer it.
// ─────────────────────────────────────────────────────────────────────────

export interface Season {
  id: string;
  /** Human name — "Summer 1", "Autumn 2", "All year". Freely editable. */
  name: string;
  /** Listing ids that belong to this season. A booking is "in" the season when
   *  its listingId is in here. */
  listingIds?: string[];
}

/** A ready-made set of UK term half-names to start from — all editable, and all
 *  begin with no listings assigned. */
export function defaultSeasonNames(): Season[] {
  return [
    { id: "s-autumn-1", name: "Autumn 1", listingIds: [] },
    { id: "s-autumn-2", name: "Autumn 2", listingIds: [] },
    { id: "s-spring-1", name: "Spring 1", listingIds: [] },
    { id: "s-spring-2", name: "Spring 2", listingIds: [] },
    { id: "s-summer-1", name: "Summer 1", listingIds: [] },
    { id: "s-summer-2", name: "Summer 2", listingIds: [] },
    { id: "s-all-year", name: "All year", listingIds: [] },
  ];
}

/** True when a booking's listing belongs to this season. */
export function bookingInSeason(season: Season, listingId?: string | null): boolean {
  return !!listingId && (season.listingIds ?? []).includes(listingId);
}

/** The listing ids a season owns (never undefined). */
export function seasonListingIds(season: Season): string[] {
  return season.listingIds ?? [];
}
