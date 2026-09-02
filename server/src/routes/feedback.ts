import { Router } from "express";
import { z } from "zod";
import { db } from "../firebase";

// Parent feedback / reviews. A parent leaves a rating + comment for a provider
// they've booked with (reached from the "How did we do?" prompt). Read back so
// the page can show what they've already sent. Operator-side viewing is later.
//   POST /api/my/feedback   — leave feedback
//   GET  /api/my/feedback   — my submitted feedback
export const feedback = Router();
const col = db.collection("feedback");
const lc = (s: string) => s.trim().toLowerCase();

const schema = z.object({
  tenantId: z.string().min(1).max(60),
  rating: z.number().int().min(1).max(5),
  comment: z.string().trim().max(2000).optional(),
  listing: z.string().trim().max(160).optional(),
  ref: z.string().trim().max(60).optional(),
});

feedback.post("/", async (req, res) => {
  const email = lc(req.user?.email ?? "");
  if (!email) { res.status(403).json({ error: "Sign in to leave feedback" }); return; }
  const p = schema.safeParse(req.body);
  if (!p.success) { res.status(400).json({ error: p.error.issues }); return; }
  const doc = {
    tenantId: p.data.tenantId,
    email,
    name: req.user?.name ?? null,
    rating: p.data.rating,
    comment: p.data.comment ?? "",
    listing: p.data.listing ?? null,
    ref: p.data.ref ?? null,
    createdAt: new Date().toISOString(),
  };
  const ref = await col.add(doc);
  res.status(201).json({ id: ref.id, ...doc });
});

feedback.get("/", async (req, res) => {
  const email = lc(req.user?.email ?? "");
  if (!email) { res.status(403).json({ error: "Sign in first" }); return; }
  const snap = await col.where("email", "==", email).get();
  const list = snap.docs
    .map((d) => ({ id: d.id, ...(d.data() as Record<string, unknown>) }))
    .sort((a, b) => (`${(a as { createdAt?: string }).createdAt}` < `${(b as { createdAt?: string }).createdAt}` ? 1 : -1));
  res.json(list);
});
