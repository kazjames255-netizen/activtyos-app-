// The one shape every checker returns, so a tutor can always see WHY a mark was given.
export interface CheckResult {
  score: number;
  max: number;
  /** Plain-English lines for the student / tutor ("Perpendicular within 1.2°", "No construction arcs found"). */
  feedback: string[];
  /** Machine-readable details for the tutor's marking view. */
  log: Record<string, unknown>;
}
export const fullMarks = (r: CheckResult) => r.max > 0 && r.score >= r.max - 1e-9;
/** Sum several sub-checks into one result. */
export function combine(parts: { label: string; ok: boolean; marks: number; note?: string }[]): CheckResult {
  const max = parts.reduce((s, p) => s + p.marks, 0);
  const score = parts.reduce((s, p) => s + (p.ok ? p.marks : 0), 0);
  return {
    score, max,
    feedback: parts.map((p) => `${p.ok ? "✓" : "✗"} ${p.label}${p.note ? ` — ${p.note}` : ""}`),
    log: { parts },
  };
}
