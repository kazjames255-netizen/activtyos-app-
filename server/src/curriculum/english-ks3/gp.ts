// KS3 English — Grammar & Punctuation (Years 7–9). Original content aligned to the DfE KS3 English programme of study (OGL v3.0).
import type { CTopic } from "../types";
import { qb, cards } from "./_b";

const q7 = qb("gp", 7), q8 = qb("gp", 8), q9 = qb("gp", 9);

export const TOPIC: CTopic = {
  key: "gp",
  topic: "Grammar & Punctuation",
  subject: "English",
  years: {
    7: {
      year: 7,
      objectives: [
        "Extend and apply grammatical knowledge in writing and speech: clauses, sentence types and connectives.",
        "Use simple, compound and complex sentences accurately.",
        "Punctuate direct speech, apostrophes, commas and semicolons correctly.",
        "Understand the difference between Standard English and other varieties.",
        "Recognise active and passive sentences.",
      ],
      note: {
        title: "Year 7: clauses, sentence types and accurate punctuation",
        body: `## What you need to know

A **clause** has a subject and a verb. A **main clause** makes sense on its own; a **subordinate clause** depends on a main clause.

| Sentence type | What it contains | Example |
| --- | --- | --- |
| Simple | One main clause | The bus arrived. |
| Compound | Two main clauses joined by a **coordinating conjunction** (for, and, nor, but, or, yet, so) | The bus arrived, but we missed it. |
| Complex | A main clause + a subordinate clause (although, because, when, if, while...) | Although it was late, we waited. |

A **relative clause** starts with *who, which, that, whose*: *The boy **who lost his keys** panicked.*

## Key punctuation rules

- **Direct speech:** punctuation goes inside the speech marks: “Which way is the station?” asked Leo.
- **Apostrophes:** omission (*don't*) and possession (*the cat's bowl* = one cat; *the cats' bowls* = many).
- **Semicolon:** joins two closely related main clauses: *The bell rang; the corridor filled.*
- **Comma splice (error):** joining two main clauses with only a comma. Fix it with a full stop, a semicolon or a conjunction.

## Standard English

**Standard English** is the variety used in formal writing (*They were ready. He hadn't any money.*). Other varieties, or **dialects**, such as *They was ready*, are valid in speech and dialogue, but not in formal writing.

## Worked example

*Because the bridge was closed, we took a long detour.*  
Subordinate clause: **Because the bridge was closed**. Main clause: **we took a long detour**. Sentence type: **complex**.

## Model analysis (PEEL)

Sentence: *"Although her legs ached, Zara kept running."*

- **Point:** The writer uses a complex sentence to show determination.
- **Evidence:** "Although her legs ached, Zara kept running."
- **Explain:** The subordinate clause states the difficulty first, so the main clause "Zara kept running" arrives as a victory over it.
- **Link:** The sentence structure therefore mirrors the character's struggle.`,
      },
      quiz: {
        title: "Grammar & Punctuation: Year 7 quiz",
        questions: [
          q7.single(
            "Which sentence is a complex sentence?",
            "We went home because it was late.",
            ["We were tired, so we went home.", "The tired children went home.", "Go home!"],
            "A complex sentence has a main clause plus a subordinate clause. “because it was late” is subordinate. The second option is compound (joined by “so”).",
            1,
          ),
          q7.single(
            "Which word is a coordinating conjunction?",
            "but",
            ["although", "because", "unless"],
            "The coordinating conjunctions are for, and, nor, but, or, yet, so. “Although”, “because” and “unless” are subordinating conjunctions.",
            1,
          ),
          q7.single(
            "Which part of this sentence is the subordinate clause?\n\nAlthough it was raining, we played football.",
            "Although it was raining",
            ["we played football", "it was raining, we", "Although it was raining, we played"],
            "The clause beginning with “although” cannot stand alone as a sentence, so it is subordinate. “We played football” is the main clause.",
            2,
            { d: true },
          ),
          q7.single(
            "Which sentence punctuates direct speech correctly?",
            "“Where are you going?” asked Maya.",
            ["“Where are you going.” asked Maya.", "“Where are you going?”, asked Maya.", "“Where are you going”? asked Maya."],
            "The question mark belongs inside the speech marks and replaces the comma. After it, the reporting clause begins with a lower-case letter.",
            2,
          ),
          q7.multi(
            "Which TWO sentences are written in Standard English?",
            ["We were late for the bus.", "I didn't see anything."],
            ["We was late for the bus.", "I didn't see nothing."],
            "Standard English uses “we were” (not “we was”) and avoids the double negative “didn't... nothing”.",
            2,
          ),
          q7.single(
            "Is this sentence active or passive?\n\nThe window was broken by the ball.",
            "Passive",
            ["Active", "Imperative", "Interrogative"],
            "In a passive sentence the thing receiving the action (the window) is the subject, and the doer follows “by”. An active version: “The ball broke the window.”",
            2,
            { d: true },
          ),
          q7.short(
            "One dog owns the bone. Write the possessive form of “dogs” to complete: The ______ bone was buried in the garden.",
            "dog's",
            ["dog’s", "the dog's", "dog's bone", "the dog's bone"],
            "One owner means the apostrophe goes before the s: dog's. For several dogs it would be dogs'.",
            1,
          ),
          q7.single(
            "Which sentence contains a comma splice?",
            "I love reading, it helps me relax.",
            ["I love reading, and it helps me relax.", "I love reading; it helps me relax.", "I love reading because it helps me relax."],
            "A comma splice joins two main clauses with only a comma. Adding “and”, a semicolon or a conjunction like “because” fixes it.",
            3,
          ),
          q7.single(
            "What does the semicolon do in this sentence?\n\nThe sun set; the temperature fell.",
            "It joins two closely related main clauses",
            ["It introduces a list", "It shows that someone is speaking", "It shows that a letter is missing"],
            "Each side of the semicolon could stand alone as a sentence. The semicolon links them because the ideas are connected.",
            2,
          ),
          q7.single(
            "Which sentence contains a relative clause?",
            "The girl who won the race smiled.",
            ["The girl won the race and smiled.", "When the race ended, the girl smiled.", "Winning the race, the girl smiled."],
            "“who won the race” gives extra information about “the girl” and starts with a relative pronoun. The other options use a compound predicate, an adverbial clause and a participle phrase.",
            3,
          ),
        ],
      },
      flashcards: cards([
        ["Clause", "A group of words containing a subject and a verb."],
        ["Main clause", "A clause that makes sense on its own."],
        ["Subordinate clause", "A clause that depends on a main clause and cannot stand alone."],
        ["Coordinating conjunctions", "for, and, nor, but, or, yet, so (FANBOYS): they join equal clauses."],
        ["Complex sentence", "A main clause plus at least one subordinate clause."],
        ["Comma splice", "An error: joining two main clauses with only a comma."],
        ["Semicolon", "Joins two closely related main clauses (or separates items in a complex list)."],
        ["Standard English", "The variety of English used in formal writing and public life, with agreed grammar and spelling."],
        ["Relative pronouns", "who, whom, whose, which, that: they begin a relative clause."],
        ["Punctuating direct speech", "Speech marks around the spoken words; punctuation goes inside them."],
      ]),
    },
    8: {
      year: 8,
      objectives: [
        "Use a range of verb tenses and aspects (perfect, progressive) accurately.",
        "Understand and use modal verbs to express degrees of certainty.",
        "Use active and passive voice and explain the effect of the choice.",
        "Use colons, semicolons, dashes and brackets for clarity and effect.",
        "Vary sentence structure (short, minor, compound-complex) for effect.",
      ],
      note: {
        title: "Year 8: tense, voice, modality and punctuation for effect",
        body: `## What you need to know

**Tense** shows time (past, present); **aspect** shows whether an action is complete or ongoing.

| Form | Example | Meaning |
| --- | --- | --- |
| Present perfect | He **has arrived**. | Completed, linked to now |
| Past perfect | The bell **had rung**. | Completed before another past event |
| Past progressive | We **were walking**. | Ongoing in the past |

**Modal verbs** show certainty or possibility: *will / must* (high certainty), *should / would* (medium), *could / might / may* (low).

**Active** = the doer is the subject (*The dog chewed the shoe.*). **Passive** = the receiver is the subject (*The shoe was chewed by the dog.*). Writers choose the passive to hide or de-emphasise the doer (*Mistakes were made.*).

## Punctuation for effect

- **Colon:** introduces a list or explanation after a *complete* clause: *You need two things: courage and patience.*
- **Dashes/brackets/commas** add extra information (parenthesis).
- **Short or minor sentences** speed up the pace: *A shadow moved. Nothing. Then a whisper.*

## Worked example (effect)

*A shadow moved. Nothing.* The writer uses very short sentences to slow the pace and build tension; the full stop after "Nothing" makes the reader hold their breath.

**Watch out:** *its* (belonging to it) vs *it's* (it is / it has).

## Model analysis (PEEL)

Sentence: *"The bridge was swept away."*

- **Point:** The writer uses the passive to focus on the event.
- **Evidence:** "was swept away".
- **Explain:** The doer (the flood) is left out, so the reader attends to the loss itself and the force seems unstoppable.
- **Link:** In active form ("The flood swept the bridge away") the sentence would name the cause instead of the loss.`,
      },
      quiz: {
        title: "Grammar & Punctuation: Year 8 quiz",
        questions: [
          q8.single(
            "What tense is the verb phrase “had started” in this sentence?\n\nBy the time we arrived, the film had started.",
            "Past perfect",
            ["Simple past", "Present perfect", "Past progressive"],
            "“had started” (had + past participle) shows an action completed before another past event (“we arrived”).",
            1,
          ),
          q8.single(
            "Which modal verb shows the greatest certainty?",
            "will",
            ["might", "could", "may"],
            "“Will” presents something as almost certain. “Might”, “could” and “may” all express possibility.",
            1,
          ),
          q8.single(
            "Which is the correct passive form of this sentence?\n\nThe chef cooked the meal.",
            "The meal was cooked by the chef.",
            ["The meal is being cooked by the chef.", "The chef was cooking the meal.", "The meal cooked the chef."],
            "Swap subject and object, use “was” to keep the past tense and add “by” before the doer.",
            2,
            { d: true },
          ),
          q8.single(
            "Why might a writer choose the passive in this sentence?\n\nThe valuables were stolen during the night.",
            "To focus on what happened when the doer is unknown or unimportant",
            ["To make clear exactly who committed the crime in the sentence", "To make the sentence more informal and chatty in tone", "To replace the verb with a stronger, more dramatic one"],
            "The passive can leave out the doer altogether (“by whom” is missing), putting the focus on the event.",
            2,
          ),
          q8.single(
            "Which sentence uses a colon correctly?",
            "You will need three things: a pencil, a ruler and a rubber.",
            ["I like tennis: because it is so fast and exciting.", "She said: that she was leaving early that evening.", "We visited: Paris, Rome and Madrid on our holiday."],
            "A colon must follow a complete main clause. Here “You will need three things” is complete and the colon introduces the list.",
            2,
            { d: true },
          ),
          q8.multi(
            "Which TWO sentences use the present perfect?",
            ["She has finished her homework.", "I have lived here since 2019."],
            ["She finished her homework yesterday.", "They were playing chess."],
            "The present perfect is formed with “has/have” + past participle. The others are simple past and past progressive.",
            2,
          ),
          q8.single(
            "Which sentence uses its / it's correctly?",
            "The dog wagged its tail because it's happy.",
            ["The dog wagged it's tail because its happy.", "The dog wagged its tail because its happy.", "The dog wagged it's tail because it's happy."],
            "“its” shows possession (the tail belongs to the dog); “it's” is short for “it is”, so “it's happy” means “it is happy”.",
            1,
          ),
          q8.single(
            "What is the effect of the short sentences?\n\nThe door creaked. Silence. Then footsteps.",
            "They slow the pace and build tension",
            ["They show that the writer is a beginner", "They give the reader a lot of factual detail", "They make the passage sound calm and relaxed"],
            "Very short sentences and a one-word minor sentence create pauses that build suspense.",
            2,
          ),
          q8.single(
            "What type of sentence is this?\n\nAlthough the storm was fierce, the crew kept sailing, and they reached harbour at dawn.",
            "Compound-complex",
            ["Simple", "Compound", "Complex"],
            "It has a subordinate clause (“Although the storm was fierce”) and two main clauses joined by “and”. That makes it compound-complex.",
            3,
          ),
          q8.single(
            "Which sentence uses the subjunctive form correctly in formal English?",
            "If I were you, I would apologise.",
            ["If I was you, I would apologise.", "If I am you, I would apologise.", "If I be you, I would apologise."],
            "The subjunctive “were” expresses something imagined or unreal, even with “I”. “If I was you” is common in speech but not formal Standard English.",
            3,
          ),
        ],
      },
      flashcards: cards([
        ["Present perfect", "have/has + past participle: links a completed action to now (She has finished)."],
        ["Past perfect", "had + past participle: an action completed before another past event."],
        ["Progressive aspect", "be + -ing: an action in progress (They were playing)."],
        ["Modal verbs", "will, would, can, could, may, might, shall, should, must: show possibility or certainty."],
        ["Active voice", "The doer is the subject: The chef cooked the meal."],
        ["Passive voice", "The receiver is the subject: The meal was cooked (by the chef)."],
        ["Colon", "Follows a complete clause to introduce a list, explanation or quotation."],
        ["its vs it's", "its = belonging to it; it's = it is / it has."],
        ["Minor sentence", "A sentence without a main verb (Silence.), used for effect."],
        ["Compound-complex sentence", "At least two main clauses plus at least one subordinate clause."],
      ]),
    },
    9: {
      year: 9,
      objectives: [
        "Control sentence structure, including participle phrases, subordination and parallelism.",
        "Use punctuation (semicolons, ellipses, dashes) precisely and for deliberate effect.",
        "Use formal and informal register appropriately.",
        "Understand Standard English, dialect and accent.",
        "Recognise and correct common errors: dangling modifiers, faulty parallelism, agreement.",
        "Understand nominalisation and how it shapes formal writing.",
      ],
      note: {
        title: "Year 9: sentence control, register and Standard English",
        body: `## What you need to know

By Year 9 you choose grammar deliberately for **effect** and **register**.

| Term | Meaning | Example |
| --- | --- | --- |
| Register | Level of formality | *Pupils are requested to remain seated* (formal) vs *Sit down, you lot* (informal) |
| Dialect | Variety with its own grammar and vocabulary, linked to a region or group | *I ain't seen them lads.* |
| Accent | The way words are pronounced | (not a grammar difference) |
| Nominalisation | Turning a verb into a noun to sound formal | *decide* → *the decision of the committee* |
| Dangling modifier | An opening phrase that does not match the subject | *Opening the door, the room felt cold.* (the room did not open the door) |
| Parallelism | Same grammatical pattern in a list | *reading, writing and drawing* |

A **dialect** is not "wrong": Standard English is simply the variety agreed for formal writing.

## Punctuation for effect

- **Semicolons** can also separate items in a complex list: *We met Ana, the captain; Ben, the goalkeeper; and Cat, the coach.*
- **Ellipsis** (...) shows hesitation or trailing thoughts.
- **Dashes** add an aside or a sudden twist.

## Worked example (effect)

*Her hands trembling, she opened the envelope.* The absolute phrase "her hands trembling" adds vivid detail about *how* she opened it without needing another verb, packing feeling and action into one sentence.

**Method:** name the feature, quote it, explain the effect.

## Model analysis (PEEL)

Sentence: *"The proposal might perhaps succeed."*

- **Point:** The writer uses hedging to sound cautious.
- **Evidence:** "might perhaps".
- **Explain:** The modal verb "might" and the adverb "perhaps" both reduce certainty, so the claim seems tentative.
- **Link:** This suits a formal, balanced argument that avoids overstating its case.`,
      },
      quiz: {
        title: "Grammar & Punctuation: Year 9 quiz",
        questions: [
          q9.single(
            "Which sentence is written in Standard English?",
            "I saw those books on the shelf.",
            ["I seen them books on the shelf.", "I sees them books on the shelf.", "Me and him seen those books on the shelf."],
            "Standard English uses “saw” (past tense of “see”) and “those books”. The other versions use dialect or non-standard forms.",
            1,
          ),
          q9.single(
            "What is a dialect?",
            "A variety of a language with its own grammar and vocabulary, linked to a region or group",
            ["The particular way in which a person pronounces the words", "A serious mistake made by a careless or uneducated speaker", "A very formal style of language used in business letters"],
            "A dialect differs in grammar and vocabulary. How words sound is an accent. A dialect is not an error.",
            1,
          ),
          q9.multi(
            "Which TWO sentences have correct subject-verb agreement?",
            ["The bag of apples is on the table.", "The children are playing outside."],
            ["The bag of apples are on the table.", "The children is playing outside."],
            "The subject of the first sentence is “bag” (singular), so “is”. “Children” is plural, so “are”.",
            1,
          ),
          q9.single(
            "Which sentence contains a dangling modifier?",
            "Walking down the road, the rain began to fall.",
            ["Walking down the road, I felt the rain begin to fall.", "As I walked down the road, the rain began to fall.", "The rain began to fall while I walked down the road."],
            "The opening phrase should describe the subject of the main clause. Here it seems the rain was walking.",
            2,
            { d: true },
          ),
          q9.single(
            "Which sentence uses semicolons correctly to separate items in a complex list?",
            "We visited Paris, France; Rome, Italy; and Madrid, Spain.",
            ["We visited Paris; France, Rome; Italy, and Madrid; Spain.", "We visited; Paris, France, Rome, Italy, and Madrid, Spain.", "We visited Paris, France, Rome; Italy, Madrid, Spain."],
            "The semicolons separate whole items (city + country), while commas work inside each item.",
            2,
            { d: true },
          ),
          q9.single(
            "What is the effect of the ellipsis?\n\nI thought I knew him... but perhaps I never did.",
            "It shows hesitation and doubt as the thought trails off",
            ["It shows that some words have been left out of a quotation", "It shows that the speaker is angry", "It shows that the sentence is a question"],
            "An ellipsis creates a pause. Here it mimics a person reconsidering something they were sure about.",
            2,
          ),
          q9.single(
            "Which sentence is the best formal rewrite of this informal sentence?\n\nWe've gotta tell the head that loads of kids are fed up with the new rules.",
            "We must inform the headteacher that many pupils are dissatisfied with the new rules.",
            ["We gotta tell the headteacher that lots of pupils are fed up with the new rules.", "We must tell the head that loads of kids are fed up with the rules.", "We've got to say to the headteacher that many pupils don't like the new rules."],
            "A formal register avoids contractions, slang (“gotta”, “loads”, “fed up”) and uses precise vocabulary.",
            2,
          ),
          q9.single(
            "Which word in this sentence is a nominalisation?\n\nThe destruction of the forest angered residents.",
            "destruction",
            ["forest", "angered", "residents"],
            "“Destruction” is a noun made from the verb “destroy”. Nominalisation packs an action into a noun.",
            2,
          ),
          q9.single(
            "Which sentence contains faulty parallelism?",
            "She likes swimming, to cycle and running.",
            ["She likes swimming, cycling and running.", "She likes to swim, to cycle and to run.", "She likes swimming and running."],
            "Items in a list should share the same form. “swimming, to cycle and running” mixes -ing and to-infinitive forms.",
            3,
          ),
          q9.single(
            "What is the function of the phrase “Its engine roaring” in this sentence?\n\nIts engine roaring, the car sped away.",
            "It adds descriptive detail about how the car sped away",
            ["It is the main clause of the sentence", "It gives the reason why the car sped away", "It asks a question about the car"],
            "“Its engine roaring” is an absolute phrase: it has no finite verb and gives extra detail about the main action.",
            3,
          ),
        ],
      },
      flashcards: cards([
        ["Register", "The level of formality of language, chosen to suit audience and purpose."],
        ["Dialect", "A variety of a language with its own grammar and vocabulary, linked to a region or group."],
        ["Accent", "The way words are pronounced; not a difference of grammar."],
        ["Nominalisation", "Turning a verb or adjective into a noun (destroy → destruction) for a formal tone."],
        ["Dangling modifier", "An opening phrase whose implied subject does not match the main clause's subject."],
        ["Parallelism", "Using the same grammatical pattern for items in a list or balanced clauses."],
        ["Ellipsis", "Three dots (...) showing a pause, hesitation or an unfinished thought."],
        ["Semicolons in lists", "Separate long list items that already contain commas."],
        ["Absolute phrase", "A phrase with no finite verb that adds detail (Its engine roaring, the car sped away)."],
        ["Subject-verb agreement", "The verb must match the true subject: The bag of apples IS on the table."],
      ]),
    },
  },
};
