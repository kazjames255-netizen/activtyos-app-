// KS5 Maths — Trigonometry (Year 12 AS, Year 13 A2). Original content aligned to the DfE GCE AS and A-level mathematics subject content.
// Answer keys are recomputed by _c_trig.ts — re-run after ANY edit here.
import type { CTopic } from "../types";
import { S, NUM, WR } from "./_h4";

export const TOPIC: CTopic = {
  key: "trig",
  topic: "Trigonometry",
  subject: "Maths",
  years: {
    12: {
      year: 12,
      objectives: [
        "Work with radian measure, including arc length s = rθ and sector area A = ½r²θ.",
        "Know the exact values of sin, cos and tan for 0, 30°, 45°, 60°, 90° and their radian equivalents.",
        "Sketch and use the graphs of sin x, cos x and tan x, including symmetries and periodicity.",
        "Use the identities tan θ = sin θ / cos θ and sin²θ + cos²θ = 1.",
        "Solve simple trigonometric equations in a given interval, including quadratics in sin θ or cos θ.",
        "Use the sine rule, the cosine rule and area = ½ab sin C to solve triangles.",
      ],
      note: {
        title: "Year 12: radians, identities, equations and triangles",
        body: `## Key results

- **Radians:** 180° = π radians. Arc length s = rθ and sector area A = ½r²θ, with θ in radians.
- **Exact values:** sin 30° = ½, sin 45° = √2/2, sin 60° = √3/2. cos is the same list reversed. tan 30° = √3/3, tan 45° = 1, tan 60° = √3.
- **Identities:** tan θ ≡ sin θ / cos θ and sin²θ + cos²θ ≡ 1.
- **Graphs:** sin and cos repeat every 360° (2π) and lie between −1 and 1. tan repeats every 180° (π) and has asymptotes at 90° and 270°.
- **Triangle rules** (sides a, b, c opposite angles A, B, C):
  - Sine rule: a/sin A = b/sin B = c/sin C.
  - Cosine rule: a² = b² + c² − 2bc cos A.
  - Area = ½ab sin C.

## Solving equations

1. Isolate sin θ, cos θ or tan θ.
2. Use your calculator for the principal value.
3. Use the graph or CAST symmetry for the other solutions in the range: for sine, 180° − θ; for cosine, 360° − θ; for tan, add 180°.
4. For a quadratic, factorise first, and reject any value outside −1 to 1.

## Worked example 1: sector

A sector has radius 10 cm and angle 0.9 radians. Arc length = 10 × 0.9 = **9 cm**. Area = ½ × 100 × 0.9 = **45 cm²**.

## Worked example 2: an equation

Solve 3 sin θ = 2 for 0° ≤ θ ≤ 360°.
sin θ = 2/3, so the principal value is 41.8°. The second solution is 180° − 41.8° = 138.2°.
Answer: **θ = 41.8° or 138.2°**.

## Reminder

Check your calculator is in the right mode: degrees for degree questions, radians when the interval uses π.`,
      },
      quiz: {
        title: "Trigonometry: Year 12 quiz",
        questions: [
          S("trig-y12-01", 1, "Convert 135° into radians.", ["π/4", "2π/3", "3π/4", "5π/6"], "3π/4", "Multiply by π/180: 135 × π/180 = 3π/4."),
          S("trig-y12-02", 1, "What is the exact value of sin 60°?", ["1/2", "√3/2", "√2/2", "1"], "√3/2", "sin 60° = √3/2, from the half of an equilateral triangle of side 2 (opposite √3, hypotenuse 2)."),
          S("trig-y12-03", 1, "Which expression is identical to tan θ?", ["sin θ / cos θ", "cos θ / sin θ", "sin θ × cos θ", "1 / sin θ"], "sin θ / cos θ", "The tangent of an angle is opposite ÷ adjacent, which equals sin θ ÷ cos θ."),
          NUM("trig-y12-04", 2, "A circle has radius 8 cm. Find the length of the arc that subtends an angle of 0.75 radians at the centre, in cm.", 6, 0, "Arc length s = rθ = 8 × 0.75 = 6 cm.", { diagnostic: true }),
          NUM("trig-y12-05", 2, "The shaded sector has radius 6 cm and angle 1.2 radians at the centre. Find its area in cm².", 21.6, 0, "Area = ½r²θ = ½ × 36 × 1.2 = 21.6 cm².", { image: { file: "trig-y12-sector.png", alt: "A circular sector with its centre at the top, two straight edges each labelled 6 cm, and the angle between them labelled 1.2 rad; the sector is shaded." }, diagnostic: true }),
          NUM("trig-y12-06", 2, "Solve 2 cos θ = 1 for 0° ≤ θ ≤ 360°. Give the larger of the two solutions in degrees.", 300, 0, "cos θ = ½ gives θ = 60° and, by symmetry, 360° − 60° = 300°. The larger is 300°."),
          S("trig-y12-07", 2, "Simplify sin²θ / (1 − sin²θ).", ["cos²θ", "sin²θ", "1/tan²θ", "tan²θ"], "tan²θ", "1 − sin²θ = cos²θ, so the expression is sin²θ / cos²θ = tan²θ."),
          NUM("trig-y12-08", 2, "In triangle ABC, AB = 6 cm, AC = 10 cm and angle BAC = 65°. Find the length BC, in cm, to 3 decimal places.", 9.235, 0.0005, "Cosine rule: BC² = 6² + 10² − 2 × 6 × 10 × cos 65° = 136 − 120 cos 65° ≈ 85.29, so BC ≈ 9.235 cm.", { image: { file: "trig-y12-triangle.png", alt: "A triangle ABC with AB labelled 6 cm, AC labelled 10 cm, the angle at A labelled 65° and the side BC marked with a question mark." } }),
          NUM("trig-y12-09", 2, "In triangle ABC, angle A = 40°, angle B = 75° and BC = 8 cm (BC is opposite angle A). Find the length AC, in cm, to 2 decimal places.", 12.02, 0.005, "AC is opposite B. Sine rule: AC / sin 75° = 8 / sin 40°, so AC = 8 sin 75° / sin 40° ≈ 12.02 cm."),
          NUM("trig-y12-10", 3, "Solve 2 sin²θ + sin θ − 1 = 0 for 0° ≤ θ < 360°. Find the sum of all the solutions, in degrees.", 450, 0, "Factorise: (2 sin θ − 1)(sin θ + 1) = 0, so sin θ = ½ (θ = 30°, 150°) or sin θ = −1 (θ = 270°). The sum is 450°."),
          NUM("trig-y12-11", 3, "Solve sin 2x = 0.5 for 0° ≤ x ≤ 360°. Find the sum of all the solutions, in degrees.", 540, 0, "Let u = 2x, with 0° ≤ u ≤ 720°. sin u = 0.5 gives u = 30°, 150°, 390°, 510°, so x = 15°, 75°, 195°, 255°. The sum is 540°."),
          NUM("trig-y12-12", 3, "A triangle has sides 5 cm, 7 cm and 9 cm. Find its largest angle, in degrees to 1 decimal place.", 95.7, 0.05, "The largest angle is opposite the 9 cm side: cos C = (5² + 7² − 9²)/(2 × 5 × 7) = −7/70 = −0.1, so C ≈ 95.7°."),
          WR("trig-y12-13", 3, "Prove that sin θ/(1 + cos θ) + (1 + cos θ)/sin θ ≡ 2/sin θ.", 3, "Mark scheme (3 marks): (1) Common denominator: [sin²θ + (1 + cos θ)²] / [sin θ (1 + cos θ)]. (2) Expand the numerator: sin²θ + 1 + 2 cos θ + cos²θ = 2 + 2 cos θ using sin²θ + cos²θ = 1. (3) Factorise 2(1 + cos θ) and cancel with the denominator to get 2/sin θ."),
        ],
      },
      flashcards: [
        { front: "180° in radians", back: "π radians" },
        { front: "Arc length and sector area (θ in radians)", back: "s = rθ and A = ½r²θ" },
        { front: "sin 30°, sin 45°, sin 60°", back: "½, √2/2, √3/2" },
        { front: "tan 45° and tan 60°", back: "1 and √3" },
        { front: "The two main trig identities", back: "tan θ ≡ sin θ / cos θ and sin²θ + cos²θ ≡ 1" },
        { front: "Period of sin, cos and tan", back: "360° (2π), 360° (2π) and 180° (π)" },
        { front: "Sine rule", back: "a/sin A = b/sin B = c/sin C" },
        { front: "Cosine rule", back: "a² = b² + c² − 2bc cos A" },
        { front: "Area of a triangle from two sides and the included angle", back: "½ab sin C" },
        { front: "Second solution of sin θ = k in 0° to 360°", back: "180° − θ" },
      ],
    },
    13: {
      year: 13,
      objectives: [
        "Use the reciprocal functions sec, cosec and cot, and the identities sec²θ = 1 + tan²θ and cosec²θ = 1 + cot²θ.",
        "Use the addition (compound angle) formulae and the double angle formulae.",
        "Write a sin θ + b cos θ in the form R sin(θ ± α) or R cos(θ ± α) and use it to solve equations and find maxima and minima.",
        "Understand and use arcsin, arccos and arctan with their domains and ranges.",
        "Use small-angle approximations for sin, cos and tan (θ in radians).",
        "Prove simple trigonometric identities.",
      ],
      note: {
        title: "Year 13: reciprocal functions, compound angles and the R form",
        body: `## Key results

- **Reciprocals:** sec θ = 1/cos θ, cosec θ = 1/sin θ, cot θ = 1/tan θ = cos θ / sin θ.
- **Identities:** sec²θ = 1 + tan²θ and cosec²θ = 1 + cot²θ.
- **Addition formulae:** sin(A ± B) = sin A cos B ± cos A sin B. cos(A ± B) = cos A cos B ∓ sin A sin B.
- **Double angle:** sin 2A = 2 sin A cos A. cos 2A = cos²A − sin²A = 2cos²A − 1 = 1 − 2sin²A.
- **R form:** a sin θ + b cos θ = R sin(θ + α), where R = √(a² + b²), R cos α = a and R sin α = b. The greatest value is R and the least is −R.
- **Inverse functions:** arcsin has range −90° to 90°, arccos has range 0° to 180°, arctan has range −90° to 90°.
- **Small angles** (radians): sin θ ≈ θ, tan θ ≈ θ, cos θ ≈ 1 − θ²/2.

## Worked example 1: an exact value

Find sin 15° exactly. Write 15° = 45° − 30°.
sin 15° = sin 45° cos 30° − cos 45° sin 30° = (√2/2)(√3/2) − (√2/2)(½) = **(√6 − √2)/4**.

## Worked example 2: the R form

Write sin θ + √3 cos θ as R sin(θ + α).
R = √(1 + 3) = 2, and R cos α = 1, R sin α = √3, so tan α = √3 and α = 60°.
So sin θ + √3 cos θ = **2 sin(θ + 60°)**. The maximum value is 2, at θ = 30°.

## Tips

- To solve an equation of the form a sin θ + b cos θ = c, write it as R sin(θ + α) = c and work with θ + α.
- A "quadratic in sec" or "in tan" often appears after using sec²θ = 1 + tan²θ.
- Remember to convert the interval: for θ + α, shift the range by α.`,
      },
      quiz: {
        title: "Trigonometry: Year 13 quiz",
        questions: [
          S("trig-y13-01", 1, "cosec θ is defined as:", ["cos θ / sin θ", "1 / sin θ", "1 / cos θ", "sin θ / cos θ"], "1 / sin θ", "cosec is the reciprocal of sine. (1/cos θ is sec θ and cos θ / sin θ is cot θ.)"),
          NUM("trig-y13-02", 1, "Find the value of sec 60°.", 2, 0, "sec 60° = 1 / cos 60° = 1 / ½ = 2."),
          S("trig-y13-03", 1, "Which expression is identical to sec²θ?", ["1 − tan²θ", "tan²θ − 1", "1 + cot²θ", "1 + tan²θ"], "1 + tan²θ", "Divide sin²θ + cos²θ = 1 by cos²θ to obtain tan²θ + 1 = sec²θ."),
          NUM("trig-y13-04", 2, "Angles A and B are acute, with sin A = 3/5 and sin B = 5/13. Find sin(A + B) to 4 decimal places.", 0.8615, 0.00005, "cos A = 4/5 and cos B = 12/13. sin(A + B) = (3/5)(12/13) + (4/5)(5/13) = 56/65 ≈ 0.8615.", { diagnostic: true }),
          NUM("trig-y13-05", 2, "Given that sin θ = 0.6, find the value of cos 2θ.", 0.28, 0, "Use cos 2θ = 1 − 2sin²θ = 1 − 2 × 0.36 = 0.28.", { diagnostic: true }),
          NUM("trig-y13-06", 2, "Write 3 sin θ + 4 cos θ in the form R sin(θ + α) with R > 0 and 0° < α < 90°. Find α in degrees, to 2 decimal places.", 53.13, 0.005, "R cos α = 3 and R sin α = 4, so tan α = 4/3 and α = 53.13° (with R = 5)."),
          NUM("trig-y13-07", 3, "The graph shows y = 3 sin θ + 4 cos θ and the line y = 2. Solve 3 sin θ + 4 cos θ = 2 for 0° ≤ θ ≤ 360°. Give the larger solution in degrees, to 1 decimal place.", 330.4, 0.05, "Write it as 5 sin(θ + 53.13°) = 2, so sin(θ + 53.13°) = 0.4. θ + 53.13° = 23.58° or 156.42° or 383.58°, giving θ = 103.3° or 330.4° (the value −29.6° is out of range).", { image: { file: "trig-y13-rform.png", alt: "A graph of y = 3 sin θ + 4 cos θ for θ from 0° to 360°, a wave that starts at 4, rises to a maximum and falls below zero, with a horizontal dashed line at y = 2 crossing it twice." } }),
          S("trig-y13-08", 2, "What is the value of arccos(−½), in radians?", ["2π/3", "π/3", "−π/3", "−2π/3"], "2π/3", "arccos has range 0 to π. cos(2π/3) = −½, and 2π/3 lies in that range."),
          NUM("trig-y13-09", 3, "For small θ (in radians), use the approximation cos θ ≈ 1 − θ²/2 to find the limit of (1 − cos 3θ)/θ² as θ → 0. Give your answer as a decimal.", 4.5, 0, "cos 3θ ≈ 1 − (3θ)²/2 = 1 − 4.5θ², so 1 − cos 3θ ≈ 4.5θ², and dividing by θ² gives 4.5."),
          WR("trig-y13-10", 3, "Prove that cos 3θ ≡ 4cos³θ − 3cos θ.", 4, "Mark scheme (4 marks): (1) cos 3θ = cos(2θ + θ) = cos 2θ cos θ − sin 2θ sin θ. (2) Substitute cos 2θ = 2cos²θ − 1 and sin 2θ = 2 sin θ cos θ: (2cos²θ − 1)cos θ − 2 sin²θ cos θ. (3) Replace sin²θ by 1 − cos²θ: 2cos³θ − cos θ − 2cos θ + 2cos³θ. (4) Simplify to 4cos³θ − 3cos θ."),
          NUM("trig-y13-11", 2, "Solve sin 2x = sin x for 0° ≤ x ≤ 180°. Find the sum of all the solutions, in degrees.", 240, 0, "sin 2x = 2 sin x cos x, so sin x (2 cos x − 1) = 0. Then sin x = 0 gives x = 0° and 180°, and cos x = ½ gives x = 60°. The sum is 240°."),
          NUM("trig-y13-12", 2, "Solve cot θ = 2 for 0° ≤ θ ≤ 360°. Give the larger solution in degrees to 1 decimal place.", 206.6, 0.05, "tan θ = ½, so θ = 26.57° or 26.57° + 180° = 206.57°. The larger is 206.6°."),
          NUM("trig-y13-13", 3, "Solve 2 tan²x + sec x = 1 for 0° < x < 360°. Find the smaller solution in degrees, to 1 decimal place.", 131.8, 0.05, "Use tan²x = sec²x − 1: 2sec²x + sec x − 3 = 0, so (2 sec x + 3)(sec x − 1) = 0. sec x = 1 gives x = 0° (not in the range), and sec x = −3/2 gives cos x = −2/3, so x = 131.8° or 228.2°."),
        ],
      },
      flashcards: [
        { front: "sec θ, cosec θ, cot θ", back: "1/cos θ, 1/sin θ, 1/tan θ (= cos θ / sin θ)" },
        { front: "sec²θ in terms of tan", back: "sec²θ = 1 + tan²θ" },
        { front: "cosec²θ in terms of cot", back: "cosec²θ = 1 + cot²θ" },
        { front: "sin(A + B)", back: "sin A cos B + cos A sin B" },
        { front: "cos(A + B)", back: "cos A cos B − sin A sin B" },
        { front: "The three forms of cos 2A", back: "cos²A − sin²A = 2cos²A − 1 = 1 − 2sin²A" },
        { front: "sin 2A", back: "2 sin A cos A" },
        { front: "R form: R and α for a sin θ + b cos θ", back: "R = √(a² + b²), tan α = b/a (R sin(θ + α))" },
        { front: "Greatest and least values of R sin(θ + α)", back: "R and −R" },
        { front: "Small-angle approximations (radians)", back: "sin θ ≈ θ, tan θ ≈ θ, cos θ ≈ 1 − θ²/2" },
      ],
    },
  },
};
