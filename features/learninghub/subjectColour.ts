// ONE place that decides what colour a subject wears in the Teaching Hub / My Classroom.
//
// Every chip, tile, card rail, cover and badge asks `subjectSwatch(subject)` (via kit.tsx's `subjectColor` / `subjectInk` / `SubjectChip`),
// so a tutor's choice (settings.hub.subjectColours, edited from the subject's ⋯ menu or Setup -> Teaching Hub) changes them ALL at once.
//
// How it stays live without re-rendering the world: a swatch is a CSS-variable reference with the default baked in as the fallback,
//   base = var(--sub-<slug>, #default)        (dots, rails, fills)
//   fg   = var(--sub-<slug>-ink, #defaultInk) (text on a wash of the colour — always >= 4.5:1 on the light theme)
// and `applySubjectColours()` (called by useHubData whenever the hub's config arrives) publishes only the tutor's OVERRIDES as
// `:root { --sub-<slug>: …; }` in one <style> tag. Change the map and the tag's text changes; every screen repaints.
// Neutral parts (the wash's white, the ring's grey) come from the theme's own variables.
//
// This file and the palette below are the only places a subject hex lives. Pure TS (no React) so it can be imported anywhere.

import { SUBJECT_PALETTE_KEYS, subjectColourKey } from "@/lib/hubConfig";

export type SubjectPaletteKey = (typeof SUBJECT_PALETTE_KEYS)[number];
export interface PaletteEntry { key: SubjectPaletteKey; label: string; /** fills, dots, rails */ base: string; /** text ink: >= 4.5:1 on a 13% wash of `base` over white */ ink: string }

/** The curated colour choices (order = the order the picker shows them). Keys MUST match SUBJECT_PALETTE_KEYS (lib/hubConfig.ts, validated server-side). */
export const SUBJECT_PALETTE: readonly PaletteEntry[] = [
  { key: "blue", label: "Blue", base: "#2563eb", ink: "#1e40af" },
  { key: "green", label: "Green", base: "#16a34a", ink: "#14532d" },
  { key: "red", label: "Red", base: "#dc2626", ink: "#991b1b" },
  { key: "purple", label: "Purple", base: "#7c3aed", ink: "#5b21b6" },
  { key: "orange", label: "Orange", base: "#ea580c", ink: "#9a3412" },
  { key: "teal", label: "Teal", base: "#0d9488", ink: "#115e59" },
  { key: "pink", label: "Pink", base: "#db2777", ink: "#9d174d" },
  { key: "amber", label: "Amber", base: "#d97706", ink: "#7c2d12" },
  { key: "indigo", label: "Indigo", base: "#4f46e5", ink: "#3730a3" },
  { key: "slate", label: "Slate", base: "#64748b", ink: "#334155" },
];
const BY_KEY = new Map<string, PaletteEntry>(SUBJECT_PALETTE.map((p) => [p.key, p]));
export const paletteEntry = (key: string): PaletteEntry => BY_KEY.get(key) ?? SUBJECT_PALETTE[0];

/** The standard subjects each start on their own colour (matched by name, so "Maths (KS2)" or "GCSE Maths" still count). */
const STANDARD: [RegExp, SubjectPaletteKey][] = [
  [/math|numeracy|arithmetic|algebra|geometry/i, "blue"],
  [/english|literacy|reading|writing|grammar|spelling|phonic/i, "red"],
  [/science|biolog|chemi|physic/i, "green"],
  [/french/i, "indigo"],
  [/spanish/i, "orange"],
  [/german/i, "amber"],
];
/** Colours a NEW subject can fall to (kept off the six standard ones so a fresh subject doesn't mimic Maths etc.). */
const FALLBACK: SubjectPaletteKey[] = ["teal", "pink", "purple", "slate"];
const hash = (s: string) => [...s].reduce((a, c) => (Math.imul(a, 31) + c.charCodeAt(0)) >>> 0, 7);

/** The colour a subject wears when its tutor hasn't chosen one: a standard subject's own, else a stable pick from the fallback set. */
export function defaultColourKey(subject: string): SubjectPaletteKey {
  const hit = STANDARD.find(([re]) => re.test(subject));
  return hit ? hit[1] : FALLBACK[hash(subjectColourKey(subject) || "?") % FALLBACK.length];
}

const slugOf = (subject: string) => {
  const k = subjectColourKey(subject) || "?";
  return `${k.replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 24) || "s"}-${hash(k).toString(36)}`;
};

export interface SubjectSwatch {
  /** The palette key currently in effect for this subject's DEFAULT (an override changes what the variables resolve to, not this). */
  key: SubjectPaletteKey;
  /** Solid accent: dots, rails, active borders, fills behind white text. */
  base: string;
  /** A soft wash of the accent over the card surface: chip / tile backgrounds. */
  bg: string;
  /** Text on `bg` (and on the plain surface): contrast >= 4.5:1. */
  fg: string;
  /** A hairline outline in the accent. */
  ring: string;
}

export function subjectSwatch(subject: string): SubjectSwatch {
  const key = defaultColourKey(subject);
  const d = paletteEntry(key);
  const slug = slugOf(subject);
  const base = `var(--sub-${slug}, ${d.base})`;
  return {
    key, base,
    bg: `color-mix(in srgb, ${base} 13%, var(--surface))`,
    fg: `var(--sub-${slug}-ink, ${d.ink})`,
    ring: `color-mix(in srgb, ${base} 40%, var(--surface))`,
  };
}

/** The ink for an accent that came from `subjectSwatch().base` (e.g. after it was passed through a prop called `color`). Undefined = not a subject accent. */
export function inkForBase(base: string): string | undefined {
  const m = /^var\((--sub-[a-z0-9-]+), (#[0-9a-f]{6})\)$/i.exec(base);
  if (!m) return undefined;
  const d = SUBJECT_PALETTE.find((p) => p.base.toLowerCase() === m[2].toLowerCase());
  return `var(${m[1]}-ink, ${d ? d.ink : m[2]})`;
}

/** The palette key a subject is showing right now (the tutor's choice, else its default) — for the picker's "selected" state. */
export const effectiveColourKey = (subject: string, chosen: Record<string, string> | undefined): SubjectPaletteKey => {
  const c = chosen?.[subjectColourKey(subject)];
  return (c && BY_KEY.has(c) ? c : defaultColourKey(subject)) as SubjectPaletteKey;
};

// ── publishing the tutor's choices ───────────────────────────────────────────
const STYLE_ID = "hub-subject-colours";
let applied = "";
let current: Record<string, string> = {};
/** The overrides currently published (what the last hub config said) — the picker builds the next whole map from it. */
export const appliedSubjectColours = (): Record<string, string> => ({ ...current });
/** Publish the tutor's overrides as CSS variables on :root. Call with the hub config's `subjectColours` ({} to clear). Idempotent. */
export function applySubjectColours(chosen: Record<string, string> | undefined | null) {
  if (typeof document === "undefined") return;
  current = { ...(chosen ?? {}) };
  const rules = Object.entries(chosen ?? {})
    .filter(([, k]) => BY_KEY.has(k))
    .map(([name, k]) => { const p = BY_KEY.get(k)!; const s = slugOf(name); return `--sub-${s}:${p.base};--sub-${s}-ink:${p.ink};`; })
    .sort()
    .join("");
  if (rules === applied) return;
  applied = rules;
  let el = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
  if (!el) { el = document.createElement("style"); el.id = STYLE_ID; document.head.appendChild(el); }
  el.textContent = rules ? `:root{${rules}}` : "";
}
