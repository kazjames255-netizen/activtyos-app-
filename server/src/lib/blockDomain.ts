import type { Booking, BookingStatus } from "../../../features/bookings/types";

// Block/session domain helpers, shared by the blocks routes and every
// booking flow that moves places in and out of a block.

export interface Session {
  date: string; // ISO "2027-07-28"
  start: string; // "09:00"
  end: string; // "15:30"
}

export interface BlockDoc {
  tenantId: string;
  listingId: string;
  name: string;
  startDate: string;
  endDate: string;
  capacity: number;
  bookedCount: number;
  open: boolean;
  sessions: Session[];
}

/** Which booking statuses hold a place in a block. */
export const countsTowardCapacity = (status: BookingStatus): boolean =>
  status === "Confirmed" || status === "Approval needed";

/** bookedCount delta for a status transition (0 when nothing changes). */
export function blockCountDelta(
  oldStatus: BookingStatus,
  newStatus: BookingStatus,
  seats: number,
): number {
  const before = countsTowardCapacity(oldStatus) ? seats : 0;
  const after = countsTowardCapacity(newStatus) ? seats : 0;
  return after - before;
}

/** Generate one session per matching weekday across the date range. */
export function generateSessions(
  startDate: string,
  endDate: string,
  startTime: string,
  endTime: string,
  weekdays: number[], // 0=Sun … 6=Sat
): Session[] {
  const out: Session[] = [];
  const d = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);
  if (isNaN(d.getTime()) || isNaN(end.getTime())) return out;
  while (d <= end && out.length < 200) {
    if (weekdays.includes(d.getUTCDay())) {
      out.push({ date: d.toISOString().slice(0, 10), start: startTime, end: endTime });
    }
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}

/** "2027-07-28" + 09:00–15:30 → "Mon 28 Jul 2027 · 09:00 – 15:30". */
export function sessionLabel(s: Session): string {
  const d = new Date(`${s.date}T00:00:00Z`);
  const label = d.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
  return `${label.replace(/,/g, "")} · ${s.start} – ${s.end}`;
}

/** Public availability shape joined onto listings and returned by the API. */
export function blockSummary(id: string, b: BlockDoc) {
  return {
    id,
    name: b.name,
    startDate: b.startDate,
    endDate: b.endDate,
    capacity: b.capacity,
    bookedCount: b.bookedCount,
    spotsLeft: Math.max(0, b.capacity - b.bookedCount),
    open: b.open,
    sessions: b.sessions,
  };
}

export const bookingSeats = (b: Booking): number => b.seats ?? 1;
