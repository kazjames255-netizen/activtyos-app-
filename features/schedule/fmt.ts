// Locale-aware helpers for the schedule screens: weekday / time / duration labels in the active language, and a display-only
// translation of the starter staff role names (roles the provider typed show as typed). Stored values are never changed.
import { dateLocale as dl, currentLocaleCode } from "@/lib/i18n/format";
import { tNow } from "@/lib/i18n/provider";

const WD_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

/** 0 = Sunday … 6 = Saturday. */
export const wdShortName = (d: number): string => new Date(2024, 0, 7 + d).toLocaleDateString(dl(), { weekday: "short" });
export const wdLongName = (d: number): string => new Date(2024, 0, 7 + d).toLocaleDateString(dl(), { weekday: "long" });
/** "mon" | "tue" … keys used by the availability editors. */
export const wdShortKey = (k: string): string => wdShortName(Math.max(0, WD_KEYS.indexOf(k)));
export const wdLongKey = (k: string): string => wdLongName(Math.max(0, WD_KEYS.indexOf(k)));

/** English keeps the compact "9am" style each screen already used; every other language uses the locale's own time format. */
export function localTime(h: number, m: number): string | null {
  if (currentLocaleCode() === "en") return null;
  return new Date(2000, 0, 1, h || 0, m || 0).toLocaleTimeString(dl(), { hour: "numeric", minute: "2-digit" });
}

/** "2h", "2h 30m" (hours, no padding); 0 -> "0h". */
export function hmShort(h: number): string {
  if (h === 0) return tNow("p8set.durH", { h: 0 });
  if (Number.isInteger(h)) return tNow("p8set.durH", { h });
  return tNow("p8set.durHM", { h: Math.floor(h), m: Math.round((h % 1) * 60) });
}
/** "2h 05m" (minutes padded). */
export function hmPad(h: number): string {
  return tNow("p8set.durHM", { h: Math.floor(h), m: String(Math.round((h % 1) * 60)).padStart(2, "0") });
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
/** Starter staff role names translate at display; custom roles show as typed. */
export function roleLabel(t: (k: string) => string, r: string | undefined | null): string {
  if (!r) return r ?? "";
  const k = "p8set.role_" + slug(r);
  const v = t(k);
  return v === k ? r : v;
}

/** Display label for an availability-request window. The stored `label` is English ("week of 12 October"); derive the shown text from the kind + dates. */
export function windowLabel(w: { kind: string; label: string; from?: string }): string {
  if (w.kind === "week" && w.from) {
    const d = new Date(`${w.from}T00:00:00`);
    if (!isNaN(d.getTime())) return tNow("p8set.scWeekOf", { date: d.toLocaleDateString(dl(), { day: "numeric", month: "long" }) });
  }
  if (w.kind === "ongoing") return tNow("p8set.scUsualPattern");
  return w.label;
}
