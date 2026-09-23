// Marking typed answers (languages, spelling, science words) — deterministic, explainable, kind to children.
// Policies come from tenant settings; a tutor can override per question. Nothing here is language-model based.
import { combine, type CheckResult } from "./marking";

export type AccentMode = "strict" | "warn" | "lenient";
export interface TextPolicy {
  /** Capital letters matter (default false; German nouns switch this on per item). */
  matchCase: boolean;
  /** strict: a wrong/missing accent is wrong · warn: accepted but flagged, no mark lost · lenient: accepted silently — except where the accent changes the meaning. */
  accents: AccentMode;
  /** Ignore . , ! ? ; : and Spanish ¿ ¡ when comparing. */
  ignorePunctuation: boolean;
  /** Accept the answer with or without a leading article (el/la/le/the/der…). */
  articleOptional: boolean;
  /** Language, so ß/ss and ae/oe/ue fallbacks and meaning-changing accent pairs apply. */
  lang?: "fr" | "es" | "de" | "en";
}
export const DEFAULT_POLICY: TextPolicy = { matchCase: false, accents: "warn", ignorePunctuation: true, articleOptional: false };

/** Words where dropping the accent gives a DIFFERENT word (or tense) — lenient mode must never accept these silently. */
const MEANING_PAIRS: Record<string, string[]> = {
  es: ["si|sí", "tu|tú", "el|él", "mas|más", "se|sé", "te|té", "solo|sólo", "mi|mí", "de|dé", "aun|aún", "que|qué", "como|cómo", "cuando|cuándo", "donde|dónde", "quien|quién", "cual|cuál"],
  fr: ["a|à", "ou|où", "la|là", "sur|sûr", "du|dû", "mur|mûr", "parle|parlé", "arrive|arrivé", "mange|mangé", "joue|joué", "reste|resté", "porte|porté", "regarde|regardé", "aime|aimé", "passe|passé", "trouve|trouvé", "donne|donné", "tombe|tombé", "cherche|cherché", "reviens|revient"],
  de: ["schon|schön", "mochte|möchte", "konnte|könnte", "wurde|würde", "hatte|hätte", "ware|wäre", "musste|müsste"],
};
const pairSet = (lang?: string) => new Set((MEANING_PAIRS[lang ?? ""] ?? []).flatMap((p) => { const [a, b] = p.split("|"); return [a!, b!]; }));

