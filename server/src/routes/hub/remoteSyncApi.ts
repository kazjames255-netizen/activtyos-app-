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
//   PATCH  /remote-sync/sessions/:id/live-answer {childId, step, slide, questionId?, questionPrompt?, response?, verdict?} →
//          family: cheap, debounced report of this child's CURRENT POSITION (fires on every step/slide change, not just
//          warm-up/quiz — see the file's SessionDoc.liveAnswers comment) — pace "own_pace" only reads this (the tutor's mini-screens)
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
//   "own_pace"  — each child moves entirely freely, for the whole session, regardless of the tutor's own step;
//                 `liveAnswers` gives the tutor a live read of each connected child's OWN current step/slide, and,
//                 while that child is on warm-up/quiz, the question + their in-progress answer (nothing is recorded from it).

export const hubRemoteSyncApi = Router();

/** Mirrors the client's HelpTools.tsx HelpToolId — deliberately a short, fixed list (not tutor-defined content),
 *  so "help tools" can never grow into something that competes with the lesson itself. */
const HELP_TOOL_IDS = [
  "calculator", "numberline", "timestable", "fractions", "grid", "ruler", "protractor", "plot",
  "periodic", "bohr", "apparatus", "lens", "map", "timeline", "clock", "timer", "dice", "spinner", "tally", "symbol",
] as const;
type HelpToolId = (typeof HELP_TOOL_IDS)[number];

const CLASS_MAX = 30;
const CONNECTED_MS = 30_000;
// A session with no heartbeat/progress/live-answer write in this long isn't a class in session any more — nobody's
// there to have "ended" it (the tutor's own End action was removed in favour of a plain "Leave", which keeps the
// session live so a real disconnect is resumable). Without this, a session nobody explicitly ends would sit as
// "live" forever, and "you're broadcasting — Rejoin" / the family's "Resume" banner would never go away — for one
// stale row today, but unboundedly many after enough abandoned sessions pile up. Lazily flipping it to "ended" the
// next time anyone asks "what's live" keeps both banners bounded to genuinely recent, real classes, no cron needed.
// P-01: 90 min (was 6 h). Only tutor actions and real child answer writes (live-answer) bump `updatedAt`; child
// heartbeats deliberately do NOT, so a tutor who forgot to press End cannot be kept "live" by an open child tab.
// The tutor can now end explicitly (End lesson on the banner). 90 min chosen over 45 so a long lesson with a quiet
// spell is not cut off; revisit as a tenant setting.
const STALE_MS = 90 * 60_000;
const digest = (...parts: string[]) => createHash("sha256").update(parts.join("\u0000")).digest("hex").slice(0, 40);

/** Flips a stale "live" row to "ended" (fire-and-forget — callers never wait on this) and reports whether it did,
 *  so the caller can treat it as no-longer-live in the SAME response instead of on the next read. */
function sweepIfStale(s: SessionDoc & { id: string }): boolean {
  if (s.status !== "live" || Date.now() - new Date(s.updatedAt).getTime() < STALE_MS) return false;
  void lessonsCol.doc(s.id).update({ status: "ended", endedAt: nowIso(), updatedAt: nowIso() }).catch(() => undefined);
  s.status = "ended";
  return true;
}

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
  /** "own_pace" only: childId → this child's last-reported live position, for the tutor's mini-screens. Every write
   *  REPLACES the whole entry (never a partial merge) — a child who has moved off warm/quiz reports just
   *  {step, slide}, which correctly drops any stale questionId/response/verdict from what they were doing before.
   *  Never marked, never recorded — purely a live read. */
  liveAnswers?: Record<string, { step: string; slide: number; questionId?: string; questionPrompt?: string; response?: unknown; verdict?: boolean | null; updatedAt: string }>;
  /** The small, fixed "help board" the tutor opted this class into (calculator, number line…) — see the client's
   *  HelpTools.tsx. Deliberately tiny and generic, never subject content, so it can't compete with the actual
   *  lesson or a real whiteboard. Missing on rows created before this existed — every read site falls back to []. */
  tools?: HelpToolId[];
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
  const liveAnswers = Object.entries(s.liveAnswers ?? {}).map(([childId, v]) => ({
    childId, childName: names.get(childId) ?? "Student", step: v.step, slide: v.slide ?? 0,
    questionId: v.questionId, questionPrompt: v.questionPrompt, response: v.response, verdict: v.verdict ?? null, updatedAt: v.updatedAt,
  }));
  return {
    id: s.id, mode: "remote_sync" as const, title: s.title, status: s.status, startsAt: s.startsAt, endedAt: s.endedAt ?? null,
    tutorName: s.tutorName, noteId: s.noteId, groupIds: s.groupIds ?? [], childIds: s.childIds, step: s.step, slide: s.slide,
    pace: s.pace ?? "own_pace", liveAnswers, tools: s.tools ?? [],
    students, connectedCount: students.filter((x) => x.connected).length, totalCount: students.length,
  };
};

