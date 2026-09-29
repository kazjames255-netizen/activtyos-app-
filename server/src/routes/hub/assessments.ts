import { Router, type Response } from "express";
import { familyNoteRule } from "../../lib/hubAccess";
import { z } from "zod";
import { FieldValue } from "firebase-admin/firestore";
import { db } from "../../firebase";
import { ageInYears, canReadContent, canSee, canSeeStudent, canWriteRow, childDobs, effectiveYearGroup, enrolmentsForParent, hubConfig, hubEnrolments, needsFork, okId, requireEdit, resolveCtx, same, scopedChildren, subjectAllowed, type EnrolmentDoc, type HubCtx } from "../../lib/hubCore";
import { assessmentRows, collate, noteIndex, patchAssessment, questionIndex, tenantRoster, type AsmRow, type QRow } from "../../lib/hubIndex";
import { pingHub } from "../../lib/hubPing";
import { audienceFit, audienceKey, effectiveRetake, failStreak, isEveryone, normAudience, retakeDecision, type Audience, type Fit } from "../../lib/hubRules";
import {
  assessmentsCol, attemptsCol, childFacts, childFor, childSubjectOk, diagnosticAssignedTo, enrolmentId, fitsChild, homeworkCol, loadTopics, nowIso, questionsCol, requestedChild,
  type AssessmentDoc, type ChildRef, type QuestionDoc,
} from "./shared";
import { submissionsCol } from "./teachingCommon";

// Learning Hub — assessments: a quiz (practice, feeds mastery) or a diagnostic
// (placement test, sets the baseline). A tutor authors them from the question
// bank; a family only ever sees PUBLISHED ones for the subjects the child is
// enrolled in, with a summary — never the questions themselves (those arrive
// stripped of their key when an attempt starts, see attempts.ts).

export const hubAssessmentsCrud = Router();

/** Who an assessment is for. Empty year groups + no ages = everyone. */
const audienceBody = z.object({
  yearGroups: z.array(z.string().trim().min(1).max(40)).max(30).default([]),
  ageMin: z.number().int().min(0).max(25).nullable().default(null),
  ageMax: z.number().int().min(0).max(25).nullable().default(null),
}).refine((a) => a.ageMin === null || a.ageMax === null || a.ageMin <= a.ageMax, { message: "The youngest age can't be above the oldest", path: ["ageMin"] });

const assessmentBody = z.object({
  type: z.enum(["quiz", "diagnostic"]),
  title: z.string().trim().min(1).max(200),
  subject: z.string().trim().min(1).max(80),
  topicIds: z.array(z.string().min(1).max(100)).max(100).default([]),
  questionIds: z.array(z.string().min(1).max(100)).max(200).default([]),
  timeLimitMins: z.number().int().min(1).max(600).nullable().default(null),
  passMarkPct: z.number().int().min(0).max(100).optional(),
  published: z.boolean().default(false),
  // Omitted on an edit = keep what is stored (older clients don't send these).
  audience: audienceBody.optional(),
  retakePolicy: z.enum(["inherit", "unlimited", "once", "cooldown"]).optional(),
  retakeCooldownHours: z.number().int().min(1).max(720).nullable().optional(),
  // Diagnostics only. Omitted on an edit = keep what is stored (including the legacy `null`/absent = "everyone
  // who fits the audience"). A brand-new diagnostic that omits this is given `[]` in `shape()` below — nobody,
  // forcing the tutor to make an explicit choice.
  assignedChildIds: z.array(z.string().min(1).max(100)).max(1000).nullable().optional(),
});

const dedupe = <T,>(xs: T[]) => [...new Set(xs)];

/** A published diagnostic in the same subject, scope AND audience (excluding `selfId`). Several placement
 *  tests may share a subject when they are for different audiences (Maths Year 3–4 / Maths Year 5–6). */
async function otherPublishedDiagnostic(tenantId: string, franchiseId: string | null, subject: string, selfId: string | null, audience: Audience) {
  const snap = await assessmentsCol.where("tenantId", "==", tenantId).get();
  const key = audienceKey(audience);
  return snap.docs.find((d) => {
    const a = d.data() as AssessmentDoc;
    return d.id !== selfId && a.type === "diagnostic" && a.published !== false && (a.franchiseId ?? null) === franchiseId && same(a.subject, subject) && audienceKey(normAudience(a.audience)) === key;
  });
}

/** Validate + shape an assessment body against the bank. Returns the stored fields
 *  (sans audit fields) or a refusal already sent. */
