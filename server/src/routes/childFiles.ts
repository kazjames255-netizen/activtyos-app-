import { Router, json } from "express";
import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { db } from "../firebase";
import { contentDisposition } from "../lib/contentDisposition";
import { franchiseFamilyEmails, isFranchise } from "../lib/franchiseScope";

// ─────────────────────────────────────────────────────────────────────────
// Parent document storage — today, SEND/EHCP plans.
//
// The project has no Firebase Storage bucket (that needs the Blaze plan), and
// a Firestore document is capped at 1MB, so a multi-page EHCP scan cannot be
// stored the way listing images are. Here a file is split client-side into
// base64 chunks, each chunk stored as its own document under the file, and
// reassembled on read. That buys multi-megabyte uploads with no bucket.
//
// It is a workaround, not a destination: when Storage is enabled, only this
// file changes — same routes, same ids, bytes move to the bucket.
//
// Access is NOT like routes/uploads.ts. An image there is served publicly on
// an unguessable URL, which is fine for a listing photo. A child's EHCP is
// special-category personal data under UK GDPR, so reads here are
// authenticated and checked every time:
//   • the parent who uploaded it, always;
//   • an operator whose tenant the child has since been booked with, because
//     staff need to read the plan before day one. That grant is written by
//     the booking route (grantPlanAccess below), never by the client.
// ─────────────────────────────────────────────────────────────────────────

export const childFiles = Router();

const filesCol = db.collection("childFiles");

/** Firestore caps a document at 1MB; a chunk is base64, so keep well under. */
const CHUNK_MAX_B64 = 700_000;
/** A generous ceiling for a scanned EHCP, and a cap on how much one upload
 *  can cost us in writes. 30 chunks of 700KB of base64 ≈ 15MB of file. */
export const FILE_MAX_BYTES = 15_000_000;
const MAX_CHUNKS = 30;

/** What a plan/EHCP may be: a PDF or a photo of the paper. Anything else —
 *  HTML, SVG, a script — used to be accepted and served back inline, and the
 *  operator's viewer turned it into a same-origin blob in an iframe, so a file
 *  a parent uploaded could run in the provider's session. */
const PLAN_TYPES = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp", "image/gif", "image/heic", "image/heif"]);

const createSchema = z.object({
  name: z.string().trim().min(1).max(200),
  contentType: z.string().trim().toLowerCase().max(120).refine((t) => PLAN_TYPES.has(t), "Upload a PDF or a photo (JPG, PNG)"),
  bytes: z.number().int().positive().max(FILE_MAX_BYTES),
  total: z.number().int().positive().max(MAX_CHUNKS),
});

const chunkSchema = z.object({ b64: z.string().min(1).max(CHUNK_MAX_B64) });

type FileDoc = {
  ownerUid: string;
  name: string;
  contentType: string;
  bytes: number;
  total: number;
  complete: boolean;
  /** Tenants allowed to read it, granted by a booking — never by the client. */
  tenantIds: string[];
  createdAt: string;
};

// POST /api/my/files — reserve a file, before any bytes are sent.
childFiles.post("/", async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues });
    return;
  }
  const doc: FileDoc = {
    ...parsed.data,
    ownerUid: req.user!.uid,
    complete: false,
    tenantIds: [],
    createdAt: new Date().toISOString(),
  };
  const ref = await filesCol.add(doc);
  res.status(201).json({ id: ref.id });
});

/** Own the file, or nothing happens to it. */
async function ownedFile(id: string, uid: string) {
  const snap = await filesCol.doc(id).get();
  if (!snap.exists) return null;
  const data = snap.data() as FileDoc;
  return data.ownerUid === uid ? { snap, data } : null;
}

// PUT /api/my/files/:id/chunks/:index — one chunk of base64.
childFiles.put("/:id/chunks/:index", json({ limit: "1mb" }), async (req, res) => {
  const found = await ownedFile(req.params.id, req.user!.uid);
  if (!found) {
    res.status(404).json({ error: "File not found" });
    return;
  }
  const index = Number(req.params.index);
  if (!Number.isInteger(index) || index < 0 || index >= found.data.total) {
    res.status(400).json({ error: "Chunk index out of range" });
    return;
  }
  const parsed = chunkSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues });
    return;
  }
  await found.snap.ref.collection("chunks").doc(String(index)).set({ b64: parsed.data.b64 });
  res.json({ ok: true });
});

