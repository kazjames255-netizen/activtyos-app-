"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui";
import { get, post } from "@/lib/api";
import { renderMarkdown } from "@/lib/markdown";
import { useRealtime } from "@/lib/realtime";
import type { PanelProps } from "../panelTypes";
import { errMsg, fmtSize, type Note } from "../types";
import { ACCEPT_FILES, DISPLAY, EmptyState, FOCUS, MAX_FILE, Notice, Overline, Pill, Skeleton, fmtDayTime, goToTab, readAsDataUrl, useCountUp, useNow, withQs, type Tone } from "../teachKit";
import { GradientTile, Ico } from "../teachIcons";
import { ChildChip } from "../family/FamilyContext";
import { useKidCopy } from "../family/kidCopy";
import { closeLink, openLink, useLinkOpen } from "../family/link";
import { VideoEmbeds } from "../videoKit";
import { QuizBreakdown } from "./hwBreakdown";
import { HwTile, StatusStepper } from "./hwKit";
import { hubUrl } from "../home/homeLib";
import { getShared } from "./homeworkFeed";
import { RetryFace } from "./RetryFace";
import { useHw } from "./hwI18n";
import { dueState, pctOf, type AttemptLite, type HubFile, type QuizLite, type StudentHomework as HW } from "./hwTypes";

// Student (parent's child) homework: what's due, hand it in, see the mark.

const TONE_OF: Record<string, Tone> = { red: "red", gold: "gold", neutral: "neutral", green: "green", brand: "brand" };
const MAX_ATTACH = 5;

function StatusPill({ h: hw, now, kind }: { h: HW; now: number; kind: boolean }) {
  const { h } = useHw();
  const s = hw.submission.status;
  if (s === "marked" && hw.submission.mark) return <Pill tone="green" icon={<Ico name="check" size={12} strokeWidth={3} />}>{hw.submission.mark.score}/{hw.submission.mark.max}</Pill>;
  if (s === "submitted") return <Pill tone="brand" icon={<Ico name="hourglass" size={12} />}>{kind ? h("stHandedIn") : h("awaitingMarking")}</Pill>;
  const ds = dueState(hw.dueAt, s, now, kind);
  return <Pill tone={TONE_OF[ds.tone]!}>{ds.label}</Pill>;
}

