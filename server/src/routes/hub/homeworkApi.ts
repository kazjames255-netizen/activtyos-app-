import { Router } from "express";
import { z } from "zod";
import { db } from "../../firebase";
import { canSee, canSeeStudent, canWriteRow, childDobs, effectiveYearGroup, hubConfig, okId, requireEdit, resolveCtx, scopedChildren, type EnrolmentDoc, type HubCtx } from "../../lib/hubCore";
import { nameList, notifyFamilies } from "../../lib/hubNotify";
import { checkDataUrl } from "../../lib/hubUpload";
import { activeMembers, visibleGroups } from "../../lib/hubGroups";
import { ageInYears, audienceFit, cleanVideos, normAudience, videosOut, type StoredVideo } from "../../lib/hubRules";
import { noteIndex } from "../../lib/hubIndex";
import {
  assessmentsCol, attemptsCol, dropSubmissionFiles, eligibleStudents, filesOut, homeworkCol, imagesCol, isParent, notesCol, nowIso,
  submissionsCol, tenantEnrolments, toIso, topicsCol, type StoredFile,
} from "./teachingCommon";

// Learning Hub — HOMEWORK & SUBMISSIONS (milestone 6). Contract:
// docs/learning-hub.md → "Homework". A tutor sets homework and assigns it to
// enrolled students (one `hubSubmissions` row per child, id `${homeworkId}__${childId}`);
// the family submits text / photos / a link to a quiz attempt; the tutor marks.
//
// Access: tutors through canSee/canWriteRow on the row's franchiseId; a parent
// only ever reaches a submission of THEIR OWN enrolled child (resolveCtx builds
// that list from their enrolments) — other children's submissions are invisible
// and a foreign id is a 404. Parent emails never leave the server.

export const hubHomeworkApi = Router();

interface Mark { score: number; max: number; feedback: string; markedBy: string; markedByName: string; markedAt: string }
interface HomeworkDoc {
  tenantId: string; franchiseId: string | null;
  title: string; instructions: string; assessmentId: string | null; noteIds: string[]; flashcardTopicId: string | null;
  dueAt: string; assignedChildIds: string[];
  /** Groups it was sent to (for display; the members were expanded into assignedChildIds). */
  groupIds?: string[];
  videos?: StoredVideo[];
  createdBy: string; createdByName: string; createdAt: string; updatedAt: string;
}
interface SubmissionDoc {
  tenantId: string; franchiseId: string | null;
  homeworkId: string; childId: string; parentUid: string;
  status: "assigned" | "submitted" | "marked";
  text: string; attachments: StoredFile[]; attemptId: string | null; submittedAt: string | null; mark: Mark | null;
  createdBy: string; createdAt: string; updatedAt: string;
}

const MAX_CHILDREN = 100;   // one batch (submissions + homework) stays under Firestore's 500-write cap
const MAX_FILES = 5;        // attachments per submission
const MAX_UPLOADS = 8;      // uploaded files per submission (attached or not) — bounds storage
const subId = (homeworkId: string, childId: string) => `${homeworkId}__${childId}`;

const homeworkBody = z.object({
  title: z.string().trim().min(1).max(200),
  instructions: z.string().max(5000).default(""),
  assessmentId: z.string().max(100).nullable().optional(),
  noteIds: z.array(z.string().min(1).max(100)).max(20).default([]),
  flashcardTopicId: z.string().max(100).nullable().optional(),
  dueAt: z.string().max(40).optional(),
  // Students and/or groups: the group members are added to the students (the union), at least one student overall.
  assignedChildIds: z.array(z.string().min(1).max(100)).max(MAX_CHILDREN).default([]),
  assignedGroupIds: z.array(z.string().min(1).max(100)).max(20).optional(),
  // YouTube links only; omitted on an edit = keep the current ones.
  videos: z.array(z.object({ url: z.string().max(500), title: z.string().trim().max(120).optional(), start: z.number().int().min(0).max(86_400).optional() })).max(6).optional(),
});
const homeworkPatch = homeworkBody.partial();

