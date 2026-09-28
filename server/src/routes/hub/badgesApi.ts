import { Router } from "express";
import { db } from "../../firebase";
import { okId, resolveCtx } from "../../lib/hubCore";
import { BADGE_IDS, computeBadges, type BadgeAttempt } from "../../lib/hubBadges";
import { attemptsCol, requestedChild } from "./shared";
import { reviewsCol, submissionsCol, homeworkCol } from "./teachingCommon";

// Learning Hub — a child's badges. GET /badges?childId= (a parent / the child's device gets their own child; a tutor names one of theirs).
// Read-only and derived (lib/hubBadges.ts): nothing is stored per child. The answer is cached for a minute so a home page that asks
// on every visit costs its reads once, not every time.

export const hubBadgesApi = Router();

const TTL_MS = 60_000;
const cache = new Map<string, { at: number; body: unknown }>();

hubBadgesApi.get("/badges", async (req, res) => {
  const ctx = await resolveCtx(req, res);
  if (!ctx) return;
  const child = await requestedChild(ctx, req.query.childId, res, false);
  if (!child) return;
  const key = `${ctx.tenantId}__${child.childId}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) { res.json(hit.body); return; }

  const [atts, subs, revs] = await Promise.all([
    attemptsCol.where("tenantId", "==", ctx.tenantId).where("childId", "==", child.childId).select("assessmentId", "assessmentType", "status", "scoreMarks", "maxMarks", "submittedAt").get(),
    submissionsCol.where("tenantId", "==", ctx.tenantId).where("childId", "==", child.childId).select("homeworkId", "status", "submittedAt").get(),
    reviewsCol.where("tenantId", "==", ctx.tenantId).where("childId", "==", child.childId).select("lastReviewedAt").get(),
  ]);
  const hwIds = [...new Set(subs.docs.map((d) => d.get("homeworkId") as string).filter(okId))];
  const due = new Map<string, string>();
  if (hwIds.length) for (const s of await db.getAll(...hwIds.map((id) => homeworkCol.doc(id)), { fieldMask: ["tenantId", "dueAt"] })) if (s.exists && s.get("tenantId") === ctx.tenantId) due.set(s.id, s.get("dueAt") as string);

  const attempts: BadgeAttempt[] = atts.docs.map((d) => ({
    assessmentId: d.get("assessmentId") as string, type: (d.get("assessmentType") as string | undefined) ?? "quiz", status: d.get("status") as string,
    scoreMarks: Number(d.get("scoreMarks")) || 0, maxMarks: Number(d.get("maxMarks")) || 0, submittedAt: (d.get("submittedAt") as string | null | undefined) ?? null,
  }));
  const badges = computeBadges({
    now: Date.now(), attempts,
    handIns: subs.docs.map((d) => ({ status: d.get("status") as string, submittedAt: (d.get("submittedAt") as string | null | undefined) ?? null, dueAt: due.get(d.get("homeworkId") as string) ?? null })),
    cardsReviewed: revs.size,
    reviewedAt: revs.docs.map((d) => Date.parse(d.get("lastReviewedAt") as string)),
  });
  const body = { childId: child.childId, badges, earned: badges.filter((b) => b.earned).length, total: BADGE_IDS.length };
  cache.set(key, { at: Date.now(), body });
  if (cache.size > 2000) for (const k of [...cache.keys()].slice(0, 500)) cache.delete(k); // bounded
  res.json(body);
});
