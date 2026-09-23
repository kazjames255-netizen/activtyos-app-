import { Router } from "express";
import { z } from "zod";
import { canSeeStudent, canWriteRow, okId, requireEdit, resolveCtx, scopedChildren, type HubCtx } from "../../lib/hubCore";
import { nameList, notifyFamilies } from "../../lib/hubNotify";
import { notify } from "../../lib/notify";
import { doubtsCol, eligibleStudents, notesCol, nowIso } from "./teachingCommon";

// Learning Hub — "Ask my teacher": a real two-way thread raised from inside a lesson (a slide, a warm-up/quiz
// question), tied to the exact spot it was asked from. A family can keep replying (LessonPlayer's AskTeacher.tsx);
// a tutor sees every thread, sorted by activity, in the hub's own "Questions" tab (QuestionsPanel.tsx) and replies
// there — never buried in the middle of the lesson, always one tab away.
//
// Access mirrors hub/homeworkApi.ts's submissions: a parent only ever reaches their OWN enrolled child's threads
// (resolveCtx + scopedChildren); a tutor sees threads in their franchise scope (canSeeStudent) and can only post to
// one within it (canWriteRow).

export const hubDoubtsApi = Router();

interface DoubtMsg { from: "child" | "tutor"; text: string; byName: string; at: string }
interface DoubtDoc {
  tenantId: string; franchiseId: string | null;
  noteId: string | null; lessonTitle: string | null; childId: string; childName: string;
  step: string; slide: number; questionId: string | null; questionPrompt: string | null;
  messages: DoubtMsg[]; lastAt: string;
  /** Whose turn it looks like it is — cleared the moment that side opens/reads the thread (POST …/seen). */
  unreadByTutor: boolean; unreadByFamily: boolean;
  createdBy: string; createdAt: string; updatedAt: string;
}

const askBody = z.object({
  // Absent = a general message, not tied to any particular lesson (either side may start one of these).
  noteId: z.string().min(1).max(100).optional(),
  lessonTitle: z.string().trim().max(200).optional(),
  step: z.string().trim().max(40).default(""),
  slide: z.number().int().min(0).max(1000).default(0),
  questionId: z.string().max(100).nullable().optional(),
  questionPrompt: z.string().max(500).nullable().optional(),
  text: z.string().trim().min(1).max(2000),
  // Tutor-initiated only: there's no ?childId= to fall back on, so they name who it's to.
  childId: z.string().min(1).max(100).optional(),
});

const doubtOut = (id: string, d: DoubtDoc) => ({
  id, noteId: d.noteId, lessonTitle: d.lessonTitle,
  childId: d.childId, childName: d.childName,
  step: d.step, slide: d.slide, questionId: d.questionId, questionPrompt: d.questionPrompt,
  messages: d.messages, lastAt: d.lastAt, unreadByTutor: d.unreadByTutor, unreadByFamily: d.unreadByFamily,
  franchiseId: d.franchiseId, createdAt: d.createdAt,
});

function notifyTutor(tenantId: string, franchiseId: string | null, childName: string, lessonTitle: string | null, text: string, threadId: string) {
  void notify({
    tenantId, to: { kind: "tenant" }, category: "learning", franchiseId,
    title: `${childName} sent a message`,
    body: lessonTitle ? `On "${lessonTitle}": "${text.length > 140 ? `${text.slice(0, 140)}…` : text}"` : `"${text.length > 140 ? `${text.slice(0, 140)}…` : text}"`,
    href: `/company/learninghub?tab=questions&open=doubt:${threadId}`, ref: threadId,
  });
}

