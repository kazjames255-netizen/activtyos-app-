// A-level Physics — Nuclear Physics (Year 13). Original content aligned to the DfE GCE AS/A-level physics subject content.
// Keys are recomputed by _chk_p5nuc.ts — re-run _check_s7.ts after ANY edit here.
import type { CTopic } from "../types";
import { img, qb } from "./_h";

const q = qb("p5nuc", 13);
export const TOPIC: CTopic = {
  key: "p5nuc",
  topic: "Physics — Nuclear Physics",
  subject: "Science",
  years: {
    13: {
      year: 13,
      subtopic: "A-level Year 13 (A2)",
      objectives: [
        "Properties of alpha, beta and gamma radiation; decay equations conserving nucleon number and charge.",
        "The random, spontaneous nature of decay; activity A = λN; the decay constant and half-life t½ = ln 2 ÷ λ.",
        "The exponential decay law N = N₀e^(−λt) and A = A₀e^(−λt); background radiation and corrected count rates.",
        "Nuclear radius R = r₀A^(1/3) and nuclear density; the inverse-square law for gamma radiation.",
        "Applications (radiocarbon dating, medical tracers) and safety.",
      ],
      note: {
        title: "Radioactive decay, half-life and nuclear size",
        body: `## Key ideas

Radioactive decay is **spontaneous** (not affected by temperature or chemistry) and **random** (we can only give the probability that a nucleus decays). **Alpha** (⁴₂He) is strongly ionising and stopped by paper; **beta⁻** (a fast electron) is stopped by a few mm of aluminium; **gamma** is weakly ionising, very penetrating, and obeys an inverse-square law.

In any decay, nucleon number A and charge Z are conserved: β⁻ decay increases Z by 1 (n → p + e⁻ + ν̄ₑ); α decay reduces A by 4 and Z by 2.

The **activity** A = λN, where λ is the **decay constant** (probability of decay per second). The number of undecayed nuclei falls exponentially, **N = N₀e^(−λt)**, and the **half-life** is **t½ = ln 2 ÷ λ**. Subtract the **background count** before finding a half-life.

| Idea | Formula |
| --- | --- |
| Activity | A = λN (unit: becquerel, Bq) |
| Decay law | N = N₀e^(−λt), A = A₀e^(−λt) |
| Half-life | t½ = ln 2 ÷ λ = 0.693 ÷ λ |
| Nuclear radius | R = r₀A^(1/3), r₀ ≈ 1.2 fm |
| Inverse-square law | I ∝ 1 ÷ r² |

## Worked example 1

A sample has 8.0 × 10⁶ nuclei of an isotope with half-life 6.0 h. After 18 h (3 half-lives) there are 8.0 × 10⁶ ÷ 2³ = **1.0 × 10⁶** nuclei.

## Worked example 2

For t½ = 6.0 h = 21 600 s, λ = 0.693 ÷ 21 600 = **3.2 × 10⁻⁵ s⁻¹**.

## Worked example 3

If 5.0 × 10⁹ nuclei have λ = 2.0 × 10⁻⁵ s⁻¹, the activity is A = λN = **1.0 × 10⁵ Bq**.`,
      },
      quiz: {
        title: "Nuclear Physics: Year 13 quiz",
        questions: [
          q.single(1, "Which type of radiation is stopped by a few millimetres of aluminium but not by paper?", "beta minus (β⁻)", ["alpha (α)", "gamma (γ)", "all three types are stopped by paper"], "Alpha is stopped by paper; beta by a few mm of aluminium; gamma needs thick lead or concrete to reduce it."),
          q.single(1, "What is an alpha particle made of?", "2 protons and 2 neutrons", ["2 protons and 2 electrons", "a fast electron", "high-energy photons"], "An alpha particle is a helium-4 nucleus: 2 protons and 2 neutrons, charge +2e."),
          q.single(2, "Thorium-234 (Z = 90, A = 234) decays by β⁻ emission. What are the proton number and nucleon number of the daughter nucleus?", "Z = 91, A = 234", ["Z = 89, A = 234", "Z = 90, A = 233", "Z = 88, A = 230"], "In β⁻ decay a neutron becomes a proton, so Z increases by 1 (to 91) while the nucleon number A stays at 234.", { diag: true }),
          q.num(2, "The activity of a sample is 1200 Bq and its half-life is 3.0 days. Calculate its activity after 12 days, in Bq.", 75, 0.5, "12 days = 4 half-lives. Activity halves each time: 1200 → 600 → 300 → 150 → 75 Bq."),
          q.num(2, "Iodine-131 has a half-life of 8.0 days. Calculate its decay constant, in units of 10⁻⁶ s⁻¹, to 3 significant figures.", 1, 0.005, "t½ = 8.0 × 86 400 = 6.912 × 10⁵ s. λ = ln 2 ÷ t½ = 0.6931 ÷ 6.912 × 10⁵ = 1.00 × 10⁻⁶ s⁻¹.", { diag: true }),
          q.num(2, "A sample contains 3.0 × 10¹⁵ radioactive nuclei with a decay constant of 2.5 × 10⁻⁹ s⁻¹. Calculate its activity, in MBq.", 7.5, 0.05, "A = λN = 2.5 × 10⁻⁹ × 3.0 × 10¹⁵ = 7.5 × 10⁶ Bq = 7.5 MBq."),
          q.num(2, "A sample initially has 5.0 × 10¹⁰ nuclei of an isotope with decay constant 0.045 h⁻¹. Calculate the number of undecayed nuclei after 30 h, in units of 10¹⁰, to 3 significant figures.", 1.3, 0.005, "N = N₀e^(−λt) = 5.0 × 10¹⁰ × e^(−0.045 × 30) = 5.0 × 10¹⁰ × e^(−1.35) = 5.0 × 10¹⁰ × 0.2592 = 1.30 × 10¹⁰."),
          q.num(3, "The graph shows the measured count rate from a radioactive source and the background radiation. Use the graph to determine the half-life of the source, in minutes, to 2 significant figures.", 8, 0.4, "First subtract the background of 20 counts min⁻¹: the corrected rate is 180 at t = 0. It falls to half (90 corrected, so 110 measured) at t = 8.0 min, so the half-life is 8.0 min. (Using the raw counts wrongly gives about 9.4 min.)", { image: img("p5nuc-y13-decay.png", "A graph of count rate in counts per minute against time in minutes for a radioactive source. The measured curve starts at 200 counts per minute at time zero and falls in an exponential decay towards, but staying above, a dashed horizontal line labelled background at 20 counts per minute. Gridlines every 2 minutes and 20 counts per minute allow values to be read.") }),
          q.num(3, "Living wood has a corrected count rate of 15.3 counts per minute per gram from carbon-14. An ancient sample gives 3.8 counts per minute per gram. Calculate its age, in years, to 3 significant figures. (half-life of carbon-14 = 5730 years)", 11500, 100, "The activity ratio is 15.3 ÷ 3.8 = 4.03 = 2^n, so n = ln 4.03 ÷ ln 2 = 2.01 half-lives. Age = 2.01 × 5730 = 11 500 years."),
          q.num(2, "The radius of a nucleus is given by R = r₀A^(1/3) with r₀ = 1.2 fm. Calculate the radius of a uranium-238 nucleus, in fm, to 3 significant figures.", 7.44, 0.02, "A^(1/3) = 238^(1/3) = 6.197. R = 1.2 × 6.197 = 7.44 fm."),
          q.num(2, "A small gamma source gives a count rate of 240 counts per second at a distance of 0.50 m. Ignoring background, calculate the count rate at 1.5 m, in counts per second, to 3 significant figures.", 26.7, 0.1, "Inverse-square law: the distance is 3 times larger so the rate falls by 3² = 9. 240 ÷ 9 = 26.7 counts per second."),
          q.num(3, "A source of half-life 2.0 hours has an activity of 4.0 × 10⁶ Bq. Calculate the number of radioactive nuclei present, in units of 10¹⁰, to 3 significant figures.", 4.15, 0.02, "λ = ln 2 ÷ (2.0 × 3600) = 9.63 × 10⁻⁵ s⁻¹. N = A ÷ λ = 4.0 × 10⁶ ÷ 9.63 × 10⁻⁵ ≈ 4.15 × 10¹⁰ (4.155 × 10¹⁰ with the unrounded λ; 4.15 or 4.16 are both accepted)."),
          q.multi(2, "Which TWO statements about radioactive decay are correct?", ["It is impossible to predict when an individual nucleus will decay", "The half-life is not changed by raising the temperature of the source"], ["Gamma rays are deflected by a magnetic field", "The activity of a source stays constant over time"], "Decay is random and spontaneous, so external conditions do not change it. Gamma rays are uncharged so they are not deflected, and activity falls with time."),
          q.written(3, "Describe an experiment to determine the half-life of a short-lived radioactive source, such as a protactinium generator. Include the equipment, how you would deal with background radiation, and the safety precautions. [6 marks]", "Use a GM tube connected to a counter/ratemeter placed near the source in a fixed position. First measure the background count rate over a long time (with the source absent) and calculate the average count per unit time. Then record the counts in equal time intervals (e.g. every 10 s) as the source decays, subtract the background from each, and plot corrected count rate against time (or ln of the rate against time). Read off the time for the corrected rate to halve several times and average, or use t½ = ln 2 / λ from the gradient of the ln graph. Precautions: handle with tongs, keep sources away from the body, limit time near sources, store in a lead-lined container, do not point the source at people and wash hands afterwards.", "Mark scheme (max 6): GM tube and counter or ratemeter with the source at a fixed position; measure background count rate with no source present (long counting time) and subtract; record counts at regular time intervals; plot corrected count rate against time and read successive half-lives (average), or plot ln(rate) against time and use gradient = −λ; t½ = ln 2 ÷ λ; safety: tongs, distance, short exposure, store in lead-lined box / do not point at people / wash hands."),
        ],
      },
      flashcards: [
        { front: "Alpha, beta and gamma: penetration", back: "α: stopped by paper; β⁻: a few mm aluminium; γ: reduced by thick lead or concrete." },
        { front: "Alpha decay effect on the nucleus", back: "A decreases by 4 and Z decreases by 2." },
        { front: "Beta-minus decay effect on the nucleus", back: "A unchanged, Z increases by 1 (n → p + e⁻ + ν̄ₑ)." },
        { front: "Random and spontaneous", back: "Random: cannot predict which nucleus decays next. Spontaneous: unaffected by temperature, pressure or chemistry." },
        { front: "Activity", back: "A = λN, in becquerels (Bq): the number of decays per second." },
        { front: "Decay law", back: "N = N₀e^(−λt) and A = A₀e^(−λt)." },
        { front: "Half-life and decay constant", back: "t½ = ln 2 ÷ λ = 0.693 ÷ λ." },
        { front: "Background radiation", back: "Always measure it separately and subtract it from the count rate." },
        { front: "Nuclear radius", back: "R = r₀A^(1/3), r₀ ≈ 1.2 fm; nuclear density is roughly constant (about 10¹⁷ kg m⁻³)." },
        { front: "Inverse-square law for gamma rays", back: "Intensity ∝ 1 ÷ r²: triple the distance, one ninth the intensity." },
        { front: "Radiocarbon dating principle", back: "Living things keep a constant ¹⁴C activity; after death it halves every 5730 years." },
      ],
    },
  },
};
