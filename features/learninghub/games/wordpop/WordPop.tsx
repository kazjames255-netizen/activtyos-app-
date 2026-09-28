"use client";
import { useEffect, useRef, useState } from "react";
import { Button, Card } from "@/components/ui";
import { useT } from "@/lib/i18n/provider";
import { friendlyError, FOCUS, SkeletonRows } from "../../kit";
import type { SupportProfile } from "../../support";
import type { QuizAnswerOut, QuizBackend, QuizFinished, QuizStarted } from "../quiz/store";

// WORD POP — the arcade-paced game of the four: quick-fire spelling patterns, homophones and common exception
// words, popped before the timer runs out. Genuinely its own screen (not QuizRunner) because the mechanic is
// timed, but it is built on the EXACT same server contract as every other quiz-quest game (POST /games/sessions,
// POST /games/sessions/:id/finish) - see server/src/lib/hubQuizGames.ts / features/learninghub/games/wordpop/core.ts
// for how the server marks it (a slow answer is a miss no matter what was picked; scoring is base-10-times-combo).
//
// Honesty rule this file follows carefully: the client is NEVER told which option is correct (the plan sent by the
// server carries prompt + options only), so unlike a physics game where the child's own steering IS the answer,
// this game cannot legitimately show "correct!"/"wrong!" the instant a bubble is tapped - only the SERVER knows
// that, once every item is in. What the client CAN honestly know without being told: whether an answer was given
// inside the time window. So lives are lost only on a timeout (a real, client-observable event), the on-screen
// "streak" counter tracks answers given in time (never correctness), and the real combo/score - the number that
// counts - is exactly what the server hands back on the results screen, same as every other game here.
const ACCENT = "#c1447e"; const ACCENT_SOFT = "color-mix(in srgb, #c1447e 16%, var(--surface))";
const LIVES_START = 3;

type Phase = { kind: "loading" } | { kind: "intro" } | { kind: "playing"; started: QuizStarted; idx: number; answers: QuizAnswerOut[]; selected: string | null; lives: number; streak: number; bestStreak: number; shownAt: number }
  | { kind: "finishing" } | { kind: "done"; result: QuizFinished; started: QuizStarted } | { kind: "error"; message: string };

