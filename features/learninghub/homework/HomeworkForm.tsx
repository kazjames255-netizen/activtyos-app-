"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Button, FieldLabel, Input } from "@/components/ui";
import { get, post, put } from "@/lib/api";
import type { HubSettings } from "@/lib/hubConfig";
import { errMsg, groupMemberIds, topicLabel, type HubGroup, type Note, type Student, type Topic } from "../types";
import { GroupQuickPick, RecipientSummary, pruneGroups } from "../groupKit";
import { VideoEditor, videoPayload, videosToInputs } from "../videoKit";
import { Dialog, FOCUS, Notice, StudentPicker, goToTab, toLocalDateInput, withQs } from "../teachKit";
import type { TutorHomework, WorksheetRef } from "./hwTypes";
import { useHw } from "./hwI18n";
import { LessonPreviewDialog, LinkedRows, QuizPreviewDialog, WorksheetPreviewDialog } from "./hwPreview";
import { WorksheetPicker, publishNote, publishQuiz, type QuizPick } from "./hwPickers";
import { fetchHomeworkPack, type HomeworkPack } from "./hwPack";

// Tutor: create or edit a homework. Assigning creates one submission per student
// (server-side); editing can add students (removing one only drops a hand-in
// they haven't started).
//
// Creation is BARE: title, instructions, due date, who it is for, and optionally a worksheet. The `initial*` linking props
// (quiz / lessons from a lesson or group entry point) are accepted for compatibility but no longer link anything on a NEW
// homework; a legacy homework that already links a quiz / lessons / flashcards still shows and round-trips them when edited.

const endOfDay = (dateStr: string) => new Date(`${dateStr}T23:59:00`).toISOString();

