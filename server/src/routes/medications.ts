import { Router, type Request } from "express";
import { z } from "zod";
import { db } from "../firebase";
import type { Role } from "../middleware/role";

// ─────────────────────────────────────────────────────────────────────────
// Medication (Pupils) — two records, because real practice is two things:
//
//   medications      — an AUTHORISED medicine for a child, with the parent's
//                      written consent. Nothing is given without one.
//   medicationAdmin  — the MAR: every dose actually given (what, when, how
//                      much, by whom, witnessed). The legal record.
//
// The consent gate is the whole point: you cannot log a dose against a
// medication that isn't authorised. Staff administer and record on the ground
// (their job); operators manage the authorisations. Tenant-scoped.
// ─────────────────────────────────────────────────────────────────────────

export const medications = Router();

const medsCol = db.collection("medications");
const adminCol = db.collection("medicationAdmin");

const canRecord = (role: Role) =>
  role === "staff" || role === "company" || role === "freelancer" || role === "franchise";
const canManage = (role: Role) => role === "company" || role === "freelancer" || role === "franchise";

const medSchema = z.object({
  childId: z.string().max(60).optional(),
  childName: z.string().trim().min(1).max(80),
  name: z.string().trim().min(1).max(120), // the medicine
  dose: z.string().trim().min(1).max(120), // "5ml", "one puff"
  route: z.string().trim().max(60).optional(), // oral / inhaler / cream …
  condition: z.string().trim().max(160).optional(), // "asthma"
  schedule: z.string().trim().max(200).optional(), // "twice daily", "as needed"
  asNeeded: z.boolean().default(false), // PRN
  storage: z.string().trim().max(200).optional(),
  heldOnSite: z.boolean().default(false),
  startDate: z.string().max(10).optional(),
  endDate: z.string().max(10).optional(),
  expiryDate: z.string().max(10).optional(),
  // Parental consent — the authorising artefact. No consent, no medicine.
  consentBy: z.string().trim().max(120).optional(),
  consentDate: z.string().max(25).optional(),
  consentGranted: z.boolean().default(false),
  notes: z.string().trim().max(1_000).optional(),
  archived: z.boolean().default(false),
});

const tenantOf = (req: Request) => {
  const auth = req.auth!;
  if (auth.role === "platform") return typeof req.query.tenantId === "string" ? req.query.tenantId : null;
  return auth.tenantId;
};

// A parent's own children (by uid) — the scope for everything a parent reads
// or authorises. Firestore `in` caps at 10, which is plenty for one family.
async function myChildIds(uid: string): Promise<string[]> {
  const snap = await db.collection("children").where("parentUid", "==", uid).get();
  return snap.docs.map((d) => d.id).slice(0, 10);
}
async function ownsChild(uid: string, childId: string): Promise<boolean> {
  const d = await db.collection("children").doc(childId).get();
  return d.exists && d.data()!.parentUid === uid;
}
async function hasBooking(tenantId: string, email: string): Promise<boolean> {
  const snap = await db.collection("bookings").where("tenantId", "==", tenantId).where("email", "==", email).limit(1).get();
  return !snap.empty;
}

// ——— Authorised medications ———

// GET /api/medications?childId=&includeArchived=
medications.get("/", async (req, res) => {
  const auth = req.auth!;
  if (auth.role === "parent") {
    // A parent sees their OWN children's medications, across every provider.
    const ids = await myChildIds(req.user!.uid);
    if (!ids.length) { res.json([]); return; }
    const snap = await medsCol.where("childId", "in", ids).get();
    let list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Record<string, unknown>) })) as (Record<string, unknown> & { id: string; archived?: boolean; childName?: string })[];
    if (req.query.includeArchived !== "1") list = list.filter((m) => !m.archived);
    list.sort((a, b) => (`${a.childName ?? ""}` < `${b.childName ?? ""}` ? -1 : 1));
    res.json(list);
    return;
  }
  const tenantId = tenantOf(req);
  if (!tenantId) {
    res.status(auth.role === "platform" ? 400 : 403).json({ error: "No tenant" });
    return;
  }
  let q = medsCol.where("tenantId", "==", tenantId) as FirebaseFirestore.Query;
  if (typeof req.query.childId === "string") q = q.where("childId", "==", req.query.childId);
  const snap = await q.get();
  let list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Record<string, unknown>) })) as (Record<string, unknown> & { id: string; archived?: boolean; name?: string })[];
  if (req.query.includeArchived !== "1") list = list.filter((m) => !m.archived);
  list.sort((a, b) => ((a.childName as string) < (b.childName as string) ? -1 : 1));
  res.json(list);
});

