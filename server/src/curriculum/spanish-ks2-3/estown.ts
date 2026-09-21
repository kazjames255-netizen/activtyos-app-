// Spanish — Town & Directions (Year 6). Original content aligned to the DfE KS2 foreign languages programme of study (OGL v3.0).
import type { CTopic } from "../types";
import { qb, cards } from "./_h";

const q = qb("estown", 6);

export const TOPIC: CTopic = {
  key: "estown",
  topic: "Town & Directions",
  subject: "Spanish",
  years: {
    6: {
      year: 6,
      objectives: [
        "Name places in a town and say where they are with está and hay.",
        "Use position words: al lado de, enfrente de, cerca de, lejos de, detrás de, entre.",
        "Ask for and give simple directions (sigue todo recto, gira a la derecha / izquierda).",
        "Use del (de + el) and al (a + el) correctly.",
      ],
      note: {
        title: "Year 6: En la ciudad",
        body: `## What you need to know

| Español | English | Español | English |
| --- | --- | --- | --- |
| la ciudad | city | el cine | cinema |
| el pueblo | town / village | la piscina | swimming pool |
| la calle | street | la estación | station |
| la plaza | square | el museo | museum |
| el parque | park | la iglesia | church |
| el banco | bank | el mercado | market |
| el colegio | school | el ayuntamiento | town hall |
| el supermercado | supermarket | la biblioteca | library (not a bookshop!) |

**Where is it?** *¿Dónde está la piscina?* → *Está …* Use **está** for a particular place and **hay** to say something exists (*¿Hay un banco por aquí?* – Is there a bank around here?).

**Position words:** al lado de (next to), enfrente de (opposite), cerca de (near), lejos de (far from), detrás de (behind), entre … y … (between … and …).

**Directions:** sigue todo recto (go straight on), gira a la derecha / a la izquierda (turn right / left), cruza la plaza (cross the square), la primera / la segunda calle (the first / second street).

**Small words join up:** de + el = **del**, a + el = **al**. *Al lado del cine*, but *al lado de la iglesia*.

## Model sentences

- ¿Dónde está la piscina, por favor?
- Sigue todo recto y gira a la izquierda.
- El museo está al lado del cine.

## Sound tip

**g** before i or e is a throaty h: *gira* is "HEE-ra". **qu** is a k sound: *izquierda* is "eeth-KYER-da". **ll** is like y: *calle* is "KA-yeh". The **h** in *hay* is silent: *hay* sounds like the English word "eye".

## Common mistakes

- Writing *de el* or *a el*. Say **del** and **al**.
- Thinking *biblioteca* is a bookshop. A bookshop is a *librería*.
- Saying *hay* for a place you already know about. Use **está**: *el banco está aquí*.`,
      },
      quiz: {
        title: "Town & Directions: Year 6 quiz",
        questions: [
          q.single("What does 'la biblioteca' mean?", "the library", ["the bookshop", "the school", "the museum"], "Biblioteca is library. It is a false friend of 'bible' and bookshop.", 1),
          q.single("What does 'a la derecha' mean?", "to the right", ["to the left", "straight on", "opposite"], "Derecha is right and izquierda is left.", 1),
          q.short("Write 'the cinema' in Spanish.", "el cine", "Cine is cinema and is masculine: el cine.", 1, { acc: ["cine"] }),
          q.single("Which means 'Go straight on'?", "Sigue todo recto.", ["Gira a la derecha.", "Gira a la izquierda.", "Cruza la plaza."], "Sigue todo recto means keep going straight. Gira means turn and cruza means cross.", 2, true),
          q.single("What does 'detrás de' mean?", "behind", ["in front of", "next to", "opposite"], "Detrás de means behind. Enfrente de means opposite and al lado de means next to.", 2),
          q.short("Complete: El parque está ___ del colegio. (near)", "cerca", "Cerca de means near, and de + el makes del.", 2, { diag: true }),
          q.multi("Which of these are directions? Choose all that apply.", ["todo recto", "a la izquierda", "a la derecha"], ["el banco", "el mercado"], "Todo recto, a la izquierda and a la derecha tell you where to go. Banco and mercado are places.", 2),
          q.single("¿Dónde está el supermercado? – Está lejos. What does the answer mean?", "It is far away.", ["It is near.", "It is opposite.", "It is next to the market."], "Lejos means far, and cerca means near.", 2),
          q.single("Which sentence means 'The bank is opposite the school'?", "El banco está enfrente del colegio.", ["El banco está enfrente de el colegio.", "El banco está en frente al colegio.", "El banco hay enfrente del colegio."], "Enfrente de + el becomes enfrente del, and está tells you where the bank is.", 3),
          q.single("Read: 'Desde el colegio, gira a la derecha y sigue todo recto. El cine está a la izquierda, entre el banco y el parque.' Where is the cinema?", "On the left, between the bank and the park.", ["On the right, between the bank and the park.", "On the left, opposite the park.", "On the right, next to the school."], "After turning right and going straight, the cinema is a la izquierda (on the left) and entre el banco y el parque (between the bank and the park).", 3),
        ],
      },
      flashcards: cards([
        ["la ciudad / el pueblo", "city / town or village"],
        ["swimming pool (Spanish)", "la piscina"],
        ["la estación", "station"],
        ["Where is …? (Spanish)", "¿Dónde está …?"],
        ["al lado de", "next to"],
        ["lejos de", "far from"],
        ["enfrente de", "opposite"],
        ["Turn left (Spanish)", "Gira a la izquierda."],
        ["de + el", "del (al lado del cine)"],
        ["¿Hay un banco por aquí?", "Is there a bank around here?"],
      ]),
    },
  },
};
