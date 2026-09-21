// French — Food & Healthy Living (Year 9). Original content aligned to the DfE KS3 modern foreign languages programme of study (OGL v3.0).
import type { CTopic } from "../types";
import { qb, cards } from "./_h";

const q9 = qb("frhealth", 9);

export const TOPIC: CTopic = {
  key: "frhealth",
  topic: "Food & Healthy Living",
  subject: "French",
  years: {
    9: {
      year: 9,
      objectives: [
        "Discuss healthy and unhealthy eating and lifestyle habits.",
        "Use du / de la / de l' / des for 'some', and de after negatives and quantities.",
        "Use il faut + infinitive to give advice.",
        "Read and respond to a short text about diet and health; order and buy food using quantities.",
      ],
      note: {
        title: "Year 9: eating well and staying healthy",
        body: `## Vocabulary

| French | English |
| --- | --- |
| la santé | health |
| en bonne santé | healthy (in good health) |
| équilibré | balanced |
| les fruits / les légumes | fruit / vegetables |
| une carotte / des haricots verts | a carrot / green beans |
| les bonbons | sweets |
| la viande | meat |
| végétarien / végétarienne | vegetarian |
| tous les jours | every day |

## Some: du, de la, de l', des

**Je mange du fromage** (m), **de la salade** (f), **de l'ail** (vowel), **des légumes** (plural). After a **negative** or a **quantity** this becomes just **de** (or **d'**): **Je ne mange pas de sucre.** **Je bois beaucoup d'eau.** **Un kilo de tomates.**

## Advice: il faut + infinitive

**Il faut dormir huit heures.** (You need to sleep eight hours.) **Il ne faut pas grignoter.** (You shouldn't snack.)

## Buying food

**Je voudrais un kilo de poires, une bouteille d'eau et un paquet de biscuits.** (I would like a kilo of pears, a bottle of water and a packet of biscuits.)

## Sound tips

*Légumes* sounds like "lay-GOOM"; *santé* is "son-TAY"; *équilibré* is "ay-kee-lee-BRAY"; *viande* is "vee-OND".

## Common mistakes

- Saying **je ne mange pas du sucre**: use **de** after pas (**je ne mange pas de sucre**).
- Saying **beaucoup des fruits**: use **beaucoup de fruits**.
- Confusing **fruits** (fruit) with **légumes** (vegetables).`,
      },
      quiz: {
        title: "Food & Healthy Living: Year 9 quiz",
        questions: [
          q9.single("What does 'la santé' mean?", "health", ["sport", "food", "sugar"], "La santé is health. Santé! is also what you say as a toast.", 1),
          q9.single("What are 'les légumes'?", "vegetables", ["fruit", "sweets", "meat"], "Les légumes are vegetables; fruit is les fruits.", 1),
          q9.single("What does 'en bonne santé' mean?", "in good health", ["tired", "hungry", "ill"], "Bonne is good and santé is health.", 1),
          q9.single("What does 'Il faut manger cinq fruits et légumes par jour' mean?", "You need to eat five fruit and vegetables a day", ["You can eat five fruit and vegetables a day", "I like eating five fruit and vegetables", "We ate five fruit and vegetables yesterday"], "Il faut + infinitive means 'you need to' or 'you must'. Par jour means per day.", 2, true),
          q9.single("Choose the right words: 'Je bois ___ eau tous les jours.'", "de l'", ["du", "de la", "des"], "Eau starts with a vowel, so 'some' is de l'.", 2),
          q9.single("Choose the right word: 'Je ne mange pas ___ viande.' (I don't eat any meat.)", "de", ["de la", "du", "la"], "After a negative like ne … pas, de la / du / des all become de (or d' before a vowel).", 3),
          q9.short("Write 'I eat some fruit' in French.", "je mange des fruits", "Fruits is plural, so 'some' is des.", 2, { na: true, diag: true }),
          q9.short("Complete: Il faut boire beaucoup ____ eau. (Write the word with its apostrophe.)", "d'eau", "After beaucoup use de, which becomes d' before a vowel.", 2, { acc: ["d’eau"] }),
          q9.multi("Which of these are fruit or vegetables? Choose all that apply.", ["les carottes", "les pommes", "les haricots verts"], ["le fromage", "le poulet"], "Carrots, apples and green beans are fruit or vegetables. Cheese and chicken are not.", 2),
          q9.single("'Pour être en bonne santé, il faut manger équilibré. Moi, je mange des fruits tous les jours, mais je ne mange pas de bonbons. Je bois beaucoup d'eau.' Which statement is TRUE?", "He doesn't eat sweets.", ["He never eats fruit.", "He drinks very little water.", "He eats sweets every day."], "Je ne mange pas de bonbons means he doesn't eat sweets, and beaucoup d'eau means a lot of water.", 3),
        ],
      },
      flashcards: cards([
        ["équilibré", "balanced"],
        ["sweets", "les bonbons"],
        ["la viande", "meat"],
        ["every day", "tous les jours"],
        ["Il faut dormir.", "You need to sleep."],
        ["I don't eat any sugar.", "Je ne mange pas de sucre."],
        ["a bottle of water", "une bouteille d'eau"],
        ["un kilo de tomates", "a kilo of tomatoes"],
        ["végétarien", "vegetarian (masculine)"],
        ["a lot of fruit", "beaucoup de fruits"],
      ]),
    },
  },
};
