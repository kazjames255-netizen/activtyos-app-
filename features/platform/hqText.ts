// Label-by-English-text lookup for the HQ (platform) screens whose labels live in large module-level tables.
// `H("text")` marks a string for translation at its definition (identity at runtime); `hq(text, vars?)` returns it in the
// active language at render time (falls back to the English text, so unknown / data-driven values show as authored).
// A leading emoji token is kept and only the words are translated; `{name}` placeholders are filled from `vars`.
// Catalogue rows live in lib/i18n/messages/areas/p8hq-parts/*.ts (keys via hqKey in _key.ts).
import { tNow } from "@/lib/i18n/provider";
import { hqKey, splitLead } from "@/lib/i18n/messages/areas/p8hq-parts/_key";

export type HqVars = Record<string, string | number>;

export const H = (s: string): string => s;

const fill = (s: string, vars?: HqVars) => (vars ? s.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m)) : s);

function lookup(plain: string, vars?: HqVars): string {
  const k = `p8hq.${hqKey(plain)}`;
  const r = tNow(k, vars);
  return r === k ? fill(plain, vars) : r;
}

export function hq(s: string | null | undefined, vars?: HqVars): string {
  if (!s) return s ?? "";
  const [lead, rest] = splitLead(s);
  return lead + lookup(rest, vars);
}
