// Spanish — Numbers, Colours & Days (Year 3). Original content aligned to the DfE KS2 foreign languages programme of study (OGL v3.0).
import type { CTopic } from "../types";
import { qb, cards } from "./_h";

const q = qb("esnum", 3);

export const TOPIC: CTopic = {
  key: "esnum",
  topic: "Numbers, Colours & Days",
  subject: "Spanish",
  years: {
    3: {
      year: 3,
      objectives: [
        "Count from 1 to 20 and say simple sums in Spanish.",
        "Name common colours and place them after the noun (un lápiz rojo).",
        "Say the days of the week, which are written with a small letter, and say 'on Monday' with el.",
        "Recognise how accents and special letters change spelling and sound.",
      ],
      note: {
        title: "Year 3: Numbers, colours and days",
        body: `## What you need to know

**Numbers 1–20:** uno, dos, tres, cuatro, cinco, seis, siete, ocho, nueve, diez, once, doce, trece, catorce, quince, dieciséis, diecisiete, dieciocho, diecinueve, veinte.

| Color | English | Día | English |
| --- | --- | --- | --- |
| rojo | red | lunes | Monday |
| azul | blue | martes | Tuesday |
| verde | green | miércoles | Wednesday |
| amarillo | yellow | jueves | Thursday |
| naranja | orange | viernes | Friday |
| negro | black | sábado | Saturday |
| blanco | white | domingo | Sunday |
| rosa | pink | | |
| gris | grey | | |
| marrón | brown | | |

## Little rules

- Days of the week have a **small letter**: *el lunes*, not *el Lunes*.
- **el lunes** means "on Monday"; **los sábados** means "on Saturdays".
- Colours usually come **after** the noun: *una mochila azul* (a blue bag), *un gato negro* (a black cat).
- Sums: **más** is plus, **menos** is minus, **son** means "makes": *dos más tres son cinco*.

## Model sentences

- Tengo un lápiz verde y una goma blanca.
- Hoy es sábado. Mañana es domingo.
- El martes hay tres perros en el parque.

## Sound tip

**j** is a strong throaty h: *jueves* is "HWEH-ves". **z** and **c** before e or i sound like "th" in most of Spain and like "s" in Latin America: *cinco*, *doce*, *trece*. Watch the accents: *dieciséis*, *miércoles*, *sábado* and *marrón*.

## Common mistakes

- Putting the colour before the noun (*un rojo lápiz*).
- Writing days with a capital letter, as English does.
- Forgetting the accent on **dieciséis**, **miércoles** and **sábado**.`,
      },
      quiz: {
        title: "Numbers, Colours & Days: Year 3 quiz",
        questions: [
          q.single("What number is 'cinco'?", "5", ["6", "4", "15"], "Cinco is five. Quince (15) looks similar but is longer.", 1),
          q.single("What colour is 'verde'?", "green", ["red", "blue", "yellow"], "Verde means green, like the English word 'verdant'.", 1),
          q.short("Write 'Tuesday' in Spanish (small letter, one word).", "martes", "Tuesday is martes. Days of the week start with a small letter in Spanish.", 1),
          q.single("Which day comes after 'jueves'?", "viernes", ["miércoles", "sábado", "martes"], "The order is lunes, martes, miércoles, jueves, viernes: after Thursday comes Friday.", 2, true),
          q.short("Write the number 16 in Spanish.", "dieciséis", "Sixteen is dieciséis (diez + y + seis joined together, with an accent on the e).", 2, { diag: true }),
          q.single("How do you say 'a red pencil' in Spanish?", "un lápiz rojo", ["un rojo lápiz", "rojo un lápiz", "un lápiz el rojo"], "In Spanish the colour usually goes after the noun: un lápiz rojo.", 2),
          q.multi("Which of these are days of the week? Choose all that apply.", ["lunes", "sábado", "domingo"], ["naranja", "once"], "Lunes, sábado and domingo are days. Naranja is a colour and once is the number 11.", 2),
          q.single("What does 'negro y blanco' mean?", "black and white", ["white and black", "grey and brown", "blue and white"], "Negro is black, y is 'and', blanco is white. The order stays the same as in the Spanish.", 2),
          q.single("Which means 'on Friday'?", "el viernes", ["en viernes", "viernes el", "a viernes"], "Use el before a day to say 'on' that day: el viernes.", 3),
          q.short("Write the answer in Spanish words: seis más doce son …", "dieciocho", "6 + 12 = 18, which is dieciocho.", 3),
        ],
      },
      flashcards: cards([
        ["cinco", "5"],
        ["quince", "15"],
        ["20 (Spanish)", "veinte"],
        ["rojo / azul / verde", "red / blue / green"],
        ["yellow, black, white (Spanish)", "amarillo, negro, blanco"],
        ["lunes, martes, miércoles", "Monday, Tuesday, Wednesday"],
        ["Saturday, Sunday (Spanish)", "sábado, domingo"],
        ["el lunes", "on Monday"],
        ["Where does the colour go? (un gato negro)", "After the noun."],
        ["Do days have a capital letter?", "No. Small letter: el jueves."],
      ]),
    },
  },
};
