// X4 English pictures D: literary devices, poetry forms and drama.
// Definition cards with generic, neutral examples (never a quotation from a set text). Definitions follow the Oak keyword wording.
import type { Pic } from "./types";
import { ln, arrow, circ, path } from "./helpers";
import { mk, T, wrap, box, chip, row, sentence, est } from "./ext-english-kit";

const B = "f1", G = "f2", Y = "f3", R = "f4", V = "f5";
type Wd = { s: string; f?: string };

/** a definition card: title, one-line definition, up to three example rows (words with highlighted parts), optional note */
function dev(o: { id: string; title: string; def: string; rows: Wd[][]; note?: string; caption: string; concepts: string[]; avoid?: string[]; requires?: string[]; doesNotShow: string; evidence: string; alt: string }): Pic {
  return mk({
    id: o.id, title: o.title, alt: o.alt, caption: o.caption, concepts: o.concepts, avoid: o.avoid, requires: o.requires, doesNotShow: o.doesNotShow, evidence: o.evidence,
    build: () => {
      let s = T(120, 18, o.title, o.title.length > 20 ? "t" : "tb") + wrap(o.def, 120, 36, 40, "ts tm");
      const y0 = o.def.length > 38 ? 66 : 56;
      o.rows.forEach((w, i) => { s += sentence(120, y0 + i * 28, w, "ts", 20, 3).svg; });
      if (o.note) s += T(120, y0 + o.rows.length * 28 + 6, o.note, "ts tm");
      return s;
    },
  });
}
const NS = "a specific text or a quotation from one";

const simile = dev({ id: "simile", title: "Simile", def: "compares two things using ‘like’ or ‘as’", rows: [[{ s: "Her hands were" }, { s: "as cold as ice.", f: B }], [{ s: "He ran" }, { s: "like the wind.", f: B }]],
  caption: "A simile compares using like or as", concepts: ["simile", "similes"], doesNotShow: NS, alt: "The word simile with the definition: compares two things using like or as. Two neutral examples with the comparing words highlighted: Her hands were as cold as ice. He ran like the wind.",
  evidence: "Oak keyword 'simile': a linguistic device that compares two things using 'like' or 'as', highlighting similarities to create vivid imagery. Generic examples as cold as ice, like the wind." });
const metaphor = dev({ id: "metaphor", title: "Metaphor", def: "describes something by saying it IS something else", rows: [[{ s: "The classroom" }, { s: "was a zoo.", f: G }], [{ s: "Time" }, { s: "is a thief.", f: G }]],
  caption: "A metaphor says one thing is another", concepts: ["metaphor", "metaphors"], avoid: ["extended metaphor"], doesNotShow: "extended metaphors; " + NS, alt: "The word metaphor with the definition: describes something by saying it is something else. Two neutral examples: The classroom was a zoo. Time is a thief.",
  evidence: "Oak keyword 'metaphor': a way of describing and comparing something by saying that it is something else. Generic examples: the classroom was a zoo, time is a thief (no like/as)." });
const extended = dev({ id: "extended-metaphor", title: "Extended metaphor", def: "a metaphor that carries on over several lines or sentences", rows: [[{ s: "Life is a journey:", f: G }], [{ s: "the road is long, we take wrong turns," }], [{ s: "and we hope to reach our destination." }]],
  caption: "One metaphor, carried on", concepts: ["extended metaphor", "extended metaphors"], doesNotShow: NS, alt: "The words extended metaphor with the definition: a metaphor that carries on over several lines or sentences. Example: Life is a journey: the road is long, we take wrong turns, and we hope to reach our destination.",
  evidence: "An extended metaphor keeps developing one metaphor (standard definition; Oak lists 'extended metaphor' as a KS3/KS4 keyword). Generic example: life is a journey." });
const personification = dev({ id: "personification", title: "Personification", def: "a non-living thing is described as if it acts or feels like a human", rows: [[{ s: "The wind" }, { s: "whispered", f: Y }, { s: "to me." }], [{ s: "The sun" }, { s: "smiled", f: Y }, { s: "down on us." }]],
  caption: "Giving human actions to a thing", concepts: ["personification", "personify", "personifies", "personified"], doesNotShow: NS, alt: "The word personification with the definition: a non-living thing is described as if it acts or feels like a human. Two neutral examples with the human action highlighted: The wind whispered to me. The sun smiled down on us.",
  evidence: "Oak keyword 'personification': a way of describing a non-living thing as if it acts or feels like a human. Generic examples: the wind whispered, the sun smiled." });
