// "Today" for a UK platform. The server may run in UTC (or anywhere), and
// between midnight and 1am BST a UTC date is still yesterday — the dashboard
// showed yesterday's sessions as today's (acceptance test d11s6).
const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit" });

/** Today's date in the UK, as YYYY-MM-DD. */
export function ukToday(d: Date = new Date()): string {
  return fmt.format(d);
}

/** `iso` (YYYY-MM-DD) shifted by `n` whole days — negative goes backwards.
 *  Calendar arithmetic only: both ends are anchored at UTC midnight so the
 *  October clock change can't drop or duplicate a day (adding 86_400_000ms to
 *  a Date does exactly that on the night the clocks move). */
export function addDays(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** The UK date `n` days either side of today — `ukTodayPlus(30)` for a due
 *  date, `ukTodayPlus(-30)` for a cut-off. Prefer this to `Date.now() ± n×86_400_000`
 *  followed by `.toISOString().slice(0, 10)`, which is a UTC day and is off by
 *  one between midnight and 1am British Summer Time. */
export function ukTodayPlus(n: number, d: Date = new Date()): string {
  return addDays(ukToday(d), n);
}

/** This month in the UK, as YYYY-MM — the key every month-bucketed figure
 *  ("taken this month") is grouped by. */
export function ukMonth(d: Date = new Date()): string {
  return ukToday(d).slice(0, 7);
}

/** True only for a REAL calendar day in YYYY-MM-DD form. A bare /^\d{4}-\d{2}-\d{2}$/ accepts "2026-13-45" and "2026-02-31",
 *  which then sort/compare as dates and get stored (an expense dated 2026-13-45 sat in the ledger). Use as a zod `.refine`. */
export function isRealDay(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

/** True only for a real 24h clock time in HH:MM form ("25:99" matches a bare \d{2}:\d{2}). */
export function isRealTime(s: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(s);
}

/** Optional-field helpers: "" (the form's "not set") passes, anything else must be a real day / clock time (HH:MM or HH:MM:SS). */
export const isBlankOrRealDay = (s: string): boolean => s === "" || isRealDay(s);
export const isBlankOrRealTime = (s: string): boolean => s === "" || (/^\d{2}:\d{2}(:\d{2})?$/.test(s) && isRealTime(s.slice(0, 5)));
