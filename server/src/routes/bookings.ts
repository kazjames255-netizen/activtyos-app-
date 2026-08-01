import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { db } from "../firebase";
import { canWrite, operatorScope } from "../middleware/role";
import { fromDoc, toDoc, type BookingDoc } from "../lib/bookingDoc";
import { upsertCustomerFromBooking } from "../lib/customerUpsert";
import { stripe, toPence } from "../lib/stripe";
import { queuePositions, triggerWaitlist, waitingCount } from "../lib/waitlist";
import { releaseDiscountCodes } from "../lib/discountRedemptions";
import { creditWallet } from "../lib/wallet";
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
  emailPaymentLink,
  emailPlaceOffered,
  emailRefundApproved,
  emailVoucherInstructions,
} from "../lib/emails";
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
});

const bulkSchema = z.object({
  refs: z.array(z.string().min(1)).min(1),
  action: z.enum(["approve", "decline", "waitlist", "cancel"]),
});

export const bookingDocId = (tenantId: string, ref: string) => `${tenantId}_${ref}`;

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
  if (scope.role === "franchise") return b.franchiseId === scope.franchiseId;
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
    if (scope.role === "franchise") q = q.where("franchiseId", "==", scope.franchiseId);
  }

  const snap = await q.get();
  // Firestore stamps every document with its own createTime, so a booking
  // taken before the app started recording `createdAt` still knows when it
  // was made. Real metadata, not a guess from the reference number — which
  // matters, because "what came in yesterday" is answered from this.
  const list = snap.docs.map((d) => withCreated(d));
  list.sort((a, b) => (a.ref < b.ref ? 1 : -1));
  res.json(list);
});

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
  if (!doc.exists || !inScope(doc.data() as BookingDoc, scope)) {
    res.status(404).json({ error: "Booking not found" });
    return;
  }
  // Same fallback as the list, so opening a booking and seeing it in the list
  // never disagree about when it was made.
  res.json(withCreated(doc));
});

