// X4 English pictures A: word classes, sentence structure, tense, punctuation.
// Every picture is a generic teaching diagram with neutral examples. Evidence = Oak key-word definition (scratch/oak-raw) + the drawn facts.
import type { Pic } from "./types";
import { ln, dot, arrow } from "./helpers";
import { mk, T, wrap, box, chip, row, sentence, labels, curve, est, WC } from "./ext-english-kit";

const B = "f1", G = "f2", Y = "f3", R = "f4", V = "f5", N = "f6";
const NOT_TEXT = "specific texts, authors, characters or events; only a generic example";

// ── word classes ────────────────────────────────────────────────────────────
const noun = mk({
  id: "noun", title: "Noun: a naming word", alt: "The word noun with the definition 'a naming word'. Three example nouns are labelled person (girl), place (park) and thing (ball). In the sentence 'The girl kicked the ball.' the words girl and ball are highlighted as nouns.",
  caption: "Nouns name people, places and things", concepts: ["noun", "naming word"],
  avoid: ["proper noun", "abstract noun", "expanded noun", "noun phrase", "collective noun", "pronoun"],
  doesNotShow: "proper, abstract or collective nouns; noun phrases", evidence: "Oak keyword 'noun': a naming word for people, places or things. Examples girl (person), park (place), ball (thing) are common nouns; in the sentence only girl and ball are nouns.",
  build: () => {
    let s = T(120, 18, "Noun: a naming word", "tb");
    [["person", "girl", 45], ["place", "park", 120], ["thing", "ball", 195]].forEach(([lab, w, cx]) => { s += T(cx as number, 42, lab as string, "tx tm") + row(cx as number, 47, [{ s: w as string, f: B }]).svg; });
    s += T(120, 88, "in a sentence", "tx tm");
    const se = sentence(120, 94, [{ s: "The" }, { s: "girl", f: B }, { s: "kicked" }, { s: "the" }, { s: "ball", f: B }]);
    s += se.svg + labels(120, se, [undefined, "noun", undefined, undefined, "noun"], "tx tm");
    return s;
  },
});
const nounTypes = mk({
  id: "noun-types", title: "Common and proper nouns", alt: "Two columns. Common nouns (girl, city, river) do not need a capital letter. Proper nouns (Maya, London, Thames) are the names of particular people or places and start with a capital letter.",
  caption: "A proper noun starts with a capital letter", concepts: ["proper noun", "proper nouns", "common noun", "common nouns"],
  doesNotShow: "abstract or collective nouns", evidence: "Oak keywords: 'proper noun' = a naming word that does need capitalisation; 'common noun' = a naming word that does not need a capital letter. Drawn: girl/city/river (common) and Maya/London/Thames (proper).",
  build: () => {
    let s = T(120, 18, "Common and proper nouns", "t");
    s += T(62, 40, "common noun", "ts tm") + T(178, 40, "proper noun", "ts tm");
    ["girl", "city", "river"].forEach((w, i) => { s += row(62, 48 + i * 24, [{ s: w, f: B }]).svg; });
    ["Maya", "London", "Thames"].forEach((w, i) => { s += row(178, 48 + i * 24, [{ s: w, f: G }]).svg; });
    s += ln(120, 34, 120, 118, "th");
    s += T(62, 126, "small first letter", "tx tm") + T(178, 126, "capital first letter", "tx tm");
    return s;
  },
});
const abstractNoun = mk({
  id: "abstract-noun", title: "Abstract noun", alt: "The words abstract noun, with the explanation that it names an idea or feeling that cannot be seen or touched, and four examples: kindness, freedom, courage and fear.",
  caption: "An abstract noun names an idea or quality", concepts: ["abstract noun", "abstract nouns"],
  doesNotShow: "concrete nouns; suffixes that make abstract nouns", evidence: "Oak keyword 'abstract noun': a type of noun that names an idea or quality that cannot be seen. Examples kindness, freedom, courage, fear are standard abstract nouns.",
  build: () => {
    let s = T(120, 18, "Abstract noun", "tb");
    s += wrap("names an idea, feeling or quality that you cannot see or touch", 120, 40, 40, "ts tm");
    s += row(120, 76, [{ s: "kindness", f: B }, { s: "freedom", f: B }], 6).svg + row(120, 98, [{ s: "courage", f: B }, { s: "fear", f: B }], 6).svg;
    return s;
  },
});
const verb = mk({
  id: "verb", title: "Verb: a doing or being word", alt: "The word verb with the definition 'a doing or being word'. Doing verbs shown: run, jump, write. Being verbs shown: is, am, are.",
  caption: "Verbs say what someone does or is", concepts: ["verb", "verbs", "doing verb", "being verb"],
  avoid: ["auxiliary verb", "modal verb", "verb phrase", "verb tense", "irregular verb", "adverb", "reporting verb", "verb ending", "verb suffix", "verbs ending"],
  doesNotShow: "auxiliary or modal verbs; tenses", evidence: "Oak keyword 'verb': a doing or being word. Doing verbs (run, jump, write) and being verbs (is, am, are) are standard examples.",
  build: () => {
    let s = T(120, 18, "Verb: a doing or being word", "t");
    s += T(60, 44, "doing verbs", "ts tm") + T(180, 44, "being verbs", "ts tm") + ln(120, 38, 120, 112, "th");
    ["run", "jump", "write"].forEach((w, i) => { s += row(60, 52 + i * 22, [{ s: w, f: R }]).svg; });
    ["is", "am", "are"].forEach((w, i) => { s += row(180, 52 + i * 22, [{ s: w, f: R }]).svg; });
    return s;
  },
});
const adjective = mk({
  id: "adjective", title: "Adjective: describes a noun", alt: "The word adjective with the definition 'a word that describes a noun'. In the phrase 'The shiny red kite flew.' the words shiny and red are highlighted as adjectives and kite as the noun they describe.",
  caption: "Adjectives describe nouns", concepts: ["adjective", "adjectives"],
  avoid: ["compound adjective", "possessive adjective", "comparative adjective", "superlative adjective", "adjective suffix", "suffix", "adverb", "expanded noun"],
  doesNotShow: "comparative or superlative adjectives; adjective order", evidence: "Oak keyword 'adjective': a word that describes a noun. In 'The shiny red kite flew.' shiny and red describe the noun kite.",
  build: () => {
    let s = T(120, 18, "Adjective: describes a noun", "t");
    const se = sentence(120, 62, [{ s: "The" }, { s: "shiny", f: G }, { s: "red", f: G }, { s: "kite", f: B }, { s: "flew" }]);
    s += se.svg + T((se.mids[1] + se.mids[2]) / 2, 88, "adjectives", "tx tm") + T(se.mids[3] + 4, 88, "noun", "tx tm");
    s += curve(se.mids[1], 60, se.mids[3], 60, -22, "th") + curve(se.mids[2], 60, se.mids[3] - 6, 60, -12, "th");
    s += wrap("describing words tell us more about a noun: what it looks, sounds or feels like", 120, 112, 40, "ts tm");
    return s;
  },
});
const adverb = mk({
  id: "adverb", title: "Adverb", alt: "The word adverb with the definition 'a word that describes a verb'. In the sentence 'She walked slowly.' the word slowly is highlighted as an adverb with an arrow to the verb walked. More examples: quickly, quietly, carefully.",
  caption: "An adverb tells us how, when or where", concepts: ["adverb", "adverbs"],
  avoid: ["adverbial", "fronted adverbial", "adverbial clause", "suffix", "verb suffix"],
  doesNotShow: "adverbs that describe adjectives or other adverbs; adverbials", evidence: "Oak keyword 'adverb': a word that describes a verb. In 'She walked slowly.' slowly says how the verb walked happens.",
  build: () => {
    let s = T(120, 18, "Adverb", "tb");
    const se = sentence(120, 62, [{ s: "She" }, { s: "walked", f: R }, { s: "slowly", f: Y }]);
    s += se.svg + labels(88, se, [undefined, "verb", "adverb"], "tx tm") + curve(se.mids[2], 60, se.mids[1], 60, -20, "th");
    s += T(120, 112, "more adverbs", "tx tm") + row(120, 118, [{ s: "quickly", f: Y }, { s: "quietly", f: Y }, { s: "carefully", f: Y }], 5).svg;
    return s;
  },
});
const pronoun = mk({
  id: "pronoun", title: "Pronoun", alt: "The word pronoun with the definition 'takes the place of a noun'. In the sentences 'Sam has a dog. He loves it.' the word Sam is linked by an arrow to He and the word dog to it. Example pronouns: he, she, it, they, we.",
  caption: "A pronoun takes the place of a noun", concepts: ["pronoun", "pronouns", "personal pronoun"],
  avoid: ["relative pronoun", "possessive pronoun", "reflexive pronoun"],
  doesNotShow: "relative, possessive or reflexive pronouns", evidence: "Oak keyword 'pronoun': a word that we use in place of a noun to avoid repetition, such as he, she or it. In 'Sam has a dog. He loves it.' He stands for Sam and it stands for the dog.",
  build: () => {
    let s = T(120, 18, "Pronoun: replaces a noun", "t");
    const a = sentence(120, 44, [{ s: "Sam", f: B }, { s: "has" }, { s: "a" }, { s: "dog", f: B }]);
    const b = sentence(120, 88, [{ s: "He", f: V }, { s: "loves" }, { s: "it", f: V }]);
    s += a.svg + b.svg + curve(a.mids[0], 62, b.mids[0], 86, 0, "th") + curve(a.mids[3], 62, b.mids[2], 86, 0, "th");
    s += T(120, 124, "he  she  it  they  we", "ts tm");
    return s;
  },
});
const preposition = (() => {
  const table = (cx: number, top: number) => `<rect x="${cx - 17}" y="${top}" width="34" height="5" class="l f3"/><line x1="${cx - 13}" y1="${top + 5}" x2="${cx - 13}" y2="${top + 30}" class="l"/><line x1="${cx + 13}" y1="${top + 5}" x2="${cx + 13}" y2="${top + 30}" class="l"/>`;
  const ball = (cx: number, cy: number) => `<circle cx="${cx}" cy="${cy}" r="6" class="l f4"/>`;
  return mk({
    id: "preposition", title: "Prepositions: where something is", alt: "Three small pictures of a table and a ball. The ball is on the table, under the table and beside the table, labelled with the prepositions on, under and beside.",
    caption: "Prepositions tell us where something is", concepts: ["preposition", "prepositions"],
    doesNotShow: "prepositions of time; prepositional phrases", evidence: "Oak keyword 'preposition': word or words that tell the reader where a noun is. Three drawings of position: on, under, beside.",
    build: () => {
      let s = T(120, 18, "Prepositions: where?", "tb") + T(120, 138, "the ball is ___ the table", "ts tm");
      [[42, "on"], [120, "under"], [198, "beside"]].forEach(([cx, lab], i) => {
        const c = cx as number; s += table(c, 60);
        s += i === 0 ? ball(c, 54) : i === 1 ? ball(c, 84) : ball(c + 28, 84);
        s += T(c, 112, lab as string, "ts");
      });
      return s;
    },
  });
})();
const conjunction = mk({
  id: "conjunction", title: "Conjunction: a joining word", alt: "The word conjunction, a joining word. Three rows show a conjunction joining words (salt and pepper), phrases (in the park or at home) and clauses (I was tired but I stayed up).",
  caption: "Conjunctions join words and clauses", concepts: ["conjunction", "conjunctions"],
  avoid: ["subordinating conjunction", "co-ordinating conjunction", "coordinating conjunction", "comparative conjunction"],
  doesNotShow: "subordinating vs co-ordinating conjunctions", evidence: "Oak keyword 'conjunction': a word that joins words, phrases or clauses. Examples: salt AND pepper (words), in the park OR at home (phrases), I was tired BUT I stayed up (clauses).",
  build: () => {
    let s = T(120, 18, "Conjunction: a joining word", "t");
    const rows: [string, string, string, string][] = [["words", "salt", "and", "pepper"], ["phrases", "in the park", "or", "at home"], ["clauses", "I was tired", "but", "I stayed up"]];
    rows.forEach(([lab, a, c, b], i) => {
      const y = 44 + i * 30; s += T(8, y + 12, lab, "tx tm tl");
      s += sentence(146, y, [{ s: a }, { s: c, f: Y }, { s: b }], "ts").svg;
    });
    return s;
  },
});
const determiner = mk({
  id: "determiner", title: "Determiner", alt: "The word determiner: a word that introduces a noun. Five examples pair a determiner with a noun: the dog, an apple, my hat, this pen, some pens.",
  caption: "A determiner introduces a noun", concepts: ["determiner", "determiners"],
  doesNotShow: "the different kinds of determiner (articles, possessives, quantifiers)", evidence: "Oak keyword 'determiner': a word that introduces a noun in a clause or phrase. Drawn: the dog, an apple, my hat, this pen, some pens (determiner + noun).",
  build: () => {
    let s = T(120, 18, "Determiner: introduces a noun", "t");
    s += T(72, 38, "determiner", "tx tm") + T(146, 38, "noun", "tx tm");
    [["the", "dog"], ["an", "apple"], ["my", "hat"], ["this", "pen"], ["some", "pens"]].forEach(([d, nn], i) => {
      const y = 44 + i * 21; s += box(44, y, 56, 17, N, 4) + T(72, y + 12, d, "ts") + box(118, y, 56, 17, B, 4) + T(146, y + 12, nn, "ts");
    });
    return s;
  },
});
const wordClasses = mk({
  id: "word-classes", title: "Word classes", alt: "A colour key of eight word classes with one example each: noun (dog), verb (run), adjective (big), adverb (slowly), pronoun (she), preposition (under), conjunction (and), determiner (the).",
  caption: "Word classes: what each word does", concepts: ["word class", "word classes", "parts of speech", "part of speech"],
  doesNotShow: "sub-types of each word class", evidence: "Oak keyword 'word class': different types of words that are used to form sentences. The eight classes and their examples (dog, run, big, slowly, she, under, and, the) are standard.",
  build: () => {
    let s = T(120, 18, "Word classes", "tb");
    const items: [string, string, string][] = [["noun", B, "dog"], ["verb", R, "run"], ["adjective", G, "big"], ["adverb", Y, "slowly"], ["pronoun", V, "she"], ["preposition", N, "under"], ["conjunction", N, "and"], ["determiner", N, "the"]];
    items.forEach(([nm, f, ex], i) => {
      const col = i < 4 ? 0 : 1, r = i % 4, x = 6 + col * 118, y = 34 + r * 26;
      s += box(x, y, 66, 17, f, 4) + T(x + 33, y + 12, nm, "tx") + T(x + 74, y + 12, ex, "ts tl");
    });
    return s;
  },
});
const singularPlural = mk({
  id: "singular-plural", title: "Singular and plural", alt: "Left: one circle labelled singular, meaning one, with the word cat. Right: three circles labelled plural, meaning more than one, with the word cats.",
  caption: "Singular: one. Plural: more than one", concepts: ["singular", "plural", "plurals"],
  avoid: ["possession", "possessive", "apostrophe", "third person", "first person", "verbs ending", "nouns ending", "ending in y", "ending in", "suffix", "pronoun", "-es", "es to"],
  doesNotShow: "how to spell plurals (-s, -es, irregular)", evidence: "Oak keywords: 'singular' = only one; 'plural' = more than one. Drawn: 1 circle = cat; 3 circles = cats.",
  build: () => {
    let s = T(120, 18, "Singular and plural", "t");
    s += T(60, 42, "singular", "ts tm") + T(180, 42, "plural", "ts tm") + ln(120, 34, 120, 110, "th");
    s += `<circle cx="60" cy="72" r="11" class="l f1"/>` + T(60, 104, "one cat", "ts");
    [150, 180, 210].forEach((x) => { s += `<circle cx="${x}" cy="72" r="11" class="l f1"/>`; });
    s += T(180, 104, "more than one: cats", "ts");
    return s;
  },
});
const compSup = mk({
  id: "comparative-superlative", title: "Comparing with adjectives", alt: "Three bars of increasing height labelled tall, taller and tallest. The word taller compares two things; the word tallest compares one thing with all the others.",
  caption: "Taller: two things. Tallest: all of them", concepts: ["comparative", "superlative", "comparatives", "superlatives", "comparative adjective", "superlative adjective"],
  requires: ["adjective", "adjectives", "adverb", "suffix", "grammar", "superlative"],
  avoid: ["comparative conjunction", "comparative essay", "comparative response", "comparative writing", "comparative study", "compare and contrast", "imagery", "paragraph", "analytical", "analysis", "poem", "poetry"],
  doesNotShow: "irregular forms (good, better, best); more/most forms", evidence: "Oak keywords: 'comparative' compares two things; 'superlative' = the form of an adjective that compares one noun to an entire group. Drawn: tall - taller - tallest.",
  build: () => {
    let s = T(120, 18, "Comparing with adjectives", "t");
    [[52, 36, "tall"], [120, 54, "taller"], [188, 72, "tallest"]].forEach(([cx, h, lab]) => {
      s += `<rect x="${(cx as number) - 16}" y="${118 - (h as number)}" width="32" height="${h}" class="l f2" rx="3"/>` + T(cx as number, 132, lab as string, "ts");
    });
    s += T(120, 40, "taller: two things  |  tallest: all of them", "tx tm");
    return s;
  },
});
const tenses = mk({
  id: "tense-timeline", title: "Past, present and future", alt: "A time line with three parts. Past: yesterday I walked. Present (now): today I walk. Future: tomorrow I will walk.",
  caption: "Tense shows when something happens", concepts: ["past tense", "present tense", "future tense", "tenses", "tense", "simple past tense", "simple present tense", "past and present tense"],
  avoid: ["progressive", "perfect tense", "present perfect", "past perfect", "past participle", "continuous", "auxiliary", "modal", "tense of the poem", "tensed", "tension", "nervous", "worried", "anxious", "unable to relax", "tense atmosphere", "tense mood", "tense moment"],
  doesNotShow: "progressive or perfect tenses; irregular verbs", evidence: "Oak keywords: 'past tense' = shows that the action happened before now; 'present tense' = the action is happening now. Simple tenses drawn on a time line: walked / walk / will walk.",
  build: () => {
    let s = T(120, 18, "Tense: when it happens", "t");
    s += arrow(14, 82, 226, 82, "a");
    [[46, "past", "I walked"], [120, "present", "I walk"], [194, "future", "I will walk"]].forEach(([cx, lab, ex]) => {
      s += T(cx as number, 58, lab as string, "ts") + dot(cx as number, 82, 4, "dot") + T(cx as number, 106, ex as string, "ts");
    });
    s += T(46, 72, "before now", "tx tm") + T(120, 72, "now", "tx tm") + T(194, 72, "after now", "tx tm");
    return s;
  },
});
const progressive = mk({
  id: "progressive-tense", title: "Progressive tense", alt: "Two examples of the progressive tense: 'I am walking' (present progressive) and 'I was walking' (past progressive). Each uses a form of the verb to be followed by a verb ending in -ing, showing an action in progress.",
  caption: "Progressive: an action in progress", concepts: ["progressive tense", "present progressive", "past progressive", "progressive tenses", "continuous tense"],
  doesNotShow: "the perfect progressive; when to use it", evidence: "Oak keyword 'progressive tense': a tense that denotes ongoing action. Drawn: am/was (form of 'to be') + walking (verb + -ing).",
  build: () => {
    let s = T(120, 18, "Progressive tense", "tb");
    s += T(120, 32, "an action that is going on", "ts tm");
    const a = sentence(120, 62, [{ s: "I" }, { s: "am", f: Y }, { s: "walking", f: R }]);
    const b = sentence(120, 112, [{ s: "I" }, { s: "was", f: Y }, { s: "walking", f: R }]);
    s += a.svg + T(a.mids[1], 56, "to be", "tx tm") + T(a.mids[2], 88, "verb + ing", "tx tm");
    s += b.svg + T(b.mids[1], 106, "to be", "tx tm") + T(b.mids[2], 138, "verb + ing", "tx tm");
    return s;
  },
});
const perfect = mk({
  id: "perfect-tense", title: "Perfect tense", alt: "Two examples of the perfect tense: 'I have walked' (present perfect) and 'I had walked' (past perfect). Each uses a form of the verb to have followed by the past tense form of the main verb.",
  caption: "Perfect: have or had + past form", concepts: ["perfect tense", "present perfect", "past perfect", "perfect tenses"],
  avoid: ["progressive"],
  doesNotShow: "when to choose each perfect form", evidence: "Oak keyword 'perfect tense': made using an auxiliary verb based on the infinitive 'to have' and a past tense form of the main verb. Drawn: have/had + walked.",
  build: () => {
    let s = T(120, 18, "Perfect tense", "tb");
    const a = sentence(120, 48, [{ s: "I" }, { s: "have", f: Y }, { s: "walked", f: R }]);
    const b = sentence(120, 92, [{ s: "I" }, { s: "had", f: Y }, { s: "walked", f: R }]);
    s += a.svg + T(a.mids[1], 42, "to have", "tx tm") + T(a.mids[2], 74, "past form", "tx tm");
    s += b.svg + T(b.mids[1], 86, "to have", "tx tm") + T(b.mids[2], 118, "past form", "tx tm");
    return s;
  },
});
const activePassive = mk({
  id: "active-passive", title: "Active and passive voice", alt: "Two sentences. Active: 'The dog chased the cat' with the dog as subject doing the action. Passive: 'The cat was chased by the dog' with the cat as subject receiving the action.",
  caption: "Active: does it. Passive: has it done to it", concepts: ["active voice", "passive voice", "active and passive", "active sentence", "passive sentence"],
  doesNotShow: "when to use the passive; the passive with no agent", evidence: "Oak keywords: 'active voice' = the subject does the verb; 'passive voice' = the subject is acted upon by the verb. Drawn: The dog chased the cat / The cat was chased by the dog.",
  build: () => {
    let s = T(120, 18, "Active and passive", "tb");
    s += T(120, 38, "active", "ts tm");
    const a = sentence(120, 44, [{ s: "The dog", f: B }, { s: "chased", f: R }, { s: "the cat", f: G }]);
    s += a.svg + labels(70, a, ["subject: does it", "verb", "object"], "tt tm");
    s += T(120, 90, "passive", "ts tm");
    const b = sentence(120, 96, [{ s: "The cat", f: G }, { s: "was chased by", f: R }, { s: "the dog", f: B }]);
    s += b.svg + labels(122, b, ["subject: receives it", undefined, "who did it"], "tt tm");
    return s;
  },
  capMax: 44,
});
const modal = mk({
  id: "modal-verbs", title: "Modal verbs", alt: "The nine modal verbs can, could, may, might, shall, should, will, would and must. A note says modal verbs show how likely, possible or necessary something is. Example: It might rain.",
  caption: "Modal verbs show possibility or need", concepts: ["modal verb", "modal verbs"],
  doesNotShow: "the degree of certainty of each verb", evidence: "Oak keyword 'modal verb': a type of auxiliary verb that helps us to talk about how likely, possible, necessary or obligatory something is to happen. Listed: can, could, may, might, shall, should, will, would, must.",
  build: () => {
    let s = T(120, 18, "Modal verbs", "tb");
    s += row(120, 32, [{ s: "can", f: R }, { s: "could", f: R }, { s: "may", f: R }, { s: "might", f: R }], 5).svg;
    s += row(120, 54, [{ s: "shall", f: R }, { s: "should", f: R }, { s: "will", f: R }, { s: "would", f: R }], 5).svg;
    s += row(120, 76, [{ s: "must", f: R }], 5).svg;
    s += wrap("they show how likely, possible or necessary something is", 120, 108, 44, "ts tm");
    s += sentence(120, 132, [{ s: "It" }, { s: "might", f: R }, { s: "rain." }]).svg;
    return s;
  },
});
const auxiliary = mk({
  id: "auxiliary-verbs", title: "Auxiliary verbs", alt: "Three sentences in which a helping (auxiliary) verb sits in front of the main verb: She is singing; They have finished; We will go. The auxiliary verbs are highlighted in gold and the main verbs in red.",
  caption: "An auxiliary verb helps the main verb", concepts: ["auxiliary verb", "auxiliary verbs", "helping verb"],
  doesNotShow: "the full list of auxiliary verbs", evidence: "Oak keyword 'auxiliary verb': the helping verb that is always paired with the main verb. Drawn: is + singing, have + finished, will + go.",
  build: () => {
    let s = T(120, 18, "Auxiliary (helping) verbs", "t");
    [[[{ s: "She" }, { s: "is", f: Y }, { s: "singing", f: R }]], [[{ s: "They" }, { s: "have", f: Y }, { s: "finished", f: R }]], [[{ s: "We" }, { s: "will", f: Y }, { s: "go", f: R }]]].forEach((w, i) => { s += sentence(120, 36 + i * 28, w[0]).svg; });
    s += chip(50, 124, "auxiliary", Y, "tx", 15, 5).svg + chip(122, 124, "main verb", R, "tx", 15, 5).svg;
    return s;
  },
});
void WC; void box; void est;

