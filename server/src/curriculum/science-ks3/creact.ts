// KS3 Science — Chemistry: Chemical Reactions (Y8 reactions, word equations, acids & alkalis, energy changes; Y9 reactivity series, metals, conservation of mass).
// Original content aligned to the DfE KS3 programme of study (OGL v3.0). Calculation keys are recomputed by _check_s3.ts.
import type { CTopic } from "../types";
import { IMG } from "./_img";
import { sg, mu, nm, build } from "./_h";

export const TOPIC: CTopic = {
  key: "creact",
  topic: "Chemistry — Chemical Reactions",
  subject: "Science",
  years: {
    8: {
      year: 8,
      subtopic: "Year 8: reactions, acids and alkalis, energy changes",
      objectives: [
        "Chemical reactions as the rearrangement of atoms; representing reactions using word equations.",
        "Combustion, thermal decomposition, oxidation and displacement reactions.",
        "Defining acids and alkalis in terms of neutralisation reactions; the pH scale for measuring acidity/alkalinity; indicators.",
        "Reactions of acids with metals to produce a salt plus hydrogen, and with alkalis to produce a salt plus water.",
        "Energy changes on changes of state and in chemical reactions (exothermic and endothermic); what catalysts do.",
      ],
      note: {
        title: "Year 8: acids, alkalis and reactions",
        body: `## Reactions and word equations

In a chemical reaction atoms are **rearranged** to make new substances. A word equation shows the **reactants** on the left and the **products** on the right. Signs of a reaction: a gas given off, a colour change, a temperature change, or a solid forming.

## Acids and alkalis

The **pH scale** runs from 0 to 14. Below 7 is acidic, 7 is neutral and above 7 is alkaline. **Universal indicator** changes colour with pH: red for strong acid through green for neutral to purple for strong alkali.

- acid + metal → **salt + hydrogen** (calcium + hydrochloric acid → calcium chloride + hydrogen)
- acid + alkali → **salt + water** (this is **neutralisation**)
- acid + metal carbonate → salt + water + carbon dioxide

Salts are named from the metal and the acid: hydrochloric acid makes **chlorides**, sulfuric acid makes **sulfates**, nitric acid makes **nitrates**.

## Tests for gases

Hydrogen: a lit splint gives a **squeaky pop**. Oxygen: relights a **glowing splint**. Carbon dioxide: turns **limewater cloudy**.

## Energy changes

**Exothermic** reactions transfer energy to the surroundings (temperature rises), for example combustion. **Endothermic** reactions take energy in (temperature falls). A **catalyst** speeds a reaction up and is not used up.`,
      },
      quiz: {
        title: "Chemical Reactions (acids and alkalis): Year 8 quiz",
        questions: build("creact", 8, [
          sg("Look at the pH scale. Which letter shows a neutral substance?", "B", ["A", "C", "D"], "A neutral substance has pH 7, and it is marked by B.", 1, { d: true, img: IMG.ph }),
          sg("Look at the pH scale. Which letter shows the most alkaline substance?", "D", ["A", "B", "C"], "The higher the pH above 7, the more alkaline the substance. D is at pH 13.", 1, { img: IMG.ph }),
          sg("A few drops of substance D are added to a beaker of substance A. What happens to the pH of the mixture?", "It rises towards 7", ["It falls below 2", "It stays exactly 2", "It jumps straight to 13"], "An alkali neutralises an acid, so the pH moves towards neutral (7).", 2, { img: IMG.ph }),
          sg("Magnesium reacts with hydrochloric acid. Which are the products?", "Magnesium chloride and hydrogen", ["Magnesium oxide and water", "Magnesium chloride and carbon dioxide", "Magnesium hydroxide and oxygen"], "Acid + metal → salt + hydrogen. Hydrochloric acid makes chloride salts.", 2, { d: true }),
          sg("Which is the general word equation for neutralisation?", "acid + alkali → salt + water", ["acid + metal → salt + water", "acid + alkali → salt + hydrogen", "alkali + water → acid + salt"], "Neutralisation always makes a salt and water.", 1),
          sg("Hydrochloric acid reacts with sodium hydroxide. Which are the products?", "Sodium chloride and water", ["Sodium chloride and hydrogen", "Sodium oxide and hydrogen chloride", "Sodium hydroxide and chlorine"], "Acid + alkali → salt + water. Sodium with chloride gives sodium chloride.", 2),
          sg("What is the test for oxygen gas?", "It relights a glowing splint", ["It makes a squeaky pop with a lit splint", "It turns limewater cloudy", "It turns damp blue litmus paper red"], "Oxygen supports burning, so a glowing splint bursts into flame.", 1),
          sg("Which observation shows that a reaction is exothermic?", "The temperature of the surroundings rises", ["The temperature of the mixture falls", "A gas is given off", "A solid disappears"], "An exothermic reaction transfers energy to the surroundings, so they get warmer.", 2),
          sg("Which is an example of thermal decomposition?", "Heating green copper carbonate to give black copper oxide and carbon dioxide", ["Magnesium burning in air to make white magnesium oxide powder and give out light", "Iron rusting in damp air", "Zinc reacting with hydrochloric acid"], "Thermal decomposition is one substance breaking down into two or more when heated. Burning and rusting add oxygen.", 3),
          sg("What is a catalyst?", "A substance that speeds up a reaction and is not used up", ["A substance that is used up in the reaction to make it start", "A substance that slows a reaction down", "A product of the reaction"], "Catalysts provide a quicker route for the reaction and are unchanged at the end.", 2),
        ]),
      },
      flashcards: [
        { front: "pH of an acid, neutral, alkali", back: "Below 7; exactly 7; above 7." },
        { front: "acid + metal →", back: "salt + hydrogen." },
        { front: "acid + alkali →", back: "salt + water (neutralisation)." },
        { front: "acid + metal carbonate →", back: "salt + water + carbon dioxide." },
        { front: "Hydrochloric, sulfuric, nitric acid make which salts?", back: "Chlorides, sulfates, nitrates." },
        { front: "Test for hydrogen", back: "Lit splint: squeaky pop." },
        { front: "Test for oxygen", back: "Relights a glowing splint." },
        { front: "Test for carbon dioxide", back: "Turns limewater cloudy." },
        { front: "Exothermic vs endothermic", back: "Exothermic: energy out, temperature rises. Endothermic: energy in, temperature falls." },
        { front: "What is a catalyst?", back: "Speeds up a reaction without being used up." },
      ],
    },
    9: {
      year: 9,
      subtopic: "Year 9: reactivity, metals and conservation of mass",
      objectives: [
        "The order of metals and carbon in the reactivity series; metal displacement reactions.",
        "The extraction of metals and non-metals; oxidation and reduction in terms of gain or loss of oxygen.",
        "The reactions of metals with oxygen, water and acids.",
        "Conservation of mass in chemical reactions, including reactions in open and closed containers.",
      ],
      note: {
        title: "Year 9: the reactivity series and conservation of mass",
        body: `## The reactivity series

Metals can be put in order of reactivity: **potassium, sodium, calcium, magnesium, aluminium, (carbon), zinc, iron, lead, (hydrogen), copper, silver, gold**. Very reactive metals react with cold water; the middle ones react with acid; copper, silver and gold do not.

## Displacement

A more reactive metal takes the place of a less reactive metal in a compound: zinc + copper sulfate → zinc sulfate + copper. If the added metal is **less** reactive, there is **no reaction**.

## Extraction and oxidation

A metal below carbon can be extracted from its oxide by heating with carbon (**reduction**: loss of oxygen). More reactive metals such as aluminium need electrolysis. **Oxidation** is gain of oxygen.

## Conservation of mass

Atoms are not created or destroyed, so the total mass of reactants equals the total mass of products. In an **open** container a gas may escape, so the mass appears to fall.

## Worked example

15 g of calcium reacts with 6 g of oxygen. The mass of calcium oxide formed is 15 + 6 = **21 g**. If 4 g of hydrogen escaped from an open flask, the flask would be 4 g lighter.`,
      },
      quiz: {
        title: "Chemical Reactions (reactivity and mass): Year 9 quiz",
        questions: build("creact", 9, [
          nm("Look at the graph. What mass of gas escaped from the flask, in grams?", 2, "The mass fell from 150.0 g to 148.0 g. 150.0 − 148.0 = 2.0 g.", 1, { d: true, img: IMG.massloss }),
          sg("Look at the graph of the open flask. Why does the mass decrease?", "A gas made in the reaction escapes from the open flask", ["Atoms are destroyed in the reaction", "The acid is used up and disappears, so there is less liquid in the flask", "The flask becomes lighter as it warms"], "Mass is conserved, but this flask is open, so the carbon dioxide leaves.", 2, { d: true, img: IMG.massloss }),
          sg("Look at the graph. After how many minutes does the reaction stop?", "4", ["2", "3", "6"], "The mass stops changing at 4 minutes, so the reaction ends then.", 2, { img: IMG.massloss }),
          sg("Which of these metals is the most reactive?", "Magnesium", ["Copper", "Zinc", "Iron"], "In the reactivity series: magnesium, then zinc, then iron, then copper.", 1),
          sg("Iron is added to copper sulfate solution. What is formed?", "Iron sulfate and copper", ["Copper sulfate and iron", "Iron oxide and copper", "Nothing: there is no reaction"], "Iron is more reactive than copper, so it displaces copper from the compound.", 2),
          sg("Zinc metal is added to magnesium sulfate solution. What happens?", "There is no reaction, because zinc is less reactive than magnesium", ["Zinc displaces magnesium, forming zinc sulfate and a layer of magnesium metal", "Magnesium sulfate turns into zinc oxide", "A gas is given off"], "A metal can only displace a less reactive metal. Zinc is below magnesium.", 3),
          sg("Which metal could be extracted from its oxide by heating with carbon?", "Iron", ["Aluminium", "Calcium", "Sodium"], "Only metals less reactive than carbon can be extracted this way. Iron is below carbon.", 3),
          nm("12 g of magnesium burns completely with 8 g of oxygen. What mass of magnesium oxide is formed, in g?", 20, "Mass is conserved: 12 + 8 = 20 g.", 2),
          sg("Magnesium burns in air to make magnesium oxide. This is an example of…", "Oxidation", ["Reduction", "Neutralisation", "Displacement"], "Oxidation is the gain of oxygen, and magnesium gains oxygen.", 2),
          sg("Three different metals are added to the same volume of dilute acid to compare how vigorously they react. Which should be kept the same to make it a fair test?", "The concentration of the acid, the temperature and the size of the metal pieces", ["The type of metal, the volume of acid and the number of bubbles observed each minute", "The number of bubbles observed", "The colour of the metals"], "Only the metal (independent variable) should change; everything else that could affect the rate must be controlled.", 2),
        ]),
      },
      flashcards: [
        { front: "Reactivity series order", back: "K, Na, Ca, Mg, Al, (C), Zn, Fe, Pb, (H), Cu, Ag, Au." },
        { front: "Displacement reaction", back: "A more reactive metal takes the place of a less reactive metal in a compound." },
        { front: "Zinc + copper sulfate →", back: "zinc sulfate + copper." },
        { front: "Can a less reactive metal displace a more reactive one?", back: "No: there is no reaction." },
        { front: "Which metals can be extracted with carbon?", back: "Those below carbon, such as zinc, iron and lead." },
        { front: "Oxidation and reduction (in terms of oxygen)", back: "Oxidation is gain of oxygen; reduction is loss of oxygen." },
        { front: "Law of conservation of mass", back: "Total mass of reactants = total mass of products." },
        { front: "Why does an open flask lose mass?", back: "A gas produced escapes into the air." },
        { front: "Metal + oxygen →", back: "metal oxide." },
        { front: "Fair test in a reactivity experiment", back: "Change only the metal; keep acid volume, concentration, temperature and metal size the same." },
      ],
    },
  },
};
