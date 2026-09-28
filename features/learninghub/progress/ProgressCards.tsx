"use client";

import type { ReactNode } from "react";
import { useI18n } from "@/lib/i18n/provider";
import { useHubMessagesReady } from "@/lib/i18n/hubMessages";
import type { PanelProps } from "../panelTypes";
import { hubPath } from "../shared-assess/api";
import { useHubData } from "../shared-assess/hooks";
import { display } from "../shared-assess/ui";
import { tint } from "../kit";
import type { StudentHomework } from "../homework/hwTypes";
import { useGamesPlayed } from "../games/GamesPlayedPanel";
import { useNow } from "../teachKit";

// The row of colourful "at a glance" cards on Progress: quizzes (from the mastery data ProgressView already loaded), then games, homework and flashcards
// (each read from its own endpoint; a card whose data is unavailable just shows a dash). Each card has its own colour so they are easy to tell apart.
function Card({ color, icon, label, value, sub, testId }: { color: string; icon: string; label: string; value: ReactNode; sub?: ReactNode; testId: string }) {
  return (
    <div data-testid={testId} className="rounded-2xl px-3.5 py-3" style={{ background: `linear-gradient(135deg, ${tint(color, 26)}, ${tint(color, 9)})`, border: `1.5px solid ${tint(color, 42)}` }}>
      <div className="flex items-center gap-2">
        <span aria-hidden className="grid h-8 w-8 flex-none place-items-center rounded-full text-[16px]" style={{ background: tint(color, 34) }}>{icon}</span>
        <div className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-[var(--ink-2)]">{label}</div>
      </div>
      <div className="mt-2 text-[26px] font-extrabold leading-none tabular-nums text-[var(--ink)]" style={display}>{value}</div>
      {sub && <div className="mt-1 text-[12px] font-semibold text-[var(--ink-2)]">{sub}</div>}
    </div>
  );
}

export function ProgressCards({ p, childId, quiz }: { p: PanelProps; childId: string; quiz: { latest: { pct: number; title: string } | null; topics: number; subjects: number; taken: number; labels: { latest: string; noQuiz: string; topics: string; across: string; taken: string; recent: string } } }) {
  const { locale, t: tt } = useI18n(); useHubMessagesReady(locale);
  const T = (k: string, v?: Record<string, string | number>) => tt(`hubgames.${k}`, v);
  const q = quiz.labels;
  const now = useNow(60_000);
  const games = useGamesPlayed(childId, p.qs.replace(/^\?/, ""));
  const hw = useHubData<StudentHomework[]>(hubPath(p.qs, "/homework", { childId }), ["hubHomework", "hubSubmissions"]);
  const cards = useHubData<{ dueCount?: number; newCount?: number }>(hubPath(p.qs, "/flashcards/due", { childId }), ["hubCards"]);

  const areas = games.areas;
  const scored = areas.filter((a) => a.correct !== null && a.attempts >= 8).map((a) => ({ a, pct: ((a.correct ?? 0) / a.attempts) * 100 })).sort((x, y) => y.pct - x.pct);
  const rows = Array.isArray(hw.data) ? hw.data.filter((h) => h.childId === childId) : null;
  const handed = rows ? rows.filter((h) => h.submission.status !== "assigned").length : 0;
  const todo = rows ? rows.filter((h) => h.submission.status === "assigned") : [];
  const overdue = todo.filter((h) => new Date(h.dueAt).getTime() < now).length;

  return (
    <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-3" data-testid="hub-progress-cards">
      <Card testId="pc-quiz" color="var(--cat-4)" icon="📝" label={q.latest} value={quiz.latest ? `${Math.round(quiz.latest.pct)}%` : "–"} sub={quiz.latest ? quiz.latest.title : q.noQuiz} />
      <Card testId="pc-topics" color="var(--cat-2)" icon="🧩" label={q.topics} value={quiz.topics} sub={q.across} />
      <Card testId="pc-taken" color="var(--cat-6)" icon="✅" label={q.taken} value={quiz.taken >= 20 ? "20+" : quiz.taken} sub={q.recent} />
      <Card testId="pc-games" color="var(--cat-10)" icon="🎮" label={T("pc_games")} value={areas.length ? areas.length : "–"}
        sub={areas.length ? (scored.length > 1 ? T("pc_games_strong", { area: T(`pl_a_${scored[0]!.a.area}`) }) : T("pc_games_sub")) : T("pc_games_none")} />
      <Card testId="pc-homework" color="var(--green)" icon="📚" label={T("pc_hw")} value={rows && rows.length ? `${handed}/${rows.length}` : "–"}
        sub={!rows || !rows.length ? T("pc_hw_none") : overdue ? T("pc_hw_overdue", { n: overdue }) : todo.length ? T("pc_hw_todo", { n: todo.length }) : T("pc_hw_clear")} />
      <Card testId="pc-cards" color="var(--cat-1)" icon="🃏" label={T("pc_cards")} value={cards.data ? cards.data.dueCount ?? 0 : "–"}
        sub={cards.data ? ((cards.data.newCount ?? 0) > 0 ? T("pc_cards_new", { n: cards.data.newCount ?? 0 }) : (cards.data.dueCount ?? 0) > 0 ? T("pc_cards_sub") : T("pc_cards_none")) : T("pc_cards_none")} />
    </div>
  );
}
