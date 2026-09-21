// Statistics (KS2 Maths). Original content aligned to the DfE programme of study (OGL v3.0).
// Images are drawn from data in _k4data.ts by scratch/curriculum-images/gen-k4.ts; answers are re-checked by _check_k4.ts.
import type { CTopic } from "../types";

export const TOPIC: CTopic = {
  key: "stats",
  topic: "Statistics",
  subject: "Maths",
  years: {
    3: {
      year: 3,
      objectives: [
        "Interpret and present data using bar charts, pictograms and tables.",
        "Solve one-step and two-step questions using information in scaled bar charts, pictograms and tables.",
      ],
      note: {
        title: "Bar charts, pictograms and tables",
        body: `## Ways to show data

- A **tally chart** records each vote with a stroke. Every fifth stroke crosses the other four, so you can count in fives.
- A **pictogram** uses pictures. The **key** tells you how many each picture is worth, and a half picture is worth half as much.
- A **bar chart** uses bars. Read the **scale** on the side: each gridline may go up in 2s, 5s or 10s, and a bar can stop between two labelled lines.
- A **table** lists the numbers in rows and columns.

## Answering questions

- **One-step:** read a value, or do one addition or subtraction.
- **Two-step:** find two values first, then add or subtract them.

The words "how many more" or "difference" mean **subtract**. The words "altogether" or "total" mean **add**.

## Worked examples

**Example 1.** In a pictogram each ☺ means 2 children. Football has 3 whole ☺ and 1 half ☺.
3 × 2 = 6, and half a picture is 1, so 6 + 1 = **7 children**.

**Example 2.** A bar stops halfway between 30 and 40 on a scale that goes up in 10s.
Halfway is 35, so the bar shows **35**.

**Example 3.** A table shows 16 apples sold on Monday and 17 on Tuesday. How many altogether?
16 + 17 = **33 apples**.`,
      },
      quiz: {
        title: "Statistics — Year 3 quiz",
        questions: [
          {
            key: "stats-y3-01", kind: "single", difficulty: 1, diagnostic: true,
            prompt: "How many children chose cats as their favourite pet?",
            options: ["4", "6", "8", "10"],
            answer: "8",
            explanation: "Each face stands for 2 children, and cats has 4 faces. 4 × 2 = 8 children.",
            image: { file: "stats-y3-pictogram.png", alt: "A pictogram called Favourite pets in Class 3 with rows for cats, dogs, fish, rabbits and hamsters. Each row is a line of smiley faces, and some rows end with a half face. The key says one face equals 2 children." },
          },
          {
            key: "stats-y3-02", kind: "single", difficulty: 2,
            prompt: "How many children chose dogs as their favourite pet?",
            options: ["11", "5", "10", "12"],
            answer: "11",
            explanation: "There are 5 whole faces, worth 5 × 2 = 10, and a half face worth 1. So 10 + 1 = 11 children.",
            image: { file: "stats-y3-pictogram.png", alt: "A pictogram called Favourite pets in Class 3 with rows for cats, dogs, fish, rabbits and hamsters. Each row is a line of smiley faces, and some rows end with a half face. The key says one face equals 2 children." },
          },
          {
            key: "stats-y3-03", kind: "single", difficulty: 1,
            prompt: "How many library books were borrowed on Wednesday?",
            options: ["10", "15", "20", "5"],
            answer: "15",
            explanation: "The Wednesday bar stops halfway between 10 and 20 on the scale, which is 15.",
            image: { file: "stats-y3-bar.png", alt: "A bar chart called Library books borrowed each day, with bars for Monday to Friday. The side scale is labelled every 10 from 0 to 50 with a smaller gridline halfway between each label." },
          },
          {
            key: "stats-y3-04", kind: "single", difficulty: 2, diagnostic: true,
            prompt: "How many more books were borrowed on Friday than on Monday?",
            options: ["20", "25", "70", "10"],
            answer: "20",
            explanation: "Read both bars: Friday is 45 and Monday is 25. \"How many more\" means subtract: 45 − 25 = 20.",
            image: { file: "stats-y3-bar.png", alt: "A bar chart called Library books borrowed each day, with bars for Monday to Friday. The side scale is labelled every 10 from 0 to 50 with a smaller gridline halfway between each label." },
          },
          {
            key: "stats-y3-05", kind: "number", difficulty: 2,
            prompt: "How many children voted for football?",
            answer: 12,
            explanation: "Each group of five is four upright strokes crossed by a diagonal. Two groups make 10, and there are 2 more strokes, so 10 + 2 = 12.",
            image: { file: "stats-y3-tally.png", alt: "A tally chart of favourite sport with rows for football, cricket, swimming and gymnastics. Each row shows tally marks grouped in fives, with no totals written." },
          },
          {
            key: "stats-y3-06", kind: "single", difficulty: 2,
            prompt: "How many rubbers were sold on Monday and Tuesday together?",
            options: ["3", "9", "12", "21"],
            answer: "21",
            explanation: "Find the Rubbers row and add the Monday and Tuesday numbers: 9 + 12 = 21.",
            image: { file: "stats-y3-table.png", alt: "A table called Items sold at the school shop with rows for pencils, rubbers and rulers and columns for Monday and Tuesday, each holding a number." },
          },
          {
            key: "stats-y3-07", kind: "single", difficulty: 1,
            prompt: "In a pictogram the key says that each symbol stands for 5 children. A row has 6 symbols. How many children does the row show?",
            options: ["6", "11", "30", "35"],
            answer: "30",
            explanation: "Each symbol is worth 5, so 6 symbols is 6 × 5 = 30 children.",
          },
          {
            key: "stats-y3-08", kind: "number", difficulty: 2,
            prompt: "The scale on a bar chart goes up in 10s: 0, 10, 20, 30, 40. A bar stops exactly halfway between 20 and 30. What number does the bar show?",
            answer: 25,
            explanation: "The gap from 20 to 30 is 10, and half of 10 is 5. So halfway is 20 + 5 = 25.",
          },
          {
            key: "stats-y3-09", kind: "number", difficulty: 3,
            prompt: "The library wants 160 books to be borrowed in the week. Monday to Friday, how many more books would need to have been borrowed to reach 160?",
            answer: 10,
            explanation: "First add all five bars: 25 + 35 + 15 + 30 + 45 = 150. Then find how many more are needed: 160 − 150 = 10.",
            image: { file: "stats-y3-bar.png", alt: "A bar chart called Library books borrowed each day, with bars for Monday to Friday. The side scale is labelled every 10 from 0 to 50 with a smaller gridline halfway between each label." },
          },
          {
            key: "stats-y3-10", kind: "number", difficulty: 3,
            prompt: "Across Monday and Tuesday altogether, how many more pencils than rulers were sold?",
            answer: 19,
            explanation: "Pencils: 14 + 18 = 32. Rulers: 5 + 8 = 13. Then find the difference: 32 − 13 = 19.",
            image: { file: "stats-y3-table.png", alt: "A table called Items sold at the school shop with rows for pencils, rubbers and rulers and columns for Monday and Tuesday, each holding a number." },
          },
        ],
      },
      flashcards: [
        { front: "What does the key on a pictogram tell you?", back: "How many each picture is worth, e.g. one face = 2 children." },
        { front: "A pictogram picture is worth 2. What is half a picture worth?", back: "1 (half of 2)." },
        { front: "How do you count a tally chart?", back: "Count in fives for each crossed group, then add the leftover strokes." },
        { front: "What does 'scale' mean on a bar chart?", back: "The numbers up the side. Check how much each gridline goes up by." },
        { front: "A bar stops between two labelled lines. What do you do?", back: "Work out the halfway value, e.g. halfway between 30 and 40 is 35." },
        { front: "What does a table show?", back: "Data in rows and columns. Find the right row and column, then read where they meet." },
        { front: "Which words tell you to subtract in a chart question?", back: "\"How many more\", \"how many fewer\" and \"difference\"." },
        { front: "Which words tell you to add?", back: "\"Altogether\", \"total\" and \"in all\"." },
        { front: "What is a two-step question?", back: "One where you find two values first, then add or subtract them." },
        { front: "What should every chart have?", back: "A title, labelled axes (or a key) and a sensible scale." },
      ],
    },
    4: {
      year: 4,
      objectives: [
        "Interpret and present discrete and continuous data using appropriate graphical methods, including bar charts and time graphs.",
        "Solve comparison, sum and difference problems using information presented in bar charts, pictograms, tables and other graphs.",
      ],
      note: {
        title: "Bar charts and time graphs",
        body: `## Discrete and continuous data

**Discrete data** is counted in separate amounts: children in a class, books read, cups sold. A **bar chart** suits it, with gaps between bars.

**Continuous data** can take any value and changes smoothly, such as temperature or the height of a plant. A **time graph** (a line graph with time along the bottom) suits it. You join the points with straight lines.

## Reading graphs

- Read the **scale** carefully. If the labels go up in 20s, a line halfway between 40 and 60 means 50.
- To read a time graph, find the time along the bottom, go straight up to the line, then read across to the scale.
- A line going **up** means the amount is rising; going **down** means it is falling.

## Comparison, sum and difference

- **Comparison:** which is bigger or smaller.
- **Sum:** add values to find a total.
- **Difference:** subtract to find how many more.

## Worked examples

**Example 1.** A bar reaches 100 and another reaches 35. What is the difference? 100 − 35 = **65**.

**Example 2.** On a time graph the temperature is 5 °C at 9 am and 14 °C at 1 pm. How much did it rise? 14 − 5 = **9 °C**.

**Example 3.** Class A read 20, 60 and 30 books in three months. Total? 20 + 60 + 30 = **110 books**.`,
      },
      quiz: {
        title: "Statistics — Year 4 quiz",
        questions: [
          {
            key: "stats-y4-01", kind: "single", difficulty: 1,
            prompt: "How many cups of hot chocolate were sold on Thursday?",
            options: ["100", "90", "120", "110"],
            answer: "110",
            explanation: "The Thursday bar stops halfway between the 100 and 120 lines. Halfway is 110.",
            image: { file: "stats-y4-bar.png", alt: "A bar chart called Cups of hot chocolate sold, with bars for Monday to Friday. The side scale is labelled every 20 from 0 to 120 with a smaller gridline halfway between labels." },
          },
          {
            key: "stats-y4-02", kind: "single", difficulty: 2, diagnostic: true,
            prompt: "How many more cups were sold on Tuesday than on Wednesday?",
            options: ["40", "50", "130", "60"],
            answer: "50",
            explanation: "Tuesday is 90 and Wednesday is 40. To find how many more, subtract: 90 − 40 = 50.",
            image: { file: "stats-y4-bar.png", alt: "A bar chart called Cups of hot chocolate sold, with bars for Monday to Friday. The side scale is labelled every 20 from 0 to 120 with a smaller gridline halfway between labels." },
          },
          {
            key: "stats-y4-03", kind: "single", difficulty: 2,
            prompt: "How many cups were sold on Monday and Friday together?",
            options: ["10", "120", "130", "150"],
            answer: "130",
            explanation: "Monday is 60 and Friday is 70. \"Together\" means add: 60 + 70 = 130.",
            image: { file: "stats-y4-bar.png", alt: "A bar chart called Cups of hot chocolate sold, with bars for Monday to Friday. The side scale is labelled every 20 from 0 to 120 with a smaller gridline halfway between labels." },
          },
          {
            key: "stats-y4-04", kind: "single", difficulty: 1,
            prompt: "What was the temperature in the shed at 12 noon?",
            options: ["16 °C", "12 °C", "14 °C", "18 °C"],
            answer: "16 °C",
            explanation: "Find 12 noon along the bottom, go straight up to the line, then read across to the scale: 16 °C.",
            image: { file: "stats-y4-time.png", alt: "A time graph called Temperature in a garden shed. Time runs along the bottom from 6 am to 6 pm in two-hour steps and temperature runs up the side from 0 to 20 degrees. The line rises during the morning and falls again later." },
          },
          {
            key: "stats-y4-05", kind: "single", difficulty: 2, diagnostic: true,
            prompt: "How many degrees warmer was it at 2 pm than at 8 am?",
            options: ["2", "14", "24", "12"],
            answer: "12",
            explanation: "At 2 pm it was 18 °C and at 8 am it was 6 °C. Subtract: 18 − 6 = 12 degrees.",
            image: { file: "stats-y4-time.png", alt: "A time graph called Temperature in a garden shed. Time runs along the bottom from 6 am to 6 pm in two-hour steps and temperature runs up the side from 0 to 20 degrees. The line rises during the morning and falls again later." },
          },
          {
            key: "stats-y4-06", kind: "single", difficulty: 2,
            prompt: "Between which two times did the temperature rise the most?",
            options: ["6 am and 8 am", "10 am and 12 noon", "2 pm and 4 pm", "4 pm and 6 pm"],
            answer: "10 am and 12 noon",
            explanation: "Work out each change: 6 am to 8 am is +2, but 10 am to 12 noon is +6, the biggest rise. The drop from 4 pm to 6 pm is also 6, but that is a fall.",
            image: { file: "stats-y4-time.png", alt: "A time graph called Temperature in a garden shed. Time runs along the bottom from 6 am to 6 pm in two-hour steps and temperature runs up the side from 0 to 20 degrees. The line rises during the morning and falls again later." },
          },
          {
            key: "stats-y4-07", kind: "single", difficulty: 2,
            prompt: "In which month did Class 4B read more books than Class 4A?",
            options: ["January", "February", "March", "April"],
            answer: "March",
            explanation: "Compare the two bars in each month. Only in March is the orange bar (4B) taller than the blue bar (4A).",
            image: { file: "stats-y4-dbl.png", alt: "A double bar chart called Books read each month. For each of January to April there are two bars side by side: blue for Class 4A and orange for Class 4B. The side scale is labelled every 10 from 0 to 70." },
          },
          {
            key: "stats-y4-08", kind: "number", difficulty: 3,
            prompt: "Over the four months altogether, how many more books did Class 4A read than Class 4B?",
            answer: 30,
            explanation: "Class 4A: 30 + 50 + 40 + 60 = 180. Class 4B: 20 + 40 + 60 + 30 = 150. Then 180 − 150 = 30.",
            image: { file: "stats-y4-dbl.png", alt: "A double bar chart called Books read each month. For each of January to April there are two bars side by side: blue for Class 4A and orange for Class 4B. The side scale is labelled every 10 from 0 to 70." },
          },
          {
            key: "stats-y4-09", kind: "single", difficulty: 1,
            prompt: "Which of these is best shown on a time graph?",
            options: ["Favourite colours of a class", "Shoe sizes in a class", "The number of children in each class", "The temperature of a room measured every hour"],
            answer: "The temperature of a room measured every hour",
            explanation: "A time graph shows something that changes continuously as time passes, like temperature. The others are separate counts, which suit a bar chart.",
          },
          {
            key: "stats-y4-10", kind: "number", difficulty: 3,
            prompt: "On a bar chart the scale goes up in 20s. Bar X stops halfway between 60 and 80. Bar Y is 30 taller than bar X. How tall is bar Y?",
            answer: 100,
            explanation: "Halfway between 60 and 80 is 70, so bar X is 70. Bar Y is 30 taller: 70 + 30 = 100.",
          },
        ],
      },
      flashcards: [
        { front: "What is discrete data?", back: "Data you count in separate amounts, e.g. children or books. Bar charts suit it." },
        { front: "What is continuous data?", back: "Data that can take any value and changes smoothly, e.g. temperature or height." },
        { front: "What is a time graph?", back: "A line graph with time along the bottom, used to show how something changes." },
        { front: "How do you read a value on a time graph?", back: "Find the time on the bottom axis, go up to the line, then read across to the scale." },
        { front: "What does a line going down on a time graph mean?", back: "The amount is getting smaller (falling)." },
        { front: "What does a double bar chart show?", back: "Two sets of data side by side so you can compare them. A key tells you which colour is which." },
        { front: "A bar is halfway between 40 and 60 on the scale. What is it?", back: "50." },
        { front: "How do you find 'how many more'?", back: "Subtract the smaller value from the bigger value." },
        { front: "How do you find a total from a chart?", back: "Read each value and add them all together." },
        { front: "What should you check before reading a graph?", back: "The title, what each axis shows, and how much each scale step is worth." },
      ],
    },
    5: {
      year: 5,
      objectives: [
        "Solve comparison, sum and difference problems using information presented in a line graph.",
        "Complete, read and interpret information in tables, including timetables.",
      ],
      note: {
        title: "Line graphs, tables and timetables",
        body: `## Line graphs

A **line graph** shows how something changes, so it uses points joined by lines. The horizontal axis is usually time.

- Line going **up**: increasing. Line going **down**: decreasing. **Flat**: no change.
- The **steepest** part of the line is where the change is biggest.
- With two lines on one graph, compare them month by month. The **difference** is the bigger value minus the smaller one.

## Tables and timetables

In a **table**, find the correct row and column, then read where they meet. Totals can help you find a missing number: **total − known parts = missing part**.

In a **timetable** each column is one journey. Times are often written on the 24-hour clock, like 08:55. To find a journey time, count on from the start time to the end time.

## Worked examples

**Example 1.** A puppy weighs 8 kg in week 2 and 11 kg in week 3. Growth: 11 − 8 = **3 kg**.

**Example 2.** A bus leaves at 10:45 and takes 1 hour 50 minutes.
10:45 + 1 hour = 11:45. Add 15 minutes to reach 12:00, then 35 more: **12:35**.

**Example 3.** A row total is 90. Two cells are 34 and 29. The missing cell is 90 − 34 − 29 = **27**.`,
      },
      quiz: {
        title: "Statistics — Year 5 quiz",
        questions: [
          {
            key: "stats-y5-01", kind: "single", difficulty: 1, diagnostic: true,
            prompt: "What was the height of the sunflower in week 3?",
            options: ["3 cm", "35 cm", "40 cm", "45 cm"],
            answer: "40 cm",
            explanation: "Find week 3 along the bottom, go up to the point on the line, and read across to the scale: 40 cm.",
            image: { file: "stats-y5-line.png", alt: "A line graph called Height of a sunflower. Weeks 0 to 6 run along the bottom and height in centimetres runs up the side from 0 to 60. The line rises steadily, more steeply in the middle weeks." },
          },
          {
            key: "stats-y5-02", kind: "single", difficulty: 2, diagnostic: true,
            prompt: "Between which two weeks did the sunflower grow the most?",
            options: ["Weeks 0 and 1", "Weeks 2 and 3", "Weeks 4 and 5", "Weeks 5 and 6"],
            answer: "Weeks 2 and 3",
            explanation: "Work out the growth each week: 10, 10, 15, 10, 5 and 5 cm. The biggest is 15 cm, between weeks 2 and 3, where the line is steepest.",
            image: { file: "stats-y5-line.png", alt: "A line graph called Height of a sunflower. Weeks 0 to 6 run along the bottom and height in centimetres runs up the side from 0 to 60. The line rises steadily, more steeply in the middle weeks." },
          },
          {
            key: "stats-y5-03", kind: "single", difficulty: 2,
            prompt: "A train leaves at 09:48 and the journey takes 1 hour 27 minutes. What time does it arrive?",
            options: ["10:75", "11:25", "12:15", "11:15"],
            answer: "11:15",
            explanation: "Add 1 hour to reach 10:48. Add 12 minutes to reach 11:00, then the other 15 minutes to reach 11:15.",
          },
          {
            key: "stats-y5-04", kind: "single", difficulty: 1,
            prompt: "On a line graph with time along the bottom, a line slopes downwards from left to right. What does this show?",
            options: ["The amount is decreasing", "The amount is increasing", "The amount stayed the same", "The graph has a mistake"],
            answer: "The amount is decreasing",
            explanation: "Time moves to the right, so a line sloping downwards means the value gets smaller as time passes.",
          },
          {
            key: "stats-y5-05", kind: "multi", difficulty: 2,
            prompt: "In which of these months was Town A warmer than Town B? Choose all that apply.",
            options: ["January", "March", "April", "June"],
            answer: ["April", "June"],
            explanation: "Compare the two lines month by month. The blue line for Town A is above the orange line for Town B in April and June, but below it in January and March.",
            image: { file: "stats-y5-two.png", alt: "A line graph called Average temperature in two towns with two lines, blue for Town A and orange for Town B. Months January to June run along the bottom and temperature runs up the side. Town A starts colder than Town B, then crosses above it between March and April." },
          },
          {
            key: "stats-y5-06", kind: "single", difficulty: 2,
            prompt: "In which month was the difference between the two towns' temperatures the greatest?",
            options: ["January", "February", "May", "June"],
            answer: "June",
            explanation: "Find the gap each month: January 4, February 4, May 4, but June 20 − 14 = 6. June has the biggest gap.",
            image: { file: "stats-y5-two.png", alt: "A line graph called Average temperature in two towns with two lines, blue for Town A and orange for Town B. Months January to June run along the bottom and temperature runs up the side. Town A starts colder than Town B, then crosses above it between March and April." },
          },
          {
            key: "stats-y5-07", kind: "single", difficulty: 1,
            prompt: "What time does Bus 2 arrive at the Library?",
            options: ["08:10", "08:55", "09:05", "09:40"],
            answer: "08:55",
            explanation: "Find the Library row, then go along to the Bus 2 column. The time where they meet is 08:55.",
            image: { file: "stats-y5-timetable.png", alt: "A bus timetable with stops Oakfield School, Market Square, Library, Park Gates and Town Station down the side and Bus 1 to Bus 4 across the top. Each cell holds a time in 24-hour format." },
          },
          {
            key: "stats-y5-08", kind: "number", difficulty: 2,
            prompt: "Bus 3 leaves Oakfield School and arrives at Town Station. How many minutes does the journey take?",
            answer: 55,
            explanation: "Bus 3 leaves at 09:10 and arrives at 10:05. From 09:10 to 10:00 is 50 minutes, and 5 more minutes makes 55.",
            image: { file: "stats-y5-timetable.png", alt: "A bus timetable with stops Oakfield School, Market Square, Library, Park Gates and Town Station down the side and Bus 1 to Bus 4 across the top. Each cell holds a time in 24-hour format." },
          },
          {
            key: "stats-y5-09", kind: "single", difficulty: 3,
            prompt: "Ali gets to Market Square at 08:30 and wants to go to Park Gates on the first bus he can catch. What time does he arrive at Park Gates?",
            options: ["08:20", "08:40", "09:05", "09:50"],
            answer: "09:05",
            explanation: "Bus 1 left Market Square at 07:55, so Ali has missed it. The first bus after 08:30 is Bus 2 at 08:40, and Bus 2 reaches Park Gates at 09:05.",
            image: { file: "stats-y5-timetable.png", alt: "A bus timetable with stops Oakfield School, Market Square, Library, Park Gates and Town Station down the side and Bus 1 to Bus 4 across the top. Each cell holds a time in 24-hour format." },
          },
          {
            key: "stats-y5-10", kind: "number", difficulty: 3,
            prompt: "One cell in the table is hidden by a question mark. How many toys did class 5B donate?",
            answer: 25,
            explanation: "Class 5B's total is 78 and its books and games add up to 31 + 22 = 53. So toys = 78 − 53 = 25.",
            image: { file: "stats-y5-table.png", alt: "A table called Donations to the school fair with rows for classes 5A, 5B and 5C and a final row of totals, and columns for books, games, toys and total. The toys cell for class 5B shows a question mark." },
          },
        ],
      },
      flashcards: [
        { front: "What does a line graph show?", back: "How something changes over time, using points joined by lines." },
        { front: "What does a flat section of a line graph mean?", back: "The amount is not changing." },
        { front: "Where is a line graph steepest?", back: "Where the biggest change happens." },
        { front: "How do you find the difference between two lines at one point?", back: "Read both values and subtract the smaller from the bigger." },
        { front: "How do you read a timetable?", back: "Find the stop in the row and the journey in the column, then read where they meet." },
        { front: "How do you find a journey time?", back: "Count on from the start time to the arrival time, e.g. 08:20 to 09:10 is 50 minutes." },
        { front: "Add 1 h 40 min to 10:45.", back: "12:25. Add the hour (11:45), then 15 minutes to 12:00, then 25 more." },
        { front: "How do you find a missing number in a table with totals?", back: "Total − the known parts = the missing part." },
        { front: "Why check a table's totals?", back: "Rows and columns should add up to the same grand total, which catches mistakes." },
        { front: "What does the 24-hour clock 15:30 mean in am/pm?", back: "3:30 pm." },
      ],
    },
    6: {
      year: 6,
      objectives: [
        "Interpret and construct pie charts and line graphs, and use these to solve problems.",
        "Calculate and interpret the mean as an average.",
      ],
      note: {
        title: "Pie charts, line graphs and the mean",
        body: `## Pie charts

A **pie chart** shows how a whole is shared. The whole circle is **360°**. Each slice is an **angle** that represents a fraction of the total.

- To find how many things a slice shows: **angle ÷ 360 × total**.
- To draw a slice: find the angle for **one item** (360 ÷ total), then multiply by the number of items.
- The angles in all the slices add up to **360°**, which helps you find a missing angle.

## Line graphs

On a line graph, a **flat** section means nothing is changing. In a distance–time graph, flat means **stopped**. A steeper line means faster.

## The mean

The **mean** is the average found by sharing the total equally.

**mean = total ÷ number of values**

Other averages: the **median** is the middle value in order, the **mode** is the most common value, and the **range** is largest − smallest.

## Worked examples

**Example 1.** 30 children are in a pie chart. Each child = 360 ÷ 30 = 12°. A slice of 96° shows 96 ÷ 12 = **8 children**.

**Example 2.** Find the mean of 4, 7, 9 and 12. Total = 32, and 32 ÷ 4 = **8**.

**Example 3.** The mean of 4 numbers is 9 and three of them are 5, 10 and 12. The total must be 4 × 9 = 36, so the fourth is 36 − 27 = **9**.`,
      },
      quiz: {
        title: "Statistics — Year 6 quiz",
        questions: [
          {
            key: "stats-y6-01", kind: "number", difficulty: 2, diagnostic: true,
            prompt: "40 children each chose a favourite sport. How many children chose football?",
            answer: 16,
            explanation: "The whole circle is 360° for 40 children, so each child is 360 ÷ 40 = 9°. Football is 144°, so 144 ÷ 9 = 16 children.",
            image: { file: "stats-y6-pie1.png", alt: "A pie chart called Favourite sport of 40 children with four labelled slices: football, swimming, tennis and gymnastics. Each slice is labelled with its angle in degrees." },
          },
          {
            key: "stats-y6-02", kind: "single", difficulty: 1,
            prompt: "What fraction of the children chose swimming?",
            options: ["½", "¼", "⅓", "⅛"],
            answer: "¼",
            explanation: "Swimming is 90° out of 360°. 90 ÷ 360 simplifies to ¼, because both numbers divide by 90.",
            image: { file: "stats-y6-pie1.png", alt: "A pie chart called Favourite sport of 40 children with four labelled slices: football, swimming, tennis and gymnastics. Each slice is labelled with its angle in degrees." },
          },
          {
            key: "stats-y6-03", kind: "single", difficulty: 1,
            prompt: "What angle should go where the question mark is?",
            options: ["40°", "30°", "50°", "320°"],
            answer: "40°",
            explanation: "The angles in a pie chart add up to 360°. The known angles make 150 + 100 + 70 = 320°, and 360 − 320 = 40°.",
            image: { file: "stats-y6-pie2.png", alt: "A pie chart called How children travel to school with four slices: walk, bus, car and bike. The walk, bus and car slices show their angles in degrees, and the bike slice shows a question mark." },
          },
          {
            key: "stats-y6-04", kind: "number", difficulty: 3,
            prompt: "72 children were asked how they travel to school. How many of them walk?",
            answer: 30,
            explanation: "72 children make 360°, so each child is 360 ÷ 72 = 5°. Walking is 150°, so 150 ÷ 5 = 30 children.",
            image: { file: "stats-y6-pie2.png", alt: "A pie chart called How children travel to school with four slices: walk, bus, car and bike. The walk, bus and car slices show their angles in degrees, and the bike slice shows a question mark." },
          },
          {
            key: "stats-y6-05", kind: "single", difficulty: 2,
            prompt: "For how many minutes did the cyclist stop?",
            options: ["10 minutes", "30 minutes", "20 minutes", "40 minutes"],
            answer: "20 minutes",
            explanation: "When the line is flat the distance is not changing, so the cyclist has stopped. The flat part runs from 20 minutes to 40 minutes, which is 20 minutes.",
            image: { file: "stats-y6-line.png", alt: "A distance-time line graph called Distance from home on a bike ride. Time in minutes runs along the bottom from 0 to 60 and distance in kilometres runs up the side. The line rises, then goes flat for a while, then rises steeply." },
          },
          {
            key: "stats-y6-06", kind: "number", difficulty: 2,
            prompt: "How many more kilometres did the cyclist ride in the last 20 minutes (from 40 to 60 minutes) than in the first 20 minutes?",
            answer: 8,
            explanation: "In the first 20 minutes the cyclist rode 4 − 0 = 4 km. In the last 20 minutes the cyclist rode 16 − 4 = 12 km. The difference is 12 − 4 = 8 km.",
            image: { file: "stats-y6-line.png", alt: "A distance-time line graph called Distance from home on a bike ride. Time in minutes runs along the bottom from 0 to 60 and distance in kilometres runs up the side. The line rises, then goes flat for a while, then rises steeply." },
          },
          {
            key: "stats-y6-07", kind: "single", difficulty: 2, diagnostic: true,
            prompt: "The bar chart shows goals scored in five matches. What is the mean number of goals per match?",
            options: ["4", "3", "2", "5"],
            answer: "4",
            explanation: "Add the goals: 3 + 7 + 2 + 6 + 2 = 20. Share them equally between 5 matches: 20 ÷ 5 = 4. (3 is the median, 2 the mode and 5 the range.)",
            image: { file: "stats-y6-goals.png", alt: "A bar chart called Goals scored in five matches with one bar for each of Match 1 to Match 5. The side scale runs from 0 to 8 in ones." },
          },
          {
            key: "stats-y6-08", kind: "number", difficulty: 2,
            prompt: "A pie chart will show the favourite pizza of 30 children. How many degrees should be used for the 5 children who chose pepperoni?",
            answer: 60,
            explanation: "The circle is 360° and there are 30 children, so each child gets 360 ÷ 30 = 12°. Five children get 5 × 12 = 60°.",
          },
          {
            key: "stats-y6-09", kind: "number", difficulty: 3,
            prompt: "The mean of five numbers is 7. Four of the numbers are 4, 6, 9 and 10. What is the fifth number?",
            answer: 6,
            explanation: "Five numbers with a mean of 7 must total 5 × 7 = 35. The four known numbers add to 4 + 6 + 9 + 10 = 29, so the fifth is 35 − 29 = 6.",
          },
          {
            key: "stats-y6-10", kind: "single", difficulty: 1,
            prompt: "How do you calculate the mean of a set of numbers?",
            options: [
              "Find the middle number when they are in order",
              "Find the number that appears most often",
              "Subtract the smallest from the largest",
              "Add them all up and divide by how many numbers there are",
            ],
            answer: "Add them all up and divide by how many numbers there are",
            explanation: "The mean is the total shared out equally: add up all the values, then divide by how many values there are. The other options describe the median, mode and range.",
          },
        ],
      },
      flashcards: [
        { front: "How many degrees are in a whole pie chart?", back: "360°." },
        { front: "How do you find the angle for one item in a pie chart?", back: "360 ÷ the total number of items." },
        { front: "How do you find how many a pie slice shows?", back: "Angle ÷ 360 × the total (or angle ÷ degrees per item)." },
        { front: "How do you find a missing angle in a pie chart?", back: "360 − the sum of the other angles." },
        { front: "What does a flat section on a distance–time graph mean?", back: "The distance is not changing: the journey has stopped." },
        { front: "What does a steeper line on a distance–time graph mean?", back: "Faster travel: more distance in the same time." },
        { front: "How do you calculate the mean?", back: "Add all the values, then divide by how many values there are." },
        { front: "What is the median?", back: "The middle value when the numbers are in order." },
        { front: "What is the mode?", back: "The value that appears most often." },
        { front: "What is the range?", back: "The largest value minus the smallest value." },
        { front: "The mean of 6 numbers is 4. What is their total?", back: "24 (6 × 4). Use this to find a missing number." },
      ],
    },
  },
};
