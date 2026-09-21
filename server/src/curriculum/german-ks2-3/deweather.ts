// German — Weather, Clothes & Body (Year 6). Original content aligned to the DfE KS2 foreign languages programme of study (OGL v3.0).
import type { CTopic } from "../types";
import { qb, cards } from "./_h";

const q6 = qb("deweather", 6);

export const TOPIC: CTopic = {
  key: "deweather",
  topic: "Weather, Clothes & Body",
  subject: "German",
  years: {
    6: {
      year: 6,
      objectives: [
        "Describe the weather with Es regnet, Es schneit, Die Sonne scheint, Es ist kalt …",
        "Name common clothes with the right article and say what you wear with ich trage.",
        "Name parts of the body and say that something hurts with … tut weh.",
        "Recognise how plural nouns such as Schuhe and Handschuhe are used.",
      ],
      note: {
        title: "Year 6: Wetter, Kleidung und Körper",
        body: `## Weather (Wie ist das Wetter?)

Es regnet (it is raining) · Es schneit (it is snowing) · Die Sonne scheint (the sun is shining) · Es ist windig / neblig / bewölkt (windy / foggy / cloudy) · Es ist kalt / warm / heiß (cold / warm / hot) · Es ist sonnig (sunny).

## Clothes

| German | English |
| --- | --- |
| der Pullover / der Mantel | jumper / coat |
| die Jacke / die Hose | jacket / trousers |
| das T-Shirt / das Kleid | T-shirt / dress |
| der Rock / der Schal | skirt / scarf |
| die Mütze / der Hut | woolly hat / hat |
| die Schuhe / die Socken (plural) | shoes / socks |
| die Handschuhe (plural) | gloves |

Say **Ich trage** + ein-word: *einen* Rock (der), *eine* Hose (die), *ein* Kleid (das). Plural words need no ein-word: *Ich trage Socken.*

## The body

der Kopf (head) · das Auge (eye) · das Ohr (ear) · die Nase (nose) · der Mund (mouth) · der Arm (arm) · die Hand (hand) · der Bauch (tummy) · das Bein (leg) · der Fuß (foot). To say something hurts: **Mein Bein tut weh.**

## Model sentences

- Es ist windig und kalt. Ich trage einen Pullover.
- Im Sommer scheint die Sonne und ich trage ein T-Shirt.
- Meine Hand tut weh.

## Sound tip

**sch** is "sh" (*Schuhe*, *Schal*); **st**/**sp** at the start of a word say "sht"/"shp"; **ö** in *Körper* is a rounded "ay"; **ü** in *Mütze* is a rounded "ee"; **z** is "ts" (*Mütze* = "MÜT-suh"); **w** is "v" (*Wetter* = "VET-er").

## Common mistakes

- Using the wrong article: **die** Hose, **der** Rock, **das** Kleid. Learn each word with its article.
- Adding an ein-word to plurals: not "eine Socken" but just *Socken*.
- Writing **Es regnet** without *es*: German needs a subject word, so it is always *es regnet*.`,
      },
      quiz: {
        title: "Weather, Clothes & Body: Year 6 quiz",
        questions: [
          q6.single("What does 'Es regnet' mean?", "It is raining.", ["It is snowing.", "It is windy.", "It is foggy."], "Regnen is to rain, so es regnet means it is raining.", 1),
          q6.single("What does 'Die Sonne scheint' mean?", "The sun is shining.", ["The sun is hot.", "The sun is setting.", "It is cloudy."], "Scheinen means to shine, so die Sonne scheint is the sun shines.", 1),
          q6.single("What does 'die Jacke' mean?", "jacket", ["jumper", "coat", "skirt"], "Die Jacke is a jacket. Der Mantel is a coat.", 1),
          q6.single("Which phrase means 'It is snowing'?", "Es schneit.", ["Es regnet.", "Es ist neblig.", "Es ist windig."], "Schnee is snow and es schneit means it is snowing.", 2, true),
          q6.short("Write 'the shoes' in German (they are plural).", "die Schuhe", "Schuhe is plural, and the plural article is die.", 2, { acc: ["Schuhe"] }),
          q6.short("Complete: Ich ____ eine Jacke. (I am wearing a jacket.)", "trage", "The verb is tragen (to wear, to carry), and with ich it becomes trage.", 2, { diag: true }),
          q6.single("What does 'Mein Kopf tut weh' mean?", "My head hurts.", ["My head is hot.", "I have a hat on.", "My head is big."], "Tut weh means hurts, and Kopf is head.", 2),
          q6.multi("Which of these are clothes? Choose all that apply.", ["der Pullover", "der Rock", "die Hose"], ["die Nase", "der Arm"], "A jumper, a skirt and trousers are clothes. Nose and arm are parts of the body.", 3),
          q6.single("Which article goes with 'Mütze' (woolly hat)?", "die", ["der", "das", "den"], "Mütze is a feminine noun, so its article is die: die Mütze.", 2),
          q6.single("'Es ist kalt und es schneit. Ich trage einen Mantel, einen Schal und eine Mütze.' Which item is NOT mentioned?", "gloves", ["a coat", "a scarf", "a woolly hat"], "The writer wears a coat (Mantel), a scarf (Schal) and a hat (Mütze), but no gloves (Handschuhe).", 3),
        ],
      },
      flashcards: cards([
        ["Es schneit.", "It is snowing."],
        ["windy", "Es ist windig."],
        ["der Mantel", "coat"],
        ["skirt", "der Rock"],
        ["die Hose", "trousers"],
        ["die Socken", "socks (plural)"],
        ["die Nase", "nose"],
        ["foot", "der Fuß"],
        ["Ich trage einen Schal.", "I am wearing a scarf."],
        ["My arm hurts.", "Mein Arm tut weh."],
      ]),
    },
  },
};
