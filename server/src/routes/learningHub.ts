import { createHash } from "node:crypto";
import { Router, type Request } from "express";
import { z } from "zod";
import { db } from "../firebase";
import { childVisibleTo } from "../lib/childAccess";
import { capLevel } from "../../../lib/accessMap";
import { capsFor } from "../middleware/access";
import { customerAreaOn } from "../lib/customerArea";
import {
  canSee, canSeeStudent, canWriteRow, childDobs, effectiveYearGroup, enrolmentsForParent, forgetEnrolments, hubConfig, hubEnrolments, libraryDocId, norm, okId, registerTopicRef, requireEdit, resolveCtx, same, scopedChildren, subjectAllowed, topicReferences,
  type EnrolmentDoc, type HubCtx,
} from "../lib/hubCore";
import { forgetHub } from "../lib/hubCache";
import { pingHub } from "../lib/hubPing";
import { gzipJson } from "../lib/gzipJson";
import { assessmentRows, collate, noteIndex, patchNote, questionIndex, patchTopic, tenantRoster, tenantTopics, topicRank, type NoteRow } from "../lib/hubIndex";
import { ageInYears, cleanVideos, inList, videosOut, yearGroupFromDob, type StoredVideo } from "../lib/hubRules";
import { removeFromGroups } from "../lib/hubGroups";
import { buildHomeworkPack } from "../lib/hubHomeworkPack";
import { hubGroupsApi } from "./hub/groupsApi";
import { signImageUrl } from "../lib/signing";
import { planForFamily } from "../../../features/learninghub/lesson/plan";
import { PIC_BY_ID } from "../oak/factory/art/library";
import { cleanCanvasBlock, signCanvasSlides } from "../oak/canvasSchema";
import { withSlideUrls } from "../lib/slideStorage";
import { notifyNewNote } from "../lib/hubNotify";
import { hubAssessmentsApi } from "./hub/assessmentsApi";
import { hubTeachingApi } from "./hub/teachingApi";
import { hubTutorsApi, resolveTutor } from "./hub/tutorsApi";

// Learning Hub — the tutoring vertical's student-facing area. Contract, schemas
// and the roadmap live in docs/learning-hub.md; the API is in server/openapi.yaml.
//
// This file: the roster (who is a student), the topic taxonomy every panel
// hangs off, and notes & resources. Later milestones are their own routers in
// ./hub/ mounted at the bottom. ALL access decisions come from lib/hubCore.ts.

export const learningHub = Router();
learningHub.use(gzipJson); // the hub's lists are big JSON; every browser accepts gzip

const topicsCol = db.collection("hubTopics");
const notesCol = db.collection("hubNotes");
registerTopicRef(notesCol);

const MAX_TOPICS = 2000; // a fully seeded curriculum is ~700 rows; renames/deletes are chunked so this no longer relates to Firestore's 500-write batch cap
const commitChunked = async (ops: ((b: FirebaseFirestore.WriteBatch) => void)[]) => {
  for (let i = 0; i < ops.length; i += 400) { const b = db.batch(); for (const op of ops.slice(i, i + 400)) op(b); await b.commit(); }
};

// ── Roster ───────────────────────────────────────────────────────────────────
// A "student" is a parent's child ENROLLED by a tutor. The enrolment is what
// lets that family into the hub (lib/hubCore.ts) — never the customer record.

interface EnrolmentRow { childId: string; childName: string; parentEmail: string; franchiseId: string | null; subjects: string[]; tutorUid: string | null; tutorName: string; active: boolean; createdAt: string; yearGroup: string | null; yearGroupAuto: boolean; audienceUnknown: boolean }
/** `dob` = the child's date of birth (never returned): it lets the row say which year group they are in NOW
 *  and whether year/age are both unknown (`audienceUnknown` — year-group-targeted quizzes will show for them, flagged). */
const enrolmentOut = (e: EnrolmentDoc, yearGroups: string[], dob: string | null): EnrolmentRow => {
  const yearGroup = effectiveYearGroup(e, dob, yearGroups);
  return {
    childId: e.childId, childName: e.childName, parentEmail: e.parentEmail, franchiseId: e.franchiseId ?? null,
    subjects: e.subjects ?? [], tutorUid: e.tutorUid ?? null, tutorName: e.tutorName ?? "", active: e.active !== false, createdAt: e.createdAt,
    yearGroup, yearGroupAuto: e.yearGroupAuto === true, audienceUnknown: !yearGroup && ageInYears(dob) === null,
  };
};
const enrolmentId = (tenantId: string, childId: string) => `${tenantId}__${childId}`;

// GET /providers — the hubs this account can open, with the students each covers.
// Operators: their own. Parents: providers where one of their children is
// enrolled AND the provider has the hub on.
learningHub.get("/providers", async (req, res) => {
  const auth = req.auth!;
  if (auth.role !== "parent") {
    const ctx = await resolveCtx(req, res);
    if (!ctx) return;
    // canEdit = the caller's REAL level: a staff member whose role has only "View" on the Learning Hub gets a read-only page
    // (every non-GET is refused for them by the access middleware, so an authoring UI would be all dead buttons).
    // `franchiseId` lets a franchise's page mark head-office content read-only (canWriteRow).
    const canEdit = req.auth!.role !== "staff" || capLevel(await capsFor(req), "learninghub") === "edit";
    // The business's own name (Setup → Provider name, else the tenant's), so the hero isn't a generic "Your Learning Hub".
    const [lib, ten] = await Promise.all([db.collection("libraries").doc(libraryDocId(ctx)).get(), db.collection("tenants").doc(ctx.tenantId).get()]);
    const name = ((lib.get("settings.providerName") as string | undefined)?.trim() || (ten.get("name") as string | undefined)?.trim() || "Your tutor");
    res.json([{ tenantId: ctx.tenantId, name, canEdit, franchiseId: ctx.franchiseId, role: ctx.role, uid: ctx.uid, children: [] }]);
    return;
  }
  const uid = req.user?.uid ?? "";
  const enr = uid ? await enrolmentsForParent(uid) : [];
  const byTenant = new Map<string, typeof enr>();
  for (const e of enr) byTenant.set(e.tenantId, [...(byTenant.get(e.tenantId) ?? []), e]);
  const ids = [...byTenant.keys()].slice(0, 30);
  const on: string[] = [];
  for (const id of ids) {
    const fs = [...new Set((byTenant.get(id) ?? []).map((e) => e.franchiseId ?? null))];
    if ((await Promise.all(fs.map((f) => customerAreaOn(id, "learninghub", f)))).some(Boolean)) on.push(id);
  }
  if (!on.length) { res.json([]); return; }
  const [tenants, libs] = await Promise.all([
    db.getAll(...on.map((id) => db.collection("tenants").doc(id))),
    db.getAll(...on.map((id) => db.collection("libraries").doc(id))),
  ]);
  const names = new Map(libs.map((l) => [l.id, (l.get("settings.providerName") as string | undefined)?.trim() ?? ""]));
  res.json(tenants.filter((t) => t.exists).map((t) => ({
    tenantId: t.id,
    name: names.get(t.id) || (t.get("name") as string) || "Your tutor",
    canEdit: false,
    children: (byTenant.get(t.id) ?? []).map((e) => ({ childId: e.childId, childName: e.childName })),
  })));
});

// GET /students — tutors: this tenant's roster (scoped to their franchise);
// parents: their own enrolled children here.
learningHub.get("/students", async (req, res) => {
  const ctx = await resolveCtx(req, res);
  if (!ctx) return;
  if (!ctx.canEdit) {
    res.json(scopedChildren(ctx).map((c) => ({ childId: c.childId, childName: c.childName, subjects: c.subjects, franchiseId: c.franchiseId })));
    return;
  }
  const mine = (await tenantRoster(ctx.tenantId)).filter((e) => canSeeStudent(ctx, e.franchiseId));
  const [dobs, cfg] = await Promise.all([childDobs(mine.map((e) => e.childId)), hubConfig(ctx.tenantId, ctx.franchiseId)]);
  const rows = mine.map((e) => enrolmentOut(e, cfg.yearGroups, dobs.get(e.childId) ?? null));
  rows.sort((a, b) => a.childName.localeCompare(b.childName));
  res.json(rows);
});

