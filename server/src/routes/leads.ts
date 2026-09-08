import { Router } from "express";
import { z } from "zod";
import { db } from "../firebase";

// Marketing-site "Book a demo" lead capture.
// - POST is PUBLIC: the /demo form on the site posts here with no login.
// - GET/PATCH are HQ-only: the platform "Leads" list works the pipeline.
// New leads surface on the HQ bell too — see platformNotifications ("lead"),
// which aggregates the `leads` collection on read.

const schema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(160),
  phone: z.string().trim().max(40).optional().default(""),
  business: z.string().trim().max(160).optional().default(""),
  size: z.string().trim().max(60).optional().default(""),
  interest: z.string().trim().max(60).optional().default(""),
  message: z.string().trim().max(2000).optional().default(""),
  source: z.string().trim().max(60).optional().default("demo"),
});

export const leadsPublic = Router();

leadsPublic.post("/", async (req, res) => {
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues });
    return;
  }
  const ref = db.collection("leads").doc();
  await ref.set({ ...parsed.data, status: "new", createdAt: new Date().toISOString() });
  res.json({ ok: true, id: ref.id });
});

export const leads = Router();

leads.use((req, res, next) => {
  if (req.auth!.role !== "platform") {
    res.status(403).json({ error: "Requires the platform role" });
    return;
  }
  next();
});

leads.get("/", async (_req, res) => {
  const snap = await db.collection("leads").get();
  const items = snap.docs
    .map((d) => ({ id: d.id, ...(d.data() as Record<string, unknown>) }))
    .sort((a, b) => (String((a as { createdAt?: string }).createdAt) < String((b as { createdAt?: string }).createdAt) ? 1 : -1));
  res.json({ leads: items });
});

leads.patch("/:id", async (req, res) => {
  const parsed = z
    .object({
      status: z.enum(["new", "contacted", "won", "lost"]).optional(),
      notes: z.string().max(4000).optional(),
    })
    .safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues });
    return;
  }
  await db
    .collection("leads")
    .doc(req.params.id)
    .set({ ...parsed.data, updatedAt: new Date().toISOString() }, { merge: true });
  res.json({ ok: true });
});