/** What a family's device gets: the position to follow, and nothing about other children. */
const familyOut = (s: Session) => ({
  id: s.id, title: s.title, status: s.status, tutorName: s.tutorName, noteId: s.noteId, step: s.step, slide: s.slide,
  pace: s.pace ?? "own_pace", tools: s.tools ?? [],
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
  /** The tutor's opt-in "help board" for this class — see HelpTools.tsx. Off (empty) unless explicitly chosen. */
  tools: z.array(z.enum(HELP_TOOL_IDS)).max(HELP_TOOL_IDS.length).default([]),
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
    tools: b.tools, createdBy: ctx.uid, createdAt: now, updatedAt: now,
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

/** Live remote-sync sessions this tutor may resume — mirrors GET /in-person/sessions?status=live: a tutor who refreshed
 *  or closed the tab while broadcasting has no other way back to TutorRunner, so RemoteSyncApp checks this on mount
 *  (optionally narrowed to one lesson via ?noteId=) and offers "Resume broadcasting" instead of losing the class. */
hubRemoteSyncApi.get("/remote-sync/sessions", async (req, res) => {
  const ctx = await resolveCtx(req, res);
  if (!ctx || !requireEdit(ctx, res)) return;
  const status = req.query.status === "live" || req.query.status === "ended" ? req.query.status : null;
  const noteId = typeof req.query.noteId === "string" && req.query.noteId ? req.query.noteId : null;
  const snap = await lessonsCol.where("tenantId", "==", ctx.tenantId).where("mode", "==", "remote_sync").get();
  const all = snap.docs.map((d) => ({ id: d.id, ...(d.data() as SessionDoc) }));
  for (const s of all) sweepIfStale(s);
  const rows = all
    .filter((s) => canSeeStudent(ctx, s.franchiseId) && s.status !== "cancelled" && (!status || s.status === status) && (!noteId || s.noteId === noteId))
    .sort((a, b) => b.startsAt.localeCompare(a.startsAt)).slice(0, 20);
  const names = await namesOf(ctx, [...new Set(rows.flatMap((s) => s.childIds))]);
  res.json(rows.map((s) => tutorOut(s, names)));
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

const addStudentsBody = z.object({
  childIds: z.array(z.string().min(1).max(100)).max(CLASS_MAX).optional(),
  /** Turning help tools on/off for a session already live — the start screen's picker only sets this at creation,
   *  so resuming (TutorLiveBanner's Rejoin, or reopening "Share with children") needs its own way to change it,
   *  or a tutor who enables a tool after the fact would see it never actually reach the student. Replaces the
   *  whole set (not merged), so switching one back off here actually takes it away. */
  tools: z.array(z.enum(HELP_TOOL_IDS)).max(HELP_TOOL_IDS.length).optional(),
}).refine((b) => b.childIds?.length || b.tools !== undefined, { message: "Nothing to update" });

/** Returning to an already-live session (the "you're broadcasting — Rejoin" banner, or reopening "Share with
 *  children" on this lesson): add students to the class already running (instead of it looking like a second,
 *  separate session has to be started to bring anyone else in — `childIds` is unioned with whoever's already in,
 *  passing the tutor's whole current picker selection is always safe, never removes anyone) and/or change which
 *  help tools this class has. */
hubRemoteSyncApi.patch("/remote-sync/sessions/:id/students", async (req, res) => {
  const ctx = await resolveCtx(req, res);
  if (!ctx || !requireEdit(ctx, res)) return;
  const parsed = addStudentsBody.safeParse(req.body ?? {});
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues }); return; }
  const s = await sessionFor(ctx, req.params.id, res, true);
  if (!s) return;
  if (s.status !== "live") { res.status(409).json({ error: "This session has ended", code: "lesson_closed" }); return; }
  let childIds = s.childIds;
  if (parsed.data.childIds?.length) {
    const direct = await eligibleStudents(ctx, parsed.data.childIds);
    if (!direct) { res.status(404).json({ error: "Student not found — remote lessons are for your enrolled students" }); return; }
    childIds = [...new Set([...s.childIds, ...direct.map((d) => d.childId)])];
    if (childIds.length > CLASS_MAX) { res.status(400).json({ error: `A remote lesson holds up to ${CLASS_MAX} students` }); return; }
  }
  const now = nowIso();
  await lessonsCol.doc(s.id).update({ childIds, ...(parsed.data.tools !== undefined ? { tools: parsed.data.tools } : {}), updatedAt: now });
  pingHub(ctx.tenantId, "hubLessons");
  const fresh = { id: s.id, ...((await lessonsCol.doc(s.id).get()).data() as SessionDoc) };
  res.json(tutorOut(fresh, await namesOf(ctx, fresh.childIds)));
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
  // More than one "live" row can exist at once (a tutor who refreshed mid-broadcast leaves the old one open until they
  // leave or resume+leave it) — always follow the one that started most recently, never an arbitrary match, or a
  // family can end up parked on a stale session nobody is driving while the tutor's screen shows nobody connected.
  const rows = snap.docs.map((d) => ({ id: d.id, ...(d.data() as SessionDoc) })).filter((s) => canSee(ctx, s.franchiseId));
  const row = rows.filter((s) => !sweepIfStale(s)).sort((a, b) => b.startsAt.localeCompare(a.startsAt))[0];
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
  await lessonsCol.doc(s.id).update({ [`attendance.${child.childId}`]: now });
  // Without this, the tutor's screen only learns a child (re)connected on its own 10s poll — a real but needless
  // delay on top of what should be a near-live "X of Y connected" (progress/live-answer writes already ping).
  pingHub(ctx.tenantId, "hubLessons");
  res.json(familyOut({ ...s, step: s.step, slide: s.slide }));
});

const liveAnswerBody = z.object({
  childId: z.string().min(1).max(100),
  /** The step (and, for "slides", the slide index) this child is actually on right now — reported continuously,
   *  not just during warm-up/quiz, so own_pace mini-screens reflect this child's REAL position, never the tutor's. */
  step: z.string().min(1).max(40),
  slide: z.number().int().min(0).max(2000).default(0),
  /** Warm-up/quiz only: the question they're currently on, and its prompt text (so the tutor's tile can show
   *  "Q: …" with no separate lookup). Left out for any other step. */
  questionId: z.string().min(1).max(100).optional(),
  questionPrompt: z.string().max(500).optional(),
  response: z.unknown().optional(),
  /** Warm-up only: the Check verdict for their current answer, once known. Real-quiz correctness isn't known live. */
  verdict: z.boolean().nullable().optional(),
});

// "own_pace" mini-screens: a cheap, frequent write of this child's current position — just {step, slide} on most
// steps, plus the in-progress warm-up/quiz answer (+ prompt, + warm-up verdict once checked) while they're on one of
// those. Never marked, never counts as an attempt — purely a live read for the tutor's screen. Each write REPLACES
// the child's whole liveAnswers entry (see SessionDoc.liveAnswers), so moving off warm/quiz correctly drops the
// stale question/response/verdict rather than leaving it to look current.
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
  const { step, slide, questionId, questionPrompt, response, verdict } = parsed.data;
  const entry: { step: string; slide: number; updatedAt: string; questionId?: string; questionPrompt?: string; response?: unknown; verdict?: boolean | null } = { step, slide, updatedAt: now };
  if (questionId !== undefined) entry.questionId = questionId;
  if (questionPrompt !== undefined) entry.questionPrompt = questionPrompt;
  if (response !== undefined) entry.response = cleanResponse(response);
  if (verdict !== undefined) entry.verdict = verdict;
  await lessonsCol.doc(s.id).update({ [`liveAnswers.${child.childId}`]: entry, updatedAt: now });
  pingHub(ctx.tenantId, "hubLessons");
  res.json({ ok: true });
});
