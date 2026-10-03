// Client mirror of server/src/lib/bookingCutoff.ts (the server stays the source
// of truth and still refuses at Confirm). Same inputs: the listing's
// bookingCutoffHours string, a session date and its start time, UK wall clock.

const fmt = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
});

export function ukWallClock(d: Date): string {
  const p = Object.fromEntries(fmt.formatToParts(d).map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}

/** Same parsing as the server: blank / 0 / junk = no cut-off. */
export function cutoffHours(raw: unknown): number | null {
  const n = typeof raw === "number" ? raw : parseFloat(String(raw ?? ""));
  return Number.isFinite(n) && n > 0 ? Math.min(n, 24 * 60) : null;
}

/** True when the session on `date` is inside the cut-off window. The page
 *  usually doesn't know a day's session start (only the chosen timing's), so
 *  with no `start` it is lenient (end of day) and leaves the strict check to
 *  the server rather than greying a day the server would still accept. */
export function insideCutoff(hours: number | null, date: string, start?: string, now: Date = new Date()): boolean {
  if (!hours) return false;
  const at = `${date}T${/^\d{2}:\d{2}$/.test(start ?? "") ? start : "23:59"}`;
  return at < ukWallClock(new Date(now.getTime() + hours * 3_600_000));
}
