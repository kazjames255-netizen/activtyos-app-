// GCSE Maths — Ratio & Proportion (Years 10–11). Original content aligned to the DfE GCSE mathematics subject content (OGL v3.0).
// Answer keys are recomputed by _check_m3.ts — re-run it after ANY edit here.
import type { CTopic } from "../types";

export const TOPIC: CTopic = {
  key: "rp",
  topic: "Ratio & Proportion",
  subject: "Maths",
  years: {
    10: {
      year: 10,
      objectives: [
        "Simplify ratios and share a quantity in a given ratio; use ratios to compare and to find missing amounts.",
        "Solve direct proportion problems and compare value for money (best buys).",
        "Calculate percentage increase and decrease, and reverse percentage problems.",
        "Use compound measures: speed, density and pressure, and convert units.",
        "Combine two ratios, such as A:B and B:C, into A:B:C.",
      ],
      note: {
        title: "Year 10 Ratio & Proportion: ratios, percentage change and compound measures",
        body: `## What you need to know

**Ratio.** A ratio compares parts. To share in a ratio, add the parts, divide the total by that number to get **one part**, then multiply. To simplify, divide every part by a common factor.

**Direct proportion.** When one quantity doubles, so does the other. Use the **unitary method**: find the value of one, then scale up.

**Percentage change.** Use multipliers. Increase by 12% → × 1.12. Decrease by 30% → × 0.7. Percentage change = (change ÷ original) × 100. For **reverse percentages**, divide by the multiplier.

**Compound measures.**
- speed = distance ÷ time
- density = mass ÷ volume
- pressure = force ÷ area

## Worked example 1: sharing
Share £120 in the ratio 5 : 3. Total parts 8, one part £15, so the shares are **£75 and £45**.

## Worked example 2: reverse percentage
A coat costs £54 after a 10% reduction. £54 is 90% of the original, so the original is 54 ÷ 0.9 = **£60**.

## Worked example 3: unit conversion
36 km/h → m/s: 36 000 m ÷ 3600 s = **10 m/s**.

| Quantity | Formula |
| --- | --- |
| Speed | distance ÷ time |
| Density | mass ÷ volume |
| Pressure | force ÷ area |
| % change | change ÷ original × 100 |`,
      },
      quiz: {
        title: "Ratio & Proportion: Year 10 GCSE quiz",
        questions: [
          {
            key: "rp-y10-01", kind: "single", difficulty: 1,
            prompt: "Write the ratio 24 : 36 in its simplest form.",
            options: ["12 : 18", "4 : 6", "2 : 3", "3 : 2"],
            answer: "2 : 3",
            explanation: "Divide both parts by their highest common factor, 12: 24 ÷ 12 = 2 and 36 ÷ 12 = 3.",
          },
          {
            key: "rp-y10-02", kind: "number", difficulty: 1,
            prompt: "Share £150 in the ratio 2 : 3. How much is the larger share, in pounds?",
            answer: 90,
            explanation: "There are 2 + 3 = 5 parts. One part is 150 ÷ 5 = £30. The larger share is 3 × 30 = £90.",
          },
          {
            key: "rp-y10-03", kind: "number", difficulty: 1,
            prompt: "Increase £80 by 15%. Give your answer in pounds.",
            answer: 92,
            explanation: "The multiplier for a 15% increase is 1.15, so 80 × 1.15 = £92.",
          },
          {
            key: "rp-y10-04", kind: "number", difficulty: 2, diagnostic: true, tolerance: 0.01,
            prompt: "A car travels 156 km in 2 hours 30 minutes. What is its average speed in km/h?",
            answer: 62.4,
            explanation: "2 hours 30 minutes = 2.5 hours. Speed = distance ÷ time = 156 ÷ 2.5 = 62.4 km/h.",
          },
          {
            key: "rp-y10-05", kind: "number", difficulty: 2, diagnostic: true, tolerance: 0.01,
            prompt: "A metal block has mass 450 g and volume 60 cm³. What is its density in g/cm³?",
            answer: 7.5,
            explanation: "Density = mass ÷ volume = 450 ÷ 60 = 7.5 g/cm³.",
          },
          {
            key: "rp-y10-06", kind: "number", difficulty: 2,
            prompt: "The price of a bike falls from £250 to £205. Work out the percentage decrease. Type the number only, without the % sign.",
            answer: 18,
            explanation: "The change is £45. Percentage decrease = 45 ÷ 250 × 100 = 18%.",
          },
          {
            key: "rp-y10-07", kind: "single", difficulty: 2,
            prompt: "Which rice is the best value for money?",
            options: ["500 g for £1.60", "1.2 kg for £3.60", "750 g for £2.31", "They all cost the same per kg"],
            answer: "1.2 kg for £3.60",
            explanation: "Compare the price per kg: £1.60 ÷ 0.5 = £3.20; £2.31 ÷ 0.75 = £3.08; £3.60 ÷ 1.2 = £3.00. The lowest price per kg is the best buy.",
          },
          {
            key: "rp-y10-08", kind: "number", difficulty: 2,
            prompt: "Red and blue counters are in the ratio 3 : 5. There are 24 red counters. How many blue counters are there?",
            answer: 40,
            explanation: "3 parts = 24, so 1 part = 8. Blue is 5 parts: 5 × 8 = 40.",
          },
          {
            key: "rp-y10-09", kind: "number", difficulty: 2, tolerance: 0.001,
            prompt: "5 pens cost £3.20. How much do 8 pens cost, in pounds?",
            answer: 5.12,
            explanation: "Unitary method: one pen costs 3.20 ÷ 5 = £0.64. Eight pens cost 8 × 0.64 = £5.12.",
          },
          {
            key: "rp-y10-10", kind: "number", difficulty: 3,
            prompt: "In a sale, a jacket is reduced by 20% to £68. What was the original price, in pounds?",
            answer: 85,
            explanation: "After a 20% reduction the price is 80% of the original. So original = 68 ÷ 0.8 = £85.",
          },
          {
            key: "rp-y10-11", kind: "number", difficulty: 3,
            prompt: "Ann : Ben = 2 : 3 and Ben : Cat = 4 : 5. The three of them share £175 in the ratio Ann : Ben : Cat. How much does Cat get, in pounds?",
            answer: 75,
            explanation: "Make Ben the same in both ratios: 2 : 3 = 8 : 12 and 4 : 5 = 12 : 15. So Ann : Ben : Cat = 8 : 12 : 15 (35 parts). One part is 175 ÷ 35 = £5, so Cat gets 15 × 5 = £75.",
          },
          {
            key: "rp-y10-12", kind: "number", difficulty: 3,
            prompt: "A cyclist travels at a steady 18 km/h. How many metres does she travel in 40 seconds?",
            answer: 200,
            explanation: "18 km/h = 18 000 m ÷ 3600 s = 5 m/s. In 40 seconds she travels 5 × 40 = 200 m.",
          },
          {
            key: "rp-y10-13", kind: "written", difficulty: 3, marks: 3,
            prompt: "Shop A sells a pair of jeans for £60 with 25% off. Shop B sells the same jeans for £75 with one third off. Which shop is cheaper, and by how much? Show your working.",
            answer: "Shop A: £45. Shop B: £50. Shop A is cheaper by £5.",
            explanation: "Mark scheme (3 marks): 1 for £60 × 0.75 = £45; 1 for £75 × 2/3 = £50; 1 for the conclusion that Shop A is cheaper by £5.",
          },
        ],
      },
      flashcards: [
        { front: "How do you share a total in a ratio?", back: "Add the parts, divide the total by that to find one part, then multiply by each ratio number." },
        { front: "Multiplier for an increase of 12%", back: "1.12" },
        { front: "Multiplier for a decrease of 30%", back: "0.7" },
        { front: "Percentage change formula", back: "(change ÷ original) × 100" },
        { front: "Reverse percentage method", back: "Divide the new amount by the multiplier to find the original." },
        { front: "Speed formula", back: "speed = distance ÷ time" },
        { front: "Density formula", back: "density = mass ÷ volume" },
        { front: "Pressure formula", back: "pressure = force ÷ area" },
        { front: "km/h to m/s", back: "Divide by 3.6 (× 1000 ÷ 3600)." },
        { front: "Unitary method", back: "Find the value of one item, then multiply to get the amount you need." },
        { front: "Best buy", back: "Work out the price per unit (e.g. per 100 g or per kg); the lowest is best." },
        { front: "Combining A : B and B : C", back: "Make the B parts equal, then write A : B : C." },
      ],
    },
    11: {
      year: 11,
      objectives: [
        "Solve problems involving repeated percentage change: compound interest, growth and decay.",
        "Work with direct and inverse proportion, including y ∝ x² and y ∝ 1/x².",
        "Set up and use equations for proportional relationships (y = kx, y = k/x).",
        "Interpret gradients of graphs as rates of change, including average speed.",
        "Solve reverse repeated-percentage problems and find how long growth takes.",
      ],
      note: {
        title: "Year 11 Ratio & Proportion: growth, decay and inverse proportion",
        body: `## What you need to know

**Repeated percentage change.** Apply the multiplier once for each period:
**final = start × (multiplier)ⁿ**. A 4% rise gives 1.04; a 7% fall gives 0.93. Compound interest is growth; depreciation is decay. To reverse, **divide** by the multiplier the same number of times.

**Proportion with equations.**
- Direct: y = kx. Inverse: y = k/x.
- y ∝ x² means y = kx²; y ∝ 1/x² means y = k/x².
- Find k from one pair of values, then use it.

**Rates of change.** On a distance–time graph the **gradient is the speed**. Average rate = total change ÷ total time.

**Trap:** a 20% rise followed by a 20% fall is not back to the start: 1.2 × 0.8 = 0.96.

## Worked example 1: compound interest
£2000 at 4% for 3 years: 2000 × 1.04³ = 2000 × 1.124864 = **£2249.73**.

## Worked example 2: inverse proportion
8 workers take 6 days, so the job takes 48 worker-days. With 12 workers: 48 ÷ 12 = **4 days**.

## Worked example 3: y ∝ x²
y = 20 when x = 2 gives k = 5, so y = 5x². When x = 3, y = **45**.

| Relationship | Equation |
| --- | --- |
| Direct | y = kx |
| Inverse | y = k/x |
| Square | y = kx² |
| Growth or decay | start × multiplierⁿ |`,
      },
      quiz: {
        title: "Ratio & Proportion: Year 11 GCSE quiz",
        questions: [
          {
            key: "rp-y11-01", kind: "number", difficulty: 1, tolerance: 0.0001,
            prompt: "What is the multiplier for an 8% increase?",
            answer: 1.08,
            explanation: "100% + 8% = 108% = 1.08.",
          },
          {
            key: "rp-y11-02", kind: "number", difficulty: 1, tolerance: 0.0001,
            prompt: "What is the multiplier for a 15% decrease?",
            answer: 0.85,
            explanation: "100% − 15% = 85% = 0.85.",
          },
          {
            key: "rp-y11-03", kind: "number", difficulty: 1,
            prompt: "y is directly proportional to x, so y = kx. When x = 4, y = 20. What is k?",
            answer: 5,
            explanation: "Substitute the pair into y = kx: 20 = k × 4, so k = 5.",
          },
          {
            key: "rp-y11-04", kind: "number", difficulty: 2, diagnostic: true,
            prompt: "£2500 is invested at 3% compound interest per year. How much is it worth after 4 years, to the nearest pound? Type your answer as digits with no comma.",
            answer: 2814,
            explanation: "Multiply by 1.03 four times: 2500 × 1.03⁴ = 2500 × 1.1255… = 2813.77, which is £2814 to the nearest pound.",
          },
          {
            key: "rp-y11-05", kind: "number", difficulty: 2, diagnostic: true,
            prompt: "A car worth £14 000 loses 12% of its value each year. What is it worth after 3 years, to the nearest pound? Type your answer as digits with no comma.",
            answer: 9541,
            explanation: "The multiplier is 0.88. So the value is 14 000 × 0.88³ = 14 000 × 0.681472 = 9540.6, or £9541 to the nearest pound.",
          },
          {
            key: "rp-y11-06", kind: "number", difficulty: 2,
            prompt: "6 workers take 10 days to build a wall. Working at the same rate, how many days would 4 workers take?",
            answer: 15,
            explanation: "This is inverse proportion. The job is 6 × 10 = 60 worker-days, and 60 ÷ 4 = 15 days.",
          },
          {
            key: "rp-y11-07", kind: "single", difficulty: 2,
            prompt: "y is directly proportional to x². When x = 5, y = 50. Which equation connects y and x?",
            options: ["y = 10x", "y = 5x²", "y = x² + 25", "y = 2x²"],
            answer: "y = 2x²",
            explanation: "Write y = kx² and substitute: 50 = k × 25, so k = 2. The equation is y = 2x².",
          },
          {
            key: "rp-y11-08", kind: "number", difficulty: 2,
            prompt: "The price of a games console rises by 10% and then falls by 10%. What is the overall percentage change? Type the number only, without the % sign, and use a minus sign for a decrease.",
            answer: -1,
            explanation: "Multipliers: 1.1 × 0.9 = 0.99. That is 99% of the original, an overall decrease of 1%.",
          },
          {
            key: "rp-y11-09", kind: "number", difficulty: 2,
            prompt: "A train is 30 km from its start at 2 pm and 120 km from its start at 3:30 pm. What is its average speed in km/h?",
            answer: 60,
            explanation: "It travels 90 km in 1.5 hours. Average speed = 90 ÷ 1.5 = 60 km/h (the gradient of the distance–time graph).",
          },
          {
            key: "rp-y11-10", kind: "number", difficulty: 3,
            prompt: "An account earns 5% compound interest per year. After 3 years it holds £1157.63. How much was originally invested, in pounds? Type your answer as digits with no comma.",
            answer: 1000,
            explanation: "After 3 years the balance is original × 1.05³ = original × 1.157625. So original = 1157.63 ÷ 1.157625 = £1000.",
          },
          {
            key: "rp-y11-11", kind: "number", difficulty: 3,
            prompt: "y is inversely proportional to x². When x = 3, y = 4. Find y when x = 6.",
            answer: 1,
            explanation: "Write y = k/x². Then 4 = k/9, so k = 36. When x = 6: y = 36/36 = 1.",
          },
          {
            key: "rp-y11-12", kind: "number", difficulty: 3,
            prompt: "£1000 is invested at 6% compound interest per year. What is the smallest whole number of years after which the balance is more than £1500?",
            answer: 7,
            explanation: "Try powers of 1.06: 1.06⁶ = 1.4185 (£1418.52, not enough) and 1.06⁷ = 1.5036 (£1503.63, enough). So 7 years.",
          },
          {
            key: "rp-y11-13", kind: "written", difficulty: 3, marks: 4,
            prompt: "A scooter costs £1200 new and loses 15% of its value each year. (a) Show that it is worth £867 after 2 years. (b) After how many whole years does its value first fall below £500? Show your working.",
            answer: "(a) 1200 × 0.85² = 867. (b) 6 years (0.85⁵ × 1200 = £532.45; 0.85⁶ × 1200 = £452.58).",
            explanation: "Mark scheme (4 marks): 1 for multiplier 0.85; 1 for 1200 × 0.85² = 867; 1 for testing years by repeated multiplication (year 5 = £532.45, still above £500); 1 for year 6 = £452.58 and the answer 6 years.",
          },
        ],
      },
      flashcards: [
        { front: "Compound growth or decay formula", back: "final = start × (multiplier)ⁿ, where n is the number of periods." },
        { front: "Multiplier for +7% per year", back: "1.07" },
        { front: "Multiplier for −9% per year", back: "0.91" },
        { front: "Reversing repeated percentage change", back: "Divide by the multiplier the same number of times." },
        { front: "Direct proportion equation", back: "y = kx (a straight line through the origin)." },
        { front: "Inverse proportion equation", back: "y = k/x (xy is constant)." },
        { front: "y is proportional to x²", back: "y = kx²" },
        { front: "y is inversely proportional to x²", back: "y = k/x²" },
        { front: "How do you find k?", back: "Substitute a known pair of values into the equation and solve." },
        { front: "Gradient of a distance–time graph", back: "Speed." },
        { front: "Average rate of change", back: "Total change ÷ total time." },
        { front: "A 20% rise then a 20% fall", back: "Overall × 0.96, a 4% fall (not zero)." },
      ],
    },
  },
};
