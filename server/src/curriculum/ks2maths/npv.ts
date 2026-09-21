// KS2 Maths — Number & Place Value (Years 3–6). Original content aligned to the DfE programme of study
// (Open Government Licence v3.0). Every computed answer here is re-derived independently by
// server/src/curriculum/verifyNpvAs.ts — run it after ANY edit.
import type { CTopic } from "../types";

export const TOPIC: CTopic = {
  key: "npv",
  topic: "Number & Place Value",
  subject: "Maths",
  years: {
    3: {
      year: 3,
      objectives: [
        "Count in multiples of 4, 8, 50 and 100",
        "Recognise the place value of each digit in a three-digit number (hundreds, tens, ones)",
        "Compare and order numbers up to 1,000",
        "Read and write numbers up to 1,000 in numerals and in words",
      ],
      note: {
        title: "Numbers to 1,000: place value, counting and comparing",
        body: `## Big idea

Every digit in a number has a **value** that depends on where it sits. In a three-digit number the columns are **hundreds**, **tens** and **ones**.

| Number | Hundreds | Tens | Ones | Made from |
| --- | --- | --- | --- | --- |
| 362 | 3 | 6 | 2 | 300 + 60 + 2 |
| 407 | 4 | 0 | 7 | 400 + 0 + 7 |

The digit **0** is a placeholder. It holds a column open so that 407 is not mistaken for 47.

## Worked example 1: the value of a digit

What is the value of the 6 in 362?

1. The 6 is in the **tens** column.
2. 6 tens = 60.

So the 6 is worth **60**, not 6.

## Worked example 2: comparing and ordering

Put 507, 75, 570 and 705 in order, smallest first.

1. 75 has only two digits, so it is the smallest.
2. The others all have 3 digits. Compare the **hundreds** first: 5, 5 and 7. So 705 is the largest.
3. 507 and 570 have the same hundreds, so look at the **tens**: 0 is less than 7.

Order: **75, 507, 570, 705**.

## Worked example 3: counting in steps

- Count in 4s: 4, 8, 12, 16, 20, 24, ...
- Count in 8s: 8, 16, 24, 32, 40, 48, ... (each step is double a step of 4)
- Count in 50s: 350, 400, 450, 500, ...
- Count in 100s: 168, 268, 368, 468, ... only the **hundreds** digit changes.

## Numbers in words

Write 764 as **seven hundred and sixty-four**. Use a hyphen for 21 to 99 (sixty-four).`,
      },
      quiz: {
        title: "Number & Place Value Year 3: numbers to 1,000",
        questions: [
          { key: "npv-y3-01", kind: "number", prompt: "Count in 50s: 50, 100, 150, 200, ... What number comes next?", answer: 250, explanation: "Each number is 50 more than the one before, so 200 + 50 = 250.", difficulty: 1 },
          { key: "npv-y3-02", kind: "single", prompt: "What is the value of the digit 7 in the number 574?", options: ["7", "700", "70", "74"], answer: "70", explanation: "The 7 is in the tens column, so it is worth 7 tens, which is 70.", difficulty: 1 },
          { key: "npv-y3-03", kind: "single", prompt: "Which number is six hundred and five?", options: ["605", "65", "650", "6,005"], answer: "605", explanation: "Six hundred is 600 and five is 5, so it is 605. The 0 holds the empty tens column.", difficulty: 2, diagnostic: true },
          { key: "npv-y3-04", kind: "short", prompt: "Write 352 in words.", answer: "three hundred and fifty-two", accepted: ["three hundred and fifty two", "three hundred fifty-two", "three hundred fifty two"], explanation: "352 is 3 hundreds, 5 tens and 2 ones: three hundred and fifty-two.", difficulty: 2 },
          { key: "npv-y3-05", kind: "single", prompt: "Which of these numbers is the smallest?", options: ["517", "571", "175", "157"], answer: "157", explanation: "Compare the hundreds first: 157 and 175 have only 1 hundred. Then compare the tens: 5 tens is less than 7 tens, so 157 is smallest.", difficulty: 2, diagnostic: true },
          { key: "npv-y3-06", kind: "number", prompt: "Count on in 100s: 235, 335, 435, ... What number comes next?", answer: 535, explanation: "Counting in 100s adds 1 to the hundreds digit, so 435 + 100 = 535.", difficulty: 1 },
          { key: "npv-y3-07", kind: "number", prompt: "Count in 8s: 8, 16, 24, 32, ... What is the 7th number in the sequence?", answer: 56, explanation: "Keep adding 8: 8, 16, 24, 32, 40, 48, 56. The 7th number is 56.", difficulty: 2 },
          { key: "npv-y3-08", kind: "multi", prompt: "Select ALL the numbers you say when you count in 4s from 0.", options: ["12", "18", "24", "30", "36"], answer: ["12", "24", "36"], explanation: "Counting in 4s goes 4, 8, 12, 16, 20, 24, 28, 32, 36. So 12, 24 and 36 are in the list; 18 and 30 are not.", difficulty: 2 },
          { key: "npv-y3-09", kind: "single", prompt: "I am a 3-digit number. My hundreds digit is 5. My tens digit is 3 more than my hundreds digit. My ones digit is 0. What number am I?", options: ["530", "508", "850", "580"], answer: "580", explanation: "Hundreds: 5. Tens: 5 + 3 = 8. Ones: 0. So the number is 580.", difficulty: 3 },
          { key: "npv-y3-10", kind: "single", prompt: "Which list is in order from smallest to largest?", options: ["408, 84, 480, 804", "84, 408, 480, 804", "84, 408, 804, 480", "804, 480, 408, 84"], answer: "84, 408, 480, 804", explanation: "84 has the fewest digits so it is smallest. Then compare hundreds and tens: 408 is less than 480, which is less than 804.", difficulty: 3 },
        ],
      },
      flashcards: [
        { front: "What are the three columns in a 3-digit number?", back: "Hundreds, tens and ones (from left to right)." },
        { front: "What is the value of the 6 in 462?", back: "60, because the 6 is in the tens column (6 tens)." },
        { front: "What does the digit 0 do in 407?", back: "It is a placeholder. It shows there are no tens, so the 4 stays worth 400." },
        { front: "How do you compare two 3-digit numbers?", back: "Compare the hundreds first. If they match, compare the tens, then the ones." },
        { front: "Count in 4s from 0", back: "4, 8, 12, 16, 20, 24, 28, 32, 36, 40, 44, 48" },
        { front: "Count in 8s from 0", back: "8, 16, 24, 32, 40, 48, 56, 64, 72, 80, 88, 96" },
        { front: "Count in 50s from 0", back: "50, 100, 150, 200, 250, 300, 350, 400 ..." },
        { front: "Count on in 100s from 168", back: "168, 268, 368, 468, 568 ... only the hundreds digit changes." },
        { front: "Write 764 in words", back: "seven hundred and sixty-four" },
        { front: "Which symbol means 'is less than'?", back: "<   (the small end points to the smaller number)" },
      ],
    },
    4: {
      year: 4,
      objectives: [
        "Count in multiples of 6, 7, 9, 25 and 1,000",
        "Recognise the place value of each digit in a four-digit number",
        "Order and compare numbers beyond 1,000",
        "Round any number to the nearest 10, 100 or 1,000",
        "Read Roman numerals to 100 (I to C)",
      ],
      note: {
        title: "Four-digit numbers, rounding and Roman numerals",
        body: `## Place value to 9,999

A four-digit number adds a **thousands** column on the left.

| Number | Thousands | Hundreds | Tens | Ones |
| --- | --- | --- | --- | --- |
| 6,317 | 6 | 3 | 1 | 7 |

In 6,317 the digit 3 is worth **300**.

## Rounding

To round, look at the digit **one place to the right** of the place you are rounding to.

- **5 or more**: round **up**.
- **4 or less**: round **down**.

**Worked example 1.** Round 2,764 to the nearest 100.

1. The hundreds digit is 7. Look at the tens digit: 6.
2. 6 is 5 or more, so round up to 2,800.

**Worked example 2.** Round 4,996 to the nearest 10.

1. The tens digit is 9 and the ones digit is 6, so round up.
2. 9 tens + 1 more ten = 10 tens, which carries. The answer is **5,000**.

## Roman numerals

| I | V | X | L | C |
| --- | --- | --- | --- | --- |
| 1 | 5 | 10 | 50 | 100 |

A smaller symbol **before** a bigger one is taken away (IV = 4, IX = 9, XL = 40). A smaller symbol **after** is added on (XVI = 10 + 6 = 16).

**Worked example 3.** XLVII = XL (40) + VII (7) = **47**.

## Counting patterns

Count in 6s, 7s, 9s, 25s and 1,000s. The 25s are 25, 50, 75, 100, 125 ...`,
      },
      quiz: {
        title: "Number & Place Value Year 4: rounding, Roman numerals and multiples",
        questions: [
          { key: "npv-y4-01", kind: "number", prompt: "Count in 6s: 6, 12, 18, 24, ... What number comes next?", answer: 30, explanation: "Add 6 each time: 24 + 6 = 30.", difficulty: 1 },
          { key: "npv-y4-02", kind: "single", prompt: "What is the value of the digit 8 in 5,824?", options: ["8", "80", "800", "8,000"], answer: "800", explanation: "The 8 is in the hundreds column, so it is worth 8 hundreds, which is 800.", difficulty: 1 },
          { key: "npv-y4-03", kind: "single", prompt: "Round 3,468 to the nearest 100.", options: ["3,400", "3,500", "3,470", "3,000"], answer: "3,500", explanation: "Look at the tens digit, which is 6. That is 5 or more, so round the hundreds up: 3,500.", difficulty: 2, diagnostic: true },
          { key: "npv-y4-04", kind: "short", prompt: "Write 14 in Roman numerals.", answer: "XIV", explanation: "10 is X and 4 is IV (one before five), so 14 is XIV.", difficulty: 1 },
          { key: "npv-y4-05", kind: "single", prompt: "Which Roman numeral means 49?", options: ["XLIX", "IL", "XXXXIX", "XIL"], answer: "XLIX", explanation: "49 is 40 + 9. Forty is XL (ten before fifty) and nine is IX, so 49 is XLIX.", difficulty: 2 },
          { key: "npv-y4-06", kind: "single", prompt: "Which of these numbers is the largest?", options: ["4,052", "4,205", "4,502", "4,250"], answer: "4,502", explanation: "All have 4 thousands, so compare the hundreds: 5 hundreds is the most, so 4,502 is the largest.", difficulty: 2, diagnostic: true },
          { key: "npv-y4-07", kind: "number", prompt: "Count in 25s from 0: 25, 50, 75, 100, ... What is the 9th number in the sequence?", answer: 225, explanation: "The 9th number is 9 × 25 = 225. (Or keep counting: 100, 125, 150, 175, 200, 225.)", difficulty: 2 },
          { key: "npv-y4-08", kind: "multi", prompt: "Select ALL the numbers that are in the 7 times table.", options: ["14", "27", "35", "48", "63"], answer: ["14", "35", "63"], explanation: "14 = 2 × 7, 35 = 5 × 7 and 63 = 9 × 7. The numbers 27 and 48 do not appear in the 7 times table.", difficulty: 2 },
          { key: "npv-y4-09", kind: "number", prompt: "Round 2,995 to the nearest 10. Type your answer as digits with no comma.", answer: 3000, explanation: "The ones digit is 5, so round up. 2,995 goes up to the next ten, which is 3,000.", difficulty: 3 },
          { key: "npv-y4-10", kind: "single", prompt: "A number rounds to 4,700 when rounded to the nearest 100. Which of these could the number be?", options: ["4,649", "4,750", "4,760", "4,651"], answer: "4,651", explanation: "Numbers from 4,650 to 4,749 round to 4,700. Only 4,651 is in that range; 4,649 rounds down to 4,600, and 4,750 and 4,760 round up to 4,800.", difficulty: 3 },
          { key: "npv-y4-11", kind: "single", prompt: "Round 4,962 to the nearest 1,000.", options: ["4,000", "4,900", "5,000", "4,960"], answer: "5,000", explanation: "Look at the hundreds digit, which is 9. That is 5 or more, so round the thousands up: 4,962 rounds to 5,000.", difficulty: 2 },
          { key: "npv-y4-12", kind: "number", prompt: "Count in 9s: 9, 18, 27, 36, ... What number comes next?", answer: 45, explanation: "Add 9 each time: 36 + 9 = 45.", difficulty: 1 },
        ],
      },
      flashcards: [
        { front: "What is the value of the 3 in 6,317?", back: "300 (3 hundreds)." },
        { front: "Rounding rule", back: "Look one place to the right. 5 or more: round up. 4 or less: round down." },
        { front: "Round 2,764 to the nearest 100", back: "2,800" },
        { front: "Round 6,451 to the nearest 1,000", back: "6,000 (the hundreds digit is 4, so round down)." },
        { front: "I, V, X, L, C are worth...", back: "I = 1, V = 5, X = 10, L = 50, C = 100" },
        { front: "Write 9 and 40 in Roman numerals", back: "9 = IX, 40 = XL" },
        { front: "Write 16 in Roman numerals", back: "XVI (X = 10, then VI = 6)" },
        { front: "Count in 6s from 0", back: "6, 12, 18, 24, 30, 36, 42, 48, 54, 60, 66, 72" },
        { front: "Count in 7s from 0", back: "7, 14, 21, 28, 35, 42, 49, 56, 63, 70, 77, 84" },
        { front: "Count in 9s from 0", back: "9, 18, 27, 36, 45, 54, 63, 72, 81, 90, 99, 108" },
        { front: "Count in 25s from 0", back: "25, 50, 75, 100, 125, 150, 175, 200 ..." },
      ],
    },
    5: {
      year: 5,
      objectives: [
        "Read, write, order and compare numbers to at least 1,000,000",
        "Count forwards or backwards in steps of powers of 10",
        "Interpret negative numbers in context, counting through zero",
        "Round any number up to 1,000,000 to the nearest 10, 100, 1,000, 10,000 and 100,000",
        "Read Roman numerals to 1,000 (M) and recognise years written in Roman numerals",
      ],
      note: {
        title: "Numbers to a million, negatives and rounding",
        body: `## Place value to 1,000,000

| Number | Hundred thousands | Ten thousands | Thousands | Hundreds | Tens | Ones |
| --- | --- | --- | --- | --- | --- | --- |
| 728,406 | 7 | 2 | 8 | 4 | 0 | 6 |

In 728,406 the digit 2 is worth **20,000**. Commas split the number into groups of three digits so it is easy to read.

## Rounding to a bigger place

**Worked example 1.** Round 538,614 to the nearest 10,000.

1. The ten-thousands digit is 3. Look at the thousands digit to its right: 8.
2. 8 is 5 or more, so round up: **540,000**.

## Counting in powers of 10

Count in steps of 10, 100, 1,000, 10,000 or 100,000. Only one column changes each step (unless you cross a boundary).

**Worked example 2.** Count back in 1,000s from 200,750: 199,750, 198,750, 197,750, **196,750**. Crossing 200,000 changes several digits.

## Negative numbers

A number line goes below zero. Temperatures are the easiest place to meet negatives.

**Worked example 3.** It is −3°C at midnight and 5°C at noon. The rise is the distance from −3 to 5: 3 steps to reach 0, then 5 more, so **8 degrees**.

## Roman numerals to 1,000

| C | D | M | CM | CD |
| --- | --- | --- | --- | --- |
| 100 | 500 | 1,000 | 900 | 400 |

740 = D (500) + C (100) + C (100) + XL (40) = **DCCXL**.`,
      },
      quiz: {
        title: "Number & Place Value Year 5: numbers to a million",
        questions: [
          { key: "npv-y5-01", kind: "single", prompt: "What is the value of the digit 4 in 345,218?", options: ["4,000", "40,000", "400,000", "400"], answer: "40,000", explanation: "The 4 is in the ten-thousands column, so it is worth 4 ten-thousands, which is 40,000.", difficulty: 1 },
          { key: "npv-y5-02", kind: "single", prompt: "Which number is two hundred and six thousand, four hundred and three?", options: ["206,403", "260,403", "206,430", "2,064,003"], answer: "206,403", explanation: "206 thousand is 206,000 and four hundred and three is 403, so the number is 206,403.", difficulty: 1 },
          { key: "npv-y5-03", kind: "single", prompt: "Round 476,382 to the nearest 10,000.", options: ["470,000", "480,000", "476,000", "500,000"], answer: "480,000", explanation: "The ten-thousands digit is 7. The thousands digit is 6, which is 5 or more, so round up to 480,000.", difficulty: 2, diagnostic: true },
          { key: "npv-y5-04", kind: "number", prompt: "Count backwards in 1,000s from 302,500. What number do you reach after 4 steps? Type your answer as digits with no comma.", answer: 298500, explanation: "Take away 1,000 four times: 301,500, 300,500, 299,500, 298,500.", difficulty: 3 },
          { key: "npv-y5-05", kind: "single", prompt: "The temperature in Oslo was −6°C at midnight and 4°C at noon. By how many degrees did it rise?", options: ["2", "10", "−2", "−10"], answer: "10", explanation: "From −6 up to 0 is 6 degrees, then 0 up to 4 is 4 more degrees. 6 + 4 = 10.", difficulty: 2, diagnostic: true, image: { file: "npv-y5-numline.png", alt: "A number line from negative 10 to 10 with a whole-number tick at each step. A blue dot at negative 6 is labelled midnight and an orange dot at 4 is labelled noon." } },
          { key: "npv-y5-06", kind: "single", prompt: "What is 10,000 less than 526,100?", options: ["516,100", "525,100", "426,100", "526,000"], answer: "516,100", explanation: "Take 1 from the ten-thousands digit: 526,100 becomes 516,100.", difficulty: 2 },
          { key: "npv-y5-07", kind: "short", prompt: "Write 640 in Roman numerals.", answer: "DCXL", explanation: "640 = 500 + 100 + 40, which is D + C + XL = DCXL.", difficulty: 2 },
          { key: "npv-y5-08", kind: "multi", prompt: "Select ALL the numbers that round to 300,000 when rounded to the nearest 100,000.", options: ["249,999", "250,000", "304,900", "349,999", "350,000"], answer: ["250,000", "304,900", "349,999"], explanation: "Numbers from 250,000 up to 349,999 round to 300,000. 249,999 rounds down to 200,000 and 350,000 rounds up to 400,000.", difficulty: 3 },
          { key: "npv-y5-09", kind: "single", prompt: "Which list shows −8, 3, −2 and 0 in order from smallest to largest?", options: ["0, −2, 3, −8", "−2, −8, 0, 3", "−8, −2, 0, 3", "3, 0, −2, −8"], answer: "−8, −2, 0, 3", explanation: "On a number line, numbers further left are smaller. The order from left to right is −8, −2, 0, 3.", difficulty: 1 },
          { key: "npv-y5-10", kind: "number", prompt: "A submarine is 240 m below sea level, which is −240 m. A helicopter is 350 m above the submarine. What is the helicopter's height above sea level, in metres?", answer: 110, explanation: "From −240 you climb 240 m to sea level, then 110 m more: 350 − 240 = 110 m above sea level.", difficulty: 2 },
        ],
      },
      flashcards: [
        { front: "Name the columns of 728,406 from the left", back: "Hundred thousands, ten thousands, thousands, hundreds, tens, ones." },
        { front: "Value of the 2 in 728,406", back: "20,000" },
        { front: "Round 538,614 to the nearest 10,000", back: "540,000 (the thousands digit is 8, so round up)." },
        { front: "Round 649,999 to the nearest 100,000", back: "600,000 (the ten-thousands digit is 4, so round down)." },
        { front: "What is 10,000 more than 384,200?", back: "394,200" },
        { front: "What is 100,000 less than 384,200?", back: "284,200" },
        { front: "Which is smaller, −8 or −2?", back: "−8. Further left on the number line means smaller." },
        { front: "How do you find the rise from −3°C to 5°C?", back: "3 up to zero, then 5 more: 3 + 5 = 8 degrees." },
        { front: "D, M, CM, CD are worth...", back: "D = 500, M = 1,000, CM = 900, CD = 400" },
        { front: "Write 740 in Roman numerals", back: "DCCXL (500 + 100 + 100 + 40)" },
      ],
    },
    6: {
      year: 6,
      objectives: [
        "Read, write, order and compare numbers up to 10,000,000 and determine the value of each digit",
        "Round any whole number to a required degree of accuracy",
        "Use negative numbers in context, and calculate intervals across zero",
      ],
      note: {
        title: "Numbers to ten million, rounding and negatives",
        body: `## Place value to 10,000,000

| Number | Millions | Hundred thousands | Ten thousands | Thousands | Hundreds | Tens | Ones |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 4,718,205 | 4 | 7 | 1 | 8 | 2 | 0 | 5 |

In 4,718,205 the digit 7 is worth **700,000**. To read a large number, say each group of three digits then its name: "four million, seven hundred and eighteen thousand, two hundred and five".

## Rounding to any accuracy

**Worked example 1.** Round 5,238,470 to the nearest 100,000.

1. The hundred-thousands digit is 2. The digit to its right (ten-thousands) is 3.
2. 3 is less than 5, so round down: **5,200,000**.

**Worked example 2.** Round 7,395,820 to the nearest 10,000.

1. The ten-thousands digit is 9. The thousands digit is 5, so round up.
2. 9 + 1 carries into the next column: **7,400,000**.

## Negative numbers and intervals

To find the **interval** (the difference) between two temperatures, count up to zero and then on. It is not the same as taking the smaller number from the bigger one without thinking about the sign.

**Worked example 3.** The temperature is −5°C at 6 am and rises by 8°C. Going up from −5: 5 steps to reach 0, then 3 more steps, so the temperature is **3°C**.

## Checklist

- Say the number in words to check the value of each digit.
- When rounding, always look only at the digit **one place to the right**.
- On a number line, larger numbers are always further right, even for negatives.`,
      },
      quiz: {
        title: "Number & Place Value Year 6: numbers to ten million",
        questions: [
          { key: "npv-y6-01", kind: "single", prompt: "Round 6,847,392 to the nearest 100,000.", options: ["6,800,000", "6,900,000", "6,850,000", "7,000,000"], answer: "6,800,000", explanation: "The ten-thousands digit is 4, so round down: 6,847,392 rounds to 6,800,000.", difficulty: 2, diagnostic: true },
          { key: "npv-y6-02", kind: "single", prompt: "What is the value of the digit 5 in 3,592,146?", options: ["5,000", "50,000", "500,000", "5,000,000"], answer: "500,000", explanation: "The 5 is in the hundred-thousands column, so its value is 500,000.", difficulty: 1 },
          { key: "npv-y6-03", kind: "single", prompt: "The temperature is −4°C at 6am. By noon it has risen by 9°C. What is the temperature at noon?", options: ["5°C", "13°C", "−13°C", "4°C"], answer: "5°C", explanation: "Moving 9 degrees up from −4 crosses zero: −4 + 9 = 5°C.", difficulty: 2, diagnostic: true },
          { key: "npv-y6-04", kind: "number", prompt: "Write four million, two hundred and five thousand and sixty in digits. Type it with no commas.", answer: 4205060, explanation: "4 million is 4,000,000, then 205 thousand is 205,000, then 60. Together that is 4,205,060.", difficulty: 1 },
          { key: "npv-y6-05", kind: "single", prompt: "Which of these numbers is the smallest?", options: ["3,450,982", "3,405,982", "3,450,289", "3,504,289"], answer: "3,405,982", explanation: "All have 3 million. Compare the hundred-thousands: 4 is less than 5. Then compare ten-thousands: 0 is less than 5, so 3,405,982 is smallest.", difficulty: 2 },
          { key: "npv-y6-06", kind: "number", prompt: "Round 8,096,437 to the nearest 10,000. Type your answer as digits with no commas.", answer: 8100000, explanation: "The ten-thousands digit is 9 and the thousands digit is 6, so round up. 9 + 1 carries over to give 8,100,000.", difficulty: 2 },
          { key: "npv-y6-07", kind: "number", prompt: "At night the temperature was −7°C. The daytime high was 12°C. What is the difference between the two temperatures, in °C?", answer: 19, explanation: "From −7 up to 0 is 7, and from 0 up to 12 is 12. Add the two parts: 7 + 12 = 19.", difficulty: 2 },
          { key: "npv-y6-08", kind: "multi", prompt: "Select ALL the numbers that round to 5,000,000 when rounded to the nearest million.", options: ["4,499,999", "4,500,000", "5,012,345", "5,499,999", "5,500,000"], answer: ["4,500,000", "5,012,345", "5,499,999"], explanation: "Numbers from 4,500,000 up to 5,499,999 round to 5,000,000. 4,499,999 rounds down to 4,000,000 and 5,500,000 rounds up to 6,000,000.", difficulty: 3 },
          { key: "npv-y6-09", kind: "single", prompt: "What is 1,000,000 less than 3,250,000?", options: ["3,150,000", "2,150,000", "3,240,000", "2,250,000"], answer: "2,250,000", explanation: "Take 1 from the millions digit: 3,250,000 becomes 2,250,000.", difficulty: 1 },
          { key: "npv-y6-10", kind: "number", prompt: "Look at the number line. What number is exactly halfway between point A (−8) and point B (5)?", answer: -1.5, explanation: "The gap from −8 to 5 is 13. Half of 13 is 6.5, and −8 + 6.5 = −1.5.", difficulty: 3, image: { file: "npv-y6-numline.png", alt: "A number line from negative 10 to 10 with a whole-number tick at each step. A blue dot at negative 8 is labelled A and an orange dot at 5 is labelled B." } },
        ],
      },
      flashcards: [
        { front: "Name the columns of 4,718,205 from the left", back: "Millions, hundred thousands, ten thousands, thousands, hundreds, tens, ones." },
        { front: "Value of the 7 in 4,718,205", back: "700,000 (seven hundred thousand)." },
        { front: "How do you round 5,238,470 to the nearest 100,000?", back: "Look at the ten-thousands digit (3). It is less than 5, so round down to 5,200,000." },
        { front: "What happens when a rounding digit 9 rounds up?", back: "It carries: 7,395,820 to the nearest 10,000 is 7,400,000." },
        { front: "What is 1,000,000 more than 2,480,000?", back: "3,480,000" },
        { front: "Write 6,340,027 in words", back: "Six million, three hundred and forty thousand and twenty-seven." },
        { front: "What is the interval between −5 and 9?", back: "14: 5 up to zero, then 9 more." },
        { front: "−5 + 8 = ?", back: "3. Moving up 8 from −5 crosses zero." },
        { front: "How do you find the number halfway between two values?", back: "Add them and halve the total (or find the gap, halve it and add to the smaller)." },
        { front: "Which is greater, −3 or −30?", back: "−3. It is further right on the number line." },
      ],
    },
  },
};
