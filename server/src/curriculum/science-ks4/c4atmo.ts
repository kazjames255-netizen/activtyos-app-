// GCSE Chemistry — The Atmosphere & Earth's Resources (Year 11).
import type { CTopic } from "../types";
import { N, S, M, W, yr } from "./_h";
import { CO2 } from "./_imgdata";

const IMG = ["c4atmo-co2.png", "A line graph of atmospheric carbon dioxide concentration in parts per million against year. The line rises steadily from about 317 parts per million in 1960 to about 339 in 1980, 369 in 2000 and 414 in 2020. The values are rounded and approximate."] as [string, string];

export const TOPIC: CTopic = {
  key: "c4atmo", topic: "Chemistry — The Atmosphere & Earth's Resources", subject: "Science",
  years: {
    11: yr("c4atmo", 11, {
      obj: [
        "Describe the composition of the atmosphere and how it has changed over time.",
        "Explain the greenhouse effect, human contributions to climate change and its consequences; carbon footprint.",
        "Describe atmospheric pollutants (CO, SO₂, NOₓ, particulates), their sources and effects.",
        "Describe potable water production, waste water treatment and life cycle assessments; recycling.",
        "Describe corrosion and its prevention; alloys, ceramics, polymers and composites.",
        "Triple stretch: the Haber process and NPK fertilisers.",
      ],
      note: ["GCSE Chemistry: the atmosphere and Earth's resources", `## The atmosphere
Today's air is about **78% nitrogen**, **21% oxygen**, about 0.9% argon and about **0.04% carbon dioxide**, with a little water vapour. The early atmosphere was mainly carbon dioxide from volcanoes. As oceans formed, CO₂ dissolved and was locked into **sedimentary rocks** and **fossil fuels**; **algae and plants** photosynthesised, adding oxygen.

## Greenhouse effect
Carbon dioxide, methane and water vapour absorb infrared radiation from the Earth and re-emit it, warming the planet. Burning fossil fuels, deforestation, farming and landfill have increased CO₂ and methane, causing **global warming** and **climate change** (sea level rise, extreme weather, changes to ecosystems). A **carbon footprint** is the total CO₂ (and other greenhouse gases) released by a product, event or person.

## Pollutants
| Pollutant | Source and effect |
| --- | --- |
| Carbon monoxide | incomplete combustion; toxic |
| Sulfur dioxide | sulfur in fuels; acid rain |
| Nitrogen oxides | high-temperature engines; acid rain, respiratory problems |
| Particulates | incomplete combustion; global dimming, lung damage |

## Resources
**Potable water** (safe to drink): filter, then sterilise (chlorine, ozone or UV). Sea water needs **distillation**. A **life cycle assessment** looks at raw materials, manufacture, use and disposal. **Rusting** needs iron, **oxygen and water**; prevent it with paint, oil, galvanising or sacrificial zinc.

## Worked example
The percentage of oxygen in 800 dm³ of air is 21%: 800 × 0.21 = **168 dm³**.
A fall from 600 ppm to 570 ppm is a change of 30 ppm, which is 5% of 600.

**Working scientifically:** evaluate data by asking whether trends over time show cause or just correlation.`],
      quiz: "GCSE Chemistry: Atmosphere & Earth's Resources quiz",
      qs: [
        S(1, "Approximately what percentage of today's atmosphere is oxygen?", "21%", ["78%", "0.04%", "50%"], "Air is about 78% nitrogen and 21% oxygen. Carbon dioxide is only about 0.04%.", {}),
        S(1, "Which of these gases is a greenhouse gas?", "Methane", ["Nitrogen", "Oxygen", "Argon"], "Methane, carbon dioxide and water vapour absorb infrared radiation and keep the Earth warm.", {}),
        S(1, "Which two substances are needed for iron to rust?", "Oxygen and water", ["Carbon dioxide and water", "Nitrogen and oxygen", "Water only"], "Rusting is the oxidation of iron in the presence of both oxygen and water.", {}),
        N(2, "Use the graph. By how many parts per million (ppm) did the atmospheric carbon dioxide concentration rise between 1960 and 2020?", 97, 2, "Rise = concentration in 2020 − concentration in 1960 = 414 − 317 = 97 ppm.", () => CO2.ppm[3] - CO2.ppm[0], { img: IMG }),
        N(2, "Use the graph. Calculate the percentage increase in carbon dioxide concentration from 1960 to 2020, to 1 decimal place.", 30.6, 0.5, "Percentage increase = (414 − 317) ÷ 317 × 100 = 97 ÷ 317 × 100 = 30.6%.", () => ((CO2.ppm[3] - CO2.ppm[0]) / CO2.ppm[0]) * 100, { img: IMG, diag: true }),
        S(2, "How does burning fossil fuels contribute to climate change?", "It releases carbon dioxide that was locked up for millions of years", ["It removes oxygen from the atmosphere and replaces it with nitrogen", "It makes the atmosphere colder", "It converts carbon dioxide into methane"], "Fossil fuels store carbon from ancient organisms. Burning them releases CO₂ into the atmosphere, enhancing the greenhouse effect.", {}),
        M(2, "Which are possible consequences of climate change? Choose all that apply.", ["Rising sea levels", "More frequent extreme weather events"], ["A lower concentration of carbon dioxide in the atmosphere", "Repair of the ozone layer"], "Global warming melts ice and expands sea water, and alters weather patterns. It is caused by more, not less, greenhouse gases.", {}),
        S(2, "Which pollutant is mainly responsible for acid rain from burning fuels containing sulfur?", "Sulfur dioxide", ["Carbon monoxide", "Hydrogen sulfide", "Carbon dioxide"], "Sulfur in fuels forms sulfur dioxide, which dissolves in rain water forming acid rain. Nitrogen oxides also contribute.", { diag: true }),
        S(2, "Which is the correct process to make potable water from fresh (rain) water?", "Filter, then sterilise", ["Distil, then filter", "Sterilise only", "Sterilise, then evaporate"], "Filtering removes solids and sterilising (chlorine, ozone or UV) kills microbes. Sea water requires distillation as well.", {}),
        S(2, "Why is recycling metals better than extracting them from ores?", "It uses less energy and conserves resources", ["It produces more waste gases than extraction", "It needs fresh ore to be mined each time", "Recycled metals are weaker than new metals"], "Recycling saves energy, reduces landfill and conserves finite ore.", {}),
        S(3, "The early atmosphere had much more carbon dioxide than today. Which is the best explanation for its fall?", "It dissolved in the oceans, was locked in rocks and fossil fuels, and was used by photosynthesis", ["It was destroyed by later volcanic eruptions, which turned it into ash", "It was converted into nitrogen by lightning storms in the early atmosphere", "It escaped into space because carbon dioxide is lighter than the other gases"], "CO₂ dissolved in the oceans, formed carbonate rocks and fossil fuels, and was taken up by algae and plants, which also released oxygen.", {}),
        S(3, "Why does a zinc block attached to a steel ship's hull prevent rusting?", "Zinc is more reactive than iron so it corrodes instead (sacrificial protection)", ["Zinc is less reactive than iron, so it forms a barrier that keeps out oxygen", "Zinc makes the ship heavier, so the hull sits lower in the water away from the air", "Zinc is a catalyst that speeds up the reaction which turns rust back into iron"], "The more reactive metal loses electrons in preference to iron, so the zinc corrodes and the iron does not.", {}),
        W("Explain how the greenhouse effect works and describe how human activities have enhanced it. [6 marks]", "Mark scheme (6): short-wavelength radiation from the Sun passes through the atmosphere and warms the Earth's surface (1); the Earth re-radiates energy as infrared (1); greenhouse gases such as CO₂, methane and water vapour absorb this radiation (1) and re-emit it in all directions, warming the atmosphere (1); burning fossil fuels and deforestation increase CO₂ (1); farming (cattle, rice) and landfill increase methane, so more infrared is trapped, causing global warming (1)."),
      ],
      cards: [
        ["Composition of dry air", "≈78% N₂, 21% O₂, 0.9% Ar, 0.04% CO₂."],
        ["Why did oxygen increase?", "Algae and plants photosynthesised."],
        ["Where did early carbon dioxide go?", "Oceans, sedimentary rocks, fossil fuels and photosynthesis."],
        ["Three greenhouse gases", "Carbon dioxide, methane, water vapour."],
        ["Carbon footprint", "Total greenhouse gas emissions from a product, event or person."],
        ["Carbon monoxide", "From incomplete combustion; toxic (stops blood carrying oxygen)."],
        ["Sulfur dioxide and nitrogen oxides", "Cause acid rain; nitrogen oxides also cause respiratory problems."],
        ["Making potable water", "Choose a fresh source, filter, sterilise (chlorine, ozone, UV)."],
        ["Life cycle assessment stages", "Raw materials, manufacture, use, disposal."],
        ["What does rusting need?", "Iron, oxygen and water."],
        ["Sacrificial protection", "A more reactive metal (zinc) corrodes instead of the iron."],
        ["Haber process (triple)", "N₂ + 3H₂ ⇌ 2NH₃, iron catalyst, 450 °C, 200 atm."],
      ],
    }),
  },
};
