// Spanish — School Life (Year 7). Original content aligned to the DfE KS3 modern foreign languages programme of study (OGL v3.0).
import type { CTopic } from "../types";
import { qb, cards } from "./_h";

const q = qb("essl", 7);

export const TOPIC: CTopic = {
  key: "essl",
  topic: "School Life",
  subject: "Spanish",
  years: {
    7: {
      year: 7,
      objectives: [
        "Name school subjects and give opinions with reasons (porque + adjective).",
        "Tell the time and say when lessons and breaks happen.",
        "Describe the school day and uniform.",
        "Make adjectives agree with the subject they describe.",
      ],
      note: {
        title: "Year 7: La vida escolar",
        body: `## What you need to know

| Asignatura | English | Opinión | English |
| --- | --- | --- | --- |
| el dibujo | art | fácil | easy |
| las matemáticas | maths | difícil | difficult |
| el inglés / el francés | English / French | aburrido / aburrida | boring |
| las ciencias | science | interesante | interesting |
| la informática | ICT / computing | útil | useful |
| la historia | history | divertido / divertida | fun |
| la geografía | geography | práctico / práctica | practical |
| la educación física | PE | | |
| el teatro | drama | | |

**Give opinions with a reason:** *Mi asignatura favorita es … porque es …* The adjective agrees with the subject: *la historia es aburrida* (feminine), *el teatro es divertido* (masculine), *las matemáticas son útiles* (plural).

**Telling the time:** *Es la una* (one o'clock) but *Son las dos, las tres …*. Add **y cuarto** (quarter past), **y media** (half past), **menos cuarto** (quarter to). *A las nueve* = at nine o'clock.

**School day:** *empezar* (to start): *el instituto empieza a las ocho y media*. *el recreo* (break), *el almuerzo* (lunch).

**Uniform:** la camisa (shirt), la corbata (tie), el jersey, la falda, los pantalones, los zapatos.

## Model sentences

- Mi asignatura favorita es el dibujo porque es divertido.
- Son las tres y cuarto. El recreo es a las once.
- Llevo una camisa blanca y una corbata azul.

## Sound tip

**ll** in *llevo* is like y. **j** in *dibujo* is a throaty h. **ch** is like church: *mochila*. **c** before e or i is "th" in Spain: *ciencias* is "THYEN-thyas". Stress the accent: *informática*, *matemáticas*, *útil*.

## Common mistakes

- Saying *Es las tres*. Use **Son** las tres, but **Es** la una.
- Forgetting agreement: *la historia es aburrido* is wrong, say **aburrida**.
- Using *porque* (because) for a question: questions use **por qué** (why).`,
      },
      quiz: {
        title: "School Life: Year 7 quiz",
        questions: [
          q.single("What does 'el dibujo' mean?", "art / drawing", ["drama", "history", "maths"], "El dibujo is drawing or art lessons.", 1),
          q.single("What does 'aburrido' mean?", "boring", ["easy", "useful", "difficult"], "Aburrido is boring, and it is related to the verb aburrirse (to get bored).", 1),
          q.short("Write 'because' in Spanish (one word).", "porque", "Porque means because. It is one word, without an accent.", 1),
          q.single("What does 'Son las ocho y media' mean?", "It is half past eight.", ["It is half past nine.", "It is quarter past eight.", "It is twenty to eight."], "Son las ocho = it is eight o'clock, and y media adds half an hour.", 2, true),
          q.single("How do you say 'It is one o'clock'?", "Es la una.", ["Son la una.", "Es las una.", "Son las una."], "One o'clock is singular (la una), so use es. From two o'clock use son las.", 2),
          q.short("Say in Spanish: 'My favourite subject is computing.'", "Mi asignatura favorita es la informática.", "Mi asignatura favorita es + the subject with its article: la informática (feminine, accent on the á).", 2, { diag: true, acc: ["Mi asignatura preferida es la informática.", "Mi materia favorita es la informática.", "Mi materia preferida es la informática."] }),
          q.multi("Which of these are opinions about a lesson? Choose all that apply.", ["fácil", "útil", "interesante"], ["el lunes", "la corbata"], "Fácil, útil and interesante are adjectives that give an opinion. El lunes is a day and la corbata is a tie.", 2),
          q.single("What is 'la corbata' in a school uniform?", "the tie", ["the shirt", "the skirt", "the shoes"], "La corbata is the tie. La camisa is the shirt.", 2),
          q.single("Complete: Las ciencias son ___.", "interesantes", ["interesante", "interesanta", "interesantas"], "Las ciencias is plural, so the adjective takes -s: interesantes (interesante is the same for masculine and feminine).", 3),
          q.short("Say in Spanish: 'The lessons begin at nine o'clock.'", "Las clases empiezan a las nueve.", "Las clases is plural so use empiezan (they begin), then a las nueve for 'at nine o'clock'.", 3, { acc: ["Las clases comienzan a las nueve.", "Las clases empiezan a las 9."] }),
        ],
      },
      flashcards: cards([
        ["las matemáticas", "maths"],
        ["ICT / computing (Spanish)", "la informática"],
        ["la educación física", "PE"],
        ["fácil / difícil", "easy / difficult"],
        ["useful (Spanish)", "útil"],
        ["porque", "because"],
        ["Es la una. / Son las dos.", "It is one o'clock. / It is two o'clock."],
        ["y cuarto / y media / menos cuarto", "quarter past / half past / quarter to"],
        ["el recreo", "break"],
        ["la corbata / la camisa", "tie / shirt"],
      ]),
    },
  },
};
