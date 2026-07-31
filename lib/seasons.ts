// ─────────────────────────────────────────────────────────────────────────
// Seasons — the one scoping dimension a kids'-activity business runs on.
//
// Almost every operational question ("how many booked?", "how much did we
// take?", "who's on the register?") is really "…this season?". Rather than
// tag every listing/booking by hand, a season is DERIVED from a date: define
// the periods once in Setup, and anything with a date lands in the right one.
//
// Two rhythms coexist in the UK: holiday camps (half-terms + holidays) and
// term-time clubs (three terms). `kind` distinguishes them so a provider can
// filter to just one rhythm if they want.
//
// Pure + date-injected: every "now" comes in as a millisecond argument so
// these stay React-Compiler-safe (no Date.now()/new Date() during render).
// ─────────────────────────────────────────────────────────────────────────

export type SeasonKind = "holiday" | "term";

/** A city/location whose council sets different holiday dates for this season. */
export interface SeasonOverride {
  /** Location NAME (matches a booking's locationName / a venue name). */
  location: string;
  from: string;
  to: string;
}

export interface Season {
  id: string;
  /** Human name, usually carrying the year — "Summer Holidays 2026". */
  name: string;
  /** Inclusive ISO date (YYYY-MM-DD) — the DEFAULT window. */
  from: string;
  /** Inclusive ISO date (YYYY-MM-DD). */
  to: string;
  kind: SeasonKind;
  /**
   * Per-location date overrides. UK school-holiday dates vary by council, so a
   * provider running in several cities can give a season different dates in
   * each. A location with no override just uses the default from/to above.
   */
  byLocation?: SeasonOverride[];
}

/** The date window a season applies for a given location: the location's
 *  override if it has one, else the season's default. */
export function seasonRange(s: Season, location?: string | null): { from: string; to: string } {
  if (location && s.byLocation?.length) {
    const o = s.byLocation.find((x) => x.location === location);
    if (o && o.from && o.to) return { from: o.from, to: o.to };
  }
  return { from: s.from, to: s.to };
}

/** The WIDEST window across the default + every override — used where a row
 *  has no location to key off (money, campaigns), so nothing is missed. */
export function seasonSpan(s: Season): { from: string; to: string } {
  let from = s.from, to = s.to;
  for (const o of s.byLocation ?? []) {
    if (o.from && (!from || o.from < from)) from = o.from;
    if (o.to && (!to || o.to > to)) to = o.to;
  }
  return { from, to };
}

/** A date string (any parseable form) reduced to YYYY-MM-DD, or "" if unusable. */
export function isoDay(d?: string | null): string {
  if (!d) return "";
  // Already a plain date — keep it (avoids TZ drift from Date parsing).
  if (/^\d{4}-\d{2}-\d{2}/.test(d)) return d.slice(0, 10);
  const t = Date.parse(d);
  return Number.isNaN(t) ? "" : new Date(t).toISOString().slice(0, 10);
}

/** Newest first — the order every picker and list should show. */
export function sortSeasons(seasons: Season[]): Season[] {
  return [...seasons].sort((a, b) => (a.from < b.from ? 1 : a.from > b.from ? -1 : 0));
}

/** The season a given date falls inside (inclusive both ends), else null. */
export function seasonForDate(seasons: Season[], date?: string | null): Season | null {
  const day = isoDay(date);
  if (!day) return null;
  // If ranges overlap, the later-starting one wins (a half-term inside a term).
  let best: Season | null = null;
  for (const s of seasons) {
    if (s.from <= day && day <= s.to) {
      if (!best || s.from > best.from) best = s;
    }
  }
  return best;
}

/** True when a date sits within a season — for the given location's window if
 *  one is set, else the season's default window. */
export function inSeason(season: Season, date?: string | null, location?: string | null): boolean {
  const day = isoDay(date);
  if (!day) return false;
  const { from, to } = seasonRange(season, location);
  return from <= day && day <= to;
}

/**
 * The season to default a picker to: the one containing today; else the next
 * upcoming; else the most recent past. `nowMs` is injected so this is pure.
 */
export function currentSeasonId(seasons: Season[], nowMs: number): string {
  if (!seasons.length) return "";
  const today = new Date(nowMs).toISOString().slice(0, 10);
  const now = seasonForDate(seasons, today);
  if (now) return now.id;
  const upcoming = sortSeasons(seasons).filter((s) => s.from > today).sort((a, b) => (a.from < b.from ? -1 : 1))[0];
  if (upcoming) return upcoming.id;
  return sortSeasons(seasons)[0]?.id ?? "";
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const dpart = (iso: string) => { const [y, m, d] = iso.split("-").map(Number); return { y, m, d }; };

/** "20 Jul – 1 Sep 2026" (drops a repeated year/month for brevity). */
export function fmtSeasonRange(s: Season): string {
  const a = dpart(s.from), b = dpart(s.to);
  if (!a.y || !b.y) return "";
  const left = a.y === b.y ? `${a.d} ${MONTHS[a.m - 1]}` : `${a.d} ${MONTHS[a.m - 1]} ${a.y}`;
  const right = `${b.d} ${MONTHS[b.m - 1]} ${b.y}`;
  return `${left} – ${right}`;
}

const KIND_LABEL: Record<SeasonKind, string> = { holiday: "Holiday camp", term: "Term-time" };
export const seasonKindLabel = (k: SeasonKind) => KIND_LABEL[k];

/**
 * A sensible starter set for a UK provider's year — three terms and the three
 * main holiday blocks (Easter, Summer, Christmas). Half-terms are left out on
 * purpose: most providers add the one or two they actually run. Dates are the
 * usual shape and fully editable. `year` is the calendar year the Spring term
 * opens in; Christmas rolls into the following January.
 */
export function defaultUKSeasons(year: number): Season[] {
  const y = year, n = year + 1;
  const mk = (id: string, name: string, from: string, to: string, kind: SeasonKind): Season => ({ id, name, from, to, kind });
  return [
    mk(`s-${y}-spring`, `Spring Term ${y}`, `${y}-01-06`, `${y}-03-27`, "term"),
    mk(`s-${y}-easter`, `Easter Holidays ${y}`, `${y}-03-28`, `${y}-04-12`, "holiday"),
    mk(`s-${y}-summer-term`, `Summer Term ${y}`, `${y}-04-13`, `${y}-07-21`, "term"),
    mk(`s-${y}-summer`, `Summer Holidays ${y}`, `${y}-07-22`, `${y}-09-01`, "holiday"),
    mk(`s-${y}-autumn`, `Autumn Term ${y}`, `${y}-09-02`, `${y}-12-18`, "term"),
    mk(`s-${y}-christmas`, `Christmas Holidays ${y}/${String(n).slice(2)}`, `${y}-12-19`, `${n}-01-05`, "holiday"),
  ];
}
