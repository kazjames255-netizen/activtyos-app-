import { db } from "../firebase";
import { loadSettings } from "./tenantLibrary";
import type { Booking } from "../../../features/bookings/types";
import { isUnreconciled } from "../../../features/bookings/helpers";

// ─────────────────────────────────────────────────────────────────────────
// Childcare payments — the shared rules behind the reconciliation half of
// docs/tfc-build-spec.md (Part B, phase P1: "reconciliation only, no HMRC
// integration").
//
// Two words that are NOT the same thing, and the whole spec turns on the
// difference:
//
//   confirmed / unconfirmed  — the BOOKER's promise. They said they've paid
//                              (or HMRC told us they have). Our ledger.
//   reconciled / unreconciled — OUR bank match. A human looked at the bank
//                              statement and ticked the line off.
//
// A payment is routinely confirmed but unreconciled for weeks; the gap is the
// number an operator is chasing. Collapsing them into one figure hides it.
//
// Everything here is read-only over a Booking, so the SAME rule serves the
// ledger, the analytics and (via routes/tfc.ts) the HMRC client. The
// unreconciled rule itself is imported from features/bookings/helpers rather
// than restated: if the two ever drift, an operator gets a different answer to
// "what's outstanding" depending which page they opened.
// ─────────────────────────────────────────────────────────────────────────

export { isUnreconciled };

const round2 = (n: number) => Math.round(n * 100) / 100;

// ── Which bookings are "childcare" ───────────────────────────────────────
// Mirrors methodCat() in features/reconciliation/ReconciliationApp.tsx, which
// drives the payment-method tabs. Deliberately NOT the wider isChildcare()
// in routes/my.ts (that one folds in HAF/funded places, because it is
// answering "can this money go back to a card?"). Here HAF is a grant, not a
// childcare account, and it has no scheme, reference or bank line to match.
export const TFC = "Tax-Free Childcare";
export const VOUCHERS = "Childcare vouchers";
export type ChildcareRoute = typeof TFC | typeof VOUCHERS;

export function childcareRoute(b: Pick<Booking, "method" | "voucherScheme">): ChildcareRoute | null {
  const m = (b.method || "").toLowerCase();
  if (b.voucherScheme || /voucher/.test(m)) return VOUCHERS;
  if (/tax.?free|\btfc\b/.test(m)) return TFC;
  return null;
}

export const isChildcare = (b: Pick<Booking, "method" | "voucherScheme">) => childcareRoute(b) !== null;

// ── The booking-level childcare block ────────────────────────────────────
// The shape docs/tfc-build-spec.md proposes. It is OPTIONAL on the stored
// document: every booking taken before it existed (and every one taken
// through the current checkout) carries the same facts in the older flat
// fields, so this reads through to them rather than demanding a migration.
//
// Who writes what:
//   scheme/reference/amount  — checkout (routes/my.ts) via voucherScheme /
//                              paymentRef / payRefs; the operator can correct
//                              the reference (PUT /api/bookings/:ref/payment-ref).
//   promisedAt               — when the parent declared they'd pay from a
//                              childcare account. Falls back to createdAt.
//   confirmedAt              — when the money was confirmed by the BOOKER or
//                              by HMRC. Only routes/my.ts (the parent journey)
//                              and routes/tfc.ts (the HMRC settlement feed) can
//                              honestly stamp this, so it is read here and
//                              never guessed — `confirmed` below is the derived
//                              boolean the ledger has always used.
//   reconciledAt/reconciledBy — OUR bank-statement tick. Written by
//                              POST /api/reconciliation/:ref/bank-match.
export interface ChildcarePayment {
  scheme?: string | null;
  reference?: string | null;
  amount?: number | null;
  promisedAt?: string | null;
  confirmedAt?: string | null;
  reconciledAt?: string | null;
  reconciledBy?: { at: string; by: string; auto?: boolean } | null;
}

