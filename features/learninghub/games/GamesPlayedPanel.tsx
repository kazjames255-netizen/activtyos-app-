"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { get } from "@/lib/api";
import { useI18n } from "@/lib/i18n/provider";
import { useHubMessagesReady } from "@/lib/i18n/hubMessages";

// Tutor view of ONE child's game play, as a plain summary of WHAT they practised and HOW WELL, not which game it was: only areas the child has
// actually played, each with an honest verdict (doing well / getting there / needs help), the % right, and the topics they are good or weak at.
// Read-only. Every game's own progress endpoint already allows a tutor (server/src/routes/hub/gamesApi.ts, quizArcadeApi.ts); an endpoint that
// fails or has nothing is skipped, so an area only appears once there is something real to say about it.
interface Topic { name: string; attempts: number; acc: number }
export interface Part { area: string; unfinished?: number; partialAnswers?: number; lastAt: string | null; attempts: number; correct: number | null; topics: Topic[]; solved?: number; weekDays?: number; weekGoal?: number }

const pretty = (s: string) => { const t = s.replace(/[-_]+/g, " ").trim(); return t.charAt(0).toUpperCase() + t.slice(1); };
const wk = (r: { weekDays?: number; weekGoal?: number }) => ({ weekDays: r.weekDays, weekGoal: r.weekGoal });

interface QuizQuest { totals: { facts: number; fluent: number }; runs: { at: string }[]; weekDays: number; weekGoal: number; weakTopics?: { topic: string; attempts: number; accuracy: number | null }[] }
const fromQuest = (area: string) => (r: unknown): Part => {
  const q = r as QuizQuest;
  const topics = (q.weakTopics ?? []).filter((t) => t.attempts > 0 && t.accuracy !== null).map((t) => ({ name: pretty(t.topic), attempts: t.attempts, acc: t.accuracy as number }));
  const attempts = topics.reduce((a, t) => a + t.attempts, 0);
  return { area, lastAt: q.runs[0]?.at ?? null, attempts, correct: topics.reduce((a, t) => a + t.acc * t.attempts, 0), topics, ...wk(q) };
};
interface Arcade { topics: { topic: string; attempts: number; correct: number }[]; weekDays: number; weekGoal: number; lastPlayedAt: string | null }
const fromArcade = (area: string) => (r: unknown): Part => {
  const q = r as Arcade;
  const topics = q.topics.filter((t) => t.attempts > 0).map((t) => ({ name: pretty(t.topic), attempts: t.attempts, acc: t.correct / t.attempts }));
  return { area, lastAt: q.lastPlayedAt, attempts: q.topics.reduce((a, t) => a + t.attempts, 0), correct: q.topics.reduce((a, t) => a + t.correct, 0), topics, ...wk(q) };
};
interface Mini { puzzlesSolved?: number; roundsSolved?: number; bests?: Record<string, unknown>; weekDays: number; weekGoal: number; runs: { at: string }[] }
const fromMini = (area: string) => (r: unknown): Part => {
  const q = r as Mini; const n = q.puzzlesSolved ?? q.roundsSolved ?? Object.keys(q.bests ?? {}).length;
  return { area, lastAt: q.runs[0]?.at ?? null, attempts: 0, correct: null, topics: [], solved: n, ...wk(q) };
};
interface Facts { practice: { trials: number; accuracy: number | null }; wrong: { key: string }[]; runs: { at: string }[]; weekDays: number; weekGoal: number; unfinished?: number; partial?: { runs: number; answered: number; correct: number; lastAt: string | null } }
const fromFacts = (area: string) => (r: unknown): Part => {
  const q = r as Facts;
  const acc = q.practice.accuracy ?? 0;
  const pa = q.partial?.answered ?? 0;   // answers from runs left part-way still count as practice
  const last = [q.runs[0]?.at ?? null, q.partial?.lastAt ?? null].filter((x): x is string => !!x).sort().pop() ?? null;
  return { area, unfinished: q.unfinished ?? 0, lastAt: last, attempts: q.practice.trials + pa, partialAnswers: pa, correct: (q.practice.accuracy === null ? 0 : Math.round(acc * q.practice.trials)) + (q.partial?.correct ?? 0),
    topics: q.wrong.slice(0, 3).map((f) => ({ name: f.key.slice(2).replace("x", "×"), attempts: 1, acc: 0 })), ...wk(q) };
};

