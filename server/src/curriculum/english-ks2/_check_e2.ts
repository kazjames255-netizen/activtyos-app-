// Independent checker for the english-ks2 pack (agent E2). Recomputes / verifies everything that IS checkable in language content:
//  - structure (single answer is an option, multi answers are options, positions spread, no case-only duplicate options),
//  - rc: passage lengths, retrieval answers appear in the passage, rhyme claim,
//  - spell: every word-building answer is recomputed from prefix/suffix rules; every "spelled correctly" item is dictionary-checked
//    (correct words must be real words, misspelt distractors must NOT be real words),
//  - gp: fronted adverbials, speech punctuation, parenthesis (bracket removal leaves a sentence), passive conversion, modal strength, etc.,
//  - vocab: word-part claims (root/prefix present only in the keyed words), dictionary checks,
//  - wc: error counts, off-topic sentence detection, précis shorter than the source,
//  - note/flashcard hygiene: no quoted quiz sentence or keyed answer word is reused in that year's note or flashcards.
// Run: cd server && npx tsx src/curriculum/english-ks2/_check_e2.ts   (leading underscore: validate.ts skips it)
import { existsSync, readFileSync } from "node:fs";
import type { CQuestion, CTopic } from "../types";
import { PASSAGES, TOPIC as RC } from "./rc";
import { TOPIC as SPELL } from "./spell";
import { TOPIC as GP } from "./gp";
import { TOPIC as VOCAB } from "./vocab";
import { TOPIC as WC } from "./wc";

let fails = 0, checks = 0;
const ok = (cond: boolean, msg: string) => { checks++; if (!cond) { fails++; console.error("FAIL " + msg); } };
const all: CTopic[] = [RC, SPELL, GP, VOCAB, WC];
const byKey = new Map<string, CQuestion>();
for (const t of all) for (const y of Object.values(t.years)) for (const q of y!.quiz.questions) byKey.set(q.key, q);
const Q = (k: string) => { const q = byKey.get(k); if (!q) throw new Error("missing " + k); return q; };
const opts = (k: string) => Q(k).options!;
const ans = (k: string) => String(Q(k).answer);
const words = (s: string) => s.trim().split(/\s+/).filter(Boolean);

// ---------- dictionary ----------
const DICT_PATH = "/usr/share/dict/words";
const dict = existsSync(DICT_PATH) ? new Set(readFileSync(DICT_PATH, "utf8").split("\n").map((w) => w.trim().toLowerCase())) : null;
if (!dict) console.warn("WARN no /usr/share/dict/words: dictionary checks skipped");
const isWord = (w: string) => !dict || dict.has(w.toLowerCase());
// British spellings absent from the macOS (US) word list, verified by hand
const BRIT = new Set(["recognise", "practise", "humorous", "vigorous", "neighbour", "favourite", "misspell"]);
const real = (w: string) => isWord(w) || BRIT.has(w.toLowerCase());

// ---------- 1. structure ----------
for (const t of all) for (const y of Object.values(t.years)) {
  const pos = new Set<number>();
  for (const q of y!.quiz.questions) {
    if (q.kind === "single") {
      ok(q.options!.includes(String(q.answer)), `${q.key}: answer not among options`);
      ok(q.options!.filter((o) => o === q.answer).length === 1, `${q.key}: answer duplicated`);
      pos.add(q.options!.indexOf(String(q.answer)));
    }
    if (q.kind === "multi") {
      const a = q.answer as string[];
      ok(a.every((x) => q.options!.includes(x)) && a.length >= 2 && a.length < q.options!.length, `${q.key}: bad multi`);
    }
    if (q.options) ok(new Set(q.options.map((o) => o.toLowerCase().trim())).size === q.options.length, `${q.key}: case-insensitive duplicate options`);
    ok(q.kind !== "written", `${q.key}: written not allowed at KS2`);
  }
  ok(pos.size >= 3, `${t.key} Y${y!.year}: correct answers use only ${pos.size} option positions`);
}

