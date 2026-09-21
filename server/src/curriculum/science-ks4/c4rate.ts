// GCSE Chemistry — Rates & Equilibrium (Year 11).
import type { CTopic } from "../types";
import { N, S, M, yr } from "./_h";
import { RATE } from "./_imgdata";

const IMG = ["c4rate-graph.png", "A graph of volume of hydrogen gas in cm³ against time in seconds for two experiments. Experiment 1 is a curve that rises quickly at first then levels off at 60 cm³ by 100 seconds. Experiment 2 is a steeper curve that reaches the same final volume of 60 cm³ earlier, at about 80 seconds."] as [string, string];
const firstMax = (t: number[], v: number[]) => t[v.indexOf(Math.max(...v))];

export const TOPIC: CTopic = {
  key: "c4rate", topic: "Chemistry — Rates & Equilibrium", subject: "Science",
  years: {
    11: yr("c4rate", 11, {
      obj: [
        "Calculate the mean rate of reaction from quantity of product or reactant per unit time; draw and interpret rate graphs (tangents at higher tier).",
        "Explain the effects of temperature, concentration, pressure, surface area and catalysts using collision theory and activation energy.",
        "Describe reversible reactions and dynamic equilibrium.",
        "Predict the effect of changing temperature, pressure and concentration on equilibrium position (Le Chatelier, higher tier).",
        "Required practical: investigate how changes in concentration affect the rate of reaction (gas volume or colour/turbidity).",
      ],
      note: ["GCSE Chemistry: rates of reaction and equilibrium", `## Rate of reaction
mean rate = quantity of product formed (or reactant used) ÷ time.
Units: cm³/s, g/s or mol/s. On a graph of product against time, a **steeper** line means a **faster** rate and the line **levels off** when a reactant is used up.

## Collision theory
Reactions happen when particles **collide** with at least the **activation energy**. Rate increases with:
| Change | Reason |
| --- | --- |
| Higher temperature | faster particles: more collisions, and more with enough energy |
| Higher concentration / pressure | more particles in the same volume, so more frequent collisions |
| Larger surface area | more exposed particles to collide with |
| Catalyst | alternative route with lower activation energy; not used up |

## Reversible reactions
A ⇌ B. In a **closed system** at **dynamic equilibrium** the forward and reverse rates are equal, so the concentrations stay constant.
**Le Chatelier (higher tier):** if a condition is changed, the equilibrium shifts to oppose the change. Higher pressure favours the side with fewer gas molecules; raising temperature favours the endothermic direction.

## Worked example
12 cm³ of gas is collected in the first 30 s: mean rate = 12 ÷ 30 = **0.4 cm³/s**.
Sodium thiosulfate practical: the cross disappears in 50 s at 25 °C and 25 s at 35 °C. Rate ∝ 1 ÷ time, so the rate has doubled.

**Working scientifically:** change only one variable, repeat, and use the same measuring point (e.g. the cross disappearing) each time.`],
      quiz: "GCSE Chemistry: Rates & Equilibrium quiz",
      qs: [
        S(1, "Which change will increase the rate of a reaction?", "Increasing the temperature", ["Decreasing the concentration", "Using larger lumps of solid", "Removing the catalyst"], "Higher temperature makes particles move faster, so they collide more often and with more energy.", {}),
        S(1, "What does a catalyst do to a reaction?", "Speeds it up without being used up", ["Slows the reaction down", "Increases the amount of product made", "Becomes part of the product"], "A catalyst gives an alternative route with lower activation energy and is unchanged at the end.", {}),
        S(1, "Which symbol shows a reversible reaction?", "⇌", ["→", "=", "↑"], "⇌ shows that the reaction can go in both directions.", {}),
        N(2, "Use the graph. Calculate the mean rate of reaction of Experiment 1 over the first 20 seconds, in cm³/s.", 1.4, 0.05, "Mean rate = volume ÷ time = 28 ÷ 20 = 1.4 cm³/s.", () => (RATE.v1[1] - RATE.v1[0]) / (RATE.t[1] - RATE.t[0]), { img: IMG, diag: true }),
        N(2, "Use the graph. At what time (in seconds) does the reaction in Experiment 1 first reach its final volume?", 100, 10, "The line becomes horizontal at 60 cm³, first reached at about 100 s.", () => firstMax(RATE.t, RATE.v1), { img: IMG }),
        S(2, "Magnesium was the limiting reactant in both experiments. Which change could explain the steeper curve of Experiment 2?", "A higher temperature", ["A lower temperature", "Larger pieces of magnesium", "Twice the mass of magnesium"], "The same final volume shows the same amount of magnesium reacted. A faster rate could come from higher temperature; larger pieces would slow it and more magnesium would give more gas.", { img: IMG }),
        S(2, "Why does increasing temperature increase the rate of reaction?", "Particles move faster, so they collide more often and more collisions have enough energy", ["The activation energy of the reaction is lowered, so every collision leads to a reaction", "There are more particles in the same volume of solution, so collisions are more frequent", "The particles expand and get bigger, so they collide with each other more often"], "Higher temperature increases both the collision frequency and the proportion of collisions with at least the activation energy.", {}),
        S(2, "Why does powdered marble react faster with acid than marble chips of the same mass?", "The powder has a larger surface area, so more collisions happen per second", ["The powder has a higher concentration of calcium carbonate than the chips", "The powder acts as a catalyst for the reaction with the acid", "The powder has a lower activation energy than the chips"], "Powder exposes more particles to the acid, so more collisions occur each second.", {}),
        M(2, "Which statements about catalysts are correct? Choose all that apply.", ["They are not used up in the reaction", "They lower the activation energy by giving an alternative pathway"], ["They increase the yield at equilibrium", "They give the reactant particles more energy"], "Catalysts speed up both forward and reverse reactions equally, so they do not change the equilibrium yield. They lower the activation energy rather than heating particles.", {}),
        S(2, "What is true at dynamic equilibrium in a closed system?", "The rates of the forward and reverse reactions are equal", ["The reactions stop", "All reactants have become products", "The concentrations of the reactants and the products are equal"], "Both reactions continue, but at the same rate, so the concentrations stay constant (not necessarily equal).", { diag: true }),
        N(3, "Using the graph, how many times greater is the mean rate of Experiment 2 over its whole reaction (to 80 s) than Experiment 1 over its whole reaction (to 100 s)? Give a number.", 1.25, 0.01, "Experiment 2: 60 ÷ 80 = 0.75 cm³/s. Experiment 1: 60 ÷ 100 = 0.60 cm³/s. 0.75 ÷ 0.60 = 1.25.", () => (60 / firstMax(RATE.t, RATE.v2)) / (60 / firstMax(RATE.t, RATE.v1)), { img: IMG }),
        S(3, "N₂ + 3H₂ ⇌ 2NH₃ (forward reaction exothermic). What is the effect of increasing the pressure?", "The equilibrium shifts right because there are fewer gas molecules on the right", ["The equilibrium shifts left because there are fewer gas molecules on the right", "The equilibrium does not change", "The reaction rate falls"], "There are 4 gas molecules on the left and 2 on the right. Higher pressure favours the side with fewer molecules, increasing the yield of ammonia.", { chk: () => (1 + 3 > 2 ? "The equilibrium shifts right because there are fewer gas molecules on the right" : "x") }),
        S(3, "Why is a compromise temperature of about 450 °C used in the Haber process?", "A lower temperature gives more ammonia but is too slow; a higher one is fast but reduces the yield", ["Ammonia only forms at exactly 450 °C, so the temperature cannot be changed", "A higher temperature increases both the rate and the yield, but 450 °C is the hottest the reactor can safely go", "A lower temperature is fast but gives less ammonia; a higher one is slow but gives a bigger yield"], "The forward reaction is exothermic, so high temperature lowers the equilibrium yield, but low temperature makes the reaction too slow. 450 °C balances rate and yield.", {}),
      ],
      cards: [
        ["Mean rate equation", "quantity of product (or reactant) ÷ time."],
        ["Units of rate", "cm³/s, g/s or mol/s."],
        ["On a rate graph, what does a steeper line mean?", "A faster rate."],
        ["What does the plateau show?", "A reactant has been used up; the reaction has finished."],
        ["Collision theory", "Particles must collide with at least the activation energy."],
        ["Four ways to increase rate", "Higher temperature, higher concentration/pressure, larger surface area, catalyst."],
        ["How does a catalyst work?", "Provides an alternative pathway with lower activation energy."],
        ["Reversible reaction symbol", "⇌."],
        ["Dynamic equilibrium", "Forward and reverse rates equal in a closed system; concentrations constant."],
        ["Le Chatelier's principle", "The system shifts to oppose any change in conditions."],
        ["Higher pressure favours", "The side with fewer gas molecules."],
        ["Raising temperature favours", "The endothermic direction."],
      ],
    }),
  },
};
