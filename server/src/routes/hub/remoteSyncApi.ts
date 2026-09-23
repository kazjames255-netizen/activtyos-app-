import { createHash } from "node:crypto";
import { Router, type Response } from "express";
import { z } from "zod";
import { db } from "../../firebase";
import { cleanResponse } from "./attempts";
import { canSee, canSeeStudent, canWriteRow, hubEnrolments, okId, requireEdit, resolveCtx, scopedChildren, type HubCtx } from "../../lib/hubCore";
import { activeMembers, visibleGroups } from "../../lib/hubGroups";
import { pingHub } from "../../lib/hubPing";
import { enrolmentId, nowIso } from "./shared";
import { eligibleStudents, lessonsCol, notesCol, parentChild } from "./teachingCommon";

// Learning Hub — REMOTE SYNC: "Start lesson now (remote)". A tutor drives an interactive lesson from their own device;
// students who are NOT physically present and NOT on a video call each open it on their own device (already signed in to
// their family/child account) and their screen follows the tutor's — same "tutor drives, students follow" UX as a video
// lesson's TeachLesson.tsx, but with no call at all. Sibling of in-person (routes/hub/inPersonApi.ts, no video, children
// beside the tutor) and live video lessons (routes/hub/lessonsApi.ts).
//
// A session is an ordinary hubLessons row with `mode: "remote_sync"` — same collection as in-person and video lessons, so
// it rides the SAME realtime channel (routes/events.ts already streams hubLessons to the tenant and, for a family, to any
// lesson whose childIds include their kids) with zero new wiring. lessonsApi.ts's GET /lessons and its family/tutor "join
// a video call" routes already exclude this mode, exactly as they exclude in_person.
//
//   POST   /remote-sync/sessions {noteId, childIds|groupIds, title?, key?, pace?} → tutor starts a session driving one lesson
//   GET    /remote-sync/sessions/:id                                          → tutor: current position + who is connected
//   PATCH  /remote-sync/sessions/:id/progress {step, slide}                   → tutor: cheap, frequent position updates
//   GET    /remote-sync/active                                                → family: the live session for their child (or null)
//   POST   /remote-sync/sessions/:id/heartbeat                                → family: "I'm still here" (every ~12s while joined)
//   PATCH  /remote-sync/sessions/:id/live-answer {childId, questionId, response} → family: cheap, debounced "here's what I've
//          got so far" for the warm-up/quiz question they're on — pace "own_pace" only reads this (the tutor's mini-screens)
//   POST   /remote-sync/sessions/:id/end                                      → tutor ends it
//
// Presence is intentionally minimal: `attendance[childId]` is stamped on join and refreshed by each heartbeat; a student
// counts as "connected" while their stamp is under CONNECTED_MS old. No reconnect/backoff logic beyond the client's own
// polling — good enough for "X of Y connected", not a generic presence system.
//
// `pace` picks how the class moves through the lesson (chosen once, at start):
//   "driven"    — the tutor answers warm-up/quiz FOR the class (tag-a-child-onto-an-option); students only watch, so their
//                 device just follows step/slide like a video-call lesson always has. Real quiz attempts are still started
//                 and submitted per child through the ordinary /assessments/:id/attempts + /attempts/:id/submit routes
//                 (below), with the TUTOR as the caller and body.childId set — attempts.ts already lets a tutor do this on
//                 a student's behalf, so there's no separate recording path here.
//   "lockstep"  — each child answers for real on their own device, but can't move past the tutor's current top-level step.
//   "own_pace"  — each child moves entirely freely; while the tutor is on warm-up/quiz, `liveAnswers` gives the tutor a
//                 live read of what each connected child currently has selected/typed (nothing is recorded from it).

export const hubRemoteSyncApi = Router();

const CLASS_MAX = 30;
const CONNECTED_MS = 30_000;
const digest = (...parts: string[]) => createHash("sha256").update(parts.join("\u0000")).digest("hex").slice(0, 40);

