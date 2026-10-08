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

// ---- Date / time of day: the app-language replacements for toLocaleDateString / toLocaleTimeString / toLocaleString ------------------------------------
// English is UK style (24-hour clock, "08/10/2026"), every other language its own locale; Welsh is built from en-GB with the Welsh names put in (above).
type DT = Date | number | string;
const DATE_FIELDS = ["weekday", "year", "month", "day"] as const;
const TIME_FIELDS = ["dayPeriod", "hour", "minute", "second", "fractionalSecondDigits"] as const;
const EN_DAY_LONG = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const EN_MONTH_LONG = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function withDefaults(kind: "date" | "time" | "both", o: Intl.DateTimeFormatOptions): Intl.DateTimeFormatOptions {
  if (o.dateStyle || o.timeStyle) {
    // Welsh is built from fields, so a style is spelled out as the fields it stands for.
    const { dateStyle, timeStyle, ...rest } = o;
    const out2: Intl.DateTimeFormatOptions = { ...rest };
    if (dateStyle === "full") Object.assign(out2, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
    else if (dateStyle === "long") Object.assign(out2, { day: "numeric", month: "long", year: "numeric" });
    else if (dateStyle === "medium") Object.assign(out2, { day: "numeric", month: "short", year: "numeric" });
    else if (dateStyle === "short") Object.assign(out2, { day: "2-digit", month: "2-digit", year: "2-digit" });
    if (timeStyle) Object.assign(out2, { hour: "2-digit", minute: "2-digit" }, timeStyle === "short" ? {} : { second: "2-digit" });
    return out2;
  }
  const has = (keys: readonly string[]) => keys.some((k) => (o as Record<string, unknown>)[k] !== undefined);
  const out = { ...o };
  if ((kind === "date" || kind === "both") && !has(DATE_FIELDS) && !(kind === "both" && has(TIME_FIELDS))) { out.year = "numeric"; out.month = "numeric"; out.day = "numeric"; }
  if ((kind === "time" || kind === "both") && !has(TIME_FIELDS) && !(kind === "both" && has(DATE_FIELDS))) { out.hour = "numeric"; out.minute = "numeric"; out.second = "numeric"; }
  if (kind === "both" && !has(DATE_FIELDS) && !has(TIME_FIELDS)) { out.year = "numeric"; out.month = "numeric"; out.day = "numeric"; out.hour = "numeric"; out.minute = "numeric"; out.second = "numeric"; }
  return out;
}

function welshParts(d: Date, o: Intl.DateTimeFormatOptions): string {
  const base = { ...o, hour12: o.hour12, hourCycle: o.hour12 === undefined ? "h23" as const : o.hourCycle };
  const f = new Intl.DateTimeFormat("en-GB", base);
  const tz = o.timeZone;
  // The weekday / month INDEX in the same time zone, from English long names (en-GB never changes).
  const wd = EN_DAY_LONG.indexOf(new Intl.DateTimeFormat("en-GB", { weekday: "long", timeZone: tz }).format(d));
  const mo = EN_MONTH_LONG.indexOf(new Intl.DateTimeFormat("en-GB", { month: "long", timeZone: tz }).format(d));
  return f.formatToParts(d).map((p, i, all) => {
    if (p.type === "literal" && all[i - 1]?.type === "weekday") return p.value.replace(/^,\s*/, " "); // "Dydd Iau 8 Hydref", like formatDay
    if (p.type === "weekday" && wd >= 0) return o.weekday === "long" ? CY_DAY_LONG[wd] : CY_DAY_SHORT[wd];
    if (p.type === "month" && mo >= 0 && (o.month === "long" || o.month === "short")) return o.month === "long" ? CY_MONTH_LONG[mo] : CY_MONTH_SHORT[mo];
    if (p.type === "literal") return p.value.replace(/\bat\b/, "am");
    if (p.type === "dayPeriod") return p.value.toLowerCase() === "am" ? "yb" : "yh";
    return p.value;
  }).join("");
}

function fmtLocal(kind: "date" | "time" | "both", d: DT, o: Intl.DateTimeFormatOptions, code: LocaleCode | string | undefined): string {
  const date = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(date.getTime())) return "Invalid Date";
  // `code` is an app language code ("cy") or a ready BCP-47 tag ("cy-GB") from a screen that keeps its own language setting (the Learning Hub).
  const tag = (code ? (TAG as Record<string, string>)[code] ?? code : TAG[current]);
  if (/^cy(-|$)/i.test(tag)) return welshParts(date, withDefaults(kind, o));
  return kind === "date" ? date.toLocaleDateString(tag, o) : kind === "time" ? date.toLocaleTimeString(tag, o) : date.toLocaleString(tag, o);
}

