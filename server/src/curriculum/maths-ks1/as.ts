// KS1 Maths — Addition & Subtraction (Years 1–2). Original content aligned to the DfE National Curriculum (OGL v3.0).
// Answer keys are recomputed by _check_m1.ts — re-run it after ANY edit here. Pictures: scratch/curriculum-images/maths-ks1/.
import type { CTopic } from "../types";

const IMG = {
  bar: { file: "as-bar.png", alt: "A bar model. A long bar on top is labelled 45. Underneath it is split into two parts that together are as long as the top bar. The left part is labelled 28. The right part is labelled with a question mark." },
};

export const TOPIC: CTopic = {
  key: "as",
  topic: "Addition & Subtraction",
  subject: "Maths",
  years: {
    1: {
      year: 1,
      objectives: [
        "Read, write and interpret mathematical statements involving addition (+), subtraction (−) and equals (=) signs.",
        "Represent and use number bonds and related subtraction facts within 20.",
        "Add and subtract one-digit and two-digit numbers to 20, including zero.",
        "Solve one-step problems that involve addition and subtraction, using concrete objects and pictorial representations, and missing number problems such as 7 = □ − 9.",
      ],
      note: {
        title: "Year 1: adding, taking away and number bonds",
        body: `## What to know

**Adding** means putting groups together to make more. **Subtracting** means taking some away, or finding what is left.

- The signs: **+** (add), **−** (take away), **=** (equals, the same as).
- A **number bond** is two numbers that join to make a total. 6 + 4 = 10, so 6 and 4 are a bond to 10.
- Every bond gives a family of facts: 6 + 4 = 10, 4 + 6 = 10, 10 − 4 = 6, 10 − 6 = 4.

Bonds to 10:
- 0 + 10, 1 + 9, 2 + 8, 3 + 7, 4 + 6
- 5 + 5, 6 + 4, 7 + 3, 8 + 2, 9 + 1

## Say it like this

"Start at the bigger number and count on. Use your fingers or a number line to help."

## Worked example 1: adding

6 + 2. Start at 6 and count on 2: 7, **8**.

## Worked example 2: taking away

Lily has 9 🍎 and gives 3 away. Count back: 8, 7, **6**. Lily has 6 left.

## Worked example 3: a missing number

5 + □ = 10. Ask "what goes with 5 to make 10?" The answer is **5**.

**Tip for grown-ups:** practise bonds to 10 until they are instant. They help with everything later.`,
      },
      quiz: {
        title: "Addition & Subtraction: Year 1 quiz",
        questions: [
          { key: "as-y1-01", kind: "number", prompt: "What is 5 + 3?", answer: 8, explanation: "Start at 5 and count on 3: 6, 7, 8.", difficulty: 1 },
          { key: "as-y1-02", kind: "single", prompt: "What is 9 − 2?", options: ["7", "6", "8", "11"], answer: "7", explanation: "Count back 2 from 9: 8, 7. Subtracting makes the number smaller, not bigger.", difficulty: 1 },
          { key: "as-y1-03", kind: "single", prompt: "Sam has 6 🍪. He eats 2. How many are left?", options: ["3", "4", "5", "8"], answer: "4", explanation: "Eating means taking away: 6 − 2 = 4.", difficulty: 1 },
          { key: "as-y1-04", kind: "single", prompt: "Which number goes in the box?\n7 + □ = 10", options: ["2", "3", "4", "17"], answer: "3", explanation: "7 and 3 make 10. Count on from 7: 8, 9, 10. That is 3 steps.", difficulty: 2 },
          { key: "as-y1-05", kind: "number", prompt: "8 fish 🐟 are in a pond. 5 more swim in. How many fish now?", answer: 13, explanation: "Swimming in means adding: 8 + 5 = 13.", difficulty: 2 },
          { key: "as-y1-06", kind: "single", prompt: "Which two numbers make 10?", options: ["6 and 3", "7 and 3", "5 and 6", "4 and 5"], answer: "7 and 3", explanation: "7 + 3 = 10. The others make 9, 11 and 9.", difficulty: 2, diagnostic: true },
          { key: "as-y1-07", kind: "single", prompt: "Which one is true?", options: ["9 − 4 = 6", "9 − 4 = 5", "9 − 4 = 4", "9 + 4 = 5"], answer: "9 − 4 = 5", explanation: "Count back 4 from 9: 8, 7, 6, 5. So 9 − 4 = 5.", difficulty: 2, diagnostic: true },
          { key: "as-y1-08", kind: "single", prompt: "Mia has 12 stickers. She gives away 5. Which sum shows this?", options: ["5 + 12", "12 + 5", "12 − 5"], answer: "12 − 5", explanation: "Giving away means taking away, so we start with 12 and take away 5.", difficulty: 2 },
          { key: "as-y1-09", kind: "single", prompt: "4 + 9 = 13. Which fact goes with it?", options: ["13 − 9 = 4", "13 − 4 = 8", "9 − 4 = 5", "13 + 4 = 17"], answer: "13 − 9 = 4", explanation: "Take a part away from the total and you get the other part: 13 − 9 = 4.", difficulty: 3 },
          { key: "as-y1-10", kind: "number", prompt: "I think of a number. I add 6 and get 15. What was my number?", answer: 9, explanation: "Work backwards: take 6 away from 15. 15 − 6 = 9. Check: 9 + 6 = 15.", difficulty: 3 },
        ],
      },
      flashcards: [
        { front: "4 + 3 = ?", back: "7" },
        { front: "9 − 5 = ?", back: "4" },
        { front: "6 + 6 = ?", back: "12" },
        { front: "10 − 7 = ?", back: "3" },
        { front: "7 + 3 = ?", back: "10" },
        { front: "8 + 2 = ?", back: "10" },
        { front: "12 − 2 = ?", back: "10" },
        { front: "6 + ? = 10", back: "4" },
        { front: "Which sign means take away?", back: "−" },
        { front: "What does = mean?", back: "The same as" },
      ],
    },
    2: {
      year: 2,
      objectives: [
        "Solve problems with addition and subtraction using concrete objects, pictorial representations, and numbers, quantities and measures.",
        "Recall and use addition and subtraction facts to 20 fluently, and derive and use related facts up to 100.",
        "Add and subtract numbers using concrete objects, pictorial representations, and mentally, including a two-digit number and ones, a two-digit number and tens, two two-digit numbers, and adding three one-digit numbers.",
        "Show that addition of two numbers can be done in any order (commutative) and subtraction of one number from another cannot.",
        "Recognise and use the inverse relationship between addition and subtraction to check calculations and solve missing number problems.",
      ],
      note: {
        title: "Year 2: adding and subtracting with tens and ones",
        body: `## What to know

Year 2 children use **place value** to add and subtract two-digit numbers. Split a number into tens and ones.

- **Tens and ones**: 20 + 60 = 80 because 2 tens + 6 tens = 8 tens.
- **Any order**: 4 + 9 = 9 + 4. But 9 − 4 is not the same as 4 − 9.
- **Inverse**: adding and subtracting undo each other. If 34 + 18 = 52, then 52 − 18 = 34.
- **Bar model**: a bar for the total, split into parts.

| Try this | Steps | Answer |
| --- | --- | --- |
| 34 + 5 | ones only: 4 + 5 = 9 | 39 |
| 51 + 30 | tens only: 5 + 3 = 8 tens | 81 |
| 32 + 54 | 30 + 50 = 80, 2 + 4 = 6 | 86 |

## Say it like this

"Add the tens together, then add the ones together. Then put them back together."

## Worked example 1: two-digit and tens

53 − 20. Take 2 tens from 5 tens. That leaves 3 tens, so **33**.

## Worked example 2: two two-digit numbers

32 + 54. Tens: 30 + 50 = 80. Ones: 2 + 4 = 6. Total 80 + 6 = **86**.

## Worked example 3: three numbers

4 + 9 + 6. Find two that make 10 first: 4 + 6 = 10. Then 10 + 9 = **19**.

**Tip for grown-ups:** ask "how do you know?" and let your child check with the inverse.`,
      },
      quiz: {
        title: "Addition & Subtraction: Year 2 quiz",
        questions: [
          { key: "as-y2-01", kind: "number", prompt: "What is 9 + 8?", answer: 17, explanation: "Make 10 first: 9 + 1 = 10, then add the other 7. 10 + 7 = 17.", difficulty: 1 },
          { key: "as-y2-02", kind: "single", prompt: "What is 14 − 6?", options: ["7", "8", "9", "20"], answer: "8", explanation: "Take away 4 to reach 10, then take away 2 more. 14 − 4 = 10, 10 − 2 = 8.", difficulty: 1 },
          { key: "as-y2-03", kind: "single", prompt: "What is 30 + 40?", options: ["60", "80", "70", "10"], answer: "70", explanation: "3 tens + 4 tens = 7 tens. 7 tens is 70.", difficulty: 1 },
          { key: "as-y2-04", kind: "number", prompt: "What is 46 + 20?", answer: 66, explanation: "Add the tens: 4 tens + 2 tens = 6 tens. The ones stay the same. So 66.", difficulty: 2 },
          { key: "as-y2-05", kind: "single", prompt: "What is 45 + 32?", options: ["67", "87", "77", "713"], answer: "77", explanation: "Tens: 40 + 30 = 70. Ones: 5 + 2 = 7. Then 70 + 7 = 77.", difficulty: 2, diagnostic: true },
          { key: "as-y2-06", kind: "number", prompt: "What is 68 − 24?", answer: 44, explanation: "Take away the tens: 68 − 20 = 48. Take away the ones: 48 − 4 = 44.", difficulty: 2, diagnostic: true },
          { key: "as-y2-07", kind: "number", prompt: "Use the bar. What is the missing part?", answer: 17, image: IMG.bar, explanation: "The two parts make 45, so the missing part is 45 − 28. Count on from 28 to 30 (2), then to 45 (15). 2 + 15 = 17.", difficulty: 2 },
          { key: "as-y2-08", kind: "single", prompt: "What is 3 + 8 + 7?", options: ["16", "17", "19", "18"], answer: "18", explanation: "Spot the pair that makes 10: 3 + 7 = 10. Then 10 + 8 = 18.", difficulty: 2 },
          { key: "as-y2-09", kind: "single", prompt: "Kim says: 58 − 23 = 35, so 35 + 23 = 58. What do you say?", options: ["No, it is 81", "Yes, they undo each other", "No, it is 12"], answer: "Yes, they undo each other", explanation: "Adding is the inverse of subtracting. 35 + 23 = 58, so Kim is right.", difficulty: 3 },
          { key: "as-y2-10", kind: "number", prompt: "Ben has 27 stickers. He gets 15 more, then gives 20 away. How many now?", answer: 22, explanation: "First add: 27 + 15 = 42. Then take away 20: 42 − 20 = 22.", difficulty: 3 },
        ],
      },
      flashcards: [
        { front: "8 + 7 = ?", back: "15" },
        { front: "12 − 5 = ?", back: "7" },
        { front: "20 + 50 = ?", back: "70" },
        { front: "50 − 20 = ?", back: "30" },
        { front: "6 + 7 = ?", back: "13" },
        { front: "45 + 10 = ?", back: "55" },
        { front: "62 − 10 = ?", back: "52" },
        { front: "4 + 9 = 9 + ?", back: "4 (add in any order)" },
        { front: "The opposite (inverse) of + is…", back: "−" },
        { front: "If 23 + 19 = 42, then 42 − 19 = ?", back: "23" },
      ],
    },
  },
};
