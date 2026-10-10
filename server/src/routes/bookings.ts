import { withMoney } from "../../../features/bookings/walletBreakdown";
import { refKeys } from "../lib/bookingRef";
import { resolvePendingCancel, alreadyRefundedWarning } from "../lib/pendingRefund";
import { splitRefundByMethod, walletShareFor, noteInstantWalletCredit } from "../lib/refundSplit";
import { refPrefixFor } from "../lib/bookingRef";
import { stopOpenPayments } from "../lib/checkoutIntent";
import { randomUUID } from "node:crypto";
import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { FieldValue } from "firebase-admin/firestore";
import { mergeBookings } from "../lib/mergeBookings";
import { db } from "../firebase";
import { ukToday } from "../lib/ukDate";
import { parentBell } from "../lib/parentBells";
import { staffBookingView } from "../lib/rosterRules";
import { canWrite, operatorScope, managerScope } from "../middleware/role";
import { fromDoc, toDoc, type BookingDoc } from "../lib/bookingDoc";
import { upsertCustomerFromBooking } from "../lib/customerUpsert";
import { stripe, toPence } from "../lib/stripe";
import { capsProblem, queuePositions, triggerWaitlist, waitingCount } from "../lib/waitlist";
import { positionsFrom, sortQueue } from "../lib/waitlistQueue";
import { releaseDiscountCodes } from "../lib/discountRedemptions";
import { cleanupAfterCancel } from "../lib/cancelCleanup";
import { creditWallet, creditWalletOnceInTx, walletEntryRef, walletRef } from "../lib/wallet";
import { captureHolds, releaseHolds } from "../lib/cardHold";
import { RESEND_COOLDOWN_MS, remindersPatch, reminderDateLabel, resendWaitSeconds } from "../lib/invoiceResend";
import { AddonRequestError, addonCutoffDays, approveAddonRequest, declineAddonRequest } from "../lib/addonRequests";
import { decisionWording } from "../../../features/bookings/addonWording";
import { bellText } from "../lib/extraWording";
import { blocksBulkCancel } from "../lib/bulkCancelRules";
import { loadSettings } from "../lib/tenantLibrary";
import { bookingInSite, staffSiteScope } from "../lib/siteScope";
import { registerRows } from "../lib/registerRows";
import { bookingKids, kidActiveDays, money, realPhone, refundableSoFar, overpaidOf, receivedOf, cashReceivedOf, refundTransferAmount, refundAwaitingTransfer, refundNeedsProviderTransfer } from "../../../features/bookings/helpers";
import { kindOfMethod, paidOfflineParts, splitOverParts, unsentKinds, methodHow, methodNames } from "../../../features/bookings/refundMethod";
import { enJoin, enTr } from "../lib/refundWords";
/** Offline refund kinds (cash / bank / voucher) to name in the add-on decision wording: none for card or wallet money. */
const recordedKinds = (b: Booking): { kinds?: string; methods?: string } => { const ks = b.cancel?.refundVia === "card" ? [] : unsentKinds(b); return ks.length ? { kinds: ks.join(","), methods: methodNames(ks, enTr, enJoin) } : {}; };
import { notify } from "../lib/notify";
import { notifyFamilyCancelled } from "../lib/familyCancelNotice";
import { approveBlockedMessage, declineBlockedMessage, nudgeBlockedMessage, canMarkPaid, paidBlockedMessage, shouldEmailConfirmed, shouldNotifyCancelled, cardHeldBlocksPayment, CARD_HELD_MESSAGE, isFirstHeldApproval, shouldAskToPayAfterApproval, shouldReleaseDiscountCodes } from "../lib/bookingGuards";
import {
  blockCountDelta,
  applyPlacesDelta,
  heldPlaces,
  placesDelta,
  placesDeltaIsZero,
  bookingDays,
  countsTowardCapacity,
  countsUpdate,
  daysHaveSpace,
  bookingSeats,
  sessionLabel,
  type BlockDoc,
} from "../lib/blockDomain";
import {
  emailBookingConfirmed,
  emailAddonDecision,
  emailBookingDeclined,
  emailDateChangeResolved,
  emailPaymentLink,
  emailPaymentReceived,
  emailPlaceOffered,
  emailRefundApproved,
  emailRefundDeclined,
  emailRefundSent,
  emailVoucherInstructions,
} from "../lib/emails";
import { applyHoNetFilter } from "../lib/franchiseScope";
import type { Booking } from "../../../features/bookings/types";
import { applyMoveApprove } from "../lib/dateChange";
import { moveAddonDays } from "../../../features/bookings/addons";
import { addonsGoBack, stampAddonRefund } from "../../../features/bookings/addonRefund";
import {
  applyBulkAction,
  applyCancel,
  applyCancelChild,
  applyCancelDay,
  applyNote,
  applyRowAction,
  buildBooking,
  markRefundRecorded,
  rememberCashHeld,
} from "../../../features/bookings/mutations";
import { attachChildcareRefs, childcareOf, isChildcare, paymentRecordsOf, type ChildcareBooking, type ChildcarePayment } from "../lib/childcare";

// Operator bookings API. There is NO portal/tenant parameter — the scope is
// derived from the authenticated account (multi-tenant isolation is enforced
// here, server-side):
//   platform            → any tenant (optional ?tenantId= filter), read-only
//   company/freelancer  → their whole tenant
//   franchise           → their tenant AND their own franchiseId subset
//   staff               → their tenant, read-only
/** The email alone is easy to miss (and is held back while mail isn't live), so a
 *  booking made on the family's behalf also raises their bell with the amount
 *  and a straight link to the payment. */
function bellPayLink(b: { tenantId?: string; email: string; ref: string; listing: string; child?: string; amount: number }, tenantId: string, reminder?: { n: number }): void {
  void notify({
    tenantId: b.tenantId ?? tenantId,
    to: { kind: "parent", email: b.email },
    category: "billing",
    bellOnly: true,
    title: reminder ? `Payment reminder · ${b.ref}` : `Payment needed · ${b.ref}`,
    body: reminder
      ? `${b.listing}${b.child ? ` · ${b.child}` : ""} — reminder ${reminder.n}: £${b.amount.toFixed(2)} is still to pay to complete this booking.`
      : `${b.listing}${b.child ? ` · ${b.child}` : ""} — your provider has booked this for you. Pay £${b.amount.toFixed(2)} to complete it.`,
    href: `/custdash/bookings?pay=${encodeURIComponent(b.ref)}`,
    ref: b.ref,
  });
}

export const bookings = Router();

const col = db.collection("bookings");
const tenantsCol = db.collection("tenants");

const actionSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.enum([
      "approve",
      "decline",
      "paid",
      "recon",
      "promote",
      // Waiting list §E: hold the place for 2h while the family decides
      // (vs promote = seat immediately, operator's overbook prerogative).
      "offer",
      "refund-approve",
      "refund-decline",
      // The provider confirms they SENT an offline (bank transfer / cash / voucher) refund that was only recorded when they approved it.
      "refund-sent",
      // resend mutates nothing — it re-sends the payment-link email
      "resend",
    ]),
    // Optional free-text the operator gives when declining a booking; it's
    // relayed to the family in the decline email. Ignored for other types.
    reason: z.string().max(300).optional(),
    // refund-approve on an offline refund: the provider already sent the money, so record it as sent in one step.
    alreadySent: z.boolean().optional(),
    // refund-approve on a pending partial refund whose money was ALSO refunded in the Stripe dashboard: the provider has confirmed they want to refund more.
    confirmAlreadyRefunded: z.boolean().optional(),
  }),
  // Approve a parent's date-change request. approveIndexes lets the operator
  // approve only SOME swaps (omit = all); reason explains any declined ones.
  z.object({
    type: z.literal("move-approve"),
    approveIndexes: z.array(z.number().int().nonnegative()).optional(),
    reason: z.string().max(300).optional(),
  }),
  z.object({
    type: z.literal("move-deny"),
    reason: z.string().max(300).optional(),
  }),
  z.object({
    type: z.literal("cancel"),
    refund: z.enum(["full", "partial", "none"]),
    amount: z.number().nonnegative().max(1_000_000).optional(),
    reason: z.string().max(120).optional(),
    // Did the add-ons go back with the refund? Recorded on the cancel record; absent = the default (see addonRefunded).
    refundsAddons: z.boolean().optional(),
  }),
  // What happens to the money when ONE child / day is cancelled. Default
  // "refund" = a PENDING refund (the provider sends it and presses "Mark refund
  // sent"); "wallet" credits the family at once; "none" moves nothing.
  z.object({
    type: z.literal("cancel-child"),
    ki: z.number().int().nonnegative(),
    resolution: z.enum(["refund", "wallet", "none"]).optional(),
    amount: z.number().nonnegative().max(1_000_000).optional(),
    refundsAddons: z.boolean().optional(),
  }),
  z.object({
    type: z.literal("cancel-day"),
    ki: z.number().int().nonnegative(),
    date: z.string().min(1),
    resolution: z.enum(["refund", "wallet", "none"]).optional(),
    amount: z.number().nonnegative().max(1_000_000).optional(),
    refundsAddons: z.boolean().optional(),
  }),
  z.object({
    type: z.literal("change-day"),
    ki: z.number().int().nonnegative(),
    oldDate: z.string().min(1),
    newDate: z.string().min(1),
  }),
  z.object({ type: z.literal("note"), text: z.string() }),
  // A family's request to change / cancel ONE extra (never automatic, separate from cancelling the booking). The provider decides, and decides
  // the money: "refund" = a pending refund they send, "wallet" = instant credit, "none"/"waive" = nothing, "charge" = the price difference is owed.
  z.object({
    type: z.literal("addon-approve"),
    requestId: z.string().min(1).max(80),
    resolution: z.enum(["refund", "wallet", "none", "charge", "waive"]).optional(),
    amount: z.number().nonnegative().max(1_000_000).optional(),
  }),
  z.object({ type: z.literal("addon-decline"), requestId: z.string().min(1).max(80), reason: z.string().max(300).optional() }),
]);

const createSchema = z.object({
  booker: z.string().min(1),
  email: z.string().min(1),
  child: z.string(),
  age: z.number().nonnegative(),
  listing: z.string().min(1),
  pass: z.string().min(1),
  // Either a real block (capacity/waitlist apply, dates derived) or a
  // free-text dates label (phone bookings for unscheduled things).
  blockId: z.string().min(1).optional(),
  dates: z.string().min(1).optional(),
  amount: z.number().nonnegative().max(1_000_000),
  method: z.string().min(1),
  // The family's phone, stored on the booking (never a "—" placeholder, d10s8).
  phone: z.string().trim().max(40).optional(),
});

const bulkSchema = z.object({
  refs: z.array(z.string().min(1)).min(1),
  action: z.enum(["approve", "decline", "waitlist", "cancel"]),
});

export const bookingDocId = (tenantId: string, ref: string) => `${tenantId}_${ref}`;

/** Tell the family an off-platform payment (voucher / TFC / cash / bank) has
 *  landed — a rich branded email (dates, venue, who's on it, amount) AND the
 *  in-app bell. Called wherever a booking is settled: the reconcile action and
 *  the bookings-area "Mark received". Fire-and-forget. */
/** Is this listing an ONLINE one (its venue is the account's online place)? Best-effort: any failure reads as not online. */
async function isOnlineListing(listingId: string | undefined): Promise<boolean> {
  if (!listingId) return false;
  try {
    const { onlineListing } = await import("../lib/onlineSessions");
    return !!(await onlineListing(listingId));
  } catch { return false; }
}

/** The family's "payment received" email + bell. Exported because a CARD
 *  payment settles in lib/settlePayment.ts (shared with the Stripe webhook),
 *  which sent nothing at all — a family paying by card heard from Stripe, if
 *  anything, but never from ActivityOS. */
export async function notifyPaymentReceived(tenantId: string, b: Booking, label: string, group?: Booking[], approved = false, confirmedNow = false): Promise<void> {
  if (!b.email?.includes("@")) return;
  const email = b.email;
  const tenantDoc = await db.collection("tenants").doc(tenantId).get();
  const provider = (tenantDoc.get("name") as string) || "your provider";
  // One payment can settle several bookings (a basket spanning weeks). Send ONE email and ONE bell for the
  // whole payment: the first booking carries the merged amount, children, dates and the full list of refs.
  const all = group && group.length > 1 ? group : [b];
  const { merged, refs } = mergeBookings(all);
  const kidsLabel = merged.kids?.length ? merged.kids.map((k) => k.name).join(", ") : merged.child;
  const dateLabel = (merged.sessions ?? [])[0]?.split(" · ")[0];
  // "See you there!" reads wrong for a video session: the bell says "See you online!" for an online listing (same rule as the email).
  const seeYou = (await isOnlineListing(b.listingId)) ? "See you online!" : "See you there!";
  emailPaymentReceived(merged, provider, { label, amount: merged.amount ?? 0, refs, fullyPaid: all.every((x) => x.pay === "Paid"), approved, confirmedNow });
  void notify({
    tenantId,
    to: { kind: "parent", email },
    category: "billing",
    ...(({ title, i18n }) => ({ title, i18n }))(parentBell(approved ? "approved-paid" : confirmedNow ? "booked-paid" : "payment-received", { ref: refs.join(", ") })),
    body: confirmedNow
      ? `${b.listing}${kidsLabel ? ` · ${kidsLabel}` : ""} — your booking is confirmed and £${(merged.amount ?? 0).toFixed(2)} has been received${dateLabel ? ` · ${dateLabel}` : ""}. ${seeYou}`
      : approved
      ? `${b.listing}${kidsLabel ? ` · ${kidsLabel}` : ""} — your booking is approved and £${(merged.amount ?? 0).toFixed(2)} has been taken from your card${dateLabel ? ` · ${dateLabel}` : ""}. ${seeYou}`
      : `${b.listing}${kidsLabel ? ` · ${kidsLabel}` : ""} — £${(merged.amount ?? 0).toFixed(2)} received via ${label}${dateLabel ? ` · ${dateLabel}` : ""}. Fully paid — thank you!`,
    href: `/custdash/bookings?open=${encodeURIComponent(b.ref)}`,
    ref: b.ref,
    bellOnly: true, // the rich email is sent above
  });
}

// Resolve a booking's doc ref. New bookings use the `${tenantId}_${ref}` id,
// but older/imported/seeded ones have random ids — fall back to a ref lookup so
// operator actions (approve, cancel, …) find them either way.
async function resolveBookingRef(tenantId: string, ref: string): Promise<FirebaseFirestore.DocumentReference> {
  const byId = col.doc(bookingDocId(tenantId, ref));
  if ((await byId.get()).exists) return byId;
  const q = await col.where("tenantId", "==", tenantId).where("ref", "in", refKeys(ref)).limit(1).get();
  return q.empty ? byId : q.docs[0].ref;
}

