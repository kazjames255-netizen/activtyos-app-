// "Today" for a UK platform. The server may run in UTC (or anywhere), and
// between midnight and 1am BST a UTC date is still yesterday — the dashboard
// showed yesterday's sessions as today's (acceptance test d11s6).
const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit" });

/** Today's date in the UK, as YYYY-MM-DD. */
export function ukToday(d: Date = new Date()): string {
  return fmt.format(d);
}
