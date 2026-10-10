import { Router, json as jsonBody, type Request } from "express";
import { z } from "zod";
import { db } from "../firebase";
import { contentDisposition } from "../lib/contentDisposition";
import type { Role } from "../middleware/role";
import { unresolvedReferenceConcern } from "../lib/staffPolicy";
// lib/fieldCrypto is shared with #39 (payroll's NI-number field) — reusing
// its AES-256-GCM primitives rather than building a second crypto helper.
// Its encryptField/decryptField return an opaque, unmarked base64url blob and
// decryptField throws on anything malformed, so this file wraps them with its
// own ENC_PREFIX envelope (below) to tell an encrypted value apart from a
// pre-existing plaintext one, and to decrypt without ever throwing.
import { isPayrollAdmin, nameIsUnique } from "./payroll";
import { auditPayroll } from "../lib/payrollAudit";
import { decryptField as rawDecrypt, encryptField as rawEncrypt } from "../lib/fieldCrypto";

// Staff onboarding / the Single Central Record, on the server.
//
// The safer-recruitment record — DBS, right to work, ID and address proof,
// references, the signed declarations — lived in one browser's localStorage,
// with the ID scans inline as data URLs. It was evidence an inspector asks
// for, held on one laptop and gone with a cleared cache; a member of staff
// completing their onboarding on their phone never reached the manager.
//
// Records: one doc per person in `onboardRecords` (keyed like the rota —
// tenant, or tenant__fr__franchise). Requirements config: `onboarding/{key}`.
// Scans: `onboardFiles` (chunked, like documents), readable ONLY by a manager
// of that tenant/franchise or the person the file belongs to — never by
// colleagues, unlike the documents library which every member of staff reads.
//
// Bank details / NI number: encrypted at rest (AES-256-GCM, lib/fieldCrypto)
// — see ENCRYPTED_VALUE_IDS below, encrypted on write, decrypted only when
// served to an authorised reader (manager or the person, same access rule as
// ever — encryption never changes WHO can see it). A retention period is
// enforced separately by lib/sweeps.ts (onboardingRetentionPurge) — see the
// policy comment there. Both were previously owed here
// (docs/amir-backend-outstanding.md #61).
//
// onboardFiles (the ID/DBS/address-proof scans) are NOT encrypted the same
// way: they're stored as base64 chunks under a Firestore doc (the
// Firestore-doc-as-storage pattern used until real object storage lands —
// backend handoff #2), and field-level AES-GCM on top of that isn't a good
// fit for binary blobs at this size (chunk-by-chunk re-encryption, key
// management per chunk, and it still wouldn't get you real object-storage
// properties like access-logged, expiring URLs). That's a real limitation,
// tracked against #2 — flagged here rather than worked around.

export const onboarding = Router();

