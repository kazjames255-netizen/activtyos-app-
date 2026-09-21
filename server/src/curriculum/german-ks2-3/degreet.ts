// German — Greetings & Introductions (Year 3). Original content aligned to the DfE KS2 foreign languages programme of study (OGL v3.0).
import type { CTopic } from "../types";
import { qb, cards } from "./_h";

const q3 = qb("degreet", 3);

export const TOPIC: CTopic = {
  key: "degreet",
  topic: "Greetings & Introductions",
  subject: "German",
  years: {
    3: {
      year: 3,
      objectives: [
        "Understand and use common German greetings and farewells, and simple polite words.",
        "Ask and answer 'What is your name?' and 'How are you?' in short phrases.",
        "Say your age using ich bin … Jahre alt (with the numbers 7–10).",
        "Link the spelling, sound and meaning of familiar words, noticing sounds such as w, ei, ie and ch.",
      ],
      note: {
        title: "Year 3: Hallo! Saying hello and introducing yourself",
        body: `## What you need to know

Germans greet each other all day long. Learn these first words and you can start a conversation! Remember: **every noun starts with a capital letter** in German.

| German | English |
| --- | --- |
| Hallo / Hi | hello / hi |
| Guten Morgen | good morning |
| Guten Tag | good day / hello |
| Guten Abend | good evening |
| Gute Nacht | good night |
| Tschüss | bye (friendly) |
| Auf Wiedersehen | goodbye |
| ja / nein | yes / no |
| bitte / danke | please / thank you |
| Wie heißt du? | What are you called? |
| Ich heiße Mia. | I am called Mia. (My name is Mia.) |
| Wie geht's? | How are you? |
| Gut, danke. / Es geht. / Schlecht. | Fine, thanks. / So-so. / Bad. |
| Und dir? | And you? |

## Saying your age

Germans say **Ich bin … Jahre alt** (literally "I am … years old"), with **sein** (to be), not "have". The numbers you need: sieben (7), acht (8), neun (9), zehn (10).

## Model sentences

- Guten Tag! Ich heiße Ben. Wie heißt du?
- Wie geht's? – Gut, danke. Und dir?
- Ich bin sieben Jahre alt. Tschüss!

## Sound tip

**w** sounds like English "v" (*wie* = "vee"); **ie** sounds like "ee" (*wie*, *Wiedersehen*); **ei** sounds like "eye" (*heiße* = "HY-suh"); **ß** is a sharp "ss"; **ü** in *Tschüss* is a rounded "ee" sound; **ch** in *ich* is a soft hiss.

## Common mistakes

- Saying "Ich habe acht Jahre" (that is how French does it). German uses **sein**: Ich bin acht Jahre alt.
- Writing *Guten morgen* with a small m: greetings keep the capital on the noun (Morgen, Tag, Abend).
- Pronouncing **w** like an English "w" and **ei** like "ee".`,
      },
      quiz: {
        title: "Greetings & Introductions: Year 3 quiz",
        questions: [
          q3.single("What does 'Guten Morgen' mean?", "Good morning", ["Good night", "Goodbye", "Thank you"], "Morgen is morning, so Guten Morgen is what you say to greet someone early in the day.", 1),
          q3.single("Which German phrase means 'goodbye'?", "Auf Wiedersehen", ["Guten Tag", "Danke", "Guten Abend"], "Auf Wiedersehen is goodbye. Guten Tag and Guten Abend are greetings and danke means thank you.", 1),
          q3.single("What does 'danke' mean?", "Thank you", ["Please", "Sorry", "Yes"], "Danke means thank you. Please is bitte.", 1),
          q3.single("Which question means 'What are you called?'", "Wie heißt du?", ["Wie geht's?", "Wie alt bist du?", "Woher kommst du?"], "Wie heißt du? asks for your name. Wie geht's? asks how you are.", 2, true),
          q3.single("Someone asks 'Wie heißt du?' Which is a sensible reply?", "Ich heiße Leon.", ["Gut, danke.", "Tschüss!", "Ich bin zehn."], "The question asks for your name, so answer with Ich heiße … and your name.", 2),
          q3.single("What does 'Es geht' mean as an answer to 'Wie geht's?'", "So-so, okay", ["Very badly", "It goes home", "I am fine, thank you"], "Es geht means things are going okay, a bit so-so.", 2),
          q3.short("Write 'please' in German (one word).", "bitte", "Bitte is the German word for 'please'. Say it 'BIT-tuh'.", 2),
          q3.short("Complete the sentence: Ich ____ Anna. (I am called Anna.)", "heiße", "The verb is heißen, and with ich it becomes ich heiße.", 2, { na: true, diag: true, acc: ["heisse"] }),
          q3.multi("Which of these can you say to greet someone? Choose all that apply.", ["Hallo", "Guten Tag", "Guten Abend"], ["Tschüss", "Danke"], "Hallo, Guten Tag and Guten Abend are greetings. Tschüss is bye and danke is thank you.", 3),
          q3.single("Which sentence correctly says 'I am nine years old'?", "Ich bin neun Jahre alt.", ["Ich habe neun Jahre alt.", "Ich habe neun Jahre.", "Ich heiße neun Jahre alt."], "German uses sein for age: Ich bin neun Jahre alt.", 3),
        ],
      },
      flashcards: cards([
        ["Guten Tag", "hello / good day"],
        ["goodbye", "Auf Wiedersehen"],
        ["danke", "thank you"],
        ["please", "bitte"],
        ["Wie heißt du?", "What are you called? (What's your name?)"],
        ["My name is Zoe.", "Ich heiße Zoe."],
        ["Gut, danke.", "Fine, thank you."],
        ["good evening", "Guten Abend"],
        ["Wie geht's?", "How are you?"],
        ["I am ten years old.", "Ich bin zehn Jahre alt."],
      ]),
    },
  },
};
