// Finance Insights > Add-ons: what was sold, from the bookings in the window. One plain function so the screen and the tests read the same maths.
import type { Booking } from "../bookings/types"; // relative: the tests (and the API) load this file without the "@/" alias
import { addonUnits, bookingAddonLines } from "../bookings/addons";

export interface AddonAgg { count: number; rev: number }
export interface AddonFigures { bookingsWithAddon: number; addonUnits: number; addonRevenue: number; byName: Map<string, AddonAgg> }

/**
 * Counted by UNITS, not by lines: a daily add-on counts each of its days (a water bottle for 7 days is 7 units), a one-off counts its quantity.
 * Revenue is the amount actually charged on the line. Several references of one checkout (a week over a Monday) add up to the same figures as one booking.
 */
export function addonFigures(bookings: Booking[]): AddonFigures {
  const byName = new Map<string, AddonAgg>();
  let bookingsWithAddon = 0, units = 0, revenue = 0;
  for (const b of bookings) {
    const lines = bookingAddonLines(b);
    if (lines.length) bookingsWithAddon++;
    for (const l of lines) {
      const n = addonUnits(l, b.days);
      const cur = byName.get(l.name) ?? { count: 0, rev: 0 };
      cur.count += n; cur.rev += l.price; byName.set(l.name, cur);
      units += n; revenue += l.price;
    }
  }
  return { bookingsWithAddon, addonUnits: units, addonRevenue: Math.round(revenue * 100) / 100, byName };
}
