import type { Response } from "express";
import { db } from "../../firebase";
import { ageInYears, canSee, canSeeStudent, childDobs, effectiveYearGroup, hubEnrolments, okId, registerTopicRef, subjectAllowed, type EnrolmentDoc, type HubCtx } from "../../lib/hubCore";
import type { Audience } from "../../lib/hubRules";
import { tenantTopics } from "../../lib/hubIndex";

// Shared plumbing for the assessments router family (questions, assessments,
// attempts, mastery): collections, stored shapes, and the two loaders every
// handler leans on (visible topics; "is this child mine to act on?").

export const topicsCol = db.collection("hubTopics");
export const questionsCol = db.collection("hubQuestions");
export const assessmentsCol = db.collection("hubAssessments");
export const attemptsCol = db.collection("hubAttempts");
export const masteryCol = db.collection("hubMastery");
export const homeworkCol = db.collection("hubHomework");

// A topic with questions can't be deleted (learningHub.ts DELETE /topics/:id).
registerTopicRef(questionsCol);

export type MarkRule = import("../../lib/hubScoring").MarkRule;

export interface TopicDoc {
  tenantId: string; franchiseId: string | null; subject: string; topic: string; subtopic: string | null; parentTopicId: string | null;
}
export type Topic = TopicDoc & { id: string };

