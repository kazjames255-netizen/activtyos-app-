// French — Town & Directions (Year 6). Original content aligned to the DfE KS2 foreign languages programme of study (OGL v3.0).
import type { CTopic } from "../types";
import { qb, cards } from "./_h";

const q6 = qb("frtown", 6);

export const TOPIC: CTopic = {
  key: "frtown",
  topic: "Town & Directions",
  subject: "French",
  years: {
    6: {
      year: 6,
      objectives: [
        "Name places in a town and say what there is (il y a …) and what there is not (il n'y a pas de …).",
        "Ask where a place is (où est …?) and understand simple directions.",
        "Use position words such as à côté de, en face de, près de and loin de.",
        "Read and write short directions and descriptions of a town.",
      ],
      note: {
        title: "Year 6: my town and giving directions",
        body: `## Places in town (en ville)

| French | English |
| --- | --- |
| la boulangerie | bakery |
| la pharmacie | pharmacy |
| la poste | post office |
| la banque | bank |
| le supermarché | supermarket |
| le cinéma | cinema |
| la piscine | swimming pool |
| le parc | park |
| la gare | railway station |
| le musée | museum |
| la mairie | town hall |

## Asking and saying where things are

- **Où est la gare ?** = Where is the station?
- **Il y a un parc.** = There is a park. **Il n'y a pas de banque.** = There isn't a bank. (After *pas* use **de**.)

## Directions

- **Allez tout droit.** = Go straight on.
- **Tournez à gauche.** = Turn left.
- **Tournez à droite.** = Turn right.
- **Prenez la première rue.** = Take the first street.

## Where is it?

à côté de (next to), en face de (opposite), près de (near), loin de (far from).

**La banque est en face du musée.** (The bank is opposite the museum.)

## Sound tips

*Gauche* sounds like "gohsh"; *droite* like "drwaht"; *boulangerie* like "boo-lon-zhuh-REE"; *gare* like "gar".

## Common mistakes

- Saying **il n'y a pas une gare**: after a negative use **de** (**il n'y a pas de gare**).
- Confusing **gauche** (left) with **droite** (right).`,
      },
      quiz: {
        title: "Town & Directions: Year 6 quiz",
        questions: [
          q6.single("What is 'la boulangerie'?", "the bakery", ["the pharmacy", "the bank", "the post office"], "La boulangerie is where you buy bread: the bakery.", 1),
          q6.single("What is 'la piscine'?", "the swimming pool", ["the park", "the station", "the cinema"], "La piscine is the swimming pool.", 1),
          q6.single("What does 'à gauche' mean?", "on the left", ["on the right", "straight on", "near"], "Gauche is left; droite is right.", 1),
          q6.single("What does 'Allez tout droit' mean?", "Go straight on", ["Turn left", "Turn right", "Stop here"], "Tout droit means straight on, and allez means 'go'.", 2),
          q6.single("What does 'Où est la gare ?' mean?", "Where is the station?", ["Where is the school?", "Is the station near?", "What is the station?"], "Où is 'where', est is 'is' and la gare is the station.", 2, true),
          q6.single("Which sentence means 'There is no swimming pool in my village'?", "Il n'y a pas de piscine dans mon village.", ["Il n'y a pas une piscine dans mon village.", "Il y a une piscine dans mon village.", "Je n'ai pas de piscine dans mon village."], "After a negative like n'y a pas, use de (not un/une).", 3),
          q6.short("Write 'the park' in French.", "le parc", "Parc is masculine, so it is le parc. Say it 'park'.", 2, { na: true, diag: true }),
          q6.short("Complete: Tournez à ____. (Turn right.)", "droite", "Droite means right. Gauche means left.", 2, { na: true }),
          q6.multi("Which of these are shops? Choose all that apply.", ["la boulangerie", "la pharmacie", "le supermarché"], ["la piscine", "le parc"], "You can buy things at la boulangerie, la pharmacie and le supermarché. La piscine and le parc are places to have fun.", 2),
          q6.single("'Pour aller au cinéma, allez tout droit, puis tournez à gauche. Le cinéma est en face de la piscine.' Where is the cinema?", "opposite the swimming pool", ["next to the swimming pool", "far from the swimming pool", "on the right"], "En face de means 'opposite'. The directions say turn left, not right.", 3),
        ],
      },
      flashcards: cards([
        ["la gare", "railway station"],
        ["bank", "la banque"],
        ["la poste", "post office"],
        ["museum", "le musée"],
        ["à droite", "on the right"],
        ["straight on", "tout droit"],
        ["près de", "near"],
        ["far from", "loin de"],
        ["Il y a un cinéma.", "There is a cinema."],
        ["Where is the park?", "Où est le parc ?"],
      ]),
    },
  },
};
