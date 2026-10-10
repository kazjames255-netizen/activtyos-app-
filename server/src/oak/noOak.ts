// OWNER RULE: the publisher's name / licence credit must never reach a user, in any UI or in any stored content.
// This module is the single source of truth for (a) detecting it, (b) scrubbing it from text, (c) a validator the importers call.
//   scrubText(s)      -> text with every brand sentence / link removed ("" when nothing is left)
//   scrubDeep(v)      -> deep-scrub a Firestore doc value (skips internal identifiers), returns {value, changed, dropped}
//   findOakDeep(v)    -> every user-visible string that still mentions it (validator)
//   assertNoOak(v,label) -> throws (fails the import) when findOakDeep is non-empty
// A lone botanical "oak" (an oak tree, oak leaves…) is legitimate lesson vocabulary and is NOT brand: only the names/links/credit are.

/** The brand: name forms, possessive, credit line, licence credit, and links to the publisher's domains. */
export const BRAND_RE = /\boak\s+national\b|\boak\s+academy\b|oaknational|thenational\.academy|\boak['’]s\b|\boak\s+(?:lessons?|pupils?|teachers?|resources?|classroom|team|curriculum|decks?|slides?|worksheets?|quizzes|quiz|videos?|content|platform|website|national)\b|\bhow to use oak\b|open government licen[cs]e|\bOGL\b/i;
/** A bare "oak" word that is plainly the tree/wood, not the brand. */
const TREES = "holly|ash|beech|elm|birch|pine|willow|maple|sycamore|hazel|hawthorn|chestnut|conifer|poplar|lime|yew|rowan|larch|fir|cedar|spruce|leaves|leaf|lobed|spiky|acorns?|trees?|woodland|forest|bark|canopy";
const BOTANICAL_RE = new RegExp(`\\b(?:${TREES})\\b.{0,60}\\boaks?\\b|\\boaks?\\b.{0,60}\\b(?:${TREES})\\b`, "i");
const BOTANICAL_OLD = /\b(?:an?|the|of|from|old|english|red|white|holm|cork|sessile|pedunculate|turkey|mighty|great|tall|big|young|strong|solid|carved|wooden)\s+oaks?\b|\boaks?\s+(?:tree|trees|leaf|leaves|wood|woods|woodland|forest|table|door|barrel|beam|beams|apple|apples|gall|galls|acorn|acorns|saplings?|seedlings?|furniture|floor|chest|panel|panels|timber)\b|\bacorns?\b.*\boak|\boak\b.*\bacorn/i;
const ANY_OAK = /\boak\b/i;

/** True when the text mentions the brand (or a bare "oak" that isn't clearly the tree). */
export function mentionsOak(s: string): boolean {
  if (!ANY_OAK.test(s) && !BRAND_RE.test(s)) return false;
  if (BRAND_RE.test(s)) return true;
  return !(BOTANICAL_RE.test(s) || BOTANICAL_OLD.test(s));
}

/** Strings that are identifiers / URLs / storage paths rather than prose: not user-visible copy, left alone (counted separately). */
export const isInternalString = (s: string) => !/\s/.test(s) && /[-_/.:]/.test(s) && /^[\w\-./:%?=&#~+@]{4,}$/.test(s) && s.toLowerCase() !== "oak";
/** Object keys whose values are internal (ids, provenance, storage). */
const SKIP_KEYS = new Set(["id", "tenantId", "source", "provider", "url", "oakDeck", "file", "fileId", "path", "storagePath", "sig", "hash", "createdBy", "topicId", "quizId", "noteId", "imported", "licence"]);

const SENT_SPLIT = /(?<=[.!?…])(\s+)|(\n+)/;
function scrubOnce(s: string): string {
  let t = s
    .replace(/\[([^\]]*)\]\((?:https?:\/\/)?[^)\s]*(?:thenational\.academy|oaknational)[^)\s]*\)/gi, "$1")
    .replace(/https?:\/\/\S*(?:thenational\.academy|oaknational)\S*/gi, "");
  if (!mentionsOak(t)) return t;
  const parts = t.split(SENT_SPLIT).filter((x) => x !== undefined);
  const out: string[] = [];
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i]!;
    if (/^\s+$|^\n+$/.test(p)) { out.push(p); continue; }
    if (mentionsOak(p)) { const prev = out[out.length - 1]; if (prev !== undefined && /^\s+$|^\n+$/.test(prev)) out.pop(); continue; }
    out.push(p);
  }
  t = out.join("").trim();
  if (mentionsOak(t)) t = ""; // a fragment we couldn't split (e.g. one canvas text run): drop it
  return t;
}
export const scrubText = (s: string): string => scrubOnce(s);

