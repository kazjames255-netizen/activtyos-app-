// Source for the lazily-loaded catalogue areas (see ../lazyAreas.ts). Served with the Teaching Hub catalogue by app/i18n/hub/[locale]/route.ts.
import type { LocaleCode } from "../config";
import p8set from "./areas/p8set";
import p8em from "./areas/p8em";
import p8lst from "./areas/p8lst";
import p8fin from "./areas/p8fin";
import p8wf from "./areas/p8wf";
import p8lrn from "./areas/p8lrn";
import p8ops from "./areas/p8ops";
import p8hq from "./areas/p8hq";
import p8fr from "./areas/p8fr";
import p8misc from "./areas/p8misc";
import p8api from "./areas/p8api";
import p8tst from "./areas/p8tst";

type Dict = Record<string, string>;
type ByLocale = Partial<Record<LocaleCode, Dict>>;
export const LAZY_AREAS: Record<string, ByLocale> = { p8set, p8em, p8lst, p8fin, p8wf, p8lrn, p8ops, p8hq, p8fr, p8misc, p8api, p8tst };

/** One locale's lazy namespaces; a key a locale lacks falls back to English in the resolver. */
export function lazyCatalog(L: LocaleCode): Record<string, Dict> {
  const out: Record<string, Dict> = {};
  for (const [area, byLocale] of Object.entries(LAZY_AREAS)) out[area] = byLocale[L] ?? byLocale.en ?? {};
  return out;
}
