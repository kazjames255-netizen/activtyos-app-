"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui";
import type { AnswerOut, Backend, PublicItem, QuizResult, StartResult } from "./store";

// Shared runner for the three "quiz arcade" games (Prime Reef / Data Carnival / Shape Workshop). One component, one
// theme prop per game — following docs/games-prototypes/BACKEND-PATTERN.md's "don't fork it" rule at the UI layer
// too, since all three play identically (a run of multiple-choice items) and differ only in colour/copy.
//
// Why there's no live "correct!"/"wrong!" flash per question (docs/games-prototypes/ARCADE-BRIEF.md #5 asks for
// one): the server NEVER sends the correct answer to the browser until the whole run is marked (BACKEND-PATTERN's
// one rule — "the browser never sends a score" cuts both ways: it also never RECEIVES the answer key mid-run, or a
// captured network response would hand a modified client the answers). That is the same shape as the existing MTC
// practice mode (features/learninghub/games/penguin/MtcPractice.tsx) — no per-question reveal, a real mark at the
// end. The juice here is instead: a snappy, timer-free run with a mascot that visibly advances one step per
// question answered, and a big, honest reveal (score, streak, coins, a full per-question review with
// explanations) once the server has actually marked it.
export interface QuizTheme {
  gameId: string;
  title: string;
  mascot: string;
  /** A CSS custom-property NAME (not a literal colour), e.g. "--cat-5" — never green (content rule: no green as a
   *  persistent brand colour). */
  accentVar: string;
  frameWord: string; // "reef tile" | "stall" | "piece" — used in the progress caption
  icon: string; // the per-step progress icon
}

type Phase = "loading" | "error" | "playing" | "locking" | "done";

interface RunState { session: StartResult; index: number; streak: number; answers: AnswerOut[]; shownAt: number; pausedAccum: number }