const enrolBody = z.object({
  childId: z.string().min(1).max(100),
  subjects: z.array(z.string().trim().min(1).max(80)).max(30).default([]),
  tutorUid: z.string().max(100).nullable().optional(),
  tutorName: z.string().trim().max(120).optional(),
  // The student's year group ("Year 4"). Omitted = worked out from their date of birth (UK school-year rule) and kept
  // current each September; a value = as tagged; null = unknown.
  yearGroup: z.string().trim().min(1).max(40).nullable().optional(),
  yearGroupAuto: z.boolean().optional(),
});

// POST /students {childId} — enrol a child (idempotent: re-enrols an inactive one).
// The child must be one this provider legitimately sees (booked with them, or
// the family joined them themselves) — childVisibleTo(), the same rule the
// child card uses.
learningHub.post("/students", async (req, res) => {
  const ctx = await resolveCtx(req, res);
  if (!ctx || !requireEdit(ctx, res)) return;
  const parsed = enrolBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues }); return; }
  const b = parsed.data;
  if (!okId(b.childId) || !(await childVisibleTo(req.auth!, b.childId))) { res.status(404).json({ error: "Child not found" }); return; }
  const child = await db.collection("children").doc(b.childId).get();
  const parentUid = child.get("parentUid") as string | undefined;
  if (!parentUid) { res.status(404).json({ error: "Child not found" }); return; }
  const parentEmail = (((await db.collection("users").doc(parentUid).get()).get("email") as string | undefined) ?? "").trim().toLowerCase();
  const id = enrolmentId(ctx.tenantId, b.childId);
  const ref = hubEnrolments.doc(id);
  const now = new Date().toISOString();
  const prev = await ref.get();
  if (prev.exists && prev.get("tenantId") !== ctx.tenantId) { res.status(404).json({ error: "Child not found" }); return; }
  if (prev.exists && !canSeeStudent(ctx, prev.get("franchiseId"))) { res.status(404).json({ error: "Child not found" }); return; }
  const dob = typeof child.get("dob") === "string" && child.get("dob") ? (child.get("dob") as string) : null;
  const cfg = await hubConfig(ctx.tenantId, prev.exists ? ((prev.get("franchiseId") as string | null) ?? null) : ctx.franchiseId);
  // Year group: as given (tutor-tagged), else auto from the dob; re-enrolling keeps what was set before unless told otherwise.
  const yg: { yearGroup: string | null; yearGroupAuto: boolean } =
    b.yearGroupAuto === true || (b.yearGroup === undefined && !(prev.exists && prev.get("yearGroupAuto") === false))
      ? { yearGroup: yearGroupFromDob(dob, cfg.yearGroups), yearGroupAuto: true }
      : b.yearGroup === undefined
        ? { yearGroup: (prev.get("yearGroup") as string | null | undefined) ?? null, yearGroupAuto: false }
        : { yearGroup: b.yearGroup === null ? null : inList(cfg.yearGroups, b.yearGroup) ?? b.yearGroup, yearGroupAuto: false };
  // Who teaches them (F11): as named (a tutor of this business); else what it was before; else a staff tutor enrolling
  // takes their own student, and an owner leaves it unassigned (every tutor sees an unassigned student).
  let tutor: { uid: string | null; name: string };
  if (b.tutorUid) {
    const t = await resolveTutor(ctx, b.tutorUid);
    if (!t) { res.status(400).json({ error: "That tutor isn't on your team" }); return; }
    tutor = { uid: t.uid, name: t.name };
  } else if (b.tutorUid === null || b.tutorName !== undefined) tutor = { uid: null, name: b.tutorName ?? "" };
  else if (prev.exists) tutor = { uid: (prev.get("tutorUid") as string | null) ?? null, name: (prev.get("tutorName") as string | undefined) ?? "" };
  else if (req.auth!.role === "staff") tutor = { uid: ctx.uid, name: ctx.name };
  else tutor = { uid: null, name: "" };
  const doc: EnrolmentDoc = {
    tenantId: ctx.tenantId, franchiseId: prev.exists ? ((prev.get("franchiseId") as string | null) ?? null) : ctx.franchiseId,
    childId: b.childId, childName: (child.get("name") as string) ?? "", parentUid, parentEmail,
    subjects: b.subjects, tutorUid: tutor.uid, tutorName: tutor.name, active: true, ...yg,
    createdBy: prev.exists ? (prev.get("createdBy") as string) : ctx.uid, createdAt: prev.exists ? (prev.get("createdAt") as string) : now, updatedAt: now,
  };
  // Re-enrolling must not wipe what the tutor set since (placement-test waivers and one-more-go retake grants live on the enrolment).
  const carried: Partial<EnrolmentDoc> = {};
  if (prev.exists && Array.isArray(prev.get("diagnosticWaived"))) carried.diagnosticWaived = prev.get("diagnosticWaived");
  if (prev.exists && Array.isArray(prev.get("retakeGrants"))) carried.retakeGrants = prev.get("retakeGrants");
  await ref.set({ ...doc, ...carried });
  forgetHub(ctx.tenantId, "roster"); forgetEnrolments();
  res.status(prev.exists ? 200 : 201).json(enrolmentOut(doc, cfg.yearGroups, dob));
});

const enrolPatch = z.object({
  subjects: z.array(z.string().trim().min(1).max(80)).max(30).optional(),
  active: z.boolean().optional(),
  tutorUid: z.string().max(100).nullable().optional(),
  tutorName: z.string().trim().max(120).optional(),
  yearGroup: z.string().trim().min(1).max(40).nullable().optional(),
  yearGroupAuto: z.boolean().optional(),
});

// PUT /students/:childId — change subjects / tutor, or pause (active:false).
learningHub.put("/students/:childId", async (req, res) => {
  const ctx = await resolveCtx(req, res);
  if (!ctx || !requireEdit(ctx, res)) return;
  const parsed = enrolPatch.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues }); return; }
  if (!okId(req.params.childId)) { res.status(404).json({ error: "Student not found" }); return; }
  const ref = hubEnrolments.doc(enrolmentId(ctx.tenantId, req.params.childId));
  const snap = await ref.get();
  if (!snap.exists || snap.get("tenantId") !== ctx.tenantId || !canSeeStudent(ctx, snap.get("franchiseId"))) { res.status(404).json({ error: "Student not found" }); return; }
  if (!canWriteRow(ctx, snap.get("franchiseId"))) { res.status(403).json({ error: "That student belongs to head office" }); return; }
  const { yearGroup, yearGroupAuto, tutorUid, tutorName, ...rest } = parsed.data;
  const cfg = await hubConfig(ctx.tenantId, (snap.get("franchiseId") as string | null) ?? null);
  const dob = (await childDobs([req.params.childId])).get(req.params.childId) ?? null;
  const next: EnrolmentDoc = { ...(snap.data() as EnrolmentDoc), ...rest, updatedAt: new Date().toISOString() };
  if (tutorUid !== undefined) { // reassign (a tutor of this business) or clear
    if (tutorUid) {
      const t = await resolveTutor(ctx, tutorUid);
      if (!t) { res.status(400).json({ error: "That tutor isn't on your team" }); return; }
      next.tutorUid = t.uid; next.tutorName = t.name;
    } else { next.tutorUid = null; next.tutorName = tutorName ?? ""; }
  } else if (tutorName !== undefined) next.tutorName = tutorName;
  if (yearGroupAuto === true) { next.yearGroupAuto = true; next.yearGroup = yearGroupFromDob(dob, cfg.yearGroups); }
  else if (yearGroup !== undefined) { next.yearGroupAuto = false; next.yearGroup = yearGroup === null ? null : inList(cfg.yearGroups, yearGroup) ?? yearGroup; }
  else if (yearGroupAuto === false) next.yearGroupAuto = false;
  await ref.set(next);
  forgetHub(ctx.tenantId, "roster"); forgetEnrolments();
  if (parsed.data.active === false) await removeFromGroups(ctx.tenantId, req.params.childId); // groups hold active students only (awaited so a refetch right after the pause never sees them still in a group; never throws)
  res.json(enrolmentOut(next, cfg.yearGroups, dob));
});

