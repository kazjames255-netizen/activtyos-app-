import { Router, json as jsonBody, type Request, type Response } from "express";
import { z } from "zod";
import { db } from "../firebase";
import { isFranchise } from "../lib/franchiseScope";
import { contentDisposition } from "../lib/contentDisposition";
import type { Role } from "../middleware/role";
import { notifyTenantMember } from "../lib/notify";

// Documents (Compliance) — the provider's document store: policies, risk
// assessments, insurance certificates. Operators upload & delete; staff read
// (they need the policies to hand). Files go through the existing /api/uploads
// store — this holds the metadata + the resulting url (or an external link).
export const documents = Router();
const col = db.collection("documents");
const canManage = (role: Role) => role === "company" || role === "freelancer" || role === "franchise";
const canRead = (role: Role) => role === "staff" || canManage(role);

const docSchema = z.object({
  title: z.string().trim().min(1).max(160),
  category: z.string().trim().min(1).max(60),
  url: z.string().trim().min(1).max(600),
  fileType: z.string().trim().max(40).optional(),
  notes: z.string().trim().max(1_000).optional(),
});

function readScope(req: Request, res: Response): string | null {
  const auth = req.auth!;
  if (auth.role === "platform") {
    const t = typeof req.query.tenantId === "string" ? req.query.tenantId : null;
    if (!t) { res.status(400).json({ error: "Platform: pass ?tenantId=" }); return null; }
    return t;
  }
  if (!canRead(auth.role) || !auth.tenantId) { res.status(403).json({ error: "Requires an operator or staff account" }); return null; }
  return auth.tenantId;
}

documents.get("/", async (req, res) => {
  const tenantId = readScope(req, res);
  if (!tenantId) return;
  const snap = await col.where("tenantId", "==", tenantId).get();
  let list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Record<string, unknown>) })) as (Record<string, unknown> & { createdAt?: string; franchiseId?: string | null })[];
  // A franchise (and its staff) sees only its own uploads — not head office's
  // or a sibling franchise's (acceptance test d22s4). Older uploads carry no
  // franchiseId: those are head office's.
  if (isFranchise(req.auth!)) list = list.filter((d) => (d.franchiseId ?? null) === req.auth!.franchiseId);
  list.sort((a, b) => (`${b.createdAt ?? ""}` < `${a.createdAt ?? ""}` ? -1 : 1));
  res.json(list);
});

documents.post("/", async (req, res) => {
  const auth = req.auth!;
  if (!canManage(auth.role) || !auth.tenantId) { res.status(403).json({ error: "Requires an operator account" }); return; }
  const parsed = docSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues }); return; }
  const doc = { ...parsed.data, tenantId: auth.tenantId, franchiseId: auth.franchiseId ?? null, uploadedBy: req.user?.email ?? "unknown", uploadedByName: req.user?.name ?? req.user?.email ?? "Operator", createdAt: new Date().toISOString() };
  const ref = await col.add(doc);
  res.status(201).json({ id: ref.id, ...doc });
});

documents.delete("/:id", async (req, res) => {
  const auth = req.auth!;
  if (!canManage(auth.role) || !auth.tenantId) { res.status(403).json({ error: "Requires an operator account" }); return; }
  const snap = await col.doc(req.params.id).get();
  if (!snap.exists || snap.data()!.tenantId !== auth.tenantId || (isFranchise(auth) && (snap.data()!.franchiseId ?? null) !== auth.franchiseId)) { res.status(404).json({ error: "Document not found" }); return; }
  await snap.ref.delete();
  res.json({ ok: true });
});

// ─────────────────────────────────────────────────────────────────────────
// The Documents LIBRARY (the screen's versioned policies, risk assessments,
// handbooks) and the read-and-confirm receipts — server-side since 12 Sept.
//
// Both lived in the browser: the library and, worse, the record of who had
// read which policy — the compliance evidence an inspector asks for — existed
// on one laptop and died with a cleared cache. And a confirmation wasn't tied
// to a version, so publishing v2 left everyone marked as having read it.
//
//   docLibraries/{key}   the library (metadata; files live in docFiles)
//   docReads/{id}        one per person per document: { version, at }
//   docFiles/{id}        a PDF/photo, chunked (Firestore's 1MB doc cap)
// Key: tenant, or tenant__fr__franchise for a franchise's own library.
// ─────────────────────────────────────────────────────────────────────────