export function QuizRunner({ theme, backend, onExit }: { theme: QuizTheme; backend: Backend; onExit: () => void }) {
  const [phase, setPhase] = useState<Phase>("loading");
  const [error, setError] = useState<string | null>(null);
  const [run, setRun] = useState<RunState | null>(null);
  const [result, setResult] = useState<QuizResult | null>(null);
  const [paused, setPaused] = useState(false);
  const pauseStartRef = useRef<number | null>(null);
  const finishingRef = useRef(false);

  const beginRun = useCallback(async () => {
    setPhase("loading"); setError(null); setResult(null);
    try {
      const session = await backend.start();
      setRun({ session, index: 0, streak: 0, answers: session.items.map((it) => ({ id: it.id, chosen: null, ms: 0 })), shownAt: Date.now(), pausedAccum: 0 });
      setPhase("playing");
    } catch (e) { setError((e as Error).message || "Could not start the game"); setPhase("error"); }
  }, [backend]);

  useEffect(() => { void beginRun(); }, [beginRun]);

  const submitRun = useCallback(async (answers: AnswerOut[], session: StartResult) => {
    if (finishingRef.current) return;
    finishingRef.current = true;
    try {
      const r = await backend.finish(session.sessionId, answers);
      setResult(r); setPhase("done");
    } catch (e) { setError((e as Error).message || "Could not save this run"); setPhase("error"); }
    finally { finishingRef.current = false; }
  }, [backend]);

  const choose = useCallback((choiceIndex: number) => {
    if (!run || phase !== "playing" || paused) return;
    const ms = Math.max(0, Date.now() - run.shownAt - run.pausedAccum);
    const answers = run.answers.map((a, i) => (i === run.index ? { ...a, chosen: choiceIndex, ms } : a));
    const nextIndex = run.index + 1;
    setPhase("locking");
    window.setTimeout(() => {
      if (nextIndex >= run.session.items.length) { setRun({ ...run, answers }); void submitRun(answers, run.session); return; }
      setRun({ ...run, index: nextIndex, answers, shownAt: Date.now(), pausedAccum: 0, streak: run.streak + 1 });
      setPhase("playing");
    }, 260); // a short, snappy "locking in" beat — never a modal, never long enough to feel like a pause on thinking
  }, [run, phase, paused, submitRun]);

  const quitEarly = useCallback(() => {
    if (!run) { onExit(); return; }
    if (phase === "done") { onExit(); return; }
    if (!window.confirm("Quit this run? Your answers so far will still be saved.")) return;
    void submitRun(run.answers, run.session).then(onExit);
  }, [run, phase, submitRun, onExit]);

  // Pause: Escape/P, an explicit button, and auto-pause when the tab is hidden — the same fallback the sibling
  // pause/resume work (docs/games-prototypes/BACKEND-PATTERN.md) describes for Penguin/Turbo Slide today. There is
  // no per-question timer to freeze (no time pressure on thinking, per the content rules), so pausing here just
  // blocks input and keeps the response-time log honest by not counting paused time.
  const togglePause = useCallback((next: boolean) => {
    if (phase !== "playing") return;
    setPaused(next);
    if (next) pauseStartRef.current = Date.now();
    else if (pauseStartRef.current && run) { const dt = Date.now() - pauseStartRef.current; pauseStartRef.current = null; setRun({ ...run, pausedAccum: run.pausedAccum + dt }); }
  }, [phase, run]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" || e.key === "p" || e.key === "P") togglePause(!paused); };
    const onVis = () => { if (document.hidden) togglePause(true); };
    window.addEventListener("keydown", onKey); document.addEventListener("visibilitychange", onVis);
    return () => { window.removeEventListener("keydown", onKey); document.removeEventListener("visibilitychange", onVis); };
  }, [paused, togglePause]);

  const accent = `var(${theme.accentVar})`;
  const soft = `color-mix(in srgb, ${accent} 16%, var(--surface))`;

  if (phase === "loading") return <Center><SkeletonSpin theme={theme} /></Center>;
  if (phase === "error") return (
    <Center>
      <p className="m-0 mb-3 text-[13px] font-bold text-[var(--sem-crit)]">{error}</p>
      <Button variant="solid" onClick={beginRun}>Try again</Button>
    </Center>
  );
  if (phase === "done" && result) return <ReviewScreen theme={theme} result={result} onPlayAgain={beginRun} onExit={onExit} />;
  if (!run) return null;

  const item = run.session.items[run.index]!;
  return (
    <div className="relative flex h-full flex-col" style={{ background: `linear-gradient(180deg, ${soft}, var(--surface))` }} data-testid={`quiz-${theme.gameId}-runner`}>
      <div className="flex items-center justify-between px-4 pt-3">
        <div className="flex items-center gap-2 text-[13px] font-extrabold" style={{ color: accent }}>
          <span aria-hidden>{theme.mascot}</span><span>{theme.title}</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[12px] font-bold text-[var(--ink-2)] tabular-nums" data-testid="quiz-progress">{run.index + 1} / {run.session.items.length}</span>
          <button type="button" onClick={() => togglePause(true)} aria-label="Pause" data-testid="quiz-pause"
            className="grid h-8 w-8 place-items-center rounded-lg border border-[var(--line)] bg-[var(--panel)] text-[13px] font-bold text-[var(--ink-2)] hover:text-[var(--ink)]">⏸</button>
        </div>
      </div>
      <ProgressTrack theme={theme} total={run.session.items.length} current={run.index} accent={accent} />
      <div className="flex flex-1 flex-col items-stretch justify-center gap-4 px-4 pb-6">
        <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4 shadow-[var(--shadow-sm)]">
          <span className="mb-1 inline-block rounded-full px-2 py-0.5 text-[10.5px] font-extrabold uppercase tracking-wide" style={{ background: soft, color: accent }}>{topicLabel(item.topic)}</span>
          <h3 className="m-0 text-[16px] font-extrabold leading-snug text-[var(--ink)]" data-testid="quiz-prompt">{item.prompt}</h3>
        </div>
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          {item.choices.map((c, i) => (
            <button key={`${item.id}-${i}`} type="button" data-testid={`quiz-choice-${i}`} disabled={phase !== "playing" || paused}
              onClick={() => choose(i)}
              className="min-h-[52px] rounded-xl border-2 px-4 py-2.5 text-start text-[14px] font-bold text-[var(--ink)] transition disabled:opacity-60"
              style={{ borderColor: "var(--line)", background: "var(--panel)" }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = accent; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "var(--line)"; }}>
              {c}
            </button>
          ))}
        </div>
      </div>
      {paused && (
        <div className="absolute inset-0 grid place-items-center rounded-2xl" style={{ background: "color-mix(in srgb, var(--bg) 70%, transparent)" }} data-testid="quiz-paused">
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-6 shadow-[var(--shadow-md)]">
            <span className="text-[15px] font-extrabold text-[var(--ink)]">Paused</span>
            <Button variant="solid" onClick={() => togglePause(false)} data-testid="quiz-resume">Resume</Button>
            <button type="button" onClick={quitEarly} className="text-[12px] font-bold text-[var(--ink-3)] hover:text-[var(--ink)]">Quit run</button>
          </div>
        </div>
      )}
    </div>
  );
}

