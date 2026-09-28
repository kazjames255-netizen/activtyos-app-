/** A short date ("12 Sept 2026") in the ACTIVE language (pass `locale` from useI18n()); falls back to en-GB if the locale is unknown to Intl. */
export function fmtDateLoc(iso: string, locale: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const o: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" };
  try { return d.toLocaleDateString(locale, o); } catch { return d.toLocaleDateString("en-GB", o); }
}
