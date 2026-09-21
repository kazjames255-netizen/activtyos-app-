// German — Food & Healthy Living (Year 9). Original content aligned to the DfE KS3 modern foreign languages programme of study (OGL v3.0).
import type { CTopic } from "../types";
import { qb, cards } from "./_h";

const q9 = qb("dehealth", 9);

export const TOPIC: CTopic = {
  key: "dehealth",
  topic: "Food & Healthy Living",
  subject: "German",
  years: {
    9: {
      year: 9,
      objectives: [
        "Talk about healthy and unhealthy eating and lifestyle, with quantities (viel, wenig, genug).",
        "Give advice with man sollte / man muss and use zu + infinitive (Ich versuche, … zu …).",
        "Order in a restaurant politely (Ich hätte gern …) and ask for the bill.",
        "Say what is wrong when you are ill (Ich habe Kopfschmerzen, Mir ist schlecht).",
      ],
      note: {
        title: "Year 9: Gesund leben",
        body: `## Healthy living

| German | English |
| --- | --- |
| die Ernährung / die Gesundheit | diet, nutrition / health |
| das Obst / das Gemüse | fruit / vegetables |
| die Süßigkeiten (plural) | sweets |
| der Zucker / das Fett / das Salz | sugar / fat / salt |
| das Vitamin (die Vitamine) | vitamin |
| gesund / ungesund | healthy / unhealthy |
| viel / wenig / genug | a lot / little / enough |

**Comparing:** *Wasser ist besser als Limonade.* (gut → besser)

## Giving advice

- **Man sollte weniger Zucker essen.** = You should eat less sugar. **Man muss genug schlafen.** = You must get enough sleep. With these modal verbs the infinitive goes to the **end**.
- **Ich versuche, mehr Sport zu treiben.** = I try to do more sport. The **zu** goes just before the infinitive; a comma comes before it.

## In a restaurant

**Ich hätte gern das Schnitzel mit Pommes.** = I would like the schnitzel with chips. **Was empfehlen Sie?** = What do you recommend? **Zum Nachtisch** = for dessert. **Die Rechnung, bitte.** = The bill, please. **Ich bin Vegetarier / Vegetarierin.** = I am vegetarian (male / female).

## When you feel ill

**Ich habe Bauchschmerzen / Kopfschmerzen / Halsschmerzen.** = I have tummy ache / a headache / a sore throat. **Ich bin krank.** = I am ill.

## Sound tip

**ä** in *hätte* is like "e" in "bed"; **ü** in *gesünder* and *Süßigkeiten* is a rounded "ee"; **ß** is a sharp "ss"; **ch** in *Bauchschmerzen* is a rough sound at the back of the throat and **sch** is "sh"; **v** in *Vitamin* and *Vegetarier* is said "v" as in English, unlike *viel*, where it is "f".

## Common mistakes

- Putting the infinitive early: **Man sollte weniger Zucker essen**, not "Man sollte essen weniger Zucker".
- Forgetting **zu**: *Ich versuche, mehr zu schlafen* (not "Ich versuche, mehr schlafen").
- Using **wie** for comparisons: use **als** (*besser als*).`,
      },
      quiz: {
        title: "Food & Healthy Living: Year 9 quiz",
        questions: [
          q9.single("What does 'gesund' mean?", "healthy", ["hungry", "tasty", "ill"], "Gesund means healthy, and ungesund is unhealthy.", 1),
          q9.single("What does 'ungesund' mean?", "unhealthy", ["not hungry", "healthy", "not allowed"], "The prefix un- makes it the opposite of gesund (healthy).", 1),
          q9.single("What does 'Ich trinke genug Wasser' mean?", "I drink enough water.", ["I drink too much water.", "I don't drink water.", "I would like some water."], "Genug means enough, so the sentence says I drink enough water.", 1),
          q9.single("What does 'Man sollte mehr Obst essen' mean?", "You should eat more fruit.", ["You must eat less fruit.", "People eat a lot of fruit.", "I like eating fruit."], "Man sollte means one should / you should, and mehr is more.", 2, true),
          q9.short("Complete: Ich muss weniger Schokolade ____. (I must eat less chocolate.)", "essen", "After a modal verb (muss) the infinitive goes to the end of the sentence.", 2, { diag: true }),
          q9.single("What does 'Ich hätte gern die Speisekarte' mean?", "I would like the menu.", ["I had the menu yesterday.", "I like the food here.", "I would like the bill."], "Ich hätte gern is I would like, and die Speisekarte is the menu.", 2),
          q9.single("Which sentence means 'Vegetables are healthier than sweets'?", "Gemüse ist gesünder als Süßigkeiten.", ["Gemüse ist gesund als Süßigkeiten.", "Gemüse ist gesünder wie Süßigkeiten.", "Gemüse ist mehr gesund als Süßigkeiten."], "The comparative of gesund is gesünder (with umlaut) and the word for 'than' is als.", 3),
          q9.single("What does 'Mir ist schlecht' mean?", "I feel sick.", ["I feel bad about it.", "I am very tired.", "I have lost my appetite."], "Mir ist schlecht is what you say when you feel sick.", 2),
          q9.multi("Which of these are healthy habits? Choose all that apply.", ["Sport treiben", "Obst essen", "viel Wasser trinken"], ["rauchen", "viel Zucker essen"], "Exercise, fruit and water are healthy. Smoking and lots of sugar are not.", 2),
          q9.single("Which sentence correctly says 'I try to eat healthily'?", "Ich versuche, gesund zu essen.", ["Ich versuche, zu gesund essen.", "Ich versuche, essen gesund zu.", "Ich versuche gesund essen zu."], "The zu goes directly before the infinitive, which comes last: gesund zu essen.", 3),
        ],
      },
      flashcards: cards([
        ["die Ernährung", "diet, nutrition"],
        ["sweets", "die Süßigkeiten"],
        ["der Zucker", "sugar"],
        ["enough", "genug"],
        ["Man muss genug schlafen.", "You must get enough sleep."],
        ["Ich hätte gern eine Suppe.", "I would like a soup."],
        ["The bill, please.", "Die Rechnung, bitte."],
        ["Ich habe Kopfschmerzen.", "I have a headache."],
        ["I am vegetarian (male speaker).", "Ich bin Vegetarier."],
        ["besser als", "better than"],
      ]),
    },
  },
};
