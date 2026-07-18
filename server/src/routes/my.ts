import { Router } from "express";
import { z } from "zod";
import { db } from "../firebase";
import { fromDoc, toDoc, type BookingDoc } from "../lib/bookingDoc";
import type { Booking } from "../../../features/bookings/types";
import { applyParentCancel, buildBooking } from "../../../features/bookings/mutations";
import { applyDiscounts, type DiscountRule } from "../../../features/listings/discounts";
import {
  blockCountDelta,
  bookingSeats,
  sessionLabel,
  type BlockDoc,
} from "../lib/blockDomain";
import { emailBookingRequestReceived } from "../lib/emails";
import { bookingDocId } from "./bookings";

// Parent ("my") endpoints. Identity comes exclusively from the verified
// Firebase token — the booker email is stamped server-side and every read
// and write is scoped to it, so one family can never touch another's
// bookings. Bookings land in the tenant that owns the chosen listing.
export const my = Router();

const bookingsCol = db.collection("bookings");

const createSchema = z.object({
  listingId: z.string().min(1),
  blockId: z.string().min(1),
  pass: z.string().min(1),
  child: z.string().min(1),
  age: z.number().int().nonnegative(),
  method: z.string().min(1),
});

const cancelSchema = z.object({
  msg: z.string().max(500).optional(),
});

const childSchema = z.object({
  name: z.string().trim().min(1).max(80),
  age: z.number().int().min(0).max(17).optional(),
  dob: z.string().trim().max(20).optional(),
  school: z.string().trim().max(120).optional(),
  allergies: z.string().trim().max(300).optional(),
  medical: z.string().trim().max(300).optional(),
  send: z.string().trim().max(300).optional(),
  // Photo consent — safeguarding: may this child appear in photos
  // (Moments/newsfeed)? Defaults to NO (privacy-safe).
  photoConsent: z.boolean().optional().default(false),
  // Small avatar as a data URL (client resizes to ~128px). Placeholder until
  // the real file-storage milestone.
  photo: z
    .string()
    .startsWith("data:image/")
    .max(150_000)
    .optional(),
});

const childrenCol = db.collection("children");

// "14 Mar 2018" → age in years (used when the parent gives a DOB but no age).
function ageFromDob(dob?: string): number | undefined {
  if (!dob) return undefined;
  const d = new Date(dob);
  if (isNaN(d.getTime())) return undefined;
  const now = new Date();
  let a = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) a--;
  return a >= 0 && a <= 25 ? a : undefined;
}

function tokenEmail(req: { user?: { email?: string } }): string | null {
  return req.user?.email ?? null;
}

// GET /api/my/bookings — the signed-in parent's bookings, any provider.
my.get("/bookings", async (req, res) => {
  const email = tokenEmail(req);
  if (!email) {
    res.status(400).json({ error: "Account has no email address" });
    return;
  }
  const snap = await bookingsCol.where("email", "==", email).get();
  const list = snap.docs.map((d) => fromDoc(d.data() as BookingDoc));
  list.sort((a, b) => (a.ref < b.ref ? 1 : -1));
  res.json(list);
});

// POST /api/my/bookings — parent books a place on a listing. The price is
// resolved server-side from the listing's pass, and the booking is created
// in the listing's tenant.
my.post("/bookings", async (req, res) => {
  const email = tokenEmail(req);
  if (!email) {
    res.status(400).json({ error: "Account has no email address" });
    return;
  }
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues });
    return;
  }
  const input = parsed.data;

  const listingSnap = await db.collection("listings").doc(input.listingId).get();
  if (!listingSnap.exists) {
    res.status(400).json({ error: "Unknown listing" });
    return;
  }
  const listing = listingSnap.data() as {
    name: string;
    tenantId: string;
    tenantName?: string;
    passes: { name: string; price: number; days?: number }[];
    status?: string;
    archived?: boolean;
    opensAt?: string;
    waitlist?: boolean;
    discounts?: DiscountRule[];
  };
  // Lifecycle gates — the client-side lock is a courtesy, this is the control.
  if ((listing.status ?? "live") !== "live" || listing.archived) {
    res.status(409).json({ error: "This listing isn't open for booking" });
    return;
  }
  if (listing.opensAt && Date.now() < new Date(listing.opensAt).getTime()) {
    res.status(409).json({
      error: `Booking hasn't opened yet — it opens ${new Date(listing.opensAt).toLocaleString("en-GB")}`,
      opensAt: listing.opensAt,
    });
    return;
  }
  const pass = listing.passes.find((p) => p.name === input.pass);
  if (!pass) {
    res.status(400).json({ error: `Listing has no pass "${input.pass}"` });
    return;
  }

  const bookerName = req.user?.name || email.split("@")[0];
  const tenantRef = db.collection("tenants").doc(listing.tenantId);
  const blockRef = db.collection("blocks").doc(input.blockId);

  try {
    const booking = await db.runTransaction(async (tx) => {
      const [tenantSnap, blockSnap] = await Promise.all([tx.get(tenantRef), tx.get(blockRef)]);
      if (!tenantSnap.exists) throw new HttpError(400, "Listing's provider no longer exists");
      if (!blockSnap.exists) throw new HttpError(400, "Unknown block");
      const block = blockSnap.data() as BlockDoc;
      if (block.listingId !== input.listingId || block.tenantId !== listing.tenantId)
        throw new HttpError(400, "Block does not belong to this listing");

      const seats = 1;
      const hasSpace = block.open && block.bookedCount + seats <= block.capacity;
      if (!hasSpace && listing.waitlist === false)
        throw new HttpError(409, "This block is full and the waitlist is off");
      // Waitlist position among existing waitlisted bookings for this block.
      let waitPos = 0;
      if (!hasSpace) {
        const waiting = await tx.get(
          bookingsCol.where("blockId", "==", blockSnap.id).where("status", "==", "Waitlisted"),
        );
        waitPos = waiting.size + 1;
      }

      // The server decides the price: the pass's stored price with the
      // listing's automatic discounts applied (same engine the builder
      // previews — features/listings/discounts.ts).
      const { total } = applyDiscounts(
        listing.discounts ?? [],
        [{ name: pass.name, price: pass.price, days: pass.days ?? block.sessions.length }],
        1,
      );

      const nextBid: number = tenantSnap.data()!.nextBid ?? 10312;
      const b: Booking = {
        ...buildBooking(
          {
            booker: bookerName,
            email,
            child: input.child,
            age: input.age,
            listing: listing.name,
            pass: input.pass,
            dates: block.name,
            amount: total,
            method: input.method,
          },
          nextBid,
        ),
        tenantId: listing.tenantId,
        blockId: blockSnap.id,
        seats,
        sessions: block.sessions.map(sessionLabel),
        // Parent bookings await the provider's approval (which holds a
        // place) — unless the block is full, in which case they join the
        // waitlist. Unpaid until real payments arrive.
        status: hasSpace ? "Approval needed" : "Waitlisted",
        pay: "Unpaid",
        note: hasSpace ? "" : `Waitlist position ${waitPos}`,
      };
      tx.update(tenantRef, { nextBid: nextBid + 1 });
      if (hasSpace) tx.update(blockRef, { bookedCount: block.bookedCount + seats });
      tx.set(bookingsCol.doc(bookingDocId(listing.tenantId, b.ref)), toDoc(b));
      return b;
    });

    emailBookingRequestReceived(booking, listing.tenantName ?? listing.name);
    res.status(201).json(booking);
  } catch (e) {
    if (e instanceof HttpError) res.status(e.status).json({ error: e.message });
    else throw e;
  }
});

