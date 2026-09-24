import { Router, type Response } from "express";
import { effectiveLimitMins } from "../../../../features/learninghub/support";
import { cleanToolAnswer, isBlankToolAnswer, isGenerator, publicProblem, PROBLEM_GENERATORS } from "../../../../features/learninghub/tools/problems";
import { z } from "zod";
import { db } from "../../firebase";
import { FieldValue } from "firebase-admin/firestore";
import { canSee, canSeeStudent, canWriteRow, hubConfig, hubEnrolments, okId, requireEdit, resolveCtx, type HubCtx } from "../../lib/hubCore";
import { applyManualMark, autoSplit, inferRule, markResponse, revealAllowed, scoreAttempt, type ScoredAnswer } from "../../lib/hubScoring";
import { audienceFit, effectiveRetake, failStreak, normAudience, retakeDecision } from "../../lib/hubRules";
import { cleanKindResponse, presentMatch, presentOrder, type Pair } from "../../lib/hubKinds";
import { imageBase, pictureOf, pinAttemptImages, questionImageIds } from "../../lib/hubMedia";
import type { HubSettings } from "../../../../lib/hubConfig";
import { diagnosticState } from "./assessments";
import { assessmentRows } from "../../lib/hubIndex";
import { pingHub } from "../../lib/hubPing";
import { nameList, notifyFamilies } from "../../lib/hubNotify";
import { recomputeChildMastery } from "./mastery";
import {
  ATTEMPT_LITE_FIELDS, assessmentsCol, asStr, attemptsCol, childFacts, childFor, childSubjectOk, enrolmentId, fitsChild, homeworkCol, nowIso, questionsCol,
  requestedChild, type AnswerDoc, type AssessmentDoc, type AttemptDoc, type ChildRef, type QuestionDoc, type QuestionSnap,
} from "./shared";

// Learning Hub — attempts. A child sits an assessment; the SERVER marks it
// (lib/hubScoring.ts) and rolls the result into mastery. The rules that matter:
//  • the key never leaves the server inside a running attempt, and reaches a
//    family only when settings.hub.revealAnswers allows (`revealFor`);
//  • an attempt snapshots each question (topic, marks, key) when it starts, so a
//    later edit to the bank can't rewrite a child's history;
//  • only the child's parent — or a tutor on their behalf — may start/submit one.

export const hubAttemptsApi = Router();

const GRACE_MS = 2 * 60_000; // a slow connection isn't punished for the time limit

class Refusal extends Error {
  constructor(public status: number, public body: Record<string, unknown>) { super(String(body.error ?? "refused")); }
}
const refuse = (res: Response, e: unknown) => {
  if (e instanceof Refusal) { res.status(e.status).json(e.body); return true; }
  return false;
};

// ── output shapes ────────────────────────────────────────────────────────────

/** Pictures leave the server only as short-lived signed links (lib/signing.ts), never as bare ids. */
const pictureOut = (base: string, q: QuestionSnap) => pictureOf(base, q.image);
const optionsOut = (base: string, q: QuestionSnap) => q.options.map((o) => ({ id: o.id, text: o.text, ...(pictureOf(base, o.image) ? { image: { url: pictureOf(base, o.image)!.url } } : {}) }));

/** A question as a student sees it while sitting the assessment — never the key. A match question sends its terms as
 *  written and its definitions SHUFFLED; an order question sends its items shuffled. The shuffle is seeded by the attempt
 *  and question ids, so a refresh / resume shows the same arrangement, and nothing here says what goes with what. */
export const questionOut = (q: QuestionSnap, base: string, attemptId: string) => ({
  id: q.id, kind: q.kind, prompt: q.prompt, marks: q.marks, topicId: q.topicId, image: pictureOut(base, q),
  ...(q.mark === "choice" || q.mark === "multi" ? { options: optionsOut(base, q) } : {}),
  ...(q.mark === "match" && Array.isArray(q.answer) ? presentMatch(q.answer as Pair[], `${attemptId}:${q.id}`) : {}),
  ...(q.mark === "order" && Array.isArray(q.answer) ? { items: presentOrder(q.answer as string[], `${attemptId}:${q.id}`) } : {}),
  // A tool question: the problem this attempt was dealt, WITHOUT its model answer or checker (those are re-generated from the seed only when marking).
  ...(q.mark === "tool" && q.tool && isGenerator(q.tool.generatorId) ? { toolProblem: publicProblem(PROBLEM_GENERATORS[q.tool.generatorId]!(q.tool.seed)) } : {}),
});

const passedOf = (a: Pick<AttemptDoc, "status" | "pct" | "passMarkPct">) => (a.status === "marked" ? (a.pct ?? 0) >= a.passMarkPct : null);

