// Finance Insights > Add-ons: what was sold, from the bookings in the window. One plain function so the screen and the tests read the same maths.
import type { Booking } from "@/features/bookings/types";

export interface AddonAgg { count: number; rev: number }
export interface AddonFigures { bookingsWithAddon: number; addonUnits: number; addonRevenue: number; byName: Map<string, AddonAgg> }

/** Each booking carries its extras as text ("Hot lunch × 5 — £25.00"): read the name and the amount actually charged from it. */
export function addonFigures(bookings: Booking[]): AddonFigures {
  const byName = new Map<string, AddonAgg>();
  let bookingsWithAddon = 0, addonUnits = 0, addonRevenue = 0;
  for (const b of bookings) {
    const ad = b.addons ?? [];
    if (ad.length) bookingsWithAddon++;
    for (const line of ad) {
      const m = /^(.*?)\s+—\s+£([\d,]+(?:\.\d+)?)$/.exec(line.trim());
      const nm = (m ? m[1] : line).replace(/\s+×\s+\d+.*$/, "").replace(/\s+\(.*\)$/, "").replace(/^🍽\s*/, "").trim() || line;
      const amt = m ? parseFloat(m[2].replace(/,/g, "")) : 0;
      const cur = byName.get(nm) ?? { count: 0, rev: 0 };
      cur.count++; cur.rev += amt; byName.set(nm, cur);
      addonUnits++; addonRevenue += amt;
    }
  }
  return { bookingsWithAddon, addonUnits, addonRevenue, byName };
}
