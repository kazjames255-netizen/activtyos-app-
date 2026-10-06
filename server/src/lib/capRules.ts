// PURE per-ticket and per-age-group daily cap check for a place about to be OFFERED to the waiting list (extracted from lib/waitlist.ts capsProblem,
// behaviour unchanged). A seat freed elsewhere on the block does not make room on a capped ticket, so an offer for a pass or age group that is still
// at its cap would overbook it. See tests/regression/.
import { passCap, passFullDay, bookingHasPass } from "./passBooking";
import { ageCapGroup } from "./childAge";

export interface CapBooking { ref: string; pass?: string; age?: number; days?: string[]; seats: number }
export interface CapListing { ticketOverrides?: Record<string, { capacity?: string }>; ageCapsOn?: boolean; ageCaps?: Record<string, number> }
export interface CapGroup { id: string; ageFrom: number; ageTo: number; name?: string }

export function capsViolation(listing: CapListing, b: CapBooking, days: string[], live: CapBooking[], runDates: string[], groups: CapGroup[]): string | null {
  const capped = Object.entries(listing.ticketOverrides ?? {}).filter(([n, o]) => passCap(o?.capacity) !== null && bookingHasPass(b.pass, n));
  const ageCaps = listing.ageCaps ?? {};
  const ageOn = !!listing.ageCapsOn && Object.keys(ageCaps).length > 0;
  if (!capped.length && !ageOn) return null;
  const want = Object.fromEntries(days.map((d) => [d, b.seats]));
  for (const [name, o] of capped) {
    const held: Record<string, number> = {};
    for (const bk of live) {
      if (bk.ref === b.ref || !bookingHasPass(bk.pass, name)) continue;
      for (const day of bk.days ?? runDates) held[day] = (held[day] ?? 0) + bk.seats;
    }
    const full = passFullDay(passCap(o?.capacity), held, want);
    if (full) return `${name} is full on ${full}`;
  }
  if (ageOn) {
    const gid = typeof b.age === "number" ? ageCapGroup({ age: b.age }, groups) : undefined;
    if (gid && ageCaps[gid] !== undefined) {
      const held: Record<string, number> = {};
      for (const bk of live) {
        if (bk.ref === b.ref || typeof bk.age !== "number" || ageCapGroup({ age: bk.age }, groups) !== gid) continue;
        for (const day of bk.days ?? runDates) held[day] = (held[day] ?? 0) + 1;
      }
      const full = passFullDay(ageCaps[gid], held, want);
      if (full) return `${groups.find((g) => g.id === gid)?.name || "That age group"} is full on ${full}`;
    }
  }
  return null;
}
