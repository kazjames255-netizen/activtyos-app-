// Spanish — Weather, Clothes & Body (Year 6). Original content aligned to the DfE KS2 foreign languages programme of study (OGL v3.0).
import type { CTopic } from "../types";
import { qb, cards } from "./_h";

const q = qb("esweather", 6);

export const TOPIC: CTopic = {
  key: "esweather",
  topic: "Weather, Clothes & Body",
  subject: "Spanish",
  years: {
    6: {
      year: 6,
      objectives: [
        "Describe the weather with hace, hay, llueve, nieva and está nublado.",
        "Name common clothes and say what you wear with llevo.",
        "Name parts of the body and say what hurts with me duele / me duelen.",
        "Notice how Spanish weather phrases use hacer (to do/make) and haber.",
      ],
      note: {
        title: "Year 6: El tiempo, la ropa y el cuerpo",
        body: `## What you need to know

**Weather – ¿Qué tiempo hace?** *Hace sol* (it's sunny), *hace calor* (hot), *hace frío* (cold), *hace viento* (windy), *hace buen / mal tiempo* (good / bad weather), *llueve* (it rains), *nieva* (it snows), *hay niebla* (foggy), *hay tormenta* (stormy), *está nublado* (cloudy).

| Ropa | English | Cuerpo | English |
| --- | --- | --- | --- |
| la camiseta | T-shirt | la cabeza | head |
| los pantalones | trousers | el ojo (los ojos) | eye (eyes) |
| la falda | skirt | la nariz | nose |
| el vestido | dress | la boca | mouth |
| el jersey | jumper | la oreja | ear |
| el abrigo | coat | el brazo | arm |
| la gorra | cap | la mano | hand |
| los zapatos | shoes | la pierna | leg |
| las botas | boots | el pie | foot |
| los calcetines | socks | el estómago | stomach |
| la bufanda | scarf | | |

**Handy when it rains:** *el paraguas* (umbrella). **What I wear:** *llevo* + clothes. **What hurts:** **me duele** + one part, **me duelen** + several: *me duele el estómago*, *me duelen las piernas*.

## Model sentences

- Hoy hace frío, así que llevo un abrigo y una bufanda.
- En verano hace calor y llevo un vestido y una gorra.
- Me duele el estómago y me duelen las piernas.

## Sound tip

**ll** is like y: *llueve* is "YWEH-veh". **j** is a throaty h: *ojo* is "O-ho", *jersey* is "her-SAY". **rr** in *gorra* is rolled. Say *nieva* as "NYEH-va".

## Common mistakes

- Using *hay* for sun or heat: it's **hace** sol, **hace** calor, but **hay** niebla.
- **la mano** is feminine even though it ends in -o.
- Using *duele* with a plural: *me duelen los ojos*, not *me duele los ojos*.`,
      },
      quiz: {
        title: "Weather, Clothes & Body: Year 6 quiz",
        questions: [
          q.single("What does 'llueve' mean?", "it is raining", ["it is snowing", "it is windy", "it is sunny"], "Llueve comes from llover, to rain. Nieva is it snows.", 1),
          q.single("What is 'el abrigo'?", "the coat", ["the scarf", "the cap", "the jumper"], "Abrigo is coat. Bufanda is scarf, gorra is cap and jersey is jumper.", 1),
          q.short("Write 'hand' in Spanish (one word).", "mano", "Hand is mano. It ends in -o but is feminine: la mano.", 1, { acc: ["la mano"] }),
          q.single("Which means 'It is sunny'?", "Hace sol.", ["Hace calor.", "Hace viento.", "Hay niebla."], "Hace sol is sunny. Hace calor is hot, hace viento is windy and hay niebla is foggy.", 2, true),
          q.single("Which sentence means 'My head hurts'?", "Me duele la cabeza.", ["Me duelen la cabeza.", "Me duele las cabeza.", "Duele me la cabeza."], "One head, so use duele (singular), then la cabeza.", 2),
          q.short("Complete: Cuando ___, llevo un paraguas. (it rains)", "llueve", "Llueve is the it-rains form of llover.", 2, { diag: true }),
          q.multi("Which of these are clothes? Choose all that apply.", ["la falda", "los calcetines", "la bufanda"], ["la nariz", "la boca"], "Falda, calcetines and bufanda are clothes. Nariz and boca are parts of the body.", 2),
          q.single("What does 'Está nublado' mean?", "It is cloudy.", ["It is foggy.", "It is sunny.", "It is windy."], "Nublado comes from nube, cloud. Está nublado is cloudy.", 2),
          q.single("Read: 'Hoy hace calor y hace sol. Julia lleva una camiseta, una falda y gafas de sol.' What is Julia NOT wearing?", "a coat", ["a skirt", "sunglasses", "a T-shirt"], "The text lists una camiseta (T-shirt), una falda (skirt) and gafas de sol (sunglasses). A coat is not mentioned.", 3),
          q.short("Say in Spanish: 'My feet hurt.'", "Me duelen los pies.", "Pies is plural (two feet), so use me duelen with los pies.", 3),
        ],
      },
      flashcards: cards([
        ["¿Qué tiempo hace?", "What's the weather like?"],
        ["it is hot (Spanish)", "hace calor"],
        ["hace frío", "it is cold"],
        ["it is foggy (Spanish)", "hay niebla"],
        ["la falda", "skirt"],
        ["shoes (Spanish)", "los zapatos"],
        ["Llevo una gorra.", "I am wearing a cap."],
        ["la cabeza / la nariz", "head / nose"],
        ["el pie", "foot"],
        ["Me duelen los ojos.", "My eyes hurt. (plural: duelen)"],
      ]),
    },
  },
};
