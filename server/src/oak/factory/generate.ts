// Lesson-factory slide GENERATOR: turns the structured facts Oak publishes for a lesson (pupil outcome, key learning points, key
// words + definitions, lesson outline) into an interactive slide deck in the format the pilot uses
// (features/learninghub/lesson/slides/types.ts). Deterministic, no LLM, no network.
//
// SAFETY RULES (children's content — a wrong answer key is the worst bug):
//  · Only Oak's own pupil-facing statements are shown (outcome, key learning points, keyword definitions). Teacher-facing text
//    (misconceptions, teacher tips) and the video transcript / raw slide text (which contain distractors and teacher chat) are NOT used.
//  · Every interactive item is correct BY CONSTRUCTION from one Oak fact: keyword <-> its own definition, or a key-learning-point
//    with one of its own words blanked. Oak's quiz questions and their answers are never touched (they stay warm-up / quiz docs).
//  · validate.ts re-derives every answer key from the raw lesson data independently and rejects the whole deck on any mismatch.
import type { Slide, Block } from "../../../../features/learninghub/lesson/slides/types";
import { tidy, cleanPoints, cleanKeywords, blankContext, optionsFit, vowelSound, numberOf, isProperName, contentWords, sameStem, derivedForm, mentions, confusable, wordKind, sameKind, JUNK, type BlankCtx } from "./quality";
import { definitionalBlank, slashAdjacent, distractorClash, LANG_SUBJECTS } from "./clozeGuard";

export interface KW { k: string; d: string }
export interface DeckInput {
  lessonTitle: string; unitTitle: string; subject: string; outcome: string; points: string[]; keywords: KW[]; outline: string[];
  /** Other lessons' keywords from the same unit (only ever used as wrong options for keyword questions). */
  pool: KW[]; seed: string;
}

// ── small helpers ────────────────────────────────────────────────────────────
export const plain = (s: string) => s.replace(/[{}]|\*\*/g, "");
export { tidy };
/** Slide text is markup ({accent}, **bold**): braces / asterisks that come from the source must not be read as markup. */
export const safe = (s: string) => tidy(s.replace(/\s+/g, " ")).replace(/\{/g, "(").replace(/\}/g, ")").replace(/\*\*/g, "").trim();
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const hasWord = (s: string) => /\p{L}{3,}/u.test(s);
const STOP = new Set("that this with from what when which their there they them then than have been were will would could should your about into some more also each other these those only where while because between".split(" "));
const toks = (s: string) => new Set((plain(s).toLowerCase().match(/\p{L}{4,}/gu) ?? []).filter((w) => !STOP.has(w)).map((w) => w.slice(0, 5)));
const overlap = (a: Set<string>, b: Set<string>) => { let n = 0; for (const x of a) if (b.has(x)) n++; return n; };
const jaccard = (a: Set<string>, b: Set<string>) => { const i = overlap(a, b); const u = a.size + b.size - i; return u ? i / u : 0; };

