// A-level Biology — Genes, DNA & Protein Synthesis (Year 12 basic; Year 13 control of gene expression).
// Original content aligned to the DfE GCE AS/A-level biology subject content. Computable keys recomputed by _check_s5.ts.
import type { CTopic } from "../types";

export const TOPIC: CTopic = {
  key: "b5gen",
  topic: "Biology — Genes, DNA & Protein Synthesis",
  subject: "Science",
  years: {
    12: {
      year: 12,
      subtopic: "A-level Year 12 (AS)",
      objectives: [
        "Structure of DNA and RNA; base pairing; DNA in prokaryotes and eukaryotes.",
        "The genetic code and the relationship between genes and polypeptides.",
        "Semi-conservative DNA replication.",
        "Protein synthesis: transcription (including splicing) and translation.",
        "Gene mutations; meiosis and the genetic variation it produces.",
      ],
      note: {
        title: "DNA, the genetic code and protein synthesis",
        body: `## DNA and the genetic code

DNA is a double helix of two antiparallel polynucleotide strands. The bases pair by hydrogen bonds: **A–T** (two bonds) and **C–G** (three). A **gene** is a base sequence coding for a polypeptide (or functional RNA). The **genetic code** is a **triplet** code: three bases (a **codon**) code for one amino acid. It is **degenerate** (most amino acids have more than one codon), **non-overlapping** and almost **universal**.

| Term | Meaning |
| --- | --- |
| Codon | Three mRNA bases coding for one amino acid |
| Anticodon | Three bases on tRNA complementary to a codon |
| Intron / exon | Non-coding / coding regions of a eukaryotic gene |
| Allele | A different version of a gene |
| Homologous chromosomes | A pair with the same genes in the same order |

## Making a protein

**Replication** is semi-conservative: each new molecule has one old and one new strand. **Transcription:** RNA polymerase builds mRNA complementary to the template strand; in eukaryotes introns are spliced out of pre-mRNA. **Translation:** mRNA binds a ribosome; tRNA molecules carrying specific amino acids bind by anticodon–codon pairing; peptide bonds join the amino acids.

## Mutations and meiosis

A **substitution** may be silent, or change one amino acid; an **insertion or deletion** that is not a multiple of three causes a **frameshift**. **Meiosis** halves the chromosome number and creates variation through **crossing over** (prophase I) and **independent assortment**.

## Worked calculations

**Chargaff:** if 30% of the bases in double-stranded DNA are adenine, thymine is also 30%, leaving 40% for C + G, so guanine = **20%**.

**Codons:** a coding sequence of 90 nucleotides is 90 ÷ 3 = 30 codons. With 2n = 8, independent assortment alone gives 2⁴ = **16** possible gametes.`,
      },
      quiz: {
        title: "Genes, DNA and protein synthesis: Year 12 quiz",
        questions: [
          { key: "b5gen-y12-01", kind: "single", prompt: "Which pairs of bases are held together by hydrogen bonds in DNA?", options: ["A with G, and C with T", "A with C, and G with T", "A with U, and C with G", "A with T, and C with G"], answer: "A with T, and C with G", explanation: "Complementary base pairing: adenine pairs with thymine (two hydrogen bonds), cytosine with guanine (three). Uracil occurs in RNA, not DNA.", difficulty: 1 },
          { key: "b5gen-y12-02", kind: "single", prompt: "What is a codon?", options: ["Three bases on tRNA that bind to a specific amino acid in the cytoplasm", "A sequence of three mRNA bases that codes for one amino acid", "A group of three amino acids in a polypeptide that fold together", "A region of DNA that is never transcribed because it lies between two genes"], answer: "A sequence of three mRNA bases that codes for one amino acid", explanation: "Codons are triplets on mRNA. The complementary triplet on tRNA is the anticodon.", difficulty: 1 },
          { key: "b5gen-y12-03", kind: "multi", prompt: "Which are features of the genetic code?", options: ["It is a triplet code", "It is degenerate", "It is non-overlapping", "It is overlapping", "It is completely different in every species"], answer: ["It is a triplet code", "It is degenerate", "It is non-overlapping"], explanation: "Three bases code for an amino acid, most amino acids have several codons (degenerate), and each base is read only once. The code is almost universal.", difficulty: 1 },
          { key: "b5gen-y12-04", kind: "number", prompt: "In a sample of double-stranded DNA, 22% of the bases are adenine. What percentage of the bases are guanine?", answer: 28, explanation: "A = T = 22%, so A + T = 44%. The remaining 56% is G + C, split equally: G = 28%.", difficulty: 2, diagnostic: true },
          { key: "b5gen-y12-05", kind: "number", prompt: "The coding region of a gene, including the stop codon, is 1203 nucleotides long. How many amino acids are in the polypeptide it codes for?", answer: 400, explanation: "1203 ÷ 3 = 401 codons. One is the stop codon, which does not code for an amino acid, so 400 amino acids.", difficulty: 2 },
          { key: "b5gen-y12-06", kind: "single", prompt: "Bacteria grown for many generations in heavy nitrogen (¹⁵N) are moved to a medium with normal nitrogen (¹⁴N) and allowed to replicate twice. What fraction of the DNA molecules contain some ¹⁵N?", options: ["All", "None", "One quarter", "One half"], answer: "One half", explanation: "Replication is semi-conservative. The two original ¹⁵N strands each end up in a different molecule, so 2 of the 4 molecules contain ¹⁵N.", difficulty: 2 },
          { key: "b5gen-y12-07", kind: "single", prompt: "Which enzyme joins RNA nucleotides together during transcription?", options: ["DNA polymerase", "Helicase", "RNA polymerase", "Ribosomal peptidase"], answer: "RNA polymerase", explanation: "RNA polymerase joins RNA nucleotides that pair with the DNA template strand, forming pre-mRNA.", difficulty: 2 },
          { key: "b5gen-y12-08", kind: "short", prompt: "The template strand of a DNA sequence reads TACGGCATA. Write the base sequence of the mRNA made from it.", answer: "AUGCCGUAU", accepted: ["AUG CCG UAU", "augccguau", "aug ccg uau", "AUG-CCG-UAU", "A U G C C G U A U", "AUGCCGUAU.", "5' AUGCCGUAU 3'", "5'-AUGCCGUAU-3'"], explanation: "Pair each template base with its RNA complement: T→A, A→U, C→G, G→C. TAC GGC ATA gives AUG CCG UAU (U replaces T).", difficulty: 2, diagnostic: true },
          { key: "b5gen-y12-09", kind: "single", prompt: "An mRNA codon reads GCU. Which anticodon is on the tRNA that binds to it?", options: ["GCU", "CGU", "CGA", "TGA"], answer: "CGA", explanation: "The anticodon is complementary to the codon: G→C, C→G, U→A, giving CGA.", difficulty: 2 },
          { key: "b5gen-y12-10", kind: "single", prompt: "During which stage of meiosis does crossing over occur?", options: ["Prophase I, between non-sister chromatids of homologous chromosomes", "Anaphase II, between sister chromatids as they are pulled apart", "Metaphase I, between chromosomes of different pairs as they line up at the equator", "Interphase, before DNA replication, between the two strands of one chromosome"], answer: "Prophase I, between non-sister chromatids of homologous chromosomes", explanation: "Homologous chromosomes pair and exchange sections at chiasmata in prophase I, giving new combinations of alleles.", difficulty: 2 },
          { key: "b5gen-y12-11", kind: "single", prompt: "Which mutation is likely to have the most severe effect on a polypeptide?", options: ["A substitution in the third base of a codon", "An insertion of three bases in a row in the middle of a codon", "A substitution in an intron that is removed from the mRNA", "A deletion of one base early in the coding sequence"], answer: "A deletion of one base early in the coding sequence", explanation: "A one-base deletion causes a frameshift: every codon after it is changed, so most amino acids differ and a premature stop codon may appear.", difficulty: 3 },
          { key: "b5gen-y12-12", kind: "number", prompt: "A human body cell has 46 chromosomes (23 pairs). Ignoring crossing over, how many different combinations of chromosomes are possible in the gametes because of independent assortment?", answer: 8388608, explanation: "Each of the 23 pairs can line up in 2 ways, so 2²³ = 8 388 608 combinations.", difficulty: 3 },
          { key: "b5gen-y12-13", kind: "number", prompt: "The tripeptide Met–Leu–Ser is to be coded for. Methionine has 1 codon, leucine has 6 codons and serine has 6 codons. How many different mRNA sequences could code for this tripeptide?", answer: 36, explanation: "Multiply the number of choices for each position: 1 × 6 × 6 = 36.", difficulty: 3 },
          { key: "b5gen-y12-14", kind: "written", prompt: "Describe how the base sequence of a gene is used to build a polypeptide, including the roles of mRNA, tRNA and the ribosome. (6 marks)", answer: "See mark scheme in the explanation.", explanation: "Mark scheme (6 marks): DNA unwinds/hydrogen bonds break; RNA polymerase builds mRNA from RNA nucleotides complementary to the template strand (transcription); introns spliced out in eukaryotes; mRNA leaves the nucleus and binds to a ribosome; tRNA with an anticodon complementary to the codon carries a specific amino acid; ribosome holds two tRNAs so amino acids are joined by peptide bonds (with ATP), and the ribosome moves along until a stop codon.", difficulty: 3 },
        ],
      },
      flashcards: [
        { front: "Base pairs in DNA", back: "A–T (2 hydrogen bonds), C–G (3 hydrogen bonds)." },
        { front: "What is a gene?", back: "A base sequence on DNA that codes for a polypeptide or functional RNA." },
        { front: "Three features of the genetic code", back: "Triplet, degenerate, non-overlapping (and almost universal)." },
        { front: "Semi-conservative replication", back: "Each new DNA molecule contains one original strand and one new strand." },
        { front: "Transcription", back: "RNA polymerase makes mRNA from the DNA template strand." },
        { front: "Translation", back: "Ribosome and tRNA build a polypeptide from the mRNA codons." },
        { front: "Introns and exons", back: "Introns are non-coding and spliced out; exons code for the polypeptide." },
        { front: "Anticodon", back: "Three bases on tRNA complementary to an mRNA codon." },
        { front: "Frameshift mutation", back: "Insertion or deletion not in multiples of three changes every later codon." },
        { front: "Two sources of variation in meiosis", back: "Crossing over (prophase I) and independent assortment of homologues." },
      ],
    },
    13: {
      year: 13,
      subtopic: "A-level Year 13 (A2)",
      objectives: [
        "Types of gene mutation and their effects; mutations and cancer (oncogenes and tumour suppressor genes).",
        "Totipotent, pluripotent, multipotent and unipotent cells; uses of stem cells.",
        "Regulation of transcription and translation: transcription factors, epigenetics (DNA methylation and histone acetylation), RNA interference.",
        "The effects of gene expression regulation on phenotype, including cancer treatment.",
      ],
      note: {
        title: "Control of gene expression",
        body: `## Same DNA, different cells

Every body cell has the same genes, but each cell expresses only some of them. **Stem cells** differ in potency: **totipotent** cells can become any cell type including the placenta; **pluripotent** cells (embryonic) can become any body cell type; **multipotent** adult stem cells form a limited range; **unipotent** cells form only one type.

| Term | Meaning |
| --- | --- |
| Transcription factor | Protein that binds DNA to switch a gene on or off |
| Epigenetics | Heritable changes in gene expression without changing the base sequence |
| Oncogene | Mutated proto-oncogene that stimulates cell division |
| Tumour suppressor gene | Gene whose product slows division or triggers apoptosis |
| siRNA | Small RNA that binds mRNA and causes its breakdown |

## How expression is controlled

- **Transcription factors** move from the cytoplasm to the nucleus and bind promoters; for example, a steroid hormone binds a receptor and the complex acts as a transcription factor.
- **DNA methylation** (adding methyl groups to cytosine) and **histone deacetylation** make DNA more tightly wound, so transcription is **inhibited**. **Histone acetylation** loosens DNA so transcription is **increased**.
- **RNA interference:** siRNA binds to mRNA, and the enzymes that cut it prevent translation.

## Cancer

Tumours form when mutations disrupt control of the cell cycle. A mutated **proto-oncogene** becomes an **oncogene** and cells divide too much. A mutated **tumour suppressor gene** (e.g. *TP53*) fails to stop division or trigger apoptosis. Hypermethylation of tumour suppressor genes can also silence them.

## Worked example

A tumour suppressor gene needs both alleles inactivated to lose its function (recessive at cell level). If a person inherits one faulty allele, each cell needs **one** further mutation; a person with two normal alleles needs **two** separate mutations in the same cell, so cancer is less likely.`,
      },
      quiz: {
        title: "Control of gene expression: Year 13 quiz",
        questions: [
          { key: "b5gen-y13-01", kind: "single", prompt: "Which type of stem cell can differentiate into any cell type in the body but not into placental cells?", options: ["Totipotent", "Pluripotent", "Multipotent", "Unipotent"], answer: "Pluripotent", explanation: "Pluripotent cells (embryonic stem cells) form all body cell types; totipotent cells can form every cell type including extra-embryonic tissue.", difficulty: 1 },
          { key: "b5gen-y13-02", kind: "single", prompt: "What is a transcription factor?", options: ["An enzyme that joins RNA nucleotides together during transcription", "A tRNA molecule that carries amino acids to the ribosome", "A protein that binds to DNA and switches a gene on or off", "A ribosomal protein that reads codons on the mRNA"], answer: "A protein that binds to DNA and switches a gene on or off", explanation: "Transcription factors bind to specific base sequences near genes and increase or decrease the rate of transcription.", difficulty: 1 },
          { key: "b5gen-y13-03", kind: "multi", prompt: "Which of these changes would tend to decrease transcription of a gene?", options: ["Increased DNA methylation", "Increased histone acetylation", "Histone deacetylation", "Binding of an activating transcription factor", "Addition of methyl groups to cytosine bases in the promoter"], answer: ["Increased DNA methylation", "Histone deacetylation", "Addition of methyl groups to cytosine bases in the promoter"], explanation: "Methylation and histone deacetylation make DNA more tightly bound to histones so RNA polymerase cannot reach the gene. Acetylation and activators increase transcription.", difficulty: 2 },
          { key: "b5gen-y13-04", kind: "single", prompt: "How does a mutated proto-oncogene contribute to a tumour?", options: ["Its product is permanently active, so cells divide too often", "It stops cells dividing, so tissues cannot be repaired and slowly die", "It triggers apoptosis in healthy cells, so the tissue shrinks rather than grows", "It causes DNA methylation to be removed from the whole genome, so all genes are silenced"], answer: "Its product is permanently active, so cells divide too often", explanation: "Proto-oncogenes normally stimulate cell division in a controlled way. A mutation creates an oncogene whose product stimulates uncontrolled division.", difficulty: 2, diagnostic: true },
          { key: "b5gen-y13-05", kind: "single", prompt: "A mutation stops a tumour suppressor gene being expressed. What is the most likely effect?", options: ["Cells cannot replicate their DNA, so they stop dividing and die", "Apoptosis increases, so damaged cells are removed more quickly", "Cells become totipotent and can differentiate into any type of cell", "Cells divide faster than normal because the brake on the cell cycle is lost"], answer: "Cells divide faster than normal because the brake on the cell cycle is lost", explanation: "Tumour suppressor proteins slow division or trigger apoptosis when DNA is damaged; losing them removes that control.", difficulty: 2, diagnostic: true },
          { key: "b5gen-y13-06", kind: "single", prompt: "How does siRNA reduce the amount of a protein produced?", options: ["It binds to the DNA at the gene and prevents it being replicated during S phase", "It binds to a complementary mRNA, which is then broken down so it cannot be translated", "It acetylates the histones around the gene so that the DNA is wound more tightly", "It joins amino acids together too quickly, so the polypeptide is released before it has folded"], answer: "It binds to a complementary mRNA, which is then broken down so it cannot be translated", explanation: "In RNA interference, siRNA pairs with mRNA and enzymes cleave it, preventing translation.", difficulty: 2 },
          { key: "b5gen-y13-07", kind: "single", prompt: "Which statement about epigenetic changes is correct?", options: ["They change the base sequence of the gene by adding methyl groups to the bases, so the changes are always permanent and are inherited by every offspring", "They only occur in prokaryotes, because eukaryotic DNA is always fully packaged", "They can alter gene expression without altering the DNA base sequence, and some can be inherited by daughter cells", "They are always caused by mutation of the base sequence in the germline"], answer: "They can alter gene expression without altering the DNA base sequence, and some can be inherited by daughter cells", explanation: "Methylation and histone modification change how accessible genes are, not the sequence itself, and can persist through cell division.", difficulty: 2 },
          { key: "b5gen-y13-08", kind: "single", prompt: "Oestrogen enters a cell and binds to a receptor protein; the complex enters the nucleus and switches on a gene. What is the role of the oestrogen–receptor complex?", options: ["A transcription factor that binds to a promoter region", "An enzyme that joins amino acids together on the ribosome", "An siRNA that binds to and degrades the mRNA of the gene", "A stop codon that ends translation of the gene"], answer: "A transcription factor that binds to a promoter region", explanation: "The hormone–receptor complex acts as a transcription factor, binding DNA and stimulating transcription of target genes.", difficulty: 2 },
          { key: "b5gen-y13-09", kind: "multi", prompt: "Which are potential uses of stem cells?", options: ["Treating some blood disorders by replacing damaged cells", "Research into how cells specialise", "Making a person's DNA base sequence identical to another person's", "Growing tissue for repair (for example skin)"], answer: ["Treating some blood disorders by replacing damaged cells", "Research into how cells specialise", "Growing tissue for repair (for example skin)"], explanation: "Stem cells can replace damaged tissue and help study development; they cannot rewrite the base sequence of an individual's genome.", difficulty: 2 },
          { key: "b5gen-y13-10", kind: "single", prompt: "A person inherits one faulty allele of a tumour suppressor gene. Why are they at higher risk of cancer than someone with two normal alleles?", options: ["The faulty allele codes for an oncogene that stimulates cell division as soon as it is inherited", "The faulty allele is dominant, so every cell that carries it becomes cancerous immediately", "Their cells have too many stem cells, so tissues are replaced more often than normal", "Their cells only need one further mutation to lose all tumour suppressor function"], answer: "Their cells only need one further mutation to lose all tumour suppressor function", explanation: "The remaining normal allele still makes some functional protein, so a second mutation is needed; with two normal alleles, two independent mutations are needed in the same cell, which is far less likely.", difficulty: 3 },
          { key: "b5gen-y13-11", kind: "single", prompt: "Hypermethylation of the promoter of a tumour suppressor gene is found in a tumour. What is the likely effect?", options: ["The gene is over-expressed, causing more apoptosis and slowing down division", "The gene is silenced, so cell division is less controlled", "The gene mutates into an oncogene that is permanently active", "The gene is copied more times during S phase, so more protein is made"], answer: "The gene is silenced, so cell division is less controlled", explanation: "Methylation of a promoter reduces transcription; silencing a tumour suppressor removes control over the cell cycle without any mutation.", difficulty: 2 },
          { key: "b5gen-y13-12", kind: "single", prompt: "A drug that inhibits an enzyme removing acetyl groups from histones (a histone deacetylase inhibitor) is used to treat some cancers. What is the likely mechanism?", options: ["Histones are methylated more heavily, which silences the oncogenes and slows cell division", "DNA replication is speeded up, so the cancer cells finish the cell cycle before they can divide", "Histones stay acetylated, so silenced tumour suppressor genes can be transcribed again", "Cells become totipotent and can then differentiate into normal, non-dividing cell types"], answer: "Histones stay acetylated, so silenced tumour suppressor genes can be transcribed again", explanation: "Acetylated histones bind DNA less tightly, so genes that were silenced (such as tumour suppressors) become accessible to RNA polymerase again.", difficulty: 3 },
          { key: "b5gen-y13-13", kind: "single", prompt: "Which is the best explanation of why identical twins can develop different characteristics as they age?", options: ["Different environmental exposure can lead to different epigenetic marks, so different genes are expressed", "Their DNA base sequences gradually diverge because of crossing over", "One twin gains extra chromosomes as they age, so the two genomes are no longer identical", "Their mitochondria gradually change the base sequence of the nuclear DNA"], answer: "Different environmental exposure can lead to different epigenetic marks, so different genes are expressed", explanation: "Identical twins start with the same genome, but methylation and histone modification patterns can change with environment and lifestyle.", difficulty: 3 },
          { key: "b5gen-y13-14", kind: "written", prompt: "Explain how mutations in genes that control the cell cycle can lead to a tumour, and describe how epigenetic changes could contribute. (6 marks)", answer: "See mark scheme in the explanation.", explanation: "Mark scheme (6 marks): tumour = uncontrolled cell division; mutation in a proto-oncogene creates an oncogene with permanently active product so cells divide too often; mutation in a tumour suppressor gene means the protein that slows division/triggers apoptosis is not made or non-functional; cells with damaged DNA survive and divide; hypermethylation of a tumour suppressor gene promoter reduces transcription (silences the gene); hypomethylation of an oncogene promoter increases expression; these changes need no change in base sequence and can be passed on in cell division.", difficulty: 3 },
        ],
      },
      flashcards: [
        { front: "Totipotent cell", back: "Can differentiate into any cell type, including placental (extra-embryonic) cells." },
        { front: "Pluripotent cell", back: "Can form any cell type in the body (embryonic stem cells)." },
        { front: "Multipotent cell", back: "Can form a limited range of cell types (adult stem cells)." },
        { front: "Transcription factor", back: "Protein that binds DNA to increase or decrease transcription of a gene." },
        { front: "Effect of DNA methylation", back: "Inhibits transcription (gene silenced)." },
        { front: "Effect of histone acetylation", back: "Loosens DNA around histones, increasing transcription." },
        { front: "RNA interference", back: "siRNA binds mRNA, which is degraded, so the gene is not translated." },
        { front: "Oncogene", back: "Mutated proto-oncogene: overactive, causes uncontrolled cell division." },
        { front: "Tumour suppressor gene", back: "Slows division or triggers apoptosis; mutation or silencing removes control." },
        { front: "Epigenetic change", back: "Change in gene expression without a change in DNA base sequence; can be inherited by daughter cells." },
      ],
    },
  },
};
