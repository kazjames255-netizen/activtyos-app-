"use client";

import { useEffect, useState } from "react";
import { Button, FieldLabel, Input } from "@/components/ui";
import { get, put } from "@/lib/api";
import { errMsg, fmtSize } from "../types";
import { Avatar, Dialog, FOCUS, Notice, Pill, ProgressBar, Skeleton, fmtDayTime, withQs } from "../teachKit";
import { Ico } from "../teachIcons";
import { pctOf, type AttemptLite, type HubFile, type InboxRow } from "./hwTypes";

// Tutor: open one hand-in — the writing, the files, any linked quiz result — and
// mark it (score / max + feedback). "Mark & next" walks the queue of hand-ins.

const QUICK = ["Great work — well done!", "Good effort. Have another look at the questions you missed.", "Please redo this and hand it in again."];

function FileTile({ f }: { f: HubFile }) {
  const img = f.contentType.startsWith("image/");
  return (
    <a href={f.url} target="_blank" rel="noopener noreferrer" className={`group block overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--panel)] hover:border-[var(--brand)] ${FOCUS}`}>
      {img && (
        // eslint-disable-next-line @next/next/no-img-element -- short-lived signed API URL, not a static asset
        <img src={f.url} alt={f.name} loading="lazy" className="max-h-[260px] w-full bg-[var(--surface)] object-contain" />
      )}
      <div className="flex min-h-[44px] items-center gap-2 px-3 py-2 text-[12px] font-semibold text-[var(--ink)]">
        <Ico name={img ? "image" : "file"} size={16} className="text-[var(--ink-3)]" />
        <span className="min-w-0 flex-1 truncate">{f.name}</span>
        <span className="text-[11px] font-normal text-[var(--ink-3)]">{fmtSize(f.size)}</span>
        <span className="text-[11px] font-bold text-[var(--brand)] group-hover:underline">Open</span>
      </div>
    </a>
  );
}

