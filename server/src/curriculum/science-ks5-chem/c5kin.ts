// A-level Chemistry — Kinetics (Year 12 collision theory; Year 13 rate equations, half-life, Arrhenius). Original content aligned to the DfE GCE AS/A-level chemistry subject content.
// Keys are recomputed by _chk_c5kin.ts — re-run _check_s6.ts after ANY edit here.
import type { CTopic } from "../types";
import { img, qb } from "./_h";

const q12 = qb("c5kin", 12);
const q13 = qb("c5kin", 13);
export const TOPIC: CTopic = {
  key: "c5kin",
  topic: "Chemistry — Kinetics",
  subject: "Science",
  years: {
    12: {
      year: 12,
      subtopic: "A-level Year 12 (AS)",
      objectives: [
        "Collision theory: activation energy and orientation of colliding particles.",
        "The Maxwell–Boltzmann distribution of molecular energies and the effect of temperature.",
        "Effect of concentration, pressure, surface area, temperature and catalysts on rate.",
        "Measuring rates of reaction; catalysts and their effect on activation energy.",
      ],
      note: {
        title: "Collision theory, Boltzmann distributions and catalysts",
        body: `## Collision theory

A reaction happens only when particles **collide** with **energy ≥ the activation energy Ea** and the **correct orientation**. Most collisions fail.

| Change | Effect on rate | Reason |
| --- | --- | --- |
| Higher concentration or pressure (gases) | Faster | More particles per unit volume, so more frequent collisions |
| Larger surface area | Faster | More exposed particles can collide |
| Higher temperature | Much faster | Particles move faster, but mainly a **larger proportion have E ≥ Ea** |
| Catalyst | Faster | Alternative route with **lower Ea**; not used up |

## Maxwell–Boltzmann distribution

The curve shows how many molecules have each energy. Key features: it starts at the origin (no molecules have zero energy), it is asymmetrical, the **area under the curve is the total number of molecules** (unchanged by temperature), and it never touches the axis at high energy. At a higher temperature the peak is **lower and moves right**, and the tail beyond Ea is larger. A catalyst does not change the curve; it moves Ea to the left.

A catalyst lowers Ea for the forward and reverse reactions by the same amount, and leaves ΔH unchanged. A **heterogeneous** catalyst is in a different phase (iron in the Haber process). A **homogeneous** catalyst is in the same phase.

## Measuring rate

Average rate = change in concentration ÷ time. Other methods: gas volume, mass loss, colour change (colorimeter), or timing a "disappearing cross". For that method rate ∝ 1 ÷ time.

## Worked example

In a gas-syringe experiment 36 cm³ of gas forms in 90 s.
Average rate = 36 ÷ 90 = **0.40 cm³ s⁻¹**.

If the rate of a reaction doubles for each 10 K rise, then heating from 20 °C to 40 °C makes it 2² = **4 times faster**.`,
      },
      quiz: {
        title: "Kinetics: Year 12 quiz",
        questions: [
          q12.single(1, "For two particles to react when they collide, which two conditions must be met?", "They must have at least the activation energy and collide with the correct orientation",
            ["They must have the same mass and the same charge", "They must collide at exactly the activation energy and at any angle", "They must be at the same temperature as the surroundings and be in the same state"],
            "Collision theory needs energy of at least Ea and a suitable orientation. Many collisions have too little energy or the wrong orientation, so they do not lead to reaction."),
          q12.single(1, "How does a catalyst increase the rate of a reaction?", "It provides an alternative reaction route with a lower activation energy",
            ["It increases the energy of the reactant molecules", "It changes ΔH so that the reaction becomes more exothermic and releases its energy faster", "It is used up to form extra product"],
            "A catalyst is not consumed and does not change ΔH. It offers a different pathway with lower Ea, so more collisions succeed."),
          q12.single(2, "The diagram shows Maxwell–Boltzmann distributions for the same gas at two temperatures, with the activation energy marked. Which statement is correct?", "Curve B is at the higher temperature, because a greater proportion of its molecules have energy at least equal to Ea",
            ["Curve A is at the higher temperature, because its peak is higher", "Curve B is at the higher temperature, because it has a greater area under the curve", "Curve A is at the higher temperature, because fewer molecules have energy below Ea"],
            "At higher temperature the peak is lower and moves right, with a bigger tail beyond Ea. The area under both curves is the same because the number of molecules is the same.",
            { diag: true, image: img("boltzmann.png", "Two Maxwell–Boltzmann distribution curves for the same gas, sharing axes of energy (horizontal) and number of molecules (vertical). Curve A has a taller peak at lower energy and a small tail. Curve B has a lower, broader peak further right and a larger tail. A vertical dashed line marked Ea lies in the tail region; more of the area under curve B is to the right of it.") }),
          q12.single(2, "Why does doubling the concentration of a reactant in solution increase the rate of reaction?", "There are more particles in each unit volume, so collisions happen more frequently",
            ["The activation energy is halved", "Each particle has more energy", "A greater proportion of the particles have energy above the activation energy, so more of the collisions are successful"],
            "Concentration changes how often particles collide, not how much energy they have or the value of Ea."),
          q12.num(1, "The concentration of a reactant falls from 0.200 mol dm⁻³ to 0.140 mol dm⁻³ in 40 s. Calculate the average rate in mol dm⁻³ s⁻¹.", 0.0015, 0.00005,
            "Average rate = change in concentration ÷ time = (0.200 − 0.140) ÷ 40 = 0.060 ÷ 40 = 1.5 × 10⁻³ mol dm⁻³ s⁻¹."),
          q12.single(2, "A rise in temperature of 10 °C can roughly double the rate of a reaction. What is the main reason?", "Many more molecules have energy at least equal to Ea",
            ["The collision frequency doubles, so twice as many successful collisions happen each second", "The activation energy halves", "The number of molecules doubles"],
            "A 10 °C rise increases collision frequency by only a few per cent. The big effect is that the proportion of molecules with E ≥ Ea increases substantially."),
          q12.multi(2, "Which changes would increase the rate of reaction of magnesium with dilute hydrochloric acid?", ["Using magnesium powder instead of ribbon", "Raising the temperature"],
            ["Using a more dilute acid", "Using a larger single lump of magnesium of the same mass"],
            "Powder has a larger surface area and higher temperature increases the fraction of successful collisions. Dilute acid or a lump lowers the rate."),
          q12.short(1, "Name the metal catalyst used in the Haber process for making ammonia.", "iron", ["Fe", "iron catalyst", "Iron", "Fe (iron)"],
            "The Haber process, N₂ + 3H₂ ⇌ 2NH₃, uses an iron catalyst, which is heterogeneous (a solid in a gas mixture)."),
          q12.single(2, "A catalyst is added to an exothermic reaction. Which is correct?", "Ea decreases and ΔH stays the same",
            ["Ea stays the same and ΔH becomes more negative", "Ea decreases and ΔH becomes less negative", "Ea increases and ΔH stays the same"],
            "A catalyst only lowers the barrier. It does not change the energy of reactants or products, so ΔH is unchanged."),
          q12.single(2, "In a 'disappearing cross' experiment, the time for the cross to vanish was 80 s at one concentration and 41 s at double that concentration. What is the rate at the higher concentration compared with the lower?", "About twice as fast",
            ["About half as fast", "About four times as fast", "About the same"],
            "Rate is proportional to 1 ÷ time. (1 ÷ 41) ÷ (1 ÷ 80) = 80 ÷ 41 ≈ 1.95, so about twice as fast.", { diag: true }),
          q12.multi(3, "Which statements about a Maxwell–Boltzmann distribution are correct?", ["The area under the curve equals the total number of molecules", "The curve starts at the origin"],
            ["The peak shows the mean energy of the molecules", "The curve meets the energy axis at high energy"],
            "No molecules have zero energy, so the curve starts at the origin. The curve approaches but never touches the axis at high energy, and the peak is the most probable energy, not the mean."),
          q12.written(3, "Explain, using a Boltzmann distribution, why a small increase in temperature can cause a large increase in the rate of reaction. (4 marks)",
            "Sketch/describe the distribution at two temperatures with Ea marked. At higher T the peak moves right and is lower, the area is the same, and the proportion of molecules with E ≥ Ea increases greatly. More successful collisions per second, so the rate increases.",
            "Mark scheme (4): (1) area under the curves is equal because the number of molecules is unchanged; (2) at the higher temperature the peak moves to the right/lower and the curve broadens; (3) a much greater proportion of molecules has energy ≥ Ea; (4) so more collisions per second are successful (collision frequency rises only slightly).", 4),
          q12.num(3, "The rate of a reaction doubles for every 10 K rise in temperature. By what factor does the rate increase when the temperature is raised from 30 °C to 60 °C?", 8, 0,
            "A 30 K rise contains three 10 K steps. The rate doubles each time: 2 × 2 × 2 = 8."),
          q12.single(3, "An exothermic reaction has ΔH = −60 kJ mol⁻¹ and Ea = 90 kJ mol⁻¹. A catalyst lowers the forward Ea to 55 kJ mol⁻¹. What is the activation energy of the reverse reaction without and with the catalyst?", "150 kJ mol⁻¹ and 115 kJ mol⁻¹",
            ["90 kJ mol⁻¹ and 55 kJ mol⁻¹", "150 kJ mol⁻¹ and 55 kJ mol⁻¹", "30 kJ mol⁻¹ and −5 kJ mol⁻¹"],
            "Reverse Ea = forward Ea + |ΔH| = 90 + 60 = 150. With the catalyst: 55 + 60 = 115. Both barriers fall by 35 kJ mol⁻¹ because ΔH is unchanged."),
        ],
      },
      flashcards: [
        { front: "Two conditions for a successful collision", back: "Energy ≥ activation energy and correct orientation." },
        { front: "Activation energy", back: "The minimum energy colliding particles need for a reaction to occur." },
        { front: "Effect of higher concentration on rate", back: "More particles per unit volume, so more frequent collisions." },
        { front: "Why does a small temperature rise greatly increase rate?", back: "A much larger proportion of molecules have E ≥ Ea." },
        { front: "Maxwell–Boltzmann: what stays the same at higher T?", back: "The area under the curve (total number of molecules)." },
        { front: "Maxwell–Boltzmann: what changes at higher T?", back: "Peak moves right and lower; more molecules beyond Ea." },
        { front: "How a catalyst works", back: "Provides an alternative pathway with lower Ea; not used up; ΔH unchanged." },
        { front: "Heterogeneous vs homogeneous catalyst", back: "Different phase from the reactants (e.g. Fe in Haber) vs same phase." },
        { front: "Average rate of reaction", back: "Change in concentration (or volume, mass) ÷ time." },
        { front: "Disappearing cross: rate ∝ ?", back: "1 ÷ time." },
      ],
    },
    13: {
      year: 13,
      subtopic: "A-level Year 13 (A2)",
      objectives: [
        "Rate equations: orders of reaction, rate constant k and its units; initial-rates method.",
        "Concentration–time and rate–concentration graphs; half-life of a first-order reaction.",
        "Rate-determining step and reaction mechanisms.",
        "The Arrhenius equation, ln k against 1/T and calculating Ea.",
      ],
      note: {
        title: "Rate equations, half-life and the Arrhenius equation",
        body: `## Rate equations

For A + B → products, **rate = k[A]ᵐ[B]ⁿ**. The **order** m or n is found only by experiment. The **overall order** is m + n. Doubling [A] multiplies the rate by 2ᵐ: order 0 has no effect, order 1 doubles it, order 2 quadruples it. The rate constant **k** depends on temperature (and catalyst) but not on concentration.

| Overall order | Units of k |
| --- | --- |
| 0 | mol dm⁻³ s⁻¹ |
| 1 | s⁻¹ |
| 2 | dm³ mol⁻¹ s⁻¹ |
| 3 | dm⁶ mol⁻² s⁻¹ |

**Initial rates**: compare experiments where only one concentration changes. **Half-life**: for a first-order reaction t½ is constant and **k = ln 2 ÷ t½ = 0.693 ÷ t½**.

The **rate-determining step** is the slowest step. Species in the rate equation appear in (or before) that step.

## The Arrhenius equation

**k = A e^(−Ea/RT)** so **ln k = ln A − Ea/(RT)**. A plot of ln k (y) against 1/T (x) is a straight line with **gradient = −Ea/R** (R = 8.31 J K⁻¹ mol⁻¹). Two temperatures give ln(k₂/k₁) = (Ea/R)(1/T₁ − 1/T₂).

## Worked examples

**Finding k.** Rate = k[A] with rate 4.5 × 10⁻⁴ mol dm⁻³ s⁻¹ when [A] = 0.15 mol dm⁻³: k = 4.5 × 10⁻⁴ ÷ 0.15 = **3.0 × 10⁻³ s⁻¹**.

**Effect of temperature.** Ea = 75 kJ mol⁻¹, warming from 298 K to 308 K:
ln(k₂/k₁) = (75 000 ÷ 8.31)(1/298 − 1/308) = 0.983, so k₂/k₁ = e^0.983 = **2.67**.`,
      },
      quiz: {
        title: "Kinetics: Year 13 quiz",
        questions: [
          q13.single(1, "For a reaction with rate = k[A]²[B], doubling [A] while keeping [B] the same changes the rate by which factor?", "4", ["2", "3", "8"],
            "The reaction is second order in A, so the rate changes by 2² = 4."),
          q13.num(2, "Initial rates for A + B → products: Experiment 1: [A] = 0.10, [B] = 0.10, rate = 2.0 × 10⁻³. Experiment 2: [A] = 0.20, [B] = 0.10, rate = 8.0 × 10⁻³. Experiment 3: [A] = 0.10, [B] = 0.20, rate = 4.0 × 10⁻³ (concentrations in mol dm⁻³, rates in mol dm⁻³ s⁻¹). What is the overall order of the reaction?", 3, 0,
            "Exp 1 → 2: [A] doubles and rate ×4, so order 2 in A. Exp 1 → 3: [B] doubles and rate ×2, so order 1 in B. Overall order = 2 + 1 = 3.", { diag: true }),
          q13.num(2, "Using the same data (rate = k[A]²[B]; Experiment 1: [A] = 0.10, [B] = 0.10 mol dm⁻³, rate = 2.0 × 10⁻³ mol dm⁻³ s⁻¹), calculate the value of the rate constant k in dm⁶ mol⁻² s⁻¹ to 3 significant figures.", 2.00, 0.02,
            "k = rate ÷ ([A]²[B]) = 2.0 × 10⁻³ ÷ (0.10² × 0.10) = 2.0 × 10⁻³ ÷ 1.0 × 10⁻³ = 2.00 dm⁶ mol⁻² s⁻¹."),
          q13.single(1, "What are the units of the rate constant for a first-order reaction?", "s⁻¹", ["mol dm⁻³ s⁻¹", "dm³ mol⁻¹ s⁻¹", "mol⁻¹ dm³"],
            "Rate (mol dm⁻³ s⁻¹) = k × [A] (mol dm⁻³), so k has units s⁻¹."),
          q13.single(2, "The graph shows how the concentration of reactant A changes with time. What is the order of reaction with respect to A?", "First order",
            ["Zero order", "Second order", "It cannot be found from a concentration–time graph"],
            "Successive half-lives are constant: [A] falls from 0.80 to 0.40 in 50 s, then to 0.20 in the next 50 s. A constant half-life is the signature of first order.",
            { diag: true, image: img("halflife.png", "Graph of concentration of A in mol dm⁻³ (vertical, 0 to 0.80) against time in seconds (horizontal, 0 to 200), a smooth curve falling from 0.80 at time zero and levelling towards zero. Grid lines every 0.10 mol dm⁻³ and every 25 seconds.") }),
          q13.num(2, "A first-order reaction has a half-life of 50.0 s. Calculate the rate constant k in s⁻¹ to 3 significant figures.", 0.0139, 0.0002,
            "k = ln 2 ÷ t½ = 0.693 ÷ 50.0 = 0.0139 s⁻¹."),
          q13.single(3, "The reaction 2A + B → C has the rate equation rate = k[A]². Which mechanism is consistent with this?", "Step 1 (slow): 2A → X; Step 2 (fast): X + B → C",
            ["Step 1 (slow): A + B → X; Step 2 (fast): X + A → C", "Step 1 (fast): 2A → X; Step 2 (slow): X + B → C", "Step 1 (slow): B → Y; Step 2 (fast): Y + 2A → C"],
            "Only species in the slow step (and before it) appear in the rate equation. Here the slow step contains 2A and no B, giving rate = k[A]². The step in which B is involved is fast, so B does not appear."),
          q13.num(3, "The Arrhenius plot of ln k against 1/T is shown for a reaction, with two points on the line labelled. Calculate the activation energy in kJ mol⁻¹ to 3 significant figures. (R = 8.31 J K⁻¹ mol⁻¹)", 60.0, 0.6,
            "Gradient = (−2.55 − 0.34) ÷ (0.00340 − 0.00300) = −7225 K. Ea = −gradient × R = 7225 × 8.31 = 6.00 × 10⁴ J mol⁻¹ = 60.0 kJ mol⁻¹.",
            { image: img("arrhenius.png", "Arrhenius plot: ln k on the vertical axis (from about −4 to 2) against 1/T in K⁻¹ (0.00290 to 0.00350) on the horizontal axis. A straight line slopes downwards from left to right. Two points on the line are labelled: (0.00300, 0.34) and (0.00340, −2.55).") }),
          q13.single(2, "Which quantity is equal to the gradient of a graph of ln k (y-axis) against 1/T (x-axis)?", "−Ea ÷ R", ["Ea ÷ R", "−Ea", "ln A"],
            "ln k = ln A − (Ea ÷ R)(1/T), which is y = c + mx with m = −Ea ÷ R and intercept ln A."),
          q13.num(3, "A reaction has activation energy 50.0 kJ mol⁻¹. At 300 K the rate constant is 2.00 × 10⁻³ s⁻¹. Calculate k at 310 K in s⁻¹ to 3 significant figures. (R = 8.31 J K⁻¹ mol⁻¹)", 0.00382, 0.00003,
            "ln(k₂/k₁) = (Ea ÷ R)(1/T₁ − 1/T₂) = (50 000 ÷ 8.31)(1/300 − 1/310) = 0.647. k₂/k₁ = e^0.647 = 1.91, so k₂ = 2.00 × 10⁻³ × 1.91 = 3.82 × 10⁻³ s⁻¹."),
          q13.multi(2, "Which changes alter the value of the rate constant k for a reaction?", ["Increasing the temperature", "Adding a catalyst"],
            ["Doubling the concentration of a reactant", "Doubling the volume of the reaction mixture at the same concentrations"],
            "k depends only on temperature and catalyst (through Ea and A). Concentration and volume affect the rate, but not k."),
          q13.num(1, "The rate equation for a reaction is rate = k[A][B]². What is the order with respect to B?", 2, 0,
            "The order with respect to a reactant is the power to which its concentration is raised in the rate equation, so B is second order."),
          q13.num(2, "A reaction has the rate equation rate = k[A]²[B]. The concentration of A is tripled and the concentration of B is halved. By what factor does the rate change?", 4.5, 0.01,
            "Tripling [A] multiplies the rate by 3² = 9. Halving [B] multiplies it by 0.5. Overall factor = 9 × 0.5 = 4.5."),
          q13.single(1, "A graph of rate against concentration of A is a horizontal straight line. What is the order with respect to A?", "Zero order",
            ["First order", "Second order", "Negative first order"],
            "If the rate does not depend on [A], the reaction is zero order in A and the rate–concentration graph is flat."),
        ],
      },
      flashcards: [
        { front: "General rate equation", back: "Rate = k[A]ᵐ[B]ⁿ; orders found only by experiment." },
        { front: "Effect of doubling [A] for order 0, 1, 2", back: "Rate unchanged (×1), ×2, ×4." },
        { front: "Units of k: orders 0, 1, 2, 3", back: "mol dm⁻³ s⁻¹; s⁻¹; dm³ mol⁻¹ s⁻¹; dm⁶ mol⁻² s⁻¹." },
        { front: "Half-life of a first-order reaction", back: "Constant; k = ln 2 ÷ t½ = 0.693 ÷ t½." },
        { front: "Rate–concentration graph shapes", back: "Zero order: horizontal line. First order: straight line through the origin. Second order: upward curve." },
        { front: "Rate-determining step", back: "The slowest step in the mechanism; it fixes the species in the rate equation." },
        { front: "Arrhenius equation", back: "k = A e^(−Ea/RT)" },
        { front: "Linear form of the Arrhenius equation", back: "ln k = ln A − Ea/(RT); plot ln k vs 1/T, gradient = −Ea/R." },
        { front: "What affects the value of k?", back: "Temperature and catalyst only (not concentration)." },
        { front: "Initial-rates method", back: "Change one concentration at a time and compare initial rates to deduce each order." },
      ],
    },
  },
};
