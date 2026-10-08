import { addonLineOnDay, type KidState } from "../../../features/bookings/addons";

// PURE roster / register / occupancy rules (extracted from routes, behaviour unchanged). Each one exists because of a real bug: see tests/regression/.

/** Team members who left (account switched off) must not count as ratio cover or be listed to parents. */
export const withoutLeavers = (staffIds: string[], leavers: Set<string>): string[] => staffIds.filter((x) => !leavers.has(x));

export interface AddonLineLite { child: string; label: string; price: number; perDay?: boolean; days?: string[] }

/** This child's extras for THIS day only: a sibling's T-shirt, or a lunch bought for other days, must not show against them. A per-day extra shows on
 *  each of its days; a ONE-OFF extra (a T-shirt) shows once, on the child's first day (the same rule as Add-on orders: addonLineOnDay).
 *  Older bookings carry no per-child lines: they fall back to the plain list. `ctx` carries what the booking says about its own days and the child.
 *  `withPrice` false (staff) leaves the price off every line. */
export function childExtrasForDay(lines: AddonLineLite[] | undefined, fallback: string[] | undefined, childName: string, date: string, ctx: { bookingDays?: string[]; kid?: KidState } = {}, withPrice = true): string[] {
  if (!lines) return withPrice ? fallback ?? [] : (fallback ?? []).map(withoutPriceText);
  return lines
    .filter((l) => l.child.trim() === childName.trim() && addonLineOnDay(l, ctx.bookingDays, date, ctx.kid))
    .map((l) => (withPrice ? `${l.label} — £${l.price.toFixed(2)}` : l.label));
}

/** "Water bottle × 7 (Colour: Blue) — £21.00" -> "Water bottle × 7 (Colour: Blue)". */
export const withoutPriceText = (s: string): string => s.replace(/\s+[—-]\s+£\s?[\d.,]+\s*$/, "");

/** The add-on catalogue as staff may read it: names, options and questions, no price anywhere inside an add-on. */
export function stripAddonCatalogPrices<T extends { addons?: unknown }>(lib: T): T {
  const clean = (v: unknown): unknown => Array.isArray(v) ? v.map(clean)
    : v && typeof v === "object" ? Object.fromEntries(Object.entries(v).filter(([k]) => !/price|cost|amount/i.test(k)).map(([k, x]) => [k, clean(x)])) : v;
  return Array.isArray(lib.addons) ? { ...lib, addons: clean(lib.addons) } : lib;
}

/** What a STAFF token gets of a booking's add-ons: the choices, quantities and answers, never a price. The one place that removes add-on money
 *  for staff: the booking, the booking list and the register all use it. Owner / franchise / freelancer views do not call it. */
export function stripAddonMoney<T extends Record<string, unknown>>(b: T): T {
  const out: Record<string, unknown> = { ...b };
  if (Array.isArray(out.addons)) out.addons = (out.addons as unknown[]).map((x) => (typeof x === "string" ? withoutPriceText(x) : x));
  if (Array.isArray(out.addonLines)) out.addonLines = (out.addonLines as Record<string, unknown>[]).map(({ price: _p, ...rest }) => rest);
  if (Array.isArray(out.addonRequests)) {
    out.addonRequests = (out.addonRequests as Record<string, unknown>[]).map((r) => {
      const keep: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(r)) if (!/price|amount|money|diff|refund|wallet/i.test(k)) keep[k] = v;
      return keep;
    });
  }
  return out as T;
}

/** Open capacity / booked for the dashboard's "Spaces left" tile. A PER-DAY limit applies to EACH remaining day against the children booked
 *  that day; adding the daily limit once per run to all child-days booked made a busy per-day listing look over-full. */
export function openOccupancy(scope: string | undefined, run: { capacity: number; bookedCount: number }, future: { capacity: number; bookedCount: number }[]): { capacity: number; booked: number } {
  if (scope === "day") return future.reduce((a, s) => ({ capacity: a.capacity + s.capacity, booked: a.booked + s.bookedCount }), { capacity: 0, booked: 0 });
  return { capacity: run.capacity, booked: run.bookedCount };
}
