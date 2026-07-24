import { Router } from "express";
import { z } from "zod";
import { db } from "../firebase";
import type { Role } from "../middleware/role";
import { countsTowardCapacity, type BlockDoc } from "../lib/blockDomain";
import { fromDoc, type BookingDoc } from "../lib/bookingDoc";
import { DEFAULT_BANDS, bandFor, requiredStaff } from "../lib/ratios";

// ─────────────────────────────────────────────────────────────────────────
// Ratios & groups — is a session safely staffed, and who's in which group?
//
// Children come from the day's bookings (the same source as registers), with
// ages and a SEND flag resolved from the child record (childId). Required
// staff is computed from the age mix; the operator assigns staff (from the
// tenant library) and, optionally, sorts children into named groups, each
// with its own ratio read. Groups + staffing live in one doc per session
// (`ratioGroups/{blockId}_{date}`). Operators write; staff read.
// ─────────────────────────────────────────────────────────────────────────

export const ratios = Router();

const canWriteRole = (role: Role) => role === "company" || role === "freelancer" || role === "franchise";
const groupId = (blockId: string, date: string) => `${blockId}_${date}`;
const todayIso = () => new Date().toISOString().slice(0, 10);

interface Group {
  id: string;
  name: string;
  childIds: string[];
  staffIds: string[];
}
interface RatioDoc {
  tenantId: string;
  blockId: string;
  date: string;
  groups: Group[];
}

interface SessionChild {
  ref: string;
  childId: string | null;
  name: string;
  age: number;
  send: boolean;
  allergies: boolean;
}

// GET /api/ratios?date= — every session the tenant runs that day, with its
// children, the required staff, the assigned staff and the group breakdown.
ratios.get("/", async (req, res) => {
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

  const blocksSnap = await db.collection("blocks").where("tenantId", "==", tenantId).get();
  const todays = blocksSnap.docs
    .map((d) => ({ id: d.id, block: d.data() as BlockDoc }))
    .map(({ id, block }) => ({ id, block, session: block.sessions.find((s) => s.date === date) }))
    .filter((x): x is typeof x & { session: NonNullable<(typeof x)["session"]> } => !!x.session);

  if (!todays.length) {
    res.json({ date, bands: DEFAULT_BANDS, sessions: [] });
    return;
  }

  const [bookingSnaps, groupSnaps, listingSnaps] = await Promise.all([
    Promise.all(todays.map(({ id }) => db.collection("bookings").where("blockId", "==", id).get())),
    db.getAll(...todays.map(({ id }) => db.collection("ratioGroups").doc(groupId(id, date)))),
    db.getAll(
      ...[...new Set(todays.map(({ block }) => block.listingId))].map((lid) => db.collection("listings").doc(lid)),
    ),
  ]);
  const listingName = new Map(
    listingSnaps.map((s) => [s.id, s.exists ? ((s.data()!.name as string) ?? "") : "(deleted listing)"]),
  );

  // Resolve SEND / allergies flags from child records (by id), one batch.
  const childIds = new Set<string>();
  for (const snap of bookingSnaps)
    for (const d of snap.docs) {
      const b = fromDoc(d.data() as BookingDoc);
      if (b.childId) childIds.add(b.childId);
    }
  const childDocs = childIds.size
    ? await db.getAll(...[...childIds].map((cid) => db.collection("children").doc(cid)))
    : [];
  const flagsById = new Map(
    childDocs.filter((d) => d.exists).map((d) => {
      const c = d.data() as Record<string, unknown>;
      return [d.id, { send: !!(c.send || c.sendPlanId), allergies: !!c.allergies }];
    }),
  );

  const sessions = todays.map(({ id, block, session }, i) => {
    const children: SessionChild[] = bookingSnaps[i].docs
      .map((d) => fromDoc(d.data() as BookingDoc))
      .filter((b) => countsTowardCapacity(b.status) && b.status !== "Offered" && (!b.days || b.days.includes(date)))
      .map((b) => {
        const f = b.childId ? flagsById.get(b.childId) : undefined;
        return {
          ref: b.ref,
          childId: b.childId ?? null,
          name: b.kids?.length ? b.kids[0].name : b.child,
          age: b.age ?? 0,
          send: f?.send ?? false,
          allergies: f?.allergies ?? false,
        };
      })
      .sort((a, b) => (a.name < b.name ? -1 : 1));

    const doc = groupSnaps[i].exists ? (groupSnaps[i].data() as RatioDoc) : null;
    const groups: Group[] = doc?.groups ?? [];
    const assignedStaff = new Set(groups.flatMap((g) => g.staffIds));
    const assignedChildIds = new Set(groups.flatMap((g) => g.childIds));

    const required = requiredStaff(children.map((c) => c.age));
    const perGroup = groups.map((g) => {
      const kids = children.filter((c) => g.childIds.includes(c.ref) || (c.childId && g.childIds.includes(c.childId)));
      const req = requiredStaff(kids.map((c) => c.age));
      return {
        id: g.id,
        name: g.name,
        childRefs: kids.map((c) => c.ref),
        staffIds: g.staffIds,
        required: req,
        staff: g.staffIds.length,
        met: g.staffIds.length >= req,
      };
    });

    return {
      blockId: id,
      date,
      start: session.start,
      end: session.end,
      blockName: block.name,
      listingId: block.listingId,
      listingName: listingName.get(block.listingId) ?? "",
      children,
      groups: perGroup,
      unassignedRefs: children.filter((c) => !assignedChildIds.has(c.ref) && !(c.childId && assignedChildIds.has(c.childId))).map((c) => c.ref),
      totalChildren: children.length,
      sendCount: children.filter((c) => c.send).length,
      requiredStaff: required,
      staffAssigned: assignedStaff.size,
      met: assignedStaff.size >= required,
    };
  });
  sessions.sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : a.blockName < b.blockName ? -1 : 1));
  res.json({ date, bands: DEFAULT_BANDS, sessions });
});

