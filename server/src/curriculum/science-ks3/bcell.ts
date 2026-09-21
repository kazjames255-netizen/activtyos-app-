// KS3 Science — Biology: Cells & Organisation (Year 7). Original content aligned to the DfE KS3 science programme of study (OGL v3.0).
// Calculation keys are recomputed by _check_s3.ts.
import type { CTopic } from "../types";
import { IMG } from "./_img";
import { sg, mu, sh, nm, wr, build } from "./_h";

export const TOPIC: CTopic = {
  key: "bcell",
  topic: "Biology — Cells & Organisation",
  subject: "Science",
  years: {
    7: {
      year: 7,
      objectives: [
        "Cells as the fundamental unit of living organisms, including how to observe, interpret and record cell structure using a light microscope.",
        "The functions of the cell wall, cell membrane, cytoplasm, nucleus, vacuole, mitochondria and chloroplasts.",
        "The similarities and differences between plant and animal cells; unicellular organisms.",
        "The hierarchical organisation of multicellular organisms: from cells to tissues to organs to systems to organisms.",
      ],
      note: {
        title: "Year 7: cells and how living things are organised",
        body: `## Cells are the units of life

All living things are made of **cells**. A light microscope lets us see them. Each part of a cell has a job.

| Part | Job | Animal | Plant |
| --- | --- | --- | --- |
| Nucleus | Contains genetic material and controls the cell | yes | yes |
| Cytoplasm | Where many chemical reactions happen | yes | yes |
| Cell membrane | Controls what enters and leaves | yes | yes |
| Mitochondria | Release energy by respiration | yes | yes |
| Cell wall | Strengthens and supports the cell | no | yes |
| Chloroplasts | Absorb light for photosynthesis | no | yes |
| Permanent vacuole | Stores cell sap and helps support the cell | no | yes |

## Levels of organisation

Cells of one type work together as a **tissue** (for example muscle). Different tissues form an **organ** (the stomach). Organs working together form an **organ system** (the digestive system). Many systems make up an **organism**.

## Worked example: magnification

magnification = image size ÷ actual size.
A student draws a cell 36 mm wide. The real cell is 0.09 mm wide, so magnification = 36 ÷ 0.09 = **×400**. To find the real size from a drawing, rearrange: actual size = image size ÷ magnification.

## Worked example: specialised cells

A **root hair cell** has a long thin extension to give a large surface area for absorbing water. A **sperm cell** has a tail to swim.`,
      },
      quiz: {
        title: "Cells & Organisation: Year 7 quiz",
        questions: build("bcell", 7, [
          sg("Look at the animal cell. Which letter shows the nucleus?", "B", ["A", "C", "D"], "The nucleus is the large round structure that holds the genetic material and controls the cell.", 1, { img: IMG.animal }),
          sg("Look at the animal cell. Which letter shows the part where most energy is released by respiration?", "C", ["A", "B", "D"], "Mitochondria are the small oval structures where aerobic respiration releases energy.", 2, { img: IMG.animal }),
          sg("Look at the plant cell. Which letter shows the part where photosynthesis takes place?", "Q", ["P", "R", "S"], "Chloroplasts contain the green pigment chlorophyll, which absorbs light for photosynthesis.", 1, { img: IMG.plant }),
          mu("Which structures are found in plant cells but NOT in animal cells?", ["Cell wall", "Chloroplasts", "Permanent vacuole", "Nucleus", "Mitochondria"], ["Cell wall", "Chloroplasts", "Permanent vacuole"], "Both plant and animal cells have a nucleus and mitochondria. Only plant cells have a cell wall, chloroplasts and a permanent vacuole.", 2, { d: true }),
          sg("What is the function of the cell membrane?", "It controls which substances enter and leave the cell", ["It contains the genetic material that controls the cell", "It absorbs light for photosynthesis", "It gives the cell a rigid shape and stops it bursting"], "The membrane is a thin, flexible layer that controls what passes in and out. Rigid support is the job of the cell wall in plants.", 2),
          nm("A student sees an image of a cell that is 45 mm long. The microscope magnification is ×300. What is the real length of the cell, in mm?", 0.15, "Rearrange magnification = image ÷ actual to get actual = image ÷ magnification = 45 ÷ 300 = 0.15 mm.", 3, { tol: 0.001 }),
          sg("Which list puts these in order from SMALLEST to LARGEST: organ, cell, organism, tissue?", "cell → tissue → organ → organism", ["tissue → cell → organ → organism", "cell → organ → tissue → organism", "organ → tissue → cell → organism"], "Cells make tissues, tissues make organs, and organs work together in an organism.", 2, { d: true }),
          sg("A red blood cell carries oxygen. Which feature helps it to do this job?", "It has no nucleus, leaving more room for haemoglobin", ["It has many chloroplasts to make oxygen as it travels around", "It has a tail so it can swim", "It has a cell wall to make it rigid"], "Red blood cells contain haemoglobin, which binds oxygen. With no nucleus there is more space for it.", 2),
          sh("What word describes an organism, such as an amoeba, that is made of only one cell?", "unicellular", ["single-celled", "single celled", "unicellular organism", "single-celled organism", "single cell", "single-cell", "one-celled", "one celled", "unicellular."], "Uni means one. A unicellular organism carries out all its life processes inside one cell.", 1),
          wr("Describe how you would prepare and view a slide of onion skin cells using a light microscope.", "Peel a thin layer of onion epidermis (1). Place it flat on a slide in a drop of water or stain such as iodine (1). Lower a coverslip at an angle to avoid air bubbles (1). Start on the lowest power objective lens (1), focus with the coarse then fine focus (1), then increase the magnification.", "Mark scheme (up to 5): thin piece of onion skin; on a slide with water or a stain such as iodine; coverslip lowered at an angle to avoid bubbles; start with the lowest power objective; focus using coarse then fine focusing wheel.", 3),
        ]),
      },
      flashcards: [
        { front: "Nucleus: what does it do?", back: "Contains the genetic material (DNA) and controls the cell's activities." },
        { front: "Mitochondria: what is their job?", back: "Where aerobic respiration releases energy for the cell." },
        { front: "Which cell part is in plants but not animals? (name 3)", back: "Cell wall, chloroplasts, permanent vacuole." },
        { front: "Function of the cell wall", back: "Made of cellulose in plants; strengthens and supports the cell." },
        { front: "Function of chloroplasts", back: "They contain chlorophyll and absorb light for photosynthesis." },
        { front: "Magnification formula", back: "magnification = image size ÷ actual size." },
        { front: "Levels of organisation (smallest to largest)", back: "Cell → tissue → organ → organ system → organism." },
        { front: "What is a tissue?", back: "A group of similar cells that work together to do a job, such as muscle tissue." },
        { front: "Unicellular means…", back: "Made of only one cell (for example an amoeba or yeast)." },
        { front: "Why is a root hair cell long and thin?", back: "To give a large surface area for absorbing water and minerals." },
      ],
    },
  },
};
