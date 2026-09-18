import { Router } from "express";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { db } from "../firebase";
import { emailDemoBooked, emailQuestionAnswered } from "../lib/emails";

// Sales CRM (HQ pipeline) — mounted at /api/platform/leads. Leads live in a
// top-level `leads` collection with activities EMBEDDED as an array on the
// lead doc: the UI always renders them inline with the lead and volumes are
// tiny (a handful of touches each), so a subcollection would only add reads.
// Platform-role only end to end; identity (createdBy / activity `by`) is
// always stamped server-side from the verified token — never from the body.
export const platformLeads = Router();
const col = db.collection("leads");
// The `leads` collection also holds tens of thousands of researched prospects
// (HQ → Leads). Only leads someone is actually working — created here, a demo
// request, or moved on from HQ → Leads — carry `inPipeline`, and the board,
// the live stream and the signup match read just those.
const pipeline = () => col.where("inPipeline", "==", true);

const SOURCES = ["cold_call", "email", "social", "referral", "event", "inbound"] as const;
const PLANS = ["freelancer", "company", "franchise"] as const;
/** What KIND of prospect this is — mirrors who actually buys: one person, a
 *  business, a multi-site group, a school, a trust/cluster of schools, a
 *  franchise network, or a community organisation. Drives the label on the
 *  name field and how the pipeline reads. */
const KINDS = ["person", "business", "group", "franchise", "school", "cluster", "charity"] as const;
const STAGES = ["new", "contacted", "interested", "demo", "trial", "won", "lost"] as const;
const ACTIVITY_TYPES = ["call", "email", "social", "demo", "note"] as const;

// zod strips unknown keys, so a client re-sending a whole lead (id, activities,
// timestamps and all) can never overwrite the server-owned fields.
const leadSchema = z.object({
  business: z.string().trim().min(1).max(160),   // the name — see `kind` for what it names
  kind: z.enum(KINDS).default("business"),
  contactName: z.string().trim().max(120).default(""),
  email: z.string().trim().max(160).default(""),
  phone: z.string().trim().max(40).default(""),
  location: z.string().trim().max(120).default(""),
  // Known channels (SOURCES) plus named lead sources such as a directory the
  // prospect was found in ("eequ") — an enum here made the Sales board refuse
  // to save any lead whose source it didn't list.
  source: z.string().trim().min(1).max(60).default("cold_call"),
  owner: z.string().trim().max(80).default(""), // rep name (free text until a `sales` role exists)
  plan: z.enum(PLANS).default("company"),
  estMrr: z.number().min(0).max(100_000).default(0),
  stage: z.enum(STAGES).default("new"),
  lostReason: z.string().trim().max(400).optional(),
  notes: z.string().trim().max(4_000).default(""),
  // Set when HQ books a lead onto a real open demo-call slot (either the
  // public /demo form, or HQ doing it on the board's behalf for a lead who
  // hasn't booked a call themselves) — see routes/demoSlots.ts.
  slotAt: z.string().trim().max(40).optional(),
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
  const snap = await pipeline().get();
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
  const doc = { ...parsed.data, activities: [], inPipeline: true, createdAt: now, updatedAt: now, createdBy: req.user?.email ?? "unknown" };
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
  const now = new Date().toISOString();
  // Stamp stage MOVES, not just the edit. `updatedAt` bumps on any change, so
  // without this "how many reached Demo this week" can only ever be guessed at
  // from the current stage plus the last time anything about the lead changed —
  // renaming a lead would make it look like it had just moved. The dashboard's
  // pipeline summary reads this log.
  const before = snap.data() as { stage?: string; stageLog?: { from: string; to: string; at: string }[]; slotAt?: string; name?: string; contactName?: string; business?: string; email?: string };
  const moved = parsed.data.stage && parsed.data.stage !== (before.stage ?? "new");
  const stageLog = moved
    ? [...(before.stageLog ?? []), { from: before.stage ?? "new", to: parsed.data.stage!, at: now }].slice(-40)
    : undefined;
  await ref.set({ ...parsed.data, ...(stageLog ? { stageLog, stageAt: now } : {}), inPipeline: true, updatedAt: now }, { merge: true });
  // A genuinely new/changed slot (the Sales board's "Book onto a demo" —
  // someone who never booked one themselves) gets an email so it isn't
  // sprung on them — a no-op PUT that happens to resend the same slotAt
  // (e.g. an unrelated field edit) doesn't re-notify.
  if (parsed.data.slotAt && parsed.data.slotAt !== before.slotAt) {
    const to = parsed.data.email || before.email;
    const name = parsed.data.contactName || before.contactName || before.name || parsed.data.business || before.business || "";
    if (to) emailDemoBooked({ to, name, slotAt: parsed.data.slotAt, leadId: ref.id });
  }
  const after = await ref.get();
  res.json({ id: after.id, ...after.data() });
});

// PUT /:id/answer — HQ replies to a "website-design-question" lead. Stores
// the answer on the lead (so it's visible later, not just fired-and-
// forgotten) and emails the customer their original question + this answer
// + a Book a demo link, in one go.
platformLeads.put("/:id/answer", async (req, res) => {
  if (req.auth!.role !== "platform") {
    res.status(403).json({ error: "Requires the platform role" });
    return;
  }
  const parsed = z.object({ answer: z.string().trim().min(1).max(4_000) }).safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues }); return; }
  const ref = col.doc(req.params.id);
  const snap = await ref.get();
  if (!snap.exists) { res.status(404).json({ error: "Lead not found" }); return; }
  const lead = snap.data() as { email?: string; name?: string; contactName?: string; business?: string; message?: string; activities?: unknown[] };
  const now = new Date().toISOString();
  // Appended as its own thread message (direction "out"), same as an inbound
  // reply — NOT a single overwritable field. The old questionAnswer/
  // questionAnsweredAt fields silently replaced each other on every reply,
  // which read as the previous exchange having vanished; the thread is now
  // the append-only activities array, same place an inbound reply lands.
  const activity = {
    id: randomUUID(), type: "email" as const, direction: "out" as const,
    note: parsed.data.answer, at: now, by: req.user?.name ?? req.user?.email ?? "HQ",
  };
  await ref.set({ activities: [activity, ...(lead.activities ?? [])], inPipeline: true, updatedAt: now }, { merge: true });
  const to = lead.email;
  const name = lead.contactName || lead.name || lead.business || "";
  if (to) emailQuestionAnswered({ to, name, question: lead.message || "", answer: parsed.data.answer, leadId: ref.id });
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
  await ref.set({ activities: [activity, ...existing], inPipeline: true, updatedAt: now }, { merge: true });
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
  // Skip emails already on file — looked up 30 at a time, not by reading every lead.
  const wanted = [...new Set(parsed.data.map((l) => l.email.trim().toLowerCase()).filter(Boolean))];
  const seen = new Set<string>();
  for (let i = 0; i < wanted.length; i += 30) {
    const hit = await col.where("email", "in", wanted.slice(i, i + 30)).select("email").get();
    for (const d of hit.docs) seen.add(`${d.get("email") ?? ""}`.trim().toLowerCase());
  }
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
    batch.set(col.doc(), { ...lead, activities: [], inPipeline: true, createdAt: now, updatedAt: now, createdBy });
    added++;
    if (++inBatch === 400) { commits.push(batch.commit()); batch = db.batch(); inBatch = 0; }
  }
  if (inBatch) commits.push(batch.commit());
  await Promise.all(commits);
  res.status(201).json({ added, skipped });
});
