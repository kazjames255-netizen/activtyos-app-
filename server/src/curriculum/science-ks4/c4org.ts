// GCSE Chemistry — Organic Chemistry (Year 11).
import type { CTopic } from "../types";
import { N, S, M, W, yr } from "./_h";

const IMG = ["c4org-column.png", "A tall fractionating column for crude oil. Heated crude oil vapour enters near the bottom. Five outlet pipes come off the column at different heights, labelled A at the top, then B, C, D and E at the bottom."] as [string, string];
const alkaneH = (n: number) => 2 * n + 2;

export const TOPIC: CTopic = {
  key: "c4org", topic: "Chemistry — Organic Chemistry", subject: "Science",
  years: {
    11: yr("c4org", 11, {
      obj: [
        "Describe crude oil as a mixture of hydrocarbons and its separation by fractional distillation.",
        "Describe alkanes (CₙH₂ₙ₊₂): properties and trends with chain length, combustion, and use as fuels.",
        "Describe cracking and the production of alkenes; test for alkenes with bromine water.",
        "Describe alkenes (CₙH₂ₙ) and addition polymerisation.",
        "Triple stretch: alcohols, carboxylic acids, condensation polymers and natural polymers.",
      ],
      note: ["GCSE Chemistry: hydrocarbons, cracking and polymers", `## Crude oil and alkanes
**Crude oil** is a mixture of **hydrocarbons** (compounds of carbon and hydrogen only). **Fractional distillation** separates it: vapour rises up a hot-at-the-bottom, cool-at-the-top column and each **fraction** condenses at its own boiling range.

**Alkanes** are saturated with general formula **CₙH₂ₙ₊₂**: methane CH₄, ethane C₂H₆, propane C₃H₈, butane C₄H₁₀.
As chain length increases: boiling point **rises**, viscosity **rises**, flammability **falls** (stronger intermolecular forces between longer molecules).

Complete combustion gives carbon dioxide and water; incomplete combustion can make carbon monoxide (toxic) and carbon (soot).

## Cracking and alkenes
Long alkanes are heated with a catalyst (or steam) and **cracked** into shorter, more useful alkanes and **alkenes** (CₙH₂ₙ, with a C=C double bond, **unsaturated**). Example: C₁₂H₂₆ → C₈H₁₈ + C₄H₈.
Test for alkenes: **bromine water turns from orange to colourless**.

## Polymers
In **addition polymerisation** many alkene monomers open their double bonds and join in a long chain: ethene → poly(ethene).

| Number of carbons | Alkane formula |
| --- | --- |
| 6 | C₆H₁₄ hexane |
| 8 | C₈H₁₈ octane |

## Worked example
Burning methane: CH₄ + 2O₂ → CO₂ + 2H₂O. Alkane with 8 carbons: 2 × 8 + 2 = **18** hydrogens.

**Working scientifically:** to compare fuels, control the mass of fuel burnt and the volume of water heated.`],
      quiz: "GCSE Chemistry: Organic Chemistry quiz",
      qs: [
        S(1, "What is a hydrocarbon?", "A compound made of hydrogen and carbon only", ["A mixture of hydrogen and oxygen", "A compound of carbon and oxygen only", "Any compound that is found naturally in crude oil"], "Hydrocarbons contain only carbon and hydrogen atoms bonded together.", {}),
        N(1, "How many hydrogen atoms are in a molecule of the alkane with 5 carbon atoms?", 12, 0, "Alkanes have the formula CₙH₂ₙ₊₂. For n = 5: 2 × 5 + 2 = 12, so C₅H₁₂.", () => alkaneH(5)),
        S(1, "What is the result of testing an alkene with bromine water?", "It turns from orange to colourless", ["It turns from colourless to orange", "It turns from orange to blue-black", "Nothing happens"], "Alkenes have a C=C double bond that reacts with bromine, decolourising the orange bromine water. Alkanes do not react.", {}),
        S(2, "In the fractionating column, which fraction has the highest boiling point?", "E", ["A", "C", "B"], "The longest molecules have the highest boiling points and condense lowest in the column, where it is hottest, so fraction E.", { img: IMG }),
        S(2, "Which fraction has the shortest molecules and is the most flammable?", "A", ["C", "D", "E"], "The shortest molecules have the lowest boiling points and travel to the top of the column, so fraction A. Short molecules ignite easily.", { img: IMG }),
        S(2, "Why does the boiling point of alkanes increase as the chain gets longer?", "Stronger forces of attraction between the larger molecules need more energy to overcome", ["The covalent bonds between the carbon atoms get stronger and need more energy to break", "Longer molecules contain ionic bonds as well as covalent bonds", "There are fewer hydrogen atoms for each carbon atom"], "Longer molecules have stronger intermolecular forces. The covalent bonds inside molecules are not broken when boiling.", {}),
        S(2, "Why is carbon monoxide from incomplete combustion dangerous?", "It is toxic because it stops the blood carrying oxygen", ["It is acidic and dissolves in rainwater to form acid rain", "It forms black soot that blocks the airways", "It is a greenhouse gas that melts the polar ice"], "Carbon monoxide binds to haemoglobin in red blood cells, reducing the oxygen carried around the body. It is colourless and odourless.", {}),
        S(2, "In this cracking reaction, which product is an alkene? C₁₀H₂₂ → C₈H₁₈ + C₂H₄", "C₂H₄", ["C₈H₁₈", "C₁₀H₂₂", "Neither, both are alkanes"], "Alkenes have the formula CₙH₂ₙ. C₂H₄ fits (n = 2), while C₈H₁₈ fits the alkane formula CₙH₂ₙ₊₂.", { diag: true, chk: () => { const p = [[8, 18], [2, 4]]; return p.filter(([c, h]) => h === 2 * c).map(([c, h]) => `C${c === 2 ? "₂" : c}H${h === 4 ? "₄" : h}`)[0]; } }),
        M(2, "Which statements about alkenes are correct? Choose all that apply.", ["They contain a carbon–carbon double bond", "They are unsaturated hydrocarbons"], ["Their general formula is CₙH₂ₙ₊₂", "They are saturated"], "Alkenes (CₙH₂ₙ) have a C=C double bond and so are unsaturated. CₙH₂ₙ₊₂ is the alkane formula.", {}),
        S(2, "Which is the monomer used to make poly(propene)?", "Propene", ["Propane", "Ethene", "Poly(ethene)"], "Addition polymers are made from alkene monomers: propene molecules join to make poly(propene).", { diag: true }),
        N(3, "C₃H₈ + 5O₂ → 3CO₂ + 4H₂O. What mass of carbon dioxide forms when 4.4 g of propane burns completely, in grams? (Ar: C = 12, H = 1, O = 16)", 13.2, 0.1, "Mr propane = 3 × 12 + 8 = 44, so moles = 4.4 ÷ 44 = 0.10 mol. The ratio is 1 : 3, so 0.30 mol CO₂. Mr(CO₂) = 44, so mass = 0.30 × 44 = 13.2 g.", () => (4.4 / (3 * 12 + 8)) * 3 * (12 + 32)),
        S(3, "(Triple) Ethanol is made by fermentation. Which conditions are needed?", "Yeast, a warm temperature of about 30 °C, and no oxygen", ["A high temperature of about 300 °C with a catalyst", "Yeast, a good supply of oxygen from the air, and about 30 °C", "Sunlight, green plants and a temperature of about 30 °C"], "Yeast respire anaerobically at about 30–40 °C: glucose → ethanol + carbon dioxide. Too hot denatures the enzymes.", {}),
        W("Explain how crude oil is separated into fractions in industry and why the fractions are used for different purposes. [6 marks]", "Mark scheme (6): crude oil is heated so it evaporates, and the vapour enters the fractionating column (1); the column is hot at the bottom and cool at the top (1); vapours rise and condense when they reach a temperature below their boiling point (1); shorter molecules have lower boiling points so are collected near the top (1); longer molecules have higher boiling points so are collected near the bottom (1); uses depend on properties: short chains are flammable and runny (fuels such as petrol), long chains are viscous and less flammable (bitumen for roads) (1)."),
      ],
      cards: [
        ["Hydrocarbon", "A compound of hydrogen and carbon only."],
        ["Alkane general formula", "CₙH₂ₙ₊₂ (saturated)."],
        ["Alkene general formula", "CₙH₂ₙ (unsaturated, C=C)."],
        ["First four alkanes", "Methane CH₄, ethane C₂H₆, propane C₃H₈, butane C₄H₁₀."],
        ["Fractional distillation", "Separates crude oil into fractions by boiling point."],
        ["Trend as chain length increases", "Boiling point and viscosity rise; flammability falls."],
        ["Complete combustion products", "Carbon dioxide and water."],
        ["Why is carbon monoxide harmful?", "It stops haemoglobin carrying oxygen."],
        ["What is cracking?", "Breaking long alkanes into shorter alkanes and alkenes using heat and a catalyst."],
        ["Test for alkenes", "Bromine water: orange → colourless."],
        ["Addition polymerisation", "Alkene monomers join by opening the double bonds to form a polymer."],
        ["Fermentation equation (triple)", "glucose → ethanol + carbon dioxide (yeast, no oxygen)."],
      ],
    }),
  },
};