const libKey = (req: Request) => (req.auth!.franchiseId && req.auth!.role !== "company" ? `${req.auth!.tenantId}__fr__${req.auth!.franchiseId}` : req.auth!.tenantId!);
const emailKey = (e: string) => e.trim().toLowerCase().replace(/[./]/g, ",");
const libCol = db.collection("docLibraries");
const readsCol = db.collection("docReads");
const filesCol = db.collection("docFiles");

const FILE_TYPES = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp", "image/gif", "image/heic", "image/heif"]);
const FILE_MAX = 15_000_000;
const CHUNK_MAX_B64 = 700_000;

/** Who a library document is for: everyone, their role/title, or a listing
 *  they're deployed to — the rule the chase and the staff screen both use. */
type LibDoc = { id: string; title: string; version: number; all?: boolean; roles?: string[]; titles?: string[]; listings?: string[] };
const roleIn = (list: string[] | undefined, v: string) => !!v && (list ?? []).some((r) => r.toLowerCase().includes(v.toLowerCase()) || v.toLowerCase().includes(r.toLowerCase().split(/[ /]/)[0]));
const docReaches = (d: LibDoc, t: { role: string; listings: string[] }) => !!d.all || roleIn(d.roles, t.role) || roleIn(d.titles, t.role) || (d.listings ?? []).some((l) => t.listings.includes(l));
/** Prefix on a head-office document shown to a franchise's staff. */
const HO_DOC = "ho:";

/** The team the library is read by: real staff accounts in scope, with the job
 *  title and listings they were invited to (for role/listing-scoped docs). */
async function teamFor(req: Request) {
  const auth = req.auth!;
  const [users, listings] = await Promise.all([
    db.collection("users").where("tenantId", "==", auth.tenantId).where("role", "==", "staff").get(),
    db.collection("listings").where("tenantId", "==", auth.tenantId).get(),
  ]);
  const titleOf = new Map(listings.docs.map((d) => [d.id, String(d.get("title") ?? d.get("name") ?? "")]));
  return users.docs
    .filter((u) => u.get("disabled") !== true)
    .filter((u) => auth.role === "company" || auth.role === "freelancer" || u.get("franchiseId") === auth.franchiseId)
    .map((u) => {
      const a = u.get("assignment") as { mode?: string; ids?: string[] } | undefined;
      return {
        name: String(u.get("name") ?? u.get("email") ?? ""),
        email: String(u.get("email") ?? "").toLowerCase(),
        role: String(u.get("jobTitle") ?? u.get("staffRole") ?? ""),
        listings: a?.mode === "listings" ? (a.ids ?? []).map((id) => titleOf.get(id) ?? "").filter(Boolean) : a?.mode === "all" ? [...titleOf.values()] : [],
      };
    });
}

// GET /api/documents/library → { docs, reads, team?, me? }
documents.get("/library", async (req, res) => {
  const auth = req.auth!;
  if (!auth.tenantId || !canRead(auth.role)) { res.status(403).json({ error: "Requires an operator or staff account" }); return; }
  const key = libKey(req);
  const [lib, reads] = await Promise.all([libCol.doc(key).get(), readsCol.where("libKey", "==", key).get()]);
  const all = reads.docs.map((d) => d.data() as { docId: string; version: number; staffEmail: string; staffName: string; at: string });
  const docsList = (lib.get("docs") as unknown[] | undefined) ?? null;
  if (canManage(auth.role)) {
    res.json({ docs: docsList, reads: all, team: await teamFor(req) });
    return;
  }
  const email = (req.user?.email ?? "").toLowerCase();
  const me = (await teamFor(req)).find((t) => t.email === email) ?? { name: req.user?.name ?? email, email, role: "", listings: [] };
  let docsOut = docsList;
  let readsOut = all.filter((r) => r.staffEmail === email);
  // A franchise's staff also get head office's documents that are assigned to
  // them — head office's chase already counts (and emails) them for those, but
  // their screen read only the franchise's own library (d17s4). Read-only here;
  // ids carry HO_DOC so the confirmation is recorded in head office's library,
  // where head office reads it.
  if (key !== auth.tenantId) {
    const [hoLib, hoReads] = await Promise.all([libCol.doc(auth.tenantId).get(), readsCol.where("libKey", "==", auth.tenantId).get()]);
    const hoDocs = ((hoLib.get("docs") as LibDoc[] | undefined) ?? []).filter((d) => docReaches(d, me));
    if (hoDocs.length) {
      docsOut = [...((docsList as LibDoc[] | null) ?? []), ...hoDocs.map((d) => ({ ...d, id: `${HO_DOC}${d.id}`, fromHo: true }))];
      const shown = new Set(hoDocs.map((d) => d.id));
      readsOut = [...readsOut, ...hoReads.docs.map((d) => d.data() as (typeof all)[number]).filter((r) => r.staffEmail === email && shown.has(r.docId)).map((r) => ({ ...r, docId: `${HO_DOC}${r.docId}` }))];
    }
  }
  res.json({ docs: docsOut, reads: readsOut, me });
});

