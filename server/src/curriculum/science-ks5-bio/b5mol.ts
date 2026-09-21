// A-level Biology — Biological Molecules (Year 12). Original content aligned to the DfE GCE AS/A-level biology subject content.
// Computable keys are recomputed by _check_s5.ts.
import type { CTopic } from "../types";

export const TOPIC: CTopic = {
  key: "b5mol",
  topic: "Biology — Biological Molecules",
  subject: "Science",
  years: {
    12: {
      year: 12,
      subtopic: "A-level Year 12 (AS)",
      objectives: [
        "Monomers and polymers; condensation and hydrolysis reactions.",
        "Structure and function of monosaccharides, disaccharides and polysaccharides (starch, glycogen, cellulose).",
        "Structure and properties of triglycerides and phospholipids.",
        "Amino acids, peptide bonds and the four levels of protein structure.",
        "Nucleotides, ATP, and the properties of water and inorganic ions.",
        "Biochemical tests and chromatography (Rf values).",
      ],
      note: {
        title: "Biological molecules: monomers, polymers and how to test for them",
        body: `## Building big molecules from small ones

Cells make **polymers** by joining **monomers** in **condensation** reactions (a molecule of water is released each time). **Hydrolysis** reverses this by adding water.

| Term | What you must know |
| --- | --- |
| Glycosidic bond | Joins monosaccharides (e.g. α-glucose + α-glucose → maltose) |
| Ester bond | Joins glycerol and a fatty acid |
| Peptide bond | Joins amino acids in a polypeptide |
| Phosphodiester bond | Joins nucleotides in DNA and RNA |
| Hydrogen bond | Weak, but many together hold the DNA helix and protein folds |

## Carbohydrates, lipids, proteins

- **Starch** (amylose helix + branched amylopectin) and **glycogen** (more highly branched) are made of α-glucose and store energy. **Cellulose** is made of β-glucose: alternate units are inverted, so straight chains form hydrogen bonds with neighbours and build strong microfibrils.
- A **triglyceride** is glycerol plus three fatty acids (three ester bonds). A **phospholipid** has a hydrophilic phosphate head and two hydrophobic tails. **Unsaturated** fatty acids contain C=C double bonds.
- **Proteins:** primary = amino-acid sequence; secondary = α-helix or β-pleated sheet; tertiary = 3-D shape held by hydrogen, ionic and disulphide bonds and hydrophobic interactions; quaternary = several polypeptides.

## Tests

Reducing sugar: heat with Benedict's (blue → green → orange → brick red). Starch: iodine (blue-black). Protein: biuret (blue → purple). Lipid: ethanol emulsion test (cloudy white).

## Worked calculation: Rf

Rf = distance moved by the spot ÷ distance moved by the solvent front (no units).
A solvent front moved 8.0 cm and a spot moved 3.2 cm, so Rf = 3.2 ÷ 8.0 = **0.40**.

A polypeptide of 50 amino acids has 50 − 1 = **49 peptide bonds**, formed by 49 condensation reactions.`,
      },
      quiz: {
        title: "Biological molecules: Year 12 quiz",
        questions: [
          { key: "b5mol-y12-01", kind: "single", prompt: "Which bond forms between two monosaccharides in a condensation reaction?", options: ["Peptide bond", "Ester bond", "Glycosidic bond", "Hydrogen bond"], answer: "Glycosidic bond", explanation: "Monosaccharides are joined by glycosidic bonds; peptide bonds join amino acids and ester bonds join glycerol to fatty acids.", difficulty: 1 },
          { key: "b5mol-y12-02", kind: "single", prompt: "Which method correctly tests a sample for a reducing sugar?", options: ["Heat with Benedict's reagent and look for a change from blue to green, yellow, orange or brick red", "Add iodine solution and look for a blue-black colour developing after gentle heating", "Add ethanol, then water, and look for a cloudy white emulsion at the top of the liquid", "Add sodium hydroxide and dilute copper sulfate and look for a purple colour"], answer: "Heat with Benedict's reagent and look for a change from blue to green, yellow, orange or brick red", explanation: "Benedict's reagent is heated with the sample; reducing sugars reduce copper(II) to copper(I) oxide, giving a coloured precipitate.", difficulty: 1 },
          { key: "b5mol-y12-03", kind: "multi", prompt: "Which of these are polysaccharides? Choose all that apply.", options: ["Starch", "Maltose", "Glycogen", "Sucrose", "Cellulose"], answer: ["Starch", "Glycogen", "Cellulose"], explanation: "Starch, glycogen and cellulose are long polymers of glucose. Maltose and sucrose are disaccharides.", difficulty: 1 },
          { key: "b5mol-y12-04", kind: "single", prompt: "Which feature of cellulose makes it suitable for strengthening plant cell walls?", options: ["Highly branched chains with many 1,6 glycosidic bonds that give a compact structure", "A coiled helix of α-glucose held by hydrogen bonds inside the helix", "Peptide bonds between its glucose units that hold the chains rigidly together", "Straight chains of β-glucose, with hydrogen bonds between parallel chains forming microfibrils"], answer: "Straight chains of β-glucose, with hydrogen bonds between parallel chains forming microfibrils", explanation: "Alternate β-glucose units are inverted, giving straight chains; many hydrogen bonds between chains form strong microfibrils.", difficulty: 2 },
          { key: "b5mol-y12-05", kind: "number", prompt: "How many molecules of water are released when one triglyceride molecule is formed from glycerol and fatty acids?", answer: 3, explanation: "Each of the three fatty acids joins glycerol by a condensation reaction forming an ester bond, releasing one water each.", difficulty: 2, diagnostic: true },
          { key: "b5mol-y12-06", kind: "short", prompt: "Name the strong covalent bond that can form between the R groups of two cysteine residues and helps to hold a protein's tertiary structure.", answer: "disulphide bond", accepted: ["disulphide", "disulfide", "disulphide bridge", "disulfide bond", "disulfide bridge", "disulphide bonds", "disulfide bonds", "disulphide bridges", "disulfide bridges", "disulphide link", "disulfide link", "a disulphide bond", "a disulfide bond", "disulphide bond."], explanation: "Cysteine contains sulfur; the sulfur atoms of two cysteines link to form a disulphide bridge.", difficulty: 2 },
          { key: "b5mol-y12-07", kind: "number", prompt: "The solvent front moved 10.0 cm from the origin. Use the chromatogram to calculate the Rf value of amino acid Q. Give your answer to 2 decimal places.", answer: 0.39, tolerance: 0.01, explanation: "Rf = distance moved by the spot ÷ distance moved by the solvent front = 3.9 ÷ 10.0 = 0.39.", difficulty: 2, diagnostic: true, image: { file: "mol-chromatogram.png", alt: "A paper chromatogram with lanes P, Q, R, S and a mixture. The origin line is at 0 cm and the solvent front at 10 cm on a ruler. Spots are at about 6.5 cm (P), 3.9 cm (Q), 8.2 cm (R) and 2.1 cm (S). The mixture lane has two spots, at 3.9 cm and 8.2 cm." } },
          { key: "b5mol-y12-08", kind: "multi", prompt: "Look at the same chromatogram. Which known amino acids are present in the mixture?", options: ["Amino acid P", "Amino acid Q", "Amino acid R", "Amino acid S"], answer: ["Amino acid Q", "Amino acid R"], explanation: "Spots in the mixture lane line up with the known spots at the same height: Q (3.9 cm) and R (8.2 cm).", difficulty: 2, image: { file: "mol-chromatogram.png", alt: "A paper chromatogram with lanes P, Q, R, S and a mixture. The origin line is at 0 cm and the solvent front at 10 cm on a ruler. Spots are at about 6.5 cm (P), 3.9 cm (Q), 8.2 cm (R) and 2.1 cm (S). The mixture lane has two spots, at 3.9 cm and 8.2 cm." } },
          { key: "b5mol-y12-09", kind: "number", prompt: "How many different tripeptides (chains of three amino acids in a fixed order) could be made from the 20 different amino acids if each can be used any number of times?", answer: 8000, explanation: "Each of the three positions can hold any of 20 amino acids: 20 × 20 × 20 = 8000.", difficulty: 3 },
          { key: "b5mol-y12-10", kind: "single", prompt: "In sickle-cell anaemia a single amino acid in the β-globin polypeptide is replaced by a different one. What is the direct consequence for the protein's structure?", options: ["The peptide bonds are broken, so the polypeptide splits into two chains at the changed amino acid", "The primary structure changes, which alters the bonding between R groups and so the folded 3-D shape", "The quaternary structure is lost because the haem group is removed", "Only the secondary structure changes because hydrogen bonds cannot form between the new R groups"], answer: "The primary structure changes, which alters the bonding between R groups and so the folded 3-D shape", explanation: "A different amino acid is a change in primary structure; different R groups form different interactions, altering tertiary structure and function.", difficulty: 3 },
          { key: "b5mol-y12-11", kind: "single", prompt: "Why is glycogen better suited than starch as the main carbohydrate store in mammals?", options: ["It is made of β-glucose, which is more compact and so can be stored in larger amounts", "It is soluble, so it can be carried in the blood to cells", "It is highly branched, so many ends can be hydrolysed at once to release glucose quickly", "It has peptide bonds that release energy more slowly when they are hydrolysed"], answer: "It is highly branched, so many ends can be hydrolysed at once to release glucose quickly", explanation: "More branching means more free ends for enzymes to act on at once, and mammals have a high metabolic rate. Glycogen is insoluble and made of α-glucose.", difficulty: 3 },
          { key: "b5mol-y12-12", kind: "multi", prompt: "Which statements about ATP are correct? Choose all that apply.", options: ["It contains the pentose sugar ribose", "It is hydrolysed to ADP and inorganic phosphate, releasing energy", "It is a long-term energy store kept in large amounts in cells", "Its phosphate groups are joined by peptide bonds", "It contains the base thymine"], answer: ["It contains the pentose sugar ribose", "It is hydrolysed to ADP and inorganic phosphate, releasing energy"], explanation: "ATP is adenine + ribose + three phosphates. It is an immediate, not long-term, energy source; it has no peptide bonds or thymine.", difficulty: 2 },
          { key: "b5mol-y12-13", kind: "single", prompt: "Which property of water, due to hydrogen bonding between molecules, makes it an effective coolant when sweat evaporates?", options: ["A high latent heat of vaporisation", "A low specific heat capacity", "It is a good solvent for polar substances", "A low surface tension"], answer: "A high latent heat of vaporisation", explanation: "Many hydrogen bonds must be broken for water to evaporate, so evaporation removes a lot of heat from the surface.", difficulty: 2 },
          { key: "b5mol-y12-14", kind: "written", prompt: "Describe the four levels of protein structure and explain how a change in the primary structure of an enzyme could stop it working. (6 marks)", answer: "See mark scheme in the explanation.", explanation: "Mark scheme (6 marks, 1 each): primary = sequence of amino acids joined by peptide bonds; secondary = α-helix/β-pleated sheet formed by hydrogen bonds; tertiary = further folding into a specific 3-D shape held by hydrogen, ionic and disulphide bonds and hydrophobic interactions; quaternary = two or more polypeptides (or a prosthetic group) combined; a change in primary structure changes which R groups interact so tertiary structure alters; the active site changes shape so the substrate no longer fits/enzyme-substrate complexes cannot form.", difficulty: 3 },
        ],
      },
      flashcards: [
        { front: "Condensation vs hydrolysis", back: "Condensation joins monomers and releases water; hydrolysis breaks bonds using water." },
        { front: "Bond joining two monosaccharides", back: "Glycosidic bond." },
        { front: "Bond joining amino acids", back: "Peptide bond." },
        { front: "Bond joining glycerol and a fatty acid", back: "Ester bond." },
        { front: "Why is cellulose strong?", back: "Straight β-glucose chains with many hydrogen bonds between chains form microfibrils." },
        { front: "Amylopectin and glycogen differ how?", back: "Both are α-glucose with 1,4 and 1,6 bonds; glycogen is more highly branched." },
        { front: "Phospholipid structure", back: "Hydrophilic phosphate head, two hydrophobic fatty-acid tails." },
        { front: "Four levels of protein structure", back: "Primary (sequence), secondary (helix/sheet), tertiary (3-D fold), quaternary (several chains)." },
        { front: "Test for protein", back: "Biuret reagent: blue to purple." },
        { front: "Rf formula", back: "Distance moved by spot ÷ distance moved by solvent front (no units)." },
        { front: "What is ATP made of?", back: "Adenine, ribose and three phosphate groups." },
      ],
    },
  },
};
