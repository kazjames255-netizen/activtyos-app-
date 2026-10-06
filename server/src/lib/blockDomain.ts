import type { Booking, BookingStatus } from "../../../features/bookings/types";

// Block/session domain helpers, shared by the blocks routes and every
// booking flow that moves places in and out of a block.

export interface Session {
  date: string; // ISO "2027-07-28"
  start: string; // "09:00"
  end: string; // "15:30"
  /** Optional per-day price: when set, Setup > Amending dates > "allow cheaper sessions" compares it between the day given up and the day moved to. */
  price?: number;
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
  status === "Confirmed" || status === "Approval needed" || status === "Offered";

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

/** Places a booking holds on a block: total seats and seats per session date.
 *  Per-CHILD aware — a cancelled child (or a day a child released) no longer
 *  holds a place, so capacity moves one place per child, not only when the
 *  whole booking changes status. A booking with no kids[] holds
 *  bookingSeats × bookingDays, exactly as before. */
export interface HeldPlaces {
  seats: number;
  days: Record<string, number>;
}
export function heldPlaces(
  b: Pick<Booking, "status" | "seats" | "days" | "kids">,
  block: BlockDoc,
  status: BookingStatus = b.status,
): HeldPlaces {
  const empty: HeldPlaces = { seats: 0, days: {} };
  if (!countsTowardCapacity(status)) return empty;
  const all = bookingDays(b, block);
  const seats = b.seats ?? 1;
  const kids = b.kids ?? [];
  const touched = kids.some((k) => k.cancelled || (k.cancelledDays?.length ?? 0) > 0);
  // Kid dates may be ISO or "Mon 27 Jul 2026" labels — normalise to ISO.
  const byLabel = new Map(block.sessions.map((s) => [sessionLabel(s).split(" · ")[0], s.date]));
  const iso = (d: string) => (/^\d{4}-\d{2}-\d{2}$/.test(d) ? d : byLabel.get(d) ?? d);
  // Two children on one booking can attend DIFFERENT days (one all week, one Mon-Wed). Creation counts each child on its own days, so every later
  // read (cancel, date move, approve) must too, even when nobody has cancelled anything yet. Otherwise cancelling that booking frees seats on days a
  // child never held, and a place still held by someone else is released. Per-child days only count where they fall inside the booking's own days.
  const allSet = new Set(all);
  const perKid = kids.length > 0 && kids.some((k) => (k.dates?.length ?? 0) > 0 && k.dates!.map(iso).some((d) => allSet.has(d)) && k.dates!.map(iso).filter((d) => allSet.has(d)).length !== all.length);
  if (!kids.length || (!touched && !perKid)) {
    return { seats, days: Object.fromEntries(all.map((d) => [d, seats])) };
  }
  const days: Record<string, number> = {};
  let cancelledKids = 0;
  for (const k of kids) {
    if (k.cancelled) {
      cancelledKids += 1;
      continue;
    }
    const gone = new Set((k.cancelledDays ?? []).map(iso));
    const kd = k.dates?.length ? k.dates.map(iso).filter((d) => allSet.has(d)) : all;
    const mine = (kd.length ? kd : all).filter((d) => !gone.has(d));
    for (const d of mine) days[d] = (days[d] ?? 0) + 1;
  }
  return { seats: Math.max(0, seats - cancelledKids), days };
}

/** Signed change from `before` to `after` (negative = places freed). */
export function placesDelta(before: HeldPlaces, after: HeldPlaces): HeldPlaces {
  const days: Record<string, number> = {};
  for (const d of new Set([...Object.keys(before.days), ...Object.keys(after.days)])) {
    const v = (after.days[d] ?? 0) - (before.days[d] ?? 0);
    if (v !== 0) days[d] = v;
  }
  return { seats: after.seats - before.seats, days };
}

/** Apply a placesDelta to a block's bookedCount + dayCounts. */
export function applyPlacesDelta(block: BlockDoc, d: HeldPlaces): { bookedCount: number; dayCounts: Record<string, number> } {
  const dayCounts = { ...(block.dayCounts ?? {}) };
  for (const [day, v] of Object.entries(d.days)) dayCounts[day] = Math.max(0, (dayCounts[day] ?? 0) + v);
  return { bookedCount: Math.max(0, block.bookedCount + d.seats), dayCounts };
}

export const placesDeltaIsZero = (d: HeldPlaces) => d.seats === 0 && Object.keys(d.days).length === 0;

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
