import { Router } from "express";
import { z } from "zod";
import { audienceFit, normAudience } from "../../lib/hubRules";
import { assessmentRows, noteIndex, tenantTopics, type AsmRow, type NoteRow } from "../../lib/hubIndex";
import { computeTopicMastery, type AttemptLite } from "../../lib/hubMastery";
import { canSee, canSeeStudent, type EnrolmentDoc, childDobs, effectiveYearGroup, hubConfig, okId, requireEdit, resolveCtx, subjectAllowed } from "../../lib/hubCore";
import { activeMembers, visibleGroups } from "../../lib/hubGroups";
import {
  buildPlan, childSignals, groupSignals, type PlanNote, type PlanQuiz, type PlanSupport, type PlanTopic, type TopicSignal,
} from "../../lib/hubPlan";
import { attemptsCol, childFor, childSubjectOk, fitsChild, homeworkCol, type ChildRef } from "./shared";
import { cleanSupport } from "../../../../features/learninghub/support";

const refOf = (e: EnrolmentDoc): ChildRef => ({
  childId: e.childId, childName: e.childName ?? "", franchiseId: e.franchiseId ?? null, subjects: e.subjects ?? [], parentUid: e.parentUid,
  waived: [], active: e.active !== false, yg: { yearGroup: e.yearGroup, yearGroupAuto: e.yearGroupAuto }, retakeGrants: [], support: cleanSupport(e.support),
});

// Learning Hub — AUTO-PLAN A WEEK (suggest only). GET /plan/suggest?childId=|groupId=&days=7&minutesPerDay=20
// Returns a ranked, explained plan built by lib/hubPlan.ts (pure rules). NOTHING is created or assigned: the tutor
// reviews the cards and, if they accept, the client posts the chosen items to POST /homework itself.
// Reads only cached indexes (topics / notes / assessments) + ONE targeted query per student (attempts, recent homework).

export const hubPlanApi = Router();
const PROF = process.env.PLAN_PROFILE === "1";
const lap = (label: string, t0: number) => { if (PROF) console.log(`[plan] ${label} ${Date.now() - t0}ms`); };

const MAX_GROUP = 40;
const RECENT_DAYS = 10;
const query = z.object({
  childId: z.string().max(100).optional(),
  groupId: z.string().max(100).optional(),
  days: z.coerce.number().int().min(1).max(14).default(7),
  minutesPerDay: z.coerce.number().int().min(5).max(90).optional(),
  subject: z.string().max(80).optional(),
});

// ── candidate index: topicId -> quizzes / notes. Rebuilt at most every 30s from the (already cached) tenant maps, so a
//    request iterates ~15 weak topics' lists, not 8k notes. ──
interface CandIdx { at: number; size: string; quizzes: Map<string, AsmRow[]>; notes: Map<string, NoteRow[]> }
const idxMemo = new Map<string, CandIdx>();
async function candidates(tenantId: string): Promise<CandIdx> {
  const [asm, notes] = await Promise.all([assessmentRows(tenantId), noteIndex(tenantId)]);
  const sig = `${asm.size}/${notes.size}`;
  const hit = idxMemo.get(tenantId);
  if (hit && hit.size === sig && Date.now() - hit.at < 30_000) return hit;
  const quizzes = new Map<string, AsmRow[]>();
  for (const a of asm.values()) {
    if (a.type !== "quiz" || a.published === false) continue;
    for (const t of a.topicIds ?? []) { const l = quizzes.get(t); if (l) l.push(a); else quizzes.set(t, [a]); }
  }
  const nm = new Map<string, NoteRow[]>();
  for (const n of notes.values()) {
    if (!n.published || n.kind === "board" || !n.topicId || !(n.isLesson || n.hasWorksheet)) continue;
    const l = nm.get(n.topicId); if (l) l.push(n); else nm.set(n.topicId, [n]);
  }
  const idx = { at: Date.now(), size: sig, quizzes, notes: nm };
  idxMemo.set(tenantId, idx);
  return idx;
}

interface Kid { ref: ChildRef; yearLabel: string | null; age: number | null }

async function loadChildData(tenantId: string, childId: string) {
  const [att, hw] = await Promise.all([
    attemptsCol.where("tenantId", "==", tenantId).where("childId", "==", childId)
      .select("assessmentId", "assessmentType", "status", "subject", "submittedAt", "byTopic", "baselineReset", "startedAt").get(),
    homeworkCol.where("assignedChildIds", "array-contains", childId).select("tenantId", "assessmentId", "noteIds", "worksheetNoteIds", "createdAt").get(),
  ]);
  return { attempts: att.docs.map((d) => ({ id: d.id, ...(d.data() as Record<string, unknown>) })) as (AttemptLite & { assessmentId?: string; startedAt?: string })[], hw: hw.docs.filter((d) => d.get("tenantId") === tenantId) };
}

