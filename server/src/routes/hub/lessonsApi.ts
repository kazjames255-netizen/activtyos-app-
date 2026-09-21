import { Router } from "express";
import { db } from "../../firebase";
import { z } from "zod";
import { canSee, canSeeStudent, canWriteRow, okId, registerTopicRef, requireEdit, resolveCtx, scopedChildren, type HubCtx } from "../../lib/hubCore";
import { nameList, notifyFamilies } from "../../lib/hubNotify";
import { activeMembers, visibleGroups } from "../../lib/hubGroups";
import { cleanVideos, videosOut, type StoredVideo } from "../../lib/hubRules";
import { deleteRoom, ensureRoom, joinWindow, mintToken, roomExpiry, roomNameFor, setRoomExpiry, MAX_OVERRUN_MS, STAY_EXTENSION_MS, STAY_PROMPT_MS, VideoError, videoConfigured, windowState } from "../../lib/hubVideo";
import { rateLimit } from "../../lib/rateLimit";
import { deleteBoardForLesson } from "./boardsApi";
import { eligibleStudents, isParent, lessonsCol, notesCol, nowIso, tenantEnrolments, visibleTopic } from "./teachingCommon";

// Learning Hub — LIVE LESSONS (a main function of the page). Contract:
// docs/learning-hub.md → "Live lessons". A tutor schedules a lesson for enrolled
// students; at lesson time both sides call POST /lessons/:id/join and get a
// {url, token} for a PRIVATE Daily room (lib/hubVideo.ts).
//
// Video safety (children are on this call):
//  · the room is private + expires; the URL alone lets nobody in
//  · a meeting token is minted ONLY for (a) a tutor of this tenant/scope who can
//    write the lesson, or (b) a parent whose ENROLLED child is in `childIds`
//  · only inside the join window (10 min before start → 30 min after the end),
//    and never for a cancelled / ended lesson
//  · only the tutor is `is_owner` (can mute / remove people)
// The room itself is created lazily on the first join, so scheduling a lesson
// never depends on Daily being reachable and abandoned lessons leave no rooms.

export const hubLessonsApi = Router();
registerTopicRef(lessonsCol); // a topic can't be deleted while a lesson points at it

type Status = "scheduled" | "live" | "ended" | "cancelled";
interface LessonDoc {
  tenantId: string; franchiseId: string | null;
  tutorUid: string; tutorName: string; title: string; topicId: string | null;
  startsAt: string; durationMins: number; childIds: string[]; status: Status;
  roomName: string | null; roomUrl: string | null; notes: string;
  /** YouTube videos shown with the lesson notes. */
  videos?: StoredVideo[];
  /** Existing hub notes the tutor attached to this lesson (shown first in the call's Notes tab). */
  noteIds?: string[];
  /** Groups it was scheduled for (for display; the members were expanded into childIds). */
  groupIds?: string[];
  /** childId → ISO time that child's family first joined. */
  attendance: Record<string, string>;
  tutorJoinedAt: string | null; endedAt: string | null;
  /** ISO: how far "Stay on the call" has pushed the room's closing time (null = not extended). */
  roomUntil?: string | null;
  /** ISO: when a tutor last reopened a past/ended lesson for a fresh session. */
  reopenedAt?: string | null;
  /** Safeguarding: true from the moment a tutor ENDS (or reopens) a lesson until a tutor joins again. While set, a family can neither
   *  (re)join nor "Stay" — a room must never carry on with children in it and no tutor. Absent on lessons that were never ended. */
  needsTutor?: boolean;
  /** "in_person" = a tutor running a lesson with children beside them (routes/hub/inPersonApi.ts). Not a video lesson: hidden from
   *  every list and refused by join / extend / reopen / edit here. Absent = a video lesson. */
  mode?: "video" | "in_person";
  /** A weekly repeat: every lesson made together shares `seriesId` (an instance is otherwise an ordinary lesson: edit / cancel one on its own). */
  seriesId?: string; seriesIndex?: number; seriesCount?: number;
  /** "Log a lesson already held": recorded after the fact (ended, attendance as the tutor entered it, never had a room). */
  held?: boolean;
  createdBy: string; createdAt: string; updatedAt: string;
}
type Lesson = LessonDoc & { id: string };

const HISTORY_DAYS = 90;   // tutors: lessons from this long ago onwards
const FAMILY_DAYS = 30;    // families: upcoming + this recent
const OPEN = new Set<Status>(["scheduled", "live"]);

const lessonBody = z.object({
  title: z.string().trim().min(1).max(200),
  topicId: z.string().max(100).nullable().optional(),
  startsAt: z.string().max(40),
  durationMins: z.number().int().min(10).max(480),
  // Students and/or groups: the group members are added to the students (the union), at least one student overall (max 30).
  childIds: z.array(z.string().min(1).max(100)).max(30).default([]),
  groupIds: z.array(z.string().min(1).max(100)).max(20).optional(),
  videos: z.array(z.object({ url: z.string().max(500), title: z.string().trim().max(120).optional(), start: z.number().int().min(0).max(86_400).optional() })).max(6).optional(),
  noteIds: z.array(z.string().min(1).max(100)).max(12).optional(),
  notes: z.string().max(4000).default(""),
  tutorName: z.string().trim().max(120).optional(),
  /** Weekly repeat: the TOTAL number of weekly lessons to create (this one included), kept at the same wall-clock time in `timeZone`. */
  repeatWeeks: z.number().int().min(2).max(26).optional(),
  timeZone: z.string().max(60).optional(),
  /** Log a lesson that has ALREADY been held: a past start, no room, `attendedChildIds` recorded as present. */
  held: z.boolean().optional(),
  attendedChildIds: z.array(z.string().min(1).max(100)).max(30).optional(),
});

