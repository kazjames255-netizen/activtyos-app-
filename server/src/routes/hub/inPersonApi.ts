import { createHash } from "node:crypto";
import { Router, type Response } from "express";
import { z } from "zod";
import { db } from "../../firebase";
import { FieldValue } from "firebase-admin/firestore";
import { canSee, canSeeStudent, canWriteRow, hubConfig, hubEnrolments, okId, requireEdit, resolveCtx, type HubCtx } from "../../lib/hubCore";
import { activeMembers, visibleGroups } from "../../lib/hubGroups";
import { nameList, notifyFamilies } from "../../lib/hubNotify";
import { pingHub } from "../../lib/hubPing";
import { applyManualMark, markResponse, scoreAttempt, type ScoredAnswer } from "../../lib/hubScoring";
import { audienceFit, effectiveRetake, normAudience, retakeDecision } from "../../lib/hubRules";
import { pinAttemptImages, questionImageIds, imageBase } from "../../lib/hubMedia";
import { assessmentRows } from "../../lib/hubIndex";
import { diagnosticState } from "./assessments";
import { cleanResponse, questionOut, refreshMastery, snapshotQuestions, splitOf } from "./attempts";
import {
  assessmentsCol, asStr, attemptsCol, childFacts, childRefFor, childSubjectOk, enrolmentId, fitsChild, homeworkCol, nowIso, questionsCol,
  type AnswerDoc, type AssessmentDoc, type AttemptDoc, type ChildRef,
} from "./shared";
import { eligibleStudents, lessonsCol, notesCol, submissionsCol } from "./teachingCommon";

// Learning Hub — IN-PERSON lessons: a tutor runs a lesson or quiz on THEIR device with children sitting beside them (no video
// call, the children have no login) and records what each child did. Contract: docs/learning-hub.md → "In-person lessons".
//
// A session is an ordinary hubLessons row with `mode: "in_person"` — so attendance, the privacy export/erase and the realtime
// channel already cover it — that GET /lessons hides (it is not a video lesson: nothing to join, no room). The tutor's device:
//
//   POST /in-person/sessions {childIds|groupIds, noteId?, assessmentId?, title?, key?}     → the session (attendance starts as "everyone chosen")
//   GET  /in-person/sessions[?status=live]                                                  → recent sessions (a tutor resumes one)
//   GET  /in-person/sessions/:id                                                            → session + every result recorded so far
//   PUT  /in-person/sessions/:id/attendance {present:{childId:bool}, add?:[childId]}        → who is here (add = a late arrival)
//   GET  /in-person/sessions/:id/questions[?assessmentId=]                                  → the paper as ONE class sees it (shared shuffle) + the tutor's key
//   POST /in-person/sessions/:id/submit {assessmentId, children:[{childId, answers}], override?, linkHomework?}
//                                                                                           → one REAL, marked attempt per child (idempotent)
//   POST /in-person/sessions/:id/end {warmup?}                                              → close it; families told about children with no quiz result
//
// Safety: tutor-only (requireEdit); every child must be an ACTIVE enrolment of THIS tenant inside the tutor's scope AND part of
// the session, else it is a 404 / a skipped row — a tutor can never record an attempt for a child outside their own roster.

export const hubInPersonApi = Router();

interface SessionDoc {
  tenantId: string; franchiseId: string | null; mode: "in_person";
  tutorUid: string; tutorName: string; title: string; topicId: string | null;
  startsAt: string; durationMins: number; childIds: string[]; status: "live" | "ended" | "cancelled";
  roomName: null; roomUrl: null; notes: string; videos: unknown[]; noteIds: string[]; groupIds: string[];
  attendance: Record<string, string>; tutorJoinedAt: string | null; endedAt: string | null;
  /** The lesson (hubNotes id) / quiz (hubAssessments id) the tutor set out to run. */
  noteId?: string | null; assessmentId?: string | null;
  /** Oral warm-up tallies the tutor tapped in per child (class-level practice: nothing here feeds mastery). */
  warmup?: { childId: string; correct: number; total: number }[];
  createdBy: string; createdAt: string; updatedAt: string;
}
type Session = SessionDoc & { id: string };