type Summarised = Pick<AttemptDoc, "assessmentId" | "assessmentType" | "assessmentTitle" | "subject" | "homeworkId" | "childId" | "childName" | "status" | "scoreMarks" | "maxMarks" | "pct" | "passMarkPct" | "startedAt" | "submittedAt" | "timeLimitMins" | "franchiseId" | "mode"> & { autoMarks?: number; autoMax?: number; writtenPending?: number };
export const summaryOut = (id: string, a: Summarised) => ({
  id, assessmentId: a.assessmentId, assessmentType: a.assessmentType, assessmentTitle: a.assessmentTitle ?? "", subject: a.subject ?? "",
  homeworkId: a.homeworkId ?? null, inPerson: a.mode === "in_person", childId: a.childId, childName: a.childName ?? "", status: a.status,
  scoreMarks: a.scoreMarks ?? 0, maxMarks: a.maxMarks ?? 0, pct: a.pct ?? null, passed: passedOf(a), passMarkPct: a.passMarkPct,
  startedAt: a.startedAt, submittedAt: a.submittedAt ?? null, timeLimitMins: a.timeLimitMins ?? null,
  // Self-marked vs written: "Auto-marked 5/6 · 1 written answer being reviewed" (a paper with an auto score is never a bare "awaiting marking").
  autoMarks: a.autoMarks ?? 0, autoMax: a.autoMax ?? 0, writtenPending: a.writtenPending ?? 0, awaitingWritten: (a.writtenPending ?? 0) > 0,
});

/** The auto/written split of a full attempt, from its snapshot + answers. */
export const splitOf = (a: Pick<AttemptDoc, "questions" | "answers">) => autoSplit(a.answers ?? [], new Map((a.questions ?? []).map((q) => [q.id, q.mark] as const)));

/** Whole result. `detail` adds the prompts (GET /attempts/:id). Answer keys +
 *  explanations are included only when `reveal` — tutors always, families per
 *  settings.hub.revealAnswers, nobody while the attempt is running. */
function resultOut(id: string, a: AttemptDoc, cfg: HubSettings, canEdit: boolean, detail: boolean, imgBase: string, pastPass = false) {
  const base = { ...summaryOut(id, { ...a, ...splitOf(a) }) };
  if (a.status === "in_progress") {
    return { ...base, questions: (a.questions ?? []).map((q) => questionOut(q, imgBase, id)), answers: [] as unknown[] };
  }
  // "after_pass": the key + explanations open once THIS attempt reached the pass mark, or the child has already passed this quiz (they have seen it).
  const passed = passedOf(a) === true || pastPass;
  const reveal = canEdit || revealAllowed(cfg.revealAnswers, a.status, passed);
  const snaps = new Map((a.questions ?? []).map((q) => [q.id, q] as const));
  const answers = (a.answers ?? []).map((x) => {
    const q = snaps.get(x.questionId);
    return {
      questionId: x.questionId, correct: x.correct, marksAwarded: x.marksAwarded, marksMax: x.marksMax, response: x.response ?? null,
      ...(x.feedback ? { feedback: x.feedback } : {}),
      // A tool question's auto-checker lines ("✗ Perpendicular — 4° off square") only when answers may be shown, like the key itself.
      ...(reveal && x.checkerFeedback?.length ? { checkerFeedback: x.checkerFeedback } : {}),
      ...(canEdit ? { pending: x.pending === true } : {}),
      ...(detail && q ? { topicId: q.topicId, kind: q.kind, prompt: q.prompt, image: pictureOut(imgBase, q), ...(q.mark === "choice" || q.mark === "multi" ? { options: optionsOut(imgBase, q) } : {}), ...(q.mark === "tool" && q.tool && isGenerator(q.tool.generatorId) ? { toolProblem: publicProblem(PROBLEM_GENERATORS[q.tool.generatorId]!(q.tool.seed)) } : {}) } : {}),
      ...(reveal && q ? { correctAnswer: q.answer ?? null, ...(q.mark === "exact" && q.acceptedAnswers.length ? { acceptedAnswers: q.acceptedAnswers } : {}), ...(q.explanation ? { explanation: q.explanation } : {}) } : {}),
    };
  });
  // `keyHeld`: the answers exist but are being kept back (say WHY: the child sees "pass to unlock" rather than a silent gap). Never sent to a tutor.
  const keyHeld = !reveal && cfg.revealAnswers === "after_pass" && a.status === "marked";
  return { ...base, byTopic: a.byTopic ?? {}, late: a.late === true, markedAt: a.markedAt ?? null, ...(keyHeld ? { keyHeld: true } : {}), answers };
}

/** Has this child ever passed this assessment (a marked attempt at or above its pass mark)? Only asked when "after_pass" is holding a key back. */
async function passedBefore(a: Pick<AttemptDoc, "tenantId" | "childId" | "assessmentId">): Promise<boolean> {
  const snap = await attemptsCol.where("tenantId", "==", a.tenantId).where("childId", "==", a.childId).select("assessmentId", "status", "pct", "passMarkPct").get();
  return snap.docs.some((d) => d.get("assessmentId") === a.assessmentId && d.get("status") === "marked" && (d.get("pct") as number ?? 0) >= (d.get("passMarkPct") as number ?? 101));
}
const needsPastPass = (cfg: HubSettings, a: AttemptDoc, canEdit: boolean) => !canEdit && cfg.revealAnswers === "after_pass" && a.status === "marked" && passedOf(a) !== true;

