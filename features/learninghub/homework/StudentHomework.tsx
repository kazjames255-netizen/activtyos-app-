"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui";
import { get, post } from "@/lib/api";
import { renderMarkdown } from "@/lib/markdown";
import { useRealtime } from "@/lib/realtime";
import type { PanelProps } from "../panelTypes";
import { errMsg, fmtSize, type Note } from "../types";
import { ACCEPT_FILES, DISPLAY, EmptyState, FOCUS, HERO_BG, MAX_FILE, Notice, Overline, Pill, Skeleton, fmtDayTime, goToTab, readAsDataUrl, useCountUp, useNow, withQs, type Tone } from "../teachKit";
import { GradientTile, Ico } from "../teachIcons";
import { ChildChip } from "../family/FamilyContext";
import { closeLink, openLink, useLinkOpen } from "../family/link";
import { VideoEmbeds } from "../videoKit";
import { HwTile, StatusStepper } from "./hwKit";
import { dueState, pctOf, type AttemptLite, type HubFile, type QuizLite, type StudentHomework as HW } from "./hwTypes";

// Student (parent's child) homework: what's due, hand it in, see the mark.

const TONE_OF: Record<string, Tone> = { red: "red", gold: "gold", neutral: "neutral", green: "green", brand: "brand" };
const MAX_ATTACH = 5;

function StatusPill({ h, now }: { h: HW; now: number }) {
  const s = h.submission.status;
  if (s === "marked" && h.submission.mark) return <Pill tone="green" icon={<Ico name="check" size={12} strokeWidth={3} />}>{h.submission.mark.score}/{h.submission.mark.max}</Pill>;
  if (s === "submitted") return <Pill tone="brand" icon={<Ico name="hourglass" size={12} />}>Awaiting marking</Pill>;
  const ds = dueState(h.dueAt, s, now);
  return <Pill tone={TONE_OF[ds.tone]!}>{ds.label}</Pill>;
}