/** A lesson start must carry a time — a bare date ("2026-03-10") is refused rather than guessed. */
function startIso(v: string): string | null {
  if (!/T\d{2}:\d{2}/.test(v)) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

const when = (iso: string) => new Date(iso).toLocaleString("en-GB", { timeZone: "Europe/London", weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

/** `iso` moved on by `weeks` calendar weeks keeping the same wall-clock time in `tz` (a 6pm lesson stays 6pm when the clocks change). */
function addWeeksWall(iso: string, weeks: number, tz: string): string {
  const fmt = new Intl.DateTimeFormat("en-GB", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const wall = (d: Date) => { const p = fmt.formatToParts(d); const g = (t: string) => Number(p.find((x) => x.type === t)!.value); return Date.UTC(g("year"), g("month") - 1, g("day"), g("hour"), g("minute"), g("second")); };
  const t0 = new Date(iso);
  const target = wall(t0) + weeks * 7 * 86_400_000;
  let guess = t0.getTime() + weeks * 7 * 86_400_000;
  guess += target - wall(new Date(guess));
  guess += target - wall(new Date(guess)); // a second pass settles a guess that landed on the far side of the clock change
  return new Date(guess).toISOString();
}
const validZone = (tz: string) => { try { new Intl.DateTimeFormat("en-GB", { timeZone: tz }); return true; } catch { return false; } };

function windowOut(l: Lesson, now = new Date()) {
  const w = joinWindow(l.startsAt, l.durationMins, l.roomUntil);
  // Joinable at any point in the window unless cancelled — an "ended" lesson can be re-entered (people leave by
  // accident, or the tutor presses End too soon), so `status: ended` no longer locks anyone out.
  return { opensAt: w.opensAt.toISOString(), closesAt: w.closesAt.toISOString(), joinable: l.status !== "cancelled" && l.held !== true && windowState(now, w) === "open" };
}

/** Validate notes attached to a lesson: they must be THIS tenant's notes the caller may see. → ids, or null. */
async function checkNoteIds(ctx: HubCtx, ids: string[] | undefined): Promise<string[] | null> {
  const list = [...new Set(ids ?? [])];
  if (!list.length) return [];
  if (list.some((id) => !okId(id))) return null;
  const snaps = await db.getAll(...list.map((id) => notesCol.doc(id)), { fieldMask: ["tenantId", "franchiseId"] });
  if (snaps.some((s) => !s.exists || s.get("tenantId") !== ctx.tenantId || !canSee(ctx, s.get("franchiseId")))) return null;
  return list;
}

function tutorOut(l: Lesson, names: Map<string, string>) {
  return {
    id: l.id, title: l.title, topicId: l.topicId ?? null, startsAt: l.startsAt, durationMins: l.durationMins,
    childIds: l.childIds, students: l.childIds.map((id) => ({ childId: id, childName: names.get(id) ?? "Student" })),
    status: l.status, tutorUid: l.tutorUid, tutorName: l.tutorName, roomName: l.roomName ?? null, notes: l.notes ?? "",
    videos: videosOut(l.videos), noteIds: l.noteIds ?? [], groupIds: l.groupIds ?? [],
    attendance: l.attendance ?? {}, tutorJoinedAt: l.tutorJoinedAt ?? null, endedAt: l.endedAt ?? null,
    franchiseId: l.franchiseId ?? null, createdAt: l.createdAt,
    seriesId: l.seriesId ?? null, seriesIndex: l.seriesIndex ?? null, seriesCount: l.seriesCount ?? null, held: l.held === true, ...windowOut(l),
  };
}

/** Ended (or reopened) and no tutor has come back in yet: families wait (join + "Stay" are refused, see below). */
const waitingForTutor = (l: Pick<LessonDoc, "status" | "needsTutor">) => l.status === "ended" || l.needsTutor === true;

/** What a family sees: their OWN children only, no other family's attendance, no room details. */
function familyOut(l: Lesson, ctx: HubCtx) {
  const mine = scopedChildren(ctx).filter((c) => l.childIds.includes(c.childId));
  return {
    id: l.id, title: l.title, topicId: l.topicId ?? null, startsAt: l.startsAt, durationMins: l.durationMins,
    childIds: mine.map((c) => c.childId), students: mine.map((c) => ({ childId: c.childId, childName: c.childName })),
    status: l.status, tutorName: l.tutorName, notes: l.notes ?? "", videos: videosOut(l.videos), noteIds: l.noteIds ?? [], attended: mine.some((c) => !!l.attendance?.[c.childId]), waitingForTutor: waitingForTutor(l), ...windowOut(l),
  };
}

const allLessons = async (tenantId: string): Promise<Lesson[]> =>
  (await lessonsCol.where("tenantId", "==", tenantId).get()).docs.map((d) => ({ id: d.id, ...(d.data() as LessonDoc) })).filter((l) => l.mode !== "in_person");

// GET /lessons — T: the lessons in scope (last 90 days onwards); P: their children's upcoming + recent.
hubLessonsApi.get("/lessons", async (req, res) => {
  const ctx = await resolveCtx(req, res);
  if (!ctx) return;
  const now = Date.now();
  if (isParent(ctx)) {
    const ids = new Set(scopedChildren(ctx).map((c) => c.childId));
    const from = new Date(now - FAMILY_DAYS * 86_400_000).toISOString();
    const list = (await allLessons(ctx.tenantId)).filter((l) => l.startsAt >= from && l.childIds.some((c) => ids.has(c)))
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt)).map((l) => familyOut(l, ctx));
    res.json(list);
    return;
  }
  const [lessons, students] = await Promise.all([allLessons(ctx.tenantId), tenantEnrolments(ctx)]);
  const names = new Map([...students].map(([id, e]) => [id, e.childName]));
  const from = new Date(now - HISTORY_DAYS * 86_400_000).toISOString();
  const mine = req.query.mine === "1" || req.query.mine === "true"; // "My lessons": only the ones I scheduled / teach
  res.json(lessons.filter((l) => canSeeStudent(ctx, l.franchiseId) && l.startsAt >= from && (!mine || l.tutorUid === ctx.uid)).sort((a, b) => a.startsAt.localeCompare(b.startsAt)).map((l) => tutorOut(l, names)));
});

// POST /lessons
hubLessonsApi.post("/lessons", async (req, res) => {
  const ctx = await resolveCtx(req, res);
  if (!ctx || !requireEdit(ctx, res)) return;
  const parsed = lessonBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues }); return; }
  const b = parsed.data;
  const startsAt = startIso(b.startsAt);
  if (!startsAt) { res.status(400).json({ error: "Give the lesson a start date and time" }); return; }
  const endMs = new Date(startsAt).getTime() + b.durationMins * 60_000;
  if (b.held) {
    // "Log a lesson already held": must be over, and recent enough to still show in the tutor's history.
    if (b.repeatWeeks) { res.status(400).json({ error: "A lesson that has already happened can't repeat weekly" }); return; }
    if (endMs > Date.now()) { res.status(400).json({ error: "That lesson hasn't finished yet — schedule it instead, or pick the time it actually ran" }); return; }
    if (new Date(startsAt).getTime() < Date.now() - (HISTORY_DAYS - 1) * 86_400_000) { res.status(400).json({ error: `Lessons can be logged up to ${HISTORY_DAYS - 1} days back` }); return; }
  } else if (endMs < Date.now()) { res.status(400).json({ error: "That lesson has already finished — pick a time that hasn't passed" }); return; }
  const tz = b.timeZone && validZone(b.timeZone) ? b.timeZone : "Europe/London";
  const count = b.repeatWeeks ?? 1;
  const starts = Array.from({ length: count }, (_, i) => (i === 0 ? startsAt : addWeeksWall(startsAt, i, tz)));
  if (new Date(starts[starts.length - 1]!).getTime() > Date.now() + 400 * 86_400_000) { res.status(400).json({ error: "Lessons can be scheduled up to a year ahead" }); return; }
  if (b.topicId && !(await visibleTopic(ctx, b.topicId))) { res.status(404).json({ error: "Topic not found" }); return; }
  const direct = await eligibleStudents(ctx, b.childIds);
  if (!direct) { res.status(404).json({ error: "Student not found — lessons are for your enrolled students" }); return; }
  const groups = await visibleGroups(ctx, b.groupIds ?? []);
  if (!groups) { res.status(404).json({ error: "Group not found" }); return; }
  const students = [...new Map([...direct, ...(await activeMembers(ctx, groups))].map((e) => [e.childId, e])).values()];
  if (!students.length) { res.status(400).json({ error: "Choose at least one student, or a group that has students in it" }); return; }
  if (students.length > 30) { res.status(400).json({ error: "A lesson holds up to 30 students" }); return; }
  const childIds = students.map((s) => s.childId);
  const attended = [...new Set(b.attendedChildIds ?? [])];
  if (attended.some((c) => !childIds.includes(c))) { res.status(400).json({ error: "Attendance can only name the students in the lesson" }); return; }
  const vids = cleanVideos(b.videos);
  if (typeof vids === "string") { res.status(400).json({ error: vids }); return; }
  const noteIds = await checkNoteIds(ctx, b.noteIds);
  if (!noteIds) { res.status(404).json({ error: "Lesson not found" }); return; }
  const now = nowIso();
  const seriesId = count > 1 ? lessonsCol.doc().id : undefined;
  const refs = starts.map(() => lessonsCol.doc());
  const docs = starts.map((st, i): LessonDoc => ({
    tenantId: ctx.tenantId, franchiseId: ctx.franchiseId, tutorUid: ctx.uid, tutorName: b.tutorName || ctx.name || "Your tutor",
    title: b.title, topicId: b.topicId ?? null, startsAt: st, durationMins: b.durationMins, childIds,
    status: b.held ? "ended" : "scheduled", roomName: b.held ? null : roomNameFor(refs[i]!.id), roomUrl: null, notes: b.notes, videos: vids, noteIds, groupIds: groups.map((g) => g.id),
    attendance: b.held ? Object.fromEntries(attended.map((c) => [c, st])) : {}, tutorJoinedAt: b.held ? st : null, endedAt: b.held ? new Date(endMs).toISOString() : null,
    ...(b.held ? { held: true, needsTutor: false } : {}),
    ...(seriesId ? { seriesId, seriesIndex: i, seriesCount: count } : {}),
    createdBy: ctx.uid, createdAt: now, updatedAt: now,
  }));
  const batch = db.batch();
  docs.forEach((d, i) => batch.set(refs[i]!, d));
  await batch.commit();
  const first = docs[0]!;
  if (!b.held) {
    void notifyFamilies({
      tenantId: ctx.tenantId, childIds, ref: refs[0]!.id, tab: "live",
      compose: (names) => ({ title: count > 1 ? "Weekly live lessons scheduled" : "Live lesson scheduled", body: count > 1
        ? `${nameList(names)}: "${first.title}" with ${first.tutorName}, every week from ${when(startsAt)} (${count} lessons). You can join from My Classroom.`
        : `${nameList(names)}: "${first.title}" with ${first.tutorName}, ${when(startsAt)}. You can join from My Classroom.` }),
    });
  }
  const names = new Map(students.map((s) => [s.childId, s.childName]));
  res.status(201).json({ ...tutorOut({ id: refs[0]!.id, ...first }, names), ...(seriesId ? { seriesIds: refs.map((r) => r.id) } : {}) });
});