/** The attempt at `id`, if THIS caller may act on it: same tenant, in their franchise
 *  scope, and — for a family — their own child's. Anything else is a 404. */
async function loadAttempt(ctx: HubCtx, id: string, res: Response) {
  if (!okId(id)) { res.status(404).json({ error: "Attempt not found" }); return null; }
  const snap = await attemptsCol.doc(id).get();
  if (!snap.exists) { res.status(404).json({ error: "Attempt not found" }); return null; }
  const a = snap.data() as AttemptDoc;
  const mine = a.tenantId === ctx.tenantId && canSeeStudent(ctx, a.franchiseId)
    && (ctx.role !== "parent" || (a.parentUid === ctx.uid && ctx.children.some((c) => c.childId === a.childId) && (!ctx.childId || ctx.childId === a.childId)));
  if (!mine) { res.status(404).json({ error: "Attempt not found" }); return null; }
  return { ref: snap.ref, id: snap.id, a };
}

/** Mastery is derived; a failed rebuild must not fail the submit (it is rebuilt on the next one, or by POST /mastery/recompute). */
export async function refreshMastery(a: Pick<AttemptDoc, "tenantId" | "childId" | "franchiseId">) {
  try { await recomputeChildMastery(a.tenantId, a.childId, a.franchiseId ?? null); }
  catch (e) { console.error("[hub] mastery recompute failed:", (e as Error).message); }
}

/** The frozen copy of an assessment's questions for one child: published, this tenant's, in the child's franchise scope,
 *  in the assessment's own order (match / order keep their key in `answer`). Shared by a family's start and a tutor's in-person hand-in. */
export function snapshotQuestions(tenantId: string, asm: AssessmentDoc, cfg: HubSettings, child: { franchiseId: string | null }, qSnaps: FirebaseFirestore.DocumentSnapshot[]): QuestionSnap[] {
  const questions: QuestionSnap[] = [];
  for (const s of qSnaps) {
    if (!s.exists) continue;
    const q = s.data() as QuestionDoc;
    if (q.tenantId !== tenantId || q.published === false || !fitsChild(q.franchiseId, child)) continue;
    const mark = cfg.questionKinds.find((k) => k.id === q.kind)?.mark ?? inferRule(q);
    questions.push({
      id: s.id, topicId: q.topicId, kind: q.kind, mark, prompt: q.prompt, options: q.options ?? [], marks: q.marks,
      // match / order keep their key in `pairs` / `items`; the snapshot's `answer` carries it so marking and the reveal read one place.
      answer: mark === "match" ? q.pairs ?? null : mark === "order" ? q.items ?? null : q.answer ?? null,
      acceptedAnswers: q.acceptedAnswers ?? [], tolerance: q.tolerance ?? 0, explanation: q.explanation ?? "",
      // Tool question: a fixed seed if the tutor pinned one, else a fresh random one — stored on the attempt so a refresh shows the same problem and marking replays it.
      ...(mark === "tool" && q.tool && isGenerator(q.tool.generatorId) ? { tool: { generatorId: q.tool.generatorId, seed: q.tool.seed || 1 + Math.floor(Math.random() * 4294967294), ...(q.tool.tol ? { tol: q.tool.tol } : {}) } } : {}),
      ...(q.image?.id ? { image: { id: q.image.id, alt: q.image.alt ?? "" } } : q.image?.url ? { image: { id: "", url: q.image.url, alt: q.image.alt ?? "" } } : {}),
    });
  }
  // Keep the assessment's own order.
  const order = new Map(asm.questionIds.map((id, i) => [id, i] as const));
  questions.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
  return questions;
}

// ── start ────────────────────────────────────────────────────────────────────

const startBody = z.object({ childId: z.string().min(1).max(100).optional(), homeworkId: z.string().min(1).max(100).nullable().optional() });

