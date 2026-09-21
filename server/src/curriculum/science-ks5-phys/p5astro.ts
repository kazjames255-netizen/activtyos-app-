// A-level Physics — Astrophysics & Cosmology (Year 13). Original content aligned to the DfE GCE AS/A-level physics subject content.
// Keys are recomputed by _chk_p5astro.ts — re-run _check_s7.ts after ANY edit here.
import type { CTopic } from "../types";
import { img, qb } from "./_h";

const q = qb("p5astro", 13);
export const TOPIC: CTopic = {
  key: "p5astro",
  topic: "Physics — Astrophysics & Cosmology",
  subject: "Science",
  years: {
    13: {
      year: 13,
      subtopic: "A-level Year 13 (A2)",
      objectives: [
        "Distances: astronomical unit, light year, parsec; parallax; standard candles and intensity I = L/4πd².",
        "Black-body radiation: Stefan's law L = 4πr²σT⁴ and Wien's law λmax T = constant.",
        "The Hertzsprung–Russell diagram and stellar evolution, including white dwarfs, neutron stars and black holes.",
        "The Doppler effect and red shift Δλ/λ ≈ v/c; Hubble's law v = H₀d.",
        "The Big Bang model, the expansion of the universe, the cosmic microwave background and the age of the universe.",
      ],
      note: {
        title: "Stars, the H–R diagram, red shift and the Big Bang",
        body: `## Key ideas

A star radiates like a **black body**. **Wien's law** gives its peak wavelength, λmax T = 2.90 × 10⁻³ m K, so hotter stars are bluer. **Stefan's law** gives its luminosity, **L = 4πr²σT⁴**. The intensity received at distance d is **I = L ÷ 4πd²**.

The **Hertzsprung–Russell diagram** plots luminosity against temperature (with temperature increasing to the left). Most stars lie on the **main sequence** (fusing hydrogen in the core). Red giants and supergiants are cool but very luminous (large); white dwarfs are hot but dim (small). A star like the Sun ends as a white dwarf; a much more massive star ends in a supernova, leaving a neutron star or black hole.

Light from receding galaxies is **red-shifted**: Δλ ÷ λ = v ÷ c for v ≪ c. **Hubble's law** v = H₀d shows the universe is expanding, and 1 ÷ H₀ estimates its age. The **cosmic microwave background** is evidence of a hot, dense early universe.

| Idea | Formula |
| --- | --- |
| Wien's law | λmax T = 2.90 × 10⁻³ m K |
| Stefan's law | L = 4πr²σT⁴, σ = 5.67 × 10⁻⁸ W m⁻² K⁻⁴ |
| Intensity | I = L ÷ 4πd² |
| Red shift | Δλ ÷ λ = v ÷ c |
| Hubble's law | v = H₀d |

## Worked example 1

The Sun's surface is at about 5800 K, so λmax = 2.90 × 10⁻³ ÷ 5800 = **500 nm** (green).

## Worked example 2

A galaxy recedes at 3.0 × 10⁶ m s⁻¹: Δλ ÷ λ = 3.0 × 10⁶ ÷ 3.00 × 10⁸ = 0.010, so a 500 nm line shifts by **5.0 nm**.

## Worked example 3

If a star has twice the radius of another but the same temperature, its luminosity is 2² = **4 times** larger.`,
      },
      quiz: {
        title: "Astrophysics & Cosmology: Year 13 quiz",
        questions: [
          q.single(1, "The diagram is a Hertzsprung–Russell diagram. What type of star is star W?", "a white dwarf", ["a red giant", "a supergiant", "a main-sequence star"], "W is hot (on the left) but has low luminosity (near the bottom): a small, hot star, which is a white dwarf.", { image: img("p5astro-y13-hr.png", "A Hertzsprung–Russell diagram with luminosity in solar units on a logarithmic vertical axis from 10 to the minus 4 up to 10 to the 6, and temperature in kelvin on a logarithmic horizontal axis running from 40000 on the left to 2500 on the right. A faint band runs diagonally from top left to bottom right. Five lettered stars are marked: V at the upper left, Y in the middle of the band, Z at the lower right, X at the upper right, and W at the lower left below the band.") }),
          q.num(1, "A star has a parallax angle of 0.25 arcseconds. Calculate its distance in parsecs. (distance in pc = 1 ÷ parallax in arcseconds)", 4, 0.05, "d = 1 ÷ p = 1 ÷ 0.25 = 4.0 pc."),
          q.num(2, "The peak wavelength of light from a cool star is 830 nm. Use Wien's law to calculate its surface temperature, in K, to 3 significant figures. (λmax T = 2.90 × 10⁻³ m K)", 3490, 10, "T = 2.90 × 10⁻³ ÷ λmax = 2.90 × 10⁻³ ÷ 830 × 10⁻⁹ = 3490 K.", { diag: true }),
          q.num(2, "A star has radius 1.4 × 10⁹ m and surface temperature 5000 K. Calculate its luminosity, in units of 10²⁶ W, to 3 significant figures. (σ = 5.67 × 10⁻⁸ W m⁻² K⁻⁴)", 8.73, 0.02, "L = 4πr²σT⁴ = 4π × (1.4 × 10⁹)² × 5.67 × 10⁻⁸ × 5000⁴ = 8.73 × 10²⁶ W."),
          q.num(2, "A hydrogen line of wavelength 656.3 nm in the laboratory appears at 660.0 nm in the light from a distant galaxy. Calculate the speed at which the galaxy is receding, in km s⁻¹, to 3 significant figures. (c = 3.00 × 10⁸ m s⁻¹)", 1690, 10, "Δλ = 660.0 − 656.3 = 3.7 nm. v = c × Δλ ÷ λ = 3.00 × 10⁸ × 3.7 ÷ 656.3 = 1.69 × 10⁶ m s⁻¹ = 1690 km s⁻¹.", { diag: true }),
          q.num(2, "A galaxy is receding at 2800 km s⁻¹. Taking the Hubble constant as 70 km s⁻¹ Mpc⁻¹, calculate its distance, in Mpc.", 40, 0.5, "Hubble's law v = H₀d, so d = v ÷ H₀ = 2800 ÷ 70 = 40 Mpc."),
          q.num(3, "Estimate the age of the universe from the Hubble constant H₀ = 70 km s⁻¹ Mpc⁻¹, using age = 1 ÷ H₀. Give your answer in billions of years to 3 significant figures. (1 Mpc = 3.09 × 10¹⁹ km, 1 year = 3.16 × 10⁷ s)", 14, 0.1, "H₀ = 70 ÷ 3.09 × 10¹⁹ = 2.27 × 10⁻¹⁸ s⁻¹. 1 ÷ H₀ = 4.41 × 10¹⁷ s = 4.41 × 10¹⁷ ÷ 3.16 × 10⁷ = 1.40 × 10¹⁰ years, i.e. 14.0 billion years."),
          q.num(3, "Star X has a surface temperature of 3500 K and a luminosity of 1.0 × 10⁵ L☉. The Sun has a temperature of 5800 K and luminosity 1 L☉. Use L ∝ r²T⁴ to calculate the radius of star X in solar radii, to 3 significant figures.", 868, 3, "L ∝ r²T⁴, so r² ∝ L ÷ T⁴. (r ÷ r☉)² = 1.0 × 10⁵ ÷ (3500 ÷ 5800)⁴ = 1.0 × 10⁵ ÷ 0.1326 = 7.54 × 10⁵. r = 868 solar radii."),
          q.num(2, "A star of luminosity 4.0 × 10²⁷ W is 2.0 × 10¹⁷ m from Earth. Calculate the intensity of its light at Earth, in units of 10⁻⁹ W m⁻², to 3 significant figures.", 7.96, 0.03, "I = L ÷ 4πd² = 4.0 × 10²⁷ ÷ (4π × (2.0 × 10¹⁷)²) = 4.0 × 10²⁷ ÷ 5.03 × 10³⁵ = 7.96 × 10⁻⁹ W m⁻²."),
          q.single(2, "What is the likely final stage in the life of a star with the mass of the Sun?", "It becomes a red giant, sheds its outer layers, and leaves a white dwarf", ["It becomes a red supergiant, explodes as a supernova, and leaves a black hole", "It collapses directly into a neutron star once its hydrogen runs out", "It stays on the main sequence forever"], "Sun-like stars swell to red giants, eject their outer layers as a planetary nebula and leave a small dense white dwarf. Only much more massive stars end in supernovae."),
          q.single(2, "Which observation is the best evidence that the early universe was very hot and dense?", "The cosmic microwave background radiation with a black-body spectrum at about 2.7 K", ["The red shift of light from distant galaxies, which increases with their distance", "The existence of neutron stars and black holes in distant galaxies", "The variation of the temperature of stars along the main sequence"], "The microwave background is the cooled remnant of radiation from a hot, dense early universe. Red shift shows expansion but not directly the temperature."),
          q.multi(3, "Which TWO statements about the Hertzsprung–Russell diagram are correct?", ["Main-sequence stars are fusing hydrogen into helium in their cores", "Red giants are cool but very luminous because they have a very large surface area"], ["White dwarfs are found in the top right of the diagram", "Red giants are small and hot"], "Red giants have low surface temperature but huge radius, so high luminosity (L ∝ r²T⁴), placing them top right; white dwarfs lie bottom left."),
          q.num(3, "Star X has twice the radius and 1.6 times the surface temperature of star Y. Calculate the ratio of the luminosity of X to that of Y, to 3 significant figures.", 26.2, 0.1, "L ∝ r²T⁴, so L_X ÷ L_Y = 2² × 1.6⁴ = 4 × 6.5536 = 26.2."),
          q.written(3, "Describe the evolution of a star similar in mass to the Sun, from the main sequence to its final state, in terms of its position on the H–R diagram and the energy sources involved. [6 marks]", "A star like the Sun spends most of its life on the main sequence fusing hydrogen into helium in its core; gravity is balanced by radiation pressure. When the core hydrogen is used up the core contracts and heats, and hydrogen fusion continues in a shell around it; the outer layers expand and cool: the star moves to the red-giant region (upper right: cool but large and luminous), later helium fusion in the core. When fusion ends the outer layers are ejected as a planetary nebula, leaving the hot dense core, a white dwarf (lower left: hot but small and dim) which slowly cools and radiates without fusion.", "Mark scheme (max 6): main sequence with hydrogen fusing to helium in the core (energy source), balanced by gravity and radiation pressure; hydrogen in the core runs out and the core contracts while shell fusion begins; the star expands and cools, moving to the red giant region (top right of the H–R diagram); helium (and heavier) fusion occurs in the core; outer layers ejected as a planetary nebula; the remaining core is a white dwarf (bottom left of the H–R diagram), hot and small with no fusion, that cools over time."),
        ],
      },
      flashcards: [
        { front: "Wien's law", back: "λmax T = 2.90 × 10⁻³ m K: hotter stars peak at shorter wavelengths (bluer)." },
        { front: "Stefan's law", back: "L = 4πr²σT⁴ (σ = 5.67 × 10⁻⁸ W m⁻² K⁻⁴). So L ∝ r²T⁴." },
        { front: "Intensity at distance d", back: "I = L ÷ 4πd² (inverse-square law)." },
        { front: "H–R diagram axes", back: "Luminosity (vertical, log) against surface temperature (horizontal, log, decreasing to the right)." },
        { front: "Where are red giants and white dwarfs on the H–R diagram?", back: "Red giants: top right (cool, luminous). White dwarfs: bottom left (hot, dim)." },
        { front: "End of a Sun-like star", back: "Red giant, then planetary nebula, leaving a white dwarf." },
        { front: "End of a very massive star", back: "Supernova, leaving a neutron star or a black hole." },
        { front: "Red shift", back: "Δλ ÷ λ = v ÷ c: the lines from a receding source move to longer wavelengths." },
        { front: "Hubble's law", back: "v = H₀d: recession speed is proportional to distance, so the universe is expanding." },
        { front: "Age of the universe estimate", back: "About 1 ÷ H₀ ≈ 14 billion years." },
        { front: "Cosmic microwave background", back: "Black-body radiation at about 2.7 K: cooled relic of the hot early universe (evidence for the Big Bang)." },
      ],
    },
  },
};