// POST /api/my/bookings/:ref/cancel — cancellation request (refund pending,
// for the provider to approve/decline). Only the booking's own family can.
my.post("/bookings/:ref/cancel", async (req, res) => {
  const email = tokenEmail(req);
  if (!email) {
    res.status(400).json({ error: "Account has no email address" });
    return;
  }
  const parsed = cancelSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues });
    return;
  }

  // Find the parent's own booking with this ref (email-scoped query, so a
  // ref from another family is simply never found).
  const matches = await bookingsCol
    .where("email", "==", email)
    .where("ref", "==", req.params.ref)
    .limit(1)
    .get();
  if (matches.empty) {
    res.status(404).json({ error: "Booking not found" });
    return;
  }
  const ref = matches.docs[0].ref;

  try {
    const updated = await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) throw new HttpError(404, "Booking not found");
      const b = fromDoc(snap.data() as BookingDoc);
      if (b.email !== email) throw new HttpError(403, "Not your booking");
      if (b.status === "Cancelled") throw new HttpError(400, "Already cancelled");
      const oldStatus = b.status;
      applyParentCancel(b, parsed.data.msg);
      // Free the block place the booking held (all reads before writes).
      const delta = b.blockId ? blockCountDelta(oldStatus, b.status, bookingSeats(b)) : 0;
      let blockUpdate: { ref: FirebaseFirestore.DocumentReference; count: number } | null = null;
      if (delta !== 0) {
        const blockSnap = await tx.get(db.collection("blocks").doc(b.blockId!));
        if (blockSnap.exists) {
          const count = Math.max(0, (blockSnap.data()!.bookedCount ?? 0) + delta);
          blockUpdate = { ref: blockSnap.ref, count };
        }
      }
      tx.set(ref, toDoc(b));
      if (blockUpdate) tx.update(blockUpdate.ref, { bookedCount: blockUpdate.count });
      return b;
    });
    res.json(updated);
  } catch (e) {
    if (e instanceof HttpError) res.status(e.status).json({ error: e.message });
    else throw e;
  }
});

// ——— Children (the parent's own child profiles — account-level, not
// tenant-scoped: a family exists across providers). Owned strictly by the
// signed-in account via parentUid.

my.get("/children", async (req, res) => {
  const snap = await childrenCol.where("parentUid", "==", req.user!.uid).get();
  const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as { name: string }) }));
  list.sort((a, b) => (a.name < b.name ? -1 : 1));
  res.json(list);
});

my.post("/children", async (req, res) => {
  const parsed = childSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues });
    return;
  }
  const age = parsed.data.age ?? ageFromDob(parsed.data.dob);
  const doc = { ...parsed.data, ...(age !== undefined ? { age } : {}), parentUid: req.user!.uid };
  const ref = await childrenCol.add(doc);
  res.status(201).json({ id: ref.id, ...doc });
});

my.put("/children/:id", async (req, res) => {
  const parsed = childSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues });
    return;
  }
  const snap = await childrenCol.doc(req.params.id).get();
  if (!snap.exists || snap.data()!.parentUid !== req.user!.uid) {
    res.status(404).json({ error: "Child not found" });
    return;
  }
  const age = parsed.data.age ?? ageFromDob(parsed.data.dob);
  const doc = { ...parsed.data, ...(age !== undefined ? { age } : {}), parentUid: req.user!.uid };
  await snap.ref.set(doc);
  res.json({ id: snap.id, ...doc });
});

my.delete("/children/:id", async (req, res) => {
  const snap = await childrenCol.doc(req.params.id).get();
  if (!snap.exists || snap.data()!.parentUid !== req.user!.uid) {
    res.status(404).json({ error: "Child not found" });
    return;
  }
  await snap.ref.delete();
  res.json({ ok: true });
});

class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