export function HomeworkForm({ homework, students, topics, qs, config, groups = [], initialGroupId = null, initialChildIds, initialGroupIds, initialTitle, initialInstructions, packNoteId, focusQuiz = false, onClose, onSaved }: {
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
  /** Kept for callers that still pass them; ignored on a new homework (creation is bare). */
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
  const { h, hp } = useHw();
  const roster = useMemo(() => students.filter((s) => s.active !== false), [students]);
  const defaultDue = () => toLocalDateInput(new Date(Date.now() + (config.homeworkDueDays || 7) * 86_400_000));
  const [title, setTitle] = useState(homework?.title ?? initialTitle ?? "");
  const [instructions, setInstructions] = useState(homework?.instructions ?? initialInstructions ?? "");
  const [due, setDue] = useState(() => (homework ? toLocalDateInput(new Date(homework.dueAt)) : defaultDue()));
  const [assessmentId, setAssessmentId] = useState(homework?.assessmentId ?? "");
  const [preview, setPreview] = useState<{ kind: "note" | "quiz" | "worksheet"; id: string; title?: string; quizId?: string } | null>(null);
  const [worksheetIds, setWorksheetIds] = useState<string[]>(homework?.worksheetNoteIds ?? homework?.worksheets?.map((w) => w.noteId) ?? []);
  const [wsRows, setWsRows] = useState<Map<string, WorksheetRef>>(() => new Map((homework?.worksheets ?? []).map((w) => [w.noteId, w] as const)));
  const [noteIds, setNoteIds] = useState<string[]>(homework?.noteIds ?? []);
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
  const [, setPackBusy] = useState(false);
  const edited = useRef(false);
  const applyPack = (p: HomeworkPack) => {
    // Bare on creation: only the title (and the year, for "set for all my Year N") comes from the lesson. The quiz, lessons and
    // flashcards of the pack are NOT linked; the tutor attaches the lesson's worksheet below if they want one.
    setPack(p); setTitle(p.title);
  };
  const usePackOf = (noteId: string, auto: boolean) => {
    setPackBusy(true);
    fetchHomeworkPack(qs, noteId)
      .then((p) => { if (!auto || !edited.current) applyPack(p); else setPack(p); })
      .catch((e) => { if (!auto) setErr(errMsg(e, h("errPack"))); })
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
  const attachedKey = [...noteIds, ...worksheetIds].join(",");
  useEffect(() => {
    const need = [...new Set([...noteIds, ...worksheetIds])].filter((id) => !noteRows.has(id));
    if (!need.length) return;
    let live = true;
    get<Note[] | { items: Note[] }>(`/api/learning-hub/notes${withQs(qs, { ids: need.join(","), limit: "200" })}`)
      .then((r) => { if (live) setNoteRows((m) => new Map([...m, ...(Array.isArray(r) ? r : r.items ?? []).map((n) => [n.id, n] as const)])); }).catch(() => undefined);
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qs, attachedKey]);

  // "Set a quiz" quick action: put the cursor (and the view) on the picker once it has rendered.
  useEffect(() => { if (focusQuiz) setTimeout(() => document.getElementById("hub-hw-quiz")?.focus(), 400); }, [focusQuiz]);

  const attachedDrafts = noteIds.map((id) => noteRows.get(id)).filter((n): n is Note => !!n && n.published === false);
  // A worksheet whose lesson is still a draft is invisible to families, so the server refuses to attach it: flag it here first.
  const wsDrafts = worksheetIds.map((id) => ({ id, row: noteRows.get(id) })).filter((x) => x.row?.published === false && !(homework?.worksheetNoteIds ?? []).includes(x.id));
  const draftQuiz = !!quiz && quiz.published === false;
  // When editing, students who already have this homework are shown but never block a save (the server only checks NEW ones).
  const already = new Set(homework?.assignedChildIds ?? []);
  const blocked = childIds.filter((id) => unreachable[id] && !already.has(id));
  const nameById = new Map(roster.map((r) => [r.childId, r.childName]));
  // One click for the whole year the lesson is for (the year comes from the lesson itself; a student's year is on the roster). Students who can't open the attached quiz are left out.
  const yearMates = pack?.year ? roster.filter((s) => (s.yearGroup ?? "").trim().toLowerCase() === `year ${pack.year}`.toLowerCase() && !unreachable[s.childId]) : [];

  const problem = !title.trim() ? h("pbTitle") : !due ? h("pbDue") : childIds.length === 0 ? h("pbStudents") : draftQuiz ? h("pbDraftQuiz") : wsDrafts.length ? h("pbDraftWs") : blocked.length ? hp("pbBlocked", blocked.length) : null;

  const doPublish = async (kind: "quiz" | "note", id: string) => {
    setPublishing(id); setErr(null);
    try {
      if (kind === "quiz") { await publishQuiz(qs, id); setQuiz((q) => (q ? { ...q, published: true } : q)); }
      else { await publishNote(qs, id); setNoteRows((m) => { const n = m.get(id); return n ? new Map(m).set(id, { ...n, published: true }) : m; }); }
    } catch (e) { setErr(errMsg(e, kind === "quiz" ? h("errPubQuiz") : h("errPubLesson"))); }
    finally { setPublishing(null); }
  };

  const save = async () => {
    if (problem) { setErr(problem); return; }
    setBusy(true); setErr(null);
    const body = { title: title.trim(), instructions: instructions.trim(), dueAt: endOfDay(due), assessmentId: assessmentId || null, noteIds, flashcardTopicId: flashTopic || null, worksheetNoteIds: worksheetIds, assignedChildIds: childIds, assignedGroupIds: groupIds, videos: videoPayload(videos) };
    try {
      if (homework) await put(`/api/learning-hub/homework/${homework.id}${qs}`, body);
      else await post(`/api/learning-hub/homework${qs}`, body);
      onSaved();
    } catch (e) { setErr(errMsg(e, h("errSave"))); setBusy(false); }
  };

  return (
    <>
    <Dialog id="hub-homework-form" plain size="2xl" title={homework ? h("formEdit") : h("formNew")}
      subtitle={homework ? h("formEditSub") : h("formNewSub")}
      onClose={onClose}
      footer={<>
        {problem && !busy && <span role="status" data-testid="hub-hw-problem" className="me-auto min-w-0 flex-1 text-[12px] leading-snug text-[var(--ink-2)]">{problem}</span>}
        <Button variant="ghost" className={`min-h-[44px] ${FOCUS}`} onClick={onClose}>{h("cancel")}</Button>
        <Button variant="solid" className={`min-h-[44px] ${FOCUS}`} onClick={() => void save()} disabled={busy || !!problem}>{busy ? h("saving") : homework ? h("saveChanges") : h("assign")}</Button>
      </>}>
      <div className="grid gap-4">
        {err && <Notice onClose={() => setErr(null)}>{err}</Notice>}
        <div>
          <FieldLabel htmlFor="hub-hw-title">{h("fTitle")}</FieldLabel>
          <Input id="hub-hw-title" data-autofocus={focusQuiz ? undefined : true} className="min-h-[44px] w-full" value={title} onChange={(e) => { edited.current = true; setTitle(e.target.value); }} maxLength={200} placeholder={h("fTitlePh")} />
        </div>
        <div>
          <FieldLabel>{h("fWorksheet")}</FieldLabel>
          <p className="mb-1.5 text-[11.5px] text-[var(--ink-3)]">{h("fWorksheetHint")}</p>
          <WorksheetPicker qs={qs} topics={topics} yearGroups={config.yearGroups ?? []} chosen={worksheetIds} rows={wsRows}
            onToggle={(w) => { setWsRows((m) => new Map(m).set(w.noteId, w)); setWorksheetIds((cur) => (cur.includes(w.noteId) ? cur.filter((x) => x !== w.noteId) : [...cur, w.noteId].slice(0, 10))); }}
            onPreview={(w) => setPreview({ kind: "worksheet", id: w.noteId, title: w.title, quizId: w.quizId })} />
          {worksheetIds.length >= 10 && <p role="note" className="mt-1 text-[11.5px] font-semibold text-[var(--ink-2)]">{h("wsLimit")}</p>}
        </div>

        <div>
          <FieldLabel htmlFor="hub-hw-instructions">{h("fInstr")}</FieldLabel>
          <textarea id="hub-hw-instructions" rows={5} maxLength={5000} value={instructions} onChange={(e) => { edited.current = true; setInstructions(e.target.value); }} placeholder={h("fInstrPh")}
            className="w-full resize-y rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2.5 py-2 text-[13px] leading-relaxed text-[var(--ink)] outline-none focus:border-[var(--brand)]" />
        </div>
        <div>
          <FieldLabel htmlFor="hub-hw-video-link">{h("fVideos")}</FieldLabel>
          <VideoEditor idPrefix="hub-hw-video" value={videos} onChange={setVideos} hint={h("fVideosHint")} />
        </div>
        <div>
          <FieldLabel htmlFor="hub-hw-due">{h("fDue")}</FieldLabel>
          <Input id="hub-hw-due" type="date" className="min-h-[44px] w-full" value={due} onChange={(e) => setDue(e.target.value)} />
          <p className="mt-1 text-[11.5px] text-[var(--ink-3)]">{hp("fDueHint", config.homeworkDueDays || 7)}</p>
        </div>

        {!!homework && (!!assessmentId || noteIds.length > 0 || !!flashTopic) && (
          <LinkedRows label={h("legacyLinked")} quizId={assessmentId || null} quizTitle={quiz?.title} notes={noteIds.map((id) => ({ id, title: noteRows.get(id)?.title }))} hasFlash={!!flashTopic}
            onPreview={(p) => setPreview(p)}
            onRemoveQuiz={() => setAssessmentId("")} onRemoveNote={(id) => setNoteIds(noteIds.filter((x) => x !== id))} onRemoveFlash={() => setFlashTopic("")} />
        )}
        {draftQuiz && (
          <div role="note" data-testid="hub-hw-draft-quiz" className="rounded-xl border border-[var(--line)] border-s-4 border-s-[var(--gold)] bg-[var(--panel)] px-3 py-2 text-[12.5px] text-[var(--ink)]">
            {h("draftQuizA", { title: quiz!.title })}{" "}
            <button type="button" disabled={publishing === quiz!.id} onClick={() => void doPublish("quiz", quiz!.id)} className={`font-extrabold text-[var(--brand)] underline ${FOCUS}`}>{publishing === quiz!.id ? h("publishing") : h("publishQuiz")}</button>
          </div>
        )}
        {attachedDrafts.length > 0 && (
          <div role="note" data-testid="hub-hw-draft-lesson" className="rounded-xl border border-[var(--line)] border-s-4 border-s-[var(--gold)] bg-[var(--panel)] px-3 py-2 text-[12.5px] text-[var(--ink)]">
            {hp("draftLessons", attachedDrafts.length, { titles: attachedDrafts.map((n) => `“${n.title}”`).join(", ") })}{" "}
            <button type="button" disabled={!!publishing} onClick={() => void Promise.all(attachedDrafts.map((n) => doPublish("note", n.id)))} className={`font-extrabold text-[var(--brand)] underline ${FOCUS}`}>{publishing ? h("publishing") : hp("publishThem", attachedDrafts.length)}</button>
          </div>
        )}

        {wsDrafts.length > 0 && (
          <div role="note" data-testid="hub-hw-draft-worksheet" className="rounded-xl border border-[var(--line)] border-s-4 border-s-[var(--gold)] bg-[var(--panel)] px-3 py-2 text-[12.5px] text-[var(--ink)]">
            {hp("draftWs", wsDrafts.length, { titles: wsDrafts.map((x) => `“${x.row?.title ?? ""}”`).join(", ") })}{" "}
            <button type="button" disabled={!!publishing} onClick={() => void Promise.all(wsDrafts.map((x) => doPublish("note", x.id)))} className={`font-extrabold text-[var(--brand)] underline ${FOCUS}`}>{publishing ? h("publishing") : hp("publishThem", wsDrafts.length)}</button>
          </div>
        )}

        {/* M4 (product review): who it is for comes FIRST (order-first), so the disabled Assign button is never a mystery below the fold. */}
        <div className="order-first">
          <FieldLabel>{h("fAssign")}</FieldLabel>
          {roster.length === 0 && (
            <div className="mb-3" data-testid="hub-hw-no-students">
              <Notice tone="gold">
                {h("noStudents")}{" "}
                <button type="button" className={`font-extrabold underline ${FOCUS}`} onClick={() => { onClose(); goToTab("students", /students/i); }}>{h("goStudents")}</button>
              </Notice>
            </div>
          )}
          <div className="grid gap-3">
            <GroupQuickPick groups={groups} roster={roster} childIds={childIds} groupIds={groupIds} onChange={(n) => { setChildIds(n.childIds); setGroupIds(n.groupIds); }} idPrefix="hub-hw-group" />
            <StudentPicker students={roster} value={childIds} onChange={(ids) => { setChildIds(ids); setGroupIds((g) => pruneGroups(groups, roster, ids, g)); }} idPrefix="hub-hw-student" flags={unreachable} />
          </div>
          {blocked.length > 0 && (
            <div role="alert" data-testid="hub-hw-unreachable" className="mt-2 rounded-xl border border-[var(--line)] border-s-4 border-s-[var(--gold)] bg-[var(--panel)] px-3 py-2 text-[12.5px] text-[var(--ink)]">
              <b className="font-extrabold">{hp("blockedHead", blocked.length)}</b>
              <ul className="mt-1 list-disc ps-5">{blocked.slice(0, 4).map((id) => <li key={id}>{unreachable[id] ?? nameById.get(id)}</li>)}{blocked.length > 4 && <li>{h("andMore", { n: blocked.length - 4 })}</li>}</ul>
              <button type="button" onClick={() => { const ids = childIds.filter((id) => !unreachable[id]); setChildIds(ids); setGroupIds((g) => pruneGroups(groups, roster, ids, g)); }} className={`mt-1 min-h-[44px] lg:min-h-[36px] font-extrabold text-[var(--brand)] underline ${FOCUS}`}>{hp("removeThem", blocked.length)}</button>
            </div>
          )}
          {yearMates.length > 0 && !yearMates.every((s) => childIds.includes(s.childId)) && (
            <button type="button" data-testid="hub-hw-year-all" onClick={() => { const ids = [...new Set([...childIds, ...yearMates.map((s) => s.childId)])]; setChildIds(ids); }}
              className={`mt-2 min-h-[44px] rounded-full border border-[var(--brand-line)] bg-[var(--brand-soft)] px-4 text-[12.5px] font-extrabold text-[var(--brand-strong)] ${FOCUS}`}>
              {h("yearAll", { year: pack!.year ?? "", n: yearMates.length })}
            </button>
          )}
          <RecipientSummary count={childIds.length} />
        </div>
      </div>
    </Dialog>
    {preview?.kind === "note" && <LessonPreviewDialog noteId={preview.id} title={preview.title} qs={qs} config={config} topics={topics} onClose={() => setPreview(null)} />}
    {preview?.kind === "worksheet" && <WorksheetPreviewDialog noteId={preview.id} title={preview.title} quizId={preview.quizId} qs={qs} onClose={() => setPreview(null)} />}
    {preview?.kind === "quiz" && <QuizPreviewDialog assessmentId={preview.id} title={quiz?.title} qs={qs} onClose={() => setPreview(null)} />}
    </>
  );
}
