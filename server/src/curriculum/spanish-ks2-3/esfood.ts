// Spanish — Food & Drink (Year 5). Original content aligned to the DfE KS2 foreign languages programme of study (OGL v3.0).
import type { CTopic } from "../types";
import { qb, cards } from "./_h";

const q = qb("esfood", 5);

export const TOPIC: CTopic = {
  key: "esfood",
  topic: "Food & Drink",
  subject: "Spanish",
  years: {
    5: {
      year: 5,
      objectives: [
        "Name common foods, drinks and meals.",
        "Give likes and dislikes with me gusta / me gustan and no me gusta / no me gustan.",
        "Order and ask for things politely with quiero … and por favor.",
        "Say what you eat and drink with como and bebo, and use tengo hambre / tengo sed.",
      ],
      note: {
        title: "Year 5: La comida y las bebidas",
        body: `## What you need to know

| Español | English | Español | English |
| --- | --- | --- | --- |
| el pan | bread | la manzana | apple |
| la leche | milk | el plátano | banana |
| el agua | water | la naranja | orange |
| el zumo | juice | las fresas | strawberries |
| el queso | cheese | las patatas | potatoes |
| el jamón | ham | el arroz | rice |
| el pollo | chicken | la pasta | pasta |
| el pescado | fish (to eat) | la sopa | soup |
| los huevos | eggs | el helado | ice cream |

**Meals:** el desayuno (breakfast), la comida (lunch), la cena (dinner).

**Likes:** use **me gusta** with one thing and **me gustan** with several: *me gusta el queso*, *me gustan las fresas*. Add **no** for dislikes: *no me gusta el pescado*.

**Other useful phrases:** *como* (I eat), *bebo* (I drink), *quiero* (I want), *tengo hambre* (I'm hungry), *tengo sed* (I'm thirsty), *¿Qué quieres para comer?* (What do you want to eat?), *para beber* (to drink).

## Model sentences

- Para el desayuno como pan y bebo leche.
- Me gustan las fresas pero no me gusta el pescado.
- Tengo hambre y quiero pasta con queso.

## Sound tip

**h** is silent: *helado* is "eh-LA-do", *huevos* is "WEH-vos". **qu** is a k sound: *queso* is "KEH-so". **ll** is like y: *pollo* is "PO-yo". **j** is a throaty h: *jamón* is "ha-MON".

## Common mistakes

- Using **gusta** with a plural: it must be **gustan** (*me gustan los huevos*).
- Forgetting the article after gusta: *me gusta el pan*, not *me gusta pan*.
- Saying "I am hungry" with *soy* or *estoy*. Spanish says **tengo** hambre ("I have hunger").`,
      },
      quiz: {
        title: "Food & Drink: Year 5 quiz",
        questions: [
          q.single("What does 'la leche' mean?", "milk", ["cheese", "bread", "juice"], "Leche is milk. Queso is cheese and zumo is juice.", 1),
          q.single("Which word means 'the cheese'?", "el queso", ["el pollo", "el jamón", "el pescado"], "Queso is cheese, pollo is chicken, jamón is ham and pescado is fish.", 1),
          q.short("Write 'apple' in Spanish (one word).", "manzana", "An apple is a manzana, a feminine noun (la manzana).", 1, { acc: ["la manzana"] }),
          q.single("Which sentence means 'I like bananas'?", "Me gustan los plátanos.", ["Me gusta los plátanos.", "Me gustan el plátano.", "Me gusta las plátanos."], "Bananas are plural, so use me gustan with los plátanos.", 2, true),
          q.single("What does 'Tengo sed' mean?", "I am thirsty.", ["I am hungry.", "I have a cup.", "I want water."], "Tener sed is 'to have thirst', which means to be thirsty. Hunger is hambre.", 2),
          q.short("Complete: ___ un helado, por favor. (I want)", "Quiero", "Quiero is 'I want', from the verb querer.", 2, { diag: true }),
          q.multi("Which of these are fruits? Choose all that apply.", ["la manzana", "la naranja", "el plátano"], ["el pollo", "el arroz"], "Manzana, naranja and plátano are fruits. Pollo is chicken and arroz is rice.", 2),
          q.single("What does '¿Qué quieres para beber?' ask?", "What do you want to drink?", ["What do you want to eat?", "Are you thirsty?", "Where do you drink?"], "Para beber means 'to drink'. Qué quieres is 'what do you want'.", 2),
          q.single("María says: 'Me gustan las patatas pero no me gusta la sopa.' Which is true?", "She likes potatoes but not soup.", ["She likes soup but not potatoes.", "She doesn't like either.", "She likes both."], "Me gustan las patatas = I like potatoes. Pero (but) no me gusta la sopa = I don't like soup.", 3),
          q.short("Translate: 'I eat rice and I drink water.'", "Como arroz y bebo agua.", "Como is 'I eat' (comer) and bebo is 'I drink' (beber). Arroz is rice and agua is water.", 3, { acc: ["Yo como arroz y bebo agua.", "Yo como arroz y yo bebo agua."] }),
        ],
      },
      flashcards: cards([
        ["el pan", "bread"],
        ["el zumo", "juice"],
        ["cheese (Spanish)", "el queso"],
        ["el pescado", "fish (to eat)"],
        ["las fresas", "strawberries"],
        ["Me gustan las patatas.", "I like potatoes. (plural: gustan)"],
        ["I don't like fish (Spanish)", "No me gusta el pescado."],
        ["Tengo hambre.", "I am hungry. (literally 'I have hunger')"],
        ["I want (Spanish)", "quiero"],
        ["el desayuno / la cena", "breakfast / dinner"],
      ]),
    },
  },
};
