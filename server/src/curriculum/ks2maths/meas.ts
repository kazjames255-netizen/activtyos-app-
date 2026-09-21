// KS2 Maths — Measurement (Years 3–6). Original content aligned to the DfE programme of study
// (Open Government Licence v3.0). Every computed answer is re-derived independently by
// _check_k3.ts — run it after ANY edit. Pictures live in scratch/curriculum-images/ks2maths/.
import type { CTopic } from "../types";

const IMG = {
  clockRoman: { file: "meas-clock-roman.png", alt: "An analogue clock with Roman numerals I to XII. The short, thick hour hand points between IV and V, closer to V. The long, thin blue minute hand points at VII." },
  ruler: { file: "meas-ruler-pencil.png", alt: "A ruler marked in centimetres from 0 to 12 with millimetre marks. A pencil lies just above it: the flat end of the pencil is lined up with the 2 cm mark and the sharp tip is lined up with the 9 cm mark, shown by dashed guide lines." },
  jugMl: { file: "meas-jug-ml.png", alt: "A measuring jug with a scale in millilitres on its left side: marks every 50 ml, numbered 100, 200, 300, 400 and 500. The water surface is exactly halfway between the 300 mark and the 400 mark." },
  rect: { file: "meas-rectangle-8x5.png", alt: "A rectangle. The bottom side is labelled 8 centimetres and the left side is labelled 5 centimetres. The other two sides are not labelled." },
  gridArea: { file: "meas-grid-area.png", alt: "A shape drawn on a square grid, where each small square has an area of 1 square centimetre. The shape is a staircase: the top row has 2 shaded squares, the next row 4, and the bottom two rows 6 squares each, all lined up at the left edge." },
  gridPerim: { file: "meas-grid-perimeter.png", alt: "A U-shaped figure on a square grid where each square has sides of 1 centimetre. It is 5 squares wide and 3 squares tall, with a gap 1 square wide and 2 squares deep cut out of the middle of the top edge." },
  clockEvening: { file: "meas-clock-evening.png", alt: "An analogue clock with numbers 1 to 12. The short, thick hour hand points close to the 8, just before it. The long, thin blue minute hand points at the 10." },
  compPerim: { file: "meas-composite-perimeter.png", alt: "An L-shaped figure made only of right angles. The top edge is 4 cm, the whole left edge is 8 cm, the whole bottom edge is 10 cm and the short right-hand edge at the bottom is 3 cm. The two edges that make the inside corner of the L are not labelled." },
  jugLitres: { file: "meas-jug-litres.png", alt: "A measuring jug with a scale in litres on its left side: small marks every quarter of a litre, numbered 0.5, 1, 1.5 and 2. The water surface is on the mark halfway between 1.5 and 2." },
  compArea: { file: "meas-composite-area.png", alt: "A shape made only of right angles: a rectangle 12 metres wide and 8 metres tall with a smaller rectangle cut out of its bottom right corner. The cut-out is 5 metres wide and 3 metres tall. The top edge is labelled 12 m and the left edge 8 m." },
  parallelogram: { file: "meas-parallelogram.png", alt: "A parallelogram with a horizontal bottom side of 9 cm and a slanted left side of 5 cm. A dashed red line drops straight down from the top-left corner to the bottom side, meeting it at a right angle, and is labelled 4 cm." },
  triangle: { file: "meas-triangle.png", alt: "A triangle with a horizontal base of 14 cm. The left slanted side is 13 cm and the right slanted side is 15 cm. A dashed red line goes straight down from the top corner to the base at a right angle and is labelled 12 cm." },
  cuboid: { file: "meas-cuboid.png", alt: "A cuboid (a box shape) drawn in perspective. The bottom front edge is labelled 8 cm, the vertical front edge 3 cm and the edge going back into the picture 5 cm." },
};

