// KS2 Science — Plants (Year 3). Original content aligned to the DfE National Curriculum programme of study (OGL v3.0).
// Numeric/graph keys are recomputed by _check_s2.ts from _s2data.ts (the data that draws the images).
import type { CTopic } from "../types";

export const TOPIC: CTopic = {
  key: "plants",
  topic: "Plants",
  subject: "Science",
  years: {
    3: {
      year: 3,
      objectives: [
        "Identify and describe the functions of different parts of flowering plants: roots, stem/trunk, leaves and flowers.",
        "Explore the requirements of plants for life and growth (air, light, water, nutrients from soil, and room to grow) and how they vary from plant to plant.",
        "Investigate the way in which water is transported within plants.",
        "Explore the part that flowers play in the life cycle of flowering plants, including pollination, seed formation and seed dispersal.",
        "Working scientifically: set up a simple fair test, record results in tables and bar charts, and draw a conclusion.",
      ],
      note: {
        title: "Year 3: parts of a plant, what plants need, and flowers",
        body: `## The parts of a flowering plant

Every part of a plant has a job.

| Part | Its job |
| --- | --- |
| **Roots** | Take in water and nutrients from the soil. They also hold the plant firmly in the ground. |
| **Stem** (or trunk) | Holds the plant up. It carries water and nutrients to the leaves and flowers. |
| **Leaves** | Make the plant's food, using light, water and air. |
| **Flower** | Helps the plant make seeds so that new plants can grow. |

A common mistake is to think plants eat soil. They do not! Plants **make their own food in their leaves**. The soil gives them water and small amounts of nutrients.

## What plants need to grow well
Light, water, air, the right temperature, nutrients from the soil and enough room. Different plants need different amounts: a cactus needs very little water, but a lettuce needs plenty.

## How water travels
Water is taken in by the roots and moves **up the stem** through very narrow tubes to the leaves.

**Worked example 1: the celery test.** Stand a celery stick in water with red ink for a day and cut across it. Little red dots appear inside the stem. They show the tubes that carry water upwards.

## Flowers and seeds
Flowers make seeds. Insects visit flowers for nectar and carry **pollen** from one flower to another. This is **pollination**. After that, seeds form. The seeds are then **dispersed** (spread) so that new plants do not grow crowded under the parent, for example by wind, water, animals or pods that pop open.

**Worked example 2: a fair test.** To test whether cress needs light, put one tray on a windowsill and one in a cupboard. Change **only** the light. Keep the same soil, the same amount of water and the same number of seeds.

**Worked example 3: seed dispersal.** A dandelion seed has a tiny parachute of fluff, so the wind carries it far away.`,
      },
      quiz: {
        title: "Plants: Year 3 quiz",
        questions: [
          { key: "plants-y3-01", kind: "single", prompt: "Look at the picture. Which letter shows the roots?", options: ["A", "B", "C", "D"], answer: "C", explanation: "Roots grow down under the soil. Letter C points to the part below the ground.", difficulty: 1, image: { file: "plants-parts.png", alt: "A flowering plant growing in soil with four parts marked by lettered circles. A points to a leaf, B to the flower at the top, C to the roots under the soil and D to the stem." } },
          { key: "plants-y3-02", kind: "short", prompt: "Name the part of a plant that takes in water from the soil.", answer: "roots", accepted: ["root", "the roots", "the root", "roots.", "root.", "its roots", "the roots."], explanation: "The roots soak up water and nutrients from the soil.", difficulty: 1 },
          { key: "plants-y3-03", kind: "single", prompt: "Look at the picture. Which letter shows the part that holds the plant up and carries water to the leaves?", options: ["B", "D", "A", "C"], answer: "D", explanation: "The stem holds the plant up and has narrow tubes that carry water to the leaves and flower. That is letter D.", difficulty: 2, image: { file: "plants-parts.png", alt: "A flowering plant growing in soil with four parts marked by lettered circles. A points to a leaf, B to the flower at the top, C to the roots under the soil and D to the stem." } },
          { key: "plants-y3-04", kind: "single", prompt: "Where do most plants make their food?", options: ["In the roots", "In the soil", "In the leaves", "In the petals"], answer: "In the leaves", explanation: "Leaves use light, water and air to make the plant's food. The soil does not contain ready-made food for the plant.", difficulty: 2, diagnostic: true },
          { key: "plants-y3-05", kind: "single", prompt: "Which of these does a healthy plant NOT need in order to grow well?", options: ["Light from the Sun", "Water from the soil", "Air around the leaves", "Sweets poured onto the soil"], answer: "Sweets poured onto the soil", explanation: "Plants need light, water, air, warmth, nutrients and space. They make their own sugary food in their leaves, so they do not need sweets.", difficulty: 2 },
          { key: "plants-y3-06", kind: "single", prompt: "Some bean plants were grown for two weeks in different places. Look at the chart. Which plant had the most healthy leaves?", options: ["Light + water", "Light, no water", "Dark + water", "Dark, no water"], answer: "Light + water", explanation: "Find the tallest bar. The plant that had light and water had the most healthy leaves.", difficulty: 1, image: { file: "plants-leaves.png", alt: "Bar chart of healthy green leaves on bean plants after two weeks. Light and water: 12 leaves. Light but no water: 3. Dark with water: 4. Dark and no water: 1." } },
          { key: "plants-y3-07", kind: "number", prompt: "Use the chart. How many more healthy leaves did the plant in the light with water have than the plant in the dark with water?", answer: 8, explanation: "Read both bars: 12 leaves and 4 leaves. Then subtract: 12 − 4 = 8.", difficulty: 2, image: { file: "plants-leaves.png", alt: "Bar chart of healthy green leaves on bean plants after two weeks. Light and water: 12 leaves. Light but no water: 3. Dark with water: 4. Dark and no water: 1." } },
          { key: "plants-y3-08", kind: "single", prompt: "A white flower stands in a jar of water with blue ink. After a day its petals have gone blue. What does this show?", options: ["The roots of the plant make blue ink themselves","Water moves up the stem to the flower", "The flower needs blue light", "Petals make water"], answer: "Water moves up the stem to the flower", explanation: "The blue water travelled up the stem and into the petals. This shows that stems carry water upwards.", difficulty: 2, diagnostic: true },
          { key: "plants-y3-09", kind: "multi", prompt: "Which TWO jobs do flowers do in the life cycle of a plant?", options: ["Help to make seeds", "Attract insects that carry pollen", "Take in water from the soil", "Fix the plant in the ground"], answer: ["Help to make seeds", "Attract insects that carry pollen"], explanation: "Flowers make seeds, and their colour and nectar bring insects that move pollen. Roots take in water and fix the plant in the ground.", difficulty: 3 },
          { key: "plants-y3-10", kind: "single", prompt: "Mia kept a healthy plant in a dark cupboard for two weeks and it became pale and weak. What is the best reason?", options: ["It had too much air and not enough soil", "The leaves could not make food without light", "The stem grew too many roots", "It was too cold for the soil"], answer: "The leaves could not make food without light", explanation: "Leaves need light to make food. With no light the plant cannot make enough food, so it becomes weak.", difficulty: 3 },
        ],
      },
      flashcards: [
        { front: "What do roots do?", back: "Take in water and nutrients from the soil and hold the plant in the ground." },
        { front: "What does the stem do?", back: "Holds the plant up and carries water to the leaves and flowers." },
        { front: "What do leaves do?", back: "Make the plant's food using light, water and air." },
        { front: "What does a flower do?", back: "Helps the plant make seeds." },
        { front: "Do plants get food from the soil?", back: "No. They make their own food in their leaves. Soil gives water and nutrients." },
        { front: "Five things plants need", back: "Light, water, air, the right temperature, nutrients (and room to grow)." },
        { front: "Pollination", back: "Moving pollen from one flower to another (often by insects)." },
        { front: "Seed dispersal", back: "Spreading seeds away from the parent plant: wind, water, animals or pods that burst." },
        { front: "How does water travel in a plant?", back: "Up the stem through very narrow tubes to the leaves and flowers." },
        { front: "In a fair test, what do you change?", back: "Only ONE thing. Everything else stays the same." },
      ],
    },
  },
};
