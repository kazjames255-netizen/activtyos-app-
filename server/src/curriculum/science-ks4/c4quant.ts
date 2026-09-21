// GCSE Chemistry — Quantitative Chemistry (Year 10: Mr, moles, equations; Year 11: concentration, gas volumes, yield, titration).
import type { CTopic } from "../types";
import { N, S, M, W, yr } from "./_h";
import { TITRATION } from "./_imgdata";

const AR: Record<string, number> = { H: 1, C: 12, O: 16, Mg: 24, Ca: 40, Fe: 56, Na: 23, Cl: 35.5 };
const IMG = ["c4quant-titration.png", "A titration setup. A burette labelled A is clamped vertically above a conical flask labelled B standing on a white tile labelled D. A pipette labelled C is drawn to the side. The flask contains a pale liquid."] as [string, string];

export const TOPIC: CTopic = {
  key: "c4quant", topic: "Chemistry — Quantitative Chemistry", subject: "Science",
  years: {
    10: yr("c4quant", 10, {
      obj: [
        "Use the law of conservation of mass; balance symbol equations; explain mass changes in open systems.",
        "Calculate relative formula mass (Mr) and percentage by mass of an element in a compound.",
        "Use the mole and Avogadro's constant; use n = m ÷ Mr.",
        "Calculate reacting masses from balanced equations (higher tier) and identify the limiting reactant.",
        "Use appropriate significant figures and standard form.",
      ],
      note: ["GCSE Chemistry: moles, masses and equations", `## Conservation of mass
No atoms are created or destroyed, so the total mass of reactants equals the total mass of products. A reaction in an open container can seem to lose or gain mass when a gas escapes or enters, e.g. metal gains mass on heating as it combines with oxygen from the air.

## Key ideas and equations
| Quantity | Equation |
| --- | --- |
| Relative formula mass | add up the Ar values, e.g. Mr(H₂O) = 2 × 1 + 16 = 18 |
| Moles | n = mass (g) ÷ Mr |
| Mass | m = n × Mr |
| Percentage by mass | (Ar × number of atoms) ÷ Mr × 100 |

**Avogadro constant** 6.02 × 10²³ per mole. Ar values: H 1, C 12, O 16, Mg 24, Ca 40, Fe 56, Na 23, Cl 35.5, Al 27.

## Balancing
Aluminium burning: 4Al + 3O₂ → 2Al₂O₃ (4 Al and 6 O on each side). Only change the big numbers in front, never the small numbers inside formulae.

## Worked example (higher tier)
How many moles are in 53 g of sodium carbonate Na₂CO₃? Mr = 2 × 23 + 12 + 3 × 16 = 106, so n = 53 ÷ 106 = **0.50 mol**.
Reacting masses: from a balanced equation the ratio of moles gives the ratio of formulae, then convert back with m = n × Mr.

**Working scientifically:** give answers to a suitable number of significant figures (no more than the least precise data) and use standard form for very large numbers.`],
      quiz: "GCSE Chemistry: Quantitative Chemistry quiz (Year 10)",
      qs: [
        N(1, "Calculate the relative formula mass (Mr) of carbon dioxide, CO₂. (Ar: C = 12, O = 16)", 44, 0, "Mr = 12 + 2 × 16 = 12 + 32 = 44.", () => AR.C + 2 * AR.O),
        S(1, "What does the law of conservation of mass state?", "The total mass of the products equals the total mass of the reactants", ["Atoms are destroyed in chemical reactions", "Some mass is always lost as heat in a chemical reaction, so the products weigh less", "Products always weigh more than reactants"], "Atoms are only rearranged, never created or destroyed, so mass is conserved.", {}),
        S(1, "Which is the correctly balanced equation for magnesium burning in oxygen?", "2Mg + O₂ → 2MgO", ["Mg + O₂ → MgO", "Mg + O₂ → MgO₂", "2Mg + 2O₂ → 2MgO"], "Two O atoms in O₂ need two MgO, which needs two Mg: 2Mg + O₂ → 2MgO.", {}),
        N(2, "Calculate the number of moles in 14 g of iron. (Ar of Fe = 56)", 0.25, 0.005, "Moles = mass ÷ Ar = 14 ÷ 56 = 0.25 mol.", () => 14 / AR.Fe),
        N(2, "Calculate the mass of 0.20 mol of calcium carbonate, CaCO₃ (Ar: Ca = 40, C = 12, O = 16), in grams.", 20, 0.1, "Mr = 40 + 12 + 3 × 16 = 100. Mass = moles × Mr = 0.20 × 100 = 20 g.", () => 0.2 * (AR.Ca + AR.C + 3 * AR.O), { diag: true }),
        S(2, "A student heats magnesium ribbon in an open crucible. The mass of the solid increases. Why?", "Oxygen from the air combines with the magnesium", ["New magnesium atoms are created during burning", "Heat has mass, which is added to the magnesium", "The crucible absorbs magnesium"], "Magnesium oxide forms, and the oxygen that joined the metal came from the air, so the solid gains mass.", {}),
        N(2, "How many molecules are there in 0.50 mol of water? Give your answer as a number × 10²³ (Avogadro constant = 6.02 × 10²³ per mole).", 3.01, 0.005, "Molecules = moles × 6.02 × 10²³ = 0.50 × 6.02 × 10²³ = 3.01 × 10²³.", () => 0.5 * 6.02),
        M(2, "Which statements are true for a balanced equation? Choose all that apply.", ["There are equal numbers of each type of atom on both sides", "The total mass of reactants equals the total mass of products"], ["There are equal numbers of molecules on both sides", "Formulae can be changed to make the numbers match"], "Balancing changes the numbers in front of formulae, never the formulae themselves. The number of molecules can change (2H₂ + O₂ → 2H₂O has 3 molecules on the left, 2 on the right).", {}),
        S(2, "What is the relative formula mass of magnesium hydroxide, Mg(OH)₂? (Ar: Mg = 24, O = 16, H = 1)", "58", ["41", "57", "82"], "Mg(OH)₂ has one Mg and two OH groups: 24 + 2 × (16 + 1) = 24 + 34 = 58.", { diag: true, chk: () => AR.Mg + 2 * (AR.O + AR.H) }),
        N(2, "Calculate the percentage by mass of oxygen in iron(III) oxide, Fe₂O₃. (Ar: Fe = 56, O = 16)", 30, 0.1, "Mr = 2 × 56 + 3 × 16 = 160. Oxygen = 48 ÷ 160 × 100 = 30%.", () => ((3 * AR.O) / (2 * AR.Fe + 3 * AR.O)) * 100),
        N(3, "2Mg + O₂ → 2MgO. What mass of magnesium oxide forms when 6.0 g of magnesium burns completely? (Ar: Mg = 24, O = 16)", 10, 0.1, "Moles Mg = 6.0 ÷ 24 = 0.25 mol. The equation is 2 : 2, so 0.25 mol MgO. Mr(MgO) = 40, so mass = 0.25 × 40 = 10 g.", () => (6 / AR.Mg) * (AR.Mg + AR.O)),
        N(3, "0.30 mol of magnesium is burned with 0.10 mol of oxygen: 2Mg + O₂ → 2MgO. Oxygen is the limiting reactant. What mass of magnesium oxide forms, in grams? (Ar: Mg = 24, O = 16)", 8, 0.1, "0.10 mol O₂ reacts with 0.20 mol Mg (ratio 1 : 2) to make 0.20 mol MgO. Mass = 0.20 × 40 = 8.0 g. The extra 0.10 mol Mg is in excess.", () => 0.1 * 2 * (AR.Mg + AR.O)),
        S(3, "A student burns 5.0 g of wood and collects 0.5 g of ash. She says mass is not conserved. What is the best reply?", "Gases such as carbon dioxide and water vapour escaped into the air, taking mass with them", ["The wood was destroyed by the flame, so its atoms no longer exist and cannot be weighed", "Ash is made of lighter atoms than wood, so the same number of atoms weighs less", "Mass is only conserved in reactions involving metals"], "Wood burns with oxygen from the air to make CO₂ and water vapour. These gases leave, so the ash weighs less. Total mass is still conserved.", {}),
      ],
      cards: [
        ["Law of conservation of mass", "Total mass of reactants = total mass of products; atoms are only rearranged."],
        ["Mr (relative formula mass)", "Sum of the Ar values of all atoms in the formula."],
        ["Moles equation", "n = mass ÷ Mr."],
        ["Mass from moles", "mass = n × Mr."],
        ["Avogadro constant", "6.02 × 10²³ particles per mole."],
        ["Why might mass increase when a metal burns in air?", "It combines with oxygen from the air."],
        ["Why might mass decrease in an open reaction?", "A gas escapes."],
        ["Percentage by mass of an element", "(Ar × atoms) ÷ Mr × 100."],
        ["Balancing rule", "Change numbers in front of formulae only; never subscripts."],
        ["Limiting reactant", "The reactant that is used up first, limiting the product made."],
        ["Ar of H, C, O, Na, Mg, Cl", "1, 12, 16, 23, 24, 35.5."],
        ["Reacting masses method", "Mass → moles → use ratio in equation → moles → mass."],
      ],
    }),
    11: yr("c4quant", 11, {
      obj: [
        "Calculate concentration in g/dm³ and mol/dm³; convert between cm³ and dm³.",
        "Use the molar gas volume (24 dm³ at room temperature and pressure) and calculate volumes of gases.",
        "Calculate percentage yield and atom economy; explain why yield is less than 100%.",
        "Carry out and interpret titrations: identify apparatus, calculate unknown concentrations (higher tier).",
        "Choose appropriate significant figures; evaluate precision (concordant results).",
      ],
      note: ["GCSE Chemistry: concentration, gases, yield and titration", `## Key equations
| Quantity | Equation |
| --- | --- |
| Concentration (g/dm³) | mass ÷ volume (dm³) |
| Moles from solution | n = concentration (mol/dm³) × volume (dm³) |
| Gas volume at RTP | volume (dm³) = moles × 24 |
| Percentage yield | actual mass ÷ theoretical mass × 100 |
| Atom economy | Mr of desired product ÷ total Mr of all products × 100 |

Convert cm³ to dm³ by dividing by 1000.

## Why yield is below 100%
The reaction may be **reversible**, some product is lost when filtering or transferring, and **side reactions** occur.

## Titration (required practical)
Use a **pipette** to measure exactly 25.0 cm³ of alkali into a conical flask on a white tile, add indicator, and run acid from a **burette** until the colour changes. Repeat until results are **concordant** (within 0.10 cm³), then use the mean. For HCl + NaOH the ratio is 1 : 1.

## Worked example
30.0 cm³ of sodium hydroxide is neutralised by 20.0 cm³ of 0.150 mol/dm³ HCl.
Moles HCl = 0.150 × 0.0200 = 0.00300 mol. Ratio 1 : 1, so NaOH = 0.00300 mol.
Concentration = 0.00300 ÷ 0.0300 = **0.100 mol/dm³**.

Percentage yield: theoretical 5.0 g, actual 4.0 g → 4.0 ÷ 5.0 × 100 = **80%**.

**Working scientifically:** reject a rough first titration when finding the mean.`],
      quiz: "GCSE Chemistry: Quantitative Chemistry quiz (Year 11)",
      qs: [
        N(1, "Convert 250 cm³ into dm³.", 0.25, 0.001, "There are 1000 cm³ in 1 dm³, so divide by 1000: 250 ÷ 1000 = 0.25 dm³.", () => 250 / 1000),
        S(1, "What volume does 1 mole of any gas occupy at room temperature and pressure?", "24 dm³", ["22.4 dm³", "1 dm³", "12 dm³"], "At RTP one mole of any gas has a volume of 24 dm³ (24 000 cm³).", {}),
        S(1, "How is percentage yield calculated?", "Actual yield ÷ theoretical yield × 100", ["Theoretical yield ÷ actual yield × 100", "Mass of reactants ÷ mass of products × 100", "Actual yield × theoretical yield ÷ 100"], "Percentage yield compares the mass actually made with the maximum possible mass.", {}),
        N(2, "5.0 g of salt is dissolved in water to make 250 cm³ of solution. Calculate the concentration in g/dm³.", 20, 0.1, "Convert the volume: 250 cm³ = 0.25 dm³. Concentration = 5.0 ÷ 0.25 = 20 g/dm³.", () => 5.0 / (250 / 1000), { diag: true }),
        N(2, "How many moles of hydrochloric acid are in 25.0 cm³ of a 0.200 mol/dm³ solution?", 0.005, 0.00005, "Volume = 25.0 ÷ 1000 = 0.0250 dm³. Moles = 0.200 × 0.0250 = 0.00500 mol.", () => 0.2 * (25 / 1000)),
        N(2, "Calculate the volume of 0.25 mol of hydrogen gas at room temperature and pressure, in dm³. (1 mole of any gas occupies 24 dm³ at room temperature and pressure.)", 6, 0.05, "Volume = moles × 24 dm³ = 0.25 × 24 = 6.0 dm³.", () => 0.25 * 24),
        N(2, "In an experiment the theoretical yield is 12.0 g but only 8.4 g of product is collected. Calculate the percentage yield.", 70, 0.1, "Percentage yield = 8.4 ÷ 12.0 × 100 = 70%.", () => (8.4 / 12.0) * 100, { diag: true }),
        N(2, "CaCO₃ → CaO + CO₂. Calculate the atom economy for making calcium oxide (Mr = 56) from calcium carbonate (Mr = 100), as a percentage.", 56, 0.1, "Atom economy = Mr of desired product ÷ Mr of all reactants (or total products) × 100 = 56 ÷ 100 × 100 = 56%.", () => (56 / 100) * 100),
        S(2, "Which is a reason why the percentage yield of a reaction is less than 100%?", "Some product is lost during filtering or transferring", ["Atoms are destroyed in the reaction", "The reactants are heavier than the products", "The reaction always makes the wrong compound"], "Losses in separation and transfer, side reactions and reversible reactions all reduce the actual yield. Atoms are never destroyed.", {}),
        S(2, "In the titration apparatus, which labelled item is the burette?", "A", ["B", "C", "D"], "The burette is the long graduated tube that delivers acid drop by drop while its volume is read. B is the flask, C the pipette and D the white tile.", { img: IMG }),
        N(3, "25.0 cm³ of sodium hydroxide is neutralised by 22.5 cm³ of 0.100 mol/dm³ hydrochloric acid. Calculate the concentration of the sodium hydroxide in mol/dm³. (HCl + NaOH → NaCl + H₂O)", 0.09, 0.0005, "Moles HCl = 0.100 × 0.0225 = 0.00225 mol. Ratio is 1 : 1, so NaOH = 0.00225 mol. Concentration = 0.00225 ÷ 0.0250 = 0.0900 mol/dm³.", () => (TITRATION.cAcid * (TITRATION.vAcid / 1000)) / (TITRATION.vAlk / 1000)),
        N(3, "Calcium carbonate decomposes: CaCO₃ → CaO + CO₂. Calculate the volume of carbon dioxide made at room temperature and pressure, in dm³, when 10.0 g of CaCO₃ (Mr = 100) decomposes completely. (1 mole of any gas occupies 24 dm³ at room temperature and pressure.)", 2.4, 0.05, "Moles CaCO₃ = 10.0 ÷ 100 = 0.100 mol. The ratio is 1 : 1, so CO₂ = 0.100 mol. Volume = 0.100 × 24 = 2.4 dm³.", () => (10 / 100) * 24),
        W("Describe how to carry out a titration to find the concentration of an alkali, and explain how to obtain reliable and precise results. [6 marks]", "Mark scheme (6): use a pipette and filler to put exactly 25.0 cm³ alkali into a conical flask (1); add a few drops of indicator (1); fill the burette with acid and record the start reading (1); add acid slowly, swirling, until the end-point colour change, adding drop by drop near the end (1); record the final reading and subtract to get the titre (1); repeat until concordant results (within 0.10 cm³), ignore the rough titre and calculate a mean (1)."),
      ],
      cards: [
        ["cm³ to dm³", "Divide by 1000."],
        ["Concentration (g/dm³)", "mass (g) ÷ volume (dm³)."],
        ["Moles from concentration", "n = concentration (mol/dm³) × volume (dm³)."],
        ["Molar gas volume at RTP", "24 dm³ per mole."],
        ["Percentage yield", "actual ÷ theoretical × 100."],
        ["Atom economy", "Mr of desired product ÷ total Mr of products × 100."],
        ["Three reasons yield < 100%", "Reversible reaction, losses when separating, side reactions."],
        ["Burette vs pipette", "Burette: adds variable volumes accurately; pipette: measures one fixed volume."],
        ["Concordant results", "Titres within 0.10 cm³ of each other."],
        ["Why a white tile?", "Makes the colour change at the end-point easier to see."],
        ["Titration calculation steps", "Moles of known → ratio → moles of unknown → ÷ volume."],
        ["High atom economy is good because", "Less waste and more sustainable use of raw materials."],
      ],
    }),
  },
};
