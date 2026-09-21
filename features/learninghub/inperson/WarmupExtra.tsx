"use client";

import { useState } from "react";
import { checkWarmup, type WarmupQuestion } from "../lesson/api";
import { describeAnswer } from "../lesson/answerText";
import { Icon } from "../kit";
import { FOCUS } from "../teachKit";
import { errMsg } from "../types";
import { nameFor } from "./inKit";
import type { ClassStore } from "./useClassState";

// In-person warm-up: the children answer out loud. The tutor can reveal the answer (tutors always see the key) and tap each child's
// result: blank → got it → not yet. The tallies are class-level practice (nothing here feeds mastery); they are kept on the session
// and shown in the summary. Renders under each warm-up question through the lesson player's `warmupExtra` slot.

export function WarmupExtra({ q, noteId, qs, roster, store, hideNames }: { q: WarmupQuestion; noteId: string; qs: string; roster: { childId: string; childName: string }[]; store: ClassStore; hideNames: boolean }) {
  const [shown, setShown] = useState<{ text: string; explanation?: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const reveal = async () => {
    setBusy(true); setErr(null);
    try {
      const v = await checkWarmup(noteId, qs, q.id, null);
      setShown({ text: describeAnswer(v.correctAnswer, q.options) || "Marked by hand", explanation: v.explanation });
    } catch (e) { setErr(errMsg(e, "Couldn't get the answer")); }
    finally { setBusy(false); }
  };
  return (
    <div className="mt-4 rounded-xl border border-[var(--line)] bg-[var(--panel)] p-3" data-testid="ip-warm-extra">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={shown ? () => setShown(null) : reveal} disabled={busy} data-testid="ip-warm-reveal"
          className={`inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border-2 border-[var(--line)] bg-[var(--surface)] px-3.5 text-[13.5px] font-extrabold text-[var(--ink-2)] hover:border-[var(--brand-2)] disabled:opacity-50 ${FOCUS}`}>
          <Icon name="search" size={15} />{shown ? "Hide answer" : busy ? "Getting the answer…" : "Show the answer (tutor only)"}
        </button>
        <span className="text-[12px] font-semibold text-[var(--ink-3)]">Tap each child: got it → not yet → clear</span>
      </div>
      {shown && <p role="note" className="m-0 mt-2.5 rounded-lg border-l-4 border-[var(--green)] bg-[var(--surface)] px-3 py-2 text-[14px] font-semibold text-[var(--ink)]">Answer: {shown.text}{shown.explanation ? ` — ${shown.explanation}` : ""}</p>}
      {err && <p role="alert" className="m-0 mt-2 text-[13px] font-semibold text-[var(--red)]">{err}</p>}
      <div className="mt-2.5 flex flex-wrap gap-2" role="group" aria-label="Who got it">
        {roster.map((c) => {
          const v = store.state.warm[c.childId]?.[q.id];
          const name = nameFor(c.childName, hideNames);
          return (
            <button key={c.childId} type="button" onClick={() => store.tapWarm(c.childId, q.id)} data-testid={`ip-warm-${c.childName}`} aria-label={`${name}: ${v === undefined ? "not recorded" : v ? "got it" : "not yet"}. Tap to change`}
              className={`inline-flex min-h-[44px] items-center gap-1.5 rounded-full border-2 px-3.5 text-[13.5px] font-extrabold ${FOCUS} ${v === true ? "border-[var(--green)] bg-[var(--green-soft)] text-[var(--hub-green-ink)]" : v === false ? "border-[var(--red)] bg-[var(--red-soft)] text-[var(--red)]" : "border-[var(--line)] bg-[var(--surface)] text-[var(--ink-2)]"}`}>
              {v === true && <Icon name="check" size={14} strokeWidth={3} />}{v === false && <Icon name="close" size={14} strokeWidth={3} />}{name}
            </button>
          );
        })}
      </div>
    </div>
  );
}