export function StudentHomework({ qs, childId, students, topics, onError }: PanelProps) {
  const x = useHw();
  const { h: tr, hp } = x;
  const topicById = useMemo(() => new Map((topics ?? []).map((t) => [t.id, t])), [topics]);
  const [list, setList] = useState<HW[] | null>(null);
  const [failed, setFailed] = useState(false);
  // The open homework lives in the URL (?open=hw:<id>): a refresh keeps it, a notification link lands on it, Back closes it.
  const openId = useLinkOpen("hw").id;
  const now = useNow(60_000);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  const path = hubUrl(qs, "/homework", { childId }); // same string Home builds, so both share one fetch
  // A failed load keeps `list` as it was (null on first load) and sets `failed`: it is never shown as "No homework".
  const load = useCallback((force = false) => {
    getShared<HW[]>(path, force).then((r) => { if (!mounted.current) return; setFailed(false); setList(Array.isArray(r) ? r : []); })
      .catch((e) => { if (mounted.current) { setFailed(true); onError(errMsg(e, tr("errLoadMine"))); } });
  }, [path, onError]);
  useEffect(() => { setList(null); setFailed(false); load(); }, [load]);
  useRealtime(["hubHomework", "hubSubmissions"], () => load(true));
  const retry = () => { setFailed(false); load(true); };

  const yg = students.find((s) => s.childId === childId)?.yearGroup;
  const { kind } = useKidCopy(yg);
  const kid = kind;
  const child = students.find((s) => s.childId === childId)?.childName ?? "";
  const groups = useMemo(() => {
    const g = { todo: [] as HW[], waiting: [] as HW[], marked: [] as HW[] };
    for (const h of list ?? []) (h.submission.status === "assigned" ? g.todo : h.submission.status === "submitted" ? g.waiting : g.marked).push(h);
    return g;
  }, [list]);

  if (list === null && failed) return <RetryFace id="hub-homework" what={tr("yourHomework")} kid={kid} onRetry={retry} />;
  if (list === null) return <div className="grid gap-3" aria-busy="true" aria-label={tr("loading")}><Skeleton className="h-[110px]" /><Skeleton className="h-[74px]" /><Skeleton className="h-[74px]" /></div>;

  const open = openId ? list.find((h) => h.id === openId) ?? null : null;
  if (open) return <Detail kid={kid} hw={open} qs={qs} childId={childId} now={now} onBack={closeLink} onChanged={() => load(true)} onError={onError} />;

  if (list.length === 0) {
    return <EmptyState icon={<Ico name="homework" size={26} />} title={tr("noneTitle")} body={tr("noneBody", { who: child || tr("yourTutor") })} />;
  }

  const overdue = groups.todo.filter((h) => dueState(h.dueAt, "assigned", now).overdue).length;
  const card = (h: HW) => {
    const ds = dueState(h.dueAt, h.submission.status, now, kid);
    const hot = ds.overdue && !kid; // a child never gets the red "warning" treatment
    return (
      <button key={h.id + h.childId} type="button" data-ui="card" data-hw={h.id} data-status={h.submission.status} onClick={() => openLink({ kind: "hw", id: h.id }, { tab: "homework" })}
        className={`flex min-h-[68px] w-full items-center gap-3 rounded-2xl border bg-[var(--surface)] p-3.5 text-start shadow-[var(--shadow-sm)] transition duration-200 hover:-translate-y-0.5 hover:border-[var(--brand)] hover:shadow-[var(--shadow)] motion-reduce:transition-none motion-reduce:hover:transform-none ${FOCUS} ${hot ? "border-[var(--red-line)]" : "border-[var(--line)]"}`}>
        <HwTile topic={h.flashcardTopicId ? topicById.get(h.flashcardTopicId) ?? null : null} size={48}
          tone={h.submission.status === "marked" ? "green" : h.submission.status === "submitted" ? "brand" : hot ? "red" : "gold"}
          icon={h.submission.status === "marked" ? "check" : h.submission.status === "submitted" ? "send" : hot ? "warning" : "homework"} />
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-1.5">
            <span className="truncate text-[14px] font-extrabold text-[var(--ink)]">{h.title}</span>
            <StatusPill h={h} now={now} kind={kid} />
            {h.assessmentId && <Pill tone="violet" icon={<Ico name="quiz" size={12} />}>{tr("quiz")}</Pill>}
            {(h.videos?.length ?? 0) > 0 && <Pill tone="violet" icon={<Ico name="video" size={12} />}>{hp("nVideos", h.videos!.length)}</Pill>}
          </span>
          <span className="mt-0.5 block truncate text-[12px] text-[var(--ink-3)]">
            {h.submission.status === "assigned" ? tr("dueAt", { when: x.dayTime(h.dueAt) }) : h.submission.submittedAt ? tr("handedInAtCap", { when: x.dayTime(h.submission.submittedAt) }) : ""}
            {h.submission.status === "marked" && h.submission.mark && !kid && ` · ${pctOf(h.submission.mark)}%`}
            {h.submission.late && !kid && ` · ${tr("lateLower")}`}
          </span>
        </span>
        <StatusStepper status={h.submission.status} compact className="hidden w-[92px] flex-none sm:flex" />
        <Ico name="chevronRight" size={18} className="flex-none text-[var(--ink-3)]" />
      </button>
    );
  };

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4" id="hub-homework">
      <div className="flex flex-wrap items-center gap-3">
        <GradientTile icon="homework" size={44} />
        <div className="min-w-0 flex-1">
          <h2 className="m-0 text-[19px] font-extrabold text-[var(--ink)]" style={DISPLAY}>{child ? tr("titleFor", { name: child }) : tr("title")}</h2>
          <p className="text-[12.5px] text-[var(--ink-3)]">{tr("openHint")}</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2.5">
        {[
          { label: tr("toDo"), n: groups.todo.length, sub: kid ? (overdue ? tr("waitingForYou") : tr("allOnTrack")) : overdue ? tr("nOverdue", { n: overdue }) : tr("allOnTrack"), tone: overdue && !kid ? "var(--red)" : "var(--brand-2)" },
          { label: kid ? tr("stHandedIn") : tr("awaitingMarking"), n: groups.waiting.length, sub: tr("handedInLower"), tone: "var(--brand)" },
          { label: tr("stMarked"), n: groups.marked.length, sub: tr("withFeedback"), tone: "var(--green)" },
        ].map((t) => <SummaryTile key={t.label} {...t} />)}
      </div>

      {groups.todo.length > 0 && <div className="grid gap-2"><Overline>{tr("toDo")}</Overline>{groups.todo.map(card)}</div>}
      {groups.waiting.length > 0 && <div className="grid gap-2"><Overline>{tr("handedAwaiting")}</Overline>{groups.waiting.map(card)}</div>}
      {groups.marked.length > 0 && <div className="grid gap-2"><Overline>{tr("stMarked")}</Overline>{groups.marked.map(card)}</div>}
    </div>
  );
}

