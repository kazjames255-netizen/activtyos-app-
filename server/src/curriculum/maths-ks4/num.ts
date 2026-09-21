// GCSE Maths — Number (Years 10–11). Original content aligned to the DfE GCSE mathematics subject content (OGL v3.0).
// Answer keys are recomputed by _check_m3.ts — re-run it after ANY edit here.
import type { CTopic } from "../types";

export const TOPIC: CTopic = {
  key: "num",
  topic: "Number",
  subject: "Maths",
  years: {
    10: {
      year: 10,
      objectives: [
        "Express a number as a product of prime factors; find the HCF and LCM of two numbers.",
        "Add, subtract, multiply and divide fractions and mixed numbers.",
        "Use the laws of indices, including zero, negative and fractional indices.",
        "Write numbers in standard form and calculate with them.",
        "Round to significant figures and estimate by rounding to 1 significant figure.",
      ],
      note: {
        title: "Year 10 Number: primes, fractions, indices and standard form",
        body: `## What you need to know

**Prime factors.** Every whole number above 1 is a product of primes in exactly one way. Use a factor tree. The **HCF** uses the primes both numbers share (lowest powers); the **LCM** uses every prime (highest powers).

**Fractions.** Add and subtract with a common denominator. To multiply, multiply tops and bottoms. To divide, **flip the second fraction and multiply**. Turn mixed numbers into improper fractions first.

**Indices.** Laws: aᵐ × aⁿ = aᵐ⁺ⁿ, aᵐ ÷ aⁿ = aᵐ⁻ⁿ, (aᵐ)ⁿ = aᵐⁿ. Also a⁰ = 1, a⁻ⁿ = 1/aⁿ and a^(1/n) is the nth root of a.

**Standard form** is A × 10ⁿ with 1 ≤ A < 10 and n an integer.

## Worked example 1: HCF and LCM
72 = 2³ × 3² and 120 = 2³ × 3 × 5. HCF = 2³ × 3 = **24**. LCM = 2³ × 3² × 5 = **360**.

## Worked example 2: a fractional index
8^(2/3): take the cube root first (2), then square it: **4**.

## Worked example 3: standard form
(4 × 10⁵) × (3 × 10⁻²) = 12 × 10³ = **1.2 × 10⁴** (the 12 must be rewritten so that A is below 10).

| Rule | Example |
| --- | --- |
| aᵐ × aⁿ = aᵐ⁺ⁿ | 2³ × 2⁴ = 2⁷ |
| a⁻ⁿ = 1/aⁿ | 5⁻² = 1/25 |
| a^(1/n) = ⁿ√a | 64^(1/3) = 4 |
| 1 s.f. estimate | 48 × 21 ≈ 50 × 20 = 1000 |`,
      },
      quiz: {
        title: "Number: Year 10 GCSE quiz",
        questions: [
          {
            key: "num-y10-01", kind: "single", difficulty: 1,
            prompt: "Write 84 as a product of prime factors.",
            options: ["2 × 3 × 14", "4 × 21", "2² × 3 × 7", "2² × 3² × 7"],
            answer: "2² × 3 × 7",
            explanation: "Divide by primes: 84 = 2 × 42 = 2 × 2 × 21 = 2 × 2 × 3 × 7, so 2² × 3 × 7. The other options contain a non-prime (14 or 4 or 21) or give the wrong product.",
          },
          {
            key: "num-y10-02", kind: "number", difficulty: 1,
            prompt: "Find the highest common factor (HCF) of 36 and 60.",
            answer: 12,
            explanation: "36 = 2² × 3² and 60 = 2² × 3 × 5. Multiply the primes they share, using the lower power each time: 2² × 3 = 12.",
          },
          {
            key: "num-y10-03", kind: "number", difficulty: 2,
            prompt: "Two lighthouses flash together at midnight. One flashes every 12 seconds and the other every 18 seconds. After how many seconds do they next flash together?",
            answer: 36,
            explanation: "This is the lowest common multiple. 12 = 2² × 3 and 18 = 2 × 3², so the LCM is 2² × 3² = 36.",
          },
          {
            key: "num-y10-04", kind: "single", difficulty: 2, diagnostic: true,
            prompt: "Work out 2 3/5 + 1 1/2.",
            options: ["3 4/7", "4 1/10", "3 1/10", "4 2/5"],
            answer: "4 1/10",
            explanation: "Add the wholes: 2 + 1 = 3. Add the fractions: 3/5 + 1/2 = 6/10 + 5/10 = 11/10 = 1 1/10. Total 4 1/10.",
          },
          {
            key: "num-y10-05", kind: "single", difficulty: 2, diagnostic: true,
            prompt: "Write 0.00045 in standard form.",
            options: ["4.5 × 10⁴", "45 × 10⁻⁵", "4.5 × 10⁻³", "4.5 × 10⁻⁴"],
            answer: "4.5 × 10⁻⁴",
            explanation: "Move the decimal point 4 places right to get 4.5, so the power of 10 is −4. (45 × 10⁻⁵ has A above 10, so it is not standard form.)",
          },
          {
            key: "num-y10-06", kind: "number", difficulty: 2,
            prompt: "(2⁵ × 2³) ÷ 2⁴ = 2ⁿ. Find n.",
            answer: 4,
            explanation: "Add the powers when multiplying: 2⁵ × 2³ = 2⁸. Subtract when dividing: 2⁸ ÷ 2⁴ = 2⁴, so n = 4.",
          },
          {
            key: "num-y10-07", kind: "number", difficulty: 2,
            prompt: "Estimate the value of (4.87 × 19.6) ÷ 0.52 by rounding each number to 1 significant figure.",
            answer: 200,
            explanation: "Round to 5 × 20 ÷ 0.5 = 100 ÷ 0.5 = 200. Dividing by 0.5 doubles the number.",
          },
          {
            key: "num-y10-08", kind: "single", difficulty: 2,
            prompt: "Round 0.03047 to 2 significant figures.",
            options: ["0.30", "0.031", "0.0305", "0.030"],
            answer: "0.030",
            explanation: "Significant figures start at the first non-zero digit (the 3). The 2nd is 0 and the next digit 4 is below 5, so round down: 0.030.",
          },
          {
            key: "num-y10-09", kind: "number", difficulty: 3,
            prompt: "Work out (3.2 × 10⁵) × (2.5 × 10⁻²). Give your answer as an ordinary number. Type your answer as digits with no comma.",
            answer: 8000,
            explanation: "Multiply the numbers: 3.2 × 2.5 = 8. Add the powers: 10⁵ × 10⁻² = 10³. So 8 × 10³ = 8000.",
          },
          {
            key: "num-y10-10", kind: "single", difficulty: 2,
            prompt: "Work out 3/4 ÷ 2/3.",
            options: ["1/2", "8/9", "9/8", "5/7"],
            answer: "9/8",
            explanation: "To divide, flip the second fraction and multiply: 3/4 × 3/2 = 9/8 (or 1 1/8).",
          },
          {
            key: "num-y10-11", kind: "short", difficulty: 3,
            prompt: "Work out 16^(−3/4) as a fraction.",
            answer: "1/8",
            accepted: ["0.125", "one eighth", "1 / 8"],
            explanation: "The 4th root of 16 is 2, and cubing gives 8. The negative sign means reciprocal, so 16^(−3/4) = 1/8.",
          },
          {
            key: "num-y10-12", kind: "number", difficulty: 3,
            prompt: "(6 × 10⁹) ÷ (1.5 × 10⁻³) = 4 × 10ⁿ. Find n.",
            answer: 12,
            explanation: "6 ÷ 1.5 = 4. For the powers, subtract: 9 − (−3) = 12. So the answer is 4 × 10¹².",
          },
          {
            key: "num-y10-13", kind: "number", difficulty: 3,
            prompt: "N = 2³ × 3² × 5. How many different factors does N have?",
            answer: 24,
            explanation: "Add 1 to each power and multiply: (3 + 1)(2 + 1)(1 + 1) = 4 × 3 × 2 = 24 factors.",
          },
        ],
      },
      flashcards: [
        { front: "How do you find the HCF from prime factors?", back: "Multiply the primes both numbers share, using the lowest power of each." },
        { front: "How do you find the LCM from prime factors?", back: "Multiply every prime that appears, using the highest power of each." },
        { front: "Dividing fractions: a/b ÷ c/d", back: "Flip the second fraction and multiply: a/b × d/c." },
        { front: "Indices: aᵐ × aⁿ", back: "aᵐ⁺ⁿ (add the powers)." },
        { front: "Indices: aᵐ ÷ aⁿ", back: "aᵐ⁻ⁿ (subtract the powers)." },
        { front: "Indices: (aᵐ)ⁿ", back: "aᵐⁿ (multiply the powers)." },
        { front: "a⁰ = ?", back: "1 (for any a other than 0)." },
        { front: "a⁻ⁿ = ?", back: "1/aⁿ (the reciprocal of aⁿ)." },
        { front: "a^(1/n) means…", back: "The nth root of a, e.g. 64^(1/3) = 3rd root of 64 = 4." },
        { front: "Standard form rule", back: "A × 10ⁿ where 1 ≤ A < 10 and n is an integer." },
        { front: "Number of factors from prime factorisation p^a × q^b", back: "(a + 1)(b + 1)." },
        { front: "Estimating a calculation", back: "Round each number to 1 significant figure, then calculate." },
      ],
    },
    11: {
      year: 11,
      objectives: [
        "Simplify surds and rationalise denominators; calculate with surds.",
        "Recognise rational and irrational numbers.",
        "Convert recurring decimals to fractions.",
        "Find upper and lower bounds and error intervals; calculate with bounds.",
        "Use exact values and give answers in surd form.",
      ],
      note: {
        title: "Year 11 Number: surds, recurring decimals and bounds",
        body: `## What you need to know

**Surds** are roots that do not simplify to whole numbers, such as √2. They are irrational, so we keep them exact.
- √a × √b = √(ab) and √a ÷ √b = √(a/b)
- Simplify by pulling out square factors: √75 = √25 × √3 = 5√3.
- **Rationalise** a denominator by multiplying top and bottom by the surd: 10/√5 = 10√5/5 = 2√5. For 1/(a + √b) multiply by the **conjugate** (a − √b), because (a + √b)(a − √b) = a² − b.

**Recurring decimals.** Let x = 0.4545…, then 100x = 45.4545…, so 99x = 45 and x = 5/11.

**Bounds.** A length of 6 cm to the nearest cm lies in the error interval 5.5 ≤ L < 6.5.
- Upper bound of a + b: add the upper bounds. Lower bound of a − b: lower bound of a minus upper bound of b.
- Upper bound of a ÷ b: upper bound of a divided by the **lower** bound of b.

## Worked example
Rationalise 1/(3 − √2): multiply by (3 + √2)/(3 + √2). The bottom becomes 9 − 2 = 7, so the answer is (3 + √2)/7.

| Fact | Example |
| --- | --- |
| √a × √a = a | (√7)² = 7 |
| (a + √b)(a − √b) = a² − b | (5 + √3)(5 − √3) = 22 |
| Half-unit bounds | 7.8 to 1 d.p.: 7.75 ≤ x < 7.85 |`,
      },
      quiz: {
        title: "Number: Year 11 GCSE quiz",
        questions: [
          {
            key: "num-y11-01", kind: "single", difficulty: 1,
            prompt: "Simplify √50.",
            options: ["25√2", "5√2", "2√5", "10√5"],
            answer: "5√2",
            explanation: "50 = 25 × 2 and √25 = 5, so √50 = 5√2.",
          },
          {
            key: "num-y11-02", kind: "single", difficulty: 1,
            prompt: "Which of these numbers is irrational?",
            options: ["√49", "3/8", "0.333… (3 recurring)", "√7"],
            answer: "√7",
            explanation: "An irrational number cannot be written as a fraction. √49 = 7, 3/8 is a fraction and 0.333… = 1/3. But 7 is not a square number, so √7 is irrational.",
          },
          {
            key: "num-y11-03", kind: "number", difficulty: 1,
            prompt: "Work out √12 × √3.",
            answer: 6,
            explanation: "Multiply under the root: √12 × √3 = √36 = 6.",
          },
          {
            key: "num-y11-04", kind: "number", difficulty: 2, diagnostic: true,
            prompt: "Expand and simplify (3 + √2)(3 − √2).",
            answer: 7,
            explanation: "This is a difference of two squares: 3² − (√2)² = 9 − 2 = 7. The surd terms cancel.",
          },
          {
            key: "num-y11-05", kind: "short", difficulty: 2, diagnostic: true,
            prompt: "Write the recurring decimal 0.272727… (the digits 27 repeat) as a fraction in its simplest form.",
            answer: "3/11",
            accepted: ["3 / 11"],
            explanation: "Let x = 0.2727…. Then 100x = 27.2727…, so 99x = 27 and x = 27/99 = 3/11.",
          },
          {
            key: "num-y11-06", kind: "single", difficulty: 2,
            prompt: "Rationalise the denominator of 6/√3.",
            options: ["√3/2", "6√3", "2√3", "3√2"],
            answer: "2√3",
            explanation: "Multiply top and bottom by √3: 6√3/3 = 2√3.",
          },
          {
            key: "num-y11-07", kind: "single", difficulty: 2,
            prompt: "A length L is 12.4 cm, correct to 1 decimal place. Which is its error interval?",
            options: ["12.4 ≤ L < 12.5", "12.3 ≤ L < 12.5", "12.35 < L ≤ 12.45", "12.35 ≤ L < 12.45"],
            answer: "12.35 ≤ L < 12.45",
            explanation: "Rounding to 1 d.p. means half of 0.1 either side: 12.4 ± 0.05. The lower bound is included and the upper bound is not (it would round up).",
          },
          {
            key: "num-y11-08", kind: "number", difficulty: 2,
            prompt: "A rectangle is 8 cm by 5 cm, both measurements given to the nearest cm. Work out the upper bound of its area, in cm².",
            answer: 46.75,
            explanation: "The upper bounds are 8.5 and 5.5, so the largest possible area is 8.5 × 5.5 = 46.75 cm².",
          },
          {
            key: "num-y11-09", kind: "number", difficulty: 2,
            prompt: "Work out (2√3)².",
            answer: 12,
            explanation: "Square both the 2 and the √3: 2² × (√3)² = 4 × 3 = 12.",
          },
          {
            key: "num-y11-10", kind: "single", difficulty: 3,
            prompt: "Simplify √18 + √50 − √8.",
            options: ["√60", "6√2", "10√2", "6√8"],
            answer: "6√2",
            explanation: "Simplify each: √18 = 3√2, √50 = 5√2, √8 = 2√2. Then 3√2 + 5√2 − 2√2 = 6√2. You cannot add the numbers under the roots (√60 is wrong).",
          },
          {
            key: "num-y11-11", kind: "single", difficulty: 3,
            prompt: "Rationalise the denominator of 1/(2 − √3).",
            options: ["2 − √3", "1 + √3", "(2 + √3)/7", "2 + √3"],
            answer: "2 + √3",
            explanation: "Multiply top and bottom by the conjugate (2 + √3). The bottom is 2² − 3 = 1, so the result is 2 + √3.",
          },
          {
            key: "num-y11-12", kind: "number", difficulty: 3, tolerance: 0.01,
            prompt: "A runner covers 120 m (to the nearest 10 m) in 15 s (to the nearest second). Work out the lowest possible average speed in m/s, correct to 2 decimal places.",
            answer: 7.42,
            explanation: "Lowest speed = smallest distance ÷ longest time = 115 ÷ 15.5 = 7.419… ≈ 7.42 m/s.",
          },
          {
            key: "num-y11-13", kind: "written", difficulty: 3, marks: 3,
            prompt: "A rectangle has sides (3 + √5) cm and (3 − √5) cm. Show that its area and its perimeter are both whole numbers.",
            answer: "Area = (3 + √5)(3 − √5) = 9 − 5 = 4 cm². Perimeter = 2 × [(3 + √5) + (3 − √5)] = 2 × 6 = 12 cm.",
            explanation: "Mark scheme (3 marks): 1 for the area as a product; 1 for the difference of two squares 9 − 5 = 4; 1 for the perimeter 2(3 + √5 + 3 − √5) = 12, showing the surds cancel.",
          },
        ],
      },
      flashcards: [
        { front: "√a × √b", back: "√(ab)" },
        { front: "√a ÷ √b", back: "√(a/b)" },
        { front: "Simplify √72", back: "6√2 (72 = 36 × 2)." },
        { front: "How do you rationalise 1/√a?", back: "Multiply top and bottom by √a to get √a/a." },
        { front: "How do you rationalise 1/(a + √b)?", back: "Multiply top and bottom by the conjugate (a − √b); the bottom becomes a² − b." },
        { front: "Rational vs irrational", back: "Rational numbers can be written as a fraction of integers; irrational ones (like √2 and π) cannot." },
        { front: "0.7 recurring as a fraction", back: "7/9" },
        { front: "Method for a recurring decimal", back: "Let x = the decimal, multiply by 10ⁿ to shift one full repeat, subtract, then divide." },
        { front: "Error interval for 3.4 to 1 d.p.", back: "3.35 ≤ x < 3.45" },
        { front: "Upper bound of a − b", back: "Upper bound of a minus the lower bound of b." },
        { front: "Upper bound of a ÷ b", back: "Upper bound of a divided by the lower bound of b." },
        { front: "(a + √b)(a − √b)", back: "a² − b (a rational number)." },
      ],
    },
  },
};
