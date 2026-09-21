// A-level Biology — Disease & Immunity (Year 12: defence and the immune response; Year 13: vaccination, HIV, antibiotics, monoclonal antibodies).
// Original content aligned to the DfE GCE AS/A-level biology subject content. Computable keys recomputed by _check_s5.ts.
import type { CTopic } from "../types";

const AB_ALT = "A Y-shaped antibody drawn with two heavy chains in blue forming the stem and the arms, and two shorter light chains in orange alongside the arms. The tips of the arms are purple circles. Letters mark parts: A on the purple tip of one arm, B at the bottom of the stem, C on a red bar joining the two chains of the stem, D on the end of an orange light chain, and E at the junction where the arms meet the stem.";
const RESP_ALT = "A graph with a logarithmic vertical axis (1, 10, 100, 1000, 10000) of antibody concentration against time in days from 0 to 56. After the first exposure at day 0 the curve is flat until about day 4, rises to a peak of 100 at day 14 and falls to 10 by day 28. After a second exposure at day 28 it rises within days to a much higher peak of 1000 at day 35, then declines slowly.";
const PLATE_ALT = "A circular agar dish with a bacterial lawn and four small white antibiotic discs labelled A, B, C and D. Clear circular zones surround discs A, B and D; B has the biggest zone and D is intermediate. Disc C has no clear zone. A table beside the dish gives the diameter of each clear zone including the disc: A 12 mm, B 24 mm, C 6 mm (no zone), D 18 mm.";