/** Refs a homework points at must be this tenant's and visible to the caller. Returns an error message or null. */
async function checkRefs(ctx: HubCtx, b: { assessmentId?: string | null; noteIds?: string[]; flashcardTopicId?: string | null }): Promise<{ status: number; error: string } | null> {
  if (b.assessmentId) {
    if (!okId(b.assessmentId)) return { status: 404, error: "Assessment not found" };
    const a = await assessmentsCol.doc(b.assessmentId).get();
    if (!a.exists || a.get("tenantId") !== ctx.tenantId || !canSee(ctx, a.get("franchiseId"))) return { status: 404, error: "Assessment not found" };
    if (a.get("published") !== true) return { status: 400, error: "Publish that quiz before setting it as homework" };
  }
  if (b.noteIds?.length) {
    if (b.noteIds.some((id) => !okId(id))) return { status: 404, error: "Lesson not found" };
    const snaps = await db.getAll(...b.noteIds.map((id) => notesCol.doc(id)), { fieldMask: ["tenantId", "franchiseId"] });
    if (snaps.some((s) => !s.exists || s.get("tenantId") !== ctx.tenantId || !canSee(ctx, s.get("franchiseId")))) return { status: 404, error: "Lesson not found" };
  }
  if (b.flashcardTopicId) {
    if (!okId(b.flashcardTopicId)) return { status: 404, error: "Topic not found" };
    const t = await topicsCol.doc(b.flashcardTopicId).get();
    if (!t.exists || t.get("tenantId") !== ctx.tenantId || !canSee(ctx, t.get("franchiseId"))) return { status: 404, error: "Topic not found" };
  }
  return null;
}

/** Students of THIS caller's roster the quiz can never reach: the attempt start refuses them (subject not in their enrolment,
 *  or a year group / age the quiz isn't for), so homework set to them would sit as a healthy "Waiting" row forever.
 *  A student whose year/age is simply unknown is NOT listed (the start lets them in). Retakes are not judged here: that
 *  is per-attempt history, and a tutor can grant another go. */
export interface Unreachable { childId: string; childName: string; reason: string }
export async function unreachableFor(ctx: HubCtx, assessmentId: string, students: EnrolmentDoc[]): Promise<Unreachable[]> {
  if (!students.length || !okId(assessmentId)) return [];
  const a = await assessmentsCol.doc(assessmentId).get();
  if (!a.exists || a.get("tenantId") !== ctx.tenantId) return [];
  const title = (a.get("title") as string | undefined) ?? "That quiz";
  const subject = (a.get("subject") as string | undefined) ?? "";
  const aud = normAudience(a.get("audience"));
  const [dobs, cfg] = await Promise.all([childDobs(students.map((s) => s.childId)), hubConfig(ctx.tenantId, ctx.franchiseId)]);
  const out: Unreachable[] = [];
  for (const e of students) {
    const rowF = (a.get("franchiseId") as string | null | undefined) ?? null;
    if (rowF !== null && rowF !== (e.franchiseId ?? null)) { out.push({ childId: e.childId, childName: e.childName, reason: `"${title}" belongs to another franchise` }); continue; }
    const subs = e.subjects ?? [];
    if (subject && subs.length && !subs.some((x) => x.toLowerCase() === subject.toLowerCase())) {
      out.push({ childId: e.childId, childName: e.childName, reason: `${e.childName} is enrolled for ${subs.join(", ")} only, and "${title}" is ${subject}` });
      continue;
    }
    const dob = dobs.get(e.childId) ?? null;
    if (audienceFit(aud, { yearGroup: effectiveYearGroup(e, dob, cfg.yearGroups), age: ageInYears(dob) }) === "no") {
      out.push({ childId: e.childId, childName: e.childName, reason: `"${title}" isn't set for ${e.childName}'s year group or age` });
    }
  }
  return out;
}

/** 400 body naming who a quiz can't reach, or null when everyone can open it. */
async function unreachableRefusal(ctx: HubCtx, assessmentId: string | null | undefined, students: EnrolmentDoc[]) {
  if (!assessmentId) return null;
  const bad = await unreachableFor(ctx, assessmentId, students);
  if (!bad.length) return null;
  return { error: `${bad.length === 1 ? "One student" : `${bad.length} students`} couldn't open that quiz: ${bad.slice(0, 3).map((b) => b.reason).join("; ")}${bad.length > 3 ? "; …" : ""}. Remove them, or change the quiz.`, code: "quiz_unreachable", unreachable: bad };
}

const dueIso = async (ctx: HubCtx, raw: string | undefined): Promise<string | null> => {
  if (raw === undefined || raw === "") {
    const cfg = await hubConfig(ctx.tenantId, ctx.franchiseId);
    return new Date(Date.now() + cfg.homeworkDueDays * 86_400_000).toISOString();
  }
  return toIso(raw);
};

const dayLabel = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });

function notifyAssigned(tenantId: string, hwId: string, title: string, dueAt: string, childIds: string[]) {
  void notifyFamilies({
    tenantId, childIds, ref: hwId, tab: "homework", open: { kind: "hw", id: hwId },
    compose: (names) => ({ title: "New homework", body: `${nameList(names)} has new homework: "${title}", due ${dayLabel(dueAt)}.` }),
  });
}

const newSub = (ctx: HubCtx, hwId: string, e: { childId: string; parentUid: string }, now: string, franchiseId: string | null = ctx.franchiseId): SubmissionDoc => ({
  // The HOMEWORK's franchise, not the caller's: head office adding a child to a franchise's homework must
  // leave the row in that franchise's scope, or its own tutor could never mark it.
  tenantId: ctx.tenantId, franchiseId, homeworkId: hwId, childId: e.childId, parentUid: e.parentUid,
  status: "assigned", text: "", attachments: [], attemptId: null, submittedAt: null, mark: null,
  createdBy: ctx.uid, createdAt: now, updatedAt: now,
});

