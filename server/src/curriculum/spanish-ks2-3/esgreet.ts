// Spanish — Greetings & Introductions (Year 3). Original content aligned to the DfE KS2 foreign languages programme of study (OGL v3.0).
import type { CTopic } from "../types";
import { qb, cards } from "./_h";

const q = qb("esgreet", 3);

export const TOPIC: CTopic = {
  key: "esgreet",
  topic: "Greetings & Introductions",
  subject: "Spanish",
  years: {
    3: {
      year: 3,
      objectives: [
        "Understand and use common Spanish greetings, farewells and polite words.",
        "Ask and answer 'What is your name?' and 'How are you?' in short phrases.",
        "Say your age with tengo … años (numbers 7–10).",
        "Link the spelling, sound and meaning of familiar words, noticing silent and special letters (h, ll, ñ) and the upside-down ¿ and ¡ marks.",
      ],
      note: {
        title: "Year 3: ¡Hola! Saying hello and introducing yourself",
        body: `## What you need to know

Spanish speakers greet each other all day long. Learn these words and you can start a conversation!

| Español | English |
| --- | --- |
| hola | hello / hi |
| buenos días | good morning |
| buenas tardes | good afternoon |
| buenas noches | good evening / good night |
| adiós | goodbye |
| hasta luego | see you later |
| hasta mañana | see you tomorrow |
| por favor | please |
| gracias | thank you |
| sí / no | yes / no |
| ¿Cómo te llamas? | What are you called? (What's your name?) |
| Me llamo … | I am called … (My name is …) |
| ¿Cómo estás? | How are you? |
| Estoy bien / mal / regular | I'm fine / not well / so-so |
| ¿Cuántos años tienes? | How old are you? |
| Tengo … años | I am … years old (literally "I have … years") |
| siete, ocho, nueve, diez | 7, 8, 9, 10 |

## Model sentences

- ¡Buenas tardes! Me llamo Lucía.
- ¿Cómo te llamas? – Me llamo Pablo. ¿Cómo estás? – Estoy regular, gracias.
- Tengo diez años. ¡Hasta luego!

## Sound tip

Spanish vowels are always the same: **a** "ah", **e** "eh", **i** "ee", **o** "oh", **u** "oo". The letter **h** is **silent**, so *hola* sounds like "OH-la". **ll** sounds like the y in "yes": *me llamo* is "meh YA-mo". Questions and exclamations start with an upside-down mark: **¿Cómo estás?** and **¡Hola!**

## Common mistakes

- Forgetting the first mark: write **¿Cómo te llamas?**, not *Cómo te llamas?*
- Saying your age with *estoy*. Spanish uses **tener** (to have): **tengo** ocho años.
- Writing *yo llamo*. Say **me llamo**.`,
      },
      quiz: {
        title: "Greetings & Introductions: Year 3 quiz",
        questions: [
          q.single("What does 'buenos días' mean?", "Good morning", ["Good night", "Goodbye", "Please"], "Buenos días is the greeting you use in the morning: 'good days'.", 1),
          q.single("How do you say 'goodbye' in Spanish?", "adiós", ["hola", "gracias", "por favor"], "Adiós means goodbye. Hola is hello, gracias is thank you and por favor is please.", 1),
          q.short("Write 'thank you' in Spanish (one word).", "gracias", "Gracias is the Spanish word for thank you; it ends in -s but has no accent.", 1),
          q.single("Which sentence means 'My name is Carla'?", "Me llamo Carla.", ["Te llamas Carla.", "Estoy Carla.", "Tengo Carla."], "Me llamo means 'I am called'. Te llamas is 'you are called', and estoy and tengo mean 'I am' (feeling or place) and 'I have'.", 2, true),
          q.single("What does '¿Cuántos años tienes?' ask?", "How old are you?", ["What is your name?", "How are you?", "What is your favourite colour?"], "Cuántos años means 'how many years' and tienes is 'you have': it asks your age.", 2),
          q.short("Say 'I am nine years old' in Spanish.", "Tengo nueve años.", "Spanish uses tener for age: tengo (I have) + number + años.", 2, { diag: true, acc: ["Yo tengo nueve años.", "Tengo 9 años.", "Yo tengo 9 años."] }),
          q.multi("Which of these are ways of saying goodbye? Choose all that apply.", ["adiós", "hasta luego", "hasta mañana"], ["hola", "por favor"], "Adiós, hasta luego and hasta mañana all end a conversation. Hola means hello and por favor means please.", 2),
          q.single("Which letter is silent in the word 'hola'?", "h", ["l", "a", "o"], "In Spanish the letter h is never pronounced, so hola sounds like 'OH-la'.", 2),
          q.single("Which is the correct way to write 'How are you?' to a friend?", "¿Cómo estás?", ["Cómo estás?", "¿Como estás?", "¿Cómo estás¿"], "A Spanish question starts with ¿ and ends with ?, and cómo in a question has an accent.", 3),
          q.short("Write in Spanish: 'I am called Diego and I am eight years old.'", "Me llamo Diego y tengo ocho años.", "Use me llamo for your name, y for 'and', and tengo + number + años for your age.", 3, { acc: ["Yo me llamo Diego y tengo ocho años.", "Soy Diego y tengo ocho años.", "Me llamo Diego y tengo 8 años.", "Yo me llamo Diego y yo tengo ocho años."] }),
        ],
      },
      flashcards: cards([
        ["hola", "hello / hi"],
        ["Good morning (Spanish)", "buenos días"],
        ["buenas tardes", "good afternoon"],
        ["Goodbye (Spanish)", "adiós"],
        ["¿Cómo te llamas?", "What are you called? (What's your name?)"],
        ["Me llamo …", "My name is … (literally 'I am called')"],
        ["How are you? (Spanish)", "¿Cómo estás?"],
        ["¿Cuántos años tienes?", "How old are you?"],
        ["I am 10 years old (Spanish)", "Tengo diez años. (tener = to have)"],
        ["Which letter is silent in Spanish?", "h (hola is 'OH-la')"],
      ]),
    },
  },
};
