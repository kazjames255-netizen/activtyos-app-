// ONE rule for where a refund goes when the booking was paid from several SOURCES (wallet credit, card, cash / bank / voucher): PROPORTIONAL to what each
// source paid that has not yet been given back. £100 paid = wallet £30 + card £70, a £50 refund => £15 back to the wallet + £35 to the card. The policy
// (or the provider's own figure) decides the TOTAL; this only splits it. Pure: no database, no browser, shared by the server and the screens' previews.
import type { Booking } from "./types";
import { cashReceivedOf, refundableSoFar } from "./helpers";

const round2 = (n: number) => Math.round(n * 100) / 100;

/** The part of a refund `owed` that goes back to the WALLET: its share of the money still refundable (`pool`) that the wallet paid (`walletLeft`).
 *  Never more than the wallet still holds of this booking or than the refund itself; a refund of the whole pool returns the whole wallet part exactly. */
export function walletShareOfRefund(owed: number, walletLeft: number, pool: number): number {
  const w = Math.min(Math.max(0, walletLeft), Math.max(0, pool));
  const o = Math.max(0, owed);
  if (w <= 0 || o <= 0 || pool <= 0) return 0;
  if (o >= pool - 0.005) return round2(Math.min(w, o));
  return round2(Math.min(w, o, (o * w) / pool));
}

/** What each SOURCE still really holds of this booking, never the price: the wallet credit not yet returned, and the cash received not yet refunded
 *  (`cashHeld` once a cancellation has settled the pay label, else the cash received). `pool` is the money a refund can be split over: at most refundableSoFar,
 *  at most the two sources together. A part-paid booking (wallet 30 + cash 20, 50 unpaid) has a pool of 50, not the 100 the pay label implies after a cancel. */
export function refundPoolOf(b: Booking): { pool: number; wallet: number; cash: number } {
  const wallet = Math.max(0, (b.walletApplied ?? 0) - (b.walletRefunded ?? 0));
  const logged = (b.refundLog || []).reduce((t, x) => t + (/^refund approved/i.test(x.label || "") ? 0 : x.amount || 0), 0);
  const given = logged + Math.max(0, b.refundedApproved ?? 0);
  const cashIn = b.cashHeld != null ? b.cashHeld : cashReceivedOf(b);
  const cash = Math.max(0, cashIn - Math.max(0, given - (b.walletRefunded ?? 0)));
  const pool = round2(Math.min(refundableSoFar(b), wallet + cash));
  return { pool, wallet: round2(Math.min(wallet, pool)), cash: round2(Math.max(0, pool - Math.min(wallet, pool))) };
}

/** Wallet credit this booking paid that has not been returned to the wallet yet (never more than what is still refundable). */
export function walletLeftOf(b: Pick<Booking, "walletApplied" | "walletRefunded">, pool: number): number {
  return round2(Math.min(Math.max(0, (b.walletApplied ?? 0) - (b.walletRefunded ?? 0)), Math.max(0, pool)));
}

/** The wallet share of a refund `owed` on this booking right now (the same figure the approval will credit, and a preview shows). */
export function walletShareFor(b: Booking, owed: number): number {
  const p = refundPoolOf(b);
  return walletShareOfRefund(owed, p.wallet, p.pool);
}

/** Wallet first, then card vs offline between the rest, all proportional to what each still holds. The card share is capped at what the card can still
 *  return; anything beyond what the sources hold (should not happen) is owed back offline. The three parts always add up to `owed` to the penny. */
export function splitRefundBySource(owed: number, left: { wallet: number; card: number; offline: number }): { wallet: number; card: number; offline: number } {
  const wallet = Math.max(0, left.wallet), card = Math.max(0, left.card), offline = Math.max(0, left.offline);
  const pool = wallet + card + offline;
  const o = Math.max(0, round2(owed));
  const w = walletShareOfRefund(o, wallet, pool);
  const rest = round2(o - w);
  const cashPool = card + offline;
  const c = cashPool <= 0 ? 0 : Math.min(card, round2((rest * card) / cashPool));
  return { wallet: w, card: c, offline: round2(rest - c) };
}

/** A refund the family RESOLVED as wallet credit is instant and wholly wallet credit - but part of the money it hands back was wallet money in the first
 *  place. Keep the books of what the wallet has already got back (`walletRefunded`) in step, so a LATER refund of the same booking splits proportionally
 *  over what is really left of each source. Call after the credit's refund-log line is on the booking. */
export function noteInstantWalletCredit(b: Booking, credited: number): void {
  if (!((b.walletApplied ?? 0) > 0) || !(credited > 0)) return;
  const p = refundPoolOf(b);
  const share = walletShareOfRefund(credited, Math.min(Math.max(0, (b.walletApplied ?? 0) - (b.walletRefunded ?? 0)), p.pool + credited), round2(p.pool + credited));
  if (share > 0) b.walletRefunded = round2((b.walletRefunded ?? 0) + share);
}
