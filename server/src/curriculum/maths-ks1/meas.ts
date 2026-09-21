// KS1 Maths — Measurement (Years 1–2: length, mass, capacity, time, money). Original content aligned to the DfE National
// Curriculum (OGL v3.0). Answer keys are recomputed by _check_m1.ts (clock/ruler/thermometer values come from
// _m1_image_data.json, the same file that draws the pictures) — re-run it after ANY edit here.
import type { CTopic } from "../types";

const IMG = {
  clock3: { file: "meas-clock-3.png", alt: "An analogue clock with numbers 1 to 12. The short, thick hour hand points straight at the 3. The long, thin blue minute hand points straight up at the 12." },
  clock730: { file: "meas-clock-730.png", alt: "An analogue clock with numbers 1 to 12. The short, thick hour hand points halfway between the 7 and the 8. The long, thin blue minute hand points straight down at the 6." },
  clock415: { file: "meas-clock-415.png", alt: "An analogue clock with numbers 1 to 12. The short, thick hour hand points just past the 4. The long, thin blue minute hand points at the 3." },
  clock845: { file: "meas-clock-845.png", alt: "An analogue clock with numbers 1 to 12. The short, thick hour hand points nearly at the 9, just before it. The long, thin blue minute hand points at the 9." },
  clock520: { file: "meas-clock-520.png", alt: "An analogue clock with numbers 1 to 12. The short, thick hour hand points just past the 5. The long, thin blue minute hand points at the 4." },
  ruler: { file: "meas-ruler.png", alt: "A ruler marked in centimetres from 0 to 12. A pencil lies just above it. The flat end of the pencil is lined up with the 0 mark and the sharp tip is lined up with one of the numbers on the ruler, shown by dashed guide lines." },
  thermo: { file: "meas-thermo.png", alt: "A thermometer with a red liquid column. The scale is in degrees Celsius: long marks and numbers at 0, 10, 20, 30 and 40, and shorter marks between them every 2 degrees. The top of the red liquid is level with one of the short marks between 20 and 30." },
};

