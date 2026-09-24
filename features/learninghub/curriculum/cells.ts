// Pure logic for the curriculum map: which colour a cell is, which year columns to show, the headline numbers.
// No React, no fetch — selftest-covered (cells.selftest.ts).

export type Status = "gap" | "thin" | "covered";
export interface MapArea { id: string; subject: string; group: string; strand: string; area: string; code: string | null; /** lessons per year, index 0 = Year 1 … 10 = Year 11 */ y: number[]; /** child view: finished lessons per year */ done?: number[] }
export interface MapRow { areaId: string; from: number; to: number; lessons: number; status: Status }
export type CellKind = "covered" | "thin" | "gap" | "extra" | "na" | "done" | "assigned" | "todo";
export interface Cell { kind: CellKind; count: number; done: number; /** the key-stage span this cell was judged as part of (tutor view) */ span: { from: number; to: number; lessons: number } | null }

export const GROUP_ORDER = ["maths", "english", "science", "languages"] as const;
export const GROUP_LABEL: Record<string, string> = { maths: "Maths", english: "English", science: "Science", languages: "Languages" };
export const yearLabel = (y: number) => `Year ${y}`;

export const rowsByArea = (rows: MapRow[]): Map<string, MapRow[]> => {
  const m = new Map<string, MapRow[]>();
  for (const r of rows) { const l = m.get(r.areaId); if (l) l.push(r); else m.set(r.areaId, [r]); }
  return m;
};

/** What one (area, year) cell looks like. Tutor: the verdict of the expected row it belongs to (0 = gap, 1–4 = thin, 5+ = covered), or "extra"
 *  (lessons there that the curriculum doesn't ask for that year) / "na". Child: done / assigned / to-do (the curriculum expects it) / na. */
export function cellKind(mode: "tutor" | "child", a: MapArea, year: number, byArea: Map<string, MapRow[]>): Cell {
  const count = a.y[year - 1] ?? 0, done = a.done?.[year - 1] ?? 0;
  const span = (byArea.get(a.id) ?? []).find((r) => year >= r.from && year <= r.to) ?? null;
  const sp = span ? { from: span.from, to: span.to, lessons: span.lessons } : null;
  if (mode === "child") return { kind: done > 0 ? "done" : count > 0 ? "assigned" : span ? "todo" : "na", count, done, span: sp };
  if (span) return { kind: span.status, count, done, span: sp };
  return { kind: count > 0 ? "extra" : "na", count, done, span: null };
}

/** The year columns worth drawing for these areas: any year the curriculum expects something in, or that holds lessons. */
export function visibleYears(areas: MapArea[], byArea: Map<string, MapRow[]>): number[] {
  const on = new Set<number>();
  for (const a of areas) {
    a.y.forEach((n, i) => { if (n > 0) on.add(i + 1); });
    for (const r of byArea.get(a.id) ?? []) for (let y = r.from; y <= r.to; y++) on.add(y);
  }
  return [...on].sort((x, y) => x - y);
}

export function summarise(rows: MapRow[], areaIds: Set<string>) {
  const mine = rows.filter((r) => areaIds.has(r.areaId));
  const covered = mine.filter((r) => r.status === "covered").length, thin = mine.filter((r) => r.status === "thin").length, gaps = mine.filter((r) => r.status === "gap").length;
  return { checked: mine.length, covered, thin, gaps, pct: mine.length ? Math.round((covered / mine.length) * 100) : 0 };
}

/** Child view headline: lessons given, lessons finished, and how many of the curriculum's expected areas have anything at all. */
export function childSummary(areas: MapArea[], rows: MapRow[]) {
  const total = areas.reduce((s, a) => s + a.y.reduce((x, n) => x + n, 0), 0), done = areas.reduce((s, a) => s + (a.done ?? []).reduce((x, n) => x + n, 0), 0);
  const byArea = rowsByArea(rows); let expected = 0, touched = 0;
  for (const a of areas) for (const r of byArea.get(a.id) ?? []) { expected++; let n = 0; for (let y = r.from; y <= r.to; y++) n += a.y[y - 1] ?? 0; if (n > 0) touched++; }
  return { total, done, expected, touched, pct: expected ? Math.round((touched / expected) * 100) : 0 };
}

/** Strand headers in data order: [strand, areas][] */
export function byStrand(areas: MapArea[]): [string, MapArea[]][] {
  const out: [string, MapArea[]][] = [];
  for (const a of areas) { const last = out[out.length - 1]; if (last && last[0] === a.strand) last[1].push(a); else out.push([a.strand, [a]]); }
  return out;
}

