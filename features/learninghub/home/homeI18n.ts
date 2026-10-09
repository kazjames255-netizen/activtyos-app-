"use client";

import { useI18n } from "@/lib/i18n/provider";
import { pickPlural } from "@/lib/i18n/plural";
import { uiDate } from "@/lib/i18n/format";

type Vars = Record<string, string | number>;
export type Tr = (key: string, vars?: Vars) => string;

/** "{n} things" in the locale's own plural form: looks up hubshell.<base>_<zero|one|two|few|many|other> (per Intl.PluralRules) and falls back to `_other`. */
export function pluralOf(t: Tr, locale: string, base: string, n: number): string {
  return pickPlural(t, locale, `hubshell.${base}`, n);
}

/** Translator + locale + a bound plural helper for the Home / Mark screens. Every key here is `hubshell.hm_…`. */
export function useH() {
  const { t, locale } = useI18n();
  return { t, locale, pl: (base: string, n: number) => pluralOf(t, locale, base, n) };
}

/** "5 min ago" / "Yesterday" / "3 days ago" / a short date, in the active language. */
export function relTimeT(t: Tr, locale: string, iso: string | null | undefined, now: number): string {
  if (!iso) return "";
  const ms = new Date(iso).getTime();
  if (Number.isNaN(ms)) return "";
  const d = now - ms;
  const MIN = 60_000, HOUR = 3_600_000, DAY = 86_400_000;
  if (d < 45_000) return t("hubshell.hm_justNow");
  if (d < HOUR) return t("hubshell.hm_minAgo", { n: Math.max(1, Math.round(d / MIN)) });
  if (d < DAY) return t("hubshell.hm_hAgo", { n: Math.round(d / HOUR) });
  const sod = (x: number) => { const z = new Date(x); return new Date(z.getFullYear(), z.getMonth(), z.getDate()).getTime(); };
  const days = Math.floor((sod(now) - sod(ms)) / DAY);
  if (days <= 1) return t("hubshell.hm_yesterday");
  if (days < 7) return pluralOf(t, locale, "hm_daysAgo", days);
  return uiDate(new Date(ms), { day: "numeric", month: "short" }, locale);
}

export function greetingT(t: Tr, now: number): string {
  const h = new Date(now).getHours();
  return t(h < 5 ? "hubshell.hm_greetHello" : h < 12 ? "hubshell.hm_greetMorning" : h < 18 ? "hubshell.hm_greetAfternoon" : "hubshell.hm_greetEvening");
}
