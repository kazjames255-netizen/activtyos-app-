// KS5 Maths — Numerical Methods (Year 13 A2 only). Original content aligned to the DfE GCE AS and A-level mathematics subject content.
// Answer keys are recomputed by _c_numm.ts (run via _check_m4.ts) — re-run after ANY edit here.
import type { CTopic } from "../types";
import { S, NUM, WR } from "./_h4";

export const TOPIC: CTopic = {
  key: "numm",
  topic: "Numerical Methods",
  subject: "Maths",
  years: {
    13: {
      year: 13,
      objectives: [
        "Locate roots of f(x) = 0 by considering changes of sign of f(x) in an interval, and understand when this method fails.",
        "Solve equations approximately using iterative methods xₙ₊₁ = g(xₙ), including rearranging f(x) = 0 into the form x = g(x).",
        "Understand and use staircase and cobweb diagrams, and know when an iteration converges.",
        "Solve equations approximately using the Newton–Raphson method and understand how it can fail.",
      ],
      note: {
        title: "Year 13: solving equations numerically",
        body: `## Change of sign

If f is **continuous** on [a, b] and f(a), f(b) have opposite signs, then f(x) = 0 has at least one root in (a, b).
It can fail when f is **not continuous** (for example 1/x jumps over the axis at an asymptote) or when there are two roots in the interval (the signs cancel).

## Iteration

Rearrange f(x) = 0 into x = g(x), then use **xₙ₊₁ = g(xₙ)**. If it converges to L, then L = g(L).
The iteration converges to a root α when |g′(α)| < 1.
- Staircase diagram: 0 < g′ < 1 (monotonic convergence).
- Cobweb diagram: −1 < g′ < 0 (spiralling in).
- |g′| > 1 moves away from the root.

## Newton–Raphson

**xₙ₊₁ = xₙ − f(xₙ)/f′(xₙ)**, which uses the tangent at xₙ to find the next estimate. It usually converges very quickly, but fails if f′(xₙ) is close to 0 or the start is poor.

## Worked example 1: change of sign

f(x) = 2x³ − 5x − 1. f(1) = −4 and f(2) = 5. The signs differ and f is continuous, so there is a root between 1 and 2.

## Worked example 2: Newton–Raphson

Solve cos x = x, using f(x) = cos x − x and x₀ = 0.7 (radians).
f(0.7) = 0.0648 and f′(x) = −sin x − 1 = −1.6442.
x₁ = 0.7 − 0.0648/(−1.6442) = **0.7394**. The true root is 0.7391 to 4 d.p., so one step is already very close.

## Iterating an example

xₙ₊₁ = 1 + 1/xₙ from x₀ = 1 gives 2, 1.5, 1.667, 1.6, 1.625 ... The values close in on 1.618 (from L² = L + 1) in a cobweb pattern.

## Exam tips

- Work in radians for trig.
- State the interval and the sign values, then "sign change and continuous, so a root".`,
      },
      quiz: {
        title: "Numerical Methods: Year 13 quiz",
        questions: [
          NUM("numm-y13-01", 1, "Let f(x) = x³ − 2x − 5. Evaluate f(2).", -1, 0, "f(2) = 8 − 4 − 5 = −1."),
          S("numm-y13-02", 1, "A continuous function has f(1) = −2 and f(2) = 3. What can you conclude?", ["There is at least one root between x = 1 and x = 2", "The root is exactly x = 1.5", "There is exactly one root between 1 and 2", "There is no root between 1 and 2"], "There is at least one root between x = 1 and x = 2", "A continuous function that changes sign must cross the x-axis, but it could do so more than once, so 'at least one' is the safe conclusion."),
          S("numm-y13-03", 2, "f(x) = 1/(x − 2) has f(1) = −1 and f(3) = 1, yet f(x) = 0 has no root. Why does the change-of-sign test fail here?", ["f(1) and f(3) are too close together", "f has two roots in the interval", "f is not continuous at x = 2", "f is a decreasing function"], "f is not continuous at x = 2", "The graph jumps across the asymptote at x = 2 rather than passing through the x-axis, so the sign change does not imply a root."),
          NUM("numm-y13-04", 2, "The iteration xₙ₊₁ = √(xₙ + 2) starts at x₀ = 1, as in the staircase diagram. Find x₃ to 4 decimal places.", 1.9829, 0.00005, "x₁ = √3 ≈ 1.7321, x₂ = √3.7321 ≈ 1.9319 and x₃ = √3.9319 ≈ 1.9829.", { diagnostic: true, image: { file: "numm-y13-staircase.png", alt: "A staircase diagram: the curve y = √(x + 2) and the straight line y = x, with a stepped path starting at x = 1 on the curve and moving between the curve and the line, climbing to the right towards where the two graphs cross." } }),
          NUM("numm-y13-05", 2, "The equation x² − 3x + 1 = 0 is rearranged as x = 3 − 1/x. Starting with x₀ = 2, find x₃ to 3 decimal places.", 2.615, 0.0005, "x₁ = 3 − 1/2 = 2.5, x₂ = 3 − 1/2.5 = 2.6, and x₃ = 3 − 1/2.6 ≈ 2.615."),
          NUM("numm-y13-06", 2, "Use one step of the Newton–Raphson method with x₀ = 3 for f(x) = x² − 7. Find x₁ to 3 decimal places.", 2.667, 0.0005, "f(3) = 2 and f′(3) = 6, so x₁ = 3 − 2/6 = 2.667."),
          NUM("numm-y13-07", 2, "Apply one step of Newton–Raphson to f(x) = x³ − 2x − 5 with x₀ = 2. Find x₁.", 2.1, 0, "f(2) = −1 and f′(x) = 3x² − 2 = 10 at x = 2. Then x₁ = 2 − (−1)/10 = 2.1.", { diagnostic: true }),
          S("numm-y13-08", 3, "For f(x) = x³ − 2x − 5, f(2.09) ≈ −0.051 and f(2.095) ≈ 0.005. To 2 decimal places, the root of f(x) = 0 is:", ["2.10", "2.09", "2.095", "2.00"], "2.09", "The sign change between 2.09 and 2.095 puts the root below 2.095, so it rounds to 2.09, not 2.10."),
          S("numm-y13-09", 3, "The root of x³ − 2x − 5 = 0 is near 2.09. Which iteration will converge to it?", ["xₙ₊₁ = (xₙ³ − 5)/2", "xₙ₊₁ = (2xₙ + 5)^(1/3)", "xₙ₊₁ = 5/(xₙ² − 2)", "xₙ₊₁ = 2xₙ + 5 − xₙ³ + xₙ"], "xₙ₊₁ = (2xₙ + 5)^(1/3)", "Convergence needs |g′| < 1 at the root. For g(x) = (2x + 5)^(1/3), |g′| ≈ 0.16, but for (x³ − 5)/2, |g′| ≈ 6.6 so it moves away."),
          S("numm-y13-10", 3, "Newton–Raphson is applied to f(x) = x³ − 2x + 2 with x₀ = 0. Which describes the sequence?", ["It converges to the root quickly", "It alternates between 0 and 1 forever", "It diverges to infinity", "It stops because f′(x₀) = 0"], "It alternates between 0 and 1 forever", "x₁ = 0 − 2/(−2) = 1 and x₂ = 1 − 1/1 = 0, so the values repeat 0, 1, 0, 1, ... without converging."),
          NUM("numm-y13-11", 3, "Use one Newton–Raphson step for f(x) = eˣ − 3x with x₀ = 1.5. Find x₁ to 4 decimal places.", 1.5124, 0.00005, "f(1.5) = 4.4817 − 4.5 = −0.0183 and f′(1.5) = e^1.5 − 3 = 1.4817. So x₁ = 1.5 + 0.0183/1.4817 ≈ 1.5124."),
          NUM("numm-y13-12", 2, "The sequence xₙ₊₁ = √(6 + xₙ) with x₀ = 1 converges to a limit L > 0. Find L.", 3, 0, "At the limit L = √(6 + L), so L² − L − 6 = 0, giving (L − 3)(L + 2) = 0. The positive solution is L = 3."),
          WR("numm-y13-13", 3, "Show that x³ + x − 3 = 0 has a root between 1 and 2. Then use one Newton–Raphson step from x₀ = 1.5 to find a better estimate, correct to 3 decimal places.", 4, "Mark scheme (4 marks): (1) f(1) = −1 and f(2) = 7: a change of sign for a continuous function, so a root in (1, 2). (2) f′(x) = 3x² + 1, so f′(1.5) = 7.75. (3) f(1.5) = 1.875. (4) x₁ = 1.5 − 1.875/7.75 ≈ 1.258."),
          S("numm-y13-14", 1, "Which is the Newton–Raphson formula?", ["xₙ₊₁ = xₙ − f′(xₙ)/f(xₙ)", "xₙ₊₁ = xₙ + f(xₙ)/f′(xₙ)", "xₙ₊₁ = f(xₙ)/f′(xₙ)", "xₙ₊₁ = xₙ − f(xₙ)/f′(xₙ)"], "xₙ₊₁ = xₙ − f(xₙ)/f′(xₙ)", "The tangent at xₙ meets the x-axis at xₙ − f(xₙ)/f′(xₙ), which becomes the next estimate."),
        ],
      },
      flashcards: [
        { front: "Change-of-sign test", back: "If f is continuous and f(a), f(b) have opposite signs, there is a root in (a, b)" },
        { front: "Two ways the change-of-sign test can mislead", back: "A discontinuity in the interval (such as an asymptote), or an even number of roots" },
        { front: "Iterative formula", back: "xₙ₊₁ = g(xₙ), from rearranging f(x) = 0 into x = g(x)" },
        { front: "If an iteration converges to L then…", back: "L = g(L)" },
        { front: "Condition for convergence to α", back: "|g′(α)| < 1" },
        { front: "Staircase vs cobweb", back: "Staircase: 0 < g′ < 1, one-sided approach. Cobweb: −1 < g′ < 0, oscillating approach." },
        { front: "Newton–Raphson formula", back: "xₙ₊₁ = xₙ − f(xₙ)/f′(xₙ)" },
        { front: "Geometric idea behind Newton–Raphson", back: "Follow the tangent at xₙ down to the x-axis" },
        { front: "When can Newton–Raphson fail?", back: "f′(xₙ) near 0 (tangent almost flat), a poor starting value, or a cycle" },
        { front: "Angle mode for numerical methods with trig", back: "Radians" },
      ],
    },
  },
};