// ── one homework ─────────────────────────────────────────────────────────────

function Detail({ kid, hw, qs, childId, now, onBack, onChanged, onError }: { kid: boolean; hw: HW; qs: string; childId: string | null; now: number; onBack: () => void; onChanged: () => void; onError: (m: string) => void }) {
  const x = useHw();
  const { h: tr, hp } = x;
  const sub = hw.submission;
  // An automatic (worksheet) mark can still change with a re-hand-in; only a tutor's own mark locks the hand-in.
  const marked = sub.status === "marked" && sub.mark?.markedBy !== "auto";
  const shownMarked = sub.status === "marked";
  const ds = dueState(hw.dueAt, sub.status, now, kid);
  const [editing, setEditing] = useState(sub.status === "assigned");
  const [text, setText] = useState(sub.text);
  const [files, setFiles] = useState<HubFile[]>(sub.attachments);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [notes, setNotes] = useState<Note[] | null>(null);
  const [openNote, setOpenNote] = useState<string | null>(null);
  const [quiz, setQuiz] = useState<QuizLite | null | undefined>(hw.assessmentId ? undefined : null);
  const [attempts, setAttempts] = useState<AttemptLite[] | null>(hw.assessmentId ? null : []);

  // Keep the draft in step if the server copy changes (realtime), unless mid-edit.
  useEffect(() => { if (!editing) { setText(sub.text); setFiles(sub.attachments); } }, [sub.text, sub.attachments, editing]);

  useEffect(() => {
    let live = true;
    if (hw.notes.length) get<Note[]>(`/api/learning-hub/notes${withQs(qs, { ids: hw.notes.map((n) => n.id).join(","), full: "1" })}`).then((r) => live && setNotes(Array.isArray(r) ? r : [])).catch(() => live && setNotes([]));
    if (hw.assessmentId) {
      get<QuizLite[]>(`/api/learning-hub/assessments${withQs(qs, { type: "quiz", childId })}`).then((r) => live && setQuiz((Array.isArray(r) ? r : []).find((q) => q.id === hw.assessmentId) ?? null)).catch(() => live && setQuiz(null));
      get<AttemptLite[]>(`/api/learning-hub/attempts${withQs(qs, { childId, assessmentId: hw.assessmentId })}`).then((r) => live && setAttempts(Array.isArray(r) ? r : [])).catch(() => live && setAttempts([]));
    }
    return () => { live = false; };
  }, [hw.assessmentId, hw.notes.length, qs, childId]);

  // Interactive worksheets: each one's auto-marked quiz; a paper taken FOR this homework counts.
  const wsQuizIds = (hw.worksheets ?? []).map((w) => w.quizId).filter((x): x is string => !!x);
  const [wsAttempts, setWsAttempts] = useState<AttemptLite[]>([]);
  const wsKey = wsQuizIds.join(",");
  useEffect(() => {
    if (!wsQuizIds.length) return;
    let live = true;
    Promise.all(wsQuizIds.map((id) => get<AttemptLite[]>(`/api/learning-hub/attempts${withQs(qs, { childId, assessmentId: id })}`).catch(() => [] as AttemptLite[])))
      .then((r) => { if (live) setWsAttempts(r.flat().filter((a) => a.homeworkId === hw.id)); });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wsKey, hw.id, qs, childId]);
  // Every interactive worksheet must be done (finished attempt made FOR this homework) before the hand-in.
  const wsDone = wsQuizIds.filter((q) => wsAttempts.some((a) => a.assessmentId === q && a.status !== "in_progress")).length;
  const wsAllDone = wsDone === wsQuizIds.length;

  // Only a paper taken FOR this homework counts (a quiz done earlier from the Quizzes tab is not this homework's quiz).
  const finished = (attempts ?? []).find((a) => a.status !== "in_progress" && a.homeworkId === hw.id);
  const running = (attempts ?? []).find((a) => a.status === "in_progress" && a.homeworkId === hw.id);
  // The server links EVERY finished attempt made for this homework (quiz + each worksheet); the client only needs to know there is one.
  const hasAttempt = !!finished || wsDone > 0 || !!sub.attemptId;

  const attach = async (fl: FileList | null) => {
    if (!fl?.length) return;
    setUploading(true); setErr(null);
    try {
      for (const f of [...fl]) {
        if (files.length >= MAX_ATTACH) { setErr(tr("errMaxFiles", { n: MAX_ATTACH })); break; }
        if (f.size > MAX_FILE) { setErr(tr("errTooBig", { name: f.name })); continue; }
        if (!ACCEPT_FILES.split(",").includes(f.type)) { setErr(tr("errType", { name: f.name })); continue; }
        const dataUrl = await readAsDataUrl(f);
        const up = await post<HubFile>(`/api/learning-hub/submissions/${sub.id}/files${withQs(qs, { childId })}`, { dataUrl, name: f.name });
        setFiles((cur) => [...cur, { ...up, url: up.url ?? "" }].slice(0, MAX_ATTACH));
      }
    } catch (e) { setErr(errMsg(e, tr("errUpload"))); }
    finally { setUploading(false); }
  };

  const submit = async () => {
    if (!wsAllDone) { setErr(tr("wsFirst", { done: wsDone, total: wsQuizIds.length })); return; }
    if (!text.trim() && !files.length && !hasAttempt) { setErr(tr("errEmpty")); return; }
    setBusy(true); setErr(null);
    try {
      await post(`/api/learning-hub/submissions/${sub.id}/submit${withQs(qs, { childId })}`, { text: text.trim(), attachments: files.map((f) => ({ id: f.id, name: f.name })) });
      setDone(true); setEditing(false); onChanged();
    } catch (e) { const m = errMsg(e, tr("errHandIn")); setErr(m); onError(m); }
    finally { setBusy(false); }
  };

  // "Take the quiz" opens THAT quiz straight away, recorded against this homework (POST /assessments/:id/attempts {homeworkId}).
  const goQuiz = () => { if (hw.assessmentId) openLink({ kind: "quiz", id: hw.assessmentId }, { tab: "quizzes", hw: hw.id }); };
  const goCards = () => { if (!goToTab("flashcards", /flashcards/i)) setErr(tr("errFlashTab")); };

  return (
    <div className="@container grid gap-4" id="hub-homework-detail" data-status={sub.status}>
      <button type="button" onClick={onBack} className={`inline-flex min-h-[44px] w-fit items-center gap-1.5 rounded-xl px-2 text-[13px] font-bold text-[var(--brand)] hover:bg-[var(--brand-soft)] ${FOCUS}`}><Ico name="arrowLeft" size={15} />{tr("allHomework")}</button>

      <section className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5 shadow-[var(--shadow-sm)] sm:p-6" data-testid="hub-hw-head">
        <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold">
          {shownMarked ? <span className="rounded-full bg-[var(--green)] px-2.5 py-[3px] uppercase tracking-wide text-white">{sub.mark?.markedBy === "auto" ? tr("markedAutoShort") : tr("stMarked")}</span> : sub.status === "submitted" ? <span className="rounded-full bg-[var(--panel)] text-[var(--ink-2)] px-2.5 py-[3px] uppercase tracking-wide">{kid ? tr("stHandedIn") : tr("awaitingMarking")}</span> : <span className={`rounded-full px-2.5 py-[3px] uppercase tracking-wide ${ds.overdue && !kid ? "bg-[var(--red)] text-white" : "bg-[var(--panel)] text-[var(--ink-2)]"}`}>{ds.label}</span>}
          {sub.late && <span className={`rounded-full px-2.5 py-[3px] uppercase tracking-wide ${kid ? "bg-[var(--panel)] text-[var(--ink-2)]" : "bg-[var(--red)] text-white"}`}>{kid ? tr("stHandedIn") : tr("handedLate")}</span>}
        </div>
        <div className="mt-2.5"><ChildChip childId={childId} tone="soft" /></div>
        <h2 className="mt-2 break-words text-[22px] font-extrabold leading-tight text-[var(--ink)] sm:text-[26px]" style={DISPLAY}>{hw.title}</h2>
        <div className="mt-1.5 text-[13px] text-[var(--ink-3)]">{tr("dueAt", { when: x.dayTime(hw.dueAt) })}{sub.submittedAt && <> · {tr("handedInAt", { when: x.dayTime(sub.submittedAt) })}</>}</div>
        <StatusStepper status={sub.status} className="mt-4 max-w-[380px]" />

        {shownMarked && sub.mark && (
          <div className="mt-4 rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-4" data-testid="hub-mark">
            <div className="flex flex-wrap items-end gap-x-4 gap-y-1">
              <div className="text-[40px] font-extrabold leading-none tabular-nums" style={DISPLAY}>{sub.mark.score}<span className="text-[22px] text-[var(--ink-3)]">/{sub.mark.max}</span></div>
              {!kid && <div className="pb-1 text-[15px] font-bold text-[var(--ink-2)]">{pctOf(sub.mark)}%</div>}
            </div>
            <div className="mt-2.5 h-2 overflow-hidden rounded-full bg-[var(--panel)] text-[var(--ink-2)]"><div className="h-full rounded-full bg-white" style={{ width: `${pctOf(sub.mark)}%` }} /></div>
            {sub.mark.feedback.trim() && <p className="mt-3 whitespace-pre-wrap rounded-xl bg-[var(--surface)] px-3.5 py-2.5 text-[13.5px] leading-relaxed text-[var(--ink)]">&ldquo;{sub.mark.feedback}&rdquo;</p>}
            <div className="mt-2 text-[11.5px] text-[var(--ink-3)]">{sub.mark.markedBy === "auto" ? tr("markedByAuto", { when: x.dayTime(sub.mark.markedAt) }) : tr("markedBy", { name: sub.mark.markedByName, when: x.dayTime(sub.mark.markedAt) })}</div>
          </div>
        )}
      </section>

      {err && <Notice onClose={() => setErr(null)}>{err}</Notice>}

      <div className="grid gap-4 @3xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <div className="grid content-start gap-4">
          {(hw.worksheets ?? []).map((w) => <WorksheetCard key={w.noteId} w={w} qs={qs} childId={childId} hwId={hw.id} attempts={wsAttempts.filter((a) => a.assessmentId === w.quizId)} locked={marked} />)}
          {(hw.videos?.length ?? 0) > 0 && (
            <section className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4 shadow-[var(--shadow-sm)]" aria-label={tr("watchFirst")}>
              <VideoEmbeds videos={hw.videos} heading={tr("watchFirst")} />
            </section>
          )}
          <section className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4 shadow-[var(--shadow-sm)]">
            <div className="mb-1.5 text-[11px] font-extrabold uppercase tracking-[0.08em] text-[var(--ink-3)]">{tr("instructions")}</div>
            {hw.instructions.trim() ? <p className="whitespace-pre-wrap break-words text-[13.5px] leading-relaxed text-[var(--ink)]">{hw.instructions}</p> : <p className="text-[13px] text-[var(--ink-3)]">{tr("noInstr")}</p>}
          </section>

          {hw.notes.length > 0 && (
            <section className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4 shadow-[var(--shadow-sm)]">
              <div className="mb-2 flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-[0.08em] text-[var(--ink-3)]"><Ico name="notes" size={14} />{hw.notes.some((n) => n.interactive) ? tr("lessonsDo") : tr("lessonsRead")}</div>
              <div className="grid gap-2">
                {hw.notes.map((n) => {
                  const full = notes?.find((x) => x.id === n.id);
                  const on = openNote === n.id;
                  if (n.interactive) {
                    return (
                      <div key={n.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-[var(--brand-line)] bg-[var(--brand-soft)] p-2.5 ps-3" data-testid="hub-hw-lesson">
                        <Ico name="play" size={16} className="text-[var(--brand)]" />
                        <span className="min-w-0 flex-1 truncate text-[13.5px] font-extrabold text-[var(--brand-strong)]">{n.title}</span>
                        <Button variant="solid" className={`min-h-[44px] ${FOCUS}`} data-testid="hub-hw-start-lesson"
                          onClick={() => openLink({ kind: "lesson", id: n.id }, { tab: "notes", hw: hw.id })}>
                          {tr("startLesson")}<Ico name="arrowRight" size={15} />
                        </Button>
                      </div>
                    );
                  }
                  return (
                    <div key={n.id} className="overflow-hidden rounded-xl border border-[var(--line)]">
                      <button type="button" aria-expanded={on} onClick={() => setOpenNote(on ? null : n.id)} className={`flex min-h-[44px] w-full items-center gap-2 px-3 text-start text-[13px] font-bold text-[var(--ink)] hover:bg-[var(--panel)] ${FOCUS}`}>
                        <Ico name="file" size={15} className="text-[var(--ink-3)]" /><span className="min-w-0 flex-1 truncate">{n.title}</span><Ico name="chevronDown" size={15} className={`text-[var(--ink-3)] transition-transform ${on ? "rotate-180" : ""}`} />
                      </button>
                      {on && (
                        <div className="border-t border-[var(--line)] px-3 py-3">
                          {notes === null ? <Skeleton className="h-16" /> : full ? (
                            <>
                              {full.body.trim() ? <div className="space-y-2 text-[13px] leading-relaxed text-[var(--ink-2)]">{renderMarkdown(full.body)}</div> : <p className="text-[12.5px] text-[var(--ink-3)]">{tr("noText")}</p>}
                              {full.attachments.length > 0 && <div className="mt-2.5 flex flex-wrap gap-2">{full.attachments.map((a) => <a key={a.id} href={a.url} target="_blank" rel="noopener noreferrer" className={`inline-flex min-h-[44px] lg:min-h-[40px] items-center gap-1.5 rounded-lg border border-[var(--line)] bg-[var(--panel)] px-2.5 text-[12px] font-semibold text-[var(--ink)] hover:border-[var(--brand)] ${FOCUS}`}><Ico name={a.contentType === "application/pdf" ? "file" : "image"} size={14} /> {a.name}</a>)}</div>}
                            </>
                          ) : <p className="text-[12.5px] text-[var(--ink-3)]">{tr("findLessons")}</p>}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {hw.assessmentId && (
            <section className="rounded-2xl border border-[var(--brand-line)] bg-[var(--brand-soft)] p-4" data-testid="hub-hw-quiz">
              <div className="flex flex-wrap items-center gap-2">
                <span aria-hidden className="grid h-10 w-10 flex-none place-items-center rounded-xl bg-[var(--surface)] text-[var(--brand)]"><Ico name="quiz" size={20} /></span>
                <div className="min-w-0 flex-1">
                  <div className="text-[13.5px] font-extrabold text-[var(--brand-strong)]">{quiz === undefined ? tr("quiz") : quiz ? quiz.title : tr("linkedQuiz")}</div>
                  <div className="text-[12px] text-[var(--ink-2)]">
                    {attempts === null ? tr("checking") : finished ? (finished.status === "marked" && finished.pct !== null ? tr("doneScore", { got: finished.scoreMarks, max: finished.maxMarks, pct: finished.pct }) : tr("doneWaiting")) : running ? tr("startedQuiz") : quiz ? `${hp("nQuestions", quiz.questionCount)}${quiz.totalMarks ? ` · ${hp("nMarks", quiz.totalMarks)}` : ""}` : tr("quizPart")}
                  </div>
                </div>
                {finished ? <Pill tone="green" icon={<Ico name="check" size={12} strokeWidth={3} />}>{tr("quizDone")}</Pill> : !marked && <Button variant="solid" className={`min-h-[44px] ${FOCUS}`} onClick={goQuiz}>{running ? tr("continueQuiz") : tr("takeQuiz")}<Ico name="arrowRight" size={15} /></Button>}
              </div>
              {finished?.status === "marked" && <QuizBreakdown attemptId={finished.id} qs={withQs(qs, { childId })} />}
              {!finished && !marked && <p className="mt-2 text-[11.5px] text-[var(--ink-2)]">{tr("quizOpens")}</p>}
            </section>
          )}

          {hw.flashcardTopicId && (
            <section className="flex flex-wrap items-center gap-2 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4 shadow-[var(--shadow-sm)]">
              <span aria-hidden className="grid h-10 w-10 flex-none place-items-center rounded-xl bg-[var(--brand-soft)] text-[var(--brand)]"><Ico name="cards" size={20} /></span>
              <div className="min-w-0 flex-1"><div className="text-[13.5px] font-extrabold text-[var(--ink)]">{tr("reviseCards")}</div><div className="text-[12px] text-[var(--ink-3)]">{tr("reviseCardsSub")}</div></div>
              <Button variant="ghost" className={`min-h-[44px] ${FOCUS}`} onClick={goCards}>{tr("openCards")}<Ico name="arrowRight" size={15} /></Button>
            </section>
          )}
        </div>

        <section className="content-start rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4 shadow-[var(--shadow-sm)]" aria-label={tr("yourHandIn")}>
          <div className="mb-2 text-[11px] font-extrabold uppercase tracking-[0.08em] text-[var(--ink-3)]">{tr("yourHandIn")}</div>

          {done && !editing && <div className="mb-3"><Notice tone="green">{tr("handedOk")}</Notice></div>}

          {marked || (!editing && sub.status !== "assigned") ? (
            <div className="grid gap-3">
              {sub.text.trim() ? <p className="whitespace-pre-wrap break-words rounded-xl border border-[var(--line)] bg-[var(--panel)] px-3.5 py-3 text-[13px] leading-relaxed text-[var(--ink)]">{sub.text}</p> : <p className="text-[12.5px] text-[var(--ink-3)]">{tr("noWritten")}</p>}
              {sub.attachments.length > 0 && <div className="flex flex-wrap gap-2">{sub.attachments.map((f) => <a key={f.id} href={f.url} target="_blank" rel="noopener noreferrer" className={`inline-flex min-h-[44px] lg:min-h-[40px] items-center gap-1.5 rounded-lg border border-[var(--line)] bg-[var(--panel)] px-2.5 text-[12px] font-semibold text-[var(--ink)] hover:border-[var(--brand)] ${FOCUS}`}><Ico name={f.contentType === "application/pdf" ? "file" : "image"} size={14} /> <span className="max-w-[180px] truncate">{f.name}</span></a>)}</div>}
              {(sub.attemptId || (sub.attemptIds?.length ?? 0) > 0) && <Pill tone="violet" icon={<Ico name="quiz" size={12} />}>{tr("resultAttached")}</Pill>}
              {!marked && <Button variant="ghost" className={`min-h-[44px] w-fit ${FOCUS}`} onClick={() => setEditing(true)}><Ico name="edit" size={15} />{tr("changeHandIn")}</Button>}
              {!marked && <p className="text-[11.5px] text-[var(--ink-3)]">{tr("changeUntil")}</p>}
            </div>
          ) : (
            <div className="grid gap-3">
              <div>
                <label htmlFor="hub-hw-text" className="mb-1 block text-[11px] font-extrabold uppercase tracking-[0.04em] text-[var(--ink-3)]">{tr("yourAnswer")}</label>
                <textarea id="hub-hw-text" rows={7} maxLength={10000} value={text} onChange={(e) => setText(e.target.value)} placeholder={tr("answerPh")}
                  className="w-full resize-y rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2.5 text-[13.5px] leading-relaxed text-[var(--ink)] outline-none focus:border-[var(--brand)]" />
              </div>
              <div>
                <div className="mb-1 text-[11px] font-extrabold uppercase tracking-[0.04em] text-[var(--ink-3)]">{tr("photosFiles")}</div>
                <div className="flex flex-wrap gap-2">
                  {files.map((f) => (
                    <span key={f.id} className="inline-flex min-h-[44px] lg:min-h-[40px] items-center gap-1.5 rounded-lg border border-[var(--line)] bg-[var(--panel)] ps-2.5 pe-1 text-[12px] font-semibold text-[var(--ink)]">
                      <Ico name={f.contentType === "application/pdf" ? "file" : "image"} size={14} /> <span className="max-w-[150px] truncate">{f.name}</span><span className="text-[11px] font-normal text-[var(--ink-3)]">{fmtSize(f.size)}</span>
                      <button type="button" aria-label={tr("removeAria", { what: f.name })} onClick={() => setFiles(files.filter((x) => x.id !== f.id))} className={`grid h-10 w-10 place-items-center rounded-md text-[var(--ink-3)] hover:text-[var(--red)] ${FOCUS}`}><Ico name="close" size={14} /></button>
                    </span>
                  ))}
                  {files.length < MAX_ATTACH && (
                    <label className={`inline-flex min-h-[44px] lg:min-h-[40px] cursor-pointer items-center gap-1.5 rounded-lg border border-dashed border-[var(--brand-line)] bg-[var(--brand-soft)] px-3 text-[12px] font-bold text-[var(--brand-strong)] hover:border-[var(--brand)] focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[color:var(--brand-2)] ${uploading ? "opacity-60" : ""}`}>
                      {uploading ? tr("uploading") : <><Ico name="plus" size={14} strokeWidth={2.4} />{tr("addPhoto")}</>}
                      <input id="hub-hw-files" type="file" accept={ACCEPT_FILES} multiple className="sr-only" disabled={uploading} onChange={(e) => { void attach(e.target.files); e.target.value = ""; }} />
                    </label>
                  )}
                </div>
                <p className="mt-1 text-[11px] text-[var(--ink-3)]">{tr("fileHint", { n: MAX_ATTACH })}</p>
              </div>
              {hasAttempt && <Pill tone="violet" icon={<Ico name="quiz" size={12} />}>{tr("resultWillAttach")}</Pill>}
              {!wsAllDone && <p role="status" data-testid="hub-hw-ws-gate" className="m-0 rounded-xl border border-[var(--line)] border-s-4 border-s-[var(--gold)] bg-[var(--panel)] px-3 py-2 text-[12.5px] font-semibold text-[var(--ink)]">{tr("wsFirst", { done: wsDone, total: wsQuizIds.length })}</p>}
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="solid" id="hub-hw-submit" className={`min-h-[48px] px-6 text-[14px] ${FOCUS}`} disabled={busy || uploading || !wsAllDone} onClick={() => void submit()}>{busy ? tr("handingIn") : sub.status === "submitted" || shownMarked ? tr("updateHandIn") : tr("handIn")}</Button>
                {sub.status === "submitted" && <Button variant="ghost" className={`min-h-[48px] ${FOCUS}`} onClick={() => { setEditing(false); setText(sub.text); setFiles(sub.attachments); }}>{tr("cancel")}</Button>}
              </div>
              {ds.overdue && sub.status === "assigned" && !kid && <p className="text-[11.5px] font-semibold text-[var(--red)]">{tr("pastDue")}</p>}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}


/** A lesson worksheet on a homework: done on screen in the quiz player and auto-marked ("Mark it" = the button at the end of the worksheet);
 *  the marked worksheet shows a question rail with the running total. Then the child hands in below. */
function WorksheetCard({ w, qs, childId, hwId, attempts, locked }: { w: NonNullable<HW["worksheets"]>[number]; qs: string; childId: string | null; hwId: string; attempts: AttemptLite[]; locked: boolean }) {
  const { h } = useHw();
  const finished = attempts.find((a) => a.status !== "in_progress");
  const running = attempts.find((a) => a.status === "in_progress");
  const step = !w.quizId ? 0 : finished ? 3 : running ? 2 : 1;
  return (
    <section className="rounded-2xl border border-[var(--brand-line)] bg-[var(--surface)] p-4 shadow-[var(--shadow-sm)]" data-testid="hub-hw-worksheet" aria-label={h("wsAria", { title: w.title })}>
      <div className="flex flex-wrap items-center gap-2">
        <span aria-hidden className="grid h-10 w-10 flex-none place-items-center rounded-xl bg-[var(--brand-soft)] text-[var(--brand)]"><Ico name="file" size={20} /></span>
        <div className="min-w-0 flex-1">
          <div className="text-[13.5px] font-extrabold text-[var(--ink)]">{h("wsHead", { title: w.title })}</div>
          <div className="text-[12px] text-[var(--ink-2)]">{finished ? (finished.status === "marked" && finished.pct !== null ? h("doneScore", { got: finished.scoreMarks, max: finished.maxMarks, pct: finished.pct }) : h("doneWaiting")) : running ? h("wsStarted") : h("wsOnScreen")}</div>
        </div>
        {w.quizId && !finished && !locked && <Button variant="solid" className={`min-h-[44px] ${FOCUS}`} data-testid="hub-hw-start-worksheet" onClick={() => openLink({ kind: "quiz", id: w.quizId! }, { tab: "quizzes", hw: hwId })}>{running ? h("wsContinue") : h("wsDo")}<Ico name="arrowRight" size={15} /></Button>}
        {finished && <Pill tone="green" icon={<Ico name="check" size={12} strokeWidth={3} />}>{h("wsDone")}</Pill>}
      </div>
      {w.quizId && (
        <ol data-testid="hub-hw-ws-steps" className="m-0 mt-3 grid list-none gap-1.5 p-0 text-[12px] sm:grid-cols-3" aria-label={h("wsStepsAria")}>
          {[h("wsStep1"), h("wsStep2"), h("wsStep3")].map((label, i) => {
            const on = step === i + 1, past = step > i + 1;
            return <li key={i} aria-current={on ? "step" : undefined} className={`flex items-center gap-2 rounded-lg border px-2.5 py-2 font-bold ${on ? "border-[var(--brand)] bg-[var(--brand-soft)] text-[var(--brand-strong)]" : past ? "border-[var(--line)] bg-[var(--panel)] text-[var(--green)]" : "border-[var(--line)] text-[var(--ink-3)]"}`}><span aria-hidden className="grid h-5 w-5 flex-none place-items-center rounded-full border border-current text-[11px]">{past ? "✓" : i + 1}</span>{label}</li>;
          })}
        </ol>
      )}
      {finished?.status === "marked" && <QuizBreakdown attemptId={finished.id} qs={withQs(qs, { childId })} />}
    </section>
  );
}

function SummaryTile({ label, n, sub, tone }: { label: string; n: number; sub: string; tone: string }) {
  const v = useCountUp(n, 600);
  return (
    <div className="relative overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-3 ps-4 shadow-[var(--shadow-sm)]">
      <div className="absolute bottom-3 start-0 top-3 w-[3px] rounded-e" style={{ background: tone }} />
      <div className="truncate text-[11px] font-extrabold uppercase tracking-[0.08em] text-[var(--ink-3)]">{label}</div>
      <div className="mt-1 text-[24px] font-extrabold leading-none tabular-nums" style={{ ...DISPLAY, color: tone }}>{v}</div>
      <div className="mt-1 truncate text-[11px] font-semibold text-[var(--ink-3)]">{sub}</div>
    </div>
  );
}
