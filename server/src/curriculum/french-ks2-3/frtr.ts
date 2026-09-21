// French — Town & Region (Year 8). Original content aligned to the DfE KS3 modern foreign languages programme of study (OGL v3.0).
import type { CTopic } from "../types";
import { qb, cards } from "./_h";

const q8 = qb("frtr", 8);

export const TOPIC: CTopic = {
  key: "frtr",
  topic: "Town & Region",
  subject: "French",
  years: {
    8: {
      year: 8,
      objectives: [
        "Describe where you live: type of place, region, country and what there is to see and do.",
        "Use il y a / il n'y a pas de, on peut + infinitive and prepositions of place (entre, devant, derrière, dans, sur).",
        "Give and justify opinions about your town or village.",
        "Read a short description of a town or region and extract detail; write a short paragraph from a model.",
      ],
      note: {
        title: "Year 8: my town and my region",
        body: `## Where do you live?

| French | English |
| --- | --- |
| J'habite dans une grande ville. | I live in a big town / city. |
| J'habite dans un petit village. | I live in a small village. |
| J'habite à la campagne. | I live in the countryside. |
| J'habite au bord de la mer. | I live by the sea. |
| J'habite en montagne. | I live in the mountains. |

**Compass points:** le nord, le sud, l'est, l'ouest. **Dans le nord de l'Angleterre** = in the north of England.

**Countries:** **en** + feminine country (en France, en Écosse), **au** + masculine country (au pays de Galles), **à** + town (à Bristol).

## Describing the place

calme (quiet), bruyant (noisy), animé (lively), pollué (polluted), historique, moderne, touristique.
**Il y a beaucoup de musées.** (There are lots of museums.) **Il n'y a pas de théâtre.** (There isn't a theatre.)

## What can you do? On peut + infinitive

**On peut faire des promenades.** (You can go for walks.) **On peut visiter un château.** (You can visit a castle.)

## Prepositions of place

dans (in), sur (on), devant (in front of), derrière (behind), entre … et … (between … and …).
**Le musée est entre la mairie et l'église.** (The museum is between the town hall and the church.)

## Sound tips

*Bruyant* sounds like "brwee-YON". *Animé* is "an-ee-MAY". *Campagne* is "kom-PAN-yuh". The **-nt** at the end of *bruyant* is not pronounced, and *ville* is "veel".

## Common mistakes

- Writing **beaucoup des musées**: after *beaucoup* use **de**: beaucoup **de** musées.
- Using **dans** with a town name: **à** Bristol, not *dans* Bristol.
- Forgetting **de** after *il n'y a pas*.`,
      },
      quiz: {
        title: "Town & Region: Year 8 quiz",
        questions: [
          q8.single("What does 'le nord' mean?", "the north", ["the south", "the east", "the west"], "Le nord is north; le sud is south.", 1),
          q8.single("What does 'au bord de la mer' mean?", "by the sea", ["in the mountains", "in the countryside", "in a village"], "Bord is edge and mer is sea: at the edge of the sea.", 1),
          q8.single("What does 'calme' mean?", "quiet", ["noisy", "polluted", "lively"], "Calme looks like calm: quiet. The opposite is bruyant.", 1),
          q8.single("What does 'On peut faire du shopping' mean?", "You can go shopping", ["You must go shopping", "You like shopping", "We went shopping"], "On peut + infinitive means 'you can / one can / we can'.", 2, true),
          q8.single("What does 'Il y a beaucoup de magasins mais il n'y a pas de cinéma' mean?", "There are lots of shops but there isn't a cinema", ["There are few shops but there is a cinema", "There are lots of shops and a cinema", "There isn't a shop but there are lots of cinemas"], "Beaucoup de = lots of; mais = but; il n'y a pas de = there isn't.", 2),
          q8.single("Choose the missing word: 'La boulangerie est ___ la poste et la banque.' (between)", "entre", ["sur", "devant", "derrière"], "Entre … et … means between … and …", 2),
          q8.short("Write 'in the countryside' in French.", "à la campagne", "Use à + la + campagne (feminine).", 2, { na: true, diag: true }),
          q8.short("Complete: Dans mon village, il n'y a pas ____ cinéma.", "de", "After a negative (n'y a pas) un/une/du become de.", 3),
          q8.single("'Dans mon village, il y a un parc et une piscine. On peut faire du vélo ou jouer au foot. Mais il n'y a pas de cinéma.' What does the village NOT have?", "a cinema", ["a park", "a swimming pool", "a sports centre"], "Il n'y a pas de cinéma means 'there is no cinema'.", 2),
          q8.written("Write 4–5 sentences in French describing where you live. Say what type of place it is, which part of the country, two things there are, one thing you can do and your opinion.", "J'habite dans une grande ville dans le nord de l'Angleterre. Il y a un parc et beaucoup de magasins, mais il n'y a pas de plage. On peut faire du shopping. J'aime ma ville parce que c'est animé.", "Mark scheme (5 marks): 1 mark each for j'habite + place type, a region with dans le nord/sud/…, correct il y a / il n'y a pas de, on peut + infinitive, and an opinion with parce que c'est + adjective. Accept minor spelling slips.", 3),
        ],
      },
      flashcards: cards([
        ["le sud", "the south"],
        ["the east", "l'est"],
        ["bruyant", "noisy"],
        ["lively", "animé"],
        ["J'habite à la campagne.", "I live in the countryside."],
        ["I live in a big city.", "J'habite dans une grande ville."],
        ["On peut visiter un château.", "You can visit a castle."],
        ["between", "entre"],
        ["devant", "in front of"],
        ["behind", "derrière"],
      ]),
    },
  },
};
