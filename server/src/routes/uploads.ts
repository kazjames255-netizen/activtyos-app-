import { Router, json } from "express";
import { z } from "zod";
import { db } from "../firebase";
import { canWrite } from "../middleware/role";

// ─────────────────────────────────────────────────────────────────────────
// Image storage for listing/customer-page media.
//
// The builder produces canvas-compressed JPEG data URLs (~100–400KB). Those
// must NOT be stored inside listing docs (Firestore caps a document at 1MB),
// so the client uploads each image here first and stores the returned URL.
//
// Backing store: one Firestore doc per image, served by GET /api/images/:id
// with immutable cache headers. The project has no Firebase Storage bucket
// yet (Storage needs enabling in the console / Blaze plan) — when it gets
// one, only this file changes: same endpoints, same URLs, bytes move to the
// bucket. The GET is mounted BEFORE auth (image ids are unguessable and
// <img> tags can't send Authorization headers).
// ─────────────────────────────────────────────────────────────────────────

export const uploads = Router();
export const images = Router();

const col = db.collection("images");

const MAX_BYTES = 900_000; // stay under Firestore's 1MB doc limit

const uploadSchema = z.object({
  dataUrl: z
    .string()
    .regex(/^data:image\/(jpeg|png|webp|gif);base64,/, "Must be a base64 image data URL"),
});

// POST /api/uploads {dataUrl} → {id, url} (operators only)
uploads.post("/", json({ limit: "2mb" }), async (req, res) => {
  const auth = req.auth!;
  if (!canWrite(auth.role) || !auth.tenantId) {
    res.status(403).json({ error: "Requires an operator account with a tenant" });
    return;
  }
  const parsed = uploadSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues });
    return;
  }
  const [head, b64] = parsed.data.dataUrl.split(",", 2);
  const contentType = head.slice("data:".length, head.indexOf(";"));
  const bytes = Math.floor((b64.length * 3) / 4);
  if (bytes > MAX_BYTES) {
    res.status(413).json({ error: `Image too large (${Math.round(bytes / 1024)}KB — max ${MAX_BYTES / 1000}KB)` });
    return;
  }
  const ref = await col.add({
    tenantId: auth.tenantId,
    contentType,
    b64,
    createdAt: new Date().toISOString(),
  });
  res.status(201).json({ id: ref.id, url: `${req.protocol}://${req.get("host")}/api/images/${ref.id}` });
});

// GET /api/images/:id — public, immutable (an image doc is never edited).
images.get("/:id", async (req, res) => {
  const snap = await col.doc(req.params.id).get();
  if (!snap.exists) {
    res.status(404).json({ error: "Image not found" });
    return;
  }
  const { contentType, b64 } = snap.data() as { contentType: string; b64: string };
  res.setHeader("Content-Type", contentType);
  res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
  res.send(Buffer.from(b64, "base64"));
});
