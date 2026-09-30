import { BRAND, DEFAULT_LOCALE, type LocaleCode } from "./config";
import { CATALOGS } from "./messages";
import { hubReady, isHubKey, loadHub, lookupHub } from "./hubMessages";

export type Vars = Record<string, string | number>;

// Resolve a dotted key ("header.myBookings") against a nested catalogue.
function resolve(obj: unknown, path: string): string | undefined {
  const out = path.split(".").reduce<unknown>((o, k) => (o && typeof o === "object" ? (o as Record<string, unknown>)[k] : undefined), obj);
  return typeof out === "string" ? out : undefined;
}

export function translate(locale: LocaleCode, key: string, vars?: Vars): string {
  const cat = CATALOGS[locale] ?? CATALOGS.en;
  let s = resolve(cat, key) ?? resolve(CATALOGS.en, key);
  if (s === undefined && isHubKey(key)) {
    // Teaching Hub words load on demand (lib/i18n/hubMessages.ts): until they land, blank — never the raw key — and ask for them.
    s = lookupHub(locale, key);
    if (s === undefined && !hubReady(locale)) { void loadHub(locale); return ""; }
  }
  if (s === undefined) s = key;
  s = s.split("{brand}").join(BRAND);
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(String(v));
  return s;
}

