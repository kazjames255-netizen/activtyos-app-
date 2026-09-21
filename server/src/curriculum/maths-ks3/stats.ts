// KS3 Maths — Statistics (Years 7–9). Original content aligned to the DfE National Curriculum KS3 programme of study (OGL v3.0).
// Answer keys are recomputed by _check_m2.ts — re-run it after ANY edit here. Pictures are drawn from _m2data.ts.
import type { CTopic } from "../types";

export const TOPIC: CTopic = {
  key: "stats",
  topic: "Statistics",
  subject: "Maths",
  years: {
    7: {
      year: 7,
      objectives: [
        "Describe, interpret and compare observed distributions of a single variable through the mean, median, mode and range.",
        "Construct and interpret appropriate tables, charts and diagrams, including bar charts.",
        "Solve problems involving averages, including finding a missing value.",
      ],
      note: {
        title: "Year 7: averages, range and bar charts",
        body: `## What you need to know

An **average** is a typical value.
- **Mean**: add all the values, then divide by how many there are.
- **Median**: the middle value once the data is in order. With two middle values, find the number halfway between them.
- **Mode**: the most common value (there can be more than one, or none).
- **Range**: biggest − smallest. It measures how spread out the data is, and it is NOT an average.

**Bar charts** use bars of equal width with gaps between them. Read the scale carefully: the height of the bar tells you the frequency.

## Worked example 1: mean and range

Data: 6, 9, 10, 15. Mean = (6 + 9 + 10 + 15) ÷ 4 = 40 ÷ 4 = **10**. Range = 15 − 6 = **9**.

## Worked example 2: median

Put 5, 1, 9, 3, 7 in order: 1, 3, 5, 7, 9. The middle value is **5**. For 2, 8, 4, 10, order gives 2, 4, 8, 10 and the middle two are 4 and 8, so the median is (4 + 8) ÷ 2 = **6**.

## Worked example 3: which average?

A café owner wants to know the most popular flavour of ice cream, so uses the **mode**. The mean of flavours would not make sense.

| Average | Best used when ... |
| --- | --- |
| Mean | you want to use all the values |
| Median | there are very high or low values |
| Mode | the data is a category or you want the most popular |`,
      },
      quiz: {
        title: "Statistics: Year 7 quiz",
        questions: [
          {
            key: "stats-y7-01",
            kind: "number",
            prompt: "Find the mean of 4, 7, 9, 12 and 8.",
            answer: 8,
            explanation: "Add the values: 4 + 7 + 9 + 12 + 8 = 40. Divide by how many there are: 40 ÷ 5 = 8.",
            difficulty: 1,
          },
          {
            key: "stats-y7-02",
            kind: "number",
            prompt: "Find the median of 3, 9, 4, 7 and 12.",
            answer: 7,
            explanation: "Put them in order: 3, 4, 7, 9, 12. The middle value is 7.",
            difficulty: 1,
          },
          {
            key: "stats-y7-03",
            kind: "single",
            prompt: "What is the mode of 2, 5, 5, 7, 9, 5, 2?",
            options: ["2", "5", "7", "9"],
            answer: "5",
            explanation: "The mode is the value that appears most often. 5 appears three times and 2 appears twice.",
            difficulty: 1,
          },
          {
            key: "stats-y7-04",
            kind: "number",
            prompt: "The bar chart shows the favourite fruit of pupils in Class 7T. How many more pupils chose banana than orange?",
            answer: 7,
            explanation: "Read the bars: banana is 12 and orange is 5. The difference is 12 − 5 = 7.",
            difficulty: 2,
            diagnostic: true,
            image: { file: "stats-y7-bar.png", alt: "A bar chart titled Favourite fruit in Class 7T. The vertical axis is Number of pupils from 0 to 14 in steps of 2. The bars are Apple 7, Banana 12, Orange 5 and Grape 9." },
          },
          {
            key: "stats-y7-05",
            kind: "number",
            prompt: "Look at the same bar chart. How many pupils were asked altogether?",
            answer: 33,
            explanation: "Each pupil chose one fruit, so add all the bars: 7 + 12 + 5 + 9 = 33.",
            difficulty: 2,
            image: { file: "stats-y7-bar.png", alt: "A bar chart titled Favourite fruit in Class 7T. The vertical axis is Number of pupils from 0 to 14 in steps of 2. The bars are Apple 7, Banana 12, Orange 5 and Grape 9." },
          },
          {
            key: "stats-y7-06",
            kind: "single",
            prompt: "What is the range of 14, 9, 22, 17 and 6?",
            options: ["22", "14", "8", "16"],
            answer: "16",
            explanation: "Range = largest − smallest = 22 − 6 = 16.",
            difficulty: 2,
            diagnostic: true,
          },
          {
            key: "stats-y7-07",
            kind: "number",
            prompt: "The mean of five numbers is 6. Four of the numbers are 3, 5, 7 and 8. What is the fifth number?",
            answer: 7,
            explanation: "Five numbers with mean 6 must total 5 × 6 = 30. The four known numbers total 3 + 5 + 7 + 8 = 23, so the fifth is 30 − 23 = 7.",
            difficulty: 2,
          },
          {
            key: "stats-y7-08",
            kind: "single",
            prompt: "A shoe shop wants to know which size to stock the most of. Which average should it use?",
            options: ["Mean", "Median", "Mode", "Range"],
            answer: "Mode",
            explanation: "The most popular size is the one that appears most often, which is the mode. The range is not an average.",
            difficulty: 2,
          },
          {
            key: "stats-y7-09",
            kind: "number",
            prompt: "Find the median of 6, 2, 9, 4, 10 and 8.",
            answer: 7,
            explanation: "In order: 2, 4, 6, 8, 9, 10. There are two middle values, 6 and 8. The median is halfway between them: (6 + 8) ÷ 2 = 7.",
            difficulty: 3,
          },
          {
            key: "stats-y7-10",
            kind: "single",
            prompt: "The mean mark of 10 pupils is 62. An eleventh pupil scores 73. What is the mean of all 11 marks?",
            options: ["62", "63", "67.5", "65"],
            answer: "63",
            explanation: "The first 10 marks total 10 × 62 = 620. Adding 73 gives 693. Divide by 11: 693 ÷ 11 = 63.",
            difficulty: 3,
          },
        ],
      },
      flashcards: [
        { front: "How do you find the mean?", back: "Add all the values and divide by how many values there are" },
        { front: "How do you find the median?", back: "Put the values in order and take the middle one (or halfway between the middle two)" },
        { front: "What is the mode?", back: "The most common value" },
        { front: "How do you find the range?", back: "Largest value − smallest value" },
        { front: "Is the range an average?", back: "No. It measures spread" },
        { front: "Can a data set have two modes?", back: "Yes (bimodal). It can also have no mode" },
        { front: "Median of 1, 3, 5, 7", back: "4 (halfway between 3 and 5)" },
        { front: "Which average uses every value?", back: "The mean" },
        { front: "What should you check first when reading a bar chart?", back: "The scale on the vertical axis" },
      ],
    },
    8: {
      year: 8,
      objectives: [
        "Construct and interpret scatter graphs; describe correlation and use a line of best fit.",
        "Construct and interpret pie charts.",
        "Calculate the mean and median from frequency tables; identify outliers.",
      ],
      note: {
        title: "Year 8: scatter graphs, pie charts and frequency tables",
        body: `## What you need to know

- A **scatter graph** plots pairs of values to see if there is a link. **Positive correlation**: as one goes up, so does the other. **Negative correlation**: as one goes up, the other goes down. **No correlation**: no pattern. Correlation does not prove one thing causes the other.
- A **line of best fit** goes through the middle of the points; you can use it to estimate values.
- In a **pie chart**, each sector angle = frequency ÷ total × 360°.
- From a **frequency table**: mean = (sum of value × frequency) ÷ (total frequency). The median is the middle item when counting up through the frequencies.
- An **outlier** is a value far away from the others.

## Worked example 1: pie chart

180 pupils were asked about their favourite lesson. 100° of the pie chart is for PE. The number choosing PE is 100 ÷ 360 × 180 = **50 pupils**.

## Worked example 2: mean from a table

Siblings: 0 (6 pupils), 1 (9 pupils), 2 (3 pupils), 3 (2 pupils). Total pupils = 20. Sum = 0×6 + 1×9 + 2×3 + 3×2 = 21. Mean = 21 ÷ 20 = **1.05**.

## Worked example 3: correlation

Daily temperature and ice cream sales rise together, so this is **positive** correlation. Hours of homework and hours of TV might show a negative pattern.

| Correlation | What the points look like |
| --- | --- |
| Positive | Go up from left to right |
| Negative | Go down from left to right |`,
      },
      quiz: {
        title: "Statistics: Year 8 quiz",
        questions: [
          {
            key: "stats-y8-01",
            kind: "single",
            prompt: "The scatter graph shows hours of revision and test scores for 10 pupils. What type of correlation does it show?",
            options: ["No correlation", "Negative", "Positive", "Perfect negative"],
            answer: "Positive",
            explanation: "The points go up from the bottom left to the top right: more revision goes with higher scores. That is positive correlation.",
            difficulty: 1,
            image: { file: "stats-y8-scatter.png", alt: "A scatter graph of Test score (0 to 100) against Hours of revision (0 to 10). The 10 points rise from bottom left to top right, close to a straight line, and a line of best fit is drawn." },
          },
          {
            key: "stats-y8-02",
            kind: "number",
            prompt: "The pie chart shows how 240 pupils travel to school. How many pupils cycle?",
            answer: 60,
            explanation: "The cycle sector is 90°, which is 90/360 = 1/4 of the circle. 1/4 of 240 is 60.",
            difficulty: 1,
            image: { file: "stats-y8-pie.png", alt: "A pie chart titled How 240 pupils travel to school with four sectors: Walk 120 degrees, Bus 90 degrees, Car 60 degrees and Cycle 90 degrees." },
          },
          {
            key: "stats-y8-03",
            kind: "single",
            prompt: "Which type of chart is best for showing how a whole group is shared between categories?",
            options: ["Scatter graph", "Pie chart", "Line graph", "Frequency polygon"],
            answer: "Pie chart",
            explanation: "A pie chart splits a circle into sectors, so it shows each category as a share of the whole.",
            difficulty: 1,
          },
          {
            key: "stats-y8-04",
            kind: "number",
            prompt: "The table shows the number of pets owned by 20 pupils. Number of pets: 0, 1, 2, 3. Frequency: 5, 8, 4, 3. What is the mean number of pets?",
            answer: 1.25,
            explanation: "Multiply each value by its frequency: 0×5 + 1×8 + 2×4 + 3×3 = 25. Divide by 20 pupils: 25 ÷ 20 = 1.25.",
            difficulty: 2,
            diagnostic: true,
          },
          {
            key: "stats-y8-05",
            kind: "number",
            prompt: "Use the line of best fit on the scatter graph to estimate the test score of a pupil who revised for 5 hours.",
            answer: 60,
            tolerance: 2,
            explanation: "Find 5 on the horizontal axis, go up to the line of best fit and read across to the score axis. The line is at about 60.",
            difficulty: 2,
            image: { file: "stats-y8-scatter.png", alt: "A scatter graph of Test score (0 to 100) against Hours of revision (0 to 10). The 10 points rise from bottom left to top right, close to a straight line, and a line of best fit is drawn." },
          },
          {
            key: "stats-y8-06",
            kind: "number",
            prompt: "Look at the pie chart of how 240 pupils travel to school. How many MORE pupils walk than come by car?",
            answer: 40,
            explanation: "Walk is 120°, so 120/360 × 240 = 80 pupils. Car is 60°, so 60/360 × 240 = 40 pupils. The difference is 80 − 40 = 40.",
            difficulty: 2,
            diagnostic: true,
            image: { file: "stats-y8-pie.png", alt: "A pie chart titled How 240 pupils travel to school with four sectors: Walk 120 degrees, Bus 90 degrees, Car 60 degrees and Cycle 90 degrees." },
          },
          {
            key: "stats-y8-07",
            kind: "single",
            prompt: "Which value is an outlier in this data? 12, 14, 13, 15, 41, 12",
            options: ["12", "13", "15", "41"],
            answer: "41",
            explanation: "Most values are between 12 and 15, but 41 is far away from all the others, so it is the outlier.",
            difficulty: 2,
          },
          {
            key: "stats-y8-08",
            kind: "multi",
            prompt: "Which of these pairs of measurements would you expect to show positive correlation? Select all that apply.",
            options: [
              "Height and arm length",
              "Age of a used car and its value",
              "Hours of sunshine and sales of sun cream",
              "Hours of TV watched and shoe size",
              "Speed of a car and the time taken to travel 100 km",
            ],
            answer: ["Height and arm length", "Hours of sunshine and sales of sun cream"],
            explanation: "Taller people tend to have longer arms, and more sunshine means more sun cream sold, so both rise together. Car age and value, and speed and time, go in opposite directions. TV and shoe size have no link.",
            difficulty: 2,
          },
          {
            key: "stats-y8-09",
            kind: "number",
            prompt: "The table shows goals scored in 16 matches. Goals: 1, 2, 3, 4. Frequency: 3, 5, 6, 2. What is the median number of goals?",
            answer: 2.5,
            explanation: "With 16 values, the median lies between the 8th and 9th. The first 3 are 1s, the next 5 are 2s (up to the 8th value), so the 8th is 2 and the 9th is 3. The median is (2 + 3) ÷ 2 = 2.5.",
            difficulty: 3,
          },
          {
            key: "stats-y8-10",
            kind: "number",
            prompt: "The mean of six numbers is 8. A seventh number is added and the mean becomes 9. What is the seventh number?",
            answer: 15,
            explanation: "Six numbers with mean 8 total 48. Seven numbers with mean 9 total 63. The new number is 63 − 48 = 15.",
            difficulty: 3,
          },
        ],
      },
      flashcards: [
        { front: "Positive correlation", back: "As one variable increases, the other increases too" },
        { front: "Negative correlation", back: "As one variable increases, the other decreases" },
        { front: "What is a line of best fit?", back: "A straight line drawn through the middle of the points, used to make estimates" },
        { front: "Does correlation prove one thing causes another?", back: "No. There may be another reason for the link" },
        { front: "Pie chart angle", back: "frequency ÷ total × 360°" },
        { front: "How do you find the mean from a frequency table?", back: "Add up (value × frequency), then divide by the total frequency" },
        { front: "What is an outlier?", back: "A value that is much bigger or smaller than the rest of the data" },
        { front: "In a table with 21 values, which position is the median?", back: "The 11th value" },
        { front: "Which chart shows how two variables are related?", back: "A scatter graph" },
      ],
    },
    9: {
      year: 9,
      objectives: [
        "Estimate the mean, and identify the modal class and the class containing the median, from grouped data.",
        "Compare distributions using averages and measures of spread.",
        "Recognise misleading graphs and statistical claims; discuss sources of bias.",
      ],
      note: {
        title: "Year 9: grouped data, comparing distributions and misleading graphs",
        body: `## What you need to know

- **Grouped data** puts values into classes such as 0 < x ≤ 10. We lose the exact values, so the mean we calculate is only an **estimate**.
- **Estimated mean** = (sum of midpoint × frequency) ÷ total frequency.
- The **modal class** is the class with the highest frequency. The **median class** is the class that contains the middle value.
- To **compare** two sets of data, compare an **average** (a typical value) AND a **spread** (range): "On average Group A is higher, but Group B is more consistent."
- A graph can be **misleading** if the vertical axis does not start at zero, the scale is uneven, the bars have different widths, or the data is left out.

## Worked example 1: estimated mean

Classes 0 < x ≤ 10 (2 values), 10 < x ≤ 20 (6 values), 20 < x ≤ 30 (2 values). Midpoints 5, 15, 25. Sum = 5×2 + 15×6 + 25×2 = 10 + 90 + 50 = 150. Total frequency = 10. Estimated mean = 150 ÷ 10 = **15**.

## Worked example 2: comparing

Group A: mean 40, range 6. Group B: mean 38, range 20. A has the higher mean and a smaller range, so A scores higher and **more consistently**.

## Worked example 3: misleading graphs

A bar chart of two bars, 90 and 95, drawn on an axis starting at 88 makes the second bar look many times taller, but it is only about 5% bigger. Always look at where the axis starts.

| Feature | Fair graph |
| --- | --- |
| Vertical axis | Starts at 0 |
| Bar width | All equal |`,
      },
      quiz: {
        title: "Statistics: Year 9 quiz",
        questions: [
          {
            key: "stats-y9-01",
            kind: "single",
            prompt: "The table shows the time taken by 25 pupils to run a race, in seconds. Class: 0 < t ≤ 5 (3 pupils), 5 < t ≤ 10 (11 pupils), 10 < t ≤ 15 (7 pupils), 15 < t ≤ 20 (4 pupils). Which is the modal class?",
            options: ["0 < t ≤ 5", "5 < t ≤ 10", "10 < t ≤ 15", "15 < t ≤ 20"],
            answer: "5 < t ≤ 10",
            explanation: "The modal class is the class with the highest frequency. 11 pupils is the biggest number, so the modal class is 5 < t ≤ 10.",
            difficulty: 1,
          },
          {
            key: "stats-y9-02",
            kind: "single",
            prompt: "You calculate a mean from a grouped frequency table using midpoints. What kind of answer is this?",
            options: ["An exact value", "An estimate", "Always too high", "Always the same as the median"],
            answer: "An estimate",
            explanation: "In grouped data we do not know the exact values, so we assume each is at the midpoint of its class. The result is only an estimate.",
            difficulty: 1,
          },
          {
            key: "stats-y9-03",
            kind: "single",
            prompt: "Team A's scores have a range of 12 and Team B's scores have a range of 7. Which team is more consistent?",
            options: ["Team B", "Team A", "They are equally consistent", "You cannot tell"],
            answer: "Team B",
            explanation: "A smaller range means the values are closer together. Team B has the smaller range, so it is more consistent.",
            difficulty: 1,
          },
          {
            key: "stats-y9-04",
            kind: "number",
            prompt: "The table shows the ages of 30 people. Age: 0 < x ≤ 10 (4 people), 10 < x ≤ 20 (9), 20 < x ≤ 30 (12), 30 < x ≤ 40 (5). Estimate the mean age.",
            answer: 21,
            explanation: "Use midpoints 5, 15, 25 and 35: 5×4 + 15×9 + 25×12 + 35×5 = 20 + 135 + 300 + 175 = 630. Divide by 30 people: 630 ÷ 30 = 21.",
            difficulty: 2,
            diagnostic: true,
          },
          {
            key: "stats-y9-05",
            kind: "single",
            prompt: "The bar chart shows cakes sold on three days. Why might it give a misleading impression?",
            options: ["The bars are different widths", "The chart has no title", "There are too many bars", "The vertical axis does not start at zero"],
            answer: "The vertical axis does not start at zero",
            explanation: "The axis starts at 44, not 0, so the bars look very different in height even though the sales are similar (46, 48 and 50).",
            difficulty: 2,
            image: { file: "stats-y9-misleading.png", alt: "A bar chart titled Cakes sold this week with bars for Mon, Tue and Wed. The vertical axis runs from 44 to 50 instead of starting at 0, so the Wednesday bar looks about three times as tall as the Monday bar." },
          },
          {
            key: "stats-y9-06",
            kind: "single",
            prompt: "For the ages of 30 people: 0 < x ≤ 10 (4 people), 10 < x ≤ 20 (9), 20 < x ≤ 30 (12), 30 < x ≤ 40 (5). Which class contains the median age?",
            options: ["0 < x ≤ 10", "10 < x ≤ 20", "20 < x ≤ 30", "30 < x ≤ 40"],
            answer: "20 < x ≤ 30",
            explanation: "With 30 values the median is between the 15th and 16th. The first two classes hold 4 + 9 = 13 values, so the 15th and 16th are in the next class, 20 < x ≤ 30.",
            difficulty: 2,
            diagnostic: true,
          },
          {
            key: "stats-y9-07",
            kind: "single",
            prompt: "Team A scores: mean 24, range 30. Team B scores: mean 22, range 8. Which statement is best supported by the data?",
            options: [
              "Team B has the higher mean and is more consistent",
              "Team A has the higher mean but Team B is more consistent",
              "Team A has the higher mean and is more consistent",
              "Team B has the higher mean but Team A is more consistent",
            ],
            answer: "Team A has the higher mean but Team B is more consistent",
            explanation: "24 is greater than 22, so Team A is better on average. Team B's range of 8 is much smaller than 30, so Team B is more consistent.",
            difficulty: 2,
          },
          {
            key: "stats-y9-08",
            kind: "single",
            prompt: "Nine staff earn (in £1,000s): 22, 23, 24, 24, 24, 25, 26, 27 and 400. Which average makes the firm's pay look highest?",
            options: ["Median", "Mean", "Mode", "Range"],
            answer: "Mean",
            explanation: "The mean is 595 ÷ 9 ≈ 66, dragged up by the very large value. The median and the mode are both 24. The range is a spread, not an average.",
            difficulty: 2,
          },
          {
            key: "stats-y9-09",
            kind: "number",
            prompt: "The mean of 8 numbers is 12. One number is removed and the mean of the remaining 7 numbers is 11. What number was removed?",
            answer: 19,
            explanation: "Eight numbers with mean 12 total 96. Seven numbers with mean 11 total 77. The removed number is 96 − 77 = 19.",
            difficulty: 3,
          },
          {
            key: "stats-y9-10",
            kind: "written",
            prompt: "Two swimming squads record their 50 m times. Squad A: mean 34 seconds, range 12 seconds. Squad B: mean 36 seconds, range 4 seconds. Compare the two squads using an average and a measure of spread.",
            answer: "Squad A is faster on average because its mean time (34 s) is lower than Squad B's (36 s), but Squad B is more consistent because its range (4 s) is smaller than Squad A's (12 s).",
            explanation: "Mark scheme (2 marks): 1 mark for a correct comparison of the averages in context (Squad A has the lower mean time so is faster on average); 1 mark for a correct comparison of the ranges in context (Squad B has the smaller range so is more consistent). Award no marks for comparing without saying which squad is which.",
            difficulty: 3,
            marks: 2,
          },
        ],
      },
      flashcards: [
        { front: "Estimated mean from grouped data", back: "Sum of (midpoint × frequency) ÷ total frequency" },
        { front: "Why is a mean from grouped data only an estimate?", back: "We do not know the exact values, so we use the midpoint of each class" },
        { front: "What is the modal class?", back: "The class with the highest frequency" },
        { front: "How do you find the class that contains the median?", back: "Find the middle position, then count up the cumulative frequencies" },
        { front: "What does a smaller range tell you?", back: "The data is more consistent (less spread out)" },
        { front: "How to compare two data sets", back: "Compare an average AND a spread, in context" },
        { front: "Name two ways a graph can be misleading", back: "Axis not starting at 0; uneven scales; different bar widths; missing data" },
        { front: "Which average is most affected by an extreme value?", back: "The mean" },
        { front: "What is bias in a survey?", back: "When the sample or questions unfairly favour one answer" },
      ],
    },
  },
};