// ── sentences and clauses ───────────────────────────────────────────────────
const simpleSentence = mk({
  id: "simple-sentence", title: "Simple sentence (one main clause)", alt: "The sentence 'The dog barked.' split into its subject (The dog) and verb (barked). A note says a simple sentence is one main clause that makes complete sense on its own.",
  caption: "One main clause, complete sense", concepts: ["simple sentence", "simple sentences", "main clause", "main clauses"],
  avoid: ["compound", "complex", "subordinate", "co-ordinat", "coordinat"],
  doesNotShow: "compound or complex sentences; longer simple sentences", evidence: "Oak keywords: 'simple sentence' = a sentence about one idea that makes complete sense; 'main clause' = a group of words that contains a verb and makes complete sense. Drawn: The dog barked. (subject + verb).",
  build: () => {
    let s = T(120, 18, "Simple sentence", "tb");
    s += T(120, 40, "one main clause", "ts tm");
    s += box(56, 52, 128, 44, "f0", 8);
    const se = sentence(120, 66, [{ s: "The dog", f: B }, { s: "barked.", f: R }]);
    s += se.svg + labels(90, se, ["subject", "verb"], "tx tm");
    s += T(120, 118, "makes sense on its own", "ts");
    return s;
  },
});
const compoundSentence = mk({
  id: "compound-sentence", title: "Compound sentence", alt: "The compound sentence 'The sun shone, and we played outside.' drawn as two main clauses (The sun shone / we played outside) joined by the co-ordinating conjunction and, with a comma. Other co-ordinating conjunctions listed: but, or, so.",
  caption: "Two main clauses joined together", concepts: ["compound sentence", "compound sentences", "co-ordinating conjunction", "coordinating conjunction", "co-ordinating conjunctions", "coordinating conjunctions", "co-ordination", "coordination"],
  avoid: ["complex sentence", "subordinate", "subordinating"],
  doesNotShow: "the full list of co-ordinating conjunctions (for, and, nor, but, or, yet, so)", evidence: "Oak keywords: 'compound sentence' = a sentence formed of two main clauses and a co-ordinating conjunction; 'co-ordinating conjunction' = a word that joins two main clauses. Drawn: main clause + , and + main clause.",
  build: () => {
    let s = T(120, 18, "Compound sentence", "tb");
    const se = sentence(120, 44, [{ s: "The sun shone", f: B }, { s: ", and", f: Y }, { s: "we played outside.", f: B }], "tx", 22, 3);
    s += se.svg + T(se.mids[0], 82, "main clause", "tx tm") + T(se.mids[1], 82, "conjunction", "tt tm") + T(se.mids[2], 82, "main clause", "tx tm");
    s += T(120, 112, "and   but   or   so", "ts") + T(120, 126, "co-ordinating conjunctions", "tx tm");
    return s;
  },
});
const complexSentence = mk({
  id: "complex-sentence", title: "Complex sentence", alt: "The complex sentence 'The cat ran because the dog barked.' drawn as a main clause (The cat ran) followed by a subordinate clause (because the dog barked) that starts with the subordinating conjunction because. A note says the subordinate clause does not make complete sense on its own.",
  caption: "Main clause + subordinate clause", concepts: ["complex sentence", "complex sentences", "subordinate clause", "subordinate clauses", "subordinating conjunction", "subordinating conjunctions", "adverbial complex sentence", "adverbial clause", "adverbial clauses", "subordination"],
  avoid: ["relative", "non-finite", "non finite", "compound", "fronted adverbial", "co-ordinating", "coordinating"],
  doesNotShow: "relative or non-finite clauses; the subordinate clause placed first", evidence: "Oak keywords: 'complex sentence' = at least one main clause and a subordinate clause; 'subordinate clause' = contains a verb and does not make complete sense; 'adverbial clause' = a subordinate clause that starts with a subordinating conjunction. Drawn: The cat ran (main) + because the dog barked (subordinate).",
  build: () => {
    let s = T(120, 18, "Complex sentence", "tb");
    const se = sentence(120, 44, [{ s: "The cat ran", f: B }, { s: "because", f: Y }, { s: "the dog barked.", f: G }], "tx", 22, 3);
    s += se.svg + T(se.mids[0], 82, "main clause", "tx tm") + T(se.mids[1], 76, "conjunction", "tt tm") + T(se.mids[2] + 4, 82, "subordinate clause", "tx tm").replace("<text","<text");
    s += wrap("a subordinate clause does not make sense on its own", 120, 116, 44, "ts tm");
    return s;
  },
});
const relativeClause = mk({
  id: "relative-clause", title: "Relative clause", alt: "The sentence 'The dog that barked ran away.' with the relative clause 'that barked' highlighted and joined to the noun dog. The relative pronouns who, which, that, whose are listed.",
  caption: "A relative clause adds detail to a noun", concepts: ["relative clause", "relative clauses", "relative pronoun", "relative pronouns", "relative complex sentence"],
  doesNotShow: "embedded relative clauses with commas; omitted relative pronouns", evidence: "Oak keyword 'relative clause': a type of subordinate clause that starts with a relative pronoun. Drawn: The dog [that barked] ran away; relative pronouns who, which, that, whose.",
  build: () => {
    let s = T(120, 18, "Relative clause", "tb");
    const se = sentence(120, 48, [{ s: "The dog" }, { s: "that barked", f: G }, { s: "ran away." }]);
    s += se.svg + labels(74, se, [undefined, "relative clause", undefined]);
    s += T(120, 106, "relative pronouns", "tx tm") + row(120, 112, [{ s: "who", f: V }, { s: "which", f: V }, { s: "that", f: V }, { s: "whose", f: V }], 5).svg;
    return s;
  },
});
const clausePhrase = mk({
  id: "clause-phrase", title: "Clause or phrase?", alt: "Two columns. A phrase is a group of words with no verb, for example 'the tall old tree'. A clause is a group of words that contains a verb, for example 'the tree fell'.",
  caption: "A clause has a verb; a phrase has none", concepts: ["clause", "clauses", "phrase", "phrases"],
  avoid: ["quotation", "quote", "poem", "poetry", "key phrase", "language", "analyse", "analysis", "writers choice", "word or phrase", "words and phrases", "line", "verse", "relative", "subordinate", "adverbial", "main clause", "noun phrase", "fronted"],
  doesNotShow: "the kinds of clause or phrase", evidence: "Oak keywords: 'clause' = a group of words that contains a verb; 'phrase' = a group of words with no verb. Drawn: the tall old tree (phrase, no verb) vs the tree fell (clause, verb fell).",
  build: () => {
    let s = T(120, 18, "Clause or phrase?", "tb");
    s += T(60, 40, "phrase", "ts tm") + T(180, 40, "clause", "ts tm") + ln(120, 34, 120, 116, "th");
    s += box(10, 50, 100, 30, B, 6) + T(60, 69, "the tall old tree", "ts") + box(130, 50, 100, 30, G, 6);
    const c = sentence(180, 57, [{ s: "the tree" }, { s: "fell", f: R }], "ts", 16);
    s += c.svg;
    s += T(60, 96, "no verb", "ts tm") + T(180, 96, "has a verb", "ts tm");
    return s;
  },
});
const expandedNounPhrase = mk({
  id: "expanded-noun-phrase", title: "Expanded noun phrase", alt: "A noun built up in steps: 'door', then 'the door', then 'the old door', then 'the old wooden door', then 'the old wooden door with a rusty handle'. Each step adds detail to the noun door and none of them has a verb.",
  caption: "Add detail to a noun (there is no verb)", concepts: ["expanded noun phrase", "expanded noun phrases", "noun phrase", "noun phrases"],
  doesNotShow: "the order of adjectives; commas between adjectives", evidence: "Oak keyword 'expanded noun phrase': a group of words with no verb that adds detail to a noun. Drawn: door > the door > the old door > the old wooden door > the old wooden door with a rusty handle.",
  build: () => {
    let s = T(120, 18, "Expanded noun phrase", "tb");
    [["door", 0], ["the door", 0], ["the old door", 0], ["the old wooden door", 0], ["the old wooden door with a rusty handle", 1]].forEach(([w, big], i) => {
      const y = 30 + i * 22; s += box(120 - est(w as string, big ? "tx" : "ts") / 2 - 7, y, est(w as string, big ? "tx" : "ts") + 14, 17, i === 4 ? G : i === 3 ? B : "f0", 4) + T(120, y + 12, w as string, big ? "tx" : "ts");
    });
    return s;
  },
});
const frontedAdverbial = (() => {
  const rowF = (y: number, lab: string, front: string, rest: string): string => {
    const w1 = est(front, "tx") + 10; const x0 = 44;
    return T(6, y + 12, lab, "tt tm tl") + box(x0, y, w1, 17, Y, 4) + T(x0 + w1 / 2, y + 12, front, "tx") + T(x0 + w1 + 2, y + 12, ",", "ts tl") + T(x0 + w1 + 10, y + 12, rest, "tx tl");
  };
  return mk({
    id: "fronted-adverbial", title: "Fronted adverbial", alt: "Four sentences that begin with a fronted adverbial followed by a comma: 'Later that day, we went home' (time), 'Behind the shed, a cat hid' (place), 'Carefully, she opened the box' (manner) and 'Because it rained, we stayed in' (cause). The fronted adverbial in each is highlighted in gold.",
    caption: "A fronted adverbial, then a comma", concepts: ["fronted adverbial", "fronted adverbials", "fronted adverbial of time", "fronted adverbial of cause", "fronted adverbial of place", "fronted adverbial of manner", "formal fronted adverbial", "viewpoint fronted adverbial", "fronted adverbial phrase", "fronted adverbial clause", "fronted adverbial word", "adverbial", "adverbials"],
    doesNotShow: "adverbials in other positions", evidence: "Oak keyword 'fronted adverbial': a sentence starter followed by a comma (expresses detail about time, place, manner or cause). Drawn: Later that day, / Behind the shed, / Carefully, / Because it rained, each followed by a comma and a main clause.",
    build: () => {
      let s = T(120, 18, "Fronted adverbial + comma", "t");
      s += rowF(32, "time", "Later that day", "we went home.") + rowF(58, "place", "Behind the shed", "a cat hid.") + rowF(84, "manner", "Carefully", "she opened the box.") + rowF(110, "cause", "Because it rained", "we stayed in.");
      return s;
    },
  });
})();
const sentenceTypes = mk({
  id: "sentence-types", title: "Types of sentence", alt: "Three rows. Simple sentence: one main clause, for example 'The dog barked.' Compound sentence: two main clauses joined by and, but, or or so, for example 'The dog barked, and the cat ran.' Complex sentence: a main clause and a subordinate clause, for example 'The cat ran because the dog barked.'",
  caption: "Simple, compound and complex", concepts: ["sentence structure", "sentence structures", "simple compound and complex sentences", "simple and compound sentences"],
  avoid: ["declarative", "exclamatory", "interrogative", "imperative", "inversion", "asyndeton", "five sentence", "structure of the text", "text structure", "story structure", "essay structure", "poem", "poetry", "verse"],
  doesNotShow: "the function of a sentence (statement, question, command, exclamation)", evidence: "Oak keywords: simple sentence = one main clause; compound sentence = two main clauses + co-ordinating conjunction; complex sentence = main clause + subordinate clause. One neutral example each.",
  build: () => {
    let s = T(120, 18, "Sentence structures", "t");
    const r1 = sentence(120, 36, [{ s: "The dog barked.", f: B }], "tx", 18);
    const r2 = sentence(120, 76, [{ s: "The dog barked", f: B }, { s: ", and", f: Y }, { s: "the cat ran.", f: B }], "tx", 18);
    const r3 = sentence(120, 116, [{ s: "The cat ran", f: B }, { s: "because", f: Y }, { s: "the dog barked.", f: G }], "tx", 18);
    s += T(6, 30, "simple: one main clause", "tx tm tl") + r1.svg + T(6, 70, "compound: two main clauses joined", "tx tm tl") + r2.svg + T(6, 110, "complex: main + subordinate clause", "tx tm tl") + r3.svg;
    return s;
  },
});
const sentenceFunctions = mk({
  id: "sentence-functions", title: "What does the sentence do?", alt: "Four rows: a statement tells us something and ends with a full stop (The sun is hot.); a question asks and ends with a question mark (Is the sun hot?); a command tells someone what to do (Close the door.); an exclamation shows strong feeling and ends with an exclamation mark (What a hot day!).",
  caption: "Statement, question, command, exclamation", concepts: ["statement", "statements", "command", "commands", "exclamation", "exclamations", "statements and questions", "questions and commands", "sentence function", "sentence functions"],
  requires: ["sentence", "full stop", "question mark", "exclamation mark", "capital letter", "statement", "command"],
  avoid: ["thesis", "personal statement", "mission statement", "opening statement", "rhetorical", "essay", "exam", "examination", "comprehension", "commander", "command of", "topic sentence", "concluding", "direct speech"],
  doesNotShow: "sentence types by structure (simple, compound, complex); minor sentences", evidence: "Oak keywords: 'statement' = a type of simple sentence that expresses a fact or opinion and most often ends with a full stop; 'question' = asks the reader for an answer and ends with a question mark; 'command' = tells someone to do something and can end with an exclamation mark; 'exclamation' = expresses strong emotion or surprise. One neutral example each.",
  build: () => {
    let s = T(120, 18, "Four jobs of a sentence", "t");
    [["statement", "The sun is hot.", "."], ["question", "Is the sun hot?", "?"], ["command", "Close the door.", "."], ["exclamation", "What a hot day!", "!"]].forEach(([lab, ex, mark], i) => {
      const y = 30 + i * 28; s += T(6, y + 13, lab, "tx tm tl") + box(80, y, 124, 20, i % 2 ? G : B, 5) + T(142, y + 14, ex, "ts") + T(220, y + 16, mark, "tb");
    });
    return s;
  },
});
const directSpeech = mk({
  id: "direct-speech", title: "Direct speech", alt: "Two sentences with the spoken words in inverted commas: 'Come here,' said Mum. and Mum said, 'Come here.' Labels: inverted commas around the spoken words, and the reporting clause 'said Mum'. A second line shows a new speaker starting a new line.",
  caption: "Inverted commas round spoken words", concepts: ["direct speech", "inverted commas", "speech marks", "quotation marks", "reporting clause", "reporting clauses", "speech punctuation"],
  avoid: ["reported speech", "indirect speech", "quotation from", "quotations from", "embedded quotation", "analysis", "analyse", "evidence", "essay", "play script", "stage directions", "poem"],
  doesNotShow: "reported (indirect) speech; punctuating interrupted speech", evidence: "Oak keywords: 'direct speech' = a character speaking out loud in a text; 'inverted commas' = a pair of punctuation marks that signal direct speech; 'reporting clause' = tells the reader who said the speech sentence and how; 'dialogue' = written conversation between two or more characters. Drawn: “Come here,” said Mum. / Mum said, “Come here.”",
  build: () => {
    let s = T(120, 18, "Direct speech", "tb");
    s += box(8, 30, 224, 30, "f0", 6) + T(20, 50, "“Come here,” said Mum.", "t tl");
    s += box(8, 66, 224, 30, "f0", 6) + T(20, 86, "Mum said, “Come here.”", "t tl");
    s += T(120, 108, "inverted commas: round the spoken words", "tx");
    s += T(120, 122, "reporting clause: who spoke (said Mum)", "tx tm");
    s += T(120, 136, "new speaker = new line", "tx tm");
    return s;
  },
});
const reportedSpeech = mk({
  id: "reported-speech", title: "Reported speech", alt: "Direct speech, 'I am tired,' said Sam, compared with reported speech, Sam said that he was tired. In reported speech there are no inverted commas.",
  caption: "Reported speech: no inverted commas", concepts: ["reported speech", "indirect speech"],
  doesNotShow: "all the tense and pronoun changes", evidence: "Oak keyword 'reported speech': when we write what someone said without using the exact words they spoke and without using inverted commas. Drawn: “I am tired,” said Sam. > Sam said that he was tired.",
  build: () => {
    let s = T(120, 18, "Reported speech", "tb");
    s += T(120, 40, "direct speech", "tx tm") + box(10, 46, 220, 26, "f0", 6) + T(120, 63, "“I am tired,” said Sam.", "ts");
    s += arrow(120, 76, 120, 92, "a", 7);
    s += T(120, 106, "reported speech", "tx tm") + box(10, 112, 220, 26, G, 6) + T(120, 129, "Sam said that he was tired.", "ts");
    return s;
  },
});

