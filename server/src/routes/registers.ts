import { Router } from "express";
import { z } from "zod";
import { db } from "../firebase";
import { isPlainStaff, type Role } from "../middleware/role";
import type { BlockDoc } from "../lib/blockDomain";
import { fromDoc, type BookingDoc } from "../lib/bookingDoc";
import { franchiseListingIds } from "../lib/franchiseScope";
import { staffSiteScope } from "../lib/siteScope";
import { bookingExpectedOn, bookingRefOfKey, entryFor, registerRows } from "../lib/registerRows";
import { ukToday } from "../lib/ukDate";
import { realPhone } from "../../../features/bookings/helpers";

// ─────────────────────────────────────────────────────────────────────────
// Registers — the staff portal's core tool ("run the day on the ground").
//
// A register is one block-session: a block + a date. Who's EXPECTED comes
// from the bookings that hold a place (Confirmed / Approval needed) on that
// block; the register doc only stores what happened on the day — check-in,
// check-out, absent — one entry per CHILD (the booking ref, or ref#child for
// siblings on one booking — see lib/registerRows.ts), stamped with who marked
// it and when. Docs are created lazily on the first mark (`{blockId}_{date}`),
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
  entries: Record<string, Entry>; // keyed by booking ref, or ref#child for siblings
  heads?: HeadCount[];            // quick head-count tally
  takenBy?: { name: string; at: string } | null; // who took the register
  // Staff jottings on the day, keyed like entries (one per child). These used
  // to live in each phone's localStorage: two staff on two phones never saw
  // each other's notes or nappy changes, and clearing the browser lost them.
  notes?: Record<string, RegNote>;
  nappies?: Record<string, NappyChange[]>;
  nudges?: Record<string, string>;  // when the family was last chased for a late pick-up
}
interface RegNote { text: string; at: string; by: string; byEmail?: string; archived?: boolean; shareParent?: boolean }
interface NappyChange { at: string; by: string }

