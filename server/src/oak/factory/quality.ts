// Lesson-factory QUALITY layer (Q1 review, 2026-09-20): text normalisation, a correction table for errors that Oak's own data
// contains, usability filters for key learning points / keyword definitions, and the small grammar helpers (a/an, singular/plural)
// that keep fill-the-gap and "which key word?" items from giving the answer away.
// Pure functions, no I/O. Used by generate.ts (deck), plan.ts (plan) and index.ts (facts); generate.ts re-exports `tidy`.

import { fixLang, badPronunciationKeyword } from "./oakFixes";

// ── text tidy ────────────────────────────────────────────────────────────────
const SUPMAP: Record<string, string> = { "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹", "+": "⁺", "-": "⁻", "−": "⁻", "=": "⁼", "(": "⁽", ")": "⁾", a: "ᵃ", b: "ᵇ", c: "ᶜ", d: "ᵈ", e: "ᵉ", f: "ᶠ", g: "ᵍ", h: "ʰ", i: "ⁱ", j: "ʲ", k: "ᵏ", l: "ˡ", m: "ᵐ", n: "ⁿ", o: "ᵒ", p: "ᵖ", r: "ʳ", s: "ˢ", t: "ᵗ", u: "ᵘ", v: "ᵛ", w: "ʷ", x: "ˣ", y: "ʸ", z: "ᶻ" };
const toSup = (t: string) => ([...t].every((c) => SUPMAP[c]) ? [...t].map((c) => SUPMAP[c]).join("") : null);