const alliteration = dev({ id: "alliteration", title: "Alliteration", def: "the same sound at the start of words close together", rows: [[{ s: "slippery", f: R }, { s: "snakes", f: R }, { s: "slither", f: R }, { s: "silently.", f: R }], [{ s: "big", f: B }, { s: "brown", f: B }, { s: "bears", f: B }, { s: "bounce.", f: B }]],
  caption: "The same first sound, repeated", concepts: ["alliteration", "alliterative"], doesNotShow: NS, alt: "The word alliteration with the definition: the same sound at the start of words close together. Two neutral examples with the repeated first letters highlighted: slippery snakes slither silently; big brown bears bounce.",
  evidence: "Oak keyword 'alliteration': the repetition of the same sound found at the start of words that come close together. Generic examples slippery snakes slither silently, big brown bears bounce." });
const onomatopoeia = dev({ id: "onomatopoeia", title: "Onomatopoeia", def: "a word that sounds like what it describes", rows: [[{ s: "buzz", f: Y }, { s: "crash", f: Y }, { s: "sizzle", f: Y }, { s: "splash", f: Y }], [{ s: "The bacon" }, { s: "sizzled", f: Y }, { s: "in the pan." }]],
  caption: "Words that sound like their meaning", concepts: ["onomatopoeia", "onomatopoeic"], doesNotShow: NS, alt: "The word onomatopoeia with the definition: a word that sounds like what it describes. Examples: buzz, crash, sizzle, splash, and the sentence The bacon sizzled in the pan.",
  evidence: "Oak keyword 'onomatopoeia': a type of word that sounds like what it describes. Generic examples buzz, crash, sizzle, splash." });
const hyperbole = dev({ id: "hyperbole", title: "Hyperbole", def: "exaggeration for effect, not meant literally", rows: [[{ s: "I’ve told you" }, { s: "a million times!", f: R }], [{ s: "I’m so hungry I" }, { s: "could eat a horse.", f: R }]],
  caption: "Exaggeration, not meant literally", concepts: ["hyperbole", "hyperboles"], doesNotShow: NS, alt: "The word hyperbole with the definition: exaggeration for effect, not meant literally. Two neutral examples with the exaggeration highlighted: I've told you a million times! I'm so hungry I could eat a horse.",
  evidence: "Oak keyword 'hyperbole': exaggerated claims not meant to be taken literally, used for emphasis. Generic examples a million times, eat a horse." });
const pathetic = mk({
  id: "pathetic-fallacy", title: "Pathetic fallacy", alt: "The weather reflects the mood: dark storm clouds are linked by an arrow to a gloomy or angry mood, and bright sunshine is linked to a happy mood.",
  caption: "The weather reflects the mood", concepts: ["pathetic fallacy"], doesNotShow: NS, evidence: "Oak keyword 'pathetic fallacy': when the weather reflects the mood (usually of the main character). Drawn: stormy weather > gloomy or angry mood; sunshine > happy mood.",
  build: () => {
    let s = T(120, 18, "Pathetic fallacy", "tb") + T(120, 36, "the weather reflects the mood", "ts tm");
    s += row(58, 60, [{ s: "stormy sky", f: B }], 4, "ts", 20).svg + arrow(98, 70, 138, 70, "a", 7) + row(184, 60, [{ s: "gloomy mood", f: V }], 4, "ts", 20).svg;
    s += row(58, 98, [{ s: "bright sun", f: Y }], 4, "ts", 20).svg + arrow(98, 108, 138, 108, "a", 7) + row(184, 98, [{ s: "happy mood", f: G }], 4, "ts", 20).svg;
    return s;
  },
});
const oxymoron = dev({ id: "oxymoron", title: "Oxymoron", def: "two words with opposite meanings put together", rows: [[{ s: "deafening", f: R }, { s: "silence", f: B }], [{ s: "bitter", f: R }, { s: "sweet", f: B }]],
  caption: "Opposites put together", concepts: ["oxymoron", "oxymorons"], doesNotShow: NS, alt: "The word oxymoron with the definition: two words with opposite meanings put together. Two neutral examples: deafening silence and bitter sweet.",
  evidence: "Oak keyword 'oxymoron': two words or phrases used together that have, or seem to have, opposite meanings. Generic examples deafening silence, bittersweet." });
