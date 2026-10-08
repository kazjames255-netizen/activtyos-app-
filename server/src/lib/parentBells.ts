// The family's bell lines that carry a KEY and DATA next to the English text, so the bell shows them in the family's own language
// (components/shell/Bell.tsx renders t(key, vars) when the notification has `i18n`, and the stored English otherwise - older bells stay as written).
// English comes from the same message file, so the two can never drift. Pure: no database.
import { CATALOGS } from "../../../lib/i18n/messages/index";

export type Vars = Record<string, string>;
export const PARENT_BELL_KINDS = [
  "payment-received", "booked-paid", "approved-paid", "refund-approved-card", "refund-approved-scheme", "refund-approved-bank", "refund-approved-plain",
  "wallet-added", "refund-declined", "refund-sent", "extra-approved", "extra-declined",
] as const;
export type ParentBellKind = (typeof PARENT_BELL_KINDS)[number];

const TITLE: Record<ParentBellKind, string> = {
  "payment-received": "p7shell.bellPayRecv", "booked-paid": "p7shell.bellBookedPaid", "approved-paid": "p7shell.bellApprovedPaid",
  "refund-approved-card": "p7shell.bellRefApproved", "refund-approved-scheme": "p7shell.bellRefApproved", "refund-approved-bank": "p7shell.bellRefApproved", "refund-approved-plain": "p7shell.bellRefApproved",
  "wallet-added": "p7shell.bellWalletAdded", "refund-declined": "p7shell.bellRefDeclined", "refund-sent": "p7shell.bellRefSent",
  "extra-approved": "p7shell.bellExtraApproved", "extra-declined": "p7shell.bellExtraDeclined",
};
const BODY: Partial<Record<ParentBellKind, string>> = {
  "refund-approved-card": "p7shell.bellBRefCard", "refund-approved-scheme": "p7shell.bellBRefScheme", "refund-approved-bank": "p7shell.bellBRefBank", "refund-approved-plain": "p7shell.bellBRefPlain",
  "wallet-added": "p7shell.bellBWallet", "refund-declined": "p7shell.bellBRefDeclined",
};

const get = (key: string): string | undefined => {
  const o = key.split(".").reduce<unknown>((a, k) => (a && typeof a === "object" ? (a as Record<string, unknown>)[k] : undefined), (CATALOGS as Record<string, unknown>).en);
  return typeof o === "string" ? o : undefined;
};
const fill = (s: string, v: Vars) => Object.entries(v).reduce((t, [k, x]) => t.split(`{${k}}`).join(x), s);

export interface ParentBell { title: string; body?: string; i18n: { tk: string; tv: Vars; bk?: string; bv?: Vars } }
/** `v` carries `ref`, and for bodies `amt` ("£12.00"), `listing`, `scheme`. A declined refund with an `amt` uses the "with amount" wording. */
export function parentBell(kind: ParentBellKind, v: Vars): ParentBell {
  const tk = TITLE[kind];
  let bk = BODY[kind];
  if (kind === "refund-declined" && v.amt) bk = "p7shell.bellBRefDeclinedAmt";
  const out: ParentBell = { title: fill(get(tk) ?? tk, v), i18n: { tk, tv: v } };
  if (bk) { out.body = fill(get(bk) ?? bk, v); out.i18n.bk = bk; out.i18n.bv = v; }
  return out;
}