const todayIso = () => ukToday();

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

  // A franchise only registers its OWN children — narrow the day's sessions to
  // blocks whose listing the franchise owns. Head office sees the whole tenant.
  // (Cross-franchise child-safeguarding isolation.)
  let franchiseListings: Set<string> | null = null;
  if ((auth.role === "franchise" || auth.role === "staff") && auth.franchiseId) {
    franchiseListings = await franchiseListingIds(tenantId, auth.franchiseId);
  }
  // A member of staff assigned to certain sites (a site lead) registers only
  // those sites' sessions (acceptance d23s5).
  const site = await staffSiteScope(auth);
  // The day's sessions: tenant blocks with a session on that date.
  const blocksSnap = await db.collection("blocks").where("tenantId", "==", tenantId).get();
  const todays = blocksSnap.docs
    .map((d) => ({ id: d.id, block: d.data() as BlockDoc }))
    .filter(({ block }) => !franchiseListings || franchiseListings.has(block.listingId))
    .filter(({ block }) => !site || site.listings.has(block.listingId))
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
    for (const d of snap.docs)
      for (const r of registerRows(fromDoc(d.data() as BookingDoc), date)) if (r.childId) childIds.add(r.childId);
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
        // Fuller picture for the register's child card (shown on tap only).
        likes: c.likes as string | undefined,
        dislikes: c.dislikes as string | undefined,
        swimming: c.swimming as string | undefined,
        sex: c.sex as string | undefined,
        suncreamConsent: c.suncreamConsent as boolean | undefined,
        firstAidConsent: c.firstAidConsent as boolean | undefined,
        walkHomeConsent: c.walkHomeConsent as boolean | undefined,
        answers: (c.answers as Record<string, string> | undefined) ?? undefined,
      }];
    }),
  );

  // Each child's authorised medicines (active, not withdrawn) — so staff running
  // the session see the inhaler/EpiPen on the register itself, not only if they
  // think to open Medication (acceptance test d12s9). Same tenant only.
  const medsByChild = new Map<string, { name: string; dose: string; schedule?: string; asNeeded?: boolean; heldOnSite?: boolean; consent: boolean }[]>();
  const ids = [...childIds];
  for (let k = 0; k < ids.length; k += 30) {
    const ms = await db.collection("medications").where("childId", "in", ids.slice(k, k + 30)).get();
    for (const m of ms.docs) {
      const x = m.data();
      if (x.tenantId !== tenantId || x.archived || x.consentWithdrawnAt) continue;
      const list = medsByChild.get(x.childId) ?? [];
      list.push({ name: String(x.name ?? ""), dose: String(x.dose ?? ""), schedule: x.schedule || undefined, asNeeded: !!x.asNeeded, heldOnSite: !!x.heldOnSite, consent: x.consentGranted === true });
      medsByChild.set(x.childId, list);
    }
  }
  for (const [cid, meds] of medsByChild) { const c = childById.get(cid); if (c) (c as Record<string, unknown>).medications = meds; }

  // The number to ring at hand-over. Older bookings were stamped "—" instead of
  // the family's phone (d10s8) — fall back to the one this provider holds on
  // the family's customer record (same tenant only).
  const noPhone = [...new Set(bookingSnaps.flatMap((s) => s.docs.map((d) => fromDoc(d.data() as BookingDoc)))
    .filter((b) => !realPhone(b.phone) && b.email).map((b) => b.email))];
  const phoneByEmail = new Map<string, string>();
  for (let k = 0; k < noPhone.length; k += 30) {
    const cs = await db.collection("customers").where("tenantId", "==", tenantId).where("email", "in", noPhone.slice(k, k + 30)).get();
    for (const cd of cs.docs) { const ph = realPhone(cd.get("phone") as string | undefined); if (ph) phoneByEmail.set(String(cd.get("email") ?? ""), ph); }
  }

  const out = todays.map(({ id, block, session }, i) => {
    const reg = regSnaps[i].exists ? (regSnaps[i].data() as RegisterDoc) : null;
    const entries = reg?.entries ?? {};
    const attendees = bookingSnaps[i].docs
      .map((d) => fromDoc(d.data() as BookingDoc))
      .flatMap((b) => registerRows(b, date).map((r) => ({ b, r, att: entryFor(entries, r) ?? null })))
      // Expected = holds a place AND is booked for THIS day (bookings with
      // chosen days only appear on those; older whole-block bookings on all).
      // Offered holds a seat but isn't expected — they haven't accepted yet.
      //
      // …OR is physically here: signed in and not yet collected. A booking
      // cancelled by the office while the child is on site used to drop them off
      // the register, and then nobody could sign them out — a child in your care
      // with no record of who took them home. They stay until collected.
      // (Collected too: it stays on the day's list so a mis-tapped Collect can
      // be undone — it used to vanish the moment it was marked.)
      .filter(({ r, att }) => r.expected || att?.status === "in")
      .map(({ b, r, att }) => ({
        ref: r.key,
        bookingRef: r.bookingRef,
        booker: b.booker,
        email: b.email ?? "",
        phone: realPhone(b.phone) || phoneByEmail.get(b.email ?? "") || "",
        note: b.note ?? "",
        addons: b.addons ?? [],
        bookingStatus: b.status,
        seats: 1,
        children: [{ name: r.name, age: r.age }],
        // Safeguarding, resolved from THIS child's record (only when it carries
        // a real childId — never guessed from the name, never the sibling's).
        child: r.childId ? childById.get(r.childId) ?? null : null,
        childId: r.childId ?? null,
        attendance: att,
        ...(r.expected ? {} : { cancelledOnSite: true }),
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
      notes: reg?.notes ?? {},
      nappies: reg?.nappies ?? {},
      nudges: reg?.nudges ?? {},
    };
  });
  out.sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : a.blockName < b.blockName ? -1 : 1));
  res.json(out);
});

