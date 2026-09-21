// Small builders for the KS1 Science pack (underscore = skipped by validate.ts, imported by the topic files).
// `single`/`multi` take the index(es) of the right option(s), so the answer text can never drift from the options.
import type { CQuestion } from "../types";

type Opt = { diagnostic?: boolean; image?: { file: string; alt: string }; marks?: number };
type D = 1 | 2 | 3;

export const single = (key: string, prompt: string, options: string[], correct: number, explanation: string, difficulty: D, o: Opt = {}): CQuestion =>
  ({ key, kind: "single", prompt, options, answer: options[correct], explanation, difficulty, ...o });

export const multi = (key: string, prompt: string, options: string[], correct: number[], explanation: string, difficulty: D, o: Opt = {}): CQuestion =>
  ({ key, kind: "multi", prompt, options, answer: correct.map((i) => options[i]), explanation, difficulty, ...o });

export const short = (key: string, prompt: string, answer: string, accepted: string[], explanation: string, difficulty: D, o: Opt = {}): CQuestion =>
  ({ key, kind: "short", prompt, answer, accepted, explanation, difficulty, ...o });

export const number = (key: string, prompt: string, answer: number, explanation: string, difficulty: D, o: Opt = {}): CQuestion =>
  ({ key, kind: "number", prompt, answer, explanation, difficulty, ...o });

// The drawn pictures (scratch/curriculum-images/science-ks1/*.png, made by gen-s1.mjs). Alt text is mandatory.
export const IMG = {
  plantparts: { file: "plantparts.png", alt: "A drawing of a flowering plant growing in soil. A pink flower with a yellow middle is at the top, joined to a long green stem. Two green leaves grow out of the stem. Thin pale roots spread out under the soil. Four parts are labelled with letters: A points to the stem, B to the flower, C to the roots and D to a leaf." },
  twopots: { file: "twopots.png", alt: "Two flowerpots side by side on a windowsill. Pot A has a tall green plant with lots of leaves and a pink flower. Pot B has a plant with a bent, drooping stem and yellowish-brown, floppy leaves. A caption says both pots have the same seeds, soil, windowsill and warm room." },
  foodchain: { file: "foodchain.png", alt: "A food chain drawn as three cards joined by arrows that point from left to right: Grass, then a Rabbit, then a Fox." },
  facesenses: { file: "facesenses.png", alt: "A drawing of a child's face and a hand. The face has two ears, two eyes, a nose, a red mouth and brown hair. Five parts are labelled with letters: A points to an ear, B to the nose, C to an eye, D to the mouth and E to the hand." },
  pictogram: { file: "pictogram.png", alt: "A pictogram called Things we found in our classroom, where each square stands for 1 thing. The Wood row has 5 squares, Plastic has 7, Metal has 4 and Glass has 3." },
  trees: { file: "trees.png", alt: "Four pictures of the same kind of tree at different times of year, labelled A to D. A: a tree covered in thick dark green leaves. B: a tree with bare branches and no leaves. C: a tree with orange, red and yellow leaves, some of them lying on the ground. D: a tree with bare branches and a few small light green leaves and pink blossom." },
  daylight: { file: "daylight.png", alt: "A bar chart called How long is daytime in the UK, about. Hours of daylight go up the side from 0 to 18. December has 8 hours, March 12 hours, June 16 hours and September 12 hours." },
} as const;
