import { Router } from "express";
import { z } from "zod";
import { db } from "../firebase";
import { fromDoc, toDoc, type BookingDoc } from "../lib/bookingDoc";
import type { Booking, BookingPortal } from "../../../features/bookings/types";
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

export const bookings = Router();

const col = db.collection("bookings");
const counters = db.collection("meta").doc("counters");

const portalSchema = z.enum(["admin", "fr", "fl"]);

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
  portal: portalSchema,
  booker: z.string().min(1),
  email: z.string().min(1),
  child: z.string(),
  age: z.number().nonnegative(),
  listing: z.string().min(1),
  pass: z.string().min(1),
  dates: z.string().min(1),
  amount: z.number().nonnegative(),
  method: z.string().min(1),
});

const bulkSchema = z.object({
  portal: portalSchema,
  refs: z.array(z.string().min(1)).min(1),
  action: z.enum(["approve", "decline", "waitlist", "cancel"]),
});

// Doc ids are `${portal}_${ref}` so the same booking ref can exist in several
// portals' datasets (the seed duplicates the legacy records per portal).
const docId = (portal: BookingPortal, ref: string) => `${portal}_${ref}`;

// GET /api/bookings?portal=fl
bookings.get("/", async (req, res) => {
  const portal = portalSchema.safeParse(req.query.portal);
  if (!portal.success) {
    res.status(400).json({ error: "portal query param must be admin|fr|fl" });
    return;
  }
  const snap = await col.where("portal", "==", portal.data).get();
  const list = snap.docs.map((d) => fromDoc(d.data() as BookingDoc));
  // Stable order: newest ref first (matches legacy unshift-on-create feel).
  list.sort((a, b) => (a.ref < b.ref ? 1 : -1));
  res.json(list);
});

// GET /api/bookings/:ref?portal=fl
bookings.get("/:ref", async (req, res) => {
  const portal = portalSchema.safeParse(req.query.portal);
  if (!portal.success) {
    res.status(400).json({ error: "portal query param must be admin|fr|fl" });
    return;
  }
  const doc = await col.doc(docId(portal.data, req.params.ref)).get();
  if (!doc.exists) {
    res.status(404).json({ error: "Booking not found" });
    return;
  }
  res.json(fromDoc(doc.data() as BookingDoc));
});

// POST /api/bookings — take a manual booking
bookings.post("/", async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues });
    return;
  }
  const { portal, ...input } = parsed.data;

  const booking = await db.runTransaction(async (tx) => {
    const counterSnap = await tx.get(counters);
    const nextBid: number = counterSnap.exists ? counterSnap.data()!.nextBid : 10312;
    const b: Booking = { ...buildBooking(input, nextBid), portal };
    tx.set(counters, { nextBid: nextBid + 1 }, { merge: true });
    tx.set(col.doc(docId(portal, b.ref)), toDoc(b));
    return b;
  });

  res.status(201).json(booking);
});

// POST /api/bookings/:ref/actions — every single-booking mutation
bookings.post("/:ref/actions", async (req, res) => {
  const portal = portalSchema.safeParse(req.query.portal ?? req.body.portal);
  if (!portal.success) {
    res.status(400).json({ error: "portal must be admin|fr|fl" });
    return;
  }
  const parsed = actionSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues });
    return;
  }
  const action = parsed.data;
  const ref = col.doc(docId(portal.data, req.params.ref));

  try {
    const updated = await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) throw new NotFound();
      const b = fromDoc(snap.data() as BookingDoc);

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
          applyRowAction(b, action.type);
      }

      tx.set(ref, toDoc(b));
      return b;
    });
    res.json(updated);
  } catch (e) {
    if (e instanceof NotFound) res.status(404).json({ error: "Booking not found" });
    else throw e;
  }
});

// POST /api/bookings/bulk
bookings.post("/bulk", async (req, res) => {
  const parsed = bulkSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues });
    return;
  }
  const { portal, refs, action } = parsed.data;
  const updated = await db.runTransaction(async (tx) => {
    const snaps = await Promise.all(refs.map((r) => tx.get(col.doc(docId(portal, r)))));
    const out: Booking[] = [];
    for (const snap of snaps) {
      if (!snap.exists) continue;
      const b = fromDoc(snap.data() as BookingDoc);
      applyBulkAction(b, action);
      tx.set(snap.ref, toDoc(b));
      out.push(b);
    }
    return out;
  });
  res.json(updated);
});

class NotFound extends Error {}
