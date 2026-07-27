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

// Presence is Present / Absent (no status = Not arrived). Collection is tracked
// SEPARATELY — a collected child stays "present" for the day's count, matching
// the manual (Sign in and Collect are independent one-tap toggles).
interface Entry {
  status?: "in" | "absent";
  inAt?: string | null;
  collectedAt?: string | null;
  collectedBy?: string | null;
  reason?: string | null;   // absent reason (optional)
  by: string;               // who last marked it (email or uid)
  at: string;               // when the entry last changed
}
interface HeadCount { n: number; by: string; at: string }
interface RegisterDoc {
  tenantId: string;
  listingId: string;
  blockId: string;
  date: string;
  entries: Record<string, Entry>; // keyed by booking ref
  heads?: HeadCount[];            // quick head-count tally
  takenBy?: { name: string; at: string } | null; // who took the register
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

  // Resolve each booking's child record (by id) so the register can show the
  // face, allergies, SEND plan and collection password — a safeguarding read,
  // scoped to children booked into THIS tenant's sessions. Never by name.
  const childIds = new Set<string>();
  for (const snap of bookingSnaps)
    for (const d of snap.docs) {
      const b = fromDoc(d.data() as BookingDoc);
      if (b.childId) childIds.add(b.childId);
    }
  const childDocs = childIds.size
    ? await db.getAll(...[...childIds].map((cid) => db.collection("children").doc(cid)))
    : [];
  const childById = new Map(
    childDocs.filter((d) => d.exists).map((d) => {
      const c = d.data() as Record<string, unknown>;
      return [d.id, {
        photo: c.photo as string | undefined,
        dob: c.dob as string | undefined,
        school: c.school as string | undefined,
        allergies: c.allergies as string | undefined,
        medical: c.medical as string | undefined,
        dietary: c.dietary as string | undefined,
        send: c.send as string | undefined,
        sendPlanId: c.sendPlanId as string | undefined,
        sendPlanName: c.sendPlanName as string | undefined,
        careNotes: c.careNotes as string | undefined,
        collectionPassword: c.collectionPassword as string | undefined,
        emergencyName: c.emergencyName as string | undefined,
        emergencyPhone: c.emergencyPhone as string | undefined,
        photoConsent: c.photoConsent as boolean | undefined,
      }];
    }),
  );

  const out = todays.map(({ id, block, session }, i) => {
    const reg = regSnaps[i].exists ? (regSnaps[i].data() as RegisterDoc) : null;
    const entries = reg?.entries ?? {};
    const attendees = bookingSnaps[i].docs
      .map((d) => fromDoc(d.data() as BookingDoc))
      // Expected = holds a place AND is booked for THIS day (bookings with
      // chosen days only appear on those; older whole-block bookings on all).
      // Offered holds a seat but isn't expected — they haven't accepted yet.
      .filter((b) => countsTowardCapacity(b.status) && b.status !== "Offered" && (!b.days || b.days.includes(date)))
      .map((b) => ({
        ref: b.ref,
        booker: b.booker,
        bookingStatus: b.status,
        seats: b.seats ?? 1,
        children: b.kids?.length
          ? b.kids.map((k) => ({ name: k.name, age: k.age }))
          : [{ name: b.child, age: b.age }],
        // Safeguarding, resolved from the child record (only when the booking
        // carries a real childId — never guessed from the name).
        child: b.childId ? childById.get(b.childId) ?? null : null,
        attendance: entries[b.ref] ?? null,
      }))
      .sort((a, b) => (a.children[0].name < b.children[0].name ? -1 : 1));
    const present = attendees.filter((a) => a.attendance?.status === "in").length;
    const absent = attendees.filter((a) => a.attendance?.status === "absent").length;
    const counts = {
      expected: attendees.length,
      present,
      notArrived: attendees.length - present - absent,
      absent,
      collected: attendees.filter((a) => a.attendance?.collectedAt).length,
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
      heads: reg?.heads ?? [],
      takenBy: reg?.takenBy ?? null,
    };
  });
  out.sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : a.blockName < b.blockName ? -1 : 1));
  res.json(out);
});

