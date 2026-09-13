import type { Booking } from "../../../features/bookings/types";
import { countsTowardCapacity } from "./blockDomain";

// One row per CHILD, not per booking.
//
// A family checkout merges siblings into one booking with kids[] (my.ts), and
// every day-of screen used to read that booking as one child: the register
// showed one row and counted one head, ratios under-counted the adults
// required, and the second child's allergies were never looked up — the
// booking-level childId is the first child's. A ratio is a compliance claim and
// a register is the record of who is in your care, so both count children.
//
// Keys: a single-child booking keeps its booking ref, so every register entry
// written before this change still lines up. A multi-child booking gives each
// child `${ref}#${childId}` (or `#${index}` for a child with no saved profile).

export interface RegisterRow {
  /** Register entry key — the booking ref, or ref#child for siblings. */
  key: string;
  bookingRef: string;
  name: string;
  age?: number;
  childId?: string;
  /** Holds a place on this date: the booking counts and this child is on it. */
  expected: boolean;
  /** The row is a sibling split out of a joint booking. */
  sibling: boolean;
}

type KidLike = { name?: string; childId?: string; age?: number; days?: string[]; dates?: string[]; cancelled?: boolean; cancelledDays?: string[] };

/** Is the booking itself expected on this date? */
export function bookingExpectedOn(b: Pick<Booking, "status" | "days">, date: string): boolean {
  return countsTowardCapacity(b.status) && b.status !== "Offered" && (!b.days || b.days.includes(date));
}

/** Every child on the booking, flagged with whether they're expected on `date`. */
export function registerRows(b: Booking, date: string): RegisterRow[] {
  const bookingOk = bookingExpectedOn(b, date);
  const kids = (b.kids ?? []) as KidLike[];
  if (kids.length <= 1) {
    const k = kids[0];
    const kidOk = !k || (!k.cancelled && !(k.cancelledDays ?? []).includes(date));
    return [{
      key: b.ref,
      bookingRef: b.ref,
      name: k?.name ?? b.child ?? "",
      age: k?.age ?? b.age,
      childId: k?.childId ?? b.childId,
      expected: bookingOk && kidOk,
      sibling: false,
    }];
  }
  return kids.map((k, i) => {
    const days = k.days ?? k.dates;
    const kidOk = !k.cancelled && !(k.cancelledDays ?? []).includes(date) && (!days?.length || days.includes(date));
    return {
      key: `${b.ref}#${k.childId ?? i}`,
      bookingRef: b.ref,
      name: k.name ?? b.child ?? "",
      age: k.age,
      childId: k.childId,
      expected: bookingOk && kidOk,
      sibling: true,
    };
  });
}

/** The booking ref a register key belongs to. */
export const bookingRefOfKey = (key: string) => key.split("#")[0];

/** A register entry for this row — falling back to a mark made against the
 *  whole joint booking before siblings were split (it covered all of them). */
export function entryFor<E>(entries: Record<string, E>, row: Pick<RegisterRow, "key" | "bookingRef">): E | undefined {
  return entries[row.key] ?? (row.key !== row.bookingRef ? entries[row.bookingRef] : undefined);
}

/** Signed in and not yet collected — physically here, whatever the booking
 *  says now (a cancellation landing while the child is on site). */
export function onSite(entries: Record<string, { status?: string; collectedAt?: string | null }>, row: Pick<RegisterRow, "key" | "bookingRef">): boolean {
  const e = entryFor(entries, row);
  return e?.status === "in" && !e.collectedAt;
}