export interface QuestionDoc {
  /** Year groups this question is for (labels from settings.hub.yearGroups, like a quiz audience). Empty / absent = not tagged. */
  yearGroups?: string[];
  tenantId: string;
  franchiseId: string | null;
  topicId: string;
  kind: string;
  prompt: string;
  options: { id: string; text: string; image?: { id: string; url?: string; alt?: string } | null }[];
  /** A picture the question shows (a private hub upload, by id; alt text is required). */
  image?: { id: string; alt: string; url?: string } | null;
  /** choice → option id; multi → option id[]; exact → string; numeric → number; manual / match / order → null
   *  (a match question's key is `pairs`, an order question's is `items` — see lib/hubKinds.ts). */
  answer: unknown;
  /** match: the correct pairs (3–8), optional pictures as {url, alt}. */
  pairs?: import("../../lib/hubKinds").Pair[];
  /** order: the items in the CORRECT order (2–8); students get them shuffled. */
  items?: string[];
  acceptedAnswers: string[];
  tolerance: number;
  marks: number;
  explanation: string;
  published: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface AssessmentDoc {
  tenantId: string;
  franchiseId: string | null;
  type: "quiz" | "diagnostic";
  title: string;
  subject: string;
  topicIds: string[];
  questionIds: string[];
  timeLimitMins: number | null;
  passMarkPct: number;
  published: boolean;
  /** Who it is for (empty = everyone). Older assessments have none. */
  audience?: Audience;
  /** "inherit" (or unset) = settings.hub.retakePolicy. */
  retakePolicy?: "inherit" | "unlimited" | "once" | "cooldown";
  retakeCooldownHours?: number | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

/** The frozen copy of a question taken when an attempt starts, key included. It is
 *  never sent to a student as-is (see attempts.ts `questionOut` / `answerOut`). */
export interface QuestionSnap {
  id: string;
  topicId: string;
  kind: string;
  mark: MarkRule;
  prompt: string;
  options: { id: string; text: string; image?: { id: string; url?: string; alt?: string } | null }[];
  image?: { id: string; alt: string; url?: string } | null;
  marks: number;
  /** The key. For match → the pairs, for order → the items in order (copied from the question at start). */
  answer: unknown;
  acceptedAnswers: string[];
  tolerance: number;
  explanation: string;
}

export interface AnswerDoc {
  questionId: string;
  topicId: string;
  response: unknown;
  correct: boolean | null;
  marksAwarded: number;
  marksMax: number;
  feedback: string;
  /** Manual answer waiting for a tutor. */
  pending: boolean;
}

export interface AttemptDoc {
  tenantId: string;
  franchiseId: string | null;
  assessmentId: string;
  assessmentType: "quiz" | "diagnostic";
  assessmentTitle: string;
  subject: string;
  passMarkPct: number;
  homeworkId: string | null;
  childId: string;
  childName: string;
  parentUid: string;
  startedBy: string;
  submittedBy: string | null;
  startedAt: string;
  submittedAt: string | null;
  timeLimitMins: number | null;
  late: boolean;
  status: "in_progress" | "pending_marking" | "marked";
  questions: QuestionSnap[];
  answers: AnswerDoc[];
  scoreMarks: number;
  maxMarks: number;
  pct: number | null;
  byTopic: Record<string, { got: number; max: number }>;
  markedBy: string | null;
  markedAt: string | null;
  baselineReset: boolean;
  /** Self-marked vs written split (lib/hubScoring.ts autoSplit) — stored so lists don't need the heavy snapshot. */
  autoMarks?: number;
  autoMax?: number;
  writtenPending?: number;
  /** "in_person" = a tutor recorded it for a child sitting beside them (routes/hub/inPersonApi.ts); absent = the child/family sat it. */
  mode?: "in_person";
  /** In-person only: the hubLessons session the tutor ran (mode "in_person") this belongs to. */
  sessionId?: string | null;
  /** A RUNNING attempt's answers-so-far, saved as the child goes (PUT /attempts/:id/draft) so a resume works on any device.
   *  Never marked, never shown to anyone but the owner's resume; removed at submit. */
  draft?: { answers: Record<string, unknown>; idx: number; savedAt: string };
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

/** Fields of an attempt worth reading for lists / mastery (skips the heavy `questions` snapshot). */
export const ATTEMPT_LITE_FIELDS = [
  "tenantId", "franchiseId", "assessmentId", "assessmentType", "assessmentTitle", "subject", "passMarkPct", "homeworkId", "childId", "childName", "parentUid",
  "startedAt", "submittedAt", "timeLimitMins", "status", "scoreMarks", "maxMarks", "pct", "byTopic", "baselineReset", "autoMarks", "autoMax", "writtenPending", "mode", "sessionId",
] as const;

export const nowIso = () => new Date().toISOString();
export const asStr = (v: unknown): string | null => (typeof v === "string" && v ? v : null);
export const enrolmentId = (tenantId: string, childId: string) => `${tenantId}__${childId}`;

/** The topics this caller may see (franchise scope + a family's enrolled subjects). */
export async function loadTopics(ctx: HubCtx): Promise<Topic[]> {
  // The tenant's raw topic rows come from the short-lived per-tenant cache (lib/hubIndex.ts); access is applied per request.
  return (await tenantTopics(ctx.tenantId)).filter((t) => canSee(ctx, t.franchiseId) && subjectAllowed(ctx, t.subject));
}

export interface ChildRef {
  childId: string;
  childName: string;
  franchiseId: string | null;
  /** Enrolled subjects; empty = all. */
  subjects: string[];
  parentUid: string;
  /** Lower-cased subjects a tutor waived the placement test for. */
  waived: string[];
  active: boolean;
  /** Stored year-group fields (see EnrolmentDoc) and the assessments a tutor allowed one more attempt at. */
  yg: { yearGroup?: string | null; yearGroupAuto?: boolean };
  retakeGrants: string[];
}

/** What is known about a student for audience checks: their year group now, and their age. */
export interface KidFacts { yearGroup: string | null; age: number | null }
export async function childFacts(child: ChildRef, yearGroups: string[]): Promise<KidFacts> {
  const dob = (await childDobs([child.childId])).get(child.childId) ?? null;
  return { yearGroup: effectiveYearGroup(child.yg, dob, yearGroups), age: ageInYears(dob) };
}

/** The enrolled child this caller may act on, or a 404 has been sent. Tenant is
 *  re-checked on the row; a parent must own the child (enrolment parentUid); a
 *  tutor must be able to see the child's franchise. `needActive` (starting new
 *  work) refuses a paused enrolment. */
export async function childFor(ctx: HubCtx, childId: unknown, res: Response, opts: { needActive?: boolean } = {}): Promise<ChildRef | null> {
  const c = await childRefFor(ctx, childId, opts);
  if (!c) res.status(404).json({ error: "Student not found" });
  return c;
}

/** `childFor` without the response: the same tenant / scope / ownership rules, null when the child isn't this caller's. */
export async function childRefFor(ctx: HubCtx, childId: unknown, opts: { needActive?: boolean } = {}): Promise<ChildRef | null> {
  if (!okId(childId)) return null;
  const snap = await hubEnrolments.doc(enrolmentId(ctx.tenantId, childId)).get();
  if (!snap.exists) return null;
  const e = snap.data() as EnrolmentDoc;
  if (e.tenantId !== ctx.tenantId || !canSeeStudent(ctx, e.franchiseId)) return null;
  if (ctx.role === "parent" && (e.parentUid !== ctx.uid || !ctx.children.some((c) => c.childId === childId))) return null;
  const active = e.active !== false;
  if (opts.needActive && !active) return null;
  return {
    childId, childName: e.childName ?? "", franchiseId: e.franchiseId ?? null, subjects: e.subjects ?? [],
    parentUid: e.parentUid, waived: (e.diagnosticWaived ?? []).map((s) => s.toLowerCase()), active,
    yg: { yearGroup: e.yearGroup, yearGroupAuto: e.yearGroupAuto }, retakeGrants: Array.isArray(e.retakeGrants) ? e.retakeGrants : [],
  };
}

/** The child a request is about, for list-style reads: a parent's `?childId=` (or
 *  their only enrolled child); a tutor's `?childId=`. Sends 400/404 itself. `null`
 *  (nothing sent) means "no child asked for" — only when `optional`. */
export async function requestedChild(ctx: HubCtx, query: unknown, res: Response, optional: boolean): Promise<ChildRef | null | undefined> {
  let id: string | null = typeof query === "string" && query ? query : null;
  if (ctx.role === "parent") id = ctx.childId ?? (ctx.children.length === 1 ? ctx.children[0].childId : null);
  if (!id) {
    if (optional) return null;
    res.status(400).json({ error: "Which student? Pass ?childId=" });
    return undefined;
  }
  const c = await childFor(ctx, id, res);
  return c ?? undefined; // undefined = refusal already sent
}

/** Does a stored row's franchise fit a child's franchise? (head office content
 *  reaches every child; a franchise's only its own.) */
export const fitsChild = (rowFranchise: string | null | undefined, child: { franchiseId: string | null }) =>
  (rowFranchise ?? null) === null || (rowFranchise ?? null) === child.franchiseId;

export const childSubjectOk = (child: ChildRef, subject: string) =>
  !child.subjects.length || child.subjects.some((s) => s.toLowerCase() === subject.toLowerCase());
