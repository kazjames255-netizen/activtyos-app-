// Pure data for the "Label the diagram" tool (plan S-01). No JSX here so the selftest can import it under plain node.
// Coordinates are in each diagram's viewBox (all 400 x 300). `hotspot` sits ON the part; `leader` (optional) moves the numbered marker
// away from a crowded spot and a leader line is drawn from the marker to the hotspot.

export type Difficulty = 1 | 2 | 3;
export type LabelSubject = "biology" | "chemistry" | "physics" | "geography";
export type DiagramTopic = "cells" | "plants" | "body-systems" | "physics";

export interface Pt { x: number; y: number }
export interface LabelPart {
  id: string;
  /** The correct term. */
  label: string;
  hotspot: Pt;
  leader?: Pt;
  difficulty: Difficulty;
  /** A short clue about the part's function that never contains the label. */
  hint: string;
  /** Alternative accepted spellings / terms (typed mode). */
  accepts: string[];
}
export interface DiagramDef {
  id: string;
  title: string;
  subject: LabelSubject;
  topic: DiagramTopic;
  keyStages: (2 | 3 | 4 | 5)[];
  viewBox: { w: number; h: number };
  /** Plain-text description read by screen readers. */
  description: string;
  note?: string;
  parts: LabelPart[];
}

const p = (id: string, label: string, x: number, y: number, difficulty: Difficulty, hint: string, accepts: string[] = [], leader?: Pt): LabelPart =>
  ({ id, label, hotspot: { x, y }, difficulty, hint, accepts, ...(leader ? { leader } : {}) });
const VB = { w: 400, h: 300 };

