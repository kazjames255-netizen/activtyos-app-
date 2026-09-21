// GCSE Physics — Particle Model of Matter (Year 10).
import type { CTopic } from "../types";
import { N, S, yr } from "./_h";
import { HEAT } from "./_imgdata";

const IMG = ["p4part-heating.png", "A graph of temperature in degrees Celsius against time in minutes for a substance heated steadily. The line rises from 20 degrees at 0 minutes to 60 degrees at 4 minutes, is flat until 9 minutes, rises again to 140 degrees at 17 minutes, is flat until 26 minutes, then rises to 180 degrees at 30 minutes."] as [string, string];
const flats = () => HEAT.pts.slice(1).map((p, i) => ({ t0: HEAT.pts[i][0], t1: p[0], T0: HEAT.pts[i][1], T1: p[1] })).filter((s) => s.T0 === s.T1);
const stateAt = (t: number) => { const [m, b] = flats(); return t < m.t0 ? "Solid" : t <= m.t1 ? "Solid and liquid" : t < b.t0 ? "Liquid" : t <= b.t1 ? "Liquid and gas" : "Gas"; };

export const TOPIC: CTopic = {
  key: "p4part", topic: "Physics — Particle Model of Matter", subject: "Science",
  years: {
    10: yr("p4part", 10, {
      obj: [
        "Use the particle model to describe solids, liquids and gases and to explain density.",
        "Calculate density using ρ = m ÷ V and describe the required practical to measure density.",
        "Explain internal energy, changes of state and the constant temperature during a change of state.",
        "Calculate energy for a change of state using specific latent heat, E = m L.",
        "Interpret heating and cooling curves.",
        "Explain gas pressure in terms of particle collisions; use pV = constant (triple).",
      ],
      note: ["GCSE Physics: particles, density and changes of state", `## The particle model
| State | Arrangement | Movement |
| --- | --- | --- |
| Solid | close, regular | vibrate about fixed positions |
| Liquid | close, irregular | move around each other |
| Gas | far apart, random | move quickly in straight lines |

**Density** = mass ÷ volume (ρ = m ÷ V). Gases have low densities because their particles are far apart. **Mass is conserved** in a change of state; it is a **physical** (reversible) change.

## Internal energy
**Internal energy** is the total kinetic and potential energy of the particles. Heating either raises the temperature (kinetic energy) or, during a **change of state**, breaks the bonds between particles (potential energy) with the temperature **constant**.

## Equations
| Quantity | Equation |
| --- | --- |
| Density | ρ = m ÷ V |
| Energy to raise temperature | ΔE = m c Δθ |
| Energy for change of state | E = m L |

Specific latent heat of vaporisation of water 2.26 × 10⁶ J/kg; of fusion 3.34 × 10⁵ J/kg.

## Worked examples
- A 0.50 kg block has volume 0.000 20 m³: ρ = 0.50 ÷ 0.000 20 = **2500 kg/m³**.
- Boiling 0.10 kg of water at 100 °C: E = 0.10 × 2.26 × 10⁶ = **226 000 J**.
- Heating 2.0 kg of oil (c = 2000 J/kg°C) by 10 °C: ΔE = 2.0 × 2000 × 10 = **40 000 J**.

**Working scientifically:** to find the density of an irregular solid, measure its mass on a balance and its volume by displacement of water in a eureka can or measuring cylinder.`],
      quiz: "GCSE Physics: Particle Model of Matter quiz",
      qs: [
        S(1, "Which equation is used to calculate density?", "Density = mass ÷ volume", ["Density = volume ÷ mass", "Density = mass × volume", "Density = mass − volume"], "Density is the mass per unit volume, so density = mass ÷ volume.", {}),
        S(1, "In which state of matter are the particles close together in a regular pattern?", "Solid", ["Liquid", "Gas", "Plasma"], "In a solid, particles are held in fixed positions in a regular arrangement and only vibrate.", {}),
        S(1, "Which of these is a physical change?", "Ice melting", ["Wood burning", "Iron rusting", "Milk turning sour"], "Melting changes state but not the substance, and can be reversed. The others produce new substances.", {}),
        N(2, "A metal block has a mass of 540 g and a volume of 200 cm³. Calculate its density in g/cm³.", 2.7, 0.01, "Density = mass ÷ volume = 540 ÷ 200 = 2.7 g/cm³.", () => 540 / 200),
        N(2, "Use the heating curve. What is the melting point of the substance in °C?", 60, 2, "During melting the temperature stays constant. The first flat section is at 60 °C.", () => flats()[0].T0, { img: IMG, diag: true }),
        N(2, "Use the heating curve. For how many minutes is the substance melting?", 5, 0.3, "Melting is the first flat section, from 4 to 9 minutes: 9 − 4 = 5 minutes.", () => flats()[0].t1 - flats()[0].t0, { img: IMG }),
        S(2, "Use the heating curve. What is the state of the substance after 12 minutes?", "Liquid", ["Solid", "Gas", "Solid and liquid"], "At 12 minutes the temperature is between the melting point (60 °C) and the boiling point (140 °C), so the substance is a liquid.", { img: IMG, chk: () => stateAt(12) }),
        S(2, "Why does the temperature stay constant while a substance is boiling, even though it is still being heated?", "The energy is used to break the bonds between particles rather than to raise their kinetic energy", ["The heater stops transferring energy once the liquid reaches its boiling point, so nothing more can change", "The particles stop moving while the liquid turns into a gas, so the thermometer reads a constant value", "All of the energy supplied is lost to the surroundings as soon as the liquid reaches its boiling point"], "During a change of state the energy increases the particles' potential energy (bonds broken), not their kinetic energy, so the temperature is constant.", { diag: true }),
        N(2, "The specific latent heat of fusion of water is 334 000 J/kg. Calculate the energy needed to melt 0.20 kg of ice at 0 °C, in joules.", 66800, 10, "E = m L = 0.20 × 334 000 = 66 800 J.", () => 0.2 * 334000),
        S(2, "Which method is used to find the volume of an irregular stone?", "Measure how much water it displaces", ["Measure its length, width and height with a ruler", "Weigh it on a balance", "Heat it and measure the temperature"], "Lower the stone into water and measure the displaced volume. The other methods do not give the volume of an irregular solid.", { diag: true }),
        N(3, "Calculate the total energy needed to heat 0.50 kg of water from 20 °C to 100 °C and then boil it all away to steam, in joules. (c = 4200 J/kg°C; specific latent heat of vaporisation = 2 260 000 J/kg)", 1298000, 1000, "Heating: 0.50 × 4200 × 80 = 168 000 J. Boiling: 0.50 × 2 260 000 = 1 130 000 J. Total = 1 298 000 J.", () => 0.5 * 4200 * 80 + 0.5 * 2260000),
        N(3, "(Triple) A fixed mass of gas at constant temperature has a pressure of 100 kPa. Its volume is compressed to a quarter of the original. Calculate the new pressure in kPa.", 400, 0.5, "pV = constant. If the volume is 1/4 as big, the pressure is 4 times bigger: 100 × 4 = 400 kPa.", () => 100 / (1 / 4)),
        S(3, "Explain why heating a sealed container of gas at constant volume increases the pressure.", "The particles move faster, so they hit the walls more often and with greater force", ["The particles expand and get bigger, so they take up more of the space inside the container", "There are more particles in the container", "The particles are attracted to the walls more strongly when they are hot"], "Higher temperature means greater average kinetic energy: more frequent and harder collisions with the walls increase the pressure.", {}),
      ],
      cards: [
        ["Density equation", "ρ = m ÷ V (kg/m³ or g/cm³)."],
        ["Particles in a solid", "Close, regular pattern; vibrate about fixed positions."],
        ["Particles in a liquid", "Close together but irregular; can move past each other."],
        ["Particles in a gas", "Far apart, random, fast-moving."],
        ["Internal energy", "Total kinetic + potential energy of the particles."],
        ["Why constant temperature at a change of state?", "Energy breaks bonds (potential energy) rather than raising kinetic energy."],
        ["Specific latent heat", "Energy needed to change the state of 1 kg without changing temperature."],
        ["Latent heat equation", "E = m L."],
        ["Is a change of state chemical?", "No: it is physical and reversible; mass is conserved."],
        ["Volume of an irregular solid", "Measure the water it displaces."],
        ["Why do gases exert pressure?", "Particles collide with the container walls."],
        ["Pressure–volume relation (triple)", "pV = constant at constant temperature."],
      ],
    }),
  },
};
