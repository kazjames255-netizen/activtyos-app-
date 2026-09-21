"use client";

import { useMemo, useState } from "react";
import { Button, Card } from "@/components/ui";
import { put } from "@/lib/api";
import type { PanelProps } from "../panelTypes";
import { errMsg } from "../types";
import { hubPath, type AttemptRow, type Assessment, type Result, type ResultAnswer } from "../shared-assess/api";
import { NEUTRAL, timeAgo } from "../shared-assess/format";
import { useHubData } from "../shared-assess/hooks";
import { QImage } from "../shared-assess/QuestionImage";
import { Chip, display, EmptyState, FOCUS, ListSkeleton, Notice, TAP } from "../shared-assess/ui";

// Written answers waiting for a tutor: read each one, award marks, add
// feedback, save. Marking updates the student's mastery server-side.

export function MarkingQueue({ p, rows, assessments, loading, reload }: { p: PanelProps; rows: AttemptRow[] | null; assessments: Assessment[]; loading: boolean; reload: () => void }) {
  const [open, setOpen] = useState<string | null>(null);
  const names = useMemo(() => new Map(p.students.map((s) => [s.childId, s.childName])), [p.students]);
  const titles = useMemo(() => new Map(assessments.map((a) => [a.id, a.title])), [assessments]);
  if (open) return <MarkForm p={p} attemptId={open} onBack={() => { setOpen(null); reload(); }} onSaved={() => { const i = (rows ?? []).findIndex((r) => r.id === open); const next = (rows ?? [])[i + 1] ?? (rows ?? []).find((r) => r.id !== open); reload(); setOpen(next && next.id !== open ? next.id : null); }} hasNext={(rows ?? []).length > 1} />;
  if (loading && !rows) return <ListSkeleton rows={3} label="Loading the marking queue" />;
  if (!rows?.length) return <EmptyState icon="🎉" title="Nothing waiting to be marked" body="When a student hands in a quiz or placement test with written answers, it lands here." />;
  return (
    <div className="grid gap-2" data-testid="hub-marking-queue">
      {rows.map((r) => (
        <Card key={r.id} className="p-0">
          <button type="button" onClick={() => setOpen(r.id)} className={`flex min-h-[64px] w-full items-center gap-3 rounded-2xl p-4 text-left hover:bg-[var(--panel)]/60 ${FOCUS}`} data-testid="hub-marking-row">
            <span className="grid h-10 w-10 flex-none place-items-center rounded-full bg-[var(--brand-soft)] text-[14px] font-extrabold text-[var(--brand-strong)]" aria-hidden>{(r.childName ?? names.get(r.childId) ?? "?").slice(0, 1).toUpperCase()}</span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[14px] font-extrabold text-[var(--ink)]" style={display}>{r.childName ?? names.get(r.childId) ?? "Student"}</span>
              <span className="block truncate text-[12.5px] text-[var(--ink-3)]">{r.assessmentTitle ?? titles.get(r.assessmentId) ?? "Assessment"} · handed in {timeAgo(r.submittedAt)}{(r.autoMax ?? 0) > 0 && r.autoMarks != null ? ` · auto-marked ${r.autoMarks}/${r.autoMax}` : ""}{r.writtenPending ? ` · ${r.writtenPending} written to mark` : ""}</span>
            </span>
            <Chip tone={NEUTRAL}>Mark →</Chip>
          </button>
        </Card>
      ))}
    </div>
  );
}

function MarkForm({ p, attemptId, onBack, onSaved, hasNext }: { p: PanelProps; attemptId: string; onBack: () => void; onSaved: () => void; hasNext: boolean }) {
  const { data, loading, error, reload } = useHubData<Result>(hubPath(p.qs, `/attempts/${attemptId}`));
  const [marks, setMarks] = useState<Record<string, string>>({});
  const [fb, setFb] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (loading && !data) return <ListSkeleton rows={2} label="Loading the answers" />;
  if (!data) return <Notice action={<button type="button" onClick={onBack} className="min-h-[44px] rounded-lg px-2 text-[12px] font-extrabold underline">Back</button>}>{error ?? "Couldn't open that attempt."}</Notice>;

  const isTodo = (a: ResultAnswer) => a.pending ?? a.correct === null;
  const todo = data.answers.filter(isTodo);
  const done = data.answers.filter((a) => !isTodo(a));
  const ready = todo.every((a) => marks[a.questionId] !== undefined && marks[a.questionId] !== "" && Number(marks[a.questionId]) >= 0 && Number(marks[a.questionId]) <= a.marksMax);
  const name = data.childName ?? p.students.find((s) => s.childId === data.childId)?.childName ?? "Student";

  const save = async () => {
    setBusy(true); setErr(null);
    try {
      await put(hubPath(p.qs, `/attempts/${attemptId}/mark`), { answers: todo.map((a) => ({ questionId: a.questionId, marksAwarded: Number(marks[a.questionId]), ...(fb[a.questionId]?.trim() ? { feedback: fb[a.questionId].trim() } : {}) })) });
      onSaved();
    } catch (e) { setErr(errMsg(e, "Couldn't save the marks")); }
    finally { setBusy(false); }
  };

  return (
    <div className="grid gap-3" data-testid="hub-mark-form">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={onBack} className={`inline-flex min-h-[44px] items-center rounded-lg pr-3 text-[13px] font-bold text-[var(--ink-2)] hover:text-[var(--brand)] ${FOCUS}`}>← Queue</button>
        <div className="text-[16px] font-extrabold text-[var(--ink)]" style={display}>{name}{data.assessmentTitle ? <span className="font-semibold text-[var(--ink-3)]"> · {data.assessmentTitle}</span> : null}</div>
      </div>
      {err && <Notice onDismiss={() => setErr(null)}>{err}</Notice>}
      {todo.map((a, i) => <MarkItem key={a.questionId} i={i} a={a} onRefresh={reload} v={marks[a.questionId] ?? ""} fb={fb[a.questionId] ?? ""} setV={(v) => setMarks((m) => ({ ...m, [a.questionId]: v }))} setFb={(v) => setFb((m) => ({ ...m, [a.questionId]: v }))} />)}
      {done.length > 0 && <p className="m-0 px-1 text-[12.5px] text-[var(--ink-3)]">{done.length} other {done.length === 1 ? "answer was" : "answers were"} marked automatically.</p>}
      <div className="sticky bottom-0 flex flex-wrap items-center justify-end gap-2 rounded-2xl border border-[var(--line)] bg-[var(--surface)]/95 p-3 shadow-[var(--shadow)] backdrop-blur">
        {p.readOnly ? <span className="mr-auto text-[12px] font-semibold text-[var(--ink-3)]">View only — you can read this but not mark it.</span> : <>
        {!ready && <span className="mr-auto text-[12px] font-semibold text-[var(--ink-3)]">Award marks for every written answer to save.</span>}
        <Button variant="solid" className={`${TAP} !px-6`} disabled={!ready || busy} onClick={save} data-testid="hub-save-marks">{busy ? "Saving…" : hasNext ? "Save and next" : "Save marks"}</Button></>}
      </div>
    </div>
  );
}

