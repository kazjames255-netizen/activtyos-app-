// A-level Biology — Control Systems & Homeostasis (Year 13). Original content aligned to the DfE GCE AS/A-level biology subject content.
// Computable keys recomputed by _check_s5.ts.
import type { CTopic } from "../types";

const AP_ALT = "A graph of membrane potential in millivolts against time in milliseconds from 0 to 6. The line starts flat at minus 70, rises gradually to the dashed threshold line at minus 55 millivolts at about 1 millisecond, then shoots up to a peak of plus 40 at about 1.5 milliseconds. It falls back down through zero, undershoots to about minus 80 at about 2.6 milliseconds, then returns to minus 70 by about 4.6 milliseconds and stays flat.";
const GLU_ALT = "A line graph of blood glucose in mmol per dm³ against time after a carbohydrate meal from 0 to 4 hours for two people. Person A (blue) starts at 4.8, rises slightly to a peak of 6.9 at 0.75 hours and returns to about 4.8 by 3 hours. Person B (orange) starts at 9.0, rises to a peak of 16.0 at 1 to 1.5 hours and is still 10.5 at 4 hours.";

export const TOPIC: CTopic = {
  key: "b5ctrl",
  topic: "Biology — Control Systems & Homeostasis",
  subject: "Science",
  years: {
    13: {
      year: 13,
      subtopic: "A-level Year 13 (A2)",
      objectives: [
        "Resting potential and action potential; the refractory period; speed of conduction and myelination.",
        "Synaptic transmission and summation; the sliding-filament model of muscle contraction.",
        "Homeostasis and negative feedback; control of blood glucose by insulin, glucagon and adrenaline; second messengers.",
        "Control of water potential: osmoreceptors, ADH and the kidney; regulation of heart rate.",
      ],
      note: {
        title: "Control systems: nerves, muscles and hormones",
        body: `## Nerve impulses

A neurone at rest has a **resting potential** of about −70 mV (inside negative) because the sodium–potassium pump moves 3 Na⁺ out for 2 K⁺ in and the membrane is more permeable to K⁺. A stimulus opens some Na⁺ channels; if depolarisation reaches the **threshold** (about −55 mV) many voltage-gated Na⁺ channels open (positive feedback) and Na⁺ floods in, giving an **action potential** (peak about +40 mV). Na⁺ channels close and K⁺ channels open, **repolarising** the membrane. The **refractory period** ensures impulses travel one way and are discrete. In myelinated neurones the impulse jumps between nodes of Ranvier (**saltatory conduction**), which is much faster.

At a **synapse**, Ca²⁺ enters the presynaptic knob, vesicles release neurotransmitter, which binds to receptors and opens Na⁺ channels in the postsynaptic membrane.

## Muscle and hormones

In muscle, Ca²⁺ binds troponin, tropomyosin moves aside and myosin heads bind actin and pull (**sliding filament**), using ATP.

| Term | Meaning |
| --- | --- |
| Negative feedback | Change is detected and reversed, restoring the set point |
| Insulin | From β cells; lowers blood glucose |
| Glucagon | From α cells; raises blood glucose |
| Second messenger | Molecule (such as cAMP) that relays a hormone signal inside a cell |
| ADH | Increases water reabsorption in the collecting duct |

## Homeostasis

High blood glucose → β cells secrete insulin → cells take up glucose and the liver forms glycogen. Low glucose → α cells secrete glucagon → glycogenolysis and gluconeogenesis. A hormone that cannot enter a cell binds a surface receptor, which activates an enzyme that makes **cAMP**; the second messenger amplifies the signal. In dehydration, osmoreceptors in the hypothalamus trigger **ADH** release, and more aquaporins insert in the collecting duct.

## Worked calculations

**Conduction velocity:** an impulse travels 0.30 m in 4.0 ms: 0.30 ÷ 0.0040 = **75 m s⁻¹**.

**Heart rate:** a cardiac cycle of 0.8 s gives 60 ÷ 0.8 = **75 beats per minute**.`,
      },
      quiz: {
        title: "Control systems and homeostasis: Year 13 quiz",
        questions: [
          { key: "b5ctrl-y13-01", kind: "single", prompt: "What is the approximate value of the resting potential of a neurone?", options: ["+40 mV", "0 mV", "−55 mV", "−70 mV"], answer: "−70 mV", explanation: "The inside of a resting neurone is about 70 mV negative relative to the outside.", difficulty: 1 },
          { key: "b5ctrl-y13-02", kind: "single", prompt: "Which cells of the pancreas secrete insulin?", options: ["α cells of the islets of Langerhans", "β cells of the islets of Langerhans", "δ cells of the islets of Langerhans", "Acinar cells that secrete digestive enzymes"], answer: "β cells of the islets of Langerhans", explanation: "β cells secrete insulin when blood glucose is high; α cells secrete glucagon.", difficulty: 1 },
          { key: "b5ctrl-y13-03", kind: "multi", prompt: "Which hormones act to raise blood glucose concentration?", options: ["Glucagon", "Insulin", "Adrenaline", "ADH"], answer: ["Glucagon", "Adrenaline"], explanation: "Glucagon and adrenaline promote glycogenolysis; insulin lowers glucose; ADH controls water reabsorption.", difficulty: 1 },
          { key: "b5ctrl-y13-04", kind: "number", prompt: "Use the graph to calculate the change in membrane potential, in mV, from the resting potential to the peak of the action potential.", answer: 110, explanation: "Resting = −70 mV and peak = +40 mV, so the change is 40 − (−70) = 110 mV.", difficulty: 2, diagnostic: true, image: { file: "ctrl-ap.png", alt: AP_ALT } },
          { key: "b5ctrl-y13-05", kind: "single", prompt: "What causes the rapid rise in membrane potential from −55 mV to +40 mV?", options: ["K⁺ ions rapidly leaving the cell through voltage-gated channels", "The sodium–potassium pump working faster to move Na⁺ into the cell", "Voltage-gated Na⁺ channels opening so Na⁺ rushes into the cell", "Cl⁻ ions rapidly leaving the cell through open channels"], answer: "Voltage-gated Na⁺ channels opening so Na⁺ rushes into the cell", explanation: "Once threshold is reached, more voltage-gated Na⁺ channels open (positive feedback) and Na⁺ diffuses in down its electrochemical gradient.", difficulty: 2, image: { file: "ctrl-ap.png", alt: AP_ALT } },
          { key: "b5ctrl-y13-06", kind: "single", prompt: "Why does the membrane potential fall below the resting potential (to about −80 mV) after the action potential?", options: ["Voltage-gated K⁺ channels are slow to close, so extra K⁺ diffuses out", "Na⁺ channels reopen too soon, so more Na⁺ enters and the membrane hyperpolarises", "The sodium–potassium pump stops working, so K⁺ builds up outside the neurone", "Ca²⁺ ions enter the cell through voltage-gated channels and make the inside more negative"], answer: "Voltage-gated K⁺ channels are slow to close, so extra K⁺ diffuses out", explanation: "K⁺ channels stay open a little too long, so too many K⁺ leave: hyperpolarisation, which also contributes to the refractory period.", difficulty: 3, image: { file: "ctrl-ap.png", alt: AP_ALT } },
          { key: "b5ctrl-y13-07", kind: "single", prompt: "Why are impulses faster in myelinated neurones?", options: ["Myelin makes Na⁺ channels open faster along the whole axon", "Myelinated neurones have bigger action potentials than unmyelinated ones", "The impulse travels along the myelin sheath itself, which conducts it like a wire", "The impulse jumps between nodes of Ranvier (saltatory conduction)"], answer: "The impulse jumps between nodes of Ranvier (saltatory conduction)", explanation: "Myelin insulates the axon so depolarisation happens only at the gaps (nodes), and the impulse effectively jumps from node to node.", difficulty: 2 },
          { key: "b5ctrl-y13-08", kind: "single", prompt: "What is the role of Ca²⁺ ions at a cholinergic synapse?", options: ["They bind to receptors on the postsynaptic membrane and directly depolarise the next neurone", "They enter the presynaptic knob and cause vesicles to fuse with the membrane and release neurotransmitter", "They break down the neurotransmitter in the synaptic cleft so that the response is short-lived", "They open Na⁺ channels in the presynaptic membrane so that the action potential can spread"], answer: "They enter the presynaptic knob and cause vesicles to fuse with the membrane and release neurotransmitter", explanation: "The arriving action potential opens voltage-gated Ca²⁺ channels; Ca²⁺ entry triggers exocytosis of vesicles containing acetylcholine.", difficulty: 2 },
          { key: "b5ctrl-y13-09", kind: "single", prompt: "What happens when calcium ions are released into a muscle fibre?", options: ["They break the myosin heads away from actin so that the muscle fibre can relax", "They provide the energy for the power stroke directly by binding to the myosin head", "They bind to troponin, causing tropomyosin to move and expose myosin-binding sites on actin", "They convert ATP to ADP outside the cell, releasing energy for the sliding filaments"], answer: "They bind to troponin, causing tropomyosin to move and expose myosin-binding sites on actin", explanation: "Ca²⁺ binds troponin; tropomyosin shifts so myosin heads can attach to actin and contraction occurs.", difficulty: 2, diagnostic: true },
          { key: "b5ctrl-y13-10", kind: "single", prompt: "Which best explains the results for Person B?", options: ["Person B lacks insulin or cannot respond to it, so glucose is not taken up and stored as glycogen quickly", "Person B has produced too much insulin, so the liver has released extra glucose into the blood", "Person B has too many glucagon receptors on liver cells, so more glycogen is broken down after the meal", "Person B has absorbed glucose from the gut more slowly than Person A, so it has stayed in the blood for longer"], answer: "Person B lacks insulin or cannot respond to it, so glucose is not taken up and stored as glycogen quickly", explanation: "High fasting glucose, a large peak and a slow return show poor glucose uptake and glycogenesis, as in diabetes.", difficulty: 2, diagnostic: true, image: { file: "ctrl-glucose.png", alt: GLU_ALT } },
          { key: "b5ctrl-y13-11", kind: "number", prompt: "By how much does Person A's blood glucose concentration rise from the start to its peak, in mmol dm⁻³?", answer: 2.1, tolerance: 0.1, explanation: "Peak is 6.9 and the starting value is 4.8, so the rise is 6.9 − 4.8 = 2.1 mmol dm⁻³.", difficulty: 2, image: { file: "ctrl-glucose.png", alt: GLU_ALT } },
          { key: "b5ctrl-y13-12", kind: "single", prompt: "Why do glucagon and adrenaline act via a second messenger (cAMP) rather than entering cells?", options: ["They are too small to bind to surface receptors, so they must be detected by cAMP inside the cell", "They are broken down by enzymes in the cytoplasm as soon as they enter, so cAMP is made from the fragments", "They are made inside the target cells, so there is no need for a receptor on the cell-surface membrane", "They cannot cross the phospholipid bilayer, and the cascade amplifies the signal so one hormone molecule causes many enzyme activations"], answer: "They cannot cross the phospholipid bilayer, and the cascade amplifies the signal so one hormone molecule causes many enzyme activations", explanation: "These hormones are not lipid-soluble; they bind to a surface receptor, activating adenylyl cyclase to make cAMP, which activates enzymes in a cascade.", difficulty: 3 },
          { key: "b5ctrl-y13-13", kind: "single", prompt: "A person becomes dehydrated. Which sequence is correct?", options: ["Osmoreceptors detect blood water potential rising → less ADH is released → dilute urine is produced", "Osmoreceptors in the hypothalamus detect blood water potential falling → posterior pituitary releases more ADH → more water reabsorbed in the collecting duct", "The kidney nephron detects dehydration in the filtrate → secretes ADH into the blood", "Blood water potential rises → osmoreceptors in the hypothalamus signal the posterior pituitary to release more ADH"], answer: "Osmoreceptors in the hypothalamus detect blood water potential falling → posterior pituitary releases more ADH → more water reabsorbed in the collecting duct", explanation: "Dehydration lowers blood water potential; ADH increases the permeability of the collecting duct to water so more is reabsorbed and urine is more concentrated.", difficulty: 3 },
          { key: "b5ctrl-y13-14", kind: "written", prompt: "Describe how a nerve impulse is transmitted along a myelinated axon and then across a synapse to the next neurone. (6 marks)", answer: "See mark scheme in the explanation.", explanation: "Mark scheme (6 marks): depolarisation to threshold opens voltage-gated Na⁺ channels, Na⁺ enters, action potential; local currents depolarise the next node so the impulse jumps between nodes of Ranvier (saltatory conduction); at the synaptic knob voltage-gated Ca²⁺ channels open; Ca²⁺ entry causes vesicles to fuse with the presynaptic membrane and release neurotransmitter; neurotransmitter diffuses across the cleft and binds to receptors on the postsynaptic membrane; opens Na⁺ channels, depolarising the postsynaptic membrane (and if threshold is reached a new action potential starts).", difficulty: 3 },
        ],
      },
      flashcards: [
        { front: "Resting potential of a neurone", back: "About −70 mV (inside negative)." },
        { front: "Sodium–potassium pump", back: "Moves 3 Na⁺ out and 2 K⁺ in using ATP." },
        { front: "Threshold potential", back: "About −55 mV: triggers more voltage-gated Na⁺ channels to open." },
        { front: "Refractory period", back: "Time when Na⁺ channels cannot reopen: impulses are discrete and one-way." },
        { front: "Saltatory conduction", back: "Impulse jumps between nodes of Ranvier in myelinated axons: faster." },
        { front: "Synapse: role of Ca²⁺", back: "Enters presynaptic knob, triggers vesicle fusion and neurotransmitter release." },
        { front: "Sliding filament trigger", back: "Ca²⁺ binds troponin, tropomyosin moves, myosin binds actin." },
        { front: "Insulin vs glucagon", back: "Insulin (β cells) lowers blood glucose; glucagon (α cells) raises it." },
        { front: "Second messenger", back: "cAMP relays the hormone signal inside the cell and amplifies it." },
        { front: "ADH action", back: "Makes the collecting duct more permeable: more water reabsorbed, more concentrated urine." },
      ],
    },
  },
};
