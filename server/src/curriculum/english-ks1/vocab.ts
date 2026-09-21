// KS1 English — Vocabulary (Years 1–2). Original content aligned to the DfE National Curriculum (OGL v3.0).
import type { CTopic } from "../types";

export const TOPIC: CTopic = {
  key: "vocab",
  topic: "Vocabulary",
  subject: "English",
  years: {
    1: {
      year: 1,
      objectives: [
        "Develop understanding of the meaning of words, including opposites and words that mean the same.",
        "Sort and group words into categories (animals, fruit, colours, clothes).",
        "Add the prefix un- to change the meaning of a word (unhappy, unkind, unlock).",
        "Discuss word meanings and link new words to those already known.",
      ],
      note: {
        title: "Year 1: word meanings, opposites and un-",
        body: `## Words have meanings
The more words you know, the better you can read, talk and write!

## Opposites
**Opposites** are words that mean the very opposite of each other.

| Word | Opposite |
| --- | --- |
| wet | dry |
| in | out |
| fast | slow |
| happy | sad |
| big | small |

## Words that mean the same
Some words mean nearly the same thing: **quick** and **fast**, **pretty** and **lovely**.

## Groups (categories)
Words can go in groups.
- **Animals:** hen, fish, horse
- **Fruit:** banana, pear, orange
- **Colours:** red, blue, green
- **Clothes:** shirt, socks, coat

## The prefix un-
Put **un-** at the start of a word to make it mean **not** or the **opposite**.

| Word | With un- | Meaning |
| --- | --- | --- |
| well | unwell | not well |
| safe | unsafe | not safe |
| tie | untie | undo the tie |

**Say it like this:** "Which group does it belong to? Which word means the opposite?"`,
      },
      quiz: {
        title: "Vocabulary: Year 1 quiz",
        questions: [
          { key: "vocab-y1-01", kind: "single", prompt: "What is the opposite of 'hot'? 🔥", options: ["cold", "warm", "big", "wet"], answer: "cold", explanation: "Hot and cold are opposites. Warm is only a bit hot.", difficulty: 1 },
          { key: "vocab-y1-02", kind: "short", prompt: "What is the opposite of 'up'?\nType the word.", answer: "down", accepted: ["Down", "down."], explanation: "Up and down mean the opposite of each other.", difficulty: 1 },
          { key: "vocab-y1-03", kind: "single", prompt: "Which word is a fruit?", options: ["carrot", "bread", "apple", "milk"], answer: "apple", explanation: "Apples grow on trees and are fruit. Carrots are vegetables.", difficulty: 1 },
          { key: "vocab-y1-04", kind: "single", prompt: "Which word does NOT belong?\ncat, dog, rabbit, chair", options: ["cat", "dog", "rabbit", "chair"], answer: "chair", explanation: "Cat, dog and rabbit are animals. A chair is furniture.", difficulty: 2 },
          { key: "vocab-y1-05", kind: "single", prompt: "Which word means the same as 'big'?", options: ["tiny", "thin", "short", "large"], answer: "large", explanation: "Big and large both mean not small.", difficulty: 2 },
          { key: "vocab-y1-06", kind: "single", prompt: "What does 'unhappy' mean?", options: ["very happy", "not happy", "happy again", "a happy day"], answer: "not happy", explanation: "The prefix un- means 'not'. Unhappy means not happy.", difficulty: 2, diagnostic: true },
          { key: "vocab-y1-07", kind: "short", prompt: "Add un- to 'kind'.\nType the new word.", answer: "unkind", accepted: ["Unkind", "unkind."], explanation: "Put 'un' at the start: un + kind = unkind, which means not kind.", difficulty: 2 },
          { key: "vocab-y1-08", kind: "single", prompt: "The sun is bright, but the night is ___.", options: ["hot", "loud", "fast", "dark"], answer: "dark", explanation: "Bright and dark are opposites, and the night is dark.", difficulty: 2, diagnostic: true },
          { key: "vocab-y1-09", kind: "single", prompt: "What does 'unlock' mean?", options: ["shut with a key", "break a lock", "open with a key", "find a key"], answer: "open with a key", explanation: "Here un- means 'undo'. To unlock is to undo the lock, so we open it.", difficulty: 3 },
          { key: "vocab-y1-10", kind: "single", prompt: "Which word does NOT mean the same as 'tiny'?", options: ["small", "little", "mini", "huge"], answer: "huge", explanation: "Small, little and mini all mean tiny. Huge means very big, the opposite.", difficulty: 3 },
        ],
      },
      flashcards: [
        { front: "Opposite of hot", back: "cold" },
        { front: "Opposite of up", back: "down" },
        { front: "Opposite of fast", back: "slow" },
        { front: "Opposite of happy", back: "sad" },
        { front: "Same as big", back: "large" },
        { front: "Same as tiny", back: "small" },
        { front: "un- means...", back: "not, or undo: unhappy = not happy" },
        { front: "unkind", back: "not kind" },
        { front: "Group: fruit", back: "apple, banana, pear" },
        { front: "Group: colours", back: "red, blue, green" },
      ],
    },
    2: {
      year: 2,
      objectives: [
        "Develop understanding of the meaning of words, including words that mean the same (synonyms) and opposites.",
        "Learn word families: words built from the same little word (help, helpful, helpless, helper).",
        "Learn how the suffixes -ful, -less, -ly and -ness change a word and its meaning.",
        "Discuss and clarify the meanings of new words, using clues in the sentence.",
      ],
      note: {
        title: "Year 2: synonyms, word families and word clues",
        body: `## Synonyms and opposites
**Synonyms** mean nearly the same: **little** and **small**, **quick** and **fast**.
**Opposites** mean the reverse: **hard** and **soft**.

## Word families
Words made from the same little word are a **word family**.

| Base word | Family |
| --- | --- |
| thank | thankful, thankless |
| farm | farmer, farming |
| play | player, playful |

## Endings that change meaning
| Ending | Meaning | Example |
| --- | --- | --- |
| -ful | full of | painful = full of pain |
| -less | without | fearless = without fear |
| -ly | how | sadly = in a sad way |
| -ness | the state of being | kindness = being kind |

## Prefix un-
un- means not: **untidy** = not tidy.

## Clues in the sentence
"Mia was **delighted** when she saw the puppy, so she clapped and jumped for joy."
She clapped and jumped for joy, so **delighted** means **very happy**.

**Say it like this:** "Look at the words around it. What would make sense?"`,
      },
      quiz: {
        title: "Vocabulary: Year 2 quiz",
        questions: [
          { key: "vocab-y2-01", kind: "single", prompt: "Which word means the same as 'happy'? 😀", options: ["glad", "sad", "cross", "tired"], answer: "glad", explanation: "Happy and glad are synonyms: they mean nearly the same.", difficulty: 1 },
          { key: "vocab-y2-02", kind: "single", prompt: "What is the opposite of 'loud'?", options: ["noisy", "big", "quiet", "fast"], answer: "quiet", explanation: "Loud and quiet mean the opposite of each other.", difficulty: 1 },
          { key: "vocab-y2-03", kind: "single", prompt: "Which word is in the same family as 'help'?", options: ["hello", "hill", "hop", "helpful"], answer: "helpful", explanation: "Helpful is help + ful. It is made from the little word 'help'.", difficulty: 1 },
          { key: "vocab-y2-04", kind: "single", prompt: "Which word means 'without hope'?", options: ["hopeful", "hopeless", "hoping", "hopped"], answer: "hopeless", explanation: "The ending -less means 'without'. Hopeless is without hope.", difficulty: 2 },
          { key: "vocab-y2-05", kind: "single", prompt: "What does 'careful' mean?", options: ["without care", "care again", "not care", "full of care"], answer: "full of care", explanation: "The ending -ful means 'full of'. Careful means full of care.", difficulty: 2, diagnostic: true },
          { key: "vocab-y2-06", kind: "single", prompt: "Which word means the same as 'shout'?", options: ["whisper", "hum", "yell", "nod"], answer: "yell", explanation: "Shout and yell both mean to call out loudly. A whisper is the opposite.", difficulty: 2, diagnostic: true },
          { key: "vocab-y2-07", kind: "short", prompt: "Add -ly to 'quick' 🏃\nType the new word.", answer: "quickly", accepted: ["Quickly", "quickly."], explanation: "Add -ly to the end of 'quick' to tell us how: quickly.", difficulty: 2 },
          { key: "vocab-y2-08", kind: "single", prompt: "Which word is NOT a type of weather?\nrain, snow, wind, shoes", options: ["rain", "snow", "shoes", "wind"], answer: "shoes", explanation: "Rain, snow and wind are all weather. Shoes are something we wear.", difficulty: 2 },
          { key: "vocab-y2-09", kind: "single", prompt: "Tom was famished after the long walk. He ate a huge dinner.\nWhat does 'famished' mean?", options: ["very cold", "very hungry", "very sleepy", "very cross"], answer: "very hungry", explanation: "He ate a huge dinner, so he must have been very hungry. The clue is in the next sentence.", difficulty: 3 },
          { key: "vocab-y2-10", kind: "single", prompt: "Which word is NOT a real word?", options: ["unfair", "unlucky", "unbig", "untidy"], answer: "unbig", explanation: "Un- goes with some words, like unfair, but 'unbig' is not a word. We say 'small'.", difficulty: 3 },
        ],
      },
      flashcards: [
        { front: "Synonym", back: "A word that means nearly the same: happy, glad" },
        { front: "Opposite of loud", back: "quiet" },
        { front: "Word family: help", back: "helper, helpful, helpless" },
        { front: "-ful means", back: "full of: careful = full of care" },
        { front: "-less means", back: "without: hopeless = without hope" },
        { front: "-ly tells", back: "how: slowly, quickly" },
        { front: "-ness", back: "the state of being: sad → sadness" },
        { front: "un-", back: "not: untidy = not tidy" },
        { front: "famished", back: "very hungry" },
        { front: "Same as shout", back: "yell" },
      ],
    },
  },
};
