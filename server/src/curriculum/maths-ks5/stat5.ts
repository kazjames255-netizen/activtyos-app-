// KS5 Maths — Statistics (Year 12 AS, Year 13 A2). Original content aligned to the DfE GCE AS and A-level mathematics subject content.
// Topic name is exactly "Statistics" so it merges with the KS1–KS4 Statistics topic rows. Answer keys are recomputed by _c_stat5.ts.
import type { CTopic } from "../types";
import { S, NUM, WR } from "./_h4";

export const TOPIC: CTopic = {
  key: "stat5",
  topic: "Statistics",
  subject: "Maths",
  years: {
    12: {
      year: 12,
      objectives: [
        "Understand and use sampling techniques: simple random, stratified, systematic, quota and opportunity sampling, and their advantages and bias.",
        "Present and interpret data: histograms (frequency density), box plots, outliers; calculate and interpret mean and standard deviation.",
        "Use probability: Venn diagrams, tree diagrams, mutually exclusive and independent events, P(A ∪ B).",
        "Use the binomial distribution B(n, p) to calculate P(X = r) and P(X ≤ r).",
        "Carry out a hypothesis test for the binomial parameter p: one- and two-tailed, critical regions and significance level.",
      ],
      note: {
        title: "Year 12: sampling, data, probability and the binomial test",
        body: `## Key ideas

- **Sampling:** *simple random* (every member equally likely), *systematic* (every kth after a random start), *stratified* (proportional to group sizes), *quota* (fill quotas from each group, not random) and *opportunity* (whoever is available, often biased).
- **Standard deviation:** σ = √(Σx²/n − x̄²).
- **Histograms:** frequency density = frequency ÷ class width, and the **area** of a bar is proportional to the frequency.
- **Outliers:** a common rule is more than 1.5 × IQR above Q3 or below Q1.
- **Probability:** P(A ∪ B) = P(A) + P(B) − P(A ∩ B). Independent events: P(A ∩ B) = P(A)P(B). Mutually exclusive: P(A ∩ B) = 0.
- **Binomial B(n, p):** P(X = r) = ⁿCᵣ pʳ (1 − p)ⁿ⁻ʳ. Use it when there are a fixed number of independent trials with the same probability of success.
- **Hypothesis test:** write H₀ and H₁ in terms of p, find the probability of a result at least as extreme as the one observed, and compare it with the significance level. For a two-tailed test at 10%, use 5% in each tail.

## Worked example 1: stratified sample

A club has 240 members: 90 juniors and 150 seniors. A stratified sample of 32 is needed.
Juniors: 90/240 × 32 = **12**. Seniors: 150/240 × 32 = **20**.

## Worked example 2: binomial probability

X ~ B(8, 0.4). Then P(X = 3) = ⁸C₃ × 0.4³ × 0.6⁵ = 56 × 0.064 × 0.07776 ≈ **0.2787**.

## Worked example 3: standard deviation

n = 10, Σx = 80 and Σx² = 700. The mean is 8, and σ² = 700/10 − 8² = 6, so σ = √6 ≈ **2.449**.

## Writing conclusions

Always finish a hypothesis test in context, and never say a test "proves" H₀.`,
      },
      quiz: {
        title: "Statistics: Year 12 quiz",
        questions: [
          S("stat5-y12-01", 1, "A headteacher numbers every student from 1 to 600 and uses a random number generator to select 60 of them. What type of sample is this?", ["Stratified", "Simple random", "Systematic", "Quota"], "Simple random", "Every student has the same chance of being chosen and the choice is made by random numbers, so it is a simple random sample."),
          S("stat5-y12-02", 1, "A factory inspects every 20th item from the production line, starting from a randomly chosen item. This is:", ["Simple random sampling", "Opportunity sampling", "Stratified sampling", "Systematic sampling"], "Systematic sampling", "Choosing every kth item after a random start is systematic sampling."),
          NUM("stat5-y12-03", 1, "A college has 1200 students, of whom 300 are in Year 13. A stratified sample of 80 students is taken. How many Year 13 students should be in the sample?", 20, 0, "Stratified samples are proportional: 300/1200 × 80 = 20."),
          NUM("stat5-y12-04", 2, "A data set has n = 8, Σx = 96 and Σx² = 1240. Find the standard deviation σ = √(Σx²/n − x̄²), to 3 decimal places.", 3.317, 0.0005, "The mean is 12. Variance = 1240/8 − 12² = 155 − 144 = 11, so the standard deviation is √11 ≈ 3.317.", { diagnostic: true }),
          NUM("stat5-y12-05", 2, "The histogram shows the times taken (in minutes) by a group of people to finish a task. Estimate the number of people whose time was in the class 30–50.", 30, 0, "The bar for 30–50 has frequency density 1.5 and class width 20, so the frequency is 1.5 × 20 = 30.", { image: { file: "stat5-y12-hist.png", alt: "A histogram of task times with unequal class widths. The vertical axis is frequency density. The bars are: 0 to 10 minutes with height 1.2, 10 to 20 with height 2.5, 20 to 30 with height 3, 30 to 50 with height 1.5 and 50 to 80 with height 0.4." } }),
          S("stat5-y12-06", 2, "For a data set Q₁ = 24 and Q₃ = 40. A value is an outlier if it is more than 1.5 × IQR above Q₃ or below Q₁. Which of these values is an outlier?", ["55", "61", "66", "30"], "66", "IQR = 16, so 1.5 × IQR = 24. The upper limit is 40 + 24 = 64 and the lower limit is 24 − 24 = 0. Only 66 is outside the limits."),
          NUM("stat5-y12-07", 2, "The Venn diagram shows the probabilities of events A and B. Find the probability that neither A nor B occurs.", 0.4, 0.00001, "P(A ∪ B) = 0.25 + 0.15 + 0.20 = 0.6, so P(neither) = 1 − 0.6 = 0.4.", { diagnostic: true, image: { file: "stat5-y12-venn.png", alt: "A Venn diagram with two overlapping circles labelled A and B inside a rectangle. The part of A only contains 0.25, the overlap contains 0.15 and the part of B only contains 0.2. The region outside both circles is unlabelled." } }),
          NUM("stat5-y12-08", 2, "The probability that it rains is 0.3. If it rains the probability that Sam is late is 0.4, and if it does not rain the probability that Sam is late is 0.1. Find the probability that Sam is late.", 0.19, 0.00001, "Add the two late branches: 0.3 × 0.4 + 0.7 × 0.1 = 0.12 + 0.07 = 0.19."),
          NUM("stat5-y12-09", 2, "X ~ B(10, 0.3). Find P(X = 4), to 4 decimal places.", 0.2001, 0.00005, "P(X = 4) = ¹⁰C₄ × 0.3⁴ × 0.7⁶ = 210 × 0.0081 × 0.117649 ≈ 0.2001."),
          NUM("stat5-y12-10", 3, "X ~ B(12, 0.25). Find P(X ≥ 3), to 4 decimal places.", 0.6093, 0.00005, "P(X ≥ 3) = 1 − P(X ≤ 2) = 1 − 0.3907 = 0.6093, using the cumulative probability P(X ≤ 2) = 0.3907."),
          S("stat5-y12-11", 3, "A die is rolled 30 times and shows a six 9 times. A test at the 5% significance level has H₀: p = 1/6 and H₁: p > 1/6. Given X ~ B(30, 1/6) and P(X ≥ 9) = 0.0506, which conclusion is correct?", ["Reject H₀: 0.0506 is close to 0.05, so the die is biased", "Do not reject H₀: 0.0506 > 0.05, so there is not enough evidence the die favours sixes", "Reject H₀: 0.0506 > 0.05", "Do not reject H₀, which proves the die is fair"], "Do not reject H₀: 0.0506 > 0.05, so there is not enough evidence the die favours sixes", "The probability of a result at least this extreme is 0.0506, which is larger than 0.05, so the result is not significant. We can never prove H₀; there is only insufficient evidence against it."),
          NUM("stat5-y12-12", 3, "X ~ B(25, 0.5). In a test of H₀: p = 0.5 against H₁: p > 0.5 at the 5% level, the critical region is X ≥ c. Find the smallest possible value of c.", 18, 0, "Working up from the middle, P(X ≥ 17) = 0.0539 is still above 0.05, but P(X ≥ 18) = 0.0216 is below it. So the critical region starts at c = 18."),
          WR("stat5-y12-13", 3, "A coin is tossed 10 times and lands heads 8 times. Test at the 10% significance level, using a two-tailed test, whether the coin is biased. Give your conclusion in context.", 4, "Mark scheme (4 marks): (1) H₀: p = 0.5, H₁: p ≠ 0.5, where p is the probability of a head; X ~ B(10, 0.5). (2) P(X ≥ 8) = 0.0547. (3) Compare with 0.05 (each tail of a 10% two-tailed test): 0.0547 > 0.05, so the result is not significant. (4) Do not reject H₀: there is insufficient evidence at the 10% level that the coin is biased."),
        ],
      },
      flashcards: [
        { front: "Stratified sampling", back: "Divide the population into groups and sample from each in proportion to its size" },
        { front: "Systematic sampling", back: "Choose every kth item from an ordered list after a random start" },
        { front: "Opportunity sampling: main weakness", back: "Takes whoever is available, so it is likely to be biased and unrepresentative" },
        { front: "Standard deviation formula", back: "σ = √(Σx²/n − x̄²)" },
        { front: "Frequency density", back: "Frequency ÷ class width (bar area is proportional to frequency)" },
        { front: "Outlier rule (1.5 × IQR)", back: "Above Q₃ + 1.5 × IQR or below Q₁ − 1.5 × IQR" },
        { front: "P(A ∪ B)", back: "P(A) + P(B) − P(A ∩ B)" },
        { front: "Independent events", back: "P(A ∩ B) = P(A) × P(B)" },
        { front: "Binomial probability formula", back: "P(X = r) = ⁿCᵣ pʳ (1 − p)ⁿ⁻ʳ" },
        { front: "Conditions for a binomial model", back: "Fixed number of trials, independent, two outcomes, constant probability p" },
        { front: "Two-tailed test at 10% significance", back: "Use 5% in each tail" },
      ],
    },
    13: {
      year: 13,
      objectives: [
        "Use the normal distribution N(μ, σ²): standardise, use the inverse normal, and find unknown μ or σ.",
        "Use the normal distribution as an approximation to the binomial, with a continuity correction.",
        "Understand and use conditional probability, including with tree diagrams, Venn diagrams and two-way tables.",
        "Interpret correlation (PMCC) and use linear regression, including interpolation and extrapolation.",
        "Carry out hypothesis tests for correlation and for the mean of a normal distribution.",
      ],
      note: {
        title: "Year 13: normal distribution, conditional probability and regression",
        body: `## Key ideas

- **Standardising:** if X ~ N(μ, σ²) then Z = (X − μ)/σ ~ N(0, 1). Use the calculator's normal functions for probabilities, and the inverse normal to find a value from a probability.
- **Normal approximation to B(n, p):** use N(np, np(1 − p)) when n is large and p is near ½. Apply a **continuity correction**: P(X ≤ 30) becomes P(Y < 30.5).
- **Conditional probability:** P(A | B) = P(A ∩ B)/P(B). With a two-branch tree, P(B) is the sum of the branches ending in B.
- **Correlation and regression:** the PMCC r lies between −1 and 1. The regression line y = a + bx is used to predict y from x. Predicting **within** the data range is interpolation (reliable); **outside** it is extrapolation (unreliable).
- **Hypothesis test for correlation:** compare r with the critical value for the sample size. If |r| exceeds it (or r does for a one-tailed test), reject H₀: ρ = 0.
- **Test for a mean:** if X ~ N(μ, σ²), then the sample mean X̄ ~ N(μ, σ²/n). Standardise x̄ using σ/√n.

## Worked example 1: a normal probability

X ~ N(60, 9²). Find P(X > 75).
z = (75 − 60)/9 = 1.667, so P(X > 75) = 1 − Φ(1.667) ≈ **0.0478**.

## Worked example 2: conditional probability

P(A) = 0.6, P(B | A) = 0.5 and P(B | A′) = 0.2.
P(B) = 0.6 × 0.5 + 0.4 × 0.2 = 0.38.
P(A | B) = 0.3/0.38 ≈ **0.789**.

## Remember

A strong correlation does not prove that one variable causes the other.`,
      },
      quiz: {
        title: "Statistics: Year 13 quiz",
        questions: [
          NUM("stat5-y13-01", 1, "X ~ N(70, 25). Find the z-value for x = 82.", 2.4, 0, "The standard deviation is √25 = 5, so z = (82 − 70)/5 = 2.4."),
          S("stat5-y13-02", 1, "A sample has PMCC r = −0.9. Which description is best?", ["Weak negative correlation", "Strong positive correlation", "No correlation", "Strong negative linear correlation"], "Strong negative linear correlation", "r is close to −1, so the points lie close to a straight line sloping downwards."),
          NUM("stat5-y13-03", 1, "A regression line is y = 2.5 + 1.8x. Predict y when x = 10.", 20.5, 0, "y = 2.5 + 1.8 × 10 = 20.5."),
          NUM("stat5-y13-04", 2, "X ~ N(100, 15²). The shaded area on the graph shows P(X > 115). Find it to 4 decimal places.", 0.1587, 0.00005, "z = (115 − 100)/15 = 1, so P(X > 115) = 1 − Φ(1) = 1 − 0.8413 = 0.1587.", { diagnostic: true, image: { file: "stat5-y13-normal.png", alt: "A bell-shaped normal curve centred on 100 with tick marks at 70, 85, 100, 115 and 130 on the horizontal axis. The area under the curve to the right of 115 is shaded." } }),
          NUM("stat5-y13-05", 2, "X ~ N(μ, 4²) and P(X < 20) = 0.8413. Find μ, to the nearest whole number.", 16, 0.01, "Φ(z) = 0.8413 gives z = 1. So (20 − μ)/4 = 1 and μ = 16."),
          NUM("stat5-y13-06", 2, "P(B) = 0.4 and P(A ∩ B) = 0.15. Find P(A | B). Give your answer as a decimal.", 0.375, 0, "P(A | B) = P(A ∩ B)/P(B) = 0.15/0.4 = 0.375."),
          NUM("stat5-y13-07", 2, "Of 120 boys, 45 study French. Of 80 girls, 50 study French. A student who studies French is chosen at random. Find the probability that the student is a girl, to 3 decimal places.", 0.526, 0.0005, "In total 45 + 50 = 95 students study French, and 50 of them are girls: 50/95 ≈ 0.526.", { diagnostic: true }),
          NUM("stat5-y13-08", 3, "X ~ B(100, 0.4). Use a normal approximation with a continuity correction to estimate P(X ≤ 45), to 3 decimal places.", 0.869, 0.0005, "Use Y ~ N(40, 24), so σ = √24 ≈ 4.899. P(X ≤ 45) ≈ P(Y < 45.5), z = 5.5/4.899 ≈ 1.123, and Φ(1.123) ≈ 0.869."),
          NUM("stat5-y13-09", 2, "The scatter diagram shows six points. The regression line of y on x has equation y = a + bx. Find b, to 2 decimal places.", 1.98, 0.005, "Using x̄ = 3.5 and ȳ = 8.0, b = Sxy/Sxx = 34.6/17.5 ≈ 1.98.", { image: { file: "stat5-y13-scatter.png", alt: "A scatter diagram with x from 0 to 7 and y from 0 to 14. Six points rise steadily from left to right: about (1, 3.1), (2, 4.9), (3, 7.2), (4, 8.8), (5, 11.1) and (6, 12.9). No line is drawn." } }),
          S("stat5-y13-10", 2, "A regression line for y on x is found from data with x-values between 10 and 50. Which prediction is least reliable?", ["y when x = 30", "y when x = 45", "y when x = 80", "y when x = 12"], "y when x = 80", "x = 80 is outside the range of the data, so the prediction is an extrapolation and cannot be trusted."),
          NUM("stat5-y13-11", 3, "X ~ N(μ, σ²) with P(X < 28) = 0.1587 and P(X < 44) = 0.9772. Find σ, to 2 decimal places.", 5.33, 0.01, "Standardising gives z = −1 for 28 and z = 2 for 44. So μ − σ = 28 and μ + 2σ = 44, and subtracting gives 3σ = 16, σ ≈ 5.33."),
          S("stat5-y13-12", 3, "For n = 10 pairs of data the PMCC is r = 0.68. The 5% one-tailed critical value is 0.5494. A test has H₀: ρ = 0 and H₁: ρ > 0. Which conclusion is correct?", ["Reject H₀: r exceeds the critical value, so there is evidence of positive correlation", "Do not reject H₀: 0.68 is greater than 0.5494, so there is no correlation", "Reject H₀: 0.68 is less than 0.5494", "Do not reject H₀: r is too small to matter"], "Reject H₀: r exceeds the critical value, so there is evidence of positive correlation", "The test statistic r = 0.68 is larger than the critical value 0.5494, so it lies in the critical region. This is evidence of positive correlation at the 5% level."),
          NUM("stat5-y13-13", 3, "Bag masses are N(μ, 8²) grams. To test H₀: μ = 500 against H₁: μ > 500, a sample of 25 bags has mean 503.5 g. Find the p-value, to 4 decimal places.", 0.0144, 0.0001, "X̄ ~ N(500, 8²/25), so the standard error is 1.6. z = 3.5/1.6 = 2.1875 and the p-value is 1 − Φ(2.1875) ≈ 0.0144."),
          WR("stat5-y13-14", 3, "X ~ B(80, 0.5). Explain why a normal distribution can be used to approximate X, state its parameters, and estimate P(X ≥ 45) using a continuity correction.", 4, "Mark scheme (4 marks): (1) n is large and p = 0.5 (symmetric), so a normal approximation is suitable. (2) Y ~ N(np, np(1 − p)) = N(40, 20). (3) Continuity correction: P(X ≥ 45) ≈ P(Y > 44.5). (4) z = 4.5/√20 ≈ 1.006, so the probability is 1 − Φ(1.006) ≈ 0.157."),
        ],
      },
      flashcards: [
        { front: "Standardising a normal variable", back: "Z = (X − μ)/σ" },
        { front: "Normal approximation to B(n, p)", back: "N(np, np(1 − p)), with a continuity correction" },
        { front: "Continuity correction for P(X ≤ 30)", back: "P(Y < 30.5)" },
        { front: "P(A | B)", back: "P(A ∩ B) / P(B)" },
        { front: "PMCC r close to −1", back: "Strong negative linear correlation" },
        { front: "Interpolation versus extrapolation", back: "Predicting inside the data range (reliable) versus outside it (unreliable)" },
        { front: "Regression line, y on x", back: "y = a + bx, with b = Sxy/Sxx and a = ȳ − b x̄" },
        { front: "Correlation test decision", back: "Reject H₀: ρ = 0 if r is beyond the critical value" },
        { front: "Distribution of the sample mean", back: "X̄ ~ N(μ, σ²/n)" },
        { front: "Does strong correlation prove causation?", back: "No, there may be another explanation" },
      ],
    },
  },
};
