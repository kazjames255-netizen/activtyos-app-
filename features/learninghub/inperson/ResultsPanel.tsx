"use client";

import { useMemo, useState } from "react";
import { Icon } from "../kit";
import { Btn, StepCard, Tag, display } from "../lesson/lessonUi";
import { FOCUS } from "../teachKit";
import { nameFor } from "./inKit";
import type { IpResult, IpSession, IpWarm } from "./api";
import type { ClassStore } from "./useClassState";

// The end of a class: every child's result at a glance (child × question, green / red), who is here, the oral warm-up tallies, an
// optional follow-up homework (the Homework form opens pre-filled), and "Finish" which closes the session and tells the families.

export function warmTally(store: ClassStore): IpWarm[] {
  return Object.entries(store.state.warm).map(([childId, m]) => ({ childId, correct: Object.values(m).filter((v) => v === true).length, total: Object.values(m).length })).filter((w) => w.total > 0);
}

export function ResultsPanel({ session, students, quizTitle, hasQuiz, passMark, store, hideNames, retry, toggleHere, followUp, finish, finishing }: {
  session: IpSession; students: { childId: string; childName: string; present: boolean }[]; quizTitle: string | null; hasQuiz: boolean; passMark: number | null;
  store: ClassStore; hideNames: boolean; retry: (childId: string) => Promise<void>; toggleHere: (childId: string, here: boolean) => void;
  followUp?: (childIds: string[]) => void; finish: () => void; finishing: boolean;
}) {
  const results = store.state.results;
  const rows = students.filter((s) => s.present || results[s.childId]);
  const recorded = rows.map((s) => results[s.childId]).filter((r): r is IpResult => !!r && r.status !== "skipped" && typeof r.pct === "number");
  const avg = recorded.length ? Math.round(recorded.reduce((n, r) => n + (r.pct ?? 0), 0) / recorded.length) : null;
  const cols = Math.max(0, ...recorded.map((r) => r.answers?.length ?? 0));
  const hardest = useMemo(() => {
    if (!recorded.length || !cols) return null;
    let worst = -1, worstGot = Infinity;
    for (let i = 0; i < cols; i++) {
      const got = recorded.filter((r) => r.answers?.[i]?.correct === true).length;
      if (got < worstGot) { worstGot = got; worst = i; }
    }
    return worst >= 0 && worstGot < recorded.length ? { n: worst + 1, got: worstGot } : null;
  }, [recorded, cols]);
  const weak = rows.filter((s) => { const r = results[s.childId]; return r && r.status !== "skipped" && r.passed === false; }).map((s) => s.childId);
  const warm = warmTally(store);
  const [busyRetry, setBusyRetry] = useState<string | null>(null);

  return (
    <StepCard>
      <Tag tone="brand">In-person lesson</Tag>
      <h2 className="m-0 mb-1 mt-2 text-[24px] font-extrabold text-[var(--ink)]" style={display} tabIndex={-1} data-autofocus>{hasQuiz ? "Results" : "Lesson complete"}</h2>
      <p className="m-0 text-[14px] text-[var(--ink-2)]" data-testid="ip-summary-title">
        {session.title}{quizTitle ? ` · ${quizTitle}` : ""}{avg !== null ? <> · class average <b className="text-[var(--ink)]">{avg}%</b></> : null}{hardest ? <> · hardest: question {hardest.n} ({hardest.got} of {recorded.length} got it)</> : null}
      </p>

      {hasQuiz && (
        <div className="mt-4 overflow-x-auto rounded-2xl border border-[var(--line)]">
          <table className="w-full border-collapse text-[14px]" data-testid="ip-results">
            <thead>
              <tr className="bg-[var(--panel)] text-left text-[11.5px] font-extrabold uppercase tracking-[0.05em] text-[var(--ink-3)]">
                <th className="px-2.5 py-2 sm:px-3">Child</th>
                {Array.from({ length: cols }, (_, i) => <th key={i} className="px-0.5 py-2 text-center sm:px-1.5">Q{i + 1}</th>)}
                <th className="px-2.5 py-2 text-right sm:px-3">Score</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => {
                const r = results[s.childId];
                const name = nameFor(s.childName, hideNames);
                return (
                  <tr key={s.childId} className="border-t border-[var(--line)]" data-result-row={s.childName} data-result-status={r?.status ?? "none"}>
                    <td className="px-2.5 py-2.5 font-extrabold text-[var(--ink)] sm:px-3">{name}</td>
                    {r && r.status !== "skipped" ? (
                      <>
                        {Array.from({ length: cols }, (_, i) => {
                          const a = r.answers?.[i];
                          return (
                            <td key={i} className="px-0.5 py-2.5 text-center sm:px-1.5" data-q={i + 1} data-correct={a ? String(a.correct) : "none"}>
                              {!a ? "" : a.pending ? <span title="Waiting for marks" className="text-[var(--ink-3)]">…</span> : a.correct ? <span className="text-[var(--hub-green-ink)]" aria-label="Correct"><Icon name="check" size={16} strokeWidth={3} /></span> : <span className="text-[var(--red)]" aria-label="Not correct"><Icon name="close" size={16} strokeWidth={3} /></span>}
                            </td>
                          );
                        })}
                        <td className="px-2.5 py-2.5 text-right font-extrabold tabular-nums text-[var(--ink)] sm:px-3" data-score>
                          <span className="whitespace-nowrap">{r.scoreMarks}/{r.maxMarks}{typeof r.pct === "number" ? ` · ${r.pct}%` : ""}</span>
                          <span className="mt-1 flex flex-wrap justify-end gap-1 text-[11px]">
                            {r.attemptStatus === "pending_marking" && <span className="rounded-full bg-[var(--panel)] px-2 py-0.5 text-[var(--ink-3)]">written to mark</span>}
                            {r.passed === false && <span className="rounded-full bg-[var(--red-soft)] px-2 py-0.5 text-[var(--red)]">{passMark !== null ? `under ${passMark}%` : "under the pass mark"}</span>}
                            {r.homeworkId && <span className="rounded-full bg-[var(--green-soft)] px-2 py-0.5 text-[var(--hub-green-ink)]">homework ticked off</span>}
                          </span>
                        </td>
                      </>
                    ) : (
                      <td colSpan={cols + 1} className="px-3 py-2.5 text-right text-[13px] text-[var(--ink-2)]">
                        {r ? (
                          <span className="inline-flex flex-wrap items-center justify-end gap-2">
                            <span role="alert">{r.message ?? "Not recorded."}</span>
                            {r.code && ["retake_blocked", "diagnostic_required", "not_for_this_child"].includes(r.code) && (
                              <button type="button" disabled={busyRetry === s.childId} data-testid={`ip-allow-${s.childName}`} onClick={async () => { setBusyRetry(s.childId); await retry(s.childId); setBusyRetry(null); }}
                                className={`min-h-[44px] lg:min-h-[40px] rounded-lg border-2 border-[var(--brand)] px-3 text-[12.5px] font-extrabold text-[var(--brand)] disabled:opacity-50 ${FOCUS}`}>{busyRetry === s.childId ? "Recording…" : "Allow anyway"}</button>
                            )}
                          </span>
                        ) : <span className="text-[var(--ink-3)]">No answers recorded</span>}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {warm.length > 0 && (
        <p className="m-0 mt-3 text-[13.5px] text-[var(--ink-2)]" data-testid="ip-warm-summary"><b className="text-[var(--ink)]">Warm-up (out loud):</b> {warm.map((w) => `${nameFor(students.find((s) => s.childId === w.childId)?.childName ?? "", hideNames)} ${w.correct}/${w.total}`).join(" · ")}</p>
      )}

      <div className="mt-5">
        <div className="mb-1.5 text-[12px] font-extrabold uppercase tracking-[0.06em] text-[var(--ink-3)]">Here today</div>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Attendance">
          {students.map((s) => (
            <button key={s.childId} type="button" aria-pressed={s.present} onClick={() => toggleHere(s.childId, !s.present)} data-testid={`ip-here-${s.childName}`}
              className={`inline-flex min-h-[44px] items-center gap-1.5 rounded-full border-2 px-3.5 text-[13.5px] font-extrabold ${FOCUS} ${s.present ? "border-[var(--green)] bg-[var(--green-soft)] text-[var(--hub-green-ink)]" : "border-[var(--line)] bg-[var(--surface)] text-[var(--ink-3)] line-through"}`}>
              {s.present && <Icon name="check" size={14} strokeWidth={3} />}{nameFor(s.childName, hideNames)}
            </button>
          ))}
        </div>
      </div>

      {followUp && (
        <div className="mt-5 rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-3.5">
          <div className="mb-2 text-[13.5px] font-extrabold text-[var(--ink)]">Follow-up homework</div>
          <div className="flex flex-wrap gap-2">
            {weak.length > 0 && <Btn tone="ghost" onClick={() => followUp(weak)} data-testid="ip-followup-weak">Set for the {weak.length} under the pass mark</Btn>}
            <Btn tone="ghost" onClick={() => followUp(rows.filter((s) => s.present).map((s) => s.childId))} data-testid="ip-followup-all">Set for everyone here</Btn>
          </div>
          <p className="m-0 mt-2 text-[12px] text-[var(--ink-3)]">Finishes this session and opens the Homework form with these children and this lesson filled in.</p>
        </div>
      )}

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <span className="text-[12.5px] text-[var(--ink-3)]">Finishing tells each family their child did this lesson with you.</span>
        <Btn tone="good" onClick={finish} disabled={finishing} data-testid="ip-finish">{finishing ? "Finishing…" : "Finish session"}</Btn>
      </div>
    </StepCard>
  );
}
