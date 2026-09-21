// KS3 Science — Chemistry: Earth & Atmosphere (Year 9). Original content aligned to the DfE KS3 programme of study (OGL v3.0).
import type { CTopic } from "../types";
import { IMG } from "./_img";
import { sg, mu, nm, build } from "./_h";

export const TOPIC: CTopic = {
  key: "cearth",
  topic: "Chemistry — Earth & Atmosphere",
  subject: "Science",
  years: {
    9: {
      year: 9,
      objectives: [
        "The composition of the Earth and the structure of the Earth (crust, mantle, outer core, inner core).",
        "The rock cycle and the formation of igneous, sedimentary and metamorphic rocks.",
        "The Earth as a source of limited resources and the efficacy of recycling.",
        "The composition of the atmosphere; the production of carbon dioxide by human activity and the impact on climate; the carbon cycle.",
      ],
      note: {
        title: "Year 9: the Earth and its atmosphere",
        body: `## Structure of the Earth

From the surface to the centre: the thin rocky **crust**, the **mantle** (solid rock that can flow very slowly), the liquid **outer core** and the solid **inner core**, made mostly of iron and nickel.

## The rock cycle

- **Igneous rock**: forms when molten rock (magma or lava) cools and solidifies. Slow cooling gives large crystals.
- **Sedimentary rock**: forms when layers of sediment are compressed and cemented over a long time.
- **Metamorphic rock**: forms when rock is changed by heat and pressure without melting.

## Recycling and resources

Metals and other materials come from finite resources. Recycling saves raw materials and often energy; for example recycling aluminium uses far less energy than extracting it from its ore.

## The atmosphere

Dry air is about **78% nitrogen**, **21% oxygen**, with small amounts of argon (about 0.9%) and carbon dioxide (about 0.04%). Carbon dioxide is removed by **photosynthesis** and added by **respiration**, **combustion** and decay. Burning fossil fuels and deforestation add carbon dioxide faster than it is removed. Carbon dioxide is a **greenhouse gas**: it traps thermal radiation from the surface, making global warming stronger.

## Worked example

Dry air is 21% oxygen. In 400 litres of air there are 0.21 × 400 = **84 litres** of oxygen.`,
      },
      quiz: {
        title: "Earth & Atmosphere: Year 9 quiz",
        questions: build("cearth", 9, [
          sg("Look at the pie chart of the gases in dry air. Which gas is slice A?", "Nitrogen", ["Oxygen", "Carbon dioxide", "Argon"], "Nitrogen makes up about 78% of dry air, the largest slice.", 1, { d: true, img: IMG.atmos }),
          sg("Look at the pie chart. Which gas is slice B, which we need for respiration?", "Oxygen", ["Nitrogen", "Carbon dioxide", "Hydrogen"], "Oxygen makes up about 21% of dry air.", 1, { img: IMG.atmos }),
          sg("Which gas, only about 0.04% of the air, is the main greenhouse gas added by burning fossil fuels?", "Carbon dioxide", ["Nitrogen", "Oxygen", "Argon"], "Carbon dioxide is a greenhouse gas: it traps thermal radiation. Its concentration has risen through burning fuels.", 2, { d: true }),
          sg("Which is the correct order of the Earth's layers, from the surface to the centre?", "Crust, mantle, outer core, inner core", ["Mantle, crust, inner core, outer core", "Crust, outer core, mantle, inner core", "Inner core, outer core, mantle, crust"], "The crust is the thin outer layer. The centre is a solid inner core surrounded by a liquid outer core.", 1),
          sg("Why is recycling aluminium cans better than making new aluminium from ore?", "It uses much less energy and saves raw materials", ["It makes aluminium that is stronger", "It uses more energy but produces less waste", "Aluminium ore is not a finite resource"], "Extracting aluminium takes a lot of energy, so re-melting used metal saves energy and ore.", 2),
          mu("Which of these statements about rocks are correct?", ["Igneous rock forms as molten rock cools and solidifies", "Sedimentary rock forms as layers of sediment are pressed and cemented together", "Metamorphic rock forms when rock is changed by heat and pressure without melting", "Igneous rock forms when sediments are compressed"], ["Igneous rock forms as molten rock cools and solidifies", "Sedimentary rock forms as layers of sediment are pressed and cemented together", "Metamorphic rock forms when rock is changed by heat and pressure without melting"], "The statement that igneous rock forms when sediments are compressed describes sedimentary rock, not igneous rock.", 2),
          sg("Which statement explains the greenhouse effect?", "Some gases in the atmosphere absorb thermal radiation from the Earth's surface and re-emit it, keeping the planet warmer", ["The atmosphere reflects all sunlight back into space, so the energy bounces around between the clouds and the ground and heats the air", "Holes in the atmosphere let extra ultraviolet in", "Greenhouse gases make the Sun hotter"], "Greenhouse gases trap thermal (infrared) radiation. More of them means more energy stays in the atmosphere.", 3),
          sg("Which human activity has increased the amount of carbon dioxide in the atmosphere?", "Burning fossil fuels", ["Planting new forests", "Recycling paper", "Using wind turbines"], "Burning coal, oil and gas releases carbon dioxide that was stored for millions of years.", 2),
          sg("Which process removes carbon dioxide from the atmosphere?", "Photosynthesis", ["Respiration", "Combustion", "Decay of dead plants"], "Plants take in carbon dioxide and use it to make glucose. The other three processes release it.", 2),
          nm("Dry air is about 21% oxygen. How many litres of oxygen are in 250 litres of dry air?", 52.5, "21% of 250 = 0.21 × 250 = 52.5 litres.", 2, { tol: 0.01 }),
        ]),
      },
      flashcards: [
        { front: "Layers of the Earth, surface to centre", back: "Crust, mantle, outer core (liquid), inner core (solid)." },
        { front: "Igneous rock forms…", back: "When molten rock cools and solidifies." },
        { front: "Sedimentary rock forms…", back: "When layers of sediment are compressed and cemented." },
        { front: "Metamorphic rock forms…", back: "When rock is changed by heat and pressure, without melting." },
        { front: "Composition of dry air", back: "About 78% nitrogen, 21% oxygen, about 1% argon and other gases; carbon dioxide about 0.04%." },
        { front: "Two ways carbon dioxide is removed from the air", back: "Photosynthesis (and dissolving in the oceans)." },
        { front: "Three ways carbon dioxide is added to the air", back: "Respiration, combustion, decay." },
        { front: "What is the greenhouse effect?", back: "Gases like carbon dioxide trap thermal radiation and keep Earth warmer." },
        { front: "Why recycle metals?", back: "Saves finite resources and energy, and reduces waste." },
        { front: "Two human activities that raise carbon dioxide", back: "Burning fossil fuels; deforestation." },
      ],
    },
  },
};
