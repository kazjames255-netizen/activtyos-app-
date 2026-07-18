import { Router } from "express";
import { z } from "zod";
import { db } from "../firebase";
import type { Role } from "../middleware/role";
import { countsTowardCapacity, type BlockDoc } from "../lib/blockDomain";
import { fromDoc, type BookingDoc } from "../lib/bookingDoc";

// ─────────────────────────────────────────────────────────────────────────
// Registers — the staff portal's core tool ("run the day on the ground").
//
// A register is one block-session: a block + a date. Who's EXPECTED comes
// from the bookings that hold a place (Confirmed / Approval needed) on that
// block; the register doc only stores what happened on the day — check-in,
// check-out, absent — one entry per booking ref, stamped with who marked it
// and when. Docs are created lazily on the first mark (`{blockId}_{date}`),
// so a day nobody touched costs nothing.
//
// Permissions: this is the ONE place the read-only `staff` role can write —
// taking attendance is their job. Operators can too. Platform reads
// (`?tenantId=`) but never marks; parents see none of it.
// ─────────────────────────────────────────────────────────────────────────

export const registers = Router();

const regsCol = db.collection("registers");

const canMark = (role: Role) =>
  role === "staff" || role === "company" || role === "freelancer" || role === "franchise";

const regId = (blockId: string, date: string) => `${blockId}_${date}`;

type MarkStatus = "in" | "out" | "absent";
interface Entry {
  status: MarkStatus;
  inAt: string | null;
  outAt: string | null;
  by: string; // who marked it (email or uid)
  at: string; // when the entry last changed
}
interface RegisterDoc {
  tenantId: string;
  listingId: string;
  blockId: string;
  date: string;
  entries: Record<string, Entry>; // keyed by booking ref
}

const todayIso = () => new Date().toISOString().slice(0, 10);

// GET /api/registers?date=YYYY-MM-DD — every session my tenant runs that
// day (default today), each with its expected attendees merged with the
// attendance taken so far. Platform passes ?tenantId=.
registers.get("/", async (req, res) => {
  const auth = req.auth!;
  if (auth.role === "parent") {
    res.status(403).json({ error: "Requires an operator or staff account" });
    return;
  }
  let tenantId = auth.tenantId;
  if (auth.role === "platform") {
    tenantId = typeof req.query.tenantId === "string" ? req.query.tenantId : null;
    if (!tenantId) {
      res.status(400).json({ error: "Platform accounts must pass ?tenantId=" });
      return;
    }
  }
  if (!tenantId) {
    res.status(403).json({ error: "Your account has no tenant" });
    return;
  }
  const date = typeof req.query.date === "string" && req.query.date ? req.query.date : todayIso();

  // The day's sessions: tenant blocks with a session on that date.
  const blocksSnap = await db.collection("blocks").where("tenantId", "==", tenantId).get();
  const todays = blocksSnap.docs
    .map((d) => ({ id: d.id, block: d.data() as BlockDoc }))
    .map(({ id, block }) => ({ id, block, session: block.sessions.find((s) => s.date === date) }))
    .filter((x): x is typeof x & { session: NonNullable<(typeof x)["session"]> } => !!x.session);

  if (!todays.length) {
    res.json([]);
    return;
  }

  const [bookingSnaps, regSnaps, listingSnaps] = await Promise.all([
    Promise.all(
      todays.map(({ id }) => db.collection("bookings").where("blockId", "==", id).get()),
    ),
    db.getAll(...todays.map(({ id }) => regsCol.doc(regId(id, date)))),
    db.getAll(...[...new Set(todays.map(({ block }) => block.listingId))].map((lid) =>
      db.collection("listings").doc(lid),
    )),
  ]);
  const listingName = new Map(
    listingSnaps.map((s) => [s.id, s.exists ? ((s.data()!.name as string) ?? "") : "(deleted listing)"]),
  );

  const out = todays.map(({ id, block, session }, i) => {
    const entries = regSnaps[i].exists ? ((regSnaps[i].data() as RegisterDoc).entries ?? {}) : {};
    const attendees = bookingSnaps[i].docs
      .map((d) => fromDoc(d.data() as BookingDoc))
      // Expected = holds a place AND is booked for THIS day (bookings with
      // chosen days only appear on those; older whole-block bookings on all).
      .filter((b) => countsTowardCapacity(b.status) && (!b.days || b.days.includes(date)))
      .map((b) => ({
        ref: b.ref,
        booker: b.booker,
        bookingStatus: b.status,
        seats: b.seats ?? 1,
        children: b.kids?.length
          ? b.kids.map((k) => ({ name: k.name, age: k.age }))
          : [{ name: b.child, age: b.age }],
        attendance: entries[b.ref] ?? null,
      }))
      .sort((a, b) => (a.children[0].name < b.children[0].name ? -1 : 1));
    const counts = {
      expected: attendees.length,
      in: attendees.filter((a) => a.attendance?.status === "in").length,
      out: attendees.filter((a) => a.attendance?.status === "out").length,
      absent: attendees.filter((a) => a.attendance?.status === "absent").length,
    };
    return {
      blockId: id,
      date,
      start: session.start,
      end: session.end,
      blockName: block.name,
      listingId: block.listingId,
      listingName: listingName.get(block.listingId) ?? "",
      attendees,
      counts,
    };
  });
  out.sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : a.blockName < b.blockName ? -1 : 1));
  res.json(out);
});

