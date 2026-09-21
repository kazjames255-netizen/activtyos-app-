// French — Family & Pets (Year 4). Original content aligned to the DfE KS2 foreign languages programme of study (OGL v3.0).
import type { CTopic } from "../types";
import { qb, cards } from "./_h";

const q4 = qb("frfam", 4);

export const TOPIC: CTopic = {
  key: "frfam",
  topic: "Family & Pets",
  subject: "French",
  years: {
    4: {
      year: 4,
      objectives: [
        "Name members of the family and common pets, using the correct gender (un/une, le/la).",
        "Say what family and pets you have using j'ai … and il/elle s'appelle …",
        "Use mon / ma / mes with family words.",
        "Read and write short descriptions of a family, noticing plural -s and simple negatives (je n'ai pas de …).",
      ],
      note: {
        title: "Year 4: my family and my pets",
        body: `## What you need to know

Every French noun is **masculine** (un / le) or **feminine** (une / la). Learn the little word with the noun!

| French | English |
| --- | --- |
| le père (papa) | father (dad) |
| la mère (maman) | mother (mum) |
| le frère | brother |
| la sœur | sister |
| le grand-père | grandfather |
| la grand-mère | grandmother |
| l'oncle (m) | uncle |
| la tante | aunt |
| les parents | parents |
| un chat / un chien | a cat / a dog |
| un lapin / un poisson | a rabbit / a fish |
| un oiseau / un cheval | a bird / a horse |
| une tortue | a tortoise |

**My** is **mon** (masculine word), **ma** (feminine word) or **mes** (plural): mon frère, ma sœur, mes parents.

## Model sentences

- J'ai un cousin et deux cousines. (I have a cousin and two female cousins.)
- Mon chien s'appelle Max. Il est petit. (My dog is called Max.)
- Ma tante a deux chats. (My aunt has two cats.)
- Je n'ai pas de poisson. (I don't have a fish.)

To say **more than one**, add **-s**: un frère → deux frères. The -s is silent!

## Sound tips

*Sœur* sounds like "suhr"; *chat* is "sha" (silent t); *chien* is "shyan"; *grand* is "gron" with a silent d.

## Common mistakes

- Saying **mon sœur** instead of **ma sœur**.
- Forgetting that *je n'ai pas de* has **de** (not un/une) after it.
- Saying the -s in *frères*.`,
      },
      quiz: {
        title: "Family & Pets: Year 4 quiz",
        questions: [
          q4.single("What does 'le frère' mean?", "brother", ["sister", "father", "cousin"], "Le frère is the brother. The sister is la sœur.", 1),
          q4.single("Which word means 'grandmother'?", "la grand-mère", ["la mère", "la tante", "la sœur"], "Grand-mère is 'big mother', the grandmother.", 1),
          q4.single("What is 'un chien'?", "a dog", ["a cat", "a rabbit", "a fish"], "Un chien is a dog. Say 'shyan'. The cat is un chat.", 1),
          q4.single("What does 'J'ai un chat' mean?", "I have a cat", ["I am a cat", "I have a dog", "I like cats"], "J'ai means 'I have'. Un chat is a cat.", 2),
          q4.single("Choose the right word: '____ sœur s'appelle Clara.'", "Ma", ["Mon", "Mes", "Le"], "Sœur is a feminine word, so 'my' is ma.", 2, true),
          q4.single("'J'ai deux frères et une sœur.' How many brothers and sisters does the speaker have altogether?", "3", ["2", "4", "1"], "Two brothers plus one sister makes three brothers and sisters.", 3),
          q4.short("Write 'a rabbit' in French.", "un lapin", "Lapin is a masculine word, so it takes un.", 2, { na: true, diag: true }),
          q4.short("Write 'my brother' in French.", "mon frère", "Frère is masculine, so 'my' is mon.", 2, { na: true }),
          q4.multi("Which of these are pets? Choose all that apply.", ["un chat", "un poisson", "un cheval"], ["un oncle", "une tante"], "Un chat, un poisson and un cheval are animals. Un oncle and une tante are family members.", 2),
          q4.single("What does 'Je n'ai pas de frère' mean?", "I don't have a brother", ["I have a brother", "I am not a brother", "I don't like my brother"], "Je n'ai pas de means 'I don't have any'.", 3),
        ],
      },
      flashcards: cards([
        ["la mère", "mother (feminine)"],
        ["father", "le père"],
        ["la sœur", "sister"],
        ["grandfather", "le grand-père"],
        ["un chat", "a cat"],
        ["a dog", "un chien"],
        ["mon / ma / mes", "my (masculine / feminine / plural)"],
        ["my sister", "ma sœur"],
        ["J'ai un poisson.", "I have a fish."],
        ["I have a brother.", "J'ai un frère."],
      ]),
    },
  },
};
