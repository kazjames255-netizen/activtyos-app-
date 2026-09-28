import { Router } from "express";
import { z } from "zod";
import { db } from "../../firebase";
import { canSeeStudent, canWriteRow, hubConfig, requireEdit, resolveCtx, subjectAllowed } from "../../lib/hubCore";
import { forgetHub, hubCached } from "../../lib/hubCache";
import { noteIndex, questionIndex, tenantRoster, tenantTopics } from "../../lib/hubIndex";
import { bandFor, computeTopicMastery, rollupSubject, trendOf, type AttemptLite, type Extra } from "../../lib/hubMastery";
import { overallAttainment } from "../../lib/hubRules";
import {
  attemptsCol, childFor, childSubjectOk, fitsChild, loadTopics, masteryCol, nowIso, requestedChild,
  type Topic,
} from "./shared";
import { homeworkCol, reviewsCol, submissionsCol } from "./teachingCommon";

// Learning Hub — mastery. The maths is in lib/hubMastery.ts (pure). Two paths:
//  • GET /mastery (one child) is computed FRESH from that child's attempts, so it
//    can never be stale;
//  • `hubMastery` docs are the derived, recomputable copy (rebuilt after every
//    submit and every mark) that the tutor overview and data export read.

export const hubMasteryApi = Router();

const LITE = ["assessmentType", "status", "subject", "submittedAt", "byTopic", "baselineReset", "assessmentTitle", "pct"] as const;
type LiteAttempt = AttemptLite & { assessmentTitle: string; pct: number | null };

async function liteAttempts(tenantId: string, childId: string): Promise<LiteAttempt[]> {
  const snap = await attemptsCol.where("tenantId", "==", tenantId).where("childId", "==", childId).select(...LITE).get();
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<LiteAttempt, "id">) }));
}

/** Flashcards count for LESS than a quiz (a self-rated card is weaker evidence than a marked one). */
const FLASHCARD_WEIGHT = 0.3;

/** Scored evidence that is not a quiz attempt, placed on the topic it belongs to (owner: "add all"):
 *  • a marked TYPED homework (no quiz behind it: a quiz homework is already a marked attempt, so it is never counted twice), on the topics of the lessons attached to it;
 *  • the child's flashcard reviews, one small-weight slice per topic (cards rated Good / Easy out of cards reviewed).
 *  Games are deliberately NOT included: their topics are their own and do not map to the hub's, and every game already states its evidence is low weight. */
const EXTRAS_TTL_MS = 60_000;
const extrasMemo = new Map<string, { at: number; v: Promise<Extra[]> }>();
/** Cost: this reads ALL of a child's flashcard reviews + marked submissions, and used to run on every GET /mastery (and once per child
 *  in a bulk recompute). Memoised per (tenant, child) for 60s; `fresh` (used by recomputeChildMastery, i.e. right after a write that
 *  feeds mastery) bypasses AND refreshes the memo so the stored rows are never built from a stale copy. */
