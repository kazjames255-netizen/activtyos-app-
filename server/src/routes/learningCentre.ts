import { Router } from "express";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { db } from "../firebase";
import type { Role } from "../middleware/role";
import { loadSettings } from "../lib/tenantLibrary";

// Staff Learning Centre — the persistence that was still per-device
// (docs/amir-backend-outstanding.md #37/#60), added beside routes/learning.ts
// (assignments + completions + notify live there, unchanged):
//   · courses   — a manager's course library edits (content + quiz), per tenant/franchise
//   · attempts  — every quiz attempt (score, pass/fail vs the TENANT pass mark, attempt no.)
//   · certificates — a certificate record issued once per person+course, only for a
//     real server-side completion, with a public-safe reference.
// Separate from the parent/tutor Learning Hub (routes/learningHub.ts).

export const learningCentre = Router();
const canManage = (role: Role) => role === "company" || role === "freelancer" || role === "franchise";
const keyOf = (t: string, f: string | null) => (f ? `${t}__fr__${f}` : t);
const nameSlug = (n: string) => n.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "").slice(0, 100) || "unnamed";
const MAX_COURSES_BYTES = 800_000; // Firestore doc cap is 1 MiB
const nameOf = async (uid?: string) => (uid ? String((await db.collection("users").doc(uid).get()).get("name") ?? "").trim() : "");
const allowed = (role: Role) => canManage(role) || role === "staff";

// GET /api/learning/courses — { courses: CourseDoc[] | null } (null = nothing saved yet → client keeps its built-in library). Franchise accounts also get head office's courses, tagged fromHo.
learningCentre.get("/courses", async (req, res) => {
  const auth = req.auth!;
  if (!auth.tenantId || !allowed(auth.role)) { res.status(403).json({ error: "Forbidden" }); return; }
  const own = (await db.collection("learningCourses").doc(keyOf(auth.tenantId, auth.franchiseId ?? null)).get()).get("courses") as Record<string, unknown>[] | undefined;
  let ho: Record<string, unknown>[] = [];
  if (auth.franchiseId) ho = (((await db.collection("learningCourses").doc(auth.tenantId).get()).get("courses") as Record<string, unknown>[] | undefined) ?? []).map((c) => ({ ...c, fromHo: true }));
  res.json({ courses: own || ho.length ? [...(own ?? []), ...ho.filter((h) => !(own ?? []).some((o) => o.id === h.id))] : null });
});

// PUT /api/learning/courses {courses} — manager replaces their own library (whole list, like /assignments).
learningCentre.put("/courses", async (req, res) => {
  const auth = req.auth!;
  if (!auth.tenantId || !canManage(auth.role)) { res.status(403).json({ error: "Only a manager can edit courses" }); return; }
  const parsed = z.object({ courses: z.array(z.object({ id: z.string().min(1).max(80), title: z.string().max(300).optional() }).passthrough()).max(300) }).safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues }); return; }
  const courses = parsed.data.courses.filter((c) => !(c as { fromHo?: boolean }).fromHo);
  if (Buffer.byteLength(JSON.stringify(courses)) > MAX_COURSES_BYTES) { res.status(413).json({ error: "Your course library is too large to save — remove embedded images/videos or delete unused courses." }); return; }
  await db.collection("learningCourses").doc(keyOf(auth.tenantId, auth.franchiseId ?? null)).set({ tenantId: auth.tenantId, franchiseId: auth.franchiseId ?? null, courses, updatedAt: new Date().toISOString(), updatedBy: req.user?.email ?? null });
  res.json({ ok: true, count: courses.length });
});

const attemptSchema = z.object({
  courseId: z.string().trim().min(1).max(80),
  title: z.string().trim().max(200).default(""),
  score: z.number().min(0).max(100),
  correct: z.number().int().min(0).max(1000).optional(),
  total: z.number().int().min(0).max(1000).optional(),
  quizVersion: z.number().int().min(0).max(100).optional(),
});

