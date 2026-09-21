// GCSE Maths — Probability (Years 10–11). Original content aligned to the DfE GCSE mathematics subject content (OGL v3.0).
// Answer keys are recomputed by _check_m3.ts — re-run it after ANY edit here.
import type { CTopic } from "../types";

export const TOPIC: CTopic = {
  key: "prob",
  topic: "Probability",
  subject: "Maths",
  years: {
    10: {
      year: 10,
      objectives: [
        "Calculate theoretical probabilities, including from sample-space diagrams.",
        "Use relative frequency as an estimate of probability and find expected outcomes.",
        "Use the addition rule (or) and multiplication rule (and) for independent events.",
        "Draw and use tree diagrams, with and without replacement.",
        "Use Venn diagrams and two-way tables to find probabilities.",
      ],
      note: {
        title: "Year 10 Probability: rules, tree diagrams and Venn diagrams",
        body: `## What you need to know

**Probability** is a number from 0 (impossible) to 1 (certain). For equally likely outcomes, P(event) = number of ways ÷ total outcomes. The probabilities of all outcomes add to 1, so **P(not A) = 1 − P(A)**.

**Relative frequency** = frequency ÷ number of trials. It estimates probability, and gets better with more trials. **Expected number** = probability × number of trials.

**Rules for independent events:**
- **AND** → multiply: P(A and B) = P(A) × P(B)
- **OR** (mutually exclusive) → add: P(A or B) = P(A) + P(B)

**Tree diagrams.** Multiply along the branches for "and", add the ends that match the event. Branches from one point add to 1. **Without replacement**, the second-stage probabilities change because the numbers left have changed.

**Venn diagrams.** Write the counts in each region (the four regions add to the total), then read off probabilities.

## Worked example 1: two events
A spinner lands on red with probability 0.4. P(red, then not red) = 0.4 × 0.6 = **0.24**.

## Worked example 2: without replacement
A bag has 3 red and 7 blue counters. Two are taken. P(both red) = 3/10 × 2/9 = 6/90 = **1/15**.

## Worked example 3: expected
P(fault) = 0.03. In 600 items expect 600 × 0.03 = **18** faults.

| Idea | Rule |
| --- | --- |
| Not | 1 − P(A) |
| And | multiply |
| Or | add |`,
      },
      quiz: {
        title: "Probability: Year 10 GCSE quiz",
        questions: [
          {
            key: "prob-y10-01", kind: "single", difficulty: 1,
            prompt: "A fair spinner has 8 equal sections numbered 1 to 8. What is the probability of spinning a prime number?",
            options: ["3/8", "1/2", "5/8", "1/4"],
            answer: "1/2",
            explanation: "The primes from 1 to 8 are 2, 3, 5 and 7, which is 4 out of 8 equally likely outcomes: 4/8 = 1/2.",
          },
          {
            key: "prob-y10-02", kind: "number", difficulty: 1, tolerance: 0.0001,
            prompt: "A coin is tossed 200 times and lands on heads 124 times. What is the relative frequency of heads? Give your answer as a decimal.",
            answer: 0.62,
            explanation: "Relative frequency = frequency ÷ number of trials = 124 ÷ 200 = 0.62.",
          },
          {
            key: "prob-y10-03", kind: "number", difficulty: 1,
            prompt: "The probability that a bike from a factory fails a safety test is 0.05. In a batch of 400 bikes, how many would you expect to fail?",
            answer: 20,
            explanation: "Expected number = probability × number of trials = 0.05 × 400 = 20.",
          },
          {
            key: "prob-y10-04", kind: "single", difficulty: 2, diagnostic: true,
            prompt: "The Venn diagram shows the languages studied by 30 students. One student is chosen at random. What is the probability that they study both French and Spanish?",
            options: ["5/14", "5/12", "1/6", "1/5"],
            answer: "1/6",
            explanation: "The overlap of the two circles is the number who study both: 5. So the probability is 5/30 = 1/6.",
            image: { file: "prob-y10-venn.png", alt: "A Venn diagram inside a rectangle labelled 30 students. Two overlapping circles are labelled French and Spanish. French only contains 9, the overlap contains 5, Spanish only contains 7, and outside both circles is 9." },
          },
          {
            key: "prob-y10-05", kind: "number", difficulty: 2, diagnostic: true, tolerance: 0.001,
            prompt: "A spinner is spun twice. Each spin lands on green with probability 0.3. Use the tree diagram to work out the probability of getting exactly one green. Give your answer as a decimal.",
            answer: 0.42,
            explanation: "There are two ways: green then not green (0.3 × 0.7 = 0.21) or not green then green (0.7 × 0.3 = 0.21). Add them: 0.21 + 0.21 = 0.42.",
            image: { file: "prob-y10-tree.png", alt: "A tree diagram for two spins. First spin: Green 0.3, Not green 0.7. From each first-spin branch there are two more branches for the second spin: Green 0.3 and Not green 0.7. The four outcome ends are GG, GN, NG and NN." },
          },
          {
            key: "prob-y10-06", kind: "single", difficulty: 2,
            prompt: "Two fair dice are rolled. What is the probability that both show a 6?",
            options: ["1/12", "1/6", "1/18", "1/36"],
            answer: "1/36",
            explanation: "The events are independent, so multiply: 1/6 × 1/6 = 1/36.",
          },
          {
            key: "prob-y10-07", kind: "single", difficulty: 2,
            prompt: "A bag holds 5 red and 3 blue counters. Two counters are taken without replacement. What is the probability that both are red?",
            options: ["5/14", "25/64", "5/7", "1/2"],
            answer: "5/14",
            explanation: "The first is red with probability 5/8. Then 4 red remain out of 7, so P(both red) = 5/8 × 4/7 = 20/56 = 5/14.",
          },
          {
            key: "prob-y10-08", kind: "single", difficulty: 2,
            prompt: "Two fair dice are rolled and the scores are multiplied. What is the probability that the product is even?",
            options: ["1/2", "3/4", "1/4", "5/6"],
            answer: "3/4",
            explanation: "The product is odd only when both dice are odd: 1/2 × 1/2 = 1/4. So P(even) = 1 − 1/4 = 3/4.",
          },
          {
            key: "prob-y10-09", kind: "number", difficulty: 2, tolerance: 0.0001,
            prompt: "A spinner is red, blue, green or yellow. P(red) = 0.2, P(blue) = 0.3 and P(green) = P(yellow). Find P(yellow). Give your answer as a decimal.",
            answer: 0.25,
            explanation: "All probabilities add to 1. Green and yellow share 1 − 0.2 − 0.3 = 0.5, so each is 0.25.",
          },
          {
            key: "prob-y10-10", kind: "number", difficulty: 3,
            prompt: "In a survey of 50 people, 28 own a cat, 20 own a dog and 6 own neither. How many own both a cat and a dog?",
            answer: 4,
            explanation: "44 people own at least one animal (50 − 6). Cat plus dog counts the 'both' people twice: 28 + 20 = 48, which is 4 more than 44. So 4 own both.",
          },
          {
            key: "prob-y10-11", kind: "number", difficulty: 2,
            prompt: "A biased die is rolled 1000 times and shows a six 210 times. Use this to estimate how many sixes there would be in 300 rolls.",
            answer: 63,
            explanation: "The relative frequency of a six is 210/1000 = 0.21. Expected sixes in 300 rolls = 0.21 × 300 = 63.",
          },
          {
            key: "prob-y10-12", kind: "single", difficulty: 3,
            prompt: "A fair coin is tossed 3 times. What is the probability of getting at least one head?",
            options: ["1/8", "3/4", "3/8", "7/8"],
            answer: "7/8",
            explanation: "'At least one head' is the opposite of 'no heads' (three tails). P(TTT) = 1/8, so the answer is 1 − 1/8 = 7/8.",
          },
          {
            key: "prob-y10-13", kind: "single", difficulty: 3,
            prompt: "A bag contains 4 red and 6 blue counters. Two are taken without replacement. What is the probability that they are different colours?",
            options: ["12/25", "4/15", "8/15", "2/5"],
            answer: "8/15",
            explanation: "Red then blue: 4/10 × 6/9 = 24/90. Blue then red: 6/10 × 4/9 = 24/90. Add: 48/90 = 8/15.",
          },
        ],
      },
      flashcards: [
        { front: "Probability of an event that is certain / impossible", back: "1 / 0" },
        { front: "P(not A)", back: "1 − P(A)" },
        { front: "Relative frequency", back: "frequency ÷ total number of trials" },
        { front: "Expected number of outcomes", back: "probability × number of trials" },
        { front: "Independent events: P(A and B)", back: "P(A) × P(B)" },
        { front: "Mutually exclusive events: P(A or B)", back: "P(A) + P(B)" },
        { front: "Tree diagram: what do you do along the branches?", back: "Multiply along a path; add the paths that give the outcome you want." },
        { front: "What changes when selecting without replacement?", back: "The second-stage probabilities: the totals (and possibly the counts) have gone down by one." },
        { front: "Probabilities on branches from one point", back: "Always add up to 1." },
        { front: "Why do more trials give a better estimate?", back: "Relative frequency settles towards the true probability as the number of trials grows." },
        { front: "Sample space diagram", back: "A table or list of all possible outcomes, used to count favourable ones." },
        { front: "'At least one' problems", back: "Use 1 − P(none)." },
      ],
    },
    11: {
      year: 11,
      objectives: [
        "Use set notation: ∪, ∩, complement and n(A) with Venn diagrams.",
        "Calculate conditional probabilities from Venn diagrams, two-way tables and tree diagrams.",
        "Use P(A ∪ B) = P(A) + P(B) − P(A ∩ B).",
        "Test whether events are independent.",
        "Solve multi-stage problems without replacement.",
      ],
      note: {
        title: "Year 11 Probability: set notation and conditional probability",
        body: `## What you need to know

**Set notation.**
- **A ∪ B** (union): in A or B or both.
- **A ∩ B** (intersection): in both A and B.
- **A′** (complement): not in A.
- **n(A)** is the number of elements in A. The **universal set** contains everything.

**Addition rule.** P(A ∪ B) = P(A) + P(B) − P(A ∩ B). We subtract the overlap so it is not counted twice.

**Conditional probability.** P(B | A) means "the probability of B **given** A has happened". Reduce the sample space to A, then count B inside it: **P(B | A) = P(A ∩ B) ÷ P(A)**. Rearranged, P(A ∩ B) = P(A) × P(B | A). This is the rule used along tree branches.

**Independent events** satisfy P(A ∩ B) = P(A) × P(B).

## Worked example 1: table
Of 50 students, 20 are in the choir and 8 of those also play an instrument. P(instrument | choir) = 8/20 = **2/5**. The denominator is the choir, not all 50.

## Worked example 2: union
P(A) = 0.7, P(B) = 0.35, P(A ∩ B) = 0.15. P(A ∪ B) = 0.7 + 0.35 − 0.15 = **0.9**.

## Worked example 3: without replacement
Three cards from 10 with 4 hearts. P(all hearts) = 4/10 × 3/9 × 2/8 = 24/720 = **1/30**.

| Symbol | Meaning |
| --- | --- |
| A ∩ B | both |
| A ∪ B | either or both |
| A′ | not A |
| P(B \\| A) | B given A |`,
      },
      quiz: {
        title: "Probability: Year 11 GCSE quiz",
        questions: [
          {
            key: "prob-y11-01", kind: "single", difficulty: 1,
            prompt: "In set notation, what does A ∩ B mean?",
            options: ["Elements in A but not in B", "Elements in A or B or both", "Elements in both A and B", "Elements in neither A nor B"],
            answer: "Elements in both A and B",
            explanation: "∩ is the intersection: only the elements that belong to both sets, the overlap of the two circles.",
          },
          {
            key: "prob-y11-02", kind: "number", difficulty: 1, tolerance: 0.0001,
            prompt: "A and B are independent events with P(A) = 0.3 and P(B) = 0.5. Find P(A and B).",
            answer: 0.15,
            explanation: "For independent events multiply the probabilities: 0.3 × 0.5 = 0.15.",
          },
          {
            key: "prob-y11-03", kind: "number", difficulty: 1,
            prompt: "The Venn diagram shows the whole numbers 1 to 20. A is the set of even numbers and B is the set of multiples of 3. How many of the numbers are in neither A nor B?",
            answer: 7,
            explanation: "Count the numbers outside both circles: 1, 5, 7, 11, 13, 17 and 19. That is 7 numbers.",
            image: { file: "prob-y11-venn.png", alt: "A Venn diagram in a rectangle labelled with the numbers 1 to 20. Circle A is labelled Even numbers and circle B is labelled Multiples of 3. A only contains 2, 4, 8, 10, 14, 16, 20. The overlap contains 6, 12, 18. B only contains 3, 9, 15. Outside both circles are 1, 5, 7, 11, 13, 17, 19." },
          },
          {
            key: "prob-y11-04", kind: "single", difficulty: 2, diagnostic: true,
            prompt: "Using the Venn diagram of the numbers 1 to 20 (A = even numbers, B = multiples of 3), a number is chosen at random. What is P(A ∪ B)?",
            options: ["13/20", "3/5", "1/2", "4/5"],
            answer: "13/20",
            explanation: "A ∪ B contains all numbers in either circle: 7 + 3 + 3 = 13. So P(A ∪ B) = 13/20. (Not 10 + 6 = 16, which counts the overlap twice.)",
            image: { file: "prob-y11-venn.png", alt: "A Venn diagram in a rectangle labelled with the numbers 1 to 20. Circle A is labelled Even numbers and circle B is labelled Multiples of 3. A only contains 2, 4, 8, 10, 14, 16, 20. The overlap contains 6, 12, 18. B only contains 3, 9, 15. Outside both circles are 1, 5, 7, 11, 13, 17, 19." },
          },
          {
            key: "prob-y11-05", kind: "single", difficulty: 2, diagnostic: true,
            prompt: "Using the same Venn diagram, a number is chosen at random from set A (the even numbers). What is the probability that it is also a multiple of 3, P(B | A)?",
            options: ["3/13", "1/2", "3/20", "3/10"],
            answer: "3/10",
            explanation: "Given that the number is in A, the sample space is the 10 numbers in A. Three of them (6, 12, 18) are multiples of 3, so P(B | A) = 3/10.",
            image: { file: "prob-y11-venn.png", alt: "A Venn diagram in a rectangle labelled with the numbers 1 to 20. Circle A is labelled Even numbers and circle B is labelled Multiples of 3. A only contains 2, 4, 8, 10, 14, 16, 20. The overlap contains 6, 12, 18. B only contains 3, 9, 15. Outside both circles are 1, 5, 7, 11, 13, 17, 19." },
          },
          {
            key: "prob-y11-06", kind: "single", difficulty: 2,
            prompt: "A bag holds 6 green and 4 yellow counters. Two are taken at random without replacement. What is the probability that both are yellow?",
            options: ["4/25", "2/15", "6/25", "1/3"],
            answer: "2/15",
            explanation: "P(first yellow) = 4/10. Then 3 yellow remain out of 9, so P(both yellow) = 4/10 × 3/9 = 12/90 = 2/15.",
          },
          {
            key: "prob-y11-07", kind: "number", difficulty: 2, tolerance: 0.0001,
            prompt: "The probability of rain tomorrow is 0.4. If it rains, the probability that Sam is late is 0.3. If it does not rain, the probability that Sam is late is 0.1. What is the probability that Sam is late?",
            answer: 0.18,
            explanation: "Rain and late: 0.4 × 0.3 = 0.12. No rain and late: 0.6 × 0.1 = 0.06. Add the two routes: 0.12 + 0.06 = 0.18.",
          },
          {
            key: "prob-y11-08", kind: "number", difficulty: 2, tolerance: 0.0001,
            prompt: "P(A) = 0.5 and P(B | A) = 0.4. Find P(A ∩ B).",
            answer: 0.2,
            explanation: "P(A ∩ B) = P(A) × P(B | A) = 0.5 × 0.4 = 0.2.",
          },
          {
            key: "prob-y11-09", kind: "single", difficulty: 2,
            prompt: "In a club, 18 boys and 12 girls play football, and 14 boys and 16 girls play other sports. A girl is chosen at random. What is the probability that she plays football?",
            options: ["1/5", "2/5", "7/15", "3/7"],
            answer: "3/7",
            explanation: "Only the girls matter: 12 + 16 = 28 girls, of whom 12 play football. So the probability is 12/28 = 3/7.",
          },
          {
            key: "prob-y11-10", kind: "number", difficulty: 3, tolerance: 0.0005,
            prompt: "A fair die is rolled 3 times. Find the probability of getting at least one six. Give your answer as a decimal to 3 decimal places.",
            answer: 0.421,
            explanation: "P(no sixes) = 5/6 × 5/6 × 5/6 = 125/216. So P(at least one six) = 1 − 125/216 = 91/216 = 0.421.",
          },
          {
            key: "prob-y11-11", kind: "number", difficulty: 3, tolerance: 0.0001,
            prompt: "P(A) = 0.6, P(B) = 0.5 and P(A ∪ B) = 0.8. Find P(A ∩ B).",
            answer: 0.3,
            explanation: "Rearrange P(A ∪ B) = P(A) + P(B) − P(A ∩ B): P(A ∩ B) = 0.6 + 0.5 − 0.8 = 0.3. (Since 0.6 × 0.5 = 0.3, A and B are independent.)",
          },
          {
            key: "prob-y11-12", kind: "single", difficulty: 3,
            prompt: "A bag has 5 mint and 7 toffee sweets. Three sweets are taken without replacement. What is the probability that all three are mint?",
            options: ["1/22", "1/12", "5/33", "125/1728"],
            answer: "1/22",
            explanation: "Multiply the changing fractions: 5/12 × 4/11 × 3/10 = 60/1320 = 1/22.",
          },
          {
            key: "prob-y11-13", kind: "written", difficulty: 3, marks: 4,
            prompt: "A box holds 8 red and 2 blue pens. Two pens are taken at random without replacement. Show that the probability that they are the same colour is 29/45.",
            answer: "P(RR) = 8/10 × 7/9 = 56/90. P(BB) = 2/10 × 1/9 = 2/90. Total = 58/90 = 29/45.",
            explanation: "Mark scheme (4 marks): 1 for P(RR) = 8/10 × 7/9 = 56/90; 1 for P(BB) = 2/10 × 1/9 = 2/90; 1 for adding the two routes = 58/90; 1 for simplifying to 29/45.",
          },
        ],
      },
      flashcards: [
        { front: "A ∪ B", back: "Union: in A or B or both." },
        { front: "A ∩ B", back: "Intersection: in both A and B." },
        { front: "A′", back: "Complement: everything in the universal set that is not in A." },
        { front: "n(A)", back: "The number of elements in set A." },
        { front: "P(A ∪ B)", back: "P(A) + P(B) − P(A ∩ B)" },
        { front: "P(B | A) means…", back: "The probability of B given that A has happened." },
        { front: "P(B | A) formula", back: "P(A ∩ B) ÷ P(A)" },
        { front: "P(A ∩ B) using conditional probability", back: "P(A) × P(B | A)" },
        { front: "Test for independence", back: "P(A ∩ B) = P(A) × P(B)" },
        { front: "Without replacement: what happens to the second fraction?", back: "The denominator falls by 1 (and the numerator too if the same type was removed)." },
        { front: "Two ways to get 'one of each' in two picks", back: "Add both orders: P(A then B) + P(B then A)." },
        { front: "Universal set", back: "The set that contains every element being considered (drawn as the rectangle)." },
      ],
    },
  },
};
