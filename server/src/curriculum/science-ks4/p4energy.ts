// GCSE Physics — Energy (Year 10).
import type { CTopic } from "../types";
import { N, S, yr } from "./_h";
import { SANKEY } from "./_imgdata";

const IMG = ["p4energy-sankey.png", "A Sankey-style energy transfer diagram for a motor. A wide arrow on the left is labelled 250 joules input. It splits into a thin arrow going up labelled sound 15 joules, a medium arrow going down labelled heat 60 joules, and a wide arrow continuing right labelled useful kinetic energy with a question mark."] as [string, string];
const useful = SANKEY.input - SANKEY.thermal - SANKEY.sound;

export const TOPIC: CTopic = {
  key: "p4energy", topic: "Physics — Energy", subject: "Science",
  years: {
    10: yr("p4energy", 10, {
      obj: [
        "Describe energy stores and transfers; apply conservation of energy and dissipation.",
        "Calculate kinetic energy, gravitational potential energy and elastic potential energy.",
        "Calculate energy changes using specific heat capacity; describe the required practical.",
        "Use power = energy ÷ time; calculate efficiency and describe ways to reduce unwanted transfers.",
        "Describe thermal conduction, insulation and U-values (triple).",
        "Compare renewable and non-renewable energy resources.",
      ],
      note: ["GCSE Physics: energy stores, transfers and efficiency", `## Conservation of energy
Energy cannot be created or destroyed, only **transferred** between stores (kinetic, gravitational potential, elastic, thermal, chemical, nuclear...) or **dissipated** to less useful stores, usually thermal energy in the surroundings.

## Key equations
| Quantity | Equation | Units |
| --- | --- | --- |
| Kinetic energy | Eₖ = ½ m v² | J, kg, m/s |
| Gravitational PE | Eₚ = m g h | g = 9.8 N/kg |
| Elastic PE | Eₑ = ½ k e² | k in N/m |
| Specific heat capacity | ΔE = m c Δθ | c in J/kg°C |
| Power | P = E ÷ t | W |
| Efficiency | useful output ÷ total input | no units, or × 100% |

## Worked examples
- A 2.0 kg trolley moves at 6.0 m/s: Eₖ = ½ × 2.0 × 6.0² = **36 J**.
- A 0.50 kg book is lifted 12 m (g = 9.8 N/kg): Eₚ = 0.50 × 9.8 × 12 = **58.8 J**.
- Heating 2.0 kg of aluminium (c = 900 J/kg°C) by 15 °C: ΔE = 2.0 × 900 × 15 = **27 000 J**.
- A device takes in 200 J and gives 80 J useful energy: efficiency = 80 ÷ 200 = **0.40** (40%).

## Reducing waste
Lubrication reduces friction; thermal insulation (thick walls, low thermal conductivity, cavity walls) reduces conduction. **Renewable** resources (wind, solar, tidal, hydro, biofuel, geothermal) will not run out; **non-renewable** (coal, oil, gas, nuclear fuel) will.

**Working scientifically (specific heat capacity):** insulate the block, use a joulemeter or measure current, PD and time, and plot temperature against energy.`],
      quiz: "GCSE Physics: Energy quiz",
      qs: [
        S(1, "Which energy store increases when a ball is lifted upwards?", "Gravitational potential", ["Kinetic", "Chemical", "Elastic potential"], "Lifting an object against gravity transfers energy to its gravitational potential store.", {}),
        S(1, "What is the unit of energy?", "Joule", ["Watt", "Newton", "Pascal"], "Energy is measured in joules (J). The watt is the unit of power.", {}),
        S(1, "Which of these is a renewable energy resource?", "Wind", ["Coal", "Natural gas", "Uranium"], "Wind will not run out. Coal, gas and uranium are finite.", {}),
        N(2, "A car of mass 1200 kg is moving at 15 m/s. Calculate its kinetic energy in joules.", 135000, 100, "Eₖ = ½ m v² = 0.5 × 1200 × 15² = 0.5 × 1200 × 225 = 135 000 J.", () => 0.5 * 1200 * 15 ** 2, { diag: true }),
        N(2, "A 3.0 kg box is lifted 4.0 m. Calculate the gain in gravitational potential energy in joules, to 3 significant figures. (g = 9.8 N/kg)", 118, 0.5, "Eₚ = m g h = 3.0 × 9.8 × 4.0 = 117.6 J = 118 J (3 s.f.).", () => 3.0 * 9.8 * 4.0),
        N(2, "The diagram shows energy transfers in a motor. How much useful kinetic energy is transferred, in joules?", 175, 0, "Energy is conserved: useful = input − wasted = 250 − 60 − 15 = 175 J.", () => useful, { img: IMG }),
        N(2, "Calculate the efficiency of the motor as a decimal.", 0.7, 0.005, "Efficiency = useful output ÷ total input = 175 ÷ 250 = 0.70.", () => useful / SANKEY.input, { img: IMG, diag: true }),
        S(2, "What does specific heat capacity mean?", "The energy needed to raise the temperature of 1 kg of a substance by 1 °C", ["The energy needed to melt 1 kg of a substance", "The total energy stored in 1 kg of a substance at a given temperature", "The temperature rise produced when 1 J of energy is supplied to a substance"], "Specific heat capacity c is in J/kg°C: the energy per kilogram needed for each 1 °C of temperature rise.", {}),
        N(2, "Calculate the energy needed to heat 0.50 kg of water by 20 °C, in joules. (c = 4200 J/kg°C)", 42000, 10, "ΔE = m c Δθ = 0.50 × 4200 × 20 = 42 000 J.", () => 0.5 * 4200 * 20),
        S(2, "Which change would reduce the rate of thermal energy loss through the wall of a house the MOST?", "Thicker walls made from a material with low thermal conductivity", ["Thinner walls made from a metal", "Thicker walls made from a material with high thermal conductivity", "Painting the walls a darker colour"], "Rate of conduction falls if the wall is thicker and the material is a poorer thermal conductor.", {}),
        N(3, "A 5.0 kg ball is dropped from a height of 5.0 m. Ignoring air resistance, calculate its speed just before hitting the ground, in m/s (1 d.p.). (g = 9.8 N/kg)", 9.9, 0.1, "Gravitational PE lost = kinetic energy gained: m g h = ½ m v². The mass cancels: v = √(2 g h) = √(2 × 9.8 × 5.0) = √98 = 9.9 m/s.", () => Math.sqrt(2 * 9.8 * 5.0)),
        N(3, "A 2.4 kW kettle is on for 150 s. All the energy heats 1.5 kg of water. Calculate the temperature rise in °C, to 1 decimal place. (c = 4200 J/kg°C)", 57.1, 0.1, "Energy = P × t = 2400 × 150 = 360 000 J. Δθ = ΔE ÷ (m c) = 360 000 ÷ (1.5 × 4200) = 57.1 °C.", () => (2400 * 150) / (1.5 * 4200)),
        S(3, "In the specific heat capacity practical, a student finds a value for c that is HIGHER than the true value. What is the most likely cause?", "Some energy was lost to the surroundings, so the measured temperature rise was too small", ["Too much energy was transferred to the block, so the measured temperature rise was too large", "The mass of the block was measured too high, so the energy per kilogram came out too big", "The heater was left on for too long, so the block became hotter than expected"], "c = ΔE ÷ (m Δθ). If energy escapes, the block warms less than it should, so Δθ is smaller and the calculated c is too big.", {}),
      ],
      cards: [
        ["Conservation of energy", "Energy cannot be created or destroyed, only transferred or dissipated."],
        ["Kinetic energy equation", "Eₖ = ½ m v²."],
        ["Gravitational PE equation", "Eₚ = m g h (g = 9.8 N/kg)."],
        ["Elastic PE equation", "Eₑ = ½ k e²."],
        ["Specific heat capacity equation", "ΔE = m c Δθ."],
        ["Power equation", "P = E ÷ t (watts = joules per second)."],
        ["Efficiency equation", "useful output energy ÷ total input energy."],
        ["Ways to reduce unwanted energy transfer", "Lubrication, insulation, thicker walls, low conductivity materials."],
        ["Two renewable resources", "Wind, solar (also tidal, hydroelectric, geothermal, biofuel)."],
        ["Non-renewable resources", "Coal, oil, gas, nuclear fuel."],
        ["What is dissipated energy?", "Energy spread to less useful stores, usually as thermal energy in the surroundings."],
        ["Unit of specific heat capacity", "J/kg°C."],
      ],
    }),
  },
};