const CLASS_MAX = 30;
const digest = (...parts: string[]) => createHash("sha256").update(parts.join("\u0000")).digest("hex").slice(0, 40);

/** A live/ended in-person session this tutor may act on (tenant + scope), else a refusal has been sent. */
async function sessionFor(ctx: HubCtx, id: string, res: Response, write: boolean): Promise<Session | null> {
  const nf = () => { res.status(404).json({ error: "Session not found" }); return null; };
  if (!okId(id)) return nf();
  const snap = await lessonsCol.doc(id).get();
  if (!snap.exists || snap.get("tenantId") !== ctx.tenantId || snap.get("mode") !== "in_person" || !canSeeStudent(ctx, snap.get("franchiseId"))) return nf();
  if (write && !canWriteRow(ctx, snap.get("franchiseId"))) { res.status(403).json({ error: "That session belongs to head office" }); return null; }
  return { id: snap.id, ...(snap.data() as SessionDoc) };
}

const namesOf = async (ctx: HubCtx, ids: string[]): Promise<Map<string, string>> => {
  const out = new Map<string, string>();
  if (!ids.length) return out;
  const snaps = await db.getAll(...ids.filter(okId).map((c) => hubEnrolments.doc(enrolmentId(ctx.tenantId, c))));
  for (const s of snaps) if (s.exists) out.set(s.get("childId") as string, (s.get("childName") as string) ?? "");
  return out;
};

const sessionOut = (s: Session, names: Map<string, string>) => ({
  id: s.id, mode: "in_person" as const, title: s.title, status: s.status, startsAt: s.startsAt, endedAt: s.endedAt ?? null,
  tutorName: s.tutorName, noteId: s.noteId ?? null, assessmentId: s.assessmentId ?? null, groupIds: s.groupIds ?? [],
  childIds: s.childIds, attendance: s.attendance ?? {},
  students: s.childIds.map((id) => ({ childId: id, childName: names.get(id) ?? "Student", present: !!s.attendance?.[id] })),
  warmup: s.warmup ?? [],
});

/** Every attempt recorded for a session, as result rows (no key). */
async function resultsOf(ctx: HubCtx, sessionId: string) {
  const snap = await attemptsCol.where("tenantId", "==", ctx.tenantId).where("sessionId", "==", sessionId).get();
  return snap.docs.map((d) => {
    const a = d.data() as AttemptDoc;
    return {
      attemptId: d.id, childId: a.childId, childName: a.childName, assessmentId: a.assessmentId, assessmentTitle: a.assessmentTitle, status: a.status,
      scoreMarks: a.scoreMarks ?? 0, maxMarks: a.maxMarks ?? 0, pct: a.pct ?? null, passMarkPct: a.passMarkPct,
      passed: a.status === "marked" ? (a.pct ?? 0) >= a.passMarkPct : null, homeworkId: a.homeworkId ?? null,
      answers: (a.answers ?? []).map((x) => ({ questionId: x.questionId, correct: x.correct, marksAwarded: x.marksAwarded, marksMax: x.marksMax, pending: x.pending === true })),
    };
  });
}

// ── create / list / read ─────────────────────────────────────────────────────

const createBody = z.object({
  childIds: z.array(z.string().min(1).max(100)).max(CLASS_MAX).default([]),
  groupIds: z.array(z.string().min(1).max(100)).max(20).optional(),
  noteId: z.string().min(1).max(100).nullable().optional(),
  assessmentId: z.string().min(1).max(100).nullable().optional(),
  title: z.string().trim().min(1).max(200).optional(),
  /** Client-generated id for this tap: a double tap / retry returns the same session instead of a second one. */
  key: z.string().min(6).max(80).optional(),
});

