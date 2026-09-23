import { Router, type Response } from "express";
import { z } from "zod";
import { db } from "../../firebase";
import { canSee, hubConfig, okId, resolveCtx, type HubCtx } from "../../lib/hubCore";
import { imageBase, pictureOf } from "../../lib/hubMedia";
import { cleanKindResponse, presentMatch, presentOrder, type Pair } from "../../lib/hubKinds";
import { inferRule, markResponse, revealAllowed } from "../../lib/hubScoring";
import { assessmentRows } from "../../lib/hubIndex";
import { fitsChild, loadTopics, questionsCol, requestedChild, type ChildRef, type QuestionDoc } from "./shared";
import { normalizeLesson } from "../../../../features/learninghub/lesson/types";

// Learning Hub — the interactive LESSON player's two question endpoints (features/learninghub/lesson).
//
// A lesson (`hubNotes.lesson`) has a WARM-UP: a few check-in questions (`lesson.warmupQuestionIds`, ordinary hubQuestions)
// shown one at a time with instant feedback. They are practice, not a paper: nothing is stored and nothing feeds mastery.
// The EXIT QUIZ (`lesson.quizId`) is a normal published assessment, taken through the normal attempt endpoints, so its
// result, mastery and retake rules are the real ones (see routes/hub/attempts.ts).
//
//   GET  /notes/:id/lesson-questions[?childId=]   → { warmup: TakeQuestion[] (+hint), quiz: {id,title,questionCount}|null }
//   POST /notes/:id/warmup-check[?childId=] {questionId, response} → { correct, pending, marks…, correctAnswer?, explanation? }
//
// The answer key never leaves inside GET (same as a running attempt). A check reveals the key for THAT question only
// after the pupil has committed an answer, and only when settings.hub.revealAnswers allows (tutors always).

export const hubLessonApi = Router();

const notesCol = db.collection("hubNotes");
const MAX_WARMUP = 12;

interface Ctxed { ctx: HubCtx; child: ChildRef | null; lesson: { warmupQuestionIds?: string[]; quizId?: string | null }; noteId: string }

/** The lesson behind a note id, if THIS caller may read the note (same rules as GET /notes/:id) — else a 404 has been sent. */
async function lessonFor(req: import("express").Request, res: Response): Promise<Ctxed | null> {
  const ctx = await resolveCtx(req, res);
  if (!ctx) return null;
  const id = req.params.id;
  const nf = () => { res.status(404).json({ error: "Lesson not found" }); return null; };
  if (!okId(id)) return nf();
  const snap = await notesCol.doc(id).get();
  const n = snap.exists ? (snap.data() as { tenantId: string; franchiseId: string | null; topicId: string; published?: boolean; lesson?: Ctxed["lesson"] | null }) : null;
  if (!n || n.tenantId !== ctx.tenantId || !canSee(ctx, n.franchiseId) || (!ctx.canEdit && n.published === false)) return nf();
  if (!(await loadTopics(ctx)).some((t) => t.id === n.topicId)) return nf();
  if (!n.lesson || typeof n.lesson !== "object") return nf();
  // A family acts for ONE child (an enrolled one); a tutor previews without a child.
  const child = await requestedChild(ctx, req.query.childId, res, ctx.canEdit);
  if (child === undefined) return null;
  return { ctx, child, lesson: n.lesson, noteId: snap.id };
}

const isChoice = (m: string) => m === "choice" || m === "multi";

/** The warm-up questions this caller may see, in the lesson's order (published, this tenant's, in scope). */
async function warmupDocs(c: Ctxed, fromQuiz = false) {
  // A tutor's PREVIEW of the lesson can run the exit quiz as practice (?set=quiz): its questions are served through the same
  // instant-check path as the warm-up and nothing is recorded. Pupils always get the warm-up set only.
  let ids = (c.lesson.warmupQuestionIds ?? []).filter(okId).slice(0, MAX_WARMUP);
  if (fromQuiz && c.ctx.canEdit && c.lesson.quizId) {
    const a = (await assessmentRows(c.ctx.tenantId)).get(c.lesson.quizId);
    if (a && a.tenantId === c.ctx.tenantId) ids = (a.questionIds ?? []).filter(okId).slice(0, 40);
  }
  if (!ids.length) return [];
  const snaps = await db.getAll(...ids.map((id) => questionsCol.doc(id)));
  const cfg = await hubConfig(c.ctx.tenantId, c.child?.franchiseId ?? c.ctx.franchiseId);
  const out: { id: string; q: QuestionDoc; mark: ReturnType<typeof inferRule> }[] = [];
  for (const s of snaps) {
    if (!s.exists) continue;
    const q = s.data() as QuestionDoc;
    if (q.tenantId !== c.ctx.tenantId || q.published === false) continue;
    if (c.child ? !fitsChild(q.franchiseId, c.child) : !canSee(c.ctx, q.franchiseId)) continue;
    const mark = cfg.questionKinds.find((k) => k.id === q.kind)?.mark ?? inferRule(q);
    if (mark === "tool") continue; // a warm-up is instant-feedback practice with no drawing surface — tool questions belong in a real quiz
    out.push({ id: s.id, q, mark });
  }
  return out;
}

/** The key of a question in the shape the attempt snapshot uses (match → pairs, order → items). */
const keyOf = (q: QuestionDoc, mark: string): unknown => (mark === "match" ? q.pairs ?? null : mark === "order" ? q.items ?? null : q.answer ?? null);

