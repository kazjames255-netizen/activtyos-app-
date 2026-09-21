// A-level Chemistry — Redox & Electrode Potentials (Year 12 redox; Year 13 electrochemical cells). Original content aligned to the DfE GCE AS/A-level chemistry subject content.
// Keys are recomputed by _chk_c5redox.ts — re-run _check_s6.ts after ANY edit here.
import type { CTopic } from "../types";
import { img, qb } from "./_h";

const q12 = qb("c5redox", 12);
const q13 = qb("c5redox", 13);
export const TOPIC: CTopic = {
  key: "c5redox",
  topic: "Chemistry — Redox & Electrode Potentials",
  subject: "Science",
  years: {
    12: {
      year: 12,
      subtopic: "A-level Year 12 (AS)",
      objectives: [
        "Oxidation number rules; oxidation and reduction in terms of electron transfer and change in oxidation number.",
        "Oxidising and reducing agents; disproportionation.",
        "Writing and combining half-equations in acidic solution.",
        "Redox titration calculations using reacting ratios.",
      ],
      note: {
        title: "Oxidation numbers, half-equations and redox titrations",
        body: `## Oxidation and reduction

**Oxidation** is loss of electrons (oxidation number increases); **reduction** is gain of electrons (oxidation number decreases): **OIL RIG**. A **reducing agent** donates electrons and is itself oxidised; an **oxidising agent** accepts electrons and is itself reduced.

## Oxidation number rules

| Rule | Example |
| --- | --- |
| Uncombined element = 0 | Cl₂, Fe |
| Sum for a neutral compound = 0; for an ion = its charge | SO₄²⁻: sum = −2 |
| Group 1 = +1, group 2 = +2, Al = +3 | |
| Hydrogen = +1 (−1 in metal hydrides) | |
| Oxygen = −2 (−1 in peroxides, e.g. H₂O₂) | |
| Fluorine = −1; other halogens −1 except with F or O | |

**Disproportionation** is when the same element is both oxidised and reduced, e.g. Cl₂ + 2OH⁻ → Cl⁻ + ClO⁻ + H₂O (Cl: 0 → −1 and +1).

## Half-equations in acid

Balance the atom being changed, then O using H₂O, then H using H⁺, then charge using e⁻. For example, hydrogen peroxide as an oxidising agent: H₂O₂ + 2H⁺ + 2e⁻ → 2H₂O. Combine two half-equations so the electrons cancel: H₂O₂ + 2Fe²⁺ + 2H⁺ → 2H₂O + 2Fe³⁺.

## Worked examples

**Oxidation number of P in H₃PO₄:** 3(+1) + x + 4(−2) = 0, so x = **+5**.

**Redox titration:** 25.0 cm³ of Fe²⁺ solution is oxidised by 18.0 cm³ of 0.0100 mol dm⁻³ K₂Cr₂O₇ (Cr₂O₇²⁻ + 6Fe²⁺ + 14H⁺ → 2Cr³⁺ + 6Fe³⁺ + 7H₂O).
- n(Cr₂O₇²⁻) = 0.0100 × 18.0 ÷ 1000 = 1.80 × 10⁻⁴ mol
- n(Fe²⁺) = 6 × 1.80 × 10⁻⁴ = 1.08 × 10⁻³ mol
- c(Fe²⁺) = 1.08 × 10⁻³ ÷ 0.0250 = **0.0432 mol dm⁻³**`,
      },
      quiz: {
        title: "Redox: Year 12 quiz",
        questions: [
          q12.single(1, "Which statement correctly describes oxidation?", "Loss of electrons, with an increase in oxidation number",
            ["Gain of electrons, with an increase in oxidation number", "Loss of electrons, with a decrease in oxidation number", "Gain of electrons, with a decrease in oxidation number"],
            "OIL RIG: Oxidation Is Loss of electrons. Losing negative charge makes the oxidation number more positive.", { pos: 0 }),
          q12.num(1, "What is the oxidation number of manganese in potassium manganate(VII), KMnO₄?", 7, 0,
            "K is +1 and each O is −2. The sum must be 0: (+1) + x + 4(−2) = 0, so x = +7."),
          q12.num(2, "What is the oxidation number of chlorine in the chlorate ion, ClO₃⁻?", 5, 0,
            "The ion has charge −1: x + 3(−2) = −1, so x = +5."),
          q12.single(2, "In the reaction Zn(s) + Cu²⁺(aq) → Zn²⁺(aq) + Cu(s), which species is the oxidising agent?", "Cu²⁺",
            ["Zn", "Zn²⁺", "Cu"],
            "Zn loses electrons (0 to +2) and is oxidised, so it is the reducing agent. Cu²⁺ gains electrons (+2 to 0) and is reduced, so it is the oxidising agent.", { diag: true }),
          q12.single(2, "Which is the correct half-equation for the reduction of manganate(VII) ions in acid to Mn²⁺?", "MnO₄⁻ + 8H⁺ + 5e⁻ → Mn²⁺ + 4H₂O",
            ["MnO₄⁻ + 4H⁺ + 3e⁻ → Mn²⁺ + 2H₂O", "MnO₄⁻ + 8H⁺ → Mn²⁺ + 4H₂O + 5e⁻", "MnO₄⁻ + 8H⁺ + 7e⁻ → Mn²⁺ + 4H₂O"],
            "Mn goes from +7 to +2, so 5 electrons are gained (on the left). The 4 O atoms form 4H₂O, which needs 8H⁺; charge check: −1 + 8 − 5 = +2, matching Mn²⁺."),
          q12.num(1, "Dichromate ions are reduced in acid: Cr₂O₇²⁻ + 14H⁺ + ne⁻ → 2Cr³⁺ + 7H₂O. What is the value of n?", 6, 0,
            "Each Cr changes from +6 to +3, gaining 3 electrons. Two Cr atoms gain 6 electrons. Charge check: −2 + 14 − 6 = +6 = 2 × (+3)."),
          q12.num(3, "25.0 cm³ of an acidified iron(II) solution is titrated with 0.0200 mol dm⁻³ potassium manganate(VII). 20.0 cm³ is needed (MnO₄⁻ + 5Fe²⁺ + 8H⁺ → Mn²⁺ + 5Fe³⁺ + 4H₂O). Calculate the concentration of the Fe²⁺ solution in mol dm⁻³ to 3 significant figures.", 0.0800, 0.001,
            "n(MnO₄⁻) = 0.0200 × 20.0 ÷ 1000 = 4.00 × 10⁻⁴ mol. n(Fe²⁺) = 5 × 4.00 × 10⁻⁴ = 2.00 × 10⁻³ mol. c = 2.00 × 10⁻³ ÷ 0.0250 = 0.0800 mol dm⁻³."),
          q12.single(3, "Which reaction is a disproportionation?", "Cl₂ + 2NaOH → NaCl + NaClO + H₂O",
            ["Zn + 2HCl → ZnCl₂ + H₂", "2Na + Cl₂ → 2NaCl", "Fe₂O₃ + 3CO → 2Fe + 3CO₂"],
            "In the first reaction chlorine goes from 0 to −1 (in NaCl) and 0 to +1 (in NaClO), so the same element is oxidised and reduced."),
          q12.num(2, "What is the oxidation number of oxygen in hydrogen peroxide, H₂O₂?", -1, 0,
            "Each H is +1, so the two O atoms must total −2, giving −1 each. Peroxides are an exception to the usual −2."),
          q12.single(2, "Which change is an oxidation?", "SO₃²⁻ → SO₄²⁻",
            ["Fe³⁺ → Fe²⁺", "Cl₂ → 2Cl⁻", "MnO₄⁻ → Mn²⁺"],
            "S changes from +4 to +6 (an increase), so it is oxidised. Fe (+3 → +2), Cl (0 → −1) and Mn (+7 → +2) are all reduced.", { diag: true, pos: 3 }),
          q12.num(3, "24.0 cm³ of 0.100 mol dm⁻³ sodium thiosulfate reacts exactly with iodine: I₂ + 2S₂O₃²⁻ → 2I⁻ + S₄O₆²⁻. How many moles of iodine were present? Give your answer in mol as a decimal.", 0.0012, 0.00001,
            "n(S₂O₃²⁻) = 0.100 × 24.0 ÷ 1000 = 2.40 × 10⁻³ mol. The ratio I₂ : S₂O₃²⁻ is 1 : 2, so n(I₂) = 1.20 × 10⁻³ mol."),
          q12.single(2, "Hydrogen peroxide decomposes: 2H₂O₂ → 2H₂O + O₂. Which statement is correct?", "It is a disproportionation: oxygen changes from −1 to −2 and to 0",
            ["Oxygen is only reduced, from −1 to −2", "Oxygen is only oxidised, from −1 to 0", "It is not a redox reaction at all, because no metal is involved and no oxidation numbers change"],
            "In H₂O₂ oxygen is −1. In H₂O it is −2 (reduced) and in O₂ it is 0 (oxidised). The same element does both, so this is disproportionation."),
          q12.single(1, "What is a reducing agent?", "A species that donates electrons and is itself oxidised",
            ["A species that accepts electrons and is itself reduced", "A species that donates electrons to another species and is itself reduced", "A species that gains oxygen and is reduced"],
            "A reducing agent reduces another species by giving it electrons, so it is oxidised."),
          q12.num(1, "What is the oxidation number of chromium in potassium dichromate(VI), K₂Cr₂O₇?", 6, 0,
            "2(+1) + 2x + 7(−2) = 0, so 2x = 12 and x = +6."),
        ],
      },
      flashcards: [
        { front: "OIL RIG", back: "Oxidation Is Loss (of electrons); Reduction Is Gain." },
        { front: "Oxidation number of an uncombined element", back: "0." },
        { front: "Oxidation number of O in peroxides and of H in metal hydrides", back: "O −1 in peroxides (H₂O₂); H −1 in metal hydrides." },
        { front: "Oxidising agent", back: "Accepts electrons and is itself reduced." },
        { front: "Reducing agent", back: "Donates electrons and is itself oxidised." },
        { front: "Disproportionation", back: "The same element is both oxidised and reduced in one reaction." },
        { front: "Order for balancing half-equations in acid", back: "Atoms changing, O with H₂O, H with H⁺, charge with e⁻." },
        { front: "Half-equation: MnO₄⁻ in acid", back: "MnO₄⁻ + 8H⁺ + 5e⁻ → Mn²⁺ + 4H₂O." },
        { front: "Half-equation: Cr₂O₇²⁻ in acid", back: "Cr₂O₇²⁻ + 14H⁺ + 6e⁻ → 2Cr³⁺ + 7H₂O." },
        { front: "Manganate(VII) : iron(II) mole ratio", back: "1 : 5 (MnO₄⁻ + 5Fe²⁺ + 8H⁺ → Mn²⁺ + 5Fe³⁺ + 4H₂O)." },
      ],
    },
    13: {
      year: 13,
      subtopic: "A-level Year 13 (A2)",
      objectives: [
        "Electrode potentials and the standard hydrogen electrode; measuring E° with a high-resistance voltmeter.",
        "Electrochemical cells: cell diagrams, direction of electron flow, salt bridge, EMF calculation.",
        "Using E° to predict feasibility, and the limits of these predictions (rate, non-standard conditions).",
        "Storage cells and fuel cells, including the hydrogen–oxygen fuel cell.",
        "Redox titrations using manganate(VII).",
      ],
      note: {
        title: "Electrode potentials, cell EMF and fuel cells",
        body: `## Electrode potentials

The **standard electrode potential E°** of a half-cell is its potential relative to the **standard hydrogen electrode (SHE)**, which has E° = 0.00 V by definition. The SHE uses H₂ gas at 100 kPa bubbling over platinum in 1.00 mol dm⁻³ H⁺ at 298 K. Standard conditions: 298 K, 100 kPa, 1.00 mol dm⁻³ ions.

The **more positive** E°, the greater the tendency to be **reduced** (the better the oxidising agent). Half-equations are written as reductions: Zn²⁺ + 2e⁻ ⇌ Zn, E° = −0.76 V.

## Cells

In a cell the half-cell with the **more negative** E° is the negative electrode, where oxidation occurs; electrons flow round the external circuit to the positive electrode, where reduction occurs. A **salt bridge** completes the circuit by letting ions move without the solutions mixing.

**E°cell = E°(positive electrode) − E°(negative electrode)** (or E°(more positive) − E°(more negative)). **Never multiply E° by the number of electrons.**

A positive E°cell means the reaction is **thermodynamically feasible**. But it may be very slow (high activation energy), and conditions may not be standard.

## Cells that store or produce energy

- **Fuel cell** (acidic H₂–O₂): negative electrode H₂ → 2H⁺ + 2e⁻; positive electrode O₂ + 4H⁺ + 4e⁻ → 2H₂O. The only product is water and reactants are supplied continuously.
- **Rechargeable cell**: charging applies an external voltage that reverses the cell reaction.

## Worked examples

**Ni/Fe cell:** E°(Ni²⁺/Ni) = −0.25 V and E°(Fe²⁺/Fe) = −0.44 V. Fe is more negative (oxidised): E°cell = −0.25 − (−0.44) = **+0.19 V**.

**Feasibility:** Will Br₂ oxidise Fe²⁺? E°(Br₂/Br⁻) = +1.07 V and E°(Fe³⁺/Fe²⁺) = +0.77 V. E°cell = 1.07 − 0.77 = **+0.30 V**, so yes.`,
      },
      quiz: {
        title: "Redox: Year 13 quiz",
        questions: [
          q13.single(1, "Which conditions define the standard hydrogen electrode?", "H₂ gas at 100 kPa, 1.00 mol dm⁻³ H⁺(aq), platinum electrode, 298 K",
            ["H₂ gas at 100 kPa, 1.00 mol dm⁻³ OH⁻(aq), zinc electrode, 298 K", "O₂ gas at 100 kPa, 1.00 mol dm⁻³ H⁺(aq), platinum electrode, 298 K", "H₂ gas at 1000 kPa, 0.10 mol dm⁻³ H⁺(aq), platinum electrode, 273 K"],
            "The SHE uses hydrogen at 100 kPa over an inert platinum electrode in 1.00 mol dm⁻³ acid at 298 K. Its potential is defined as 0.00 V."),
          q13.num(2, "The cell shown is made from a zinc half-cell and a copper half-cell. E°(Zn²⁺/Zn) = −0.76 V and E°(Cu²⁺/Cu) = +0.34 V. Calculate E°cell in V.", 1.10, 0.01,
            "E°cell = E°(positive) − E°(negative) = +0.34 − (−0.76) = +1.10 V.",
            { diag: true, image: img("cell-zncu.png", "Diagram of an electrochemical cell. On the left a beaker with a zinc strip in zinc sulfate solution labelled Zn(s) | Zn²⁺(aq) 1.0 mol dm⁻³. On the right a beaker with a copper strip in copper(II) sulfate solution labelled Cu(s) | Cu²⁺(aq) 1.0 mol dm⁻³. A salt bridge of filter paper dips into both beakers. A high-resistance voltmeter is connected between the two metal strips by wires.") }),
          q13.single(2, "In the zinc–copper cell shown (Zn is more easily oxidised than Cu), which statement is correct?", "Electrons flow through the external wire from the zinc to the copper",
            ["Electrons flow through the salt bridge from the copper to the zinc", "Electrons flow through the external wire from the copper to the zinc", "Zinc is the positive electrode because it is oxidised"],
            "Oxidation (Zn → Zn²⁺ + 2e⁻) occurs at zinc, the negative electrode. Electrons leave through the wire and reduce Cu²⁺ at the copper, the positive electrode. Only ions move through the salt bridge.",
            { image: img("cell-zncu.png", "Diagram of an electrochemical cell. On the left a beaker with a zinc strip in zinc sulfate solution labelled Zn(s) | Zn²⁺(aq) 1.0 mol dm⁻³. On the right a beaker with a copper strip in copper(II) sulfate solution labelled Cu(s) | Cu²⁺(aq) 1.0 mol dm⁻³. A salt bridge of filter paper dips into both beakers. A high-resistance voltmeter is connected between the two metal strips by wires.") }),
          q13.single(1, "What is the purpose of the salt bridge in an electrochemical cell?", "It completes the circuit by allowing ions to move, without the two solutions mixing",
            ["It allows electrons to flow between the two half-cells through the solution, so that the circuit is completed", "It provides the metal ions for the reaction", "It increases the EMF of the cell"],
            "Electrons flow in the wire; ions flow in the salt bridge to balance the charge that builds up in each half-cell."),
          q13.num(2, "E°(Ag⁺/Ag) = +0.80 V and E°(Fe³⁺/Fe²⁺) = +0.77 V. Calculate E°cell in V for a cell made from these two half-cells.", 0.03, 0.005,
            "E°cell = E°(more positive) − E°(less positive) = +0.80 − (+0.77) = +0.03 V.", { diag: true }),
          q13.single(2, "E°(Fe³⁺/Fe²⁺) = +0.77 V and E°(I₂/I⁻) = +0.54 V. Is it feasible for Fe³⁺ to oxidise iodide ions to iodine under standard conditions?", "Yes, because E°cell = +0.23 V",
            ["No, because E°cell = −0.23 V", "Yes, because E°cell = +1.31 V", "No, because iodide is not a reducing agent"],
            "Fe³⁺ is reduced (the more positive half-cell) and I⁻ is oxidised. E°cell = 0.77 − 0.54 = +0.23 V, which is positive."),
          q13.single(2, "A reaction has a positive E°cell but no reaction is seen when the reagents are mixed. Which is the most likely explanation?", "The activation energy is very high, so the rate is extremely slow",
            ["E°cell only applies to reactions that are exothermic", "The reaction must have a negative ΔH", "E°cell values predict the rate of reaction, so a positive value means the reaction must be occurring quickly but invisibly"],
            "A positive E°cell shows that a reaction is thermodynamically feasible. It gives no information about rate, so a high activation energy can prevent it happening. Non-standard conditions can also change the outcome."),
          q13.num(3, "25.0 cm³ of acidified iron(II) solution requires 22.40 cm³ of 0.0200 mol dm⁻³ potassium manganate(VII) for complete reaction (MnO₄⁻ + 5Fe²⁺ + 8H⁺ → Mn²⁺ + 5Fe³⁺ + 4H₂O). Calculate the concentration of Fe²⁺ in mol dm⁻³ to 3 significant figures.", 0.0896, 0.001,
            "n(MnO₄⁻) = 0.0200 × 22.40 ÷ 1000 = 4.48 × 10⁻⁴ mol. n(Fe²⁺) = 5 × 4.48 × 10⁻⁴ = 2.24 × 10⁻³ mol. c = 2.24 × 10⁻³ ÷ 0.0250 = 0.0896 mol dm⁻³."),
          q13.single(1, "Using E° values: MnO₄⁻/Mn²⁺ +1.51 V, Cl₂/Cl⁻ +1.36 V, Fe³⁺/Fe²⁺ +0.77 V, Zn²⁺/Zn −0.76 V. Which is the strongest oxidising agent?", "MnO₄⁻", ["Cl₂", "Fe³⁺", "Zn²⁺"],
            "The most positive E° belongs to the species with the greatest tendency to gain electrons: MnO₄⁻ (+1.51 V)."),
          q13.single(2, "In an acidic hydrogen–oxygen fuel cell, which half-equation occurs at the negative electrode?", "H₂ → 2H⁺ + 2e⁻",
            ["O₂ + 4H⁺ + 4e⁻ → 2H₂O", "2H₂O → O₂ + 4H⁺ + 4e⁻", "H₂ + 2e⁻ → 2H⁻"],
            "Hydrogen is the fuel and is oxidised, releasing electrons at the negative electrode. Oxygen is reduced at the positive electrode."),
          q13.num(3, "E°(Mg²⁺/Mg) = −2.37 V and E°(Ag⁺/Ag) = +0.80 V. The overall reaction is Mg + 2Ag⁺ → Mg²⁺ + 2Ag. Calculate E°cell in V.", 3.17, 0.01,
            "E° values are not multiplied by the stoichiometric coefficients. E°cell = +0.80 − (−2.37) = +3.17 V."),
          q13.multi(3, "Which statements about electrode potentials are correct?", ["The more positive the E° value, the greater the tendency of the species to be reduced", "E°cell = E°(positive electrode) − E°(negative electrode)"],
            ["Doubling a half-equation doubles its E° value", "E° depends on the size of the electrode"],
            "E° is an intensive property: it is unchanged when a half-equation is multiplied and does not depend on electrode size."),
          q13.num(1, "State the standard electrode potential of the standard hydrogen electrode in volts.", 0, 0,
            "The SHE is the reference for all other half-cells, and its potential is defined as 0.00 V."),
          q13.single(2, "What happens when a rechargeable cell is charged?", "An external voltage drives the cell reaction in reverse, storing energy as chemical energy",
            ["The cell reaction stops and the electrolyte is replaced", "The electrodes are consumed to release electrons", "The cell reaction runs in its normal forward direction, converting chemical energy into electrical energy which is then stored"],
            "Charging supplies electrical energy that reverses the discharge reaction. Discharging converts chemical energy into electrical energy."),
        ],
      },
      flashcards: [
        { front: "Standard hydrogen electrode conditions", back: "H₂ at 100 kPa, Pt electrode, 1.00 mol dm⁻³ H⁺, 298 K; E° = 0.00 V." },
        { front: "More positive E° means…", back: "A greater tendency to be reduced (stronger oxidising agent)." },
        { front: "E°cell formula", back: "E°(positive electrode) − E°(negative electrode)." },
        { front: "Do you multiply E° by the number of electrons?", back: "No. E° is not scaled by stoichiometry." },
        { front: "Function of the salt bridge", back: "Completes the circuit; ions move to balance charge without mixing the solutions." },
        { front: "Direction of electron flow in a cell", back: "From the negative electrode (oxidation) to the positive (reduction), through the external wire." },
        { front: "Limits of E° predictions", back: "They show feasibility only; the rate may be slow and conditions may be non-standard." },
        { front: "Acidic H₂–O₂ fuel cell half-equations", back: "Negative: H₂ → 2H⁺ + 2e⁻. Positive: O₂ + 4H⁺ + 4e⁻ → 2H₂O." },
        { front: "Why use a high-resistance voltmeter?", back: "So almost no current flows and the reading is the EMF of the cell." },
        { front: "MnO₄⁻ : Fe²⁺ titration ratio", back: "1 : 5; manganate(VII) is self-indicating (pale pink at the end point)." },
      ],
    },
  },
};
