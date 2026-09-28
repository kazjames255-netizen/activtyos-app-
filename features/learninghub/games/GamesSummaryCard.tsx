"use client";

import { useEffect, useState } from "react";
import { get } from "@/lib/api";
import { useT } from "@/lib/i18n/provider";
import { Icon } from "../kit";
import type { PanelProps } from "../panelTypes";

// A completed run in ANY Learning Hub game IS recorded server-side (each game's own finish() writes to its own
// per-child state - see docs/games-prototypes/BACKEND-PATTERN.md), but that lived only inside each game's own tab -
// nowhere a family or tutor glancing at Progress could see that playing counted for anything. This is that visible
// line, read-only and low-key (games are "low weight" mastery evidence per every game's own `mastery.note` - this
// never claims otherwise). One card, checked against every game's own progress endpoint in turn, showing whichever
// one the child has actually played most recently - new games register themselves in SOURCES below rather than
// forking a second summary card (the same "don't fork it" rule the games themselves follow).
interface NormalisedProgress { fluent: number; facts: number; weekDays: number; weekGoal: number; lastAt: string | null }
interface FactsSummary { totals: { fluent: number; facts: number }; weekDays: number; weekGoal: number; runs: { at: string }[] }
interface QuizSummary { totals: { fluent: number; facts: number }; weekDays: number; weekGoal: number; runs: { at: string }[] }

const fromFacts = (r: FactsSummary): NormalisedProgress => ({ fluent: r.totals.fluent, facts: r.totals.facts, weekDays: r.weekDays, weekGoal: r.weekGoal, lastAt: r.runs[0]?.at ?? null });

// Bot Foundry / Sort Yard / Training Ground don't have a fact-mastery map (their "solved" concept is a puzzle, a
// data round, or a drill-pack best, not a fluency fact) - `solved`/`bests` stand in for `fluent`/`facts` here so
// the one shared card still reads honestly for these three without inventing a fake fluency number.
interface MiniSummary { puzzlesSolved?: number; roundsSolved?: number; bests?: Record<string, unknown>; weekDays: number; weekGoal: number; runs: { at: string }[] }
const fromMini = (r: MiniSummary): NormalisedProgress => ({
  fluent: r.puzzlesSolved ?? r.roundsSolved ?? Object.keys(r.bests ?? {}).length,
  facts: r.puzzlesSolved ?? r.roundsSolved ?? Object.keys(r.bests ?? {}).length,
  weekDays: r.weekDays, weekGoal: r.weekGoal, lastAt: r.runs[0]?.at ?? null,
});

// Prime Reef / Data Carnival / Shape Workshop (number theory / statistics / geometry, server/src/lib/quizArcade.ts):
// a topic is "fluent" once its mastery level reaches 3 (attempts >= 5, accuracy >= 75%, see `levelOf` there) - the
// same idea as a Penguin Slide fact reaching thaw >= 3, just over topics instead of individual facts.
interface QuizArcadeFacts { topics: { level: number }[]; weekDays: number; weekGoal: number; lastPlayedAt: string | null }
const fromQuizArcade = (r: QuizArcadeFacts): NormalisedProgress => ({
  fluent: r.topics.filter((t) => t.level >= 3).length, facts: r.topics.length, weekDays: r.weekDays, weekGoal: r.weekGoal, lastAt: r.lastPlayedAt,
});