hubPlanApi.get("/plan/suggest", async (req, res) => {
  const ctx = await resolveCtx(req, res);
  if (!ctx || !requireEdit(ctx, res)) return;
  const q = query.safeParse(req.query);
  if (!q.success) { res.status(400).json({ error: q.error.issues }); return; }
  const { childId, groupId, days, minutesPerDay } = q.data;
  if (!!childId === !!groupId) { res.status(400).json({ error: "Pass exactly one of ?childId= or ?groupId=" }); return; }

  let tp = Date.now();
  const cfg = await hubConfig(ctx.tenantId, ctx.franchiseId);
  lap("cfg", tp); tp = Date.now();
  const kids: Kid[] = [];
  let group: { name: string; size: number } | null = null;
  if (childId) {
    const c = await childFor(ctx, childId, res);
    if (!c) return;
    kids.push({ ref: c, yearLabel: null, age: null });
  } else {
    if (!okId(groupId)) { res.status(404).json({ error: "Group not found" }); return; }
    const gs = await visibleGroups(ctx, [groupId!]);
    if (!gs || !gs.length) { res.status(404).json({ error: "Group not found" }); return; }
    const members = (await activeMembers(ctx, gs)).filter((e) => canSeeStudent(ctx, e.franchiseId)).slice(0, MAX_GROUP);
    if (!members.length) { res.status(400).json({ error: "That group has no active students" }); return; }
    group = { name: (gs[0] as { name?: string }).name ?? "Group", size: members.length };
    for (const e of members) kids.push({ ref: refOf(e), yearLabel: null, age: null });
  }
  lap("kids", tp); tp = Date.now();
  const dataP = Promise.all(kids.map((k) => loadChildData(ctx.tenantId, k.ref.childId))); // overlaps the dob + index work below
  dataP.catch(() => undefined);
  const dobs = await childDobs(kids.map((k) => k.ref.childId));
  const now = new Date();
  for (const k of kids) {
    const dob = dobs.get(k.ref.childId) ?? null;
    k.yearLabel = effectiveYearGroup(k.ref.yg, dob, cfg.yearGroups);
    k.age = dob ? Math.floor((now.getTime() - Date.parse(dob)) / (365.25 * 86_400_000)) : null;
  }
  const yr = (l: string | null) => { const m = l ? /(\d{1,2})/.exec(l) : null; return m ? Number(m[1]) : null; };
  const years = kids.map((k) => yr(k.yearLabel)).filter((x): x is number => x !== null).sort((a, b) => a - b);
  const yearNumber = years.length ? years[Math.floor(years.length / 2)] : null;

  // strictest support across the group (calm if any; largest extra time; untimed if any).
  const support: PlanSupport = {
    noTimer: kids.some((k) => k.ref.support.noTimer), calm: kids.some((k) => k.ref.support.calm),
    extraTimePercent: Math.max(0, ...kids.map((k) => k.ref.support.extraTimePercent)),
  };

  lap("dobs", tp); tp = Date.now();
  // topics this cohort can be taught (franchise + enrolled subjects).
  const allTopics = (await tenantTopics(ctx.tenantId)).filter((t) => canSee(ctx, t.franchiseId) && subjectAllowed(ctx, t.subject));
  const subjectFilter = q.data.subject?.toLowerCase();
  const topics = new Map<string, PlanTopic>();
  for (const t of allTopics) {
    if (subjectFilter && t.subject.toLowerCase() !== subjectFilter) continue;
    if (!kids.every((k) => fitsChild(t.franchiseId, k.ref) && childSubjectOk(k.ref, t.subject))) continue;
    topics.set(t.id, { id: t.id, subject: t.subject, topic: t.topic, subtopic: t.subtopic ?? null });
  }

  lap("topics", tp); tp = Date.now();
  // per-student evidence (one attempts query + one homework query each; groups run in parallel, capped at 40).
  const recentAssessments = new Map<string, string>();
  const recentNotes = new Map<string, string>();
  const everAttempted = new Map<string, string>();
  const recentTopics = new Map<string, string>();
  const perChild: TopicSignal[][] = [];
  const cutoff = new Date(now.getTime() - RECENT_DAYS * 86_400_000).toISOString();
  const data = await dataP;
  const hwTopicOf = new Map<string, string>(); // filled after candidates load
  lap("childData", tp); tp = Date.now();
  const cand = await candidates(ctx.tenantId);
  lap("cand", tp); tp = Date.now();
  for (const list of cand.quizzes.values()) for (const a of list) for (const t of a.topicIds ?? []) hwTopicOf.set(a.id, t);
  const noteTopic = new Map<string, string>();
  for (const list of cand.notes.values()) for (const n of list) noteTopic.set(n.id, n.topicId);
  const bump = (m: Map<string, string>, id: string, at: string) => { if (!m.get(id) || m.get(id)! < at) m.set(id, at); };
  data.forEach((d, i) => {
    const rows = [...computeTopicMastery(d.attempts).values()];
    const marked = d.attempts.filter((a) => a.assessmentType === "quiz" && a.status === "marked" && a.submittedAt).sort((a, b) => (b.submittedAt ?? "").localeCompare(a.submittedAt ?? ""));
    const last = new Map<string, number>();
    for (const a of marked) for (const [tid, s] of Object.entries(a.byTopic ?? {})) if (!last.has(tid) && s.max > 0) last.set(tid, Math.round((s.got / s.max) * 100));
    perChild.push(childSignals(rows, last));
    for (const a of d.attempts) {
      const at = a.submittedAt ?? a.startedAt ?? ""; const aid = a.assessmentId;
      if (aid && at) { bump(everAttempted, aid, at); if (at >= cutoff) bump(recentAssessments, aid, at); }
    }
    for (const h of d.hw) {
      const at = (h.get("createdAt") as string | undefined) ?? "";
      if (!at || at < cutoff) continue;
      const aid = h.get("assessmentId") as string | null;
      if (aid) { bump(recentAssessments, aid, at); bump(everAttempted, aid, at); const t = hwTopicOf.get(aid); if (t) bump(recentTopics, t, at); }
      for (const id of [...((h.get("noteIds") as string[] | undefined) ?? []), ...((h.get("worksheetNoteIds") as string[] | undefined) ?? [])]) {
        bump(recentNotes, id, at); const t = noteTopic.get(id); if (t) bump(recentTopics, t, at);
      }
    }
    void i;
  });
  const signals = (group ? groupSignals(perChild, group.size) : perChild[0]).filter((s) => topics.has(s.topicId));

  // candidate content for the weak topics only.
  const weak = new Set(signals.filter((s) => s.pct < 75).map((s) => s.topicId));
  const asmAll = await assessmentRows(ctx.tenantId);
  const kidFacts = kids.map((k) => ({ yearGroup: k.yearLabel, age: k.age }));
  const audOk = (a: AsmRow) => { const aud = normAudience(a.audience); const no = kidFacts.filter((f) => audienceFit(aud, f) === "no").length; return no * 2 <= kidFacts.length && (kidFacts.length > 1 || no === 0); };
  const toQuiz = (a: AsmRow): PlanQuiz => ({ id: a.id, title: a.title, topicIds: a.topicIds ?? [], timeLimitMins: a.timeLimitMins ?? null, questionCount: (a.questionIds ?? []).length });
  const quizzesByTopic = new Map<string, PlanQuiz[]>();
  const notesByTopic = new Map<string, PlanNote[]>();
  for (const t of weak) {
    const franchiseOk = (f: string | null | undefined) => kids.every((k) => fitsChild(f, k.ref));
    quizzesByTopic.set(t, (cand.quizzes.get(t) ?? []).filter((a) => franchiseOk(a.franchiseId) && audOk(a)).map(toQuiz));
    notesByTopic.set(t, (cand.notes.get(t) ?? []).filter((n) => franchiseOk(n.franchiseId)).map((n): PlanNote => {
      const wq = n.worksheetQuizId ? asmAll.get(n.worksheetQuizId) : undefined;
      return {
        id: n.id, title: n.title, topicId: n.topicId, readMinutes: n.readMinutes, isLesson: n.isLesson, hasWorksheet: n.hasWorksheet, lessonYear: n.lessonYear,
        worksheetQuiz: wq && wq.published !== false && franchiseOk(wq.franchiseId) ? toQuiz(wq) : null,
      };
    }));
  }

  lap("prep", tp); tp = Date.now();
  const plan = buildPlan({
    now, days, minutesPerDay, signals, topics, quizzesByTopic, notesByTopic, recentAssessments, recentNotes, everAttempted, recentTopics,
    yearNumber, support, group,
  });
  res.json({
    target: childId ? { kind: "child", childId, childName: kids[0].ref.childName } : { kind: "group", groupId, name: group!.name, size: group!.size },
    yearGroup: childId ? kids[0].yearLabel : null,
    generatedAt: now.toISOString(),
    support,
    ...plan,
  });
});
