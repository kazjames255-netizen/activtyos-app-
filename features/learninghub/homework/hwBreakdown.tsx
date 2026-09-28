"use client";

import { useEffect, useRef, useState } from "react";
import { get } from "@/lib/api";
import type { Result } from "../shared-assess/api";
import { FOCUS, Skeleton, withQs } from "../teachKit";
import { useHw, type Hw } from "./hwI18n";

// A marked quiz / worksheet attempt, question by question: a left rail (Q1 3/4 ... running Total), and the chosen question's
// prompt, the child's answer, the model answer (tutor view) and its marks in a small green bracket [n].

export const showAnswer = (x: Hw, v: unknown): string => {
  if (v == null || v === "") return x.h("noAnswer");
  if (Array.isArray(v)) return v.map((y) => showAnswer(x, y)).join(", ");
  if (typeof v === "object") { const o = v as { pairs?: { term: string; definition: string }[]; items?: string[]; text?: string }; return o.pairs ? o.pairs.map((p) => `${p.term} ↔ ${p.definition}`).join("; ") : o.items ? o.items.join(" → ") : o.text ?? JSON.stringify(v); }
  return String(v);
};

/** Load one attempt's result (prompts + answers). */
export function useAttemptResult(attemptId: string, qs: string): Result | null | undefined {
  const [res, setRes] = useState<Result | null | undefined>(undefined);
  useEffect(() => {
    let live = true;
    setRes(undefined);
    get<Result>(`/api/learning-hub/attempts/${attemptId}${withQs(qs, {})}`).then((r) => live && setRes(r)).catch(() => live && setRes(null));
    return () => { live = false; };
  }, [attemptId, qs]);
  return res;
}

/** Arrow-key roving for a vertical/horizontal tablist: only the selected tab is a tab stop. */
export function useRoving(count: number, sel: number, setSel: (i: number) => void) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const onKeyDown = (e: React.KeyboardEvent) => {
    let n = sel;
    if (e.key === "ArrowDown" || e.key === "ArrowRight") n = (sel + 1) % count;
    else if (e.key === "ArrowUp" || e.key === "ArrowLeft") n = (sel - 1 + count) % count;
    else if (e.key === "Home") n = 0;
    else if (e.key === "End") n = count - 1;
    else return;
    e.preventDefault(); setSel(n); refs.current[n]?.focus();
  };
  return { refs, onKeyDown };
}

