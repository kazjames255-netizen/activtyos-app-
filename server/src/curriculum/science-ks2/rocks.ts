// KS2 Science — Rocks (Year 3). Original content aligned to the DfE National Curriculum (OGL v3.0).
import type { CTopic } from "../types";

const ROCK_ALT = "Bar chart of water soaked up by 100 gram rock samples in one hour. Chalk: 9 millilitres. Sandstone: 7. Slate: 2. Granite: 1.";

export const TOPIC: CTopic = {
  key: "rocks",
  topic: "Rocks",
  subject: "Science",
  years: {
    3: {
      year: 3,
      objectives: [
        "Compare and group together different kinds of rocks on the basis of their appearance and simple physical properties.",
        "Describe in simple terms how fossils are formed when things that have lived are trapped within rock.",
        "Recognise that soils are made from rocks and organic matter.",
        "Working scientifically: carry out a simple comparative test and read results from a bar chart.",
      ],
      note: {
        title: "Year 3: rocks, fossils and soils",
        body: `## Comparing rocks
Rocks are natural materials. We group them by looking at their **properties**:

| Property | Question to ask |
| --- | --- |
| Appearance | Is it shiny or dull? Does it have crystals? Layers? |
| Hardness | Can you scratch it with a coin or a fingernail? |
| Permeability | Does water soak in? A rock that lets water through is **permeable**. |
| Size of grains | Are the bits large or tiny? |

Examples: **granite** is very hard with crystals. **Chalk** is soft and white. **Sandstone** is made of grains of sand stuck together. **Marble** is hard and can be polished.

## Fossils
A **fossil** is the remains or mark of a plant or animal that lived long ago, preserved in rock.
1. An animal dies and is quickly buried in mud or sand.
2. Its soft parts rot away, leaving the hard parts such as shell or bone.
3. Layers build up and, over millions of years, the mud turns to rock.
4. Later the rock wears away and the fossil is found.

## Soil
Soil is made from **tiny pieces of rock** mixed with **dead plant and animal matter** (humus). Rocks are slowly broken up by wind, rain and frost.

**Worked example 1: a hardness test.** Scratch a rock with a copper coin. If the coin leaves a mark, the rock is softer than the coin.

**Worked example 2: a permeability test.** Drip 5 ml of water onto each rock and see how much soaks in. Use the same amount each time to make it fair.

**Worked example 3: sorting.** A rock with shiny crystals that you cannot scratch with a coin could be granite.`,
      },
      quiz: {
        title: "Rocks: Year 3 quiz",
        questions: [
          { key: "rocks-y3-01", kind: "single", prompt: "Which of these is a natural rock?", options: ["Granite", "Plastic", "Brick", "Glass"], answer: "Granite", explanation: "Granite is a rock that forms naturally in the ground. Plastic, brick and glass are made by people.", difficulty: 1 },
          { key: "rocks-y3-02", kind: "single", prompt: "Look at the chart. Which rock soaked up the most water?", options: ["Slate", "Granite", "Chalk", "Sandstone"], answer: "Chalk", explanation: "The tallest bar shows the most water soaked up. Chalk soaked up 9 ml.", difficulty: 1, image: { file: "rocks-water.png", alt: ROCK_ALT } },
          { key: "rocks-y3-03", kind: "number", prompt: "Look at the chart. How many more millilitres of water did chalk soak up than granite?", answer: 8, explanation: "Chalk soaked up 9 ml and granite 1 ml. Subtract: 9 − 1 = 8.", difficulty: 2, image: { file: "rocks-water.png", alt: ROCK_ALT } },
          { key: "rocks-y3-04", kind: "single", prompt: "A builder wants a rock for a garden path in a very rainy place and does not want it to soak up much water. Using the chart, which is the best choice?", options: ["Granite, because it soaked up the least water", "Chalk, because it soaked up the most water", "Sandstone, because it soaked up a lot of water", "Slate, because it soaked up more than granite"], answer: "Granite, because it soaked up the least water", explanation: "The rock with the shortest bar soaked up the least water. That was granite (1 ml).", difficulty: 3, image: { file: "rocks-water.png", alt: ROCK_ALT } },
          { key: "rocks-y3-05", kind: "single", prompt: "A rock lets water soak into it. What word describes this rock?", options: ["Magnetic", "Permeable", "Shiny", "Opaque"], answer: "Permeable", explanation: "A permeable rock has tiny gaps that let water pass in.", difficulty: 2, diagnostic: true },
          { key: "rocks-y3-06", kind: "single", prompt: "What is a fossil?", options: ["A very shiny stone that has been polished smooth by a river over many years", "A living animal that is still alive today, hiding inside a hollow rock", "Any stone that happens to be shaped like an animal, a leaf or a heart", "The remains or marks of a plant or animal that lived long ago, kept in rock"], answer: "The remains or marks of a plant or animal that lived long ago, kept in rock", explanation: "A fossil is what is left of something that lived long ago, preserved in rock.", difficulty: 2, diagnostic: true },
          { key: "rocks-y3-07", kind: "single", prompt: "What is soil made from?", options: ["Only sand", "Tiny pieces of rock mixed with dead plant and animal matter", "Mud that has dried out in the Sun and crumbled into dust", "Crushed glass"], answer: "Tiny pieces of rock mixed with dead plant and animal matter", explanation: "Rock is worn into small pieces, and it mixes with rotted plants and animals to make soil.", difficulty: 2 },
          { key: "rocks-y3-08", kind: "multi", prompt: "Which TWO tests could you use to compare how hard different rocks are?", options: ["Scratch each one with a coin or a nail", "Rub two rocks together and see which one gets scratched", "Weigh each one on a sunny day", "Paint each one a different colour"], answer: ["Scratch each one with a coin or a nail", "Rub two rocks together and see which one gets scratched"], explanation: "A harder material scratches a softer one, so scratching tests compare hardness. Weight and colour do not.", difficulty: 2 },
          { key: "rocks-y3-09", kind: "short", prompt: "Name the soft, white rock that is made from the remains of tiny sea creatures.", answer: "chalk", accepted: ["Chalk", "the chalk", "chalk.", "chalk rock", "chaulk"], explanation: "Chalk is a soft white rock formed from the shells of tiny sea animals.", difficulty: 1 },
          { key: "rocks-y3-10", kind: "single", prompt: "Which list puts the stages of fossil formation in the right order?", options: ["Layers harden into rock, the animal dies, the soft parts rot away, the animal is buried in mud","The animal dies, it is buried in mud, the soft parts rot away, the mud slowly turns to rock", "The soft parts rot away, the animal dies, the mud turns to rock, the animal is buried", "The mud turns to rock, the animal dies, it is buried, the soft parts rot away"], answer: "The animal dies, it is buried in mud, the soft parts rot away, the mud slowly turns to rock", explanation: "First the animal dies and is covered. Then the soft parts rot, and over a very long time the mud hardens into rock.", difficulty: 3 },
        ],
      },
      flashcards: [
        { front: "Permeable", back: "Lets water soak through (like chalk or sandstone)." },
        { front: "How can you test how hard a rock is?", back: "Try to scratch it with a coin, nail or another rock." },
        { front: "Granite", back: "A very hard rock made of crystals; soaks up almost no water." },
        { front: "Chalk", back: "A soft white rock made from tiny sea creatures." },
        { front: "What is a fossil?", back: "The remains or marks of a living thing from long ago, preserved in rock." },
        { front: "Where are fossils found?", back: "In rocks that formed from mud or sand." },
        { front: "What is soil made from?", back: "Tiny pieces of rock plus dead plant and animal matter." },
        { front: "How are rocks broken into soil?", back: "By wind, rain and frost over a very long time." },
        { front: "Why keep a test fair?", back: "Change only one thing and keep everything else the same." },
      ],
    },
  },
};
