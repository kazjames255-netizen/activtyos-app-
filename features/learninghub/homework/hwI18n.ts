"use client";

import { useI18n } from "@/lib/i18n/provider";
import { pickPlural } from "@/lib/i18n/plural";
import { uiDate, uiTime } from "@/lib/i18n/format";

// Homework strings live in the `hubhomework.` catalogue (all 11 locales). `h("key", {vars})` translates, `hp("base", n)` picks the
// right plural form for the active language, and the date helpers format with the ACTIVE locale (Intl), never a fixed "en-GB".
export function useHw() {
  const { t, locale } = useI18n();
  const bcp = locale === "en" ? "en-GB" : locale;
  const h = (k: string, v?: Record<string, string | number>): string => t(`hubhomework.${k}`, v);
  const hp = (base: string, n: number, v?: Record<string, string | number>): string => pickPlural((k, vars) => t(`hubhomework.${k}`, vars), locale, base, n, v);
  const fmt = (iso: string, o: Intl.DateTimeFormatOptions) => { try { return uiDate(new Date(iso), o, bcp); } catch { return uiDate(new Date(iso), o); } };
  return {
    h, hp, locale,
    /** "Mon 3 Mar" */
    day: (iso: string) => fmt(iso, { weekday: "short", day: "numeric", month: "short" }),
    /** "3 Mar" */
    dayShort: (iso: string) => fmt(iso, { day: "numeric", month: "short" }),
    weekday: (iso: string) => fmt(iso, { weekday: "long" }),
    dayTime: (iso: string) => { try { return `${fmt(iso, { weekday: "short", day: "numeric", month: "short" })} · ${uiTime(new Date(iso), { hour: "2-digit", minute: "2-digit" }, bcp)}`; } catch { return iso; } },
  };
}
export type Hw = ReturnType<typeof useHw>;
