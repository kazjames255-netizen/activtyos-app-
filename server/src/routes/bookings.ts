import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { FieldValue } from "firebase-admin/firestore";
import { db } from "../firebase";
import { canWrite, operatorScope, managerScope } from "../middleware/role";
import { fromDoc, toDoc, type BookingDoc } from "../lib/bookingDoc";
import { upsertCustomerFromBooking } from "../lib/customerUpsert";
import { stripe, toPence } from "../lib/stripe";
import { queuePositions, triggerWaitlist, waitingCount } from "../lib/waitlist";
import { releaseDiscountCodes } from "../lib/discountRedemptions";
import { cleanupAfterCancel } from "../lib/cancelCleanup";
import { creditWallet } from "../lib/wallet";
import { loadSettings } from "../lib/tenantLibrary";
import { bookingInSite, staffSiteScope } from "../lib/siteScope";
import { registerRows } from "../lib/registerRows";
import { money, realPhone, refundableSoFar, receivedOf } from "../../../features/bookings/helpers";
import { notify } from "../lib/notify";
import {
  blockCountDelta,
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
  emailBookingDeclined,
  emailDateChangeResolved,
  emailPaymentLink,
  emailPaymentReceived,
  emailPlaceOffered,
  emailRefundApproved,
  emailVoucherInstructions,
} from "../lib/emails";
import { applyHoNetFilter } from "../lib/franchiseScope";
import type { Booking } from "../../../features/bookings/types";
import {
  applyBulkAction,
  applyCancel,
  applyCancelChild,
  applyCancelDay,
  applyNote,
  applyRowAction,
  buildBooking,
} from "../../../features/bookings/mutations";

