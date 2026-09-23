"use client";

import { useEffect, useMemo, useState } from "react";
import { Icon } from "../kit";
import { describeAnswer } from "../lesson/answerText";
import { Btn, StepCard, Tag, display } from "../lesson/lessonUi";
import { QImage } from "../shared-assess/QuestionImage";
import { Dialog, FOCUS } from "../teachKit";
import { errMsg } from "../types";
import { getPaper, type Cell, type IpPaper, type IpQuestion } from "./api";
import { nameFor } from "./inKit";
import type { ClassStore } from "./useClassState";

// The tutor's capture grid: one question at a time for the whole class, and under it a row per child (present children only) to
// record what THAT child did — tap their option, type their answer, or make the right / not-yet call yourself (oral and hands-on
// work). Nothing is marked here: on "Mark the class" the server marks every child from what was captured and records a real attempt
// each (POST /in-person/sessions/:id/submit). The key sits behind "Show answer" so a projected screen never gives it away.

const LETTERS = "ABCDEFGHIJ";
const isAnswered = (c: Cell | undefined) => !!c && (c.verdict !== undefined || (Array.isArray(c.response) ? c.response.length > 0 : typeof c.response === "string" && c.response.trim() !== ""));

export function CaptureGrid({ qs, sessionId, assessmentId, roster, store, hideNames, onBack, handIn, onDone }: {
  qs: string; sessionId: string; assessmentId: string; roster: { childId: string; childName: string }[]; store: ClassStore; hideNames: boolean;
  onBack?: () => void; handIn: (childIds: string[], override?: boolean) => Promise<boolean>; onDone: () => void;
}) {
  const [paper, setPaper] = useState<IpPaper | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [idx, setIdx] = useState(0);
  const [showKey, setShowKey] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const { cells } = store.state;

  useEffect(() => {
    let live = true;
    setPaper(null); setErr(null);
    getPaper(qs, sessionId, assessmentId).then((p) => { if (live) setPaper(p); }).catch((e) => { if (live) setErr(errMsg(e, "Couldn't load the quiz")); });
    return () => { live = false; };
  }, [qs, sessionId, assessmentId]);
  useEffect(() => { setShowKey(false); }, [idx]);

  const ids = useMemo(() => roster.map((r) => r.childId), [roster]);
  if (err) return <StepCard><p role="alert" className="m-0 text-[14px] font-semibold text-[var(--red)]">{err}</p>{onBack && <div className="mt-4"><Btn tone="ghost" onClick={onBack}>Back</Btn></div>}</StepCard>;
  if (!paper) return <StepCard><div role="status" aria-label="Loading the quiz" className="h-40 animate-pulse rounded-xl bg-[var(--panel)]" /></StepCard>;
  if (!roster.length) return <StepCard><p className="m-0 text-[14.5px] text-[var(--ink-2)]">Nobody is marked as here. Tick who is here (top right) to record their answers.</p>{onBack && <div className="mt-4"><Btn tone="ghost" onClick={onBack}>Back</Btn></div>}</StepCard>;

  const qs_ = paper.questions;
  const q = qs_[idx]!;
  const last = idx === qs_.length - 1;
  const answeredFor = (qid: string) => ids.filter((c) => isAnswered(cells[c]?.[qid])).length;
  const missing = qs_.reduce((n, x) => n + ids.length - answeredFor(x.id), 0);

  const submit = async () => {
    setBusy(true);
    const ok = await handIn(ids);
    setBusy(false); setConfirm(false);
    if (ok) onDone();
  };

  return (
    <StepCard>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <Tag>{paper.assessment.type === "diagnostic" ? "Starting quiz" : "Quiz"} · {idx + 1} of {qs_.length}</Tag>
        <span className="text-[12px] font-semibold text-[var(--ink-3)]" data-testid="ip-answered">{answeredFor(q.id)} of {ids.length} recorded for this question</span>
      </div>
      <nav aria-label="Questions" className="mb-4 flex flex-wrap gap-1.5">
        {qs_.map((x, i) => {
          const n = answeredFor(x.id);
          const done = n === ids.length;
          return (
            <button key={x.id} type="button" onClick={() => setIdx(i)} aria-label={`Question ${i + 1}, ${n} of ${ids.length} recorded`} aria-current={i === idx ? "step" : undefined}
              className={`grid h-11 min-w-[44px] place-items-center rounded-xl border-2 px-2 text-[13px] font-extrabold ${FOCUS} ${i === idx ? "border-[var(--brand)] bg-[var(--brand-soft)] text-[var(--brand)]" : done ? "border-[var(--green)] bg-[var(--green-soft)] text-[var(--hub-green-ink)]" : "border-[var(--line)] bg-[var(--surface)] text-[var(--ink-2)]"}`}>{i + 1}</button>
          );
        })}
      </nav>

      <QuestionStage q={q} showKey={showKey} />
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => setShowKey((v) => !v)} aria-pressed={showKey} data-testid="ip-show-answer"
          className={`inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border-2 border-[var(--line)] bg-[var(--surface)] px-3.5 text-[13.5px] font-extrabold text-[var(--ink-2)] hover:border-[var(--brand-2)] ${FOCUS}`}>
          <Icon name="search" size={15} />{showKey ? "Hide answer" : "Show answer (tutor only)"}
        </button>
        <button type="button" onClick={() => store.setAll(ids, q.id, "right")} data-testid="ip-all-right"
          className={`inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border-2 border-[var(--line)] bg-[var(--surface)] px-3.5 text-[13.5px] font-extrabold text-[var(--hub-green-ink)] hover:border-[var(--green)] ${FOCUS}`}>
          <Icon name="check" size={15} strokeWidth={3} />Everyone got it
        </button>
        <button type="button" onClick={() => store.setAll(ids, q.id, null)}
          className={`inline-flex min-h-[44px] items-center rounded-xl px-3 text-[13px] font-bold text-[var(--ink-3)] hover:text-[var(--ink)] ${FOCUS}`}>Clear this question</button>
      </div>
      {showKey && (
        <p role="note" className="mt-3 rounded-xl border border-[var(--line)] border-l-4 border-l-[var(--green)] bg-[var(--panel)] px-3.5 py-2.5 text-[14px] font-semibold text-[var(--ink)]" data-testid="ip-key">
          Answer: {describeAnswer(q.key.correctAnswer, q.options) || "marked by hand"}{q.key.acceptedAnswers?.length ? ` (also fine: ${q.key.acceptedAnswers.join(", ")})` : ""}{q.key.explanation ? ` — ${q.key.explanation}` : ""}
        </p>
      )}

      <ul className="m-0 mt-4 grid list-none gap-2 p-0" aria-label="Each child's answer">
        {roster.map((c) => (
          <ChildRow key={c.childId} name={nameFor(c.childName, hideNames)} q={q} cell={cells[c.childId]?.[q.id]} showKey={showKey} testId={c.childName}
            onChange={(cell) => store.setCell(c.childId, q.id, cell)} />
        ))}
      </ul>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        {idx === 0 ? (onBack ? <Btn tone="ghost" onClick={onBack}>Back</Btn> : <span />) : <Btn tone="ghost" onClick={() => setIdx(idx - 1)}>← Previous</Btn>}
        {!last
          ? <Btn onClick={() => setIdx(idx + 1)} data-testid="ip-next">Next →</Btn>
          : <Btn tone="good" onClick={() => setConfirm(true)} data-testid="ip-mark-class">Mark the class →</Btn>}
      </div>

      {confirm && (
        <Dialog title="Mark the class?" onClose={() => setConfirm(false)}
          footer={<><Btn tone="ghost" onClick={() => setConfirm(false)}>Keep going</Btn><Btn tone="good" onClick={submit} disabled={busy} data-testid="ip-confirm-mark">{busy ? "Marking…" : "Mark and record results"}</Btn></>}>
          <p className="m-0 text-[14px] leading-relaxed text-[var(--ink-2)]">
            This records a real result for each of the {ids.length} {ids.length === 1 ? "child" : "children"} here. Their parents see it in My Classroom, and it counts towards progress.
            {missing > 0 && <> <b className="text-[var(--ink)]">{missing} {missing === 1 ? "answer isn't" : "answers aren't"} recorded</b> — those score no marks.</>}
          </p>
        </Dialog>
      )}
    </StepCard>
  );
}