hubInPersonApi.post("/in-person/sessions", async (req, res) => {
  const ctx = await resolveCtx(req, res);
  if (!ctx || !requireEdit(ctx, res)) return;
  const parsed = createBody.safeParse(req.body ?? {});
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues }); return; }
  const b = parsed.data;
  const direct = await eligibleStudents(ctx, b.childIds);
  if (!direct) { res.status(404).json({ error: "Student not found — in-person lessons are for your enrolled students" }); return; }
  const groups = await visibleGroups(ctx, b.groupIds ?? []);
  if (!groups) { res.status(404).json({ error: "Group not found" }); return; }
  const students = [...new Map([...direct, ...(await activeMembers(ctx, groups))].map((e) => [e.childId, e])).values()];
  if (!students.length) { res.status(400).json({ error: "Choose the children who are here, or a group that has students in it" }); return; }
  if (students.length > CLASS_MAX) { res.status(400).json({ error: `An in-person lesson holds up to ${CLASS_MAX} students` }); return; }

  let title = b.title ?? "";
  let noteId: string | null = null;
  let assessmentId: string | null = null;
  if (b.noteId) {
    if (!okId(b.noteId)) { res.status(404).json({ error: "Lesson not found" }); return; }
    const n = await notesCol.doc(b.noteId).get();
    if (!n.exists || n.get("tenantId") !== ctx.tenantId || !canSee(ctx, n.get("franchiseId"))) { res.status(404).json({ error: "Lesson not found" }); return; }
    noteId = n.id;
    title = title || (n.get("title") as string) || "In-person lesson";
  }
  if (b.assessmentId) {
    if (!okId(b.assessmentId)) { res.status(404).json({ error: "Quiz not found" }); return; }
    const a = await assessmentsCol.doc(b.assessmentId).get();
    if (!a.exists || a.get("tenantId") !== ctx.tenantId || !canSee(ctx, a.get("franchiseId"))) { res.status(404).json({ error: "Quiz not found" }); return; }
    assessmentId = a.id;
    title = title || (a.get("title") as string) || "In-person lesson";
  }
  title = title || "In-person lesson";

  const now = nowIso();
  const ref = b.key ? lessonsCol.doc(`ip_${digest(ctx.tenantId, ctx.uid, b.key)}`) : lessonsCol.doc();
  const names = new Map(students.map((s) => [s.childId, s.childName]));
  if (b.key) {
    const existing = await ref.get();
    if (existing.exists && existing.get("tenantId") === ctx.tenantId && existing.get("mode") === "in_person") {
      res.json(sessionOut({ id: ref.id, ...(existing.data() as SessionDoc) }, await namesOf(ctx, existing.get("childIds") as string[]))); return;
    }
  }
  const doc: SessionDoc = {
    tenantId: ctx.tenantId, franchiseId: ctx.franchiseId, mode: "in_person", tutorUid: ctx.uid, tutorName: ctx.name || "Your tutor",
    title, topicId: null, startsAt: now, durationMins: 60, childIds: students.map((s) => s.childId), status: "live",
    roomName: null, roomUrl: null, notes: "", videos: [], noteIds: noteId ? [noteId] : [], groupIds: groups.map((g) => g.id),
    // Everyone the tutor picked is here (that is why they picked them); the tutor untick anyone who isn't.
    attendance: Object.fromEntries(students.map((s) => [s.childId, now])), tutorJoinedAt: now, endedAt: null,
    noteId, assessmentId, createdBy: ctx.uid, createdAt: now, updatedAt: now,
  };
  await ref.set(doc);
  pingHub(ctx.tenantId, "hubLessons");
  res.status(201).json(sessionOut({ id: ref.id, ...doc }, names));
});

hubInPersonApi.get("/in-person/sessions", async (req, res) => {
  const ctx = await resolveCtx(req, res);
  if (!ctx || !requireEdit(ctx, res)) return;
  const status = req.query.status === "live" || req.query.status === "ended" ? req.query.status : null;
  const snap = await lessonsCol.where("tenantId", "==", ctx.tenantId).where("mode", "==", "in_person").get();
  const rows = snap.docs.map((d) => ({ id: d.id, ...(d.data() as SessionDoc) })).filter((s) => canSeeStudent(ctx, s.franchiseId) && s.status !== "cancelled" && (!status || s.status === status))
    .sort((a, b) => b.startsAt.localeCompare(a.startsAt)).slice(0, 20);
  const names = await namesOf(ctx, [...new Set(rows.flatMap((s) => s.childIds))]);
  res.json(rows.map((s) => sessionOut(s, names)));
});

