// KS2 Science — Earth & Space (Year 5). Original content aligned to the DfE National Curriculum (OGL v3.0).
// Which Moon pictures are half lit is recomputed by _check_s2.ts from _s2data.ts (the data that draws the images).
import type { CTopic } from "../types";

const DAY_ALT = "A diagram of the Sun on the left and the Earth on the right, seen from above. Sunlight arrows point from the Sun to the Earth. The half of the Earth facing the Sun is light and the far half is dark. Point P is on the lit side facing the Sun and point Q is on the dark side facing away. A curved arrow shows the Earth spinning.";
const MOON_ALT = "Eight pictures of the Moon, labelled A to H, each showing a different amount of the Moon lit up. B is completely dark. C is completely bright. D and F are half lit, D on the right side and F on the left side. G and E are thin crescents, G lit on the right and E on the left. A and H are more than half lit, A with the dark part on the left and H with the dark part on the right.";

export const TOPIC: CTopic = {
  key: "earth",
  topic: "Earth & Space",
  subject: "Science",
  years: {
    5: {
      year: 5,
      objectives: [
        "Describe the movement of the Earth, and other planets, relative to the Sun in the solar system.",
        "Describe the movement of the Moon relative to the Earth.",
        "Describe the Sun, Earth and Moon as approximately spherical bodies.",
        "Use the idea of the Earth’s rotation to explain day and night and the apparent movement of the sun across the sky.",
      ],
      note: {
        title: "Year 5: the solar system, day and night, and the Moon",
        body: `## The solar system
The **Sun** is a star at the centre of our solar system. Eight planets **orbit** (travel around) it, in this order from the Sun: **Mercury, Venus, Earth, Mars, Jupiter, Saturn, Uranus, Neptune**. The Sun, Earth and Moon are all roughly **spheres** (balls), not flat.

## Movements of the Earth
- The Earth **spins** (rotates) on its axis once every **24 hours**. This gives us **day and night**. The half facing the Sun has day and the half facing away has night.
- The Sun **seems** to move across the sky from east to west, but it is really the Earth's rotation that moves us.
- The Earth **orbits** the Sun once in about **365 days** (a year).

## The Moon
The Moon is a natural satellite that orbits the Earth about once a month. It does not make its own light; we see it because it **reflects sunlight**. Half of the Moon is always lit by the Sun. As the Moon orbits, we see different amounts of the lit half. These are the **phases**. The Moon does not change shape and it is not the Earth's shadow.

| Phase | What we see |
| --- | --- |
| New Moon | The lit half faces away, so we see almost nothing |
| Crescent | A thin curve of light |
| Half (quarter) Moon | Half of the visible face lit |
| Gibbous | More than half lit |
| Full Moon | The whole face lit |

**Worked example 1:** A pole in a playground casts its shortest shadow at midday, when the Sun is highest. In the morning and evening the shadow is long.

**Worked example 2:** When it is midday in London, it is night in a country on the opposite side of the world. The Earth spins, so every place has day and then night.

**Worked example 3:** Jupiter is the fifth planet from the Sun. It takes much longer than Earth to orbit because it is much further away.`,
      },
      quiz: {
        title: "Earth & Space: Year 5 quiz",
        questions: [
          { key: "earth-y5-01", kind: "single", prompt: "Which object is at the centre of our solar system?", options: ["The Sun", "The Earth", "The Moon", "Jupiter"], answer: "The Sun", explanation: "The Sun is a star. The Earth and the other planets orbit it.", difficulty: 1 },
          { key: "earth-y5-02", kind: "single", prompt: "What shape are the Earth, the Sun and the Moon (roughly)?", options: ["Flat discs", "Cubes", "Spheres", "Cones"], answer: "Spheres", explanation: "All three are roughly ball-shaped: spheres.", difficulty: 1 },
          { key: "earth-y5-03", kind: "single", prompt: "How long does the Earth take to spin once on its axis?", options: ["About 24 hours", "About a week", "About a month", "About a year"], answer: "About 24 hours", explanation: "One spin takes about 24 hours. This is one day and night.", difficulty: 2 },
          { key: "earth-y5-04", kind: "single", prompt: "How long does the Earth take to orbit the Sun once?", options: ["About 24 hours (a day)", "About 365 days (a year)", "About 28 days (a month)", "About 7 days (a week)"], answer: "About 365 days (a year)", explanation: "One orbit of the Sun takes about 365 days, which is one year.", difficulty: 2 },
          { key: "earth-y5-05", kind: "single", prompt: "About how long does the Moon take to orbit the Earth?", options: ["About a day", "About a week", "About a year", "About a month"], answer: "About a month", explanation: "The Moon orbits the Earth in about a month. This is where the word “month” comes from.", difficulty: 2 },
          { key: "earth-y5-06", kind: "single", prompt: "Look at the diagram. It is midday at P. What time is it most likely at Q on the opposite side of the Earth?", options: ["Midnight", "Midday", "Sunrise", "Evening"], answer: "Midnight", explanation: "Q is on the side facing away from the Sun, in the dark. It is about 12 hours different from P, so it is around midnight.", difficulty: 2, diagnostic: true, image: { file: "earth-daynight.png", alt: DAY_ALT } },
          { key: "earth-y5-07", kind: "single", prompt: "Why does the Sun seem to move across the sky during the day?", options: ["The Sun orbits the Earth every 24 hours", "Clouds push the Sun along", "The Earth is spinning", "The Sun goes out and back on"], answer: "The Earth is spinning", explanation: "The Earth rotates, so different places face the Sun. The Sun only seems to move.", difficulty: 2, diagnostic: true },
          { key: "earth-y5-08", kind: "multi", prompt: "Look at the eight pictures of the Moon. Which TWO show the Moon exactly half lit?", options: ["B", "D", "F", "G"], answer: ["D", "F"], explanation: "D and F have exactly half of the face lit. B is dark and G is only a thin crescent.", difficulty: 3, image: { file: "earth-moons.png", alt: MOON_ALT } },
          { key: "earth-y5-09", kind: "single", prompt: "Which planet is closest to the Sun?", options: ["Earth", "Mars", "Venus", "Mercury"], answer: "Mercury", explanation: "The order from the Sun is Mercury, Venus, Earth, Mars, Jupiter, Saturn, Uranus, Neptune.", difficulty: 1 },
          { key: "earth-y5-10", kind: "single", prompt: "Why does the Moon seem to change shape during a month?", options: ["The Earth’s shadow covers different amounts of it each night","It really does change its shape", "We see different amounts of its sunlit half as it orbits", "Clouds cover parts of it"], answer: "We see different amounts of its sunlit half as it orbits", explanation: "The Moon is always half lit by the Sun. As it orbits the Earth we see more or less of that lit half.", difficulty: 3, image: { file: "earth-moons.png", alt: MOON_ALT } },
        ],
      },
      flashcards: [
        { front: "What is at the centre of the solar system?", back: "The Sun, a star." },
        { front: "The eight planets in order", back: "Mercury, Venus, Earth, Mars, Jupiter, Saturn, Uranus, Neptune." },
        { front: "Shape of the Earth, Sun and Moon", back: "Approximately spherical." },
        { front: "Earth’s rotation", back: "One spin every 24 hours gives day and night." },
        { front: "Earth’s orbit", back: "Once round the Sun in about 365 days (a year)." },
        { front: "Moon’s orbit", back: "Once round the Earth in about a month." },
        { front: "Why can we see the Moon?", back: "It reflects sunlight; it makes no light of its own." },
        { front: "Moon phases", back: "We see different amounts of the Moon’s sunlit half as it orbits." },
        { front: "Why does the Sun seem to move across the sky?", back: "Because the Earth rotates." },
        { front: "Is the Moon’s changing shape caused by Earth’s shadow?", back: "No. It is caused by our changing view of its lit half." },
      ],
    },
  },
};
