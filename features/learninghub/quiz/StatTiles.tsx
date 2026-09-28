"use client";

import type { ReactNode } from "react";
import { Icon, type IconName } from "../kit";
import { DirArrow } from "../rtl";
import { TONES, type Tone } from "../teachKit";
import { LIFT, useCountUp, useGrow } from "../shared-assess/motion";
import { display, FOCUS } from "../shared-assess/ui";

// The four headline numbers above the Quizzes / Starting quizzes list — Published, Attempts, Average
// (score or starting point) and To mark. Four separate raised tiles, each in its own hub tone: a coloured
// icon tile, a small label above a big count-up number and a hint below. The average tile follows its
// value (gold under 50, blue 50-79, green 80+) with a mini bar; To mark is gold with a pulsing dot while
// anything waits, and green with a tick once it is clear. Tones come from TONES only (no hard-coded
// colours), so the dark theme follows.

export interface StatTile {
  key: string;
  label: string;
  /** The number shown; null renders a dash. */
  value: number | null;
  /** Appended to the number (e.g. "%"). */
  suffix?: string;
  hint: string;
  tone: Tone;
  icon: IconName;
  /** 0-100: draws a mini progress bar under the number. */
  bar?: number;
  /** A pulsing dot in the corner (something needs you). */
  pulse?: boolean;
  onClick?: () => void;
}

const levelTone = (pct: number | null): Tone => (pct == null ? "neutral" : pct < 50 ? "gold" : pct < 80 ? "brand" : "green");

/** Builds the four tiles from the totals; the callers only supply strings and handlers. */
export function quizStatTiles(o: {
  published: number; publishedHint: string;
  attempts: number | null; attemptsLabel: string; attemptsHint: string; onAttempts?: () => void;
  avgLabel: string; avg: number | null; avgHint: string;
  toMarkLabel: string; toMark: number; toMarkHint: string; onToMark?: () => void;
  publishedLabel: string;
}): StatTile[] {
  return [
    { key: "published", label: o.publishedLabel, value: o.published, hint: o.publishedHint, tone: "brand", icon: "file" },
    { key: "attempts", label: o.attemptsLabel, value: o.attempts, hint: o.attemptsHint, tone: "violet", icon: "upload", onClick: o.attempts ? o.onAttempts : undefined },
    { key: "avg", label: o.avgLabel, value: o.avg != null ? Math.round(o.avg) : null, suffix: "%", hint: o.avgHint, tone: levelTone(o.avg), icon: "chart", bar: o.avg != null ? Math.max(0, Math.min(100, o.avg)) : undefined },
    { key: "tomark", label: o.toMarkLabel, value: o.toMark, hint: o.toMarkHint, tone: o.toMark > 0 ? "gold" : "green", icon: o.toMark > 0 ? "edit" : "check", pulse: o.toMark > 0, onClick: o.toMark > 0 ? o.onToMark : undefined },
  ];
}

function Tile({ tile, index }: { tile: StatTile; index: number }) {
  const tone = TONES[tile.tone];
  const target = tile.value ?? 0;
  const shown = Math.round(useCountUp(target, 650, index * 60));
  const grown = useGrow(tile.bar ?? 0, 150 + index * 60);
  const text = tile.value == null ? "–" : `${shown}${tile.suffix ?? ""}`;
  const finalText = tile.value == null ? "–" : `${tile.value}${tile.suffix ?? ""}`;
  const style = {
    background: `linear-gradient(160deg, ${tone.bg}, color-mix(in srgb, ${tone.bg} 35%, var(--surface)))`,
    border: `1px solid ${tone.line}`,
    borderBottom: `4px solid color-mix(in srgb, ${tone.fg} 55%, ${tone.line})`,
    boxShadow: `inset 0 1px 0 color-mix(in srgb, var(--surface) 85%, transparent), 0 8px 16px -12px color-mix(in srgb, ${tone.fg} 60%, transparent)`,
  } as const;
  const body: ReactNode = (
    <>
      {tile.pulse && (
        <span aria-hidden className="absolute end-3 top-3 grid h-2.5 w-2.5 place-items-center">
          <span className="absolute inline-flex h-full w-full rounded-full opacity-60 motion-safe:animate-ping" style={{ background: tone.fg }} />
          <span className="relative inline-flex h-2 w-2 rounded-full" style={{ background: tone.fg }} />
        </span>
      )}
      <span aria-hidden className="grid h-11 w-11 flex-none place-items-center rounded-2xl" style={{ background: "var(--surface)", color: tone.fg, border: `1px solid ${tone.line}`, boxShadow: "var(--shadow-sm)" }}>
        <Icon name={tile.icon} size={21} strokeWidth={2} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[11px] font-extrabold uppercase tracking-[0.08em]" style={{ color: tone.fg }}>{tile.label}</span>
        <span className="mt-1 block text-[30px] font-extrabold leading-none tabular-nums text-[var(--ink)]" style={display}>{text}</span>
        {tile.bar != null && (
          <span aria-hidden className="mt-2 block h-1.5 overflow-hidden rounded-full" style={{ background: `color-mix(in srgb, ${tone.fg} 16%, var(--surface))` }}>
            <span className="block h-full rounded-full transition-[width] duration-700 ease-out motion-reduce:transition-none" style={{ width: `${grown}%`, background: tone.fg }} />
          </span>
        )}
        <span className="mt-1.5 block text-[11.5px] font-semibold text-[var(--ink-2)]">{tile.hint}{tile.onClick ? <> <DirArrow /></> : null}</span>
      </span>
    </>
  );
  const cls = `relative flex items-start gap-3 rounded-2xl px-3.5 py-3 text-start ${LIFT}`;
  const aria = `${tile.label}: ${finalText}. ${tile.hint}`;
  return tile.onClick
    ? <button type="button" onClick={tile.onClick} data-testid={`hub-stat-${tile.key}`} aria-label={aria} className={`${cls} w-full cursor-pointer ${FOCUS}`} style={style}>{body}</button>
    : <div role="group" aria-label={aria} data-testid={`hub-stat-${tile.key}`} className={cls} style={style}>{body}</div>;
}

/** Four tiles: 4 across on desktop, 2x2 on tablet, stacked on a phone. */
export function StatTiles({ tiles, label }: { tiles: StatTile[]; label?: string }) {
  return (
    <div role="group" aria-label={label} data-testid="hub-stat-tiles" className="grid grid-cols-1 gap-3 min-[520px]:grid-cols-2 lg:grid-cols-4">
      {tiles.map((tile, i) => <Tile key={tile.key} tile={tile} index={i} />)}
    </div>
  );
}
