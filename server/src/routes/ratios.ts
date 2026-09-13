import { Router } from "express";
import { z } from "zod";
import { db } from "../firebase";
import { isPlainStaff, type Role } from "../middleware/role";
import type { BlockDoc } from "../lib/blockDomain";
import { fromDoc, type BookingDoc } from "../lib/bookingDoc";
import { entryFor, onSite, registerRows } from "../lib/registerRows";
import { franchiseListingIds } from "../lib/franchiseScope";
import { staffSiteScope, type SiteScope } from "../lib/siteScope";
import { DEFAULT_BANDS, bandFor, requiredStaff } from "../lib/ratios";
import { staffPolicy } from "../lib/staffPolicy";
import { ukToday } from "../lib/ukDate";

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
const todayIso = () => ukToday();

/** Whole years old on `date` (YYYY-MM-DD) for a YYYY-MM-DD date of birth. */
function ageOn(dob: string | undefined, date: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(dob ?? ""), d = /^(\d{4})-(\d{2})-(\d{2})/.exec(date);
  if (!m || !d) return null;
  let age = Number(d[1]) - Number(m[1]);
  if (d[2] + d[3] < m[2] + m[3]) age -= 1;
  return age >= 0 && age < 120 ? age : null;
}

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
  present?: boolean; // signed in today and not yet collected
  absent?: boolean;  // marked absent on today's register
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
  // A franchise sees only its OWN sessions — this board names every child and
  // flags their SEND and allergies, same as the register.
  const franchiseListings = req.auth!.franchiseId ? await franchiseListingIds(tenantId, req.auth!.franchiseId) : null;
  // Staff assigned to certain sites (a site lead) see only those sites' sessions.
  const site = await staffSiteScope(auth);
  const todays = blocksSnap.docs
    .map((d) => ({ id: d.id, block: d.data() as BlockDoc }))
    .filter(({ block }) => !franchiseListings || franchiseListings.has(block.listingId))
    .filter(({ block }) => !site || site.listings.has(block.listingId))
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
    for (const d of snap.docs)
      for (const r of registerRows(fromDoc(d.data() as BookingDoc), date)) if (r.childId) childIds.add(r.childId);
  const childDocs = childIds.size
    ? await db.getAll(...[...childIds].map((cid) => db.collection("children").doc(cid)))
    : [];
  const flagsById = new Map(
    childDocs.filter((d) => d.exists).map((d) => {
      const c = d.data() as Record<string, unknown>;
      return [d.id, { send: !!(c.send || c.sendPlanId), allergies: !!c.allergies, dob: typeof c.dob === "string" ? c.dob : "" }];
    }),
  );

  // The day's register marks — for children still on site after a cancellation.
  const regDocs = await db.getAll(...todays.map(({ id }) => db.collection("registers").doc(`${id}_${date}`)));
  const regEntries = regDocs.map((r) => ((r.exists ? r.get("entries") : null) ?? {}) as Record<string, { status?: string; collectedAt?: string | null }>);
  const sessions = todays.map(({ id, block, session }, i) => {
    // One row per CHILD: siblings on one booking are two heads against the
    // ratio, not one (lib/registerRows.ts).
    const children: SessionChild[] = bookingSnaps[i].docs
      .flatMap((d) => registerRows(fromDoc(d.data() as BookingDoc), date))
      // Expected, OR still physically here: signed in and not collected (a
      // booking cancelled while they're on site). A ratio counts every child
      // present, and the kitchen needs their allergies either way.
      .filter((r) => r.expected || onSite(regEntries[i], r))
      .map((r) => {
        const f = r.childId ? flagsById.get(r.childId) : undefined;
        const e = entryFor(regEntries[i], r);
        return {
          // Today's register: "in" (and not collected) = here now; "absent" = not coming.
          present: e?.status === "in" && !e.collectedAt,
          absent: e?.status === "absent",
          ref: r.key,
          childId: r.childId ?? null,
          name: r.name,
          // Age ON THE SESSION DATE from the child's date of birth — the age
          // stamped at checkout goes stale over a birthday (acceptance d11s5).
          age: ageOn(f?.dob, date) ?? r.age ?? 0,
          send: f?.send ?? false,
          allergies: f?.allergies ?? false,
        };
      })
      .sort((a, b) => (a.name < b.name ? -1 : 1));

    const doc = groupSnaps[i].exists ? (groupSnaps[i].data() as RatioDoc) : null;
    const groups: Group[] = doc?.groups ?? [];
    const assignedStaff = new Set(groups.flatMap((g) => g.staffIds));
    const assignedChildIds = new Set(groups.flatMap((g) => g.childIds));

    // Staff needed for who's actually here once the register has started (and
    // never for children marked absent); before anyone's signed in, it plans
    // off the booking list. It used to stay on the booking list all day, so
    // sign-ins and absences never changed it (acceptance d11s1).
    const started = children.some((c) => c.present);
    const counted = started ? children.filter((c) => c.present) : children.filter((c) => !c.absent);
    const required = requiredStaff(counted.map((c) => c.age));
    const perGroup = groups.map((g) => {
      const kids = children.filter((c) => g.childIds.includes(c.ref) || (c.childId && g.childIds.includes(c.childId)));
      const req = requiredStaff((started ? kids.filter((c) => c.present) : kids.filter((c) => !c.absent)).map((c) => c.age));
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
      // What the staffing figure is based on right now.
      countedChildren: counted.length,
      basis: started ? "signed-in" : "booked",
      presentNow: children.filter((c) => c.present).length,
      sendCount: children.filter((c) => c.send).length,
      requiredStaff: required,
      staffAssigned: assignedStaff.size,
      met: assignedStaff.size >= required,
    };
  });
  sessions.sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : a.blockName < b.blockName ? -1 : 1));
  // The board's children-per-adult target seeds from Settings → Staff &
  // workforce (the front-end may still override per day).
  const { defaultRatioTarget } = await staffPolicy(tenantId!, req.auth!.franchiseId);
  res.json({ date, bands: DEFAULT_BANDS, target: defaultRatioTarget, sessions });
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

