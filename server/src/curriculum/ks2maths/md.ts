// KS2 Maths — Multiplication & Division (Years 3–6). Original content aligned to the DfE National Curriculum (OGL v3.0).
// Answer keys are recomputed by _check_k2.ts — re-run it after ANY edit here.
import type { CTopic } from "../types";

export const TOPIC: CTopic = {
  key: "md",
  topic: "Multiplication & Division",
  subject: "Maths",
  years: {
    3: {
      year: 3,
      objectives: [
        "Recall and use multiplication and division facts for the 3, 4 and 8 multiplication tables.",
        "Multiply two-digit numbers by one-digit numbers using mental and progressing to formal written methods.",
        "Solve problems, including missing number problems, involving multiplication and division, including scaling and correspondence problems in which n objects are connected to m objects.",
      ],
      note: {
        title: "Year 3: the 3, 4 and 8 times tables and multiplying by one digit",
        body: `## What you need to know

The **3, 4 and 8 times tables** are linked. Each fact also gives you a division fact: if 3 × 5 = 15 then 15 ÷ 3 = 5 and 15 ÷ 5 = 3.

Two handy links between the tables:
- The **4 times table** is the 2 times table **doubled**.
- The **8 times table** is the 4 times table **doubled**.

| Table | First few answers |
| --- | --- |
| 3 × | 3, 6, 9, 12, 15, 18, 21, 24, 27, 30 |
| 4 × | 4, 8, 12, 16, 20, 24, 28, 32, 36, 40 |
| 8 × | 8, 16, 24, 32, 40, 48, 56, 64, 72, 80 |

## Worked example 1: multiplying a two-digit number by one digit

Work out 32 × 4.
- Split 32 into 30 and 2.
- 30 × 4 = 120 and 2 × 4 = 8.
- Add the parts: 120 + 8 = **128**.

## Worked example 2: scaling

A pencil costs 5p. A rubber costs 3 times as much. The rubber costs 3 × 5p = **15p**.

## Worked example 3: correspondence

There are 5 flavours of ice cream and 2 toppings. Every flavour can go with every topping, so there are 5 × 2 = **10** different ice creams.

**Tip:** check a division by multiplying back. 32 ÷ 8 = 4 because 4 × 8 = 32.`,
      },
      quiz: {
        title: "Multiplication & Division: Year 3 quiz",
        questions: [
          {
            key: "md-y3-01",
            kind: "single",
            prompt: "What is 4 × 7?",
            options: ["28", "24", "32", "21"],
            answer: "28",
            explanation: "Count in 4s seven times: 4, 8, 12, 16, 20, 24, 28. So 4 × 7 = 28.",
            difficulty: 1,
          },
          {
            key: "md-y3-02",
            kind: "single",
            prompt: "What is 24 ÷ 3?",
            options: ["6", "7", "8", "9"],
            answer: "8",
            explanation: "Think 'what times 3 makes 24?' Since 8 × 3 = 24, we know 24 ÷ 3 = 8.",
            difficulty: 1,
          },
          {
            key: "md-y3-03",
            kind: "number",
            prompt: "Work out 8 × 6.",
            answer: 48,
            explanation: "6 × 8 is the same as 6 × 4 doubled: 24 doubled is 48.",
            difficulty: 1,
          },
          {
            key: "md-y3-04",
            kind: "single",
            prompt: "What is 23 × 4?",
            options: ["82", "92", "96", "812"],
            answer: "92",
            explanation: "Split 23 into 20 and 3. 20 × 4 = 80 and 3 × 4 = 12, and 80 + 12 = 92.",
            difficulty: 2,
            diagnostic: true,
          },
          {
            key: "md-y3-05",
            kind: "single",
            prompt: "Each pack has 8 pencils in it. How many pencils are in 7 packs?",
            options: ["54", "63", "48", "56"],
            answer: "56",
            explanation: "There are 7 groups of 8, so multiply: 7 × 8 = 56.",
            difficulty: 2,
          },
          {
            key: "md-y3-06",
            kind: "multi",
            prompt: "Which of these numbers are in the 4 times table? Choose all that apply.",
            options: ["12", "18", "28", "34", "40"],
            answer: ["12", "28", "40"],
            explanation: "Numbers in the 4 times table can be shared into 4 equal groups: 12 = 3 × 4, 28 = 7 × 4 and 40 = 10 × 4.",
            difficulty: 2,
          },
          {
            key: "md-y3-07",
            kind: "single",
            prompt: "A pencil costs 8p. A pen costs 4 times as much as the pencil. How much does the pen cost?",
            options: ["12p", "32p", "24p", "2p"],
            answer: "32p",
            explanation: "'4 times as much' means multiply: 4 × 8p = 32p.",
            difficulty: 2,
            diagnostic: true,
          },
          {
            key: "md-y3-08",
            kind: "short",
            prompt: "Find the missing number: 3 × ? = 27",
            answer: "9",
            accepted: ["nine"],
            explanation: "Use the inverse: 27 ÷ 3 = 9, so 3 × 9 = 27.",
            difficulty: 2,
          },
          {
            key: "md-y3-09",
            kind: "single",
            prompt: "Sam has 3 different T-shirts and 4 different pairs of shorts. How many different outfits can he make with one T-shirt and one pair of shorts?",
            options: ["7", "16", "24", "12"],
            answer: "12",
            explanation: "Each of the 3 T-shirts can go with each of the 4 pairs of shorts, so 3 × 4 = 12 outfits.",
            difficulty: 3,
          },
          {
            key: "md-y3-10",
            kind: "single",
            prompt: "A library shelf holds 34 books. How many books are on 6 shelves like this?",
            options: ["184", "1,824", "204", "210"],
            answer: "204",
            explanation: "30 × 6 = 180 and 4 × 6 = 24. Add the parts: 180 + 24 = 204.",
            difficulty: 3,
          },
        ],
      },
      flashcards: [
        { front: "3 × 7", back: "21" },
        { front: "4 × 9", back: "36" },
        { front: "8 × 5", back: "40" },
        { front: "8 × 8", back: "64" },
        { front: "32 ÷ 4", back: "8" },
        { front: "24 ÷ 8", back: "3" },
        { front: "How can you use the 4 times table to find the 8 times table?", back: "Double it. 8 × 9 is double 4 × 9, so 36 doubled = 72." },
        { front: "How do you multiply 32 × 4 in your head?", back: "Split it: 30 × 4 = 120, 2 × 4 = 8, then add: 128." },
        { front: "A book costs £3. A game costs 5 times as much. Cost of the game?", back: "5 × £3 = £15 ('times as much' means multiply)." },
        { front: "5 hats and 2 scarves: how many different hat-and-scarf pairs?", back: "5 × 2 = 10 (every hat goes with every scarf)." },
        { front: "How do you check 32 ÷ 8 = 4?", back: "Multiply back: 4 × 8 = 32." },
      ],
    },
    4: {
      year: 4,
      objectives: [
        "Recall multiplication and division facts for multiplication tables up to 12 × 12.",
        "Multiply two-digit and three-digit numbers by a one-digit number using formal written layout.",
        "Recognise and use factor pairs and commutativity in mental calculations.",
        "Use place value, known and derived facts to multiply and divide mentally; use the distributive law (partitioning).",
      ],
      note: {
        title: "Year 4: all tables to 12 × 12, factor pairs and formal multiplication",
        body: `## What you need to know

You should now know every fact up to **12 × 12** and the matching divisions.

- **Commutativity:** you can swap the order. 7 × 8 = 8 × 7.
- **Factor pairs:** two numbers that multiply to give a number. The factor pairs of 18 are 1 × 18, 2 × 9 and 3 × 6, so the factors of 18 are 1, 2, 3, 6, 9, 18.
- **The distributive law (partitioning):** split a number into easy parts. 6 × 13 = (6 × 10) + (6 × 3) = 60 + 18 = 78.

## Worked example 1: three-digit by one-digit (column method)

Work out 163 × 4.
- 3 × 4 = 12: write 2, carry 1 ten.
- 6 × 4 = 24, plus the carried 1 = 25: write 5, carry 2 hundreds.
- 1 × 4 = 4, plus the carried 2 = 6.
- Answer: **652**.

## Worked example 2: using factors

To find every factor of 20, test 1, 2, 3, 4... in order: 1 × 20, 2 × 10, 4 × 5. The factors are 1, 2, 4, 5, 10, 20. (3 does not go into 20.)

## Worked example 3: a tricky fact

12 × 8 is 10 × 8 + 2 × 8 = 80 + 16 = **96**.

| Trick | Example |
| --- | --- |
| × 9: do × 10 then subtract one lot | 9 × 7 = 70 − 7 = 63 |
| × 11: partition | 11 × 8 = 80 + 8 = 88 |`,
      },
      quiz: {
        title: "Multiplication & Division: Year 4 quiz",
        questions: [
          {
            key: "md-y4-01",
            kind: "single",
            prompt: "What is 9 × 12?",
            options: ["96", "99", "108", "117"],
            answer: "108",
            explanation: "9 × 12 = (9 × 10) + (9 × 2) = 90 + 18 = 108.",
            difficulty: 1,
          },
          {
            key: "md-y4-02",
            kind: "single",
            prompt: "What is 63 ÷ 9?",
            options: ["6", "8", "9", "7"],
            answer: "7",
            explanation: "Think of the 9 times table: 7 × 9 = 63, so 63 ÷ 9 = 7.",
            difficulty: 1,
          },
          {
            key: "md-y4-03",
            kind: "number",
            prompt: "Work out 12 × 12.",
            answer: 144,
            explanation: "12 × 12 = (12 × 10) + (12 × 2) = 120 + 24 = 144.",
            difficulty: 1,
          },
          {
            key: "md-y4-04",
            kind: "single",
            prompt: "Work out 245 × 3.",
            options: ["725", "815", "735", "635"],
            answer: "735",
            explanation: "Multiply each digit, carrying as you go: 5 × 3 = 15, 4 × 3 = 12 and 1 carried makes 13, 2 × 3 = 6 and 1 carried makes 7. So 735.",
            difficulty: 2,
            diagnostic: true,
          },
          {
            key: "md-y4-05",
            kind: "single",
            prompt: "Which list shows ALL the factors of 12?",
            options: ["1, 2, 4, 6, 12", "1, 2, 3, 4, 6, 12", "1, 3, 4, 12", "2, 3, 4, 6"],
            answer: "1, 2, 3, 4, 6, 12",
            explanation: "Find the factor pairs: 1 × 12, 2 × 6 and 3 × 4. Write out every number in those pairs.",
            difficulty: 2,
            diagnostic: true,
          },
          {
            key: "md-y4-06",
            kind: "single",
            prompt: "A box holds 24 crayons. How many crayons are in 6 boxes?",
            options: ["124", "1,224", "164", "144"],
            answer: "144",
            explanation: "20 × 6 = 120 and 4 × 6 = 24, then 120 + 24 = 144.",
            difficulty: 2,
          },
          {
            key: "md-y4-07",
            kind: "multi",
            prompt: "Which of these give the same answer as 6 × 9? Choose all that apply.",
            options: ["9 × 6", "6 × 10 − 6", "6 × 8 + 8", "3 × 18", "6 + 9"],
            answer: ["9 × 6", "6 × 10 − 6", "3 × 18"],
            explanation: "6 × 9 = 54. Swapping the order gives 9 × 6 = 54, 6 × 10 − 6 = 54, and 3 × 18 = 54. But 6 × 8 + 8 = 56 and 6 + 9 = 15.",
            difficulty: 2,
          },
          {
            key: "md-y4-08",
            kind: "short",
            prompt: "Write the missing number: 7 × 14 = (7 × 10) + (7 × ?)",
            answer: "4",
            accepted: ["four"],
            explanation: "Partition 14 into 10 and 4. So the missing number is 4: 70 + 28 = 98.",
            difficulty: 2,
          },
          {
            key: "md-y4-09",
            kind: "single",
            prompt: "A farmer packs 8 eggs into each tray. He fills 125 trays. How many eggs is that?",
            options: ["940", "1,040", "1,000", "1,600"],
            answer: "1,000",
            explanation: "Multiply each part of 125 by 8: 100 × 8 = 800, 20 × 8 = 160, 5 × 8 = 40. Then 800 + 160 + 40 = 1,000.",
            difficulty: 3,
          },
          {
            key: "md-y4-10",
            kind: "single",
            prompt: "A packet has 12 stickers. Mia buys 7 packets and gives away 19 stickers. How many stickers does she have left?",
            options: ["75", "65", "55", "103"],
            answer: "65",
            explanation: "First find the total: 7 × 12 = 84. Then take away the ones she gave: 84 − 19 = 65.",
            difficulty: 3,
          },
        ],
      },
      flashcards: [
        { front: "7 × 8", back: "56" },
        { front: "12 × 6", back: "72" },
        { front: "11 × 9", back: "99" },
        { front: "132 ÷ 12", back: "11" },
        { front: "What does commutative mean for multiplication?", back: "You can swap the numbers: 7 × 8 = 8 × 7." },
        { front: "What is a factor pair?", back: "Two numbers that multiply to make a number, e.g. 3 and 4 for 12." },
        { front: "All the factors of 20", back: "1, 2, 4, 5, 10, 20" },
        { front: "How do you use partitioning for 6 × 13?", back: "(6 × 10) + (6 × 3) = 60 + 18 = 78." },
        { front: "Quick method for × 9", back: "Multiply by 10, then subtract one lot: 9 × 7 = 70 − 7 = 63." },
        { front: "When you multiply digits in a column and get 15, what do you do?", back: "Write the 5 and carry the 1 (ten) to the next column." },
      ],
    },
    5: {
      year: 5,
      objectives: [
        "Identify multiples and factors, including finding all factor pairs and common factors of two numbers.",
        "Know and use the vocabulary of prime numbers, prime factors and composite numbers; know primes to 19 and establish whether a number up to 100 is prime.",
        "Multiply numbers up to 4 digits by a one- or two-digit number using a formal written method, including long multiplication for two-digit numbers.",
        "Divide numbers up to 4 digits by a one-digit number using short division, interpreting remainders appropriately.",
        "Recognise and use square numbers and cube numbers, and the notation ² and ³.",
        "Multiply and divide whole numbers and decimals by 10, 100 and 1,000.",
      ],
      note: {
        title: "Year 5: factors, primes, squares, cubes and long multiplication",
        body: `## What you need to know

- **Multiples** are in a times table (multiples of 6: 6, 12, 18...). **Factors** divide exactly into a number.
- A **common factor** of two numbers is a factor of both.
- A **prime number** has exactly two factors: 1 and itself. The primes up to 20 are 2, 3, 5, 7, 11, 13, 17, 19. **1 is not prime.**
- A **square number** is a number times itself: 6² = 36. A **cube number** is used three times: 4³ = 4 × 4 × 4 = 64.
- Multiplying by 10, 100 or 1,000 moves the digits 1, 2 or 3 places to the **left**; dividing moves them to the **right**.

## Worked example 1: is 87 prime?

Try dividing by small primes. 2? No. 3? 8 + 7 = 15, which is in the 3 times table, so yes: 87 = 3 × 29. **87 is not prime.**

## Worked example 2: long multiplication

Work out 42 × 37.
- 42 × 30 = 1,260
- 42 × 7 = 294
- Add: 1,260 + 294 = **1,554**

## Worked example 3: short division

1,548 ÷ 6: 15 ÷ 6 = 2 remainder 3, then 34 ÷ 6 = 5 remainder 4, then 48 ÷ 6 = 8. The answer is **258**.

| Square numbers | Cube numbers |
| --- | --- |
| 1, 4, 9, 16, 25, 36, 49, 64, 81, 100 | 1, 8, 27, 64, 125, 1,000 |`,
      },
      quiz: {
        title: "Multiplication & Division: Year 5 quiz",
        questions: [
          {
            key: "md-y5-01",
            kind: "single",
            prompt: "What is 4,500 ÷ 100?",
            options: ["450", "45", "4.5", "45,000"],
            answer: "45",
            explanation: "Dividing by 100 moves every digit two places to the right, so 4,500 becomes 45.",
            difficulty: 1,
          },
          {
            key: "md-y5-02",
            kind: "single",
            prompt: "Which of these is a square number?",
            options: ["12", "16", "18", "24"],
            answer: "16",
            explanation: "A square number is a number multiplied by itself: 4 × 4 = 16.",
            difficulty: 1,
          },
          {
            key: "md-y5-03",
            kind: "number",
            prompt: "Work out 0.6 × 100.",
            answer: 60,
            explanation: "Multiplying by 100 moves each digit two places to the left: 0.6 becomes 60.",
            difficulty: 1,
          },
          {
            key: "md-y5-04",
            kind: "single",
            prompt: "Which of these is a prime number?",
            options: ["51", "57", "59", "65"],
            answer: "59",
            explanation: "51 = 3 × 17, 57 = 3 × 19 and 65 = 5 × 13. Only 59 has no factors other than 1 and itself.",
            difficulty: 2,
            diagnostic: true,
          },
          {
            key: "md-y5-05",
            kind: "single",
            prompt: "Work out 34 × 26.",
            options: ["272", "864", "884", "816"],
            answer: "884",
            explanation: "34 × 20 = 680 and 34 × 6 = 204. Add them: 680 + 204 = 884.",
            difficulty: 2,
            diagnostic: true,
          },
          {
            key: "md-y5-06",
            kind: "single",
            prompt: "Work out 1,284 ÷ 6.",
            options: ["204", "224", "2,014", "214"],
            answer: "214",
            explanation: "Use short division: 12 ÷ 6 = 2, then 8 ÷ 6 = 1 remainder 2, then 24 ÷ 6 = 4. That gives 214.",
            difficulty: 2,
          },
          {
            key: "md-y5-07",
            kind: "multi",
            prompt: "Which of these numbers are common factors of 12 AND 18? Choose all that apply.",
            options: ["2", "3", "4", "6", "9"],
            answer: ["2", "3", "6"],
            explanation: "List the factors: 12 has 1, 2, 3, 4, 6, 12 and 18 has 1, 2, 3, 6, 9, 18. The ones in both lists are 2, 3 and 6.",
            difficulty: 2,
          },
          {
            key: "md-y5-08",
            kind: "short",
            prompt: "Write 5³ (5 cubed) as a single number.",
            answer: "125",
            accepted: ["125"],
            explanation: "Cubed means multiply three of the number: 5 × 5 × 5 = 25 × 5 = 125.",
            difficulty: 2,
          },
          {
            key: "md-y5-09",
            kind: "single",
            prompt: "A stadium has 45 rows with 128 seats in each row. How many seats are there altogether?",
            options: ["5,660", "5,120", "5,760", "6,760"],
            answer: "5,760",
            explanation: "Use long multiplication: 128 × 40 = 5,120 and 128 × 5 = 640. Add them: 5,120 + 640 = 5,760.",
            difficulty: 3,
          },
          {
            key: "md-y5-10",
            kind: "single",
            prompt: "196 marbles are put into bags of 8. How many full bags can be made, and how many marbles are left over?",
            options: [
              "25 full bags, none left over",
              "24 full bags, 2 left over",
              "24 full bags, 4 left over",
              "23 full bags, 12 left over",
            ],
            answer: "24 full bags, 4 left over",
            explanation: "196 ÷ 8 = 24 remainder 4, because 24 × 8 = 192 and 196 − 192 = 4. The remainder is what is left over.",
            difficulty: 3,
          },
        ],
      },
      flashcards: [
        { front: "The prime numbers up to 20", back: "2, 3, 5, 7, 11, 13, 17, 19" },
        { front: "Is 1 a prime number?", back: "No. A prime has exactly two factors; 1 has only one." },
        { front: "What is a prime number?", back: "A number with exactly two factors: 1 and itself." },
        { front: "The square numbers to 100", back: "1, 4, 9, 16, 25, 36, 49, 64, 81, 100" },
        { front: "The cube numbers up to 1,000", back: "1, 8, 27, 64, 125, 216, 343, 512, 729, 1,000" },
        { front: "What does 7² mean?", back: "7 × 7 = 49" },
        { front: "What does 4³ mean?", back: "4 × 4 × 4 = 64" },
        { front: "What is a common factor?", back: "A number that is a factor of two (or more) numbers, e.g. 5 is a common factor of 20 and 30." },
        { front: "Multiply by 1,000", back: "Move every digit 3 places left: 3.4 × 1,000 = 3,400." },
        { front: "First step in long multiplication of 42 × 37?", back: "Multiply by the tens (42 × 30 = 1,260), then the units (42 × 7 = 294), then add." },
        { front: "Quick test for 3", back: "If the digits add up to a multiple of 3, the number divides by 3." },
      ],
    },
    6: {
      year: 6,
      objectives: [
        "Multiply multi-digit numbers up to 4 digits by a two-digit whole number using the formal written method of long multiplication.",
        "Divide numbers up to 4 digits by a two-digit number using the formal written methods of short and long division, and interpret remainders as whole numbers, fractions or by rounding, as appropriate for the context.",
        "Identify common factors, common multiples and prime numbers.",
        "Use their knowledge of the order of operations (BIDMAS) to carry out calculations involving the four operations.",
      ],
      note: {
        title: "Year 6: long multiplication, long division, remainders and BIDMAS",
        body: `## What you need to know

**Order of operations (BIDMAS):** do Brackets first, then Indices (powers like ²), then Division and Multiplication (left to right), then Addition and Subtraction (left to right).

**Remainders** depend on the question:
- Sharing 10 cakes among 4 people: 2 r 2 can become **2½** each.
- Fitting 130 children into 12-seat minibuses: 10 r 10 means **11** minibuses (round up, or 10 children would be left behind).
- Making bags of 6 marbles from 100: 16 r 4 means **16** full bags (round down).

## Worked example 1: BIDMAS

Work out 30 − (4 + 2) × 3.
- Brackets: 4 + 2 = 6, so 30 − 6 × 3.
- Multiply before subtracting: 6 × 3 = 18.
- Subtract: 30 − 18 = **12**.

## Worked example 2: long multiplication

418 × 27: 418 × 20 = 8,360 and 418 × 7 = 2,926. Add: 8,360 + 2,926 = **11,286**.

## Worked example 3: long division

1,296 ÷ 12: 12 goes into 12 once; the next digit 9 is too small, so write 0 and make 96; 12 goes into 96 eight times. The answer is **108**.

| Idea | Example |
| --- | --- |
| Highest common factor of 18 and 30 | Factors in both lists: 1, 2, 3, 6, so HCF = 6 |
| Common multiples of 3 and 5 | 15, 30, 45... |`,
      },
      quiz: {
        title: "Multiplication & Division: Year 6 quiz",
        questions: [
          {
            key: "md-y6-01",
            kind: "single",
            prompt: "What is 3 + 4 × 2?",
            options: ["14", "11", "24", "10"],
            answer: "11",
            explanation: "Multiplication comes before addition (BIDMAS): 4 × 2 = 8, then 3 + 8 = 11.",
            difficulty: 1,
          },
          {
            key: "md-y6-02",
            kind: "single",
            prompt: "Which of these is NOT a prime number?",
            options: ["2", "11", "27", "31"],
            answer: "27",
            explanation: "27 = 3 × 9, so it has more than two factors. 2, 11 and 31 each have only 1 and themselves.",
            difficulty: 1,
          },
          {
            key: "md-y6-03",
            kind: "number",
            prompt: "Work out 12 × 15.",
            answer: 180,
            explanation: "12 × 15 = (10 × 15) + (2 × 15) = 150 + 30 = 180.",
            difficulty: 1,
          },
          {
            key: "md-y6-04",
            kind: "single",
            prompt: "Work out 20 − (3 + 2) × 3.",
            options: ["45", "5", "15", "30"],
            answer: "5",
            explanation: "Brackets first: 3 + 2 = 5. Then multiply: 5 × 3 = 15. Last, 20 − 15 = 5.",
            difficulty: 2,
            diagnostic: true,
          },
          {
            key: "md-y6-05",
            kind: "single",
            prompt: "Work out 236 × 34.",
            options: ["7,080", "7,924", "8,024", "8,124"],
            answer: "8,024",
            explanation: "Long multiplication: 236 × 30 = 7,080 and 236 × 4 = 944. Then 7,080 + 944 = 8,024.",
            difficulty: 2,
            diagnostic: true,
          },
          {
            key: "md-y6-06",
            kind: "single",
            prompt: "Work out 972 ÷ 12.",
            options: ["72", "86", "91", "81"],
            answer: "81",
            explanation: "Long division: 12 goes into 97 eight times (96), leaving 1. Bring down the 2 to make 12, and 12 goes into 12 once. So 81.",
            difficulty: 2,
          },
          {
            key: "md-y6-07",
            kind: "multi",
            prompt: "Which of these numbers are common multiples of 4 AND 6? Choose all that apply.",
            options: ["12", "18", "24", "30", "36"],
            answer: ["12", "24", "36"],
            explanation: "A common multiple is in both times tables. 12, 24 and 36 are multiples of 4 and of 6, but 18 and 30 are not multiples of 4.",
            difficulty: 2,
          },
          {
            key: "md-y6-08",
            kind: "short",
            prompt: "What is the highest common factor of 24 and 36?",
            answer: "12",
            accepted: ["twelve"],
            explanation: "The factors of 24 are 1, 2, 3, 4, 6, 8, 12, 24 and of 36 are 1, 2, 3, 4, 6, 9, 12, 18, 36. The biggest one in both lists is 12.",
            difficulty: 2,
          },
          {
            key: "md-y6-09",
            kind: "single",
            prompt: "Each minibus seats 15 children. 200 children are going on a trip. How many minibuses are needed?",
            options: ["13", "13 remainder 5", "14", "15"],
            answer: "14",
            explanation: "200 ÷ 15 = 13 remainder 5. The 5 children left still need a seat, so we round up to 14 minibuses.",
            difficulty: 3,
          },
          {
            key: "md-y6-10",
            kind: "single",
            prompt: "Work out 4² + (18 ÷ 3) × 2 − 5.",
            options: ["15", "23", "39", "33"],
            answer: "23",
            explanation: "Brackets: 18 ÷ 3 = 6. Indices: 4² = 16. Multiply: 6 × 2 = 12. Then 16 + 12 − 5 = 23.",
            difficulty: 3,
          },
        ],
      },
      flashcards: [
        { front: "What does BIDMAS stand for?", back: "Brackets, Indices, Division and Multiplication, Addition and Subtraction." },
        { front: "5 + 3 × 4 = ?", back: "17 (multiply first: 3 × 4 = 12, then add 5)." },
        { front: "What is the highest common factor (HCF)?", back: "The biggest number that is a factor of both numbers." },
        { front: "What is a common multiple?", back: "A number that is in the times tables of both numbers, e.g. 15 for 3 and 5." },
        { front: "Is 1 a prime number? Is 2?", back: "1 is not prime. 2 is prime (the only even prime)." },
        { front: "Primes between 20 and 50", back: "23, 29, 31, 37, 41, 43, 47" },
        { front: "How do you check a division answer?", back: "Multiply back: answer × divisor (+ remainder) = the starting number." },
        { front: "130 children, minibuses seat 12. Why is the answer 11 not 10?", back: "10 r 10: 10 children are left over and still need a seat, so round UP." },
        { front: "What does a remainder mean when making full bags?", back: "It is the number left over, so round DOWN for the number of full bags." },
        { front: "First step of long multiplication for 418 × 27", back: "Multiply by 20 (8,360), then by 7 (2,926), then add the two answers." },
        { front: "Multiply by 10, 100, 1,000", back: "Move the digits 1, 2, 3 places left (divide: move right)." },
      ],
    },
  },
};

export default TOPIC;