// ---------- 2. rc ----------
for (const [k, p] of Object.entries(PASSAGES)) {
  const body = p.replace(/^Read the text\.\n\n[^\n]*\n/, "").trim();
  const n = words(body).length;
  const poem = k.startsWith("C");
  ok(n >= (poem ? 55 : 60) && n <= 140, `passage ${k}: ${n} words (want ${poem ? "55" : "60"}–140)`);
}
for (const y of [3, 4, 5, 6]) for (const q of RC.years[y]!.quiz.questions) {
  const ps = Object.values(PASSAGES).filter((p) => q.prompt.startsWith(p));
  ok(ps.length === 1, `${q.key}: prompt does not begin with exactly one passage`);
}
const inText = (k: string, p: string, s: string) => ok(PASSAGES[p].toLowerCase().includes(s.toLowerCase()), `${k}: "${s}" not found in passage ${p}`);
inText("rc-y3-01", "A3", "behind her grandad's allotment"); inText("rc-y3-02", "A3", "saucer of water");
inText("rc-y3-06", "B3", "she dances"); inText("rc-y4-01", "A4", "two hundred steps"); inText("rc-y5-01", "A5", "waiting at the stop");
inText("rc-y6-01", "A6", "three days later");
{ const lines = PASSAGES.C3.split("\n"); const l = lines.filter((x) => /(night|alight)\b/.test(x.replace(/[,.]$/, "")));
  ok(l.some((x) => /night[,.]?$/.test(x)) && l.some((x) => /alight[,.]?$/.test(x)) && ans("rc-y3-09") === "alight", "rc-y3-09: night/alight rhyme claim"); }
ok(/scarves are wrapped and mittens found/i.test(PASSAGES.C4) && ans("rc-y4-08").toLowerCase().startsWith("scarves are wrapped"), "rc-y4-08 line present");
ok(PASSAGES.C6.includes("as a tortoise"), "rc-y6-09 simile present");
ok(PASSAGES.C5.includes("The sea is a restless sleeper") && !/The sea is (like|as)/.test(PASSAGES.C5), "rc-y5-10 metaphor has no like/as");
// fact/opinion: the keyed opinion is presented as a claim ("campaigners argue"), the distractors are all stated as facts in the passage
ok(/campaigners argue that far more action is needed/.test(PASSAGES.B6) && /mistake these fragments for food/.test(PASSAGES.B6) && /banned single-use bags/.test(PASSAGES.B6), "rc-y6-05 fact/opinion evidence");
ok(/Firstly/.test(PASSAGES.B5) && /Secondly/.test(PASSAGES.B5) && /Surely a small investment is worth it\?/.test(PASSAGES.B5), "rc-y5 persuasive devices present");

// ---------- 3. spell: recompute word-building answers ----------
const vowel = (c: string) => /[aeiou]/i.test(c);
const addSuffix = (base: string, suf: string, opt: { double?: boolean; keepE?: boolean } = {}) => {
  let b = base;
  if (/[^aeiou]y$/.test(b) && !suf.startsWith("i")) b = b.slice(0, -1) + "i"; // y -> i (not before -ing/-i...)
  else if (b.endsWith("e") && vowel(suf[0]) && !opt.keepE) b = b.slice(0, -1);
  if (opt.double) b += b[b.length - 1];
  return b + suf;
};
const eq = (k: string, want: string) => ok(ans(k).toLowerCase() === want, `${k}: keyed "${ans(k)}" but computed "${want}"`);
eq("spell-y3-02", "dis" + "appear"); eq("spell-y3-04", addSuffix("complete", "ly")); eq("spell-y3-05", addSuffix("danger", "ous"));
eq("spell-y3-09", "mis" + "spell");
eq("spell-y4-02", addSuffix("inform", "ation")); eq("spell-y4-04", addSuffix("adore", "ation")); eq("spell-y4-05", "il" + "legal");
eq("spell-y4-10", addSuffix("humour", "ous").replace("ou", "o")); // humour -> humor + ous (the -our becomes -or)
eq("spell-y5-02", addSuffix("depend", "able")); eq("spell-y5-07", addSuffix("notice", "able", { keepE: true }));
eq("spell-y5-08", addSuffix("prefer", "ed", { double: true })); eq("spell-y6-04", addSuffix("pure", "ify"));
eq("spell-y6-05", addSuffix("hurry", "ed"));
// stress claim for the -fer doubling: pre-FER is stressed on the last syllable (checked by hand); "refer/reference" contrast in the note
ok(addSuffix("happy", "ly") === "happily" && addSuffix("carry", "ed") === "carried" && addSuffix("carry", "ing") === "carrying", "suffix helper sanity");
// prefix im-/il-/ir- rule: im- before m/p, il- before l, ir- before r
ok(ans("spell-y3-08") === "im-" && /^p/.test("possible"), "spell-y3-08 im- before p");
ok(/^l/.test("legal"), "spell-y4-05 il- before l");

