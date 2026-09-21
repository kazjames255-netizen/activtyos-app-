import { Router, json } from "express";
import { z } from "zod";
import { db } from "../firebase";
import { canWrite } from "../middleware/role";
import { signImageUrl, verifyImage } from "../lib/signing";

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

const MAX_BYTES = 750_000; // base64 is 4/3 the size: 750KB → 1.0M chars, under Firestore's 1MiB doc limit (900KB overflowed it → a 500)
// A PDF can't be canvas-compressed like a photo, so it's capped on the stored
// base64 itself: 1,000,000 chars (~750KB of PDF) leaves headroom under the
// 1MiB doc cap for the other fields. Plenty for an e-receipt or supplier bill.
const MAX_PDF_B64 = 1_000_000;

// Magic-byte sniffing for the four image mimes the schema accepts. Without
// this, the declared Content-Type on the data URL was trusted outright — an
// SVG (or anything else) could be labelled "image/png" and stored/served as
// one. GET /api/images/:id already sends X-Content-Type-Options: nosniff so a
// browser won't re-interpret it, but the file is still wrongly accepted and
// served under an image content type. Checked on the first few decoded bytes
// only — cheap, and this is a security boundary, not a full validator.
const IMAGE_MAGIC: Record<string, (b: Buffer) => boolean> = {
  "image/png": (b) => b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 && b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a,
  "image/jpeg": (b) => b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  "image/gif": (b) => b.length >= 6 && (b.subarray(0, 6).toString("ascii") === "GIF87a" || b.subarray(0, 6).toString("ascii") === "GIF89a"),
  "image/webp": (b) => b.length >= 12 && b.subarray(0, 4).toString("ascii") === "RIFF" && b.subarray(8, 12).toString("ascii") === "WEBP",
};

const uploadSchema = z.object({
  dataUrl: z
    .string()
    .regex(/^data:(image\/(jpeg|png|webp|gif)|application\/pdf);base64,/, "Must be a base64 image (or PDF) data URL"),
  // "private" = a photo of a child, an injury photo, a receipt: served only on
  // a signed link that expires (lib/signing.ts). Anything else is public by
  // design — listing images, logos and campaign images are fetched by customer
  // pages and email clients that carry no credentials.
  purpose: z.enum(["public", "private"]).default("public"),
  // What the file is FOR. "hub" = a Learning Hub worksheet/resource: only files
  // tagged like this can be attached to a hub note, so a receipt or a child's
  // photo (also private uploads) can never be published to families through it.
  kind: z.enum(["hub"]).optional(),
});

