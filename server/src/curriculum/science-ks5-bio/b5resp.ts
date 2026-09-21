// A-level Biology — Photosynthesis & Respiration (Year 13). Original content aligned to the DfE GCE AS/A-level biology subject content.
// Computable keys recomputed by _check_s5.ts.
import type { CTopic } from "../types";

const LIGHT_ALT = "A graph of rate of photosynthesis against light intensity from 0 to 100 arbitrary units at 25 degrees Celsius. Two curves rise and then level off. The green curve, for 0.10 per cent carbon dioxide, rises to about 9.6 at intensity 100. The blue curve, for 0.04 per cent carbon dioxide, levels off at a much lower rate of about 4.8. A red dot marked X sits on the blue curve at light intensity 80, where the rate is about 4.6.";

export const TOPIC: CTopic = {
  key: "b5resp",
  topic: "Biology — Photosynthesis & Respiration",
  subject: "Science",
  years: {
    13: {
      year: 13,
      subtopic: "A-level Year 13 (A2)",
      objectives: [
        "Photosynthesis: light-dependent reactions (photolysis, photophosphorylation, reduced NADP) and the light-independent Calvin cycle.",
        "Limiting factors affecting the rate of photosynthesis.",
        "Respiration: glycolysis, the link reaction, the Krebs cycle and oxidative phosphorylation (chemiosmosis).",
        "Anaerobic respiration; respiratory substrates and the respiratory quotient.",
      ],
      note: {
        title: "Photosynthesis and respiration: energy transfers",
        body: `## Photosynthesis

In the **light-dependent reactions** (thylakoid membranes) light excites electrons in chlorophyll. **Photolysis** of water supplies electrons, H⁺ ions and oxygen. Electrons pass along an electron transport chain, and the energy released pumps H⁺ across the membrane; H⁺ flows back through **ATP synthase** (chemiosmosis) to make ATP. NADP accepts electrons and H⁺ to become **reduced NADP**.

In the **Calvin cycle** (stroma) rubisco combines CO₂ with **RuBP** (5C) to make two molecules of **GP** (3C). GP is reduced to **TP** using ATP and reduced NADP; most TP regenerates RuBP, and some becomes glucose and other organic molecules.

| Term | Meaning |
| --- | --- |
| Photolysis | Light-driven splitting of water |
| Chemiosmosis | ATP made as H⁺ flow through ATP synthase |
| RuBP | 5-carbon CO₂ acceptor in the Calvin cycle |
| RQ | CO₂ produced ÷ O₂ consumed |
| Limiting factor | The factor in shortest supply that sets the rate |

## Respiration

**Glycolysis** (cytoplasm): glucose → 2 pyruvate with a net gain of 2 ATP and 2 reduced NAD. In the mitochondrial matrix the **link reaction** makes acetyl coenzyme A (releasing CO₂), and the **Krebs cycle** releases CO₂ and forms reduced NAD, reduced FAD and a little ATP. **Oxidative phosphorylation** on the cristae uses the electrons from reduced NAD and FAD; oxygen is the final electron acceptor, forming water. Without oxygen, pyruvate is converted to lactate (or ethanol in yeast), which **regenerates NAD** so glycolysis can continue.

## Worked calculations

**RQ:** a respiring tissue gives out 1.4 dm³ CO₂ while using 2.0 dm³ O₂, so RQ = 1.4 ÷ 2.0 = **0.7**, typical of lipid as the substrate (carbohydrate is about 1.0).

**Percentage change:** a rate rising from 3.0 to 4.5 units is a (4.5 − 3.0) ÷ 3.0 × 100 = **50%** increase.`,
      },
      quiz: {
        title: "Photosynthesis and respiration: Year 13 quiz",
        questions: [
          { key: "b5resp-y13-01", kind: "single", prompt: "Where in a chloroplast do the light-dependent reactions occur?", options: ["Stroma", "Thylakoid membranes", "Outer membrane", "Inner membrane space"], answer: "Thylakoid membranes", explanation: "Photosystems and the electron transport chain are in the thylakoid membranes of the grana. The Calvin cycle is in the stroma.", difficulty: 1 },
          { key: "b5resp-y13-02", kind: "single", prompt: "In which part of the cell does glycolysis take place?", options: ["Mitochondrial matrix", "Cristae", "Nucleus", "Cytoplasm"], answer: "Cytoplasm", explanation: "Glycolysis occurs in the cytoplasm and does not need oxygen.", difficulty: 1 },
          { key: "b5resp-y13-03", kind: "multi", prompt: "Which are products of the light-dependent reactions?", options: ["ATP", "Reduced NADP", "Oxygen", "Glucose", "Carbon dioxide"], answer: ["ATP", "Reduced NADP", "Oxygen"], explanation: "The light-dependent stage makes ATP, reduced NADP and oxygen (from photolysis). Glucose is made later using the Calvin cycle.", difficulty: 1 },
          { key: "b5resp-y13-04", kind: "single", prompt: "What is the role of water in the light-dependent reactions?", options: ["It is the final electron acceptor in the electron transport chain of the thylakoid", "It is split by photolysis to provide electrons, H⁺ ions and oxygen", "It combines with CO₂ and RuBP to make GP in the stroma", "It is reduced by reduced NADP to make glucose directly"], answer: "It is split by photolysis to provide electrons, H⁺ ions and oxygen", explanation: "Photolysis replaces electrons lost by chlorophyll, supplies H⁺ for reduced NADP and releases oxygen as a by-product.", difficulty: 2, diagnostic: true },
          { key: "b5resp-y13-05", kind: "single", prompt: "At point X the rate of photosynthesis has levelled off. What is the limiting factor at X?", options: ["Light intensity of the lamp", "Temperature of the leaf", "Carbon dioxide concentration", "Chlorophyll concentration"], answer: "Carbon dioxide concentration", explanation: "At the same light intensity the rate is higher with 0.10% CO₂, so CO₂ is limiting at X rather than light.", difficulty: 2, diagnostic: true, image: { file: "resp-light.png", alt: LIGHT_ALT } },
          { key: "b5resp-y13-06", kind: "single", prompt: "Which molecule combines with carbon dioxide in the Calvin cycle, catalysed by rubisco?", options: ["GP", "TP", "Pyruvate", "RuBP"], answer: "RuBP", explanation: "Rubisco fixes CO₂ onto ribulose bisphosphate (RuBP), forming two molecules of glycerate 3-phosphate (GP).", difficulty: 2 },
          { key: "b5resp-y13-07", kind: "number", prompt: "A sample of germinating seeds takes in 4.5 dm³ of oxygen and produces 3.6 dm³ of carbon dioxide. Calculate the respiratory quotient (RQ).", answer: 0.8, tolerance: 0.01, explanation: "RQ = CO₂ produced ÷ O₂ consumed = 3.6 ÷ 4.5 = 0.8.", difficulty: 2 },
          { key: "b5resp-y13-08", kind: "single", prompt: "Why does pyruvate convert to lactate during anaerobic respiration in muscle?", options: ["To regenerate NAD so glycolysis can continue", "To produce more ATP from the pyruvate that has been formed", "To remove oxygen from the cell so that fermentation can begin", "To make the Krebs cycle run faster in the mitochondrial matrix"], answer: "To regenerate NAD so glycolysis can continue", explanation: "Reduced NAD from glycolysis is reoxidised to NAD when pyruvate becomes lactate, allowing a small ATP yield to continue.", difficulty: 2 },
          { key: "b5resp-y13-09", kind: "short", prompt: "Name the final electron acceptor in the electron transport chain of aerobic respiration.", answer: "oxygen", accepted: ["O2", "O₂", "molecular oxygen", "oxygen (O2)", "oxygen (O₂)", "oxygen gas", "oxygen molecule", "an oxygen molecule", "oxygen.", "o2 molecule"], explanation: "Oxygen accepts electrons and H⁺ at the end of the chain, forming water.", difficulty: 2 },
          { key: "b5resp-y13-10", kind: "single", prompt: "How is ATP made during oxidative phosphorylation?", options: ["Enzymes transfer phosphate directly from glucose to ADP as the glucose is oxidised to pyruvate", "Oxygen splits into H⁺ and electrons in the matrix, and these are used to make ATP directly", "CO₂ combines with ADP in the mitochondrial matrix to form ATP and water", "H⁺ ions diffuse back through ATP synthase down an electrochemical gradient, driving ATP synthesis"], answer: "H⁺ ions diffuse back through ATP synthase down an electrochemical gradient, driving ATP synthesis", explanation: "Energy from electrons pumps H⁺ into the intermembrane space; the H⁺ flows back through ATP synthase (chemiosmosis), synthesising ATP.", difficulty: 2 },
          { key: "b5resp-y13-11", kind: "single", prompt: "Cyanide blocks the final enzyme of the electron transport chain. Why does the Krebs cycle also stop?", options: ["Cyanide destroys the enzymes of the Krebs cycle in the mitochondrial matrix", "Reduced NAD and reduced FAD cannot be reoxidised, so NAD and FAD run out", "The Krebs cycle needs light energy, which cyanide prevents the cell from absorbing", "Pyruvate cannot enter the cell, so no substrate reaches the mitochondria"], answer: "Reduced NAD and reduced FAD cannot be reoxidised, so NAD and FAD run out", explanation: "With the chain blocked, reduced coenzymes build up and the oxidised forms needed by the dehydrogenase steps of the Krebs cycle are no longer regenerated.", difficulty: 3 },
          { key: "b5resp-y13-12", kind: "number", prompt: "At light intensity 80 (point X), what is the percentage increase in the rate of photosynthesis when the carbon dioxide concentration is raised from 0.04% to 0.10%? Read values from the graph.", answer: 100, tolerance: 6, explanation: "At X, the rate is about 4.6 at 0.04% CO₂ and about 9.1 at 0.10% CO₂. Increase = (9.1 − 4.6) ÷ 4.6 × 100 ≈ 98%, so about 100% (the rate doubles).", difficulty: 3, image: { file: "resp-light.png", alt: LIGHT_ALT } },
          { key: "b5resp-y13-13", kind: "single", prompt: "Which statement is true of cyclic photophosphorylation but not of non-cyclic photophosphorylation?", options: ["Water is split by photolysis and oxygen is released as a by-product", "Photosystem II is used to absorb light and pass on electrons", "Only ATP is produced: no reduced NADP and no oxygen", "Reduced NADP is the main product and is used in the Calvin cycle"], answer: "Only ATP is produced: no reduced NADP and no oxygen", explanation: "In cyclic photophosphorylation electrons return to photosystem I, so only ATP is made; there is no photolysis and no reduced NADP.", difficulty: 3 },
          { key: "b5resp-y13-14", kind: "written", prompt: "Describe the reactions of the Calvin cycle and explain why a fall in temperature reduces the rate of photosynthesis even in bright light with plenty of carbon dioxide. (6 marks)", answer: "See mark scheme in the explanation.", explanation: "Mark scheme (6 marks): CO₂ combines with RuBP catalysed by rubisco; producing two molecules of GP; GP reduced to TP using ATP and reduced NADP from the light-dependent reactions; some TP regenerates RuBP (using ATP); some TP is converted to glucose, amino acids, lipids; low temperature reduces kinetic energy of enzymes and substrates so fewer enzyme–substrate complexes form; rubisco and other Calvin cycle enzymes are limiting.", difficulty: 3 },
        ],
      },
      flashcards: [
        { front: "Site of the light-dependent reactions", back: "Thylakoid membranes." },
        { front: "Site of the Calvin cycle", back: "Stroma of the chloroplast." },
        { front: "Photolysis", back: "Light-driven splitting of water into electrons, H⁺ and oxygen." },
        { front: "Calvin cycle: CO₂ acceptor and enzyme", back: "RuBP (5C) and rubisco; product is 2 × GP (3C)." },
        { front: "GP is converted to TP using...", back: "ATP and reduced NADP." },
        { front: "Glycolysis net yield per glucose", back: "2 pyruvate, net 2 ATP, 2 reduced NAD." },
        { front: "Site of the Krebs cycle", back: "Mitochondrial matrix." },
        { front: "Oxidative phosphorylation site and acceptor", back: "Cristae (inner membrane); oxygen is the final electron acceptor." },
        { front: "Why lactate formation?", back: "Regenerates NAD so glycolysis can continue without oxygen." },
        { front: "RQ", back: "CO₂ produced ÷ O₂ consumed: about 1.0 carbohydrate, 0.7 lipid." },
      ],
    },
  },
};
