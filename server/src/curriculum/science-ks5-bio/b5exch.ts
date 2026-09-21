// A-level Biology — Exchange & Transport (Year 12). Original content aligned to the DfE GCE AS/A-level biology subject content.
import type { CTopic } from "../types";

const HB_ALT = "A graph of percentage saturation of haemoglobin with oxygen against partial pressure of oxygen from 0 to 14 kPa, showing three S-shaped curves. Curve 1 (green) is furthest to the left, reaching about 80 per cent at 4 kPa. Curve 2 (blue, adult haemoglobin at normal carbon dioxide) is in the middle and passes through 50 per cent at 3.5 kPa. Curve 3 (red) is furthest to the right.";

export const TOPIC: CTopic = {
  key: "b5exch",
  topic: "Biology — Exchange & Transport",
  subject: "Science",
  years: {
    12: {
      year: 12,
      subtopic: "A-level Year 12 (AS)",
      objectives: [
        "Surface area to volume ratio and its relationship to metabolic rate and exchange surfaces.",
        "Gas exchange in single-celled organisms, insects, fish and mammalian lungs; ventilation.",
        "Digestion and absorption of carbohydrates, lipids and proteins, including co-transport.",
        "Haemoglobin, oxygen dissociation curves, the Bohr effect and foetal haemoglobin.",
        "The mammalian circulatory system and cardiac output; transport in plants: xylem (cohesion–tension) and phloem (mass flow).",
      ],
      note: {
        title: "Exchange and transport: getting materials where they are needed",
        body: `## Why exchange surfaces exist

As organisms get larger, their **surface area to volume ratio (SA:V)** falls, so simple diffusion across the body surface is too slow. Large or active organisms have specialised exchange surfaces with a **large surface area**, a **thin** barrier and a **steep concentration gradient** (Fick's law: rate ∝ area × concentration difference ÷ distance).

| System | Key features |
| --- | --- |
| Insects | Spiracles → tracheae → tracheoles; gases diffuse straight to cells; spiracles close to reduce water loss |
| Fish gills | **Countercurrent flow** keeps a gradient along the whole lamella |
| Mammal lungs | Alveoli one cell thick, capillary network, ventilation maintains gradients |
| Ileum | Villi and microvilli; glucose absorbed by **co-transport** with Na⁺ |

## Transport

**Haemoglobin** loads O₂ at high pO₂ in the lungs and unloads it in respiring tissues. High CO₂ shifts the curve right (the **Bohr effect**), releasing more O₂. **Foetal** haemoglobin has a curve to the left, so it loads O₂ from the mother's blood. In plants, **xylem** carries water by **cohesion–tension** (transpiration pull), and **phloem** moves sucrose by **mass flow** from source to sink.

## Digestion

Amylase hydrolyses starch to maltose; membrane-bound maltase makes glucose. Endopeptidases, exopeptidases and dipeptidases break down proteins. Lipase and bile salts (which form micelles) act on lipids.

## Worked calculations

**SA:V:** a cube with sides of 3 cm has SA = 6 × 3 × 3 = 54 cm² and V = 27 cm³, so SA:V = **2 : 1**.

**Ventilation:** pulmonary ventilation = tidal volume × breathing rate: 0.5 dm³ × 12 min⁻¹ = **6.0 dm³ min⁻¹**.

**Cardiac output:** heart rate × stroke volume: 60 beats min⁻¹ × 80 cm³ = **4800 cm³ min⁻¹**.`,
      },
      quiz: {
        title: "Exchange and transport: Year 12 quiz",
        questions: [
          { key: "b5exch-y12-01", kind: "single", prompt: "What happens to the surface area to volume ratio of an organism as it gets larger?", options: ["It increases", "It decreases", "It stays the same", "It doubles every time volume doubles"], answer: "It decreases", explanation: "Volume increases faster (with the cube of length) than surface area (the square), so SA:V falls.", difficulty: 1 },
          { key: "b5exch-y12-02", kind: "single", prompt: "Which describes what happens during inspiration in a mammal?", options: ["The diaphragm relaxes and domes up; the ribcage moves down and in, so the thorax gets smaller and air is drawn in", "Thoracic volume decreases and the pressure inside the lungs rises, so air flows into the lungs", "The external intercostal muscles contract, the diaphragm contracts and flattens, and thoracic volume increases so pressure falls", "The internal intercostal muscles contract to raise the ribcage, so thoracic volume increases and pressure falls"], answer: "The external intercostal muscles contract, the diaphragm contracts and flattens, and thoracic volume increases so pressure falls", explanation: "Increasing thoracic volume lowers the pressure below atmospheric pressure, so air flows into the lungs.", difficulty: 1 },
          { key: "b5exch-y12-03", kind: "multi", prompt: "Which features make a gas exchange surface efficient?", options: ["A large surface area", "A thin barrier so diffusion distance is short", "Ventilation or blood flow that maintains a steep concentration gradient", "A thick, waterproof surface", "A low surface area to volume ratio"], answer: ["A large surface area", "A thin barrier so diffusion distance is short", "Ventilation or blood flow that maintains a steep concentration gradient"], explanation: "Fick's law: rate rises with surface area and concentration difference and falls with distance. A thick, waterproof surface would slow diffusion.", difficulty: 1 },
          { key: "b5exch-y12-04", kind: "number", prompt: "A cuboid-shaped block of tissue measures 4 cm × 2 cm × 2 cm. Calculate its surface area to volume ratio, giving your answer as a single number in the form ?:1.", answer: 2.5, explanation: "Surface area = 2(4×2 + 4×2 + 2×2) = 40 cm²; volume = 4 × 2 × 2 = 16 cm³; 40 ÷ 16 = 2.5, so SA:V = 2.5 : 1.", difficulty: 2 },
          { key: "b5exch-y12-05", kind: "number", prompt: "A person has a tidal volume of 0.45 dm³ and takes 14 breaths per minute. Calculate their pulmonary ventilation in dm³ min⁻¹.", answer: 6.3, tolerance: 0.01, explanation: "Pulmonary ventilation = tidal volume × ventilation rate = 0.45 × 14 = 6.3 dm³ min⁻¹.", difficulty: 2, diagnostic: true },
          { key: "b5exch-y12-06", kind: "single", prompt: "Why is countercurrent flow in fish gills more efficient than parallel flow?", options: ["Blood and water flow in opposite directions, keeping a concentration gradient along the whole length of the lamella", "Water is forced to flow faster over the gill lamellae, so more oxygen is delivered to the blood in a shorter time and equilibrium is reached quickly", "Blood and water flow in the same direction, so equilibrium is reached quickly", "It increases the surface area of each lamella so that more oxygen can be absorbed"], answer: "Blood and water flow in opposite directions, keeping a concentration gradient along the whole length of the lamella", explanation: "Blood always meets water with a higher oxygen concentration, so oxygen diffuses in along the entire lamella.", difficulty: 2 },
          { key: "b5exch-y12-07", kind: "single", prompt: "Which statement about gas exchange in an insect is correct?", options: ["Oxygen dissolves in the haemolymph, which is pumped around the body and carries it to every respiring tissue; the spiracles stay permanently open so that gas exchange never stops", "Air is drawn into lungs by a diaphragm, and oxygen is carried to the cells by haemoglobin", "Oxygen diffuses through the thin wings, which act as the main gas exchange surface", "Air enters through spiracles and oxygen diffuses along tracheae and tracheoles to respiring cells; spiracles can close to reduce water loss"], answer: "Air enters through spiracles and oxygen diffuses along tracheae and tracheoles to respiring cells; spiracles can close to reduce water loss", explanation: "Insects have a tracheal system delivering gases directly to cells; closing spiracles reduces water loss.", difficulty: 2 },
          { key: "b5exch-y12-08", kind: "single", prompt: "Curve 2 shows adult haemoglobin. Which statement identifies and explains foetal haemoglobin?", options: ["Curve 3: it releases oxygen more readily in the placenta, so it can supply the mother with oxygen", "Curve 1: it has a higher affinity for oxygen, so it can load oxygen from the mother's blood at the placenta", "Curve 2: it is identical to the mother's haemoglobin, so oxygen can diffuse across the placenta", "Curve 1: it unloads oxygen more easily to the foetal tissues, so they receive more oxygen"], answer: "Curve 1: it has a higher affinity for oxygen, so it can load oxygen from the mother's blood at the placenta", explanation: "Foetal haemoglobin is more saturated at the low pO₂ in the placenta, so oxygen passes from mother to foetus.", difficulty: 2, diagnostic: true, image: { file: "exch-dissoc.png", alt: HB_ALT } },
          { key: "b5exch-y12-09", kind: "number", prompt: "Read from Curve 2: at what partial pressure of oxygen (kPa) is adult haemoglobin 50% saturated?", answer: 3.5, tolerance: 0.2, explanation: "Find 50% on the vertical axis, move across to Curve 2 and read down to the pO₂ axis: 3.5 kPa.", difficulty: 2, image: { file: "exch-dissoc.png", alt: HB_ALT } },
          { key: "b5exch-y12-10", kind: "short", prompt: "Name the process by which the movement of sodium ions down their concentration gradient drives the uptake of glucose into ileum epithelial cells.", answer: "co-transport", accepted: ["cotransport", "co transport", "secondary active transport", "cotransport of glucose and sodium", "co-transport of glucose and sodium", "co-transport of glucose", "cotransport of glucose", "sodium-glucose co-transport", "sodium glucose cotransport", "sodium-glucose cotransport", "co-transport with sodium ions", "co-transport with sodium", "co-transport."], explanation: "A carrier protein moves Na⁺ and glucose together; the Na⁺ gradient is maintained by the sodium–potassium pump.", difficulty: 2 },
          { key: "b5exch-y12-11", kind: "number", prompt: "At rest a person's heart rate is 84 beats min⁻¹ and stroke volume 72 cm³. After training, resting heart rate falls to 64 beats min⁻¹ and stroke volume rises to 90 cm³. By how much does cardiac output fall, in cm³ min⁻¹?", answer: 288, explanation: "Before: 84 × 72 = 6048; after: 64 × 90 = 5760; the fall is 288 cm³ min⁻¹.", difficulty: 3 },
          { key: "b5exch-y12-12", kind: "single", prompt: "Which best describes the cohesion–tension theory of water movement in the xylem?", options: ["Living xylem cells actively pump water upwards from cell to cell using ATP from their own respiration, moving it against gravity all the way from the roots to the leaves", "Root pressure pushes water up the xylem because the leaves produce a positive pressure at the top", "Water evaporates from leaves, lowering pressure at the top; hydrogen bonding between water molecules pulls a continuous column up the xylem under tension", "Osmosis through the walls of the xylem vessels moves water upwards from cell to cell down a water potential gradient"], answer: "Water evaporates from leaves, lowering pressure at the top; hydrogen bonding between water molecules pulls a continuous column up the xylem under tension", explanation: "Transpiration creates tension; cohesion between water molecules and adhesion to the walls keep the column continuous. Xylem is dead, so the process is passive.", difficulty: 3 },
          { key: "b5exch-y12-13", kind: "single", prompt: "According to the mass flow hypothesis, how is sucrose moved from source to sink in phloem?", options: ["Sucrose is loaded actively at the source, water follows by osmosis, and the raised hydrostatic pressure pushes contents towards the sink", "Sucrose diffuses passively along the sieve tube down its concentration gradient, so no energy is needed", "Cohesion between sucrose molecules pulls the contents up the plant against gravity under tension", "Sucrose flows from the sink to the source because of the water potential gradient and the pressure in the xylem"], answer: "Sucrose is loaded actively at the source, water follows by osmosis, and the raised hydrostatic pressure pushes contents towards the sink", explanation: "Active loading lowers water potential in the phloem, water enters by osmosis, and the pressure gradient drives flow to sinks where sucrose is removed.", difficulty: 3 },
          { key: "b5exch-y12-14", kind: "written", prompt: "Explain how the structure of the alveoli and the way the lungs are ventilated allow rapid gas exchange. (6 marks)", answer: "See mark scheme in the explanation.", explanation: "Mark scheme (6 marks): large surface area from millions of alveoli; alveolar wall and capillary wall each one cell thick (squamous epithelium) so short diffusion distance; dense capillary network with a large blood supply; ventilation replaces air, keeping a high O₂ and low CO₂ concentration in alveoli; blood flow removes O₂ and brings CO₂, maintaining a steep concentration gradient; oxygen diffuses down its gradient into blood and CO₂ diffuses out (Fick's law).", difficulty: 3 },
        ],
      },
      flashcards: [
        { front: "Fick's law", back: "Rate of diffusion ∝ surface area × concentration difference ÷ diffusion distance." },
        { front: "Why do large organisms need exchange surfaces?", back: "Their SA:V ratio is small, so diffusion across the body surface is too slow." },
        { front: "Countercurrent flow in gills", back: "Blood and water flow in opposite directions, keeping a gradient along the whole lamella." },
        { front: "How do insects exchange gases?", back: "Spiracles, tracheae and tracheoles deliver O₂ directly to cells by diffusion." },
        { front: "Pulmonary ventilation", back: "Tidal volume × ventilation rate." },
        { front: "Cardiac output", back: "Heart rate × stroke volume." },
        { front: "Bohr effect", back: "High CO₂ shifts the oxygen dissociation curve right, so haemoglobin releases more O₂." },
        { front: "Foetal haemoglobin curve", back: "To the left of adult: higher affinity, loads oxygen at the placenta." },
        { front: "Glucose absorption in the ileum", back: "Co-transport with Na⁺, then facilitated diffusion into blood." },
        { front: "Cohesion–tension theory", back: "Transpiration pull; cohesive water column in xylem under tension." },
        { front: "Mass flow in phloem", back: "Sucrose moves from source to sink down a hydrostatic pressure gradient." },
      ],
    },
  },
};