// ── Marks are EXPLICIT states, not toggles (acceptance d10s12) ───────────────
// Each action says what the child's state should BE; none of them flips:
//   in        → signed in / present          (already in: nothing changes)
//   absent    → absent                        (already absent: nothing changes)
//   collect   → collected (signs in if needed) (already collected: nothing changes)
//   uncollect → undo a collect, still present  (not collected: nothing changes)
//   reset     → clear back to not-arrived      (no mark: nothing changes)
// Undo is therefore its own explicit action (reset / uncollect), never "tap
// the same button again".
//
// Two phones on one register — what happens:
//  • Both tap the SAME thing (A taps In, B's stale screen still says "not
//    arrived" and B taps In too): the second is a no-op. The child stays In,
//    keeping the FIRST sign-in time and who took it. Under the old toggles B's
//    tap signed the child OUT of the register — both phones then agreed, on the
//    wrong answer, with a child on site recorded as not here.
//  • They tap DIFFERENT things from a stale screen (A signs the child In; B,
//    still showing "not arrived", taps Absent): the client sends `from`, the
//    state its screen showed. The server state no longer matches it, so B is
//    REFUSED with 409 `register_changed` and the current mark (who, when);
//    B's screen refreshes to show what A did, and B re-taps if they still mean
//    it — now as a deliberate change from a state they can see. A stale screen
//    can never silently overwrite a colleague's mark, and in particular can
//    never quietly turn a signed-in child into absent / not-arrived.
//  • Same-moment taps are serialised by the transaction, so the rules above
//    hold even when both requests arrive together.
// `from` is optional so other callers (API/scripts) still work: without it
// the explicit state is simply set (idempotently).
const markSchema = z.object({
  ref: z.string().min(1),
  action: z.enum(["in", "absent", "collect", "uncollect", "reset"]),
  // The state the marking device's screen showed when it was tapped.
  from: z.enum(["none", "in", "absent", "collected"]).optional(),
  collectedBy: z.string().trim().max(120).optional(),
  reason: z.string().trim().max(200).optional(),
});
type MarkState = "none" | "in" | "absent" | "collected";
const stateOf = (e?: Entry | null): MarkState =>
  !e?.status ? "none" : e.status === "absent" ? "absent" : e.collectedAt ? "collected" : "in";

