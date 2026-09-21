// GCSE Biology — Cell Biology (Year 10). Original content aligned to DfE GCSE combined science / biology subject content.
import type { CTopic } from "../types";
import { N, S, M, T, yr } from "./_h";
import { OSMOSIS, interpX } from "./_imgdata";

const IMG = ["b4cell-osmosis.png", "A line graph of the percentage change in mass of potato cylinders after 24 hours in sucrose solutions. The horizontal axis is sucrose concentration from 0 to 1.0 moles per dm³. The line starts at +16 percent at 0, falls steadily, crosses the zero line at one concentration, and ends at −15 percent at 1.0."] as [string, string];

export const TOPIC: CTopic = {
  key: "b4cell", topic: "Biology — Cell Biology", subject: "Science",
  years: {
    10: yr("b4cell", 10, {
      obj: [
        "Explain how the main sub-cellular structures of eukaryotic and prokaryotic cells are related to their functions.",
        "Use the magnification formula and standard form/units (mm, µm, nm) when using a light microscope.",
        "Explain how cells differentiate, and describe the role of stem cells.",
        "Describe the cell cycle and mitosis, and the importance of mitosis in growth and repair.",
        "Explain diffusion, osmosis and active transport, and how surface area to volume ratio affects exchange.",
        "Required practicals: microscopy and osmosis in plant tissue (variables, percentage change, graph skills).",
      ],
      note: ["GCSE Biology: cells, transport and the microscope", `## Cells and their parts
**Eukaryotic** cells (animals, plants, fungi) have a **nucleus** containing DNA. **Prokaryotic** cells (bacteria) have DNA in a loop, sometimes with small rings called plasmids, and **no nucleus**.

- **Mitochondria**: where aerobic respiration releases energy.
- **Ribosomes**: make proteins.
- **Cell membrane**: controls what enters and leaves.
- **Plant cells only**: cellulose cell wall, permanent vacuole, chloroplasts.

## Moving substances
- **Diffusion**: net movement of particles from high to low concentration (down a gradient). No energy needed.
- **Osmosis**: diffusion of **water** through a partially permeable membrane, from a dilute to a more concentrated solution.
- **Active transport**: moves substances **against** the gradient using energy from respiration.

## Key equations
| Quantity | Equation |
| --- | --- |
| Magnification | magnification = image size ÷ actual size |
| Percentage change | (final − start) ÷ start × 100 |
| Surface area : volume | SA ÷ V (bigger for small objects) |

## Worked example
A potato cylinder is 4.00 g at the start and 3.48 g at the end.
Change = 3.48 − 4.00 = −0.52 g. Percentage change = −0.52 ÷ 4.00 × 100 = **−13%**. Where the line on a percentage-change graph crosses zero, the solution has the same concentration as the potato cells.

**Working scientifically:** control cylinder size, volume and time; repeat and calculate a mean; convert units before using the magnification formula.`],
      quiz: "GCSE Biology: Cell Biology quiz",
      qs: [
        S(1, "Which organelle is the site of aerobic respiration in a cell?", "Mitochondria", ["Ribosomes", "Nucleus", "Cell membrane"], "Mitochondria contain the enzymes for aerobic respiration, releasing energy for the cell.", {}),
        S(1, "Which structure is found in a plant cell but NOT in an animal cell?", "A cellulose cell wall", ["A partially permeable cell membrane", "Ribosomes", "Mitochondria"], "Plant cells have a rigid cellulose cell wall outside the membrane. Both plant and animal cells have the other structures.", {}),
        T(1, "What name is given to the process by which a cell becomes specialised for a particular job?", "differentiation", ["differentiate", "cell differentiation", "differentiating", "cellular differentiation"], "As an embryo develops, cells differentiate: they gain the sub-cellular structures needed for a specific function.", {}),
        N(2, "A student views a cell under a microscope. The image is 36 mm long and the magnification is ×400. What is the actual length of the cell in µm?", 90, 0.5, "Actual size = image size ÷ magnification = 36 ÷ 400 = 0.09 mm. Multiply by 1000 to convert mm to µm: 90 µm.", () => (36 / 400) * 1000, { diag: true }),
        S(2, "Which is an adaptation of a sperm cell that helps it reach the egg?", "A tail and many mitochondria", ["A rigid cell wall for support", "Lots of haemoglobin to carry oxygen", "Chloroplasts for energy"], "The tail lets the sperm swim and the mitochondria supply the energy for swimming.", {}),
        M(2, "Which are adaptations of a root hair cell? Choose all that apply.", ["A long hair-like extension giving a large surface area", "Many mitochondria to provide energy for active transport"], ["Chloroplasts to make glucose underground", "A tail for swimming through soil water", "A thick, waterproof wall to stop water entering"], "Root hair cells absorb water and mineral ions, so they need a big surface area and lots of energy for active transport. They are underground so have no chloroplasts.", {}),
        S(2, "Which statement describes osmosis?", "Water moves from a dilute solution to a more concentrated solution through a partially permeable membrane", ["Solute particles move from a high to a low concentration through a partially permeable membrane, using energy from respiration", "Water moves against a concentration gradient using energy", "Any particles spread out evenly in a gas"], "Osmosis is the net movement of water only, through a partially permeable membrane, from the less concentrated (dilute) to the more concentrated solution.", {}),
        N(2, "Potato cylinders were left in sucrose solutions for 24 hours. Use the graph to find the sucrose concentration (in mol/dm³) at which the potato did not change in mass.", 0.4, 0.03, "Where the line crosses 0% change, water enters and leaves at the same rate, so the solution matches the potato cell sap: 0.4 mol/dm³.", () => interpX(OSMOSIS.conc, OSMOSIS.pct, 0), { img: IMG, diag: true }),
        S(2, "In the potato cylinder practical, which two things must be controlled to make the test fair?", "The size (surface area) of each cylinder and the volume of solution", ["The concentration of sucrose solution and the final mass", "The percentage change in mass and the temperature of the room only", "Nothing, because the potato is the same in each tube"], "Only the sucrose concentration (independent variable) changes. Cylinder size, solution volume, time and temperature are control variables.", {}),
        S(2, "In one experiment the graph shows a large positive percentage change at 0 mol/dm³ sucrose. What best explains this?", "Water moved into the potato cells because the solution was more dilute than the cell sap", ["Sucrose moved into the potato cells by active transport", "Water moved out of the cells because the solution was more concentrated", "The cells divided by mitosis in the solution"], "Pure water is more dilute than the cell sap, so water enters the cells by osmosis and the cylinder gains mass.", { img: IMG }),
        N(3, "A potato cylinder has a mass of 2.50 g at the start and 2.20 g at the end. Calculate the percentage change in mass. (Give a negative value for a decrease.)", -12, 0.1, "Percentage change = (final − start) ÷ start × 100 = (2.20 − 2.50) ÷ 2.50 × 100 = −12%.", () => ((2.2 - 2.5) / 2.5) * 100),
        N(3, "A cube-shaped cell has sides of 4 µm. Calculate its surface area to volume ratio as a single number (SA ÷ V).", 1.5, 0.01, "Surface area = 6 × 4² = 96 µm². Volume = 4³ = 64 µm³. 96 ÷ 64 = 1.5. Smaller cells have larger ratios, so exchange is faster.", () => (6 * 4 * 4) / (4 * 4 * 4)),
        M(3, "Which statements about mitosis are correct? Choose all that apply.", ["It produces two genetically identical daughter cells", "The DNA is copied before the cell divides"], ["It produces four genetically different cells", "The chromosome number is halved", "It is used to make gametes"], "Before mitosis the cell grows and DNA replicates; mitosis then produces two identical diploid cells for growth and repair. Gametes are made by meiosis.", {}),
      ],
      cards: [
        ["Prokaryotic cell: nucleus?", "No nucleus. DNA is a loop (plus plasmids) in the cytoplasm."],
        ["Function of ribosomes", "Make proteins (protein synthesis)."],
        ["Function of mitochondria", "Site of aerobic respiration, releasing energy."],
        ["Structures found only in plant cells", "Cellulose cell wall, permanent vacuole, chloroplasts."],
        ["Magnification equation", "magnification = image size ÷ actual size."],
        ["1 mm = ? µm", "1000 µm (1 µm = 1000 nm)."],
        ["Diffusion", "Net movement of particles from a high to a low concentration; no energy needed."],
        ["Osmosis", "Diffusion of water through a partially permeable membrane from dilute to concentrated."],
        ["Active transport", "Movement of substances against a concentration gradient, using energy from respiration."],
        ["Why do small organisms exchange easily?", "Large surface area to volume ratio."],
        ["Why does mitosis matter?", "Growth, repair and asexual reproduction: two identical diploid cells."],
        ["Percentage change equation", "(final − start) ÷ start × 100."],
      ],
    }),
  },
};