// POST /assessments/:id/attempts — a family passes ?childId=; a tutor may start
// one on a student's behalf via body.childId. Resumes a still-running attempt.
hubAttemptsApi.post("/assessments/:id/attempts", async (req, res) => {
  const ctx = await resolveCtx(req, res);
  if (!ctx) return;
  const parsed = startBody.safeParse(req.body ?? {});
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues }); return; }
  const wantedChild = ctx.role === "parent" ? ctx.childId : parsed.data.childId ?? null;
  if (!wantedChild) { res.status(400).json({ error: ctx.role === "parent" ? "Which student? Pass ?childId=" : "Which student? Send childId" }); return; }
  const child = await childFor(ctx, wantedChild, res, { needActive: true });
  if (!child) return;

  const notFound = () => { res.status(404).json({ error: "Assessment not found" }); return null; };
  if (!okId(req.params.id)) { notFound(); return; }
  const aSnap = await assessmentsCol.doc(req.params.id).get();
  if (!aSnap.exists) { notFound(); return; }
  const asm = aSnap.data() as AssessmentDoc;
  if (asm.tenantId !== ctx.tenantId || !canSee(ctx, asm.franchiseId) || !fitsChild(asm.franchiseId, child) || !childSubjectOk(child, asm.subject)) { notFound(); return; }
  // Drafts are for tutors to build; nobody sits one, tutor or not.
  if (asm.published === false) {
    if (ctx.role === "parent") { notFound(); return; }
    res.status(409).json({ error: "Publish this before a student sits it", code: "not_published" });
    return;
  }

  // The independent reads a start needs are issued together (they were four sequential round trips). The checks below still
  // run in the same order, so which refusal wins is unchanged; a promise nobody ends up awaiting just settles quietly.
  const quiet = <T,>(p: Promise<T>) => { p.catch(() => undefined); return p; };
  const pre = {
    diag: quiet(diagnosticState(ctx.tenantId, child.childId)),
    running: quiet(attemptsCol.where("tenantId", "==", ctx.tenantId).where("childId", "==", child.childId).select("assessmentId", "status", "startedAt", "homeworkId", "timeLimitMins", "submittedAt", "pct", "passMarkPct").get()),
    qs: quiet(asm.questionIds?.length ? db.getAll(...asm.questionIds.filter(okId).map((id) => questionsCol.doc(id))) : Promise.resolve([] as FirebaseFirestore.DocumentSnapshot[])),
  };
  const cfg = await hubConfig(ctx.tenantId, child.franchiseId);
  // Who is this for? A year group / age the child doesn't fit is a refusal; a child whose year or age is
  // simply unknown is let in (the tutor said "unknown", we never silently lock anyone out).
  if (audienceFit(normAudience(asm.audience), await childFacts(child, cfg.yearGroups)) === "no") {
    res.status(409).json({ error: `${asm.title} isn't set for ${child.childName || "this student"}'s year group or age.`, code: "not_for_this_child" });
    return;
  }
  const subjectKey = asm.subject.toLowerCase();
  const diag = await pre.diag;
  if (asm.type === "diagnostic" && diag.active.has(subjectKey)) {
    res.status(409).json({ error: `${child.childName || "This student"} has already taken the ${asm.subject} diagnostic. Ask your tutor if you need to retake it.`, code: "diagnostic_done" });
    return;
  }
  if (asm.type === "quiz" && cfg.requireDiagnostic && !diag.taken.has(subjectKey) && !child.waived.includes(subjectKey)) {
    // Only bites when a diagnostic actually exists for the subject — otherwise nobody could ever unlock the quizzes.
    // (and only a placement test that is FOR this child counts — several may exist per subject, one per audience).
    const all = [...(await assessmentRows(ctx.tenantId)).values()]; // cached rows — was a read of every assessment per quiz start
    const facts = await childFacts(child, cfg.yearGroups);
    const hasDiag = all.some((x) => {
      return x.type === "diagnostic" && x.published !== false && x.subject.toLowerCase() === subjectKey && fitsChild(x.franchiseId, child) && audienceFit(normAudience(x.audience), facts) !== "no";
    });
    if (hasDiag) { res.status(409).json({ error: `Take the ${asm.subject} diagnostic first`, code: "diagnostic_required", subject: asm.subject }); return; }
  }

  // Homework link (when given) must be this tenant's, for this child and quiz.
  let homeworkId: string | null = null;
  if (parsed.data.homeworkId) {
    const h = await homeworkCol.doc(parsed.data.homeworkId).get();
    const assigned = h.get("assignedChildIds") as string[] | undefined;
    if (!h.exists || h.get("tenantId") !== ctx.tenantId || (Array.isArray(assigned) && !assigned.includes(child.childId)) || (h.get("assessmentId") && h.get("assessmentId") !== aSnap.id)) {
      res.status(404).json({ error: "Homework not found" });
      return;
    }
    homeworkId = h.id;
  }

  // A still-running attempt is resumed; one past its time limit is discarded (it has no result).
  const running = await pre.running;
  const imgBase = imageBase(req);
  for (const d of running.docs) {
    if (d.get("status") !== "in_progress" || d.get("assessmentId") !== aSnap.id || (asStr(d.get("homeworkId")) ?? null) !== homeworkId) continue;
    const lim = d.get("timeLimitMins") as number | null;
    const expired = lim && Date.now() > Date.parse(d.get("startedAt") as string) + lim * 60_000 + GRACE_MS;
    if (expired) { await d.ref.delete(); continue; }
    const full = (await d.ref.get()).data() as AttemptDoc;
    // The answers-so-far the child's device saved (PUT /attempts/:id/draft), so a resume on another device / a cleared browser picks up where they left off.
    res.json({ attemptId: d.id, resumed: true, assessmentTitle: full.assessmentTitle, assessmentType: full.assessmentType, timeLimitMins: full.timeLimitMins, startedAt: full.startedAt, questions: full.questions.map((q) => questionOut(q, imgBase, d.id)), ...(full.draft ? { draft: { answers: full.draft.answers, idx: full.draft.idx, savedAt: full.draft.savedAt } } : {}) });
    return;
  }

  // Retakes: a child who has already FINISHED this is held to the retake policy (the assessment's own,
  // else the tutor's default) unless the tutor allowed one more. A running attempt was resumed above.
  const finished = running.docs.filter((d) => d.get("assessmentId") === aSnap.id && d.get("status") !== "in_progress").map((d) => asStr(d.get("submittedAt")));
  const granted = child.retakeGrants.includes(aSnap.id);
  const rule = effectiveRetake(asm, cfg);
  const streak = failStreak(running.docs.filter((d) => d.get("assessmentId") === aSnap.id).map((d) => ({ status: d.get("status") as string, pct: (d.get("pct") as number | null) ?? null, passMarkPct: (d.get("passMarkPct") as number) ?? asm.passMarkPct, submittedAt: asStr(d.get("submittedAt")) })));
  const again = retakeDecision({ policy: rule.policy, cooldownHours: rule.cooldownHours, finishedAt: finished, granted, streak, breakAfter: cfg.retakeBreakAfter, breakMinutes: cfg.retakeBreakMinutes });
  if (!again.allowed) {
    const when = again.nextAvailableAt ? new Date(again.nextAvailableAt).toLocaleString("en-GB", { timeZone: "Europe/London", weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "";
    res.status(409).json({
      error: again.reason === "once" ? "This has already been taken. Ask your tutor if you'd like another go." : again.reason === "break" ? "Take a short break and go back over the lesson, then have another go." : `You can take this again from ${when}.`,
      code: "retake_blocked", reason: again.reason, nextAvailableAt: again.nextAvailableAt,
    });
    return;
  }

  // Snapshot the questions: published, this tenant's, in the child's franchise scope.
  const questions = snapshotQuestions(ctx.tenantId, asm, cfg, child, await pre.qs);
  if (!questions.length) { res.status(409).json({ error: "This has no questions yet", code: "no_questions" }); return; }

  const now = nowIso();
  const doc: AttemptDoc = {
    tenantId: ctx.tenantId, franchiseId: child.franchiseId, assessmentId: aSnap.id, assessmentType: asm.type, assessmentTitle: asm.title, subject: asm.subject,
    passMarkPct: asm.passMarkPct, homeworkId, childId: child.childId, childName: child.childName, parentUid: child.parentUid, startedBy: ctx.uid, submittedBy: null,
    startedAt: now, submittedAt: null, timeLimitMins: effectiveLimitMins(asm.timeLimitMins, child.support), late: false, status: "in_progress", // R-5: noTimer -> untimed; extra time scales the limit (the server-side deadline + lateness use this snapshot)
    questions,
    answers: questions.map((q) => ({ questionId: q.id, topicId: q.topicId, response: null, correct: null, marksAwarded: 0, marksMax: q.marks, feedback: "", pending: false })),
    scoreMarks: 0, maxMarks: questions.reduce((n, q) => n + q.marks, 0), pct: null, byTopic: {}, markedBy: null, markedAt: null, baselineReset: false,
    autoMarks: 0, autoMax: questions.filter((q) => q.mark !== "manual").reduce((n, q) => n + q.marks, 0), writtenPending: 0,
    createdBy: ctx.uid, createdAt: now, updatedAt: now,
  };
  const ref = await attemptsCol.add(doc);
  pingHub(ctx.tenantId, "hubAttempts");
  // The tutor's one-more-go is spent by starting it; the snapshot now owns its pictures (they outlive an edit of the question).
  if (granted && finished.length) await hubEnrolments.doc(enrolmentId(ctx.tenantId, child.childId)).update({ retakeGrants: FieldValue.arrayRemove(aSnap.id) }).catch(() => {});
  void pinAttemptImages(ctx.tenantId, questions.flatMap((q) => questionImageIds(q)));
  res.status(201).json({ attemptId: ref.id, resumed: false, assessmentTitle: doc.assessmentTitle, assessmentType: doc.assessmentType, timeLimitMins: doc.timeLimitMins, startedAt: now, questions: questions.map((q) => questionOut(q, imgBase, ref.id)) });
});