const canManage = (role: Role) => role === "company" || role === "freelancer" || role === "franchise";
const keyOf = (tenantId: string, franchiseId: string | null) => (franchiseId ? `${tenantId}__fr__${franchiseId}` : tenantId);
const slug = (name: string) => name.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "").slice(0, 100) || "unnamed";
const recId = (key: string, staff: string) => `${key}_${slug(staff)}`.replace(/\//g, "_");
const FILE_TYPES = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp", "image/gif", "image/heic", "image/heif"]);
const FILE_MAX = 15_000_000;
const CHUNK_MAX_B64 = 700_000;
const filesCol = db.collection("onboardFiles");

// The field ids (features/team/OnboardingApp.tsx's default config) whose `.v`
// is financial or identity data sensitive enough to encrypt at rest: the bank
// details and pay rate marked `sensitive: true` in that config, plus the NI
// number (not UI-flagged there, but explicitly in scope per the handoff
// item). A tenant's own custom "extra" fields aren't covered — there's no
// reliable server-side signal for what an operator-defined field holds.
const ENCRYPTED_VALUE_IDS = new Set(["ni", "bankName", "bankHolder", "bankSort", "bankAccount", "payRate"]);

// This route's own marker in front of lib/fieldCrypto's opaque ciphertext, so
// a value can be told apart from legacy plaintext (records saved before this
// shipped) without guessing from its shape. `same as ever` for anything else.
const ENC_PREFIX = "enc:onboarding:v1:";
const isEncryptedValue = (v: unknown): v is string => typeof v === "string" && v.startsWith(ENC_PREFIX);
const encryptValue = (v: string): string => (v ? `${ENC_PREFIX}${rawEncrypt(v)}` : v);
/** Never throws: a value that isn't ours (legacy plaintext), or that fails to
 *  decrypt (wrong/rotated key, corruption), is handed back as-is rather than
 *  blowing up the whole read. */
function decryptValue(v: string): string {
  if (!isEncryptedValue(v)) return v;
  try { return rawDecrypt(v.slice(ENC_PREFIX.length)); }
  catch (e) { console.error("[onboarding] decrypt failed — returning ciphertext marker rather than throwing:", (e as Error).message); return v; }
}

/** Encrypt the `.v` of every sensitive field before it's written. */
function encryptSensitive(values: Record<string, Record<string, unknown>>): void {
  for (const id of ENCRYPTED_VALUE_IDS) {
    const v = values[id];
    if (!v || typeof v.v !== "string" || !v.v || isEncryptedValue(v.v)) continue;
    v.v = encryptValue(v.v);
  }
}

/** Decrypt the `.v` of every sensitive field on the way out, for a caller
 *  who's already been through the manager/own-record access check. Exported
 *  so routes/privacy.ts's self-service data export (the record's own person,
 *  same access rule) shows the real values rather than ciphertext. */
export function decryptSensitive<T extends { values?: Record<string, Record<string, unknown>> }>(rec: T): T {
  const values = rec.values;
  if (values) for (const id of ENCRYPTED_VALUE_IDS) {
    const v = values[id];
    if (v && typeof v.v === "string" && isEncryptedValue(v.v)) v.v = decryptValue(v.v);
  }
  return rec;
}

/** The signed-in person's name, which links them to their own record. Returns "" (so nothing matches) when another account in the same pay scope
 *  carries the same name: records are matched by name, so a duplicate would otherwise read the other person's bank details + NI number. */
export async function ownName(uid: string | undefined): Promise<string> {
  if (!uid) return "";
  const u = await db.collection("users").doc(uid).get();
  const name = String(u.get("name") ?? "").trim();
  const tenantId = u.get("tenantId") as string | null | undefined;
  if (name && tenantId && !(await nameIsUnique(tenantId, (u.get("franchiseId") as string | null | undefined) ?? null, name.toLowerCase().replace(/\s+/g, "-")))) return "";
  return name;
}
const same = (a: string, b: string) => !!a && a.trim().toLowerCase() === b.trim().toLowerCase();

function scope(req: Request) {
  const auth = req.auth!;
  if (!auth.tenantId || !(canManage(auth.role) || auth.role === "staff")) return null;
  return { auth, tenantId: auth.tenantId, key: keyOf(auth.tenantId, auth.franchiseId), manager: canManage(auth.role) };
}

const valueSchema = z.object({
  v: z.string().max(20_000).optional(),
  fileId: z.string().max(60).optional(),
  fileName: z.string().max(200).optional(),
  status: z.enum(["todo", "requested", "received", "verified"]).optional(),
  at: z.string().max(40).optional(),
}).passthrough();
const recordSchema = z.object({
  values: z.record(z.string().max(80), valueSchema),
  extra: z.array(z.string().max(80)).max(200).default([]),
  // The member of staff's "I've finished" and what was still missing then.
  submittedAt: z.string().max(40).nullable().optional(),
  outstanding: z.array(z.string().max(80)).max(200).optional(),
  lastEditedAt: z.string().max(40).nullable().optional(),
});

// GET /api/onboarding — the requirements and the records. A member of staff
// gets only their own record.
onboarding.get("/", async (req, res) => {
  const s = scope(req);
  if (!s) { res.status(403).json({ error: "Forbidden" }); return; }
  const [cfg, recs] = await Promise.all([
    db.collection("onboarding").doc(s.key).get(),
    db.collection("onboardRecords").where("key", "==", s.key).get(),
  ]);
  let records = recs.docs.map((d) => ({ staff: String(d.get("staff")), values: (d.get("values") ?? {}) as Record<string, Record<string, unknown>>, extra: d.get("extra") ?? [], submittedAt: d.get("submittedAt") ?? undefined, outstanding: d.get("outstanding") ?? undefined, lastEditedAt: d.get("lastEditedAt") ?? undefined, updatedAt: d.get("updatedAt") ?? null }));
  if (!s.manager) {
    const me = await ownName(req.user?.uid);
    records = records.filter((r) => same(r.staff, me));
  }
  // Decrypt only what's actually about to be served to this authorised
  // caller (a manager sees everyone's, filtered above to just their own for
  // a member of staff) — never decrypt a record this request won't return.
  records = records.map(decryptSensitive);
  // Bank details / NI / pay rate follow the payroll-administrator rule: an owner-tier login that isn't one sees the record without them; every
  // reveal of them to a manager is audited.
  if (s.manager) {
    const admin = await isPayrollAdmin(req);
    let shown = 0;
    for (const r of records) for (const id of ENCRYPTED_VALUE_IDS) {
      const v = r.values?.[id];
      if (!v || typeof v.v !== "string" || !v.v) continue;
      if (admin) shown++; else r.values[id] = { ...v, v: "", redacted: true };
    }
    if (admin && shown) auditPayroll(req, s.key, "view-onboarding-sensitive", { records: records.length, fields: shown });
  }
  res.json({ fields: (cfg.get("fields") as unknown[] | undefined) ?? null, records });
});

// PUT /api/onboarding/fields — the requirements (managers).
onboarding.put("/fields", jsonBody({ limit: "1mb" }), async (req, res) => {
  const s = scope(req);
  if (!s || !s.manager) { res.status(403).json({ error: "Only a manager can change the onboarding requirements" }); return; }
  const parsed = z.object({ fields: z.array(z.object({ id: z.string().max(80) }).passthrough()).max(400) }).safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues }); return; }
  await db.collection("onboarding").doc(s.key).set({ tenantId: s.tenantId, franchiseId: s.auth.franchiseId ?? null, fields: parsed.data.fields, updatedAt: new Date().toISOString(), updatedBy: req.user?.email ?? null });
  res.json({ ok: true });
});

