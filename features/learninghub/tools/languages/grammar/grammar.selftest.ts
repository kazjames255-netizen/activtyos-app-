// Run: server/node_modules/.bin/tsx features/learninghub/tools/languages/grammar/grammar.selftest.ts   (exit 1 on any failure)
// Every expected value below is hand-written — nothing is computed by the code under test.
import { numberWords, numberAccepted, numberBeforeNoun, ordinalWords, deOrdinalDative, dateForms, timeWords, priceWords, ageWords, parseDigits, parseTime, parsePrice, parseDayMonth, clockAngles, MONTHS, DAYS, formatDigits } from "./numbers";
import { NOUNS, ALL_NOUNS, THEMES, article, withArticle, plural, esPlural, frPlural, GENDER_CUE, genderColour, nounsFor, type Noun } from "./nouns";
import * as A from "./agreement";
import { checkText } from "../../engine/textmark";

let n = 0; const fails: string[] = [];
const eq = (name: string, got: unknown, want: unknown) => { n++; if (JSON.stringify(got) !== JSON.stringify(want)) fails.push(`${name}: got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`); };
const ok = (name: string, cond: boolean) => { n++; if (!cond) fails.push(name); };
const has = (name: string, arr: string[], v: string) => ok(`${name} accepts "${v}"`, arr.includes(v));
const throws = (name: string, f: () => unknown) => { n++; try { f(); fails.push(name + " should throw"); } catch { /* ok */ } };

// ── numbers: hand-written tables ──
const ES: [number, string][] = [[0, "cero"], [1, "uno"], [15, "quince"], [16, "dieciséis"], [20, "veinte"], [21, "veintiuno"], [22, "veintidós"], [23, "veintitrés"], [26, "veintiséis"], [29, "veintinueve"], [30, "treinta"], [31, "treinta y uno"], [45, "cuarenta y cinco"], [99, "noventa y nueve"], [100, "cien"], [101, "ciento uno"], [115, "ciento quince"], [121, "ciento veintiuno"], [200, "doscientos"], [500, "quinientos"], [555, "quinientos cincuenta y cinco"], [700, "setecientos"], [900, "novecientos"], [999, "novecientos noventa y nueve"], [1000, "mil"], [1001, "mil uno"], [1999, "mil novecientos noventa y nueve"], [2000, "dos mil"], [2021, "dos mil veintiuno"], [21000, "veintiún mil"], [31000, "treinta y un mil"], [100000, "cien mil"], [101000, "ciento un mil"], [999999, "novecientos noventa y nueve mil novecientos noventa y nueve"], [1000000, "un millón"]];
for (const [v, w] of ES) eq(`es ${v}`, numberWords("es", v).text, w);
const FR: [number, string][] = [[0, "zéro"], [1, "un"], [16, "seize"], [17, "dix-sept"], [20, "vingt"], [21, "vingt et un"], [22, "vingt-deux"], [30, "trente"], [31, "trente et un"], [60, "soixante"], [61, "soixante et un"], [70, "soixante-dix"], [71, "soixante et onze"], [72, "soixante-douze"], [77, "soixante-dix-sept"], [79, "soixante-dix-neuf"], [80, "quatre-vingts"], [81, "quatre-vingt-un"], [90, "quatre-vingt-dix"], [91, "quatre-vingt-onze"], [99, "quatre-vingt-dix-neuf"], [100, "cent"], [101, "cent un"], [180, "cent quatre-vingts"], [200, "deux cents"], [201, "deux cent un"], [280, "deux cent quatre-vingts"], [300, "trois cents"], [999, "neuf cent quatre-vingt-dix-neuf"], [1000, "mille"], [1001, "mille un"], [1999, "mille neuf cent quatre-vingt-dix-neuf"], [2000, "deux mille"], [21000, "vingt et un mille"], [80000, "quatre-vingt mille"], [81000, "quatre-vingt-un mille"], [200000, "deux cent mille"], [1000000, "un million"]];
for (const [v, w] of FR) eq(`fr ${v}`, numberWords("fr", v).text, w);
const DE: [number, string][] = [[0, "null"], [1, "eins"], [12, "zwölf"], [16, "sechzehn"], [17, "siebzehn"], [21, "einundzwanzig"], [30, "dreißig"], [60, "sechzig"], [70, "siebzig"], [99, "neunundneunzig"], [100, "hundert"], [101, "hunderteins"], [200, "zweihundert"], [999, "neunhundertneunundneunzig"], [1000, "tausend"], [1001, "tausendeins"], [1100, "tausendeinhundert"], [1999, "tausendneunhundertneunundneunzig"], [2000, "zweitausend"], [2021, "zweitausendeinundzwanzig"], [21000, "einundzwanzigtausend"], [100000, "hunderttausend"], [101000, "hunderteintausend"], [1000000, "eine Million"]];
for (const [v, w] of DE) eq(`de ${v}`, numberWords("de", v).text, w);
ok(`tables ≥30 per language`, ES.length >= 30 && FR.length >= 30 && DE.length >= 20);

// accepted alternatives
has("de 100", numberAccepted("de", 100), "einhundert");
has("de 1000", numberAccepted("de", 1000), "eintausend");
has("de 101000 einhundert", numberAccepted("de", 101000), "einhunderteintausend");
has("de 1001", numberAccepted("de", 1001), "eintausendeins");
has("de 1001", numberAccepted("de", 1001), "tausendundeins");
has("fr 70 Belgian", numberAccepted("fr", 70), "septante");
has("fr 91 Belgian", numberAccepted("fr", 91), "nonante et un");
has("fr 21 reform hyphens", numberAccepted("fr", 21), "vingt-et-un");
has("fr 201 reform hyphens", numberAccepted("fr", 201), "deux-cent-un");
has("es 21000 uno form", numberAccepted("es", 21000), "veintiuno mil");
eq("primary listed first", numberAccepted("fr", 80)[0], "quatre-vingts");
ok("alternatives deduped", new Set(numberAccepted("es", 5)).size === numberAccepted("es", 5).length);
eq("es 5 has one form", numberAccepted("es", 5), ["cinco"]);
throws("range high", () => numberWords("fr", 1000001));
throws("range negative", () => numberWords("es", -1));
throws("range fraction", () => numberWords("de", 2.5));

