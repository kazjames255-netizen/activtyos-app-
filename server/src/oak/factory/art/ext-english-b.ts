// X4 English pictures B: word-level (affixes, spelling patterns, word relationships) and phonics.
// Generic teaching diagrams only: every picture is valid for ANY slide about the named concept and never depicts a specific text.
import type { Pic } from "./types";
import { ln, arrow, path } from "./helpers";
import { mk, T, wrap, box, row, sentence, est } from "./ext-english-kit";

const B = "f1", G = "f2", Y = "f3", R = "f4", V = "f5", N = "f6";

/** "a + b = c" word sum, centred at (120, y) */
const eq = (y: number, a: string, b: string, c: string, fa = "f0", fb = Y, fc = G) => sentence(120, y, [{ s: a, f: fa }, { s: "+" }, { s: b, f: fb }, { s: "=" }, { s: c, f: fc }], "ts", 18, 2).svg;
/** a word as letter squares; highlight = [start, length] letters (or list of index groups) */
function letters(cx: number, y: number, word: string, hi: number[] = [], fill = G, size = 17, gapAt?: number[]): { svg: string; x0: number; w: number } {
  const w = word.length * (size + 1) - 1; const x0 = cx - w / 2; let s = "";
  [...word].forEach((ch, i) => { s += box(x0 + i * (size + 1), y, size, size + 2, hi.includes(i) ? fill : "f0", 3) + T(x0 + i * (size + 1) + size / 2, y + size - 2, ch, "ts"); });
  void gapAt;
  return { svg: s, x0, w };
}
const bracket = (x1: number, x2: number, y: number, c = "th2") => `<path d="M${x1} ${y - 4} L${x1} ${y} L${x2} ${y} L${x2} ${y - 4}" class="${c}" fill="none"/>`;

