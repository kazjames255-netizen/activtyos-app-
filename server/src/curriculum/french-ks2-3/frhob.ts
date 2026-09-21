// French — Hobbies & Sports (Year 5). Original content aligned to the DfE KS2 foreign languages programme of study (OGL v3.0).
import type { CTopic } from "../types";
import { qb, cards } from "./_h";

const q5 = qb("frhob", 5);

export const TOPIC: CTopic = {
  key: "frhob",
  topic: "Hobbies & Sports",
  subject: "French",
  years: {
    5: {
      year: 5,
      objectives: [
        "Name common hobbies and sports and say which you like or dislike.",
        "Use j'aime + infinitive (j'aime nager) and jouer à + sport (je joue au football).",
        "Use simple connectives such as et, mais, avec and aussi to build longer sentences.",
        "Read a short text about free-time activities and answer questions about it.",
      ],
      note: {
        title: "Year 5: hobbies and sports",
        body: `## Activities (most verbs end in -er; lire ends in -ire)

| French | English |
| --- | --- |
| nager | to swim |
| danser | to dance |
| chanter | to sing |
| dessiner | to draw |
| lire | to read |
| regarder la télé | to watch TV |
| écouter de la musique | to listen to music |

## Sports

le football (le foot), le tennis, le basket, le rugby, la natation (swimming), le vélo (bike; faire du vélo = to go cycling).

## Saying what you like doing

**J'aime** + infinitive (-er, or -ire for lire): **J'aime nager.** (I like swimming.) **Je n'aime pas danser.** (I don't like dancing.)

## Playing a sport: jouer à + sport

**à + le** joins to make **au**: **je joue au rugby**, **je joue au basket**.
**à + la** stays **à la**: je joue à la pétanque. **à + les** makes **aux**: je joue aux cartes.

The verb **jouer** changes for each person: **je joue**, **il joue**, **elle joue** (the -e ending is silent).

## Joining words

et (and), mais (but), avec (with), aussi (also).

## Model sentences

- Je joue au rugby avec mes cousins. (I play rugby with my cousins.)
- J'aime lire, mais je n'aime pas dessiner. (I like reading, but I don't like drawing.)
- Elle joue au volley le dimanche. (She plays volleyball on Sundays.)

## Sound tips

*Jouer* sounds like "zhoo-AY". *Natation* is "na-ta-SYON". *Aime* rhymes with "hem".

## Common mistakes

- Saying **je joue le rugby** instead of **je joue au rugby**.
- Changing the second verb after j'aime: say **j'aime nager**, not *j'aime nage*. The second verb stays in its -er form.`,
      },
      quiz: {
        title: "Hobbies & Sports: Year 5 quiz",
        questions: [
          q5.single("What does 'nager' mean?", "to swim", ["to dance", "to read", "to sing"], "Nager means to swim. La natation is swimming as a sport.", 1),
          q5.single("Which French verb means 'to read'?", "lire", ["nager", "chanter", "dessiner"], "Lire is to read. Nager is to swim, chanter is to sing and dessiner is to draw.", 1),
          q5.single("What does 'Je joue au football' mean?", "I play football", ["I like football", "I watch football", "I have a football"], "Je joue means 'I play', and au + a sport names the game.", 1),
          q5.single("What does 'J'aime chanter' mean?", "I like singing", ["I like dancing", "I like swimming", "I sing very well"], "J'aime + a verb means 'I like …ing'. Chanter means to sing.", 2),
          q5.single("Choose the right word: 'Je joue ___ tennis.'", "au", ["à la", "aux", "le"], "Tennis is masculine, and à + le becomes au.", 2, true),
          q5.single("Which sentence means 'She plays basketball'?", "Elle joue au basket.", ["Elle joue le basket.", "Elle jouer au basket.", "Elle joue à basket."], "Use elle joue (not jouer) and au before a masculine sport.", 3),
          q5.short("Write 'to draw' in French.", "dessiner", "Dessiner means to draw, as in un dessin (a drawing).", 2, { na: true, diag: true }),
          q5.short("Write 'I swim' in French.", "je nage", "Take nager, remove -er and add -e for je: je nage.", 2, { na: true }),
          q5.multi("Which of these are sports? Choose all that apply.", ["le football", "le tennis", "la natation"], ["dessiner", "chanter"], "Le football, le tennis and la natation are sports. Dessiner and chanter are activities (verbs).", 2),
          q5.single("'Le samedi, je joue au basket avec mon frère. Le dimanche, j'aime nager, mais je n'aime pas danser.' Which activity does the speaker NOT like?", "dancing", ["swimming", "playing basketball", "drawing"], "Je n'aime pas danser means 'I don't like dancing'.", 3),
        ],
      },
      flashcards: cards([
        ["danser", "to dance"],
        ["to sing", "chanter"],
        ["lire", "to read"],
        ["to draw", "dessiner"],
        ["Je joue au tennis.", "I play tennis."],
        ["I like swimming.", "J'aime nager."],
        ["mais", "but"],
        ["with", "avec"],
        ["la natation", "swimming (the sport)"],
        ["the bike (faire du vélo = to go cycling)", "le vélo"],
      ]),
    },
  },
};