/** A visible-and-writable lesson, or a refusal already sent. */
async function editableLesson(ctx: HubCtx, id: string, res: import("express").Response): Promise<Lesson | null> {
  if (!okId(id)) { res.status(404).json({ error: "Lesson not found" }); return null; }
  const snap = await lessonsCol.doc(id).get();
  if (!snap.exists || snap.get("tenantId") !== ctx.tenantId || snap.get("mode") === "in_person" || !canSeeStudent(ctx, snap.get("franchiseId"))) { res.status(404).json({ error: "Lesson not found" }); return null; }
  if (!canWriteRow(ctx, snap.get("franchiseId"))) { res.status(403).json({ error: "That lesson belongs to head office" }); return null; }
  return { id: snap.id, ...(snap.data() as LessonDoc) };
}

const namesFor = async (ctx: HubCtx) => new Map([...(await tenantEnrolments(ctx))].map(([id, e]) => [id, e.childName]));

// PUT /lessons/:id — any subset; {status:"cancelled"} cancels. Families are told of a move / cancellation.
hubLessonsApi.put("/lessons/:id", async (req, res) => {
  const ctx = await resolveCtx(req, res);
  if (!ctx || !requireEdit(ctx, res)) return;
  const parsed = lessonBody.omit({ repeatWeeks: true, timeZone: true, held: true, attendedChildIds: true }).partial()
    .extend({ status: z.literal("cancelled").optional(), applyTo: z.enum(["this", "following"]).optional() }).safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues }); return; }
  const cur = await editableLesson(ctx, req.params.id, res);
  if (!cur) return;
  const b = parsed.data;
  const onlyNotes = Object.keys(b).every((k) => k === "notes" || k === "videos" || k === "noteIds" || k === "applyTo"); // what a tutor may still add to an ended lesson
  if (!OPEN.has(cur.status) && !onlyNotes) { res.status(409).json({ error: `This lesson is ${cur.status} — it can't be changed`, code: "lesson_closed" }); return; }

  const patch: Partial<LessonDoc> = { updatedAt: nowIso() };
  if (b.title !== undefined) patch.title = b.title;
  if (b.notes !== undefined) patch.notes = b.notes;
  if (b.videos !== undefined) {
    const vids = cleanVideos(b.videos);
    if (typeof vids === "string") { res.status(400).json({ error: vids }); return; }
    patch.videos = vids;
  }
  if (b.noteIds !== undefined) {
    const ids = await checkNoteIds(ctx, b.noteIds);
    if (!ids) { res.status(404).json({ error: "Lesson not found" }); return; }
    patch.noteIds = ids;
  }
  if (b.tutorName !== undefined) patch.tutorName = b.tutorName;
  if (b.durationMins !== undefined) patch.durationMins = b.durationMins;
  if (b.startsAt !== undefined) {
    const s = startIso(b.startsAt);
    if (!s) { res.status(400).json({ error: "Give the lesson a start date and time" }); return; }
    patch.startsAt = s;
  }
  if (b.topicId !== undefined) {
    if (b.topicId && !(await visibleTopic(ctx, b.topicId))) { res.status(404).json({ error: "Topic not found" }); return; }
    patch.topicId = b.topicId ?? null;
  }
  let added: string[] = [];
  // Students named directly plus the members of any groups named now (the union); naming only groups ADDS their members.
  let wanted: string[] | undefined = b.childIds;
  if (b.groupIds !== undefined) {
    const groups = await visibleGroups(ctx, b.groupIds);
    if (!groups) { res.status(404).json({ error: "Group not found" }); return; }
    patch.groupIds = groups.map((g) => g.id);
    wanted = [...new Set([...(b.childIds ?? cur.childIds), ...(await activeMembers(ctx, groups)).map((e) => e.childId)])];
  }
  if (wanted) {
    const fresh = wanted.filter((c) => !cur.childIds.includes(c));
    const students = await eligibleStudents(ctx, fresh);
    if (!students) { res.status(404).json({ error: "Student not found — lessons are for your enrolled students" }); return; }
    added = students.map((s) => s.childId);
    patch.childIds = [...new Set(wanted)].filter((c) => cur.childIds.includes(c) || added.includes(c));
    if (!patch.childIds.length) { res.status(400).json({ error: "A lesson needs at least one student" }); return; }
    if (patch.childIds.length > 30) { res.status(400).json({ error: "A lesson holds up to 30 students" }); return; }
  }
  const startsAt = patch.startsAt ?? cur.startsAt;
  const durationMins = patch.durationMins ?? cur.durationMins;
  const moved = startsAt !== cur.startsAt || durationMins !== cur.durationMins;
  if (moved && new Date(startsAt).getTime() + durationMins * 60_000 < Date.now()) { res.status(400).json({ error: "That lesson would already have finished — pick a time that hasn't passed" }); return; }
  if (b.status === "cancelled") patch.status = "cancelled";
  // A lesson that is RUNNING may be lengthened or nudged earlier, never pushed into the future (that would shut its own join window
  // on the people in it), and its room is never handed an expiry that has already passed (Daily would eject everyone, and the client would
  // announce "time's up"). The room expiry always honours a reopen / "Stay" (reopenedAt, roomUntil).
  let roomExp: Date | null = null;
  if (moved && b.status !== "cancelled") {
    if (cur.status === "live" && new Date(startsAt).getTime() > Date.now()) { res.status(409).json({ error: "This lesson is running now — you can make it longer, but it can't be moved to later.", code: "lesson_running" }); return; }
    roomExp = roomExpiry(joinWindow(startsAt, durationMins).endsAt, cur.roomUntil, cur.reopenedAt);
    const floor = Date.now() + STAY_EXTENSION_MS;
    if (cur.status === "live" && roomExp.getTime() < floor) { roomExp = new Date(floor); patch.roomUntil = roomExp.toISOString(); }
  }

  await lessonsCol.doc(cur.id).update(patch);
  const next: Lesson = { ...cur, ...patch } as Lesson;

  if (patch.status === "cancelled") {
    void deleteRoom(cur.roomUrl ? cur.roomName : null);
    // Weekly repeat: "this and every later one" ends the series here; each is cancelled on its own, families get ONE message.
    let later: Lesson[] = [];
    if (b.applyTo === "following" && cur.seriesId) {
      later = (await lessonsCol.where("tenantId", "==", ctx.tenantId).where("seriesId", "==", cur.seriesId).get()).docs
        .map((d) => ({ id: d.id, ...(d.data() as LessonDoc) }))
        .filter((l) => l.id !== cur.id && l.startsAt > cur.startsAt && OPEN.has(l.status) && canWriteRow(ctx, l.franchiseId));
      for (const l of later) { await lessonsCol.doc(l.id).update({ status: "cancelled", updatedAt: nowIso() }); void deleteRoom(l.roomUrl ? l.roomName : null); }
    }
    void notifyFamilies({ tenantId: ctx.tenantId, childIds: cur.childIds, ref: cur.id, tab: "live", compose: (n) => ({ title: "Live lesson cancelled", body: later.length
      ? `${nameList(n)}: "${next.title}" on ${when(cur.startsAt)} and the ${later.length} weekly lesson${later.length === 1 ? "" : "s"} after it have been cancelled.`
      : `${nameList(n)}: "${next.title}" on ${when(cur.startsAt)} has been cancelled.` }) });
  } else {
    // The room follows the lesson: its expiry (if the time moved) and its capacity (if students were added / removed).
    if (cur.roomUrl && cur.roomName && (roomExp || patch.childIds)) void setRoomExpiry(cur.roomName, roomExp, patch.childIds?.length);
    if (moved) {
      const existing = next.childIds.filter((c) => !added.includes(c));
      void notifyFamilies({ tenantId: ctx.tenantId, childIds: existing, ref: cur.id, tab: "live", compose: (n) => ({ title: "Live lesson time changed", body: `${nameList(n)}: "${next.title}" is now ${when(startsAt)}.` }) });
    }
    if (added.length) void notifyFamilies({ tenantId: ctx.tenantId, childIds: added, ref: cur.id, tab: "live", compose: (n) => ({ title: "Live lesson scheduled", body: `${nameList(n)}: "${next.title}" with ${next.tutorName}, ${when(startsAt)}.` }) });
  }
  res.json(tutorOut(next, await namesFor(ctx)));
});

