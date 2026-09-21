// KS2 Science — Properties & Changes of Materials (Year 5). Original content aligned to the DfE National Curriculum (OGL v3.0).
// Graph/number keys are recomputed by _check_s2.ts from _s2data.ts (the data that draws the images).
import type { CTopic } from "../types";

const DISS_ALT = "Bar chart of spoonfuls of sugar that dissolved in 100 millilitres of water. At 10 degrees Celsius: 8 spoonfuls. At 30 degrees: 10. At 50 degrees: 13. At 70 degrees: 17.";
const FILT_ALT = "A funnel lined with a cone of filter paper, held above a beaker. A cloudy mixture of sand and water is being poured in from above (arrow, marked A). B marks the filter paper, C marks the sand collected in the paper, and D marks the clear water in the beaker below.";

export const TOPIC: CTopic = {
  key: "mats",
  topic: "Properties & Changes of Materials",
  subject: "Science",
  years: {
    5: {
      year: 5,
      objectives: [
        "Compare and group together everyday materials on the basis of their properties, including hardness, solubility, transparency, conductivity (electrical and thermal), and response to magnets.",
        "Know that some materials will dissolve in liquid to form a solution, and describe how to recover a substance from a solution.",
        "Use knowledge of solids, liquids and gases to decide how mixtures might be separated, including through filtering, sieving and evaporating.",
        "Give reasons, based on evidence from comparative and fair tests, for the particular uses of everyday materials.",
        "Demonstrate that dissolving, mixing and changes of state are reversible changes.",
        "Explain that some changes result in the formation of new materials, and that this kind of change is not usually reversible, including changes associated with burning and the action of acid on bicarbonate of soda.",
      ],
      note: {
        title: "Year 5: properties, mixtures and changes of materials",
        body: `## Properties of materials
We choose a material for a job because of its **properties**: hardness, whether it dissolves (**solubility**), transparency, whether it conducts **electricity** or **heat**, and whether it is magnetic.

| Job | Good property | Example |
| --- | --- | --- |
| Saucepan base | Conducts heat well | Copper, steel |
| Saucepan handle | Poor conductor of heat (insulator) | Wood, plastic |
| Window | Transparent | Glass |
| Electric wire core | Conducts electricity | Copper |

## Dissolving
When a solid **dissolves** in a liquid it makes a **solution**. Salt and sugar are **soluble**. Sand and flour are **insoluble**. In a fair test on dissolving, vary one thing (such as water temperature) and keep the amount of water, the amount of stirring and the time the same.

## Separating mixtures
| Method | Separates | Example |
| --- | --- | --- |
| **Sieving** | Bigger solid pieces from smaller ones | Pebbles from sand |
| **Filtering** | An insoluble solid from a liquid | Soil from water |
| **Evaporating** | A dissolved solid from a solution | Salt from seawater |
| **Magnet** | Magnetic from non-magnetic solids | Iron filings from sand |

The solid trapped by the filter paper is called the **residue**. The liquid that passes through is the **filtrate**.

## Reversible and irreversible changes
- **Reversible:** dissolving, melting, freezing, evaporating, mixing. You can get the original material back.
- **Irreversible:** a **new material** is made. Burning, baking and cooking an egg cannot be undone. Vinegar mixed with bicarbonate of soda fizzes and makes a new gas.

**Worked example 1:** A mixture of rice and iron filings can be separated with a magnet.
**Worked example 2:** Muddy water can be filtered. Then evaporating the clear liquid leaves any dissolved salt behind.
**Worked example 3:** Wax melts when heated and becomes solid again when cooled. That is reversible. A burnt candle wick cannot become unburnt: irreversible.`,
      },
      quiz: {
        title: "Properties & Changes of Materials: Year 5 quiz",
        questions: [
          { key: "mats-y5-01", kind: "single", prompt: "Which material would be best for the handle of a hot frying pan, so that it does not get hot to hold?", options: ["Copper", "Iron", "Wood", "Steel"], answer: "Wood", explanation: "Wood is a poor conductor of heat (a thermal insulator), so the handle stays cooler. Metals conduct heat well.", difficulty: 1 },
          { key: "mats-y5-02", kind: "short", prompt: "Sand does not dissolve in water. What word describes a material that does not dissolve? (one word)", answer: "insoluble", accepted: ["Insoluble", "not soluble", "insoluble.", "insoluable", "insolube", "unsoluble", "non-soluble", "non soluble"], explanation: "Materials that dissolve are soluble. Materials that do not are insoluble.", difficulty: 1 },
          { key: "mats-y5-03", kind: "single", prompt: "In the sugar test, which one thing did the pupils change on purpose?", options: ["The temperature of the water", "The amount of water", "The type of sugar", "The amount of stirring"], answer: "The temperature of the water", explanation: "The chart shows the water temperature (10 °C to 70 °C) on the bottom. Everything else was kept the same to make it a fair test.", difficulty: 1, image: { file: "mats-dissolve.png", alt: DISS_ALT } },
          { key: "mats-y5-04", kind: "single", prompt: "Look at the chart. What pattern do the results show?", options: ["The colder the water, the more sugar dissolved", "The warmer the water, the more sugar dissolved", "Temperature makes no difference", "The sugar stopped dissolving at 30 °C"], answer: "The warmer the water, the more sugar dissolved", explanation: "The bars get taller as the water gets warmer, so more sugar dissolved in warmer water.", difficulty: 2, image: { file: "mats-dissolve.png", alt: DISS_ALT } },
          { key: "mats-y5-05", kind: "number", prompt: "Look at the chart. How many more spoonfuls of sugar dissolved at 70 °C than at 10 °C?", answer: 9, explanation: "At 70 °C, 17 spoonfuls dissolved. At 10 °C, 8 spoonfuls. Subtract: 17 − 8 = 9.", difficulty: 2, image: { file: "mats-dissolve.png", alt: DISS_ALT } },
          { key: "mats-y5-06", kind: "single", prompt: "Look at the chart. The pupils then test water at 60 °C. Which is the best prediction for the number of spoonfuls that dissolve?", options: ["Less than 8", "Between 13 and 17", "More than 20", "Exactly 10"], answer: "Between 13 and 17", explanation: "60 °C lies between 50 °C (13 spoonfuls) and 70 °C (17 spoonfuls), so the result should lie between those values.", difficulty: 3, image: { file: "mats-dissolve.png", alt: DISS_ALT } },
          { key: "mats-y5-07", kind: "single", prompt: "Look at the filtering picture. Which letter shows the residue, the solid that is trapped and does not go through?", options: ["A", "B", "D", "C"], answer: "C", explanation: "The sand is too big to pass through the tiny holes in the filter paper. It stays behind as the residue (C).", difficulty: 2, diagnostic: true, image: { file: "mats-filter.png", alt: FILT_ALT } },
          { key: "mats-y5-08", kind: "single", prompt: "Which method would you use to get salt back from salty water?", options: ["Evaporation", "Filtering", "Sieving", "Using a magnet"], answer: "Evaporation", explanation: "Salt is dissolved, so it would go straight through a filter. Heating the water evaporates the water and leaves the salt behind.", difficulty: 2, diagnostic: true },
          { key: "mats-y5-09", kind: "single", prompt: "Which of these changes is irreversible?", options: ["Melting chocolate", "Dissolving salt in water", "Baking a cake", "Freezing water"], answer: "Baking a cake", explanation: "Baking makes new materials that cannot be changed back to the ingredients. Melting, dissolving and freezing can be reversed.", difficulty: 2 },
          { key: "mats-y5-10", kind: "multi", prompt: "Which TWO are reversible changes?", options: ["Melting butter", "Dissolving sugar in tea", "Burning paper", "Mixing vinegar with bicarbonate of soda"], answer: ["Melting butter", "Dissolving sugar in tea"], explanation: "Butter goes solid again when cooled, and sugar can be recovered by evaporating the tea. Burning and the vinegar–bicarbonate fizz make new materials.", difficulty: 3 },
        ],
      },
      flashcards: [
        { front: "Soluble", back: "Dissolves in a liquid to make a solution (sugar, salt)." },
        { front: "Insoluble", back: "Does not dissolve (sand, flour)." },
        { front: "Sieving", back: "Separates bigger solid pieces from smaller ones." },
        { front: "Filtering", back: "Separates an insoluble solid from a liquid." },
        { front: "Evaporating", back: "Gets a dissolved solid back from a solution." },
        { front: "Residue and filtrate", back: "The solid left in the filter paper; the liquid that passes through." },
        { front: "Reversible change", back: "Can be undone, e.g. melting, freezing, dissolving." },
        { front: "Irreversible change", back: "Makes a new material, e.g. burning, baking." },
        { front: "Thermal insulator", back: "A material that does not let heat pass easily (wood, plastic, wool)." },
        { front: "Vinegar + bicarbonate of soda", back: "Fizzes and makes a new gas: an irreversible change." },
      ],
    },
  },
};