export const DIAGRAM_DATA: DiagramDef[] = [
  {
    id: "animal-cell", title: "Animal cell", subject: "biology", topic: "cells", keyStages: [3, 4], viewBox: VB,
    description: "An oval animal cell with a large round nucleus, two sausage-shaped mitochondria, small dots and a thin outer boundary.",
    parts: [
      p("nucleus", "nucleus", 215, 140, 1, "Holds the DNA and controls the cell's activities.", ["cell nucleus"]),
      p("membrane", "cell membrane", 30, 150, 1, "Thin boundary that controls what moves in and out.", ["membrane", "plasma membrane"]),
      p("cytoplasm", "cytoplasm", 120, 215, 1, "Jelly-like fluid where many chemical reactions happen."),
      p("mito", "mitochondrion", 110, 110, 2, "Where aerobic respiration releases energy.", ["mitochondria"]),
      p("ribosome", "ribosome", 300, 200, 3, "Tiny structure that joins amino acids to make proteins.", ["ribosomes"]),
    ],
  },
  {
    id: "plant-cell", title: "Plant cell", subject: "biology", topic: "cells", keyStages: [3, 4], viewBox: VB,
    description: "A rectangular plant cell with a thick outer layer, a large central sac, a round nucleus and green oval structures.",
    parts: [
      p("wall", "cell wall", 40, 120, 1, "Tough outer layer of cellulose that supports the cell.", ["wall", "cellulose cell wall"]),
      p("membrane", "cell membrane", 52, 200, 2, "Thin layer just inside the outer layer, controlling what passes through.", ["membrane", "plasma membrane"]),
      p("cytoplasm", "cytoplasm", 315, 240, 1, "Watery gel filling the space around the organelles."),
      p("nucleus", "nucleus", 110, 150, 1, "Contains the chromosomes and controls the cell.", ["cell nucleus"]),
      p("vacuole", "vacuole", 250, 150, 2, "Large space filled with sap that keeps the cell firm.", ["permanent vacuole", "large vacuole", "vacuoles"]),
      p("chloroplast", "chloroplast", 110, 72, 2, "Green structure where photosynthesis takes place.", ["chloroplasts"]),
    ],
  },
  {
    id: "bacterial-cell", title: "Bacterial cell", subject: "biology", topic: "cells", keyStages: [4], viewBox: VB,
    description: "A rod-shaped bacterium with several layers around it, a loop of genetic material, a small ring and a wavy tail.",
    parts: [
      p("capsule", "capsule", 170, 70, 3, "Slimy outer coating that protects the bacterium.", ["slime capsule", "slime layer"]),
      p("wall", "cell wall", 170, 216, 1, "Rigid layer that stops the bacterium bursting.", ["wall"]),
      p("membrane", "cell membrane", 58, 150, 2, "Thin layer beneath the rigid layer that controls what enters and leaves.", ["membrane", "plasma membrane"]),
      p("cytoplasm", "cytoplasm", 100, 120, 1, "Jelly-like fluid that fills the inside."),
      p("dna", "circular DNA", 170, 128, 1, "Loose loop of instructions floating free, because there is no nucleus.", ["chromosomal dna", "dna loop", "bacterial chromosome", "chromosome", "dna"]),
      p("plasmid", "plasmid", 250, 159, 3, "Small extra ring of genes, often carrying antibiotic resistance.", ["plasmids"]),
      p("flagellum", "flagellum", 330, 137.5, 2, "Whip-like tail that spins to move the bacterium.", ["flagella"]),
    ],
  },
  {
    id: "flower", title: "Flower", subject: "biology", topic: "plants", keyStages: [3, 4], viewBox: VB,
    description: "A flower cut in half showing coloured petals, small green sepals, two stamens with anthers on stalks, and a central carpel with a sticky top, a stalk and a swollen base.",
    parts: [
      p("petal", "petal", 90, 140, 1, "Often brightly coloured to attract insects.", ["petals"]),
      p("sepal", "sepal", 162, 232, 2, "Small green leaf-like part that protects the bud.", ["sepals"]),
      p("anther", "anther", 150, 102, 1, "Top of the male part; makes pollen.", ["anthers"]),
      p("filament", "filament", 168.5, 160, 3, "Thin stalk that holds the pollen-making part up.", ["filaments"]),
      p("stigma", "stigma", 200, 84, 2, "Sticky top of the female part that catches pollen.", ["stigmas"]),
      p("style", "style", 200, 120, 3, "Stalk joining the sticky top to the ovary.", ["styles"]),
      p("ovary", "ovary", 200, 182, 1, "Contains the ovules; later becomes the fruit.", ["ovaries"]),
    ],
  },
  {
    id: "eye", title: "Human eye", subject: "biology", topic: "body-systems", keyStages: [3, 4], viewBox: VB,
    description: "A side view of the eyeball: a clear bulge at the front, a coloured ring with a central hole, a disc behind it, a light-sensitive layer at the back and a cable leaving from behind.",
    parts: [
      p("cornea", "cornea", 127.5, 150, 1, "Clear curved front window that does most of the bending of light.", ["corneas"]),
      p("iris", "iris", 165, 118, 1, "Coloured ring of muscle that changes the size of the hole in front.", ["irises"]),
      p("pupil", "pupil", 165, 150, 1, "Black hole in the middle where light enters.", ["pupils"]),
      p("lens", "lens", 190, 150, 2, "Flexible transparent disc that fine-focuses light onto the back.", ["eye lens"]),
      p("retina", "retina", 320.6, 134, 2, "Light-sensitive layer containing rods and cones.", ["retinas"]),
      p("optic-nerve", "optic nerve", 355, 183.4, 2, "Carries electrical impulses to the brain.", ["optic nerves"]),
      p("ciliary", "ciliary muscle", 205, 92, 3, "Muscle ring that contracts or relaxes to change the shape of the disc in front of it.", ["ciliary muscles", "ciliary body"]),
      p("suspensory", "suspensory ligaments", 193.5, 110, 3, "Fibres that hold the focusing disc in place and pull on it.", ["suspensory ligament", "ligaments"]),
      p("sclera", "sclera", 230, 50, 3, "Tough white outer coat of the eyeball.", ["scleras"]),
    ],
  },
  {
    id: "heart", title: "Human heart", subject: "biology", topic: "body-systems", keyStages: [3, 4], viewBox: VB,
    note: "The heart is drawn as seen from the front: the right side of the heart is on the left of the picture.",
    description: "A simple heart with four chambers, two upper and two lower, four large blood vessels entering and leaving, and two valves between the upper and lower chambers.",
    parts: [
      p("ra", "right atrium", 140, 130, 2, "Upper chamber that receives deoxygenated blood from the body.", ["right atria"]),
      p("la", "left atrium", 260, 130, 2, "Upper chamber that receives oxygenated blood from the lungs.", ["left atria"]),
      p("rv", "right ventricle", 150, 215, 2, "Lower chamber with a thinner wall that pumps blood to the lungs.", ["right ventricles"]),
      p("lv", "left ventricle", 255, 215, 1, "Thickest-walled chamber; pumps blood around the whole body.", ["left ventricles"]),
      p("aorta", "aorta", 270, 36, 1, "Largest artery; carries oxygenated blood out to the body.", ["aortas"]),
      p("vena-cava", "vena cava", 120, 55, 1, "Large vein bringing deoxygenated blood back from the body.", ["venae cavae", "vena cavae", "superior vena cava", "inferior vena cava"]),
      p("pa", "pulmonary artery", 188, 80, 2, "Takes deoxygenated blood from the heart to the lungs.", ["pulmonary arteries"]),
      p("pv", "pulmonary vein", 335, 130, 2, "Brings oxygenated blood from the lungs to the heart.", ["pulmonary veins"]),
      p("tricuspid", "tricuspid valve", 140, 178, 3, "Three-flap valve on the right side, between the upper and lower chambers.", ["right atrioventricular valve", "av valve"]),
      p("bicuspid", "bicuspid valve", 260, 178, 3, "Two-flap valve on the left side, between the upper and lower chambers.", ["mitral valve", "left atrioventricular valve"]),
    ],
  },
  {
    id: "digestive", title: "Digestive system", subject: "biology", topic: "body-systems", keyStages: [2, 3, 4], viewBox: VB,
    description: "The digestive system from mouth to rectum: a tube from the mouth to a bag-like stomach, a large liver on one side, a small gland beneath the stomach, a coiled narrow tube framed by a wider tube, ending in a short final section.",
    parts: [
      p("mouth", "mouth", 200, 24, 1, "Where food is chewed and mixed with saliva.", ["oral cavity"]),
      p("oesophagus", "oesophagus", 211, 65, 2, "Muscular tube that squeezes food down towards the stomach.", ["esophagus", "gullet"]),
      p("stomach", "stomach", 245, 125, 1, "Muscular bag that churns food with acid and protease enzymes."),
      p("liver", "liver", 135, 118, 2, "Makes bile, which helps to digest fats.", ["livers"]),
      p("pancreas", "pancreas", 210, 162, 3, "Releases enzymes such as amylase, protease and lipase into the gut."),
      p("small-int", "small intestine", 200, 220, 1, "Long coiled tube where digested food is absorbed into the blood.", ["small bowel"]),
      p("large-int", "large intestine", 265, 225, 2, "Absorbs water from the remaining waste.", ["colon", "large bowel"]),
      p("rectum", "rectum", 150, 288, 3, "Stores faeces before they leave the body.", ["rectums"]),
    ],
  },
  {
    id: "leaf", title: "Leaf cross-section", subject: "biology", topic: "plants", keyStages: [3, 4], viewBox: VB,
    description: "A slice through a leaf showing a waxy top band, a layer of flat cells, a layer of tall packed cells, a loosely packed layer with air gaps, a vein, and a bottom layer with a pore between two bean-shaped cells.",
    parts: [
      p("cuticle", "cuticle", 60, 44, 3, "Waxy waterproof coating that cuts down water loss.", ["waxy cuticle", "waxy layer"]),
      p("upper-epi", "upper epidermis", 60, 63, 1, "Transparent protective layer that lets light through.", ["top epidermis", "upper epidermal layer"]),
      p("palisade", "palisade mesophyll", 118, 111, 1, "Tightly packed column-shaped cells with lots of chloroplasts.", ["palisade layer", "palisade cells", "palisade cell", "palisade"]),
      p("spongy", "spongy mesophyll", 120, 178, 2, "Loosely packed cells with air spaces for gas exchange.", ["spongy layer", "spongy"]),
      p("vein", "vein", 320, 172, 1, "Bundle of xylem and phloem carrying water and sugars.", ["veins", "vascular bundle"]),
      p("lower-epi", "lower epidermis", 80, 225, 2, "Bottom protective layer that contains most of the pores.", ["bottom epidermis", "lower epidermal layer"]),
      p("guard", "guard cell", 186, 225, 2, "One of a pair of bean-shaped cells that open and close the pore.", ["guard cells"]),
      p("stoma", "stoma", 200, 225, 2, "Tiny pore that lets carbon dioxide in and water vapour out.", ["stomata"], { x: 200, y: 275 }),
    ],
  },
  {
    id: "respiratory", title: "Respiratory system", subject: "biology", topic: "body-systems", keyStages: [2, 3, 4], viewBox: VB,
    description: "The breathing system: a tube down the middle that splits into two branches, one going into each of two large spongy organs, tiny clusters of bubbles at the branch ends, and a dome of muscle underneath.",
    parts: [
      p("trachea", "trachea", 200, 70, 1, "Tube kept open by C-shaped rings of cartilage, carrying air down.", ["windpipe"]),
      p("bronchus", "bronchus", 175, 150, 2, "One of two main tubes branching off the trachea.", ["bronchi"]),
      p("bronchiole", "bronchiole", 135, 191.5, 3, "Narrow tube branching from a bronchus, ending in tiny bubbles.", ["bronchioles"]),
      p("lung", "lung", 300, 120, 1, "Spongy organ where oxygen enters the blood.", ["lungs"]),
      p("alveoli", "alveoli", 110, 218, 2, "Microscopic bubbles with thin, moist walls where gas exchange happens.", ["alveolus", "air sacs", "air sac"]),
      p("diaphragm", "diaphragm", 200, 265, 1, "Dome-shaped sheet of muscle below the lungs that flattens to breathe in."),
    ],
  },
  {
    id: "circuit", title: "Electrical circuit", subject: "physics", topic: "physics", keyStages: [2, 3, 4], viewBox: VB,
    description: "A series circuit with a cell on the left, a switch and a resistor along the top, a lamp on the right with a meter connected across it, and a second meter in the bottom wire.",
    parts: [
      p("cell", "cell", 60, 146, 1, "Provides the push (potential difference) that drives current.", ["battery", "power supply"]),
      p("switch", "switch", 167.5, 51, 1, "Opens or closes the circuit to stop or start the current.", ["switches"]),
      p("bulb", "bulb", 340, 150, 1, "Transfers electrical energy as light.", ["lamp", "light bulb", "filament lamp"]),
      p("resistor", "resistor", 270, 60, 2, "Component that opposes the flow of current.", ["fixed resistor"]),
      p("ammeter", "ammeter", 200, 240, 2, "Measures current; connected in series.", ["ammeters"]),
      p("voltmeter", "voltmeter", 375, 150, 2, "Measures potential difference; connected in parallel across a component.", ["voltmeters"]),
      p("wire", "wire", 60, 100, 3, "Metal conductor joining the components together.", ["connecting wire", "lead", "cable"]),
    ],
  },
];