function MarkItem({ a, i, v, fb, setV, setFb, onRefresh }: { a: ResultAnswer; i: number; onRefresh?: () => Promise<unknown> | void; v: string; fb: string; setV: (v: string) => void; setFb: (v: string) => void }) {
  return (
    <Card className="p-4">
      <div className="flex items-start gap-3">
        <span className="grid h-7 w-7 flex-none place-items-center rounded-full bg-[var(--brand-soft)] text-[12px] font-extrabold text-[var(--brand-strong)]" aria-hidden>{i + 1}</span>
        <div className="min-w-0 flex-1">
          <div className="whitespace-pre-wrap text-[14.5px] font-bold leading-snug text-[var(--ink)] [overflow-wrap:anywhere]">{a.prompt ?? "Question"}</div>
          {a.image?.url && <div className="mt-2.5 max-w-[420px]"><QImage pic={a.image} onRefresh={onRefresh} /></div>}
          <div className="mt-2.5 rounded-xl bg-[var(--panel)] px-3.5 py-3">
            <div className="text-[11px] font-extrabold uppercase tracking-[0.06em] text-[var(--ink-3)]">Student&apos;s answer</div>
            <div className="mt-1 whitespace-pre-wrap text-[14px] leading-relaxed text-[var(--ink)] [overflow-wrap:anywhere]">{typeof a.response === "string" && a.response ? a.response : <em className="text-[var(--ink-3)]">No answer given</em>}</div>
          </div>
          {a.correctAnswer != null && a.correctAnswer !== "" && <div className="mt-2 rounded-xl border border-[var(--green-line)] bg-[var(--green-soft)] px-3.5 py-2 text-[12.5px] text-[var(--ink)]"><b>Model answer:</b> {String(a.correctAnswer)}</div>}
          {a.explanation && <div className="mt-2 text-[12.5px] text-[var(--ink-3)]"><b>Explanation:</b> {a.explanation}</div>}
          <div className="mt-3 grid gap-3 sm:grid-cols-[150px_1fr]">
            <div>
              <label htmlFor={`m-${a.questionId}`} className="mb-1 block text-[11px] font-extrabold uppercase tracking-[0.04em] text-[var(--ink-3)]">Marks (out of {a.marksMax})</label>
              <div className="flex items-center gap-1.5">
                <input id={`m-${a.questionId}`} type="number" min={0} max={a.marksMax} step={1} inputMode="numeric" value={v} onChange={(e) => setV(e.target.value)} data-testid="hub-marks-input"
                  className="min-h-[44px] w-[76px] rounded-lg border-2 border-[var(--line)] bg-[var(--surface)] px-3 text-[15px] font-extrabold tabular-nums text-[var(--ink)] outline-none focus:border-[var(--brand)]" />
                <button type="button" onClick={() => setV(String(a.marksMax))} className={`min-h-[44px] rounded-lg px-2 text-[11.5px] font-extrabold text-[var(--brand)] hover:bg-[var(--brand-soft)] ${FOCUS}`}>Full</button>
                <button type="button" onClick={() => setV("0")} className={`min-h-[44px] rounded-lg px-2 text-[11.5px] font-extrabold text-[var(--ink-3)] hover:bg-[var(--panel)] ${FOCUS}`}>Zero</button>
              </div>
            </div>
            <div>
              <label htmlFor={`f-${a.questionId}`} className="mb-1 block text-[11px] font-extrabold uppercase tracking-[0.04em] text-[var(--ink-3)]">Feedback <span className="normal-case tracking-normal">(optional, the student sees this)</span></label>
              <textarea id={`f-${a.questionId}`} rows={2} value={fb} onChange={(e) => setFb(e.target.value)} placeholder="What went well, what to work on…" className="w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-[13.5px] leading-relaxed text-[var(--ink)] outline-none focus:border-[var(--brand)]" />
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}