// POST /api/medications — authorise a medication (staff + operators).
medications.post("/", async (req, res) => {
  const auth = req.auth!;
  if (!auth.tenantId || !canRecord(auth.role)) {
    res.status(403).json({ error: "Requires an operator or staff account with a tenant" });
    return;
  }
  const parsed = medSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues });
    return;
  }
  const doc = {
    ...parsed.data,
    tenantId: auth.tenantId,
    recordedBy: req.user?.email ?? req.user?.uid ?? "unknown",
    recordedByName: req.user?.name ?? req.user?.email ?? "Staff",
    createdAt: new Date().toISOString(),
  };
  const ref = await medsCol.add(doc);
  res.status(201).json({ id: ref.id, ...doc });
});

async function ownMed(req: Request, id: string) {
  const auth = req.auth!;
  if (!auth.tenantId) return { status: 403 as const };
  const snap = await medsCol.doc(id).get();
  if (!snap.exists || snap.data()!.tenantId !== auth.tenantId) return { status: 404 as const };
  return { status: 200 as const, snap };
}

// PUT /api/medications/:id — edit (operator or recorder). Archiving is a PUT
// with {archived:true} — a medication with an administration history is never
// hard-deleted, because the MAR must survive.
medications.put("/:id", async (req, res) => {
  const own = await ownMed(req, req.params.id);
  if (own.status !== 200) {
    res.status(own.status).json({ error: own.status === 403 ? "Requires an operator account" : "Medication not found" });
    return;
  }
  const auth = req.auth!;
  if (!canManage(auth.role) && own.snap.data()!.recordedBy !== (req.user?.email ?? req.user?.uid)) {
    res.status(403).json({ error: "Only the provider or whoever recorded it can edit this" });
    return;
  }
  const parsed = medSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues });
    return;
  }
  await own.snap.ref.set({ ...parsed.data, updatedAt: new Date().toISOString() }, { merge: true });
  const after = await own.snap.ref.get();
  res.json({ id: after.id, ...after.data() });
});

// DELETE /api/medications/:id — operators only, and only when it has no
// administration history (otherwise archive, to keep the MAR intact).
medications.delete("/:id", async (req, res) => {
  const own = await ownMed(req, req.params.id);
  if (own.status !== 200) {
    res.status(own.status).json({ error: own.status === 403 ? "Requires an operator account" : "Medication not found" });
    return;
  }
  if (!canManage(req.auth!.role)) {
    res.status(403).json({ error: "Only the provider can remove a medication" });
    return;
  }
  const given = await adminCol.where("medicationId", "==", req.params.id).limit(1).get();
  if (!given.empty) {
    res.status(409).json({ error: "This medication has doses recorded — archive it instead so the record is kept" });
    return;
  }
  await own.snap.ref.delete();
  res.json({ ok: true });
});

// ——— Administration log (the MAR) ———

const administerSchema = z.object({
  date: z.string().max(10),
  time: z.string().max(8).optional(),
  doseGiven: z.string().trim().min(1).max(120),
  witnessedBy: z.string().trim().max(120).optional(),
  notes: z.string().trim().max(1_000).optional(), // reaction, refused, etc.
});

// POST /api/medications/:id/administer — log a dose given. Gated on an
// authorised, consented, unarchived medication — the safety rule.
medications.post("/:id/administer", async (req, res) => {
  const auth = req.auth!;
  if (!auth.tenantId || !canRecord(auth.role)) {
    res.status(403).json({ error: "Requires an operator or staff account with a tenant" });
    return;
  }
  const own = await ownMed(req, req.params.id);
  if (own.status !== 200) {
    res.status(own.status).json({ error: "Medication not found" });
    return;
  }
  const med = own.snap.data()!;
  if (!med.consentGranted) {
    res.status(409).json({ error: "No parental consent on file for this medication — can't record a dose." });
    return;
  }
  if (med.archived) {
    res.status(409).json({ error: "This medication is archived." });
    return;
  }
  const parsed = administerSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues });
    return;
  }
  const doc = {
    ...parsed.data,
    tenantId: auth.tenantId,
    medicationId: req.params.id,
    medName: med.name,
    childId: med.childId ?? null,
    childName: med.childName,
    administeredBy: req.user?.email ?? req.user?.uid ?? "unknown",
    administeredByName: req.user?.name ?? req.user?.email ?? "Staff",
    createdAt: new Date().toISOString(),
  };
  const ref = await adminCol.add(doc);
  res.status(201).json({ id: ref.id, ...doc });
});