export function StudentHomework({ qs, childId, students, topics, onError }: PanelProps) {
  const topicById = useMemo(() => new Map((topics ?? []).map((t) => [t.id, t])), [topics]);
  const [list, setList] = useState<HW[] | null>(null);
  // The open homework lives in the URL (?open=hw:<id>): a refresh keeps it, a notification link lands on it, Back closes it.
  const openId = useLinkOpen("hw").id;
  const now = useNow(60_000);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  const path = `/api/learning-hub/homework${withQs(qs, { childId })}`;
  const load = useCallback(() => {
    get<HW[]>(path).then((r) => mounted.current && setList(Array.isArray(r) ? r : []))
      .catch((e) => { if (mounted.current) { setList((c) => c ?? []); onError(errMsg(e, "Couldn't load your homework")); } });
  }, [path, onError]);
  useEffect(() => { setList(null); load(); }, [load]);
  useRealtime(["hubHomework", "hubSubmissions"], load);

  const child = students.find((s) => s.childId === childId)?.childName ?? "";
  const groups = useMemo(() => {
    const g = { todo: [] as HW[], waiting: [] as HW[], marked: [] as HW[] };
    for (const h of list ?? []) (h.submission.status === "assigned" ? g.todo : h.submission.status === "submitted" ? g.waiting : g.marked).push(h);
    return g;
  }, [list]);

  if (list === null) return <div className="grid gap-3" aria-busy="true" aria-label="Loading homework"><Skeleton className="h-[110px]" /><Skeleton className="h-[74px]" /><Skeleton className="h-[74px]" /></div>;

  const open = openId ? list.find((h) => h.id === openId) ?? null : null;
  if (open) return <Detail hw={open} qs={qs} childId={childId} now={now} onBack={closeLink} onChanged={load} onError={onError} />;

  if (list.length === 0) {
    return <EmptyState icon={<Ico name="homework" size={26} />} title="No homework right now" body={`When ${child || "your tutor"} sets homework it will appear here with its due date — you can hand it in and read the feedback without leaving this page.`} />;
  }

  const overdue = groups.todo.filter((h) => dueState(h.dueAt, "assigned", now).overdue).length;
  const card = (h: HW) => {
    const ds = dueState(h.dueAt, h.submission.status, now);
    return (
      <button key={h.id + h.childId} type="button" data-ui="card" data-hw={h.id} data-status={h.submission.status} onClick={() => openLink({ kind: "hw", id: h.id }, { tab: "homework" })}
        className={`flex min-h-[68px] w-full items-center gap-3 rounded-2xl border bg-[var(--surface)] p-3.5 text-left shadow-[var(--shadow-sm)] transition duration-200 hover:-translate-y-0.5 hover:border-[var(--brand)] hover:shadow-[var(--shadow)] motion-reduce:transition-none motion-reduce:hover:transform-none ${FOCUS} ${ds.overdue ? "border-[var(--red-line)]" : "border-[var(--line)]"}`}>
        <HwTile topic={h.flashcardTopicId ? topicById.get(h.flashcardTopicId) ?? null : null} size={48}
          tone={h.submission.status === "marked" ? "green" : h.submission.status === "submitted" ? "brand" : ds.overdue ? "red" : "gold"}
          icon={h.submission.status === "marked" ? "check" : h.submission.status === "submitted" ? "send" : ds.overdue ? "warning" : "homework"} />
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-1.5">
            <span className="truncate text-[14px] font-extrabold text-[var(--ink)]">{h.title}</span>
            <StatusPill h={h} now={now} />
            {h.assessmentId && <Pill tone="violet" icon={<Ico name="quiz" size={12} />}>Quiz</Pill>}
            {(h.videos?.length ?? 0) > 0 && <Pill tone="violet" icon={<Ico name="video" size={12} />}>{h.videos!.length > 1 ? `${h.videos!.length} videos` : "Video"}</Pill>}
          </span>
          <span className="mt-0.5 block truncate text-[12px] text-[var(--ink-3)]">
            {h.submission.status === "assigned" ? `Due ${fmtDayTime(h.dueAt)}` : h.submission.submittedAt ? `Handed in ${fmtDayTime(h.submission.submittedAt)}` : ""}
            {h.submission.status === "marked" && h.submission.mark && ` · ${pctOf(h.submission.mark)}%`}
            {h.submission.late && " · late"}
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
          <h2 className="m-0 text-[19px] font-extrabold text-[var(--ink)]" style={DISPLAY}>Homework{child ? ` for ${child}` : ""}</h2>
          <p className="text-[12.5px] text-[var(--ink-3)]">Open a piece of homework to see what to do, hand it in, and read your feedback.</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2.5">
        {[
          { label: "To do", n: groups.todo.length, sub: overdue ? `${overdue} overdue` : "all on track", tone: overdue ? "var(--red)" : "var(--brand-2)" },
          { label: "Awaiting marking", n: groups.waiting.length, sub: "handed in", tone: "var(--brand)" },
          { label: "Marked", n: groups.marked.length, sub: "with feedback", tone: "var(--green)" },
        ].map((t) => <SummaryTile key={t.label} {...t} />)}
      </div>

      {groups.todo.length > 0 && <div className="grid gap-2"><Overline>To do</Overline>{groups.todo.map(card)}</div>}
      {groups.waiting.length > 0 && <div className="grid gap-2"><Overline>Handed in — awaiting marking</Overline>{groups.waiting.map(card)}</div>}
      {groups.marked.length > 0 && <div className="grid gap-2"><Overline>Marked</Overline>{groups.marked.map(card)}</div>}
    </div>
  );
}

// ── one homework ─────────────────────────────────────────────────────────────

function Detail({ hw, qs, childId, now, onBack, onChanged, onError }: { hw: HW; qs: string; childId: string | null; now: number; onBack: () => void; onChanged: () => void; onError: (m: string) => void }) {
  const sub = hw.submission;
  const marked = sub.status === "marked";
  const ds = dueState(hw.dueAt, sub.status, now);
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

  // Only a paper taken FOR this homework counts (a quiz done earlier from the Quizzes tab is not this homework's quiz).
  const finished = (attempts ?? []).find((a) => a.status !== "in_progress" && a.homeworkId === hw.id);
  const running = (attempts ?? []).find((a) => a.status === "in_progress" && a.homeworkId === hw.id);
  const linkedAttemptId = sub.attemptId ?? finished?.id ?? null;

  const attach = async (fl: FileList | null) => {
    if (!fl?.length) return;
    setUploading(true); setErr(null);
    try {
      for (const f of [...fl]) {
        if (files.length >= MAX_ATTACH) { setErr(`Up to ${MAX_ATTACH} files.`); break; }
        if (f.size > MAX_FILE) { setErr(`${f.name} is too big — keep files under 700 KB (a photo at lower quality, or a PDF).`); continue; }
        if (!ACCEPT_FILES.split(",").includes(f.type)) { setErr(`${f.name}: only PDFs and photos (PNG, JPG, WebP, GIF) can be attached.`); continue; }
        const dataUrl = await readAsDataUrl(f);
        const up = await post<HubFile>(`/api/learning-hub/submissions/${sub.id}/files${withQs(qs, { childId })}`, { dataUrl, name: f.name });
        setFiles((cur) => [...cur, { ...up, url: up.url ?? "" }].slice(0, MAX_ATTACH));
      }
    } catch (e) { setErr(errMsg(e, "Couldn't upload that file")); }
    finally { setUploading(false); }
  };

  const submit = async () => {
    if (!text.trim() && !files.length && !linkedAttemptId) { setErr("Add some writing, a photo or a file first."); return; }
    setBusy(true); setErr(null);
    try {
      await post(`/api/learning-hub/submissions/${sub.id}/submit${withQs(qs, { childId })}`, { text: text.trim(), attachments: files.map((f) => ({ id: f.id, name: f.name })), attemptId: linkedAttemptId });
      setDone(true); setEditing(false); onChanged();
    } catch (e) { const m = errMsg(e, "Couldn't hand it in"); setErr(m); onError(m); }
    finally { setBusy(false); }
  };

  // "Take the quiz" opens THAT quiz straight away, recorded against this homework (POST /assessments/:id/attempts {homeworkId}).
  const goQuiz = () => { if (hw.assessmentId) openLink({ kind: "quiz", id: hw.assessmentId }, { tab: "quizzes", hw: hw.id }); };
  const goCards = () => { if (!goToTab("flashcards", /flashcards/i)) setErr("Open the Flashcards tab at the top of this page."); };

  return (
    <div className="@container grid gap-4" id="hub-homework-detail" data-status={sub.status}>
      <button type="button" onClick={onBack} className={`inline-flex min-h-[44px] w-fit items-center gap-1.5 rounded-xl px-2 text-[13px] font-bold text-[var(--brand)] hover:bg-[var(--brand-soft)] ${FOCUS}`}><Ico name="arrowLeft" size={15} />All homework</button>

      <section className="relative overflow-hidden rounded-3xl p-5 text-white shadow-[var(--shadow)] sm:p-6" style={HERO_BG}>
        <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold">
          {marked ? <span className="rounded-full bg-[var(--green)] px-2.5 py-[3px] uppercase tracking-wide">Marked</span> : sub.status === "submitted" ? <span className="rounded-full bg-white/20 px-2.5 py-[3px] uppercase tracking-wide">Awaiting marking</span> : <span className={`rounded-full px-2.5 py-[3px] uppercase tracking-wide ${ds.overdue ? "bg-[var(--red)]" : "bg-white/20"}`}>{ds.label}</span>}
          {sub.late && <span className="rounded-full bg-[var(--red)] px-2.5 py-[3px] uppercase tracking-wide">Handed in late</span>}
        </div>
        <div className="mt-2.5"><ChildChip childId={childId} tone="dark" /></div>
        <h2 className="mt-2 break-words text-[24px] font-extrabold leading-tight sm:text-[28px]" style={DISPLAY}>{hw.title}</h2>
        <div className="mt-1.5 text-[13px] text-white/80">Due {fmtDayTime(hw.dueAt)}{sub.submittedAt && <> · handed in {fmtDayTime(sub.submittedAt)}</>}</div>
        <StatusStepper status={sub.status} onDark className="mt-4 max-w-[380px]" />

        {marked && sub.mark && (
          <div className="mt-4 rounded-2xl border border-white/20 bg-white/12 p-4 backdrop-blur-sm" data-testid="hub-mark">
            <div className="flex flex-wrap items-end gap-x-4 gap-y-1">
              <div className="text-[40px] font-extrabold leading-none tabular-nums" style={DISPLAY}>{sub.mark.score}<span className="text-[22px] text-white/70">/{sub.mark.max}</span></div>
              <div className="pb-1 text-[15px] font-bold text-white/90">{pctOf(sub.mark)}%</div>
            </div>
            <div className="mt-2.5 h-2 overflow-hidden rounded-full bg-white/20"><div className="h-full rounded-full bg-white" style={{ width: `${pctOf(sub.mark)}%` }} /></div>
            {sub.mark.feedback.trim() && <p className="mt-3 whitespace-pre-wrap rounded-xl bg-white/10 px-3.5 py-2.5 text-[13.5px] leading-relaxed text-white">&ldquo;{sub.mark.feedback}&rdquo;</p>}
            <div className="mt-2 text-[11.5px] text-white/70">Marked by {sub.mark.markedByName} · {fmtDayTime(sub.mark.markedAt)}</div>
          </div>
        )}
      </section>

      {err && <Notice onClose={() => setErr(null)}>{err}</Notice>}

      <div className="grid gap-4 @3xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <div className="grid content-start gap-4">
          {(hw.videos?.length ?? 0) > 0 && (
            <section className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4 shadow-[var(--shadow-sm)]" aria-label="Watch first">
              <VideoEmbeds videos={hw.videos} heading="Watch first" />
            </section>
          )}
          <section className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4 shadow-[var(--shadow-sm)]">
            <div className="mb-1.5 text-[11px] font-extrabold uppercase tracking-[0.08em] text-[var(--ink-3)]">Instructions</div>
            {hw.instructions.trim() ? <p className="whitespace-pre-wrap break-words text-[13.5px] leading-relaxed text-[var(--ink)]">{hw.instructions}</p> : <p className="text-[13px] text-[var(--ink-3)]">No written instructions — check with your tutor.</p>}
          </section>

          {hw.notes.length > 0 && (
            <section className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4 shadow-[var(--shadow-sm)]">
              <div className="mb-2 flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-[0.08em] text-[var(--ink-3)]"><Ico name="notes" size={14} />{hw.notes.some((n) => n.interactive) ? "Lessons to do first" : "Lessons to read first"}</div>
              <div className="grid gap-2">
                {hw.notes.map((n) => {
                  const full = notes?.find((x) => x.id === n.id);
                  const on = openNote === n.id;
                  if (n.interactive) {
                    return (
                      <div key={n.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-[var(--brand-line)] bg-[var(--brand-soft)] p-2.5 pl-3" data-testid="hub-hw-lesson">
                        <Ico name="play" size={16} className="text-[var(--brand)]" />
                        <span className="min-w-0 flex-1 truncate text-[13.5px] font-extrabold text-[var(--brand-strong)]">{n.title}</span>
                        <Button variant="solid" className={`min-h-[44px] ${FOCUS}`} data-testid="hub-hw-start-lesson"
                          onClick={() => openLink({ kind: "lesson", id: n.id }, { tab: "notes", hw: hw.id })}>
                          Start the lesson<Ico name="arrowRight" size={15} />
                        </Button>
                      </div>
                    );
                  }
                  return (
                    <div key={n.id} className="overflow-hidden rounded-xl border border-[var(--line)]">
                      <button type="button" aria-expanded={on} onClick={() => setOpenNote(on ? null : n.id)} className={`flex min-h-[44px] w-full items-center gap-2 px-3 text-left text-[13px] font-bold text-[var(--ink)] hover:bg-[var(--panel)] ${FOCUS}`}>
                        <Ico name="file" size={15} className="text-[var(--ink-3)]" /><span className="min-w-0 flex-1 truncate">{n.title}</span><Ico name="chevronDown" size={15} className={`text-[var(--ink-3)] transition-transform ${on ? "rotate-180" : ""}`} />
                      </button>
                      {on && (
                        <div className="border-t border-[var(--line)] px-3 py-3">
                          {notes === null ? <Skeleton className="h-16" /> : full ? (
                            <>
                              {full.body.trim() ? <div className="space-y-2 text-[13px] leading-relaxed text-[var(--ink-2)]">{renderMarkdown(full.body)}</div> : <p className="text-[12.5px] text-[var(--ink-3)]">No written text — see the attached files.</p>}
                              {full.attachments.length > 0 && <div className="mt-2.5 flex flex-wrap gap-2">{full.attachments.map((a) => <a key={a.id} href={a.url} target="_blank" rel="noopener noreferrer" className={`inline-flex min-h-[44px] lg:min-h-[40px] items-center gap-1.5 rounded-lg border border-[var(--line)] bg-[var(--panel)] px-2.5 text-[12px] font-semibold text-[var(--ink)] hover:border-[var(--brand)] ${FOCUS}`}><Ico name={a.contentType === "application/pdf" ? "file" : "image"} size={14} /> {a.name}</a>)}</div>}
                            </>
                          ) : <p className="text-[12.5px] text-[var(--ink-3)]">Find this in the Lessons tab.</p>}
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
                  <div className="text-[13.5px] font-extrabold text-[var(--brand-strong)]">{quiz === undefined ? "Quiz" : quiz ? quiz.title : "Linked quiz"}</div>
                  <div className="text-[12px] text-[var(--ink-2)]">
                    {attempts === null ? "Checking your progress…" : finished ? (finished.status === "marked" && finished.pct !== null ? `Done — ${finished.scoreMarks}/${finished.maxMarks} (${finished.pct}%)` : "Done — waiting for your tutor to mark the written answers") : running ? "You've started this quiz — finish it to hand it in." : quiz ? `${quiz.questionCount} questions${quiz.totalMarks ? ` · ${quiz.totalMarks} marks` : ""}` : "This quiz is part of the homework."}
                  </div>
                </div>
                {finished ? <Pill tone="green" icon={<Ico name="check" size={12} strokeWidth={3} />}>Quiz done</Pill> : !marked && <Button variant="solid" className={`min-h-[44px] ${FOCUS}`} onClick={goQuiz}>{running ? "Continue quiz" : "Take the quiz"}<Ico name="arrowRight" size={15} /></Button>}
              </div>
              {!finished && !marked && <p className="mt-2 text-[11.5px] text-[var(--ink-2)]">The quiz opens right here. When you finish, come back and hand this homework in — your result is attached automatically.</p>}
            </section>
          )}

          {hw.flashcardTopicId && (
            <section className="flex flex-wrap items-center gap-2 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4 shadow-[var(--shadow-sm)]">
              <span aria-hidden className="grid h-10 w-10 flex-none place-items-center rounded-xl bg-[var(--brand-soft)] text-[var(--brand)]"><Ico name="cards" size={20} /></span>
              <div className="min-w-0 flex-1"><div className="text-[13.5px] font-extrabold text-[var(--ink)]">Revise the flashcards</div><div className="text-[12px] text-[var(--ink-3)]">Your tutor picked some cards to go with this homework.</div></div>
              <Button variant="ghost" className={`min-h-[44px] ${FOCUS}`} onClick={goCards}>Open Flashcards<Ico name="arrowRight" size={15} /></Button>
            </section>
          )}
        </div>

        <section className="content-start rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4 shadow-[var(--shadow-sm)]" aria-label="Your hand-in">
          <div className="mb-2 text-[11px] font-extrabold uppercase tracking-[0.08em] text-[var(--ink-3)]">Your hand-in</div>

          {done && !editing && <div className="mb-3"><Notice tone="green">Handed in! Your tutor will mark it and you&rsquo;ll see the result here.</Notice></div>}

          {marked || (!editing && sub.status !== "assigned") ? (
            <div className="grid gap-3">
              {sub.text.trim() ? <p className="whitespace-pre-wrap break-words rounded-xl border border-[var(--line)] bg-[var(--panel)] px-3.5 py-3 text-[13px] leading-relaxed text-[var(--ink)]">{sub.text}</p> : <p className="text-[12.5px] text-[var(--ink-3)]">No written answer.</p>}
              {sub.attachments.length > 0 && <div className="flex flex-wrap gap-2">{sub.attachments.map((f) => <a key={f.id} href={f.url} target="_blank" rel="noopener noreferrer" className={`inline-flex min-h-[44px] lg:min-h-[40px] items-center gap-1.5 rounded-lg border border-[var(--line)] bg-[var(--panel)] px-2.5 text-[12px] font-semibold text-[var(--ink)] hover:border-[var(--brand)] ${FOCUS}`}><Ico name={f.contentType === "application/pdf" ? "file" : "image"} size={14} /> <span className="max-w-[180px] truncate">{f.name}</span></a>)}</div>}
              {sub.attemptId && <Pill tone="violet" icon={<Ico name="quiz" size={12} />}>Quiz result attached</Pill>}
              {!marked && <Button variant="ghost" className={`min-h-[44px] w-fit ${FOCUS}`} onClick={() => setEditing(true)}><Ico name="edit" size={15} />Change my hand-in</Button>}
              {!marked && <p className="text-[11.5px] text-[var(--ink-3)]">You can change it until your tutor marks it.</p>}
            </div>
          ) : (
            <div className="grid gap-3">
              <div>
                <label htmlFor="hub-hw-text" className="mb-1 block text-[11px] font-extrabold uppercase tracking-[0.04em] text-[var(--ink-3)]">Your answer</label>
                <textarea id="hub-hw-text" rows={7} maxLength={10000} value={text} onChange={(e) => setText(e.target.value)} placeholder="Write your answer here — or attach a photo of your work below."
                  className="w-full resize-y rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2.5 text-[13.5px] leading-relaxed text-[var(--ink)] outline-none focus:border-[var(--brand)]" />
              </div>
              <div>
                <div className="mb-1 text-[11px] font-extrabold uppercase tracking-[0.04em] text-[var(--ink-3)]">Photos or files</div>
                <div className="flex flex-wrap gap-2">
                  {files.map((f) => (
                    <span key={f.id} className="inline-flex min-h-[44px] lg:min-h-[40px] items-center gap-1.5 rounded-lg border border-[var(--line)] bg-[var(--panel)] pl-2.5 pr-1 text-[12px] font-semibold text-[var(--ink)]">
                      <Ico name={f.contentType === "application/pdf" ? "file" : "image"} size={14} /> <span className="max-w-[150px] truncate">{f.name}</span><span className="text-[11px] font-normal text-[var(--ink-3)]">{fmtSize(f.size)}</span>
                      <button type="button" aria-label={`Remove ${f.name}`} onClick={() => setFiles(files.filter((x) => x.id !== f.id))} className={`grid h-10 w-10 place-items-center rounded-md text-[var(--ink-3)] hover:text-[var(--red)] ${FOCUS}`}><Ico name="close" size={14} /></button>
                    </span>
                  ))}
                  {files.length < MAX_ATTACH && (
                    <label className={`inline-flex min-h-[44px] lg:min-h-[40px] cursor-pointer items-center gap-1.5 rounded-lg border border-dashed border-[var(--brand-line)] bg-[var(--brand-soft)] px-3 text-[12px] font-bold text-[var(--brand-strong)] hover:border-[var(--brand)] focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[color:var(--brand-2)] ${uploading ? "opacity-60" : ""}`}>
                      {uploading ? "Uploading…" : <><Ico name="plus" size={14} strokeWidth={2.4} />Add a photo or PDF</>}
                      <input id="hub-hw-files" type="file" accept={ACCEPT_FILES} multiple className="sr-only" disabled={uploading} onChange={(e) => { void attach(e.target.files); e.target.value = ""; }} />
                    </label>
                  )}
                </div>
                <p className="mt-1 text-[11px] text-[var(--ink-3)]">PDF or image, up to 700 KB each ({MAX_ATTACH} max).</p>
              </div>
              {linkedAttemptId && <Pill tone="violet" icon={<Ico name="quiz" size={12} />}>Your quiz result will be attached</Pill>}
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="solid" id="hub-hw-submit" className={`min-h-[48px] px-6 text-[14px] ${FOCUS}`} disabled={busy || uploading} onClick={() => void submit()}>{busy ? "Handing in…" : sub.status === "submitted" ? "Update hand-in" : "Hand in homework"}</Button>
                {sub.status === "submitted" && <Button variant="ghost" className={`min-h-[48px] ${FOCUS}`} onClick={() => { setEditing(false); setText(sub.text); setFiles(sub.attachments); }}>Cancel</Button>}
              </div>
              {ds.overdue && sub.status === "assigned" && <p className="text-[11.5px] font-semibold text-[var(--red)]">This is past its due date — it&rsquo;ll be marked as late.</p>}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}


function SummaryTile({ label, n, sub, tone }: { label: string; n: number; sub: string; tone: string }) {
  const v = useCountUp(n, 600);
  return (
    <div className="relative overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-3 pl-4 shadow-[var(--shadow-sm)]">
      <div className="absolute bottom-3 left-0 top-3 w-[3px] rounded-r" style={{ background: tone }} />
      <div className="truncate text-[11px] font-extrabold uppercase tracking-[0.08em] text-[var(--ink-3)]">{label}</div>
      <div className="mt-1 text-[24px] font-extrabold leading-none tabular-nums" style={{ ...DISPLAY, color: tone }}>{v}</div>
      <div className="mt-1 truncate text-[11px] font-semibold text-[var(--ink-3)]">{sub}</div>
    </div>
  );
}