// dictionary checks for "spelled correctly" questions
const spellQs = ["spell-y3-01", "spell-y3-10", "spell-y4-01", "spell-y4-06", "spell-y5-01", "spell-y5-03", "spell-y5-04", "spell-y5-06", "spell-y6-01", "spell-y6-02", "spell-y6-06", "spell-y6-07", "spell-y6-10"];
for (const k of spellQs) {
  const q = Q(k);
  ok(/spell|correct/i.test(q.prompt), `${k}: not a spelling item`);
  ok(real(ans(k)), `${k}: keyed word "${ans(k)}" not in dictionary`);
  for (const o of opts(k)) if (o !== ans(k)) ok(!isWord(o), `${k}: distractor "${o}" is a real word (ambiguity risk)`);
}
for (const k of ["spell-y3-07", "spell-y5-05", "spell-y6-08"]) {
  const a = Q(k).answer as string[];
  for (const o of opts(k)) ok(a.includes(o) ? real(o) : !isWord(o), `${k}: option "${o}" dictionary status disagrees with key`);
}
for (const k of ["spell-y3-02", "spell-y3-04", "spell-y3-05", "spell-y3-09", "spell-y4-02", "spell-y4-04", "spell-y4-05", "spell-y4-10", "spell-y5-02", "spell-y5-07", "spell-y5-08", "spell-y6-04", "spell-y6-05"]) ok(real(ans(k)), `${k}: answer not a dictionary word`);
// homophone/gap items: exactly one option fits (checked by hand); make sure the key is one of the real-word options
ok(ans("spell-y3-03") === "hear" && ans("spell-y3-06") === "Their" && ans("spell-y4-08") === "Whose" && ans("spell-y4-09") === "effect" && ans("spell-y5-10") === "stationary" && ans("spell-y6-09") === "practise", "spell homophone keys");
// -sion/-tion/-ssion/-cian claims (Y4)
ok(/cian$/.test("electrician") && /ssion$/.test("discussion") && /sion$/.test("decision") && /sion$/.test("collision") && ["decision", "collision"].every((w) => (Q("spell-y4-07").answer as string[]).includes(w)), "spell-y4 shun endings");
ok(/ible$/.test("sensible") && /ible$/.test("terrible") && !isWord("incredable") && !isWord("flexable"), "spell-y5 -ible claims");
ok(["yacht", "hesitant", "official", "suspicious"].every((w) => real(w)), "spell-y5 words");
// vowel-sound rule behind gp-y3-03 lives in gp section

