// KS5 Maths — Integration (Year 12 AS, Year 13 A2). Original content aligned to the DfE GCE AS and A-level mathematics subject content.
// Answer keys are recomputed by _c_integ.ts (run via _check_m4.ts) — re-run after ANY edit here.
import type { CTopic } from "../types";
import { S, NUM, WR } from "./_h4";

export const TOPIC: CTopic = {
  key: "integ",
  topic: "Integration",
  subject: "Maths",
  years: {
    12: {
      year: 12,
      objectives: [
        "Integrate xⁿ (n ≠ −1) and sums, differences and multiples of such terms; include the constant of integration.",
        "Find a particular solution from a given point on the curve.",
        "Evaluate definite integrals and use them to find the area under a curve.",
        "Find the area between a curve and a line, or between two curves, using the points of intersection.",
        "Understand integration as the reverse of differentiation and as a limit of a sum (fundamental theorem of calculus).",
      ],
      note: {
        title: "Year 12: integrating powers and finding areas",
        body: `## Key ideas

Integration reverses differentiation.

- **Power rule:** ∫ xⁿ dx = xⁿ⁺¹/(n + 1) + c, for n ≠ −1. Constants multiply through; integrate term by term.
- **Constant of integration:** an indefinite integral always ends with + c. A point on the curve fixes c.
- **Definite integral:** ∫ₐᵇ f(x) dx = F(b) − F(a), where F is any antiderivative. No + c is needed.
- **Area under a curve** above the x-axis from a to b is ∫ₐᵇ y dx. Where the curve lies below the axis the integral is negative, so split the area at each root and add the sizes.
- **Area between** a curve y = f(x) and a line y = g(x) is ∫ₐᵇ [f(x) − g(x)] dx, where f is the upper graph and a, b are the intersection points.

## Worked example 1: indefinite integral

Find ∫ (8x³ − 3√x + 5/x²) dx.

Rewrite: 8x³ − 3x^(1/2) + 5x⁻².
Integrate: 2x⁴ − 2x^(3/2) − 5x⁻¹ + c, that is **2x⁴ − 2x^(3/2) − 5/x + c**.

## Worked example 2: area between a line and a curve

Find the area enclosed by y = 5x and y = x².

Intersections: x² = 5x gives x = 0 and x = 5. The line is above the curve between them.
Area = ∫₀⁵ (5x − x²) dx = [5x²/2 − x³/3]₀⁵ = 62.5 − 125/3 = **125/6 ≈ 20.83**.

## Common slips

- Forgetting + c in an indefinite integral.
- Reporting a negative "area": areas are positive, so use the size of each region.
- Using the wrong limits: solve for intersections before integrating.`,
      },
      quiz: {
        title: "Integration: Year 12 quiz",
        questions: [
          S("integ-y12-01", 1, "Find ∫ (6x² + 4x) dx.", ["6x³ + 4x² + c", "12x + 4 + c", "2x³ + 4x² + c", "2x³ + 2x² + c"], "2x³ + 2x² + c", "Raise each power by one and divide by the new power: 6x² gives 2x³, and 4x gives 2x²."),
          S("integ-y12-02", 1, "Find ∫ 1/x² dx.", ["1/x + c", "−2/x³ + c", "−1/x + c", "ln x + c"], "−1/x + c", "Write 1/x² as x⁻², add one to the power to get x⁻¹, and divide by −1."),
          NUM("integ-y12-03", 1, "Evaluate ∫ from 0 to 2 of 3x² dx.", 8, 0, "An antiderivative is x³, so the value is 2³ − 0³ = 8."),
          S("integ-y12-04", 2, "Find ∫ (√x + 6) dx.", ["(3/2)x^(3/2) + 6x + c", "(2/3)x^(1/2) + 6x + c", "½x^(−1/2) + 6x + c", "(2/3)x^(3/2) + 6x + c"], "(2/3)x^(3/2) + 6x + c", "√x = x^(1/2), so it integrates to x^(3/2) ÷ (3/2) = (2/3)x^(3/2); the 6 integrates to 6x.", { diagnostic: true }),
          NUM("integ-y12-05", 2, "A curve has gradient dy/dx = 6x − 4 and passes through (1, 3). Find its y-value when x = 2.", 8, 0, "y = 3x² − 4x + c. At (1, 3): 3 = 3 − 4 + c, so c = 4. Then y(2) = 12 − 8 + 4 = 8."),
          NUM("integ-y12-06", 2, "The shaded region lies under y = x² + 1 between x = 0 and x = 3. Find its area.", 12, 0, "Area = ∫₀³ (x² + 1) dx = [x³/3 + x]₀³ = 9 + 3 = 12.", { diagnostic: true, image: { file: "integ-y12-area.png", alt: "A graph of the curve y = x² + 1 for x from 0 to 3, with the region between the curve, the x-axis and the vertical lines x = 0 and x = 3 shaded." } }),
          NUM("integ-y12-07", 2, "Evaluate ∫ from 1 to 4 of 1/√x dx.", 2, 0, "1/√x = x^(−1/2), which integrates to 2√x. So the value is 2√4 − 2√1 = 4 − 2 = 2."),
          NUM("integ-y12-08", 2, "Find the area enclosed by the line y = 2x and the curve y = x². Give your answer as a decimal to 3 decimal places.", 1.333, 0.0005, "They meet at x = 0 and x = 2, with the line above. Area = ∫₀² (2x − x²) dx = [x² − x³/3]₀² = 4 − 8/3 = 4/3 ≈ 1.333."),
          NUM("integ-y12-09", 3, "Find the total area between the curve y = x² − 4 and the x-axis, for 0 ≤ x ≤ 2. Give a decimal to 3 decimal places.", 5.333, 0.0005, "The curve is below the axis on this interval, so ∫₀² (x² − 4) dx = 8/3 − 8 = −16/3. The area is the size, 16/3 ≈ 5.333."),
          NUM("integ-y12-10", 3, "Find the total area between y = x³ − 7x² + 12x and the x-axis for 0 ≤ x ≤ 4. Give a decimal to 3 decimal places.", 11.833, 0.0005, "y = x(x − 3)(x − 4) changes sign at x = 3. ∫₀³ = 11.25 (above the axis) and ∫₃⁴ = −7/12 (below). Total area = 11.25 + 0.5833 = 11.833."),
          NUM("integ-y12-11", 2, "Given that ∫ from 1 to 5 of f(x) dx = 12, find ∫ from 1 to 5 of (3f(x) + 2) dx.", 44, 0, "Integrals are linear: 3 × 12 + ∫₁⁵ 2 dx = 36 + 2 × 4 = 44."),
          NUM("integ-y12-12", 3, "Given that k > 1 and ∫ from 1 to k of 4x dx = 30, find k.", 4, 0, "[2x²] from 1 to k = 2k² − 2 = 30, so k² = 16 and k = 4 (rejecting −4)."),
          WR("integ-y12-13", 3, "Show that the area of the region enclosed by the curve y = 4x − x² and the x-axis is 32/3.", 3, "Mark scheme (3 marks): (1) The curve meets the x-axis where x(4 − x) = 0, so x = 0 and x = 4. (2) Area = ∫₀⁴ (4x − x²) dx = [2x² − x³/3]₀⁴. (3) = 32 − 64/3 = 32/3, with the region above the axis so no sign change is needed."),
        ],
      },
      flashcards: [
        { front: "∫ xⁿ dx (n ≠ −1)", back: "xⁿ⁺¹/(n + 1) + c" },
        { front: "Why is + c needed?", back: "Constants differentiate to 0, so an antiderivative is only defined up to a constant" },
        { front: "Definite integral rule", back: "∫ₐᵇ f dx = F(b) − F(a)" },
        { front: "Area under a curve above the x-axis", back: "∫ₐᵇ y dx" },
        { front: "The curve dips below the x-axis. How do you find the total area?", back: "Split at the roots and add the sizes (positive values) of each part" },
        { front: "Area between an upper curve f and lower curve g", back: "∫ₐᵇ [f(x) − g(x)] dx between their intersections" },
        { front: "How do you find c from a point on the curve?", back: "Substitute the point into the integrated equation and solve for c" },
        { front: "Rewrite before integrating: 1/x² and √x", back: "x⁻² and x^(1/2)" },
        { front: "∫ₐᵇ k f(x) dx", back: "k ∫ₐᵇ f(x) dx (constants come out)" },
        { front: "Integration is the reverse of…", back: "Differentiation" },
      ],
    },
    13: {
      year: 13,
      objectives: [
        "Integrate eᵏˣ, 1/x, sin kx, cos kx and related functions.",
        "Integrate by substitution and by parts.",
        "Integrate using partial fractions and trigonometric identities.",
        "Set up and solve separable differential equations, including in context.",
        "Use the trapezium rule and decide whether it over- or under-estimates.",
      ],
      note: {
        title: "Year 13: substitution, parts, partial fractions and differential equations",
        body: `## Standard results

- ∫ eᵏˣ dx = eᵏˣ/k + c
- ∫ 1/x dx = ln x + c (for x > 0; in general use the modulus of x)
- ∫ sin kx dx = −cos kx/k + c
- ∫ cos kx dx = sin kx/k + c
- ∫ f′(x)/f(x) dx = ln f(x) + c (again with the modulus if f can be negative)

## Methods

- **Substitution:** choose u, find du = u′ dx, replace every x, and change the limits for a definite integral.
- **By parts:** ∫ u dv/dx dx = uv − ∫ v du/dx dx. Choose u to be the part that simplifies when differentiated (ln x, or a power of x).
- **Partial fractions:** split a rational function, then integrate each ln term.
- **Separable differential equations:** dy/dx = f(x)g(y) gives ∫ 1/g(y) dy = ∫ f(x) dx. Then use the initial condition to find c.
- **Trapezium rule:** ∫ₐᵇ y dx ≈ (h/2)[y₀ + yₙ + 2(y₁ + … + yₙ₋₁)], with h = (b − a)/n. It overestimates for a convex graph (curving up) and underestimates for a concave one.

## Worked example 1: substitution

∫ x/(x² + 4) dx. Let u = x² + 4, du = 2x dx. Then ∫ ½ × 1/u du = ½ ln u + c = **½ ln(x² + 4) + c**.

## Worked example 2: by parts

∫ x cos x dx. Take u = x, dv/dx = cos x, so du/dx = 1 and v = sin x.
= x sin x − ∫ sin x dx = **x sin x + cos x + c**.

## Reminder

Definite integrals with a substitution: either change the limits, or return to x before substituting them.`,
      },
      quiz: {
        title: "Integration: Year 13 quiz",
        questions: [
          S("integ-y13-01", 1, "Find ∫ e^(2x) dx.", ["2e^(2x) + c", "e^(2x) + c", "½e^(2x) + c", "e^(x²) + c"], "½e^(2x) + c", "The integral of e^(kx) is e^(kx)/k, so here it is ½e^(2x) + c."),
          S("integ-y13-02", 1, "Find ∫ 3/x dx, for x > 0.", ["3 ln|x| + c", "−3/x² + c", "ln|3x| + c", "3x ln|x| + c"], "3 ln|x| + c", "The integral of 1/x is ln|x|, and the constant 3 comes out front."),
          S("integ-y13-03", 1, "Find ∫ cos(3x) dx.", ["3 sin(3x) + c", "(1/3) sin(3x) + c", "−(1/3) sin(3x) + c", "(1/3) cos(3x) + c"], "(1/3) sin(3x) + c", "The integral of cos(kx) is sin(kx)/k, so divide by 3."),
          S("integ-y13-04", 2, "Use the substitution u = x² + 1 to find ∫ 2x(x² + 1)⁴ dx.", ["(x² + 1)⁵ + c", "(x² + 1)⁵/10 + c", "8x²(x² + 1)³ + c", "(x² + 1)⁵/5 + c"], "(x² + 1)⁵/5 + c", "With du = 2x dx the integral becomes ∫ u⁴ du = u⁵/5 = (x² + 1)⁵/5 + c.", { diagnostic: true }),
          NUM("integ-y13-05", 2, "Evaluate ∫ from 0 to 1 of 2x e^(x²) dx, to 3 decimal places.", 1.718, 0.0005, "Let u = x², du = 2x dx, limits 0 to 1: ∫₀¹ eᵘ du = e − 1 ≈ 1.718."),
          S("integ-y13-06", 2, "Use integration by parts to find ∫ x e^x dx.", ["x e^x + c", "e^x + c", "(x − 1)e^x + c", "(x + 1)e^x + c"], "(x − 1)e^x + c", "Take u = x, v′ = e^x: x e^x − ∫ e^x dx = x e^x − e^x = (x − 1)e^x."),
          NUM("integ-y13-07", 3, "Evaluate ∫ from 1 to e of ln x dx.", 1, 0, "Write ln x as 1 × ln x and use parts: [x ln x − x] from 1 to e = (e − e) − (0 − 1) = 1."),
          NUM("integ-y13-08", 3, "Use partial fractions to evaluate ∫ from 2 to 3 of 1/((x − 1)(x + 1)) dx, to 3 decimal places.", 0.203, 0.0005, "1/((x − 1)(x + 1)) = ½[1/(x − 1) − 1/(x + 1)]. Integrating gives ½ ln((x − 1)/(x + 1)); between 2 and 3 this is ½(ln ½ − ln ⅓) = ½ ln(3/2) ≈ 0.203."),
          NUM("integ-y13-09", 2, "Solve dy/dx = 2xy with y = 1 when x = 0. Find y when x = 1, to 3 decimal places.", 2.718, 0.0005, "Separate: ∫ 1/y dy = ∫ 2x dx, so ln y = x² + c. With y(0) = 1, c = 0, so y = e^(x²) and y(1) = e ≈ 2.718.", { diagnostic: true }),
          NUM("integ-y13-10", 2, "Use the trapezium rule with 4 equal strips to estimate ∫ from 0 to 2 of 1/(1 + x) dx. Give 3 decimal places.", 1.117, 0.0005, "h = 0.5 and y-values 1, 2/3, 1/2, 2/5, 1/3. Estimate = (0.5/2)[1 + 1/3 + 2(2/3 + 1/2 + 2/5)] ≈ 1.117.", { image: { file: "integ-y13-trap.png", alt: "The curve y = 1/(1 + x) for x from 0 to 2, with four equal-width trapezium strips drawn under it, each strip joining the curve points at x = 0, 0.5, 1, 1.5 and 2 with straight tops." } }),
          S("integ-y13-11", 2, "The trapezium rule is used to estimate ∫ from 0 to 1 of e^x dx. Which statement is correct?", ["It is an underestimate, because the graph is convex", "It gives the exact value for any number of strips", "It is an overestimate, because the chords lie above the convex curve", "It cannot be decided without the exact answer"], "It is an overestimate, because the chords lie above the convex curve", "e^x curves upwards, so each straight-line top lies above the curve and the trapezia have slightly too much area."),
          NUM("integ-y13-12", 3, "Use sin²x = ½(1 − cos 2x) to evaluate ∫ from 0 to π of sin²x dx, to 3 decimal places.", 1.571, 0.0005, "∫ ½(1 − cos 2x) dx = ½x − ¼ sin 2x. Between 0 and π this is π/2 − 0 ≈ 1.571."),
          NUM("integ-y13-13", 3, "Use the substitution u = x + 1 to evaluate ∫ from 0 to 3 of x/√(x + 1) dx, to 3 decimal places.", 2.667, 0.0005, "x = u − 1, limits 1 to 4: ∫ (u − 1)/√u du = ∫ (u^(1/2) − u^(−1/2)) du = [⅔u^(3/2) − 2u^(1/2)] = (16/3 − 4) − (2/3 − 2) = 8/3."),
          WR("integ-y13-14", 3, "Use integration by parts to show that ∫ x ln x dx = ½x² ln x − ¼x² + c.", 4, "Mark scheme (4 marks): (1) Choose u = ln x, dv/dx = x, so du/dx = 1/x and v = ½x². (2) ∫ x ln x dx = ½x² ln x − ∫ ½x² × (1/x) dx. (3) The remaining integral is ∫ ½x dx = ¼x². (4) So the result is ½x² ln x − ¼x² + c, with the constant of integration stated."),
        ],
      },
      flashcards: [
        { front: "∫ eᵏˣ dx", back: "eᵏˣ/k + c" },
        { front: "∫ 1/x dx", back: "ln|x| + c" },
        { front: "∫ sin kx dx and ∫ cos kx dx", back: "−cos kx/k + c and sin kx/k + c" },
        { front: "∫ f′(x)/f(x) dx", back: "ln|f(x)| + c" },
        { front: "Integration by parts", back: "∫ u v′ dx = uv − ∫ v u′ dx" },
        { front: "Which function is u in parts?", back: "The one that gets simpler when differentiated (ln x, or a power of x)" },
        { front: "Substitution with limits", back: "Change the limits to u-values, or go back to x before using them" },
        { front: "Solving dy/dx = f(x)g(y)", back: "Separate: ∫ 1/g(y) dy = ∫ f(x) dx, then use the initial condition" },
        { front: "Trapezium rule", back: "(h/2)[y₀ + yₙ + 2(y₁ + … + yₙ₋₁)]" },
        { front: "Trapezium rule on a convex curve gives…", back: "An overestimate (concave gives an underestimate)" },
      ],
    },
  },
};
