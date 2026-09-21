// Deck validator: schema + content checks on a slide deck, and an INDEPENDENT re-derivation of every answer key from the raw
// Oak lesson (never trusting the generator's own bookkeeping). A deck with any problem is rejected as a whole.
import { clozeProblems } from "./clozeGuard";
import { normalizeSlides, type Slide } from "../../../../features/learninghub/lesson/slides/types";
import { plain, safe, maskDefinition, maskContext, near, leaks, linked, grounded, type KW } from "./generate";
import { blankContext, optionsFit, mentions, contentWords, sameStem, confusable, tidy } from "./quality";

const KINDS = new Set(["intro", "explain", "practice", "check", "summary"]);
const nonEmpty = (s: unknown): s is string => typeof s === "string" && s.trim().length > 0;
const balanced = (s: string) => { let d = 0; for (const c of s) { if (c === "{") d++; else if (c === "}") d--; if (d < 0 || d > 1) return false; } return d === 0 && (s.match(/\*\*/g)?.length ?? 0) % 2 === 0; };
const norm = (s: string) => plain(s).replace(/\s+/g, " ").trim().toLowerCase();

export interface RawFacts { points: string[]; /** the lesson outcome (its words are not evidence that a heading fits a slide) */ outcome?: string; keywords: KW[]; /** other lessons' keywords of the unit (they may appear as wrong options) */ pool?: KW[]; /** English / language decks: the fill-the-gap guards of clozeGuard.ts apply (Q2) */ strict?: boolean }

/** Every string in a block must be non-empty, printable, with balanced markup. Returns problems. */
function strings(node: unknown, out: string[], path = ""): void {
  if (typeof node === "string") { out.push(`${path}\u0000${node}`); return; }
  if (Array.isArray(node)) node.forEach((v, i) => strings(v, out, `${path}[${i}]`));
  else if (node && typeof node === "object") for (const [k, v] of Object.entries(node as Record<string, unknown>)) if (k !== "t" && k !== "kind") strings(v, out, `${path}.${k}`);
}

/** `curated` = an agent-authored deck: every block type is allowed (schema-checked only); answer keys can't be re-derived, so they are
 *  range-checked here and verified by the reviewer lane instead. */
