// GCSE Physics — Space (Year 11).
import type { CTopic } from "../types";
import { N, S, W, yr } from "./_h";

export const TOPIC: CTopic = {
  key: "p4space", topic: "Physics — Space", subject: "Science",
  years: {
    11: yr("p4space", 11, {
      obj: [
        "Describe the Solar System, galaxies and the Universe; describe the formation of the Solar System.",
        "Describe the life cycle of stars of different masses and the origin of elements.",
        "Explain how gravity provides the force for orbits; describe the relationship between orbital radius, speed and period.",
        "Use orbital speed v = 2πr ÷ T (higher tier).",
        "Describe red-shift, the Big Bang theory and the evidence for it (triple): CMBR and expansion.",
      ],
      note: ["GCSE Physics: stars, orbits and the expanding Universe", `## The Solar System
Our Sun is a **star** in the **Milky Way galaxy**. **Planets** orbit the Sun, **moons** orbit planets, and **gravity** provides the force that keeps them in orbit. A satellite in a circular orbit is constantly accelerating (changing direction) although its speed is constant. **Closer orbits are faster**: to stay in a larger orbit the speed is smaller.

## Life cycle of stars
Stars form from clouds of dust and gas (a **nebula**), pulled together by gravity into a **protostar**. When hot enough, hydrogen nuclei **fuse** to form helium (nuclear fusion), releasing energy: a **main sequence** star. Gravity (inwards) is balanced by radiation pressure (outwards).
- **Sun-sized star**: red giant → white dwarf (fading to a black dwarf).
- **Much more massive star**: red supergiant → **supernova** → **neutron star** or **black hole**.
Elements heavier than iron form in supernovae, and are scattered in space, later forming new stars and planets.

## Expanding Universe
Light from distant galaxies is **red-shifted**: its wavelength is longer, so they are moving away. Further galaxies show a bigger red-shift, so they are moving away faster. This supports the **Big Bang** theory. The **cosmic microwave background radiation** is further evidence.

## Orbital speed (higher tier)
v = 2π r ÷ T (r = orbital radius, T = time for one orbit).
Worked example: a satellite orbits at 4.2 × 10⁷ m with period 86 400 s: v = 2π × 4.2 × 10⁷ ÷ 86 400 = **3050 m/s** (3 s.f.).

**Working scientifically:** scientific theories, such as the Big Bang, are accepted when new evidence supports them and other explanations fail; the steady-state theory was rejected because of the CMBR.`],
      quiz: "GCSE Physics: Space quiz",
      qs: [
        S(1, "Which of these is a star?", "The Sun", ["The Moon", "Mars", "Jupiter"], "The Sun is a star that makes its own light through nuclear fusion. Planets and moons only reflect light.", {}),
        S(1, "What is the Milky Way?", "A galaxy of billions of stars", ["A star in our Solar System", "A planet", "A cloud of gas within the Sun"], "A galaxy is a huge group of stars held together by gravity. The Milky Way contains our Sun.", {}),
        S(1, "What happens in the core of a main sequence star?", "Hydrogen nuclei fuse to form helium", ["Helium is burnt with oxygen", "Nuclei split into smaller nuclei", "Atoms are destroyed"], "Nuclear fusion of hydrogen into helium releases the energy that stars radiate.", {}),
        S(2, "What will our Sun most likely become at the end of its life?", "A white dwarf", ["A black hole", "A neutron star", "A supernova"], "Sun-sized stars become red giants, then shed their outer layers and end as white dwarfs. Very massive stars end as neutron stars or black holes.", { diag: true }),
        S(2, "Which is the correct sequence for a star much more massive than the Sun?", "Nebula → protostar → main sequence → red supergiant → supernova → neutron star or black hole", ["Nebula → protostar → main sequence → red giant → white dwarf → black dwarf", "Protostar → nebula → main sequence → supernova → white dwarf", "Nebula → main sequence → protostar → red supergiant → black hole"], "Massive stars swell into red supergiants and explode as supernovae, leaving a neutron star or a black hole.", {}),
        S(2, "Why does a main sequence star stay a constant size for millions of years?", "The inward force of gravity is balanced by the outward pressure from fusion", ["Fusion has stopped in the core, so there is no outward pressure to make the star expand", "Gravity is zero inside a star, so there is no inward force that could change its size", "The star loses no energy to space, so nothing can change its size"], "The outward pressure from the hot gases and radiation produced by fusion balances the inward pull of gravity, keeping the star stable.", {}),
        S(2, "What does red-shift show about distant galaxies?", "They are moving away from us", ["They are moving towards us", "They are stationary", "They are getting smaller"], "The wavelength of light from distant galaxies is stretched to longer wavelengths (towards red) as the galaxies move away.", { diag: true }),
        S(2, "Which observation supports the Big Bang theory?", "Cosmic microwave background radiation", ["Sunspots moving across the surface of the Sun", "The different colours of stars in the night sky", "The phases of the Moon each month"], "The CMBR is thought to be heat radiation left over from the early hot Universe. It is evidence that everything started from a hot, dense state.", {}),
        S(2, "If a satellite is moved into a higher orbit (larger radius), what happens to the speed needed to stay in orbit?", "It decreases", ["It increases", "It stays the same", "It becomes zero"], "Gravity is weaker at greater distances, so a smaller speed keeps the satellite in a circular orbit.", {}),
        N(3, "A satellite orbits the Earth at a radius of 7.0 × 10⁶ m with an orbital period of 5400 s. Calculate its orbital speed in m/s, to 2 significant figures.", 8100, 50, "Speed = 2πr ÷ T = 2 × 3.14 × 7.0 × 10⁶ ÷ 5400 = 8140 m/s, which is 8100 m/s to 2 s.f.", () => (2 * Math.PI * 7.0e6) / 5400),
        S(3, "Why must the core of a star reach a very high temperature before hydrogen nuclei can fuse?", "Positive nuclei repel each other and need enough energy to get close together", ["Hydrogen is a solid at low temperature, so the nuclei cannot move about and collide", "The neutrons in the nuclei attract each other, and this attraction is only broken at high temperature", "Fusion needs the star to be spinning very fast, and only a very hot star can spin fast enough"], "All nuclei are positively charged, so they repel. Very high temperature and pressure give them enough kinetic energy to overcome this and fuse.", {}),
        S(3, "Where were most of the atoms of elements heavier than iron in our bodies made?", "In supernova explosions of massive stars", ["In the core of the Sun today", "In the Big Bang at the start of the Universe", "In the atmosphere of the early Earth"], "Fusion in stars makes elements up to iron. Heavier elements form in supernovae and are scattered into space before forming new stars and planets.", {}),
        W("Describe the life cycle of a star that is much more massive than our Sun, starting from a cloud of dust and gas. [6 marks]", "Mark scheme (6): a nebula of dust and gas collapses under gravity (1); it forms a protostar, and temperature rises (1); fusion of hydrogen into helium starts: a main sequence star, in balance between gravity and radiation pressure (1); when the hydrogen runs low it expands into a red supergiant (1); the core collapses and the star explodes as a supernova (1); the remaining core becomes a neutron star or a black hole, and the supernova scatters heavy elements into space (1)."),
      ],
      cards: [
        ["What keeps planets in orbit?", "The force of gravity."],
        ["Nebula", "A cloud of dust and gas where stars form."],
        ["Main sequence star", "Fusing hydrogen into helium; gravity balanced by outward pressure."],
        ["End of a Sun-sized star", "Red giant → white dwarf."],
        ["End of a massive star", "Red supergiant → supernova → neutron star or black hole."],
        ["Where are heavy elements made?", "In supernova explosions (up to iron in stars)."],
        ["Red-shift", "Wavelength of light from distant galaxies increases as they move away."],
        ["What does a greater red-shift show?", "The galaxy is further away and moving away faster."],
        ["Evidence for the Big Bang", "Red-shift (expansion) and cosmic microwave background radiation."],
        ["Orbital speed and radius", "A larger orbit needs a smaller speed."],
        ["Orbital speed equation (HT)", "v = 2π r ÷ T."],
        ["Galaxy", "A huge group of billions of stars held together by gravity."],
      ],
    }),
  },
};