export function MarkDialog({ row, hasNext, qs, onClose, onMarked, readOnly = false }: {
  row: InboxRow;
  /** A view-only role can read the hand-in but not mark it. */
  readOnly?: boolean;
  hasNext: boolean;
  qs: string;
  onClose: () => void;
  /** advance = true when the tutor chose "Mark & next". */
  onMarked: (advance: boolean) => void;
}) {
  const [attempt, setAttempt] = useState<AttemptLite | null | undefined>(row.attemptId ? undefined : null);
  const [score, setScore] = useState<string>(row.mark ? String(row.mark.score) : "");
  const [max, setMax] = useState<string>(row.mark ? String(row.mark.max) : "10");
  const [feedback, setFeedback] = useState(row.mark?.feedback ?? "");
  const [busy, setBusy] = useState<"save" | "next" | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!row.attemptId) return;
    let live = true;
    get<AttemptLite>(`/api/learning-hub/attempts/${row.attemptId}${withQs(qs, {})}`).then((a) => {
      if (!live) return;
      setAttempt(a);
      if (!row.mark && a.status === "marked" && a.maxMarks > 0) setMax(String(a.maxMarks));
    }).catch(() => live && setAttempt(null));
    return () => { live = false; };
  }, [row.attemptId, row.mark, qs]);

  const s = Number(score), m = Number(max);
  const valid = score.trim() !== "" && Number.isFinite(s) && Number.isFinite(m) && m > 0 && s >= 0 && s <= m;
  const submit = async (advance: boolean) => {
    if (!valid) { setErr(m > 0 && s > m ? "The score can't be higher than the maximum." : "Enter a score and a maximum."); return; }
    setBusy(advance ? "next" : "save"); setErr(null);
    try {
      await put(`/api/learning-hub/submissions/${row.submissionId}/mark${qs}`, { score: s, max: m, feedback: feedback.trim() });
      onMarked(advance);
    } catch (e) { setErr(errMsg(e, "Couldn't save the mark")); setBusy(null); }
  };

  const handedIn = row.status !== "assigned";
  return (
    <Dialog id="hub-mark-dialog" size="xl" title={row.title}
      subtitle={<span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1"><span className="inline-flex items-center gap-1.5 font-bold text-[var(--ink-2)]"><Avatar name={row.childName} size={18} />{row.childName}</span>{row.submittedAt ? <>· handed in {fmtDayTime(row.submittedAt)}</> : <>· not handed in yet</>}{row.late && <Pill tone="red">Late</Pill>}</span>}
      onClose={onClose}
      footer={<>
        <Button variant="ghost" className={`min-h-[44px] ${FOCUS}`} onClick={onClose}>Close</Button>
        {!readOnly && <Button variant="ghost" className={`min-h-[44px] ${FOCUS}`} disabled={!!busy || !valid} onClick={() => void submit(false)}>{busy === "save" ? "Saving…" : row.status === "marked" ? "Update mark" : "Save mark"}</Button>}
        {!readOnly && hasNext && <Button variant="solid" className={`min-h-[44px] ${FOCUS}`} disabled={!!busy || !valid} onClick={() => void submit(true)}>{busy === "next" ? "Saving…" : "Mark & next →"}</Button>}
      </>}>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <div className="grid content-start gap-4">
          {!handedIn && <Notice tone="gold">This student hasn&rsquo;t handed anything in online. You can still record a mark — handy for paper homework.</Notice>}

          <section>
            <div className="mb-1.5 text-[11px] font-extrabold uppercase tracking-[0.08em] text-[var(--ink-3)]">Their answer</div>
            {row.text.trim() ? (
              <p className="whitespace-pre-wrap break-words rounded-xl border border-[var(--line)] bg-[var(--panel)] px-3.5 py-3 text-[13px] leading-relaxed text-[var(--ink)]">{row.text}</p>
            ) : (
              <p className="rounded-xl border border-dashed border-[var(--line)] px-3.5 py-3 text-[12.5px] text-[var(--ink-3)]">{handedIn ? "No written answer." : "Nothing yet."}</p>
            )}
          </section>

          {row.attachments.length > 0 && (
            <section>
              <div className="mb-1.5 text-[11px] font-extrabold uppercase tracking-[0.08em] text-[var(--ink-3)]">Files ({row.attachments.length})</div>
              <div className="grid gap-2 sm:grid-cols-2">{row.attachments.map((f) => <FileTile key={f.id} f={f} />)}</div>
            </section>
          )}

          {row.attemptId && (
            <section>
              <div className="mb-1.5 text-[11px] font-extrabold uppercase tracking-[0.08em] text-[var(--ink-3)]">Linked quiz</div>
              {attempt === undefined ? <Skeleton className="h-[76px]" /> : attempt === null ? (
                <p className="rounded-xl border border-dashed border-[var(--line)] px-3.5 py-3 text-[12.5px] text-[var(--ink-3)]">Couldn&rsquo;t load the quiz result.</p>
              ) : (
                <div className="rounded-xl border border-[var(--brand-line)] bg-[var(--brand-soft)] px-3.5 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="min-w-0 flex-1 truncate text-[13px] font-extrabold text-[var(--brand-strong)]">{attempt.assessmentTitle || "Quiz"}</span>
                    {attempt.status === "marked" && attempt.pct !== null ? <Pill tone={attempt.passed ? "green" : "gold"}>{attempt.scoreMarks}/{attempt.maxMarks} · {attempt.pct}%</Pill> : <Pill tone="gold">Waiting for marking</Pill>}
                  </div>
                  {attempt.status === "marked" && attempt.pct !== null && <div className="mt-2"><ProgressBar pct={attempt.pct} tone={attempt.passed ? "green" : "brand"} label="Quiz score" /></div>}
                  {attempt.status !== "marked" && <p className="mt-1.5 text-[12px] text-[var(--ink-2)]">Some answers need a tutor&rsquo;s eye — mark them in the Quizzes tab.</p>}
                  {attempt.status === "marked" && (
                    <button type="button" className={`mt-2 min-h-[44px] lg:min-h-[36px] rounded-lg text-[12px] font-bold text-[var(--brand)] hover:underline ${FOCUS}`} onClick={() => { setScore(String(attempt.scoreMarks)); setMax(String(attempt.maxMarks)); }}>Use the quiz score ({attempt.scoreMarks}/{attempt.maxMarks})</button>
                  )}
                </div>
              )}
              {row.attemptPending && attempt?.status === "marked" && <p className="mt-1 text-[11.5px] text-[var(--ink-3)]">Marked just now — refresh if this still says pending.</p>}
            </section>
          )}
        </div>

        <div className="grid content-start gap-3 rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-4">
          <div className="text-[13px] font-extrabold text-[var(--ink)]" style={{ fontFamily: "var(--ff-display)" }}>{row.status === "marked" ? "Your mark" : "Mark this"}</div>
          {err && <Notice onClose={() => setErr(null)}>{err}</Notice>}
          <div className="flex items-end gap-2">
            <div className="min-w-0 flex-1">
              <FieldLabel htmlFor="hub-mark-score">Score</FieldLabel>
              <Input id="hub-mark-score" data-autofocus type="number" inputMode="decimal" min={0} step="any" className="min-h-[44px] w-full" value={score} onChange={(e) => setScore(e.target.value)} />
            </div>
            <span className="pb-3 text-[16px] font-bold text-[var(--ink-3)]" aria-hidden>/</span>
            <div className="min-w-0 flex-1">
              <FieldLabel htmlFor="hub-mark-max">Out of</FieldLabel>
              <Input id="hub-mark-max" type="number" inputMode="decimal" min={1} step="any" className="min-h-[44px] w-full" value={max} onChange={(e) => setMax(e.target.value)} />
            </div>
          </div>
          {valid && <div><ProgressBar pct={pctOf({ score: s, max: m })} tone="green" label="Mark" /><div className="mt-1 text-right text-[11.5px] font-bold text-[var(--ink-3)]">{pctOf({ score: s, max: m })}%</div></div>}
          <div>
            <FieldLabel htmlFor="hub-mark-feedback">Feedback</FieldLabel>
            <textarea id="hub-mark-feedback" rows={5} maxLength={4000} value={feedback} onChange={(e) => setFeedback(e.target.value)} placeholder="What went well? What to work on next?"
              className="w-full resize-y rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2.5 py-2 text-[13px] leading-relaxed text-[var(--ink)] outline-none focus:border-[var(--brand)]" />
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {QUICK.map((q) => (
                <button key={q} type="button" onClick={() => setFeedback((f) => (f.trim() ? `${f.trim()} ${q}` : q))} className={`min-h-[44px] lg:min-h-[34px] rounded-full border border-[var(--line)] bg-[var(--surface)] px-2.5 text-[11.5px] font-semibold text-[var(--ink-2)] hover:border-[var(--brand)] ${FOCUS}`}>+ {q.length > 28 ? `${q.slice(0, 26)}…` : q}</button>
              ))}
            </div>
          </div>
          <p className="text-[11.5px] leading-snug text-[var(--ink-3)]">The family is notified when you save.</p>
        </div>
      </div>
    </Dialog>
  );
}
