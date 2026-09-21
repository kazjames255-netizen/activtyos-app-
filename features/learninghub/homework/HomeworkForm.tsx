"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Button, FieldLabel, Input, Select } from "@/components/ui";
import { get, post, put } from "@/lib/api";
import type { HubSettings } from "@/lib/hubConfig";
import { errMsg, groupMemberIds, topicLabel, type HubGroup, type Note, type Student, type Topic } from "../types";
import { GroupQuickPick, RecipientSummary, pruneGroups } from "../groupKit";
import { VideoEditor, videoPayload, videosToInputs } from "../videoKit";
import { Dialog, FOCUS, Notice, StudentPicker, goToTab, toLocalDateInput, withQs } from "../teachKit";
import type { TutorHomework } from "./hwTypes";
import { NoteChecklist, QuizSelect, publishNote, publishQuiz, type QuizPick } from "./hwPickers";
import { LessonPackPicker, fetchHomeworkPack, type HomeworkPack } from "./hwPack";

// Tutor: create or edit a homework. Assigning creates one submission per student
// (server-side); editing can add students (removing one only drops a hand-in
// they haven't started).

const endOfDay = (dateStr: string) => new Date(`${dateStr}T23:59:00`).toISOString();

export function HomeworkForm({ homework, students, topics, qs, config, groups = [], initialGroupId = null, initialChildIds, initialGroupIds, initialAssessmentId, initialNoteIds, initialTitle, initialInstructions, packNoteId, focusQuiz = false, onClose, onSaved }: {
  homework: TutorHomework | null;
  students: Student[];
  topics: Topic[];
  qs: string;
  config: HubSettings;
  groups?: HubGroup[];
  /** Quick action: open with this group's members already ticked. */
  initialGroupId?: string | null;
  /** In-call workspace: open with exactly these students (and groups) ticked, and optionally a quiz preselected. */
  initialChildIds?: string[];
  initialGroupIds?: string[];
  initialAssessmentId?: string;
  /** Notes attached up front (a lesson's worksheet PDF) and a starting title. */
  initialNoteIds?: string[];
  initialTitle?: string;
  initialInstructions?: string;
  /** Open PREFILLED from this lesson's ready-made homework (server-built, GET /notes/:id/homework-pack); the initial* props stay as the fallback. */
  packNoteId?: string;
  /** Quick action "Set a quiz": start with the quiz picker focused. */
  focusQuiz?: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const roster = useMemo(() => students.filter((s) => s.active !== false), [students]);
  const defaultDue = () => toLocalDateInput(new Date(Date.now() + (config.homeworkDueDays || 7) * 86_400_000));
  const [title, setTitle] = useState(homework?.title ?? initialTitle ?? "");
  const [instructions, setInstructions] = useState(homework?.instructions ?? initialInstructions ?? "");
  const [due, setDue] = useState(() => (homework ? toLocalDateInput(new Date(homework.dueAt)) : defaultDue()));
  const [assessmentId, setAssessmentId] = useState(homework?.assessmentId ?? initialAssessmentId ?? "");
  const [noteIds, setNoteIds] = useState<string[]>(homework?.noteIds ?? initialNoteIds ?? []);
  const [flashTopic, setFlashTopic] = useState(homework?.flashcardTopicId ?? "");
  const preGroup = useMemo(() => (initialGroupId ? groups.find((g) => g.id === initialGroupId) ?? null : null), [initialGroupId, groups]);
  const [childIds, setChildIds] = useState<string[]>(() => homework?.assignedChildIds ?? initialChildIds ?? (preGroup ? groupMemberIds(preGroup) : roster.length === 1 ? [roster[0]!.childId] : []));
  const [groupIds, setGroupIds] = useState<string[]>(() => homework?.groupIds ?? initialGroupIds ?? (preGroup ? [preGroup.id] : []));
  const [videos, setVideos] = useState(() => videosToInputs(homework?.videos));
  // The chosen quiz (any state — a lesson's exit quiz may still be a draft), the lessons attached (id → row, so drafts are spotted),
  // and which enrolled students that quiz can't reach. The pickers themselves search server-side (hwPickers.tsx).
  const [quiz, setQuiz] = useState<QuizPick | null>(null);
  const [noteRows, setNoteRows] = useState<Map<string, Note>>(() => new Map());
  const [unreachable, setUnreachable] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  // Ready-made homework: the pack fills every field (all still editable). `edited` = the tutor has typed in the title/instructions, so a
  // late-arriving pack (opened from a lesson) never overwrites their words.
  const [pack, setPack] = useState<HomeworkPack | null>(null);
  const [packBusy, setPackBusy] = useState(false);
  const edited = useRef(false);
  const applyPack = (p: HomeworkPack) => {
    setPack(p); setTitle(p.title); setInstructions(p.instructions);
    setDue(toLocalDateInput(new Date(Date.now() + p.dueInDays * 86_400_000)));
    setAssessmentId(p.assessmentId ?? ""); setNoteIds(p.noteIds); setFlashTopic(p.flashcardTopicId ?? "");
  };
  const usePackOf = (noteId: string, auto: boolean) => {
    setPackBusy(true);
    fetchHomeworkPack(qs, noteId)
      .then((p) => { if (!auto || !edited.current) applyPack(p); else setPack(p); })
      .catch((e) => { if (!auto) setErr(errMsg(e, "Couldn't build homework from that lesson")); })
      .finally(() => setPackBusy(false));
  };
  useEffect(() => { if (packNoteId && !homework) usePackOf(packNoteId, true); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [packNoteId]);
  const [publishing, setPublishing] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!assessmentId) { setQuiz(null); setUnreachable({}); return; }
    let live = true;
    get<QuizPick>(`/api/learning-hub/assessments/${encodeURIComponent(assessmentId)}${withQs(qs, {})}`).then((one) => { if (live) setQuiz(one); }).catch(() => { if (live) setQuiz(null); });
    get<{ unreachable: { childId: string; reason: string }[] }>(`/api/learning-hub/homework/reach${withQs(qs, { assessmentId })}`)
      .then((r) => { if (live) setUnreachable(Object.fromEntries((r.unreachable ?? []).map((u) => [u.childId, u.reason]))); }).catch(() => { if (live) setUnreachable({}); });
    return () => { live = false; };
  }, [qs, assessmentId]);

  // Attached lessons (up front from a lesson's "Set for children", or an edit): fetch their rows by id so a draft is recognised.
  const attachedKey = noteIds.join(",");
  useEffect(() => {
    const need = noteIds.filter((id) => !noteRows.has(id));
    if (!need.length) return;
    let live = true;
    get<Note[] | { items: Note[] }>(`/api/learning-hub/notes${withQs(qs, { ids: need.join(","), limit: "200" })}`)
      .then((r) => { if (live) setNoteRows((m) => new Map([...m, ...(Array.isArray(r) ? r : r.items ?? []).map((n) => [n.id, n] as const)])); }).catch(() => undefined);
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qs, attachedKey]);

  // "Set a quiz" quick action: put the cursor (and the view) on the picker once it has rendered.
  useEffect(() => { if (focusQuiz) setTimeout(() => document.getElementById("hub-hw-quiz")?.focus(), 400); }, [focusQuiz]);

  const topicById = useMemo(() => new Map(topics.map((t) => [t.id, t])), [topics]);
  const sortedTopics = useMemo(() => [...topics].sort((a, b) => topicLabel(a).localeCompare(topicLabel(b))), [topics]);
  const attachedDrafts = noteIds.map((id) => noteRows.get(id)).filter((n): n is Note => !!n && n.published === false);
  const draftQuiz = !!quiz && quiz.published === false;
  // When editing, students who already have this homework are shown but never block a save (the server only checks NEW ones).
  const already = new Set(homework?.assignedChildIds ?? []);
  const blocked = childIds.filter((id) => unreachable[id] && !already.has(id));
  const nameById = new Map(roster.map((r) => [r.childId, r.childName]));
  // One click for the whole year the lesson is for (the year comes from the lesson itself; a student's year is on the roster). Students who can't open the attached quiz are left out.
  const yearMates = pack?.year ? roster.filter((s) => (s.yearGroup ?? "").trim().toLowerCase() === `year ${pack.year}`.toLowerCase() && !unreachable[s.childId]) : [];

  const problem = !title.trim() ? "Give the homework a title." : !due ? "Choose a due date." : childIds.length === 0 ? "Choose at least one student." : draftQuiz ? "Publish the quiz first — students can't open a draft." : blocked.length ? `${blocked.length === 1 ? "One student" : `${blocked.length} students`} can't open this quiz — remove them, or pick another quiz.` : null;

  const doPublish = async (kind: "quiz" | "note", id: string) => {
    setPublishing(id); setErr(null);
    try {
      if (kind === "quiz") { await publishQuiz(qs, id); setQuiz((q) => (q ? { ...q, published: true } : q)); }
      else { await publishNote(qs, id); setNoteRows((m) => { const n = m.get(id); return n ? new Map(m).set(id, { ...n, published: true }) : m; }); }
    } catch (e) { setErr(errMsg(e, kind === "quiz" ? "Couldn't publish the quiz" : "Couldn't publish the lesson")); }
    finally { setPublishing(null); }
  };

  const save = async () => {
    if (problem) { setErr(problem); return; }
    setBusy(true); setErr(null);
    const body = { title: title.trim(), instructions: instructions.trim(), dueAt: endOfDay(due), assessmentId: assessmentId || null, noteIds, flashcardTopicId: flashTopic || null, assignedChildIds: childIds, assignedGroupIds: groupIds, videos: videoPayload(videos) };
    try {
      if (homework) await put(`/api/learning-hub/homework/${homework.id}${qs}`, body);
      else await post(`/api/learning-hub/homework${qs}`, body);
      onSaved();
    } catch (e) { setErr(errMsg(e, "Couldn't save the homework")); setBusy(false); }
  };

  return (
    <Dialog id="hub-homework-form" size="lg" title={homework ? "Edit homework" : "Set homework"}
      subtitle={homework ? "Changes apply to everyone it's assigned to." : "Each student gets their own copy to hand in — they're notified straight away."}
      onClose={onClose}
      footer={<>
        <Button variant="ghost" className={`min-h-[44px] ${FOCUS}`} onClick={onClose}>Cancel</Button>
        <Button variant="solid" className={`min-h-[44px] ${FOCUS}`} onClick={() => void save()} disabled={busy || !!problem}>{busy ? "Saving…" : homework ? "Save changes" : "Assign homework"}</Button>
      </>}>
      <div className="grid gap-4">
        {err && <Notice onClose={() => setErr(null)}>{err}</Notice>}
        {!homework && <LessonPackPicker qs={qs} busy={packBusy} activeTitle={pack ? noteRows.get(pack.noteId)?.title ?? pack.title.replace(/^Homework: /, "") : null} onPick={(n) => { setNoteRows((m) => new Map(m).set(n.id, n)); usePackOf(n.id, false); }} />}
        <div>
          <FieldLabel htmlFor="hub-hw-title">Title</FieldLabel>
          <Input id="hub-hw-title" data-autofocus={focusQuiz ? undefined : true} className="min-h-[44px] w-full" value={title} onChange={(e) => { edited.current = true; setTitle(e.target.value); }} maxLength={200} placeholder="e.g. Factorising practice — set A" />
        </div>
        <div>
          <FieldLabel htmlFor="hub-hw-instructions">Instructions</FieldLabel>
          <textarea id="hub-hw-instructions" rows={5} maxLength={5000} value={instructions} onChange={(e) => { edited.current = true; setInstructions(e.target.value); }} placeholder="What should they do? Which questions? What should they hand in?"
            className="w-full resize-y rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2.5 py-2 text-[13px] leading-relaxed text-[var(--ink)] outline-none focus:border-[var(--brand)]" />
        </div>
        <div>
          <FieldLabel htmlFor="hub-hw-video-link">Videos (optional)</FieldLabel>
          <VideoEditor idPrefix="hub-hw-video" value={videos} onChange={setVideos} hint="Paste a YouTube link — it plays above the instructions." />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <FieldLabel htmlFor="hub-hw-due">Due date</FieldLabel>
            <Input id="hub-hw-due" type="date" className="min-h-[44px] w-full" value={due} onChange={(e) => setDue(e.target.value)} />
            <p className="mt-1 text-[11.5px] text-[var(--ink-3)]">Due end of day. Default is {config.homeworkDueDays} days out.</p>
          </div>
          <div>
            <FieldLabel htmlFor="hub-hw-quiz">Attach a quiz (optional)</FieldLabel>
            <QuizSelect qs={qs} value={assessmentId} selected={quiz} onChange={setAssessmentId} focus={focusQuiz} />
            {draftQuiz && (
              <div role="note" data-testid="hub-hw-draft-quiz" className="mt-2 rounded-xl border border-[var(--line)] border-l-4 border-l-[var(--gold)] bg-[var(--panel)] px-3 py-2 text-[12.5px] text-[var(--ink)]">
                “{quiz!.title}” is still a draft, so no student can open it yet.{" "}
                <button type="button" disabled={publishing === quiz!.id} onClick={() => void doPublish("quiz", quiz!.id)} className={`font-extrabold text-[var(--brand)] underline ${FOCUS}`}>{publishing === quiz!.id ? "Publishing…" : "Publish the quiz"}</button>
              </div>
            )}
          </div>
        </div>

        <div>
          <FieldLabel>Link lessons (optional)</FieldLabel>
          {noteIds.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-1.5" data-testid="hub-hw-attached-lessons" aria-label="Attached lessons">
              {noteIds.map((id) => {
                const n = noteRows.get(id);
                return (
                  <span key={id} className="inline-flex min-h-[32px] max-w-full items-center gap-1 rounded-full border border-[var(--brand-line)] bg-[var(--brand-soft)] py-0.5 pl-3 pr-1 text-[12px] font-extrabold text-[var(--brand-strong)]">
                    <span className="truncate">{n?.title ?? "A lesson"}{(n as { isLesson?: boolean } | undefined)?.isLesson || n?.lesson ? " · interactive" : ""}</span>
                    <button type="button" aria-label={`Remove ${n?.title ?? "lesson"}`} onClick={() => setNoteIds(noteIds.filter((x) => x !== id))} className={`grid h-7 w-7 place-items-center rounded-full hover:bg-[var(--surface)] ${FOCUS}`}>×</button>
                  </span>
                );
              })}
            </div>
          )}
          {attachedDrafts.length > 0 && (
            <div role="note" data-testid="hub-hw-draft-lesson" className="mb-2 rounded-xl border border-[var(--line)] border-l-4 border-l-[var(--gold)] bg-[var(--panel)] px-3 py-2 text-[12.5px] text-[var(--ink)]">
              {attachedDrafts.map((n) => `“${n.title}”`).join(", ")} {attachedDrafts.length === 1 ? "is" : "are"} still a draft, so students won&apos;t see {attachedDrafts.length === 1 ? "it" : "them"} until {attachedDrafts.length === 1 ? "it's" : "they're"} published.{" "}
              <button type="button" disabled={!!publishing} onClick={() => void Promise.all(attachedDrafts.map((n) => doPublish("note", n.id)))} className={`font-extrabold text-[var(--brand)] underline ${FOCUS}`}>{publishing ? "Publishing…" : attachedDrafts.length === 1 ? "Publish it" : "Publish them"}</button>
            </div>
          )}
          <NoteChecklist qs={qs} topics={topics} noteIds={noteIds}
            onSeen={(rows) => setNoteRows((m) => new Map([...m, ...rows.map((n) => [n.id, n] as const)]))}
            onToggle={(n) => { setNoteRows((m) => new Map(m).set(n.id, n)); setNoteIds((cur) => (cur.includes(n.id) ? cur.filter((x) => x !== n.id) : [...cur, n.id].slice(0, 20))); }} />
        </div>

        <div>
          <FieldLabel htmlFor="hub-hw-flash">Flashcards to revise (optional)</FieldLabel>
          <Select id="hub-hw-flash" className="min-h-[44px] w-full" value={flashTopic} onChange={(e) => setFlashTopic(e.target.value)}>
            <option value="">None</option>
            {sortedTopics.map((t) => <option key={t.id} value={t.id}>{topicLabel(t)}</option>)}
          </Select>
        </div>

        <div>
          <FieldLabel>Assign to</FieldLabel>
          {roster.length === 0 && (
            <div className="mb-3" data-testid="hub-hw-no-students">
              <Notice tone="gold">
                You haven&apos;t added any students yet, so there&apos;s no one to set this for. Add a student in the Students tab (or invite a parent), then come back and set it.{" "}
                <button type="button" className={`font-extrabold underline ${FOCUS}`} onClick={() => { onClose(); goToTab("students", /students/i); }}>Go to Students</button>
              </Notice>
            </div>
          )}
          <div className="grid gap-3">
            <GroupQuickPick groups={groups} roster={roster} childIds={childIds} groupIds={groupIds} onChange={(n) => { setChildIds(n.childIds); setGroupIds(n.groupIds); }} idPrefix="hub-hw-group" />
            <StudentPicker students={roster} value={childIds} onChange={(ids) => { setChildIds(ids); setGroupIds((g) => pruneGroups(groups, roster, ids, g)); }} idPrefix="hub-hw-student" flags={unreachable} />
          </div>
          {blocked.length > 0 && (
            <div role="alert" data-testid="hub-hw-unreachable" className="mt-2 rounded-xl border border-[var(--line)] border-l-4 border-l-[var(--gold)] bg-[var(--panel)] px-3 py-2 text-[12.5px] text-[var(--ink)]">
              <b className="font-extrabold">{blocked.length === 1 ? "1 student" : `${blocked.length} students`} won&apos;t be able to open this quiz.</b>
              <ul className="mt-1 list-disc pl-5">{blocked.slice(0, 4).map((id) => <li key={id}>{unreachable[id] ?? nameById.get(id)}</li>)}{blocked.length > 4 && <li>and {blocked.length - 4} more</li>}</ul>
              <button type="button" onClick={() => { const ids = childIds.filter((id) => !unreachable[id]); setChildIds(ids); setGroupIds((g) => pruneGroups(groups, roster, ids, g)); }} className={`mt-1 min-h-[44px] lg:min-h-[36px] font-extrabold text-[var(--brand)] underline ${FOCUS}`}>Remove {blocked.length === 1 ? "them" : "them all"} from this homework</button>
            </div>
          )}
          {yearMates.length > 0 && !yearMates.every((s) => childIds.includes(s.childId)) && (
            <button type="button" data-testid="hub-hw-year-all" onClick={() => { const ids = [...new Set([...childIds, ...yearMates.map((s) => s.childId)])]; setChildIds(ids); }}
              className={`mt-2 min-h-[44px] rounded-full border border-[var(--brand-line)] bg-[var(--brand-soft)] px-4 text-[12.5px] font-extrabold text-[var(--brand-strong)] ${FOCUS}`}>
              Set for all my Year {pack!.year} students ({yearMates.length})
            </button>
          )}
          <RecipientSummary count={childIds.length} />
        </div>
      </div>
    </Dialog>
  );
}
