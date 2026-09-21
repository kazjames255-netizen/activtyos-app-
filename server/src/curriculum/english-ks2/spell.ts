// KS2 English — Spelling (Years 3–6). Original content aligned to the DfE National Curriculum, English Appendix 1 (OGL v3.0).
// Word-building answers and "spelled correctly" items are recomputed / dictionary-checked by _check_e2.ts — re-run it after ANY edit here.
import type { CTopic } from "../types";
import { build, mu, sg, sh } from "./_h";

export const TOPIC: CTopic = {
  key: "spell",
  topic: "Spelling",
  subject: "English",
  years: {
    3: {
      year: 3,
      objectives: [
        "Add prefixes un-, dis-, mis-, re- and in-/im- to root words and spell the new word correctly.",
        "Add the suffixes -ly and -ous to root words, including changes to the end of the root (y to i, dropping e).",
        "Spell common homophones and near-homophones correctly (hear/here, their/there/they're).",
        "Spell words from the Year 3/4 statutory word list.",
      ],
      note: {
        title: "Year 3: prefixes, -ly, -ous and tricky words",
        body: `## What you need to know

A **prefix** goes at the start of a word and changes its meaning. A **suffix** goes at the end.

- **dis-, mis-, un-, re-, in-:** the root word does not change. dis + like = **dislike**, un + natural = **unnatural** (two n's because both letters stay).
- **in- becomes im- before p or m:** patient → **impatient**.
- **-ly:** usually just add it (sadly). If the word ends in **y**, change y to i (happy → **happily**). If it ends in **e**, keep the e (safe → **safely**).
- **-ous:** poison + ous = **poisonous**. If the word ends in e, drop it: fame + ous = **famous**.

## Worked example 1

dis + agree = **disagree**. Nothing is lost or added.

## Worked example 2

Which is right: “their”, “there” or “they're”? “**Their** dog is friendly” shows belonging. “**There** it is” shows a place. “**They're**” means they are.

## Worked example 3: learning tricky words

Say it in syllables (Feb-ru-ar-y), then Look, Cover, Write, Check.

| Prefix | Meaning | Example |
| --- | --- | --- |
| dis- | not, the opposite | disagree |
| mis- | wrongly | mistake |
| re- | again | rebuild |
| im- | not (before p or m) | impatient |`,
      },
      quiz: {
        title: "Spelling: Year 3 quiz",
        questions: build("spell", 3, [
          sg("Which word is spelled correctly?", "surprise", ["suprise", "surprize", "sirprise"], 2, "Learn it in parts: sur-prise. There is an r after the first u and the ending is -ise.", 1),
          sh("Add the prefix dis- to “appear” to make a new word. Type it.", "disappear", [], "The root word does not change when you add a prefix: dis + appear = disappear. The prefix dis- has one s, and appear keeps its double p.", 1),
          sg("Choose the correct word to complete the sentence: We could ___ the birds singing in the trees.", "hear", ["here", "hair", "heer"], 0, "“Hear” has the word ear in it, and you hear with your ears. “Here” is a place.", 1),
          sh("Add -ly to “complete”. Type the new word.", "completely", [], "Complete ends in e and the suffix -ly starts with a consonant, so keep the e: completely.", 2, true),
          sh("Add -ous to “danger”. Type the new word.", "dangerous", [], "Danger does not end in e or y, so nothing changes: danger + ous = dangerous.", 2),
          sg("Choose the correct word: ___ coats are hanging on the pegs.", "Their", ["There", "They're", "Thier"], 3, "“Their” shows that something belongs to them. “There” is a place and “they're” means “they are”.", 2, true),
          mu("Which TWO words are spelled correctly?", ["different", "diffrent", "libary", "library"], ["different", "library"], "Different has three syllables (dif-fer-ent) and library has a second r after the b: li-brar-y.", 2),
          sg("Which prefix turns “possible” into a word meaning “not possible”?", "im-", ["un-", "dis-", "mis-"], 1, "The prefix in- becomes im- before the letters p and m, giving impossible.", 2),
          sh("Add the prefix mis- to “spell”. Type the new word.", "misspell", [], "Nothing is dropped when you add a prefix. Mis ends in s and spell begins with s, so there are two s's in the middle.", 3),
          sg("Which is the correct spelling of the word meaning how tall something is?", "height", ["hieght", "heigth", "hyte"], 2, "Height ends in -ght, like weight and eight. It is not the same as its opposite, depth.", 3),
        ]),
      },
      flashcards: [
        { front: "dis- + like", back: "dislike (dis- means not or the opposite)" },
        { front: "un- + natural", back: "unnatural (two n's: both letters stay)" },
        { front: "-ly on a word ending in y (happy)", back: "Change y to i: happily." },
        { front: "-ly on a word ending in e (safe)", back: "Keep the e: safely." },
        { front: "poison + ous", back: "poisonous" },
        { front: "fame + ous", back: "famous (drop the e before -ous)" },
        { front: "patient with a prefix meaning “not”", back: "impatient (im- before p or m)" },
        { front: "their / there / they're", back: "their = belongs to them; there = place; they're = they are" },
        { front: "hear or here?", back: "hear = with your ears; here = in this place" },
      ],
    },
    4: {
      year: 4,
      objectives: [
        "Spell words ending in the suffix -ation, and add -ous to root words, including those ending in -e or -our.",
        "Spell words with the /shun/ ending: -tion, -sion, -ssion and -cian.",
        "Use the prefixes in-, il-, im-, ir-, sub-, inter-, super-, anti- and auto- and know what they mean.",
        "Spell homophones and near-homophones (whose/who's, effect/affect, accept/except, weather/whether).",
      ],
      note: {
        title: "Year 4: /shun/ endings, -ation, -ous and more prefixes",
        body: `## What you need to know

The /shun/ sound at the end of a word can be spelled four ways.

- **-tion** is the most common: invention, action.
- **-sion** after a vowel, or after l, n or r: division, confusion, expansion.
- **-ssion** when you can hear a double s: passion, mission.
- **-cian** for a person whose job is linked to a word ending in -c: music → **musician**, magic → **magician**.

**-ation** turns a verb into a noun: explore → **exploration**. If the verb ends in e, drop it: admire → **admiration**.

## Worked example 1: -ous

vigour + ous = **vigorous**. The -our becomes -or before -ous.

## Worked example 2: prefixes that mean “not”

il- before l: **illogical**. im- before m or p: **immature**. ir- before r: **irregular**. in- otherwise: **inactive**.

## Worked example 3: homophones

“Whose bag is this?” asks about belonging. “Who's” means “who is”. “The **effect** of the medicine” names a result (a noun).

| Prefix | Meaning | Example |
| --- | --- | --- |
| sub- | under | submarine |
| inter- | between | international |
| super- | above, beyond | superstar |
| anti- | against | anticlockwise |`,
      },
      quiz: {
        title: "Spelling: Year 4 quiz",
        questions: build("spell", 4, [
          sg("Which word is spelled correctly?", "electrician", ["electrition", "electrissian", "electrican"], 1, "A person with a job connected to a word ending in -c usually ends in -cian: electric becomes electrician.", 1),
          sh("Add the suffix -ation to “inform”. Type the new word.", "information", [], "Inform ends in a consonant, so just add the suffix: inform + ation = information.", 1),
          sg("The prefix sub- means:", "under", ["above", "against", "between"], 0, "Sub- means under, as in submarine (under the sea) and subway.", 1),
          sh("Add the suffix -ation to “adore”. Type the new word.", "adoration", [], "Adore ends in e. Drop the e before adding -ation: ador + ation = adoration.", 2),
          sh("Add the correct prefix to “legal” to make a word meaning “not legal”. Type the new word.", "illegal", [], "The prefix meaning not becomes il- before the letter l. That gives illegal, with two l's.", 2, true),
          sg("Which is the correct spelling of the word meaning a talk about a topic?", "discussion", ["discusion", "discution", "discushion"], 3, "You can hear a double s in this word, so the /shun/ ending is spelled -ssion. Think of session, mission and permission.", 2, true),
          mu("Which TWO words are spelled correctly?", ["decision", "decission", "collission", "collision"], ["decision", "collision"], "Both end in -sion after a vowel and a single s: deci-sion and colli-sion.", 2),
          sg("Choose the correct word: ___ coat is left on the floor?", "Whose", ["Who's", "Whos", "Hoose"], 2, "Whose asks who something belongs to. Who's is short for who is, so “Who's coat” would not make sense.", 2),
          sg("Choose the correct word: The new rule had a big ___ on our lunchtimes.", "effect", ["affect", "efect", "affekt"], 1, "Here we need a noun, meaning a result. That is effect. Affect is the verb, as in “rain will affect the match”.", 3),
          sh("Add the suffix -ous to “humour”. Type the new word.", "humorous", [], "When you add -ous to a word ending in -our, the u is dropped: humour becomes humor + ous = humorous.", 3),
        ]),
      },
      flashcards: [
        { front: "musician: why -cian?", back: "A person's job linked to a word ending in -c: music, magic, optic." },
        { front: "Which /shun/ ending is most common?", back: "-tion (invention, action)" },
        { front: "-sion or -ssion?", back: "-ssion when you hear a double s (discussion). -sion after a vowel, l, n or r (confusion)." },
        { front: "explore + ation", back: "exploration (drop the e)" },
        { front: "admire + ation", back: "admiration (drop the e)" },
        { front: "il-, im-, ir- meaning", back: "Not: illogical, impatient, irresponsible." },
        { front: "vigour + ous", back: "vigorous (-our becomes -or)" },
        { front: "sub-, inter-, super-, anti-", back: "under, between, above/beyond, against" },
        { front: "whose or who's?", back: "whose = belongs to whom; who's = who is" },
        { front: "effect or affect?", back: "effect = a result (noun); affect = to change something (verb)" },
      ],
    },
    5: {
      year: 5,
      objectives: [
        "Spell words ending in -able/-ible and -ably/-ibly, and -ant/-ance/-ancy and -ent/-ence/-ency.",
        "Spell words ending in -cious/-tious and -cial/-tial.",
        "Add suffixes to words ending in -fer, doubling the r only when the stress falls on the last syllable.",
        "Spell words with the letter string ough and words with silent letters.",
        "Distinguish between homophones and other words that are often confused.",
      ],
      note: {
        title: "Year 5: -able or -ible, -ant or -ent, and other tricky patterns",
        body: `## What you need to know

**-able or -ible?** If you can take away -able and still have a real word, use **-able**: comfort → comfortable, adore → adorable. If not, it is often **-ible**: possible, horrible, visible, flexible.

**-ant or -ent?** Use **-ant** when related to a word ending in -ation: observation → observant. Use **-ent** after a soft c or g, or when the family word has -ence: innocent, decent.

**Soft c and g** keep their e before -able: manage → **manageable**.

**-cial or -tial?** -cial usually follows a vowel (special, social). -tial usually follows a consonant (essential, partial).

**-cious or -tious:** vicious, precious, but ambitious, cautious.

## Worked example 1: -fer

refer + ing = **referring** (stress on the last syllable, so double the r). But refer + ence = **reference** (stress moves to the first syllable, no doubling).

## Worked example 2: ough

Same letters, different sounds: **although** /oh/, **rough** /uff/, **cough** /off/, **through** /oo/.

| Word | Silent letter |
| --- | --- |
| doubt | b |
| island | s |
| solemn | n |
| knight | k and gh |`,
      },
      quiz: {
        title: "Spelling: Year 5 quiz",
        questions: build("spell", 5, [
          sg("Which word is spelled correctly?", "yacht", ["yatch", "yaht", "yach"], 1, "Yacht is a statutory word with a silent ch that must simply be learned: y-a-c-h-t.", 1),
          sh("Add the suffix -able to “depend”. Type the new word.", "dependable", [], "Depend is a real word on its own, so the ending is -able: dependable.", 1),
          sg("Which is the correct spelling of the word meaning unsure and pausing?", "hesitant", ["hesitent", "hesatant", "hezitant"], 2, "Hesitant is related to hesitation, which has -ation, so the ending is -ant.", 1),
          sg("Which is the correct spelling of the word in “an ___ letter from the head office”?", "official", ["offical", "officail", "offitial"], 3, "After a vowel (the i) the ending is usually -cial: official, special, social.", 2),
          mu("Which TWO words are spelled correctly?", ["sensible", "incredable", "flexable", "terrible"], ["sensible", "terrible"], "Sens, terr and flex are not complete words on their own, so we use -ible: sensible, terrible. The other two should be incredible and flexible.", 2, true),
          sg("Which is the correct spelling of the word meaning feeling that something is not quite right?", "suspicious", ["suspitious", "suspishious", "suspicous"], 0, "Suspicious comes from suspicion, which has a c, so the ending is -cious.", 2, true),
          sh("Add the suffix -able to “notice”. Type the new word.", "noticeable", [], "The e stays after a soft c. Without it the c would be read as a hard k sound, so we keep the e to keep the c soft.", 3),
          sh("Add the suffix -ed to “prefer”. Type the new word.", "preferred", [], "The stress is on the last syllable (pre-FER), so double the r before adding -ed.", 3),
          sg("Which word has the same “ough” sound as the one in “though”?", "dough", ["rough", "cough", "through"], 2, "Though and dough both rhyme with “go”. Rough, cough and through each have different sounds.", 2),
          sg("Choose the correct word: The car was ___ at the traffic lights.", "stationary", ["stationery", "stationairy", "stationnary"], 1, "Stationary means not moving (it has an a, like car). Stationery is paper and pens (it has an e, like envelope).", 2),
        ]),
      },
      flashcards: [
        { front: "-able or -ible?", back: "-able if the root is a real word (comfortable). Otherwise often -ible (possible, horrible)." },
        { front: "manage + able", back: "manageable (keep the e after a soft g)" },
        { front: "-ant or -ent?", back: "-ant if related to a word with -ation (observation, observant); -ent after soft c or g (innocent)." },
        { front: "-cial or -tial?", back: "-cial after a vowel (special, social); -tial after a consonant (essential, partial)." },
        { front: "refer + ing / ed", back: "referring, referred (double the r: stress on the last syllable)" },
        { front: "refer + ence", back: "reference (stress moves, so no doubling)" },
        { front: "The four sounds of ough", back: "although, rough, cough, through" },
        { front: "Silent letters: doubt, island, solemn", back: "silent b, silent s, silent n" },
        { front: "principal vs principle", back: "principal = head or main (a pal); principle = a rule" },
      ],
    },
    6: {
      year: 6,
      objectives: [
        "Spell words from the Year 5/6 statutory word list, including those with double letters and unstressed vowels.",
        "Use the rule “i before e, except after c” and know its common exceptions.",
        "Add the suffixes -ify and -ise, and add -ed and -ing to words ending in consonant + y.",
        "Use prefixes such as semi-, trans-, mid-, non-, pre- and know their meanings.",
        "Choose between related words such as practice (noun) and practise (verb).",
      ],
      note: {
        title: "Year 6: statutory words, exceptions and word families",
        body: `## What you need to know

At the end of primary school you are expected to spell a long list of tricky words. Break them into parts and use a **memory trick**.

- **i before e, except after c** (when it rhymes with “bee”): c**ei**ling, dec**ei**ve, but bel**ie**ve and f**ie**ld. Exceptions: prot**ei**n, caff**ei**ne.
- **Double letters:** embarrass (two r's, two s's), o**cc**ur (two c's), co**mm**i**tt**ee (two m's, two t's).
- **-ify:** simple → simplify, class → classify.
- **Consonant + y:** change y to i before -ed (carry → **carried**) but keep y before -ing (carry → **carrying**).

## Worked example 1: a memory trick

Separate: there is **a rat** in sepaRATe.

## Worked example 2: noun and verb

In British English, **licence** is the noun (a driving licence) and **license** is the verb (they license the shop). It works like **advice** (noun) and **advise** (verb): c for the noun, s for the verb.

## Worked example 3: prefixes

semi- means half (semicircle), trans- means across (transatlantic), mid- means middle, non- means not.

| Word | Trick |
| --- | --- |
| conscience | there is “science” inside it |
| queue | q, then u-e-u-e |
| committee | two m's, two t's, two e's |`,
      },
      quiz: {
        title: "Spelling: Year 6 quiz",
        questions: build("spell", 6, [
          sg("Which word is spelled correctly?", "receive", ["recieve", "receeve", "reseive"], 2, "The sound is /ee/ after the letter c, so it is “i before e, except after c”: receive.", 1),
          sg("Which is the correct spelling of the word meaning needed?", "necessary", ["neccessary", "necesary", "necessery"], 1, "One collar (c) and two sleeves (ss): necessary.", 1),
          sg("The prefix that means “half” (as in semicircle) is:", "semi-", ["trans-", "mid-", "non-"], 0, "Semi- means half. Trans- means across, mid- means middle and non- means not.", 1),
          sh("Add the suffix -ify to “pure”. Type the new word.", "purify", [], "Drop the final e of pure and add -ify: pur + ify = purify.", 2),
          sh("Add the suffix -ed to “hurry”. Type the new word.", "hurried", [], "The word ends in a consonant followed by y, so change the y to i before -ed: hurried.", 2, true),
          sg("Which is the correct spelling of the word meaning to provide space for?", "accommodate", ["accomodate", "acommodate", "accomadate"], 3, "It is big enough to hold two c's and two m's: ac-com-mo-date.", 2, true),
          sg("Which is the correct spelling of the word for a regular beat in music or poetry?", "rhythm", ["rythm", "rhythem", "rythem"], 1, "Rhythm has two h's and no vowel besides y. Try: Rhythm Helps Your Two Hips Move.", 2),
          mu("Which TWO words are spelled correctly? These are exceptions to “i before e, except after c”.", ["weird", "wierd", "seize", "sieze"], ["weird", "seize"], "Weird and seize break the rule and have ei even though there is no c before it.", 3),
          sg("Choose the correct word: I need to ___ my spellings every day.", "practise", ["practice", "practize", "practiss"], 0, "In British English the verb (to do something over and over) is practise. The noun is practice.", 3),
          sg("Which is the correct spelling of the word meaning certainly?", "definitely", ["definately", "definitly", "defanitely"], 3, "There is “finite” in the middle: de-finite-ly. Remember that -ite does not become -ate.", 2),
        ]),
      },
      flashcards: [
        { front: "i before e rule", back: "i before e, except after c (when it sounds like “ee”): believe, receive." },
        { front: "Exceptions to i before e", back: "protein, caffeine" },
        { front: "separate trick", back: "There is a rat in sepaRATe." },
        { front: "committee", back: "two m's, two t's, two e's" },
        { front: "carry + ed / carry + ing", back: "carried (y to i); carrying (keep y)" },
        { front: "simple + ify", back: "simplify (simple loses its -le)" },
        { front: "licence or license?", back: "licence = noun; license = verb (British English)" },
        { front: "Prefix semi-", back: "half (semicircle)" },
        { front: "Prefix trans-", back: "across (transatlantic)" },
      ],
    },
  },
};
