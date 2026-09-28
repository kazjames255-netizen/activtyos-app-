"use client";

import { useEffect, useState, type ReactNode } from "react";
import { get } from "@/lib/api";
import type { HubSettings } from "@/lib/hubConfig";
import { errMsg, type Note, type Topic } from "../types";
import { Dialog, FOCUS, Skeleton } from "../teachKit";
import { Ico } from "../teachIcons";
import type { WorksheetRef } from "./hwTypes";
import { useHw } from "./hwI18n";
import { LessonPlayer } from "../lesson/LessonPlayer";
import { hubPath, type Assessment, type Question } from "../shared-assess/api";

// Read-only previews for the tutor's homework screens. Each is a `Dialog` (z-[400], rendered in its own portal AFTER the caller's),
// so it stacks above the Set homework dialog, registers on the escape stack last (Esc closes only it) and leaves the caller mounted.

/** Small "Preview" button used on lesson rows / chips / quiz picker. */
export function PreviewButton({ label, onClick, children, testId, disabled }: { label: string; onClick: () => void; children?: string; testId?: string; disabled?: boolean }) {
  const { h } = useHw();
  return (
    <button type="button" aria-label={label} data-testid={testId} disabled={disabled} onClick={(e) => { e.preventDefault(); e.stopPropagation(); onClick(); }}
      className={`inline-flex min-h-[44px] flex-none items-center rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 text-[12.5px] font-extrabold text-[var(--brand)] hover:border-[var(--brand)] disabled:cursor-not-allowed disabled:opacity-50 ${FOCUS}`}>{children ?? h("preview")}</button>
  );
}

const yearOf = (t?: Topic) => { const m = /(\d{1,2})/.exec(t?.subtopic ?? ""); return m ? Number(m[1]) : null; };

export function LessonPreviewDialog({ noteId, title, qs, config, topics, onClose }: { noteId: string; title?: string; qs: string; config: HubSettings; topics: Topic[]; onClose: () => void }) {
  const { h } = useHw();
  const [note, setNote] = useState<Note | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    get<Note>(`/api/learning-hub/notes/${encodeURIComponent(noteId)}${qs}`).then((n) => { if (live) setNote(n); }).catch((e) => { if (live) setErr(errMsg(e, h("errPreview"))); });
    return () => { live = false; };
  }, [noteId, qs]);
  const topic = note ? topics.find((t) => t.id === note.topicId) : undefined;
  return (
    <Dialog id="hub-hw-lesson-preview" plain size="xl" title={h("prevTitle", { title: note?.title ?? title ?? h("lesson") })} subtitle={h("prevSub")} onClose={onClose}>
      <div data-testid="hub-hw-lesson-preview">
        {err ? <p role="alert" className="text-[13px] text-[var(--red)]">{err}</p>
          : !note ? <Skeleton className="h-[240px]" />
          : note.lesson ? (
            <LessonPlayer note={{ id: note.id, title: note.title, lesson: note.lesson }} qs={qs} childQs={qs} childId={null} config={config}
              readOnly hideAskTeacher subject={topic?.subject} year={yearOf(topic)} onExit={onClose} />
          ) : (
            <div className="grid gap-3">
              <p className="whitespace-pre-wrap text-[14px] leading-relaxed text-[var(--ink)]">{note.body || h("noText")}</p>
              {(note.attachments ?? []).length > 0 && <ul className="m-0 grid list-none gap-1 p-0 text-[12.5px] text-[var(--ink-2)]">{note.attachments.map((a) => <li key={a.id}>{h("attachment", { name: a.name })}</li>)}</ul>}
            </div>
          )}
      </div>
    </Dialog>
  );
}

