import { isTfcMethod } from "./payMethods";
import { ukToday } from "./ukDate";
import type { Booking } from "../../../features/bookings/types";

const round2 = (n: number) => Math.round(n * 100) / 100;

// Refund dates come in two shapes: ISO, or the en-GB "13/09/2026, 10:30"
// that nowStr() writes. Anything else is left undated rather than guessed.
function refundDay(v?: string | null): string | null {
  if (!v) return null;
  if (/^\d{4}-\d{2}-\d{2}T/.test(v)) { const t = new Date(v); return Number.isNaN(t.getTime()) ? null : ukToday(t); }
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(v);
  return m ? `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}` : null;
}
export type RefundRow = {
  ref: string; booker: string; listing: string; listingId: string | null; method: string;
  /** Where the money went: "card", "wallet", "offline" (paid back by hand), or
   *  null when the booking doesn't say (a provider-recorded day refund). */
  via: "card" | "wallet" | "offline" | null;
  kind: "cancellation" | "released";
  label: string; amount: number; date: string | null;
};
export function refundsOf(b: Booking): RefundRow[] {
  const base = { ref: b.ref, booker: b.booker, listing: b.listing, listingId: b.listingId ?? null, method: b.voucherScheme && !isTfcMethod(b.voucherScheme) ? `Voucher · ${b.voucherScheme}` : b.method };
  const out: RefundRow[] = [];
  // An APPROVED cancellation refund — refundedApproved is what actually moved
  // (older bookings predate it: fall back to the approved cancel amount).
  const c = b.cancel;
  const approved = b.refundedApproved ?? (c?.refund === "approved" ? c.amount ?? 0 : 0);
  // Approving a whole-booking refund ALSO writes a "Refund approved" refundLog
  // line for the same money (bookings.ts), so the log is the source of truth
  // and the cancellation row is only a fallback for older bookings with no
  // such line. Separate partial releases are still their own rows.
  const approvalLogged = (b.refundLog ?? []).some((e) => /^refund approved/i.test(e.label || "") && e.amount > 0);
  if (approved > 0 && !approvalLogged) out.push({ ...base, via: c?.refundVia ?? null, kind: "cancellation", label: c?.refundOnly ? "Refund" : "Cancellation refund", amount: round2(approved), date: refundDay(c?.refundedAt) ?? refundDay(c?.on) });
  // Released days / children — each logged with its own date.
  for (const e of b.refundLog ?? []) {
    if (!(e.amount > 0)) continue;
    out.push({ ...base, via: /wallet/i.test(`${e.source ?? ""} ${e.label ?? ""}`) ? "wallet" : /^offline$/i.test(e.source ?? "") ? "offline" : /^card$/i.test(e.source ?? "") ? "card" : null, kind: "released", label: e.label || "Refund", amount: round2(e.amount), date: refundDay(e.on) });
  }
  return out;
}
