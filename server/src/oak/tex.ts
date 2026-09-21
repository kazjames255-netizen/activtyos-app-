// Pure helpers for Oak-style question text: LaTeX between $$…$$ + plain prose. No dependencies (a copy lives in server/src/oak/tex.ts).
// Rules (owner, 2026-09-19): UK product — currency shows as £, never $; maths must render as real maths, never raw "$${1} \over {8}$".

export type RichSeg = { math: boolean; s: string };

/** Strings that are genuinely ABOUT dollars (a US-context lesson) — never rewrite these to £. */
export const CURRENCY_GUARD = /dollar|united states|\bUS\b|\bcents?\b/i;

/** Oak quirks inside $$…$$: stray leading/inner "$" (from "$$$"), \unicode{xHHHH} (KaTeX has no \unicode). */
export function cleanMath(raw: string): string {
  return raw
    .replace(/\\unicode\{x2103\}/gi, "^\\circ\\text{C}")
    .replace(/\\unicode\{x([0-9a-f]{2,6})\}/gi, (_, h: string) => `\\text{${String.fromCodePoint(parseInt(h, 16))}}`)
    .replace(/\$/g, "")
    .trim();
}

/** Split text into prose and maths segments. An unmatched "$$" is dropped (and a leftover \command in prose is flattened). */
export function splitRich(text: string): RichSeg[] {
  const out: RichSeg[] = [];
  const re = /\$\$([\s\S]+?)\$\$|\$\$([^$]+?)\$(?!\$)/g; // also Oak's malformed "$$…$"
  let last = 0, m: RegExpExecArray | null;
  const prose = (s: string) => { if (!s) return; const t = s.replace(/\$\$/g, ""); if (t) out.push({ math: false, s: /\\[a-zA-Z]|\\over/.test(t) ? plainOf(t) : t }); };
  while ((m = re.exec(text))) { prose(text.slice(last, m.index)); const c = cleanMath(m[1] ?? m[2]); if (c) out.push({ math: true, s: c }); last = m.index + m[0].length; }
  prose(text.slice(last));
  return out;
}

/** "$57" → "£57" in prose, unless the text is about dollars/US money. */
export function fixCurrency(prose: string, whole: string): string {
  return CURRENCY_GUARD.test(whole) ? prose : prose.replace(/\$(?=\d)/g, "£");
}

/** Flatten TeX to plain text for auto-marking / search: {1}\over{8}, \frac{1}{8} → 1/8, \times → ×, \pounds → £ … */
export function plainOf(text: string): string {
  let s = text.replace(/\$+/g, "");
  for (let i = 0; i < 4; i++) s = s.replace(/\\frac\s*\{([^{}]*)\}\s*\{([^{}]*)\}/g, "$1/$2").replace(/\{([^{}]*)\}\s*\\over\s*\{([^{}]*)\}/g, "$1/$2").replace(/([0-9a-zA-Z.]+)\s*\\over\s*([0-9a-zA-Z.]+)/g, "$1/$2");
  return s
    .replace(/\\times/g, "×").replace(/\\div/g, "÷").replace(/\\pounds|\\textsterling/g, "£").replace(/\\pm/g, "±").replace(/\\approx/g, "≈")
    .replace(/\\leq?\b/g, "≤").replace(/\\geq?\b/g, "≥").replace(/\\neq?\b/g, "≠").replace(/\\pi\b/g, "π").replace(/\\theta\b/g, "θ").replace(/\\circ/g, "°")
    .replace(/\\sqrt\s*\{([^{}]*)\}/g, "√($1)").replace(/\\text\{([^{}]*)\}/g, "$1").replace(/\\(?:mathbf|left|right|big|quad|space|,|;|!)/g, "")
    .replace(/\^\{([^{}]*)\}/g, "^$1").replace(/_\{([^{}]*)\}/g, "_$1").replace(/[{}]/g, "").replace(/\s+/g, " ").trim();
}
