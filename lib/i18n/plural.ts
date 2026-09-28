// Shared plural lookup for every catalogue helper (hub usePlural, hubT.tp, homeI18n.pluralOf).
// Intl.PluralRules gives the CLDR category for the locale (en/pt/es/fr: one|other, + many for fr/es/pt at 1,000,000+; pl: one|few|many|other;
// ro: one|few|other; ar: zero|one|two|few|many|other; cy: zero|one|two|few|many|other; pa/bn/ur: one|other). A catalogue only supplies the forms a language really
// needs, so a missing form falls back down a chain instead of straight to `_other`:  zero>other, one>other, two>few>other, few>many>other, many>other.
const CHAIN: Record<string, string[]> = {
  zero: ["zero", "other"],
  one: ["one", "other"],
  two: ["two", "few", "other"],
  few: ["few", "many", "other"],
  many: ["many", "other"],
  other: ["other"],
};

/** The category for `n` (safe for unknown locales) and the ordered suffixes to try. */
export function pluralChain(locale: string, n: number): string[] {
  let cat = "other";
  try { cat = new Intl.PluralRules(locale).select(n); } catch { /* unknown locale: other */ }
  return CHAIN[cat] ?? ["other"];
}

/** `<base>_<form>` for the first form the catalogue has (`t` returns the key itself when a key is missing); `{n}` is always filled in. */
export function pickPlural(t: (k: string, v?: Record<string, string | number>) => string, locale: string, base: string, n: number, vars?: Record<string, string | number>): string {
  const all = { n, ...vars };
  for (const f of pluralChain(locale, n)) {
    const k = `${base}_${f}`; const got = t(k, all);
    if (got !== k) return got;
  }
  return t(`${base}_other`, all);
}