interface Counts { assigned: number; submitted: number; marked: number }
const tutorHomeworkOut = (id: string, h: HomeworkDoc, counts: Counts) => ({
  id, title: h.title, instructions: h.instructions, assessmentId: h.assessmentId ?? null, noteIds: h.noteIds ?? [],
  flashcardTopicId: h.flashcardTopicId ?? null, dueAt: h.dueAt, assignedChildIds: h.assignedChildIds ?? [], groupIds: h.groupIds ?? [], videos: videosOut(h.videos),
  franchiseId: h.franchiseId ?? null, createdByName: h.createdByName || "Your tutor", createdAt: h.createdAt, updatedAt: h.updatedAt, counts,
});

const markOut = (m: Mark | null, forParent: boolean) =>
  m ? { score: m.score, max: m.max, feedback: m.feedback, markedAt: m.markedAt, markedByName: m.markedByName || "Your tutor", ...(forParent ? {} : { markedBy: m.markedBy }) } : null;

// ── Tutor: the inbox (declared before the :id routes) ────────────────────────
// GET /homework/inbox?status=submitted|marked|assigned
hubHomeworkApi.get("/homework/inbox", async (req, res) => {
  const ctx = await resolveCtx(req, res);
  if (!ctx || !requireEdit(ctx, res)) return;
  const status = typeof req.query.status === "string" && req.query.status ? req.query.status : null;
  if (status && !["submitted", "marked", "assigned"].includes(status)) { res.status(400).json({ error: "status must be submitted, marked or assigned" }); return; }
  const [subSnap, students] = await Promise.all([submissionsCol.where("tenantId", "==", ctx.tenantId).get(), tenantEnrolments(ctx)]);
  const subs = subSnap.docs.map((d) => ({ id: d.id, ...(d.data() as SubmissionDoc) })).filter((s) => canSeeStudent(ctx, s.franchiseId) && (!status || s.status === status));
  const hwIds = [...new Set(subs.map((s) => s.homeworkId))];
  const hws = new Map<string, HomeworkDoc>();
  if (hwIds.length) for (const s of await db.getAll(...hwIds.map((id) => homeworkCol.doc(id)))) if (s.exists && s.get("tenantId") === ctx.tenantId) hws.set(s.id, s.data() as HomeworkDoc);
  const attemptIds = [...new Set(subs.map((s) => s.attemptId).filter((x): x is string => !!x && okId(x)))];
  const pending = new Set<string>();
  if (attemptIds.length) for (const a of await db.getAll(...attemptIds.map((id) => attemptsCol.doc(id)), { fieldMask: ["tenantId", "status"] })) if (a.exists && a.get("tenantId") === ctx.tenantId && a.get("status") === "pending_marking") pending.add(a.id);
  const rank = { submitted: 0, assigned: 1, marked: 2 } as const;
  const rows = subs.filter((s) => hws.has(s.homeworkId) && students.has(s.childId)).map((s) => {
    const h = hws.get(s.homeworkId)!;
    return {
      submissionId: s.id, homeworkId: s.homeworkId, title: h.title, childId: s.childId, childName: students.get(s.childId)!.childName,
      status: s.status, submittedAt: s.submittedAt, dueAt: h.dueAt, attemptPending: !!s.attemptId && pending.has(s.attemptId),
      // Beyond the contract's row, so a marking screen needs no second call:
      text: s.text ?? "", attachments: filesOut(req, s.attachments), attemptId: s.attemptId ?? null, mark: markOut(s.mark, false),
      late: !!s.submittedAt && s.submittedAt > h.dueAt, franchiseId: s.franchiseId ?? null,
    };
  });
  rows.sort((a, b) => rank[a.status] - rank[b.status] || (a.status === "submitted" ? (a.submittedAt ?? "").localeCompare(b.submittedAt ?? "") : a.dueAt.localeCompare(b.dueAt)));
  res.json(rows);
});

// ── Tutor: who can open this quiz? (the homework form's warning) ─────────────
// GET /homework/reach?assessmentId= → the ACTIVE students in the caller's scope the quiz can't reach, with why.
hubHomeworkApi.get("/homework/reach", async (req, res) => {
  const ctx = await resolveCtx(req, res);
  if (!ctx || !requireEdit(ctx, res)) return;
  const id = typeof req.query.assessmentId === "string" ? req.query.assessmentId : "";
  if (!okId(id)) { res.status(400).json({ error: "Which quiz? Pass ?assessmentId=" }); return; }
  const a = await assessmentsCol.doc(id).get();
  if (!a.exists || a.get("tenantId") !== ctx.tenantId || !canSee(ctx, a.get("franchiseId"))) { res.status(404).json({ error: "Assessment not found" }); return; }
  const roster = [...(await tenantEnrolments(ctx)).values()].filter((e) => e.active !== false);
  res.json({ unreachable: await unreachableFor(ctx, id, roster) });
});

