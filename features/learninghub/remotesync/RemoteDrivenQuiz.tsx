"use client";

import { useEffect, useMemo, useState } from "react";
import type { HubSettings } from "@/lib/hubConfig";
import { ruleOf, type StartedAttempt } from "../shared-assess/api";
import { startQuizAttempt, submitQuizAttempt } from "../lesson/api";
import { Btn, StepCard, Tag, display } from "../lesson/lessonUi";
import { QImage } from "../shared-assess/QuestionImage";
import { Dialog, FOCUS } from "../teachKit";
import { errMsg } from "../types";

// Remote-sync pace "driven" — exit quiz: the tutor answers FOR the class, one question at a time, tagging which child
// said what (choice/multi) or typing their spoken answer (exact/numeric). This is a REAL attempt per child — started
// and submitted through the exact same /assessments/:id/attempts + /attempts/:id/submit routes a solo remote child
// would use (lesson/api.ts's startQuizAttempt/submitQuizAttempt), just with the tutor as the caller and childId set
// per child. match/order/manual questions have no quick tutor-side capture yet — they go in unanswered (no marks),
// same as a question a child skipped; the class still gets everything else recorded for real.

const LETTERS = "ABCDEFGHIJ";
type Taggable = { questionId: string; response: unknown };

export function RemoteDrivenQuizGrid({ qs, roster, quiz, config, homeworkId, onBack, onFinish }: {
  qs: string; roster: { childId: string; childName: string }[];
  quiz: { id: string; title: string; questionCount: number }; config: HubSettings; homeworkId?: string | null;
  onBack: () => void; onFinish: () => void;
}) {
  const [runs, setRuns] = useState<Record<string, StartedAttempt> | null>(null);
  const [failed, setFailed] = useState<{ childId: string; childName: string; message: string }[]>([]);
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, Record<string, unknown>>>({}); // childId -> questionId -> response
  const [armed, setArmed] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const ok: Record<string, StartedAttempt> = {};
      const bad: { childId: string; childName: string; message: string }[] = [];
      await Promise.all(roster.map(async (c) => {
        try { ok[c.childId] = await startQuizAttempt(qs, quiz.id, c.childId, homeworkId ?? undefined); }
        catch (e) { bad.push({ childId: c.childId, childName: c.childName, message: errMsg(e, "Couldn't start their quiz") }); }
      }));
      if (alive) { setRuns(ok); setFailed(bad); }
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qs, quiz.id]);

  const live = useMemo(() => roster.filter((c) => runs?.[c.childId]), [roster, runs]);
  const canonical = live.length ? runs![live[0]!.childId]!.questions[idx] : null;

  if (err) return <StepCard><p role="alert" className="m-0 text-[14px] font-semibold text-[var(--red)]">{err}</p><div className="mt-4"><Btn tone="ghost" onClick={onBack}>Back</Btn></div></StepCard>;
  if (!runs) return <StepCard><div role="status" aria-label="Starting the quiz for the class" className="h-40 animate-pulse rounded-xl bg-[var(--panel)]" /></StepCard>;
  if (!live.length) return <StepCard><p className="m-0 text-[14.5px] text-[var(--ink-2)]">Nobody's quiz could be started.</p>{failed.map((f) => <p key={f.childId} className="m-0 mt-1 text-[13px] text-[var(--red)]">{f.childName}: {f.message}</p>)}<div className="mt-4"><Btn tone="ghost" onClick={onBack}>Back</Btn></div></StepCard>;
  if (!canonical) return null;

  const rule = ruleOf(config.questionKinds, canonical.kind);
  const last = idx === quiz.questionCount - 1;
  const setPick = (childId: string, response: unknown) => setAnswers((m) => ({ ...m, [childId]: { ...(m[childId] ?? {}), [canonical.id]: response } }));
  const respOf = (childId: string) => answers[childId]?.[canonical.id];
  const answeredCount = live.filter((c) => respOf(c.childId) !== undefined).length;

  const submitAll = async () => {
    setBusy(true); setErr(null);
    try {
      await Promise.all(live.map((c) => {
        const run = runs![c.childId]!;
        const body: { questionId: string; response: unknown }[] = run.questions
          .map((q): Taggable | null => { const r = answers[c.childId]?.[q.id]; return r === undefined ? null : { questionId: q.id, response: r }; })
          .filter((x): x is Taggable => x !== null);
        return submitQuizAttempt(qs, run.attemptId, c.childId, body);
      }));
      setConfirm(false);
      onFinish();
    } catch (e) { setErr(errMsg(e, "Couldn't hand the class's quiz in")); setConfirm(false); }
    finally { setBusy(false); }
  };

  return (
    <StepCard>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <Tag>Quiz · {idx + 1} of {quiz.questionCount}</Tag>
        <span className="text-[12px] font-semibold text-[var(--ink-3)]">{answeredCount} of {live.length} recorded for this question</span>
      </div>
      {failed.length > 0 && <p role="alert" className="mb-3 text-[12.5px] font-semibold text-[var(--red)]">Couldn't include {failed.map((f) => f.childName).join(", ")} — {failed[0]!.message}</p>}

      <h2 className="m-0 whitespace-pre-wrap text-[22px] font-extrabold leading-snug text-[var(--ink)] [overflow-wrap:anywhere] sm:text-[26px]" style={display} tabIndex={-1} data-autofocus>{canonical.prompt}</h2>
      <span className="mt-2 inline-block rounded-full bg-[var(--panel)] px-2.5 py-0.5 text-[11.5px] font-bold text-[var(--ink-3)]">{canonical.marks} {canonical.marks === 1 ? "mark" : "marks"}{rule === "multi" ? " · choose all that apply" : ""}</span>
      {canonical.image?.url && <div className="mt-3"><QImage pic={canonical.image} /></div>}

      {(rule === "choice" || rule === "multi") ? (
        <>
          <p className="m-0 mt-3 text-[12.5px] font-semibold text-[var(--ink-3)]">{armed ? `Now tap what ${roster.find((r) => r.childId === armed)?.childName ?? ""} said` : "Tap a child, then tap the option they said"}</p>
          <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="Children">
            {live.map((c) => {
              const on = armed === c.childId;
              const picked = respOf(c.childId);
              const opt = typeof picked === "string" ? picked : Array.isArray(picked) ? picked[0] : undefined;
              return (
                <button key={c.childId} type="button" onClick={() => setArmed(on ? null : c.childId)} data-testid={`rs-quiz-name-${c.childName}`} aria-pressed={on}
                  className={`inline-flex min-h-[40px] items-center gap-1.5 rounded-full border-2 px-3.5 text-[13.5px] font-extrabold transition ${FOCUS} ${on ? "border-[var(--brand)] bg-[var(--brand)] text-white" : opt ? "border-[var(--line)] bg-[var(--surface)] text-[var(--ink)]" : "border-dashed border-[var(--line)] bg-[var(--surface)] text-[var(--ink-2)]"}`}>
                  {c.childName}{opt && <span className="opacity-70">· {LETTERS[(canonical.options ?? []).findIndex((o) => o.id === opt)] ?? "?"}</span>}
                </button>
              );
            })}
          </div>
          <ol className="m-0 mt-4 grid list-none gap-2 p-0 sm:grid-cols-2">
            {(canonical.options ?? []).map((o, i) => {
              const named = live.filter((c) => { const r = respOf(c.childId); return r === o.id || (Array.isArray(r) && r.includes(o.id)); });
              return (
                <li key={o.id}>
                  <button type="button" disabled={!armed} data-testid={`rs-quiz-opt-${LETTERS[i] ?? i}`}
                    onClick={() => {
                      if (!armed) return;
                      if (rule === "multi") {
                        const cur = respOf(armed); const arr = Array.isArray(cur) ? [...cur] as string[] : [];
                        setPick(armed, arr.includes(o.id) ? arr.filter((x) => x !== o.id) : [...arr, o.id]);
                      } else { setPick(armed, o.id); setArmed(null); }
                    }}
                    className={`flex w-full min-h-[52px] flex-wrap items-center gap-2 rounded-xl border-2 border-[var(--line)] bg-[var(--surface)] px-3.5 py-2.5 text-left transition ${FOCUS} ${armed ? "hover:border-[var(--brand)] cursor-pointer" : "cursor-default"}`}>
                    <span className="grid h-8 w-8 flex-none place-items-center rounded-full bg-[var(--panel)] text-[13px] font-extrabold text-[var(--ink-2)]" aria-hidden>{LETTERS[i] ?? i + 1}</span>
                    <span className="min-w-0 flex-1 text-[16px] font-semibold text-[var(--ink)] [overflow-wrap:anywhere]">{o.text}</span>
                    {named.map((c) => <span key={c.childId} className="inline-flex items-center gap-1 rounded-full border-2 border-[var(--violet)] bg-[var(--violet)] px-2.5 py-1 text-[12px] font-extrabold text-white">{c.childName}</span>)}
                  </button>
                </li>
              );
            })}
          </ol>
        </>
      ) : rule === "exact" || rule === "numeric" ? (
        <ul className="m-0 mt-4 grid list-none gap-2 p-0" aria-label="Each child's answer">
          {live.map((c) => (
            <li key={c.childId} className="flex flex-wrap items-center gap-3 rounded-2xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2.5">
              <span className="w-[112px] flex-none truncate text-[14px] font-extrabold text-[var(--ink)]">{c.childName}</span>
              <input type="text" inputMode={rule === "numeric" ? "decimal" : "text"} autoComplete="off" spellCheck={false} aria-label={`${c.childName}'s answer`} placeholder="What they said"
                value={typeof respOf(c.childId) === "string" ? respOf(c.childId) as string : ""} onChange={(e) => setPick(c.childId, e.target.value)}
                className="min-h-[44px] w-full max-w-[260px] rounded-xl border-2 border-[var(--line)] bg-[var(--surface)] px-3 text-[15px] text-[var(--ink)] outline-none focus:border-[var(--brand)]" />
            </li>
          ))}
        </ul>
      ) : (
        <p role="note" className="mt-4 rounded-xl border border-[var(--line)] border-l-4 border-l-[var(--gold)] bg-[var(--panel)] px-3.5 py-2.5 text-[13.5px] font-semibold text-[var(--ink)]">This question type ({canonical.kind}) can't be captured here yet — it'll go in for the class unanswered (no marks). Marking is still per child and real for everything else.</p>
      )}

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        {idx === 0 ? <Btn tone="ghost" onClick={onBack}>Back</Btn> : <Btn tone="ghost" onClick={() => setIdx(idx - 1)}>← Previous</Btn>}
        {!last ? <Btn onClick={() => { setArmed(null); setIdx(idx + 1); }} data-testid="rs-quiz-next">Next →</Btn> : <Btn tone="good" onClick={() => setConfirm(true)} data-testid="rs-quiz-mark">Hand in for the class →</Btn>}
      </div>

      {confirm && (
        <Dialog title="Hand in the class's quiz?" onClose={() => setConfirm(false)}
          footer={<><Btn tone="ghost" onClick={() => setConfirm(false)}>Keep going</Btn><Btn tone="good" onClick={submitAll} disabled={busy} data-testid="rs-quiz-confirm">{busy ? "Submitting…" : "Submit and record results"}</Btn></>}>
          <p className="m-0 text-[14px] leading-relaxed text-[var(--ink-2)]">This records a real result for each of the {live.length} {live.length === 1 ? "child" : "children"} connected. Their parents see it, and it counts towards progress.</p>
        </Dialog>
      )}
    </StepCard>
  );
}
