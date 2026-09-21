// KS3 Science — Physics: Waves (Year 8 light & sound). Original content aligned to the DfE KS3 programme of study (OGL v3.0).
// Calculation keys are recomputed by _check_s3.ts.
import type { CTopic } from "../types";
import { IMG } from "./_img";
import { sg, nm, build } from "./_h";

export const TOPIC: CTopic = {
  key: "pwave",
  topic: "Physics — Waves",
  subject: "Science",
  years: {
    8: {
      year: 8,
      objectives: [
        "Frequencies of sound waves, measured in hertz (Hz); echoes, reflection and absorption of sound; sound needs a medium and cannot travel through a vacuum.",
        "Sound waves produced by vibrations and the relationship between amplitude and loudness and frequency and pitch.",
        "The similarities and differences between light waves and waves in matter; light waves travelling through a vacuum; speed of light.",
        "The transmission, absorption and reflection of light; the law of reflection; refraction and the splitting of white light into a spectrum by a prism.",
        "The wave model to explain the wave behaviour of sound and light, and how we see and hear.",
      ],
      note: {
        title: "Year 8: light and sound",
        body: `## Sound

Sound is made by **vibrations**. It travels as a wave through a **medium** (solid, liquid or gas) by passing on vibrations between particles. It **cannot travel through a vacuum**. The speed of sound in air is about **340 m/s**. Light is much faster: about 300 000 km/s.

- **Amplitude** (height of the wave) decides **loudness**: bigger amplitude, louder sound.
- **Frequency** (number of waves per second, in **hertz**) decides **pitch**: higher frequency, higher pitch.

## Light

Light travels in straight lines. We see objects because light **reflects** off them into our eyes. At a plane mirror, the **angle of incidence = the angle of reflection**, both measured from the **normal** (the line at 90° to the mirror).

**Refraction** is the bending of light when it passes from one material to another because its speed changes. Entering glass from air the light bends **towards the normal**. A prism splits white light into a **spectrum** because different colours bend by different amounts (violet bends the most, red the least).

## Worked examples

A ray hits a mirror at 50° to the normal. It reflects at **50°** to the normal.
Lightning is seen and thunder heard 6 s later. Distance = 340 × 6 = **2040 m**.`,
      },
      quiz: {
        title: "Light & Sound: Year 8 quiz",
        questions: build("pwave", 8, [
          sg("Look at the diagram. A light ray hits a plane mirror with an angle of incidence of 35°. What is the angle of reflection?", "35°", ["55°", "70°", "145°"], "The law of reflection: the angle of reflection equals the angle of incidence, both measured from the normal.", 1, { d: true, img: IMG.mirror }),
          nm("Look at the diagram. What is the angle, in degrees, between the incident ray and the surface of the mirror?", 55, "The normal is at 90° to the mirror. The ray is 35° from the normal, so it is 90 − 35 = 55° from the mirror.", 2, { img: IMG.mirror }),
          sg("Look at the two wave traces, which use the same scale. Which trace shows the sound with the higher pitch?", "B", ["A", "The pitches are the same"], "Trace B has more waves in the same time, so a higher frequency and a higher pitch.", 2, { d: true, img: IMG.traces }),
          sg("Look at the two wave traces. Which trace shows the louder sound?", "A", ["B", "They are equally loud"], "Trace A has the greater amplitude (taller waves), so it is louder.", 2, { img: IMG.traces }),
          sg("Sound cannot travel through…", "A vacuum", ["Water", "Steel", "Air"], "Sound passes on vibrations from particle to particle, so it needs a medium. A vacuum has no particles.", 1),
          nm("Thunder is heard 3 seconds after a flash of lightning is seen. The speed of sound in air is 340 m/s. Ignoring the time taken by light, how far away is the lightning, in metres?", 1020, "Distance = speed × time = 340 × 3 = 1020 m.", 2),
          sg("A ray of light travels from air into a glass block at an angle. What happens to it?", "It bends towards the normal", ["It bends away from the normal", "It carries on in a straight line without bending", "It reflects along the normal"], "Light slows down in glass, and a ray entering a more dense material bends towards the normal.", 2),
          sg("A prism splits white light into a spectrum. Which colour is refracted the most?", "Violet", ["Red", "Green", "Yellow"], "Violet light slows down the most in glass, so it bends the most. Red bends the least.", 3),
          sg("What is the unit of frequency?", "Hertz (Hz)", ["Decibel (dB)", "Metre per second (m/s)", "Newton (N)"], "One hertz is one wave per second.", 1),
          sg("Why can you see a book that gives out no light of its own?", "Light reflects off the book and enters your eye", ["Your eyes send out light that hits the book", "The book absorbs all the light that hits it", "The book makes its own light when it is bright"], "We see non-luminous objects because light from a source is scattered by them into our eyes.", 2),
        ]),
      },
      flashcards: [
        { front: "How is sound made?", back: "By vibrations." },
        { front: "Can sound travel through a vacuum?", back: "No: it needs a medium." },
        { front: "Speed of sound in air (approx.)", back: "340 m/s." },
        { front: "Amplitude decides…", back: "Loudness." },
        { front: "Frequency decides…", back: "Pitch. Measured in hertz (Hz)." },
        { front: "Law of reflection", back: "Angle of incidence = angle of reflection (measured from the normal)." },
        { front: "What is the normal?", back: "An imaginary line at 90° to the surface at the point where the ray hits." },
        { front: "Refraction", back: "The bending of light as its speed changes between materials." },
        { front: "Air into glass: which way does light bend?", back: "Towards the normal." },
        { front: "Colour most refracted by a prism", back: "Violet (red the least)." },
      ],
    },
  },
};