/** A booking doc as it is on the wire, plus the optional childcare block. The
 *  block is not on the shared `Booking` type (features/ is owned by the front
 *  end); this is the server-side view of the same document. */
export type ChildcareBooking = Booking & { childcare?: ChildcarePayment | null };

const stored = (b: ChildcareBooking): ChildcarePayment => (b.childcare && typeof b.childcare === "object" ? b.childcare : {});

/** The money expected through the childcare account: the booking total less
 *  anything already taken by card at checkout (the Step-4 split — TFC plus a
 *  card/bank remainder is a first-class case, not an edge one). */
export const childcareAmountOf = (b: Booking) => round2(Math.max(0, (b.amount ?? 0) - (b.cardPaid ?? 0)));

const outstandingOf = (b: Booking) => round2(Math.max(0, (b.amount ?? 0) - (b.amountPaid ?? 0)));

/**
 * One booking's childcare block, filled in from the older flat fields where
 * the block itself is absent. Never invents a timestamp it doesn't have.
 */
export function childcareOf(b: ChildcareBooking): ChildcarePayment & {
  route: ChildcareRoute | null;
  /** The BOOKER's promise: money is in against this booking. */
  confirmed: boolean;
  /** OUR bank match: someone ticked it off a statement. */
  reconciled: boolean;
  /** Still owed on the booking. */
  outstanding: number;
} {
  const cc = stored(b);
  const route = childcareRoute(b);
  // A booking may hold MORE than one reference (siblings paying separately),
  // in which case payRefs wins — see paymentRecordsOf() for the full list.
  // Blank-or-absent, not just absent: a stored "" is a field someone cleared,
  // and `??` would happily hand it on as the answer.
  const first = <T,>(...vals: (T | null | undefined)[]) => vals.find((v) => typeof v === "string" ? v.trim() !== "" : v != null) ?? null;
  const reference = first(cc.reference, b.paymentRef, b.payRefs?.find((r) => (r.ref ?? "").trim())?.ref) as string | null;
  // The one-click reconcile (POST /api/bookings/:ref/reconcile) has always
  // stamped reconciledBy. That IS an operator saying "the money is in and
  // matched", so it counts as a bank match — but ONLY until the finer tick has
  // been used on this booking. Once the block carries the reconciliation half,
  // it is authoritative, or unticking a booking that was reconciled the old way
  // would appear to do nothing.
  const ticked = "reconciledAt" in cc || "reconciledBy" in cc;
  const by = ticked ? cc.reconciledBy ?? null : b.reconciledBy ?? null;
  const reconciledAt = (ticked ? cc.reconciledAt : null) ?? by?.at ?? null;
  return {
    route,
    // A voucher booking whose scheme was never named stays null rather than
    // becoming an empty-string "scheme" that groups every unnamed one together.
    scheme: (first(cc.scheme, b.voucherScheme) as string | null) ?? (route === TFC ? "HMRC Tax-Free Childcare" : null),
    reference,
    amount: cc.amount ?? childcareAmountOf(b),
    promisedAt: cc.promisedAt ?? b.createdAt ?? null,
    confirmedAt: cc.confirmedAt ?? null,
    reconciledAt,
    reconciledBy: by,
    confirmed: (b.amountPaid ?? 0) > 0,
    reconciled: !!reconciledAt,
    outstanding: outstandingOf(b),
  };
}

// ── More than one payment record per booking ─────────────────────────────
// Part A, Step 4: the parent pays part from HMRC and the remainder by card or
// bank transfer, and siblings on one booking can pay under a reference each.
// So the booking's money is a LIST, not a field. `payments` in Firestore holds
// the settlement trail; this is the per-booking view the tick-off table needs,
// derived from the booking alone (no second read per row).
export interface ChildcarePaymentRecord {
  kind: "childcare" | "card";
  scheme: string | null;
  child: string | null;
  reference: string | null;
  amount: number;
}