// ── Homework: list ───────────────────────────────────────────────────────────
// T: everything visible, with how many children are at each stage.
// P: one row per (homework, enrolled child) with that child's submission.
hubHomeworkApi.get("/homework", async (req, res) => {
  const ctx = await resolveCtx(req, res);
  if (!ctx) return;

  if (!isParent(ctx)) {
    const [hwSnap, subSnap] = await Promise.all([homeworkCol.where("tenantId", "==", ctx.tenantId).get(), submissionsCol.where("tenantId", "==", ctx.tenantId).get()]);
    const counts = new Map<string, Counts>();
    for (const d of subSnap.docs) {
      const c = counts.get(d.get("homeworkId") as string) ?? { assigned: 0, submitted: 0, marked: 0 };
      const st = d.get("status") as keyof Counts;
      if (st in c) c[st]++;
      counts.set(d.get("homeworkId") as string, c);
    }
    const list = hwSnap.docs.map((d) => ({ id: d.id, ...(d.data() as HomeworkDoc) })).filter((h) => canSeeStudent(ctx, h.franchiseId))
      .sort((a, b) => b.dueAt.localeCompare(a.dueAt))
      .map((h) => tutorHomeworkOut(h.id, h, counts.get(h.id) ?? { assigned: 0, submitted: 0, marked: 0 }));
    res.json(list);
    return;
  }

  // A parent: only rows for their OWN enrolled child (resolveCtx), narrowed by ?childId=.
  const kids = scopedChildren(ctx);
  const subs = (await Promise.all(kids.map((k) => submissionsCol.where("tenantId", "==", ctx.tenantId).where("childId", "==", k.childId).get()))).flatMap((q) => q.docs);
  const mine = subs.map((d) => ({ id: d.id, ...(d.data() as SubmissionDoc) }));
  const hwIds = [...new Set(mine.map((s) => s.homeworkId))];
  const hws = new Map<string, HomeworkDoc>();
  if (hwIds.length) for (const s of await db.getAll(...hwIds.map((id) => homeworkCol.doc(id)))) if (s.exists && s.get("tenantId") === ctx.tenantId) hws.set(s.id, s.data() as HomeworkDoc);
  // Notes the homework points at — only PUBLISHED ones of this provider.
  const noteIds = [...new Set([...hws.values()].flatMap((h) => h.noteIds ?? []).filter(okId))];
  const notes = new Map<string, string>();
  // Which of those are interactive lessons (the pupil opens them in the lesson player, not as a static note).
  const lessonIds = new Set<string>();
  if (noteIds.length) { const idx = await noteIndex(ctx.tenantId); for (const id of noteIds) if (idx.get(id)?.isLesson) lessonIds.add(id); }
  if (noteIds.length) for (const s of await db.getAll(...noteIds.map((id) => notesCol.doc(id)), { fieldMask: ["tenantId", "title", "published"] })) if (s.exists && s.get("tenantId") === ctx.tenantId && s.get("published") !== false) notes.set(s.id, s.get("title") as string);
  const rows = mine.filter((s) => hws.has(s.homeworkId)).map((s) => {
    const h = hws.get(s.homeworkId)!;
    const kid = kids.find((k) => k.childId === s.childId)!;
    return {
      id: s.homeworkId, childId: s.childId, childName: kid.childName,
      title: h.title, instructions: h.instructions, dueAt: h.dueAt, assessmentId: h.assessmentId ?? null, flashcardTopicId: h.flashcardTopicId ?? null,
      notes: (h.noteIds ?? []).filter((n) => notes.has(n)).map((n) => ({ id: n, title: notes.get(n)!, interactive: lessonIds.has(n) })),
      videos: videosOut(h.videos),
      submission: {
        id: s.id, status: s.status, text: s.text ?? "", attachments: filesOut(req, s.attachments), attemptId: s.attemptId ?? null,
        submittedAt: s.submittedAt, mark: markOut(s.mark, true), late: !!s.submittedAt && s.submittedAt > h.dueAt,
      },
    };
  });
  const open = (r: (typeof rows)[number]) => r.submission.status === "assigned";
  rows.sort((a, b) => Number(open(b)) - Number(open(a)) || (open(a) ? a.dueAt.localeCompare(b.dueAt) : b.dueAt.localeCompare(a.dueAt)));
  res.json(rows);
});