export const TOPIC: CTopic = {
  key: "meas",
  topic: "Measurement",
  subject: "Maths",
  years: {
    // ───────────────────────────── YEAR 3 ─────────────────────────────
    3: {
      year: 3,
      objectives: [
        "Measure, compare, add and subtract lengths (m/cm/mm), mass (kg/g) and volume/capacity (l/ml)",
        "Measure the perimeter of simple 2-D shapes",
        "Add and subtract amounts of money to give change, using pounds and pence",
        "Tell and write the time from an analogue clock, including Roman numerals I to XII, and 12-hour and 24-hour clocks",
      ],
      note: {
        title: "Length, mass, capacity, money and time",
        body: `## Units to know

| Measure | Units | Remember |
| --- | --- | --- |
| Length | mm, cm, m | 1 cm = 10 mm, 1 m = 100 cm |
| Mass | g, kg | 1 kg = 1,000 g |
| Capacity | ml, l | 1 litre = 1,000 ml |

The **perimeter** of a shape is the distance all the way round its edges: add up the length of every side.

## Time and money

- On an analogue clock the **short hand** shows the hour and the **long hand** shows the minutes. Each number the long hand passes is 5 more minutes.
- Roman numerals on clocks: I = 1, V = 5, X = 10, so IV = 4, VII = 7 and XII = 12.
- In **24-hour time**, times after midday add 12 to the hour: 4:15 pm is 16:15.
- To give **change**, count up from the price to the amount paid.

## Worked examples

**1. Reading a ruler.** A pencil starts at 3 cm and ends at 11 cm. Its length is 11 − 3 = **8 cm**, not 11 cm.

**2. Change.** A comic costs £2.70 and Ravi pays with £5. Count up: 30p makes £3, then £2 more makes £5. Change = £2 + 30p = **£2.30**.

**3. Perimeter.** A rectangle is 7 cm by 3 cm. Its sides are 7, 3, 7 and 3, so the perimeter is 7 + 3 + 7 + 3 = **20 cm**.`,
      },
      quiz: {
        title: "Year 3 Measurement quiz",
        questions: [
          {
            key: "meas-y3-01",
            kind: "single",
            prompt: "What time does the clock show?",
            options: ["7:20", "4:35", "5:35", "4:07"],
            answer: "4:35",
            explanation: "The short hour hand has passed IV, so it is after 4 o'clock. The long minute hand points at VII, which is 7 × 5 = 35 minutes past: 4:35.",
            difficulty: 1,
            diagnostic: true,
            image: IMG.clockRoman,
          },
          {
            key: "meas-y3-02",
            kind: "multi",
            prompt: "Which of these units can be used to measure length? Select all that apply.",
            options: ["mm", "cm", "kg", "m", "ml"],
            answer: ["mm", "cm", "m"],
            explanation: "Millimetres, centimetres and metres all measure length. Kilograms measure mass and millilitres measure capacity.",
            difficulty: 1,
          },
          {
            key: "meas-y3-03",
            kind: "single",
            prompt: "The pencil is lined up with the ruler as shown. How long is the pencil?",
            options: ["9 cm", "7 cm", "11 cm", "6 cm"],
            answer: "7 cm",
            explanation: "The pencil starts at the 2 cm mark, not at 0. Subtract the start from the end: 9 − 2 = 7 cm.",
            difficulty: 2,
            image: IMG.ruler,
          },
          {
            key: "meas-y3-04",
            kind: "number",
            prompt: "How many millilitres of water are in the jug?",
            answer: 350,
            explanation: "The marks go up in 50s. The water level is one mark above 300 ml, so it is 300 + 50 = 350 ml.",
            difficulty: 2,
            image: IMG.jugMl,
          },
          {
            key: "meas-y3-05",
            kind: "single",
            prompt: "A bag of flour has a mass of 1 kg. Ben uses 350 g. How much flour is left?",
            options: ["750 g", "1,350 g", "350 g", "650 g"],
            answer: "650 g",
            explanation: "1 kg is 1,000 g. Take away the flour Ben used: 1,000 − 350 = 650 g.",
            difficulty: 2,
          },
          {
            key: "meas-y3-06",
            kind: "single",
            prompt: "Amy buys a book for £3.40 and pays with a £5 note. How much change should she get?",
            options: ["£1.60", "£2.40", "£2.60", "£1.40"],
            answer: "£1.60",
            explanation: "Count up from £3.40: 60p makes £4, then £1 more makes £5. That is £1 + 60p = £1.60.",
            difficulty: 1,
            diagnostic: true,
          },
          {
            key: "meas-y3-07",
            kind: "single",
            prompt: "What is the perimeter of this rectangle?",
            options: ["13 cm", "40 cm", "26 cm", "18 cm"],
            answer: "26 cm",
            explanation: "Opposite sides of a rectangle are equal, so the four sides are 8, 5, 8 and 5. Add them: 8 + 5 + 8 + 5 = 26 cm.",
            difficulty: 2,
            image: IMG.rect,
          },
          {
            key: "meas-y3-08",
            kind: "single",
            prompt: "A train leaves at 10:45 am. The journey takes 1 hour 35 minutes. What time does the train arrive?",
            options: ["12:10 pm", "1:20 pm", "11:20 am", "12:20 pm"],
            answer: "12:20 pm",
            explanation: "Add 1 hour to get 11:45. Then add 35 minutes: 15 minutes reach 12:00 and 20 more make 12:20 pm.",
            difficulty: 3,
          },
          {
            key: "meas-y3-09",
            kind: "number",
            prompt: "A ribbon is 2 m long. Kai cuts off 3 pieces that are each 45 cm long. How many centimetres of ribbon are left?",
            answer: 65,
            explanation: "2 m is 200 cm. Three pieces use 3 × 45 = 135 cm, so 200 − 135 = 65 cm are left.",
            difficulty: 3,
          },
          {
            key: "meas-y3-10",
            kind: "single",
            prompt: "Which of these is 6:30 pm written in 24-hour time?",
            options: ["06:30", "16:30", "18:30", "08:30"],
            answer: "18:30",
            explanation: "In 24-hour time, pm times add 12 to the hour. 6 + 12 = 18, so 6:30 pm is 18:30.",
            difficulty: 2,
          },
        ],
      },
      flashcards: [
        { front: "How many centimetres are in 1 metre?", back: "100 cm" },
        { front: "How many millimetres are in 1 centimetre?", back: "10 mm" },
        { front: "How many grams are in 1 kilogram?", back: "1,000 g" },
        { front: "How many millilitres are in 1 litre?", back: "1,000 ml" },
        { front: "What is perimeter?", back: "The distance all the way round the edge of a shape. Add up every side." },
        { front: "How do you work out change?", back: "Count up from the price to the amount paid, or subtract the price from the amount paid." },
        { front: "Which hand shows the hours on an analogue clock?", back: "The short hand. The long hand shows the minutes." },
        { front: "If the minute hand points at 9, how many minutes past is it?", back: "9 × 5 = 45 minutes past the hour." },
        { front: "Roman numerals: what are IV, VII and XII?", back: "IV = 4, VII = 7 and XII = 12 (I = 1, V = 5, X = 10)." },
        { front: "How do you write 4:15 pm in 24-hour time?", back: "Add 12 to the hour: 16:15." },
      ],
    },

    // ───────────────────────────── YEAR 4 ─────────────────────────────
    4: {
      year: 4,
      objectives: [
        "Convert between different units of measure, for example kilometres to metres and hours to minutes",
        "Measure and calculate the perimeter of a rectilinear figure (including squares) in centimetres and metres",
        "Find the area of rectilinear shapes by counting squares",
        "Estimate, compare and calculate different measures, including money in pounds and pence",
        "Read, write and convert time between analogue and digital 12- and 24-hour clocks",
      ],
      note: {
        title: "Converting units, perimeter, area and time",
        body: `## Converting units

To change to a **smaller unit** you multiply; to a **larger unit** you divide.

- 1 km = 1,000 m
- 1 hour = 60 minutes, 1 minute = 60 seconds
- 1 week = 7 days, 1 year = 12 months

## Perimeter and area

A **rectilinear** shape has only straight sides that meet at right angles. The **perimeter** is the distance around the outside. The **area** is the amount of flat space inside, measured in **square centimetres (cm²)** when each square has sides of 1 cm. To find the area of a shape on a grid, count the squares.

## Time

Analogue and digital clocks show the same time. In **24-hour time**, add 12 to pm hours (8:25 pm = 20:25) and subtract 12 to go back (22:15 = 10:15 pm).

## Worked examples

**1. Units.** 4 km in metres: 4 × 1,000 = **4,000 m**.

**2. Area by counting.** A staircase shape has rows of 1, 3, 5 and 5 squares. Area = 1 + 3 + 5 + 5 = **14 cm²**.

**3. Time.** A film starts at 1:40 pm and ends at 4:10 pm. From 1:40 to 2:00 is 20 minutes, from 2:00 to 4:00 is 2 hours and then 10 minutes more: **2 hours 30 minutes**.`,
      },
      quiz: {
        title: "Year 4 Measurement quiz",
        questions: [
          {
            key: "meas-y4-01",
            kind: "single",
            prompt: "How many metres are in 3 km?",
            options: ["300 m", "3,000 m", "30 m", "30,000 m"],
            answer: "3,000 m",
            explanation: "1 km is 1,000 m, so multiply by 1,000: 3 × 1,000 = 3,000 m.",
            difficulty: 1,
            diagnostic: true,
          },
          {
            key: "meas-y4-02",
            kind: "number",
            prompt: "How many minutes are there in 4 hours?",
            answer: 240,
            explanation: "1 hour is 60 minutes, so multiply: 4 × 60 = 240 minutes.",
            difficulty: 1,
          },
          {
            key: "meas-y4-03",
            kind: "single",
            prompt: "Each square on the grid is 1 cm². What is the area of the shaded shape?",
            options: ["16 cm²", "20 cm²", "24 cm²", "18 cm²"],
            answer: "18 cm²",
            explanation: "Count the squares row by row: 2 + 4 + 6 + 6 = 18 squares, so the area is 18 cm².",
            difficulty: 2,
            diagnostic: true,
            image: IMG.gridArea,
          },
          {
            key: "meas-y4-04",
            kind: "single",
            prompt: "Each square has sides of 1 cm. What is the perimeter of this shape?",
            options: ["20 cm", "16 cm", "13 cm", "18 cm"],
            answer: "20 cm",
            explanation: "Count every edge round the outside, including both sides and the bottom of the gap. The outer rectangle gives 5 + 3 + 5 + 3 = 16 cm and the gap adds 2 + 2 = 4 cm more: 20 cm.",
            difficulty: 2,
            image: IMG.gridPerim,
          },
          {
            key: "meas-y4-05",
            kind: "single",
            prompt: "The clock shows the time Mia goes to bed in the evening. What is this time in 24-hour time?",
            options: ["07:50", "20:10", "19:50", "18:50"],
            answer: "19:50",
            explanation: "The hour hand is just before 8 and the minute hand is at 10, so the time is 7:50 (ten to eight). In the evening, add 12 hours: 19:50.",
            difficulty: 2,
            image: IMG.clockEvening,
          },
          {
            key: "meas-y4-06",
            kind: "number",
            prompt: "A pencil costs 45p and a rubber costs 28p. Sam buys 3 pencils and 1 rubber. How much does he spend altogether? Give your answer in pounds, for example 2.50.",
            answer: 1.63,
            tolerance: 0.001,
            explanation: "3 pencils cost 3 × 45p = 135p. Add the rubber: 135 + 28 = 163p, which is £1.63.",
            difficulty: 2,
          },
          {
            key: "meas-y4-07",
            kind: "single",
            prompt: "What is 21:40 in 12-hour time?",
            options: ["8:40 pm", "9:40 pm", "9:40 am", "10:40 pm"],
            answer: "9:40 pm",
            explanation: "After 12:00, subtract 12 from the hour: 21 − 12 = 9. It is the evening, so the time is 9:40 pm.",
            difficulty: 2,
          },
          {
            key: "meas-y4-08",
            kind: "number",
            prompt: "How many centimetres are there in 2 m 35 cm?",
            answer: 235,
            explanation: "2 m is 200 cm. Add the extra 35 cm: 200 + 35 = 235 cm.",
            difficulty: 1,
          },
          {
            key: "meas-y4-09",
            kind: "single",
            prompt: "School starts at 8:50 am and finishes at 3:20 pm. How long is the school day?",
            options: ["7 hours 30 minutes", "6 hours 10 minutes", "5 hours 30 minutes", "6 hours 30 minutes"],
            answer: "6 hours 30 minutes",
            explanation: "From 8:50 to 9:00 is 10 minutes. From 9:00 am to 3:00 pm is 6 hours, then 20 minutes more to 3:20 pm. 10 + 20 = 30 minutes, so 6 hours 30 minutes.",
            difficulty: 3,
          },
          {
            key: "meas-y4-10",
            kind: "number",
            prompt: "Tom lives 1 km 250 m from school. He walks to school and back home each day. How many metres does he walk in 5 school days? Type your answer as digits with no comma.",
            answer: 12500,
            explanation: "1 km 250 m is 1,250 m. There and back is 2 × 1,250 = 2,500 m a day. Over 5 days: 5 × 2,500 = 12,500 m.",
            difficulty: 3,
          },
        ],
      },
      flashcards: [
        { front: "How many metres are in 1 kilometre?", back: "1,000 m" },
        { front: "How many minutes are in 1 hour? Seconds in 1 minute?", back: "60 minutes; 60 seconds." },
        { front: "How many days in a week? Months in a year?", back: "7 days; 12 months." },
        { front: "Converting to a smaller unit: multiply or divide?", back: "Multiply (there are more of the smaller units). To a larger unit, divide." },
        { front: "What is a rectilinear shape?", back: "A shape with only straight sides that all meet at right angles." },
        { front: "What is the perimeter of a rectangle 6 cm by 4 cm?", back: "6 + 4 + 6 + 4 = 20 cm." },
        { front: "How do you find the area of a shape on a square grid?", back: "Count the squares inside it. Each 1 cm square is 1 cm²." },
        { front: "What is the difference between perimeter and area?", back: "Perimeter is the distance around the edge (cm). Area is the space inside (cm²)." },
        { front: "How do you change 8:25 pm into 24-hour time?", back: "Add 12 to the hour: 20:25." },
        { front: "How do you change 22:15 into 12-hour time?", back: "Subtract 12 from the hour: 10:15 pm." },
        { front: "How do you change pence to pounds?", back: "Divide by 100. 148p = £1.48." },
      ],
    },

    // ───────────────────────────── YEAR 5 ─────────────────────────────
    5: {
      year: 5,
      objectives: [
        "Convert between different units of metric measure (km, m, cm, mm, kg, g, l, ml)",
        "Understand and use approximate equivalences between metric units and common imperial units such as inches, pounds and pints",
        "Measure and calculate the perimeter of composite rectilinear shapes in centimetres and metres",
        "Calculate the area of rectangles (including squares) using standard units, cm² and m²",
        "Estimate volume and capacity",
        "Solve problems converting between units of time and using all four operations with measures, including decimal quantities",
      ],
      note: {
        title: "Metric units, composite shapes, area and volume",
        body: `## Metric conversions

Move between units by multiplying or dividing by 10, 100 or 1,000.

- 1 kg = 1,000 g, 1 litre = 1,000 ml, 1 km = 1,000 m, 1 m = 100 cm
- 3.5 kg = 3.5 × 1,000 = 3,500 g

Some **imperial** units are still used. Useful approximations: 1 inch is about 2.5 cm, 1 pound is about 450 g and 1 litre is about 1¾ pints.

## Perimeter, area and volume

- **Composite** rectilinear shapes have missing sides. Work them out from the sides you are given, then add **all** the sides.
- **Area of a rectangle** = length × width, in cm² or m².
- **Volume** is the space a solid takes up. You can estimate it by counting 1 cm³ cubes. **Capacity** is how much a container can hold.

## Worked examples

**1. Composite perimeter.** An L-shape is 9 cm wide and 7 cm tall. Its top edge is 3 cm and its right edge is 2 cm. The missing sides are 9 − 3 = 6 cm and 7 − 2 = 5 cm. Perimeter = 3 + 5 + 6 + 2 + 9 + 7 = **32 cm**.

**2. Area with decimals.** A garden is 9 m by 5.5 m: 9 × 5.5 = **49.5 m²**.

**3. Measures.** A bag holds 3 kg and 1.2 kg is used: 3 − 1.2 = 1.8 kg = **1,800 g**.`,
      },
      quiz: {
        title: "Year 5 Measurement quiz",
        questions: [
          {
            key: "meas-y5-01",
            kind: "number",
            prompt: "How many grams are there in 2.5 kg? Type your answer as digits with no comma.",
            answer: 2500,
            explanation: "1 kg is 1,000 g, so multiply by 1,000: 2.5 × 1,000 = 2,500 g.",
            difficulty: 1,
            diagnostic: true,
          },
          {
            key: "meas-y5-02",
            kind: "single",
            prompt: "An inch is about 2.5 cm. About how many centimetres is 10 inches?",
            options: ["4 cm", "25 cm", "250 cm", "12.5 cm"],
            answer: "25 cm",
            explanation: "Multiply the number of inches by 2.5: 10 × 2.5 = 25 cm.",
            difficulty: 1,
          },
          {
            key: "meas-y5-03",
            kind: "single",
            prompt: "Every corner of this shape is a right angle. What is its perimeter?",
            options: ["25 cm", "36 cm", "50 cm", "44 cm"],
            answer: "36 cm",
            explanation: "Find the two missing sides: 10 − 4 = 6 cm across and 8 − 3 = 5 cm down. Add all six sides: 4 + 5 + 6 + 3 + 10 + 8 = 36 cm.",
            difficulty: 2,
            image: IMG.compPerim,
          },
          {
            key: "meas-y5-04",
            kind: "number",
            prompt: "A rectangular garden is 8 m long and 6.5 m wide. What is its area in m²?",
            answer: 52,
            explanation: "Area of a rectangle = length × width, so 8 × 6.5 = 52 m².",
            difficulty: 2,
            diagnostic: true,
          },
          {
            key: "meas-y5-05",
            kind: "single",
            prompt: "The jug's scale is in litres. How many millilitres of water are in the jug?",
            options: ["1,075 ml", "175 ml", "1,750 ml", "17,500 ml"],
            answer: "1,750 ml",
            explanation: "The water is on the mark halfway between 1.5 and 2, which is 1.75 litres. Multiply by 1,000 to change litres to millilitres: 1,750 ml.",
            difficulty: 2,
            image: IMG.jugLitres,
          },
          {
            key: "meas-y5-06",
            kind: "number",
            prompt: "How many minutes are there in 3¼ hours?",
            answer: 195,
            explanation: "3 hours is 3 × 60 = 180 minutes. A quarter of an hour is 15 minutes, so 180 + 15 = 195 minutes.",
            difficulty: 2,
          },
          {
            key: "meas-y5-07",
            kind: "single",
            prompt: "A recipe needs 0.75 kg of flour. Sam has a 2 kg bag. How many grams of flour are left after he takes out enough for the recipe?",
            options: ["1,750 g", "1.25 g", "2,750 g", "1,250 g"],
            answer: "1,250 g",
            explanation: "2 − 0.75 = 1.25 kg. Multiply by 1,000 to change kilograms to grams: 1,250 g.",
            difficulty: 2,
          },
          {
            key: "meas-y5-08",
            kind: "number",
            prompt: "A carton holds 1.5 litres of juice. How many 250 ml glasses can be filled from 3 cartons?",
            answer: 18,
            explanation: "3 cartons hold 3 × 1.5 = 4.5 litres, which is 4,500 ml. Each glass holds 250 ml, so 4,500 ÷ 250 = 18 glasses.",
            difficulty: 3,
          },
          {
            key: "meas-y5-09",
            kind: "single",
            prompt: "What is the area of this shape? All the corners are right angles.",
            options: ["81 m²", "96 m²", "15 m²", "40 m²"],
            answer: "81 m²",
            explanation: "Imagine the whole rectangle first: 12 × 8 = 96 m². Then take away the cut-out corner: 5 × 3 = 15 m². So 96 − 15 = 81 m².",
            difficulty: 3,
            image: IMG.compArea,
          },
          {
            key: "meas-y5-10",
            kind: "single",
            prompt: "Which is the best estimate of the capacity of a bath?",
            options: ["150 ml", "1,500 litres", "15 litres", "150 litres"],
            answer: "150 litres",
            explanation: "A bath holds far more than a bucket (about 10 litres) but much less than a swimming pool, so about 150 litres is sensible.",
            difficulty: 1,
          },
        ],
      },
      flashcards: [
        { front: "How many grams in 1 kg? Millilitres in 1 litre?", back: "1,000 g; 1,000 ml." },
        { front: "How do you change 3.5 kg into grams?", back: "Multiply by 1,000: 3,500 g." },
        { front: "About how many cm is 1 inch?", back: "About 2.5 cm." },
        { front: "About how many grams is 1 pound?", back: "About 450 g." },
        { front: "About how many pints is 1 litre?", back: "About 1¾ pints." },
        { front: "How do you find the area of a rectangle?", back: "Length × width. The units are cm² or m²." },
        { front: "How do you find the perimeter of a composite rectilinear shape?", back: "Work out every missing side from the ones given, then add all the sides." },
        { front: "What is volume, and how can you estimate it?", back: "The space a solid takes up. Count how many 1 cm³ cubes would fit inside." },
        { front: "What is capacity?", back: "How much a container can hold, usually measured in litres and millilitres." },
        { front: "How many minutes in 2¾ hours?", back: "2 × 60 + 45 = 165 minutes." },
      ],
    },

    // ───────────────────────────── YEAR 6 ─────────────────────────────
    6: {
      year: 6,
      objectives: [
        "Solve problems involving the calculation and conversion of units of measure, using decimal notation up to three decimal places",
        "Convert between miles and kilometres",
        "Recognise that shapes with the same areas can have different perimeters and vice versa",
        "Calculate the area of parallelograms and triangles",
        "Calculate, estimate and compare the volume of cubes and cuboids using standard units (cm³, m³)",
      ],
      note: {
        title: "Decimal conversions, area and volume",
        body: `## Converting with decimals

Use the same rules as before, but the numbers can have up to three decimal places.

- km to m: multiply by 1,000 (4.2 km = 4,200 m). g to kg: divide by 1,000 (3,780 g = 3.78 kg).
- **Miles and kilometres:** 5 miles is about 8 km.

## Area and volume

- **Parallelogram:** area = base × **perpendicular** height. Use the height that makes a right angle with the base, not the slanted side.
- **Triangle:** area = ½ × base × perpendicular height.
- **Cuboid:** volume = length × width × height, measured in cm³ or m³. 1 litre = 1,000 cm³.
- Shapes with the same perimeter can have different areas, and the other way round.

## Worked examples

**1. Miles.** About how far is 45 miles in km? 45 ÷ 5 = 9 lots of 5 miles, and 9 × 8 = **72 km**.

**2. Triangle.** Base 10 cm, perpendicular height 7 cm: ½ × 10 × 7 = **35 cm²**.

**3. Volume.** A tank is 60 cm by 30 cm by 20 cm. Volume = 60 × 30 × 20 = 36,000 cm³. Since 1,000 cm³ is 1 litre, it holds **36 litres**.`,
      },
      quiz: {
        title: "Year 6 Measurement quiz",
        questions: [
          {
            key: "meas-y6-01",
            kind: "single",
            prompt: "Convert 3.5 km into metres.",
            options: ["350 m", "35 m", "3,500 m", "35,000 m"],
            answer: "3,500 m",
            explanation: "1 km is 1,000 m, so multiply by 1,000: 3.5 × 1,000 = 3,500 m.",
            difficulty: 1,
          },
          {
            key: "meas-y6-02",
            kind: "number",
            prompt: "A parcel has a mass of 2,345 g. What is its mass in kilograms?",
            answer: 2.345,
            tolerance: 0.0001,
            explanation: "There are 1,000 g in 1 kg, so divide by 1,000: 2,345 ÷ 1,000 = 2.345 kg.",
            difficulty: 2,
          },
          {
            key: "meas-y6-03",
            kind: "single",
            prompt: "5 miles is about 8 km. About how many kilometres is 35 miles?",
            options: ["43 km", "56 km", "22 km", "280 km"],
            answer: "56 km",
            explanation: "35 miles is 7 lots of 5 miles (35 ÷ 5 = 7), so it is about 7 × 8 = 56 km.",
            difficulty: 2,
            diagnostic: true,
          },
          {
            key: "meas-y6-04",
            kind: "single",
            prompt: "What is the area of this parallelogram?",
            options: ["45 cm²", "28 cm²", "36 cm²", "18 cm²"],
            answer: "36 cm²",
            explanation: "Area of a parallelogram = base × perpendicular height. Use the 4 cm height, not the slanted side: 9 × 4 = 36 cm².",
            difficulty: 2,
            diagnostic: true,
            image: IMG.parallelogram,
          },
          {
            key: "meas-y6-05",
            kind: "single",
            prompt: "What is the area of this triangle?",
            options: ["168 cm²", "42 cm²", "182 cm²", "84 cm²"],
            answer: "84 cm²",
            explanation: "Area of a triangle = ½ × base × perpendicular height = ½ × 14 × 12 = 84 cm². The slanted sides are not needed.",
            difficulty: 2,
            image: IMG.triangle,
          },
          {
            key: "meas-y6-06",
            kind: "number",
            prompt: "What is the volume of this cuboid in cm³?",
            answer: 120,
            explanation: "Volume = length × width × height, so 8 × 5 × 3 = 120 cm³.",
            difficulty: 1,
            image: IMG.cuboid,
          },
          {
            key: "meas-y6-07",
            kind: "single",
            prompt: "A rectangle has a perimeter of 24 cm and its sides are whole numbers of centimetres. Which of these could be its area?",
            options: ["40 cm²", "24 cm²", "37 cm²", "36 cm²"],
            answer: "36 cm²",
            explanation: "The length and width add up to 12 (half of 24). The whole-number pairs give areas 11, 20, 27, 32, 35 and 36 cm², so 36 cm² (a 6 by 6 square) is the only one listed.",
            difficulty: 3,
          },
          {
            key: "meas-y6-08",
            kind: "single",
            prompt: "A cube has sides of 4 cm. What is its volume?",
            options: ["64 cm³", "16 cm³", "12 cm³", "96 cm³"],
            answer: "64 cm³",
            explanation: "The length, width and height are all 4 cm, so the volume is 4 × 4 × 4 = 64 cm³.",
            difficulty: 1,
          },
          {
            key: "meas-y6-09",
            kind: "number",
            prompt: "A tank is a cuboid measuring 50 cm by 40 cm by 30 cm. 1 litre is 1,000 cm³. How many litres of water can the tank hold?",
            answer: 60,
            explanation: "Volume = 50 × 40 × 30 = 60,000 cm³. Divide by 1,000 to change cm³ into litres: 60 litres.",
            difficulty: 3,
          },
          {
            key: "meas-y6-10",
            kind: "number",
            prompt: "A bag of flour has a mass of 2.4 kg. Mum uses 1.35 kg. How many grams of flour are left? Type your answer as digits with no comma.",
            answer: 1050,
            explanation: "2.4 − 1.35 = 1.05 kg. Multiply by 1,000 to change kilograms to grams: 1,050 g.",
            difficulty: 2,
          },
        ],
      },
      flashcards: [
        { front: "How do you change kilometres to metres?", back: "Multiply by 1,000. 4.2 km = 4,200 m." },
        { front: "How do you change grams to kilograms?", back: "Divide by 1,000. 3,780 g = 3.78 kg." },
        { front: "How many kilometres are about 5 miles?", back: "About 8 km." },
        { front: "How do you find the area of a parallelogram?", back: "Base × perpendicular height (the height that makes a right angle with the base)." },
        { front: "How do you find the area of a triangle?", back: "½ × base × perpendicular height." },
        { front: "How do you find the volume of a cuboid?", back: "Length × width × height, in cm³ or m³." },
        { front: "What is the volume of a cube with sides of 5 cm?", back: "5 × 5 × 5 = 125 cm³." },
        { front: "How many cm³ make 1 litre?", back: "1,000 cm³." },
        { front: "Can two shapes have the same perimeter but different areas?", back: "Yes. Perimeter and area are different measures, so one can stay the same while the other changes." },
        { front: "A rectangle has a perimeter of 30 cm. What do its length and width add up to?", back: "Half of the perimeter: 15 cm." },
      ],
    },
  },
};
