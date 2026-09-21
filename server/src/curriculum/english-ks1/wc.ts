// KS1 English — Writing: Composition (Years 1–2). Original content aligned to the DfE National Curriculum (OGL v3.0).
// Quick single/short questions about HOW to write (no written answers at this age).
import type { CTopic } from "../types";

export const TOPIC: CTopic = {
  key: "wc",
  topic: "Writing — Composition",
  subject: "English",
  years: {
    1: {
      year: 1,
      objectives: [
        "Say out loud what they are going to write about.",
        "Compose a sentence orally before writing it.",
        "Sequence sentences to form short narratives.",
        "Re-read what they have written to check that it makes sense.",
        "Discuss what they have written with the teacher or other pupils.",
      ],
      note: {
        title: "Year 1: building and ordering sentences",
        body: `## Say it, count it, write it
Good writers **say** their sentence first. Then they count the words on their fingers. Then they write it down.

## What makes a sentence?
- It **makes sense**.
- It starts with a **capital letter**.
- It ends with a **full stop**, **?** or **!**.
- The words are in the **right order**: The bird sang a song.

## Putting a story in order
Use order words:

| Order word | Use it for |
| --- | --- |
| First | what happens at the start |
| Next / Then | what happens in the middle |
| Last | what happens at the end |

## Adding detail
"I saw a bird." becomes "I saw a **small red** bird."

## Worked example
Mix-up: "ran / The / dog / up / the / hill"
Put in order: **The dog ran up the hill.**

## Story starters
A story can start with **Once upon a time...**

**Say it like this:** "Say it. Write it. Read it back!"`,
      },
      quiz: {
        title: "Writing — Composition: Year 1 quiz",
        questions: [
          { key: "wc-y1-01", kind: "single", prompt: "Which one is a sentence?", options: ["The dog barks.", "dog the barks", "barks The dog", "dog barks the"], answer: "The dog barks.", explanation: "It makes sense, starts with a capital letter and ends with a full stop.", difficulty: 1 },
          { key: "wc-y1-02", kind: "single", prompt: "Put the words in order:\nsat / The / cat / on / the / mat", options: ["The mat sat on the cat.", "Sat the cat on the mat.", "The cat sat on the mat.", "Cat the on mat sat."], answer: "The cat sat on the mat.", explanation: "Start with 'The', then say who did it, what they did and where.", difficulty: 2 },
          { key: "wc-y1-03", kind: "single", prompt: "First, Mia got up. ___, she brushed her teeth. Last, she went to school.", options: ["Tall", "Green", "Next", "Never"], answer: "Next", explanation: "'Next' is an order word that comes after 'First'.", difficulty: 1 },
          { key: "wc-y1-04", kind: "single", prompt: "Which is a good way to start a story? 📖", options: ["The end.", "Once upon a time, there was a little bear.", "Because it was big.", "Bear the little a."], answer: "Once upon a time, there was a little bear.", explanation: "'Once upon a time' tells us a story is starting.", difficulty: 1 },
          { key: "wc-y1-05", kind: "single", prompt: "Which sentence adds the most detail?", options: ["I saw dog.", "A dog saw.", "I saw a dog.", "I saw a big brown dog."], answer: "I saw a big brown dog.", explanation: "'Big' and 'brown' tell us more about the dog.", difficulty: 2 },
          { key: "wc-y1-06", kind: "single", prompt: "Which order tells the story?\n1: Tom got wet.\n2: It began to rain.\n3: Tom went out.", options: ["1, 2, 3", "3, 2, 1", "2, 1, 3", "1, 3, 2"], answer: "3, 2, 1", explanation: "First Tom went out (3), then it rained (2), then he got wet (1).", difficulty: 2, diagnostic: true },
          { key: "wc-y1-07", kind: "short", prompt: "Type the missing word:\nTom ___ Mia are friends.", answer: "and", accepted: ["And", "and."], explanation: "'And' joins two names together: Tom and Mia.", difficulty: 2 },
          { key: "wc-y1-08", kind: "single", prompt: "What should you check when you finish a sentence?", options: ["a capital letter and a full stop", "a picture", "a rhyme", "a very long word"], answer: "a capital letter and a full stop", explanation: "Every sentence starts with a capital letter and ends with a full stop, question mark or exclamation mark.", difficulty: 2, diagnostic: true },
          { key: "wc-y1-09", kind: "single", prompt: "Which is the best END for a story about a lost puppy? 🐶", options: ["Then it was Monday.", "At last, the puppy was home and safe.", "The puppy is a dog.", "Puppy home the."], answer: "At last, the puppy was home and safe.", explanation: "A good ending solves the problem. The puppy was lost and now it is home.", difficulty: 3 },
          { key: "wc-y1-10", kind: "single", prompt: "Which sentence is written best?", options: ["The cat ran up the tree", "cat The ran tree the up.", "The cat ran up the tree.", "The cat, ran up the tree?"], answer: "The cat ran up the tree.", explanation: "The words are in order, it starts with a capital letter and it ends with a full stop.", difficulty: 3 },
        ],
      },
      flashcards: [
        { front: "A sentence", back: "Makes sense. Starts with a capital letter. Ends with . ? or !" },
        { front: "Before I write", back: "Say it. Count the words. Write it." },
        { front: "First, next, then, last", back: "Order words that help tell a story in order." },
        { front: "Once upon a time...", back: "A way to start a story." },
        { front: "'and'", back: "Joins two ideas or things: cats and dogs" },
        { front: "Adding detail", back: "a dog → a big brown dog" },
        { front: "After I write", back: "Read it back to check it makes sense." },
        { front: "Word spaces", back: "Leave a finger space between each word." },
        { front: "Names", back: "Start with a capital letter: Mia, London" },
      ],
    },
    2: {
      year: 2,
      objectives: [
        "Write narratives about personal experiences and those of others (real and fictional).",
        "Plan or say out loud what they are going to write about; write down ideas and/or key words.",
        "Evaluate their writing with the teacher and other pupils; re-read to check it makes sense.",
        "Extend sentences using and, but, because, when, if.",
        "Use adjectives and time words to add detail.",
      ],
      note: {
        title: "Year 2: story parts, planning and better sentences",
        body: `## Parts of a story
| Part | What it is |
| --- | --- |
| **characters** | who is in the story |
| **setting** | where and when it happens |
| **beginning** | meet the characters and the setting |
| **middle** | a problem happens |
| **end** | the problem is solved |

## Plan first!
Before you write, jot down **key words** for the beginning, middle and end. Then you will not get stuck.

## Making sentences longer
Join ideas with **joining words**:
- **and**: adds an idea. "We swam **and** we played."
- **but**: shows a problem. "I wanted to play **but** it rained."
- **because**: gives a reason. "Leah was happy **because** it was her birthday."
- **when**: says the time. "**When** the sun came out, we went out."

## Adding detail
"A cat sat." → "The **fluffy grey** cat sat **lazily** on the **warm** wall."

## Worked example: a plan
Beginning: Ana finds a lost kitten.
Middle: Ana looks for its home, but it starts to rain.
End: Ana finds the owner and they say thank you.

**Say it like this:** "Who? Where? What goes wrong? How is it fixed?"`,
      },
      quiz: {
        title: "Writing — Composition: Year 2 quiz",
        questions: [
          { key: "wc-y2-01", kind: "single", prompt: "The people or animals in a story are called the ___.", options: ["settings", "titles", "characters", "endings"], answer: "characters", explanation: "The characters are who the story is about.", difficulty: 1 },
          { key: "wc-y2-02", kind: "single", prompt: "Where and when a story happens is called the ___.", options: ["plot", "rhyme", "title", "setting"], answer: "setting", explanation: "The setting is the place and time of a story: a dark forest at night, for example.", difficulty: 1 },
          { key: "wc-y2-03", kind: "short", prompt: "Type the missing word:\nOnce upon a ___, there was a fox. 🦊", answer: "time", accepted: ["Time", "time."], explanation: "'Once upon a time' is a classic way to begin a story.", difficulty: 1 },
          { key: "wc-y2-04", kind: "single", prompt: "Join the two ideas with 'because':\nAli was sad. He lost his ball.", options: ["Ali was sad because he lost his ball.", "Ali was sad but he lost his ball.", "Ali was sad because. He lost his ball.", "Because Ali was sad his lost ball."], answer: "Ali was sad because he lost his ball.", explanation: "'Because' gives the reason Ali was sad: he lost his ball.", difficulty: 2 },
          { key: "wc-y2-05", kind: "single", prompt: "Which word shows two ideas that do not match?\nI like sweets, ___ I do not like nuts.", options: ["because", "but", "or", "when"], answer: "but", explanation: "'But' joins two ideas that go against each other: like sweets, do not like nuts.", difficulty: 2 },
          { key: "wc-y2-06", kind: "single", prompt: "Which sentence has more detail?", options: ["The muddy brown dog ran quickly across the wet field.", "A dog ran.", "Dog ran.", "The dog."], answer: "The muddy brown dog ran quickly across the wet field.", explanation: "Adjectives (muddy, brown, wet) and an adverb (quickly) add detail.", difficulty: 2 },
          { key: "wc-y2-07", kind: "single", prompt: "Plan:\nBeginning: Kit finds a map.\nMiddle: Kit follows it and meets a bear.\nEnd: ?", options: ["Kit has a map.", "The map is old.", "Kit finds treasure and shares it with the bear.", "Kit is a boy."], answer: "Kit finds treasure and shares it with the bear.", explanation: "The end solves the story. Following the map leads to treasure.", difficulty: 2, diagnostic: true },
          { key: "wc-y2-08", kind: "single", prompt: "Which sentence is the PROBLEM in a story?", options: ["Once upon a time, Mia lived in a village.", "Suddenly, the bridge broke and Mia could not cross.", "Mia woke up in her bed.", "They all lived happily ever after."], answer: "Suddenly, the bridge broke and Mia could not cross.", explanation: "The problem is what goes wrong. Mia cannot cross the bridge.", difficulty: 2, diagnostic: true },
          { key: "wc-y2-09", kind: "single", prompt: "We went to the beach. We swam. We ate. We went home.\nHow could this be improved?", options: ["Take away all the full stops.", "Make it shorter.", "Add joining words and more detail.", "Leave out the beach."], answer: "Add joining words and more detail.", explanation: "Words like 'then' and 'because', plus detail, make it more interesting to read.", difficulty: 3 },
          { key: "wc-y2-10", kind: "single", prompt: "Put the story in order.\nA: They all cheered.\nB: Fox was stuck in a hole.\nC: Pip pulled Fox out with a rope.", options: ["A, B, C", "C, B, A", "B, C, A", "B, A, C"], answer: "B, C, A", explanation: "First the problem (B), then the fix (C), then the happy end (A).", difficulty: 3 },
        ],
      },
      flashcards: [
        { front: "Characters", back: "Who is in the story" },
        { front: "Setting", back: "Where and when the story happens" },
        { front: "Beginning, middle, end", back: "Meet the characters, a problem, then it is solved." },
        { front: "Story problem", back: "The thing that goes wrong in the middle." },
        { front: "and", back: "Adds an idea" },
        { front: "but", back: "Shows a problem or a difference" },
        { front: "because", back: "Gives a reason" },
        { front: "Adding detail", back: "Use adjectives: the muddy brown dog" },
        { front: "Time words", back: "First, then, suddenly, at last" },
        { front: "Before I write", back: "Plan: jot down key words for beginning, middle and end." },
      ],
    },
  },
};
