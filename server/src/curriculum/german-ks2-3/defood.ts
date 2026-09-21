// German — Food & Drink (Year 5). Original content aligned to the DfE KS2 foreign languages programme of study (OGL v3.0).
import type { CTopic } from "../types";
import { qb, cards } from "./_h";

const q5 = qb("defood", 5);

export const TOPIC: CTopic = {
  key: "defood",
  topic: "Food & Drink",
  subject: "German",
  years: {
    5: {
      year: 5,
      objectives: [
        "Name common foods and drinks with the right article (der, die, das).",
        "Say what you like eating and drinking with ich esse / ich trinke gern.",
        "Order politely with ich möchte … and say what you don't eat with kein / keine / keinen.",
        "Talk about meals (zum Frühstück, zum Mittagessen, zum Abendessen) with the verb in second place.",
      ],
      note: {
        title: "Year 5: Essen und Trinken",
        body: `## Food and drink

| German | English |
| --- | --- |
| das Brot / der Käse / die Butter | bread / cheese / butter |
| das Ei (die Eier) | egg |
| das Fleisch / der Fisch | meat / fish |
| das Obst / das Gemüse | fruit / vegetables |
| der Apfel / die Banane | apple / banana |
| die Kartoffel / die Nudeln (plural) | potato / pasta |
| der Reis / die Suppe | rice / soup |
| der Kuchen / das Eis | cake / ice cream |
| das Wasser / die Milch | water / milk |
| der Saft / der Tee | juice / tea |
| die Limonade / der Kakao | lemonade / hot chocolate |

Meals: **das Frühstück** (breakfast), **das Mittagessen** (lunch), **das Abendessen** (dinner).

## Useful patterns

- **Ich esse gern** + food. **Ich trinke gern** + drink. (*gern* = "with pleasure": I like doing it.) With he/she: **er / sie isst** and **er / sie trinkt**.
- **Ich möchte** + ein-word = I would like: *Ich möchte einen Kuchen* (der-word → einen), *eine Suppe* (die), *ein Ei* (das).
- **Ich esse keinen Reis** (der), **keine Pizza** (die), **kein Fleisch** (das).
- **Ich habe Hunger / Durst** = I am hungry / thirsty (literally "I have hunger / thirst").

## Model sentences

- Zum Mittagessen esse ich Nudeln.
- Meine Schwester isst gern Kuchen, aber sie trinkt keinen Tee.
- Ich habe Durst. Ich möchte eine Limonade, bitte.

## Sound tip

**ä** in *Käse* is like "ay" in "day" (say "KAY-zuh"); **ü** in *Frühstück* is a rounded "ee"; **ei** in *Ei* is "eye"; **s** before a vowel is said "z" (*Suppe* = "ZOO-puh"); **st** at the start of *Stück* is "sht".

## Common mistakes

- Putting the verb third: **Zum Frühstück esse ich Brot**, not "Zum Frühstück ich esse Brot".
- Forgetting *einen / keinen* for der-words: *ich möchte einen Saft*.
- Saying "Ich bin hungrig" for "I am hungry": the usual German phrase is **Ich habe Hunger**.`,
      },
      quiz: {
        title: "Food & Drink: Year 5 quiz",
        questions: [
          q5.single("What does 'der Käse' mean?", "cheese", ["bread", "butter", "egg"], "Der Käse is cheese. Das Brot is bread.", 1),
          q5.single("What does 'das Wasser' mean?", "water", ["milk", "juice", "tea"], "Das Wasser is water. Die Milch is milk.", 1),
          q5.single("What does 'der Apfel' mean?", "apple", ["pear", "banana", "potato"], "Der Apfel is an apple. Die Banane is a banana.", 1),
          q5.single("What does 'Ich trinke gern Milch' mean?", "I like drinking milk.", ["I never drink milk.", "I like eating cheese.", "I would like some milk."], "Ich trinke gern means I like drinking, and Milch is milk.", 2, true),
          q5.short("Complete: Ich ____ gern Pizza. (I like eating pizza.)", "esse", "Ich esse: the verb essen ends in -e with ich.", 2, { diag: true }),
          q5.single("Which article goes with 'Eis' (ice cream)?", "das", ["der", "die", "den"], "Eis is ice cream, and it is a neuter noun, so its article is das.", 2),
          q5.multi("Which of these are drinks? Choose all that apply.", ["der Tee", "der Saft", "die Limonade"], ["das Brot", "der Reis"], "Tea, juice and lemonade are drinks. Bread and rice are foods.", 2),
          q5.single("What does 'Ich esse keinen Fisch' mean?", "I don't eat fish.", ["I eat only fish.", "I don't like drinking fish.", "I would like some fish."], "Keinen means 'no / not any' with a der-word (der Fisch), so this says I do not eat fish.", 3),
          q5.single("'Ich möchte einen Kakao, bitte.' What is the speaker doing?", "Politely asking for a hot chocolate", ["Saying they make hot chocolate every day", "Refusing a hot chocolate they were offered", "Asking what a hot chocolate costs today"], "Ich möchte means I would like, and bitte means please, so this is a polite request.", 2),
          q5.single("Which sentence correctly says 'For breakfast I drink tea'?", "Zum Frühstück trinke ich Tee.", ["Zum Frühstück ich trinke Tee.", "Zum Frühstück Tee trinke ich.", "Ich zum Frühstück trinke Tee."], "After 'Zum Frühstück' the verb must come next (second place), then ich: Zum Frühstück trinke ich Tee.", 3),
        ],
      },
      flashcards: cards([
        ["das Brot", "bread"],
        ["butter", "die Butter"],
        ["das Obst", "fruit"],
        ["vegetables", "das Gemüse"],
        ["die Nudeln", "pasta (plural)"],
        ["cake", "der Kuchen"],
        ["das Frühstück", "breakfast"],
        ["Ich möchte einen Saft.", "I would like a juice."],
        ["Ich esse keine Suppe.", "I don't eat soup."],
        ["Ich habe Durst.", "I am thirsty."],
      ]),
    },
  },
};