// DELETE /students/:childId — un-enrol. Soft: the row stays (active:false) so a
// child's attempts and results are never orphaned; enrolling again reactivates it.
learningHub.delete("/students/:childId", async (req, res) => {
  const ctx = await resolveCtx(req, res);
  if (!ctx || !requireEdit(ctx, res)) return;
  if (!okId(req.params.childId)) { res.status(404).json({ error: "Student not found" }); return; }
  const ref = hubEnrolments.doc(enrolmentId(ctx.tenantId, req.params.childId));
  const snap = await ref.get();
  if (!snap.exists || snap.get("tenantId") !== ctx.tenantId || !canSeeStudent(ctx, snap.get("franchiseId"))) { res.status(404).json({ error: "Student not found" }); return; }
  if (!canWriteRow(ctx, snap.get("franchiseId"))) { res.status(403).json({ error: "That student belongs to head office" }); return; }
  await ref.set({ active: false, updatedAt: new Date().toISOString() }, { merge: true });
  forgetHub(ctx.tenantId, "roster"); forgetEnrolments();
  await removeFromGroups(ctx.tenantId, req.params.childId); // an un-enrolled student leaves every group
  res.json({ ok: true });
});

// ── Topics ───────────────────────────────────────────────────────────────────
// One taxonomy every hub panel hangs off. A row is a topic (subtopic null) or a
// subtopic (parentTopicId → its topic). Subject is an attribute the tutor types,
// not a table — so subjects are whatever THIS tenant teaches, never a fixed list.

interface TopicDoc {
  tenantId: string;
  franchiseId: string | null;
  subject: string;
  topic: string;
  subtopic: string | null;
  parentTopicId: string | null;
  createdBy: string;
  createdAt: string;
}
type Topic = TopicDoc & { id: string };
const topicOut = (t: Topic) => ({ id: t.id, subject: t.subject, topic: t.topic, subtopic: t.subtopic ?? null, parentTopicId: t.parentTopicId ?? null, franchiseId: t.franchiseId ?? null });

/** Deterministic id per (scope, subject, topic, subtopic): two concurrent creates
 *  of the same topic collide on `create()` instead of both succeeding. */
const topicKey = (tenantId: string, franchiseId: string | null, subject: string, topic: string, subtopic: string | null) =>
  createHash("sha1").update([tenantId, franchiseId ?? "", subject.toLowerCase(), topic.toLowerCase(), (subtopic ?? "").toLowerCase()].join("")).digest("hex").slice(0, 28);

/** The topics this caller may see (franchise scope + a family's enrolled subjects). */
async function visibleTopics(ctx: HubCtx): Promise<Topic[]> {
  return (await tenantTopics(ctx.tenantId)).filter((t) => canSee(ctx, t.franchiseId) && subjectAllowed(ctx, t.subject)) as Topic[];
}

// GET /topics — the whole visible taxonomy (flat; the client builds the tree).
learningHub.get("/topics", async (req, res) => {
  const ctx = await resolveCtx(req, res);
  if (!ctx) return;
  const list = (await visibleTopics(ctx)).map(topicOut);
  res.set("Cache-Control", "private, no-cache").vary("Authorization"); // let the browser revalidate (ETag) instead of re-downloading the tree
  list.sort((a, b) => a.subject.localeCompare(b.subject) || a.topic.localeCompare(b.topic) || (a.subtopic ?? "").localeCompare(b.subtopic ?? ""));
  res.json(list);
});

const topicCreate = z.object({
  subject: z.string().trim().min(1).max(80).optional(),
  topic: z.string().trim().min(1).max(120).optional(),
  subtopic: z.string().trim().min(1).max(120).optional(),
  parentTopicId: z.string().max(100).optional(),
});

// POST /topics — a new topic {subject, topic}, or a subtopic {parentTopicId, subtopic}.
learningHub.post("/topics", async (req, res) => {
  const ctx = await resolveCtx(req, res);
  if (!ctx || !requireEdit(ctx, res)) return;
  const parsed = topicCreate.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues }); return; }
  const b = parsed.data;
  const all = await visibleTopics(ctx);
  if (all.length >= MAX_TOPICS) { res.status(409).json({ error: `A hub can hold up to ${MAX_TOPICS} topics — tidy some away first` }); return; }
  let doc: TopicDoc;
  const base = { tenantId: ctx.tenantId, franchiseId: ctx.franchiseId, createdBy: ctx.uid, createdAt: new Date().toISOString() };
  if (b.parentTopicId) {
    const parent = all.find((t) => t.id === b.parentTopicId);
    if (!parent) { res.status(404).json({ error: "Parent topic not found" }); return; }
    if (parent.parentTopicId) { res.status(400).json({ error: "Subtopics can't have subtopics of their own" }); return; }
    if (!b.subtopic) { res.status(400).json({ error: "A subtopic needs a name" }); return; }
    // A subtopic lives in its parent's scope (a franchise can't hang rows under head office's topic
    // and then have them vanish from its parent's view, nor the reverse).
    if (!canWriteRow(ctx, parent.franchiseId)) { res.status(403).json({ error: "That topic belongs to head office — add your own topic instead" }); return; }
    doc = { ...base, franchiseId: parent.franchiseId ?? null, subject: parent.subject, topic: parent.topic, subtopic: norm(b.subtopic), parentTopicId: parent.id };
  } else {
    if (!b.subject || !b.topic) { res.status(400).json({ error: "A topic needs a subject and a name" }); return; }
    if (b.subtopic) { res.status(400).json({ error: "Pick a parent topic to add a subtopic" }); return; }
    doc = { ...base, subject: norm(b.subject), topic: norm(b.topic), subtopic: null, parentTopicId: null };
  }
  const scope = all.filter((t) => (t.franchiseId ?? null) === (doc.franchiseId ?? null));
  if (scope.some((t) => same(t.subject, doc.subject) && same(t.topic, doc.topic) && same(t.subtopic, doc.subtopic))) { res.status(409).json({ error: "That topic already exists" }); return; }
  // Reuse the tenant's existing spelling of a subject ("maths" typed after
  // "Maths" must not split the subject in two in the sidebar).
  const known = scope.find((t) => same(t.subject, doc.subject));
  if (known) doc.subject = known.subject;
  const id = topicKey(ctx.tenantId, doc.franchiseId, doc.subject, doc.topic, doc.subtopic);
  try { await topicsCol.doc(id).create(doc); }
  catch (e) {
    if ((e as { code?: number }).code === 6) { res.status(409).json({ error: "That topic already exists" }); return; }
    throw e;
  }
  patchTopic(ctx.tenantId, { id, ...doc }); pingHub(ctx.tenantId, "hubTopics");
  res.status(201).json(topicOut({ id, ...doc }));
});

/** A visible-and-writable topic, or a refusal already sent. */
async function editableTopic(ctx: HubCtx, id: string, res: import("express").Response): Promise<Topic | null> {
  if (!okId(id)) { res.status(404).json({ error: "Topic not found" }); return null; }
  const snap = await topicsCol.doc(id).get();
  if (!snap.exists || snap.get("tenantId") !== ctx.tenantId || !canSee(ctx, snap.get("franchiseId"))) { res.status(404).json({ error: "Topic not found" }); return null; }
  const t = { id: snap.id, ...(snap.data() as TopicDoc) };
  if (!canWriteRow(ctx, t.franchiseId)) { res.status(403).json({ error: "That topic belongs to head office" }); return null; }
  return t;
}

const topicRename = z.object({ topic: z.string().trim().min(1).max(120).optional(), subtopic: z.string().trim().min(1).max(120).optional() });

// PUT /topics/:id — rename. A topic's new name cascades to its subtopics'
// denormalised `topic`; a subtopic can only change its own name.
learningHub.put("/topics/:id", async (req, res) => {
  const ctx = await resolveCtx(req, res);
  if (!ctx || !requireEdit(ctx, res)) return;
  const parsed = topicRename.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues }); return; }
  const cur = await editableTopic(ctx, req.params.id, res);
  if (!cur) return;
  const all = await visibleTopics(ctx);
  const isSub = !!cur.parentTopicId;
  const nextTopic = !isSub && parsed.data.topic ? norm(parsed.data.topic) : cur.topic;
  const nextSub = isSub && parsed.data.subtopic ? norm(parsed.data.subtopic) : cur.subtopic;
  if (all.some((t) => t.id !== cur.id && (t.franchiseId ?? null) === (cur.franchiseId ?? null) && same(t.subject, cur.subject) && same(t.topic, nextTopic) && same(t.subtopic, nextSub))) {
    res.status(409).json({ error: "That name is already used here" });
    return;
  }
  const ops: ((b: FirebaseFirestore.WriteBatch) => void)[] = [(b) => b.update(topicsCol.doc(cur.id), isSub ? { subtopic: nextSub } : { topic: nextTopic })];
  if (!isSub) for (const kid of all.filter((t) => t.parentTopicId === cur.id)) ops.push((b) => b.update(topicsCol.doc(kid.id), { topic: nextTopic }));
  await commitChunked(ops);
  forgetHub(ctx.tenantId, "topics"); pingHub(ctx.tenantId, "hubTopics");
  res.json(topicOut({ ...cur, topic: nextTopic, subtopic: nextSub }));
});

