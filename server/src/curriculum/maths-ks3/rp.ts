// KS3 Maths — Ratio & Proportion (Years 7–9). Original content aligned to the DfE National Curriculum KS3 programme of study (OGL v3.0).
// Answer keys are recomputed by _check_m2.ts — re-run it after ANY edit here.
import type { CTopic } from "../types";

export const TOPIC: CTopic = {
  key: "rp",
  topic: "Ratio & Proportion",
  subject: "Maths",
  years: {
    7: {
      year: 7,
      objectives: [
        "Use ratio notation, including reduction to simplest form.",
        "Divide a given quantity into two parts in a given part:part or part:whole ratio.",
        "Express the division of a quantity into two parts as a ratio.",
        "Understand and use ratio and fractions together, including with different units.",
      ],
      note: {
        title: "Year 7: writing, simplifying and sharing in a ratio",
        body: `## What you need to know

- A **ratio** compares quantities. Boys : girls = 3 : 5 means 3 boys for every 5 girls.
- **Simplify** a ratio by dividing every part by the same number, just like a fraction: 18 : 24 = 3 : 4.
- Both parts must be in the **same units** before you simplify (change metres to centimetres first).
- The **order matters**: 3 : 5 is not the same as 5 : 3.
- To **share in a ratio**: add the parts to find the total number of parts, divide the amount by that total, then multiply.

## Worked example 1: sharing

Share £90 in the ratio 4 : 5. Total parts = 4 + 5 = 9. One part = 90 ÷ 9 = £10. The shares are 4 × 10 = **£40** and 5 × 10 = **£50**. Check: 40 + 50 = 90.

## Worked example 2: ratio and fractions

Lemon squash is mixed 1 part squash to 4 parts water. There are 5 parts altogether, so the squash is **1/5** of the drink and the water is 4/5.

## Worked example 3: different units

Write 40 cm : 2 m as a ratio. Change 2 m to 200 cm, so 40 : 200. Divide both by 40: **1 : 5**.

| Ratio | Simplest form |
| --- | --- |
| 18 : 24 | 3 : 4 |
| 25 : 10 | 5 : 2 |`,
      },
      quiz: {
        title: "Ratio & Proportion: Year 7 quiz",
        questions: [
          {
            key: "rp-y7-01",
            kind: "single",
            prompt: "Simplify the ratio 12 : 18.",
            options: ["3 : 2", "2 : 3", "6 : 9", "4 : 6"],
            answer: "2 : 3",
            explanation: "Divide both numbers by their highest common factor, 6: 12 ÷ 6 = 2 and 18 ÷ 6 = 3. So the ratio is 2 : 3.",
            difficulty: 1,
          },
          {
            key: "rp-y7-02",
            kind: "number",
            prompt: "Share 20 sweets in the ratio 1 : 3. How many sweets does the smaller share get?",
            answer: 5,
            explanation: "There are 1 + 3 = 4 parts. One part is 20 ÷ 4 = 5 sweets, and the smaller share is 1 part, so 5.",
            difficulty: 1,
          },
          {
            key: "rp-y7-03",
            kind: "single",
            prompt: "A class has 12 girls and 15 boys. What is the ratio of girls to boys in its simplest form?",
            options: ["12 : 15", "5 : 4", "4 : 5", "4 : 9"],
            answer: "4 : 5",
            explanation: "Write girls : boys = 12 : 15 and divide both by 3 to get 4 : 5. Keep the order the same as in the question.",
            difficulty: 1,
          },
          {
            key: "rp-y7-04",
            kind: "number",
            prompt: "The bar model shows £96 shared between Ali and Ben in the ratio 3 : 5. How many pounds does Ben get?",
            answer: 60,
            explanation: "There are 3 + 5 = 8 equal blocks. Each block is 96 ÷ 8 = £12. Ben has 5 blocks, so 5 × 12 = £60.",
            difficulty: 2,
            image: { file: "rp-y7-barmodel.png", alt: "A bar model: a bracket labelled £96 shared spans a single row of 8 equal blocks. The first 3 blocks, marked Ali, are blue and the last 5 blocks, marked Ben, are orange." },
          },
          {
            key: "rp-y7-05",
            kind: "single",
            prompt: "Red and blue counters are in the ratio 2 : 5. There are 10 red counters. How many blue counters are there?",
            options: ["13", "20", "4", "25"],
            answer: "25",
            explanation: "The red part 2 has been multiplied by 5 to give 10, so multiply the blue part 5 by 5 too: 25.",
            difficulty: 2,
            diagnostic: true,
          },
          {
            key: "rp-y7-06",
            kind: "single",
            prompt: "Paint is mixed from 3 parts blue to 2 parts yellow. What fraction of the mixture is yellow?",
            options: ["2/3", "2/5", "3/5", "1/2"],
            answer: "2/5",
            explanation: "There are 3 + 2 = 5 parts in total. Yellow is 2 of those 5 parts, which is 2/5. The denominator is the total, not the other part.",
            difficulty: 2,
            diagnostic: true,
          },
          {
            key: "rp-y7-07",
            kind: "number",
            prompt: "At a show, the ratio of adults to children is 3 : 7. There are 210 people altogether. How many are children?",
            answer: 147,
            explanation: "There are 3 + 7 = 10 parts. One part is 210 ÷ 10 = 21 people. Children are 7 parts: 7 × 21 = 147.",
            difficulty: 2,
          },
          {
            key: "rp-y7-08",
            kind: "short",
            prompt: "Write the ratio 30 cm : 1.5 m in its simplest form.",
            answer: "1 : 5",
            accepted: ["1:5", "1 to 5"],
            explanation: "Use the same units: 1.5 m = 150 cm. Then 30 : 150, and dividing both by 30 gives 1 : 5.",
            difficulty: 2,
          },
          {
            key: "rp-y7-09",
            kind: "single",
            prompt: "Ali and Bea share some sweets in the ratio 2 : 3. Bea gets 12 more sweets than Ali. How many sweets are there in total?",
            options: ["60", "24", "36", "72"],
            answer: "60",
            explanation: "Bea has 3 − 2 = 1 more part than Ali, and that 1 part is 12 sweets. There are 2 + 3 = 5 parts, so 5 × 12 = 60.",
            difficulty: 3,
          },
          {
            key: "rp-y7-10",
            kind: "multi",
            prompt: "Which of these ratios are equivalent to 4 : 10?",
            options: ["2 : 5", "8 : 20", "6 : 12", "1 : 2.5", "10 : 4"],
            answer: ["2 : 5", "8 : 20", "1 : 2.5"],
            explanation: "Equivalent ratios come from multiplying or dividing both parts by the same number. 4 : 10 = 2 : 5 = 8 : 20 = 1 : 2.5. 6 : 12 simplifies to 1 : 2 and 10 : 4 is in the wrong order.",
            difficulty: 3,
          },
        ],
      },
      flashcards: [
        { front: "What does a ratio 2 : 3 mean?", back: "For every 2 of the first thing there are 3 of the second" },
        { front: "How do you simplify a ratio?", back: "Divide every part by the same number (their highest common factor)" },
        { front: "Simplify 20 : 30", back: "2 : 3" },
        { front: "First step before simplifying 50 cm : 2 m", back: "Change to the same units (50 : 200), then simplify to 1 : 4" },
        { front: "How do you share in a ratio?", back: "Add the parts, divide the amount by the total parts, then multiply by each part" },
        { front: "Share £60 in the ratio 1 : 5", back: "£10 and £50" },
        { front: "Ratio 2 : 3 of squash to water. What fraction is squash?", back: "2/5 (2 out of 5 parts in total)" },
        { front: "Does the order of a ratio matter?", back: "Yes: 2 : 3 is different from 3 : 2" },
        { front: "Boys : girls = 4 : 3. There are 12 boys. How many girls?", back: "9 (multiply both parts by 3)" },
      ],
    },
    8: {
      year: 8,
      objectives: [
        "Solve problems involving direct proportion, including the unitary method, recipes and currency conversion.",
        "Compare prices to find the best buy using unit costs.",
        "Use scale factors, scale diagrams and maps.",
        "Recognise and use ratio and proportion in graphs and tables (y = kx).",
      ],
      note: {
        title: "Year 8: direct proportion, best buys and scales",
        body: `## What you need to know

- Two quantities are in **direct proportion** when they increase together at the same rate: double one and the other doubles.
- The **unitary method** finds the value of ONE unit first, then scales up. This is the key idea for recipes, prices and currency.
- For a **best buy**, work out the price per unit (or units per pound) for each option and compare.
- A **scale** such as 1 : 20,000 means 1 cm on the map is 20,000 cm in real life. Convert at the end: 100,000 cm = 1,000 m = 1 km.
- If y is directly proportional to x, then y = kx for a fixed number k, and the graph is a straight line through the origin.

## Worked example 1: unitary method

7 notebooks cost £4.20. One notebook costs £4.20 ÷ 7 = £0.60. So 12 notebooks cost 12 × 0.60 = **£7.20**.

## Worked example 2: best buy

Juice A: 2 litres for £1.80, which is 90p per litre. Juice B: 3 litres for £2.55, which is 85p per litre. **B is the better buy.**

## Worked example 3: map scale

A map has scale 1 : 20,000. A path is 5 cm long on the map: 5 × 20,000 = 100,000 cm = **1 km**.

| Scale | 1 cm on the map is ... |
| --- | --- |
| 1 : 1,000 | 10 m |
| 1 : 100,000 | 1 km |`,
      },
      quiz: {
        title: "Ratio & Proportion: Year 8 quiz",
        questions: [
          {
            key: "rp-y8-01",
            kind: "number",
            prompt: "5 pens cost £3.50. How much do 8 pens cost, in pounds?",
            answer: 5.6,
            explanation: "One pen costs 3.50 ÷ 5 = £0.70. Eight pens cost 8 × 0.70 = £5.60.",
            difficulty: 1,
          },
          {
            key: "rp-y8-02",
            kind: "single",
            prompt: "A recipe for 4 people uses 300 g of flour. How much flour is needed for 6 people?",
            options: ["400 g", "500 g", "600 g", "450 g"],
            answer: "450 g",
            explanation: "For 1 person you need 300 ÷ 4 = 75 g. For 6 people, 6 × 75 = 450 g.",
            difficulty: 1,
          },
          {
            key: "rp-y8-03",
            kind: "single",
            prompt: "A map has scale 1 : 50,000. Two towns are 6 cm apart on the map. How far apart are they in real life?",
            options: ["300 m", "3 km", "30 km", "300 km"],
            answer: "3 km",
            explanation: "6 × 50,000 = 300,000 cm. Divide by 100 to get 3,000 m, which is 3 km.",
            difficulty: 1,
          },
          {
            key: "rp-y8-04",
            kind: "single",
            prompt: "Which is the best buy for pasta?",
            options: ["A: 500 g for £2.00", "B: 750 g for £2.85", "C: 1 kg for £3.60", "They are all the same value"],
            answer: "C: 1 kg for £3.60",
            explanation: "Compare the cost per 100 g: A is 40p, B is 38p and C is 36p. C is cheapest per 100 g, so it is the best buy.",
            difficulty: 2,
            diagnostic: true,
          },
          {
            key: "rp-y8-05",
            kind: "number",
            prompt: "£1 is worth 1.20 euros. How many euros do you get for £75?",
            answer: 90,
            explanation: "Multiply the pounds by the exchange rate: 75 × 1.20 = 90 euros.",
            difficulty: 2,
          },
          {
            key: "rp-y8-06",
            kind: "single",
            prompt: "y is directly proportional to x. When x = 4, y = 10. What is y when x = 10?",
            options: ["25", "16", "40", "22"],
            answer: "25",
            explanation: "y = kx with 10 = k × 4, so k = 2.5. When x = 10, y = 2.5 × 10 = 25. Adding 6 to both would be additive, not proportional.",
            difficulty: 2,
            diagnostic: true,
          },
          {
            key: "rp-y8-07",
            kind: "number",
            prompt: "A car uses 6 litres of fuel to travel 80 km. How many litres does it use for 200 km at the same rate?",
            answer: 15,
            explanation: "200 km is 200 ÷ 80 = 2.5 times as far, so the fuel is 6 × 2.5 = 15 litres.",
            difficulty: 2,
          },
          {
            key: "rp-y8-08",
            kind: "number",
            prompt: "A model boat is built to a scale of 1 : 25. The model is 32 cm long. How long is the real boat, in metres?",
            answer: 8,
            explanation: "Real length = 32 × 25 = 800 cm. Divide by 100 to change centimetres to metres: 8 m.",
            difficulty: 2,
          },
          {
            key: "rp-y8-09",
            kind: "single",
            prompt: "Sam is paid £9.60 for 80 minutes of work. At the same rate, how much is Sam paid for 2 hours?",
            options: ["£11.52", "£14.40", "£19.20", "£12.80"],
            answer: "£14.40",
            explanation: "2 hours is 120 minutes. One minute pays 9.60 ÷ 80 = £0.12, so 120 minutes pays 120 × 0.12 = £14.40.",
            difficulty: 3,
          },
          {
            key: "rp-y8-10",
            kind: "number",
            prompt: "A recipe says 240 g of rice serves 3 people. A cook has 1.5 kg of rice. What is the greatest number of people that can be served?",
            answer: 18,
            explanation: "Each person needs 240 ÷ 3 = 80 g. 1.5 kg is 1,500 g and 1,500 ÷ 80 = 18.75. You cannot serve part of a person, so round down to 18.",
            difficulty: 3,
          },
        ],
      },
      flashcards: [
        { front: "What does direct proportion mean?", back: "When one quantity doubles, the other doubles too (they stay in the same ratio)" },
        { front: "What is the unitary method?", back: "Find the value of ONE item first, then multiply up" },
        { front: "How do you find the best buy?", back: "Work out the cost per unit (e.g. per 100 g) for each and pick the lowest" },
        { front: "Map scale 1 : 25,000 means ...", back: "1 cm on the map is 25,000 cm (250 m) in real life" },
        { front: "Convert 100,000 cm to km", back: "1 km (÷ 100 for metres, ÷ 1,000 for km)" },
        { front: "If y is directly proportional to x, the formula is ...", back: "y = kx (k is a fixed number)" },
        { front: "The graph of direct proportion is ...", back: "A straight line through the origin (0, 0)" },
        { front: "£1 = €1.10. How do you change pounds to euros?", back: "Multiply by 1.10" },
        { front: "Recipe for 2 uses 100 g. Amount for 5?", back: "250 g (50 g per person × 5)" },
      ],
    },
    9: {
      year: 9,
      objectives: [
        "Solve problems involving inverse proportion.",
        "Use compound measures such as speed, density and rates of pay.",
        "Convert between units of speed and use distance-time graphs.",
        "Use proportional reasoning to solve multi-step problems.",
      ],
      note: {
        title: "Year 9: compound measures and inverse proportion",
        body: `## What you need to know

- **Speed = distance ÷ time.** Rearranged: distance = speed × time and time = distance ÷ speed.
- **Density = mass ÷ volume.** Units are g/cm³ if mass is in g and volume in cm³.
- **Average speed = total distance ÷ total time.** It is NOT the average of the speeds.
- **Inverse proportion:** as one quantity goes up, the other goes down so that their product stays the same. If y is inversely proportional to x, then xy = k.
- To convert m/s to km/h, multiply by 3.6 (and divide by 3.6 to go the other way).

## Worked example 1: speed

A train travels 240 km in 3 hours. Speed = 240 ÷ 3 = **80 km/h**. How long for 400 km at that speed? 400 ÷ 80 = 5 hours.

## Worked example 2: density

A metal block has mass 96 g and volume 12 cm³. Density = 96 ÷ 12 = **8 g/cm³**.

## Worked example 3: inverse proportion

3 pumps empty a tank in 8 hours. That is 3 × 8 = 24 pump-hours of work. With 6 pumps: 24 ÷ 6 = **4 hours**.

| m/s | km/h |
| --- | --- |
| 10 | 36 |
| 25 | 90 |`,
      },
      quiz: {
        title: "Ratio & Proportion: Year 9 quiz",
        questions: [
          {
            key: "rp-y9-01",
            kind: "number",
            prompt: "A car travels 150 km in 3 hours. What is its average speed in km/h?",
            answer: 50,
            explanation: "Speed = distance ÷ time = 150 ÷ 3 = 50 km/h.",
            difficulty: 1,
          },
          {
            key: "rp-y9-02",
            kind: "single",
            prompt: "Which formula correctly links density, mass and volume?",
            options: ["density = mass ÷ volume", "density = volume ÷ mass", "density = mass × volume", "density = mass − volume"],
            answer: "density = mass ÷ volume",
            explanation: "Density tells you how much mass is packed into each unit of volume, so density = mass ÷ volume.",
            difficulty: 1,
          },
          {
            key: "rp-y9-03",
            kind: "number",
            prompt: "A cyclist rides at a steady 40 km/h for 2.5 hours. How far does the cyclist travel, in km?",
            answer: 100,
            explanation: "Distance = speed × time = 40 × 2.5 = 100 km.",
            difficulty: 1,
          },
          {
            key: "rp-y9-04",
            kind: "number",
            prompt: "The graph shows a van's journey from a depot. What is the van's speed, in km/h, in the first hour?",
            answer: 24,
            explanation: "In the first hour the line rises from 0 km to 24 km. Speed = distance ÷ time = 24 ÷ 1 = 24 km/h.",
            difficulty: 2,
            image: { file: "rp-y9-distance-time.png", alt: "A distance-time graph with time in hours along the bottom and distance from the depot in km up the side. The line rises to 24 km at 1 hour, goes flat until 1.5 hours, then falls back to 0 km at 2 hours." },
          },
          {
            key: "rp-y9-05",
            kind: "number",
            prompt: "Look at the same distance-time graph. For how many minutes was the van stationary?",
            answer: 30,
            explanation: "A flat section on a distance-time graph means no movement. It lasts from 1 hour to 1.5 hours, which is 0.5 hours = 30 minutes.",
            difficulty: 2,
            image: { file: "rp-y9-distance-time.png", alt: "A distance-time graph with time in hours along the bottom and distance from the depot in km up the side. The line rises to 24 km at 1 hour, goes flat until 1.5 hours, then falls back to 0 km at 2 hours." },
          },
          {
            key: "rp-y9-06",
            kind: "number",
            prompt: "A metal block has mass 540 g and volume 200 cm³. What is its density in g/cm³?",
            answer: 2.7,
            explanation: "Density = mass ÷ volume = 540 ÷ 200 = 2.7 g/cm³.",
            difficulty: 2,
            diagnostic: true,
          },
          {
            key: "rp-y9-07",
            kind: "single",
            prompt: "4 workers take 6 days to paint a fence. All workers work at the same rate. How long would 3 workers take?",
            options: ["4.5 days", "8 days", "6 days", "12 days"],
            answer: "8 days",
            explanation: "This is inverse proportion: fewer workers take longer. The job is 4 × 6 = 24 worker-days, so 3 workers need 24 ÷ 3 = 8 days.",
            difficulty: 2,
            diagnostic: true,
          },
          {
            key: "rp-y9-08",
            kind: "single",
            prompt: "Change 72 km/h into metres per second.",
            options: ["72 m/s", "7.2 m/s", "20 m/s", "259.2 m/s"],
            answer: "20 m/s",
            explanation: "72 km/h = 72,000 m in 3,600 s. Divide: 72,000 ÷ 3,600 = 20 m/s (the same as 72 ÷ 3.6).",
            difficulty: 2,
          },
          {
            key: "rp-y9-09",
            kind: "number",
            prompt: "A journey has two parts: 60 km at 40 km/h, then 60 km at 60 km/h. What is the average speed, in km/h, for the whole journey?",
            answer: 48,
            explanation: "Times: 60 ÷ 40 = 1.5 h and 60 ÷ 60 = 1 h, so 2.5 h in total. Average speed = 120 km ÷ 2.5 h = 48 km/h, not the mean of 40 and 60.",
            difficulty: 3,
          },
          {
            key: "rp-y9-10",
            kind: "single",
            prompt: "y is inversely proportional to x. When x = 3, y = 20. What is y when x = 12?",
            options: ["80", "17", "8", "5"],
            answer: "5",
            explanation: "For inverse proportion xy stays the same: 3 × 20 = 60. When x = 12, y = 60 ÷ 12 = 5.",
            difficulty: 3,
          },
        ],
      },
      flashcards: [
        { front: "Speed formula", back: "speed = distance ÷ time" },
        { front: "Distance formula", back: "distance = speed × time" },
        { front: "Time formula", back: "time = distance ÷ speed" },
        { front: "Density formula", back: "density = mass ÷ volume" },
        { front: "Average speed for a whole journey", back: "Total distance ÷ total time" },
        { front: "m/s to km/h", back: "Multiply by 3.6" },
        { front: "km/h to m/s", back: "Divide by 3.6" },
        { front: "What does a flat line on a distance-time graph mean?", back: "The object is not moving (stationary)" },
        { front: "What is inverse proportion?", back: "As one quantity increases the other decreases, and their product stays the same (xy = k)" },
        { front: "8 machines take 3 days. How long do 12 machines take?", back: "2 days (8 × 3 = 24; 24 ÷ 12 = 2)" },
      ],
    },
  },
};
