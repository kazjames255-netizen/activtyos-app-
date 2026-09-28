"use client";
import { useEffect, useRef, useState } from "react";
import { Button, Card } from "@/components/ui";
import { useT } from "@/lib/i18n/provider";
import { friendlyError, FOCUS, SkeletonRows } from "../../kit";
import type { SupportProfile } from "../../support";
import type { QuizAnswerOut, QuizBackend, QuizFinished, QuizStarted } from "./store";

// Shared runner for the three quiz-quest games (Compass Quest / Museum Vault / Colour Lab). One seeded plan of
// multiple-choice items, one at a time. The plan the server hands over carries NO correctness hint (options only -
// see server/src/lib/hubQuizGames.ts / quiz/core.ts buildPlan), so nothing here can reveal or fake which option is
// right; correctness and the explanation for each item only exist after the server's finish() call re-marks the
// whole run - the results screen is where a child actually sees "was I right" and why (BACKEND-PATTERN.md's one
// rule: the browser never sends a score, and here it can't even locally COMPUTE one before the server has spoken).
// No countdown on reading a question: a child's own thinking time is never timed or penalised.
export interface QuizTheme { title: string; tagline: string; emoji: string; accent: string; accentSoft: string; ink: string; frameNoun: string }

type Phase = { kind: "loading" } | { kind: "intro" } | { kind: "playing"; started: QuizStarted; idx: number; answers: QuizAnswerOut[]; selected: string | null; shownAt: number }
  | { kind: "finishing" } | { kind: "done"; result: QuizFinished; started: QuizStarted } | { kind: "error"; message: string };