interface SessionDoc {
  tenantId: string; franchiseId: string | null; mode: "remote_sync";
  tutorUid: string; tutorName: string; title: string; topicId: string | null;
  startsAt: string; durationMins: number; childIds: string[]; status: "live" | "ended" | "cancelled";
  roomName: null; roomUrl: null; notes: string; videos: unknown[]; noteIds: string[]; groupIds: string[];
  /** childId → ISO time of that child's last heartbeat (join counts as one). Doubles as "connected" presence. */
  attendance: Record<string, string>;
  tutorJoinedAt: string | null; endedAt: string | null;
  noteId: string;
  /** Where the tutor's screen is right now — every student's player follows this. */
  step: string; slide: number;
  /** How the class moves through the lesson — see the file header. Missing on nothing (always set at creation); optional
   *  only so a defensive `?? "own_pace"` at every read site never has to special-case a malformed row. */
  pace?: "driven" | "lockstep" | "own_pace";
  /** "own_pace" only: childId → the in-progress warm-up/quiz answer they last reported, for the tutor's mini-screens.
   *  Never marked, never recorded — purely a live read. */
  liveAnswers?: Record<string, { questionId: string; response: unknown; updatedAt: string }>;
  createdBy: string; createdAt: string; updatedAt: string;
}
type Session = SessionDoc & { id: string };

const namesOf = async (ctx: HubCtx, ids: string[]): Promise<Map<string, string>> => {
  const out = new Map<string, string>();
  if (!ids.length) return out;
  const snaps = await db.getAll(...ids.filter(okId).map((c) => hubEnrolments.doc(enrolmentId(ctx.tenantId, c))));
  for (const s of snaps) if (s.exists) out.set(s.get("childId") as string, (s.get("childName") as string) ?? "");
  return out;
};

const tutorOut = (s: Session, names: Map<string, string>) => {
  const now = Date.now();
  const students = s.childIds.map((id) => {
    const at = s.attendance?.[id];
    return { childId: id, childName: names.get(id) ?? "Student", connected: !!at && now - new Date(at).getTime() < CONNECTED_MS, lastSeenAt: at ?? null };
  });
  const liveAnswers = Object.entries(s.liveAnswers ?? {}).map(([childId, v]) => ({ childId, childName: names.get(childId) ?? "Student", questionId: v.questionId, response: v.response, updatedAt: v.updatedAt }));
  return {
    id: s.id, mode: "remote_sync" as const, title: s.title, status: s.status, startsAt: s.startsAt, endedAt: s.endedAt ?? null,
    tutorName: s.tutorName, noteId: s.noteId, groupIds: s.groupIds ?? [], childIds: s.childIds, step: s.step, slide: s.slide,
    pace: s.pace ?? "own_pace", liveAnswers,
    students, connectedCount: students.filter((x) => x.connected).length, totalCount: students.length,
  };
};

/** What a family's device gets: the position to follow, and nothing about other children. */
const familyOut = (s: Session) => ({
  id: s.id, title: s.title, status: s.status, tutorName: s.tutorName, noteId: s.noteId, step: s.step, slide: s.slide,
  pace: s.pace ?? "own_pace",
});

/** A live/ended remote-sync session this tutor may act on (tenant + scope), else a refusal has been sent. */
async function sessionFor(ctx: HubCtx, id: string, res: Response, write: boolean): Promise<Session | null> {
  const nf = () => { res.status(404).json({ error: "Session not found" }); return null; };
  if (!okId(id)) return nf();
  const snap = await lessonsCol.doc(id).get();
  if (!snap.exists || snap.get("tenantId") !== ctx.tenantId || snap.get("mode") !== "remote_sync" || !canSeeStudent(ctx, snap.get("franchiseId"))) return nf();
  if (write && !canWriteRow(ctx, snap.get("franchiseId"))) { res.status(403).json({ error: "That session belongs to head office" }); return null; }
  return { id: snap.id, ...(snap.data() as SessionDoc) };
}

// ── tutor: create ────────────────────────────────────────────────────────────

const createBody = z.object({
  noteId: z.string().min(1).max(100),
  childIds: z.array(z.string().min(1).max(100)).max(CLASS_MAX).default([]),
  groupIds: z.array(z.string().min(1).max(100)).max(20).optional(),
  title: z.string().trim().min(1).max(200).optional(),
  /** Client-generated id for this tap: a double tap / retry returns the same session instead of a second one. */
  key: z.string().min(6).max(80).optional(),
  /** How the class moves through the lesson — see the file header. Defaults to today's shape: each child for real, at their own pace. */
  pace: z.enum(["driven", "lockstep", "own_pace"]).default("own_pace"),
});