const irony = dev({ id: "irony", title: "Irony", def: "saying the opposite of what is really meant", rows: [[{ s: "“What lovely weather!”", f: Y }], [{ s: "said in a heavy rainstorm" }]],
  caption: "Meaning the opposite of what is said", concepts: ["irony", "ironic", "verbal irony"], avoid: ["dramatic irony"], doesNotShow: "dramatic irony; " + NS, alt: "The word irony with the definition: saying the opposite of what is really meant. Example: What lovely weather! said in a heavy rainstorm.",
  evidence: "Oak keyword 'irony': the expression of meaning by using language that suggests the opposite of the reality. Generic example: 'What lovely weather!' during a rainstorm." });
const dramaticIrony = mk({
  id: "dramatic-irony", title: "Dramatic irony", alt: "Two boxes joined by an arrow: the audience knows something; the character on stage does not know it.",
  caption: "The audience knows more than the character", concepts: ["dramatic irony"], doesNotShow: NS, evidence: "Oak keyword 'dramatic irony': the situation in which the audience of a play or story knows something that the characters do not know.",
  build: () => {
    let s = T(120, 18, "Dramatic irony", "tb");
    s += box(10, 44, 96, 52, G, 8) + T(58, 66, "audience", "t") + T(58, 82, "knows the secret", "tx tm") + box(134, 44, 96, 52, R, 8) + T(182, 66, "character", "t") + T(182, 82, "does not know", "tx tm");
    s += arrow(108, 70, 132, 70, "l", 6) + T(120, 122, "the gap creates tension", "ts tm");
    return s;
  },
});
const foreshadow = mk({
  id: "foreshadowing", title: "Foreshadowing", alt: "A time line with two points. Early in the text: a hint or warning sign. Later in the text: the event that the hint pointed to. An arrow joins them.",
  caption: "An early hint of what comes later", concepts: ["foreshadowing", "foreshadow", "foreshadows"], doesNotShow: NS, evidence: "Oak keyword 'foreshadowing': a literary device that gives the reader a hint or indication of what might happen later in the story.",
  build: () => {
    let s = T(120, 18, "Foreshadowing", "tb") + arrow(14, 92, 226, 92, "a", 8);
    s += box(16, 46, 82, 30, Y, 6) + T(57, 65, "a hint", "ts") + box(142, 46, 82, 30, R, 6) + T(183, 65, "the event", "ts");
    s += ln(57, 76, 57, 92, "th") + ln(183, 76, 183, 92, "th") + T(57, 110, "early", "ts tm") + T(183, 110, "later", "ts tm") + arrow(100, 61, 140, 61, "l", 6);
    return s;
  },
});
const flashback = mk({
  id: "flashback", title: "Flashback", alt: "A time line running from earlier to later. The story is at the present point, and an arrow curves back to an earlier point labelled the flashback scene.",
  caption: "A jump back to an earlier time", concepts: ["flashback", "flashbacks"], doesNotShow: NS, evidence: "Oak keyword 'flashback': a transition in a story to an earlier time in the life of one or more characters.",
  build: () => {
    let s = T(120, 18, "Flashback", "tb") + arrow(14, 96, 226, 96, "a", 8);
    s += `<circle cx="56" cy="96" r="5" class="fo"/><circle cx="176" cy="96" r="5" class="fs"/>`;
    s += T(56, 116, "earlier", "ts tm") + T(176, 116, "the story now", "ts tm");
    s += `<path d="M172 88 Q116 34 60 88" class="a" fill="none"/><polygon points="58,92 66,82 70,90" class="hda"/>` + T(116, 56, "flashback", "ts");
    return s;
  },
});
const symbolism = dev({ id: "symbolism", title: "Symbolism", def: "an object, action or idea stands for a deeper meaning", rows: [[{ s: "a dove", f: Y }, { s: "→" }, { s: "peace", f: G }], [{ s: "a red rose", f: Y }, { s: "→" }, { s: "love", f: G }]],
  caption: "Something that stands for an idea", concepts: ["symbolism", "symbol", "symbols", "symbolise", "symbolises", "symbolize", "symbolic"], avoid: ["chemical symbol", "symbol for", "phonetic symbol"], doesNotShow: NS, alt: "The word symbolism with the definition: an object, action or idea stands for a deeper meaning. Two common examples: a dove stands for peace, a red rose stands for love.",
  evidence: "Oak keyword 'symbolism': the use of objects, actions or ideas to represent deeper meanings or concepts. Generic examples: a dove (peace), a red rose (love)." });