async function shape(ctx: HubCtx, franchiseId: string | null, b: z.infer<typeof assessmentBody>, selfId: string | null, res: Response, before?: AssessmentDoc) {
  const topics = await loadTopics(ctx);
  const subjectTopic = topics.find((t) => same(t.subject, b.subject));
  if (!subjectTopic) { res.status(400).json({ error: "Pick a subject that has topics" }); return null; }
  const subject = subjectTopic.subject; // the tenant's own spelling
  const audience = b.audience ? normAudience(b.audience) : normAudience(before?.audience);
  const retakePolicy = b.retakePolicy ?? before?.retakePolicy ?? "inherit";
  const retakeCooldownHours = retakePolicy === "cooldown" ? (b.retakeCooldownHours !== undefined ? b.retakeCooldownHours : before?.retakeCooldownHours ?? null) : null;

  const qIds = dedupe(b.questionIds);
  const allOk = qIds.every((id) => okId(id));
  const qDocs: (FirebaseFirestore.DocumentSnapshot | null)[] = qIds.length ? (allOk ? await db.getAll(...qIds.map((id) => questionsCol.doc(id))) : qIds.map(() => null)) : [];
  const questions: { id: string; q: QuestionDoc }[] = [];
  for (const [i, s] of qDocs.entries()) {
    // Foreign / missing / out-of-scope questions are all "not found". A question from the shared
    // library is fine here too (canReadContent) — a tenant composes quizzes from its own bank AND
    // the shared one, and a forked copy of a shared assessment keeps referencing the shared
    // questions it was built from.
    if (!s || !s.exists || !canReadContent(ctx, s.get("tenantId")) || !canSee(ctx, s.get("franchiseId"))) { res.status(404).json({ error: "A question in this quiz wasn't found" }); return null; }
    const q = s.data() as QuestionDoc;
    if ((q.franchiseId ?? null) !== null && q.franchiseId !== franchiseId) { res.status(404).json({ error: "A question in this quiz wasn't found" }); return null; }
    questions.push({ id: qIds[i], q });
  }
  const topicById = new Map(topics.map((t) => [t.id, t] as const));
  for (const { q } of questions) {
    const t = topicById.get(q.topicId);
    if (!t) { res.status(400).json({ error: "A question sits under a topic that no longer exists" }); return null; }
    if (!same(t.subject, subject)) { res.status(400).json({ error: `Every question must be in the subject "${subject}"` }); return null; }
  }
  for (const id of b.topicIds) {
    const t = topicById.get(id);
    if (!t) { res.status(404).json({ error: "Topic not found" }); return null; }
    if (!same(t.subject, subject)) { res.status(400).json({ error: `Every topic must be in the subject "${subject}"` }); return null; }
  }

  if (b.published) {
    if (!questions.length) { res.status(400).json({ error: "Add at least one question before publishing" }); return null; }
    if (questions.some(({ q }) => q.published === false)) { res.status(400).json({ error: "Every question must be published before the quiz can be" }); return null; }
    if (b.type === "diagnostic" && (await otherPublishedDiagnostic(ctx.tenantId, franchiseId, subject, selfId, audience))) {
      res.status(409).json({
        error: isEveryone(audience)
          ? `There is already a published ${subject} diagnostic for everyone — choose a year group or age range for this one, or unpublish the other first`
          : `There is already a published ${subject} diagnostic for this same year group / age range — change who this one is for, or unpublish the other first`,
        code: "diagnostic_exists",
      });
      return null;
    }
  }
  const cfg = await hubConfig(ctx.tenantId, franchiseId);
  const topicIds = dedupe([...b.topicIds, ...questions.map(({ q }) => q.topicId)]);
  // Diagnostics only. Sent = the tutor's explicit list (deduped; `null` reverts to the legacy "everyone who
  // fits" fallback). Omitted on an edit keeps whatever is stored (including a legacy assessment's absent
  // field). Omitted on a brand-new diagnostic = `null` too (everyone who fits, the same legacy default) —
  // an earlier `[]` default here silently made every API-created diagnostic (the AssessmentBuilder UI
  // always sends an explicit list, but e2e/tutor-API callers that don't touch "Assign" never did) reach
  // NO child at all: diagSubjects (childOverlay, below) never saw it, so a quiz never locked behind it and
  // the diagnostic itself never appeared to any family — with no validation ever actually "forcing the
  // choice" the old comment here described. Confirmed live (scratch investigation, 29 Sep): an identical
  // diagnostic created with assignedChildIds omitted only showed `locked` on its quiz once assignedChildIds
  // was explicitly set to `null`.
  const assignedChildIds = b.type !== "diagnostic" ? undefined
    : b.assignedChildIds !== undefined ? (b.assignedChildIds === null ? null : dedupe(b.assignedChildIds))
    : before?.type === "diagnostic" ? (before.assignedChildIds ?? null) : null;
  return {
    type: b.type, title: b.title, subject, topicIds, questionIds: qIds, timeLimitMins: b.timeLimitMins,
    passMarkPct: b.passMarkPct ?? cfg.passMarkPct, published: b.published, audience, retakePolicy, retakeCooldownHours, assignedChildIds,
    _totalMarks: questions.reduce((n, { q }) => n + q.marks, 0),
  };
}

// ── shared read model ────────────────────────────────────────────────────────

type Row = AsmRow;
/** Question count + total marks, worked out from the (cached, patched-on-write) light question index — a list never
 *  reads question documents. `onlyPublished` (a family) skips unpublished questions. */
