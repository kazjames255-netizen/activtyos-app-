// Learning Hub — small text helpers for LIST projections (a note's card excerpt, "n min read"). A port of the
// client's mdExcerpt/readMins (features/learninghub/types.ts) so a list can stay light (no body) and still show
// the same card text. Keep the two in step.

export const EXCERPT_MAX = 160;

const clean = (l: string) => l
  .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
  .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
  .replace(/^\s*(?:[-*+]\s+|\d+[.)]\s+|>\s*)+/, "")
  .replace(/[*_`~]/g, "")
  .replace(/\|/g, " ")
  .replace(/\s+/g, " ")
  .trim();

/** A one-line preview of a markdown body: headings, fences, rules and table scaffolding are dropped; the first
 *  real line leads (a short one borrows the next); a heading-only note falls back to its first heading. */
export function mdExcerpt(md: string, max = EXCERPT_MAX): string {
  const lines: string[] = [];
  let heading = "";
  let fenced = false;
  for (const raw of md.slice(0, 4000).split(/\r?\n/)) {
    const l = raw.trim();
    if (l.startsWith("```")) { fenced = !fenced; continue; }
    if (fenced || !l) continue;
    if (/^#{1,6}\s/.test(l)) { if (!heading) heading = clean(l.replace(/^#+\s*/, "")); continue; }
    if (/^([-*_]\s*){3,}$/.test(l) || /^\|?[\s:|-]{3,}\|?$/.test(l)) continue;
    const c = clean(l);
    if (c) lines.push(c);
    if (lines.length >= 2) break;
  }
  let out = lines[0] ?? heading;
  if (lines[0] && lines[1] && lines[0].length < 70) out = `${lines[0]} ${lines[1]}`;
  return out.length > max ? `${out.slice(0, max - 1).trimEnd()}…` : out;
}

/** Whole minutes to read a body (≥1), at 200 words a minute; 0 for an empty body. */
export function readMinutes(md: string): number {
  const t = md.trim();
  if (!t) return 0;
  return Math.max(1, Math.round(t.split(/\s+/).filter(Boolean).length / 200));
}