const markSchema = z.object({
  ref: z.string().min(1),
  // "expected" = undo: clears the entry so the child is back to expected.
  status: z.enum(["in", "out", "absent", "expected"]),
});

// POST /api/registers/{blockId}/{date}/mark — check a child in/out or mark
// absent. Staff's one write. "out" keeps the check-in time; "expected"
// clears the entry entirely (mis-tap undo).
registers.post("/:blockId/:date/mark", async (req, res) => {
  const auth = req.auth!;
  if (!canMark(auth.role) || !auth.tenantId) {
    res.status(403).json({ error: "Requires a staff or operator account with a tenant" });
    return;
  }
  const parsed = markSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues });
    return;
  }
  const { blockId, date } = req.params;

  const blockSnap = await db.collection("blocks").doc(blockId).get();
  if (!blockSnap.exists || blockSnap.data()!.tenantId !== auth.tenantId) {
    res.status(404).json({ error: "Block not found" });
    return;
  }
  const block = blockSnap.data() as BlockDoc;
  if (!block.sessions.some((s) => s.date === date)) {
    res.status(400).json({ error: `This block has no session on ${date}` });
    return;
  }
  const bookingSnap = await db
    .collection("bookings")
    .where("tenantId", "==", auth.tenantId)
    .where("blockId", "==", blockId)
    .where("ref", "==", parsed.data.ref)
    .limit(1)
    .get();
  if (bookingSnap.empty) {
    res.status(404).json({ error: "Booking not found on this block" });
    return;
  }
  const booking = fromDoc(bookingSnap.docs[0].data() as BookingDoc);
  if (!countsTowardCapacity(booking.status)) {
    res.status(409).json({ error: `Booking is ${booking.status} — not expected on the register` });
    return;
  }
  if (booking.days && !booking.days.includes(date)) {
    res.status(409).json({ error: `This booking isn't for ${date}` });
    return;
  }

  const by = req.user?.email ?? req.user?.uid ?? "unknown";
  const now = new Date().toISOString();
  const ref = regsCol.doc(regId(blockId, date));
  const entry = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const doc: RegisterDoc = snap.exists
      ? (snap.data() as RegisterDoc)
      : { tenantId: auth.tenantId!, listingId: block.listingId, blockId, date, entries: {} };
    const prev = doc.entries[parsed.data.ref];
    if (parsed.data.status === "expected") {
      delete doc.entries[parsed.data.ref];
    } else if (parsed.data.status === "in") {
      doc.entries[parsed.data.ref] = { status: "in", inAt: now, outAt: null, by, at: now };
    } else if (parsed.data.status === "out") {
      doc.entries[parsed.data.ref] = {
        status: "out",
        inAt: prev?.inAt ?? null, // keep when they arrived
        outAt: now,
        by,
        at: now,
      };
    } else {
      doc.entries[parsed.data.ref] = { status: "absent", inAt: null, outAt: null, by, at: now };
    }
    tx.set(ref, doc);
    return doc.entries[parsed.data.ref] ?? null;
  });

  res.json({ ref: parsed.data.ref, attendance: entry });
});
