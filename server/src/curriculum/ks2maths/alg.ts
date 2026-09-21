// KS2 Maths — Algebra (Year 6 only; Years 3–5 are not introduced as a strand).
// Original content aligned to the DfE programme of study (Open Government Licence v3.0).
// Every computed answer is re-derived independently by _check_k3.ts — run it after ANY edit.
import type { CTopic } from "../types";

export const TOPIC: CTopic = {
  key: "alg",
  topic: "Algebra",
  subject: "Maths",
  notIntroduced: {
    3: "Not introduced.",
    4: "Not introduced.",
    5: "Not introduced as a standalone strand.",
  },
  years: {
    6: {
      year: 6,
      objectives: [
        "Use simple formulae",
        "Generate and describe linear number sequences",
        "Express missing number problems algebraically",
        "Find pairs of numbers that satisfy an equation with two unknowns",
        "Enumerate possibilities of combinations of two variables",
      ],
      note: {
        title: "Algebra: formulae, sequences and equations",
        body: `## Letters stand for numbers

In algebra a **letter** stands for a number we do not know yet, or one that can change. **5n** means 5 × n (we leave out the × sign). An **expression** such as 5n + 2 has no equals sign; an **equation** such as 5n + 2 = 27 does.

## Key ideas

- **Formulae:** replace each letter with its number, then follow the order of operations — multiply **before** you add.
- **Linear sequences:** these go up or down by the same amount each step. The difference between neighbouring terms is the **rule**.
- **Missing-number problems:** write the problem as an equation, then **work backwards** using inverse operations.
- **Two unknowns:** an equation like a + 3b = 14 has many solutions. Try values for one letter and work out the other.

## Worked examples

**1. Using a formula.** Cinema tickets cost C = 4t + 2 pounds for t tickets, including a £2 booking fee. For 5 tickets: C = 4 × 5 + 2 = 20 + 2 = **£22**.

**2. Solving.** I think of a number, multiply by 4 and add 6. I get 30.
Write 4n + 6 = 30. Undo the add: 30 − 6 = 24. Undo the multiply: 24 ÷ 4 = **6**.

**3. Sequences.** Look at 3, 8, 13, 18, …
The differences are all 5, so the rule is 'add 5' and the next term is 18 + 5 = **23**.

## Top tip

Always check an answer by putting it back into the original problem.`,
      },
      quiz: {
        title: "Year 6 Algebra quiz",
        questions: [
          {
            key: "alg-y6-01",
            kind: "single",
            prompt: "What is the next term in the sequence 5, 9, 13, 17, …?",
            options: ["20", "22", "19", "21"],
            answer: "21",
            explanation: "The terms go up by 4 each time (9 − 5 = 4). So the next term is 17 + 4 = 21.",
            difficulty: 1,
          },
          {
            key: "alg-y6-02",
            kind: "single",
            prompt: "Which expression means 'a number n multiplied by 4, then 3 added'?",
            options: ["4n + 3", "n + 12", "4 + 3n", "n + 4 + 3"],
            answer: "4n + 3",
            explanation: "4n means 4 × n. Adding 3 to that gives 4n + 3.",
            difficulty: 1,
          },
          {
            key: "alg-y6-03",
            kind: "single",
            prompt: "The cost in pounds of hiring a bike is C = 5h + 3, where h is the number of hours. What is the cost of hiring the bike for 4 hours?",
            options: ["£12", "£35", "£23", "£20"],
            answer: "£23",
            explanation: "Replace h with 4: 5 × 4 + 3 = 20 + 3 = 23. Multiply first, then add.",
            difficulty: 2,
            diagnostic: true,
          },
          {
            key: "alg-y6-04",
            kind: "number",
            prompt: "I think of a number, multiply it by 3, then add 5. My answer is 26. What number did I think of?",
            answer: 7,
            explanation: "Write 3n + 5 = 26. Undo the + 5 by taking away 5 to get 21, then undo the × 3 by dividing: 21 ÷ 3 = 7.",
            difficulty: 2,
            diagnostic: true,
          },
          {
            key: "alg-y6-05",
            kind: "single",
            prompt: "A sequence has the rule 'multiply the term number by 3, then subtract 1'. What is the 10th term?",
            options: ["30", "29", "31", "27"],
            answer: "29",
            explanation: "The 10th term has term number 10. Multiply: 10 × 3 = 30, then subtract 1 to get 29.",
            difficulty: 2,
          },
          {
            key: "alg-y6-06",
            kind: "single",
            prompt: "Which of these numbers is in the sequence 4, 10, 16, 22, …?",
            options: ["62", "66", "68", "64"],
            answer: "64",
            explanation: "The sequence goes up in 6s from 4, so every term is 4 more than a multiple of 6. 64 − 4 = 60, which is 10 sixes; the others do not work.",
            difficulty: 2,
          },
          {
            key: "alg-y6-07",
            kind: "multi",
            prompt: "a and b are whole numbers. Which pairs make the equation a + 2b = 11 true? Select all that apply.",
            options: ["a = 1, b = 5", "a = 4, b = 3", "a = 5, b = 3", "a = 2, b = 5"],
            answer: ["a = 1, b = 5", "a = 5, b = 3"],
            explanation: "Put each pair into the equation. 1 + 2 × 5 = 11 and 5 + 2 × 3 = 11 both work, but 4 + 2 × 3 = 10 and 2 + 2 × 5 = 12 do not.",
            difficulty: 2,
          },
          {
            key: "alg-y6-08",
            kind: "number",
            prompt: "Cakes cost £2 each and drinks cost £3 each. Jo spends exactly £24 and buys at least one cake and at least one drink. How many different combinations of cakes and drinks could she buy?",
            answer: 3,
            explanation: "Write 2c + 3d = 24. Since 3d must be even, d is 2, 4, 6 or 8, giving c = 9, 6, 3 or 0. Jo needs at least one cake, so d = 8 is out, leaving 3 combinations.",
            difficulty: 3,
          },
          {
            key: "alg-y6-09",
            kind: "single",
            prompt: "Look at the function machine. What number goes in?",
            options: ["9", "30", "36", "7.5"],
            answer: "9",
            explanation: "Work backwards. Undo − 3 by adding 3: 33 + 3 = 36. Undo × 4 by dividing by 4: 36 ÷ 4 = 9.",
            difficulty: 3,
            image: {
              file: "alg-function-machine.png",
              alt: "A function machine drawn as four boxes joined by arrows. The first box holds a question mark for the unknown input. The next two boxes say multiply by 4 and then subtract 3. The last box, the output, shows 33.",
            },
          },
          {
            key: "alg-y6-10",
            kind: "number",
            prompt: "Work out the value of 3a + 2 when a = 5.",
            answer: 17,
            explanation: "Replace a with 5: 3 × 5 + 2 = 15 + 2 = 17.",
            difficulty: 1,
          },
        ],
      },
      flashcards: [
        { front: "What does a letter stand for in algebra?", back: "A number that is unknown or that can change." },
        { front: "What does 5n mean?", back: "5 × n — n multiplied by 5. We do not write the × sign." },
        { front: "Expression or equation? Which has an equals sign?", back: "An equation has an equals sign (5n + 2 = 27). An expression does not (5n + 2)." },
        { front: "How do you use a formula?", back: "Replace each letter with its number, then multiply before you add. For C = 4t + 2 with t = 5: 4 × 5 + 2 = 22." },
        { front: "What is a linear sequence?", back: "A sequence that goes up or down by the same amount every step." },
        { front: "How do you find the rule of a sequence like 3, 8, 13, 18?", back: "Subtract neighbouring terms: 8 − 3 = 5, so the rule is 'add 5'." },
        { front: "Solve 4x + 6 = 30.", back: "Work backwards: 30 − 6 = 24, then 24 ÷ 4 = 6, so x = 6." },
        { front: "How do you solve a function machine backwards?", back: "Start from the output and do the inverse operations in reverse order." },
        { front: "How can you test a pair of values in a + 3b = 14?", back: "Substitute both numbers. If the left side equals 14, the pair works." },
        { front: "How do you list every combination for 3c + 2d = 20?", back: "Try each whole number for one letter, work out the other, and cross out answers that are not whole or not allowed." },
      ],
    },
  },
};