// GET /api/bookings/:ref/children — the full child record(s) for this booking's
// kids (same safeguarding projection the register uses), so the booking detail
// can show the identical child card. Scoped to the operator's own booking.
bookings.get("/:ref/children", async (req, res) => {
  const scope = operatorScope(req, res);
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
      send: c.send as string | undefined, sendPlanName: c.sendPlanName as string | undefined, careNotes: c.careNotes as string | undefined,
      collectionPassword: c.collectionPassword as string | undefined, emergencyName: c.emergencyName as string | undefined, emergencyPhone: c.emergencyPhone as string | undefined,
      photoConsent: c.photoConsent as boolean | undefined, likes: c.likes as string | undefined, dislikes: c.dislikes as string | undefined,
      swimming: c.swimming as string | undefined, sex: c.sex as string | undefined, suncreamConsent: c.suncreamConsent as boolean | undefined,
      firstAidConsent: c.firstAidConsent as boolean | undefined, walkHomeConsent: c.walkHomeConsent as boolean | undefined,
      answers: (c.answers as Record<string, string> | undefined) ?? undefined,
    }] as const;
  }));
  res.json({
    booker: b.booker, email: b.email ?? "", phone: b.phone ?? "", ref: b.ref, note: b.note ?? "",
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
      const b: Booking = {
        ...buildBooking(
          { ...input, dates: block ? block.name : input.dates! },
          nextBid,
        ),
        tenantId,
        ...(scope.role === "franchise" ? { franchiseId: scope.franchiseId! } : {}),
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

    const updated = await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists || !inScope(snap.data() as BookingDoc, scope)) throw new NotFound();
      const b = fromDoc(snap.data() as BookingDoc);
      const oldStatus = b.status;

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
                if (kid?.dates?.length) kid.dates = kid.dates.map((d) => (d === m.from ? m.to! : d));
                else if (b.days?.length) b.days = b.days.map((d) => (d === m.from ? m.to! : d));
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

    // Approving a refund sends the money where the family asked for it. Store
    // credit stays in-house and lands instantly; anything else is a REAL Stripe
    // refund on the provider's connected account (the amount the cancel flow
    // agreed — full or partial). Failures are logged and recorded, never
    // swallowed into a fake "Refunded" without money moving.
    if (action.type === "refund-approve") {
      const owed = updated.cancel?.amount ?? updated.amount;
      if (updated.cancel?.refundTo === "wallet" && owed > 0)
        void creditWallet(
          updated.tenantId ?? scope.tenantId!,
          updated.email,
          owed,
          `Credit from ${updated.listing}`,
          updated.ref,
        );
      else if (updated.paymentIntentId) void refundStripePayment(updated);
    }

    // Status-change emails to the booker (fire-and-forget).
    if (updated.email.includes("@")) {
      if (action.type === "approve" || action.type === "promote")
        emailBookingConfirmed(updated, await tenantName());
      else if (action.type === "offer") emailPlaceOffered(updated, await tenantName());
      else if (action.type === "decline") emailBookingDeclined(updated, await tenantName());
      else if (action.type === "refund-approve") emailRefundApproved(updated, await tenantName());
    }

    // Offline settlements (TFC, HAF, PayPal, cash) become payment records
    // too — reconciliation needs an entry, not just a flag.
    if (action.type === "paid") {
      void db.collection("payments").add({
        tenantId: updated.tenantId ?? scope.tenantId,
        refs: [updated.ref],
        email: updated.email,
        amount: updated.amount,
        currency: "gbp",
        method: updated.method,
        offline: true,
        status: "recorded",
        recordedBy: req.user?.email ?? "operator",
        createdAt: new Date().toISOString(),
      });
    }

    // Freed seats pass to the queue (auto mode); promotes report who's
    // still waiting so the UI can warn about overbooking.
    if (updated.blockId && (action.type === "decline" || action.type === "cancel"))
      void triggerWaitlist(updated.blockId);
    // A cancelled booking gives its discount code back (single-use codes
    // become usable again once nothing in the basket is standing). Safe to
    // repeat — the redemption record is gone after the first release.
    if (updated.status === "Cancelled") void releaseDiscountCodes(scope.tenantId!, updated.ref);
    // Tell the family the outcome of their date-change request (bell + email).
    if ((action.type === "move-approve" || action.type === "move-deny") && updated.email?.includes("@")) {
      const req = updated.dateChangeRequest;
      const okMoves = (req?.moves ?? []).filter((m) => m.approved && m.to);
      const declined = action.type === "move-deny" || (req?.moves ?? []).some((m) => m.approved === false);
      const fmtDay = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
      const moved = okMoves.map((m) => fmtDay(m.to!)).join(", ");
      void notify({
        tenantId: scope.tenantId!,
        to: { kind: "parent", email: updated.email },
        category: "booking",
        title:
          action.type === "move-deny"
            ? `Date change declined · ${updated.ref}`
            : declined
              ? `Date change part-approved · ${updated.ref}`
              : `Date change approved · ${updated.ref}`,
        body:
          action.type === "move-deny"
            ? `${updated.listing}: your provider couldn't make the change.${req?.reason ? ` Reason: ${req.reason}` : ""}`
            : `${updated.listing}: you're now booked on ${moved || "the new date(s)"}.${req?.reason && declined ? ` Note: ${req.reason}` : ""}`,
        subject: `${updated.ref}: date change ${action.type === "move-deny" ? "declined" : "approved"}`,
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
const recordPaymentSchema = z.object({
  amount: z.number().positive(),
  method: z.string().max(60).optional(),
  reference: z.string().max(120).optional(),
  date: z.string().max(25).optional(),
});
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
  try {
    const updated = await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists || !inScope(snap.data() as BookingDoc, scope)) throw new NotFound();
      const b = fromDoc(snap.data() as BookingDoc);
      const paid = Math.round(((b.amountPaid ?? 0) + parsed.data.amount) * 100) / 100;
      b.amountPaid = paid;
      b.pay = paid >= (b.amount ?? 0) ? "Paid" : "Partially paid";
      tx.set(ref, toDoc(b));
      return b;
    });
    // Record the money for reconciliation/oversight.
    void db.collection("payments").add({
      tenantId,
      refs: [updated.ref],
      email: updated.email,
      amount: parsed.data.amount,
      currency: "gbp",
      method: parsed.data.method ?? updated.method,
      reference: parsed.data.reference ?? null,
      offline: true,
      status: "recorded",
      recordedBy: req.user?.email ?? "operator",
      createdAt: parsed.data.date ?? new Date().toISOString(),
    });
    res.json(updated);
  } catch (e) {
    if (e instanceof NotFound) res.status(404).json({ error: "Booking not found" });
    else throw e;
  }
});

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
      tx.update(blockSnap.ref, {
        bookedCount: blockData.bookedCount,
        dayCounts: blockData.dayCounts ?? {},
      });
    }
    return out.map((x) => x.b);
  });
  // Bulk declines/cancellations free seats — let the queues know.
  if (action === "decline" || action === "cancel" || action === "waitlist") {
    for (const blockId of new Set(updated.map((b) => b.blockId).filter(Boolean) as string[]))
      void triggerWaitlist(blockId);
  }
  res.json(updated);
});

// Refund the Stripe payment behind a booking (fire-and-forget from
// refund-approve). Refunds what the cancel flow agreed (full booking amount
// when no explicit figure). Recorded in `payments` either way — success or
// failure — so the money trail is never silent.
async function refundStripePayment(b: Booking): Promise<void> {
  if (!stripe || !b.paymentIntentId) return;
  const amount = b.cancel?.amount ?? b.amount;
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
      b.stripeAccount ? { stripeAccount: b.stripeAccount } : undefined,
    );
    await db.collection("payments").add({ ...base, status: "succeeded", refundId: refund.id });
  } catch (e) {
    console.error(`[payments] refund failed for ${b.ref}:`, (e as Error).message);
    await db.collection("payments").add({ ...base, status: "failed", error: (e as Error).message });
  }
}

class NotFound extends Error {}
class BadRequest extends Error {}
class Conflict extends Error {}