function loadExtras(tenantId: string, childId: string, fresh = false): Promise<Extra[]> {
  const key = `${tenantId}|${childId}`;
  const hit = extrasMemo.get(key);
  if (!fresh && hit && Date.now() - hit.at < EXTRAS_TTL_MS) return hit.v;
  const v = loadExtrasUncached(tenantId, childId);
  extrasMemo.set(key, { at: Date.now(), v });
  v.catch(() => { if (extrasMemo.get(key)?.v === v) extrasMemo.delete(key); }); // never memoise a failure
  if (extrasMemo.size > 2000) for (const [k, e] of extrasMemo) if (Date.now() - e.at > EXTRAS_TTL_MS) extrasMemo.delete(k);
  return v;
}
async function loadExtrasUncached(tenantId: string, childId: string): Promise<Extra[]> {
  const [topicRows, notes, subs, revs] = await Promise.all([
    tenantTopics(tenantId), noteIndex(tenantId),
    submissionsCol.where("tenantId", "==", tenantId).where("childId", "==", childId).where("status", "==", "marked").select("homeworkId", "attemptId", "attemptIds", "mark", "updatedAt", "submittedAt").get(),
    reviewsCol.where("tenantId", "==", tenantId).where("childId", "==", childId).select("topicId", "lastQuality", "lastReviewedAt").get(),
  ]);
  const subjectOf = new Map(topicRows.map((t) => [t.id, t.subject] as const));
  const out: Extra[] = [];
  const typed = subs.docs.filter((d) => !d.get("attemptId") && !((d.get("attemptIds") as string[] | undefined)?.length) && Number(d.get("mark.max")) > 0 && typeof d.get("mark.score") === "number");
  const hwIds = [...new Set(typed.map((d) => d.get("homeworkId") as string))];
  const noteIdsOf = new Map<string, string[]>();
  if (hwIds.length) for (const h of await db.getAll(...hwIds.map((id) => homeworkCol.doc(id)), { fieldMask: ["tenantId", "noteIds"] })) if (h.exists && h.get("tenantId") === tenantId) noteIdsOf.set(h.id, (h.get("noteIds") as string[] | undefined) ?? []);
  for (const d of typed) {
    const topics = new Set((noteIdsOf.get(d.get("homeworkId") as string) ?? []).map((n) => notes.get(n)?.topicId).filter((t): t is string => !!t && subjectOf.has(t)));
    for (const topicId of topics) {
      // A marked typed homework may lack mark.markedAt (older rows): fall back to when the row was last updated / handed in rather than dropping it.
      const max = Number(d.get("mark.max"));
      const got = Math.min(max, Math.max(0, Number(d.get("mark.score")))); // a tutor score above the maximum must not push mastery over 100%
      out.push({ topicId, subject: subjectOf.get(topicId)!, at: String(d.get("mark.markedAt") ?? d.get("updatedAt") ?? d.get("submittedAt") ?? ""), got, max, w: 1 });
    }
  }
  const perTopic = new Map<string, { got: number; max: number; at: string }>();
  for (const d of revs.docs) {
    const topicId = d.get("topicId") as string;
    if (!subjectOf.has(topicId)) continue;
    const e = perTopic.get(topicId) ?? { got: 0, max: 0, at: "" };
    e.max += 1; if (Number(d.get("lastQuality")) >= 4) e.got += 1;
    const at = String(d.get("lastReviewedAt") ?? ""); if (at > e.at) e.at = at;
    perTopic.set(topicId, e);
  }
  for (const [topicId, e] of perTopic) out.push({ topicId, subject: subjectOf.get(topicId)!, at: e.at, got: e.got, max: e.max, w: FLASHCARD_WEIGHT });
  // Only rows with NO usable date at all are dropped (mastery weights by recency, so an undated slice cannot be placed).
  return out.filter((x) => x.at);
}

/** Rebuild the stored `hubMastery` rows for one child from their attempts. Rows are
 *  derived, so this also deletes ones that no longer apply (e.g. after a baseline reset). */
export async function recomputeChildMastery(tenantId: string, childId: string, franchiseId: string | null): Promise<void> {
  const [attempts, topicRows, existing] = await Promise.all([
    liteAttempts(tenantId, childId),
    tenantTopics(tenantId), // cached: a 700-row taxonomy was re-read on EVERY submit
    masteryCol.where("tenantId", "==", tenantId).where("childId", "==", childId).select().get(),
  ]);
  const topics = new Map(topicRows.map((t) => [t.id, t] as const));
  const cfg = await hubConfig(tenantId, franchiseId);
  const rows = computeTopicMastery(attempts, await loadExtras(tenantId, childId, true));
  const now = nowIso();
  const keep = new Set<string>();
  const ops: ((b: FirebaseFirestore.WriteBatch) => void)[] = [];
  for (const r of rows.values()) {
    const t = topics.get(r.topicId);
    if (!t) continue; // its topic is gone
    const id = `${tenantId}__${childId}__${r.topicId}`;
    keep.add(id);
    ops.push((b) => b.set(masteryCol.doc(id), {
      tenantId, franchiseId, childId, topicId: r.topicId, subject: t.subject, masteryPct: r.masteryPct, band: bandFor(r.masteryPct, cfg.masteryBands),
      attempts: r.attempts, baselinePct: r.baselinePct, lastAttemptAt: r.lastAttemptAt, createdBy: "system", createdAt: now, updatedAt: now,
    }));
  }
  for (const d of existing.docs) if (!keep.has(d.id)) ops.push((b) => b.delete(d.ref));
  for (let i = 0; i < ops.length; i += 400) {
    const batch = db.batch();
    for (const op of ops.slice(i, i + 400)) op(batch);
    await batch.commit();
  }
  forgetHub(tenantId, "mastery"); // the tutor overview reads a cached copy of these rows
}

