import type { Booking } from "../../../features/bookings/types";

// Pure queue ordering + positions (no Firestore) so they can be unit-tested.

export const refNum = (ref: string) => parseInt(ref.replace(/\D/g, ""), 10) || 0;

/** Queue order: FIFO by ref, except a family whose offer lapsed re-joins at
 * the back (requeuedAt later than everyone who never lapsed). */
export function sortQueue<T extends { ref: string; requeuedAt?: string }>(waiting: T[]): T[] {
  return [...waiting].sort(
    (a, b) => (Date.parse(a.requeuedAt ?? "") || 0) - (Date.parse(b.requeuedAt ?? "") || 0) || refNum(a.ref) - refNum(b.ref),
  );
}

/** Per-date positions of `refs` within an already-ordered queue. */
export function positionsFrom(
  queued: Pick<Booking, "ref">[],
  refs: string[],
  daysOf: (b: Pick<Booking, "ref">) => string[],
): { ref: string; date: string; position: number }[] {
  const perDate = new Map<string, string[]>();
  for (const b of queued) for (const d of daysOf(b)) perDate.set(d, [...(perDate.get(d) ?? []), b.ref]);
  const out: { ref: string; date: string; position: number }[] = [];
  for (const [date, order] of perDate) {
    for (const ref of refs) {
      const i = order.indexOf(ref);
      if (i >= 0) out.push({ ref, date, position: i + 1 });
    }
  }
  return out.sort((a, b) => (a.date < b.date ? -1 : 1));
}
