// Tour localisation (p8misc). The tour configs (tourSteps / tourConfigs / *.generated) are module-level English constants that double as the
// source of truth for step ids, `find` anchors and selectors, so they are NOT rewritten. Instead every user-facing string is looked up LAZILY at
// render through a deterministic catalogue key, and falls back to the authored English when the catalogue has no entry:
//   live tours   lt_<view>_title | _intro | _done | _s<i> (line) | _s<i>l (label) | _s<i>k (link label)
//   mock tours   gt_<view>_title | _intro | _done | _s<i> (line) | _s<i>l (label) | _s<i>g (stage) | _s<i>b<n> (nth text run of the mock body)
//   settings     sl_<view>_<j>l (label) | sl_<view>_<j>n (note)
// Pure (no React) so it can be used from effects and from the iframe bridge.
import { CATALOGS } from "@/lib/i18n/messages";
import { translateWord } from "@/lib/i18n/words";
import type { LocaleCode } from "@/lib/i18n/config";
import type { LiveTourSteps } from "./LiveTour";
import type { TourConfig } from "./GuidedTour";
import type { SettingsLink } from "./tourNarrator";

export type TFn = (key: string, vars?: Record<string, string | number>) => string;

export const tourSeg = (s: string): string => s.replace(/[^A-Za-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
export const tourKey = (id: string): string => `p8misc.${id}`;

/** Catalogue text for `id`, or the authored English when nothing is catalogued for it (yet). */
export function tourText(t: TFn, id: string, en: string): string {
  const k = tourKey(id);
  const v = t(k);
  return !v || v === k ? en : v;
}

export function localiseLive(view: string, cfg: LiveTourSteps, t: TFn, locale: string): LiveTourSteps {
  if (locale === "en") return cfg;
  const v = tourSeg(view), p = `lt_${v}_`;
  return {
    ...cfg,
    title: tourText(t, p + "title", cfg.title),
    introLine: tourText(t, p + "intro", cfg.introLine),
    doneLine: tourText(t, p + "done", cfg.doneLine),
    steps: cfg.steps.map((s, i) => ({
      ...s,
      line: tourText(t, `${p}s${i}`, s.line),
      ...(s.label ? { label: tourText(t, `${p}s${i}l`, s.label) } : {}),
      ...(s.link ? { link: { ...s.link, label: tourText(t, `${p}s${i}k`, s.link.label) } } : {}),
    })),
  };
}

export function localiseSettings(view: string, links: SettingsLink[] | undefined, t: TFn, locale: string): SettingsLink[] | undefined {
  if (!links || locale === "en") return links;
  const v = tourSeg(view);
  return links.map((l, j) => ({ ...l, label: tourText(t, `sl_${v}_${j}l`, l.label), ...(l.note ? { note: tourText(t, `sl_${v}_${j}n`, l.note) } : {}) }));
}

export function localiseGuided(view: string, cfg: TourConfig, t: TFn, locale: string): TourConfig {
  if (locale === "en") return cfg;
  const v = tourSeg(view), p = `gt_${v}_`;
  return {
    ...cfg,
    title: tourText(t, p + "title", cfg.title),
    introLine: tourText(t, p + "intro", cfg.introLine),
    doneLine: tourText(t, p + "done", cfg.doneLine),
    steps: cfg.steps.map((s, i) => ({
      ...s,
      line: tourText(t, `${p}s${i}`, s.line),
      label: tourText(t, `${p}s${i}l`, s.label),
      stage: tourText(t, `${p}s${i}g`, s.stage),
      bodyHtml: localiseBodyHtml(`${p}s${i}b`, s.bodyHtml, t),
    })),
    settings: localiseSettings(view, cfg.settings, t, locale),
  };
}

// ── Mock body HTML: translate the visible text runs, leave markup + sample data alone ──
const ENT: Record<string, string> = { "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'", "&rsquo;": "’", "&apos;": "'", "&nbsp;": " " };
const decode = (s: string) => s.replace(/&(amp|lt|gt|quot|#39|rsquo|apos|nbsp);/g, (m) => ENT[m] ?? m);
const encode = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const norm = (s: string) => decode(s).replace(/\s+/g, " ").trim().toLowerCase().replace(/[’‘]/g, "'");

/** The nth text run of a body, in document order (only runs with a letter in them count: numbers, prices and punctuation are sample data). */
export function bodyRuns(html: string): string[] {
  const out: string[] = [];
  html.replace(/>([^<>]+)</g, (_m, txt: string) => { if (/[A-Za-z]{2}/.test(txt)) out.push(txt.trim()); return _m; });
  return out;
}

export function localiseBodyHtml(idPrefix: string, html: string, t: TFn): string {
  let n = 0;
  return html.replace(/>([^<>]+)</g, (m, txt: string) => {
    if (!/[A-Za-z]{2}/.test(txt)) return m;
    const idx = n++;
    const raw = txt.trim();
    const hit = tourText(t, `${idPrefix}${idx}`, "");
    if (hit) return m.replace(raw, encode(hit));
    // Reuse the translation of an identical existing UI string ("New bookings", "Confirmed"…).
    const tr = reuse(raw, t);
    return tr ? m.replace(raw, encode(tr)) : m;
  });
}

// ── Reverse catalogue: English UI text → its translation in the active language ──
let REV: Map<string, string[]> | null = null;
function rev(): Map<string, string[]> {
  if (REV) return REV;
  REV = new Map();
  for (const [ns, dict] of Object.entries(CATALOGS.en as Record<string, Record<string, unknown>>)) {
    if (ns === "p8misc") continue;
    for (const [k, v] of Object.entries(dict)) {
      if (typeof v !== "string" || v.includes("{")) continue;
      const n = norm(v);
      if (n.length < 2 || n.length > 160) continue;
      const a = REV.get(n);
      if (!a) REV.set(n, [`${ns}.${k}`]); else if (a.length < 4) a.push(`${ns}.${k}`);
    }
  }
  return REV;
}

/** Translation of an English UI string that the real pages already localise, or "" when there is none. */
function reuse(raw: string, t: TFn): string {
  const up = raw === raw.toUpperCase() && /[A-Z]{3}/.test(raw);
  const hits = rev().get(norm(raw));
  if (hits) {
    for (const k of hits) { const v = t(k); if (v && v !== k) return up ? v.toUpperCase() : v; }
  }
  const w = translateWord(t as never, raw);
  if (w && w !== raw) return up ? w.toUpperCase() : w;
  return "";
}

/** Every rendering of an English anchor text worth trying on the (translated) real page: itself plus the translation of any catalogue string equal to / containing it. */
export function anchorVariants(en: string, t: TFn, locale: LocaleCode | string): string[] {
  const out = [en];
  if (!en.trim() || locale === "en") return out;
  const n = norm(en);
  const exact = rev().get(n);
  const push = (k: string) => { const v = t(k); if (v && v !== k && !out.includes(v)) out.push(v); };
  if (exact) exact.forEach(push);
  if (out.length === 1 && n.length >= 6) {
    let c = 0;
    for (const [s, keys] of rev()) { if (s.includes(n)) { keys.forEach(push); if (++c >= 6) break; } }
  }
  return out;
}

// ── Voice: the tour speaks in the active language when the device has a voice for it ──
const VOICE_LANG: Record<string, string> = { en: "en-GB", pl: "pl-PL", ro: "ro-RO", ur: "ur-PK", pa: "pa-IN", bn: "bn-BD", ar: "ar-SA", pt: "pt-PT", es: "es-ES", fr: "fr-FR", cy: "cy-GB" };
export const voiceLang = (locale: string): string => VOICE_LANG[locale] ?? "en-GB";

export function pickTourVoice(locale: string): SpeechSynthesisVoice | null {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return null;
  const vs = window.speechSynthesis.getVoices();
  if (!vs.length) return null;
  if (locale !== "en") {
    const base = locale.toLowerCase();
    const same = vs.filter((v) => v.lang.toLowerCase().replace("_", "-").split("-")[0] === base);
    return same.find((v) => /google/i.test(v.name) && /female|woman/i.test(v.name)) || same.find((v) => /female|woman/i.test(v.name)) || same.find((v) => /google/i.test(v.name)) || same[0] || null;
  }
  return vs.find((v) => v.name === "Google UK English Female")
    || vs.find((v) => /en-GB/i.test(v.lang) && /female|Sonia|Serena|Kate|Fiona|Libby|Hazel/i.test(v.name))
    || vs.find((v) => /en-GB/i.test(v.lang))
    || vs.find((v) => /^en/i.test(v.lang)) || vs[0];
}
