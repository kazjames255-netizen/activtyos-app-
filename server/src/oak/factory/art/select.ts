// Picture POLICY engine: choose (and verify) the pictures of a slide. Pure functions, no I/O.
//
//   A slide gets a picture ONLY when a verified match exists; otherwise NO picture (a missing picture is fine, a wrong or contradicting one
//   is a severe bug). Matching is on the slide's KEY CONCEPT: whole words / whole phrases from the concept lists in library.ts / allowlist.ts,
//   never substrings or fuzzy guesses. A picture must (1) name a concept that is prominent in THIS slide (title / lead / key-word term / repeated),
//   (2) satisfy its own gates (subject, `requires`, `avoid`, `numeric`), (3) not be contradicted by another member of its family named in the slide
//   text, (4) never appear on a slide that asks a question (practice / check / any interactive block: it could give the answer away).
import type { Block, Slide } from "../../../../../features/learninghub/lesson/slides/types";
import type { ArtContext, EmojiEntry, Pic, Subject } from "./types";
import { PICS, PIC_BY_ID } from "./library";
import { EMOJI, EMOJI_AVOID } from "./allowlist";

export const MAX_ART = 2;
/** minimum prominence score: a title / key-word term hit (3) or a lead (2) plus one more, or three plain mentions */
export const MIN_SCORE = 3;
/** prominence: named in the title / a key-word term / the lead, OR (named in the lesson title AND at least twice on the slide) */
export const prominent = (h: Hit, inLessonTitle: boolean) => h.score + (inLessonTitle ? 2 : 0) >= MIN_SCORE && (h.strong || (inLessonTitle && h.count >= 2));
const INTERACTIVE = new Set(["choice", "choices", "sort", "match", "reveal", "spell", "lcwc", "clap"]);