export default function WordPop({ backend, support, onExit }: { backend: QuizBackend; support: SupportProfile | undefined; onExit: () => void }) {
  const t = useT();
  const [phase, setPhase] = useState<Phase>({ kind: "loading" });
  const [left, setLeft] = useState(1); // 1 -> 0 fraction of the answer window remaining, for the timer bar
  const reduceMotion = useRef(typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches).current;
  const calm = !!(support?.calm || support?.noTimer);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    let alive = true;
    backend.progress().then(() => { if (alive) setPhase((p) => (p.kind === "loading" ? { kind: "intro" } : p)); }).catch(() => { if (alive) setPhase({ kind: "intro" }); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function begin() {
    setPhase({ kind: "loading" });
    try {
      const started = await backend.start();
      if (!started.plan.length) { setPhase({ kind: "error", message: "No words are ready right now - try again in a moment." }); return; }
      setPhase({ kind: "playing", started, idx: 0, answers: [], selected: null, lives: LIVES_START, streak: 0, bestStreak: 0, shownAt: Date.now() });
    } catch (e) { setPhase({ kind: "error", message: friendlyError((e as Error).message) }); }
  }

  async function submitAll(started: QuizStarted, answers: QuizAnswerOut[]) {
    setPhase({ kind: "finishing" });
    try {
      const result = await backend.finish(started.sessionId, answers);
      setPhase({ kind: "done", result, started });
    } catch (e) { setPhase({ kind: "error", message: friendlyError((e as Error).message) }); }
  }

  const answerMs = phase.kind === "playing" ? (phase.started.answerMs ?? 5000) : 5000;

  // The countdown: a plain rAF loop reading wall-clock time against `shownAt` — never a source of the SCORE, only of
  // the visual bar and the client-observable "ran out of time" event that costs a life / ends the item. Calm mode
  // (forced, not offered, for a support profile that says calm/noTimer) removes the timer entirely: no bar, no
  // timeout, the child can take as long as they like on every word.
  useEffect(() => {
    if (phase.kind !== "playing" || calm) { setLeft(1); return; }
    const budget = answerMs;
    const tick = () => {
      setPhase((p) => {
        if (p.kind !== "playing" || p.selected) return p; // a pick is already in flight — let its own timeout settle
        const elapsed = Date.now() - p.shownAt;
        setLeft(Math.max(0, 1 - elapsed / budget));
        if (elapsed >= budget) return commit(p, null, budget + 1);
        return p;
      });
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase.kind === "playing" ? phase.idx : -1, calm]);
  function commit(p: Extract<Phase, { kind: "playing" }>, chosenId: string | null, ms: number): Phase {
    const item = p.started.plan[p.idx]!;
    const timedOut = ms > answerMs;
    const answers = [...p.answers, { key: item.key, chosenId, ms }];
    const lives = timedOut ? p.lives - 1 : p.lives;
    const streak = timedOut ? 0 : p.streak + 1;
    const bestStreak = Math.max(p.bestStreak, streak);
    const isLast = p.idx === p.started.plan.length - 1;
    const outOfLives = lives <= 0;
    if (isLast || outOfLives) {
      // Out of lives early: still owe the server one answer per plan item (never a partial submission) - fill the
      // rest as honest timeouts, exactly what actually happened to them (never played).
      const rest = p.started.plan.slice(p.idx + 1).map((it) => ({ key: it.key, chosenId: null, ms: answerMs + 1 }));
      void submitAll(p.started, [...answers, ...rest]);
      return { kind: "finishing" };
    }
    return { kind: "playing", started: p.started, idx: p.idx + 1, answers, selected: null, lives, streak, bestStreak, shownAt: Date.now() };
  }

  function pick(optionId: string) {
    if (phase.kind !== "playing" || phase.selected) return;
    const ms = Date.now() - phase.shownAt;
    setPhase({ ...phase, selected: optionId });
    setTimeout(() => setPhase((p) => (p.kind === "playing" ? commit(p, optionId, ms) : p)), 220); // a beat to see the pop before the next word
  }

  if (phase.kind === "loading") return <SkeletonRows rows={4} label={t("hubshell.gamesQuizLoading") || "Loading…"} />;

  if (phase.kind === "error") {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
        <span className="text-[40px]" aria-hidden>{"💬"}</span>
        <p className="m-0 text-[13px] font-bold text-[var(--ink-2)]">{phase.message}</p>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={() => setPhase({ kind: "intro" })}>{t("hubshell.gamesRetry") || "Try again"}</Button>
          <Button variant="ghost" onClick={onExit}>{t("hubshell.gamesBackToGames")}</Button>
        </div>
      </div>
    );
  }

  if (phase.kind === "intro") {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 p-6 text-center" style={{ background: `linear-gradient(160deg, ${ACCENT_SOFT}, var(--surface))` }}>
        <span className="text-[56px]" aria-hidden>{"💬"}</span>
        <h2 className="m-0 text-[20px] font-extrabold" style={{ color: ACCENT, fontFamily: "var(--ff-display)" }}>Word Pop</h2>
        <p className="m-0 max-w-sm text-[13px] font-semibold text-[var(--ink-2)]">Pop the right spelling before it's gone. Quick-fire homophones, tricky words and spelling patterns — 3 lives, no time pressure once you're reading it, just on picking it.</p>
        <Button variant="solid" className="!min-h-[48px] px-6" style={{ background: ACCENT, borderColor: ACCENT }} onClick={begin} data-testid="wordpop-begin">Start popping</Button>
      </div>
    );
  }

  if (phase.kind === "finishing") return <SkeletonRows rows={4} label={t("hubshell.gamesQuizMarking") || "Marking…"} />;

  if (phase.kind === "done") {
    const { result } = phase;
    // `score` here is the combo-weighted POINTS (210), not the number right: dividing it by the question count gave "1750% correct". Count the right answers.
    const pct = result.rows.length ? Math.round((result.rows.filter((r) => r.correct).length / result.rows.length) * 100) : 0;
    return (
      <div className="flex h-full flex-col gap-4 overflow-y-auto p-5" data-testid="wordpop-results">
        <div className="flex flex-col items-center gap-1 text-center">
          <span className="text-[44px]" aria-hidden>{"🎉"}</span>
          <h3 className="m-0 text-[18px] font-extrabold text-[var(--ink)]">{result.score} points</h3>
          <p className="m-0 text-[12.5px] font-bold text-[var(--ink-2)]">{pct}% correct · best combo x{result.bestCombo ?? 1} · {result.pointsTotal} lifetime points</p>
          {result.repeat && <p className="m-0 text-[11px] font-semibold text-[var(--ink-3)]">{t("hubshell.gamesQuizAlreadyRecorded") || "Already recorded."}</p>}
        </div>
        <div className="flex flex-col gap-2">
          {phase.started.plan.map((item) => {
            const row = result.rows.find((r) => r.key === item.key);
            if (!row) return null;
            const chosen = item.options.find((o) => o.id === row.chosenId);
            const correctOpt = item.options.find((o) => o.id === row.correctId);
            return (
              <div key={item.key} className="rounded-xl border p-2.5 text-[12px]" style={{ borderColor: row.correct ? "color-mix(in srgb, #2f9e57 40%, var(--line))" : "color-mix(in srgb, #d64545 40%, var(--line))", background: row.correct ? "color-mix(in srgb, #2f9e57 8%, var(--surface))" : "color-mix(in srgb, #d64545 8%, var(--surface))" }}>
                <p className="m-0 font-bold text-[var(--ink)]">{row.correct ? "✓" : "✕"} {item.prompt}</p>
                {!row.correct && <p className="m-0 mt-1 text-[var(--ink-2)]">You popped: {chosen?.text ?? "— (too slow)"} · Correct: {correctOpt?.text ?? "—"}</p>}
                {row.explanation && <p className="m-0 mt-1 text-[var(--ink-3)]">{row.explanation}</p>}
              </div>
            );
          })}
        </div>
        <div className="mt-1 flex gap-2">
          <Button variant="solid" style={{ background: ACCENT, borderColor: ACCENT }} onClick={begin} data-testid="wordpop-play-again">Play again</Button>
          <Button variant="ghost" onClick={onExit} data-testid="wordpop-back">{t("hubshell.gamesBackToGames")}</Button>
        </div>
      </div>
    );
  }

  // playing
  const { started, idx, selected, lives, streak } = phase;
  const item = started.plan[idx]!;
  return (
    <div className="flex h-full flex-col gap-3 p-4" data-testid="wordpop-playing">
      <div className="flex items-center justify-between text-[11px] font-bold text-[var(--ink-3)]">
        <span>{"💬"} Word Pop · {idx + 1} / {started.plan.length}</span>
        <span aria-label={`${lives} lives left`}>{"❤️".repeat(Math.max(0, lives))}{"🖤".repeat(Math.max(0, LIVES_START - lives))}</span>
      </div>
      {!calm && (
        <div className="h-1.5 w-full overflow-hidden rounded-full" style={{ background: "var(--line)" }}>
          <div className="h-full rounded-full" style={{ width: `${Math.round(left * 100)}%`, background: left < 0.25 ? "#d64545" : ACCENT, transition: reduceMotion ? "none" : "width .06s linear" }} />
        </div>
      )}
      <Card className="flex flex-1 flex-col items-center justify-center gap-4 p-5 text-center">
        {streak >= 3 && <span className="text-[11px] font-extrabold uppercase tracking-wide" style={{ color: ACCENT }}>{streak >= 6 ? "On fire! " : ""}Streak x{streak}</span>}
        <p className="m-0 text-[17px] font-extrabold leading-snug text-[var(--ink)]">{item.prompt}</p>
        <div className="grid w-full max-w-md grid-cols-2 gap-3">
          {item.options.map((o) => {
            const isChosen = selected === o.id;
            return (
              <button key={o.id} type="button" disabled={!!selected} onClick={() => pick(o.id)} data-testid={`wordpop-option-${o.id}`}
                className={`min-h-[52px] rounded-full border-2 px-3 py-2 text-[14px] font-extrabold text-[var(--ink)] transition-transform ${FOCUS} ${!selected ? "hover:scale-[1.04] hover:border-[var(--brand)]" : ""}`}
                style={{ borderColor: isChosen ? ACCENT : "var(--line)", background: isChosen ? ACCENT_SOFT : "var(--surface)", transform: isChosen && !reduceMotion ? "scale(1.08)" : undefined }}>
                {o.text}
              </button>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