/** Replaces `d.toLocaleDateString(locale, opts)`: a date in the app language. */
export function uiDate(d: DT, o: Intl.DateTimeFormatOptions = {}, code?: LocaleCode | string): string { return fmtLocal("date", d, o, code); }
/** Replaces `d.toLocaleTimeString(locale, opts)`: a time of day in the app language (24-hour for English). */
export function uiTime(d: DT, o: Intl.DateTimeFormatOptions = {}, code?: LocaleCode | string): string { return fmtLocal("time", d, o, code); }
/** Replaces `d.toLocaleString(locale, opts)` on a Date: date and time in the app language. */
export function uiDateTime(d: DT, o: Intl.DateTimeFormatOptions = {}, code?: LocaleCode | string): string { return fmtLocal("both", d, o, code); }

// ---- Stored English day labels ("Sun 18 Oct 2026", "18 – 24 Oct 2026") shown to people in their own language ---------------------------------------
// The server writes booking.sessions / kids[].dates / ticket text with English day names. Display code passes them through here: every day it can read
// is re-written with formatDay (Welsh names for cy); the rest of the text (times, words) is left alone.
const EN_MON = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const pad2 = (n: number) => String(n).padStart(2, "0");
const isoOf = (y: string, mon: string, d: string): string | null => {
  const m = EN_MON.indexOf(mon.slice(0, 3).toLowerCase());
  return m < 0 ? null : `${y}-${pad2(m + 1)}-${pad2(Number(d))}`;
};
const WD = "(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)[a-z]*\\.?,?\\s+";
const MON = "(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\\.?";
export function localizeDateLabels(text: string | null | undefined, code?: LocaleCode | string): string {
  if (!text) return "";
  const c = (code ?? current) as LocaleCode;
  if (c === "en") return text;
  const withWd = new RegExp(`\\b(?:${WD})?(\\d{1,2})\\s+${MON}\\s+(\\d{4})\\b`, "g");
  const range = new RegExp(`\\b(\\d{1,2})\\s*[–-]\\s*(\\d{1,2})\\s+${MON}\\s+(\\d{4})\\b`, "g");
  // Ranges first ("18 – 24 Oct 2026"), then single days; a day already rewritten is not matched again (it no longer has an English month).
  let out = text.replace(range, (all, d1, d2, mon, y) => {
    const a = isoOf(y, mon, d1), b = isoOf(y, mon, d2);
    return a && b ? `${formatDay(a, { day: "numeric" }, c)} – ${formatDay(b, { day: "numeric", month: "short", year: "numeric" }, c)}` : all;
  });
  out = out.replace(withWd, (all, d, mon, y) => {
    const iso = isoOf(y, mon, d);
    if (!iso) return all;
    return formatDay(iso, { weekday: /^(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)/i.test(all) ? "short" : undefined, day: "numeric", month: "short", year: "numeric" }, c);
  });
  return out;
}

type RelUnit = "second" | "minute" | "hour" | "day" | "week" | "month";
const CY_REL_UNIT: Record<RelUnit, string> = { second: "eiliad", minute: "munud", hour: "awr", day: "diwrnod", week: "wythnos", month: "mis" };
/** "in 2 days" / "tomorrow" / "3 weeks ago" in the app language (Welsh written out, see above). `code` is an app language code or a ready BCP-47 tag
 *  (screens with their own language setting, e.g. the Learning Hub); `style` is Intl's own (Welsh ignores it). */
export function relativeFrom(n: number, unit: RelUnit, code?: LocaleCode | string, style: "long" | "short" | "narrow" = "long"): string {
  const tag = code ? (TAG as Record<string, string>)[code] ?? code : TAG[current];
  if (/^cy(-|$)/i.test(tag)) {
    if (unit === "day" && n === 0) return "heddiw";
    if (unit === "second" && n === 0) return "nawr";
    if (unit === "day" && n === 1) return "yfory";
    if (unit === "day" && n === -1) return "ddoe";
    const k = Math.abs(n);
    const word = k === 2 && unit === "day" ? "ddiwrnod" : CY_REL_UNIT[unit]; // "dau ddiwrnod": soft mutation after two
    return n < 0 ? `${k} ${word} yn ôl` : `ymhen ${k} ${word}`;
  }
  try { return new Intl.RelativeTimeFormat(tag, { numeric: "auto", style }).format(n, unit); } // raw-locale-ok: this IS the helper
  catch { return new Intl.RelativeTimeFormat("en-GB", { numeric: "auto", style }).format(n, unit); } // raw-locale-ok: this IS the helper
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
