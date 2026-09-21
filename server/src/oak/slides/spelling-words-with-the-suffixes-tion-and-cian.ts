// (F1 picture policy: no decorative emoji art; pictures come only from the verified library.)
// Interactive slides for Oak's "Spelling words with the suffixes -tion and -cian" (Year 6, Homophones and tense).
// The teaching text follows the lesson's slide deck (Oak National Academy, OGL v3.0 — attribution is shown in the lesson);
// the layout, colours and every interaction are ActivityOS's own. Block format: features/learninghub/lesson/slides/types.ts.
// Inline markup: {accent} = the suffix being taught, **bold**.

type S = { kind: "intro" | "explain" | "practice" | "check" | "summary"; title: string; art?: string[]; blocks: Record<string, unknown>[] };

const TION = "Spelling words using the suffix -tion";
const CIAN = "Spelling words using the suffix -cian";
const CURR = "Spelling curriculum words";
const REMEMBER = ["sound it out.", "think of the root word.", "think of spelling rules.", "read the word and check."];

export const SLIDES: S[] = [
  { kind: "intro", title: "Today’s learning", blocks: [
    { t: "lead", text: "I can spell words with the suffix -tion and -cian." },
    { t: "text", text: "In this lesson you will learn how to spell the /shun/ sound at the end of words." },
    { t: "cards", items: [{ title: "suffix {-tion}" }, { title: "suffix {-cian}" }, { title: "curriculum words" }] },
  ] },
  { kind: "intro", title: "Key words", blocks: [
    { t: "text", text: "Tap each word to see what it means." },
    { t: "define", items: [
      { term: "root word", def: "A root word is the base word from which other words are formed often by adding prefixes or suffixes." },
      { term: "suffix", def: "A suffix is a letter or group of letters added to the end of a word to change its meaning." },
      { term: "verb", def: "A verb is a doing, being or having word." },
      { term: "noun", def: "A noun is a naming word for a person, place or thing." },
    ] },
  ] },

  { kind: "explain", title: TION, blocks: [
    { t: "text", text: "A suffix is a letter or group of letters at the end of a word which creates another word. Unlike prefixes, suffixes often change the word’s tense or word class." },
    { t: "formula", rows: [{ root: "kind", add: "ness", result: "kindness" }, { root: "deep", add: "en", result: "deepen" }] },
    { t: "text", text: "There are lots of different types of suffix. Different suffixes can create words with different word classes." },
    { t: "formula", rows: [{ root: "joy", add: "ful", result: "joyful" }] },
  ] },
  { kind: "explain", title: TION, blocks: [
    { t: "text", text: "There are several ways of spelling the suffix which sounds like ‘shun’." },
    { t: "cards", items: [{ title: "musi{cian}" }, { title: "pa{ssion}" }, { title: "explora{tion}" }, { title: "exten{sion}" }] },
    { t: "callout", text: "The spelling {-tion} is the most common and the ‘best bet’ for spelling." },
  ] },
  { kind: "explain", title: TION, blocks: [
    { t: "text", text: "The {-tion} suffix creates nouns." },
    { t: "list", items: ["What will you create in your art lesson today?", "That is a beautiful creation."] },
    { t: "cards", items: [{ title: "create" }, { title: "crea{tion}" }] },
    { t: "reveal", label: "Tap to see the word classes", text: "The word ‘create’ is a doing word. It is a **verb**. The word ‘creation’ is a thing. It is an **abstract noun**." },
  ] },
  { kind: "check", title: TION, blocks: [
    { t: "text", text: "What word class are ‘distribute’ and ‘distribution’?" },
    { t: "list", items: ["Please help to distribute the fruit.", "It is important that the distribution is fair."] },
    { t: "cards", items: [{ title: "distribute" }, { title: "distribu{tion}" }] },
    { t: "reveal", text: "The word ‘distribute’ is a doing word. It is a **verb**. The word ‘distribution’ is a thing, an idea. It is an **abstract noun**." },
  ] },
  { kind: "explain", title: TION, blocks: [
    { t: "text", text: "Do you recognise a root word for these words ending in {-tion}? Tap a word to find out." },
    { t: "roots", items: [{ word: "inven{tion}", root: "invent" }, { word: "hesita{tion}", root: "hesitate" }, { word: "educa{tion}", root: "educate" }, { word: "sta{tion}", root: "Latin: statio (standing still)" }] },
  ] },
  { kind: "explain", title: TION, blocks: [
    { t: "text", text: "When we are writing a word with an ending that sounds like /shun/, we might be able to hear a word within the word we are writing." },
    { t: "chips", items: ["hesita{tion} → hesitate", "educa{tion} → educate", "inven{tion} → invent"] },
    { t: "text", text: "The last letter(s) of this root word can give you a clue about how to spell the /shun/ suffix." },
    { t: "callout", text: "Words that end in {-tion} often have a root word ending in **t** or **te**." },
  ] },
  { kind: "check", title: TION, blocks: [
    { t: "choice", q: "Words using the -tion spelling for /shun/ often have a root word ending in which letters?", options: ["d, s or e", "t or te", "c or cs"], answer: 1, why: "Hesitate, educate and invent all end in t or te." },
  ] },
  { kind: "explain", title: TION, blocks: [
    { t: "text", text: "Some of these words have root words you will recognise and some don’t." },
    { t: "cards", items: [{ title: "mo{tion}" }, { title: "po{tion}" }, { title: "solu{tion}" }, { title: "pollu{tion}" }, { title: "comple{tion}" }, { title: "dele{tion}" }] },
    { t: "callout", text: "Words ending in {-otion}, {-ution} and {-etion} usually have root words that contain the final vowel clearly pronounced. This helps to spell the new word." },
  ] },
  { kind: "explain", title: TION, blocks: [
    { t: "text", text: "The suffix {-ation} turns verbs into nouns." },
    { t: "chips", items: ["separ{ation}", "invit{ation}", "calcul{ation}", "particip{ation}", "transform{ation}", "explor{ation}", "oper{ation}"] },
    { t: "reveal", label: "Tap for an example", text: "I can ‘invite’ somebody round. That is a verb, an action, or I could give them an ‘invitation’. That is a thing – a noun!" },
  ] },
  { kind: "explain", title: TION, blocks: [
    { t: "text", text: "Adding the suffix {-ation} can follow familiar spelling rules." },
    { t: "formula", rows: [
      { root: "inform", add: "ation", result: "information", note: "The root word ends in a consonant. Just add the suffix." },
      { root: "admire", add: "ation", result: "admiration", note: "The root word ends in ‘e’. Remove the ‘e’, then add the suffix." },
    ] },
  ] },
  { kind: "explain", title: TION, blocks: [
    { t: "text", text: "Look at what happens with these words. These words end in **-ate**: remove the -ate, then add **-ation**." },
    { t: "formula", rows: [{ root: "vibrate", add: "ation", result: "vibration" }, { root: "donate", add: "ation", result: "donation" }] },
    { t: "reveal", label: "What do you notice?", text: "The whole ‘-ate’ ending is removed before we add -ation: vibr**ate** → vibr + ation." },
  ] },
  { kind: "practice", title: TION, blocks: [
    { t: "sort", q: "Put the root words into the correct column to show what will happen when you add the -ation suffix.", columns: ["Just add -ation", "Remove the ‘e’, then add -ation", "Remove -ate, then add -ation"],
      items: [{ text: "determine", col: 1 }, { text: "inform", col: 0 }, { text: "organise", col: 1 }, { text: "translate", col: 2 }, { text: "found", col: 0 }, { text: "operate", col: 2 }] },
  ] },
  { kind: "practice", title: TION, blocks: [
    { t: "choices", q: "Choose the correct spelling of the highlighted words.", items: [
      { q: "The house was built on a sturdy …", options: ["foundashun", "foundation"], answer: 1 },
      { q: "Izzy was full of … to win the match.", options: ["determination", "ditermination"], answer: 0 },
      { q: "Please could you provide me with a …?", options: ["translasion", "translation"], answer: 1 },
      { q: "The group were praised for their … during the expedition.", options: ["organisation", "organization"], answer: 0 },
    ] },
  ] },
  { kind: "practice", title: TION, blocks: [
    { t: "spell", q: "Spell these words with the suffix -tion.", words: ["admiration", "information", "operation", "translation", "pollution"], tips: REMEMBER },
  ] },

  { kind: "explain", title: CIAN, blocks: [
    { t: "text", text: "Read these words." },
    { t: "cards", items: [{ title: "magi{cian}" }, { title: "techni{cian}" }, { title: "physi{cian}" }, { title: "electri{cian}" }, { title: "beauti{cian}" }, { title: "dieti{cian}" }, { title: "mathemati{cian}" }] },
    { t: "text", text: "What do all of these words have in common?" },
    { t: "reveal", text: "They all end with the suffix **-cian**. The /shun/ sound spelt {-cian} is used for **professions**." },
  ] },
  { kind: "explain", title: CIAN, blocks: [
    { t: "text", text: "Do you recognise a root word for these words ending in {-cian}? Tap a word to find out." },
    { t: "roots", items: [{ word: "musi{cian}", root: "music" }, { word: "politi{cian}", root: "politics" }, { word: "electri{cian}", root: "electric" }] },
  ] },
  { kind: "practice", title: CIAN, blocks: [
    { t: "match", q: "Match the spelling of the /shun/ suffix to the clue that helps us spell it.", pairs: [{ a: "{-cian}", b: "root words end in c or cs (professions)" }, { a: "{-tion}", b: "root words end in t or te (the most common)" }] },
  ] },
  { kind: "check", title: CIAN, blocks: [
    { t: "text", text: "Can you spot the root word? Which spelling pattern are we applying?" },
    { t: "choice", q: "action", options: ["root words end in c or cs (professions)", "root words end in t or te"], answer: 1, why: "action → act. The root word ends in t, so it is -tion." },
    { t: "choice", q: "mathematician", options: ["root words end in c or cs (professions)", "root words end in t or te"], answer: 0, why: "mathematician → mathematics. The root word ends in cs, so it is -cian." },
  ] },
  { kind: "explain", title: CIAN, blocks: [
    { t: "text", text: "When practising these spellings it can help to sing, rap or clap to a rhythm. I will clap and spell these words:" },
    { t: "clap", items: [{ word: "politician", chunks: ["pol", "it", "i", "c", "i", "a", "n"] }, { word: "magician", chunks: ["ma", "gi", "c", "i", "a", "n"] }] },
    { t: "text", text: "This helps us by breaking the word into smaller chunks, and focusing on the tricky parts. You try with one of these words:" },
    { t: "chips", items: ["musi{cian}", "electri{cian}", "techni{cian}", "opti{cian}"] },
  ] },
  { kind: "practice", title: CIAN, blocks: [
    { t: "spell", q: "Spell these words with a /shun/ suffix.", words: ["electrician", "technician", "politician", "musician", "magician"], tips: REMEMBER },
  ] },
  { kind: "practice", title: CIAN, blocks: [
    { t: "choices", q: "Choose the correct spelling.", items: [
      { options: ["musicion", "musision", "musician"], answer: 2 },
      { options: ["electrician", "electricion"], answer: 0 },
      { options: ["politition", "politician", "politishun"], answer: 1 },
      { options: ["technicsion", "technician", "technision"], answer: 1 },
      { options: ["magishun", "magicion", "magician"], answer: 2 },
    ] },
  ] },

  { kind: "explain", title: CURR, blocks: [
    { t: "chips", items: ["competi{tion}", "bargain"] },
    { t: "text", text: "What do you notice about the spellings? Let’s read the following words." },
    { t: "text", text: "‘Competition’ has the root word ‘compete’ and the suffix {-tion}. You can hear the ‘e’ and ‘i’ clearly, which helps to spell it: **comp-e-ti-tion**." },
    { t: "text", text: "The letters ‘ai’ make the sound ‘i’ in the word ‘bargain’ (or you might say the ‘a’ is silent). You can see several words inside ‘bargain’, including ‘gain’." },
  ] },
  { kind: "practice", title: CURR, blocks: [
    { t: "choices", q: "Which of these are spelt correctly?", items: [
      { options: ["compitition", "competition", "competishun", "competician"], answer: 1 },
      { options: ["bargan", "bargin", "bargine", "bargain"], answer: 3 },
    ] },
  ] },
  { kind: "practice", title: CURR, blocks: [
    { t: "lcwc", q: "Practise our curriculum words using the ‘look, cover, write, check’ strategy.", words: ["competition", "bargain"] },
  ] },

  { kind: "summary", title: "Spelling words with the suffixes -tion and -cian", blocks: [
    { t: "list", items: [
      "The /shun/ suffix can be spelt {-tion}, {-sion}, {-ssion} or {-cian}.",
      "The most common spelling for the /shun/ suffix is {-tion}.",
      "Words spelt with {-tion} often have a root word ending in ‘t’ or ‘te’.",
      "The suffix {-ation} turns verbs into nouns. It uses familiar spelling patterns.",
      "Words spelt with {-cian} often have a root word ending in ‘c’ or ‘cs’ and are used for professions.",
    ] },
  ] },
];
