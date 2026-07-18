import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { db } from "../firebase";
import { canWrite, operatorScope } from "../middleware/role";
import { fromDoc, toDoc, type BookingDoc } from "../lib/bookingDoc";
import { upsertCustomerFromBooking } from "../lib/customerUpsert";
import { stripe, toPence } from "../lib/stripe";
import {
  blockCountDelta,
  bookingSeats,
  sessionLabel,
  type BlockDoc,
} from "../lib/blockDomain";
import {
  emailBookingConfirmed,
  emailBookingDeclined,
  emailPaymentLink,
  emailRefundApproved,
} from "../lib/emails";
import type { Booking } from "../../../features/bookings/types";
import {
  applyBulkAction,
  applyCancel,
  applyCancelChild,
  applyCancelDay,
  applyChangeDayMutation,
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
      "refund-approve",
      "refund-decline",
      // resend mutates nothing — it re-sends the payment-link email
      "resend",
    ]),
  }),
  z.object({
    type: z.literal("cancel"),
    refund: z.enum(["full", "partial", "none"]),
    amount: z.number().nonnegative().optional(),
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
  const list = snap.docs.map((d) => fromDoc(d.data() as BookingDoc));
  list.sort((a, b) => (a.ref < b.ref ? 1 : -1));
  res.json(list);
});

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
  const doc = await col.doc(bookingDocId(tenantId, req.params.ref)).get();
  if (!doc.exists || !inScope(doc.data() as BookingDoc, scope)) {
    res.status(404).json({ error: "Booking not found" });
    return;
  }
  res.json(fromDoc(doc.data() as BookingDoc));
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
      const hasSpace = !block || (block.open && block.bookedCount + seats <= block.capacity);
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
      };
      tx.update(tenantRef, { nextBid: nextBid + 1 });
      if (block && blockRef && hasSpace)
        tx.update(blockRef, { bookedCount: block.bookedCount + seats });
      tx.set(col.doc(bookingDocId(tenantId, b.ref)), toDoc(b));
      return b;
    });

    // Manual bookings sit as "Invoice sent" until paid — the booker gets the
    // payment-link email the UI has always promised.
    if (booking.email.includes("@") && booking.status !== "Waitlisted")
      emailPaymentLink(booking, tenantName);
    void upsertCustomerFromBooking(tenantId, booking);

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
  const ref = col.doc(bookingDocId(scope.tenantId!, req.params.ref));

  const tenantName = async () => {
    const t = await tenantsCol.doc(scope.tenantId!).get();
    return t.exists ? ((t.data()!.name as string) ?? "Your activity provider") : "Your activity provider";
  };

  try {
    // "resend" mutates nothing — just re-send the payment-link email.
    if (action.type === "resend") {
      const snap = await ref.get();
      if (!snap.exists || !inScope(snap.data() as BookingDoc, scope)) throw new NotFound();
      const b = fromDoc(snap.data() as BookingDoc);
      if (b.email.includes("@")) emailPaymentLink(b, await tenantName());
      res.json(b);
      return;
    }

    const updated = await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists || !inScope(snap.data() as BookingDoc, scope)) throw new NotFound();
      const b = fromDoc(snap.data() as BookingDoc);
      const oldStatus = b.status;

      switch (action.type) {
        case "cancel":
          applyCancel(b, action.refund, action.amount);
          break;
        case "cancel-child":
          applyCancelChild(b, action.ki);
          break;
        case "cancel-day":
          applyCancelDay(b, action.ki, action.date);
          break;
        case "change-day":
          applyChangeDayMutation(b, action.ki, action.oldDate, action.newDate);
          break;
        case "note":
          applyNote(b, action.text);
          break;
        default:
          // "resend" returned early above, so only real row actions reach here.
          applyRowAction(b, action.type as Exclude<typeof action.type, "resend">);
      }

      // Keep the block's place count in step with the status transition
      // (promote may intentionally exceed capacity — operator's overbook).
      // Firestore requires all reads before writes, hence the read here.
      const delta = b.blockId ? blockCountDelta(oldStatus, b.status, bookingSeats(b)) : 0;
      let blockUpdate: { ref: FirebaseFirestore.DocumentReference; count: number } | null = null;
      if (delta !== 0) {
        const blockSnap = await tx.get(db.collection("blocks").doc(b.blockId!));
        if (blockSnap.exists) {
          blockUpdate = {
            ref: blockSnap.ref,
            count: Math.max(0, (blockSnap.data()!.bookedCount ?? 0) + delta),
          };
        }
      }

      tx.set(ref, toDoc(b));
      if (blockUpdate) tx.update(blockUpdate.ref, { bookedCount: blockUpdate.count });
      return b;
    });

    // Approving a refund on a Stripe-paid booking issues the REAL refund on
    // the provider's connected account (the amount the cancel flow agreed —
    // full or partial). Failures are logged and recorded, never swallowed
    // into a fake "Refunded" without money moving... the record shows it.
    if (action.type === "refund-approve" && updated.paymentIntentId) {
      void refundStripePayment(updated);
    }

    // Status-change emails to the booker (fire-and-forget).
    if (updated.email.includes("@")) {
      if (action.type === "approve" || action.type === "promote")
        emailBookingConfirmed(updated, await tenantName());
      else if (action.type === "decline") emailBookingDeclined(updated, await tenantName());
      else if (action.type === "refund-approve") emailRefundApproved(updated, await tenantName());
    }

    res.json(updated);
  } catch (e) {
    if (e instanceof NotFound) res.status(404).json({ error: "Booking not found" });
    else throw e;
  }
});

// POST /api/bookings/bulk
bookings.post("/bulk", async (req, res) => {
  const scope = operatorScope(req, res);
  if (!scope || !requireWrite(req, res)) return;
  const parsed = bulkSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues });
    return;
  }
  const { refs, action } = parsed.data;
  const updated = await db.runTransaction(async (tx) => {
    const snaps = await Promise.all(
      refs.map((r) => tx.get(col.doc(bookingDocId(scope.tenantId!, r)))),
    );
    // Mutate + aggregate block deltas first (all reads must precede writes).
    const out: { snap: FirebaseFirestore.DocumentSnapshot; b: Booking }[] = [];
    const deltas = new Map<string, number>();
    for (const snap of snaps) {
      if (!snap.exists || !inScope(snap.data() as BookingDoc, scope)) continue;
      const b = fromDoc(snap.data() as BookingDoc);
      const oldStatus = b.status;
      applyBulkAction(b, action);
      if (b.blockId) {
        const d = blockCountDelta(oldStatus, b.status, bookingSeats(b));
        if (d !== 0) deltas.set(b.blockId, (deltas.get(b.blockId) ?? 0) + d);
      }
      out.push({ snap, b });
    }
    const blockSnaps = await Promise.all(
      [...deltas.keys()].map((id) => tx.get(db.collection("blocks").doc(id))),
    );
    for (const { snap, b } of out) tx.set(snap.ref, toDoc(b));
    for (const blockSnap of blockSnaps) {
      if (!blockSnap.exists) continue;
      const d = deltas.get(blockSnap.id)!;
      tx.update(blockSnap.ref, {
        bookedCount: Math.max(0, (blockSnap.data()!.bookedCount ?? 0) + d),
      });
    }
    return out.map((x) => x.b);
  });
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