export const TOPIC: CTopic = {
  key: "meas",
  topic: "Measurement",
  subject: "Maths",
  years: {
    1: {
      year: 1,
      objectives: [
        "Compare, describe and solve practical problems for lengths and heights, mass/weight, capacity and volume, and time (for example longer/shorter, heavier/lighter, holds more/less, quicker/slower).",
        "Recognise and know the value of different denominations of coins and notes.",
        "Sequence events in chronological order using language such as before and after, next, first, today, yesterday, tomorrow, morning, afternoon and evening.",
        "Recognise and use language relating to dates, including days of the week, weeks, months and years.",
        "Tell the time to the hour and half past the hour and draw the hands on a clock face to show these times.",
      ],
      note: {
        title: "Year 1: comparing, money, days and telling the time",
        body: `## What to know

**Comparing** uses everyday words: longer/shorter, taller, heavier/lighter, holds more/less, half full, quicker/slower.

**Time**: a clock has a short **hour hand** and a long **minute hand**.
- **o'clock**: the minute hand points to 12. The hour hand shows the hour.
- **half past**: the minute hand points to 6. The hour hand is halfway between two numbers.

**Money**: coins have different values (1p, 2p, 5p, 10p, 20p, 50p, £1, £2). A bigger coin is not always worth more.

**Days**: Monday, Tuesday, Wednesday, Thursday, Friday, Saturday, Sunday. There are 7 days in a week and 12 months in a year.

| Word | Example |
| --- | --- |
| before | breakfast is before lunch |
| after | Saturday is after Friday |
| yesterday / today / tomorrow | the day before, now, the day after |

## Say it like this

"Look at the short hand first for the hour. Then look at the long hand: 12 means o'clock, 6 means half past."

## Worked example 1: o'clock

The hour hand points at 9 and the minute hand points at 12. It is **9 o'clock**.

## Worked example 2: half past

The minute hand points at 6 and the hour hand is between 2 and 3. It is **half past 2**.

## Worked example 3: money

Two 2p coins make 2p + 2p = **4p**. A 10p coin is worth more than a 5p coin even if it looks smaller.

**Tip for grown-ups:** ask your child to tell you the time at meals and bedtime.`,
      },
      quiz: {
        title: "Measurement: Year 1 quiz",
        questions: [
          { key: "meas-y1-01", kind: "single", prompt: "What time does the clock show?", options: ["3 o'clock", "6 o'clock", "12 o'clock", "half past 3"], answer: "3 o'clock", image: IMG.clock3, explanation: "The long hand points to 12, so it is an o'clock time. The short hand points to 3. It is 3 o'clock.", difficulty: 1 },
          { key: "meas-y1-02", kind: "single", prompt: "Look at the clock. What is the time?", options: ["half past 6", "half past 7", "7 o'clock", "half past 8"], answer: "half past 7", image: IMG.clock730, explanation: "The long hand points to 6, so it is half past. The short hand is between 7 and 8, so we say half past 7.", difficulty: 2, diagnostic: true },
          { key: "meas-y1-03", kind: "single", prompt: "Which day comes after Tuesday?", options: ["Monday", "Thursday", "Wednesday", "Sunday"], answer: "Wednesday", explanation: "The days go Monday, Tuesday, Wednesday. So Wednesday comes after Tuesday.", difficulty: 1 },
          { key: "meas-y1-04", kind: "single", prompt: "Which of these is the heaviest?", options: ["a feather", "an elephant", "a pencil"], answer: "an elephant", explanation: "An elephant is much bigger and heavier than a feather or a pencil.", difficulty: 1 },
          { key: "meas-y1-05", kind: "number", prompt: "Ali has two 5p coins. How many pence has he got altogether?", answer: 10, explanation: "Count in 5s: 5, 10. Two 5p coins are worth 10p.", difficulty: 2, diagnostic: true },
          { key: "meas-y1-06", kind: "single", prompt: "The clock shows half past. Which number does the long hand point to?", options: ["3", "9", "6", "12"], answer: "6", explanation: "At half past the long hand points straight down to the 6.", difficulty: 2 },
          { key: "meas-y1-07", kind: "single", prompt: "Which list is in the right order?", options: ["Lunch, Breakfast, Dinner", "Breakfast, Lunch, Dinner", "Dinner, Lunch, Breakfast"], answer: "Breakfast, Lunch, Dinner", explanation: "We eat breakfast in the morning, then lunch, then dinner in the evening.", difficulty: 2 },
          { key: "meas-y1-08", kind: "number", prompt: "How many days are there in one week?", answer: 7, explanation: "Monday, Tuesday, Wednesday, Thursday, Friday, Saturday and Sunday make 7 days.", difficulty: 2 },
          { key: "meas-y1-09", kind: "number", prompt: "Ella has a 10p coin and a 5p coin. She spends 5p. How many pence has she got left?", answer: 10, explanation: "She spends the 5p coin, so she still has the 10p coin. 10p is left.", difficulty: 3 },
          { key: "meas-y1-10", kind: "number", prompt: "A snake 🐍 is 10 cubes long. A worm 🐛 is half as long. How many cubes long is the worm?", answer: 5, explanation: "Half of 10 is 5, because 5 + 5 = 10. The worm is 5 cubes long.", difficulty: 3 },
        ],
      },
      flashcards: [
        { front: "Long hand points to 12. The time is…", back: "o'clock" },
        { front: "Long hand points to 6. The time is…", back: "half past" },
        { front: "How many days in a week?", back: "7" },
        { front: "Which day comes before Friday?", back: "Thursday" },
        { front: "How many months in a year?", back: "12" },
        { front: "Which is heavier: a book or a feather?", back: "A book" },
        { front: "Which holds more: a bucket or a cup?", back: "A bucket" },
        { front: "Two 10p coins are worth…", back: "20p" },
        { front: "Which hand is short and shows the hour?", back: "The hour hand" },
        { front: "What comes after 'yesterday' and 'today'?", back: "Tomorrow" },
      ],
    },
    2: {
      year: 2,
      objectives: [
        "Choose and use appropriate standard units to estimate and measure length/height (m/cm), mass (kg/g), temperature (°C) and capacity (litres/ml), using rulers, scales, thermometers and measuring vessels.",
        "Compare and order lengths, mass, volume/capacity and record the results using >, < and =.",
        "Recognise and use symbols for pounds (£) and pence (p); combine amounts to make a particular value; find different combinations of coins that equal the same amounts of money.",
        "Solve simple problems in a practical context involving addition and subtraction of money of the same unit, including giving change.",
        "Compare and sequence intervals of time; tell and write the time to five minutes, including quarter past/to the hour, and draw the hands on a clock face to show these times.",
        "Know the number of minutes in an hour and the number of hours in a day.",
      ],
      note: {
        title: "Year 2: units, money, change and the time to 5 minutes",
        body: `## What to know

**Units**

| Measuring | Unit | Tool |
| --- | --- | --- |
| length, height | cm, m | ruler, tape |
| mass (weight) | g, kg | scales |
| capacity | ml, litres | measuring jug |
| temperature | °C | thermometer |

Read the scale carefully: find what each small mark is worth first. Line up the **0** on the ruler with the start of the object.

**Money**: 100p = £1. To find **change**, subtract what you spend from what you pay.

**Time**: there are **60 minutes** in 1 hour and **24 hours** in 1 day. The minute hand goes round the numbers in 5s: 1 is 5 minutes, 2 is 10, 3 is 15 (**quarter past**), 6 is 30 (**half past**), 9 is 45 (**quarter to** the next hour).

## Say it like this

"Count in 5s round the clock: 5, 10, 15, 20…"

## Worked example 1: a ruler

A crayon starts at 0 and ends at the 6 mark. It is **6 cm** long.

## Worked example 2: change

A rubber costs 40p. You pay with 50p. Change: 50p − 40p = **10p**.

## Worked example 3: the clock

The minute hand points to 3 and the hour hand is just past 7. It is **quarter past 7**, or 7:15.

**Tip for grown-ups:** let your child pay for something small and work out the change.`,
      },
      quiz: {
        title: "Measurement: Year 2 quiz",
        questions: [
          { key: "meas-y2-01", kind: "single", prompt: "What time does the clock show?", options: ["quarter to 4", "quarter past 4", "half past 4", "4 o'clock"], answer: "quarter past 4", image: IMG.clock415, explanation: "The long hand points to 3, which is 15 minutes. The hour hand is just past 4. So it is quarter past 4.", difficulty: 2, diagnostic: true },
          { key: "meas-y2-02", kind: "single", prompt: "Read the clock. What is the time?", options: ["quarter past 8", "quarter to 8", "quarter to 9", "9 o'clock"], answer: "quarter to 9", image: IMG.clock845, explanation: "The long hand points to 9, which is 45 minutes past, or 15 minutes to the next hour. The short hand is nearly at 9. So it is quarter to 9.", difficulty: 2 },
          { key: "meas-y2-03", kind: "single", prompt: "Which time is shown on this clock?", options: ["4:20", "6:20", "5:04", "5:20"], answer: "5:20", image: IMG.clock520, explanation: "The long hand points to 4. Count in 5s: 5, 10, 15, 20. So it is 20 minutes past. The hour hand is just past 5, so it is 5:20.", difficulty: 3 },
          { key: "meas-y2-04", kind: "number", prompt: "How long is the pencil in centimetres?", answer: 8, image: IMG.ruler, explanation: "The pencil starts at 0 and its tip is at 8 on the ruler. So it is 8 cm long.", difficulty: 1 },
          { key: "meas-y2-05", kind: "single", prompt: "What temperature does the thermometer show?", options: ["24°C", "28°C", "26°C", "30°C"], answer: "26°C", image: IMG.thermo, explanation: "Start at 20 and count up in 2s: 22, 24, 26. The liquid stops at 26°C.", difficulty: 2, diagnostic: true },
          { key: "meas-y2-06", kind: "number", prompt: "How many minutes are there in 1 hour?", answer: 60, explanation: "The minute hand takes 60 minutes to go all the way round the clock once.", difficulty: 1 },
          { key: "meas-y2-07", kind: "single", prompt: "Which unit is best for the mass of an apple?", options: ["g", "km", "ml", "cm"], answer: "g", explanation: "Mass is measured in grams (g) or kilograms (kg). An apple is small, so grams is best.", difficulty: 1 },
          { key: "meas-y2-08", kind: "number", prompt: "A toy costs 65p. Ali pays with £1. How many pence change?", answer: 35, explanation: "£1 is 100p. Find the change: 100p − 65p = 35p.", difficulty: 2 },
          { key: "meas-y2-09", kind: "multi", prompt: "Which of these make 50p? Choose two.", options: ["20p + 20p + 10p", "10p + 10p + 10p", "20p + 20p + 5p", "20p + 20p + 5p + 5p"], answer: ["20p + 20p + 10p", "20p + 20p + 5p + 5p"], explanation: "Add each set: 20 + 20 + 10 = 50 and 20 + 20 + 5 + 5 = 50. The others make 30p and 45p.", difficulty: 2 },
          { key: "meas-y2-10", kind: "number", prompt: "A drink costs 45p and a biscuit costs 30p. Meena pays with £1. How many pence change?", answer: 25, explanation: "Add the two prices: 45p + 30p = 75p. Then 100p − 75p = 25p change.", difficulty: 3 },
        ],
      },
      flashcards: [
        { front: "How many minutes in 1 hour?", back: "60" },
        { front: "How many hours in 1 day?", back: "24" },
        { front: "Minute hand points to 3. The time is…", back: "Quarter past (15 minutes past)" },
        { front: "Minute hand points to 9. The time is…", back: "Quarter to (45 minutes past)" },
        { front: "Minute hand points to 4. How many minutes past?", back: "20" },
        { front: "£1 = ? p", back: "100p" },
        { front: "20p + 10p + 5p = ?", back: "35p" },
        { front: "Which unit measures temperature?", back: "Degrees Celsius (°C)" },
        { front: "Which unit is best for measuring the length of a desk?", back: "Centimetres (cm)" },
        { front: "What does < mean?", back: "Is less than" },
      ],
    },
  },
};
