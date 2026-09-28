// The Teaching Hub message catalogues, kept OUT of the main catalogue (./index) so no other page downloads them.
// Server-side source for GET /i18n/hub/<locale> (app/i18n/hub/[locale]/route.ts); the client fetches ONE locale (+ English) on demand
// — see lib/i18n/hubMessages.ts. To add a hub area: import it here and list it in HUB_AREAS.
import type { LocaleCode } from "../config";
import hubshell from "./areas/hubshell";
import hublessons from "./areas/hublessons";
import hublive from "./areas/hublive";
import hubtoolsa from "./areas/hubtoolsa";
import hubtoolsb from "./areas/hubtoolsb";
import hubfam from "./areas/hubfam";
import hubhomework from "./areas/hubhomework";
import hubhow from "./areas/hubhow";
import hubplan from "./areas/hubplan";
import hubmascot from "./areas/hubmascot";
import hubpicker from "./areas/hubpicker";
import hubgames from "./areas/hubgames";
import hubtoolsui from "./areas/hubtoolsui";
import hubplurals from "./areas/hubplurals";
import hubwidgetnames from "./areas/hubwidgetnames";

type Dict = Record<string, string>;
type ByLocale = Partial<Record<LocaleCode, Dict>>;
export const HUB_AREAS: Record<string, ByLocale> = { hubshell, hublessons, hublive, hubtoolsa, hubtoolsb, hubfam, hubhomework, hubhow, hubplan, hubmascot, hubpicker, hubgames, hubtoolsui };
// Plural forms an area does not carry (ar zero/two/many...): fill gaps only, never override an area's own key.
for (const [area, byLoc] of [...Object.entries(hubplurals), ...Object.entries(hubwidgetnames)]) for (const [loc, extra] of Object.entries(byLoc)) { const a = HUB_AREAS[area] as Record<string, Dict>; a[loc] = { ...extra, ...(a[loc] ?? {}) }; }

/** One locale's hub namespaces ({ hubshell: {...}, hublessons: {...} }). A key a locale lacks falls back to English in the resolver. */
export function hubCatalog(L: LocaleCode): Record<string, Dict> {
  const out: Record<string, Dict> = {};
  for (const [area, byLocale] of Object.entries(HUB_AREAS)) out[area] = byLocale[L] ?? byLocale.en ?? {};
  return out;
}
