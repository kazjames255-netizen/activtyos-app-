// Spanish — Food & Healthy Living (Year 9). Original content aligned to the DfE KS3 modern foreign languages programme of study (OGL v3.0).
import type { CTopic } from "../types";
import { qb, cards } from "./_h";

const q = qb("eshealth", 9);

export const TOPIC: CTopic = {
  key: "eshealth",
  topic: "Food & Healthy Living",
  subject: "Spanish",
  years: {
    9: {
      year: 9,
      objectives: [
        "Discuss healthy and unhealthy habits using hay que, debes, tengo que and es bueno / malo para la salud.",
        "Name foods and healthy-living vocabulary (dieta equilibrada, verduras, comida basura, ejercicio).",
        "Order a meal in a restaurant and state dietary needs (vegetariano, alérgico).",
        "Give and justify opinions and advice, understanding short texts about diet and health.",
      ],
      note: {
        title: "Year 9: La comida y la vida sana",
        body: `## What you need to know

| Español | English | Español | English |
| --- | --- | --- | --- |
| la dieta equilibrada | balanced diet | sano / sana, saludable | healthy |
| las verduras | vegetables | la salud | health |
| la fruta | fruit | hacer ejercicio | to do exercise |
| la comida basura | junk food | dormir | to sleep |
| el azúcar / la grasa | sugar / fat | fumar | to smoke |
| el agua | water | estar en forma | to be fit |

**Give advice and say what is needed:**
- **hay que** + infinitive = one must / you have to (general): *hay que comer muchas verduras*.
- **debes** + infinitive = you should / must: *debes desayunar todos los días*.
- **tengo que** + infinitive = I have to: *tengo que comer menos grasa*.
- **es bueno / malo para la salud** = it is good / bad for your health: *el zumo natural es bueno para la salud*.

**In a restaurant:** *¿Qué desea?* (What would you like?), *el menú del día* (set menu), **de primero** (as a starter), **de segundo** (as a main course), **de postre** (for dessert), *la cuenta* (the bill). Say *Quisiera …* (I would like …).

**Diets and allergies:** *Soy vegetariano / vegetariana.* *Soy alérgico / alérgica a los frutos secos* (nuts). The ending agrees with the speaker.

## Model sentences

- Para estar sano, hay que comer muchas verduras y beber agua.
- Debes desayunar todos los días.
- De postre, quisiera un helado, por favor.

## Sound tip

**h** is silent: *hay* sounds like "eye". **j** is a throaty h. **z** is "th" in Spain: *azúcar* is "a-THOO-kar". **ll** is like y. Stress the accent: *salud* ends in d and is said "sa-LOOD".

## Common mistakes

- Confusing **debes** (you should) with **debo** (I should).
- Forgetting the infinitive after *hay que*, *tengo que* and *debes*: **hay que comer**, not *hay que como*.
- Not agreeing the adjective: a girl says **soy vegetariana**.`,
      },
      quiz: {
        title: "Food & Healthy Living: Year 9 quiz",
        questions: [
          q.single("What does 'las verduras' mean?", "vegetables", ["fruit", "fish", "sweets"], "Las verduras are vegetables; fruit is la fruta.", 1),
          q.single("What does 'la cuenta' mean in a restaurant?", "the bill", ["the menu", "the table", "the waiter"], "In a restaurant la cuenta is the bill you ask for at the end.", 1),
          q.short("Write 'healthy' in Spanish (masculine, one word).", "sano", "Sano is the word for healthy; saludable is a second word with the same meaning.", 1, { acc: ["saludable"] }),
          q.single("Which sentence means 'You should do more exercise'?", "Debes hacer más ejercicio.", ["Debo hacer más ejercicio.", "Debes hacer menos ejercicio.", "Puedes hacer más ejercicio."], "Debes = you should; más = more. Debo would mean 'I should' and menos is less.", 2, true),
          q.single("What does 'Tengo que comer menos azúcar' mean?", "I have to eat less sugar.", ["I have to eat more sugar.", "I want to eat sugar.", "I can't eat sugar."], "Tengo que + infinitive = I have to; menos = less.", 2),
          q.short("Complete: Hay que ___ ocho horas. (to sleep)", "dormir", "After hay que we need the infinitive: dormir (to sleep).", 2, { diag: true }),
          q.multi("Which of these are healthy habits? Choose all that apply.", ["hacer ejercicio", "beber agua", "comer fruta"], ["fumar", "comer mucha comida basura"], "Exercise, drinking water and eating fruit are healthy. Smoking and lots of junk food are not.", 2),
          q.single("In a restaurant you hear 'De primero, sopa.' What does 'de primero' mean?", "as a starter / first course", ["for dessert", "as a main course", "to drink"], "Primero is first, so de primero is the first course; de segundo is the main course and de postre is dessert.", 2),
          q.single("Lucía says: 'Soy vegetariana y soy alérgica a los frutos secos. Como fruta, verduras y pasta.' Which dish is suitable for her?", "a pasta dish with vegetables and no nuts", ["chicken salad", "a ham sandwich", "a cake with almonds"], "She is vegetarian (no meat or ham) and allergic to nuts (almonds are nuts), so pasta with vegetables is right.", 3),
          q.short("Say in Spanish: 'Junk food is bad for your health.'", "La comida basura es mala para la salud.", "Comida is feminine so the adjective is mala; es mala para la salud = it is bad for your health.", 3, { acc: ["La comida rápida es mala para la salud."] }),
        ],
      },
      flashcards: cards([
        ["la dieta equilibrada", "balanced diet"],
        ["las verduras / la fruta", "vegetables / fruit"],
        ["la comida basura", "junk food"],
        ["health (Spanish)", "la salud"],
        ["hay que + infinitive", "you have to / one must"],
        ["you should (Spanish)", "debes"],
        ["es bueno para la salud", "it is good for your health"],
        ["de primero / de segundo / de postre", "as a starter / as a main course / for dessert"],
        ["Soy alérgico a los frutos secos.", "I am allergic to nuts. (boy)"],
        ["Soy vegetariana.", "I am vegetarian. (girl)"],
      ]),
    },
  },
};