// ── submit ───────────────────────────────────────────────────────────────────

/** Keep only a plausible response: text, a number, a list of option ids, a match/order arrangement, or nothing. */
export function cleanResponse(r: unknown): unknown {
  const kindResp = cleanKindResponse(r); // match {kind, pairs} / order {kind, items}
  if (kindResp !== undefined) return kindResp;
  // tool {kind:"tool", number?, marks?, points?}: sanitised and size-capped (lib: features/learninghub/tools/problems.ts)
  if (r && typeof r === "object" && !Array.isArray(r) && (r as { kind?: unknown }).kind === "tool") { const a = cleanToolAnswer(r); return isBlankToolAnswer(a) ? null : { kind: "tool", ...a }; }
  if (typeof r === "string") return r.slice(0, 10_000);
  if (typeof r === "number") return Number.isFinite(r) ? r : null;
  if (Array.isArray(r)) return r.filter((x): x is string => typeof x === "string").slice(0, 50).map((x) => x.slice(0, 200));
  return null;
}

const submitBody = z.object({
  answers: z.array(z.object({ questionId: z.string().min(1).max(100), response: z.unknown() })).max(300),
});

hubAttemptsApi.post("/attempts/:id/submit", async (req, res) => {
  const ctx = await resolveCtx(req, res);
  if (!ctx) return;
  const parsed = submitBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues }); return; }
  const found = await loadAttempt(ctx, req.params.id, res);
  if (!found) return;
  const given = new Map<string, unknown>();
  for (const x of parsed.data.answers) given.set(x.questionId, cleanResponse(x.response));

  let saved: AttemptDoc;
  try {
    saved = await db.runTransaction(async (tx) => {
      const s = await tx.get(found.ref);
      const a = s.data() as AttemptDoc;
      if (a.status !== "in_progress") throw new Refusal(409, { error: "This has already been submitted", code: "already_submitted" });
      const known = new Set(a.questions.map((q) => q.id));
      for (const qid of given.keys()) if (!known.has(qid)) throw new Refusal(400, { error: "That answer doesn't belong to this attempt" });
      const now = nowIso();
      const answers: AnswerDoc[] = a.questions.map((q) => {
        const response = given.has(q.id) ? given.get(q.id) : null;
        const o = markResponse({ mark: q.mark, answer: q.answer, acceptedAnswers: q.acceptedAnswers, tolerance: q.tolerance, marks: q.marks, tool: q.tool }, response);
        return { questionId: q.id, topicId: q.topicId, response: response ?? null, correct: o.correct, marksAwarded: o.marksAwarded, marksMax: q.marks, feedback: "", pending: o.pending, ...(o.feedback ? { checkerFeedback: o.feedback } : {}) };
      });
      const score = scoreAttempt(answers as ScoredAnswer[], a.passMarkPct);
      const late = !!a.timeLimitMins && Date.parse(now) > Date.parse(a.startedAt) + a.timeLimitMins * 60_000 + GRACE_MS;
      const patch = {
        answers, status: score.status, submittedAt: now, submittedBy: ctx.uid, late, scoreMarks: score.scoreMarks, maxMarks: score.maxMarks, pct: score.pct,
        byTopic: score.byTopic, markedBy: score.status === "marked" ? "auto" : null, markedAt: score.status === "marked" ? now : null, updatedAt: now,
        ...splitOf({ questions: a.questions, answers }),
      };
      tx.update(found.ref, { ...patch, draft: FieldValue.delete() });
      return { ...a, ...patch } as AttemptDoc;
    });
  } catch (e) {
    if (refuse(res, e)) return;
    throw e;
  }
  await refreshMastery(saved);
  pingHub(saved.tenantId, "hubAttempts");
  const cfg = await hubConfig(saved.tenantId, saved.franchiseId);
  res.json(resultOut(found.id, saved, cfg, ctx.canEdit, false, imageBase(req), needsPastPass(cfg, saved, ctx.canEdit) && await passedBefore(saved)));
});

