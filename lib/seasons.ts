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
  /** Human name — "Summer 1", "Oct Half Term", "Full year". Freely editable. */
  name: string;
}

/** A ready-made UK school year for a camp/club business — the six term
 *  half-terms and the six holiday-camp periods, in calendar order, plus a
 *  year-round bucket. All editable/removable. */
export function defaultSeasonNames(): Season[] {
  return [
    { id: "s-autumn-1", name: "Autumn 1" },
    { id: "s-oct-half", name: "Oct Half Term" },
    { id: "s-autumn-2", name: "Autumn 2" },
    { id: "s-christmas", name: "Christmas Holidays" },
    { id: "s-spring-1", name: "Spring 1" },
    { id: "s-feb-half", name: "Feb Half Term" },
    { id: "s-spring-2", name: "Spring 2" },
    { id: "s-easter", name: "Easter Holidays" },
    { id: "s-summer-1", name: "Summer 1" },
    { id: "s-may-half", name: "May Half Term" },
    { id: "s-summer-2", name: "Summer 2" },
    { id: "s-summer-hols", name: "Summer Holidays" },
    { id: "s-full-year", name: "Full year" },
  ];
}

const SEASON_KEY: Record<string, string> = {
  "Autumn 1": "p8ops.seasonN_autumn1", "Oct Half Term": "p8ops.seasonN_octHalf", "Autumn 2": "p8ops.seasonN_autumn2", "Christmas Holidays": "p8ops.seasonN_christmas",
  "Spring 1": "p8ops.seasonN_spring1", "Feb Half Term": "p8ops.seasonN_febHalf", "Spring 2": "p8ops.seasonN_spring2", "Easter Holidays": "p8ops.seasonN_easter",
  "Summer 1": "p8ops.seasonN_summer1", "May Half Term": "p8ops.seasonN_mayHalf", "Summer 2": "p8ops.seasonN_summer2", "Summer Holidays": "p8ops.seasonN_summerHols", "Full year": "p8ops.seasonN_fullYear",
};
/** Display name of a season: the ready-made names above follow the active language; a name the provider typed or edited shows as typed. */
export function seasonDisplayName(t: (key: string) => string, name: string): string {
  const k = SEASON_KEY[name];
  return k ? t(k) : name;
}