const subjectRename = z.object({ from: z.string().trim().min(1).max(80), to: z.string().trim().min(1).max(80) });

// POST /topics/rename-subject — rename a subject across all of the caller's own topics.
learningHub.post("/topics/rename-subject", async (req, res) => {
  const ctx = await resolveCtx(req, res);
  if (!ctx || !requireEdit(ctx, res)) return;
  const parsed = subjectRename.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues }); return; }
  const to = norm(parsed.data.to);
  const all = await visibleTopics(ctx);
  const hit = all.filter((t) => same(t.subject, parsed.data.from) && canWriteRow(ctx, t.franchiseId));
  if (!hit.length) { res.status(404).json({ error: "Subject not found" }); return; }
  const hitIds = new Set(hit.map((t) => t.id));
  const others = all.filter((t) => !hitIds.has(t.id));
  if (hit.some((t) => others.some((o) => (o.franchiseId ?? null) === (t.franchiseId ?? null) && same(o.subject, to) && same(o.topic, t.topic) && same(o.subtopic, t.subtopic)))) {
    res.status(409).json({ error: "Renaming would merge two topics with the same name" });
    return;
  }
  await commitChunked(hit.map((t) => (b: FirebaseFirestore.WriteBatch) => b.update(topicsCol.doc(t.id), { subject: to })));
  forgetHub(ctx.tenantId, "topics"); pingHub(ctx.tenantId, "hubTopics");
  res.json({ ok: true, updated: hit.length });
});

const subjectDelete = z.object({ subject: z.string().trim().min(1).max(80) });

// POST /topics/delete-subject — remove a whole subject (a subject only exists through its topics) — refused if ANY of its
// topics still has lessons, quizzes, cards… pointing at it, or if some of them belong to head office.
learningHub.post("/topics/delete-subject", async (req, res) => {
  const ctx = await resolveCtx(req, res);
  if (!ctx || !requireEdit(ctx, res)) return;
  const parsed = subjectDelete.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues }); return; }
  const all = await visibleTopics(ctx);
  const inSubject = all.filter((t) => same(t.subject, parsed.data.subject));
  if (!inSubject.length) { res.status(404).json({ error: "Subject not found" }); return; }
  if (inSubject.some((t) => !canWriteRow(ctx, t.franchiseId))) { res.status(403).json({ error: "Part of that subject belongs to head office" }); return; }
  const cols = topicReferences();
  const used = await Promise.all(inSubject.flatMap((t) => cols.map(async (col) => !(await col.where("tenantId", "==", ctx.tenantId).where("topicId", "==", t.id).limit(1).get()).empty)));
  if (used.some(Boolean)) { res.status(409).json({ error: `“${inSubject[0].subject}” still has content — move or delete its lessons and quizzes first` }); return; }
  await commitChunked(inSubject.map((t) => (b: FirebaseFirestore.WriteBatch) => b.delete(topicsCol.doc(t.id))));
  forgetHub(ctx.tenantId, "topics");
  for (const t of inSubject) patchTopic(ctx.tenantId, { id: t.id, deleted: true });
  pingHub(ctx.tenantId, "hubTopics");
  res.json({ ok: true, deleted: inSubject.length });
});

// DELETE /topics/:id — refused while it has subtopics or anything points at it.
learningHub.delete("/topics/:id", async (req, res) => {
  const ctx = await resolveCtx(req, res);
  if (!ctx || !requireEdit(ctx, res)) return;
  const cur = await editableTopic(ctx, req.params.id, res);
  if (!cur) return;
  const kids = await topicsCol.where("tenantId", "==", ctx.tenantId).where("parentTopicId", "==", cur.id).limit(1).get();
  if (!kids.empty) { res.status(409).json({ error: "Delete its subtopics first" }); return; }
  for (const col of topicReferences()) {
    const used = await col.where("tenantId", "==", ctx.tenantId).where("topicId", "==", cur.id).limit(1).get();
    if (!used.empty) { res.status(409).json({ error: "This topic still has content — move or delete it first" }); return; }
  }
  await topicsCol.doc(cur.id).delete();
  patchTopic(ctx.tenantId, { id: cur.id, deleted: true }); pingHub(ctx.tenantId, "hubTopics");
  res.json({ ok: true });
});

// ── Course notes & resource library ──────────────────────────────────────────

interface NoteDoc {
  tenantId: string;
  franchiseId: string | null;
  topicId: string;
  title: string;
  body: string;
  published: boolean;
  attachments: { id: string; name: string; contentType: string; size: number }[];
  videos?: StoredVideo[];
  /** "board" = a whiteboard snapshot saved from a live lesson (pictures + one line of text): listed as a "Board snapshot", never announced as a new lesson. Absent = an ordinary lesson. */
  kind?: "board";
  /** Structured interactive lesson (Oak import / lesson player) — see docs/learning-hub.md "Lessons". Absent = a plain markdown note. */
  lesson?: Record<string, unknown> | null;
  createdBy: string;
  createdByName: string;
  createdAt: string;
  updatedAt: string;
}

/** Slides store a tutor's uploaded picture as {id, alt}; every payload turns the id into a short-lived signed link (like a question picture). */
function slidesOut(base: string, slides: unknown): unknown {
  if (!Array.isArray(slides)) return slides;
  // Canvas slides (a real slide deck, oak/canvasSchema.ts) carry their pictures as elements: sign those too.
  const withCanvas = signCanvasSlides(base, slides.filter((s): s is Record<string, unknown> => !!s && typeof s === "object" && !Array.isArray(s)));
  if (withCanvas.length === slides.length) slides = withCanvas;
  return (slides as unknown[]).map((s) => {
    const img = s && typeof s === "object" ? (s as { image?: { id?: unknown; alt?: unknown } }).image : undefined;
    if (!img || typeof img !== "object" || typeof img.id !== "string") return s;
    return { ...(s as Record<string, unknown>), image: { id: img.id, alt: typeof img.alt === "string" ? img.alt : "", url: signImageUrl(`${base}/${img.id}`) as string } };
  });
}

/** The structured lesson a caller may see: tutors get it whole, a family loses the teacher-only parts. */
function lessonOut(l: Record<string, unknown>, canEdit: boolean, base: string) {
  const withArt = l.slides || l.deckSlides ? { ...l, ...(l.slides ? { slides: slidesOut(base, l.slides) } : {}), ...(l.deckSlides ? { deckSlides: slidesOut(base, l.deckSlides) } : {}) } : l;
  if (canEdit) return withArt;
  // (`tips` = what older imports called teacherTips; the plan's commonMistakes / watchOut are tutor-only too, its steps are the student recap)
  const { teacherTips: _t, misconceptions: _m, tips: _x, plan, ...rest } = withArt;
  void _t; void _m; void _x;
  return { ...rest, ...(plan ? { plan: planForFamily(plan) } : {}) };
}

/** A note as the client sees it: attachment ids become short-lived signed links
 *  (the file itself is a private upload, lib/signing.ts). */
function noteOut(req: Request, id: string, n: NoteDoc, canEdit = true) {
  const base = `${req.protocol}://${req.get("host")}/api/images`;
  return {
    id, topicId: n.topicId, title: n.title, body: n.body, published: n.published !== false, franchiseId: n.franchiseId ?? null, ...(n.kind === "board" ? { kind: "board" as const } : {}),
    attachments: (n.attachments ?? []).map((a) => ({ ...a, url: signImageUrl(`${base}/${a.id}`) as string })),
    videos: videosOut(n.videos),
    ...(n.lesson && typeof n.lesson === "object" ? { lesson: lessonOut(n.lesson, canEdit, base) } : {}),
    createdByName: n.createdByName || "Your tutor", createdAt: n.createdAt, updatedAt: n.updatedAt,
  };
}

