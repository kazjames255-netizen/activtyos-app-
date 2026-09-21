// French — Weather, Clothes & Body (Year 6). Original content aligned to the DfE KS2 foreign languages programme of study (OGL v3.0).
// NB: topic key is `frweath` (the validator allows at most 8 characters, so `frweather` is too long).
import type { CTopic } from "../types";
import { qb, cards } from "./_h";

const q6 = qb("frweath", 6);

export const TOPIC: CTopic = {
  key: "frweath",
  topic: "Weather, Clothes & Body",
  subject: "French",
  years: {
    6: {
      year: 6,
      objectives: [
        "Describe the weather using quel temps fait-il ? and il fait … / il pleut / il neige.",
        "Name common items of clothing and say what you are wearing with je porte …",
        "Name parts of the body and say where it hurts using j'ai mal à …",
        "Read short descriptions and match the weather to the clothes people choose.",
      ],
      note: {
        title: "Year 6: weather, clothes and my body",
        body: `## Weather (le temps)

**Quel temps fait-il ?** = What is the weather like?

| French | English |
| --- | --- |
| Il fait chaud. | It's hot. |
| Il fait froid. | It's cold. |
| Il fait beau. | It's nice weather. |
| Il pleut. | It's raining. |
| Il neige. | It's snowing. |
| Il y a du soleil. | It's sunny. |
| Il y a du vent. | It's windy. |

## Clothes (les vêtements)

un pantalon (trousers), une jupe (skirt), une robe (dress), un pull (jumper), un tee-shirt, un manteau (coat), des chaussures (shoes).
**Je porte …** = I am wearing … : **Je porte une jupe et un manteau.**

## Parts of the body (le corps)

la tête (head), le nez (nose), la bouche (mouth), l'oreille (f, ear), le bras (arm), la main (hand), la jambe (leg), le pied (foot).

**J'ai mal à la tête.** (I have a headache.) **J'ai mal au bras.** (My arm hurts.) **à + le = au**.

## Model sentences

- Il pleut, alors je porte un manteau. (It's raining, so I'm wearing a coat.)
- Il fait beau, je porte un tee-shirt. (The weather is nice, I'm wearing a T-shirt.)
- J'ai mal à la jambe. (My leg hurts.)

## Sound tips

*Chaud* sounds like "show"; *pleut* like "pluh"; *neige* like "nezh"; *pantalon* like "pon-ta-LON".

## Common mistakes

- Saying *Il est chaud* for weather: use **il fait** + adjective (il fait beau, il fait froid).
- Saying **j'ai mal à le bras**: à + le always joins to make **au**.`,
      },
      quiz: {
        title: "Weather, Clothes & Body: Year 6 quiz",
        questions: [
          q6.single("What does 'Il pleut' mean?", "It's raining", ["It's snowing", "It's sunny", "It's windy"], "Il pleut comes from the verb pleuvoir (to rain).", 1),
          q6.single("What does 'Il fait froid' mean?", "It's cold", ["It's hot", "It's nice weather", "It's windy"], "Froid means cold; chaud means hot.", 1),
          q6.single("What is 'une robe'?", "a dress", ["a skirt", "a coat", "a jumper"], "Une robe is a dress. A skirt is une jupe.", 2),
          q6.single("What is 'la tête'?", "the head", ["the hand", "the foot", "the leg"], "La tête is the head, the top of your body. Say it 'tet'.", 1),
          q6.single("Which sentence means 'It is snowing'?", "Il neige.", ["Il pleut.", "Il fait chaud.", "Il y a du soleil."], "Neiger is the verb 'to snow'. Il neige = it snows / it is snowing.", 2, true),
          q6.single("What does 'Je porte un pull' mean?", "I am wearing a jumper", ["I am carrying a jumper", "I want a jumper", "I like jumpers"], "Porter can mean to carry, but with clothes it means to wear.", 2),
          q6.short("Write 'the hand' in French.", "la main", "Main is a feminine noun, so it is la main.", 2, { na: true, diag: true }),
          q6.short("Write 'It is hot' in French.", "il fait chaud", "For weather use il fait + an adjective: il fait chaud.", 3, { na: true }),
          q6.multi("Which of these are clothes? Choose all that apply.", ["une jupe", "un pantalon", "des chaussures"], ["la tête", "le nez"], "Une jupe, un pantalon and des chaussures are clothes. La tête and le nez are parts of the body.", 2),
          q6.single("Choose the right word: 'J'ai mal ___ pied.' (My foot hurts.)", "au", ["à la", "aux", "à l'"], "Pied is masculine, so à + le becomes au.", 3),
        ],
      },
      flashcards: cards([
        ["Quel temps fait-il ?", "What is the weather like?"],
        ["It's hot.", "Il fait chaud."],
        ["Il neige.", "It's snowing."],
        ["a coat", "un manteau"],
        ["une jupe", "a skirt"],
        ["Je porte …", "I am wearing …"],
        ["the nose", "le nez"],
        ["le bras", "the arm"],
        ["J'ai mal à la tête.", "I have a headache."],
        ["the foot", "le pied"],
      ]),
    },
  },
};