/** Typos found in Oak's own text (whole words; the capitalised form is handled too). Found by a dictionary scan of all 3,400 Maths + Science lessons. */
const TYPOS: Record<string, string> = {
  caluate: "calculate", caluations: "calculations", descibe: "describe", decribe: "describe", maniulatives: "manipulatives", peimeter: "perimeter",
  unisiting: "unitising", milliliitre: "millilitre", repesent: "represent", dgit: "digit", partititoning: "partitioning", partioning: "partitioning",
  rectilnear: "rectilinear", postive: "positive", statstical: "statistical", guages: "gauges", trapizea: "trapezia", enought: "enough",
  sustrainable: "sustainable", instrusive: "intrusive", continous: "continuous", obejct: "object", reistance: "resistance", dependant: "dependent",
};
const TYPO_RE = new RegExp(`(?<![\\p{L}\\p{N}])(${Object.keys(TYPOS).join("|")})(?![\\p{L}\\p{N}])`, "giu");
/** Multi-word slips (each replaced verbatim). */
const PHRASE_FIXES: [RegExp, string][] = [
  [/\bright ange\b/g, "right angle"], [/\bto the any power\b/gi, "to any power"], [/\bfive of more\b/gi, "five or more"], [/\bon out bodies\b/gi, "on our bodies"],
  [/\b([Aa])ngles facts\b/g, "$1ngle facts"], [/\btoo probably too\b/gi, "probably too"], [/\bmore seem more\b/gi, "seem more"],
  [/\bof it's motion\b/gi, "of its motion"], [/\btrees rings\b/gi, "tree rings"], [/\bparts of an animal's body is called\b/gi, "parts of an animal's body are called"],
  [/\bpollen from the male parts of a flower are transferred\b/gi, "pollen from the male parts of a flower is transferred"], [/º/g, "°"],
  // Q4: a lost opening quote, and "out of full sentences" (Oak's own key learning point says notes are written WITHOUT full sentences)
  [/^tion' is the most common spelling\b/, "'tion' is the most common spelling"], [/\bin note-form, out of full sentences\b/gi, "in note form, without full sentences"],
];
/** Phoneme notation ("/shun/", "/g/") must keep its slashes tight: the slash-spacing rule below would turn it into "/ shun/". */
const PHONEME = /(?<![\p{L}\p{N}])\/[\p{L}]{1,5}\/(?![\p{L}\p{N}])/gu;
/** A repeated function word ("and and", "to to", "The the") is a typing slip; any other repeated word is left alone. */
const REPEAT_RE = /(?<![\p{L}\p{N}])(the|and|to|of|in|is|are|it|for|or|a|an)\s+\1(?![\p{L}\p{N}])/giu;

/** Plain-text clean-up of Oak source text so no markup / typography debris reaches a child: HTML italics, "x^2" carets (superscripts),
 *  a space before punctuation, ".." at the end of a sentence, mathematical-italic letters, odd slash spacing, known typos. Idempotent;
 *  a caret that cannot be converted faithfully is left exactly as written. Applied to the raw facts (index.ts / plan.ts) AND inside
 *  `safe`, so the validator's re-derivation sees the same text. */
export function tidy(s: string): string {
  let t = s
    .replace(/<\/?(?:i|b|em|strong|u|span|br)\s*\/?>/gi, "")
    .replace(/[\u{1D400}-\u{1D7FF}]/gu, (c) => { const n = c.normalize("NFKC"); return n === c ? c : n; })
    .replace(/\^\(([^()]{1,12})\)/g, (m, x: string) => toSup(`(${x})`) ?? m)
    .replace(/\^(-|−)?(\d+|th(?![a-z])|[a-z](?![a-z]))/g, (m, sign: string | undefined, x: string) => toSup(`${sign ?? ""}${x}`) ?? m)
    .replace(/\s+([.,;])(?=\s|$)/g, "$1")
    .replace(/(?<!\.)\.\.(?!\.)/g, ".")
    .replace(PHONEME, (m) => m.replace(/\//g, "\u0000"))
    .replace(/(?<=\S)\/ (?=\S)/g, " / ").replace(/(?<=\S) \/(?=\S)/g, " / ")
    .replace(/\u0000/g, "/")
    .replace(TYPO_RE, (w) => { const fix = TYPOS[w.toLowerCase()]; return /^\p{Lu}/u.test(w) ? fix.charAt(0).toUpperCase() + fix.slice(1) : fix; })
    .replace(REPEAT_RE, "$1")
    .replace(/[;,]\s*$/, "."); // Q4: a statement cut off at a semicolon / comma ("...the 'you' ending is -es;") ends with a full stop
  for (const [re, to] of PHRASE_FIXES) t = t.replace(re, to);
  return fixLang(t); // Q2: English / French / Spanish / German typos in Oak's text (oakFixes.ts)
}
/** Lesson-outline headings as shown (slide titles, intro cards, plan step titles): no trailing full stop ("Practising vocabulary."). */
export function cleanOutline(outline: string[]): string[] {
  return outline.map((h) => tidy(h).replace(/\s+/g, " ").replace(/(?<![.\d])\.\s*$/, "").trim()).filter(Boolean);
}
const norm = (s: string) => tidy(s).replace(/\s+/g, " ").replace(/[.\s]+$/, "").trim().toLowerCase();

// ── errors in Oak's own data (exact statements; `fix` null = drop the statement) ─────────────────────────────────────────────
// Every entry was checked against the lesson it sits in. A statement that is WRONG is corrected to the standard true form, or dropped.
export const CORRECTIONS: { text: string; fix: string | null; why: string }[] = [
  { text: "The smaller the denominator, the smaller the parts of the whole.", fix: "The smaller the denominator, the larger the parts of the whole.", why: "false: a smaller denominator means larger parts (it contradicts the point before it)" },
  { text: "Multiples of 3 are also multiples of 9", fix: "Multiples of 9 are also multiples of 3", why: "false: 3 is not a multiple of 9" },
  { text: "A digit in the tens column is 10 times the value of a digit in the ones column", fix: "A digit in the tens column is worth 10 times as much as the same digit in the ones column.", why: "only true for the same digit" },
  { text: "Roman numerals have a system of rules which use different place value structures.", fix: null, why: "Roman numerals are not a place-value system" },
  { text: "The currency used in most European countries is the Euro.", fix: "The currency used in many European countries is the Euro.", why: "the Euro is not used in most European countries" },
  { text: "Common solvents are paint thinner, glue, and nitrous oxide.", fix: null, why: "nitrous oxide is a gas, not a solvent; glue is an adhesive" },
  { text: "The theory of evolution has been proven through evidence from fossils as well as living animals and plants.", fix: "The theory of evolution is supported by evidence from fossils as well as living animals and plants.", why: "a scientific theory is supported by evidence, not proven" },
  { text: "Some animals in decline in the UK include, red squirrels, hedgehogs, natterjack toads and greater mouse-eared bats.", fix: null, why: "the greater mouse-eared bat is not 'in decline' in the UK (extinct as a breeding species); stray comma" },
  // Oak swapped the two definitions in "Electrolysis of aqueous solutions": anions go to the ANODE, cations to the CATHODE
  { text: "a negatively charged electrode, in an electrolysis cell, to which the anions are attracted", fix: "A negatively charged electrode, in an electrolysis cell, to which the cations are attracted.", why: "swapped: cations are attracted to the (negative) cathode" },
  { text: "a positively charged electrode, in an electrolysis cell, to which the cations are attracted", fix: "A positively charged electrode, in an electrolysis cell, to which the anions are attracted.", why: "swapped: anions are attracted to the (positive) anode" },
  { text: "Enzymes digest carbohydrates into starch and sugars, proteins into amino acids, and fats into fatty acids and glycerol.", fix: "Enzymes digest carbohydrates into sugars, proteins into amino acids, and fats into fatty acids and glycerol.", why: "false: starch is a carbohydrate, it is digested INTO sugars" },
  { text: "Large particles are moved into and out of the blood by active transport, which requires energy.", fix: null, why: "false: active transport moves particles against a concentration gradient; large particles do not cross this way" },
  { text: "Refraction occurs when one side of a wavefront enters the new medium before the other, causing a change in wave speed.", fix: null, why: "cause and effect reversed (the change of speed changes the direction)" },
  { text: "In bioleaching, metal is extracted from bacteria that extract metal from an ore.", fix: null, why: "false: the metal is not extracted from the bacteria" },
  { text: "A result can be considered accurate if it is repeatable, reproducible and if systematic errors have been checked for.", fix: null, why: "false: repeatable / reproducible describe precision, not accuracy" },
  { text: "The unit for measuring energy is the joule (J) which is the same as the unit for measuring energy.", fix: null, why: "tautology (says the unit is the same as itself)" },
  { text: "A resource is sustrainable it is maintained a certain level for as long as it is needed.", fix: "A resource is sustainable if it is maintained at a certain level for as long as it is needed.", why: "typo and missing words" },
  { text: "Since the industrial revolution, in the 1850s, overall global surface temperatures have been increasing", fix: "Since the 1850s, overall global surface temperatures have been increasing", why: "the industrial revolution began about a century earlier; the 1850s is when reliable records start" },
  { text: "Differences in the shape, size, and structures of cells are adaptations.", fix: null, why: "misleading as a definition (an adaptation is a difference that suits a cell to its function)" },
  { text: "Displacement is the distance from the starting point when measured in a straight line.", fix: "Displacement is the distance and direction from the starting point, measured in a straight line.", why: "displacement is a vector (distance AND direction), not a distance" },
  { text: "the distance it travels each second", fix: null, why: "speed is distance per unit of time (the lesson also uses km/h and mph), and 'it' has no noun" },
  { text: "To partition one part from another (the subtrahend from the difference), or to decrease an amount by taking an amount away.", fix: "To decrease an amount by taking an amount away.", why: "the subtrahend is taken from the minuend, not from the difference" },
  { text: "A food chain is used to show the order in which living things depend on each other", fix: "A food chain is used to show the order in which living things depend on each other for food", why: "truncated: depend on each other for what?" },
];
const CORR = new Map(CORRECTIONS.map((c) => [norm(c.text), c]));
/** Misconception statements that are TRUE as written (Oak lists the right thing as the mistake), so they must not be shown as a "common mistake". */
const BAD_MISTAKES = new Set(["division by 0.5 is the same as doubling"].map(norm));
export const BAD_MISTAKE = (s: string) => BAD_MISTAKES.has(norm(s));

// ── usable key learning points / keyword definitions ─────────────────────────
export const JUNK = /\$\$|\\\(|\\frac|\\times|\\\\|\{\{|\[object /;
/** Leftover sentence-frame blanks ("The ___ is taller than the ___") are teacher stems, not statements. */
const BLANKS = /_{2,}|-{4,}|…|\.{3}\s*$/;
/** A definition that needs a labelled point of a diagram we do not show ("...the y-coordinate of point Q on the triangle"). */
const DIAGRAM_REF = /\bpoints? [PQR]\b/;
const LESSON_REF = /\b(?:this|the|in the) (?:lesson|video|slides?|worksheet|quiz)\b|\bthis unit\b|\bstem sentences?\b|\bsentence stems?\b|\bmanipulatives\b|\bcycle [a-d0-9]\b|\bin this instance\b|\bLC ?\d|\bCfU\b|\btext map\b/i;
/** Objectives written for the teacher ("Secure understanding of...", "Ensure pupils...") are not statements a child can learn. */
const DIRECTIVE = /^(?:secure|consolidate|deepen|embed|ensure|encourage|revisit|listening to|use (?:knowledge|the sentence|the stem|a variety|your)|(?:understand|know|explore|consider|recognise|identify|explain|describe) (?:how|why|what|when|which|where|whether)\b)\b/i; // Q4: "Understand how X differs from Y" is an objective, not a statement

/** Specification-style objectives ("Interpretation of graphs showing...", "Using quadrats to...", "Identify a trend...") are tasks, not statements: an opener like this AND no finite verb. */
const OBJECTIVE_OPEN = /^(?:examples?\b|sampling|interpretation of|planning|producing|accurate|differences? between|predict|observe|the functions? and structures?|a case study|consideration of|collecting|preparing|writing|identifying|plotting|recording|safe|control of|use of|analysing|comparison of|following|drawing|explaining|evaluating|presenting|making|calculating|selecting|describing|testing|suggesting|measuring|using|carrying out|selection of|applying|investigating|comparing|understanding|knowing|knowledge of|recognising|recognise|understand|identify|explain|describe|calculate|counting|estimating|interpreting|reading|record|the (?:common )?features? of|how to|know|present tense)\b/i;
/** "Know that the digits...", "Understand that...", "Know the ordinal number names are...": the objective wrapper is dropped, the statement inside is kept (Q4). */
const KNOW_THAT = /^(?:know|understand|recognise|remember|learn|note|appreciate|be aware|realise) that\s+(?=\p{L})/iu;
const KNOW_THE = /^know (?=(?:the|a|an|each|every|all|there|when|which|what) \p{L})/iu;
const capFirst = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const FINITE = /\b(?:is|are|was|were|be|been|can|could|will|would|has|have|had|does|do|did|may|might|must|should|shall|need|needs|means|mean|shows?|causes?|produces?|makes?|forms?|contains?|uses?|allows?|helps?|occurs?|happens?|increases?|decreases?|changes?|depends?|gives?|leads?|results?|remains?|stays?|moves?|travels?|absorbs?|releases?|reacts?|equals?|equal|involves?|requires?|provides?|creates?|consists?|includes?|represents?|describes?|measures?|keeps?|comes?|goes?|turns?|works?|breaks?|holds?|carries?|joins?|loses?|gains?|grows?|flows?|rises?|falls?|affects?|tells?|says?|states?|explains?|refers?)\b/i;

/** A key learning point fit to show a child: a real statement, no blanks, no reference to Oak's lesson, not a teacher objective. */
/** A gerund-led objective ("Following an appropriate method to vary... and measure the gas", "Interpreting and describing the results") only
 *  counts as a statement when it has a real finite verb (FINITE also matches nouns such as "results" / "measure" / "increase"). Q4. */
const STRONG_FINITE = /\b(?:is|are|was|were|can|could|will|would|should|must|may|might|has|have|had|does|do|did|means?|needs?|shows?|helps?|allows?|makes?|gives?|involves?|requires?|depends?)\b/i;
const GERUND_OPEN = /^(?:\p{L}+ing|record|how to|the (?:common )?features? of|use of|present tense)\b/iu;
/** Q5: an imperative task step is an instruction to the class, not a statement a child can learn ("Record results in an appropriate
 *  table", "Identify if regrouping will occur", "Compare the two graphs"). Tier A: a task verb followed by a determiner / wh-word /
 *  pronoun / particle. Tier B: an unambiguous task verb followed by a plain word, in a sentence with no real finite verb. Maths
 *  procedure verbs (add, count, partition, round, use…) are NOT task verbs: "Add the ones first" is a method a child learns. */
const TASK_VERB = "record|measure|identify|observe|collect|label|plot|repeat|weigh|tick|circle|wear|wash|pour|stir|heat|mix|cut|wait|note|write|select|choose|interpret|analyse|analyze|evaluate|describe|explain|suggest|predict|state|give|name|discuss|practise|practice|read|look|listen|say|think|consider|investigate|examine|test|check|complete|fill|place|put|take|set|carry|work|remember|notice|ensure|make|try|sort|group|match|underline|highlight|annotate|copy|find|decide|prepare|research|plan|review|edit|proofread|rehearse|perform|draw|sketch|calculate|estimate|compare|show|turn|keep|hold|move|open|close|leave|start|stop|ask|tell|answer|share|talk|act|imagine|create|design|build|construct|justify|prove|verify|recap|revise|explore|watch|visit|demonstrate|illustrate|arrange|position|mark|shade|colour|trace|drop|spin|roll|push|pull|lift|shake|blow|squeeze|twist|bend|present";
const IMPERATIVE_A = new RegExp(`^(?:${TASK_VERB})\\s+(?:the|a|an|your|each|every|all|any|both|two|three|some|how|if|whether|what|which|when|where|why|it|them|this|these|those|one|up|down|out|at|on|in|into|for|to|with|from|about|that|whom|sure|carefully|closely|clearly)\\b`, "iu");
const IMPERATIVE_B = /^(?:record|measure|identify|observe|collect|label|plot|repeat|weigh|describe|explain|suggest|predict|investigate|discuss|practise|listen|consider|examine|complete|evaluate|interpret|analyse|compare|calculate|estimate|select|choose|write|draw|sort)\s+(?!of\b|value|tense|tubes?\b|symbols?\b)\p{Ll}/iu;
/** Q5: a writing lesson's plan for the class ("We will include subject-specific vocabulary", "Our plan will contain…") is not a key idea. */
const CLASS_PLAN = /^(?:we|our \p{L}+(?: \p{L}+)?|today we) (?:will|are going to|can now)\b|,\s*we will\b/iu;
export function usablePoint(p: string): boolean {
  const t = p.replace(/\s+/g, " ").trim();
  const objective = /^how to\b/i.test(t) || (OBJECTIVE_OPEN.test(t) && (GERUND_OPEN.test(t) ? !STRONG_FINITE.test(t) : !FINITE.test(t)));
  const imperative = IMPERATIVE_A.test(t) || (IMPERATIVE_B.test(t) && !STRONG_FINITE.test(t));
  return t.length >= 8 && !JUNK.test(t) && !BLANKS.test(t.replace(/\.\.\./g, "")) && !LESSON_REF.test(t) && !DIAGRAM_REF.test(t) && !DIRECTIVE.test(t) && !objective && !imperative && !CLASS_PLAN.test(t);
}
/** Key learning points as shown: tidied, corrected (CORRECTIONS), unusable ones removed, duplicates removed (order kept). */
export function cleanPoints(points: string[]): string[] {
  const seen = new Set<string>(); const out: string[] = [];
  for (const raw of points) {
    let p = tidy(raw).replace(/\s+/g, " ").trim();
    if (KNOW_THAT.test(p)) p = capFirst(p.replace(KNOW_THAT, "")); else if (KNOW_THE.test(p) && FINITE.test(p.replace(KNOW_THE, ""))) p = capFirst(p.replace(KNOW_THE, ""));
    const c = CORR.get(norm(p)); if (c) { if (c.fix === null) continue; p = c.fix; }
    if (!usablePoint(p)) continue;
    const k = norm(p); if (seen.has(k)) continue; seen.add(k); out.push(p);
  }
  return out;
}

export interface KWd { k: string; d: string }
/** Words a definition can be made of without saying anything ("the ability to … things"). */
const DEF_GENERIC = new Set("ability thing things something someone anything being process when used describe describes describing means meaning another word words term person people type kind which that this with from into what where make makes made done doing have having also very".split(" "));
/** A definition that only restates its key word ("Taste is the ability to taste things", "Multiplication is multiplying"): a form of the
 *  key word appears in it and nothing else of substance is left. */
export function tautology(k: string, d: string): boolean {
  const kw = contentWords(k.replace(/\s*\([^)]*\)/g, "")); if (!kw.length) return false;
  const ws = contentWords(d);
  const own = ws.filter((w) => kw.some((x) => derivedForm(w, x)));
  if (!own.length) return false;
  return ws.filter((w) => !kw.some((x) => derivedForm(w, x)) && !DEF_GENERIC.has(w)).length === 0;
}
/** A definition written for the teacher ("a task in which the student responds to several prompts"). Short translations ("teacher") are kept. */
const teacherFacing = (k: string, d: string) => d.split(/\s+/).length >= 5 && /\b(?:students?|pupils?|learners?|the class|teachers?)\b/i.test(d) && !/student|pupil|learner|teacher|class/i.test(k);
const SENT_SPLIT = /(?<=[.!?])\s+/;
const CONTEXT_SENT = /\b(?:in|for) (?:this|the context of this) (?:lesson|unit)\b|\bthis lesson\b|\bin this instance\b|\bin this context\b/i;
const sing = (w: string) => w.toLowerCase().replace(/(ies)$/, "y").replace(/(es|s)$/, "");
/** Keyword list as shown: tidied; sentences that only talk about "this lesson" removed from a definition; a definition with a blank is
 *  dropped (the keyword stays, without one); a definition that is really ANOTHER keyword's ("Numerator: A denominator is the bottom
 *  number...", an Oak swap) is dropped for the swapped keywords; duplicate keywords removed. */
export function cleanKeywords(kws: KWd[]): KWd[] {
  const seen = new Set<string>();
  const list: KWd[] = [];
  for (const x of kws) {
    const k = tidy(x.k).replace(/\s+/g, " ").trim(); if (!k || seen.has(k.toLowerCase())) continue; seen.add(k.toLowerCase());
    let d = tidy(x.d).replace(/\s+/g, " ").trim();
    if (d) { const keep = d.split(SENT_SPLIT).filter((s) => !CONTEXT_SENT.test(s)); d = keep.join(" ").trim(); }
    const c = d ? CORR.get(norm(d)) : undefined; if (c) d = c.fix ?? "";
    if (d && (BLANKS.test(d.replace(/\.\.\./g, "")) || JUNK.test(d) || JUNK.test(k) || DIAGRAM_REF.test(d) || /^(?:use|ensure|encourage) (?:the|a|an|your|these|this|those)\b/i.test(d) || /\*\*/.test(d))) d = "";
    if (d && (tautology(k, d) || teacherFacing(k, d))) d = ""; // Q5: "Taste is the ability to taste things", "a task in which the student responds to…"
    if (badPronunciationKeyword(k, d)) continue; // Q2: a sound-symbol keyword with a wrong example word (oakFixes.ts)
    list.push({ k, d });
  }
  // swapped definitions: the definition's grammatical subject is another keyword of the lesson, and not this one
  const subj = (d: string) => { const m = /^(?:an?|the)?\s*([^.,:;()]{2,40}?)\s+(?:is|are|means|refers to)\b/i.exec(d); return m ? sing(m[1].trim()) : ""; };
  const names = list.map((x) => sing(x.k));
  const bad = new Set<number>();
  list.forEach((x, i) => { if (!x.d) return; const s = subj(x.d); if (s && s !== names[i] && !mentions(x.d, x.k) && names.some((n, j) => j !== i && n === s)) bad.add(i); });
  return list.map((x, i) => (bad.has(i) ? { k: x.k, d: "" } : x));
}

// ── grammar helpers ──────────────────────────────────────────────────────────
const VOWEL_LETTER = new Set("AEFHILMNORSX".split(""));
/** Does the first word start with a vowel SOUND ("an hour", "a unit", "an X-ray", "an RNA")? */
export function vowelSound(phrase: string): boolean {
  const w = phrase.trim().split(/[\s/]+/)[0] ?? "";
  if (!w) return false;
  if (/^(?:8|11|18)/.test(w)) return true;
  if (/^\d/.test(w)) return false;
  if (/^[A-Z]{2,}\b/.test(w) || /^[a-z][A-Z]{2,}/.test(w) || /^[A-Z]-/.test(w)) return VOWEL_LETTER.has(w.charAt(0).toUpperCase());
  if (/^(?:hour|honest|honour|heir)/i.test(w)) return true;
  if (/^(?:uni(?:[^aeiou]|$)|use|usu|uti|eu|one\b|once\b|ur[aeiu])/i.test(w)) return false;
  return /^[aeiou]/i.test(w);
}
const IRR_PL = new Set("bacteria criteria phenomena nuclei alveoli fungi stomata bacilli mitochondria vertebrae larvae genera hyphae formulae indices vertices analyses hypotheses people children men women teeth feet mice lice cacti".split(" "));
const AMBIG = new Set("species series means sheep fish offspring deer aircraft data media".split(" "));
const SG_S = new Set("lens gas bias atlas canvas diabetes herpes mumps measles news physics genetics mathematics electronics economics politics".split(" "));
/** Grammatical number of a key word / phrase, or null when it cannot be told ("data", "species", "Double / doubling"). */
export function numberOf(phrase: string): "sg" | "pl" | null {
  if (/\s\/\s/.test(phrase)) return null;
  const head = phrase.replace(/\s*\([^)]*\)/g, "").split(/\s+(?:of|in|for|on|with|by|from|between|to|per|and)\s+/i)[0].trim();
  const w = (head.split(/[\s/-]+/).pop() ?? "").toLowerCase().replace(/[^\p{L}]/gu, "");
  if (!w || AMBIG.has(w)) return null;
  if (IRR_PL.has(w)) return "pl";
  if (SG_S.has(w) || /(?:ss|us|is|as|os|ics|ous)$/.test(w)) return "sg";
  return w.endsWith("s") ? "pl" : "sg";
}
/** What the words around a blank demand: an article (a / an) and/or a number (a / each -> singular, these / two -> plural, is -> singular, are -> plural). */
export interface BlankCtx { article: "a" | "an" | null; number: "sg" | "pl" | null; conflict: boolean; /** false = the clue has no blank (a plain "which word means this?"), nothing to agree with */ blank: boolean }
export function blankContext(before: string, after: string): BlankCtx {
  const pre = /(?:^|[^\p{L}])(a|an|each|every|one|another|this|that|these|those|many|several|both|two|three|four|five|six|few|various|numerous)\s*$/iu.exec(before);
  const post = /^\s*(is|has|was|does|isn't|are|have|were|do)\b/i.exec(after);
  const art = pre && /^(a|an)$/i.test(pre[1]) ? (pre[1].toLowerCase() as "a" | "an") : null;
  const numPre = pre ? (/^(a|an|each|every|one|another|this|that)$/i.test(pre[1]) ? "sg" : "pl") : null;
  const numPost = post ? (/^(is|has|was|does|isn't)$/i.test(post[1]) ? "sg" : "pl") : null;
  return { article: art, number: numPre ?? numPost, conflict: !!numPre && !!numPost && numPre !== numPost, blank: true };
}
/** Do these options all fit one blank? (same a/an sound, one grammatical number when the context demands it or both are known.) */
export function optionsFit(ctx: BlankCtx, options: string[]): boolean {
  if (!ctx.blank) return true;
  if (ctx.conflict) return false;
  if (ctx.article && !options.every((o) => vowelSound(o) === (ctx.article === "an"))) return false;
  const nums = options.map(numberOf);
  if (ctx.number) return nums.every((n) => n === ctx.number);
  const known = nums.filter(Boolean);
  return new Set(known).size <= 1;
}

// ── the KIND of a key word (Q5): a wrong option must be the same kind of word as the answer (noun / verb / adjective, number word or
// not, grammar label with a digit or not), or the check is trivial ("million" for "theory", "to muse" for "transience") ─────────────
export interface WordKind { pos: "noun" | "verb" | "adj" | "adv" | null; num: boolean; digit: boolean }
const NUM_WORD = /^(?:zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand|million|billion|dozen|half|halves|quarter|third|fifth|tenth|first|second|once|twice|double|triple)s?$/i;
export function wordKind(k: string, d: string): WordKind {
  const name = k.replace(/\s*\([^)]*\)/g, "").trim();
  const ws = name.toLowerCase().split(/[\s/-]+/).filter(Boolean);
  const num = (ws.length > 0 && ws.every((w) => NUM_WORD.test(w) || /^\d+(?:st|nd|rd|th)?$/.test(w))) || /^\d/.test(name);
  const digit = /\d/.test(name);
  const def = d.trim().toLowerCase();
  let pos: WordKind["pos"] = null;
  if (/^to \p{L}/u.test(name) || /^to \p{L}/u.test(def) || /^(?:when|if) (?:you|we|someone|somebody) \p{L}/u.test(def) || /^(?:a|the) (?:verb|word) (?:that |which )?(?:means|meaning) to\b/.test(def)) pos = "verb";
  else if (/^(?:describes|describing|something that is|someone who is|having|being|relating to|able to|capable of|not |very |extremely |used to describe|of or relating|full of|without)\b/.test(def)) pos = "adj";
  else if (/^in a (?:\p{L}+ )?(?:way|manner)\b/u.test(def) || (ws.length === 1 && /ly$/.test(ws[0]) && !/^(?:a|an|the) /.test(def))) pos = "adv";
  else if (/^(?:a|an|the|one|some|any|another|each|every|this|these) \p{L}/u.test(def)) pos = "noun";
  if (!pos && ws.length === 1) {
    const w = ws[0];
    if (/(?:tion|sion|ment|ness|ity|ism|ist|ance|ence|ure|ship|hood|ology|graph|gram)s?$/.test(w)) pos = "noun";
    else if (/(?:ous|ful|less|ive|able|ible|ical)$/.test(w)) pos = "adj";
    else if (/(?:ise|ize|ify)$/.test(w)) pos = "verb";
  }
  return { pos, num, digit };
}
/** Same kind of word? (unknown part of speech = no objection) */
export const sameKind = (a: WordKind, b: WordKind) => a.num === b.num && a.digit === b.digit && (!a.pos || !b.pos || a.pos === b.pos);

const PROPER = /^(?:pythagoras|newton|hooke|celsius|kelvin|fahrenheit|venn|euclid|ohm|joule|watt|einstein|darwin|mendel|bunsen|petri|punnett|carnot|coulomb|faraday|fleming|lamarck|pasteur|fibonacci|cartesian|roman|arabic|imperial|earth|sun|moon|mars|jupiter|saturn|venus|mercury|neptune|uranus|milky|british|european|euro|pound|gothic|le chatelier|hubble|kepler|copernicus|galileo|mendeleev|rutherford|bohr|thomson|dalton|geiger)/i;
/** A proper noun / name-like key word (its capital letter is part of the word and must not be lower-cased or mixed with common nouns). */
export const isProperName = (k: string) => PROPER.test(k.trim()) || /\s\p{Lu}\p{Ll}/u.test(k.replace(/\s*\([^)]*\)/g, "").trim()); // Q4: "Nanny of the Maroons", "Le Chatelier's principle": a capital inside the phrase is a name

// ── confusable families: two terms of one family can often complete / describe the same thing (Q1 review) ─────────────────────
const FAMILIES: string[][] = [
  ["length", "width", "height", "depth", "distance", "perimeter", "thickness", "breadth", "radius", "diameter", "circumference"],
  ["gradient", "slope", "rate of change", "steepness", "speed", "velocity", "acceleration"],
  ["displacement", "vector", "resultant", "translation", "magnitude", "direction", "scalar"],
  ["ratio", "fraction", "proportion", "proportionality", "percentage", "scale", "decimal", "rate"],
  ["bar chart", "pie chart", "line graph", "scatter", "histogram", "pictogram", "tally", "polygon", "stem and leaf", "box plot", "time series", "table", "graph", "chart", "diagram", "data"],
  ["mean", "median", "mode", "average", "range", "quartile"],
  ["add", "addition", "plus", "sum", "total", "altogether", "addend", "more", "increase"],
  ["subtract", "subtraction", "minus", "difference", "take away", "less", "fewer", "decrease", "minuend", "subtrahend"],
  ["multiple", "product", "factor", "times", "multiply", "multiplication", "divide", "division", "quotient", "divisor", "dividend"],
  ["part", "whole", "fraction", "unit fraction", "piece", "section", "portion", "share", "half", "quarter", "third"],
  ["sine", "cosine", "tangent", "trigonometric", "trigonometry", "hypotenuse", "opposite", "adjacent"],
  ["acid", "alkali", "base", "neutral", "salt", "ph"],
  ["anode", "cathode", "electrode", "electrolyte", "electrolysis", "cation", "anion", "ion"],
  ["diffusion", "osmosis", "active transport", "concentration gradient"],
  ["enzyme", "protein", "catalyst", "amino acid", "carbohydrate", "lipid", "fat", "glucose", "starch", "sugar"],
  ["weight", "mass", "force", "gravity", "pressure", "density", "volume"],
  ["heat", "temperature", "thermal", "energy", "power", "work", "joule"],
  ["atom", "element", "compound", "molecule", "mixture", "substance", "particle", "ion"],
  ["mitosis", "meiosis", "cell division", "cell cycle"],
  ["habitat", "environment", "ecosystem", "community", "population", "biodiversity", "niche"],
  ["living", "alive", "animal", "plant", "organism", "mammal", "human", "vertebrate", "invertebrate", "species", "insect", "bird", "fish"],
  ["food", "nutrient", "diet", "exercise", "health", "healthy", "hygiene", "water", "air", "light", "warmth", "shade", "sunlight", "soil"],
  ["plastic", "metal", "wood", "glass", "material", "rock", "fabric", "paper", "object"],
  ["climate change", "global warming", "greenhouse", "carbon dioxide", "pollution", "carbon footprint", "emission", "fossil fuel", "renewable", "sustainable"],
  ["skeleton", "spine", "skull", "bone", "rib", "backbone", "joint", "muscle", "organ", "heart", "lung"],
  ["root", "stem", "leaf", "flower", "petal", "seed", "fruit", "shoot", "bud", "trunk", "branch", "tree", "wildflower"],
  ["solid", "liquid", "gas", "state", "melting", "freezing", "boiling", "evaporation", "condensation", "soluble", "insoluble", "dissolve"],
  ["reflection", "refraction", "absorption", "transmission", "wave", "wavelength", "frequency", "amplitude", "ray"],
  ["hazard", "risk", "danger", "precaution", "safety"],
  ["prediction", "hypothesis", "conclusion", "evidence", "variable", "result", "investigation", "observation", "measurement", "accuracy", "precision", "reliable", "valid", "fair test"],
];
const wordsOf = (s: string) => s.toLowerCase().replace(/\s*\([^)]*\)/g, "").match(/[\p{L}\p{N}]+/gu) ?? [];
const familiesOfName = (name: string) => {
  const w = wordsOf(name); const lower = name.toLowerCase();
  const out = new Set<number>();
  FAMILIES.forEach((fam, i) => { for (const m of fam) { const mw = m.split(" "); if (mw.length > 1 ? lower.includes(m) : w.some((x) => x === m || (m.length >= 4 && x.startsWith(m)) || (x.length >= 4 && m.startsWith(x)))) { out.add(i); break; } } });
  return out;
};
/** Do the two key words belong to one confusable family (length / width, gradient / rate of change, water / warmth, pie chart / bar chart...)? */
export function confusable(a: string, b: string): boolean {
  const fa = familiesOfName(a); if (!fa.size) return false;
  for (const i of familiesOfName(b)) if (fa.has(i)) return true;
  return false;
}

// ── word-stem helpers for leak / relatedness checks ──────────────────────────
const STOPW = new Set("that this with from what when which their there they them then than have been were will would could should your about into some more also each other these those only where while because between".split(" "));
/** Content words (>= 4 letters, not a stop word) of a text, lower-cased. */
export const contentWords = (s: string) => (s.replace(/[{}]|\*\*/g, "").toLowerCase().match(/\p{L}{4,}/gu) ?? []).filter((w) => !STOPW.has(w));
/** Do two words share a stem (one is an inflection / derivation of the other)? Short words must match in full. */
export function sameStem(a: string, b: string): boolean {
  a = a.toLowerCase(); b = b.toLowerCase();
  if (a === b) return true;
  const short = Math.min(a.length, b.length);
  if (short < 3) return false;
  const p = short <= 4 ? short : Math.max(4, short - 2);
  return a.slice(0, p) === b.slice(0, p) && Math.abs(a.length - b.length) <= 4;
}
/** Is `w` a derived form of the answer word `a` (vexed / vexation, culturally / cultural, superstitious / superstition): the same root once
 *  common suffixes are stripped? Only used for LEAK checks (a derived form left in a clue gives the answer away). Q4. */
const SUFFIX = /(?:ations?|ation|isations?|ising|ised|ise|ition|tion|sion|ness|ments?|ities|ity|ally|ly|ous|ive|ing|ed|es|s|al|ic|er|est|ful|less)$/;
const root = (w: string) => { const r = w.toLowerCase().replace(SUFFIX, "").replace(/([b-df-hj-np-tv-z])\1$/, "$1"); return r.length >= 3 ? r : w.toLowerCase(); };
export const derivedForm = (w: string, a: string) => { if (sameStem(w, a)) return true; const rw = root(w), ra = root(a); return rw.length >= 3 && rw === ra; };
/** Does `text` mention the key word / phrase `k` (in any inflected form)? */
export function mentions(text: string, k: string): boolean {
  const kw = k.toLowerCase().replace(/\s*\([^)]*\)/g, "").split(/[\s/-]+/).filter((x) => x.length >= 3);
  if (!kw.length) return false;
  const tw = text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
  return kw.every((x) => tw.some((t) => sameStem(t, x)));
}

// ── Oak quiz questions → hub question fields (pure; import.ts adds tenant / provenance / topic) ─────────────────────────────
export interface Part { type?: string; text?: string; imageObject?: { secureUrl?: string; url?: string; metadata?: Record<string, unknown> } }
export interface RawQ { questionId?: unknown; questionUid?: string; questionType?: string; questionStem?: Part[]; answers?: Record<string, unknown[]> | null; feedback?: string; hint?: string }
export type OakKind = "single" | "multi" | "short" | "match" | "order";
export interface OakQOut { doc: Record<string, unknown>; kind: OakKind; hasImage: boolean; optImgs: number }
const OPT_IDS = ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k", "l"];
export const BLANK = "_____";
const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);
const uniq = <T>(xs: T[]) => [...new Set(xs)];
const lcq = (s: unknown) => String(s ?? "").trim().toLowerCase();
const partsText = (ps: Part[] | undefined, sep: string, cm: (s: string) => string) => (ps ?? []).filter((p) => p.type === "text" && typeof p.text === "string").map((p) => cm(p.text as string).replace(/\{\{[^}]*\}\}/g, BLANK).trim()).filter(Boolean).join(sep).trim();
function partsImage(ps: Part[] | undefined, alt: string): { url: string; alt: string } | null {
  for (const p of ps ?? []) if (p.type === "image") {
    const url = p.imageObject?.secureUrl || p.imageObject?.url;
    if (url) return { url: url.replace(/^http:/, "https:"), alt: String(p.imageObject?.metadata?.altText ?? p.imageObject?.metadata?.alt ?? "").trim() || alt };
  }
  return null;
}
/** One Oak question → hub question fields (prompt, image, options / answer / acceptedAnswers / pairs / items, explanation, hint),
 *  or a reason it cannot be imported. `cm` makes LaTeX readable. */
export function convertOakQuestion(q: RawQ, cm: (s: string) => string): OakQOut | string {
  const type = q.questionType ?? "";
  if (!q.answers || typeof q.answers !== "object") return "no answers";
  if (q.questionId === undefined || q.questionId === null) return "no question id";
  const prompt = partsText(q.questionStem, "\n", cm) || "";
  const img = partsImage(q.questionStem, "Picture for this question");
  if (!prompt && !img) return "empty question";
  const base = {
    prompt: clip(prompt || "Look at the picture.", 5000), image: img, marks: 1, published: true,
    explanation: clip(cm(String(q.feedback ?? "")).trim(), 5000), ...(q.hint ? { hint: clip(cm(String(q.hint)).trim(), 1000) } : {}),
    tolerance: 0, acceptedAnswers: [] as string[], options: [] as unknown[], answer: null as unknown,
  };
  let kind: OakKind; let extra: Record<string, unknown> = {}; let optImgs = 0;
  if (type === "multiple-choice") {
    const raw = ((q.answers["multiple-choice"] ?? []) as { answer?: Part[]; answerIsCorrect?: boolean }[]).slice(0, OPT_IDS.length);
    if (raw.length < 2) return "multiple-choice with <2 options";
    const options = raw.map((a, i) => {
      const oi = partsImage(a.answer, "Picture option");
      if (oi) optImgs++;
      return { id: OPT_IDS[i], text: clip(partsText(a.answer, " ", cm), 500), ...(oi ? { image: oi } : {}), _ok: a.answerIsCorrect === true };
    });
    if (options.some((o) => !o.text && !("image" in o))) return "multiple-choice option with no text or picture";
    const right = options.filter((o) => o._ok).map((o) => o.id);
    if (!right.length) return "multiple-choice with no correct option";
    if (new Set(options.map((o) => `${o.text}|${(o as { image?: { url: string } }).image?.url ?? ""}`)).size !== options.length) return "multiple-choice with duplicate options";
    kind = right.length === 1 ? "single" : "multi";
    extra = { options: options.map(({ _ok, ...o }) => o), answer: kind === "single" ? right[0] : right };
  } else if (type === "short-answer") {
    const raw = ((q.answers["short-answer"] ?? []) as { answer?: Part[]; answerIsDefault?: boolean }[]).map((a) => ({ t: clip(partsText(a.answer, " ", cm), 500), d: a.answerIsDefault === true })).filter((a) => a.t);
    if (!raw.length) return "short-answer with no text answer";
    const main = raw.find((a) => a.d) ?? raw[0];
    kind = "short";
    extra = { answer: main.t, acceptedAnswers: uniq(raw.filter((a) => a !== main && a.t !== main.t).map((a) => a.t)).slice(0, 20) };
  } else if (type === "match") {
    // hub limits (lib/hubKinds.ts): 3–8 pairs, ≤300 chars a side, no pair written twice. Never clip a key — drop instead.
    const raw = ((q.answers.match ?? []) as { correctChoice?: Part[]; matchOption?: Part[] }[]).map((m) => ({ term: partsText(m.matchOption, " ", cm), definition: partsText(m.correctChoice, " ", cm) }));
    if (raw.length < 3) return "match with <3 pairs (hub minimum)";
    if (raw.length > 8) return "match with >8 pairs (hub maximum)";
    if (raw.some((m) => !m.term || !m.definition)) return "match with a picture-only side";
    if (raw.some((m) => m.term.length > 300 || m.definition.length > 300)) return "match side >300 chars";
    if (new Set(raw.map((m) => `${lcq(m.term)}␟${lcq(m.definition)}`)).size !== raw.length) return "match with a repeated pair";
    kind = "match"; extra = { pairs: raw };
  } else if (type === "order") {
    const raw = ((q.answers.order ?? []) as { answer?: Part[]; correctOrder?: number }[]).map((o, i) => ({ t: partsText(o.answer, " ", cm), n: Number(o.correctOrder) || i + 1 }));
    if (raw.length < 2 || raw.length > 8) return "order with <2 or >8 items";
    if (raw.some((o) => !o.t)) return "order with a picture-only item";
    if (raw.some((o) => o.t.length > 300)) return "order item >300 chars";
    if (new Set(raw.map((o) => o.t)).size !== raw.length) return "order with a repeated item";
    kind = "order"; extra = { items: raw.sort((a, b) => a.n - b.n).map((o) => o.t) };
  } else return `unsupported question type "${type}"`;
  return { doc: { ...base, ...extra }, kind, hasImage: !!img || optImgs > 0, optImgs };
}