// Is this booking doc inside the caller's scope?
function inScope(
  b: { tenantId?: string; franchiseId?: string },
  scope: { role: string; tenantId: string | null; franchiseId: string | null },
): boolean {
  if (scope.role === "platform") return true;
  if (b.tenantId !== scope.tenantId) return false;
  if ((scope.role === "franchise" || scope.role === "staff") && scope.franchiseId) return b.franchiseId === scope.franchiseId;
  return true;
}

function requireWrite(req: Request, res: Response): boolean {
  if (!canWrite(req.auth!.role)) {
    res.status(403).json({ error: "Your account is read-only for bookings" });
    return false;
  }
  return true;
}

// GET /api/bookings
bookings.get("/", async (req, res) => {
  const scope = operatorScope(req, res);
  if (!scope) return;

  let q = col as FirebaseFirestore.Query;
  if (scope.role === "platform") {
    const tenantFilter = typeof req.query.tenantId === "string" ? req.query.tenantId : null;
    if (tenantFilter) q = q.where("tenantId", "==", tenantFilter);
  } else {
    q = q.where("tenantId", "==", scope.tenantId);
    if ((scope.role === "franchise" || scope.role === "staff") && scope.franchiseId) q = q.where("franchiseId", "==", scope.franchiseId);
  }

  const snap = await q.get();
  // Staff assigned to certain sites (a site lead) see only those sites'
  // bookings (acceptance d23s5).
  const site = await staffSiteScope(req.auth!);
  // Firestore stamps every document with its own createTime, so a booking
  // taken before the app started recording `createdAt` still knows when it
  // was made. Real metadata, not a guess from the reference number — which
  // matters, because "what came in yesterday" is answered from this.
  const list = applyHoNetFilter(snap.docs.filter((d) => !site || bookingInSite(d.data(), site)).map((d) => withCreated(d)), scope.role, req.query.franchiseId);
  list.sort((a, b) => (a.ref < b.ref ? 1 : -1));
  // Queue positions for the families waiting, worked out from the bookings already loaded (no extra reads): the provider chooses
  // whom to offer a place to, so they need to see who is first in line for each date. Only when this view holds the whole queue.
  const wholeQueue = !site && !((scope.role === "franchise" || scope.role === "staff") && scope.franchiseId);
  if (wholeQueue) {
    const byBlock = new Map<string, typeof list>();
    for (const b of list) if (b.status === "Waitlisted" && b.blockId) byBlock.set(b.blockId, [...(byBlock.get(b.blockId) ?? []), b]);
    for (const [, queued] of byBlock) {
      const pos = positionsFrom(sortQueue(queued), queued.map((b) => b.ref), (x) => (queued.find((q) => q.ref === x.ref)?.days ?? []));
      for (const b of queued) { const mine = pos.filter((p) => p.ref === b.ref).map(({ date, position }) => ({ date, position })); if (mine.length) (b as { waitlist?: unknown }).waitlist = mine; }
    }
  }
  res.json(scope.role === "staff" ? list.map((b) => staffView(b as unknown as Record<string, unknown>)) : list.map((b) => withChildcare(b as ChildcareBooking)));
});

/**
 * Additive childcare decoration: a childcare booking gets its `childcare` block
 * DERIVED (ours + the booker's reference, per child, plus the promise/bank-match
 * pair), so every screen reads one shape whether the booking was taken before
 * minting existed or after it. Everything else is passed through untouched.
 */
const withChildcare = <T extends ChildcareBooking>(b: T): T => withMoney(isChildcare(b) ? { ...b, childcare: childcareOf(b) } : b);
// withMoney: a booking paid partly with wallet credit also carries its price / wallet / still-to-pay breakdown (display only; staff never get it - staffView drops it).

/** What a STAFF token gets: the booking minus its money. Staff screens use
 *  bookings for names, children, days and contacts (Families, trips,
 *  incidents) — never the amounts, what was paid, or payment references that
 *  would let someone match a family's money. A coach's token used to return
 *  every figure in the tenant. */
function staffView<T extends Record<string, unknown>>(b: T): T {
  return staffBookingView(b) as T; // an allow-list (lib/rosterRules.ts): anything not named there is never sent to staff
}

/** A booking, with its own field taking precedence over Firestore's stamp. */
function withCreated(d: FirebaseFirestore.QueryDocumentSnapshot | FirebaseFirestore.DocumentSnapshot) {
  const b = fromDoc(d.data() as BookingDoc);
  return { ...b, createdAt: b.createdAt ?? d.createTime?.toDate().toISOString() };
}

// GET /api/bookings/:ref
bookings.get("/:ref", async (req, res) => {
  const scope = operatorScope(req, res);
  if (!scope) return;
  // Platform must pass ?tenantId= to address a specific tenant's booking.
  const tenantId = scope.tenantId ?? (req.query.tenantId as string | undefined);
  if (!tenantId) {
    res.status(400).json({ error: "tenantId query param required for platform accounts" });
    return;
  }
  const doc = await (await resolveBookingRef(tenantId, req.params.ref)).get();
  const site = doc.exists ? await staffSiteScope(req.auth!) : null;
  if (!doc.exists || !inScope(doc.data() as BookingDoc, scope) || (site && !bookingInSite(doc.data()!, site))) {
    res.status(404).json({ error: "Booking not found" });
    return;
  }
  // Same fallback as the list, so opening a booking and seeing it in the list
  // never disagree about when it was made.
  // …plus, on a childcare booking, the derived block and the per-child payment
  // records (OUR minted reference to quote, and the booker's own alongside it).
  const one = withChildcare(withCreated(doc) as ChildcareBooking);
  if (one.status === "Waitlisted" && one.blockId) {
    const wl = await queuePositions(one.blockId, [one.ref]).catch(() => []);
    if (wl.length) (one as { waitlist?: unknown }).waitlist = wl.map(({ date, position }) => ({ date, position }));
  }
  const full = isChildcare(one) ? { ...one, childcarePayments: paymentRecordsOf(one) } : one; // `one` already went through withChildcare (+ money)
  res.json(scope.role === "staff" ? staffView(full as unknown as Record<string, unknown>) : full);
});

// GET /api/bookings/:ref/children — the full child record(s) for this booking's
// kids (same safeguarding projection the register uses), so the booking detail
// can show the identical child card. Scoped to the operator's own booking.
bookings.get("/:ref/children", async (req, res) => {
  const scope = managerScope(req, res);
  if (!scope) return;
  const tenantId = scope.tenantId ?? (req.query.tenantId as string | undefined);
  if (!tenantId) { res.status(400).json({ error: "tenantId query param required for platform accounts" }); return; }
  const doc = await (await resolveBookingRef(tenantId, req.params.ref)).get();
  if (!doc.exists || !inScope(doc.data() as BookingDoc, scope)) { res.status(404).json({ error: "Booking not found" }); return; }
  const b = fromDoc(doc.data() as BookingDoc);
  const kids = b.kids?.length ? b.kids.map((k) => ({ name: k.name, childId: k.childId })) : [{ name: b.child, childId: b.childId }];
  const ids = [...new Set(kids.map((k) => k.childId).filter(Boolean) as string[])];
  const childDocs = ids.length ? await db.getAll(...ids.map((id) => db.collection("children").doc(id))) : [];
  const byId = new Map(childDocs.filter((d) => d.exists).map((d) => {
    const c = d.data() as Record<string, unknown>;
    return [d.id, {
      photo: c.photo as string | undefined, dob: c.dob as string | undefined, school: c.school as string | undefined,
      allergies: c.allergies as string | undefined, medical: c.medical as string | undefined, dietary: c.dietary as string | undefined,
      send: c.send as string | undefined, sendPlanName: c.sendPlanName as string | undefined, sendPlanId: c.sendPlanId as string | undefined, careNotes: c.careNotes as string | undefined,
      collectionPassword: c.collectionPassword as string | undefined, emergencyName: c.emergencyName as string | undefined, emergencyPhone: c.emergencyPhone as string | undefined,
      photoConsent: c.photoConsent as boolean | undefined, likes: c.likes as string | undefined, dislikes: c.dislikes as string | undefined,
      swimming: c.swimming as string | undefined, sex: c.sex as string | undefined, suncreamConsent: c.suncreamConsent as boolean | undefined,
      firstAidConsent: c.firstAidConsent as boolean | undefined, walkHomeConsent: c.walkHomeConsent as boolean | undefined,
      answers: (c.answers as Record<string, string> | undefined) ?? undefined,
    }] as const;
  }));
  res.json({
    booker: b.booker, email: b.email ?? "", phone: realPhone(b.phone), ref: b.ref, note: b.note ?? "",
    children: kids.map((k) => ({ name: k.name, childId: k.childId ?? null, record: k.childId ? byId.get(k.childId) ?? null : null })),
  });
});

// POST /api/bookings — take a manual booking (into the caller's own scope)
bookings.post("/", async (req, res) => {
  const scope = operatorScope(req, res);
  if (!scope || !requireWrite(req, res)) return;
  // This route books a hand-typed amount and has no add-ons: refuse them rather than silently dropping what the provider chose.
  // Quick book / Take booking use POST /api/my/bookings with onBehalfOf, which prices and validates add-ons on the server.
  const sentExtras = req.body as { addons?: unknown; extras?: unknown; meals?: unknown } | undefined;
  if (sentExtras && (sentExtras.addons !== undefined || sentExtras.extras !== undefined || sentExtras.meals !== undefined)) {
    res.status(400).json({ error: "Add-ons can't be set on this route. Book on the family's behalf through POST /api/my/bookings (onBehalfOf) so the extras are priced and checked on the server." });
    return;
  }
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues });
    return;
  }
  const input = parsed.data;
  if (!input.blockId && !input.dates) {
    res.status(400).json({ error: "Provide blockId or a dates label" });
    return;
  }
  const tenantId = scope.tenantId!;
  const tenantRef = tenantsCol.doc(tenantId);

  // One child, one place per session (s13-rtE2): the same family's child who
  // already holds a place on this block's days isn't booked onto them again.
  if (input.blockId && input.child.trim()) {
    const blk = await db.collection("blocks").doc(input.blockId).get();
    const dates = blk.exists && blk.get("tenantId") === tenantId ? ((blk.get("sessions") as { date: string }[] | undefined) ?? []).map((x) => x.date) : [];
    const nm = input.child.trim().toLowerCase();
    const em = input.email.trim().toLowerCase();
    for (const d of (await col.where("blockId", "==", input.blockId).get()).docs) {
      const b = fromDoc(d.data() as BookingDoc);
      if (b.tenantId !== tenantId || (b.email ?? "").trim().toLowerCase() !== em) continue;
      if (dates.some((dt) => registerRows(b, dt).some((r) => r.expected && r.name.trim().toLowerCase() === nm))) {
        res.status(409).json({ error: `${input.child.trim()} already has a place on this block (booking ${b.ref}).` });
        return;
      }
    }
  }

  let tenantName = "Your activity provider";
  try {
    const booking = await db.runTransaction(async (tx) => {
      const tenantSnap = await tx.get(tenantRef);
      if (!tenantSnap.exists) throw new NotFound();
      tenantName = tenantSnap.data()!.name ?? tenantName;

      // Real block: capacity + waitlist semantics, sessions derived.
      let block: BlockDoc | null = null;
      let blockRef: FirebaseFirestore.DocumentReference | null = null;
      if (input.blockId) {
        blockRef = db.collection("blocks").doc(input.blockId);
        const blockSnap = await tx.get(blockRef);
        if (!blockSnap.exists || (blockSnap.data() as BlockDoc).tenantId !== tenantId)
          throw new BadRequest("Unknown block (must belong to your tenant)");
        block = blockSnap.data() as BlockDoc;
      }

      const seats = 1;
      // Operator bookings occupy every session (no day picker yet); day
      // scope needs a free place on each date, listing scope on the total.
      const hasSpace =
        !block ||
        (block.open &&
          ((block.capacityScope ?? "listing") === "day"
            ? daysHaveSpace(block, Object.fromEntries(block.sessions.map((s) => [s.date, seats]))).fits
            : block.bookedCount + seats <= block.capacity));
      const nextBid: number = tenantSnap.data()!.nextBid ?? 10312;
      // Attribute the booking to whichever franchise OWNS the listing (consistent
      // with split-fees + parent checkout), not the operator's own role — so an HO
      // phone-booking on a franchise's listing still counts to that franchise, and
      // a franchise can't pull an HO listing's booking into its own revenue.
      let listingFranchiseId: string | null = null;
      if (block?.listingId) {
        const lsnap = await tx.get(db.collection("listings").doc(block.listingId));
        listingFranchiseId = lsnap.exists ? ((lsnap.data() as { franchiseId?: string | null }).franchiseId ?? null) : null;
      } else if (scope.role === "franchise") {
        listingFranchiseId = scope.franchiseId; // no block (dates-label) — attribute to the creating franchise
      }
      // A franchise takes bookings on ITS OWN sessions only. Attribution above already keeps the booking out of its
      // revenue, but it would still eat a place on head office's / a sibling's block, land on THEIR register and email
      // the booker a payment link from the wrong brand.
      if (scope.role === "franchise" && block && listingFranchiseId !== scope.franchiseId)
        throw new BadRequest("Unknown block (must belong to your own listings)");
      const refPrefix = await refPrefixFor(tenantId);
      const b: Booking = {
        ...buildBooking(
          { ...input, dates: block ? block.name : input.dates! },
          nextBid,
          refPrefix,
        ),
        tenantId,
        checkoutId: randomUUID(), // a booking the operator takes is its own checkout
        ...(listingFranchiseId ? { franchiseId: listingFranchiseId } : {}),
        ...(block
          ? {
              blockId: input.blockId!,
              seats,
              sessions: block.sessions.map(sessionLabel),
              ...(hasSpace ? {} : { status: "Waitlisted" as const, note: "Waitlisted — block full." }),
            }
          : {}),
        // A £0 booking (HAF / free place) is Funded, not Unpaid — judged on
        // the amount, never the method's name.
        ...(input.amount <= 0 ? { pay: "Funded" as const } : {}),
      };
      // A childcare booking taken by the operator gets OUR minted payment
      // reference too (d8s2) — the same helper the parent checkout uses, so no
      // path creates a childcare booking with nothing to match its money by.
      attachChildcareRefs(b as ChildcareBooking, tenantId);
      tx.update(tenantRef, { nextBid: nextBid + 1 });
      if (block && blockRef && hasSpace)
        tx.update(blockRef, { ...countsUpdate(block, seats, bookingDays(b, block)) });
      tx.set(col.doc(bookingDocId(tenantId, b.ref)), toDoc(b));
      return b;
    });

    // Manual bookings sit unpaid until settled — the booker gets the
    // payment-link email. A £0 booking never gets a "pay this" email.
    if (booking.email.includes("@") && booking.status !== "Waitlisted" && booking.amount > 0)
      { emailPaymentLink(booking, tenantName); bellPayLink(booking, tenantId); }
    void upsertCustomerFromBooking(tenantId, booking);

    // "3 people are waiting for this date" — the take-a-booking UI shows
    // this when a full date lands the booking on the waiting list.
    if (booking.status === "Waitlisted" && booking.blockId) {
      const waitlist = await queuePositions(booking.blockId, [booking.ref]);
      res.status(201).json({ ...booking, ...(waitlist.length ? { waitlist } : {}) });
      return;
    }
    res.status(201).json(booking);
  } catch (e) {
    if (e instanceof BadRequest) res.status(400).json({ error: e.message });
    else if (e instanceof NotFound) res.status(404).json({ error: "Not found" });
    else throw e;
  }
});

