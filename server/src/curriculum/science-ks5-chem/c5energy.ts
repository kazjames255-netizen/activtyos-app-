// A-level Chemistry — Energetics (Year 12 enthalpy; Year 13 Born–Haber, entropy, Gibbs). Original content aligned to the DfE GCE AS/A-level chemistry subject content.
// Keys are recomputed by _chk_c5energy.ts — re-run _check_s6.ts after ANY edit here.
import type { CTopic } from "../types";
import { img, qb } from "./_h";

const q12 = qb("c5energy", 12);
const q13 = qb("c5energy", 13);
export const TOPIC: CTopic = {
  key: "c5energy",
  topic: "Chemistry — Energetics",
  subject: "Science",
  years: {
    12: {
      year: 12,
      subtopic: "A-level Year 12 (AS)",
      objectives: [
        "Enthalpy change; exothermic and endothermic reactions; reaction profiles; standard conditions.",
        "Standard enthalpies of formation and combustion.",
        "Calorimetry: q = mcΔT and enthalpy change per mole.",
        "Hess's law and enthalpy cycles.",
        "Mean bond enthalpies and their use (and limitations) in calculating enthalpy changes.",
      ],
      note: {
        title: "Enthalpy changes, calorimetry, Hess's law and bond enthalpies",
        body: `## Key ideas

**Enthalpy change** ΔH is the heat change at constant pressure. **Exothermic**: ΔH negative, energy released, temperature of surroundings rises. **Endothermic**: ΔH positive. **Standard conditions**: 100 kPa, a stated temperature (usually 298 K), solutions at 1 mol dm⁻³, elements in their standard states.

- **ΔHf°**: 1 mole of a compound formed from its elements in their standard states. ΔHf° of an element in its standard state is zero.
- **ΔHc°**: 1 mole of a substance completely burned in oxygen.

| Method | Equation |
| --- | --- |
| Calorimetry | q = m × c × ΔT (c water = 4.18 J g⁻¹ K⁻¹), then ΔH = −q ÷ n |
| Using ΔHf | ΔHr = Σ ΔHf(products) − Σ ΔHf(reactants) |
| Using ΔHc | ΔHr = Σ ΔHc(reactants) − Σ ΔHc(products) |
| Bond enthalpies | ΔHr = Σ bonds broken − Σ bonds formed |

**Hess's law:** the enthalpy change of a reaction is the same whichever route is taken, as long as the start and end conditions are the same.

Mean bond enthalpies are averages over many compounds and apply to gases, so they give only approximate answers. Calorimetry results are usually less exothermic than data-book values because of heat loss.

## Worked example: calorimetry

Burning 0.80 g of methanol (Mr = 32.0) warms 200 g of water by 8.5 K.
- q = 200 × 4.18 × 8.5 = 7106 J = 7.11 kJ
- n = 0.80 ÷ 32.0 = 0.025 mol
- ΔH = −7.11 ÷ 0.025 = **−284 kJ mol⁻¹**

## Worked example: Hess's law

CaCO₃ → CaO + CO₂, with ΔHf: CaCO₃ −1207, CaO −635, CO₂ −394 kJ mol⁻¹.
ΔH = (−635 − 394) − (−1207) = **+178 kJ mol⁻¹**`,
      },
      quiz: {
        title: "Energetics: Year 12 quiz",
        questions: [
          q12.single(1, "Which statement is true for an exothermic reaction?", "ΔH is negative and the surroundings get hotter",
            ["ΔH is positive and the surroundings get hotter", "ΔH is negative and the surroundings get colder", "ΔH is positive and the surroundings get colder"],
            "Exothermic reactions release energy to the surroundings, so the temperature rises and ΔH is negative."),
          q12.single(1, "Which equation represents the standard enthalpy of formation of methanol, CH₃OH(l)?", "C(s) + 2H₂(g) + ½O₂(g) → CH₃OH(l)",
            ["CO(g) + 2H₂(g) → CH₃OH(l)", "C(g) + 4H(g) + O(g) → CH₃OH(l)", "2C(s) + 4H₂(g) + O₂(g) → 2CH₃OH(l)"],
            "Formation starts from the elements in their standard states and makes exactly one mole of the compound."),
          q12.num(1, "In an experiment 100 g of water is heated from 21.0 °C to 34.6 °C. Calculate the heat energy absorbed by the water, in J, to 3 significant figures. (c = 4.18 J g⁻¹ K⁻¹)", 5680, 10,
            "q = m × c × ΔT = 100 × 4.18 × 13.6 = 5685 J, which is 5680 J to 3 s.f."),
          q12.num(2, "Burning 0.50 g of ethanol, C₂H₅OH (Mr = 46.0), raised the temperature of 100 g of water from 21.0 °C to 34.6 °C. Calculate the enthalpy change of combustion of ethanol in kJ mol⁻¹, to the nearest whole number. (c = 4.18 J g⁻¹ K⁻¹)", -523, 3,
            "q = 100 × 4.18 × 13.6 = 5685 J = 5.685 kJ. n(ethanol) = 0.50 ÷ 46.0 = 0.01087 mol. ΔH = −5.685 ÷ 0.01087 = −523 kJ mol⁻¹ (negative because it is exothermic).", { diag: true }),
          q12.num(2, "Use the enthalpy cycle to calculate the standard enthalpy of formation of propane, C₃H₈(g), in kJ mol⁻¹, to 1 decimal place.", -104.5, 0.5,
            "By Hess's law: ΔHf = 3 × ΔHc(C) + 4 × ΔHc(H₂) − ΔHc(propane) = −1180.5 + (−1143.2) − (−2219.2) = −104.5 kJ mol⁻¹.",
            { diag: true, image: img("hess-propane.png", "Enthalpy cycle. At the top left, 3C(s) + 4H₂(g); at the top right, C₃H₈(g) + 5O₂(g), joined by an arrow labelled ΔHf = ? At the bottom, 3CO₂(g) + 4H₂O(l). Arrows down to the bottom are labelled 3 × (−393.5) plus 4 × (−285.8) from the elements, and −2219.2 from propane and oxygen.") }),
          q12.num(2, "Calculate ΔH for CH₄(g) + 2O₂(g) → CO₂(g) + 2H₂O(g) in kJ mol⁻¹ using mean bond enthalpies: C–H 413, O=O 498, C=O 805, O–H 464 (all kJ mol⁻¹).", -818, 2,
            "Broken: 4 × 413 + 2 × 498 = 2648 kJ. Formed: 2 × 805 + 4 × 464 = 3466 kJ. ΔH = broken − formed = 2648 − 3466 = −818 kJ mol⁻¹."),
          q12.single(2, "Why does a ΔH calculated from mean bond enthalpies often differ from a value calculated from enthalpies of formation?", "Mean bond enthalpies are averages taken over many different compounds, and they refer to gaseous molecules",
            ["Bond enthalpies are always measured at a different pressure and temperature from enthalpies of formation, so the two data sets can never agree", "Bond breaking is exothermic but bond making is endothermic", "Enthalpies of formation are only correct for gases"],
            "A given bond, such as C–H, has a slightly different enthalpy in each molecule. The mean is only an average. Bond enthalpies also assume all species are gases."),
          q12.short(1, "Give the unit of standard enthalpy change of reaction.", "kJ mol⁻¹", ["kJ mol-1", "kJ/mol", "kj mol-1", "kJ per mol", "kJmol-1", "kJ mol^-1", "kilojoules per mole", "kJ per mole", "kJ/mole", "kJmol⁻¹", "kJ mol -1", "kJ.mol-1", "kJ mol^(-1)", "kJ mol–1", "kJ mol−1", "kJ/mol-1", "kilojoule per mole", "kJ mol⁻¹ (kilojoules per mole)"],
            "Enthalpy change is energy per mole of reaction as written, in kilojoules per mole."),
          q12.single(2, "Which are the standard conditions used for enthalpy changes?", "100 kPa, a stated temperature (usually 298 K), and 1 mol dm⁻³ for solutions",
            ["101 kPa and 273 K, with solutions at 0.1 mol dm⁻³", "100 kPa and 373 K, with solutions at 1 mol dm⁻³", "1000 kPa and 298 K, with solutions at 1 mol dm⁻³"],
            "The current definition uses a pressure of 100 kPa and a stated temperature, typically 298 K, with solutions at 1 mol dm⁻³."),
          q12.num(2, "Use enthalpies of combustion to calculate ΔH for C₂H₄(g) + H₂(g) → C₂H₆(g), in kJ mol⁻¹. ΔHc: C₂H₄ = −1411, H₂ = −286, C₂H₆ = −1560 (kJ mol⁻¹).", -137, 1,
            "ΔHr = Σ ΔHc(reactants) − Σ ΔHc(products) = (−1411 − 286) − (−1560) = −137 kJ mol⁻¹."),
          q12.num(3, "25.0 cm³ of 2.00 mol dm⁻³ HCl is mixed with 25.0 cm³ of 2.00 mol dm⁻³ NaOH. The temperature rises by 13.7 K. Assuming the solution has the density and specific heat capacity of water (1.00 g cm⁻³, 4.18 J g⁻¹ K⁻¹), calculate the enthalpy change of neutralisation in kJ mol⁻¹, to 3 significant figures.", -57.3, 0.3,
            "The mixture has mass 50.0 g: q = 50.0 × 4.18 × 13.7 = 2863 J. n(H₂O formed) = 2.00 × 0.0250 = 0.0500 mol. ΔH = −2.863 ÷ 0.0500 = −57.3 kJ mol⁻¹."),
          q12.num(3, "The energy profile shows an exothermic reaction. Calculate the activation energy of the reverse reaction in kJ mol⁻¹.", 205, 0,
            "The reverse reaction starts from the products, which are 120 kJ lower than the reactants. It must climb the forward barrier plus this gap: 85 + 120 = 205 kJ mol⁻¹.",
            { image: img("profile.png", "Reaction profile for an exothermic reaction. Reactants at a higher energy level, a peak (the transition state) 85 kJ mol⁻¹ above the reactants, and products 120 kJ mol⁻¹ below the reactants. Labels show Ea (forward) = 85 kJ mol⁻¹ and ΔH = −120 kJ mol⁻¹.") }),
          q12.multi(2, "Which of these have a standard enthalpy of formation of exactly zero at 298 K?", ["O₂(g)", "Br₂(l)"], ["Br₂(g)", "C(diamond)"],
            "ΔHf is zero only for an element in its standard state. Oxygen gas and liquid bromine qualify. Gaseous bromine and diamond are not the standard states, so they have non-zero values."),
          q12.num(3, "Calculate the standard enthalpy of formation of ethanol, C₂H₅OH(l), in kJ mol⁻¹ to 1 decimal place, using ΔHc values: C(s) −393.5, H₂(g) −285.8, C₂H₅OH(l) −1367.0 (kJ mol⁻¹). The equation is 2C(s) + 3H₂(g) + ½O₂(g) → C₂H₅OH(l).", -277.4, 0.5,
            "ΔHf = Σ ΔHc(reactants) − Σ ΔHc(products) = [2(−393.5) + 3(−285.8)] − (−1367.0) = −787.0 − 857.4 + 1367.0 = −277.4 kJ mol⁻¹."),
        ],
      },
      flashcards: [
        { front: "Exothermic vs endothermic", back: "Exothermic: ΔH negative, heat released. Endothermic: ΔH positive, heat absorbed." },
        { front: "Standard conditions", back: "100 kPa, stated temperature (usually 298 K), 1 mol dm⁻³ solutions, elements in standard states." },
        { front: "Definition: standard enthalpy of formation", back: "Enthalpy change when 1 mole of a compound forms from its elements in their standard states." },
        { front: "Definition: standard enthalpy of combustion", back: "Enthalpy change when 1 mole of a substance burns completely in oxygen under standard conditions." },
        { front: "Calorimetry equations", back: "q = mcΔT (J), then ΔH = −q ÷ n, converted to kJ mol⁻¹." },
        { front: "Hess's law", back: "The enthalpy change of a reaction is independent of the route, if start and end states are the same." },
        { front: "ΔHr from ΔHf", back: "Σ ΔHf(products) − Σ ΔHf(reactants)." },
        { front: "ΔHr from ΔHc", back: "Σ ΔHc(reactants) − Σ ΔHc(products)." },
        { front: "ΔHr from bond enthalpies", back: "Σ bonds broken − Σ bonds formed." },
        { front: "Ea of the reverse reaction (exothermic profile)", back: "Ea(forward) + |ΔH|." },
      ],
    },
    13: {
      year: 13,
      subtopic: "A-level Year 13 (A2)",
      objectives: [
        "Lattice enthalpy, Born–Haber cycles, and the perfect ionic model compared with experiment.",
        "Enthalpy changes of atomisation, electron affinity, solution and hydration.",
        "Entropy, ΔS and the effect of state and number of moles of gas.",
        "Free-energy change ΔG = ΔH − TΔS and feasibility, including the temperature at which a reaction becomes feasible.",
      ],
      note: {
        title: "Born–Haber cycles, entropy and free energy",
        body: `## Born–Haber cycles

The **lattice enthalpy of formation** is the enthalpy change when 1 mole of an ionic solid forms from its gaseous ions, e.g. Na⁺(g) + Cl⁻(g) → NaCl(s). It is always exothermic. Other steps:

- **Atomisation** ΔHat: 1 mole of gaseous atoms from the element in its standard state (endothermic).
- **Ionisation energy**: X(g) → X⁺(g) + e⁻ (endothermic).
- **First electron affinity**: X(g) + e⁻ → X⁻(g) (exothermic for most non-metals). The **second** electron affinity (e.g. O⁻ → O²⁻) is **endothermic** because of repulsion.

By Hess's law ΔHf = sum of all the steps, so the lattice enthalpy is found by rearranging. Larger charges and smaller ions give a more exothermic lattice enthalpy. If the experimental value is more exothermic than the perfect ionic model predicts, the bonding has some **covalent character**.

**Enthalpy of solution** = −(lattice enthalpy of formation) + Σ enthalpies of hydration of the ions.

## Entropy and free energy

**Entropy** S measures the number of ways energy can be distributed (disorder). It increases from solid to liquid to gas and when more moles of gas form. ΔS = ΣS(products) − ΣS(reactants).

**ΔG = ΔH − TΔS** (ΔS in kJ K⁻¹ mol⁻¹, so divide J values by 1000). A reaction is thermodynamically **feasible** if ΔG ≤ 0; feasibility says nothing about rate.

## Worked examples

**Lattice enthalpy of KBr:** ΔHf = −394, atomisation of K +89, first IE of K +419, ½Br₂ atomisation +112, first electron affinity of Br −325 (all kJ mol⁻¹).
Lattice = −394 − 89 − 419 − 112 + 325 = **−689 kJ mol⁻¹**.

**Feasibility temperature:** ΔH = +58.0 kJ mol⁻¹, ΔS = +176 J K⁻¹ mol⁻¹. ΔG = 0 when T = ΔH ÷ ΔS = 58 000 ÷ 176 ≈ **330 K**; above this the reaction is feasible.`,
      },
      quiz: {
        title: "Energetics: Year 13 quiz",
        questions: [
          q13.single(1, "Which equation represents the lattice enthalpy of formation of sodium chloride?", "Na⁺(g) + Cl⁻(g) → NaCl(s)",
            ["Na(s) + ½Cl₂(g) → NaCl(s)", "NaCl(s) → Na⁺(g) + Cl⁻(g)", "Na(g) + Cl(g) → NaCl(s)"],
            "Lattice enthalpy of formation is for one mole of solid forming from its gaseous ions, so both ions must be gaseous on the left."),
          q13.single(1, "What name is given to the enthalpy change for Cl(g) + e⁻ → Cl⁻(g)?", "The first electron affinity of chlorine",
            ["The first ionisation energy of chlorine", "The enthalpy of atomisation of chlorine", "The enthalpy of formation of chloride"],
            "Adding an electron to a gaseous atom to make a 1− ion is the first electron affinity."),
          q13.num(2, "Use the Born–Haber cycle for sodium chloride to calculate the lattice enthalpy of formation of NaCl in kJ mol⁻¹.", -787, 2,
            "By Hess's law: lattice = ΔHf − (ΔHat Na + IE1 Na + ½ΔHat Cl₂ + EA Cl) = −411 − (107 + 496 + 122 − 349) = −411 − 376 = −787 kJ mol⁻¹.",
            { diag: true, image: img("bornhaber.png", "Born–Haber energy-level diagram for sodium chloride. From Na(s) + ½Cl₂(g) up by +107 to Na(g), then +122 to Cl(g), then +496 to Na⁺(g), then −349 to Na⁺(g) + Cl⁻(g). A downward arrow labelled lattice enthalpy = ? goes to NaCl(s). A second arrow from Na(s) + ½Cl₂(g) straight to NaCl(s) is labelled ΔHf = −411.") }),
          q13.single(1, "Which of these ionic compounds has the most exothermic lattice enthalpy of formation?", "LiF", ["NaCl", "KBr", "CsI"],
            "All have ions with a 1+/1− charge, so ion size decides. Li⁺ and F⁻ are the smallest ions, giving the strongest electrostatic attraction."),
          q13.num(2, "Calculate the enthalpy of solution of NaCl in kJ mol⁻¹. Lattice enthalpy of formation = −787; enthalpy of hydration of Na⁺(g) = −406; of Cl⁻(g) = −364 (all kJ mol⁻¹).", 17, 1,
            "Dissolving reverses the lattice formation (+787 kJ mol⁻¹) and then hydrates the ions: +787 − 406 − 364 = +17 kJ mol⁻¹."),
          q13.single(2, "Which reaction has the largest increase in entropy?", "CaCO₃(s) → CaO(s) + CO₂(g)",
            ["2H₂(g) + O₂(g) → 2H₂O(l)", "N₂(g) + 3H₂(g) → 2NH₃(g)", "H₂O(g) → H₂O(l)"],
            "Producing a gas from a solid gives the greatest rise in disorder. The other three reduce the number of moles of gas or condense a gas."),
          q13.num(2, "Calculate ΔS for N₂(g) + 3H₂(g) → 2NH₃(g) in J K⁻¹ mol⁻¹. Standard entropies (J K⁻¹ mol⁻¹): N₂ 191.6, H₂ 130.6, NH₃ 192.3.", -198.8, 0.5,
            "ΔS = ΣS(products) − ΣS(reactants) = 2 × 192.3 − (191.6 + 3 × 130.6) = 384.6 − 583.4 = −198.8 J K⁻¹ mol⁻¹. It is negative because 4 mol of gas become 2 mol."),
          q13.num(2, "For N₂(g) + 3H₂(g) → 2NH₃(g), ΔH = −92.2 kJ mol⁻¹ and ΔS = −198.8 J K⁻¹ mol⁻¹. Calculate ΔG at 298 K in kJ mol⁻¹ to 3 significant figures.", -33.0, 0.2,
            "Convert ΔS to kJ: −0.1988 kJ K⁻¹ mol⁻¹. ΔG = ΔH − TΔS = −92.2 − (298 × −0.1988) = −92.2 + 59.2 = −33.0 kJ mol⁻¹.", { diag: true }),
          q13.num(3, "The decomposition CaCO₃(s) → CaO(s) + CO₂(g) has ΔH = +178.0 kJ mol⁻¹ and ΔS = +160.0 J K⁻¹ mol⁻¹. Calculate the minimum temperature in K at which it becomes feasible, to 3 significant figures.", 1110, 5,
            "Feasible when ΔG < 0, so T > ΔH ÷ ΔS. Use ΔS = 0.1600 kJ K⁻¹ mol⁻¹: T = 178.0 ÷ 0.1600 = 1112.5 K ≈ 1110 K."),
          q13.single(2, "A reaction has a positive ΔH and a positive ΔS. When is it feasible?", "Only at high enough temperatures",
            ["At all temperatures", "At no temperature", "Only at low temperatures"],
            "ΔG = ΔH − TΔS. With ΔH > 0 and ΔS > 0, the −TΔS term becomes more negative as T rises, so ΔG turns negative only above a certain temperature."),
          q13.multi(3, "Which statements about ΔG are correct?", ["ΔG < 0 means a reaction is thermodynamically feasible", "A reaction with ΔG < 0 may still be extremely slow"],
            ["ΔG < 0 means a reaction is fast", "ΔG = ΔH + TΔS"],
            "ΔG = ΔH − TΔS tells you about feasibility, not rate. A high activation energy can make a feasible reaction so slow that it appears not to happen."),
          q13.num(3, "Calculate the standard enthalpy of formation of magnesium chloride, MgCl₂(s), in kJ mol⁻¹. Data (kJ mol⁻¹): lattice enthalpy of formation −2526; ΔHat Mg +148; IE1 Mg +738; IE2 Mg +1451; ΔHat ½Cl₂ +122 (per Cl atom); first EA of Cl −349 (per Cl).", -643, 2,
            "ΔHf = ΔHat(Mg) + IE1 + IE2 + 2 × ΔHat(Cl) + 2 × EA + lattice = 148 + 738 + 1451 + 244 − 698 − 2526 = −643 kJ mol⁻¹."),
          q13.single(2, "The experimental lattice enthalpy of silver iodide is more exothermic than the value calculated using the perfect ionic model. What does this suggest?", "The bonding in AgI has some covalent character in addition to ionic attraction",
            ["The Ag⁺ and I⁻ ions are perfectly spherical point charges, so the theoretical value must be the more reliable one", "The experimental value must be wrong", "AgI is purely ionic"],
            "The perfect ionic model uses only electrostatic attraction between spherical ions. Extra bonding from polarisation (covalent character) makes the real lattice enthalpy more exothermic."),
          q13.single(1, "Which has the highest standard molar entropy at 298 K?", "H₂O(g)", ["H₂O(s)", "H₂O(l)", "They are all equal"],
            "Gas particles are the most disordered, so H₂O(g) has the greatest entropy."),
        ],
      },
      flashcards: [
        { front: "Lattice enthalpy of formation", back: "Enthalpy change when 1 mole of a solid ionic lattice forms from its gaseous ions (always exothermic)." },
        { front: "Enthalpy of atomisation", back: "Enthalpy change to form 1 mole of gaseous atoms from the element in its standard state (endothermic)." },
        { front: "First electron affinity", back: "X(g) + e⁻ → X⁻(g); exothermic for most non-metals." },
        { front: "Why is the second electron affinity of oxygen endothermic?", back: "The incoming electron is repelled by the negative O⁻ ion." },
        { front: "What makes lattice enthalpy more exothermic?", back: "Higher ionic charges and smaller ionic radii." },
        { front: "Enthalpy of solution from lattice and hydration data", back: "ΔHsol = −ΔHlatt(formation) + ΣΔHhyd(ions)." },
        { front: "Evidence for covalent character in a lattice", back: "Experimental lattice enthalpy more exothermic than the perfect ionic model value." },
        { front: "Trend of entropy", back: "solid < liquid < gas; increases when moles of gas increase." },
        { front: "Gibbs equation and units", back: "ΔG = ΔH − TΔS, with ΔS converted from J to kJ." },
        { front: "Feasibility temperature", back: "T = ΔH ÷ ΔS when ΔG = 0; feasible above this if ΔH and ΔS are both positive." },
      ],
    },
  },
};