// Operator bookings API. There is NO portal/tenant parameter — the scope is
// derived from the authenticated account (multi-tenant isolation is enforced
// here, server-side):
//   platform            → any tenant (optional ?tenantId= filter), read-only
//   company/freelancer  → their whole tenant
//   franchise           → their tenant AND their own franchiseId subset
//   staff               → their tenant, read-only
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
      // resend mutates nothing — it re-sends the payment-link email
      "resend",
    ]),
    // Optional free-text the operator gives when declining a booking; it's
    // relayed to the family in the decline email. Ignored for other types.
    reason: z.string().max(300).optional(),
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
    amount: z.number().nonnegative().optional(),
    reason: z.string().max(120).optional(),
  }),
  z.object({ type: z.literal("cancel-child"), ki: z.number().int().nonnegative() }),
  z.object({
    type: z.literal("cancel-day"),
    ki: z.number().int().nonnegative(),
    date: z.string().min(1),
  }),
  z.object({
    type: z.literal("change-day"),
    ki: z.number().int().nonnegative(),
    oldDate: z.string().min(1),
    newDate: z.string().min(1),
  }),
  z.object({ type: z.literal("note"), text: z.string() }),
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
  amount: z.number().nonnegative(),
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
async function notifyPaymentReceived(tenantId: string, b: Booking, label: string): Promise<void> {
  if (!b.email?.includes("@")) return;
  const email = b.email;
  const tenantDoc = await db.collection("tenants").doc(tenantId).get();
  const provider = (tenantDoc.get("name") as string) || "your provider";
  const kidsLabel = b.kids?.length ? b.kids.map((k) => k.name).join(", ") : b.child;
  const dateLabel = (b.sessions ?? [])[0]?.split(" · ")[0];
  emailPaymentReceived(b, provider, { label, amount: b.amount ?? 0 });
  void notify({
    tenantId,
    to: { kind: "parent", email },
    category: "billing",
    title: `Payment received · ${b.ref}`,
    body: `${b.listing}${kidsLabel ? ` · ${kidsLabel}` : ""} — £${(b.amount ?? 0).toFixed(2)} received via ${label}${dateLabel ? ` · ${dateLabel}` : ""}. Fully paid — thank you!`,
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
  const q = await col.where("tenantId", "==", tenantId).where("ref", "==", ref).limit(1).get();
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
  res.json(scope.role === "staff" ? list.map((b) => staffView(b as unknown as Record<string, unknown>)) : list);
});

/** What a STAFF token gets: the booking minus its money. Staff screens use
 *  bookings for names, children, days and contacts (Families, trips,
 *  incidents) — never the amounts, what was paid, or payment references that
 *  would let someone match a family's money. A coach's token used to return
 *  every figure in the tenant. */
const MONEY_KEYS = [
  "amount", "amountPaid", "cardPaid", "walletApplied", "discountCode", "paymentRef", "payRefs",
  "paymentIntentId", "stripeAccount", "mealItems", "reconciledBy", "payments", "refund",
  // Whether a family has paid, and how, is money too (acceptance d24s4).
  "pay", "method", "refundedApproved", "walletRefunded", "invoicePaymentIntentIds", "tfc",
] as const;
function staffView<T extends Record<string, unknown>>(b: T): T {
  const out: Record<string, unknown> = { ...b };
  for (const k of MONEY_KEYS) delete out[k];
  if (out.cancel && typeof out.cancel === "object") {
    const { amount: _a, refund: _r, refundTo: _t, ...rest } = out.cancel as Record<string, unknown>;
    out.cancel = rest;
  }
  return out as T;
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
  const one = withCreated(doc);
  res.json(scope.role === "staff" ? staffView(one as unknown as Record<string, unknown>) : one);
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
      const b: Booking = {
        ...buildBooking(
          { ...input, dates: block ? block.name : input.dates! },
          nextBid,
        ),
        tenantId,
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
      tx.update(tenantRef, { nextBid: nextBid + 1 });
      if (block && blockRef && hasSpace)
        tx.update(blockRef, { ...countsUpdate(block, seats, bookingDays(b, block)) });
      tx.set(col.doc(bookingDocId(tenantId, b.ref)), toDoc(b));
      return b;
    });

    // Manual bookings sit unpaid until settled — the booker gets the
    // payment-link email. A £0 booking never gets a "pay this" email.
    if (booking.email.includes("@") && booking.status !== "Waitlisted" && booking.amount > 0)
      emailPaymentLink(booking, tenantName);
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
      if (b.email.includes("@")) {
        if (b.pay === "Awaiting voucher payment" && b.voucherScheme) {
          const lib = (await db.collection("libraries").doc(b.tenantId!).get()).data() ?? {};
          const providers = ((lib.settings as Record<string, unknown> | undefined)?.voucherProviders ?? []) as { name: string; details?: { label: string; value: string }[] }[];
          const scheme = providers.find((v) => v.name === b.voucherScheme);
          if (scheme) emailVoucherInstructions(b, await tenantName(), { name: scheme.name, details: (scheme.details ?? []).filter((d) => d.value?.trim()) });
          else emailPaymentLink(b, await tenantName());
        } else {
          emailPaymentLink(b, await tenantName());
        }
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
    const updated = await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists || !inScope(snap.data() as BookingDoc, scope)) throw new NotFound();
      const b = fromDoc(snap.data() as BookingDoc);
      const oldStatus = b.status;
      receivedBefore = receivedOf(b);

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
      }

      // A refund is approved ONCE. Replaying the action used to credit the
      // wallet again, or fire a second Stripe refund.
      if (action.type === "refund-approve") {
        if (!b.cancel) throw new Conflict("There's no cancellation on this booking to refund");
        if (b.cancel.refund === "approved") throw new Conflict("This refund has already been approved");
        if (b.cancel.refund === "declined") throw new Conflict("This refund was declined");
        // Snapshot BEFORE the action flips pay to "Refunded" — what's still
        // refundable is worked out from this, not from the flipped booking.
        refundBefore = { refund: b.cancel.refund, pay: b.pay, refundable: refundableSoFar(b), attempts: (b.cancel as { refundAttempts?: number }).refundAttempts ?? 0 };
      }

      switch (action.type) {
        case "cancel":
          applyCancel(b, action.refund, action.amount, action.reason);
          break;
        case "cancel-child":
          applyCancelChild(b, action.ki);
          break;
        case "cancel-day":
          applyCancelDay(b, action.ki, action.date);
          break;
        case "change-day":
          break; // fully handled above, block-aware
        case "note":
          applyNote(b, action.text);
          break;
        case "move-approve":
          if (b.dateChangeRequest) {
            const req = b.dateChangeRequest;
            const idxs = action.approveIndexes ?? req.moves.map((_, i) => i);
            // Recover the ISO date from a session label ("Mon 27 Jul 2026 · …").
            const isoOfLabel = (s: string): string | null => {
              const mm = s.match(/(\d{1,2})\s+([A-Za-z]{3,})\s+(\d{4})/);
              if (!mm) return null;
              const d = new Date(`${mm[1]} ${mm[2]} ${mm[3]}`);
              return Number.isNaN(d.getTime()) ? null : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
            };
            const labelOfIso = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
            req.moves.forEach((m, i) => {
              const ok = idxs.includes(i);
              m.approved = ok;
              if (ok && m.from && m.to) {
                const kid = b.kids?.find((k) => (m.childId && k.childId === m.childId) || k.name === m.childName);
                // Some kids[] rows (merged-basket bookings) only ever had `days`
                // written, not `dates` — treat either as the child's booked days
                // and always keep both in sync afterwards, or the child's own row
                // goes stale (register/partial-cancel read `dates`).
                const kidDays = kid?.dates?.length ? kid.dates : kid?.days;
                if (kid && kidDays?.length) {
                  const moved = kidDays.map((d) => (d === m.from ? m.to! : d));
                  kid.dates = moved; kid.days = moved;
                } else if (b.days?.length) b.days = b.days.map((d) => (d === m.from ? m.to! : d));
                // Bookings whose dates live only in `sessions` strings — move the
                // matching label, keeping its time suffix, so the change shows.
                if (b.sessions?.length) {
                  b.sessions = b.sessions.map((s) => {
                    if (isoOfLabel(s) !== m.from) return s;
                    const suffix = s.includes(" · ") ? s.slice(s.indexOf(" · ")) : "";
                    return `${labelOfIso(m.to!)}${suffix}`;
                  }).sort((a, c) => ((isoOfLabel(a) ?? a) < (isoOfLabel(c) ?? c) ? -1 : 1));
                }
              }
            });
            // Refresh the headline date range from whatever dates it now holds.
            const allIso = [...new Set([
              ...(b.days ?? []),
              ...((b.kids ?? []).flatMap((k) => k.dates ?? [])),
              ...((b.sessions ?? []).map(isoOfLabel).filter(Boolean) as string[]),
            ])].sort();
            if (allIso.length) {
              const fmt = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
              b.dates = allIso.length === 1 ? fmt(allIso[0]) : `${fmt(allIso[0])} – ${fmt(allIso[allIso.length - 1])}`;
            }
            req.status = "approved";
            req.resolvedAt = new Date().toISOString();
            if (action.reason) req.reason = action.reason;
            b.note = idxs.length === req.moves.length ? "Date change approved." : "Date change partly approved.";
          }
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
      const delta = b.blockId ? blockCountDelta(oldStatus, b.status, bookingSeats(b)) : 0;
      let blockUpdate: {
        ref: FirebaseFirestore.DocumentReference;
        counts: ReturnType<typeof countsUpdate>;
      } | null = null;
      if (delta !== 0) {
        const blockSnap = await tx.get(db.collection("blocks").doc(b.blockId!));
        if (blockSnap.exists) {
          const blockData = blockSnap.data() as BlockDoc;
          blockUpdate = {
            ref: blockSnap.ref,
            counts: countsUpdate(blockData, delta, bookingDays(b, blockData)),
          };
        }
      }

      tx.set(ref, toDoc(b));
      if (blockUpdate) tx.update(blockUpdate.ref, { ...blockUpdate.counts });
      if (moveUpdate) tx.update(moveUpdate.ref, { ...moveUpdate.counts });
      return b;
    });

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
        await ref.set({ cancel: { ...(updated.cancel ?? {}), refund: back?.refund ?? "pending", refundError: moved.error, refundAttempts: (back?.attempts ?? 0) + 1 }, pay: back?.pay ?? updated.pay }, { merge: true });
        res.status(502).json({ error: `The refund didn't go through: ${moved.error}. Nothing was marked refunded — try again, or refund it in Stripe directly.` });
        return;
      }
      // refundedAt: when the money actually moved (cancel.on is when it was
      // asked for) — Reconciliation's "refunded today" keys off this (d9s7).
      updated.cancel = { ...(updated.cancel ?? { on: "", by: "" }), refundVia: moved.via, refundedAt: new Date().toISOString(), refundError: undefined };
      if (moved.partial) updated.pay = "Partially refunded";
      updated.refundedApproved = Math.round(((updated.refundedApproved ?? 0) + moved.owed) * 100) / 100;
      updated.walletRefunded = Math.round(((updated.walletRefunded ?? 0) + moved.walletPart) * 100) / 100;
      // The parent Payments page builds its Refunds list (and refundTotal)
      // from refundLog only (PaymentsApp.tsx:145) — a whole-booking approved
      // refund used to write cancel.refundedAt/refundedApproved/walletRefunded
      // but no refundLog entry, so it never showed there (only per-day
      // releases, my.ts partialCancel, did). Add one here too.
      const refundLabel = moved.partial ? "Refund approved (partial)" : "Refund approved";
      (updated.refundLog = updated.refundLog ?? []).push({
        label: refundLabel,
        amount: moved.owed,
        on: new Date().toISOString().slice(0, 10),
        by: "Provider",
        source: moved.via === "wallet" ? "Wallet" : moved.via === "offline" ? "Offline" : "Card",
      });
      await ref.set({ cancel: { ...updated.cancel, refundError: FieldValue.delete() }, pay: updated.pay, refundedApproved: updated.refundedApproved, walletRefunded: updated.walletRefunded, refundLog: updated.refundLog }, { merge: true });
    }

    // Status-change emails to the booker (fire-and-forget).
    if (updated.email.includes("@")) {
      if (action.type === "approve" || action.type === "promote")
        emailBookingConfirmed(updated, await tenantName());
      else if (action.type === "offer") emailPlaceOffered(updated, await tenantName());
      else if (action.type === "decline") emailBookingDeclined(updated, await tenantName(), updated.declineReason);
      else if (action.type === "refund-approve") {
        emailRefundApproved(updated, await tenantName());
        // …and raise the family's in-app bell (email-only before, so it never
        // showed in their notifications). bellOnly — the email above is the mail.
        const toWallet = updated.cancel?.refundTo === "wallet";
        const amt = updated.cancel?.amount ?? 0;
        void notify({
          tenantId: scope.tenantId!,
          to: { kind: "parent", email: updated.email },
          category: "billing",
          bellOnly: true,
          title: toWallet ? `Wallet credit added · ${updated.ref}` : `Refund approved · ${updated.ref}`,
          body: toWallet
            ? `£${amt.toFixed(2)} added to your wallet for ${updated.listing} — it's there now, ready to spend on your next booking.`
            : updated.cancel?.refundVia === "offline"
              ? `£${amt.toFixed(2)} refund approved for ${updated.listing} — ${updated.voucherScheme ? `returned through ${updated.voucherScheme}` : "your provider will return it the way you paid"}.`
              : `£${amt.toFixed(2)} refund approved for ${updated.listing} — on its way back to your card.`,
          href: `/custdash/bookings?open=${encodeURIComponent(updated.ref)}`,
          ref: updated.ref,
        });
      }
    }

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
    if (updated.blockId && (action.type === "decline" || action.type === "cancel"))
      void triggerWaitlist(updated.blockId);
    // A cancelled booking gives its discount code back (single-use codes
    // become usable again once nothing in the basket is standing). Safe to
    // repeat — the redemption record is gone after the first release.
    if (updated.status === "Cancelled") void releaseDiscountCodes(scope.tenantId!, updated.ref);
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
  amount: z.number().positive(),
  method: z.string().max(60).optional(),
  reference: z.string().max(120).optional(),
  date: z.string().max(25).optional(),
  confirmDuplicate: z.boolean().optional(),
});
const refKey = (r: unknown) => String(r ?? "").replace(/\s+/g, "").toUpperCase();
class Duplicate extends Error { constructor(public prior: { amount: number; reference: string | null; createdAt: string; recordedBy?: string }) { super("possible_duplicate"); } }
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
      const paid = Math.round(((b.amountPaid ?? 0) + parsed.data.amount) * 100) / 100;
      b.amountPaid = paid;
      b.pay = paid >= (b.amount ?? 0) ? "Paid" : "Partially paid";
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
    const overpaid = Math.round(Math.max(0, (updated.amountPaid ?? 0) - (updated.amount ?? 0)) * 100) / 100;
    res.json({ ...updated, ...(overpaid > 0 ? { overpaid } : {}) });
  } catch (e) {
    if (e instanceof NotFound) res.status(404).json({ error: "Booking not found" });
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
  date: z.string().max(25).optional(),
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
      receivedBefore = receivedOf(b);
      if (undo) {
        b.amountPaid = 0;
        b.pay = (b.amount ?? 0) <= 0 ? "Funded" : b.voucherScheme ? "Awaiting voucher payment" : "Unpaid";
        b.reconciledBy = null;
      } else {
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
      b.nudges = (b.nudges ?? 0) + 1;
      b.lastNudgedAt = new Date().toISOString();
      tx.set(ref, toDoc(b));
      return b;
    });
    const outstanding = Math.max(0, (updated.amount ?? 0) - (updated.amountPaid ?? 0));
    const bookedMs = Date.parse(updated.createdAt ?? "");
    const days = Number.isNaN(bookedMs) ? 0 : Math.max(0, Math.floor((Date.now() - bookedMs) / 86400000));
    if (updated.email?.includes("@")) {
      const how = updated.voucherScheme ? `${updated.voucherScheme} voucher` : updated.method;
      const when = updated.dates ? ` on ${updated.dates}` : "";
      const times = (updated.sessions ?? []).slice(0, 3).join("; ");
      void notify({
        tenantId,
        to: { kind: "parent", email: updated.email },
        category: "billing",
        title: `Payment reminder · ${updated.ref}`,
        body: `A friendly reminder about ${updated.child}'s place on ${updated.listing}${when}: £${outstanding.toFixed(2)} is still to pay${days ? ` (booked ${days} day${days === 1 ? "" : "s"} ago)` : ""}.${times ? ` Sessions: ${times}.` : ""} Please complete your ${how} payment when you can — thank you!`,
        subject: `Payment reminder for ${updated.ref}`,
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
      const b = fromDoc(snap.data() as BookingDoc);
      b.paymentRef = parsed.data.paymentRef;
      tx.set(ref, toDoc(b));
      return b;
    });
    if (updated.email?.includes("@")) {
      void notify({
        tenantId,
        to: { kind: "parent", email: updated.email },
        category: "billing",
        title: `Payment reference updated · ${updated.ref}`,
        body: `${updated.listing}: we've updated the payment reference for your ${updated.voucherScheme ? `${updated.voucherScheme} voucher` : updated.method} payment to "${updated.paymentRef}". Please use this reference so we can match your payment.`,
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
    for (const snap of snaps) {
      if (!snap.exists || !inScope(snap.data() as BookingDoc, scope)) continue;
      const b = fromDoc(snap.data() as BookingDoc);
      const oldStatus = b.status;
      applyBulkAction(b, action);
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
  }).catch((e: unknown) => { if (e instanceof BulkOverCapacity) return e; throw e; });
  if (updated instanceof BulkOverCapacity) {
    res.status(409).json({ error: `Approving these would put ${updated.block} ${updated.over} place${updated.over === 1 ? "" : "s"} over capacity — approve fewer, or waitlist the rest.`, code: "over_capacity", over: updated.over });
    return;
  }
  // Bulk declines/cancellations free seats — let the queues know.
  if (action === "decline" || action === "cancel" || action === "waitlist") {
    for (const blockId of new Set(updated.map((b) => b.blockId).filter(Boolean) as string[]))
      void triggerWaitlist(blockId);
  }
  res.json(updated);
});

/**
 * Move the money for an approved refund. Returns once it has actually moved.
 *
 *  - Wallet credit spent on the booking always goes back to the wallet — it
 *    came from there (and used to be lost: `amount` is net of it).
 *  - The rest goes where the family asked. If the provider has turned card
 *    refunds off (Setup → allowCardRefund) it's wallet credit regardless — the
 *    screen enforced that, the server took "card" from anyone who asked.
 *  - A card booking is refunded through Stripe (awaited; the one step that
 *    can fail, so it runs FIRST and nothing is credited if it does).
 *  - A voucher/TFC/cash booking can't be refunded by the app. It's recorded as
 *    owed back offline, and the family is told it comes back the way they paid
 *    — not "to your card", which it never touched.
 */
async function settleApprovedRefund(b: Booking, tenantId: string, refundable: number, attempt: number): Promise<
  { ok: true; via: "wallet" | "card" | "offline"; partial: boolean; owed: number; walletPart: number } | { ok: false; error: string }
> {
  // Never more than is still refundable (taken before pay flipped to Refunded).
  const owed = Math.max(0, Math.min(b.cancel?.amount ?? refundable, refundable));
  // Only the wallet credit not already returned goes back to the wallet.
  const walletLeft = Math.max(0, (b.walletApplied ?? 0) - (b.walletRefunded ?? 0));
  const walletPart = Math.min(owed, walletLeft);
  const rest = Math.round((owed - walletPart) * 100) / 100;
  const s = await loadSettings(b.tenantId ?? tenantId, b.franchiseId ?? null);
  const cardAllowed = (s as { allowCardRefund?: boolean }).allowCardRefund !== false;
  const restToWallet = b.cancel?.refundTo === "wallet" || !cardAllowed;
  let via: "wallet" | "card" | "offline" = "wallet";

  if (rest > 0 && !restToWallet) {
    if (b.paymentIntentId) {
      // Stripe refuses a refund larger than what's left of the card charge, and
      // part of `rest` may have been paid another way (a hand-paid top-up
      // invoice): the whole refund then failed and nothing went back (d19s8).
      // Card gets what the card can take; the rest is owed back offline.
      const cardLeft = await cardRefundable(b);
      const cardPart = cardLeft == null ? rest : Math.min(rest, cardLeft);
      const offlinePart = Math.round((rest - cardPart) * 100) / 100;
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
  const toWallet = walletPart + (rest > 0 && restToWallet ? rest : 0);
  if (toWallet > 0) {
    await creditWallet(b.tenantId ?? tenantId, b.email, Math.round(toWallet * 100) / 100, `Credit from ${b.listing}`, b.ref);
    // On the payments ledger too, like card and offline refunds — a wallet
    // refund used to leave no record, so the ledger and Reconciliation came
    // up short of the bookings list by every wallet refund (d9s7).
    await db.collection("payments").add({
      tenantId: b.tenantId ?? tenantId, refs: [b.ref], email: b.email, type: "refund", amount: Math.round(toWallet * 100) / 100, currency: "gbp",
      method: "wallet", via: "wallet", status: "credited", createdAt: new Date().toISOString(),
    }).catch((e) => console.error(`[refunds] wallet refund ledger write failed for ${b.ref}:`, (e as Error).message));
    if (rest <= 0 || restToWallet) via = "wallet";
  }
  if (restToWallet && b.cancel) b.cancel.refundTo = "wallet";
  return { ok: true, via, partial: owed > 0 && owed < refundable - 0.005, owed, walletPart };
}

/** What's left to refund on the booking's card payment: what Stripe actually
 *  took, less card refunds already made. null when Stripe can't be asked. */
async function cardRefundable(b: Booking): Promise<number | null> {
  if (!stripe || !b.paymentIntentId) return null;
  try {
    const pi = await stripe.paymentIntents.retrieve(b.paymentIntentId, {}, b.stripeAccount ? { stripeAccount: b.stripeAccount } : undefined);
    const taken = (pi.amount_received ?? pi.amount ?? 0) / 100;
    const prior = await db.collection("payments").where("paymentIntentId", "==", b.paymentIntentId).get();
    const refunded = prior.docs.reduce((n, d) => n + (d.get("type") === "refund" && d.get("status") === "succeeded" ? Number(d.get("amount")) || 0 : 0), 0);
    return Math.max(0, Math.round((taken - refunded) * 100) / 100);
  } catch (e) {
    console.error(`[payments] couldn't read card payment for ${b.ref}:`, (e as Error).message);
    return null;
  }
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
      { payment_intent: b.paymentIntentId, amount: toPence(amount) },
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
