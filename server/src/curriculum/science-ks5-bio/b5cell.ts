// A-level Biology — Cells (Year 12). Original content aligned to the DfE GCE AS/A-level biology subject content.
import type { CTopic } from "../types";

const MITO_ALT = "A drawing of a mitochondrion seen with an electron microscope at magnification ×15 000. Its length is marked as 45 mm. Four parts are labelled with letters: A on the outer membrane, B in the narrow space between the two membranes, C on a fold of the inner membrane, and D in the central fluid-filled space.";
const TRANS_ALT = "A graph of rate of uptake against concentration outside the cell. Curve 1 is a straight line rising steadily from the origin to 10 units. Curve 2 rises steeply at first, then flattens and approaches a maximum of about 8 to 9 units.";

export const TOPIC: CTopic = {
  key: "b5cell",
  topic: "Biology — Cells",
  subject: "Science",
  years: {
    12: {
      year: 12,
      subtopic: "A-level Year 12 (AS)",
      objectives: [
        "Structure of eukaryotic cells and the functions of their organelles; prokaryotic cells and viruses.",
        "Optical and electron microscopy: magnification, resolution and cell fractionation.",
        "The cell cycle, mitosis and the mitotic index.",
        "Structure of the cell-surface membrane (fluid mosaic model).",
        "Movement across membranes: diffusion, facilitated diffusion, osmosis, active transport and co-transport.",
      ],
      note: {
        title: "Cells: organelles, microscopes, mitosis and membranes",
        body: `## Cell structure

**Eukaryotic** cells have a nucleus and membrane-bound organelles (80S ribosomes). **Prokaryotic** cells are smaller with circular DNA, no nucleus, 70S ribosomes and a murein cell wall. **Viruses** are acellular: nucleic acid in a protein coat, with no metabolism of their own.

| Term | Meaning |
| --- | --- |
| Magnification | How many times bigger the image is than the object |
| Resolution | The smallest distance at which two points can be seen as separate |
| Mitotic index | Cells in mitosis ÷ total cells × 100 |
| Water potential | Tendency of water to move; pure water = 0 kPa, solutions are negative |
| Co-transport | Uptake of one substance linked to movement of another (e.g. Na⁺) |

## Microscopes and fractionation

A **light microscope** can view living cells but has low resolution. A **TEM** gives very high resolution of thin sections in a vacuum; a **SEM** shows 3-D surfaces. **Cell fractionation** uses homogenisation in an ice-cold, isotonic, buffered solution, then differential centrifugation: the densest organelles (nuclei) form the pellet first.

## Cell cycle and membranes

Interphase (G1, S, G2) is followed by mitosis (prophase, metaphase, anaphase, telophase) and cytokinesis. The **fluid mosaic** membrane is a phospholipid bilayer with proteins, cholesterol, glycoproteins and glycolipids. Diffusion and facilitated diffusion are passive; **active transport** uses ATP and carrier proteins; osmosis is the diffusion of water down a water potential gradient.

## Worked calculations

**Magnification:** I = A × M. A cell drawn 24 mm long at ×400 has actual length 24 ÷ 400 = 0.06 mm = **60 µm** (× 1000 to convert mm to µm).

**Mitotic index:** in a sample of 250 root-tip cells, 20 were dividing, so the index is 20 ÷ 250 × 100 = **8%**.`,
      },
      quiz: {
        title: "Cells: Year 12 quiz",
        questions: [
          { key: "b5cell-y12-01", kind: "single", prompt: "Which type of microscope can be used to observe living cells?", options: ["Transmission electron microscope", "Scanning electron microscope", "Light microscope", "Both types of electron microscope"], answer: "Light microscope", explanation: "Electron microscopes need a vacuum and dead, prepared specimens; a light microscope can view living cells.", difficulty: 1 },
          { key: "b5cell-y12-02", kind: "single", prompt: "Which feature is found in bacterial cells but not in eukaryotic cells?", options: ["A cell wall containing murein", "Ribosomes for making proteins", "A plasma membrane around the cell", "DNA as the genetic material"], answer: "A cell wall containing murein", explanation: "Murein (peptidoglycan) is a bacterial wall polymer. Plant walls are cellulose and fungal walls are chitin.", difficulty: 1 },
          { key: "b5cell-y12-03", kind: "multi", prompt: "Which of these are found in plant cells but not in animal cells?", options: ["Chloroplasts", "Mitochondria", "A cellulose cell wall", "Ribosomes", "Golgi apparatus"], answer: ["Chloroplasts", "A cellulose cell wall"], explanation: "Chloroplasts and a cellulose wall are plant features; both plant and animal cells have mitochondria, ribosomes and a Golgi apparatus.", difficulty: 1 },
          { key: "b5cell-y12-04", kind: "number", prompt: "Use the drawing to calculate the actual length of the mitochondrion in micrometres (µm).", answer: 3, explanation: "Actual size = image size ÷ magnification = 45 mm ÷ 15 000 = 0.003 mm = 3 µm (1 mm = 1000 µm).", difficulty: 2, diagnostic: true, image: { file: "cell-mito.png", alt: MITO_ALT } },
          { key: "b5cell-y12-05", kind: "single", prompt: "The enzymes of the Krebs cycle are found in the mitochondrial matrix. Which letter marks the matrix?", options: ["B", "D", "A", "C"], answer: "D", explanation: "The matrix is the fluid-filled space inside the inner membrane, labelled D. C is a crista, where the electron transport chain sits.", difficulty: 2, image: { file: "cell-mito.png", alt: MITO_ALT } },
          { key: "b5cell-y12-06", kind: "number", prompt: "In a root-tip squash, 200 cells were counted and 26 of them were in mitosis. Calculate the mitotic index as a percentage.", answer: 13, explanation: "Mitotic index = cells in mitosis ÷ total cells × 100 = 26 ÷ 200 × 100 = 13%.", difficulty: 2, diagnostic: true },
          { key: "b5cell-y12-07", kind: "single", prompt: "A piece of potato increases in mass after being left in a sucrose solution. What can be concluded?", options: ["The solution has a lower water potential than the potato cells, so water moved into the potato", "Solutes moved into the potato by active transport, using ATP from respiration", "The solution and potato cells have the same water potential, so there was no net movement of water", "The solution has a higher (less negative) water potential than the potato cells"], answer: "The solution has a higher (less negative) water potential than the potato cells", explanation: "Water enters by osmosis down a water potential gradient, so the solution must have the higher water potential.", difficulty: 2 },
          { key: "b5cell-y12-08", kind: "single", prompt: "Curve 2 shows facilitated diffusion. Why does its rate level off at high external concentrations?", options: ["The phospholipid bilayer becomes full, so no more molecules can enter the membrane", "All the carrier or channel proteins are in use, so the rate cannot rise further", "ATP runs out in the cell, so the carrier proteins cannot change shape", "The concentration gradient has reversed, so the molecules are now moving out of the cell"], answer: "All the carrier or channel proteins are in use, so the rate cannot rise further", explanation: "Facilitated diffusion depends on a limited number of transport proteins; once they are saturated, extra concentration has no effect.", difficulty: 2, image: { file: "cell-transport.png", alt: TRANS_ALT } },
          { key: "b5cell-y12-09", kind: "multi", prompt: "Which conditions are used when tissue is homogenised for cell fractionation?", options: ["Ice-cold", "Isotonic with the cells", "Buffered", "Hypotonic so cells burst", "Warm to speed up the process"], answer: ["Ice-cold", "Isotonic with the cells", "Buffered"], explanation: "Cold reduces enzyme damage, isotonic solution prevents organelles bursting or shrinking by osmosis, and a buffer keeps pH stable.", difficulty: 2 },
          { key: "b5cell-y12-10", kind: "single", prompt: "Which sequence describes the route of a protein secreted from a cell?", options: ["Golgi apparatus → rough ER → vesicle → nucleus → cell-surface membrane", "Nucleus → vesicle → lysosome → cell wall → outside the cell", "Rough ER → vesicle → Golgi apparatus → vesicle → cell-surface membrane", "Ribosome → mitochondrion → vesicle → smooth ER → cell-surface membrane"], answer: "Rough ER → vesicle → Golgi apparatus → vesicle → cell-surface membrane", explanation: "Proteins made on the rough ER are packaged in vesicles to the Golgi apparatus for modification, then vesicles carry them to the membrane for exocytosis.", difficulty: 3 },
          { key: "b5cell-y12-11", kind: "number", prompt: "By Fick's law, the rate of diffusion is proportional to (surface area × concentration difference) ÷ diffusion distance. A membrane's surface area is doubled, the concentration difference is tripled and the membrane thickness is doubled. By what factor does the rate of diffusion change?", answer: 3, explanation: "Factor = (2 × 3) ÷ 2 = 3.", difficulty: 3 },
          { key: "b5cell-y12-12", kind: "single", prompt: "A drug stops spindle fibres from forming. Which event of mitosis would fail?", options: ["Sister chromatids being pulled to opposite poles", "DNA replication in S phase of the cell cycle before mitosis", "Condensation of the chromosomes during prophase", "Breakdown of the nuclear envelope at the end of prophase"], answer: "Sister chromatids being pulled to opposite poles", explanation: "Spindle fibres attach to centromeres and shorten to separate sister chromatids in anaphase. DNA replication occurs earlier and does not need a spindle.", difficulty: 3 },
          { key: "b5cell-y12-13", kind: "single", prompt: "Why can a transmission electron microscope show ribosomes when an optical (light) microscope cannot?", options: ["Electron microscopes magnify living specimens more than light microscopes can", "Electron microscopes use coloured stains that make small structures visible", "Ribosomes are larger than the wavelength of visible light, so light passes through them", "Electrons have a much shorter wavelength, giving higher resolution"], answer: "Electrons have a much shorter wavelength, giving higher resolution", explanation: "Resolution depends on the wavelength of the radiation used; electrons have a far shorter wavelength than light, so points that are very close together can be told apart.", difficulty: 2 },
          { key: "b5cell-y12-14", kind: "written", prompt: "Describe the fluid mosaic model of the cell-surface membrane and explain how a cell can absorb glucose from a lower external concentration than inside the cell. (6 marks)", answer: "See mark scheme in the explanation.", explanation: "Mark scheme (6 marks): phospholipid bilayer with hydrophilic heads outward and hydrophobic tails inward; proteins (intrinsic/extrinsic) scattered through it like a mosaic; fluid because molecules can move; cholesterol/glycoproteins/glycolipids noted; glucose taken up by active transport (or co-transport with Na⁺) using carrier proteins against the concentration gradient; requires ATP from respiration.", difficulty: 3 },
        ],
      },
      flashcards: [
        { front: "Ribosome sizes: prokaryote vs eukaryote", back: "70S in prokaryotes (and mitochondria/chloroplasts); 80S in eukaryotes." },
        { front: "Magnification formula", back: "Magnification = image size ÷ actual size (I = A × M)." },
        { front: "Magnification vs resolution", back: "Magnification: how much bigger; resolution: how clearly two close points are seen as separate." },
        { front: "Why is a virus not a cell?", back: "Acellular: nucleic acid and protein coat only, no metabolism, needs a host." },
        { front: "Stages of mitosis in order", back: "Prophase, metaphase, anaphase, telophase." },
        { front: "Mitotic index", back: "Cells in mitosis ÷ total cells observed × 100." },
        { front: "Three conditions for homogenising tissue", back: "Ice-cold, isotonic, buffered." },
        { front: "Osmosis definition", back: "Net movement of water from a higher to a lower water potential through a partially permeable membrane." },
        { front: "Active transport needs...", back: "Carrier proteins and ATP; moves substances against a concentration gradient." },
        { front: "What limits facilitated diffusion?", back: "The number of channel/carrier proteins (saturation)." },
      ],
    },
  },
};
