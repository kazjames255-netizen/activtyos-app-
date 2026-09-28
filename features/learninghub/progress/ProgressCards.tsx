"use client";

import type { CSSProperties, ReactNode } from "react";
import { useI18n } from "@/lib/i18n/provider";
import { useHubMessagesReady } from "@/lib/i18n/hubMessages";
import type { PanelProps } from "../panelTypes";
import { hubPath, type Mastery } from "../shared-assess/api";
import { useHubI18n } from "../family/hubT";
import { useHubData } from "../shared-assess/hooks";
import { display } from "../shared-assess/ui";
import type { StudentHomework } from "../homework/hwTypes";
import { useGamesPlayed, verdictOf, TONE } from "../games/GamesPlayedPanel";
import { useNow } from "../teachKit";
import { bandOfYear } from "../family/kidCopy";
import { useSupport } from "../family/FamilyContext";

// The row of colourful "at a glance" cards on Progress: quizzes (from the mastery data ProgressView already loaded), then games, homework and flashcards
// (each read from its own endpoint; a card whose data is unavailable just shows a dash). Each card has its own colour so they are easy to tell apart.
//
// Comic-panel chrome (Kaz picked this over nine flatter options — a thick dark outline and a hard offset
// "sticker" shadow, instead of a soft gradient wash). Kaz: "remove the dots" — dropped the halftone texture.
const COMIC_CARD: CSSProperties = { background: "var(--surface)", border: "3px solid var(--ink)", boxShadow: "5px 5px 0 var(--ink)" };
function IconBadge({ icon, color }: { icon: string; color: string }) {
  return <span aria-hidden className="grid h-8 w-8 flex-none place-items-center rounded-full text-[16px]" style={{ background: color, border: "2.5px solid var(--ink)" }}>{icon}</span>;
}
/** The starburst badge for a card's headline count — the comic-panel treatment's signature flourish. */
function StarBurst({ value }: { value: ReactNode }) {
  return (
    <div aria-hidden className="absolute -end-1.5 -top-2.5 grid h-16 w-16 rotate-[8deg] place-items-center"
      style={{ background: "var(--gold)", clipPath: "polygon(50% 0%,61% 35%,98% 35%,68% 57%,79% 91%,50% 70%,21% 91%,32% 57%,2% 35%,39% 35%)" }}>
      <span className="-rotate-[8deg] text-[16px] font-extrabold leading-none text-[var(--ink)]" style={display}>{value}</span>
    </div>
  );
}
function Card({ color, icon, label, value, sub, testId }: { color: string; icon: string; label: string; value: ReactNode; sub?: ReactNode; testId: string }) {
  return (
    <div data-testid={testId} className="min-h-[212px] rounded-2xl px-3.5 py-3" style={COMIC_CARD}>
      <div className="flex items-center gap-2">
        <IconBadge icon={icon} color={color} />
        <div className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-[var(--ink)]">{label}</div>
      </div>
      <div className="mt-2 text-[26px] font-extrabold leading-none tabular-nums text-[var(--ink)]" style={display}>{value}</div>
      {sub && <div className="mt-1 text-[12px] font-semibold text-[var(--ink-2)]">{sub}</div>}
    </div>
  );
}

