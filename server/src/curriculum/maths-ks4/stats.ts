// GCSE Maths — Statistics (Years 10–11). Original content aligned to the DfE GCSE mathematics subject content (OGL v3.0).
// Answer keys are recomputed by _check_m3.ts — re-run it after ANY edit here.
import type { CTopic } from "../types";

export const TOPIC: CTopic = {
  key: "stats",
  topic: "Statistics",
  subject: "Maths",
  years: {
    10: {
      year: 10,
      objectives: [
        "Calculate the mean, median, mode and range from lists, frequency tables and grouped data (estimated mean).",
        "Interpret and draw pie charts, bar charts, and scatter graphs.",
        "Describe correlation and use a line of best fit to make estimates.",
        "Understand sampling: random, stratified, and bias.",
        "Compare data sets using averages and spread.",
      ],
      note: {
        title: "Year 10 Statistics: averages, scatter graphs and sampling",
        body: `## What you need to know

**Averages.** The **mean** is the total ÷ how many. The **median** is the middle value once the data is in order (for an even count, the mean of the middle two). The **mode** is the most common value. The **range** (largest − smallest) measures spread.

**Frequency tables.** Mean = Σ(x × f) ÷ Σf. Multiply each value by its frequency, add, then divide by the total frequency.

**Grouped data.** Use the **midpoint** of each class to estimate the mean. It is only an estimate because we do not know the exact values.

**Pie charts.** Angle = frequency ÷ total × 360°.

**Scatter graphs.** Positive correlation: both increase. Negative: one increases as the other decreases. A **line of best fit** passes close to all the points, with about the same number above and below. Use it to estimate, but only **inside the range of the data** (extrapolating is unreliable).

**Sampling.** A **random** sample gives everyone an equal chance. **Stratified** sampling matches the sample to the size of each group: sample in group = (group ÷ population) × sample size.

## Worked example 1: frequency table
Values 1, 2, 3 with frequencies 2, 5, 3. Total = 10 and Σxf = 2 + 10 + 9 = 21, so the mean is **2.1**.

## Worked example 2: grouped mean
Classes 0–20 (frequency 6) and 20–40 (frequency 4): (6 × 10 + 4 × 30) ÷ 10 = **18**.

## Worked example 3: stratified sample
500 pupils, sample of 50. A year group of 150 gives 150/500 × 50 = **15** pupils.

| Idea | Rule |
| --- | --- |
| Pie angle | freq ÷ total × 360° |
| Mean from table | Σxf ÷ Σf |
| Median position | (n + 1) ÷ 2 |`,
      },
      quiz: {
        title: "Statistics: Year 10 GCSE quiz",
        questions: [
          {
            key: "stats-y10-01", kind: "number", difficulty: 1,
            prompt: "Find the median of 7, 3, 9, 4, 12, 5, 8.",
            answer: 7,
            explanation: "Put the numbers in order: 3, 4, 5, 7, 8, 9, 12. The middle (4th) value is 7.",
          },
          {
            key: "stats-y10-02", kind: "number", difficulty: 1,
            prompt: "Find the mean of 12, 15, 9, 20 and 14.",
            answer: 14,
            explanation: "Add the values: 12 + 15 + 9 + 20 + 14 = 70. Divide by 5: 70 ÷ 5 = 14.",
          },
          {
            key: "stats-y10-03", kind: "single", difficulty: 1,
            prompt: "A café records the daily hours of sunshine and the number of ice creams sold. Higher sunshine goes with more ice creams sold. What type of correlation is this?",
            options: ["Negative correlation", "No correlation", "Positive correlation", "The mean of both"],
            answer: "Positive correlation",
            explanation: "Both variables increase together, which is positive correlation.",
          },
          {
            key: "stats-y10-04", kind: "number", difficulty: 2, diagnostic: true, tolerance: 0.01,
            prompt: "The table shows the scores of 30 students in a quiz. Score: 1, 2, 3, 4, 5 with frequencies 4, 7, 9, 6, 4. Work out the mean score, correct to 2 decimal places.",
            answer: 2.97,
            explanation: "Multiply each score by its frequency and add: 4 + 14 + 27 + 24 + 20 = 89. Divide by the total frequency 30: 89 ÷ 30 = 2.97.",
          },
          {
            key: "stats-y10-05", kind: "number", difficulty: 2, diagnostic: true, tolerance: 0.05,
            prompt: "The heights of 30 plants are grouped. 0 < h ≤ 10: 5 plants. 10 < h ≤ 20: 12 plants. 20 < h ≤ 30: 8 plants. 30 < h ≤ 40: 5 plants. Estimate the mean height, to 1 decimal place.",
            answer: 19.3,
            explanation: "Use midpoints 5, 15, 25, 35: 5×5 + 12×15 + 8×25 + 5×35 = 25 + 180 + 200 + 175 = 580. Divide by 30: 580 ÷ 30 = 19.3.",
          },
          {
            key: "stats-y10-06", kind: "number", difficulty: 2,
            prompt: "90 students each choose their favourite sport. 24 choose football. In a pie chart, what angle represents football, in degrees?",
            answer: 96,
            explanation: "Angle = 24 ÷ 90 × 360 = 96°.",
          },
          {
            key: "stats-y10-07", kind: "number", difficulty: 2, tolerance: 2,
            prompt: "The scatter graph shows hours of revision and test scores, with a line of best fit. Use the line of best fit to estimate the test score for a student who revised for 7 hours.",
            answer: 55,
            explanation: "Go up from 7 on the horizontal axis to the line of best fit, then across to the vertical axis. The line is at about 55 (not the nearby plotted cross, which is an individual student).",
            image: { file: "stats-y10-scatter.png", alt: "A scatter graph. The horizontal axis is hours of revision from 0 to 10 and the vertical axis is test score out of 80, from 0 to 80. Ten blue crosses rise from about 24 at 1 hour to about 72 at 10 hours, close to a straight red line of best fit that starts at 20 on the vertical axis and ends at 70 when the revision is 10 hours." },
          },
          {
            key: "stats-y10-08", kind: "number", difficulty: 2,
            prompt: "A school has 800 pupils: 200 in Year 7, 240 in Year 8 and 360 in Year 9. A stratified sample of 80 pupils is taken. How many Year 9 pupils are in the sample?",
            answer: 36,
            explanation: "Year 9 is 360/800 of the school. So the sample has 360/800 × 80 = 36 Year 9 pupils.",
          },
          {
            key: "stats-y10-09", kind: "number", difficulty: 2,
            prompt: "The mean of five numbers is 8. Four of the numbers are 5, 7, 9 and 10. What is the fifth number?",
            answer: 9,
            explanation: "The total of five numbers with mean 8 is 5 × 8 = 40. The four known numbers total 31, so the fifth is 40 − 31 = 9.",
          },
          {
            key: "stats-y10-10", kind: "number", difficulty: 3,
            prompt: "12 boys have a mean height of 150 cm and 18 girls have a mean height of 160 cm. Work out the mean height of all 30 children, in cm.",
            answer: 156,
            explanation: "Find each total: 12 × 150 = 1800 and 18 × 160 = 2880. The combined total is 4680, and 4680 ÷ 30 = 156 cm. (Not the average of 150 and 160, because there are more girls.)",
          },
          {
            key: "stats-y10-11", kind: "single", difficulty: 2,
            prompt: "Aisha wants to find the most popular sport in her town. She asks 50 people as they leave a gym. Why might her sample be biased?",
            options: ["The sample is too large to be reliable", "The people surveyed are not representative of the whole town", "Random sampling gives unreliable results", "She should only have asked children"],
            answer: "The people surveyed are not representative of the whole town",
            explanation: "People leaving a gym are more likely to like sport than the general population, so the sample does not represent everyone and is biased.",
          },
          {
            key: "stats-y10-12", kind: "number", difficulty: 3,
            prompt: "The table shows a data set. Value: 1, 2, 3, 4 with frequencies 5, f, 7, 3. The mean value is 2.4. Find f.",
            answer: 5,
            explanation: "Total frequency = 15 + f. Σxf = 5 + 2f + 21 + 12 = 38 + 2f. Set (38 + 2f) ÷ (15 + f) = 2.4: 38 + 2f = 36 + 2.4f, so 2 = 0.4f and f = 5.",
          },
          {
            key: "stats-y10-13", kind: "written", difficulty: 3, marks: 3,
            prompt: "Team A's 100 m times (seconds) have mean 12.4 and range 3.1. Team B's times have mean 11.8 and range 6.5. Compare the two teams' performances.",
            answer: "Team B is faster on average (lower mean time). Team A is more consistent (smaller range).",
            explanation: "Mark scheme (3 marks): 1 for comparing averages in context (Team B's mean 11.8 s is lower, so B is faster on average); 1 for comparing spread (Team A's range 3.1 is smaller, so A is more consistent); 1 for a linked, contextual conclusion using both (for example 'B is quicker on average but less consistent').",
          },
        ],
      },
      flashcards: [
        { front: "Mean", back: "Total of all the values ÷ number of values." },
        { front: "Median", back: "The middle value of ordered data (for an even count: the mean of the middle two)." },
        { front: "Mode", back: "The most common value." },
        { front: "Range", back: "Largest value − smallest value." },
        { front: "Mean from a frequency table", back: "Σ(x × f) ÷ Σf" },
        { front: "Estimated mean from grouped data", back: "Use each class midpoint: Σ(midpoint × f) ÷ Σf." },
        { front: "Pie chart angle", back: "frequency ÷ total × 360°" },
        { front: "Positive vs negative correlation", back: "Positive: both go up together. Negative: one goes up as the other goes down." },
        { front: "Line of best fit", back: "A straight line through the data with roughly equal points above and below." },
        { front: "Why avoid extrapolating?", back: "Predictions outside the range of the data are unreliable." },
        { front: "Stratified sample size for a group", back: "(group size ÷ population) × sample size" },
        { front: "What makes a sample biased?", back: "It is not representative, e.g. surveying only one type of person." },
      ],
    },
    11: {
      year: 11,
      objectives: [
        "Construct and interpret histograms with unequal class widths using frequency density.",
        "Draw and interpret cumulative frequency graphs; find median, quartiles and interquartile range.",
        "Draw and interpret box plots.",
        "Compare distributions using medians, interquartile ranges and ranges.",
        "Estimate the mean and frequencies from grouped data.",
      ],
      note: {
        title: "Year 11 Statistics: histograms, cumulative frequency and box plots",
        body: `## What you need to know

**Histograms.** With unequal class widths, the **area** of a bar (not its height) shows the frequency. The vertical axis is **frequency density**:
**frequency density = frequency ÷ class width**, so frequency = frequency density × class width.

**Cumulative frequency (CF).** Add up frequencies as you go and plot each running total against the **upper class boundary**. Join with a smooth curve. For n data values read:
- median at n/2
- lower quartile Q1 at n/4
- upper quartile Q3 at 3n/4
- **interquartile range (IQR) = Q3 − Q1**

**Box plots.** Show the minimum, Q1, median, Q3 and maximum. The box is the middle 50% of the data.

**Comparing distributions.** Always mention **an average** (median) and **spread** (IQR is better than range because it ignores extreme values), and put the answer in context.

## Worked example 1: histogram
A class 20 < t ≤ 24 has frequency 12. Class width 4, so frequency density = 12 ÷ 4 = **3**.

## Worked example 2: cumulative frequency
With n = 120, the median is the value at 60. If Q1 = 41 and Q3 = 67 then IQR = **26**.

## Worked example 3: reading a curve
The number of values below 55 is the CF at 55. The number **above** 55 is n minus that.

| Measure | Read at |
| --- | --- |
| Q1 | n ÷ 4 |
| Median | n ÷ 2 |
| Q3 | 3n ÷ 4 |
| IQR | Q3 − Q1 |`,
      },
      quiz: {
        title: "Statistics: Year 11 GCSE quiz",
        questions: [
          {
            key: "stats-y11-01", kind: "number", difficulty: 1, tolerance: 0.001,
            prompt: "A histogram class 10 < x ≤ 30 has a frequency of 50. What is its frequency density?",
            answer: 2.5,
            explanation: "Class width = 30 − 10 = 20. Frequency density = frequency ÷ class width = 50 ÷ 20 = 2.5.",
          },
          {
            key: "stats-y11-02", kind: "number", difficulty: 1,
            prompt: "The lower quartile of a data set is 18 and the upper quartile is 42. What is the interquartile range?",
            answer: 24,
            explanation: "IQR = upper quartile − lower quartile = 42 − 18 = 24.",
          },
          {
            key: "stats-y11-03", kind: "number", difficulty: 1,
            prompt: "A cumulative frequency graph shows 80 data values. What cumulative frequency do you read across from to find the median?",
            answer: 40,
            explanation: "The median is at the halfway point: n ÷ 2 = 80 ÷ 2 = 40.",
          },
          {
            key: "stats-y11-04", kind: "number", difficulty: 2, diagnostic: true,
            prompt: "The histogram shows the times, in minutes, taken by 100 people to finish a puzzle. How many people took more than 30 minutes?",
            answer: 48,
            explanation: "Frequency = frequency density × class width. For 30 to 50: 1.5 × 20 = 30. For 50 to 80: 0.6 × 30 = 18. Together 30 + 18 = 48 people.",
            image: { file: "stats-y11-hist.png", alt: "A histogram with time taken in minutes from 0 to 80 on the horizontal axis and frequency density from 0 to 3.0 on the vertical axis. Five bars of unequal widths: 0 to 10 with height 0.8, 10 to 20 with height 1.8, 20 to 30 with height 2.6, 30 to 50 with height 1.5 and 50 to 80 with height 0.6." },
          },
          {
            key: "stats-y11-05", kind: "number", difficulty: 2, diagnostic: true,
            prompt: "The box plots show the test scores of two classes. What is the interquartile range of Class A?",
            answer: 35,
            explanation: "Read the edges of Class A's box: Q1 = 35 and Q3 = 70. IQR = 70 − 35 = 35.",
            image: { file: "stats-y11-box.png", alt: "Two horizontal box plots on a scale from 0 to 100 marks. Class A: minimum 20, lower quartile 35, median 50, upper quartile 70, maximum 90. Class B: minimum 30, lower quartile 45, median 55, upper quartile 65, maximum 80." },
          },
          {
            key: "stats-y11-06", kind: "single", difficulty: 2,
            prompt: "Using the box plots of the two classes' test scores, which class has the higher median score?",
            options: ["Class A", "Class B", "They have the same median", "It cannot be worked out"],
            answer: "Class B",
            explanation: "The median is the line inside the box. Class B's median is 55 and Class A's is 50, so Class B is higher.",
            image: { file: "stats-y11-box.png", alt: "Two horizontal box plots on a scale from 0 to 100 marks. Class A: minimum 20, lower quartile 35, median 50, upper quartile 70, maximum 90. Class B: minimum 30, lower quartile 45, median 55, upper quartile 65, maximum 80." },
          },
          {
            key: "stats-y11-07", kind: "number", difficulty: 2, tolerance: 1,
            prompt: "The cumulative frequency graph shows the heights, in cm, of 100 students. Use the graph to estimate the median height.",
            answer: 170,
            explanation: "The median is at cumulative frequency 100 ÷ 2 = 50. Read across from 50 to the curve, then down to the height axis: 170 cm.",
            image: { file: "stats-y11-cf.png", alt: "A cumulative frequency curve. The horizontal axis is height in centimetres from 140 to 200 and the vertical axis is cumulative frequency from 0 to 100. The S-shaped curve starts at 0 at 140 cm and passes through 10 at 150, 25 at 160, 50 at 170, 75 at 180 and 90 at 190, ending at 100 at 200 cm." },
          },
          {
            key: "stats-y11-08", kind: "number", difficulty: 2,
            prompt: "Use the cumulative frequency graph of the heights of 100 students to work out how many students are taller than 190 cm.",
            answer: 10,
            explanation: "The cumulative frequency at 190 cm is 90, so 90 students are 190 cm or shorter. That leaves 100 − 90 = 10 taller students.",
            image: { file: "stats-y11-cf.png", alt: "A cumulative frequency curve. The horizontal axis is height in centimetres from 140 to 200 and the vertical axis is cumulative frequency from 0 to 100. The S-shaped curve starts at 0 at 140 cm and passes through 10 at 150, 25 at 160, 50 at 170, 75 at 180 and 90 at 190, ending at 100 at 200 cm." },
          },
          {
            key: "stats-y11-09", kind: "number", difficulty: 2, tolerance: 0.001,
            prompt: "In a histogram, the bar for the class 20 < x ≤ 25 has height (frequency density) 3.2. What is the frequency of this class?",
            answer: 16,
            explanation: "Frequency = frequency density × class width = 3.2 × 5 = 16.",
          },
          {
            key: "stats-y11-10", kind: "number", difficulty: 3,
            prompt: "Use the histogram of puzzle times (bars: 0–10 height 0.8, 10–20 height 1.8, 20–30 height 2.6, 30–50 height 1.5, 50–80 height 0.6). Estimate how many people took between 15 and 30 minutes.",
            answer: 35,
            explanation: "15 to 20 is half of the 10–20 bar: 5 × 1.8 = 9. The 20–30 bar has 10 × 2.6 = 26. Total 9 + 26 = 35 people.",
            image: { file: "stats-y11-hist.png", alt: "A histogram with time taken in minutes from 0 to 80 on the horizontal axis and frequency density from 0 to 3.0 on the vertical axis. Five bars of unequal widths: 0 to 10 with height 0.8, 10 to 20 with height 1.8, 20 to 30 with height 2.6, 30 to 50 with height 1.5 and 50 to 80 with height 0.6." },
          },
          {
            key: "stats-y11-11", kind: "number", difficulty: 3,
            prompt: "Grouped data: 0 < x ≤ 10 has frequency 4; 10 < x ≤ 30 has frequency 12; 30 < x ≤ 60 has frequency 4. Estimate the mean.",
            answer: 22,
            explanation: "Use the midpoints 5, 20 and 45: 4×5 + 12×20 + 4×45 = 20 + 240 + 180 = 440. Divide by the total frequency 20: 440 ÷ 20 = 22.",
          },
          {
            key: "stats-y11-12", kind: "number", difficulty: 3, tolerance: 1,
            prompt: "Use the cumulative frequency graph of the heights of 100 students to estimate the interquartile range, in cm.",
            answer: 20,
            explanation: "Q1 is at cumulative frequency 25: 160 cm. Q3 is at 75: 180 cm. IQR = 180 − 160 = 20 cm.",
            image: { file: "stats-y11-cf.png", alt: "A cumulative frequency curve. The horizontal axis is height in centimetres from 140 to 200 and the vertical axis is cumulative frequency from 0 to 100. The S-shaped curve starts at 0 at 140 cm and passes through 10 at 150, 25 at 160, 50 at 170, 75 at 180 and 90 at 190, ending at 100 at 200 cm." },
          },
          {
            key: "stats-y11-13", kind: "written", difficulty: 3, marks: 4,
            prompt: "Using the box plots of Class A and Class B test scores, compare the two distributions. Refer to an average and to spread, and give your answer in context.",
            answer: "Class B has the higher median (55 against 50). Class B's scores are more consistent: IQR 20 against Class A's 35.",
            explanation: "Mark scheme (4 marks): 1 for the medians 50 and 55; 1 for a comparison of averages in context (B typically scored higher); 1 for the IQRs 35 and 20 (or the ranges 70 and 50); 1 for a comparison of spread in context (B's scores were more consistent, A's more varied).",
            image: { file: "stats-y11-box.png", alt: "Two horizontal box plots on a scale from 0 to 100 marks. Class A: minimum 20, lower quartile 35, median 50, upper quartile 70, maximum 90. Class B: minimum 30, lower quartile 45, median 55, upper quartile 65, maximum 80." },
          },
        ],
      },
      flashcards: [
        { front: "Frequency density", back: "frequency ÷ class width" },
        { front: "Histogram: what shows the frequency?", back: "The area of each bar (frequency = frequency density × class width)." },
        { front: "Cumulative frequency is plotted against…", back: "The upper class boundary." },
        { front: "Median on a cumulative frequency graph", back: "Read across at n ÷ 2." },
        { front: "Lower and upper quartiles", back: "Read across at n ÷ 4 and 3n ÷ 4." },
        { front: "Interquartile range", back: "Upper quartile − lower quartile (the spread of the middle 50%)." },
        { front: "Five values shown on a box plot", back: "Minimum, lower quartile, median, upper quartile, maximum." },
        { front: "Why is the IQR better than the range?", back: "It ignores extreme values, so it is less affected by outliers." },
        { front: "Comparing two distributions", back: "Compare an average and a measure of spread, in context." },
        { front: "Number of values above a given x on a CF graph", back: "n − (cumulative frequency at x)." },
        { front: "Estimating a frequency inside a histogram bar", back: "Use the fraction of the class width × the bar's frequency." },
        { front: "Estimated mean from grouped data", back: "Σ(midpoint × frequency) ÷ Σfrequency." },
      ],
    },
  },
};
