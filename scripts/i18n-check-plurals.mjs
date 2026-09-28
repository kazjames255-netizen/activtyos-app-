// Plural output checks for the hub catalogues in pl / ro / pt / es / fr (+ chain fallback for ar / cy).
// Run: node scripts/i18n-check-plurals.mjs   (uses lib/i18n/plural.ts, the same helper the hub runtime uses)
import fs from "fs"; import path from "path"; import { createRequire } from "module";
const root = process.cwd(); const require = createRequire(import.meta.url);
const ts = (await import("typescript")).default;
require.extensions[".ts"] = (m, f) => m._compile(ts.transpileModule(fs.readFileSync(f, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true } }).outputText, f);
const { pickPlural, pluralChain } = require(path.join(root, "lib/i18n/plural.ts"));
const { HUB_AREAS } = require(path.join(root, "lib/i18n/messages/hub.ts"));
let n = 0, bad = 0; const eq = (got, want, msg) => { n++; if (got !== want) { bad++; console.log(`FAIL ${msg}: got ${JSON.stringify(got)} want ${JSON.stringify(want)}`); } };
const T = (loc) => (k, v) => { const [a, ...r] = k.split("."); let s = HUB_AREAS[a]?.[loc]?.[r.join(".")] ?? HUB_AREAS[a]?.en?.[r.join(".")]; if (HUB_AREAS[a]?.[loc]?.[r.join(".")] === undefined) s = undefined; if (s === undefined) return k; for (const [x, y] of Object.entries(v || {})) s = s.split(`{${x}}`).join(String(y)); return s; };
const R = (loc, base, x) => pickPlural(T(loc), loc, base, x);
const NS = [1, 2, 5, 19, 20, 21, 25, 100];