const totalsOf = (a: AssessmentDoc, bank: Map<string, QRow>, onlyPublished: boolean) => {
  let questionCount = 0;
  let totalMarks = 0;
  for (const id of a.questionIds ?? []) {
    const q = bank.get(id);
    if (!q || (onlyPublished && !q.published)) continue;
    questionCount++;
    totalMarks += q.marks;
  }
  return { questionCount, totalMarks };
};

const kindCountsOf = (a: AssessmentDoc, bank: Map<string, QRow>) => {
  const out: Record<string, number> = {};
  for (const id of a.questionIds ?? []) { const q = bank.get(id); if (q) out[q.kind] = (out[q.kind] ?? 0) + 1; }
  return out;
};

const assessmentBase = (a: Row, bank: Map<string, QRow>, onlyPublished: boolean) => ({
  id: a.id, type: a.type, title: a.title, subject: a.subject, topicIds: a.topicIds ?? [], ...totalsOf(a, bank, onlyPublished),
  timeLimitMins: a.timeLimitMins ?? null, passMarkPct: a.passMarkPct, franchiseId: a.franchiseId ?? null, audience: normAudience(a.audience),
});

/** Diagnostic bookkeeping for one child: subject → has a submitted diagnostic /
 *  an active (not reset) one. Read from attempts, so it is always in step. */
export async function diagnosticState(tenantId: string, childId: string) {
  const snap = await attemptsCol.where("tenantId", "==", tenantId).where("childId", "==", childId).select("assessmentType", "subject", "status", "baselineReset").get();
  const taken = new Set<string>(); // sat one at all (gating)
  const active = new Set<string>(); // sat one that still stands (the tile shows "done")
  for (const d of snap.docs) {
    if (d.get("assessmentType") !== "diagnostic" || d.get("status") === "in_progress") continue;
    const s = String(d.get("subject") ?? "").toLowerCase();
    taken.add(s);
    if (d.get("baselineReset") !== true) active.add(s);
  }
  return { taken, active };
}

/** A student as far as "is this assessment for them?" is concerned. */
interface Kid { childId: string; franchiseId: string | null; subjects: string[]; fit: (a: Audience) => Fit }

/** The active students a request is about, with their year group + age worked out.
 *  Parent: their enrolled children (narrowed to `only`); tutor: every active student in scope. */
async function kidsFor(ctx: HubCtx, only: ChildRef | null): Promise<Kid[]> {
  let enrols: EnrolmentDoc[];
  if (ctx.role === "parent") {
    const ids = new Set(scopedChildren(ctx).map((c) => c.childId));
    enrols = (await enrolmentsForParent(ctx.uid)).filter((e) => e.tenantId === ctx.tenantId && ids.has(e.childId));
  } else {
    enrols = (await tenantRoster(ctx.tenantId)).filter((e) => e.active !== false && canSeeStudent(ctx, e.franchiseId));
  }
  if (only) enrols = enrols.filter((e) => e.childId === only.childId);
  const dobs = await childDobs(enrols.map((e) => e.childId));
  const cfgs = new Map<string, Promise<Awaited<ReturnType<typeof hubConfig>>>>();
  const cfgOf = (f: string | null) => { const k = f ?? ""; if (!cfgs.has(k)) cfgs.set(k, hubConfig(ctx.tenantId, f)); return cfgs.get(k)!; };
  return Promise.all(enrols.map(async (e) => {
    const cfg = await cfgOf(e.franchiseId ?? null);
    const dob = dobs.get(e.childId) ?? null;
    const facts = { yearGroup: effectiveYearGroup(e, dob, cfg.yearGroups, new Date(), cfg.yearAutoAdvance), age: ageInYears(dob) };
    return { childId: e.childId, franchiseId: e.franchiseId ?? null, subjects: e.subjects ?? [], fit: (a: Audience) => audienceFit(a, facts) };
  }));
}

/** The kids an assessment could reach: head office content reaches every franchise's, a franchise's its own; enrolled subjects only. */
const reachable = (kids: Kid[], a: Pick<AssessmentDoc, "franchiseId" | "subject">) =>
  kids.filter((k) => fitsChild(a.franchiseId, k) && (!k.subjects.length || k.subjects.some((s) => s.toLowerCase() === a.subject.toLowerCase())));

const strQ = (v: unknown) => (typeof v === "string" && v ? v : null);
const intQ = (v: unknown, dflt: number, max: number) => { const n = Number(v); return Number.isFinite(n) && n > 0 ? Math.min(Math.floor(n), max) : dflt; };
/** Does an audience reach this year group? (an "everyone" assessment reaches all of them). */
const reachesYear = (aud: Audience, yg: string) => isEveryone(aud) || aud.yearGroups.some((y) => same(y, yg));