hubRemoteSyncApi.post("/remote-sync/sessions", async (req, res) => {
  const ctx = await resolveCtx(req, res);
  if (!ctx || !requireEdit(ctx, res)) return;
  const parsed = createBody.safeParse(req.body ?? {});
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues }); return; }
  const b = parsed.data;
  if (!okId(b.noteId)) { res.status(404).json({ error: "Lesson not found" }); return; }
  const note = await notesCol.doc(b.noteId).get();
  if (!note.exists || note.get("tenantId") !== ctx.tenantId || !canSee(ctx, note.get("franchiseId"))) { res.status(404).json({ error: "Lesson not found" }); return; }
  if (!note.get("lesson")) { res.status(400).json({ error: "This lesson has no interactive part, so it can't be run live." }); return; }

  const direct = await eligibleStudents(ctx, b.childIds);
  if (!direct) { res.status(404).json({ error: "Student not found — remote lessons are for your enrolled students" }); return; }
  const groups = await visibleGroups(ctx, b.groupIds ?? []);
  if (!groups) { res.status(404).json({ error: "Group not found" }); return; }
  const students = [...new Map([...direct, ...(await activeMembers(ctx, groups))].map((e) => [e.childId, e])).values()];
  if (!students.length) { res.status(400).json({ error: "Choose the students joining remotely, or a group that has students in it" }); return; }
  if (students.length > CLASS_MAX) { res.status(400).json({ error: `A remote lesson holds up to ${CLASS_MAX} students` }); return; }

  const now = nowIso();
  const ref = b.key ? lessonsCol.doc(`rs_${digest(ctx.tenantId, ctx.uid, b.key)}`) : lessonsCol.doc();
  const names = new Map(students.map((s) => [s.childId, s.childName]));
  if (b.key) {
    const existing = await ref.get();
    if (existing.exists && existing.get("tenantId") === ctx.tenantId && existing.get("mode") === "remote_sync") {
      res.json(tutorOut({ id: ref.id, ...(existing.data() as SessionDoc) }, await namesOf(ctx, existing.get("childIds") as string[]))); return;
    }
  }
  const title = b.title || (note.get("title") as string) || "Lesson";
  const doc: SessionDoc = {
    tenantId: ctx.tenantId, franchiseId: ctx.franchiseId, mode: "remote_sync", tutorUid: ctx.uid, tutorName: ctx.name || "Your tutor",
    title, topicId: null, startsAt: now, durationMins: 60, childIds: students.map((s) => s.childId), status: "live",
    roomName: null, roomUrl: null, notes: "", videos: [], noteIds: [b.noteId], groupIds: groups.map((g) => g.id),
    attendance: {}, tutorJoinedAt: now, endedAt: null, noteId: b.noteId, step: "start", slide: 0, pace: b.pace, liveAnswers: {},
    createdBy: ctx.uid, createdAt: now, updatedAt: now,
  };
  await ref.set(doc);
  pingHub(ctx.tenantId, "hubLessons");
  res.status(201).json(tutorOut({ id: ref.id, ...doc }, names));
});

// ── tutor: read + progress ───────────────────────────────────────────────────

hubRemoteSyncApi.get("/remote-sync/sessions/:id", async (req, res) => {
  const ctx = await resolveCtx(req, res);
  if (!ctx || !requireEdit(ctx, res)) return;
  const s = await sessionFor(ctx, req.params.id, res, false);
  if (!s) return;
  res.json(tutorOut(s, await namesOf(ctx, s.childIds)));
});

const progressBody = z.object({ step: z.string().min(1).max(40), slide: z.number().int().min(0).max(2000).default(0) });

hubRemoteSyncApi.patch("/remote-sync/sessions/:id/progress", async (req, res) => {
  const ctx = await resolveCtx(req, res);
  if (!ctx || !requireEdit(ctx, res)) return;
  const parsed = progressBody.safeParse(req.body ?? {});
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues }); return; }
  const s = await sessionFor(ctx, req.params.id, res, true);
  if (!s) return;
  if (s.status !== "live") { res.status(409).json({ error: "This session has ended", code: "lesson_closed" }); return; }
  const now = nowIso();
  await lessonsCol.doc(s.id).update({ step: parsed.data.step, slide: parsed.data.slide, updatedAt: now });
  pingHub(ctx.tenantId, "hubLessons");
  res.json({ ok: true });
});

