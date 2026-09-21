// KS3 Science — Biology: Genetics & Evolution (Year 9). Original content aligned to the DfE KS3 programme of study (OGL v3.0).
import type { CTopic } from "../types";
import { IMG } from "./_img";
import { sg, mu, nm, wr, build } from "./_h";

export const TOPIC: CTopic = {
  key: "bgen",
  topic: "Biology — Genetics & Evolution",
  subject: "Science",
  years: {
    9: {
      year: 9,
      objectives: [
        "Heredity as the process by which genetic information is transmitted from one generation to the next.",
        "A simple model of chromosomes, genes and DNA in heredity, including the part played by Watson, Crick, Wilkins and Franklin in the development of the DNA model.",
        "Differences between species; the variation between individuals within a species being continuous or discontinuous, to include measurement and graphical representation of variation.",
        "The variation between species and between individuals of the same species means some organisms compete more successfully, which can drive natural selection; changes in the environment may leave individuals within a species, and some entire species, less well adapted to compete successfully and reproduce, which in turn may lead to extinction.",
      ],
      note: {
        title: "Year 9: inheritance, variation and evolution",
        body: `## DNA, genes and chromosomes

Inside the **nucleus** are **chromosomes**, made of long molecules of **DNA**. A **gene** is a short section of DNA that codes for a characteristic. Human body cells have 46 chromosomes (23 pairs), and gametes have 23. DNA has a double helix shape, worked out by Watson and Crick using X-ray evidence from Franklin and Wilkins.

## Variation

Variation between individuals can be **inherited** (genes) or **environmental**. **Discontinuous** variation falls into separate groups (blood group). **Continuous** variation has a range of values (height), often shown in a bar chart with touching bars.

## Natural selection

Individuals with characteristics that suit their environment are more likely to survive, reproduce and pass on the genes. Over many generations the population changes: **evolution**. If the environment changes faster than a species can adapt, it may become **extinct**.

## Worked example: a Punnett square

A tall plant (T, dominant) crossed with a short plant (t) where the tall parent is Tt gives offspring Tt, Tt, tt, tt. So **1 in 2** (50%) are short.`,
      },
      quiz: {
        title: "Genetics & Evolution: Year 9 quiz",
        questions: build("bgen", 9, [
          sg("Look at the bar chart of student heights. Which height class is the most common (the modal class)?", "145–149 cm", ["135–139 cm", "150–154 cm", "160–164 cm"], "The modal class has the tallest bar. The 145–149 cm bar is tallest.", 1, { d: true, img: IMG.heights }),
          nm("Look at the bar chart. How many students are 150 cm or taller?", 14, "Add the bars for the 150–154, 155–159 and 160–164 cm classes: 8 + 4 + 2 = 14.", 2, { img: IMG.heights }),
          sg("Height is an example of which type of variation?", "Continuous variation", ["Discontinuous variation", "Variation that is only caused by genes", "Variation that cannot be measured"], "Height can take any value in a range, so it is continuous. Blood group falls into separate groups, so it is discontinuous.", 2, { d: true }),
          sg("Where in a human body cell is most of the DNA found?", "In the nucleus", ["In the cytoplasm", "In the cell membrane", "In the mitochondria only"], "DNA is packaged into chromosomes inside the nucleus.", 1),
          sg("Which is the best description of a gene?", "A short section of DNA that codes for a characteristic", ["A structure made of many chromosomes joined end to end", "A type of cell found inside the nucleus of a body cell", "A protein that copies the DNA when a cell divides"], "Each gene carries the instructions for making a particular protein, which affects a characteristic.", 2),
          sg("How many chromosomes are there in a normal human body cell?", "46", ["23", "92", "64"], "Body cells have 23 pairs of chromosomes, a total of 46. Gametes have 23.", 1),
          sg("Which statement best describes natural selection?", "Individuals with characteristics that suit the environment survive and reproduce more, passing on those characteristics", ["Individuals change during their own lives to suit the environment, then pass on those changes to their offspring", "The biggest and strongest individuals always survive, whatever the environment, and pass on their strength to their offspring", "Organisms choose to evolve new characteristics when the environment changes, then pass them on to their offspring"], "Selection acts on existing inherited variation. Characteristics gained in a lifetime are not passed on.", 2),
          mu("Which of these could cause a species to become extinct?", ["A new predator arrives", "A new disease spreads", "The environment changes quickly", "The food supply increases"], ["A new predator arrives", "A new disease spreads", "The environment changes quickly"], "If a species cannot adapt fast enough to these changes, all its individuals may die out.", 2),
          sg("In guinea pigs, black fur (B) is dominant over white fur (b). Two black guinea pigs are both Bb. What fraction of their young are expected to have white fur?", "1 in 4", ["1 in 2", "3 in 4", "None of them"], "The Punnett square gives BB, Bb, Bb, bb. Only bb gives white fur, so 1 in 4.", 3),
          wr("Explain how a population of light-coloured moths on a wood with dark, sooty tree trunks could change over many generations so that most moths are dark.", "There is variation: some moths are darker (1). Light moths are easier for birds to see and eat (1). Dark moths survive and reproduce more (1). They pass on the genes for dark colour to offspring (1). Over generations the proportion of dark moths increases (1).", "Mark scheme (up to 5): variation exists in colour; dark moths camouflaged/less likely to be eaten; they survive to reproduce; they pass on the genes/allele to offspring; the proportion of dark moths rises over generations.", 3),
        ]),
      },
      flashcards: [
        { front: "Where is DNA found in animal cells?", back: "In the nucleus, in chromosomes." },
        { front: "What is a gene?", back: "A short section of DNA that codes for a characteristic." },
        { front: "How many chromosomes in a human body cell?", back: "46 (23 pairs). Gametes have 23." },
        { front: "Continuous variation: example", back: "Height, mass: a range of values." },
        { front: "Discontinuous variation: example", back: "Blood group: separate categories." },
        { front: "What is natural selection?", back: "Better adapted individuals survive and reproduce more and pass on their genes." },
        { front: "Evolution is…", back: "A change in the inherited characteristics of a population over many generations." },
        { front: "Extinction happens when…", back: "No individuals of a species are left, often because the environment changed faster than it could adapt." },
        { front: "Who worked out the double-helix structure of DNA?", back: "Watson and Crick, using X-ray evidence from Franklin and Wilkins." },
        { front: "Dominant allele versus recessive allele", back: "Dominant shows if present; recessive only shows if two copies are present." },
      ],
    },
  },
};
