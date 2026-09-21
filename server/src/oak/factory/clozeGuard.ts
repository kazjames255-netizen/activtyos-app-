// Q2 (English + French / Spanish / German content QA, 2026-09-20): extra safety guards for the generated fill-the-gap ("Quick check")
// items. Pure functions, no I/O. Used by generate.ts `cloze()`; validate.ts re-checks the same predicates on the finished item.
//
// WHY: a blanked key word is only a fair question when exactly ONE option can complete the sentence. In English (and in language
// lessons taught in English) the wrong options are other key words of the unit, and "the theme / the moral", "the past tense / the first
// person", "a tentative / a sinister explanation", "the perfect tense / the simple present" can all complete the same sentence. A
// sentence that DEFINES the blanked term ("A ___ is a big idea...") pins the answer down through its own wording; a sentence that merely
// MENTIONS the term does not. So the generator only blanks the term of a defining sentence (or a quoted foreign word in a "means" sentence),
// never lets two options come from one confusable family, and never offers an adjective as the wrong option for an adjective.

/** The subjects these guards apply to (Maths / Science are Q1's; their fill-the-gap rules are unchanged). */
export const LANG_SUBJECTS = new Set(["English", "French", "Spanish", "German"]);

/** The words that follow the blank in a DEFINING sentence ("A ___ is ...", "___ means ...", "___ refers to ..."). */
const DEFINING_AFTER = /^["'’”]?\s*(?:is|are|means|refers to|describes|involves|is called|are called|is known as|are known as|can be defined as|is defined as|is the (?:name|term|word)|are the (?:name|term|words))\b/i;
/** ...and the words before a blank that names / labels something ("is called a ___", "known as the ___", "We call this ___"). */
const NAMING_BEFORE = /(?:\b(?:is|are|was|were)\s+(?:called|known as|named|referred to as|defined as)|\bwe call (?:this|these|it|them|that)|\bthe (?:term|word|name) for [^,.;]{1,60} is)\s+(?:an?\s+|the\s+)?["'‘“]?$/i;
/** A quoted foreign word in a "means / is / are" statement: "'___' means 'to have'", "The forms of '___' are 'tengo'...", "... is '___' - we go". */
const QUOTE_BEFORE = /["'‘“]$/;
const QUOTE_AFTER = /^["'’”]\s*(?:means|is|are|=|[-–—]\s|\+|:)/i;
const IS_QUOTE_BEFORE = /\b(?:is|are|means|=)\s+["'‘“]$/i;

/** Is the blank the term being defined / named (or a quoted foreign word in a means-statement)? Only then is the item fair. */
export function definitionalBlank(before: string, after: string): boolean {
  const b = before.replace(/\s+$/, "");
  // the blank is the term (or the last word of a short term: "Language ___ means ...") at the start of the sentence
  const startsSentence = /^\s*(?:["'‘“]\s*)?(?:(?:an?|the)\s+)?(?:[\p{L}'-]+\s+){0,2}["'‘“]?$/iu.test(b);
  if (startsSentence && DEFINING_AFTER.test(after.trimStart())) return true;
  if (NAMING_BEFORE.test(before)) return true;
  if (QUOTE_BEFORE.test(b) && QUOTE_AFTER.test(after.trimStart())) return true;
  if (IS_QUOTE_BEFORE.test(b) && /^["'’”]/.test(after.trimStart())) return true;
  return false;
}

/** A blank glued to a slash ("3rd person singular/plural" with the first half blanked) reads as a different, ungrammatical sentence. */
export function slashAdjacent(before: string, after: string): boolean {
  return /[/]\s*$/.test(before) || /^\s*[/]/.test(after);
}

// ── confusable families: two terms of one family can complete the same sentence ─────────────────────────────────────────────
const FAMILIES: [string, RegExp][] = [
  ["verb-form", /\b(?:tenses?|persons?|preterite|imperfect|conditional|subjunctive|indicative|gerund|participle|infinitive|perfect|1st|2nd|3rd|first person|second person|third person|singular|plural|continuous|progressive|simple past|simple present|present|past|future)\b/i],
  ["word-class", /^(?:(?:proper|common|abstract|collective|concrete|possessive|relative|reflexive|personal|indefinite|demonstrative|direct object|indirect object|subject|object|negative subject)\s+)?(?:nouns?|verbs?|adjectives?|adverbs?|pronouns?|prepositions?|conjunctions?|determiners?|articles?|interjections?|word class|modal verbs?|auxiliary verbs?|quantifiers?)(?:\s*\([^)]*\))?$/i],
  ["sentence", /\b(?:simple|compound|complex)\s+sentences?\b|\b(?:main|subordinate|relative|non-finite|adverbial|independent|dependent)\s+clauses?\b|\b(?:statements?|questions?|commands?|exclamations?|exclamatives?|imperatives?|interrogatives?)\b|\bsentences?\b|\bclauses?\b|\bphrases?\b/i],
  ["text-type", /\b(?:stor(?:y|ies)|poems?|poetry|songs?|rhymes?|texts?|narratives?|tales?|fiction|non-fiction|plays?|novels?|novellas?|myths?|mythology|legends?|fables?|reports?|recounts?|diar(?:y|ies)|letters?|speech(?:es)?|essays?|instructions?|articles?|biograph(?:y|ies)|adverts?|scripts?|dialogue|monologue|genres?|verse|haiku|limerick|sonnet|folklore)\b/i],
  ["message", /\b(?:themes?|morals?|messages?|lessons?|ideas?|topics?|concepts?|motifs?|symbols?|symbolism|meanings?|viewpoints?|point of view|opinions?|perspectives?|arguments?|theses|thesis|purpose|intentions?)\b/i],
  ["voice", /\b(?:voice|tone|mood|atmosphere|style|register|diction|language|vocabulary|imagery|description|effects?|emphasis|pace|rhythm|flow)\b/i],
  ["punctuation", /\b(?:comma|full stop|apostrophe|colon|semicolon|semi-colon|dash(?:es)?|brackets?|hyphen|exclamation mark|question mark|speech marks?|inverted commas|ellipsis|punctuation|capital letters?)s?\b/i],
  ["sound", /\b(?:phonemes?|graphemes?|syllables?|vowels?|consonants?|digraphs?|trigraphs?|blends?|letters?|sounds?|prefix(?:es)?|suffix(?:es)?|root words?|spellings?|ssc|sfc|sfe)\b|^\[/i],
  ["story-parts", /\b(?:characters?|settings?|plot|narrators?|beginning|middle|climax|resolution|opening|build-up|problem|ending)\b/i],
  ["case", /\b(?:nominative|accusative|dative|genitive|case)\b/i],
  ["article", /\barticles?\b|\bdeterminers?\b/i],
  ["device", /\b(?:simile|metaphor|personification|alliteration|onomatopoeia|hyperbole|irony|repetition|foreshadowing|pathetic fallacy|oxymoron|juxtaposition|anaphora)s?\b/i],
  ["evidence", /\b(?:evidence|quotations?|quotes?|references?|examples?|analysis|inferences?|context|explanations?|comments?|points?)\b/i],
];
const familiesOf = (term: string) => FAMILIES.filter(([, re]) => re.test(term.trim())).map(([id]) => id);
/** Do two terms belong to one confusable family (so either could fit the same sentence)? */
export function sameFamily(a: string, b: string): boolean {
  const fa = familiesOf(a);
  if (!fa.length) return false;
  const fb = new Set(familiesOf(b));
  return fa.some((f) => fb.has(f));
}

// ── adjectives ───────────────────────────────────────────────────────────────
const ADJ_SUFFIX = /(?:ive|ful|ous|al|ic|ent|ant|ary|ed|less|able|ible|ish|ing|ile|ate|ual|ular|esque|like)$/i;
/** A single word that looks like an adjective (by its ending). */
export const adjectiveLike = (w: string) => !/[\s/-]/.test(w.trim()) && w.trim().length >= 5 && ADJ_SUFFIX.test(w.trim());
const FUNCTION_AFTER = new Set("is are was were be been can could should must may might will would to of in on at for and or but that which who whom whose when where because so as by with from than the a an it its their his her helps means has have had does do not also then this these those if while whilst although though yet".split(" "));
/** Is the blank followed by a noun (an attributive slot: "a ___ explanation")? Any adjective could then complete it. */
export function attributiveSlot(after: string): boolean {
  const m = /^\s*([\p{L}'-]+)/u.exec(after);
  return !!m && !FUNCTION_AFTER.has(m[1].toLowerCase());
}
/** May `cand` be offered as a WRONG option for `answer`? False for two adjectives (both can describe the same noun) and for any
 *  adjective-like option in an attributive slot; false for two terms of one confusable family. */
export function distractorClash(answer: string, cand: string, after: string): boolean {
  if (sameFamily(answer, cand)) return true;
  const ca = adjectiveLike(cand);
  if (ca && (adjectiveLike(answer) || attributiveSlot(after))) return true;
  return false;
}

/** Re-check of a finished fill-the-gap item (validate.ts): the blank must be definitional, not slash-glued, and no wrong option may clash. */
export function clozeProblems(q: string, options: string[], answer: number): string[] {
  const i = q.indexOf("_____");
  if (i < 0) return [];
  const before = q.slice(0, i), after = q.slice(i + 5), picked = options[answer];
  const p: string[] = [];
  if (!definitionalBlank(before, after)) p.push("blank is not the term being defined");
  if (slashAdjacent(before, after)) p.push("blank is glued to a slash");
  options.forEach((o, k) => { if (k !== answer && distractorClash(picked, o, after)) p.push(`option "${o}" can also fit ("${picked}")`); });
  return p;
}
