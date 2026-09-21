// A-level Biology — Biodiversity & Classification (Year 12). Original content aligned to the DfE GCE AS/A-level biology subject content.
// Computable keys recomputed by _check_s5.ts.
import type { CTopic } from "../types";

const TREE_ALT = "A branching tree diagram (a phylogenetic tree) with four species at the tips. Species W and Species X branch from a common point close to the tips. Species Y joins the W–X branch slightly further back. Species Z branches off from the very first split at the root, with the longest branch. A scale bar shows 4 base differences.";

export const TOPIC: CTopic = {
  key: "b5div",
  topic: "Biology — Biodiversity & Classification",
  subject: "Science",
  years: {
    12: {
      year: 12,
      subtopic: "A-level Year 12 (AS)",
      objectives: [
        "Species, genetic and ecosystem diversity; measuring diversity with species richness and an index of diversity.",
        "Random sampling techniques and the use of quadrats and transects.",
        "Adaptation and natural selection as a source of biodiversity.",
        "Classification: binomial naming, the three domains and five kingdoms, phylogenetic relationships from DNA and protein comparisons, and courtship behaviour.",
      ],
      note: {
        title: "Biodiversity and classification",
        body: `## Measuring biodiversity

**Biodiversity** can be described at three levels: **species diversity** (number and abundance of species), **genetic diversity** (variety of alleles within a species) and **ecosystem diversity** (variety of habitats). **Species richness** is simply the number of different species. It ignores how many individuals there are of each, so an **index of diversity** is often better:

**D = 1 − Σ(n ÷ N)²**

where n is the number of individuals of one species and N is the total number of individuals. D runs from 0 (no diversity) to 1 (infinite diversity). A higher D means more species and a more even spread of individuals.

| Term | Meaning |
| --- | --- |
| Species richness | Number of different species in a community |
| Random sampling | Using random coordinates to avoid bias |
| Transect | A line along which samples are taken to show change along a gradient |
| Binomial name | Genus (capital) then species, in italics, e.g. *Homo sapiens* |
| Phylogeny | Evolutionary relationships between organisms |

## Classification

Species are placed in a hierarchy: domain, kingdom, phylum, class, order, family, genus, species. The **three domains** are Bacteria, Archaea and Eukarya. Relationships are now worked out from DNA base sequences and amino-acid sequences of proteins (such as cytochrome c): the more differences, the longer ago the species diverged. **Courtship behaviour** is species-specific, so it helps to keep species reproductively isolated.

## Adaptation and natural selection

Adaptations may be **anatomical**, **physiological** or **behavioural**. Random mutation produces new alleles; individuals with advantageous alleles survive and reproduce more, so the allele frequency rises over generations.

## Worked calculation

A pond sample has 30 water beetles, 15 snails and 5 leeches (N = 50).
Σ(n ÷ N)² = 0.6² + 0.3² + 0.1² = 0.36 + 0.09 + 0.01 = 0.46.
D = 1 − 0.46 = **0.54**.`,
      },
      quiz: {
        title: "Biodiversity and classification: Year 12 quiz",
        questions: [
          { key: "b5div-y12-01", kind: "single", prompt: "Which best describes genetic diversity?", options: ["The number of different species in a habitat", "The number of different habitats in an area", "The variety of alleles within the gene pool of a species", "The total number of individuals in a population"], answer: "The variety of alleles within the gene pool of a species", explanation: "Genetic diversity is the range of alleles in a species. The other options describe species richness, ecosystem diversity and population size.", difficulty: 1 },
          { key: "b5div-y12-02", kind: "single", prompt: "In the scientific name Panthera leo, what does 'Panthera' represent?", options: ["The genus", "The species", "The family", "The kingdom"], answer: "The genus", explanation: "A binomial name has the genus first (capital letter) and the species second.", difficulty: 1 },
          { key: "b5div-y12-03", kind: "multi", prompt: "Which are domains in the three-domain system of classification?", options: ["Bacteria", "Archaea", "Fungi", "Eukarya", "Protoctista"], answer: ["Bacteria", "Archaea", "Eukarya"], explanation: "The three domains are Bacteria, Archaea and Eukarya. Fungi and Protoctista are kingdoms within Eukarya.", difficulty: 1 },
          { key: "b5div-y12-04", kind: "number", prompt: "A sample contains 10 individuals of species A, 6 of species B and 4 of species C. Using D = 1 − Σ(n/N)², calculate the index of diversity.", answer: 0.62, tolerance: 0.005, explanation: "N = 20. Σ(n/N)² = 0.5² + 0.3² + 0.2² = 0.25 + 0.09 + 0.04 = 0.38, so D = 1 − 0.38 = 0.62.", difficulty: 2, diagnostic: true },
          { key: "b5div-y12-05", kind: "single", prompt: "Site A has an index of diversity of 0.85 and site B has 0.32. Which conclusion is best supported?", options: ["Site B is more diverse because a lower value means more species", "The sites have the same number of species but a different total number of individuals", "Site A has fewer species because a higher value of D means lower species richness", "Site A is more diverse: it probably has more species and/or a more even spread of individuals"], answer: "Site A is more diverse: it probably has more species and/or a more even spread of individuals", explanation: "A higher index of diversity indicates greater diversity: more species and/or more even abundance. It does not give the exact number of species.", difficulty: 2 },
          { key: "b5div-y12-06", kind: "single", prompt: "A student wants to compare plant species in a field using quadrats without bias. What is the best method?", options: ["Place quadrats where the plants look most interesting and easy to identify", "Place quadrats at random positions found using random numbers for grid coordinates", "Place all the quadrats in a straight line at one edge of the field", "Use a single large quadrat placed in the centre and count everything inside it"], answer: "Place quadrats at random positions found using random numbers for grid coordinates", explanation: "Random coordinates remove selection bias. A transect would be chosen instead to investigate change along a gradient.", difficulty: 2 },
          { key: "b5div-y12-07", kind: "single", prompt: "According to the tree, which two species share the most recent common ancestor?", options: ["W and Y", "X and Z", "W and X", "Y and Z"], answer: "W and X", explanation: "W and X branch from the most recent (rightmost) shared node, so they share the most recent common ancestor.", difficulty: 2, diagnostic: true, image: { file: "div-tree.png", alt: TREE_ALT } },
          { key: "b5div-y12-08", kind: "number", prompt: "Two species have their cytochrome c genes compared. Of 600 bases compared, 48 differ. What is the percentage similarity of the sequences?", answer: 92, explanation: "Bases the same = 600 − 48 = 552; 552 ÷ 600 × 100 = 92%.", difficulty: 2 },
          { key: "b5div-y12-09", kind: "single", prompt: "Why can differences in courtship behaviour help to define separate species?", options: ["Courtship behaviour is species-specific, so members of different species do not recognise each other as mates and cannot interbreed", "Courtship makes different species compete for food, so they cannot share a habitat and are forced into separate niches", "Courtship changes the number of chromosomes in the gametes of each species, so any offspring that form cannot develop past the embryo stage", "Courtship causes mutations in the gametes, so the offspring are always infertile"], answer: "Courtship behaviour is species-specific, so members of different species do not recognise each other as mates and cannot interbreed", explanation: "A species is a group of organisms that can interbreed to produce fertile offspring; different courtship means reproductive isolation.", difficulty: 2 },
          { key: "b5div-y12-10", kind: "short", prompt: "What term describes the number of different species in a community?", answer: "species richness", accepted: ["richness", "species richness.", "species-richness", "the species richness", "richness of species"], explanation: "Species richness is the count of different species and ignores how many individuals there are of each.", difficulty: 2 },
          { key: "b5div-y12-11", kind: "number", prompt: "A site has 2 species: 99 individuals of one and 1 of the other. Using D = 1 − Σ(n/N)², calculate D to 2 decimal places.", answer: 0.02, tolerance: 0.005, explanation: "Σ(n/N)² = 0.99² + 0.01² = 0.9801 + 0.0001 = 0.9802, so D = 1 − 0.9802 ≈ 0.02. Although richness is 2, one species dominates so diversity is very low.", difficulty: 3 },
          { key: "b5div-y12-12", kind: "single", prompt: "Two species have identical amino-acid sequences for a protein but their DNA base sequences for the gene differ. What is the best explanation?", options: ["The proteins were made by different ribosomes, which read the same codon differently", "The DNA differences are always in the non-coding introns, which are translated into different amino acids", "One species must have a different genetic code, so the same codon codes for a different amino acid", "The genetic code is degenerate, so different codons can code for the same amino acid"], answer: "The genetic code is degenerate, so different codons can code for the same amino acid", explanation: "Several codons code for the same amino acid, so base substitutions can occur without changing the protein. DNA comparison therefore shows more differences than protein comparison.", difficulty: 3 },
          { key: "b5div-y12-13", kind: "single", prompt: "Some rats become resistant to a poison. Which is the best explanation for the increase in the resistance allele?", options: ["Exposure to the poison caused the rats to develop the resistance allele so that they could survive, and this new allele was then inherited by their offspring", "A random mutation gave some rats resistance; the poison selected for them, they survived, reproduced and passed on the allele", "Rats chose to become resistant once they detected the poison in their food, and passed this on to their young", "All rats gradually acquired resistance during their lives and passed it on"], answer: "A random mutation gave some rats resistance; the poison selected for them, they survived, reproduced and passed on the allele", explanation: "Mutation is random and exists before selection. The poison is the selection pressure; resistant rats leave more offspring, so the allele frequency rises.", difficulty: 3 },
          { key: "b5div-y12-14", kind: "written", prompt: "A student wants to compare the biodiversity of a woodland and a nearby pasture. Describe how the student could collect data and how the results could be analysed. (6 marks)", answer: "See mark scheme in the explanation.", explanation: "Mark scheme (6 marks): mark out a grid/area and use random number tables for coordinates; place quadrats (or use a transect) at the random points; identify and count each species in each quadrat; use a large enough sample and same number of quadrats/same total area in each habitat; calculate species richness and an index of diversity, D = 1 − Σ(n/N)², for each habitat; compare the values (a higher D = greater diversity); repeat at different times/dates for reliability; a statistical test could then be applied.", difficulty: 3 },
        ],
      },
      flashcards: [
        { front: "Three levels of biodiversity", back: "Species diversity, genetic diversity and ecosystem diversity." },
        { front: "Species richness", back: "The number of different species in a community." },
        { front: "Index of diversity", back: "D = 1 − Σ(n/N)²; higher value means greater diversity." },
        { front: "Binomial name format", back: "Genus (capital letter) + species (lower case), in italics or underlined." },
        { front: "Three domains", back: "Bacteria, Archaea, Eukarya." },
        { front: "Five kingdoms", back: "Prokaryotae, Protoctista, Fungi, Plantae, Animalia." },
        { front: "Why is random sampling used?", back: "To avoid bias and allow statistical analysis." },
        { front: "When is a transect used?", back: "To show how species distribution changes along an environmental gradient." },
        { front: "Evidence used to build phylogenetic trees", back: "DNA base sequences and amino-acid sequences: more differences means an older common ancestor." },
        { front: "Three types of adaptation", back: "Anatomical, physiological and behavioural." },
      ],
    },
  },
};
