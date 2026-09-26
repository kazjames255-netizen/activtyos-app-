import { createHash } from "node:crypto";
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
//   scheme/amount            — checkout (routes/my.ts) via voucherScheme, and
//                              derived from the booking's own money.
//   paymentReference/refs    — MINTED by the server at checkout
//                              (attachChildcareRefs below) — ours, one per
//                              booking-and-child, the only string we ask a
//                              family to quote. Written once, never rewritten.
//   bookerReference          — the reference the PARENT typed (their own HMRC /
//                              scheme account ref). Captured, shown as context,
//                              never quoted back as ours. The operator's
//                              PUT /api/bookings/:ref/payment-ref corrects
//                              THIS, not the minted one.
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
  // ── The two references, which are NOT the same thing (d8s2) ───────────
  /** OURS. The reference we mint and ask the family to quote when they pay —
   *  see "OUR payment reference" below. Set once, at checkout, and never
   *  rewritten: the family has already been given it. `null` on every booking
   *  taken before minting existed. On a multi-child booking this is null and
   *  `refs` carries one per child (each child's account pays separately). */
  paymentReference?: string | null;
  /** THEIRS. The scheme/HMRC account reference the BOOKER typed at checkout
   *  (`AAAA00000TFC`, or "Caelan"). Genuinely theirs, worth keeping for
   *  reconciliation, and never the thing we ask them to quote as ours. */
  bookerReference?: string | null;
  /** One row per child on the booking — the minted reference is per
   *  BOOKING-AND-CHILD, so a booking with two children has two. */
  refs?: ChildcareRefRow[] | null;
  /** Which minting scheme produced `refs` ("cc1"), so a future format change
   *  is identifiable instead of guessed at. */
  refScheme?: string | null;
}

/** One child's money on one booking: the reference we minted for them, and the
 *  one they typed themselves. */