// DELETE /lessons/:id — removes the lesson (families are told if it was still to come).
hubLessonsApi.delete("/lessons/:id", async (req, res) => {
  const ctx = await resolveCtx(req, res);
  if (!ctx || !requireEdit(ctx, res)) return;
  const cur = await editableLesson(ctx, req.params.id, res);
  if (!cur) return;
  await lessonsCol.doc(cur.id).delete();
  await deleteBoardForLesson(cur.id); // the lesson's whiteboard goes with it
  void deleteRoom(cur.roomUrl ? cur.roomName : null);
  if (OPEN.has(cur.status) && cur.startsAt >= nowIso().slice(0, 10)) {
    void notifyFamilies({ tenantId: ctx.tenantId, childIds: cur.childIds, ref: cur.id, tab: "live", compose: (n) => ({ title: "Live lesson cancelled", body: `${nameList(n)}: "${cur.title}" on ${when(cur.startsAt)} has been cancelled.` }) });
  }
  res.json({ ok: true });
});

// POST /lessons/:id/end — the tutor closes the lesson; the room is torn down (anyone still in is ejected).
hubLessonsApi.post("/lessons/:id/end", async (req, res) => {
  const ctx = await resolveCtx(req, res);
  if (!ctx || !requireEdit(ctx, res)) return;
  const cur = await editableLesson(ctx, req.params.id, res);
  if (!cur) return;
  if (cur.status === "cancelled") { res.status(409).json({ error: "This lesson was cancelled", code: "lesson_closed" }); return; }
  if (cur.status !== "ended") {
    await lessonsCol.doc(cur.id).update({ status: "ended", endedAt: nowIso(), updatedAt: nowIso(), needsTutor: true });
    void deleteRoom(cur.roomUrl ? cur.roomName : null);
  }
  const fresh = await lessonsCol.doc(cur.id).get();
  res.json(tutorOut({ id: cur.id, ...(fresh.data() as LessonDoc) }, await namesFor(ctx)));
});

