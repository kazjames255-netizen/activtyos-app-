import type { PayState } from "../../../lib/payErrors";

/** What the Pay screen needs to know after a card error: can this payment still go through, and if not, why. Pure (the route does the reads).
 *  `payment` is the payment record; `items` the bookings (or meal orders) it covers. */
export function payStateOf(
  payment: { status?: string; excess?: { reason?: string } },
  items: { status?: string; pay?: string }[],
): PayState {
  const st = payment.status ?? "";
  if (st === "duplicate-refunded") return "refunded";
  if (st.startsWith("duplicate") && payment.excess?.reason === "not-payable") return "refunding";
  // A withdrawn card hold can no longer take the card.
  if (st === "released") return "released";
  const ended = (i: { status?: string }) => ["cancelled", "declined"].includes(String(i.status ?? "").toLowerCase());
  if (items.some(ended)) return "cancelled";
  if (items.length && items.every((i) => i.pay === "Paid" || i.pay === "Funded")) return "paid";
  if (items.some((i) => i.pay === "Refunded" || i.pay === "Refund pending")) return "refunded";
  if (st === "succeeded" || st === "paid") return "paid";
  return "open";
}
