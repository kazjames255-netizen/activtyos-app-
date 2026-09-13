import enBase, { type Messages } from "./en";
import plBase from "./pl";
import roBase from "./ro";
import urBase from "./ur";
import arBase from "./ar";
import frBase from "./fr";
import esBase from "./es";
import paBase from "./pa";
import bnBase from "./bn";
import ptBase from "./pt";
import cyBase from "./cy";
import type { LocaleCode } from "../config";

// Per-area catalogues authored by the i18n migration (one file per feature area,
// each an object keyed by locale). Add an import here as each area lands.
import common from "./areas/common";
import dashboard from "./areas/dashboard";
import parent from "./areas/parent";
import customers from "./areas/customers";
import meals from "./areas/meals";
import setup from "./areas/setup";
import team from "./areas/team";
import registers from "./areas/registers";
import schedule from "./areas/schedule";
import tasks from "./areas/tasks";
import money from "./areas/money";
import marketing from "./areas/marketing";
import comms from "./areas/comms";
import workforce from "./areas/workforce";
import listings from "./areas/listings";
import care from "./areas/care";
import franchise from "./areas/franchise";
import account from "./areas/account";
import feed from "./areas/feed";
import staffp from "./areas/staffp";

type Dict = Record<string, string>;
type ByLocale = Partial<Record<LocaleCode, Dict>>;
type Namespaces = Record<string, Dict>;

// Base shell catalogues (common + header namespaces), authored for all 11 locales;
// any key a locale lacks still falls back to English in the resolver.
const BASE: Record<LocaleCode, Namespaces> = {
  en: enBase as unknown as Namespaces,
  pl: plBase as unknown as Namespaces,
  ro: roBase as unknown as Namespaces,
  ur: urBase as unknown as Namespaces,
  ar: arBase as unknown as Namespaces,
  fr: frBase as unknown as Namespaces,
  es: esBase as unknown as Namespaces,
  pa: paBase as unknown as Namespaces,
  bn: bnBase as unknown as Namespaces,
  pt: ptBase as unknown as Namespaces,
  cy: cyBase as unknown as Namespaces,
};

// area namespace -> its per-locale dictionaries.
const AREAS: Record<string, ByLocale> = { common, dashboard, parent, customers, meals, setup, team, registers, schedule, tasks, money, marketing, comms, workforce, listings, care, franchise, account, feed, staffp };

const LOCALE_CODES: LocaleCode[] = ["en", "pl", "ro", "ur", "pa", "bn", "ar", "pt", "es", "fr", "cy"];

function buildLocale(L: LocaleCode): Namespaces {
  const base = BASE[L] ?? BASE.en;
  const out: Namespaces = {};
  for (const [ns, dict] of Object.entries(base)) out[ns] = { ...dict };
  for (const [area, byLocale] of Object.entries(AREAS)) {
    const dict = byLocale[L] ?? byLocale.en ?? {};
    out[area] = { ...(out[area] ?? {}), ...dict };
  }
  return out;
}

export const CATALOGS = Object.fromEntries(LOCALE_CODES.map((L) => [L, buildLocale(L)])) as Record<LocaleCode, Namespaces>;

export type { Messages };
export { enBase as en };
