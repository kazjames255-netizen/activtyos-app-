// KS1 Maths — Number & Place Value (Years 1–2). Original content aligned to the DfE National Curriculum (OGL v3.0).
// Answer keys are recomputed by _check_m1.ts — re-run it after ANY edit here. Pictures: scratch/curriculum-images/maths-ks1/.
import type { CTopic } from "../types";

const IMG = {
  line20: { file: "npv-line20.png", alt: "A number line from 0 to 20 with a small mark for every whole number. The numbers 0, 5, 10, 15 and 20 are written under the line. A red arrow above the line points down at one mark, the fourth mark after the 10." },
  line4050: { file: "npv-line-40-50.png", alt: "A number line from 40 to 50 with a small mark for every whole number. Only 40, 45 and 50 are written under the line. A red arrow above the line points down at one mark, the second mark after the 45." },
  blocks: { file: "npv-blocks.png", alt: "Number blocks. On the left are 3 tall blue rods, each split into 10 small squares (each rod is a ten). On the right are 8 single orange squares (each is a one), in 4 rows of 2." },
};

export const TOPIC: CTopic = {
  key: "npv",
  topic: "Number & Place Value",
  subject: "Maths",
  years: {
    1: {
      year: 1,
      objectives: [
        "Count to and across 100, forwards and backwards, beginning with 0 or 1, or from any given number.",
        "Count, read and write numbers to 100 in numerals; read and write the numbers from 1 to 20 in words.",
        "Given a number, identify one more and one less.",
        "Identify and represent numbers using objects and pictorial representations including the number line, and use the language of: equal to, more than, less than (fewer), most, least.",
      ],
      note: {
        title: "Year 1: counting, one more and one less, and comparing",
        body: `## What to know

Counting is the big idea. Children count objects one at a time, say each number once, and know the **last number said** tells how many.

- **One more** means count on 1. One more than 15 is 16.
- **One less** means count back 1. One less than 30 is 29.
- On a **number line**, numbers get bigger as you move to the right.

| Word | Means |
| --- | --- |
| more than | a bigger number (8 is more than 3) |
| less than / fewer | a smaller number (3 is less than 8) |
| equal to | the same (5 is equal to 5) |

## Say it like this

"Touch each apple once and say the numbers. The last number you say is how many."

## Worked example 1: one more

What is one more than 29? Count on: 29, **30**. The tens number changes when we pass 9.

## Worked example 2: comparing

Which is bigger, 47 or 74? Look at the tens first. 7 tens is more than 4 tens, so **74** is bigger.

## Worked example 3: across 100

Now count back across 100: 102, 101, **100**, 99. The numbers carry on past 100 in both directions.

**Tip for grown-ups:** count everyday things together: stairs, toys, steps to the gate.`,
      },
      quiz: {
        title: "Number & Place Value: Year 1 quiz",
        questions: [
          { key: "npv-y1-01", kind: "single", prompt: "What comes next? 4, 5, 6, ?", options: ["8", "7", "5", "3"], answer: "7", explanation: "Count on by one each time: 4, 5, 6, then 7.", difficulty: 1 },
          { key: "npv-y1-02", kind: "number", prompt: "How many apples are there?\n🍎🍎🍎🍎🍎🍎🍎🍎🍎", answer: 9, explanation: "Touch each apple once and count: the last number you say is 9.", difficulty: 1 },
          { key: "npv-y1-03", kind: "single", prompt: "What is one more than 12?", options: ["11", "12", "14", "13"], answer: "13", explanation: "One more means count on 1 from 12. That is 13.", difficulty: 1 },
          { key: "npv-y1-04", kind: "single", prompt: "What is one less than 20?", options: ["19", "21", "10", "18"], answer: "19", explanation: "One less means count back 1 from 20. Count back: 20, then 19.", difficulty: 2 },
          { key: "npv-y1-05", kind: "single", prompt: "What number is the red arrow pointing to?", options: ["12", "13", "14", "15"], answer: "14", image: IMG.line20, explanation: "Start at 10 and count along the marks: 11, 12, 13, 14. The arrow is at 14.", difficulty: 2, diagnostic: true },
          { key: "npv-y1-06", kind: "single", prompt: "Which is the biggest number?", options: ["83", "38", "35", "53"], answer: "83", explanation: "Look at the tens first. 8 tens is the most, so 83 is the biggest.", difficulty: 2, diagnostic: true },
          { key: "npv-y1-07", kind: "single", prompt: "Which is the number word for 16?", options: ["sixty", "sixteen", "six", "fourteen"], answer: "sixteen", explanation: "16 is sixteen. Sixty is 60, and six is just 6.", difficulty: 2 },
          { key: "npv-y1-08", kind: "single", prompt: "Which sentence is true?", options: ["9 is less than 4", "9 is equal to 4", "9 is more than 4"], answer: "9 is more than 4", explanation: "9 comes after 4 when we count, so 9 is more than 4.", difficulty: 2 },
          { key: "npv-y1-09", kind: "single", prompt: "Keep counting across 100.\n98, 99, 100, ?", options: ["1000", "101", "110", "200"], answer: "101", explanation: "After 100 we count on by one: 101. It is not 1000 or 110.", difficulty: 3 },
          { key: "npv-y1-10", kind: "number", prompt: "I am one less than 50 and one more than 48. What number am I?", answer: 49, explanation: "One more than 48 is 49. One less than 50 is also 49.", difficulty: 3 },
        ],
      },
      flashcards: [
        { front: "What comes after 9?", back: "10" },
        { front: "One more than 19", back: "20" },
        { front: "One less than 10", back: "9" },
        { front: "Which is more: 27 or 72?", back: "72 (7 tens is more than 2 tens)" },
        { front: "Number word for 13", back: "thirteen" },
        { front: "Count back across 100: 102, 101, 100, ?", back: "99" },
        { front: "Which is fewer: 8 or 5?", back: "5" },
        { front: "What does 'equal to' mean?", back: "The same as" },
        { front: "On a number line, bigger numbers are on the…", back: "Right" },
      ],
    },
    2: {
      year: 2,
      objectives: [
        "Count in steps of 2, 3 and 5 from 0, and in tens from any number, forward and backward.",
        "Recognise the place value of each digit in a two-digit number (tens, ones).",
        "Identify, represent and estimate numbers using different representations, including the number line.",
        "Compare and order numbers from 0 up to 100; use <, > and = signs.",
        "Read and write numbers to at least 100 in numerals and in words.",
        "Use place value and number facts to solve problems.",
      ],
      note: {
        title: "Year 2: tens and ones, comparing and counting in steps",
        body: `## What to know

A two-digit number is made of **tens** and **ones**. In 58 the 5 means 5 tens (50) and the 8 means 8 ones (8). So 58 = 50 + 8.

| Number | Tens | Ones | Value of the digits |
| --- | --- | --- | --- |
| 58 | 5 | 8 | 50 and 8 |
| 30 | 3 | 0 | 30 and 0 |
| 92 | 9 | 2 | 90 and 2 |

- **Compare** by looking at the tens first. If the tens are the same, look at the ones.
- The signs: **>** means "is greater than", **<** means "is less than", **=** means "is equal to". The open mouth of the sign faces the bigger number.
- Count in steps of 2, 3, 5 and 10 (for example 5, 10, 15, 20).

## Say it like this

"Which digit is in the tens place? That tells us how many tens."

## Worked example 1: place value

What is the value of the 6 in 69? It is in the tens place, so it is worth **60**.

## Worked example 2: comparing

Which sign goes in 45 □ 54? Both have 4 and 5 but in different places. 45 has 4 tens and 54 has 5 tens, so 45 **<** 54.

## Worked example 3: counting in 5s

35, 40, 45, **50**. We add 5 each time.`,
      },
      quiz: {
        title: "Number & Place Value: Year 2 quiz",
        questions: [
          { key: "npv-y2-01", kind: "single", prompt: "What is the value of the 7 in 72?", options: ["7", "70", "2", "72"], answer: "70", explanation: "The 7 is in the tens place, so it is 7 tens. That is worth 70.", difficulty: 1 },
          { key: "npv-y2-02", kind: "number", prompt: "What number is 6 tens and 2 ones?", answer: 62, explanation: "6 tens is 60. Add 2 ones: 60 + 2 = 62.", difficulty: 1 },
          { key: "npv-y2-03", kind: "single", prompt: "Which sign goes in the box?\n27 □ 72", options: ["<", ">", "="], answer: "<", explanation: "27 has 2 tens and 72 has 7 tens. 27 is smaller, so 27 < 72.", difficulty: 1 },
          { key: "npv-y2-04", kind: "single", prompt: "What number is the red arrow pointing to?", options: ["45", "46", "47", "48"], answer: "47", image: IMG.line4050, explanation: "Start at 45 and count on along the marks: 46, 47. The arrow is at 47.", difficulty: 2, diagnostic: true },
          { key: "npv-y2-05", kind: "number", prompt: "What number do the blocks show?", answer: 38, image: IMG.blocks, explanation: "There are 3 tens (30) and 8 ones (8). 30 + 8 = 38.", difficulty: 2 },
          { key: "npv-y2-06", kind: "single", prompt: "Count in 3s.\n3, 6, 9, 12, ?", options: ["15", "14", "18", "13"], answer: "15", explanation: "Add 3 each time. 12 + 3 = 15.", difficulty: 2 },
          { key: "npv-y2-07", kind: "single", prompt: "Which list is in order, smallest first?", options: ["61, 16, 66", "16, 66, 61", "16, 61, 66", "66, 61, 16"], answer: "16, 61, 66", explanation: "16 has 1 ten so it is smallest. 61 has 6 tens and 1 one. 66 has 6 tens and 6 ones, so it is biggest.", difficulty: 2, diagnostic: true },
          { key: "npv-y2-08", kind: "multi", prompt: "Which of these show the number 35? Choose two.", options: ["3 tens and 5 ones", "5 tens and 3 ones", "30 + 5", "3 + 5"], answer: ["3 tens and 5 ones", "30 + 5"], explanation: "35 is 3 tens and 5 ones, which is 30 + 5. The others do not make 35.", difficulty: 2 },
          { key: "npv-y2-09", kind: "number", prompt: "A 2-digit number has 3 tens. Its ones digit is 3 more than its tens digit. What is the number?", answer: 36, explanation: "The tens digit is 3. The ones digit is 3 + 3 = 6. The number is 36.", difficulty: 3 },
          { key: "npv-y2-10", kind: "single", prompt: "Which is the biggest?", options: ["4 tens and 9 ones", "5 tens and 2 ones", "48", "45"], answer: "5 tens and 2 ones", explanation: "Compare the tens first: 5 tens is more than 4 tens. 5 tens and 2 ones is 52, the biggest.", difficulty: 3 },
        ],
      },
      flashcards: [
        { front: "Value of the 4 in 48?", back: "40" },
        { front: "5 tens and 3 ones", back: "53" },
        { front: "Count in 5s: 5, 10, 15, ?", back: "20" },
        { front: "Count in 3s: 3, 6, 9, ?", back: "12" },
        { front: "Count in 2s: 2, 4, 6, ?", back: "8" },
        { front: "Count in 10s: 24, 34, 44, ?", back: "54" },
        { front: "What does > mean?", back: "Is greater than (bigger than)" },
        { front: "What does < mean?", back: "Is less than (smaller than)" },
        { front: "How many tens in 70?", back: "7" },
        { front: "Which is bigger: 39 or 93?", back: "93" },
      ],
    },
  },
};
