// GCSE Maths — Algebra (Years 10–11). Original content aligned to the DfE GCSE mathematics subject content (OGL v3.0).
// Answer keys are recomputed by _check_m3.ts — re-run it after ANY edit here.
import type { CTopic } from "../types";

export const TOPIC: CTopic = {
  key: "alg",
  topic: "Algebra",
  subject: "Maths",
  years: {
    10: {
      year: 10,
      objectives: [
        "Expand single and double brackets and simplify; factorise into single and double brackets.",
        "Solve linear equations, including those with brackets and fractions, and linear inequalities.",
        "Rearrange formulae to change the subject.",
        "Find the nth term of linear sequences and use it to test terms.",
        "Work with straight-line graphs: gradient, y = mx + c, parallel and perpendicular lines.",
      ],
      note: {
        title: "Year 10 Algebra: brackets, equations, sequences and lines",
        body: `## What you need to know

**Expanding.** Multiply every term inside by the term outside. For a double bracket, use FOIL (First, Outer, Inner, Last): (x + 2)(x + 7) = x² + 7x + 2x + 14 = x² + 9x + 14. Beware: (x + 6)² is (x + 6)(x + 6), not x² + 36.

**Factorising** is expanding backwards. For x² + bx + c look for two numbers that **multiply to c and add to b**.

**Equations.** Do the same to both sides. With fractions, multiply every term by the common denominator. **Inequalities** work the same way, but flip the sign if you multiply or divide by a negative.

**Sequences.** For a linear sequence the nth term is dn + (first term − d), where d is the common difference.

**Straight lines.** y = mx + c has gradient m and y-intercept c. Parallel lines have equal gradients. Perpendicular gradients multiply to −1.

## Worked example 1
Solve 3(x − 2) = x + 8. Expand: 3x − 6 = x + 8. Collect: 2x = 14, so **x = 7**.

## Worked example 2
9, 13, 17, 21 goes up by 4, and 9 − 4 = 5, so the nth term is **4n + 5**.

## Worked example 3
Make x the subject of y = 3x − 2: add 2, then divide by 3, giving **x = (y + 2)/3**.

| Skill | Key idea |
| --- | --- |
| Gradient | (change in y) ÷ (change in x) |
| Parallel lines | same m |
| Perpendicular | m₁ × m₂ = −1 |`,
      },
      quiz: {
        title: "Algebra: Year 10 GCSE quiz",
        questions: [
          {
            key: "alg-y10-01", kind: "number", difficulty: 1,
            prompt: "Solve 3x + 7 = 25.",
            answer: 6,
            explanation: "Subtract 7 from both sides: 3x = 18. Then divide by 3: x = 6.",
          },
          {
            key: "alg-y10-02", kind: "single", difficulty: 1,
            prompt: "Expand 3(x − 4).",
            options: ["3x − 12", "3x − 4", "x − 12", "3x + 12"],
            answer: "3x − 12",
            explanation: "Multiply both terms in the bracket by 3: 3 × x = 3x and 3 × (−4) = −12.",
          },
          {
            key: "alg-y10-03", kind: "number", difficulty: 1,
            prompt: "The sequence 5, 8, 11, 14, … has nth term 3n + 2. What is the 20th term?",
            answer: 62,
            explanation: "Put n = 20 into 3n + 2: 3 × 20 + 2 = 62.",
          },
          {
            key: "alg-y10-04", kind: "single", difficulty: 2, diagnostic: true,
            prompt: "Expand and simplify (x + 3)(x + 5).",
            options: ["x² + 15", "x² + 8x + 8", "x² + 8x + 15", "x² + 15x + 8"],
            answer: "x² + 8x + 15",
            explanation: "Multiply each pair: x², 5x, 3x and 15. Collect the like terms 5x + 3x = 8x to get x² + 8x + 15.",
          },
          {
            key: "alg-y10-05", kind: "single", difficulty: 2, diagnostic: true,
            prompt: "Factorise x² + 7x + 12.",
            options: ["(x + 2)(x + 6)", "(x + 3)(x + 4)", "(x + 1)(x + 12)", "(x − 3)(x − 4)"],
            answer: "(x + 3)(x + 4)",
            explanation: "Find two numbers that multiply to 12 and add to 7: 3 and 4. So x² + 7x + 12 = (x + 3)(x + 4).",
          },
          {
            key: "alg-y10-06", kind: "number", difficulty: 2,
            prompt: "Solve 5(2x − 1) = 3x + 16.",
            answer: 3,
            explanation: "Expand: 10x − 5 = 3x + 16. Subtract 3x: 7x − 5 = 16. Add 5: 7x = 21, so x = 3.",
          },
          {
            key: "alg-y10-07", kind: "single", difficulty: 2,
            prompt: "Solve the inequality 4x − 3 > 13.",
            options: ["x > 4", "x > 2.5", "x < 4", "x > 10"],
            answer: "x > 4",
            explanation: "Add 3 to both sides: 4x > 16. Divide by 4: x > 4. The sign stays the same because we divided by a positive number.",
          },
          {
            key: "alg-y10-08", kind: "single", difficulty: 2,
            prompt: "The graph shows a straight line. Which is its equation?",
            options: ["y = −3x + 2", "y = 2x + 3", "y = ½x − 3", "y = 2x − 3"],
            answer: "y = 2x − 3",
            explanation: "The line crosses the y-axis at −3, so c = −3. It goes up 2 for every 1 across, so the gradient is 2. The equation is y = 2x − 3.",
            image: { file: "alg-y10-line.png", alt: "A coordinate grid with x from −2 to 5 and y from −5 to 5. A straight line rises from the bottom left to the top right, crossing the y-axis below the origin at 3 units below and passing through the points (2, 1) and (3, 3)." },
          },
          {
            key: "alg-y10-09", kind: "single", difficulty: 2,
            prompt: "Make t the subject of v = u + at.",
            options: ["t = v − u − a", "t = (v + u)/a", "t = a(v − u)", "t = (v − u)/a"],
            answer: "t = (v − u)/a",
            explanation: "Subtract u from both sides: v − u = at. Then divide both sides by a: t = (v − u)/a.",
          },
          {
            key: "alg-y10-10", kind: "number", difficulty: 3,
            prompt: "Solve (x + 4)/3 = (2x − 1)/5.",
            answer: 23,
            explanation: "Multiply both sides by 15: 5(x + 4) = 3(2x − 1). Expand: 5x + 20 = 6x − 3. So x = 23.",
          },
          {
            key: "alg-y10-11", kind: "single", difficulty: 3,
            prompt: "Find the equation of the line that is parallel to y = 3x + 1 and passes through the point (2, 4).",
            options: ["y = −x/3 + 14/3", "y = 3x + 4", "y = 3x − 2", "y = 3x + 2"],
            answer: "y = 3x − 2",
            explanation: "Parallel lines share the gradient 3, so y = 3x + c. Substitute (2, 4): 4 = 6 + c, so c = −2.",
          },
          {
            key: "alg-y10-12", kind: "number", difficulty: 3,
            prompt: "The nth term of a sequence is 23 − 3n. Which term (give the value of n) is the first one that is negative?",
            answer: 8,
            explanation: "Solve 23 − 3n < 0: n > 7.67. The first whole number is n = 8, and the 8th term is 23 − 24 = −1.",
          },
          {
            key: "alg-y10-13", kind: "written", difficulty: 3, marks: 3,
            prompt: "Anna says that (x + 3)² = x² + 9. Explain her mistake and expand (x + 3)² correctly.",
            answer: "(x + 3)² = (x + 3)(x + 3) = x² + 6x + 9",
            explanation: "Mark scheme (3 marks): 1 for saying the bracket must be written twice (squaring does not square each term separately); 1 for a correct expansion attempt such as x² + 3x + 3x + 9; 1 for the answer x² + 6x + 9, noting the missing middle term 6x.",
          },
        ],
      },
      flashcards: [
        { front: "Expand (x + a)(x + b)", back: "x² + (a + b)x + ab" },
        { front: "(x + a)² =", back: "x² + 2ax + a² (not x² + a²)." },
        { front: "Factorising x² + bx + c", back: "Find two numbers that multiply to c and add to b." },
        { front: "Difference of two squares: x² − a²", back: "(x + a)(x − a)" },
        { front: "When do you flip an inequality sign?", back: "When you multiply or divide both sides by a negative number." },
        { front: "Equation with fractions", back: "Multiply every term by the common denominator to clear the fractions." },
        { front: "nth term of a linear sequence", back: "dn + (first term − d), where d is the common difference." },
        { front: "y = mx + c", back: "m is the gradient, c is the y-intercept." },
        { front: "Gradient between (x₁, y₁) and (x₂, y₂)", back: "(y₂ − y₁) ÷ (x₂ − x₁)" },
        { front: "Parallel lines: gradients", back: "Equal." },
        { front: "Perpendicular lines: gradients", back: "Multiply to −1 (negative reciprocals)." },
        { front: "Changing the subject", back: "Undo operations in reverse order, doing the same to both sides." },
      ],
    },
    11: {
      year: 11,
      objectives: [
        "Solve quadratic equations by factorising, the quadratic formula and completing the square.",
        "Solve simultaneous equations, including one linear and one non-linear.",
        "Simplify and combine algebraic fractions.",
        "Use function notation: evaluate, composite and inverse functions.",
        "Use iterative formulae and construct algebraic proofs.",
      ],
      note: {
        title: "Year 11 Algebra: quadratics, simultaneous equations, functions and proof",
        body: `## What you need to know

**Quadratics.** To solve ax² + bx + c = 0: (1) factorise, or (2) use the formula **x = (−b ± √(b² − 4ac)) / 2a**, or (3) complete the square: x² + 8x + 3 = (x + 4)² − 13.

**Simultaneous equations.** Eliminate one letter. For a linear and a non-linear pair (such as y = x + 2 with x² + y² = 20), **substitute** the linear one into the other, solve the quadratic, then find each y. Pair every x with its own y.

**Algebraic fractions.** Factorise, then cancel: (x² − 16)/(x² + 4x) = (x − 4)(x + 4)/x(x + 4) = (x − 4)/x. To add, use a common denominator.

**Functions.** f(x) is a rule. fg(x) means do g first, then f. The inverse f⁻¹ undoes f: swap x and y, then rearrange.

**Iteration.** Repeat xₙ₊₁ = f(xₙ) from a start value to approach a solution.

**Proof.** Use n for any integer; even = 2n, odd = 2n + 1. Finish by showing a factor, such as 8n.

## Worked example
Solve x² − 4x − 21 = 0. Factorise: (x − 7)(x + 3) = 0, so **x = 7 or x = −3**.

| Method | Use when |
| --- | --- |
| Factorising | it factorises nicely |
| Formula | it doesn't; needs decimals |
| Completing the square | turning point or exact surds |`,
      },
      quiz: {
        title: "Algebra: Year 11 GCSE quiz",
        questions: [
          {
            key: "alg-y11-01", kind: "single", difficulty: 1,
            prompt: "Solve x² − 5x + 6 = 0.",
            options: ["x = −2 or x = −3", "x = 1 or x = 6", "x = 2 or x = 3", "x = 5 or x = 6"],
            answer: "x = 2 or x = 3",
            explanation: "Factorise: (x − 2)(x − 3) = 0, since −2 × −3 = 6 and −2 + −3 = −5. So x = 2 or x = 3.",
          },
          {
            key: "alg-y11-02", kind: "number", difficulty: 1,
            prompt: "f(x) = 3x − 2. Find f(4).",
            answer: 10,
            explanation: "Substitute x = 4: 3 × 4 − 2 = 12 − 2 = 10.",
          },
          {
            key: "alg-y11-03", kind: "number", difficulty: 1,
            prompt: "Solve the simultaneous equations 2x + y = 10 and x − y = 2. Give the value of x.",
            answer: 4,
            explanation: "Add the equations to eliminate y: 3x = 12, so x = 4. (Then y = 2.)",
          },
          {
            key: "alg-y11-04", kind: "single", difficulty: 2, diagnostic: true,
            prompt: "Solve x² + 2x − 15 = 0.",
            options: ["x = 5 or x = −3", "x = −5 or x = 3", "x = 15 or x = −1", "x = −5 or x = −3"],
            answer: "x = −5 or x = 3",
            explanation: "Find two numbers with product −15 and sum 2: 5 and −3. So (x + 5)(x − 3) = 0 and x = −5 or x = 3.",
          },
          {
            key: "alg-y11-05", kind: "single", difficulty: 2, diagnostic: true,
            prompt: "Use the quadratic formula to solve x² − 3x − 5 = 0. Give the solutions to 2 decimal places.",
            options: ["x = −4.19 or x = 1.19", "x = 4.19 or x = −1.19", "x = 8.39 or x = −2.39", "x = 4.19 or x = 1.19"],
            answer: "x = 4.19 or x = −1.19",
            explanation: "With a = 1, b = −3, c = −5: x = (3 ± √(9 + 20))/2 = (3 ± √29)/2. That gives 4.19 and −1.19.",
          },
          {
            key: "alg-y11-06", kind: "single", difficulty: 2,
            prompt: "Simplify (x² − 9)/(x² + 3x).",
            options: ["(x − 3)/x", "−3/x", "(x + 3)/x", "x − 3"],
            answer: "(x − 3)/x",
            explanation: "Factorise the top as (x − 3)(x + 3) and the bottom as x(x + 3). Cancel the common factor (x + 3) to get (x − 3)/x.",
          },
          {
            key: "alg-y11-07", kind: "single", difficulty: 2,
            prompt: "Write x² + 6x + 1 in the form (x + a)² + b.",
            options: ["(x + 3)² + 1", "(x + 6)² − 35", "(x + 3)² − 10", "(x + 3)² − 8"],
            answer: "(x + 3)² − 8",
            explanation: "Half of 6 is 3, so (x + 3)² = x² + 6x + 9. That is 8 too many, so x² + 6x + 1 = (x + 3)² − 8.",
          },
          {
            key: "alg-y11-08", kind: "single", difficulty: 2,
            prompt: "f(x) = 2x + 1 and g(x) = x². Find fg(x).",
            options: ["(2x + 1)²", "2x² + 1", "2x² + 2x", "4x² + 1"],
            answer: "2x² + 1",
            explanation: "fg(x) means apply g first, then f: f(x²) = 2(x²) + 1 = 2x² + 1. ((2x + 1)² would be gf(x).)",
          },
          {
            key: "alg-y11-09", kind: "number", difficulty: 2,
            prompt: "f(x) = (x + 5)/3. Find f⁻¹(4).",
            answer: 7,
            explanation: "Solve (x + 5)/3 = 4 to find the input that gives 4: x + 5 = 12, so x = 7. (Equivalently f⁻¹(x) = 3x − 5.)",
          },
          {
            key: "alg-y11-10", kind: "single", difficulty: 3,
            prompt: "Solve y = x + 1 and x² + y² = 25 simultaneously.",
            options: ["(4, 5) and (−3, −2)", "(3, 4) and (−4, −3)", "(3, 4) and (4, 3)", "(−3, −2) and (4, 5)"],
            answer: "(3, 4) and (−4, −3)",
            explanation: "Substitute: x² + (x + 1)² = 25, so 2x² + 2x − 24 = 0, i.e. x² + x − 12 = 0, giving x = 3 or x = −4. Then y = x + 1 gives (3, 4) and (−4, −3).",
          },
          {
            key: "alg-y11-11", kind: "number", difficulty: 3,
            prompt: "xₙ₊₁ = 3 − 4/xₙ and x₁ = 4. Find x₃.",
            answer: 1,
            explanation: "x₂ = 3 − 4/4 = 2. Then x₃ = 3 − 4/2 = 1.",
          },
          {
            key: "alg-y11-12", kind: "single", difficulty: 3,
            prompt: "Write 2/(x + 1) + 3/(x − 2) as a single fraction.",
            options: ["5/((x + 1)(x − 2))", "(5x + 7)/((x + 1)(x − 2))", "5/(2x − 1)", "(5x − 1)/((x + 1)(x − 2))"],
            answer: "(5x − 1)/((x + 1)(x − 2))",
            explanation: "Use the common denominator (x + 1)(x − 2). The top is 2(x − 2) + 3(x + 1) = 2x − 4 + 3x + 3 = 5x − 1.",
          },
          {
            key: "alg-y11-13", kind: "written", difficulty: 3, marks: 3,
            prompt: "Prove that (2n + 1)² − (2n − 1)² is a multiple of 8 for every integer n.",
            answer: "(2n + 1)² − (2n − 1)² = (4n² + 4n + 1) − (4n² − 4n + 1) = 8n, which is 8 times an integer.",
            explanation: "Mark scheme (3 marks): 1 for expanding (2n + 1)² = 4n² + 4n + 1; 1 for expanding (2n − 1)² = 4n² − 4n + 1 and subtracting; 1 for reaching 8n and stating it is a multiple of 8 because n is an integer.",
          },
          {
            key: "alg-y11-14", kind: "single", difficulty: 2,
            prompt: "The graph shows y = x² − 2x − 3. What are the coordinates of its turning point?",
            options: ["(−4, 1)", "(−1, 0)", "(3, 0)", "(1, −4)"],
            answer: "(1, −4)",
            explanation: "The lowest point of the curve is where the graph turns. It sits at x = 1 (halfway between the roots −1 and 3) and y = −4.",
            image: { file: "alg-y11-quad.png", alt: "A U-shaped parabola on a coordinate grid, x from −3 to 5 and y from −5 to 6. It crosses the x-axis at two points, one on each side of the y-axis, crosses the y-axis below the origin, and has its lowest point below the x-axis." },
          },
        ],
      },
      flashcards: [
        { front: "Quadratic formula", back: "x = (−b ± √(b² − 4ac)) / 2a for ax² + bx + c = 0." },
        { front: "Completing the square: x² + bx", back: "(x + b/2)² − (b/2)²" },
        { front: "The discriminant b² − 4ac tells you…", back: "> 0: two roots; = 0: one repeated root; < 0: no real roots." },
        { front: "Turning point of y = (x + a)² + b", back: "(−a, b)" },
        { front: "Linear + non-linear simultaneous equations", back: "Substitute the linear equation into the other, solve, then find each y." },
        { front: "fg(x) means…", back: "Do g first, then f." },
        { front: "How to find an inverse function", back: "Write y = f(x), swap x and y, rearrange for y." },
        { front: "Simplifying algebraic fractions", back: "Factorise top and bottom, then cancel common factors." },
        { front: "Adding algebraic fractions", back: "Use a common denominator, then add the numerators." },
        { front: "Iteration xₙ₊₁ = f(xₙ)", back: "Start with x₀ and repeatedly apply the formula until the values settle." },
        { front: "Even and odd integers in a proof", back: "Even = 2n; odd = 2n + 1; consecutive integers n, n + 1, n + 2." },
        { front: "Difference of two squares", back: "a² − b² = (a + b)(a − b)" },
      ],
    },
  },
};
