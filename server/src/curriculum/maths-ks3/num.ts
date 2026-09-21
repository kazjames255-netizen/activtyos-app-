// KS3 Maths — Number (Years 7–9). Original content aligned to the DfE National Curriculum KS3 programme of study (OGL v3.0).
// Answer keys are recomputed by _check_m2.ts — re-run it after ANY edit here.
import type { CTopic } from "../types";

export const TOPIC: CTopic = {
  key: "num",
  topic: "Number",
  subject: "Maths",
  years: {
    7: {
      year: 7,
      objectives: [
        "Order positive and negative integers, decimals and fractions; use the number line and the four operations with negative numbers.",
        "Use the concepts and vocabulary of factors, multiples, primes, highest common factor and lowest common multiple; write a number as a product of prime factors.",
        "Use the order of operations (BIDMAS), including brackets and powers.",
        "Move between fractions, decimals and percentages and compare them.",
      ],
      note: {
        title: "Year 7: negatives, factors and primes, BIDMAS and equivalences",
        body: `## What you need to know

- **Negative numbers:** on a number line, adding moves right and subtracting moves left. Subtracting a negative is the same as adding: 5 − (−2) = 7.
- **Factors** divide exactly into a number (factors of 12: 1, 2, 3, 4, 6, 12). **Multiples** are in its times table.
- A **prime** has exactly two factors, 1 and itself. 1 is not prime.
- **HCF** = highest common factor. **LCM** = lowest common multiple.
- **BIDMAS:** Brackets, Indices, Division and Multiplication, Addition and Subtraction.

## Worked example 1: prime factors

Split 60 into primes using a factor tree: 60 = 6 × 10 = 2 × 3 × 2 × 5, so 60 = **2² × 3 × 5**.

## Worked example 2: HCF and LCM of 12 and 18

Factors of 12: 1, 2, 3, 4, 6, 12. Factors of 18: 1, 2, 3, 6, 9, 18. The biggest shared one is the **HCF = 6**.
Multiples of 12: 12, 24, 36. Multiples of 18: 18, 36. The first shared one is the **LCM = 36**.

## Worked example 3: BIDMAS

10 − 2 × 3² = 10 − 2 × 9 = 10 − 18 = **−8**. (Powers first, then multiplying, then subtracting.)

| Fraction | Decimal | Percentage |
| --- | --- | --- |
| 1/2 | 0.5 | 50% |
| 1/4 | 0.25 | 25% |
| 3/4 | 0.75 | 75% |
| 1/5 | 0.2 | 20% |`,
      },
      quiz: {
        title: "Number: Year 7 quiz",
        questions: [
          {
            key: "num-y7-01",
            kind: "single",
            prompt: "Work out −3 − 5.",
            options: ["−2", "8", "−8", "2"],
            answer: "−8",
            explanation: "Subtracting 5 moves 5 steps down the number line from −3, which ends at −8.",
            difficulty: 1,
          },
          {
            key: "num-y7-02",
            kind: "single",
            prompt: "Which of these numbers is a prime number?",
            options: ["21", "27", "31", "39"],
            answer: "31",
            explanation: "31 has no factors except 1 and itself. The others are not prime: 21 = 3 × 7, 27 = 3 × 9 and 39 = 3 × 13.",
            difficulty: 1,
          },
          {
            key: "num-y7-03",
            kind: "number",
            prompt: "Work out 7 + 3 × 4.",
            answer: 19,
            explanation: "BIDMAS says multiply before adding: 3 × 4 = 12, then 7 + 12 = 19.",
            difficulty: 1,
          },
          {
            key: "num-y7-04",
            kind: "single",
            prompt: "The arrow points to a number on this number line. Which number is it?",
            options: ["−2.5", "−1.5", "−0.5", "−1.25"],
            answer: "−1.5",
            explanation: "Each small step is 0.5. The arrow sits exactly halfway between −2 and −1, so it points to −1.5.",
            difficulty: 2,
            image: { file: "num-y7-numberline.png", alt: "A number line from −3 to 1 with tick marks every 0.5 and whole numbers labelled. An arrow points to a mark halfway between −2 and −1." },
          },
          {
            key: "num-y7-05",
            kind: "short",
            prompt: "Write 0.35 as a fraction in its simplest form.",
            answer: "7/20",
            accepted: ["7/20", "7 / 20"],
            explanation: "0.35 = 35/100. Divide the top and bottom by 5 to get 7/20.",
            difficulty: 2,
          },
          {
            key: "num-y7-06",
            kind: "multi",
            prompt: "Which of these numbers are factors of 36? Select all that apply.",
            options: ["4", "8", "9", "12", "14"],
            answer: ["4", "9", "12"],
            explanation: "36 ÷ 4 = 9, 36 ÷ 9 = 4 and 36 ÷ 12 = 3 all divide exactly. 36 ÷ 8 and 36 ÷ 14 leave remainders.",
            difficulty: 2,
          },
          {
            key: "num-y7-07",
            kind: "number",
            prompt: "What is the lowest common multiple (LCM) of 6 and 8?",
            answer: 24,
            explanation: "Multiples of 6: 6, 12, 18, 24. Multiples of 8: 8, 16, 24. The first number in both lists is 24.",
            difficulty: 2,
            diagnostic: true,
          },
          {
            key: "num-y7-08",
            kind: "single",
            prompt: "Which of these is the largest?",
            options: ["0.38", "39%", "2/5", "3/8"],
            answer: "2/5",
            explanation: "Change each to a decimal: 0.38, 0.39, 0.4 and 0.375. The largest is 0.4, which is 2/5.",
            difficulty: 2,
            diagnostic: true,
          },
          {
            key: "num-y7-09",
            kind: "single",
            prompt: "Work out (12 − 4)² ÷ 2 + 3.",
            options: ["7", "35", "32", "67"],
            answer: "35",
            explanation: "Brackets first: 8. Then the power: 8² = 64. Then divide: 64 ÷ 2 = 32. Finally add 3 to get 35.",
            difficulty: 3,
          },
          {
            key: "num-y7-10",
            kind: "short",
            prompt: "Write 84 as a product of its prime factors. You may use powers.",
            answer: "2² × 3 × 7",
            accepted: ["2 × 2 × 3 × 7", "2×2×3×7", "2^2 × 3 × 7", "2^2×3×7", "2²×3×7", "2 x 2 x 3 x 7", "2² x 3 x 7", "2*2*3*7", "2^2 x 3 x 7", "2^2x3x7", "2^2*3*7", "2 * 2 * 3 * 7", "7 × 3 × 2 × 2", "3 × 7 × 2²"],
            explanation: "Split 84 = 2 × 42 = 2 × 2 × 21 = 2 × 2 × 3 × 7. Every factor is prime, so 84 = 2² × 3 × 7.",
            difficulty: 3,
          },
        ],
      },
      flashcards: [
        { front: "What is a prime number?", back: "A number with exactly two factors: 1 and itself (2, 3, 5, 7, 11 ...). 1 is not prime." },
        { front: "What does BIDMAS stand for?", back: "Brackets, Indices, Division and Multiplication, Addition and Subtraction." },
        { front: "−4 − 3 = ?", back: "−7 (move 3 steps left of −4)" },
        { front: "5 − (−2) = ?", back: "7 (subtracting a negative is the same as adding)" },
        { front: "What is the LCM of two numbers?", back: "The lowest common multiple: the smallest number that is in both times tables." },
        { front: "What is the HCF of two numbers?", back: "The highest common factor: the biggest number that divides exactly into both." },
        { front: "All the factors of 12", back: "1, 2, 3, 4, 6, 12" },
        { front: "Square numbers up to 12²", back: "1, 4, 9, 16, 25, 36, 49, 64, 81, 100, 121, 144" },
        { front: "3/4 as a decimal and a percentage", back: "0.75 and 75%" },
        { front: "0.2 as a fraction in simplest form", back: "1/5" },
      ],
    },
    8: {
      year: 8,
      objectives: [
        "Use integer powers and associated real roots (square, cube); calculate with roots and indices.",
        "Interpret and compare numbers in standard form A × 10ⁿ, 1 ≤ A < 10, including small numbers.",
        "Round numbers to decimal places and significant figures; estimate answers.",
        "Calculate with fractions and find fractions of amounts; solve percentage change problems.",
      ],
      note: {
        title: "Year 8: powers, standard form, rounding and percentage change",
        body: `## What you need to know

- **Powers and roots:** 5³ = 5 × 5 × 5 = 125, and √121 = 11 because 11 × 11 = 121.
- **Standard form** writes big or small numbers as **A × 10ⁿ**, where A is at least 1 but less than 10. Big numbers have a positive n, small numbers a negative n.
- **Significant figures (s.f.):** count from the first non-zero digit.
- **Percentage change** = change ÷ original × 100.

## Worked example 1: standard form

7,300,000 = 7.3 × 10⁶ (the point moves 6 places). 0.00081 = 8.1 × 10⁻⁴ (the point moves 4 places the other way).

## Worked example 2: percentage change

A game costs £50 and rises to £56. Change = £6. 6 ÷ 50 = 0.12, so it is a **12% increase**. For a 30% decrease of £60: 10% = £6, so 30% = £18 and the new price is £42.

## Worked example 3: estimating

Estimate 6.2 × 19 by rounding to 1 s.f.: 6 × 20 = **120**.

| Number | 2 s.f. |
| --- | --- |
| 0.03864 | 0.039 |
| 6,180 | 6,200 |`,
      },
      quiz: {
        title: "Number: Year 8 quiz",
        questions: [
          {
            key: "num-y8-01",
            kind: "single",
            prompt: "What is √144?",
            options: ["12", "14", "72", "24"],
            answer: "12",
            explanation: "The square root asks: which number times itself makes 144? 12 × 12 = 144.",
            difficulty: 1,
          },
          {
            key: "num-y8-02",
            kind: "single",
            prompt: "What is 4³?",
            options: ["12", "16", "81", "64"],
            answer: "64",
            explanation: "4³ means 4 × 4 × 4. 4 × 4 = 16 and 16 × 4 = 64. It is not 4 × 3.",
            difficulty: 1,
          },
          {
            key: "num-y8-03",
            kind: "number",
            prompt: "What is 3/5 of £45? Give your answer in pounds.",
            answer: 27,
            explanation: "Divide by the bottom number: 45 ÷ 5 = 9. Multiply by the top number: 9 × 3 = 27.",
            difficulty: 1,
          },
          {
            key: "num-y8-04",
            kind: "single",
            prompt: "Write 4,500,000 in standard form.",
            options: ["45 × 10⁵", "4.5 × 10⁶", "4.5 × 10⁵", "0.45 × 10⁷"],
            answer: "4.5 × 10⁶",
            explanation: "Standard form needs a number from 1 up to 10. Moving the decimal point 6 places gives 4.5 × 10⁶.",
            difficulty: 2,
            diagnostic: true,
          },
          {
            key: "num-y8-05",
            kind: "single",
            prompt: "Round 0.04729 to 2 significant figures.",
            options: ["0.05", "0.0473", "0.047", "0.04"],
            answer: "0.047",
            explanation: "The first significant figure is the 4 (zeros at the start do not count). Two s.f. gives 0.047, and the next digit 2 means round down.",
            difficulty: 2,
          },
          {
            key: "num-y8-06",
            kind: "number",
            prompt: "A jacket costs £80. In a sale it is reduced by 15%. What is the sale price in pounds?",
            answer: 68,
            explanation: "10% of 80 = 8 and 5% = 4, so 15% = 12. The sale price is 80 − 12 = £68.",
            difficulty: 2,
            diagnostic: true,
          },
          {
            key: "num-y8-07",
            kind: "single",
            prompt: "Estimate 4.8 × 31 ÷ 0.51 by rounding each number to 1 significant figure.",
            options: ["300", "30", "3,000", "75"],
            answer: "300",
            explanation: "Round to 5 × 30 ÷ 0.5. 5 × 30 = 150 and dividing by 0.5 doubles it to give 300.",
            difficulty: 2,
          },
          {
            key: "num-y8-08",
            kind: "short",
            prompt: "Work out 2/3 + 3/4. Give your answer as a mixed number.",
            answer: "1 5/12",
            accepted: ["1 5/12", "17/12"],
            explanation: "Use a common denominator of 12: 8/12 + 9/12 = 17/12, which is 1 whole and 5/12.",
            difficulty: 2,
          },
          {
            key: "num-y8-09",
            kind: "number",
            prompt: "A phone price rises from £250 to £290. What is the percentage increase? Type the number only, without the % sign.",
            answer: 16,
            explanation: "The increase is £40. Percentage change = 40 ÷ 250 × 100 = 16%.",
            difficulty: 3,
          },
          {
            key: "num-y8-10",
            kind: "single",
            prompt: "Work out (2 × 10⁴) × (3.5 × 10³) and give the answer in standard form.",
            options: ["7 × 10¹²", "5.5 × 10⁷", "70 × 10⁶", "7 × 10⁷"],
            answer: "7 × 10⁷",
            explanation: "Multiply the numbers: 2 × 3.5 = 7. Add the powers: 4 + 3 = 7. So the answer is 7 × 10⁷.",
            difficulty: 3,
          },
        ],
      },
      flashcards: [
        { front: "√169 = ?", back: "13 (because 13 × 13 = 169)" },
        { front: "The cube numbers up to 10³", back: "1, 8, 27, 64, 125, 216, 343, 512, 729, 1000" },
        { front: "Standard form: what is the rule for A in A × 10ⁿ?", back: "1 ≤ A < 10" },
        { front: "0.0035 in standard form", back: "3.5 × 10⁻³" },
        { front: "How do you find a percentage change?", back: "change ÷ original × 100" },
        { front: "How do you find 15% of an amount quickly?", back: "Find 10% (÷10) and 5% (half of that), then add them" },
        { front: "What is a significant figure?", back: "A digit counted from the first non-zero digit (zeros at the start do not count)" },
        { front: "To estimate, round each number to ...", back: "1 significant figure, then calculate" },
        { front: "To add fractions you need ...", back: "A common denominator" },
        { front: "To multiply numbers in standard form", back: "Multiply the A parts and add the powers of 10" },
      ],
    },
    9: {
      year: 9,
      objectives: [
        "Use the laws of indices, including negative and zero indices, and calculate with numbers in standard form.",
        "Use prime factorisation to find HCF and LCM.",
        "Understand rounding and simple bounds (error intervals) for measurements and rounded numbers.",
        "Solve reverse percentage problems.",
      ],
      note: {
        title: "Year 9: index laws, standard form calculations, bounds and reverse percentages",
        body: `## What you need to know

**Laws of indices** (same base):
- Multiply: aᵐ × aⁿ = aᵐ⁺ⁿ, so 2⁵ × 2² = 2⁷.
- Divide: aᵐ ÷ aⁿ = aᵐ⁻ⁿ, so b⁹ ÷ b⁴ = b⁵.
- Power of a power: (aᵐ)ⁿ = aᵐⁿ.
- Zero power: a⁰ = 1. Negative power: a⁻ⁿ = 1/aⁿ, so 10⁻² = 1/100.

## Worked example 1: bounds

A mass is 40 g to the nearest gram. It could be anything from 39.5 up to (but not including) 40.5, written **39.5 ≤ m < 40.5**. The margin either side is half of the unit.

## Worked example 2: reverse percentage

After a 25% discount a coat costs £60. The sale price is 75% of the original, so 75% = £60. 1% = £0.80 and 100% = **£80**.

## Worked example 3: HCF and LCM by primes

12 = 2² × 3 and 18 = 2 × 3². HCF uses the smallest powers: 2 × 3 = 6. LCM uses the biggest powers: 2² × 3² = 36.

| Rule | Example |
| --- | --- |
| aᵐ × aⁿ | 5² × 5³ = 5⁵ |
| a⁰ | 9⁰ = 1 |`,
      },
      quiz: {
        title: "Number: Year 9 quiz",
        questions: [
          {
            key: "num-y9-01",
            kind: "single",
            prompt: "Simplify 3⁴ × 3².",
            options: ["3⁸", "3⁶", "9⁶", "9⁸"],
            answer: "3⁶",
            explanation: "When you multiply powers of the same base, add the indices: 4 + 2 = 6, so the answer is 3⁶. The base stays 3.",
            difficulty: 1,
          },
          {
            key: "num-y9-02",
            kind: "number",
            prompt: "What is the value of 5⁰?",
            answer: 1,
            explanation: "Any non-zero number to the power 0 equals 1, because aⁿ ÷ aⁿ = 1 and also equals a⁰.",
            difficulty: 1,
          },
          {
            key: "num-y9-03",
            kind: "single",
            prompt: "What is 2⁻³ as a fraction?",
            options: ["−8", "−6", "1/6", "1/8"],
            answer: "1/8",
            explanation: "A negative power means take the reciprocal: 2⁻³ = 1/2³ = 1/8. It does not make the answer negative.",
            difficulty: 1,
          },
          {
            key: "num-y9-04",
            kind: "single",
            prompt: "Simplify a⁷ ÷ a³.",
            options: ["a¹⁰", "a²¹", "a⁴", "a³"],
            answer: "a⁴",
            explanation: "When dividing powers of the same base, subtract the indices: 7 − 3 = 4.",
            difficulty: 2,
            diagnostic: true,
          },
          {
            key: "num-y9-05",
            kind: "number",
            prompt: "Work out (3 × 10⁵) ÷ (6 × 10²). Give your answer as an ordinary number.",
            answer: 500,
            explanation: "Divide the numbers: 3 ÷ 6 = 0.5. Subtract the powers: 10⁵ ÷ 10² = 10³. So 0.5 × 1,000 = 500.",
            difficulty: 2,
          },
          {
            key: "num-y9-06",
            kind: "single",
            prompt: "Write 2.4 × 10⁻³ as an ordinary number.",
            options: ["0.024", "0.0024", "0.00024", "2,400"],
            answer: "0.0024",
            explanation: "A power of −3 means move the decimal point 3 places to the left: 2.4 becomes 0.0024.",
            difficulty: 2,
          },
          {
            key: "num-y9-07",
            kind: "number",
            prompt: "The length of a rod is 12 cm to the nearest cm. What is the smallest length, in cm, that it could be?",
            answer: 11.5,
            explanation: "Rounding to the nearest cm means the true length is within 0.5 cm of 12, so the smallest possible length is 11.5 cm.",
            difficulty: 2,
            diagnostic: true,
          },
          {
            key: "num-y9-08",
            kind: "number",
            prompt: "84 = 2² × 3 × 7 and 126 = 2 × 3² × 7. Use these to find the HCF of 84 and 126.",
            answer: 42,
            explanation: "For the HCF take the smaller power of each prime: 2¹ × 3¹ × 7¹ = 42.",
            difficulty: 2,
          },
          {
            key: "num-y9-09",
            kind: "single",
            prompt: "A number x rounds to 6.4 to 1 decimal place. Which inequality gives the possible values of x?",
            options: ["6.3 ≤ x < 6.5", "6.4 ≤ x < 6.5", "6.35 < x ≤ 6.45", "6.35 ≤ x < 6.45"],
            answer: "6.35 ≤ x < 6.45",
            explanation: "1 d.p. means within 0.05 either side. 6.35 rounds up to 6.4 so it is included, but 6.45 rounds up to 6.5 so it is not.",
            difficulty: 3,
          },
          {
            key: "num-y9-10",
            kind: "number",
            prompt: "After a 20% reduction, a pair of trainers costs £36. What was the original price in pounds?",
            answer: 45,
            explanation: "The sale price is 80% of the original, so 80% = £36. Then 1% = £0.45 and 100% = £45. Do not add 20% to £36.",
            difficulty: 3,
          },
        ],
      },
      flashcards: [
        { front: "aᵐ × aⁿ = ?", back: "aᵐ⁺ⁿ (add the indices)" },
        { front: "aᵐ ÷ aⁿ = ?", back: "aᵐ⁻ⁿ (subtract the indices)" },
        { front: "(aᵐ)ⁿ = ?", back: "aᵐⁿ (multiply the indices)" },
        { front: "a⁰ = ?", back: "1" },
        { front: "a⁻ⁿ = ?", back: "1/aⁿ" },
        { front: "5⁻² = ?", back: "1/25" },
        { front: "30 m, to the nearest metre: lower and upper bounds", back: "29.5 m and 30.5 m (the upper bound is not included)" },
        { front: "How do you find HCF from prime factors?", back: "Multiply the smallest power of each shared prime" },
        { front: "How do you find LCM from prime factors?", back: "Multiply the biggest power of every prime that appears" },
        { front: "After a 20% decrease the price is 80% of the original. How do you find the original?", back: "Divide by 0.8 (or find 1% then multiply by 100)" },
      ],
    },
  },
};