/** noteOut + the async part: a real slide deck's Firebase-Storage pictures (`sid`) get their short-lived signed URLs (lib/slideStorage.ts). */
async function noteOutA(req: Request, id: string, n: NoteDoc, canEdit = true) {
  const o = noteOut(req, id, n, canEdit) as ReturnType<typeof noteOut> & { lesson?: Record<string, unknown> };
  const l = o.lesson;
  if (!l || (!l.slides && !l.deckSlides)) return o;
  const [slides, deckSlides] = await Promise.all([l.slides ? withSlideUrls(n.tenantId, l.slides) : undefined, l.deckSlides ? withSlideUrls(n.tenantId, l.deckSlides) : undefined]);
  return { ...o, lesson: { ...l, ...(slides ? { slides } : {}), ...(deckSlides ? { deckSlides } : {}) } };
}

/** A note as a LIST row: no body — an excerpt to show on the card, the read time, whether there is a body to open,
 *  and attachment/video metadata. The body comes from GET /notes/:id when a note is opened. */
function noteListOut(req: Request, n: NoteRow) {
  const base = `${req.protocol}://${req.get("host")}/api/images`;
  return {
    id: n.id, topicId: n.topicId, title: n.title, excerpt: n.excerpt, hasBody: n.hasBody, readMinutes: n.readMinutes, published: n.published, franchiseId: n.franchiseId, ...(n.kind === "board" ? { kind: "board" as const } : {}), ...(n.isLesson ? { isLesson: true, lessonWidget: n.lessonWidget, lessonYear: n.lessonYear } : {}),
    attachments: n.attachments.map((a) => ({ ...a, url: signImageUrl(`${base}/${a.id}`) as string })),
    videos: videosOut(n.videos as StoredVideo[] | undefined),
    createdByName: n.createdByName, createdAt: n.createdAt, updatedAt: n.updatedAt,
  };
}

const intParam = (v: unknown, dflt: number, max: number) => { const n = Number(v); return Number.isFinite(n) && n > 0 ? Math.min(Math.floor(n), max) : dflt; };

