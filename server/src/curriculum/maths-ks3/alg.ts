// KS3 Maths — Algebra (Years 7–9). Original content aligned to the DfE National Curriculum KS3 programme of study (OGL v3.0).
// Answer keys are recomputed by _check_m2.ts — re-run it after ANY edit here.
import type { CTopic } from "../types";

export const TOPIC: CTopic = {
  key: "alg",
  topic: "Algebra",
  subject: "Maths",
  years: {
    7: {
      year: 7,
      objectives: [
        "Use and interpret algebraic notation: 3x means 3 × x, a² means a × a, and expressions are written without × signs.",
        "Substitute numerical values into simple expressions and formulae, including negative numbers.",
        "Simplify expressions by collecting like terms.",
        "Form and solve simple linear equations, including using function machines and inverse operations.",
      ],
      note: {
        title: "Year 7: expressions, substitution and simple equations",
        body: `## What you need to know

- A **letter** stands for a number we do not know yet (a variable). 3x means 3 × x, and x² means x × x.
- **Like terms** have exactly the same letters: 3x and 5x are like terms, but 3x and 3y are not.
- To **substitute**, replace each letter with its number, then use BIDMAS.
- To **solve** an equation, do the same thing to both sides until the letter is alone. Use **inverse operations**: the opposite of + is −, and the opposite of × is ÷.

## Worked example 1: simplifying

4x + 3y − x + 2y: collect the x terms, 4x − x = 3x, and the y terms, 3y + 2y = 5y. Answer: **3x + 5y**.

## Worked example 2: substituting

Find 2a − b when a = 3 and b = −4. Replace the letters: 2 × 3 − (−4) = 6 + 4 = **10**.

## Worked example 3: solving

Solve 3x + 5 = 20. Subtract 5 from both sides: 3x = 15. Divide both sides by 3: **x = 5**.

| Words | Algebra |
| --- | --- |
| Add 7 to n | n + 7 |
| Double n, then subtract 1 | 2n − 1 |`,
      },
      quiz: {
        title: "Algebra: Year 7 quiz",
        questions: [
          {
            key: "alg-y7-01",
            kind: "single",
            prompt: "Simplify 3a + 4a.",
            options: ["12a", "7a", "7a²", "34a"],
            answer: "7a",
            explanation: "3a and 4a are like terms, so add the numbers in front: 3 + 4 = 7. The letter stays the same, giving 7a.",
            difficulty: 1,
          },
          {
            key: "alg-y7-02",
            kind: "number",
            prompt: "Work out the value of 3x + 2 when x = 4.",
            answer: 14,
            explanation: "Replace x with 4: 3 × 4 + 2 = 12 + 2 = 14.",
            difficulty: 1,
          },
          {
            key: "alg-y7-03",
            kind: "number",
            prompt: "Solve x + 9 = 15. What is x?",
            answer: 6,
            explanation: "Do the inverse: subtract 9 from both sides. 15 − 9 = 6, so x = 6.",
            difficulty: 1,
          },
          {
            key: "alg-y7-04",
            kind: "single",
            prompt: "Simplify 5x + 3y − 2x + y.",
            options: ["3x + 2y", "7x + 4y", "7x + 2y", "3x + 4y"],
            answer: "3x + 4y",
            explanation: "Collect like terms: 5x − 2x = 3x and 3y + y = 4y (y means 1y). The answer is 3x + 4y.",
            difficulty: 2,
          },
          {
            key: "alg-y7-05",
            kind: "number",
            prompt: "Solve 4x − 7 = 21. What is x?",
            answer: 7,
            explanation: "Add 7 to both sides: 4x = 28. Then divide both sides by 4 to get x = 7.",
            difficulty: 2,
            diagnostic: true,
          },
          {
            key: "alg-y7-06",
            kind: "single",
            prompt: "A pen costs p pounds and a ruler costs r pounds. Which expression gives the cost of 3 pens and 2 rulers?",
            options: ["5pr", "3 + p + 2 + r", "3p + 2r", "6pr"],
            answer: "3p + 2r",
            explanation: "3 pens cost 3 × p = 3p and 2 rulers cost 2 × r = 2r. Add them: 3p + 2r. The letters p and r cannot be combined.",
            difficulty: 2,
          },
          {
            key: "alg-y7-07",
            kind: "multi",
            prompt: "Which of these are equal to 3x + 5x − 2x? Select all that apply.",
            options: ["6x", "8x", "10x", "3x + 3x", "4x"],
            answer: ["6x", "3x + 3x"],
            explanation: "3x + 5x − 2x = (3 + 5 − 2)x = 6x. Also 3x + 3x = 6x, so both of those match.",
            difficulty: 2,
          },
          {
            key: "alg-y7-08",
            kind: "single",
            prompt: "A function machine multiplies the input n by 3 and then adds 2. The output is 20. What was the input?",
            options: ["18", "62", "22", "6"],
            answer: "6",
            explanation: "Work backwards with inverse operations: subtract 2 to get 18, then divide by 3 to get 6. Check: 6 × 3 + 2 = 20.",
            difficulty: 2,
            diagnostic: true,
          },
          {
            key: "alg-y7-09",
            kind: "number",
            prompt: "The three angles of a triangle are x, x + 10 and x + 20 degrees. Find x.",
            answer: 50,
            explanation: "Angles in a triangle add to 180, so 3x + 30 = 180. Then 3x = 150 and x = 50.",
            difficulty: 3,
          },
          {
            key: "alg-y7-10",
            kind: "number",
            prompt: "Work out the value of x² + 3 when x = −2.",
            answer: 7,
            explanation: "x² means (−2) × (−2) = 4, because a negative times a negative is positive. Then 4 + 3 = 7.",
            difficulty: 3,
          },
        ],
      },
      flashcards: [
        { front: "What does 3x mean?", back: "3 × x (three lots of x)" },
        { front: "What does x² mean?", back: "x × x (not 2 × x)" },
        { front: "What are like terms?", back: "Terms with exactly the same letters, e.g. 4a and 9a" },
        { front: "Simplify 6y − y", back: "5y" },
        { front: "What does substitute mean?", back: "Replace the letters with their numbers, then work it out" },
        { front: "The inverse of + is ...", back: "−" },
        { front: "The inverse of × is ...", back: "÷" },
        { front: "Solve x − 4 = 10", back: "x = 14 (add 4 to both sides)" },
        { front: "Write \"double n, then add 5\" in algebra", back: "2n + 5" },
        { front: "The golden rule of equations", back: "Do the same to both sides" },
      ],
    },
    8: {
      year: 8,
      objectives: [
        "Expand a single bracket and factorise by taking out a common factor.",
        "Solve linear equations with brackets and with the unknown on both sides.",
        "Generate terms of a sequence and find the nth term of a linear sequence.",
        "Use formulae by substitution.",
      ],
      note: {
        title: "Year 8: brackets, equations with unknowns on both sides, and nth terms",
        body: `## What you need to know

- **Expanding** multiplies every term in the bracket: 2(x + 5) = 2x + 10.
- **Factorising** is the reverse. Find the biggest number (and letter) that goes into every term: 10x + 15 = 5(2x + 3).
- **Unknowns on both sides:** first collect the letters on one side, then solve as usual.
- A **linear sequence** goes up or down by the same amount each time. The **nth term** is (difference) × n + (adjustment).

## Worked example 1: nth term

Sequence 7, 11, 15, 19 ... goes up by 4, so start with 4n. When n = 1, 4n = 4 but the first term is 7, so add 3. The nth term is **4n + 3**.

## Worked example 2: unknowns on both sides

Solve 6x + 4 = 2x + 28. Subtract 2x from both sides: 4x + 4 = 28. Subtract 4: 4x = 24. Divide by 4: **x = 6**.

## Worked example 3: expand and simplify

4(x + 2) + 2(x − 3) = 4x + 8 + 2x − 6 = **6x + 2**. Take care with the − sign in the second bracket.

| Term number n | 1 | 2 | 3 | 4 |
| --- | --- | --- | --- | --- |
| 4n + 3 | 7 | 11 | 15 | 19 |`,
      },
      quiz: {
        title: "Algebra: Year 8 quiz",
        questions: [
          {
            key: "alg-y8-01",
            kind: "single",
            prompt: "Expand 3(x + 4).",
            options: ["3x + 4", "3x + 12", "x + 12", "3x + 7"],
            answer: "3x + 12",
            explanation: "Multiply every term inside the bracket by 3: 3 × x = 3x and 3 × 4 = 12.",
            difficulty: 1,
          },
          {
            key: "alg-y8-02",
            kind: "number",
            prompt: "Here is a sequence: 4, 7, 10, 13, ... What is the 10th term?",
            answer: 31,
            explanation: "It goes up by 3, and the nth term is 3n + 1. For n = 10 that is 3 × 10 + 1 = 31.",
            difficulty: 1,
          },
          {
            key: "alg-y8-03",
            kind: "single",
            prompt: "Factorise 6x + 9 fully.",
            options: ["3(2x + 9)", "6(x + 3)", "3(x + 3)", "3(2x + 3)"],
            answer: "3(2x + 3)",
            explanation: "The biggest number that divides 6 and 9 is 3. Take it out: 6x ÷ 3 = 2x and 9 ÷ 3 = 3, giving 3(2x + 3).",
            difficulty: 1,
          },
          {
            key: "alg-y8-04",
            kind: "number",
            prompt: "Solve 5x + 3 = 2x + 18. What is x?",
            answer: 5,
            explanation: "Subtract 2x from both sides to get 3x + 3 = 18. Subtract 3 to get 3x = 15. Divide by 3 to get x = 5.",
            difficulty: 2,
            diagnostic: true,
          },
          {
            key: "alg-y8-05",
            kind: "single",
            prompt: "What is the nth term of the sequence 5, 9, 13, 17, ...?",
            options: ["4n + 5", "5n", "4n + 1", "n + 4"],
            answer: "4n + 1",
            explanation: "The sequence goes up by 4, so start with 4n. 4 × 1 = 4 but the first term is 5, so add 1: 4n + 1.",
            difficulty: 2,
            diagnostic: true,
          },
          {
            key: "alg-y8-06",
            kind: "single",
            prompt: "Expand and simplify 2(x + 5) + 3(x − 1).",
            options: ["5x + 13", "5x + 7", "5x + 2", "5x − 7"],
            answer: "5x + 7",
            explanation: "Expand: 2x + 10 and 3x − 3. Collect like terms: 5x and 10 − 3 = 7, so the answer is 5x + 7.",
            difficulty: 2,
          },
          {
            key: "alg-y8-07",
            kind: "number",
            prompt: "The formula v = u + at is used in science. Find v when u = 5, a = 3 and t = 4.",
            answer: 17,
            explanation: "Substitute: v = 5 + 3 × 4. Multiply first: 3 × 4 = 12, then 5 + 12 = 17.",
            difficulty: 2,
          },
          {
            key: "alg-y8-08",
            kind: "number",
            prompt: "Solve 3(2x − 1) = 21. What is x?",
            answer: 4,
            explanation: "Expand: 6x − 3 = 21. Add 3 to get 6x = 24, then divide by 6 to get x = 4.",
            difficulty: 2,
          },
          {
            key: "alg-y8-09",
            kind: "single",
            prompt: "What is the nth term of the sequence 20, 17, 14, 11, ...?",
            options: ["23 − 3n", "3n + 17", "20 − 3n", "3n − 23"],
            answer: "23 − 3n",
            explanation: "The sequence goes DOWN by 3, so use −3n. When n = 1, −3n = −3 and we need 20, so add 23: 23 − 3n.",
            difficulty: 3,
          },
          {
            key: "alg-y8-10",
            kind: "multi",
            prompt: "The nth term of a sequence is 3n + 2. Which of these numbers are in the sequence?",
            options: ["14", "20", "25", "35", "40"],
            answer: ["14", "20", "35"],
            explanation: "A number is a term if 3n + 2 equals it for a whole number n. 14 (n = 4), 20 (n = 6) and 35 (n = 11) work; 25, 40 do not give a whole n.",
            difficulty: 3,
          },
        ],
      },
      flashcards: [
        { front: "Expand 4(x − 3)", back: "4x − 12" },
        { front: "Factorise 8a + 12", back: "4(2a + 3)" },
        { front: "What is factorising?", back: "Writing an expression as a bracket with a common factor outside it" },
        { front: "Unknowns on both sides: first step?", back: "Collect the letters on one side (subtract the smaller x-term from both sides)" },
        { front: "nth term of 3, 7, 11, 15, ...", back: "4n − 1" },
        { front: "What is the first step to find an nth term?", back: "Find the common difference: it is the number in front of n" },
        { front: "What is the term-to-term rule?", back: "How you get from one term to the next, e.g. add 4" },
        { front: "Solve 2x + 1 = x + 6", back: "x = 5" },
        { front: "Substitute a = 3, b = 2 into 2a − b", back: "6 − 2 = 4" },
        { front: "Expand and simplify (x + 2) + 2(x + 1)", back: "3x + 4" },
      ],
    },
    9: {
      year: 9,
      objectives: [
        "Recognise and use the equation of a straight line y = mx + c: gradient and y-intercept.",
        "Solve a pair of simultaneous linear equations by elimination.",
        "Solve linear inequalities in one variable and represent solutions on a number line.",
        "Expand the product of two binomials and factorise simple quadratic expressions x² + bx + c.",
      ],
      note: {
        title: "Year 9: straight-line graphs, simultaneous equations, inequalities and quadratics",
        body: `## What you need to know

- The line **y = mx + c** has **gradient m** (how steep) and **y-intercept c** (where it crosses the y-axis). Gradient = up ÷ across.
- **Parallel lines** have the same gradient.
- **Simultaneous equations:** two equations that are both true. Add or subtract them to remove one letter (elimination).
- **Inequalities** are solved like equations, but keep the sign: 2x − 1 < 9 gives x < 5.
- **Expanding two brackets:** multiply each term in the first bracket by each term in the second.

## Worked example 1: gradient and intercept

y = 5x − 2 has gradient 5 and crosses the y-axis at (0, −2). A line through (0, 1) and (3, 10) has gradient (10 − 1) ÷ 3 = 3, so y = 3x + 1.

## Worked example 2: simultaneous equations

x + y = 13 and x − y = 5. Add the equations: 2x = 18, so x = 9. Then y = 13 − 9 = 4.

## Worked example 3: quadratics

(x + 5)(x + 2) = x² + 2x + 5x + 10 = **x² + 7x + 10**. To factorise x² + 6x + 8, find two numbers that multiply to 8 and add to 6: 2 and 4, so (x + 2)(x + 4).

| y = mx + c | Gradient | Intercept |
| --- | --- | --- |
| y = 5x − 2 | 5 | −2 |`,
      },
      quiz: {
        title: "Algebra: Year 9 quiz",
        questions: [
          {
            key: "alg-y9-01",
            kind: "single",
            prompt: "What is the gradient of the straight line drawn on the grid?",
            options: ["1/2", "2", "−1", "3"],
            answer: "2",
            explanation: "Pick two points on the line, such as (0, −1) and (1, 1). Going across 1 means going up 2, so the gradient is 2 ÷ 1 = 2.",
            difficulty: 1,
            image: { file: "alg-y9-line.png", alt: "A coordinate grid with x from −2 to 4 and y from −3 to 6. A straight line rises steeply from the bottom left, passing through the points (0, −1), (1, 1), (2, 3) and (3, 5)." },
          },
          {
            key: "alg-y9-02",
            kind: "number",
            prompt: "The line y = 3x + 5 crosses the y-axis. What is the y-coordinate of that point?",
            answer: 5,
            explanation: "The y-axis is where x = 0. Then y = 3 × 0 + 5 = 5, which is the c in y = mx + c.",
            difficulty: 1,
          },
          {
            key: "alg-y9-03",
            kind: "single",
            prompt: "Solve 2x + 3 < 11.",
            options: ["x > 4", "x < 14", "x < 7", "x < 4"],
            answer: "x < 4",
            explanation: "Subtract 3 from both sides to get 2x < 8. Divide by 2 to get x < 4. The inequality sign stays the same.",
            difficulty: 1,
          },
          {
            key: "alg-y9-04",
            kind: "number",
            prompt: "The equations x + y = 10 and x − y = 4 are both true. What is the value of x?",
            answer: 7,
            explanation: "Add the two equations: 2x = 14, so x = 7. Check: y = 3 and 7 − 3 = 4.",
            difficulty: 2,
            diagnostic: true,
          },
          {
            key: "alg-y9-05",
            kind: "single",
            prompt: "Expand and simplify (x + 4)(x + 3).",
            options: ["x² + 12", "x² + 7x + 7", "x² + 12x + 7", "x² + 7x + 12"],
            answer: "x² + 7x + 12",
            explanation: "Multiply each part: x × x = x², x × 3 = 3x, 4 × x = 4x and 4 × 3 = 12. Then 3x + 4x = 7x.",
            difficulty: 2,
            diagnostic: true,
          },
          {
            key: "alg-y9-06",
            kind: "single",
            prompt: "Factorise x² + 5x + 6.",
            options: ["(x + 2)(x + 3)", "(x + 1)(x + 6)", "(x + 5)(x + 1)", "(x − 2)(x − 3)"],
            answer: "(x + 2)(x + 3)",
            explanation: "Find two numbers that multiply to 6 and add to 5. Those are 2 and 3, so the factors are (x + 2)(x + 3).",
            difficulty: 2,
          },
          {
            key: "alg-y9-07",
            kind: "multi",
            prompt: "n is a whole number with −2 < n ≤ 3. Which of these values could n be?",
            options: ["−2", "−1", "0", "3", "4"],
            answer: ["−1", "0", "3"],
            explanation: "−2 < n means n is bigger than −2 but not equal to it, so −2 is out. n ≤ 3 includes 3 but not 4.",
            difficulty: 2,
          },
          {
            key: "alg-y9-08",
            kind: "single",
            prompt: "A straight line passes through (0, 2) and (4, 10). What is its equation?",
            options: ["y = 4x + 2", "y = 2x + 4", "y = 2x + 2", "y = x + 2"],
            answer: "y = 2x + 2",
            explanation: "The line crosses the y-axis at 2, so c = 2. The gradient is (10 − 2) ÷ (4 − 0) = 2. So y = 2x + 2.",
            difficulty: 2,
          },
          {
            key: "alg-y9-09",
            kind: "number",
            prompt: "Solve the simultaneous equations 3x + 2y = 19 and x + 2y = 9. What is x + y?",
            answer: 7,
            explanation: "Subtract the second equation from the first: 2x = 10, so x = 5. Put x = 5 into x + 2y = 9 to get y = 2. Then x + y = 7.",
            difficulty: 3,
          },
          {
            key: "alg-y9-10",
            kind: "written",
            prompt: "Does the point (3, 8) lie on the line y = 2x + 1? Show your working and explain how you know.",
            answer: "No. Substituting x = 3 gives y = 2 × 3 + 1 = 7, but the point has y = 8, so it is not on the line.",
            explanation: "Mark scheme (2 marks): 1 mark for substituting x = 3 correctly to get y = 7; 1 mark for concluding that (3, 8) is NOT on the line because 7 ≠ 8. Accept a comparison of y-values or checking 8 = 2 × 3 + 1 as false.",
            difficulty: 3,
            marks: 2,
          },
        ],
      },
      flashcards: [
        { front: "In y = mx + c, what is m?", back: "The gradient (steepness)" },
        { front: "In y = mx + c, what is c?", back: "The y-intercept (where the line crosses the y-axis)" },
        { front: "How do you calculate a gradient?", back: "Change in y ÷ change in x (up ÷ across)" },
        { front: "Parallel lines have ...", back: "The same gradient" },
        { front: "Elimination: what do you do to remove a letter?", back: "Add or subtract the two equations so one letter cancels" },
        { front: "Solve x + y = 8 and x − y = 2", back: "x = 5, y = 3" },
        { front: "Solve −3x < 12 ... what must you remember?", back: "Dividing by a negative flips the sign, so x > −4" },
        { front: "Expand (x + 1)(x + 5)", back: "x² + 6x + 5" },
        { front: "Factorise x² + 8x + 12", back: "(x + 2)(x + 6)" },
        { front: "On a number line, what does an open circle mean?", back: "The end value is not included (< or >)" },
      ],
    },
  },
};