// POST /lessons/:id/reopen — the tutor starts a FRESH SESSION of a lesson that has ended, at any time: undo an End
// that came too soon, or run an old lesson again (revision / catch-up). It opens a new 60-minute window from now for
// the tutor AND the enrolled families (who see "Rejoin"); anyone can then "stay" on the call to keep it going. Only a
// cancelled lesson can't be reopened. The Daily room is recreated on the next join (ensureRoom is idempotent by name).
hubLessonsApi.post("/lessons/:id/reopen", async (req, res) => {
  const ctx = await resolveCtx(req, res);
  if (!ctx || !requireEdit(ctx, res)) return;
  const cur = await editableLesson(ctx, req.params.id, res);
  if (!cur) return;
  if (cur.status === "cancelled") { res.status(409).json({ error: "This lesson was cancelled — schedule a new one.", code: "lesson_closed" }); return; }
  if (cur.held) { res.status(409).json({ error: "This lesson was logged after it happened — schedule a new one instead.", code: "lesson_closed" }); return; }
  const w = joinWindow(cur.startsAt, cur.durationMins, cur.roomUntil);
  const stillOpen = windowState(new Date(), w) === "open";
  if (cur.status !== "ended" && stillOpen) { res.json(tutorOut(cur, await namesFor(ctx))); return; } // already open: nothing to do
  const now = new Date();
  const patch: Record<string, unknown> = { status: "scheduled", endedAt: null, updatedAt: now.toISOString(), needsTutor: true }; // families wait until a tutor is back in the room
  if (!stillOpen) { // outside its own window (an old lesson): open a fresh 60-minute session from now
    patch.reopenedAt = now.toISOString();
    patch.roomUntil = new Date(now.getTime() + 60 * 60_000).toISOString();
  }
  await lessonsCol.doc(cur.id).update(patch);
  void notifyFamilies({ tenantId: ctx.tenantId, childIds: cur.childIds, ref: cur.id, tab: "live", compose: (n) => ({ title: "Live lesson reopened", body: `${nameList(n)}: "${cur.title}" has been reopened by ${cur.tutorName}. You can rejoin from My Classroom once your tutor is in.` }) });
  const fresh = await lessonsCol.doc(cur.id).get();
  res.json(tutorOut({ id: cur.id, ...(fresh.data() as LessonDoc) }, await namesFor(ctx)));
});

