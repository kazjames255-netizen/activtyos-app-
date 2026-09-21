// KS5 Maths — Differentiation (Year 12 AS, Year 13 A2). Original content aligned to the DfE GCE AS and A-level mathematics subject content.
// Answer keys are recomputed by _c_diff.ts (run via _check_m4.ts) — re-run after ANY edit here.
import type { CTopic } from "../types";
import { S, NUM, SH, WR, variants } from "./_h4";

export const TOPIC: CTopic = {
  key: "diff",
  topic: "Differentiation",
  subject: "Maths",
  years: {
    12: {
      year: 12,
      objectives: [
        "Understand the derivative as the gradient of a tangent and as a rate of change; differentiate from first principles for small positive integer powers of x.",
        "Differentiate xⁿ for rational n, and sums, differences and constant multiples of such terms.",
        "Find equations of tangents and normals to curves.",
        "Identify increasing and decreasing functions, and stationary points; use the second derivative to classify maxima and minima.",
        "Solve optimisation problems by differentiation.",
      ],
      note: {
        title: "Year 12: differentiating powers, tangents and stationary points",
        body: `## Key ideas

The **derivative** dy/dx (or f′(x)) gives the gradient of the tangent to y = f(x), and so the rate at which y changes with x.

- **First principles:** f′(x) = lim(h→0) [f(x + h) − f(x)] / h.
- **Power rule:** if y = axⁿ then dy/dx = anxⁿ⁻¹, for any rational n. Rewrite roots and reciprocals first: √x = x^(1/2), 1/x³ = x⁻³.
- **Tangent** at x = a: gradient m = f′(a), then y − f(a) = m(x − a). The **normal** has gradient −1/m.
- **Stationary points** have f′(x) = 0. Then f″(x) > 0 means a local minimum, f″(x) < 0 a local maximum. If f″(x) = 0 you must check the sign of f′ either side.
- f is **increasing** where f′(x) > 0 and **decreasing** where f′(x) < 0.

## Worked example 1: differentiating

Differentiate y = 2x⁵ + 9/x − 4√x.

Rewrite: y = 2x⁵ + 9x⁻¹ − 4x^(1/2).
dy/dx = 10x⁴ − 9x⁻² − 2x^(−1/2) = **10x⁴ − 9/x² − 2/√x**.

## Worked example 2: stationary points

Find and classify the stationary points of y = 2x³ − 9x² + 12x.

dy/dx = 6x² − 18x + 12 = 6(x − 1)(x − 2) = 0, so x = 1 or x = 2.
d²y/dx² = 12x − 18.
- x = 1: −6 < 0, a **maximum**, at (1, 5).
- x = 2: +6 > 0, a **minimum**, at (2, 4).

## Optimisation checklist

1. Write the quantity to optimise, then eliminate to one variable.
2. Differentiate and set the derivative to zero.
3. Justify max or min with the second derivative.
4. Answer in the context of the question, with units.`,
      },
      quiz: {
        title: "Differentiation: Year 12 quiz",
        questions: [
          S("diff-y12-01", 1, "Differentiate y = 5x³ − 2x with respect to x.", ["15x² − 2", "15x³ − 2", "5x² − 2", "15x² − 2x"], "15x² − 2", "Multiply by the power and reduce it by one: 5x³ gives 15x², and −2x gives −2.")
          ,
          S("diff-y12-02", 1, "Find dy/dx when y = 6/x².", ["12x⁻³", "−12x⁻³", "−12x⁻¹", "−3x⁻³"], "−12x⁻³", "Write y = 6x⁻², then multiply by −2 and reduce the power: −12x⁻³.")
          ,
          S("diff-y12-03", 1, "Differentiation from first principles defines f′(x) as which limit?", ["lim(h→0) [f(x + h) + f(x)] / h", "lim(h→0) [f(x + h) − f(x)] × h", "lim(h→0) [f(x + h) − f(x)] / h", "lim(h→∞) [f(x + h) − f(x)] / h"], "lim(h→0) [f(x + h) − f(x)] / h", "The gradient of the chord from x to x + h is the change in f over the change in x, and h shrinks to zero.")
          ,
          NUM("diff-y12-04", 2, "The curve y = 2x³ − 5x has gradient function dy/dx = 6x² − 5. What is the gradient of the curve at x = 2?", 19, 0, "Substitute x = 2 into 6x² − 5: 6 × 4 − 5 = 19.", { diagnostic: true }),
          S("diff-y12-05", 2, "Find the equation of the tangent to y = x² + 3x at the point where x = 1.", ["y = 5x + 4", "y = 5x − 1", "y = 2x + 2", "y = 5x − 9"], "y = 5x − 1", "dy/dx = 2x + 3 = 5 at x = 1, and y = 4. So y − 4 = 5(x − 1), giving y = 5x − 1.", { diagnostic: true }),
          NUM("diff-y12-06", 2, "The normal to y = x² at the point (2, 4) meets the y-axis at (0, k). Find k as a decimal.", 4.5, 0, "The tangent gradient is 2x = 4, so the normal gradient is −1/4. From (2, 4) go back 2 across: k = 4 + ¼ × 2 = 4.5."),
          NUM("diff-y12-07", 2, "Find the y-coordinate of the local minimum of y = x³ − 12x.", -16, 0, "dy/dx = 3x² − 12 = 0 gives x = ±2. d²y/dx² = 6x is positive at x = 2, so it is the minimum: y = 8 − 24 = −16."),
          S("diff-y12-08", 2, "For which values of x is y = x³ − 3x² − 9x an increasing function?", ["−1 < x < 3", "x < 1 or x > 3", "x > 3", "x < −1 or x > 3"], "x < −1 or x > 3", "dy/dx = 3(x − 3)(x + 1) is positive when both factors have the same sign, so x < −1 or x > 3."),
          S("diff-y12-09", 2, "Find d²y/dx² when y = x⁴ − 2x³.", ["4x³ − 6x²", "12x² − 6x", "12x² − 12x", "24x − 12"], "12x² − 12x", "First derivative 4x³ − 6x², second derivative 12x² − 12x."),
          NUM("diff-y12-10", 3, "An open-topped box has a square base of side x m and volume 32 m³. Its surface area is S = x² + 128/x. Find the least possible surface area in m².", 48, 0, "dS/dx = 2x − 128/x² = 0 gives x³ = 64, so x = 4. Then S = 16 + 32 = 48, and d²S/dx² > 0 confirms a minimum."),
          WR("diff-y12-11", 3, "Prove from first principles that the derivative of f(x) = x³ is 3x².", 4, "Mark scheme (4 marks): (1) [f(x + h) − f(x)]/h = [(x + h)³ − x³]/h. (2) Expand (x + h)³ = x³ + 3x²h + 3xh² + h³. (3) Simplify to (3x²h + 3xh² + h³)/h = 3x² + 3xh + h². (4) As h → 0 the last two terms vanish, so f′(x) = 3x²."),
          NUM("diff-y12-12", 3, "The curve y = x³ + px² + qx has stationary points at x = 1 and x = 3. Find p + q.", 3, 0, "dy/dx = 3x² + 2px + q must equal 3(x − 1)(x − 3) = 3x² − 12x + 9. So p = −6 and q = 9, giving p + q = 3."),
          NUM("diff-y12-13", 2, "The tangent to the curve at P(3, 2) is drawn and passes through the labelled points (2, 0) and (4, 4). What is the gradient of the curve at P?", 2, 0, "The gradient of the tangent is the rise over the run between two points on it: (4 − 0)/(4 − 2) = 2. (This agrees with dy/dx = 2x − 4 at x = 3.)", { image: { file: "diff-y12-tangent.png", alt: "The curve y = x² − 4x + 5 drawn on a grid, with the point P(3, 2) marked and a straight tangent line through P that also passes through the marked points (2, 0) and (4, 4)." } }),
        ],
      },
      flashcards: [
        { front: "First-principles definition of f′(x)", back: "lim(h→0) [f(x + h) − f(x)] / h" },
        { front: "Derivative of axⁿ", back: "anxⁿ⁻¹ (multiply by the power, reduce the power by 1)" },
        { front: "Rewrite before differentiating: 1/x³ and √x", back: "x⁻³ and x^(1/2)" },
        { front: "Gradient of the normal, if the tangent has gradient m", back: "−1/m (perpendicular gradients multiply to −1)" },
        { front: "Equation of the tangent at x = a", back: "y − f(a) = f′(a)(x − a)" },
        { front: "How do you find stationary points?", back: "Solve f′(x) = 0" },
        { front: "Second derivative test", back: "f″ > 0: minimum. f″ < 0: maximum. f″ = 0: inconclusive, check the sign of f′ either side." },
        { front: "Where is f increasing?", back: "Where f′(x) > 0" },
        { front: "Steps for an optimisation problem", back: "Form one-variable function, differentiate, set to 0, test max/min, answer in context" },
        { front: "What does dy/dx measure?", back: "The rate of change of y with respect to x (gradient of the tangent)" },
      ],
    },
    13: {
      year: 13,
      objectives: [
        "Differentiate eˣ, aˣ, ln x, sin x, cos x, tan x (and eᵏˣ, sin kx etc.) from the standard results.",
        "Use the chain rule, product rule and quotient rule.",
        "Differentiate implicitly defined and parametrically defined curves.",
        "Use differentiation to solve connected rates of change problems.",
        "Find and interpret second derivatives, including points of inflection.",
      ],
      note: {
        title: "Year 13: chain, product and quotient rules, implicit and parametric",
        body: `## Key results

| f(x) | f′(x) |
| --- | --- |
| eᵏˣ | k eᵏˣ |
| ln x | 1/x |
| sin kx | k cos kx |
| cos kx | −k sin kx |
| tan x | sec² x |

- **Chain rule:** dy/dx = dy/du × du/dx.
- **Product rule:** (uv)′ = u′v + uv′.
- **Quotient rule:** (u/v)′ = (u′v − uv′) / v².
- **Parametric:** dy/dx = (dy/dt) / (dx/dt).
- **Implicit:** differentiate every term with respect to x, treating y as a function of x, so d(y²)/dx = 2y dy/dx.
- **Connected rates:** dA/dt = dA/dr × dr/dt.
- At a **point of inflection** f″(x) = 0 and the sign of f″ changes.

## Worked example 1: chain rule

y = (4x − 1)⁷. Let u = 4x − 1, so y = u⁷: dy/du = 7u⁶ and du/dx = 4.
dy/dx = 28(4x − 1)⁶.

## Worked example 2: implicit differentiation

Find the gradient of x² + 3xy = 10 at (1, 3).

Differentiate: 2x + 3y + 3x dy/dx = 0. Substitute x = 1, y = 3: 2 + 9 + 3 dy/dx = 0, so dy/dx = **−11/3**.

## Tips

- Spot a function of a function (chain), two functions multiplied (product) or divided (quotient).
- For tan x = sin x / cos x the quotient rule gives sec² x.
- Convert the angle mode: the standard trig derivatives need **radians**.
- After differentiating, factorise out any common bracket: it makes stationary points much easier to find.`,
      },
      quiz: {
        title: "Differentiation: Year 13 quiz",
        questions: [
          S("diff-y13-01", 1, "Differentiate y = e^(3x).", ["3e^(3x)", "e^(3x)", "3xe^(3x−1)", "e^(3x)/3"], "3e^(3x)", "The derivative of e^(kx) is k e^(kx), so here k = 3."),
          S("diff-y13-02", 1, "Differentiate y = ln(5x).", ["1/(5x)", "5/x", "ln 5", "1/x"], "1/x", "ln(5x) = ln 5 + ln x, and ln 5 is a constant, so the derivative is 1/x. (The chain rule gives 5 × 1/(5x) = 1/x.)"),
          S("diff-y13-03", 1, "Differentiate y = sin(2x). (x in radians)", ["−2cos(2x)", "2sin(2x)", "cos(2x)", "2cos(2x)"], "2cos(2x)", "d/dx sin(kx) = k cos(kx), so the derivative is 2cos(2x)."),
          S("diff-y13-04", 2, "Use the chain rule to differentiate y = (3x² + 1)⁵.", ["5(3x² + 1)⁴", "30x(3x² + 1)⁴", "30x(3x² + 1)⁵", "15x²(3x² + 1)⁴"], "30x(3x² + 1)⁴", "Outer: 5u⁴; inner: 6x. Multiply: 30x(3x² + 1)⁴.", { diagnostic: true }),
          S("diff-y13-05", 2, "Use the product rule to differentiate y = x²e^x.", ["2xe^x", "x²e^x", "(x² + 2x)e^x", "(x² − 2x)e^x"], "(x² + 2x)e^x", "u = x², v = e^x: u′v + uv′ = 2xe^x + x²e^x = (x² + 2x)e^x."),
          S("diff-y13-06", 2, "Differentiate y = (sin x)/x.", ["(x cos x − sin x)/x²", "(x cos x + sin x)/x²", "cos x", "(sin x − x cos x)/x²"], "(x cos x − sin x)/x²", "Quotient rule with u = sin x, v = x: (u′v − uv′)/v² = (x cos x − sin x)/x²."),
          NUM("diff-y13-07", 2, "Find the gradient of y = x ln x at the point where x = e.", 2, 0, "Product rule: dy/dx = ln x + x × 1/x = ln x + 1. At x = e this is 1 + 1 = 2."),
          NUM("diff-y13-08", 3, "The curve x² + xy + y² = 7 passes through (1, 2). Find dy/dx at this point, as a decimal.", -0.8, 0, "Differentiate implicitly: 2x + y + x dy/dx + 2y dy/dx = 0. At (1, 2): 2 + 2 + 5 dy/dx = 0, so dy/dx = −4/5 = −0.8."),
          NUM("diff-y13-09", 2, "A curve has parametric equations x = t², y = t³ − 3t. Find dy/dx when t = 2. Give your answer as a decimal.", 2.25, 0, "dy/dt = 3t² − 3 = 9 and dx/dt = 2t = 4 at t = 2, so dy/dx = 9/4 = 2.25.", { diagnostic: true }),
          NUM("diff-y13-10", 3, "The volume of a sphere, V = (4/3)πr³, increases at 12 cm³ per second. Find the rate of increase of the radius, in cm per second to 3 decimal places, when r = 3 cm.", 0.106, 0.0005, "dV/dr = 4πr² = 36π at r = 3. Then dr/dt = dV/dt ÷ dV/dr = 12/(36π) = 1/(3π) ≈ 0.106."),
          NUM("diff-y13-11", 2, "Find the value of x at the point of inflection of y = 2x³ − 9x² + 5x.", 1.5, 0, "y′ = 6x² − 18x + 5 and y″ = 12x − 18. Setting y″ = 0 gives x = 1.5, and y″ changes sign there."),
          NUM("diff-y13-12", 3, "The tangent to y = ln(x² + 1) at x = 1 meets the y-axis at (0, c). Find c to 3 decimal places.", -0.307, 0.0005, "dy/dx = 2x/(x² + 1) = 1 at x = 1, and y = ln 2. The tangent is y − ln 2 = x − 1, so c = ln 2 − 1 ≈ −0.307."),
          WR("diff-y13-13", 3, "Show that d/dx (sec x) = sec x tan x.", 3, "Mark scheme (3 marks): (1) Write sec x = (cos x)⁻¹. (2) Chain rule: d/dx = −(cos x)⁻² × (−sin x). (3) = sin x / cos² x = (1/cos x)(sin x/cos x) = sec x tan x. (Quotient rule on 1/cos x is equally acceptable.)"),
        ],
      },
      flashcards: [
        { front: "d/dx of e^(kx)", back: "k e^(kx)" },
        { front: "d/dx of ln x", back: "1/x" },
        { front: "d/dx of sin kx and cos kx", back: "k cos kx and −k sin kx (radians)" },
        { front: "d/dx of tan x", back: "sec² x" },
        { front: "Chain rule", back: "dy/dx = dy/du × du/dx" },
        { front: "Product rule", back: "(uv)′ = u′v + uv′" },
        { front: "Quotient rule", back: "(u/v)′ = (u′v − uv′)/v²" },
        { front: "Parametric gradient", back: "dy/dx = (dy/dt) ÷ (dx/dt)" },
        { front: "Implicit differentiation: d(y²)/dx", back: "2y dy/dx" },
        { front: "Point of inflection test", back: "f″(x) = 0 and f″ changes sign" },
      ],
    },
  },
};
export { SH, variants };
