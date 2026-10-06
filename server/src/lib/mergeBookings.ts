import type { Booking } from "../../../features/bookings/types";

const round2 = (n: number) => Math.round(n * 100) / 100;
const uniq = <T,>(xs: T[]) => [...new Set(xs)];

/** One checkout/payment can create or settle several bookings (one per week). Emails and bells describe the WHOLE
 *  thing: the first booking carries the summed amount, every child, every date and the list of refs. */
export function mergeBookings(all: Booking[]): { merged: Booking; refs: string[] } {
  const b = all[0];
  if (all.length === 1) return { merged: b, refs: [b.ref] };
  const merged: Booking = {
    ...b,
    amount: round2(all.reduce((s, x) => s + (x.amount ?? 0), 0)),
    pass: uniq(all.map((x) => x.pass).filter(Boolean)).join(" · "),
    sessions: uniq(all.flatMap((x) => x.sessions ?? [])),
    child: uniq(all.map((x) => x.child).filter(Boolean)).join(", "),
    kids: all.some((x) => x.kids?.length) ? all.flatMap((x) => x.kids ?? []).filter((k, i, a) => a.findIndex((y) => y.name === k.name) === i) : b.kids,
    ...(all.some((x) => x.listPrice != null) ? { listPrice: round2(all.reduce((s, x) => s + (x.listPrice ?? x.amount ?? 0), 0)) } : {}),
    discountOff: round2(all.reduce((s, x) => s + (x.discountOff ?? 0), 0)),
    discountNames: uniq(all.flatMap((x) => x.discountNames ?? [])),
    addons: all.flatMap((x) => x.addons ?? []),
    addonLines: all.flatMap((x) => x.addonLines ?? []),
  };
  return { merged, refs: all.map((x) => x.ref) };
}
