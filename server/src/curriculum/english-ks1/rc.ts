// KS1 English — Reading Comprehension (Years 1–2). Original content aligned to the DfE National Curriculum (OGL v3.0).
// All passages below are ORIGINAL. Answers are re-read as a teacher (no computable parts beyond option membership).
import type { CTopic } from "../types";

export const TOPIC: CTopic = {
  key: "rc",
  topic: "Reading Comprehension",
  subject: "English",
  years: {
    1: {
      year: 1,
      objectives: [
        "Listen to and discuss a wide range of poems, stories and non-fiction at a level beyond that at which they can read independently.",
        "Check that a text makes sense to them as they read and correct inaccurate reading.",
        "Discuss the significance of the title and events; make inferences on the basis of what is being said and done.",
        "Predict what might happen on the basis of what has been read so far; answer and ask questions.",
      ],
      note: {
        title: "Year 1: reading and understanding a short text",
        body: `## What we are learning

Reading is not just saying the words. It is **understanding** them! After you read a little story, you can answer questions about it.

There are two kinds of answers:
- **Finding it:** the answer is right there in the words. Point to it with your finger!
- **Working it out (inference):** the words give you a **clue**, and you think about what it means.

| Question word | What it asks for |
| --- | --- |
| Who? | a person or animal |
| What? | a thing or an action |
| Where? | a place |
| Why? | a reason |

## Worked example 1: finding it
"Dev has a green ball."
**What colour is the ball?** Point to the word: **green**.

## Worked example 2: working it out
"Mia put on her sunhat and sunglasses. She took a cold drink."
The story does not say it is sunny, but a sunhat is a clue. It is probably **sunny**.

## Worked example 3: order words
**First**, **next**, **then**, **last** tell us what happened in order.

**Say it like this:** "Read it twice. Then look back for the answer."`,
      },
      quiz: {
        title: "Reading Comprehension: Year 1 quiz",
        questions: [
          { key: "rc-y1-01", kind: "single", prompt: "Sam has a red kite. 🪁 The kite is up in the sky.\n\nWhat colour is the kite?", options: ["blue", "red", "green", "yellow"], answer: "red", explanation: "The story says 'a red kite'. The answer is in the words.", difficulty: 1 },
          { key: "rc-y1-02", kind: "single", prompt: "Tom has a dog. The dog is called Max. Max likes to run.\n\nWhat is the dog called?", options: ["Tom", "Sam", "Rex", "Max"], answer: "Max", explanation: "The story says 'The dog is called Max'. Tom is the boy.", difficulty: 1 },
          { key: "rc-y1-03", kind: "short", prompt: "Kit has a cat and a hen. The cat is black. The hen is brown.\n\nWhat colour is the hen?", answer: "brown", accepted: ["Brown", "brown."], explanation: "Look for the word 'hen'. The story says 'The hen is brown'.", difficulty: 1 },
          { key: "rc-y1-04", kind: "single", prompt: "Ben put on his coat, hat and boots. He took his umbrella. ☔\n\nWhat is the weather like?", options: ["rainy", "sunny", "hot", "dry"], answer: "rainy", explanation: "An umbrella is a clue. We take one when it rains.", difficulty: 2, diagnostic: true },
          { key: "rc-y1-05", kind: "single", prompt: "Lily gave a big smile. She ran to hug her gran.\n\nHow did Lily feel?", options: ["sad", "cross", "scared", "happy"], answer: "happy", explanation: "A big smile and a hug are clues. Lily is happy.", difficulty: 2 },
          { key: "rc-y1-06", kind: "single", prompt: "The tiny ant crept up the leaf. 🐜\n\nWhat does 'tiny' mean?", options: ["very big", "very small", "very fast", "very loud"], answer: "very small", explanation: "An ant is a little animal. Tiny means very small.", difficulty: 2 },
          { key: "rc-y1-07", kind: "single", prompt: "First, Zara got a bucket. Next, she filled it with water. Last, she washed the car. 🚗\n\nWhat did Zara do FIRST?", options: ["washed the car", "filled the bucket", "got a bucket", "dried the car"], answer: "got a bucket", explanation: "'First' tells us the first thing she did: she got a bucket.", difficulty: 2, diagnostic: true },
          { key: "rc-y1-08", kind: "single", prompt: "Jo looked at the dark sky. Then a big drop fell on his nose. He ran home fast.\n\nWhy did Jo run home?", options: ["He was hungry.", "He wanted to play.", "His nose was cold.", "It began to rain."], answer: "It began to rain.", explanation: "A dark sky and a big drop on his nose are clues. It started to rain, so Jo ran home.", difficulty: 3 },
          { key: "rc-y1-09", kind: "single", prompt: "The frog sat on a log. It can jump and swim. 🐸\n\nWhich sentence is true?", options: ["The frog can swim.", "The frog can fly.", "The frog is in a tree.", "The frog is on a bed."], answer: "The frog can swim.", explanation: "The story says the frog 'can jump and swim'. The other sentences are not in the story.", difficulty: 2 },
          { key: "rc-y1-10", kind: "single", prompt: "Nina found a lost puppy. It was cold and wet. She wrapped it in her jumper and took it home.\n\nWhat kind of girl is Nina?", options: ["unkind", "lazy", "kind", "noisy"], answer: "kind", explanation: "Nina helped the puppy and kept it warm. That is what a kind person does.", difficulty: 3 },
        ],
      },
      flashcards: [
        { front: "Who? What? Where? Why?", back: "Question words. They tell us what kind of answer to look for." },
        { front: "Finding it", back: "The answer is in the words. Point to it!" },
        { front: "Inference", back: "The words give a clue and we think: what does it mean?" },
        { front: "Umbrella, coat, boots", back: "Clues that it is rainy." },
        { front: "A big smile", back: "A clue that someone feels happy." },
        { front: "tiny", back: "Means very small." },
        { front: "First, next, then, last", back: "Words that tell us the order things happen." },
        { front: "The title", back: "Tells us what the story is about." },
        { front: "If I am stuck", back: "Read it again, then look back at the words." },
      ],
    },
    2: {
      year: 2,
      objectives: [
        "Read and discuss a wide range of fiction, poetry, plays, non-fiction and reference books.",
        "Answer and ask questions; discuss the sequence of events in books and how items of information are related.",
        "Draw on what they already know or on background information and vocabulary provided by the teacher.",
        "Make inferences on the basis of what is being said and done; predict what might happen on the basis of what has been read so far.",
        "Discuss and clarify the meanings of words, linking new meanings to known vocabulary.",
      ],
      note: {
        title: "Year 2: retrieval, inference and word meanings",
        body: `## Three kinds of reading questions

| Kind | What you do | Example |
| --- | --- | --- |
| **Retrieval** | Find the answer in the text | "Where did Leo eat his lunch?" |
| **Inference** | Use clues and think | "How does Jay feel?" |
| **Vocabulary** | Work out what a word means | "What does 'darted' mean?" |

## Worked example 1: retrieval
"On Sunday, Leo went to the beach. Then he ate his lunch on a rock."
**Where did Leo eat his lunch?** Find the word 'lunch' in the text. Answer: **on a rock**.

## Worked example 2: inference
"The lights went out and a dog howled far away. Jay pulled the blanket over his head."
The text does not say 'scared', but hiding under a blanket is a clue. Jay feels **scared**.

## Worked example 3: word meaning
"A tiny fish **darted** across the pond."
Read the words around it. A fish that is tiny and moving fast, so 'darted' means **moved quickly**.

**Say it like this:** "The text says... so I think... because..."

**Top tip:** for 'why' questions, look for the word **because** in your answer.`,
      },
      quiz: {
        title: "Reading Comprehension: Year 2 quiz",
        questions: [
          { key: "rc-y2-01", kind: "single", prompt: "On Saturday, Priya went to the park with her brother. They played on the swings and slid down the big slide. Then they had a picnic under a tree. 🌳\n\nWhere did they have the picnic?", options: ["on the swings", "under a tree", "on the slide", "at home"], answer: "under a tree", explanation: "The last sentence says 'a picnic under a tree'. Find the word 'picnic' and read on.", difficulty: 1 },
          { key: "rc-y2-02", kind: "single", prompt: "The owl sleeps in the day. At night, it wakes up and hunts for mice. Its big eyes help it see in the dark. 🦉\n\nWhen does the owl hunt?", options: ["in the day", "at lunch", "at night", "in the morning"], answer: "at night", explanation: "The text says 'At night, it wakes up and hunts for mice'.", difficulty: 1 },
          { key: "rc-y2-03", kind: "single", prompt: "The owl sleeps in the day. At night, it wakes up and hunts for mice. Its big eyes help it see in the dark. 🦉\n\nWhat helps the owl see in the dark?", options: ["its wings", "its sharp beak", "its soft feathers", "its big eyes"], answer: "its big eyes", explanation: "The text says 'Its big eyes help it see in the dark'.", difficulty: 2 },
          { key: "rc-y2-04", kind: "single", prompt: "Omar baked a cake for Mum. It came out flat and burnt. Omar felt sad, but Mum gave him a big hug. 'It is the best cake ever,' she said.\n\nWhy did Mum say that?", options: ["It tasted the best.", "She wanted to make Omar feel better.", "She did not like cake.", "It was very tall."], answer: "She wanted to make Omar feel better.", explanation: "The cake was flat and burnt and Omar was sad. Mum was being kind. That is an inference.", difficulty: 3 },
          { key: "rc-y2-05", kind: "single", prompt: "Omar baked a cake. It came out flat and burnt.\n\nWhat does 'flat' mean here?", options: ["very sweet", "round and fat", "low and not risen", "very hot"], answer: "low and not risen", explanation: "A cake should rise up. If it is flat, it has not risen.", difficulty: 2 },
          { key: "rc-y2-06", kind: "short", prompt: "Omar's cake came out flat and burnt. He felt sad, but Mum gave him a hug.\n\nHow did Omar feel? (one word)", answer: "sad", accepted: ["Sad", "sad."], explanation: "The text says 'Omar felt sad'. The answer is in the words.", difficulty: 1 },
          { key: "rc-y2-07", kind: "single", prompt: "Kim put a seed in a pot. Each day she gave it a little water. After two weeks, a small green shoot popped up. 🌱\n\nWhat happened after two weeks?", options: ["The seed was gone.", "A green shoot appeared.", "The pot broke.", "It began to rain."], answer: "A green shoot appeared.", explanation: "The text says 'After two weeks, a small green shoot popped up'.", difficulty: 2 },
          { key: "rc-y2-08", kind: "single", prompt: "A small green shoot popped up.\n\nWhat does 'popped up' mean?", options: ["appeared", "hid", "fell down", "went away"], answer: "appeared", explanation: "A shoot came out of the soil where we could see it. It appeared.", difficulty: 2, diagnostic: true },
          { key: "rc-y2-09", kind: "single", prompt: "Ravi stood at the window. Grey clouds filled the sky and the trees were shaking. He wished he could play football outside.\n\nWhy can Ravi not play outside?", options: ["The weather is bad.", "He is asleep.", "It is night.", "The ball is lost."], answer: "The weather is bad.", explanation: "Grey clouds and shaking trees are clues that it is stormy. That is why Ravi cannot play outside.", difficulty: 2, diagnostic: true },
          { key: "rc-y2-10", kind: "single", prompt: "The old house was quiet. The floor creaked and the door swung slowly open. Mina held her breath.\n\nHow does Mina feel?", options: ["cheerful", "bored", "sleepy", "nervous"], answer: "nervous", explanation: "Holding your breath in a creaky old house is a clue. Mina feels nervous.", difficulty: 3 },
        ],
      },
      flashcards: [
        { front: "Retrieval question", back: "The answer is in the text. Find it and point to it." },
        { front: "Inference", back: "Use clues in the text plus what you already know." },
        { front: "'Why' question", back: "Give a reason. Start your answer: 'because...'" },
        { front: "Prediction", back: "What might happen next? Use the clues so far." },
        { front: "Unknown word", back: "Read the words around it to work out the meaning." },
        { front: "'held her breath'", back: "A clue that a character feels nervous or scared." },
        { front: "Grey clouds, shaking trees", back: "Clues that the weather is stormy." },
        { front: "Heading or title", back: "Tells you what the text is about before you read it." },
        { front: "Stuck on a question?", back: "Read the text again and look back for clue words." },
      ],
    },
  },
};