// ── punctuation ─────────────────────────────────────────────────────────────
const punct = mk({
  id: "punctuation-marks", title: "Punctuation marks", alt: "A reference list of punctuation marks with their names: full stop, comma, question mark, exclamation mark, apostrophe, inverted commas, colon, semi-colon, brackets, hyphen and dash.",
  caption: "Punctuation marks and their names", concepts: ["punctuation", "punctuation mark", "punctuation marks"],
  avoid: ["poem", "poetry"],
  doesNotShow: "how each mark is used", evidence: "Oak keyword 'punctuation'. The names (full stop, comma, question mark, exclamation mark, apostrophe, inverted commas, colon, semi-colon, brackets, hyphen, dash) match Oak's keywords for each mark.",
  build: () => {
    let s = T(120, 16, "Punctuation marks", "t");
    const items: [string, string][] = [[".", "full stop"], [",", "comma"], ["?", "question mark"], ["!", "exclamation mark"], ["’", "apostrophe"], ["“ ”", "inverted commas"], [":", "colon"], [";", "semi-colon"], ["( )", "brackets"], ["-", "hyphen"], ["–", "dash"]];
    items.forEach(([m, nm], i) => {
      const col = i < 6 ? 0 : 1, r = i < 6 ? i : i - 6, x = 4 + col * 124, y = 24 + r * 20;
      s += box(x, y, 26, 17, B, 4) + T(x + 13, y + 13, m, "ts") + T(x + 31, y + 12, nm, "tx tl");
    });
    return s;
  },
});
const fullStop = mk({
  id: "full-stop", title: "Full stop and capital letter", alt: "The sentence 'The sun is hot.' with an arrow to the capital letter T at the start, and an arrow to the full stop at the end. A note says a full stop ends a sentence.",
  caption: "Capital letter first, full stop last", concepts: ["full stop", "full stops", "capital letters and full stops"],
  avoid: ["question mark", "exclamation"],
  doesNotShow: "other end marks", evidence: "Oak keyword 'full stop': a punctuation mark used at the end of a sentence. Drawn: capital T at the start and full stop at the end of 'The sun is hot.'",
  build: () => {
    let s = T(120, 18, "Full stop", "tb");
    s += box(30, 40, 180, 30, "f0", 6) + T(120, 61, "The sun is hot.", "t");
    s += T(44, 96, "capital letter", "tx tl") + ln(60, 88, 69, 64, "th") + T(184, 96, "full stop", "tx te") + ln(180, 88, 172, 66, "th");
    s += T(120, 128, "a full stop ends a sentence", "ts tm");
    return s;
  },
});
const questionMark = mk({
  id: "question-mark", title: "Question mark", alt: "The question 'Is the sun hot?' with a large question mark at the end. A note says a question mark ends a question.",
  caption: "A question mark ends a question", concepts: ["question mark", "question marks"],
  doesNotShow: "other end marks", evidence: "Oak keyword 'question mark': a punctuation mark used at the end of a question. Drawn: Is the sun hot?",
  build: () => {
    let s = T(120, 18, "Question mark", "tb");
    s += box(30, 40, 180, 30, "f0", 6) + T(112, 61, "Is the sun hot", "t") + T(186, 63, "?", "tb") + `<rect x="177" y="43" width="18" height="24" class="l f3" rx="3" style="fill-opacity:.35"/>`;
    s += T(120, 100, "it goes at the end of a question", "ts tm");
    return s;
  },
});
const exclamation = mk({
  id: "exclamation-mark", title: "Exclamation mark", alt: "Two examples ending in an exclamation mark: 'What a hot day!' (an exclamation showing strong feeling) and 'Stop!' (a command). A note says an exclamation mark shows strong emotion or surprise.",
  caption: "An exclamation mark shows strong feeling", concepts: ["exclamation mark", "exclamation marks"],
  doesNotShow: "when not to use one", evidence: "Oak keywords: 'exclamation mark' = a punctuation mark used to express strong emotion; 'command' can end with an exclamation mark. Drawn: What a hot day! / Stop!",
  build: () => {
    let s = T(120, 18, "Exclamation mark", "tb");
    s += box(30, 36, 180, 28, B, 6) + T(120, 55, "What a hot day!", "t") + box(30, 72, 180, 28, B, 6) + T(120, 91, "Stop!", "t");
    s += T(120, 124, "strong feeling, surprise or a loud command", "tx tm");
    return s;
  },
});
const comma = mk({
  id: "comma", title: "Comma", alt: "Three uses of the comma: separating items in a list (red, blue, green and pink), after a fronted adverbial (Later that day, we left), and in speech (Hello, said Sam, with a comma inside the closing inverted commas).",
  caption: "Some jobs of a comma", concepts: ["comma", "commas"],
  avoid: ["inverted commas", "parenthesis", "brackets", "comma splice", "commas for parenthesis"],
  doesNotShow: "every use of a comma", evidence: "Oak keyword 'comma': a punctuation mark used after any fronted adverbial. Also standard: commas separate items in a list and mark the end of spoken words before the closing inverted commas. Drawn: red, blue, green and pink / Later that day, we left. / “Hello,” said Sam.",
  build: () => {
    let s = T(120, 18, "Comma", "tb");
    s += T(120, 38, "in a list", "tx tm") + box(20, 42, 200, 22, B, 5) + T(120, 57, "red, blue, green and pink", "ts");
    s += T(120, 78, "after a fronted adverbial", "tx tm") + box(20, 82, 200, 22, B, 5) + T(120, 97, "Later that day, we left.", "ts");
    s += T(120, 118, "in speech", "tx tm") + box(20, 122, 200, 22, B, 5) + T(120, 137, "“Hello,” said Sam.", "ts");
    return s;
  },
  capMax: 46,
});
const colon = mk({
  id: "colon", title: "Colon", alt: "A colon introducing a list: 'You will need: a pen, some paper, a ruler.' A note says a colon can introduce a list or a question.",
  caption: "A colon can introduce a list", concepts: ["colon", "colons"],
  avoid: ["semi-colon", "semicolon", "semi colon", "colon cancer"],
  doesNotShow: "colons before explanations or quotations", evidence: "Oak keyword 'colon': a piece of punctuation placed after a main clause that can introduce a list or a question. Drawn: You will need: a pen, some paper, a ruler.",
  build: () => {
    let s = T(120, 18, "Colon", "tb");
    s += T(120, 60, ":", "tb") + box(6, 68, 228, 30, "f0", 6) + T(120, 88, "You will need: a pen, some paper, a ruler.", "tx");
    s += T(120, 118, "after a main clause: introduces a list", "ts tm");
    return s;
  },
});
const semicolon = mk({
  id: "semi-colon", title: "Semi-colon", alt: "A semi-colon joining two closely related main clauses: 'The sun set; the sky turned red.' with each main clause boxed.",
  caption: "A semi-colon joins two related main clauses", concepts: ["semi-colon", "semi-colons", "semicolon", "semicolons"],
  avoid: ["colon cancer"],
  doesNotShow: "semi-colons in complicated lists", evidence: "Oak keyword 'semi-colon': a piece of punctuation that can join two closely-related main clauses. Drawn: The sun set; the sky turned red.",
  build: () => {
    let s = T(120, 18, "Semi-colon", "tb");
    s += box(10, 50, 96, 30, B, 6) + T(58, 70, "The sun set", "ts") + T(120, 71, ";", "tb") + box(134, 50, 96, 30, B, 6) + T(182, 70, "the sky turned red.", "tx");
    s += T(58, 96, "main clause", "tx tm") + T(182, 96, "main clause", "tx tm");
    s += T(120, 124, "the two ideas are closely related", "ts tm");
    return s;
  },
});
const hyphen = mk({
  id: "hyphen", title: "Hyphen", alt: "Two words joined by a short hyphen: 'a well-known author' and 'a man-eating shark'. A note says a hyphen joins words together, for example to make a compound adjective.",
  caption: "A hyphen joins words together", concepts: ["hyphen", "hyphens", "hyphenated"],
  avoid: ["dash", "dashes"],
  doesNotShow: "the difference between a hyphen and a dash; every use of a hyphen", evidence: "Oak keyword 'hyphen': a punctuation mark that can be used to form compound adjectives. Drawn: a well-known author, a man-eating shark.",
  build: () => {
    let s = T(120, 18, "Hyphen", "tb");
    s += box(20, 42, 200, 28, "f0", 6) + T(120, 62, "a well-known author", "t");
    s += box(20, 78, 200, 28, "f0", 6) + T(120, 98, "a man-eating shark", "t");
    s += T(120, 128, "a short line that joins words", "ts tm");
    return s;
  },
});
const parenthesis = mk({
  id: "parenthesis", title: "Parenthesis (extra information)", alt: "One sentence with extra information added in three ways: 'The dog (a small terrier) barked.' with brackets, 'The dog – a small terrier – barked.' with dashes, and 'The dog, a small terrier, barked.' with commas. A note says the sentence still makes sense if the extra information is removed.",
  caption: "Extra information: brackets, dashes, commas", concepts: ["parenthesis", "brackets", "bracket", "dashes", "dash", "parenthetical"],
  avoid: ["hyphen", "square brackets", "dash cam"],
  doesNotShow: "double commas in longer sentences", evidence: "Oak keywords: 'parenthesis' = additional information that is added to a sentence; if it is removed, the sentence still makes sense; 'brackets' and 'dashes' add extra information. Drawn: The dog (a small terrier) barked. / The dog – a small terrier – barked. / The dog, a small terrier, barked.",
  build: () => {
    let s = T(120, 18, "Parenthesis", "tb");
    [["brackets", "The dog (a small terrier) barked."], ["dashes", "The dog – a small terrier – barked."], ["commas", "The dog, a small terrier, barked."]].forEach(([lab, ex], i) => {
      const y = 30 + i * 30; s += T(6, y + 14, lab, "tx tm tl") + box(50, y, 184, 22, "f0", 5) + T(142, y + 15, ex, "tx");
    });
    s += T(120, 128, "take it out and the sentence still works", "tx tm");
    return s;
  },
});
const apostrophe = mk({
  id: "apostrophe", title: "Apostrophe", alt: "Two jobs of an apostrophe. Contraction: 'do not' becomes 'don't', the apostrophe takes the place of the missing letter o. Possession: 'the girl's hat' shows the hat belongs to the girl.",
  caption: "Missing letters, or belonging", concepts: ["apostrophe", "apostrophes"],
  avoid: ["plural possession", "plural possessive", "apostrophe for plural", "plural nouns ending"],
  doesNotShow: "its / it's; apostrophes with plural nouns", evidence: "Oak keyword 'apostrophe': a punctuation mark used to show contraction or possession. Drawn: do not > don't (o missing); the girl's hat (the hat belongs to the girl).",
  build: () => {
    let s = T(120, 18, "The apostrophe", "tb");
    s += T(60, 40, "contraction", "ts tm") + T(180, 40, "possession", "ts tm") + ln(120, 34, 120, 112, "th");
    s += T(60, 66, "do not", "ts") + arrow(60, 72, 60, 86, "a", 7) + T(60, 108, "don’t", "t");
    s += T(60, 124, "a letter is missing", "tx tm");
    s += T(180, 66, "the girl’s hat", "ts") + T(180, 92, "the hat belongs", "tx tm") + T(180, 104, "to the girl", "tx tm");
    return s;
  },
});
const apostropheContraction = mk({
  id: "apostrophe-contraction", title: "Apostrophe for contraction", alt: "Three contractions with the missing letters marked: do not becomes don't (o missing), I am becomes I'm (a missing), it is becomes it's (i missing). The apostrophe takes the place of the missing letters.",
  caption: "The apostrophe replaces missing letters", concepts: ["apostrophe for contraction", "apostrophes for contraction", "contraction", "contractions", "contracted form", "contracted forms", "contract"],
  avoid: ["possession", "possessive", "contraction of", "muscle", "poem"],
  doesNotShow: "irregular contractions (won't, can't)", evidence: "Oak keywords: 'apostrophe for contraction' = a punctuation mark used to contract two words together; 'contraction' = two words pushed together. Drawn: do not > don't, I am > I'm, it is > it's (missing letters o, a, i).",
  build: () => {
    let s = T(120, 18, "Apostrophe for contraction", "t");
    [["do not", "don’t", "o"], ["I am", "I’m", "a"], ["it is", "it’s", "i"]].forEach(([a, b, m], i) => {
      const y = 44 + i * 32; s += T(50, y, a as string, "t") + arrow(88, y - 4, 128, y - 4, "a", 7) + T(168, y, b as string, "t") + T(212, y, `${m} missing`, "tx tm");
    });
    s += T(120, 140, "two words pushed together", "ts tm");
    return s;
  },
  capMax: 46,
});
const apostropheSingular = mk({
  id: "apostrophe-possession", title: "Apostrophe for singular possession", alt: "Two examples of an apostrophe followed by s showing that one owner has something: the girl's hat (the hat belongs to the girl) and the dog's bone (the bone belongs to the dog).",
  caption: "One owner: add apostrophe + s", concepts: ["apostrophe for possession", "apostrophes for possession", "apostrophe for singular possession", "singular possession", "possession", "possessive apostrophe"],
  requires: ["apostrophe", "apostrophes", "possessive apostrophe"],
  avoid: ["plural possession", "plural nouns", "contraction", "possessive pronoun", "possessive adjective", "possession of"],
  doesNotShow: "plural possession; irregular plurals", evidence: "Oak keywords: 'apostrophe for possession' = a punctuation mark used to show if a noun belongs to another noun; 'possession' = the state of owning something. Drawn: the girl's hat, the dog's bone (one owner + ’s).",
  build: () => {
    let s = T(120, 18, "Apostrophe for possession", "t");
    s += T(120, 38, "one owner", "ts tm");
    [["the girl’s hat", "the hat belongs to the girl"], ["the dog’s bone", "the bone belongs to the dog"]].forEach(([a, b], i) => {
      const y = 46 + i * 44; s += box(30, y, 180, 26, B, 6) + T(120, y + 18, a, "t") + T(120, y + 38, b, "tx tm");
    });
    return s;
  },
});
const apostrophePlural = mk({
  id: "apostrophe-plural-possession", title: "Apostrophe for plural possession", alt: "Two examples: one girl, the girl's hats (apostrophe before the s), and two girls, the girls' hats (apostrophe after the s). A note says for a plural noun that ends in s the apostrophe comes after the s.",
  caption: "Plural noun ending in s: apostrophe after", concepts: ["plural possession", "plural possessive", "apostrophe for plural possession", "plural possessives"],
  requires: ["apostrophe", "apostrophes"],
  doesNotShow: "irregular plurals (children's)", evidence: "Standard KS2 rule (National Curriculum, Y3/4): for a plural noun ending in s the apostrophe follows the s. Drawn: the girl’s hats (one girl) vs the girls’ hats (more than one girl).",
  build: () => {
    let s = T(120, 18, "Plural possession", "tb");
    s += T(60, 42, "one owner", "ts tm") + T(180, 42, "more than one owner", "ts tm") + ln(120, 34, 120, 100, "th");
    s += T(60, 66, "the girl’s hats", "ts") + T(180, 66, "the girls’ hats", "ts");
    s += T(60, 82, "apostrophe before s", "tx tm") + T(180, 82, "apostrophe after s", "tx tm");
    s += T(120, 124, "plural noun that ends in s", "ts tm");
    return s;
  },
});
const capitals = mk({
  id: "capital-letters", title: "Capital and lower case letters", alt: "Three pairs of letters, each showing a capital (upper case) letter and the matching lower case letter: A a, B b and C c. Labels: capital letter (upper case) and lower case letter.",
  caption: "Capital and lower case letters", concepts: ["capital letter", "capital letters", "lower case letter", "lower case letters", "upper case letter", "upper case letters", "upper case", "lower case"],
  avoid: ["formation of", "starts with a capital", "capital city", "capital punishment", "proper noun"],
  doesNotShow: "how to form the letters; when to use capitals", evidence: "Oak keyword 'capital letter': the upper case formation of a letter. Drawn: A a, B b, C c with both cases labelled.",
  build: () => {
    let s = T(120, 18, "Capital and lower case", "tb");
    [["A", "a", 45], ["B", "b", 120], ["C", "c", 195]].forEach(([u, l, cx]) => {
      s += box((cx as number) - 24, 34, 48, 48, B, 8) + T(cx as number, 68, `${u} ${l}`, "tb");
    });
    s += T(120, 102, "capital letter = upper case", "ts") + T(120, 118, "small letter = lower case", "ts");
    return s;
  },
});

export const PIC_A: Pic[] = [noun, nounTypes, abstractNoun, verb, adjective, adverb, pronoun, preposition, conjunction, determiner, wordClasses, singularPlural, compSup, tenses, progressive, perfect, activePassive, modal, auxiliary,
  simpleSentence, compoundSentence, complexSentence, relativeClause, clausePhrase, expandedNounPhrase, frontedAdverbial, sentenceTypes, sentenceFunctions, directSpeech, reportedSpeech,
  punct, fullStop, questionMark, exclamation, comma, colon, semicolon, hyphen, parenthesis, apostrophe, apostropheContraction, apostropheSingular, apostrophePlural, capitals];
void NOT_TEXT; void WC;