// POST /lessons/:id/join {childId?} → {url, token, roomName, userName, isOwner}
// Every call here costs up to three Daily API requests (room create/read + a token mint); a client in a retry loop, or a
// hostile one, must not be able to spend that without limit. 30/min per address is far above what a real rejoin needs.
hubLessonsApi.post("/lessons/:id/join", rateLimit("hub-join", 30), async (req, res) => {
  const ctx = await resolveCtx(req, res);
  if (!ctx) return;
  const id = req.params.id;
  if (!okId(id)) { res.status(404).json({ error: "Lesson not found" }); return; }
  const snap = await lessonsCol.doc(id).get();
  // A lesson of another tenant is a 404 for everyone — never a hint that it exists.
  if (!snap.exists || snap.get("tenantId") !== ctx.tenantId || snap.get("mode") === "in_person") { res.status(404).json({ error: "Lesson not found" }); return; }
  const lesson: Lesson = { id: snap.id, ...(snap.data() as LessonDoc) };

  // ── who is joining, and are they allowed on THIS lesson? ──
  let isOwner = false;
  let userName = "";
  let attendChild: string | null = null;
  let attendChildren: string[] = [];
  if (isParent(ctx)) {
    const wanted = ctx.childId ?? (typeof (req.body as { childId?: unknown })?.childId === "string" ? (req.body as { childId: string }).childId : null);
    const inLesson = ctx.children.filter((c) => lesson.childIds.includes(c.childId));
    // Siblings sharing one device: `childIds: [a, b]` joins them as ONE participant ("Ava and Ben") and marks every named child present.
    const bodyIds = Array.isArray((req.body as { childIds?: unknown })?.childIds) ? ((req.body as { childIds: unknown[] }).childIds).filter((x): x is string => typeof x === "string").slice(0, 20) : [];
    const together = bodyIds.length > 1 ? inLesson.filter((c) => bodyIds.includes(c.childId)) : [];
    if (together.length > 1) { attendChildren = together.map((c) => c.childId); attendChild = together[0].childId; userName = together.map((c) => c.childName.trim().split(/\s+/)[0] || "Student").join(" and "); }
    // Two of this parent's children are in the lesson and the client didn't say which is joining: never guess — attendance and the
    // whiteboard identity would go to the wrong child.
    if (together.length <= 1 && !wanted && inLesson.length > 1) { res.status(400).json({ error: "Choose which child is joining this lesson.", code: "child_required", children: inLesson.map((c) => ({ childId: c.childId, childName: c.childName })) }); return; }
    const kid = together.length > 1 ? together[0] : wanted ? inLesson.find((c) => c.childId === wanted) : inLesson[0];
    // A second guardian (not the enrolled parent) lands here: say so plainly instead of a bare "not found".
    if (!kid) { res.status(404).json({ error: "This lesson isn't linked to your account.", code: "not_your_lesson" }); return; }
    if (together.length <= 1) { attendChild = kid.childId; attendChildren = [kid.childId]; userName = kid.childName.trim().split(/\s+/)[0] || "Student"; }
  } else {
    if (!canSeeStudent(ctx, lesson.franchiseId)) { res.status(404).json({ error: "Lesson not found" }); return; }
    if (!canWriteRow(ctx, lesson.franchiseId)) { res.status(403).json({ error: "That lesson belongs to head office" }); return; }
    isOwner = true;
    userName = ctx.name || lesson.tutorName || "Tutor";
  }

  // ── lesson state + join window ──
  // Only a CANCELLED lesson is closed to everyone. An "ended" one (End pressed too soon, or everyone left) can be
  // re-entered by the tutor and the families until the join window closes.
  if (lesson.status === "cancelled") { res.status(409).json({ error: "This lesson has been cancelled.", code: "lesson_closed" }); return; }
  if (lesson.held) { res.status(409).json({ error: "This lesson was logged after it happened — there is no room to join.", code: "lesson_closed" }); return; }
  const w = joinWindow(lesson.startsAt, lesson.durationMins, lesson.roomUntil);
  const state = windowState(new Date(), w);
  if (state !== "open") {
    res.status(409).json({
      error: state === "early" ? `You can join from ${when(w.opensAt.toISOString())} (10 minutes before it starts).` : "The joining window for this lesson has closed.",
      code: "outside_join_window", state, opensAt: w.opensAt.toISOString(), closesAt: w.closesAt.toISOString(),
    });
    return;
  }

  // Safeguarding: after the tutor ENDS (or reopens) a lesson, a family can't recreate the room with no tutor in it. Only a tutor's own
  // join (below) clears the flag and flips the lesson live again.
  if (!isOwner && waitingForTutor(lesson)) { res.status(409).json({ error: "Your tutor ended the lesson — you can rejoin once they reopen it.", code: "waiting_for_tutor" }); return; }

  // ── video ──
  if (!videoConfigured()) { res.status(503).json({ error: "Video lessons aren't available right now.", code: "video_unavailable" }); return; }
  try {
    // The room closes at the scheduled end + a short prompt window, or later if "Stay on the call" pushed it.
    // Coming back AFTER the cut-off counts as staying: the room gets a fresh 15 minutes rather than shutting on you.
    let roomUntil = lesson.roomUntil ?? null;
    const nowMs = Date.now();
    if (nowMs > w.endsAt.getTime() && roomExpiry(w.endsAt, roomUntil, lesson.reopenedAt).getTime() < nowMs + STAY_EXTENSION_MS) {
      roomUntil = new Date(Math.min(nowMs + STAY_EXTENSION_MS, Math.max(w.endsAt.getTime(), lesson.reopenedAt ? new Date(lesson.reopenedAt).getTime() : 0) + MAX_OVERRUN_MS)).toISOString();
    }
    const expires = roomExpiry(w.endsAt, roomUntil, lesson.reopenedAt);
    const win = joinWindow(lesson.startsAt, lesson.durationMins, roomUntil);
    const room = await ensureRoom(lesson.id, expires, lesson.childIds.length);
    void setRoomExpiry(room.name, expires); // an already-existing room keeps the same (possibly extended) expiry
    const token = await mintToken({ roomName: room.name, userName, isOwner, endsAt: w.endsAt, closesAt: win.closesAt, userId: attendChild ? `c:${attendChild}` : undefined });
    const patch: Record<string, unknown> = {};
    if (lesson.roomUrl !== room.url || lesson.roomName !== room.name) { patch.roomUrl = room.url; patch.roomName = room.name; }
    if (roomUntil !== (lesson.roomUntil ?? null)) patch.roomUntil = roomUntil;
    if (isOwner) { patch.tutorJoinedAt = lesson.tutorJoinedAt ?? nowIso(); if (lesson.needsTutor) patch.needsTutor = false; }
    // Anyone re-entering an ended lesson re-opens it; a tutor starting a scheduled one makes it live.
    if (lesson.status === "ended" || (isOwner && lesson.status === "scheduled")) { patch.status = "live"; if (lesson.status === "ended") patch.endedAt = null; }
    // (Attendance is NOT written here: a token is minted before anyone has connected. The family's client confirms it with POST /attended once Daily reports it joined.)
    if (Object.keys(patch).length) await snap.ref.update(patch);
    res.json({ url: room.url, token, roomName: room.name, userName, isOwner, childIds: attendChildren, roomExpiresAt: expires.toISOString(), promptSeconds: Math.round(STAY_PROMPT_MS / 1000), endsAt: w.endsAt.toISOString() });
  } catch (e) {
    if (e instanceof VideoError) { res.status(e.status).json({ error: e.message, code: e.code }); return; }
    throw e;
  }
});

