"use client";

import { useI18n, useT } from "@/lib/i18n/provider";
import { pickPlural } from "@/lib/i18n/plural";

/** Catalogue key for an English UI label: "Lessons & curriculum" -> "hubshell.lbl_lessons_curriculum". */
export const lblKey = (s: string) => `hubshell.lbl_${s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "")}`;

/** Translate a fixed English hub label (tab / sub-section name, panel `meta.label`) through the catalogue; falls back to the English text
 *  when no `lbl_` key exists (so user-entered names pass through untouched). Lets panel modules keep plain-string `meta`. */
export function useLbl() {
  const t = useT();
  return (s: string): string => { const k = lblKey(s); const v = t(k); return v === k ? s : v; };
}

/** Plural-aware lookup: `tp("hubshell.students", 3)` reads `students_<one|two|few|many|zero|other>` for the active locale
 *  (Intl.PluralRules), falling back down the chain many>other, few>many>other, two>few>other (lib/i18n/plural.ts); `{n}` is filled in. Supply every category the language needs. */
export function usePlural() {
  const { t, locale } = useI18n();
  return (base: string, n: number, vars?: Record<string, string | number>): string => {
    return pickPlural(t, locale, base, n, vars);
  };
}
