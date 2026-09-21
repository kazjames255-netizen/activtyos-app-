// A-level Physics — Particles & Radiation (Years 12 and 13). Original content aligned to the DfE GCE AS/A-level physics subject content.
// Keys are recomputed by _chk_p5part.ts — re-run _check_s7.ts after ANY edit here.
import type { CTopic } from "../types";
import { img, qb } from "./_h";

const q = qb("p5part", 12);
const q13 = qb("p5part", 13);
export const TOPIC: CTopic = {
  key: "p5part",
  topic: "Physics — Particles & Radiation",
  subject: "Science",
  years: {
    12: {
      year: 12,
      subtopic: "A-level Year 12 (AS)",
      objectives: [
        "Hadrons (baryons and mesons) and leptons; quarks and antiquarks (u, d, s) and their charges; antiparticles.",
        "Conservation of charge, baryon number and lepton number; beta decay at the quark level; exchange particles and the fundamental interactions.",
        "Photon energy E = hf = hc/λ and the electronvolt; line spectra and energy levels.",
        "The photoelectric effect: threshold frequency, work function, hf = φ + KEmax, and why it supports the particle model of light.",
        "Wave–particle duality: de Broglie wavelength λ = h/p and electron diffraction; specific charge.",
      ],
      note: {
        title: "Quarks, leptons, photons and wave–particle duality",
        body: `## Key ideas

**Hadrons** feel the strong interaction. **Baryons** (three quarks, baryon number +1) include the proton (uud) and neutron (udd). **Mesons** are a quark plus an antiquark, such as π⁺ = u d̄. **Leptons** (electron, muon, neutrinos) are fundamental. Quark charges are u = +⅔e and d = −⅓e. In every interaction **charge, baryon number and lepton number are conserved**. In β⁻ decay a down quark becomes an up quark: n → p + e⁻ + ν̄ₑ.

Light comes in **photons** of energy E = hf. In the **photoelectric effect** an electron leaves a metal only if one photon carries at least the work function φ, so there is a **threshold frequency** f₀ = φ ÷ h however intense the light. Electrons also behave as waves: electron diffraction shows a **de Broglie wavelength** λ = h ÷ p.

| Idea | Formula |
| --- | --- |
| Photon energy | E = hf = hc ÷ λ |
| Photoelectric effect | hf = φ + KEmax |
| de Broglie wavelength | λ = h ÷ (mv) |
| Specific charge | charge ÷ mass, in C kg⁻¹ |
| Energy levels | hf = E₁ − E₂ |
| Constants | h = 6.63 × 10⁻³⁴ J s, c = 3.00 × 10⁸ m s⁻¹, e = 1.60 × 10⁻¹⁹ C |

## Worked example 1

A photon has wavelength 620 nm. E = hc ÷ λ = (6.63 × 10⁻³⁴ × 3.00 × 10⁸) ÷ (620 × 10⁻⁹) = 3.21 × 10⁻¹⁹ J, which is 3.21 × 10⁻¹⁹ ÷ 1.60 × 10⁻¹⁹ = **2.0 eV**.

## Worked example 2

A proton has charge 1.60 × 10⁻¹⁹ C and mass 1.67 × 10⁻²⁷ kg, so its specific charge is **9.58 × 10⁷ C kg⁻¹**.

## Worked example 3

A metal has φ = 2.0 eV and is lit by 3.2 eV photons: KEmax = 3.2 − 2.0 = **1.2 eV**.`,
      },
      quiz: {
        title: "Particles & Radiation: Year 12 quiz",
        questions: [
          q.single(1, "Which of these is a fundamental (elementary) particle?", "electron", ["neutron", "proton", "pion"], "Protons, neutrons and pions are made of quarks (hadrons). The electron is a lepton with no internal structure."),
          q.single(1, "Which quark combination makes a proton?", "up, up, down", ["up, down, down", "up, up, strange", "down, down, strange"], "Charge = +⅔ + ⅔ − ⅓ = +1e for uud. The neutron is udd (charge 0)."),
          q.single(2, "In β⁻ decay a neutron changes into a proton: n → p + e⁻ + ?  What is the missing particle?", "an electron antineutrino", ["an electron neutrino", "a positron", "a photon"], "Lepton number must be conserved: the electron has +1, so the extra particle must have −1, which is an antineutrino.", { diag: true }),
          q.single(2, "Which of these decays is NOT allowed because it breaks a conservation law?", "n → p + e⁻", ["n → p + e⁻ + ν̄ₑ", "μ⁻ → e⁻ + ν̄ₑ + νμ", "π⁺ → μ⁺ + νμ"], "n → p + e⁻ has lepton number 0 before and +1 after. The others conserve charge, baryon number and each lepton number."),
          q.num(2, "Calculate the energy of a photon of wavelength 450 nm, in units of 10⁻¹⁹ J, to 3 significant figures. (h = 6.63 × 10⁻³⁴ J s, c = 3.00 × 10⁸ m s⁻¹)", 4.42, 0.01, "E = hc ÷ λ = (6.63 × 10⁻³⁴ × 3.00 × 10⁸) ÷ (450 × 10⁻⁹) = 4.42 × 10⁻¹⁹ J."),
          q.num(2, "Light of frequency 8.0 × 10¹⁴ Hz shines on a metal of work function 2.3 eV. Calculate the maximum kinetic energy of the photoelectrons, in eV, to 2 significant figures. (h = 6.63 × 10⁻³⁴ J s, e = 1.60 × 10⁻¹⁹ C)", 1, 0.05, "Photon energy = hf = 5.30 × 10⁻¹⁹ J = 3.3 eV. KEmax = hf − φ = 3.3 − 2.3 = 1.0 eV.", { diag: true }),
          q.single(2, "Which observation is explained by the photon model of light but NOT by the wave model?", "No electrons are emitted below a threshold frequency, however intense the light", ["The photocurrent is proportional to the light intensity when the frequency is above the threshold", "Metals contain free electrons that can absorb energy from an electromagnetic wave", "Light can be reflected from a polished metal surface"], "A wave model predicts that a bright enough light of any frequency would eventually free electrons. A single photon must have hf ≥ φ, which explains the threshold."),
          q.num(3, "The graph shows the maximum kinetic energy of photoelectrons against the frequency of the incident light for one metal. Use it to find the work function of the metal, in eV, to 2 significant figures. (h = 6.63 × 10⁻³⁴ J s, e = 1.60 × 10⁻¹⁹ C)", 2.5, 0.1, "The line meets the frequency axis at the threshold frequency f₀ = 6.0 × 10¹⁴ Hz. φ = hf₀ = 6.63 × 10⁻³⁴ × 6.0 × 10¹⁴ = 3.98 × 10⁻¹⁹ J = 2.5 eV.", { image: img("p5part-y12-photoelectric.png", "A graph of maximum kinetic energy of photoelectrons in electronvolts against frequency in units of 10 to the 14 hertz. A straight line rises from zero kinetic energy at the frequency axis, starting at 6.0 on the horizontal axis, and reaches about 1.7 electronvolts at a frequency of 10.") }),
          q.num(2, "An electron travels at 4.0 × 10⁶ m s⁻¹. Calculate its de Broglie wavelength, in units of 10⁻¹⁰ m, to 3 significant figures. (h = 6.63 × 10⁻³⁴ J s, electron mass 9.11 × 10⁻³¹ kg)", 1.82, 0.01, "λ = h ÷ (mv) = 6.63 × 10⁻³⁴ ÷ (9.11 × 10⁻³¹ × 4.0 × 10⁶) = 1.82 × 10⁻¹⁰ m."),
          q.num(3, "Some energy levels of hydrogen are −13.6 eV, −3.40 eV, −1.51 eV and −0.85 eV. An electron falls from the −1.51 eV level to the −3.40 eV level. Calculate the wavelength of the photon emitted, in nm, to 3 significant figures. (h = 6.63 × 10⁻³⁴ J s, c = 3.00 × 10⁸ m s⁻¹, 1 eV = 1.60 × 10⁻¹⁹ J)", 658, 2, "ΔE = 3.40 − 1.51 = 1.89 eV = 3.02 × 10⁻¹⁹ J. λ = hc ÷ ΔE = 1.989 × 10⁻²⁵ ÷ 3.02 × 10⁻¹⁹ = 6.58 × 10⁻⁷ m = 658 nm."),
          q.multi(2, "Which TWO of these particles are hadrons?", ["proton", "π⁺ meson"], ["electron", "muon neutrino"], "Hadrons are made of quarks: the proton (three quarks) and the pion (quark and antiquark). The electron and neutrino are leptons."),
          q.single(3, "An antibaryon is made of two anti-up quarks and one anti-down quark (ū ū d̄). What are its charge and baryon number?", "charge −1e, baryon number −1", ["charge +1e, baryon number +1", "charge −1e, baryon number +1", "charge +⅓e, baryon number −1"], "Anti-up = −⅔e each, anti-down = +⅓e: total −⅔ − ⅔ + ⅓ = −1e. Each antiquark has baryon number −⅓, so the total is −1."),
          q.num(2, "An alpha particle has charge +2e and mass 6.65 × 10⁻²⁷ kg. Calculate its specific charge, in units of 10⁷ C kg⁻¹, to 3 significant figures. (e = 1.60 × 10⁻¹⁹ C)", 4.81, 0.01, "Specific charge = charge ÷ mass = (2 × 1.60 × 10⁻¹⁹) ÷ 6.65 × 10⁻²⁷ = 4.81 × 10⁷ C kg⁻¹."),
        ],
      },
      flashcards: [
        { front: "Baryon vs meson", back: "Baryon = three quarks (baryon number +1). Meson = one quark + one antiquark (baryon number 0)." },
        { front: "Quark composition of proton and neutron", back: "Proton uud, neutron udd." },
        { front: "Charge of up and down quarks", back: "up = +⅔e, down = −⅓e (antiquarks have opposite charge)." },
        { front: "Three quantities conserved in particle interactions", back: "Charge, baryon number, lepton number." },
        { front: "β⁻ decay at the quark level", back: "d → u + e⁻ + ν̄ₑ, so n → p + e⁻ + ν̄ₑ." },
        { front: "Photon energy formulae", back: "E = hf = hc ÷ λ." },
        { front: "Photoelectric equation", back: "hf = φ + KEmax. Emission needs f ≥ f₀ = φ ÷ h." },
        { front: "Why does the photoelectric effect support the particle model?", back: "Threshold frequency and instant emission: one photon gives all its energy to one electron." },
        { front: "de Broglie wavelength", back: "λ = h ÷ p = h ÷ (mv). Electron diffraction shows electrons behave as waves." },
        { front: "Line spectra come from...", back: "Electrons falling between discrete energy levels: hf = E₁ − E₂." },
        { front: "What is 1 eV?", back: "The energy gained by an electron accelerated through 1 V: 1.60 × 10⁻¹⁹ J." },
      ],
    },
    13: {
      year: 13,
      subtopic: "A-level Year 13 (A2)",
      objectives: [
        "The strong nuclear force: short range, attractive between nucleons, repulsive at very small separations.",
        "Mass–energy equivalence E = mc²; mass defect and binding energy; units (u, MeV).",
        "The binding energy per nucleon curve against nucleon number; stability and the peak near iron.",
        "Energy released in nuclear fission and fusion, calculated from mass defects and from the binding energy curve.",
        "Fission chain reactions and the conditions for fusion.",
      ],
      note: {
        title: "Mass defect, binding energy, fission and fusion",
        body: `## Key ideas

The nucleus is held together by the **strong nuclear force**: it is attractive between nucleons at separations up to a few femtometres, and repulsive at very small separations, which stops the nucleus collapsing. A nucleus has **less mass** than its separate nucleons. This **mass defect** Δm is the mass that was converted to energy, and E = Δm c² is the **binding energy**, the energy needed to separate the nucleus into free nucleons.

The **binding energy per nucleon** (BE ÷ A) is a measure of stability. It rises steeply for light nuclei, peaks near ⁵⁶Fe (about 8.8 MeV) and falls slowly for heavy nuclei. **Fusion** of light nuclei and **fission** of heavy nuclei both move products toward the peak, so energy is released.

| Quantity | Formula or value |
| --- | --- |
| Mass defect | Δm = Zmp + (A − Z)mn − m(nucleus) |
| Energy | E = Δm c² |
| Conversion | 1 u = 1.66 × 10⁻²⁷ kg = 931.5 MeV/c² |
| Per nucleon | BE ÷ A |
| Constants | c = 3.00 × 10⁸ m s⁻¹, mp = 1.007276 u, mn = 1.008665 u, 1 MeV = 1.60 × 10⁻¹³ J |

## Worked example 1

A deuteron (²H nucleus with one proton and one neutron) has mass 2.013553 u. Δm = 1.007276 + 1.008665 − 2.013553 = 0.002388 u. BE = 0.002388 × 931.5 = **2.22 MeV**, which is **1.11 MeV per nucleon**.

## Worked example 2

A mass of 1.0 × 10⁻²⁹ kg is converted to energy: E = mc² = 1.0 × 10⁻²⁹ × (3.00 × 10⁸)² = 9.0 × 10⁻¹³ J, or **5.6 MeV**.`,
      },
      quiz: {
        title: "Particles & Radiation: Year 13 quiz (nuclear binding energy)",
        questions: [
          q13.single(1, "Which interaction holds the nucleons together in a nucleus?", "the strong nuclear force", ["the gravitational force", "the weak nuclear force", "the electrostatic force between protons"], "Gravity is far too weak, and the electrostatic force between protons is repulsive. The strong force is attractive and acts between nucleons over very short range."),
          q13.single(1, "What is the mass defect of a nucleus?", "the mass of the separate nucleons minus the mass of the nucleus", ["the mass of the nucleus minus the mass of the separate nucleons", "the mass of the electrons in the atom", "the mass lost when the nucleus decays"], "The nucleus weighs less than its nucleons apart. The difference is the mass defect, equivalent to the binding energy through E = mc²."),
          q13.num(2, "A mass of 2.0 × 10⁻³⁰ kg is completely converted into energy. Calculate the energy released, in units of 10⁻¹³ J, to 2 significant figures. (c = 3.00 × 10⁸ m s⁻¹)", 1.8, 0.05, "E = mc² = 2.0 × 10⁻³⁰ × (3.00 × 10⁸)² = 2.0 × 10⁻³⁰ × 9.00 × 10¹⁶ = 1.8 × 10⁻¹³ J.", { diag: true }),
          q13.num(2, "The mass defect of an oxygen-16 nucleus is 0.13700 u. Calculate its binding energy, in MeV, to 3 significant figures. (1 u = 931.5 MeV)", 128, 1, "BE = 0.13700 × 931.5 = 127.6 MeV, which is 128 MeV to 3 s.f."),
          q13.num(2, "The total binding energy of a ⁵⁶Fe nucleus is 492.3 MeV. Calculate the binding energy per nucleon, in MeV, to 3 significant figures.", 8.79, 0.01, "Binding energy per nucleon = 492.3 ÷ 56 (there are 56 nucleons) = 8.79 MeV.", { diag: true }),
          q13.single(2, "The graph shows binding energy per nucleon against nucleon number. Which labelled nucleus has the greatest binding energy per nucleon?", "⁵⁶Fe", ["⁴He", "¹²C", "²³⁵U"], "Reading the highest point among the labelled nuclei gives ⁵⁶Fe at about 8.8 MeV per nucleon: the most tightly bound.", { image: img("p5part-y13-bea.png", "A graph of binding energy per nucleon in MeV (vertical axis 0 to 10, gridlines every 1 MeV with fainter lines at each half) against nucleon number A from 0 to 240. Twelve points are plotted. Six are labelled: deuterium (2H), helium-4, carbon-12, iron-56, tin-120 and uranium-235. The values rise steeply for the lightest nuclei, reach a broad maximum at intermediate nucleon numbers, and then fall gradually towards the heaviest nuclei.") }),
          q13.single(2, "Why does fusing two light nuclei to make a heavier nucleus (lighter than iron) release energy?", "The product has a higher binding energy per nucleon, so its mass is less than the mass of the reactants", ["The product has a lower binding energy per nucleon than the reactants, so its mass is greater than theirs", "The strong force becomes repulsive at short range, pushing the nucleons apart and releasing energy", "Neutrons are converted into protons"], "Moving up the curve toward iron increases binding energy per nucleon, so some mass is converted to released energy."),
          q13.single(2, "Which statement about induced fission of uranium-235 is correct?", "The neutrons released can cause further fissions, giving a chain reaction", ["A single fission needs no neutron to start it", "The fission fragments have less binding energy per nucleon than uranium", "Fission of uranium releases no neutrons"], "Each fission releases two or three neutrons which can be absorbed by other nuclei. The fragments are more tightly bound per nucleon, so energy is released."),
          q13.num(3, "Deuterium and tritium fuse: ²H + ³H → ⁴He + n. Nuclear masses: ²H 2.013553 u, ³H 3.015501 u, ⁴He 4.001506 u, neutron 1.008665 u. Calculate the energy released, in MeV, to 3 significant figures. (1 u = 931.5 MeV)", 17.6, 0.05, "Mass before = 2.013553 + 3.015501 = 5.029054 u. Mass after = 4.001506 + 1.008665 = 5.010171 u. Δm = 0.018883 u, so E = 0.018883 × 931.5 = 17.6 MeV."),
          q13.num(3, "Each fission of a uranium-235 nucleus releases 200 MeV. Calculate the energy released by fissioning 1.00 kg of uranium-235, in units of 10¹³ J, to 3 significant figures. (molar mass 235 g mol⁻¹, Nₐ = 6.02 × 10²³ mol⁻¹, 1 MeV = 1.60 × 10⁻¹³ J)", 8.2, 0.05, "Nuclei = (1000 ÷ 235) × 6.02 × 10²³ = 2.56 × 10²⁴. Energy = 2.56 × 10²⁴ × 200 × 1.60 × 10⁻¹³ = 8.20 × 10¹³ J."),
          q13.multi(2, "Which TWO statements about binding energy are correct?", ["It is the energy needed to separate a nucleus completely into its individual nucleons", "A larger binding energy per nucleon means a more stable nucleus"], ["It is the energy stored in the orbiting electrons", "It is the energy released when a nucleus emits a beta particle"], "Binding energy is the work needed to pull all the nucleons apart; the more per nucleon, the more stable the nucleus."),
          q13.num(3, "Use the binding energy per nucleon graph to estimate the TOTAL binding energy of a ¹²C nucleus, in MeV, to the nearest MeV.", 92, 3, "Reading the graph gives about 7.7 MeV per nucleon. Total binding energy = 7.7 × 12 (nucleons) = 92 MeV.", { image: img("p5part-y13-bea.png", "A graph of binding energy per nucleon in MeV (vertical axis 0 to 10, gridlines every 1 MeV with fainter lines at each half) against nucleon number A from 0 to 240. Twelve points are plotted. Six are labelled: deuterium (2H), helium-4, carbon-12, iron-56, tin-120 and uranium-235. The values rise steeply for the lightest nuclei, reach a broad maximum at intermediate nucleon numbers, and then fall gradually towards the heaviest nuclei.") }),
          q13.written(3, "Use the binding energy per nucleon curve to explain why energy is released both when a heavy nucleus such as uranium-235 undergoes fission and when light nuclei such as hydrogen isotopes undergo fusion. Describe one practical difficulty in achieving controlled fusion. [6 marks]", "Binding energy per nucleon rises steeply for light nuclei, peaks near iron-56 at about 8.8 MeV and falls slowly for heavy nuclei. Fission splits a heavy nucleus into two medium nuclei with higher BE per nucleon; fusion joins light nuclei into a heavier one with higher BE per nucleon. In both cases the products are more tightly bound, the total binding energy increases, and the mass decreases (E = Δmc²), the difference being released as kinetic energy. Fusion needs about 10⁷–10⁸ K to overcome electrostatic repulsion, and confinement of the plasma is difficult.", "Mark scheme (max 6): curve rises to a peak near iron; heavy nuclei lie on the falling side (lower BE per nucleon than medium nuclei); fission produces nuclei nearer the peak, so BE per nucleon increases; light nuclei lie on the steep rising side; fusion gives a nucleus higher on the curve, so BE per nucleon increases; increased binding energy means the mass of the products is less (Δm), and the energy equivalent E = Δmc² is released as kinetic energy; practical difficulty: very high temperature (about 10⁸ K) needed to overcome the electrostatic repulsion between nuclei / plasma confinement (magnetic fields) / maintaining high density."),
        ],
      },
      flashcards: [
        { front: "Strong nuclear force: range and nature", back: "Acts between nucleons; attractive up to a few fm, repulsive below about 0.5 fm." },
        { front: "Mass defect", back: "Δm = mass of separate nucleons − mass of the nucleus." },
        { front: "Binding energy", back: "E = Δm c²: the energy needed to separate a nucleus into its nucleons." },
        { front: "1 u in MeV", back: "1 u = 931.5 MeV/c² = 1.66 × 10⁻²⁷ kg." },
        { front: "Which nucleus is most tightly bound per nucleon?", back: "Around ⁵⁶Fe (Fe, Ni region), about 8.8 MeV per nucleon." },
        { front: "Why does fusion release energy?", back: "The product lies higher on the BE per nucleon curve, so mass is lost and released as energy." },
        { front: "Why does fission release energy?", back: "Fragments lie closer to the peak (higher BE per nucleon) than the heavy nucleus." },
        { front: "Chain reaction", back: "Neutrons from one fission cause further fissions; controlled in a reactor using moderators and control rods." },
        { front: "Why is fusion hard to achieve?", back: "Nuclei repel electrostatically: need very high temperature (~10⁸ K) and plasma confinement." },
        { front: "Binding energy per nucleon", back: "Total binding energy ÷ nucleon number A; the higher, the more stable." },
      ],
    },
  },
};
