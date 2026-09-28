import { Fragment, type ReactNode } from "react";
import type { Lang } from "./AccentBar";

// Translation helpers for the language tools (namespace hubtoolsb, keys prefixed `lang_`). Drill CONTENT (verbs, nouns, sentences, English glosses) is never translated; only chrome.
/** Builds a full catalogue key from the part after `lang_` (kept out of literal form so key-usage scanners only see the static keys). */
export const lk = (s: string) => "hubtoolsb." + "lang_" + s;
export type T = (k: string, v?: Record<string, string | number>) => string;

/** Wrap drilled words in a left-to-right isolate so they keep their direction inside an RTL sentence (ar / ur). */
export const iso = (s: string) => `⁦${s}⁩`;
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");

/** "**bold** and ##bold + underlined##" -> React nodes. */
export function rich(s: string): ReactNode {
  return s.split(/(\*\*.*?\*\*|##.*?##)/).map((p, i) => p.startsWith("**") ? <b key={i} className="font-extrabold">{p.slice(2, -2)}</b>
    : p.startsWith("##") ? <b key={i} className="font-extrabold underline decoration-2 underline-offset-2">{p.slice(2, -2)}</b> : <Fragment key={i}>{p}</Fragment>);
}

export const langName = (t: T, l: Lang) => t(lk(`name_${l}`));
export const nounTheme = (t: T, th: string) => t(lk(`theme_${th}`));
export const verbTheme = (t: T, th: string) => { const k = lk(`vtheme_${slug(th)}`); const r = t(k); return r === k ? th : r; };
export const tenseLabel = (t: T, lang: Lang, id: string, fallback: string) => { const k = lk(`tense_${lang}_${id}`); const r = t(k); return r === k ? fallback : r; };
export const tableTitle = (t: T, title: string) => { const k = lk(`tt_${slug(title)}`); const r = t(k); return r === k ? title : r; };
export const columnLabel = (t: T, label: string) => { const k = lk(`col_${slug(label)}`); const r = t(k); return r === k ? label : r; };
export const genderWord = (t: T, g: "m" | "f" | "n") => t(lk(`gender_${g}`));
export const caseName = (t: T, c: string) => t(lk(`case_${c}`));
export const caseLc = (t: T, c: string) => t(lk(`caseLc_${c}`));
export const caseShort = (t: T, c: string) => t(lk(`caseS_${c}`));
export const deGender = (t: T, g: "m" | "f" | "n" | "pl") => t(lk(`deg_${g}`));
export const kindLabel = (t: T, k: "regular" | "stem" | "irregular") => t(lk(`kind_${k}`));

/** Accent-check notes come from engine/textmark.ts as English strings; map the known ones to keys. */
export function noteText(t: T, note?: string): string | undefined {
  if (!note) return undefined;
  const map: Record<string, string> = {
    "written without umlauts — fine on a keyboard, but learn the ä/ö/ü/ß spelling": "noUmlaut",
    "check your accents": "checkAccents",
    "the accent changes the word here — check it": "accentChangesWord",
    "accent missing or wrong — the meaning is right, but check it": "accentMissing",
  };
  if (map[note]) return t(lk(`note_${map[note]}`));
  const m = /^you wrote “([\s\S]*)”$/.exec(note);
  if (m) return t("hubtoolsb.lang_note_youWrote", { x: iso(m[1]!) });
  return note;
}
/** The note of the first check part (full text, incl. any "—" inside it). */
export const noteOf = (r: { log?: unknown }): string | undefined => (r.log as { parts?: { note?: string }[] } | undefined)?.parts?.[0]?.note;