// PUT /api/onboarding/records/:staff — save a record. Managers save anyone's;
// staff only their own, and never the employer's verification (a check's
// status and date stay as the manager left them).
onboarding.put("/records/:staff", jsonBody({ limit: "1mb" }), async (req, res) => {
  const s = scope(req);
  if (!s) { res.status(403).json({ error: "Forbidden" }); return; }
  const staff = decodeURIComponent(String(req.params.staff)).trim().slice(0, 120);
  if (!staff) { res.status(400).json({ error: "Who is this record for?" }); return; }
  if (!s.manager && !same(staff, await ownName(req.user?.uid))) { res.status(403).json({ error: "You can only fill in your own onboarding." }); return; }
  const parsed = recordSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues }); return; }
  const ref = db.collection("onboardRecords").doc(recId(s.key, staff));
  const before = (await ref.get()).data();
  const values = parsed.data.values as Record<string, Record<string, unknown>>;
  if (!s.manager) {
    const prev = (before?.values ?? {}) as Record<string, Record<string, unknown>>;
    for (const [id, v] of Object.entries(values)) {
      const p = prev[id] ?? {};
      // A check the employer has moved on (requested/received/verified) keeps
      // its status and date; the person's own entries keep their timestamps.
      if (p.status !== undefined) { v.status = p.status; v.at = p.at; } else delete v.status;
    }
    // …and a value the manager verified can't be dropped by leaving it out.
    for (const [id, p] of Object.entries(prev)) if (!(id in values) && p.status) values[id] = p;
  }
  // "References satisfactory" can't be ticked while a reference's safeguarding
  // concern is unreviewed — the screen disabled the button, the API didn't.
  const refsNow = (values.refsCheck as { status?: string } | undefined)?.status;
  const refsBefore = ((before?.values ?? {}) as Record<string, { status?: string }>).refsCheck?.status;
  if (s.manager && refsNow === "verified" && refsBefore !== "verified" && (await unresolvedReferenceConcern(s.tenantId, staff))) {
    res.status(409).json({ error: "A reference for this person raised a safeguarding concern that hasn't been reviewed. Review it in Team → References first.", code: "reference_concern" });
    return;
  }
  // Only files that belong to this record may be referenced from it.
  for (const v of Object.values(values)) {
    delete v.fileData; // scans go through /files — never inline on the record
    if (typeof v.fileId !== "string") continue;
    const f = await filesCol.doc(v.fileId).get();
    if (!f.exists || f.get("key") !== s.key || !same(String(f.get("staff") ?? ""), staff)) { res.status(400).json({ error: "An attached file doesn't belong to this record — upload it again." }); return; }
  }
  const now = new Date().toISOString();
  const { submittedAt, outstanding, lastEditedAt } = parsed.data;
  if (s.manager && !(await isPayrollAdmin(req))) {
    // Not a payroll administrator: they never saw the sensitive values (GET redacts them), so what comes back is blank — keep what's stored.
    const prevV = (before?.values ?? {}) as Record<string, Record<string, unknown>>;
    for (const id of ENCRYPTED_VALUE_IDS) if (prevV[id]) values[id] = { ...prevV[id] };
  } else if (s.manager) {
    const prevV = (before?.values ?? {}) as Record<string, Record<string, unknown>>;
    const changed = [...ENCRYPTED_VALUE_IDS].filter((id) => values[id]?.v !== undefined && decryptValue(String(prevV[id]?.v ?? "")) !== String(values[id]?.v ?? ""));
    if (changed.length) auditPayroll(req, s.key, "edit-onboarding-sensitive", { staff, fields: changed });
  }
  encryptSensitive(values); // bank details / NI number, at rest — see ENCRYPTED_VALUE_IDS
  await ref.set({
    key: s.key, tenantId: s.tenantId, franchiseId: s.auth.franchiseId ?? null, staff: before?.staff ?? staff, values, extra: parsed.data.extra,
    submittedAt: submittedAt ?? before?.submittedAt ?? null, outstanding: outstanding ?? before?.outstanding ?? [], lastEditedAt: lastEditedAt ?? before?.lastEditedAt ?? null,
    updatedAt: now, updatedBy: req.user?.email ?? null,
  });
  res.json({ ok: true, updatedAt: now });
});

