import { Router, type Request } from "express";
import { z } from "zod";
import { db } from "../firebase";
import type { Role } from "../middleware/role";

// ─────────────────────────────────────────────────────────────────────────
// Incidents & Accidents (Pupils) — the safeguarding log every OFSTED-
// registered provider must keep. One collection, `kind` discriminates:
//   accident — a child got hurt (body part, injury, treatment, first aider)
//   incident — anything else recorded (behaviour, near-miss, safeguarding
//              concern) with the action taken.
//
// Staff record these on the ground (it's their job, like registers), so
// staff can read and create; only operators edit or delete — a safeguarding
// record shouldn't be quietly changed or removed by whoever's on shift.
// Tenant-scoped; not parent-facing (parents are informed out of band, and
// the record tracks that they were).
// ─────────────────────────────────────────────────────────────────────────

export const incidents = Router();

const col = db.collection("incidents");

const canRecord = (role: Role) =>
  role === "staff" || role === "company" || role === "freelancer" || role === "franchise";
const canManage = (role: Role) => role === "company" || role === "freelancer" || role === "franchise";

const logSchema = z.object({
  kind: z.enum(["accident", "incident"]),
  date: z.string().max(10), // ISO date of the event
  time: z.string().max(8).optional(), // "14:30"
  childId: z.string().max(60).optional(),
  childName: z.string().trim().min(1).max(80),
  blockId: z.string().max(60).optional(),
  listingId: z.string().max(60).optional(),
  sessionLabel: z.string().max(160).optional(),
  location: z.string().trim().max(160).optional(),
  description: z.string().trim().min(1).max(4_000), // what happened
  // accident-specific
  bodyPart: z.string().trim().max(120).optional(),
  injury: z.string().trim().max(300).optional(),
  treatment: z.string().trim().max(1_000).optional(),
  firstAider: z.string().trim().max(120).optional(),
  // incident-specific
  incidentType: z.string().trim().max(120).optional(),
  actionTaken: z.string().trim().max(2_000).optional(),
  witnesses: z.string().trim().max(300).optional(),
  severity: z.enum(["minor", "moderate", "serious"]).default("minor"),
  parentNotified: z.boolean().default(false),
  parentNotifiedAt: z.string().max(25).optional(),
  parentNotifiedHow: z.string().max(60).optional(),
  photoUrl: z.string().max(500).optional(),
  followUp: z.string().trim().max(2_000).optional(),
});

function tenantScope(req: Request): { role: Role; tenantId: string | null } | null {
  const auth = req.auth!;
  return auth.tenantId || auth.role === "platform" ? { role: auth.role, tenantId: auth.tenantId } : null;
}

// GET /api/incidents?kind=&childId=&from=&to= — the tenant's log, newest
// first. Staff and operators read; platform passes ?tenantId=.
incidents.get("/", async (req, res) => {
  const auth = req.auth!;
  if (auth.role === "parent") {
    // A parent reads their OWN children's records (accidents/incidents),
    // across every provider — scoped by the child's parentUid.
    const kids = await db.collection("children").where("parentUid", "==", req.user!.uid).get();
    const ids = kids.docs.map((d) => d.id).slice(0, 10);
    if (!ids.length) { res.json([]); return; }
    const snap = await col.where("childId", "in", ids).get();
    let list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Record<string, unknown>) })) as (Record<string, unknown> & { id: string; kind?: string; date?: string; time?: string })[];
    if (req.query.kind === "accident" || req.query.kind === "incident") list = list.filter((x) => x.kind === req.query.kind);
    list.sort((a, b) => (`${b.date} ${b.time ?? ""}` < `${a.date} ${a.time ?? ""}` ? -1 : 1));
    res.json(list);
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
  let q = col.where("tenantId", "==", tenantId) as FirebaseFirestore.Query;
  if (req.query.kind === "accident" || req.query.kind === "incident") q = q.where("kind", "==", req.query.kind);
  if (typeof req.query.childId === "string") q = q.where("childId", "==", req.query.childId);
  const snap = await q.get();
  let list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Record<string, unknown>) })) as (Record<string, unknown> & { id: string; date?: string; time?: string })[];
  const from = typeof req.query.from === "string" ? req.query.from : null;
  const to = typeof req.query.to === "string" ? req.query.to : null;
  if (from) list = list.filter((x) => String(x.date) >= from);
  if (to) list = list.filter((x) => String(x.date) <= to);
  list.sort((a, b) => (`${b.date} ${b.time ?? ""}` < `${a.date} ${a.time ?? ""}` ? -1 : 1));
  res.json(list);
});

// POST /api/incidents — log an accident or incident (staff + operators).
incidents.post("/", async (req, res) => {
  const scope = tenantScope(req);
  if (!scope || !scope.tenantId || !canRecord(scope.role)) {
    res.status(403).json({ error: "Requires an operator or staff account with a tenant" });
    return;
  }
  const parsed = logSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues });
    return;
  }
  const doc = {
    ...parsed.data,
    tenantId: scope.tenantId,
    recordedBy: req.user?.email ?? req.user?.uid ?? "unknown",
    recordedByName: req.user?.name ?? req.user?.email ?? "Staff",
    createdAt: new Date().toISOString(),
  };
  const ref = await col.add(doc);
  res.status(201).json({ id: ref.id, ...doc });
});

async function ownLog(req: Request, id: string) {
  const auth = req.auth!;
  if (!auth.tenantId) return { status: 403 as const };
  const snap = await col.doc(id).get();
  if (!snap.exists || snap.data()!.tenantId !== auth.tenantId) return { status: 404 as const };
  return { status: 200 as const, snap };
}

// PUT /api/incidents/:id — edit (operators, or the staff member who recorded
// it — they may need to finish or correct their own entry).
incidents.put("/:id", async (req, res) => {
  const own = await ownLog(req, req.params.id);
  if (own.status !== 200) {
    res.status(own.status).json({ error: own.status === 403 ? "Requires an operator account" : "Log not found" });
    return;
  }
  const auth = req.auth!;
  const recorder = own.snap.data()!.recordedBy;
  if (!canManage(auth.role) && recorder !== (req.user?.email ?? req.user?.uid)) {
    res.status(403).json({ error: "Only the provider or the person who recorded it can edit this" });
    return;
  }
  const parsed = logSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues });
    return;
  }
  await own.snap.ref.set({ ...parsed.data, updatedAt: new Date().toISOString() }, { merge: true });
  const after = await own.snap.ref.get();
  res.json({ id: after.id, ...after.data() });
});

// DELETE /api/incidents/:id — operators only. A safeguarding record isn't
// something whoever's on shift should be able to remove.
incidents.delete("/:id", async (req, res) => {
  const own = await ownLog(req, req.params.id);
  if (own.status !== 200) {
    res.status(own.status).json({ error: own.status === 403 ? "Requires an operator account" : "Log not found" });
    return;
  }
  if (!canManage(req.auth!.role)) {
    res.status(403).json({ error: "Only the provider can delete a safeguarding record" });
    return;
  }
  await own.snap.ref.delete();
  res.json({ ok: true });
});