// POST /lessons/:id/attended {childId?} — a FAMILY's client calls this when Daily reports it really joined the call (joined-meeting),
// so a failed connection or an abandoned lobby never counts as attending. Records the first time per child; idempotent.
hubLessonsApi.post("/lessons/:id/attended", async (req, res) => {
  const ctx = await resolveCtx(req, res);
  if (!ctx) return;
  if (!isParent(ctx)) { res.json({ ok: true }); return; } // tutors have nothing to record
  const id = req.params.id;
  if (!okId(id)) { res.status(404).json({ error: "Lesson not found" }); return; }
  const snap = await lessonsCol.doc(id).get();
  if (!snap.exists || snap.get("tenantId") !== ctx.tenantId || snap.get("mode") === "in_person") { res.status(404).json({ error: "Lesson not found" }); return; }
  const lesson: Lesson = { id: snap.id, ...(snap.data() as LessonDoc) };
  // Siblings on one device: the parent may say `childIds: [a, b]` (and/or the usual `childId` / ?childId=) — EVERY one of their own children
  // named who is in this lesson is recorded present. Ids that aren't the parent's own children, or aren't in the lesson, are ignored;
  // with none named, a parent with exactly one child in the lesson gets that child (as before).
  const body = (req.body ?? {}) as { childId?: unknown; childIds?: unknown };
  const named = new Set<string>();
  if (ctx.childId) named.add(ctx.childId);
  if (typeof body.childId === "string") named.add(body.childId);
  if (Array.isArray(body.childIds)) for (const x of body.childIds.slice(0, 20)) if (typeof x === "string") named.add(x);
  const inLesson = ctx.children.filter((c) => lesson.childIds.includes(c.childId));
  const kids = named.size ? inLesson.filter((c) => named.has(c.childId)) : inLesson.length === 1 ? inLesson : [];
  if (!kids.length) { res.status(404).json({ error: "Lesson not found" }); return; }
  if (lesson.status === "cancelled" || windowState(new Date(), joinWindow(lesson.startsAt, lesson.durationMins, lesson.roomUntil)) !== "open") { res.status(409).json({ error: "This lesson isn't open.", code: "outside_join_window" }); return; }
  const at = nowIso();
  const patch: Record<string, string> = {};
  for (const k of kids) if (!lesson.attendance?.[k.childId]) patch[`attendance.${k.childId}`] = at;
  if (Object.keys(patch).length) await snap.ref.update(patch);
  res.json({ ok: true, childIds: kids.map((k) => k.childId) });
});