// GET /assessments?type=&topicId=&subject=&childId=
// Optional: `yearGroup=` (audience reaches it), `published=0|1` (tutors), `q=` (title), `light=1` (no questionIds list).
// `?limit=&cursor=` returns `{ items, total, nextCursor, facets }` (default 40, max 100) where `facets` counts the
// matching assessments per subject / year group / type WITHOUT that facet's own filter (so chips can show "Maths 12");
// without them it is the plain array it always was. Reads only the cached assessment rows + light question index.
hubAssessmentsCrud.get("/assessments", async (req, res) => {
  const ctx = await resolveCtx(req, res);
  if (!ctx) return;
  const q = req.query;
  const type = q.type === "quiz" || q.type === "diagnostic" ? q.type : null;
  const subjectQ = strQ(q.subject);
  const topicQ = strQ(q.topicId);
  const yearQ = strQ(q.yearGroup);
  const needle = (strQ(q.q) ?? "").toLowerCase();
  const pubQ = q.published === "1" ? true : q.published === "0" ? false : null;
  const light = q.light === "1";
  const paged = q.limit !== undefined || q.cursor !== undefined;
  // `ids=a,b,c` (tutors, ≤300): just those papers — the Results / Marking tabs look up the rows their attempts point at
  // instead of downloading the library.
  const idsQ = strQ(q.ids) ? new Set(strQ(q.ids)!.split(",").map((s) => s.trim()).filter(Boolean).slice(0, 300)) : null;

  const child = await requestedChild(ctx, q.childId, res, true);
  if (child === undefined) return;

  const topics = await loadTopics(ctx);
  let topicIdSet: Set<string> | null = null;
  if (topicQ) {
    if (!topics.some((t) => t.id === topicQ)) { res.status(404).json({ error: "Topic not found" }); return; }
    topicIdSet = new Set([topicQ, ...topics.filter((t) => t.parentTopicId === topicQ).map((t) => t.id)]);
  }
  const [rowMap, bank] = await Promise.all([assessmentRows(ctx.tenantId), questionIndex(ctx.tenantId)]);
  let base: Row[] = [...rowMap.values()].filter((a) => canSee(ctx, a.franchiseId) && (!idsQ || idsQ.has(a.id)));
  const kidsAll = ctx.canEdit ? null : await kidsFor(ctx, child ?? null); // a family's own kids (a handful); a tutor's roster is only needed for the page
  if (!ctx.canEdit) {
    // A family: published only, the child's enrolled subjects, head office + the child's franchise, and only what
    // is FOR their child(ren) — one whose year group / age we can't tell is still shown (flagged), never hidden.
    base = base.filter((a) => {
      if (a.published === false || !subjectAllowed(ctx, a.subject) || (child && !(fitsChild(a.franchiseId, child) && childSubjectOk(child, a.subject)))) return false;
      if (child && !diagnosticAssignedTo(a, child.childId)) return false;
      // No single child narrowed down (a multi-child family's general list): a diagnostic reaches this
      // family only through a kid it is actually assigned to — audience fit alone no longer counts.
      const reach = reachable(kidsAll!, a).filter((k) => diagnosticAssignedTo(a, k.childId));
      const fits = reach.map((k) => k.fit(normAudience(a.audience)));
      return fits.length > 0 && !fits.every((f) => f === "no");
    });
  }
  const matches = (a: Row, skip: "subject" | "year" | "type" | null) =>
    (skip === "type" || !type || a.type === type) && (skip === "subject" || !subjectQ || same(a.subject, subjectQ)) && (!topicIdSet || (a.topicIds ?? []).some((t) => topicIdSet!.has(t)))
    && (skip === "year" || !yearQ || reachesYear(normAudience(a.audience), yearQ)) && (!needle || a.title.toLowerCase().includes(needle)) && (!ctx.canEdit || pubQ === null || (a.published !== false) === pubQ);
  const cmp = (a: Row, b: Row) => collate(a.subject, b.subject) || collate(a.type, b.type) || collate(a.title, b.title) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  const list = base.filter((a) => matches(a, null)).sort(cmp);

  const start = paged ? intQ(q.cursor, 0, 1_000_000) : 0;
  // Unpaged legacy callers get "the plain array it always was" — but never truly unbounded: an unpaged request
  // against the full shared library (~9k+ papers) generated a response big enough to crash the process (found
  // during overnight testing, 27 Sep 2026). A caller that genuinely needs more than this should pass `?limit=`.
  const UNPAGED_SAFETY_CAP = 2000;
  const limit = paged ? intQ(q.limit, 40, 100) : Math.min(list.length, UNPAGED_SAFETY_CAP);
  const page = list.slice(start, start + limit);
  const cfg = await hubConfig(ctx.tenantId, ctx.canEdit ? ctx.franchiseId : child?.franchiseId ?? scopedChildren(ctx)[0]?.franchiseId ?? null);

  let items: Record<string, unknown>[];
  if (ctx.canEdit) {
    // Optional per-child view for a tutor (lastAttempt etc.) mirrors what the family sees.
    const [extra, kids] = await Promise.all([child ? childOverlay(ctx, child, list, base) : null, page.length ? kidsFor(ctx, null) : Promise.resolve([] as Kid[])]);
    items = page.map((a) => {
      // Tutors see everything, plus how many of THEIR students it is for (`eligibleCount` = offered it: fits, or year/age unknown).
      const aud = normAudience(a.audience);
      const fits = reachable(kids, a).map((k) => k.fit(aud));
      return {
        ...assessmentBase(a, bank, false), ...(light ? {} : { questionIds: a.questionIds ?? [] }), published: a.published !== false, updatedAt: a.updatedAt,
        retakePolicy: a.retakePolicy ?? "inherit", retakeCooldownHours: a.retakeCooldownHours ?? null,
        ...(a.type === "diagnostic" ? { assignedChildIds: a.assignedChildIds ?? null } : {}),
        eligibleCount: fits.filter((f) => f !== "no").length, audienceUnknownCount: fits.filter((f) => f === "unknown").length,
        // How the paper breaks down by question kind (from the light index) — the card's "3 Multiple choice · 1 Written" without the questions.
        kindCounts: kindCountsOf(a, bank),
        ...(extra?.get(a.id) ?? {}),
      };
    });
  } else {
    const extra = child ? await childOverlay(ctx, child, list, base) : null;
    // A lesson's exit quiz is a normal quiz, but it belongs at the end of its lesson: say which lesson, so the UI doesn't offer it cold.
    const lessonOf = new Map<string, { id: string; title: string }>();
    // Only lessons THIS family may open (the tutor's `lessonAccess` rule): a link to any other would land on "Lesson not found",
    // so a lesson quiz whose lesson is out of reach is not offered at all (product review H1: 39 dead "Start the lesson first" cards).
    const mayOpen = await familyNoteRule(ctx);
    const lockedLessonQuiz = new Set<string>();
    if (page.length) for (const n of (await noteIndex(ctx.tenantId)).values()) if (n.published && n.lessonQuizId) {
      if (mayOpen && !mayOpen(n)) { lockedLessonQuiz.add(n.lessonQuizId); continue; }
      if (!lessonOf.has(n.lessonQuizId)) lessonOf.set(n.lessonQuizId, { id: n.id, title: n.title });
    }
    items = page.filter((a) => !lockedLessonQuiz.has(a.id) || lessonOf.has(a.id) || !!(extra?.get(a.id) as { lastAttempt?: unknown } | undefined)?.lastAttempt).map((a) => {
      const fits = reachable(kidsAll!, a).map((k) => k.fit(normAudience(a.audience)));
      const les = lessonOf.get(a.id);
      return { ...assessmentBase(a, bank, true), audienceUnknown: !fits.includes("yes"), lessonNoteId: les?.id ?? null, lessonTitle: les?.title ?? null, ...(extra?.get(a.id) ?? { lastAttempt: null }) };
    });
  }
  if (!paged) { res.json(items); return; }

  const count = (skip: "subject" | "year" | "type", key: (a: Row) => string[]) => {
    const m = new Map<string, number>();
    for (const a of base) if (matches(a, skip)) for (const k of new Set(key(a))) m.set(k, (m.get(k) ?? 0) + 1);
    return m;
  };
  const bySubject = count("subject", (a) => [a.subject]);
  // Year-group counts: a paper "for everyone" reaches every year group (so its chip count includes it), and every
  // configured year group gets a row (0 when nothing targets it) — the chips are stable for a tutor.
  let anyTargeted = false;
  let allYears = 0;
  const byYear = new Map<string, number>(cfg.yearGroups.map((y) => [y, 0] as const));
  const yKey = new Map(cfg.yearGroups.map((y) => [y.toLowerCase(), y] as const));
  for (const a of base) {
    if (!matches(a, "year")) continue;
    allYears++;
    const aud = normAudience(a.audience);
    if (isEveryone(aud)) { for (const y of byYear.keys()) byYear.set(y, (byYear.get(y) ?? 0) + 1); continue; }
    anyTargeted = true;
    for (const raw of new Set(aud.yearGroups.map((y) => yKey.get(y.toLowerCase()) ?? y))) byYear.set(raw, (byYear.get(raw) ?? 0) + 1);
  }
  const byType = count("type", (a) => [a.type]);
  const yOrder = new Map(cfg.yearGroups.map((y, i) => [y.toLowerCase(), i] as const));
  let published = 0;
  for (const a of list) if (a.published !== false) published++;
  res.json({
    items, total: list.length, nextCursor: start + limit < list.length ? String(start + limit) : null,
    facets: {
      subjects: [...bySubject].map(([subject, n]) => ({ subject, count: n })).sort((a, b) => a.subject.localeCompare(b.subject)),
      yearGroups: [...byYear].map(([yearGroup, n]) => ({ yearGroup, count: n })).sort((a, b) => (yOrder.get(a.yearGroup.toLowerCase()) ?? 99) - (yOrder.get(b.yearGroup.toLowerCase()) ?? 99) || a.yearGroup.localeCompare(b.yearGroup)),
      /** Matches ignoring the year-group filter (the "All" chip) and whether any of them targets specific year groups. */
      allYearGroups: allYears, anyYearTargeted: anyTargeted,
      types: { quiz: byType.get("quiz") ?? 0, diagnostic: byType.get("diagnostic") ?? 0 },
      /** Of the matching papers (all filters applied): published vs drafts. */
      published, drafts: list.length - published,
    },
  });
});