hubLessonApi.get("/notes/:id/lesson-questions", async (req, res) => {
  const c = await lessonFor(req, res);
  if (!c) return;
  const base = imageBase(req);
  const seedBase = `warmup:${c.noteId}:${c.child?.childId ?? "tutor"}`;
  const warmup = (await warmupDocs(c, req.query.set === "quiz")).map(({ id, q, mark }) => {
    const key = keyOf(q, mark);
    const hint = typeof (q as { hint?: unknown }).hint === "string" ? ((q as { hint?: string }).hint as string).slice(0, 500) : "";
    return {
      id, kind: q.kind, prompt: q.prompt, marks: q.marks, topicId: q.topicId,
      image: pictureOf(base, q.image),
      ...(isChoice(mark) ? { options: (q.options ?? []).map((o) => ({ id: o.id, text: o.text, ...(pictureOf(base, o.image) ? { image: { url: pictureOf(base, o.image)!.url } } : {}) })) } : {}),
      ...(mark === "match" && Array.isArray(key) ? presentMatch(key as Pair[], `${seedBase}:${id}`) : {}),
      ...(mark === "order" && Array.isArray(key) ? { items: presentOrder(key as string[], `${seedBase}:${id}`) } : {}),
      ...(hint ? { hint } : {}),
    };
  });
  let quiz: { id: string; title: string; questionCount: number } | null = null;
  if (c.lesson.quizId) {
    const a = (await assessmentRows(c.ctx.tenantId)).get(c.lesson.quizId);
    const visible = a && a.tenantId === c.ctx.tenantId && canSee(c.ctx, a.franchiseId) && (c.ctx.canEdit || a.published !== false) && (!c.child || fitsChild(a.franchiseId, c.child));
    if (a && visible) quiz = { id: a.id, title: a.title, questionCount: a.questionIds?.length ?? 0 };
  }
  res.json({ warmup, quiz });
});

// GET /notes/:id/slide-peek?slide=<n> — "Ask my teacher"'s "View slide": the ONE slide a thread is about, for
// whoever may see the THREAD (a family in it, or the tutor) — not gated on the family having been formally set
// this lesson as homework (GET /notes/:id's rule), since being IN the conversation about it already proves they
// were shown it. Same tenant/franchise visibility as everywhere else; never the answer key beyond what a slide
// itself already shows (slides carry no marked answers).
hubLessonApi.get("/notes/:id/slide-peek", async (req, res) => {
  const ctx = await resolveCtx(req, res);
  if (!ctx) return;
  const nf = () => { res.status(404).json({ error: "Lesson not found" }); return; };
  if (!okId(req.params.id)) return nf();
  const snap = await notesCol.doc(req.params.id).get();
  const n = snap.exists ? (snap.data() as { tenantId: string; franchiseId: string | null; title: string; published?: boolean; lesson?: unknown }) : null;
  if (!n || n.tenantId !== ctx.tenantId || !canSee(ctx, n.franchiseId) || (!ctx.canEdit && n.published === false)) return nf();
  if (!n.lesson || typeof n.lesson !== "object") return nf();
  const idx = Math.max(0, Math.trunc(Number(req.query.slide)) || 0);
  const lesson = normalizeLesson(n.lesson, n.title);
  const slides = lesson.deckSlides.length ? lesson.deckSlides : lesson.slides;
  res.json({ title: lesson.title, slide: slides[idx] ?? null });
});

const checkBody = z.object({ questionId: z.string().min(1).max(100), response: z.unknown() });

hubLessonApi.post("/notes/:id/warmup-check", async (req, res) => {
  const c = await lessonFor(req, res);
  if (!c) return;
  const parsed = checkBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues }); return; }
  const wanted = parsed.data.questionId;
  const row = (await warmupDocs(c, req.query.set === "quiz")).find((r) => r.id === wanted);
  if (!row) { res.status(404).json({ error: "That question isn't part of this lesson's warm-up" }); return; }
  const { q, mark } = row;
  // Same cleaning as a submitted attempt: text, a number, option ids, or a match/order arrangement.
  const r = parsed.data.response;
  const response = cleanKindResponse(r) ?? (typeof r === "string" ? r.slice(0, 10_000) : typeof r === "number" && Number.isFinite(r) ? r : Array.isArray(r) ? r.filter((x): x is string => typeof x === "string").slice(0, 50).map((x) => x.slice(0, 200)) : null);
  const o = markResponse({ mark, answer: keyOf(q, mark), acceptedAnswers: q.acceptedAnswers ?? [], tolerance: q.tolerance ?? 0, marks: q.marks }, response);
  const cfg = await hubConfig(c.ctx.tenantId, c.child?.franchiseId ?? c.ctx.franchiseId);
  const reveal = c.ctx.canEdit || revealAllowed(cfg.revealAnswers, o.pending ? "pending_marking" : "marked");
  res.json({
    questionId: wanted, correct: o.correct, pending: o.pending, marksAwarded: o.marksAwarded, marksMax: q.marks,
    ...(reveal ? {
      correctAnswer: keyOf(q, mark),
      ...(mark === "exact" && q.acceptedAnswers?.length ? { acceptedAnswers: q.acceptedAnswers } : {}),
      ...(q.explanation ? { explanation: q.explanation } : {}),
    } : {}),
  });
});
