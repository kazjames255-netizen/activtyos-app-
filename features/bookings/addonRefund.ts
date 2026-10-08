// The add-on refund state is STORED on the booking's lines at cancel / refund time, so every display (Add-on orders, register, bell, split-follow, Finance)
// reads one fact instead of guessing from the (overwritable) cancel record.
//   line.refunded      true  = this extra went back with a refund;  false = it was kept (paid for / owed). Absent on bookings made before this existed.
//   line.refundedDays  per-day extras: the days whose share went back.
// "Refunded" is sticky: a later cancel with another refund (or none) never un-refunds. "Kept" (false) is only written where nothing was stored, and a later
// refund can upgrade it to true.
import type { Booking } from "./types";

export type RefundScope = { scope: "whole" } | { scope: "child"; child: string } | { scope: "day"; child: string; date: string };

export function stampAddonRefund(b: Pick<Booking, "addonLines">, where: RefundScope, refunded: boolean): void {
  for (const l of b.addonLines ?? []) {
    if (where.scope !== "whole" && l.child.trim() !== where.child.trim()) continue;
    if (where.scope === "day") {
      if (l.perDay && !l.meal) {
        if (refunded && l.days.includes(where.date)) l.refundedDays = [...new Set([...(l.refundedDays ?? []), where.date])].sort();
      } else if (refunded) l.refunded = true;
      else if (l.refunded === undefined) l.refunded = false;
      continue;
    }
    if (refunded) {
      l.refunded = true;
      if (l.perDay && !l.meal) l.refundedDays = [...new Set([...(l.refundedDays ?? []), ...l.days])].sort();
    } else if (l.refunded === undefined) l.refunded = false;
  }
}