// GET /assessments/:id — one assessment for the builder (tutors): the row plus its questions as light rows, in order.
hubAssessmentsCrud.get("/assessments/:id", async (req, res) => {
  const ctx = await resolveCtx(req, res);
  if (!ctx || !requireEdit(ctx, res)) return;
  if (!okId(req.params.id)) { res.status(404).json({ error: "Assessment not found" }); return; }
  const snap = await assessmentsCol.doc(req.params.id).get();
  if (!snap.exists || snap.get("tenantId") !== ctx.tenantId || !canSee(ctx, snap.get("franchiseId"))) { res.status(404).json({ error: "Assessment not found" }); return; }
  const a: Row = { id: snap.id, ...(snap.data() as AssessmentDoc) };
  const bank = await questionIndex(ctx.tenantId);
  const questions = (a.questionIds ?? []).map((id) => bank.get(id)).filter((x): x is QRow => !!x)
    .map((x) => ({ id: x.id, topicId: x.topicId, kind: x.kind, prompt: x.prompt.length > 200 ? `${x.prompt.slice(0, 199)}…` : x.prompt, marks: x.marks, published: x.published }));
  res.json({
    ...assessmentBase(a, bank, false), questionIds: a.questionIds ?? [], published: a.published !== false, updatedAt: a.updatedAt,
    retakePolicy: a.retakePolicy ?? "inherit", retakeCooldownHours: a.retakeCooldownHours ?? null,
    ...(a.type === "diagnostic" ? { assignedChildIds: a.assignedChildIds ?? null } : {}), questions,
  });
});

