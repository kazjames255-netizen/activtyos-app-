// French — Food & Drink (Year 5). Original content aligned to the DfE KS2 foreign languages programme of study (OGL v3.0).
import type { CTopic } from "../types";
import { qb, cards } from "./_h";

const q5 = qb("frfood", 5);

export const TOPIC: CTopic = {
  key: "frfood",
  topic: "Food & Drink",
  subject: "French",
  years: {
    5: {
      year: 5,
      objectives: [
        "Name common foods, drinks and meals in French, with the correct gender.",
        "Say what you eat, drink and like using je mange, je bois, j'aime and je n'aime pas.",
        "Order politely using je voudrais … s'il vous plaît.",
        "Read a short text about meals and pick out key details.",
      ],
      note: {
        title: "Year 5: food and drink",
        body: `## Food (la nourriture) and drink (les boissons)

| French | English |
| --- | --- |
| le pain | bread |
| le fromage | cheese |
| le poulet | chicken |
| le poisson | fish |
| les frites (f) | chips |
| la pomme | apple |
| la banane | banana |
| le gâteau | cake |
| la glace | ice cream |
| le lait | milk |
| l'eau (f) | water |
| le jus d'orange | orange juice |
| une limonade | a lemonade |

**Meals:** le petit déjeuner (breakfast), le déjeuner (lunch), le dîner (dinner). **Times:** le matin (in the morning), le soir (in the evening).

## Useful verbs

- **je mange** = I eat / I am eating
- **je bois** = I drink / I am drinking
- **je voudrais** = I would like (polite, for ordering)

**Du, de la, de l', des** mean "some": **je mange du pain**, **je bois de l'eau**, **je mange des frites**.

## Model sentences

- Au petit déjeuner, je mange des fruits et je bois de l'eau.
- J'aime le fromage, mais je n'aime pas le poisson.
- Je voudrais un jus d'orange, s'il vous plaît.

## Sound tips

*Pain* is "pan" (nasal); *poulet* is "poo-LAY"; *gâteau* is "ga-TOE"; *lait* is "lay".

## Common mistakes

- Using **un** with feminine words: **une** limonade, **une** pomme.
- Leaving out **du / de la** after je mange / je bois.
- Forgetting **s'il vous plaît** when ordering, since French uses *vous* for polite requests.`,
      },
      quiz: {
        title: "Food & Drink: Year 5 quiz",
        questions: [
          q5.single("What is 'le pain'?", "bread", ["cheese", "milk", "chicken"], "Le pain is bread. Say 'pan' (nasal).", 1),
          q5.single("What does 'l'eau' mean?", "water", ["juice", "milk", "tea"], "L'eau is water. L'eau is feminine: la is shortened to l' before a vowel.", 1),
          q5.single("What is 'une pomme'?", "an apple", ["a banana", "a cake", "an ice cream"], "Une pomme is an apple. A banana is une banane.", 1),
          q5.single("Which word means 'chicken'?", "le poulet", ["le poisson", "le fromage", "le pain"], "Le poulet is chicken; le poisson is fish.", 2),
          q5.single("What does 'Je voudrais un gâteau' mean?", "I would like a cake", ["I have a cake", "I am eating a cake", "I don't like cake"], "Je voudrais means 'I would like' and is used to order politely.", 2, true),
          q5.single("'Le matin, je mange du pain et je bois du lait. Le soir, je mange du poulet et des frites.' What does the speaker drink in the morning?", "milk", ["water", "orange juice", "lemonade"], "Le matin is the morning, je bois is 'I drink' and du lait is milk.", 3),
          q5.short("Write 'the milk' in French.", "le lait", "Lait is masculine, so it is le lait.", 2, { na: true, diag: true }),
          q5.short("Complete: Je ____ du pain. (I eat some bread.)", "mange", "Je mange means 'I eat'. Boire (bois) is for drinking.", 2, { na: true }),
          q5.multi("Which of these are drinks? Choose all that apply.", ["le lait", "l'eau", "le jus d'orange"], ["le pain", "le fromage"], "Le lait, l'eau and le jus d'orange are drinks. Le pain and le fromage are foods.", 2),
          q5.single("Which sentence is correct for 'I would like a lemonade, please'?", "Je voudrais une limonade, s'il vous plaît.", ["Je voudrais un limonade, s'il vous plaît.", "Je mange une limonade, s'il vous plaît.", "Je bois voudrais limonade, s'il vous plaît."], "Limonade is feminine, so une; je voudrais is the polite way to ask.", 3),
        ],
      },
      flashcards: cards([
        ["le fromage", "cheese"],
        ["fish", "le poisson"],
        ["la glace", "ice cream"],
        ["chips", "les frites (f)"],
        ["le petit déjeuner", "breakfast"],
        ["dinner", "le dîner"],
        ["Je bois du lait.", "I drink milk."],
        ["I eat some bread.", "Je mange du pain."],
        ["Je voudrais …", "I would like …"],
        ["orange juice", "le jus d'orange"],
      ]),
    },
  },
};