const motif = mk({
  id: "motif", title: "Motif", alt: "A long strip representing a text from beginning to end, with the same star shape repeating three times along it. A note says a motif is an image, sound or phrase that keeps coming back.",
  caption: "The same image, again and again", concepts: ["motif", "motifs", "recurring motif"], doesNotShow: NS, evidence: "Oak keyword 'motif': an object, image, sound or phrase that is repeated throughout a story that relates to the themes. Drawn: one shape repeated along a text.",
  build: () => {
    let s = T(120, 18, "Motif", "tb") + box(12, 54, 216, 30, "f0", 6);
    [50, 120, 190].forEach((x) => { s += `<polygon points="${x},60 ${x + 4},68 ${x + 12},69 ${x + 6},75 ${x + 8},83 ${x},79 ${x - 8},83 ${x - 6},75 ${x - 12},69 ${x - 4},68" class="l f3"/>`; });
    s += T(24, 102, "start", "ts tm tl") + T(216, 102, "end", "ts tm te") + T(120, 122, "an image that keeps coming back", "ts tm");
    return s;
  },
});
const juxta = dev({ id: "juxtaposition", title: "Juxtaposition", def: "two things placed close together to make a contrast", rows: [[{ s: "light", f: Y }, { s: "beside" }, { s: "dark", f: V }], [{ s: "rich", f: Y }, { s: "beside" }, { s: "poor", f: V }]],
  caption: "Opposites side by side", concepts: ["juxtaposition", "juxtapose", "juxtaposes", "juxtaposed"], doesNotShow: NS, alt: "The word juxtaposition with the definition: two things placed close together to make a contrast. Examples: light beside dark; rich beside poor.",
  evidence: "Oak keyword 'juxtaposition': two things being seen or placed close together with contrasting effect. Generic examples: light/dark, rich/poor." });
const anaphora = dev({ id: "anaphora", title: "Anaphora", def: "the same word or phrase starts several lines or sentences in a row", rows: [[{ s: "I want to", f: B }, { s: "laugh." }], [{ s: "I want to", f: B }, { s: "sing." }], [{ s: "I want to", f: B }, { s: "dance." }]],
  caption: "The same start, repeated", concepts: ["anaphora"], doesNotShow: NS, alt: "The word anaphora with the definition: the same word or phrase starts several lines or sentences in a row. Example: I want to laugh. I want to sing. I want to dance. with I want to highlighted each time.",
  evidence: "Oak keyword 'anaphora': when a word or phrase is repeated at the beginning of multiple lines in a poem or speech. Generic example: I want to ... x3." });
const rhetorical = dev({ id: "rhetorical-question", title: "Rhetorical question", def: "a question asked for effect: no answer is expected", rows: [[{ s: "Who wouldn’t want a longer holiday?", f: Y }], [{ s: "Isn’t it time we all helped?", f: Y }]],
  caption: "A question that needs no answer", concepts: ["rhetorical question", "rhetorical questions"], doesNotShow: NS, alt: "The words rhetorical question with the definition: a question asked for effect, no answer is expected. Two neutral examples: Who wouldn't want a longer holiday? Isn't it time we all helped?",
  evidence: "Oak keyword 'rhetorical question': a question asked to the reader that does not expect an answer. Generic examples." });
