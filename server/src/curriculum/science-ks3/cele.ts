// KS3 Science — Chemistry: Atoms, Elements & the Periodic Table (Y7 elements/compounds/mixtures/separation; Y8 the periodic table).
// Original content aligned to the DfE KS3 programme of study (OGL v3.0). Calculation keys are recomputed by _check_s3.ts.
import type { CTopic } from "../types";
import { IMG } from "./_img";
import { sg, mu, nm, build } from "./_h";

export const TOPIC: CTopic = {
  key: "cele",
  topic: "Chemistry — Atoms, Elements & the Periodic Table",
  subject: "Science",
  years: {
    7: {
      year: 7,
      subtopic: "Year 7: elements, compounds, mixtures and separation",
      objectives: [
        "A simple (Dalton) atomic model; the differences between atoms, elements and compounds.",
        "Chemical symbols and formulae for elements and compounds.",
        "Mixtures, including dissolving; the identification of pure substances.",
        "Methods of separating mixtures: filtration, evaporation, distillation and chromatography.",
      ],
      note: {
        title: "Year 7: elements, compounds and mixtures",
        body: `## Atoms, elements and compounds

An **atom** is the smallest part of an element. An **element** contains only one type of atom (for example oxygen, O; iron, Fe; sodium, Na; potassium, K). A **compound** has two or more elements **chemically joined** in fixed proportions, with different properties from the elements (water, H₂O). A **mixture** is two or more substances that are **not** chemically joined, so they can be separated.

## Formulae

The formula shows the atoms in one molecule. CH₄ (methane) is 1 carbon and 4 hydrogen, 5 atoms in total. Small numbers apply to the atom just before them.

## Separating mixtures

| Method | Use |
| --- | --- |
| Filtration | Separates an insoluble solid from a liquid |
| Evaporation | Obtains a dissolved solid (solute) from a solution |
| Distillation | Obtains the solvent from a solution |
| Chromatography | Separates substances (such as inks) that dissolve in a solvent, by how far they travel |

## Worked example: dissolving

Dissolve 8 g of sugar in 200 g of water. The sugar is the **solute**, the water is the **solvent** and the **solution** has mass 8 + 200 = **208 g**. Mass is conserved.`,
      },
      quiz: {
        title: "Atoms, Elements & Mixtures: Year 7 quiz",
        questions: build("cele", 7, [
          sg("Look at the four boxes of particles. Which box shows a compound?", "B", ["A", "C", "D"], "In a compound, atoms of different elements are chemically joined. Box B shows joined pairs of one blue and one orange atom.", 1, { d: true, img: IMG.boxes }),
          mu("Which boxes contain atoms of only ONE element?", ["A", "B", "C", "D"], ["A", "D"], "Box A has only blue atoms, and box D has only pairs of blue atoms. Boxes B and C contain two elements.", 2, { img: IMG.boxes }),
          sg("Look at the boxes. Which best describes box C?", "A mixture of two elements", ["A compound of X and Y", "A single element", "A pure substance"], "The blue and orange atoms are not joined, so this is a mixture of two elements.", 2, { d: true, img: IMG.boxes }),
          sg("Which method would you use to separate sand from water?", "Filtration", ["Evaporation", "Distillation", "Chromatography"], "Sand does not dissolve, so it stays in the filter paper while water passes through.", 1),
          sg("Which method obtains pure water from salty water?", "Distillation", ["Filtration", "Chromatography", "Sieving"], "The water evaporates and is condensed and collected, leaving the salt behind.", 2),
          sg("The formula for carbon dioxide is CO₂. What does this tell you?", "One molecule has one carbon atom and two oxygen atoms joined", ["One molecule has two carbon atoms and one oxygen atom joined", "One atom of carbon dioxide", "A mixture of carbon and oxygen"], "The small 2 applies only to the O before it, so there are 2 oxygen atoms and 1 carbon atom.", 2),
          nm("5 g of salt dissolves fully in 100 g of water. What is the mass of the salt solution in g?", 105, "Mass is conserved when a substance dissolves: 100 + 5 = 105 g.", 2),
          sg("A student runs a black ink on chromatography paper and gets three separate coloured spots. What does this show?", "The ink is a mixture of at least three dyes", ["The ink is a pure substance made of one dye", "The ink is a compound of three elements", "The dyes in the ink are insoluble in the solvent"], "A pure substance would give only one spot.", 2),
          sg("Which is the chemical symbol for potassium?", "K", ["P", "Po", "Pt"], "K is from the Latin kalium. P is phosphorus, Po is polonium and Pt is platinum.", 1),
          nm("How many atoms are there in one molecule of sulfuric acid, H₂SO₄?", 7, "Add the numbers: 2 hydrogen + 1 sulfur + 4 oxygen = 7 atoms.", 3),
        ]),
      },
      flashcards: [
        { front: "Element", back: "A substance made of only one type of atom." },
        { front: "Compound", back: "Two or more elements chemically joined in fixed proportions." },
        { front: "Mixture", back: "Two or more substances not chemically joined; can be separated physically." },
        { front: "Filtration separates…", back: "An insoluble solid from a liquid." },
        { front: "Evaporation gets you…", back: "The dissolved solid (solute) from a solution." },
        { front: "Distillation gets you…", back: "The solvent (for example pure water) from a solution." },
        { front: "What does a pure substance give in chromatography?", back: "One spot only." },
        { front: "Symbol for sodium, iron, potassium", back: "Na, Fe, K." },
        { front: "Solute, solvent, solution", back: "Solute dissolves in the solvent to make a solution." },
        { front: "Formula H₂O means…", back: "Two hydrogen atoms and one oxygen atom in a molecule." },
      ],
    },
    8: {
      year: 8,
      subtopic: "Year 8: the periodic table",
      objectives: [
        "The varying physical and chemical properties of different elements.",
        "The principles underpinning the Mendeleev Periodic Table; the Periodic Table: periods and groups; metals and non-metals.",
        "How patterns in reactions can be predicted with reference to the Periodic Table.",
        "The chemical properties of metal and non-metal oxides with respect to acidity.",
      ],
      note: {
        title: "Year 8: reading the periodic table",
        body: `## Periods and groups

The periodic table arranges elements in order of atomic number. Rows are **periods**; columns are **groups**. Elements in the **same group** have **similar chemical properties**.

- **Group 1, the alkali metals** (lithium, sodium, potassium): soft, react with water to make hydrogen and an alkaline solution. Reactivity **increases down** the group.
- **Group 7, the halogens** (fluorine, chlorine, bromine, iodine): reactive non-metals.
- **Group 0, the noble gases** (helium, neon, argon): very unreactive.

## Metals and non-metals

| | Metals | Non-metals |
| --- | --- | --- |
| Appearance | shiny | dull |
| Conduct electricity and heat | well | poorly (usually) |
| When hit | malleable | brittle when solid |
| Oxides | basic (alkaline if they dissolve) | acidic |

## Mendeleev

In 1869 Dmitri Mendeleev arranged the elements by properties and atomic mass. He left **gaps** for undiscovered elements and predicted their properties. When these were found, his table was widely accepted.

## Worked example

Rubidium is below potassium in Group 1. Predict: a soft metal, reacts with water to make hydrogen, and it is **more reactive** than potassium.`,
      },
      quiz: {
        title: "The Periodic Table: Year 8 quiz",
        questions: build("cele", 8, [
          sg("Look at the periodic table extract. Which letter is a noble gas?", "D", ["A", "B", "C"], "Group 0 contains the noble gases. D is in Group 0.", 1, { d: true, img: IMG.periodic }),
          sg("Look at the periodic table extract. Which letter is a halogen?", "B", ["A", "C", "D"], "The halogens are in Group 7, and B is in that column.", 1, { img: IMG.periodic }),
          sg("Look at the extract. Elements A and C are in the same group. What does this tell you?", "They have similar chemical properties", ["They have the same number of atoms", "They are in the same period", "They have the same mass"], "Elements in the same group react in similar ways. A and C are in different periods.", 2, { d: true, img: IMG.periodic }),
          sg("Look at the extract. C is below A in Group 1. Which is likely to be MORE reactive?", "C", ["A", "Both the same", "Neither, because Group 1 metals are unreactive"], "Reactivity of the alkali metals increases as you go down the group.", 3, { img: IMG.periodic }),
          sg("Which property is typical of metals?", "They conduct electricity well", ["They are brittle when solid", "They have dull surfaces", "They are poor conductors of heat"], "Metals are good conductors of heat and electricity, and are malleable and shiny.", 1),
          mu("Which of these are typical properties of non-metals?", ["Brittle when solid", "Dull surface", "Good conductor of electricity", "Malleable", "Poor conductor of heat"], ["Brittle when solid", "Dull surface", "Poor conductor of heat"], "Non-metals are typically brittle, dull and poor conductors. Metals are the ones that are malleable and good conductors.", 2),
          sg("Sodium reacts with water. Which gas is given off?", "Hydrogen", ["Oxygen", "Carbon dioxide", "Chlorine"], "Group 1 metals react with water to give hydrogen and an alkaline metal hydroxide solution.", 2),
          sg("Argon is used to fill some light bulbs. Why is it suitable?", "It is unreactive, so it does not react with the hot filament", ["It is a very reactive gas, so it burns brightly around the hot filament", "It conducts electricity well", "It is a metal"], "Noble gases have very stable atoms and do not take part in reactions.", 2),
          sg("Mendeleev left gaps in his periodic table. Why?", "He predicted that elements not yet discovered would fit there", ["He did not know their symbols", "He thought those elements were too unreactive to have any properties", "The gaps were for the transition metals"], "He used patterns in properties to predict undiscovered elements, and later discoveries supported his table.", 2),
          sg("Which of these is a liquid at room temperature?", "Mercury", ["Iron", "Copper", "Sodium"], "Mercury is a metal that is liquid at room temperature. Iron, copper and sodium are all solid.", 2),
        ]),
      },
      flashcards: [
        { front: "Groups and periods", back: "Groups are columns; periods are rows." },
        { front: "Same group means…", back: "Similar chemical properties." },
        { front: "Group 1 name", back: "Alkali metals." },
        { front: "Group 7 name", back: "Halogens." },
        { front: "Group 0 name and property", back: "Noble gases: very unreactive." },
        { front: "Trend in reactivity of Group 1", back: "Increases down the group." },
        { front: "Sodium + water gives…", back: "Hydrogen gas and sodium hydroxide (an alkaline solution)." },
        { front: "Typical properties of metals", back: "Shiny, malleable, good conductors of heat and electricity." },
        { front: "Typical properties of non-metals", back: "Dull, brittle when solid, poor conductors." },
        { front: "Are metal oxides and non-metal oxides acidic or basic?", back: "Metal oxides are basic (alkaline if they dissolve); non-metal oxides are acidic." },
        { front: "What did Mendeleev do that other tables had not?", back: "Left gaps for undiscovered elements and predicted their properties." },
      ],
    },
  },
};
