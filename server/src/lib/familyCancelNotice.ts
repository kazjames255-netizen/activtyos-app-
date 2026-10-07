// "Your booking is cancelled": the ONE notice a family gets when a booking flips to Cancelled — a tiny bell line plus the
// full email (child, dates, and in one sentence what happens to the money). Callers invoke it only on the transition
// (old status was not Cancelled), which is what makes it once-per-cancellation: repeat cancel calls are rejected upstream.
// A family leaving a waiting list or turning down an offered place never held a booking, so they are not sent this.
import type { Booking } from "../../../features/bookings/types";
import { refundableSoFar } from "../../../features/bookings/helpers";
import { db } from "../firebase";
import { notify } from "./notify";
import { emailBookingCancelled } from "./emails";
import { bookingCancelledSpec } from "./emailTemplates";

export function notifyFamilyCancelled(updated: Booking, providerName: string, by: "provider" | "family"): void {
  if (!updated.email?.includes("@") || !updated.tenantId) return;
  const spec = bookingCancelledSpec(updated, providerName, { by, paid: refundableSoFar(updated) });
  emailBookingCancelled(updated, providerName, spec);
  void notify({
    tenantId: updated.tenantId,
    to: { kind: "parent", email: updated.email },
    category: "booking",
    bellOnly: true, // the email above is the mail
    title: spec.bell.title,
    body: spec.bell.body,
    href: `/custdash/bookings?open=${encodeURIComponent(updated.ref)}`,
    ref: updated.ref,
  });
}

/** The provider's name as the family knows it, then the notice. */
export async function notifyFamilyCancelledFor(updated: Booking, by: "provider" | "family"): Promise<void> {
  let name = "Your activity provider";
  try {
    if (updated.tenantId) {
      const t = await db.collection("tenants").doc(updated.tenantId).get();
      if (t.exists) name = ((t.data()!.name as string) ?? name) || name;
    }
  } catch { /* the notice is worth sending under the generic name */ }
  notifyFamilyCancelled(updated, name, by);
}