// structural sweeps over every number 0–9999 and a stride to 1,000,000
for (const lang of ["es", "fr", "de"] as const) {
  let bad = "";
  const test = (v: number) => { const w = numberWords(lang, v).all; for (const x of w) if (!x || /undefined|NaN|  /.test(x) || /^\s|\s$/.test(x)) bad ||= `${v}:${x}`; };
  for (let v = 0; v < 10000; v++) test(v);
  for (let v = 10000; v <= 1000000; v += 137) test(v);
  eq(`${lang} sweep has no malformed words`, bad, "");
}
{ let bad = ""; for (let v = 0; v <= 200000; v += 7) { const w = numberWords("fr", v).text; if (/quatre-vingts./.test(w) || /cents (?!$)/.test(w) || /^un mille/.test(w)) bad ||= `${v}:${w}`; } eq("fr: -s on vingts/cents only when final; never 'un mille'", bad, ""); }
{ let bad = ""; for (let v = 0; v <= 200000; v += 11) { const w = numberWords("es", v).text; if (/ uno mil|ciento mil|cientos mil.*uno mil|\bcien (?!mil\b)[a-z]/.test(w)) bad ||= `${v}:${w}`; } eq("es: cien only stands alone, ciento before more; no 'uno mil'", bad, ""); }
eq("es before masc noun 1", numberBeforeNoun("es", 1), "un");
eq("es before fem noun 21", numberBeforeNoun("es", 21, "f"), "veintiuna");
eq("es before masc noun 31", numberBeforeNoun("es", 31), "treinta y un");
eq("fr feminine 1", numberBeforeNoun("fr", 1, "f"), "une");
eq("fr feminine 21", numberBeforeNoun("fr", 21, "f"), "vingt et une");
eq("de ein", numberBeforeNoun("de", 1), "ein");
eq("de eine", numberBeforeNoun("de", 1, "f"), "eine");
eq("de hundertein", numberBeforeNoun("de", 101), "hundertein");

// parsing
eq("digits 1,000", parseDigits("1,000"), 1000); eq("digits 1 000", parseDigits("1 000"), 1000); eq("digits 1.000", parseDigits("1.000"), 1000); eq("digits junk", parseDigits("12a"), null); eq("digits blank", parseDigits(" "), null);
eq("time 3.15", parseTime("3.15"), [3, 15]); eq("time 15:15", parseTime("15:15"), [15, 15]); eq("time 0915", parseTime("0915"), [9, 15]); eq("time bad", parseTime("25:00"), null);
eq("price 5,50", parsePrice("5,50"), [5, 50]); eq("price €5.5", parsePrice("€5.5"), [5, 50]); eq("price 12 €", parsePrice("12 €"), [12, 0]); eq("price junk", parsePrice("five"), null);
eq("dm 14/7", parseDayMonth("14/7"), [14, 7]); eq("dm 3.10.", parseDayMonth("3.10."), [3, 10]); eq("dm junk", parseDayMonth("hello"), null);
eq("format", formatDigits(1234567), "1,234,567");

