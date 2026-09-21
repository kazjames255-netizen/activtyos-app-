"use client";

import { useEffect, useRef } from "react";
import { DISPLAY, FOCUS, fmtClock } from "../teachKit";
import { Ico } from "../teachIcons";

// "Lesson time is up — stay on the call?" — a light, warm card laid ON the call
// (not a browser dialog). It counts down to the moment the room disconnects
// everyone. One press of Stay pushes the room on by 15 minutes for everybody;
// it comes back two minutes before every later cut-off. Announced as an
// alertdialog, the countdown re-announced every 30 s (never every second).

export const mmss = (ms: number) => { const s = Math.max(0, Math.ceil(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; };

export function StayPrompt({ remainingMs, limit, busy, error, closesAt, onStay, onLeave }: {
  remainingMs: number;
  /** The room can't be extended any more today. */
  limit: boolean;
  busy: boolean;
  error: string | null;
  /** When the join window finally closes (ISO/ms) — for the "you can rejoin until…" line. */
  closesAt: number;
  onStay: () => void;
  onLeave: () => void;
}) {
  const stay = useRef<HTMLButtonElement>(null);
  const leave = useRef<HTMLButtonElement>(null);
  useEffect(() => { (limit ? leave : stay).current?.focus({ preventScroll: true }); }, [limit]);
  const low = remainingMs <= 30_000;
  const secs = Math.min(120, Math.max(30, Math.ceil(remainingMs / 30_000) * 30));
  const live = `About ${secs} seconds until the call ends.`;
  return (
    <div role="alertdialog" aria-modal="false" aria-labelledby="stay-title" aria-describedby="stay-desc" data-testid="hub-stay-prompt"
      className="hub-rise pointer-events-auto absolute bottom-4 left-1/2 z-[60] w-[min(560px,calc(100%-24px))] -translate-x-1/2 rounded-3xl border border-[var(--hub-warm-line)] p-4 sm:p-5"
      style={{ background: "var(--hub-warm)", boxShadow: "var(--hub-warm-shadow)", color: "var(--ink)" }}>
      <div className="flex items-start gap-3.5">
        <span aria-hidden className="grid h-12 w-12 flex-none place-items-center rounded-2xl text-white" style={{ background: low ? "linear-gradient(140deg, var(--red), color-mix(in srgb, var(--red) 70%, var(--gold)))" : "linear-gradient(140deg, var(--gold), color-mix(in srgb, var(--gold) 70%, var(--red)))" }}><Ico name="hourglass" size={24} /></span>
        <div className="min-w-0 flex-1">
          <h3 id="stay-title" className="m-0 text-[18px] font-extrabold leading-tight text-[var(--ink)] sm:text-[20px]" style={DISPLAY}>{limit ? "This is the longest a lesson can run today" : "Lesson time is up — stay on the call?"}</h3>
          <p id="stay-desc" className="m-0 mt-1 text-[13px] leading-relaxed text-[var(--ink-2)]">
            {limit
              ? <>The call will close for everyone in the timer below. You can rejoin afterwards until {fmtClock(new Date(closesAt).toISOString())}.</>
              : <>The call ends for everyone when the timer reaches zero. One tap keeps everyone here for 15 more minutes.</>}
          </p>
        </div>
        <div className="flex-none text-right" role="timer" aria-label="Time until the call ends">
          <div className={`text-[34px] font-extrabold leading-none tabular-nums sm:text-[40px] ${low ? "text-[var(--red)]" : "text-[var(--ink)]"}`} style={DISPLAY} data-testid="stay-countdown">{mmss(remainingMs)}</div>
          <div className="mt-1 text-[11px] font-extrabold uppercase tracking-[0.12em] text-[var(--ink-3)]">until it ends</div>
        </div>
      </div>
      {error && <p role="alert" className="m-0 mt-2.5 rounded-lg bg-[var(--red-soft)] px-3 py-2 text-[12.5px] font-semibold text-[var(--red)]">{error}</p>}
      <div className="mt-3.5 flex flex-wrap items-center gap-2.5">
        {!limit && (
          <button ref={stay} type="button" id="hub-stay-btn" onClick={onStay} disabled={busy}
            className={`inline-flex min-h-[54px] flex-1 items-center justify-center gap-2 rounded-2xl px-6 text-[15.5px] font-extrabold text-white shadow-[var(--shadow)] transition hover:brightness-110 disabled:opacity-60 motion-reduce:transition-none sm:flex-none ${FOCUS}`}
            style={{ background: "linear-gradient(180deg, var(--brand-2), var(--brand))" }}>
            <Ico name="clock" size={18} />{busy ? "Extending…" : "Stay on the call (+15 min)"}
          </button>
        )}
        <button ref={leave} type="button" id="hub-stay-leave" onClick={onLeave}
          className={`inline-flex min-h-[54px] items-center justify-center gap-2 rounded-2xl border border-[var(--hub-warm-line)] bg-[var(--surface)] px-5 text-[14px] font-extrabold text-[var(--ink-2)] hover:border-[var(--brand)] hover:text-[var(--brand)] ${FOCUS}`}>
          Leave
        </button>
      </div>
      <span className="sr-only" aria-live="polite" role="status">{live}</span>
    </div>
  );
}