export function QuizBreakdown({ attemptId, qs }: { attemptId: string; qs: string }) {
  const x = useHw();
  const { h } = x;
  const res = useAttemptResult(attemptId, qs);
  const [sel, setSel] = useState(0);
  const n = res?.answers?.length ?? 0;
  const { refs, onKeyDown } = useRoving(n, sel, setSel);
  if (res === undefined) return <Skeleton className="mt-2 h-[96px]" />;
  if (!res || !res.answers?.length) return null;
  const a = res.answers[Math.min(sel, res.answers.length - 1)]!;
  const opt = (id: unknown) => a.options?.find((o) => o.id === id)?.text ?? showAnswer(x, id);
  const ans = (v: unknown) => (a.options?.length ? (Array.isArray(v) ? v.map(opt).join(", ") : v == null || v === "" ? h("noAnswer") : opt(v)) : showAnswer(x, v));
  const pid = `hub-bd-${attemptId}`;
  const pct = res.maxMarks > 0 ? Math.round((res.scoreMarks / res.maxMarks) * 100) : 0;
  const aFull = a.marksAwarded >= a.marksMax && a.marksMax > 0;
  const aState = a.pending ? "pending" : aFull ? "full" : a.marksAwarded > 0 ? "partial" : "none";
  const aTone = { pending: "var(--gold)", full: "var(--green)", partial: "var(--gold)", none: "var(--red)" }[aState];
  const aSoft = { pending: "var(--gold-soft)", full: "var(--green-soft)", partial: "var(--gold-soft)", none: "var(--red-soft)" }[aState];
  const aLine = { pending: "var(--gold-line)", full: "var(--green-line)", partial: "var(--gold-line)", none: "var(--red-line)" }[aState];
  const aGlyph = { pending: "…", full: "✓", partial: "◐", none: "✕" }[aState];
  return (
    <div className="mt-3" data-testid="hub-breakdown">
      <div className="mb-3 flex items-center gap-3 rounded-xl border border-[var(--brand-line)] bg-gradient-to-r from-[var(--brand-soft)] to-[var(--violet-soft)] px-3.5 py-2.5">
        <div className="relative grid h-12 w-12 flex-none place-items-center rounded-full" style={{ background: `conic-gradient(var(--brand) ${pct}%, var(--brand-line) ${pct}% 100%)` }}>
          <div className="grid h-9 w-9 place-items-center rounded-full bg-[var(--surface)] text-[12px] font-extrabold tabular-nums text-[var(--brand-strong)]">{pct}%</div>
        </div>
        <div className="min-w-0 flex-1">
          <p className="m-0 text-[13.5px] font-extrabold text-[var(--brand-strong)]">{h("total")}</p>
          <p className="m-0 text-[12px] font-bold text-[var(--ink-2)] tabular-nums">{res.scoreMarks}/{res.maxMarks}</p>
        </div>
      </div>
      {n > 4 ? (
        <div className="mb-3 flex items-center gap-2 rounded-xl border-2 px-2.5 py-2" style={{ borderColor: aLine, background: aSoft }}>
          <span aria-hidden className="grid h-7 w-7 flex-none place-items-center rounded-full text-[13px] font-extrabold text-white" style={{ background: aTone }}>{aGlyph}</span>
          <label className="sr-only" htmlFor={`${pid}-sel`}>{h("questions")}</label>
          <select id={`${pid}-sel`} data-testid="hub-breakdown-select" value={sel} onChange={(e) => setSel(Number(e.target.value))}
            className={`min-h-[44px] flex-1 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2.5 text-[13px] font-extrabold text-[var(--ink)] outline-none ${FOCUS}`}>
            {res.answers.map((y, i) => {
              const full = y.marksAwarded >= y.marksMax && y.marksMax > 0;
              const glyph = y.pending ? "…" : full ? "✓" : y.marksAwarded > 0 ? "◐" : "✕";
              return <option key={y.questionId} value={i}>{glyph} {h("qShort", { n: i + 1 })} — {y.pending ? h("waitingMarks") : `${y.marksAwarded}/${y.marksMax}`}</option>;
            })}
          </select>
          <span className="flex-none rounded-full bg-[var(--surface)] px-2.5 py-1 text-[12px] font-extrabold tabular-nums" style={{ color: aTone }}>{sel + 1}/{n}</span>
        </div>
      ) : null}
      <div className={`grid gap-3 ${n > 4 ? "" : "sm:grid-cols-[140px_minmax(0,1fr)]"}`}>
        {n > 4 ? null : <div role="tablist" aria-label={h("questions")} aria-orientation="vertical" onKeyDown={onKeyDown} className="flex gap-1.5 overflow-x-auto sm:grid sm:content-start sm:gap-2 sm:overflow-visible">
          {res.answers.map((y, i) => {
            const full = y.marksAwarded >= y.marksMax && y.marksMax > 0;
            const state = y.pending ? "pending" : full ? "full" : y.marksAwarded > 0 ? "partial" : "none";
            const tone = { pending: "var(--gold)", full: "var(--green)", partial: "var(--gold)", none: "var(--red)" }[state];
            const soft = { pending: "var(--gold-soft)", full: "var(--green-soft)", partial: "var(--gold-soft)", none: "var(--red-soft)" }[state];
            const line = { pending: "var(--gold-line)", full: "var(--green-line)", partial: "var(--gold-line)", none: "var(--red-line)" }[state];
            const glyph = { pending: "…", full: "✓", partial: "◐", none: "✕" }[state];
            const on = i === sel;
            return (
              <button key={y.questionId} ref={(el) => { refs.current[i] = el; }} type="button" role="tab" id={`${pid}-t${i}`} aria-controls={`${pid}-p`} aria-selected={on} tabIndex={on ? 0 : -1} onClick={() => setSel(i)}
                className={`inline-flex min-h-[44px] flex-none items-center justify-between gap-2 rounded-xl border-2 px-2.5 text-[12.5px] font-extrabold transition-transform ${FOCUS} ${on ? "scale-[1.03] shadow-sm" : ""}`}
                style={{ borderColor: on ? tone : line, background: on ? soft : "var(--surface)", color: on ? tone : "var(--ink)" }}>
                <span className="flex items-center gap-1.5">
                  <span aria-hidden className="grid h-5 w-5 flex-none place-items-center rounded-full text-[11px] font-extrabold text-white" style={{ background: tone }}>{glyph}</span>
                  {h("qShort", { n: i + 1 })}
                </span>
                <span className="tabular-nums text-[11.5px]" style={{ color: on ? tone : "var(--ink-2)" }}>{y.pending ? "" : `${y.marksAwarded}/${y.marksMax}`}</span>
              </button>
            );
          })}
        </div>}
        <div role={n > 4 ? undefined : "tabpanel"} id={`${pid}-p`} aria-labelledby={n > 4 ? undefined : `${pid}-t${sel}`} className="overflow-hidden rounded-xl border-2 bg-[var(--surface)]" style={{ borderColor: aLine }}>
          <div className="flex items-start gap-2 px-3.5 pb-2 pt-3" style={{ background: aSoft }}>
            <span aria-hidden className="mt-0.5 grid h-6 w-6 flex-none place-items-center rounded-full text-[13px] font-extrabold text-white" style={{ background: aTone }}>{aGlyph}</span>
            <p className="m-0 min-w-0 flex-1 whitespace-pre-wrap text-[13.5px] font-extrabold text-[var(--ink)]">{a.prompt ?? h("qLong", { n: sel + 1 })}</p>
            <span className="flex-none rounded-full bg-[var(--surface)] px-2 py-0.5 text-[11.5px] font-extrabold tabular-nums" style={{ color: aTone }} aria-label={h("marksAvail", { n: a.marksMax })}>[{a.marksMax}]</span>
          </div>
          <div className="p-3.5 pt-2.5">
            <p className="m-0 rounded-lg bg-[var(--panel)] px-2.5 py-1.5 text-[12.5px] text-[var(--ink)]"><span className="font-extrabold text-[var(--ink-3)]">{h("theirAnswer")}: </span>{ans(a.response)}</p>
            {a.correctAnswer != null && <p className="mt-1.5 rounded-lg px-2.5 py-1.5 text-[12.5px] text-[var(--ink)]" style={{ background: "var(--green-soft)" }}><span className="font-extrabold text-[var(--green)]">{h("modelAnswer")}: </span>{ans(a.correctAnswer)}</p>}
            <p className="mt-2 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-extrabold" style={{ color: aTone, background: aSoft }}>{a.pending ? h("waitingMarks") : h("marksOf", { got: a.marksAwarded, max: a.marksMax })}</p>
            {a.feedback && <p className="mt-1.5 text-[12px] text-[var(--ink-2)]">{a.feedback}</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
