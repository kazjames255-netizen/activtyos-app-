// Spanish — School & Classroom (Year 4). Original content aligned to the DfE KS2 foreign languages programme of study (OGL v3.0).
import type { CTopic } from "../types";
import { qb, cards } from "./_h";

const q = qb("esschool", 4);

export const TOPIC: CTopic = {
  key: "esschool",
  topic: "School & Classroom",
  subject: "Spanish",
  years: {
    4: {
      year: 4,
      objectives: [
        "Name classroom objects and school subjects with the correct el/la.",
        "Say what there is with hay and give an opinion with me gusta / no me gusta.",
        "Understand and follow simple classroom instructions.",
        "Notice that some Spanish nouns are plural where English is singular (las matemáticas).",
      ],
      note: {
        title: "Year 4: En el colegio",
        body: `## What you need to know

| Español | English | Español | English |
| --- | --- | --- | --- |
| el lápiz | pencil | las matemáticas | maths |
| el bolígrafo | pen | el inglés | English |
| la goma | rubber | las ciencias | science |
| la regla | ruler | la historia | history |
| el libro | book | la geografía | geography |
| el cuaderno | exercise book | el arte | art |
| la mochila | school bag | la educación física | PE |
| el estuche | pencil case | la música | music |
| la mesa / la silla | table / chair | el profesor / la profesora | teacher |
| la pizarra | board | | |

**Say what there is:** **hay** means both "there is" and "there are": *hay un libro*, *hay tres libros*. **Give an opinion:** *me gusta* + a singular noun and its el/la: *me gusta el arte*, *no me gusta la geografía*.

**Classroom words:** *abre el libro* (open your book), *cierra el cuaderno* (close your exercise book), *escucha* (listen), *mira la pizarra* (look at the board), *silencio, por favor* (silence, please).

## Model sentences

- En mi mochila hay un cuaderno y una regla.
- Me gusta el arte pero no me gusta la geografía.
- Mi profesora se llama Elena.

## Sound tip

**ch** is like the ch in "church": *mochila*. **ll** is like y in "yes": *silla*. Say the **g** in *goma* like the g in "go". Put the stress on the accent: *lápiz* is "LA-pith" (or "LA-pees"), *bolígrafo* is "bo-LEE-gra-fo".

## Common mistakes

- *Las matemáticas* and *las ciencias* are **plural** in Spanish.
- **el lápiz** is masculine even though it ends in z. The plural is **los lápices**.
- Don't write *hay* for "he/she has". Hay is only for "there is/are".`,
      },
      quiz: {
        title: "School & Classroom: Year 4 quiz",
        questions: [
          q.single("What is 'la regla'?", "the ruler", ["the rubber", "the pencil case", "the school bag"], "Regla is ruler, goma is rubber, estuche is pencil case and mochila is school bag.", 1),
          q.single("What does 'la mochila' mean?", "school bag / rucksack", ["pencil case", "exercise book", "chair"], "Mochila is a bag for carrying your books, a rucksack.", 1),
          q.short("Write 'pen' in Spanish (one word).", "bolígrafo", "A pen is a bolígrafo; the accent is on the í.", 1, { acc: ["el bolígrafo"] }),
          q.single("Which sentence means 'I like music'?", "Me gusta la música.", ["No me gusta la música.", "Me gusta el música.", "Te gusta la música."], "Me gusta = I like. Música is feminine so it takes la. No me gusta would mean 'I don't like'.", 2, true),
          q.single("Which subject is 'la educación física'?", "PE", ["science", "music", "history"], "Educación física means physical education, or PE.", 2),
          q.short("Complete: En mi estuche ___ dos lápices. (there are)", "hay", "Hay means both 'there is' and 'there are'.", 2, { diag: true }),
          q.multi("Which of these can you find in a pencil case? Choose all that apply.", ["el lápiz", "la regla", "la goma"], ["la silla", "la pizarra"], "A pencil, a ruler and a rubber fit in an estuche. Chairs and boards do not.", 2),
          q.single("Your teacher says 'Abre el libro.' What should you do?", "Open your book.", ["Close your book.", "Put your book in your bag.", "Look at the board."], "Abre is the command 'open'. Cierra would mean 'close'.", 2),
          q.single("Which sentence is correct for 'There is a table and two chairs'?", "Hay una mesa y dos sillas.", ["Hay un mesa y dos sillas.", "Hay una mesa y dos silla.", "Hay un mesa y dos silla."], "Mesa is feminine so it takes una, and two or more chairs need a plural: sillas.", 3),
          q.short("Say in Spanish: 'I don't like history.'", "No me gusta la historia.", "Put no before me gusta for 'I don't like', then la historia.", 3),
        ],
      },
      flashcards: cards([
        ["el lápiz", "pencil (plural: los lápices)"],
        ["la goma", "rubber"],
        ["book (Spanish)", "el libro"],
        ["la pizarra", "board"],
        ["el estuche", "pencil case"],
        ["las matemáticas", "maths (plural in Spanish)"],
        ["science (Spanish)", "las ciencias"],
        ["hay", "there is / there are"],
        ["Me gusta el arte.", "I like art."],
        ["Escucha. / Mira la pizarra.", "Listen. / Look at the board."],
      ]),
    },
  },
};
