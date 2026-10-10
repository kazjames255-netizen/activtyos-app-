// Finance Insights > Add-ons: what was sold, from the bookings in the window. One plain function so the screen and the tests read the same maths.
import type { Booking } from "../bookings/types"; // relative: the tests (and the API) load this file without the "@/" alias
import { paidSoFar } from "../bookings/helpers";
import { addonRefunded, addonUnits, bookingAddonLines, groupCheckouts, inheritSplitOneOffs } from "../bookings/addons";

/**
 * SOLD rule (Finance add-on figures): a booking's add-ons are sold when the booking is not cancelled, OR it is cancelled but money was actually
 * kept (something was paid; the per-line refund test in addonFigures still removes any extra that went back). A cancelled booking that was never
 * paid (cancelled with no refund, or a partial where no money moved) sold nothing. Offered / Waitlisted / Declined places are never sales.
 * Exception (addonFigures): a one-off extra stored on a cancelled reference of a SPLIT checkout that a live sibling inherited is still sold (counted once).
 */
export function addonsSold(b: Pick<Booking, "status" | "pay" | "amount" | "amountPaid" | "walletApplied">): boolean {
  if (b.status === "Offered" || b.status === "Waitlisted" || b.status === "Declined") return false;
  if (b.status === "Cancelled") return paidSoFar(b) > 0.004;
  return true;
}

export interface AddonAgg { count: number; rev: number }
export interface AddonFigures { /** checkouts with a sold add-on (a split checkout counts once) */ bookingsWithAddon: number; /** checkouts that count as sold (addonsSold), the attach-rate denominator: same population as bookingsWithAddon */ soldBookings: number; addonUnits: number; addonRevenue: number; byName: Map<string, AddonAgg> }

/**
 * Counted by UNITS, not by lines: a daily add-on counts each of its days (a water bottle for 7 days is 7 units), a one-off counts its quantity.
 * Revenue is the amount actually charged on the line. Several references of one checkout (a week over a Monday) add up to the same figures as one booking.
 */
export function addonFigures(bookings: Booking[]): AddonFigures {
  const byName = new Map<string, AddonAgg>();
  let bookingsWithAddon = 0, units = 0, revenue = 0;
  const moved = inheritSplitOneOffs(bookings as never);
  // One checkout = one booking for the attach rate: its references (a week over a Monday) share one key; an unstamped single is its own.
  const keyOf = new Map<string, string>();
  groupCheckouts(bookings as never[]).forEach((g, i) => { if (g.length > 1) for (const x of g) keyOf.set((x as { ref: string }).ref, `g${i}`); });
  const idx = new Map<Booking, number>(bookings.map((b, i) => [b, i]));
  const key = (b: Booking) => keyOf.get(b.ref) ?? `r:${b.ref ?? ""}#${idx.get(b)}`;
  const sold = new Set<string>(), withAddon = new Set<string>();
  for (const b0 of bookings) {
    // Not sales: a place only OFFERED off the waiting list (not accepted yet), a waitlisted or declined one, or a cancelled booking nobody paid for.
    let b = b0;
    if (addonsSold(b0)) sold.add(key(b0));
    else {
      // ...except a one-off extra that moved to a live sibling of the same checkout (the T-shirt's price stays on the cancelled first reference).
      const kept = moved.get(b0.ref);
      const src = (b0 as { addonLines?: unknown[] }).addonLines ?? [];
      const followed = b0.status === "Cancelled" && kept ? src.filter((l) => !kept.includes(l as never)) : [];
      if (!followed.length) continue;
      b = { ...b0, addonLines: followed } as never;
    }
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
    if (any) withAddon.add(key(b0));
  }
  bookingsWithAddon = withAddon.size;
  return { bookingsWithAddon, soldBookings: sold.size, addonUnits: units, addonRevenue: Math.round(revenue * 100) / 100, byName };
}
