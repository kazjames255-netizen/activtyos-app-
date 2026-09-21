// A-level Chemistry — Bonding & Structure (Year 12). Original content aligned to the DfE GCE AS/A-level chemistry subject content.
// Electron-pair counts and the electronegativity comparison are re-derived in _chk_c5bond.ts.
import type { CTopic } from "../types";
import { img, qb } from "./_h";

const q = qb("c5bond", 12);
export const TOPIC: CTopic = {
  key: "c5bond",
  topic: "Chemistry — Bonding & Structure",
  subject: "Science",
  years: {
    12: {
      year: 12,
      subtopic: "A-level Year 12 (AS)",
      objectives: [
        "Ionic, covalent (including dative covalent) and metallic bonding; properties of giant and simple molecular structures.",
        "Shapes of molecules and ions using electron-pair repulsion, with bond angles.",
        "Electronegativity, bond polarity and polar molecules.",
        "Intermolecular forces: London forces, permanent dipole–dipole forces and hydrogen bonding; effect on boiling point.",
      ],
      note: {
        title: "Bonding, structure, shapes and intermolecular forces",
        body: `## Bonding and structure

| Structure | Example | Held together by | Melting point | Conducts? |
| --- | --- | --- | --- | --- |
| Giant ionic | NaCl, MgO | Attraction between oppositely charged ions | High | Only molten or dissolved |
| Giant covalent | diamond, SiO₂ | Covalent bonds throughout | Very high | No (graphite yes) |
| Giant metallic | Cu, Mg | Positive ions in a sea of delocalised electrons | High | Yes |
| Simple molecular | I₂, H₂O, CH₄ | Weak intermolecular forces | Low | No |

A **dative covalent bond** is a shared pair where both electrons come from one atom, as in NH₄⁺.

## Shapes: electron-pair repulsion

Electron pairs around a central atom repel and spread out. Lone pairs repel more than bonding pairs, so **each lone pair squeezes bond angles by about 2.5°**.

| Bonding / lone pairs | Shape | Angle | Example |
| --- | --- | --- | --- |
| 3 / 0 | trigonal planar | 120° | BF₃ |
| 4 / 0 | tetrahedral | 109.5° | CH₄ |
| 3 / 1 | trigonal pyramidal | 107° | NH₃ |
| 2 / 2 | bent | 104.5° | H₂O |
| 6 / 0 | octahedral | 90° | SF₆ |

## Polarity and intermolecular forces

**Electronegativity** is the power of an atom to attract the bonding pair. A difference gives a polar bond, but a molecule is polar overall only if the dipoles do not cancel (CCl₄ is non-polar; CHCl₃ is polar).

- **London forces** act between all molecules and get stronger with more electrons and more surface contact.
- **Permanent dipole–dipole forces** act between polar molecules.
- **Hydrogen bonds** need H bonded to N, O or F and a lone pair on another N, O or F.

## Worked example

Water has 2 bonding pairs and 2 lone pairs, so it is bent with an angle about 104.5° (109.5° − 2 × 2.5°).`,
      },
      quiz: {
        title: "Bonding & Structure: Year 12 quiz",
        questions: [
          q.single(1, "Which statement correctly describes metallic bonding?", "A lattice of positive metal ions surrounded by a sea of delocalised electrons",
            ["Positive ions and negative ions held together in a lattice", "Shared pairs of electrons between neighbouring atoms", "Neutral metal atoms packed closely together and held by weak London forces between temporary dipoles"],
            "In a metal, the outer electrons are delocalised. The attraction between the positive ions and this electron sea is metallic bonding."),
          q.single(1, "What is the H–C–H bond angle in a molecule of methane, CH₄?", "109.5°", ["90°", "107°", "120°"],
            "Methane has four bonding pairs and no lone pairs, so the pairs point to the corners of a tetrahedron with angles of 109.5°."),
          q.single(2, "The diagram shows a molecule of ammonia, NH₃, with its lone pair. Which shape and H–N–H bond angle is correct?", "Trigonal pyramidal, 107°",
            ["Trigonal planar, 120°", "Tetrahedral, 109.5°", "Trigonal pyramidal, 109.5°"],
            "There are 3 bonding pairs and 1 lone pair. The lone pair repels more than a bonding pair and squeezes the angle from 109.5° to about 107°.",
            { diag: true, image: img("nh3.png", "Diagram of an ammonia molecule: a nitrogen atom at the centre bonded to three hydrogen atoms, one bond in the plane of the page, one drawn as a solid wedge coming towards the viewer and one as a dashed line going away. A pair of dots above the nitrogen shows its lone pair.") }),
          q.single(2, "Why does graphite conduct electricity but diamond does not?", "Graphite has delocalised electrons between its layers that can move; diamond's outer electrons are all held in localised covalent bonds",
            ["Graphite contains metal ions", "Graphite has weaker covalent bonds than diamond, so its electrons are held less tightly and can break free from the bonds to carry the current through the lattice", "Graphite has more carbon atoms per molecule than diamond"],
            "Each carbon in graphite uses 3 electrons for bonding in a layer; the fourth is delocalised and free to carry charge. In diamond all four are in fixed bonds."),
          q.single(2, "Why is the boiling point of hydrogen fluoride (20 °C) much higher than that of hydrogen chloride (−85 °C)?", "HF molecules form hydrogen bonds with each other, which are stronger than the forces between HCl molecules",
            ["The covalent H–F bond is stronger than the H–Cl bond", "HF molecules have more electrons than HCl molecules, so the temporary dipoles are larger and the London forces between HF molecules are stronger", "HF is an ionic compound"],
            "Boiling breaks intermolecular forces, not covalent bonds. F is very electronegative and has lone pairs, so HF forms hydrogen bonds.", { diag: true }),
          q.multi(2, "Which of these liquids can form hydrogen bonds between their own molecules?",
            ["NH₃", "CH₃OH"], ["CH₄", "CH₃OCH₃"],
            "Hydrogen bonding needs an H atom bonded to N, O or F. NH₃ and CH₃OH have them; CH₄ (H on C) and CH₃OCH₃ (no O–H) do not."),
          q.single(2, "What is the shape of a boron trifluoride molecule, BF₃, and its F–B–F bond angle?", "Trigonal planar, 120°",
            ["Trigonal pyramidal, 107°", "Tetrahedral, 109.5°", "Bent, 104.5°"],
            "Boron has 3 electrons and forms 3 bonds, so there are 3 bonding pairs and no lone pairs. Three pairs spread out flat at 120°."),
          q.single(3, "What is the shape of the ICl₄⁻ ion and its bond angle?", "Square planar, 90°",
            ["Tetrahedral, 109.5°", "See-saw, 90° and 120°", "Octahedral, 90°"],
            "Iodine has 7 outer electrons, +1 for the negative charge, +4 from the four chlorines = 12 electrons = 6 pairs. Four bonding and two lone pairs give an octahedral arrangement; the lone pairs sit opposite each other, leaving a square planar ion."),
          q.single(1, "Which of these substances has a giant covalent structure?", "Silicon(IV) oxide, SiO₂", ["Sodium chloride, NaCl", "Carbon dioxide, CO₂", "Iodine, I₂"],
            "SiO₂ has covalent bonds in a continuous network. NaCl is ionic; CO₂ and I₂ are simple molecules."),
          q.single(1, "Using electronegativity values (H 2.1, C 2.5, O 3.5, Cl 3.0, F 4.0), which bond is the most polar?", "C–F", ["C–H", "C–O", "C–Cl"],
            "The larger the electronegativity difference, the more polar the bond. C–F has a difference of 1.5, larger than C–O (1.0), C–Cl (0.5) and C–H (0.4)."),
          q.multi(3, "Which of these molecules are polar overall?", ["NH₃", "CH₂Cl₂"], ["CO₂", "CCl₄"],
            "CO₂ (linear) and CCl₄ (tetrahedral) have polar bonds whose dipoles cancel by symmetry. NH₃ is pyramidal and CH₂Cl₂ is an uneven tetrahedron, so their dipoles do not cancel."),
          q.single(2, "Butane boils at −0.5 °C but its isomer 2-methylpropane boils at −11.7 °C. What is the best explanation?", "Straight-chain butane molecules have a larger surface area of contact, giving stronger London forces",
            ["Butane molecules form hydrogen bonds but 2-methylpropane molecules do not", "Butane molecules have more electrons than 2-methylpropane molecules, so their temporary dipoles are larger and the London forces are stronger", "The covalent bonds in butane are stronger"],
            "Both are C₄H₁₀ with the same number of electrons. Branching makes the molecule more compact, so there is less contact between molecules and weaker London forces."),
          q.short(2, "What name is given to a covalent bond in which both shared electrons come from the same atom, as in NH₄⁺?", "dative covalent", ["dative", "coordinate", "coordinate covalent", "dative covalent bond", "co-ordinate", "dative bond", "coordinate bond", "co-ordinate covalent", "co-ordinate bond", "co-ordinate covalent bond", "coordinate covalent bond", "dative covalent bonding", "dative coordinate", "dative (coordinate) bond", "a dative covalent bond", "dative bonding"],
            "In NH₄⁺ the nitrogen lone pair is donated into an empty orbital on H⁺. Both electrons in that shared pair come from N, so it is a dative (coordinate) bond."),
          q.single(3, "Magnesium oxide melts at 2852 °C but sodium chloride melts at 801 °C. What is the best explanation?", "Mg²⁺ and O²⁻ have higher charges and smaller radii, so the electrostatic attraction in the lattice is stronger",
            ["MgO is held together by strong covalent bonds throughout its structure, whereas NaCl only has weaker ionic attractions between its ions", "MgO forms a molecular lattice with London forces", "Mg atoms are heavier than Na atoms, so more heat is needed"],
            "Melting a giant ionic lattice means overcoming ionic attraction. Higher ion charges (2+ and 2−) and smaller ions give a much stronger attraction than Na⁺ and Cl⁻."),
        ],
      },
      flashcards: [
        { front: "Metallic bonding", back: "Attraction between positive metal ions and delocalised electrons." },
        { front: "Dative covalent bond", back: "A shared pair where both electrons come from the same atom (e.g. NH₄⁺, H₃O⁺)." },
        { front: "Why do molten (not solid) ionic compounds conduct?", back: "Ions are free to move and carry charge." },
        { front: "Bond angles: linear, trigonal planar, tetrahedral, octahedral", back: "180°, 120°, 109.5°, 90°." },
        { front: "Effect of a lone pair on bond angle", back: "Lone pairs repel more than bonding pairs, reducing the angle by about 2.5° each: NH₃ 107°, H₂O 104.5°." },
        { front: "Electronegativity", back: "The ability of an atom to attract the bonding pair of electrons in a covalent bond." },
        { front: "When is a molecule polar overall?", back: "When it has polar bonds whose dipoles do not cancel by symmetry." },
        { front: "Three types of intermolecular force, weakest to strongest (typically)", back: "London (induced dipole–dipole), permanent dipole–dipole, hydrogen bonding." },
        { front: "Hydrogen bond requirement", back: "H bonded to N, O or F, attracted to a lone pair on another N, O or F." },
        { front: "Why do the boiling points of alkanes rise with chain length?", back: "More electrons and more surface contact, so stronger London forces." },
      ],
    },
  },
};