function Center({ children }: { children: React.ReactNode }) {
  return <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center">{children}</div>;
}
function SkeletonSpin({ theme }: { theme: QuizTheme }) {
  return <><span className="text-[32px]" aria-hidden>{theme.mascot}</span><span className="text-[13px] font-bold text-[var(--ink-2)]">Getting the {theme.title} run ready…</span></>;
}
function ProgressTrack({ theme, total, current, accent }: { theme: QuizTheme; total: number; current: number; accent: string }) {
  return (
    <div className="flex items-center justify-center gap-1.5 px-4 py-2" aria-hidden data-testid="quiz-track">
      {Array.from({ length: total }, (_, i) => (
        <span key={i} className="grid h-7 w-7 place-items-center rounded-lg text-[13px] transition-transform"
          style={{ background: i < current ? accent : i === current ? "color-mix(in srgb, " + accent + " 30%, var(--surface))" : "var(--panel)", opacity: i <= current ? 1 : 0.55, transform: i === current ? "scale(1.12)" : "scale(1)" }}>
          {i < current ? "✓" : theme.icon}
        </span>
      ))}
    </div>
  );
}
function topicLabel(topic: string): string {
  return topic.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase()).trim();
}

function ReviewScreen({ theme, result, onPlayAgain, onExit }: { theme: QuizTheme; result: QuizResult; onPlayAgain: () => void; onExit: () => void }) {
  const accent = `var(${theme.accentVar})`;
  const wrong = result.rows.filter((r) => !r.ok);
  return (
    <div className="flex h-full flex-col overflow-y-auto p-5" data-testid={`quiz-${theme.gameId}-done`}>
      <div className="mb-4 flex flex-col items-center gap-1 text-center">
        <span className="text-[40px]" aria-hidden>{result.score === result.total ? "🏆" : theme.mascot}</span>
        <h3 className="m-0 text-[20px] font-extrabold text-[var(--ink)]">{result.score} / {result.total} correct</h3>
        {result.newBest && <span className="text-[12px] font-extrabold" style={{ color: accent }}>New best!</span>}
        <p className="m-0 text-[12.5px] font-semibold text-[var(--ink-2)]">Best streak this run: {result.bestStreak} · +{result.coins} coins earned</p>
      </div>
      {!!wrong.length && (
        <div className="mb-4 flex flex-col gap-2">
          <h4 className="m-0 text-[12.5px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]">Worth another look</h4>
          {wrong.map((r) => (
            <div key={r.id} className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3" data-testid="quiz-review-row">
              <p className="m-0 mb-1 text-[13px] font-bold text-[var(--ink)]">{r.prompt}</p>
              <p className="m-0 text-[12px] font-semibold text-[var(--ink-2)]">Your answer: {r.chosen ?? "—"} · Correct: <span style={{ color: accent }}>{r.correct}</span></p>
              <p className="m-0 mt-1 text-[12px] text-[var(--ink-3)]">{r.explain}</p>
            </div>
          ))}
        </div>
      )}
      <div className="mt-auto flex gap-2.5 pt-2">
        <Button variant="solid" className="flex-1 !min-h-[46px]" onClick={onPlayAgain} data-testid="quiz-play-again">Play again</Button>
        <Button variant="ghost" className="flex-1 !min-h-[46px]" onClick={onExit} data-testid="quiz-back">Back to games</Button>
      </div>
    </div>
  );
}
