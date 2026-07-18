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
  /** How `capacity` binds: "day" caps who's on site per DATE (dayCounts
   * enforce), "listing" caps the whole run (bookedCount enforces).
   * Absent on older/manual blocks = "listing" (the old behaviour). */
  capacityScope?: "day" | "listing";
  /** Seats held per session date — maintained transactionally alongside
   * bookedCount on every status transition. */
  dayCounts?: Record<string, number>;
}

/** The session dates a booking occupies (older bookings = every session). */
export function bookingDays(b: { days?: string[] }, block: BlockDoc): string[] {
  return b.days?.length ? b.days : block.sessions.map((s) => s.date);
}

/** The bookedCount + dayCounts update for moving `delta` seats on `days`. */
export function countsUpdate(
  block: BlockDoc,
  delta: number,
  days: string[],
): { bookedCount: number; dayCounts: Record<string, number> } {
  const dayCounts = { ...(block.dayCounts ?? {}) };
  for (const d of days) dayCounts[d] = Math.max(0, (dayCounts[d] ?? 0) + delta);
  return { bookedCount: Math.max(0, block.bookedCount + delta), dayCounts };
}

/** Day-scope: a booking fits when EVERY day it wants has a free place. */
export function daysHaveSpace(
  block: BlockDoc,
  wanted: Record<string, number>, // date → seats requested
): { fits: boolean; fullDay?: string } {
  for (const [date, seats] of Object.entries(wanted)) {
    if ((block.dayCounts?.[date] ?? 0) + seats > block.capacity) return { fits: false, fullDay: date };
  }
  return { fits: true };
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
  const scope = b.capacityScope ?? "listing";
  const counts = b.dayCounts ?? {};
  // Day scope: the block as a whole has space only while its BUSIEST day
  // does (a whole-run pass needs a place every day).
  const busiest = b.sessions.reduce((m, s) => Math.max(m, counts[s.date] ?? 0), 0);
  return {
    id,
    name: b.name,
    startDate: b.startDate,
    endDate: b.endDate,
    capacity: b.capacity,
    bookedCount: b.bookedCount,
    spotsLeft: Math.max(0, b.capacity - (scope === "day" ? busiest : b.bookedCount)),
    open: b.open,
    capacityScope: scope,
    sessions: b.sessions.map((s) => ({
      ...s,
      capacity: b.capacity,
      bookedCount: counts[s.date] ?? 0,
      spotsLeft: Math.max(0, b.capacity - (counts[s.date] ?? 0)),
    })),
  };
}

export const bookingSeats = (b: Booking): number => b.seats ?? 1;
