// GCSE Biology — Ecology (Year 11).
import type { CTopic } from "../types";
import { N, S, M, W, yr } from "./_h";
import { WEB } from "./_imgdata";

const IMG = ["b4eco-foodweb.png", "A food web with arrows pointing from food to eater. Grass is eaten by rabbit, mouse and grasshopper. The grasshopper is eaten by the frog. The mouse is eaten by the owl and the fox. The rabbit is eaten by the fox. The frog is eaten by the owl."] as [string, string];

const paths = (from: string): string[][] => {
  const next = WEB.filter(([a]) => a === from).map(([, b]) => b);
  if (!next.length) return [[from]];
  return next.flatMap((n) => paths(n).map((p) => [from, ...p]));
};

export const TOPIC: CTopic = {
  key: "b4eco", topic: "Biology — Ecology", subject: "Science",
  years: {
    11: yr("b4eco", 11, {
      obj: [
        "Describe communities, ecosystems, abiotic and biotic factors, interdependence and adaptations.",
        "Use food chains and food webs; describe trophic levels, pyramids of biomass and biomass transfer efficiency.",
        "Describe the carbon and water cycles and the role of decomposers.",
        "Required practical: use quadrats and transects to estimate population size and species distribution.",
        "Describe biodiversity and human impact: waste, deforestation, peat destruction, global warming.",
        "Triple stretch: food security, trophic efficiency in farming, sustainable fishing.",
      ],
      note: ["GCSE Biology: ecosystems and human impact", `## Living together
A **community** is all the populations living in a habitat. Organisms depend on each other (**interdependence**). **Abiotic** factors are non-living (light, temperature, moisture, pH); **biotic** factors are living (food, predators, disease, competition).

## Food chains and webs
**Producers** (photosynthesise) → **primary consumers** → **secondary consumers** → tertiary consumers. Arrows point from food to eater. **Decomposers** return nutrients to the soil. Only some biomass is passed on at each level, because much is lost as heat from respiration, in waste, and in parts not eaten.

**Transfer efficiency = biomass to next level ÷ biomass at this level × 100.**

## Sampling
Use **random quadrats** (random coordinates avoid bias) to estimate population size; use a **transect** to show change along an environmental gradient.
population = mean per quadrat × (total area ÷ quadrat area)

## Cycles and human impact
Carbon: **photosynthesis** removes CO₂; **respiration**, **combustion** and **decay** return it. Human activity (burning fossil fuels, deforestation, destroying peat bogs) raises CO₂ and methane, contributing to **global warming**, and lowers **biodiversity**.

## Worked example
Quadrat counts (1 m² each): 9, 12, 8, 11, 10. Mean = 50 ÷ 5 = 10 per m². Field area 300 m² → estimate = 10 × 300 = **3000 plants**.

**Working scientifically:** more quadrats make the mean more reliable and reduce the effect of anomalies.`],
      quiz: "GCSE Biology: Ecology quiz",
      qs: [
        S(1, "What is a producer in a food chain?", "An organism that makes its own food by photosynthesis", ["An animal that eats plants", "An organism that breaks down dead material to release energy", "An organism that eats other animals"], "Producers, usually green plants and algae, use light to make glucose. They are the start of a food chain.", {}),
        S(1, "What is the role of decomposers in an ecosystem?", "They break down dead material and return nutrients to the soil", ["They make food by photosynthesis", "They eat only living prey", "They pass energy from the dead material back to the producers as light"], "Bacteria and fungi decompose dead plants and animals, recycling nutrients so producers can use them.", {}),
        S(1, "What is a community?", "All the populations of different species living in the same habitat", ["All the organisms of one single species living together in the same habitat", "The non-living parts of an area", "A group of predators"], "A community is every population in an area interacting; a population is one species only.", {}),
        M(2, "Look at the food web. Which organisms are primary consumers? Choose all that apply.", ["Rabbit", "Mouse", "Grasshopper"], ["Frog", "Fox"], "Primary consumers eat the producer (grass) directly. The frog eats grasshoppers and the fox eats mice and rabbits.", { img: IMG, chk: () => [...new Set(WEB.filter(([a]) => a === "Grass").map(([, b]) => b))].sort() }),
        N(2, "How many different food chains, starting with grass, are shown in the food web?", 4, 0, "Grass → rabbit → fox; grass → mouse → fox; grass → mouse → owl; grass → grasshopper → frog → owl. That is 4 chains.", () => paths("Grass").length, { img: IMG }),
        S(2, "The number of mice falls sharply because of disease. Which prediction is most sensible?", "Foxes and owls have less food, so may eat more rabbits and frogs and their numbers may fall", ["Foxes and owls increase because there are fewer mice to hide in the grass, so they can hunt more easily", "Grass decreases because fewer mice fertilise it", "Rabbits decrease because foxes fight owls"], "Predators lose one prey species. They may switch to other prey (rabbits, frogs) but their populations often fall. Fewer mice also means less grass eaten.", { img: IMG }),
        N(2, "Six 1 m² quadrats contain 4, 7, 5, 6, 3 and 5 daisies. The field is 800 m². Estimate the number of daisies in the field.", 4000, 0, "Mean per m² = (4 + 7 + 5 + 6 + 3 + 5) ÷ 6 = 30 ÷ 6 = 5. Multiply by the area: 5 × 800 = 4000.", () => ((4 + 7 + 5 + 6 + 3 + 5) / 6) * 800, { diag: true }),
        S(2, "Why should quadrats be placed using random coordinates?", "To avoid bias in choosing where to sample", ["To make sure they land on the biggest plants", "So that the counts are as high as possible", "To measure the pH of the soil"], "Random placement gives every position an equal chance, so the sample represents the whole area and is not biased by the person choosing.", {}),
        N(2, "20 000 kJ of energy is stored in the producers. 1 800 kJ is stored in the primary consumers. Calculate the percentage of energy transferred to the primary consumers.", 9, 0.1, "Efficiency = 1 800 ÷ 20 000 × 100 = 9%. The rest is lost as heat, in waste or in uneaten parts.", () => (1800 / 20000) * 100, { diag: true }),
        M(2, "Which of these are biotic factors that can affect a population? Choose all that apply.", ["The availability of food", "A new predator arriving"], ["Light intensity", "Soil pH", "Temperature"], "Biotic factors involve living things: food, predators, competitors, pathogens. Light, pH and temperature are abiotic.", {}),
        S(3, "Why does the biomass at each trophic level decrease going up the food chain?", "Some biomass is lost as heat from respiration, in waste, and as parts not eaten", ["Predators at higher levels kill far more prey than they need to eat", "Animals higher up the food chain are smaller, so each one contains less biomass", "Decomposers destroy most of the biomass before it reaches the next level"], "Energy is transferred, never destroyed. Much of it is used in respiration (lost as heat) or is in faeces and inedible parts, so less biomass is available at each level.", {}),
        S(3, "In a decay experiment, milk with a pH indicator decays faster at 40 °C than at 10 °C, but not at 65 °C. What is the best explanation for 65 °C?", "The enzymes of the decay microbes are denatured and the microbes are killed", ["The microbes respire so fast at 65 °C that they use up the milk before it can decay", "Milk cannot decay above 40 °C because it evaporates before the microbes can feed", "The decomposers digest the indicator first, so the decay cannot be seen"], "Warm temperatures speed up enzyme reactions in microbes, but at 65 °C the enzymes denature and the microbes die, so decay is slow.", {}),
        W("Explain how human activities can reduce biodiversity and describe how biodiversity can be maintained. [6 marks]", "Mark scheme (6): deforestation and land for farming/building destroy habitats (1); pollution and waste harm organisms (1); peat destruction releases CO₂ and destroys habitat (1); burning fossil fuels/global warming changes habitats and ranges (1); maintenance: protected areas, breeding programmes and seed banks (1); reducing deforestation and CO₂ emissions, recycling/waste reduction, or sustainable farming and fishing (1)."),
      ],
      cards: [
        ["Producer", "Makes food by photosynthesis; start of a food chain."],
        ["Community vs population", "Community: all species in a habitat. Population: one species."],
        ["Abiotic vs biotic factors", "Abiotic: non-living (light, temperature, pH). Biotic: living (food, predators, disease)."],
        ["Biomass transfer efficiency", "biomass to next level ÷ biomass at this level × 100."],
        ["Why is biomass lost between trophic levels?", "Heat from respiration, waste, and uneaten parts (bones, roots)."],
        ["Decomposers", "Bacteria and fungi that recycle nutrients from dead material."],
        ["Population estimate from quadrats", "mean per quadrat × (total area ÷ quadrat area)."],
        ["Why random sampling?", "Avoids bias so the sample represents the area."],
        ["Carbon returned to the air by", "Respiration, combustion and decay."],
        ["Greenhouse gases from human activity", "Carbon dioxide and methane."],
        ["Ways to maintain biodiversity", "Protected areas, captive breeding, seed banks, reduce deforestation and waste."],
        ["Transect", "A line across a habitat to show how species change along a gradient."],
      ],
    }),
  },
};
