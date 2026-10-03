import { sessionLabel } from "./blockDomain";

type S = { date: string; start: string; end: string };

/**
 * Booking session labels. When the booking has a chosen timing (e.g. an
 * Afternoon period) its own start/finish replace the block session's hours, so
 * an Afternoon booking never reads as the morning hours.
 */
export function bookingSessionLabels(
  sessions: S[],
  days: string[],
  hours?: { start: string; finish: string } | null,
): string[] {
  return sessions
    .filter((s) => days.includes(s.date))
    .map((s) => sessionLabel(hours?.start && hours?.finish ? { ...s, start: hours.start, end: hours.finish } : s));
}