export interface ChildcareRefRow {
  child: string;
  childId?: string | null;
  /** The child's index on this booking — the K symbol of the reference. */
  slot: number;
  /** OURS (always present on a minted row). */
  paymentReference: string;
  /** THEIRS, if they gave one. */
  bookerReference?: string | null;
  scheme?: string | null;
  amount?: number | null;
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
  /** How much the reference in `reference` is worth as a match:
   *  "minted" — ours, check-symbol valid, unique per booking-and-child;
   *  "typed"  — the booker's own, a hint only (it may read "Caelan");
   *  "none"   — nobody has given us anything to look for. */
  referenceStrength: "minted" | "typed" | "none";
} {
  const cc = stored(b);
  const route = childcareRoute(b);
  // OUR minted references, one per child. Absent on every booking taken before
  // minting existed (no migration) — those degrade to the booker's typed one
  // below, exactly as they read today.
  const refs = (cc.refs ?? []).filter((r) => r && typeof r.paymentReference === "string" && r.paymentReference.trim());
  const mintedFirst = refs[0]?.paymentReference ?? cc.paymentReference ?? null;
  // A booking may hold MORE than one reference (siblings paying separately),
  // in which case payRefs wins — see paymentRecordsOf() for the full list.
  // Blank-or-absent, not just absent: a stored "" is a field someone cleared,
  // and `??` would happily hand it on as the answer.
  const first = <T,>(...vals: (T | null | undefined)[]) => vals.find((v) => typeof v === "string" ? v.trim() !== "" : v != null) ?? null;
  // The typed one, kept whole: it is the booker's own account reference, and a
  // reconciliation may still want it even though we never ask for it.
  const typed = first(cc.bookerReference, b.paymentRef, b.payRefs?.find((r) => (r.ref ?? "").trim())?.ref) as string | null;
  // `reference` is "the reference to look for against this money", which is
  // OURS as soon as we have one and the booker's typed one before that. Kept as
  // one field because every existing reader (the §B3 column, the ledger, the
  // search box) asks that one question — they just get a better answer now.
  const reference = first(cc.reference, mintedFirst, typed) as string | null;
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
    // A booking-level minted reference only makes sense when ONE child is
    // paying; with siblings each has their own and `refs` is the answer.
    paymentReference: cc.paymentReference ?? (refs.length === 1 ? refs[0].paymentReference : null),
    bookerReference: typed,
    refs: refs.length ? refs : null,
    refScheme: cc.refScheme ?? (refs.length ? CHILDCARE_REF_SCHEME : null),
    referenceStrength: refs.length || cc.paymentReference ? "minted" : typed ? "typed" : "none",
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

// ── OUR payment reference: minted, never typed ───────────────────────────
// d8s2. The parent used to type the reference they'd pay under and we stored it
// verbatim, so "Caelan" was accepted and the SAME string could be reused on two
// bookings for two children. A reference nobody mints isn't a reference, it's a
// note. The server now mints one per BOOKING-AND-CHILD at checkout, and that is
// the only string we ever ask a family to quote.
//
// FORMAT   CC-TTT-SSSS-KX  (hyphens are decoration; 9 payload symbols)
//   CC    literal — "childcare". Lets an operator spot one of ours in a list of
//         bank-statement references at a glance.
//   TTT   3 symbols of sha256(tenantId). A tenant discriminator, because every
//         provider numbers bookings from APF-10312 (see my.ts) — two tenants'
//         booking 10312 must not mint one string.
//   SSSS  the booking's own number (APF-10312 → 10312) in base 32. Four
//         symbols to 1,048,575, widening by one symbol beyond that.
//   K     the child's slot on the booking (0–31; a basket is capped at 20).
//   X     a Luhn mod-32 check symbol over all eight symbols above.
//
// ALPHABET Crockford base 32 — 0-9 then A-Z without I, L, O and U. Reading one
// back in we fold I/l/L → 1 and O/o → 0, ignore case, and ignore every
// separator, so the two slips people actually make writing a reference onto a
// bank transfer cannot change its meaning. Every OTHER single-symbol slip
// (2/Z, 5/S, 8/B, 6/G…) is *detected* by the check symbol rather than merely
// avoided, and detecting it is arithmetic: offline, no database, no guessing.
//
// UNIQUENESS is structural, not hoped for. Within a tenant the reference is an
// injective function of (booking number, child slot). The booking number comes
// from tenants/{id}.nextBid, bumped inside the very transaction that writes the
// bookings, so it is never reissued; the slot is the child's index on that
// booking. Two children on one booking differ in K; two bookings for one child
// differ in SSSS. No scan, no uniqueness index, nothing to race — a collision
// would need Firestore to hand out one booking number twice.
// ACROSS tenants two providers can share TTT (1 in 32,768 per pair) and so mint
// the same string. That is deliberate and harmless: a reference is only ever
// resolved against one tenant's own bookings, arriving in one tenant's own bank
// account, and booking numbers themselves already collide across tenants.
export const CHILDCARE_REF_SCHEME = "cc1";

const A32 = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"; // no I, L, O, U
const A32_VAL = new Map([...A32].map((c, i) => [c, i] as const));
const REF_PREFIX = "CC";
const TENANT_BUCKETS = 32 ** 3; // 32,768
const SERIAL_SYMBOLS = 4;
const MAX_SLOT = 31;

function enc32(n: number, min: number): string {
  let v = Math.max(0, Math.floor(n));
  let s = "";
  while (v > 0) { s = A32[v % 32] + s; v = Math.floor(v / 32); }
  return s.padStart(min, "0");
}

/** Luhn mod N with N = 32: detects every single-symbol substitution and every
 *  transposition of two adjacent unequal symbols. */
function luhn32(vals: number[]): number {
  let factor = 2;
  let sum = 0;
  for (let i = vals.length - 1; i >= 0; i--) {
    const add = factor * vals[i];
    factor = factor === 2 ? 1 : 2;
    sum += Math.floor(add / 32) + (add % 32);
  }
  return (32 - (sum % 32)) % 32;
}

/** Groups of three, the last one absorbing the remainder — a reference people
 *  read out loud and copy into a bank form. */
const group3 = (s: string) => s.replace(/(.{3})(?=.{3,})/g, "$1-");

const hash32 = (s: string) => parseInt(createHash("sha256").update(s).digest("hex").slice(0, 8), 16);

/**
 * Mint OUR payment reference for one child on one booking. Pure: the same
 * (tenant, booking, slot) gives the same string forever, so it can be
 * re-derived and re-checked without reading anything.
 */
export function mintChildcareReference(tenantId: string, bookingRef: string, slot: number): string {
  if (!Number.isInteger(slot) || slot < 0 || slot > MAX_SLOT)
    throw new Error(`Childcare reference: child slot ${slot} is out of range (0–${MAX_SLOT})`);
  const digits = /(\d+)\s*$/.exec(bookingRef ?? "");
  // Booking refs are "APF-10312". One without a number has never been seen in
  // the wild; hash the whole ref rather than throw at checkout — still one
  // value per booking, just not a legible one.
  const serial = digits ? Number(digits[1]) : hash32(`ref:${bookingRef}`) % 32 ** SERIAL_SYMBOLS;
  const body = enc32(hash32(`${CHILDCARE_REF_SCHEME}:${tenantId}`) % TENANT_BUCKETS, 3) + enc32(serial, SERIAL_SYMBOLS) + enc32(slot, 1);
  const payload = body + A32[luhn32([...body].map((c) => A32_VAL.get(c)!))];
  return `${REF_PREFIX}-${group3(payload)}`;
}

/**
 * Canonicalise whatever a human (or a bank statement export) gives us back into
 * the exact string we minted — or `null` when it isn't one of ours: wrong
 * prefix, a symbol outside the alphabet, or a failed check symbol. This is the
 * whole of validation; it reads nothing.
 */
export function foldChildcareReference(raw: string | null | undefined): string | null {
  const s = String(raw ?? "").toUpperCase().replace(/[^0-9A-Z]/g, "");
  if (!s.startsWith(REF_PREFIX)) return null;
  const folded = [...s.slice(REF_PREFIX.length)].map((c) => (c === "I" || c === "L" ? "1" : c === "O" ? "0" : c));
  if (folded.length < 3 + SERIAL_SYMBOLS + 2 || folded.length > 16) return null;
  if (folded.some((c) => !A32_VAL.has(c))) return null;
  const vals = folded.map((c) => A32_VAL.get(c)!);
  if (luhn32(vals.slice(0, -1)) !== vals[vals.length - 1]) return null;
  return `${REF_PREFIX}-${group3(folded.join(""))}`;
}

/** Is this one of ours, arithmetic-checked? */
export const isMintedChildcareReference = (raw: string | null | undefined) => foldChildcareReference(raw) !== null;

/**
 * Mint the references for a childcare booking at the moment it is created, and
 * put them on its `childcare` block. Mutates and returns the booking.
 *
 * Called from the two places a booking is born (routes/my.ts checkout, the
 * operator's POST /api/bookings). Deliberately:
 *  • a no-op for anything that isn't a childcare booking (card, HAF, cash);
 *  • a no-op when the block already carries refs — the family has been given
 *    those strings, so they are never rewritten, not even if children change;
 *  • never throws out of a checkout: a booking must not fail over a reference.
 */
export function attachChildcareRefs<T extends ChildcareBooking>(b: T, tenantId: string): T {
  try {
    if (!tenantId || !b.ref || !childcareRoute(b)) return b;
    const cc = stored(b);
    if (cc.refs?.length) return b;
    // Whose money: every child on the booking (a merged basket carries kids[],
    // a single-child booking carries the one name).
    const kids: { name: string; childId?: string | null }[] = b.kids?.length
      ? b.kids.map((k) => ({ name: k.name, childId: k.childId ?? null }))
      : [{ name: b.child, childId: b.childId ?? null }];
    // What each child TYPED (their own scheme/HMRC account reference), by name.
    const typed = new Map<string, { ref: string; amount?: number; scheme?: string }>();
    for (const r of b.payRefs ?? [])
      if ((r.ref ?? "").trim()) typed.set((r.child ?? "").trim().toLowerCase(), { ref: r.ref.trim(), amount: r.amount, scheme: r.scheme });
    const refs: ChildcareRefRow[] = [];
    kids.slice(0, MAX_SLOT + 1).forEach((k, slot) => {
      const t = typed.get((k.name ?? "").trim().toLowerCase());
      const own = t?.ref ?? (kids.length === 1 ? (b.paymentRef ?? "").trim() || undefined : undefined);
      refs.push({
        child: k.name,
        ...(k.childId ? { childId: k.childId } : {}),
        slot,
        paymentReference: mintChildcareReference(tenantId, b.ref, slot),
        bookerReference: own ?? null,
        ...(t?.scheme ? { scheme: t.scheme } : {}),
        // Per-child money only where we actually know it (the checkout sends a
        // ref + amount per child). Never invented here.
        ...(t?.amount != null ? { amount: round2(t.amount) } : kids.length === 1 ? { amount: childcareAmountOf(b) } : {}),
      });
    });
    if (!refs.length) return b;
    b.childcare = {
      ...cc,
      // `reference` is what every existing reader already renders, so put ours
      // there: on a sibling booking that is the first child's, with `refs`
      // carrying all of them.
      reference: refs[0].paymentReference,
      paymentReference: refs.length === 1 ? refs[0].paymentReference : null,
      bookerReference: refs.map((r) => r.bookerReference).find((v) => (v ?? "").trim()) ?? null,
      refs,
      refScheme: CHILDCARE_REF_SCHEME,
    };
    return b;
  } catch {
    // A booking is worth more than a reference. Nothing minted → the booking
    // reads exactly like a pre-minting one, which is a state we handle.
    return b;
  }
}

/**
 * What a string off a bank statement is worth against THIS booking. The point
 * of the whole exercise, and the rule the spec insists on (§B3 note: never key
 * matching solely on the reference):
 *   "strong" — it is the reference WE minted for this booking (or one of its
 *              children): check-symbol valid and ours. Safe to act on.
 *   "hint"   — it only equals what the BOOKER typed, which may be their child's
 *              first name. Worth showing a human, never worth deciding on.
 *   "none"   — it matches nothing here.
 * Nothing in this file turns a "strong" into a tick by itself: the bank tick
 * stays a human's, deliberately keyed on nothing.
 */
export function matchQuotedReference(b: ChildcareBooking, quoted: string | null | undefined): {
  strength: "strong" | "hint" | "none";
  on: "minted" | "booker" | null;
  child: string | null;
  reference: string | null;
} {
  const raw = String(quoted ?? "").trim();
  if (!raw) return { strength: "none", on: null, child: null, reference: null };
  const cc = childcareOf(b);
  const folded = foldChildcareReference(raw);
  if (folded) {
    const rows = cc.refs ?? [];
    const hit = rows.find((r) => foldChildcareReference(r.paymentReference) === folded)
      ?? (foldChildcareReference(cc.paymentReference) === folded ? { child: cc.refs?.[0]?.child ?? null, paymentReference: folded } as Pick<ChildcareRefRow, "child" | "paymentReference"> : null);
    if (hit) return { strength: "strong", on: "minted", child: hit.child ?? null, reference: folded };
  }
  // The booker's own reference — theirs, hand-typed, so a hint at most. Loose
  // comparison (case, spaces, punctuation) because they never type it twice the
  // same way.
  const loose = (s: string) => s.toUpperCase().replace(/[^0-9A-Z]/g, "");
  const wanted = loose(raw);
  if (wanted) {
    for (const r of cc.refs ?? [])
      if (r.bookerReference && loose(r.bookerReference) === wanted) return { strength: "hint", on: "booker", child: r.child ?? null, reference: r.bookerReference };
    for (const r of b.payRefs ?? [])
      if ((r.ref ?? "").trim() && loose(r.ref) === wanted) return { strength: "hint", on: "booker", child: r.child ?? null, reference: r.ref };
    if (cc.bookerReference && loose(cc.bookerReference) === wanted) return { strength: "hint", on: "booker", child: null, reference: cc.bookerReference };
  }
  return { strength: "none", on: null, child: null, reference: null };
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
  /** The reference to look for against this money — ours when we minted one. */
  reference: string | null;
  /** OURS, split out so a screen can label it "quote this". */
  paymentReference: string | null;
  /** THEIRS — shown as context, never as the ask. */
  bookerReference: string | null;
  amount: number;
}

export function paymentRecordsOf(b: ChildcareBooking): ChildcarePaymentRecord[] {
  const cc = childcareOf(b);
  const out: ChildcarePaymentRecord[] = [];
  const typed = (b.payRefs ?? []).filter((r) => (r.ref ?? "").trim() || (r.amount ?? 0) > 0);
  const minted = cc.refs ?? [];
  if (minted.length) {
    // The minted rows are the authoritative per-child list: every child has one,
    // where payRefs only ever held the children who typed something.
    const amountByChild = new Map(typed.map((r) => [(r.child ?? "").trim().toLowerCase(), r.amount]));
    const share = minted.length > 1 ? round2(childcareAmountOf(b) / minted.length) : childcareAmountOf(b);
    for (const r of minted)
      out.push({
        kind: "childcare",
        scheme: r.scheme ?? cc.scheme ?? null,
        child: r.child ?? null,
        reference: r.paymentReference,
        paymentReference: r.paymentReference,
        bookerReference: (r.bookerReference ?? "").trim() || null,
        // Their own figure where we have one, else this child's even share of
        // the childcare money — a display split, not a price (the booking total
        // stays the authority).
        amount: round2(r.amount ?? amountByChild.get((r.child ?? "").trim().toLowerCase()) ?? share),
      });
  } else if (typed.length) {
    for (const r of typed) out.push({ kind: "childcare", scheme: r.scheme ?? cc.scheme ?? null, child: r.child ?? null, reference: (r.ref ?? "").trim() || null, paymentReference: null, bookerReference: (r.ref ?? "").trim() || null, amount: round2(r.amount ?? 0) });
  } else if (childcareAmountOf(b) > 0 || cc.route) {
    out.push({ kind: "childcare", scheme: cc.scheme ?? null, child: null, reference: cc.reference ?? null, paymentReference: cc.paymentReference ?? null, bookerReference: cc.bookerReference ?? null, amount: childcareAmountOf(b) });
  }
  if ((b.cardPaid ?? 0) > 0) out.push({ kind: "card", scheme: null, child: null, reference: b.paymentIntentId ?? null, paymentReference: null, bookerReference: null, amount: round2(b.cardPaid ?? 0) });
  return out;
}

// ── The reference is not a key ───────────────────────────────────────────
// Row 4 of the spec's table reads "Caelan" — a child's first name where a TFC
// reference should be. Parents type these by hand and get them wrong, so a
// TYPED reference keys nothing: it is shown, it is searched, it is flagged when
// it doesn't look right, and that is all. A reference WE minted is a different
// animal (see below) — it is a strong match, and P3's suggestions can lean on
// it — but even then the bank-statement tick stays a human's and keys on
// nothing, because the money may arrive quoting neither.
const TFC_REF = /^[A-Za-z]{4}\d{5}TFC$/;

/** Does this look like a real HMRC TFC reference? `null` reference → false,
 *  and a false here NEVER excludes the row — it decorates it. */
export const looksLikeTfcRef = (ref: string | null | undefined) => TFC_REF.test((ref ?? "").replace(/\s+/g, ""));

/**
 * A reference we can't use to match anything: missing, or (for TFC) not in
 * HMRC's format. Counted on its own so an operator can chase them.
 *
 * Now that WE mint the reference, a minted booking has nothing to chase — the
 * string the money will arrive under is one we issued and can check. So the
 * chase list means what it says: it is the bookings still relying on something
 * a parent typed. Old bookings are untouched by this and keep reading exactly
 * as they did.
 */
export function referenceProblem(b: ChildcareBooking): "missing" | "malformed" | null {
  const cc = childcareOf(b);
  if (cc.referenceStrength === "minted") return null;
  const anyRef = (b.payRefs ?? []).some((r) => (r.ref ?? "").trim()) || !!(cc.reference ?? "").trim();
  if (!anyRef) return "missing";
  if (cc.route === TFC && !(b.payRefs ?? []).some((r) => looksLikeTfcRef(r.ref)) && !looksLikeTfcRef(cc.reference)) return "malformed";
  return null;
}

/** Is the reference on the §B3 row one we can trust to match money with? True
 *  for anything we minted (check symbol verified), and for a booker-typed one
 *  only as far as its format goes — which is as much as a typed one can ever
 *  earn. */
export function referenceLooksValid(b: ChildcareBooking): boolean {
  const cc = childcareOf(b);
  if (cc.referenceStrength === "minted") return isMintedChildcareReference(cc.reference);
  if (cc.route === TFC) return looksLikeTfcRef(cc.reference);
  return !!(cc.reference ?? "").trim();
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
