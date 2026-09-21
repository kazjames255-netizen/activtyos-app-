// A-level Chemistry — Atomic Structure & Periodic Trends (Year 12). Original content aligned to the DfE GCE AS/A-level chemistry subject content.
// Keys are recomputed by _chk_c5atom.ts — re-run _check_s6.ts after ANY edit here.
import type { CTopic } from "../types";
import { img, qb } from "./_h";

const q = qb("c5atom", 12);
export const TOPIC: CTopic = {
  key: "c5atom",
  topic: "Chemistry — Atomic Structure & Periodic Trends",
  subject: "Science",
  years: {
    12: {
      year: 12,
      subtopic: "A-level Year 12 (AS)",
      objectives: [
        "Protons, neutrons and electrons: relative mass and charge; atomic number, mass number and isotopes.",
        "Relative atomic mass from mass spectrometry data.",
        "Electron configuration of atoms and ions using s, p and d subshells and orbitals, including chromium and copper.",
        "First and successive ionisation energies; explaining trends across a period and down a group.",
        "Periodic trends in atomic radius and first ionisation energy across period 3.",
      ],
      note: {
        title: "Atomic structure, isotopes, electron configuration and ionisation energy",
        body: `## Key ideas

Atoms contain **protons** and **neutrons** in a tiny nucleus, with **electrons** in shells around it. The **atomic number** Z is the number of protons; the **mass number** A is protons + neutrons. **Isotopes** are atoms of the same element with different numbers of neutrons: the same chemistry, slightly different mass.

| Particle | Relative mass | Relative charge |
| --- | --- | --- |
| Proton | 1 | +1 |
| Neutron | 1 | 0 |
| Electron | 1/1836 (≈ 0.0005) | −1 |

**Relative atomic mass** Ar = Σ(isotope mass × % abundance) ÷ 100. In a mass spectrum each peak's m/z is the isotope mass (for a 1+ ion) and its height is the abundance.

**Electron configuration.** Fill subshells in energy order: 1s, 2s, 2p, 3s, 3p, 4s, 3d, 4p. An s subshell holds 2 electrons, p holds 6, d holds 10. Orbitals in a subshell fill singly before pairing (Hund's rule). Chromium is [Ar] 3d⁵ 4s¹ and copper is [Ar] 3d¹⁰ 4s¹ because half-full and full 3d subshells are especially stable. When a transition metal forms ions, the **4s electrons leave first**.

## Ionisation energy

The **first ionisation energy** is the energy needed to remove one electron from each atom in one mole of gaseous atoms: X(g) → X⁺(g) + e⁻. It depends on nuclear charge, distance and shielding.

- Across period 3 it generally **increases** (more protons, same shielding, smaller radius).
- **Dip at Al**: the 3p electron is higher in energy and better shielded than a 3s electron.
- **Dip at S**: the 3p electron is paired in an orbital, so electron–electron repulsion makes it easier to remove.

A big jump in **successive** ionisation energies shows you have started removing electrons from an inner shell, so the number of electrons before the jump equals the group number.

## Worked example

A sample of lithium has ⁶Li (7.5 %) and ⁷Li (92.5 %).
Ar = (6 × 7.5 + 7 × 92.5) ÷ 100 = 692.5 ÷ 100 = **6.9**`,
      },
      quiz: {
        title: "Atomic Structure & Periodic Trends: Year 12 quiz",
        questions: [
          q.single(1, "How many protons, neutrons and electrons are there in an ion of ²⁷Al³⁺ (atomic number 13)?", "13 protons, 14 neutrons, 10 electrons",
            ["13 protons, 14 neutrons, 16 electrons", "10 protons, 14 neutrons, 13 electrons", "13 protons, 27 neutrons, 10 electrons"],
            "Protons = atomic number = 13. Neutrons = mass number − protons = 27 − 13 = 14. The 3+ charge means 3 electrons have been lost, so 13 − 3 = 10 electrons."),
          q.single(1, "What is the electron configuration of a Ca²⁺ ion (calcium has 20 electrons as an atom)?", "1s² 2s² 2p⁶ 3s² 3p⁶",
            ["1s² 2s² 2p⁶ 3s² 3p⁶ 4s²", "1s² 2s² 2p⁶ 3s² 3p⁶ 4s² 3d²", "1s² 2s² 2p⁶ 3s² 3p⁶ 3d²"],
            "Calcium atoms are 1s² 2s² 2p⁶ 3s² 3p⁶ 4s². Forming Ca²⁺ removes the two 4s electrons, leaving the argon configuration."),
          q.num(2, "A sample of magnesium gives the mass spectrum shown. Calculate the relative atomic mass of magnesium in the sample. Give your answer to 3 significant figures.", 24.3, 0.05,
            "Ar = Σ(m/z × abundance) ÷ Σ abundance = (24 × 78.6 + 25 × 10.1 + 26 × 11.3) ÷ 100 = 2432.7 ÷ 100 = 24.3 (3 s.f.).",
            { diag: true, image: img("ms-mg.png", "Mass spectrum of a sample of magnesium with three vertical peaks: m/z 24 with a relative abundance of 78.6 percent, m/z 25 with 10.1 percent and m/z 26 with 11.3 percent.") }),
          q.single(2, "Why is the first ionisation energy of aluminium lower than that of magnesium?", "The outer electron in Al is in a 3p subshell, which is higher in energy and better shielded than the 3s outer electron of Mg",
            ["Aluminium has fewer protons than magnesium", "Aluminium has a larger atomic radius than magnesium because it has an extra shell", "The 3p electron in Al is paired with another electron, so it repels it"],
            "Al has one more proton than Mg, but its outer electron is in 3p, which is slightly higher in energy and shielded by the 3s electrons, so it is easier to remove."),
          q.single(2, "Why is the first ionisation energy of sulfur lower than that of phosphorus?", "In sulfur, one 3p orbital holds two electrons, and the repulsion between them makes one easier to remove",
            ["Sulfur has a smaller nuclear charge than phosphorus", "Sulfur's outer electron is in a 3s subshell", "Sulfur has more shielding because it has an extra inner shell"],
            "Phosphorus has three singly-occupied 3p orbitals. Sulfur's fourth 3p electron must pair up, and the repulsion within that orbital lowers the energy needed to remove it.", { diag: true }),
          q.single(2, "The bar chart shows log₁₀ of the successive ionisation energies of an element X. To which group does X belong?", "Group 3 (13)",
            ["Group 1", "Group 2", "Group 4 (14)"],
            "There is a huge jump between the 3rd and 4th ionisation energies. The first three electrons come from the outer shell, then the 4th comes from an inner shell, so X has 3 outer electrons.",
            { image: img("ie-x.png", "Bar chart of log base 10 of the first six ionisation energies of element X in kilojoules per mole. The bars for ionisations 1, 2 and 3 are similar and low (578, 1817 and 2745). The 4th bar (11577) is much taller, then the 5th (14842) and 6th (18379) are taller still.") }),
          q.short(1, "Name the subshell that is filled immediately after 4s in the elements of the fourth period.", "3d", ["3d", "the 3d subshell", "3d subshell", "d"],
            "The filling order is 1s, 2s, 2p, 3s, 3p, 4s, 3d, 4p. So the 3d subshell fills straight after 4s."),
          q.multi(2, "Which statements about isotopes of the same element are correct?",
            ["They have the same number of protons", "They have different numbers of neutrons"],
            ["They have different numbers of electrons in the neutral atom", "They have different chemical properties"],
            "Isotopes differ only in neutron number. Their neutral atoms have the same electrons, so the chemistry is the same."),
          q.num(2, "Boron has two isotopes: ¹⁰B (19.9 %) and ¹¹B (80.1 %). Calculate the relative atomic mass of boron to 3 significant figures.", 10.8, 0.03,
            "Ar = (10 × 19.9 + 11 × 80.1) ÷ 100 = 1080.1 ÷ 100 = 10.8.", { }),
          q.num(3, "Chlorine has only two isotopes, ³⁵Cl and ³⁷Cl. Its relative atomic mass is 35.5. Calculate the percentage abundance of ³⁷Cl.", 25, 0.6,
            "Let x be the fraction of ³⁷Cl: 37x + 35(1 − x) = 35.5, so 2x = 0.5 and x = 0.25, which is 25 %."),
          q.single(2, "Which explains why atomic radius decreases from sodium to chlorine?", "The nuclear charge increases while the shielding stays about the same, so the outer electrons are pulled in more strongly",
            ["Each successive element has an extra electron shell, and the extra shell pulls the outer electrons closer to the nucleus and shrinks the atom", "The number of neutrons decreases across the period", "The electrons repel each other more strongly across the period"],
            "All period 3 atoms have the same inner shells, so the shielding is similar. Extra protons pull the outer shell closer."),
          q.single(3, "What is the ground-state electron configuration of chromium (atomic number 24)?", "1s² 2s² 2p⁶ 3s² 3p⁶ 3d⁵ 4s¹",
            ["1s² 2s² 2p⁶ 3s² 3p⁶ 3d⁴ 4s²", "1s² 2s² 2p⁶ 3s² 3p⁶ 3d⁶", "1s² 2s² 2p⁶ 3s² 3p⁶ 3d⁴ 4s¹ 4p¹"],
            "One 4s electron moves into 3d so that the 3d subshell is half-full (3d⁵), which is a lower-energy arrangement than 3d⁴ 4s²."),
          q.single(3, "Chlorine exists as ³⁵Cl and ³⁷Cl in the ratio 3 : 1. In the mass spectrum of Cl₂ molecules (Cl₂⁺ ions) which peaks are seen?", "m/z 70, 72 and 74 in the ratio 9 : 6 : 1",
            ["m/z 70 and 74 in the ratio 3 : 1", "m/z 70, 72 and 74 in the ratio 3 : 2 : 1", "m/z 35 and 37 only, in the ratio 3 : 1"],
            "The molecules are ³⁵Cl³⁵Cl (m/z 70), ³⁵Cl³⁷Cl (72) and ³⁷Cl³⁷Cl (74). Probabilities: 0.75² = 9/16, 2 × 0.75 × 0.25 = 6/16, 0.25² = 1/16, giving 9 : 6 : 1."),
          q.single(1, "Which of these atoms has the largest atomic radius?", "Sodium", ["Magnesium", "Aluminium", "Chlorine"],
            "Atomic radius decreases across a period. Sodium is on the far left of period 3, so it is largest."),
        ],
      },
      flashcards: [
        { front: "Relative mass and charge of proton, neutron, electron", back: "Proton 1, +1; neutron 1, 0; electron 1/1836, −1." },
        { front: "Isotopes", back: "Atoms of the same element (same protons) with different numbers of neutrons." },
        { front: "Formula for Ar from a mass spectrum", back: "Ar = Σ(m/z × abundance) ÷ Σ abundance." },
        { front: "Order of subshell filling to 4p", back: "1s 2s 2p 3s 3p 4s 3d 4p." },
        { front: "Maximum electrons in s, p and d subshells", back: "s 2, p 6, d 10." },
        { front: "Electron configuration of Cr and Cu", back: "Cr [Ar] 3d⁵ 4s¹; Cu [Ar] 3d¹⁰ 4s¹ (half-full / full 3d is stable)." },
        { front: "Which electrons does a transition metal lose first?", back: "The 4s electrons, before 3d." },
        { front: "Definition: first ionisation energy", back: "Energy to remove one electron from each atom in one mole of gaseous atoms: X(g) → X⁺(g) + e⁻." },
        { front: "Why is IE1 of Al < Mg?", back: "Al's outer electron is in 3p: higher energy and shielded by the 3s electrons." },
        { front: "Why is IE1 of S < P?", back: "S has a paired electron in a 3p orbital; the repulsion makes it easier to remove." },
      ],
    },
  },
};
