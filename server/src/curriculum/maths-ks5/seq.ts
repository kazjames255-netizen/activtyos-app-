// KS5 Maths — Sequences & Series (Year 12 AS, Year 13 A2). Original content aligned to the DfE GCE AS and A-level mathematics subject content.
// Answer keys are recomputed by _c_seq.ts (run via _check_m4.ts) — re-run after ANY edit here.
import type { CTopic } from "../types";
import { S, NUM, WR } from "./_h4";

export const TOPIC: CTopic = {
  key: "seq",
  topic: "Sequences & Series",
  subject: "Maths",
  years: {
    12: {
      year: 12,
      objectives: [
        "Expand (a + bx)ⁿ for positive integer n using the binomial theorem and ⁿCᵣ; find a specific term.",
        "Work with arithmetic sequences and series, including the nth term and the sum of n terms.",
        "Work with geometric sequences and series, including the sum of a finite series and the sum to infinity when |r| < 1.",
        "Use sigma notation for sums of series.",
        "Use sequences and series in modelling contexts.",
      ],
      note: {
        title: "Year 12: binomial expansion, arithmetic and geometric series",
        body: `## Key formulae

- **Binomial theorem** (positive integer n): (a + b)ⁿ = aⁿ + ⁿC₁ aⁿ⁻¹b + ⁿC₂ aⁿ⁻²b² + … + bⁿ, where ⁿCᵣ = n! / (r!(n − r)!).
- **Arithmetic** (common difference d): uₙ = a + (n − 1)d, Sₙ = ½n[2a + (n − 1)d] = ½n(a + l), where l is the last term.
- **Geometric** (common ratio r): uₙ = arⁿ⁻¹, Sₙ = a(1 − rⁿ)/(1 − r) = a(rⁿ − 1)/(r − 1).
- **Sum to infinity:** S∞ = a/(1 − r), only if |r| < 1.
- **Sigma notation:** Σ from r = 1 to n means "add the terms as r runs from 1 to n". Useful: Σ r = n(n + 1)/2.

## Worked example 1: a binomial term

Find the coefficient of x² in (3 + 2x)⁵.

The x² term is ⁵C₂ × 3³ × (2x)² = 10 × 27 × 4x² = **1080x²**, so the coefficient is 1080.

## Worked example 2: series

An arithmetic sequence has third term 11 and eighth term 31.
5d = 31 − 11 = 20, so d = 4 and a = 11 − 8 = 3.
S₁₅ = ½ × 15 × [2 × 3 + 14 × 4] = ½ × 15 × 62 = **465**.

A geometric series has a = 5 and r = 0.6.
S∞ = 5/(1 − 0.6) = **12.5**, valid because |0.6| < 1.

## Choosing the right formula

1. Is the change between terms added (arithmetic) or multiplied (geometric)?
2. Is the sum finite (Sₙ) or infinite (S∞, and check |r| < 1)?
3. For unknown n, write an inequality; for a geometric sum use logarithms.`,
      },
      quiz: {
        title: "Sequences & Series: Year 12 quiz",
        questions: [
          NUM("seq-y12-01", 1, "An arithmetic sequence begins 5, 8, 11, 14, ... What is the 10th term?", 32, 0, "a = 5 and d = 3, so u₁₀ = 5 + 9 × 3 = 32."),
          NUM("seq-y12-02", 1, "Evaluate ⁷C₂.", 21, 0, "⁷C₂ = (7 × 6)/(2 × 1) = 21."),
          S("seq-y12-03", 1, "Which of these sequences is geometric?", ["2, 4, 6, 8", "3, 6, 12, 24", "1, 4, 9, 16", "5, 3, 1, −1"], "3, 6, 12, 24", "In a geometric sequence each term is the previous one multiplied by a fixed ratio. Here the ratio is 2 every time."),
          NUM("seq-y12-04", 2, "Find the sum of the first 20 terms of the arithmetic series 7 + 11 + 15 + ...", 900, 0, "a = 7, d = 4: S₂₀ = ½ × 20 × [14 + 19 × 4] = 10 × 90 = 900.", { diagnostic: true }),
          NUM("seq-y12-05", 2, "A geometric series has first term 3 and common ratio 2. Find the sum of the first 8 terms.", 765, 0, "S₈ = 3(2⁸ − 1)/(2 − 1) = 3 × 255 = 765."),
          NUM("seq-y12-06", 2, "Find the sum to infinity of the geometric series 12 + 4 + 4/3 + ...", 18, 0, "a = 12, r = 1/3 and |r| < 1, so S∞ = 12/(1 − 1/3) = 12 ÷ 2/3 = 18.", { diagnostic: true }),
          S("seq-y12-07", 2, "Find the term in x³ in the expansion of (2 + 3x)⁴.", ["72x³", "108x³", "216x³", "144x³"], "216x³", "The term is ⁴C₃ × 2 × (3x)³ = 4 × 2 × 27x³ = 216x³."),
          NUM("seq-y12-08", 2, "Evaluate the sum of (3r − 1) for r from 1 to 10.", 155, 0, "Σ 3r = 3 × 55 = 165 and Σ 1 (ten times) = 10, so 165 − 10 = 155."),
          NUM("seq-y12-09", 2, "An arithmetic sequence has 5th term 23 and 9th term 39. Find the first term.", 7, 0, "4d = 39 − 23 = 16, so d = 4. Then a = 23 − 4 × 4 = 7."),
          NUM("seq-y12-10", 3, "A geometric sequence has third term 20 and fifth term 80, with positive common ratio. Find the first term.", 5, 0, "r² = 80/20 = 4, so r = 2 (positive). Then a = 20/r² = 5."),
          NUM("seq-y12-11", 3, "A geometric series has sum to infinity equal to 3 times its first term, and its second term is 10. Find the first term.", 15, 0, "a/(1 − r) = 3a gives 1 − r = 1/3, so r = 2/3. Then ar = 10 gives a = 10 ÷ (2/3) = 15."),
          NUM("seq-y12-12", 3, "The geometric series 2 + 3 + 4.5 + ... has sum Sₙ. Find the smallest n for which Sₙ > 500.", 12, 0, "a = 2, r = 1.5: Sₙ = 4(1.5ⁿ − 1) > 500 gives 1.5ⁿ > 126, so n > ln 126 / ln 1.5 ≈ 11.9. The smallest whole n is 12."),
          WR("seq-y12-13", 3, "Prove that the sum of the first n terms of an arithmetic series with first term a and common difference d is Sₙ = ½n[2a + (n − 1)d].", 4, "Mark scheme (4 marks): (1) Write Sₙ = a + (a + d) + … + [a + (n − 1)d]. (2) Write it again in reverse order. (3) Add the two lines term by term: each pair sums to 2a + (n − 1)d, and there are n pairs, so 2Sₙ = n[2a + (n − 1)d]. (4) Divide by 2 to give the result."),
        ],
      },
      flashcards: [
        { front: "ⁿCᵣ formula", back: "n! / (r!(n − r)!)" },
        { front: "Binomial expansion of (a + b)ⁿ", back: "Σ ⁿCᵣ aⁿ⁻ʳ bʳ for r = 0 to n" },
        { front: "nth term of an arithmetic sequence", back: "uₙ = a + (n − 1)d" },
        { front: "Sum of n terms of an arithmetic series", back: "Sₙ = ½n[2a + (n − 1)d] = ½n(a + l)" },
        { front: "nth term of a geometric sequence", back: "uₙ = arⁿ⁻¹" },
        { front: "Sum of n terms of a geometric series", back: "Sₙ = a(1 − rⁿ)/(1 − r)" },
        { front: "Sum to infinity, and when does it exist?", back: "S∞ = a/(1 − r), only when |r| < 1" },
        { front: "Meaning of Σ from r = 1 to n of f(r)", back: "Add f(1) + f(2) + … + f(n)" },
        { front: "Σ r for r = 1 to n", back: "n(n + 1)/2" },
        { front: "How do you solve arⁿ⁻¹ > k for n?", back: "Take logs of both sides (reverse the inequality if dividing by a negative log)" },
      ],
    },
    13: {
      year: 13,
      objectives: [
        "Expand (1 + x)ⁿ for any rational n and state the range of validity |x| < 1.",
        "Expand (a + bx)ⁿ for rational n by taking out a factor, with validity |bx/a| < 1.",
        "Work with recurrence relations uₙ₊₁ = f(uₙ), including finding limits.",
        "Classify sequences as increasing, decreasing, periodic or convergent.",
        "Use partial fractions with binomial expansions.",
      ],
      note: {
        title: "Year 13: binomial expansion for any power, and recurrence relations",
        body: `## Key results

- **Binomial series for any rational n:**
  (1 + x)ⁿ = 1 + nx + n(n − 1)/2! x² + n(n − 1)(n − 2)/3! x³ + …, valid for |x| < 1.
- If n is a positive integer the series stops; otherwise it goes on for ever, so the validity condition matters.
- **General form:** (a + bx)ⁿ = aⁿ(1 + (b/a)x)ⁿ, valid when |bx/a| < 1.
- **Recurrence relation:** uₙ₊₁ = f(uₙ) with a starting value. If it **converges** to L, then L = f(L).
- **Types of sequence:** increasing (uₙ₊₁ > uₙ), decreasing, **periodic** (repeats every k terms, "order k"), oscillating.
- To expand a fraction with two factors, first split into **partial fractions**, then expand each.

## Worked example 1: rational power

Expand (1 + 3x)^(−1/3) up to x², and state the validity.

Here n = −1/3 and the variable is 3x.
- x term: (−1/3)(3x) = −x.
- x² term: [(−1/3)(−4/3)/2] × (3x)² = (2/9) × 9x² = 2x².

So (1 + 3x)^(−1/3) ≈ **1 − x + 2x²**, valid for |3x| < 1, that is **|x| < 1/3**.

## Worked example 2: a limit

uₙ₊₁ = 0.6uₙ + 2, u₁ = 1. Then u₂ = 2.6, u₃ = 3.56, and the terms are increasing towards a limit.
Set L = 0.6L + 2, so 0.4L = 2 and **L = 5**.

## Common errors

- Forgetting to take out the factor aⁿ when the first term is not 1.
- Writing the validity condition as |x| < 1 when the variable is really bx/a.`,
      },
      quiz: {
        title: "Sequences & Series: Year 13 quiz",
        questions: [
          S("seq-y13-01", 1, "Which is the expansion of (1 + x)⁻¹ up to the term in x²?", ["1 + x + x²", "1 − x − x²", "1 − x + x²", "1 − 2x + 3x²"], "1 − x + x²", "n = −1: the x term is nx = −x and the x² term is (−1)(−2)/2 × x² = x²."),
          NUM("seq-y13-02", 1, "A sequence is defined by uₙ₊₁ = 2uₙ + 1 with u₁ = 3. Find u₃.", 15, 0, "u₂ = 2 × 3 + 1 = 7 and u₃ = 2 × 7 + 1 = 15."),
          S("seq-y13-03", 1, "The sequence uₙ = 1/n (n = 1, 2, 3, ...) is:", ["periodic", "decreasing and convergent to 0", "increasing and divergent", "oscillating"], "decreasing and convergent to 0", "The terms 1, ½, ⅓, … keep getting smaller and get closer and closer to 0."),
          NUM("seq-y13-04", 2, "Find the coefficient of x² in the expansion of (1 + 2x)⁻².", 12, 0, "The x² coefficient is [(−2)(−3)/2] × 2² = 3 × 4 = 12.", { diagnostic: true }),
          NUM("seq-y13-05", 2, "Find the coefficient of x² in the expansion of (1 − 3x)^(1/2). Give a decimal.", -1.125, 0, "[(½)(−½)/2] × (−3)² = (−1/8) × 9 = −9/8 = −1.125."),
          S("seq-y13-06", 2, "For which values of x is the expansion of (1 + 4x)⁻³ valid?", ["|x| < 4", "|x| < 1", "|x| < 3/4", "|x| < 1/4"], "|x| < 1/4", "The expansion of (1 + u)ⁿ needs |u| < 1. Here u = 4x, so |4x| < 1 and |x| < 1/4.", { diagnostic: true }),
          NUM("seq-y13-07", 2, "Use the expansion √(1 + x) ≈ 1 + ½x − ⅛x² with x = 0.02 to estimate √1.02. Give your answer to 5 decimal places.", 1.00995, 0.000005, "½ × 0.02 = 0.01 and ⅛ × 0.0004 = 0.00005, so the estimate is 1 + 0.01 − 0.00005 = 1.00995."),
          NUM("seq-y13-08", 2, "A sequence has uₙ₊₁ = 0.5uₙ + 4 with u₁ = 2. It converges to a limit L. Find L.", 8, 0, "At the limit L = 0.5L + 4, so 0.5L = 4 and L = 8."),
          NUM("seq-y13-09", 3, "Find the coefficient of x² in the expansion of (4 − x)^(−1/2). Give a decimal to 4 decimal places.", 0.0117, 0.00005, "(4 − x)^(−1/2) = ½(1 − x/4)^(−1/2). The x² term inside is [(−½)(−3/2)/2] × (x/4)² = (3/8)(x²/16). Multiply by ½: 3/256 ≈ 0.0117."),
          NUM("seq-y13-10", 3, "By writing 1/((1 + x)(1 − 2x)) in partial fractions, or otherwise, find the coefficient of x² in its expansion.", 3, 0, "1/((1 + x)(1 − 2x)) = ⅓[1/(1 + x) + 2/(1 − 2x)]. The x² terms are ⅓[1 + 2 × 4] = ⅓ × 9 = 3."),
          NUM("seq-y13-11", 2, "A sequence has uₙ₊₁ = 1/(1 − uₙ) with u₁ = 2. Find u₄.", 2, 0, "u₂ = 1/(1 − 2) = −1, u₃ = 1/(1 + 1) = ½ and u₄ = 1/(1 − ½) = 2. The sequence is periodic with order 3."),
          NUM("seq-y13-12", 3, "In the expansion of (1 + kx)⁻², the coefficient of x is −6. Find the coefficient of x².", 27, 0, "The x term is −2kx, so −2k = −6 and k = 3. The x² coefficient is [(−2)(−3)/2] k² = 3 × 9 = 27."),
          WR("seq-y13-13", 3, "Show that the first three terms in the expansion of (1 + x)^(−1/2) are 1 − ½x + (3/8)x², and state the range of values of x for which the expansion is valid.", 3, "Mark scheme (3 marks): (1) Use the binomial series with n = −1/2. (2) x term: (−½)x = −½x; x² term: [(−½)(−3/2)/2]x² = (3/8)x². (3) Valid for |x| < 1."),
        ],
      },
      flashcards: [
        { front: "Binomial series (1 + x)ⁿ, any rational n", back: "1 + nx + n(n − 1)x²/2! + n(n − 1)(n − 2)x³/3! + …" },
        { front: "Validity of (1 + x)ⁿ for non-integer n", back: "|x| < 1" },
        { front: "How do you expand (a + bx)ⁿ?", back: "Take out aⁿ: aⁿ(1 + (b/a)x)ⁿ, valid for |bx/a| < 1" },
        { front: "If a recurrence uₙ₊₁ = f(uₙ) converges to L, then…", back: "L = f(L)" },
        { front: "What is a periodic sequence of order k?", back: "One whose terms repeat every k terms (uₙ₊ₖ = uₙ)" },
        { front: "Increasing sequence definition", back: "uₙ₊₁ > uₙ for all n" },
        { front: "What does convergent mean?", back: "The terms approach a fixed finite limit as n → ∞" },
        { front: "Expansion of (1 − x)⁻¹ to x³", back: "1 + x + x² + x³" },
        { front: "Expansion of √(1 + x) to x²", back: "1 + ½x − ⅛x²" },
        { front: "Combining fractions and binomial series", back: "Split into partial fractions first, then expand each" },
      ],
    },
  },
};
