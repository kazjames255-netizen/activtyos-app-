// KS2 Science — States of Matter (Year 4). Original content aligned to the DfE National Curriculum (OGL v3.0).
// Graph/number keys are recomputed by _check_s2.ts from _s2data.ts (the data that draws the images).
import type { CTopic } from "../types";

const HEAT_ALT = "Line graph of temperature against time as a beaker of ice is heated. The temperature rises from minus 10 to 0 degrees Celsius in the first 2 minutes, stays flat at 0 degrees until 6 minutes, rises steeply to 100 degrees by 14 minutes, then stays flat at 100 degrees until 24 minutes.";
const WC_ALT = "A diagram of the water cycle with a sun, sea, cloud and mountain. Letter A marks an arrow rising from the sea, B marks an arrow going into the cloud, C marks rain falling from the cloud, and D marks water flowing down the mountain side back to the sea.";

export const TOPIC: CTopic = {
  key: "states",
  topic: "States of Matter",
  subject: "Science",
  years: {
    4: {
      year: 4,
      objectives: [
        "Compare and group materials together, according to whether they are solids, liquids or gases.",
        "Observe that some materials change state when they are heated or cooled, and measure or research the temperature at which this happens in degrees Celsius (°C).",
        "Identify the part played by evaporation and condensation in the water cycle and associate the rate of evaporation with temperature.",
        "Working scientifically: read a line graph of temperature against time.",
      ],
      note: {
        title: "Year 4: solids, liquids, gases and the water cycle",
        body: `## Three states of matter
| State | Shape | Can it flow? | Can it be squashed? |
| --- | --- | --- | --- |
| **Solid** | Keeps its own shape | No | Hardly at all |
| **Liquid** | Takes the shape of its container | Yes | Hardly at all |
| **Gas** | Spreads out to fill its container | Yes | Yes, easily |

## Changing state
Heating or cooling can change a material's state.
- **Melting:** solid to liquid (heat).
- **Freezing:** liquid to solid (cool).
- **Evaporating:** liquid to gas (heat). **Boiling** is when bubbles of gas form all through the liquid at its boiling point.
- **Condensing:** gas to liquid (cool).

Pure water freezes and melts at **0 °C** and boils at **100 °C**. While a substance is changing state, its temperature stays the same for a while, which shows up as a flat part on a temperature graph.

## The water cycle
1. The Sun warms the sea, rivers and puddles, and water **evaporates** into the air as an invisible gas (water vapour).
2. Higher up, it cools and **condenses** into tiny droplets that make clouds.
3. Water falls as rain, hail or snow. This is **precipitation**.
4. It runs into rivers, lakes and the sea (**collection**), and the cycle starts again.

**Worked example 1:** Wet washing dries faster on a hot day than a cold day, because evaporation is quicker when it is warmer.

**Worked example 2:** A chocolate bar melts in a warm hand. It changes from a solid to a liquid at about 34 °C.

**Worked example 3:** A cold glass of lemonade gets droplets on the outside. Water vapour in the air touches the cold glass and condenses.`,
      },
      quiz: {
        title: "States of Matter: Year 4 quiz",
        questions: [
          { key: "states-y4-01", kind: "single", prompt: "Which of these is a gas?", options: ["The helium in a balloon", "The ice in a freezer", "Orange juice in a glass", "The sand on a beach"], answer: "The helium in a balloon", explanation: "Helium is a gas. It spreads out to fill the balloon.", difficulty: 1 },
          { key: "states-y4-02", kind: "single", prompt: "Which sentence describes a solid?", options: ["It takes the shape of its container and can be poured", "It spreads out to fill any container", "It keeps its own shape and cannot be poured", "It can be squashed into a small space easily"], answer: "It keeps its own shape and cannot be poured", explanation: "A solid keeps its shape. Liquids can be poured and gases spread out.", difficulty: 1 },
          { key: "states-y4-03", kind: "single", prompt: "Look at the graph of ice being heated. At what temperature does the ice start to melt?", options: ["−10 °C", "10 °C", "0 °C", "100 °C"], answer: "0 °C", explanation: "The line reaches 0 °C and goes flat while the ice melts.", difficulty: 2, diagnostic: true, image: { file: "states-heating.png", alt: HEAT_ALT } },
          { key: "states-y4-04", kind: "single", prompt: "Look at the graph. At what temperature does the water boil?", options: ["0 °C", "50 °C", "120 °C", "100 °C"], answer: "100 °C", explanation: "The line goes flat again at 100 °C. Water boils at 100 °C.", difficulty: 1, image: { file: "states-heating.png", alt: HEAT_ALT } },
          { key: "states-y4-05", kind: "number", prompt: "Look at the graph. What was the temperature after 10 minutes? (Give your answer in °C.)", answer: 50, tolerance: 3, explanation: "From 6 to 14 minutes the line rises steadily from 0 °C to 100 °C. Halfway (10 minutes) it is about 50 °C.", difficulty: 3, image: { file: "states-heating.png", alt: HEAT_ALT } },
          { key: "states-y4-06", kind: "number", prompt: "Look at the graph. For how many minutes did the temperature stay at 0 °C while the ice was melting?", answer: 4, explanation: "The flat part at 0 °C runs from 2 minutes to 6 minutes. That is 6 − 2 = 4 minutes.", difficulty: 2, image: { file: "states-heating.png", alt: HEAT_ALT } },
          { key: "states-y4-07", kind: "single", prompt: "Look at the water cycle. Which letter shows evaporation?", options: ["B", "A", "D", "C"], answer: "A", explanation: "Evaporation is water turning into a gas as the Sun warms the sea. The arrow rising from the sea is A.", difficulty: 2, diagnostic: true, image: { file: "states-watercycle.png", alt: WC_ALT } },
          { key: "states-y4-08", kind: "single", prompt: "Look at the water cycle. Which letter shows condensation, where water vapour cools into droplets to make a cloud?", options: ["A", "C", "D", "B"], answer: "B", explanation: "Condensation is a gas cooling into a liquid. The arrow going into the cloud is B.", difficulty: 2, image: { file: "states-watercycle.png", alt: WC_ALT } },
          { key: "states-y4-09", kind: "single", prompt: "Two equal puddles are left outside. One is on a warm, sunny day and one on a cold, cloudy day. Which dries first, and why?", options: ["The cold one, because water evaporates faster in the cold", "They dry at the same speed, because the size of the puddle is what matters","The warm one, because water evaporates faster when it is warmer", "Neither can dry"], answer: "The warm one, because water evaporates faster when it is warmer", explanation: "The higher the temperature, the faster water evaporates.", difficulty: 3 },
          { key: "states-y4-10", kind: "short", prompt: "What is the word for a liquid changing into a gas?", answer: "evaporation", accepted: ["evaporating", "evaporates", "evaporate", "boiling", "evaporation.", "evapouration", "evaperation", "evapoation", "vaporisation", "vaporization"], explanation: "When a liquid turns into a gas it evaporates.", difficulty: 2 },
        ],
      },
      flashcards: [
        { front: "Solid", back: "Keeps its shape; does not flow." },
        { front: "Liquid", back: "Flows and takes the shape of its container." },
        { front: "Gas", back: "Spreads out to fill its container; can be squashed." },
        { front: "Melting", back: "Solid to liquid, by heating." },
        { front: "Freezing", back: "Liquid to solid, by cooling." },
        { front: "Evaporation", back: "Liquid to gas; faster when warmer." },
        { front: "Condensation", back: "Gas to liquid, by cooling." },
        { front: "Melting and boiling points of water", back: "0 °C and 100 °C." },
        { front: "Precipitation", back: "Water falling from clouds as rain, hail or snow." },
        { front: "Four steps of the water cycle", back: "Evaporation, condensation, precipitation, collection." },
      ],
    },
  },
};
