// KS1 English — Spelling (Years 1–2). Original content aligned to the DfE National Curriculum (OGL v3.0).
// Spelling-rule answers (plurals, suffixes) are recomputed by _check_e1.ts — re-run it after ANY edit here.
import type { CTopic } from "../types";

export const TOPIC: CTopic = {
  key: "spell",
  topic: "Spelling",
  subject: "English",
  years: {
    1: {
      year: 1,
      objectives: [
        "Spell the days of the week.",
        "Spell common exception words (such as school, friend, said, was).",
        "Add -s and -es to words (plural of nouns and third person singular of verbs).",
        "Add the endings -ing and -ed to verbs where no change is needed to the root word.",
        "Spell words with -ff, -ll, -ss, -zz and -ck at the end.",
      ],
      note: {
        title: "Year 1: days, plurals and word endings",
        body: `## Days of the week
Days always start with a **capital letter**. Say them in chunks to help you spell them:

| Day | Say it like this |
| --- | --- |
| Monday | Mon-day |
| Tuesday | Tues-day |
| Wednesday | Wed-nes-day (we say it 'Wenz-day' but write the 'd'!) |
| Thursday | Thurs-day |
| Friday | Fri-day |
| Saturday | Sat-ur-day |
| Sunday | Sun-day |

## More than one (plurals)
- Most words: just add **-s**. cat → cat**s**, pen → pen**s**.
- Words ending in **s, x, sh, ch**: add **-es**. fox → fox**es**, brush → brush**es**, church → church**es**.

## Worked example 1: adding -ing and -ed
play → play**ing**, play**ed**. The little word does not change.

## Worked example 2: ending sounds
After a short vowel, we often double the last letter or use **ck**: doll, mess, fizz, sock, duck.

## Tricky words
Learn these by heart: **school**, **friend**, **said**, **was**, **the**.

**Say it like this:** "Say it slowly in chunks, then write the chunks."`,
      },
      quiz: {
        title: "Spelling: Year 1 quiz",
        questions: [
          { key: "spell-y1-01", kind: "single", prompt: "Which is the right way to spell the day after Monday?", options: ["Tusday", "Teusday", "Tuesdey", "Tuesday"], answer: "Tuesday", explanation: "Tuesday is Tues-day. It starts with a capital T and has 'ue' in the middle.", difficulty: 1 },
          { key: "spell-y1-02", kind: "single", prompt: "Which is spelt correctly?", options: ["Wensday", "Wednesday", "Wedensday", "Wenesday"], answer: "Wednesday", explanation: "Say it in chunks: Wed-nes-day. The first 'd' is silent in speech but we write it.", difficulty: 2 },
          { key: "spell-y1-03", kind: "short", prompt: "One dog 🐶, two ___\nType the word for more than one.", answer: "dogs", accepted: ["Dogs", "dogs.", "two dogs"], explanation: "Most words just add -s to show more than one.", difficulty: 1 },
          { key: "spell-y1-04", kind: "single", prompt: "One box 📦, two ___", options: ["boxs", "boxies", "boxes", "boxis"], answer: "boxes", explanation: "Words ending in x need -es to show more than one: box → boxes.", difficulty: 2, diagnostic: true },
          { key: "spell-y1-05", kind: "short", prompt: "One dish 🍽️, two ___\nType the word for more than one.", answer: "dishes", accepted: ["Dishes", "dishes.", "two dishes"], explanation: "Words ending in sh add -es: dish → dishes.", difficulty: 2 },
          { key: "spell-y1-06", kind: "short", prompt: "Add -ing to 'walk'.\nType the new word.", answer: "walking", accepted: ["Walking", "walking."], explanation: "'Walk' does not change. Just add -ing: walking.", difficulty: 1 },
          { key: "spell-y1-07", kind: "short", prompt: "Add -ed to 'help'.\nType the new word.", answer: "helped", accepted: ["Helped", "helped."], explanation: "'Help' does not change. Just add -ed: helped.", difficulty: 2, diagnostic: true },
          { key: "spell-y1-08", kind: "single", prompt: "Where do you go to learn? 🏫\nWhich is spelt correctly?", options: ["scool", "skool", "shool", "school"], answer: "school", explanation: "School is a tricky word. The 'k' sound is made by 'ch'. Learn it by heart!", difficulty: 2 },
          { key: "spell-y1-09", kind: "single", prompt: "One bus 🚌, two ___", options: ["buss", "bus's", "buses", "buses'"], answer: "buses", explanation: "Words ending in s add -es to show more than one: bus → buses. No apostrophe needed!", difficulty: 3 },
          { key: "spell-y1-10", kind: "single", prompt: "Which word is NOT spelt correctly?", options: ["off", "hiss", "bell", "buz"], answer: "buz", explanation: "Short words ending in a 'z' sound after a short vowel usually double it: buzz.", difficulty: 3 },
        ],
      },
      flashcards: [
        { front: "Days of the week", back: "Always start with a capital letter: Monday, Tuesday..." },
        { front: "Wednesday", back: "Say it: Wed-nes-day" },
        { front: "Plural: most words", back: "Add -s: dog → dogs" },
        { front: "Plural: s, x, sh, ch", back: "Add -es: box → boxes, dish → dishes" },
        { front: "walk + ing", back: "walking (the little word stays the same)" },
        { front: "jump + ed", back: "jumped" },
        { front: "school", back: "Tricky word! s-ch-oo-l" },
        { front: "friend", back: "Tricky word! Say: fri-end" },
        { front: "said", back: "Tricky word! s-ai-d" },
        { front: "Double endings", back: "bell, hiss, buzz, duck: after a short vowel we double or use -ck" },
      ],
    },
    2: {
      year: 2,
      objectives: [
        "Distinguish between homophones and near-homophones (there/their/they're, to/too/two, see/sea).",
        "Add suffixes -ing, -ed, -er, -est to words: doubling the last letter (hop → hopping), dropping the e (make → making) and changing y to i (cry → cried).",
        "Learn to spell common exception words.",
        "Use the apostrophe for contracted forms (can't, didn't) and for singular possession (Sam's bag).",
      ],
      note: {
        title: "Year 2: homophones, suffix rules and apostrophes",
        body: `## Homophones
**Homophones** sound the same but are spelt differently and mean different things.

| Word | Meaning | Example |
| --- | --- | --- |
| there | a place | Look over **there**. |
| their | belongs to them | **Their** house is red. |
| they're | they are | **They're** happy. |
| to / too / two | towards / also / the number 2 | I have **two** cats **too**. |
| see / sea | look / water | We **see** the **sea**. |

## Adding suffixes
| Rule | Example |
| --- | --- |
| Short vowel + one consonant: **double** it | run → running |
| Ends in **e**: **drop** the e | hope → hoping |
| Ends in consonant + **y**: change y to **i** | try → tried |

## Apostrophes
- **Missing letters:** is not → **isn't**, can not → **can't**.
- **Belonging:** the coat belongs to Mia → **Mia's** coat.

**Say it like this:** "The apostrophe takes the place of a missing letter, or shows who something belongs to."`,
      },
      quiz: {
        title: "Spelling: Year 2 quiz",
        questions: [
          { key: "spell-y2-01", kind: "single", prompt: "I have ___ apples. 🍎🍎", options: ["to", "too", "tow", "two"], answer: "two", explanation: "The number 2 is spelt 'two'. 'To' means towards and 'too' means also.", difficulty: 1 },
          { key: "spell-y2-02", kind: "single", prompt: "We swim in the ___. 🌊", options: ["see", "sea", "sey", "se"], answer: "sea", explanation: "'Sea' is the water. 'See' means to look with your eyes.", difficulty: 1 },
          { key: "spell-y2-03", kind: "single", prompt: "___ dog is big. 🐕\n(The dog belongs to them.)", options: ["There", "They're", "Their", "Then"], answer: "Their", explanation: "'Their' shows that something belongs to them.", difficulty: 2, diagnostic: true },
          { key: "spell-y2-04", kind: "single", prompt: "Put the book over ___.\n(It is a place.)", options: ["their", "there", "they're", "then"], answer: "there", explanation: "'There' is a place. Remember: there has the word 'here' in it, and here is a place too.", difficulty: 2 },
          { key: "spell-y2-05", kind: "single", prompt: "Which is the right way to write 'do not'?", options: ["dont", "do'nt", "d'ont", "don't"], answer: "don't", explanation: "The apostrophe goes where the letter 'o' has gone: do not → don't.", difficulty: 1 },
          { key: "spell-y2-06", kind: "short", prompt: "Add -ing to 'hop'. 🐇\nType the new word.", answer: "hopping", accepted: ["Hopping", "hopping."], explanation: "Short vowel then one consonant: double the p. hop → hopping.", difficulty: 2, diagnostic: true },
          { key: "spell-y2-07", kind: "single", prompt: "Add -ed to 'cry'. 😢", options: ["cryed", "cried", "cryd", "criied"], answer: "cried", explanation: "When a word ends in a consonant and y, change the y to i before -ed: cry → cried.", difficulty: 3 },
          { key: "spell-y2-08", kind: "single", prompt: "Add -ing to 'make'.", options: ["makeing", "makking", "making", "makng"], answer: "making", explanation: "When a word ends in e, drop the e before -ing: make → making.", difficulty: 2 },
          { key: "spell-y2-09", kind: "single", prompt: "The bag belongs to Sam. Which is right?", options: ["This is Sams bag.", "This is Sam's bag.", "This is Sams' bag.", "This is Sam'sbag."], answer: "This is Sam's bag.", explanation: "For one person, add apostrophe + s to show who it belongs to: Sam's bag.", difficulty: 2 },
          { key: "spell-y2-10", kind: "single", prompt: "Which word is spelt WRONG?", options: ["because", "people", "every", "beautifull"], answer: "beautifull", explanation: "Beautiful ends in just one 'l' after 'fu': beauti-ful. The suffix -ful has one l.", difficulty: 3 },
        ],
      },
      flashcards: [
        { front: "there", back: "A place: over there (it has 'here' inside)" },
        { front: "their", back: "Belongs to them: their dog" },
        { front: "they're", back: "They are: they're happy" },
        { front: "to / too / two", back: "to = towards, too = also, two = 2" },
        { front: "see / sea", back: "see = look, sea = water" },
        { front: "run + ing", back: "running (double the n)" },
        { front: "make + ing", back: "making (drop the e)" },
        { front: "cry + ed", back: "cried (change y to i)" },
        { front: "don't / can't", back: "The apostrophe takes the place of missing letters." },
        { front: "Sam's bag", back: "Apostrophe + s shows who it belongs to." },
      ],
    },
  },
};
