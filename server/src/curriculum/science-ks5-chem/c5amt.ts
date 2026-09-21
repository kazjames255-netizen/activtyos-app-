// A-level Chemistry — Amount of Substance (Year 12). Original content aligned to the DfE GCE AS/A-level chemistry subject content.
// Keys are recomputed by _chk_c5amt.ts — re-run _check_s6.ts after ANY edit here.
import type { CTopic } from "../types";
import { qb } from "./_h";

const q = qb("c5amt", 12);
export const TOPIC: CTopic = {
  key: "c5amt",
  topic: "Chemistry — Amount of Substance",
  subject: "Science",
  years: {
    12: {
      year: 12,
      subtopic: "A-level Year 12 (AS)",
      objectives: [
        "The mole and the Avogadro constant; relative atomic and molecular mass; molar mass.",
        "The ideal gas equation pV = nRT (SI units) and calculations with gas volumes.",
        "Empirical and molecular formulae; water of crystallisation.",
        "Concentration in mol dm⁻³; titration calculations and reacting quantities including limiting reagents.",
        "Percentage yield and atom economy.",
      ],
      note: {
        title: "Moles, gases, concentrations, titrations and yield",
        body: `## Key equations

One **mole** contains 6.02 × 10²³ particles (the Avogadro constant). Work in moles, then convert.

| Quantity | Equation | Units |
| --- | --- | --- |
| Amount of substance | n = m ÷ M | mol, g, g mol⁻¹ |
| Solutions | n = c × V | mol, mol dm⁻³, dm³ |
| Ideal gas | pV = nRT | Pa, m³, mol, R = 8.31 J K⁻¹ mol⁻¹, K |
| Percentage yield | actual ÷ theoretical × 100 | % |
| Atom economy | Mr of desired product ÷ Σ Mr of all products × 100 | % |

**Unit traps.** Convert cm³ to dm³ by ÷ 1000, cm³ to m³ by ÷ 10⁶, kPa to Pa by × 1000, °C to K by + 273.

**Empirical formula:** divide each mass (or percentage) by its Ar, then divide by the smallest answer to get the simplest whole-number ratio. The **molecular formula** is a whole-number multiple of it, found using Mr.

**Limiting reagent:** convert both reactants to moles, divide by their equation coefficients, and the smaller value limits the amount of product.

## Worked example: titration

20.0 cm³ of potassium hydroxide is neutralised by 18.40 cm³ of 0.150 mol dm⁻³ nitric acid. Find the concentration of the KOH.

KOH + HNO₃ → KNO₃ + H₂O (1 : 1)
1. n(HNO₃) = 0.150 × 18.40 ÷ 1000 = 2.76 × 10⁻³ mol
2. n(KOH) = 2.76 × 10⁻³ mol
3. c(KOH) = 2.76 × 10⁻³ ÷ 0.0200 = **0.138 mol dm⁻³**

## Worked example: gas volume

0.0200 mol of gas at 350 K and 100 kPa: V = nRT ÷ p = (0.0200 × 8.31 × 350) ÷ 100 000 = 5.82 × 10⁻⁴ m³ = **582 cm³**.`,
      },
      quiz: {
        title: "Amount of Substance: Year 12 quiz",
        questions: [
          q.num(1, "Calculate the relative formula mass (Mr) of calcium hydroxide, Ca(OH)₂. Use Ar: Ca = 40.1, O = 16.0, H = 1.0.", 74.1, 0.1,
            "Ca(OH)₂ contains one Ca and two OH groups: 40.1 + 2 × (16.0 + 1.0) = 74.1."),
          q.num(1, "How many moles are there in 5.85 g of sodium chloride, NaCl? (Ar: Na = 23.0, Cl = 35.5)", 0.100, 0.002,
            "Mr = 58.5. n = m ÷ M = 5.85 ÷ 58.5 = 0.100 mol."),
          q.num(1, "What mass of calcium carbonate, CaCO₃, is 0.250 mol? (Ar: Ca = 40.1, C = 12.0, O = 16.0) Give your answer in g to 3 significant figures.", 25.0, 0.2,
            "Mr = 40.1 + 12.0 + 3 × 16.0 = 100.1. m = n × M = 0.250 × 100.1 = 25.0 g."),
          q.num(2, "4.00 g of sodium hydroxide is dissolved in water and made up to 250 cm³ of solution. Calculate the concentration in mol dm⁻³. (Mr of NaOH = 40.0)", 0.400, 0.005,
            "n = 4.00 ÷ 40.0 = 0.100 mol. Volume = 250 cm³ = 0.250 dm³. c = n ÷ V = 0.100 ÷ 0.250 = 0.400 mol dm⁻³.", { diag: true }),
          q.num(2, "Calculate the volume, in cm³, occupied by 0.0500 mol of a gas at 298 K and 101 kPa. (R = 8.31 J K⁻¹ mol⁻¹) Give your answer to 3 significant figures.", 1230, 10,
            "V = nRT ÷ p with p = 101 000 Pa: (0.0500 × 8.31 × 298) ÷ 101 000 = 1.226 × 10⁻³ m³ = 1226 cm³ ≈ 1230 cm³."),
          q.single(2, "A compound contains 40.0 % carbon, 6.7 % hydrogen and 53.3 % oxygen by mass. What is its empirical formula? (Ar: C = 12.0, H = 1.0, O = 16.0)", "CH₂O",
            ["CHO", "C₂H₄O", "CH₄O"],
            "Moles: C 40.0 ÷ 12.0 = 3.33, H 6.7 ÷ 1.0 = 6.7, O 53.3 ÷ 16.0 = 3.33. Dividing by 3.33 gives 1 : 2 : 1, so CH₂O."),
          q.short(2, "A compound has empirical formula CH₂O and Mr = 180.0. Give its molecular formula. (Ar: C = 12.0, H = 1.0, O = 16.0)", "C₆H₁₂O₆", ["C6H12O6", "c6h12o6"],
            "The empirical formula mass of CH₂O is 30.0. 180.0 ÷ 30.0 = 6, so multiply every subscript by 6 to get C₆H₁₂O₆."),
          q.num(2, "25.0 cm³ of sodium hydroxide solution is neutralised by 21.50 cm³ of 0.100 mol dm⁻³ hydrochloric acid (NaOH + HCl → NaCl + H₂O). Calculate the concentration of the sodium hydroxide in mol dm⁻³ to 3 significant figures.", 0.0860, 0.001,
            "n(HCl) = 0.100 × 21.50 ÷ 1000 = 2.15 × 10⁻³ mol. The ratio is 1 : 1, so n(NaOH) = 2.15 × 10⁻³ mol, and c = 2.15 × 10⁻³ ÷ 0.0250 = 0.0860 mol dm⁻³.", { diag: true }),
          q.num(2, "Heating 6.00 g of calcium carbonate gives 2.00 g of calcium oxide (CaCO₃ → CaO + CO₂). Calculate the percentage yield of calcium oxide to 3 significant figures. (Ar: Ca = 40.1, C = 12.0, O = 16.0)", 59.5, 0.4,
            "n(CaCO₃) = 6.00 ÷ 100.1 = 0.0599 mol, so the theoretical mass of CaO = 0.0599 × 56.1 = 3.363 g. Yield = 2.00 ÷ 3.363 × 100 = 59.5 %."),
          q.num(3, "2.43 g of magnesium is added to 100 cm³ of 1.00 mol dm⁻³ hydrochloric acid (Mg + 2HCl → MgCl₂ + H₂). Calculate the volume of hydrogen produced in dm³, where 1 mole of gas occupies 24.0 dm³. (Ar: Mg = 24.3)", 1.20, 0.02,
            "n(Mg) = 2.43 ÷ 24.3 = 0.100 mol; n(HCl) = 1.00 × 0.100 = 0.100 mol. HCl needs 2 per Mg, so HCl is limiting: n(H₂) = 0.100 ÷ 2 = 0.0500 mol, and V = 0.0500 × 24.0 = 1.20 dm³."),
          q.num(3, "Hydrated copper(II) sulfate, CuSO₄·xH₂O, has mass 2.49 g. After heating until constant mass, 1.59 g of anhydrous CuSO₄ remains. Find x. (Ar: Cu = 63.5, S = 32.1, O = 16.0, H = 1.0)", 5, 0,
            "Water lost = 2.49 − 1.59 = 0.90 g, so n(H₂O) = 0.90 ÷ 18.0 = 0.0500 mol. n(CuSO₄) = 1.59 ÷ 159.6 = 0.00996 mol. The ratio 0.0500 : 0.00996 ≈ 5 : 1, so x = 5."),
          q.num(3, "0.240 g of a gas occupies 100 cm³ at 300 K and 100 kPa. Use pV = nRT (R = 8.31 J K⁻¹ mol⁻¹) to calculate the relative molecular mass of the gas, to 3 significant figures.", 59.8, 0.6,
            "V = 100 cm³ = 1.00 × 10⁻⁴ m³ and p = 1.00 × 10⁵ Pa. n = pV ÷ RT = 10.0 ÷ (8.31 × 300) = 4.01 × 10⁻³ mol. Mr = m ÷ n = 0.240 ÷ 4.01 × 10⁻³ = 59.8."),
          q.single(1, "How many molecules are there in 0.500 mol of carbon dioxide? (Avogadro constant = 6.02 × 10²³ mol⁻¹)", "3.01 × 10²³",
            ["6.02 × 10²³", "1.20 × 10²⁴", "3.01 × 10²²"],
            "Number of particles = n × 6.02 × 10²³ = 0.500 × 6.02 × 10²³ = 3.01 × 10²³."),
          q.num(2, "Ethanol can be made by C₂H₅Br + NaOH → C₂H₅OH + NaBr. Calculate the atom economy for making ethanol, as a percentage to 3 significant figures. (Ar: C = 12.0, H = 1.0, O = 16.0, Na = 23.0, Br = 79.9)", 30.9, 0.2,
            "Atom economy = Mr(desired) ÷ Σ Mr(all products) × 100. Mr(C₂H₅OH) = 46.0 and Mr(NaBr) = 102.9, so 46.0 ÷ (46.0 + 102.9) × 100 = 30.9 %."),
        ],
      },
      flashcards: [
        { front: "The Avogadro constant", back: "6.02 × 10²³ particles per mole." },
        { front: "n = ?  (mass)", back: "n = m ÷ M  (mol = g ÷ g mol⁻¹)." },
        { front: "n = ?  (solution)", back: "n = c × V, with V in dm³ (cm³ ÷ 1000)." },
        { front: "Ideal gas equation and units", back: "pV = nRT: p in Pa, V in m³, T in K, R = 8.31 J K⁻¹ mol⁻¹." },
        { front: "Convert 250 cm³ to m³ and dm³", back: "250 cm³ = 0.250 dm³ = 2.50 × 10⁻⁴ m³." },
        { front: "How to find an empirical formula", back: "Divide each mass or % by its Ar, then by the smallest result, and take the whole-number ratio." },
        { front: "Molecular formula from empirical formula", back: "Divide Mr by the empirical formula mass and multiply every subscript by that whole number." },
        { front: "How to find the limiting reagent", back: "Convert to moles, divide by the equation coefficient; the smallest value is limiting." },
        { front: "Percentage yield", back: "Actual mass ÷ theoretical mass × 100." },
        { front: "Atom economy", back: "Mr of desired product ÷ Σ Mr of all products × 100." },
      ],
    },
  },
};
