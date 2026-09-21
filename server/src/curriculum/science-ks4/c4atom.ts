// GCSE Chemistry — Atomic Structure & the Periodic Table (Year 10).
import type { CTopic } from "../types";
import { N, S, M, W, yr } from "./_h";
import { SHELLS } from "./_imgdata";

const IMG = ["c4atom-shells.png", "A diagram of an atom with a central nucleus labelled 17 protons. Three circular shells surround it. Electrons are drawn as dots: 2 on the inner shell, 8 on the middle shell and 7 on the outer shell."] as [string, string];

export const TOPIC: CTopic = {
  key: "c4atom", topic: "Chemistry — Atomic Structure & the Periodic Table", subject: "Science",
  years: {
    10: yr("c4atom", 10, {
      obj: [
        "Describe atoms, elements, compounds and mixtures, and the development of the atomic model (Dalton, Thomson, Rutherford, Bohr, Chadwick).",
        "Use atomic number, mass number and isotopes; calculate relative atomic mass from isotope abundances.",
        "Write electronic structures for the first 20 elements.",
        "Describe the development and layout of the periodic table (Mendeleev), groups and periods, metals and non-metals.",
        "Explain the properties and trends of Group 0 (noble gases), Group 1 (alkali metals) and Group 7 (halogens); displacement reactions.",
        "Describe the properties of transition metals.",
      ],
      note: ["GCSE Chemistry: atoms and the periodic table", `## Inside the atom
| Particle | Relative charge | Relative mass |
| --- | --- | --- |
| Proton | +1 | 1 |
| Neutron | 0 | 1 |
| Electron | −1 | very small (~1/2000) |

**Atomic number** = number of protons (defines the element). **Mass number** = protons + neutrons. **Isotopes** are atoms of the same element with different numbers of neutrons. Electrons fill shells 2, 8, 8 in order: sodium is **2,8,1**. The number of outer electrons gives the **group**, the number of shells the **period**.

## History of the model
Dalton (solid spheres) → Thomson (plum pudding) → Rutherford (alpha scattering: tiny dense positive nucleus, mostly empty space) → Bohr (electrons in shells) → Chadwick (neutrons).

## Periodic table trends
- **Group 1** (alkali metals): soft, 1+ ions; reactivity **increases** down the group; react with water to give a metal hydroxide (alkaline) + hydrogen.
- **Group 7** (halogens): diatomic molecules, 1− ions; reactivity **decreases** down the group; a more reactive halogen displaces a less reactive one.
- **Group 0**: full outer shell, unreactive; boiling points rise down the group.

## Relative atomic mass
Ar = Σ(isotope mass × % abundance) ÷ 100.
Example: copper is 70% ⁶³Cu and 30% ⁶⁵Cu: (70 × 63 + 30 × 65) ÷ 100 = 4410 + 1950 = 6360 ÷ 100 = **63.6**.

**Working scientifically:** trends are found by testing several elements under the same conditions and spotting patterns.`],
      quiz: "GCSE Chemistry: Atomic Structure & the Periodic Table quiz",
      qs: [
        S(1, "Which particle has a relative mass of 1 and no charge?", "Neutron", ["Proton", "Electron", "Nucleus"], "Neutrons are neutral with relative mass 1. Protons have +1 charge and electrons have −1 charge with almost no mass.", {}),
        S(1, "What is the atomic number of an element?", "The number of protons in its atoms", ["The number of neutrons in its atoms", "The number of protons plus neutrons", "The number of shells in its atoms"], "Atomic number = number of protons, which defines the element. Mass number = protons + neutrons.", {}),
        S(1, "What happens to the reactivity of Group 1 metals going down the group?", "It increases", ["It decreases", "It stays the same", "It increases then decreases"], "Lower down the group, the outer electron is further from the nucleus and lost more easily, so reactivity increases.", {}),
        S(2, "The diagram shows the electrons in an atom. In which group and period of the periodic table is this element?", "Group 7, Period 3", ["Group 3, Period 7", "Group 8, Period 3", "Group 7, Period 2"], "Outer shell has 7 electrons, so Group 7. There are 3 occupied shells, so Period 3 (this is chlorine).", { img: IMG, diag: true, chk: () => `Group ${SHELLS.shells[SHELLS.shells.length - 1]}, Period ${SHELLS.shells.length}` }),
        N(2, "The atom in the diagram has a mass number of 35. How many neutrons are in its nucleus?", 18, 0, "Neutrons = mass number − atomic number = 35 − 17 = 18.", () => 35 - SHELLS.protons, { img: IMG }),
        N(2, "Chlorine has two isotopes: 75% chlorine-35 and 25% chlorine-37. Calculate the relative atomic mass of chlorine.", 35.5, 0.05, "Relative atomic mass = (75 × 35 + 25 × 37) ÷ 100 = (2625 + 925) ÷ 100 = 35.5.", () => (75 * 35 + 25 * 37) / 100, { diag: true }),
        S(2, "In Rutherford's gold foil experiment most alpha particles passed straight through. What did this show?", "Atoms are mostly empty space", ["The nucleus is negatively charged", "Atoms are solid spheres", "Electrons are heavier than protons"], "Most particles went through unchanged, so most of the atom is empty space. A few were deflected, showing a small, dense, positive nucleus.", {}),
        S(2, "Which reaction will happen?", "Chlorine + potassium bromide solution", ["Bromine + sodium chloride solution", "Iodine + potassium bromide solution", "Bromine + potassium fluoride solution"], "A more reactive halogen displaces a less reactive one from its salt. Chlorine is more reactive than bromine so it displaces bromine from potassium bromide.", {}),
        M(2, "Which statements about Group 1 metals are correct? Choose all that apply.", ["They form 1+ ions", "They react with water to make an alkaline solution and hydrogen"], ["Their reactivity decreases down the group", "They are hard with high melting points", "They form acidic oxides"], "Alkali metals lose one outer electron to form 1+ ions and give alkaline hydroxide solutions with water. They are soft, with low melting points, and are more reactive down the group.", {}),
        S(2, "What is the electronic structure of an atom with 13 electrons?", "2,8,3", ["2,8,8", "2,11", "2,3,8"], "Fill shells in order: 2 in the first, 8 in the second, leaving 3 in the third: 2,8,3 (aluminium).", { chk: () => { const e: number[] = []; let n = 13; for (const c of [2, 8, 8]) { const t = Math.min(c, n); e.push(t); n -= t; } return e.join(","); } }),
        S(3, "Why do isotopes of the same element have the same chemical properties?", "They have the same number of electrons, so react in the same way", ["They have the same number of neutrons, so their nuclei behave the same way", "They have the same mass number, so their atoms are the same size", "They are the same atom in different physical states, like ice and water"], "Chemical reactions depend on electrons, and isotopes have equal numbers of protons and so of electrons. Only the neutron number differs.", {}),
        N(3, "Boron has two isotopes: 20% boron-10 and 80% boron-11. Calculate the relative atomic mass of boron to 1 decimal place.", 10.8, 0.05, "(20 × 10 + 80 × 11) ÷ 100 = (200 + 880) ÷ 100 = 10.8.", () => (20 * 10 + 80 * 11) / 100),
        W("Explain, using electronic structure, why reactivity increases down Group 1 but decreases down Group 7. [6 marks]", "Mark scheme (6): Group 1 atoms have one outer electron and lose it to form 1+ ions (1); down the group the outer electron is further from the nucleus, more shielded by inner shells, so held less strongly (1); it is lost more easily so reactivity increases (1). Group 7 atoms have seven outer electrons and gain one to form 1− ions (1); down the group the outer shell is further from the nucleus and shielded, so the attraction to an incoming electron is weaker (1); gaining an electron is harder, so reactivity decreases (1)."),
      ],
      cards: [
        ["Relative charge and mass: proton, neutron, electron", "Proton +1, 1; neutron 0, 1; electron −1, almost 0."],
        ["Atomic number / mass number", "Protons / protons + neutrons."],
        ["Isotopes", "Atoms of the same element with different numbers of neutrons."],
        ["Relative atomic mass formula", "Σ(isotope mass × % abundance) ÷ 100."],
        ["Electronic structure of sodium", "2,8,1 (Group 1, Period 3)."],
        ["Rutherford's discovery", "Alpha scattering showed a tiny, dense, positive nucleus and mostly empty space."],
        ["Who found the neutron?", "Chadwick."],
        ["Group 1 reactivity trend", "Increases down the group."],
        ["Group 7 reactivity trend", "Decreases down the group."],
        ["Why are noble gases unreactive?", "Full outer shell of electrons."],
        ["Mendeleev's key idea", "Arranged by properties and atomic mass, left gaps for undiscovered elements."],
        ["Transition metal properties", "High density and melting point, form coloured compounds, useful catalysts."],
      ],
    }),
  },
};
