// KS2 Maths — Fractions, Decimals & Percentages (Years 3–6). Original content aligned to the DfE National Curriculum (OGL v3.0).
// Answer keys are recomputed by _check_k2.ts — re-run it after ANY edit here.
import type { CTopic } from "../types";

export const TOPIC: CTopic = {
  key: "frac",
  topic: "Fractions, Decimals & Percentages",
  subject: "Maths",
  years: {
    3: {
      year: 3,
      objectives: [
        "Count up and down in tenths; recognise that tenths arise from dividing an object into 10 equal parts.",
        "Recognise, find and write fractions of a discrete set of objects: unit fractions and non-unit fractions with small denominators.",
        "Recognise and show, using diagrams, equivalent fractions with small denominators.",
        "Add and subtract fractions with the same denominator within one whole.",
      ],
      note: {
        title: "Year 3: tenths, fractions of amounts and adding fractions",
        body: `## What you need to know

A fraction shows equal parts of a whole. The **denominator** (bottom number) says how many equal parts there are. The **numerator** (top number) says how many of them we have.

- **Tenths:** one whole cut into 10 equal parts. Counting in tenths: 1/10, 2/10, 3/10 ... 10/10 = 1 whole.
- **Unit fraction:** the numerator is 1 (like 1/4). **Non-unit fraction:** the numerator is more than 1 (like 3/4).
- **Equivalent fractions** are different fractions for the same amount: 1/2 = 2/4 = 4/8.

## Worked example 1: a fraction of a set

Find 2/5 of 35.
- Divide by the denominator: 35 ÷ 5 = 7 (that is 1/5).
- Multiply by the numerator: 7 × 2 = **14**.

## Worked example 2: same denominator

4/9 + 3/9 = 7/9. **Only the numerators are added.** The denominator stays 9 because the parts are the same size. Subtracting works the same way: 8/9 − 5/9 = 3/9.

## Worked example 3: fraction left over

A cake has 10 slices. 4 are eaten. The fraction left is 6/10, because 10/10 − 4/10 = 6/10.

| Fraction | Meaning |
| --- | --- |
| 1/2 | 1 of 2 equal parts |
| 1/10 | 1 of 10 equal parts |`,
      },
      quiz: {
        title: "Fractions, Decimals & Percentages: Year 3 quiz",
        questions: [
          {
            key: "frac-y3-01",
            kind: "single",
            prompt: "Count in tenths: 1/10, 2/10, 3/10, ... What comes next?",
            options: ["4/10", "3/11", "4/100", "5/10"],
            answer: "4/10",
            explanation: "When counting in tenths the top number goes up by 1 each time and the bottom number stays 10, so the next is 4/10.",
            difficulty: 1,
          },
          {
            key: "frac-y3-02",
            kind: "single",
            prompt: "What is 1/4 of 20?",
            options: ["4", "5", "16", "80"],
            answer: "5",
            explanation: "To find 1/4, share into 4 equal groups: 20 ÷ 4 = 5.",
            difficulty: 1,
          },
          {
            key: "frac-y3-03",
            kind: "single",
            prompt: "Which fraction is equal to 1/2?",
            options: ["1/4", "2/3", "2/4", "3/4"],
            answer: "2/4",
            explanation: "2/4 means 2 out of 4 equal parts, which is half of the whole.",
            difficulty: 1,
          },
          {
            key: "frac-y3-04",
            kind: "single",
            prompt: "What is 3/8 + 2/8?",
            options: ["5/16", "1/8", "5/8", "6/8"],
            answer: "5/8",
            explanation: "The parts are the same size, so add the numerators only: 3 + 2 = 5. The denominator stays 8.",
            difficulty: 2,
            diagnostic: true,
          },
          {
            key: "frac-y3-05",
            kind: "single",
            prompt: "What is 3/5 of 30?",
            options: ["6", "18", "25", "150"],
            answer: "18",
            explanation: "Find 1/5 first: 30 ÷ 5 = 6. Then 3/5 is 3 × 6 = 18.",
            difficulty: 2,
            diagnostic: true,
          },
          {
            key: "frac-y3-06",
            kind: "number",
            prompt: "7/9 − 3/9 = □/9. What number goes in the box?",
            answer: 4,
            explanation: "The denominators are the same, so subtract the numerators: 7 − 3 = 4.",
            difficulty: 2,
          },
          {
            key: "frac-y3-07",
            kind: "multi",
            prompt: "Which of these fractions are equal to 1/2? Choose all that apply.",
            options: ["2/4", "3/6", "2/3", "4/8", "3/4"],
            answer: ["2/4", "3/6", "4/8"],
            explanation: "A fraction equals 1/2 when the numerator is half of the denominator: 2 of 4, 3 of 6 and 4 of 8.",
            difficulty: 2,
          },
          {
            key: "frac-y3-08",
            kind: "short",
            prompt: "How many tenths are there in one whole?",
            answer: "10",
            accepted: ["ten"],
            explanation: "One whole is cut into 10 equal parts to make tenths, so 10/10 = 1 whole.",
            difficulty: 2,
          },
          {
            key: "frac-y3-09",
            kind: "single",
            prompt: "A pizza is cut into 8 equal slices. Ben eats 3 slices and Zoe eats 2 slices. What fraction of the pizza is left?",
            options: ["5/8", "3/5", "1/8", "3/8"],
            answer: "3/8",
            explanation: "Together they ate 3 + 2 = 5 slices, so 8 − 5 = 3 slices are left. That is 3/8.",
            difficulty: 3,
          },
          {
            key: "frac-y3-10",
            kind: "single",
            prompt: "Priya has 24 stickers. She gives 3/8 of them to her sister. How many stickers does she have left?",
            options: ["9", "21", "16", "15"],
            answer: "15",
            explanation: "1/8 of 24 is 24 ÷ 8 = 3, so 3/8 is 9 stickers given away. Then 24 − 9 = 15 are left.",
            difficulty: 3,
          },
        ],
      },
      flashcards: [
        { front: "What does the denominator tell you?", back: "How many equal parts the whole is cut into (the bottom number)." },
        { front: "What does the numerator tell you?", back: "How many of those parts we have (the top number)." },
        { front: "How many tenths make 1 whole?", back: "10 tenths: 10/10 = 1." },
        { front: "What is a unit fraction?", back: "A fraction with 1 on top, like 1/3 or 1/8." },
        { front: "1/2 = ?/4 = ?/8", back: "1/2 = 2/4 = 4/8" },
        { front: "How do you find 1/5 of an amount?", back: "Divide the amount by 5." },
        { front: "4/9 + 3/9", back: "7/9 (add the numerators, keep the denominator)." },
        { front: "Why is 4/9 + 3/9 NOT 7/18?", back: "The parts stay the same size (ninths), so the denominator does not change." },
        { front: "How do you find 3/4 of 20?", back: "20 ÷ 4 = 5 for one quarter, then 5 × 3 = 15." },
        { front: "1/10 + 3/10", back: "4/10" },
      ],
    },
    4: {
      year: 4,
      objectives: [
        "Recognise and show, using diagrams, families of common equivalent fractions.",
        "Count up and down in hundredths; recognise that hundredths arise when dividing an object by one hundred, or dividing tenths by ten.",
        "Solve problems involving increasingly harder fractions to calculate quantities.",
        "Recognise and write decimal equivalents of 1/4, 1/2 and 3/4.",
        "Find the effect of dividing a one- or two-digit number by 10 and 100, identifying the value of the digits in the answer as ones, tenths and hundredths.",
        "Round decimals with one decimal place to the nearest whole number; compare numbers with the same number of decimal places up to two decimal places.",
      ],
      note: {
        title: "Year 4: equivalent fractions, hundredths and decimals",
        body: `## What you need to know

- **Equivalent fractions** are made by multiplying (or dividing) the top and bottom by the same number: 1/3 = 2/6 = 3/9.
- **Hundredths:** one whole cut into 100 equal parts. 10 hundredths make 1 tenth, so 1/10 = 10/100 = 0.1.
- **Decimal equivalents to know:** 1/2 = 0.5, 1/4 = 0.25, 3/4 = 0.75.
- **Dividing by 10 or 100** makes a number smaller. Digits move one (or two) places to the right: 48 ÷ 10 = 4.8 and 48 ÷ 100 = 0.48.
- **Rounding to 1 decimal place:** look at the hundredths digit. 5 or more, round up.

## Worked example 1: fraction of an amount

What is 2/5 of 45?
- 45 ÷ 5 = 9 (one fifth)
- 9 × 2 = **18**

## Worked example 2: comparing decimals

Which is bigger, 0.8 or 0.75? Write 0.8 as 0.80 so both have hundredths: 80 hundredths is more than 75 hundredths. **0.8 is bigger.**

## Worked example 3: rounding

Round 5.86 to 1 d.p. The hundredths digit is 6, so round the tenths up: **5.9**.

| Fraction | Decimal |
| --- | --- |
| 1/2 | 0.5 |
| 1/4 | 0.25 |
| 3/4 | 0.75 |`,
      },
      quiz: {
        title: "Fractions, Decimals & Percentages: Year 4 quiz",
        questions: [
          {
            key: "frac-y4-01",
            kind: "single",
            prompt: "What is 1/2 as a decimal?",
            options: ["1.2", "0.2", "0.5", "5.0"],
            answer: "0.5",
            explanation: "1/2 is the same as 5/10, which is written as 0.5.",
            difficulty: 1,
          },
          {
            key: "frac-y4-02",
            kind: "single",
            prompt: "What is 36 ÷ 10?",
            options: ["0.36", "36.0", "3.6", "360"],
            answer: "3.6",
            explanation: "Dividing by 10 moves each digit one place to the right, so 36 becomes 3.6.",
            difficulty: 1,
          },
          {
            key: "frac-y4-03",
            kind: "number",
            prompt: "How many hundredths are the same as one tenth?",
            answer: 10,
            explanation: "Cut each tenth into 10 equal pieces to make hundredths, so 1/10 = 10/100.",
            difficulty: 1,
          },
          {
            key: "frac-y4-04",
            kind: "single",
            prompt: "Which fraction is equivalent to 2/3?",
            options: ["4/6", "4/9", "2/6", "5/6"],
            answer: "4/6",
            explanation: "Multiply the top and the bottom by the same number: 2 × 2 = 4 and 3 × 2 = 6, so 2/3 = 4/6.",
            difficulty: 2,
            diagnostic: true,
          },
          {
            key: "frac-y4-05",
            kind: "single",
            prompt: "Round 6.47 to 1 decimal place.",
            options: ["6.4", "6.5", "6.0", "7.0"],
            answer: "6.5",
            explanation: "Look at the hundredths digit, 7. It is 5 or more, so round the tenths digit up: 6.5.",
            difficulty: 2,
            diagnostic: true,
          },
          {
            key: "frac-y4-06",
            kind: "single",
            prompt: "Which of these decimals is the largest?",
            options: ["0.56", "0.65", "0.7", "0.09"],
            answer: "0.7",
            explanation: "Give them all two decimal places: 0.56, 0.65, 0.70, 0.09. The largest is 70 hundredths, which is 0.7.",
            difficulty: 2,
          },
          {
            key: "frac-y4-07",
            kind: "multi",
            prompt: "Which of these are equal to 3/4? Choose all that apply.",
            options: ["6/8", "0.75", "0.34", "9/12", "3.4"],
            answer: ["6/8", "0.75", "9/12"],
            explanation: "Multiplying top and bottom of 3/4 by 2 gives 6/8, and by 3 gives 9/12. Also, 3/4 = 75/100 = 0.75.",
            difficulty: 2,
          },
          {
            key: "frac-y4-08",
            kind: "short",
            prompt: "Write 0.25 as a fraction in its simplest form.",
            answer: "1/4",
            accepted: ["1/4", "¼", "1 / 4", "one quarter", "a quarter", "one fourth"],
            explanation: "0.25 is 25 hundredths. Cut both 25 and 100 by 25, so 25/100 = 1/4.",
            difficulty: 2,
          },
          {
            key: "frac-y4-09",
            kind: "single",
            prompt: "A bag holds 60 sweets. 3/5 of them are red. How many sweets are NOT red?",
            options: ["36", "12", "20", "24"],
            answer: "24",
            explanation: "1/5 of 60 is 12, so 3/5 is 36 red sweets. The sweets that are not red are 60 − 36 = 24.",
            difficulty: 3,
          },
          {
            key: "frac-y4-10",
            kind: "single",
            prompt: "Ella says: '0.3 is smaller than 0.25 because 3 is smaller than 25.' Which statement is correct?",
            options: [
              "Ella is right, because 25 is bigger than 3.",
              "Ella is wrong: 0.3 is 30 hundredths, which is more than 25 hundredths.",
              "Ella is wrong: 0.3 and 0.25 are equal.",
              "Ella is right, because 0.3 has fewer digits.",
            ],
            answer: "Ella is wrong: 0.3 is 30 hundredths, which is more than 25 hundredths.",
            explanation: "Write 0.3 as 0.30. Then compare the hundredths: 30 is more than 25, so 0.3 is the bigger number.",
            difficulty: 3,
          },
        ],
      },
      flashcards: [
        { front: "1/2 as a decimal", back: "0.5" },
        { front: "1/4 as a decimal", back: "0.25" },
        { front: "3/4 as a decimal", back: "0.75" },
        { front: "How do you make an equivalent fraction?", back: "Multiply (or divide) the top and bottom by the same number." },
        { front: "Count in hundredths from 7/100", back: "7/100, 8/100, 9/100, 10/100, 11/100 ... (10/100 = 1/10)" },
        { front: "How many hundredths in one tenth?", back: "10 (1/10 = 10/100)." },
        { front: "48 ÷ 10 and 48 ÷ 100", back: "4.8 and 0.48 (digits move right)." },
        { front: "How do you round 5.86 to 1 d.p.?", back: "Look at the 6 (hundredths). It is 5 or more, so round up: 5.9." },
        { front: "How do you compare 0.6 and 0.45?", back: "Give both two decimal places: 0.60 > 0.45, so 0.6 is bigger." },
        { front: "How do you find 2/5 of 45?", back: "45 ÷ 5 = 9, then 9 × 2 = 18." },
      ],
    },
    5: {
      year: 5,
      objectives: [
        "Compare and order fractions whose denominators are all multiples of the same number.",
        "Identify, name and write equivalent fractions of a given fraction; recognise mixed numbers and improper fractions and convert from one form to the other.",
        "Add and subtract fractions with the same denominator and denominators that are multiples of the same number.",
        "Multiply proper fractions and mixed numbers by whole numbers.",
        "Read and write decimal numbers as fractions; recognise and use thousandths; read, write, order and compare numbers with up to three decimal places.",
        "Recognise the per cent symbol (%) and understand that per cent relates to 'number of parts per hundred'; know percentage and decimal equivalents of 1/2, 1/4, 1/5, 2/5, 4/5 and those with a denominator of a multiple of 10 or 25.",
      ],
      note: {
        title: "Year 5: mixed numbers, adding fractions and percentages",
        body: `## What you need to know

- An **improper fraction** has a numerator bigger than the denominator (like 23/4). A **mixed number** has a whole number and a fraction (like 5 3/4).
- To add or subtract fractions, the denominators must match. Change one fraction into an **equivalent** one first.
- **Percent** means 'out of 100'. 50% = 1/2 = 0.5, 25% = 1/4 = 0.25, 20% = 1/5 = 0.2, 40% = 2/5 = 0.4, 80% = 4/5 = 0.8.
- **Thousandths:** 0.001 is one thousandth. In 5.274 the 2 is tenths, the 7 is hundredths and the 4 is thousandths.

## Worked example 1: improper to mixed

Write 23/4 as a mixed number. 23 ÷ 4 = 5 remainder 3, so it is **5 3/4**.

## Worked example 2: adding with related denominators

3/5 + 7/10: change 3/5 to 6/10. Then 6/10 + 7/10 = 13/10 = **1 3/10**.

## Worked example 3: fraction times a whole number

2/3 × 4 = 8/3 = **2 2/3**. Multiply the numerator (2 × 4) but **keep the denominator** the same.

| Fraction | Decimal | Percentage |
| --- | --- | --- |
| 1/2 | 0.5 | 50% |
| 1/4 | 0.25 | 25% |
| 1/5 | 0.2 | 20% |
| 2/5 | 0.4 | 40% |
| 4/5 | 0.8 | 80% |`,
      },
      quiz: {
        title: "Fractions, Decimals & Percentages: Year 5 quiz",
        questions: [
          {
            key: "frac-y5-01",
            kind: "single",
            prompt: "What is 1/2 as a percentage?",
            options: ["12%", "20%", "50%", "5%"],
            answer: "50%",
            explanation: "Per cent means 'out of 100'. Half of 100 is 50, so 1/2 = 50%.",
            difficulty: 1,
          },
          {
            key: "frac-y5-02",
            kind: "single",
            prompt: "In the number 4.638, what is the value of the digit 3?",
            options: ["3 tenths", "3 hundredths", "3 thousandths", "3 ones"],
            answer: "3 hundredths",
            explanation: "After the decimal point the columns are tenths, hundredths, thousandths. The 3 is in the second column, hundredths.",
            difficulty: 1,
          },
          {
            key: "frac-y5-03",
            kind: "number",
            prompt: "4/5 = □%. What number goes in the box?",
            answer: 80,
            explanation: "1/5 is 20%, so 4/5 is 4 × 20% = 80%.",
            difficulty: 1,
          },
          {
            key: "frac-y5-04",
            kind: "single",
            prompt: "Write 17/5 as a mixed number.",
            options: ["2 3/5", "3 2/5", "3 1/5", "5 3/17"],
            answer: "3 2/5",
            explanation: "Divide 17 by 5: it goes in 3 times with 2 left over. So 17/5 = 3 whole ones and 2/5.",
            difficulty: 2,
            diagnostic: true,
          },
          {
            key: "frac-y5-05",
            kind: "single",
            prompt: "Work out 3/4 + 5/8. Give your answer as a mixed number.",
            options: ["8/12", "1 3/8", "8/8", "5/8"],
            answer: "1 3/8",
            explanation: "Change 3/4 into eighths: 6/8. Then 6/8 + 5/8 = 11/8, which is 1 whole and 3/8.",
            difficulty: 2,
            diagnostic: true,
          },
          {
            key: "frac-y5-06",
            kind: "single",
            prompt: "Which list shows the fractions in order from smallest to largest?",
            options: ["1/2, 5/8, 3/4", "3/4, 5/8, 1/2", "5/8, 1/2, 3/4", "1/2, 3/4, 5/8"],
            answer: "1/2, 5/8, 3/4",
            explanation: "Write them all as eighths: 1/2 = 4/8, 5/8 stays, 3/4 = 6/8. Then order 4/8, 5/8, 6/8.",
            difficulty: 2,
          },
          {
            key: "frac-y5-07",
            kind: "multi",
            prompt: "Which of these are equal to 2/5? Choose all that apply.",
            options: ["4/10", "40%", "0.25", "0.4", "2.5"],
            answer: ["4/10", "40%", "0.4"],
            explanation: "2/5 = 4/10 (multiply top and bottom by 2), which is 0.4 and also 40 out of 100, so 40%.",
            difficulty: 2,
          },
          {
            key: "frac-y5-08",
            kind: "short",
            prompt: "Write 6 tenths and 2 thousandths as a decimal.",
            answer: "0.602",
            accepted: [".602"],
            explanation: "6 tenths is 0.6 and 2 thousandths is 0.002. There are no hundredths, so we put 0 there: 0.602.",
            difficulty: 2,
          },
          {
            key: "frac-y5-09",
            kind: "single",
            prompt: "Work out 2 1/3 × 3.",
            options: ["6 1/3", "6 1/9", "7", "2 1/9"],
            answer: "7",
            explanation: "Multiply the whole part: 2 × 3 = 6. Multiply the fraction: 1/3 × 3 = 1. Then 6 + 1 = 7.",
            difficulty: 3,
          },
          {
            key: "frac-y5-10",
            kind: "single",
            prompt: "One batch of pancakes uses 3/4 of a litre of milk. Lucy makes 5 batches. How much milk does she use altogether?",
            options: ["15/20 litres", "5 3/4 litres", "3 1/4 litres", "3 3/4 litres"],
            answer: "3 3/4 litres",
            explanation: "Multiply the numerator by 5 and keep the denominator: 3/4 × 5 = 15/4. 15 ÷ 4 = 3 remainder 3, so 3 3/4 litres.",
            difficulty: 3,
          },
          {
            key: "frac-y5-11",
            kind: "single",
            prompt: "Which of these decimals is the smallest?",
            options: ["0.45", "0.405", "0.054", "0.5"],
            answer: "0.054",
            explanation: "Write each with three decimal places: 0.450, 0.405, 0.054 and 0.500. Comparing the thousandths, 54 is the least, so 0.054 is the smallest.",
            difficulty: 2,
          },
        ],
      },
      flashcards: [
        { front: "What is an improper fraction?", back: "A fraction where the numerator is bigger than (or equal to) the denominator, e.g. 7/4." },
        { front: "What is a mixed number?", back: "A whole number and a fraction together, e.g. 1 3/4." },
        { front: "Change 23/4 into a mixed number", back: "23 ÷ 4 = 5 r 3, so 5 3/4." },
        { front: "Change 2 1/4 into an improper fraction", back: "(2 × 4) + 1 = 9, so 9/4." },
        { front: "What does per cent mean?", back: "Out of 100. 50% = 50 out of 100." },
        { front: "1/2, 1/4, 1/5 as percentages", back: "50%, 25%, 20%" },
        { front: "2/5 and 4/5 as percentages", back: "40% and 80%" },
        { front: "How do you add 3/5 + 7/10?", back: "Make the denominators match: 6/10 + 7/10 = 13/10 = 1 3/10." },
        { front: "2/3 × 4: what happens to the denominator?", back: "It stays the same: 8/3 = 2 2/3." },
        { front: "Name the columns after the decimal point", back: "Tenths, hundredths, thousandths." },
        { front: "0.007 in words", back: "Seven thousandths." },
      ],
    },
    6: {
      year: 6,
      objectives: [
        "Use common factors to simplify fractions; use common multiples to express fractions in the same denomination.",
        "Add and subtract fractions with different denominators and mixed numbers, using the concept of equivalent fractions.",
        "Multiply simple pairs of proper fractions, writing the answer in its simplest form.",
        "Divide proper fractions by whole numbers.",
        "Associate a fraction with division and calculate decimal fraction equivalents (e.g. 0.375) for a simple fraction (e.g. 3/8).",
        "Recall and use equivalences between simple fractions, decimals and percentages, including in different contexts.",
      ],
      note: {
        title: "Year 6: different denominators, multiplying and dividing fractions",
        body: `## What you need to know

- **Simplify** a fraction by dividing the top and bottom by a **common factor** until you cannot go further: 10/15 = 2/3 (divide by 5).
- To **add or subtract** with different denominators, find a common multiple and change both fractions first.
- To **multiply** fractions, multiply the numerators and multiply the denominators, then simplify.
- To **divide a fraction by a whole number**, multiply the denominator by that number.
- A fraction is a **division**: 3/20 means 3 ÷ 20 = 0.15.

## Worked example 1: different denominators

1/4 + 2/3: use twelfths, because 4 and 3 both go into 12. 1/4 = 3/12 and 2/3 = 8/12. Then 3/12 + 8/12 = **11/12**.

## Worked example 2: multiplying and dividing

- 3/4 × 2/9 = 6/36 = **1/6** (divide by 6 to simplify).
- 1/5 ÷ 3 = 1/(5 × 3) = **1/15**.

## Worked example 3: fraction to decimal

7 ÷ 8: 8 does not go into 7, so use 7.000. 8 goes into 70 eight times (64) leaving 6; 8 into 60 seven times (56) leaving 4; 8 into 40 five times. So 7/8 = **0.875**.

| Fraction | Decimal | Percentage |
| --- | --- | --- |
| 1/4 | 0.25 | 25% |
| 1/8 | 0.125 | 12.5% |
| 7/10 | 0.7 | 70% |
| 4/5 | 0.8 | 80% |`,
      },
      quiz: {
        title: "Fractions, Decimals & Percentages: Year 6 quiz",
        questions: [
          {
            key: "frac-y6-01",
            kind: "single",
            prompt: "Work out 2/3 + 1/6. Give your answer in its simplest form.",
            options: ["3/9", "5/6", "3/6", "1/2"],
            answer: "5/6",
            explanation: "Convert 2/3 to 4/6, then 4/6 + 1/6 = 5/6, already in simplest form.",
            difficulty: 2,
            diagnostic: true,
          },
          {
            key: "frac-y6-02",
            kind: "single",
            prompt: "What is 1/4 divided by 2?",
            options: ["1/2", "1/6", "1/8", "2/4"],
            answer: "1/8",
            explanation: "Dividing a fraction by a whole number multiplies the denominator: 1/4 divided by 2 = 1/8.",
            difficulty: 2,
          },
          {
            key: "frac-y6-03",
            kind: "single",
            prompt: "Which decimal is equivalent to 3/8?",
            options: ["0.38", "0.375", "0.3", "0.83"],
            answer: "0.375",
            explanation: "3 divided by 8 = 0.375.",
            difficulty: 2,
          },
          {
            key: "frac-y6-04",
            kind: "single",
            prompt: "What is 75% as a fraction in its simplest form?",
            options: ["7/5", "3/4", "1/4", "75/10"],
            answer: "3/4",
            explanation: "75% is 75/100. Divide the top and bottom by 25 to get 3/4.",
            difficulty: 1,
          },
          {
            key: "frac-y6-05",
            kind: "single",
            prompt: "Simplify 8/12.",
            options: ["4/6", "2/3", "1/3", "4/8"],
            answer: "2/3",
            explanation: "The highest common factor of 8 and 12 is 4. Divide the top and bottom by 4 to get 2/3.",
            difficulty: 1,
          },
          {
            key: "frac-y6-06",
            kind: "number",
            prompt: "3/10 = □%. What number goes in the box?",
            answer: 30,
            explanation: "3/10 = 30/100, and 'per cent' means out of 100, so it is 30%.",
            difficulty: 1,
          },
          {
            key: "frac-y6-07",
            kind: "single",
            prompt: "Work out 2/3 × 3/5. Give your answer in its simplest form.",
            options: ["5/8", "2/5", "6/15", "1/5"],
            answer: "2/5",
            explanation: "Multiply the tops (2 × 3 = 6) and the bottoms (3 × 5 = 15) to get 6/15, then divide both by 3 to get 2/5.",
            difficulty: 2,
            diagnostic: true,
          },
          {
            key: "frac-y6-08",
            kind: "multi",
            prompt: "Which of these are equal to 3/5? Choose all that apply.",
            options: ["0.6", "60%", "6/10", "0.35", "30%"],
            answer: ["0.6", "60%", "6/10"],
            explanation: "3/5 = 6/10 (multiply top and bottom by 2), which is 0.6 and 60 out of 100, so 60%.",
            difficulty: 2,
          },
          {
            key: "frac-y6-09",
            kind: "single",
            prompt: "Work out 3/4 − 1/6.",
            options: ["2/10", "5/12", "7/12", "1/2"],
            answer: "7/12",
            explanation: "Use twelfths: 3/4 = 9/12 and 1/6 = 2/12. Then 9/12 − 2/12 = 7/12.",
            difficulty: 3,
          },
          {
            key: "frac-y6-10",
            kind: "single",
            prompt: "5 pizzas are shared equally between 8 people. What fraction of a pizza does each person get, as a decimal?",
            options: ["0.58", "0.85", "1.6", "0.625"],
            answer: "0.625",
            explanation: "Sharing 5 between 8 is 5 ÷ 8 = 5/8. Divide: 5 ÷ 8 = 0.625.",
            difficulty: 3,
          },
          {
            key: "frac-y6-11",
            kind: "single",
            prompt: "Work out 1 1/2 + 2 3/4. Give your answer as a mixed number.",
            options: ["3 4/6", "4 1/4", "3 1/4", "4 1/2"],
            answer: "4 1/4",
            explanation: "Add the wholes: 1 + 2 = 3. Add the fractions: 1/2 = 2/4, so 2/4 + 3/4 = 5/4 = 1 1/4. Then 3 + 1 1/4 = 4 1/4.",
            difficulty: 3,
          },
        ],
      },
      flashcards: [
        { front: "How do you simplify a fraction?", back: "Divide the top and bottom by a common factor, repeating until you cannot any more." },
        { front: "Simplify 10/15", back: "2/3 (divide both by 5)" },
        { front: "How do you add fractions with different denominators?", back: "Find a common multiple, rewrite both as equivalent fractions, then add the numerators." },
        { front: "1/4 + 2/3", back: "3/12 + 8/12 = 11/12" },
        { front: "How do you multiply two fractions?", back: "Multiply the numerators, multiply the denominators, then simplify." },
        { front: "How do you divide a fraction by a whole number?", back: "Multiply the denominator by that number: 1/5 ÷ 3 = 1/15." },
        { front: "What does a fraction mean as a division?", back: "3/20 means 3 ÷ 20 = 0.15." },
        { front: "1/8 as a decimal and a percentage", back: "0.125 and 12.5%" },
        { front: "1/4 as a decimal and a percentage", back: "0.25 and 25%" },
        { front: "1/3 and 2/3 as decimals", back: "0.333... and 0.666... (they never end)" },
        { front: "7/10, 4/5 as percentages", back: "70% and 80%" },
      ],
    },
  },
};

export default TOPIC;