// POST /api/bookings/:ref/actions — every single-booking mutation
// POST /api/bookings/:ref/refund-bank/reveal — hand the provider the family's bank details for a bank-transfer refund, ONCE: the doc is
// deleted the moment they are read, so the platform does not keep them. (If the provider misses them they ask the family again.)
bookings.post("/:ref/refund-bank/reveal", async (req, res) => {
  const scope = operatorScope(req, res);
  if (!scope || !requireWrite(req, res)) return;
  const tenantId = scope.tenantId ?? (req.query.tenantId as string | undefined);
  if (!tenantId) { res.status(400).json({ error: "tenantId required for platform accounts" }); return; }
  const bref = await resolveBookingRef(tenantId, req.params.ref);
  const bsnap = await bref.get();
  if (!bsnap.exists || !inScope(bsnap.data() as BookingDoc, scope)) { res.status(404).json({ error: "Booking not found" }); return; }
  const docRef = db.collection("refundBanks").doc(`${tenantId}_${req.params.ref}`);
  const out = await db.runTransaction(async (tx) => {
    const s = await tx.get(docRef);
    if (!s.exists) return null;
    const d = s.data() as { accountName?: string; sortCode?: string; accountNumber?: string };
    tx.delete(docRef);
    return { accountName: d.accountName ?? "", sortCode: d.sortCode ?? "", accountNumber: d.accountNumber ?? "" };
  });
  if (!out) { res.status(404).json({ error: "These bank details were already shown once and have been deleted. Ask the family to send them again." }); return; }
  res.setHeader("Cache-Control", "no-store");
  res.json(out);
});