// PUT /api/documents/library { docs } — managers save the library.
const libDocSchema = z.object({ id: z.string().max(80), title: z.string().max(200), version: z.number().int().min(1).max(10_000) }).passthrough();
documents.put("/library", async (req, res) => {
  const auth = req.auth!;
  if (!auth.tenantId || !canManage(auth.role)) { res.status(403).json({ error: "Requires an operator account" }); return; }
  const parsed = z.object({ docs: z.array(libDocSchema).max(500) }).safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues }); return; }
  // Files never ride in the library doc — they're in docFiles.
  const docsClean = parsed.data.docs.map((d) => {
    const { fileData: _f, ...rest } = d as Record<string, unknown>;
    const hist = Array.isArray(rest.history) ? (rest.history as Record<string, unknown>[]).map(({ fileData: _h, ...h }) => h) : rest.history;
    return { ...rest, history: hist };
  });
  const size = JSON.stringify(docsClean).length;
  if (size > 800_000) { res.status(413).json({ error: "The library is too large to save — trim long placeholder texts." }); return; }
  await libCol.doc(libKey(req)).set({ tenantId: auth.tenantId, docs: docsClean, updatedAt: new Date().toISOString(), updatedBy: req.user?.email ?? null });
  res.json({ ok: true });
});

// POST /api/documents/library/:docId/read { version, on } — I've read it (or untick).
documents.post("/library/:docId/read", async (req, res) => {
  const auth = req.auth!;
  if (!auth.tenantId || !canRead(auth.role)) { res.status(403).json({ error: "Forbidden" }); return; }
  const parsed = z.object({ version: z.number().int().min(1), on: z.boolean().default(true) }).safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues }); return; }
  const email = (req.user?.email ?? "").toLowerCase();
  if (!email) { res.status(400).json({ error: "Account has no email" }); return; }
  let key = libKey(req);
  let docId = req.params.docId;
  // A franchise's staff confirming one of head office's documents (see GET
  // /library): recorded in head office's library — only one that reaches them.
  const hoDoc = key !== auth.tenantId && docId.startsWith(HO_DOC);
  if (hoDoc) { key = auth.tenantId; docId = docId.slice(HO_DOC.length); }
  const lib = await libCol.doc(key).get();
  const doc = ((lib.get("docs") as LibDoc[] | undefined) ?? []).find((d) => d.id === docId);
  if (!doc) { res.status(404).json({ error: "Document not found" }); return; }
  if (hoDoc) {
    const me = (await teamFor(req)).find((t) => t.email === email);
    if (!me || !docReaches(doc, me)) { res.status(404).json({ error: "Document not found" }); return; }
  }
  // You confirm the CURRENT version — not whatever the screen had cached.
  if (parsed.data.version !== doc.version) { res.status(409).json({ error: `There's a newer version (v${doc.version}) — reopen it and confirm that one.` }); return; }
  const ref = readsCol.doc(`${key}__${docId}__${emailKey(email)}`);
  if (!parsed.data.on) { await ref.delete(); res.json({ ok: true }); return; }
  const at = new Date().toISOString();
  await ref.set({ tenantId: auth.tenantId, libKey: key, docId, version: doc.version, staffEmail: email, staffName: req.user?.name ?? email, at, ...(hoDoc ? { franchiseId: auth.franchiseId ?? null } : {}) });
  res.json({ ok: true, version: doc.version, at });
});