// GET /notes?topicId= — browse by topic, not by date. A topic id also pulls in
// its subtopics' notes; no topicId = the whole library. Families only ever see
// published notes, from topics they may see; notes whose topic is gone are dropped.
//
// LIGHT by default: each row carries `excerpt` (≤160 chars), `hasBody`, `readMinutes` and attachment/video
// metadata but NO body — a fully written library is ~1 MB of markdown, and a list never shows it. Open a note with
// GET /notes/:id. Extra (all optional): `?full=1` = the old shape with `body` on every row; `?subject=`, `?q=`
// (title + body, case-insensitive), `?published=0|1` (tutors), `?ids=a,b` (specific notes); `?limit=&cursor=` turns
// the reply into `{ items, total, nextCursor }` (default limit 60, max 200) — without them it is still a plain array.
learningHub.get("/notes", async (req, res) => {
  const ctx = await resolveCtx(req, res);
  if (!ctx) return;
  const topics = await visibleTopics(ctx);
  const topicId = typeof req.query.topicId === "string" && req.query.topicId ? req.query.topicId : null;
  const subject = typeof req.query.subject === "string" && req.query.subject ? req.query.subject : null;
  const needle = typeof req.query.q === "string" ? req.query.q.trim().toLowerCase() : "";
  const ids = typeof req.query.ids === "string" && req.query.ids ? new Set(req.query.ids.split(",").filter(Boolean).slice(0, 200)) : null;
  let allowed = new Set(topics.filter((t) => !subject || same(t.subject, subject)).map((t) => t.id));
  if (topicId) {
    if (!topics.some((t) => t.id === topicId)) { res.status(404).json({ error: "Topic not found" }); return; }
    allowed = new Set([topicId, ...topics.filter((t) => t.parentTopicId === topicId).map((t) => t.id)]);
  }
  const pub = req.query.published === "1" ? true : req.query.published === "0" ? false : null;
  // `?year=6` or `?year=3,4,5,6` (1–13, comma-separated for a key-stage picker): lessons for those school years —
  // the lesson's own `year`, or a topic whose subtopic is "Year 6" (how the Oak import files them).
  const yearNs = String(req.query.year ?? "").split(",").map((x) => x.trim()).filter((x) => /^\d{1,2}$/.test(x)).map(Number);
  const yearSet = yearNs.length ? new Set(yearNs) : null;
  const yearTopics = yearSet ? new Set(topics.filter((t) => t.subtopic && yearNs.some((y) => new RegExp(`^year\\s*${y}$`, "i").test(t.subtopic!.trim()))).map((t) => t.id)) : null;
  // `?lessons=1`: interactive lessons only (so a page of 40 is 40 lessons, not whatever plain notes sort among them).
  const onlyLessons = req.query.lessons === "1";
  const index = await noteIndex(ctx.tenantId);
  const rows: NoteRow[] = [];
  for (const n of index.values()) {
    if (!allowed.has(n.topicId) || !canSee(ctx, n.franchiseId) || (!ctx.canEdit && !n.published)) continue;
    if (onlyLessons && !n.isLesson) continue;
    if (yearSet && !(n.lessonYear != null && yearSet.has(n.lessonYear)) && !yearTopics!.has(n.topicId)) continue;
    if (pub !== null && ctx.canEdit && n.published !== pub) continue;
    if (ids && !ids.has(n.id)) continue;
    if (needle && !n.search.includes(needle)) continue;
    rows.push(n);
  }
  if (req.query.sort === "topic") {
    // Library order: subject › topic › subtopic, then title — so a page holds whole "shelves".
    const rank = topicRank(topics);
    rows.sort((a, b) => (rank.get(a.topicId) ?? -1) - (rank.get(b.topicId) ?? -1) || collate(a.title, b.title) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  } else rows.sort((a, b) => collate(a.title, b.title) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

  const paged = req.query.limit !== undefined || req.query.cursor !== undefined;
  const start = paged ? intParam(req.query.cursor, 0, 1_000_000) : 0;
  const limit = paged ? intParam(req.query.limit, 60, 200) : rows.length;
  const page = rows.slice(start, start + limit);
  let out: unknown[];
  if (req.query.full === "1" && page.length) {
    // The old, heavy shape: fetch the bodies of exactly these notes.
    const snaps = await db.getAll(...page.map((n) => notesCol.doc(n.id)));
    const byId = new Map(snaps.filter((d) => d.exists).map((d) => [d.id, d.data() as NoteDoc] as const));
    // Same reader rules as GET /notes/:id: a family never gets a lesson's teacher-only parts (tips, misconceptions, the plan's watch-outs).
    out = await Promise.all(page.filter((n) => byId.has(n.id)).map((n) => noteOutA(req, n.id, byId.get(n.id)!, ctx.canEdit)));
  } else out = page.map((n) => noteListOut(req, n));
  if (!paged) { res.json(out); return; }
  const next = start + limit;
  res.json({ items: out, total: rows.length, nextCursor: next < rows.length ? String(next) : null });
});

// GET /notes/counts — per-topic and per-subject note counts (+ totals the hub header shows) without listing a
// single note: the sidebar and hero stats need numbers, not 450 cards. Same visibility rules as GET /notes.
learningHub.get("/notes/counts", async (req, res) => {
  const ctx = await resolveCtx(req, res);
  if (!ctx) return;
  const topics = await visibleTopics(ctx);
  const visible = new Set(topics.map((t) => t.id));
  // `?year=6` or `?year=3,4,5,6`: same year filter GET /notes uses — the sidebar counts should match what the list shows.
  const yearNs = String(req.query.year ?? "").split(",").map((x) => x.trim()).filter((x) => /^\d{1,2}$/.test(x)).map(Number);
  const yearSet = yearNs.length ? new Set(yearNs) : null;
  const yearTopics = yearSet ? new Set(topics.filter((t) => t.subtopic && yearNs.some((y) => new RegExp(`^year\\s*${y}$`, "i").test(t.subtopic!.trim()))).map((t) => t.id)) : null;
  const weekAgo = Date.now() - 7 * 86_400_000;
  const byTopic: Record<string, number> = {};
  let total = 0, drafts = 0, files = 0, fresh = 0;
  for (const n of (await noteIndex(ctx.tenantId)).values()) {
    if (!visible.has(n.topicId) || !canSee(ctx, n.franchiseId) || (!ctx.canEdit && !n.published)) continue;
    if (yearSet && !(n.lessonYear != null && yearSet.has(n.lessonYear)) && !yearTopics!.has(n.topicId)) continue;
    byTopic[n.topicId] = (byTopic[n.topicId] ?? 0) + 1;
    total++; files += n.attachments.length;
    if (!n.published) drafts++;
    if (Date.parse(n.createdAt) > weekAgo) fresh++;
  }
  res.set("Cache-Control", "private, no-cache").vary("Authorization");
  res.json({ total, drafts, files, fresh, byTopic });
});

// GET /notes/:id — one note WITH its body (the list is light). Same visibility as the list: a family never gets a
// draft, and a foreign / out-of-scope id is a 404.
learningHub.get("/notes/:id", async (req, res) => {
  const ctx = await resolveCtx(req, res);
  if (!ctx) return;
  if (!okId(req.params.id)) { res.status(404).json({ error: "Lesson not found" }); return; }
  const snap = await notesCol.doc(req.params.id).get();
  const n = snap.exists ? (snap.data() as NoteDoc) : null;
  if (!n || n.tenantId !== ctx.tenantId || !canSee(ctx, n.franchiseId) || (!ctx.canEdit && n.published === false)) { res.status(404).json({ error: "Lesson not found" }); return; }
  const topic = (await visibleTopics(ctx)).find((t) => t.id === n.topicId);
  if (!topic) { res.status(404).json({ error: "Lesson not found" }); return; }
  res.json(await noteOutA(req, snap.id, n, ctx.canEdit));
});

// GET /notes/:id/homework-pack — READY-MADE homework for a lesson (tutors). A pure function of the lesson's own data
// (lib/hubHomeworkPack.ts), nothing stored: title, instructions, the exit quiz, the lesson's flashcards, a default due date.
// The tutor edits it and picks the children; POST /homework is unchanged.
learningHub.get("/notes/:id/homework-pack", async (req, res) => {
  const ctx = await resolveCtx(req, res);
  if (!ctx || !requireEdit(ctx, res)) return;
  if (!okId(req.params.id)) { res.status(404).json({ error: "Lesson not found" }); return; }
  const snap = await notesCol.doc(req.params.id).get();
  const n = snap.exists ? (snap.data() as NoteDoc) : null;
  if (!n || n.tenantId !== ctx.tenantId || !canSee(ctx, n.franchiseId) || n.kind === "board") { res.status(404).json({ error: "Lesson not found" }); return; }
  if (!(await visibleTopics(ctx)).some((t) => t.id === n.topicId)) { res.status(404).json({ error: "Lesson not found" }); return; }
  const lesson = n.lesson && typeof n.lesson === "object" ? n.lesson : null;
  const quizId = lesson && typeof lesson.quizId === "string" ? lesson.quizId : "";
  const a = quizId ? (await assessmentRows(ctx.tenantId)).get(quizId) : undefined;
  const quiz = a && a.tenantId === ctx.tenantId && canSee(ctx, a.franchiseId) ? { id: a.id, title: a.title, questionCount: (a.questionIds ?? []).length, published: a.published === true } : null;
  let flashcardCount = 0;
  if (lesson) {
    try { flashcardCount = (await db.collection("hubFlashcards").where("tenantId", "==", ctx.tenantId).where("lessonId", "==", snap.id).where("published", "==", true).count().get()).data().count; }
    catch { flashcardCount = 0; }
  }
  const cfg = await hubConfig(ctx.tenantId, n.franchiseId);
  res.set("Cache-Control", "private, no-cache");
  res.json(buildHomeworkPack({ noteId: snap.id, title: n.title, lesson, quiz, flashcardCount, flashcardTopicId: n.topicId, dueDays: cfg.homeworkDueDays }));
});

/** The structured `lesson` a tutor may attach (Oak import writes the same shape straight to Firestore). Deliberately loose about
 *  the content — only the fields that point at other documents are checked here (`checkLesson` verifies they are this tenant's). */
const lessonBody = z.object({
  warmupQuestionIds: z.array(z.string().min(1).max(100)).max(40).optional(),
  quizId: z.string().min(1).max(100).nullable().optional(),
  widget: z.string().regex(/^[A-Za-z0-9_-]{1,40}$/).nullable().optional(),
}).passthrough().refine((l) => JSON.stringify(l).length <= 900_000, { message: "That lesson is too large" });

const noteBody = z.object({
  topicId: z.string().min(1).max(100),
  title: z.string().trim().min(1).max(200),
  body: z.string().max(20_000).default(""),
  published: z.boolean().default(true),
  /** Set once, on create: a whiteboard snapshot (see NoteDoc.kind). Ignored on edit. */
  kind: z.literal("board").optional(),
  attachments: z.array(z.object({ id: z.string().min(1).max(100), name: z.string().trim().min(1).max(200) })).max(10).default([]),
  // YouTube links only (lib/hubRules.ts parseYouTube); omitted on an edit = keep the current ones.
  videos: z.array(z.object({ url: z.string().max(500), title: z.string().trim().max(120).optional(), start: z.number().int().min(0).max(86_400).optional() })).max(6).optional(),
  // Interactive lesson: omitted on an edit = keep the stored one, null = turn it back into a plain note.
  lesson: lessonBody.nullable().optional(),
});

/** A lesson may only point at THIS tenant's questions / quiz (the player reads them through those ids). */
async function checkLesson(tenantId: string, lesson: z.infer<typeof lessonBody>): Promise<string | null> {
  const ids = lesson.warmupQuestionIds ?? [];
  if (ids.length) {
    const qs = await questionIndex(tenantId);
    const missing = ids.filter((id) => !qs.has(id));
    // The cached tenant-wide index is built from a `.where(tenantId==)` query, which (unlike a direct doc get) isn't
    // guaranteed to see a document the instant after it was written — a tutor authoring a lesson right after adding
    // its warm-up questions (this exact flow) can hit that gap. Confirm real absence with a direct read before refusing.
    if (missing.length) {
      const snaps = await db.getAll(...missing.filter(okId).map((id) => db.collection("hubQuestions").doc(id)));
      if (missing.length !== snaps.length || snaps.some((s) => !s.exists || s.get("tenantId") !== tenantId)) return "A warm-up question in this lesson doesn't exist";
    }
  }
  if (lesson.quizId) {
    let exists = (await assessmentRows(tenantId)).has(lesson.quizId);
    if (!exists && okId(lesson.quizId)) {
      const snap = await db.collection("hubAssessments").doc(lesson.quizId).get();
      exists = snap.exists && snap.get("tenantId") === tenantId;
    }
    if (!exists) return "The quiz for this lesson doesn't exist";
  }
  // A slide deck sent on create / edit gets the SAME picture checks as PATCH (cleanSlideArt + claimSlideImages): the body is
  // passthrough, and `slidesOut` signs every `image.id` it finds — without this a lesson could carry any private image id
  // (another provider's child photo) and the hub would hand families a signed link to it.
  if (lesson.slides !== undefined) {
    if (!Array.isArray(lesson.slides)) return "Slides must be a list";
    const objs = lesson.slides.filter((s): s is Record<string, unknown> => !!s && typeof s === "object" && !Array.isArray(s));
    if (objs.length > 120) return "That slide deck has too many slides";
    const art = cleanSlideArt(objs);
    if (typeof art === "string") return art;
    const bad = await claimSlideImages(tenantId, art.imageIds);
    if (bad) return bad;
    lesson.slides = art.slides;
  }
  // …and the real deck (canvas slides) the same way.
  const deck = (lesson as Record<string, unknown>).deckSlides;
  if (deck !== undefined) {
    if (!Array.isArray(deck)) return "Slides must be a list";
    const objs = deck.filter((s): s is Record<string, unknown> => !!s && typeof s === "object" && !Array.isArray(s));
    if (objs.length > 120) return "That slide deck has too many slides";
    const art = cleanSlideArt(objs);
    if (typeof art === "string") return art;
    const bad = await claimSlideImages(tenantId, art.imageIds);
    if (bad) return bad;
    (lesson as Record<string, unknown>).deckSlides = art.slides;
  }
  return null;
}

/** Turn the client's {id,name} list into stored attachments, refusing any file
 *  that isn't a hub upload made by THIS tenant (POST /api/uploads {kind:"hub"}) —
 *  otherwise a tutor could attach a receipt or a child's photo, or another
 *  provider's file, and have the hub sign a link to it for every family. */
async function checkAttachments(tenantId: string, list: z.infer<typeof noteBody>["attachments"]): Promise<NoteDoc["attachments"] | string> {
  if (!list.length) return [];
  if (list.some((a) => !okId(a.id))) return "That attachment isn't valid";
  const snaps = await db.getAll(...list.map((a) => db.collection("images").doc(a.id)), { fieldMask: ["tenantId", "contentType", "private", "kind", "bytes", "submissionId", "hubUse"] });
  const out: NoteDoc["attachments"] = [];
  for (const [i, s] of snaps.entries()) {
    if (!s.exists || s.get("tenantId") !== tenantId || s.get("private") !== true || s.get("kind") !== "hub" || s.get("submissionId") || s.get("hubUse")) return `Attachment "${list[i].name}" wasn't uploaded for the Teaching Hub`;
    out.push({ id: s.id, name: list[i].name, contentType: s.get("contentType") as string, size: Number(s.get("bytes")) || 0 });
  }
  return out;
}

/** Best-effort removal of files a note no longer uses (they can be ~1MB each). */
async function dropFiles(tenantId: string, ids: string[]) {
  await Promise.all(ids.map(async (id) => {
    const ref = db.collection("images").doc(id);
    const s = await ref.get();
    // Never a family's homework hand-in file (those carry a submissionId): it isn't a note's to delete.
    // …nor a quiz question's picture (hubUse), which belongs to the question bank.
    if (s.exists && s.get("tenantId") === tenantId && s.get("kind") === "hub" && !s.get("submissionId") && !s.get("hubUse")) await ref.delete();
  })).catch(() => {});
}

/** A visible topic the caller may FILE a note under (a franchise may file under head office's). */
async function noteTopic(ctx: HubCtx, topicId: string) {
  if (!okId(topicId)) return null;
  const snap = await topicsCol.doc(topicId).get();
  if (!snap.exists || snap.get("tenantId") !== ctx.tenantId || !canSee(ctx, snap.get("franchiseId"))) return null;
  return snap;
}

learningHub.post("/notes", async (req, res) => {
  const ctx = await resolveCtx(req, res);
  if (!ctx || !requireEdit(ctx, res)) return;
  const parsed = noteBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues }); return; }
  if (!(await noteTopic(ctx, parsed.data.topicId))) { res.status(404).json({ error: "Topic not found" }); return; }
  const atts = await checkAttachments(ctx.tenantId, parsed.data.attachments);
  if (typeof atts === "string") { res.status(400).json({ error: atts }); return; }
  const vids = cleanVideos(parsed.data.videos);
  if (typeof vids === "string") { res.status(400).json({ error: vids }); return; }
  if (parsed.data.lesson) { const bad = await checkLesson(ctx.tenantId, parsed.data.lesson); if (bad) { res.status(400).json({ error: bad }); return; } }
  if (parsed.data.lesson) { const bad = await cleanLessonSlides(ctx.tenantId, parsed.data.lesson as Record<string, unknown>); if (bad) { res.status(400).json({ error: bad }); return; } }
  const now = new Date().toISOString();
  const doc: NoteDoc = { tenantId: ctx.tenantId, franchiseId: ctx.franchiseId, topicId: parsed.data.topicId, title: parsed.data.title, body: parsed.data.body, published: parsed.data.published, attachments: atts, videos: vids, ...(parsed.data.kind ? { kind: parsed.data.kind } : {}), ...(parsed.data.lesson ? { lesson: parsed.data.lesson } : {}), createdBy: ctx.uid, createdByName: ctx.name, createdAt: now, updatedAt: now };
  const ref = await notesCol.add(doc);
  patchNote(ctx.tenantId, ref.id, doc); pingHub(ctx.tenantId, "hubNotes");
  if (doc.published && doc.kind !== "board") notifyNewNote(ctx.tenantId, ctx.franchiseId, doc.topicId, doc.title, ref.id); // family bell (lib/hubNotify.ts) — never blocks the response
  res.status(201).json(await noteOutA(req, ref.id, doc));
});

