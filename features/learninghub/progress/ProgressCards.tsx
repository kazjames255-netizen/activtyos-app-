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
import { useGamesPlayed, verdictOf, TONE } from "../games/GamesPlayedPanel";
import { useNow } from "../teachKit";

// The row of colourful "at a glance" cards on Progress: quizzes (from the mastery data ProgressView already loaded), then games, homework and flashcards
// (each read from its own endpoint; a card whose data is unavailable just shows a dash). Each card has its own colour so they are easy to tell apart.
function Card({ color, icon, label, value, sub, testId }: { color: string; icon: string; label: string; value: ReactNode; sub?: ReactNode; testId: string }) {
  return (
    <div data-testid={testId} className="min-h-[212px] rounded-2xl px-3.5 py-3" style={{ background: `linear-gradient(135deg, ${tint(color, 26)}, ${tint(color, 9)})`, border: `1.5px solid ${tint(color, 42)}` }}>
      <div className="flex items-center gap-2">
        <span aria-hidden className="grid h-8 w-8 flex-none place-items-center rounded-full text-[16px]" style={{ background: tint(color, 34) }}>{icon}</span>
        <div className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-[var(--ink-2)]">{label}</div>
      </div>
      <div className="mt-2 text-[26px] font-extrabold leading-none tabular-nums text-[var(--ink)]" style={display}>{value}</div>
      {sub && <div className="mt-1 text-[12px] font-semibold text-[var(--ink-2)]">{sub}</div>}
    </div>
  );
}

