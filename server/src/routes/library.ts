import { Router } from "express";
import { db } from "../firebase";
import { canWrite } from "../middleware/role";

// ─────────────────────────────────────────────────────────────────────────
// The tenant's shared listing library — the option lists reused across all
// of a tenant's listings (was `LocalState` in the browser): categories,
// venues, provided/safety/send/outcomes chips, add-ons, staff, emojis.
// One doc per tenant (`libraries/{tenantId}`), stored as sent: it's operator
// content with no server-side behaviour attached. Parents never read this
// endpoint — GET /api/listings/:id embeds the slice a listing references.
// ─────────────────────────────────────────────────────────────────────────

export const library = Router();

const KEYS = [
  "categories",
  "venues",
  "provided",
  "safety",
  "send",
  "outcomes",
  "addons",
  "staff",
  "emojis",
  // The venue section's heading on customer pages — tenant-level, set once in
  // the Locations tab rather than per listing. Without it here the PUT silently
  // dropped it and the operator's wording reverted on reload.
  "whereHeading",
] as const;

const MAX_BYTES = 400_000; // well under Firestore's 1MB doc limit

// GET /api/library — any member of the tenant (staff included).
library.get("/", async (req, res) => {
  const auth = req.auth!;
  if (!auth.tenantId) {
    res.status(403).json({ error: "Requires an account with a tenant" });
    return;
  }
  const snap = await db.collection("libraries").doc(auth.tenantId).get();
  res.json(snap.exists ? snap.data() : null);
});

// PUT /api/library — replace the whole library (operators only).
library.put("/", async (req, res) => {
  const auth = req.auth!;
  if (!canWrite(auth.role) || !auth.tenantId) {
    res.status(403).json({ error: "Requires an operator account with a tenant" });
    return;
  }
  const body = req.body as Record<string, unknown>;
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    res.status(400).json({ error: "Body must be an object" });
    return;
  }
  const doc: Record<string, unknown> = { tenantId: auth.tenantId };
  for (const k of KEYS) if (k in body) doc[k] = body[k];
  const size = JSON.stringify(doc).length;
  if (size > MAX_BYTES) {
    res.status(413).json({
      error: `Library too large (${Math.round(size / 1024)}KB — max ${MAX_BYTES / 1000}KB). Upload add-on images via POST /api/uploads instead of embedding them.`,
    });
    return;
  }
  await db.collection("libraries").doc(auth.tenantId).set(doc);
  res.json(doc);
});
