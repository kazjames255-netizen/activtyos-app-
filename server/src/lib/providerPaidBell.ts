import type { Booking } from "../../../features/bookings/types";

/** The provider's bell when a family's card payment lands: 'Paid ✓ · APF-10330 · <booker>' (the booking bell raised at checkout only said it was waiting). */
export function providerPaidBell(group: Pick<Booking, "ref" | "listing" | "booker" | "amount" | "child" | "kids">[], confirmedNow: boolean): { title: string; body: string } {
  const refs = group.map((b) => b.ref).join(", ");
  const total = Math.round(group.reduce((s, b) => s + (b.amount ?? 0), 0) * 100) / 100;
  const kids = [...new Set(group.flatMap((b) => (b.kids?.length ? b.kids.map((k) => k.name) : [b.child])).filter(Boolean))].join(", ");
  return {
    title: `Paid ✓ · ${refs} · ${group[0].booker}`,
    body: `${group[0].listing}${kids ? ` · ${kids}` : ""} — £${total.toFixed(2)} received by card${confirmedNow ? ", booking confirmed" : ""}.`,
  };
}