bookings.post("/:ref/actions", async (req, res) => {
  const scope = operatorScope(req, res);
  if (!scope || !requireWrite(req, res)) return;
  const parsed = actionSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues });
    return;
  }
  const action = parsed.data;
  const ref = await resolveBookingRef(scope.tenantId!, req.params.ref);

  const tenantName = async () => {
    const t = await tenantsCol.doc(scope.tenantId!).get();
    return t.exists ? ((t.data()!.name as string) ?? "Your activity provider") : "Your activity provider";
  };

  try {
    // "resend" mutates nothing — re-send whichever email fits the booking:
    // a voucher booking's instructions (the one people lose) or the pay link.
    if (action.type === "resend") {
      const snap = await ref.get();
      if (!snap.exists || !inScope(snap.data() as BookingDoc, scope)) throw new NotFound();
      const b = fromDoc(snap.data() as BookingDoc);
      // A double click must not mail the family twice: one re-send per booking every 30 seconds.
      const waitS = resendWaitSeconds(b.invoiceResends, Date.now());
      if (waitS > 0) { res.status(429).json({ error: `You re-sent this a moment ago. Please wait ${waitS} seconds before sending it again.` }); return; }
      // This send is REMINDER number n (the first email was the original): the email and bell say so.
      const patch = remindersPatch(b, new Date().toISOString(), req.user?.name || req.user?.email || "provider");
      const reminder = { n: patch.invoiceResends.count, firstAt: reminderDateLabel(patch.invoiceSentAt) };
      if (b.email.includes("@")) {
        if (b.pay === "Awaiting voucher payment" && b.voucherScheme) {
          const lib = (await db.collection("libraries").doc(b.tenantId!).get()).data() ?? {};
          const providers = ((lib.settings as Record<string, unknown> | undefined)?.voucherProviders ?? []) as { name: string; details?: { label: string; value: string }[] }[];
          // TFC has no entry in the tenant's voucherProviders; it still gets its instructions, never a card pay link.
          const scheme = providers.find((v) => v.name === b.voucherScheme) ?? (/tax.?free|\btfc\b/i.test(b.voucherScheme) ? { name: b.voucherScheme, details: [] } : undefined);
          if (scheme) emailVoucherInstructions(b, await tenantName(), { name: scheme.name, details: (scheme.details ?? []).filter((d) => d.value?.trim()) }, {
            // Re-sends carry OUR minted reference(s) too — the family lost the
            // first email, and the reference is the point of it.
            payRefs: (childcareOf(b as ChildcareBooking).refs ?? []).map((r) => ({ child: r.child, reference: r.paymentReference })),
          });
          else { emailPaymentLink(b, await tenantName(), { reminder }); bellPayLink(b, b.tenantId ?? "", reminder); }
        } else {
          emailPaymentLink(b, await tenantName(), { reminder });
          bellPayLink(b, b.tenantId ?? "", reminder);
        }
        // ONE reminders log (Resend invoice, Chase and the automatic reminder all count here): the provider sees "Reminder sent 2× · last 7 Oct 19:50".
        Object.assign(b, patch);
        await ref.set(patch, { merge: true });
      }
      res.json(b);
      return;
    }

    // Set inside the transaction on refund-approve, so a failed money move
    // can put the refund back exactly as it was.
    let refundBefore: RefundSnapshot | null = null;
    // What had already come in before "Mark paid" — only the balance is new
    // money. Recording the full price double-counted a part-payment (d19s7).
    let receivedBefore = 0;
    // The status before the action, so the family is told about a cancellation exactly once (on the flip).
    let statusBefore = "";
    // Set by cancel-child / cancel-day: wallet credit is the one resolution that
    // moves money straight away (after the transaction commits).
    let release: ReturnType<typeof applyCancelDay> = null;
    let creditedInTx = false;
    const updated = await db.runTransaction(async (tx) => {
      creditedInTx = false;
      release = null; // (a retried transaction starts clean)
      const snap = await tx.get(ref);
      if (!snap.exists || !inScope(snap.data() as BookingDoc, scope)) throw new NotFound();
      const b = fromDoc(snap.data() as BookingDoc);
      const oldStatus = b.status;
      statusBefore = oldStatus;
      // What the booking held BEFORE this action (per child) — so cancelling ONE child frees ONE place (CN-019).
      const heldBefore = structuredClone({ status: b.status, seats: b.seats, days: b.days, kids: b.kids });
      receivedBefore = cashReceivedOf(b);

      // A card that is only HELD is settled by approving (the payment is taken then): "Mark paid" would count the money twice.
      if (action.type === "paid" && (b.cardHold?.state === "held" || b.cardHold?.state === "awaiting")) throw new Conflict("This booking's card is only held, not charged. Approving the booking takes the payment.");
      // Approve only a request that is waiting; decline only one that is waiting / on the list; never resurrect a cancelled or refunded booking
      // or keep a paid one's money while telling the family "nothing was taken".
      if (action.type === "approve") { const why = approveBlockedMessage(b.status); if (why) throw new Conflict(why); }
      if (action.type === "decline") { const why = declineBlockedMessage(b.status); if (why) throw new Conflict(why); }
      // A manual-approval booking paid by card can only be approved once the family's card is actually held.
      if (action.type === "approve" && b.cardHold?.state === "awaiting") throw new Conflict("The family hasn't entered their card yet, so this can't be approved. It will be cancelled automatically if they don't.");
      // An offer must be backed by a real free place (§E: "reject if the
      // date is still full") — promote stays the overbooking override.
      if (action.type === "offer") {
        if (b.status !== "Waitlisted") throw new Conflict(`Only waitlisted bookings can be offered (this one is ${b.status})`);
        if (b.blockId) {
          const blockSnap = await tx.get(db.collection("blocks").doc(b.blockId));
          if (blockSnap.exists) {
            const block = blockSnap.data() as BlockDoc;
            const days = bookingDays(b, block);
            const seats = bookingSeats(b);
            const fits =
              (block.capacityScope ?? "listing") === "day"
                ? daysHaveSpace(block, Object.fromEntries(days.map((d) => [d, seats]))).fits
                : block.bookedCount + seats <= block.capacity;
            if (!block.open || !fits) throw new Conflict("That date is still full — free a place first (or promote to overbook)");
            const capWhy = await capsProblem(tx, b, block, days);
            if (capWhy) throw new Conflict(`${capWhy} — free a place on it first (or promote to overbook)`);
          }
        }
      }

      // Moving a day is calendar- and capacity-aware: the target must be a
      // real session on the booking's block with space left (day scope), and
      // the block's per-day counts move with the child. Handles both shapes:
      // modern bookings (ISO `days` + `sessions` labels) and legacy
      // multi-child ones (label dates inside `kids`).
      let moveUpdate: {
        ref: FirebaseFirestore.DocumentReference;
        counts: ReturnType<typeof countsUpdate>;
      } | null = null;
      if (action.type === "change-day") {
        if (!b.blockId) throw new Conflict("This booking has no dated block to move within");
        const blockSnap = await tx.get(db.collection("blocks").doc(b.blockId));
        if (!blockSnap.exists) throw new Conflict("This booking's block no longer exists");
        const block = blockSnap.data() as BlockDoc;
        const labelOf = (s: BlockDoc["sessions"][number]) => sessionLabel(s).split(" · ")[0];
        const isIso = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v);
        const toIso = (v: string) => (isIso(v) ? v : block.sessions.find((s) => labelOf(s) === v)?.date ?? v);
        const oldIso = toIso(action.oldDate);
        const newSess = block.sessions.find((s) => s.date === toIso(action.newDate));
        if (!newSess) throw new Conflict(`This block doesn't run on ${action.newDate}`);
        const days = bookingDays(b, block);
        if (!days.includes(oldIso)) throw new Conflict(`${action.oldDate} isn't on this booking`);
        if (days.includes(newSess.date)) throw new Conflict(`${action.newDate} is already on this booking`);
        // One child moves one seat — never the whole booking's seat count.
        if (countsTowardCapacity(b.status)) {
          if ((block.capacityScope ?? "listing") === "day" && !daysHaveSpace(block, { [newSess.date]: 1 }).fits)
            throw new Conflict(`${labelOf(newSess)} is full — free a place first`);
          const dec = countsUpdate(block, -1, [oldIso]);
          moveUpdate = { ref: blockSnap.ref, counts: countsUpdate({ ...block, ...dec }, 1, [newSess.date]) };
        }
        // Modern shape: `days` + `sessions` are what registers read.
        if (b.days?.length) {
          b.days = [...b.days.filter((d) => d !== oldIso), newSess.date].sort();
          const have = new Set(b.days);
          b.sessions = block.sessions.filter((s) => have.has(s.date)).map(sessionLabel);
        }
        // Legacy/multi-child shape: swap inside that child's own list, in
        // whichever format the list already uses.
        if (b.kids?.length) {
          const k = b.kids[action.ki];
          const ix = k?.dates ? k.dates.findIndex((d) => d === action.oldDate || toIso(d) === oldIso) : -1;
          if (k?.dates && ix > -1) k.dates[ix] = isIso(k.dates[ix]) ? newSess.date : labelOf(newSess);
        }
        // The child's extras move with the day (a daily one follows its day, a one-off follows the new first day): the same rule as an approved date change.
        moveAddonDays(b.addonLines, b.kids?.length ? b.kids[action.ki]?.name : undefined, oldIso, newSess.date);
      }

      // Approving a date change moves seats between days: keep the block's per-day counts in step (the old day frees a
      // place, the new one takes it) and refuse a move into a day that has filled up since the request was made.
      if (action.type === "move-approve" && b.dateChangeRequest && b.dateChangeRequest.status === "pending" && b.blockId && countsTowardCapacity(b.status)) {
        const blockSnap = await tx.get(db.collection("blocks").doc(b.blockId));
        if (blockSnap.exists) {
          const block = blockSnap.data() as BlockDoc;
          const idxs = action.approveIndexes ?? b.dateChangeRequest.moves.map((_, i) => i);
          let cur: BlockDoc = block;
          for (const [i, m] of b.dateChangeRequest.moves.entries()) {
            if (!idxs.includes(i) || !m.from || !m.to || m.from === m.to) continue;
            if ((cur.capacityScope ?? "listing") === "day" && !daysHaveSpace(cur, { [m.to]: 1 }).fits)
              throw new Conflict(`${m.to} is full now — it can't be approved`);
            const dec = countsUpdate(cur, -1, [m.from]);
            cur = { ...cur, ...countsUpdate({ ...cur, ...dec }, 1, [m.to]) };
          }
          moveUpdate = { ref: blockSnap.ref, counts: { bookedCount: cur.bookedCount, dayCounts: cur.dayCounts ?? {} } };
        }
      }

      // A refund is approved ONCE. Replaying the action used to credit the
      // wallet again, or fire a second Stripe refund.
      if (action.type === "refund-approve") {
        if (!b.cancel) throw new Conflict("There's no cancellation on this booking to refund");
        if (b.cancel.refund === "approved") throw new Conflict("This refund has already been approved");
        if (b.cancel.refund === "declined") throw new Conflict("This refund was declined");
        // A cancellation whose policy gives nothing back ("none", or an amount of 0) has nothing to approve. Approving it used to flip the booking
        // to "Refunded" with GBP0 refunded and email the family "refund approved". (To give money back anyway, cancel again with a full/partial amount.)
        if (b.cancel.refund === "none" || (typeof b.cancel.amount === "number" && b.cancel.amount <= 0.004))
          throw new Conflict("No refund is due on this cancellation, so there is nothing to approve. To give money back, issue a refund with an amount.");
        // Snapshot BEFORE the action flips pay to "Refunded" — what's still
        // refundable is worked out from this, not from the flipped booking.
        if (refundableSoFar(b) <= 0.005)
          throw new Conflict("Everything paid on this booking has already been refunded (for example in Stripe), so there is nothing left to approve.");
        // A pending PARTIAL refund whose money was also refunded in the Stripe dashboard is not approved by accident: ask first, change nothing.
        if (!("confirmAlreadyRefunded" in action && action.confirmAlreadyRefunded === true)) {
          const w = alreadyRefundedWarning(b);
          if (w) throw new AlreadyRefundedInStripe(w);
        }
        refundBefore = { refund: b.cancel.refund, pay: b.pay, refundable: refundableSoFar(b), attempts: (b.cancel as { refundAttempts?: number }).refundAttempts ?? 0 };
      }

      // Declining only makes sense for a refund that is still waiting and still has money to give back. After a refund in Stripe has
      // covered it, a decline used to be accepted and emailed the family a 'Refund update'.
      if (action.type === "refund-decline") {
        if (!b.cancel) throw new Conflict("There's no cancellation on this booking to decline a refund for");
        if (b.cancel.refund === "approved") throw new Conflict("This refund has already been approved or refunded");
        if (b.cancel.refund === "declined") throw new Conflict("This refund was already declined");
        if (refundableSoFar(b) <= 0.005) throw new Conflict("Everything paid on this booking has already been refunded (for example in Stripe), so there is nothing to decline.");
        // And only while it is still waiting (pending / full / partial): once recorded, sent, credited or card-refunded it is final.
        { const st = b.cancel.refund; if (!(st === "pending" || st === "full" || st === "partial")) throw new Conflict(st === "none" ? "There is no refund waiting on this booking to decline" : "This refund has already been approved, so it can't be declined"); }
      }

      // The provider confirms they SENT an offline refund that was only recorded at approval.
      if (action.type === "refund-sent") {
        // Any recorded offline refund still waiting counts, even if a newer refund has since replaced the booking's single cancel record.
        if (!refundAwaitingTransfer(b)) {
          if (b.cancel?.refund === "approved" && b.cancel.refundVia === "offline" && b.cancel.refundTransfer === "sent") throw new Conflict("This refund is already marked as sent");
          throw new Conflict("There is no recorded bank / cash / voucher refund waiting to be sent on this booking");
        }
      }

      // Marking a booking paid only makes sense for one that is live: on a cancelled / declined / waiting-list booking it used to
      // record a payment and email "Payment received" for a place the family doesn't have.
      if (action.type === "paid" && !canMarkPaid(b.status))
        throw new Conflict(paidBlockedMessage(b.status));

      // The booking's whole price (cash + wallet spent) before this action takes its share off: the whole-amount rule for add-on refunds compares with it.
      const grossBefore = (b.amount ?? 0) + Math.max(0, (b.walletApplied ?? 0) - (b.walletRelieved ?? 0));
      switch (action.type) {
        case "cancel":
          // Cancelling an already-cancelled booking used to be accepted
          // silently — applyCancel would overwrite the existing cancel
          // record and reset cancel.refund back to "full", which reopens
          // the refund-approve replay guard above (it only checks
          // b.cancel.refund !== "approved") and lets a refund be
          // re-approved a second time (bk4).
          if (b.status === "Cancelled") throw new Conflict("This booking is already cancelled");
          applyCancel(b, action.refund, action.amount, action.reason);
          break;
        case "cancel-child":
          if (b.status === "Cancelled") throw new Conflict("This booking is already cancelled");
          release = applyCancelChild(b, action.ki, { resolution: action.resolution, amount: action.amount });
          break;
        case "cancel-day":
          if (b.status === "Cancelled") throw new Conflict("This booking is already cancelled");
          release = applyCancelDay(b, action.ki, action.date, { resolution: action.resolution, amount: action.amount });
          break;
        case "addon-approve":
        case "addon-decline": {
          if (b.status === "Cancelled" || b.status === "Declined") throw new Conflict("This booking is cancelled, so there is nothing to change.");
          try {
            if (action.type === "addon-approve") {
              const out = approveAddonRequest(b, action.requestId, { resolution: action.resolution, amount: action.amount, by: "Provider", today: ukToday(), cutoffDays: await addonCutoffDays(b) });
              release = out.release as typeof release;
            } else declineAddonRequest(b, action.requestId, action.reason, "Provider");
          } catch (e) {
            if (e instanceof AddonRequestError) throw e.status === 409 ? new Conflict(e.message) : new BadRequest(e.message);
            throw e;
          }
          break;
        }
        case "change-day":
          break; // fully handled above, block-aware
        case "refund-sent":
          applyRowAction(b, "refund-sent");
          if (b.cancel) b.cancel.refundSentBy = req.user?.email ?? "operator";
          break;
        case "note":
          applyNote(b, action.text);
          break;
        case "move-approve":
          applyMoveApprove(b, action.approveIndexes, action.reason, {
            // Setup > Amending dates > admin fee (AM-011), from the booking's own Setup (a franchise runs on its own).
            fee: b.tenantId ? Number((await loadSettings(b.tenantId, b.franchiseId ?? null)).amendFee) || 0 : 0,
          });
          break;
        case "move-deny":
          if (b.dateChangeRequest) {
            b.dateChangeRequest.status = "denied";
            b.dateChangeRequest.reason = action.reason;
            b.dateChangeRequest.resolvedAt = new Date().toISOString();
            b.note = "Date change declined.";
          }
          break;
        default:
          // "resend" returned early above, so only real row actions reach here.
          applyRowAction(b, action.type as Exclude<typeof action.type, "resend">);
          // Keep the operator's decline note on the record so it can be shown
          // back in the portal and relayed in the email below.
          if (action.type === "decline" && "reason" in action && action.reason?.trim())
            b.declineReason = action.reason.trim();
      }

      // Keep the block's place counts — total AND per day — in step with
      // the status transition (promote may intentionally exceed capacity —
      // operator's overbook). Firestore requires all reads before writes.
      // Did the add-ons go back with this refund? The provider's YES/NO (kept on the cancel record when there is one) or, when not asked, the default:
      // a whole-booking "full" refund, or a child's whole place refunded in full => yes; partial / day-only / none => no. The answer is STORED on the
      // lines (addonRefund.ts) whether or not a cancel record exists (a wallet credit has none), and is never un-done by a later cancel.
      if (action.type === "decline") stampAddonRefund(b, { scope: "whole" }, false);
      if (action.type === "cancel" || action.type === "cancel-child" || action.type === "cancel-day") {
        if (action.refundsAddons !== undefined && b.cancel) b.cancel.refundsAddons = action.refundsAddons;
        const moved = action.type === "cancel" ? action.refund !== "none" : !!release && release.resolution !== "none" && release.amount > 0;
        // ONE rule (addonRefund.ts addonsGoBack): the provider's YES/NO, else a full refund, or any refund as big as the WHOLE booking (a "partial" of that size,
        // a cancel-child with an explicit amount that covers the whole booking, a cancel-day that removes the last remaining day).
        const refundedAmount = action.type === "cancel" ? (b.cancel?.amount ?? 0) : release?.amount ?? 0;
        const lastDay = bookingKids(b).every((k) => k.cancelled || kidActiveDays(k).length === 0);
        const refunded = addonsGoBack({ kind: action.type, moved, grossBefore, refundedAmount, refund: action.type === "cancel" ? action.refund : undefined,
          explicitAmount: action.type === "cancel-child" ? action.amount : undefined, refundsAddons: action.refundsAddons, lastDay });
        const kidName = action.type === "cancel" ? "" : (b.kids?.[action.ki]?.name ?? b.child ?? "");
        // The refund this mark belongs to is still waiting for the provider (a wallet credit is final): declining it takes the mark back.
        const waiting = refunded && b.cancel && b.cancel.refund !== "none" && b.cancel.refund !== "declined" && (action.type === "cancel" || release?.resolution === "refund") ? b.cancel : null;
        stampAddonRefund(b, action.type === "cancel" ? { scope: "whole" } : action.type === "cancel-child" ? { scope: "child", child: kidName } : { scope: "day", child: kidName, date: action.date }, refunded, waiting);
      }
      const perChild = action.type === "cancel-child" || action.type === "cancel-day";
      const delta = b.blockId ? blockCountDelta(oldStatus, b.status, bookingSeats(b)) : 0;
      let blockUpdate: {
        ref: FirebaseFirestore.DocumentReference;
        counts: ReturnType<typeof countsUpdate>;
      } | null = null;
      if (b.blockId && (delta !== 0 || perChild) && action.type !== "change-day") {
        const blockSnap = await tx.get(db.collection("blocks").doc(b.blockId));
        if (blockSnap.exists) {
          const blockData = blockSnap.data() as BlockDoc;
          const pd = placesDelta(
            heldPlaces(heldBefore, blockData),
            heldPlaces(b, blockData),
          );
          if (!placesDeltaIsZero(pd)) blockUpdate = { ref: blockSnap.ref, counts: applyPlacesDelta(blockData, pd) };
        }
      }

      // A cancelled child/day/extra given back as WALLET CREDIT is instant: it is credited in THIS transaction (all reads before the writes),
      // once per (booking, action, child, day), so the booking and the money cannot disagree and a replay cannot credit twice.
      const rel0 = release as ReturnType<typeof applyCancelDay>;
      const creditKey = `rel_${ref.id}_prov_${action.type}_${"ki" in action ? action.ki : ""}_${"date" in action ? action.date : ""}_${"requestId" in action ? action.requestId : ""}`.replace(/\//g, "_").slice(0, 1400);
      const credit = !!rel0 && rel0.resolution === "wallet" && rel0.amount > 0 && !!b.tenantId;
      const [walletSnap, entrySnap] = credit ? await Promise.all([tx.get(walletRef(b.tenantId!, b.email)), tx.get(walletEntryRef(creditKey))]) : [null, null];
      // The wallet already got back its share of what was credited (so a later refund of this booking splits over what is really left).
      if (credit) noteInstantWalletCredit(b, rel0.amount);
      tx.set(ref, toDoc(b));
      if (blockUpdate) tx.update(blockUpdate.ref, { ...blockUpdate.counts });
      if (moveUpdate) tx.update(moveUpdate.ref, { ...moveUpdate.counts });
      creditedInTx = credit && creditWalletOnceInTx(tx, b.tenantId!, b.email, walletSnap!.exists ? Number(walletSnap!.get("balance") ?? 0) : 0, entrySnap!.exists, creditKey, rel0!.amount, `Credit from ${b.listing}`, b.ref);
      return b;
    });

    // Manual-approval card hold: approving TAKES the held payment (and WAITS for it - a hold that has lapsed puts the request back);
    // declining or cancelling lets the family's card go.
    const heldApproval = isFirstHeldApproval(action.type, statusBefore, updated);
    if (heldApproval) {
      const cap = await captureHolds([updated]);
      if (!cap.ok) {
        // Put the request back ONLY if it is still the approved, unpaid booking this attempt confirmed: a cancel / decline that landed meanwhile must not be undone.
        await db.runTransaction(async (tx) => { const cur = fromDoc((await tx.get(ref)).data() as BookingDoc); if (cur.status === "Confirmed" && cur.pay !== "Paid" && cur.cardHold?.state === "held") tx.update(ref, { status: "Approval needed" }); });
        res.status(502).json({ error: cap.error });
        return;
      }
    } else if ((action.type === "decline" || action.type === "cancel") && (updated.cardHold?.state === "held" || updated.cardHold?.state === "awaiting")) {
      await releaseHolds([updated]).catch((e) => console.error("[cardHold] release failed:", (e as Error).message));
    }

    // Approving a refund sends the money — and WAITS for it. It used to be
    // fire-and-forget: the booking said Refunded and the family was told the
    // money was on its way whether or not Stripe accepted it. Now a failure
    // puts the refund back to awaiting approval and the operator sees why.
    if (action.type === "refund-approve") {
      // (Assigned inside the transaction callback — TS can't see that.)
      const back = refundBefore as RefundSnapshot | null;
      let moved: Awaited<ReturnType<typeof settleApprovedRefund>>;
      try {
        moved = await settleApprovedRefund(updated, scope.tenantId!, back?.refundable ?? refundableSoFar(updated), back?.attempts ?? 0);
      } catch (e) {
        // A throw (settings read, a payments write, the wallet) is a failure
        // too — the revert must run, or the booking is stuck "approved" with
        // nothing moved and a retry blocked.
        moved = { ok: false, error: e instanceof Error ? e.message : "unexpected error" };
      }
      if (!moved.ok) {
        // Put the refund back as it was, on the booking as it is NOW (a refund made in Stripe meanwhile is on it), and if that
        // refund has covered the pending one, resolve it in the same step instead of leaving it 'pending'.
        await db.runTransaction(async (tx) => {
          const snap = await tx.get(ref);
          if (!snap.exists) return;
          const cur = fromDoc(snap.data() as BookingDoc);
          cur.cancel = { ...(cur.cancel ?? updated.cancel ?? { on: "", by: "" }), refund: back?.refund ?? "pending", refundError: moved.error, refundAttempts: (back?.attempts ?? 0) + 1 } as typeof cur.cancel;
          cur.pay = back?.pay ?? cur.pay;
          resolvePendingCancel(cur, new Date().toISOString());
          tx.set(ref, toDoc(cur));
        });
        // Stripe's message usually ends in its own full stop ("Charge … has
        // already been refunded.") — don't print a second one.
        const why = String(moved.error ?? "").replace(/\s*\.\s*$/, "");
        res.status(502).json({ error: `The refund didn't go through: ${why}. Nothing was marked refunded — try again, or refund it in Stripe directly.` });
        return;
      }
      // The wallet credit for THIS approval is credited in the same transaction that writes the refund record, under an id that is the same for a retry
      // of this approval and different for the next one: it can never be credited twice (and never without the record).
      const cents = (n: number) => Math.round(n * 100);
      const walletKey = `wref_${ref.id}_${cents(updated.refundedApproved ?? 0)}_${cents(updated.walletRefunded ?? 0)}_${cents(moved.owed)}`.replace(/\//g, "_").slice(0, 1400);
      const cashPart = Math.round(Math.max(0, moved.owed - moved.walletCredit) * 100) / 100;
      // refundedAt: when the money actually moved (cancel.on is when it was
      // asked for) — Reconciliation's "refunded today" keys off this (d9s7).
      updated.cancel = { ...(updated.cancel ?? { on: "", by: "" }), refundVia: moved.via, refundedAt: new Date().toISOString(), refundError: undefined, refundCash: cashPart };
      // An OFFLINE refund (bank transfer / cash / voucher) is only RECORDED: the app cannot send it. It stays "awaiting your transfer" until the
      // provider confirms they sent it (action "refund-sent"), unless they say they already did.
      const alreadySent = "alreadySent" in action && action.alreadySent === true;
      markRefundRecorded(updated, moved.via, alreadySent, req.user?.email ?? "operator");
      if ((moved.via === "offline" || moved.offlinePart > 0) && alreadySent && updated.tenantId) await markOfflineRefundSent(updated.tenantId, updated.ref, req.user?.email ?? "operator").catch((e) => console.error("[refund-sent] ledger update failed:", (e as Error).message));
      if (moved.partial) updated.pay = "Partially refunded";
      updated.refundedApproved = Math.round(((updated.refundedApproved ?? 0) + moved.owed) * 100) / 100;
      updated.walletRefunded = Math.round(((updated.walletRefunded ?? 0) + moved.walletPart) * 100) / 100;
      // The parent Payments page builds its Refunds list (and refundTotal)
      // from refundLog only (PaymentsApp.tsx:145) — a whole-booking approved
      // refund used to write cancel.refundedAt/refundedApproved/walletRefunded
      // but no refundLog entry, so it never showed there (only per-day
      // releases, my.ts partialCancel, did). Add one here too.
      const refundLabel = moved.partial ? "Refund approved (partial)" : "Refund approved";
      // One entry per approved refund PER METHOD: what the provider still has to send is the sum of the offline ones not yet sent (see unsentRefunds()).
      const sentNow = moved.via !== "offline" || alreadySent;
      const nowIso = new Date().toISOString();
      // The wallet part is its OWN entry (credited at once: status sent); the card share (already sent through Stripe) and the OFFLINE share are
      // separate entries too, so the offline money stays "awaiting your transfer" (Finance, Refunds to send, the reminder, reconcile) until the provider
      // marks it sent.
      type Entry = NonNullable<typeof updated.refundEntries>[number];
      // An OFFLINE entry also records what each way of paying gets back (bank transfer / cash / voucher), penny-correct: the provider's prompts, the
      // reminder and the family's messages name those methods (features/bookings/refundMethod.ts).
      const paidParts = paidOfflineParts(updated);
      const mkEntry = (amount: number, cash: number, via: "wallet" | "card" | "offline", sent: boolean): Entry => {
        const parts = via === "offline" ? splitOverParts(cash, paidParts) : [];
        return ({ id: randomUUID(), amount, cash, via, status: sent ? "sent" : "approved", approvedAt: nowIso, ...(sent ? { sentAt: nowIso } : {}), ...(parts.length ? { parts } : {}) }) as Entry;
      };
      const offlineShare = moved.offlinePart;
      updated.refundEntries = updated.refundEntries ?? [];
      if (moved.walletCredit > 0) updated.refundEntries.push(mkEntry(moved.walletCredit, 0, "wallet", true));
      const mainAmount = Math.round((cashPart - offlineShare) * 100) / 100;
      if (mainAmount > 0.004) updated.refundEntries.push(mkEntry(mainAmount, mainAmount, moved.via === "wallet" ? "offline" : moved.via, sentNow));
      if (offlineShare > 0) updated.refundEntries.push(mkEntry(offlineShare, offlineShare, "offline", alreadySent));
      const lastSent = (moved.via === "offline" || offlineShare > 0) && alreadySent ? { amount: offlineShare > 0 ? offlineShare : cashPart, at: nowIso } : null;
      if (lastSent) updated.lastRefundSent = lastSent;
      const logEntry = {
        label: refundLabel,
        kind: moved.partial ? "approvedPartial" : "approved",
        amount: moved.owed,
        on: ukToday(),
        by: "Provider",
        source: moved.via === "wallet" ? "Wallet" : moved.via === "offline" ? "Offline" : "Card",
      };
      (updated.refundLog = updated.refundLog ?? []).push(logEntry);
      // Written ON TOP of the booking as it is now, never from the copy read before the money moved: a refund made in the Stripe
      // dashboard while this one was in flight has added its own 'Refunded in Stripe' line, and the old whole-field write erased it.
      await db.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        // (all reads before the writes) the wallet balance and the idempotency entry of this approval's credit.
        const [walletSnap, entrySnap] = moved.walletCredit > 0 && updated.tenantId
          ? await Promise.all([tx.get(walletRef(updated.tenantId, updated.email)), tx.get(walletEntryRef(walletKey))])
          : [null, null];
        const cur = snap.exists ? fromDoc(snap.data() as BookingDoc) : updated;
        cur.cancel = { ...(cur.cancel ?? {}), ...(updated.cancel ?? {}) } as typeof cur.cancel;
        delete (cur.cancel as { refundError?: string } | null)?.refundError;
        cur.refundedApproved = Math.round(((cur.refundedApproved ?? 0) + moved.owed) * 100) / 100;
        cur.walletRefunded = Math.round(((cur.walletRefunded ?? 0) + moved.walletPart) * 100) / 100;
        cur.refundLog = [...(cur.refundLog ?? []), logEntry];
        // Entries: the stored ones win (a concurrent 'sent' mark stays), plus any this request archived or created.
        const have = new Set((cur.refundEntries ?? []).map((e) => e.id));
        cur.refundEntries = [...(cur.refundEntries ?? []), ...(updated.refundEntries ?? []).filter((e) => !have.has(e.id))];
        if (lastSent) cur.lastRefundSent = lastSent;
        rememberCashHeld(cur);
        cur.pay = refundableSoFar(cur) <= 0.005 ? "Refunded" : moved.partial ? "Partially refunded" : updated.pay;
        tx.set(ref, toDoc(cur));
        // The wallet credit, once, together with the record. (On the payments ledger too, like card and offline refunds, so Reconciliation matches.)
        if (walletSnap && entrySnap && updated.tenantId) {
          const credited = creditWalletOnceInTx(tx, updated.tenantId, updated.email, walletSnap.exists ? Number(walletSnap.get("balance") ?? 0) : 0, entrySnap.exists, walletKey, moved.walletCredit, `Credit from ${updated.listing}`, updated.ref);
          if (credited) tx.set(db.collection("payments").doc(`wallet-${walletKey}`.slice(0, 1400)), {
            tenantId: updated.tenantId, refs: [updated.ref], email: updated.email, type: "refund", amount: moved.walletCredit, currency: "gbp",
            method: "wallet", via: "wallet", status: "credited", createdAt: new Date().toISOString(),
          });
        }
      });
    }

    // The family's bank details (typed for a bank-transfer refund) are not kept once the provider has dealt with the request.
    // (An approved OFFLINE refund keeps them until the provider has sent it: they need the account details to make the transfer.)
    const keepBank = action.type === "refund-approve" && ((updated.cancel?.refundVia === "offline" && updated.cancel?.refundTransfer === "awaiting") || refundAwaitingTransfer(updated));
    if ((action.type === "refund-approve" || action.type === "refund-decline" || action.type === "refund-sent") && updated.cancel?.refundBank && updated.tenantId && !keepBank) {
      delete updated.cancel.refundBank;
      await ref.update({ "cancel.refundBank": FieldValue.delete() }).catch(() => {});
      await db.collection("refundBanks").doc(`${updated.tenantId}_${updated.ref}`).delete().catch(() => {});
    }

    // A cancelled child/day given back as WALLET CREDIT is instant by design: credit the wallet and put it
    // on the payments ledger (like a wallet refund-approve) so reconciliation matches the booking.
    const rel = release as ReturnType<typeof applyCancelDay>; // (assigned inside the transaction callback — TS can't see that)
    if (rel && rel.resolution === "wallet" && rel.amount > 0 && updated.tenantId && creditedInTx) {
      await db.collection("payments").add({
        tenantId: updated.tenantId, refs: [updated.ref], email: updated.email, type: "refund", amount: rel.amount, currency: "gbp",
        method: "wallet", via: "wallet", status: "credited", createdAt: new Date().toISOString(),
      }).catch((e) => console.error(`[refunds] wallet ledger write failed for ${updated.ref}:`, (e as Error).message));
    }

    // Status-change emails to the booker (fire-and-forget).
    if (updated.email.includes("@")) {
      if (action.type === "approve" || action.type === "promote") {
        // "Booking confirmed" goes out ONCE per confirmation: approving / promoting a booking that was already Confirmed (a double click, or
        // an approve after the family accepted an offered place) changes nothing and must not mail the family a second time.
        const askToPay = shouldAskToPayAfterApproval(action.type, updated);
        if (askToPay && shouldEmailConfirmed(action.type, statusBefore)) {
          // Approved, but nothing has been taken (its card hold went when the other child on the card was approved): ask them to pay, don't say "booked in".
          emailPaymentLink(updated, await tenantName(), true);
          void notify({
            tenantId: scope.tenantId!,
            to: { kind: "parent", email: updated.email },
            category: "billing",
            title: `Approved — please pay · ${updated.ref}`,
            body: `${updated.listing}${updated.child ? ` · ${updated.child}` : ""} — your booking is approved. Pay £${(updated.amount ?? 0).toFixed(2)} to complete it.`,
            href: `/custdash/bookings?pay=${encodeURIComponent(updated.ref)}`,
            ref: updated.ref,
            bellOnly: true,
          });
        }
        else if (shouldEmailConfirmed(action.type, statusBefore) && !(action.type === "approve" && heldApproval)) emailBookingConfirmed(updated, await tenantName());
      }
      else if (action.type === "offer") {
        emailPlaceOffered(updated, await tenantName());
        // The email alone is easy to miss (and is held back while mail isn't
        // live), so also raise the family's bell with the deadline.
        const until = updated.offerExpiresAt ? new Date(updated.offerExpiresAt as string).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" }) : "";
        void notify({
          tenantId: scope.tenantId!,
          to: { kind: "parent", email: updated.email },
          category: "booking",
          bellOnly: true,
          title: `A place is available · ${updated.ref}`,
          body: `${updated.listing}${updated.child ? ` · ${updated.child}` : ""} — a place has come up and is being held for you${until ? ` until ${until}` : ""}. Accept and pay to take it.`,
          href: `/custdash/bookings?pay=${encodeURIComponent(updated.ref)}`,
          ref: updated.ref,
        });
      }
      else if (action.type === "decline") emailBookingDeclined(updated, await tenantName(), updated.declineReason);
      else if (action.type === "refund-decline") {
        emailRefundDeclined(updated, await tenantName());
        const amt = updated.cancel?.amount ?? 0;
        void notify({
          tenantId: scope.tenantId!,
          to: { kind: "parent", email: updated.email },
          category: "billing",
          bellOnly: true,
          ...(() => { const b = parentBell("refund-declined", { ref: updated.ref, listing: updated.listing, ...(amt > 0 ? { amt: `£${amt.toFixed(2)}` } : {}) }); return { title: b.title, body: b.body!, i18n: b.i18n }; })(),
          href: `/custdash/bookings?open=${encodeURIComponent(updated.ref)}`,
          ref: updated.ref,
        });
      }
      else if (action.type === "refund-sent") {
        // The provider confirmed the transfer: flip the ledger row, then tell the family it has actually been sent.
        if (updated.tenantId) await markOfflineRefundSent(updated.tenantId, updated.ref, req.user?.email ?? "operator").catch((e) => console.error("[refund-sent] ledger update failed:", (e as Error).message));
        emailRefundSent(updated, await tenantName());
        const sentAmt = refundTransferAmount(updated);
        void notify({
          tenantId: scope.tenantId!,
          to: { kind: "parent", email: updated.email },
          category: "billing",
          bellOnly: true,
          title: parentBell("refund-sent", { ref: updated.ref }).title, i18n: { tk: parentBell("refund-sent", { ref: updated.ref }).i18n.tk, tv: { ref: updated.ref } },
          body: `£${sentAmt.toFixed(2)} for ${updated.listing} has been sent${(() => { const ks = unsentKinds(updated); return ks.length ? ` ${methodHow(ks, enTr, enJoin)}${updated.voucherScheme && ks.includes("voucher") ? ` (${updated.voucherScheme})` : ""}` : updated.voucherScheme ? ` through ${updated.voucherScheme}` : ""; })()}${updated.cancel?.refundSentAt ? ` on ${ukDateLabel(updated.cancel.refundSentAt)}` : ""}.`,
          href: `/custdash/bookings?open=${encodeURIComponent(updated.ref)}`,
          ref: updated.ref,
        });
      }
      else if (action.type === "refund-approve") {
        const providerLabel = await tenantName();
        emailRefundApproved(updated, providerLabel);
        // …and raise the family's in-app bell (email-only before, so it never
        // showed in their notifications). bellOnly — the email above is the mail.
        const toWallet = updated.cancel?.refundTo === "wallet";
        const amt = updated.cancel?.amount ?? 0;
        void notify({
          tenantId: scope.tenantId!,
          to: { kind: "parent", email: updated.email },
          category: "billing",
          bellOnly: true,
          ...(() => {
            // An offline refund names the method(s) actually paid (cash / bank transfer / voucher, a mix included): features/bookings/refundMethod.ts.
            const ks = updated.cancel?.refundVia === "offline" ? unsentKinds(updated) : [];
            const kind = toWallet ? "wallet-added" as const
              : updated.cancel?.refundVia === "offline"
                ? (ks.length ? "refund-approved-offline" as const : updated.voucherScheme ? "refund-approved-scheme" as const : /bank|transfer|bacs/i.test(updated.method ?? "") ? "refund-approved-bank" as const : "refund-approved-plain" as const)
                : "refund-approved-card" as const;
            const b = parentBell(kind, {
              ref: updated.ref, amt: `£${amt.toFixed(2)}`, listing: updated.listing, scheme: updated.voucherScheme ?? "",
              ...(ks.length ? { kinds: ks.join(","), methods: methodNames(ks, enTr, enJoin), provider: providerLabel } : {}),
            });
            return { title: b.title, body: b.body!, i18n: b.i18n };
          })(),
          href: `/custdash/bookings?open=${encodeURIComponent(updated.ref)}`,
          ref: updated.ref,
        });
      }
    }

    // The family hears the provider's answer to an extra request (once: a repeated approve is a 409 above and never reaches here).
    if ((action.type === "addon-approve" || action.type === "addon-decline") && updated.email?.includes("@")) {
      const r = (updated.addonRequests ?? []).find((x) => x.id === action.requestId);
      if (r) {
        const providerName = await tenantName();
        emailAddonDecision(updated, providerName, r);
        void notify({
          tenantId: scope.tenantId!,
          to: { kind: "parent", email: updated.email },
          category: "booking",
          bellOnly: true,
          // Plain sentences in the family's own language (key + data), e.g. "Your tshirty change was approved" / "...changed from size xl to size m".
          ...(() => { const t = bellText(decisionWording(r, { ref: updated.ref, listing: updated.listing, awaitingTransfer: refundNeedsProviderTransfer(updated), provider: providerName, ...recordedKinds(updated) })); return { title: t.title, body: t.body, i18n: t.i18n }; })(),
          href: `/custdash/bookings?open=${encodeURIComponent(updated.ref)}`,
          ref: updated.ref,
        });
      }
    }

    // The family hears about a cancellation once: on the action that flipped the booking to Cancelled (a repeat cancel is a 409).
    if ((action.type === "cancel" || action.type === "cancel-child" || action.type === "cancel-day") && shouldNotifyCancelled(statusBefore, updated.status))
      notifyFamilyCancelled(updated, await tenantName(), "provider");

    // Offline settlements (TFC, HAF, PayPal, cash) become payment records
    // too — reconciliation needs an entry, not just a flag.
    const balance = Math.round(Math.max(0, (updated.amount ?? 0) - receivedBefore) * 100) / 100;
    // Nothing new to record when it was already paid in full (a £0 funded
    // place still gets its £0 entry, as before).
    if (action.type === "paid" && (balance > 0 || (updated.amount ?? 0) <= 0)) {
      void db.collection("payments").add({
        tenantId: updated.tenantId ?? scope.tenantId,
        refs: [updated.ref],
        email: updated.email,
        amount: balance,
        currency: "gbp",
        method: updated.method,
        offline: true,
        status: "recorded",
        recordedBy: req.user?.email ?? "operator",
        createdAt: new Date().toISOString(),
      });
      // Tell the family their voucher/cash/TFC payment has landed (rich email + bell).
      const label = updated.voucherScheme ? `voucher (${updated.voucherScheme})` : (updated.method ?? "payment").toLowerCase();
      void notifyPaymentReceived(updated.tenantId ?? scope.tenantId!, updated, label).catch((e) => console.error("[actions:paid] payment-received notify failed:", (e as Error).message));
    }

    // Freed seats pass to the queue (auto mode); promotes report who's
    // still waiting so the UI can warn about overbooking.
    if (updated.blockId && (action.type === "decline" || action.type === "cancel" || action.type === "cancel-child" || action.type === "cancel-day"))
      void triggerWaitlist(updated.blockId);
    // A booking that ended without the place (declined, or cancelled with no money kept) gives its discount code back
    // (single-use codes become usable again once nothing in the basket is standing). Safe to repeat: the release is idempotent.
    if (shouldReleaseDiscountCodes(updated)) void releaseDiscountCodes(scope.tenantId!, updated.ref);
    stopOpenPayments(updated);
    // Meals ordered for the released days, and trips on them (lib/cancelCleanup).
    // Only on the action that cancelled it — a note or "paid" on a booking that
    // was cancelled weeks ago mustn't sweep meals/trips again.
    if (action.type === "cancel" && updated.status === "Cancelled") void cleanupAfterCancel(scope.tenantId!, updated);
    else if (action.type === "cancel-day") {
      // Just that one child's day — not their siblings' meals.
      const kid = updated.kids?.[action.ki];
      const one = kid ? { ...updated, childId: kid.childId, child: kid.name, kids: [kid] } : updated;
      void cleanupAfterCancel(scope.tenantId!, one, [action.date]);
    }
    // Tell the family the outcome of their date-change request. The EMAIL is the
    // provider-branded one (their logo, each from → to date, approved/declined);
    // the notify here is bell-only so the family doesn't also get the plain
    // ActivityOS-branded version.
    if ((action.type === "move-approve" || action.type === "move-deny") && updated.email?.includes("@")) {
      const req = updated.dateChangeRequest;
      const someDeclined = (req?.moves ?? []).some((m) => m.approved === false);
      const outcome: "approved" | "declined" | "partial" =
        action.type === "move-deny" ? "declined" : someDeclined ? "partial" : "approved";
      emailDateChangeResolved(updated, await tenantName(), {
        outcome,
        moves: (req?.moves ?? []).map((m) => ({ from: m.from, to: m.to, approved: m.approved })),
        timing: (req as { timing?: string } | undefined)?.timing,
        reason: req?.reason,
      });
      const fmtDay = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
      const moved = (req?.moves ?? []).filter((m) => m.approved && m.to).map((m) => fmtDay(m.to!)).join(", ");
      void notify({
        tenantId: scope.tenantId!,
        to: { kind: "parent", email: updated.email },
        category: "booking",
        bellOnly: true,
        title:
          outcome === "declined"
            ? `Date change declined · ${updated.ref}`
            : outcome === "partial"
              ? `Date change part-approved · ${updated.ref}`
              : `Date change approved · ${updated.ref}`,
        body:
          outcome === "declined"
            ? `${updated.listing}: your provider couldn't make the change.${req?.reason ? ` Reason: ${req.reason}` : ""}`
            : `${updated.listing}: you're now booked on ${moved || "the new date(s)"}.${req?.reason && outcome === "partial" ? ` Note: ${req.reason}` : ""}`,
        // Open the exact booking card so the family sees the change straight away.
        href: `/custdash/bookings?open=${encodeURIComponent(updated.ref)}`,
        ref: updated.ref,
      });
    }
    if (action.type === "promote" && updated.blockId) {
      const waiting = await waitingCount(updated.blockId, updated.days ?? []);
      res.json({ ...updated, ...(waiting ? { waiting } : {}) });
      return;
    }

    res.json(updated);
  } catch (e) {
    if (e instanceof NotFound) res.status(404).json({ error: "Booking not found" });
    else if (e instanceof Conflict) res.status(409).json({ error: e.message });
    else if (e instanceof AlreadyRefundedInStripe) res.status(409).json({ error: e.message, code: "already_refunded_in_stripe", ...e.w });
    // A refused extra request (addon-approve with no choice about a price difference...) is the provider's to fix, not a server fault.
    else if (e instanceof BadRequest) res.status(400).json({ error: e.message });
    else throw e;
  }
});

