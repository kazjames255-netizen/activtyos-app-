// Hub i18n completeness gate:  npm run i18n:check
//
// Reads the MERGED hub catalogue (lib/i18n/messages/hub.ts, the same object the API serves at /i18n/hub/<locale>) and fails when a locale
// silently falls back to English. A missing key is the classic case, but so is a key that was "translated" by pasting the English text
// (which is how a whole batch of strings sat in English in every language).
//
//   1. missing      — key exists in en but not in the locale (runtime would show English)
//   2. placeholders — {name}-style tokens differ from the English string
//   3. untranslated — the locale string is IDENTICAL to English and reads as English text:
//        · any locale: 3 or more English words
//        · non-Latin locales (ur, pa, bn, ar): any word of 4+ Latin letters
//      Cognates, units and brand words in Latin-script locales ("Quiz", "min", "Year {n}") are fine and are not flagged.
//
// Run with tsx (the catalogue is TypeScript):  server/node_modules/.bin/tsx scripts/i18n-missing.mjs
// Options: --json (machine output)   --area=hubgames (limit to one area)
import { HUB_AREAS } from "../lib/i18n/messages/hub.ts";

const LOCALES = ["pl", "ro", "ur", "pa", "bn", "ar", "pt", "es", "fr", "cy"];
const NON_LATIN = new Set(["ur", "pa", "bn", "ar"]);
// Strings that are legitimately the same as English in every language (proper nouns, grammar abbreviations, key names, puzzle words).
const ALLOW_SAME = new Set([
  "hubgames.enter",
  "hubtoolsb.eng_f_persuasive_bank0",
  "hubtoolsb.lang_caseS_nom",
  "hubtoolsb.lang_caseS_dat",
  "hubtoolsb.lang_caseS_gen",
]);
// Placeholder sets that intentionally differ from English (a language rephrases to avoid a case/mutation the token cannot take, or English is a generic line).
const ALLOW_PH = new Set(["hubfam.pgTutorEmptyBody", "hubfam.pgTutorEmptyBodyDiag", "hubgames.mech_steer"]);
const selftest = process.argv.includes("--selftest");
if (selftest) { // positive controls: the gate must catch each failure kind, otherwise a green run means nothing
  const a = HUB_AREAS.hubgames;
  a.pl = { ...a.pl }; a.ur = { ...a.ur }; a.fr = { ...a.fr };
  delete a.pl.arc_title;                                   // missing
  a.ur.arc_sub = a.en.arc_sub;                             // untranslated (English pasted into a non-Latin locale)
  a.fr.arc_hearts = a.fr.arc_hearts.replace("{max}", "");  // placeholder dropped
}
const only = (process.argv.find((a) => a.startsWith("--area=")) || "").slice(7);
const asJson = process.argv.includes("--json");

const stripPh = (s) => s.replace(/\{[^}]+\}/g, "");
const englishWords = (s) => stripPh(s).split(/\s+/).filter((w) => /[A-Za-z]{2,}/.test(w)).length;
const ph = (s) => [...new Set(s.match(/\{[a-zA-Z0-9_]+\}/g) || [])].sort().join(",");

const problems = [];
const per = {};
let checked = 0;
for (const [area, byLocale] of Object.entries(HUB_AREAS)) {
  if (only && area !== only) continue;
  const en = byLocale.en ?? {};
  for (const loc of LOCALES) {
    const dict = byLocale[loc] ?? {};
    for (const key of Object.keys(en)) {
      if (en[key] === "") continue; // English is intentionally empty (dynamic / code-supplied): nothing to translate
      checked++;
      const id = `${area}.${key}`;
      const push = (kind) => { problems.push({ kind, area, key, loc, en: en[key] }); per[`${kind}:${loc}`] = (per[`${kind}:${loc}`] || 0) + 1; };
      if (!(key in dict)) { push("missing"); continue; }
      const v = dict[key];
      if (typeof v !== "string" || !v.trim()) { push("empty"); continue; }
      if (ph(v) !== ph(en[key]) && !ALLOW_PH.has(id) && !/_(zero|one|two|few|many)$/.test(key)) { push("placeholders"); continue; }
      if (v === en[key] && !ALLOW_SAME.has(id)) {
        const w = englishWords(en[key]);
        const bigWord = /[A-Za-z]{4,}/.test(stripPh(en[key]));
        if (w >= 3 || (NON_LATIN.has(loc) && bigWord)) push("untranslated");
      }
    }
  }
}

if (asJson) console.log(JSON.stringify({ checked, problems }, null, 1));
else {
  const byKind = {};
  for (const p of problems) (byKind[p.kind] ||= []).push(p);
  for (const [kind, list] of Object.entries(byKind)) {
    console.log(`\n${kind.toUpperCase()} (${list.length})`);
    const byKey = new Map();
    for (const p of list) { const id = `${p.area}.${p.key}`; (byKey.get(id) || byKey.set(id, { en: p.en, locs: [] }).get(id)).locs.push(p.loc); }
    let n = 0;
    for (const [id, e] of byKey) { if (n++ >= 40) { console.log(`  … and ${byKey.size - 40} more keys`); break; } console.log(`  ${id}  [${e.locs.join(",")}]  ${JSON.stringify(e.en).slice(0, 70)}`); }
  }
  console.log(`\nchecked ${checked} entries across ${Object.keys(HUB_AREAS).length} areas x ${LOCALES.length} locales — ${problems.length ? problems.length + " problem(s)" : "all translated"}`);
}
if (selftest) {
  const kinds = new Set(problems.map((p) => p.kind));
  const ok = ["missing", "untranslated", "placeholders"].every((k) => kinds.has(k));
  console.log(ok ? "selftest ok: missing, untranslated and placeholder faults were all detected" : "selftest FAILED: detector missed a fault kind (" + [...kinds].join(",") + ")");
  process.exit(ok ? 0 : 1);
}
process.exit(problems.length ? 1 : 0);
