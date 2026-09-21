// KS3 Maths — Probability (Years 7–9). Original content aligned to the DfE National Curriculum KS3 programme of study (OGL v3.0).
// Answer keys are recomputed by _check_m2.ts — re-run it after ANY edit here. Pictures are drawn from _m2data.ts.
import type { CTopic } from "../types";

export const TOPIC: CTopic = {
  key: "prob",
  topic: "Probability",
  subject: "Maths",
  years: {
    7: {
      year: 7,
      objectives: [
        "Record, describe and analyse the frequency of outcomes of simple probability experiments; use the language and the 0–1 scale of probability.",
        "Understand that the probabilities of all possible outcomes sum to 1.",
        "Calculate theoretical probabilities for single events with equally likely outcomes, and identify mutually exclusive events.",
      ],
      note: {
        title: "Year 7: the probability scale and theoretical probability",
        body: `## What you need to know

- Probability measures how likely an event is, on a scale from **0 (impossible)** to **1 (certain)**. It can be written as a fraction, a decimal or a percentage. It can never be less than 0 or more than 1.
- For **equally likely** outcomes: **probability = number of ways the event can happen ÷ total number of outcomes.**
- The probabilities of ALL the outcomes add up to **1**, so P(not A) = 1 − P(A).
- Events are **mutually exclusive** if they cannot happen at the same time (a coin landing on heads and on tails in one toss).

## Worked example 1: theoretical probability

A bag holds 3 red and 7 blue counters. There are 10 counters altogether, so P(red) = **3/10**, and P(blue) = 7/10. Check: 3/10 + 7/10 = 1.

## Worked example 2: the complement

The probability that a bus is late is 0.15. The probability that it is not late is 1 − 0.15 = **0.85**.

## Worked example 3: mutually exclusive events

A spinner shows green with probability 0.2 and yellow with probability 0.5. These events cannot both happen on one spin, so P(green or yellow) = 0.2 + 0.5 = **0.7**.

| Word | Probability |
| --- | --- |
| Impossible | 0 |
| Even chance | 1/2 |
| Certain | 1 |`,
      },
      quiz: {
        title: "Probability: Year 7 quiz",
        questions: [
          {
            key: "prob-y7-01",
            kind: "single",
            prompt: "Which word best describes the chance of rolling a 7 on a standard six-sided dice?",
            options: ["Impossible", "Unlikely", "Even chance", "Certain"],
            answer: "Impossible",
            explanation: "A standard dice only shows the numbers 1 to 6, so a 7 can never happen. That is impossible, with probability 0.",
            difficulty: 1,
          },
          {
            key: "prob-y7-02",
            kind: "single",
            prompt: "A fair coin is tossed. What is the probability that it lands on heads?",
            options: ["1/3", "1", "2", "1/2"],
            answer: "1/2",
            explanation: "There are 2 equally likely outcomes, heads and tails, and 1 of them is heads. So the probability is 1/2.",
            difficulty: 1,
          },
          {
            key: "prob-y7-03",
            kind: "single",
            prompt: "Which of these numbers cannot be a probability?",
            options: ["0.3", "3/4", "1.2", "0"],
            answer: "1.2",
            explanation: "Probabilities are between 0 and 1. 1.2 is bigger than 1, so it cannot be a probability.",
            difficulty: 1,
          },
          {
            key: "prob-y7-04",
            kind: "single",
            prompt: "The spinner has 8 equal sections. What is the probability that it lands on blue?",
            options: ["2/6", "1/4", "2/3", "1/2"],
            answer: "1/4",
            explanation: "2 of the 8 equal sections are blue, so the probability is 2/8, which simplifies to 1/4.",
            difficulty: 2,
            diagnostic: true,
            image: { file: "prob-y7-spinner.png", alt: "A round spinner divided into 8 equal sections coloured, in order, red, blue, green, red, yellow, blue, green, red, with an arrow in the centre." },
          },
          {
            key: "prob-y7-05",
            kind: "number",
            prompt: "The probability that it rains tomorrow is 0.35. What is the probability that it does not rain?",
            answer: 0.65,
            explanation: "The probabilities of an event happening and not happening add up to 1. So 1 − 0.35 = 0.65.",
            difficulty: 2,
          },
          {
            key: "prob-y7-06",
            kind: "single",
            prompt: "A bag contains 4 red counters and 6 blue counters. One counter is taken without looking. What is the probability that it is red?",
            options: ["4/6", "3/5", "2/5", "1/4"],
            answer: "2/5",
            explanation: "There are 4 + 6 = 10 counters and 4 are red, so P(red) = 4/10 = 2/5. Do not compare red with blue only.",
            difficulty: 2,
            diagnostic: true,
          },
          {
            key: "prob-y7-07",
            kind: "short",
            prompt: "A fair 12-sided dice is numbered 1 to 12. What is the probability of rolling a prime number? Give a fraction.",
            answer: "5/12",
            accepted: ["5/12", "5 / 12"],
            explanation: "The primes from 1 to 12 are 2, 3, 5, 7 and 11, which is 5 numbers out of 12. So the probability is 5/12.",
            difficulty: 2,
          },
          {
            key: "prob-y7-08",
            kind: "multi",
            prompt: "One ordinary dice is rolled. Which pairs of events are mutually exclusive? Select all that apply.",
            options: [
              "Rolling a 2 and rolling a 5",
              "Rolling an even number and rolling a 4",
              "Rolling a 6 and rolling a prime number",
              "Rolling a number less than 3 and rolling an odd number",
              "Rolling a 1 and rolling an even number",
            ],
            answer: ["Rolling a 2 and rolling a 5", "Rolling a 6 and rolling a prime number", "Rolling a 1 and rolling an even number"],
            explanation: "Mutually exclusive means they cannot both happen on one roll. ‘even’ and ‘a 4’ overlap on the number 4, and ‘less than 3’ and ‘odd’ overlap on the number 1, so those pairs are not exclusive. In the other three pairs no number fits both events.",
            difficulty: 2,
          },
          {
            key: "prob-y7-09",
            kind: "number",
            prompt: "A bag holds red, blue and green counters. P(red) = 0.3 and P(blue) = 0.5. There are 40 counters in total. How many are green?",
            answer: 8,
            explanation: "P(green) = 1 − 0.3 − 0.5 = 0.2. Then 0.2 × 40 = 8 green counters.",
            difficulty: 3,
          },
          {
            key: "prob-y7-10",
            kind: "written",
            prompt: "Maya says: \"A football match can end in a win, a draw or a loss, so the probability that our team wins is 1/3.\" Explain why Maya might be wrong.",
            answer: "The three outcomes are not equally likely, so the probability is not 1 out of 3 just because there are 3 outcomes. It would depend on how strong the teams are, or past results.",
            explanation: "Mark scheme (2 marks): 1 mark for stating that the outcomes are not equally likely (a win, draw and loss do not have the same chance); 1 mark for saying that dividing 1 by the number of outcomes only works when outcomes are equally likely, or for giving a sensible reason such as the teams' strengths or past results.",
            difficulty: 3,
            marks: 2,
          },
        ],
      },
      flashcards: [
        { front: "What is the probability of an impossible event? Of a certain event?", back: "0 and 1" },
        { front: "Probability formula (equally likely outcomes)", back: "Number of ways the event can happen ÷ total number of outcomes" },
        { front: "P(not A) = ?", back: "1 − P(A)" },
        { front: "The probabilities of all outcomes add up to ...", back: "1" },
        { front: "What are mutually exclusive events?", back: "Events that cannot happen at the same time" },
        { front: "Probability of an even number on a fair dice", back: "3/6 = 1/2" },
        { front: "Can a probability be 1.5 or −0.2?", back: "No. It must be between 0 and 1 inclusive" },
        { front: "Name three ways to write a probability", back: "Fraction, decimal, percentage (e.g. 1/4, 0.25, 25%)" },
        { front: "Why is \"win or lose, so 1/2\" often wrong?", back: "Outcomes are not always equally likely" },
      ],
    },
    8: {
      year: 8,
      objectives: [
        "Enumerate sets and combinations of sets systematically, using tables, grids and sample spaces.",
        "Estimate probabilities from experimental data using relative frequency; understand that more trials give more reliable estimates.",
        "Calculate expected outcomes: probability × number of trials.",
      ],
      note: {
        title: "Year 8: sample spaces, relative frequency and expected outcomes",
        body: `## What you need to know

- A **sample space** lists all possible outcomes. For two coins it is HH, HT, TH, TT (4 outcomes). For two dice, use a 6 × 6 grid of 36 outcomes.
- **Relative frequency** (experimental probability) = number of times the event happened ÷ total number of trials.
- The **more trials**, the more reliable the estimate. A fair dice rolled 6 times might not give one of each number, but rolled 6,000 times it will be very close.
- **Expected number** of outcomes = probability × number of trials. It is a prediction, not a guarantee.

## Worked example 1: sample space

Two dice are rolled and the scores added. Total 8 can happen as (2,6), (3,5), (4,4), (5,3), (6,2): 5 ways out of 36, so P(total 8) = **5/36**.

## Worked example 2: relative frequency

A drawing pin is dropped 100 times and lands point up 37 times. The estimated probability is 37 ÷ 100 = **0.37**.

## Worked example 3: expected outcomes

The probability of sunshine on a given day is 0.3. In 60 days you would expect 0.3 × 60 = **18** sunny days.

| Trials | Relative frequency of heads |
| --- | --- |
| 10 | 0.7 (could be far from 0.5) |
| 1,000 | 0.51 (close to 0.5) |`,
      },
      quiz: {
        title: "Probability: Year 8 quiz",
        questions: [
          {
            key: "prob-y8-01",
            kind: "number",
            prompt: "A coin is flipped 50 times and lands on heads 28 times. What is the relative frequency of heads, as a decimal?",
            answer: 0.56,
            explanation: "Relative frequency = number of heads ÷ number of flips = 28 ÷ 50 = 0.56.",
            difficulty: 1,
          },
          {
            key: "prob-y8-02",
            kind: "single",
            prompt: "Two coins are tossed together. How many different outcomes are possible?",
            options: ["2", "3", "4", "6"],
            answer: "4",
            explanation: "List them: HH, HT, TH, TT. HT and TH are different outcomes, so there are 4.",
            difficulty: 1,
          },
          {
            key: "prob-y8-03",
            kind: "number",
            prompt: "The probability of rain on any day in April is 0.2. About how many rainy days would you expect in the 30 days of April?",
            answer: 6,
            explanation: "Expected number = probability × number of days = 0.2 × 30 = 6.",
            difficulty: 2,
          },
          {
            key: "prob-y8-04",
            kind: "number",
            prompt: "Two fair dice are rolled and their scores are added. In how many different ways can a total of 7 be made?",
            answer: 6,
            explanation: "List the pairs: (1,6), (2,5), (3,4), (4,3), (5,2) and (6,1). That is 6 ways.",
            difficulty: 2,
          },
          {
            key: "prob-y8-05",
            kind: "single",
            prompt: "Two fair dice are rolled and their scores are added. What is the probability of a total of 10?",
            options: ["1/12", "1/10", "3/10", "1/6"],
            answer: "1/12",
            explanation: "A total of 10 can be made as (4,6), (5,5) and (6,4): 3 ways out of 36. 3/36 simplifies to 1/12.",
            difficulty: 2,
            diagnostic: true,
          },
          {
            key: "prob-y8-06",
            kind: "single",
            prompt: "A spinner is spun 200 times and lands on red 48 times. What is the best estimate of the probability that it lands on red?",
            options: ["0.48", "0.24", "0.2", "0.76"],
            answer: "0.24",
            explanation: "Relative frequency = 48 ÷ 200 = 0.24. The answer 0.48 uses the number of times, not the fraction of spins.",
            difficulty: 2,
            diagnostic: true,
          },
          {
            key: "prob-y8-07",
            kind: "number",
            prompt: "A biased dice lands on 6 with probability 0.25. It is rolled 80 times. How many sixes would you expect?",
            answer: 20,
            explanation: "Expected number = probability × number of rolls = 0.25 × 80 = 20.",
            difficulty: 2,
          },
          {
            key: "prob-y8-08",
            kind: "single",
            prompt: "You want to estimate the probability that a biased coin lands on heads. Which experiment gives the most reliable estimate?",
            options: ["Flip it 10 times", "Flip it 100 times", "Flip it 1,000 times", "They are all equally reliable"],
            answer: "Flip it 1,000 times",
            explanation: "The more trials you do, the closer the relative frequency gets to the true probability. So 1,000 flips is the most reliable.",
            difficulty: 1,
          },
          {
            key: "prob-y8-09",
            kind: "number",
            prompt: "Spinner A has sections numbered 1, 2, 3 and spinner B has sections numbered 1, 2, 3, 4 (all sections equal in size). Both are spun and the scores added. What is the probability that the total is more than 5? Give your answer as a decimal.",
            answer: 0.25,
            explanation: "There are 3 × 4 = 12 outcomes. Totals above 5 are (2,4), (3,3) and (3,4): 3 outcomes. 3/12 = 0.25.",
            difficulty: 3,
          },
          {
            key: "prob-y8-10",
            kind: "single",
            prompt: "A fair dice is rolled twice. What is the probability of getting at least one six?",
            options: ["1/3", "5/36", "1/6", "11/36"],
            answer: "11/36",
            explanation: "Of the 36 outcomes, 5 have a six only on the first roll, 5 only on the second, and 1 has two sixes: 5 + 5 + 1 = 11 outcomes. So 11/36.",
            difficulty: 3,
          },
        ],
      },
      flashcards: [
        { front: "What is a sample space?", back: "A list or table of all the possible outcomes" },
        { front: "How many outcomes are there when two dice are rolled?", back: "36 (6 × 6)" },
        { front: "Relative frequency formula", back: "Number of times the event happened ÷ total number of trials" },
        { front: "Expected number of outcomes", back: "Probability × number of trials" },
        { front: "Why do more trials give a better estimate?", back: "Chance variation evens out, so results get closer to the true probability" },
        { front: "P(total 2) with two dice", back: "1/36 (only 1 + 1)" },
        { front: "How many ways can two dice make a total of 9?", back: "4 ways: (3,6), (4,5), (5,4), (6,3)" },
        { front: "Is HT the same outcome as TH?", back: "No. They are two different outcomes" },
        { front: "Does an expected number of 5 mean exactly 5 will happen?", back: "No. It is a prediction of the average" },
      ],
    },
    9: {
      year: 9,
      objectives: [
        "Calculate the probability of independent and dependent combined events, including using tree diagrams.",
        "Use Venn diagrams to represent sets and find probabilities.",
        "Understand and use the difference between selection with and without replacement.",
      ],
      note: {
        title: "Year 9: tree diagrams, independent events and Venn diagrams",
        body: `## What you need to know

- **Independent events**: one does not affect the other. Then **P(A and B) = P(A) × P(B)**.
- On a **tree diagram**, multiply along the branches to get the probability of a path, and add the paths that give the outcome you want.
- **With replacement** the probabilities stay the same on the second pick. **Without replacement** the numbers change because an item has gone.
- A **Venn diagram** shows how two sets overlap. Remember the region outside both circles (neither) counts too, and it sits inside the box of all the items.

## Worked example 1: independent events

P(A) = 0.6 and P(B) = 0.2 for independent events. P(A and B) = 0.6 × 0.2 = **0.12**.

## Worked example 2: without replacement

A bag has 5 red and 4 blue counters (9 in total). Two are taken without replacement. P(both red) = 5/9 × 4/8 = 20/72 = **5/18**. The second fraction uses 4 red left out of 8 counters.

## Worked example 3: Venn diagram

30 pupils: 14 do art, 11 do music, 5 do both. Art only = 14 − 5 = 9 and music only = 11 − 5 = 6. So 9 + 5 + 6 = 20 do at least one, and **10** do neither.

| Situation | Rule |
| --- | --- |
| Independent events | P(A and B) = P(A) × P(B) |
| At least one | 1 − P(none) |`,
      },
      quiz: {
        title: "Probability: Year 9 quiz",
        questions: [
          {
            key: "prob-y9-01",
            kind: "number",
            prompt: "A and B are independent events. P(A) = 0.3 and P(B) = 0.5. What is P(A and B)?",
            answer: 0.15,
            explanation: "For independent events multiply the probabilities: 0.3 × 0.5 = 0.15.",
            difficulty: 1,
          },
          {
            key: "prob-y9-02",
            kind: "single",
            prompt: "Which sentence describes two independent events?",
            options: ["They cannot happen together", "One must happen after the other", "The outcome of one does not affect the other", "They have the same probability"],
            answer: "The outcome of one does not affect the other",
            explanation: "Independent events do not influence each other, like two separate coin tosses. Events that cannot both happen are called mutually exclusive.",
            difficulty: 1,
          },
          {
            key: "prob-y9-03",
            kind: "single",
            prompt: "A fair coin is flipped twice. What is the probability of getting two tails?",
            options: ["1/4", "1/2", "1/3", "1/8"],
            answer: "1/4",
            explanation: "The flips are independent: 1/2 × 1/2 = 1/4.",
            difficulty: 1,
          },
          {
            key: "prob-y9-04",
            kind: "number",
            prompt: "The Venn diagram shows 25 pupils and the numbers who play football only, both sports, and tennis only. How many pupils play neither sport?",
            answer: 8,
            explanation: "Add the numbers in the circles: 8 + 4 + 5 = 17 pupils play at least one sport. So 25 − 17 = 8 play neither.",
            difficulty: 2,
            diagnostic: true,
            image: { file: "prob-y9-venn.png", alt: "A Venn diagram inside a rectangle labelled 25 pupils. Two overlapping circles, Football and Tennis. The football-only region shows 8, the overlap shows 4 and the tennis-only region shows 5. The area outside the circles is blank." },
          },
          {
            key: "prob-y9-05",
            kind: "single",
            prompt: "Using the same Venn diagram, one of the 25 pupils is chosen at random. What is the probability that this pupil plays football?",
            options: ["4/25", "8/25", "17/25", "12/25"],
            answer: "12/25",
            explanation: "Everyone in the football circle plays football: 8 (football only) + 4 (both) = 12. So the probability is 12/25.",
            difficulty: 2,
            image: { file: "prob-y9-venn.png", alt: "A Venn diagram inside a rectangle labelled 25 pupils. Two overlapping circles, Football and Tennis. The football-only region shows 8, the overlap shows 4 and the tennis-only region shows 5. The area outside the circles is blank." },
          },
          {
            key: "prob-y9-06",
            kind: "single",
            prompt: "A bag holds 3 red and 2 blue counters. A counter is picked and put back, then a second is picked. The tree diagram shows the probabilities. What is the probability of picking two red counters?",
            options: ["6/25", "9/25", "3/5", "4/25"],
            answer: "9/25",
            explanation: "Multiply along the red, red branches: 3/5 × 3/5 = 9/25.",
            difficulty: 2,
            diagnostic: true,
            image: { file: "prob-y9-tree.png", alt: "A tree diagram with two stages. Each stage has a red branch labelled 3/5 and a blue branch labelled 2/5. The four ends are labelled RR, RB, BR and BB." },
          },
          {
            key: "prob-y9-07",
            kind: "number",
            prompt: "Using the same tree diagram, what is the probability of picking one red and one blue counter, in either order? Give your answer as a decimal.",
            answer: 0.48,
            explanation: "Red then blue is 3/5 × 2/5 = 6/25 and blue then red is also 6/25. Add the two paths: 12/25 = 0.48.",
            difficulty: 2,
            image: { file: "prob-y9-tree.png", alt: "A tree diagram with two stages. Each stage has a red branch labelled 3/5 and a blue branch labelled 2/5. The four ends are labelled RR, RB, BR and BB." },
          },
          {
            key: "prob-y9-08",
            kind: "single",
            prompt: "A bag holds 4 red and 3 blue counters. Two counters are taken out WITHOUT replacement. What is the probability that both are blue?",
            options: ["1/7", "9/49", "3/7", "6/13"],
            answer: "1/7",
            explanation: "The first is blue with probability 3/7. Then 2 blue are left out of 6, so the second is 2/6. Multiply: 3/7 × 2/6 = 6/42 = 1/7.",
            difficulty: 2,
          },
          {
            key: "prob-y9-09",
            kind: "number",
            prompt: "Using the same 3 red and 2 blue counters, with replacement, what is the probability of picking at least one red in two picks? Give your answer as a decimal.",
            answer: 0.84,
            explanation: "It is easier to find the opposite: no reds means blue, blue = 2/5 × 2/5 = 4/25. So P(at least one red) = 1 − 4/25 = 21/25 = 0.84.",
            difficulty: 3,
            image: { file: "prob-y9-tree.png", alt: "A tree diagram with two stages. Each stage has a red branch labelled 3/5 and a blue branch labelled 2/5. The four ends are labelled RR, RB, BR and BB." },
          },
          {
            key: "prob-y9-10",
            kind: "single",
            prompt: "The probability of rain on Saturday is 0.4 and on Sunday is 0.3. The days are independent. What is the probability that it rains on exactly one of the two days?",
            options: ["0.12", "0.46", "0.58", "0.7"],
            answer: "0.46",
            explanation: "Rain only on Saturday: 0.4 × 0.7 = 0.28. Rain only on Sunday: 0.6 × 0.3 = 0.18. Add them: 0.28 + 0.18 = 0.46.",
            difficulty: 3,
          },
        ],
      },
      flashcards: [
        { front: "P(A and B) for independent events", back: "P(A) × P(B)" },
        { front: "What does independent mean?", back: "The outcome of one event does not change the probability of the other" },
        { front: "On a tree diagram, what do you do along the branches?", back: "Multiply the probabilities" },
        { front: "On a tree diagram, how do you combine different paths?", back: "Add the probabilities of the paths you want" },
        { front: "What is different when picking without replacement?", back: "The number of items goes down, so the second probability changes" },
        { front: "P(at least one) shortcut", back: "1 − P(none)" },
        { front: "In a Venn diagram, what does the overlap show?", back: "Items that are in both sets" },
        { front: "P(head then head) with a fair coin", back: "1/2 × 1/2 = 1/4" },
        { front: "Bag: 2 red and 3 blue, picking two without replacement. P(both blue)?", back: "3/5 × 2/4 = 3/10" },
      ],
    },
  },
};
