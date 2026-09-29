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

/** The tag to pass to toLocaleDateString / toLocaleTimeString / toLocaleString / Intl.* for the active language. */
export function dateLocale(): string { return TAG[current]; }
