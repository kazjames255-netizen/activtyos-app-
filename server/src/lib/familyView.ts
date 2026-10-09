import { refundAwaitingTransfer } from "../../../features/bookings/helpers";
import { withMoney } from "../../../features/bookings/walletBreakdown";
import type { Booking } from "../../../features/bookings/types";

/** What a FAMILY gets of its own booking's refund bookkeeping (My bookings, Payments, and the data export). The refund amount and status (cancel, refundLog, pay) are theirs; the provider's internals
 *  are not: the entries behind each refund (the cash / wallet split, how it was sent, approver times) and the running wallet-refund total. The one
 *  thing the family's Payments page needs from the entries - "the provider has recorded this refund but not sent it yet" - travels as a plain flag. */
export function familyBooking<T extends Partial<Booking>>(b: T): T {
  const { refundEntries: _entries, walletRefunded: _wallet, reconNotes: _notes, reconciledBy: _rb, stripeAccount: _sa, ...rest } = b as Record<string, unknown> & T;
  void _entries; void _wallet; void _notes; void _rb; void _sa;
  const out: Record<string, unknown> = { ...rest, refundAwaiting: refundAwaitingTransfer(b as never) };
  // The cancellation record keeps the amount, the status and where the money goes; the provider's cash split and who handled it stay with the provider.
  if (out.cancel && typeof out.cancel === "object") {
    const { refundCash: _c, refundSentBy: _by, refundRecordedAt: _at, ...cancel } = out.cancel as Record<string, unknown>;
    void _c; void _by; void _at;
    out.cancel = cancel;
  }
  // The wallet breakdown is worked out from the FULL record (walletRefunded is the provider's bookkeeping, but how much of the wallet part can still go back is the family's own figure).
  const money = withMoney(b).money;
  return (money ? { ...out, money } : out) as unknown as T;
}
