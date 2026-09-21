// French — Numbers, Colours & Days (Year 3). Original content aligned to the DfE KS2 foreign languages programme of study (OGL v3.0).
import type { CTopic } from "../types";
import { qb, cards } from "./_h";

const q3 = qb("frnum", 3);

export const TOPIC: CTopic = {
  key: "frnum",
  topic: "Numbers, Colours & Days",
  subject: "French",
  years: {
    3: {
      year: 3,
      objectives: [
        "Count from 1 to 12 in French and recognise the written number words.",
        "Name the main colours and the seven days of the week.",
        "Read and write short phrases using numbers, colours and days.",
        "Notice that French days of the week are written without a capital letter.",
      ],
      note: {
        title: "Year 3: numbers 1–12, colours and days of the week",
        body: `## Numbers 1 to 12

| 1 un | 2 deux | 3 trois | 4 quatre |
| --- | --- | --- | --- |
| 5 cinq | 6 six | 7 sept | 8 huit |
| 9 neuf | 10 dix | 11 onze | 12 douze |

## Colours (les couleurs)

rouge (red), bleu (blue), vert (green), jaune (yellow), noir (black), blanc (white), rose (pink), orange (orange), gris (grey), marron (brown).

## Days of the week (les jours de la semaine)

lundi (Monday), mardi (Tuesday), mercredi (Wednesday), jeudi (Thursday), vendredi (Friday), samedi (Saturday), dimanche (Sunday).

Days of the week have **no capital letter** in French, unless they start a sentence.

## Model sentences

- J'ai trois stylos. (I have three pens.)
- Le ballon est rouge. (The ball is red.)
- Aujourd'hui, c'est mardi. (Today it is Tuesday.)

## Sound tips

The end of **six**, **dix** and **huit** is said differently on its own: *six* sounds like "seess", *dix* like "deess", *huit* like "weet". The **-ent** and **-s** at the end of many words are silent. **Trois** sounds like "twah" and **cinq** like "sank".

## Common mistakes

- Writing *Lundi* with a capital L in the middle of a sentence.
- Mixing up **sept** (7) and **cinq** (5), or **huit** (8) and **dix** (10).
- Spelling **quatre** as *quatr* or *catre*.`,
      },
      quiz: {
        title: "Numbers, Colours & Days: Year 3 quiz",
        questions: [
          q3.single("What number is 'cinq'?", "5", ["4", "7", "12"], "Cinq is 5. Say it 'sank'.", 1),
          q3.single("What number is 'sept'?", "7", ["6", "8", "17"], "Sept is 7. The p is silent, so it sounds like 'set'.", 1),
          q3.single("Which French word means 'blue'?", "bleu", ["rouge", "vert", "jaune"], "Bleu is blue. Rouge is red, vert is green and jaune is yellow.", 1),
          q3.single("Which word does NOT belong in this list of colours?", "lundi", ["rouge", "jaune", "vert"], "Rouge, jaune and vert are colours. Lundi is a day of the week (Monday).", 3),
          q3.single("Which day of the week is 'mercredi'?", "Wednesday", ["Monday", "Tuesday", "Thursday"], "Mercredi is the middle of the school week: Wednesday.", 2, true),
          q3.single("Which day comes between jeudi and samedi?", "vendredi", ["mercredi", "dimanche", "mardi"], "The order is jeudi (Thursday), vendredi (Friday), samedi (Saturday).", 2),
          q3.short("Write the number 6 in French.", "six", "Six is the French word for 6.", 2, { na: true }),
          q3.short("Write 'yellow' in French.", "jaune", "Jaune means yellow. Say it 'zhone'.", 2, { na: true, diag: true }),
          q3.multi("Which TWO days are at the weekend?", ["samedi", "dimanche"], ["jeudi", "mardi"], "Samedi is Saturday and dimanche is Sunday, the weekend days.", 2),
          q3.single("Which number is the answer to: quatre + cinq?", "neuf", ["huit", "dix", "sept"], "4 + 5 = 9, and 9 in French is neuf.", 3),
        ],
      },
      flashcards: cards([
        ["un, deux, trois", "1, 2, 3"],
        ["7", "sept"],
        ["huit", "8"],
        ["10", "dix"],
        ["douze", "12"],
        ["red", "rouge"],
        ["vert", "green"],
        ["black", "noir"],
        ["mardi", "Tuesday"],
        ["Sunday", "dimanche"],
      ]),
    },
  },
};
