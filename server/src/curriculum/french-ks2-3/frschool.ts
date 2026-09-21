// French — School & Classroom (Year 4). Original content aligned to the DfE KS2 foreign languages programme of study (OGL v3.0).
import type { CTopic } from "../types";
import { qb, cards } from "./_h";

const q4 = qb("frschool", 4);

export const TOPIC: CTopic = {
  key: "frschool",
  topic: "School & Classroom",
  subject: "French",
  years: {
    4: {
      year: 4,
      objectives: [
        "Name common classroom objects and school subjects, with the correct gender.",
        "Understand and respond to simple classroom instructions.",
        "Say which subjects you like and dislike using j'aime / je n'aime pas / je déteste.",
        "Read and write short phrases about school, noticing that French uses le/la/l'/les before subjects.",
      ],
      note: {
        title: "Year 4: in the classroom",
        body: `## Things in my schoolbag

| French | English |
| --- | --- |
| un stylo | a pen |
| un crayon | a pencil |
| un cahier | an exercise book |
| un livre | a book |
| une règle | a ruler |
| une gomme | a rubber |
| une trousse | a pencil case |
| un cartable | a school bag |

## School subjects

les maths (f, plural), le français, l'anglais, les sciences (f), l'histoire (f), la géographie, le sport, l'art (m), la musique, l'informatique (f, ICT).

## Classroom instructions

- Écoutez ! (Listen!)
- Regardez ! (Look!)
- Levez la main ! (Put your hand up!)
- Asseyez-vous ! (Sit down!)

## Saying what you like

**J'aime** + le / la / l' / les + subject: **J'aime le français.** (I like French.)
**Je n'aime pas** + …: **Je n'aime pas la géographie.** (I don't like geography.)
**Je déteste** + …: **Je déteste les devoirs.** (I hate homework.)
**J'adore** + …: **J'adore l'art.** (I love art.)

In French you *must* say the little word (le, la, l', les) before the subject.

## Model sentences

- Dans mon cartable, j'ai un cahier et une règle. (In my bag I have an exercise book and a ruler.)
- Le lundi, j'ai sport. Je déteste ça ! (On Monday I have PE. I hate it!)
- J'adore l'informatique. (I love ICT.)

## Sound tips

*École* sounds like "ay-COL". *Cahier* is "ka-YAY", *crayon* is "cray-YON" and *stylo* is "stee-LO".

## Common mistakes

- Leaving out the article: **J'aime français** is wrong; say **J'aime le français**.
- Using **un** with a feminine word: **une règle**, not *un règle*.`,
      },
      quiz: {
        title: "School & Classroom: Year 4 quiz",
        questions: [
          q4.single("What is 'un stylo'?", "a pen", ["a pencil", "a book", "a ruler"], "Un stylo is a pen. A pencil is un crayon.", 1),
          q4.single("What is 'un cahier'?", "an exercise book", ["a pencil case", "a rubber", "a school bag"], "Un cahier is a notebook or exercise book.", 1),
          q4.single("Which subject is 'les maths'?", "maths", ["music", "history", "art"], "Les maths is short for les mathématiques: maths.", 1),
          q4.single("Which is the French for 'a ruler'?", "une règle", ["une gomme", "une trousse", "un crayon"], "Une règle is a ruler. A gomme is a rubber.", 1),
          q4.single("What does 'Levez la main !' mean?", "Put your hand up!", ["Sit down!", "Listen!", "Look!"], "La main is the hand and lever means to raise.", 2, true),
          q4.single("What does 'Je n'aime pas le sport' mean?", "I don't like sport", ["I like sport", "I play sport at school", "I love sport"], "Je n'aime pas is the negative: I do not like.", 3),
          q4.short("Write 'a pencil' in French.", "un crayon", "Crayon is masculine, so a pencil is un crayon.", 2, { na: true, diag: true }),
          q4.short("Complete: J'aime ___ musique. (I like music.)", "la", "Musique is feminine, so the word before it is la.", 2),
          q4.multi("Which of these are school subjects? Choose all that apply.", ["l'histoire", "les maths", "la musique"], ["un stylo", "une règle"], "L'histoire, les maths and la musique are subjects. Un stylo and une règle are objects.", 2),
          q4.single("Which sentence is correct for 'I hate science'?", "Je déteste les sciences.", ["Je déteste le sciences.", "Je déteste la sciences.", "Je déteste sciences."], "Sciences is plural, so it needs les. Don't leave the article out.", 3),
        ],
      },
      flashcards: cards([
        ["un stylo", "a pen"],
        ["a pencil case", "une trousse"],
        ["une gomme", "a rubber"],
        ["a book", "un livre"],
        ["Écoutez !", "Listen!"],
        ["Sit down!", "Asseyez-vous !"],
        ["J'aime l'art.", "I like art."],
        ["I don't like history.", "Je n'aime pas l'histoire."],
        ["le français", "French (the subject)"],
        ["science (the subject)", "les sciences"],
      ]),
    },
  },
};
