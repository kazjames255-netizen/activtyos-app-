// GCSE Physics — Atomic Structure & Radioactivity (Year 11).
import type { CTopic } from "../types";
import { N, S, M, W, yr } from "./_h";
import { DECAY } from "./_imgdata";

const IMG = ["p4atom-decay.png", "A graph of activity in counts per minute against time in hours for a radioactive sample. The curve starts at 800 counts per minute at 0 hours and falls steeply at first, then more slowly, reaching 400 at 6 hours, 200 at 12 hours, 100 at 18 hours and 50 at 24 hours."] as [string, string];
const act = (t: number) => DECAY.N0 * 0.5 ** (t / DECAY.half);

export const TOPIC: CTopic = {
  key: "p4atom", topic: "Physics — Atomic Structure & Radioactivity", subject: "Science",
  years: {
    11: yr("p4atom", 11, {
      obj: [
        "Describe the structure of the atom, isotopes, and the development of the atomic model.",
        "Describe radioactive decay, and the properties, ionising power and range of alpha, beta and gamma radiation and neutrons.",
        "Write balanced nuclear equations for alpha and beta decay.",
        "Define half-life and use it in calculations; interpret decay graphs and count rates corrected for background.",
        "Distinguish irradiation and contamination; describe uses and hazards of radiation.",
        "Triple stretch: nuclear fission, fusion and chain reactions.",
      ],
      note: ["GCSE Physics: radioactivity and half-life", `## Radiation
Unstable nuclei decay randomly, emitting radiation. Activity is measured in **becquerels (Bq)**.

| Radiation | What it is | Ionising | Stopped by |
| --- | --- | --- | --- |
| Alpha (α) | 2 protons + 2 neutrons (helium nucleus) | strongest | paper, a few cm of air |
| Beta (β) | fast electron from the nucleus | medium | thin aluminium |
| Gamma (γ) | electromagnetic wave | weakest | thick lead or concrete |

**Alpha decay** lowers the mass number by 4 and the atomic number by 2. **Beta decay** (a neutron becomes a proton) raises the atomic number by 1 and leaves the mass number unchanged.
Examples: polonium-210 (Z = 84) → lead-206 (Z = 82) + α. Iodine-131 (Z = 53) → xenon-131 (Z = 54) + β.

## Half-life
The **half-life** is the time for the activity (or the number of unstable nuclei) to halve. After n half-lives the fraction left is (½)ⁿ. Subtract the **background count** before finding half-life.
Worked example: a sample starts at 320 Bq. After 2 half-lives it is 320 ÷ 4 = **80 Bq**.

## Irradiation and contamination
**Irradiation**: exposure to radiation from an outside source. **Contamination**: radioactive atoms get on or inside an object or person. Alpha emitters are most dangerous **inside** the body; gamma emitters outside.

**Uses:** tracers (gamma, short half-life), sterilising, treating cancer. **Working scientifically:** repeat count-rate readings and calculate a mean because decay is random.`],
      quiz: "GCSE Physics: Atomic Structure & Radioactivity quiz",
      qs: [
        S(1, "Which type of radiation is the most strongly ionising?", "Alpha", ["Beta", "Gamma", "X-ray"], "Alpha particles are large and heavily charged, so they ionise strongly over a short range.", {}),
        S(1, "Which type of radiation can be stopped by a sheet of paper?", "Alpha", ["Beta", "Gamma", "All three"], "Alpha has low penetrating power. Beta needs thin aluminium and gamma needs thick lead or concrete.", {}),
        S(1, "Which type of radiation is an electromagnetic wave?", "Gamma", ["Alpha", "Beta", "Neutron"], "Gamma rays are high-frequency electromagnetic waves. Alpha and beta are particles.", {}),
        N(2, "Use the graph. What is the half-life of the sample in hours?", 6, 0.3, "The activity halves from 800 to 400 counts per minute at 6 hours, so the half-life is 6 hours.", () => DECAY.half, { img: IMG }),
        N(2, "Use the graph and the half-life. What is the activity, in counts per minute, after 18 hours?", 100, 5, "18 hours is 3 half-lives: 800 → 400 → 200 → 100 counts per minute.", () => act(18), { img: IMG, diag: true }),
        N(2, "What percentage of the original radioactive nuclei remain after 4 half-lives?", 6.25, 0.01, "After 4 half-lives the fraction is (½)⁴ = 1/16 = 0.0625, or 6.25%.", () => 100 / 2 ** 4),
        N(2, "Radium-226 has an atomic number of 88. It decays by alpha emission. What is the atomic number of the new nucleus?", 86, 0, "An alpha particle contains 2 protons, so the atomic number falls by 2: 88 − 2 = 86.", () => 88 - 2, { diag: true }),
        S(2, "What happens to a nucleus in beta decay?", "A neutron turns into a proton and an electron is emitted", ["A proton turns into a neutron and an electron is emitted", "Two protons and two neutrons are emitted", "The nucleus emits only energy"], "The beta particle is an electron created when a neutron changes into a proton, so the atomic number rises by 1.", {}),
        S(2, "Which is the most dangerous when a radioactive source is inside the body?", "An alpha emitter", ["A gamma emitter", "A beta emitter", "All are equally dangerous"], "Alpha radiation is absorbed within a short distance and its strong ionisation damages nearby cells. Gamma mostly passes out of the body.", {}),
        M(2, "Which properties make a good radioactive tracer to be injected into a patient? Choose all that apply.", ["It emits gamma radiation, which passes out of the body", "It has a short half-life"], ["It emits alpha radiation", "It has a half-life of thousands of years"], "Gamma can be detected outside the body, and a short half-life means the radioactivity soon falls to a safe level. Alpha would be absorbed and very damaging inside the body.", {}),
        N(3, "A sample gives count rates of 250, 130 and 70 counts per minute at 0 h, 4 h and 8 h. The background count rate is 10 counts per minute. Use the corrected count rates to find the half-life in hours.", 4, 0.1, "Subtract the background: 240, 120, 60. The activity halves every 4 hours, so the half-life is 4 hours.", () => { const c = [250, 130, 70].map((x) => x - 10); return c[0] / c[1] === 2 && c[1] / c[2] === 2 ? 4 : NaN; }),
        S(3, "(Triple) Which statement about nuclear fusion is correct?", "Two light nuclei join to form a heavier nucleus, releasing energy, and this needs very high temperature and pressure", ["A large nucleus splits into two smaller ones after absorbing a neutron, and this is the reaction that powers the Sun", "It is the process used in all nuclear power stations today, where uranium nuclei are joined together to release energy", "It produces no energy, because joining nuclei together always takes in more energy than it gives out"], "Fusion, as in the Sun, needs very high temperature and pressure to overcome the repulsion between positive nuclei. Fission is the splitting of large nuclei.", {}),
        W("Compare the risks of alpha, beta and gamma sources outside the body (irradiation) and inside the body (contamination). [6 marks]", "Mark scheme (6): irradiation is exposure to radiation from an external source (1); contamination is when radioactive atoms get on or in the body (1); outside the body alpha is absorbed by skin/air so it is low risk (1); gamma and beta outside the body can penetrate and cause damage (1); inside the body alpha is the most dangerous because it is strongly ionising and all its energy is absorbed in nearby cells (1); gamma inside is less dangerous as it mostly passes out, and beta is intermediate (1)."),
      ],
      cards: [
        ["Alpha particle", "2 protons and 2 neutrons (helium nucleus); strongly ionising; stopped by paper."],
        ["Beta particle", "A fast electron from the nucleus; stopped by thin aluminium."],
        ["Gamma ray", "Electromagnetic wave; weakly ionising; needs thick lead or concrete."],
        ["Alpha decay changes", "Mass number −4, atomic number −2."],
        ["Beta decay changes", "Atomic number +1, mass number unchanged."],
        ["Half-life", "Time for the activity (or number of unstable nuclei) to halve."],
        ["Fraction left after n half-lives", "(½)ⁿ."],
        ["Unit of activity", "Becquerel (Bq): decays per second."],
        ["Irradiation vs contamination", "Outside exposure vs radioactive atoms on or inside the body."],
        ["Why subtract background count?", "To find the count rate from the sample alone."],
        ["Uses of radiation", "Tracers, sterilising equipment, treating cancer."],
        ["Fission vs fusion (triple)", "Fission splits large nuclei; fusion joins light nuclei."],
      ],
    }),
  },
};