// POST /doubts — either side starts a thread: a family, tied to a lesson (and, where known, the exact
// step/slide/question) or as a plain message; a tutor, always to one named student, lesson-less (a roster "Message"
// action) since they have no single lesson context to hang it off.
hubDoubtsApi.post("/doubts", async (req, res) => {
  const ctx = await resolveCtx(req, res);
  if (!ctx) return;
  const parsed = askBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues }); return; }
  const b = parsed.data;
  if (b.noteId && !okId(b.noteId)) { res.status(404).json({ error: "Lesson not found" }); return; }
  const now = nowIso();

  if (ctx.role === "parent") {
    const kid = scopedChildren(ctx)[0];
    if (!kid) { res.status(400).json({ error: "Which child? Pass ?childId=" }); return; }
    let lessonTitle = b.lessonTitle ?? null;
    if (b.noteId) {
      const note = await notesCol.doc(b.noteId).get();
      if (!note.exists || note.get("tenantId") !== ctx.tenantId || !canSeeStudent(ctx, note.get("franchiseId"))) { res.status(404).json({ error: "Lesson not found" }); return; }
      lessonTitle = (b.lessonTitle || (note.get("title") as string | undefined) || "Lesson").slice(0, 200);
    }
    const doc: DoubtDoc = {
      tenantId: ctx.tenantId, franchiseId: kid.franchiseId,
      noteId: b.noteId ?? null, lessonTitle,
      childId: kid.childId, childName: kid.childName,
      step: b.step, slide: b.slide, questionId: b.questionId ?? null, questionPrompt: b.questionPrompt ?? null,
      messages: [{ from: "child", text: b.text, byName: kid.childName, at: now }], lastAt: now,
      unreadByTutor: true, unreadByFamily: false,
      createdBy: ctx.uid, createdAt: now, updatedAt: now,
    };
    const ref = await doubtsCol.add(doc);
    notifyTutor(ctx.tenantId, kid.franchiseId, kid.childName, lessonTitle, b.text, ref.id);
    res.status(201).json(doubtOut(ref.id, doc));
    return;
  }

  if (!requireEdit(ctx, res)) return;
  if (!b.childId) { res.status(400).json({ error: "Which student? Pass childId" }); return; }
  const students = await eligibleStudents(ctx, [b.childId]);
  if (!students) { res.status(404).json({ error: "Student not found" }); return; }
  const kid = students[0]!;
  const doc: DoubtDoc = {
    tenantId: ctx.tenantId, franchiseId: kid.franchiseId,
    noteId: b.noteId ?? null, lessonTitle: b.lessonTitle ?? null,
    childId: kid.childId, childName: kid.childName,
    step: b.step, slide: b.slide, questionId: b.questionId ?? null, questionPrompt: b.questionPrompt ?? null,
    messages: [{ from: "tutor", text: b.text, byName: ctx.name, at: now }], lastAt: now,
    unreadByTutor: false, unreadByFamily: true,
    createdBy: ctx.uid, createdAt: now, updatedAt: now,
  };
  const ref = await doubtsCol.add(doc);
  void notifyFamilies({
    tenantId: ctx.tenantId, childIds: [kid.childId], franchiseId: kid.franchiseId, ref: ref.id, tab: "questions", open: { kind: "doubt", id: ref.id },
    compose: (names) => ({ title: "New message from your tutor", body: `${nameList(names)} — "${b.text.length > 140 ? `${b.text.slice(0, 140)}…` : b.text}"` }),
  });
  res.status(201).json(doubtOut(ref.id, doc));
});

// GET /doubts?noteId= — a family's own child's threads (about one lesson, or all, newest activity first);
// a tutor's full inbox (their franchise scope), same order.
hubDoubtsApi.get("/doubts", async (req, res) => {
  const ctx = await resolveCtx(req, res);
  if (!ctx) return;

  if (ctx.role === "parent") {
    const noteId = typeof req.query.noteId === "string" && req.query.noteId ? req.query.noteId : null;
    const kids = scopedChildren(ctx);
    if (!kids.length) { res.json([]); return; }
    let q = doubtsCol.where("tenantId", "==", ctx.tenantId).where("childId", "in", kids.slice(0, 10).map((k) => k.childId));
    if (noteId) q = q.where("noteId", "==", noteId);
    const snap = await q.get();
    const rows = snap.docs.map((d) => doubtOut(d.id, d.data() as DoubtDoc));
    rows.sort((a, b) => b.lastAt.localeCompare(a.lastAt));
    res.json(rows);
    return;
  }

  const snap = await doubtsCol.where("tenantId", "==", ctx.tenantId).get();
  const rows = snap.docs.map((d) => ({ id: d.id, ...(d.data() as DoubtDoc) }))
    .filter((d) => canSeeStudent(ctx, d.franchiseId))
    .map((d) => doubtOut(d.id, d));
  rows.sort((a, b) => Number(b.unreadByTutor) - Number(a.unreadByTutor) || b.lastAt.localeCompare(a.lastAt));
  res.json(rows);
});