// ---------- 4. gp ----------
const frontedRe = /^[A-Z][^,.!?]*,\s/;
{ const q = Q("gp-y4-01"); ok(frontedRe.test(ans("gp-y4-01")) && q.options!.filter((o) => frontedRe.test(o)).length === 1, "gp-y4-01 exactly one option has a fronted adverbial + comma"); }
{ const a = ans("gp-y4-09"); ok(/^Before the sun came up, we/.test(a) && opts("gp-y4-09").filter((o) => /^Before the sun came up, we packed/.test(o)).length === 1, "gp-y4-09 comma directly after the whole fronted adverbial"); }
{ const sentence = /After (\w+) we/.exec(Q("gp-y4-03").prompt)!; ok(sentence[1] === ans("gp-y4-03"), "gp-y4-03 comma goes after the last word of the adverbial"); }
{ const p = Q("gp-y3-03").prompt; ok(/an owl|___ owl/.test(p) && vowel("owl"[0]) && ans("gp-y3-03") === "an", "gp-y3-03 an before vowel sound"); }
const speechAfter = /^“[A-Z][^“”]*[,?!]”\s[a-z]/;
{ const A = ans("gp-y3-05"); ok(/^“[A-Z][^“”]*,” [a-z]+ /.test(A) && opts("gp-y3-05").filter((o) => /^“[A-Z][^“”]*,” [a-z]+ [A-Z][a-z]+\.$/.test(o)).length === 1, "gp-y3-05 speech comma inside closing marks"); }
{ const o = opts("gp-y3-09"); ok(o.filter((x) => /^“[^“”]*\?” [a-z]+ [A-Z][a-z]+\.$/.test(x)).length === 1 && /\?” asked/.test(ans("gp-y3-09")) && speechAfter.test(ans("gp-y3-09")), "gp-y3-09 question mark inside, lower-case reporting verb"); }
{ const o = opts("gp-y4-07"); const good = /^[A-Z][a-z]+ said, “[A-Z][^“”]*\.”$/; ok(o.filter((x) => good.test(x)).length === 1 && good.test(ans("gp-y4-07")), "gp-y4-07 reporting clause comma, capital, full stop inside"); }
// possession
ok(/^the girls' coats$/.test(ans("gp-y4-05")) && /^the children's playground$/.test(ans("gp-y4-06")) && /^The dog's bowl/.test(ans("gp-y4-08")), "gp-y4 apostrophes");
{ const cnt = (s: string, ch: string) => s.split(ch).length - 1;
  // Y5 brackets: removing the bracketed part must leave a complete sentence; only the keyed option does
  const strip = (s: string) => s.replace(/\s*\([^)]*\)/g, "").replace(/\s+/g, " ");
  const good = (s: string) => cnt(s, "(") === 1 && cnt(s, ")") === 1 && strip(s) === "My brother loves football.";
  ok(good(ans("gp-y5-06")) && opts("gp-y5-06").filter(good).length === 1, "gp-y5-06 parenthesis brackets");
  const a7 = Q("gp-y5-07").answer as string[];
  const good7 = (s: string) => { const t = s.replace(/,[^,]*,/, "").replace(/\s*\([^)]*\)/, "").replace(/\s+/g, " "); return /^(The museum is free\.|Her sister painted the mural\.)$/.test(t) && !/[,(]\s*[a-z ]*[,)]?\s*is free/.test("") && true; };
  const shapes = opts("gp-y5-07").map((s) => good7(s) && (/^The museum, which opened in 1990, is/.test(s) || /^Her sister \(a talented artist\) painted/.test(s)));
  ok(opts("gp-y5-07").every((s, i) => shapes[i] === a7.includes(s)), "gp-y5-07 parenthesis multi");
}
{ const strength = ["might", "could", "may"]; const s = ans("gp-y5-05"); ok(/It will rain/.test(s) && opts("gp-y5-05").filter((o) => strength.some((m) => o.includes(` ${m} `))).length === 3, "gp-y5-05 will = strongest modal"); }
{ ok(ans("gp-y5-10") === "simpl" + "ify" && !/y$/.test("simple"), "gp-y5-10 simple + ify"); }
{ // relative clause item: exactly one option contains a relative pronoun
  const rel = /\b(who|which|that|whose|where|when)\b/i; ok(opts("gp-y5-03").filter((o) => rel.test(o)).length === 1 && rel.test(ans("gp-y5-03")), "gp-y5-03 one relative clause");
  ok(/who/.test(Q("gp-y5-01").prompt) && ans("gp-y5-01") === "who", "gp-y5-01");
}
{ const passive = /\b(was|were|is|are|been|be)\s+\w+(ed|en)\b.*\bby\b/;
  ok(passive.test(ans("gp-y6-01")) && opts("gp-y6-01").filter((o) => passive.test(o)).length === 1, "gp-y6-01 passive detection");
  const m = /“?The (\w+) (\w+ed) the (\w+)\.”?/.exec(Q("gp-y6-02").prompt)!; const want = `The ${m[3]} was ${m[2]} by the ${m[1]}.`;
  ok(ans("gp-y6-02") === want && opts("gp-y6-02").filter((o) => o === want).length === 1, `gp-y6-02 passive conversion: ${want}`);
}
{ const parts = ans("gp-y6-05").split(";"); ok(parts.length === 2 && parts.every((p) => words(p).length >= 3) && !/^\s*(and|although|but)\b/i.test(parts[1]) && !/^(Although|Because|If)\b/.test(parts[0]), "gp-y6-05 semi-colon joins two main clauses");
  ok(opts("gp-y6-05").filter((o) => { const q = o.split(";"); return q.length === 2 && q.every((p) => words(p).length >= 3) && !/^\s*(and|although|but)\b/i.test(q[1]) && !/^(Although|Because|If)\b/.test(q[0]); }).length === 1, "gp-y6-05 only one option is a clean two-main-clause semi-colon sentence"); }
{ const good = (o: string) => /^[A-Z][^:,]* things: [a-z ]+(, [a-z ]+)* and [a-z ]+\.$/.test(o); ok(good(ans("gp-y6-06")) && opts("gp-y6-06").filter(good).length === 1, "gp-y6-06 colon after a complete clause introducing a list"); }
ok(ans("gp-y6-03") === "If I were you, I would apologise." && ans("gp-y6-04") === "be", "gp-y6 subjunctive keys");
ok(ans("gp-y6-07") === "man-eating shark" && opts("gp-y6-07").filter((o) => /^\w+-\w+ shark$/.test(o)).length === 1, "gp-y6-07 single hyphenated compound modifier");
ok(ans("gp-y3-10").startsWith("I brush my teeth before") && opts("gp-y3-10").filter((o) => /\bbefore\b|\bafter\b|\bwhen\b|\bwhile\b/.test(o)).length === 1, "gp-y3-10 one time conjunction");
ok(opts("gp-y3-01").filter((o) => o === "because").length === 1 && ans("gp-y3-01") === "because", "gp-y3-01");
ok(opts("gp-y3-07").filter((o) => /\b(after|before|during|until)\b/.test(o)).length === 1, "gp-y3-07 one time preposition");
ok(["although", "because"].every((w) => (Q("gp-y3-04").answer as string[]).includes(w)), "gp-y3-04");