export function QuizRunner({ theme, backend, onExit }: { theme: QuizTheme; backend: QuizBackend; support: SupportProfile | undefined; onExit: () => void }) {
  const t = useT();
  const [phase, setPhase] = useState<Phase>({ kind: "loading" });
  const reduceMotion = useRef(typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches).current;

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
      if (!started.plan.length) { setPhase({ kind: "error", message: "No questions are ready right now - try again in a moment." }); return; }
      setPhase({ kind: "playing", started, idx: 0, answers: [], selected: null, shownAt: Date.now() });
    } catch (e) { setPhase({ kind: "error", message: friendlyError((e as Error).message) }); }
  }

  async function submitAll(started: QuizStarted, answers: QuizAnswerOut[]) {
    setPhase({ kind: "finishing" });
    try {
      const result = await backend.finish(started.sessionId, answers);
      setPhase({ kind: "done", result, started });
    } catch (e) { setPhase({ kind: "error", message: friendlyError((e as Error).message) }); }
  }

  if (phase.kind === "loading") return <SkeletonRows rows={4} label={t("hubshell.gamesQuizLoading") || "Loading…"} />;

  if (phase.kind === "error") {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
        <span className="text-[40px]" aria-hidden>{theme.emoji}</span>
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
      <div className="flex h-full flex-col items-center justify-center gap-4 p-6 text-center" style={{ background: `linear-gradient(160deg, ${theme.accentSoft}, var(--surface))` }}>
        <span className="text-[56px]" aria-hidden>{theme.emoji}</span>
        <h2 className="m-0 text-[20px] font-extrabold" style={{ color: theme.ink, fontFamily: "var(--ff-display)" }}>{theme.title}</h2>
        <p className="m-0 max-w-sm text-[13px] font-semibold text-[var(--ink-2)]">{theme.tagline}</p>
        <Button variant="solid" className="!min-h-[48px] px-6" style={{ background: theme.accent, borderColor: theme.accent }} onClick={begin} data-testid="quiz-begin">
          {t("hubshell.gamesQuizBegin") || `Start the ${theme.frameNoun}`}
        </Button>
      </div>
    );
  }

  if (phase.kind === "finishing") return <SkeletonRows rows={4} label={t("hubshell.gamesQuizMarking") || "Marking…"} />;

  if (phase.kind === "done") {
    const { result } = phase;
    const pct = result.total ? Math.round((result.score / result.total) * 100) : 0;
    return (
      <div className="flex h-full flex-col gap-4 overflow-y-auto p-5" data-testid="quiz-results">
        <div className="flex flex-col items-center gap-1 text-center">
          <span className="text-[44px]" aria-hidden>{theme.emoji}</span>
          <h3 className="m-0 text-[18px] font-extrabold text-[var(--ink)]">{result.score} / {result.total}</h3>
          <p className="m-0 text-[12.5px] font-bold text-[var(--ink-2)]">{pct}% correct · +{result.points} points · {result.pointsTotal} total</p>
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
                {!row.correct && <p className="m-0 mt-1 text-[var(--ink-2)]">{t("hubshell.gamesQuizYouSaid") || "You said"}: {chosen?.text ?? "—"} · {t("hubshell.gamesQuizAnswer") || "Answer"}: {correctOpt?.text ?? "—"}</p>}
                {row.explanation && <p className="m-0 mt-1 text-[var(--ink-3)]">{row.explanation}</p>}
              </div>
            );
          })}
        </div>
        <div className="mt-1 flex gap-2">
          <Button variant="solid" style={{ background: theme.accent, borderColor: theme.accent }} onClick={begin} data-testid="quiz-play-again">{t("hubshell.gamesQuizPlayAgain") || "Play again"}</Button>
          <Button variant="ghost" onClick={onExit} data-testid="quiz-back">{t("hubshell.gamesBackToGames")}</Button>
        </div>
      </div>
    );
  }

  // playing
  const { started, idx, answers, selected } = phase;
  const item = started.plan[idx]!;
  const isLast = idx === started.plan.length - 1;

  function choose(optionId: string) {
    if (phase.kind !== "playing") return;
    setPhase({ ...phase, selected: optionId });
  }
  function advance(chosenId: string | null) {
    if (phase.kind !== "playing") return;
    const ms = Date.now() - phase.shownAt;
    const nextAnswers = [...answers, { key: item.key, chosenId, ms }];
    if (isLast) { void submitAll(started, nextAnswers); return; }
    setPhase({ kind: "playing", started, idx: idx + 1, answers: nextAnswers, selected: null, shownAt: Date.now() });
  }

  return (
    <div className="flex h-full flex-col gap-3 p-4" data-testid="quiz-playing">
      <div className="flex items-center justify-between text-[11px] font-bold text-[var(--ink-3)]">
        <span>{theme.emoji} {theme.title}</span>
        <span>{idx + 1} / {started.plan.length}</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full" style={{ background: "var(--line)" }}>
        <div className="h-full rounded-full" style={{ width: `${(idx / started.plan.length) * 100}%`, background: theme.accent, transition: reduceMotion ? "none" : "width .2s ease" }} />
      </div>
      <Card className="flex flex-1 flex-col gap-3 overflow-y-auto p-4">
        {item.passage && (
          <div className="rounded-xl p-3 text-[12.5px] font-semibold leading-relaxed text-[var(--ink-2)]" style={{ background: "var(--panel)" }} data-testid="quiz-passage">
            {item.passage}
          </div>
        )}
        <p className="m-0 text-[15px] font-extrabold leading-snug text-[var(--ink)]">{item.prompt}</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {item.options.map((o) => {
            const isChosen = selected === o.id;
            return (
              <button key={o.id} type="button" onClick={() => choose(o.id)} data-testid={`quiz-option-${o.id}`}
                className={`min-h-[44px] rounded-xl border-2 px-3 py-2 text-start text-[13px] font-bold text-[var(--ink)] hover:border-[var(--brand)] ${FOCUS}`}
                style={{ borderColor: isChosen ? theme.accent : "var(--line)", background: isChosen ? theme.accentSoft : "var(--surface)" }}>
                {o.text}
              </button>
            );
          })}
        </div>
      </Card>
      <div className="flex items-center justify-between">
        <button type="button" onClick={() => advance(null)} className={`text-[11.5px] font-bold text-[var(--ink-3)] hover:text-[var(--ink-2)] ${FOCUS}`} data-testid="quiz-skip">
          {t("hubshell.gamesQuizSkip") || "Skip"}
        </button>
        <Button variant="solid" disabled={!selected} onClick={() => advance(selected)} style={{ background: theme.accent, borderColor: theme.accent }} data-testid="quiz-next">
          {isLast ? (t("hubshell.gamesQuizFinish") || "Finish") : (t("hubshell.gamesQuizNext") || "Next")}
        </Button>
      </div>
    </div>
  );
}