const CORRECT = "border-[var(--green)] bg-[var(--green-soft)]";
export function QuizPreviewDialog({ assessmentId, title, qs, onClose }: { assessmentId: string; title?: string; qs: string; onClose: () => void }) {
  const { h, hp } = useHw();
  const [data, setData] = useState<{ a: Assessment; qs: Question[] } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const a = await get<Assessment>(`/api/learning-hub/assessments/${encodeURIComponent(assessmentId)}${qs}`);
        const full = await Promise.all((a.questionIds ?? []).map((id) => get<Question>(hubPath(qs, `/questions/${id}`)).catch(() => null)));
        if (live) setData({ a, qs: full.filter((x): x is Question => !!x) });
      } catch (e) { if (live) setErr(errMsg(e, h("errPreview"))); }
    })();
    return () => { live = false; };
  }, [assessmentId, qs]);
  const total = data?.qs.reduce((s, q) => s + (q.marks || 0), 0) ?? 0;
  return (
    <Dialog id="hub-hw-quiz-preview" plain size="xl" title={h("quizTitle", { title: data?.a.title ?? title ?? "" })}
      subtitle={data ? h("quizSub", { q: hp("nQuestions", data.qs.length), marks: hp("nMarks", total) }) : undefined} onClose={onClose}>
      <div data-testid="hub-hw-quiz-preview">
        {err ? <p role="alert" className="text-[13px] text-[var(--red)]">{err}</p>
          : !data ? <Skeleton className="h-[240px]" />
          : data.qs.length === 0 ? <p className="text-[13px] text-[var(--ink-3)]">{h("quizEmpty")}</p>
          : (
            <ol className="m-0 grid list-none gap-3 p-0">
              {data.qs.map((q, i) => {
                const ans = Array.isArray(q.answer) ? q.answer : typeof q.answer === "string" ? [q.answer] : [];
                return (
                  <li key={q.id} data-ui="card" className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4">
                    <div className="flex flex-wrap items-center gap-2 text-[11.5px] font-bold text-[var(--ink-3)]">
                      <span className="text-[var(--ink)]">{h("qShort", { n: i + 1 })}</span><span>{q.kind}</span><span>{hp("nMarks", q.marks)}</span>
                    </div>
                    <p className="mt-1 whitespace-pre-wrap text-[14px] font-bold text-[var(--ink)]">{q.prompt}</p>
                    {q.image?.url && /* eslint-disable-next-line @next/next/no-img-element */ <img src={q.image.url} alt={q.image.alt ?? ""} className="mt-2 max-h-[220px] rounded-xl border border-[var(--line)]" />}
                    {q.options?.length > 0 && (
                      <ul className="m-0 mt-2 grid list-none gap-1.5 p-0">
                        {q.options.map((o) => {
                          const ok = ans.includes(o.id);
                          return (
                            <li key={o.id} className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-[13px] text-[var(--ink)] ${ok ? CORRECT : "border-[var(--line)]"}`}>
                              {o.image?.url && /* eslint-disable-next-line @next/next/no-img-element */ <img src={o.image.url} alt={o.image.alt ?? ""} className="h-10 w-10 rounded object-cover" />}
                              <span className="min-w-0 flex-1">{o.text}</span>
                              {ok && <span className="text-[11px] font-extrabold text-[var(--green)]">{h("correct")}</span>}
                            </li>
                          );
                        })}
                      </ul>
                    )}
                    {(q.pairs?.length ?? 0) > 0 && <ul className="m-0 mt-2 grid list-none gap-1 p-0 text-[13px] text-[var(--ink)]">{q.pairs!.map((p, k) => <li key={k}>{p.term} ↔ {p.definition}</li>)}</ul>}
                    {(q.items?.length ?? 0) > 0 && <ol className="m-0 mt-2 ps-5 text-[13px] text-[var(--ink)]">{q.items!.map((it, k) => <li key={k}>{it}</li>)}</ol>}
                    {(typeof q.answer === "string" && !q.options?.length || typeof q.answer === "number") && <p className="mt-2 text-[13px] text-[var(--ink)]"><span className="font-extrabold text-[var(--green)]">{h("answerLabel")}:</span> {String(q.answer)}{q.acceptedAnswers?.length ? ` (${h("also", { list: q.acceptedAnswers.join(", ") })})` : ""}</p>}
                    {q.explanation && <p className="mt-2 text-[12.5px] text-[var(--ink-2)]">{q.explanation}</p>}
                  </li>
                );
              })}
            </ol>
          )}
      </div>
    </Dialog>
  );
}

/** The worksheet PDF (short-lived signed URL, embedded) + a download link; when it has an interactive quiz, that can be previewed on top. */
export function WorksheetPreviewDialog({ noteId, title, quizId, qs, onClose }: { noteId: string; title?: string; quizId?: string; qs: string; onClose: () => void }) {
  const { h } = useHw();
  const [ws, setWs] = useState<{ url: string; name: string; quizId?: string } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [quiz, setQuiz] = useState(false);
  useEffect(() => {
    let live = true;
    get<{ url: string; name: string; quizId?: string }>(`/api/learning-hub/notes/${encodeURIComponent(noteId)}/worksheet${qs}`).then((r) => { if (live) setWs(r); }).catch((e) => { if (live) setErr(errMsg(e, h("errWorksheet"))); });
    return () => { live = false; };
  }, [noteId, qs]);
  const qid = ws?.quizId ?? quizId;
  return (
    <>
      <Dialog id="hub-hw-worksheet-preview" plain size="xl" title={h("wsTitle", { title: title ?? "" })}
        subtitle={qid ? h("wsSubInteractive") : h("wsSubPdf")} onClose={onClose}>
        <div data-testid="hub-hw-worksheet-preview" className="grid gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {qid && <PreviewButton label={h("prevInteractive")} testId="hub-hw-ws-quiz-btn" onClick={() => setQuiz(true)}>{h("prevInteractive")}</PreviewButton>}
            {ws && <a href={ws.url} target="_blank" rel="noopener noreferrer" download={ws.name} className={`inline-flex min-h-[44px] items-center gap-1.5 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 text-[12.5px] font-extrabold text-[var(--brand)] hover:border-[var(--brand)] ${FOCUS}`}><Ico name="file" size={14} />{h("openPdf")}</a>}
          </div>
          {err ? <p role="alert" className="text-[13px] text-[var(--red)]">{err}</p> : !ws ? <Skeleton className="h-[320px]" /> : (
            <>
              {/* Phones (iOS Safari especially) show a blank frame for an embedded PDF: offer open / download instead, embed from md up. */}
              <p className="m-0 rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 text-[13px] text-[var(--ink-2)] md:hidden">{h("pdfPhone")}</p>
              <object data={ws.url} type="application/pdf" aria-label={h("wsPdfAria", { title: ws.name })} className="hidden h-[65dvh] w-full rounded-xl border border-[var(--line)] md:block">
                <p className="p-4 text-[13px] text-[var(--ink-2)]">{h("pdfNoEmbed")} <a className="font-extrabold text-[var(--brand)] underline" href={ws.url} target="_blank" rel="noopener noreferrer">{h("openNewTab")}</a>.</p>
              </object>
            </>
          )}
        </div>
      </Dialog>
      {quiz && qid && <QuizPreviewDialog assessmentId={qid} title={title} qs={qs} onClose={() => setQuiz(false)} />}
    </>
  );
}

/** Read-only "what is linked" rows for a homework: legacy lesson / quiz / flashcards (view + optionally remove) and lesson worksheets. */
export function LinkedRows({ label, quizId, quizTitle, notes, hasFlash, worksheets, onPreview, onRemoveQuiz, onRemoveNote, onRemoveFlash }: {
  label?: string; quizId?: string | null; quizTitle?: string; notes?: { id: string; title?: string }[]; hasFlash?: boolean; worksheets?: WorksheetRef[];
  onPreview: (p: { kind: "note" | "quiz" | "worksheet"; id: string; title?: string; quizId?: string }) => void;
  onRemoveQuiz?: () => void; onRemoveNote?: (id: string) => void; onRemoveFlash?: () => void;
}) {
  const { h } = useHw();
  const rm = (what: string, fn?: () => void) => fn && <button type="button" aria-label={h("removeAria", { what })} onClick={fn} className={`grid h-11 w-11 place-items-center rounded-lg text-[var(--ink-3)] hover:text-[var(--red)] ${FOCUS}`}>×</button>;
  const row = (key: string, icon: "quiz" | "notes" | "cards" | "file", text: string, actions: ReactNode) => (
    <div key={key} data-ui="card" data-testid={icon === "notes" ? "hub-hw-attached-lessons" : undefined} className="flex min-h-[48px] items-center gap-2 rounded-xl border border-[var(--line)] bg-[var(--surface)] py-1 ps-3 pe-1">
      <Ico name={icon} size={15} className="flex-none text-[var(--ink-3)]" /><span className="min-w-0 flex-1 truncate text-[13px] font-bold text-[var(--ink)]">{text}</span>{actions}
    </div>
  );
  return (
    <div className="grid gap-1.5" data-testid="hub-hw-linked-rows">
      {label && <div className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-[var(--ink-3)]">{label}</div>}
      {quizId && row("quiz", "quiz", quizTitle ? h("rowQuizTitled", { title: quizTitle }) : h("quiz"), <><PreviewButton label={h("viewQuiz")} testId="hub-hw-view-quiz" onClick={() => onPreview({ kind: "quiz", id: quizId, title: quizTitle })}>{h("viewQuiz")}</PreviewButton>{rm(h("quiz"), onRemoveQuiz)}</>)}
      {(notes ?? []).map((n, i) => row(`n${n.id}`, "notes", h("rowLesson", { title: n.title ?? h("lessonN", { n: i + 1 }) }), <><PreviewButton label={h("viewLessonAria", { title: n.title ?? String(i + 1) })} testId="hub-hw-view-lesson" onClick={() => onPreview({ kind: "note", id: n.id, title: n.title })}>{h("viewLesson")}</PreviewButton>{rm(h("rowLesson", { title: n.title ?? "" }), onRemoveNote && (() => onRemoveNote(n.id)))}</>))}
      {(worksheets ?? []).map((w) => row(`w${w.noteId}`, "file", `${h("rowWorksheet", { title: w.title })} · ${w.quizId ? h("interactive") : h("pdf")}`, <PreviewButton label={h("viewWsAria", { title: w.title })} testId="hub-hw-view-worksheet" onClick={() => onPreview({ kind: "worksheet", id: w.noteId, title: w.title, quizId: w.quizId })}>{h("viewWorksheet")}</PreviewButton>))}
      {hasFlash && row("flash", "cards", h("flashRevise"), rm(h("flashcards"), onRemoveFlash))}
    </div>
  );
}