const markSchema = z.object({
  ref: z.string().min(1),
  // in = sign in / present (toggle), absent = absent-ill (toggle), collect =
  // collected (independent toggle), reset = back to not-arrived.
  action: z.enum(["in", "absent", "collect", "reset"]),
  collectedBy: z.string().trim().max(120).optional(),
  reason: z.string().trim().max(200).optional(),
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
  if (!countsTowardCapacity(booking.status) || booking.status === "Offered") {
    res.status(409).json({ error: `Booking is ${booking.status} — not expected on the register` });
    return;
  }
  if (booking.days && !booking.days.includes(date)) {
    res.status(409).json({ error: `This booking isn't for ${date}` });
    return;
  }

  const by = req.user?.email ?? req.user?.uid ?? "unknown";
  const takenByName = req.user?.name ?? req.user?.email ?? "Staff";
  const now = new Date().toISOString();
  const { action, collectedBy, reason, ref: bref } = parsed.data;
  const ref = regsCol.doc(regId(blockId, date));
  const entry = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const doc: RegisterDoc = snap.exists
      ? (snap.data() as RegisterDoc)
      : { tenantId: auth.tenantId!, listingId: block.listingId, blockId, date, entries: {} };
    const prev = doc.entries[bref];
    const keepCollect = { collectedAt: prev?.collectedAt ?? null, collectedBy: prev?.collectedBy ?? null };
    if (action === "reset") {
      delete doc.entries[bref];
    } else if (action === "in") {
      if (prev?.status === "in") delete doc.entries[bref];                    // toggle off → not arrived
      else doc.entries[bref] = { status: "in", inAt: now, ...keepCollect, by, at: now };
    } else if (action === "absent") {
      if (prev?.status === "absent") delete doc.entries[bref];                // toggle off → not arrived
      else doc.entries[bref] = { status: "absent", inAt: null, collectedAt: null, collectedBy: null, reason: reason ?? null, by, at: now };
    } else if (action === "collect") {
      const base: Entry = prev ?? { status: "in", inAt: now, collectedAt: null, collectedBy: null, by, at: now };
      doc.entries[bref] = prev?.collectedAt
        ? { ...base, collectedAt: null, collectedBy: null, by, at: now }      // toggle off
        : { ...base, status: base.status ?? "in", collectedAt: now, collectedBy: collectedBy ?? null, by, at: now };
    }
    doc.takenBy = { name: takenByName, at: now };
    tx.set(ref, doc);
    return doc.entries[bref] ?? null;
  });

  res.json({ ref: bref, attendance: entry });
});

const headSchema = z.object({ n: z.number().int().min(0).max(999) });

// POST /api/registers/{blockId}/{date}/headcount — log a quick head-count tally.
registers.post("/:blockId/:date/headcount", async (req, res) => {
  const auth = req.auth!;
  if (!canMark(auth.role) || !auth.tenantId) { res.status(403).json({ error: "Requires a staff or operator account" }); return; }
  const parsed = headSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues }); return; }
  const { blockId, date } = req.params;
  const blockSnap = await db.collection("blocks").doc(blockId).get();
  if (!blockSnap.exists || blockSnap.data()!.tenantId !== auth.tenantId) { res.status(404).json({ error: "Block not found" }); return; }
  const block = blockSnap.data() as BlockDoc;
  const ref = regsCol.doc(regId(blockId, date));
  const by = req.user?.name ?? req.user?.email ?? "Staff";
  const now = new Date().toISOString();
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const doc: RegisterDoc = snap.exists ? (snap.data() as RegisterDoc) : { tenantId: auth.tenantId!, listingId: block.listingId, blockId, date, entries: {} };
    doc.heads = [...(doc.heads ?? []), { n: parsed.data.n, by, at: now }].slice(-30);
    doc.takenBy = { name: by, at: now };
    tx.set(ref, doc);
  });
  res.status(201).json({ ok: true });
});