// ── Homework: create / edit / delete (tutors) ───────────────────────────────
hubHomeworkApi.post("/homework", async (req, res) => {
  const ctx = await resolveCtx(req, res);
  if (!ctx || !requireEdit(ctx, res)) return;
  const parsed = homeworkBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues }); return; }
  const b = parsed.data;
  const due = await dueIso(ctx, b.dueAt);
  if (!due) { res.status(400).json({ error: "That due date isn't valid" }); return; }
  const bad = await checkRefs(ctx, b);
  if (bad) { res.status(bad.status).json({ error: bad.error }); return; }
  // Only enrolled, active students in the caller's scope can be set homework — named directly or through a group.
  const direct = await eligibleStudents(ctx, b.assignedChildIds);
  if (!direct) { res.status(404).json({ error: "Student not found — homework can only go to your enrolled students" }); return; }
  const groups = await visibleGroups(ctx, b.assignedGroupIds ?? []);
  if (!groups) { res.status(404).json({ error: "Group not found" }); return; }
  const students = [...new Map([...direct, ...(await activeMembers(ctx, groups))].map((e) => [e.childId, e])).values()];
  if (!students.length) { res.status(400).json({ error: "Choose at least one student, or a group that has students in it" }); return; }
  if (students.length > MAX_CHILDREN) { res.status(400).json({ error: `Homework can go to up to ${MAX_CHILDREN} students at once` }); return; }
  const dead = await unreachableRefusal(ctx, b.assessmentId, students);
  if (dead) { res.status(400).json(dead); return; }
  const vids = cleanVideos(b.videos);
  if (typeof vids === "string") { res.status(400).json({ error: vids }); return; }
  const now = nowIso();
  const doc: HomeworkDoc = {
    tenantId: ctx.tenantId, franchiseId: ctx.franchiseId, title: b.title, instructions: b.instructions,
    assessmentId: b.assessmentId ?? null, noteIds: b.noteIds, flashcardTopicId: b.flashcardTopicId ?? null,
    dueAt: due, assignedChildIds: students.map((s) => s.childId), groupIds: groups.map((g) => g.id), videos: vids,
    createdBy: ctx.uid, createdByName: ctx.name, createdAt: now, updatedAt: now,
  };
  const ref = homeworkCol.doc();
  const batch = db.batch();
  batch.set(ref, doc);
  for (const s of students) batch.set(submissionsCol.doc(subId(ref.id, s.childId)), newSub(ctx, ref.id, s, now));
  await batch.commit();
  notifyAssigned(ctx.tenantId, ref.id, doc.title, doc.dueAt, doc.assignedChildIds);
  res.status(201).json(tutorHomeworkOut(ref.id, doc, { assigned: students.length, submitted: 0, marked: 0 }));
});

/** A visible-and-writable homework, or a refusal already sent. */
async function editableHomework(ctx: HubCtx, id: string, res: import("express").Response) {
  if (!okId(id)) { res.status(404).json({ error: "Homework not found" }); return null; }
  const snap = await homeworkCol.doc(id).get();
  if (!snap.exists || snap.get("tenantId") !== ctx.tenantId || !canSeeStudent(ctx, snap.get("franchiseId"))) { res.status(404).json({ error: "Homework not found" }); return null; }
  if (!canWriteRow(ctx, snap.get("franchiseId"))) { res.status(403).json({ error: "That homework belongs to head office" }); return null; }
  return snap;
}