// ── draft (answers so far) ───────────────────────────────────────────────────

const DRAFT_MAX_BYTES = 200_000; // a 300-question paper of long written answers is still far under this; anything bigger is refused
const draftBody = z.object({
  answers: z.array(z.object({ questionId: z.string().min(1).max(100), response: z.unknown() })).max(300),
  idx: z.number().int().min(0).max(299).optional(),
});

// PUT /attempts/:id/draft {answers:[{questionId,response}], idx?} — the running paper's answers-so-far, saved as the child goes (debounced by the
// runner) so "Resume" works on ANOTHER device. Not marked, not shown to anyone, replaced whole each time, removed at submit. Only the attempt's
// OWNER may save it: the parent whose child it is, or the tutor who started it for a child beside them — never another tutor or family.
hubAttemptsApi.put("/attempts/:id/draft", async (req, res) => {
  const ctx = await resolveCtx(req, res);
  if (!ctx) return;
  const parsed = draftBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues }); return; }
  const found = await loadAttempt(ctx, req.params.id, res);
  if (!found) return;
  const owner = ctx.role === "parent" ? found.a.parentUid === ctx.uid : found.a.startedBy === ctx.uid;
  if (!owner) { res.status(404).json({ error: "Attempt not found" }); return; }
  if (found.a.status !== "in_progress") { res.status(409).json({ error: "This has already been submitted", code: "already_submitted" }); return; }
  const known = new Set(found.a.questions.map((q) => q.id));
  const answers: Record<string, unknown> = {};
  for (const x of parsed.data.answers) {
    if (!known.has(x.questionId)) continue; // a stale / foreign id is dropped, never stored
    const v = cleanResponse(x.response);
    if (v !== null && v !== "") answers[x.questionId] = v;
  }
  const draft = { answers, idx: Math.min(parsed.data.idx ?? 0, Math.max(0, found.a.questions.length - 1)), savedAt: nowIso() };
  if (JSON.stringify(draft).length > DRAFT_MAX_BYTES) { res.status(413).json({ error: "Those answers are too large to keep as a draft", code: "draft_too_large" }); return; }
  await found.ref.update({ draft }); // no updatedAt / pingHub: a draft is private to the child and must not wake every open screen
  res.json({ ok: true, savedAt: draft.savedAt });
});

