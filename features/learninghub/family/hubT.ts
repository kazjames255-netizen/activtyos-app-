import { useI18n } from "@/lib/i18n/provider";
import { CATALOGS } from "@/lib/i18n/messages";
import { hubReady, isHubKey, loadHub, lookupHub } from "@/lib/i18n/hubMessages";
import { pickPlural } from "@/lib/i18n/plural";
import { DEFAULT_LOCALE, type LocaleCode } from "@/lib/i18n/config";

// Locale plumbing for hub code that is NOT a React hook (module-level copy tables such as KID_COPY / PARENT_COPY, used
// by files outside the hubfam scope). FamilyProvider calls syncHubLocale(locale) during render, so any descendant
// reading these getters sees the active language. Components should still prefer `useT()` directly.
let cur: LocaleCode = DEFAULT_LOCALE;
export const syncHubLocale = (l: LocaleCode) => { cur = l; };
export const hubLocale = (): LocaleCode => cur;

export function hubT(key: string, vars?: Record<string, string | number>): string {
  const get = (loc: LocaleCode) => (CATALOGS[loc] as unknown as Record<string, Record<string, string>> | undefined)?.[key.split(".")[0]!]?.[key.slice(key.indexOf(".") + 1)];
  let s = get(cur) ?? get("en");
  if (s === undefined && isHubKey(key)) {
    s = lookupHub(cur, key); // the hub's own words load on demand (lib/i18n/hubMessages.ts)
    if (s === undefined && !hubReady(cur)) { void loadHub(cur); return ""; }
  }
  if (s === undefined) s = key;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(String(v));
  return s;
}

/** Plural-aware lookup: picks `<key>_<category>` (zero/one/two/few/many/other per Intl.PluralRules for the active locale),
 *  falling back to `<key>_other`. Usage: `tp(t, locale, "hubfam.quizQuestions", n)`; the string may use {n}. */
export function tp(t: (k: string, v?: Record<string, string | number>) => string, locale: string, key: string, n: number, vars?: Record<string, string | number>): string {
  return pickPlural(t, locale, key, n, vars);
}

/** React hook: `{ t, locale, tp }` for hub components. */
export function useHubI18n() {
  const { t, locale } = useI18n();
  return { t, locale, tp: (key: string, n: number, vars?: Record<string, string | number>) => tp(t, locale, key, n, vars) };
}
