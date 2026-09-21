// A-level Physics — Thermal Physics (Year 13). Original content aligned to the DfE GCE AS/A-level physics subject content.
// Keys are recomputed by _chk_p5therm.ts — re-run _check_s7.ts after ANY edit here.
import type { CTopic } from "../types";
import { img, qb } from "./_h";

const q = qb("p5therm", 13);
export const TOPIC: CTopic = {
  key: "p5therm",
  topic: "Physics — Thermal Physics",
  subject: "Science",
  years: {
    13: {
      year: 13,
      subtopic: "A-level Year 13 (A2)",
      objectives: [
        "Internal energy, temperature and the Kelvin scale; absolute zero.",
        "Specific heat capacity Q = mcΔθ and specific latent heat Q = mL.",
        "Gas laws: pV = constant, p/T = constant, V/T = constant; the ideal gas equation pV = nRT = NkT.",
        "Kinetic theory of gases: assumptions, pV = ⅓Nm⟨c²⟩, mean kinetic energy ½m⟨c²⟩ = (3/2)kT, root-mean-square speed.",
        "Experimental determination of specific heat capacity and evaluation of errors.",
      ],
      note: {
        title: "Heat, gas laws and kinetic theory",
        body: `## Key ideas

The **internal energy** of a body is the sum of the random kinetic and potential energies of its molecules. Temperature in kelvin is T = θ + 273 (θ in °C); at **absolute zero** (0 K) the molecules have minimum energy.

To change temperature, **Q = mcΔθ** (c = specific heat capacity). To change state at constant temperature, **Q = mL** (L = specific latent heat).

For an **ideal gas** the equation of state is **pV = nRT = NkT**. The kinetic theory assumes: large numbers of identical molecules in random motion, negligible molecular volume, no forces except during collisions, and perfectly elastic collisions with negligible duration. It leads to **pV = ⅓Nm⟨c²⟩** and to the mean kinetic energy per molecule **½m⟨c²⟩ = (3/2)kT**, which depends only on T.

| Quantity | Formula |
| --- | --- |
| Temperature conversion | T / K = θ / °C + 273 |
| Heating | Q = mcΔθ |
| Change of state | Q = mL |
| Ideal gas | pV = nRT = NkT |
| Kinetic theory | pV = ⅓Nm⟨c²⟩ |
| Mean KE of a molecule | ½m⟨c²⟩ = (3/2)kT |
| Constants | R = 8.31 J mol⁻¹ K⁻¹, k = 1.38 × 10⁻²³ J K⁻¹, Nₐ = 6.02 × 10²³ mol⁻¹ |

## Worked example 1

Heating 2.0 kg of water (c = 4200 J kg⁻¹ K⁻¹) from 20 °C to 50 °C needs Q = 2.0 × 4200 × 30 = **252 kJ**.

## Worked example 2

0.020 mol of gas occupies 1.0 × 10⁻³ m³ at 300 K. p = nRT ÷ V = (0.020 × 8.31 × 300) ÷ 1.0 × 10⁻³ = **4.99 × 10⁴ Pa**.`,
      },
      quiz: {
        title: "Thermal Physics: Year 13 quiz",
        questions: [
          q.single(1, "What is the value of absolute zero on the Celsius scale?", "−273 °C", ["0 °C", "−100 °C", "−373 °C"], "Absolute zero is 0 K, which is −273 °C (more precisely −273.15 °C)."),
          q.num(1, "Convert a body temperature of 37 °C to kelvin.", 310, 0.5, "T / K = θ / °C + 273 = 37 + 273 = 310 K."),
          q.num(2, "A 0.50 kg copper block (specific heat capacity 385 J kg⁻¹ K⁻¹) is heated from 20 °C to 100 °C. Calculate the energy supplied, in kJ, to 3 significant figures.", 15.4, 0.05, "Q = mcΔθ = 0.50 × 385 × 80 = 15 400 J = 15.4 kJ.", { diag: true }),
          q.num(2, "Calculate the energy needed to melt 0.15 kg of ice at 0 °C, in kJ, to 3 significant figures. (specific latent heat of fusion of ice = 3.34 × 10⁵ J kg⁻¹)", 50.1, 0.1, "Q = mL = 0.15 × 3.34 × 10⁵ = 50 100 J = 50.1 kJ. The temperature stays at 0 °C while it melts."),
          q.num(2, "A fixed mass of gas at 2.4 × 10⁵ Pa occupies 0.30 m³. It is compressed slowly at constant temperature to 0.10 m³. Calculate the new pressure, in units of 10⁵ Pa, to 2 significant figures.", 7.2, 0.05, "Boyle's law at constant T: p₁V₁ = p₂V₂. p₂ = 2.4 × 10⁵ × 0.30 ÷ 0.10 = 7.2 × 10⁵ Pa.", { diag: true }),
          q.num(2, "A sealed rigid container holds gas at 1.5 × 10⁵ Pa and 288 K. It is heated to 353 K. Calculate the new pressure, in units of 10⁵ Pa, to 3 significant figures.", 1.84, 0.01, "At constant volume p ∝ T (kelvin). p₂ = 1.5 × 10⁵ × 353 ÷ 288 = 1.84 × 10⁵ Pa."),
          q.num(2, "Calculate the amount of gas, in mol, in a container of volume 0.040 m³ at pressure 3.0 × 10⁵ Pa and temperature 300 K, to 3 significant figures. (R = 8.31 J mol⁻¹ K⁻¹)", 4.81, 0.02, "n = pV ÷ RT = (3.0 × 10⁵ × 0.040) ÷ (8.31 × 300) = 12 000 ÷ 2493 = 4.81 mol."),
          q.num(2, "Calculate the mean translational kinetic energy of a gas molecule at 300 K, in units of 10⁻²¹ J, to 3 significant figures. (k = 1.38 × 10⁻²³ J K⁻¹)", 6.21, 0.02, "Mean KE = (3/2)kT = 1.5 × 1.38 × 10⁻²³ × 300 = 6.21 × 10⁻²¹ J."),
          q.num(3, "Calculate the root-mean-square speed of nitrogen molecules of mass 4.65 × 10⁻²⁶ kg at 300 K, in m s⁻¹, to 3 significant figures. (k = 1.38 × 10⁻²³ J K⁻¹)", 517, 2, "½m⟨c²⟩ = (3/2)kT gives ⟨c²⟩ = 3kT ÷ m = 3 × 1.38 × 10⁻²³ × 300 ÷ 4.65 × 10⁻²⁶ = 2.67 × 10⁵ m² s⁻². c_rms = √⟨c²⟩ = 517 m s⁻¹."),
          q.num(3, "A container of volume 2.0 × 10⁻³ m³ holds 4.0 × 10²² helium atoms, each of mass 6.6 × 10⁻²⁷ kg, with mean square speed 1.9 × 10⁶ m² s⁻². Use pV = ⅓Nm⟨c²⟩ to calculate the pressure, in kPa, to 3 significant figures.", 83.6, 0.2, "pV = ⅓ × 4.0 × 10²² × 6.6 × 10⁻²⁷ × 1.9 × 10⁶ = 0.1672 J. p = 0.1672 ÷ 2.0 × 10⁻³ = 8.36 × 10⁴ Pa = 83.6 kPa."),
          q.num(3, "The graph shows the pressure of a fixed mass of gas at constant volume at five Celsius temperatures. The line of best fit is extended backwards. Use the graph to estimate the temperature at which the pressure would fall to zero (absolute zero), in °C.", -273, 8, "Extrapolating the straight line back, it meets the p = 0 axis at about −273 °C. This is absolute zero: for a fixed volume p ∝ T (in kelvin).", { image: img("p5therm-y13-pt.png", "A graph of pressure in units of 10 to the 5 pascals against temperature in degrees Celsius, from minus 300 to plus 120. Five data points at 20, 40, 60, 80 and 100 degrees lie on a straight line rising to the right. The line is extended backwards as a dashed line to the horizontal axis at the left of the graph.") }),
          q.multi(2, "Which TWO of these are assumptions of the kinetic theory of an ideal gas?", ["The collisions between molecules and with the walls are perfectly elastic", "The volume of the molecules is negligible compared with the volume of the gas"], ["The molecules attract one another strongly between collisions", "The molecules move in circular orbits about the container centre"], "The model assumes random motion, negligible molecular volume, elastic collisions of negligible duration, and no intermolecular forces except during collisions."),
          q.single(2, "The temperature of an ideal gas is raised from 300 K to 600 K. What happens to the mean kinetic energy of its molecules?", "It doubles", ["It stays the same", "It quadruples", "It increases by a factor of √2"], "Mean KE = (3/2)kT is proportional to the kelvin temperature, so doubling T doubles the mean kinetic energy (the rms speed increases by √2)."),
          q.written(3, "Describe an experiment using electrical heating to determine the specific heat capacity of a metal block. Include the measurements taken, how the result is calculated, and two sources of error with ways of reducing them. [6 marks]", "Use a metal block with holes for a heater and thermometer; measure its mass with a balance. Insert an immersion heater (connected to a joulemeter, or ammeter and voltmeter with a stopwatch) and a thermometer with a little oil for contact. Record the initial temperature, heat for a known time t, record the current and p.d. and the maximum temperature. Energy supplied E = VIt = mcΔθ so c = VIt/(mΔθ). Heat losses to the surroundings: insulate the block and start below room temperature so the heat lost and gained balance; or plot temperature against energy and use the gradient (1/mc). Thermal contact/temperature lag: use oil in the thermometer hole and stir/wait for maximum temperature.", "Mark scheme (max 6): measure mass m (balance); heater and thermometer in the block with oil for good thermal contact; measure V, I and time t (or use a joulemeter) to find the energy E = VIt; measure the temperature rise Δθ; c = VIt ÷ (mΔθ) (or plot θ against E: gradient = 1 ÷ mc); source of error 1: energy lost to the surroundings, reduced by insulating the block (lagging) or starting below room temperature; source of error 2: thermal contact/time lag between the heater and thermometer, reduced by oil in the holes and reading the highest temperature."),
        ],
      },
      flashcards: [
        { front: "Absolute zero", back: "0 K = −273 °C. Temperature at which molecules have minimum kinetic energy." },
        { front: "Internal energy", back: "Sum of the random kinetic and potential energies of all the molecules." },
        { front: "Specific heat capacity", back: "Energy to raise 1 kg by 1 K: Q = mcΔθ. Unit J kg⁻¹ K⁻¹." },
        { front: "Specific latent heat", back: "Energy to change the state of 1 kg at constant temperature: Q = mL." },
        { front: "Boyle's law", back: "pV = constant for a fixed mass at constant temperature." },
        { front: "Pressure law", back: "p ∝ T (kelvin) for a fixed mass at constant volume." },
        { front: "Ideal gas equation", back: "pV = nRT = NkT." },
        { front: "Kinetic theory pressure equation", back: "pV = ⅓Nm⟨c²⟩ (⟨c²⟩ = mean square speed)." },
        { front: "Mean kinetic energy of a gas molecule", back: "½m⟨c²⟩ = (3/2)kT: depends only on temperature." },
        { front: "Root-mean-square speed", back: "c_rms = √⟨c²⟩ = √(3kT ÷ m)." },
        { front: "Assumptions of the kinetic theory", back: "Many identical molecules, random motion, negligible volume, elastic collisions, no forces between collisions, collisions of negligible duration." },
      ],
    },
  },
};
