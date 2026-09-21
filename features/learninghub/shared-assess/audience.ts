import type { Audience } from "./api";

// Who-is-this-for helpers. Labels come from the tenant's own year-group list
// (config.yearGroups) — nothing about school stages is assumed here.

/** "Year 5, Year 6" → "Year 5–6"; keeps the tenant's list order; a gap starts a new range. */
export function yearRanges(picked: string[], all: string[]): string[] {
  const idx = (y: string) => { const i = all.findIndex((a) => a.toLowerCase() === y.toLowerCase()); return i < 0 ? 9999 : i; };
  const sorted = [...new Set(picked)].sort((a, b) => idx(a) - idx(b) || a.localeCompare(b));
  const out: string[] = [];
  let run: string[] = [];
  const flush = () => {
    if (!run.length) return;
    if (run.length === 1) out.push(run[0]);
    else {
      const a = run[0], z = run[run.length - 1];
      const ma = a.match(/^(.*?)(\d+)$/), mz = z.match(/^(.*?)(\d+)$/);
      out.push(ma && mz && ma[1] === mz[1] ? `${ma[1]}${ma[2]}–${mz[2]}` : `${a}–${z}`);
    }
    run = [];
  };
  for (const y of sorted) {
    const last = run[run.length - 1];
    if (last != null && idx(y) === idx(last) + 1 && idx(y) < 9999) run.push(y);
    else { flush(); run = [y]; }
  }
  flush();
  return out;
}

export function ageLabel(min: number | null | undefined, max: number | null | undefined): string | null {
  if (min != null && max != null) return min === max ? `Age ${min}` : `Ages ${min}–${max}`;
  if (min != null) return `Ages ${min}+`;
  if (max != null) return `Up to age ${max}`;
  return null;
}

export const hasAudience = (a?: Audience | null) => !!a && (a.yearGroups.length > 0 || a.ageMin != null || a.ageMax != null);

/** The chips shown on a card: year ranges first, then the age range. Empty = everyone. */
export function audienceChips(a: Audience | undefined | null, allYears: string[]): string[] {
  if (!a) return [];
  const age = ageLabel(a.ageMin, a.ageMax);
  return [...yearRanges(a.yearGroups ?? [], allYears), ...(age ? [age] : [])];
}