// Path + normaliser for every game's progress read. Penguin/Turbo share one read (hubFactState); the quiz-quest
// trio (Compass Quest / Museum Vault / Colour Lab) each have their own (hubQuizGames.ts / hubQuizItemState).
const SOURCES: { path: string; read: (r: unknown) => NormalisedProgress }[] = [
  { path: "/api/learning-hub/games/penguin-slide/facts", read: (r) => fromFacts(r as FactsSummary) },
  { path: "/api/learning-hub/games/compass-quest/progress", read: (r) => fromFacts(r as QuizSummary) },
  { path: "/api/learning-hub/games/museum-vault/progress", read: (r) => fromFacts(r as QuizSummary) },
  { path: "/api/learning-hub/games/colour-lab/progress", read: (r) => fromFacts(r as QuizSummary) },
  // The English/literacy cluster (Debate Keep, Story Detective, Word Vault, Word Pop) - same quiz-quest progress
  // shape (server/src/lib/hubQuizGames.ts quizProgress), registered here rather than a second summary component.
  { path: "/api/learning-hub/games/debate-keep/progress", read: (r) => fromFacts(r as QuizSummary) },
  { path: "/api/learning-hub/games/story-detective/progress", read: (r) => fromFacts(r as QuizSummary) },
  { path: "/api/learning-hub/games/word-vault/progress", read: (r) => fromFacts(r as QuizSummary) },
  { path: "/api/learning-hub/games/word-pop/progress", read: (r) => fromFacts(r as QuizSummary) },
  // Bot Foundry (computing) / Sort Yard (statistics) / Training Ground (generic drill) - own shapes, see fromMini.
  { path: "/api/learning-hub/games/bot-foundry/progress", read: (r) => fromMini(r as MiniSummary) },
  { path: "/api/learning-hub/games/sort-yard/progress", read: (r) => fromMini(r as MiniSummary) },
  { path: "/api/learning-hub/games/training-ground/progress", read: (r) => fromMini(r as MiniSummary) },
  // Prime Reef (number theory) / Data Carnival (statistics) / Shape Workshop (geometry) - own generated-item engine
  // (server/src/lib/quizArcade.ts), registered here rather than a second summary component.
  { path: "/api/learning-hub/games/quiz/prime-reef/facts", read: (r) => fromQuizArcade(r as QuizArcadeFacts) },
  { path: "/api/learning-hub/games/quiz/data-carnival/facts", read: (r) => fromQuizArcade(r as QuizArcadeFacts) },
  { path: "/api/learning-hub/games/quiz/shape-workshop/facts", read: (r) => fromQuizArcade(r as QuizArcadeFacts) },
];

export function GamesSummaryCard({ p }: { p: PanelProps }) {
  const t = useT();
  const [best, setBest] = useState<NormalisedProgress | null | "error">(null);
  useEffect(() => {
    if (!p.childId || !p.childQs) return;
    let alive = true;
    Promise.all(SOURCES.map((s) => get<unknown>(`${s.path}${p.childQs}`).then((r) => s.read(r)).catch(() => null)))
      .then((rows) => {
        if (!alive) return;
        const played = rows.filter((r): r is NormalisedProgress => !!r && r.lastAt !== null);
        if (!played.length) { setBest(null); return; }
        // Show whichever game combines the most total attempted facts/items across all played games, weekDays/goal
        // from the most recently played one (a single, honest "how is practice going" line, not one per game).
        played.sort((a, b) => (b.lastAt ?? "").localeCompare(a.lastAt ?? ""));
        const totals = played.reduce((acc, r) => ({ fluent: acc.fluent + r.fluent, facts: acc.facts + r.facts }), { fluent: 0, facts: 0 });
        setBest({ ...totals, weekDays: played[0]!.weekDays, weekGoal: played[0]!.weekGoal, lastAt: played[0]!.lastAt });
      })
      .catch(() => { if (alive) setBest("error"); });
    return () => { alive = false; };
  }, [p.childId, p.childQs]);
  if (!best || best === "error") return null; // never played anything: no clutter on Progress
  return (
    <button type="button" onClick={() => p.goTo?.("games")} data-testid="hub-games-summary"
      className="flex w-full items-center gap-3 rounded-2xl border border-[var(--line)] bg-[var(--surface)] px-4 py-3 text-start shadow-[var(--shadow-sm)] hover:bg-[var(--panel)]">
      <span className="grid h-9 w-9 flex-none place-items-center rounded-xl text-[18px]" style={{ background: "var(--brand-soft)" }} aria-hidden>🎮</span>
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] font-extrabold text-[var(--ink)]">{t("hubshell.gamesSummaryTitle")}</span>
        <span className="block text-[12px] font-semibold text-[var(--ink-2)]">{t("hubshell.gamesSummaryBody", { fluent: best.fluent, facts: best.facts, days: best.weekDays, goal: best.weekGoal })}</span>
      </span>
      <Icon name="chevronRight" size={16} className="flex-none text-[var(--ink-3)] rtl:-scale-x-100" />
    </button>
  );
}
