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

// ——— Authorised medications ———

// GET /api/medications?childId=&includeArchived=
medications.get("/", async (req, res) => {
  const auth = req.auth!;
  if (auth.role === "parent") {
    res.status(403).json({ error: "Requires an operator or staff account" });
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
    res.status(403).json({ error: "Requires an operator or staff account" });
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