const repetition = dev({ id: "repetition", title: "Repetition", def: "repeating a word or phrase for effect", rows: [[{ s: "far, far away", f: G }], [{ s: "No, no, no!", f: G }]],
  caption: "Repeating words for effect", concepts: ["repetition", "repetitions", "repeated"], avoid: ["repetition of the", "repeated addition", "anaphora", "refrain"], doesNotShow: NS, alt: "The word repetition with the definition: repeating a word or phrase for effect. Two neutral examples: far, far away; No, no, no!",
  evidence: "Oak keyword 'repetition' (a poetic/rhetorical device): repeating a word or phrase for emphasis. Generic examples far, far away; no, no, no." });
const semantic = mk({
  id: "semantic-field", title: "Semantic field", alt: "The word sea in the centre with five related words around it: waves, tide, sail, shore and fish. A note says a semantic field is a group of words related in meaning.",
  caption: "Words that belong to one topic", concepts: ["semantic field", "semantic fields"], doesNotShow: NS, evidence: "Oak keyword 'semantic field': a group of words or expressions that are related in meaning. Generic example: sea > waves, tide, sail, shore, fish.",
  build: () => {
    let s = box(92, 58, 56, 26, B, 8) + T(120, 76, "sea", "t") + T(120, 16, "words related in meaning", "ts tm");
    [[46, 34, "waves"], [150, 30, "tide"], [12, 100, "sail"], [102, 118, "shore"], [172, 100, "fish"]].forEach(([x, y, w]) => { const c = chip(x as number, y as number, w as string, G, "ts", 18, 8); s += c.svg + ln((x as number) + c.w / 2, (y as number) < 70 ? (y as number) + 18 : y as number, 120, (y as number) < 70 ? 58 : 84, "th"); });
    return s;
  },
});
const kenning = dev({ id: "kenning", title: "Kenning", def: "a two-word phrase that replaces a noun", rows: [[{ s: "whale-road", f: Y }, { s: "=" }, { s: "sea", f: G }], [{ s: "sky-candle", f: Y }, { s: "=" }, { s: "sun", f: G }]],
  caption: "Two words that stand for a noun", concepts: ["kenning", "kennings"], doesNotShow: NS, alt: "The word kenning with the definition: a two-word phrase that replaces a noun. Two examples: whale-road means sea; sky-candle means sun.",
  evidence: "Oak keyword 'kennings': phrases of two words that replace a noun and are often used in poetry (Old English tradition). Examples whale-road (sea) is a classic kenning; sky-candle (sun) is a neutral modern example." });

