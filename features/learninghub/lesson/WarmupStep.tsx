"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import type { HubSettings } from "@/lib/hubConfig";
import { ruleOf } from "../shared-assess/api";
import { isAnswered, QuestionView, type Answer } from "../shared-assess/QuestionView";
import { describeAnswer } from "./answerText";
import type { WarmupCheck, WarmupQuestion } from "./api";
import { Btn, StepCard, Tag } from "./lessonUi";
import { errMsg } from "../types";

// "Warm-up": the lesson's starter questions, one at a time, with a hint button and instant feedback. Pupils get NO answer key
// with the question — pressing Check asks the server (POST …/warmup-check) which reveals the answer for THAT question only, and
// only if the tutor's reveal policy allows. Marking of every kind (incl. match / order) is the server's; practice only — nothing
// here feeds mastery (the exit quiz does).

const CHEERS = ["Yes!", "Spot on!", "Nice one!", "Correct!"];
export interface WarmupOutcome { ok: boolean | null }

export function WarmupStep({ questions, config, check, scored, onDone, onBack, skippable, extra, onLiveAnswer }: {
  questions: WarmupQuestion[]; config: HubSettings;
  check: (questionId: string, response: unknown) => Promise<WarmupCheck>;
  /** Report one checked answer (streak / XP live in the player). */
  scored: (ok: boolean, hinted: boolean) => void;
  onDone: (results: WarmupOutcome[]) => void; onBack: () => void;
  /** Tutor preview: a "Skip" button on every question. */
  skippable?: boolean;
  /** In-person class mode, or remote-sync "driven": extra controls for the tutor under the question (per-child tally / tagging), replacing the normal input entirely. */
  extra?: (q: WarmupQuestion) => ReactNode;
  /** Remote-sync "own_pace": fired on every change to this question's answer-so-far. */
  onLiveAnswer?: (questionId: string, response: unknown) => void;
}) {
  const [i, setI] = useState(0);
  const results = useRef<WarmupOutcome[]>([]);
  const q = questions[i];
  if (!q) return null;
  return (
    <WarmupCard key={q.id} q={q} n={i + 1} of={questions.length} config={config} check={check} scored={scored}
      onBack={i === 0 ? onBack : undefined} skippable={skippable} extra={extra} onLiveAnswer={onLiveAnswer}
      onNext={(o) => { results.current[i] = o; if (i + 1 >= questions.length) onDone([...results.current]); else setI(i + 1); }} />
  );
}

function WarmupCard({ q, n, of, config, check, scored, onNext, onBack, skippable, extra, onLiveAnswer }: {
  q: WarmupQuestion; n: number; of: number; config: HubSettings;
  check: (id: string, response: unknown) => Promise<WarmupCheck>; scored: (ok: boolean, hinted: boolean) => void;
  onNext: (o: WarmupOutcome) => void; onBack?: () => void; skippable?: boolean; extra?: (q: WarmupQuestion) => ReactNode;
  onLiveAnswer?: (questionId: string, response: unknown) => void;
}) {
  const rule = ruleOf(config.questionKinds, q.kind);
  const [value, setValue] = useState<Answer | undefined>(undefined);
  const [hint, setHint] = useState(false);
  const [busy, setBusy] = useState(false);
  const [verdict, setVerdict] = useState<WarmupCheck | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => { box.current?.focus({ preventScroll: true }); }, []);

  const response = () => {
    if (Array.isArray(value)) return value;
    if (rule === "numeric" && typeof value === "string") { const x = Number(value.replace(/,/g, "").trim()); return Number.isFinite(x) ? x : value; }
    return value;
  };
  useEffect(() => { if (value !== undefined) onLiveAnswer?.(q.id, response()); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  const doCheck = async () => {
    setBusy(true); setErr(null);
    try {
      const v = await check(q.id, response());
      setVerdict(v);
      if (v.correct !== null) scored(v.correct, hint);
      if (v.correct === false) box.current?.closest("section")?.classList.add("ls-shake");
      else if (v.correct) box.current?.closest("section")?.classList.add("ls-pulse");
    } catch (e) { setErr(errMsg(e, "Couldn't check that answer — try again")); }
    finally { setBusy(false); }
  };

  const shown = describeAnswer(verdict?.correctAnswer, q.options);
  const ok = verdict?.correct;

  // In-person class mode: nobody answers as "the tutor" — the whole card (prompt, options, checking, reveal) is
  // owned by `extra`, which tags each present child's answer onto the options themselves.
  if (extra) {
    return (
      <StepCard>
        <div className="mb-3"><Tag>Warm-up · {n} of {of}</Tag></div>
        {extra(q)}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          {onBack ? <Btn tone="ghost" onClick={onBack}>Back</Btn> : <span />}
          <Btn onClick={() => onNext({ ok: null })} data-testid="lesson-next">{n === of ? "Finish warm-up →" : "Next →"}</Btn>
        </div>
      </StepCard>
    );
  }

  return (
    <StepCard>
      <div ref={box} tabIndex={-1} className="outline-none">
        <div className="mb-3"><Tag>Warm-up · {n} of {of}</Tag></div>
        <QuestionView q={q} rule={rule} value={value} onChange={setValue} disabled={!!verdict} autoFocus />
      </div>
      {hint && q.hint && <p role="note" className="mt-3 rounded-xl border border-[var(--line)] border-l-4 border-l-[var(--gold)] bg-[var(--panel)] px-3.5 py-2.5 text-[14px] font-semibold text-[var(--ink)]">💡 {q.hint}</p>}
      {err && <p role="alert" className="mt-3 rounded-xl bg-[var(--red-soft)] px-3.5 py-2.5 text-[13.5px] font-semibold text-[var(--red)]">{err}</p>}
      {verdict && (
        <div role="status" className="mt-4 rounded-xl px-4 py-3 text-[15px] ls-enter" style={ok === false ? { background: "var(--red-soft)", color: "color-mix(in srgb, var(--red) 60%, #000)" } : { background: "var(--green-soft)", color: "color-mix(in srgb, var(--green) 45%, #000)" }}>
          <b className="mb-0.5 block">{ok === null ? "Noted" : ok ? CHEERS[(n - 1) % CHEERS.length] : "Not quite"}</b>
          {ok === null && <>Your tutor reads written answers, so this one isn&apos;t marked here. </>}
          {ok === false && shown && (Array.isArray(verdict?.correctAnswer) && q.options?.length ? <>The correct answers are: {shown}. </> : <>The answer is “{shown}”. </>)}
          {verdict.explanation}
        </div>
      )}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        {onBack && !verdict ? <Btn tone="ghost" onClick={onBack}>Back</Btn> : <span />}
        <span className="flex flex-wrap gap-2">
          {skippable && !verdict && <Btn tone="ghost" onClick={() => onNext({ ok: null })} data-testid="lesson-skip">Skip →</Btn>}
          {q.hint && !verdict && <Btn tone="ghost" disabled={hint} onClick={() => setHint(true)}>💡 Hint</Btn>}
          {!verdict
            ? <Btn onClick={doCheck} disabled={busy || !isAnswered(value)} data-testid="lesson-check">{busy ? "Checking…" : "Check"}</Btn>
            : <Btn onClick={() => onNext({ ok: verdict.correct })} data-testid="lesson-next">{n === of ? "Finish warm-up →" : "Next →"}</Btn>}
        </span>
      </div>
    </StepCard>
  );
}