/** For a child: each assessment's lastAttempt, the retake state, and `done` / `locked` flags. */
/** `all` = every paper this caller may see BEFORE the type/subject filters: a quiz list (?type=quiz) must still know a published diagnostic exists to lock behind. */
async function childOverlay(ctx: HubCtx, child: ChildRef, list: Row[], all: Row[] = list) {
  const snap = await attemptsCol.where("tenantId", "==", ctx.tenantId).where("childId", "==", child.childId)
    .select("assessmentId", "assessmentType", "status", "pct", "passMarkPct", "submittedAt", "startedAt", "subject", "baselineReset").get();
  const attempts = snap.docs.map((d) => ({ id: d.id, ...(d.data() as { assessmentId: string; assessmentType: string; status: string; pct: number | null; passMarkPct?: number; submittedAt: string | null; startedAt: string; subject: string; baselineReset?: boolean }) }));
  const last = new Map<string, (typeof attempts)[number]>();
  const finishedAt = new Map<string, (string | null)[]>();
  for (const a of attempts) {
    if (a.status === "in_progress") continue; // a half-done attempt isn't a "last result"
    finishedAt.set(a.assessmentId, [...(finishedAt.get(a.assessmentId) ?? []), a.submittedAt]);
    const cur = last.get(a.assessmentId);
    if (!cur || (a.submittedAt ?? "") > (cur.submittedAt ?? "")) last.set(a.assessmentId, a);
  }
  const byAssessment = new Map<string, typeof attempts>();
  for (const a of attempts) byAssessment.set(a.assessmentId, [...(byAssessment.get(a.assessmentId) ?? []), a]);
  const taken = new Set<string>();
  const active = new Set<string>();
  for (const a of attempts) {
    if (a.assessmentType !== "diagnostic" || a.status === "in_progress") continue;
    taken.add(a.subject.toLowerCase());
    if (!a.baselineReset) active.add(a.subject.toLowerCase());
  }
  const cfg = await hubConfig(ctx.tenantId, child.franchiseId);
  const facts = await childFacts(child, cfg);
  // Is there a published diagnostic FOR THIS CHILD (their scope + audience) for each subject? Only then can a
  // quiz honestly be "locked behind" it.
  const diagSubjects = new Set(all.filter((a) => a.type === "diagnostic" && a.published !== false && fitsChild(a.franchiseId, child) && audienceFit(normAudience(a.audience), facts) !== "no" && diagnosticAssignedTo(a, child.childId)).map((a) => a.subject.toLowerCase()));
  const out = new Map<string, Record<string, unknown>>();
  for (const a of list) {
    const l = last.get(a.id);
    const o: Record<string, unknown> = { lastAttempt: l ? { id: l.id, pct: l.pct, status: l.status, submittedAt: l.submittedAt, passed: l.status === "marked" && l.pct != null ? l.pct >= (a.passMarkPct ?? 0) : null } : null };
    const s = a.subject.toLowerCase();
    if (a.type === "diagnostic") o.done = active.has(s);
    else if (cfg.requireDiagnostic && diagSubjects.has(s) && !taken.has(s) && !child.waived.includes(s)) {
      o.locked = true;
      o.lockedReason = `Take the ${a.subject} diagnostic first`;
    } else o.locked = false;
    // Retake overlay: may they start it again? (a still-running attempt is always resumable, so it isn't counted here)
    const rule = effectiveRetake(a, cfg);
    const streak = failStreak((byAssessment.get(a.id) ?? []).map((x) => ({ status: x.status, pct: x.pct, passMarkPct: x.passMarkPct ?? a.passMarkPct ?? 101, submittedAt: x.submittedAt })));
    o.retake = retakeDecision({ policy: rule.policy, cooldownHours: rule.cooldownHours, finishedAt: finishedAt.get(a.id) ?? [], granted: child.retakeGrants.includes(a.id), streak, breakAfter: cfg.retakeBreakAfter, breakMinutes: cfg.retakeBreakMinutes });
    o.audienceUnknown = audienceFit(normAudience(a.audience), facts) === "unknown";
    out.set(a.id, o);
  }
  return out;
}

