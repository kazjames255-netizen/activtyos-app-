"use client";

import { useEffect, useMemo, useState } from "react";
import { Button, FieldLabel, Input } from "@/components/ui";
import { put } from "@/lib/api";
import { useT } from "@/lib/i18n/provider";
import type { Result, ResultAnswer } from "../shared-assess/api";
import { errMsg, fmtSize } from "../types";
import { Avatar, Dialog, FOCUS, Notice, Pill, ProgressBar, Skeleton, withQs } from "../teachKit";
import { Ico } from "../teachIcons";
import { showAnswer, useAttemptResult, useRoving } from "./hwBreakdown";
import { FeedbackManager, useFeedbackBank } from "./FeedbackBank";
import { useHw } from "./hwI18n";
import { pctOf, type HubFile, type InboxRow } from "./hwTypes";

// Tutor: open one hand-in — the writing, the files, and every linked quiz / worksheet attempt QUESTION BY QUESTION (a rail of
// Q1..Qn with the marks awarded, a running total) — and mark it. Awarding marks on the rail sets the total; the total can still be
// overridden. An interactive worksheet that was auto-marked arrives already marked ("Marked automatically"). "Mark & next" walks the queue.

const QUICK = ["qf1", "qf2", "qf3"];
type Awards = Record<string, Record<string, string>>; // attemptId -> questionId -> marks typed

function FileTile({ f }: { f: HubFile }) {
  const { h } = useHw();
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
        <span className="text-[11px] font-bold text-[var(--brand)] group-hover:underline">{h("open")}</span>
      </div>
    </a>
  );
}

const num = (v: string | undefined, fallback: number) => { const n = Number(v); return v === undefined || v.trim() === "" || !Number.isFinite(n) ? fallback : n; };