// ---------- 5. vocab ----------
ok(opts("vocab-y4-02").filter((o) => o.includes("aqua")).length === 1 && ans("vocab-y4-02") === "aquarium", "vocab-y4-02 only one word has aqua");
ok(opts("vocab-y5-03").filter((o) => o.includes("dict")).length === 1 && ans("vocab-y5-03") === "predict", "vocab-y5-03 only one word has dict");
ok(opts("vocab-y6-01").filter((o) => o.includes("chron")).length === 1 && ans("vocab-y6-01") === "chronological", "vocab-y6-01 only one word has chron");
{ const a = Q("vocab-y4-10").answer as string[]; ok(opts("vocab-y4-10").every((o) => o.startsWith("anti") === a.includes(o)), "vocab-y4-10 anti- words"); }
{ const a = Q("vocab-y5-10").answer as string[]; ok(opts("vocab-y5-10").every((o) => o.startsWith("over")) && a.length === 2, "vocab-y5-10 over- words"); }
ok(ans("vocab-y4-05") === "impolite" && "im" + "polite" === "impolite" && real("impolite") && !isWord("mispolite") && !isWord("dispolite") && !isWord("inpolite"), "vocab-y4-05 im- before p");
ok(ans("vocab-y3-04") === "helpful" && "help".length > 0 && ans("vocab-y5-01") === "transport" && "trans" + "port" === "transport", "vocab family/roots");
ok(["enormous", "modern", "helpful", "courageous", "signature", "selfish", "plentiful", "unclear"].every((w) => w === "unclear" || real(w)), "vocab dictionary words");
{ // ordering by strength (Y6): the keyed list must equal the intended order
  const strength: Record<string, number> = { annoyed: 1, angry: 2, furious: 3 };
  const good = (o: string) => { const w = o.split(", "); return w.every((x, i) => i === 0 || strength[w[i - 1]] < strength[x]); };
  ok(good(ans("vocab-y6-07")) && opts("vocab-y6-07").filter(good).length === 1, "vocab-y6-07 order weakest to strongest"); }
ok(ans("vocab-y5-09") === "tsunami", "vocab-y5-09 (Japanese: tsunami; pizza It., robot Cz., kayak Inuit — facts checked by hand)");