// PUT /homework/:id — any subset of the create fields. Adding children creates
// their rows (and tells their families); removing a child drops their row only if
// they haven't handed anything in (a submitted / marked one is kept).
hubHomeworkApi.put("/homework/:id", async (req, res) => {
  const ctx = await resolveCtx(req, res);
  if (!ctx || !requireEdit(ctx, res)) return;
  const parsed = homeworkPatch.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues }); return; }
  const snap = await editableHomework(ctx, req.params.id, res);
  if (!snap) return;
  const b = parsed.data;
  const before = snap.data() as HomeworkDoc;
  const bad = await checkRefs(ctx, b);
  if (bad) { res.status(bad.status).json({ error: bad.error }); return; }
  let dueAt = before.dueAt;
  if (b.dueAt !== undefined) {
    const d = toIso(b.dueAt);
    if (!d) { res.status(400).json({ error: "That due date isn't valid" }); return; }
    dueAt = d;
  }
  const patch: Partial<HomeworkDoc> = { dueAt, updatedAt: nowIso() };
  if (b.title !== undefined) patch.title = b.title;
  if (b.instructions !== undefined) patch.instructions = b.instructions;
  if (b.assessmentId !== undefined) patch.assessmentId = b.assessmentId ?? null;
  if (b.noteIds !== undefined) patch.noteIds = b.noteIds;
  if (b.flashcardTopicId !== undefined) patch.flashcardTopicId = b.flashcardTopicId ?? null;
  if (b.videos !== undefined) {
    const vids = cleanVideos(b.videos);
    if (typeof vids === "string") { res.status(400).json({ error: vids }); return; }
    patch.videos = vids;
  }
  // Students named directly, plus the members of any groups named now (the union). Naming only groups ADDS their
  // members to the current students; naming students replaces the list as before.
  let wanted: string[] | undefined = b.assignedChildIds;
  if (b.assignedGroupIds !== undefined) {
    const groups = await visibleGroups(ctx, b.assignedGroupIds);
    if (!groups) { res.status(404).json({ error: "Group not found" }); return; }
    patch.groupIds = groups.map((g) => g.id);
    wanted = [...new Set([...(b.assignedChildIds ?? before.assignedChildIds ?? []), ...(await activeMembers(ctx, groups)).map((e) => e.childId)])];
  }
  if (wanted && wanted.length > MAX_CHILDREN) { res.status(400).json({ error: `Homework can go to up to ${MAX_CHILDREN} students at once` }); return; }
  if (wanted && !wanted.length) { res.status(400).json({ error: "Homework needs at least one student" }); return; }

  const batch = db.batch();
  let added: string[] = [];
  if (wanted) {
    const existing = await submissionsCol.where("tenantId", "==", ctx.tenantId).where("homeworkId", "==", snap.id).get();
    const have = new Map(existing.docs.map((d) => [d.get("childId") as string, d.get("status") as string]));
    const want = new Set(wanted);
    const fresh = [...want].filter((c) => !have.has(c));
    const students = await eligibleStudents(ctx, fresh);
    if (!students) { res.status(404).json({ error: "Student not found — homework can only go to your enrolled students" }); return; }
    // Newly added students must be able to open the quiz (existing ones already have their row — leave them be).
    const dead = students.length ? await unreachableRefusal(ctx, b.assessmentId !== undefined ? b.assessmentId : before.assessmentId, students) : null;
    if (dead) { res.status(400).json(dead); return; }
    const now = nowIso();
    for (const s of students) batch.set(submissionsCol.doc(subId(snap.id, s.childId)), newSub(ctx, snap.id, s, now, (snap.get("franchiseId") as string | null | undefined) ?? null));
    added = students.map((s) => s.childId);
    const kept = new Set<string>(want);
    for (const [childId, status] of have) {
      if (want.has(childId)) continue;
      if (status === "assigned") batch.delete(submissionsCol.doc(subId(snap.id, childId)));
      else kept.add(childId);
    }
    patch.assignedChildIds = [...kept];
  }
  batch.update(snap.ref, patch);
  await batch.commit();
  if (added.length) notifyAssigned(ctx.tenantId, snap.id, patch.title ?? before.title, dueAt, added);
  const [subs] = await Promise.all([submissionsCol.where("tenantId", "==", ctx.tenantId).where("homeworkId", "==", snap.id).get()]);
  const counts: Counts = { assigned: 0, submitted: 0, marked: 0 };
  for (const d of subs.docs) counts[d.get("status") as keyof Counts]++;
  res.json(tutorHomeworkOut(snap.id, { ...before, ...patch } as HomeworkDoc, counts));
});

// DELETE /homework/:id — the homework and every child's submission of it (and their uploaded files).
hubHomeworkApi.delete("/homework/:id", async (req, res) => {
  const ctx = await resolveCtx(req, res);
  if (!ctx || !requireEdit(ctx, res)) return;
  const snap = await editableHomework(ctx, req.params.id, res);
  if (!snap) return;
  const subs = await submissionsCol.where("tenantId", "==", ctx.tenantId).where("homeworkId", "==", snap.id).get();
  const batch = db.batch();
  for (const d of subs.docs) batch.delete(d.ref);
  batch.delete(snap.ref);
  await batch.commit();
  for (const d of subs.docs) void dropSubmissionFiles(ctx.tenantId, d.id); // every upload made for these hand-ins, attached or not
  res.json({ ok: true });
});

// ── Marking (tutors) ─────────────────────────────────────────────────────────
const markBody = z.object({
  score: z.number().finite().min(0).max(100_000),
  max: z.number().finite().positive().max(100_000),
  feedback: z.string().max(4000).default(""),
}).refine((m) => m.score <= m.max, { message: "The score can't be higher than the maximum", path: ["score"] });

