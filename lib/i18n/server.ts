// Server-component translation (metadata, <html lang/dir>): reads the catalogues directly — never the client-only hub loader.
import { cookies } from "next/headers";
import { BRAND, DEFAULT_LOCALE, LOCALE_COOKIE, isLocaleCode, isRTL, type LocaleCode } from "./config";
import { CATALOGS } from "./messages";

/** The language the visitor picked (cookie mirrored by LanguageProvider), or English. */
export async function requestLocale(): Promise<LocaleCode> {
  const v = (await cookies()).get(LOCALE_COOKIE)?.value;
  return isLocaleCode(v) ? v : DEFAULT_LOCALE;
}

export function serverT(locale: LocaleCode, key: string): string {
  const get = (l: LocaleCode) => key.split(".").reduce<unknown>((o, k) => (o && typeof o === "object" ? (o as Record<string, unknown>)[k] : undefined), CATALOGS[l]);
  const s = get(locale) ?? get(DEFAULT_LOCALE);
  return (typeof s === "string" ? s : key).split("{brand}").join(BRAND);
}

export const dirFor = (l: LocaleCode): "rtl" | "ltr" => (isRTL(l) ? "rtl" : "ltr");