// ---- Romanian: one / few (0, 2-19, 101-119) / other (20+ => "de")
for (const [base, noun, nounDe] of [["hubshell.hm_nStudents", "elevi", "de elevi"], ["hubshell.hm_daysAgo", "zile", "de zile"], ["hubfam.qzQuestions", "întrebări", "de întrebări"], ["hubfam.qzMarks", "puncte", "de puncte"], ["hubfam.qzStudents", "elevi", "de elevi"], ["hubmascot.streak", "zile", "de zile"], ["hubshell.hm_dayStreak", "zile", "de zile"], ["hublessons.tfCardsTotal", "cartonașe", "de cartonașe"]]) {
  for (const x of [2, 5, 19, 101, 119]) { const s = R("ro", base, x); eq(s.includes(` de ${noun.split(" ")[0]}`) || s.includes(`${x} de `), false, `ro ${base} n=${x} must NOT carry "de": ${s}`); eq(s.includes(String(x)), true, `ro ${base} n=${x} has number`); }
  for (const x of [20, 21, 25, 100]) { const s = R("ro", base, x); eq(new RegExp(`\\b${x} de\\b`).test(s), true, `ro ${base} n=${x} needs "de": ${s}`); }
}
eq(R("ro", "hubshell.hm_nStudents", 1), "1 elev", "ro 1 elev");
// ---- Polish: one / few (2-4, 22-24) / many (0, 5-21, 25...)
eq(R("pl", "hubshell.hm_nStudents", 1), "1 uczeń", "pl 1"); eq(R("pl", "hubshell.hm_nStudents", 2), "2 uczniów".replace("uczniów", HUB_AREAS.hubshell.pl.hm_nStudents_few.replace("{n} ", "")), "pl 2 uses few");
for (const base of ["hubshell.hm_nStudents", "hubshell.hm_daysAgo", "hubfam.qzQuestions", "hubfam.qzMarks", "hubmascot.streak", "hubshell.hm_dayStreak", "hublessons.fcCardsToReview"]) {
  for (const cat of ["one", "few", "many"]) { const k = base.split(".")[1] + "_" + cat; eq(HUB_AREAS[base.split(".")[0]].pl[k] !== undefined, true, `pl ${base} has _${cat}`); }
}
eq(R("pl", "hublessons.fcCardsToReview", 2), "karty do powtórki".replace("karty", "fiszki"), "pl fcCardsToReview 2 -> fiszki"); eq(R("pl", "hublessons.fcCardsToReview", 5), "fiszek do powtórki", "pl fcCardsToReview 5 -> fiszek"); eq(R("pl", "hubmascot.streak", 1), "1 dzień z rzędu!", "pl streak 1");
// ---- pt / es / fr: one vs other (fr: 0 and 1 are "one")
eq(R("pt", "hubmascot.streak", 1), "1 dia seguido!", "pt streak 1"); eq(R("pt", "hubmascot.streak", 5), "5 dias seguidos!", "pt streak 5");
eq(R("es", "hubmascot.streak", 1), "¡1 día seguido!", "es streak 1"); eq(R("es", "hubmascot.streak", 25), "¡25 días seguidos!", "es streak 25");
eq(R("fr", "hubmascot.streak", 1), "1 jour d’affilée !", "fr streak 1"); eq(R("fr", "hubmascot.streak", 21), "21 jours d’affilée !", "fr streak 21");
for (const loc of ["pt", "es", "fr"]) for (const x of NS) { const s = R(loc, "hubshell.hm_nStudents", x); eq(s.includes(String(x)) && !s.includes("{n}"), true, `${loc} hm_nStudents ${x}: ${s}`); }
// ---- every locale: every plural base resolves for every count without leaving a raw key or "{n}"
for (const loc of ["pl", "ro", "pt", "es", "fr", "ar", "cy", "en"]) for (const [ns, cat] of Object.entries(HUB_AREAS)) {
  const bases = new Set(Object.keys(cat[loc] || {}).filter((k) => /_(one|other)$/.test(k)).map((k) => k.replace(/_(one|other)$/, "")));
  for (const b of bases) for (const x of [0, 1, 2, 3, 5, 11, 20, 21, 25, 100, 101]) { const s = R(loc, `${ns}.${b}`, x); if (s.startsWith(`${ns}.`) || /\{n\}/.test(s)) { n++; bad++; console.log(`FAIL ${loc} ${ns}.${b} n=${x}: ${s}`); } }
}
// ---- chain fallback: a locale that lacks few/many/two falls back sensibly (many>other, few>many>other, two>few>other)
const fake = (m) => (k) => (k in m ? m[k] : k);
eq(pickPlural(fake({ a_other: "O", a_one: "1" }), "ro", "a", 5), "O", "ro few missing -> other");
eq(pickPlural(fake({ a_other: "O", a_many: "M" }), "pl", "a", 3), "M", "pl few missing -> many");
eq(pickPlural(fake({ a_other: "O", a_few: "F" }), "ar", "a", 2), "F", "ar two missing -> few");
eq(pickPlural(fake({ a_other: "O", a_two: "T", a_zero: "Z" }), "ar", "a", 0), "Z", "ar zero");
eq(pickPlural(fake({ a_other: "O", a_two: "T" }), "cy", "a", 2), "T", "cy two");
eq(pickPlural(fake({ a_other: "O" }), "cy", "a", 6), "O", "cy many missing -> other");
eq(pluralChain("xx-invalid-locale-zzz", 3)[0], "other", "invalid locale -> other");

