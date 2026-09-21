// A-level Physics — Measurements & Uncertainties (Year 12). Original content aligned to the DfE GCE AS/A-level physics subject content.
// Keys are recomputed by _chk_p5meas.ts — re-run _check_s7.ts after ANY edit here.
import type { CTopic } from "../types";
import { img, qb } from "./_h";

const q = qb("p5meas", 12);
export const TOPIC: CTopic = {
  key: "p5meas",
  topic: "Physics — Measurements & Uncertainties",
  subject: "Science",
  years: {
    12: {
      year: 12,
      subtopic: "A-level Year 12 (AS)",
      objectives: [
        "SI base units (m, kg, s, A, K, mol), derived units in base units, prefixes from pico to giga, and checking equations for homogeneity.",
        "Random and systematic errors; precision, accuracy, resolution, repeatability and reproducibility; zero errors.",
        "Absolute, fractional and percentage uncertainty; combining uncertainties when adding, subtracting, multiplying, dividing and raising to powers.",
        "Straight-line graphs: gradient and intercept, error bars, and uncertainty in a gradient from best and worst acceptable lines.",
        "Planning experiments and evaluating measurements and conclusions.",
      ],
      note: {
        title: "Units, errors and uncertainty",
        body: `## Key ideas

Every measurement has an **uncertainty**. **Random errors** scatter readings either side of the true value, so repeating and taking a mean reduces them. **Systematic errors** (such as a zero error) shift every reading the same way, so repeating does not remove them. Readings are **precise** if they cluster together and **accurate** if they are close to the true value. **Resolution** is the smallest change an instrument can show.

| Idea | Rule |
| --- | --- |
| Percentage uncertainty | (Δx ÷ x) × 100 |
| Add or subtract quantities | add the absolute uncertainties |
| Multiply or divide | add the percentage uncertainties |
| Power xⁿ | multiply the percentage uncertainty by n |
| Prefixes | n = 10⁻⁹, μ = 10⁻⁶, m = 10⁻³, k = 10³, M = 10⁶, G = 10⁹ |

SI base units are the metre, kilogram, second, ampere, kelvin and mole. Derived units reduce to them: 1 N = 1 kg m s⁻² and 1 J = 1 kg m² s⁻². An equation is **homogeneous** if every term has the same base units.

## Worked example 1

A wire has diameter 0.62 ± 0.01 mm. The percentage uncertainty in d is 0.01 ÷ 0.62 × 100 = 1.6%. Its cross-sectional area is proportional to d², so the percentage uncertainty in the area is 2 × 1.6% = **3.2%**.

## Worked example 2

Two lengths are x = 25.0 ± 0.5 cm and y = 10.0 ± 0.3 cm. The difference is x − y = 15.0 cm and the absolute uncertainties add: 0.5 + 0.3 = 0.8 cm, giving **15.0 ± 0.8 cm**.

**Graphs:** draw the best-fit line and the steepest and shallowest acceptable lines. The uncertainty in the gradient is ½ (maximum gradient − minimum gradient).`,
      },
      quiz: {
        title: "Measurements & Uncertainties: Year 12 quiz",
        questions: [
          q.single(1, "Which of these is NOT an SI base unit?", "newton", ["kelvin", "ampere", "kilogram"], "The newton is a derived unit (kg m s⁻²). The kelvin, ampere and kilogram are all base units."),
          q.single(1, "A pulse lasts 45 ns. Express this in seconds.", "4.5 × 10⁻⁸ s", ["4.5 × 10⁻⁶ s", "4.5 × 10⁻⁹ s", "4.5 × 10⁻⁷ s"], "Nano means 10⁻⁹, so 45 ns = 45 × 10⁻⁹ s = 4.5 × 10⁻⁸ s."),
          q.num(2, "A length is measured as 84.0 cm with an absolute uncertainty of ±0.6 cm. Calculate the percentage uncertainty, to 2 significant figures.", 0.71, 0.01, "Percentage uncertainty = (0.6 ÷ 84.0) × 100 = 0.714…%, which is 0.71% to 2 s.f.", { diag: true }),
          q.num(2, "A metal block has mass 250 ± 5 g and volume 40 ± 2 cm³. Calculate the percentage uncertainty in its density.", 7, 0.1, "Density = mass ÷ volume, so percentage uncertainties add: 5 ÷ 250 = 2% and 2 ÷ 40 = 5%, giving 7%."),
          q.single(2, "Five readings of a resistor known to be 50.0 Ω are 47.2, 47.3, 47.2, 47.3 and 47.2 Ω. Which description is best?", "Precise but not accurate", ["Accurate but not precise", "Both precise and accurate", "Neither precise nor accurate"], "The readings are very close to each other (precise) but all about 2.8 Ω from the true value (not accurate), which suggests a systematic error."),
          q.multi(2, "Which TWO of these are systematic errors?", ["A voltmeter reads 0.10 V when it is disconnected", "A metre rule has a worn end so every length reads 2 mm too short"], ["The reaction time in starting a stopwatch varies from trial to trial", "Electrical noise makes the readings fluctuate unpredictably"], "Systematic errors push every reading the same way (zero error, worn rule). Variable reaction time and noise are random errors."),
          q.num(2, "The radius of a sphere is measured as 3.00 ± 0.06 cm. The volume is proportional to r³. Calculate the percentage uncertainty in the volume.", 6, 0.1, "The percentage uncertainty in r is 0.06 ÷ 3.00 × 100 = 2%. For a cube power multiply by 3: 3 × 2% = 6%.", { diag: true }),
          q.single(2, "Which equation is homogeneous (has the same base units on both sides)? s = displacement, u and v = velocity, a = acceleration, t = time.", "s = ut + ½at²", ["v = u + at²", "s = ut + ½at", "v² = u² + 2at²"], "Every term in s = ut + ½at² has units of metres. In the others the terms have different units (for example at² is m, not m s⁻¹)."),
          q.short(2, "Write the unit of pressure, the pascal (Pa = N m⁻²), in SI base units.", "kg m⁻¹ s⁻²", ["kg m-1 s-2", "kg m^-1 s^-2", "kgm⁻¹s⁻²", "kg/(m s²)", "kg m⁻¹s⁻²", "kg/(m s^2)", "kg/(m s2)", "kg/(ms²)", "kg/(ms^2)", "kg/m/s²", "kg/m/s^2", "kg/m/s2", "kg m-1s-2", "kgm-1s-2", "kg m^-1s^-2", "kg·m⁻¹·s⁻²", "kg m^(-1) s^(-2)", "kg m-1 s-2", "kg m⁻¹ s⁻²"], "N = kg m s⁻² and pressure is force ÷ area, so Pa = kg m s⁻² ÷ m² = kg m⁻¹ s⁻²."),
          q.num(3, "The graph shows T² against L for a simple pendulum. The line of best fit passes through the two marked points A and B. Use T² = 4π²L ÷ g to find g, in m s⁻², to 3 significant figures.", 9.8, 0.05, "The gradient is (3.62 − 0.80) ÷ (0.90 − 0.20) = 4.03 s² m⁻¹. Since T² = (4π² ÷ g) L, g = 4π² ÷ gradient = 39.48 ÷ 4.03 = 9.80 m s⁻².", { image: img("p5meas-y12-pendulum.png", "A scatter graph of T squared in seconds squared against length L in metres for a pendulum, with five data points and a straight line of best fit through the origin region. Point A on the line is at L = 0.20 m, T squared = 0.80 s squared, and point B is at L = 0.90 m, T squared = 3.62 s squared.") }),
          q.num(3, "A graph has a best-fit gradient of 12.4. The steepest acceptable line has gradient 13.1 and the shallowest has gradient 11.9. Calculate the percentage uncertainty in the gradient, to 2 significant figures.", 4.8, 0.1, "The uncertainty is ½ (13.1 − 11.9) = 0.6. As a percentage of 12.4 this is 0.6 ÷ 12.4 × 100 = 4.8%."),
          q.num(3, "A student finds g from g = 4π²L ÷ T² using L = 0.358 ± 0.002 m and T = 1.20 ± 0.02 s. Calculate the percentage uncertainty in g, to 2 significant figures.", 3.9, 0.1, "L: 0.002 ÷ 0.358 = 0.56%. T: 0.02 ÷ 1.20 = 1.67%, doubled for T² gives 3.33%. Add: 0.56% + 3.33% = 3.9%."),
          q.written(3, "Plan an experiment to determine the acceleration of free fall g by timing a small steel ball dropped through several measured heights. Describe (a) what you would measure and with what instruments, (b) how you would reduce random and systematic errors, and (c) how you would analyse the results, including how you would find the uncertainty in g. [6 marks]", "Measure heights h (metre rule or scale, e.g. 0.20–1.00 m) and fall times t (electronic timer with light gates or electromagnet release); repeat each height and average; use release by electromagnet to avoid reaction time (systematic); check zero of ruler and timer; measure h from bottom of ball to trapdoor; plot h against t² (s = ½gt²) so gradient = g/2; draw best-fit and worst-acceptable lines, gradient uncertainty = ½(max−min); percentage uncertainty in g equals that of the gradient.", "Mark scheme (1 mark each, max 6): heights measured with a rule and times with an electronic timer or light gates; repeat and average times at each height (reduces random error); use an electromagnet release or light gates rather than a hand-started stopwatch (removes reaction-time systematic error); check for zero errors; plot h against t² (or t² against h) using s = ½gt²; gradient = g ÷ 2 (so g = 2 × gradient); use best-fit and worst acceptable lines to find the uncertainty in the gradient, hence in g; or combine percentage uncertainties of h and t."),
        ],
      },
      flashcards: [
        { front: "Random error: how is it reduced?", back: "Repeat the measurement and take the mean. Readings scatter either side of the true value." },
        { front: "Systematic error", back: "Shifts every reading the same way (e.g. a zero error). Repeating does not remove it: fix the method or calibrate." },
        { front: "Precise vs accurate", back: "Precise = readings close together. Accurate = close to the true value." },
        { front: "Percentage uncertainty", back: "(absolute uncertainty ÷ measured value) × 100." },
        { front: "Adding or subtracting quantities: uncertainty?", back: "Add the absolute uncertainties." },
        { front: "Multiplying or dividing quantities: uncertainty?", back: "Add the percentage (fractional) uncertainties." },
        { front: "Uncertainty in xⁿ", back: "Multiply the percentage uncertainty in x by n." },
        { front: "Uncertainty in a gradient", back: "½ (steepest acceptable gradient − shallowest acceptable gradient)." },
        { front: "The six SI base units used at A-level", back: "metre, kilogram, second, ampere, kelvin, mole." },
        { front: "1 newton in base units", back: "1 N = 1 kg m s⁻²." },
        { front: "Prefixes n, μ, m, k, M, G", back: "10⁻⁹, 10⁻⁶, 10⁻³, 10³, 10⁶, 10⁹." },
      ],
    },
  },
};
