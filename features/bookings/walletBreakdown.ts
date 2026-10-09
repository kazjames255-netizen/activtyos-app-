// The ONE place a booking's money is split into "price / paid by wallet / still to pay". `amount` on a booking is the cash due NET of store credit
// (gross = amount + walletApplied - walletRelieved, the same rule releaseMoney and the refund code use), so a screen that shows `amount` as "Total"
// hides the wallet payment. The server calls this and sends the result as `money` on every booking it returns to the provider or the family;
// screens only DISPLAY it. Pure: no database, no browser. Display only - no Finance figure reads this.
import type { Booking } from "./types";
import { refundPoolOf } from "./refundSplit";

const round2 = (n: number) => Math.round(n * 100) / 100;

export interface PaidBy { kind: "wallet" | "cash"; amount: number; /** The stored method for the cash part ("Card", "Cash on the day"...). */ method?: string }
export interface MoneyBreakdown {
  /** The whole price: cash due + wallet spent on it (less any wallet part no longer owed for). */
  gross: number;
  /** Wallet credit that is still part of this booking's price. */
  walletApplied: number;
  /** Cash (card / bank / cash) already received. */
  cashPaid: number;
  /** Still to pay: gross less wallet less cash received. Never below 0. */
  due: number;
  /** Where the money that has come in came from. */
  paidBy: PaidBy[];
  /** The payment status to SHOW when wallet credit changes it (Unpaid + wallet = Partially paid, nothing left = Paid); null = show the stored one. */
  pay: "Paid" | "Partially paid" | null;
  /** True when the wallet covers the whole price. */
  paidInFullByWallet: boolean;
  /** Wallet credit this booking paid that has not gone back to the wallet yet (the wallet's share when a refund is split, see refundSplit.ts). */
  walletBack: number;
}

type Src = Pick<Booking, "amount" | "walletApplied" | "walletRelieved" | "amountPaid" | "pay" | "method" | "status"> & Partial<Pick<Booking, "walletRefunded" | "refundLog" | "refundedApproved" | "cashHeld">>;

export function moneyBreakdown(b: Src): MoneyBreakdown {
  const amount = Math.max(0, Number(b.amount) || 0);
  const wallet = round2(Math.max(0, (Number(b.walletApplied) || 0) - (Number(b.walletRelieved) || 0)));
  const gross = round2(amount + wallet);
  const stored = Number(b.amountPaid);
  const paidField = Number.isFinite(stored) ? Math.max(0, stored) : 0;
  const settled = b.pay === "Paid" || b.pay === "Refund pending" || b.pay === "Refunded" || b.pay === "Partially refunded";
  // Cash that came in, never more than the cash part of the price.
  const cashPaid = round2(Math.min(amount, settled ? Math.max(amount, paidField) : paidField));
  const due = round2(Math.max(0, amount - cashPaid));
  const paidBy: PaidBy[] = [];
  if (wallet > 0) paidBy.push({ kind: "wallet", amount: wallet });
  if (cashPaid > 0) paidBy.push({ kind: "cash", amount: cashPaid, ...(b.method ? { method: b.method } : {}) });
  const open = b.status !== "Cancelled" && b.status !== "Declined";
  // "Funded" is what a £0 cash due is stored as: when wallet credit paid the price that reads "Funded £0" (as if a grant paid it), so show Paid.
  const unpaidLabel = !b.pay || b.pay === "Unpaid" || b.pay === "Invoice sent" || b.pay === "Partially paid" || b.pay === "Funded";
  let pay: MoneyBreakdown["pay"] = null;
  if (wallet > 0 && open && unpaidLabel) pay = due <= 0.005 ? "Paid" : "Partially paid";
  return { gross, walletApplied: wallet, cashPaid, due, paidBy, pay, paidInFullByWallet: wallet > 0 && due <= 0.005 && cashPaid <= 0.005, walletBack: refundPoolOf(b as Booking).wallet };
}

/** Attach `money` to a booking only when there is a wallet part to explain (every other booking is sent exactly as before). */
export function withMoney<T extends Partial<Booking>>(b: T): T & { money?: MoneyBreakdown } {
  if (!((Number(b.walletApplied) || 0) > 0)) return b;
  return { ...b, money: moneyBreakdown(b as Src) };
}
