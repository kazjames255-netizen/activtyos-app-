import type { Request, Response } from "express";
import { db } from "../../firebase";
import { canSee, canSeeStudent, canWriteRow, hubEnrolments, okId, subjectAllowed, type EnrolledChild, type EnrolmentDoc, type HubCtx } from "../../lib/hubCore";
import { signImageUrl } from "../../lib/signing";
import { tenantRoster, tenantTopics } from "../../lib/hubIndex";

// Shared helpers for the teaching-side routers (homework, flashcards, lessons).
// Access decisions stay in lib/hubCore.ts; this only wraps the lookups those
// routers all need so every one of them answers "which students / which topic"
// the same way.

export const topicsCol = db.collection("hubTopics");
export const notesCol = db.collection("hubNotes");
export const assessmentsCol = db.collection("hubAssessments");
export const attemptsCol = db.collection("hubAttempts");
export const homeworkCol = db.collection("hubHomework");
export const submissionsCol = db.collection("hubSubmissions");
export const flashcardsCol = db.collection("hubFlashcards");
export const reviewsCol = db.collection("hubFlashcardReviews");
export const lessonsCol = db.collection("hubLessons");
export const imagesCol = db.collection("images");
export const doubtsCol = db.collection("hubDoubts");

export const nowIso = () => new Date().toISOString();

export function chunk<T>(xs: T[], n = 10): T[][] {
  return Array.from({ length: Math.ceil(xs.length / n) }, (_, i) => xs.slice(i * n, i * n + n));
}

/** Every enrolment row for the tenant (active or not) the caller may SEE, by child id. */
export async function tenantEnrolments(ctx: HubCtx): Promise<Map<string, EnrolmentDoc>> {
  const m = new Map<string, EnrolmentDoc>();
  for (const e of await tenantRoster(ctx.tenantId)) if (canSeeStudent(ctx, e.franchiseId)) m.set(e.childId, e);
  return m;
}

/** The enrolments behind these child ids — every one must be ACTIVE, in this
 *  tenant and in the caller's scope, else null (the route answers 404: an id that
 *  isn't the caller's own student is indistinguishable from one that doesn't exist). */
export async function eligibleStudents(ctx: HubCtx, childIds: string[]): Promise<EnrolmentDoc[] | null> {
  const ids = [...new Set(childIds)];
  if (ids.some((id) => !okId(id))) return null;
  if (!ids.length) return [];
  const snaps = await db.getAll(...ids.map((id) => hubEnrolments.doc(`${ctx.tenantId}__${id}`)));
  const out: EnrolmentDoc[] = [];
  for (const s of snaps) {
    if (!s.exists) return null;
    const e = s.data() as EnrolmentDoc;
    if (e.tenantId !== ctx.tenantId || e.active === false || !canSeeStudent(ctx, e.franchiseId)) return null;
    out.push(e);
  }
  return out;
}

/** A topic this caller may see (tenant + franchise scope), or null. */
export async function visibleTopic(ctx: HubCtx, topicId: unknown) {
  if (!okId(topicId)) return null;
  const s = await topicsCol.doc(topicId).get();
  if (!s.exists || s.get("tenantId") !== ctx.tenantId || !canSeeStudent(ctx, s.get("franchiseId"))) return null;
  if (ctx.role === "parent" && !subjectAllowed(ctx, s.get("subject") as string)) return null;
  return { id: s.id, subject: s.get("subject") as string, topic: s.get("topic") as string, subtopic: (s.get("subtopic") as string | null) ?? null, parentTopicId: (s.get("parentTopicId") as string | null) ?? null, franchiseId: (s.get("franchiseId") as string | null) ?? null };
}

/** The topic itself plus its subtopics (so filtering on a topic includes its children). */
export async function topicFamily(tenantId: string, topicId: string): Promise<Set<string>> {
  return new Set([topicId, ...(await tenantTopics(tenantId)).filter((t) => t.parentTopicId === topicId).map((t) => t.id)]);
}

/** The ONE child a parent request is about: `?childId=`, else `body.childId`,
 *  else the only enrolled child. Sends 400/404 and returns null otherwise. */
export function parentChild(ctx: HubCtx, res: Response, bodyChildId?: unknown): EnrolledChild | null {
  const inBody = typeof bodyChildId === "string" && bodyChildId ? bodyChildId : null;
  // Two different students named in one request is a mistake — refuse rather than guess.
  if (ctx.childId && inBody && ctx.childId !== inBody) { res.status(400).json({ error: "?childId= and the body's childId disagree" }); return null; }
  const wanted = ctx.childId ?? inBody;
  if (wanted) {
    const c = ctx.children.find((k) => k.childId === wanted);
    if (!c) { res.status(404).json({ error: "Student not found" }); return null; }
    return c;
  }
  if (ctx.children.length === 1) return ctx.children[0];
  res.status(400).json({ error: "Which student? Pass ?childId=" });
  return null;
}

export const isParent = (ctx: HubCtx) => ctx.role === "parent" && !ctx.canEdit;

export interface StoredFile { id: string; name: string; contentType: string; size: number }
/** Stored attachment → what a client gets: a short-lived signed link, never the bare id URL. */
export const filesOut = (req: Request, list: StoredFile[] | undefined) => {
  const base = `${req.protocol}://${req.get("host")}/api/images`;
  return (list ?? []).map((a) => ({ ...a, url: signImageUrl(`${base}/${a.id}`) as string }));
};

/** Best-effort removal of private hub files a record no longer uses. */
export async function dropHubFiles(tenantId: string, ids: string[]) {
  await Promise.all(ids.map(async (id) => {
    if (!okId(id)) return;
    const ref = imagesCol.doc(id);
    const s = await ref.get();
    if (s.exists && s.get("tenantId") === tenantId && s.get("kind") === "hub") await ref.delete();
  })).catch(() => {});
}

/** ISO string from a date-ish input, or null. */
export function toIso(v: unknown): string | null {
  if (typeof v !== "string" || !v.trim()) return null;
  // A bare date ("2026-03-10", what a date picker sends) means the END of that day.
  const d = new Date(/^\d{4}-\d{2}-\d{2}$/.test(v.trim()) ? `${v.trim()}T23:59:00.000Z` : v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export { canSee, canWriteRow };

/** Best-effort: every private file uploaded against a submission, except `keep`
 *  (uploads a parent never attached must not linger). */
export async function dropSubmissionFiles(tenantId: string, submissionId: string, keep: string[] = []) {
  try {
    const snap = await imagesCol.where("submissionId", "==", submissionId).get();
    const kept = new Set(keep);
    await Promise.all(snap.docs.filter((d) => d.get("tenantId") === tenantId && d.get("kind") === "hub" && !kept.has(d.id)).map((d) => d.ref.delete()));
  } catch { /* best-effort */ }
}