// ---- ar / cy / pa / bn / ur (added with the native-level review of those locales, docs/reviews/critic-i18n-other.md)
// Counts that hit every CLDR category: ar 0=zero 1=one 2=two 3-10=few 11-99=many 100=other; cy 0=zero 1=one 2=two 3=few 6=many 4/5=other; pa/bn/ur: one|other.
const NS2 = [0, 1, 2, 3, 5, 11, 20, 21, 100, 101];
const NOT_PLURALS = new Set(["hublive.aCd", "hubtoolsb.sc_eqt", "hubtoolsb.sc_dt"]); // "_other"/"_zero" here mean "Other"/"axes at 0", not plural forms
for (const loc of ["ar", "cy", "pa", "bn", "ur"]) for (const [ns, cat] of Object.entries(HUB_AREAS)) {
  const bases = new Set(Object.keys(cat[loc] || {}).filter((k) => /_(one|other)$/.test(k)).map((k) => k.replace(/_(one|other)$/, "")));
  for (const b of bases) { if (NOT_PLURALS.has(`${ns}.${b}`)) continue;
    for (const x of NS2) { const got = R(loc, `${ns}.${b}`, x); const bad2 = got.startsWith(`${ns}.`) || /\{n\}/.test(got) || got.trim() === ""; n++; if (bad2) { bad++; console.log(`FAIL ${loc} ${ns}.${b} n=${x}: ${JSON.stringify(got)}`); } }
  }
}
// Arabic: every plural group carries all six forms (label-style groups repeat one invariant text), so no count silently falls through the chain.
for (const [ns, cat] of Object.entries(HUB_AREAS)) {
  const bases = new Set(Object.keys(cat.ar || {}).filter((k) => /_other$/.test(k)).map((k) => k.replace(/_other$/, "")));
  for (const b of bases) { if (NOT_PLURALS.has(`${ns}.${b}`)) continue;
    for (const f of ["zero", "one", "two", "few", "many"]) { n++; if (cat.ar[`${b}_${f}`] === undefined) { bad++; console.log(`FAIL ar ${ns}.${b} lacks _${f}`); } } }
}
// Arabic noun agreement on a real group: 1 / 2 / 3-10 / 11-99 / 0 / 100 each pick their own form.
eq(R("ar", "hubshell.hm_nStudents", 0), "لا طلاب", "ar students 0"); eq(R("ar", "hubshell.hm_nStudents", 1), "طالب واحد", "ar students 1"); eq(R("ar", "hubshell.hm_nStudents", 2), "طالبان", "ar students 2");
eq(R("ar", "hubshell.hm_nStudents", 5), "5 طلاب", "ar students 5"); eq(R("ar", "hubshell.hm_nStudents", 11), "11 طالبًا", "ar students 11"); eq(R("ar", "hubshell.hm_nStudents", 100), "100 طالب", "ar students 100");
eq(R("ar", "hublessons.tfCardsTotal", 2), "بطاقتان", "ar cards 2"); eq(R("ar", "hublessons.tfCardsTotal", 11), "11 بطاقةً", "ar cards 11"); eq(R("ar", "hublessons.tfCardsTotal", 0), "لا بطاقات", "ar cards 0");
eq(R("ar", "hubmascot.streak", 1), "يوم واحد متتالٍ!", "ar streak 1"); eq(R("ar", "hubmascot.streak", 11), "11 يومًا متتاليًا!", "ar streak 11");
// Welsh: singular noun after every numeral; 2 mutates (dau ddisgybl)
eq(R("cy", "hubshell.hm_nStudents", 2).includes("ddisgybl") || R("cy", "hubshell.studentsCount", 2).includes("ddisgybl"), true, "cy 2 ddisgybl");
for (const x of [0, 1, 2, 3, 6, 11, 20]) { const s = R("cy", "hubshell.hm_nStudents", x); eq(s.includes("disgyblion"), false, `cy hm_nStudents ${x} keeps the singular after a numeral: ${s}`); }
// pa / bn / ur: two categories (one|other), every count resolves and carries the number
for (const loc of ["pa", "bn", "ur"]) for (const x of NS2) { const s = R(loc, "hubshell.hm_nStudents", x); eq(s.includes(String(x)) && !s.includes("{n}"), true, `${loc} hm_nStudents ${x}: ${s}`); }
console.log(`plurals: ${n} checks, ${bad} failed`); process.exit(bad ? 1 : 0);
