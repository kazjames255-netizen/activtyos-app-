// KS1 Science — Seasonal Changes (Year 1). Original content aligned to the DfE National Curriculum programme of study (OGL v3.0).
// Structural checks (answers in options, positions, chart numbers) are in _check_s1.ts — re-run it after ANY edit here.
import type { CTopic } from "../types";
import { IMG, multi, number, short, single } from "./_h";

export const TOPIC: CTopic = {
  key: "seasons",
  topic: "Seasonal Changes",
  subject: "Science",
  years: {
    1: {
      year: 1,
      objectives: [
        "Observe changes across the four seasons.",
        "Observe and describe weather associated with the seasons and how day length varies.",
      ],
      note: {
        title: "Year 1: the four seasons, weather and day length",
        body: `## The four seasons

In the UK there are four seasons. They come round in the same order every year:

**spring → summer → autumn → winter → spring again**

| Season | What it is like in the UK |
| --- | --- |
| **Spring** | Getting warmer. New leaves and flowers. Showers. |
| **Summer** | The warmest season. Sunny days. Long days. |
| **Autumn** | Getting cooler and windy. Many trees change colour and drop their leaves. |
| **Winter** | The coldest season. Short days. Frost and sometimes snow. |

## Weather

Weather is what it is like outside: sunny, rainy, windy, cloudy, snowy or foggy.

## Day length

**Day length** is how long it is light. In summer the days are long. In winter the days are short and it gets dark early.

## Staying safe

On very hot days use sun cream and stay in the shade. **Never look straight at the Sun.** It can hurt your eyes.

**Worked example:** Ana sees daffodils flowering and new lambs in a field. There are April showers. It is spring.`,
      },
      quiz: {
        title: "Seasonal Changes: Year 1 quiz",
        questions: [
          single("seasons-y1-01", "Which season comes after summer?", ["Winter", "Autumn", "Spring", "Summer"], 1, "The order is spring, summer, autumn, winter. Autumn comes after summer.", 1),
          single("seasons-y1-02", "Look at the pictures.\nWhich tree shows winter?", ["A", "B", "C", "D"], 1, "In winter, many trees have no leaves. Tree B has bare branches.", 1, { image: IMG.trees }),
          short("seasons-y1-03", "Which season comes after winter?\nType one word.", "spring", ["Spring", "SPRING", "the spring", "springtime", "spring time", "spring."], "After winter the year starts again with spring.", 1),
          single("seasons-y1-04", "Look at the pictures.\nWhich tree shows autumn?", ["A", "B", "C", "D"], 2, "In autumn, leaves turn orange, red and yellow and fall to the ground. That is tree C.", 2, { image: IMG.trees, diagnostic: true }),
          single("seasons-y1-05", "Look at the graph.\nWhich month has the MOST daylight?", ["June", "December", "March", "September"], 0, "The June bar is the tallest, with about 16 hours of daylight.", 2, { image: IMG.daylight, diagnostic: true }),
          { ...number("seasons-y1-06", "Look at the graph.\nHow many MORE hours of daylight in June than in December?", 8, "June has about 16 hours and December has about 8. 16 − 8 = 8 more hours.", 3, { image: IMG.daylight }), tolerance: 0 },
          single("seasons-y1-07", "In the UK, which season is July in?", ["Winter", "Spring", "Summer", "Autumn"], 2, "July is in the middle of the warm, sunny summer.", 2),
          multi("seasons-y1-08", "Which TWO words are kinds of weather?", ["Rainy", "Sunday", "Windy", "Autumn"], [0, 2], "Rainy and windy tell us about the weather. Sunday is a day, and autumn is a season.", 2),
          single("seasons-y1-09", "It is a hot, sunny day.\nWhat is the safest thing to do?", ["Look straight at the Sun", "Stay in the Sun with no water", "Wear a hat and drink water", "Wear a big winter coat"], 2, "A hat keeps the Sun off your head and water stops you getting too hot. Never look at the Sun.", 2),
          single("seasons-y1-10", "The pond has ice on it. It gets dark at 4 o'clock.\nThe trees have no leaves. Which season?", ["Summer", "Autumn", "Spring", "Winter"], 3, "Ice, early darkness and bare trees are clues for winter.", 3),
        ],
      },
      flashcards: [
        { front: "Name the four seasons in order", back: "Spring, summer, autumn, winter." },
        { front: "Spring", back: "Getting warmer. New leaves, flowers and showers." },
        { front: "Summer", back: "The warmest season, with sunny weather and long days." },
        { front: "Autumn", back: "Getting cooler and windy. Many leaves change colour and fall." },
        { front: "Winter", back: "The coldest season, with short days, frost and sometimes snow." },
        { front: "Weather", back: "What it is like outside: sunny, rainy, windy, cloudy, snowy." },
        { front: "Day length", back: "How long it is light in a day." },
        { front: "When are the days longest in the UK?", back: "In summer." },
        { front: "When are the days shortest in the UK?", back: "In winter." },
        { front: "Sun safety", back: "Use sun cream, stay in the shade and NEVER look straight at the Sun." },
      ],
    },
  },
};