export function validateDeck(deck: unknown[], facts?: RawFacts, curated = false): string[] {
  const bad: string[] = [];
  const add = (m: string) => { if (bad.length < 20) bad.push(m); };
  if (!Array.isArray(deck) || !deck.length) return ["empty deck"];
  if (deck.length > 60) add(`too many slides (${deck.length})`);
  const norm0 = normalizeSlides(deck);
  if (norm0.length !== deck.length) add(`normalizeSlides dropped ${deck.length - norm0.length} slide(s)`);
  if (JSON.stringify(deck).length > 150_000) add("deck over 150KB");
  const kwFacts = facts ? facts.keywords.map((k) => ({ k: safe(k.k), d: safe(k.d) })) : [];
  const pointFacts = facts ? facts.points.map(safe) : [];
  (deck as Slide[]).forEach((s, i) => {
    const at = `slide ${i + 1} "${s.title}"`;
    if (!KINDS.has(s.kind)) add(`${at}: bad kind ${s.kind}`);
    if (!nonEmpty(s.title)) add(`${at}: empty title`);
    if (s.art && (s.art.length > 2 || s.art.some((a) => !nonEmpty(a)))) add(`${at}: bad art`);
    const pics = (s as unknown as { pics?: { id?: unknown }[] }).pics;
    if (pics && (!Array.isArray(pics) || pics.length > 2 || pics.some((p) => typeof p?.id !== "string"))) add(`${at}: bad pics`);
    if (!Array.isArray(s.blocks) || !s.blocks.length) { add(`${at}: no blocks`); return; }
    if (!curated && s.kind === "explain") {
      const texts = (s.blocks as unknown as { t: string; text?: string; items?: string[] }[]).flatMap((b) => (b.t === "lead" ? [String(b.text)] : b.t === "list" ? (b.items ?? []).map(String) : []));
      // a heading that shares no content word with the points under it is a guess from the outline (quality: it mislabelled ~1 slide in 5)
      // (a derived heading — a key word or the subject of a point — is accepted when every content word of it is in the points: Q5)
      if (!/^Key ideas?( \d+)?$/.test(s.title) && !linked(s.title, texts, facts?.outcome ?? "") && !grounded(s.title, texts)) add(`${at}: heading shares no content word with its points`);
      if (new Set(texts.map(norm)).size !== texts.length) add(`${at}: a key idea is repeated`);
    }
    const all: string[] = [];
    strings(s.title, all, "title"); strings(s.blocks, all, "blocks");
    for (const x of all) {
      const [p, v] = x.split("\u0000");
      if (!nonEmpty(v)) add(`${at}: empty text at ${p}`);
      else if (!balanced(v)) add(`${at}: unbalanced markup at ${p}: ${v.slice(0, 50)}`);
      else if (/\[object |\{\{|\$\$|\\\(|\\frac|\\times/.test(v)) add(`${at}: junk text at ${p}: ${v.slice(0, 50)}`);
      else if (!curated && (/<\/?[a-z]+>|_{2,}/.test(v.replace(/_____/g, "")) || tidy(v) !== v)) add(`${at}: leaked markup / blank stem / untidied text at ${p}: ${v.slice(0, 50)}`);
      else if (!curated && /(?<![\p{L}\p{N}])(the|and|to|of|in|is|are|it|for|or|a|an)\s+\1(?![\p{L}\p{N}])/iu.test(v)) add(`${at}: repeated word at ${p}: ${v.slice(0, 50)}`);
      else if (v.length > 600) add(`${at}: over-long text at ${p}`);
    }
    for (const b of s.blocks as unknown as Record<string, unknown>[]) {
      const t = String(b.t);
      const arr = (k: string, min: number, max = 60) => { const a = b[k]; if (!Array.isArray(a) || a.length < min || a.length > max) { add(`${at}: ${t}.${k} needs ${min}-${max} items`); return [] as never[]; } return a as never[]; };
      switch (t) {
        case "text": case "lead": case "callout": if (!nonEmpty(b.text)) add(`${at}: ${t} without text`); break;
        case "list": case "chips": arr("items", 1, 12); break;
        case "cards": for (const c of arr("items", 1, 8) as { emoji?: string; title?: string }[]) if (!nonEmpty(c.title) || (c.emoji !== undefined && !nonEmpty(c.emoji))) add(`${at}: card without title / with an empty emoji`); break;
        case "define": {
          for (const it of arr("items", 1, 12) as { term?: string; def?: string }[]) {
            if (!nonEmpty(it.term) || !nonEmpty(it.def)) { add(`${at}: define without term/def`); continue; }
            if (facts && !kwFacts.some((k) => k.k === it.term && k.d === it.def)) add(`${at}: define "${it.term}" is not one of the lesson's keyword definitions`);
          }
          break;
        }
        case "match": {
          if (curated) { const ps = arr("pairs", 2, 8) as { a?: string; b?: string }[]; if (ps.some((p) => !nonEmpty(p.a) || !nonEmpty(p.b)) || new Set(ps.map((p) => plain(p.a ?? "").trim())).size !== ps.length) add(`${at}: match pairs incomplete or repeated`); break; }
          const pairs = arr("pairs", 3, 8) as { a?: string; b?: string }[];
          if (new Set(pairs.map((p) => norm(p.a ?? ""))).size !== pairs.length || new Set(pairs.map((p) => norm(p.b ?? ""))).size !== pairs.length) add(`${at}: match has a repeated side`);
          for (const p of pairs) if (facts && !kwFacts.some((k) => k.k === p.a && k.d === p.b)) add(`${at}: match pair "${p.a}" is not a keyword/definition pair from the lesson`);
          break;
        }
        case "choice": checkChoice(at, b as { q: string; options: string[]; answer: number; why?: string }, facts, kwFacts, pointFacts, add, curated); break;
        case "choices": {
          if (!Array.isArray(b.items) || (b.items as unknown[]).length < 1) { add(`${at}: choices without items`); break; }
          for (const it of b.items as { q: string; options: string[]; answer: number }[]) checkChoice(at, it, facts, kwFacts, pointFacts, add, curated);
          break;
        }
        case "reveal": if (!nonEmpty(b.text)) add(`${at}: reveal without text`); if (!curated) add(`${at}: reveal is not a generator block`); break;
        case "roots": for (const it of arr("items", 1, 12) as { word?: string; root?: string }[]) if (!nonEmpty(it.word) || !nonEmpty(it.root)) add(`${at}: roots item incomplete`); break;
        case "formula": for (const r of arr("rows", 1, 8) as { root?: string; add?: string; result?: string }[]) if (!nonEmpty(r.root) || !nonEmpty(r.add) || !nonEmpty(r.result)) add(`${at}: formula row incomplete`); break;
        case "sort": {
          const cols = arr("columns", 2, 4) as string[]; const items = arr("items", 2, 16) as { text?: string; col?: number }[];
          for (const it of items) if (!nonEmpty(it.text) || !Number.isInteger(it.col) || (it.col as number) < 0 || (it.col as number) >= cols.length) add(`${at}: sort item "${it.text}" has a bad column`);
          if (!nonEmpty(b.q)) add(`${at}: sort without question`);
          break;
        }
        case "spell": case "lcwc": for (const w of arr("words", 1, 12) as string[]) if (!nonEmpty(w)) add(`${at}: empty word`); break;
        case "clap": for (const it of arr("items", 1, 6) as { word?: string; chunks?: string[] }[]) if (!nonEmpty(it.word) || !Array.isArray(it.chunks) || it.chunks.length < 2 || it.chunks.join("").replace(/\s/g, "").toLowerCase() !== String(it.word).replace(/\s/g, "").toLowerCase()) add(`${at}: clap chunks don't spell "${it.word}"`); break;
        default: add(`${at}: block type "${t}" is not allowed`);
      }
    }
  });
  const first = (deck as Slide[])[0], last = (deck as Slide[])[deck.length - 1];
  if (first.kind !== "intro") add("first slide is not an intro");
  if (last.kind !== "summary" && !(deck as Slide[]).some((s) => s.kind === "summary")) add("no summary slide");
  return bad;
}

function checkChoice(at: string, c: { q?: string; options?: string[]; answer?: number; why?: string }, facts: RawFacts | undefined, kw: KW[], points: string[], add: (m: string) => void, curated = false) {
  const opts = c.options;
  if (!Array.isArray(opts) || opts.length < 2 || opts.length > 6 || !opts.every(nonEmpty)) { add(`${at}: choice options invalid`); return; }
  if (new Set(opts.map((o) => (curated ? plain(o).trim() : norm(o)))).size !== opts.length) { add(`${at}: choice has duplicate options`); return; }
  if (!Number.isInteger(c.answer) || (c.answer as number) < 0 || (c.answer as number) >= opts.length) { add(`${at}: choice answer index out of range`); return; }
  if (!facts || curated) return;
  const q = c.q ?? "";
  const picked = opts[c.answer as number];
  // (a) "which key word means <masked definition>": the marked option must be the keyword whose masked definition this is, and no
  //     other option may be a keyword whose masked definition is the same
  const tail = q.replace(/^Which key word matches this meaning\?\s*/, "");
  const allKw = [...kw, ...(facts.pool ?? []).map((k) => ({ k: safe(k.k), d: safe(k.d) }))];
  const byDef = kw.filter((k) => maskDefinition(k.k, k.d) === tail);
  if (byDef.length) {
    if (byDef.length !== 1) { add(`${at}: ambiguous keyword definition "${tail.slice(0, 40)}"`); return; }
    if (safe(picked) !== byDef[0].k) add(`${at}: WRONG KEY — "${tail.slice(0, 50)}" is the definition of "${byDef[0].k}" but option ${c.answer} is "${picked}"`);
    for (const o of opts) if (o !== picked && allKw.some((k) => k.k.toLowerCase() === safe(o).toLowerCase() && (maskDefinition(k.k, k.d) === tail || safe(k.d) === safe(byDef[0].d)))) add(`${at}: two options are correct for "${tail.slice(0, 40)}"`);
    if (!optionsFit(maskContext(tail), opts)) add(`${at}: options do not all fit the blank grammatically (a/an, is/are) in "${tail.slice(0, 40)}"`);
    // no wrong option may be a synonym / sub-type / acronym of the answer, or a word of its definition
    for (const o of opts) if (o !== picked) { const c = allKw.find((k) => k.k.toLowerCase() === safe(o).toLowerCase()); if (c && near(byDef[0], c)) add(`${at}: option "${o}" is too close to the answer "${byDef[0].k}" (could also be correct)`); }
    return;
  }
  // (b) cloze: filling the blank with the marked option must reproduce one of the lesson's key learning points exactly
  if (q.includes("_____")) {
    const filled = q.replace("_____", picked);
    if (!points.some((p) => p === filled)) { add(`${at}: WRONG KEY — cloze "${q.slice(0, 60)}" with "${picked}" is not a key learning point of the lesson`); return; }
    if (c.why !== filled) add(`${at}: cloze explanation differs from the key learning point`);
    for (const o of opts) if (o !== picked && points.some((p) => p.toLowerCase() === q.replace("_____", o).toLowerCase())) add(`${at}: two options reproduce a key learning point`);
    const [b4, af] = q.split("_____");
    if (!optionsFit(blankContext(b4, af), opts)) add(`${at}: cloze options do not all fit the blank grammatically (a/an, is/are): "${q.slice(0, 60)}"`);
    if (leaks(`${b4} ${af}`, picked)) add(`${at}: cloze still shows the answer "${picked}"`);
    if (contentWords(`${b4} ${af}`).length < 5) add(`${at}: cloze sentence is too thin to have one answer`);
    if (!facts.strict) {
      // the sentence must be about the key word's own meaning, and no wrong option may be a key word of this lesson or confusable with the answer
      const kwt = kw.find((k) => k.k.toLowerCase() === picked.toLowerCase()); const tdw = contentWords(kwt?.d ?? "");
      if (!kwt || !contentWords(`${b4} ${af}`).some((w) => tdw.some((x) => sameStem(w, x)))) add(`${at}: cloze sentence shares no word with the definition of "${picked}" (a generic sentence: other key words could fit)`);
      for (const o of opts) if (o !== picked && (kw.some((k) => k.k.toLowerCase() === o.toLowerCase()) || confusable(picked, o))) add(`${at}: cloze option "${o}" is a key word of this lesson / confusable with "${picked}"`);
    }
    const ptxt = points.join(" ");
    for (const o of opts) if (o !== picked && mentions(ptxt, o)) add(`${at}: cloze option "${o}" is a topic word of the lesson (it could complete another sentence)`);
    if (facts.strict) for (const pr of clozeProblems(q, opts, c.answer as number)) add(`${at}: ${pr}: "${q.slice(0, 60)}"`);
    return;
  }
  add(`${at}: choice "${q.slice(0, 50)}" matches no generator template — its answer key cannot be verified`);
}
