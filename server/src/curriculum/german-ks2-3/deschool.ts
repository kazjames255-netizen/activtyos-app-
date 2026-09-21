// German — School & Classroom (Year 4). Original content aligned to the DfE KS2 foreign languages programme of study (OGL v3.0).
import type { CTopic } from "../types";
import { qb, cards } from "./_h";

const q4 = qb("deschool", 4);

export const TOPIC: CTopic = {
  key: "deschool",
  topic: "School & Classroom",
  subject: "German",
  years: {
    4: {
      year: 4,
      objectives: [
        "Name classroom objects and school subjects, with the right article (der, die, das).",
        "Say 'This is a …' with das ist ein / eine and ask 'Was ist das?'.",
        "Give an opinion about subjects with ich mag … and mein Lieblingsfach ist …, including the negative with nicht.",
        "Understand and use simple classroom commands.",
      ],
      note: {
        title: "Year 4: In der Schule",
        body: `## Classroom objects

| German | English |
| --- | --- |
| das Klassenzimmer | classroom |
| der Lehrer / die Lehrerin | teacher (male / female) |
| der Tisch / der Stuhl | table (desk) / chair |
| das Heft | exercise book |
| der Stift / der Bleistift | pen / pencil |
| die Schultasche | school bag |
| die Tür / das Fenster | door / window |
| der Computer | computer |

## School subjects

Mathe, Englisch, Deutsch, Kunst, Sport, Musik, Geschichte (history), Informatik (computing), Erdkunde (geography). Subjects are nouns, so they have capitals.

## Useful sentences

- **Was ist das? – Das ist ein Bleistift.** (Use *ein* for der- and das-words, *eine* for die-words.)
- **Mein Lieblingsfach ist Englisch.** = My favourite subject is English.
- **Ich mag Informatik.** = I like computing. Say **Ich mag … nicht** for dislikes: *Ich mag Geschichte nicht.*
- Commands to one person: **Hör zu!** (listen), **Lies!** (read), **Schreib!** (write), **Steh auf!** (stand up).

## Sound tip

**th** in *Mathe* is just a "t" ("MAH-tuh"); in *Lehrerin* the **-eh-** is a long "ay"; **sch** in *Schule* and *Tasche* is "sh"; **st** at the start of a word (*Stuhl*, *Stift*) is said "sht"; **ü** in *Tür* is a rounded "ee"; **ie** in *Lieblingsfach* is "ee".

## Common mistakes

- Saying "Ich nicht mag Kunst". The verb stays in second place: **Ich mag Kunst nicht.**
- Using *der* for every classroom word. Learn each noun with its article: das Heft, die Tür, der Stift.
- Reading *st* as "st": at the start of a word it is "sht".`,
      },
      quiz: {
        title: "School & Classroom: Year 4 quiz",
        questions: [
          q4.single("What does 'das Buch' mean?", "book", ["pen", "desk", "window"], "Das Buch is a book. Der Stift is a pen.", 1),
          q4.single("What does 'die Tafel' mean?", "board (blackboard)", ["door", "chair", "school bag"], "Die Tafel is the board at the front of the classroom.", 1),
          q4.single("What does 'Erdkunde' mean?", "geography", ["history", "science", "art"], "Erde is earth and Kunde means study, so Erdkunde is the study of the earth: geography.", 1),
          q4.single("Which article goes with 'Lineal' (ruler)?", "das", ["der", "die", "den"], "Lineal is a neuter noun, so it takes das: das Lineal.", 2, true),
          q4.single("What does 'Mein Lieblingsfach ist Kunst' mean?", "My favourite subject is art.", ["I like art homework.", "My teacher likes art.", "I don't like art."], "Lieblingsfach is favourite subject and Kunst is art.", 2),
          q4.short("Complete: Ich ____ Musik. (I like music.)", "mag", "Ich mag means I like: the verb mögen becomes mag with ich.", 2, { diag: true }),
          q4.short("Write 'the school bag' in German, with the article.", "die Schultasche", "Schultasche is a feminine noun, so the article is die: die Schultasche.", 2),
          q4.multi("Which of these are school subjects? Choose all that apply.", ["Mathe", "Sport", "Kunst"], ["der Tisch", "der Stuhl"], "Mathe, Sport and Kunst are subjects. Tisch (desk) and Stuhl (chair) are furniture.", 3),
          q4.single("Which thing do you use to rub out a mistake?", "der Radiergummi", ["der Bleistift", "das Lineal", "die Tafel"], "You rub out pencil mistakes with the rubber, der Radiergummi.", 2),
          q4.single("Which sentence correctly says 'I don't like maths'?", "Ich mag Mathe nicht.", ["Ich nicht mag Mathe.", "Ich Mathe nicht mag.", "Ich mag kein Mathe."], "The verb stays in second place and nicht goes at the end: Ich mag Mathe nicht.", 3),
        ],
      },
      flashcards: cards([
        ["das Klassenzimmer", "classroom"],
        ["teacher (female)", "die Lehrerin"],
        ["der Stuhl", "chair"],
        ["exercise book", "das Heft"],
        ["der Stift", "pen"],
        ["Was ist das?", "What is that?"],
        ["Das ist eine Tür.", "That is a door."],
        ["Ich mag Sport.", "I like sport (PE)."],
        ["Hör zu!", "Listen!"],
        ["Ich mag Geschichte nicht.", "I don't like history."],
      ]),
    },
  },
};
