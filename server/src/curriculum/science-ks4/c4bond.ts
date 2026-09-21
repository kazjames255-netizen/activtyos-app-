// GCSE Chemistry — Bonding, Structure & Properties (Year 10: ionic and simple covalent; Year 11: giant structures, metals, nanoscience).
import type { CTopic } from "../types";
import { N, S, M, T, W, yr } from "./_h";

const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);
/** subscripts for ions of charge a and b (positive a, negative b) */
const ratio = (a: number, b: number) => { const l = (a * b) / gcd(a, b); return [l / a, l / b]; };
const state = (t: number, mp: number, bp: number) => (t < mp ? "Solid" : t < bp ? "Liquid" : "Gas");

const ALLOY = ["c4bond-alloy.png", "Two diagrams of layers of circles representing metal atoms. Structure 1 has rows of identical circles in neat layers. Structure 2 has rows of circles of two different sizes, with some larger circles among the smaller ones, so the rows are uneven."] as [string, string];

export const TOPIC: CTopic = {
  key: "c4bond", topic: "Chemistry — Bonding, Structure & Properties", subject: "Science",
  years: {
    10: yr("c4bond", 10, {
      obj: [
        "Describe the three states of matter, changes of state, and state symbols.",
        "Describe ionic bonding: electron transfer, ion charges from the periodic table, formulae of ionic compounds, dot-and-cross diagrams.",
        "Describe covalent bonding in simple molecules using dot-and-cross and displayed formulae.",
        "Explain the properties of ionic compounds and simple molecular substances in terms of structure and bonding.",
        "Use the limitations of particle models (dot-and-cross, ball-and-stick).",
      ],
      note: ["GCSE Chemistry: ionic and covalent bonding", `## Ionic bonding
Metal atoms **transfer** electrons to non-metal atoms, forming positive and negative **ions**. The strong electrostatic attraction between oppositely charged ions in a **giant lattice** gives:
- high melting and boiling points;
- no conduction when solid, but conduction when **molten or dissolved** (ions free to move).

Ion charges: Group 1 = 1+, Group 2 = 2+, Group 6 = 2−, Group 7 = 1−. The formula balances the charges: K⁺ and S²⁻ need two K⁺ per S²⁻, so **K₂S**.

## Covalent bonding
Non-metal atoms **share** pairs of electrons. **Simple molecules** (H₂O, CO₂, CH₄, Cl₂) have strong covalent bonds inside the molecule but **weak intermolecular forces** between molecules. So they have low melting and boiling points (only the weak forces are overcome, not the covalent bonds), and they do not conduct electricity.

| Type | Melting point | Conducts? |
| --- | --- | --- |
| Ionic | high | when molten or dissolved |
| Simple molecular | low | never |

## States of matter
Solid → liquid at the melting point; liquid → gas at the boiling point. Compare room temperature (20 °C) with the two points. State symbols: (s), (l), (g), (aq) = dissolved in water.

## Worked example
A substance melts at 1085 °C and boils at 2562 °C. At 20 °C, 20 < 1085, so it is a **solid**.

**Limitations of models:** dot-and-cross diagrams do not show the 3D shape, and ball-and-stick models suggest gaps and rods between atoms that do not exist.`],
      quiz: "GCSE Chemistry: Bonding quiz (Year 10)",
      qs: [
        S(1, "Which type of bonding involves the transfer of electrons?", "Ionic", ["Covalent", "Metallic", "Intermolecular"], "In ionic bonding a metal atom transfers electrons to a non-metal atom, forming ions.", {}),
        S(1, "What is the charge on the ion formed by a Group 2 element?", "2+", ["2−", "1+", "1−"], "Group 2 atoms have 2 outer electrons, which they lose to form 2+ ions.", {}),
        S(1, "Which state symbol shows that a substance is dissolved in water?", "(aq)", ["(s)", "(l)", "(g)"], "(aq) means aqueous, a solution in water. (s), (l) and (g) are solid, liquid and gas.", {}),
        S(2, "Mercury melts at −39 °C and boils at 357 °C. What is its state at 20 °C?", "Liquid", ["Solid", "Gas", "Solid and liquid mixed"], "20 °C is above the melting point (−39 °C) but below the boiling point (357 °C), so it is a liquid.", { chk: () => state(20, -39, 357) }),
        S(2, "What is the formula of magnesium chloride (Mg²⁺ and Cl⁻ ions)?", "MgCl₂", ["MgCl", "Mg₂Cl", "Mg₂Cl₂"], "One Mg²⁺ needs two Cl⁻ ions to balance the charge, giving MgCl₂.", { chk: () => { const [m, c] = ratio(2, 1); return `Mg${m > 1 ? m : ""}Cl${c > 1 ? "₂" : ""}`; } }),
        S(2, "What is the formula of aluminium oxide (Al³⁺ and O²⁻ ions)?", "Al₂O₃", ["AlO", "Al₃O₂", "Al₂O₂"], "Balance 3+ and 2−: the lowest common multiple is 6, so 2 Al³⁺ (6+) and 3 O²⁻ (6−): Al₂O₃.", { diag: true, chk: () => { const [a, o] = ratio(3, 2); return `Al${a === 2 ? "₂" : a}O${o === 3 ? "₃" : o}`; } }),
        S(2, "Why can molten sodium chloride conduct electricity but solid sodium chloride cannot?", "In the molten state the ions are free to move and carry charge", ["Molten sodium chloride contains free electrons released from the sodium", "The covalent bonds break when it melts", "Solid sodium chloride has no charged particles"], "Solid ionic compounds have ions locked in the lattice. When molten, the ions can move and carry the current.", {}),
        S(2, "Why do simple molecular substances have low melting and boiling points?", "Only the weak forces between molecules need to be overcome", ["The covalent bonds inside the molecules are weak", "The molecules have no electrons", "The atoms are held in a giant lattice"], "Covalent bonds within molecules are strong and do not break when melting. Weak intermolecular forces between molecules are overcome, needing little energy.", { diag: true }),
        M(2, "Which are properties of ionic compounds? Choose all that apply.", ["High melting points because of strong forces between ions", "Conduct electricity when dissolved in water"], ["Conduct electricity as solids", "Low melting points", "Exist as small separate molecules"], "A giant lattice of oppositely charged ions needs a lot of energy to break up. Ions can move in solution, but not in the solid.", {}),
        N(3, "In a molecule of nitrogen, N₂, the two atoms are joined by a triple covalent bond. How many electrons are shared between the atoms?", 6, 0, "Each covalent bond is a shared pair (2 electrons). A triple bond has 3 pairs, so 3 × 2 = 6 electrons.", () => 3 * 2),
        S(3, "What is the formula of calcium nitride, made from Ca²⁺ and N³⁻ ions?", "Ca₃N₂", ["Ca₂N₃", "CaN", "Ca₃N₃"], "Lowest common multiple of 2 and 3 is 6: 3 Ca²⁺ (6+) and 2 N³⁻ (6−) give Ca₃N₂.", { chk: () => { const [c, n] = ratio(2, 3); return `Ca${c === 3 ? "₃" : c}N${n === 2 ? "₂" : n}`; } }),
        S(3, "Substance X melts at 800 °C. It does not conduct electricity as a solid, but conducts when molten and when dissolved. Which structure does it have?", "Giant ionic lattice", ["Simple molecular (covalent)", "Giant covalent", "Metallic"], "High melting point and conduction only when free ions can move (molten or dissolved) means an ionic lattice. Metals conduct as solids and simple molecules never conduct.", {}),
        W("Compare the structure, melting point and electrical conductivity of sodium chloride and carbon dioxide. [6 marks]", "Mark scheme (6): sodium chloride is a giant ionic lattice of Na⁺ and Cl⁻ ions (1); strong electrostatic forces act between the ions in all directions (1), so it has a high melting point (1); it conducts when molten or dissolved because ions are free to move, not when solid (1); carbon dioxide is a simple molecular substance with strong covalent bonds inside molecules but weak forces between molecules (1); so it has a very low melting/boiling point and does not conduct as there are no free charged particles (1)."),
      ],
      cards: [
        ["Ionic bonding", "Transfer of electrons from metal to non-metal, giving ions held by electrostatic attraction."],
        ["Covalent bonding", "Sharing of pairs of electrons between non-metal atoms."],
        ["Ion charges by group", "Group 1: 1+, Group 2: 2+, Group 6: 2−, Group 7: 1−."],
        ["Why do ionic compounds have high melting points?", "Strong attraction between ions in a giant lattice."],
        ["When do ionic compounds conduct?", "When molten or dissolved (ions free to move)."],
        ["Why do simple molecules have low boiling points?", "Weak intermolecular forces are overcome, not the covalent bonds."],
        ["Do simple molecular substances conduct?", "No: no free ions or electrons."],
        ["State symbols", "(s) solid, (l) liquid, (g) gas, (aq) dissolved in water."],
        ["Formula from ion charges", "Balance the total positive and negative charges (K⁺ and S²⁻ give K₂S)."],
        ["Limitation of dot-and-cross diagram", "Does not show 3D shape or the relative size of atoms."],
        ["Bonds in a double bond", "Two shared pairs (4 electrons)."],
        ["Room temperature test for state", "Compare 20 °C with melting and boiling points."],
      ],
    }),
    11: yr("c4bond", 11, {
      obj: [
        "Describe giant covalent structures: diamond, graphite, graphene and silicon dioxide, and their properties.",
        "Describe fullerenes and carbon nanotubes and their uses.",
        "Describe metallic bonding and explain the properties of metals and alloys.",
        "Explain the size and properties of nanoparticles; calculate surface area to volume ratio.",
        "Discuss the uses, benefits and risks of nanoparticles.",
      ],
      note: ["GCSE Chemistry: giant structures, metals and nanoscience", `## Giant covalent structures
- **Diamond**: each carbon bonds to **4** others in a rigid lattice: very hard, very high melting point, does not conduct.
- **Graphite**: each carbon bonds to **3** others in layers; one electron per atom is **delocalised**, so graphite **conducts**; weak forces between layers let them slide (soft, slippery).
- **Graphene**: a single layer of graphite: strong, conducts.
- **Fullerenes / nanotubes**: hollow carbon cages and tubes; strong, conduct; used in medicine delivery, catalysts and reinforcing materials.

## Metals and alloys
Metallic bonding is a lattice of positive ions in a "sea" of **delocalised electrons**: strong attraction (high melting point), electrons carry charge and heat (good conductors), layers slide (malleable). An **alloy** contains atoms of different sizes, which **distort the layers** so they cannot slide easily: alloys are harder (e.g. steel).

## Nanoparticles
Nanoparticles are 1–100 nm across. They have a very **large surface area to volume ratio**, so smaller amounts work as catalysts, in sun creams and in medicine. Their long-term effects on health are not fully known.

## Worked example
Cube with side 50 nm: SA = 6 × 50² = 15 000 nm²; V = 50³ = 125 000 nm³; SA : V = **0.12**. A cube of side 25 nm has 0.24, twice as big.

**Working scientifically:** compare risks and benefits using evidence, and recognise that new technologies need long-term studies.`],
      quiz: "GCSE Chemistry: Bonding quiz (Year 11)",
      qs: [
        S(1, "How many covalent bonds does each carbon atom form in diamond?", "4", ["1", "2", "3"], "Every carbon in diamond is bonded to four others in a tetrahedral giant structure.", {}),
        S(1, "Which particles allow a metal to conduct electricity?", "Delocalised electrons", ["Positive metal ions in the lattice", "Negative ions", "Neutrons"], "The outer electrons of metal atoms are free to move through the lattice, carrying charge.", {}),
        S(1, "Why is graphite soft and slippery?", "Its layers are held together by weak forces so can slide over each other", ["It has weak covalent bonds inside the layers that break easily when rubbed", "It has no bonds between its carbon atoms, so they move about freely", "It contains free ions that let the carbon atoms move past each other"], "Bonds inside each layer are strong, but the forces between layers are weak, so the layers slide.", {}),
        S(2, "Why does diamond have a very high melting point?", "Many strong covalent bonds must be broken throughout the giant structure", ["The weak forces between its molecules are unusually strong in diamond", "It contains delocalised electrons that hold the carbon atoms tightly together", "Its positive and negative ions are strongly attracted to each other in a lattice"], "Diamond is a giant covalent lattice: melting needs a huge amount of energy to break all the strong covalent bonds.", {}),
        S(2, "The diagram shows pure metal and an alloy. Which is the alloy and why is it harder?", "Structure 2, because different-sized atoms stop the layers sliding", ["Structure 1, because identical atoms lock the layers together", "Structure 2, because alloys have delocalised electrons that pure metals lack", "Structure 1, because pure metals are always harder than alloys"], "In an alloy, atoms of different sizes distort the regular layers, so the layers cannot slide easily. Pure metals (Structure 1) are soft.", { img: ALLOY, diag: true }),
        S(2, "Why can pure metals be bent and shaped?", "The layers of atoms can slide over each other", ["The delocalised electrons break the bonds", "The positive ions are removed", "Weak covalent bonds hold the metal atoms together"], "In a pure metal, layers of identical atoms can slide while the delocalised electrons keep the metallic bonding intact.", {}),
        M(2, "Which statements about graphene are correct? Choose all that apply.", ["It is a single layer of carbon atoms", "It conducts electricity"], ["Each carbon atom forms four covalent bonds", "It is an electrical insulator"], "Graphene is one layer of graphite: each carbon bonds to three others, leaving one delocalised electron, so it conducts.", {}),
        S(2, "A particle has a diameter of 50 nm. How would it be classified?", "A nanoparticle", ["A fine particle (PM2.5)", "An atom", "A molecule of a giant covalent structure"], "Nanoparticles are between 1 nm and 100 nm across, so 50 nm is a nanoparticle.", { chk: () => (50 >= 1 && 50 <= 100 ? "A nanoparticle" : "no") }),
        T(2, "Name the form of carbon in which atoms are arranged in layers with delocalised electrons.", "graphite", ["Graphite", "graphite."], "Graphite has layers of carbon atoms, each bonded to three others, leaving one delocalised electron per atom.", {}),
        S(2, "Why is caution needed when nanoparticles are used in cosmetics such as sun cream?", "Their effects on human health and the environment are not fully known", ["They are too large to be absorbed by the skin, so the cream does not work", "Nanoparticles are always poisonous, so they should never touch the skin", "They cannot be used in small amounts, so the cream becomes too expensive"], "Very small particles may pass into cells or the environment, and long-term effects are uncertain, so they need testing.", { diag: true }),
        N(3, "A cube-shaped nanoparticle has a side of 10 nm; a larger cube has a side of 100 nm. How many times larger is the surface area to volume ratio of the smaller cube?", 10, 0.01, "SA:V of a cube = 6 ÷ side. 6 ÷ 10 = 0.6 and 6 ÷ 100 = 0.06. 0.6 ÷ 0.06 = 10 times larger.", () => (6 * 10 * 10 / 10 ** 3) / (6 * 100 * 100 / 100 ** 3)),
        S(3, "Why does graphite conduct electricity but diamond does not?", "In graphite each carbon uses only three electrons in bonds, leaving one delocalised electron; in diamond all four are used", ["Graphite contains free ions between its layers, but diamond has no ions at all", "Diamond has weaker covalent bonds than graphite, so its electrons cannot move", "Graphite is made of metal atoms with delocalised electrons, while diamond is a non-metal"], "Diamond's four outer electrons per atom are all in covalent bonds. Graphite's spare electron per atom is free to move between layers.", {}),
        W("Explain, in terms of structure and bonding, why metals conduct electricity, can be bent, and have high melting points. [6 marks]", "Mark scheme (6): metals have a lattice of positive ions in a sea of delocalised electrons (1); the delocalised electrons are free to move and carry charge, so metals conduct (1); the layers of ions can slide over one another (1) without breaking the metallic bonding, so metals are malleable (1); there is strong electrostatic attraction between the positive ions and delocalised electrons (1); a lot of energy is needed to overcome this, giving a high melting point (1)."),
      ],
      cards: [
        ["Bonds per carbon in diamond", "4 covalent bonds; giant rigid lattice."],
        ["Bonds per carbon in graphite", "3 covalent bonds; layers; 1 delocalised electron each."],
        ["Why does graphite conduct?", "Delocalised electrons between layers can move."],
        ["Graphene", "A single layer of graphite; strong and conducts."],
        ["Fullerenes and nanotubes", "Hollow carbon cages/tubes; strong, conduct; used in drug delivery and materials."],
        ["Metallic bonding", "Positive ions in a sea of delocalised electrons."],
        ["Why are alloys harder than pure metals?", "Different-sized atoms distort the layers so they cannot slide."],
        ["Nanoparticle size", "1–100 nm across."],
        ["Surface area to volume ratio of a cube", "6 ÷ side length (bigger for smaller cubes)."],
        ["Uses of nanoparticles", "Catalysts, sun cream, medicine, fabrics, deodorants."],
        ["Risk of nanoparticles", "Long-term health and environmental effects not fully known."],
        ["Silicon dioxide structure", "Giant covalent lattice: hard, high melting point, does not conduct."],
      ],
    }),
  },
};
