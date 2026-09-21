// Learning Hub — the two "arrange it" question kinds, `match` and `order`. PURE (no
// Firestore, no Express) so it is self-tested in server/src/hubSelfTest4.ts.
//
// Stored on a question (docs/oak-import.md):
//   match → `pairs: [{ term, definition, termImage?, definitionImage? }]`  (3–8 pairs)
//   order → `items: string[]`, stored in the CORRECT order                  (2–8 items)
// The key is implied by the data (pairing / sequence). It is NEVER sent to a student:
// a running attempt gets the pieces SHUFFLED (`presentMatch` / `presentOrder`), and the
// shuffle is a pure function of the attempt id + question id, so a refresh or resume
// shows the same arrangement.
//
// A student's answer comes back as
//   match → { kind: "match", pairs: [{ term, definition }] }
//   order → { kind: "order", items: string[] }
// and is marked by lib/hubScoring.ts (markMatch / markOrder).

import { createHash } from "node:crypto";
import { normText } from "./hubScoring";

export const MATCH_LIMITS = { min: 3, max: 8, textMax: 300 } as const;
export const ORDER_LIMITS = { min: 2, max: 8, textMax: 300 } as const;

export interface PairPic { url: string; alt: string }
export interface Pair { term: string; definition: string; termImage?: PairPic | null; definitionImage?: PairPic | null }

/** A picture of a pair: an https link + alt text (Oak images keep their Oak URL until replaced). */
export function cleanPairPic(v: unknown): PairPic | null | string {
  if (v === undefined || v === null) return null;
  const o = v as Record<string, unknown>;
  const url = typeof o.url === "string" ? o.url.trim() : "";
  const alt = typeof o.alt === "string" ? o.alt.trim().slice(0, 300) : "";
  if (!url || url.length > 1000 || !/^https:\/\//i.test(url)) return "A picture needs an https link";
  if (!alt) return "Describe every picture (alt text)";
  return { url, alt };
}

/** Body pairs → what is stored, or a message for a 400. */
export function cleanPairs(list: unknown): Pair[] | string {
  if (!Array.isArray(list) || list.length < MATCH_LIMITS.min) return `A matching question needs at least ${MATCH_LIMITS.min} pairs`;
  if (list.length > MATCH_LIMITS.max) return `A matching question can have at most ${MATCH_LIMITS.max} pairs`;
  const out: Pair[] = [];
  for (const raw of list) {
    const o = (raw ?? {}) as Record<string, unknown>;
    const term = typeof o.term === "string" ? o.term.trim() : "";
    const definition = typeof o.definition === "string" ? o.definition.trim() : "";
    if (!term || !definition) return "Every pair needs both a term and its match";
    if (term.length > MATCH_LIMITS.textMax || definition.length > MATCH_LIMITS.textMax) return `Keep each side under ${MATCH_LIMITS.textMax} characters`;
    const pair: Pair = { term, definition };
    for (const k of ["termImage", "definitionImage"] as const) {
      const p = cleanPairPic(o[k]);
      if (typeof p === "string") return p;
      if (p) pair[k] = p;
    }
    out.push(pair);
  }
  // Two pairs with the same term AND the same definition are one pair written twice.
  const seen = new Set<string>();
  for (const p of out) {
    const k = `${normText(p.term)}␟${normText(p.definition)}`;
    if (seen.has(k)) return `"${p.term}" is paired with "${p.definition}" twice`;
    seen.add(k);
  }
  return out;
}

/** Body items → what is stored (correct order), or a message for a 400. Repeats are allowed (a sequence may repeat a step's wording). */
export function cleanItems(list: unknown): string[] | string {
  if (!Array.isArray(list) || list.length < ORDER_LIMITS.min) return `An ordering question needs at least ${ORDER_LIMITS.min} items`;
  if (list.length > ORDER_LIMITS.max) return `An ordering question can have at most ${ORDER_LIMITS.max} items`;
  const out: string[] = [];
  for (const raw of list) {
    const t = typeof raw === "string" ? raw.trim() : "";
    if (!t) return "Every item needs some text";
    if (t.length > ORDER_LIMITS.textMax) return `Keep each item under ${ORDER_LIMITS.textMax} characters`;
    out.push(t);
  }
  return out;
}

// ── shuffling ────────────────────────────────────────────────────────────────

/** mulberry32 — a tiny seeded PRNG. */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const seedOf = (s: string) => createHash("sha256").update(s).digest().readUInt32BE(0);

/** Fisher–Yates with a seeded generator: same seed → same order, every time. */
export function seededShuffle<T>(list: readonly T[], seed: string): T[] {
  const a = [...list];
  const r = rng(seedOf(seed));
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Shuffle, but never hand a child the answer already in place: when the shuffle lands back on the
 *  key (by text) and there is anything to move, rotate by one. */
function scrambled(texts: string[], seed: string): number[] {
  const idx = seededShuffle(texts.map((_, i) => i), seed);
  const same = idx.every((v, i) => normText(texts[v]) === normText(texts[i]));
  if (same && new Set(texts.map(normText)).size > 1) return [...idx.slice(1), idx[0]];
  return idx;
}

/** The order presented to a student: the stored (correct) sequence, shuffled per attempt. */
export function presentOrder(items: readonly string[], seed: string): string[] {
  return scrambled([...items], `order:${seed}`).map((i) => items[i]);
}

export interface Piece { text: string; image?: PairPic }

/** What a student sees for a match question: the terms as written and the definitions shuffled. Nothing here says which goes with which. */
export function presentMatch(pairs: readonly Pair[], seed: string): { terms: Piece[]; definitions: Piece[] } {
  const defs = pairs.map((p) => p.definition);
  const idx = scrambled(defs, `match:${seed}`);
  const piece = (text: string, image?: PairPic | null): Piece => ({ text, ...(image ? { image: { url: image.url, alt: image.alt } } : {}) });
  return {
    terms: pairs.map((p) => piece(p.term, p.termImage)),
    definitions: idx.map((i) => piece(pairs[i].definition, pairs[i].definitionImage)),
  };
}

// ── responses ────────────────────────────────────────────────────────────────

const short = (v: unknown, n: number) => (typeof v === "string" ? v.slice(0, n) : null);

/** Keep only a plausible match / order response object; anything else is dropped (null). */
export function cleanKindResponse(r: unknown): unknown {
  if (!r || typeof r !== "object" || Array.isArray(r)) return undefined;
  const o = r as Record<string, unknown>;
  if (o.kind === "match" && Array.isArray(o.pairs)) {
    const pairs: { term: string; definition: string }[] = [];
    for (const p of o.pairs.slice(0, MATCH_LIMITS.max)) {
      const q = (p ?? {}) as Record<string, unknown>;
      const term = short(q.term, 1000), definition = short(q.definition, 1000);
      if (term !== null && definition !== null) pairs.push({ term, definition });
    }
    return { kind: "match", pairs };
  }
  if (o.kind === "order" && Array.isArray(o.items)) {
    return { kind: "order", items: o.items.slice(0, ORDER_LIMITS.max).map((x) => short(x, 1000)).filter((x): x is string => x !== null) };
  }
  return undefined;
}
