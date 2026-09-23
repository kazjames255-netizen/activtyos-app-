// Run: server/node_modules/.bin/tsx features/learninghub/tools/engine/textmark.selftest.ts
import { ACCENTS, applyShortcut, checkText, compareText, DEFAULT_POLICY, diffText, stripAccents, tidy } from "./textmark";
import { checkQuantity, checkSequence, checkSetMatch, normUnit, parseQuantity, sigFigsOf, toSF } from "./quantity";
import { fullMarks } from "./marking";
let n = 0, bad = 0;
const ok = (c: boolean, m: string) => { n++; if (!c) { bad++; console.error("FAIL:", m); } };
const P = (o = {}) => ({ ...DEFAULT_POLICY, ...o });

// ── typed text ──
ok(compareText("Hola", "hola", P()).exact, "case ignored by default");
ok(!compareText("Hola", "hola", P({ matchCase: true })).ok, "case strict when asked (German nouns)");
ok(compareText("¿Cómo estás?", "como estas", P({ accents: "warn", lang: "es" })).ok, "¿? are punctuation, not accents");
ok(!compareText("cafe", "café", P({ accents: "strict", lang: "fr" })).ok, "strict: missing accent is wrong");
ok(compareText("cafe", "café", P({ accents: "warn", lang: "fr" })).ok && !!compareText("cafe", "café", P({ accents: "warn", lang: "fr" })).note, "warn: accepted, flagged");
ok(compareText("cafe", "café", P({ accents: "lenient", lang: "fr" })).ok && !compareText("cafe", "café", P({ accents: "lenient", lang: "fr" })).note, "lenient: accepted silently");
ok(!compareText("si", "sí", P({ accents: "lenient", lang: "es" })).ok, "lenient must NOT accept si for sí (different word)");
ok(!compareText("tu", "tú", P({ accents: "lenient", lang: "es" })).ok, "…nor tu for tú");
ok(!compareText("j'ai parle", "j'ai parlé", P({ accents: "lenient", lang: "fr" })).ok, "French: parle/parlé changes the TENSE — never lenient");
ok(compareText("j'ai mange", "j'ai mangé", P({ accents: "warn", lang: "fr" })).ok && !!compareText("j'ai mange", "j'ai mangé", P({ accents: "warn", lang: "fr" })).note, "warn mode accepts but flags the tense-changing accent");
ok(compareText("schoen", "schön", P({ lang: "de" })).ok && compareText("Strasse", "Straße", P({ lang: "de", matchCase: true })).ok, "German ae/oe/ue/ss keyboard fallbacks accepted");
ok(!compareText("schoen", "schön", P({ lang: "es" })).ok, "…but only for German");
ok(compareText("le chat", "chat", P({ articleOptional: true })).ok && !compareText("le chat", "chat", P()).ok, "optional article");
ok(compareText("l’ami", "l'ami", P()).ok, "curly apostrophe normalised");
ok(checkText("", ["a"]).score === 0, "blank answer scores 0");
ok(fullMarks(checkText("un chat", ["un chat", "le chat"], { lang: "fr" })), "any accepted answer");
ok(checkText("perro", ["gato"], {}).score === 0 && checkText("perro", ["gato"], {}).feedback[0]!.includes("perro"), "wrong answer explained");
ok(tidy("  Hello,   World! ", DEFAULT_POLICY) === "hello world", "tidy");
ok(stripAccents("señor über café") === "senor uber cafe", "stripAccents");
const d = diffText("recieve", "receive");
ok(d.filter((x) => x.t !== "same").length >= 2 && d.map((x) => x.a ?? "").join("") !== "", "diff finds the swapped letters");
ok(diffText("cat", "cat").every((x) => x.t === "same") && diffText("ca", "cat").some((x) => x.t === "missing") && diffText("cats", "cat").some((x) => x.t === "extra"), "diff same/missing/extra");
ok(ACCENTS.es.includes("¿") && ACCENTS.fr.includes("œ") && ACCENTS.de.includes("ß") && ACCENTS.de.includes("Ü"), "accent sets include ¿ œ ß Ü");
ok(applyShortcut("caf" + "e'") === "café" && applyShortcut("ma" + "n~") === "mañ" && applyShortcut("scho" + "n") === null && applyShortcut("fr" + "u:") === "frü", "typing shortcuts");
ok(applyShortcut("Stra" + "ss!") === "Straß", "ss! → ß");

// ── quantities ──
ok(parseQuantity("12.5 m/s")?.value === 12.5 && parseQuantity("12.5 m/s")?.unit === "m/s", "parse with unit");
ok(parseQuantity("3.2 × 10^4 J")?.value === 32000 && parseQuantity("3.2e4 J")?.unit === "J", "standard form");
ok(parseQuantity("1,200 g")?.value === 1200 && parseQuantity("−4 °C")?.value === -4, "commas and unicode minus");
ok(parseQuantity("abc") === null && parseQuantity("") === null, "no number → null");
ok(sigFigsOf("0.0450") === 3 && sigFigsOf("1200") === 2 && sigFigsOf("3.20e4") === 3 && sigFigsOf("7") === 1, "sig figs as written");
ok(sigFigsOf("100.") === 3 && sigFigsOf("100.0") === 4, "a trailing decimal point makes zeros significant");
ok(toSF(1234.5, 3) === 1230 && toSF(0.004567, 2) === 0.0046, "round to s.f.");
ok(normUnit("m s^-1") === "m/s" && normUnit("Ohms") === "Ω" && normUnit("cm3") === "cm³" && normUnit("NEWTONS") === "N", "unit aliases");
ok(fullMarks(checkQuantity("12 m/s", { value: 12, unit: "m/s" })), "value + unit correct");
ok(checkQuantity("12", { value: 12, unit: "m/s" }).score === 1 && checkQuantity("12", { value: 12, unit: "m/s" }).max === 2, "missing unit loses the unit mark");
ok(checkQuantity("13 m/s", { value: 12, unit: "m/s" }).score === 1, "wrong value, right unit → 1 of 2");
ok(fullMarks(checkQuantity("12.3 m/s", { value: 12.34, unit: "m/s" }, { sigFigs: 3 })), "3 s.f. answer accepted (12.3 for 12.34)");
ok(!fullMarks(checkQuantity("12.34 m/s", { value: 12.34, unit: "m/s" }, { sigFigs: 3 })), "too many s.f. loses the s.f. mark");
ok(fullMarks(checkQuantity("48 J", { value: 50, unit: "J" }, { tolPct: 5 })) && !fullMarks(checkQuantity("40 J", { value: 50, unit: "J" }, { tolPct: 5 })), "percentage tolerance");
ok(fullMarks(checkQuantity(7, { value: 7, unit: "" })), "unitless number");
// ── sequence / match ──
ok(fullMarks(checkSequence(["a", "b", "c", "d"], ["a", "b", "c", "d"])), "exact sequence");
const sq = checkSequence(["a", "c", "b", "d"], ["a", "b", "c", "d"]);
ok(sq.score === 0 && sq.max === 3, "swapping two middle steps breaks all three neighbour pairs");
ok(checkSequence(["a", "b", "d", "c"], ["a", "b", "c", "d"]).score === 1, "one slip costs the marks for the affected pairs only");
const sm = checkSetMatch({ nucleus: "1", wall: "2" }, { nucleus: "1", wall: "3", vacuole: "4" });
ok(sm.score === 1 && sm.max === 3 && sm.feedback.length === 3, "set match: one mark per correct pairing");
console.log(`${n} checks, ${bad} failed`);
process.exit(bad ? 1 : 0);