// ── text normalisation ──────────────────────────────────────────────────────
/** lower-case, markup and quoted titles removed, apostrophes dropped, every other non-letter/digit becomes a single space */
export function norm(s: string): string {
  return s
    .replace(/\{|\}|\*\*/g, "")
    .replace(/[“][^”]{0,80}[”]|"[^"]{0,80}"|[‘][^’]{2,80}[’]|(?<=^|[\s(])'[^']{2,60}'(?=[\s.,;:!?)]|$)/g, " ")
    .toLowerCase()
    .replace(/['’‘ʼ`]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const cache = new Map<string, RegExp>();
/** whole-word / whole-phrase regex for a concept (the plural of its last word also matches) */
function phraseRe(phrase: string, prefix = false): RegExp {
  const key = `${prefix ? "p" : "w"}|${phrase}`;
  let re = cache.get(key);
  if (!re) {
    const words = norm(phrase).split(" ").filter(Boolean);
    const last = words[words.length - 1] ?? "";
    const body = words.map(esc).join("\\s+") + (!prefix && last.length >= 3 && !/\d$/.test(last) ? "(?:s|es)?" : "");
    re = new RegExp(`(?<![\\p{L}\\p{N}])${body}${prefix ? "" : "(?![\\p{L}\\p{N}])"}`, "giu");
    cache.set(key, re);
  }
  re.lastIndex = 0;
  return re;
}
const has = (text: string, phrase: string, prefix = false) => phraseRe(phrase, prefix).test(text);

// ── slide text ──────────────────────────────────────────────────────────────
export interface Seg { text: string; w: number; title?: boolean }
const chipText = (c: unknown) => (typeof c === "string" ? c : (c as { text?: string })?.text ?? "");
/** The visible teaching text of a slide as weighted segments, or null when the slide is interactive (asks a question: no pictures). */
export function slideSegments(s: Pick<Slide, "kind" | "title" | "blocks">): Seg[] | null {
  if (s.kind === "practice" || s.kind === "check") return null;
  const out: Seg[] = [];
  if (s.title) out.push({ text: s.title, w: 3, title: true });
  for (const b of s.blocks as Block[]) {
    const t = (b as { t: string }).t;
    if (INTERACTIVE.has(t)) return null;
    switch (b.t) {
      case "lead": out.push({ text: b.text, w: 2 }); break;
      case "text": case "callout": out.push({ text: b.text, w: 1 }); break;
      case "list": for (const x of b.items) out.push({ text: x, w: 1 }); break;
      case "chips": for (const x of b.items) out.push({ text: chipText(x), w: 1 }); break;
      case "cards": for (const x of b.items) out.push({ text: `${x.title} ${x.sub ?? ""}`, w: 1 }); break;
      case "define": for (const x of b.items) { out.push({ text: x.term, w: 3 }); out.push({ text: x.def, w: 1 }); } break;
      case "formula": for (const r of b.rows) out.push({ text: `${r.root} ${r.add} ${r.result} ${r.note ?? ""}`, w: 1 }); break;
      case "roots": for (const r of b.items) out.push({ text: `${r.word} ${r.root}`, w: 1 }); break;
      default: break;
    }
  }
  return out.map((x) => ({ ...x, text: norm(x.text) })).filter((x) => x.text);
}

// ── concept scanning ────────────────────────────────────────────────────────
export interface Hit { score: number; count: number; title: boolean; /** matched in the title, a key-word term or the lead (w >= 2) */ strong: boolean }
interface Key { key: string; phrase: string }
const sortCache = new WeakMap<Key[], { key: string; phrase: string; first: string }[]>();
function sortedKeys(keys: Key[]) {
  let r = sortCache.get(keys);
  if (!r) { r = keys.map((k) => ({ ...k, first: norm(k.phrase).split(" ")[0] ?? "" })).sort((a, b) => norm(b.phrase).length - norm(a.phrase).length); sortCache.set(keys, r); }
  return r;
}
/** Scan segments for every concept phrase, LONGEST phrases first; each matched span is consumed so a shorter concept inside a longer one
 *  (e.g. "triangle" in "right angled triangle", "square" in "square based pyramid") never counts twice. */
export function scan(segs: Seg[], keys: Key[]): Map<string, Hit> {
  const sorted = sortedKeys(keys);
  const hits = new Map<string, Hit>();
  for (const seg of segs) {
    let work = seg.text;
    for (const k of sorted) {
      if (!work.includes(k.first)) continue; // cheap pre-filter: the phrase's first word must occur at all
      const re = phraseRe(k.phrase);
      let m: RegExpExecArray | null;
      while ((m = re.exec(work))) {
        const h = hits.get(k.key) ?? { score: 0, count: 0, title: false, strong: false };
        h.score += seg.w; h.count++; if (seg.title) h.title = true; if (seg.w >= 2) h.strong = true; hits.set(k.key, h);
        work = work.slice(0, m.index) + "\u2022".repeat(m[0].length) + work.slice(m.index + m[0].length); // a non-space filler: a phrase must never match ACROSS a consumed span ("counting [forwards and backwards] in multiples" is not "counting in multiples")
        re.lastIndex = 0;
      }
    }
  }
  return hits;
}

const KEYS_PIC: Key[] = PICS.flatMap((p) => p.concepts.map((c) => ({ key: p.id, phrase: c })));
/** Concept keys of the pictures allowed in ONE subject. Scanning must be subject-aware: the same phrase ("negation", "days of the week", "comparative", "reflection") can belong to
 *  pictures of several subjects/languages, and a subject-blind scan lets the first picture in the list consume the phrase so the right one never gets a hit. (X5) */
const picKeysCache = new Map<string, Key[]>();
// (X2: also key-stage aware: a picture scoped to other key stages must not even CONSUME a phrase, else its longer phrase ("volume of a cone", KS4) would swallow the word a KS2 picture ("cone") needs)
const picKeys = (subject: string, keyStage?: string): Key[] => { const ck = `${subject}|${keyStage ?? ""}`; let k = picKeysCache.get(ck); if (!k) { k = PICS.filter((p) => (p.subjects as string[]).includes(subject) && (!p.keyStages?.length || (!!keyStage && p.keyStages.includes(keyStage)))).flatMap((p) => p.concepts.map((c) => ({ key: p.id, phrase: c }))); picKeysCache.set(ck, k); } return k; };
const isLang = (s: string): s is "French" | "Spanish" | "German" => s === "French" || s === "Spanish" || s === "German";
const LANG_FIELD: Record<string, "fr" | "es" | "de"> = { French: "fr", Spanish: "es", German: "de" };
const emojiWords = (e: EmojiEntry, subject: string): string[] => [...e.words, ...(isLang(subject) ? e[LANG_FIELD[subject]] ?? [] : [])];
const KEYS_EMOJI = (subject: string): Key[] => EMOJI.filter((e) => (e.subjects as string[]).includes(subject)).flatMap((e) => emojiWords(e, subject).map((w) => ({ key: `e:${e.emoji}`, phrase: w })));
const emojiCache = new Map<string, Key[]>();
const emojiKeys = (subject: string) => { let k = emojiCache.get(subject); if (!k) { k = KEYS_EMOJI(subject); emojiCache.set(subject, k); } return k; };

/** Gate checks shared by the chooser and the verifier. Returns the reason a picture is NOT allowed on this text, or null. */
export function picVeto(p: Pic, text: string, ctx: ArtContext): string | null {
  if (!(p.subjects as string[]).includes(ctx.subject)) return `subject ${ctx.subject} not in ${p.subjects.join("/")}`;
  if (p.keyStages?.length && !(ctx.keyStage && p.keyStages.includes(ctx.keyStage))) return `key stage ${ctx.keyStage || "?"} not in ${p.keyStages.join("/")}`;
  if (p.requires?.length && !p.requires.some((r) => has(text, r))) return `needs one of: ${p.requires.slice(0, 4).join(", ")}`;
  const av = p.avoid?.find((a) => (a.startsWith("=") ? has(text, a.slice(1)) : has(text, a, true))); // "=word" = whole word only, otherwise word-start prefix
  if (av) return `slide mentions "${av}"`;
  if (p.numeric && /\d/.test(text)) return "picture shows specific numbers but the slide has numbers";
  return null;
}
/** pictures scoped to other key stages (Pic.keyStages) are simply not in play: they neither get chosen nor count as a named family member */
function dropOutOfScope(hits: Map<string, Hit>, ctx: ArtContext): void {
  for (const id of [...hits.keys()]) { const p = PIC_BY_ID[id]; if (p?.keyStages?.length && !(ctx.keyStage && p.keyStages.includes(ctx.keyStage))) hits.delete(id); }
}
const covered = (c: Pic, other: Pic) => !!c.covers?.some((x) => other.concepts.includes(x));
/** family members named in the slide that this picture does NOT show */
function foreignMentions(c: Pic, hits: Map<string, Hit>): string[] {
  if (!c.family) return [];
  return [...hits.keys()].filter((id) => { const o = PIC_BY_ID[id]; return o && id !== c.id && o.family === c.family && !covered(c, o); });
}

export interface Chosen { pics: string[]; emoji: string[]; notes: string[] }
/** Choose the (at most MAX_ART) verified pictures for one slide. */
export function chooseArt(slide: Pick<Slide, "kind" | "title" | "blocks">, ctx: ArtContext): Chosen {
  const none: Chosen = { pics: [], emoji: [], notes: [] };
  const segs = slideSegments(slide);
  if (!segs?.length) return none;
  const text = segs.map((s) => s.text).join(" . ");
  const hits = scan(segs, picKeys(ctx.subject, ctx.keyStage));
  dropOutOfScope(hits, ctx);
  const lt = ctx.lessonTitle ? norm(ctx.lessonTitle) : "";
  const lessonHits = lt ? scan([{ text: lt, w: 0 }], picKeys(ctx.subject, ctx.keyStage)) : new Map<string, Hit>();
  const notes: string[] = [];
  const vetoText = ctx.lessonTitle ? `${text} . ${lt} . ${norm(ctx.unitTitle ?? "")}` : text; // (same condition as verifyArt: a lesson title that is only a quoted book title normalises to "" but the unit title must still veto) // the lesson / unit title can veto too (e.g. a "sound" lesson never gets a transverse wave)
  let cands = [...hits.entries()].map(([id, h]) => ({ p: PIC_BY_ID[id], score: h.score + (lessonHits.has(id) ? 2 : 0), h, inLt: lessonHits.has(id) })).filter((c) => c.p);
  cands = cands.filter((c) => { const v = picVeto(c.p, vetoText, ctx); if (v) notes.push(`${c.p.id}: ${v}`); else if (!prominent(c.h, c.inLt)) notes.push(`${c.p.id}: not prominent enough`); return !v && prominent(c.h, c.inLt); });
  cands.sort((a, b) => b.score - a.score || Number(b.h.title) - Number(a.h.title));
  // Best set of at most MAX_ART pictures in which every picture's family members named in the slide are ALSO shown. A named family member that is
  // not prominent by itself (e.g. the cylinder in "a cone is a third of a cylinder") may join as a companion, so both are drawn or neither.
  const prom = cands.slice(0, 6);
  const avail = new Map<string, { p: Pic; score: number; h: Hit; inLt: boolean }>();
  for (const [id, h] of hits) { const p = PIC_BY_ID[id]; if (p && !picVeto(p, vetoText, ctx)) avail.set(id, { p, score: h.score, h, inLt: lessonHits.has(id) }); }
  type C = (typeof cands)[number];
  const okSubset = (sub: C[]) => sub.every((c) => foreignMentions(c.p, hits).every((id) => sub.some((x) => x.p.id === id)));
  const subsets: C[][] = [];
  for (const c of prom) {
    subsets.push([c]);
    const fm = foreignMentions(c.p, hits).map((id) => avail.get(id)).filter((x): x is C => !!x);
    if (fm.length && fm.length + 1 <= MAX_ART) subsets.push([c, ...fm]);
  }
  for (let i = 0; i < prom.length; i++) for (let j = i + 1; j < prom.length; j++) subsets.push([prom[i], prom[j]]);
  let chosen: C[] = [];
  let best = -1;
  for (const sub of subsets) { const sc = sub.reduce((a, c) => a + (prom.includes(c) ? c.score : 0.1), 0); if (okSubset(sub) && sc > best) { best = sc; chosen = sub; } }
  if (!chosen.length && prom.length) notes.push(`all candidates conflict with other family members named in the slide (${prom.map((c) => c.p.id).join(", ")})`);
  const pics = chosen.map((c) => c.p.id);
  const emoji: string[] = [];
  if (pics.length < MAX_ART) {
    const eh = scan(segs, emojiKeys(ctx.subject));
    const elt = lt ? scan([{ text: lt, w: 0 }], emojiKeys(ctx.subject)) : new Map<string, Hit>();
    const ec = [...eh.entries()].map(([k, h]) => ({ e: EMOJI.find((x) => `e:${x.emoji}` === k)!, score: h.score, ok: prominent(h, elt.has(k)) && h.count >= 2 })).filter((c) => c.e && c.ok && !EMOJI_AVOID.some((a) => has(vetoText, a)));
    ec.sort((a, b) => b.score - a.score);
    for (const c of ec) { if (pics.length + emoji.length >= MAX_ART) break; emoji.push(c.e.emoji); }
  }
  return { pics, emoji, notes };
}

/** The literal emoji for one card title (a single, whole-word allow-list match) or undefined. */
export function cardEmoji(title: string, subject: string): string | undefined {
  const text = norm(title);
  if (!text || EMOJI_AVOID.some((a) => has(text, a))) return undefined;
  const found = scan([{ text, w: 1 }], emojiKeys(subject));
  return found.size === 1 ? [...found.keys()][0].slice(2) : undefined;
}

/** Apply the picture policy to a whole deck: replaces every slide's art (pictures + emoji) and drops every card / chip emoji that is not a
 *  verified literal depiction of its own title. Authors' original art is ignored, never trusted. */
export function applyArtPolicy(deck: Slide[], ctx: ArtContext): Slide[] {
  return deck.map((s) => {
    // A tutor removed / replaced / added the picture in the lesson preview: their choice stands, never re-picked.
    if (s.artLock) return s;
    const { art: _old, pics: _oldPics, ...rest } = s as Slide & { pics?: unknown };
    void _old; void _oldPics;
    const blocks = s.blocks.map((b): Block => {
      if (b.t === "cards") return { ...b, items: b.items.map((it) => { const { emoji: _e, ...r } = it; void _e; const em = cardEmoji(it.title, ctx.subject); return em ? { ...r, emoji: em } : r; }) };
      if (b.t === "chips") return { ...b, items: b.items.map((c) => (typeof c === "string" ? c : { text: c.text })) };
      return b;
    });
    const a = chooseArt({ ...rest, blocks }, ctx);
    return { ...rest, blocks, ...(a.emoji.length ? { art: a.emoji } : {}), ...(a.pics.length ? { pics: a.pics.map((id) => ({ id })) } : {}) } as Slide;
  });
}

/** Independent check of a finished deck: every picture must be verified for its slide. Returns problems. */
export function verifyArt(deck: Slide[], ctx: ArtContext): string[] {
  const bad: string[] = [];
  deck.forEach((s, i) => {
    const at = `slide ${i + 1} "${s.title}"`;
    const pics = (s as Slide & { pics?: { id: string }[] }).pics ?? [];
    const segs = slideSegments(s);
    const cardEm = (s.blocks as Block[]).flatMap((b) => (b.t === "cards" ? b.items.filter((x) => x.emoji).map((x) => ({ em: x.emoji as string, title: x.title })) : []));
    if (!pics.length && !s.art?.length && !cardEm.length) return;
    if ((pics.length || s.art?.length) && !segs) { bad.push(`${at}: picture on a slide that asks a question (${s.kind})`); return; }
    const text = (segs ?? []).map((x) => x.text).join(" . ");
    if (pics.length + (s.art?.length ?? 0) > MAX_ART) bad.push(`${at}: more than ${MAX_ART} pictures`);
    const hits = segs ? scan(segs, picKeys(ctx.subject, ctx.keyStage)) : new Map<string, Hit>();
    dropOutOfScope(hits, ctx);
    const shown = new Set(pics.map((p) => p.id));
    let anyProminent = false;
    for (const { id } of pics) {
      const p = PIC_BY_ID[id];
      if (!p) { bad.push(`${at}: unknown picture "${id}"`); continue; }
      const v = picVeto(p, ctx.lessonTitle ? `${text} . ${norm(ctx.lessonTitle)} . ${norm(ctx.unitTitle ?? "")}` : text, ctx);
      if (v) bad.push(`${at}: picture ${id} vetoed: ${v}`);
      if (!p.concepts.some((c) => has(text, c))) bad.push(`${at}: picture ${id} has no concept tag in the slide text (${p.concepts.slice(0, 3).join(", ")})`);
      const h = hits.get(id);
      const ltHit = ctx.lessonTitle ? scan([{ text: norm(ctx.lessonTitle), w: 0 }], p.concepts.map((c) => ({ key: id, phrase: c }))).has(id) : false;
      if (h && prominent(h, ltHit)) anyProminent = true;
      if (!h) bad.push(`${at}: picture ${id} is not named in the slide`);
      const fm = foreignMentions(p, hits).filter((x) => !shown.has(x));
      if (fm.length) bad.push(`${at}: text names ${fm.join(", ")} but the picture is ${id} (contradiction)`);
    }
    if (pics.length && !anyProminent) bad.push(`${at}: no picture is prominent in the slide (its concept must be in the title / key-word term / lead, or twice plus the lesson title)`);
    for (const e of s.art ?? []) {
      const en = EMOJI.find((x) => x.emoji === e);
      if (!en) { bad.push(`${at}: emoji ${e} is not on the allow-list`); continue; }
      if (!(en.subjects as string[]).includes(ctx.subject)) bad.push(`${at}: emoji ${e} not allowed for ${ctx.subject}`);
      if (!emojiWords(en, ctx.subject).some((w) => has(text, w))) bad.push(`${at}: emoji ${e} (${en.name}) has no allow-listed word in the slide text`);
      else if ((scan(segs ?? [], emojiKeys(ctx.subject)).get(`e:${e}`)?.count ?? 0) < 2) bad.push(`${at}: emoji ${e} (${en.name}) is named only once on the slide (not prominent)`);
      if (EMOJI_AVOID.some((a) => has(text, a))) bad.push(`${at}: emoji ${e} vetoed by context`);
    }
    for (const c of cardEm) {
      const en = EMOJI.find((x) => x.emoji === c.em);
      if (!en) { bad.push(`${at}: card emoji ${c.em} is not on the allow-list`); continue; }
      if (!emojiWords(en, ctx.subject).some((w) => has(norm(c.title), w))) bad.push(`${at}: card "${c.title}" emoji ${c.em} (${en.name}) does not depict its title`);
    }
  });
  return bad;
}
export type { Subject };