/** A visible-and-writable note, or a refusal already sent. */
async function editableNote(ctx: HubCtx, id: string, res: import("express").Response) {
  if (!okId(id)) { res.status(404).json({ error: "Lesson not found" }); return null; }
  const snap = await notesCol.doc(id).get();
  if (!snap.exists || snap.get("tenantId") !== ctx.tenantId || !canSee(ctx, snap.get("franchiseId"))) { res.status(404).json({ error: "Lesson not found" }); return null; }
  if (!canWriteRow(ctx, snap.get("franchiseId"))) { res.status(403).json({ error: "That lesson belongs to head office" }); return null; }
  return snap;
}

learningHub.put("/notes/:id", async (req, res) => {
  const ctx = await resolveCtx(req, res);
  if (!ctx || !requireEdit(ctx, res)) return;
  const parsed = noteBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues }); return; }
  const snap = await editableNote(ctx, req.params.id, res);
  if (!snap) return;
  if (!(await noteTopic(ctx, parsed.data.topicId))) { res.status(404).json({ error: "Topic not found" }); return; }
  const atts = await checkAttachments(ctx.tenantId, parsed.data.attachments);
  if (typeof atts === "string") { res.status(400).json({ error: atts }); return; }
  const before = snap.data() as NoteDoc;
  const vids = parsed.data.videos === undefined ? (before.videos ?? []) : cleanVideos(parsed.data.videos);
  if (typeof vids === "string") { res.status(400).json({ error: vids }); return; }
  // Field-level update, not a whole-doc set on a stale read: two tutors editing
  // the same note can't resurrect each other's deletions.
  if (parsed.data.lesson) { const bad = await checkLesson(ctx.tenantId, parsed.data.lesson); if (bad) { res.status(400).json({ error: bad }); return; } }
  if (parsed.data.lesson) { const bad = await cleanLessonSlides(ctx.tenantId, parsed.data.lesson as Record<string, unknown>); if (bad) { res.status(400).json({ error: bad }); return; } }
  // The markdown editor never sends `lesson`, so editing the text of an interactive lesson keeps it intact.
  const lessonPatch = parsed.data.lesson === undefined ? {} : { lesson: parsed.data.lesson };
  const patch = { topicId: parsed.data.topicId, title: parsed.data.title, body: parsed.data.body, published: parsed.data.published, attachments: atts, videos: vids, ...lessonPatch, updatedAt: new Date().toISOString() };
  await snap.ref.update(patch);
  patchNote(ctx.tenantId, snap.id, { ...before, ...patch }); pingHub(ctx.tenantId, "hubNotes");
  const kept = new Set(atts.map((a) => a.id));
  void dropFiles(ctx.tenantId, (before.attachments ?? []).map((a) => a.id).filter((id) => !kept.has(id)));
  res.json(await noteOutA(req, snap.id, { ...before, ...patch }));
});