const slideText = (v: unknown): string => {
  const out: string[] = [];
  const walk = (x: unknown) => { if (typeof x === "string") out.push(x); else if (Array.isArray(x)) x.forEach(walk); else if (x && typeof x === "object") for (const [k, y] of Object.entries(x)) if (!SKIP_KEYS.has(k)) walk(y); };
  walk(v);
  return out.filter((s) => !isInternalString(s)).join(" ").replace(/\s+/g, " ").trim();
};
/** Guidance / credit / how-to-use slides that only exist to talk about the publisher: dropped whole. */
const GUIDANCE_TITLE = /^\s*(?:this lesson includes additional materials|teacher guidance|to help you teach this lesson)/i;
const isBrandSlide = (slide: unknown): boolean => { if (slide && typeof slide === "object" && typeof (slide as { title?: unknown }).title === "string" && GUIDANCE_TITLE.test((slide as { title: string }).title)) return true; const t = slideText(slide); return !!t && mentionsOak(t) && (t.length < 600 || /teacher guidance|to help you teach this lesson|structured around|lesson structure|how to use|licen[cs]e|©/i.test(t)); };
const SLIDE_KEYS = new Set(["deckSlides", "slides"]);

export interface ScrubResult { value: unknown; changed: boolean; strings: number; slidesDropped: number }
export function scrubDeep(v: unknown, rootKey?: string): ScrubResult {
  const r: ScrubResult = { value: v, changed: false, strings: 0, slidesDropped: 0 };
  const walk = (x: unknown, key?: string): unknown => {
    if (typeof x === "string") {
      if (isInternalString(x) || !mentionsOak(x) && !/thenational\.academy|oaknational/i.test(x)) return x;
      const y = scrubText(x); if (y !== x) { r.changed = true; r.strings++; } return y;
    }
    if (Array.isArray(x)) {
      let arr = x;
      if (key && SLIDE_KEYS.has(key) && x.some((e) => e && typeof e === "object")) {
        const kept = x.filter((s) => !isBrandSlide(s));
        if (kept.length !== x.length) { r.changed = true; r.slidesDropped += x.length - kept.length; arr = kept; }
      }
      const mapped = arr.map((e) => walk(e, key));
      // string lists (keywords, points…): drop entries that scrubbed to nothing
      const wasStr = arr.filter((e) => typeof e === "string");
      return wasStr.length && wasStr.length === arr.length ? mapped.filter((e, i) => !(e === "" && arr[i] !== "")) : mapped;
    }
    if (x && typeof x === "object") {
      const o: Record<string, unknown> = {};
      for (const [k, y] of Object.entries(x)) o[k] = SKIP_KEYS.has(k) ? y : walk(y, k);
      return o;
    }
    return x;
  };
  r.value = walk(v, rootKey);
  return r;
}

export interface OakHit { path: string; sample: string }
export function findOakDeep(v: unknown, limit = 20): OakHit[] {
  const hits: OakHit[] = [];
  const walk = (x: unknown, p: string) => {
    if (hits.length >= limit) return;
    if (typeof x === "string") { if (!isInternalString(x) && mentionsOak(x)) hits.push({ path: p, sample: x.slice(0, 120) }); else if (/thenational\.academy|oaknational/i.test(x) && !isInternalString(x)) hits.push({ path: p, sample: x.slice(0, 120) }); return; }
    if (Array.isArray(x)) { x.forEach((e, i) => walk(e, `${p}[${i}]`)); return; }
    if (x && typeof x === "object") for (const [k, y] of Object.entries(x)) if (!SKIP_KEYS.has(k)) walk(y, p ? `${p}.${k}` : k);
  };
  walk(v, "");
  return hits;
}
/** Importer validator: throws when any user-visible field still mentions the publisher. */
export function assertNoOak(v: unknown, label: string): void {
  const h = findOakDeep(v, 5);
  if (h.length) throw new Error(`[no-oak] ${label}: user-visible text mentions the publisher — ${h.map((x) => `${x.path}: "${x.sample}"`).join(" | ")}`);
}
/** Final sanitiser for importers: scrub, then validate. Returns the clean value. */
export function sanitiseForImport<T>(v: T, label: string): T {
  const r = scrubDeep(v);
  assertNoOak(r.value, label);
  return r.value as T;
}

// ── render-time scrub of a whole value (API responses, the i18n bundles, bell / email texts) ──────────────────────────────────────────
const QUICK = /oak|thenational\.academy|\bOGL\b|government licen/i;

/** JSON-ish value: deep scrub (drops brand slides, brand sentences, brand links). Returns the same object when clean. */
export function scrubPayload<T>(v: T): T {
  let s: string;
  try { s = JSON.stringify(v); } catch { return v; }
  if (!s || !QUICK.test(s)) return v;
  return dropAttribution(scrubDeep(v).value) as T;
}

/** `source.attribution` / `source.licence` are provenance (skipped by scrubDeep as internal), but they hold the credit line
 *  verbatim, so they never leave the API either. */
function dropAttribution(x: unknown): unknown {
  if (Array.isArray(x)) return x.map(dropAttribution);
  if (x && typeof x === "object") {
    const o: Record<string, unknown> = {};
    for (const [k, y] of Object.entries(x)) {
      if ((k === "attribution" || k === "licence") && typeof y === "string" && (BRAND_RE.test(y) || /OGL/.test(y))) continue;
      o[k] = dropAttribution(y);
    }
    return o;
  }
  return x;
}