hubRemoteSyncApi.post("/remote-sync/sessions/:id/end", async (req, res) => {
  const ctx = await resolveCtx(req, res);
  if (!ctx || !requireEdit(ctx, res)) return;
  const s = await sessionFor(ctx, req.params.id, res, true);
  if (!s) return;
  if (s.status === "live") {
    const now = nowIso();
    await lessonsCol.doc(s.id).update({ status: "ended", endedAt: now, updatedAt: now });
    pingHub(ctx.tenantId, "hubLessons");
  }
  const fresh = { id: s.id, ...((await lessonsCol.doc(s.id).get()).data() as SessionDoc) };
  res.json(tutorOut(fresh, await namesOf(ctx, fresh.childIds)));
});

// ── family: find + join + heartbeat ─────────────────────────────────────────

/** The one live remote-sync session (if any) covering one of this family's children. Only ever one at a time in
 *  practice (a tutor teaches one class at once), but a lesson doc is looked up per enrolled child's scope to stay
 *  consistent with how every other family read here is scoped. */
hubRemoteSyncApi.get("/remote-sync/active", async (req, res) => {
  const ctx = await resolveCtx(req, res);
  if (!ctx) return;
  if (ctx.role !== "parent") { res.json(null); return; }
  const ids = scopedChildren(ctx).map((c) => c.childId);
  if (!ids.length) { res.json(null); return; }
  const snap = await lessonsCol.where("tenantId", "==", ctx.tenantId).where("mode", "==", "remote_sync").where("status", "==", "live").where("childIds", "array-contains-any", ids.slice(0, 10)).get();
  const row = snap.docs.map((d) => ({ id: d.id, ...(d.data() as SessionDoc) })).find((s) => canSee(ctx, s.franchiseId));
  res.json(row ? familyOut(row) : null);
});

hubRemoteSyncApi.post("/remote-sync/sessions/:id/heartbeat", async (req, res) => {
  const ctx = await resolveCtx(req, res);
  if (!ctx) return;
  if (ctx.role !== "parent") { res.status(403).json({ error: "Only a family can join a remote lesson" }); return; }
  const child = parentChild(ctx, res, req.body?.childId);
  if (!child) return;
  const s = await sessionFor(ctx, req.params.id, res, false);
  if (!s) return;
  if (!s.childIds.includes(child.childId)) { res.status(404).json({ error: "Session not found" }); return; }
  if (s.status !== "live") { res.status(409).json({ error: "Your tutor has ended this lesson", code: "lesson_closed" }); return; }
  const now = nowIso();
  await lessonsCol.doc(s.id).update({ [`attendance.${child.childId}`]: now, updatedAt: now });
  res.json(familyOut({ ...s, step: s.step, slide: s.slide }));
});

const liveAnswerBody = z.object({ childId: z.string().min(1).max(100), questionId: z.string().min(1).max(100), response: z.unknown() });

// "own_pace" mini-screens: a cheap, frequent write of what a child currently has selected/typed for the warm-up/quiz
// question they're on right now. Never marked, never counts as an attempt — purely a live read for the tutor's screen.
hubRemoteSyncApi.patch("/remote-sync/sessions/:id/live-answer", async (req, res) => {
  const ctx = await resolveCtx(req, res);
  if (!ctx) return;
  if (ctx.role !== "parent") { res.status(403).json({ error: "Only a family can send this" }); return; }
  const parsed = liveAnswerBody.safeParse(req.body ?? {});
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues }); return; }
  const child = parentChild(ctx, res, parsed.data.childId);
  if (!child) return;
  const s = await sessionFor(ctx, req.params.id, res, false);
  if (!s) return;
  if (!s.childIds.includes(child.childId)) { res.status(404).json({ error: "Session not found" }); return; }
  if (s.status !== "live") { res.status(409).json({ error: "Your tutor has ended this lesson", code: "lesson_closed" }); return; }
  const now = nowIso();
  await lessonsCol.doc(s.id).update({ [`liveAnswers.${child.childId}`]: { questionId: parsed.data.questionId, response: cleanResponse(parsed.data.response), updatedAt: now }, updatedAt: now });
  pingHub(ctx.tenantId, "hubLessons");
  res.json({ ok: true });
});