// PUT /submissions/:id/mark {score, max, feedback}
hubHomeworkApi.put("/submissions/:id/mark", async (req, res) => {
  const ctx = await resolveCtx(req, res);
  if (!ctx || !requireEdit(ctx, res)) return;
  const parsed = markBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues }); return; }
  const sid = req.params.id;
  if (!okId(sid)) { res.status(404).json({ error: "Submission not found" }); return; }
  const snap = await submissionsCol.doc(sid).get();
  if (!snap.exists || snap.get("tenantId") !== ctx.tenantId || !canSeeStudent(ctx, snap.get("franchiseId"))) { res.status(404).json({ error: "Submission not found" }); return; }
  if (!canWriteRow(ctx, snap.get("franchiseId"))) { res.status(403).json({ error: "That homework belongs to head office" }); return; }
  const sub = snap.data() as SubmissionDoc;
  const now = nowIso();
  const mark: Mark = { score: parsed.data.score, max: parsed.data.max, feedback: parsed.data.feedback, markedBy: ctx.uid, markedByName: ctx.name, markedAt: now };
  // Marking paper homework that was never submitted online is fine — the tutor has it in hand.
  await snap.ref.update({ status: "marked", mark, updatedAt: now });
  if (sub.status !== "marked") {
    const hw = await homeworkCol.doc(sub.homeworkId).get();
    const title = hw.exists ? (hw.get("title") as string) : "homework";
    void notifyFamilies({
      tenantId: ctx.tenantId, childIds: [sub.childId], ref: sub.homeworkId, tab: "homework", open: { kind: "hw", id: sub.homeworkId },
      compose: (names) => ({ title: "Homework marked", body: `${nameList(names)}'s "${title}" has been marked: ${mark.score}/${mark.max}.` }),
    });
  }
  res.json({ id: snap.id, homeworkId: sub.homeworkId, childId: sub.childId, status: "marked", mark: markOut(mark, false) });
});

// ── Family: submit ───────────────────────────────────────────────────────────
/** A submission belonging to one of the caller's enrolled children (or a refusal already sent). */
async function ownSubmission(ctx: HubCtx, id: string, res: import("express").Response) {
  if (!okId(id)) { res.status(404).json({ error: "Homework not found" }); return null; }
  const snap = await submissionsCol.doc(id).get();
  if (!snap.exists || snap.get("tenantId") !== ctx.tenantId || !scopedChildren(ctx).some((c) => c.childId === snap.get("childId"))) { res.status(404).json({ error: "Homework not found" }); return null; }
  return snap;
}

const submitBody = z.object({
  text: z.string().max(10_000).optional(),
  attachments: z.array(z.object({ id: z.string().min(1).max(100), name: z.string().trim().max(200).optional() })).max(MAX_FILES).optional(),
  attemptId: z.string().min(1).max(100).nullable().optional(),
});

/** Files must be ones THIS parent uploaded for THIS submission (POST …/files) —
 *  never another family's, another provider's, or a tutor's resource. */
async function checkSubmissionFiles(ctx: HubCtx, subId_: string, list: { id: string; name?: string }[]): Promise<StoredFile[] | string> {
  if (!list.length) return [];
  if (list.some((a) => !okId(a.id))) return "That attachment isn't valid";
  const snaps = await db.getAll(...list.map((a) => imagesCol.doc(a.id)), { fieldMask: ["tenantId", "contentType", "private", "kind", "bytes", "submissionId", "uploadedBy", "name"] });
  const out: StoredFile[] = [];
  for (const [i, s] of snaps.entries()) {
    if (!s.exists || s.get("tenantId") !== ctx.tenantId || s.get("private") !== true || s.get("kind") !== "hub" || s.get("submissionId") !== subId_ || s.get("uploadedBy") !== ctx.uid) return "That file wasn't uploaded for this homework";
    out.push({ id: s.id, name: list[i].name?.trim() || (s.get("name") as string) || "file", contentType: s.get("contentType") as string, size: Number(s.get("bytes")) || 0 });
  }
  return out;
}

// POST /submissions/:id/files {dataUrl, name} → {id, name, contentType, size}
// Parents can't use /api/uploads (operators only), so this is their upload path:
// same validation (lib/hubUpload.ts), stored as a private kind:"hub" image tied
// to this submission and uploader, and attachable only via …/submit.
hubHomeworkApi.post("/submissions/:id/files", async (req, res) => {
  const ctx = await resolveCtx(req, res);
  if (!ctx) return;
  if (!isParent(ctx)) { res.status(403).json({ error: "Only families upload homework files" }); return; }
  const snap = await ownSubmission(ctx, req.params.id, res);
  if (!snap) return;
  if (snap.get("status") === "marked") { res.status(409).json({ error: "This homework has already been marked", code: "already_marked" }); return; }
  const body = (req.body ?? {}) as { dataUrl?: unknown; name?: unknown };
  const name = typeof body.name === "string" ? body.name.trim().slice(0, 200) : "";
  if (!name) { res.status(400).json({ error: "Give the file a name" }); return; }
  const chk = checkDataUrl(body.dataUrl);
  if (!chk.ok) { res.status(chk.status).json({ error: chk.error }); return; }
  const used = await imagesCol.where("submissionId", "==", snap.id).get();
  if (used.docs.filter((d) => d.get("tenantId") === ctx.tenantId).length >= MAX_UPLOADS) { res.status(409).json({ error: `Up to ${MAX_UPLOADS} files per homework` }); return; }
  const ref = await imagesCol.add({
    tenantId: ctx.tenantId, contentType: chk.contentType, b64: chk.b64, private: true, kind: "hub", bytes: chk.bytes,
    submissionId: snap.id, uploadedBy: ctx.uid, name, createdAt: nowIso(),
  });
  res.status(201).json({ id: ref.id, name, contentType: chk.contentType, size: chk.bytes });
});

