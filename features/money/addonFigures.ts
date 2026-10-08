// Finance Insights > Add-ons: what was sold, from the bookings in the window. One plain function so the screen and the tests read the same maths.
import type { Booking } from "../bookings/types"; // relative: the tests (and the API) load this file without the "@/" alias
import { addonRefunded, addonUnits, bookingAddonLines } from "../bookings/addons";

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
    // Not sales: a place only OFFERED off the waiting list (not accepted yet), a waitlisted, declined or cancelled booking.
    if (b.status === "Offered" || b.status === "Waitlisted" || b.status === "Declined") continue;
    const lines = bookingAddonLines(b);
    let any = false;
    for (const l of lines) {
      // The same rule as Add-on orders: an extra that went back with a refund is not sold; one KEPT (paid for, even on a cancelled booking) is.
      if (addonRefunded(b as never, l)) continue;
      any = true;
      const n = addonUnits(l, b.days);
      const cur = byName.get(l.name) ?? { count: 0, rev: 0 };
      cur.count += n; cur.rev += l.price; byName.set(l.name, cur);
      // a per-day extra with some days refunded keeps the share of the days still sold
      const full = l.perDay && !l.meal && l.refundedDays?.length ? l.days.length : 0;
      units += n; revenue += full ? (l.price * n) / full : l.price;
    }
    if (any) bookingsWithAddon++;
  }
  return { bookingsWithAddon, addonUnits: units, addonRevenue: Math.round(revenue * 100) / 100, byName };
}
