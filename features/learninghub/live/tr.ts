import hublive from "@/lib/i18n/messages/areas/hublive";

/** hublive.* lookup for NON-component code (state machines, helpers). Reads the active language from <html lang>
 *  (the provider mirrors it there) — components should prefer useT(). Keys are given WITHOUT the "hublive." prefix. */
export function tr(key: string, vars?: Record<string, string | number>): string {
  const lang = typeof document !== "undefined" ? document.documentElement.lang : "";
  let s = hublive[lang]?.[key] ?? hublive.en[key] ?? key;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(String(v));
  return s;
}