function rng(seed: string): () => number {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) { h = Math.imul(h ^ seed.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
  let a = (h ^= h >>> 16) >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function shuffle<T>(xs: T[], seed: string): T[] { const r = rng(seed); const a = [...xs]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

const wordRe = (w: string) => new RegExp(`(^|[^\\p{L}\\p{N}])(${esc(w)})(?=$|[^\\p{L}\\p{N}])`, "iu");
/** Wrap up to `max` keywords found in `text` as {accent} (whole words only, no overlaps). */
function accent(text: string, kws: string[], max = 3): string {
  let out = safe(text), n = 0;
  for (const kw of [...kws].sort((a, b) => b.length - a.length)) {
    if (n >= max || kw.length < 3 || !hasWord(kw)) continue;
    const m = wordRe(safe(kw)).exec(out);
    if (!m) continue;
    const at = m.index + m[1].length;
    // never inside an existing {accent}
    if (out.slice(0, at).split("{").length !== out.slice(0, at).split("}").length) continue;
    out = `${out.slice(0, at)}{${m[2]}}${out.slice(at + m[2].length)}`; n++;
  }
  return out;
}

// ── keyword questions ────────────────────────────────────────────────────────
/** The alternatives of a key word: "Double / doubling" -> [Double, doubling]; "Solution (equality)" -> [Solution]. A slash WITHOUT spaces
 *  ("Capture/recapture") is one term whose parts may be written joined by a hyphen, slash or space. */
export function keyAlts(key: string): string[] {
  return safe(key).replace(/\s*\([^)]*\)/g, "").split(/\s+\/\s+/).map((x) => x.trim()).filter((x) => /\p{L}{2,}/u.test(x));
}
const altRe = (alt: string) => new RegExp(`(?<![\\p{L}\\p{N}])${alt.split(/[\s/-]+/).filter(Boolean).map((x) => esc(x).replace(/['’]/g, "['’]")).join("[\\s/-]+")}(?![\\p{L}\\p{N}])`, "giu");
/** The definition with the key word hidden ("…"), or null when it cannot be turned into a fair "which key word?" clue: the key word
 *  (or a form of it: plural, -ing, ...) would remain visible, the definition needs more than one different blank, or too little is left. */
export function maskDefinition(k: string, d: string): string | null {
  const alts = keyAlts(k);
  if (!alts.length) return null;
  let out = safe(d);
  const surfaces: string[] = [];
  for (const alt of [...alts].sort((x, y) => y.length - x.length)) out = out.replace(altRe(alt), (m) => { surfaces.push(m.toLowerCase().replace(/[\s/-]+/g, " ")); return "…"; });
  out = out.replace(/…(?:\s*…)+/g, "…");
  const blanks = (out.match(/…/g) ?? []).length;
  if (blanks > 2 || (blanks === 2 && new Set(surfaces).size > 1)) return null;
  // a form of the key word (plural, -ing, ...) left in the clue would give the answer away
  const rest = out.replace(/…/g, " ").toLowerCase().match(/\p{L}+/gu) ?? [];
  for (const alt of alts) {
    const aw = alt.toLowerCase().split(/[\s/-]+/).filter((x) => x.length >= 3);
    if (!aw.length) continue;
    if (aw.length === 1 ? rest.some((w) => derivedForm(w, aw[0])) : aw.every((a) => rest.some((w) => derivedForm(w, a)))) return null; // Q4: "vexed" gives "Vexation" away too
  }
  // an acronym of the key word ("First Past the Post" / "(FPTP)") left in the clue gives the answer away too
  for (const alt of alts) { const ws = alt.split(/[\s/-]+/).filter(Boolean); if (ws.length < 2) continue; const ini = ws.map((w) => w.charAt(0).toUpperCase()).join(""), ini2 = ws.filter((w) => !/^(of|the|and|in|a|an|to)$/i.test(w)).map((w) => w.charAt(0).toUpperCase()).join(""); if ((out.match(/\b[A-Z]{2,6}\b/g) ?? []).some((c) => c === ini || c === ini2)) return null; }
  // no blank and the definition starts as a predicate ("is a summary measure...", "means...") = not a sentence that can be asked as a meaning
  if (blanks === 0 && /^(?:is|are|means?|shows?|refers?|describes?|has|have|can|will)\b/i.test(out.trim())) return null;
  if (out.replace(/…/g, "").trim().length < 12 || (out.replace(/…/g, " ").match(/\p{L}{2,}/gu) ?? []).length < 4) return null;
  return out;
}
/** What the words around the blank(s) of a masked definition demand (a / an, is / are...). */
export function maskContext(masked: string): BlankCtx {
  const parts = masked.split("…");
  const ctxs: BlankCtx[] = [];
  for (let i = 0; i < parts.length - 1; i++) ctxs.push(blankContext(parts[i], parts[i + 1]));
  if (!ctxs.length) return { article: null, number: null, conflict: false, blank: false };
  const first = ctxs[0];
  return { ...first, conflict: ctxs.some((c) => c.conflict || c.article !== first.article || c.number !== first.number) };
}
const related = (a: string, b: string) => { const x = a.toLowerCase(), y = b.toLowerCase(); return x.includes(y) || y.includes(x) || x.slice(0, 5) === y.slice(0, 5); };
/** Could `c` be an acceptable answer for `target` as well? (synonym, sub-type, the acronym / expansion of the same thing, or a word that is
 *  part of the target's own definition.) Conservative: any doubt = near. */
export function near(target: KW, c: KW): boolean {
  if (related(c.k, target.k) || confusable(target.k, c.k)) return true;
  if (mentions(target.d, c.k) || (c.d && mentions(c.d, target.k))) return true;
  const cw = contentWords(c.k), tdw = contentWords(target.d);
  if (cw.length && cw.some((w) => tdw.some((x) => sameStem(w, x)))) return true;
  const td = toks(target.d), cd = toks(c.d);
  return jaccard(td, cd) >= 0.25 || overlap(td, cd) >= 3;
}
/** Make a distractor's first-letter case match the answer's (keys are listed as "Base" in some lessons and "base" in others). */
function alignCase(name: string, like: string): string {
  if (isProperName(name) || /^\p{Lu}\p{Lu}/u.test(name) || /\p{Ll}\p{Lu}/u.test(name) || name.length <= 3) return name;
  if (/^\p{Lu}/u.test(like) && /^\p{Ll}/u.test(name)) return name.charAt(0).toUpperCase() + name.slice(1);
  if (/^\p{Ll}/u.test(like) && /^\p{Lu}\p{Ll}/u.test(name)) return name.charAt(0).toLowerCase() + name.slice(1);
  return name;
}

/** Q5: how PLAUSIBLE is `c` as a wrong option for `target`? Same part of speech, a little shared vocabulary in the definitions (a lot would
 *  make it `near`, i.e. unfair), a similar length and the same suffix class. Candidates are ranked by this after the fairness guards. */
const SUFFIX_CLASS = /(?:tion|sion|ment|ness|ity|ing|ed|ly|ous|ive|al|ic|er|ism|ist)$/;
const suffixClass = (k: string) => { const w = k.toLowerCase().split(/[\s/-]+/).pop() ?? ""; return SUFFIX_CLASS.exec(w)?.[0] ?? ""; };
export function plausibility(target: KW, c: KW): number {
  const kt = wordKind(target.k, target.d), kc = wordKind(c.k, c.d);
  let s = 0;
  if (kt.pos && kc.pos && kt.pos === kc.pos) s += 2;
  s += Math.min(2, overlap(toks(target.d), toks(c.d)));
  if (c.k.length >= target.k.length * 0.5 && c.k.length <= target.k.length * 2) s += 1;
  if (suffixClass(target.k) === suffixClass(c.k)) s += 1;
  return s;
}
/** The same kind of word as the answer (Q5): a number word never stands in for a concept, a verb never for a noun. */
const kindOk = (target: KW, c: KW) => sameKind(wordKind(target.k, target.d), wordKind(c.k, c.d));
/** Seeded shuffle, then the most plausible first (stable, so the seed still breaks ties). */
const ranked = (target: KW, cs: KW[], seed: string) => shuffle(cs, seed).map((c, i) => ({ c, i, s: plausibility(target, c) })).sort((a, b) => b.s - a.s || a.i - b.i).map((x) => x.c);

function distractors(target: KW, own: KW[], pool: KW[], n: number, seed: string, ctx: BlankCtx): string[] | null {
  if (ctx.conflict) return null;
  // the answer itself must fit the words around the blank ("An … is", "… are")
  if (!optionsFit(ctx, [target.k])) return null;
  const nameOk = (c: KW) => c.k && hasWord(c.k) && c.k.length <= 40 && c.k.split(" ").length <= 4 && !/^(the|a|an|some|any)\s/i.test(c.k.trim()) && isProperName(c.k) === isProperName(target.k);
  const ok = (c: KW) => nameOk(c) && kindOk(target, c) && !near(target, c) && !new RegExp(`(?<![\\p{L}\\p{N}])${esc(safe(c.k))}`, "iu").test(safe(target.d)) && optionsFit(ctx, [target.k, c.k]);
  const out: string[] = [];
  const add = (cs: KW[]) => { for (const c of ranked(target, cs, seed + "d")) { if (out.length >= n) return; if (ok(c) && !out.some((o) => related(o, c.k)) && !out.some((o) => near({ k: o, d: "" }, c))) out.push(alignCase(safe(c.k), target.k)); } };
  add(own.filter((c) => c !== target && c.d)); add(pool);
  return out.length >= n ? out : null;
}

// ── the deck ─────────────────────────────────────────────────────────────────
export type Sec = { heading: string; points: string[] };
/** Words of a lesson-outline heading that say nothing about the content ("Using ...", "Results") are no evidence a point belongs to it. */
const GENERIC = new Set("using understanding problem problems solving solve practical results result method investigation questions question".split(" "));
const stems4 = (s: string) => new Set((plain(s).toLowerCase().match(/[\p{L}\p{N}]{3,}/gu) ?? []).filter((w) => !STOP.has(w) && !GENERIC.has(w)).map((w) => w.slice(0, 4)));
/** Does at least one of the points share a content word with the heading? A heading that shares none is a guess from the lesson's
 *  outline order (Q1 review: about one in five of those titles a slide that is about something else), so it is not shown. Words of the
 *  lesson's own outcome (`topic`) do not count: every slide of the lesson shares those, so they say nothing about THIS slide. */
export const linked = (heading: string, points: string[], topic = "") => {
  const skip = stems4(topic); const h = [...stems4(heading)].filter((x) => !skip.has(x));
  if (points.some((p) => { const t = stems4(p); return h.some((x) => t.has(x)); })) return true;
  // Q5: "What is a design?" fits a slide whose point defines the term ("A design is…"), even when "design" is the lesson's topic word
  const def = /^what (?:is|are) (?:an? |the )?['‘"“]?(.+?)['’"”]?\??$/i.exec(plain(heading).trim());
  if (!def) return false;
  const term = new RegExp(`^(?:an? |the )?['‘"“]?${esc(def[1])}['’"”]?\\s+(?:is|are|means?)\\b`, "iu");
  return points.some((p) => term.test(plain(p)));
};
/** Every content word of the heading occurs in the points (a heading derived from the points themselves can't mislabel them). Q5. */
export const grounded = (heading: string, points: string[]) => {
  const h = [...stems4(heading)]; if (!h.length) return false;
  const t = new Set(points.flatMap((p) => [...stems4(p)]));
  return h.every((x) => t.has(x));
};

// ── Q5: a real heading for a section whose outline heading does not fit ───────────────────────────────────────────────────────
/** The first finite verb of a statement (the words before it are its grammatical subject). */
const VERB = /\b(?:is|are|was|were|be|been|can|could|will|would|has|have|had|does|do|did|may|might|must|should|shall|need|needs|means|mean|shows?|causes?|produces?|makes?|forms?|contains?|uses?|allows?|helps?|occurs?|happens?|increases?|decreases?|changes?|depends?|gives?|leads?|results?|remains?|stays?|moves?|travels?|absorbs?|releases?|reacts?|equals?|involves?|requires?|provides?|creates?|consists?|includes?|represents?|describes?|measures?|keeps?|comes?|goes?|turns?|works?|breaks?|holds?|carries?|joins?|loses?|gains?|grows?|flows?|rises?|falls?|affects?|tells?|says?|states?|explains?|refers?|symbolises?|reflects?|contrasts?|highlights?|suggests?|indicates?|presents?|explores?|reveals?|appears?|seems?|becomes?|tends?|lets?|takes?|enables?|ensures?|relates?|demonstrates?|illustrates?|conveys?|expresses?|emphasises?|implies?|marks?|links?|connects?|signals?|offers?|adds?|brings?|follows?|exists?|lives?|passes?|transfers?|meets?|sits?|lies?|stands?|runs?|drops?|starts?|begins?|ends?|finishes?|stops?|stores?|supplies?|supports?|controls?|protects?|prevents?|reduces?|improves?|develops?|displays?|matters?|varies?|differs?|splits?|divides?|combines?|mixes?|dissolves?|transmits?|acts?|wants?|feels?|looks?|sounds?|plays?|writes?|reads?|speaks?|thinks?|knows?|learns?|receives?|sends?|gets?|puts?|sets?|builds?|attracts?|repels?|conducts?|vibrates?|orbits?|rotates?|spins?|melts?|freezes?|boils?|evaporates?|condenses?|burns?|expands?|contracts?|heats?|cools?|converts?|transforms?|generates?|transports?|exchanges?|filters?|digests?|breathes?|pumps?|beats?|circulates?|reproduces?|inherits?|adapts?|evolves?|competes?|feeds?|eats?|hunts?|survives?|dies?|decays?|decomposes?|recycles?|pollutes?|warms?|reflects?|refracts?|bends?|bounces?|counts?|rounds?|multiplies|subtracts?|simplifies|solves?|calculates?|estimates?|compares?|orders?|sorts?|matches?|plots?|draws?|allow|often|usually|always|never|also|only|typically|generally|sometimes)\b/iu;
const SUBJ_BAD_START = /^(?:when|if|in|on|at|by|for|to|as|although|because|while|during|after|before|since|arguably|however|therefore|so|then|also|here|there|it|this|these|those|they|we|you|our|your|i|he|she|his|her|its|their|some|many|most|all|both|each|every|no|not|one|once|first|second|next|finally|usually|often|sometimes|typically|generally|today|now|like|unlike|with|without|from|of|about|through|over|under|between|among|per|using|according|e\.g\.|i\.e\.)\b/i;
const capFirst = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
/** The grammatical subject of a key learning point as a short heading ("The purpose of editing is…" → "The purpose of editing";
 *  "'Devour' is a verb…" → "Devour"), or null when the sentence has no clean subject (a clause first, a pronoun, a list, a lone name). */
export function subjectPhrase(point: string, lessonText: string): string | null {
  const t = plain(safe(point));
  const m = VERB.exec(t);
  if (!m || m.index === 0) return null;
  let s = t.slice(0, m.index).trim().replace(/[,:;–-]+$/, "").trim();
  s = s.replace(/^['‘"“]+|['’"”]+$/g, "").trim();
  if (!s || /[,:;()"“”]/.test(s) || !/\p{L}{3,}/u.test(s) || SUBJ_BAD_START.test(s) || /\b(?:that|which|who|whose|where|when|and|or)$/i.test(s)) return null;
  const words = s.split(/\s+/);
  if (words.length > 6) return null;
  if (words.length === 1) {
    const w = words[0];
    if (w.length < 4) return null;
    // a lone word is a heading only when the point defines it ("Gargantuan is an adjective…") or it is a common noun of the lesson (seen in lower case)
    const definitional = /^(?:is|are|means?)$/i.test(m[0]);
    const commonNoun = new RegExp(`(?<![\\p{L}])${esc(w.toLowerCase())}(?![\\p{L}])`, "u").test(lessonText);
    if (!definitional && !commonNoun) return null;
  }
  return capFirst(s);
}
export interface Titled extends Sec { title: string; fromOutline: boolean }
/** A title for every section: its outline heading when that fits (`linked`), else the key word the points are about, else the subject
 *  of the first point, else "Key idea N". Derived titles are never repeated within a deck. */
export function titleSections(secs: Sec[], kws: KW[], lessonText: string): Titled[] {
  const taken = new Set<string>();
  const out: Titled[] = [];
  const take = (t: string) => { taken.add(t.toLowerCase()); return t; };
  secs.forEach((sec, si) => {
    const generic = secs.length > 1 ? `Key idea ${si + 1}` : "Key ideas";
    if (sec.heading) { out.push({ ...sec, title: take(sec.heading), fromOutline: true }); return; }
    let title = "";
    // the key word the section is about: in at least half its points (and in two of them, or the subject of its only point)
    const need = Math.max(1, Math.ceil(sec.points.length / 2));
    const counted = kws.filter((k) => hasWord(k.k) && k.k.length >= 3).map((k) => ({ k, n: sec.points.filter((p) => wordRe(safe(k.k)).test(p)).length })).filter((x) => x.n >= need && !taken.has(safe(x.k.k).toLowerCase()));
    const lead = counted.find((x) => x.n >= 2) ?? counted.find((x) => sec.points.length === 1 && new RegExp(`^(?:an? |the )?['‘"“]?${esc(safe(x.k.k))}`, "iu").test(plain(sec.points[0])));
    if (lead) title = capFirst(safe(lead.k.k));
    if (!title) for (const p of sec.points) { const s = subjectPhrase(p, lessonText); if (s && !taken.has(s.toLowerCase()) && grounded(s, sec.points)) { title = s; break; } }
    if (title && !taken.has(title.toLowerCase()) && grounded(title, sec.points)) out.push({ ...sec, title: take(title), fromOutline: false });
    else out.push({ ...sec, title: generic, fromOutline: false });
  });
  return out;
}
/** Spread the key learning points over the lesson-outline headings in order (best word overlap with the heading, with a pull
 *  towards an even spread). A section keeps its heading only when the heading shares a content word with its points; otherwise its
 *  heading is "" (callers title it "Key idea N"). */
export function allocate(points: string[], outline: string[], topic = ""): Sec[] {
  const n = points.length, m = outline.length;
  if (!n) return [];
  if (m <= 1) return [{ heading: outline[0] && linked(outline[0], points, topic) ? outline[0] : "", points }];
  const pt = points.map(toks), ht = outline.map(toks);
  const NEG = -1e9;
  const best: number[][] = Array.from({ length: n }, () => Array(m).fill(NEG));
  const from: number[][] = Array.from({ length: n }, () => Array(m).fill(0));
  for (let k = 0; k < n; k++) for (let j = 0; j < m; j++) {
    const gain = overlap(pt[k], ht[j]) - 0.35 * Math.abs(j - Math.round((k * (m - 1)) / Math.max(1, n - 1)));
    if (k === 0) best[k][j] = gain;
    else for (let p = 0; p <= j; p++) if (best[k - 1][p] + gain > best[k][j]) { best[k][j] = best[k - 1][p] + gain; from[k][j] = p; }
  }
  let j = 0; for (let x = 1; x < m; x++) if (best[n - 1][x] > best[n - 1][j]) j = x;
  const at: number[] = Array(n).fill(0);
  for (let k = n - 1; k >= 0; k--) { at[k] = j; j = from[k][j]; }
  const secs: Sec[] = [];
  for (let s = 0; s < m; s++) { const ps = points.filter((_, k) => at[k] === s); if (ps.length) secs.push({ heading: linked(outline[s], ps, topic) ? outline[s] : "", points: ps }); }
  return secs;
}

const TITLE_MAX = 90;
const clipTitle = (s: string) => { const t = safe(s); return t.length > TITLE_MAX ? `${t.slice(0, TITLE_MAX - 1).trimEnd()}…` : t; };

export function buildDeck(inp: DeckInput): Slide[] {
  // source text with leftover LaTeX / template junk, blanks, teacher directives and lesson references is left out rather than shown
  // (quality.ts: cleanPoints / cleanKeywords; idempotent, the importer already applied them to the facts)
  const kws = cleanKeywords(inp.keywords.map((k) => ({ k: safe(k.k), d: safe(k.d) }))).filter((k) => k.k && hasWord(k.k) && !JUNK.test(k.k) && !JUNK.test(k.d));
  const kwWithDef = kws.filter((k) => k.d.length >= 8);
  const points = cleanPoints(inp.points.map(safe));
  if (!points.length && kwWithDef.length < 2) return [];
  const kwNames = kws.map((k) => k.k);
  const outline = inp.outline.map(safe).filter(Boolean);
  const slides: Slide[] = [];
  // everything Oak says in this lesson: a wrong option must not be a topic word of the lesson (it could complete another sentence)
  const lessonText = [inp.outcome, inp.lessonTitle, inp.unitTitle, ...outline, ...points].map(safe).join(" "); // Q2: title, unit and outline words too

  // NOTE: no art here. Pictures are chosen (or not) by the verified-picture policy in art/select.ts (applyArtPolicy, run by deckFor).
  // 1. Today's learning
  {
    const blocks: Block[] = [];
    const lead = safe(inp.outcome) || safe(inp.lessonTitle);
    blocks.push({ t: "lead", text: lead });
    if (inp.unitTitle) blocks.push({ t: "text", text: `This lesson is part of the unit “${safe(inp.unitTitle)}”.` });
    const items = (outline.length ? outline : kwNames).slice(0, 4).map((t) => ({ title: clipTitle(t) }));
    if (items.length) blocks.push({ t: "cards", items });
    slides.push({ kind: "intro", title: "Today’s learning", blocks });
  }

  // 2. Key words (tap to flip)
  if (kwWithDef.length) {
    const size = kwWithDef.length > 6 ? Math.ceil(kwWithDef.length / Math.ceil(kwWithDef.length / 6)) : kwWithDef.length;
    for (let i = 0; i < kwWithDef.length; i += size) {
      const part = kwWithDef.slice(i, i + size);
      slides.push({ kind: "intro", title: kwWithDef.length > size ? `Key words (${Math.floor(i / size) + 1})` : "Key words",
        blocks: [{ t: "text", text: "Tap each word to see what it means." }, { t: "define", items: part.map((k) => ({ term: k.k, def: k.d })) }] });
    }
  }

  // 3. Teaching slides (one per part of the lesson) with a cloze check after each
  const secs = titleSections(allocate(points, outline, inp.outcome), kws, lessonText);
  let checks = 0;
  const clozeKeys: string[] = [];
  secs.forEach((sec, si) => {
    const heading = sec.title;
    const blocks: Block[] = [];
    if (sec.points.length === 1) blocks.push({ t: "lead", text: accent(sec.points[0], kwNames) });
    else blocks.push({ t: "list", items: sec.points.map((p) => accent(p, kwNames)) });
    const used = kws.filter((k) => sec.points.some((p) => wordRe(k.k).test(p))).map((k) => k.k).slice(0, 4);
    if (used.length && used.length < kws.length) blocks.push({ t: "text", text: "Key words in this part:" }, { t: "chips", items: used.map((u) => `{${u}}`) });
    slides.push({ kind: "explain", title: clipTitle(heading), blocks });

    // one cloze per section at most, three per lesson: hide one of the lesson's own key words inside its own key learning point
    if (checks >= 3) return;
    for (const p of sec.points) {
      const cz = cloze(p, kws, inp.pool, `${inp.seed}|c${si}`, points, lessonText, LANG_SUBJECTS.has(inp.subject));
      if (!cz || clozeKeys.some((k) => related(k, cz.key))) continue; // never two checks on the same word
      clozeKeys.push(cz.key);
      slides.push({ kind: "check", title: "Quick check", blocks: [
        { t: "text", text: "Choose the word that completes the key idea." },
        { t: "choice", q: cz.q, options: cz.options, answer: cz.answer, why: cz.why },
      ] });
      checks++; break;
    }
  });
  if (!secs.length && kwWithDef.length) { /* keywords-only lesson: the define slides are the teaching */ }

  // 4. Key-word practice: match + "which word means…?"
  // two keywords with the same (or near-identical) meaning, or the same word twice, can't be matched or asked fairly: drop both
  const dupDef = (k: KW) => kwWithDef.some((o) => o !== k && (o.k.toLowerCase() === k.k.toLowerCase() || o.d.toLowerCase() === k.d.toLowerCase() || maskDefinition(o.k, o.d) === maskDefinition(k.k, k.d) || jaccard(toks(o.d), toks(k.d)) >= 0.6));
  const fair = kwWithDef.filter((k) => !dupDef(k));
  const pairs = fair.filter((k) => k.d.length <= 160).slice(0, 5);
  const practice: Block[] = [];
  if (pairs.length >= 3) practice.push({ t: "match", q: "Match each key word to its meaning.", pairs: pairs.map((k) => ({ a: k.k, b: k.d })) });
  const qs: { q: string; options: string[]; answer: number }[] = [];
  const usedNames: string[] = [];
  for (const k of shuffle(fair, `${inp.seed}|kq`)) {
    if (qs.length >= 3) break;
    const masked = maskDefinition(k.k, k.d);
    if (!masked) continue;
    // the same fact must not be asked twice (a cloze / another item on the same word)
    if (usedNames.some((u) => related(u, k.k)) || clozeKeys.some((u) => related(u, k.k))) continue;
    const ds = distractors(k, kws, inp.pool, 2, `${inp.seed}|${k.k}`, maskContext(masked));
    if (!ds) continue;
    const opts = shuffle([safe(k.k), ...ds], `${inp.seed}|o|${k.k}`);
    qs.push({ q: masked, options: opts, answer: opts.indexOf(safe(k.k)) }); usedNames.push(k.k);
  }
  if (qs.length >= 2) practice.push({ t: "choices", q: "Which key word matches each meaning?", items: qs });
  else if (qs.length === 1) practice.push({ t: "choice", q: `Which key word matches this meaning? ${qs[0].q}`, options: qs[0].options, answer: qs[0].answer });
  if (practice.length) slides.push({ kind: "practice", title: "Key word practice", blocks: practice });

  // 5. Summary
  if (points.length) slides.push({ kind: "summary", title: "What you have learned", blocks: [{ t: "list", items: points.map((p) => accent(p, kwNames)) }] });
  else if (kwWithDef.length) slides.push({ kind: "summary", title: "What you have learned", blocks: [{ t: "list", items: kwWithDef.slice(0, 6).map((k) => `{${k.k}}: ${k.d}`) }] });
  return slides;
}

// ── flashcards (import.ts: one card per keyword with a definition + one cloze card per key learning point) ─────────────────
export interface Card { /** id suffix: k<n> = keyword card n, l<n> = key-learning-point card n (stable across re-imports) */ key: string; front: string; back: string }
const BLANK = "_____";
function clozeFront(point: string, keywords: string[]): { front: string; back: string } | null {
  const text = point.replace(/\s+/g, " ").trim();
  const words = text.split(" ");
  if (words.length < 5 || text.length > 700) return null;
  for (const kw of [...keywords].sort((a, b) => b.length - a.length)) {
    if (kw.length < 3) continue;
    const m = new RegExp(`(^|[^\\p{L}\\p{N}])(${esc(kw)})(?=$|[^\\p{L}\\p{N}])`, "iu").exec(text);
    if (m) {
      const at = m.index + m[1].length;
      return { front: `Fill in the gap: ${text.slice(0, at)}${BLANK}${text.slice(at + m[2].length)}`, back: `${m[2]}\n\n${text}` };
    }
  }
  // no lesson keyword inside the sentence: show the first half and ask for the rest (only the lesson's own words)
  if (words.length < 7) return null;
  const cut = Math.ceil(words.length / 2);
  return { front: `Finish this key point: ${words.slice(0, cut).join(" ")} …`, back: text };
}
/** The flashcards of one lesson from its cleaned facts (`factsFromRaw`). `lang` = a language lesson (the front is the foreign word itself). */
export function flashcardsFor(points: string[], keywords: KW[], lang: boolean): Card[] {
  const out: Card[] = [];
  keywords.filter((k) => k.d).forEach((k, i) => out.push({ key: `k${i + 1}`, front: lang ? k.k : `What does "${k.k}" mean?`, back: k.d }));
  const kws = keywords.map((k) => k.k);
  points.forEach((p, i) => { const c = clozeFront(p, kws); if (c) out.push({ key: `l${i + 1}`, ...c }); });
  return out;
}

/** Does `rest` (a sentence with the answer removed) still show the answer: a form of the word, or its acronym ("First Past the Post" / FPTP)? */
export function leaks(rest: string, answer: string): boolean {
  if (mentions(rest, answer)) return true;
  // Q4: a derived form of a one-word answer ("vexed" / "Vexation", "superstitious" / "superstition")
  const aw = answer.toLowerCase().split(/[\s/-]+/).filter((x) => x.length >= 4);
  if (aw.length === 1 && (rest.toLowerCase().match(/\p{L}{4,}/gu) ?? []).some((w) => derivedForm(w, aw[0]))) return true;
  const ini = answer.split(/[\s/-]+/).filter(Boolean).map((w) => w.charAt(0).toUpperCase()).join("");
  const ini2 = answer.split(/[\s/-]+/).filter((w) => !/^(of|the|and|in|a|an|to)$/i.test(w)).map((w) => w.charAt(0).toUpperCase()).join("");
  const caps = rest.match(/\b[A-Z]{2,6}\b/g) ?? [];
  return caps.some((c) => c === ini || c === ini2 || (/^[A-Z]{2,6}$/.test(answer.trim()) && false));
}

/** A key learning point with one of ITS OWN key words hidden. Wrong options are key words of the unit that are unrelated to the answer,
 *  do not appear anywhere in the lesson's own text, agree with the answer in a/an and singular/plural, and do not reproduce a key
 *  learning point when substituted. Skipped when the sentence holds two or more key words (the blank could then be argued either
 *  way), still shows a form of the answer, names a proper noun, or is too short / long / thin to be a fair fill-the-gap. */
export function cloze(point: string, kws: KW[], pool: KW[], seed: string, allPoints: string[] = [], lessonText = "", strict = false): { q: string; options: string[]; answer: number; why: string; key: string } | null {
  const text = safe(point);
  const words = text.split(" ");
  if (words.length < 6 || text.length > 200 || /_{2,}|…|\.\.\./.test(text)) return null;
  const inSentence = kws.filter((k) => hasWord(k.k) && k.k.length >= 3 && wordRe(safe(k.k)).test(text));
  if (inSentence.length !== 1) return null;
  const target = inSentence[0];
  const m = wordRe(safe(target.k)).exec(text)!;
  const at = m.index + m[1].length;
  if (wordRe(safe(target.k)).test(text.slice(at + m[2].length))) return null; // appears twice
  const answerText = m[2];
  if (/^\p{Lu}\p{Ll}/u.test(answerText) && at > 0) return null; // a proper noun in mid-sentence: option case would give it away
  const before = text.slice(0, at), after = text.slice(at + answerText.length);
  const rest = `${before} ${after}`;
  if (leaks(rest, answerText) || contentWords(rest).length < 5) return null;
  // Q2 (clozeGuard.ts): only the term of a DEFINING sentence is blanked ("A ___ is ...", "'___' means ..."); a sentence that merely
  // mentions the term ("...in the ___", "a ___ explanation") can usually be completed by another key word too
  if (strict && (!definitionalBlank(before, after) || slashAdjacent(before, after))) return null;
  const ctx = blankContext(before, after);
  if (ctx.conflict || !optionsFit(ctx, [answerText])) return null;
  const lower = text.toLowerCase();
  const ds: string[] = [];
  // the sentence must be ABOUT what the key word means: it shares a content word with the key word's own definition (a generic sentence
  // such as "plants need ___ to grow" fits water, warmth and light alike)
  const tdw = contentWords(target.d);
  if (!strict && !(target.d && contentWords(rest).some((w) => tdw.some((x) => sameStem(w, x))))) return null;
  // wrong options: other lessons' key words of the unit (this lesson's own key words are its topic words: any of them could fit too);
  // the language subjects (Q2, strict) keep using the lesson's own words together with their confusable-family guards
  for (const c of ranked(target, strict ? [...kws.filter((k) => k !== target), ...pool] : pool, seed)) {
    if (ds.length >= 2) break;
    const name = safe(c.k);
    if (!hasWord(name) || name.length > 40 || related(name, target.k) || lower.includes(name.toLowerCase()) || ds.some((d) => related(d, name))) continue;
    // a wrong option must not read like the answer: keep it the same "shape" (single word vs phrase), the same kind of name / word (Q5)
    if ((name.split(" ").length > 1) !== (target.k.split(" ").length > 1) || isProperName(name) !== isProperName(answerText) || !kindOk(target, c)) continue;
    if (!optionsFit(ctx, [answerText, name])) continue;
    // a topic word of this lesson (or related to the answer / its definition) could complete the sentence too
    if (mentions(lessonText, name) || mentions(text, name) || near(target, c)) continue;
    if (strict && distractorClash(answerText, name, after)) continue; // Q2: same confusable family / two adjectives (clozeGuard.ts)
    // ...and filling the blank with it must not reproduce another of the lesson's key learning points
    if (allPoints.some((p) => safe(p).toLowerCase() === `${before}${name}${after}`.toLowerCase())) continue;
    ds.push(name);
  }
  if (ds.length < 2) return null;
  // same capitalisation for every option, so the answer can't be spotted by its letter case
  const fit = (w: string) => (/^\p{Lu}\p{Lu}/u.test(w) || /\p{Ll}\p{Lu}/u.test(w) ? w : at === 0 ? w.charAt(0).toUpperCase() + w.slice(1) : w.charAt(0).toLowerCase() + w.slice(1));
  const opts = shuffle([answerText, ...ds.map(fit)], seed + "o");
  if (!optionsFit(ctx, opts)) return null;
  return { q: `${before}_____${after}`, options: opts, answer: opts.indexOf(answerText), why: text, key: target.k };
}
