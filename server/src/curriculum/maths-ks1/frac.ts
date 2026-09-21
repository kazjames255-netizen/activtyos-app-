// KS1 Maths — Fractions, Decimals & Percentages (Years 1–2: halves, quarters and thirds). Original content aligned to
// the DfE National Curriculum (OGL v3.0). Answer keys are recomputed by _check_m1.ts — re-run it after ANY edit here.
// Pictures: scratch/curriculum-images/maths-ks1/.
import type { CTopic } from "../types";

const IMG = {
  quarter: { file: "frac-quarter.png", alt: "A circle cut into 4 equal slices by a cross of two lines. One slice, the top right one, is shaded orange. The other three are white." },
  halfABCD: { file: "frac-half-abcd.png", alt: "Four shapes labelled A, B, C and D. A: a rectangle cut into 2 equal parts, with the left part shaded. B: a rectangle cut into 2 parts of different sizes, with the small left part shaded. C: a circle cut into 3 equal parts, with one part shaded. D: a circle cut into 4 equal parts, with one part shaded." },
  third: { file: "frac-third.png", alt: "A rectangle cut into 3 equal parts side by side. The left part is shaded orange and the other two are white." },
  threeQuarters: { file: "frac-three-quarters.png", alt: "A rectangle cut into 4 equal parts side by side. The three left parts are shaded orange and the right part is white." },
  twoQuarters: { file: "frac-two-quarters.png", alt: "A circle cut into 4 equal slices by a cross of two lines. The two slices on the right side are shaded orange and the two slices on the left are white." },
};

