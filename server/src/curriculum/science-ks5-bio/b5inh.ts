// A-level Biology — Inheritance, Populations & Evolution (Year 13). Original content aligned to the DfE GCE AS/A-level biology subject content.
// Computable keys recomputed by _check_s5.ts.
import type { CTopic } from "../types";

const PED_ALT = "A family pedigree in three generations. Generation I: an unaffected male (I-1) and an unaffected female (I-2). Their children in generation II are an affected female (II-1, shaded circle), an unaffected male (II-2) and an unaffected female (II-3). II-2 has a partner, unaffected female II-5, and their son III-3 is affected (shaded square). II-3 has a partner, unaffected male II-4, and their children III-1 (male) and III-2 (female) are both unaffected.";

export const TOPIC: CTopic = {
  key: "b5inh",
  topic: "Biology — Inheritance, Populations & Evolution",
  subject: "Science",
  years: {
    13: {
      year: 13,
      subtopic: "A-level Year 13 (A2)",
      objectives: [
        "Genetic terms; monohybrid and dihybrid crosses; codominance, multiple alleles, sex-linkage, autosomal linkage and epistasis.",
        "Use of the chi-squared test to compare observed and expected results.",
        "The Hardy–Weinberg principle and calculating allele and genotype frequencies.",
        "Selection (stabilising, directional), genetic drift and speciation.",
        "Interpreting pedigrees and calculating probabilities of inheritance.",
      ],
      note: {
        title: "Inheritance, populations and evolution",
        body: `## Inheritance

An **allele** is a version of a gene. A **genotype** is the alleles an individual has; the **phenotype** is the observable result. Complex patterns include **codominance** (both alleles expressed), **multiple alleles** (for example ABO), **sex linkage** (genes on the X chromosome, so males show recessive alleles more often), **linkage** (genes on the same chromosome are inherited together unless crossing over separates them) and **epistasis** (one gene masks the expression of another, altering ratios such as 9:3:3:1 to 9:3:4).

| Term | Meaning |
| --- | --- |
| Null hypothesis | There is no significant difference between observed and expected results |
| χ² | Σ (O − E)² ÷ E |
| Degrees of freedom | Number of categories − 1 |
| Critical value | Value of χ² at p = 0.05 (3.84 for 1 df, 5.99 for 2, 7.81 for 3) |
| Genetic drift | Chance change in allele frequency, strongest in small populations |

## Chi-squared test

If χ² is **less than** the critical value at p = 0.05, the difference is not significant: any difference is likely due to chance, so we **accept** the null hypothesis. If it is greater, we reject it.

## Hardy–Weinberg

For a gene with two alleles, p + q = 1 and p² + 2pq + q² = 1, where p and q are allele frequencies. It assumes a large population, random mating, no mutation, no selection and no migration.

## Selection and speciation

**Stabilising selection** favours the mean; **directional selection** favours one extreme. **Speciation** needs reproductive isolation, often after geographical (allopatric) separation.

## Worked calculations

**Chi-squared:** 70 tall : 30 short, expected 3:1 (75 : 25). χ² = 25/75 + 25/25 = 0.33 + 1.00 = **1.33**, less than 3.84 (1 df), so not significant.

**Hardy–Weinberg:** if q² = 0.09, then q = 0.3, p = 0.7, and 2pq = 2 × 0.7 × 0.3 = **0.42**.`,
      },
      quiz: {
        title: "Inheritance, populations and evolution: Year 13 quiz",
        questions: [
          { key: "b5inh-y13-01", kind: "single", prompt: "What is an allele?", options: ["A different version of the same gene", "A section of DNA coding for a protein", "The observable characteristic of an organism", "A pair of homologous chromosomes"], answer: "A different version of the same gene", explanation: "Alleles are alternative forms of a gene found at the same locus on homologous chromosomes.", difficulty: 1 },
          { key: "b5inh-y13-02", kind: "single", prompt: "A heterozygous individual shows the dominant phenotype. What does this show?", options: ["The recessive allele is always lost", "The recessive allele is expressed in the presence of the dominant allele", "Both alleles are equally expressed", "The dominant allele is expressed in the presence of the recessive allele"], answer: "The dominant allele is expressed in the presence of the recessive allele", explanation: "A dominant allele determines the phenotype even when a recessive allele is also present. Equal expression would be codominance.", difficulty: 1 },
          { key: "b5inh-y13-03", kind: "multi", prompt: "Which are assumptions of the Hardy–Weinberg principle?", options: ["No mutations", "Random mating", "No selection or migration", "A small isolated population", "Only dominant alleles are present"], answer: ["No mutations", "Random mating", "No selection or migration"], explanation: "The principle applies to large populations with random mating, no mutation, no selection and no migration.", difficulty: 1 },
          { key: "b5inh-y13-04", kind: "number", prompt: "In a population, 4% of individuals show a recessive condition (q² = 0.04). Assuming Hardy–Weinberg equilibrium, what is the frequency of heterozygous carriers (2pq)? Give your answer as a decimal.", answer: 0.32, tolerance: 0.005, explanation: "q = √0.04 = 0.2, so p = 1 − 0.2 = 0.8. 2pq = 2 × 0.8 × 0.2 = 0.32.", difficulty: 2, diagnostic: true },
          { key: "b5inh-y13-05", kind: "number", prompt: "A recessive condition affects 1 person in 2500. Assuming Hardy–Weinberg equilibrium, calculate the percentage of the population who are carriers, to 1 decimal place.", answer: 3.9, tolerance: 0.05, explanation: "q² = 1/2500 = 0.0004, so q = 0.02 and p = 0.98. 2pq = 2 × 0.98 × 0.02 = 0.0392, which is 3.9%.", difficulty: 2 },
          { key: "b5inh-y13-06", kind: "number", prompt: "A dihybrid cross is expected to give phenotypes in the ratio 9:3:3:1. Out of 160 offspring the observed numbers are 88, 33, 27 and 12. Calculate χ² to 2 decimal places.", answer: 1.04, tolerance: 0.01, explanation: "Expected: 90, 30, 30, 10. χ² = Σ(O − E)²/E = 4/90 + 9/30 + 9/30 + 4/10 = 0.044 + 0.3 + 0.3 + 0.4 = 1.04.", difficulty: 2, diagnostic: true },
          { key: "b5inh-y13-07", kind: "single", prompt: "A χ² test on the offspring of a dihybrid cross (4 categories, so 3 degrees of freedom) gives χ² = 1.04. The critical value at p = 0.05 is 7.81. What is the correct conclusion?", options: ["χ² is smaller than 7.81, so the results prove that the 9:3:3:1 ratio is correct and the null hypothesis is false", "χ² is smaller than 7.81, so the difference between observed and expected is not significant and is probably due to chance", "χ² is smaller than 7.81, so the results are significantly different from the expected ratio at p = 0.05", "χ² is greater than 7.81, so the null hypothesis is rejected and the difference is significant"], answer: "χ² is smaller than 7.81, so the difference between observed and expected is not significant and is probably due to chance", explanation: "When χ² is below the critical value we fail to reject the null hypothesis. The data are consistent with the expected ratio but do not prove it.", difficulty: 2 },
          { key: "b5inh-y13-08", kind: "single", prompt: "Which evidence in the pedigree shows that the condition is caused by a recessive allele?", options: ["The condition appears in every generation, with about half of all children affected", "Only females are affected, which shows the allele is carried on the X chromosome", "Two unaffected parents (I-1 and I-2) have an affected child (II-1)", "An affected individual has an affected parent"], answer: "Two unaffected parents (I-1 and I-2) have an affected child (II-1)", explanation: "Unaffected parents can only have an affected child if both carry a hidden recessive allele.", difficulty: 2, image: { file: "inh-pedigree.png", alt: PED_ALT } },
          { key: "b5inh-y13-09", kind: "single", prompt: "Why can the condition not be X-linked recessive?", options: ["II-1 is an affected female, so her father I-1 would also have to be affected, but he is not", "Females cannot be affected by X-linked conditions, because they always have a normal second X", "II-2 is a male and is unaffected, so the allele cannot be carried on the X chromosome", "It affects two generations, and X-linked conditions only ever affect one generation"], answer: "II-1 is an affected female, so her father I-1 would also have to be affected, but he is not", explanation: "An affected daughter would inherit an X carrying the recessive allele from her father; he has one X and it would make him affected.", difficulty: 2, image: { file: "inh-pedigree.png", alt: PED_ALT } },
          { key: "b5inh-y13-10", kind: "multi", prompt: "Assuming autosomal recessive inheritance, which individuals must be carriers?", options: ["I-2", "II-3", "II-5", "III-2"], answer: ["I-2", "II-5"], explanation: "I-2 is the unaffected parent of affected II-1, and II-5 is the unaffected parent of affected III-3, so both must carry the allele. II-3 has a 2/3 chance of carrying it; III-2 is uncertain.", difficulty: 2, image: { file: "inh-pedigree.png", alt: PED_ALT } },
          { key: "b5inh-y13-11", kind: "number", prompt: "II-3 has an unknown genotype and II-4 is known to be a carrier. What is the probability that their next child is affected? (Ignore what you can tell from II-3’s existing children.) Give your answer as a decimal to 3 decimal places.", answer: 0.167, tolerance: 0.002, explanation: "II-3's parents are both carriers, so as an unaffected child II-3 has a 2/3 chance of being Aa. Probability of an affected child = 2/3 × 1/4 = 1/6 = 0.167.", difficulty: 3, image: { file: "inh-pedigree.png", alt: PED_ALT } },
          { key: "b5inh-y13-12", kind: "single", prompt: "In a bird species, chicks from clutches of very small or very large size survive less well than those from clutches of average size. Which type of selection is this?", options: ["Directional selection", "Disruptive selection", "Genetic drift", "Stabilising selection"], answer: "Stabilising selection", explanation: "Selection against both extremes maintains the average phenotype, reducing variation.", difficulty: 3 },
          { key: "b5inh-y13-13", kind: "single", prompt: "Which best explains how geographical separation can lead to speciation?", options: ["Individuals in the separated population choose to change their alleles to suit the new environment, and these acquired changes are then passed on directly to their offspring", "No gene flow occurs between the populations; different selection pressures and mutations change allele frequencies until they can no longer interbreed", "The two populations mate together in the middle of the range to form a new hybrid species", "Mutations occur only in the separated population, so the other population stays exactly the same"], answer: "No gene flow occurs between the populations; different selection pressures and mutations change allele frequencies until they can no longer interbreed", explanation: "Without gene flow, populations diverge; when reproductive isolation is complete they are separate species.", difficulty: 3 },
          { key: "b5inh-y13-14", kind: "written", prompt: "Describe how the chi-squared test could be used to decide whether the phenotypes of the offspring of a dihybrid cross fit a 9:3:3:1 ratio. Include the null hypothesis, the calculation, degrees of freedom and how to reach a conclusion. (6 marks)", answer: "See mark scheme in the explanation.", explanation: "Mark scheme (6 marks): null hypothesis: no significant difference between observed and expected numbers; calculate expected numbers using 9/16, 3/16, 3/16, 1/16 of the total; χ² = Σ(O − E)²/E; degrees of freedom = number of classes − 1 = 3; compare with the critical value at p = 0.05 (7.81); if χ² is less than the critical value, accept the null hypothesis (difference due to chance); if greater, reject it (results are significantly different from the expected ratio).", difficulty: 3 },
        ],
      },
      flashcards: [
        { front: "Codominance", back: "Both alleles are expressed in the phenotype of a heterozygote." },
        { front: "Sex-linked gene", back: "Gene on the X chromosome; recessive conditions show more often in males." },
        { front: "Epistasis", back: "One gene masks or modifies the expression of another (e.g. 9:3:4)." },
        { front: "χ² formula", back: "Σ (O − E)² ÷ E." },
        { front: "Degrees of freedom for χ²", back: "Number of categories − 1." },
        { front: "χ² below the critical value at p = 0.05", back: "Not significant: accept the null hypothesis; the difference is due to chance." },
        { front: "Hardy–Weinberg equations", back: "p + q = 1; p² + 2pq + q² = 1." },
        { front: "Hardy–Weinberg assumptions", back: "Large population, random mating, no mutation, no selection, no migration." },
        { front: "Stabilising vs directional selection", back: "Stabilising favours the mean; directional favours one extreme." },
        { front: "Genetic drift", back: "Chance changes in allele frequency, most important in small populations." },
        { front: "Allopatric speciation", back: "Speciation after geographical isolation stops gene flow." },
      ],
    },
  },
};