/** The question as the class sees it (what a projected screen shows): prompt, picture, and the options / pieces. No key. */
function QuestionStage({ q, showKey }: { q: IpQuestion; showKey: boolean }) {
  const correctIds = new Set(Array.isArray(q.key.correctAnswer) ? (q.key.correctAnswer as unknown[]).filter((x): x is string => typeof x === "string") : typeof q.key.correctAnswer === "string" ? [q.key.correctAnswer] : []);
  return (
    <div>
      <h2 className="m-0 whitespace-pre-wrap text-[22px] font-extrabold leading-snug text-[var(--ink)] [overflow-wrap:anywhere] sm:text-[26px]" style={display} tabIndex={-1} data-autofocus>{q.prompt}</h2>
      <span className="mt-2 inline-block rounded-full bg-[var(--panel)] px-2.5 py-0.5 text-[11.5px] font-bold text-[var(--ink-3)]">{q.marks} {q.marks === 1 ? "mark" : "marks"}{q.rule === "multi" ? " · choose all that apply" : ""}</span>
      {q.image?.url && <div className="mt-3"><QImage pic={q.image} /></div>}
      {(q.rule === "choice" || q.rule === "multi") && (
        <ol className="m-0 mt-4 grid list-none gap-2 p-0 sm:grid-cols-2">
          {(q.options ?? []).map((o, i) => (
            <li key={o.id} className={`flex min-h-[52px] items-center gap-3 rounded-xl border-2 px-3.5 py-2.5 ${showKey && correctIds.has(o.id) ? "border-[var(--green)] bg-[var(--green-soft)]" : "border-[var(--line)] bg-[var(--surface)]"}`}>
              <span className="grid h-8 w-8 flex-none place-items-center rounded-full bg-[var(--panel)] text-[13px] font-extrabold text-[var(--ink-2)]" aria-hidden>{LETTERS[i] ?? i + 1}</span>
              {o.image?.url && <span className="w-20 flex-none"><QImage pic={o.image} alt={o.text || `Option ${LETTERS[i] ?? i + 1}`} fit="tile" zoom={false} /></span>}
              <span className="min-w-0 flex-1 text-[16px] font-semibold text-[var(--ink)] [overflow-wrap:anywhere]">{o.text}</span>
            </li>
          ))}
        </ol>
      )}
      {q.rule === "match" && (
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <ul className="m-0 grid list-none gap-2 p-0">{(q.terms ?? []).map((t) => <li key={t.text} className="rounded-xl border-2 border-[var(--line)] bg-[var(--surface)] px-3.5 py-2.5 text-[15px] font-semibold">{t.text}</li>)}</ul>
          <ul className="m-0 grid list-none gap-2 p-0">{(q.definitions ?? []).map((t) => <li key={t.text} className="rounded-xl border-2 border-dashed border-[var(--line)] bg-[var(--panel)] px-3.5 py-2.5 text-[15px] font-semibold">{t.text}</li>)}</ul>
        </div>
      )}
      {q.rule === "order" && <ol className="m-0 mt-4 grid list-decimal gap-2 pl-6">{(q.items ?? []).map((t) => <li key={t} className="text-[16px] font-semibold text-[var(--ink)]">{t}</li>)}</ol>}
    </div>
  );
}