// POST /api/bookings/bulk
// POST /api/bookings/:ref/record-payment — reconciliation: log money
// received against a booking (bank transfer, TFC, voucher, cash…). Partial-
// aware: accumulates amountPaid, and the pay state follows the total —
// Paid when covered, "Partially paid" when not. Writes a payment record so
// the money trail is complete. Operators only.
//
// Guards (acceptance d8s5/d8s7/d8s8, manual analogue of the TFC feed):
//  • The SAME payment logged twice — same booking, same amount, same reference
//    (blank counts as the same), dated within DUP_WINDOW_MS of each other — is
//    refused with 409 `possible_duplicate` unless the operator confirms it's a
//    second real payment (`confirmDuplicate`). Two people logging one bank
//    line used to count the money twice.
//  • More than the booking's price → still recorded (the money did arrive),
//    but the surplus is returned as `overpaid` and shown on Reconciliation as
//    credit / to refund — no longer silently absorbed as "Paid".
//  • Money on a cancelled/declined booking → recorded as `receivedAfterCancel`
//    and kept on Reconciliation as "needs refund / credit" (it used to drop off).
const DUP_WINDOW_MS = 24 * 60 * 60 * 1000;
const recordPaymentSchema = z.object({
  amount: z.number().positive().max(1_000_000),
  method: z.string().max(60).optional(),
  reference: z.string().max(120).optional(),
  // The day the money arrived: stored as the payment's createdAt and compared with Date.parse, so "garbage" must not get in.
  date: z.string().max(25).refine((d) => Number.isFinite(Date.parse(d)), "Not a real date").optional(),
  confirmDuplicate: z.boolean().optional(),
});
const refKey = (r: unknown) => String(r ?? "").replace(/\s+/g, "").toUpperCase();
class Duplicate extends Error { constructor(public prior: { amount: number; reference: string | null; createdAt: string; recordedBy?: string }) { super("possible_duplicate"); } }
class Overpay extends Error { constructor(public bookingAmount: number, public alreadyPaid: number, public attempted: number) { super("overpay"); } }
bookings.post("/:ref/record-payment", async (req, res) => {
  const scope = operatorScope(req, res);
  if (!scope || !requireWrite(req, res)) return;
  const tenantId = scope.tenantId ?? (req.query.tenantId as string | undefined);
  if (!tenantId) {
    res.status(400).json({ error: "tenantId required for platform accounts" });
    return;
  }
  const parsed = recordPaymentSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues });
    return;
  }
  const ref = await resolveBookingRef(tenantId, req.params.ref);
  const nowIso = new Date().toISOString();
  const paidAt = parsed.data.date ?? nowIso;
  try {
    const updated = await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists || !inScope(snap.data() as BookingDoc, scope)) throw new NotFound();
      const b = fromDoc(snap.data() as BookingDoc);
      // Read under the transaction (it also writes the booking), so a double
      // submit is serialised and the second one sees the first's record.
      if (!parsed.data.confirmDuplicate) {
        const prior = await tx.get(db.collection("payments").where("refs", "array-contains", b.ref));
        const t0 = Date.parse(paidAt);
        const dup = prior.docs.map((d) => d.data()).find((p) =>
          p.tenantId === tenantId && p.offline === true && p.status === "recorded" && p.type !== "refund"
          && Math.abs(Number(p.amount ?? 0) - parsed.data.amount) < 0.005
          && refKey(p.reference) === refKey(parsed.data.reference)
          && Number.isFinite(t0) && Math.abs(Date.parse(String(p.createdAt ?? "")) - t0) <= DUP_WINDOW_MS);
        if (dup) throw new Duplicate({ amount: Number(dup.amount), reference: (dup.reference as string | null) ?? null, createdAt: String(dup.createdAt ?? ""), recordedBy: dup.recordedBy as string | undefined });
      }
      // A card that is only HELD is settled by approving (the payment is taken then): recording money against it would count it twice,
      // and on a decline it would leave a "Paid" booking nobody paid for.
      if (cardHeldBlocksPayment(b)) throw new Conflict(CARD_HELD_MESSAGE);
      const paid = Math.round(((b.amountPaid ?? 0) + parsed.data.amount) * 100) / 100;
      // A booking still awaiting/part-paid can't be recorded past its own total
      // — that's almost always a typo (an extra digit) rather than a genuine
      // overpayment. Cancelled/Declined bookings are exempt: money arriving
      // after cancellation is tracked separately via receivedAfterCancel below
      // and is a real, expected case (e.g. a late cheque clearing).
      if (b.status !== "Cancelled" && b.status !== "Declined" && paid > (b.amount ?? 0) + 0.005) {
        throw new Overpay(b.amount ?? 0, b.amountPaid ?? 0, parsed.data.amount);
      }
      b.amountPaid = paid;
      b.pay = paid >= (b.amount ?? 0) ? "Paid" : "Partially paid";
      // How THIS money came in (bank transfer / cash / voucher), so a later refund names the methods actually paid, a mix included.
      const paidKind = kindOfMethod(parsed.data.method ?? b.method, b.voucherScheme);
      if (paidKind) b.paidVia = { ...(b.paidVia ?? {}), [paidKind]: Math.round(((b.paidVia?.[paidKind] ?? 0) + parsed.data.amount) * 100) / 100 };
      if (b.status === "Cancelled" || b.status === "Declined")
        b.receivedAfterCancel = Math.round(((b.receivedAfterCancel ?? 0) + parsed.data.amount) * 100) / 100;
      tx.set(ref, toDoc(b));
      // Record the money for reconciliation/oversight — in the same write, so
      // the duplicate check above always sees it.
      tx.set(db.collection("payments").doc(), {
        tenantId,
        refs: [b.ref],
        email: b.email,
        amount: parsed.data.amount,
        currency: "gbp",
        method: parsed.data.method ?? b.method,
        reference: parsed.data.reference ?? null,
        offline: true,
        status: "recorded",
        recordedBy: req.user?.email ?? "operator",
        createdAt: paidAt,
        recordedAt: nowIso,
      });
      return b;
    });
    // Money has arrived another way: any card payment still open for this booking was sized for a balance that no longer exists.
    await (await import("../lib/checkoutIntent")).cancelOpenIntents(tenantId, [updated.ref]).catch(() => {});
    const overpaid = overpaidOf(updated);
    res.json({ ...updated, ...(overpaid > 0 ? { overpaid } : {}) });
  } catch (e) {
    if (e instanceof NotFound) res.status(404).json({ error: "Booking not found" });
    else if (e instanceof Conflict) res.status(409).json({ error: e.message });
    else if (e instanceof Overpay) {
      const outstanding = Math.round(Math.max(0, e.bookingAmount - e.alreadyPaid) * 100) / 100;
      res.status(400).json({
        error: `${money(e.attempted)} is more than this booking's ${money(outstanding)} outstanding balance (${money(e.bookingAmount)} total, ${money(e.alreadyPaid)} already recorded) — check the amount.`,
      });
    }
    else if (e instanceof Duplicate) {
      const when = new Date(e.prior.createdAt);
      const day = Number.isNaN(when.getTime()) ? "recently" : `on ${when.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "Europe/London" })}`;
      res.status(409).json({
        error: `This looks like a payment that's already been logged: ${money(e.prior.amount)}${e.prior.reference ? ` with reference ${e.prior.reference}` : ""} was recorded against this booking ${day}${e.prior.recordedBy ? ` by ${e.prior.recordedBy}` : ""}. Only record it again if it's a second, separate payment.`,
        code: "possible_duplicate",
        prior: e.prior,
      });
    }
    else throw e;
  }
});

