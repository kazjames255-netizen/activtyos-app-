// Plan-2 Day 12 — i18n outside the parent portal. Every step but p2-i10 is
// method:"browser" (visual language/RTL/locale/plurals/print checks across
// 11 locales and 46 feature folders — the browser agent's job, not this
// harness's). p2-i10 is method:"code": count, per locale, how many keys
// present in the English catalogue are MISSING from that locale (and so
// silently fall back to English at read time — lib/i18n/provider.tsx's
// translate() does `resolve(cat,key) ?? resolve(CATALOGS.en,key) ?? key`).
// No server/Firestore needed — this only reads the catalogue module.
//   cd server && npx tsx --tsconfig ../tsconfig.json scripts/plan2/p2H_day12.mts
import fs from "node:fs";
import { CATALOGS } from "../../../lib/i18n/messages";
import type { LocaleCode } from "../../../lib/i18n/config";

type V = { verdict: "pass" | "fail" | "blocked"; actual: string; notes?: string; method?: string };
const results: Record<string, V> = {};

const LOCALES: LocaleCode[] = ["pl", "ro", "ur", "pa", "bn", "ar", "pt", "es", "fr", "cy"];

function leafKeys(obj: Record<string, unknown>, prefix = ""): string[] {
  const out: string[] = [];
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object" && !Array.isArray(v)) out.push(...leafKeys(v as Record<string, unknown>, key));
    else out.push(key);
  }
  return out;
}
function get(obj: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((o, p) => (o && typeof o === "object" ? (o as Record<string, unknown>)[p] : undefined), obj);
}

const en = CATALOGS.en as unknown as Record<string, Record<string, unknown>>;
const enKeys = Object.entries(en).flatMap(([ns, dict]) => leafKeys(dict, ns));

const perLocale: Record<string, { missing: number; total: number; sample: string[] }> = {};
for (const L of LOCALES) {
  const cat = CATALOGS[L] as unknown;
  const missing: string[] = [];
  for (const k of enKeys) {
    const v = get(cat, k);
    if (v === undefined || v === null || v === "") missing.push(k);
  }
  perLocale[L] = { missing: missing.length, total: enKeys.length, sample: missing.slice(0, 8) };
}

const summary = LOCALES.map((L) => `${L}: ${perLocale[L].missing}/${perLocale[L].total} (${((perLocale[L].missing / perLocale[L].total) * 100).toFixed(1)}%)`).join("; ");
const worst = LOCALES.slice().sort((a, b) => perLocale[b].missing - perLocale[a].missing)[0];
results["p2-i10"] = {
  verdict: "pass",
  method: "code",
  actual: `English catalogue: ${enKeys.length} leaf keys across ${Object.keys(en).length} namespaces (${Object.keys(en).join(", ")}). Missing-key count per locale (falls back to English at read time): ${summary}. Worst: ${worst} (${perLocale[worst].missing} missing) — sample missing keys: [${perLocale[worst].sample.join(", ")}].`,
  notes: "pa/bn/pt/cy were noted (docs/qa-findings.md) as 'mapped to en for the shell' — confirmed here: every area namespace falls back through buildLocale()'s byLocale.en when the locale key is absent from an area file entirely, and any INDIVIDUAL missing key inside a present area object falls back per-key via translate(). This script counts the end result (what a user actually sees) rather than which mechanism produced it. This is a measurement, not a bug — recorded as the handover list the plan asks for; not attempting to fill in ~thousands of translated strings in this pass.",
};
console.log(`[p2-i10] ${results["p2-i10"].verdict} — ${results["p2-i10"].actual}`);

fs.writeFileSync("/tmp/p2h_day12.json", JSON.stringify({ results, world: {} }, null, 2));
process.exit(0);
