import { Router, type Request } from "express";
import { z } from "zod";
import { db } from "../firebase";
import type { Role } from "../middleware/role";

// Staff appraisals, on the server.
//
// The whole suite lived in the manager's browser (localStorage
// "aos.appraisals.*"), so the staff member's own "My appraisals" page — on
// their phone — could never show a review, and a second manager saw nothing
// (acceptance test d24s1). Now:
//   · managers write reviews (one doc each) and the suite's own settings —
//     templates, the feedback/1:1 log, PIPs, the 9-box and its categories —
//     which only managers ever read;
//   · a member of staff reads THEIR OWN reviews only (matched by email, else
//     by the name on their account) plus the templates (for the form), and
//     can submit their self-assessment — nothing else. The appraiser's draft
//     ratings and summary stay hidden from them until it reaches sign-off.
// Scope: tenant, or tenant__fr__franchise for a franchise (its own team).

export const appraisals = Router();
const reviewsCol = db.collection("appraisalReviews");
const configCol = db.collection("appraisalsConfig");
const canManage = (role: Role) => role === "company" || role === "freelancer" || role === "franchise";
const keyOf = (req: Request) => (req.auth!.franchiseId ? `${req.auth!.tenantId}__fr__${req.auth!.franchiseId}` : req.auth!.tenantId!);
const docId = (key: string, id: string) => `${key}_${id}`.replace(/\//g, "_");

const iso = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const rating = z.number().int().min(1).max(5);
const score = z.object({ id: z.string().max(80), rating: rating.optional(), note: z.string().max(1_000).optional() });
const reviewSchema = z.object({
  id: z.string().min(1).max(80),
  staffId: z.string().max(120),
  name: z.string().trim().min(1).max(120),
  role: z.string().max(80).optional(),
  op: z.string().max(120).optional(),
  appraiser: z.string().max(120).optional(),
  kind: z.enum(["probation", "3-month", "6-month", "annual", "supervision"]),
  templateId: z.string().max(80).optional(),
  due: iso,
  status: z.enum(["scheduled", "self", "manager", "signoff", "complete"]),
  self: z.object({ done: z.boolean(), text: z.string().max(4_000).optional(), ratings: z.array(score).max(40) }),
  manager: z.object({ text: z.string().max(4_000).optional(), ratings: z.array(score).max(40) }),
  goals: z.array(z.object({
    id: z.string().max(80), title: z.string().max(300), detail: z.string().max(2_000).optional(), due: z.string().max(10).optional(),
    status: z.enum(["open", "progress", "done", "carried"]), progress: z.number().min(0).max(100).optional(), compId: z.string().max(80).optional(),
  })).max(40),
  signoff: z.object({ managerAt: z.string().max(10).optional(), staffAt: z.string().max(10).optional() }),
  probationOutcome: z.enum(["pass", "extend", "fail"]).optional(),
  createdAt: z.string().max(40),
});
type ReviewDoc = z.infer<typeof reviewSchema>;

// The manager-only parts of the suite. Loosely typed — they're the screen's
// own structures and nobody else reads them — but bounded.
const configSchema = z.object({
  templates: z.array(z.object({ id: z.string().max(80), name: z.string().max(200) }).passthrough()).max(100).optional(),
  feedback: z.array(z.object({ id: z.string().max(80), staffId: z.string().max(120), text: z.string().max(2_000) }).passthrough()).max(1_500).optional(),
  pips: z.array(z.object({ id: z.string().max(80), staffId: z.string().max(120) }).passthrough()).max(300).optional(),
  talent: z.array(z.object({ staffId: z.string().max(120), performance: z.number().int().min(1).max(3), potential: z.number().int().min(1).max(3) })).max(2_000).optional(),
  boxes: z.record(z.string().max(8), z.object({ label: z.string().max(80), tone: z.string().max(20), action: z.string().max(300) })).optional(),
});

async function me(req: Request) {
  const name = req.user?.uid ? String((await db.collection("users").doc(req.user.uid).get()).get("name") ?? "").trim() : "";
  return { name: name.toLowerCase(), email: (req.user?.email ?? "").trim().toLowerCase() };
}
/** The member of staff's own review? Email when the review has one, else name. */
const isMine = (m: { name: string; email: string }, d: { staffEmail?: string | null; review: ReviewDoc }) =>
  d.staffEmail && m.email ? d.staffEmail === m.email : !!m.name && d.review.name.trim().toLowerCase() === m.name;

/** The email for a named person on this team, so their review reaches them. */
async function emailForName(tenantId: string, name: string): Promise<string | null> {
  const snap = await db.collection("users").where("tenantId", "==", tenantId).get();
  const hit = snap.docs.find((d) => String(d.get("name") ?? "").trim().toLowerCase() === name.trim().toLowerCase());
  return (hit?.get("email") as string | undefined)?.toLowerCase() ?? null;
}

// GET /api/appraisals — managers: the suite · staff: { reviews: their own, templates }.
appraisals.get("/", async (req, res) => {
  const auth = req.auth!;
  if (!auth.tenantId || !(canManage(auth.role) || auth.role === "staff")) { res.status(403).json({ error: "Forbidden" }); return; }
  const key = keyOf(req);
  const [snap, cfg] = await Promise.all([reviewsCol.where("key", "==", key).get(), configCol.doc(key).get()]);
  const docs = snap.docs.map((d) => d.data() as { staffEmail?: string | null; review: ReviewDoc });
  const c = cfg.data() ?? {};
  if (canManage(auth.role)) {
    res.json({ reviews: docs.map((d) => d.review), templates: c.templates ?? null, feedback: c.feedback ?? null, pips: c.pips ?? null, talent: c.talent ?? null, boxes: c.boxes ?? null });
    return;
  }
  const m = await me(req);
  const own = docs.filter((d) => isMine(m, d)).map(({ review: r }) =>
    // The appraiser's working notes aren't the staff member's until it's put to them.
    r.status === "signoff" || r.status === "complete" ? r : { ...r, manager: { ratings: [] } });
  res.json({ reviews: own, templates: c.templates ?? null });
});

// PUT /api/appraisals/reviews/:id — a manager creates or updates a review.
appraisals.put("/reviews/:id", async (req, res) => {
  const auth = req.auth!;
  if (!auth.tenantId || !canManage(auth.role)) { res.status(403).json({ error: "Only a manager can edit appraisals" }); return; }
  const parsed = reviewSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues }); return; }
  if (parsed.data.id !== req.params.id) { res.status(400).json({ error: "Review id doesn't match" }); return; }
  const key = keyOf(req);
  const ref = reviewsCol.doc(docId(key, req.params.id));
  const cur = await ref.get();
  if (cur.exists && cur.get("key") !== key) { res.status(404).json({ error: "Not found" }); return; }
  const prev = cur.data() as { review?: ReviewDoc; staffEmail?: string | null } | undefined;
  // Re-resolve the person only when the name changes (or it's new).
  const staffEmail = prev?.review && prev.review.name === parsed.data.name && prev.staffEmail !== undefined ? prev.staffEmail : await emailForName(auth.tenantId, parsed.data.name);
  await ref.set({ key, tenantId: auth.tenantId, franchiseId: auth.franchiseId ?? null, staffEmail, review: parsed.data, updatedAt: new Date().toISOString(), updatedBy: req.user?.email ?? null });
  res.json({ ok: true, review: parsed.data });
});