// POST /api/bookings/:ref/reconcile — one-click reconcile: mark the booking's
// off-platform payment (voucher, TFC, cash, manual card…) fully received. Sets
// it Paid (or Funded for £0), writes a payment record, and tells the family by
// email + notification so it shows in their bookings/payments area. `undo`
// reverts a mistaken reconcile back to awaiting (no email — it's a correction).
const reconcileSchema = z.object({
  method: z.string().max(60).optional(),
  reference: z.string().max(120).optional(),
  date: z.string().max(25).refine((d) => Number.isFinite(Date.parse(d)), "Not a real date").optional(),
  undo: z.boolean().optional(),
});
bookings.post("/:ref/reconcile", async (req, res) => {
  const scope = operatorScope(req, res);
  if (!scope || !requireWrite(req, res)) return;
  const tenantId = scope.tenantId ?? (req.query.tenantId as string | undefined);
  if (!tenantId) { res.status(400).json({ error: "tenantId required for platform accounts" }); return; }
  const parsed = reconcileSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues }); return; }
  const undo = !!parsed.data.undo;
  const ref = await resolveBookingRef(tenantId, req.params.ref);
  // Only the balance is new money — a part-payment logged earlier already has
  // its own record (same fix as "Mark paid", d19s7).
  let receivedBefore = 0;
  try {
    const updated = await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists || !inScope(snap.data() as BookingDoc, scope)) throw new NotFound();
      const b = fromDoc(snap.data() as BookingDoc);
      if (!undo && cardHeldBlocksPayment(b)) throw new Conflict(CARD_HELD_MESSAGE);
      receivedBefore = cashReceivedOf(b);
      if (undo) {
        b.amountPaid = 0;
        b.pay = (b.amount ?? 0) <= 0 ? "Funded" : b.voucherScheme ? "Awaiting voucher payment" : "Unpaid";
        b.reconciledBy = null;
        delete b.paidVia;
      } else {
        // The balance that arrives now came in by the method given here (the booking's own method otherwise).
        const rk = kindOfMethod(parsed.data.method ?? b.method, b.voucherScheme);
        const newMoney = Math.round(Math.max(0, (b.amount ?? 0) - receivedBefore) * 100) / 100;
        if (rk && newMoney > 0) b.paidVia = { ...(b.paidVia ?? {}), [rk]: Math.round(((b.paidVia?.[rk] ?? 0) + newMoney) * 100) / 100 };
        b.amountPaid = b.amount ?? 0;
        b.pay = (b.amount ?? 0) <= 0 ? "Funded" : "Paid";
        // Stamped by hand here. A machine match (HMRC EPP) sets auto: true.
        b.reconciledBy = { at: new Date().toISOString(), by: req.user?.name ?? req.user?.email ?? "operator", auto: false };
      }
      tx.set(ref, toDoc(b));
      return b;
    });
    if (!undo) {
      const label = updated.voucherScheme ? `voucher (${updated.voucherScheme})` : (parsed.data.method ?? updated.method ?? "payment").toLowerCase();
      const balance = Math.round(Math.max(0, (updated.amount ?? 0) - receivedBefore) * 100) / 100;
      if (balance > 0 || (updated.amount ?? 0) <= 0) void db.collection("payments").add({
        tenantId, refs: [updated.ref], email: updated.email,
        amount: balance, currency: "gbp",
        method: parsed.data.method ?? updated.method, reference: parsed.data.reference ?? null,
        offline: true, status: "recorded", recordedBy: req.user?.email ?? "operator",
        createdAt: parsed.data.date ?? new Date().toISOString(),
      });
      void notifyPaymentReceived(tenantId, updated, label).catch((e) => console.error("[reconcile] payment-received notify failed:", (e as Error).message));
    } else {
      // Undo puts amountPaid back to 0, so the offline money recorded against
      // it is no longer "in" — mark those records reversed, or the Dashboard's
      // "taken" keeps counting money Finance says never arrived (d19s7).
      const recs = await db.collection("payments").where("refs", "array-contains", updated.ref).get();
      await Promise.all(recs.docs
        .filter((d) => d.get("tenantId") === tenantId && d.get("offline") === true && d.get("status") === "recorded" && d.get("type") !== "refund")
        .map((d) => d.ref.update({ status: "reversed", reversedAt: new Date().toISOString(), reversedBy: req.user?.email ?? "operator" })));
    }
    res.json(updated);
  } catch (e) {
    if (e instanceof NotFound) res.status(404).json({ error: "Booking not found" });
    else if (e instanceof Conflict) res.status(409).json({ error: e.message });
    else throw e;
  }
});