export const TOPIC: CTopic = {
  key: "frac",
  topic: "Fractions, Decimals & Percentages",
  subject: "Maths",
  years: {
    1: {
      year: 1,
      objectives: [
        "Recognise, find and name a half as one of two equal parts of an object, shape or quantity.",
        "Recognise, find and name a quarter as one of four equal parts of an object, shape or quantity.",
      ],
      note: {
        title: "Year 1: halves and quarters",
        body: `## What to know

A **fraction** is a part of a whole. The parts must be **equal** (the same size).

- Cut something into **2 equal parts**: each part is **a half** (½).
- Cut something into **4 equal parts**: each part is **a quarter** (¼).
- 2 halves make 1 whole. 4 quarters make 1 whole.
- Half of a number of things means sharing them into 2 equal groups.

| Cut into | Each part is | Written |
| --- | --- | --- |
| 2 equal parts | a half | ½ |
| 4 equal parts | a quarter | ¼ |

## Say it like this

"Is it fair? Are the pieces the same size? If they are not the same size, they are not halves."

## Worked example 1: a shape

A square of paper folded into 4 equal parts, with 1 part coloured in. The coloured part is **a quarter**.

## Worked example 2: a group

Half of 16 🍪. Share 16 into 2 equal groups: 8 and 8. Half of 16 is **8**.

## Worked example 3: unequal parts

A ribbon cut into 2 pieces, but one piece is much longer. These are not halves because the pieces are not equal.

**Tip for grown-ups:** cut a piece of toast into halves, then quarters, and talk about it.`,
      },
      quiz: {
        title: "Fractions: Year 1 quiz (halves and quarters)",
        questions: [
          { key: "frac-y1-01", kind: "single", prompt: "What fraction of the circle is shaded?", options: ["a half", "a quarter", "a whole"], answer: "a quarter", image: IMG.quarter, explanation: "The circle is cut into 4 equal parts and 1 part is shaded. One of four equal parts is a quarter.", difficulty: 1 },
          { key: "frac-y1-02", kind: "number", prompt: "What is half of 14?", answer: 7, explanation: "Half means share into 2 equal groups. 7 + 7 = 14, so half of 14 is 7.", difficulty: 1 },
          { key: "frac-y1-03", kind: "single", prompt: "Which shape has half of it shaded?", options: ["A", "B", "C", "D"], answer: "A", image: IMG.halfABCD, explanation: "Half means 1 of 2 equal parts. Only A is cut into 2 equal parts. B has 2 parts but they are not equal.", difficulty: 2, diagnostic: true },
          { key: "frac-y1-04", kind: "single", prompt: "A pizza 🍕 is cut into 4 equal pieces. Each piece is…", options: ["a whole", "a half", "a quarter"], answer: "a quarter", explanation: "4 equal parts means each part is a quarter.", difficulty: 1 },
          { key: "frac-y1-05", kind: "number", prompt: "8 sweets are shared equally between 4 children. That is a quarter of 8. How many sweets is a quarter?", answer: 2, explanation: "Share 8 into 4 equal groups: 2 each. So a quarter of 8 is 2.", difficulty: 2, diagnostic: true },
          { key: "frac-y1-06", kind: "single", prompt: "You cut a cake into 2 equal parts. Each part is…", options: ["a half", "a quarter", "a whole"], answer: "a half", explanation: "Cutting into two equal parts makes halves, so each part is a half.", difficulty: 1 },
          { key: "frac-y1-07", kind: "single", prompt: "Ali eats half of a sandwich. Bea eats a quarter of the same sandwich. Who eats more?", options: ["Bea", "The same", "Ali"], answer: "Ali", explanation: "A half is bigger than a quarter. Two quarters make a half.", difficulty: 2 },
          { key: "frac-y1-08", kind: "number", prompt: "A whole is cut into quarters. How many equal parts are there?", answer: 4, explanation: "Quarters come from cutting a whole into 4 equal parts.", difficulty: 2 },
          { key: "frac-y1-09", kind: "number", prompt: "Half of my number is 6. What is my number?", answer: 12, explanation: "Two halves make a whole. 6 + 6 = 12.", difficulty: 3 },
          { key: "frac-y1-10", kind: "single", prompt: "Tom cuts a sandwich into 4 pieces of different sizes. Is each piece a quarter?", options: ["Yes, there are 4 pieces", "No, quarters must be equal", "No, it should be 2 pieces"], answer: "No, quarters must be equal", explanation: "A quarter is one of 4 EQUAL parts. If the pieces are different sizes, they are not quarters.", difficulty: 3 },
        ],
      },
      flashcards: [
        { front: "Cut into 2 equal parts. Each part is…", back: "A half (½)" },
        { front: "Cut into 4 equal parts. Each part is…", back: "A quarter (¼)" },
        { front: "Half of 10", back: "5" },
        { front: "Half of 4", back: "2" },
        { front: "A quarter of 12", back: "3" },
        { front: "Two halves make…", back: "One whole" },
        { front: "Four quarters make…", back: "One whole" },
        { front: "Halves and quarters must be…", back: "Equal parts (the same size)" },
        { front: "Which is bigger: a half or a quarter?", back: "A half" },
      ],
    },
    2: {
      year: 2,
      objectives: [
        "Recognise, find, name and write fractions 1/3, 1/4, 2/4 and 3/4 of a length, shape, set of objects or quantity.",
        "Write simple fractions, for example 1/2 of 6 = 3.",
        "Recognise the equivalence of 2/4 and 1/2.",
      ],
      note: {
        title: "Year 2: thirds, quarters and equivalent fractions",
        body: `## What to know

A fraction has two numbers. The **bottom** number says how many equal parts the whole is cut into. The **top** number says how many of those parts we have.

- ⅓ is 1 of 3 equal parts. ¼ is 1 of 4 equal parts. ¾ is 3 of 4 equal parts.
- **2/4 is the same as ½.** Two quarters make a half.
- To find a fraction of a number, share it into equal groups: ⅓ of 15 → share 15 into 3 groups → 5.
- The bigger the bottom number, the smaller the piece: ½ is bigger than ⅓, and ⅓ is bigger than ¼.

| Fraction | Share into | Of 24 |
| --- | --- | --- |
| ½ | 2 groups | 12 |
| ⅓ | 3 groups | 8 |
| ¼ | 4 groups | 6 |
| ¾ | 4 groups, take 3 | 18 |

## Say it like this

"Share into 4 equal groups. One group is a quarter. Three groups are three quarters."

## Worked example 1: a fraction of a number

¼ of 16. Share 16 into 4 equal groups: 4 in each. So ¼ of 16 is **4**.

## Worked example 2: three quarters

¾ of 16. ¼ of 16 is 4. Three quarters is 3 × 4 = **12**.

## Worked example 3: equivalence

A bar cut into 4 equal parts with 2 parts coloured. That is 2/4, and it is the same amount as **½**.

**Tip for grown-ups:** fold paper into halves, then quarters, and shade to check.`,
      },
      quiz: {
        title: "Fractions: Year 2 quiz",
        questions: [
          { key: "frac-y2-01", kind: "single", prompt: "What fraction of this rectangle is shaded?", options: ["½", "¼", "¾", "⅓"], answer: "⅓", image: IMG.third, explanation: "The rectangle has 3 equal parts and 1 is shaded. That is ⅓.", difficulty: 1 },
          { key: "frac-y2-02", kind: "single", prompt: "Look at the rectangle. How much of it is shaded?", options: ["¾", "¼", "½", "⅓"], answer: "¾", image: IMG.threeQuarters, explanation: "The rectangle has 4 equal parts and 3 are shaded. That is ¾.", difficulty: 1 },
          { key: "frac-y2-03", kind: "number", prompt: "What is ½ of 18?", answer: 9, explanation: "Half means share into 2 equal groups. 9 + 9 = 18.", difficulty: 1 },
          { key: "frac-y2-04", kind: "number", prompt: "What is ¼ of 20?", answer: 5, explanation: "Share 20 into 4 equal groups. Each group has 5.", difficulty: 2, diagnostic: true },
          { key: "frac-y2-05", kind: "single", prompt: "2 of the 4 parts are shaded. Which fraction is the same as 2/4?", options: ["¼", "¾", "½", "⅓"], answer: "½", image: IMG.twoQuarters, explanation: "Two quarters fill half of the circle, so 2/4 is the same as ½.", difficulty: 2, diagnostic: true },
          { key: "frac-y2-06", kind: "number", prompt: "What is ⅓ of 12?", answer: 4, explanation: "Share 12 into 3 equal groups. Each group has 4.", difficulty: 2 },
          { key: "frac-y2-07", kind: "single", prompt: "What is ¾ of 8?", options: ["2", "4", "6", "8"], answer: "6", explanation: "¼ of 8 is 2. Then ¾ is 3 groups of 2, which is 6.", difficulty: 3 },
          { key: "frac-y2-08", kind: "single", prompt: "Which is the biggest fraction?", options: ["½", "¼", "⅓", "They are the same"], answer: "½", explanation: "The more parts a whole is cut into, the smaller each part is. Halves are the biggest of these.", difficulty: 2 },
          { key: "frac-y2-09", kind: "single", prompt: "A pizza is cut into 4 equal slices. Ella eats 3. What fraction did she eat?", options: ["⅓", "¾", "¼", "½"], answer: "¾", explanation: "She ate 3 of the 4 equal slices. That is ¾.", difficulty: 2 },
          { key: "frac-y2-10", kind: "number", prompt: "Sam has 12 cards. He gives ¼ of them away. How many cards does he have left?", answer: 9, explanation: "¼ of 12 is 3, so he gives away 3. Then 12 − 3 = 9 left.", difficulty: 3 },
        ],
      },
      flashcards: [
        { front: "½ of 10", back: "5" },
        { front: "¼ of 8", back: "2" },
        { front: "⅓ of 9", back: "3" },
        { front: "¾ of 12", back: "9" },
        { front: "2/4 is the same as…", back: "½" },
        { front: "Which is bigger: ½ or ¼?", back: "½" },
        { front: "1 of 3 equal parts", back: "⅓ (one third)" },
        { front: "The bottom number of a fraction shows…", back: "How many equal parts the whole is cut into" },
        { front: "The top number of a fraction shows…", back: "How many parts we have" },
        { front: "4 quarters make…", back: "1 whole" },
      ],
    },
  },
};