hubInPersonApi.get("/in-person/sessions/:id", async (req, res) => {
  const ctx = await resolveCtx(req, res);
  if (!ctx || !requireEdit(ctx, res)) return;
  const s = await sessionFor(ctx, req.params.id, res, false);
  if (!s) return;
  res.json({ ...sessionOut(s, await namesOf(ctx, s.childIds)), results: await resultsOf(ctx, s.id) });
});

// ── attendance ───────────────────────────────────────────────────────────────

const attendBody = z.object({
  present: z.record(z.string().min(1).max(100), z.boolean()).default({}),
  /** A child who turned up late and wasn't in the picked set: added to the session (and marked present). */
  add: z.array(z.string().min(1).max(100)).max(CLASS_MAX).optional(),
});

hubInPersonApi.put("/in-person/sessions/:id/attendance", async (req, res) => {
  const ctx = await resolveCtx(req, res);
  if (!ctx || !requireEdit(ctx, res)) return;
  const parsed = attendBody.safeParse(req.body ?? {});
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues }); return; }
  const s = await sessionFor(ctx, req.params.id, res, true);
  if (!s) return;
  if (s.status === "cancelled") { res.status(409).json({ error: "This session was cancelled", code: "lesson_closed" }); return; }
  const add = [...new Set(parsed.data.add ?? [])].filter((c) => !s.childIds.includes(c));
  if (add.length) {
    if (s.childIds.length + add.length > CLASS_MAX) { res.status(400).json({ error: `An in-person lesson holds up to ${CLASS_MAX} students` }); return; }
    if (!(await eligibleStudents(ctx, add))) { res.status(404).json({ error: "Student not found — in-person lessons are for your enrolled students" }); return; }
  }
  const known = new Set([...s.childIds, ...add]);
  const now = nowIso();
  const patch: Record<string, unknown> = { updatedAt: now };
  if (add.length) patch.childIds = FieldValue.arrayUnion(...add);
  for (const c of add) patch[`attendance.${c}`] = now;
  for (const [child, here] of Object.entries(parsed.data.present)) {
    if (!known.has(child)) { res.status(404).json({ error: "Student not found" }); return; }
    if (add.includes(child) && here) continue;
    patch[`attendance.${child}`] = here ? (s.attendance?.[child] ?? now) : FieldValue.delete();
  }
  await lessonsCol.doc(s.id).update(patch);
  pingHub(ctx.tenantId, "hubLessons");
  const fresh = { id: s.id, ...((await lessonsCol.doc(s.id).get()).data() as SessionDoc) };
  res.json(sessionOut(fresh, await namesOf(ctx, fresh.childIds)));
});

// ── the paper, as one class sees it ─────────────────────────────────────────

/** A tutor-side view of a question's key (for the "Show answer" toggle) — never sent on the student endpoints. */
const keyOut = (q: { answer: unknown; acceptedAnswers: string[]; explanation: string; mark: string }) => ({
  correctAnswer: q.answer ?? null, ...(q.mark === "exact" && q.acceptedAnswers.length ? { acceptedAnswers: q.acceptedAnswers } : {}), ...(q.explanation ? { explanation: q.explanation } : {}),
});

async function loadPaper(ctx: HubCtx, assessmentId: string, res: Response): Promise<{ asm: AssessmentDoc & { id: string }; qDocs: FirebaseFirestore.DocumentSnapshot[] } | null> {
  const nf = () => { res.status(404).json({ error: "Quiz not found" }); return null; };
  if (!okId(assessmentId)) return nf();
  const snap = await assessmentsCol.doc(assessmentId).get();
  if (!snap.exists) return nf();
  const asm = snap.data() as AssessmentDoc;
  if (asm.tenantId !== ctx.tenantId || !canSee(ctx, asm.franchiseId)) return nf();
  if (asm.published === false) { res.status(409).json({ error: "Publish this before a student sits it", code: "not_published" }); return null; }
  const qDocs = asm.questionIds?.length ? await db.getAll(...asm.questionIds.filter(okId).map((id) => questionsCol.doc(id))) : [];
  return { asm: { ...asm, id: snap.id }, qDocs };
}