/** One attempt as a marking rail: Q tabs with marks, the question, the child's answer, a marks box, and the attempt's running total. */
function AttemptRail({ attemptId, qs, readOnly, awards, onAward, onLoaded, showTitle }: { attemptId: string; qs: string; readOnly: boolean; awards: Record<string, string> | undefined; onAward: (qid: string, v: string) => void; onLoaded: (r: Result | null) => void; showTitle: boolean }) {
  const x = useHw();
  const { h } = x;
  const res = useAttemptResult(attemptId, qs);
  const [sel, setSel] = useState(0);
  useEffect(() => { if (res !== undefined) onLoaded(res); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [res]);
  const n = res?.answers?.length ?? 0;
  const { refs, onKeyDown } = useRoving(n, sel, setSel);
  if (res === undefined) return <Skeleton className="h-[110px]" />;
  if (res === null || !res.answers?.length) return <p className="rounded-xl border border-dashed border-[var(--line)] px-3.5 py-3 text-[12.5px] text-[var(--ink-3)]">{h("quizLoadFail")}</p>;
  const cur = (y: ResultAnswer) => num(awards?.[y.questionId], y.marksAwarded);
  const total = res.answers.reduce((s, y) => s + cur(y), 0);
  const a = res.answers[Math.min(sel, n - 1)]!;
  const opt = (id: unknown) => a.options?.find((o) => o.id === id)?.text ?? showAnswer(x, id);
  const ans = (v: unknown) => (a.options?.length ? (Array.isArray(v) ? v.map(opt).join(", ") : v == null || v === "" ? h("noAnswer") : opt(v)) : showAnswer(x, v));
  const pid = `hub-mr-${attemptId}`;
  return (
    <div data-testid="hub-mark-rail" className="rounded-xl border border-[var(--brand-line)] bg-[var(--brand-soft)] p-3">
      {showTitle && <div className="mb-2 truncate text-[13px] font-extrabold text-[var(--brand-strong)]">{res.assessmentTitle || h("quiz")}</div>}
      <div className="grid gap-3 sm:grid-cols-[132px_minmax(0,1fr)]">
        <div role="tablist" aria-label={h("questions")} aria-orientation="vertical" onKeyDown={onKeyDown} className="flex gap-1.5 overflow-x-auto sm:grid sm:content-start sm:overflow-visible">
          {res.answers.map((y, i) => {
            const got = cur(y);
            const full = got >= y.marksMax && y.marksMax > 0;
            const glyph = y.pending && awards?.[y.questionId] === undefined ? "…" : full ? "✓" : got > 0 ? "◐" : "✕";
            return (
              <button key={y.questionId} ref={(el) => { refs.current[i] = el; }} type="button" role="tab" id={`${pid}-t${i}`} aria-controls={`${pid}-p`} aria-selected={i === sel} tabIndex={i === sel ? 0 : -1} onClick={() => setSel(i)} data-q={i + 1}
                className={`inline-flex min-h-[44px] flex-none items-center justify-between gap-2 rounded-lg border px-2.5 text-[12.5px] font-bold ${FOCUS} ${i === sel ? "border-[var(--brand)] bg-[var(--surface)] text-[var(--brand-strong)]" : "border-[var(--line)] bg-[var(--surface)] text-[var(--ink)]"}`}>
                <span>{h("qShort", { n: i + 1 })}</span>
                <span className="tabular-nums" style={{ color: y.pending && awards?.[y.questionId] === undefined ? "var(--gold)" : full ? "var(--green)" : "var(--ink-2)" }}><span aria-hidden>{glyph} </span>{y.pending && awards?.[y.questionId] === undefined ? "" : `${got}/${y.marksMax}`}</span>
              </button>
            );
          })}
          <div className="flex min-h-[44px] flex-none items-center justify-between gap-2 rounded-lg bg-[var(--surface)] px-2.5 text-[12.5px] font-extrabold text-[var(--ink)]" data-testid="hub-rail-total"><span>{h("total")}</span><span className="tabular-nums">{total}/{res.maxMarks}</span></div>
        </div>
        <div role="tabpanel" id={`${pid}-p`} aria-labelledby={`${pid}-t${sel}`} className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3">
          <div className="flex items-start gap-2">
            <p className="m-0 min-w-0 flex-1 whitespace-pre-wrap text-[13px] font-bold text-[var(--ink)]">{a.prompt ?? h("qLong", { n: sel + 1 })}</p>
            <span className="flex-none text-[12px] font-extrabold text-[var(--green)]" aria-label={h("marksAvail", { n: a.marksMax })}>[{a.marksMax}]</span>
          </div>
          <p className="mt-2 text-[12.5px] text-[var(--ink)]"><span className="font-extrabold text-[var(--ink-3)]">{h("theirAnswer")}: </span>{ans(a.response)}</p>
          {a.correctAnswer != null && <p className="mt-1 text-[12.5px] text-[var(--ink)]"><span className="font-extrabold text-[var(--green)]">{h("modelAnswer")}: </span>{ans(a.correctAnswer)}</p>}
          {a.pending && awards?.[a.questionId] === undefined && <p className="mt-1 text-[12px] font-bold text-[var(--gold)]">{h("waitingMarks")}</p>}
          <div className="mt-2.5 flex flex-wrap items-end gap-2">
            <div className="w-[110px]">
              <FieldLabel htmlFor={`${pid}-in${sel}`}>{h("marksLabel")}</FieldLabel>
              <Input id={`${pid}-in${sel}`} type="number" inputMode="decimal" min={0} max={a.marksMax} step="any" disabled={readOnly} data-testid="hub-q-marks" className="min-h-[44px] w-full" value={awards?.[a.questionId] ?? String(a.marksAwarded)}
                onChange={(e) => onAward(a.questionId, e.target.value)} />
            </div>
            <span className="pb-3 text-[13px] font-bold text-[var(--ink-3)]">{h("outOfN", { n: a.marksMax })}</span>
            {!readOnly && <>
              <button type="button" onClick={() => onAward(a.questionId, String(a.marksMax))} className={`min-h-[44px] rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 text-[12px] font-bold text-[var(--green)] hover:border-[var(--green)] ${FOCUS}`}>{h("fullMarks")}</button>
              <button type="button" onClick={() => onAward(a.questionId, "0")} className={`min-h-[44px] rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 text-[12px] font-bold text-[var(--ink-2)] hover:border-[var(--brand)] ${FOCUS}`}>{h("noMarks")}</button>
            </>}
          </div>
          {a.feedback && <p className="mt-2 text-[12px] text-[var(--ink-2)]">{a.feedback}</p>}
        </div>
      </div>
    </div>
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
  const x = useHw();
  const { h } = x;
  const tx = useT();
  const attemptIds = useMemo(() => (row.attemptIds?.length ? row.attemptIds : row.attemptId ? [row.attemptId] : []), [row.attemptIds, row.attemptId]);
  const [results, setResults] = useState<Record<string, Result | null>>({});
  const [awards, setAwards] = useState<Awards>({});
  const [touched, setTouched] = useState(!!row.mark);
  const [score, setScore] = useState<string>(row.mark ? String(row.mark.score) : "");
  const [max, setMax] = useState<string>(row.mark ? String(row.mark.max) : attemptIds.length ? "" : "10");
  const [feedback, setFeedback] = useState(row.mark?.feedback ?? "");
  const bank = useFeedbackBank(qs, !readOnly);          // the tutor's own saved comments (one-tap chips after the built-in ones)
  const [managing, setManaging] = useState(false);
  const [busy, setBusy] = useState<"save" | "next" | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // The rail's total: every linked attempt's questions, with the marks typed here in place of the stored ones.
  const rail = useMemo(() => {
    let got = 0, out = 0, pending = 0, loaded = 0;
    for (const id of attemptIds) {
      const r = results[id];
      if (r === undefined) continue;
      loaded++;
      if (!r) continue;
      out += r.maxMarks;
      for (const y of r.answers) {
        const typed = awards[id]?.[y.questionId];
        got += num(typed, y.marksAwarded);
        if (y.pending && typed === undefined) pending++;
      }
    }
    return { got, out, pending, loaded, all: loaded === attemptIds.length };
  }, [attemptIds, results, awards]);
  // Until the tutor types a total of their own, the score and out-of follow the rail.
  useEffect(() => { if (!touched && rail.all && rail.out > 0) { setScore(String(rail.got)); setMax(String(rail.out)); } }, [touched, rail.all, rail.got, rail.out]);

  const s = Number(score), m = Number(max);
  const valid = score.trim() !== "" && Number.isFinite(s) && Number.isFinite(m) && m > 0 && s >= 0 && s <= m;
  const submit = async (advance: boolean) => {
    if (!valid) { setErr(m > 0 && s > m ? h("errScoreHigh") : h("errScoreEnter")); return; }
    setBusy(advance ? "next" : "save"); setErr(null);
    try {
      // 1) any question marks changed on the rail go to the attempts (they update the child's quiz result too); 2) the homework mark.
      for (const id of attemptIds) {
        const r = results[id];
        const typed = awards[id];
        if (!r || !typed) continue;
        const changed = r.answers.filter((y) => typed[y.questionId] !== undefined && (num(typed[y.questionId], y.marksAwarded) !== y.marksAwarded || y.pending)).map((y) => ({ questionId: y.questionId, marksAwarded: Math.min(y.marksMax, Math.max(0, num(typed[y.questionId], y.marksAwarded))) }));
        if (changed.length) await put(`/api/learning-hub/attempts/${id}/mark${withQs(qs, {})}`, { answers: changed });
      }
      await put(`/api/learning-hub/submissions/${row.submissionId}/mark${qs}`, { score: s, max: m, feedback: feedback.trim() });
      onMarked(advance);
    } catch (e) { setErr(errMsg(e, h("errMark"))); setBusy(null); }
  };

  const handedIn = row.status !== "assigned";
  const auto = row.mark && (row.mark as { markedBy?: string }).markedBy === "auto";
  return (
    <Dialog id="hub-mark-dialog" plain size="xl" title={row.title}
      subtitle={<span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1"><span className="inline-flex items-center gap-1.5 font-bold text-[var(--ink-2)]"><Avatar name={row.childName} size={18} />{row.childName}</span>{row.submittedAt ? <>· {h("handedInAt", { when: x.dayTime(row.submittedAt) })}</> : <>· {h("notHandedYet")}</>}{row.late && <Pill tone="red">{h("late")}</Pill>}{auto && <Pill tone="green">{h("markedAuto")}</Pill>}</span>}
      onClose={onClose}
      footer={<>
        <Button variant="ghost" className={`min-h-[44px] ${FOCUS}`} onClick={onClose}>{h("close")}</Button>
        {!readOnly && !valid && !busy && <span role="note" data-testid="mark-need-score" className="me-auto text-[12.5px] font-semibold text-[var(--ink-3)]">{h("markNeedScore")}</span>}
        {!readOnly && <Button variant="ghost" className={`min-h-[44px] ${FOCUS}`} disabled={!!busy || !valid} onClick={() => void submit(false)}>{busy === "save" ? h("saving") : row.status === "marked" ? h("updateMark") : h("saveMark")}</Button>}
        {!readOnly && hasNext && <Button variant="solid" className={`min-h-[44px] ${FOCUS}`} disabled={!!busy || !valid} onClick={() => void submit(true)}>{busy === "next" ? h("saving") : h("markNext")}</Button>}
      </>}>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <div className="grid content-start gap-4">
          {!handedIn && <Notice tone="gold">{h("paperNote")}</Notice>}

          <section>
            <div className="mb-1.5 text-[11px] font-extrabold uppercase tracking-[0.08em] text-[var(--ink-3)]">{h("theirAnswer")}</div>
            {row.text.trim() ? (
              <p className="whitespace-pre-wrap break-words rounded-xl border border-[var(--line)] bg-[var(--panel)] px-3.5 py-3 text-[13px] leading-relaxed text-[var(--ink)]">{row.text}</p>
            ) : (
              <p className="rounded-xl border border-dashed border-[var(--line)] px-3.5 py-3 text-[12.5px] text-[var(--ink-3)]">{handedIn ? h("noWritten") : h("nothingYet")}</p>
            )}
          </section>

          {row.attachments.length > 0 && (
            <section>
              <div className="mb-1.5 text-[11px] font-extrabold uppercase tracking-[0.08em] text-[var(--ink-3)]">{h("filesN", { n: row.attachments.length })}</div>
              <div className="grid gap-2 sm:grid-cols-2">{row.attachments.map((f) => <FileTile key={f.id} f={f} />)}</div>
            </section>
          )}

          {attemptIds.length > 0 && (
            <section className="grid gap-2.5">
              <div className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-[var(--ink-3)]">{h("workByQuestion")}</div>
              {attemptIds.map((id) => (
                <AttemptRail key={id} attemptId={id} qs={qs} readOnly={readOnly} showTitle={attemptIds.length > 1} awards={awards[id]}
                  onAward={(qid, v) => setAwards((a) => ({ ...a, [id]: { ...(a[id] ?? {}), [qid]: v } }))}
                  onLoaded={(r) => setResults((cur) => (cur[id] === r ? cur : { ...cur, [id]: r }))} />
              ))}
              {rail.pending > 0 && <p className="m-0 text-[12px] font-semibold text-[var(--gold)]">{h("pendingLeft", { n: rail.pending })}</p>}
            </section>
          )}
        </div>

        <div className="grid content-start gap-3 rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-4">
          <div className="text-[13px] font-extrabold text-[var(--ink)]" style={{ fontFamily: "var(--ff-display)" }}>{row.status === "marked" ? h("yourMark") : h("markThis")}</div>
          {auto && <p className="m-0 text-[11.5px] leading-snug text-[var(--ink-3)]">{h("autoNote")}</p>}
          {err && <Notice onClose={() => setErr(null)}>{err}</Notice>}
          {attemptIds.length > 0 && rail.all && rail.out > 0 && (
            <div className="flex items-center justify-between rounded-xl bg-[var(--surface)] px-3 py-2 text-[12.5px] font-bold text-[var(--ink-2)]"><span>{h("railTotal")}</span><span className="tabular-nums text-[var(--ink)]">{rail.got}/{rail.out}</span></div>
          )}
          <div className="flex items-end gap-2">
            <div className="min-w-0 flex-1">
              <FieldLabel htmlFor="hub-mark-score">{h("score")}</FieldLabel>
              <Input id="hub-mark-score" data-autofocus type="number" inputMode="decimal" min={0} step="any" className="min-h-[44px] w-full" value={score} disabled={readOnly} onChange={(e) => { setTouched(true); setScore(e.target.value); }} />
            </div>
            <span className="pb-3 text-[16px] font-bold text-[var(--ink-3)]" aria-hidden>/</span>
            <div className="min-w-0 flex-1">
              <FieldLabel htmlFor="hub-mark-max">{h("outOf")}</FieldLabel>
              <Input id="hub-mark-max" type="number" inputMode="decimal" min={1} step="any" className="min-h-[44px] w-full" value={max} disabled={readOnly} onChange={(e) => { setTouched(true); setMax(e.target.value); }} />
            </div>
          </div>
          {touched && attemptIds.length > 0 && rail.all && rail.out > 0 && !readOnly && (
            <button type="button" onClick={() => { setTouched(false); setScore(String(rail.got)); setMax(String(rail.out)); }} className={`min-h-[44px] w-fit rounded-lg text-[12px] font-bold text-[var(--brand)] hover:underline ${FOCUS}`}>{h("useRail", { got: rail.got, out: rail.out })}</button>
          )}
          {valid && <div><ProgressBar pct={pctOf({ score: s, max: m })} tone="green" label={h("markLabel")} /><div className="mt-1 text-end text-[11.5px] font-bold text-[var(--ink-3)]">{pctOf({ score: s, max: m })}%</div></div>}
          <div>
            <FieldLabel htmlFor="hub-mark-feedback">{h("feedback")}</FieldLabel>
            <textarea id="hub-mark-feedback" rows={5} maxLength={4000} value={feedback} disabled={readOnly} onChange={(e) => setFeedback(e.target.value)} placeholder={h("feedbackPh")}
              className="w-full resize-y rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2.5 py-2 text-[13px] leading-relaxed text-[var(--ink)] outline-none focus:border-[var(--brand)]" />
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {QUICK.map((k) => { const q = h(k); return (
                <button key={k} type="button" onClick={() => setFeedback((f) => (f.trim() ? `${f.trim()} ${q}` : q))} className={`min-h-[44px] lg:min-h-[34px] rounded-full border border-[var(--line)] bg-[var(--surface)] px-2.5 text-[11.5px] font-semibold text-[var(--ink-2)] hover:border-[var(--brand)] ${FOCUS}`}>+ {q.length > 28 ? `${q.slice(0, 26)}…` : q}</button>
              ); })}
              {bank.snippets.map((sn) => (
                <button key={sn} type="button" disabled={readOnly} data-testid="hub-fb-chip" title={sn} onClick={() => setFeedback((f) => (f.trim() ? `${f.trim()} ${sn}` : sn))}
                  className={`min-h-[44px] lg:min-h-[34px] rounded-full border border-[var(--brand-line)] bg-[var(--brand-soft)] px-2.5 text-[11.5px] font-semibold text-[var(--brand-strong)] hover:border-[var(--brand)] ${FOCUS}`}>+ {sn.length > 40 ? `${sn.slice(0, 38)}…` : sn}</button>
              ))}
              {!readOnly && <button type="button" data-testid="hub-fb-manage" onClick={() => setManaging(true)} className={`min-h-[44px] lg:min-h-[34px] rounded-full border border-dashed border-[var(--line)] px-2.5 text-[11.5px] font-bold text-[var(--ink-2)] hover:border-[var(--brand)] ${FOCUS}`}>✎ {tx("hubextras.fb_manage")}</button>}
            </div>
          </div>
          <p className="text-[11.5px] leading-snug text-[var(--ink-3)]">{h("notifyNote")}</p>
        </div>
      </div>
      {managing && <FeedbackManager snippets={bank.snippets} max={bank.max} maxLen={bank.maxLen} onSave={bank.save} onClose={() => setManaging(false)} />}
    </Dialog>
  );
}
