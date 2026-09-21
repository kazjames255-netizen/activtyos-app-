// A-level Maths — Exponentials & Logarithms (Years 12–13). Original content aligned to the DfE GCE AS and A-level mathematics subject content.
// Answer keys are recomputed by _check_m4_a.ts — re-run it after ANY edit here.
import type { CTopic } from "../types";
import { S, NUM, WR } from "./_h4";

export const TOPIC: CTopic = {
  key: "explog",
  topic: "Exponentials & Logarithms",
  subject: "Maths",
  years: {
    12: {
      year: 12,
      subtopic: "Year 12 (AS)",
      objectives: [
        "Know and use the graph of y = aˣ and the properties of exponential functions; know that y = eˣ has gradient equal to its value.",
        "Recognise and use the definition of logₐ x as the inverse of aˣ; know and use ln x as the inverse of eˣ.",
        "Understand and use the laws of logarithms, including logₐ x + logₐ y, logₐ x − logₐ y and k logₐ x.",
        "Solve equations of the form aˣ = b, including those that reduce to quadratics in aˣ.",
        "Use logarithmic graphs to estimate the parameters in relationships of the form y = a bˣ, and model exponential growth.",
      ],
      note: {
        title: "Year 12: exponentials, logarithms and modelling",
        body: `## What you need to know

**Definition.** logₐ x = y means aʸ = x. So logₐ(aˣ) = x and a^(logₐ x) = x. The natural logarithm ln x is log to base e, the inverse of eˣ.

**Laws of logarithms (same base)**

| Law | Rule |
| --- | --- |
| Multiply | log x + log y = log(xy) |
| Divide | log x − log y = log(x/y) |
| Power | k log x = log(xᵏ) |
| Special values | log_a 1 = 0, log_a a = 1 |

**Solving aˣ = b.** Take logs of both sides: x = log b / log a.

**Graph of y = aˣ (a > 1):** always positive, passes through (0, 1), increases, and has the x-axis as a horizontal asymptote.

**Modelling y = a bˣ.** Take logs: log y = log a + x log b. Plotting log y against x gives a straight line with **gradient log b** and **intercept log a**.

## Worked example 1: solving

Solve 7ˣ = 40.
Take logs: x ln 7 = ln 40, so x = ln 40 / ln 7 = 3.689 / 1.946 = **1.90** (3 s.f.).

## Worked example 2: a data line

A graph of log₁₀ y against x is a straight line with gradient 0.2 and intercept 0.5. Then
log₁₀ y = 0.5 + 0.2x, so y = 10^0.5 × (10^0.2)ˣ ≈ **3.16 × 1.58ˣ**.

## Worked example 3: laws

Write 3 log 2 + log 5 as a single logarithm: 3 log 2 = log 8, so the sum is log 8 + log 5 = **log 40**.

Tip: log(x + y) is NOT log x + log y. Only products turn into sums.`,
      },
      quiz: {
        title: "Exponentials & Logarithms: Year 12 quiz",
        questions: [
          NUM("explog-y12-01", 1, "Evaluate log₂ 32.", 5, 0, "log₂ 32 asks: what power of 2 gives 32? 2⁵ = 32, so the answer is 5."),
          S("explog-y12-02", 1, "Which expression is equal to log a − log b (all logs to the same base)?", ["log(a − b)", "log(a/b)", "log a / log b", "log(b/a)"], "log(a/b)", "Subtracting logarithms corresponds to dividing the numbers: log a − log b = log(a/b). log(a − b) and log a / log b are common mistakes."),
          NUM("explog-y12-03", 1, "Solve 5ˣ = 125.", 3, 0, "125 = 5³, so x = 3."),
          NUM("explog-y12-04", 2, "Solve 3ˣ = 20. Give x to 2 decimal places.", 2.73, 0.005, "Take logs: x ln 3 = ln 20, so x = ln 20 / ln 3 = 2.9957 / 1.0986 ≈ 2.73."),
          S("explog-y12-05", 2, "Write 2 log 3 + log 4 − log 6 as a single logarithm (base 10).", ["log 12", "log 18", "log 6", "log 7"], "log 6", "2 log 3 = log 9. Then log 9 + log 4 = log 36, and log 36 − log 6 = log(36 ÷ 6) = log 6.", { diagnostic: true }),
          NUM("explog-y12-06", 2, "Solve ln x = 3. Give x to 2 decimal places.", 20.09, 0.005, "ln x = 3 means x = e³ = 20.0855…, which is 20.09 to 2 decimal places."),
          NUM("explog-y12-07", 2, "A curve y = a bˣ (with b > 0) passes through (0, 3) and (2, 48). Find b.", 4, 0, "At x = 0: a = 3. At x = 2: 3b² = 48, so b² = 16 and b = 4 (b > 0).", { diagnostic: true }),
          NUM("explog-y12-08", 2, "Data follow y = 5 × 2ˣ. A graph of log₁₀ y against x is a straight line. Find its gradient to 3 decimal places.", 0.301, 0.0005, "log₁₀ y = log₁₀ 5 + x log₁₀ 2, so the gradient is log₁₀ 2 = 0.30103…, or 0.301 to 3 decimal places."),
          NUM("explog-y12-09", 2, "The curve y = 2ˣ + c is shown. It crosses the y-axis at (0, −3). Find c.", -4, 0, "At x = 0, y = 2⁰ + c = 1 + c. Setting 1 + c = −3 gives c = −4.", { image: { file: "explog-y12-q9.png", alt: "An increasing curve that rises steeply to the right, crossing the y-axis at the labelled point (0, −3) and crossing the x-axis at x = 2 before continuing upwards." } }),
          NUM("explog-y12-10", 2, "A graph of log₁₀ y against x is a straight line through (0, 0.4) and (5, 2.4), as shown. The data follow y = a bˣ. Find b to 3 significant figures.", 2.51, 0.005, "The gradient is (2.4 − 0.4)/5 = 0.4 = log₁₀ b, so b = 10^0.4 = 2.512, which is 2.51 to 3 s.f.", { image: { file: "explog-y12-q10.png", alt: "Graph with x on the horizontal axis and log₁₀ y on the vertical axis: a straight line through the labelled points (0, 0.4) and (5, 2.4)." } }),
          NUM("explog-y12-11", 3, "Solve 4ˣ − 3 × 2ˣ − 4 = 0.", 2, 0, "Let u = 2ˣ. Then u² − 3u − 4 = 0, so (u − 4)(u + 1) = 0. Since 2ˣ > 0, u = 4, so x = 2."),
          NUM("explog-y12-12", 3, "Solve e^(2x) − 5eˣ + 6 = 0. Give the larger root to 2 decimal places.", 1.1, 0.005, "Let u = eˣ, so u² − 5u + 6 = 0 and u = 2 or 3. The larger root is x = ln 3 = 1.0986… ≈ 1.10."),
          NUM("explog-y12-13", 3, "The number of bacteria at time t hours is N = a bᵗ. N = 90 when t = 2 and N = 720 when t = 5. Find the time when N = 1000, to 2 decimal places.", 5.47, 0.005, "Dividing, b³ = 720/90 = 8, so b = 2, and a = 90/4 = 22.5. Then 22.5 × 2ᵗ = 1000 gives 2ᵗ = 44.44, so t = ln 44.44 / ln 2 ≈ 5.47."),
          WR("explog-y12-14", 3, "Given that logₐ x = p and logₐ y = q, prove that logₐ(xy) = p + q.", 3, "Mark scheme (3 marks). M1: rewrite the definitions as x = aᵖ and y = a^q. M1: multiply, xy = aᵖ × a^q = a^(p + q) (law of indices). A1: take logₐ of both sides: logₐ(xy) = p + q = logₐ x + logₐ y, as required."),
        ],
      },
      flashcards: [
        { front: "logₐ x = y means …", back: "aʸ = x (logarithm is the inverse of the exponential)." },
        { front: "log x + log y =", back: "log(xy)" },
        { front: "log x − log y =", back: "log(x/y)" },
        { front: "k log x =", back: "log(xᵏ)" },
        { front: "log_a 1 and log_a a", back: "log_a 1 = 0 and log_a a = 1." },
        { front: "Solve aˣ = b", back: "x = log b / log a (take logs of both sides)." },
        { front: "ln x is …", back: "log to base e, the inverse function of eˣ: ln(eˣ) = x and e^(ln x) = x." },
        { front: "Key features of y = aˣ (a > 1)", back: "Passes through (0, 1), always positive, increasing, x-axis is an asymptote." },
        { front: "Linear form of y = a bˣ", back: "log y = log a + x log b: plot log y against x; gradient log b, intercept log a." },
        { front: "Is log(x + y) = log x + log y?", back: "No. Only log(xy) = log x + log y." },
      ],
    },
    13: {
      year: 13,
      subtopic: "Year 13 (A2)",
      objectives: [
        "Know and use e^(kx) for growth and decay; model situations with exponential functions and interpret the parameters.",
        "Solve equations involving eˣ and ln x, including those that reduce to quadratics in eˣ.",
        "Sketch and transform graphs of y = eˣ and y = ln x, including asymptotes.",
        "Reduce relationships of the form y = A e^(kx) and y = a xⁿ to linear form using logarithms and use them to find the parameters.",
        "Use doubling time and half-life; use Newton's law of cooling type models.",
      ],
      note: {
        title: "Year 13: e^(kx), natural logarithms and linear forms",
        body: `## What you need to know

**Growth and decay.** y = A e^(kx): k > 0 is growth, k < 0 is decay. A is the value when x = 0. In an equation e^(kx) = c, take natural logs: kx = ln c.

**Doubling time and half-life.** Doubling: e^(kt) = 2, so t = ln 2 / k. Half-life: for decay with rate k, e^(−kt) = ½, so t = ln 2 / k.

**Transformations.** y = eˣ + c has asymptote y = c. y = ln(x − a) has asymptote x = a. y = ln x is the reflection of y = eˣ in y = x.

**Linear forms (take ln of both sides)**

| Relationship | Linear form | Plot | Gradient / intercept |
| --- | --- | --- | --- |
| y = A e^(kx) | ln y = ln A + kx | ln y against x | k / ln A |
| y = a xⁿ | ln y = ln a + n ln x | ln y against ln x | n / ln a |

**Hidden quadratics.** e^(2x) = (eˣ)², so equations like e^(2x) − 7eˣ + 10 = 0 become u² − 7u + 10 = 0 with u = eˣ (and u > 0).

## Worked example 1: growth

A population is modelled by N = 400 e^(0.05t). When does N reach 1000?
400 e^(0.05t) = 1000, so e^(0.05t) = 2.5, so 0.05t = ln 2.5 and t = ln 2.5 / 0.05 = **18.3** (3 s.f.).

## Worked example 2: linear form

Data follow y = 5x². Then ln y = ln 5 + 2 ln x. A graph of ln y against ln x is a straight line with gradient **2** and intercept ln 5 ≈ 1.61.

## Worked example 3: hidden quadratic

Solve e^(2x) − 7eˣ + 10 = 0. With u = eˣ: (u − 2)(u − 5) = 0, so eˣ = 2 or 5, giving x = ln 2 or x = ln 5.

Tip: ln of a negative number or zero does not exist, so check every solution.`,
      },
      quiz: {
        title: "Exponentials & Logarithms: Year 13 quiz",
        questions: [
          NUM("explog-y13-01", 1, "Evaluate ln(e⁴) + e^(ln 3).", 7, 0, "ln(e⁴) = 4 because ln and e are inverses, and e^(ln 3) = 3. So the total is 4 + 3 = 7."),
          S("explog-y13-02", 1, "Simplify ln 12 − ln 3.", ["ln 9", "ln 15", "ln 4", "ln 36"], "ln 4", "Subtracting logarithms means dividing: ln 12 − ln 3 = ln(12 ÷ 3) = ln 4."),
          S("explog-y13-03", 1, "What is the equation of the horizontal asymptote of y = eˣ + 2?", ["y = 0", "x = 2", "y = 1", "y = 2"], "y = 2", "As x → −∞, eˣ → 0, so y → 2. The curve is eˣ moved up by 2, so the asymptote moves from y = 0 to y = 2."),
          NUM("explog-y13-04", 2, "Solve e^(2x + 1) = 30. Give x to 2 decimal places.", 1.2, 0.005, "Take natural logs: 2x + 1 = ln 30 = 3.4012, so x = (3.4012 − 1)/2 = 1.2006, which is 1.20 to 2 d.p."),
          NUM("explog-y13-05", 2, "Solve ln(3x − 1) = 2. Give x to 2 decimal places.", 2.8, 0.005, "Exponentiate: 3x − 1 = e² = 7.389, so x = 8.389/3 = 2.796, which is 2.80 to 2 d.p."),
          NUM("explog-y13-06", 2, "The value of an investment is V = 2000 e^(0.04t) pounds after t years. How many years does it take to double? Give your answer to 1 decimal place.", 17.3, 0.05, "Doubling means e^(0.04t) = 2, so 0.04t = ln 2 and t = 0.6931/0.04 = 17.33, which is 17.3 years."),
          NUM("explog-y13-07", 2, "The mass of a substance is M = 80 e^(−kt), where t is in days. Its half-life is 5 days. Find k to 3 decimal places.", 0.139, 0.0005, "After 5 days the mass is halved: e^(−5k) = ½, so 5k = ln 2 and k = 0.6931/5 = 0.13863, which is 0.139 to 3 d.p.", { diagnostic: true }),
          NUM("explog-y13-08", 2, "Data follow y = A e^(kx). A graph of ln y against x is a straight line with gradient 0.3 and intercept 2 on the ln y axis. Find A to 2 decimal places.", 7.39, 0.005, "ln y = ln A + kx, so the intercept is ln A = 2, giving A = e² = 7.389, which is 7.39 to 2 d.p.", { diagnostic: true }),
          S("explog-y13-09", 2, "The curve shown passes through (0, 3) and approximately (1, 1.1), decreasing towards the x-axis. Which equation could it be?", ["y = 3e^x", "y = e^(−3x)", "y = 3 − e^x", "y = 3e^(−x)"], "y = 3e^(−x)", "At x = 0 the value is 3, so the number in front is 3. The curve is decreasing, so the power is negative. 3e^(−1) = 1.10 matches the second point.", { image: { file: "explog-y13-q9.png", alt: "A decreasing curve that starts at the labelled point (0, 3) on the y-axis, passes through the labelled point (1, 1.1), and flattens out towards the x-axis as x increases." } }),
          NUM("explog-y13-10", 2, "The relationship y = a xⁿ is tested. A graph of ln y against ln x is a straight line through (1, 3.5) and (3, 6.5), as shown. Find n.", 1.5, 0, "ln y = ln a + n ln x, so n is the gradient: (6.5 − 3.5)/(3 − 1) = 1.5.", { image: { file: "explog-y13-q10.png", alt: "Graph with ln x on the horizontal axis and ln y on the vertical axis: a straight line through the labelled points (1, 3.5) and (3, 6.5)." } }),
          NUM("explog-y13-11", 3, "The graph of y = ln(x − 2) + 1 crosses the x-axis at x = p. Find p to 2 decimal places.", 2.37, 0.005, "Set ln(x − 2) + 1 = 0, so ln(x − 2) = −1 and x − 2 = e⁻¹ = 0.3679. Then x = 2.3679, which is 2.37 to 2 d.p."),
          NUM("explog-y13-12", 3, "Solve 2e^(2x) − 9eˣ + 4 = 0. Give the larger root to 2 decimal places.", 1.39, 0.005, "Let u = eˣ: 2u² − 9u + 4 = 0, so (2u − 1)(u − 4) = 0 and u = ½ or 4. The larger root is x = ln 4 = 1.386, or 1.39 to 2 d.p."),
          NUM("explog-y13-13", 3, "A drink cools according to θ = 20 + 65e^(−0.08t), where θ is in °C and t in minutes. Find t when θ = 40. Give your answer to 1 decimal place.", 14.7, 0.05, "Solve 20 + 65e^(−0.08t) = 40, so e^(−0.08t) = 20/65. Then −0.08t = ln(20/65) = −1.1787, and t = 14.73, which is 14.7 minutes."),
          WR("explog-y13-14", 3, "Write y = 6 × 2^(3x) in the form y = A e^(kx), giving A and k exactly.", 3, "Mark scheme (3 marks). M1: write 2^(3x) = e^(ln 2 × 3x) (use 2 = e^(ln 2)). A1: so y = 6 e^(3x ln 2) and A = 6. A1: k = 3 ln 2 (equivalent forms ln 8 also accepted)."),
        ],
      },
      flashcards: [
        { front: "y = A e^(kx): meaning of A and k", back: "A is the value at x = 0; k > 0 is growth and k < 0 is decay." },
        { front: "ln(eˣ) and e^(ln x)", back: "Both equal x (inverse functions); e^(ln x) needs x > 0." },
        { front: "Doubling time for e^(kt)", back: "t = ln 2 / k" },
        { front: "Half-life for decay e^(−kt)", back: "t = ln 2 / k" },
        { front: "Solve e^(kx) = c", back: "kx = ln c, so x = (ln c)/k (c > 0)." },
        { front: "Asymptote of y = eˣ + c and of y = ln(x − a)", back: "y = c (horizontal) and x = a (vertical)." },
        { front: "Linear form of y = A e^(kx)", back: "ln y = ln A + kx: plot ln y against x; gradient k, intercept ln A." },
        { front: "Linear form of y = a xⁿ", back: "ln y = ln a + n ln x: plot ln y against ln x; gradient n, intercept ln a." },
        { front: "How to spot a hidden quadratic", back: "e^(2x) = (eˣ)²: let u = eˣ, solve for u, then reject u ≤ 0." },
        { front: "Graph of y = ln x versus y = eˣ", back: "Reflections of each other in the line y = x." },
      ],
    },
  },
};