/** Remove accents (NFD, strip combining marks) — keeps ñ→n, ü→u etc. */
export const stripAccents = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").normalize("NFC");
const ARTICLES = /^(el|la|los|las|un|una|le|les|l'|un|une|des|der|die|das|ein|eine|the|a|an)\s+/i;
/** German fallbacks a child on a keyboard without ä ö ü ß may use. */
const deFallback = (s: string) => s.replace(/ä/gi, "ae").replace(/ö/gi, "oe").replace(/ü/gi, "ue").replace(/ß/g, "ss");

export function tidy(s: string, p: TextPolicy): string {
  let t = s.normalize("NFC").replace(/[’‘`´]/g, "'").replace(/\s+/g, " ").trim();
  if (p.ignorePunctuation) t = t.replace(/[.,!?;:¿¡"“”]/g, "").replace(/\s+/g, " ").trim();
  if (!p.matchCase) t = t.toLocaleLowerCase();
  return t;
}

export interface TextVerdict { ok: boolean; exact: boolean; note?: string; matched?: string }
/** Compare one answer with ONE accepted form under a policy. */
export function compareText(answer: string, accepted: string, p: TextPolicy): TextVerdict {
  let a = tidy(answer, p), b = tidy(accepted, p);
  if (p.articleOptional) { a = a.replace(ARTICLES, ""); b = b.replace(ARTICLES, ""); }
  if (a === b) return { ok: true, exact: true, matched: accepted };
  // German keyboard fallbacks are always fine (ae/oe/ue/ss for ä/ö/ü/ß)
  if (p.lang === "de" && deFallback(a) === deFallback(b)) return { ok: true, exact: false, note: "written without umlauts — fine on a keyboard, but learn the ä/ö/ü/ß spelling", matched: accepted };
  if (stripAccents(a) === stripAccents(b)) {
    // only the accents differ
    if (p.accents === "strict") return { ok: false, exact: false, note: "check your accents" };
    const risky = pairSet(p.lang);
    const words = b.split(" ");
    const changesMeaning = words.some((w, i) => { const aw = a.split(" ")[i] ?? ""; return aw !== w && risky.has(w) && risky.has(aw); }) || words.some((w) => risky.has(w) && !a.split(" ").includes(w));
    if (p.accents === "lenient" && changesMeaning) return { ok: false, exact: false, note: "the accent changes the word here — check it" };
    return { ok: true, exact: false, note: p.accents === "warn" || changesMeaning ? "accent missing or wrong — the meaning is right, but check it" : undefined, matched: accepted };
  }
  return { ok: false, exact: false };
}

/** Mark a typed answer against every accepted answer (best result wins). Full mark for exact; accents-only slips are accepted or not per policy. */
export function checkText(answer: string, accepted: string[], policy: Partial<TextPolicy> = {}, marks = 1): CheckResult {
  const p = { ...DEFAULT_POLICY, ...policy };
  if (!answer.trim()) return combine([{ label: "Give an answer", ok: false, marks }]);
  let best: TextVerdict | null = null;
  for (const acc of accepted) { const v = compareText(answer, acc, p); if (v.ok && (!best || (v.exact && !best.exact))) best = v; else if (!best && v.note) best = v; }
  if (best?.ok) return { ...combine([{ label: "Correct", ok: true, marks, note: best.note }]), log: { matched: best.matched, exact: best.exact } };
  return { ...combine([{ label: "Not quite", ok: false, marks, note: best?.note ?? `you wrote “${answer.trim()}”` }]), log: { accepted } };
}

/** Letter-level differences between what was typed and the target (dictation feedback): returns tokens in order. */
export type Diff = { t: "same" | "wrong" | "missing" | "extra"; a?: string; b?: string };
export function diffText(typed: string, target: string): Diff[] {
  const a = [...typed], b = [...target], n = a.length, m = b.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () => Array(m + 1).fill(0));
  for (let i = 1; i <= n; i++) for (let j = 1; j <= m; j++) dp[i]![j] = a[i - 1] === b[j - 1] ? dp[i - 1]![j - 1]! + 1 : Math.max(dp[i - 1]![j]!, dp[i]![j - 1]!);
  const out: Diff[] = []; let i = n, j = m;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && a[i - 1] === b[j - 1]) { out.push({ t: "same", a: a[i - 1] }); i--; j--; }
    else if (i > 0 && j > 0 && dp[i - 1]![j - 1]! >= Math.max(dp[i - 1]![j]!, dp[i]![j - 1]!)) { out.push({ t: "wrong", a: a[i - 1], b: b[j - 1] }); i--; j--; }
    else if (j > 0 && (i === 0 || dp[i]![j - 1]! >= dp[i - 1]![j]!)) { out.push({ t: "missing", b: b[j - 1] }); j--; }
    else { out.push({ t: "extra", a: a[i - 1] }); i--; }
  }
  return out.reverse();
}

/** The accent buttons each language offers (plan §7.1) — capitals included. */
export const ACCENTS: Record<"es" | "fr" | "de", string[]> = {
  es: ["á", "é", "í", "ó", "ú", "ñ", "ü", "¿", "¡", "Á", "É", "Í", "Ó", "Ú", "Ñ"],
  fr: ["à", "â", "æ", "ç", "é", "è", "ê", "ë", "î", "ï", "ô", "œ", "ù", "û", "ü", "ÿ", "«", "»", "É", "È", "À", "Ç"],
  de: ["ä", "ö", "ü", "ß", "Ä", "Ö", "Ü", "ẞ"],
};
/** Typing shortcuts: `e'` → é, `a:` → ä, `n~` → ñ, `c,` → ç … applied as the pupil types (returns the new text, or null when nothing applies). */
const SHORTCUTS: Record<string, string> = { "a'": "á", "e'": "é", "i'": "í", "o'": "ó", "u'": "ú", "A'": "Á", "E'": "É", "I'": "Í", "O'": "Ó", "U'": "Ú", "n~": "ñ", "N~": "Ñ", "a`": "à", "e`": "è", "u`": "ù", "a^": "â", "e^": "ê", "i^": "î", "o^": "ô", "u^": "û", "c,": "ç", "C,": "Ç", "e:": "ë", "i:": "ï", "u::": "ü", "a:": "ä", "o:": "ö", "u:": "ü", "A:": "Ä", "O:": "Ö", "U:": "Ü", "ss!": "ß", "oe!": "œ", "ae!": "æ" };
export function applyShortcut(text: string): string | null {
  for (const len of [3, 2]) { const tail = text.slice(-len), rep = SHORTCUTS[tail]; if (rep) return text.slice(0, -len) + rep; }
  return null;
}