export function paymentRecordsOf(b: ChildcareBooking): ChildcarePaymentRecord[] {
  const cc = childcareOf(b);
  const out: ChildcarePaymentRecord[] = [];
  const refs = (b.payRefs ?? []).filter((r) => (r.ref ?? "").trim() || (r.amount ?? 0) > 0);
  if (refs.length) {
    for (const r of refs) out.push({ kind: "childcare", scheme: r.scheme ?? cc.scheme ?? null, child: r.child ?? null, reference: (r.ref ?? "").trim() || null, amount: round2(r.amount ?? 0) });
  } else if (childcareAmountOf(b) > 0 || cc.route) {
    out.push({ kind: "childcare", scheme: cc.scheme ?? null, child: null, reference: cc.reference ?? null, amount: childcareAmountOf(b) });
  }
  if ((b.cardPaid ?? 0) > 0) out.push({ kind: "card", scheme: null, child: null, reference: b.paymentIntentId ?? null, amount: round2(b.cardPaid ?? 0) });
  return out;
}

// ── The reference is not a key ───────────────────────────────────────────
// Row 4 of the spec's table reads "Caelan" — a child's first name where a TFC
// reference should be. Parents type these by hand and get them wrong, so
// NOTHING may key off the reference: it is shown, it is searched, it is
// flagged when it doesn't look right, and that is all. Matching is the
// operator's tick (and later, P3, a scored suggestion a human still confirms).
const TFC_REF = /^[A-Za-z]{4}\d{5}TFC$/;

/** Does this look like a real HMRC TFC reference? `null` reference → false,
 *  and a false here NEVER excludes the row — it decorates it. */
export const looksLikeTfcRef = (ref: string | null | undefined) => TFC_REF.test((ref ?? "").replace(/\s+/g, ""));

/** A reference we can't use to match anything: missing, or (for TFC) not in
 *  HMRC's format. Counted on its own so an operator can chase them. */
export function referenceProblem(b: ChildcareBooking): "missing" | "malformed" | null {
  const cc = childcareOf(b);
  const anyRef = (b.payRefs ?? []).some((r) => (r.ref ?? "").trim()) || !!(cc.reference ?? "").trim();
  if (!anyRef) return "missing";
  if (cc.route === TFC && !(b.payRefs ?? []).some((r) => looksLikeTfcRef(r.ref)) && !looksLikeTfcRef(cc.reference)) return "malformed";
  return null;
}

// ── settings.childcare ───────────────────────────────────────────────────
// B1. The provider identity a parent has to add inside their HMRC Tax-Free
// Childcare account before they can pay us — it must match what HMRC holds,
// or their payment fails with "provider not added to your HMRC account", one
// of the four designed failure states. Plus the managed list of schemes.
export interface ChildcareSettings {
  settingName: string;
  registrationNumber: string;
  postcode: string;
  schemes: string[];
}

const MAX_SCHEMES = 40;

/** UK postcodes are quoted back to a parent to type into HMRC — store one
 *  canonical form (upper case, single space before the inward code) so two
 *  operators typing "mk11aa" and "MK1 1AA" don't produce two answers.
 *
 *  Only a COMPLETE postcode is re-spaced. The Setup panel saves as you type,
 *  and splitting a half-typed "MK11" into "M K11" would fight the operator's
 *  own keystrokes; a partial one is just trimmed and upper-cased. */
const FULL_POSTCODE = /^[A-Z]{1,2}\d[A-Z\d]?\d[A-Z]{2}$/;
export function tidyPostcode(v: string): string {
  const s = v.replace(/\s+/g, "").toUpperCase();
  return FULL_POSTCODE.test(s) ? `${s.slice(0, -3)} ${s.slice(-3)}` : s;
}

/**
 * Validate + normalise whatever the Setup screen sent for `settings.childcare`.
 * Throws a plain Error (message shown to the operator) when the shape is wrong;
 * silently tidies everything it can. Returns `null` for an empty/absent block,
 * so clearing it removes the key rather than storing `{}`.
 */
