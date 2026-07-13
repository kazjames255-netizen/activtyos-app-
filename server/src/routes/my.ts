import { Router } from "express";
import { z } from "zod";
import { db } from "../firebase";
import { fromDoc, toDoc, type BookingDoc } from "../lib/bookingDoc";
import type { Booking } from "../../../features/bookings/types";
import { applyParentCancel, buildBooking } from "../../../features/bookings/mutations";
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
  pass: z.string().min(1),
  dates: z.string().min(1),
  child: z.string().min(1),
  age: z.number().int().nonnegative(),
  method: z.string().min(1),
});

const cancelSchema = z.object({
  msg: z.string().max(500).optional(),
});

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
    passes: { name: string; price: number }[];
    blocks: string[];
  };
  const pass = listing.passes.find((p) => p.name === input.pass);
  if (!pass) {
    res.status(400).json({ error: `Listing has no pass "${input.pass}"` });
    return;
  }
  if (!listing.blocks.includes(input.dates)) {
    res.status(400).json({ error: `Listing has no block "${input.dates}"` });
    return;
  }

  const bookerName = req.user?.name || email.split("@")[0];
  const tenantRef = db.collection("tenants").doc(listing.tenantId);

  const booking = await db.runTransaction(async (tx) => {
    const tenantSnap = await tx.get(tenantRef);
    if (!tenantSnap.exists) throw new HttpError(400, "Listing's provider no longer exists");
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
          dates: input.dates,
          amount: pass.price,
          method: input.method,
        },
        nextBid,
      ),
      tenantId: listing.tenantId,
      // Parent bookings await the provider's approval and are unpaid until
      // real payments (Stripe / Tax-Free Childcare) arrive.
      status: "Approval needed",
      pay: "Unpaid",
      note: "",
    };
    tx.update(tenantRef, { nextBid: nextBid + 1 });
    tx.set(bookingsCol.doc(bookingDocId(listing.tenantId, b.ref)), toDoc(b));
    return b;
  });

  emailBookingRequestReceived(booking, listing.tenantName ?? listing.name);

  res.status(201).json(booking);
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
      applyParentCancel(b, parsed.data.msg);
      tx.set(ref, toDoc(b));
      return b;
    });
    res.json(updated);
  } catch (e) {
    if (e instanceof HttpError) res.status(e.status).json({ error: e.message });
    else throw e;
  }
});

class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