const tone = (pct: number) => (pct >= 80 ? "var(--green)" : pct >= 60 ? "var(--gold)" : "var(--red)");
/** The quiz card: the last five marked quizzes, newest first, one tight line each (title and score). */
function QuizzesCard({ label, empty, total, sub, rows }: { label: string; empty: string; total: number | string; sub: string; rows: { title: string; pct: number }[] }) {
  const color = "var(--cat-4)";
  return (
    <div data-testid="pc-quiz" className="min-h-[212px] rounded-2xl px-3.5 py-3" style={{ background: `linear-gradient(135deg, ${tint(color, 26)}, ${tint(color, 9)})`, border: `1.5px solid ${tint(color, 42)}` }}>
      <div className="flex items-center gap-2">
        <span aria-hidden className="grid h-8 w-8 flex-none place-items-center rounded-full text-[16px]" style={{ background: tint(color, 34) }}>📝</span>
        <div className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-[var(--ink-2)]">{label}</div>
        <div className="ms-auto flex items-baseline gap-1.5"><span className="text-[22px] font-extrabold leading-none tabular-nums text-[var(--ink)]" style={display}>{total}</span><span className="text-[11px] font-semibold text-[var(--ink-2)]">{sub}</span></div>
      </div>
      {rows.length === 0 ? <div className="mt-2 text-[13px] font-semibold text-[var(--ink)]">{empty}</div> : (
        <ul className="m-0 mt-2 grid list-none gap-1 p-0" data-testid="pc-quiz-list">
          {rows.slice(0, 5).map((r, i) => (
            <li key={i} className="flex items-center gap-2 text-[12.5px]">
              <span aria-hidden className="h-2 w-2 flex-none rounded-full" style={{ background: tone(r.pct) }} />
              <span className="min-w-0 flex-1 truncate font-bold text-[var(--ink)]">{r.title}</span>
              <span className="flex-none tabular-nums font-extrabold text-[var(--ink)]">{Math.round(r.pct)}%</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Topics practised: the total, then the names of the five most recent (newest first), each with its mastery score. */
function TopicsCard({ label, total, sub, rows }: { label: string; total: number; sub: string; rows: { name: string; subject: string; pct: number }[] }) {
  const color = "var(--cat-2)";
  return (
    <div data-testid="pc-topics" className="min-h-[212px] rounded-2xl px-3.5 py-3" style={{ background: `linear-gradient(135deg, ${tint(color, 26)}, ${tint(color, 9)})`, border: `1.5px solid ${tint(color, 42)}` }}>
      <div className="flex items-center gap-2">
        <span aria-hidden className="grid h-8 w-8 flex-none place-items-center rounded-full text-[16px]" style={{ background: tint(color, 34) }}>🧩</span>
        <div className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-[var(--ink-2)]">{label}</div>
        <div className="ms-auto flex items-baseline gap-1.5"><span className="text-[22px] font-extrabold leading-none tabular-nums text-[var(--ink)]" style={display}>{total}</span><span className="text-[11px] font-semibold text-[var(--ink-2)]">{sub}</span></div>
      </div>
      {rows.length > 0 && (
        <ul className="m-0 mt-2 grid list-none gap-1 p-0" data-testid="pc-topics-list">
          {rows.slice(0, 5).map((r, i) => (
            <li key={i} className="flex items-center gap-2 text-[12.5px]" title={r.subject}>
              <span aria-hidden className="h-2 w-2 flex-none rounded-full" style={{ background: tone(r.pct) }} />
              <span className="min-w-0 flex-1 truncate font-bold text-[var(--ink)]">{r.name}</span>
              <span className="flex-none tabular-nums font-extrabold text-[var(--ink)]">{Math.round(r.pct)}%</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const RECENT = 5;   // the games card lists only the most recent five areas practised

/** The Games card: same size as the others, colourful; the most recent five areas practised as one tight line each (newest first). */
function GamesCard({ T, areas, scored, unfinished, ready, name }: { T: (k: string, v?: Record<string, string | number>) => string; areas: ReturnType<typeof useGamesPlayed>["areas"]; scored: { a: { area: string }; pct: number }[]; unfinished: number; ready: boolean; name: string }) {
  const color = "var(--cat-10)";
  const recent = areas.slice(0, RECENT);   // useGamesPlayed already sorts by last played, newest first
  const days = areas.find((a) => a.weekDays !== undefined);
  return (
    <div data-testid="pc-games" className="min-h-[212px] rounded-2xl px-3.5 py-3" style={{ background: `linear-gradient(135deg, ${tint(color, 26)}, ${tint(color, 9)})`, border: `1.5px solid ${tint(color, 42)}` }}>
      <div className="flex items-center gap-2">
        <span aria-hidden className="grid h-8 w-8 flex-none place-items-center rounded-full text-[16px]" style={{ background: tint(color, 34) }}>🎮</span>
        <div className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-[var(--ink-2)]">{T("pc_games")}</div>
        {days && <div className="ms-auto text-[11px] font-semibold text-[var(--ink-2)]">{T("pl_week", { days: days.weekDays ?? 0, goal: days.weekGoal ?? 5 })}</div>}
      </div>
      {!ready ? <div aria-busy="true" className="mt-2 text-[13px] text-[var(--ink-2)]">&hellip;</div>
        : recent.length === 0 ? <div className="mt-2 text-[13px] font-semibold text-[var(--ink)]" data-testid={unfinished > 0 ? "games-started" : "games-none"}>{unfinished > 0 ? T("pl_started", { name: name || T("pl_your_child") }) : T("pl_none", { name: name || T("pl_your_child") })}</div>
        : (
          <ul className="m-0 mt-2 grid list-none gap-1 p-0" data-testid="games-played">
            {recent.map((a) => {
              const pct = a.correct === null || !a.attempts ? null : Math.round((a.correct / a.attempts) * 100);
              const v = pct === null ? null : verdictOf(a.attempts, pct);
              return (
                <li key={a.area} data-testid={`games-area-${a.area}`} data-verdict={v ?? ""} title={pct !== null ? T("pl_right", { pct, n: a.attempts }) : undefined} className="flex items-center gap-2 text-[12.5px]">
                  <span aria-hidden className="h-2 w-2 flex-none rounded-full" style={{ background: v ? TONE[v] : "var(--ink-3)" }} />
                  <span className="min-w-0 flex-1 truncate font-bold text-[var(--ink)]">{T(`pl_a_${a.area}`)}</span>
                  <span className="flex-none tabular-nums font-extrabold text-[var(--ink)]">{pct !== null ? `${pct}%` : T("pl_solved", { n: a.solved ?? 0 })}</span>
                  {v && <span className="hidden w-[78px] flex-none text-end text-[11px] font-extrabold sm:inline" style={{ color: TONE[v] }}>{T(`pl_${v}`)}</span>}
                </li>
              );
            })}
          </ul>
        )}
      {scored.length > 1 && <div className="mt-1.5 text-[11.5px] font-semibold text-[var(--ink-2)]">{T("pl_best", { area: T(`pl_a_${scored[0]!.a.area}`) })}</div>}
    </div>
  );
}

export function ProgressCards({ p, childId, quiz }: { p: PanelProps; childId: string; /** null = no quiz results yet: only the games / homework / flashcards cards. */ quiz: null | { latest: { pct: number; title: string } | null; /** the five most recent marked quizzes, newest first */ recent: { title: string; pct: number }[]; /** the five topics practised most recently, newest first (name, subject, mastery %) */ topicsRecent: { name: string; subject: string; pct: number }[]; topics: number; subjects: number; taken: number; who: string; labels: { latest: string; noQuiz: string; topics: string; across: string; taken: string; recent: string } } }) {
  const { locale, t: tt } = useI18n(); useHubMessagesReady(locale);
  const T = (k: string, v?: Record<string, string | number>) => tt(`hubgames.${k}`, v);
  const now = useNow(60_000);
  const who = quiz?.who ?? (p.canEdit ? (p.students.find((x) => x.childId === childId)?.childName ?? "").split(" ")[0] : "");
  const games = useGamesPlayed(childId, p.qs.replace(/^\?/, ""));
  const hw = useHubData<StudentHomework[]>(hubPath(p.qs, "/homework", { childId }), ["hubHomework", "hubSubmissions"]);
  // A family reads its own study queue; a tutor is refused that (it is the child's), so a tutor reads the roster stats and picks this child's row.
  const cards = useHubData<{ dueCount?: number; newCount?: number }>(p.canEdit ? null : hubPath(p.qs, "/flashcards/due", { childId }), ["hubCards"]);
  const stats = useHubData<{ students?: { childId: string; reviewed: number; cardsAvailable: number; due: number; mastered: number; lastReviewedAt: string | null }[] }>(p.canEdit ? hubPath(p.qs, "/flashcards/stats") : null, ["hubFlashcards"]);
  const mine = p.canEdit ? stats.data?.students?.find((x) => x.childId === childId) ?? null : null;

  const areas = games.areas;
  const scored = areas.filter((a) => a.correct !== null && a.attempts >= 8).map((a) => ({ a, pct: ((a.correct ?? 0) / a.attempts) * 100 })).sort((x, y) => y.pct - x.pct);
  // A parent gets this child's homework rows; a tutor gets the tenant's homework list (no per-child status), so count what was set for THIS child.
  const setForChild = p.canEdit && Array.isArray(hw.data) ? (hw.data as unknown as { assignedChildIds?: string[] }[]).filter((h) => h.assignedChildIds?.includes(childId)).length : null;
  const rows = !p.canEdit && Array.isArray(hw.data) ? hw.data.filter((h) => h.childId === childId) : null;
  const handed = rows ? rows.filter((h) => h.submission.status !== "assigned").length : 0;
  const todo = rows ? rows.filter((h) => h.submission.status === "assigned") : [];
  const overdue = todo.filter((h) => new Date(h.dueAt).getTime() < now).length;

  return (
    <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-3" data-testid="hub-progress-cards">
      {quiz && <>
      <QuizzesCard label={quiz.labels.latest} empty={quiz.labels.noQuiz} total={quiz.taken >= 20 ? "20+" : quiz.taken} sub={quiz.labels.taken} rows={quiz.recent} />
      <TopicsCard label={quiz.labels.topics} total={quiz.topics} sub={quiz.labels.across} rows={quiz.topicsRecent} />
      </>}
      <GamesCard T={T} areas={areas} scored={scored} unfinished={games.unfinished} ready={games.parts !== null} name={who} />
      <Card testId="pc-homework" color="var(--green)" icon="📚" label={T("pc_hw")}
        value={setForChild !== null ? (setForChild || "–") : rows && rows.length ? `${handed}/${rows.length}` : "–"}
        sub={hw.error ? "" : setForChild !== null ? (setForChild ? T("pc_hw_set") : T("pc_hw_none")) : !rows || !rows.length ? T("pc_hw_none") : overdue ? T("pc_hw_overdue", { n: overdue }) : todo.length ? T("pc_hw_todo", { n: todo.length }) : T("pc_hw_clear")} />
      {p.canEdit ? (
        <Card testId="pc-cards" color="var(--cat-1)" icon="🃏" label={T("pc_cards")} value={mine ? `${mine.reviewed}/${mine.cardsAvailable}` : "–"}
          sub={mine ? T("pc_cards_completed") : stats.error ? "" : T("pc_cards_none")} />
      ) : (
      <Card testId="pc-cards" color="var(--cat-1)" icon="🃏" label={T("pc_cards")} value={cards.data ? cards.data.dueCount ?? 0 : "–"}
        sub={cards.data ? ((cards.data.newCount ?? 0) > 0 ? T("pc_cards_new", { n: cards.data.newCount ?? 0 }) : (cards.data.dueCount ?? 0) > 0 ? T("pc_cards_sub") : T("pc_cards_none")) : cards.error ? "" : T("pc_cards_none")} />
      )}
    </div>
  );
}