export function normaliseChildcareSettings(raw: unknown): Partial<ChildcareSettings> | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw !== "object" || Array.isArray(raw)) throw new Error("settings.childcare must be an object");
  const v = raw as Record<string, unknown>;
  const str = (k: string, max: number) => {
    const x = v[k];
    if (x === undefined || x === null) return "";
    if (typeof x !== "string") throw new Error(`settings.childcare.${k} must be text`);
    if (x.trim().length > max) throw new Error(`settings.childcare.${k} is too long (max ${max} characters)`);
    return x.trim();
  };
  const out: Partial<ChildcareSettings> = {};
  const settingName = str("settingName", 120);
  // No spaces: HMRC and Ofsted quote these as a solid run of characters, and a
  // stray one is the difference between a parent finding us and not.
  const registrationNumber = str("registrationNumber", 40).replace(/\s+/g, "");
  const postcode = tidyPostcode(str("postcode", 12));
  if (settingName) out.settingName = settingName;
  if (registrationNumber) out.registrationNumber = registrationNumber;
  if (postcode) out.postcode = postcode;
  if (v.schemes !== undefined && v.schemes !== null) {
    if (!Array.isArray(v.schemes)) throw new Error("settings.childcare.schemes must be a list of scheme names");
    const names: string[] = [];
    for (const s of v.schemes) {
      if (typeof s !== "string") throw new Error("settings.childcare.schemes must be a list of scheme names");
      const t = s.trim().slice(0, 80);
      // Case-insensitive de-dupe: "Edenred" and "edenred" are one scheme, and
      // a duplicated row is a duplicated tab on the reconciliation screen.
      if (t && !names.some((n) => n.toLowerCase() === t.toLowerCase())) names.push(t);
    }
    if (names.length > MAX_SCHEMES) throw new Error(`Too many childcare schemes (max ${MAX_SCHEMES})`);
    out.schemes = names;
  }
  return Object.keys(out).length ? out : null;
}

/**
 * The childcare identity that applies to this tenant (or one franchise inside
 * it), with every blank filled in from what we already know:
 *  • settingName → settings.providerName → the tenant's name;
 *  • schemes → the voucher companies the provider already lists in Setup,
 *    plus HMRC Tax-Free Childcare itself.
 *
 * `settings.voucherProviders` stays the single source of truth for the voucher
 * COMPANIES (it is the list a parent picks from at checkout). `schemes` is the
 * spec's flat view of the same thing, and an override where a provider takes a
 * scheme they don't offer at checkout.
 */
export async function loadChildcareSettings(tenantId: string, franchiseId?: string | null): Promise<ChildcareSettings> {
  const s = await loadSettings(tenantId, franchiseId);
  const cc = (s.childcare ?? {}) as Partial<ChildcareSettings>;
  let settingName = (cc.settingName ?? "").trim() || String(s.providerName ?? "").trim();
  if (!settingName) settingName = String((await db.collection("tenants").doc(tenantId).get()).get("name") ?? "").trim();
  const fromVouchers = ((s.voucherProviders ?? []) as { name?: unknown }[])
    .map((v) => String(v?.name ?? "").trim())
    .filter(Boolean);
  const schemes = cc.schemes?.length ? cc.schemes : [...new Set(["HMRC Tax-Free Childcare", ...fromVouchers])];
  return {
    settingName,
    registrationNumber: (cc.registrationNumber ?? "").trim(),
    postcode: (cc.postcode ?? "").trim(),
    schemes,
  };
}

/** Everything a parent needs before they can pay us is filled in. The four
 *  designed failure states include "provider not added to booker's HMRC
 *  account", which is what an incomplete identity produces. */
export const childcareSettingsComplete = (c: ChildcareSettings) => !!(c.settingName && c.registrationNumber && c.postcode);
