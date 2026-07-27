import { Router } from "express";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { db } from "../firebase";

// Sales CRM (HQ pipeline) — mounted at /api/platform/leads. Leads live in a
// top-level `leads` collection with activities EMBEDDED as an array on the
// lead doc: the UI always renders them inline with the lead and volumes are
// tiny (a handful of touches each), so a subcollection would only add reads.
// Platform-role only end to end; identity (createdBy / activity `by`) is
// always stamped server-side from the verified token — never from the body.
export const platformLeads = Router();
const col = db.collection("leads");

const SOURCES = ["cold_call", "email", "social", "referral", "event", "inbound"] as const;
const PLANS = ["freelancer", "company", "franchise"] as const;
const STAGES = ["new", "contacted", "interested", "demo", "trial", "won", "lost"] as const;
const ACTIVITY_TYPES = ["call", "email", "social", "demo", "note"] as const;

// zod strips unknown keys, so a client re-sending a whole lead (id, activities,
// timestamps and all) can never overwrite the server-owned fields.
const leadSchema = z.object({
  business: z.string().trim().min(1).max(160),
  contactName: z.string().trim().max(120).default(""),
  email: z.string().trim().max(160).default(""),
  phone: z.string().trim().max(40).default(""),
  location: z.string().trim().max(120).default(""),
  source: z.enum(SOURCES).default("cold_call"),
  owner: z.string().trim().max(80).default(""), // rep name (free text until a `sales` role exists)
  plan: z.enum(PLANS).default("company"),
  estMrr: z.number().min(0).max(100_000).default(0),
  stage: z.enum(STAGES).default("new"),
  lostReason: z.string().trim().max(400).optional(),
  notes: z.string().trim().max(4_000).default(""),
});

const activitySchema = z.object({
  type: z.enum(ACTIVITY_TYPES),
  note: z.string().trim().min(1).max(1_000),
  outcome: z.string().trim().max(200).optional(),
});

// GET / — every lead with its embedded activities, most recently touched first
// (the board and dashboard both want "what moved last" at the top).
platformLeads.get("/", async (req, res) => {
  if (req.auth!.role !== "platform") {
    res.status(403).json({ error: "Requires the platform role" });
    return;
  }
  const snap = await col.get();
  const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Record<string, unknown>) })) as (Record<string, unknown> & { updatedAt?: string })[];
  list.sort((a, b) => (`${a.updatedAt ?? ""}` < `${b.updatedAt ?? ""}` ? 1 : -1));
  res.json(list);
});

// POST / — create a lead. Timestamps and creator come from the server.
platformLeads.post("/", async (req, res) => {
  if (req.auth!.role !== "platform") {
    res.status(403).json({ error: "Requires the platform role" });
    return;
  }
  const parsed = leadSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues }); return; }
  const now = new Date().toISOString();
  const doc = { ...parsed.data, activities: [], createdAt: now, updatedAt: now, createdBy: req.user?.email ?? "unknown" };
  const ref = await col.add(doc);
  res.status(201).json({ id: ref.id, ...doc });
});

// PUT /:id — edit fields / move stage. Partial: only the keys sent change;
// activities/createdAt/createdBy can't be touched (stripped by the schema).
platformLeads.put("/:id", async (req, res) => {
  if (req.auth!.role !== "platform") {
    res.status(403).json({ error: "Requires the platform role" });
    return;
  }
  const parsed = leadSchema.partial().safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues }); return; }
  const ref = col.doc(req.params.id);
  const snap = await ref.get();
  if (!snap.exists) { res.status(404).json({ error: "Lead not found" }); return; }
  await ref.set({ ...parsed.data, updatedAt: new Date().toISOString() }, { merge: true });
  const after = await ref.get();
  res.json({ id: after.id, ...after.data() });
});

// DELETE /:id.
platformLeads.delete("/:id", async (req, res) => {
  if (req.auth!.role !== "platform") {
    res.status(403).json({ error: "Requires the platform role" });
    return;
  }
  const ref = col.doc(req.params.id);
  if (!(await ref.get()).exists) { res.status(404).json({ error: "Lead not found" }); return; }
  await ref.delete();
  res.json({ ok: true });
});

// POST /:id/activities — log a touch. Prepended (the UI shows newest first and
// the board card previews activities[0]); `at`/`by` are server-stamped so the
// audit trail reflects who was actually signed in, not what the client claims.
platformLeads.post("/:id/activities", async (req, res) => {
  if (req.auth!.role !== "platform") {
    res.status(403).json({ error: "Requires the platform role" });
    return;
  }
  const parsed = activitySchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues }); return; }
  const ref = col.doc(req.params.id);
  const snap = await ref.get();
  if (!snap.exists) { res.status(404).json({ error: "Lead not found" }); return; }
  const now = new Date().toISOString();
  const activity = {
    id: randomUUID(),
    type: parsed.data.type,
    note: parsed.data.note,
    ...(parsed.data.outcome ? { outcome: parsed.data.outcome } : {}),
    at: now,
    by: req.user?.name ?? req.user?.email ?? "Platform",
  };
  const existing = (snap.data()!.activities as unknown[] | undefined) ?? [];
  await ref.set({ activities: [activity, ...existing], updatedAt: now }, { merge: true });
  const after = await ref.get();
  res.status(201).json({ id: after.id, ...after.data() });
});

// POST /bulk — CSV import. Dedupes by lowercased email against BOTH the
// existing pipeline and the payload itself (a spreadsheet often repeats a
// contact); rows without an email can't be matched so they're always added.
platformLeads.post("/bulk", async (req, res) => {
  if (req.auth!.role !== "platform") {
    res.status(403).json({ error: "Requires the platform role" });
    return;
  }
  const parsed = z.array(leadSchema).min(1).max(2_000).safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues }); return; }
  const existing = await col.get();
  const seen = new Set(
    existing.docs
      .map((d) => `${(d.data().email as string | undefined) ?? ""}`.trim().toLowerCase())
      .filter(Boolean),
  );
  const now = new Date().toISOString();
  const createdBy = req.user?.email ?? "unknown";
  let added = 0;
  let skipped = 0;
  // Firestore batches cap at 500 writes — chunk the import.
  let batch = db.batch();
  let inBatch = 0;
  const commits: Promise<unknown>[] = [];
  for (const lead of parsed.data) {
    const email = lead.email.trim().toLowerCase();
    if (email && seen.has(email)) { skipped++; continue; }
    if (email) seen.add(email);
    batch.set(col.doc(), { ...lead, activities: [], createdAt: now, updatedAt: now, createdBy });
    added++;
    if (++inBatch === 400) { commits.push(batch.commit()); batch = db.batch(); inBatch = 0; }
  }
  if (inBatch) commits.push(batch.commit());
  await Promise.all(commits);
  res.status(201).json({ added, skipped });
});