/** The board keys (child id, else the row key — see RatiosApp's CoverBoard) of
 *  the children booked at a site-scoped member of staff's sites that day. The
 *  board is one per tenant per day, so their view and their saves are held to
 *  these; other sites' child → group moves are neither shown nor touched. */
async function siteBoardKeys(date: string, site: SiteScope): Promise<Set<string>> {
  const snaps = await Promise.all([...site.blocks].map((b) => db.collection("bookings").where("blockId", "==", b).get()));
  const keys = new Set<string>();
  for (const s of snaps)
    for (const d of s.docs)
      for (const r of registerRows(fromDoc(d.data() as BookingDoc), date)) { keys.add(r.key); if (r.childId) keys.add(r.childId); }
  return keys;
}
const pick = (o: Record<string, string>, keep: (k: string) => boolean) => Object.fromEntries(Object.entries(o).filter(([k]) => keep(k)));

ratios.get("/board/:date", async (req, res) => {
  const auth = req.auth!;
  if (!auth.tenantId || !boardCanUse(auth.role)) {
    res.status(403).json({ error: "Requires an operator or staff account" });
    return;
  }
  if (!validDate(req.params.date)) { res.status(400).json({ error: "Bad date" }); return; }
  const snap = await db.collection("ratioBoards").doc(boardId(auth.tenantId, req.params.date)).get();
  const d = snap.data() ?? {};
  const site = await staffSiteScope(auth);
  const mine = site ? await siteBoardKeys(req.params.date, site) : null;
  const overrides = (d.overrides ?? {}) as Record<string, string>;
  res.json({ overrides: mine ? pick(overrides, (k) => mine.has(k)) : overrides, groupStaff: d.groupStaff ?? {} });
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
  // Settings → Staff & workforce "assignByLeads": staff can still run the day
  // (child → group moves), but changing WHO COVERS a group is management's.
  if (isPlainStaff(auth) && (await staffPolicy(auth.tenantId, auth.franchiseId)).assignByLeads) {
    const existing = (await db.collection("ratioBoards").doc(boardId(auth.tenantId, req.params.date)).get()).data();
    if (JSON.stringify(parsed.data.groupStaff) !== JSON.stringify(existing?.groupStaff ?? {})) {
      res.status(403).json({ error: "Assigning staff to groups is limited to leads/managers (Settings → Staff & workforce)" });
      return;
    }
  }
  // A site-scoped member of staff moves only their own sites' children; every
  // other site's moves on the shared board are kept as they were.
  let overrides = parsed.data.overrides;
  const site = await staffSiteScope(auth);
  if (site) {
    const mine = await siteBoardKeys(req.params.date, site);
    const existing = ((await db.collection("ratioBoards").doc(boardId(auth.tenantId, req.params.date)).get()).get("overrides") ?? {}) as Record<string, string>;
    overrides = { ...pick(existing, (k) => !mine.has(k)), ...pick(overrides, (k) => mine.has(k)) };
  }
  await db.collection("ratioBoards").doc(boardId(auth.tenantId, req.params.date)).set({
    tenantId: auth.tenantId,
    date: req.params.date,
    overrides,
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
