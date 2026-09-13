import { Router, json as jsonBody, type Request } from "express";
import { z } from "zod";
import { db } from "../firebase";
import type { Role } from "../middleware/role";

// Staff certificates — Team → Staff certs, Setup → credential types, and the
// staff "My certificates" — on the server.
//
// They lived in one browser's localStorage, scans inline, and — the part that
// mattered — in a DIFFERENT store from the one the rota's safety check reads
// (`certifications`, via lib/staffPolicy.staffRosterBlock). A manager could
// record a DBS here and still be told "no DBS on file" when rostering, or
// record nothing here and pass. Now a certificate a manager saves (or
// verifies) is mirrored into `certifications`, so both agree.
//
// Scans use the private onboarding file store (routes/onboarding.ts /files):
// a manager or the person the file belongs to — never a colleague.

export const credentials = Router();

const canManage = (role: Role) => role === "company" || role === "freelancer" || role === "franchise";
const keyOf = (tenantId: string, franchiseId: string | null) => (franchiseId ? `${tenantId}__fr__${franchiseId}` : tenantId);
const same = (a: string, b: string) => !!a && a.trim().toLowerCase() === b.trim().toLowerCase();
const docId = (key: string, id: string) => `${key}_${id}`.replace(/\//g, "_");

async function ownName(uid: string | undefined): Promise<string> {
  if (!uid) return "";
  return String((await db.collection("users").doc(uid).get()).get("name") ?? "").trim();
}
function scope(req: Request) {
  const auth = req.auth!;
  if (!auth.tenantId || !(canManage(auth.role) || auth.role === "staff")) return null;
  return { auth, tenantId: auth.tenantId, key: keyOf(auth.tenantId, auth.franchiseId), manager: canManage(auth.role) };
}

const fileRef = z.object({ name: z.string().max(200), fileId: z.string().max(60), at: z.string().max(40).optional() });
const recordSchema = z.object({
  id: z.string().trim().min(1).max(80),
  staff: z.string().trim().min(1).max(120),
  typeId: z.string().trim().min(1).max(80),
  issue: z.string().max(10).optional(),
  expiry: z.string().max(10).optional(),
  issuer: z.string().max(160).optional(),
  number: z.string().max(80).optional(),
  fileId: z.string().max(60).optional(),
  fileName: z.string().max(200).optional(),
  files: z.array(fileRef).max(30).optional(),
  verified: z.enum(["pending", "verified", "rejected"]),
  note: z.string().max(1000).optional(),
  dbsLevel: z.string().max(40).optional(),
  dbsUpdate: z.boolean().optional(),
  dbsUpdateNo: z.string().max(80).optional(),
  updatedAt: z.string().max(40).optional(),
});
type Rec = z.infer<typeof recordSchema>;
type CredType = { id: string; name: string; renewMonths?: number; dbs?: boolean };

const strip = (d: FirebaseFirestore.DocumentData) => { const { key: _k, tenantId: _t, franchiseId: _f, savedBy: _s, ...r } = d; return r; };

async function typesFor(key: string): Promise<CredType[] | null> {
  return ((await db.collection("credentialTypes").doc(key).get()).get("types") as CredType[] | undefined) ?? null;
}

/** Keep the rota's compliance store in step with a manager-saved certificate. */
async function mirror(tenantId: string, key: string, rec: Rec, by: string | null) {
  const ref = db.collection("certifications").doc(`cred_${docId(key, rec.id)}`);
  if (rec.verified === "rejected") { await ref.delete().catch(() => {}); return; }
  const types = (await typesFor(key)) ?? [];
  const t = types.find((x) => x.id === rec.typeId);
  const typeName = t?.name || (rec.typeId === "dbs" ? "DBS" : rec.typeId === "pfa" ? "Paediatric First Aid" : rec.typeId);
  // No expiry entered: the type's renewal interval from the issue date; a DBS
  // with neither (the Update Service keeps it live) is treated as current.
  let expiry = rec.expiry || "";
  if (!expiry && rec.issue && t?.renewMonths) { const d = new Date(`${rec.issue}T00:00:00Z`); d.setUTCMonth(d.getUTCMonth() + t.renewMonths); expiry = d.toISOString().slice(0, 10); }
  if (!expiry) expiry = "9999-12-31";
  await ref.set({
    tenantId, franchiseKey: key, staffName: rec.staff, type: /dbs/i.test(typeName) || t?.dbs ? `DBS${/dbs/i.test(typeName) ? "" : ` (${typeName})`}` : typeName,
    reference: rec.number ?? null, issued: rec.issue ?? null, expiry, source: "staff-certs", credentialId: rec.id,
    createdBy: by ?? "unknown", createdAt: new Date().toISOString(),
  });
}

// GET /api/credentials — types + records (staff: their own records only).
credentials.get("/", async (req, res) => {
  const s = scope(req);
  if (!s) { res.status(403).json({ error: "Forbidden" }); return; }
  const [types, recs] = await Promise.all([typesFor(s.key), db.collection("credentialRecords").where("key", "==", s.key).get()]);
  let records = recs.docs.map((d) => strip(d.data()) as Rec);
  if (!s.manager) { const me = await ownName(req.user?.uid); records = records.filter((r) => same(r.staff, me)); }
  res.json({ types, records });
});

// PUT /api/credentials/types — Setup → credential types (managers).
credentials.put("/types", jsonBody({ limit: "1mb" }), async (req, res) => {
  const s = scope(req);
  if (!s || !s.manager) { res.status(403).json({ error: "Only a manager can change credential types" }); return; }
  const parsed = z.object({ types: z.array(z.object({ id: z.string().max(80), name: z.string().max(160) }).passthrough()).max(200) }).safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues }); return; }
  await db.collection("credentialTypes").doc(s.key).set({ tenantId: s.tenantId, franchiseId: s.auth.franchiseId ?? null, types: parsed.data.types, updatedAt: new Date().toISOString() });
  res.json({ ok: true });
});