hubInPersonApi.get("/in-person/sessions/:id/questions", async (req, res) => {
  const ctx = await resolveCtx(req, res);
  if (!ctx || !requireEdit(ctx, res)) return;
  const s = await sessionFor(ctx, req.params.id, res, false);
  if (!s) return;
  const wanted = asStr(req.query.assessmentId) ?? s.assessmentId ?? null;
  if (!wanted) { res.status(400).json({ error: "Which quiz? Send assessmentId" }); return; }
  const paper = await loadPaper(ctx, wanted, res);
  if (!paper) return;
  const cfg = await hubConfig(ctx.tenantId, s.franchiseId);
  // One snapshot for the whole class (head-office scope), shuffled with a SESSION seed — every child gets the same arrangement,
  // so one projected screen matches everyone's answers. (The seed only changes what is shown; marking reads the canonical key.)
  const questions = snapshotQuestions(ctx.tenantId, paper.asm, cfg, { franchiseId: s.franchiseId }, paper.qDocs).filter((q) => q.mark !== "tool"); // tool questions need each child at a screen — not used when the tutor taps in answers
  const base = imageBase(req);
  res.json({
    assessment: { id: paper.asm.id, title: paper.asm.title, type: paper.asm.type, subject: paper.asm.subject, passMarkPct: paper.asm.passMarkPct },
    questions: questions.map((q) => ({ ...questionOut(q, base, `class:${s.id}`), rule: q.mark, key: keyOut(q) })),
  });
});

// ── hand in for the whole class ─────────────────────────────────────────────

const answerBody = z.object({
  questionId: z.string().min(1).max(100),
  response: z.unknown().optional(),
  /** The tutor's own call ("got it" / "not yet") — for oral or hands-on work that has no typed response. Full marks or none. */
  verdict: z.enum(["right", "wrong"]).optional(),
});
const submitBody = z.object({
  assessmentId: z.string().min(1).max(100),
  children: z.array(z.object({ childId: z.string().min(1).max(100), answers: z.array(answerBody).max(300) })).min(1).max(CLASS_MAX),
  /** Let a child through a retake / placement-test / year-group gate (the tutor is in the room and has decided). */
  override: z.boolean().optional(),
  /** Tick off the child's open homework for this quiz (default on). */
  linkHomework: z.boolean().optional(),
});

/** Refusals a tutor may override. A placement test the child already stands on (`diagnostic_done`) may not be silently doubled:
 *  reset the baseline first (POST /attempts/:id/reset-baseline). */
const OVERRIDABLE = new Set(["retake_blocked", "diagnostic_required", "not_for_this_child"]);

interface Skip { code: string; message: string }

async function gateFor(ctx: HubCtx, child: ChildRef, asm: AssessmentDoc & { id: string }, cfg: Awaited<ReturnType<typeof hubConfig>>): Promise<{ skip: Skip | null; granted: boolean; finished: number }> {
  const name = child.childName || "This student";
  const [diag, mine] = await Promise.all([
    diagnosticState(ctx.tenantId, child.childId),
    attemptsCol.where("tenantId", "==", ctx.tenantId).where("childId", "==", child.childId).select("assessmentId", "status", "submittedAt").get(),
  ]);
  const finished = mine.docs.filter((d) => d.get("assessmentId") === asm.id && d.get("status") !== "in_progress").map((d) => asStr(d.get("submittedAt")));
  const granted = child.retakeGrants.includes(asm.id);
  const out = (skip: Skip | null) => ({ skip, granted, finished: finished.length });
  if (audienceFit(normAudience(asm.audience), await childFacts(child, cfg.yearGroups)) === "no") return out({ code: "not_for_this_child", message: `${asm.title} isn't set for ${name}'s year group or age.` });
  const subjectKey = asm.subject.toLowerCase();
  if (asm.type === "diagnostic" && diag.active.has(subjectKey)) return out({ code: "diagnostic_done", message: `${name} has already taken the ${asm.subject} diagnostic. Reset their baseline first to record another.` });
  if (asm.type === "quiz" && cfg.requireDiagnostic && !diag.taken.has(subjectKey) && !child.waived.includes(subjectKey)) {
    const all = [...(await assessmentRows(ctx.tenantId)).values()];
    const facts = await childFacts(child, cfg.yearGroups);
    if (all.some((x) => x.type === "diagnostic" && x.published !== false && x.subject.toLowerCase() === subjectKey && fitsChild(x.franchiseId, child) && audienceFit(normAudience(x.audience), facts) !== "no")) {
      return out({ code: "diagnostic_required", message: `${name} needs to take the ${asm.subject} diagnostic first.` });
    }
  }
  const rule = effectiveRetake(asm, cfg);
  const again = retakeDecision({ policy: rule.policy, cooldownHours: rule.cooldownHours, finishedAt: finished, granted });
  if (!again.allowed) return out({ code: "retake_blocked", message: again.reason === "once" ? `${name} has already taken this.` : `${name} can take this again later.` });
  return out(null);
}

