// The BCP-47 tag for date / time / number formatting in the ACTIVE app language.
//
// Hard-coded `toLocaleDateString("en-GB", …)` calls never followed the language picker, so an Arabic / Polish / Welsh user saw
// "Mon 12 Oct" in an otherwise translated page. Use `dateLocale()` instead of a literal tag (LanguageProvider keeps it in step
// with the picker). English stays UK-style (plain "en" would print US-style "Sep 12"). Arabic, Urdu, Bengali and Panjabi use
// Western digits (-u-nu-latn) so dates match the money / counts the rest of the UI prints, and so mixed LTR digits inside RTL text stay legible.
import { DEFAULT_LOCALE, type LocaleCode } from "./config";

const TAG: Record<LocaleCode, string> = {
  en: "en-GB", pl: "pl-PL", ro: "ro-RO", ur: "ur-PK-u-nu-latn", pa: "pa-IN-u-nu-latn", bn: "bn-BD-u-nu-latn",
  ar: "ar-u-nu-latn", pt: "pt", es: "es-ES", fr: "fr-FR", cy: "cy-GB",
};

let current: LocaleCode = DEFAULT_LOCALE;

/** Called by LanguageProvider whenever the language changes. */
export function setDateLocale(l: LocaleCode): void { current = TAG[l] ? l : DEFAULT_LOCALE; }

/** The active language code ("en", "pl"…). */
export function currentLocaleCode(): LocaleCode { return current; }

/** The tag to pass to toLocaleDateString / toLocaleTimeString / toLocaleString / Intl.* for the active language. */
export function dateLocale(): string { return TAG[current]; }

/** "just now" / "5m ago" / "3h ago" / "2d ago" in the active language. `t` is the caller's useT(). */
export function agoLabel(t: (key: string, vars?: Record<string, string | number>) => string, iso: string): string {
  const mins = Math.max(0, Math.floor((Date.now() - Date.parse(iso)) / 60_000));
  if (mins < 1) return t("p7shell.agoNow");
  if (mins < 60) return t("p7shell.agoMin", { n: mins });
  const hours = Math.floor(mins / 60);
  if (hours < 24) return t("p7shell.agoHr", { n: hours });
  return t("p7shell.agoDay", { n: Math.floor(hours / 24) });
}