// ── poetry ──────────────────────────────────────────────────────────────────
const bars = (x: number, y: number, ws: number[], gap = 9) => ws.map((w, i) => ln(x, y + i * gap, x + w, y + i * gap, "th2")).join("");
const stanza = mk({
  id: "stanza", title: "Stanzas", alt: "A poem drawn as lines of text in two groups separated by a gap. Each group of lines is labelled a stanza; the first stanza has four lines (a quatrain).",
  caption: "A stanza is a group of lines", concepts: ["stanza", "stanzas", "quatrain", "quatrains"], doesNotShow: "any particular poem", evidence: "Oak keywords: 'stanza' = a part of a poem consisting of two or more lines grouped together; 'quatrain' = a four-line stanza.",
  build: () => {
    let s = T(120, 18, "Stanzas", "tb") + box(20, 28, 130, 112, "f0", 6);
    s += bars(32, 42, [90, 100, 84, 96]) + bars(32, 88, [96, 80, 100, 88]);
    s += `<path d="M156 40 L162 40 L162 72 L156 72" class="th2" fill="none"/><path d="M156 86 L162 86 L162 118 L156 118" class="th2" fill="none"/>`;
    s += T(168, 60, "stanza", "ts tl") + T(168, 106, "stanza", "ts tl") + T(168, 72, "four lines:", "tx tm tl") + T(168, 82, "a quatrain", "tx tm tl");
    return s;
  },
});
const rhymeScheme = mk({
  id: "rhyme-scheme", title: "Rhyme scheme", alt: "Three four-line examples of rhyme schemes. AABB: day, play, night, light. ABAB: sky, ground, high, sound. ABBA: sea, moon, tune, free. The same letter marks line endings that rhyme.",
  caption: "Letters show which lines rhyme", concepts: ["rhyme scheme", "rhyme schemes", "rhyming pattern"], doesNotShow: "a specific poem", evidence: "Oak keyword 'rhyme scheme': the pattern of rhyming words or sounds at the end of each line in a poem, often represented using letters (e.g. AABB, ABAB). Drawn: AABB (day, play, night, light), ABAB (sky, ground, high, sound), ABBA (sea, moon, tune, free).",
  build: () => {
    let s = T(120, 16, "Rhyme scheme", "tb") + T(120, 28, "for example", "tx tm");
    const cols: [string, [string, string][]][] = [["AABB", [["day", "A"], ["play", "A"], ["night", "B"], ["light", "B"]]], ["ABAB", [["sky", "A"], ["ground", "B"], ["high", "A"], ["sound", "B"]]], ["ABBA", [["sea", "A"], ["moon", "B"], ["tune", "B"], ["free", "A"]]]];
    cols.forEach(([nm, ws], c) => {
      const x = 4 + c * 79; s += T(x + 37, 44, nm, "ts tm");
      ws.forEach(([w, l], i) => { const y = 52 + i * 20; s += ln(x + 2, y + 8, x + 12, y + 8, "th2") + T(x + 16, y + 12, w, "tx tl") + box(x + 52, y, 20, 16, l === "A" ? B : G, 4) + T(x + 62, y + 12, l, "ts"); });
      if (c) s += ln(x - 3, 36, x - 3, 132, "th");
    });
    s += T(120, 144, "same letter = the line endings rhyme", "ts tm");
    return s;
  },
});
const freeVerse = mk({
  id: "free-verse", title: "Free verse", alt: "A poem drawn as lines of very different lengths with no letters marking rhymes. A note says free verse has no strict rhyme scheme or regular rhythm.",
  caption: "No strict rhyme or regular rhythm", concepts: ["free verse"], doesNotShow: "any particular poem", evidence: "Oak keyword 'free verse': poetry without strict rhyme or metre; it emphasises natural speech rhythms. Drawn: lines of uneven length, no rhyme labels.",
  build: () => {
    let s = T(120, 18, "Free verse", "tb") + box(40, 28, 160, 90, "f0", 6) + bars(52, 42, [60, 122, 84, 38, 110, 70], 12);
    s += T(120, 136, "lines of any length, no fixed rhyme", "ts tm");
    return s;
  },
});
const sonnet = mk({
  id: "sonnet", title: "Sonnet: fourteen lines", alt: "Two sonnet layouts made of fourteen lines. Left, a Shakespearean sonnet: three quatrains rhyming ABAB, CDCD, EFEF and a final rhyming couplet GG. Right, a Petrarchan sonnet: an octave of eight lines and a sestet of six lines.",
  caption: "A sonnet has fourteen lines", concepts: ["sonnet", "sonnets", "shakespearean sonnet", "petrarchan sonnet"], doesNotShow: "the rhyme details of the sestet; any particular sonnet", evidence: "Oak keyword 'sonnet': a poetic form consisting of 14 lines, in iambic pentameter. Standard forms: Shakespearean = 3 quatrains (ABAB CDCD EFEF) + couplet (GG); Petrarchan = octave (8) + sestet (6).",
  build: () => {
    let s = T(120, 16, "Sonnet", "tb") + T(58, 34, "Shakespearean", "tx tm") + T(182, 34, "Petrarchan", "tx tm") + ln(120, 28, 120, 128, "th");
    [["ABAB", 4, B], ["CDCD", 4, G], ["EFEF", 4, Y], ["GG", 2, R]].reduce((y, [l, n, f]) => { s += box(14, y, 58, (n as number) * 6 + 2, f as string, 3) + T(84, y + (n as number) * 3 + 6, l as string, "tx tl"); return y + (n as number) * 6 + 6; }, 42);
    s += box(134, 42, 58, 8 * 6 + 2, B, 3) + T(198, 70, "octave", "tx tl") + box(134, 96, 58, 6 * 6 + 2, G, 3) + T(198, 116, "sestet", "tx tl");
    return s;
  },
});
const haiku = mk({
  id: "haiku", title: "Haiku", alt: "A haiku drawn as three lines of dots, one dot per syllable: a short first line of five, a longer middle line of seven and a short last line of five.",
  caption: "Three lines, counted in syllables", concepts: ["haiku", "haikus"], doesNotShow: "any particular haiku", evidence: "Oak keyword 'haiku': a traditional form of Japanese poetry consisting of three lines with a specific syllable pattern (5-7-5). Drawn: 5, 7 and 5 dots, one per syllable.",
  build: () => {
    let s = T(120, 18, "Haiku", "tb");
    [5, 7, 5].forEach((n, i) => { const y = 44 + i * 28, x0 = 120 - (n * 16 - 6) / 2; for (let k = 0; k < n; k++) s += `<circle cx="${x0 + k * 16 + 5}" cy="${y}" r="5" class="l ${i === 1 ? "f2" : "f1"}"/>`; });
    s += T(120, 132, "one dot for each syllable", "ts tm");
    return s;
  },
});
const enjambment = mk({
  id: "enjambment", title: "Enjambment", alt: "Three lines of a neutral poem: The river runs / beyond the hill and on / to the sea. Arrows at the end of the first two lines show the sentence running on to the next line without a pause or punctuation.",
  caption: "A line runs on to the next", concepts: ["enjambment", "enjambed"], doesNotShow: "a specific poem", evidence: "Oak keyword 'enjambment': when a line in poetry continues onto the next line without pause or punctuation, creating a sense of flow. Neutral example lines.",
  build: () => {
    let s = T(120, 18, "Enjambment", "tb");
    [["The river runs", 40], ["beyond the hill and on", 68], ["to the sea.", 96]].forEach(([w, y], i) => { s += T(30, y as number, w as string, "t tl"); if (i < 2) s += arrow(30 + est(w as string, "t") + 10, (y as number) - 4, 30 + est(w as string, "t") + 10, (y as number) + 16, "l", 6); });
    s += T(120, 132, "no pause or punctuation at the line end", "ts tm");
    return s;
  },
});
const caesura = mk({
  id: "caesura", title: "Caesura", alt: "One neutral line of poetry, The night is still ‖ and cold, with a double bar marking a pause in the middle of the line, labelled caesura.",
  caption: "A pause in the middle of a line", concepts: ["caesura", "caesuras"], doesNotShow: "a specific poem", evidence: "Oak keyword 'caesura': a pause in the middle of a line of poetry. Drawn: a neutral line with the pause marked ‖.",
  build: () => {
    let s = T(120, 18, "Caesura", "tb") + T(120, 70, "The night is still  ‖  and cold.", "t") + T(120, 96, "caesura: a pause in the line", "ts tm");
    return s;
  },
});
const refrain = mk({
  id: "refrain", title: "Refrain", alt: "A poem of three stanzas. Each stanza has three different lines followed by the same final line, which is highlighted each time and labelled refrain.",
  caption: "A line repeated in every stanza", concepts: ["refrain", "refrains"], doesNotShow: "a specific poem or song", evidence: "Oak keyword 'refrain': a repeated line or group of lines in a poem or song, typically at the end of a stanza. Drawn: three stanzas ending with the same highlighted line.",
  build: () => {
    let s = T(120, 18, "Refrain", "tb");
    [0, 1, 2].forEach((k) => { const x = 10 + k * 76; s += box(x, 28, 70, 86, "f0", 5) + bars(x + 8, 40, [46 + (k * 7) % 14, 54 - (k * 5) % 9, 40 + (k * 9) % 15], 12) + box(x + 6, 74, 58, 12, Y, 3) + ln(x + 10, 80, x + 60, 80, "th2"); });
    s += T(120, 132, "the same line, again and again", "ts tm");
    return s;
  },
});

