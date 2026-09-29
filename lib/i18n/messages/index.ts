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
import chrome from "./areas/chrome";
import p7login from "./areas/p7login";
import p7parent from "./areas/p7parent";
import words from "./areas/words";
import p7inc from "./areas/p7inc";
import p7med from "./areas/p7med";
import p7dash from "./areas/p7dash";
import p7bd from "./areas/p7bd";
import p7bkl from "./areas/p7bkl";
import p7pol from "./areas/p7pol";
import p7bk from "./areas/p7bk";
import p7nav from "./areas/p7nav";
import p7shell from "./areas/p7shell";

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
// The Teaching Hub catalogues (hub*) are NOT here: they are ~half of all message text and only the hub needs them, so they live in ./hub
// (served per-locale by app/i18n/hub/[locale]/route.ts and fetched by lib/i18n/hubMessages.ts). A NEW hub area: add it to ./hub.
const AREAS: Record<string, ByLocale> = { common, dashboard, parent, customers, meals, setup, team, registers, schedule, tasks, money, marketing, comms, workforce, listings, care, franchise, account, feed, staffp, chrome, p7login, p7parent, words, p7shell, p7nav, p7bk, p7pol, p7bkl, p7bd, p7dash, p7med, p7inc };

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

// Built LAZILY, one locale at a time, on first use: the merge above copies every key of every area (tens of thousands x 11 locales) —
// doing all 11 at module load was pure startup cost on every page for a user who reads one language. `in` / `[]` behave as before.
const built: Partial<Record<LocaleCode, Namespaces>> = {};
export const CATALOGS = {} as Record<LocaleCode, Namespaces>;
for (const L of LOCALE_CODES) Object.defineProperty(CATALOGS, L, { enumerable: true, get: () => (built[L] ??= buildLocale(L)) });

export type { Messages };
export { enBase as en };
