// A-level Chemistry — Periodicity & Group Chemistry (Year 12 groups 2 & 7; Year 13 period 3, transition metals, reactions of ions). Original content aligned to the DfE GCE AS/A-level chemistry subject content.
// Numerical keys are recomputed by _chk_c5gp.ts — re-run _check_s6.ts after ANY edit here. Descriptive facts were re-read against standard data sources.
import type { CTopic } from "../types";
import { img, qb } from "./_h";

const q12 = qb("c5gp", 12);
const q13 = qb("c5gp", 13);
export const TOPIC: CTopic = {
  key: "c5gp",
  topic: "Chemistry — Periodicity & Group Chemistry",
  subject: "Science",
  years: {
    12: {
      year: 12,
      subtopic: "A-level Year 12 (AS)",
      objectives: [
        "Group 2: trends in atomic radius, ionisation energy and reactivity; reactions with water; solubility of hydroxides and sulfates; uses of Group 2 compounds.",
        "Group 7: trends in physical properties and oxidising ability; displacement reactions; reactions of halides with concentrated sulfuric acid.",
        "Reactions of chlorine with water and with cold dilute sodium hydroxide (disproportionation); tests for halide and sulfate ions.",
      ],
      note: {
        title: "Group 2 and Group 7: trends, reactions and tests",
        body: `## Group 2 (alkaline earth metals)

Going **down** the group, atomic radius increases, first and second ionisation energies fall (more shielding, outer electrons further away), so **reactivity increases**: each atom loses its two outer electrons more easily to form M²⁺.

- Reaction with water: M + 2H₂O → M(OH)₂ + H₂ (Mg reacts very slowly with cold water but burns in steam to give MgO).
- **Hydroxides** become **more soluble** down the group; **sulfates** become **less soluble** (BaSO₄ is insoluble).
- Uses: Mg(OH)₂ as an antacid, Ca(OH)₂ (lime) to neutralise acidic soil, BaSO₄ for the "barium meal".

## Group 7 (halogens)

| Halogen | State at room temperature | Colour |
| --- | --- | --- |
| Cl₂ | gas | pale green |
| Br₂ | liquid | red-brown |
| I₂ | solid | grey-black (purple vapour) |

Down the group boiling point rises (stronger London forces) and **oxidising power falls**, because the atom is larger and more shielded, so it attracts an incoming electron less. A more reactive halogen displaces a less reactive halide: Br₂ + 2I⁻ → 2Br⁻ + I₂.

Chlorine with cold dilute NaOH is a **disproportionation**: Cl₂ + 2NaOH → NaCl + NaClO + H₂O (Cl: 0 → −1 and +1).

**Halide tests:** add dilute HNO₃, then AgNO₃(aq): Cl⁻ white ppt (dissolves in dilute NH₃), Br⁻ cream (dissolves in concentrated NH₃), I⁻ yellow (insoluble). Sulfate: dilute HCl then BaCl₂(aq) gives a white precipitate.

## Worked example

Neutralising 0.290 g of Mg(OH)₂ (Mr 58.3): n = 0.290 ÷ 58.3 = 4.97 × 10⁻³ mol. Mg(OH)₂ + 2HCl → MgCl₂ + 2H₂O needs 2 × 4.97 × 10⁻³ = 9.95 × 10⁻³ mol HCl, which is **99.5 cm³ of 0.100 mol dm⁻³ acid**.`,
      },
      quiz: {
        title: "Periodicity & Group Chemistry: Year 12 quiz",
        questions: [
          q12.single(1, "Why does reactivity increase down Group 2?", "The outer electrons are further from the nucleus and more shielded, so they are lost more easily",
            ["The nuclear charge decreases down the group, so the outer electrons are held less tightly and are lost more easily", "The atoms have more outer-shell electrons to lose", "The first ionisation energy increases down the group"],
            "Reactivity is the ease of losing two electrons. Larger radius and more shielding mean lower ionisation energies."),
          q12.single(1, "Which Group 2 sulfate is the least soluble in water?", "Barium sulfate", ["Magnesium sulfate", "Calcium sulfate", "Strontium sulfate"],
            "Sulfate solubility decreases down Group 2, so BaSO₄, at the bottom, is least soluble. This is used in the test for sulfate ions."),
          q12.single(2, "What is the test for sulfate ions in solution?", "Add dilute hydrochloric acid followed by barium chloride solution: a white precipitate forms",
            ["Add silver nitrate solution: a white precipitate forms that dissolves in ammonia", "Add sodium hydroxide: a blue precipitate forms", "Add dilute acid: a gas is given off that turns limewater milky"],
            "The acid removes carbonate and sulfite ions that would also precipitate. Barium ions then give white BaSO₄ with sulfate."),
          q12.num(2, "0.400 g of calcium reacts completely with water (Ca + 2H₂O → Ca(OH)₂ + H₂). Calculate the volume of hydrogen produced in cm³ at room temperature and pressure (1 mol of gas = 24.0 dm³) to 3 significant figures. (Ar Ca = 40.1)", 239, 3,
            "n(Ca) = 0.400 ÷ 40.1 = 9.98 × 10⁻³ mol, so n(H₂) is the same (1 : 1). V = 9.98 × 10⁻³ × 24.0 dm³ = 0.239 dm³ = 239 cm³."),
          q12.single(1, "Which row correctly describes the appearance of the halogens at room temperature?", "Chlorine: pale green gas; bromine: red-brown liquid; iodine: grey-black solid",
            ["Chlorine: red-brown liquid; bromine: pale green gas; iodine: grey-black solid", "Chlorine: pale green gas; bromine: grey-black solid; iodine: red-brown liquid", "Chlorine: grey-black solid; bromine: red-brown liquid; iodine: pale green gas"],
            "Boiling points rise down the group as London forces strengthen, so Cl₂ is a gas, Br₂ a volatile liquid and I₂ a solid."),
          q12.single(2, "Chlorine water is added to potassium bromide solution. What is observed and why?", "The solution turns orange because chlorine displaces bromine",
            ["The solution stays colourless because bromine is more reactive than chlorine", "The solution turns purple because iodine is formed", "A white precipitate of silver chloride forms"],
            "Chlorine is a stronger oxidising agent than bromine: Cl₂ + 2Br⁻ → 2Cl⁻ + Br₂, and aqueous bromine is orange.", { diag: true }),
          q12.single(2, "What are the products when chlorine reacts with cold, dilute sodium hydroxide?", "Sodium chloride, sodium chlorate(I) and water",
            ["Sodium chloride and hydrogen only", "Sodium chlorate(V), sodium chloride and water", "Sodium chlorate(I) and oxygen"],
            "In the cold, Cl₂ + 2NaOH → NaCl + NaClO + H₂O. Chlorine is oxidised (0 → +1) and reduced (0 → −1): disproportionation. The mixture is bleach."),
          q12.single(2, "Acidified silver nitrate is added to a solution of an unknown halide. A white precipitate forms, which dissolves in dilute ammonia solution. Which halide ion is present?", "Chloride", ["Bromide", "Iodide", "Fluoride"],
            "AgCl is white and dissolves in dilute NH₃. AgBr is cream and needs concentrated NH₃; AgI is yellow and insoluble.", { diag: true }),
          q12.single(3, "Solid sodium iodide reacts with concentrated sulfuric acid, giving iodine and hydrogen sulfide among the products. What does this show?", "Iodide is a strong reducing agent: it reduces sulfur from +6 in H₂SO₄ to −2 in H₂S",
            ["Iodide is a weak reducing agent: it only reduces sulfur to SO₂", "Iodide acts as an oxidising agent towards sulfur", "Sulfuric acid acts only as an acid here: it protonates the iodide ions to give HI and no redox change has occurred at all"],
            "Iodine forms when I⁻ is oxidised. H₂S has sulfur at −2, so each S atom from H₂SO₄ (S = +6) has gained 8 electrons. Bromide only reduces it to SO₂, chloride not at all."),
          q12.single(2, "Why is chlorine added to drinking water?", "It reacts with water to form chlorate(I), which kills bacteria",
            ["It removes calcium ions that cause hardness", "It raises the pH by reacting to form alkali", "It makes the water taste of chlorine to warn of contamination"],
            "Cl₂ + H₂O ⇌ HCl + HClO. Chlorate(I) (hypochlorite) is a disinfectant."),
          q12.num(3, "25.0 cm³ of 0.100 mol dm⁻³ sodium sulfate solution is mixed with 10.0 cm³ of 0.150 mol dm⁻³ barium chloride solution. Calculate the mass of barium sulfate precipitated in g to 3 significant figures. (Ar: Ba 137.3, S 32.1, O 16.0)", 0.350, 0.004,
            "n(SO₄²⁻) = 2.50 × 10⁻³ mol; n(Ba²⁺) = 1.50 × 10⁻³ mol, so Ba²⁺ is limiting. Mr(BaSO₄) = 233.4, so mass = 1.50 × 10⁻³ × 233.4 = 0.350 g."),
          q12.short(1, "Name the Group 2 hydroxide commonly used in indigestion tablets as an antacid.", "magnesium hydroxide", ["Mg(OH)2", "Mg(OH)₂", "milk of magnesia", "Magnesium hydroxide"],
            "Magnesium hydroxide is only slightly soluble, so it neutralises stomach acid gently without making the stomach very alkaline."),
          q12.single(2, "A solid gives a cream precipitate with acidified silver nitrate. The precipitate is insoluble in dilute ammonia but dissolves in concentrated ammonia. Which sodium halide was it?", "Sodium bromide", ["Sodium chloride", "Sodium iodide", "Sodium fluoride"],
            "AgBr is cream and dissolves in concentrated but not dilute ammonia."),
          q12.single(3, "Which explains why the oxidising power of the halogens decreases down Group 7?", "Larger atoms with more shielding attract an extra electron less strongly",
            ["Larger atoms have a higher nuclear charge, which repels electrons", "The halogen molecules become more polar down the group", "The bond enthalpy increases down the group"],
            "Oxidising ability is the tendency to gain an electron. Down the group the incoming electron is further from the nucleus and more shielded."),
        ],
      },
      flashcards: [
        { front: "Trend in Group 2 reactivity and why", back: "Increases down the group: larger, more shielded atoms lose two electrons more easily." },
        { front: "Group 2 hydroxide and sulfate solubility trends", back: "Hydroxides more soluble down the group; sulfates less soluble." },
        { front: "Test for sulfate ions", back: "Dilute HCl then BaCl₂(aq): white precipitate of BaSO₄." },
        { front: "Uses: Mg(OH)₂, Ca(OH)₂, BaSO₄", back: "Antacid; neutralising acidic soil; barium meal (X-ray)." },
        { front: "Appearance of Cl₂, Br₂, I₂", back: "Pale green gas; red-brown liquid; grey-black solid." },
        { front: "Trend in halogen oxidising power", back: "Decreases down the group (F₂ > Cl₂ > Br₂ > I₂)." },
        { front: "Displacement colours: Br₂ and I₂ in water", back: "Bromine orange; iodine brown (purple in an organic solvent)." },
        { front: "Cl₂ + cold dilute NaOH", back: "NaCl + NaClO + H₂O; disproportionation (bleach)." },
        { front: "Silver nitrate test for halides", back: "Cl⁻ white (soluble in dilute NH₃); Br⁻ cream (conc. NH₃); I⁻ yellow (insoluble)." },
        { front: "Halides with concentrated H₂SO₄", back: "Cl⁻: HCl only. Br⁻: Br₂ and SO₂. I⁻: I₂ and H₂S (and S)." },
      ],
    },
    13: {
      year: 13,
      subtopic: "A-level Year 13 (A2)",
      objectives: [
        "Period 3: trends in melting point and the acid–base character of oxides and their reactions with water.",
        "Transition metals: electron configurations, variable oxidation states, coloured ions, catalytic activity.",
        "Complex ions: ligands, coordination number and shape; ligand substitution; colour and d–d transitions (ΔE = hν).",
        "Reactions of aqueous ions with sodium hydroxide and ammonia; amphoteric hydroxides.",
      ],
      note: {
        title: "Period 3 oxides, transition metals and complex ions",
        body: `## Period 3

Melting points rise from Na to Si (metallic then giant covalent), then fall for molecular P₄, S₈, Cl₂, Ar. Silicon is very high because it is a **giant covalent** lattice.

| Oxide | Bonding | With water | Nature |
| --- | --- | --- | --- |
| Na₂O | ionic | NaOH, pH ≈ 14 | basic |
| MgO | ionic | Mg(OH)₂ (slightly soluble), pH ≈ 9–10 | basic |
| Al₂O₃ | giant ionic (covalent character) | insoluble | **amphoteric** |
| SiO₂ | giant covalent | insoluble | acidic |
| P₄O₁₀, SO₂ | molecular | H₃PO₄, H₂SO₃ (pH ≈ 1–2) | acidic |

## Transition metals

A **transition element** forms at least one ion with an **incomplete d subshell** (so Zn and Sc are not). They show variable oxidation states, form coloured compounds and complexes, and act as catalysts (V₂O₅ in the Contact process, Fe in the Haber process).

A **ligand** donates a lone pair to the metal ion in a dative covalent bond. **Coordination number** is the number of dative bonds: 6 gives an octahedral shape, 4 gives tetrahedral (with large ligands such as Cl⁻) or square planar. Ligand substitution changes colour: [Cu(H₂O)₆]²⁺ (blue) + 4Cl⁻ ⇌ [CuCl₄]²⁻ (yellow) + 6H₂O.

**Colour** arises because ligands split the d orbitals; a d electron absorbs light of energy ΔE = hν = hc/λ, and we see the complementary colour.

## Ions with NaOH and NH₃

Cu²⁺: blue precipitate Cu(OH)₂; excess NH₃ gives a deep blue solution. Fe²⁺: green precipitate; Fe³⁺: brown precipitate. Al³⁺: white precipitate that **dissolves in excess NaOH** (amphoteric).

## Worked examples

**Energy of a d–d transition:** light of wavelength 500 nm: ΔE per mole = L h c ÷ λ = (6.02 × 10²³ × 6.63 × 10⁻³⁴ × 3.00 × 10⁸) ÷ (5.00 × 10⁻⁷) = **240 kJ mol⁻¹**.

**Complexometric titration:** 20.0 cm³ of Ca²⁺ solution needs 15.0 cm³ of 0.0100 mol dm⁻³ EDTA⁴⁻ (1 : 1). n = 1.50 × 10⁻⁴ mol, so c(Ca²⁺) = **7.50 × 10⁻³ mol dm⁻³**.`,
      },
      quiz: {
        title: "Periodicity & Group Chemistry: Year 13 quiz",
        questions: [
          q13.single(1, "What is the definition of a transition element?", "A d-block element that forms at least one ion with an incomplete d subshell",
            ["Any element in the d block of the periodic table, from scandium to zinc, whatever ions it forms", "An element that forms coloured compounds", "An element with a partially filled 4s subshell"],
            "Sc and Zn are in the d block but Sc³⁺ has no d electrons and Zn²⁺ has a full 3d subshell, so they are not transition elements."),
          q13.single(1, "Which of these elements is NOT a transition element?", "Zinc", ["Iron", "Copper", "Nickel"],
            "Zn²⁺ is 3d¹⁰, a full subshell. Fe²⁺ (3d⁶), Cu²⁺ (3d⁹) and Ni²⁺ (3d⁸) have incomplete d subshells."),
          q13.single(2, "Which oxide dissolves in water to give a solution with a pH of about 1–2?", "Phosphorus(V) oxide, P₄O₁₀", ["Sodium oxide, Na₂O", "Magnesium oxide, MgO", "Silicon(IV) oxide, SiO₂"],
            "P₄O₁₀ + 6H₂O → 4H₃PO₄ gives a strongly acidic solution. Na₂O gives pH ≈ 14, MgO about 9–10, and SiO₂ is insoluble."),
          q13.single(2, "Aqueous ammonia is added dropwise to copper(II) sulfate solution until in excess. What is observed?", "A pale blue precipitate forms, then dissolves to give a deep blue solution",
            ["A green precipitate forms that turns brown in air", "A white precipitate forms that dissolves in excess", "The blue solution turns yellow-green"],
            "Cu(OH)₂ (pale blue) forms first. Excess NH₃ substitutes ligands to form the deep blue [Cu(NH₃)₄(H₂O)₂]²⁺."),
          q13.single(1, "Which aqueous ion gives a white precipitate with sodium hydroxide that dissolves in excess?", "Al³⁺", ["Mg²⁺", "Fe²⁺", "Cu²⁺"],
            "Al(OH)₃ is amphoteric, so it dissolves in excess NaOH as [Al(OH)₄]⁻. Mg(OH)₂ is white but does not dissolve; Fe²⁺ gives green and Cu²⁺ blue precipitates."),
          q13.single(2, "The ion [Co(NH₃)₆]³⁺ is shown. What is the coordination number and the shape of this complex ion?", "6, octahedral",
            ["6, tetrahedral", "3, trigonal planar", "4, square planar"],
            "Six ammonia ligands each donate a lone pair to Co³⁺, so there are 6 dative bonds. Six bonding pairs around the metal arrange octahedrally.",
            { diag: true, image: img("complex-oct.png", "Diagram of a complex ion drawn with wedges and dashes: a cobalt atom in the centre bonded to six NH₃ ligands, two along the vertical axis (up and down), two in the plane of the page left and right, one on a wedge towards the viewer and one on a dashed bond away. The whole ion is enclosed in square brackets with a 3+ charge.") }),
          q13.single(2, "Why are many transition metal complexes coloured?", "Ligands split the d orbitals; d electrons absorb visible light of a particular energy to move to a higher d orbital",
            ["Their 4s electrons emit visible light of a particular colour as they fall back down into the lower-energy 3d subshell", "Their nuclei absorb visible light", "The ligands are always coloured"],
            "ΔE between split d levels matches visible light. The colour we see is the complement of the light absorbed."),
          q13.num(3, "A complex absorbs light of wavelength 600 nm. Calculate the energy of the d–d transition per mole in kJ mol⁻¹ to 3 significant figures. (h = 6.63 × 10⁻³⁴ J s, c = 3.00 × 10⁸ m s⁻¹, L = 6.02 × 10²³ mol⁻¹)", 200, 1,
            "E per photon = hc ÷ λ = (6.63 × 10⁻³⁴ × 3.00 × 10⁸) ÷ (6.00 × 10⁻⁷) = 3.315 × 10⁻¹⁹ J. Times L: 3.315 × 10⁻¹⁹ × 6.02 × 10²³ = 1.996 × 10⁵ J mol⁻¹ ≈ 200 kJ mol⁻¹."),
          q13.single(2, "When concentrated hydrochloric acid is added to aqueous copper(II) sulfate the solution turns from blue to yellow-green. What has happened?", "Ligand substitution: [Cu(H₂O)₆]²⁺ has become [CuCl₄]²⁻, with a change of coordination number from 6 to 4",
            ["Reduction of Cu²⁺ to Cu⁺ by the chloride ions, which changes the colour because copper(I) compounds are yellow rather than blue", "Precipitation of copper(II) chloride", "Oxidation of water to oxygen"],
            "Chloride ligands replace water: [Cu(H₂O)₆]²⁺ + 4Cl⁻ ⇌ [CuCl₄]²⁻ + 6H₂O. The larger Cl⁻ ligands fit four around Cu²⁺, giving a tetrahedral ion.", { diag: true }),
          q13.single(1, "Which explains why V₂O₅ can act as a catalyst in the Contact process?", "Vanadium can change oxidation state (V(V) ⇌ V(IV)) and so provide an alternative route",
            ["Vanadium(V) oxide is a strong acid", "Vanadium is used up and regenerated in the reactor wall", "Vanadium has a full 3d subshell"],
            "The variable oxidation states let the catalyst take part in the mechanism by being reduced and then re-oxidised."),
          q13.single(3, "Zinc is added to an acidified solution of orange dichromate(VI) ions. Which sequence of colours is seen as the reduction continues?", "Orange → green → blue",
            ["Orange → blue → green", "Orange → yellow → colourless", "Orange → pink → colourless"],
            "Cr₂O₇²⁻ (orange, +6) is reduced to Cr³⁺ (green, +3), then to Cr²⁺ (blue, +2)."),
          q13.single(2, "Silicon has a melting point of 1410 °C but sulfur, S₈, melts at about 115 °C. What is the explanation?", "Silicon is a giant covalent lattice, while sulfur is a simple molecular substance with weak London forces between molecules",
            ["Silicon has stronger metallic bonding than sulfur", "Sulfur forms ionic bonds that break easily", "Silicon is a simple molecular substance with strong covalent bonds inside each molecule, whereas sulfur exists as single atoms held together by weak forces"],
            "Melting silicon breaks strong covalent bonds throughout the lattice. Melting sulfur only overcomes weak London forces between S₈ molecules."),
          q13.single(1, "What is a ligand?", "A species that donates a lone pair of electrons to a metal ion to form a dative covalent bond",
            ["A species that accepts a lone pair of electrons from a metal atom and so forms a dative covalent bond with it", "An ion that forms an ionic bond with a metal ion", "A neutral atom in the centre of a complex"],
            "Ligands are lone-pair donors (e.g. H₂O, NH₃, Cl⁻), and the bond formed is a dative covalent (coordinate) bond."),
          q13.num(3, "25.0 cm³ of a solution containing Ni²⁺ ions requires 18.4 cm³ of 0.0100 mol dm⁻³ EDTA⁴⁻ solution to complete the reaction. EDTA⁴⁻ forms a 1 : 1 complex with Ni²⁺. Calculate the concentration of Ni²⁺ in mol dm⁻³ as a decimal to 3 significant figures.", 0.00736, 0.0001,
            "n(EDTA⁴⁻) = 0.0100 × 18.4 ÷ 1000 = 1.84 × 10⁻⁴ mol = n(Ni²⁺) (1 : 1). c = 1.84 × 10⁻⁴ ÷ 0.0250 = 7.36 × 10⁻³ mol dm⁻³."),
        ],
      },
      flashcards: [
        { front: "Transition element definition", back: "A d-block element forming at least one ion with an incomplete d subshell (Zn and Sc are not)." },
        { front: "Period 3 oxide acid–base trend", back: "Na₂O, MgO basic; Al₂O₃ amphoteric; SiO₂, P₄O₁₀, SO₂ acidic." },
        { front: "Why is silicon's melting point so high?", back: "Giant covalent lattice: many strong covalent bonds to break." },
        { front: "Four properties of transition metals", back: "Variable oxidation states, coloured ions, complex ions, catalysts." },
        { front: "Ligand and coordination number", back: "Lone-pair donor forming a dative bond; coordination number = number of dative bonds to the metal." },
        { front: "Shapes: CN 6 and CN 4", back: "Octahedral (6); tetrahedral or square planar (4)." },
        { front: "Origin of colour in complexes", back: "d-orbital splitting; a d electron absorbs light ΔE = hν and we see the complement." },
        { front: "Copper(II) with NaOH then excess NH₃", back: "Blue precipitate Cu(OH)₂; excess NH₃ gives a deep blue solution [Cu(NH₃)₄(H₂O)₂]²⁺." },
        { front: "Aluminium hydroxide with excess NaOH", back: "Amphoteric: white precipitate dissolves to form [Al(OH)₄]⁻." },
        { front: "Colour of Cr(VI), Cr(III), Cr(II) ions", back: "Cr₂O₇²⁻ orange; Cr³⁺ green; Cr²⁺ blue." },
      ],
    },
  },
};
