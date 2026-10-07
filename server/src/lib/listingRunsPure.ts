// Pure run-recipe -> dated runs logic, split out of listingRuns.ts unchanged so it can be unit-tested without firebase.
import type { Session } from "./blockDomain";

export interface RunRecipe {
  runFrom?: string;
  runTo?: string;
  blockMode?: "weekly" | "custom";
  days?: number[]; // 0=Sun … 6=Sat
  datesOff?: string[];
  /** Separate ranges; when set, dates exist ONLY inside them (runFrom/runTo are just their outer span). */
  runPeriods?: { from: string; to: string }[];
  maxAttendees?: string | number;
  capacityScope?: "day" | "listing";
  blockId?: string | null; // block bundle → session times come from its periods
}

const UNLIMITED = 9999;

function genDates(from: string, to: string, days: number[], datesOff: string[]): string[] {
  const d = new Date(`${from}T00:00:00Z`);
  const end = new Date(`${to}T00:00:00Z`);
  if (isNaN(d.getTime()) || isNaN(end.getTime())) return [];
  const off = new Set(datesOff);
  const out: string[] = [];
  let guard = 0;
  while (d <= end && guard++ < 400) {
    const iso = d.toISOString().slice(0, 10);
    if (days.includes(d.getUTCDay()) && !off.has(iso)) out.push(iso);
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}

/** The run-days of a recipe: one range (runFrom..runTo) or several separate periods (nothing between them), minus switched-off days. */
export function recipeDates(recipe: RunRecipe, days: number[]): string[] {
  const off = recipe.datesOff ?? [];
  const periods = (recipe.runPeriods ?? []).filter((p) => p && p.from && p.to);
  if (!periods.length) return recipe.runFrom && recipe.runTo ? genDates(recipe.runFrom, recipe.runTo, days, off) : [];
  const all = new Set<string>();
  for (const p of periods) for (const d of genDates(p.from, p.to, days, off)) all.add(d);
  return [...all].sort();
}

function mondayOf(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  const day = d.getUTCDay();
  d.setUTCDate(d.getUTCDate() + (day === 0 ? -6 : 1 - day));
  return d.toISOString().slice(0, 10);
}

// "2026-07-20", "2026-07-24" → "20 – 24 Jul 2026" / "28 Jul – 1 Aug 2026".
function rangeLabel(from: string, to: string): string {
  const f = new Date(`${from}T00:00:00Z`);
  const t = new Date(`${to}T00:00:00Z`);
  const day = (d: Date) => d.getUTCDate();
  const mon = (d: Date) => d.toLocaleDateString("en-GB", { month: "short", timeZone: "UTC" });
  const yr = t.getUTCFullYear();
  if (from === to) return `${day(f)} ${mon(f)} ${yr}`;
  if (mon(f) === mon(t) && f.getUTCFullYear() === t.getUTCFullYear())
    return `${day(f)} – ${day(t)} ${mon(t)} ${yr}`;
  return `${day(f)} ${mon(f)} – ${day(t)} ${mon(t)} ${yr}`;
}

export interface DesiredRun {
  name: string;
  startDate: string;
  endDate: string;
  capacity: number;
  sessions: Session[];
}

/** The dated runs a listing's recipe describes (empty when it has none). */
export function desiredRuns(recipe: RunRecipe, times: { start: string; end: string }): DesiredRun[] {
  const { runFrom, runTo } = recipe;
  if ((!runFrom || !runTo) && !(recipe.runPeriods ?? []).length) return [];
  const days = recipe.days?.length ? recipe.days : [1, 2, 3, 4, 5];
  const dates = recipeDates(recipe, days);
  if (!dates.length) return [];
  const capacity =
    Math.floor(Number(recipe.maxAttendees)) > 0 ? Math.floor(Number(recipe.maxAttendees)) : UNLIMITED;
  const toRun = (ds: string[], name: string): DesiredRun => ({
    name,
    startDate: ds[0],
    endDate: ds[ds.length - 1],
    capacity,
    sessions: ds.map((date) => ({ date, start: times.start, end: times.end })),
  });

  if (recipe.blockMode === "custom") return [toRun(dates, rangeLabel(dates[0], dates[dates.length - 1]))];

  // Weekly: one block per calendar week (Monday-keyed), numbered in order.
  const weeks = new Map<string, string[]>();
  for (const iso of dates) {
    const k = mondayOf(iso);
    if (!weeks.has(k)) weeks.set(k, []);
    weeks.get(k)!.push(iso);
  }
  return [...weeks.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([, ds], i) => toRun(ds, `Week ${i + 1} · ${rangeLabel(ds[0], ds[ds.length - 1])}`));
}

