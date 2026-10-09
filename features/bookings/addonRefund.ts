// The add-on refund state is STORED on the booking's lines at cancel / refund time, so every display (Add-on orders, register, bell, split-follow, Finance)
// reads one fact instead of guessing from the (overwritable) cancel record.
//   line.refunded      true  = this extra went back with a refund;  false = it was kept (paid for / owed). Absent on bookings made before this existed.
//   line.refundedDays  per-day extras: the days whose share went back.
// "Refunded" is sticky: a later cancel with another refund (or none) never un-refunds. "Kept" (false) is only written where nothing was stored, and a later
// refund can upgrade it to true.
import type { Booking, CancelInfo } from "./types";
import { addonLineKey } from "./addons";

export type RefundScope = { scope: "whole" } | { scope: "child"; child: string } | { scope: "day"; child: string; date: string };

/** `pending`: the refund this stamp belongs to, while it still waits for the provider (its cancel record). The first thing found on each line is
 *  remembered there; DECLINING that refund moves no money, so `undoAddonStamps` puts the lines back. Pass nothing for an instant move (wallet credit). */
export function stampAddonRefund(b: Pick<Booking, "addonLines">, where: RefundScope, refunded: boolean, pending?: CancelInfo | null): void {
  for (const l of b.addonLines ?? []) {
    if (where.scope !== "whole" && l.child.trim() !== where.child.trim()) continue;
    if (pending) {
      const key = addonLineKey(l.child, l.label);
      pending.addonUndo = pending.addonUndo ?? [];
      if (!pending.addonUndo.some((u) => u.key === key)) pending.addonUndo.push({ key, refunded: l.refunded ?? null, refundedDays: l.refundedDays ?? null });
    }
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

/** A refund was DECLINED: nothing went back, so every "refunded" mark that refund put on a line goes back to what it was before (a mark put there by
 *  another, really approved or sent, refund was already on the line when this one looked, so it stays). */
export function undoAddonStamps(b: Pick<Booking, "addonLines" | "cancel">): void {
  const undo = b.cancel?.addonUndo;
  if (!undo?.length) return;
  for (const u of undo) {
    const l = (b.addonLines ?? []).find((x) => addonLineKey(x.child, x.label) === u.key);
    if (!l) continue;
    if (u.refunded === null) delete l.refunded; else l.refunded = u.refunded;
    if (u.refundedDays === null) delete l.refundedDays; else l.refundedDays = u.refundedDays;
  }
  if (b.cancel) delete b.cancel.addonUndo;
}

/** A refund as big as the WHOLE booking: its cash price plus the wallet credit spent on it (a "partial" refund of that size is a full refund in all but name). */
export function refundCoversWhole(amount: number, b: Pick<Booking, "amount" | "walletApplied" | "walletRelieved">): boolean {
  const gross = (b.amount ?? 0) + Math.max(0, (b.walletApplied ?? 0) - (b.walletRelieved ?? 0));
  return amount > 0.004 && gross > 0.004 && amount >= gross - 0.004;
}

/** THE rule for whether the add-ons go back with a cancellation refund, shared by the operator cancel / cancel-child / cancel-day and the parent routes.
 *  `grossBefore` is the booking's cash price plus wallet spent on it BEFORE the action took its share off; `refundedAmount` the money that moves.
 *  The provider's own YES / NO (`refundsAddons`) always wins; nothing moving means nothing goes back. */
export function addonsGoBack(p: {
  kind: "cancel" | "cancel-child" | "cancel-day" | "parent-cancel";
  moved: boolean; grossBefore: number; refundedAmount: number;
  refund?: "full" | "partial" | "none" | "pending"; explicitAmount?: number; refundsAddons?: boolean; lastDay?: boolean;
}): boolean {
  if (!p.moved) return false;
  if (p.refundsAddons !== undefined) return p.refundsAddons;
  const covers = refundCoversWhole(p.refundedAmount, { amount: p.grossBefore });
  if (p.kind === "cancel" || p.kind === "parent-cancel") return p.refund === "full" || (p.refund === "partial" && covers);
  if (p.kind === "cancel-child") return p.explicitAmount === undefined || covers;
  return !!p.lastDay && covers; // cancel-day
}
