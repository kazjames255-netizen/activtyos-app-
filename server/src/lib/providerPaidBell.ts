import type { Booking } from "../../../features/bookings/types";
import { bellTitle, bellBody, bellMoney } from "./bellText";

/** The provider's bell when a family's card payment lands: 'Paid ✓ · APF-10330 · <booker>' (the booking bell raised at checkout only said it was waiting). */
export function providerPaidBell(group: Pick<Booking, "ref" | "listing" | "booker" | "amount" | "child" | "kids">[], confirmedNow: boolean): { title: string; body: string; detail: string } {
  const refs = group.map((b) => b.ref);
  const total = Math.round(group.reduce((s, b) => s + (b.amount ?? 0), 0) * 100) / 100;
  const kids = [...new Set(group.flatMap((b) => (b.kids?.length ? b.kids.map((k) => k.name) : [b.child])).filter(Boolean))].join(", ");
  return {
    // The bell: 'Paid ✓ · APF-10330' / 'Card · £0.30 · Confirmed'. The long wording is for the email.
    title: bellTitle("paid", refs),
    body: bellBody(["Card", bellMoney(total), confirmedNow ? "Confirmed" : ""]),
    detail: `${refs.join(", ")} · ${group[0].booker} · ${group[0].listing}${kids ? ` · ${kids}` : ""} — £${total.toFixed(2)} received by card${confirmedNow ? ", booking confirmed" : ""}.`,
  };
}
