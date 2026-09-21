// GCSE Chemistry — Chemical Analysis (Year 11).
import type { CTopic } from "../types";
import { N, S, M, W, yr } from "./_h";
import { CHROM } from "./_imgdata";

const IMG = ["c4anal-chromatogram.png", "A paper chromatogram beside a centimetre ruler scale starting at the baseline (0 cm) up to the solvent front at 10 cm. Four columns of spots start on the baseline: known substances A, B and C, and a sample column S. A has one spot at 3.2 cm, B one spot at 6.4 cm, C one spot at 8.0 cm. The sample column S has two spots, at 3.2 cm and 8.0 cm."] as [string, string];
const rf = (d: number) => Math.round((d / CHROM.front) * 100) / 100;

export const TOPIC: CTopic = {
  key: "c4anal", topic: "Chemistry — Chemical Analysis", subject: "Science",
  years: {
    11: yr("c4anal", 11, {
      obj: [
        "Distinguish pure substances from mixtures; use melting and boiling points; describe formulations.",
        "Carry out paper chromatography and calculate Rf values.",
        "Test for gases: hydrogen, oxygen, carbon dioxide and chlorine.",
        "Identify metal ions by flame tests and sodium hydroxide precipitates (triple).",
        "Identify carbonates, halides and sulfates by chemical tests (triple).",
        "Describe instrumental methods such as flame emission spectroscopy (triple).",
      ],
      note: ["GCSE Chemistry: analysing substances", `## Pure substances and mixtures
A **pure** substance is a single element or compound and melts or boils at one sharp temperature; a **mixture** melts over a range. A **formulation** is a mixture designed for a use (paints, fuels, medicines) with exact quantities of each component.

## Chromatography
The **baseline** is drawn in **pencil** (it does not dissolve). The solvent carries substances up the paper; more soluble substances travel further. The same substance always has the same **Rf** in the same solvent.
**Rf = distance moved by the substance ÷ distance moved by the solvent** (no units, between 0 and 1).
Worked example: a spot moves 2.4 cm and the solvent front moves 8.0 cm: Rf = 2.4 ÷ 8.0 = **0.30**.

## Gas tests
| Gas | Test and result |
| --- | --- |
| Hydrogen | lit splint gives a squeaky pop |
| Oxygen | glowing splint relights |
| Carbon dioxide | limewater turns milky |
| Chlorine | damp litmus paper bleached white |

## Ion tests (triple)
- Flame tests: lithium crimson, sodium yellow, potassium lilac, calcium orange-red, copper green.
- Sodium hydroxide: copper(II) blue precipitate, iron(II) green, iron(III) brown; aluminium, calcium and magnesium white.
- Carbonates: acid gives CO₂. Halides: nitric acid then silver nitrate: chloride white, bromide cream, iodide yellow. Sulfates: hydrochloric acid then barium chloride gives a white precipitate.

**Instrumental methods** (such as flame emission spectroscopy) are rapid, sensitive and accurate, and can identify several ions in a mixture from tiny samples.`],
      quiz: "GCSE Chemistry: Chemical Analysis quiz",
      qs: [
        S(1, "In chemistry, what is a pure substance?", "A single element or compound that melts at one fixed temperature", ["Any substance that is safe to drink", "A mixture that has been filtered so that it contains nothing harmful", "A substance with no colour"], "Chemists call a substance pure if it contains only one element or compound. Pure substances have sharp melting and boiling points.", {}),
        S(1, "What happens when a lit splint is put in a test tube of hydrogen?", "A squeaky pop is heard", ["The splint relights", "The limewater turns milky", "The splint burns brighter"], "The squeaky pop is the small explosion of hydrogen burning with oxygen in the air.", {}),
        S(1, "Which flame colour is produced by sodium ions?", "Yellow", ["Lilac", "Crimson", "Green"], "Sodium gives a yellow flame, potassium lilac, lithium crimson and copper green.", {}),
        N(2, "Use the chromatogram to calculate the Rf value of substance B.", 0.64, 0.01, "Rf = distance moved by spot ÷ distance moved by solvent = 6.4 ÷ 10.0 = 0.64.", () => rf(CHROM.spots.B), { img: IMG, diag: true }),
        M(2, "Which of the known substances A, B and C are present in the sample S? Choose all that apply.", ["A", "C"], ["B"], "The sample has spots at 3.2 cm and 8.0 cm, matching A and C. No spot matches B (6.4 cm).", { img: IMG, chk: () => Object.entries(CHROM.spots).filter(([, d]) => CHROM.sample.includes(d)).map(([k]) => k).sort() }),
        S(2, "Why is the baseline on chromatography paper drawn in pencil and not ink?", "Pencil is insoluble so it will not move with the solvent", ["Pencil is more soluble than ink, so it moves further up the paper", "Ink would not show up on paper", "Pencil marks are easier to see at the end"], "Ink is soluble and would separate and travel up the paper, confusing the results. Pencil graphite does not dissolve.", {}),
        S(2, "What is the test for chlorine gas?", "Damp litmus paper is bleached white", ["A glowing splint relights", "Limewater turns milky", "A lit splint gives a squeaky pop sound"], "Chlorine bleaches damp blue litmus paper (turning it red first, then white).", {}),
        S(2, "A solution gives a green precipitate when sodium hydroxide is added. Which metal ion is present?", "Iron(II)", ["Iron(III)", "Copper(II)", "Calcium"], "Fe²⁺ gives a green precipitate, Fe³⁺ a brown one, Cu²⁺ a blue one. Calcium gives a white precipitate.", {}),
        S(2, "A solution gives a white precipitate when nitric acid and silver nitrate are added. Which ion is present?", "Chloride", ["Bromide", "Iodide", "Carbonate"], "Chloride gives a white silver chloride precipitate, bromide cream and iodide yellow.", { diag: true }),
        S(2, "Which reagents test for sulfate ions?", "Hydrochloric acid, then barium chloride solution", ["Nitric acid, then silver nitrate solution", "Sodium hydroxide solution, then warm gently", "Hydrochloric acid, then limewater"], "Sulfate ions form a white precipitate of barium sulfate with barium chloride. The acid is added first to remove carbonate ions.", {}),
        S(3, "Why is dilute nitric acid added before silver nitrate when testing for halide ions?", "To remove carbonate ions, which would also form a precipitate", ["To make the halide ions more concentrated so more precipitate forms", "To turn the halide ions into a gas that can then be tested", "To act as a catalyst so that the precipitate forms more quickly"], "Silver carbonate would also form a precipitate and give a false positive. The acid destroys carbonate ions first.", {}),
        S(3, "Why do scientists use flame emission spectroscopy rather than simple flame tests?", "It is more accurate and sensitive, works on tiny samples and can identify ions in mixtures", ["Flame tests cannot detect metal ions at all, only non-metal ions", "Spectroscopy is slower than a flame test, so its results are more reliable", "It uses limewater as a reagent, which is cheaper than a Bunsen burner"], "Instrumental methods are quicker and more sensitive, and they read the spectrum objectively; flame colours can overlap and depend on the observer.", {}),
        W("Describe how you could use paper chromatography to find out which of three known food colourings are in a sweet's coating. [6 marks]", "Mark scheme (6): draw a pencil baseline near the bottom of the paper (1); put small spots of the three known colourings and the sample on the baseline (1); place the paper in a beaker with solvent below the baseline, so the spots do not dissolve in it (1); allow the solvent to rise near the top, then remove and mark the solvent front (1); measure the distance moved by each spot and the solvent and calculate the Rf values (1); compare sample spots with the known colourings: matching Rf values (or positions) show which colourings are present (1)."),
      ],
      cards: [
        ["Pure substance", "A single element or compound with a sharp melting/boiling point."],
        ["Formulation", "A mixture designed for a use, with exact quantities of each component."],
        ["Rf equation", "distance moved by substance ÷ distance moved by solvent."],
        ["Why draw the baseline in pencil?", "Pencil is insoluble, so it does not run with the solvent."],
        ["Test for hydrogen", "Lit splint: squeaky pop."],
        ["Test for oxygen", "Glowing splint relights."],
        ["Test for carbon dioxide", "Bubble through limewater: turns milky."],
        ["Test for chlorine", "Damp litmus paper is bleached white."],
        ["Flame colours", "Li crimson, Na yellow, K lilac, Ca orange-red, Cu green."],
        ["NaOH test colours", "Cu²⁺ blue, Fe²⁺ green, Fe³⁺ brown; Al³⁺, Ca²⁺, Mg²⁺ white."],
        ["Halide test", "Nitric acid + silver nitrate: Cl⁻ white, Br⁻ cream, I⁻ yellow."],
        ["Sulfate test", "Hydrochloric acid + barium chloride: white precipitate."],
      ],
    }),
  },
};
