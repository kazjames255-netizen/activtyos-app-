// KS3 Science — Physics: Space (Year 9). Original content aligned to the DfE KS3 programme of study (OGL v3.0).
// Calculation keys are recomputed by _check_s3.ts.
import type { CTopic } from "../types";
import { IMG } from "./_img";
import { sg, mu, nm, build } from "./_h";

export const TOPIC: CTopic = {
  key: "pspace",
  topic: "Physics — Space",
  subject: "Science",
  years: {
    9: {
      year: 9,
      objectives: [
        "Gravity forces between Earth and Moon, and between Earth and Sun (qualitative only); gravity is greater for more massive objects and weaker with distance.",
        "Our Sun as a star, other stars in our galaxy, other galaxies; the light year as a unit of astronomical distance.",
        "The seasons and the Earth's tilt, day length at different times of the year, in different hemispheres.",
        "The movement of the Earth, and other planets, relative to the Sun in the solar system; the movement of the Moon relative to the Earth.",
        "Weight and gravitational field strength on other planets.",
      ],
      note: {
        title: "Year 9: the Earth, the Sun and the seasons",
        body: `## The solar system and beyond

The **Sun** is a star at the centre of our **solar system**. The planets orbit it because of the Sun's **gravity**. The Sun is one of billions of stars in our galaxy, the **Milky Way**, and there are billions of galaxies. Gravity is an **attractive force between any two masses**: it is greater for larger masses and weaker as the distance increases. A **light year** is the **distance** light travels in one year (about 9.5 trillion km): it is a unit of distance, not time.

## Day, year and seasons

The Earth spins once every 24 hours (a day) and orbits the Sun once in about 365¼ days (a year). The Moon orbits the Earth in about a month.

The Earth's axis is **tilted by 23.5°** and always points in the **same direction** in space. When the **Northern Hemisphere is tilted towards the Sun** the sunlight is more concentrated and days are longer, so it is **summer** there and **winter** in the Southern Hemisphere. Half a year later it is the other way round. The seasons are caused by the tilt, **not** by the Earth being nearer or farther from the Sun.

## Worked examples

The Moon is about 380 000 km away. Light travels at 300 000 km/s, so light from the Moon takes 380 000 ÷ 300 000 ≈ **1.3 s** to reach us.
On Venus g = 8.9 N/kg. A 30 kg object has weight 30 × 8.9 = **267 N**.`,
      },
      quiz: {
        title: "Space: Year 9 quiz",
        questions: build("pspace", 9, [
          sg("Look at the diagram. In which position is it summer in the UK (Northern Hemisphere)?", "A", ["B", "C", "D"], "In position A the Northern Hemisphere is tilted towards the Sun, so the UK has its longest days and summer.", 2, { d: true, img: IMG.seasons }),
          sg("Look at the diagram. Why is it summer in the Northern Hemisphere in the position you chose?", "The Northern Hemisphere is tilted towards the Sun, so the Sun's light is more concentrated and the days are longer", ["The Earth is closest to the Sun in its orbit, so the whole planet receives more heat and every country is warmer at the same time", "The Sun gives out more energy at that time of year", "The Southern Hemisphere is blocking the Sun"], "The tilt of the axis, not the distance, causes seasons.", 3, { img: IMG.seasons }),
          mu("Look at the diagram. In which positions are day and night about equally long everywhere on Earth?", ["A", "B", "C", "D"], ["B", "D"], "At B and D the axis leans neither towards nor away from the Sun, so neither hemisphere is favoured.", 2, { d: true, img: IMG.seasons }),
          sg("What causes the seasons on Earth?", "The tilt of the Earth's axis as it orbits the Sun", ["The Earth's changing distance from the Sun", "The Moon's orbit around the Earth", "The spinning of the Earth once a day"], "The axis tilt changes how directly sunlight hits each hemisphere through the year.", 1),
          sg("About how long does the Earth take to orbit the Sun once?", "One year (about 365¼ days)", ["24 hours (one full day)", "One month (about 29½ days)", "One week (7 days)"], "One orbit of the Sun takes one year. One spin about its own axis takes a day.", 1),
          sg("What is a light year?", "The distance that light travels in one year", ["The time it takes light to cross the galaxy", "One year on a distant planet", "The time between two supernovae"], "It is a unit of distance because light travels at a fixed speed.", 2),
          nm("The Sun is 150 million km from the Earth. Light travels at 300 000 km/s. How long does sunlight take to reach the Earth, in seconds?", 500, "time = distance ÷ speed = 150 000 000 ÷ 300 000 = 500 s (about 8 minutes).", 3),
          nm("The gravitational field strength on Mars is 3.7 N/kg. What is the weight on Mars of a rover with a mass of 50 kg, in newtons?", 185, "Weight = mass × g = 50 × 3.7 = 185 N.", 2),
          sg("About how long does the Moon take to orbit the Earth once?", "About one month", ["About one day (24 hours)", "About one week", "About one year"], "The Moon takes about 27 days to orbit the Earth (its phases repeat about every 29½ days).", 1),
          sg("Which statement about gravity is correct?", "It is an attractive force between any two masses, bigger for larger masses and weaker as the distance increases", ["It only acts between the Earth and the objects on it, because only the Earth is massive enough to pull anything towards it", "It is stronger the farther apart two objects are", "It is a force that only acts between planets and the Sun"], "Gravity acts between all masses, so it also acts between you and the Earth, the Moon and the Earth, and the Sun and the planets.", 2),
        ]),
      },
      flashcards: [
        { front: "What keeps the planets in orbit?", back: "The Sun's gravitational pull." },
        { front: "What is gravity?", back: "An attractive force between any two masses; greater for larger masses, weaker with distance." },
        { front: "The Milky Way is…", back: "The galaxy that contains our solar system." },
        { front: "What is a light year?", back: "The distance light travels in one year." },
        { front: "How long is a day and a year?", back: "Earth spins once in about 24 hours; orbits the Sun in about 365¼ days." },
        { front: "Tilt of the Earth's axis", back: "23.5° from the vertical to its orbit, always pointing the same way in space." },
        { front: "What causes the seasons?", back: "The tilt of the Earth's axis, not the distance from the Sun." },
        { front: "It is summer in the UK. What season in Australia?", back: "Winter (the Southern Hemisphere is tilted away from the Sun)." },
        { front: "How long does the Moon take to orbit the Earth?", back: "About a month." },
        { front: "Weight on another planet", back: "weight = mass × local g; mass stays the same." },
      ],
    },
  },
};
