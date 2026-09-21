// KS2 English — Grammar & Punctuation (Years 3–6). Original content aligned to the DfE National Curriculum, English Appendix 2 (OGL v3.0).
// Every item has exactly one defensible answer; _check_e2.ts checks the mechanically checkable claims (fronted adverbials, quotes, brackets, etc.).
import type { CTopic } from "../types";
import { build, mu, sg, sh } from "./_h";

export const TOPIC: CTopic = {
  key: "gp",
  topic: "Grammar & Punctuation",
  subject: "English",
  years: {
    3: {
      year: 3,
      objectives: [
        "Express time, place and cause using conjunctions (when, before, after, while, so, because, although), adverbs and prepositions.",
        "Use the present perfect form of verbs in contrast to the simple past.",
        "Use a or an correctly according to whether the next word starts with a consonant or vowel sound.",
        "Introduce and punctuate direct speech with inverted commas.",
      ],
      note: {
        title: "Year 3: conjunctions, prepositions, speech and the present perfect",
        body: `## What you need to know

- **Conjunctions** join ideas: **because, when, before, after, while, so, although, but, and, or.**
- **Prepositions** show where or when something is: **under** the bridge, **after** dinner, **before** breakfast.
- **Present perfect** = has/have + past participle: “I **have eaten** my lunch.” It links the past to now. The simple past is finished and firmly in the past: “I ate my lunch **yesterday**.”
- **a or an:** use **an** before a vowel sound: **an** apple, **a** pear.

## Worked example 1: inverted commas

Put the exact words spoken inside inverted commas, and put the punctuation inside them too.

“Let's go,” said Gran.

“Is it ready?” asked Sam.

## Worked example 2: choosing a conjunction

It was cold, **so** I put on a coat. (result)
I put on a coat **because** it was cold. (reason)

## Worked example 3: present perfect

She **has walked** to school (up to now). He **have walked** is not Standard English.

| Job | Example |
| --- | --- |
| Time conjunction | before, after, when, while |
| Cause conjunction | because, so |
| Preposition of place | under, on, beside |`,
      },
      quiz: {
        title: "Grammar & Punctuation: Year 3 quiz",
        questions: build("gp", 3, [
          sg("Which word is the conjunction in this sentence? We stayed inside because it was raining.", "because", ["stayed", "inside", "raining"], 0, "A conjunction joins two parts of a sentence. “Because” links staying inside to the reason for it.", 1),
          sg("Which word is the preposition in this sentence? The cat hid under the table.", "under", ["cat", "hid", "table"], 2, "A preposition shows the position of one thing in relation to another. “Under” tells us where the cat hid.", 1),
          sg("Choose the correct word to finish the sentence: We saw ___ owl in the tree.", "an", ["a", "and", "in"], 3, "Owl begins with a vowel sound, so we use “an”.", 1),
          mu("Which TWO of these words are conjunctions?", ["although", "happy", "because", "under"], ["although", "because"], "Although and because can join two clauses. Happy is an adjective and under is a preposition.", 2),
          sg("Which sentence is punctuated correctly?", "“Come here,” said Mum.", ["“Come here, said Mum.”", "“Come here” said Mum.", "“Come here said Mum.”"], 1, "The spoken words go inside the inverted commas, and the comma goes inside too, before the closing marks.", 2, true),
          sg("Which sentence is in the present perfect tense?", "I have finished my homework.", ["I finished my homework yesterday.", "I am finishing my homework.", "I will finish my homework."], 0, "The present perfect uses have or has plus a past participle (finished). It links the past to now.", 2, true),
          sg("Which sentence contains a preposition that tells you WHEN?", "We eat lunch after school.", ["The dog ran quickly.", "She was very happy.", "He is tall."], 2, "“After” shows when we eat lunch, and school is the noun that follows it.", 2),
          sg("In the sentence “I was tired, so I went to bed early”, what does the word “so” show?", "The result of being tired", ["The time it happened", "The place it happened", "A contrast between two ideas"], 3, "So links a cause (being tired) to its result (going to bed).", 2),
          sg("Which sentence with a spoken question is punctuated correctly?", "“Where are you going?” asked Dad.", ["“Where are you going”? asked Dad.", "“Where are you going.” asked Dad.", "“Where are you going?”, asked Dad."], 1, "The question mark belongs inside the inverted commas, and “asked” has a small letter because the sentence carries on.", 3),
          sg("Which sentence uses a conjunction to show TIME?", "I brush my teeth before I go to bed.", ["I was tired because I stayed up late.", "I like tea but Dan likes juice.", "It was sunny, so we went out."], 0, "“Before” tells us the order in which two things happen. Because gives a reason, but shows contrast and so shows a result.", 3),
        ]),
      },
      flashcards: [
        { front: "Conjunction", back: "A word that joins ideas, such as because, when, before, after, while, so, although." },
        { front: "Preposition", back: "A word that shows position or time in relation to a noun: under, on, after, before." },
        { front: "Adverb", back: "A word that tells you more about a verb, such as how, when or where: quickly, soon, here." },
        { front: "Present perfect: how is it made?", back: "has / have + past participle: “I have eaten.”" },
        { front: "a or an?", back: "an before a vowel sound (an apple); a before a consonant sound (a pear)." },
        { front: "Where does the comma go in speech?", back: "Inside the inverted commas: “Let's go,” said Gran." },
        { front: "Where does a question mark go in speech?", back: "Inside the inverted commas: “Is it ready?” asked Sam." },
        { front: "Which conjunction shows a reason?", back: "because" },
        { front: "Which conjunction shows a result?", back: "so" },
      ],
    },
    4: {
      year: 4,
      objectives: [
        "Use fronted adverbials and punctuate them with a comma.",
        "Expand noun phrases with modifying adjectives, nouns and prepositional phrases.",
        "Use apostrophes to mark singular and plural possession.",
        "Punctuate direct speech correctly, including a comma after a reporting clause.",
        "Use Standard English verb forms and appropriate pronouns for cohesion.",
      ],
      note: {
        title: "Year 4: fronted adverbials, noun phrases, apostrophes and speech",
        body: `## What you need to know

- **Fronted adverbial:** a word or phrase at the **start** of a sentence that tells us when, where or how. It is followed by a **comma**: **Early in the morning,** we went swimming.
- **Expanded noun phrase:** a noun plus extra description: **the shiny red bicycle with the wobbly wheel**.
- **Apostrophes for possession:** singular owner: **the girl's** book. Plural owner ending in s: **the boys'** bags. Plural not ending in s: **the women's** team.
- **Speech:** Ana said, “It's late.” Use a comma after “said”, a capital for the first spoken word, and put the full stop inside the inverted commas.

## Worked example 1

“In the distance, a wolf howled.” The fronted adverbial is “In the distance”.

## Worked example 2: whose apostrophe?

Three boys own bags: “the **boys'** bags” (apostrophe after the s). One boy: “the **boy's** bag”.

## Worked example 3: Standard English

“They **did** the washing-up.” not “They done the washing-up.”

| Type | Example |
| --- | --- |
| time | Before bedtime, ... |
| place | Behind the shed, ... |
| manner | With great care, ... |`,
      },
      quiz: {
        title: "Grammar & Punctuation: Year 4 quiz",
        questions: build("gp", 4, [
          sg("Which sentence begins with a fronted adverbial?", "Later that day, we went swimming.", ["We went swimming later that day.", "Swimming was fun.", "We went swimming."], 0, "A fronted adverbial comes at the start of the sentence and tells us when, where or how. “Later that day” tells us when.", 1),
          sg("Which punctuation mark should follow a fronted adverbial?", "a comma", ["a full stop", "a colon", "an apostrophe"], 2, "We put a comma after a fronted adverbial to show where it ends and the main sentence begins.", 1),
          sh("After which word should the comma go? After lunch we played football.", "lunch", ["Lunch", "lunch,", "after lunch", "after lunch,", "After lunch,"], "“After lunch” is the fronted adverbial, so the comma follows lunch: After lunch, we played football.", 2),
          sg("Which is an expanded noun phrase?", "the tall, dusty bookcase", ["ran quickly", "because it was late", "very slowly"], 0, "A noun phrase centres on a noun (bookcase) plus describing words. The others do not have a noun at the heart.", 2),
          sg("Three girls hang up their coats. Which is written correctly?", "the girls' coats", ["the girl's coats", "the girls coat's", "the girls coats'"], 2, "The owners are plural (girls) and end in s, so the apostrophe goes after the s.", 2, true),
          sg("Which phrase is written correctly?", "the children's playground", ["the childrens' playground", "the childrens playground", "the childrens's playground"], 1, "Children is a plural that does not end in s, so we add ’s just as with a singular owner.", 3),
          sg("Which sentence is punctuated correctly?", "Leo said, “I'm hungry.”", ["Leo said “I'm hungry.”", "Leo said, I'm hungry.", "Leo said, “I'm hungry”."], 1, "Put a comma after the reporting clause, begin the spoken words with a capital, and put the full stop inside the inverted commas.", 2, true),
          sg("Which sentence uses an apostrophe correctly?", "The dog's bowl is empty.", ["The dogs bowl is empty.", "Its a sunny day.", "We have two dog's."], 3, "The bowl belongs to one dog, so we add ’s. “Its a sunny day” needs It's, and a plural does not need an apostrophe.", 2),
          sg("Which sentence has its fronted adverbial punctuated correctly?", "Before the sun came up, we packed the car.", ["Before the sun came up we packed the car.", "Before, the sun came up we packed the car.", "Before the sun came up we, packed the car."], 0, "The whole opening phrase “Before the sun came up” is the fronted adverbial, so the comma comes straight after it.", 3),
          sg("Which sentence uses Standard English?", "We did our homework.", ["We done our homework.", "Us did our homework.", "We doed our homework."], 1, "The past tense of do is did. “Done” needs a helper word, as in “we have done”.", 1),
        ]),
      },
      flashcards: [
        { front: "Fronted adverbial", back: "A word or phrase at the start of a sentence telling when, where or how, followed by a comma." },
        { front: "Example of a fronted adverbial", back: "“Behind the shed, a cat slept.”" },
        { front: "Expanded noun phrase", back: "A noun with extra description, such as “the shiny red bicycle with the wobbly wheel”." },
        { front: "the girl's book / the girls' books", back: "one owner: ’s; plural owners ending in s: s’" },
        { front: "the men's coats", back: "Plural not ending in s: add ’s" },
        { front: "Comma before or after speech?", back: "Ana said, “It's late.” (comma after the reporting clause)" },
        { front: "Where does the full stop go in speech?", back: "Inside the closing inverted commas." },
        { front: "Standard English: did or done?", back: "They did the washing-up. They have done the washing-up." },
        { front: "Apostrophe of contraction", back: "Shows missing letters: don't = do not." },
      ],
    },
    5: {
      year: 5,
      objectives: [
        "Use relative clauses beginning with who, which, where, when, whose or that.",
        "Indicate degrees of possibility using modal verbs (might, should, will, must) and adverbs (perhaps, surely).",
        "Use brackets, dashes or commas to indicate parenthesis and commas to clarify meaning.",
        "Link ideas across sentences and paragraphs using adverbials and pronouns.",
        "Convert nouns or adjectives into verbs using suffixes such as -ate, -ise, -ify.",
      ],
      note: {
        title: "Year 5: relative clauses, modal verbs, parenthesis and cohesion",
        body: `## What you need to know

- **Relative clause:** adds information about a noun and starts with **who, which, that, whose, where** or **when**: “The teacher **who wore the red scarf** smiled.”
- **Modal verbs** show how likely or necessary something is: **will** (certain), **should**, **could**, **may**, **might** (less sure), **must** (necessary).
- **Parenthesis** is extra information added to a sentence. Mark it with **brackets ( )**, **dashes – –** or **commas , ,**. The sentence must still make sense without it.
- **Cohesion:** link ideas with adverbials (**Finally, However, Meanwhile**) and pronouns (**he, she, they**).

## Worked example 1: parenthesis

My cousin, who lives in Wales, is visiting. Take out the bit between the commas and the sentence still works.

## Worked example 2: commas that change meaning

“Let's cook, Dad.” invites him to help. “Let's cook Dad.” does not!

## Worked example 3: suffixes that make verbs

pure → **purify**, active → **activate**, length → **lengthen**.

| Modal | Certainty |
| --- | --- |
| will | very likely |
| should | likely |
| might, may, could | possible |`,
      },
      quiz: {
        title: "Grammar & Punctuation: Year 5 quiz",
        questions: build("gp", 5, [
          sg("Which word introduces the relative clause? The boy who won the race smiled.", "who", ["boy", "race", "smiled"], 0, "The relative clause is “who won the race”. It starts with the relative pronoun who and tells us more about the boy.", 1),
          sg("Choose the correct word: The girl ___ bike was stolen called the police.", "whose", ["who's", "which", "where"], 2, "Whose shows that the bike belongs to the girl. Who's would mean who is.", 2, true),
          sg("Which sentence contains a relative clause?", "The book that I borrowed was long.", ["I borrowed a long book.", "Borrow the book quickly.", "The book was long and heavy."], 0, "“That I borrowed” adds information about the book and begins with the relative pronoun that.", 1),
          sg("Which word is the modal verb? You must wear a helmet.", "must", ["You", "wear", "helmet"], 1, "Must is a modal verb. It shows that something is necessary and is followed by a main verb.", 1),
          sg("Which sentence shows the greatest certainty?", "It will rain tomorrow.", ["It might rain tomorrow.", "It could rain tomorrow.", "It may rain tomorrow."], 0, "Will says it is going to happen. Might, could and may only say it is possible.", 2),
          sg("Which sentence uses brackets correctly to add extra information?", "My brother (who is ten) loves football.", ["My brother (who is ten loves) football.", "My (brother who) is ten loves football.", "My brother who is ten) loves football (."], 2, "Only the extra information goes inside the brackets, and the sentence still works without it: My brother loves football.", 2, true),
          mu("Which TWO sentences use punctuation correctly for parenthesis?", ["The museum, which opened in 1990, is free.", "The museum which opened, in 1990 is free.", "Her sister (a talented artist) painted the mural.", "Her sister (a talented artist painted) the mural."], ["The museum, which opened in 1990, is free.", "Her sister (a talented artist) painted the mural."], "In the correct sentences the extra information is wrapped fully in commas or brackets. The others cut into the main sentence.", 3),
          sg("Choose the best word to link the sentences: We built the raft. ___, we pushed it into the water.", "Finally", ["However", "For example", "Instead"], 3, "Finally shows the last step in a sequence. However shows contrast and For example introduces an illustration.", 2),
          sg("Which sentence invites Grandma to come and eat?", "Let's eat, Grandma.", ["Let's eat Grandma.", "Let's, eat Grandma.", "Lets eat Grandma."], 1, "The comma shows that Grandma is being spoken to. Without it, the sentence says to eat her.", 2),
          sg("Which word is a verb made from the adjective “simple”?", "simplify", ["simply", "simpler", "simplicity"], 2, "Adding the suffix -ify to simple makes a verb: to simplify. Simply is an adverb, simpler is an adjective and simplicity is a noun.", 3),
        ]),
      },
      flashcards: [
        { front: "Relative pronouns", back: "who, which, that, whose (and where, when as relative adverbs)" },
        { front: "Relative clause", back: "Extra information about a noun, beginning with a relative word." },
        { front: "Modal verbs", back: "will, would, can, could, may, might, shall, should, must" },
        { front: "Most certain modal verb", back: "will" },
        { front: "Parenthesis", back: "Extra information in brackets, dashes or commas: the sentence still works without it." },
        { front: "Cohesion", back: "Linking ideas across sentences and paragraphs with pronouns and adverbials." },
        { front: "whose or who's?", back: "whose = belongs to; who's = who is" },
        { front: "Making verbs with suffixes", back: "-ate (activate), -ise (modernise), -ify (beautify), -en (lengthen)" },
        { front: "Comma that changes meaning", back: "Let's cook, Dad. vs Let's cook Dad." },
      ],
    },
    6: {
      year: 6,
      objectives: [
        "Recognise vocabulary and structures for formal speech and writing, including the subjunctive.",
        "Use the passive to affect the presentation of information in a sentence.",
        "Use semi-colons, colons and dashes to mark boundaries between independent clauses, and a colon to introduce a list.",
        "Use hyphens to avoid ambiguity.",
        "Use layout devices such as bullet points, and know the difference between informal and formal structures.",
      ],
      note: {
        title: "Year 6: passive voice, punctuation for clauses and formal writing",
        body: `## What you need to know

- **Active or passive?** Active: **The dog chewed the slipper.** Passive: **The slipper was chewed by the dog.** The passive puts the receiver first and can leave out who did it: “The road was closed.”
- **Subjunctive** (formal): “If I **were** taller, I would play basketball.” “The manager insists that the report **be** finished today.”
- **Semi-colon (;)** joins two related main clauses: The sun set; the sky turned red.
- **Colon (:)** introduces a list after a complete clause: We bought three things: bread, milk and eggs.
- **Hyphens** avoid ambiguity: to **re-cover** a sofa is not the same as to recover from an illness.
- **Bullet points** make lists easy to scan. Keep the items in the same grammatical form.

## Worked example 1: formal or informal?

Informal: “Get back to us fast.” Formal: “I would appreciate a prompt reply.”

## Worked example 2: question tags (informal)

“You've finished, haven't you?” The tag “haven't you?” is common in speech.

## Worked example 3: dashes

A single dash can join two clauses more casually: The gate was shut – nobody could get past.

| Mark | Job |
| --- | --- |
| ; | joins related main clauses |
| : | introduces a list or explanation |
| - | hyphen: joins words to avoid ambiguity |`,
      },
      quiz: {
        title: "Grammar & Punctuation: Year 6 quiz",
        questions: build("gp", 6, [
          sg("Which sentence is in the passive voice?", "The window was broken by the ball.", ["The ball broke the window.", "Sam kicked the ball.", "The ball hit Sam."], 0, "In the passive, the thing that receives the action (the window) is the subject. The verb uses was plus a past participle.", 1),
          sg("Which sentence is the passive version of “The chef cooked the meal.”?", "The meal was cooked by the chef.", ["The meal cooked the chef.", "The chef was cooked by the meal.", "The meal is cooked by the chef."], 0, "The receiver (the meal) moves to the front. The verb stays in the past tense: was cooked.", 2),
          sg("Which sentence uses the subjunctive form?", "If I were you, I would apologise.", ["If I was you, I would apologise.", "If I am you, I will apologise.", "If I be you, I would apologise."], 1, "The subjunctive uses “were” for imagined situations, even after I or he. It is common in formal writing.", 2, true),
          sg("Choose the subjunctive form to show a demand: The head teacher insisted that every pupil ___ on time.", "be", ["is", "are", "was"], 2, "After a verb such as insist, the formal subjunctive uses the base form: be.", 3),
          sg("Which sentence uses a semi-colon correctly?", "I love reading; my brother prefers football.", ["I love reading; and my brother prefers football.", "Although I love reading; my brother prefers football.", "I love; reading my brother prefers football."], 3, "A semi-colon joins two closely related main clauses. Each side could stand alone as a sentence.", 2),
          sg("Which sentence uses a colon correctly?", "You will need three things: a torch, a map and a compass.", ["You will need three things a torch: a map and a compass.", "You will: need three things, a torch, a map and a compass.", "You will need three things, a torch, a map and: a compass."], 1, "A colon goes after a complete clause and introduces the list that follows.", 1),
          sg("Which phrase clearly means “a shark that eats people”?", "man-eating shark", ["man eating shark", "man eating-shark", "man-eating-shark"], 0, "The hyphen joins man and eating, so they work together as one describing word for the shark.", 3),
          sg("Which sentence would be most suitable for a letter to a museum director?", "I would be grateful if you could send me some information about your exhibitions.", ["Send me your exhibition stuff!", "Hey, got any info on your shows?", "Gimme the details on the exhibits, thanks."], 2, "A formal letter uses polite, complete sentences and careful vocabulary, not slang or commands.", 2, true),
          sg("Why does a writer use bullet points?", "To make a list clear and easy to read", ["To show that someone is speaking", "To join two sentences", "To show a long pause"], 3, "Bullet points break information into short separate items so a reader can scan them quickly.", 1),
          sg("Why might a writer choose the passive voice in “The window was smashed.”?", "It leaves out who did the action.", ["It makes the sentence about the future.", "It shows the writer is angry.", "It turns the sentence into a question."], 1, "With a passive verb you can drop the doer completely. This is useful when the doer is unknown or unimportant.", 3),
        ]),
      },
      flashcards: [
        { front: "Active vs passive", back: "Active: The dog chewed the slipper. Passive: The slipper was chewed by the dog." },
        { front: "Why use the passive?", back: "To focus on what happened and to leave out who did it." },
        { front: "Subjunctive: “If I ___ taller”", back: "were (If I were taller, I would play basketball)." },
        { front: "Semi-colon", back: "Joins two related main clauses that could each stand alone." },
        { front: "Colon", back: "Introduces a list or an explanation after a complete clause." },
        { front: "Dash", back: "Marks a break: The gate was shut – nobody could get past." },
        { front: "Hyphen", back: "Joins words to avoid ambiguity: re-cover the sofa (cover again) vs recover from illness." },
        { front: "Formal vs informal", back: "Formal: complete sentences, polite words. Informal: slang, contractions, question tags." },
        { front: "Bullet points", back: "Use for lists; keep each item the same grammatical form." },
      ],
    },
  },
};