const pendingRecompute = new Map<string, ReturnType<typeof setTimeout>>();
/** Rebuild the stored `hubMastery` rows a few seconds after a write that feeds mastery but is not a quiz attempt (a flashcard review, a marked
 *  typed homework) — otherwise the tutor overview and the child's fresh GET /mastery disagree until the next quiz. Coalesced: at most one
 *  pending rebuild per child, and it reads fresh data when it fires, so a burst of 20 card reviews costs one recompute, not twenty.
 *  Fire-and-forget: never blocks or fails the request that scheduled it. */
export function scheduleMasteryRecompute(tenantId: string, childId: string, franchiseId: string | null, delayMs = 15_000): void {
  const key = `${tenantId}|${childId}`;
  if (pendingRecompute.has(key)) return;
  const t = setTimeout(() => {
    pendingRecompute.delete(key);
    recomputeChildMastery(tenantId, childId, franchiseId).catch((e) => console.warn("[mastery] scheduled recompute failed", childId, (e as Error).message));
  }, delayMs);
  t.unref?.();
  pendingRecompute.set(key, t);
}

// GET /mastery?childId= — one child's dashboard data.
hubMasteryApi.get("/mastery", async (req, res) => {
  const ctx = await resolveCtx(req, res);
  if (!ctx) return;
  const child = await requestedChild(ctx, req.query.childId, res, false);
  if (!child) return;

  const [allTopics, bank, attempts, cfg] = await Promise.all([
    loadTopics(ctx),
    questionIndex(ctx.tenantId), // the cached light index — this used to read every question document on each dashboard load
    liteAttempts(ctx.tenantId, child.childId),
    hubConfig(ctx.tenantId, child.franchiseId),
  ]);
  // What this child can be taught: head office + own franchise, enrolled subjects.
  const topics = allTopics.filter((t) => fitsChild(t.franchiseId, child) && childSubjectOk(child, t.subject) && subjectAllowed(ctx, t.subject));
  const topicById = new Map<string, Topic>(topics.map((t) => [t.id, t]));
  const withContent = new Set<string>();
  for (const q of bank.values()) {
    if (q.published && fitsChild(q.franchiseId, child) && topicById.has(q.topicId)) withContent.add(q.topicId);
  }

  const rows = computeTopicMastery(attempts, await loadExtras(ctx.tenantId, child.childId));
  const subjects = new Map<string, { subject: string; rows: ReturnType<typeof topicRow>[]; content: Set<string> }>();
  const slot = (subject: string) => {
    const k = subject.toLowerCase();
    if (!subjects.has(k)) subjects.set(k, { subject, rows: [], content: new Set() });
    return subjects.get(k)!;
  };
  const topicRow = (r: NonNullable<ReturnType<typeof rows.get>>, t: Topic) => ({
    topicId: r.topicId, topic: t.topic, subtopic: t.subtopic ?? null, masteryPct: r.masteryPct, band: bandFor(r.masteryPct, cfg.masteryBands),
    attempts: r.attempts, baselinePct: r.baselinePct, lastAttemptAt: r.lastAttemptAt,
  });
  for (const id of withContent) slot(topicById.get(id)!.subject).content.add(id);
  for (const r of rows.values()) {
    const t = topicById.get(r.topicId);
    if (t) slot(t.subject).rows.push(topicRow(r, t));
  }
  const out = [...subjects.values()]
    .sort((a, b) => a.subject.localeCompare(b.subject))
    .map((s) => {
      const roll = rollupSubject(s.subject, s.rows.map((r) => ({ ...r, subject: s.subject })), s.content.size, s.content);
      s.rows.sort((a, b) => a.topic.localeCompare(b.topic) || (a.subtopic ?? "").localeCompare(b.subtopic ?? ""));
      return {
        subject: s.subject, masteryPct: roll.masteryPct, band: bandFor(roll.masteryPct, cfg.masteryBands), coverage: roll.coverage,
        baselinePct: roll.baselinePct, growthPct: roll.growthPct, topics: s.rows,
      };
    });
  const trend = trendOf(attempts).map((a) => ({ at: a.submittedAt as string, pct: a.pct ?? 0, subject: a.subject, title: a.assessmentTitle ?? "" }));
  // Where the child ACTUALLY is (mean of attempted subjects → the tenant's band), not a game score.
  const overall = overallAttainment(out.map((s) => s.masteryPct), cfg.masteryBands);
  res.json({ childId: child.childId, childName: child.childName, subjects: out, trend, overall, bands: [...cfg.masteryBands].sort((x, y) => x.min - y.min) });
});