const G = "/api/learning-hub/games";
const SOURCES: { path: string; area: string; read: (area: string) => (r: unknown) => Part }[] = [
  { path: `${G}/penguin-slide/facts`, area: "times", read: fromFacts },
  { path: `${G}/compass-quest/progress`, area: "geography", read: fromQuest },
  { path: `${G}/museum-vault/progress`, area: "history", read: fromQuest },
  { path: `${G}/colour-lab/progress`, area: "science", read: fromQuest },
  { path: `${G}/debate-keep/progress`, area: "debate", read: fromQuest },
  { path: `${G}/story-detective/progress`, area: "reading", read: fromQuest },
  { path: `${G}/word-vault/progress`, area: "vocab", read: fromQuest },
  { path: `${G}/word-pop/progress`, area: "spelling", read: fromQuest },
  { path: `${G}/bot-foundry/progress`, area: "computing", read: fromMini },
  { path: `${G}/sort-yard/progress`, area: "data", read: fromMini },
  { path: `${G}/training-ground/progress`, area: "drills", read: fromMini },
  { path: `${G}/quiz/prime-reef/facts`, area: "numbers", read: fromArcade },
  { path: `${G}/quiz/data-carnival/facts`, area: "data", read: fromArcade },
  { path: `${G}/quiz/shape-workshop/facts`, area: "shapes", read: fromArcade },
];

export type Verdict = "doing_well" | "getting_there" | "needs_help" | "just_started";
export const verdictOf = (attempts: number, pct: number): Verdict => (attempts < 8 ? "just_started" : pct >= 80 ? "doing_well" : pct >= 60 ? "getting_there" : "needs_help");
export const TONE: Record<Verdict, string> = { doing_well: "var(--green)", getting_there: "var(--gold)", needs_help: "var(--red)", just_started: "var(--ink-3)" };

/** One child's game play, grouped by AREA of content (only areas with real evidence). Shared by the games summary and the Progress cards. */
export function useGamesPlayed(childId: string, tenantQuery = ""): { parts: Part[] | null; areas: Part[]; unfinished: number } {
  const [parts, setParts] = useState<Part[] | null>(null);
  const [unfinished, setUnfinished] = useState(0);   // runs begun but not finished: they are not scored until finished
  const q = `?childId=${encodeURIComponent(childId)}${tenantQuery ? `&${tenantQuery}` : ""}`;
  useEffect(() => {
    let alive = true;
    Promise.all(SOURCES.map((s) => get<unknown>(`${s.path}${q}`).then((r) => s.read(s.area)(r)).catch(() => null)))
      .then((rows) => { if (!alive) return; setUnfinished(rows.reduce((n, r) => n + (r?.unfinished ?? 0), 0)); setParts(rows.filter((r): r is Part => !!r && r.lastAt !== null)); });
    return () => { alive = false; };
  }, [q]);

  const areas = useMemo(() => {
    const by = new Map<string, Part>();
    for (const p of parts ?? []) {
      const cur = by.get(p.area);
      if (!cur) { by.set(p.area, { ...p }); continue; }
      cur.partialAnswers = (cur.partialAnswers ?? 0) + (p.partialAnswers ?? 0); cur.attempts += p.attempts; cur.correct = cur.correct === null && p.correct === null ? null : (cur.correct ?? 0) + (p.correct ?? 0);
      cur.topics = [...cur.topics, ...p.topics]; cur.solved = (cur.solved ?? 0) + (p.solved ?? 0);
      if ((p.lastAt ?? "") > (cur.lastAt ?? "")) cur.lastAt = p.lastAt;
    }
    return [...by.values()].sort((a, b) => (b.lastAt ?? "").localeCompare(a.lastAt ?? ""));
  }, [parts]);

  return { parts, areas, unfinished };
}