// ── drama ───────────────────────────────────────────────────────────────────
const soliloquy = mk({
  id: "soliloquy", title: "Soliloquy", alt: "A stage with one actor standing alone and a speech bubble of thoughts. A note says a soliloquy is when a character speaks their thoughts aloud when alone on stage.",
  caption: "Thoughts spoken aloud, alone on stage", concepts: ["soliloquy", "soliloquies"], doesNotShow: "any particular play or speech", evidence: "Oak keyword 'soliloquy': an act of speaking one's thoughts aloud when by oneself or regardless of any hearers, especially by a character in a play.",
  build: () => {
    let s = T(120, 16, "Soliloquy", "tb") + box(14, 92, 212, 22, "f6", 4) + T(120, 130, "the stage", "ts tm");
    s += `<circle cx="70" cy="60" r="9" class="l f3"/><line x1="70" y1="69" x2="70" y2="92" class="l"/><line x1="70" y1="75" x2="58" y2="86" class="l"/><line x1="70" y1="75" x2="82" y2="86" class="l"/>`;
    s += `<path d="M96 34 h110 a8 8 0 0 1 8 8 v22 a8 8 0 0 1 -8 8 h-96 l-12 10 l2 -10 a8 8 0 0 1 -8 -8 v-22 a8 8 0 0 1 8 -8 z" class="l f0"/>` + T(155, 52, "my thoughts,", "ts") + T(155, 66, "spoken aloud", "ts");
    return s;
  },
});
const playScript = mk({
  id: "play-script", title: "Play script layout", alt: "A play script with two lines of dialogue. Each line starts with the character's name and a colon, then a stage direction in brackets, then the words spoken. Labels: character name, stage direction, speech.",
  caption: "Names, stage directions and speech", concepts: ["stage directions", "stage direction", "play script", "playscript", "play scripts"], avoid: ["screenplay"], doesNotShow: "any particular play", evidence: "Oak keywords: 'stage directions' = text in a play script which gives information about how a scene should be staged, or how an actor should say a line; 'play script' = the written version of a play. Neutral two-line example.",
  build: () => {
    let s = T(120, 18, "A play script", "tb");
    s += sentence(120, 40, [{ s: "MAYA:", f: B }, { s: "(looking up)", f: Y }, { s: "Is anyone there?" }], "ts", 20, 3).svg;
    s += sentence(120, 72, [{ s: "TOM:", f: B }, { s: "(softly)", f: Y }, { s: "Only me." }], "ts", 20, 3).svg;
    s += row(120, 108, [{ s: "character name", f: B }, { s: "stage direction", f: Y }, { s: "speech" }], 5, "tx", 16).svg;
    return s;
  },
});
const tragicHero = mk({
  id: "tragic-hero-arc", title: "Tragedy: the hero's fall", alt: "A curve that rises to a high point and then falls steeply, with four marked points and a key. Hamartia: the hero's fatal flaw. Peripeteia: the reversal of fortune. Anagnorisis: the hero realises the truth. Catharsis: the audience feels a release of emotion.",
  caption: "The fall of a tragic hero", concepts: ["tragic hero", "hamartia", "peripeteia", "anagnorisis", "catharsis", "tragedy", "tragedies"],
  requires: ["tragedy", "tragic", "hero", "play", "drama", "hamartia", "shakespeare", "aristotle"], avoid: ["tragedy of the commons", "comedy"],
  doesNotShow: "any particular play or hero", evidence: "Oak keywords: 'tragedy' = a play dealing with tragic events that often ends with a death; 'hamartia' = a fatal flaw leading to the downfall of a tragic hero. Aristotle's terms: peripeteia (reversal of fortune), anagnorisis (recognition), catharsis (the audience's release of emotion).",
  build: () => {
    let s = T(120, 14, "The tragic hero", "t");
    s += path("M14 70 Q60 24 100 34 Q150 46 226 104", "a");
    [[34, 52, "f3"], [100, 34, "f4"], [150, 58, "f2"], [186, 82, "f5"], [222, 102, "f1"]].forEach(([x, y, f]) => { s += `<circle cx="${x}" cy="${y}" r="5" class="l ${f}"/>`; });
    [["f3", "high status"], ["f4", "hamartia: fatal flaw"], ["f2", "peripeteia: reversal of fortune"], ["f5", "anagnorisis: hero realises"], ["f1", "catharsis: audience’s release"]].forEach(([f, l], i) => { s += `<circle cx="18" cy="${92 + i * 12}" r="4" class="l ${f}"/>` + T(28, 95 + i * 12, l, "tx tl"); });
    return s;
  },
});

export const PIC_D: Pic[] = [simile, metaphor, extended, personification, alliteration, onomatopoeia, hyperbole, pathetic, oxymoron, irony, dramaticIrony, foreshadow, flashback, symbolism, motif, juxta, anaphora, rhetorical, repetition, semantic, kenning,
  stanza, rhymeScheme, freeVerse, sonnet, haiku, enjambment, caesura, refrain, soliloquy, playScript, tragicHero];
void circ; void V;