/** The child's own open homework for this quiz (one assigned submission), so the in-person result ticks it off. */
async function openHomeworkFor(ctx: HubCtx, childId: string, assessmentId: string): Promise<string | null> {
  const hws = await homeworkCol.where("tenantId", "==", ctx.tenantId).where("assessmentId", "==", assessmentId).get();
  const mine = hws.docs.filter((h) => ((h.get("assignedChildIds") as string[] | undefined) ?? []).includes(childId)).sort((a, b) => String(a.get("dueAt") ?? "").localeCompare(String(b.get("dueAt") ?? "")));
  for (const h of mine) {
    const sub = await submissionsCol.doc(`${h.id}__${childId}`).get();
    if (sub.exists && sub.get("tenantId") === ctx.tenantId && sub.get("status") === "assigned") return h.id;
  }
  return null;
}

hubInPersonApi.post("/in-person/sessions/:id/submit", async (req, res) => {
  const ctx = await resolveCtx(req, res);
  if (!ctx || !requireEdit(ctx, res)) return;
  const parsed = submitBody.safeParse(req.body ?? {});
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues }); return; }
  const s = await sessionFor(ctx, req.params.id, res, true);
  if (!s) return;
  if (s.status === "cancelled") { res.status(409).json({ error: "This session was cancelled", code: "lesson_closed" }); return; }
  const b = parsed.data;
  const paper = await loadPaper(ctx, b.assessmentId, res);
  if (!paper) return;
  const { asm, qDocs } = paper;
  const cfg = await hubConfig(ctx.tenantId, s.franchiseId);
  const inSession = new Set(s.childIds);
  const now = nowIso();
  const attendancePatch: Record<string, unknown> = {};

  type Row = { childId: string; childName: string; status: "recorded" | "duplicate" | "skipped"; attemptId?: string; code?: string; message?: string;
    attemptStatus?: string; scoreMarks?: number; maxMarks?: number; pct?: number | null; passed?: boolean | null; homeworkId?: string | null; answers?: { questionId: string; correct: boolean | null; marksAwarded: number; marksMax: number; pending: boolean }[] };
  const rows: Row[] = [];
  const seen = new Set<string>();
  const recorded: { child: ChildRef; attemptId: string; a: AttemptDoc }[] = [];

  for (const entry of b.children) {
    if (seen.has(entry.childId)) continue; // one row per child per hand-in
    seen.add(entry.childId);
    // Not in THIS session, or not this tutor's active student: never recorded — and never confirmed to exist.
    const child = inSession.has(entry.childId) ? await childRefFor(ctx, entry.childId, { needActive: true }) : null;
    if (!child) { rows.push({ childId: entry.childId, childName: "", status: "skipped", code: "not_in_session", message: "That student isn't part of this session." }); continue; }
    if (!childSubjectOk(child, asm.subject) || !fitsChild(asm.franchiseId, child)) { rows.push({ childId: child.childId, childName: child.childName, status: "skipped", code: "not_for_this_child", message: `${asm.title} isn't available for ${child.childName || "this student"}.` }); continue; }

    // Idempotent: the attempt's id is fixed by (session, quiz, child), so a retry / double tap can't record it twice.
    const attemptId = `ip_${digest(s.id, asm.id, child.childId)}`;
    const ref = attemptsCol.doc(attemptId);
    const prior = await ref.get();
    if (prior.exists) {
      const a = prior.data() as AttemptDoc;
      if (a.tenantId === ctx.tenantId) {
        rows.push({ childId: child.childId, childName: child.childName, status: "duplicate", attemptId, attemptStatus: a.status, scoreMarks: a.scoreMarks, maxMarks: a.maxMarks, pct: a.pct, passed: a.status === "marked" ? (a.pct ?? 0) >= a.passMarkPct : null, homeworkId: a.homeworkId, answers: a.answers.map((x) => ({ questionId: x.questionId, correct: x.correct, marksAwarded: x.marksAwarded, marksMax: x.marksMax, pending: x.pending === true })) });
        continue;
      }
    }

    const gate = await gateFor(ctx, child, asm, cfg);
    if (gate.skip && !(b.override && OVERRIDABLE.has(gate.skip.code))) { rows.push({ childId: child.childId, childName: child.childName, status: "skipped", code: gate.skip.code, message: gate.skip.message }); continue; }

    const questions = snapshotQuestions(ctx.tenantId, asm, cfg, child, qDocs).filter((q) => q.mark !== "tool");
    if (!questions.length) { rows.push({ childId: child.childId, childName: child.childName, status: "skipped", code: "no_questions", message: "This has no questions yet." }); continue; }
    const given = new Map(entry.answers.map((x) => [x.questionId, x] as const));
    let judged = false;
    const answers: AnswerDoc[] = questions.map((q) => {
      const g = given.get(q.id);
      if (g?.verdict) {
        judged = true;
        const r = applyManualMark(q.marks, g.verdict === "right" ? q.marks : 0);
        return { questionId: q.id, topicId: q.topicId, response: g.response === undefined ? null : cleanResponse(g.response) ?? null, correct: r.correct, marksAwarded: r.marksAwarded, marksMax: q.marks, feedback: "", pending: false };
      }
      const response = g?.response === undefined ? null : cleanResponse(g.response);
      const o = markResponse({ mark: q.mark, answer: q.answer, acceptedAnswers: q.acceptedAnswers, tolerance: q.tolerance, marks: q.marks }, response);
      return { questionId: q.id, topicId: q.topicId, response: response ?? null, correct: o.correct, marksAwarded: o.marksAwarded, marksMax: q.marks, feedback: "", pending: o.pending };
    });
    const score = scoreAttempt(answers as ScoredAnswer[], asm.passMarkPct);
    let homeworkId: string | null = null;
    if (b.linkHomework !== false) homeworkId = await openHomeworkFor(ctx, child.childId, asm.id).catch(() => null);

    const doc: AttemptDoc = {
      tenantId: ctx.tenantId, franchiseId: child.franchiseId, assessmentId: asm.id, assessmentType: asm.type, assessmentTitle: asm.title, subject: asm.subject,
      passMarkPct: asm.passMarkPct, homeworkId, childId: child.childId, childName: child.childName, parentUid: child.parentUid, startedBy: ctx.uid, submittedBy: ctx.uid,
      startedAt: now, submittedAt: now, timeLimitMins: null, late: false, status: score.status, questions, answers,
      scoreMarks: score.scoreMarks, maxMarks: score.maxMarks, pct: score.pct, byTopic: score.byTopic,
      markedBy: score.status === "marked" ? (judged ? ctx.uid : "auto") : null, markedAt: score.status === "marked" ? now : null, baselineReset: false,
      ...splitOf({ questions, answers }), mode: "in_person", sessionId: s.id, createdBy: ctx.uid, createdAt: now, updatedAt: now,
    };
    try { await ref.create(doc); }
    catch (e) {
      if ((e as { code?: number }).code === 6) { rows.push({ childId: child.childId, childName: child.childName, status: "duplicate", attemptId }); continue; } // a parallel retry got there first
      throw e;
    }
    if (gate.granted && gate.finished) await hubEnrolments.doc(enrolmentId(ctx.tenantId, child.childId)).update({ retakeGrants: FieldValue.arrayRemove(asm.id) }).catch(() => {});
    void pinAttemptImages(ctx.tenantId, questions.flatMap((q) => questionImageIds(q)));
    if (!s.attendance?.[child.childId]) attendancePatch[`attendance.${child.childId}`] = now; // they sat it, so they were here
    if (homeworkId) {
      // The child did this homework's quiz: hand it in for them (the result is attached; the tutor marks it like any other hand-in).
      await submissionsCol.doc(`${homeworkId}__${child.childId}`).update({ status: "submitted", attemptId, text: "", submittedAt: now, updatedAt: now }).catch(() => {});
      pingHub(ctx.tenantId, "hubSubmissions");
    }
    recorded.push({ child, attemptId, a: doc });
    rows.push({ childId: child.childId, childName: child.childName, status: "recorded", attemptId, attemptStatus: doc.status, scoreMarks: doc.scoreMarks, maxMarks: doc.maxMarks, pct: doc.pct, passed: score.passed, homeworkId,
      answers: answers.map((x) => ({ questionId: x.questionId, correct: x.correct, marksAwarded: x.marksAwarded, marksMax: x.marksMax, pending: x.pending })) });
  }

  if (Object.keys(attendancePatch).length) await lessonsCol.doc(s.id).update({ ...attendancePatch, updatedAt: now });
  for (const r of recorded) await refreshMastery(r.a);
  if (recorded.length) pingHub(ctx.tenantId, "hubAttempts", "hubLessons");
  // Tell each family (one notice per child, so the score is unambiguous): the bell always, the email unless they muted "learning".
  for (const r of recorded) {
    const shown = r.a.status === "marked" ? `${r.a.scoreMarks}/${r.a.maxMarks} (${r.a.pct}%)` : `${r.a.scoreMarks}/${r.a.maxMarks} so far — written answers still to be marked`;
    void notifyFamilies({
      tenantId: ctx.tenantId, childIds: [r.child.childId], ref: r.attemptId,
      compose: (n) => ({ title: "Lesson done with your tutor", body: `${nameList(n)} did "${asm.title}" in person with ${s.tutorName}: ${shown}. The result is in My Classroom.` }),
    });
  }
  res.json({ sessionId: s.id, assessmentId: asm.id, results: rows });
});

