import type { Field, Overrides, Rule, RuleSet, Signal, Suggestion } from "./types";

// selectTools(signal, rules, isAvailable, overrides) — see types.ts. Pure: no React, no fetch.

const KNOWN = ["maths", "english", "science", "languages"];
const FIELD_WEIGHT: Record<Field, number> = { title: 1, unit: 0.8, objective: 0.7 };
const ALL_FIELDS: Field[] = ["title", "unit", "objective"];
const cache = new Map<string, RegExp>();
const rx = (src: string): RegExp => { let r = cache.get(src); if (!r) { r = new RegExp(src, "i"); cache.set(src, r); } return r; };

/** The unit of an Oak lesson as words: "english-primary-ks1/units/a-superhero-like-you/lessons/…" → "a superhero like you". */
export function unitFromKey(key: string | null | undefined): string {
  const m = /\/units\/([^/]+)/.exec(key ?? "");
  return m ? m[1]!.replace(/-\d+$/, "").replace(/-/g, " ") : "";
}
/** The Oak programme slug ("maths-secondary-ks4-foundation-aqa") of a lesson key. */
export const programmeFromKey = (key: string | null | undefined): string | undefined => (key ?? "").split("/")[0] || undefined;

const subjectOf = (s: string) => {
  const t = s.toLowerCase();
  if (/math/.test(t)) return "maths";
  if (/english|literacy|reading|writing/.test(t)) return "english";
  if (/science|biology|chemistry|physics/.test(t)) return "science";
  if (/french|german|spanish|language/.test(t)) return "languages";
  return t;
};

interface Hit { rule: Rule; field: Field; match: string; score: number }

function fire(rule: Rule, sig: Signal, subject: string): Hit | null {
  if (rule.subject && !rule.subject.includes(subject)) return null;
  if (rule.years && sig.year != null && (sig.year < rule.years[0] || sig.year > rule.years[1])) return null; // year unknown → don't filter on it
  if (rule.programme && !(sig.programme && rx(rule.programme).test(sig.programme))) return null;
  const fields = rule.fields ?? ALL_FIELDS;
  const text: Record<Field, string> = { title: sig.title, unit: sig.unit, objective: sig.objective };
  const all = fields.map((f) => text[f]).join(" \n ");
  if (rule.none?.some((n) => rx(n).test(all))) return null;
  let best: Hit | null = null;
  for (const f of fields) {
    for (const src of rule.any) {
      const m = rx(src).exec(text[f]);
      if (m) { const score = rule.weight * FIELD_WEIGHT[f]; if (!best || score > best.score) best = { rule, field: f, match: m[0], score }; }
    }
  }
  return best;
}

export interface SelectOptions { max?: number; overrides?: Overrides }

/** Ranked tool suggestions (best first). `isAvailable(toolId)` filters out tools that don't exist / are switched off — pass `() => true` in tests. */
export function selectTools(sig: Signal, rules: RuleSet, isAvailable: (toolId: string) => boolean = () => true, opts: SelectOptions = {}): Suggestion[] {
  const max = opts.max ?? 3, subject = subjectOf(sig.subject), hide = new Set(opts.overrides?.hide ?? []);
  const per = new Map<string, Hit[]>();
  // Subject unknown (e.g. only a lesson title is to hand): let every subject's rules have a go — a title like "Balancing equations" still finds its tool.
  const subjects = KNOWN.includes(subject) ? [subject] : KNOWN;
  for (const r of rules.rules) {
    if (hide.has(r.tool) || !isAvailable(r.tool)) continue;
    let best: Hit | null = null;
    for (const sub of subjects) { const h = fire(r, sig, sub); if (h && (!best || h.score > best.score)) best = h; }
    if (best) { const l = per.get(r.tool); if (l) l.push(best); else per.set(r.tool, [best]); }
  }
  // One entry per tool: its best hit, plus a small bonus when several independent rules agree (capped so it can't beat a strong single rule).
  const ranked: Suggestion[] = [...per.entries()].map(([tool, hits]) => {
    hits.sort((a, b) => b.score - a.score);
    const bonus = Math.min(0.15, 0.05 * (hits.length - 1));
    return { tool, score: Math.round((hits[0]!.score + bonus) * 1000) / 1000, why: { rule: hits[0]!.rule.id, field: hits[0]!.field, match: hits[0]!.match, ...(hits[0]!.rule.why ? { text: hits[0]!.rule.why } : {}) }, source: "rule" as const };
  }).sort((a, b) => b.score - a.score || a.tool.localeCompare(b.tool));

  const out: Suggestion[] = [];
  for (const t of opts.overrides?.pin ?? []) if (!hide.has(t) && isAvailable(t)) out.push({ tool: t, score: 1, why: { rule: "pinned", field: "pinned", match: "" }, source: "pinned" });
  for (const s of ranked) if (!out.some((o) => o.tool === s.tool)) out.push(s);
  if (out.length === 0) {
    for (const t of rules.fallback[subject] ?? rules.fallback["*"] ?? []) if (!hide.has(t) && isAvailable(t)) out.push({ tool: t, score: 0.1, why: { rule: "fallback", field: "fallback", match: "" }, source: "fallback" });
  }
  return out.slice(0, max);
}

/** Merge several per-subject rule files into one set. */
export const mergeRules = (sets: RuleSet[], version: string): RuleSet => ({
  version, rules: sets.flatMap((s) => s.rules),
  fallback: sets.reduce<Record<string, string[]>>((m, s) => ({ ...m, ...s.fallback }), {}),
});