export const cellLabel = (a: MapArea, year: number, c: Cell, mode: "tutor" | "child"): string => {
  const head = `${a.area}, ${yearLabel(year)}`;
  if (mode === "child") return c.kind === "na" ? `${head}: nothing yet` : c.kind === "todo" ? `${head}: not started yet` : `${head}: ${c.done} of ${c.count} finished`;
  if (c.kind === "na") return `${head}: not part of the curriculum this year, no lessons`;
  const n = `${c.count} ${c.count === 1 ? "lesson" : "lessons"}`;
  const state = c.kind === "gap" ? "a gap — no lessons" : c.kind === "thin" ? "thin — only a few lessons" : c.kind === "covered" ? "covered" : "extra, beyond the curriculum for this year";
  return `${head}: ${n}, ${state}`;
};

// ---- Year-first view (tutor): pick a year, see ONLY the areas the curriculum expects in it -------------------------------------------

export interface YearItem { area: MapArea; cell: Cell; /** lessons in this exact year */ count: number }
export const KEY_STAGES: { id: string; label: string; years: number[] }[] = [
  { id: "ks1", label: "KS1", years: [1, 2] }, { id: "ks2", label: "KS2", years: [3, 4, 5, 6] }, { id: "ks3", label: "KS3", years: [7, 8, 9] }, { id: "ks4", label: "KS4", years: [10, 11] },
];

/** Years worth offering as pills: the curriculum expects something in them, or lessons sit there. */
export const yearsWithContent = (areas: MapArea[], byArea: Map<string, MapRow[]>): number[] => visibleYears(areas, byArea);

/** The areas the curriculum expects in `year` (a key-stage row covers each of its years), each with its verdict. Not-expected areas never appear. */
export function expectedInYear(areas: MapArea[], year: number, byArea: Map<string, MapRow[]>): YearItem[] {
  const out: YearItem[] = [];
  for (const a of areas) { const c = cellKind("tutor", a, year, byArea); if (c.span) out.push({ area: a, cell: c, count: c.count }); }
  return out;
}
/** Lessons sitting in `year` on areas the curriculum does NOT expect that year (shown as a quiet note, never as gaps). */
export function extraInYear(areas: MapArea[], year: number, byArea: Map<string, MapRow[]>): number {
  let n = 0;
  for (const a of areas) { const c = cellKind("tutor", a, year, byArea); if (c.kind === "extra") n += c.count; }
  return n;
}
export function yearSummary(items: YearItem[]) {
  const covered = items.filter((i) => i.cell.kind === "covered").length, thin = items.filter((i) => i.cell.kind === "thin").length, gaps = items.filter((i) => i.cell.kind === "gap").length;
  return { checked: items.length, covered, thin, gaps, pct: items.length ? Math.round((covered / items.length) * 100) : 0 };
}
/** "Year 5" / "Y5" / "5" → 5 (1–11), else null. */
export const parseYear = (s: string | null | undefined): number | null => { const m = /(\d{1,2})/.exec(s ?? ""); const n = m ? Number(m[1]) : NaN; return n >= 1 && n <= 11 ? n : null; };
/** Which year to open on: the most common among the tutor's active students (if the subject has it), else the year holding most lessons, else the first. */
export function defaultYear(available: number[], studentYears: (number | null)[], areas: MapArea[]): number | null {
  if (!available.length) return null;
  const tally = new Map<number, number>();
  for (const y of studentYears) if (y && available.includes(y)) tally.set(y, (tally.get(y) ?? 0) + 1);
  const best = [...tally.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0];
  if (best) return best[0];
  let top = available[0]!, topN = -1;
  for (const y of available) { const n = areas.reduce((s, a) => s + (a.y[y - 1] ?? 0), 0); if (n > topN) { top = y; topN = n; } }
  return top;
}

// ---- Student lens (tutor) and sticker book (child) ------------------------------------------------------------------------------------
export type StudentState = "done" | "assigned" | "ready" | "none";
/** One student's state for one area this year: finished > given > lessons exist to set > nothing in the library. */
export const studentState = (o: { library: number; assigned: number; done: number } | undefined): StudentState =>
  !o ? "none" : o.done > 0 ? "done" : o.assigned > 0 ? "assigned" : o.library > 0 ? "ready" : "none";

/** Child sticker: finished lessons in this area across the span the curriculum judges together (a Years 3-6 row is one sticker). */
export function stickerDone(a: MapArea, year: number, byArea: Map<string, MapRow[]>): number {
  const span = (byArea.get(a.id) ?? []).find((r) => year >= r.from && year <= r.to);
  const from = span?.from ?? year, to = span?.to ?? year;
  let n = 0; for (let y = from; y <= to; y++) n += a.done?.[y - 1] ?? 0;
  return n;
}
/** Stars (0-5) for a child's year: share of the expected areas with a finished lesson. No percentage is ever shown. */
export const stickerStars = (got: number, total: number) => (total > 0 ? Math.round((5 * got) / total) : 0);