// POST /api/my/files/:id/done — every chunk landed, so the file can be read.
childFiles.post("/:id/done", async (req, res) => {
  const found = await ownedFile(req.params.id, req.user!.uid);
  if (!found) {
    res.status(404).json({ error: "File not found" });
    return;
  }
  // Count what actually arrived rather than trusting the client's word for it:
  // a half-uploaded plan that reads as complete is a file staff can't open.
  const chunks = await found.snap.ref.collection("chunks").get();
  if (chunks.size !== found.data.total) {
    res.status(409).json({ error: `Upload incomplete — ${chunks.size} of ${found.data.total} parts arrived` });
    return;
  }
  await found.snap.ref.update({ complete: true });
  res.json({ id: found.snap.id, name: found.data.name, bytes: found.data.bytes });
});

// GET /api/my/files/:id — the file itself, for whoever is allowed it.
childFiles.get("/:id", async (req, res) => {
  const snap = await filesCol.doc(req.params.id).get();
  if (!snap.exists) {
    res.status(404).json({ error: "File not found" });
    return;
  }
  const data = snap.data() as FileDoc;
  const mine = data.ownerUid === req.user!.uid;
  const tenant = req.auth?.tenantId;
  let staff = !!tenant && (data.tenantIds ?? []).includes(tenant);
  // The grant is per tenant, and a franchise shares its head office's tenant —
  // so a franchise (and its staff) also needs the family to be booked with IT,
  // not a sibling franchise (acceptance test d22s6).
  if (staff && !mine && req.auth && isFranchise(req.auth)) {
    const owner = String((await db.collection("users").doc(data.ownerUid).get()).get("email") ?? "").toLowerCase();
    staff = !!owner && (await franchiseFamilyEmails(tenant!, req.auth.franchiseId)).has(owner);
  }
  if (!mine && !staff) {
    // 404 rather than 403: whether a plan exists is itself worth not saying.
    res.status(404).json({ error: "File not found" });
    return;
  }
  if (!data.complete) {
    res.status(409).json({ error: "That upload didn't finish" });
    return;
  }
  const chunks = await snap.ref.collection("chunks").get();
  const parts: string[] = [];
  chunks.forEach((c) => {
    parts[Number(c.id)] = (c.data() as { b64: string }).b64;
  });
  if (parts.length !== data.total || parts.some((p) => p === undefined)) {
    res.status(409).json({ error: "That upload is missing parts" });
    return;
  }
  // A file stored before the type check (or with an odd type) is handed over
  // as a download, never rendered: only PDFs and photos show inline.
  const safe = PLAN_TYPES.has((data.contentType ?? "").toLowerCase());
  res.setHeader("Content-Type", safe ? data.contentType : "application/octet-stream");
  res.setHeader("Content-Disposition", contentDisposition(safe ? "inline" : "attachment", data.name));
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Content-Security-Policy", "sandbox");
  res.setHeader("Cache-Control", "private, no-store");
  res.send(Buffer.from(parts.join(""), "base64"));
});

/**
 * Reassemble a stored file server-side (same logic as the GET above, minus the
 * HTTP layer) so a route can attach it to an email. Returns null for a missing
 * or half-uploaded file so the caller can degrade quietly. Access control is
 * the CALLER's job — this trusts whoever asks, so only call it once the tenant
 * has been granted the plan (grantPlanAccess) for exactly the booking in hand.
 */
export async function readChildFile(
  id?: string | null,
): Promise<{ name: string; contentType: string; buffer: Buffer } | null> {
  if (!id) return null;
  try {
    const snap = await filesCol.doc(id).get();
    if (!snap.exists) return null;
    const data = snap.data() as FileDoc;
    if (!data.complete) return null;
    const chunks = await snap.ref.collection("chunks").get();
    const parts: string[] = [];
    chunks.forEach((c) => {
      parts[Number(c.id)] = (c.data() as { b64: string }).b64;
    });
    if (parts.length !== data.total || parts.some((p) => p === undefined)) return null;
    return {
      name: data.name,
      contentType: data.contentType || "application/octet-stream",
      buffer: Buffer.from(parts.join(""), "base64"),
    };
  } catch {
    return null;
  }
}

/**
 * Let a tenant's staff read the plans belonging to children on a booking they
 * now hold. Called from the booking route after the booking is written — the
 * client never gets to widen access to its own files.
 */
export async function grantPlanAccess(fileIds: string[], tenantId: string) {
  await Promise.all(
    [...new Set(fileIds.filter(Boolean))].map((id) =>
      filesCol
        .doc(id)
        .update({ tenantIds: FieldValue.arrayUnion(tenantId) })
        .catch(() => {}),
    ),
  );
}