/** A thread this caller (tutor, franchise-scoped) may post to, or a refusal already sent. */
async function editableDoubt(ctx: HubCtx, id: string, res: import("express").Response) {
  if (!okId(id)) { res.status(404).json({ error: "Question not found" }); return null; }
  const snap = await doubtsCol.doc(id).get();
  if (!snap.exists || snap.get("tenantId") !== ctx.tenantId || !canSeeStudent(ctx, snap.get("franchiseId"))) { res.status(404).json({ error: "Question not found" }); return null; }
  if (!canWriteRow(ctx, snap.get("franchiseId"))) { res.status(403).json({ error: "That question belongs to head office" }); return null; }
  return snap;
}
/** A thread belonging to one of the caller's own enrolled children, or a refusal already sent. */
async function ownDoubt(ctx: HubCtx, id: string, res: import("express").Response) {
  if (!okId(id)) { res.status(404).json({ error: "Question not found" }); return null; }
  const snap = await doubtsCol.doc(id).get();
  if (!snap.exists || snap.get("tenantId") !== ctx.tenantId || !scopedChildren(ctx).some((c) => c.childId === snap.get("childId"))) { res.status(404).json({ error: "Question not found" }); return null; }
  return snap;
}

const msgBody = z.object({ text: z.string().trim().min(1).max(4000) });

// POST /doubts/:id/reply — the tutor posts to the thread. Tells the family (bell + email); LessonPlayer's own
// poll/realtime picks it up sooner if they're still in (or come back to) the lesson.
hubDoubtsApi.post("/doubts/:id/reply", async (req, res) => {
  const ctx = await resolveCtx(req, res);
  if (!ctx || !requireEdit(ctx, res)) return;
  const parsed = msgBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues }); return; }
  const snap = await editableDoubt(ctx, req.params.id, res);
  if (!snap) return;
  const d = snap.data() as DoubtDoc;
  const now = nowIso();
  const msg: DoubtMsg = { from: "tutor", text: parsed.data.text, byName: ctx.name, at: now };
  const patch = { messages: [...d.messages, msg], lastAt: now, unreadByFamily: true, unreadByTutor: false, updatedAt: now };
  await snap.ref.update(patch);
  const firstReply = !d.messages.some((m) => m.from === "tutor");
  if (firstReply) {
    void notifyFamilies({
      tenantId: ctx.tenantId, childIds: [d.childId], franchiseId: d.franchiseId, ref: snap.id, tab: "questions", open: { kind: "doubt", id: snap.id },
      compose: (names) => ({ title: "Your tutor replied", body: `${nameList(names)} asked about "${d.lessonTitle}" — your tutor replied: "${parsed.data.text.length > 140 ? `${parsed.data.text.slice(0, 140)}…` : parsed.data.text}"` }),
    });
  }
  res.json(doubtOut(snap.id, { ...d, ...patch }));
});

// POST /doubts/:id/message — the family replies again, continuing the same thread (a follow-up, or a fresh
// question on an old thread). Pings the tutor same as the original ask.
hubDoubtsApi.post("/doubts/:id/message", async (req, res) => {
  const ctx = await resolveCtx(req, res);
  if (!ctx) return;
  if (ctx.role !== "parent") { res.status(403).json({ error: "Only families do this" }); return; }
  const parsed = msgBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues }); return; }
  const snap = await ownDoubt(ctx, req.params.id, res);
  if (!snap) return;
  const d = snap.data() as DoubtDoc;
  const now = nowIso();
  const msg: DoubtMsg = { from: "child", text: parsed.data.text, byName: d.childName, at: now };
  const patch = { messages: [...d.messages, msg], lastAt: now, unreadByTutor: true, unreadByFamily: false, updatedAt: now };
  await snap.ref.update(patch);
  notifyTutor(ctx.tenantId, d.franchiseId, d.childName, d.lessonTitle, parsed.data.text, snap.id);
  res.json(doubtOut(snap.id, { ...d, ...patch }));
});

// POST /doubts/:id/seen — clears the caller's own side's unread flag (a parent opening the reply popup; a tutor
// opening the thread in Questions) without posting a message.
hubDoubtsApi.post("/doubts/:id/seen", async (req, res) => {
  const ctx = await resolveCtx(req, res);
  if (!ctx) return;
  if (ctx.role === "parent") {
    const snap = await ownDoubt(ctx, req.params.id, res);
    if (!snap) return;
    await snap.ref.update({ unreadByFamily: false, updatedAt: nowIso() });
  } else {
    const snap = await editableDoubt(ctx, req.params.id, res);
    if (!snap) return;
    await snap.ref.update({ unreadByTutor: false, updatedAt: nowIso() });
  }
  res.json({ ok: true });
});