// PUT /api/credentials/records/:id — save a certificate. Staff save their own
// (and only ever as "pending" — verifying is the employer's job); managers
// save anyone's, and what they save counts for the rota's safety check.
credentials.put("/records/:id", jsonBody({ limit: "1mb" }), async (req, res) => {
  const s = scope(req);
  if (!s) { res.status(403).json({ error: "Forbidden" }); return; }
  const parsed = recordSchema.safeParse({ ...req.body, id: String(req.params.id) });
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues }); return; }
  const rec = parsed.data;
  const ref = db.collection("credentialRecords").doc(docId(s.key, rec.id));
  const before = (await ref.get()).data() as Rec | undefined;
  if (!s.manager) {
    const me = await ownName(req.user?.uid);
    if (!same(rec.staff, me) || (before && !same(before.staff, me))) { res.status(403).json({ error: "You can only add your own certificates." }); return; }
    const filesChanged = JSON.stringify((before?.files ?? []).map((f) => f.fileId)) !== JSON.stringify((rec.files ?? []).map((f) => f.fileId)) || before?.fileId !== rec.fileId;
    rec.verified = before?.verified === "verified" && !filesChanged && rec.expiry === before.expiry ? "verified" : "pending";
  }
  for (const id of new Set([rec.fileId, ...(rec.files ?? []).map((f) => f.fileId)].filter(Boolean) as string[])) {
    const f = await db.collection("onboardFiles").doc(id).get();
    if (!f.exists || f.get("key") !== s.key || !same(String(f.get("staff") ?? ""), rec.staff)) { res.status(400).json({ error: "An attached file doesn't belong to this person — upload it again." }); return; }
  }
  const now = new Date().toISOString();
  await ref.set({ ...rec, updatedAt: now, key: s.key, tenantId: s.tenantId, franchiseId: s.auth.franchiseId ?? null, savedBy: req.user?.email ?? null });
  if (s.manager) await mirror(s.tenantId, s.key, rec, req.user?.email ?? null);
  res.json({ ...rec, updatedAt: now });
});

credentials.delete("/records/:id", async (req, res) => {
  const s = scope(req);
  if (!s || !s.manager) { res.status(403).json({ error: "Only a manager can delete a certificate" }); return; }
  const id = String(req.params.id);
  await db.collection("credentialRecords").doc(docId(s.key, id)).delete();
  await db.collection("certifications").doc(`cred_${docId(s.key, id)}`).delete().catch(() => {});
  res.json({ ok: true });
});
