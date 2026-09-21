// French — Greetings & Introductions (Year 3). Original content aligned to the DfE KS2 foreign languages programme of study (OGL v3.0).
import type { CTopic } from "../types";
import { qb, cards } from "./_h";

const q3 = qb("frgreet", 3);

export const TOPIC: CTopic = {
  key: "frgreet",
  topic: "Greetings & Introductions",
  subject: "French",
  years: {
    3: {
      year: 3,
      objectives: [
        "Understand and use common French greetings and farewells, and simple polite words.",
        "Ask and answer 'What is your name?' and 'How are you?' in short phrases.",
        "Say your age using j'ai … ans (with the numbers 7–10).",
        "Link the spelling, sound and meaning of familiar words, noticing silent letters at the end of words.",
      ],
      note: {
        title: "Year 3: Bonjour! Saying hello and introducing yourself",
        body: `## What you need to know

French people greet each other all day long. Learn these first words and you can start a conversation!

| French | English |
| --- | --- |
| bonjour | hello / good morning / good day |
| salut | hi (friendly) / bye (friendly) |
| bonsoir | good evening |
| bonne nuit | good night |
| au revoir | goodbye |
| merci | thank you |
| s'il te plaît | please |
| oui / non | yes / no |
| Comment tu t'appelles ? | What are you called? |
| Je m'appelle Léa. | I am called Léa. (My name is Léa.) |
| Ça va ? | How are you? |
| Ça va bien. / Ça va mal. | I'm fine. / I'm not well. |
| comme ci, comme ça | so-so |

## Saying your age

Use **j'ai … ans** (literally "I have … years"). The numbers you need: sept (7), huit (8), neuf (9), dix (10). **Je** shortens to **j'** before a vowel: it is always *j'ai*, never two separate words.

## Model sentences

- Bonsoir ! Je m'appelle Inès.
- Comment tu t'appelles ? – Je m'appelle Tom. Ça va ? – Comme ci, comme ça, merci !
- Salut ! Moi, j'ai huit ans. À demain ! (See you tomorrow!)

## Sound tip

Many letters at the end of a French word are **silent**: in *salut* the **t** is silent (say "sa-LU"), in *comment* the **-ent** is said like "mon", and in *ans* the **s** is silent. *Oui* sounds like "wee". The **j** in *bonjour* and *je* sounds like the **s** in "treasure".

## Common mistakes

- Writing *je m'appelle* with a capital J in the middle of a sentence.
- Saying "I am eight years" instead of **j'ai huit ans** ("I have eight years").
- Forgetting the apostrophe: **m'appelle**, **j'ai**, **s'il te plaît**.`,
      },
      quiz: {
        title: "Greetings & Introductions: Year 3 quiz",
        questions: [
          q3.single("What does 'bonjour' mean?", "Hello / good morning", ["Goodbye", "Thank you", "Good night"], "Bonjour is the most common way to say hello during the day.", 1),
          q3.single("Which French word means 'goodbye'?", "au revoir", ["bonjour", "merci", "bonsoir"], "Au revoir is how you say goodbye. Bonjour and bonsoir are greetings, and merci means thank you.", 1),
          q3.single("What does 'merci' mean?", "Thank you", ["Please", "Sorry", "Yes"], "Merci means thank you. Please is s'il te plaît.", 1),
          q3.single("Which question means 'What are you called?'", "Comment tu t'appelles ?", ["Ça va ?", "Tu as quel âge ?", "Où habites-tu ?"], "Comment tu t'appelles ? asks for your name. Ça va ? asks how you are.", 2, true),
          q3.single("Someone asks 'Comment tu t'appelles ?' Which is a sensible reply?", "Je m'appelle Lucas.", ["Ça va bien.", "Au revoir.", "Merci beaucoup."], "The question asks for your name, so answer with Je m'appelle … and your name.", 2),
          q3.single("What does 'Ça va mal' mean?", "I'm not well", ["I'm fine", "I'm going home", "I'm called Mal"], "Mal means badly, so ça va mal means things are going badly (I'm not well).", 2),
          q3.short("Write 'thank you' in French (one word).", "merci", "Merci is the French word for 'thank you'. Say it 'mer-SEE'.", 1, { na: true }),
          q3.short("Complete the sentence: Je ____ Sam. (I am called Sam.)", "m'appelle", "The verb is s'appeler, and with je it becomes je m'appelle.", 2, { diag: true }),
          q3.multi("Which of these can you say to greet someone? Choose all that apply.", ["bonjour", "salut", "bonsoir"], ["au revoir", "merci"], "Bonjour, salut and bonsoir are all greetings. Au revoir is goodbye and merci is thank you.", 2),
          q3.single("Which sentence correctly says 'I am nine years old'?", "J'ai neuf ans.", ["Je suis neuf ans.", "Je m'appelle neuf ans.", "J'ai neuf ça va."], "In French you say 'I have nine years': j'ai neuf ans.", 3),
        ],
      },
      flashcards: cards([
        ["bonjour", "hello / good morning"],
        ["goodbye", "au revoir"],
        ["merci", "thank you"],
        ["please (to a friend)", "s'il te plaît"],
        ["Comment tu t'appelles ?", "What are you called? (What's your name?)"],
        ["I am called Zoé.", "Je m'appelle Zoé."],
        ["Ça va bien.", "I'm fine."],
        ["good evening", "bonsoir"],
        ["comme ci, comme ça", "so-so"],
        ["I am ten years old.", "J'ai dix ans."],
      ]),
    },
  },
};