// POST /api/learning/attempts — record one quiz attempt for the SIGNED-IN person (pass or fail). Pass/fail is judged against the tenant's pass mark here.
learningCentre.post("/attempts", async (req, res) => {
  const auth = req.auth!;
  if (!auth.tenantId || !allowed(auth.role) || !req.user?.uid) { res.status(403).json({ error: "Forbidden" }); return; }
  const parsed = attemptSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues }); return; }
  const p = parsed.data;
  const key = keyOf(auth.tenantId, auth.franchiseId ?? null);
  const learn = ((await loadSettings(auth.tenantId, auth.franchiseId ?? null)).learning ?? {}) as { passMark?: number };
  const passMark = typeof learn.passMark === "number" ? learn.passMark : 80;
  const staffName = await nameOf(req.user.uid);
  const n = (await db.collection("learningAttempts").where("key", "==", key).where("uid", "==", req.user.uid).where("courseId", "==", p.courseId).get()).size + 1;
  const rec = { key, tenantId: auth.tenantId, franchiseId: auth.franchiseId ?? null, uid: req.user.uid, staffName, courseId: p.courseId, title: p.title, score: Math.round(p.score), correct: p.correct ?? null, total: p.total ?? null, quizVersion: p.quizVersion ?? null, passMark, passed: p.score >= passMark, attempt: n, at: new Date().toISOString() };
  await db.collection("learningAttempts").add(rec);
  res.status(201).json({ attempt: n, passed: rec.passed, passMark, score: rec.score });
});

// GET /api/learning/attempts[?courseId=] — staff: their own; managers: the whole team's.
learningCentre.get("/attempts", async (req, res) => {
  const auth = req.auth!;
  if (!auth.tenantId || !allowed(auth.role)) { res.status(403).json({ error: "Forbidden" }); return; }
  let q = db.collection("learningAttempts").where("key", "==", keyOf(auth.tenantId, auth.franchiseId ?? null)) as FirebaseFirestore.Query;
  if (auth.role === "staff") q = q.where("uid", "==", req.user?.uid ?? "-");
  const courseId = typeof req.query.courseId === "string" ? req.query.courseId : "";
  if (courseId) q = q.where("courseId", "==", courseId);
  const snap = await q.get();
  res.json(snap.docs.map((d) => { const { key: _k, tenantId: _t, franchiseId: _f, uid: _u, ...r } = d.data(); return r; }).sort((a, b) => String(b.at).localeCompare(String(a.at))).slice(0, 500));
});

// POST /api/learning/certificates {courseId, staffName?} — issue (once) the certificate record for a completion that exists server-side. Staff: their own; a manager: for a named person. Idempotent: a repeat returns the same reference.
learningCentre.post("/certificates", async (req, res) => {
  const auth = req.auth!;
  if (!auth.tenantId || !allowed(auth.role)) { res.status(403).json({ error: "Forbidden" }); return; }
  const parsed = z.object({ courseId: z.string().trim().min(1).max(80), staffName: z.string().trim().max(120).optional() }).safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues }); return; }
  const key = keyOf(auth.tenantId, auth.franchiseId ?? null);
  const isStaff = auth.role === "staff";
  const name = isStaff ? await nameOf(req.user?.uid) : (parsed.data.staffName ?? "").trim();
  if (!name) { res.status(400).json({ error: "Whose certificate?" }); return; }
  const who = isStaff ? req.user?.uid ?? nameSlug(name) : nameSlug(name);
  const id = `${key}_${who}_${parsed.data.courseId}`.replace(/\//g, "_");
  const comp = await db.collection("learningCompletions").doc(id).get();
  if (!comp.exists || comp.get("key") !== key) { res.status(409).json({ error: "No passed completion on record for that course yet." }); return; }
  const ref = db.collection("learningCertificates").doc(id);
  const rec = await db.runTransaction(async (tx) => {
    const cur = await tx.get(ref);
    if (cur.exists) return cur.data()!;
    const doc = { key, tenantId: auth.tenantId, franchiseId: auth.franchiseId ?? null, uid: isStaff ? req.user?.uid ?? null : null, staffName: comp.get("staffName"), courseId: comp.get("courseId"), title: comp.get("title"), score: comp.get("score"), completedOn: comp.get("date"), ref: randomBytes(6).toString("hex").toUpperCase(), issuedAt: new Date().toISOString(), issuedBy: req.user?.email ?? null };
    tx.create(ref, doc);
    return doc;
  });
  res.status(201).json({ ref: rec.ref, staffName: rec.staffName, courseId: rec.courseId, title: rec.title, score: rec.score, completedOn: rec.completedOn, issuedAt: rec.issuedAt });
});

// GET /api/learning/certificates — staff: their own; managers: all in their scope.
learningCentre.get("/certificates", async (req, res) => {
  const auth = req.auth!;
  if (!auth.tenantId || !allowed(auth.role)) { res.status(403).json({ error: "Forbidden" }); return; }
  let q = db.collection("learningCertificates").where("key", "==", keyOf(auth.tenantId, auth.franchiseId ?? null)) as FirebaseFirestore.Query;
  if (auth.role === "staff") q = q.where("uid", "==", req.user?.uid ?? "-");
  const snap = await q.get();
  res.json(snap.docs.map((d) => { const { key: _k, tenantId: _t, franchiseId: _f, uid: _u, issuedBy: _i, ...r } = d.data(); return r; }));
});