/** One child's row: their name, the way to record their answer for this question's kind, and the tutor's own right / not-yet call. */
function ChildRow({ name, q, cell, showKey, onChange, testId }: { name: string; q: IpQuestion; cell: Cell | undefined; showKey: boolean; onChange: (c: Cell | null) => void; testId: string }) {
  const multi = q.rule === "multi";
  const picked = Array.isArray(cell?.response) ? cell!.response : typeof cell?.response === "string" && cell.response ? [cell.response] : [];
  const correctIds = new Set(Array.isArray(q.key.correctAnswer) ? (q.key.correctAnswer as unknown[]).filter((x): x is string => typeof x === "string") : typeof q.key.correctAnswer === "string" ? [q.key.correctAnswer] : []);
  const pick = (id: string) => {
    const next = multi ? (picked.includes(id) ? picked.filter((x) => x !== id) : [...picked, id]) : picked[0] === id ? [] : [id];
    onChange(next.length ? { response: multi ? next : next[0]! } : null);
  };
  const call = (v: "right" | "wrong") => onChange(cell?.verdict === v ? null : { verdict: v });
  const verdictBtn = "grid h-12 w-12 flex-none place-items-center rounded-xl border-2 text-[18px] font-extrabold transition";
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2.5" data-child-row={testId}>
      <span className="w-[112px] flex-none truncate text-[14px] font-extrabold text-[var(--ink)] sm:w-[140px]" title={name}>{name}</span>
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
        {(q.rule === "choice" || q.rule === "multi") && (q.options ?? []).map((o, i) => {
          const on = picked.includes(o.id);
          const isKey = showKey && correctIds.has(o.id);
          return (
            <button key={o.id} type="button" onClick={() => pick(o.id)} aria-pressed={on} aria-label={`${name}: option ${LETTERS[i] ?? i + 1}${o.text ? `, ${o.text}` : ""}`}
              className={`grid h-12 w-12 flex-none place-items-center rounded-xl border-2 text-[15px] font-extrabold transition ${FOCUS} ${on ? "border-[var(--brand)] bg-[var(--brand)] text-white" : isKey ? "border-[var(--green)] bg-[var(--green-soft)] text-[var(--hub-green-ink)]" : "border-[var(--line)] bg-[var(--surface)] text-[var(--ink-2)] hover:border-[var(--brand-2)]"}`}>{LETTERS[i] ?? i + 1}</button>
          );
        })}
        {(q.rule === "exact" || q.rule === "numeric") && (
          <input type="text" inputMode={q.rule === "numeric" ? "decimal" : "text"} autoComplete="off" spellCheck={false} aria-label={`${name}'s answer`} placeholder="Their answer"
            value={typeof cell?.response === "string" ? cell.response : ""} onChange={(e) => onChange(e.target.value.trim() ? { response: e.target.value } : null)}
            className={`min-h-[48px] w-full max-w-[240px] rounded-xl border-2 border-[var(--line)] bg-[var(--surface)] px-3 text-[15px] text-[var(--ink)] outline-none focus:border-[var(--brand)]`} />
        )}
        {(q.rule === "match" || q.rule === "order" || q.rule === "manual") && <span className="text-[12px] text-[var(--ink-3)]">Your call: did they get it?</span>}
      </div>
      <span className="flex flex-none gap-1.5">
        <button type="button" onClick={() => call("right")} aria-pressed={cell?.verdict === "right"} aria-label={`${name}: got it`} data-testid={`ip-right-${testId}`}
          className={`${verdictBtn} ${FOCUS} ${cell?.verdict === "right" ? "border-[var(--green)] bg-[var(--green)] text-white" : "border-[var(--line)] bg-[var(--surface)] text-[var(--hub-green-ink)] hover:border-[var(--green)]"}`}><Icon name="check" size={20} strokeWidth={3} /></button>
        <button type="button" onClick={() => call("wrong")} aria-pressed={cell?.verdict === "wrong"} aria-label={`${name}: not yet`} data-testid={`ip-wrong-${testId}`}
          className={`${verdictBtn} ${FOCUS} ${cell?.verdict === "wrong" ? "border-[var(--red)] bg-[var(--red)] text-white" : "border-[var(--line)] bg-[var(--surface)] text-[var(--red)] hover:border-[var(--red)]"}`}><Icon name="close" size={20} strokeWidth={3} /></button>
      </span>
    </li>
  );
}
