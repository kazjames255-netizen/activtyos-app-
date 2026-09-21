// A-level Chemistry — Organic Chemistry Advanced (Year 13). Original content aligned to the DfE GCE AS/A-level chemistry subject content.
// Numerical keys are recomputed by _chk_c5org2.ts — re-run _check_s6.ts after ANY edit here.
import type { CTopic } from "../types";
import { img, qb } from "./_h";

const q = qb("c5org2", 13);
export const TOPIC: CTopic = {
  key: "c5org2",
  topic: "Chemistry — Organic Chemistry Advanced",
  subject: "Science",
  years: {
    13: {
      year: 13,
      subtopic: "A-level Year 13 (A2)",
      objectives: [
        "Aldehydes and ketones: oxidation and reduction, Tollens' and Fehling's tests, nucleophilic addition of HCN; optical isomerism and racemic mixtures.",
        "Carboxylic acids, esters and acyl compounds: esterification, hydrolysis and reduction.",
        "Aromatic chemistry: structure and stability of benzene; electrophilic substitution (nitration).",
        "Amines: basicity and nucleophilicity; amino acids.",
        "Condensation polymers (polyesters and polyamides) and multi-step organic synthesis, including nitriles.",
      ],
      note: {
        title: "Carbonyls, acids, benzene, amines, polymers and synthesis",
        body: `## Carbonyl compounds

Aldehydes (RCHO) and ketones (RCOR′) contain a polar C=O. **Aldehydes** are oxidised easily: Tollens' reagent gives a **silver mirror**, and Fehling's solution gives a **brick-red precipitate**. Ketones do not react. Both are reduced to alcohols by **NaBH₄**. Carboxylic acids need the stronger **LiAlH₄** (dry ether).

**Nucleophilic addition of HCN** (KCN with dilute acid): the CN⁻ lone pair attacks the δ⁺ carbon of C=O, the C=O π bond breaks onto oxygen, and H⁺ then protonates O to give a **hydroxynitrile**. The C=O is planar and attacked equally from either face, so a **racemic mixture** (equal amounts of two enantiomers, no optical activity) forms.

## Acids, esters and aromatics

Carboxylic acid + alcohol ⇌ ester + water (conc. H₂SO₄ catalyst, reflux). Esters are hydrolysed by heating with dilute acid or alkali.

**Benzene** has a ring of delocalised π electrons, so it is more stable than a hypothetical cyclohexatriene and undergoes **electrophilic substitution**, keeping the ring intact. **Nitration:** conc. HNO₃ with conc. H₂SO₄ at about 50 °C; the electrophile is NO₂⁺.

## Amines, polymers and synthesis

Amines are bases and nucleophiles because of the N lone pair. Basic strength: ethylamine > ammonia > phenylamine (the ring draws the lone pair in). **Condensation polymers** form with loss of a small molecule: polyamides (diamine + dicarboxylic acid) and polyesters (diol + dicarboxylic acid).

Nitriles add one carbon: RBr + KCN → RCN, and hydrolysis with dilute acid gives RCOOH.

## Worked example

Ethyl ethanoate: 6.00 g ethanoic acid (Mr 60.0) with excess ethanol gives 5.28 g ester (Mr 88.0).
n(acid) = 0.100 mol, so the theoretical mass = 0.100 × 88.0 = 8.80 g.
Yield = 5.28 ÷ 8.80 × 100 = **60.0 %**.`,
      },
      quiz: {
        title: "Organic Chemistry Advanced: Year 13 quiz",
        questions: [
          q.single(1, "A compound gives a silver mirror when warmed with Tollens' reagent. Which functional group must it contain?", "An aldehyde group", ["A ketone group", "A carboxylic acid group", "An alkene group"],
            "Aldehydes are oxidised to carboxylic acids, which reduces Ag⁺ to silver. Ketones are not oxidised by Tollens' reagent."),
          q.single(2, "Four compounds are drawn. Which one would give a silver mirror when warmed with Tollens' reagent?", "Structure B",
            ["Structure A", "Structure C", "Structure D"],
            "Only the aldehyde, propanal (B), is oxidised. Propanone (A) is a ketone, propan-1-ol (C) is not oxidised by Tollens' reagent, and the ester (D) is unreactive.",
            { diag: true, image: img("carbonyls.png", "Four skeletal formulae labelled A to D. A: a three-carbon chain with a double-bonded O on the middle carbon. B: a three-carbon chain in which the end carbon carries a double-bonded O and a hydrogen. C: a three-carbon chain with an OH group on the end carbon. D: a two-carbon unit with a double-bonded O on the second carbon and, also on that carbon, an O–CH₃ group (an ester).") }),
          q.single(2, "In the reaction of propanal with HCN (with a little KCN present), which species acts as the nucleophile?", "CN⁻", ["H⁺", "HCN", "The C=O carbon atom"],
            "The cyanide ion uses its lone pair on carbon to attack the δ⁺ carbon of the C=O. HCN itself is too weak an acid to supply enough CN⁻ alone, so KCN is added."),
          q.single(2, "Which of these alcohols contains a chiral carbon atom?", "Butan-2-ol", ["Propan-2-ol", "Butan-1-ol", "2-methylpropan-2-ol"],
            "In butan-2-ol, C2 is bonded to four different groups (H, OH, CH₃ and CH₂CH₃). In the others no carbon has four different groups.", { diag: true }),
          q.single(3, "Propanal reacts with HCN to form 2-hydroxybutanenitrile, which is not optically active. Why?", "The planar C=O is attacked equally from both sides, giving a racemic mixture of two enantiomers",
            ["The product has no chiral centre", "Cyanide ions always attack from one side only, so a single enantiomer forms and the product rotates plane-polarised light", "The product molecules are symmetrical"],
            "The product does have a chiral carbon, but the planar carbonyl carbon is attacked equally from above and below, so equal amounts of both enantiomers form and their effects on plane-polarised light cancel."),
          q.num(3, "The enthalpy change of hydrogenation of cyclohexene is −120 kJ mol⁻¹; that of benzene to cyclohexane is −208 kJ mol⁻¹. Calculate the delocalisation energy of benzene in kJ mol⁻¹ (the extra stability compared with a hypothetical structure with three separate C=C bonds).", 152, 0,
            "Three localised C=C bonds would give 3 × (−120) = −360 kJ mol⁻¹. The actual value is −208, so benzene is more stable by 360 − 208 = 152 kJ mol⁻¹."),
          q.single(1, "Which reagents and conditions are used to nitrate benzene?", "Concentrated nitric acid and concentrated sulfuric acid at about 50 °C",
            ["Dilute nitric acid at room temperature", "Concentrated hydrochloric acid and zinc", "Sodium nitrite and dilute acid at 0 °C"],
            "The concentrated acids generate the electrophile NO₂⁺. Keeping the temperature near 50 °C limits further nitration."),
          q.single(2, "Why does benzene undergo substitution rather than addition reactions?", "Substitution keeps the stable delocalised π system intact, but addition would destroy it",
            ["Benzene has no π electrons", "Benzene is too small to react by addition", "The C–H bonds in benzene are much weaker than its C=C bonds, so hydrogen atoms are replaced before the ring can add anything"],
            "Addition would break the delocalisation, losing about 152 kJ mol⁻¹ of stability. In substitution, an H is replaced and the ring's delocalisation is restored."),
          q.single(2, "Which list places these compounds in order of decreasing basic strength?", "Ethylamine > ammonia > phenylamine",
            ["Phenylamine > ammonia > ethylamine", "Ammonia > ethylamine > phenylamine", "Ethylamine > phenylamine > ammonia"],
            "The ethyl group donates electron density to N, making the lone pair more available. In phenylamine the lone pair is delocalised into the ring, making it less available."),
          q.single(1, "Which pair of monomers forms the polyamide nylon-6,6 by condensation polymerisation?", "Hexane-1,6-diamine and hexanedioic acid",
            ["Hexane-1,6-diol and hexanedioic acid", "Hexanoic acid and hexylamine", "Ethene and chloroethene"],
            "A polyamide contains –CONH– links from an amine and a carboxylic acid (or acyl chloride). A diol with a diacid would make a polyester."),
          q.single(1, "Ethanol reacts with propanoic acid in the presence of a concentrated sulfuric acid catalyst. What is the name of the ester formed?", "Ethyl propanoate", ["Propyl ethanoate", "Ethyl ethanoate", "Propanoyl ethanol"],
            "The alcohol supplies the alkyl part named first (ethyl) and the acid supplies the second part (propanoate)."),
          q.num(2, "2.00 g of salicylic acid (C₇H₆O₃) is reacted with excess ethanoic anhydride to make aspirin (C₉H₈O₄) in a 1 : 1 reaction. 1.85 g of aspirin is obtained. Calculate the percentage yield to 3 significant figures. (Ar: C 12.0, H 1.0, O 16.0)", 70.9, 0.3,
            "Mr(salicylic acid) = 138.0, so n = 2.00 ÷ 138.0 = 0.01449 mol. Theoretical aspirin = 0.01449 × 180.0 = 2.609 g. Yield = 1.85 ÷ 2.609 × 100 = 70.9 %."),
          q.written(3, "Devise a two-step synthesis of butanoic acid from 1-bromopropane. For each step give the reagents, conditions, and the type of reaction. (5 marks)",
            "Step 1: 1-bromopropane + KCN in ethanol/water, heated under reflux (nucleophilic substitution) → butanenitrile, CH₃CH₂CH₂CN. Step 2: reflux the nitrile with dilute hydrochloric (or sulfuric) acid (hydrolysis) → butanoic acid.",
            "Mark scheme (5): (1) KCN (in ethanol/aqueous ethanol) (1); (2) heat under reflux (1); (3) nucleophilic substitution giving butanenitrile CH₃CH₂CH₂CN (1); (4) hydrolysis with dilute HCl or H₂SO₄ under reflux (1); (5) butanoic acid CH₃CH₂CH₂COOH formed; the chain has been lengthened by one carbon (1). Accept alkaline hydrolysis then acidification.", 5),
          q.single(2, "Which reagent can reduce butanoic acid to butan-1-ol?", "Lithium tetrahydridoaluminate(III), LiAlH₄, in dry ether",
            ["Sodium tetrahydridoborate(III), NaBH₄, in water", "Acidified potassium dichromate(VI)", "Tollens' reagent"],
            "Carboxylic acids are resistant to NaBH₄, which reduces only aldehydes and ketones. The more powerful LiAlH₄ in dry ether reduces the acid to a primary alcohol."),
        ],
      },
      flashcards: [
        { front: "Test that distinguishes aldehydes from ketones", back: "Tollens' reagent (silver mirror) or Fehling's solution (brick-red precipitate) with aldehydes only." },
        { front: "Reducing agents: NaBH₄ vs LiAlH₄", back: "NaBH₄ reduces aldehydes and ketones; LiAlH₄ (dry ether) also reduces carboxylic acids and esters." },
        { front: "Mechanism of HCN with a carbonyl", back: "Nucleophilic addition by CN⁻, then protonation, giving a hydroxynitrile." },
        { front: "Why is the product of HCN addition to an aldehyde racemic?", back: "Planar C=O attacked equally from both faces, giving equal amounts of both enantiomers." },
        { front: "Chiral carbon", back: "A carbon bonded to four different groups; gives optical isomers." },
        { front: "Esterification", back: "Carboxylic acid + alcohol ⇌ ester + water, conc. H₂SO₄ catalyst, reflux." },
        { front: "Evidence for delocalisation in benzene", back: "Less exothermic hydrogenation than 3 × cyclohexene; all C–C bonds equal in length; substitution not addition." },
        { front: "Nitration of benzene", back: "Conc. HNO₃ + conc. H₂SO₄, about 50 °C; electrophile NO₂⁺." },
        { front: "Basic strength of amines", back: "Ethylamine > ammonia > phenylamine (lone pair delocalised into ring)." },
        { front: "Condensation polymers", back: "Polyamide: diamine + diacid. Polyester: diol + diacid. A small molecule (H₂O or HCl) is lost." },
      ],
    },
  },
};
