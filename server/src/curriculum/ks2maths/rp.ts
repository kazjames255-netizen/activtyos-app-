// KS2 Maths — Ratio & Proportion (Year 6 only; Years 3–5 are not introduced as a strand).
// Original content aligned to the DfE programme of study (Open Government Licence v3.0).
// Every computed answer is re-derived independently by _check_k3.ts — run it after ANY edit.
import type { CTopic } from "../types";

export const TOPIC: CTopic = {
  key: "rp",
  topic: "Ratio & Proportion",
  subject: "Maths",
  notIntroduced: {
    3: "Not introduced — covered informally within Number and Fractions.",
    4: "Not introduced — covered informally within Number and Fractions.",
    5: "Not introduced as a standalone strand — foundational proportional reasoning built through Fractions and Measurement.",
  },
  years: {
    6: {
      year: 6,
      objectives: [
        "Solve problems involving the relative sizes of two quantities, using missing values and integer multiplication and division facts",
        "Solve problems involving the calculation of percentages (for example 15% of 360) and the use of percentages for comparison",
        "Solve problems involving similar shapes where the scale factor is known or can be found",
        "Solve problems involving unequal sharing and grouping using knowledge of fractions and multiples",
      ],
      note: {
        title: "Ratio, percentages and scale factors",
        body: `## What is a ratio?

A **ratio** compares the sizes of two or more quantities. The ratio **2 : 7** means "for every 2 of one thing there are 7 of the other". You can simplify a ratio by dividing **both** parts by the same number, just like simplifying a fraction: 6 : 10 becomes **3 : 5**.

## Three skills to master

- **Sharing in a ratio:** add the parts to find the total number of parts, divide the amount by that total to find **one part**, then multiply.
- **Percentages:** 'per cent' means 'out of 100'. Find **10%** by dividing by 10 and **1%** by dividing by 100, then build up other percentages from them.
- **Scale factor:** when a shape is enlarged, **every** length is multiplied by the same number. The angles stay the same.

## Worked examples

**1. Sharing.** Tom and Ana share £54 in the ratio 2 : 7.
2 + 7 = 9 parts. One part is £54 ÷ 9 = £6. Tom gets 2 × £6 = **£12** and Ana gets 7 × £6 = **£42**.

**2. Percentage.** Find 35% of 240.
10% of 240 = 24, so 30% = 72. 5% is half of 10%, which is 12. So 35% = 72 + 12 = **84**.

**3. Scale factor.** A rectangle is 4 cm wide and 6 cm long. It is enlarged so the 4 cm side becomes 12 cm.
The scale factor is 12 ÷ 4 = 3. The 6 cm side becomes 6 × 3 = **18 cm**.

## Watch out

- Do not add the same amount to both sides of a shape — you must **multiply**.
- For grouping problems, check whether a remainder means you need one more group.`,
      },
      quiz: {
        title: "Year 6 Ratio & Proportion quiz",
        questions: [
          {
            key: "rp-y6-01",
            kind: "single",
            prompt: "A bag holds red and blue counters, as shown. What is the ratio of red counters to blue counters in its simplest form?",
            options: ["4 : 6", "3 : 2", "2 : 3", "4 : 10"],
            answer: "2 : 3",
            explanation: "Count 4 red and 6 blue, so the ratio is 4 : 6. Divide both parts by 2 to simplify it: 2 : 3.",
            difficulty: 1,
            image: { file: "rp-counters.png", alt: "A bag drawn as a box containing 10 round counters: 4 red counters and 6 blue counters, mixed up." },
          },
          {
            key: "rp-y6-02",
            kind: "number",
            prompt: "What is 10% of 350 grams? Give your answer in grams.",
            answer: 35,
            explanation: "10% means one tenth, so divide by 10: 350 ÷ 10 = 35.",
            difficulty: 1,
          },
          {
            key: "rp-y6-03",
            kind: "single",
            prompt: "What is 15% of 360?",
            options: ["36", "54", "540", "5.4"],
            answer: "54",
            explanation: "Find 10% (360 ÷ 10 = 36) and 5% (half of 36 = 18), then add them: 36 + 18 = 54.",
            difficulty: 2,
            diagnostic: true,
          },
          {
            key: "rp-y6-04",
            kind: "single",
            prompt: "Ella and Sam share £40 in the ratio 3 : 5. How much does Sam get?",
            options: ["£15", "£20", "£5", "£25"],
            answer: "£25",
            explanation: "3 + 5 = 8 parts, so one part is £40 ÷ 8 = £5. Sam has 5 parts: 5 × £5 = £25.",
            difficulty: 2,
            diagnostic: true,
          },
          {
            key: "rp-y6-05",
            kind: "number",
            prompt: "A recipe for 4 people uses 300 g of flour. How much flour is needed for 10 people? Give your answer in grams.",
            answer: 750,
            explanation: "Find the flour for one person: 300 ÷ 4 = 75 g. Then multiply by 10 people: 75 × 10 = 750 g.",
            difficulty: 2,
          },
          {
            key: "rp-y6-06",
            kind: "single",
            prompt: "Triangle B is an enlargement of Triangle A, so the two triangles have exactly the same shape. What is the length x?",
            options: ["12 cm", "10 cm", "7 cm", "16 cm"],
            answer: "12 cm",
            explanation: "The 3 cm side became 9 cm, so the scale factor is 9 ÷ 3 = 3. Multiply the 4 cm side by 3: 4 × 3 = 12 cm.",
            difficulty: 2,
            image: {
              file: "rp-similar-triangles.png",
              alt: "Two right-angled triangles of the same shape, one small and one large. The small Triangle A has a vertical side of 3 cm, a base of 4 cm and a sloping side of 5 cm. The large Triangle B has a vertical side of 9 cm, a sloping side of 15 cm and a base labelled x.",
            },
          },
          {
            key: "rp-y6-07",
            kind: "single",
            prompt: "A coach holds 48 children. 150 children are going on a trip. What is the smallest number of coaches needed?",
            options: ["3", "4", "5", "3 remainder 6"],
            answer: "4",
            explanation: "150 ÷ 48 = 3 remainder 6. Three coaches carry only 144 children, so the 6 left over need another coach: 4 coaches.",
            difficulty: 2,
          },
          {
            key: "rp-y6-08",
            kind: "single",
            prompt: "Three friends share 60 stickers in the ratio 1 : 2 : 3. How many stickers does the friend with the biggest share get?",
            options: ["30", "20", "10", "36"],
            answer: "30",
            explanation: "1 + 2 + 3 = 6 parts, so one part is 60 ÷ 6 = 10 stickers. The biggest share is 3 parts: 3 × 10 = 30.",
            difficulty: 3,
          },
          {
            key: "rp-y6-09",
            kind: "number",
            prompt: "A jacket costs £80. In a sale its price is reduced by 15%. What is the sale price in pounds?",
            answer: 68,
            explanation: "15% of £80: 10% is £8 and 5% is £4, so the reduction is £12. Take it off the price: £80 − £12 = £68.",
            difficulty: 3,
          },
          {
            key: "rp-y6-10",
            kind: "multi",
            prompt: "Which of these ratios are equivalent to 2 : 3? Select all that apply.",
            options: ["4 : 6", "6 : 9", "3 : 2", "20 : 30", "5 : 6"],
            answer: ["4 : 6", "6 : 9", "20 : 30"],
            explanation: "Multiply both parts of 2 : 3 by the same number: ×2 gives 4 : 6, ×3 gives 6 : 9 and ×10 gives 20 : 30. 3 : 2 is the wrong way round and 5 : 6 is not a multiple of 2 : 3.",
            difficulty: 1,
          },
        ],
      },
      flashcards: [
        { front: "What does the ratio 2 : 7 mean?", back: "For every 2 of the first thing there are 7 of the second thing." },
        { front: "How do you simplify a ratio?", back: "Divide both parts by the same number (a common factor), like simplifying a fraction. 6 : 10 = 3 : 5." },
        { front: "Sharing in a ratio: the 3 steps", back: "1) Add the parts to get the total parts. 2) Divide the amount by the total parts to find one part. 3) Multiply one part by each share." },
        { front: "How do you find 10% of an amount?", back: "Divide it by 10." },
        { front: "How do you find 1% of an amount?", back: "Divide it by 100." },
        { front: "Find 35% of 240.", back: "10% = 24, so 30% = 72. 5% = 12. So 35% = 72 + 12 = 84." },
        { front: "Write 50%, 25% and 75% as fractions.", back: "50% = ½, 25% = ¼, 75% = ¾." },
        { front: "What is a scale factor?", back: "The number every length is multiplied by when a shape is enlarged (or divided by when it is shrunk)." },
        { front: "What changes and what stays the same in similar shapes?", back: "All lengths are multiplied by the same scale factor. The angles stay exactly the same." },
        { front: "A recipe for 4 uses 200 g. How do you scale it for 6 people?", back: "Find one person first (200 ÷ 4 = 50 g), then multiply by 6: 300 g." },
        { front: "The ratio of red to blue is 1 : 3. What fraction is red?", back: "There are 1 + 3 = 4 parts in total, so red is 1 out of 4 = ¼." },
      ],
    },
  },
};
