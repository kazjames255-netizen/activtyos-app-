// ONE place that says HOW an offline refund will reach the family. Money paid by CASH, BANK TRANSFER or VOUCHER cannot be moved by the app: the provider
// sends it by hand, so every screen, bell and email names the method actually paid ("paid in cash", "send £0.50 by bank transfer"), never a vague "the
// way you paid". A booking paid by a mix names each ("by bank transfer and cash"). Card money goes back to the card automatically and wallet money back
// to the wallet, so a booking that only has card / wallet money has NO offline wording at all.
// Pure: no database, no browser. Shared by the server (emails, bells, previews) and the screens. The words themselves live in the `rfm` i18n area; this
// file only decides WHICH kinds apply and how big each share is, to the penny.
import type { Booking } from "./types";
import { cashReceivedOf } from "./helpers";

const round2 = (n: number) => Math.round(n * 100) / 100;

export type OfflineKind = "bank" | "cash" | "voucher";
/** The fixed order a mix is named in (bank transfer, cash, voucher). */
export const OFFLINE_KINDS: readonly OfflineKind[] = ["bank", "cash", "voucher"];
export interface MethodPart { kind: OfflineKind; amount: number }

/** Which offline kind a stored payment method is, or null for card / wallet / anything the app cannot name. */
export function kindOfMethod(method?: string | null, scheme?: string | null): OfflineKind | null {
  if (scheme) return "voucher";
  const m = (method ?? "").toLowerCase();
  if (/voucher|tax.?free|\btfc\b|childcare|\bhaf\b/.test(m)) return "voucher";
  if (/bank|transfer|bacs/.test(m)) return "bank";
  if (/cash|cheque|check|offline|\bother\b/.test(m) && !/card/.test(m)) return "cash";
  return null;
}

type Src = Pick<Booking, "method" | "voucherScheme" | "amountPaid" | "pay" | "amount"> &
  Partial<Pick<Booking, "cashHeld" | "paymentIntentId" | "cardPaid" | "paidVia" | "refundEntries">>;

/** What was paid OFFLINE on this booking, by kind. Payments the provider recorded by hand carry their own method (`paidVia`); the rest of the cash received
 *  (marking a booking paid, a family's own bank transfer) is the booking's method. Money that came in by card is never offline. */
export function paidOfflineParts(b: Src): MethodPart[] {
  const cashIn = b.cashHeld != null ? b.cashHeld : cashReceivedOf(b as Booking);
  const stamped: Partial<Record<OfflineKind, number>> = {};
  let stampedSum = 0;
  for (const k of OFFLINE_KINDS) {
    const v = Math.max(0, Number(b.paidVia?.[k]) || 0);
    if (v > 0) { stamped[k] = v; stampedSum += v; }
  }
  // A booking with a Stripe payment: whatever cash is not accounted for by hand-recorded payments or by an explicit card total came in by card.
  const hasCard = !!b.paymentIntentId || (b.cardPaid ?? 0) > 0;
  const card = hasCard ? ((b.cardPaid ?? 0) > 0 ? Math.max(0, b.cardPaid ?? 0) : Math.max(0, cashIn - stampedSum)) : 0;
  const rest = Math.max(0, cashIn - stampedSum - card);
  const own = kindOfMethod(b.method, b.voucherScheme);
  if (own && rest > 0.004) stamped[own] = (stamped[own] ?? 0) + rest;
  return OFFLINE_KINDS.filter((k) => (stamped[k] ?? 0) > 0.004).map((k) => ({ kind: k, amount: round2(stamped[k] ?? 0) }));
}

/** `amount` shared over `parts` PROPORTIONALLY, to the penny: the shares always add up to `amount` (the largest remainders take the odd pennies). */
export function splitOverParts(amount: number, parts: readonly MethodPart[]): MethodPart[] {
  const total = parts.reduce((n, p) => n + Math.max(0, p.amount), 0);
  const cents = Math.max(0, Math.round(amount * 100));
  if (!parts.length || total <= 0 || cents <= 0) return [];
  const raw = parts.map((p) => (cents * Math.max(0, p.amount)) / total);
  const floor = raw.map((x) => Math.floor(x));
  let left = cents - floor.reduce((n, x) => n + x, 0);
  const order = raw.map((x, i) => ({ i, frac: x - Math.floor(x) })).sort((a, b) => b.frac - a.frac || a.i - b.i);
  for (const o of order) { if (left <= 0) break; floor[o.i] += 1; left -= 1; }
  return parts.map((p, i) => ({ kind: p.kind, amount: floor[i] / 100 })).filter((p) => p.amount > 0);
}

export interface RefundMethodInfo {
  /** The offline kinds the booking was paid by, in naming order. Empty = nothing offline (card / wallet only): no offline wording at all. */
  kinds: OfflineKind[];
  /** What was paid by each kind. */
  parts: MethodPart[];
  /** Paid by more than one offline kind. */
  mixed: boolean;
  /** A card (Stripe) payment is part of it: the card share goes back to the card by itself. */
  hasCard: boolean;
  /** Family view only: the kinds of the refund the provider has RECORDED but not yet sent ("Refund recorded: <provider> will send your cash refund"). */
  sending?: OfflineKind[];
}