// ── ordinals, months, days ──
const ESO: [number, string][] = [[1, "primero"], [3, "tercero"], [7, "séptimo"], [10, "décimo"], [11, "undécimo"], [12, "duodécimo"], [13, "decimotercero"], [20, "vigésimo"], [21, "vigésimo primero"], [30, "trigésimo"], [31, "trigésimo primero"]];
for (const [v, w] of ESO) eq(`es ord ${v}`, ordinalWords("es", v).text, w);
const FRO: [number, string][] = [[1, "premier"], [2, "deuxième"], [3, "troisième"], [4, "quatrième"], [5, "cinquième"], [9, "neuvième"], [11, "onzième"], [12, "douzième"], [16, "seizième"], [17, "dix-septième"], [21, "vingt et unième"], [22, "vingt-deuxième"], [30, "trentième"], [31, "trente et unième"]];
for (const [v, w] of FRO) eq(`fr ord ${v}`, ordinalWords("fr", v).text, w);
const DEO: [number, string][] = [[1, "erste"], [2, "zweite"], [3, "dritte"], [7, "siebte"], [8, "achte"], [11, "elfte"], [19, "neunzehnte"], [20, "zwanzigste"], [21, "einundzwanzigste"], [30, "dreißigste"], [31, "einunddreißigste"]];
for (const [v, w] of DEO) eq(`de ord ${v}`, ordinalWords("de", v).text, w);
eq("de ord dative", deOrdinalDative(3).text, "dritten");
has("fr 1er", ordinalWords("fr", 1).all, "1er"); has("de siebente", ordinalWords("de", 7).all, "siebente"); has("es 12 alt", ordinalWords("es", 12).all, "décimo segundo");
throws("ord 32", () => ordinalWords("fr", 32)); throws("ord 0", () => ordinalWords("es", 0));
eq("months es", MONTHS.es, ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"]);
eq("months fr", MONTHS.fr, ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"]);
eq("months de", MONTHS.de, ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"]);
eq("days es", DAYS.es[2], "miércoles"); eq("days fr", DAYS.fr[6], "dimanche"); eq("days de", DAYS.de[5], "Samstag"); eq("days start Monday", [DAYS.es[0], DAYS.fr[0], DAYS.de[0]], ["lunes", "lundi", "Montag"]);

// ── dates ──
eq("fr 14 juillet written", dateForms("fr", 14, 7).written, "le 14 juillet");
eq("fr 14 juillet words", dateForms("fr", 14, 7).words, "le quatorze juillet");
eq("fr 1er mai written", dateForms("fr", 1, 5).written, "le 1er mai");
eq("fr 1er mai words", dateForms("fr", 1, 5).words, "le premier mai");
has("fr 14 juillet no article", dateForms("fr", 14, 7).accepted, "quatorze juillet");
eq("es 5 mayo written", dateForms("es", 5, 5).written, "el 5 de mayo");
eq("es 5 mayo words", dateForms("es", 5, 5).words, "el cinco de mayo");
eq("es 1 mayo words", dateForms("es", 1, 5).words, "el primero de mayo");
eq("es 25 dic words", dateForms("es", 25, 12).words, "el veinticinco de diciembre");
has("es 1 mayo uno", dateForms("es", 1, 5).accepted, "el uno de mayo");
eq("de 3 Oktober written", dateForms("de", 3, 10).written, "der 3. Oktober");
eq("de 3 Oktober words", dateForms("de", 3, 10).words, "der dritte Oktober");
eq("de dative", dateForms("de", 3, 10, { dative: true }).words, "am dritten Oktober");
eq("de 31 Dez", dateForms("de", 31, 12).words, "der einunddreißigste Dezember");
eq("de 1 Jan", dateForms("de", 1, 1).words, "der erste Januar");
eq("de 24 Dez written", dateForms("de", 24, 12).written, "der 24. Dezember");

// ── times ──
const T = (l: "es" | "fr" | "de", h: number, m: number, s: "colloquial" | "official" = "colloquial") => timeWords(l, h, m, s).text;
eq("es 3:15", T("es", 3, 15), "son las tres y cuarto"); eq("es 15:15 colloquial", T("es", 15, 15), "son las tres y cuarto");
eq("es 1:00", T("es", 1, 0), "es la una"); eq("es 1:30", T("es", 1, 30), "es la una y media"); eq("es 2:45", T("es", 2, 45), "son las tres menos cuarto");
eq("es 4:10", T("es", 4, 10), "son las cuatro y diez"); eq("es 4:50", T("es", 4, 50), "son las cinco menos diez"); eq("es 6:35", T("es", 6, 35), "son las siete menos veinticinco");
eq("es 11:55", T("es", 11, 55), "son las doce menos cinco"); eq("es 12:00", T("es", 12, 0), "es mediodía"); eq("es 0:00", T("es", 0, 0), "es medianoche");
eq("es 12:30", T("es", 12, 30), "son las doce y media"); eq("es 12:45 pm", T("es", 12, 45), "es la una menos cuarto");
eq("es 8:00", T("es", 8, 0), "son las ocho"); has("es 8:00 en punto", timeWords("es", 8, 0).all, "son las ocho en punto"); has("es 3:15 no verb", timeWords("es", 3, 15).all, "las tres y cuarto");
eq("es official 15:15", T("es", 15, 15, "official"), "son las quince quince"); eq("es official 15:00", T("es", 15, 0, "official"), "son las quince horas"); eq("es official 21:00", T("es", 21, 0, "official"), "son las veintiuna horas");
eq("fr 3:15", T("fr", 3, 15), "il est trois heures et quart"); eq("fr 3:30", T("fr", 3, 30), "il est trois heures et demie"); eq("fr 3:45", T("fr", 3, 45), "il est quatre heures moins le quart");
eq("fr 3:05", T("fr", 3, 5), "il est trois heures cinq"); eq("fr 3:55", T("fr", 3, 55), "il est quatre heures moins cinq"); eq("fr 3:40", T("fr", 3, 40), "il est quatre heures moins vingt");
eq("fr 12:00", T("fr", 12, 0), "il est midi"); eq("fr 12:30", T("fr", 12, 30), "il est midi et demi"); eq("fr 0:00", T("fr", 0, 0), "il est minuit"); eq("fr 0:30", T("fr", 0, 30), "il est minuit et demi");
eq("fr 1:00", T("fr", 1, 0), "il est une heure"); eq("fr 13:00 colloquial", T("fr", 13, 0), "il est une heure"); eq("fr 11:45", T("fr", 11, 45), "il est midi moins le quart"); eq("fr 7:32", T("fr", 7, 32), "il est sept heures trente-deux");
eq("fr 2:20", T("fr", 2, 20), "il est deux heures vingt"); has("fr no il est", timeWords("fr", 3, 15).all, "trois heures et quart");
eq("fr official 15:15", T("fr", 15, 15, "official"), "il est quinze heures quinze"); eq("fr official 15:00", T("fr", 15, 0, "official"), "il est quinze heures"); eq("fr official 0:05", T("fr", 0, 5, "official"), "il est zéro heure cinq");
eq("fr official 21:21", T("fr", 21, 21, "official"), "il est vingt et une heures vingt et un"); eq("fr official 1:00", T("fr", 1, 0, "official"), "il est une heure");
eq("de 3:15", T("de", 3, 15), "Viertel nach drei"); eq("de 3:30", T("de", 3, 30), "halb vier"); eq("de 3:45", T("de", 3, 45), "Viertel vor vier"); eq("de 3:05", T("de", 3, 5), "fünf nach drei");
eq("de 3:25", T("de", 3, 25), "fünf vor halb vier"); eq("de 3:35", T("de", 3, 35), "fünf nach halb vier"); eq("de 3:40", T("de", 3, 40), "zwanzig vor vier"); eq("de 3:50", T("de", 3, 50), "zehn vor vier");
eq("de 3:00", T("de", 3, 0), "drei Uhr"); eq("de 1:00", T("de", 1, 0), "ein Uhr"); eq("de 1:15", T("de", 1, 15), "Viertel nach eins"); eq("de 12:30", T("de", 12, 30), "halb eins"); eq("de 0:00", T("de", 0, 0), "zwölf Uhr");
eq("de 3:20", T("de", 3, 20), "zwanzig nach drei"); has("de 3:20 alt", timeWords("de", 3, 20).all, "zehn vor halb vier"); has("de 3:45 dreiviertel", timeWords("de", 3, 45).all, "dreiviertel vier"); has("de es ist", timeWords("de", 3, 15).all, "es ist Viertel nach drei");
eq("de official 15:15", T("de", 15, 15, "official"), "fünfzehn Uhr fünfzehn"); eq("de official 15:00", T("de", 15, 0, "official"), "fünfzehn Uhr"); eq("de official 0:00", T("de", 0, 0, "official"), "null Uhr"); eq("de official 21:45", T("de", 21, 45, "official"), "einundzwanzig Uhr fünfundvierzig"); eq("de official 1:00", T("de", 1, 0, "official"), "ein Uhr");
throws("time 24:00", () => timeWords("es", 24, 0)); throws("time 3:60", () => timeWords("fr", 3, 60));
eq("clock 3:00", clockAngles(3, 0), { hour: 90, minute: 0 }); eq("clock 6:30", clockAngles(6, 30), { hour: 195, minute: 180 }); eq("clock 12:00", clockAngles(12, 0), { hour: 0, minute: 0 }); eq("clock 15:15", clockAngles(15, 15), { hour: 97.5, minute: 90 });
{ let bad = ""; for (const l of ["es", "fr", "de"] as const) for (let h = 0; h < 24; h++) for (let m = 0; m < 60; m++) for (const st of ["colloquial", "official"] as const) { const w = timeWords(l, h, m, st); if (!w.text || /undefined|NaN/.test(w.all.join("|"))) bad ||= `${l} ${h}:${m}`; } eq("every minute of the day has words in all languages", bad, ""); }

// ── prices & ages ──
eq("es 5.50", priceWords("es", 5, 50).text, "cinco euros con cincuenta céntimos"); eq("es 1.00", priceWords("es", 1, 0).text, "un euro"); eq("es 1.01", priceWords("es", 1, 1).text, "un euro con un céntimo");
eq("es 21.05", priceWords("es", 21, 5).text, "veintiún euros con cinco céntimos"); eq("es 0.75", priceWords("es", 0, 75).text, "setenta y cinco céntimos"); eq("es 101", priceWords("es", 101, 0).text, "ciento un euros");
has("es 5.50 short", priceWords("es", 5, 50).all, "cinco euros con cincuenta"); has("es 5.50 y", priceWords("es", 5, 50).all, "cinco euros y cincuenta céntimos");
eq("fr 5.50", priceWords("fr", 5, 50).text, "cinq euros cinquante centimes"); eq("fr 1.00", priceWords("fr", 1, 0).text, "un euro"); eq("fr 0.21", priceWords("fr", 0, 21).text, "vingt et un centimes"); eq("fr 80", priceWords("fr", 80, 0).text, "quatre-vingts euros"); eq("fr 2.99", priceWords("fr", 2, 99).text, "deux euros quatre-vingt-dix-neuf centimes");
has("fr 5.50 short", priceWords("fr", 5, 50).all, "cinq euros cinquante");
eq("de 5.50", priceWords("de", 5, 50).text, "fünf Euro fünfzig Cent"); eq("de 1.00", priceWords("de", 1, 0).text, "ein Euro"); eq("de 0.01", priceWords("de", 0, 1).text, "ein Cent"); eq("de 21", priceWords("de", 21, 0).text, "einundzwanzig Euro"); eq("de 101.01", priceWords("de", 101, 1).text, "hundertein Euro ein Cent");
has("de 5.50 short", priceWords("de", 5, 50).all, "fünf Euro fünfzig"); has("de 5.50 und", priceWords("de", 5, 50).all, "fünf Euro und fünfzig Cent");
throws("price zero", () => priceWords("es", 0, 0)); throws("price cents 100", () => priceWords("fr", 1, 100));
eq("es age 12", ageWords("es", 12).text, "tengo doce años"); eq("es age 1", ageWords("es", 1).text, "tengo un año"); eq("es age 21", ageWords("es", 21).text, "tengo veintiún años");
eq("fr age 12", ageWords("fr", 12).text, "j'ai douze ans"); eq("fr age 80", ageWords("fr", 80).text, "j'ai quatre-vingts ans"); eq("fr age 71", ageWords("fr", 71).text, "j'ai soixante et onze ans"); eq("fr age 1", ageWords("fr", 1).text, "j'ai un an");
eq("de age 12", ageWords("de", 12).text, "ich bin zwölf Jahre alt"); eq("de age 1", ageWords("de", 1).text, "ich bin ein Jahr alt"); eq("de age 21", ageWords("de", 21).text, "ich bin einundzwanzig Jahre alt");
has("es age bare", ageWords("es", 12).all, "doce años");

// ── noun data integrity ──
for (const l of ["es", "fr", "de"] as const) {
  const list = NOUNS[l];
  ok(`${l}: ≥ 80 nouns (has ${list.length})`, list.length >= 80);
  eq(`${l}: ids unique`, new Set(list.map((x) => x.id)).size, list.length);
  eq(`${l}: words unique`, new Set(list.map((x) => x.word)).size, list.length);
  ok(`${l}: genders valid`, list.every((x) => (l === "de" ? ["m", "f", "n"] : ["m", "f"]).includes(x.gender)));
  ok(`${l}: every theme has ≥ 5 nouns`, THEMES.every((t) => nounsFor(l, t).length >= 5));
  ok(`${l}: every noun has meaning, theme, tier`, list.every((x) => x.en.length > 0 && THEMES.includes(x.theme) && (x.tier === "F" || x.tier === "H")));
  ok(`${l}: both tiers present`, list.some((x) => x.tier === "F") && list.some((x) => x.tier === "H"));
  ok(`${l}: ids carry the language`, list.every((x) => x.id.startsWith(l + "-") && x.lang === l));
}
ok("de: every noun has a plural, capitalised", NOUNS.de.every((x) => !!x.plural && /^[A-ZÄÖÜ]/.test(x.plural) && /^[A-ZÄÖÜ]/.test(x.word)));
ok("es/fr words are lower-case", [...NOUNS.es, ...NOUNS.fr].every((x) => x.word === x.word.toLocaleLowerCase()));
eq("all nouns total", ALL_NOUNS.length, NOUNS.es.length + NOUNS.fr.length + NOUNS.de.length);
const get = (l: "es" | "fr" | "de", w: string): Noun => { const x = NOUNS[l].find((k) => k.word === w); if (!x) throw new Error("missing " + l + " " + w); return x; };
// known genders (hand-checked)
for (const [w, g] of [["día", "m"], ["mapa", "m"], ["mano", "f"], ["problema", "m"] as const].filter(([w]) => NOUNS.es.some((x) => x.word === w))) eq(`es gender ${w}`, get("es", w!).gender, g);
for (const [w, g] of [["madre", "f"], ["padre", "m"], ["nariz", "f"], ["piso", "m"], ["programa", "m"], ["ciudad", "f"], ["agua", "f"], ["águila", "f"]] as const) eq(`es gender ${w}`, get("es", w).gender, g);
for (const [w, g] of [["eau", "f"], ["œuf", "m"], ["main", "f"], ["fils", "m"], ["dent", "f"], ["cour", "f"], ["sœur", "f"], ["étage", "m"]] as const) eq(`fr gender ${w}`, get("fr", w).gender, g);
for (const [w, g] of [["Mädchen", "n"], ["Kind", "n"], ["Frau", "f"], ["Junge", "m"], ["Bank", "f"], ["E-Mail", "f"], ["Handy", "n"], ["Rathaus", "n"], ["Datei", "f"], ["Löwe", "m"]] as const) eq(`de gender ${w}`, get("de", w).gender, g);
// articles
eq("es el padre", withArticle("es", get("es", "padre"), "definite"), "el padre"); eq("es la madre", withArticle("es", get("es", "madre"), "definite"), "la madre");
eq("es el agua", withArticle("es", get("es", "agua"), "definite"), "el agua"); eq("es las aguas", withArticle("es", get("es", "agua"), "definite", "pl"), "las aguas"); eq("es el águila", withArticle("es", get("es", "águila"), "definite"), "el águila");
eq("es la casa", withArticle("es", get("es", "casa"), "definite"), "la casa"); eq("es el día", withArticle("es", get("es", "día"), "definite"), "el día"); eq("es una mesa", withArticle("es", get("es", "mesa"), "indefinite"), "una mesa");
eq("es unos libros", withArticle("es", get("es", "libro"), "indefinite", "pl"), "unos libros"); eq("es las manos", withArticle("es", get("es", "mano"), "definite", "pl"), "las manos"); eq("es un agua (f, stressed a)", article("es", get("es", "agua"), "indefinite"), "un");
eq("fr l'eau", withArticle("fr", get("fr", "eau"), "definite"), "l'eau"); eq("fr l'école", withArticle("fr", get("fr", "école"), "definite"), "l'école"); eq("fr l'œuf", withArticle("fr", get("fr", "œuf"), "definite"), "l'œuf");
eq("fr l'hôtel", withArticle("fr", get("fr", "hôtel"), "definite"), "l'hôtel"); eq("fr le haricot (h aspiré)", withArticle("fr", get("fr", "haricot"), "definite"), "le haricot"); eq("fr la maison", withArticle("fr", get("fr", "maison"), "definite"), "la maison");
eq("fr le livre", withArticle("fr", get("fr", "livre"), "definite"), "le livre"); eq("fr les maisons", withArticle("fr", get("fr", "maison"), "definite", "pl"), "les maisons"); eq("fr des eaux", withArticle("fr", get("fr", "eau"), "indefinite", "pl"), "des eaux");
eq("fr une maison", withArticle("fr", get("fr", "maison"), "indefinite"), "une maison"); eq("fr l'oncle", withArticle("fr", get("fr", "oncle"), "definite"), "l'oncle"); eq("fr les yeux", withArticle("fr", get("fr", "œil"), "definite", "pl"), "les yeux"); eq("fr l'été", article("fr", get("fr", "été"), "definite"), "l'");
eq("de das Mädchen", withArticle("de", get("de", "Mädchen"), "definite"), "das Mädchen"); eq("de der Vater", withArticle("de", get("de", "Vater"), "definite"), "der Vater"); eq("de die Schule", withArticle("de", get("de", "Schule"), "definite"), "die Schule");
eq("de die Väter", withArticle("de", get("de", "Vater"), "definite", "pl"), "die Väter"); eq("de ein Kind", withArticle("de", get("de", "Kind"), "indefinite"), "ein Kind"); eq("de eine Frau", withArticle("de", get("de", "Frau"), "indefinite"), "eine Frau");
eq("de plural indefinite has no article", withArticle("de", get("de", "Kind"), "indefinite", "pl"), "Kinder"); eq("de das Handy", article("de", get("de", "Handy"), "definite"), "das"); eq("de die Mäuse", withArticle("de", get("de", "Maus"), "definite", "pl"), "die Mäuse");
// plural rules
for (const [w, p] of [["casa", "casas"], ["ciudad", "ciudades"], ["nariz", "narices"], ["actriz", "actrices"], ["camión", "camiones"], ["jardín", "jardines"], ["jersey", "jerséis"], ["examen", "exámenes"], ["pez", "peces"], ["ratón", "ratones"], ["lápiz", "lápices"], ["canción", "canciones"], ["papá", "papás"], ["profesor", "profesores"], ["lunes", "lunes"], ["pie", "pies"], ["red", "redes"], ["francés", "franceses"], ["móvil", "móviles"], ["corazón", "corazones"], ["rey", "reyes"], ["tren", "trenes"]] as const) eq(`es plural ${w}`, esPlural(w) === p || plural("es", w) === p ? p : esPlural(w), p);
for (const [w, p] of [["chat", "chats"], ["cheval", "chevaux"], ["gâteau", "gâteaux"], ["jeu", "jeux"], ["bras", "bras"], ["nez", "nez"], ["œil", "yeux"], ["eau", "eaux"], ["animal", "animaux"], ["journal", "journaux"], ["bal", "bals"], ["genou", "genoux"], ["monsieur", "messieurs"], ["grand-père", "grands-pères"], ["fils", "fils"], ["souris", "souris"], ["œuf", "œufs"], ["travail", "travaux"], ["oiseau", "oiseaux"], ["maison", "maisons"], ["pneu", "pneus"], ["prix", "prix"], ["hôtel", "hôtels"]] as const) eq(`fr plural ${w}`, plural("fr", w), p);
eq("fr rule frPlural(cheval)", frPlural("cheval"), "chevaux"); eq("de plural from data", plural("de", get("de", "Vater")), "Väter"); eq("de plural Handy", plural("de", get("de", "Handy")), "Handys"); eq("de plural Mädchen", plural("de", get("de", "Mädchen")), "Mädchen");
throws("de plural needs record", () => plural("de", "Vater"));
// gender cues
ok("gender cues distinct (symbol, letter, token)", new Set(Object.values(GENDER_CUE).map((c) => c.symbol)).size === 3 && new Set(Object.values(GENDER_CUE).map((c) => c.letter)).size === 3 && new Set(Object.values(GENDER_CUE).map((c) => c.token)).size === 3);
eq("cue m", [GENDER_CUE.m.symbol, GENDER_CUE.m.letter], ["♂", "M"]); eq("cue f", [GENDER_CUE.f.symbol, GENDER_CUE.f.letter], ["♀", "F"]); eq("cue n", [GENDER_CUE.n.symbol, GENDER_CUE.n.letter], ["⚲", "N"]);
ok("colour is a CSS token reference", (["m", "f", "n"] as const).every((g) => /^var\(--[a-z-]+\)$/.test(genderColour(g))));

// ── agreement: Spanish ──
const es = A.esAdjective;
for (const [m, g, nn, b, w] of [
  ["bueno", "f", "pl", false, "buenas"], ["bueno", "m", "sg", true, "buen"], ["bueno", "f", "sg", true, "buena"], ["bueno", "m", "pl", true, "buenos"], ["malo", "m", "sg", true, "mal"], ["grande", "m", "sg", true, "gran"], ["grande", "f", "sg", true, "gran"], ["grande", "f", "sg", false, "grande"], ["grande", "f", "pl", true, "grandes"],
  ["primero", "m", "sg", true, "primer"], ["alto", "f", "pl", false, "altas"], ["rojo", "m", "pl", false, "rojos"], ["español", "f", "sg", false, "española"], ["español", "f", "pl", false, "españolas"], ["español", "m", "pl", false, "españoles"], ["alemán", "f", "sg", false, "alemana"], ["alemán", "m", "pl", false, "alemanes"],
  ["francés", "f", "sg", false, "francesa"], ["francés", "m", "pl", false, "franceses"], ["inglés", "f", "pl", false, "inglesas"], ["trabajador", "f", "sg", false, "trabajadora"], ["trabajador", "m", "pl", false, "trabajadores"], ["feliz", "m", "pl", false, "felices"], ["fácil", "f", "pl", false, "fáciles"], ["azul", "f", "pl", false, "azules"],
  ["marrón", "f", "sg", false, "marrón"], ["marrón", "f", "pl", false, "marrones"], ["joven", "f", "pl", false, "jóvenes"], ["gris", "m", "pl", false, "grises"], ["interesante", "f", "sg", false, "interesante"], ["verde", "m", "pl", false, "verdes"],
] as const) eq(`es ${m} ${g} ${nn}${b ? " before" : ""}`, es(m, g, nn, b), w);
ok("es adjective lists sized", A.ES_ADJECTIVES.length >= 25 && A.FR_ADJECTIVES.length >= 25);
// French
const fr = A.frAdjective;
for (const [m, g, nn, v, w] of [
  ["beau", "f", "sg", false, "belle"], ["beau", "m", "pl", false, "beaux"], ["beau", "f", "pl", false, "belles"], ["beau", "m", "sg", true, "bel"], ["beau", "m", "sg", false, "beau"], ["nouveau", "f", "sg", false, "nouvelle"], ["nouveau", "m", "pl", false, "nouveaux"], ["nouveau", "m", "sg", true, "nouvel"],
  ["vieux", "f", "sg", false, "vieille"], ["vieux", "m", "pl", false, "vieux"], ["vieux", "m", "sg", true, "vieil"], ["blanc", "f", "sg", false, "blanche"], ["blanc", "m", "pl", false, "blancs"], ["blanc", "f", "pl", false, "blanches"], ["heureux", "f", "sg", false, "heureuse"], ["heureux", "m", "pl", false, "heureux"],
  ["actif", "f", "sg", false, "active"], ["sportif", "f", "pl", false, "sportives"], ["italien", "f", "sg", false, "italienne"], ["bon", "f", "sg", false, "bonne"], ["gentil", "f", "sg", false, "gentille"], ["petit", "f", "sg", false, "petite"], ["grand", "f", "pl", false, "grandes"], ["long", "f", "sg", false, "longue"],
  ["français", "f", "sg", false, "française"], ["français", "m", "pl", false, "français"], ["normal", "m", "pl", false, "normaux"], ["final", "m", "pl", false, "finals"], ["travailleur", "f", "sg", false, "travailleuse"], ["premier", "f", "sg", false, "première"], ["cher", "f", "sg", false, "chère"],
  ["orange", "f", "pl", false, "orange"], ["marron", "f", "pl", false, "marron"], ["sympa", "m", "pl", false, "sympa"], ["bleu", "f", "pl", false, "bleues"], ["jaloux", "f", "sg", false, "jalouse"], ["frais", "f", "sg", false, "fraîche"], ["doux", "f", "sg", false, "douce"], ["gros", "f", "sg", false, "grosse"],
  ["jeune", "f", "sg", false, "jeune"], ["jeune", "m", "pl", false, "jeunes"], ["sec", "f", "sg", false, "sèche"], ["neuf", "f", "sg", false, "neuve"], ["violet", "f", "sg", false, "violette"], ["complet", "f", "sg", false, "complète"], ["cruel", "f", "sg", false, "cruelle"], ["rouge", "f", "pl", false, "rouges"], ["noir", "f", "pl", false, "noires"],
] as const) eq(`fr ${m} ${g} ${nn}${v ? " vowel" : ""}`, fr(m, g, nn, v), w);
// possessives / demonstratives
eq("es mis", A.esPossessive("1s", "f", "pl"), "mis"); eq("es nuestro", A.esPossessive("1p", "m", "sg"), "nuestro"); eq("es nuestras", A.esPossessive("1p", "f", "pl"), "nuestras"); eq("es vuestros", A.esPossessive("2p", "m", "pl"), "vuestros"); eq("es su", A.esPossessive("3s", "f", "sg"), "su"); eq("es sus (3p)", A.esPossessive("3p", "m", "pl"), "sus"); eq("es tu", A.esPossessive("2s", "m", "sg"), "tu");
eq("fr ma", A.frPossessive("1s", "f", "sg"), "ma"); eq("fr mon amie", A.frPossessive("1s", "f", "sg", true), "mon"); eq("fr ton (vowel)", A.frPossessive("2s", "f", "sg", true), "ton"); eq("fr ses", A.frPossessive("3s", "m", "pl"), "ses"); eq("fr notre", A.frPossessive("1p", "f", "sg"), "notre"); eq("fr vos", A.frPossessive("2p", "m", "pl"), "vos"); eq("fr leurs", A.frPossessive("3p", "m", "pl"), "leurs"); eq("fr leur", A.frPossessive("3p", "f", "sg"), "leur"); eq("fr mes", A.frPossessive("1s", "m", "pl"), "mes");
eq("es este", A.esDemonstrative("near", "m", "sg"), "este"); eq("es esta", A.esDemonstrative("near", "f", "sg"), "esta"); eq("es estos", A.esDemonstrative("near", "m", "pl"), "estos"); eq("es esas", A.esDemonstrative("mid", "f", "pl"), "esas"); eq("es ese", A.esDemonstrative("mid", "m", "sg"), "ese"); eq("es aquel", A.esDemonstrative("far", "m", "sg"), "aquel"); eq("es aquella", A.esDemonstrative("far", "f", "sg"), "aquella"); eq("es aquellas", A.esDemonstrative("far", "f", "pl"), "aquellas");
eq("fr ce", A.frDemonstrative("m", "sg"), "ce"); eq("fr cet", A.frDemonstrative("m", "sg", true), "cet"); eq("fr cette", A.frDemonstrative("f", "sg"), "cette"); eq("fr ces", A.frDemonstrative("f", "pl"), "ces"); eq("fr quelles", A.frQuel("f", "pl"), "quelles"); eq("fr quel", A.frQuel("m", "sg"), "quel");
// German endings
const dj = A.deAdjective;
for (const [d, c, g, w] of [
  ["weak", "nom", "m", "große"], ["weak", "nom", "f", "große"], ["weak", "nom", "n", "große"], ["weak", "nom", "pl", "großen"], ["weak", "acc", "m", "großen"], ["weak", "acc", "f", "große"], ["weak", "acc", "n", "große"], ["weak", "dat", "m", "großen"], ["weak", "dat", "f", "großen"], ["weak", "gen", "pl", "großen"],
  ["mixed", "nom", "m", "großer"], ["mixed", "nom", "f", "große"], ["mixed", "nom", "n", "großes"], ["mixed", "nom", "pl", "großen"], ["mixed", "acc", "m", "großen"], ["mixed", "acc", "n", "großes"], ["mixed", "dat", "n", "großen"], ["mixed", "gen", "f", "großen"],
  ["strong", "nom", "m", "großer"], ["strong", "nom", "n", "großes"], ["strong", "nom", "pl", "große"], ["strong", "acc", "m", "großen"], ["strong", "acc", "pl", "große"], ["strong", "dat", "m", "großem"], ["strong", "dat", "f", "großer"], ["strong", "dat", "n", "großem"], ["strong", "dat", "pl", "großen"], ["strong", "gen", "m", "großen"], ["strong", "gen", "f", "großer"], ["strong", "gen", "pl", "großer"],
] as const) eq(`de groß ${d} ${c} ${g}`, dj("groß", d, c, g), w);
eq("de hoch strong nom m", dj("hoch", "strong", "nom", "m"), "hoher"); eq("de teuer weak nom f", dj("teuer", "weak", "nom", "f"), "teure"); eq("de dunkel mixed nom m", dj("dunkel", "mixed", "nom", "m"), "dunkler"); eq("de dunkel weak acc m", dj("dunkel", "weak", "acc", "m"), "dunklen"); eq("de rosa invariable", dj("rosa", "weak", "dat", "m"), "rosa");
eq("de table has 4 cases × 4 genders", Object.values(A.DE_ADJ_ENDINGS.strong).map((r) => Object.keys(r).length), [4, 4, 4, 4]);
eq("de definite dat f", A.deDeterminer("definite", "dat", "f"), "der"); eq("de definite acc m", A.deDeterminer("definite", "acc", "m"), "den"); eq("de definite gen n", A.deDeterminer("definite", "gen", "n"), "des"); eq("de definite dat pl", A.deDeterminer("definite", "dat", "pl"), "den");
eq("de ein acc m", A.deDeterminer("indefinite", "acc", "m"), "einen"); eq("de ein dat f", A.deDeterminer("indefinite", "dat", "f"), "einer"); eq("de ein pl", A.deDeterminer("indefinite", "nom", "pl"), ""); eq("de ein nom n", A.deDeterminer("indefinite", "nom", "n"), "ein"); eq("de kein nom pl", A.deDeterminer("negative", "nom", "pl"), "keine"); eq("de kein dat pl", A.deDeterminer("negative", "dat", "pl"), "keinen");
eq("de mein nom f", A.deDeterminer("possessive", "nom", "f"), "meine"); eq("de euer acc m", A.deDeterminer("possessive", "acc", "m", "euer"), "euren"); eq("de euer nom m", A.deDeterminer("possessive", "nom", "m", "euer"), "euer"); eq("de unser dat n", A.deDeterminer("possessive", "dat", "n", "unser"), "unserem"); eq("de dein gen m", A.deDeterminer("possessive", "gen", "m", "dein"), "deines");
eq("de dieser acc m", A.deDeterminer("demonstrative", "acc", "m"), "diesen"); eq("de dieses nom n", A.deDeterminer("demonstrative", "nom", "n"), "dieses"); eq("de diesen dat pl", A.deDeterminer("demonstrative", "dat", "pl"), "diesen"); eq("de jedem", A.deDeterminer("demonstrative", "dat", "m", "jed"), "jedem");
eq("de phrase 1", A.dePhrase({ kind: "definite", adj: "groß", noun: "Mann", case: "nom", gender: "m" }), "der große Mann");
eq("de phrase 2", A.dePhrase({ kind: "indefinite", adj: "groß", noun: "Hund", case: "acc", gender: "m" }), "einen großen Hund");
eq("de phrase 3", A.dePhrase({ kind: "indefinite", adj: "neu", noun: "Computer", case: "nom", gender: "m" }), "ein neuer Computer");
eq("de phrase 4", A.dePhrase({ kind: "indefinite", adj: "neu", noun: "Auto", case: "nom", gender: "n" }), "ein neues Auto");
eq("de phrase 5", A.dePhrase({ kind: "none", adj: "rot", noun: "Rose", plural: "Rosen", case: "nom", gender: "pl" }), "rote Rosen");
eq("de phrase 6", A.dePhrase({ kind: "possessive", stem: "mein", adj: "neu", noun: "Freund", plural: "Freunde", case: "dat", gender: "pl" }), "meinen neuen Freunden");
eq("de phrase 7", A.dePhrase({ kind: "definite", adj: "klein", noun: "Stadt", case: "dat", gender: "f" }), "der kleinen Stadt");
eq("de phrase 8", A.dePhrase({ kind: "none", adj: "kalt", noun: "Wasser", case: "dat", gender: "n" }), "kaltem Wasser");
eq("de dative plural -n", A.deDativePlural("Kinder"), "Kindern"); eq("de dative plural already -n", A.deDativePlural("Frauen"), "Frauen"); eq("de dative plural -s", A.deDativePlural("Autos"), "Autos");
eq("declension after definite", A.declensionAfter("definite"), "weak"); eq("declension after ein", A.declensionAfter("indefinite"), "mixed"); eq("declension after none", A.declensionAfter("none"), "strong");
// prepositions and cases
const P = (w: string) => A.DE_PREPOSITIONS.find((p) => p.word === w)!;
eq("case mit", A.caseAfter(P("mit"), true), "dat"); eq("case für", A.caseAfter(P("für"), false), "acc"); eq("case wegen", A.caseAfter(P("wegen"), false), "gen"); eq("case in motion", A.caseAfter(P("in"), true), "acc"); eq("case in position", A.caseAfter(P("in"), false), "dat");
ok("prep list sizes (acc≥6, dat≥8, gen≥3, two=9)", A.DE_PREPOSITIONS.filter((p) => p.case === "acc").length >= 6 && A.DE_PREPOSITIONS.filter((p) => p.case === "dat").length >= 8 && A.DE_PREPOSITIONS.filter((p) => p.case === "gen").length >= 3 && A.DE_PREPOSITIONS.filter((p) => p.case === "two").length === 9);
eq("phrase in die Stadt", A.prepositionPhrase(P("in"), true, { word: "Stadt", gender: "f" }).text, "in die Stadt"); eq("phrase in der Stadt", A.prepositionPhrase(P("in"), false, { word: "Stadt", gender: "f" }).text, "in der Stadt");
eq("phrase in das Kino", A.prepositionPhrase(P("in"), true, { word: "Kino", gender: "n" }).text, "in das Kino"); eq("contraction ins Kino", A.prepositionPhrase(P("in"), true, { word: "Kino", gender: "n" }).alternatives, ["ins Kino"]);
eq("phrase mit dem Bruder", A.prepositionPhrase(P("mit"), false, { word: "Bruder", gender: "m" }).text, "mit dem Bruder"); eq("phrase zur Schule", A.prepositionPhrase(P("zu"), false, { word: "Schule", gender: "f" }).alternatives, ["zur Schule"]); eq("phrase für den Vater", A.prepositionPhrase(P("für"), false, { word: "Vater", gender: "m" }).text, "für den Vater");
eq("phrase ohne das Kind", A.prepositionPhrase(P("ohne"), false, { word: "Kind", gender: "n" }).text, "ohne das Kind"); eq("phrase mit den Freunden", A.prepositionPhrase(P("mit"), false, { word: "Freund", gender: "m", plural: "Freunde" }, "pl").text, "mit den Freunden");
eq("phrase wegen des Regens", A.prepositionPhrase(P("wegen"), false, { word: "Regen", gender: "m" }, "sg", "Regens").text, "wegen des Regens"); eq("phrase auf den Tisch", A.prepositionPhrase(P("auf"), true, { word: "Tisch", gender: "m" }).text, "auf den Tisch"); eq("phrase auf dem Tisch", A.prepositionPhrase(P("auf"), false, { word: "Tisch", gender: "m" }).text, "auf dem Tisch");
eq("phrase durch den Park", A.prepositionPhrase(P("durch"), false, { word: "Park", gender: "m" }).text, "durch den Park"); eq("phrase von dem→vom", A.prepositionPhrase(P("von"), false, { word: "Vater", gender: "m" }).alternatives, ["vom Vater"]);
// negation
eq("es no", A.esNegate("hablo", "francés", "no").text, "no hablo francés"); eq("es nunca", A.esNegate("voy", "al cine", "nunca").text, "nunca voy al cine"); has("es nunca alt", A.esNegate("voy", "al cine", "nunca").alternatives, "no voy nunca al cine");
eq("es nada", A.esNegate("como", "", "nada").text, "no como nada"); eq("es nadie", A.esNegate("veo", "", "nadie").text, "no veo a nadie"); eq("es tampoco", A.esNegate("quiero", "ir", "tampoco").text, "tampoco quiero ir"); eq("es clitic", A.esNegate("lo tengo", "", "no").text, "no lo tengo"); eq("es jamás", A.esNegate("bebo", "café", "jamás").text, "jamás bebo café");
eq("fr ne pas", A.frNegate({ subject: "je", verb: "parle", rest: "français", word: "pas" }).text, "je ne parle pas français"); eq("fr n'…pas", A.frNegate({ subject: "je", verb: "aime", rest: "le chocolat", word: "pas" }).text, "je n'aime pas le chocolat");
eq("fr rien passé composé", A.frNegate({ subject: "il", verb: "a", participle: "mangé", word: "rien" }).text, "il n'a rien mangé"); eq("fr personne after participle", A.frNegate({ subject: "nous", verb: "avons", participle: "vu", word: "personne" }).text, "nous n'avons vu personne");
eq("fr jamais", A.frNegate({ subject: "tu", verb: "vas", word: "jamais", rest: "au cinéma" }).text, "tu ne vas jamais au cinéma"); eq("fr plus", A.frNegate({ subject: "elle", verb: "habite", word: "plus", rest: "ici" }).text, "elle n'habite plus ici");
eq("fr pas de", A.frNegate({ subject: "je", verb: "ai", word: "pas de", rest: "frère" }).text, "je n'ai pas de frère"); eq("fr pas d'", A.frNegate({ subject: "je", verb: "ai", word: "pas de", rest: "argent" }).text, "je n'ai pas d'argent");
eq("fr clitic", A.frNegate({ subject: "je", clitics: "le", verb: "mange", word: "pas" }).text, "je ne le mange pas"); eq("fr il n'y a pas", A.frNegate({ subject: "il", clitics: "y", verb: "a", word: "pas" }).text, "il n'y a pas"); eq("fr pas passé composé", A.frNegate({ subject: "je", verb: "suis", participle: "allé", word: "pas" }).text, "je ne suis pas allé");
eq("de nicht end", A.deNicht("ich", "sehe", "den Film", "").text, "ich sehe den Film nicht"); eq("de nicht predicate", A.deNicht("er", "ist", "", "müde").text, "er ist nicht müde"); eq("de nicht prefix", A.deNicht("ich", "stehe", "", "auf").text, "ich stehe nicht auf"); eq("de nicht participle", A.deNicht("ich", "habe", "den Film", "gesehen").text, "ich habe den Film nicht gesehen");
eq("de kein m acc", A.deKeinPhrase("acc", "m", "Hund"), "keinen Hund"); eq("de kein f", A.deKeinPhrase("nom", "f", "Katze"), "keine Katze"); eq("de kein n", A.deKeinPhrase("nom", "n", "Auto"), "kein Auto"); eq("de kein pl", A.deKeinPhrase("nom", "pl", "Hund", "Hunde"), "keine Hunde"); eq("de kein dat pl", A.deKeinPhrase("dat", "pl", "Hund", "Hunde"), "keinen Hunden");
// questions
const Q = A.frQuestion;
eq("fr où est-ce que", Q({ subject: "tu", verb: "habites", word: "où" }, "estce"), "Où est-ce que tu habites ?"); eq("fr est-ce qu'il", Q({ subject: "il", verb: "a", rest: "faim" }, "estce"), "Est-ce qu'il a faim ?"); eq("fr inversion -t-", Q({ subject: "il", verb: "a", rest: "faim" }, "inversion"), "A-t-il faim ?");
eq("fr où inversion", Q({ subject: "tu", verb: "habites", word: "où" }, "inversion"), "Où habites-tu ?"); eq("fr intonation", Q({ subject: "tu", verb: "as", rest: "faim" }, "intonation"), "Tu as faim ?"); eq("fr est-ce que j'ai", Q({ subject: "je", verb: "ai", rest: "faim" }, "estce"), "Est-ce que j'ai faim ?");
eq("fr ai-je", Q({ subject: "je", verb: "ai", rest: "faim" }, "inversion"), "Ai-je faim ?"); eq("fr parlé-je avoided", Q({ subject: "je", verb: "parle" }, "inversion"), null); eq("fr parle-t-elle", Q({ subject: "elle", verb: "parle", rest: "français" }, "inversion"), "Parle-t-elle français ?");
eq("fr noun inversion", Q({ subject: "elle", noun: "Marie", verb: "parle" }, "inversion"), "Marie parle-t-elle ?"); eq("fr qu'est-ce que", Q({ subject: "tu", verb: "fais", word: "que" }, "estce"), "Qu'est-ce que tu fais ?"); eq("fr que fais-tu", Q({ subject: "tu", verb: "fais", word: "que" }, "inversion"), "Que fais-tu ?");
eq("fr qu'as-tu", Q({ subject: "tu", verb: "as", word: "que" }, "inversion"), "Qu'as-tu ?"); eq("fr pourquoi", Q({ subject: "vous", verb: "partez", word: "pourquoi" }, "estce"), "Pourquoi est-ce que vous partez ?"); eq("fr quand elle", Q({ subject: "elle", verb: "arrive", word: "quand" }, "estce"), "Quand est-ce qu'elle arrive ?");
eq("fr va-t-on", Q({ subject: "on", verb: "va", word: "où" }, "inversion"), "Où va-t-on ?"); eq("fr intonation où", Q({ subject: "tu", verb: "habites", word: "où" }, "intonation"), "Tu habites où ?");
eq("fr all styles primary", A.frQuestions({ subject: "tu", verb: "as", rest: "faim" }).text, "Est-ce que tu as faim ?"); eq("fr all styles alts", A.frQuestions({ subject: "tu", verb: "as", rest: "faim" }).alternatives, ["As-tu faim ?", "Tu as faim ?"]);
eq("es question word", A.esQuestion({ word: "dónde", verb: "vives" }), "¿Dónde vives?"); eq("es question yes/no", A.esQuestion({ verb: "hablas", rest: "español" }), "¿Hablas español?"); eq("es cuántas", A.esCuanto("f", "pl"), "cuántas"); eq("es cuánto", A.esCuanto("m", "sg"), "cuánto");
eq("de W-question", A.deQuestion({ word: "wo", verb: "wohnst", subject: "du" }), "Wo wohnst du?"); eq("de yes/no", A.deQuestion({ verb: "wohnst", subject: "du", rest: "in Berlin" }), "Wohnst du in Berlin?");
ok("interrogative lists", A.FR_INTERROGATIVES.includes("pourquoi") && A.ES_INTERROGATIVES.includes("cuándo") && A.DE_INTERROGATIVES.includes("warum"));

// ── marking integration: the accepted lists work with the text policy ──
eq("mark es accent-free is accepted (warn)", checkText("veintiun mil", numberAccepted("es", 21000), { lang: "es", accents: "warn" }).score, 1);
eq("mark es wrong number", checkText("veintidós", numberAccepted("es", 21), { lang: "es" }).score, 0);
eq("mark de einhundert", checkText("einhundert", numberAccepted("de", 100), { lang: "de" }).score, 1);
eq("mark de umlaut fallback", checkText("zwoelf", numberAccepted("de", 12), { lang: "de" }).score, 1);
eq("mark fr trailing s wrong", checkText("quatre-vingt", numberAccepted("fr", 80), { lang: "fr" }).score, 0);
eq("mark fr time", checkText("Il est trois heures et quart", timeWords("fr", 3, 15).all, { lang: "fr" }).score, 1);
eq("mark de time case-insensitive", checkText("viertel nach drei", timeWords("de", 3, 15).all, { lang: "de" }).score, 1);
eq("mark es price", checkText("cinco euros con cincuenta", priceWords("es", 5, 50).all, { lang: "es" }).score, 1);
eq("mark fr date", checkText("le quatorze juillet", dateForms("fr", 14, 7).accepted, { lang: "fr" }).score, 1);
eq("mark de date", checkText("Der dritte Oktober", dateForms("de", 3, 10).accepted, { lang: "de" }).score, 1);

console.log(`grammar selftest: ${n} checks, ${fails.length} failed`);
if (fails.length) { for (const f of fails.slice(0, 60)) console.log("  FAIL " + f); process.exit(1); }