// POST /lessons/:id/extend {childId?} — "Stay on the call": pushes the room's closing time on by 15 minutes for
// EVERYONE in it. Either the tutor or a family in the lesson may press it (whoever is still there and wants to
// carry on); it stops at 4 hours after the scheduled end. If nobody presses it the room closes and Daily
// disconnects everyone — and both sides can come straight back in until the join window shuts.
hubLessonsApi.post("/lessons/:id/extend", async (req, res) => {
  const ctx = await resolveCtx(req, res);
  if (!ctx) return;
  const id = req.params.id;
  if (!okId(id)) { res.status(404).json({ error: "Lesson not found" }); return; }
  const snap = await lessonsCol.doc(id).get();
  if (!snap.exists || snap.get("tenantId") !== ctx.tenantId || snap.get("mode") === "in_person") { res.status(404).json({ error: "Lesson not found" }); return; }
  const lesson: Lesson = { id: snap.id, ...(snap.data() as LessonDoc) };
  if (isParent(ctx)) {
    if (!scopedChildren(ctx).some((c) => lesson.childIds.includes(c.childId))) { res.status(404).json({ error: "Lesson not found" }); return; } // (?childId= narrows to that child)
    // Safeguarding: only the tutor keeps a room going on its own. A family may press "Stay" only while the lesson is live and a tutor
    // has (re)joined since it was last ended / reopened — never to hold a room open once the tutor has gone.
    if (lesson.status !== "cancelled" && (lesson.status !== "live" || waitingForTutor(lesson))) { res.status(409).json({ error: "Your tutor needs to be in the lesson to keep it going.", code: "waiting_for_tutor" }); return; }
  } else if (!canSeeStudent(ctx, lesson.franchiseId)) { res.status(404).json({ error: "Lesson not found" }); return; }
  if (lesson.status === "cancelled") { res.status(409).json({ error: "This lesson has been cancelled.", code: "lesson_closed" }); return; }
  const w = joinWindow(lesson.startsAt, lesson.durationMins, lesson.roomUntil);
  if (windowState(new Date(), w) === "closed") { res.status(409).json({ error: "The joining window for this lesson has closed.", code: "outside_join_window" }); return; }
  const nowMs = Date.now();
  const cap = Math.max(w.endsAt.getTime(), lesson.reopenedAt ? new Date(lesson.reopenedAt).getTime() : 0) + MAX_OVERRUN_MS;
  const current = roomExpiry(w.endsAt, lesson.roomUntil, lesson.reopenedAt).getTime();
  const next = Math.min(Math.max(current, nowMs) + STAY_EXTENSION_MS, cap);
  if (next <= current) { res.status(409).json({ error: "This lesson has reached the longest it can run today.", code: "extension_limit", roomExpiresAt: new Date(current).toISOString() }); return; }
  const roomUntil = new Date(next).toISOString();
  await snap.ref.update({ roomUntil, updatedAt: nowIso() });
  if (lesson.roomName) void setRoomExpiry(lesson.roomName, new Date(next));
  res.json({ roomExpiresAt: roomUntil, closesAt: joinWindow(lesson.startsAt, lesson.durationMins, roomUntil).closesAt.toISOString(), promptSeconds: Math.round(STAY_PROMPT_MS / 1000) });
});