/** The method facts for a booking, or an empty `kinds` when nothing was paid offline. */
export function refundMethodInfo(b: Src): RefundMethodInfo {
  const parts = paidOfflineParts(b);
  return { kinds: parts.map((p) => p.kind), parts, mixed: parts.length > 1, hasCard: !!b.paymentIntentId || (b.cardPaid ?? 0) > 0 };
}

/** The per-kind shares of an offline refund of `amount` on this booking (what each method gets back), penny-correct. A refund entry that already carries its
 *  own `parts` (stamped when it was approved) wins over a recalculation. */
export function refundPartsFor(b: Src, amount: number, own?: readonly MethodPart[] | null): MethodPart[] {
  if (own?.length) return own.filter((p) => p.amount > 0).map((p) => ({ kind: p.kind, amount: round2(p.amount) }));
  return splitOverParts(amount, paidOfflineParts(b));
}

/** The kinds of the offline refund(s) to talk about: those still to send (their own stamped kinds), else every offline refund recorded, else the booking's
 *  own. (Older entries carry no kinds: then the booking says how it was paid.) */
export function unsentKinds(b: Src & { refundEntries?: { via: string; status: string; parts?: MethodPart[] }[] }): OfflineKind[] {
  const offline = (b.refundEntries ?? []).filter((e) => e.via === "offline");
  const open = offline.filter((e) => e.status === "approved");
  const set = new Set<OfflineKind>();
  for (const e of open.length ? open : offline) for (const p of e.parts ?? []) set.add(p.kind);
  if (!set.size) for (const k of refundMethodInfo(b).kinds) set.add(k);
  return OFFLINE_KINDS.filter((k) => set.has(k));
}

export type Tr = (key: string, vars?: Record<string, string>) => string;
export type Join = (items: string[]) => string;
const NOUN: Record<OfflineKind, string> = { bank: "rfm.nBank", cash: "rfm.nCash", voucher: "rfm.nVoucher" };
const HOW: Record<OfflineKind, string> = { bank: "rfm.hBank", cash: "rfm.hCash", voucher: "rfm.hVoucher" };
const SEND: Record<OfflineKind, string> = { bank: "rfm.sBank", cash: "rfm.sCash", voucher: "rfm.sVoucher" };
const OPT: Record<OfflineKind, string> = { bank: "rfm.optBank", cash: "rfm.optCash", voucher: "rfm.optVoucher" };

/** "bank transfer", "cash", "bank transfer and cash": the method NAMES, joined in the reader's language. */
export function methodNames(kinds: readonly OfflineKind[], tr: Tr, join: Join): string {
  return join(OFFLINE_KINDS.filter((k) => kinds.includes(k)).map((k) => tr(NOUN[k])));
}
/** "by bank transfer", "in cash", "by voucher", "by bank transfer and cash". */
export function methodHow(kinds: readonly OfflineKind[], tr: Tr, join: Join): string {
  const ks = OFFLINE_KINDS.filter((k) => kinds.includes(k));
  return ks.length === 1 ? tr(HOW[ks[0]]) : tr("rfm.hMix", { methods: methodNames(ks, tr, join) });
}
/** The provider's instruction to himself: "Send £0.50 by bank transfer", "Hand back £0.50 in cash", "Refund £0.50 by voucher". */
export function sendLine(kinds: readonly OfflineKind[], amt: string, tr: Tr, join: Join): string {
  const ks = OFFLINE_KINDS.filter((k) => kinds.includes(k));
  return ks.length === 1 ? tr(SEND[ks[0]], { amt }) : tr("rfm.sMix", { amt, methods: methodNames(ks, tr, join) });
}
/** The provider's owed line: "Refund £0.50 owed: paid in cash". */
export function owedLine(kinds: readonly OfflineKind[], amt: string, tr: Tr, join: Join): string {
  return tr("rfm.owed", { amt, how: methodHow(kinds, tr, join) });
}
/** The family's destination button: "Ask <provider> to hand me my £0.50 cash back" / "... to send me my £0.50 back by bank transfer and cash". */
export function askLabel(kinds: readonly OfflineKind[], provider: string, amt: string, tr: Tr, join: Join): string {
  const ks = OFFLINE_KINDS.filter((k) => kinds.includes(k));
  return ks.length === 1 ? tr(OPT[ks[0]], { provider, amt }) : tr("rfm.optMix", { provider, amt, methods: methodNames(ks, tr, join) });
}
/** The family's status line once the provider has recorded it: "Refund recorded: <provider> will send your £0.50 cash refund". */
export function recordedLine(kinds: readonly OfflineKind[], provider: string, amt: string, tr: Tr, join: Join): string {
  return tr("rfm.parentRec", { provider, amt, methods: methodNames(kinds, tr, join) });
}
