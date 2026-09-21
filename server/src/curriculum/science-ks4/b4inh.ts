// GCSE Biology — Inheritance, Variation & Evolution (Year 10: DNA, reproduction, inheritance; Year 11: variation, evolution, breeding, classification).
import type { CTopic } from "../types";
import { N, S, M, W, yr } from "./_h";
import { fracRecessive, punnett } from "./_imgdata";

const PUN = ["b4inh-punnett.png", "An empty 2 by 2 Punnett square grid. The two parents are both Cc. The gametes C and c are written across the top and C and c down the left side. The four boxes inside the grid are blank with question marks."] as [string, string];
const PED = ["b4inh-pedigree.png", "A family tree. Generation I is a man (square) and a woman (circle), both unshaded and unaffected. Generation II has three children: a daughter (circle) shaded to show she is affected, and two sons (squares) unshaded."] as [string, string];

export const TOPIC: CTopic = {
  key: "b4inh", topic: "Biology — Inheritance, Variation & Evolution", subject: "Science",
  years: {
    10: yr("b4inh", 10, {
      obj: [
        "Describe DNA as a double helix polymer; genes, alleles, chromosomes and the genome.",
        "Compare sexual and asexual reproduction; describe meiosis and fertilisation.",
        "Use the terms genotype, phenotype, dominant, recessive, homozygous and heterozygous.",
        "Complete and interpret Punnett squares; calculate probabilities and ratios.",
        "Describe sex determination (XX/XY) and inherited disorders (cystic fibrosis, polydactyly).",
        "Discuss embryo screening and gene testing.",
      ],
      note: ["GCSE Biology: DNA, meiosis and genetic crosses", `## DNA and genes
DNA is a double-helix polymer of nucleotides. The bases pair **A–T** and **C–G**. A **gene** is a section of DNA coding for a protein; the **genome** is all of an organism's DNA. Human body cells have 23 pairs (46) of chromosomes; **gametes** have 23.

## Reproduction
- **Asexual**: one parent, **mitosis**, identical clones.
- **Sexual**: **meiosis** makes four genetically different gametes (half the chromosomes); fertilisation restores the full number and creates **variation**.

## Genetic terms
| Term | Meaning |
| --- | --- |
| Allele | version of a gene |
| Genotype | the alleles present (Cc) |
| Phenotype | the characteristic shown |
| Homozygous / heterozygous | two the same / two different |
| Dominant | shown if at least one copy is present |

## Punnett square: Tt × Tt (pea height, T = tall)
Gametes T, t and T, t give offspring **TT, Tt, Tt, tt**: a **3 : 1** ratio of tall to dwarf, and a **25%** chance of tt. For a recessive disorder, heterozygous people are unaffected **carriers**.

## Worked example
Two carriers have three children. P(all three affected) = ¼ × ¼ × ¼ = 1/64 = **1.56%**. Each birth is independent, so past children do not change the next chance.

**Sex:** XX female, XY male; the chance of a boy or girl is 50% each time.`],
      quiz: "GCSE Biology: Inheritance quiz (Year 10)",
      qs: [
        S(1, "What is a gene?", "A section of DNA that codes for a particular protein", ["A type of cell that carries DNA to the next generation", "The whole set of chromosomes", "A protein that copies DNA"], "Each gene is a short section of DNA containing the code for one protein. The genome is all of an organism's DNA.", {}),
        S(1, "How many chromosomes are in a normal human gamete (sperm or egg)?", "23", ["46", "22", "92"], "Gametes are made by meiosis and carry half the chromosomes, 23. Fertilisation restores 46.", {}),
        S(1, "Which pair of sex chromosomes does a human male have?", "XY", ["XX", "YY", "XO"], "Females are XX and males are XY. The Y chromosome carries the gene that makes a foetus male.", {}),
        S(2, "Which describes the cells produced by meiosis?", "Four genetically different cells with half the number of chromosomes", ["Two identical cells with the full number of chromosomes", "Two genetically different cells with the full number of chromosomes", "Four genetically identical cells with half the number of chromosomes"], "Meiosis produces four gametes, each with half the chromosomes and a different mix of alleles.", {}),
        N(2, "Both parents are Cc, as shown in the grid (cystic fibrosis is caused by the recessive allele c). What percentage of their children are expected to have cystic fibrosis (cc)?", 25, 0.5, "The four boxes are CC, Cc, Cc and cc. Only 1 in 4 is cc, so 25%.", () => fracRecessive("Cc", "Cc") * 100, { img: PUN, diag: true }),
        N(2, "In the completed grid for the cross above, how many of the four boxes contain the genotype Cc?", 2, 0, "Combining C or c from each parent: CC, Cc, cC (written Cc) and cc. Two boxes are Cc.", () => punnett("Cc", "Cc").filter((g) => g === "Cc").length, { img: PUN }),
        S(2, "Which cross gives a 50% chance of a child with the recessive phenotype?", "Heterozygous × homozygous recessive", ["Heterozygous × heterozygous", "Homozygous dominant × homozygous recessive", "Homozygous dominant × heterozygous"], "Rr × rr gives Rr, Rr, rr, rr, so half are rr. Rr × Rr gives 25%, and the other two crosses give 0%.", { chk: () => { const X: Record<string, [string, string]> = { "Heterozygous × heterozygous": ["Rr", "Rr"], "Homozygous dominant × homozygous recessive": ["RR", "rr"], "Heterozygous × homozygous recessive": ["Rr", "rr"], "Homozygous dominant × heterozygous": ["RR", "Rr"] }; return Object.entries(X).filter(([, [a, b]]) => fracRecessive(a, b) === 0.5).map(([k]) => k).join("|"); } }),
        S(2, "A couple have had three daughters. What is the chance that their fourth child is a boy?", "50%", ["25%", "75%", "100%"], "Every birth is independent. The X or Y sperm that fertilises the egg is equally likely each time, so 50%.", { diag: true }),
        S(2, "What is an advantage of sexual reproduction over asexual reproduction?", "It produces variation, so some offspring may survive if the environment changes", ["It is faster because only one parent is needed", "It produces genetically identical offspring that are all well suited to the habitat", "It uses mitosis to produce gametes"], "Meiosis and fertilisation mix alleles, giving variation. Asexual clones are all vulnerable to the same disease or change.", {}),
        M(2, "Which statements about DNA are correct? Choose all that apply.", ["It is a double helix of two strands", "Base pairing is A with T and C with G"], ["It contains the base uracil", "A pairs with C and G pairs with T"], "DNA has two complementary strands. The base pairs are A–T and C–G. Uracil is found only in RNA.", {}),
        N(3, "A sample of DNA has 30% adenine. What percentage of its bases is guanine?", 20, 0.1, "A pairs with T, so T is also 30%. A + T = 60%, leaving 40% for C + G. C = G, so G = 20%.", () => (100 - 2 * 30) / 2),
        N(3, "Two parents are both carriers of cystic fibrosis (Cc). What is the percentage chance that their next two children will BOTH have cystic fibrosis?", 6.25, 0.06, "P(one child cc) = ¼. Two independent births: ¼ × ¼ = 1/16 = 6.25%.", () => fracRecessive("Cc", "Cc") ** 2 * 100),
        W("Explain how meiosis and fertilisation lead to genetic variation between offspring. [6 marks]", "Mark scheme (6): meiosis makes gametes (1); DNA is copied then the cell divides twice, giving four cells with half the chromosomes (1); each gamete gets a random mix of the chromosomes from each pair (independent assortment) (1); so gametes carry different combinations of alleles (1); at fertilisation any sperm can fuse with any egg at random (1); this restores the full chromosome number with a new combination of alleles from both parents (1)."),
      ],
      cards: [
        ["DNA base pairs", "A–T and C–G."],
        ["Gene vs genome", "Gene: section of DNA coding for a protein. Genome: all of an organism's DNA."],
        ["Chromosomes in human body cell / gamete", "46 in body cells; 23 in gametes."],
        ["Mitosis vs meiosis", "Mitosis: 2 identical cells (growth). Meiosis: 4 different gametes with half the chromosomes."],
        ["Genotype vs phenotype", "Genotype: alleles present. Phenotype: the characteristic seen."],
        ["Homozygous vs heterozygous", "Two identical alleles vs two different alleles."],
        ["Cc × Cc offspring", "CC : Cc : Cc : cc, so 3 : 1 phenotype ratio, 25% cc."],
        ["Carrier", "Heterozygous person with a recessive allele who does not show the disorder."],
        ["Human sex chromosomes", "Female XX, male XY; 50% chance each birth."],
        ["Cystic fibrosis inheritance", "Recessive allele; affects mucus in lungs and gut."],
        ["Polydactyly inheritance", "Extra fingers/toes; caused by a dominant allele."],
        ["Probability of two independent events", "Multiply the separate probabilities."],
      ],
    }),
    11: yr("b4inh", 11, {
      obj: [
        "Explain variation caused by genes and the environment, and mutation.",
        "Describe evolution by natural selection, speciation and the evidence (fossils, antibiotic resistance).",
        "Explain extinction and the effect of isolation.",
        "Describe selective breeding, genetic engineering and cloning (benefits, risks, ethics).",
        "Interpret family trees (pedigrees) to deduce dominant or recessive inheritance.",
        "Describe classification (Linnaeus, binomial names, three-domain system) and evolutionary trees.",
      ],
      note: ["GCSE Biology: variation, evolution and classification", `## Natural selection
1. Individuals show **variation** (genes, plus environment).
2. **Mutations** may create new alleles, occasionally giving an advantage.
3. Individuals with advantageous alleles are more likely to survive and reproduce (competition, predation, disease).
4. They pass those alleles to offspring, so the allele becomes more common over generations.

If two populations are **isolated** and become so different that they cannot breed to produce fertile offspring, a new **species** has formed (speciation). **Extinction** follows if a species cannot adapt to a new predator, disease, competitor or climate.

**Evidence:** fossils (an incomplete record because soft-bodied organisms rarely fossilise) and **antibiotic resistance** in bacteria.

## Breeding and engineering
- **Selective breeding**: choose parents with desired features, repeat over generations (risk: **inbreeding**, harmful alleles).
- **Genetic engineering**: a gene is cut out by enzymes and inserted into another organism using a vector (e.g. bacteria making human insulin; GM crops).

## Pedigrees
If two unaffected parents have an affected child, the allele must be **recessive** and both parents are carriers (**Aa**).

## Worked example
Dd × dd gives Dd, Dd, dd, dd, so half the children (**50%**) are expected to be dd.

**Classification:** Linnaeus's system groups by structure and names organisms by **genus + species** (*Homo sapiens*). Chemical analysis led to the three domains: archaea, bacteria and eukaryotes.`],
      quiz: "GCSE Biology: Inheritance, Variation & Evolution quiz (Year 11)",
      qs: [
        S(1, "Which of these is caused by the environment only, not by genes?", "A scar on the knee", ["Eye colour", "Blood group", "Being born with extra fingers"], "Scars come from injury. Eye colour, blood group and polydactyly are inherited.", {}),
        S(1, "What is selective breeding?", "Choosing parents with desired characteristics to breed together over many generations", ["Cutting out and changing genes using enzymes in a laboratory to give an organism new characteristics", "Producing identical copies of an organism", "Allowing animals to mate at random"], "Selective breeding uses artificial selection by humans, unlike natural selection.", {}),
        S(1, "Which is the correct binomial name for humans?", "Homo sapiens", ["Sapiens homo", "Homo humanus", "Humanus sapiens"], "The genus comes first with a capital letter, then the species in lower case: Homo sapiens (italic in print).", {}),
        S(2, "How did bacteria become resistant to an antibiotic?", "Random mutation gave some bacteria resistance; they survived the antibiotic and reproduced", ["The bacteria chose to change their genes so that the antibiotic could not harm them", "The antibiotic caused every bacterium to mutate and become resistant at the same time", "The bacteria became resistant during their lifetime and then passed this on to their offspring"], "Mutations occur at random. In the presence of the antibiotic, resistant bacteria survive, reproduce and pass on the allele: natural selection.", { diag: true }),
        S(2, "Why is the fossil record incomplete?", "Many organisms were soft-bodied and decayed, and many fossils have not been found", ["Fossils of all organisms are found in the same rock layer, so they cannot be dated", "Evolution stopped when the first fossils formed, so there are no later fossils", "All early fossils were destroyed by volcanoes, so only recent ones survive"], "Most organisms decay without forming fossils, and some fossils are destroyed or undiscovered, leaving gaps.", {}),
        S(2, "In the family tree, two unaffected parents have an affected daughter. What does this show about the allele for the condition?", "It is recessive", ["It is dominant", "It is on the Y chromosome", "It is carried only by males"], "If it were dominant, the unaffected parents would have no copy of it. So the allele is recessive and both parents carry it.", { img: PED, diag: true }),
        S(2, "Using A for the dominant allele and a for the recessive one, what are the genotypes of the two parents in the family tree?", "Both heterozygous", ["Both homozygous dominant", "Both homozygous recessive", "One homozygous dominant and one homozygous recessive"], "Their daughter is aa, so each parent passed an a. They are unaffected, so each also has an A: Aa.", { img: PED }),
        M(2, "Which statements about genetic engineering are correct? Choose all that apply.", ["Enzymes cut a gene out of one organism's DNA", "Bacteria can be engineered to make human insulin"], ["Genes are cut out using antibiotics", "It involves only breeding the best individuals"], "Restriction enzymes cut out the gene, which is put into a vector (plasmid or virus) and then into the host. Antibiotics do not cut DNA and selective breeding is a different process.", {}),
        S(2, "Why can a purebred dog breed suffer from more inherited health problems?", "A small gene pool from inbreeding makes harmful recessive alleles more likely to be inherited", ["Selective breeding causes new harmful mutations to appear in every generation", "Purebred dogs are exposed to more pathogens because they are kept in kennels", "Purebred dogs have fewer genes than mixed-breed dogs, so more of their organs fail"], "Breeding closely related dogs raises the chance both parents carry the same harmful recessive allele.", {}),
        N(3, "Two parents are both Aa. Their unaffected son wants to know the chance that he is a carrier (Aa). Give the percentage to 1 decimal place.", 66.7, 0.1, "The unaffected offspring are AA, Aa, Aa (the aa child is affected). 2 of these 3 are carriers: 2 ÷ 3 = 66.7%.", () => Math.round((punnett("Aa", "Aa").filter((g) => g === "Aa").length / punnett("Aa", "Aa").filter((g) => g !== "aa").length) * 1000) / 10),
        S(3, "Which sequence best describes how speciation can occur?", "Isolation → different selection pressures → different alleles become common → the populations can no longer produce fertile offspring together", ["Mutation → both populations become identical → interbreeding increases → one larger species forms", "Isolation → the environment stays the same → the alleles stay the same → the populations remain one species", "Cloning → variation increases → new alleles spread quickly → the population becomes a new species"], "Isolated populations experience different environments and evolve differently. When they cannot interbreed to produce fertile offspring they are separate species.", {}),
        S(3, "Why was the three-domain system introduced after Linnaeus's classification?", "Evidence from chemical analysis of cells (such as ribosomal RNA) showed new relationships", ["Scientists wanted to replace the Latin names with names in modern languages", "Fossil evidence showed that all living organisms belong to a single group", "So many new species were found that the old kingdoms became too large to use"], "Better evidence (DNA and RNA analysis, microscopes) revealed archaea as a separate group from bacteria, so the system was revised. Science changes with evidence.", {}),
        W("Peppered moths were mainly pale in 1800. After industrial pollution darkened the tree trunks, most moths were dark. Use natural selection to explain this change. [6 marks]", "Mark scheme (6): there is variation in the colour of moths (1); a mutation or existing allele gives dark colour (1); on dark trunks, pale moths are easier for predators (birds) to see and eat (1); dark moths survive and reproduce more (1); they pass on the dark allele to offspring (1); over many generations the dark allele becomes more common in the population (1)."),
      ],
      cards: [
        ["Two sources of variation", "Genes (inherited) and the environment; mutations create new alleles."],
        ["Natural selection in four steps", "Variation, competition, survival of those best adapted, they pass on alleles."],
        ["Antibiotic resistance evidence", "Mutation gives resistant bacteria; they survive treatment and reproduce."],
        ["Why is the fossil record incomplete?", "Soft bodies decay; some fossils destroyed or not yet found."],
        ["Speciation", "Isolated populations diverge until they cannot produce fertile offspring."],
        ["Selective breeding risk", "Inbreeding, smaller gene pool, harmful alleles more likely."],
        ["Genetic engineering steps", "Enzymes cut the gene, insert into a vector, transfer to host cell."],
        ["Two unaffected parents, affected child", "The allele is recessive; both parents are carriers."],
        ["Binomial name", "Genus (capital) + species (lower case), e.g. Homo sapiens."],
        ["Three domains", "Archaea, bacteria and eukaryota (based on chemical analysis)."],
        ["Extinction causes", "New predator, disease, competition, environmental change."],
        ["Why do GM crops raise concerns?", "Possible effects on wild plants and food chains, and ethical/health worries."],
      ],
    }),
  },
};