// ── The day BOARD (handoff §R): the operator's drag overrides (child →
// group) and which adults cover each group, per tenant per day — the state
// the Ratios cover board renders. Distinct from the per-session ratioGroups
// docs above: the board spans every session running that day. Staff can
// save too — they run the day.
const boardCanUse = (role: Role) => role === "staff" || canWriteRole(role);
const boardSchema = z.object({
  overrides: z.record(z.string().max(80), z.string().max(80)).default({}),
  groupStaff: z.record(z.string().max(80), z.array(z.string().max(80)).max(50)).default({}),
});
const boardId = (tenantId: string, date: string) => `${tenantId}_${date}`;
const validDate = (d: string) => /^\d{4}-\d{2}-\d{2}$/.test(d);

ratios.get("/board/:date", async (req, res) => {
  const auth = req.auth!;
  if (!auth.tenantId || !boardCanUse(auth.role)) {
    res.status(403).json({ error: "Requires an operator or staff account" });
    return;
  }
  if (!validDate(req.params.date)) { res.status(400).json({ error: "Bad date" }); return; }
  const snap = await db.collection("ratioBoards").doc(boardId(auth.tenantId, req.params.date)).get();
  const d = snap.data() ?? {};
  res.json({ overrides: d.overrides ?? {}, groupStaff: d.groupStaff ?? {} });
});

ratios.put("/board/:date", async (req, res) => {
  const auth = req.auth!;
  if (!auth.tenantId || !boardCanUse(auth.role)) {
    res.status(403).json({ error: "Requires an operator or staff account" });
    return;
  }
  if (!validDate(req.params.date)) { res.status(400).json({ error: "Bad date" }); return; }
  const parsed = boardSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues }); return; }
  await db.collection("ratioBoards").doc(boardId(auth.tenantId, req.params.date)).set({
    tenantId: auth.tenantId,
    date: req.params.date,
    overrides: parsed.data.overrides,
    groupStaff: parsed.data.groupStaff,
    updatedAt: new Date().toISOString(),
    updatedBy: req.user?.email ?? "unknown",
  });
  res.json({ ok: true });
});

const putSchema = z.object({
  groups: z
    .array(
      z.object({
        id: z.string().min(1).max(60),
        name: z.string().trim().max(60),
        childIds: z.array(z.string().max(60)).max(200),
        staffIds: z.array(z.string().max(60)).max(50),
      }),
    )
    .max(30),
});

// PUT /api/ratios/:blockId/:date — save the session's groups + staffing.
ratios.put("/:blockId/:date", async (req, res) => {
  const auth = req.auth!;
  if (!canWriteRole(auth.role) || !auth.tenantId) {
    res.status(403).json({ error: "Requires an operator account with a tenant" });
    return;
  }
  const parsed = putSchema.safeParse(req.body);
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
  if (!(blockSnap.data() as BlockDoc).sessions.some((s) => s.date === date)) {
    res.status(400).json({ error: `This block has no session on ${date}` });
    return;
  }
  const doc: RatioDoc = { tenantId: auth.tenantId, blockId, date, groups: parsed.data.groups };
  await db.collection("ratioGroups").doc(groupId(blockId, date)).set(doc);
  res.json({ ok: true });
});

export { bandFor }; // re-exported for tests