// POST /api/uploads {dataUrl} → {id, url} (operators only)
uploads.post("/", json({ limit: "2mb" }), async (req, res) => {
  const auth = req.auth!;
  const parsed = uploadSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues });
    return;
  }
  // Staff post Moments and log accidents with a photo — they could never
  // upload one (403). They may upload PRIVATE images only; public media
  // (listings, logos, campaigns) stays with the provider.
  const staffPrivate = auth.role === "staff" && parsed.data.purpose === "private";
  if ((!canWrite(auth.role) && !staffPrivate) || !auth.tenantId) {
    res.status(403).json({ error: "Requires an operator account with a tenant" });
    return;
  }
  const [head, b64] = parsed.data.dataUrl.split(",", 2);
  const contentType = head.slice("data:".length, head.indexOf(";"));
  const bytes = Math.floor((b64.length * 3) / 4);
  // PDFs are receipts / supplier bills: private only (never a public listing
  // asset), and the bytes must really be a PDF ("%PDF-" = base64 "JVBERi0") so
  // an HTML page can't be smuggled in under a PDF label.
  if (contentType === "application/pdf") {
    if (parsed.data.purpose !== "private") {
      res.status(400).json({ error: "PDFs can only be uploaded as private files (receipts, bills)" });
      return;
    }
    if (!b64.startsWith("JVBERi0")) {
      res.status(400).json({ error: "That file isn't a valid PDF" });
      return;
    }
    if (b64.length > MAX_PDF_B64) {
      res.status(413).json({ error: `PDF too large (${Math.ceil(bytes / 1000)}KB — max ${Math.floor((MAX_PDF_B64 * 3) / 4 / 1000)}KB). Save a smaller PDF or upload a photo instead.` });
      return;
    }
  } else if (bytes > MAX_BYTES) {
    res.status(413).json({ error: `Image too large (${Math.round(bytes / 1024)}KB — max ${MAX_BYTES / 1000}KB)` });
    return;
  } else {
    const magic = IMAGE_MAGIC[contentType];
    // Decode just enough bytes to check the header, not the whole file.
    const head = Buffer.from(b64.slice(0, 32), "base64");
    if (!magic || !magic(head)) {
      res.status(400).json({ error: "That file's contents don't match its declared image type" });
      return;
    }
  }
  const isPrivate = parsed.data.purpose === "private";
  const ref = await col.add({
    tenantId: auth.tenantId,
    contentType,
    b64,
    ...(isPrivate ? { private: true } : {}),
    ...(parsed.data.kind ? { kind: parsed.data.kind } : {}),
    bytes,
    createdAt: new Date().toISOString(),
  });
  const url = `${req.protocol}://${req.get("host")}/api/images/${ref.id}`;
  // The caller stores the bare URL on its record; routes that return the
  // record re-sign it. The signed copy here is so it can be shown right away.
  res.status(201).json({ id: ref.id, url: isPrivate ? signImageUrl(url) : url });
});

// GET /api/images/:id — unauthenticated by necessity (<img> can't send an
// Authorization header), relying on the ~119-bit Firestore id being unguessable.
//
// `private`, NOT `public`. This same endpoint serves children's photos, register
// avatars and injury photos on accident records; `public` let any shared cache —
// a school or council proxy, a CDN — hold a photograph of a named child for a
// year. `private` keeps the browser cache (which is the whole point of the long
// max-age) while keeping those bytes out of infrastructure nobody here controls.
//
// A PRIVATE image (a child's photo, an injury photo, a receipt) needs a valid,
// unexpired signature — the bare id alone gets a 403. Routes that return those
// records re-sign the URL on the way out (signImageUrl), so screens keep
// working while a copied or forwarded link dies within hours. Public media
// (listings, logos, campaign images) is still served on the id alone.
//
// Images uploaded before 12 Sept carry no `private` flag and stay reachable by
// id until server/src/backfillPrivateImages.ts is run.
images.get("/:id", async (req, res) => {
  const snap = await col.doc(req.params.id).get();
  if (!snap.exists) {
    res.status(404).json({ error: "Image not found" });
    return;
  }
  const { contentType, b64, private: isPrivate } = snap.data() as { contentType: string; b64: string; private?: boolean };
  if (isPrivate && !verifyImage(req.params.id, req.query.exp, req.query.sig)) {
    res.status(403).json({ error: "This link has expired — reopen the page to get a fresh one." });
    return;
  }
  res.setHeader("Content-Type", contentType);
  res.setHeader("Cache-Control", isPrivate
    ? `private, max-age=${Math.max(0, Number(req.query.exp) - Math.floor(Date.now() / 1000))}`
    : "private, max-age=31536000, immutable");
  // Uploads are validated to an image mime (or a magic-checked PDF), but never
  // let a browser re-sniff a stored blob into something executable.
  res.setHeader("X-Content-Type-Options", "nosniff");
  // A PDF receipt opens in the browser's viewer with a sensible save-as name.
  // No CSP sandbox: sandboxed documents can block the built-in PDF viewer; the
  // upload-time %PDF- check + nosniff are the guard against a disguised page.
  if (contentType === "application/pdf") res.setHeader("Content-Disposition", 'inline; filename="receipt.pdf"');
  res.send(Buffer.from(b64, "base64"));
});