hubAssessmentsCrud.post("/assessments", async (req, res) => {
  const ctx = await resolveCtx(req, res);
  if (!ctx || !requireEdit(ctx, res)) return;
  const parsed = assessmentBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues }); return; }
  const f = await shape(ctx, ctx.franchiseId, parsed.data, null, res);
  if (!f) return;
  const { _totalMarks, ...fields } = f;
  const now = nowIso();
  const doc: AssessmentDoc = { tenantId: ctx.tenantId, franchiseId: ctx.franchiseId, ...fields, createdBy: ctx.uid, createdAt: now, updatedAt: now };
  const ref = await assessmentsCol.add(doc);
  patchAssessment(ctx.tenantId, ref.id, doc); pingHub(ctx.tenantId, "hubAssessments");
  res.status(201).json({ id: ref.id, ...doc, questionCount: fields.questionIds.length, totalMarks: _totalMarks });
});

/** A visible-and-writable assessment, or a refusal already sent. Strict same-tenant only —
 *  used by DELETE, which never forks: deleting a shared assessment keeps failing exactly as
 *  before. See `writableAssessment` for the fork-aware version PUT uses. */
async function editableAssessment(ctx: HubCtx, id: string, res: Response) {
  if (!okId(id)) { res.status(404).json({ error: "Assessment not found" }); return null; }
  const snap = await assessmentsCol.doc(id).get();
  if (!snap.exists || snap.get("tenantId") !== ctx.tenantId || !canSee(ctx, snap.get("franchiseId"))) { res.status(404).json({ error: "Assessment not found" }); return null; }
  if (!canWriteRow(ctx, snap.get("franchiseId"))) { res.status(403).json({ error: "That assessment belongs to head office" }); return null; }
  return snap;
}

/** A visible assessment the caller may PUT: the caller's own returns it for an in-place update;
 *  the shared library returns it flagged to FORK (see `needsFork` in hubCore.ts) — PUT
 *  /assessments/:id then creates a new doc instead of updating this one. */
async function writableAssessment(ctx: HubCtx, id: string, res: Response): Promise<{ snap: FirebaseFirestore.DocumentSnapshot; fork: boolean } | null> {
  if (!okId(id)) { res.status(404).json({ error: "Assessment not found" }); return null; }
  const snap = await assessmentsCol.doc(id).get();
  const docTenantId = snap.get("tenantId") as string | undefined;
  if (!snap.exists || !docTenantId || !canReadContent(ctx, docTenantId) || !canSee(ctx, snap.get("franchiseId"))) { res.status(404).json({ error: "Assessment not found" }); return null; }
  if (needsFork(ctx, docTenantId)) return { snap, fork: true }; // shared library: never edited in place
  if (!canWriteRow(ctx, snap.get("franchiseId"))) { res.status(403).json({ error: "That assessment belongs to head office" }); return null; }
  return { snap, fork: false };
}

/** A quiz being unpublished while homework still has a child waiting to start it (never submitted): that submission
 *  would sit "assigned" forever — the start route 404s a parent on a draft quiz with no explanation. Homework whose
 *  hand-ins are all in (submitted/marked) is unaffected, so a tutor can still retire a fully-used quiz. Mirrors the
 *  DELETE route's "in_use" guard, just narrowed to the case that actually strands a family. */
async function homeworkAwaitingThisQuiz(tenantId: string, assessmentId: string): Promise<boolean> {
  const hwSnap = await homeworkCol.where("tenantId", "==", tenantId).where("assessmentId", "==", assessmentId).get();
  if (hwSnap.empty) return false;
  const subs = await Promise.all(hwSnap.docs.map((d) => submissionsCol.where("tenantId", "==", tenantId).where("homeworkId", "==", d.id).where("status", "==", "assigned").limit(1).get()));
  return subs.some((s) => !s.empty);
}