// DELETE /api/appraisals/reviews/:id — manager.
appraisals.delete("/reviews/:id", async (req, res) => {
  const auth = req.auth!;
  if (!auth.tenantId || !canManage(auth.role)) { res.status(403).json({ error: "Only a manager can edit appraisals" }); return; }
  const key = keyOf(req);
  const ref = reviewsCol.doc(docId(key, req.params.id));
  const cur = await ref.get();
  if (!cur.exists || cur.get("key") !== key) { res.status(404).json({ error: "Not found" }); return; }
  await ref.delete();
  res.json({ ok: true });
});

// POST /api/appraisals/reviews/:id/self — the member of staff submits their
// own self-assessment. Only the self part changes; it moves to manager review.
appraisals.post("/reviews/:id/self", async (req, res) => {
  const auth = req.auth!;
  if (!auth.tenantId || auth.role !== "staff") { res.status(403).json({ error: "Only the member of staff fills in their self-assessment" }); return; }
  const parsed = z.object({ text: z.string().max(4_000).optional(), ratings: z.array(score).max(40) }).safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues }); return; }
  const key = keyOf(req);
  const ref = reviewsCol.doc(docId(key, req.params.id));
  const cur = await ref.get();
  const d = cur.data() as { key?: string; staffEmail?: string | null; review: ReviewDoc } | undefined;
  if (!d || d.key !== key || !isMine(await me(req), d)) { res.status(404).json({ error: "Not found" }); return; }
  if (d.review.status === "complete" || d.review.status === "signoff") { res.status(409).json({ error: "This review has already been completed" }); return; }
  const review: ReviewDoc = {
    ...d.review,
    self: { done: true, text: parsed.data.text?.trim() || undefined, ratings: parsed.data.ratings },
    status: d.review.status === "self" || d.review.status === "scheduled" ? "manager" : d.review.status,
  };
  if (review.self.text === undefined) delete review.self.text;
  await ref.update({ review, updatedAt: new Date().toISOString(), updatedBy: req.user?.email ?? null });
  res.json({ ok: true, review: { ...review, manager: { ratings: [] } } });
});

// PUT /api/appraisals/config — a manager saves any of templates / feedback /
// pips / talent / boxes (only the fields sent change).
appraisals.put("/config", async (req, res) => {
  const auth = req.auth!;
  if (!auth.tenantId || !canManage(auth.role)) { res.status(403).json({ error: "Only a manager can edit appraisals" }); return; }
  const parsed = configSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues }); return; }
  const patch = Object.fromEntries(Object.entries(parsed.data).filter(([, v]) => v !== undefined));
  if (!Object.keys(patch).length) { res.status(400).json({ error: "Nothing to save" }); return; }
  await configCol.doc(keyOf(req)).set({ ...patch, tenantId: auth.tenantId, franchiseId: auth.franchiseId ?? null, updatedAt: new Date().toISOString() }, { merge: true });
  res.json({ ok: true });
});