// POST /submissions/:id/submit {text?, attachments?, attemptId?}
// Re-submitting before it's marked replaces the earlier hand-in.
hubHomeworkApi.post("/submissions/:id/submit", async (req, res) => {
  const ctx = await resolveCtx(req, res);
  if (!ctx) return;
  if (!isParent(ctx)) { res.status(403).json({ error: "Only families hand homework in" }); return; }
  const parsed = submitBody.safeParse(req.body ?? {});
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues }); return; }
  const snap = await ownSubmission(ctx, req.params.id, res);
  if (!snap) return;
  const cur = snap.data() as SubmissionDoc;
  if (cur.status === "marked") { res.status(409).json({ error: "This homework has already been marked", code: "already_marked" }); return; }
  const b = parsed.data;
  const text = (b.text ?? "").trim();

  const files = await checkSubmissionFiles(ctx, snap.id, b.attachments ?? []);
  if (typeof files === "string") { res.status(400).json({ error: files }); return; }

  // An optional link to a quiz attempt THIS child made at THIS provider (agent
  // B1's hubAttempts — read-only here). If the homework is a quiz and the family
  // didn't say which attempt, the child's latest submitted attempt made for this
  // homework is linked automatically.
  const hwSnap = await homeworkCol.doc(cur.homeworkId).get();
  if (!hwSnap.exists || hwSnap.get("tenantId") !== ctx.tenantId) { res.status(404).json({ error: "Homework not found" }); return; }
  let attemptId: string | null = b.attemptId === undefined ? (cur.attemptId ?? null) : (b.attemptId ?? null);
  if (b.attemptId) {
    if (!okId(b.attemptId)) { res.status(404).json({ error: "Attempt not found" }); return; }
    const a = await attemptsCol.doc(b.attemptId).get();
    if (!a.exists || a.get("tenantId") !== ctx.tenantId || a.get("childId") !== cur.childId) { res.status(404).json({ error: "Attempt not found" }); return; }
    const forHw = a.get("homeworkId") as string | null | undefined;
    if (forHw && forHw !== cur.homeworkId) { res.status(400).json({ error: "That quiz attempt was made for different homework" }); return; }
    if (a.get("status") === "in_progress") { res.status(409).json({ error: "Finish that quiz before handing it in" }); return; }
    // The attempt must be a quiz on THIS homework's assessment — not an older, easier
    // paper or a placement test handed in as the result.
    const hwAssessment = hwSnap.get("assessmentId") as string | null | undefined;
    if (hwAssessment && (a.get("assessmentId") !== hwAssessment || a.get("assessmentType") !== "quiz")) { res.status(400).json({ error: "That isn't a finished attempt at this homework's quiz" }); return; }
  } else if (!attemptId && hwSnap.get("assessmentId")) {
    const mine = await attemptsCol.where("tenantId", "==", ctx.tenantId).where("childId", "==", cur.childId).get();
    const latest = mine.docs.filter((d) => d.get("homeworkId") === cur.homeworkId && d.get("status") !== "in_progress").sort((x, y) => String(y.get("submittedAt") ?? "").localeCompare(String(x.get("submittedAt") ?? "")))[0];
    if (latest) attemptId = latest.id;
  }

  if (!text && !files.length && !attemptId) { res.status(400).json({ error: "Add some writing, a photo, or a quiz result to hand in" }); return; }

  const now = nowIso();
  const patch = { status: "submitted" as const, text, attachments: files, attemptId, submittedAt: now, updatedAt: now };
  // Transactional: a hand-in that lands just after the tutor marked must not flip `marked` back to `submitted`.
  const landed = await db.runTransaction(async (tx) => {
    const fresh = await tx.get(snap.ref);
    if (!fresh.exists || fresh.get("status") === "marked") return false;
    tx.update(snap.ref, patch);
    return true;
  });
  if (!landed) { res.status(409).json({ error: "This homework has already been marked", code: "already_marked" }); return; }
  void dropSubmissionFiles(ctx.tenantId, snap.id, files.map((f) => f.id)); // replaced / never-attached uploads don't linger
  const h = hwSnap.data() as HomeworkDoc;
  res.json({
    id: snap.id, homeworkId: cur.homeworkId, childId: cur.childId, status: "submitted", text, attachments: filesOut(req, files), attemptId,
    submittedAt: now, mark: null, late: now > h.dueAt,
  });
});
