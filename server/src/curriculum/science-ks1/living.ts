// KS1 Science — Living Things & Their Habitats (Year 2). Original content aligned to the DfE National Curriculum programme of study (OGL v3.0).
// Structural checks (answers in options, positions, counts) are in _check_s1.ts — re-run it after ANY edit here.
import type { CTopic } from "../types";
import { IMG, multi, single } from "./_h";

export const TOPIC: CTopic = {
  key: "living",
  topic: "Living Things & Their Habitats",
  subject: "Science",
  years: {
    2: {
      year: 2,
      objectives: [
        "Explore and compare the differences between things that are living, dead, and things that have never been alive.",
        "Identify that most living things live in habitats to which they are suited and describe how different habitats provide for the basic needs of different kinds of animals and plants, and how they depend on each other.",
        "Identify and name a variety of plants and animals in their habitats, including microhabitats.",
        "Describe how animals obtain their food from plants and other animals, using the idea of a simple food chain, and identify and name different sources of food.",
      ],
      note: {
        title: "Year 2: living, dead, habitats and food chains",
        body: `## Living, dead or never alive?

| Type | What it means | Examples |
| --- | --- | --- |
| **Living** | Alive now. It grows and needs food or water. | a snail, an oak tree |
| **Dead** | It was once alive but is not now. | a dead beetle, a dried-up flower |
| **Never alive** | It has never been alive. | a metal spoon, sand, a plastic cup |

## Habitats

A **habitat** is the place where a plant or animal lives. It gives them what they need: food, water and shelter. A woodland is a habitat for squirrels and owls. A polar bear is suited to a cold, icy habitat.

A **microhabitat** is a very small habitat, like under a stone or in a pile of leaves. Slugs and worms like damp places like these.

## Food chains

A **food chain** shows what eats what. The arrow means "goes to". It points from the food to the animal that eats it.

**lettuce → slug → hedgehog**

The slug eats the lettuce. The hedgehog eats the slug. Food chains start with a plant.

**Worked example:** seaweed → limpet → seagull. The limpet eats the seaweed and the seagull eats the limpet.`,
      },
      quiz: {
        title: "Living Things & Their Habitats: Year 2 quiz",
        questions: [
          single("living-y2-01", "Which one is alive?", ["A pebble", "A toy car", "A cat", "A chair"], 2, "A cat is alive. It grows and needs food and water. The others were never alive.", 1),
          single("living-y2-02", "Which one was NEVER alive?", ["A dead leaf", "A rock", "A fallen twig", "A bone"], 1, "A rock has never been alive. The leaf, twig and bone were all once part of living things.", 1),
          single("living-y2-03", "A home for plants and animals is called a…", ["habit", "hotel", "hospital", "habitat"], 3, "A habitat is where a plant or animal lives.", 1),
          single("living-y2-04", "Look at the food chain.\nWhat does the rabbit eat?", ["The fox", "The grass", "Another rabbit", "Nothing"], 1, "The arrow points from the grass to the rabbit. This means the rabbit eats the grass.", 2, { image: IMG.foodchain, diagnostic: true }),
          single("living-y2-05", "Which one is a microhabitat?", ["A whole desert", "A big woodland", "Under a log", "The sea"], 2, "A microhabitat is a very small habitat. Under a log is small, damp and dark.", 2),
          single("living-y2-06", "A pond is a good habitat for a frog.\nWhy?", ["It has water, food and places to hide", "It is dry and has no water in it", "It has no food for a frog to eat", "It is frozen solid all year round"], 0, "A habitat gives animals what they need: water, food and shelter. A pond gives a frog all three.", 2, { diagnostic: true }),
          multi("living-y2-07", "Which TWO things are true of living things?", ["They grow", "They need water", "They have a battery", "They can be switched on"], [0, 1], "Living things grow and need water. Batteries and switches belong to machines, which are not alive.", 2),
          single("living-y2-08", "A fallen leaf is dead.\nWas it ever alive?", ["No, only the tree was alive", "It is still alive", "Yes, it was once alive", "No, it was never alive"], 2, "Dead things were once alive. The leaf was once part of a living tree.", 2),
          single("living-y2-09", "Which is a correct food chain?", ["Blue tit → caterpillar → leaf", "Caterpillar → leaf → blue tit", "Leaf → blue tit → caterpillar", "Leaf → caterpillar → blue tit"], 3, "The arrows point to the eater. The caterpillar eats the leaf and the blue tit eats the caterpillar.", 3),
          single("living-y2-10", "A pond dries up.\nWhat might happen to the frogs?", ["They may have to move, or may not survive", "Nothing happens to the frogs at all", "They turn into fish and swim away", "They fly up and live in the air"], 0, "Frogs need the pond habitat for water and food. Without it they must find a new home or they may not survive.", 3),
        ],
      },
      flashcards: [
        { front: "Living", back: "Alive now. It grows and needs food or water." },
        { front: "Dead", back: "It was once alive but is not alive now, like a dead beetle." },
        { front: "Never alive", back: "It has never been alive, like sand or a plastic cup." },
        { front: "Habitat", back: "The place where a plant or animal lives. It gives food, water and shelter." },
        { front: "Microhabitat", back: "A very small habitat, like under a stone or in a pile of leaves." },
        { front: "Food chain", back: "Shows what eats what, using arrows, like lettuce → slug → hedgehog." },
        { front: "In a food chain, what does the arrow mean?", back: "It points from the food to the animal that eats it." },
        { front: "What does every food chain start with?", back: "A plant." },
        { front: "Name a woodland habitat animal", back: "Squirrel, badger, owl or woodpecker." },
        { front: "Name an animal suited to a cold, icy habitat", back: "A polar bear." },
      ],
    },
  },
};