hubAssessmentsCrud.put("/assessments/:id", async (req, res) => {
  const ctx = await resolveCtx(req, res);
  if (!ctx || !requireEdit(ctx, res)) return;
  const parsed = assessmentBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues }); return; }
  const result = await writableAssessment(ctx, req.params.id, res);
  if (!result) return;
  const { snap, fork } = result;
  const before = snap.data() as AssessmentDoc;
  if (parsed.data.type !== before.type) { res.status(400).json({ error: "A quiz can't become a diagnostic (or back) — create a new one" }); return; }
  if (!fork && before.published !== false && parsed.data.published === false && (await homeworkAwaitingThisQuiz(ctx.tenantId, snap.id))) {
    res.status(409).json({ error: "Homework is still waiting on this quiz — mark or remove those first, or leave it published", code: "homework_in_use" });
    return;
  }
  // On a fork the tenant/franchise/self-id context is the CALLER's, not the shared doc's — a
  // shared assessment's franchiseId is always null (it belongs to no one's franchise), and the
  // fresh id means there's no "self" to exclude from the other-published-diagnostic check.
  const franchiseId = fork ? ctx.franchiseId : (before.franchiseId ?? null);
  const f = await shape(ctx, franchiseId, parsed.data, fork ? null : snap.id, res, before);
  if (!f) return;
  const { _totalMarks, ...fields } = f;
  if (!fork) {
    const patch = { ...fields, updatedAt: nowIso() };
    await snap.ref.update(patch);
    patchAssessment(ctx.tenantId, snap.id, { ...before, ...patch }); pingHub(ctx.tenantId, "hubAssessments");
    res.json({ id: snap.id, ...before, ...patch, questionCount: fields.questionIds.length, totalMarks: _totalMarks });
    return;
  }
  // Shared-library assessment: fork into a brand-new one owned by this tenant. The shared
  // original is never `.update()`d, so every other tenant's view of it is unaffected.
  const now = nowIso();
  const doc: AssessmentDoc = { ...before, ...fields, tenantId: ctx.tenantId, franchiseId, createdBy: ctx.uid, createdAt: now, updatedAt: now };
  const ref = assessmentsCol.doc();
  await ref.set(doc);
  patchAssessment(ctx.tenantId, ref.id, doc); pingHub(ctx.tenantId, "hubAssessments");
  res.json({ id: ref.id, ...doc, questionCount: fields.questionIds.length, totalMarks: _totalMarks, forked: true });
});

hubAssessmentsCrud.delete("/assessments/:id", async (req, res) => {
  const ctx = await resolveCtx(req, res);
  if (!ctx || !requireEdit(ctx, res)) return;
  const snap = await editableAssessment(ctx, req.params.id, res);
  if (!snap) return;
  // Results are a child's record: an assessment with attempts is unpublished, not deleted.
  const used = await attemptsCol.where("tenantId", "==", ctx.tenantId).where("assessmentId", "==", snap.id).limit(1).get();
  if (!used.empty) { res.status(409).json({ error: "Students have taken this — unpublish it instead of deleting it", code: "has_attempts" }); return; }
  const hw = await homeworkCol.where("tenantId", "==", ctx.tenantId).where("assessmentId", "==", snap.id).limit(1).get();
  if (!hw.empty) { res.status(409).json({ error: "Homework uses this — remove it from the homework first", code: "in_use" }); return; }
  await snap.ref.delete();
  patchAssessment(ctx.tenantId, snap.id, null); pingHub(ctx.tenantId, "hubAssessments");
  res.json({ ok: true });
});

const allowRetakeBody = z.object({ childId: z.string().min(1).max(100) });

// POST /assessments/:id/allow-retake {childId} — a tutor grants exactly ONE more attempt for this student
// (spent when they start it; idempotent). Needs to be able to see the assessment and to teach the student —
// a franchise tutor can allow a retake of a head-office quiz for their own student.
hubAssessmentsCrud.post("/assessments/:id/allow-retake", async (req, res) => {
  const ctx = await resolveCtx(req, res);
  if (!ctx || !requireEdit(ctx, res)) return;
  const parsed = allowRetakeBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues }); return; }
  const notFound = () => res.status(404).json({ error: "Assessment not found" });
  if (!okId(req.params.id)) { notFound(); return; }
  const snap = await assessmentsCol.doc(req.params.id).get();
  if (!snap.exists || !canReadContent(ctx, snap.get("tenantId")) || !canSee(ctx, snap.get("franchiseId"))) { notFound(); return; }
  const child = await childFor(ctx, parsed.data.childId, res);
  if (!child) return;
  if (!canWriteRow(ctx, child.franchiseId)) { res.status(403).json({ error: "That student belongs to head office" }); return; }
  const asm = snap.data() as AssessmentDoc;
  if (!fitsChild(asm.franchiseId, child) || !childSubjectOk(child, asm.subject)) { notFound(); return; }
  await hubEnrolments.doc(enrolmentId(ctx.tenantId, child.childId)).update({ retakeGrants: FieldValue.arrayUnion(snap.id), updatedAt: nowIso() });
  res.json({ ok: true, childId: child.childId, assessmentId: snap.id, retake: { allowed: true, reason: null, nextAvailableAt: null } });
});
