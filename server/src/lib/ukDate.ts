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