// ── Files: ID scans, DBS certificates, proof of address ────────────────────
onboarding.post("/files", async (req, res) => {
  const s = scope(req);
  if (!s) { res.status(403).json({ error: "Forbidden" }); return; }
  const parsed = z.object({
    staff: z.string().trim().min(1).max(120),
    name: z.string().trim().min(1).max(200),
    contentType: z.string().trim().toLowerCase().max(80).refine((t) => FILE_TYPES.has(t), "Upload a PDF or a photo"),
    bytes: z.number().int().positive().max(FILE_MAX),
    total: z.number().int().positive().max(40),
  }).safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues }); return; }
  if (!s.manager && !same(parsed.data.staff, await ownName(req.user?.uid))) { res.status(403).json({ error: "You can only upload to your own onboarding." }); return; }
  const ref = await filesCol.add({ ...parsed.data, key: s.key, tenantId: s.tenantId, franchiseId: s.auth.franchiseId ?? null, complete: false, createdAt: new Date().toISOString(), createdBy: req.user?.uid ?? null });
  res.status(201).json({ id: ref.id });
});

/** A file this caller may touch: same tenant/franchise, and a manager or the
 *  person it belongs to. */
async function ownFile(req: Request, id: string) {
  const s = scope(req);
  if (!s) return null;
  const snap = await filesCol.doc(String(id)).get();
  if (!snap.exists || snap.get("key") !== s.key) return null;
  if (!s.manager && !same(String(snap.get("staff") ?? ""), await ownName(req.user?.uid))) return null;
  return snap;
}

onboarding.put("/files/:id/chunks/:index", jsonBody({ limit: "1mb" }), async (req, res) => {
  const snap = await ownFile(req, String(req.params.id));
  if (!snap || snap.get("complete") === true) { res.status(404).json({ error: "File not found" }); return; }
  const index = Number(req.params.index);
  if (!Number.isInteger(index) || index < 0 || index >= Number(snap.get("total"))) { res.status(400).json({ error: "Chunk index out of range" }); return; }
  const parsed = z.object({ b64: z.string().min(1).max(CHUNK_MAX_B64) }).safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues }); return; }
  await snap.ref.collection("chunks").doc(String(index)).set({ b64: parsed.data.b64 });
  res.json({ ok: true });
});

onboarding.post("/files/:id/done", async (req, res) => {
  const snap = await ownFile(req, String(req.params.id));
  if (!snap) { res.status(404).json({ error: "File not found" }); return; }
  const chunks = await snap.ref.collection("chunks").get();
  if (chunks.size !== Number(snap.get("total"))) { res.status(409).json({ error: `Upload incomplete — ${chunks.size} of ${snap.get("total")} parts arrived` }); return; }
  await snap.ref.update({ complete: true });
  res.json({ id: snap.id, name: snap.get("name") });
});

onboarding.get("/files/:id", async (req, res) => {
  const snap = await ownFile(req, String(req.params.id));
  if (!snap || snap.get("complete") !== true) { res.status(404).json({ error: "File not found" }); return; }
  const chunks = await snap.ref.collection("chunks").get();
  const parts: string[] = [];
  chunks.forEach((c) => { parts[Number(c.id)] = String(c.get("b64")); });
  const type = String(snap.get("contentType"));
  res.setHeader("Content-Type", FILE_TYPES.has(type) ? type : "application/octet-stream");
  res.setHeader("Content-Disposition", contentDisposition("inline", String(snap.get("name") ?? "document")));
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Content-Security-Policy", "sandbox");
  res.setHeader("Cache-Control", "private, no-store");
  res.send(Buffer.from(parts.join(""), "base64"));
});