// GET /api/medications/administrations?date=&childId=&medicationId= — the MAR.
medications.get("/administrations", async (req, res) => {
  const auth = req.auth!;
  if (auth.role === "parent") {
    // The parent's own children's dose history (the MAR they're entitled to).
    const ids = await myChildIds(req.user!.uid);
    if (!ids.length) { res.json([]); return; }
    const snap = await adminCol.where("childId", "in", ids).get();
    let list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Record<string, unknown>) })) as (Record<string, unknown> & { id: string; date?: string; time?: string; medicationId?: string })[];
    if (typeof req.query.medicationId === "string") list = list.filter((x) => x.medicationId === req.query.medicationId);
    list.sort((a, b) => (`${b.date} ${b.time ?? ""}` < `${a.date} ${a.time ?? ""}` ? -1 : 1));
    res.json(list);
    return;
  }
  const tenantId = tenantOf(req);
  if (!tenantId) {
    res.status(auth.role === "platform" ? 400 : 403).json({ error: "No tenant" });
    return;
  }
  let q = adminCol.where("tenantId", "==", tenantId) as FirebaseFirestore.Query;
  if (typeof req.query.medicationId === "string") q = q.where("medicationId", "==", req.query.medicationId);
  if (typeof req.query.childId === "string") q = q.where("childId", "==", req.query.childId);
  const snap = await q.get();
  let list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Record<string, unknown>) })) as (Record<string, unknown> & { id: string; date?: string; time?: string })[];
  if (typeof req.query.date === "string") list = list.filter((x) => x.date === req.query.date);
  list.sort((a, b) => (`${b.date} ${b.time ?? ""}` < `${a.date} ${a.time ?? ""}` ? -1 : 1));
  res.json(list);
});

// ——— Parent-authorised medications (digital consent) ———
//
// The consent gate is the whole point of this feature — and the most authentic
// consent is the parent's own. A parent authorises a medicine for THEIR child
// at a provider they've booked; the record lands consented, so staff can
// administer against it through the normal flow. The parent can withdraw it
// (archive) at any time. They never touch other families' data.

const authoriseSchema = z.object({
  tenantId: z.string().min(1).max(60),
  childId: z.string().min(1).max(60),
  childName: z.string().trim().min(1).max(80),
  name: z.string().trim().min(1).max(120),
  dose: z.string().trim().min(1).max(120),
  route: z.string().trim().max(60).optional(),
  condition: z.string().trim().max(160).optional(),
  schedule: z.string().trim().max(200).optional(),
  asNeeded: z.boolean().default(false),
  storage: z.string().trim().max(200).optional(),
  startDate: z.string().max(10).optional(),
  endDate: z.string().max(10).optional(),
  expiryDate: z.string().max(10).optional(),
  notes: z.string().trim().max(1_000).optional(),
});

// POST /api/medications/authorise — a parent authorises (consents to) a med.
medications.post("/authorise", async (req, res) => {
  const auth = req.auth!;
  if (auth.role !== "parent") { res.status(403).json({ error: "Only a parent can authorise their child's medication" }); return; }
  const parsed = authoriseSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues }); return; }
  const input = parsed.data;
  if (!(await ownsChild(req.user!.uid, input.childId))) { res.status(403).json({ error: "That child isn't on your account" }); return; }
  if (!(await hasBooking(input.tenantId, req.user!.email ?? ""))) { res.status(403).json({ error: "You can only authorise medication for a provider you've booked with" }); return; }
  const parentName = req.user?.name ?? req.user?.email ?? "Parent";
  const doc = {
    ...input,
    heldOnSite: false,
    archived: false,
    // The authorising artefact — granted by the parent, in their name, now.
    consentGranted: true,
    consentBy: parentName,
    consentDate: new Date().toISOString(),
    source: "parent" as const,
    recordedBy: req.user?.email ?? req.user?.uid ?? "parent",
    recordedByName: parentName,
    createdAt: new Date().toISOString(),
  };
  const ref = await medsCol.add(doc);
  res.status(201).json({ id: ref.id, ...doc });
});

// POST /api/medications/:id/withdraw — a parent withdraws consent (archives).
// The record is kept (dose history must survive); it just can't be given again.
medications.post("/:id/withdraw", async (req, res) => {
  const auth = req.auth!;
  if (auth.role !== "parent") { res.status(403).json({ error: "Only a parent can withdraw their consent" }); return; }
  const snap = await medsCol.doc(req.params.id).get();
  if (!snap.exists) { res.status(404).json({ error: "Medication not found" }); return; }
  const childId = snap.data()!.childId as string | undefined;
  if (!childId || !(await ownsChild(req.user!.uid, childId))) { res.status(404).json({ error: "Medication not found" }); return; }
  await snap.ref.set({ archived: true, consentGranted: false, consentWithdrawnAt: new Date().toISOString() }, { merge: true });
  res.json({ ok: true });
});
