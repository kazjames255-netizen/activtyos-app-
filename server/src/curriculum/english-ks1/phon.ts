// KS1 English — Phonics & Word Reading (Years 1–2). Original content aligned to the DfE National Curriculum (OGL v3.0).
// Grapheme/answer checks are recomputed by _check_e1.ts — re-run it after ANY edit here.
import type { CTopic } from "../types";

export const TOPIC: CTopic = {
  key: "phon",
  topic: "Phonics & Word Reading",
  subject: "English",
  years: {
    1: {
      year: 1,
      objectives: [
        "Apply phonic knowledge and skills as the route to decode words.",
        "Respond speedily with the correct sound to graphemes (letters or groups of letters) for all 40+ phonemes, including digraphs and trigraphs such as ai, ee, igh, oa, oo, ar, or, ur, ow, oi.",
        "Read accurately by blending the sounds in words that contain the graphemes taught so far.",
        "Read common exception words (tricky words) such as the, said, was, you, they, one, once, friend, school.",
      ],
      note: {
        title: "Year 1: sounds, blending and tricky words",
        body: `## What we are learning

Words are made of **sounds** (we call them phonemes). We write sounds with **letters**. Sometimes one sound needs **two or three letters** working as a team. These teams are called **digraphs** (2 letters) and **trigraphs** (3 letters).

| Team | Sound | Words |
| --- | --- | --- |
| ai | ay | paint, snail |
| ee | ee | tree, seed |
| igh | eye | high, light |
| oa | oh | coat, goat |
| oo | oo (as in zoo) | moon, spoon |
| ar | ah | park, car |
| or | or | corn, fork |
| ur | er | nurse, turn |
| ow | ow (as in cow) | town, owl |
| oi | oy | coin, oil |

## Worked example 1: blending
Say each sound, then push them together.
**th – i – n** → **thin**. Three sounds, four letters!

## Worked example 2: counting sounds
**moon** has 4 letters but only **3 sounds**: m – oo – n. The letters 'oo' work together as one sound.

## Worked example 3: tricky words
Some words do not sound the way they look, like **was**, **the**, **you** and **they**. We just learn them by heart!

**Say it like this:** "Sound it out, then blend it up!"`,
      },
      quiz: {
        title: "Phonics & Word Reading: Year 1 quiz",
        questions: [
          { key: "phon-y1-01", kind: "single", prompt: "Which word has the 'ai' sound, like in 'rain'? 🌧️", options: ["tell", "tail", "tall", "till"], answer: "tail", explanation: "'ai' says 'ay'. Sound it out: t – ai – l. The other words do not have the 'ay' sound.", difficulty: 1 },
          { key: "phon-y1-02", kind: "single", prompt: "Which word has the 'ee' sound, like in 'see'? 👀", options: ["fat", "fit", "fed", "feet"], answer: "feet", explanation: "'ee' says 'ee'. f – ee – t. Feet has the long 'ee' sound.", difficulty: 1 },
          { key: "phon-y1-03", kind: "single", prompt: "Which word has the 'igh' sound, like in 'light'? 💡", options: ["night", "nut", "net", "nap"], answer: "night", explanation: "The three letters 'igh' work together and say 'eye'. n – igh – t.", difficulty: 1 },
          { key: "phon-y1-04", kind: "single", prompt: "Which word has the 'oa' sound, like in 'coat'? 🧥", options: ["bat", "boot", "boat", "bet"], answer: "boat", explanation: "'oa' says 'oh'. b – oa – t. 'Boot' has 'oo', which says a different sound.", difficulty: 2 },
          { key: "phon-y1-05", kind: "single", prompt: "Which word has the 'ar' sound, like in 'car'? 🚗", options: ["form", "fern", "fan", "farm"], answer: "farm", explanation: "'ar' says 'ah'. f – ar – m. 'Form' has 'or' and 'fern' has 'er'.", difficulty: 2, diagnostic: true },
          { key: "phon-y1-06", kind: "single", prompt: "Which word has the 'oi' sound, like in 'coin'? 🪙", options: ["bowl", "boil", "ball", "bell"], answer: "boil", explanation: "'oi' says 'oy'. b – oi – l. In 'bowl' the letters 'ow' say 'oh'.", difficulty: 2 },
          { key: "phon-y1-07", kind: "short", prompt: "Blend the sounds: sh – ee – p 🐑\nType the word.", answer: "sheep", accepted: ["Sheep", "sheep."], explanation: "Say the sounds fast and squash them together: sh – ee – p makes 'sheep'.", difficulty: 2, diagnostic: true },
          { key: "phon-y1-08", kind: "single", prompt: "How many SOUNDS can you hear in 'rain'?\n(Not letters!)", options: ["2", "5", "3", "4"], answer: "3", explanation: "r – ai – n. The two letters 'ai' make just one sound, so there are 3 sounds but 4 letters.", difficulty: 3 },
          { key: "phon-y1-09", kind: "single", prompt: "Which word is a 'tricky word' that does not sound out the way it looks?", options: ["sad", "said", "sit", "sun"], answer: "said", explanation: "'Said' does not sound like s – ai – d. It says 'sed'. We learn it by heart.", difficulty: 2 },
          { key: "phon-y1-10", kind: "single", prompt: "Which word has the 'ur' sound in the middle, like in 'turn'?", options: ["barn", "born", "bean", "burn"], answer: "burn", explanation: "'ur' says 'er'. b – ur – n. 'Barn' has 'ar' and 'born' has 'or'.", difficulty: 3 },
        ],
      },
      flashcards: [
        { front: "ai", back: "Says 'ay'. rain, tail" },
        { front: "ee", back: "Says 'ee'. feet, green" },
        { front: "igh", back: "Three letters, one sound: 'eye'. night, light" },
        { front: "oa", back: "Says 'oh'. boat, coat" },
        { front: "oo (long)", back: "Says 'oo' as in zoo. moon, spoon" },
        { front: "ar", back: "Says 'ah'. car, farm" },
        { front: "or", back: "Says 'or'. fork, corn" },
        { front: "ur", back: "Says 'er'. burn, turn" },
        { front: "ow", back: "Says 'ow' as in cow. town, owl" },
        { front: "oi", back: "Says 'oy'. coin, boil" },
        { front: "Blending", back: "Say each sound, then push them together: c – a – t → cat" },
        { front: "Tricky word: said", back: "Does not sound out like it looks. Learn it by heart!" },
      ],
    },
    2: {
      year: 2,
      objectives: [
        "Read accurately words of two or more syllables that contain the graphemes taught so far.",
        "Learn further phonemes and alternative graphemes, including split digraphs (a–e, e–e, i–e, o–e, u–e).",
        "Read words containing common suffixes: -ing, -ed, -er, -est, -ful, -less, -ly.",
        "Read most common exception words, noting tricky or unusual parts.",
      ],
      note: {
        title: "Year 2: split digraphs, suffixes and alternative sounds",
        body: `## Split digraphs
A **split digraph** is two letters that work together as one sound, but have a letter in between. The magic 'e' at the end changes the vowel to say its name.

| Split digraph | Words |
| --- | --- |
| a–e | cake, name, tale |
| e–e | these, theme |
| i–e | kite, five, time |
| o–e | home, bone, stone |
| u–e | cube, June, huge |

## Suffixes
A **suffix** is a little bit added to the end of a word.

| Suffix | Meaning | Example |
| --- | --- | --- |
| -ing | happening now | play → playing |
| -ed | in the past | play → played |
| -ful | full of | help → helpful |
| -less | without | care → careless |
| -ly | how | slow → slowly |

## Worked example 1
**running**: take off the suffix -ing and you have **runn**, so the word we started with is **run**. The n was doubled.

## Worked example 2
The letter **c** can say 's' (cent, circus) and **g** can say 'j' (giant, giraffe).

**Say it like this:** "Spot the suffix, read the little word, then put it back together."`,
      },
      quiz: {
        title: "Phonics & Word Reading: Year 2 quiz",
        questions: [
          { key: "phon-y2-01", kind: "single", prompt: "Which word has a split digraph (a–e) in it?", options: ["gain", "gate", "get", "gap"], answer: "gate", explanation: "In 'gate' the 'a' and 'e' work as a team with a letter in between: g – a–e – t. It says 'gayt'.", difficulty: 1 },
          { key: "phon-y2-02", kind: "single", prompt: "Which word has a split digraph (o–e)?", options: ["hot", "hoop", "hop", "hope"], answer: "hope", explanation: "In 'hope' the 'o' and 'e' say 'oh' together. 'Hoop' has 'oo' next to each other, so it is not split.", difficulty: 2 },
          { key: "phon-y2-03", kind: "short", prompt: "Add -ing to 'jump'.\nType the new word.", answer: "jumping", accepted: ["Jumping", "jumping."], explanation: "'Jump' does not change. Just add -ing: jump + ing = jumping.", difficulty: 1 },
          { key: "phon-y2-04", kind: "single", prompt: "The suffix -less means...\nhopeless = hope + less", options: ["full of", "without", "again", "very big"], answer: "without", explanation: "-less means 'without'. Hopeless means 'without hope'.", difficulty: 2 },
          { key: "phon-y2-05", kind: "single", prompt: "Read the word: joyful 😀\nWhich part is the suffix?", options: ["joy", "oy", "jo", "ful"], answer: "ful", explanation: "'Joy' is the little word. '-ful' is added on the end and means 'full of'.", difficulty: 1 },
          { key: "phon-y2-06", kind: "single", prompt: "In which word does 'ow' say 'oh'?", options: ["cow", "owl", "snow", "town"], answer: "snow", explanation: "'ow' can say 'ow' (cow) or 'oh' (snow). Snow says 'snoh'.", difficulty: 2, diagnostic: true },
          { key: "phon-y2-07", kind: "single", prompt: "In which word does the letter 'c' say 's'?", options: ["cat", "cup", "city", "cot"], answer: "city", explanation: "'c' says 's' before 'i', 'e' or 'y'. City says 'sitty'. Before 'a', 'o' or 'u' it says 'k'.", difficulty: 2 },
          { key: "phon-y2-08", kind: "single", prompt: "In which word does the letter 'g' say 'j' (like in jam)?", options: ["gap", "gem", "goat", "gum"], answer: "gem", explanation: "'g' can say 'j' before 'e', 'i' or 'y'. Gem says 'jem'.", difficulty: 2, diagnostic: true },
          { key: "phon-y2-09", kind: "single", prompt: "Which word is a tricky word (a common exception word)?", options: ["mint", "must", "most", "mist"], answer: "most", explanation: "In 'most' the 'o' says its name ('mohst'). The others sound out just as they look.", difficulty: 3 },
          { key: "phon-y2-10", kind: "single", prompt: "Read: hopping 🐇\nWhat is the little word (base word) inside it?", options: ["hopp", "hope", "ping", "hop"], answer: "hop", explanation: "The p was doubled before -ing. Take off 'ping' and you are left with 'hop'.", difficulty: 3 },
        ],
      },
      flashcards: [
        { front: "a–e split digraph", back: "Says 'ay' with a letter in the middle: cake, gate" },
        { front: "i–e split digraph", back: "Says 'eye': kite, five" },
        { front: "o–e split digraph", back: "Says 'oh': home, bone" },
        { front: "u–e split digraph", back: "Says 'yoo' or 'oo': cube, June" },
        { front: "e–e split digraph", back: "Says 'ee': these, theme" },
        { front: "Suffix -ing", back: "Happening now: jump → jumping" },
        { front: "Suffix -ed", back: "In the past: jump → jumped" },
        { front: "Suffix -ful", back: "Full of: help → helpful" },
        { front: "Suffix -less", back: "Without: hope → hopeless" },
        { front: "Suffix -ly", back: "Tells how: slow → slowly" },
        { front: "c can say 's'", back: "Before i, e or y: city, cent" },
        { front: "g can say 'j'", back: "Before i, e or y: gem, giant" },
      ],
    },
  },
};
