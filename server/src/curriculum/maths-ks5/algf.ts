// A-level Maths — Algebra & Functions (Years 12–13). Original content aligned to the DfE GCE AS and A-level mathematics subject content.
// Answer keys are recomputed by _check_m4_a.ts — re-run it after ANY edit here.
import type { CTopic } from "../types";
import { S, M, NUM, WR } from "./_h4";

export const TOPIC: CTopic = {
  key: "algf",
  topic: "Algebra & Functions",
  subject: "Maths",
  years: {
    12: {
      year: 12,
      subtopic: "Year 12 (AS)",
      objectives: [
        "Use and manipulate surds, including rationalising the denominator; work with rational indices.",
        "Solve quadratic equations (factorising, completing the square, formula); use the discriminant; sketch quadratic graphs.",
        "Solve simultaneous equations, one linear and one quadratic, and interpret them as intersections of graphs.",
        "Solve linear and quadratic inequalities and express solutions in inequality notation.",
        "Use the factor theorem and the remainder theorem for polynomials; factorise cubics.",
        "Sketch cubic graphs from their equations and identify the equation of a graph; apply translations and stretches to y = f(x).",
      ],
      note: {
        title: "Year 12: surds, quadratics, polynomials and transformations",
        body: `## What you need to know

**Surds and indices.** √(ab) = √a × √b. To rationalise 1/(a + √b) multiply top and bottom by (a − √b). Rational indices: aᵐ/ⁿ = (ⁿ√a)ᵐ, and a⁻ⁿ = 1/aⁿ.

**Quadratics** ax² + bx + c = 0. Discriminant b² − 4ac: **> 0** two distinct real roots, **= 0** one repeated root (the graph touches the x-axis), **< 0** no real roots.
Completing the square: x² + bx + c = (x + b/2)² + c − b²/4.

**Inequalities.** Solve the boundary equation, sketch the parabola, and read off the region. For a positive x² term, "< 0" means between the roots and "> 0" means outside them.

**Polynomials.** *Factor theorem:* (x − a) is a factor of f(x) if and only if f(a) = 0. *Remainder theorem:* the remainder when f(x) is divided by (x − a) is f(a).

**Transformations of y = f(x)**

| Equation | Effect |
| --- | --- |
| y = f(x) + a | up by a |
| y = f(x + a) | left by a |
| y = a f(x) | stretch in y by a |
| y = f(ax) | stretch in x by 1/a |

## Worked example 1: surds

Rationalise 10/(4 − √6).
Multiply by (4 + √6)/(4 + √6): 10(4 + √6)/(16 − 6) = 10(4 + √6)/10 = **4 + √6**.

## Worked example 2: factor theorem

Factorise f(x) = x³ − 2x² − 5x + 6.
f(1) = 1 − 2 − 5 + 6 = 0, so (x − 1) is a factor. Dividing gives x² − x − 6 = (x − 3)(x + 2).
So f(x) = **(x − 1)(x − 3)(x + 2)**.

Tip: with an inequality always sketch the graph before you write the answer.`,
      },
      quiz: {
        title: "Algebra & Functions: Year 12 quiz",
        questions: [
          S("algf-y12-01", 1, "Write √50 in the form a√b with b as small as possible.", ["25√2", "5√2", "10√5", "2√5"], "5√2", "√50 = √(25 × 2) = √25 × √2 = 5√2. Take out the largest square factor, 25."),
          NUM("algf-y12-02", 1, "Evaluate 27^(2/3).", 9, 0, "The denominator 3 means a cube root: ∛27 = 3. The numerator 2 means square that: 3² = 9."),
          S("algf-y12-03", 1, "The quadratic equation x² + 4x + 7 = 0 has:", ["two distinct real roots", "one repeated root", "no real roots", "two real roots, both negative"], "no real roots", "The discriminant is b² − 4ac = 16 − 28 = −12, which is negative, so there are no real roots."),
          NUM("algf-y12-04", 2, "The equation x² + kx + 16 = 0 has a repeated root and k > 0. Find k.", 8, 0, "A repeated root needs b² − 4ac = 0, so k² − 64 = 0, giving k = ±8. Since k > 0, k = 8."),
          S("algf-y12-05", 2, "Write x² − 10x + 7 in the form (x + p)² + q.", ["(x + 5)² − 18", "(x − 5)² + 32", "(x − 10)² − 93", "(x − 5)² − 18"], "(x − 5)² − 18", "Halve the coefficient of x to get p = −5, then q = 7 − (−5)² = 7 − 25 = −18.", { diagnostic: true }),
          NUM("algf-y12-06", 2, "The line y = x + 3 meets the curve y = x² − 3x + 6 at two points. Find the larger x-coordinate.", 3, 0, "Set x + 3 = x² − 3x + 6, so x² − 4x + 3 = 0, which factorises as (x − 1)(x − 3) = 0. The solutions are x = 1 and x = 3."),
          S("algf-y12-07", 2, "Solve x² − x − 12 < 0.", ["x < −3 or x > 4", "−3 < x < 4", "−4 < x < 3", "x < −4 or x > 3"], "−3 < x < 4", "x² − x − 12 = (x − 4)(x + 3) has roots −3 and 4. The parabola is below the x-axis between the roots, so −3 < x < 4.", { diagnostic: true }),
          NUM("algf-y12-08", 2, "Find the remainder when x³ − 4x² + 2x + 9 is divided by (x − 3).", 6, 0, "By the remainder theorem the remainder is f(3) = 27 − 36 + 6 + 9 = 6."),
          S("algf-y12-09", 2, "The graph of y = f(x) has a minimum point at (2, −3), as shown. What are the coordinates of the minimum point of y = 2f(x + 1)?", ["(3, −6)", "(1, −3)", "(1, −6)", "(−1, −6)"], "(1, −6)", "f(x + 1) translates the graph 1 unit to the left, giving (1, −3). Then 2f multiplies every y-value by 2, giving (1, −6).", { image: { file: "algf-y12-q9.png", alt: "Graph of a U-shaped curve y = f(x) with its lowest point labelled (2, −3). The curve crosses the x-axis at two points and the y-axis above the origin." } }),
          S("algf-y12-10", 2, "Rationalise the denominator: 6/(3 − √3).", ["3 − √3", "2 + √3", "6 + 2√3", "3 + √3"], "3 + √3", "Multiply top and bottom by (3 + √3): 6(3 + √3)/(9 − 3) = 6(3 + √3)/6 = 3 + √3."),
          NUM("algf-y12-11", 3, "The cubic x³ + ax² + bx − 12 has factors (x − 1) and (x + 2). Find a.", 7, 0, "f(1) = 0 gives 1 + a + b − 12 = 0, so a + b = 11. f(−2) = 0 gives −8 + 4a − 2b − 12 = 0, so 2a − b = 10. Adding: 3a = 21, so a = 7."),
          NUM("algf-y12-12", 3, "How many integers n satisfy both n² − 2n − 15 < 0 and 3n − 2 > 1?", 3, 0, "n² − 2n − 15 = (n − 5)(n + 3) < 0 gives −3 < n < 5. 3n − 2 > 1 gives n > 1. Together 1 < n < 5, so n = 2, 3, 4: three integers."),
          S("algf-y12-13", 3, "The cubic curve shown crosses the x-axis at x = −1, 2 and 4 and crosses the y-axis at (0, 8). Which is its equation?", ["y = (x − 1)(x + 2)(x + 4)", "y = (x + 1)(x − 2)(x − 4)", "y = −(x + 1)(x − 2)(x − 4)", "y = (x + 1)(x − 2)(x + 4)"], "y = (x + 1)(x − 2)(x − 4)", "The roots −1, 2, 4 give factors (x + 1)(x − 2)(x − 4). At x = 0 this is 1 × (−2) × (−4) = 8, matching the y-intercept, so the coefficient is +1 (not −1).", { image: { file: "algf-y12-q13.png", alt: "A cubic curve rising from bottom left and crossing the x-axis at −1, passing through the y-axis at (0, 8) just before its peak, then falling through the x-axis at 2 to a minimum, before rising and crossing the x-axis again at 4." } }),
          WR("algf-y12-14", 3, "Show that the line y = 2x is a tangent to the curve y = x² + 1, and find the coordinates of the point of contact.", 3, "Mark scheme (3 marks). M1: equate to get x² + 1 = 2x, so x² − 2x + 1 = 0. A1: (x − 1)² = 0 (or discriminant (−2)² − 4 × 1 × 1 = 0), a repeated root, so the line touches the curve at exactly one point and is a tangent. A1: x = 1 and y = 2(1) = 2, so the point of contact is (1, 2)."),
        ],
      },
      flashcards: [
        { front: "Rationalise 1/(a + √b)", back: "Multiply top and bottom by (a − √b): the denominator becomes a² − b." },
        { front: "a^(m/n) means …", back: "the nth root of a, raised to the power m: (ⁿ√a)ᵐ." },
        { front: "a⁻ⁿ =", back: "1/aⁿ" },
        { front: "Discriminant and number of roots", back: "b² − 4ac > 0: two real roots. = 0: one repeated root. < 0: no real roots." },
        { front: "Completing the square", back: "x² + bx + c = (x + b/2)² + c − b²/4; the vertex is (−b/2, c − b²/4)." },
        { front: "Solution of x² < 9 type inequality (positive x²)", back: "Between the roots: −3 < x < 3. For x² > 9: outside the roots (x < −3 or x > 3)." },
        { front: "Factor theorem", back: "(x − a) is a factor of f(x) if and only if f(a) = 0." },
        { front: "Remainder theorem", back: "The remainder on dividing f(x) by (x − a) is f(a)." },
        { front: "Effect of y = f(x + a)", back: "Translation a units to the LEFT (the opposite way from the sign)." },
        { front: "Effect of y = a f(x) and y = f(ax)", back: "y = a f(x): stretch in the y-direction by factor a. y = f(ax): stretch in the x-direction by factor 1/a." },
      ],
    },
    13: {
      year: 13,
      subtopic: "Year 13 (A2)",
      objectives: [
        "Understand and use the definition of a function; domain and range; one-one and many-one mappings.",
        "Find inverse functions, and understand the relationship between the graphs of f and f⁻¹.",
        "Understand and use composite functions; solve equations involving composites.",
        "Understand and use the modulus function; solve modulus equations and inequalities; sketch y = |f(x)|.",
        "Decompose rational functions into partial fractions (linear factors, improper fractions).",
      ],
      note: {
        title: "Year 13: functions, inverses, modulus and partial fractions",
        body: `## What you need to know

**Domain and range.** The domain is the set of allowed inputs; the range is the set of outputs. A function needs exactly one output for each input.

**Composite functions.** fg(x) means f(g(x)): do g **first**. Usually fg ≠ gf.

**Inverse functions.** To find f⁻¹: write y = f(x), make x the subject, then swap x and y. The graph of y = f⁻¹(x) is the reflection of y = f(x) in the line y = x. The domain of f⁻¹ is the range of f. A **self-inverse** function has f = f⁻¹.

**Modulus.** |x| is the distance from 0. |f(x)| turns any part of the graph below the x-axis into its reflection above. To solve |ax + b| = c, solve both ax + b = c and ax + b = −c, then check.

**Partial fractions**

| Denominator | Form |
| --- | --- |
| (x − a)(x − b) | A/(x − a) + B/(x − b) |
| (x − a)² | A/(x − a) + B/(x − a)² |
If the numerator has degree ≥ the denominator, divide first.

## Worked example 1: inverse

f(x) = 4/(x − 1), x ≠ 1. Let y = 4/(x − 1). Then x − 1 = 4/y so x = 1 + 4/y. Swap: **f⁻¹(x) = 1 + 4/x**, x ≠ 0.

## Worked example 2: partial fractions

Write (4x + 1)/((x − 2)(x + 1)) as A/(x − 2) + B/(x + 1).
Then 4x + 1 = A(x + 1) + B(x − 2). Put x = 2: 9 = 3A, so A = 3. Put x = −1: −3 = −3B, so B = 1.
Result: **3/(x − 2) + 1/(x + 1)**.

## Worked example 3: modulus

Solve |x + 1| = 4: x + 1 = 4 gives x = 3; x + 1 = −4 gives x = −5.

Tip: always state the domain of a function you have built.`,
      },
      quiz: {
        title: "Algebra & Functions: Year 13 quiz",
        questions: [
          NUM("algf-y13-01", 1, "f(x) = 2x + 3 and g(x) = x². Find fg(2).", 11, 0, "fg(2) = f(g(2)). First g(2) = 4, then f(4) = 2 × 4 + 3 = 11."),
          S("algf-y13-02", 1, "Given f(x) = 3x − 5, find f⁻¹(x).", ["3x + 5", "(x − 5)/3", "(x + 5)/3", "1/(3x − 5)"], "(x + 5)/3", "Write y = 3x − 5, so x = (y + 5)/3, then swap the letters: f⁻¹(x) = (x + 5)/3."),
          S("algf-y13-03", 2, "f(x) = x + 4 and g(x) = 3x². Find gf(x).", ["3x² + 4", "(3x + 4)²", "3x² + 12", "3(x + 4)²"], "3(x + 4)²", "gf(x) = g(f(x)) = g(x + 4) = 3(x + 4)². Do f first, then put the result into g."),
          S("algf-y13-04", 2, "Solve |2x − 3| = 7.", ["x = 5 or x = 2", "x = 5 or x = −2", "x = 5 only", "x = −5 or x = 2"], "x = 5 or x = −2", "2x − 3 = 7 gives x = 5. 2x − 3 = −7 gives x = −2. Both solutions check in the original equation."),
          S("algf-y13-05", 2, "f(x) = x² − 4x + 7 for all real x. What is the range of f?", ["f(x) ≥ 7", "f(x) > 0", "f(x) ≥ 3", "f(x) ≥ −3"], "f(x) ≥ 3", "f(x) = (x − 2)² + 3. The bracket is at least 0, so the minimum value is 3 (at x = 2).") ,
          NUM("algf-y13-06", 2, "f(x) = (x + 2)/(x − 1), x ≠ 1. Find f⁻¹(3). Give your answer as a decimal.", 2.5, 0, "f⁻¹(3) is the x for which f(x) = 3. Solve (x + 2)/(x − 1) = 3: x + 2 = 3x − 3, so 2x = 5 and x = 2.5.", { diagnostic: true }),
          S("algf-y13-07", 2, "Express (5x + 1)/((x − 1)(x + 2)) in partial fractions.", ["3/(x − 1) + 2/(x + 2)", "1/(x − 1) + 4/(x + 2)", "2/(x − 1) − 3/(x + 2)", "2/(x − 1) + 3/(x + 2)"], "2/(x − 1) + 3/(x + 2)", "Write 5x + 1 = A(x + 2) + B(x − 1). Put x = 1: 6 = 3A so A = 2. Put x = −2: −9 = −3B so B = 3.", { diagnostic: true }),
          NUM("algf-y13-08", 3, "(2x² + 5x + 5)/((x − 1)(x + 2)) ≡ P + A/(x − 1) + B/(x + 2), where P, A and B are constants. Find A.", 4, 0, "The numerator and denominator have the same degree, so divide first: 2x² + 5x + 5 = 2(x² + x − 2) + 3x + 9, so P = 2. Then (3x + 9) = A(x + 2) + B(x − 1). Put x = 1: 12 = 3A, so A = 4."),
          NUM("algf-y13-09", 2, "The graph of y = |x² − 4| is shown. How many solutions does the equation |x² − 4| = 3 have?", 4, 0, "x² − 4 = 3 gives x = ±√7, and x² − 4 = −3 gives x = ±1. That is four different solutions.", { image: { file: "algf-y13-q9.png", alt: "Graph of y = |x² − 4|: a W-shaped curve touching the x-axis at −2 and 2, with a local maximum at (0, 4), and rising steeply outside the roots." } }),
          S("algf-y13-10", 1, "The graph of y = f(x) is shown with the line y = x. The point A(1, 4) lies on the graph. Which point lies on the graph of y = f⁻¹(x)?", ["(1, 4)", "(4, 1)", "(−1, −4)", "(4, −1)"], "(4, 1)", "The graph of f⁻¹ is the reflection of f in y = x, so the coordinates swap: (1, 4) becomes (4, 1).", { image: { file: "algf-y13-q10.png", alt: "A curve rising from the origin and flattening, drawn together with the dashed line y = x, with the point A(1, 4) marked on the curve." } }),
          NUM("algf-y13-11", 3, "f(x) = x + 2 and g(x) = x² − 1. Solve fg(x) = gf(x).", -0.5, 0, "fg(x) = x² + 1. gf(x) = (x + 2)² − 1 = x² + 4x + 3. Equating gives 4x + 2 = 0, so x = −0.5."),
          NUM("algf-y13-12", 3, "Find the smallest integer x for which |x − 5| < 2x − 1.", 3, 0, "Both x − 5 < 2x − 1 (giving x > −4) and −(x − 5) < 2x − 1 (giving x > 2) must hold, so x > 2. The smallest integer is 3. (At x = 2 both sides equal 3, so it fails.)"),
          WR("algf-y13-13", 3, "f(x) = (x + 1)/(x − 1), x ≠ 1. Show that f is self-inverse, that is f(f(x)) = x.", 3, "Mark scheme (3 marks). M1: f(f(x)) = ((x + 1)/(x − 1) + 1) / ((x + 1)/(x − 1) − 1). M1: combine over the common denominator (x − 1): numerator = (x + 1 + x − 1)/(x − 1) = 2x/(x − 1); denominator = (x + 1 − x + 1)/(x − 1) = 2/(x − 1). A1: quotient = 2x/2 = x, so ff(x) = x and therefore f⁻¹ = f."),
        ],
      },
      flashcards: [
        { front: "fg(x) means …", back: "f(g(x)): apply g first, then f." },
        { front: "How to find f⁻¹(x)", back: "Write y = f(x), make x the subject, then swap x and y." },
        { front: "Graph of y = f⁻¹(x)", back: "Reflection of y = f(x) in the line y = x." },
        { front: "Domain of f⁻¹ equals …", back: "the range of f (and the range of f⁻¹ is the domain of f)." },
        { front: "Self-inverse function", back: "f = f⁻¹, i.e. f(f(x)) = x. Example: f(x) = 1/x." },
        { front: "Solving |ax + b| = c (c > 0)", back: "Solve ax + b = c and ax + b = −c." },
        { front: "y = |f(x)| from y = f(x)", back: "Reflect any part below the x-axis in the x-axis." },
        { front: "Partial fractions: (x − a)(x − b) denominator", back: "A/(x − a) + B/(x − b); find A and B by substituting x = a and x = b in the numerator identity." },
        { front: "Partial fractions: repeated factor (x − a)²", back: "A/(x − a) + B/(x − a)²" },
        { front: "Top-heavy (improper) rational function", back: "Divide first (polynomial part + remainder fraction), then use partial fractions on the remainder." },
      ],
    },
  },
};