export const TOPIC: CTopic = {
  key: "b5imm",
  topic: "Biology — Disease & Immunity",
  subject: "Science",
  years: {
    12: {
      year: 12,
      subtopic: "A-level Year 12 (AS)",
      objectives: [
        "Pathogens and how they cause disease; non-specific defences (barriers, phagocytosis).",
        "The specific immune response: antigens and antibodies, B and T lymphocytes, humoral and cell-mediated immunity.",
        "Antibody structure and how antibodies work; primary and secondary responses; memory cells.",
      ],
      note: {
        title: "Defence against disease: the immune response",
        body: `## Non-specific and specific defences

A **pathogen** is an organism (bacterium, virus, fungus or protoctist) that causes disease. Non-specific defences work against any pathogen: skin, mucus, stomach acid, inflammation and **phagocytosis**. In phagocytosis a phagocyte (such as a neutrophil or macrophage) engulfs the pathogen into a **phagosome**, lysosomes fuse with it and **lysozymes** (hydrolytic enzymes) digest it.

The **specific** response depends on lymphocytes recognising an **antigen**, a molecule (usually a protein) that triggers an immune response.

| Cell | Role |
| --- | --- |
| Macrophage | Presents pathogen antigens on its surface (antigen-presenting cell) |
| T helper cell | Has a receptor for one antigen; releases cytokines that stimulate B cells and T killer cells |
| T killer (cytotoxic) cell | Destroys infected body cells (cell-mediated response) |
| B cell / plasma cell | Plasma cells secrete antibodies (humoral response) |
| Memory cell | Long-lived; gives rapid, larger secondary response |

## Antibodies

An **antibody** has two heavy and two light chains held by disulphide bridges. The **variable region** forms the antigen-binding site (complementary to one antigen); the constant region is the same for every antibody of a class. Antibodies **agglutinate** pathogens and act as markers so phagocytes destroy them.

## Primary and secondary response

The first exposure is slow with a low antibody peak, because few B cells match the antigen. The second exposure is faster and larger because **memory cells** are already present.

## Worked example

On a logarithmic axis each gridline is ten times the last. If antibody concentration rises from the 10 line to the 10 000 line, the change is 10 000 ÷ 10 = a **thousand-fold** increase (not the ×10 or ×100 a linear reading would suggest).`,
      },
      quiz: {
        title: "Disease and immunity: Year 12 quiz",
        questions: [
          { key: "b5imm-y12-01", kind: "single", prompt: "What is a pathogen?", options: ["Any cell that makes antibodies", "A protein on the surface of a cell", "A cell that engulfs foreign material", "An organism that causes disease"], answer: "An organism that causes disease", explanation: "Pathogens include bacteria, viruses, fungi and protoctists. An antigen is a protein that triggers an immune response.", difficulty: 1 },
          { key: "b5imm-y12-02", kind: "single", prompt: "Which of these is a non-specific defence?", options: ["Production of antibodies by plasma cells", "Phagocytosis by a neutrophil", "Killing of infected cells by T killer cells", "Formation of memory cells"], answer: "Phagocytosis by a neutrophil", explanation: "Phagocytosis works on any pathogen. The others are part of the specific immune response.", difficulty: 1 },
          { key: "b5imm-y12-03", kind: "multi", prompt: "Which of these are types of lymphocyte?", options: ["B cells", "T helper cells", "T killer cells", "Neutrophils", "Platelets"], answer: ["B cells", "T helper cells", "T killer cells"], explanation: "B cells and T cells (helper and killer) are lymphocytes. Neutrophils are phagocytes; platelets are cell fragments involved in clotting.", difficulty: 1 },
          { key: "b5imm-y12-04", kind: "single", prompt: "Which letter labels the antigen-binding site of the antibody?", options: ["B", "E", "A", "D"], answer: "A", explanation: "The variable regions at the tips of the arms, labelled A, have a shape complementary to one specific antigen.", difficulty: 2, diagnostic: true, image: { file: "imm-antibody.png", alt: AB_ALT } },
          { key: "b5imm-y12-05", kind: "single", prompt: "Which lettered feature is a disulphide bridge?", options: ["B", "C", "D", "E"], answer: "C", explanation: "The red bar at C joins the two heavy chains by a disulphide bridge (covalent S–S bond).", difficulty: 2, image: { file: "imm-antibody.png", alt: AB_ALT } },
          { key: "b5imm-y12-06", kind: "single", prompt: "What is the role of T helper cells in the humoral response?", options: ["They engulf pathogens by phagocytosis and digest them using lysozymes from lysosomes", "They secrete antibodies directly into the blood to agglutinate the pathogens", "They release cytokines that stimulate B cells to divide and differentiate into plasma cells", "They destroy virus-infected body cells by releasing perforins that make holes in them"], answer: "They release cytokines that stimulate B cells to divide and differentiate into plasma cells", explanation: "Helper T cells that recognise the presented antigen release cytokines, stimulating B cells (and T killer cells).", difficulty: 2 },
          { key: "b5imm-y12-07", kind: "single", prompt: "Why is the antibody response after the second exposure (day 28) faster and greater than after the first?", options: ["Memory cells from the first exposure quickly divide and become plasma cells", "The pathogen is more virulent the second time, so it triggers a stronger response", "Phagocytes make more antibodies the second time because they remember the antigen", "The antibodies from the first exposure multiply inside the blood and are boosted"], answer: "Memory cells from the first exposure quickly divide and become plasma cells", explanation: "Memory B cells and memory T cells remain after the first response and respond rapidly, producing more plasma cells.", difficulty: 2, image: { file: "imm-response.png", alt: RESP_ALT } },
          { key: "b5imm-y12-08", kind: "number", prompt: "The vertical axis is logarithmic. By what factor is the peak antibody concentration of the second response greater than that of the first response?", answer: 10, explanation: "The first peak is at the 100 gridline and the second at 1000: 1000 ÷ 100 = 10 times higher (not 1 or 900 as a linear reading would suggest).", difficulty: 2, diagnostic: true, image: { file: "imm-response.png", alt: RESP_ALT } },
          { key: "b5imm-y12-09", kind: "single", prompt: "Which sequence describes phagocytosis?", options: ["Pathogen produces a phagosome that fuses with the nucleus", "Phagocyte secretes antibodies onto the pathogen", "Pathogen is engulfed and its DNA is added to the phagocyte", "Lysosomes fuse with a phagosome and enzymes digest the pathogen"], answer: "Lysosomes fuse with a phagosome and enzymes digest the pathogen", explanation: "The phagocyte engulfs the pathogen into a phagosome; lysosomes fuse with it and release hydrolytic enzymes that digest it.", difficulty: 2 },
          { key: "b5imm-y12-10", kind: "short", prompt: "Which type of cell secretes antibodies?", answer: "plasma cell", accepted: ["plasma cells", "B plasma cell", "B plasma cells", "plasma", "plasma B cell", "plasma B cells", "plasma cell.", "a plasma cell"], explanation: "B cells that are activated divide and differentiate into plasma cells, which secrete large amounts of antibody.", difficulty: 2 },
          { key: "b5imm-y12-11", kind: "single", prompt: "Why does each T helper cell respond to only one antigen?", options: ["It has been infected by only one type of pathogen and has learned to recognise it", "Its receptor has a shape complementary to one specific antigen presented on a cell", "It is made by only one kind of plasma cell, which passes on a single antigen receptor", "Cytokines can only bind one antigen, so each T helper cell releases only one kind"], answer: "Its receptor has a shape complementary to one specific antigen presented on a cell", explanation: "Each T cell has receptor proteins that fit one antigen, as with an enzyme and its substrate, so only the T cell with the matching receptor is activated.", difficulty: 3 },
          { key: "b5imm-y12-12", kind: "number", prompt: "In the graph the primary response peaks 14 days after the first exposure at day 0, and the secondary response peaks at day 35 after a second exposure at day 28. How many days shorter is the time to peak in the secondary response?", answer: 7, explanation: "Primary: 14 − 0 = 14 days. Secondary: 35 − 28 = 7 days. The difference is 14 − 7 = 7 days.", difficulty: 3, image: { file: "imm-response.png", alt: RESP_ALT } },
          { key: "b5imm-y12-13", kind: "single", prompt: "How does agglutination of bacteria by antibodies help to destroy them?", options: ["Antibodies dissolve the cell walls of the bacteria so that they burst", "Antibodies inject a toxin into the bacteria, which kills them directly", "Bacteria are clumped together, so phagocytes can engulf many at once", "Antibodies turn bacteria into memory cells that remember the infection"], answer: "Bacteria are clumped together, so phagocytes can engulf many at once", explanation: "Each antibody has two binding sites, so it links pathogens together. The clumps and antibody markers make phagocytosis more effective.", difficulty: 3 },
          { key: "b5imm-y12-14", kind: "written", prompt: "Describe how the immune system responds to a first infection with a bacterium, from the arrival of the bacteria to the formation of memory cells. (6 marks)", answer: "See mark scheme in the explanation.", explanation: "Mark scheme (6 marks): phagocyte engulfs bacterium and digests it; antigens from the bacterium presented on the phagocyte surface; T helper cell with a complementary receptor binds the antigen and is activated; T helper cells release cytokines that stimulate B cells with complementary antibodies (clonal selection) to divide by mitosis (clonal expansion); B cells differentiate into plasma cells which secrete specific antibodies; some become memory cells that remain to give a faster, larger secondary response.", difficulty: 3 },
        ],
      },
      flashcards: [
        { front: "Pathogen", back: "An organism that causes disease." },
        { front: "Antigen", back: "A molecule, usually a protein, that triggers an immune response." },
        { front: "Phagocytosis steps", back: "Engulf into a phagosome, lysosomes fuse, enzymes digest." },
        { front: "T helper cell role", back: "Recognises presented antigen, releases cytokines to activate B cells and T killer cells." },
        { front: "T killer cell role", back: "Destroys infected body cells (cell-mediated response)." },
        { front: "Plasma cell", back: "Activated B cell that secretes large amounts of one antibody." },
        { front: "Memory cell", back: "Long-lived lymphocyte giving a fast, large secondary response." },
        { front: "Antibody variable region", back: "Forms the antigen-binding site with a shape complementary to one antigen." },
        { front: "Agglutination", back: "Antibodies clump pathogens together so phagocytes engulf them more easily." },
        { front: "Log scale reading", back: "Each gridline is a constant multiple (×10) of the previous one." },
      ],
    },
    13: {
      year: 13,
      subtopic: "A-level Year 13 (A2)",
      objectives: [
        "Vaccination, active and passive immunity, herd immunity and antigenic variability.",
        "HIV structure and replication (retrovirus), and how it leads to AIDS.",
        "Antibiotics, bacterial resistance and its spread; the use of monoclonal antibodies and ELISA.",
        "Interpreting epidemiological data: correlation and causation.",
      ],
      note: {
        title: "Vaccination, HIV, antibiotics and immunoassays",
        body: `## Vaccines and herd immunity

A **vaccine** contains a harmless form of antigen (dead or attenuated pathogen, or a protein). It causes **artificial active immunity**: the person makes their own antibodies and memory cells. **Passive immunity** gives ready-made antibodies (across the placenta, in breast milk, or by injection): it is immediate but short-lived, and no memory cells form.

When enough of a population is immune, the pathogen cannot spread easily: **herd immunity**. The threshold immune fraction is 1 − 1 ÷ R₀, where R₀ is the average number of people one case infects in a fully susceptible population.

| Term | Meaning |
| --- | --- |
| Antigenic variability | Antigens change (mutation), so memory cells no longer recognise them |
| Retrovirus | RNA virus with reverse transcriptase that makes DNA from its RNA |
| Monoclonal antibody | Identical antibodies from one clone of cells (a hybridoma) |
| ELISA | Enzyme-linked immunosorbent assay: colour change shows antigen or antibody |

## HIV and antibiotics

**HIV** infects **T helper cells** (with CD4 receptors). The reverse transcriptase produces DNA that inserts into the host genome. As helper T cells are lost the person cannot mount effective immune responses (AIDS). **Antibiotics** kill or inhibit bacteria (for example by interfering with cell-wall synthesis) but not viruses. Resistance arises by random mutation; antibiotic use selects the resistant bacteria, which pass the allele on by reproduction (**vertical**) or **plasmid** transfer (**horizontal**).

## Worked calculations

**Herd immunity:** if R₀ = 2, the threshold = 1 − 1 ÷ 2 = 0.5, so **50%** of the population must be immune.

**Zone of inhibition:** a clear zone of diameter 30 mm has radius 15 mm, so area = π × 15² = **707 mm²** (to the nearest whole number).`,
      },
      quiz: {
        title: "Vaccination, HIV and antibiotics: Year 13 quiz",
        questions: [
          { key: "b5imm-y13-01", kind: "single", prompt: "Which type of immunity results from being given a vaccine?", options: ["Artificial active immunity", "Natural passive immunity", "Artificial passive immunity", "Natural active immunity"], answer: "Artificial active immunity", explanation: "The person's own immune system makes antibodies and memory cells (active), and the antigen is given deliberately (artificial).", difficulty: 1 },
          { key: "b5imm-y13-02", kind: "single", prompt: "Why are antibiotics ineffective against viruses?", options: ["Viruses are too small for the antibiotic molecules to reach them in the blood", "Viruses cannot be inside human cells, so the antibiotic cannot come into contact with them", "Viruses mutate faster than bacteria, so they always become resistant before treatment begins", "Viruses do not have their own cell walls or metabolism for the antibiotics to target"], answer: "Viruses do not have their own cell walls or metabolism for the antibiotics to target", explanation: "Antibiotics target bacterial structures and processes (such as cell-wall synthesis). Viruses replicate using the host's metabolism.", difficulty: 1 },
          { key: "b5imm-y13-03", kind: "multi", prompt: "Which statements about HIV are correct?", options: ["It is a retrovirus with reverse transcriptase", "It infects helper T cells", "It is a bacterium", "It can be treated with penicillin", "It directly destroys red blood cells"], answer: ["It is a retrovirus with reverse transcriptase", "It infects helper T cells"], explanation: "HIV is an RNA retrovirus that uses reverse transcriptase to make DNA and infects T helper cells. Penicillin acts on bacteria, and HIV is not a bacterium.", difficulty: 1 },
          { key: "b5imm-y13-04", kind: "number", prompt: "A disease has an R₀ of 4. Using the threshold 1 − 1 ÷ R₀, what percentage of the population must be immune for herd immunity?", answer: 75, explanation: "Threshold = 1 − 1/4 = 0.75, so 75% of the population must be immune.", difficulty: 2, diagnostic: true },
          { key: "b5imm-y13-05", kind: "number", prompt: "Calculate the area of the clear zone (including the disc) around disc B, in mm². Use area = πr² and give your answer to the nearest whole number.", answer: 452, tolerance: 1, explanation: "Diameter 24 mm gives radius 12 mm. Area = π × 12² = π × 144 = 452.4 mm².", difficulty: 2, image: { file: "imm2-plate.png", alt: PLATE_ALT } },
          { key: "b5imm-y13-06", kind: "single", prompt: "Which conclusion is best supported by the results?", options: ["Antibiotic A is the most effective and the bacteria are resistant to D", "Antibiotic B is the most effective and the bacteria appear resistant to C", "Antibiotic C is the most effective because its disc is the smallest", "All four antibiotics are equally effective"], answer: "Antibiotic B is the most effective and the bacteria appear resistant to C", explanation: "The largest clear zone (B) shows the greatest inhibition of growth. No zone around C means bacteria grow next to it, showing resistance.", difficulty: 2, diagnostic: true, image: { file: "imm2-plate.png", alt: PLATE_ALT } },
          { key: "b5imm-y13-07", kind: "single", prompt: "How can a resistance allele be passed from one bacterium to another that is not its descendant?", options: ["By mitosis, when the cell divides into two daughter cells", "By meiosis, forming gametes that fuse together", "By transfer of a plasmid between bacteria", "By phagocytosis, when one bacterium engulfs another"], answer: "By transfer of a plasmid between bacteria", explanation: "Resistance genes are often on plasmids, which can be transferred between bacteria (horizontal gene transfer) as well as inherited by daughter cells.", difficulty: 2 },
          { key: "b5imm-y13-08", kind: "single", prompt: "Why is a new influenza vaccine needed most years?", options: ["The virus's surface antigens change by mutation, so memory cells no longer recognise them", "The vaccine loses its effect after a few months because the memory cells die off quickly", "Antibodies from the last vaccine are used up, and no memory cells were ever made", "Influenza is caused by bacteria that become resistant to the previous vaccine"], answer: "The virus's surface antigens change by mutation, so memory cells no longer recognise them", explanation: "Antigenic variability means the antigens change shape so previously formed memory cells and antibodies no longer bind.", difficulty: 2 },
          { key: "b5imm-y13-09", kind: "single", prompt: "What is a monoclonal antibody?", options: ["An antibody that binds to many different antigens because of its flexible variable region", "An antibody produced by T killer cells that destroys infected body cells", "An antibody that destroys the body's own cells after being made against self-antigens", "An identical antibody produced by a single clone of cells, with one specific antigen-binding site"], answer: "An identical antibody produced by a single clone of cells, with one specific antigen-binding site", explanation: "Monoclonal antibodies come from a hybridoma clone, so all have the same variable region and bind one antigen.", difficulty: 2 },
          { key: "b5imm-y13-10", kind: "multi", prompt: "Which are true of a sandwich ELISA test?", options: ["A capture antibody is fixed to the well to bind the antigen", "A second antibody linked to an enzyme binds the antigen", "The enzyme converts a colourless substrate into a coloured product", "Washing between steps is not needed", "The enzyme is the antigen being detected"], answer: ["A capture antibody is fixed to the well to bind the antigen", "A second antibody linked to an enzyme binds the antigen", "The enzyme converts a colourless substrate into a coloured product"], explanation: "The colour change reveals that antigen has been captured; washing removes unbound antibodies so only bound ones give colour.", difficulty: 2 },
          { key: "b5imm-y13-11", kind: "number", prompt: "A disease has R₀ = 5, so 80% of the population must be immune. A vaccine gives immunity in 95% of people vaccinated. What percentage of the population must be vaccinated? Give your answer to 1 decimal place.", answer: 84.2, tolerance: 0.2, explanation: "Immune fraction needed = 0.80. Vaccinated fraction × 0.95 = 0.80, so fraction = 0.80 ÷ 0.95 = 0.842, or 84.2%.", difficulty: 3 },
          { key: "b5imm-y13-12", kind: "single", prompt: "A study shows that hospitals with higher antibiotic use have more antibiotic-resistant infections. Which conclusion is most appropriate?", options: ["Antibiotic use has been proved to be the only cause of resistance", "There is a positive correlation, consistent with selection for resistance, but it does not prove cause", "There is no relationship between antibiotic use and the number of resistant infections", "Resistance is caused by patients' behaviour rather than by changes in the bacteria"], answer: "There is a positive correlation, consistent with selection for resistance, but it does not prove cause", explanation: "A correlation does not by itself prove causation, though the mechanism (selection pressure) makes the link plausible.", difficulty: 3 },
          { key: "b5imm-y13-13", kind: "single", prompt: "Why is it difficult to develop a vaccine against HIV?", options: ["HIV only infects bacteria, so the human immune system never encounters it", "HIV has no antigens on its surface, so the immune system cannot recognise it", "Its reverse transcriptase is error-prone, so its antigens mutate rapidly", "Vaccines can only be made against DNA viruses, and HIV has an RNA genome"], answer: "Its reverse transcriptase is error-prone, so its antigens mutate rapidly", explanation: "High mutation rate produces many antigenic variants, so antibodies and memory cells against one variant may not work against another; HIV also hides inside helper T cells.", difficulty: 3 },
          { key: "b5imm-y13-14", kind: "written", prompt: "Explain how overuse of antibiotics has led to resistant strains of bacteria, and suggest three ways in which the spread of resistance could be reduced. (6 marks)", answer: "See mark scheme in the explanation.", explanation: "Mark scheme (6 marks): random mutation produces bacteria with a resistance allele; antibiotic is the selection pressure so non-resistant bacteria die; resistant bacteria survive, reproduce and pass on the allele (and may transfer plasmids); the frequency of resistance increases; strategies (any 2 marks): only prescribe when necessary/not for viral infections; complete the full course; use narrow-spectrum antibiotics or rotate/combine antibiotics; hygiene and screening to reduce transmission; develop new antibiotics.", difficulty: 3 },
        ],
      },
      flashcards: [
        { front: "Artificial active immunity", back: "Vaccination: person makes own antibodies and memory cells." },
        { front: "Passive immunity", back: "Ready-made antibodies given; immediate but short-lived; no memory cells." },
        { front: "Herd immunity threshold", back: "1 − 1 ÷ R₀ (fraction of the population that must be immune)." },
        { front: "Antigenic variability", back: "Mutation changes antigens so memory cells no longer recognise the pathogen." },
        { front: "What kind of virus is HIV?", back: "A retrovirus: RNA genome and reverse transcriptase; infects T helper cells." },
        { front: "Why do antibiotics not affect viruses?", back: "Viruses lack the bacterial structures and metabolism that antibiotics target." },
        { front: "Two ways resistance spreads", back: "Vertical (parent to offspring) and horizontal (plasmid transfer)." },
        { front: "Monoclonal antibody", back: "Identical antibodies from one clone of cells (hybridoma) with one binding site." },
        { front: "ELISA colour change", back: "Enzyme on the detection antibody converts substrate into a coloured product: shows antigen present." },
        { front: "Area of a circular zone", back: "πr², where r = diameter ÷ 2." },
      ],
    },
  },
};
