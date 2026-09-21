// A-level Physics — Waves & Optics (Year 12 progressive waves/interference; Year 13 stationary waves). Original content aligned to the DfE GCE AS/A-level physics subject content.
// Keys are recomputed by _chk_p5wave.ts — re-run _check_s7.ts after ANY edit here.
import type { CTopic } from "../types";
import { img, qb } from "./_h";

const q = qb("p5wave", 12);
const q13 = qb("p5wave", 13);
export const TOPIC: CTopic = {
  key: "p5wave",
  topic: "Physics — Waves & Optics",
  subject: "Science",
  years: {
    12: {
      year: 12,
      subtopic: "A-level Year 12 (AS)",
      objectives: [
        "Progressive waves: amplitude, wavelength, frequency, period, phase difference, wave speed v = fλ; transverse and longitudinal waves; polarisation.",
        "Refraction: refractive index n = c/v, Snell's law, total internal reflection and the critical angle.",
        "Superposition, path difference, coherence and interference; Young's double-slit experiment λ = ws/D.",
        "Diffraction: single-slit pattern and the diffraction grating d sinθ = nλ.",
        "Intensity of a wave is proportional to (amplitude)².",
      ],
      note: {
        title: "Progressive waves, refraction, interference and diffraction",
        body: `## Key ideas

A progressive wave transfers energy without transferring matter. Its speed is **v = fλ**, where f = 1 ÷ T. **Transverse** waves (light, water) oscillate at right angles to the direction of travel and can be **polarised**; **longitudinal** waves (sound) cannot.

Two waves overlap by **superposition**: displacements add. For **coherent** sources (same frequency, constant phase difference), bright fringes occur where the **path difference = nλ** and dark fringes where it is **(n + ½)λ**. Diffraction spreads a wave through a gap of similar size to λ, so a narrow slit gives a wider central maximum.

| Idea | Formula |
| --- | --- |
| Wave speed | v = fλ |
| Refractive index | n = c ÷ v |
| Snell's law | n₁ sinθ₁ = n₂ sinθ₂ |
| Critical angle | sinC = n₂ ÷ n₁ (glass to air: 1 ÷ n) |
| Double slit | w = λD ÷ s |
| Diffraction grating | d sinθ = nλ |
| Intensity | I ∝ (amplitude)² |

## Worked example 1

Sound of frequency 440 Hz travels at 340 m s⁻¹. λ = v ÷ f = 340 ÷ 440 = **0.77 m**.

## Worked example 2

Light of wavelength 650 nm passes through slits 0.50 mm apart onto a screen 2.0 m away. The fringe spacing is w = λD ÷ s = (650 × 10⁻⁹ × 2.0) ÷ (0.50 × 10⁻³) = **2.6 mm**.

## Worked example 3

Light enters glass (n = 1.50) from air at 40°. sinθ₂ = sin 40° ÷ 1.50 = 0.429, so θ₂ = **25°**. For water (n = 1.33), sinC = 1 ÷ 1.33, so C = **48.8°**.`,
      },
      quiz: {
        title: "Waves & Optics: Year 12 quiz",
        questions: [
          q.single(1, "Which of these waves can be polarised?", "visible light", ["sound in air", "ultrasound in water", "compression waves on a slinky spring"], "Only transverse waves can be polarised. Light is transverse; sound in fluids and compression waves on a spring are longitudinal."),
          q.num(1, "A water wave has frequency 2.5 Hz and wavelength 0.36 m. Calculate its speed, in m s⁻¹, to 2 significant figures.", 0.9, 0.005, "v = fλ = 2.5 × 0.36 = 0.90 m s⁻¹."),
          q.num(2, "In a double-slit experiment the slits are 0.40 mm apart, the screen is 1.5 m away and the fringe spacing is 2.1 mm. Calculate the wavelength of the light, in nm, to 2 significant figures.", 560, 5, "λ = ws ÷ D = (2.1 × 10⁻³ × 0.40 × 10⁻³) ÷ 1.5 = 5.6 × 10⁻⁷ m = 560 nm.", { diag: true }),
          q.num(2, "A diffraction grating has 600 lines per mm. Calculate the angle to the normal of the second-order maximum for light of wavelength 450 nm, in degrees, to 3 significant figures.", 32.7, 0.1, "d = 1 ÷ 600 000 = 1.667 × 10⁻⁶ m. sinθ = nλ ÷ d = 2 × 450 × 10⁻⁹ ÷ 1.667 × 10⁻⁶ = 0.540, so θ = 32.7°."),
          q.single(2, "Two coherent sources produce a dark fringe at a point. The path difference from the two sources to that point is:", "(n + ½)λ", ["nλ", "2nλ", "n²λ"], "Waves arrive in antiphase when one is half a wavelength (or an odd number of half-wavelengths) behind the other, so they cancel.", { diag: true }),
          q.num(2, "A ray of light in air strikes glass of refractive index 1.62 at an angle of incidence of 55°. Calculate the angle of refraction, in degrees, to 3 significant figures.", 30.4, 0.1, "sinθ₂ = sin 55° ÷ 1.62 = 0.8192 ÷ 1.62 = 0.5057, so θ₂ = 30.4°."),
          q.num(2, "Calculate the critical angle for a glass–air boundary where the glass has refractive index 1.52, in degrees, to 3 significant figures.", 41.1, 0.1, "At the critical angle sinC = 1 ÷ n = 1 ÷ 1.52 = 0.658, so C = 41.1°."),
          q.num(3, "The graph shows the intensity pattern on a screen 1.20 m from two slits that are 0.30 mm apart. Use the graph to find the fringe spacing and hence the wavelength of the light, in nm, to 2 significant figures.", 600, 20, "The maxima are equally spaced 2.4 mm apart (e.g. the third bright fringe is 7.2 mm from the centre). λ = ws ÷ D = 2.4 × 10⁻³ × 0.30 × 10⁻³ ÷ 1.20 = 6.0 × 10⁻⁷ m = 600 nm.", { image: img("p5wave-y12-fringes.png", "A graph of relative intensity against position across a screen in millimetres from minus 8 to plus 8. It shows a series of equally spaced bright fringe peaks with dark minima between them. The central peak at position 0 is tallest, and the peaks get gradually lower towards each edge. Fine gridlines every 0.4 millimetres allow the peak positions to be read.") }),
          q.single(2, "A single slit is made narrower while the same monochromatic light passes through it. What happens to the central diffraction maximum?", "It becomes wider", ["It becomes narrower", "It stays the same width but dimmer", "It disappears"], "Diffraction is greater when the gap is smaller: the central maximum has angular width about 2λ ÷ a, which increases as the slit width a decreases."),
          q.num(3, "One coherent wave of intensity 3.0 W m⁻² arrives at a point. A second identical coherent wave arrives in phase with it. Calculate the resultant intensity, in W m⁻².", 12, 0.1, "Intensity ∝ (amplitude)². In phase, the amplitudes add so the amplitude doubles and the intensity becomes 4 × 3.0 = 12 W m⁻²."),
          q.multi(3, "Which TWO conditions are needed to see a stable two-source interference pattern?", ["The sources have the same frequency", "The sources have a constant phase difference"], ["The sources have exactly equal amplitudes", "The sources emit white light"], "Coherence (same frequency and a constant phase difference) is essential. Equal amplitudes only give perfect dark fringes, and white light is not needed."),
          q.num(2, "Two points on a progressive wave are 0.10 m apart along the direction of travel. The wavelength is 0.48 m. Calculate the phase difference between the points, in degrees.", 75, 1, "Phase difference = (separation ÷ λ) × 360° = (0.10 ÷ 0.48) × 360° = 75°."),
          q.written(3, "Describe and explain how bright and dark fringes are formed in Young's double-slit experiment using monochromatic light, and state how the fringe spacing changes if the slits are moved closer together. [6 marks]", "Light from a single narrow slit (or laser) illuminates two close narrow slits; each diffracts and acts as a coherent source. Waves overlap and superpose. Where the path difference is nλ the waves arrive in phase (constructive interference) giving bright fringes; where it is (n+½)λ they arrive in antiphase and cancel, giving dark fringes. Fringe spacing w = λD/s so moving the slits closer together (smaller s) makes the fringes wider.", "Mark scheme (max 6): light from one source/single slit or laser illuminates two slits so the emerging waves are coherent; each slit diffracts the light so the waves overlap; superposition of waves in the overlap region; bright fringe where the path difference is nλ (waves in phase, constructive); dark fringe where the path difference is (n + ½)λ (antiphase, destructive); fringe spacing w = λD ÷ s, so decreasing s (slits closer) increases the fringe spacing."),
        ],
      },
      flashcards: [
        { front: "Wave speed equation", back: "v = fλ, with f = 1 ÷ T." },
        { front: "Which waves can be polarised?", back: "Only transverse waves (e.g. light). Longitudinal waves such as sound cannot." },
        { front: "Coherent sources", back: "Same frequency and a constant phase difference." },
        { front: "Path difference for a bright fringe", back: "nλ (waves arrive in phase)." },
        { front: "Path difference for a dark fringe", back: "(n + ½)λ (waves arrive in antiphase)." },
        { front: "Double-slit fringe spacing", back: "w = λD ÷ s." },
        { front: "Diffraction grating equation", back: "d sinθ = nλ, where d = 1 ÷ (lines per metre)." },
        { front: "Snell's law", back: "n₁ sinθ₁ = n₂ sinθ₂." },
        { front: "Conditions for total internal reflection", back: "Light in the denser medium and angle of incidence greater than the critical angle C, where sinC = n₂ ÷ n₁." },
        { front: "Intensity and amplitude", back: "I ∝ (amplitude)²: double the amplitude, four times the intensity." },
        { front: "Effect of a narrower slit on diffraction", back: "The central maximum gets wider (more diffraction)." },
      ],
    },
    13: {
      year: 13,
      subtopic: "A-level Year 13 (A2)",
      objectives: [
        "Stationary waves formed by superposition of two progressive waves travelling in opposite directions; nodes and antinodes.",
        "Differences between stationary and progressive waves: amplitude, phase and energy transfer.",
        "Harmonics on a string fixed at both ends: f₁ = (1/2L)√(T/μ); wavelength λ = 2L/n.",
        "Stationary waves in open and closed pipes; microwaves and sound experiments.",
      ],
      note: {
        title: "Stationary waves on strings and in pipes",
        body: `## Key ideas

A **stationary wave** forms when two progressive waves of the same frequency and similar amplitude travel in opposite directions (often an incident wave and its reflection). Points of zero amplitude are **nodes** and points of maximum amplitude are **antinodes**. Adjacent nodes are **λ ÷ 2** apart.

Unlike a progressive wave, a stationary wave transfers **no net energy**; the amplitude varies with position; all points between two adjacent nodes oscillate **in phase**, and points in adjacent loops are in **antiphase**.

On a string fixed at both ends, nodes must lie at the ends, so only certain wavelengths fit: λ = 2L ÷ n and f = n f₁, giving the **harmonics**.

| Situation | Formula |
| --- | --- |
| String fixed at both ends | f₁ = v ÷ 2L = (1 ÷ 2L)√(T ÷ μ) |
| Harmonics of a string | fₙ = n f₁ (n = 1, 2, 3 …) |
| Open pipe (both ends open) | fₙ = n v ÷ 2L |
| Closed pipe (one end closed) | f = (2n − 1) v ÷ 4L, odd harmonics only |
| Speed on a string | v = √(T ÷ μ) |

## Worked example 1

A string of length 0.50 m has wave speed 240 m s⁻¹. The fundamental frequency is f₁ = v ÷ 2L = 240 ÷ 1.00 = **240 Hz**. The second harmonic is 480 Hz.

## Worked example 2

An open pipe of length 0.85 m in air (speed 340 m s⁻¹) has f₁ = 340 ÷ (2 × 0.85) = **200 Hz**. A closed pipe of the same length has f₁ = 340 ÷ (4 × 0.85) = **100 Hz**.`,
      },
      quiz: {
        title: "Waves & Optics: Year 13 quiz (stationary waves)",
        questions: [
          q13.single(1, "How is a stationary wave produced?", "By superposition of two waves of the same frequency travelling in opposite directions", ["By a single wave travelling in one direction along a string", "By two waves with different frequencies travelling in the same direction", "By diffraction of a wave through a narrow gap"], "A stationary wave is the superposition of a wave and its reflection (or an identical wave in the opposite direction): the pattern does not travel."),
          q13.single(1, "What is the distance between two adjacent nodes of a stationary wave?", "half a wavelength", ["one wavelength", "a quarter of a wavelength", "two wavelengths"], "Nodes occur every λ ÷ 2, and an antinode lies midway between adjacent nodes."),
          q13.num(2, "A string is fixed at both ends and has length 0.65 m. Waves travel along it at 130 m s⁻¹. Calculate the frequency of the fundamental (first harmonic), in Hz, to 3 significant figures.", 100, 1, "f₁ = v ÷ 2L = 130 ÷ (2 × 0.65) = 100 Hz.", { diag: true }),
          q13.num(2, "The fundamental frequency of a guitar string is 145 Hz. Calculate the frequency of its third harmonic, in Hz.", 435, 1, "The nth harmonic is n × f₁, so the third harmonic is 3 × 145 = 435 Hz."),
          q13.num(2, "A string of length 0.60 m has mass per unit length 1.0 × 10⁻³ kg m⁻¹ and tension 64 N. Calculate its fundamental frequency, in Hz, to 3 significant figures. (f₁ = (1 ÷ 2L) √(T ÷ μ))", 211, 1, "√(T ÷ μ) = √(64 ÷ 1.0 × 10⁻³) = √64 000 = 253 m s⁻¹. f₁ = 253 ÷ (2 × 0.60) = 211 Hz.", { diag: true }),
          q13.num(2, "A pipe closed at one end has length 0.30 m. The speed of sound in air is 340 m s⁻¹. Calculate the frequency of the fundamental, in Hz, to 3 significant figures.", 283, 1, "For a closed pipe there is a node at the closed end and an antinode at the open end, so L = λ ÷ 4. f₁ = v ÷ 4L = 340 ÷ 1.20 = 283 Hz."),
          q13.single(2, "A pipe closed at one end and a pipe open at both ends have the same length. Which statement is correct?", "The closed pipe produces only odd harmonics and its fundamental is half that of the open pipe", ["The closed pipe produces all harmonics and its fundamental is double that of the open pipe", "Both pipes produce the same set of frequencies", "The closed pipe has an antinode at both ends"], "Closed pipe: f = (2n − 1)v ÷ 4L (odd harmonics). Open pipe: f = nv ÷ 2L. The closed pipe fundamental is v ÷ 4L, half of v ÷ 2L."),
          q13.num(3, "The diagram shows a stationary wave on a string of length 1.80 m fixed at both ends. The vibrator frequency is 75 Hz. Calculate the speed of the progressive waves on the string, in m s⁻¹.", 90, 1, "There are 3 half-wavelength loops, so 3 × λ ÷ 2 = 1.80 m and λ = 1.20 m. v = fλ = 75 × 1.20 = 90 m s⁻¹.", { image: img("p5wave-y13-string.png", "A drawing of a stationary wave on a horizontal string of length 1.80 metres fixed at both ends, with the shape of the string at maximum displacement shown as a solid curve and half a cycle later as a dashed curve. Three equal loops are visible with nodes at the ends and two nodes between them.") }),
          q13.single(3, "Which statement about the oscillations of particles on a stationary wave is correct?", "Particles between adjacent nodes oscillate in phase, and particles in adjacent loops are in antiphase", ["All particles oscillate with the same amplitude, because the two travelling waves have equal amplitude", "Particles in adjacent loops oscillate in phase, because the whole string is driven by one source", "Particles at a node have the maximum amplitude, and the pattern travels along the string"], "Within one loop everything moves up and down together; passing a node reverses the phase. Amplitude varies from zero at nodes to a maximum at antinodes."),
          q13.num(3, "In a microwave standing-wave experiment adjacent nodes are 1.6 cm apart. Calculate the frequency of the microwaves, in GHz, to 2 significant figures. (c = 3.00 × 10⁸ m s⁻¹)", 9.4, 0.05, "Adjacent nodes are λ ÷ 2 apart, so λ = 3.2 cm = 0.032 m. f = c ÷ λ = 3.00 × 10⁸ ÷ 0.032 = 9.4 × 10⁹ Hz."),
          q13.multi(3, "Which TWO statements distinguish a stationary wave from a progressive wave?", ["A stationary wave transfers no net energy along the string", "In a stationary wave the amplitude varies with position"], ["A stationary wave has the same amplitude at every point", "Adjacent antinodes of a stationary wave oscillate in phase"], "A stationary wave stores energy in the oscillation but does not transport it. Amplitude ranges from 0 (nodes) to maximum (antinodes), and adjacent loops are in antiphase."),
          q13.num(2, "A string has a fundamental frequency of 180 Hz. The tension is increased to four times its original value with no change in length or mass per unit length. Calculate the new fundamental frequency, in Hz.", 360, 1, "f₁ ∝ √T, so quadrupling T multiplies f₁ by √4 = 2. The new frequency is 2 × 180 = 360 Hz."),
          q13.written(3, "Explain how a stationary wave is formed on a stretched string fixed at both ends, and why only certain frequencies produce a stationary wave. Describe the pattern at the fundamental frequency. [6 marks]", "A wave sent along the string reflects at the fixed end; the incident and reflected waves (same frequency and speed) superpose. At nodes the waves are always in antiphase so displacement is zero; at antinodes they are in phase so the amplitude is maximum. The string is fixed at both ends, so nodes must be at both ends, which means an integer number of half wavelengths fits: L = nλ/2, so only frequencies f = nv/2L give a stationary wave. At the fundamental there is one loop: a node at each end and one antinode at the centre, with λ = 2L.", "Mark scheme (max 6): incident wave reflects at the fixed end; incident and reflected waves of the same frequency travel in opposite directions and superpose; nodes where the waves are always in antiphase (zero displacement); antinodes where in phase (maximum amplitude); nodes must occur at both fixed ends so an integer number of half-wavelengths fits (L = nλ ÷ 2, giving f = nv ÷ 2L); fundamental: one loop, nodes at both ends, one antinode in the middle, λ = 2L."),
        ],
      },
      flashcards: [
        { front: "Node vs antinode", back: "Node = point of zero amplitude. Antinode = point of maximum amplitude." },
        { front: "Node-to-node distance", back: "λ ÷ 2." },
        { front: "Formation of a stationary wave", back: "Superposition of two waves with the same frequency travelling in opposite directions (e.g. incident + reflected)." },
        { front: "Stationary vs progressive: energy", back: "Stationary waves transfer no net energy along the medium; progressive waves do." },
        { front: "Phase in a stationary wave", back: "In phase between adjacent nodes; antiphase in adjacent loops." },
        { front: "String fixed at both ends: fundamental", back: "λ = 2L, f₁ = v ÷ 2L = (1 ÷ 2L) √(T ÷ μ)." },
        { front: "Harmonics on a string", back: "fₙ = n f₁ (n = 1, 2, 3 …)." },
        { front: "Closed pipe fundamental", back: "L = λ ÷ 4, f₁ = v ÷ 4L; only odd harmonics." },
        { front: "Open pipe fundamental", back: "L = λ ÷ 2, f₁ = v ÷ 2L; all harmonics." },
        { front: "Effect of tension on frequency", back: "f ∝ √T, so quadrupling T doubles f." },
      ],
    },
  },
};