// GET /mastery/overview — tutors: every student at a glance (from the stored rows).
hubMasteryApi.get("/mastery/overview", async (req, res) => {
  const ctx = await resolveCtx(req, res);
  if (!ctx || !requireEdit(ctx, res)) return;
  type MRow = { childId: string; subject: string; masteryPct: number | null; lastAttemptAt: string | null; franchiseId: string | null };
  const [roster, mRows] = await Promise.all([
    tenantRoster(ctx.tenantId),
    // Only the five fields the overview shows, cached briefly (dropped whenever a mastery row is rebuilt).
    hubCached("mastery", ctx.tenantId, "overview", 20_000, async () =>
      (await masteryCol.where("tenantId", "==", ctx.tenantId).select("childId", "subject", "masteryPct", "lastAttemptAt", "franchiseId").get()).docs.map((d) => d.data() as MRow)),
  ]);
  const cfg = await hubConfig(ctx.tenantId, ctx.franchiseId);
  const byChild = new Map<string, MRow[]>();
  for (const m of mRows) {
    if (!canSeeStudent(ctx, m.franchiseId)) continue;
    const l = byChild.get(m.childId);
    if (l) l.push(m); else byChild.set(m.childId, [m]);
  }
  const students = roster
    .filter((e) => e.active !== false && canSeeStudent(ctx, e.franchiseId))
    .map((e) => {
      const ms = byChild.get(e.childId) ?? [];
      const subj = new Map<string, number[]>();
      for (const m of ms) if (m.masteryPct !== null) subj.set(m.subject, [...(subj.get(m.subject) ?? []), m.masteryPct]);
      const subjects = [...subj.entries()].map(([subject, xs]) => {
        const masteryPct = Math.round(xs.reduce((a, b) => a + b, 0) / xs.length);
        return { subject, masteryPct, band: bandFor(masteryPct, cfg.masteryBands) };
      }).sort((a, b) => a.subject.localeCompare(b.subject));
      const lastActive = ms.map((m) => m.lastAttemptAt ?? "").sort().pop() || null;
      return { childId: e.childId, childName: e.childName, subjects, lastActive };
    })
    .sort((a, b) => a.childName.localeCompare(b.childName));
  res.json({ students });
});

const recomputeBody = z.object({ childId: z.string().min(1).max(100).optional() });

// POST /mastery/recompute {childId?} — rebuild the stored rows (one child, or every visible student).
hubMasteryApi.post("/mastery/recompute", async (req, res) => {
  const ctx = await resolveCtx(req, res);
  if (!ctx || !requireEdit(ctx, res)) return;
  const parsed = recomputeBody.safeParse(req.body ?? {});
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues }); return; }
  if (parsed.data.childId) {
    const child = await childFor(ctx, parsed.data.childId, res);
    if (!child) return;
    if (!canWriteRow(ctx, child.franchiseId)) { res.status(403).json({ error: "That student belongs to head office" }); return; }
    await recomputeChildMastery(ctx.tenantId, child.childId, child.franchiseId);
    res.json({ ok: true, children: 1 });
    return;
  }
  const mine = (await tenantRoster(ctx.tenantId)).filter((e) => canSeeStudent(ctx, e.franchiseId) && canWriteRow(ctx, e.franchiseId)).slice(0, 300);
  // Bounded concurrency (4): each child is 3+ queries and a batch write — serial was slow, unbounded would spike reads/second.
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(4, mine.length) }, async () => {
    while (next < mine.length) { const e = mine[next++]!; await recomputeChildMastery(ctx.tenantId, e.childId, e.franchiseId ?? null); }
  }));
  res.json({ ok: true, children: mine.length });
});
