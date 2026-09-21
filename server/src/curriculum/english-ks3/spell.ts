// KS3 English — Spelling (Years 7–9). Original content aligned to the DfE KS3 English programme of study (OGL v3.0):
// "spell correctly, including using morphology and etymology; proofread for spelling errors".
// Worked examples in the notes deliberately use DIFFERENT words from the quiz questions.
import type { CTopic } from "../types";
import { qb, cards } from "./_b";

const q7 = qb("spell", 7), q8 = qb("spell", 8), q9 = qb("spell", 9);

export const TOPIC: CTopic = {
  key: "spell",
  topic: "Spelling",
  subject: "English",
  years: {
    7: {
      year: 7,
      objectives: [
        "Add suffixes correctly (drop the e, double the consonant, change y to i).",
        "Form regular and irregular plurals (-s, -es, -ves, -oes).",
        "Choose correctly between common homophones (their/there/they're, your/you're, its/it's).",
        "Recognise silent letters (kn, wr, gn, mb) and use spelling strategies to learn tricky words.",
      ],
      note: {
        title: "Year 7: spelling rules, plurals, homophones and learning strategies",
        body: `## What you need to know

Most spellings follow patterns. Learn the pattern and you can spell hundreds of words.

## Adding suffixes

| Rule | Example |
| --- | --- |
| **Drop the silent e** before a suffix that starts with a vowel | hope → hoping, love → lovable |
| **Double the last letter** when a short word ends in one vowel + one consonant and the suffix starts with a vowel | run → running, sit → sitting |
| **Change y to i** after a consonant (but not before -ing) | happy → happiness, carry → carrying |
| **Keep the e** before a suffix that starts with a consonant | care → careful, late → lately |

## Plurals

- Most words just add **-s**: book → books.
- Words ending in **s, x, z, ch, sh** add **-es**: box → boxes, church → churches.
- Many words ending in **f or fe** change to **-ves**: knife → knives, leaf → leaves.
- Some words ending in **o** add **-es**: potato → potatoes (but photo → photos).

## Homophones (sound the same, spelled differently)

- **their** (belongs to them), **there** (a place), **they're** (they are).
- **your** (belongs to you), **you're** (you are).
- **its** (belongs to it), **it's** (it is / it has). No apostrophe for belonging with *its*.

## Silent letters

Some letters are written but not said: **k** in *knight*, **w** in *wrist*, **g** in *gnome*, and **b** after m in *lamb*.

## Worked example

Add **-ed** to *plan*: *plan* is short, ends in one vowel + one consonant, so double the n: *planned*. Add **-ed** to *hope*: drop the silent e: *hoped*.

## Learning strategy

Look, say, cover, write, check. Break long words into syllables (*in-ter-est-ing*) and make up a memory trick.`,
      },
      quiz: {
        title: "Spelling: Year 7 quiz",
        questions: [
          q7.single("Add -ing to “stop”. Which spelling is correct?", "stopping", ["stoping", "stoppeing", "stopeing"], "Stop is a short word ending in one vowel + one consonant, so double the p: stopping.", 1, { d: true }),
          q7.short("Add -ing to “make”. Type the new word.", "making", [], "Drop the silent e before a suffix that starts with a vowel: mak + ing = making.", 1),
          q7.single("Which is the correct plural of “wolf”?", "wolves", ["wolfs", "wolvs", "wolfes"], "Many words ending in f change the f to v and add -es: wolves.", 1),
          q7.single("Choose the correct word: ___ going to be late if we do not hurry.", "They're", ["Their", "There", "Theyre"], "They're is short for they are. Their shows belonging and there is a place.", 2),
          q7.single("Which word is spelled correctly (the British spelling)?", "neighbour", ["neighbor", "nieghbour", "neigbour"], "Neighbour uses “eigh” (as in eight) and the British -our ending.", 2, { d: true }),
          q7.short("Add -ness to “lazy”. Type the new word.", "laziness", [], "The word ends in a consonant + y, so change the y to i: lazi + ness = laziness.", 2),
          q7.single("Choose the correct word: The cat licked ___ paw.", "its", ["it's", "its'", "itz"], "Its (no apostrophe) shows belonging. It's always means it is or it has.", 2),
          q7.multi("Which TWO words contain a silent b?", ["climb", "comb"], ["clamp", "limp"], "Climb and comb both end in a silent b after m, just like lamb. Clamp and limp have no b.", 2),
          q7.single("Which sentence is spelled correctly?", "You're kind to lend me your pen.", ["Your kind to lend me your pen.", "You're kind to lend me you're pen.", "Your kind to lend me you're pen."], "You're = you are (“You are kind”). Your shows belonging (“your pen”).", 3),
          q7.single("Which word is spelled correctly?", "occasionally", ["ocassionally", "occasionaly", "occassionally"], "Occasionally has two c's, one s and two l's: occasion + al + ly.", 3),
        ],
      },
      flashcards: cards([
        ["Suffix rule: silent e", "Drop the e before a vowel suffix (hope → hoping); keep it before a consonant suffix (care → careful)."],
        ["Doubling rule", "Short word, one vowel + one consonant, vowel suffix: double the last letter (sit → sitting)."],
        ["Consonant + y", "Change y to i before most suffixes (happy → happiness) but keep y before -ing (carry → carrying)."],
        ["Plural of knife", "knives (f/fe often becomes -ves)"],
        ["Plural of potato / photo", "potatoes / photos"],
        ["their / there / they're", "belonging / place / they are"],
        ["your / you're", "belonging / you are"],
        ["its / it's", "belonging (no apostrophe) / it is or it has"],
        ["Silent letters", "kn (knight), wr (wrist), gn (gnome), mb (lamb)"],
        ["Look, say, cover, write, check", "The five-step method for learning a tricky spelling."],
      ]),
    },

    8: {
      year: 8,
      objectives: [
        "Spell words with the endings -tion, -sion, -ssion and -cian.",
        "Choose between -able and -ible and between -ance/-ence and -ant/-ent.",
        "Add prefixes (dis-, mis-, il-, im-, ir-) without changing the spelling of the root.",
        "Add -ly to words ending in -ic and spell unstressed vowels correctly.",
      ],
      note: {
        title: "Year 8: word endings, prefixes and tricky sounds",
        body: `## What you need to know

Many spelling mistakes happen at the **end** or the **start** of a word. Learn the patterns.

## The /shun/ ending

| Ending | When it is used | Examples |
| --- | --- | --- |
| **-tion** | most common; after most verbs | nation, station |
| **-sion** | root ends in d, de, s, se | division, decision |
| **-ssion** | root ends in ss or mit | mission, discussion |
| **-cian** | a person with a skill | musician, magician |

## -able or -ible?

- **-able** usually follows a whole word: comfortable, enjoyable (enjoy + able).
- **-ible** often follows a root that is not a word by itself: visible, terrible.

## -ance/-ant and -ence/-ent

There is no perfect rule, so learn word pairs: **difference/different, presence/present, confidence/confident**.

## Prefixes never change the root

dis- + satisfied = **dissatisfied** (two s's, because the root already starts with s). mis- + spell = **misspell**. Before certain letters in- changes: **il-** (il + legal), **im-** (im + mortal), **ir-** (ir + regular).

## Adding -ly to -ic words

Add **-ally**, not just -ly: dramatic → dramatically. The one exception is **public → publicly**.

## Tricky vowel sounds

Some vowels are hard to hear: lib**r**ary (not libary), Feb**r**uary, ev**e**ry.

## Worked example

*A person who tests your eyesight is an opti*+**cian**: a person with a skill takes -cian. *If you explode something, the noun is explo*+**sion**: the root ends in de, so the ending is -sion.`,
      },
      quiz: {
        title: "Spelling: Year 8 quiz",
        questions: [
          q8.single("Which word is spelled correctly (someone who works with electricity)?", "electrician", ["electrition", "electricion", "electrican"], "A person with a skill takes the ending -cian: electrician.", 1, { d: true }),
          q8.single("Which word is spelled correctly?", "disappear", ["dissapear", "disapear", "dissappear"], "The prefix dis- joins the root appear, which starts with a: dis + appear = disappear (one s, two p's).", 1),
          q8.single("Add the prefix ir- to “responsible”. Which spelling is correct?", "irresponsible", ["irresponsable", "iresponsible", "irrisponsible"], "ir + responsible keeps both r's: irresponsible. The ending is -ible.", 1),
          q8.short("Add the prefix im- to “polite”. Type the new word.", "impolite", [], "A prefix does not change the root, so there is only one m from the prefix and none from polite: impolite.", 2),
          q8.single("Which word is spelled correctly (able to happen)?", "possible", ["possable", "possibel", "posible"], "Poss is not a whole word, so the ending is -ible (like visible), and there are two s's: possible.", 2),
          q8.single("Which word is spelled correctly (very careful and complete)?", "thorough", ["through", "though", "thought"], "Thorough means complete. Through means from one side to the other, though means despite, and thought is from think.", 2),
          q8.multi("Which TWO words are spelled correctly?", ["interest", "temperature"], ["intrest", "temprature"], "Sound out every syllable: in-ter-est and tem-per-a-ture.", 2),
          q8.short("Add -ly to “enthusiastic”. Type the new word.", "enthusiastically", [], "Words ending in -ic add -ally: enthusiastic + ally = enthusiastically.", 2, { d: true }),
          q8.short("Add -ly to “public”. Type the new word.", "publicly", [], "Public is the one exception to the -ic + ally rule: publicly.", 3),
          q8.single("Which is the correct spelling of the noun made from the verb “exist”?", "existence", ["existance", "exsistence", "existense"], "Learn the pair: existent goes with existence (like different and difference). There is an x, then s-t.", 3),
        ],
      },
      flashcards: cards([
        ["-tion, -sion, -ssion, -cian", "-tion is most common; -sion after d/s; -ssion after ss/mit; -cian for people (musician)."],
        ["-able or -ible?", "-able after a whole word (comfortable); -ible after a root that is not a word (visible)."],
        ["Pairs to learn", "difference/different, presence/present, confidence/confident"],
        ["dis + satisfied", "dissatisfied: the prefix and root each keep their s."],
        ["mis + spell", "misspell: keep both s's."],
        ["il-, im-, ir-", "il + legal, im + mortal, ir + regular"],
        ["-ic + ly", "Add -ally: dramatic → dramatically."],
        ["Exception to -ally", "public → publicly"],
        ["Tricky vowels", "library, February, every: say the middle sound clearly."],
      ]),
    },

    9: {
      year: 9,
      objectives: [
        "Use Greek and Latin roots (bio, graph, chron, phon, geo) to work out and spell unfamiliar words.",
        "Distinguish commonly confused words (affect/effect, accept/except, principal/principle, stationary/stationery, complement/compliment, whose/who's).",
        "Spell frequently misspelled and borrowed words with confidence.",
        "Proofread your own writing systematically for spelling errors.",
      ],
      note: {
        title: "Year 9: roots, confusable words and proofreading",
        body: `## What you need to know

By Year 9 you can spell most words. The rest are **tricky words** and **confusable words**. Roots help with both.

## Greek and Latin roots

| Root | Meaning | Words |
| --- | --- | --- |
| bio | life | biology, biodiversity |
| graph | write or draw | paragraph, graphic |
| chron | time | chronic, synchronise |
| phon | sound | phonics, symphony |
| geo | earth | geology, geometry |

If you know the roots, you can build the word: **bio** (life) + **logy** (study of) = **biology**.

## Confusable words

- **affect** (verb: to change something) and **effect** (noun: a result). *Sleep affects your mood; the effect is a better day.*
- **accept** (to receive) and **except** (apart from).
- **principal** (head of a school; main) and **principle** (a rule or belief).
- **stationary** (not moving) and **stationery** (paper and pens: **e** for **e**nvelope).
- **complement** (goes well with, completes) and **compliment** (a kind remark: **I** like a compl**i**ment).
- **whose** (belonging to whom) and **who's** (who is / who has).

## Tricky words, with tricks

| Word | Trick |
| --- | --- |
| parliament | there is “lia” in the middle: parl-**ia**-ment |
| privilege | pri-vi-lege: no d, no a |
| recommend | one c, two m's |
| exaggerate | two g's |
| bureau | borrowed from French: keep the eau |

## Proofreading

Read your work **backwards** word by word, so you look at each spelling and not the meaning. Check the words you often get wrong, and use a dictionary.`,
      },
      quiz: {
        title: "Spelling: Year 9 quiz",
        questions: [
          q9.single("Choose the correct word: The new rules will ___ everyone in the school.", "affect", ["effect", "afect", "effeckt"], "Affect is the verb (to change). Effect is usually the noun (a result).", 1, { d: true }),
          q9.single("Which word is spelled correctly?", "guarantee", ["garantee", "guarentee", "guarrantee"], "Guarantee has a silent u after g and ends in -ntee.", 1),
          q9.single("Choose the correct word: Please ___ my apology.", "accept", ["except", "expect", "acept"], "Accept means to receive. Except means apart from.", 1),
          q9.single("Which word is spelled correctly (how a word is said)?", "pronunciation", ["pronounciation", "pronunsiation", "pronunciasion"], "Pronounce has an “ou”, but pronunciation drops it: pro-nun-ci-a-tion.", 2, { d: true }),
          q9.single("Choose the correct word: The ___ of the school welcomed the parents.", "principal", ["principle", "principel", "princepal"], "Principal (ends -pal, like pal) is the head of a school. A principle is a rule.", 2),
          q9.short("Correct this misspelling of a set of survey questions: “questionaire”. Type the right spelling.", "questionnaire", [], "Questionnaire has a double n: question + naire.", 2),
          q9.multi("Which TWO words are spelled correctly?", ["millennium", "restaurant"], ["milennium", "restaraunt"], "Millennium has two l's and two n's; restaurant is rest-au-rant.", 2),
          q9.single("Which word means “the story of a person’s life, written by someone else”?", "biography", ["autobiography", "geography", "photograph"], "bio (life) + graph (write) = biography. Autobiography is written by the person themselves.", 2),
          q9.single("Which sentence is spelled correctly?", "Whose bag is this?", ["Who's bag is this?", "Whos bag is this?", "Whose' bag is this?"], "Whose shows belonging. Who's would mean “who is”.", 3),
          q9.single("Which word is spelled correctly (careful and hard-working)?", "conscientious", ["concientious", "consientious", "conscientous"], "It comes from conscience, so keep the “sci” in the middle: con-sci-en-tious.", 3),
        ],
      },
      flashcards: cards([
        ["Root: bio", "life (biology)"],
        ["Root: graph", "write or draw (paragraph)"],
        ["Root: chron", "time (chronic)"],
        ["Root: phon", "sound (phonics)"],
        ["Root: geo", "earth (geology)"],
        ["affect / effect", "affect = verb (to change); effect = noun (a result)"],
        ["accept / except", "accept = receive; except = apart from"],
        ["principal / principle", "principal = head or main; principle = rule or belief"],
        ["stationary / stationery", "not moving / paper and pens (e for envelope)"],
        ["complement / compliment", "completes / a kind remark (I like a compliment)"],
        ["whose / who's", "belonging / who is"],
      ]),
    },
  },
};
