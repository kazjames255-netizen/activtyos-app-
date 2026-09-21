// A-level Biology — Ecosystems & Populations (Year 13). Original content aligned to the DfE GCE AS/A-level biology subject content.
// Computable keys recomputed by _check_s5.ts.
import type { CTopic } from "../types";

const WEB_ALT = "A food web with seven organisms and arrows pointing from the organism eaten to the organism that eats it. Grass has arrows to grasshopper and to rabbit. Grasshopper has an arrow to frog. Frog has an arrow to snake. Snake has an arrow to hawk. Rabbit has arrows to fox and to hawk.";
const PYR_ALT = "Three horizontal bars centred on each other showing energy stored in each trophic level in kilojoules per square metre per year: producers 25,000 (widest bar), primary consumers 2,900 and secondary consumers 270 (narrowest bar).";

export const TOPIC: CTopic = {
  key: "b5eco",
  topic: "Biology — Ecosystems & Populations",
  subject: "Science",
  years: {
    13: {
      year: 13,
      subtopic: "A-level Year 13 (A2)",
      objectives: [
        "Energy transfer in ecosystems: food chains and webs, gross and net primary production, efficiency of transfer.",
        "Nutrient cycles: nitrogen cycle and phosphorus cycle; the effects of fertilisers and eutrophication.",
        "Succession: primary and secondary; pioneer and climax communities.",
        "Populations: carrying capacity, limiting factors, competition, predation, and estimating population size (mark–release–recapture).",
      ],
      note: {
        title: "Ecosystems: energy flow, nutrient cycles and populations",
        body: `## Energy flow

Producers capture light energy. **Gross primary production (GPP)** is the total chemical energy fixed by plants; **net primary production (NPP)** is what is left after respiration (R): **NPP = GPP − R**. Only NPP is available to the next trophic level. Energy is lost between levels because not all of an organism is eaten, not all of what is eaten is digested (lost in faeces), and much is lost as heat from **respiration**. This limits food chains to about four or five links.

**Efficiency of transfer** = energy passed on ÷ energy available × 100.

| Term | Meaning |
| --- | --- |
| Biomass | Mass of living material in a given area |
| Trophic level | Feeding position in a food chain |
| Carrying capacity | Maximum population an environment can sustain |
| Pioneer species | First colonisers of a bare area |
| Climax community | Stable community at the end of succession |

## Nutrient cycles and succession

In the **nitrogen cycle**: **nitrogen fixation** (N₂ to ammonium by *Rhizobium* or free-living bacteria); **ammonification** (saprobionts release ammonia from proteins and urea); **nitrification** (ammonium → nitrite → nitrate by aerobic bacteria); **denitrification** (nitrate → N₂ in waterlogged soil). Over-use of fertilisers causes **eutrophication**. During **succession** pioneer species change the environment (e.g. forming soil), allowing new species to replace them until a climax community is reached.

## Populations

**Abiotic** and **biotic** factors limit populations. Competition and predation are **density-dependent**. Population size of a mobile animal can be estimated by **mark–release–recapture**:

**N = (M × n) ÷ m**

where M = number marked, n = size of second sample and m = number recaptured.

## Worked calculations

**NPP:** GPP is 20 000 and respiration is 8000 kJ m⁻² year⁻¹, so NPP = **12 000**.

**Efficiency:** prey stores 1800 kJ and its predator gains 216 kJ: 216 ÷ 1800 × 100 = **12%**.

**Lincoln:** 40 marked; second sample of 30 had 6 marked: N = 40 × 30 ÷ 6 = **200**.`,
      },
      quiz: {
        title: "Ecosystems and populations: Year 13 quiz",
        questions: [
          { key: "b5eco-y13-01", kind: "multi", prompt: "Which organisms in the food web are primary consumers?", options: ["Grass", "Grasshopper", "Rabbit", "Frog", "Fox"], answer: ["Grasshopper", "Rabbit"], explanation: "Primary consumers eat producers directly: the grasshopper and the rabbit both eat grass.", difficulty: 1, image: { file: "eco-web.png", alt: WEB_ALT } },
          { key: "b5eco-y13-02", kind: "single", prompt: "What do the arrows in a food web show?", options: ["The direction in which the animals migrate through the ecosystem during the year", "Which organism is bigger and therefore feeds on the smaller one", "The direction of energy transfer, from the organism eaten to the organism that eats it", "The direction in which nutrients are recycled from the decomposers back to the producers"], answer: "The direction of energy transfer, from the organism eaten to the organism that eats it", explanation: "Arrows point from the food to the feeder, showing the flow of energy and biomass.", difficulty: 1, image: { file: "eco-web.png", alt: WEB_ALT } },
          { key: "b5eco-y13-03", kind: "single", prompt: "What is meant by the carrying capacity of an environment?", options: ["The maximum population size that an environment can sustain over time", "The largest number of individuals that a species has ever reached in its history", "The number of different species that are able to live in the environment", "The total mass of all the organisms living in the environment"], answer: "The maximum population size that an environment can sustain over time", explanation: "Carrying capacity depends on resources and limiting factors; populations fluctuate around it.", difficulty: 1 },
          { key: "b5eco-y13-04", kind: "number", prompt: "How many different food chains in the web start with grass and end with a hawk or a fox?", answer: 3, explanation: "Grass → grasshopper → frog → snake → hawk; grass → rabbit → fox; grass → rabbit → hawk. That is 3.", difficulty: 2, diagnostic: true, image: { file: "eco-web.png", alt: WEB_ALT } },
          { key: "b5eco-y13-05", kind: "single", prompt: "Which population is most at risk if all the rabbits die of disease?", options: ["Grasshoppers, because they will lose their predator", "Hawks, because they only eat rabbits", "Snakes, because they compete with rabbits", "Foxes, because rabbits are their only food source in this web"], answer: "Foxes, because rabbits are their only food source in this web", explanation: "The fox has only one arrow leading to it, from the rabbit; the hawk can still eat snakes.", difficulty: 2, image: { file: "eco-web.png", alt: WEB_ALT } },
          { key: "b5eco-y13-06", kind: "number", prompt: "Calculate the percentage efficiency of energy transfer from primary consumers to secondary consumers. Give your answer to 1 decimal place.", answer: 9.3, tolerance: 0.1, explanation: "Efficiency = energy in secondary consumers ÷ energy in primary consumers × 100 = 270 ÷ 2900 × 100 = 9.3%.", difficulty: 2, diagnostic: true, image: { file: "eco-pyramid.png", alt: PYR_ALT } },
          { key: "b5eco-y13-07", kind: "number", prompt: "In a field, gross primary production is 12 400 kJ m⁻² year⁻¹ and plant respiration uses 4500 kJ m⁻² year⁻¹. Calculate the net primary production in kJ m⁻² year⁻¹.", answer: 7900, explanation: "NPP = GPP − R = 12 400 − 4500 = 7900 kJ m⁻² year⁻¹.", difficulty: 2 },
          { key: "b5eco-y13-08", kind: "single", prompt: "Which process in the nitrogen cycle converts ammonium ions into nitrate ions?", options: ["Nitrogen fixation", "Nitrification", "Ammonification", "Denitrification"], answer: "Nitrification", explanation: "Nitrifying bacteria oxidise ammonium to nitrite and then to nitrate in aerobic soil.", difficulty: 2 },
          { key: "b5eco-y13-09", kind: "number", prompt: "In a mark–release–recapture study of beetles, 60 were marked and released. A second sample of 50 contained 10 marked beetles. Estimate the population size.", answer: 300, explanation: "N = (M × n) ÷ m = (60 × 50) ÷ 10 = 300.", difficulty: 2 },
          { key: "b5eco-y13-10", kind: "single", prompt: "Why are pioneer species important in primary succession?", options: ["They are the tallest plants of the climax community and shade out other species", "They are the only species that can photosynthesise, so all other species feed on them", "They colonise bare ground, and their growth and decay make the soil more suitable for other species", "They prevent other species from arriving by using up all the light and nutrients in the bare ground"], answer: "They colonise bare ground, and their growth and decay make the soil more suitable for other species", explanation: "Pioneers tolerate harsh conditions; their death and decay add organic matter and change abiotic conditions so other species can establish.", difficulty: 2 },
          { key: "b5eco-y13-11", kind: "single", prompt: "Fertiliser runs into a lake. Which sequence best explains the deaths of fish?", options: ["Nitrate encourages algal blooms; light is blocked so submerged plants die; decomposers' respiration reduces oxygen so fish suffocate", "Nitrate makes the submerged plants grow much faster, so they release so much oxygen during the day that the water becomes toxic and the fish are poisoned", "Nitrate is toxic to fish gills directly, so the fish die before any other change occurs in the lake", "Algae eat the fish and the dead fish then use up the oxygen in the lake"], answer: "Nitrate encourages algal blooms; light is blocked so submerged plants die; decomposers' respiration reduces oxygen so fish suffocate", explanation: "Eutrophication: nutrient enrichment, algal bloom, light blocked, plant death, aerobic bacteria multiply and use up oxygen.", difficulty: 3 },
          { key: "b5eco-y13-12", kind: "single", prompt: "In a predator–prey cycle the peak in predator numbers occurs after the peak in prey numbers. What is the explanation?", options: ["Predators have more offspring than prey, so their numbers always overshoot those of the prey", "Predators make prey reproduce faster by removing the weakest individuals from the population", "Prey numbers are limited by the weather only, so the predators simply follow the temperature", "As prey increase, more food is available so predator numbers rise with a time lag; then predators reduce prey"], answer: "As prey increase, more food is available so predator numbers rise with a time lag; then predators reduce prey", explanation: "Predator numbers depend on prey availability and take time to rise; they then reduce prey numbers, causing a fall in predators later.", difficulty: 3 },
          { key: "b5eco-y13-13", kind: "single", prompt: "Why do food chains rarely have more than five trophic levels?", options: ["Predators at higher trophic levels grow steadily larger at each step, so beyond four or five levels they become too large to be supported by their environment", "Energy is lost at each transfer (heat from respiration, uneaten parts, faeces), so too little remains at the top to support more levels", "Top predators are unable to digest food that has passed through so many other animals", "Plants only contain enough energy for five levels because of photosynthesis limits"], answer: "Energy is lost at each transfer (heat from respiration, uneaten parts, faeces), so too little remains at the top to support more levels", explanation: "Because only roughly 10% of energy passes to the next level, energy runs out after a few links.", difficulty: 3 },
          { key: "b5eco-y13-14", kind: "written", prompt: "Describe how mark–release–recapture could be used to estimate the population size of ground beetles in a field, and state three assumptions of the method. (6 marks)", answer: "See mark scheme in the explanation.", explanation: "Mark scheme (6 marks): capture a sample using pitfall traps and count them; mark each beetle in a way that does not harm it or affect survival/predation (e.g. tiny dot of non-toxic paint underneath); release them where captured and allow time to mix; capture a second sample and count marked and unmarked; N = (number in first sample × number in second sample) ÷ number of marked recaptured; assumptions (any 3): no immigration or emigration; no births or deaths; marks are not lost; marked individuals mix randomly and are equally likely to be recaptured.", difficulty: 3 },
        ],
      },
      flashcards: [
        { front: "NPP formula", back: "NPP = GPP − R (respiratory losses)." },
        { front: "Why is energy lost between trophic levels?", back: "Not all eaten or digested; respiration releases heat; excretion." },
        { front: "Efficiency of energy transfer", back: "Energy passed on ÷ energy available × 100." },
        { front: "Nitrogen fixation", back: "N₂ to ammonium by Rhizobium or free-living bacteria." },
        { front: "Nitrification", back: "Ammonium to nitrite to nitrate by aerobic bacteria." },
        { front: "Denitrification", back: "Nitrate to nitrogen gas by anaerobic bacteria in waterlogged soil." },
        { front: "Eutrophication chain", back: "Nutrients, algal bloom, light blocked, plants die, decomposition uses oxygen, fish die." },
        { front: "Pioneer species", back: "First colonisers of bare ground; change the environment for others." },
        { front: "Lincoln index", back: "N = (M × n) ÷ m." },
        { front: "Density-dependent factors", back: "Competition, predation and disease: effect depends on population density." },
      ],
    },
  },
};
