import { Router, type Request } from "express";
import { z } from "zod";
import { db } from "../firebase";
import { canWrite } from "../middleware/role";
import { fromDoc, type BookingDoc } from "../lib/bookingDoc";
import {
  blockSummary,
  countsTowardCapacity,
  generateSessions,
  type BlockDoc,
} from "../lib/blockDomain";

// Blocks — the sellable runs of a listing ("Week 2 · 4–8 Aug"), with
// capacity and per-day sessions. Tenant-scoped exactly like listings.
export const blocks = Router();

const col = db.collection("blocks");

const timeRe = /^\d{2}:\d{2}$/;
const dateRe = /^\d{4}-\d{2}-\d{2}$/;

const blockSchema = z
  .object({
    listingId: z.string().min(1),
    name: z.string().trim().min(2).max(120),
    startDate: z.string().regex(dateRe),
    endDate: z.string().regex(dateRe),
    capacity: z.number().int().min(1).max(10_000),
    open: z.boolean().optional().default(true),
    schedule: z
      .object({
        startTime: z.string().regex(timeRe),
        endTime: z.string().regex(timeRe),
        // 0=Sun … 6=Sat; defaults to Mon–Fri
        weekdays: z.array(z.number().int().min(0).max(6)).min(1).optional(),
      })
      .optional(),
    sessions: z
      .array(
        z.object({
          date: z.string().regex(dateRe),
          start: z.string().regex(timeRe),
          end: z.string().regex(timeRe),
        }),
      )
      .max(200)
      .optional(),
  })
  .refine((b) => b.schedule || b.sessions?.length, {
    message: "Provide either schedule (sessions are generated) or an explicit sessions array",
  })
  .refine((b) => b.startDate <= b.endDate, { message: "startDate must be before endDate" });

function resolveSessions(data: z.infer<typeof blockSchema>) {
  if (data.sessions?.length) return data.sessions;
  const s = data.schedule!;
  return generateSessions(
    data.startDate,
    data.endDate,
    s.startTime,
    s.endTime,
    s.weekdays ?? [1, 2, 3, 4, 5],
  );
}

async function ownBlock(req: Request, id: string) {
  const auth = req.auth!;
  if (!canWrite(auth.role) || !auth.tenantId) return { status: 403 as const };
  const snap = await col.doc(id).get();
  if (!snap.exists || snap.data()!.tenantId !== auth.tenantId) return { status: 404 as const };
  return { status: 200 as const, snap };
}

// GET /api/blocks?listingId= — my tenant's blocks (platform: ?tenantId=).
blocks.get("/", async (req, res) => {
  const auth = req.auth!;
  let tenantId = auth.tenantId;
  if (auth.role === "platform") tenantId = (req.query.tenantId as string) || null;
  else if (auth.role === "parent") {
    res.status(403).json({ error: "Requires an operator account" });
    return;
  }
  if (!tenantId) {
    res.status(403).json({ error: "Requires an operator account with a tenant" });
    return;
  }
  let q: FirebaseFirestore.Query = col.where("tenantId", "==", tenantId);
  if (typeof req.query.listingId === "string") q = q.where("listingId", "==", req.query.listingId);
  const snap = await q.get();
  const list = snap.docs.map((d) => blockSummary(d.id, d.data() as BlockDoc));
  list.sort((a, b) => (a.startDate < b.startDate ? -1 : 1));
  res.json(list);
});

// POST /api/blocks
blocks.post("/", async (req, res) => {
  const auth = req.auth!;
  if (!canWrite(auth.role) || !auth.tenantId) {
    res.status(403).json({ error: "Requires an operator account with a tenant" });
    return;
  }
  const parsed = blockSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues });
    return;
  }
  const listing = await db.collection("listings").doc(parsed.data.listingId).get();
  if (!listing.exists || listing.data()!.tenantId !== auth.tenantId) {
    res.status(400).json({ error: "Unknown listing (must belong to your tenant)" });
    return;
  }
  const doc: BlockDoc = {
    tenantId: auth.tenantId,
    listingId: parsed.data.listingId,
    name: parsed.data.name,
    startDate: parsed.data.startDate,
    endDate: parsed.data.endDate,
    capacity: parsed.data.capacity,
    bookedCount: 0,
    open: parsed.data.open,
    sessions: resolveSessions(parsed.data),
  };
  const ref = await col.add(doc);
  res.status(201).json(blockSummary(ref.id, doc));
});

// PUT /api/blocks/:id — bookedCount is never client-writable.
blocks.put("/:id", async (req, res) => {
  const own = await ownBlock(req, req.params.id);
  if (own.status !== 200) {
    res
      .status(own.status)
      .json({ error: own.status === 403 ? "Requires an operator account" : "Block not found" });
    return;
  }
  const parsed = blockSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues });
    return;
  }
  const existing = own.snap.data() as BlockDoc;
  if (parsed.data.listingId !== existing.listingId) {
    res.status(400).json({ error: "A block cannot move to another listing" });
    return;
  }
  const doc: BlockDoc = {
    ...existing,
    name: parsed.data.name,
    startDate: parsed.data.startDate,
    endDate: parsed.data.endDate,
    capacity: parsed.data.capacity,
    open: parsed.data.open,
    sessions: resolveSessions(parsed.data),
  };
  await own.snap.ref.set(doc);
  res.json(blockSummary(own.snap.id, doc));
});

// DELETE /api/blocks/:id — refuses while bookings hold places in it.
blocks.delete("/:id", async (req, res) => {
  const own = await ownBlock(req, req.params.id);
  if (own.status !== 200) {
    res
      .status(own.status)
      .json({ error: own.status === 403 ? "Requires an operator account" : "Block not found" });
    return;
  }
  if ((own.snap.data() as BlockDoc).bookedCount > 0) {
    res.status(409).json({ error: "Block has active bookings — cancel or move them first" });
    return;
  }
  await own.snap.ref.delete();
  res.json({ ok: true });
});

// GET /api/blocks/:id/attendees — who's booked in (the register foundation).
blocks.get("/:id/attendees", async (req, res) => {
  const auth = req.auth!;
  // Read access: any operator of the tenant (incl. read-only staff/platform).
  const snap = await col.doc(req.params.id).get();
  if (!snap.exists) {
    res.status(404).json({ error: "Block not found" });
    return;
  }
  const block = snap.data() as BlockDoc;
  const allowed =
    auth.role === "platform" || (auth.tenantId && auth.tenantId === block.tenantId);
  if (!allowed) {
    res.status(404).json({ error: "Block not found" });
    return;
  }

  const bookingsSnap = await db.collection("bookings").where("blockId", "==", snap.id).get();
  const attendees = bookingsSnap.docs
    .map((d) => fromDoc(d.data() as BookingDoc))
    .filter((b) => countsTowardCapacity(b.status) || b.status === "Waitlisted")
    .map((b) => ({
      ref: b.ref,
      status: b.status,
      booker: b.booker,
      email: b.email,
      seats: b.seats ?? 1,
      children: b.kids?.length
        ? b.kids.map((k) => ({ name: k.name, age: k.age }))
        : [{ name: b.child, age: b.age }],
    }));

  res.json({ block: blockSummary(snap.id, block), attendees });
});
