// Row-format catalogue helper (i18n sweep P7): one line per key, columns in LOCALE_ORDER, so a key can never be
// missing from one locale. `fromRows` returns the { en, pl, ... } shape the area registry expects.
export const LOCALE_ORDER = ["en", "pl", "ro", "ur", "pa", "bn", "ar", "pt", "es", "fr", "cy"] as const;
export type RowLocale = (typeof LOCALE_ORDER)[number];

export function fromRows(rows: Record<string, readonly string[]>): Record<RowLocale, Record<string, string>> {
  const out = {} as Record<RowLocale, Record<string, string>>;
  for (const l of LOCALE_ORDER) out[l] = {};
  for (const [key, cols] of Object.entries(rows)) {
    if (cols.length !== LOCALE_ORDER.length) throw new Error(`i18n row "${key}" has ${cols.length} columns, expected ${LOCALE_ORDER.length}`);
    LOCALE_ORDER.forEach((l, i) => { out[l][key] = cols[i]; });
  }
  return out;
}
