"use client";

import { useState } from "react";
import type { HubSettings } from "@/lib/hubConfig";
import { ruleOf } from "../shared-assess/api";
import { checkWarmup, type WarmupQuestion } from "../lesson/api";
import { describeAnswer } from "../lesson/answerText";
import { Icon } from "../kit";
import { display } from "../lesson/lessonUi";
import { FOCUS } from "../teachKit";
import { errMsg } from "../types";

// Remote-sync pace "driven" — warm-up: the SAME tag-a-child-onto-an-option idea as in-person's WarmupExtra, but for a
// remote roster (no ClassStore/localStorage — the warm-up was never recorded server-side either way, so a per-question
// key={q.id} remount below is all the "state" this needs). Rendered via LessonPlayer's WarmupStep `extra` slot.

const LETTERS = "ABCDEFGHIJ";

export function RemoteDrivenWarmupExtra({ q, noteId, qs, roster, config }: {
  q: WarmupQuestion; noteId: string; qs: string; roster: { childId: string; childName: string }[]; config: HubSettings;
}) {
  return <RemoteDrivenWarmupCard key={q.id} q={q} noteId={noteId} qs={qs} roster={roster} config={config} />;
}

function RemoteDrivenWarmupCard({ q, noteId, qs, roster, config }: {
  q: WarmupQuestion; noteId: string; qs: string; roster: { childId: string; childName: string }[]; config: HubSettings;
}) {
  const rule = ruleOf(config.questionKinds, q.kind);
  const [armed, setArmed] = useState<string | null>(null);
  const [picks, setPicks] = useState<Record<string, string>>({}); // childId -> optionId
  const [calls, setCalls] = useState<Record<string, "right" | "wrong">>({}); // non-choice fallback
  const [key, setKey] = useState<{ text: string; explanation?: string; correctAnswer?: unknown } | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const checkClass = async () => {
    setBusy(true); setErr(null);
    try {
      const v = await checkWarmup(noteId, qs, q.id, null);
      setKey({ text: describeAnswer(v.correctAnswer, q.options) || "Marked by hand", explanation: v.explanation, correctAnswer: v.correctAnswer });
    } catch (e) { setErr(errMsg(e, "Couldn't get the answer")); }
    finally { setBusy(false); }
  };

  const correctIds = new Set(Array.isArray(key?.correctAnswer) ? (key!.correctAnswer as unknown[]).filter((x): x is string => typeof x === "string") : typeof key?.correctAnswer === "string" ? [key!.correctAnswer] : []);
  const isWrong = (childId: string) => { const o = picks[childId]; return !!key && o !== undefined && !correctIds.has(o); };
  const anyoneWrong = key ? roster.some((c) => isWrong(c.childId)) : false;

  const tag = (optionId: string) => {
    if (!armed) return;
    setPicks((m) => ({ ...m, [armed]: optionId }));
    setArmed(null);
  };

  if (rule !== "choice" && rule !== "multi") {
    return (
      <div className="mt-4 rounded-xl border border-[var(--line)] bg-[var(--panel)] p-3" data-testid="rs-warm-extra">
        <h2 className="m-0 whitespace-pre-wrap text-[20px] font-extrabold leading-snug text-[var(--ink)] [overflow-wrap:anywhere]" style={display}>{q.prompt}</h2>
        <p className="m-0 mt-2.5 text-[12px] font-semibold text-[var(--ink-3)]">Answered out loud — call each child right or not yet.</p>
        <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Who got it">
          {roster.map((c) => {
            const call = (v: "right" | "wrong") => setCalls((m) => {
              const next = { ...m };
              if (next[c.childId] === v) delete next[c.childId]; else next[c.childId] = v;
              return next;
            });
            const v = calls[c.childId];
            return (
              <span key={c.childId} className="inline-flex items-center gap-1 rounded-full border-2 border-[var(--line)] bg-[var(--surface)] py-1 pl-3 pr-1.5">
                <span className="text-[13.5px] font-extrabold text-[var(--ink)]">{c.childName}</span>
                <button type="button" onClick={() => call("right")} aria-pressed={v === "right"} aria-label={`${c.childName}: got it`} data-testid={`rs-warm-right-${c.childName}`}
                  className={`grid h-8 w-8 place-items-center rounded-full border-2 ${FOCUS} ${v === "right" ? "border-[var(--green)] bg-[var(--green)] text-white" : "border-[var(--line)] text-[var(--hub-green-ink)] hover:border-[var(--green)]"}`}><Icon name="check" size={13} strokeWidth={3} /></button>
                <button type="button" onClick={() => call("wrong")} aria-pressed={v === "wrong"} aria-label={`${c.childName}: not yet`} data-testid={`rs-warm-wrong-${c.childName}`}
                  className={`grid h-8 w-8 place-items-center rounded-full border-2 ${FOCUS} ${v === "wrong" ? "border-[var(--red)] bg-[var(--red)] text-white" : "border-[var(--line)] text-[var(--red)] hover:border-[var(--red)]"}`}><Icon name="close" size={13} strokeWidth={3} /></button>
              </span>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="mt-1" data-testid="rs-warm-extra">
      <h2 className="m-0 whitespace-pre-wrap text-[22px] font-extrabold leading-snug text-[var(--ink)] [overflow-wrap:anywhere] sm:text-[26px]" style={display} tabIndex={-1} data-autofocus>{q.prompt}</h2>
      <span className="mt-2 inline-block rounded-full bg-[var(--panel)] px-2.5 py-0.5 text-[11.5px] font-bold text-[var(--ink-3)]">{q.marks} {q.marks === 1 ? "mark" : "marks"}</span>

      <p className="m-0 mt-3 text-[12.5px] font-semibold text-[var(--ink-3)]">{armed ? `Now tap what ${roster.find((r) => r.childId === armed)?.childName ?? ""} said` : "Tap a child, then tap the option they said"}</p>
      <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="Children">
        {roster.map((c) => {
          const on = armed === c.childId;
          const opt = picks[c.childId];
          const wrong = isWrong(c.childId);
          const right = key && opt !== undefined && !wrong;
          return (
            <button key={c.childId} type="button" onClick={() => setArmed(on ? null : c.childId)} data-testid={`rs-warm-name-${c.childName}`} aria-pressed={on}
              className={`inline-flex min-h-[40px] items-center gap-1.5 rounded-full border-2 px-3.5 text-[13.5px] font-extrabold transition ${FOCUS} ${on ? "border-[var(--brand)] bg-[var(--brand)] text-white" : right ? "border-[var(--green)] bg-[var(--green-soft)] text-[var(--hub-green-ink)]" : wrong ? "border-[var(--red)] bg-[var(--red-soft)] text-[var(--red)]" : opt ? "border-[var(--line)] bg-[var(--surface)] text-[var(--ink)]" : "border-dashed border-[var(--line)] bg-[var(--surface)] text-[var(--ink-2)]"}`}>
              {right && <Icon name="check" size={13} strokeWidth={3} />}{wrong && <Icon name="close" size={13} strokeWidth={3} />}{c.childName}{opt && <span className="opacity-70">· {LETTERS[(q.options ?? []).findIndex((o) => o.id === opt)] ?? "?"}</span>}
            </button>
          );
        })}
      </div>

      <ol className="m-0 mt-4 grid list-none gap-2 p-0 sm:grid-cols-2">
        {(q.options ?? []).map((o, i) => {
          const named = roster.filter((c) => picks[c.childId] === o.id);
          const isKey = !!key && correctIds.has(o.id);
          return (
            <li key={o.id}>
              <button type="button" onClick={() => tag(o.id)} disabled={!armed} data-testid={`rs-warm-opt-${LETTERS[i] ?? i}`}
                className={`flex w-full min-h-[52px] flex-wrap items-center gap-2 rounded-xl border-2 px-3.5 py-2.5 text-left transition ${FOCUS} ${isKey ? "border-[var(--green)] bg-[var(--green-soft)]" : "border-[var(--line)] bg-[var(--surface)]"} ${armed ? "hover:border-[var(--brand)] cursor-pointer" : "cursor-default"}`}>
                <span className="grid h-8 w-8 flex-none place-items-center rounded-full bg-[var(--panel)] text-[13px] font-extrabold text-[var(--ink-2)]" aria-hidden>{LETTERS[i] ?? i + 1}</span>
                <span className="min-w-0 flex-1 text-[16px] font-semibold text-[var(--ink)] [overflow-wrap:anywhere]">{o.text}</span>
                {named.map((c) => {
                  const wrong = isWrong(c.childId);
                  const right = key && !wrong;
                  return (
                    <span key={c.childId} className={`inline-flex items-center gap-1 rounded-full border-2 px-2.5 py-1 text-[12px] font-extrabold ${right ? "border-[var(--green)] bg-[var(--green)] text-white" : wrong ? "border-[var(--red)] bg-[var(--red)] text-white" : "border-[var(--violet)] bg-[var(--violet)] text-white"}`}>
                      {right && <Icon name="check" size={11} strokeWidth={3} />}{wrong && <Icon name="close" size={11} strokeWidth={3} />}{c.childName}
                    </span>
                  );
                })}
              </button>
            </li>
          );
        })}
      </ol>

      {err && <p role="alert" className="m-0 mt-3 text-[13px] font-semibold text-[var(--red)]">{err}</p>}
      {key ? (
        anyoneWrong && <p role="note" className="m-0 mt-3 rounded-xl border border-[var(--line)] border-l-4 border-l-[var(--red)] bg-[var(--panel)] px-3.5 py-2.5 text-[14px] font-semibold text-[var(--ink)]">The answer is "{key.text}".{key.explanation ? ` ${key.explanation}` : ""}</p>
      ) : (
        <button type="button" onClick={checkClass} disabled={busy} data-testid="rs-warm-check"
          className={`mt-3 inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border-2 border-[var(--brand)] bg-[var(--brand)] px-4 text-[14px] font-extrabold text-white transition hover:brightness-110 disabled:opacity-50 ${FOCUS}`}>
          <Icon name="check" size={16} />{busy ? "Checking…" : "Check"}
        </button>
      )}
    </div>
  );
}
