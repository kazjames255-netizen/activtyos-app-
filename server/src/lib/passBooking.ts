// Pure pass-booking rules, enforced by POST /api/my/bookings and mirrored by
// the parent UI (features/listings/booking.ts + passRules.ts). No I/O, no
// server-only imports, so tests and the UI can share them.

/** A per-listing pass cap (ticketOverrides[pass].capacity): null = no cap,
 *  0 = pass is CLOSED, n>0 = at most n places of that pass per day. */
export function passCap(capacity: string | undefined | null): number | null {
  const s = String(capacity ?? "").trim();
  if (s === "") return null;
  const n = Math.floor(Number(s));
  return Number.isFinite(n) && n >= 0 ? n : null;
}

export const passClosedBy = (capacity: string | undefined | null) => passCap(capacity) === 0;

const mondayOf = (iso: string) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
};

/**
 * Validate the picked days against the pass. Returns an error message or null.
 * `runDates` = every bookable date of the listing (sorted, unique).
 * Mirrors passRules.effectiveRule: a "blocks" pass whose size is the whole run
 * must take ALL dates of the run (not yet passed); one that is a week block
 * must sit inside a single Monday-week.
 */
export function passDaysProblem(a: {
  need: number | undefined; picked: string[]; runDates: string[]; rule?: string; today?: string;
}): string | null {
  const need = a.need ?? 0;
  if (need <= 1) return null; // single-day passes: any number of 1-day lines
  if (a.picked.length !== need) return `This pass needs exactly ${need} days`;
  if (a.rule !== "blocks") return null;
  const byWeek = new Map<string, number>();
  for (const d of a.runDates) byWeek.set(mondayOf(d), (byWeek.get(mondayOf(d)) ?? 0) + 1);
  const weekMax = Math.max(0, ...byWeek.values());
  const runTotal = a.runDates.length;
  if (weekMax > 0 && need !== weekMax && need !== runTotal) return null; // UI falls back to "any N days"
  if (need > weekMax) {
    const left = a.today ? a.runDates.filter((d) => d >= a.today!) : a.runDates;
    const want = left.slice(0, need);
    const ok = want.length === a.picked.length && want.every((d) => a.picked.includes(d));
    return ok ? null : "This pass covers every date of the block - pick all of them";
  }
  return new Set(a.picked.map(mondayOf)).size === 1 ? null : "This pass must be booked within a single week";
}

/** Which dates (of `wanted`: date → seats) would exceed the pass cap, given `held`
 *  (date → live seats of that pass). Returns the first full date or null. */
export function passFullDay(cap: number | null, held: Record<string, number>, wanted: Record<string, number>): string | null {
  if (cap === null) return null;
  for (const d of Object.keys(wanted).sort()) if ((held[d] ?? 0) + wanted[d] > cap) return d;
  return null;
}

/** True when a booking's stored pass label ("Name" or "Name · Timing" or joined) is this pass. */
export function bookingHasPass(label: string | undefined, passName: string): boolean {
  if (!label) return false;
  return label.split(" · ").some((p) => p.trim() === passName);
}
