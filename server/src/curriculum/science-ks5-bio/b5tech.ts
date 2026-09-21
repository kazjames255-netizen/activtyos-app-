// A-level Biology — Gene Technologies & Practical Skills (Year 13). Original content aligned to the DfE GCE AS/A-level biology subject content.
// Computable keys recomputed by _check_s5.ts.
import type { CTopic } from "../types";

const GEL_ALT = "A gel electrophoresis picture with five lanes. The ladder lane has bands labelled 1000, 800, 600, 400 and 200 base pairs from top to bottom. The crime scene lane has two bands, at 800 and 400 base pairs. Suspect 1 has three bands (1000, 600, 200), suspect 2 has two bands (800 and 400) and suspect 3 has two bands (800 and 200). The wells are at the top (cathode) and the anode is at the bottom.";
const ERR_ALT = "A bar chart with error bars titled 'Effect of a fertiliser on seedling growth'. The vertical axis is mean height of seedlings after 14 days in mm from 0 to 20. The control bar is at about 13.1 mm with an error bar from about 12.4 to 13.8. The fertiliser bar is at about 15.2 mm with an error bar from about 14.6 to 15.8. The error bars do not overlap. Each group has 5 seedlings.";

export const TOPIC: CTopic = {
  key: "b5tech",
  topic: "Biology — Gene Technologies & Practical Skills",
  subject: "Science",
  years: {
    13: {
      year: 13,
      subtopic: "A-level Year 13 (A2)",
      objectives: [
        "DNA amplification (PCR), gel electrophoresis and DNA profiling.",
        "Recombinant DNA technology: restriction enzymes, ligase, plasmid vectors and marker genes; gene therapy.",
        "Statistical tests: standard deviation, error bars, the t-test, chi-squared and correlation (Spearman's rank).",
        "Practical skills: variables, repeats and means, uncertainty, serial dilution, calibration curves and evaluating methods.",
      ],
      note: {
        title: "Gene technologies and practical skills",
        body: `## Gene technologies

**PCR** amplifies DNA in cycles: **denaturation** (about 95 °C, strands separate), **annealing** (about 55 °C, primers bind) and **extension** (about 72 °C, heat-stable *Taq* polymerase adds nucleotides). Each cycle doubles the DNA: after n cycles there are 2ⁿ copies from one molecule.

**Gel electrophoresis** separates fragments by size: DNA is negatively charged, so it moves towards the anode; **smaller fragments travel further** through the gel. Fragment size is estimated from a ladder of known sizes.

For **recombinant DNA**, restriction endonucleases cut the gene and plasmid at specific sequences, **DNA ligase** joins them, and a vector delivers the plasmid to bacteria. **Marker genes** (for example antibiotic resistance) identify transformed cells.

| Term | Meaning |
| --- | --- |
| Primer | Short single-stranded DNA that marks where copying starts |
| Restriction enzyme | Cuts DNA at a specific base sequence |
| Standard deviation | Measure of spread of data around the mean |
| Null hypothesis | Statement that there is no difference or correlation |
| Systematic error | Consistently shifts all results (affects accuracy) |

## Choosing a statistical test

- **t-test:** differences between the **means** of two groups.
- **Chi-squared:** compare observed and expected **frequencies** in categories.
- **Spearman's rank / Pearson:** **correlation** between two variables.

If the probability is below 0.05 we reject the null hypothesis. **Error bars** (± 1 SD) that do not overlap suggest a real difference, but a statistical test is needed to confirm it.

## Worked calculations

**PCR:** after 8 cycles from one template molecule there are 2⁸ = **256** copies.

**Standard deviation:** for 4, 6, 8: mean = 6, deviations −2, 0, 2, squares 4, 0, 4 (sum 8). s = √(8 ÷ (3 − 1)) = √4 = **2**.

**Percentage uncertainty:** ±0.5 cm³ on a 25.0 cm³ measurement = 0.5 ÷ 25.0 × 100 = **2%**.`,
      },
      quiz: {
        title: "Gene technologies and practical skills: Year 13 quiz",
        questions: [
          { key: "b5tech-y13-01", kind: "single", prompt: "Which type of enzyme cuts DNA at specific base sequences?", options: ["Restriction endonuclease", "DNA ligase", "DNA polymerase", "RNA polymerase"], answer: "Restriction endonuclease", explanation: "Restriction endonucleases recognise particular base sequences and cut the sugar–phosphate backbone there.", difficulty: 1 },
          { key: "b5tech-y13-02", kind: "single", prompt: "Why is a heat-stable DNA polymerase such as Taq used in PCR?", options: ["It works best at 37 °C, the temperature of the annealing stage", "It joins DNA fragments together by forming phosphodiester bonds, like DNA ligase", "It makes the primers that bind to the ends of the target sequence", "It survives the 95 °C denaturation step without being denatured"], answer: "It survives the 95 °C denaturation step without being denatured", explanation: "Taq polymerase comes from a heat-tolerant bacterium, so it is not denatured during repeated heating cycles.", difficulty: 1 },
          { key: "b5tech-y13-03", kind: "multi", prompt: "Which of these are needed in a PCR mixture?", options: ["DNA template", "Primers", "Free DNA nucleotides", "Heat-stable DNA polymerase", "RNA polymerase"], answer: ["DNA template", "Primers", "Free DNA nucleotides", "Heat-stable DNA polymerase"], explanation: "PCR needs the template, primers, nucleotides and a thermostable DNA polymerase. RNA polymerase is used in transcription, not PCR.", difficulty: 1 },
          { key: "b5tech-y13-04", kind: "number", prompt: "How many copies of a DNA sequence are present after 12 cycles of PCR, starting from one molecule?", answer: 4096, explanation: "Each cycle doubles the DNA, so after 12 cycles there are 2¹² = 4096 copies.", difficulty: 2 },
          { key: "b5tech-y13-05", kind: "single", prompt: "Which suspect's DNA profile matches the sample from the crime scene?", options: ["Suspect 1", "Suspect 2", "Suspect 3", "None of them"], answer: "Suspect 2", explanation: "Suspect 2 has bands at 800 and 400 base pairs, the same as the crime scene sample.", difficulty: 2, diagnostic: true, image: { file: "tech-gel.png", alt: GEL_ALT } },
          { key: "b5tech-y13-06", kind: "single", prompt: "Why do the smaller DNA fragments travel further along the gel?", options: ["They carry a greater negative charge per base pair, so the anode attracts them more", "They are attracted to the cathode more strongly than the larger fragments", "They can move more easily through the pores of the gel", "They are heavier and so are pulled through the gel by gravity"], answer: "They can move more easily through the pores of the gel", explanation: "DNA moves towards the positive anode because of its phosphate groups; small fragments pass through the gel network more easily than large ones.", difficulty: 2, image: { file: "tech-gel.png", alt: GEL_ALT } },
          { key: "b5tech-y13-07", kind: "single", prompt: "A student wants to know if the mean height of seedlings differs significantly between two treatments. Which statistical test is most suitable?", options: ["Student's t-test", "Chi-squared test", "Spearman's rank correlation", "Simpson's index of diversity"], answer: "Student's t-test", explanation: "A t-test compares the means of two sets of continuous data. Chi-squared is for frequencies and Spearman's rank for correlation.", difficulty: 2 },
          { key: "b5tech-y13-08", kind: "number", prompt: "The control seedlings had heights (mm) of 12.1, 13.4, 12.8, 14.0 and 13.2. Calculate the sample standard deviation (using n − 1), to 2 decimal places.", answer: 0.71, tolerance: 0.01, explanation: "Mean = 13.1. Squared deviations: 1.00, 0.09, 0.09, 0.81, 0.01, total 2.00. s = √(2.00 ÷ 4) = √0.5 = 0.71.", difficulty: 2, diagnostic: true },
          { key: "b5tech-y13-09", kind: "single", prompt: "The error bars (± 1 SD) for the two groups do not overlap. What is the best conclusion?", options: ["There is definitely a significant difference because the two means are different, so no statistical test is needed to confirm it", "The results are unreliable because the error bars are too small to be used", "The two groups have the same mean, so the fertiliser had no effect on growth", "The means probably differ, but a statistical test such as a t-test is needed to show whether this is significant"], answer: "The means probably differ, but a statistical test such as a t-test is needed to show whether this is significant", explanation: "Non-overlapping error bars suggest a real difference, but significance must be tested, ideally with a t-test and p < 0.05.", difficulty: 2, image: { file: "tech-errorbars.png", alt: ERR_ALT } },
          { key: "b5tech-y13-10", kind: "number", prompt: "A solution is diluted four times, each time by a factor of 10 (a serial dilution). What is the total dilution factor?", answer: 10000, explanation: "Each step is ×10 dilution: 10 × 10 × 10 × 10 = 10 000.", difficulty: 2 },
          { key: "b5tech-y13-11", kind: "number", prompt: "What is the smallest number of PCR cycles needed to make more than 1 000 000 copies from a single template molecule?", answer: 20, explanation: "2¹⁹ = 524 288 is too few; 2²⁰ = 1 048 576 is more than one million, so 20 cycles.", difficulty: 3 },
          { key: "b5tech-y13-12", kind: "single", prompt: "A plasmid carries genes for ampicillin resistance and tetracycline resistance. A gene is inserted into the tetracycline-resistance gene. Which growth pattern shows that a bacterium took up the recombinant plasmid?", options: ["Grows on both ampicillin and tetracycline", "Grows on ampicillin but not tetracycline", "Grows on tetracycline but not ampicillin", "Grows on neither"], answer: "Grows on ampicillin but not tetracycline", explanation: "Ampicillin resistance shows the plasmid was taken up; insertion disrupts the tetracycline-resistance gene, so those bacteria cannot grow on tetracycline.", difficulty: 3 },
          { key: "b5tech-y13-13", kind: "number", prompt: "Six plots were measured for the mean concentration of a pollutant and the number of lichen species. Ranks (pollutant, species): (3, 5), (4, 3), (2, 4), (6, 1), (5, 2), (1, 6). Calculate Spearman's rank coefficient rs = 1 − 6Σd² ÷ n(n² − 1), to 2 decimal places.", answer: -0.94, tolerance: 0.01, explanation: "d = −2, 1, −2, 5, 3, −5, so d² = 4, 1, 4, 25, 9, 25 = 68. rs = 1 − (6 × 68) ÷ (6 × 35) = 1 − 1.943 = −0.94: a strong negative correlation.", difficulty: 3 },
          { key: "b5tech-y13-14", kind: "written", prompt: "Plan an investigation into the effect of sucrose concentration on the mass of potato cylinders, and explain how you would use the results to estimate the water potential of the potato tissue. (6 marks)", answer: "See mark scheme in the explanation.", explanation: "Mark scheme (6 marks): serial dilution to produce a range of sucrose concentrations; cut identical potato cylinders (same size/from same potato), blot dry and weigh each; place in each solution for the same time and at the same temperature; reweigh and calculate percentage change in mass; repeat at least three times per concentration and calculate the mean; plot percentage change in mass against concentration and read the concentration where the change is zero, which has the same water potential as the potato cells (find the water potential from a table/calibration).", difficulty: 3 },
        ],
      },
      flashcards: [
        { front: "PCR stages in order", back: "Denaturation (~95 °C), annealing of primers (~55 °C), extension (~72 °C)." },
        { front: "Copies after n PCR cycles", back: "2ⁿ (from one starting molecule)." },
        { front: "Why does DNA move to the anode?", back: "Its phosphate groups make it negatively charged." },
        { front: "Which DNA fragments travel further?", back: "Smaller fragments move further through the gel." },
        { front: "Role of DNA ligase", back: "Joins DNA fragments by forming phosphodiester bonds." },
        { front: "Marker gene use", back: "Identifies bacteria that have taken up the plasmid (e.g. antibiotic resistance)." },
        { front: "Which test for differences between two means?", back: "Student's t-test." },
        { front: "Which test for observed vs expected frequencies?", back: "Chi-squared test." },
        { front: "Which test for correlation?", back: "Spearman's rank (or Pearson's) correlation coefficient." },
        { front: "Interpreting error bars", back: "Non-overlapping ±1 SD bars suggest a difference: confirm with a statistical test." },
        { front: "Systematic vs random error", back: "Systematic shifts all results the same way (accuracy); random scatters them (precision)." },
      ],
    },
  },
};