/** A face for a score, shown beside the percentage: 80+ great, 60-79 good, 40-59 unsure, under 40 struggling. */
const face = (pct: number) => (pct >= 80 ? "😄" : pct >= 60 ? "🙂" : pct >= 40 ? "😕" : "😟");
const tone = (pct: number) => (pct >= 80 ? "var(--green)" : pct >= 60 ? "var(--gold)" : "var(--red)");
/** A child's own view (kid mode) never shows a red dot or a sad face: a low score is a warm gold seedling. Levels are 🌱 Learning · 🌿 Developing · 🌳 Secure. */
const faceOf = (pct: number, kid: boolean) => (kid ? (pct >= 80 ? "🌳" : pct >= 50 ? "🌿" : "🌱") : face(pct));
const toneOf = (pct: number, kid: boolean) => (kid ? (pct >= 80 ? "var(--green)" : "var(--gold)") : tone(pct));
const pctText = (pct: number, show: boolean) => (show ? `${Math.round(pct)}% ` : "");
/** The quiz card: the last five marked quizzes, newest first, one tight line each (title and score). */
function QuizzesCard({ label, empty, total, sub, rows, kid = false, nums = true }: { label: string; empty: string; total: number | string; sub: string; rows: { title: string; pct: number }[]; kid?: boolean; nums?: boolean }) {
  const color = "var(--cat-4)";
  return (
    <div data-testid="pc-quiz" className="relative min-h-[212px] rounded-2xl px-3.5 py-3" style={COMIC_CARD}>
      <StarBurst value={total} />
      <div className="flex items-center gap-2 pe-11">
        <IconBadge icon="📝" color={color} />
        <div className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-[var(--ink)]">{label}</div>
      </div>
      <div className="mt-1 text-[11px] font-semibold text-[var(--ink-2)]">{sub}</div>
      {rows.length === 0 ? <div className="mt-2 text-[13px] font-semibold text-[var(--ink)]">{empty}</div> : (
        <ul className="m-0 mt-2 grid list-none gap-1 p-0" data-testid="pc-quiz-list">
          {rows.slice(0, 5).map((r, i) => (
            <li key={i} className="flex items-center gap-2 text-[12.5px]">
              <span aria-hidden className="h-2 w-2 flex-none rounded-full" style={{ background: toneOf(r.pct, kid) }} />
              <span className="min-w-0 flex-1 truncate font-bold text-[var(--ink)]">{r.title}</span>
              <span className="flex-none tabular-nums font-extrabold text-[var(--ink)]">{pctText(r.pct, nums)}<span aria-hidden className="text-[20px] leading-none align-middle">{faceOf(r.pct, kid)}</span></span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Topics practised: the total, then the names of the five most recent (newest first), each with its mastery score. */
function TopicsCard({ label, total, sub, rows, kid = false, nums = true }: { label: string; total: number; sub: string; rows: { name: string; subject: string; pct: number }[]; kid?: boolean; nums?: boolean }) {
  const color = "var(--cat-2)";
  return (
    <div data-testid="pc-topics" className="relative min-h-[212px] rounded-2xl px-3.5 py-3" style={COMIC_CARD}>
      <StarBurst value={total} />
      <div className="flex items-center gap-2 pe-11">
        <IconBadge icon="🧩" color={color} />
        <div className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-[var(--ink)]">{label}</div>
      </div>
      <div className="mt-1 text-[11px] font-semibold text-[var(--ink-2)]">{sub}</div>
      {rows.length > 0 && (
        <ul className="m-0 mt-2 grid list-none gap-1 p-0" data-testid="pc-topics-list">
          {rows.slice(0, 5).map((r, i) => (
            <li key={i} className="flex items-center gap-2 text-[12.5px]" title={r.subject}>
              <span aria-hidden className="h-2 w-2 flex-none rounded-full" style={{ background: toneOf(r.pct, kid) }} />
              <span className="min-w-0 flex-1 truncate font-bold text-[var(--ink)]">{r.name}</span>
              <span className="flex-none tabular-nums font-extrabold text-[var(--ink)]">{pctText(r.pct, nums)}<span aria-hidden className="text-[20px] leading-none align-middle">{faceOf(r.pct, kid)}</span></span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const RECENT = 5;   // the games card lists only the most recent five areas practised

/** The Games card: same size as the others, colourful; the most recent five areas practised as one tight line each (newest first). */
function GamesCard({ T, areas, scored, unfinished, ready, name, kid = false, nums = true }: { kid?: boolean; nums?: boolean; T: (k: string, v?: Record<string, string | number>) => string; areas: ReturnType<typeof useGamesPlayed>["areas"]; scored: { a: { area: string }; pct: number }[]; unfinished: number; ready: boolean; name: string }) {
  const color = "var(--cat-10)";
  const recent = areas.slice(0, RECENT);   // useGamesPlayed already sorts by last played, newest first
  const days = areas.find((a) => a.weekDays !== undefined);
  return (
    <div data-testid="pc-games" className="min-h-[212px] rounded-2xl px-3.5 py-3" style={COMIC_CARD}>
      <div className="flex items-center gap-2">
        <IconBadge icon="🎮" color={color} />
        <div className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-[var(--ink)]">{T("pc_games")}</div>
        {days && <div className="ms-auto text-[11px] font-semibold text-[var(--ink-2)]">{T("pl_week", { days: days.weekDays ?? 0, goal: days.weekGoal ?? 5 })}</div>}
      </div>
      {!ready ? <div aria-busy="true" className="mt-2 text-[13px] text-[var(--ink-2)]">&hellip;</div>
        : recent.length === 0 ? <div className="mt-2 text-[13px] font-semibold text-[var(--ink)]" data-testid={unfinished > 0 ? "games-started" : "games-none"}>{unfinished > 0 ? T("pl_started", { name: name || T("pl_your_child") }) : T("pl_none", { name: name || T("pl_your_child") })}</div>
        : (
          <ul className="m-0 mt-2 grid list-none gap-1 p-0" data-testid="games-played">
            {recent.map((a) => {
              const pct = a.correct === null || !a.attempts ? null : Math.round((a.correct / a.attempts) * 100);
              const v = pct === null ? null : verdictOf(a.attempts, pct);
              const vt = v ? (kid && v === "needs_help" ? "var(--gold)" : TONE[v]) : "var(--ink-3)";
              return (
                <li key={a.area} data-testid={`games-area-${a.area}`} data-verdict={v ?? ""} title={pct !== null ? T("pl_right", { pct, n: a.attempts }) : undefined} className="flex items-center gap-2 text-[12.5px]">
                  <span aria-hidden className="h-2 w-2 flex-none rounded-full" style={{ background: vt }} />
                  <span className="min-w-0 flex-1 truncate font-bold text-[var(--ink)]">{T(`pl_a_${a.area}`)}</span>
                  <span className="flex-none tabular-nums font-extrabold text-[var(--ink)]">{pct !== null ? <>{nums ? `${pct}% ` : ""}<span aria-hidden className="text-[20px] leading-none align-middle">{faceOf(pct, kid)}</span></> : T("pl_solved", { n: a.solved ?? 0 })}</span>
                  {v && <span className="hidden w-[78px] flex-none text-end text-[11px] font-extrabold sm:inline" style={{ color: vt }}>{T(`pl_${kid && v === "needs_help" ? "getting_there" : v}`)}</span>}
                </li>
              );
            })}
          </ul>
        )}
      {scored.length > 1 && <div className="mt-1.5 text-[11.5px] font-semibold text-[var(--ink-2)]">{T("pl_best", { area: T(`pl_a_${scored[0]!.a.area}`) })}</div>}
    </div>
  );
}

export function ProgressCards({ p, childId, quiz, kid = false, nums = true }: { p: PanelProps; childId: string; /** A child's own view: warm level emoji, no red, and `nums` hides the percentages (Reception–Year 2 / calm). */ kid?: boolean; nums?: boolean; /** null = no quiz results yet: only the games / homework / flashcards cards. */ quiz: null | { latest: { pct: number; title: string } | null; /** the five most recent marked quizzes, newest first */ recent: { title: string; pct: number }[]; /** the five topics practised most recently, newest first (name, subject, mastery %) */ topicsRecent: { name: string; subject: string; pct: number }[]; topics: number; subjects: number; taken: number; who: string; labels: { latest: string; noQuiz: string; topics: string; across: string; taken: string; recent: string } } }) {
  const { locale, t: tt } = useI18n(); useHubMessagesReady(locale);
  const T = (k: string, v?: Record<string, string | number>) => tt(`hubgames.${k}`, v);
  const now = useNow(60_000);
  const who = quiz?.who ?? (p.canEdit ? (p.students.find((x) => x.childId === childId)?.childName ?? "").split(" ")[0] : "");
  const games = useGamesPlayed(childId, p.qs.replace(/^\?/, ""));
  const hw = useHubData<StudentHomework[]>(p.canEdit ? null : hubPath(p.qs, "/homework", { childId }), ["hubHomework", "hubSubmissions"]);
  // A tutor reads the inbox (one row per child per homework, every status) and keeps THIS child's rows.
  const inbox = useHubData<{ childId: string; status: "assigned" | "submitted" | "marked"; dueAt: string }[]>(p.canEdit ? hubPath(p.qs, "/homework/inbox") : null, ["hubHomework", "hubSubmissions"]);
  // A family reads its own study queue; a tutor is refused that (it is the child's), so a tutor reads the roster stats and picks this child's row.
  const cards = useHubData<{ dueCount?: number; newCount?: number }>(p.canEdit ? null : hubPath(p.qs, "/flashcards/due", { childId }), ["hubCards"]);
  const stats = useHubData<{ students?: { childId: string; reviewed: number; cardsAvailable: number; due: number; mastered: number; lastReviewedAt: string | null }[] }>(p.canEdit ? hubPath(p.qs, "/flashcards/stats") : null, ["hubFlashcards"]);
  const mine = p.canEdit ? stats.data?.students?.find((x) => x.childId === childId) ?? null : null;

  const areas = games.areas;
  const scored = areas.filter((a) => a.correct !== null && a.attempts >= 8).map((a) => ({ a, pct: ((a.correct ?? 0) / a.attempts) * 100 })).sort((x, y) => y.pct - x.pct);
  const hers = p.canEdit && Array.isArray(inbox.data) ? inbox.data.filter((r) => r.childId === childId) : null;
  const herMarked = hers ? hers.filter((r) => r.status === "marked").length : 0;
  const herWaiting = hers ? hers.filter((r) => r.status === "submitted").length : 0;
  const herOpen = hers ? hers.filter((r) => r.status === "assigned") : [];
  const herOverdue = herOpen.filter((r) => new Date(r.dueAt).getTime() < now).length;
  const rows = !p.canEdit && Array.isArray(hw.data) ? hw.data.filter((h) => h.childId === childId) : null;
  const handed = rows ? rows.filter((h) => h.submission.status !== "assigned").length : 0;
  const todo = rows ? rows.filter((h) => h.submission.status === "assigned") : [];
  const overdue = todo.filter((h) => new Date(h.dueAt).getTime() < now).length;

  return (
    <div className="grid grid-cols-1 gap-2.5 min-[440px]:grid-cols-2 lg:grid-cols-3" data-testid="hub-progress-cards">
      {quiz && <>
      <QuizzesCard label={quiz.labels.latest} empty={quiz.labels.noQuiz} total={quiz.taken >= 20 ? "20+" : quiz.taken} sub={quiz.labels.taken} rows={quiz.recent} kid={kid} nums={nums} />
      <TopicsCard label={quiz.labels.topics} total={quiz.topics} sub={quiz.labels.across} rows={quiz.topicsRecent} kid={kid} nums={nums} />
      </>}
      <GamesCard T={T} areas={areas} scored={scored} unfinished={games.unfinished} ready={games.parts !== null} name={who} kid={kid} nums={nums} />
      {p.canEdit ? (
        <Card testId="pc-homework" color="var(--green)" icon="📚" label={T("pc_hw")} value={hers && hers.length ? `${herMarked + herWaiting}/${hers.length}` : "–"}
          sub={!hers ? (inbox.error ? "" : "") : !hers.length ? T("pc_hw_none") : (
            <span className="grid gap-0.5" data-testid="pc-hw-summary">
              <span>{T("pc_hw_handed")}</span>
              {herMarked > 0 && <span>{T("pc_hw_marked", { n: herMarked })}</span>}
              {herWaiting > 0 && <span>{T("pc_hw_waiting", { n: herWaiting })}</span>}
              {herOpen.length > 0 && <span className={herOverdue ? "font-extrabold text-[var(--red)]" : ""}>{T("pc_hw_incomplete", { n: herOpen.length })}{herOverdue ? ` (${T("pc_hw_overdue", { n: herOverdue })})` : ""}</span>}
            </span>
          )} />
      ) : (
      <Card testId="pc-homework" color="var(--green)" icon="📚" label={T("pc_hw")}
        value={rows && rows.length ? `${handed}/${rows.length}` : "–"}
        sub={hw.error ? "" : !rows || !rows.length ? T("pc_hw_none") : overdue ? T("pc_hw_overdue", { n: overdue }) : todo.length ? T("pc_hw_todo", { n: todo.length }) : T("pc_hw_clear")} />
      )}
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

/** The same cards for a CHILD's own Progress (kid mode): loads the child's mastery itself, builds the quiz / topic lines, then shows the cards. */
export function KidProgressCards({ p, childId }: { p: PanelProps; childId: string }) {
  const calm = useSupport().calm;
  const band = bandOfYear(p.students.find((x) => x.childId === childId)?.yearGroup);
  const { data } = useHubData<Mastery>(hubPath(p.qs, "/mastery", { childId }), ["hubMastery", "hubAttempts"]);
  const { t, tp } = useHubI18n();
  if (!data) return null;
  const started = data.subjects.filter((sb) => sb.masteryPct != null || sb.topics.some((tp2) => tp2.attempts > 0)).length;
  const sorted = [...data.trend].sort((a, b) => b.at.localeCompare(a.at));
  return (
    <ProgressCards p={p} childId={childId} kid nums={!(calm || band === "ks1")} quiz={{
      latest: sorted[0] ? { pct: sorted[0].pct, title: sorted[0].title } : null,
      recent: sorted.slice(0, 5).map((x) => ({ title: x.title, pct: x.pct })),
      topicsRecent: data.subjects.flatMap((sb) => sb.topics.filter((x) => x.attempts > 0).map((x) => ({ name: x.subtopic ? `${x.topic} › ${x.subtopic}` : x.topic, subject: sb.subject, pct: x.masteryPct, at: x.lastAttemptAt ?? "" })))
        .sort((a, b) => b.at.localeCompare(a.at)).slice(0, 5),
      topics: data.subjects.reduce((n, sb) => n + sb.topics.filter((x) => x.attempts > 0).length, 0), subjects: started, taken: data.trend.length, who: "",
      labels: { latest: t("hubfam.pgLatestQuiz"), noQuiz: t("hubfam.pgNoQuizzesYet"), topics: t("hubfam.pgTopicsPractised"), across: tp("hubfam.pgAcrossSubjects", started), taken: t("hubfam.pgQuizzesTaken"), recent: t("hubfam.pgRecentMarked") },
    }} />
  );
}
