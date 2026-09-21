// A-level Biology — Enzymes (Year 12). Original content aligned to the DfE GCE AS/A-level biology subject content.
import type { CTopic } from "../types";

const PROG_ALT = "A graph of volume of oxygen collected in cm³ against time in seconds. The blue curve rises steeply from the origin and flattens, reaching about 20 cm³ by 100 seconds; dots mark readings at 10 s (about 6.5 cm³), 20 s (11 cm³), 30 s (14 cm³), 40 s (16 cm³) and later. A red dashed tangent is drawn at time zero, passing through the origin and the 20 cm³ level at 25 seconds.";
const SUB_ALT = "A graph of initial rate against substrate concentration from 0 to 40 mmol per dm³. The no-inhibitor curve rises steeply and levels off near 10. Inhibitor A's curve rises more slowly but climbs towards the same maximum of about 10. Inhibitor B's curve rises steeply at first but levels off much lower, at about 5.";

export const TOPIC: CTopic = {
  key: "b5enz",
  topic: "Biology — Enzymes",
  subject: "Science",
  years: {
    12: {
      year: 12,
      subtopic: "A-level Year 12 (AS)",
      objectives: [
        "Enzymes as biological catalysts: activation energy, active site, lock-and-key and induced-fit models.",
        "Effects of temperature, pH, enzyme concentration and substrate concentration on rate.",
        "Competitive and non-competitive inhibition; end-product inhibition.",
        "Measuring and calculating rates of enzyme-controlled reactions; investigating enzyme activity.",
      ],
      note: {
        title: "Enzymes: how they work and how to measure their rates",
        body: `## How enzymes work

Enzymes are globular proteins that **lower the activation energy** of a reaction by holding substrates in the **active site**, forming an **enzyme–substrate complex**. In the **induced-fit** model the active site changes shape slightly as the substrate binds, which puts strain on bonds. Each enzyme is specific because its tertiary structure gives its active site a unique shape.

| Factor | Effect on rate |
| --- | --- |
| Temperature ↑ | More kinetic energy, more collisions, so rate rises to an optimum; above it hydrogen bonds break and the enzyme **denatures** |
| pH away from optimum | Ionic and hydrogen bonds change, altering the active site |
| Substrate concentration ↑ | Rate rises then plateaus when all active sites are occupied |
| Enzyme concentration ↑ | Rate rises proportionally while substrate is in excess |

## Inhibitors

A **competitive inhibitor** resembles the substrate and blocks the active site; its effect is reduced by more substrate. A **non-competitive inhibitor** binds elsewhere (an allosteric site), changing the active-site shape, so the maximum rate falls even with lots of substrate. In **end-product inhibition** the final product of a pathway inhibits an early enzyme, a form of negative feedback.

## Measuring rate

Rate = amount of product formed (or substrate used) ÷ time. From a graph of product against time, the **initial rate** is the gradient of a tangent at time zero. Rate can also be estimated as 1 ÷ time taken for a colour change.

## Worked calculations

**Rate:** an enzyme forms 9 cm³ of gas in 12 s, so rate = 9 ÷ 12 = **0.75 cm³ s⁻¹**.

**Making a dilution:** to make 100 cm³ of 0.5 mol dm⁻³ from a 2.0 mol dm⁻³ stock, the stock is 0.5 ÷ 2.0 = ¼ of the volume: **25 cm³** stock + **75 cm³** water.`,
      },
      quiz: {
        title: "Enzymes: Year 12 quiz",
        questions: [
          { key: "b5enz-y12-01", kind: "single", prompt: "How do enzymes speed up biological reactions?", options: ["By raising the temperature of the reaction", "By providing energy from ATP", "By lowering the activation energy", "By being used up in the reaction"], answer: "By lowering the activation energy", explanation: "Enzymes are catalysts: they provide an alternative pathway with a lower activation energy and are not used up.", difficulty: 1 },
          { key: "b5enz-y12-02", kind: "single", prompt: "Which statement best describes the induced-fit model?", options: ["The active site changes shape slightly as the substrate binds", "The substrate fits a rigid active site exactly, like a key in a lock", "The substrate changes the shape of the whole enzyme so it denatures", "The enzyme changes shape permanently after one reaction"], answer: "The active site changes shape slightly as the substrate binds", explanation: "In induced fit the active site is flexible and moulds around the substrate, which strains bonds and lowers activation energy.", difficulty: 1 },
          { key: "b5enz-y12-03", kind: "multi", prompt: "Which of these affect the rate of an enzyme-controlled reaction?", options: ["Temperature", "pH", "Enzyme concentration", "Substrate concentration", "The colour of the container"], answer: ["Temperature", "pH", "Enzyme concentration", "Substrate concentration"], explanation: "Temperature, pH and the concentrations of enzyme and substrate all alter rate; container colour does not.", difficulty: 1 },
          { key: "b5enz-y12-04", kind: "number", prompt: "The graph shows oxygen collected over time. Use the tangent at time zero to calculate the initial rate of reaction in cm³ s⁻¹.", answer: 0.8, tolerance: 0.05, explanation: "The initial rate is the gradient of the tangent: change in volume ÷ change in time = 20 cm³ ÷ 25 s = 0.8 cm³ s⁻¹.", difficulty: 2, diagnostic: true, image: { file: "enz-progress.png", alt: PROG_ALT } },
          { key: "b5enz-y12-05", kind: "single", prompt: "Why does the rate of a reaction gradually slow down over the course of an experiment (the curve flattens)?", options: ["The enzyme is gradually used up as it converts substrate into product", "The temperature of the mixture falls as the reaction proceeds", "The product raises the activation energy of the reaction as it accumulates", "Substrate is used up, so fewer enzyme–substrate complexes form"], answer: "Substrate is used up, so fewer enzyme–substrate complexes form", explanation: "Enzymes are not used up; as substrate concentration falls, collisions with active sites become less frequent and the rate drops.", difficulty: 2 },
          { key: "b5enz-y12-06", kind: "single", prompt: "Which inhibitor is a competitive inhibitor, and why?", options: ["Inhibitor B, because it lowers the maximum rate even when the substrate concentration is very high", "Inhibitor A, because a high substrate concentration overcomes its effect and reaches the same maximum rate", "Inhibitor A, because it has permanently changed the enzyme's shape", "Both, because both reduce the rate at low substrate concentrations"], answer: "Inhibitor A, because a high substrate concentration overcomes its effect and reaches the same maximum rate", explanation: "A competitive inhibitor competes for the active site, so extra substrate outcompetes it and the maximum rate is unchanged, as with A. B lowers the maximum rate.", difficulty: 2, diagnostic: true, image: { file: "enz-substrate.png", alt: SUB_ALT } },
          { key: "b5enz-y12-07", kind: "multi", prompt: "Which statements about inhibitor B are correct?", options: ["It binds at a site other than the active site", "It reduces the maximum rate, even at very high substrate concentrations", "It competes with the substrate for the active site", "Adding more substrate cancels out its effect"], answer: ["It binds at a site other than the active site", "It reduces the maximum rate, even at very high substrate concentrations"], explanation: "B's lower plateau shows non-competitive inhibition: it binds an allosteric site and puts some enzyme molecules out of action, however much substrate is present.", difficulty: 2, image: { file: "enz-substrate.png", alt: SUB_ALT } },
          { key: "b5enz-y12-08", kind: "number", prompt: "Milk clears (a protease breaks down its protein) in 80 s at 20 °C and in 40 s at 30 °C. By what factor has the rate of reaction increased? (Rate is proportional to 1 ÷ time.)", answer: 2, explanation: "Rate ∝ 1/t. Rate at 30 °C ÷ rate at 20 °C = (1/40) ÷ (1/80) = 80 ÷ 40 = 2.", difficulty: 2 },
          { key: "b5enz-y12-09", kind: "single", prompt: "Why does an enzyme stop working at an extreme pH?", options: ["The substrate is denatured, so it can no longer bind to the active site of the enzyme", "The peptide bonds in the enzyme are formed instead of broken, so the polypeptide chain gets longer", "Excess H⁺ or OH⁻ ions change the ionic and hydrogen bonds, altering the shape of the active site", "The activation energy of the reaction increases because the substrate has a higher energy at extreme pH"], answer: "Excess H⁺ or OH⁻ ions change the ionic and hydrogen bonds, altering the shape of the active site", explanation: "The ions disrupt bonding in the tertiary structure, so the active site no longer matches the substrate.", difficulty: 2 },
          { key: "b5enz-y12-10", kind: "number", prompt: "You need 200 cm³ of 0.10 mol dm⁻³ substrate solution and your stock is 2.0 mol dm⁻³. What volume of distilled water, in cm³, must be added to the stock?", answer: 190, explanation: "Stock needed = 200 × (0.10 ÷ 2.0) = 10 cm³, so add 200 − 10 = 190 cm³ of water.", difficulty: 2 },
          { key: "b5enz-y12-11", kind: "number", prompt: "Using the readings at 20 s and 40 s on the graph, calculate the mean rate of reaction between 20 s and 40 s in cm³ s⁻¹.", answer: 0.25, tolerance: 0.05, explanation: "Volume at 20 s is about 11 cm³ and at 40 s about 16 cm³: (16 − 11) ÷ (40 − 20) = 5 ÷ 20 = 0.25 cm³ s⁻¹. It is lower than the initial rate because substrate has been used up.", difficulty: 3, image: { file: "enz-progress.png", alt: PROG_ALT } },
          { key: "b5enz-y12-12", kind: "single", prompt: "A student heats a catalase solution to 70 °C, finds it has no activity, then cools it to 30 °C and finds it is still inactive. What is the best explanation?", options: ["The enzyme was irreversibly denatured: its tertiary structure and active site were permanently changed", "Cooling reduced the kinetic energy of the substrate, so fewer collisions occurred with the active site", "The enzyme was used up during the reaction at 70 °C, so none was left to catalyse it again", "The activation energy is higher at 30 °C than at 70 °C, so the reaction cannot restart when cooled"], answer: "The enzyme was irreversibly denatured: its tertiary structure and active site were permanently changed", explanation: "High temperature broke hydrogen and ionic bonds so the tertiary structure changed; cooling does not restore the original shape.", difficulty: 3 },
          { key: "b5enz-y12-13", kind: "single", prompt: "In a metabolic pathway the end product inhibits the first enzyme. What is the advantage of this?", options: ["It makes the pathway run faster when the product is plentiful, so the cell stores more of it", "It permanently destroys the first enzyme so it can be replaced", "It raises the substrate concentration for the later steps so the product is made faster", "It stops the cell making more product than it needs, a form of negative feedback"], answer: "It stops the cell making more product than it needs, a form of negative feedback", explanation: "When product accumulates it inhibits an early enzyme; when levels fall the inhibition lifts. This saves resources and keeps the product concentration stable.", difficulty: 3 },
          { key: "b5enz-y12-14", kind: "written", prompt: "Describe how you would investigate the effect of pH on the rate of catalase activity in liver, naming the variables you would control and how you would improve the reliability of your results. (6 marks)", answer: "See mark scheme in the explanation.", explanation: "Mark scheme (6 marks): independent variable = pH using buffers (e.g. 4 to 10) measured with a pH meter/indicator; dependent variable = volume of oxygen collected in a set time (or height of froth/time for disc to rise); control temperature (water bath), enzyme/liver mass or surface area, hydrogen peroxide concentration and volume; equilibrate solutions before mixing; repeat at least three times for each pH and calculate a mean; discard anomalies; use a control (no enzyme); safety: hydrogen peroxide is an irritant.", difficulty: 3 },
        ],
      },
      flashcards: [
        { front: "Why are enzymes specific?", back: "The tertiary structure gives the active site a unique shape complementary to one substrate." },
        { front: "What is the active site?", back: "The region of an enzyme where the substrate binds and the reaction occurs." },
        { front: "Effect of an enzyme on activation energy", back: "Lowers it." },
        { front: "What happens when an enzyme denatures?", back: "Bonds in the tertiary structure break, the active site changes shape and substrate no longer fits." },
        { front: "Why does rate plateau as substrate rises?", back: "All active sites are occupied; enzyme concentration becomes limiting." },
        { front: "Competitive inhibitor", back: "Similar shape to substrate, binds the active site; effect reduced by more substrate." },
        { front: "Non-competitive inhibitor", back: "Binds elsewhere, changes active-site shape; maximum rate falls, not overcome by more substrate." },
        { front: "Initial rate from a graph", back: "Gradient of a tangent drawn at time zero." },
        { front: "End-product inhibition", back: "Final product inhibits an early enzyme: negative feedback." },
        { front: "Rate from time taken", back: "Rate is proportional to 1 ÷ time." },
      ],
    },
  },
};