// ── read ─────────────────────────────────────────────────────────────────────

// GET /attempts?childId=&assessmentId= — newest first. A family: their child's; a tutor: one child or all visible.
hubAttemptsApi.get("/attempts", async (req, res) => {
  const ctx = await resolveCtx(req, res);
  if (!ctx) return;
  const child = await requestedChild(ctx, req.query.childId, res, ctx.canEdit);
  if (child === undefined) return;
  const assessmentId = typeof req.query.assessmentId === "string" && req.query.assessmentId ? req.query.assessmentId : null;
  // ?status=pending_marking|marked|in_progress — the tutor's marking queue asks for JUST the papers waiting (an old one must
  // not fall off the newest-300 window the unfiltered list is capped to).
  const statusQ = typeof req.query.status === "string" && ["in_progress", "pending_marking", "marked"].includes(req.query.status) ? req.query.status : null;
  let q = attemptsCol.where("tenantId", "==", ctx.tenantId);
  if (child) q = q.where("childId", "==", child.childId);
  if (statusQ) q = q.where("status", "==", statusQ);
  const snap = await q.select(...ATTEMPT_LITE_FIELDS).get();
  const rows = snap.docs
    .map((d) => ({ id: d.id, ...(d.data() as AttemptDoc) }))
    .filter((a) => canSeeStudent(ctx, a.franchiseId) && (ctx.role !== "parent" || a.parentUid === ctx.uid) && (!assessmentId || a.assessmentId === assessmentId))
    .sort((a, b) => (b.submittedAt ?? b.startedAt).localeCompare(a.submittedAt ?? a.startedAt))
    .slice(0, 300);
  // Attempts from before the auto/written split was stored: work it out from their snapshot (rare, and only those rows).
  const legacy = rows.filter((a) => a.status !== "in_progress" && a.autoMax === undefined);
  if (legacy.length) {
    const full = await db.getAll(...legacy.map((a) => attemptsCol.doc(a.id)), { fieldMask: ["questions", "answers"] });
    full.forEach((f, i) => { if (f.exists) Object.assign(legacy[i], splitOf(f.data() as Pick<AttemptDoc, "questions" | "answers">)); });
  }
  res.json(rows.map((a) => summaryOut(a.id, a)));
});

// GET /attempts/:id — the result, with prompts (and the key + explanations only when allowed).
hubAttemptsApi.get("/attempts/:id", async (req, res) => {
  const ctx = await resolveCtx(req, res);
  if (!ctx) return;
  const found = await loadAttempt(ctx, req.params.id, res);
  if (!found) return;
  const cfg = await hubConfig(found.a.tenantId, found.a.franchiseId);
  res.json(resultOut(found.id, found.a, cfg, ctx.canEdit, true, imageBase(req), needsPastPass(cfg, found.a, ctx.canEdit) && await passedBefore(found.a)));
});

// ── tutor marking ────────────────────────────────────────────────────────────

const markBody = z.object({
  answers: z.array(z.object({
    questionId: z.string().min(1).max(100),
    marksAwarded: z.number().finite().min(0).max(1000),
    feedback: z.string().trim().max(2000).optional(),
  })).min(1).max(300),
});

