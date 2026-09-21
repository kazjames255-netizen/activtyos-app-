// A-level Chemistry — Organic Chemistry Foundations (Year 12). Original content aligned to the DfE GCE AS/A-level chemistry subject content.
// Numerical keys are recomputed by _chk_c5org.ts (including a brute-force isomer count) — re-run _check_s6.ts after ANY edit here.
import type { CTopic } from "../types";
import { img, qb } from "./_h";

const q = qb("c5org", 12);
export const TOPIC: CTopic = {
  key: "c5org",
  topic: "Chemistry — Organic Chemistry Foundations",
  subject: "Science",
  years: {
    12: {
      year: 12,
      subtopic: "A-level Year 12 (AS)",
      objectives: [
        "Nomenclature, general formulae, structural and skeletal formulae; structural isomerism and E/Z stereoisomerism.",
        "Alkanes: fractional distillation, cracking, combustion, and free-radical substitution (initiation, propagation, termination).",
        "Alkenes: electrophilic addition, Markovnikov's rule and carbocation stability, tests for alkenes, addition polymers.",
        "Halogenoalkanes: nucleophilic substitution and elimination; rates of hydrolysis and C–X bond enthalpy.",
        "Alcohols: classification, oxidation with acidified dichromate(VI), reflux and distillation; percentage yield.",
      ],
      note: {
        title: "Alkanes, alkenes, halogenoalkanes and alcohols",
        body: `## Basics

Alkanes CₙH₂ₙ₊₂ are saturated; alkenes CₙH₂ₙ contain a C=C. **Structural isomers** have the same molecular formula but different structures. **E/Z isomerism** needs restricted rotation about C=C and two different groups on each carbon; the higher-priority groups (by atomic number) on the same side give **Z**, on opposite sides **E**.

## Reactions and mechanisms

| Reaction | Conditions | Mechanism |
| --- | --- | --- |
| Alkane + Cl₂ | UV light | free-radical substitution |
| Alkene + HBr, Br₂ | room temperature | electrophilic addition |
| Halogenoalkane + OH⁻(aq) → alcohol | warm, aqueous NaOH | nucleophilic substitution |
| Halogenoalkane + OH⁻ in ethanol → alkene | heat, ethanolic NaOH | elimination |
| Primary alcohol → aldehyde → acid | acidified K₂Cr₂O₇ (distil / reflux) | oxidation |

**Free radicals:** initiation Cl₂ → 2Cl• (UV, homolytic fission); propagation Cl• + CH₄ → CH₃• + HCl, then CH₃• + Cl₂ → CH₃Cl + Cl•; termination when two radicals meet.

**Markovnikov:** in an unsymmetrical alkene, H adds to the carbon with more H atoms, since the more substituted **carbocation** is more stable (alkyl groups release electron density).

**Hydrolysis rate:** C–I < C–Br < C–Cl in bond enthalpy, so iodoalkanes react fastest. **Alcohols:** primary and secondary can be oxidised (orange Cr₂O₇²⁻ → green Cr³⁺); **tertiary cannot**. Distil to stop at the aldehyde; reflux with excess oxidant to reach the carboxylic acid. Bromine water is decolourised by alkenes.

## Worked examples

**Mechanism:** but-1-ene + HCl. H⁺ adds to the CH₂ carbon, forming a secondary carbocation CH₃CH₂CH⁺CH₃; Cl⁻ attacks it to give **2-chlorobutane**.

**Yield:** 4.60 g ethanol (Mr 46.0) dehydrates to give 2.10 g ethene (Mr 28.0). n = 0.100 mol, so the theoretical mass is 2.80 g and the yield is 2.10 ÷ 2.80 × 100 = **75.0 %**.`,
      },
      quiz: {
        title: "Organic Chemistry Foundations: Year 12 quiz",
        questions: [
          q.single(1, "What is the molecular formula of the alkane with eight carbon atoms?", "C₈H₁₈", ["C₈H₁₆", "C₈H₂₀", "C₈H₁₄"],
            "Alkanes have the general formula CₙH₂ₙ₊₂. For n = 8 that is C₈H₁₈."),
          q.single(1, "What is the name of CH₃CH(CH₃)CH₂CH₃?", "2-methylbutane", ["3-methylbutane", "2-ethylpropane", "pentane"],
            "The longest chain has 4 carbons (butane). A methyl group sits on carbon 2 when numbered from the end that gives the lowest number, so 2-methylbutane."),
          q.single(2, "Four isomers of C₄H₈ are drawn. Which one shows E/Z isomerism?", "Structure C",
            ["Structure A", "Structure B", "Structure D"],
            "E/Z isomerism needs two different groups on each carbon of the C=C. Only but-2-ene (C) has CH₃ and H on both carbons. A has two identical CH₃ on one carbon and B has two H on one carbon; D has no double bond.",
            { diag: true, image: img("isomers-c4h8.png", "Four skeletal formulae labelled A to D, all C₄H₈. A: a central carbon with a double bond to one CH₂ and single bonds to two CH₃ groups. B: a four-carbon zigzag chain with the double bond at the very end (between carbons 1 and 2). C: a four-carbon chain with the double bond in the middle (between carbons 2 and 3) and the two end CH₃ groups drawn on the same side. D: a three-carbon ring (triangle) with a CH₃ group attached to one corner and no double bond.") }),
          q.single(3, "The major product of the reaction of HBr with propene is 2-bromopropane. What is the best explanation?", "The intermediate secondary carbocation is more stable than the primary carbocation because of electron-releasing alkyl groups",
            ["Bromine is more electronegative than hydrogen so it always adds to the end carbon", "The primary carbocation is more stable, so 1-bromopropane forms", "The reaction proceeds by free-radical substitution"],
            "H⁺ adds to the CH₂ carbon, giving CH₃CH⁺CH₃ (secondary). Two alkyl groups stabilise the positive charge better than one, so Br⁻ attacks that carbon."),
          q.single(1, "What is the result of adding bromine water to an alkene?", "The orange solution is decolourised", ["A white precipitate forms", "The solution turns green", "The solution turns from colourless to orange"],
            "Bromine adds across the C=C double bond, removing the orange colour and leaving a colourless dibromoalkane."),
          q.single(2, "Which equation represents a propagation step in the reaction of methane with chlorine?", "CH₃• + Cl₂ → CH₃Cl + Cl•",
            ["Cl₂ → 2Cl•", "CH₃• + Cl• → CH₃Cl", "Cl• + Cl• → Cl₂"],
            "A propagation step uses one radical and produces another. Cl₂ → 2Cl• is initiation, and the two equations in which two radicals combine are termination steps (two radicals removed).", { diag: true }),
          q.single(2, "Which reagent and conditions convert 1-bromobutane into butan-1-ol?", "Warm aqueous sodium hydroxide",
            ["Ethanolic potassium hydroxide, heated", "Concentrated sulfuric acid at 170 °C", "Acidified potassium dichromate(VI), reflux"],
            "Aqueous hydroxide acts as a nucleophile and substitutes the bromine by OH. Ethanolic KOH would cause elimination to but-1-ene."),
          q.single(2, "Which halogenoalkane is hydrolysed fastest by warm aqueous sodium hydroxide, and why?", "1-iodobutane, because the C–I bond is the weakest",
            ["1-chlorobutane, because the C–Cl bond is the most polar", "1-iodobutane, because iodine is the most electronegative halogen", "1-chlorobutane, because chlorine is the smallest halogen atom"],
            "The rate is set by the C–X bond breaking. C–I has the lowest bond enthalpy, so it breaks most easily even though C–Cl is more polar."),
          q.single(2, "Which alcohol cannot be oxidised by acidified potassium dichromate(VI)?", "2-methylpropan-2-ol", ["butan-1-ol", "butan-2-ol", "2-methylpropan-1-ol"],
            "A tertiary alcohol has no hydrogen on the carbon bearing the OH group, so it cannot be oxidised without breaking C–C bonds."),
          q.num(2, "5.00 g of cyclohexanol (C₆H₁₂O, Mr 100.0) is dehydrated to cyclohexene (C₆H₁₀, Mr 82.0). 2.87 g of cyclohexene is obtained. Calculate the percentage yield to 3 significant figures.", 70.0, 0.3,
            "n(cyclohexanol) = 5.00 ÷ 100.0 = 0.0500 mol, so the theoretical mass of cyclohexene = 0.0500 × 82.0 = 4.10 g. Yield = 2.87 ÷ 4.10 × 100 = 70.0 %."),
          q.num(3, "How many structural isomers (including branched chains) has the alkane C₆H₁₄?", 5, 0,
            "Hexane; 2-methylpentane; 3-methylpentane; 2,2-dimethylbutane; 2,3-dimethylbutane. That is five."),
          q.multi(2, "Which statements about cracking are correct?", ["Long-chain alkanes are broken into shorter alkanes and alkenes", "The alkenes produced can be used to make polymers"],
            ["Cracking joins small alkane molecules into longer chains", "Cracking only ever produces alkanes"],
            "Cracking breaks C–C bonds in large hydrocarbons, giving smaller, more useful alkanes and alkenes. The alkenes are the starting point for many polymers."),
          q.single(3, "1-bromo-2-chloroethene, BrCH=CHCl, has its Br and Cl atoms on opposite sides of the double bond. What is the name of this stereoisomer?", "(E)-1-bromo-2-chloroethene",
            ["(Z)-1-bromo-2-chloroethene", "cis-1-bromo-1-chloroethene", "(R)-1-bromo-2-chloroethene"],
            "On each carbon, the halogen has higher priority than H (larger atomic number). Higher-priority groups on opposite sides gives E (from the German entgegen)."),
          q.single(1, "Why can crude oil be separated by fractional distillation?", "Its hydrocarbons have different boiling points because of their different chain lengths",
            ["Its hydrocarbons have different colours, so the fractions can be seen separating", "Its hydrocarbons have different densities only, so the heavier ones sink in the column", "Its hydrocarbons react at different temperatures as the column is heated"],
            "Longer chains have stronger London forces and higher boiling points, so they condense lower in the column while short chains rise to the top."),
        ],
      },
      flashcards: [
        { front: "General formula: alkane, alkene", back: "Alkane CₙH₂ₙ₊₂; alkene CₙH₂ₙ." },
        { front: "Structural isomers", back: "Same molecular formula, different structural formulae." },
        { front: "Conditions for E/Z isomerism", back: "A C=C, and two different groups on each carbon of the double bond." },
        { front: "Three stages of free-radical substitution", back: "Initiation (UV, Cl₂ → 2Cl•), propagation (radical in, radical out), termination (two radicals combine)." },
        { front: "Electrophilic addition: order of carbocation stability", back: "Tertiary > secondary > primary; the more stable one gives the major product." },
        { front: "Test for an alkene", back: "Bromine water decolourises (orange → colourless)." },
        { front: "Repeat unit of poly(propene)", back: "–CH₂–CH(CH₃)–" },
        { front: "Nucleophilic substitution of a halogenoalkane", back: "Warm aqueous NaOH gives the alcohol; the OH⁻ lone pair attacks the δ+ carbon." },
        { front: "Ethanolic NaOH with a halogenoalkane, heated", back: "Elimination: an alkene forms." },
        { front: "Oxidation of alcohols with acidified K₂Cr₂O₇", back: "Primary → aldehyde (distil) → acid (reflux); secondary → ketone; tertiary: no reaction." },
      ],
    },
  },
};
