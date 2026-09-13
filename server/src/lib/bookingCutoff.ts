// Per-listing booking cut-off — "stop taking bookings N hours before a
// session". Sessions are UK wall-clock times (date "2027-07-28" + start
// "09:00"), so the check compares in UK wall-clock terms too: a session is
// closed once its start is earlier than the UK time N hours from now. Works
// the same whatever timezone the server runs in.

const fmt = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
});

/** A moment as UK wall-clock "YYYY-MM-DDTHH:MM". */
export function ukWallClock(d: Date): string {
  const p = Object.fromEntries(fmt.formatToParts(d).map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}

/** The listing's cut-off in hours, or null when it has none. Stored as the
 *  wizard's string ("24"); blank / 0 / junk = no cut-off. */
export function cutoffHours(raw: unknown): number | null {
  const n = typeof raw === "number" ? raw : parseFloat(String(raw ?? ""));
  return Number.isFinite(n) && n > 0 ? Math.min(n, 24 * 60) : null;
}

/** True when a session starting at `date` + `start` (UK) is inside the
 *  cut-off window, i.e. can no longer be booked by a family. A missing start
 *  time counts as the start of the day (the strict reading). */
export function pastCutoff(hours: number, date: string, start: string | undefined, now: Date = new Date()): boolean {
  const at = `${date}T${/^\d{2}:\d{2}$/.test(start ?? "") ? start : "00:00"}`;
  return at < ukWallClock(new Date(now.getTime() + hours * 3_600_000));
}

/** "24 hours" / "1 hour" / "2 days" — how the cut-off is described to parents. */
export function bookingCutoffLabel(hours: number): string {
  if (hours >= 48 && hours % 24 === 0) return `${hours / 24} days`;
  return `${hours} hour${hours === 1 ? "" : "s"}`;
}
