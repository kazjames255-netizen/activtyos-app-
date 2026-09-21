// KS2 Science — Sound (Year 4). Original content aligned to the DfE National Curriculum (OGL v3.0).
// Graph/number keys are recomputed by _check_s2.ts from _s2data.ts (the data that draws the images).
import type { CTopic } from "../types";

const SOUND_ALT = "Bar chart of the distance at which a ticking clock could no longer be heard. Clock wrapped in nothing: 18 metres. Newspaper: 12. Bubble wrap: 9. Woolly hat: 5. Foam: 3.";

export const TOPIC: CTopic = {
  key: "sound",
  topic: "Sound",
  subject: "Science",
  years: {
    4: {
      year: 4,
      objectives: [
        "Identify how sounds are made, associating some of them with something vibrating.",
        "Recognise that vibrations from sounds travel through a medium to the ear.",
        "Find patterns between the pitch of a sound and features of the object that produced it.",
        "Find patterns between the volume of a sound and the strength of the vibrations that produced it.",
        "Recognise that sounds get fainter as the distance from the sound source increases.",
      ],
      note: {
        title: "Year 4: vibrations, pitch and volume",
        body: `## How sounds are made
Every sound is made by something **vibrating** (moving quickly back and forth). Press a ruler on the edge of a desk and twang it, and you can see and hear it vibrate. Place your fingers on your throat while you hum and you can feel the vibrations.

## How sound travels
Vibrations travel as **sound waves** through a **medium**: air, water or solids. They spread out from the source until they reach your ear. Sound **cannot** travel through empty space (a vacuum) because there is nothing to vibrate. Sound travels best through solids, then liquids, then gases.

## Pitch and volume
- **Pitch** is how **high or low** a sound is. Short, thin, tight things vibrate faster and make **higher** pitches. Long, thick, loose things vibrate more slowly and make **lower** pitches.
- **Volume** is how **loud or quiet** a sound is. A bigger vibration makes a louder sound. Hit a drum harder and it is louder, but the pitch is the same.

## Distance and sound insulation
The further you are from a source, the **fainter** the sound. Soft, thick materials such as foam and fabric **absorb** sound, so they are good **sound insulators**. Ear defenders use this idea.

**Worked example 1:** A ruler is held 10 cm over the desk edge and twanged. When it is moved so only 5 cm hangs over, the note is higher.

**Worked example 2: a fair test.** To find the best material for muffling a music box, wrap it in different materials and keep the same music box, the same person listening and the same start point.

**Worked example 3:** A drum is played gently and then hard. The pitch stays the same, but the louder hit makes bigger vibrations.`,
      },
      quiz: {
        title: "Sound: Year 4 quiz",
        questions: [
          { key: "sound-y4-01", kind: "single", prompt: "How are all sounds made?", options: ["By light", "By vibrations", "By magnets", "By colours"], answer: "By vibrations", explanation: "Something must vibrate to make a sound. The vibrations travel to our ears.", difficulty: 1 },
          { key: "sound-y4-02", kind: "single", prompt: "Which of these can sound NOT travel through?", options: ["The air in a room", "Water in a swimming pool", "A long steel rail", "A vacuum (empty space)"], answer: "A vacuum (empty space)", explanation: "Sound needs a material to travel through. In empty space there is nothing to vibrate.", difficulty: 2 },
          { key: "sound-y4-03", kind: "single", prompt: "A guitar has a short, tight string and a long, loose string. Compared with the long, loose string, the short, tight string makes a…", options: ["Lower pitch", "Higher pitch", "Quieter sound only", "Louder sound only"], answer: "Higher pitch", explanation: "Short, tight strings vibrate faster, and faster vibrations make a higher pitch.", difficulty: 2, diagnostic: true },
          { key: "sound-y4-04", kind: "single", prompt: "What does “pitch” describe?", options: ["How loud a sound is", "How far a sound travels", "How high or low a sound is", "How fast a sound goes"], answer: "How high or low a sound is", explanation: "Pitch is about high and low notes. Volume is about loud and quiet.", difficulty: 1 },
          { key: "sound-y4-05", kind: "single", prompt: "A drummer hits the drum harder. What changes?", options: ["The pitch gets higher because the vibrations are faster", "The sound gets louder because the vibrations are bigger", "The sound gets quieter because the vibrations are smaller", "The drum stops vibrating because it was hit too hard"], answer: "The sound gets louder because the vibrations are bigger", explanation: "A harder hit makes bigger vibrations, and bigger vibrations make a louder sound.", difficulty: 2 },
          { key: "sound-y4-06", kind: "single", prompt: "A ticking clock was wrapped in different materials. Look at the chart. Which material was the best sound insulator?", options: ["Newspaper", "Bubble wrap", "Foam", "Nothing"], answer: "Foam", explanation: "The better the insulator, the shorter the distance at which the ticking could be heard. Foam has the shortest bar (3 m).", difficulty: 1, image: { file: "sound-insulation.png", alt: SOUND_ALT } },
          { key: "sound-y4-07", kind: "number", prompt: "Look at the chart. By how many metres did wrapping the clock in foam reduce the distance it could be heard, compared with no wrapping?", answer: 15, explanation: "With no wrapping: 18 m. With foam: 3 m. Subtract: 18 − 3 = 15.", difficulty: 2, image: { file: "sound-insulation.png", alt: SOUND_ALT } },
          { key: "sound-y4-08", kind: "single", prompt: "Look at the chart. Which material was a better insulator than newspaper but a worse one than the woolly hat?", options: ["Foam", "Bubble wrap", "Nothing", "Newspaper again"], answer: "Bubble wrap", explanation: "Bubble wrap had 9 m, which is less than newspaper (12 m) but more than the woolly hat (5 m).", difficulty: 3, image: { file: "sound-insulation.png", alt: SOUND_ALT } },
          { key: "sound-y4-09", kind: "single", prompt: "You walk away from a ringing school bell. What happens to the sound you hear?", options: ["It gets fainter", "It gets louder", "The pitch rises", "It stays exactly the same"], answer: "It gets fainter", explanation: "Sound gets fainter as the distance from the source increases.", difficulty: 2, diagnostic: true },
          { key: "sound-y4-10", kind: "multi", prompt: "Which TWO changes would give a rubber-band guitar a higher pitch?", options: ["Stretch the band tighter", "Use a shorter length of band", "Use a longer length of band", "Pluck the band harder"], answer: ["Stretch the band tighter", "Use a shorter length of band"], explanation: "Tighter and shorter bands vibrate faster, so the pitch is higher. Plucking harder only makes the sound louder.", difficulty: 3 },
        ],
      },
      flashcards: [
        { front: "How are sounds made?", back: "By vibrations." },
        { front: "Medium", back: "The material (air, water, solid) that sound waves travel through." },
        { front: "Can sound travel in a vacuum?", back: "No, because there is nothing to vibrate." },
        { front: "Pitch", back: "How high or low a sound is." },
        { front: "What makes a higher pitch?", back: "Faster vibrations: short, thin or tight things." },
        { front: "Volume", back: "How loud or quiet a sound is." },
        { front: "What makes a louder sound?", back: "Bigger vibrations." },
        { front: "What happens to sound as you move away?", back: "It gets fainter." },
        { front: "Sound insulator", back: "A material that absorbs sound, such as foam or thick fabric." },
      ],
    },
  },
};