// POST /api/documents/library/chase { docIds? } — bell everyone with an unread
// (current-version) document assigned to them. The button said "Reminder sent"
// and sent nothing.
documents.post("/library/chase", async (req, res) => {
  const auth = req.auth!;
  if (!auth.tenantId || !canManage(auth.role)) { res.status(403).json({ error: "Requires an operator account" }); return; }
  const key = libKey(req);
  const [lib, reads, team] = await Promise.all([libCol.doc(key).get(), readsCol.where("libKey", "==", key).get(), teamFor(req)]);
  const docsList = ((lib.get("docs") as LibDoc[] | undefined) ?? []).filter((d) => !Array.isArray(req.body?.docIds) || (req.body.docIds as string[]).includes(d.id));
  const read = new Set(reads.docs.map((d) => `${d.get("docId")}|${d.get("version")}|${d.get("staffEmail")}`));
  let people = 0;
  // (Head office's team includes the franchises' staff — they see head
  // office's documents that reach them on their own Documents page.)
  for (const t of team) {
    if (!t.email) continue;
    const owed = docsList.filter((d) => docReaches(d, t) && !read.has(`${d.id}|${d.version}|${t.email}`));
    if (!owed.length) continue;
    people++;
    await notifyTenantMember(auth.tenantId, t.email, {
      category: "task",
      title: `${owed.length} document${owed.length === 1 ? "" : "s"} to read and confirm`,
      body: owed.slice(0, 4).map((d) => `${d.title} (v${d.version})`).join(", ") + (owed.length > 4 ? "…" : ""),
      href: "/staff/documents",
      sendEmail: true,
    }).catch(() => {});
  }
  res.json({ ok: true, people });
});

// ── Files ──────────────────────────────────────────────────────────────────
documents.post("/files", async (req, res) => {
  const auth = req.auth!;
  if (!auth.tenantId || !canManage(auth.role)) { res.status(403).json({ error: "Requires an operator account" }); return; }
  const parsed = z.object({
    name: z.string().trim().min(1).max(200),
    contentType: z.string().trim().toLowerCase().max(80).refine((t) => FILE_TYPES.has(t), "Upload a PDF or a photo"),
    bytes: z.number().int().positive().max(FILE_MAX),
    total: z.number().int().positive().max(40),
  }).safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues }); return; }
  const ref = await filesCol.add({ ...parsed.data, tenantId: auth.tenantId, franchiseId: auth.role === "franchise" ? auth.franchiseId : null, complete: false, createdAt: new Date().toISOString(), createdBy: req.user?.email ?? null });
  res.status(201).json({ id: ref.id });
});

async function ownFile(req: Request, id: string) {
  const snap = await filesCol.doc(id).get();
  if (!snap.exists || snap.get("tenantId") !== req.auth!.tenantId) return null;
  // A franchise (and its staff) reach only its own files and head office's
  // shared ones — never a sibling franchise's.
  const fid = req.auth!.role === "company" ? null : req.auth!.franchiseId;
  const fileFr = (snap.get("franchiseId") as string | null | undefined) ?? null;
  if (fid && fileFr && fileFr !== fid) return null;
  return snap;
}

documents.put("/files/:id/chunks/:index", jsonBody({ limit: "1mb" }), async (req, res) => {
  const auth = req.auth!;
  if (!auth.tenantId || !canManage(auth.role)) { res.status(403).json({ error: "Requires an operator account" }); return; }
  const snap = await ownFile(req, req.params.id);
  if (!snap || snap.get("complete") === true) { res.status(404).json({ error: "File not found" }); return; }
  const index = Number(req.params.index);
  if (!Number.isInteger(index) || index < 0 || index >= Number(snap.get("total"))) { res.status(400).json({ error: "Chunk index out of range" }); return; }
  const parsed = z.object({ b64: z.string().min(1).max(CHUNK_MAX_B64) }).safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues }); return; }
  await snap.ref.collection("chunks").doc(String(index)).set({ b64: parsed.data.b64 });
  res.json({ ok: true });
});

documents.post("/files/:id/done", async (req, res) => {
  const auth = req.auth!;
  if (!auth.tenantId || !canManage(auth.role)) { res.status(403).json({ error: "Requires an operator account" }); return; }
  const snap = await ownFile(req, req.params.id);
  if (!snap) { res.status(404).json({ error: "File not found" }); return; }
  const chunks = await snap.ref.collection("chunks").get();
  if (chunks.size !== Number(snap.get("total"))) { res.status(409).json({ error: `Upload incomplete — ${chunks.size} of ${snap.get("total")} parts arrived` }); return; }
  await snap.ref.update({ complete: true });
  res.json({ id: snap.id, name: snap.get("name") });
});

// GET /api/documents/files/:id — anyone on the team (staff read the policies).
documents.get("/files/:id", async (req, res) => {
  const auth = req.auth!;
  if (!auth.tenantId || !canRead(auth.role)) { res.status(403).json({ error: "Forbidden" }); return; }
  const snap = await ownFile(req, req.params.id);
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
