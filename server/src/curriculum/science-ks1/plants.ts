// KS1 Science — Plants (Years 1–2). Original content aligned to the DfE National Curriculum programme of study (OGL v3.0).
// Structural checks (answers in options, positions, counts) are in _check_s1.ts — re-run it after ANY edit here.
import type { CTopic } from "../types";
import { IMG, multi, single } from "./_h";

export const TOPIC: CTopic = {
  key: "plants",
  topic: "Plants",
  subject: "Science",
  years: {
    1: {
      year: 1,
      objectives: [
        "Identify and name a variety of common wild and garden plants, including deciduous and evergreen trees.",
        "Identify and describe the basic structure of a variety of common flowering plants, including trees.",
      ],
      note: {
        title: "Year 1: naming plants and their parts",
        body: `## What you need to know

Plants are living things. They come in lots of shapes and sizes, from tiny buttercups to giant sycamore trees.

**Wild plants** grow on their own, like a buttercup or a bluebell. **Garden plants** are planted and looked after by people, like marigolds and pansies.

## The parts of a plant

| Part | What it does |
| --- | --- |
| **Roots** | Grow under the soil. They hold the plant in place and take in water. |
| **Stem** | Holds the plant up. On a tree the stem is called the **trunk**. |
| **Leaves** | Grow out of the stem. Most are green. |
| **Flower** | The colourful part at the top of many plants. |

## Trees

Some trees are **deciduous**. They lose their leaves in autumn. Sycamore and ash are deciduous.

Some trees are **evergreen**. They keep green leaves all year. Holly and yew are evergreen.

## Worked example

Look at a poppy. Its red flower is at the top. Below it is a green stem. Leaves grow from the stem. Under the soil are its roots.

**Try it:** go for a walk. How many different wild plants and trees can you name?`,
      },
      quiz: {
        title: "Plants: Year 1 quiz",
        questions: [
          single("plants-y1-01", "Which of these is a tree?", ["A daisy", "A tulip", "A dandelion", "An oak"], 3, "An oak is a big tree with a trunk and branches. A daisy, tulip and dandelion are small plants.", 1),
          single("plants-y1-02", "Look at the picture.\nWhich letter shows the roots?", ["A", "B", "C", "D"], 2, "Roots grow under the soil. Letter C points to the roots.", 1, { image: IMG.plantparts }),
          single("plants-y1-03", "Which part of a plant is often colourful and at the top?", ["The flower", "The roots", "The stem", "The soil"], 0, "The flower is the colourful part. The soil is not part of the plant.", 1),
          single("plants-y1-04", "Look at the picture.\nWhich letter shows the stem?", ["A", "B", "C", "D"], 0, "The stem is the long green part that holds the plant up. That is letter A.", 2, { image: IMG.plantparts, diagnostic: true }),
          single("plants-y1-05", "What does the stem do?", ["It is the coloured part", "It grows under the ground", "It holds the plant up", "It is a baby plant"], 2, "The stem holds the plant up so the leaves and flower can reach the light.", 2),
          single("plants-y1-06", "Which tree keeps its green leaves all year?", ["A pine", "A beech", "A silver birch", "A horse chestnut"], 0, "A pine is an evergreen tree, so it keeps its leaves. The others are deciduous and lose their leaves in autumn.", 2),
          single("plants-y1-07", "Which one is a wild plant?", ["A rose in a flowerbed", "A dandelion by the path", "A sunflower in a garden", "A tulip in a pot"], 1, "A wild plant grows on its own. Someone planted the other three.", 2, { diagnostic: true }),
          multi("plants-y1-08", "Which TWO are parts of a plant?", ["Leaves", "Wheels", "Roots", "Wings"], [0, 2], "Plants have leaves and roots. Wheels and wings are not parts of plants.", 2),
          single("plants-y1-09", "We eat lettuce.\nWhich part of the plant is it?", ["The roots", "The flower", "The leaves", "The seed"], 2, "Lettuce is the leaves of the plant. We eat different parts of different plants.", 3),
          single("plants-y1-10", "A tree's trunk is like which part of a small plant?", ["A leaf", "A stem", "A flower", "A root"], 1, "A trunk is a big, strong stem. It holds up the branches and leaves.", 3),
        ],
      },
      flashcards: [
        { front: "Roots", back: "They grow under the soil. They hold the plant in place and take in water." },
        { front: "Stem", back: "It holds the plant up." },
        { front: "Leaves", back: "They grow out of the stem. Most leaves are green." },
        { front: "Flower", back: "The colourful part at the top of many plants." },
        { front: "Trunk", back: "The thick stem of a tree." },
        { front: "Wild plant", back: "A plant that grows on its own, like a buttercup or a bluebell." },
        { front: "Garden plant", back: "A plant that people plant and look after, like a marigold or a pansy." },
        { front: "Deciduous tree", back: "A tree that loses its leaves in autumn, like a sycamore or an ash." },
        { front: "Evergreen tree", back: "A tree that keeps its green leaves all year, like a holly or a yew." },
        { front: "Name the four main parts of a flowering plant", back: "Roots, stem, leaves and flower." },
      ],
    },
    2: {
      year: 2,
      objectives: [
        "Observe and describe how seeds and bulbs grow into mature plants.",
        "Find out and describe how plants need water, light and a suitable temperature to grow and stay healthy.",
      ],
      note: {
        title: "Year 2: how plants grow and what they need",
        body: `## Seeds and bulbs

Many plants grow from **seeds**, like cress, marigolds and pumpkins. Some grow from **bulbs**, like crocuses, snowdrops and onions.

A seed grows in steps:
1. The seed takes in water and swells up.
2. A root grows down and a tiny shoot grows up.
3. Leaves open. It is now a **seedling**.
4. It grows into a **mature plant**, which is fully grown.

## What plants need

To grow well and stay healthy, plants need:
- **water**
- **light**
- a **suitable temperature** (not too hot and not too cold)

Without water, a plant droops and dries out. Without light, it becomes pale and weak.

## Working scientifically: a fair test

Mo wants to find out if the temperature matters. He grows cress in two pots. One pot is in a warm room. The other is in a cool room.

Everything else must stay the **same**: the same soil, the same seeds, the same water and the same light. Only **one thing** changes. That is a **fair test**.

After a week he **observes** both pots and **measures** the cress. Then he can say what he found out.`,
      },
      quiz: {
        title: "Plants: Year 2 quiz",
        questions: [
          single("plants-y2-01", "Which of these can grow into a new plant?", ["A pebble", "A seed", "A crayon", "A toy"], 1, "A seed can grow into a new plant if it has water and warmth. Pebbles and toys cannot.", 1),
          single("plants-y2-02", "What does a dry, droopy plant need?", ["Sand", "Paint", "Plastic", "Water"], 3, "Plants need water to stay healthy. A dry plant droops.", 1),
          single("plants-y2-03", "Which of these grows from a bulb?", ["A daffodil", "A bean plant", "A sunflower", "A pea plant"], 0, "A daffodil grows from a bulb. Beans, sunflowers and peas grow from seeds.", 1),
          single("plants-y2-04", "Ben watered Pot A every day.\nHe never watered Pot B. What does this show?", ["Plants like music", "Plants need water", "Plants need big pots", "Plants need nothing"], 1, "Everything else was the same, but Pot B drooped without water. So plants need water.", 2, { image: IMG.twopots, diagnostic: true }),
          single("plants-y2-05", "Which comes FIRST when a bean seed starts to grow?", ["Flowers open on the plant", "New seeds are made in pods", "Roots and a tiny shoot appear", "The leaves turn brown and drop"], 2, "A seed first grows a root and a tiny shoot. Flowers come much later.", 2),
          multi("plants-y2-06", "What do plants need to grow well? Pick THREE.", ["Water", "Light", "Loud music", "The right temperature (not too hot or cold)"], [0, 1, 3], "Plants need water, light and a suitable temperature. Music does not help them grow.", 2, { diagnostic: true }),
          single("plants-y2-07", "A plant is kept in a dark cupboard for weeks. What happens?", ["It grows big and green", "It grows more flowers", "It becomes pale and weak", "It turns blue"], 2, "Plants need light. Without it they turn pale and weak.", 2),
          single("plants-y2-08", "Kia tests if plants need light.\nWhat must stay the SAME?", ["The amount of light", "The amount of water", "Which pot is in the cupboard", "Nothing"], 1, "In a fair test only one thing changes (the light). Everything else, like water, stays the same.", 3),
          single("plants-y2-09", "Where will a bean seedling grow best?", ["On a light, warm windowsill", "In a freezer", "In a dark cupboard", "In a bucket of water"], 0, "A seedling needs light, water and a suitable temperature. A freezer is too cold.", 2),
          single("plants-y2-10", "Leo thinks plants in the light grow taller.\nHow can he check?", ["Measure both plants each week", "Sing to the plants every day", "Paint the pots different colours", "Guess which one looks taller"], 0, "Scientists measure and compare. Leo can measure each plant and see which is taller.", 3),
        ],
      },
      flashcards: [
        { front: "Seed", back: "A small thing that can grow into a new plant, like a cress or a pumpkin seed." },
        { front: "Bulb", back: "An underground part that can grow into a plant, like a crocus, snowdrop or onion." },
        { front: "What do plants need to grow?", back: "Water, light and a suitable temperature." },
        { front: "Seedling", back: "A young plant that has just grown from a seed." },
        { front: "Mature plant", back: "A plant that is fully grown." },
        { front: "Order: how a seed grows", back: "Seed, then root and shoot, then seedling with leaves, then mature plant." },
        { front: "What happens if a plant gets no water?", back: "It droops and dries out." },
        { front: "What happens if a plant gets no light for a long time?", back: "It becomes pale and weak." },
        { front: "Suitable temperature", back: "Not too hot and not too cold." },
        { front: "Fair test", back: "Change only ONE thing. Keep everything else the same." },
      ],
    },
  },
};