const prefix = mk({
  id: "prefix", title: "Prefix", alt: "A word sum with three boxes: a prefix, plus a root word, makes a new word. A note says a prefix is a group of letters added to the start of a root word to change its meaning.",
  caption: "A prefix goes at the start of a word", concepts: ["prefix", "prefixes"],
  doesNotShow: "any particular prefix or its meaning", evidence: "Oak keyword 'prefix': a letter or group of letters added to the start of a root word to change its meaning. Drawn: prefix + root word = new word (no specific letters).",
  build: () => {
    let s = T(120, 18, "Prefix", "tb");
    s += sentence(120, 44, [{ s: "prefix", f: Y }, { s: "+" }, { s: "root word", f: B }, { s: "=" }, { s: "new word", f: G }], "ts", 20, 3).svg;
    s += wrap("a prefix is added to the START of a root word and changes its meaning", 120, 92, 44, "ts tm");
    return s;
  },
});
const suffix = mk({
  id: "suffix", title: "Suffix", alt: "A word sum with three boxes: a root word, plus a suffix, makes a new word. A note says a suffix is a group of letters added to the end of a root word to change its meaning.",
  caption: "A suffix goes at the end of a word", concepts: ["suffix", "suffixes"],
  doesNotShow: "any particular suffix, or spelling rules when adding one", evidence: "Oak keyword 'suffix': a letter or group of letters added to the end of a word to change its meaning. Drawn: root word + suffix = new word (no specific letters).",
  build: () => {
    let s = T(120, 18, "Suffix", "tb");
    s += sentence(120, 44, [{ s: "root word", f: B }, { s: "+" }, { s: "suffix", f: Y }, { s: "=" }, { s: "new word", f: G }], "ts", 20, 3).svg;
    s += wrap("a suffix is added to the END of a root word and changes its meaning", 120, 92, 44, "ts tm");
    return s;
  },
});
const rootWord = mk({
  id: "root-word", title: "Root word", alt: "The root word play in the centre with four words built from it: playing, played, player and replay. A note says a root word is the base word other words are made from by adding prefixes or suffixes.",
  caption: "Other words grow from a root word", concepts: ["root word", "root words", "base word"],
  doesNotShow: "Latin or Greek roots", evidence: "Oak keyword 'root word': the base word from which other words are formed, often by adding prefixes or suffixes. Drawn: play > playing, played, player, replay.",
  build: () => {
    let s = T(120, 18, "Root word", "tb");
    s += box(90, 62, 60, 24, B, 8) + T(120, 79, "play", "t");
    [[60, 40, "playing"], [180, 40, "played"], [60, 116, "player"], [180, 116, "replay"]].forEach(([x, y, w]) => {
      s += ln(x === 60 ? 92 : 148, y === 40 ? 66 : 82, x as number, (y as number) + (y === 40 ? 16 : 0), "th") + row(x as number, y as number, [{ s: w as string, f: G }]).svg;
    });
    return s;
  },
});
const prefixUn = mk({
  id: "prefix-un", title: "The prefix un-", alt: "Three word sums using the prefix un: un plus happy makes unhappy, un plus lock makes unlock, un plus kind makes unkind. The root word does not change.",
  caption: "un + root word = a new word", concepts: ["prefix un"],
  avoid: ["=non", "=dis", "=mis"],
  doesNotShow: "other prefixes; the meaning of un (not)", evidence: "Oak KS1 lesson 'Using and spelling the prefix un-' (keywords prefix, root word). Drawn: un + happy = unhappy, un + lock = unlock, un + kind = unkind (no spelling change).",
  build: () => {
    let s = T(120, 18, "The prefix un-", "tb");
    s += eq(38, "un", "happy", "unhappy", Y, B, G) + eq(68, "un", "lock", "unlock", Y, B, G) + eq(98, "un", "kind", "unkind", Y, B, G);
    s += T(120, 130, "the root word is spelt the same", "ts tm");
    return s;
  },
});
const sfx = (id: string, title: string, sfxLabel: string, ex: [string, string, string][], concepts: string[], extra: Partial<Parameters<typeof mk>[0]>, ev: string, note: string) => mk({
  id, title, alt: `Three word sums using the suffix ${sfxLabel}: ${ex.map(([a, b, c]) => `${a} plus ${b} makes ${c}`).join(", ")}.`, caption: note, concepts, doesNotShow: "spelling changes (dropping e, doubling the consonant, changing y to i)",
  evidence: ev, ...extra,
  build: () => { let s = T(120, 18, title, title.length > 22 ? "t" : "tb"); ex.forEach(([a, b, c], i) => { s += eq(40 + i * 30, a, b, c, B, Y, G); }); return s; },
});
const suffixEd = sfx("suffix-ed", "The suffix -ed", "-ed", [["walk", "ed", "walked"], ["jump", "ed", "jumped"], ["play", "ed", "played"]], ["suffix ed", "suffixes ed"], { avoid: ["suffix ing", "suffix er", "suffix est", "suffix y", "=ing", "=er", "=est", "=ly", "=ful", "=less"] }, "Oak KS1 lesson 'Using and spelling suffixes: -ed' (keywords suffix, past tense, root word). Drawn: walk + ed = walked, jump + ed = jumped, play + ed = played (no spelling change).", "-ed makes a verb past tense");
const suffixIng = sfx("suffix-ing", "The suffix -ing", "-ing", [["help", "ing", "helping"], ["jump", "ing", "jumping"], ["play", "ing", "playing"]], ["suffix ing", "suffixes ing"], { avoid: ["suffix ed", "suffix er", "suffix est", "suffix y", "=ed", "=er", "=est", "=ly", "=ful", "=less"] }, "Oak KS1 lesson 'Using and spelling suffixes: -ing' (keywords root word, suffix, syllable). Drawn: help + ing = helping, jump + ing = jumping, play + ing = playing (no spelling change).", "-ing added to a root word");
const suffixLy = sfx("suffix-ly", "The suffix -ly", "-ly", [["quick", "ly", "quickly"], ["slow", "ly", "slowly"], ["kind", "ly", "kindly"]], ["suffix ly", "suffixes ly"], { avoid: ["=ful", "=less", "=ed", "=ing"] }, "Oak KS1 lesson 'Using and spelling suffixes: -ly' (keywords suffix, adverb, adjective). Drawn: quick + ly = quickly, slow + ly = slowly, kind + ly = kindly (no spelling change).", "-ly added to an adjective");
const suffixFul = sfx("suffix-ful", "The suffix -ful", "-ful", [["care", "ful", "careful"], ["help", "ful", "helpful"], ["joy", "ful", "joyful"]], ["suffix ful", "suffixes ful"], { avoid: ["=less", "=ed", "=ing", "=ly"] }, "Oak KS1 lesson 'Using and spelling suffixes: -ful' (keywords suffix, adjective, noun). Drawn: care + ful = careful, help + ful = helpful, joy + ful = joyful (no spelling change; -ful has one l).", "-ful means full of");
const suffixLess = sfx("suffix-less", "The suffix -less", "-less", [["care", "less", "careless"], ["help", "less", "helpless"], ["hope", "less", "hopeless"]], ["suffix less", "suffixes less"], { avoid: ["=ful", "=ed", "=ing", "=ly"] }, "Oak KS1 lesson 'Using and spelling suffixes: -less' (keywords suffix, adjective, noun). Drawn: care + less = careless, help + less = helpless, hope + less = hopeless (no spelling change).", "-less means without");
const suffixMent = sfx("suffix-ment-ness", "Suffixes -ment and -ness", "-ment and -ness", [["enjoy", "ment", "enjoyment"], ["excite", "ment", "excitement"], ["kind", "ness", "kindness"]], ["suffix ment", "suffixes ment", "suffix ness", "suffixes ness"], {}, "Oak KS1 lesson 'Using and spelling suffixes: -ment and -ness' (keywords root word, noun, suffix). Drawn: enjoy + ment = enjoyment, excite + ment = excitement, kind + ness = kindness (each root word keeps its spelling).", "-ment and -ness make nouns");
const iesEnd = mk({
  id: "y-to-ies", title: "Words ending in y: -ies", alt: "Two rows. Nouns ending in a consonant plus y change the y to i and add es: baby becomes babies, city becomes cities. Verbs ending in a consonant plus y do the same: cry becomes cries, try becomes tries.",
  caption: "Change y to i and add -es", concepts: ["nouns ending in y", "verbs ending in y", "words ending in y"],
  doesNotShow: "words with a vowel before the y (boys, plays)", evidence: "Oak KS1 lessons 'Adding -es to nouns ending in y' / 'to verbs ending in y'. Rule: consonant + y > change y to i, add es (baby → babies, city → cities, cry → cries, try → tries).",
  build: () => {
    let s = T(120, 18, "Ending in y: y becomes i + es", "t");
    s += T(120, 40, "nouns", "ts tm") + row(120, 46, [{ s: "baby → babies", f: B }, { s: "city → cities", f: B }], 6, "tx").svg;
    s += T(120, 88, "verbs", "ts tm") + row(120, 94, [{ s: "cry → cries", f: R }, { s: "try → tries", f: R }], 6, "tx").svg;
    s += T(120, 132, "the y is after a consonant", "ts tm");
    return s;
  },
});
const doubling = mk({
  id: "doubling-consonant", title: "Doubling the consonant", alt: "Four word sums where the last consonant of a short root word is doubled before the suffix: hop plus ing makes hopping, run plus ing makes running, big plus er makes bigger, sun plus y makes sunny.",
  caption: "Short vowel + one consonant: double it", concepts: ["doubling the consonant", "double the consonant", "doubling consonants", "doubling the final consonant"],
  doesNotShow: "words that do not double (longer words, long vowels)", evidence: "Oak KS1 lesson 'Doubling the consonant with suffixes' and the slide text 'if the root word has a short vowel and ends in a consonant, the consonant is doubled'. Drawn: hop+ing=hopping, run+ing=running, big+er=bigger, sun+y=sunny.",
  build: () => {
    let s = T(120, 18, "Doubling the last consonant", "t");
    [["hop", "ing", "hopping"], ["run", "ing", "running"], ["big", "er", "bigger"], ["sun", "y", "sunny"]].forEach(([a, b, c], i) => { s += eq(38 + i * 26, a, b, c, B, Y, G); });
    return s;
  },
});
const compound = mk({
  id: "compound-word", title: "Compound words", alt: "Three compound words made by joining two whole words: sun plus flower makes sunflower, foot plus ball makes football, rain plus coat makes raincoat.",
  caption: "Two words joined make one word", concepts: ["compound word", "compound words"],
  doesNotShow: "hyphenated or open compounds", evidence: "Oak keyword 'compound word': two or more words joined together. Drawn: sun + flower = sunflower, foot + ball = football, rain + coat = raincoat.",
  build: () => {
    let s = T(120, 18, "Compound word", "tb");
    s += eq(40, "sun", "flower", "sunflower", B, B, G) + eq(70, "foot", "ball", "football", B, B, G) + eq(100, "rain", "coat", "raincoat", B, B, G);
    return s;
  },
});
const synonym = mk({
  id: "synonym", title: "Synonyms", alt: "Three pairs of words with the same or similar meaning joined by a two-way arrow: big and large, happy and glad, small and tiny.",
  caption: "Synonyms: words with similar meanings", concepts: ["synonym", "synonyms"],
  doesNotShow: "shades of meaning between synonyms", evidence: "Oak keyword 'synonym': a word that has the same or similar meaning to another word. Drawn: big/large, happy/glad, small/tiny.",
  build: () => {
    let s = T(120, 18, "Synonym: same meaning", "t");
    [["big", "large"], ["happy", "glad"], ["small", "tiny"]].forEach(([a, b], i) => { const y = 34 + i * 30; s += row(64, y, [{ s: a, f: B }]).svg + row(176, y, [{ s: b, f: G }]).svg + ln(94, y + 8, 146, y + 8, "th") + arrow(146, y + 8, 148, y + 8, "l", 6) + arrow(94, y + 8, 92, y + 8, "l", 6); });
    return s;
  },
});
const antonym = mk({
  id: "antonym", title: "Antonyms", alt: "Three pairs of words with opposite meanings joined by a two-way arrow: hot and cold, up and down, happy and sad.",
  caption: "Antonyms: words with opposite meanings", concepts: ["antonym", "antonyms"],
  doesNotShow: "gradable antonyms", evidence: "Oak keyword 'antonym': a word that has the opposite meaning to another word. Drawn: hot/cold, up/down, happy/sad.",
  build: () => {
    let s = T(120, 18, "Antonym: opposite meaning", "t");
    [["hot", "cold"], ["up", "down"], ["happy", "sad"]].forEach(([a, b], i) => { const y = 34 + i * 30; s += row(64, y, [{ s: a, f: R }]).svg + row(176, y, [{ s: b, f: B }]).svg + arrow(94, y + 8, 146, y + 8, "l", 6) + arrow(146, y + 8, 94, y + 8, "l", 6); });
    return s;
  },
});
const homophone = mk({
  id: "homophone", title: "Homophones", alt: "Three pairs of words that sound the same but are spelt differently and mean different things: see and sea, flour and flower, write and right.",
  caption: "Same sound, different spelling", concepts: ["homophone", "homophones"],
  avoid: ["near homophone", "near-homophone"],
  doesNotShow: "near-homophones; how to tell which one to use", evidence: "Oak keyword 'homophone': words that sound the same but have different meanings and spellings. Drawn: see/sea, flour/flower, write/right.",
  build: () => {
    let s = T(120, 18, "Homophones", "tb");
    [["see", "sea"], ["flour", "flower"], ["write", "right"]].forEach(([a, b], i) => { const y = 34 + i * 30; s += row(64, y, [{ s: a, f: B }]).svg + T(120, y + 12, "=", "t") + row(176, y, [{ s: b, f: G }]).svg; });
    s += T(120, 132, "they sound the same", "ts tm");
    return s;
  },
});
const homonym = mk({
  id: "homonym", title: "Homonyms", alt: "The word bark twice: one meaning is the outside of a tree, the other is the sound a dog makes. A note says homonyms are spelt the same but have different meanings.",
  caption: "Same spelling, different meanings", concepts: ["homonym", "homonyms"],
  doesNotShow: "homographs vs homophones", evidence: "Oak keyword 'homonym': a word that has the same spelling but a different meaning to another word. Drawn: bark (of a tree) / bark (sound a dog makes).",
  build: () => {
    let s = T(120, 18, "Homonym", "tb");
    s += box(14, 40, 96, 40, B, 8) + T(62, 58, "bark", "t") + T(62, 72, "of a tree", "tx tm") + box(130, 40, 96, 40, G, 8) + T(178, 58, "bark", "t") + T(178, 72, "a dog’s noise", "tx tm");
    s += T(120, 66, "=", "t") + T(120, 108, "spelt the same", "ts tm") + T(120, 122, "different meanings", "ts tm");
    return s;
  },
});
const wordFamily = mk({
  id: "word-family", title: "Word families", alt: "Two word families. A spelling-pattern family: cake, lake, make, take all end in -ake. A meaning family: play, played, player, playing all built on the root play.",
  caption: "Words that share a pattern or meaning", concepts: ["word family", "word families"],
  avoid: ["family tree"],
  doesNotShow: "any particular unit's word families", evidence: "Oak keyword 'word family': a group of words common in feature, pattern or meaning. Drawn: cake, lake, make, take (pattern -ake); play, played, player, playing (meaning).",
  build: () => {
    let s = T(120, 18, "Word family", "tb");
    s += T(120, 40, "same pattern", "ts tm") + row(120, 46, [{ s: "cake", f: B }, { s: "lake", f: B }, { s: "make", f: B }, { s: "take", f: B }], 4).svg;
    s += T(120, 88, "same root", "ts tm") + row(120, 94, [{ s: "play", f: G }, { s: "played", f: G }, { s: "player", f: G }], 4).svg;
    return s;
  },
});
const syllable = mk({
  id: "syllable", title: "Syllables", alt: "Three words split into beats with a dot above each beat: cat has one syllable, rab-bit has two, but-ter-fly has three.",
  caption: "A syllable is one beat in a word", concepts: ["syllable", "syllables", "polysyllabic"],
  doesNotShow: "syllable rules (open/closed)", evidence: "Oak keyword 'syllable': a single sound or beat in a word that contains a vowel sound; 'polysyllabic': a word with more than one syllable. Drawn: cat | rab-bit | but-ter-fly, one dot per beat.",
  build: () => {
    let s = T(120, 18, "Syllables: beats in a word", "t");
    [["cat"], ["rab", "bit"], ["but", "ter", "fly"]].forEach((parts, i) => {
      const y = 46 + i * 34; const ws = parts.map((p) => Math.round(est(p, "ts") + 14)); const tot = ws.reduce((a, b) => a + b, 0) + 2 * (parts.length - 1); let x = 120 - tot / 2;
      parts.forEach((p, k) => { s += `<circle cx="${x + ws[k] / 2}" cy="${y - 7}" r="3.2" class="fs"/>` + box(x, y, ws[k], 18, k % 2 ? G : B, 4) + T(x + ws[k] / 2, y + 13, p, "ts"); x += ws[k] + 2; });
    });
    s += T(120, 148, "clap the beats", "ts tm");
    return s;
  },
});
const digraph = mk({
  id: "digraph", title: "Digraphs", alt: "Five words with the digraph highlighted, two letters that make one sound: ship (sh), chip (ch), thin (th), rain (ai), feet (ee).",
  caption: "A digraph: two letters, one sound", concepts: ["digraph", "digraphs", "diagraph", "diagraphs"],
  avoid: ["split digraph", "split diagraph"],
  doesNotShow: "trigraphs; split digraphs; the sounds themselves", evidence: "Oak keyword 'digraph': two letters that represent one sound. Drawn: ship (sh), chip (ch), thin (th), rain (ai), feet (ee) with the two letters highlighted.",
  build: () => {
    let s = T(120, 18, "Digraph: two letters, one sound", "t");
    const rows: [string, number[], number, number][] = [["ship", [0, 1], 60, 40], ["chip", [0, 1], 60, 74], ["thin", [0, 1], 60, 108], ["rain", [1, 2], 180, 40], ["feet", [1, 2], 180, 74]];
    rows.forEach(([w, hi, cx, y]) => { const l = letters(cx, y, w, hi, G); s += l.svg + bracket(l.x0 + hi[0] * 18, l.x0 + hi[1] * 18 + 17, y + 26); });
    return s;
  },
});
const trigraph = mk({
  id: "trigraph", title: "Trigraphs", alt: "Three words with the trigraph highlighted, three letters that make one sound: night (igh), hair (air), badge (dge).",
  caption: "A trigraph: three letters, one sound", concepts: ["trigraph", "trigraphs"],
  avoid: ["split"],
  doesNotShow: "the sounds themselves", evidence: "Oak keyword 'trigraph': three letters that represent one sound. Drawn: night (igh), hair (air), badge (dge) with the three letters highlighted.",
  build: () => {
    let s = T(120, 18, "Trigraph: three letters", "t");
    [["night", [1, 2, 3], 120, 36], ["hair", [1, 2, 3], 120, 76], ["badge", [2, 3, 4], 120, 116]].forEach(([w, hi, cx, y]) => { const l = letters(cx as number, y as number, w as string, hi as number[], G); s += l.svg + bracket(l.x0 + (hi as number[])[0] * 18, l.x0 + (hi as number[])[2] * 18 + 17, (y as number) + 26); });
    return s;
  },
});
const splitDigraph = mk({
  id: "split-digraph", title: "Split digraphs", alt: "Four words in which two vowel letters make one sound with a consonant between them, joined by an arc: make (a-e), like (i-e), home (o-e), cube (u-e).",
  caption: "A digraph split by a consonant", concepts: ["split digraph", "split digraphs", "split diagraph", "split diagraphs"],
  doesNotShow: "the sounds themselves", evidence: "Oak keyword 'split digraph': has a letter that comes between the two letters in a digraph, like in 'make' where the k separates the digraph a-e. Drawn: make (a-e), like (i-e), home (o-e), cube (u-e).",
  build: () => {
    let s = T(120, 18, "Split digraph", "tb");
    [["make", 0, 3, 60, 34], ["like", 1, 3, 180, 34], ["home", 1, 3, 60, 84], ["cube", 1, 3, 180, 84]].forEach(([w, a, b, cx, y]) => {
      const l = letters(cx as number, y as number, w as string, [a as number, b as number], G); const xa = l.x0 + (a as number) * 18 + 8, xb = l.x0 + (b as number) * 18 + 8;
      s += l.svg + path(`M${xa} ${(y as number) + 22} Q${(xa + xb) / 2} ${(y as number) + 40} ${xb} ${(y as number) + 22}`, "th2");
    });
    s += T(120, 140, "the two vowels work as a pair", "ts tm");
    return s;
  },
});
const phonemeGrapheme = mk({
  id: "phoneme-grapheme", title: "Phonemes and graphemes", alt: "The word ship written as four letter squares s, h, i, p. Below, the letters are grouped as graphemes sh, i and p, and each grapheme is matched to a sound (phoneme): /sh/, /i/, /p/.",
  caption: "Grapheme: the letters. Phoneme: the sound", concepts: ["phoneme", "phonemes", "grapheme", "graphemes"],
  doesNotShow: "sound spelling alternatives", evidence: "Oak keywords: 'phoneme' = the smallest unit of sound that can change a word's meaning; 'grapheme' = the letter or group of letters that represent a sound. Drawn: ship = graphemes sh-i-p = phonemes /sh/ /i/ /p/.",
  build: () => {
    let s = T(120, 18, "Sounds and letters", "tb");
    const l = letters(120, 30, "ship", [0, 1], G);
    s += l.svg;
    const gx = [[l.x0, l.x0 + 35], [l.x0 + 36, l.x0 + 53], [l.x0 + 54, l.x0 + 71]];
    ["sh", "i", "p"].forEach((g, i) => { const m = (gx[i][0] + gx[i][1]) / 2; s += box(gx[i][0], 68, gx[i][1] - gx[i][0], 20, B, 4) + T(m, 82, g, "ts") + T(m, 108, `/${g}/`, "ts") + ln(m, 88, m, 98, "th"); });
    s += T(212, 82, "grapheme", "tx tm te") + T(212, 108, "phoneme", "tx tm te") + T(28, 82, "", "tx");
    return s;
  },
});
const vowelConsonant = mk({
  id: "vowels-consonants", title: "Vowels and consonants", alt: "The 26 letters of the alphabet in two rows. The five vowel letters a, e, i, o, u are highlighted in red; all the other letters are consonants, shown in blue.",
  caption: "Vowels: a e i o u. The rest: consonants", concepts: ["vowel", "vowels", "consonant", "consonants", "vowel letter", "vowel letters"],
  avoid: ["short vowel", "long vowel", "vowel digraph", "long and short", "y as a vowel", "y is a vowel", "y can be a vowel", "semi vowel", "semivowel"],
  doesNotShow: "vowel sounds; y as a vowel sound", evidence: "Oak keywords 'vowel' and 'consonant'. The 5 vowel letters are a, e, i, o, u; the other 21 letters are consonants (y can also stand for a vowel sound, not drawn).",
  build: () => {
    let s = T(120, 18, "Vowels and consonants", "t");
    const al = "abcdefghijklmnopqrstuvwxyz";
    [...al].forEach((ch, i) => { const r = i < 13 ? 0 : 1, c = i % 13; const v = "aeiou".includes(ch); s += box(8 + c * 17.2, 34 + r * 24, 16, 20, v ? R : B, 3) + T(8 + c * 17.2 + 8, 34 + r * 24 + 14, ch, "ts"); });
    s += box(20, 92, 20, 14, R, 3) + T(46, 103, "vowel letters", "ts tl") + box(136, 92, 20, 14, B, 3) + T(162, 103, "consonants", "ts tl");
    return s;
  },
});
const shortLong = mk({
  id: "short-long-vowels", title: "Short and long vowels", alt: "Two rows of words. Short vowel sounds: cat, bed, pin, hop, cup. Long vowel sounds: cake, feet, kite, boat, cube.",
  caption: "Short and long vowel sounds", concepts: ["short vowel", "short vowels", "long vowel", "long vowels", "long vowel sound", "long vowel sounds", "short vowel sound", "short vowel sounds"],
  doesNotShow: "vowel sound symbols", evidence: "Oak keywords: 'short vowel' = a vowel sound that sounds short, like a in cat or o in hot; 'long vowel sound' = spoken for longer, like a in cake. Drawn: cat bed pin hop cup (short) / cake feet kite boat cube (long).",
  build: () => {
    let s = T(120, 18, "Short and long vowels", "t");
    s += T(120, 40, "short vowel sound", "ts tm") + row(120, 46, [{ s: "cat", f: B }, { s: "bed", f: B }, { s: "pin", f: B }, { s: "hop", f: B }, { s: "cup", f: B }], 4).svg;
    s += T(120, 88, "long vowel sound", "ts tm") + row(120, 94, [{ s: "cake", f: G }, { s: "feet", f: G }, { s: "kite", f: G }, { s: "boat", f: G }, { s: "cube", f: G }], 4, "tx").svg;
    return s;
  },
});
const silentLetters = mk({
  id: "silent-letters", title: "Silent letters", alt: "Four words with one silent letter crossed out and greyed: knee (k), gnat (g), write (w) and lamb (b). A note says a silent letter is written but not pronounced.",
  caption: "A silent letter is not pronounced", concepts: ["silent letter", "silent letters"],
  doesNotShow: "the sounds of the words", evidence: "Oak keyword 'silent letter': a letter in a word that is not pronounced when the word is spoken. Drawn: knee (k), gnat (g), write (w), lamb (b) with the silent letter greyed (Oak lessons on kn, gn, wr, mb).",
  build: () => {
    let s = T(120, 18, "Silent letters", "tb");
    [["knee", 0, 60, 36], ["gnat", 0, 180, 36], ["write", 0, 60, 84], ["lamb", 3, 180, 84]].forEach(([w, k, cx, y]) => {
      const l = letters(cx as number, y as number, w as string, [], "f0"); s += l.svg;
      const x = l.x0 + (k as number) * 18; s += box(x, y as number, 17, 19, N, 3) + T(x + 8.5, (y as number) + 15, (w as string)[k as number], "ts") + ln(x + 2, (y as number) + 3, x + 15, (y as number) + 16, "l");
    });
    s += T(120, 136, "written, but not said", "ts tm");
    return s;
  },
});
const softC = mk({
  id: "soft-c", title: "Soft c", alt: "Two rows. Soft c: the letter c sounds like s when it comes before e, i or y, as in cent, city and cycle. Hard c: cat, cot, cup.",
  caption: "Soft c sounds like s before e, i or y", concepts: ["soft c"],
  doesNotShow: "exceptions", evidence: "Oak keyword 'soft c' (lesson 'The s spellings, including ss and c'). Standard rule: c before e, i or y is soft (/s/): cent, city, cycle; otherwise hard: cat, cot, cup.",
  build: () => {
    let s = T(120, 18, "Soft c and hard c", "t");
    s += T(120, 40, "soft c (says s) before e, i, y", "ts tm") + row(120, 46, [{ s: "cent", f: G }, { s: "city", f: G }, { s: "cycle", f: G }], 5).svg;
    s += T(120, 88, "hard c (says k) otherwise", "ts tm") + row(120, 94, [{ s: "cat", f: B }, { s: "cot", f: B }, { s: "cup", f: B }], 5).svg;
    return s;
  },
});
const rhymeWords = mk({
  id: "rhyming-words", title: "Rhyming words", alt: "Three pairs of rhyming words joined by an arc: cat and hat, moon and spoon, light and night. A note says rhyming words have the same ending sound.",
  caption: "Rhyming words end with the same sound", concepts: ["rhyme", "rhymes", "rhyming word", "rhyming words"],
  avoid: ["rhyme scheme", "internal rhyme", "half rhyme", "para rhyme", "rhyming couplet", "rhyming pattern"],
  doesNotShow: "rhyme schemes; near rhymes", evidence: "Oak keyword 'rhyme': words that have the same or similar ending sounds, often used in poetry. Drawn: cat/hat, moon/spoon, light/night.",
  build: () => {
    let s = T(120, 18, "Rhyming words", "tb");
    [["cat", "hat"], ["moon", "spoon"], ["light", "night"]].forEach(([a, b], i) => { const y = 34 + i * 30; s += row(64, y, [{ s: a, f: B }]).svg + row(176, y, [{ s: b, f: B }]).svg + ln(96, y + 8, 144, y + 8, "th"); });
    s += T(120, 134, "same ending sound", "ts tm");
    return s;
  },
});
const etymology = mk({
  id: "etymology", title: "Etymology: where words come from", alt: "The word telephone split into two parts from Greek: tele meaning far and phone meaning sound. A note says etymology is the study of where words come from.",
  caption: "Etymology: the origin of a word", concepts: ["etymology", "etymologies", "word origin", "word origins"],
  doesNotShow: "any other word's history", evidence: "Etymology = the study of the origin of words. Drawn: telephone < Greek tele (far) + phone (sound), a standard textbook example.",
  build: () => {
    let s = T(120, 18, "Etymology", "tb");
    s += row(120, 34, [{ s: "telephone", f: B }], 4, "t", 22).svg + arrow(90, 60, 70, 82, "l", 7) + arrow(150, 60, 170, 82, "l", 7);
    s += box(20, 84, 100, 34, G, 6) + T(70, 100, "tele", "t") + T(70, 113, "far (Greek)", "tx tm") + box(130, 84, 92, 34, G, 6) + T(176, 100, "phone", "t") + T(176, 113, "sound (Greek)", "tx tm");
    s += T(120, 136, "where a word comes from", "ts tm");
    return s;
  },
});
const dictionary = mk({
  id: "dictionary-entry", title: "A dictionary entry", alt: "A dictionary entry for the word quick with labels: headword (quick), word class (adjective), definition (fast; done in a short time) and an example sentence (a quick walk).",
  caption: "Parts of a dictionary entry", concepts: ["dictionary", "dictionaries"],
  avoid: ["dictionary of", "oxford english dictionary"],
  doesNotShow: "pronunciation guides or origins", evidence: "A dictionary entry gives the headword, its word class, a definition and often an example. Drawn: quick (adjective) fast; done in a short time. Example: a quick walk.",
  build: () => {
    let s = T(120, 18, "Dictionary entry", "tb");
    s += box(14, 30, 212, 76, "f0", 8) + T(24, 52, "quick", "t tl") + T(70, 52, "adjective", "ts tm tl") + T(24, 72, "fast; done in a short time", "ts tl") + T(24, 92, "a quick walk", "ts tl");
    s += T(120, 124, "headword, word class, meaning, example", "tx tm");
    return s;
  },
});

export const PIC_B: Pic[] = [prefix, suffix, rootWord, prefixUn, suffixEd, suffixIng, suffixLy, suffixFul, suffixLess, suffixMent, iesEnd, doubling, compound, synonym, antonym, homophone, homonym, wordFamily, syllable, digraph, trigraph, splitDigraph, phonemeGrapheme, vowelConsonant, shortLong, silentLetters, softC, rhymeWords, etymology, dictionary];
void V;
