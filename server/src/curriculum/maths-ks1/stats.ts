// KS1 Maths — Statistics (Year 2 only: tally charts, tables, block diagrams and pictograms). Original content aligned to
// the DfE National Curriculum (OGL v3.0). Answer keys are recomputed by _check_m1.ts from _m1_image_data.json, the same file
// that draws the pictures — re-run it after ANY edit here.
import type { CTopic } from "../types";

const IMG = {
  tally: { file: "stats-tally.png", alt: "A tally chart called Fruit and Tally with four rows: Apple, Banana, Grape and Pear. Each row has tally marks drawn as short upright lines, with every fifth line drawn across the four before it to make a group of five. Apple has one group of five and one single line. Banana has three lines. Grape has one group of five and three single lines. Pear has one group of five." },
  pictogram: { file: "stats-pictogram.png", alt: "A pictogram called Favourite pets. Each row has a word and a line of round yellow star symbols: Dog has 4 symbols, Cat has 3, Fish has 1 and Rabbit has 2. A key at the bottom says that one symbol equals 2 children." },
  block: { file: "stats-block.png", alt: "A block diagram called Favourite colour. The words 1 square = 1 child are under the title. There are four stacks of coloured squares standing on a line. Red has 5 squares, Blue has 3, Green has 6 and Yellow has 2. The colour names are written under each stack." },
};

export const TOPIC: CTopic = {
  key: "stats",
  topic: "Statistics",
  subject: "Maths",
  years: {
    2: {
      year: 2,
      objectives: [
        "Interpret and construct simple pictograms, tally charts, block diagrams and simple tables.",
        "Ask and answer simple questions by counting the number of objects in each category and sorting the categories by quantity.",
        "Ask and answer questions about totalling and comparing categorical data.",
      ],
      note: {
        title: "Year 2: tally charts, pictograms and block diagrams",
        body: `## What to know

**Statistics** is collecting information (data) and showing it so it is easy to read.

- **Tally chart**: draw one line for each answer. Every 5th line goes **across** the first four, so we can count in 5s.
- **Table**: information in rows and columns.
- **Pictogram**: pictures or symbols show the numbers. Always read the **key**. If one symbol means 2, then 3 symbols means 6.
- **Block diagram**: one square for each thing. The taller the stack, the more there is.

| Chart | How to read it |
| --- | --- |
| tally | count in 5s, then add the extra lines |
| pictogram | multiply the number of symbols by what the key says |
| block diagram | count the squares in the stack |

Useful words: **most popular** (biggest number), **fewest** (smallest number), **altogether** (add), **how many more** (find the difference).

## Say it like this

"Look at the title and the key first. Then count each row."

## Worked example 1: tally

A tally shows one group of 5 and 2 more lines for Bus. That is 5 + 2 = **7** children.

## Worked example 2: pictogram

The key says one symbol = 5 children. Walking has 3 symbols. That is 3 × 5 = **15** children.

## Worked example 3: comparing

Cars: 9. Bikes: 4. How many more cars than bikes? 9 − 4 = **5** more.

**Tip for grown-ups:** ask your child to make a tally of the colours of cars on your street.`,
      },
      quiz: {
        title: "Statistics: Year 2 quiz",
        questions: [
          { key: "stats-y2-01", kind: "single", prompt: "Which fruit did the most children choose?", options: ["Apple", "Banana", "Grape", "Pear"], answer: "Grape", image: IMG.tally, explanation: "Count each row. Grape has the most tally marks (one group of 5 and 3 more).", difficulty: 1 },
          { key: "stats-y2-02", kind: "number", prompt: "How many children chose Banana?", answer: 3, image: IMG.tally, explanation: "Banana has 3 single lines, so 3 children chose Banana.", difficulty: 1 },
          { key: "stats-y2-03", kind: "number", prompt: "How many children chose a fruit altogether?", answer: 22, image: IMG.tally, explanation: "Count each row: Apple 6, Banana 3, Grape 8, Pear 5. Then add: 6 + 3 + 8 + 5 = 22.", difficulty: 2, diagnostic: true },
          { key: "stats-y2-04", kind: "number", prompt: "Tom counted cars: red 4, blue 6, white 3. How many cars did he count altogether?", answer: 13, explanation: "Add the three groups: 4 + 6 + 3 = 13.", difficulty: 2 },
          { key: "stats-y2-05", kind: "number", prompt: "How many children chose Dog?", answer: 8, image: IMG.pictogram, explanation: "Dog has 4 symbols and each symbol is 2 children. Count in 2s: 2, 4, 6, 8.", difficulty: 2, diagnostic: true },
          { key: "stats-y2-06", kind: "single", prompt: "Which pet did the fewest children choose?", options: ["Fish", "Dog", "Rabbit", "Cat"], answer: "Fish", image: IMG.pictogram, explanation: "Fish has only 1 symbol, which is the fewest.", difficulty: 2 },
          { key: "stats-y2-07", kind: "number", prompt: "How many children were asked altogether?", answer: 20, image: IMG.pictogram, explanation: "Count the symbols: 4 + 3 + 1 + 2 = 10 symbols. Each is 2 children, so 10 × 2 = 20.", difficulty: 3 },
          { key: "stats-y2-08", kind: "single", prompt: "Which colour did the most children choose?", options: ["Red", "Blue", "Yellow", "Green"], answer: "Green", image: IMG.block, explanation: "Green has the tallest stack of squares.", difficulty: 1 },
          { key: "stats-y2-09", kind: "number", prompt: "How many children chose Red?", answer: 5, image: IMG.block, explanation: "Count the red squares. Each square is 1 child. There are 5.", difficulty: 2 },
          { key: "stats-y2-10", kind: "number", prompt: "How many children chose Red or Green?", answer: 11, image: IMG.block, explanation: "Red has 5 squares and Green has 6. Add them: 5 + 6 = 11.", difficulty: 3 },
        ],
      },
      flashcards: [
        { front: "In a tally, a line across four lines means…", back: "5" },
        { front: "A tally shows a group of 5 and 3 more. How many?", back: "8" },
        { front: "What does the key on a pictogram tell us?", back: "What each symbol is worth" },
        { front: "One symbol = 2. How many for 5 symbols?", back: "10" },
        { front: "In a block diagram, 1 square is…", back: "1 child (or 1 thing)" },
        { front: "Most popular means…", back: "The biggest number" },
        { front: "Fewest means…", back: "The smallest number" },
        { front: "Altogether means…", back: "Add everything up" },
        { front: "How many more? means…", back: "Subtract (find the difference)" },
        { front: "A table shows information in…", back: "Rows and columns" },
      ],
    },
  },
  notIntroduced: { 1: "The national curriculum introduces statistics in Year 2." },
};