// POST /api/registers/{blockId}/{date}/mark — check a child in/out or mark
// absent. Staff's one write. Sets the explicit state asked for (see above);
// `reset` clears the entry entirely (mis-tap undo).
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
  if (!(await blockInMyFranchise(auth, block))) {
    res.status(404).json({ error: "Block not found" });
    return;
  }
  if (!block.sessions.some((s) => s.date === date)) {
    res.status(400).json({ error: `This block has no session on ${date}` });
    return;
  }
  // Staff mark the registers for sessions they're on. When this session has
  // been rostered (shifts for its listing that day), a staff member who isn't
  // one of them can't mark it; leads and managers always can, and a session
  // with no shifts set up stays open to the team (acceptance test d24s8).
  if (isPlainStaff(auth)) {
    const shifts = (await db.collection("shifts").where("tenantId", "==", auth.tenantId).where("date", "==", date).get()).docs
      .map((d) => d.data() as { listingId?: string; staffName?: string; staffEmail?: string })
      .filter((x) => x.listingId && x.listingId === block.listingId);
    if (shifts.length) {
      const me = String((await db.collection("users").doc(req.user!.uid).get()).get("name") ?? "").trim().toLowerCase();
      const email = (req.user?.email ?? "").toLowerCase();
      if (!shifts.some((x) => (me && String(x.staffName ?? "").trim().toLowerCase() === me) || (email && String(x.staffEmail ?? "").toLowerCase() === email))) {
        res.status(403).json({ error: "You're not on the rota for this session — ask the session lead or a manager to mark it.", code: "not_rostered" });
        return;
      }
    }
  }
  // `ref` is the register key: a booking ref, or ref#child for one sibling.
  const bookingRef = bookingRefOfKey(parsed.data.ref);
  const bookingSnap = await db
    .collection("bookings")
    .where("tenantId", "==", auth.tenantId)
    .where("blockId", "==", blockId)
    .where("ref", "==", bookingRef)
    .limit(1)
    .get();
  if (bookingSnap.empty) {
    res.status(404).json({ error: "Booking not found on this block" });
    return;
  }
  const booking = fromDoc(bookingSnap.docs[0].data() as BookingDoc);
  const rows = registerRows(booking, date);
  const row = rows.find((r) => r.key === parsed.data.ref);
  if (!row) {
    res.status(404).json({ error: "That child isn't on this booking" });
    return;
  }

  const by = req.user?.email ?? req.user?.uid ?? "unknown";
  const takenByName = req.user?.name ?? req.user?.email ?? "Staff";
  const now = new Date().toISOString();
  const { action, collectedBy, reason, ref: bref, from } = parsed.data;
  const ref = regsCol.doc(regId(blockId, date));
  const entry = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const doc: RegisterDoc = snap.exists
      ? (snap.data() as RegisterDoc)
      : { tenantId: auth.tenantId!, listingId: block.listingId, blockId, date, entries: {} };
    // A joint booking marked before siblings were split has one entry under the
    // bare booking ref, covering every child on it. Hand each child their own
    // copy the first time any of them is marked, so toggling one never flips
    // (or silently un-marks) the others.
    if (rows.length > 1 && doc.entries[bookingRef]) {
      const legacy = doc.entries[bookingRef];
      for (const r of rows) if (!doc.entries[r.key]) doc.entries[r.key] = { ...legacy };
      delete doc.entries[bookingRef];
    }
    const prev = doc.entries[bref];
    // Not expected (booking cancelled, or this child taken off it) — the ONLY
    // thing still allowed is signing out a child who is physically here (and
    // undoing a mis-tapped sign-out).
    if (!row.expected && !((action === "collect" || action === "uncollect") && prev?.status === "in")) {
      throw new NotExpected(!bookingExpectedOn(booking, date)
        ? `Booking is ${booking.status} — not expected on the register`
        : `${row.name} isn't booked for ${date}`);
    }
    // Already in the asked-for state → idempotent: nothing is rewritten, so the
    // first mark's time and marker stand.
    const cur = stateOf(prev);
    const already =
      action === "in" ? prev?.status === "in"
      : action === "absent" ? cur === "absent"
      : action === "collect" ? cur === "collected"
      : action === "uncollect" ? cur !== "collected"
      : cur === "none"; // reset
    if (already) return prev ?? null;
    // A real change, asked for from a screen that showed something else: a
    // colleague has marked this child since. Refuse rather than overwrite.
    if (from && from !== cur) throw new Changed(prev ?? null, cur, row.name);
    const keepCollect = { collectedAt: prev?.collectedAt ?? null, collectedBy: prev?.collectedBy ?? null };
    if (action === "reset") {
      delete doc.entries[bref];
    } else if (action === "in") {
      doc.entries[bref] = { status: "in", inAt: now, ...keepCollect, by, at: now };
    } else if (action === "absent") {
      doc.entries[bref] = { status: "absent", inAt: null, collectedAt: null, collectedBy: null, reason: reason ?? null, by, at: now };
    } else if (action === "collect") {
      // Collecting a child who was never signed in signs them in too.
      const base: Entry = prev?.status === "in" ? prev : { status: "in", inAt: now, collectedAt: null, collectedBy: null, by, at: now };
      doc.entries[bref] = { ...base, status: "in", collectedAt: now, collectedBy: collectedBy ?? null, by, at: now };
    } else if (action === "uncollect" && prev) {
      doc.entries[bref] = { ...prev, collectedAt: null, collectedBy: null, by, at: now };
    }
    doc.takenBy = { name: takenByName, at: now };
    tx.set(ref, doc);
    return doc.entries[bref] ?? null;
  }).catch((e: unknown) => {
    if (e instanceof NotExpected || e instanceof Changed) return e;
    throw e;
  });
  if (entry instanceof NotExpected) {
    res.status(409).json({ error: entry.message });
    return;
  }
  if (entry instanceof Changed) {
    const who = entry.current?.by ? ` by ${entry.current.by}` : "";
    const when = entry.current?.at ? ` at ${new Date(entry.current.at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" })}` : "";
    const what = { none: "cleared back to not arrived", in: "signed in", absent: "marked absent", collected: "collected" }[entry.state];
    res.status(409).json({
      error: `${entry.name} was ${what}${who}${when} on another device — the register has been refreshed. Tap again if you still want to change it.`,
      code: "register_changed",
      ref: bref,
      attendance: entry.current,
    });
    return;
  }

  res.json({ ref: bref, attendance: entry });
});