// ── end ──────────────────────────────────────────────────────────────────────

const endBody = z.object({
  warmup: z.array(z.object({ childId: z.string().min(1).max(100), correct: z.number().int().min(0).max(200), total: z.number().int().min(0).max(200) })).max(CLASS_MAX).optional(),
});

hubInPersonApi.post("/in-person/sessions/:id/end", async (req, res) => {
  const ctx = await resolveCtx(req, res);
  if (!ctx || !requireEdit(ctx, res)) return;
  const parsed = endBody.safeParse(req.body ?? {});
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues }); return; }
  const s = await sessionFor(ctx, req.params.id, res, true);
  if (!s) return;
  if (s.status === "cancelled") { res.status(409).json({ error: "This session was cancelled", code: "lesson_closed" }); return; }
  let cur = s;
  if (s.status !== "ended") {
    const now = nowIso();
    const warmup = (parsed.data.warmup ?? []).filter((w) => s.childIds.includes(w.childId) && w.correct <= w.total);
    await lessonsCol.doc(s.id).update({ status: "ended", endedAt: now, updatedAt: now, ...(warmup.length ? { warmup } : {}) });
    cur = { ...s, status: "ended", endedAt: now, ...(warmup.length ? { warmup } : {}) };
    pingHub(ctx.tenantId, "hubLessons");
    // Children who were here but have no quiz result (they got their own notice): tell their families they had a lesson with the tutor.
    const withResult = new Set((await resultsOf(ctx, s.id)).map((r) => r.childId));
    const attended = s.childIds.filter((c) => !!s.attendance?.[c] && !withResult.has(c));
    for (const c of attended) {
      void notifyFamilies({
        tenantId: ctx.tenantId, childIds: [c], ref: s.id,
        compose: (n) => ({ title: "Lesson done with your tutor", body: `${nameList(n)} completed the lesson "${s.title}" in person with ${s.tutorName}.` }),
      });
    }
  }
  res.json({ ...sessionOut(cur, await namesOf(ctx, cur.childIds)), results: await resultsOf(ctx, s.id) });
});
