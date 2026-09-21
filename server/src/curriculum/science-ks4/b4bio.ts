// GCSE Biology — Bioenergetics (Year 10).
import type { CTopic } from "../types";
import { N, S, M, W, yr } from "./_h";
import { PHOTO } from "./_imgdata";

const IMG = ["b4bio-photosynthesis.png", "A graph of rate of photosynthesis in bubbles per minute against light intensity in arbitrary units from 0 to 6. The line rises in a straight line from the origin then flattens into a horizontal plateau."] as [string, string];

export const TOPIC: CTopic = {
  key: "b4bio", topic: "Biology — Bioenergetics", subject: "Science",
  years: {
    10: yr("b4bio", 10, {
      obj: [
        "Describe photosynthesis as an endothermic reaction and write the word and symbol equations.",
        "Explain the effects of light intensity, carbon dioxide concentration, temperature and chlorophyll as limiting factors; interpret graphs.",
        "Describe uses of the glucose made in photosynthesis.",
        "Describe aerobic and anaerobic respiration (in animals and in yeast) as exothermic reactions.",
        "Explain the body's response to exercise and the oxygen debt; describe metabolism.",
        "Required practical: investigate the effect of light intensity on the rate of photosynthesis (inverse square law at higher tier).",
      ],
      note: ["GCSE Biology: photosynthesis and respiration", `## Photosynthesis (endothermic)
carbon dioxide + water → glucose + oxygen (light energy absorbed by **chlorophyll** in chloroplasts)
6CO₂ + 6H₂O → C₆H₁₂O₆ + 6O₂

The glucose is used for respiration, stored as **starch**, made into **cellulose**, and combined with nitrate ions to make **amino acids** (proteins), or into fats and oils.

## Limiting factors
The factor in **shortest supply** limits the rate: **light intensity**, **carbon dioxide concentration**, **temperature** (enzymes denature at high temperature) and amount of chlorophyll. On a rate graph, the plateau shows another factor has become limiting.

## Respiration (exothermic, in every living cell)
- **Aerobic**: glucose + oxygen → carbon dioxide + water (C₆H₁₂O₆ + 6O₂ → 6CO₂ + 6H₂O)
- **Anaerobic (muscles)**: glucose → **lactic acid**; releases much less energy
- **Anaerobic (yeast)**: glucose → ethanol + carbon dioxide (fermentation)

During exercise, heart and breathing rate rise to supply oxygen. Lactic acid builds up and the **oxygen debt** is repaid afterwards.

## Key equation and worked example
Higher tier: light intensity ∝ 1 ÷ distance². Moving a lamp from 10 cm to 30 cm:
intensity ratio = (10 ÷ 30)² = **0.11** (about a ninth as bright).

**Working scientifically:** in the pondweed practical, count bubbles for a set time, repeat at each distance and calculate a mean; keep temperature constant (use a water bath or heat shield).`],
      quiz: "GCSE Biology: Bioenergetics quiz",
      qs: [
        S(1, "Which word equation summarises photosynthesis?", "Carbon dioxide + water → glucose + oxygen", ["Glucose + oxygen → carbon dioxide + water", "Glucose → lactic acid", "Oxygen + water → glucose + carbon dioxide"], "Plants take in carbon dioxide and water and, using light, make glucose and release oxygen.", {}),
        S(1, "Photosynthesis is an endothermic reaction. What does this mean?", "It takes in energy from the surroundings", ["It releases heat to the surroundings", "It needs no energy input at all to take place", "It only happens at night"], "Endothermic reactions absorb energy; in photosynthesis it is light energy.", {}),
        S(1, "What is made in human muscle cells during anaerobic respiration?", "Lactic acid", ["Ethanol", "Carbon dioxide and water", "Starch"], "In muscles, glucose is partly broken down to lactic acid. Yeast make ethanol and carbon dioxide instead.", {}),
        N(2, "Use the graph to find the light intensity at which the rate of photosynthesis first stops increasing.", 4, 0.2, "The line becomes horizontal (the plateau) at light intensity 4. After this, light is no longer the limiting factor.", () => PHOTO.light[PHOTO.rate.indexOf(Math.max(...PHOTO.rate))], { img: IMG, diag: true }),
        S(2, "At a light intensity of 6 units, which statement about the graph is correct?", "Light is not limiting; carbon dioxide concentration or temperature could be", ["Light is limiting, so more light would raise the rate", "All of the chlorophyll in the leaves has been used up, so the rate cannot rise any further", "Photosynthesis has stopped"], "A plateau means another factor is now in shortest supply, such as CO₂ concentration or temperature.", { img: IMG }),
        N(2, "Between light intensities 0 and 3, calculate how much the rate increases (in bubbles per minute) for each 1 unit increase in light intensity.", 6, 0.1, "Change in rate ÷ change in intensity = (18 − 0) ÷ (3 − 0) = 6 bubbles per minute per unit.", () => (PHOTO.rate[3] - PHOTO.rate[0]) / (PHOTO.light[3] - PHOTO.light[0]), { img: IMG }),
        M(2, "Which are uses of the glucose made by photosynthesis? Choose all that apply.", ["Respiration to release energy", "Stored as starch", "Combined with nitrate ions to make amino acids"], ["Released as a waste gas", "Used to make haemoglobin"], "Plants use glucose in respiration, store it as starch, make cellulose, and combine it with nitrates to make amino acids for proteins.", {}),
        S(2, "Why do heart rate and breathing rate increase during exercise?", "More oxygen and glucose reach the muscles and more carbon dioxide is removed", ["To make the muscles produce lactic acid faster", "To lower the amount of oxygen in the blood", "To stop aerobic respiration in the muscles so that they switch to anaerobic respiration instead"], "Muscles respire faster, so they need more oxygen and glucose and produce more carbon dioxide to be removed.", { diag: true }),
        N(3, "In a practical, a lamp is moved from 10 cm to 20 cm from pondweed. Light intensity is inversely proportional to distance squared. By what fraction does the light intensity change? Give as a decimal (new ÷ old).", 0.25, 0.005, "Intensity ∝ 1 ÷ d². Doubling the distance gives 1 ÷ 2² = 1 ÷ 4 = 0.25 of the original intensity.", () => (10 / 20) ** 2),
        S(3, "After stopping a sprint, a runner keeps breathing heavily. What is the best explanation?", "Extra oxygen is needed to break down the lactic acid built up (the oxygen debt)", ["The runner has run out of glucose and must breathe in more to replace it", "Anaerobic respiration carries on in the muscles for as long as the heart rate stays high", "Carbon dioxide is being made by photosynthesis in the runner's cells"], "Anaerobic respiration made lactic acid. After exercise, oxygen is needed to convert it back (to glucose in the liver) and the extra breathing repays the oxygen debt.", {}),
        S(3, "A tomato grower has plenty of light and warmth but rates of photosynthesis are low. Which is the MOST likely fix?", "Raise the carbon dioxide concentration in the greenhouse", ["Add more lamps to increase the light intensity further", "Raise the temperature inside the greenhouse to 60 °C", "Stop watering the plants so the roots take in more nutrients"], "If light and temperature are already suitable, carbon dioxide is probably limiting. A temperature of 60 °C would denature enzymes.", {}),
        W("Explain how light intensity, carbon dioxide concentration and temperature can each limit the rate of photosynthesis, and how a commercial grower could use this knowledge. [6 marks]", "Mark scheme (6): light is needed to provide energy, so low light limits rate (1); rate rises with intensity until another factor is limiting (1); carbon dioxide is a reactant so low concentration limits the rate (1); temperature: rate rises as enzymes gain energy (1) but above the optimum (~45 °C) enzymes denature and rate falls (1); grower uses heated, lit greenhouses with added CO₂ to keep all factors near optimum, weighing cost against extra yield (1)."),
      ],
      cards: [
        ["Photosynthesis word equation", "carbon dioxide + water → glucose + oxygen (in light, chlorophyll)."],
        ["Photosynthesis symbol equation", "6CO₂ + 6H₂O → C₆H₁₂O₆ + 6O₂."],
        ["Endothermic vs exothermic", "Endothermic takes in energy (photosynthesis); exothermic releases it (respiration)."],
        ["Four limiting factors of photosynthesis", "Light intensity, CO₂ concentration, temperature, chlorophyll."],
        ["Aerobic respiration equation", "glucose + oxygen → carbon dioxide + water (C₆H₁₂O₆ + 6O₂ → 6CO₂ + 6H₂O)."],
        ["Anaerobic respiration in muscles", "glucose → lactic acid."],
        ["Anaerobic respiration in yeast", "glucose → ethanol + carbon dioxide (fermentation)."],
        ["Oxygen debt", "Extra oxygen needed after exercise to break down lactic acid."],
        ["Inverse square law (HT)", "Light intensity ∝ 1 ÷ distance²."],
        ["Uses of glucose in plants", "Respiration, starch, cellulose, amino acids/proteins, fats and oils."],
        ["Metabolism", "The sum of all chemical reactions in a cell or the body."],
        ["Why does a rate graph plateau?", "Another factor has become limiting."],
      ],
    }),
  },
};