// POST /api/bookings/:ref/nudge — remind a family their off-platform payment is
// still owed. Emails + notifies them, bumps the nudge counter (the bell colours
// once nudged) and records when. Can be sent repeatedly.
bookings.post("/:ref/nudge", async (req, res) => {
  const scope = operatorScope(req, res);
  if (!scope || !requireWrite(req, res)) return;
  const tenantId = scope.tenantId ?? (req.query.tenantId as string | undefined);
  if (!tenantId) { res.status(400).json({ error: "tenantId required for platform accounts" }); return; }
  const ref = await resolveBookingRef(tenantId, req.params.ref);
  try {
    const updated = await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists || !inScope(snap.data() as BookingDoc, scope)) throw new NotFound();
      const b = fromDoc(snap.data() as BookingDoc);
      const why = nudgeBlockedMessage(b);
      if (why) throw new Conflict(why);
      // A double click must not remind the family twice: one reminder per booking every 30 seconds.
      const waitS = resendWaitSeconds(b.invoiceResends ?? (b.lastNudgedAt ? { count: b.nudges ?? 1, lastAt: b.lastNudgedAt } : undefined), Date.now());
      if (waitS > 0) throw new TooSoon(`You reminded them a moment ago. Please wait ${waitS} seconds before chasing again.`);
      Object.assign(b, remindersPatch({ invoiceResends: b.invoiceResends ?? (b.nudges ? { count: b.nudges, lastAt: b.lastNudgedAt ?? "" } : undefined), invoiceSentAt: b.invoiceSentAt, createdAt: b.createdAt }, new Date().toISOString(), req.user?.name || req.user?.email || "provider"));
      tx.set(ref, toDoc(b));
      return b;
    });
    const outstanding = Math.max(0, (updated.amount ?? 0) - (updated.amountPaid ?? 0));
    const bookedMs = Date.parse(updated.createdAt ?? "");
    const days = Number.isNaN(bookedMs) ? 0 : Math.max(0, Math.floor((Date.now() - bookedMs) / 86400000));
    const nRem = updated.invoiceResends?.count ?? 1;
    // A card booking gets the pay-link email as a REMINDER (same pay button); bank / voucher bookings keep their instructions-style reminder below.
    const cardChase = /card/i.test(updated.method ?? "") && !updated.voucherScheme && outstanding > 0;
    if (cardChase && updated.email?.includes("@")) {
      const tn = (await tenantsCol.doc(tenantId).get()).get("name") as string | undefined;
      emailPaymentLink(updated, tn || "Your activity provider", { reminder: { n: nRem, firstAt: reminderDateLabel(updated.invoiceSentAt) } });
      bellPayLink(updated, tenantId, { n: nRem });
    } else if (updated.email?.includes("@")) {
      const how = updated.voucherScheme ? `${updated.voucherScheme} voucher` : updated.method;
      const when = updated.dates ? ` on ${updated.dates}` : "";
      const times = (updated.sessions ?? []).slice(0, 3).join("; ");
      void notify({
        tenantId,
        to: { kind: "parent", email: updated.email },
        category: "billing",
        title: `Payment reminder · ${updated.ref}`,
        body: `Reminder ${nRem}: a friendly reminder about ${updated.child}'s place on ${updated.listing}${when}: £${outstanding.toFixed(2)} is still to pay${days ? ` (booked ${days} day${days === 1 ? "" : "s"} ago)` : ""}.${times ? ` Sessions: ${times}.` : ""} Please complete your ${how} payment when you can — thank you!`,
        subject: `Payment reminder ${nRem} for ${updated.ref}`,
        href: `/custdash/bookings?open=${encodeURIComponent(updated.ref)}`,
        ref: updated.ref,
      });
    }
    res.json(updated);
  } catch (e) {
    if (e instanceof NotFound) res.status(404).json({ error: "Booking not found" });
    else if (e instanceof TooSoon) res.status(429).json({ error: e.message });
    else if (e instanceof Conflict) res.status(409).json({ error: e.message });
    else throw e;
  }
});

// PUT /api/bookings/:ref/payment-ref — the provider corrects the parent's
// payment reference (e.g. the voucher account ref traced differently in the
// bank). Saves it and notifies the family so their booking shows the new one.
// PUT /api/bookings/:ref/recon-notes — provider-only reconciliation notes.
// Never shown to or emailed to the parent (internal money-matching notes).
const reconNotesSchema = z.object({ note: z.string().trim().min(1).max(2000) });
bookings.put("/:ref/recon-notes", async (req, res) => {
  const scope = operatorScope(req, res);
  if (!scope || !requireWrite(req, res)) return;
  const tenantId = scope.tenantId ?? (req.query.tenantId as string | undefined);
  if (!tenantId) { res.status(400).json({ error: "tenantId required for platform accounts" }); return; }
  const parsed = reconNotesSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues }); return; }
  const ref = await resolveBookingRef(tenantId, req.params.ref);
  try {
    const updated = await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists || !inScope(snap.data() as BookingDoc, scope)) throw new NotFound();
      const b = fromDoc(snap.data() as BookingDoc);
      b.reconNotes = [...(b.reconNotes ?? []), { at: new Date().toISOString(), by: req.user?.name ?? req.user?.email ?? "operator", text: parsed.data.note }];
      tx.set(ref, toDoc(b));
      return b;
    });
    res.json(updated);
  } catch (e) {
    if (e instanceof NotFound) res.status(404).json({ error: "Booking not found" });
    else throw e;
  }
});

// PUT /api/bookings/:ref/voucher-scheme — name WHICH voucher provider paid.
// Nothing captures this at booking time today, so 59 of 59 voucher bookings on
// this instance read as a generic "Childcare voucher" and an operator can't tell
// an Edenred payment from a Fideliti one when matching the bank. Set here, when
// the money lands and you can see who sent it. Empty string clears it.
const voucherSchemeSchema = z.object({ voucherScheme: z.string().trim().max(80) });
bookings.put("/:ref/voucher-scheme", async (req, res) => {
  const scope = operatorScope(req, res);
  if (!scope || !requireWrite(req, res)) return;
  const tenantId = scope.tenantId ?? (req.query.tenantId as string | undefined);
  if (!tenantId) { res.status(400).json({ error: "tenantId required for platform accounts" }); return; }
  const parsed = voucherSchemeSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues }); return; }
  const ref = await resolveBookingRef(tenantId, req.params.ref);
  try {
    const updated = await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists || !inScope(snap.data() as BookingDoc, scope)) throw new NotFound();
      const b = fromDoc(snap.data() as BookingDoc);
      b.voucherScheme = parsed.data.voucherScheme || undefined;
      tx.set(ref, toDoc(b));
      return b;
    });
    res.json(updated);
  } catch (e) {
    if (e instanceof NotFound) res.status(404).json({ error: "Booking not found" });
    else throw e;
  }
});

// PUT /api/bookings/:ref/payment-ref — corrects the reference the BOOKER gave
// us (their own voucher/HMRC account reference), e.g. when the bank shows it
// differently. It is NOT our minted payment reference: that one we issued, the
// family already has it, and it is never edited. So the family is only asked to
// quote something here when we never minted one for them (a pre-minting
// booking) — otherwise the email tells them ours, which is the one that matches.
const paymentRefSchema = z.object({ paymentRef: z.string().trim().max(120) });
bookings.put("/:ref/payment-ref", async (req, res) => {
  const scope = operatorScope(req, res);
  if (!scope || !requireWrite(req, res)) return;
  const tenantId = scope.tenantId ?? (req.query.tenantId as string | undefined);
  if (!tenantId) { res.status(400).json({ error: "tenantId required for platform accounts" }); return; }
  const parsed = paymentRefSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues }); return; }
  const ref = await resolveBookingRef(tenantId, req.params.ref);
  try {
    const updated = await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists || !inScope(snap.data() as BookingDoc, scope)) throw new NotFound();
      const b = fromDoc(snap.data() as BookingDoc) as ChildcareBooking;
      b.paymentRef = parsed.data.paymentRef;
      // Mirror it into the childcare block under its honest name, so the two
      // references stay distinguishable wherever the block is read.
      if (isChildcare(b)) {
        const prev = (b.childcare && typeof b.childcare === "object" ? b.childcare : {}) as ChildcarePayment;
        b.childcare = { ...prev, bookerReference: parsed.data.paymentRef || null };
      }
      tx.set(ref, toDoc(b));
      return b;
    });
    if (updated.email?.includes("@")) {
      // Ours if we have one; theirs only for a booking taken before minting.
      const ours = childcareOf(updated).paymentReference;
      void notify({
        tenantId,
        to: { kind: "parent", email: updated.email },
        category: "billing",
        title: `Payment reference updated · ${updated.ref}`,
        body: ours
          ? `${updated.listing}: we've noted your ${updated.voucherScheme ? `${updated.voucherScheme} account` : "scheme account"} reference as "${updated.paymentRef}". When you pay, please still quote our payment reference ${ours} — that's the one that matches the money to this booking.`
          : `${updated.listing}: we've updated the payment reference for your ${updated.voucherScheme ? `${updated.voucherScheme} voucher` : updated.method} payment to "${updated.paymentRef}". Please use this reference so we can match your payment.`,
        subject: `Payment reference updated for ${updated.ref}`,
        href: `/custdash/bookings?open=${encodeURIComponent(updated.ref)}`,
        ref: updated.ref,
      });
    }
    res.json(updated);
  } catch (e) {
    if (e instanceof NotFound) res.status(404).json({ error: "Booking not found" });
    else throw e;
  }
});

/** Bulk cancel cannot carry a refund decision: a booking that has received money must be cancelled one at a time (QA-C D2). */
class BulkPaidCancel extends Error { constructor(public refs: string[]) { super("paid_cancel"); } }
class BulkOverCapacity extends Error { constructor(public block: string, public over: number) { super("over_capacity"); } }

