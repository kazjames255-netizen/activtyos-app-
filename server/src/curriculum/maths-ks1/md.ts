// KS1 Maths — Multiplication & Division (Years 1–2). Original content aligned to the DfE National Curriculum (OGL v3.0).
// Answer keys are recomputed by _check_m1.ts — re-run it after ANY edit here. Pictures: scratch/curriculum-images/maths-ks1/.
import type { CTopic } from "../types";

const IMG = {
  array: { file: "md-array.png", alt: "Orange counters in a neat grid: 3 rows, and every row has the same number of counters, lined up in columns." },
};

export const TOPIC: CTopic = {
  key: "md",
  topic: "Multiplication & Division",
  subject: "Maths",
  years: {
    1: {
      year: 1,
      objectives: [
        "Count in multiples of twos, fives and tens.",
        "Solve one-step problems involving multiplication and division, by calculating the answer using concrete objects, pictorial representations and arrays with the support of the teacher.",
        "Find doubles and halves of small numbers and quantities, and share objects equally into groups.",
      ],
      note: {
        title: "Year 1: counting in steps, doubling, halving and sharing",
        body: `## What to know

Year 1 is the start of multiplying and dividing. It happens with real things, not written sums.

- **Counting in steps**: in 2s (2, 4, 6, 8, 10), in 5s (5, 10, 15, 20) and in 10s (10, 20, 30, 40).
- **Doubling** means two of the same number. Double 3 is 3 + 3 = 6.
- **Halving** means sharing into 2 equal groups. Half of 14 is 7.
- **Sharing** means making equal groups. 8 sweets shared between 2 children is 4 each.

| Steps | Say it |
| --- | --- |
| 2s | 2, 4, 6, 8, 10, 12 |
| 5s | 5, 10, 15, 20, 25, 30 |
| 10s | 10, 20, 30, 40, 50, 60 |

## Say it like this

"Two for me, two for you. How many each?" Deal out objects one at a time so the groups are fair.

## Worked example 1: groups

4 boxes with 2 pencils in each. Count in 2s: 2, 4, 6, **8**. There are 8 pencils.

## Worked example 2: doubling

Double 5 is 5 + 5 = **10**.

## Worked example 3: sharing

8 grapes shared equally between 2 plates: 4 on each plate. Half of 8 is **4**.

**Tip for grown-ups:** count pairs of socks in 2s and fingers in 5s.`,
      },
      quiz: {
        title: "Multiplication & Division: Year 1 quiz",
        questions: [
          { key: "md-y1-01", kind: "single", prompt: "Count in 2s.\n2, 4, 6, ?", options: ["7", "8", "9", "10"], answer: "8", explanation: "Add 2 each time. 6 + 2 = 8.", difficulty: 1 },
          { key: "md-y1-02", kind: "single", prompt: "Count in 10s.\n10, 20, 30, ?", options: ["31", "50", "40", "35"], answer: "40", explanation: "Add 10 each time. 30 + 10 = 40.", difficulty: 1 },
          { key: "md-y1-03", kind: "single", prompt: "Count in 5s.\n5, 10, 15, ?", options: ["20", "16", "25", "18"], answer: "20", explanation: "Add 5 each time. 15 + 5 = 20.", difficulty: 1 },
          { key: "md-y1-04", kind: "number", prompt: "What is double 4?", answer: 8, explanation: "Double means two of the same number. 4 + 4 = 8.", difficulty: 2 },
          { key: "md-y1-05", kind: "number", prompt: "Half of 10 🍪 is how many 🍪?", answer: 5, explanation: "Half means share into 2 equal groups. 10 shared into 2 groups is 5 each.", difficulty: 2, diagnostic: true },
          { key: "md-y1-06", kind: "single", prompt: "12 sweets are shared equally between 2 children. How many sweets does each child get?", options: ["4", "6", "10", "14"], answer: "6", explanation: "Share out one at a time to each child. Each child gets 6 because 6 + 6 = 12.", difficulty: 2, diagnostic: true },
          { key: "md-y1-07", kind: "single", prompt: "3 bags have 2 apples 🍎🍎 in each bag. How many apples altogether?", options: ["5", "3", "6", "8"], answer: "6", explanation: "Count in 2s for 3 bags: 2, 4, 6.", difficulty: 2 },
          { key: "md-y1-08", kind: "multi", prompt: "Which numbers do you say when you count in 2s from 0? Choose two.", options: ["6", "9", "12", "15"], answer: ["6", "12"], explanation: "Counting in 2s gives 2, 4, 6, 8, 10, 12. So 6 and 12 are there, but 9 and 15 are not.", difficulty: 2 },
          { key: "md-y1-09", kind: "number", prompt: "Double 6. Then halve your answer. What number do you get?", answer: 6, explanation: "Double 6 is 12. Half of 12 is 6. Halving undoes doubling.", difficulty: 3 },
          { key: "md-y1-10", kind: "single", prompt: "4 children each have 5 stickers. How many stickers altogether?", options: ["9", "15", "20", "25"], answer: "20", explanation: "Count in 5s four times: 5, 10, 15, 20.", difficulty: 3 },
        ],
      },
      flashcards: [
        { front: "Count in 2s: 8, 10, 12, ?", back: "14" },
        { front: "Count in 5s: 20, 25, 30, ?", back: "35" },
        { front: "Count in 10s: 50, 60, 70, ?", back: "80" },
        { front: "Double 3", back: "6" },
        { front: "Double 5", back: "10" },
        { front: "Half of 8", back: "4" },
        { front: "Half of 6", back: "3" },
        { front: "Share 6 between 2. How many each?", back: "3" },
        { front: "What does 'double' mean?", back: "Two of the same number" },
        { front: "What does 'half' mean?", back: "Share into 2 equal parts" },
      ],
    },
    2: {
      year: 2,
      objectives: [
        "Recall and use multiplication and division facts for the 2, 5 and 10 multiplication tables, including recognising odd and even numbers.",
        "Calculate mathematical statements for multiplication and division within the multiplication tables and write them using the multiplication (×), division (÷) and equals (=) signs.",
        "Show that multiplication of two numbers can be done in any order (commutative) and division of one number by another cannot.",
        "Solve problems involving multiplication and division, using materials, arrays, repeated addition, mental methods, and multiplication and division facts.",
      ],
      note: {
        title: "Year 2: the 2, 5 and 10 times tables",
        body: `## What to know

**Multiplying** is adding the same number again and again. 3 × 2 means 3 groups of 2, which is 2 + 2 + 2 = 6. **Dividing** is sharing equally or making groups: 16 ÷ 2 = 8.

| Table | Answers |
| --- | --- |
| 2 × | 2, 4, 6, 8, 10, 12, 14, 16, 18, 20 |
| 5 × | 5, 10, 15, 20, 25, 30, 35, 40, 45, 50 |
| 10 × | 10, 20, 30, 40, 50, 60, 70, 80, 90, 100 |

- **Any order**: 2 × 8 = 8 × 2. This is true for × but not for ÷.
- **Even** numbers end in 0, 2, 4, 6 or 8 and can be shared into 2 equal groups. **Odd** numbers end in 1, 3, 5, 7 or 9.
- Every multiplication gives division facts: 2 × 7 = 14 so 14 ÷ 2 = 7.

## Say it like this

"How many groups? How many in each group?" An array (rows and columns) shows both.

## Worked example 1: array

4 rows of 2 counters is 4 × 2 = **8**.

## Worked example 2: division

35 ÷ 5. Think: 5 times what makes 35? 5 × 7 = 35, so the answer is **7**.

## Worked example 3: odd or even

Is 27 odd or even? It ends in 7, so it is **odd**.

**Tip for grown-ups:** chant the tables while walking, then mix them up.`,
      },
      quiz: {
        title: "Multiplication & Division: Year 2 quiz",
        questions: [
          { key: "md-y2-01", kind: "single", prompt: "What is 2 × 6?", options: ["8", "12", "14", "26"], answer: "12", explanation: "Count in 2s six times: 2, 4, 6, 8, 10, 12.", difficulty: 1 },
          { key: "md-y2-02", kind: "number", prompt: "What is 5 × 4?", answer: 20, explanation: "Count in 5s four times: 5, 10, 15, 20.", difficulty: 1 },
          { key: "md-y2-03", kind: "single", prompt: "What is 10 × 7?", options: ["17", "77", "70", "107"], answer: "70", explanation: "Multiplying by 10 moves each digit one place. 7 tens is 70.", difficulty: 1 },
          { key: "md-y2-04", kind: "single", prompt: "What is 18 ÷ 2?", options: ["9", "16", "20", "36"], answer: "9", explanation: "Share 18 into 2 equal groups. Half of 18 is 9 because 9 + 9 = 18.", difficulty: 2, diagnostic: true },
          { key: "md-y2-05", kind: "number", prompt: "What is 45 ÷ 5?", answer: 9, explanation: "Think 5 times what makes 45? 5 × 9 = 45, so 45 ÷ 5 = 9.", difficulty: 2, diagnostic: true },
          { key: "md-y2-06", kind: "number", prompt: "How many counters are there altogether?", answer: 15, image: IMG.array, explanation: "There are 3 rows of 5. Count in 5s: 5, 10, 15.", difficulty: 2 },
          { key: "md-y2-07", kind: "multi", prompt: "Which of these are odd numbers? Choose two.", options: ["14", "21", "30", "37"], answer: ["21", "37"], explanation: "Odd numbers end in 1, 3, 5, 7 or 9. So 21 and 37 are odd; 14 and 30 are even.", difficulty: 2 },
          { key: "md-y2-08", kind: "single", prompt: "Which one has the same answer as 3 × 10?", options: ["10 ÷ 3", "10 × 3", "3 + 10", "30 ÷ 3"], answer: "10 × 3", explanation: "We can multiply in any order, so 3 × 10 = 10 × 3. Both are 30.", difficulty: 2 },
          { key: "md-y2-09", kind: "number", prompt: "Ravi has 4 bags of 5 sweets. He eats 3 sweets. How many sweets are left?", answer: 17, explanation: "First 4 × 5 = 20 sweets. Then take away the 3 he ate: 20 − 3 = 17.", difficulty: 3 },
          { key: "md-y2-10", kind: "single", prompt: "Zoe says: 'Every number in the 5 times table ends in 5.' What do you say?", options: ["Yes, always", "No, some end in 0", "No, they end in 2"], answer: "No, some end in 0", explanation: "The 5 times table goes 5, 10, 15, 20… The answers end in 5 or 0.", difficulty: 3 },
        ],
      },
      flashcards: [
        { front: "2 × 8 = ?", back: "16" },
        { front: "5 × 7 = ?", back: "35" },
        { front: "10 × 4 = ?", back: "40" },
        { front: "14 ÷ 2 = ?", back: "7" },
        { front: "30 ÷ 5 = ?", back: "6" },
        { front: "60 ÷ 10 = ?", back: "6" },
        { front: "5 × 9 = ?", back: "45" },
        { front: "2 × 9 = ?", back: "18" },
        { front: "Odd or even: 27?", back: "Odd (it ends in 7)" },
        { front: "4 × 5 = 5 × ?", back: "4 (any order works for ×)" },
      ],
    },
  },
};