class NotExpected extends Error {}
class Changed extends Error {
  constructor(public current: Entry | null, public state: MarkState, public name: string) { super("register_changed"); }
}

// ── Notes, nappy changes, nudges — shared across every device on the register ──
const noteSchema = z.object({
  ref: z.string().min(1).max(120),
  op: z.enum(["save", "archive", "restore", "delete"]),
  text: z.string().trim().max(2_000).optional(),
  shareParent: z.boolean().optional(),
});
const nappySchema = z.object({ ref: z.string().min(1).max(120), at: z.string().max(40).optional() });
const nudgeSchema = z.object({ refs: z.array(z.string().min(1).max(120)).min(1).max(100), at: z.string().max(40).optional() });

/** Load the block for a register write, or answer the error. */
async function registerBlock(req: import("express").Request, res: import("express").Response) {
  const auth = req.auth!;
  if (!canMark(auth.role) || !auth.tenantId) { res.status(403).json({ error: "Requires a staff or operator account" }); return null; }
  const blockSnap = await db.collection("blocks").doc(String(req.params.blockId)).get();
  if (!blockSnap.exists || blockSnap.data()!.tenantId !== auth.tenantId) { res.status(404).json({ error: "Block not found" }); return null; }
  const block = blockSnap.data() as BlockDoc;
  if (!(await blockInMyFranchise(auth, block))) { res.status(404).json({ error: "Block not found" }); return null; }
  return block;
}

/** A franchise (or its staff) writes only to its OWN sessions — the register
 *  list was scoped, the writes weren't. */
async function blockInMyFranchise(auth: { role: string; tenantId: string | null; franchiseId: string | null; assignment?: { mode: string; ids: string[] } | null }, block: BlockDoc): Promise<boolean> {
  // Staff assigned to certain sites write only to those sites' sessions.
  const site = await staffSiteScope(auth);
  if (site && !site.listings.has(block.listingId)) return false;
  if (!auth.franchiseId || (auth.role !== "franchise" && auth.role !== "staff")) return true;
  return (await franchiseListingIds(auth.tenantId!, auth.franchiseId)).has(block.listingId);
}
const emptyReg = (tenantId: string, block: BlockDoc, blockId: string, date: string): RegisterDoc => ({ tenantId, listingId: block.listingId, blockId, date, entries: {} });