bookings.post("/bulk", async (req, res) => {
  const scope = operatorScope(req, res);
  if (!scope || !requireWrite(req, res)) return;
  const parsed = bulkSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues });
    return;
  }
  const { refs, action } = parsed.data;
  // Resolve each ref to its doc first (handles random/legacy ids), then read
  // inside the transaction.
  const docRefs = await Promise.all(refs.map((r) => resolveBookingRef(scope.tenantId!, r)));
  const updated = await db.runTransaction(async (tx) => {
    const snaps = await Promise.all(docRefs.map((dr) => tx.get(dr)));
    // Mutate + aggregate block deltas first (all reads must precede
    // writes). Each entry keeps the booking's days so per-day counts move
    // too (undefined days = every session, resolved once the block loads).
    const out: { snap: FirebaseFirestore.DocumentSnapshot; b: Booking }[] = [];
    const deltas = new Map<string, { delta: number; days?: string[] }[]>();
    const paidRefs: string[] = [];
    for (const snap of snaps) {
      if (!snap.exists || !inScope(snap.data() as BookingDoc, scope)) continue;
      const b = fromDoc(snap.data() as BookingDoc);
      const oldStatus = b.status;
      if (action === "approve" && (b.cardHold?.state === "awaiting" || approveBlockedMessage(b.status) || b.status === "Confirmed")) continue; // card not entered yet / not a waiting request: nothing to approve
      if (action === "decline" && declineBlockedMessage(b.status)) continue; // a confirmed or cancelled booking is not declined
      // Cancelling a booking that has taken money needs a refund decision (the policy figure, to the card or the wallet): that is the single
      // cancel's job. Bulk used to cancel it, keep the money and tell the family "No refund".
      if (action === "cancel" && blocksBulkCancel(b)) paidRefs.push(b.ref);
      applyBulkAction(b, action);
      // A bulk cancel / decline moves no money (paid bookings are refused above): the add-ons are KEPT as bought, same defaults as a single cancel with no refund.
      if (action === "cancel" || action === "decline") stampAddonRefund(b, { scope: "whole" }, false);
      if (b.blockId) {
        const d = blockCountDelta(oldStatus, b.status, bookingSeats(b));
        if (d !== 0) {
          const arr = deltas.get(b.blockId) ?? [];
          arr.push({ delta: d, days: b.days });
          deltas.set(b.blockId, arr);
        }
      }
      out.push({ snap, b });
    }
    if (paidRefs.length) throw new BulkPaidCancel(paidRefs);
    const blockSnaps = await Promise.all(
      [...deltas.keys()].map((id) => tx.get(db.collection("blocks").doc(id))),
    );
    for (const { snap, b } of out) tx.set(snap.ref, toDoc(b));
    for (const blockSnap of blockSnaps) {
      if (!blockSnap.exists) continue;
      let blockData = blockSnap.data() as BlockDoc;
      for (const entry of deltas.get(blockSnap.id)!) {
        const counts = countsUpdate(blockData, entry.delta, bookingDays({ days: entry.days }, blockData));
        blockData = { ...blockData, ...counts };
      }
      // Approving is all-or-nothing, so it must not overshoot the block:
      // 50 approvals on a block of 26 used to confirm all 50 (p2-o17).
      if (action === "approve" && (blockData.capacityScope ?? "listing") !== "day" && blockData.bookedCount > blockData.capacity) {
        throw new BulkOverCapacity(blockData.name ?? blockSnap.id, blockData.bookedCount - blockData.capacity);
      }
      tx.update(blockSnap.ref, {
        bookedCount: blockData.bookedCount,
        dayCounts: blockData.dayCounts ?? {},
      });
    }
    return out.map((x) => x.b);
  }).catch((e: unknown) => { if (e instanceof BulkOverCapacity || e instanceof BulkPaidCancel) return e; throw e; });
  if (updated instanceof BulkPaidCancel) {
    res.status(409).json({ error: `Paid bookings must be cancelled one at a time so the refund is decided (${updated.refs.slice(0, 5).join(", ")}${updated.refs.length > 5 ? " …" : ""}). Open each booking and choose Cancel, then pick the refund.`, code: "paid_cancel_single", refs: updated.refs });
    return;
  }
  if (updated instanceof BulkOverCapacity) {
    res.status(409).json({ error: `Approving these would put ${updated.block} ${updated.over} place${updated.over === 1 ? "" : "s"} over capacity — approve fewer, or waitlist the rest.`, code: "over_capacity", over: updated.over });
    return;
  }
  // A bulk cancel is still a provider cancellation: each family hears about it once (email + bell), like a single cancel.
  if (action === "cancel") {
    const nm = ((await db.collection("tenants").doc(updated[0]?.tenantId ?? "none").get()).get("name") as string) || "Your activity provider";
    for (const b of updated) if (b.status === "Cancelled") notifyFamilyCancelled(b, nm, "provider");
  }
  // Card holds (manual approval): approving takes the held payments, declining / cancelling releases them.
  if (action === "approve") {
    const toTake = updated.filter((b) => b.status === "Confirmed" && b.cardHold?.state === "held");
    if (toTake.length) {
      const cap = await captureHolds(toTake);
      if (!cap.ok) {
        await Promise.all(toTake.map((b) => db.runTransaction(async (tx) => { const r2 = db.collection("bookings").doc(bookingDocId(b.tenantId!, b.ref)); const cur = fromDoc((await tx.get(r2)).data() as BookingDoc); if (cur.status === "Confirmed" && cur.pay !== "Paid" && cur.cardHold?.state === "held") tx.update(r2, { status: "Approval needed" }); })));
        res.status(502).json({ error: cap.error });
        return;
      }
    }
  } else if (action === "decline" || action === "cancel") {
    await releaseHolds(updated.filter((b) => b.cardHold?.state === "held" || b.cardHold?.state === "awaiting")).catch((e) => console.error("[cardHold] bulk release failed:", (e as Error).message));
  }
  // A bulk decline / cancel gives each booking's discount code back, exactly like the single action does.
  if (action === "decline" || action === "cancel") for (const b of updated) if (shouldReleaseDiscountCodes(b)) void releaseDiscountCodes(scope.tenantId!, b.ref);
  if (action === "decline" || action === "cancel") for (const b of updated) stopOpenPayments(b);
  // Bulk declines/cancellations free seats — let the queues know.
  if (action === "decline" || action === "cancel" || action === "waitlist") {
    for (const blockId of new Set(updated.map((b) => b.blockId).filter(Boolean) as string[]))
      void triggerWaitlist(blockId);
  }
  res.json(updated);
});

/** The provider confirmed they sent an offline refund: its payments-ledger row(s) go from "to-reimburse" to "succeeded" (the totals every money
 *  screen reads are unchanged: both statuses count). Idempotent. */
export async function markOfflineRefundSent(tenantId: string, bookingRef: string, by: string): Promise<number> {
  const snap = await db.collection("payments").where("refs", "array-contains", bookingRef).get();
  const batch = db.batch();
  let n = 0;
  for (const d of snap.docs) {
    const p = d.data() as { tenantId?: string; type?: string; status?: string };
    if (p.tenantId === tenantId && p.type === "refund" && p.status === "to-reimburse") { batch.update(d.ref, { status: "succeeded", sentAt: new Date().toISOString(), sentBy: by }); n++; }
  }
  if (n) await batch.commit();
  return n;
}

/** "7 Oct 2026" from an ISO stamp, in UK time. */
const ukDateLabel = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Europe/London" });

/**
 * Move the money for an approved refund. Returns once it has actually moved.
 *
 *  - The refund TOTAL is already decided (policy / the provider's own figure). Where it goes is PROPORTIONAL to what each source paid
 *    (features/bookings/refundSplit.ts): the wallet credit spent on the booking goes BACK TO THE WALLET in its share (gross 100 = wallet 30 + card
 *    70, refund 50 -> 15 to the wallet, 35 to the card). This function only works the split out and moves the CARD / offline money; the wallet
 *    credit is credited by the caller, in the same transaction that writes the refund record, once (idempotent ledger id).
 *  - The rest goes where the family asked. If the provider has turned card
 *    refunds off (Setup → allowCardRefund) it's wallet credit regardless — the
 *    screen enforced that, the server took "card" from anyone who asked.
 *  - A card booking is refunded through Stripe (awaited; the one step that
 *    can fail, so it runs FIRST and nothing is credited if it does) - for the
 *    CARD part only, never more than the card still holds.
 *  - A voucher/TFC/cash booking can't be refunded by the app. It's recorded as
 *    owed back offline, and the family is told it comes back the way they paid
 *    — not "to your card", which it never touched.
 */
async function settleApprovedRefund(b: Booking, tenantId: string, refundable: number, attempt: number): Promise<
  { ok: true; via: "wallet" | "card" | "offline"; partial: boolean; owed: number; walletPart: number; walletCredit: number; offlinePart: number } | { ok: false; error: string }
> {
  // Never more than is still refundable (taken before pay flipped to Refunded).
  const owed = Math.max(0, Math.min(b.cancel?.amount ?? refundable, refundable));
  // The wallet's proportional share of it (what the wallet paid that has not already been returned, over everything still refundable).
  const walletPart = walletShareFor(b, owed);
  const rest = Math.round((owed - walletPart) * 100) / 100;
  const s = await loadSettings(b.tenantId ?? tenantId, b.franchiseId ?? null);
  const cardAllowed = (s as { allowCardRefund?: boolean }).allowCardRefund !== false;
  const restToWallet = b.cancel?.refundTo === "wallet" || !cardAllowed;
  let via: "wallet" | "card" | "offline" = "wallet";
  let offlineOut = 0; // the offline share of a card + offline part-paid booking (its own refund entry)

  if (rest > 0 && !restToWallet) {
    if (b.paymentIntentId) {
      // Stripe refuses a refund larger than what's left of the card charge, and
      // part of `rest` may have been paid another way (cash / bank, or a hand-paid top-up
      // invoice): the whole refund then failed and nothing went back (d19s8).
      // Each pound goes back by the method it came in by: the refund is split PROPORTIONAL to what is still refundable by card and
      // offline (splitRefundByMethod). The card share goes through Stripe; the offline share becomes its OWN refund entry (below).
      const cardState = await cardRefundable(b);
      const split = cardState ? splitRefundByMethod(rest, cardState.left, offlineRefundable(b, cardState.taken)) : { card: rest, offline: 0 };
      const cardPart = split.card;
      const offlinePart = split.offline;
      offlineOut = offlinePart;
      if (cardPart > 0) {
        const r = await refundStripePayment(b, cardPart, `${Math.round((b.refundedApproved ?? 0) * 100)}-${attempt}`);
        if (!r.ok) return { ok: false, error: r.error };
      }
      if (offlinePart > 0) {
        await db.collection("payments").add({
          tenantId: b.tenantId ?? tenantId, refs: [b.ref], email: b.email, type: "refund", amount: offlinePart, currency: "gbp",
          method: "offline", offline: true, status: "to-reimburse", note: "Paid outside the card payment (e.g. a top-up invoice) — pay this part back by hand",
          createdAt: new Date().toISOString(),
        });
      }
      via = cardPart > 0 ? "card" : "offline";
    } else {
      // Nothing the app can refund. Record it so reconciliation shows money
      // owed back, rather than a booking that just says "Refunded".
      await db.collection("payments").add({
        tenantId: b.tenantId ?? tenantId, refs: [b.ref], email: b.email, type: "refund", amount: rest, currency: "gbp",
        method: b.voucherScheme || b.method || "offline", offline: true, status: "to-reimburse", createdAt: new Date().toISOString(),
      });
      via = "offline";
    }
  }
  // Credited by the CALLER (same transaction as the refund record): the proportional wallet share, plus the whole rest when it was resolved as wallet credit.
  const walletCredit = Math.round((walletPart + (rest > 0 && restToWallet ? rest : 0)) * 100) / 100;
  if (walletCredit > 0 && (rest <= 0 || restToWallet)) via = "wallet";
  if (restToWallet && b.cancel) b.cancel.refundTo = "wallet";
  return { ok: true, via, partial: owed > 0 && owed < refundable - 0.005, owed, walletPart, walletCredit, offlinePart: via === "card" ? offlineOut : 0 };
}

/** What Stripe actually took on the booking's card payment, and what's left to refund of it (less card refunds already made, including ones made in
 *  the Stripe dashboard). null when Stripe can't be asked. */
async function cardRefundable(b: Booking): Promise<{ taken: number; left: number } | null> {
  if (!stripe || !b.paymentIntentId) return null;
  try {
    const pi = await stripe.paymentIntents.retrieve(b.paymentIntentId, {}, b.stripeAccount ? { stripeAccount: b.stripeAccount } : undefined);
    const taken = (pi.amount_received ?? pi.amount ?? 0) / 100;
    const prior = await db.collection("payments").where("paymentIntentId", "==", b.paymentIntentId).get();
    const refunded = prior.docs.reduce((n, d) => n + (d.get("type") === "refund" && d.get("status") === "succeeded" ? Number(d.get("amount")) || 0 : 0), 0);
    return { taken, left: Math.max(0, Math.round((taken - refunded) * 100) / 100) };
  } catch (e) {
    console.error(`[payments] couldn't read card payment for ${b.ref}:`, (e as Error).message);
    return null;
  }
}

/** What was paid OFFLINE on a card booking (cash received beyond what Stripe took: cash, bank, a hand-paid top-up) and has not been refunded yet. */
function offlineRefundable(b: Booking, cardTaken: number): number {
  const paidOffline = Math.max(0, cashReceivedOf(b) - cardTaken);
  const backAlready = (b.refundEntries ?? []).filter((e) => e.via === "offline").reduce((t, e) => t + (e.cash || 0), 0);
  return Math.round(Math.max(0, paidOffline - backAlready) * 100) / 100;
}

// Refund part (or all) of the Stripe payment behind a booking. Awaited by
// settleApprovedRefund; recorded in `payments` either way so the money trail
// is never silent. Idempotency-keyed, so a retried approval can't refund twice.
async function refundStripePayment(b: Booking, amount: number, nonce: string): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!stripe) return { ok: false, error: "Card payments aren't connected" };
  if (!b.paymentIntentId) return { ok: false, error: "No card payment on this booking" };
  const base = {
    tenantId: b.tenantId ?? null,
    refs: [b.ref],
    type: "refund",
    amount,
    currency: "gbp",
    paymentIntentId: b.paymentIntentId,
    stripeAccount: b.stripeAccount ?? null,
    createdAt: new Date().toISOString(),
  };
  try {
    const refund = await stripe.refunds.create(
      { payment_intent: b.paymentIntentId, amount: toPence(amount), metadata: { activityosOrigin: "app", tenantId: b.tenantId ?? "", ref: b.ref } },
      // Keyed on the refund so far + the attempt: two equal part-refunds don't
      // collide, a double-submit of one approval does, and a retry after a
      // failure isn't handed Stripe's cached error for 24h.
      { idempotencyKey: `refund-${b.tenantId ?? ""}-${b.ref}-${toPence(amount)}-${nonce}`, ...(b.stripeAccount ? { stripeAccount: b.stripeAccount } : {}) },
    );
    await db.collection("payments").add({ ...base, status: "succeeded", refundId: refund.id });
    return { ok: true };
  } catch (e) {
    console.error(`[payments] refund failed for ${b.ref}:`, (e as Error).message);
    await db.collection("payments").add({ ...base, status: "failed", error: (e as Error).message });
    return { ok: false, error: (e as Error).message };
  }
}

type RefundSnapshot = { refund?: NonNullable<Booking["cancel"]>["refund"]; pay: Booking["pay"]; refundable: number; attempts: number };

class NotFound extends Error {}
class BadRequest extends Error {}
class Conflict extends Error {}
class AlreadyRefundedInStripe extends Error {
  constructor(public w: { stripeRefunded: number; pending: number; paid: number }) {
    super(`${money(w.stripeRefunded)} was already refunded to this family in Stripe. Approving this ${money(w.pending)} refund would refund them more on top. Nothing has been changed.`);
  }
}
class TooSoon extends Error {}