// PUT /attempts/:id/mark — award marks (written answers; may also override an auto-mark).
hubAttemptsApi.put("/attempts/:id/mark", async (req, res) => {
  const ctx = await resolveCtx(req, res);
  if (!ctx || !requireEdit(ctx, res)) return;
  const parsed = markBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues }); return; }
  const found = await loadAttempt(ctx, req.params.id, res);
  if (!found) return;
  if (!canWriteRow(ctx, found.a.franchiseId)) { res.status(403).json({ error: "That student belongs to head office" }); return; }

  let saved: AttemptDoc;
  try {
    saved = await db.runTransaction(async (tx) => {
      const s = await tx.get(found.ref);
      const a = s.data() as AttemptDoc;
      if (a.status === "in_progress") throw new Refusal(409, { error: "This hasn't been submitted yet", code: "not_submitted" });
      const answers = a.answers.map((x) => ({ ...x }));
      for (const m of parsed.data.answers) {
        const x = answers.find((y) => y.questionId === m.questionId);
        if (!x) throw new Refusal(400, { error: "That answer doesn't belong to this attempt" });
        if (m.marksAwarded > x.marksMax) throw new Refusal(400, { error: `The most this question is worth is ${x.marksMax}` });
        const r = applyManualMark(x.marksMax, m.marksAwarded);
        x.correct = r.correct; x.marksAwarded = r.marksAwarded; x.pending = false;
        if (m.feedback !== undefined) x.feedback = m.feedback;
      }
      const now = nowIso();
      const score = scoreAttempt(answers as ScoredAnswer[], a.passMarkPct);
      const patch = {
        answers, status: score.status, scoreMarks: score.scoreMarks, pct: score.pct, byTopic: score.byTopic,
        markedBy: score.status === "marked" ? ctx.uid : a.markedBy, markedAt: score.status === "marked" ? now : a.markedAt, updatedAt: now,
        ...splitOf({ questions: a.questions, answers }),
      };
      tx.update(found.ref, patch);
      return { ...a, ...patch } as AttemptDoc;
    });
  } catch (e) {
    if (refuse(res, e)) return;
    throw e;
  }
  await refreshMastery(saved);
  pingHub(saved.tenantId, "hubAttempts");
  // The tutor just finished marking a paper that was waiting: tell the family (a parent-muted "learning" category still gets the bell).
  if (saved.status === "marked" && found.a.status !== "marked" && saved.childId) {
    void notifyFamilies({
      tenantId: saved.tenantId, childIds: [saved.childId], ref: found.id, tab: saved.assessmentType === "diagnostic" ? "diagnostic" : "quizzes",
      compose: (names) => ({ title: saved.assessmentType === "diagnostic" ? "Placement test marked" : "Quiz marked", body: `${nameList(names)}'s ${saved.assessmentType === "diagnostic" ? "placement test" : "quiz"} "${saved.assessmentTitle}" has been marked: ${saved.scoreMarks}/${saved.maxMarks}${saved.pct != null ? ` (${Math.round(saved.pct)}%)` : ""}.` }),
    });
  }
  const cfg = await hubConfig(saved.tenantId, saved.franchiseId);
  res.json(resultOut(found.id, saved, cfg, true, true, imageBase(req)));
});

// POST /attempts/:id/reset-baseline — a tutor lets the student retake a diagnostic:
// this attempt stops counting as their baseline.
hubAttemptsApi.post("/attempts/:id/reset-baseline", async (req, res) => {
  const ctx = await resolveCtx(req, res);
  if (!ctx || !requireEdit(ctx, res)) return;
  const found = await loadAttempt(ctx, req.params.id, res);
  if (!found) return;
  if (!canWriteRow(ctx, found.a.franchiseId)) { res.status(403).json({ error: "That student belongs to head office" }); return; }
  if (found.a.assessmentType !== "diagnostic" || found.a.status === "in_progress") { res.status(409).json({ error: "Only a submitted diagnostic has a baseline to reset" }); return; }
  await found.ref.update({ baselineReset: true, updatedAt: nowIso() });
  // Letting them retake the placement test also lifts any "once" retake limit for it.
  await hubEnrolments.doc(enrolmentId(ctx.tenantId, found.a.childId)).update({ retakeGrants: FieldValue.arrayUnion(found.a.assessmentId) }).catch(() => {});
  await refreshMastery({ ...found.a });
  pingHub(found.a.tenantId, "hubAttempts");
  res.json({ ok: true });
});

const waiveBody = z.object({ subject: z.string().trim().min(1).max(80), waived: z.boolean().default(true) });

// POST /students/:childId/diagnostic-waive {subject, waived?} — skip (or re-require) the placement test.
hubAttemptsApi.post("/students/:childId/diagnostic-waive", async (req, res) => {
  const ctx = await resolveCtx(req, res);
  if (!ctx || !requireEdit(ctx, res)) return;
  const parsed = waiveBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues }); return; }
  const child: ChildRef | null = await childFor(ctx, req.params.childId, res);
  if (!child) return;
  if (!canWriteRow(ctx, child.franchiseId)) { res.status(403).json({ error: "That student belongs to head office" }); return; }
  const s = parsed.data.subject.toLowerCase();
  const next = parsed.data.waived ? [...new Set([...child.waived, s])] : child.waived.filter((x) => x !== s);
  await hubEnrolments.doc(enrolmentId(ctx.tenantId, child.childId)).set({ diagnosticWaived: next, updatedAt: nowIso() }, { merge: true });
  res.json({ childId: child.childId, waived: next });
});
