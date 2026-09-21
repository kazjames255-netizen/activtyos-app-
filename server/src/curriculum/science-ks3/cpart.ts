// KS3 Science — Chemistry: Particles & States of Matter (Year 7). Original content aligned to the DfE KS3 programme of study (OGL v3.0).
import type { CTopic } from "../types";
import { IMG } from "./_img";
import { sg, mu, nm, build } from "./_h";

export const TOPIC: CTopic = {
  key: "cpart",
  topic: "Chemistry — Particles & States of Matter",
  subject: "Science",
  years: {
    7: {
      year: 7,
      objectives: [
        "The properties of the different states of matter (solid, liquid and gas) in terms of the particle model, including gas pressure.",
        "Changes of state in terms of the particle model: melting, freezing, evaporating, boiling, condensing and subliming.",
        "Diffusion in terms of the particle model.",
        "Conservation of mass changes of state and dissolving; differences in density between the states of matter.",
      ],
      note: {
        title: "Year 7: the particle model",
        body: `## Solids, liquids and gases

| | Solid | Liquid | Gas |
| --- | --- | --- | --- |
| Particle arrangement | regular, touching | touching, random | far apart, random |
| Movement | vibrate in place | slide past each other | move quickly in all directions |
| Shape and volume | fixed shape and volume | fixed volume, takes the shape of the container | fills any container |

**Changes of state:** melting (solid to liquid), boiling and evaporating (liquid to gas), condensing (gas to liquid), freezing (liquid to solid), subliming (solid straight to gas). When a substance changes state the **mass stays the same**, because no particles are gained or lost.

**Heating curves:** while a substance melts or boils its temperature stays **constant**. The energy is used to overcome the forces between particles, not to speed them up.

**Diffusion** is the spreading out of particles from where they are crowded to where they are less crowded. **Gas pressure** is caused by particles colliding with the walls.

## Worked example: density

density = mass ÷ volume. A piece of wax has mass 90 g and volume 100 cm³, so density = 90 ÷ 100 = **0.9 g/cm³**. That is less than water (1.0 g/cm³), so the wax floats.`,
      },
      quiz: {
        title: "Particles & States of Matter: Year 7 quiz",
        questions: build("cpart", 7, [
          sg("Look at the particle diagrams. Which box shows a gas?", "A", ["B", "C"], "In a gas the particles are far apart and move quickly and randomly.", 1, { d: true, img: IMG.states }),
          sg("Look at the particle diagrams. Which box shows particles that touch and can slide past each other?", "C", ["A", "B"], "In a liquid the particles are close together but can move past each other. In a solid (B) they are fixed in a regular pattern.", 2, { img: IMG.states }),
          sg("Look at the heating graph for substance Y. What is its melting point?", "80 °C", ["20 °C", "140 °C", "180 °C"], "The temperature stays constant while a substance melts. The first flat section is at 80 °C.", 2, { d: true, img: IMG.heating }),
          sg("Look at the heating graph. What state is substance Y at 7.5 minutes?", "Liquid", ["Solid", "Gas", "Part solid and part gas"], "Between 6 and 9 minutes the temperature is between the melting point and the boiling point, so it is a liquid.", 2, { img: IMG.heating }),
          nm("Look at the heating graph. For how many minutes was substance Y boiling?", 4, "Boiling is the second flat section, from 9 minutes to 13 minutes: 13 − 9 = 4 minutes.", 2, { img: IMG.heating }),
          sg("Why does the temperature stay constant while a solid is melting?", "The energy supplied is used to overcome the forces between particles instead of raising the temperature", ["The heat from the burner is no longer reaching the substance through the walls of the beaker", "The particles stop moving completely until all of the solid has turned into liquid", "The substance is losing mass as it melts, so it needs less energy to warm up"], "During a change of state, energy is used to break the attractions between particles, so the temperature does not rise.", 3),
          sg("A smell of perfume slowly spreads across a room. What is this process called?", "Diffusion", ["Evaporation", "Condensation", "Melting"], "Particles spread out from a region where they are crowded into a region where there are fewer of them.", 1),
          nm("A metal block has a mass of 240 g and a volume of 30 cm³. What is its density in g/cm³?", 8, "density = mass ÷ volume = 240 ÷ 30 = 8 g/cm³.", 2),
          sg("A 50 g ice cube melts completely in a closed cup. What is the mass of the water?", "50 g", ["Less than 50 g", "More than 50 g", "0 g"], "Mass is conserved in a change of state because the same particles are still there.", 2),
          mu("Which of these are changes from a liquid to a gas?", ["Boiling", "Evaporating", "Condensing", "Freezing"], ["Boiling", "Evaporating"], "Boiling and evaporating turn a liquid into a gas. Condensing is gas to liquid, and freezing is liquid to solid.", 1),
        ]),
      },
      flashcards: [
        { front: "Particle arrangement in a solid", back: "Regular pattern, touching, vibrating in place." },
        { front: "Particle arrangement in a liquid", back: "Touching but random; they slide past each other." },
        { front: "Particle arrangement in a gas", back: "Far apart, random, moving quickly." },
        { front: "Melting", back: "Solid to liquid." },
        { front: "Evaporating and boiling", back: "Liquid to gas." },
        { front: "Sublimation", back: "Solid straight to gas (for example dry ice)." },
        { front: "Mass and changes of state", back: "Mass is conserved: the same particles are still there." },
        { front: "Diffusion", back: "The spreading out of particles from where they are crowded to where they are less crowded." },
        { front: "What causes gas pressure?", back: "Gas particles colliding with the walls of the container." },
        { front: "Density formula", back: "density = mass ÷ volume." },
      ],
    },
  },
};