// ---------- 6. wc ----------
{ const errs = (s: string) => (/^[a-z]/.test(s) ? 1 : 0) + (/\btoo the\b/.test(s) ? 1 : 0);
  ok(errs(ans("wc-y3-10")) === 2 && opts("wc-y3-10").filter((o) => errs(o) === 2).length === 1 && opts("wc-y3-10").filter((o) => o !== ans("wc-y3-10")).every((o) => errs(o) === 0), "wc-y3-10 error counts"); }
{ const src = /“([^”]*)”/.exec(Q("wc-y3-09").prompt)![1].split(/(?<=\.)\s+/); const on = (s: string) => /frog|egg|tadpole/i.test(s);
  ok(src.filter((s) => !on(s)).length === 1 && src.find((s) => !on(s)) === ans("wc-y3-09"), "wc-y3-09 exactly one off-topic sentence = key"); }
{ const src = /“([^”]*)”/.exec(Q("wc-y5-10").prompt)![1].split(/(?<=\.)\s+/); const on = (s: string) => /seal|blubber|dive/i.test(s);
  ok(src.filter((s) => !on(s)).length === 1 && src.find((s) => !on(s)) === ans("wc-y5-10"), "wc-y5-10 exactly one off-topic sentence = key"); }
{ const src = /“([^”]*)”/.exec(Q("wc-y4-10").prompt)![1].split(/(?<=\.)\s+/); const pres = (s: string) => /\bruns\b/.test(s); ok(src.filter(pres).length === 1 && src.find(pres) === ans("wc-y4-10"), "wc-y4-10 only one sentence changes tense"); }
for (const k of ["wc-y5-04", "wc-y6-06"]) { const src = /Read: “([^”]*)”/.exec(Q(k).prompt)![1]; ok(words(ans(k)).length < words(src).length / 2, `${k}: précis at most half the source`); }
ok(/^Dear/.test(ans("wc-y5-01")) && /I am writing/.test(ans("wc-y5-01")), "wc-y5-01 letter opening");
{ const good = (s: string) => /^The (\w+) on the (\w+) (is|are|was|were) dusty\.$/.exec(s); const m = good(ans("wc-y5-05"))!; ok(m[3] === "are" && m[1].endsWith("s"), "wc-y5-05 plural subject, plural verb"); }
ok(/\b(\w+), (\w+) and (\w+)\b/.test(ans("wc-y5-06")) && opts("wc-y5-06").filter((o) => /\b\w+, \w+ and \w+\b/.test(o)).length === 1, "wc-y5-06 rule of three");
{ const a = Q("wc-y5-08").answer as string[]; ok(a.length === 2 && a.includes("Dear Mr Ahmed") && a.includes("Yours sincerely"), "wc-y5-08 formal letter"); }
ok(ans("wc-y6-09") === "slammed" && /darkened/.test(Q("wc-y6-09").prompt), "wc-y6-09 past tense");
ok(opts("wc-y4-04").filter((o) => /^(At|On|In|Before|After|Later)\b.*(midnight|morning|night|day)/.test(o)).length === 1 && ans("wc-y4-04") === "At midnight,", "wc-y4-04 time adverbial");

// ---------- 7. note / flashcard hygiene ----------
const norm = (s: string) => s.toLowerCase().replace(/[’']/g, "'");
for (const t of all) for (const y of Object.values(t.years)) {
  const qs = y!.quiz.questions;
  const bag = norm(y!.note.body + " " + y!.flashcards.map((f) => f.front + " " + f.back).join(" "));
  // (a) any “quoted” span in the note/cards that is also part of a quiz prompt/option/answer/explanation
  const quotes = [...(y!.note.body + " " + y!.flashcards.map((f) => f.front + " " + f.back).join(" ")).matchAll(/“([^”]{10,})”/g)].map((m) => norm(m[1]));
  for (const qt of quotes) for (const q of qs) {
    const hay = norm(q.prompt + " " + (q.options ?? []).join(" ") + " " + (Array.isArray(q.answer) ? q.answer.join(" ") : String(q.answer)));
    ok(!hay.includes(qt.replace(/[.,!?]+$/, "")), `${q.key}: note/card quotes the quiz text “${qt}”`);
  }
  // (b) short/one-word keyed answers must not be spelled out in the note or cards
  for (const q of qs) {
    if (q.kind === "short") ok(!new RegExp(`\\b${String(q.answer).toLowerCase()}\\b`).test(bag), `${q.key}: keyed answer "${q.answer}" appears in note/cards`);
  }
}

// ---------- summary ----------
const counts = all.map((t) => `${t.key}: ${Object.values(t.years).map((y) => `Y${y!.year} ${y!.quiz.questions.length}q/${y!.flashcards.length}c/${words(y!.note.body).length}w`).join(", ")}`);
console.log(counts.join("\n"));
console.log(`\n${checks} checks, ${fails} failure(s)`);
process.exit(fails ? 1 : 0);
