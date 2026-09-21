// KS1 English — Grammar & Punctuation (Years 1–2). Original content aligned to the DfE National Curriculum (OGL v3.0).
import type { CTopic } from "../types";

export const TOPIC: CTopic = {
  key: "gp",
  topic: "Grammar & Punctuation",
  subject: "English",
  years: {
    1: {
      year: 1,
      objectives: [
        "Leave spaces between words.",
        "Begin to punctuate sentences using a capital letter and a full stop, question mark or exclamation mark.",
        "Use a capital letter for names of people, places, the days of the week, and the personal pronoun 'I'.",
        "Join words and join clauses using 'and'.",
        "Understand the terms: letter, capital letter, word, singular, plural, sentence, punctuation, full stop, question mark, exclamation mark.",
      ],
      note: {
        title: "Year 1: sentences and punctuation",
        body: `## What is a sentence?
A **sentence** makes sense. It starts with a **capital letter** and ends with a **full stop (.)**, a **question mark (?)** or an **exclamation mark (!)**.

| Mark | Name | We use it for | Example |
| --- | --- | --- | --- |
| . | full stop | a telling sentence | I like jam. |
| ? | question mark | asking | Where is my ball? |
| ! | exclamation mark | a shout or surprise | Look out! |

## Capital letters
We use a capital letter for:
- the **first word** of a sentence
- **names**: Ben, Amy, London
- the word **I**
- the **days**: Monday

## Joining with 'and'
"I have a pen. I have a ruler." becomes "I have a pen **and** a ruler."

## Singular and plural
**Singular** means one (cat). **Plural** means more than one (cats).

## Worked example
"my friend ben and i went to the park"
Fix it: **My friend Ben and I went to the park.** (capitals for My, Ben, I and a full stop at the end)

**Say it like this:** "Capital at the start, mark at the end!"`,
      },
      quiz: {
        title: "Grammar & Punctuation: Year 1 quiz",
        questions: [
          { key: "gp-y1-01", kind: "single", prompt: "Which mark goes at the end of a telling sentence?\nI like cake___", options: ["question mark ?", "full stop .", "comma ,"], answer: "full stop .", explanation: "A telling sentence ends with a full stop.", difficulty: 1 },
          { key: "gp-y1-02", kind: "single", prompt: "Which word needs a capital letter?\nthe dog ran.", options: ["dog", "ran", "the", "all of them"], answer: "the", explanation: "A sentence starts with a capital letter, so 'the' becomes 'The'. 'Dog' and 'ran' stay small.", difficulty: 2 },
          { key: "gp-y1-03", kind: "single", prompt: "What goes at the end?\nWhere is my hat___", options: [".", ",", "!", "?"], answer: "?", explanation: "It is asking something, so it ends with a question mark.", difficulty: 2 },
          { key: "gp-y1-04", kind: "single", prompt: "Which words need capital letters?\nmy name is amy.", options: ["Amy only", "name and is", "My only", "My and Amy"], answer: "My and Amy", explanation: "The first word of a sentence needs a capital letter, and so does a name: My name is Amy.", difficulty: 2 },
          { key: "gp-y1-05", kind: "single", prompt: "Which word needs a capital letter?\nWe met ben at the park.", options: ["met", "at", "ben", "park"], answer: "ben", explanation: "Ben is a name, and names start with a capital letter: Ben.", difficulty: 2, diagnostic: true },
          { key: "gp-y1-06", kind: "single", prompt: "Join the sentences with 'and':\nI have a cat. I have a dog.", options: ["I have a cat and a dog.", "I have a cat, dog.", "I have a cat and.", "I and have a cat dog."], answer: "I have a cat and a dog.", explanation: "'And' joins the two things: a cat and a dog.", difficulty: 2, diagnostic: true },
          { key: "gp-y1-07", kind: "single", prompt: "Which word means MORE than one? (plural)", options: ["bags", "hat", "cup", "pen"], answer: "bags", explanation: "The -s on the end tells us there is more than one bag.", difficulty: 1 },
          { key: "gp-y1-08", kind: "single", prompt: "What is this mark called?\n!", options: ["full stop", "question mark", "capital letter", "exclamation mark"], answer: "exclamation mark", explanation: "! is an exclamation mark. We use it for a shout or a surprise.", difficulty: 1 },
          { key: "gp-y1-09", kind: "single", prompt: "Which sentence has ALL the right punctuation?", options: ["can we go to the park.", "Can we go to the park", "Can we go to the park?", "Can we go to the park!"], answer: "Can we go to the park?", explanation: "It needs a capital C at the start and a question mark at the end because it asks something.", difficulty: 3 },
          { key: "gp-y1-10", kind: "single", prompt: "Which sentence has a mistake?", options: ["I like to run.", "We saw a big dog?", "Is it time to go?", "She has a red hat."], answer: "We saw a big dog?", explanation: "'We saw a big dog' is a telling sentence, so it needs a full stop, not a question mark.", difficulty: 3 },
        ],
      },
      flashcards: [
        { front: "A sentence", back: "Makes sense. Starts with a capital letter and ends with . ? or !" },
        { front: "Full stop .", back: "Ends a telling sentence: I like cake." },
        { front: "Question mark ?", back: "Ends a question: Where is my hat?" },
        { front: "Exclamation mark !", back: "Shows a shout or surprise: Look out!" },
        { front: "Capital letter", back: "Start of a sentence, names, days, and the word I" },
        { front: "Names", back: "Always a capital letter: Ben, Amy, London" },
        { front: "and", back: "Joins words and ideas: a cat and a dog" },
        { front: "Singular", back: "Just one: cat" },
        { front: "Plural", back: "More than one: cats" },
        { front: "Word spaces", back: "Leave a finger space between words." },
      ],
    },
    2: {
      year: 2,
      objectives: [
        "Learn how to use both familiar and new punctuation correctly: full stops, capital letters, exclamation marks, question marks, commas for lists and apostrophes for contracted forms and the possessive (singular).",
        "Learn how to use sentences with different forms: statement, question, exclamation, command.",
        "Use expanded noun phrases to describe and specify (the blue butterfly).",
        "Use the present and past tenses correctly and consistently.",
        "Use subordination (when, if, that, because) and co-ordination (or, and, but).",
        "Understand the terms: noun, verb, adjective, adverb, noun phrase, statement, question, exclamation, command, tense, apostrophe, comma.",
      ],
      note: {
        title: "Year 2: word types, sentence types and punctuation",
        body: `## Word types
| Word type | Job | Example |
| --- | --- | --- |
| **noun** | names a person, place or thing | dog, Ella, park |
| **verb** | a doing or being word | jump, run, is |
| **adjective** | describes a noun | tiny, red, soft |
| **adverb** | tells how a verb is done | slowly, loudly |

## Sentence types
| Type | Example | Ends with |
| --- | --- | --- |
| statement | The sky is blue. | . |
| question | Is the sky blue? | ? |
| command | Close the door. | . or ! |
| exclamation | What a huge cake! | ! |

## Expanded noun phrase
Add adjectives before the noun: **the tall green tree**.

## Commas in a list
I packed **a hat, a coat and a scarf**. (commas between items, 'and' before the last)

## Tense
Past: I **jumped**. Present: I **jump**.

## Apostrophes
- Missing letters: isn**'**t (is not)
- Belonging: Sam**'s** bike

**Say it like this:** "A noun names it, a verb does it, an adjective describes it, an adverb tells how."`,
      },
      quiz: {
        title: "Grammar & Punctuation: Year 2 quiz",
        questions: [
          { key: "gp-y2-01", kind: "single", prompt: "Which word is a noun (a naming word)?\nThe dog ran fast.", options: ["The", "ran", "fast", "dog"], answer: "dog", explanation: "A noun names a person, animal, place or thing. A dog is an animal.", difficulty: 1 },
          { key: "gp-y2-02", kind: "single", prompt: "Which word is a verb (a doing word)?\nThe girl jumped high.", options: ["girl", "jumped", "high", "The"], answer: "jumped", explanation: "A verb tells what someone does. The girl jumped.", difficulty: 1 },
          { key: "gp-y2-03", kind: "single", prompt: "Which word is an adjective (a describing word)?\nThe tiny mouse hid.", options: ["mouse", "hid", "tiny", "The"], answer: "tiny", explanation: "An adjective describes a noun. Tiny tells us about the mouse.", difficulty: 1 },
          { key: "gp-y2-04", kind: "single", prompt: "Which word is an adverb (it tells HOW)?\nShe sang loudly.", options: ["She", "sang", "loudly", "the"], answer: "loudly", explanation: "'Loudly' tells us how she sang. Many adverbs end in -ly.", difficulty: 2 },
          { key: "gp-y2-05", kind: "single", prompt: "Which one is a command?", options: ["Where is my bag?", "The sky is blue.", "What a big dog!", "Please sit down."], answer: "Please sit down.", explanation: "A command tells someone to do something. It often starts with a verb like 'sit'.", difficulty: 2, diagnostic: true },
          { key: "gp-y2-06", kind: "single", prompt: "Which one is an exclamation?", options: ["It is a lovely day.", "Is it a lovely day?", "What a lovely day!", "Have a lovely day."], answer: "What a lovely day!", explanation: "An exclamation often starts with 'What' or 'How' and ends with an exclamation mark.", difficulty: 2 },
          { key: "gp-y2-07", kind: "single", prompt: "Which sentence uses commas in a list correctly?", options: ["I like red, blue and green.", "I like, red, blue and green.", "I like red blue, and green.", "I like red, blue, and, green."], answer: "I like red, blue and green.", explanation: "Put commas between the items, then 'and' before the last one. No comma after 'like'.", difficulty: 2, diagnostic: true },
          { key: "gp-y2-08", kind: "single", prompt: "Yesterday I ___ to the park.", options: ["walk", "walks", "walking", "walked"], answer: "walked", explanation: "'Yesterday' means the past, so we need the past tense: walked.", difficulty: 2 },
          { key: "gp-y2-09", kind: "single", prompt: "Which sentence has an expanded noun phrase (adjectives before the noun)?", options: ["The cat purred.", "The cat purred loudly.", "The fluffy white cat purred.", "Cats purr."], answer: "The fluffy white cat purred.", explanation: "'The fluffy white cat' adds adjectives to the noun. That is an expanded noun phrase.", difficulty: 3 },
          { key: "gp-y2-10", kind: "single", prompt: "Which sentence uses an apostrophe to show belonging?", options: ["Don't run.", "We can't go.", "I'm happy.", "Zoe's bag is red."], answer: "Zoe's bag is red.", explanation: "Zoe's shows the bag belongs to Zoe. In the others the apostrophe stands for missing letters.", difficulty: 3 },
        ],
      },
      flashcards: [
        { front: "Noun", back: "Names a person, place or thing: dog, park" },
        { front: "Verb", back: "A doing or being word: jump, is" },
        { front: "Adjective", back: "Describes a noun: tiny, red" },
        { front: "Adverb", back: "Tells how something is done: slowly" },
        { front: "Expanded noun phrase", back: "Adjectives + noun: the fluffy white cat" },
        { front: "Statement and question", back: "Statement tells (.). Question asks (?)." },
        { front: "Command and exclamation", back: "Command tells you to do (Sit down.). Exclamation shows feeling (What a day!)." },
        { front: "Commas in a list", back: "red, blue and green" },
        { front: "Past tense", back: "Already happened: walked" },
        { front: "Apostrophe: missing letters", back: "can't = cannot" },
        { front: "Apostrophe: belonging", back: "Zoe's bag = the bag of Zoe" },
      ],
    },
  },
};
