// A-level Chemistry — Analysis & Practical Skills (Year 12 IR, mass spectrometry, uncertainties; Year 13 NMR, chromatography, structure determination). Original content aligned to the DfE GCE AS/A-level chemistry subject content.
// Numerical keys and every drawn spectrum/plate are recomputed/derived from _data.ts by _chk_c5anal.ts — re-run _check_s6.ts after ANY edit here.
import type { CTopic } from "../types";
import { img, qb } from "./_h";

const q12 = qb("c5anal", 12);
const q13 = qb("c5anal", 13);
export const TOPIC: CTopic = {
  key: "c5anal",
  topic: "Chemistry — Analysis & Practical Skills",
  subject: "Science",
  years: {
    12: {
      year: 12,
      subtopic: "A-level Year 12 (AS)",
      objectives: [
        "Mass spectrometry: molecular ion, fragmentation and base peak; identifying compounds from m/z values.",
        "Infrared spectroscopy: identifying functional groups (C=O, O–H, C–H) from absorption wavenumbers.",
        "Practical skills: reflux, distillation, drying and purification of organic liquids.",
        "Measurement uncertainties: absolute and percentage uncertainty in burette, pipette and balance readings.",
      ],
      note: {
        title: "Mass spectra, infrared spectra and practical uncertainties",
        body: `## Mass spectrometry

The **molecular ion peak** M⁺ has an m/z equal to the relative molecular mass (using the most abundant isotopes). Fragment ions, formed when M⁺ breaks apart, give peaks at lower m/z; the tallest is the **base peak**. For example, a peak at 31 in a primary alcohol can be [CH₂OH]⁺: 12 + 2 × 1 + 16 + 1 = 31.

## Infrared spectroscopy

Bonds absorb IR radiation at characteristic wavenumbers (cm⁻¹), shown as downward dips in transmittance.

| Bond | Wavenumber (cm⁻¹) | Appearance |
| --- | --- | --- |
| O–H (alcohol) | 3200–3550 | broad |
| O–H (carboxylic acid) | 2500–3300 | very broad |
| C–H | 2850–3100 | sharp, medium |
| C=O | 1680–1750 | strong, sharp |

A carboxylic acid therefore shows **both** a very broad O–H and a C=O; an ester or ketone shows C=O but no O–H.

## Practical skills

- **Reflux**: heating with a condenser upright so volatile liquids return to the flask.
- **Distillation**: collect a product with a lower boiling point (e.g. an aldehyde) as it forms.
- **Purifying a liquid**: wash in a separating funnel, dry with anhydrous MgSO₄ or CaCl₂ (removes traces of water), then redistil.

## Uncertainties

Percentage uncertainty = (absolute uncertainty ÷ measured value) × 100. A titre is the difference of two burette readings, so it carries **two** reading uncertainties. Add percentage uncertainties from different pieces of apparatus to get the overall value; a larger measurement gives a smaller percentage uncertainty.

## Worked examples

**Balance:** a mass is found by difference with two readings, each ±0.001 g, and the mass is 1.250 g. Absolute uncertainty = 0.002 g; percentage = 0.002 ÷ 1.250 × 100 = **0.16 %**.

**Mass spectrum:** propanone C₃H₆O has M⁺ at 3 × 12 + 6 + 16 = **58**.`,
      },
      quiz: {
        title: "Analysis & Practical Skills: Year 12 quiz",
        questions: [
          q12.single(1, "A strong, sharp peak in an infrared spectrum at about 1710 cm⁻¹ indicates which bond?", "C=O", ["O–H", "C–H", "C–O"],
            "The carbonyl bond absorbs strongly at 1680–1750 cm⁻¹. O–H absorbs above 2500 cm⁻¹, and C–H near 2850–3100 cm⁻¹."),
          q12.single(2, "The infrared spectrum shown is for a compound containing carbon, hydrogen and oxygen. Which functional group is present?", "A carboxylic acid",
            ["An alcohol", "A ketone", "An ester"],
            "The very broad absorption over 2500–3300 cm⁻¹ is the hydrogen-bonded O–H of a carboxylic acid, and the sharp peak near 1710 cm⁻¹ is C=O. An alcohol has no C=O peak; a ketone or ester has no broad O–H.",
            { diag: true, image: img("ir.png", "Infrared spectrum: percent transmittance on the vertical axis against wavenumber from 4000 down to 500 cm⁻¹ on the horizontal axis. There is a very broad, deep absorption dip from about 3300 to 2500 cm⁻¹, deepest near 2950. A strong sharp dip at 1710 cm⁻¹ and a moderate dip at about 1300 cm⁻¹.") }),
          q12.num(1, "What is the m/z value of the molecular ion of ethanol, C₂H₅OH? (Ar: C = 12, H = 1, O = 16)", 46, 0,
            "The molecular ion peak M⁺ has m/z equal to the relative molecular mass: 2 × 12 + 6 × 1 + 16 = 46."),
          q12.single(2, "The mass spectrum of pentan-3-one (CH₃CH₂COCH₂CH₃, M = 86) is shown. Which ion is responsible for the base peak at m/z 57?", "[CH₃CH₂CO]⁺",
            ["[CH₃CO]⁺", "[CH₃CH₂]⁺", "[CH₃CH₂CH₂]⁺"],
            "Cleavage next to the C=O loses an ethyl group (29) from the molecular ion: 86 − 29 = 57. [CH₃CH₂CO]⁺ has mass 3 × 12 + 5 + 16 = 57. [CH₃CO]⁺ is 43 and [CH₃CH₂]⁺ is 29.",
            { diag: true, image: img("ms-pentanone.png", "Mass spectrum of pentan-3-one as vertical lines: a molecular ion peak at m/z 86 (relative abundance about 22 percent), a tall base peak at m/z 57 (100 percent), a peak at m/z 29 (about 42 percent), and small peaks at 27 (14 percent) and 28 (8 percent).") }),
          q12.num(2, "In a titration each burette reading has an uncertainty of ±0.05 cm³. The titre is 22.40 cm³ (final reading minus initial reading). Calculate the percentage uncertainty in the titre, to 2 decimal places.", 0.45, 0.01,
            "The titre is a difference of two readings, so the absolute uncertainty is 0.05 + 0.05 = ±0.10 cm³. Percentage uncertainty = 0.10 ÷ 22.40 × 100 = 0.45 %."),
          q12.num(3, "A titre of 22.40 cm³ is measured with a burette (readings ±0.05 cm³ each, as before) after 25.0 cm³ is measured with a pipette of uncertainty ±0.06 cm³. Calculate the total percentage uncertainty from these two pieces of apparatus, to 2 decimal places.", 0.69, 0.01,
            "Burette: 0.10 ÷ 22.40 × 100 = 0.446 %. Pipette: 0.06 ÷ 25.0 × 100 = 0.24 %. Add the percentage uncertainties: 0.446 + 0.24 = 0.69 %."),
          q12.single(2, "Why is an organic liquid dried with anhydrous magnesium sulfate before the final distillation?", "To remove traces of water from the product",
            ["To neutralise any remaining acid", "To increase the boiling point of the product", "To convert the product to a solid"],
            "Anhydrous MgSO₄ absorbs water, forming a hydrate. The dry liquid can then be distilled without water contaminating the product."),
          q12.single(1, "What is the purpose of heating a reaction mixture under reflux?", "To heat for a long time without losing volatile substances, because vapour condenses and returns to the flask",
            ["To separate the product from the mixture by its boiling point as soon as it forms, so that it cannot react further with the remaining reactants", "To remove water from the products", "To cool the reaction mixture quickly"],
            "The upright condenser condenses vapour so it drains back into the flask. Distillation, by contrast, collects the vapour."),
          q12.single(1, "What is the base peak in a mass spectrum?", "The tallest peak, from the most abundant ion", ["The peak at the highest m/z value", "The peak at m/z = 1", "The peak from the molecular ion"],
            "The base peak is the most abundant ion and is given the value 100 %. It is often not the molecular ion."),
          q12.single(2, "An unknown compound has a strong sharp IR peak at 1720 cm⁻¹ and no broad absorption above 3000 cm⁻¹. Which of these could it be?", "Propanone", ["Propan-2-ol", "Propanoic acid", "Ethanol"],
            "The 1720 peak shows C=O. No O–H means it is not the acid or an alcohol. Propanone (a ketone) fits."),
          q12.multi(3, "Propanal and propanone both have M = 58. Which methods could distinguish them?", ["Warming with Tollens' reagent", "The pattern of fragment ion peaks in the mass spectrum"],
            ["The m/z of the molecular ion peak", "The presence of a C=O peak in the infrared spectrum"],
            "They are isomers, so M⁺ is the same, and both have C=O. Only propanal gives a silver mirror, and their fragmentations differ (for example a base peak at 43 for propanone)."),
          q12.short(3, "A compound contains 54.5 % carbon, 9.1 % hydrogen and 36.4 % oxygen by mass, and its molecular ion peak is at m/z 88. Give its molecular formula. (Ar: C = 12.0, H = 1.0, O = 16.0)", "C₄H₈O₂", ["C4H8O2", "c4h8o2"],
            "Moles: C 54.5 ÷ 12.0 = 4.54, H 9.1 ÷ 1.0 = 9.1, O 36.4 ÷ 16.0 = 2.28. Ratio 2 : 4 : 1 gives C₂H₄O (mass 44). M = 88, so the molecular formula is double: C₄H₈O₂."),
          q12.single(2, "Why does the O–H absorption of a carboxylic acid appear as a very broad peak from 2500 to 3300 cm⁻¹?", "Strong hydrogen bonding between acid molecules gives a wide range of O–H bond environments",
            ["The C=O bond in the same molecule absorbs strongly in the same region, and the two absorptions overlap to make one broad band", "Carboxylic acids are ionic", "It is caused by C–H stretching"],
            "Hydrogen bonding weakens and varies the O–H bond, spreading the absorption over a wide range. This is stronger in acids (dimers) than in alcohols."),
          q12.num(2, "Bromopropane C₃H₇Br contains ⁷⁹Br and ⁸¹Br in roughly equal amounts, so its mass spectrum shows two molecular ion peaks. What is the m/z of the peak containing ⁸¹Br? (Use ¹²C = 12, ¹H = 1)", 124, 0,
            "M = 3 × 12 + 7 × 1 + 81 = 124. The other peak is at 122 (with ⁷⁹Br), and the two peaks have about equal height."),
        ],
      },
      flashcards: [
        { front: "Molecular ion peak", back: "The peak at the highest m/z (from the whole molecule less one electron); its m/z equals Mr." },
        { front: "Base peak", back: "The tallest peak in a mass spectrum (the most abundant ion)." },
        { front: "IR: C=O", back: "1680–1750 cm⁻¹, strong and sharp." },
        { front: "IR: O–H in an alcohol", back: "3200–3550 cm⁻¹, broad." },
        { front: "IR: O–H in a carboxylic acid", back: "2500–3300 cm⁻¹, very broad." },
        { front: "IR: C–H", back: "2850–3100 cm⁻¹." },
        { front: "Why reflux?", back: "Heat for long periods without losing volatile reactants or products." },
        { front: "Why dry an organic liquid with anhydrous MgSO₄?", back: "Removes traces of water before final distillation." },
        { front: "Percentage uncertainty", back: "(absolute uncertainty ÷ measured value) × 100." },
        { front: "Uncertainty in a titre", back: "Two burette readings, so ±0.05 + ±0.05 = ±0.10 cm³ (for ±0.05 per reading)." },
      ],
    },
    13: {
      year: 13,
      subtopic: "A-level Year 13 (A2)",
      objectives: [
        "Proton (¹H) NMR: chemical shift, integration, spin–spin splitting (n + 1 rule), TMS as reference.",
        "Carbon-13 NMR: number of carbon environments.",
        "Chromatography: TLC and Rf values; gas chromatography (retention time, peak area); GC–MS.",
        "Combining IR, mass spectrometry and NMR to determine an organic structure.",
        "Quantitative analysis: titration and purity calculations.",
      ],
      note: {
        title: "NMR, chromatography and structure determination",
        body: `## Proton NMR

Each set of chemically equivalent H atoms gives one signal.
- **Chemical shift δ (ppm)** shows the environment, measured from TMS (δ = 0).
- **Integration** gives the ratio of H atoms in each environment.
- **Splitting**: a signal is split into **n + 1** peaks by n H atoms on adjacent carbons (singlet, doublet, triplet, quartet, septet). O–H protons usually appear as singlets.

| Environment | δ (ppm) |
| --- | --- |
| R–CH₃, R–CH₂–R | 0.9–1.5 |
| CH₃–C=O | 2.0–2.5 |
| O–CH₂ or O–CH₃ | 3.3–4.3 |
| Aromatic H | 6.5–8.0 |
| R–CHO | 9.4–10.0 |

**TMS**, (CH₃)₄Si, is used as a reference because it gives one sharp signal from 12 equivalent H atoms, is inert and volatile.

**¹³C NMR:** the number of signals equals the number of different carbon environments.

## Chromatography

**TLC**: the stationary phase is silica on a plate and the mobile phase a solvent. **Rf = distance moved by the spot ÷ distance moved by the solvent front**. More polar compounds stick more strongly to the silica and have lower Rf. In **GC**, the retention time identifies a component and the peak area shows its amount; **GC–MS** feeds each separated component into a mass spectrometer.

## Structure determination

Use M⁺ (formula), IR (functional groups), then NMR (environments, neighbours).

## Worked examples

**Rf:** a spot moves 3.0 cm while the solvent front moves 9.0 cm: Rf = 3.0 ÷ 9.0 = **0.33**.

**Ethanal, CH₃CHO:** the CH₃ signal is split by 1 neighbouring H into a doublet at about δ 2.2 (3H); the CHO proton is split by 3 H into a quartet at about δ 9.8 (1H).`,
      },
      quiz: {
        title: "Analysis & Practical Skills: Year 13 quiz",
        questions: [
          q13.single(1, "What is the chemical shift of tetramethylsilane (TMS), the reference used in NMR?", "0 ppm", ["1 ppm", "10 ppm", "−1 ppm"],
            "The δ scale is defined so that TMS has δ = 0."),
          q13.single(1, "A CH₂ group is adjacent to a CH₃ group and nothing else. What is the splitting of the CH₂ signal in ¹H NMR?", "Quartet", ["Singlet", "Doublet", "Triplet"],
            "The n + 1 rule: 3 neighbouring H atoms split the signal into 3 + 1 = 4 peaks, a quartet."),
          q13.single(2, "The ¹H NMR spectrum of ethyl ethanoate, CH₃COOCH₂CH₃, is shown. Which signal is from the CH₃ attached directly to the C=O?", "The singlet at δ 2.04",
            ["The triplet at δ 1.26", "The quartet at δ 4.12", "It does not appear in a ¹H NMR spectrum"],
            "The CH₃ on the C=O has no H on the adjacent carbon, so it is a 3H singlet at about 2.0. The ethyl CH₃ is a triplet (next to CH₂) and the OCH₂ is a quartet at 4.1.",
            { diag: true, image: img("nmr.png", "Proton NMR spectrum drawn as vertical peak groups against chemical shift δ in ppm from 5 on the left to 0 on the right. A quartet of four lines at δ 4.12 with integration 2. A single tall line at δ 2.04 with integration 3. A triplet of three lines at δ 1.26 with integration 3. A small line at δ 0 marks the TMS reference.") }),
          q13.num(2, "How many peaks are there in the ¹³C NMR spectrum of butanone, CH₃COCH₂CH₃?", 4, 0,
            "Each carbon is in a different environment: CH₃–C(=O), C=O, CH₂ and the CH₃ of the ethyl group, giving four signals."),
          q13.num(2, "The TLC plate shown has a centimetre scale beside it. Calculate the Rf value of the spot from the unknown sample, to 2 decimal places.", 0.65, 0.01,
            "Rf = distance moved by the spot ÷ distance moved by the solvent front = 5.2 ÷ 8.0 = 0.65.",
            { diag: true, image: img("tlc.png", "A drawing of a TLC plate with a vertical centimetre scale from 0 (pencil baseline) to 8.0 (solvent front line). Four spots in a row: reference A at 2.4 cm, reference B at 5.2 cm, the unknown sample at 5.2 cm, and reference C at 6.4 cm.") }),
          q13.single(2, "Using the TLC plate shown (references A, B and C and an unknown sample), which known compound is likely to be present in the sample?", "B", ["A", "C", "None of them"],
            "The sample has the same Rf (0.65) as reference B, so B is likely present. Identical Rf in one solvent is consistent with, but does not prove, the same compound.",
            { image: img("tlc.png", "A drawing of a TLC plate with a vertical centimetre scale from 0 (pencil baseline) to 8.0 (solvent front line). Four spots in a row: reference A at 2.4 cm, reference B at 5.2 cm, the unknown sample at 5.2 cm, and reference C at 6.4 cm.") }),
          q13.single(2, "In gas chromatography, what does the area under each peak indicate?", "The relative amount of that component in the mixture",
            ["The boiling point of that component", "The relative molecular mass of that component", "The polarity of that component"],
            "Retention time helps identify the compound. The peak area is proportional to the amount present."),
          q13.single(1, "In thin-layer chromatography using silica gel, what is the stationary phase?", "The silica gel on the plate", ["The solvent", "The filter paper", "The sample spot"],
            "The silica is fixed to the plate. The solvent moving up is the mobile phase."),
          q13.single(3, "A compound C₃H₆O₂ has a strong IR absorption at 1740 cm⁻¹ and no broad peak above 3000 cm⁻¹. Its ¹H NMR spectrum has two singlets, at δ 2.0 and δ 3.7, each with integration 3. What is the compound?", "Methyl ethanoate, CH₃COOCH₃",
            ["Ethyl methanoate, HCOOCH₂CH₃", "Propanoic acid, CH₃CH₂COOH", "Hydroxypropanone, CH₃COCH₂OH"],
            "C=O with no O–H points to an ester. Two 3H singlets mean two CH₃ groups with no H neighbours: CH₃–C=O (δ 2.0) and O–CH₃ (δ 3.7). Ethyl methanoate would show a triplet, a quartet and a 1H singlet."),
          q13.num(1, "In the ¹H NMR spectrum of ethanol, the integration traces for the CH₃, CH₂ and OH signals are in the ratio 3 : 2 : 1. The OH trace is 1.5 cm high. How high, in cm, is the CH₃ trace?", 4.5, 0.05,
            "Integration ratio equals the ratio of H atoms. If 1 H corresponds to 1.5 cm, 3 H corresponds to 3 × 1.5 = 4.5 cm."),
          q13.multi(2, "Which statements about TMS in NMR are correct?", ["Its chemical shift is defined as 0 ppm", "All 12 of its hydrogen atoms are equivalent, giving a single sharp signal"],
            ["It reacts with the sample to shift its signals", "It is chosen because it gives a complex splitting pattern"],
            "TMS is inert, volatile and gives one strong singlet, so it is an easily identified reference at δ = 0."),
          q13.single(3, "In the ¹H NMR spectrum of propan-2-ol, (CH₃)₂CHOH, what is the splitting pattern of the CH proton signal?", "Septet",
            ["Quartet", "Doublet", "Triplet"],
            "The CH is next to two CH₃ groups, giving 6 neighbouring H. n + 1 = 7 peaks, a septet. (The OH proton is usually a singlet and the CH₃ signal is a doublet.)"),
          q13.num(3, "0.500 g of an impure sample of aspirin (C₉H₈O₄, Mr 180.0) is titrated with 0.100 mol dm⁻³ NaOH. The titre is 26.10 cm³ and aspirin reacts 1 : 1 with NaOH. Calculate the percentage purity of the aspirin to 3 significant figures.", 94.0, 0.3,
            "n(NaOH) = 0.100 × 26.10 ÷ 1000 = 2.61 × 10⁻³ mol = n(aspirin). Mass = 2.61 × 10⁻³ × 180.0 = 0.4698 g. Purity = 0.4698 ÷ 0.500 × 100 = 94.0 %."),
          q13.single(2, "What is the advantage of GC–MS for analysing an unknown mixture of organic liquids?", "GC separates the components and the mass spectrometer then identifies each one",
            ["It measures the melting point of each component", "It gives the ¹H NMR spectrum of each component", "It removes the impurities from the sample"],
            "The gas chromatograph separates the mixture by retention time. Each fraction goes into the mass spectrometer, which gives M⁺ and a fragmentation pattern to identify it."),
        ],
      },
      flashcards: [
        { front: "¹H NMR: what are the three pieces of information from a spectrum?", back: "Chemical shift (environment), integration (number of H), splitting (neighbouring H)." },
        { front: "n + 1 rule", back: "A signal is split into n + 1 peaks by n equivalent H on adjacent carbons." },
        { front: "TMS", back: "(CH₃)₄Si, reference at δ = 0; 12 equivalent H, one sharp signal, inert and volatile." },
        { front: "Typical shift: CH₃–C=O", back: "δ 2.0–2.5 ppm." },
        { front: "Typical shift: aldehyde H (R–CHO)", back: "δ 9.4–10.0 ppm." },
        { front: "¹³C NMR: what does the number of signals show?", back: "The number of different carbon environments." },
        { front: "Rf value", back: "Distance moved by spot ÷ distance moved by solvent front (always between 0 and 1)." },
        { front: "Stationary and mobile phase in TLC", back: "Stationary: silica on a plate. Mobile: the solvent." },
        { front: "Gas chromatography: retention time and peak area", back: "Retention time identifies the component; peak area indicates its amount." },
        { front: "GC–MS", back: "GC separates the mixture; MS identifies each component from its M⁺ and fragments." },
      ],
    },
  },
};
