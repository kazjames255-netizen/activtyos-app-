// KS2 Maths — Addition & Subtraction (Years 3–6). Original content aligned to the DfE programme of study
// (Open Government Licence v3.0). Every computed answer here is re-derived independently by
// server/src/curriculum/verifyNpvAs.ts — run it after ANY edit.
import type { CTopic } from "../types";

export const TOPIC: CTopic = {
  key: "as",
  topic: "Addition & Subtraction",
  subject: "Maths",
  years: {
    3: {
      year: 3,
      objectives: [
        "Add and subtract numbers mentally, including a three-digit number and ones, tens or hundreds",
        "Add and subtract numbers with up to three digits using formal written methods of columnar addition and subtraction",
        "Estimate the answer to a calculation and use inverse operations to check answers",
      ],
      note: {
        title: "Adding and subtracting to 1,000",
        body: `## Mental methods

Add or subtract ones, tens or hundreds by changing **only that column**.

- 428 + 5 = 433 (add the ones)
- 684 − 40 = 644 (take away 4 tens)
- 472 + 300 = 772 (add 3 hundreds)

## Column addition and subtraction

Write the numbers under each other with the columns lined up. Start with the **ones**.

**Worked example 1: adding with carrying.** 358 + 165

|   | H | T | O |
| --- | --- | --- | --- |
|   | 3 | 5 | 8 |
| + | 1 | 6 | 5 |
| = | 5 | 2 | 3 |

8 + 5 = 13: write 3, carry 1 ten. Tens: 5 + 6 + 1 = 12: write 2, carry 1 hundred. Hundreds: 3 + 1 + 1 = 5. The answer is **523**.

**Worked example 2: subtracting with exchange.** 602 − 384

1. Ones: 2 is smaller than 4. There are no tens to swap, so exchange 1 hundred for 10 tens, then 1 ten for 10 ones. Now ones: 12 − 4 = 8.
2. Tens: 9 − 8 = 1.
3. Hundreds: 5 − 3 = 2.

The answer is **218**.

## Estimate and check

**Estimate** first by rounding: 297 + 402 is about 300 + 400 = 700. After you calculate, use the **inverse**: if 236 + 149 = 385, then 385 − 149 should give 236.`,
      },
      quiz: {
        title: "Addition & Subtraction Year 3: mental and column methods to 1,000",
        questions: [
          { key: "as-y3-01", kind: "number", prompt: "Work out 347 + 6 in your head.", answer: 353, explanation: "Add the 6 to the ones: 7 + 6 = 13, so 347 + 6 = 353.", difficulty: 1 },
          { key: "as-y3-02", kind: "number", prompt: "Work out 512 − 30 in your head.", answer: 482, explanation: "Count back 3 tens from 512: 502, 492, 482. The ones digit stays 2.", difficulty: 1 },
          { key: "as-y3-03", kind: "single", prompt: "Use column addition to work out 456 + 237.", options: ["683", "593", "693", "783"], answer: "693", explanation: "Ones: 6 + 7 = 13, write 3 and carry 1 ten. Tens: 5 + 3 + 1 = 9. Hundreds: 4 + 2 = 6. So the answer is 693.", difficulty: 2, diagnostic: true },
          { key: "as-y3-04", kind: "number", prompt: "Use column subtraction to work out 703 − 458.", answer: 245, explanation: "Exchange from the hundreds and tens so the ones become 13: 13 − 8 = 5, then 9 − 5 = 4, then 6 − 4 = 2. The answer is 245.", difficulty: 2, diagnostic: true },
          { key: "as-y3-05", kind: "single", prompt: "Which is the best estimate for 398 + 205?", options: ["700", "500", "800", "600"], answer: "600", explanation: "Round each number to the nearest hundred: 398 is about 400 and 205 is about 200, so 400 + 200 = 600.", difficulty: 1 },
          { key: "as-y3-06", kind: "single", prompt: "Sara works out 258 + 167 = 425. Which calculation can she use to check her answer?", options: ["425 − 167", "425 + 258", "258 − 167", "167 + 425"], answer: "425 − 167", explanation: "Subtraction is the inverse of addition. Taking one part away from the total (425 − 167) should give the other part, 258.", difficulty: 2 },
          { key: "as-y3-07", kind: "single", prompt: "A school has 245 girls and 268 boys. How many children are there altogether?", options: ["423", "513", "503", "613"], answer: "513", explanation: "Add the two groups: 245 + 268. Ones: 5 + 8 = 13, carry 1. Tens: 4 + 6 + 1 = 11, carry 1. Hundreds: 2 + 2 + 1 = 5. So 513.", difficulty: 2 },
          { key: "as-y3-08", kind: "single", prompt: "A book has 320 pages. Mia has read 175 pages. How many pages does she have left to read?", options: ["155", "245", "145", "135"], answer: "145", explanation: "Take the pages read from the total: 320 − 175 = 145. Check by adding: 175 + 145 = 320.", difficulty: 2 },
          { key: "as-y3-09", kind: "multi", prompt: "Select ALL the calculations that equal 500.", options: ["250 + 250", "700 − 300", "450 + 50", "1,000 − 500", "320 + 190"], answer: ["250 + 250", "450 + 50", "1,000 − 500"], explanation: "250 + 250 = 500, 450 + 50 = 500 and 1,000 − 500 = 500. But 700 − 300 = 400 and 320 + 190 = 510.", difficulty: 3 },
          { key: "as-y3-10", kind: "number", prompt: "Find the missing number: 634 − ___ = 289", answer: 345, explanation: "Use the inverse: the missing number is 634 − 289 = 345. Check: 289 + 345 = 634.", difficulty: 3 },
        ],
      },
      flashcards: [
        { front: "Which column do you start with in column addition?", back: "The ones (right-hand) column, then move left." },
        { front: "What do you do when a column adds to 10 or more?", back: "Write the ones digit and carry the tens digit to the next column." },
        { front: "When do you exchange in column subtraction?", back: "When the top digit is smaller than the digit below: swap 1 from the next column left for 10 here." },
        { front: "428 + 5 = ?", back: "433 (only the ones change)" },
        { front: "684 − 40 = ?", back: "644 (take away 4 tens)" },
        { front: "What is the inverse of addition?", back: "Subtraction. It undoes the addition and is used to check answers." },
        { front: "What is the inverse of subtraction?", back: "Addition. Add the answer to the number you took away to get back to the start." },
        { front: "How do you estimate 297 + 402?", back: "Round each number: 300 + 400 = 700." },
        { front: "Check 236 + 149 = 385 using the inverse", back: "385 − 149 = 236, so it is correct." },
        { front: "Why estimate before you calculate?", back: "It tells you roughly what the answer should be, so you can spot a mistake." },
      ],
    },
    4: {
      year: 4,
      objectives: [
        "Add and subtract numbers with up to 4 digits using the formal written methods of columnar addition and subtraction",
        "Estimate and use inverse operations to check answers to a calculation",
        "Solve addition and subtraction two-step problems in contexts, deciding which operations and methods to use and why",
      ],
      note: {
        title: "Adding and subtracting four-digit numbers",
        body: `## Column methods with thousands

Line up **thousands, hundreds, tens and ones**. Start at the ones and work left. Carry when a column makes 10 or more; exchange when the top digit is too small.

**Worked example 1.** 3,486 + 2,547

| Th | H | T | O |
| --- | --- | --- | --- |
| 3 | 4 | 8 | 6 |
| 2 | 5 | 4 | 7 |
| 6 | 0 | 3 | 3 |

Ones: 6 + 7 = 13, write 3 and carry 1. Tens: 8 + 4 + 1 = 13, write 3 and carry 1. Hundreds: 4 + 5 + 1 = 10, write 0 and carry 1. Thousands: 3 + 2 + 1 = 6. The answer is **6,033**.

**Worked example 2.** 6,032 − 2,457. Exchange across the columns to give 3,575. Check by adding: 3,575 + 2,457 = 6,032.

## Two-step problems

Read the problem twice. Decide which operation each step needs.

**Worked example 3.** A club has 3,200 tickets. It sells 1,150 on Friday and 780 on Saturday. How many are left?

1. Step 1: how many sold? 1,150 + 780 = 1,930.
2. Step 2: how many left? 3,200 − 1,930 = **1,270**.

## Estimating and checking

Round to the nearest 1,000 to estimate: 5,087 + 2,904 is about 5,000 + 3,000 = 8,000. Then check with the **inverse**: if 8,105 − 4,278 = 3,827, then 3,827 + 4,278 should equal 8,105.`,
      },
      quiz: {
        title: "Addition & Subtraction Year 4: four-digit numbers and two-step problems",
        questions: [
          { key: "as-y4-01", kind: "number", prompt: "Work out 4,285 + 1,367. Type your answer as digits with no comma.", answer: 5652, explanation: "Column addition: ones 5 + 7 = 12 (carry 1), tens 8 + 6 + 1 = 15 (carry 1), hundreds 2 + 3 + 1 = 6, thousands 4 + 1 = 5. The answer is 5,652.", difficulty: 2 },
          { key: "as-y4-02", kind: "number", prompt: "Work out 5,000 − 1,200. Type your answer as digits with no comma.", answer: 3800, explanation: "5,000 − 1,000 = 4,000, then 4,000 − 200 = 3,800.", difficulty: 1 },
          { key: "as-y4-03", kind: "single", prompt: "Work out 5,046 − 2,378.", options: ["3,332", "2,778", "2,668", "2,768"], answer: "2,668", explanation: "Use column subtraction and exchange from the next column each time the top digit is too small. The answer is 2,668, and 2,668 + 2,378 = 5,046 checks it.", difficulty: 2, diagnostic: true },
          { key: "as-y4-04", kind: "single", prompt: "A shop has 2,450 stickers. It sells 875 on Monday and 640 on Tuesday. How many stickers are left?", options: ["1,575", "935", "1,810", "3,965"], answer: "935", explanation: "Step 1: stickers sold = 875 + 640 = 1,515. Step 2: stickers left = 2,450 − 1,515 = 935.", difficulty: 2, diagnostic: true },
          { key: "as-y4-05", kind: "single", prompt: "Estimate 4,912 + 3,098 by rounding each number to the nearest 1,000.", options: ["7,000", "9,000", "8,500", "8,000"], answer: "8,000", explanation: "4,912 rounds to 5,000 and 3,098 rounds to 3,000. Then 5,000 + 3,000 = 8,000.", difficulty: 1 },
          { key: "as-y4-06", kind: "single", prompt: "Anya works out 7,204 − 3,586 = 3,618. Which addition can she use to check her answer?", options: ["3,618 + 3,586", "7,204 + 3,586", "3,618 − 3,586", "7,204 + 3,618"], answer: "3,618 + 3,586", explanation: "Add the answer to the number you subtracted. If 3,618 + 3,586 makes the starting number, 7,204, the answer is right.", difficulty: 2 },
          { key: "as-y4-07", kind: "number", prompt: "What is the missing number? 3,275 + ___ = 5,000. Type your answer as digits with no comma.", answer: 1725, explanation: "Find the difference: 5,000 − 3,275 = 1,725. Check: 3,275 + 1,725 = 5,000.", difficulty: 2 },
          { key: "as-y4-08", kind: "short", prompt: "Work out 4,500 + 3,700. Write your answer in digits.", answer: "8200", accepted: ["8,200"], explanation: "45 hundreds + 37 hundreds = 82 hundreds, which is 8,200.", difficulty: 1 },
          { key: "as-y4-09", kind: "multi", prompt: "Select ALL the calculations that equal 2,500.", options: ["1,250 + 1,250", "3,000 − 500", "4,000 − 2,000", "1,800 + 800", "5,000 − 2,500"], answer: ["1,250 + 1,250", "3,000 − 500", "5,000 − 2,500"], explanation: "1,250 + 1,250 = 2,500, 3,000 − 500 = 2,500 and 5,000 − 2,500 = 2,500. But 4,000 − 2,000 = 2,000 and 1,800 + 800 = 2,600.", difficulty: 3 },
          { key: "as-y4-10", kind: "number", prompt: "A school raised £3,485 in the autumn and £2,760 in the spring. It then spent £4,900 on new books. How much money does it have left, in pounds? Type your answer as digits with no comma.", answer: 1345, explanation: "Step 1: money raised = 3,485 + 2,760 = 6,245. Step 2: money left = 6,245 − 4,900 = 1,345.", difficulty: 3 },
        ],
      },
      flashcards: [
        { front: "Name the columns of a 4-digit number", back: "Thousands, hundreds, tens, ones." },
        { front: "Column addition: what do you do with 12 in the ones column?", back: "Write 2 in the ones and carry 1 into the tens." },
        { front: "Column subtraction: the top digit is too small. What now?", back: "Exchange: take 1 from the next column left and add 10 to this column." },
        { front: "3,486 + 2,547 = ?", back: "6,033" },
        { front: "Estimate 5,087 + 2,904", back: "Round to the nearest 1,000: 5,000 + 3,000 = 8,000." },
        { front: "How do you check a subtraction using the inverse?", back: "Add the answer to the number you took away. You should get the starting number." },
        { front: "What is a two-step problem?", back: "A problem where you need two calculations, one after the other, to reach the answer." },
        { front: "What should you do first with a word problem?", back: "Read it twice and decide what each step is asking (add or subtract)." },
        { front: "Find the missing number: 2,640 + ? = 5,000", back: "2,360 (5,000 − 2,640)" },
        { front: "5,000 − 1,700 = ?", back: "3,300" },
      ],
    },
    5: {
      year: 5,
      objectives: [
        "Add and subtract whole numbers with more than 4 digits, including using formal written methods",
        "Add and subtract numbers mentally with increasingly large numbers",
        "Use rounding to check answers to calculations and determine, in the context of a problem, levels of accuracy",
        "Solve addition and subtraction multi-step problems in contexts, deciding which operations and methods to use and why",
      ],
      note: {
        title: "Adding and subtracting large numbers",
        body: `## Formal methods for 5- and 6-digit numbers

The columns are just longer: **ones, tens, hundreds, thousands, ten thousands, hundred thousands**. Line them up carefully, start on the right, carry and exchange as before.

**Worked example 1.** 47,358 + 26,475

1. Ones: 8 + 5 = 13, write 3, carry 1.
2. Tens: 5 + 7 + 1 = 13, write 3, carry 1.
3. Hundreds: 3 + 4 + 1 = 8, write 8.
4. Thousands: 7 + 6 = 13, write 3, carry 1.
5. Ten thousands: 4 + 2 + 1 = 7.

The answer is **73,833**.

## Mental methods with big numbers

Use what you know about place value: 380,000 + 250,000 is 38 ten-thousands + 25 ten-thousands = 63 ten-thousands = 630,000. To take 4,950 away, take 5,000 and give 50 back: 8,200 − 5,000 + 50 = 3,250.

## Checking with rounding

**Worked example 2.** Kofi says 36,482 + 41,518 = 87,000. Round: 36,000 + 42,000 = 78,000. His answer is about 9,000 too big, so he has made a mistake. The correct answer is 78,000.

## Multi-step problems

**Worked example 3.** A concert hall holds 80,000 people. 46,320 seats are taken by adults and 21,585 by children. How many seats are empty?

1. People in: 46,320 + 21,585 = 67,905.
2. Empty: 80,000 − 67,905 = **12,095**.

| Tip | Why |
| --- | --- |
| Estimate first | Spots big mistakes |
| Check with the inverse | Proves the answer |`,
      },
      quiz: {
        title: "Addition & Subtraction Year 5: large numbers and multi-step problems",
        questions: [
          { key: "as-y5-01", kind: "number", prompt: "Work out 34,672 + 25,849. Type your answer as digits with no comma.", answer: 60521, explanation: "Column addition with carrying: 2 + 9 = 11, 7 + 4 + 1 = 12, 6 + 8 + 1 = 15, 4 + 5 + 1 = 10, 3 + 2 + 1 = 6. The answer is 60,521.", difficulty: 2 },
          { key: "as-y5-02", kind: "single", prompt: "Work out 82,405 − 37,968.", options: ["45,563", "54,437", "44,437", "44,547"], answer: "44,437", explanation: "Column subtraction with exchanges from the tens, hundreds and thousands gives 44,437. Check: 44,437 + 37,968 = 82,405.", difficulty: 2, diagnostic: true },
          { key: "as-y5-03", kind: "single", prompt: "Round each number to the nearest 10,000 to estimate 48,912 − 19,876.", options: ["30,000", "20,000", "40,000", "70,000"], answer: "30,000", explanation: "48,912 rounds to 50,000 and 19,876 rounds to 20,000. Then 50,000 − 20,000 = 30,000.", difficulty: 1 },
          { key: "as-y5-04", kind: "number", prompt: "Work out 450,000 + 270,000 in your head. Type your answer as digits with no comma.", answer: 720000, explanation: "45 ten-thousands + 27 ten-thousands = 72 ten-thousands, which is 720,000.", difficulty: 1 },
          { key: "as-y5-05", kind: "number", prompt: "Work out 6,300 − 2,950 in your head. Type your answer as digits with no comma.", answer: 3350, explanation: "Take away 3,000 to get 3,300, then add back the extra 50 you took: 3,350.", difficulty: 1 },
          { key: "as-y5-06", kind: "single", prompt: "A stadium holds 65,000 fans. Home fans fill 38,450 seats and away fans fill 14,275 seats. How many seats are empty?", options: ["26,550", "12,275", "50,725", "52,725"], answer: "12,275", explanation: "Step 1: fans in the stadium = 38,450 + 14,275 = 52,725. Step 2: empty seats = 65,000 − 52,725 = 12,275.", difficulty: 2, diagnostic: true },
          { key: "as-y5-07", kind: "single", prompt: "Zara says 48,213 + 31,987 = 90,200. Which statement is correct?", options: ["She is right, because 48,000 + 32,000 = 90,000, which is close to 90,200.", "She is wrong, because the answer should be more than 100,000.", "She is wrong, because 48,000 + 32,000 = 80,000, so the answer should be close to 80,000."], answer: "She is wrong, because 48,000 + 32,000 = 80,000, so the answer should be close to 80,000.", explanation: "Rounding gives an estimate of 48,000 + 32,000 = 80,000. Zara's 90,200 is about 10,000 too big, so she has made an error (the true answer is 80,200).", difficulty: 2 },
          { key: "as-y5-08", kind: "number", prompt: "Find the missing number: ___ − 18,264 = 47,395. Type your answer as digits with no comma.", answer: 65659, explanation: "Use the inverse: add the two numbers you know. 47,395 + 18,264 = 65,659.", difficulty: 3 },
          { key: "as-y5-09", kind: "multi", prompt: "Select ALL the calculations that equal 100,000.", options: ["60,000 + 40,000", "250,000 − 150,000", "99,999 + 1", "1,000,000 − 90,000", "45,000 + 65,000"], answer: ["60,000 + 40,000", "250,000 − 150,000", "99,999 + 1"], explanation: "60,000 + 40,000, 250,000 − 150,000 and 99,999 + 1 all make 100,000. But 1,000,000 − 90,000 = 910,000 and 45,000 + 65,000 = 110,000.", difficulty: 3 },
          { key: "as-y5-10", kind: "number", prompt: "A town had 48,650 people at the start of 2016. During 2016 the population grew by 5,875. During 2017 it fell by 2,340. How many people lived in the town at the end of 2017? Type your answer as digits with no comma.", answer: 52185, explanation: "Step 1: 48,650 + 5,875 = 54,525. Step 2: 54,525 − 2,340 = 52,185.", difficulty: 2 },
        ],
      },
      flashcards: [
        { front: "Name the columns of a 6-digit number from the right", back: "Ones, tens, hundreds, thousands, ten thousands, hundred thousands." },
        { front: "47,358 + 26,475 = ?", back: "73,833" },
        { front: "How do you estimate 58,204 − 29,731?", back: "Round to the nearest 10,000: 60,000 − 30,000 = 30,000." },
        { front: "380,000 + 250,000 = ?", back: "630,000 (38 + 25 = 63 ten-thousands)." },
        { front: "Mental trick for 8,200 − 4,950", back: "Take away 5,000 (3,200) and add back 50: 3,250." },
        { front: "Why round to check an answer?", back: "The estimate shows roughly what the answer should be, so a big mistake stands out." },
        { front: "How do you find a missing number in ? − 18,264 = 47,395?", back: "Use the inverse: 47,395 + 18,264 = 65,659." },
        { front: "What should you do first in a multi-step problem?", back: "Work out what each step asks, and in what order, before calculating." },
        { front: "99,999 + 1 = ?", back: "100,000 (every 9 carries)." },
        { front: "How do you check an addition?", back: "Subtract one of the numbers from your answer. You should get the other number." },
      ],
    },
    6: {
      year: 6,
      objectives: [
        "Perform mental calculations, including with mixed operations and large numbers",
        "Solve addition and subtraction multi-step problems in contexts, deciding which operations and methods to use and why",
        "Use estimation to check answers to calculations and determine, in the context of a problem, an appropriate degree of accuracy",
      ],
      note: {
        title: "Mental calculation and multi-step problems with large numbers",
        body: `## Smart mental strategies

Choose the method that makes the sum easy.

- **Adjust:** 8,000 − 3,998 = 8,000 − 4,000 + 2 = **4,002**.
- **Partition:** 420,000 + 135,000 = 555,000 (420 thousand + 135 thousand = 555 thousand).
- **Reorder:** 14,800 + 5,600 − 4,300 = 14,800 − 4,300 + 5,600 = 10,500 + 5,600 = **16,100**.

## Deciding which operation to use

| Wording | Usually means |
| --- | --- |
| altogether, total, in all | add |
| how much more, difference, how many left | subtract |

**Worked example 1.** A ferry sailed 38,600 km in a year and a lorry travelled 15,750 km. How much further did the ferry sail? This is a **difference**, so subtract: 38,600 − 15,750 = 22,850.

## Multi-step problems

**Worked example 2.** A school raised £94,300 in spring and £57,850 in summer. It spent £60,000 on a hall and £32,400 on equipment. How much is left?

1. Raised: 94,300 + 57,850 = 152,150.
2. After the hall: 152,150 − 60,000 = 92,150.
3. After the equipment: 92,150 − 32,400 = **59,750**.

## Check it, then trust it

**Worked example 3.** Bea says 9,000 − 3,586 = 6,414. Check with the inverse: 3,586 + 6,414 = 10,000, not 9,000. So Bea is wrong. The right answer is 5,414, because 3,586 + 5,414 = 9,000.`,
      },
      quiz: {
        title: "Addition & Subtraction Year 6: mental methods and multi-step problems",
        questions: [
          { key: "as-y6-01", kind: "number", prompt: "Work out 250,000 + 375,000 in your head. Type your answer as digits with no comma.", answer: 625000, explanation: "250 thousand + 375 thousand = 625 thousand, which is 625,000.", difficulty: 1 },
          { key: "as-y6-02", kind: "number", prompt: "Work out 7,000 − 2,999 in your head. Type your answer as digits with no comma.", answer: 4001, explanation: "Take away 3,000 instead (7,000 − 3,000 = 4,000), then add back the 1 you took too much: 4,001.", difficulty: 2 },
          { key: "as-y6-03", kind: "single", prompt: "Work out 5,300,000 − 2,450,000.", options: ["3,850,000", "2,850,000", "2,950,000", "3,150,000"], answer: "2,850,000", explanation: "Take away 2,000,000 to get 3,300,000, then take away 450,000 more: 3,300,000 − 450,000 = 2,850,000.", difficulty: 2, diagnostic: true },
          { key: "as-y6-04", kind: "single", prompt: "A charity raised £126,400 in January and £89,750 in February. It gave £75,000 to a hospital and £48,600 to a school. How much money does it have left?", options: ["£141,150", "£216,150", "£167,550", "£92,550"], answer: "£92,550", explanation: "Raised: 126,400 + 89,750 = 216,150. Given away: 75,000 + 48,600 = 123,600. Left: 216,150 − 123,600 = 92,550.", difficulty: 2, diagnostic: true },
          { key: "as-y6-05", kind: "single", prompt: "A plane flew 45,200 km in a year. A train travelled 12,450 km. Which calculation finds how much further the plane travelled?", options: ["45,200 + 12,450", "45,200 − 12,450", "45,200 × 12,450", "45,200 ÷ 12,450"], answer: "45,200 − 12,450", explanation: "'How much further' asks for the difference between two amounts, so subtract the smaller from the larger.", difficulty: 1 },
          { key: "as-y6-06", kind: "number", prompt: "Work out 12,500 + 8,700 − 6,200. Type your answer as digits with no comma.", answer: 15000, explanation: "Work left to right: 12,500 + 8,700 = 21,200, then 21,200 − 6,200 = 15,000.", difficulty: 2 },
          { key: "as-y6-07", kind: "short", prompt: "What is 1,000,000 − 250,000? Write your answer in digits.", answer: "750000", accepted: ["750,000"], explanation: "1,000,000 is 1,000 thousands. Take away 250 thousands to leave 750 thousands, which is 750,000.", difficulty: 1 },
          { key: "as-y6-08", kind: "single", prompt: "Ali says 6,000 − 2,847 = 4,153. Use the inverse to check. Which statement is correct?", options: ["Wrong. 2,847 + 4,153 = 7,000, not 6,000, so the answer should be 3,153.", "Right. 2,847 + 4,153 = 6,000.", "Wrong. The answer should be 4,253.", "Right. 6,000 − 2,847 = 4,153 is easy to check."], answer: "Wrong. 2,847 + 4,153 = 7,000, not 6,000, so the answer should be 3,153.", explanation: "Adding the answer back to 2,847 should give 6,000, but 2,847 + 4,153 = 7,000. So Ali is wrong. The right answer is 6,000 − 2,847 = 3,153.", difficulty: 3 },
          { key: "as-y6-09", kind: "multi", prompt: "Select ALL the calculations that equal 4,000,000.", options: ["2,500,000 + 1,500,000", "5,000,000 − 1,200,000", "9,000,000 − 5,000,000", "3,999,999 + 1", "3,400,000 + 700,000"], answer: ["2,500,000 + 1,500,000", "9,000,000 − 5,000,000", "3,999,999 + 1"], explanation: "2,500,000 + 1,500,000, 9,000,000 − 5,000,000 and 3,999,999 + 1 all make 4,000,000. But 5,000,000 − 1,200,000 = 3,800,000 and 3,400,000 + 700,000 = 4,100,000.", difficulty: 2 },
          { key: "as-y6-10", kind: "number", prompt: "A shop had £48,500 in the bank. On Monday it paid £12,750 in wages and received £9,300 from sales. On Tuesday it paid £21,480 for stock. How much was in the bank at the end of Tuesday, in pounds? Type your answer as digits with no comma.", answer: 23570, explanation: "48,500 − 12,750 = 35,750. Then 35,750 + 9,300 = 45,050. Then 45,050 − 21,480 = 23,570.", difficulty: 3 },
        ],
      },
      flashcards: [
        { front: "Mental trick to subtract 2,999", back: "Subtract 3,000 then add 1 back." },
        { front: "420,000 + 135,000 = ?", back: "555,000" },
        { front: "1,000,000 − 350,000 = ?", back: "650,000" },
        { front: "Which words tell you to subtract?", back: "How many left, how much more, difference, fewer, take away." },
        { front: "Which words tell you to add?", back: "Altogether, total, in all, sum, plus, increase by." },
        { front: "How do you check 9,000 − 3,586 = 5,414?", back: "Add back: 3,586 + 5,414 = 9,000, so it is correct." },
        { front: "Step 1 for any multi-step problem", back: "Read it, then write the calculations you need in order." },
        { front: "How can you reorder 14,800 + 5,600 − 4,300?", back: "Do 14,800 − 4,300 first (10,500), then add 5,600 to make 16,100." },
        { front: "Why estimate before working out a large sum?", back: "It shows if your answer is about the right size before you trust it." },
        { front: "3,999,999 + 1 = ?", back: "4,000,000" },
      ],
    },
  },
};
