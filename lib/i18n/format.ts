// The BCP-47 tag for date / time / number formatting in the ACTIVE app language.
//
// Hard-coded `toLocaleDateString("en-GB", …)` calls never followed the language picker, so an Arabic / Polish / Welsh user saw
// "Mon 12 Oct" in an otherwise translated page. Use `dateLocale()` instead of a literal tag (LanguageProvider keeps it in step
// with the picker). English stays UK-style (plain "en" would print US-style "Sep 12"). Arabic, Urdu, Bengali and Panjabi use
// Western digits (-u-nu-latn) so dates match the money / counts the rest of the UI prints, and so mixed LTR digits inside RTL text stay legible.
import { DEFAULT_LOCALE, type LocaleCode } from "./config";
import { joinList, safeLocale } from "./listFormat";

const TAG: Record<LocaleCode, string> = {
  en: "en-GB", pl: "pl-PL", ro: "ro-RO", ur: "ur-PK-u-nu-latn", pa: "pa-IN-u-nu-latn", bn: "bn-BD-u-nu-latn",
  ar: "ar-u-nu-latn", pt: "pt", es: "es-ES", fr: "fr-FR", cy: "cy-GB",
};

let current: LocaleCode = DEFAULT_LOCALE;
// The tag this browser actually accepts for `current` (an unsupported tag throws RangeError in Intl / toLocale* on some Safari builds, which
// during a render blanks the whole page). Checked once per language change, not per call.
let tag: string = safeLocale(TAG[DEFAULT_LOCALE]);

/** Called by LanguageProvider whenever the language changes. */
export function setDateLocale(l: LocaleCode): void { current = TAG[l] ? l : DEFAULT_LOCALE; tag = safeLocale(TAG[current]); }

/** The active language code ("en", "pl"…). */
export function currentLocaleCode(): LocaleCode { return current; }

/** The tag to pass to toLocaleDateString / toLocaleTimeString / toLocaleString / Intl.* for the active language. */
export function dateLocale(): string { return tag; }

/** "A, B and C" in the active language, never throwing (see lib/i18n/listFormat.ts). */
export function joinListNow(items: string[]): string { return joinList(items, tag); }

/** "just now" / "5m ago" / "3h ago" / "2d ago" in the active language. `t` is the caller's useT(). */
export function agoLabel(t: (key: string, vars?: Record<string, string | number>) => string, iso: string): string {
  const mins = Math.max(0, Math.floor((Date.now() - Date.parse(iso)) / 60_000));
  if (mins < 1) return t("p7shell.agoNow");
  if (mins < 60) return t("p7shell.agoMin", { n: mins });
  const hours = Math.floor(mins / 60);
  if (hours < 24) return t("p7shell.agoHr", { n: hours });
  return t("p7shell.agoDay", { n: Math.floor(hours / 24) });
}

// ---- Dates and "in N days" that follow the app language -------------------------------------------------------------------------------
// Chrome ships no Welsh date or relative-time data (cy-GB silently prints English: "Sun, Oct 18", "in 2 days"), so Welsh uses its own names here.
// Every other language goes through Intl with its own tag. `code` defaults to the active language; tests pass one explicitly.
const CY_DAY_LONG = ["Dydd Sul", "Dydd Llun", "Dydd Mawrth", "Dydd Mercher", "Dydd Iau", "Dydd Gwener", "Dydd Sadwrn"];
const CY_DAY_SHORT = ["Sul", "Llun", "Maw", "Mer", "Iau", "Gwe", "Sad"];
const CY_MONTH_LONG = ["Ionawr", "Chwefror", "Mawrth", "Ebrill", "Mai", "Mehefin", "Gorffennaf", "Awst", "Medi", "Hydref", "Tachwedd", "Rhagfyr"];
const CY_MONTH_SHORT = ["Ion", "Chwef", "Maw", "Ebr", "Mai", "Meh", "Gorff", "Awst", "Medi", "Hyd", "Tach", "Rhag"];

export interface DayFormat { weekday?: "short" | "long"; day?: "numeric"; month?: "short" | "long"; year?: "numeric" }

/** A calendar day ("YYYY-MM-DD", no time zone shifts) as text in the app language, e.g. "Sun 18 Oct" / "Sul 18 Hyd". */
export function formatDay(iso: string, f: DayFormat, code: LocaleCode = current): string {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  if (code === "cy") {
    const w = f.weekday ? (f.weekday === "long" ? CY_DAY_LONG : CY_DAY_SHORT)[d.getUTCDay()] : "";
    const m = f.month ? (f.month === "long" ? CY_MONTH_LONG : CY_MONTH_SHORT)[d.getUTCMonth()] : "";
    return [w, f.day ? String(d.getUTCDate()) : "", m, f.year ? String(d.getUTCFullYear()) : ""].filter(Boolean).join(" ");
  }
  const s = d.toLocaleDateString(TAG[code] ?? TAG[DEFAULT_LOCALE], { ...f, timeZone: "UTC" });
  // en-GB prints "Sun, 18 Oct" for weekday + day + month; the app writes it without the comma.
  return code === "en" ? s.replace(/^(\w+),\s/, "$1 ") : s;
}

const CY_REL_UNIT: Record<"day" | "week" | "month", string> = { day: "diwrnod", week: "wythnos", month: "mis" };
/** "in 2 days" / "tomorrow" / "3 weeks ago" in the app language (Welsh written out, see above). */
export function relativeFrom(n: number, unit: "day" | "week" | "month", code: LocaleCode = current): string {
  if (code === "cy") {
    if (unit === "day" && n === 0) return "heddiw";
    if (unit === "day" && n === 1) return "yfory";
    if (unit === "day" && n === -1) return "ddoe";
    const k = Math.abs(n);
    const word = k === 2 && unit === "day" ? "ddiwrnod" : CY_REL_UNIT[unit]; // "dau ddiwrnod": soft mutation after two
    return n < 0 ? `${k} ${word} yn ôl` : `ymhen ${k} ${word}`;
  }
  return new Intl.RelativeTimeFormat(TAG[code] ?? TAG[DEFAULT_LOCALE], { numeric: "auto" }).format(n, unit);
}

const SYMBOL_AFTER = new Set<LocaleCode>(["pl", "ro", "es", "fr", "pt"]);
/**
 * GBP amount in the active language's number conventions ("£1,234.50" in English, "1 234,50 £" in French / Polish / Spanish...), always
 * pounds sterling with the £ sign (Intl's own currency style prints "GBP" / "£GB" / "UK£" in several locales). Amounts are unchanged:
 * this only formats. `decimals` defaults to 2.
 */
export function formatGBP(n: number, decimals = 2): string {
  const num = new Intl.NumberFormat(dateLocale(), { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(n);
  return SYMBOL_AFTER.has(current) ? `${num} £` : `£${num}`;
}
