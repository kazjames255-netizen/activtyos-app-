"use client";

import { useState } from "react";
import { StatTiles, type StatTile } from "../quiz/StatTiles";
import { kidTitle } from "../family/kidCopy";
import { DISPLAY, FOCUS, Icon, TONES } from "./homeKit";
import { startOfDay } from "./homeLib";
import { useH } from "./homeI18n";
import type { KidRow, KidStep } from "./KidHome";

// The colourful parts of a Year 3-6 child's Home, ported from the tutor screens: four raised stat tiles, "My to-do list"
// as coloured rows (blue homework, violet quizzes, pink cards, green lessons; a warm amber, never red, for late work) with an
// Open/Close button, and the day counts behind the "My week" glass capsules. Only ever rendered for the KS2 band —
// KS1 keeps nothing under the big card, and Year 7+ keeps its plain list. Streak is left out whenever Calm is on.

const DAY = 86_400_000;

/** Things done per day (homework hand-ins + quizzes) for the last `days` days, oldest first — the shape RhythmChart wants. */
export function dayCounts(activityMs: number[], now: number, days = 14): { day: number; count: number }[] {
  const today = startOfDay(now);
  const out = Array.from({ length: days }, (_, i) => ({ day: today - (days - 1 - i) * DAY, count: 0 }));
  for (const ms of activityMs) {
    const i = Math.round((startOfDay(ms) - out[0]!.day) / DAY);
    if (i >= 0 && i < days) out[i]!.count++;
  }
  return out;
}

export function KidTiles({ todo, cards, doneWeek, streak, calm, go }: { todo: number; cards: number; doneWeek: number; streak: number; calm: boolean; go: (k: KidStep["to"]) => void }) {
  const { t } = useH();
  const tiles: StatTile[] = [
    { key: "todo", label: t("hubshell.hm_kidTileTodo"), value: todo, hint: todo ? t("hubshell.hm_kidHintTodo") : t("hubshell.hm_kidHintTodoZero"), tone: todo ? "brand" : "green", icon: "homework", onClick: () => go("homework") },
    { key: "cards", label: t("hubshell.hm_kidTileCards"), value: cards, hint: cards ? t("hubshell.hm_kidHintCards") : t("hubshell.hm_kidHintCardsZero"), tone: cards ? "violet" : "green", icon: "cards", onClick: () => go("flashcards") },
    { key: "done", label: t("hubshell.hm_kidTileDone"), value: doneWeek, hint: t("hubshell.hm_kidHintDone"), tone: "green", icon: "check" },
    ...(!calm && streak > 0 ? [{ key: "streak", label: t("hubshell.hm_kidTileStreak"), value: streak, hint: t("hubshell.hm_kidHintStreak"), tone: "gold", icon: "sparkle" } as StatTile] : []),
  ];
  return <StatTiles tiles={tiles} label={t("hubshell.hm_kidTilesAria")} />;
}

// One colour per kind of thing; all from hub tokens. Pink is built from the red + violet tokens (the hub has no pink token).
type RowTone = { bg: string; fg: string; line: string };
const PINK: RowTone = { bg: "color-mix(in srgb, var(--red-soft) 60%, var(--violet-soft))", fg: "color-mix(in srgb, var(--red) 55%, var(--violet))", line: "color-mix(in srgb, var(--red-line) 55%, var(--brand-line))" };
const rowTone = (r: KidRow): RowTone => r.warm ? TONES.gold
  : r.to === "homework" ? TONES.brand
  : r.to === "quizzes" || r.to === "diagnostic" ? TONES.violet
  : r.to === "flashcards" ? PINK
  : r.to === "live" ? TONES.green
  : TONES.brand;

export function KidTodoList({ rows, go }: { rows: KidRow[]; go: (k: KidStep["to"]) => void }) {
  const { t } = useH();
  const [open, setOpen] = useState(true);
  const list = rows.slice(0, 5); // never more than five
  if (list.length === 0) return null;
  return (
    <section aria-label={t("hubshell.hm_kidTodoTitle")} data-testid="hub-kid-todo" className="grid gap-2">
      <div className="flex items-center justify-between gap-3">
        <h3 className="m-0 text-[16px] font-extrabold text-[var(--ink)]" style={DISPLAY}>{t("hubshell.hm_kidTodoTitle")}</h3>
        {list.length > 2 && (
          <button type="button" data-testid="hub-kid-todo-toggle" aria-expanded={open} aria-controls="hub-kid-todo-rows" onClick={() => setOpen((o) => !o)}
            className={`inline-flex min-h-[44px] items-center gap-1 rounded-full border border-[var(--line)] bg-[var(--panel)] px-4 text-[13px] font-extrabold text-[var(--brand-strong)] ${FOCUS}`}>
            {open ? t("hubshell.hm_feedClose") : t("hubshell.hm_feedOpen")} <span aria-hidden>{open ? "▲" : "▼"}</span>
          </button>
        )}
      </div>
      <div id="hub-kid-todo-rows" hidden={!open} className="grid gap-2">
        {list.map((r) => {
          const c = rowTone(r);
          return (
            <button key={r.key} type="button" onClick={() => go(r.to)} data-testid="hub-kid-todo-row"
              className={`group flex min-h-[64px] w-full items-center gap-3 rounded-2xl border border-b-[3px] px-3.5 py-2 text-start transition hover:-translate-y-px motion-reduce:transition-none motion-reduce:hover:translate-y-0 ${FOCUS}`}
              style={{ background: `linear-gradient(135deg, ${c.bg}, color-mix(in srgb, ${c.bg} 35%, var(--surface)))`, borderColor: c.line }}>
              <span aria-hidden className="grid h-11 w-11 flex-none place-items-center rounded-xl shadow-[var(--shadow-sm)]" style={{ background: "var(--surface)", color: c.fg }}><Icon name={r.icon} size={22} /></span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[16px] font-extrabold text-[var(--ink)]">{kidTitle(r.title, true)}</span>
                {r.note && <span className="block truncate text-[13px] font-bold" style={{ color: c.fg }}>{r.note}</span>}
              </span>
              <Icon name="chevronRight" size={18} className="flex-none text-[var(--ink-3)] transition group-hover:translate-x-0.5" />
            </button>
          );
        })}
      </div>
    </section>
  );
}