// POST /api/registers/{blockId}/{date}/note — save / archive / restore / delete
// a child's note for the day. Deleting outright is for managers; staff archive.
registers.post("/:blockId/:date/note", async (req, res) => {
  const parsed = noteSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues }); return; }
  const block = await registerBlock(req, res);
  if (!block) return;
  const auth = req.auth!;
  const { blockId, date } = req.params;
  const { ref: key, op, text, shareParent } = parsed.data;
  if (op === "delete" && auth.role === "staff") { res.status(403).json({ error: "Staff can archive a note; deleting it for good is for a manager" }); return; }
  const by = req.user?.name ?? req.user?.email ?? "Staff";
  const now = new Date().toISOString();
  const ref = regsCol.doc(regId(blockId, date));
  const note = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const doc: RegisterDoc = snap.exists ? (snap.data() as RegisterDoc) : emptyReg(auth.tenantId!, block, blockId, date);
    const notes = { ...(doc.notes ?? {}) };
    const cur = notes[key];
    if (op === "save") {
      if (text) notes[key] = { text, at: now, by, byEmail: req.user?.email ?? undefined, archived: false, shareParent: !!shareParent };
      // Staff can't delete a note outright — a blank save archives it.
      else if (auth.role === "staff") { if (cur) notes[key] = { ...cur, archived: true }; }
      else delete notes[key];
    } else if (op === "archive" && cur) notes[key] = { ...cur, archived: true };
    else if (op === "restore" && cur) notes[key] = { ...cur, archived: false, at: now };
    else if (op === "delete") delete notes[key];
    tx.set(ref, { ...doc, notes });
    return notes[key] ?? null;
  });
  res.json({ ref: key, note });
});

// POST /api/registers/{blockId}/{date}/nappy — log a nappy change for a child.
registers.post("/:blockId/:date/nappy", async (req, res) => {
  const parsed = nappySchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues }); return; }
  const block = await registerBlock(req, res);
  if (!block) return;
  const auth = req.auth!;
  const { blockId, date } = req.params;
  const entry: NappyChange = { at: parsed.data.at ?? new Date().toISOString(), by: req.user?.name ?? req.user?.email ?? "Staff" };
  const ref = regsCol.doc(regId(blockId, date));
  const log = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const doc: RegisterDoc = snap.exists ? (snap.data() as RegisterDoc) : emptyReg(auth.tenantId!, block, blockId, date);
    const nappies = { ...(doc.nappies ?? {}) };
    nappies[parsed.data.ref] = [...(nappies[parsed.data.ref] ?? []), entry].slice(-40);
    tx.set(ref, { ...doc, nappies });
    return nappies[parsed.data.ref];
  });
  res.status(201).json({ ref: parsed.data.ref, log });
});

// POST /api/registers/{blockId}/{date}/nudge — record that these families were
// chased about a late pick-up, so the next person on the register doesn't
// chase them again.
registers.post("/:blockId/:date/nudge", async (req, res) => {
  const parsed = nudgeSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues }); return; }
  const block = await registerBlock(req, res);
  if (!block) return;
  const auth = req.auth!;
  const { blockId, date } = req.params;
  const at = parsed.data.at ?? new Date().toISOString();
  const ref = regsCol.doc(regId(blockId, date));
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const doc: RegisterDoc = snap.exists ? (snap.data() as RegisterDoc) : emptyReg(auth.tenantId!, block, blockId, date);
    const nudges = { ...(doc.nudges ?? {}) };
    for (const r of parsed.data.refs) nudges[r] = at;
    tx.set(ref, { ...doc, nudges });
  });
  res.json({ ok: true, at });
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
  if (!(await blockInMyFranchise(auth, block))) { res.status(404).json({ error: "Block not found" }); return; }
  // A head count far above everyone on the register is a typo (99 for 3), and
  // an emergency roll call must not be logged from one (acceptance d10s9).
  // Allows a margin for walk-ins not yet added.
  const roster = (await db.collection("bookings").where("blockId", "==", blockId).get()).docs
    .reduce((n, d) => n + registerRows(fromDoc(d.data() as BookingDoc), date).length, 0);
  if (parsed.data.n > roster + 10) { res.status(400).json({ error: `That's more children than are on this register (${roster}). Check the count and try again.`, code: "headcount_too_high" }); return; }
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