// PATCH /notes/:id {lesson:{widget}} — attach / detach the interactive "Explore" widget of an interactive lesson without
// resending the whole note (the widget picker in the tutor's lesson view). `widget: null` detaches. The server only checks
// the id's shape — the registry of widgets lives in the web app.
//
// A slide's PICTURE is the one part of the deck that is checked strictly (the rest is loose JSON the web app normalises):
//   pics:  [{id}] — ids of the verified picture library only (server/src/oak/factory/art/library.ts), at most 3;
//   image: {id, alt} — a private hub upload of THIS tenant (POST /api/uploads {purpose:"private", kind:"hub"}), alt text required;
//   artLock: true — the tutor chose (or removed) the picture: the factory / importer leaves that slide's art alone.
// A signed `url` sent back by the client is dropped: only the id is stored, every payload re-signs it (slidesOut).
const SLIDE_IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);
const slideArt = z.object({
  pics: z.array(z.object({ id: z.string().regex(/^[a-z0-9-]{1,60}$/) })).max(3).optional(),
  image: z.object({ id: z.string().regex(/^[A-Za-z0-9_-]{1,100}$/), alt: z.string().trim().min(1, "Describe the picture for screen readers (alt text)").max(300) }).nullable().optional(),
  artLock: z.literal(true).optional(),
}).passthrough();
const patchBody = z.object({
  lesson: z.object({
    widget: z.string().regex(/^[A-Za-z0-9_-]{1,40}$/).nullable().optional(),
    /** The slide deck (a tutor editing / deleting slides or changing pictures in the lesson preview). Loose JSON, size-capped; the web app normalises it. */
    slides: z.array(z.record(z.string(), z.unknown())).max(120).optional(),
    /** The lesson's REAL slide deck (Oak's own slides imported as editable canvas slides, oak/deckConvert.ts). Kept beside `slides` (our summary
     *  slides) so the player's "Summary slides instead" switch keeps working. [] = drop it (the player falls back to the embedded Oak deck). */
    deckSlides: z.array(z.record(z.string(), z.unknown())).max(120).optional(),
  }).refine((l) => l.widget !== undefined || l.slides !== undefined || l.deckSlides !== undefined, { message: "Nothing to change" })
    .refine((l) => !l.slides || JSON.stringify(l.slides).length <= 400_000, { message: "That slide deck is too large" })
    .refine((l) => !l.deckSlides || JSON.stringify(l.deckSlides).length <= 900_000, { message: "That slide deck is too large" })
    // both live on one Firestore note doc (1 MiB max, ~10 KB of other fields)
    .refine((l) => JSON.stringify(l.slides ?? []).length + JSON.stringify(l.deckSlides ?? []).length <= 950_000, { message: "That slide deck is too large" }),
});

/** Check every slide's picture fields and return the deck with only stored shapes (no signed urls), or a message for a 400. */
export function cleanSlideArt(slides: Record<string, unknown>[]): { slides: Record<string, unknown>[]; imageIds: string[] } | string {
  const out: Record<string, unknown>[] = [];
  const imageIds = new Set<string>();
  for (const [i, s] of slides.entries()) {
    const at = `Slide ${i + 1}`;
    const parsed = slideArt.safeParse(s);
    if (!parsed.success) return `${at}: ${parsed.error.issues[0]?.message ?? "bad picture"}`;
    const { pics, image, artLock, ...rest0 } = parsed.data;
    let rest: Record<string, unknown> = rest0;
    if (pics?.some((p) => !PIC_BY_ID[p.id])) return `${at}: that library picture doesn't exist`;
    if (image) imageIds.add(image.id);
    // A canvas slide (a real slide deck, oak/canvasSchema.ts): its pictures are elements, checked strictly like a slide's `image`.
    if (Array.isArray(rest.blocks) && rest.blocks.some((b) => b && (b as { t?: unknown }).t === "canvas")) {
      const blocks: unknown[] = [];
      for (const b of rest.blocks as unknown[]) {
        if (!b || (b as { t?: unknown }).t !== "canvas") { blocks.push(b); continue; }
        const c = cleanCanvasBlock(b);
        if (typeof c === "string") return `${at}: ${c}`;
        for (const id of c.imageIds) imageIds.add(id);
        blocks.push(c.block);
      }
      rest = { ...rest, blocks };
    }
    out.push({ ...rest, ...(pics?.length ? { pics: pics.map((p) => ({ id: p.id })) } : {}), ...(image ? { image: { id: image.id, alt: image.alt } } : {}), ...(artLock ? { artLock: true } : {}) });
  }
  return { slides: out, imageIds: [...imageIds] };
}

/** Are these ids THIS tenant's private hub images (PNG/JPEG/WebP, not a hand-in, not a question's picture)? Claims them for slides. */
async function claimSlideImages(tenantId: string, ids: string[]): Promise<string | null> {
  if (!ids.length) return null;
  const col = db.collection("images");
  const snaps = await db.getAll(...ids.map((id) => col.doc(id)), { fieldMask: ["tenantId", "contentType", "private", "kind", "submissionId", "hubUse"] });
  for (const s of snaps) {
    if (!s.exists || s.get("tenantId") !== tenantId || s.get("private") !== true || s.get("kind") !== "hub" || s.get("submissionId")) return "A slide picture wasn't uploaded for the Teaching Hub";
    if (!SLIDE_IMAGE_TYPES.has(String(s.get("contentType")))) return "Slide pictures must be PNG, JPEG or WebP";
    if (s.get("hubUse") && s.get("hubUse") !== "slide") return "That file is already used elsewhere — upload the picture again";
  }
  const fresh = snaps.filter((s) => s.get("hubUse") !== "slide");
  if (fresh.length) {
    const b = db.batch();
    for (const s of fresh) b.update(s.ref, { hubUse: "slide" });
    await b.commit();
  }
  return null;
}

/** A tutor-authored deck arriving on POST/PUT /notes: the pictures are checked like the slide PATCH does (library ids, this tenant's own uploads, alt text). */
async function cleanLessonSlides(tenantId: string, lesson: Record<string, unknown>): Promise<string | null> {
  for (const key of ["slides", "deckSlides"] as const) {
    const list = lesson[key];
    if (list === undefined) continue;
    if (!Array.isArray(list) || list.length > 120 || list.some((x) => !x || typeof x !== "object" || Array.isArray(x))) return "The slides aren't valid";
    const art = cleanSlideArt(list as Record<string, unknown>[]);
    if (typeof art === "string") return art;
    const bad = await claimSlideImages(tenantId, art.imageIds);
    if (bad) return bad;
    lesson[key] = art.slides;
  }
  return null;
}

learningHub.patch("/notes/:id", async (req, res) => {
  const ctx = await resolveCtx(req, res);
  if (!ctx || !requireEdit(ctx, res)) return;
  const parsed = patchBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues }); return; }
  const snap = await editableNote(ctx, req.params.id, res);
  if (!snap) return;
  const before = snap.data() as NoteDoc;
  if (!before.lesson || typeof before.lesson !== "object") { res.status(409).json({ error: "This is a plain lesson, not an interactive one", code: "not_a_lesson" }); return; }
  const upd: { widget?: string | null; slides?: Record<string, unknown>[]; deckSlides?: Record<string, unknown>[] } = { ...parsed.data.lesson };
  for (const key of ["slides", "deckSlides"] as const) {
    const list = upd[key];
    if (!list) continue;
    const art = cleanSlideArt(list);
    if (typeof art === "string") { res.status(400).json({ error: art }); return; }
    const bad = await claimSlideImages(ctx.tenantId, art.imageIds);
    if (bad) { res.status(400).json({ error: bad }); return; }
    upd[key] = art.slides;
  }
  const lesson = { ...before.lesson, ...(upd.widget !== undefined ? { widget: upd.widget } : {}), ...(upd.slides !== undefined ? { slides: upd.slides } : {}), ...(upd.deckSlides !== undefined ? { deckSlides: upd.deckSlides } : {}) };
  const updatedAt = new Date().toISOString();
  await snap.ref.update({ ...(upd.widget !== undefined ? { "lesson.widget": upd.widget } : {}), ...(upd.slides !== undefined ? { "lesson.slides": upd.slides } : {}), ...(upd.deckSlides !== undefined ? { "lesson.deckSlides": upd.deckSlides } : {}), updatedAt });
  patchNote(ctx.tenantId, snap.id, { ...before, lesson, updatedAt }); pingHub(ctx.tenantId, "hubNotes");
  res.json(await noteOutA(req, snap.id, { ...before, lesson, updatedAt }));
});

learningHub.delete("/notes/:id", async (req, res) => {
  const ctx = await resolveCtx(req, res);
  if (!ctx || !requireEdit(ctx, res)) return;
  const snap = await editableNote(ctx, req.params.id, res);
  if (!snap) return;
  await snap.ref.delete();
  patchNote(ctx.tenantId, snap.id, null); pingHub(ctx.tenantId, "hubNotes");
  void dropFiles(ctx.tenantId, ((snap.data() as NoteDoc).attachments ?? []).map((a) => a.id));
  res.json({ ok: true });
});

// ── Later milestones: their own routers (see docs/learning-hub.md) ───────────
learningHub.use(hubGroupsApi);      // student groups (quick actions)
learningHub.use(hubTutorsApi);      // who can teach (per-tutor scoping)
learningHub.use(hubAssessmentsApi); // config, questions, assessments, attempts, mastery
learningHub.use(hubTeachingApi);    // homework, flashcards, live lessons
