// PURE roster / register / occupancy rules (extracted from routes, behaviour unchanged). Each one exists because of a real bug: see tests/regression/.

/** Team members who left (account switched off) must not count as ratio cover or be listed to parents. */
export const withoutLeavers = (staffIds: string[], leavers: Set<string>): string[] => staffIds.filter((x) => !leavers.has(x));

export interface AddonLineLite { child: string; label: string; price: number; perDay?: boolean; days?: string[] }

/** This child's extras for THIS day only: a sibling's T-shirt, or a lunch bought for other days, must not show against them.
 *  Older bookings carry no per-child lines: they fall back to the plain list. */
export function childExtrasForDay(lines: AddonLineLite[] | undefined, fallback: string[] | undefined, childName: string, date: string): string[] {
  if (!lines) return fallback ?? [];
  return lines
    .filter((l) => l.child.trim() === childName.trim() && (!l.perDay || !l.days?.length || l.days.includes(date)))
    .map((l) => `${l.label} — £${l.price.toFixed(2)}`);
}

/** Open capacity / booked for the dashboard's "Spaces left" tile. A PER-DAY limit applies to EACH remaining day against the children booked
 *  that day; adding the daily limit once per run to all child-days booked made a busy per-day listing look over-full. */
export function openOccupancy(scope: string | undefined, run: { capacity: number; bookedCount: number }, future: { capacity: number; bookedCount: number }[]): { capacity: number; booked: number } {
  if (scope === "day") return future.reduce((a, s) => ({ capacity: a.capacity + s.capacity, booked: a.booked + s.bookedCount }), { capacity: 0, booked: 0 });
  return { capacity: run.capacity, booked: run.bookedCount };
}
