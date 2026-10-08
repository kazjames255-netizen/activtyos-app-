import { refundAwaitingTransfer } from "../../../features/bookings/helpers";
import type { Booking } from "../../../features/bookings/types";

/** What a FAMILY gets of its own booking's refund bookkeeping. The refund amount and status (cancel, refundLog, pay) are theirs; the provider's internals
 *  are not: the entries behind each refund (the cash / wallet split, how it was sent, approver times) and the running wallet-refund total. The one
 *  thing the family's Payments page needs from the entries - "the provider has recorded this refund but not sent it yet" - travels as a plain flag. */
export function familyBooking<T extends Partial<Booking>>(b: T): T {
  const { refundEntries: _entries, walletRefunded: _wallet, ...rest } = b as Record<string, unknown> & T;
  void _entries; void _wallet;
  return { ...rest, refundAwaiting: refundAwaitingTransfer(b as never) } as unknown as T;
}
