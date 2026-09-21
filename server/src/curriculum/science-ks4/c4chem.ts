// GCSE Chemistry — Chemical & Energy Changes (Year 10: reactivity, acids, salts, redox; Year 11: electrolysis, energy changes).
import type { CTopic } from "../types";
import { N, S, M, W, yr } from "./_h";
import { PROFILE } from "./_imgdata";

const PRO = ["c4chem-profile.png", "A reaction profile: energy in kilojoules per mole on the vertical axis (marks at 0, 100, 200 and so on up to 700), progress of reaction on the horizontal axis. The reactants sit at 400. The curve rises to a peak at 600 and then falls to the products at 250."] as [string, string];
const ELEC = ["c4chem-electrolysis.png", "A diagram of electrolysis of molten lead bromide. Two electrodes, labelled X on the left and Y on the right, dip into a crucible of molten liquid. A power supply above is wired so that electrode X is connected to the negative terminal and electrode Y is connected to the positive terminal."] as [string, string];

export const TOPIC: CTopic = {
  key: "c4chem", topic: "Chemistry — Chemical & Energy Changes", subject: "Science",
  years: {
    10: yr("c4chem", 10, {
      obj: [
        "Use the reactivity series; describe displacement reactions and extraction of metals (reduction with carbon, electrolysis).",
        "Define oxidation and reduction in terms of oxygen and electrons.",
        "Describe reactions of acids with metals, bases, alkalis and carbonates; name salts.",
        "Describe strong and weak acids, the pH scale and neutralisation as H⁺ + OH⁻ → H₂O.",
        "Required practical: prepare a pure, dry sample of a soluble salt.",
      ],
      note: ["GCSE Chemistry: reactivity, acids and salts", `## Reactivity and extraction
Reactivity series (most to least): potassium, sodium, calcium, magnesium, **aluminium**, (carbon), zinc, iron, (hydrogen), copper. A more reactive metal **displaces** a less reactive metal from its compound. Metals **less reactive than carbon** (zinc, iron) are extracted by **reduction with carbon**; more reactive metals (aluminium) need **electrolysis**.

**Oxidation** = loss of electrons (or gain of oxygen); **reduction** = gain of electrons (or loss of oxygen).
Example: Fe²⁺ + 2e⁻ → Fe is reduction.

## Acids and salts
| Reaction | Products |
| --- | --- |
| acid + metal | salt + hydrogen |
| acid + metal oxide/hydroxide | salt + water |
| acid + metal carbonate | salt + water + carbon dioxide |

Hydrochloric acid → **chlorides**; sulfuric → **sulfates**; nitric → **nitrates**. Neutralisation: **H⁺ + OH⁻ → H₂O**. **Strong** acids ionise completely; **weak** acids ionise only partially. Each pH unit down is 10 × more H⁺.

## Preparing a salt (required practical)
Add the solid **in excess** to warm acid until no more reacts, **filter** off the excess, heat gently to concentrate, leave to **crystallise**, then dry the crystals.

## Worked example
Zinc + sulfuric acid: Zn + H₂SO₄ → ZnSO₄ + H₂ (**zinc sulfate** and hydrogen). Zinc atoms lose 2 electrons (oxidised).

**Working scientifically:** state the observations (fizzing, colour change, temperature rise) as evidence for a reaction.`],
      quiz: "GCSE Chemistry: Chemical Changes quiz (Year 10)",
      qs: [
        S(1, "Which of these metals is the most reactive?", "Magnesium", ["Zinc", "Copper", "Iron"], "In the reactivity series magnesium is above zinc, iron and copper.", {}),
        S(1, "What are the products when an acid reacts with a metal oxide?", "A salt and water", ["A salt and hydrogen", "A salt, water and carbon dioxide", "Only a salt"], "Acid + metal oxide → salt + water. Hydrogen comes from metals, and carbon dioxide from carbonates.", {}),
        S(1, "Which pH value shows a strongly acidic solution?", "1", ["7", "10", "14"], "pH 1 is strongly acidic; pH 7 is neutral; pH 10 and 14 are alkaline.", {}),
        S(2, "What is the name of the salt formed when zinc reacts with hydrochloric acid?", "Zinc chloride", ["Zinc sulfate", "Zinc hydroxide", "Zinc oxide"], "The first part of the name is the metal and the second part comes from the acid: hydrochloric acid gives chlorides.", {}),
        S(2, "Why is aluminium extracted by electrolysis and not by heating with carbon?", "It is more reactive than carbon", ["It is less reactive than carbon", "It is a non-metal", "Carbon is too expensive"], "Carbon can only reduce metals less reactive than itself. Aluminium is above carbon in the series, so electrolysis is needed.", {}),
        S(2, "Magnesium forms ions: Mg → Mg²⁺ + 2e⁻. What is happening to the magnesium?", "It is oxidised because it loses electrons", ["It is reduced because it loses electrons", "It is oxidised because it gains electrons", "It is reduced because it gains electrons"], "Oxidation is loss of electrons (OIL RIG: Oxidation Is Loss, Reduction Is Gain).", { diag: true }),
        S(2, "In which experiment will a reaction happen?", "An iron nail in copper sulfate solution", ["A copper wire in iron sulfate solution", "A copper wire in zinc sulfate solution", "A silver wire in copper sulfate solution"], "Iron is more reactive than copper so displaces it, giving a brown-red coating of copper. Copper and silver are less reactive than the metals in the other solutions.", {}),
        M(2, "Which reactions produce a salt? Choose all that apply.", ["Acid + metal carbonate", "Acid + metal hydroxide"], ["Metal + oxygen", "Alkali + water"], "Acids react with carbonates and hydroxides to give a salt. Burning a metal gives an oxide, not a salt.", {}),
        S(2, "In making copper sulfate from copper oxide and sulfuric acid, why is copper oxide added in excess?", "So all the acid reacts, and the unreacted solid can be filtered off", ["To make the solution more acidic", "So that the solution becomes more concentrated and larger crystals form", "So that the copper sulfate dissolves better"], "Copper oxide is insoluble, so extra solid ensures no acid is left and is easily removed by filtering.", {}),
        S(2, "Which describes a weak acid?", "It only partially ionises in water", ["It has a low concentration of acid", "It always has a pH close to 7", "It ionises completely in water"], "Weak acids such as ethanoic acid ionise partially. Concentration (how much acid is dissolved) is a separate idea.", { diag: true }),
        N(3, "How many times greater is the hydrogen ion concentration in a solution of pH 2 than in a solution of pH 5?", 1000, 0, "Each pH unit is a factor of 10. Three units difference gives 10 × 10 × 10 = 1000 times.", () => 10 ** (5 - 2)),
        S(3, "For Zn + Cu²⁺ → Zn²⁺ + Cu, which statement is correct?", "Zinc loses electrons and is oxidised; copper ions gain electrons and are reduced", ["Zinc gains electrons and is reduced; copper ions lose electrons and are oxidised", "Both zinc and copper ions are oxidised because they both change", "Zinc is reduced because it forms a positive ion"], "Zinc atoms give 2 electrons to copper ions. Loss of electrons is oxidation; gain is reduction.", {}),
        W("Describe how to prepare pure, dry crystals of copper sulfate from copper oxide and dilute sulfuric acid. [6 marks]", "Mark scheme (6): warm the dilute sulfuric acid (1); add copper oxide in small amounts, stirring, until no more dissolves (excess) (1); filter to remove the excess copper oxide (1); the filtrate is copper sulfate solution; heat gently to evaporate some water (crystallisation point) (1); leave to cool and crystallise (1); filter/pat the crystals dry between filter paper or leave in a warm place (1)."),
      ],
      cards: [
        ["Reactivity order (top part)", "Potassium, sodium, calcium, magnesium, aluminium, (carbon), zinc, iron, (hydrogen), copper."],
        ["Displacement reaction", "A more reactive metal takes the place of a less reactive metal in a compound."],
        ["Metals extracted by carbon", "Those less reactive than carbon (e.g. iron, zinc)."],
        ["Oxidation / reduction (electrons)", "Oxidation = loss of electrons; reduction = gain of electrons (OIL RIG)."],
        ["Acid + metal", "Salt + hydrogen."],
        ["Acid + metal carbonate", "Salt + water + carbon dioxide."],
        ["Names of salts from acids", "Hydrochloric → chlorides; sulfuric → sulfates; nitric → nitrates."],
        ["Neutralisation ionic equation", "H⁺(aq) + OH⁻(aq) → H₂O(l)."],
        ["Strong vs weak acid", "Strong ionises completely; weak partially."],
        ["pH and hydrogen ions", "Each pH unit lower means 10 times higher H⁺ concentration."],
        ["Why add solid in excess?", "To make sure all the acid reacts; filter off the excess."],
        ["pH of neutral solution", "pH 7."],
      ],
    }),
    11: yr("c4chem", 11, {
      obj: [
        "Describe electrolysis of molten ionic compounds and aqueous solutions; predict products at each electrode.",
        "Use half equations; explain oxidation at the anode and reduction at the cathode; describe aluminium extraction.",
        "Distinguish exothermic and endothermic reactions and give examples.",
        "Interpret reaction profiles: activation energy, energy change, effect of a catalyst.",
        "Calculate energy change from bond energies (higher tier).",
        "Describe cells, batteries and hydrogen fuel cells (triple).",
        "Required practical: measure temperature changes in reactions (insulation, repeats).",
      ],
      note: ["GCSE Chemistry: electrolysis and energy changes", `## Electrolysis
Electrolysis breaks down an ionic compound using electricity when it is **molten or dissolved**. Positive ions go to the **cathode** (−) and are **reduced**; negative ions go to the **anode** (+) and are **oxidised**.
- Molten lead bromide: lead at the cathode, bromine at the anode.
- Aqueous solutions: at the cathode hydrogen forms if the metal is more reactive than hydrogen; at the anode a halogen forms from a halide.
- Aluminium oxide is dissolved in molten **cryolite** to lower the melting point; carbon anodes burn away.

Half equations: Pb²⁺ + 2e⁻ → Pb (reduction) and 2Br⁻ → Br₂ + 2e⁻ (oxidation).

## Energy changes
**Exothermic**: energy released to surroundings (temperature rises; combustion, neutralisation). **Endothermic**: energy taken in (temperature falls; thermal decomposition).
A **reaction profile** shows reactants, the peak (**activation energy**, the minimum energy to start), and products. ΔH = energy of products − energy of reactants (negative for exothermic). A **catalyst** lowers the activation energy.

## Bond energies (higher tier)
ΔH = energy to break bonds − energy released making bonds.
Example: N₂ + 3H₂ → 2NH₃ with N≡N 945, H–H 436, N–H 391 kJ/mol: broken = 945 + 3 × 436 = 2253; made = 6 × 391 = 2346; ΔH = 2253 − 2346 = **−93 kJ/mol** (exothermic).

**Profile example:** reactants 300, peak 450, products 380 kJ/mol: activation energy 150, ΔH = +80 (endothermic).

**Working scientifically:** use an insulated polystyrene cup with a lid and repeat the reaction to get a mean temperature change.`],
      quiz: "GCSE Chemistry: Chemical & Energy Changes quiz (Year 11)",
      qs: [
        S(1, "What is electrolysis?", "Breaking down an ionic compound using electricity when molten or dissolved", ["Making an electric current from a chemical reaction in a cell or battery", "Heating an ionic compound until it melts and its ions can move", "Reacting an acid with an alkali to make a salt"], "Electrolysis uses an electric current to decompose ionic compounds whose ions are free to move.", {}),
        S(1, "Which electrode do positive metal ions move towards during electrolysis?", "The cathode", ["The anode", "The salt bridge", "The electrolyte"], "The cathode is the negative electrode, so positive ions are attracted to it and are reduced.", { diag: true }),
        S(1, "What does an exothermic reaction do to the temperature of the surroundings?", "It raises it", ["It lowers it", "It leaves it unchanged", "It changes the state of the surroundings"], "Exothermic reactions release energy to the surroundings, so the temperature rises.", {}),
        S(2, "The apparatus shows electrolysis of molten lead bromide. Which electrode will have lead formed on it?", "X", ["Y", "Both X and Y", "Neither"], "Electrode X is connected to the negative terminal, so it is the cathode. Positive lead ions gain electrons there and form lead.", { img: ELEC }),
        S(2, "In the electrolysis of sodium chloride solution, what forms at each electrode?", "Hydrogen at the cathode and chlorine at the anode", ["Sodium at the cathode and chlorine at the anode", "Hydrogen at the anode and chlorine at the cathode", "Oxygen at both electrodes"], "Sodium is more reactive than hydrogen so hydrogen forms at the cathode. Chloride ions lose electrons to form chlorine at the anode. Sodium hydroxide is left in solution.", {}),
        N(2, "Use the reaction profile to find the activation energy in kJ/mol.", 200, 5, "Activation energy = energy at the peak − energy of the reactants = 600 − 400 = 200 kJ/mol.", () => PROFILE.peak - PROFILE.reactants, { img: PRO, diag: true }),
        N(2, "Use the reaction profile to find the overall energy change ΔH in kJ/mol (give a negative value for exothermic).", -150, 5, "ΔH = energy of products − energy of reactants = 250 − 400 = −150 kJ/mol. The products are lower, so the reaction is exothermic.", () => PROFILE.products - PROFILE.reactants, { img: PRO }),
        S(2, "What effect does a catalyst have on a reaction profile?", "It lowers the activation energy", ["It raises the products", "It lowers the energy of the reactants", "It changes the overall energy change"], "A catalyst provides an alternative route with lower activation energy. It does not change ΔH.", {}),
        S(2, "What is the only product of a hydrogen–oxygen fuel cell?", "Water", ["Carbon dioxide", "Hydrogen peroxide", "Water and carbon dioxide"], "2H₂ + O₂ → 2H₂O. This is one reason hydrogen fuel cells are considered clean.", {}),
        S(2, "Why do students use a polystyrene cup with a lid when measuring temperature changes?", "To reduce heat loss to the surroundings", ["To stop the reaction from starting", "To increase the temperature change", "To make the reaction release more energy"], "Insulation reduces energy lost, so the measured temperature change is closer to the true value.", { diag: true }),
        N(3, "Using bond energies, calculate ΔH for H₂ + Cl₂ → 2HCl. Bond energies (kJ/mol): H–H 436, Cl–Cl 243, H–Cl 432.", -185, 1, "Energy to break bonds = 436 + 243 = 679. Energy released making bonds = 2 × 432 = 864. ΔH = 679 − 864 = −185 kJ/mol.", () => 436 + 243 - 2 * 432),
        S(3, "Why is aluminium oxide dissolved in molten cryolite before electrolysis?", "It lowers the melting point, saving energy", ["Cryolite is a catalyst that makes aluminium", "It increases the temperature needed", "It makes the anodes last longer"], "Aluminium oxide melts at over 2000 °C. Dissolving it in cryolite allows electrolysis at about 950 °C, reducing energy costs.", {}),
        W("Describe and explain what happens at each electrode when molten lead bromide is electrolysed. Include half equations. [6 marks]", "Mark scheme (6): lead bromide must be molten so the ions are free to move (1); positive Pb²⁺ ions move to the cathode (negative electrode) (1); Pb²⁺ + 2e⁻ → Pb: reduction, lead forms (1); negative Br⁻ ions move to the anode (positive electrode) (1); 2Br⁻ → Br₂ + 2e⁻: oxidation, bromine (brown vapour) forms (1); electrons flow round the circuit from the anode to the cathode through the wires (1)."),
      ],
      cards: [
        ["Electrolysis", "Using electricity to break down a molten or dissolved ionic compound."],
        ["Cathode vs anode", "Cathode is negative (reduction); anode is positive (oxidation)."],
        ["Products: molten lead bromide", "Lead at the cathode, bromine at the anode."],
        ["Product at cathode from aqueous solution", "Hydrogen if the metal is more reactive than hydrogen."],
        ["Why use cryolite for aluminium?", "Lowers the melting point so less energy is needed."],
        ["Exothermic", "Releases energy; temperature rises (combustion, neutralisation)."],
        ["Endothermic", "Takes in energy; temperature falls (thermal decomposition)."],
        ["Activation energy", "Minimum energy needed for a reaction to start."],
        ["ΔH from a profile", "Energy of products − energy of reactants."],
        ["Effect of a catalyst on profile", "Lowers activation energy; ΔH unchanged."],
        ["Bond energy calculation", "ΔH = energy to break bonds − energy released making bonds."],
        ["Fuel cell overall equation", "2H₂ + O₂ → 2H₂O."],
      ],
    }),
  },
};