export function GamesPlayedPanel({ childId, childName, tenantQuery = "", detail }: { childId: string; childName?: string; tenantQuery?: string; /** e.g. the times-tables detail, offered under "Times tables detail" only when that area was played. */ detail?: ReactNode }) {
  const { locale, t: tt } = useI18n(); useHubMessagesReady(locale);
  const T = (k: string, v?: Record<string, string | number>) => tt(`hubgames.${k}`, v);
  const { parts, areas, unfinished } = useGamesPlayed(childId, tenantQuery);
  const name = (childName ?? "").split(" ")[0] || "";
  if (!parts) return <div aria-busy="true">&hellip;</div>;
  if (!areas.length) return unfinished > 0
    ? <p data-testid="games-started" style={{ margin: 0 }}>{T("pl_started", { name })}</p>
    : <p data-testid="games-none" style={{ margin: 0 }}>{T("pl_none", { name })}</p>;

  const scored = areas.filter((a) => a.correct !== null && a.attempts >= 8).map((a) => ({ a, pct: ((a.correct ?? 0) / a.attempts) * 100 }));
  const best = scored.length > 1 ? [...scored].sort((x, y) => y.pct - x.pct)[0] : null;
  const worst = scored.length > 1 ? [...scored].sort((x, y) => x.pct - y.pct)[0] : null;
  const days = areas.find((a) => a.weekDays !== undefined);
  const timesPlayed = areas.some((a) => a.area === "times");
  return (
    <section data-testid="games-played" style={{ display: "grid", gap: 12 }}>
      <h3 style={{ margin: 0 }}>{T("pl_title", { name })}</h3>
      {(best || days) && (
        <p style={{ margin: 0 }} data-testid="games-headline">
          {best && worst && best.a.area !== worst.a.area ? `${T("pl_best", { area: T(`pl_a_${best.a.area}`) })} ${T("pl_worst", { area: T(`pl_a_${worst.a.area}`) })} ` : ""}
          {days ? T("pl_week", { days: days.weekDays ?? 0, goal: days.weekGoal ?? 5 }) : ""}
        </p>
      )}
      <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 8 }}>
        {areas.map((a) => {
          const pct = a.correct === null || !a.attempts ? null : Math.round((a.correct / a.attempts) * 100);
          const v: Verdict | null = pct === null ? null : verdictOf(a.attempts, pct);
          const good = a.topics.filter((t) => t.attempts >= 3 && t.acc >= 0.8).sort((x, y) => y.acc - x.acc).slice(0, 3).map((t) => t.name);
          const weak = a.topics.filter((t) => (t.attempts >= 3 && t.acc < 0.6) || (a.area === "times" && t.acc === 0)).sort((x, y) => x.acc - y.acc).slice(0, 3).map((t) => t.name);
          return (
            <li key={a.area} data-testid={`games-area-${a.area}`} data-verdict={v ?? ""} style={{ border: "1px solid var(--line)", borderRadius: 14, padding: "10px 12px", background: "var(--surface)" }}>
              <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, justifyContent: "space-between" }}>
                <b>{T(`pl_a_${a.area}`)}</b>
                {v ? <span style={{ fontWeight: 800, fontSize: 12.5, color: TONE[v] }}>{T(`pl_${v}`)}</span> : <span style={{ fontSize: 12.5, opacity: 0.8 }}>{T("pl_solved", { n: a.solved ?? 0 })}</span>}
              </div>
              {pct !== null && (
                <>
                  <div role="img" aria-label={`${pct}%`} style={{ height: 8, borderRadius: 6, background: "var(--panel)", margin: "6px 0 4px", overflow: "hidden" }}><div style={{ width: `${pct}%`, height: "100%", background: TONE[v ?? "just_started"] }} /></div>
                  <div style={{ fontSize: 12.5, opacity: 0.85 }}>{T("pl_right", { pct, n: a.attempts })}</div>
                </>
              )}
              {(a.partialAnswers ?? 0) > 0 && <div style={{ fontSize: 12, opacity: 0.75, marginTop: 2 }}>{T("pl_partial", { n: a.partialAnswers ?? 0 })}</div>}
              {good.length > 0 && <div style={{ fontSize: 12.5, marginTop: 4 }}>{T("pl_good_at", { list: good.join(", ") })}</div>}
              {weak.length > 0 && <div style={{ fontSize: 12.5, marginTop: 2 }}>{T("pl_needs_work", { list: weak.join(", ") })}</div>}
            </li>
          );
        })}
      </ul>
      {detail && timesPlayed && <details><summary style={{ cursor: "pointer", fontWeight: 800, minHeight: 44 }}>{T("pl_detail")}</summary><div style={{ marginTop: 8 }}>{detail}</div></details>}
    </section>
  );
}
