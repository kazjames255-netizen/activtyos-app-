// KS1 Maths — Geometry: Position & Direction (Years 1–2). Original content aligned to the DfE National Curriculum (OGL v3.0).
// Answer keys are recomputed by _check_m1.ts (grid and turn questions are recomputed from data) — re-run it after ANY edit here.
// Pictures: scratch/curriculum-images/maths-ks1/.
import type { CTopic } from "../types";

const IMG = {
  arrows: { file: "pos-arrows.png", alt: "Four white boxes in a row, labelled A, B, C and D. Each box has one big blue arrow. In A the arrow points up. In B it points to the left. In C it points down. In D it points to the right." },
  grid: { file: "pos-grid.png", alt: "A square grid of 5 columns and 5 rows. A yellow circle labelled Start is in the second column from the left, in the second row up from the bottom. Four blue circles with letters sit on the grid: A is in the fourth column in the top row, C is in the fifth column in the top row, B is in the fifth column in the second row from the top, and D is in the third column in the second row from the top." },
};

export const TOPIC: CTopic = {
  key: "pos",
  topic: "Geometry — Position & Direction",
  subject: "Maths",
  years: {
    1: {
      year: 1,
      objectives: [
        "Describe position, direction and movement, including whole, half, quarter and three-quarter turns.",
        "Use everyday words for position: left, right, top, middle, bottom, above, below, on top of, in front of, behind, next to, between.",
        "Use words for movement: forwards, backwards, up, down.",
      ],
      note: {
        title: "Year 1: where things are and how to turn",
        body: `## What to know

**Position words** tell us where something is: **left**, **right**, **top**, **middle**, **bottom**, **above**, **below**, **next to**, **between**, **behind**, **in front of**.

**Direction words** tell us which way to go: **forwards**, **backwards**, **up**, **down**.

**Turns** are parts of a whole turn:
- **whole turn**: you end up facing the same way you started.
- **half turn**: you face the opposite way.
- **quarter turn**: you turn to face the side.
- **three-quarter turn**: nearly all the way round.

| Turn | How many quarters |
| --- | --- |
| quarter turn | 1 |
| half turn | 2 |
| three-quarter turn | 3 |
| whole turn | 4 |

## Say it like this

"Stand up and turn slowly. Stop when you have done a quarter turn. What can you see now?"

## Worked example 1: position

Three cars 🚗🚕🚙 in a row. The 🚕 is **between** the other two.

## Worked example 2: a turn

You face the tree and do a half turn. You now face the **opposite** way: away from the tree.

## Worked example 3: movement

Take 5 steps forwards, then 5 steps backwards. You are **back where you started**.

**Tip for grown-ups:** play "Simon says" with left, right and turns.`,
      },
      quiz: {
        title: "Geometry — Position & Direction: Year 1 quiz",
        questions: [
          { key: "pos-y1-01", kind: "single", prompt: "Which arrow points to the left?", options: ["A", "B", "C", "D"], answer: "B", image: IMG.arrows, explanation: "Left is the side where your left hand is. Arrow B points that way.", difficulty: 1 },
          { key: "pos-y1-02", kind: "single", prompt: "A bird 🐦 is high up over a tree 🌳. The bird is ___ the tree.", options: ["above", "below", "inside"], answer: "above", explanation: "The bird is higher than the tree, so it is above the tree.", difficulty: 1 },
          { key: "pos-y1-03", kind: "single", prompt: "You face the door. You do a half turn, then another half turn. Which way do you face?", options: ["Away from the door", "Left of the door", "Facing the door"], answer: "Facing the door", explanation: "Two half turns make a whole turn. A whole turn brings you back to where you started.", difficulty: 3 },
          { key: "pos-y1-04", kind: "single", prompt: "You face the board. You do a half turn. Where do you face now?", options: ["Still the board", "Away from the board", "To the side"], answer: "Away from the board", explanation: "A half turn takes you to face the opposite way.", difficulty: 2, diagnostic: true },
          { key: "pos-y1-05", kind: "number", prompt: "How many quarter turns make a whole turn?", answer: 4, explanation: "Each quarter turn is one of four equal parts. Four quarters make a whole turn.", difficulty: 2, diagnostic: true },
          { key: "pos-y1-06", kind: "single", prompt: "You face the window. You do a quarter turn to the right. The window is now on your…", options: ["left", "right", "back"], answer: "left", explanation: "When you turn right, the things that were in front of you end up on your left.", difficulty: 3 },
          { key: "pos-y1-07", kind: "single", prompt: "Look at 🍎 🍌 🍇. Which fruit is in the middle?", options: ["🍇", "🍎", "🍌"], answer: "🍌", explanation: "The banana has one fruit on each side. It is in the middle.", difficulty: 1 },
          { key: "pos-y1-08", kind: "single", prompt: "Ali takes 3 steps forwards. Then he takes 3 steps backwards. Where is he?", options: ["Where he started", "3 steps forwards", "6 steps forwards"], answer: "Where he started", explanation: "Backwards undoes forwards, so he ends up back at the start.", difficulty: 2 },
          { key: "pos-y1-09", kind: "single", prompt: "Which turn is the biggest?", options: ["a quarter turn", "a half turn", "a three-quarter turn"], answer: "a three-quarter turn", explanation: "A quarter is 1 part of 4, a half is 2 parts of 4 and three-quarters is 3 parts of 4. Three parts is the most.", difficulty: 2 },
          { key: "pos-y1-10", kind: "multi", prompt: "Which words tell us about position? Choose two.", options: ["above", "hopped", "under", "yellow"], answer: ["above", "under"], explanation: "Above and under tell us where something is. Hopped is what it did, and yellow is a colour.", difficulty: 2 },
        ],
      },
      flashcards: [
        { front: "A whole turn takes you…", back: "Back to where you started" },
        { front: "A half turn makes you face…", back: "The opposite way" },
        { front: "How many half turns make a whole turn?", back: "2" },
        { front: "The opposite of forwards", back: "Backwards" },
        { front: "The opposite of left", back: "Right" },
        { front: "The opposite of above", back: "Below" },
        { front: "The opposite of top", back: "Bottom" },
        { front: "Between means…", back: "In the middle of two things" },
        { front: "A quarter turn is one of how many equal parts of a whole turn?", back: "4" },
      ],
    },
    2: {
      year: 2,
      objectives: [
        "Order and arrange combinations of mathematical objects in patterns and sequences.",
        "Use mathematical vocabulary to describe position, direction and movement, including movement in a straight line.",
        "Distinguish between rotation as a turn and in terms of right angles for quarter, half and three-quarter turns (clockwise and anticlockwise).",
      ],
      note: {
        title: "Year 2: patterns, grids and turns",
        body: `## What to know

**Patterns** repeat. Look for the part that repeats (the "core") and say it out loud: 🟦🟩 🟦🟩 🟦🟩 …

**Turns and right angles**
- A **quarter turn** is a turn of **1 right angle**.
- A **half turn** is **2 right angles**.
- A **three-quarter turn** is **3 right angles**.
- A **whole turn** is **4 right angles**.
- **Clockwise** goes the same way as the hands of a clock. **Anticlockwise** goes the opposite way.

| Start facing | Quarter turn clockwise | Half turn | Three-quarter turn clockwise |
| --- | --- | --- | --- |
| left ← | up ↑ | right → | down ↓ |
| right → | down ↓ | left ← | up ↑ |

**Moving on a grid**: count squares across first (left or right), then up or down.

## Say it like this

"Which way do the hands of a clock go? That is clockwise."

## Worked example 1: a pattern

🟡🟡🟢 🟡🟡🟢 🟡🟡🟢 ? The part that repeats is 🟡🟡🟢. Next comes 🟡.

## Worked example 2: turning

Facing right →, turn a half turn. You face **left** ←, because a half turn is 2 right angles.

## Worked example 3: a grid

Start at the bottom left. Move 2 squares right, then 1 square up. Count across, then up.

**Tip for grown-ups:** make patterns with beads, then spot the repeating part.`,
      },
      quiz: {
        title: "Geometry — Position & Direction: Year 2 quiz",
        questions: [
          { key: "pos-y2-01", kind: "single", prompt: "The frog starts on Start. It jumps 3 squares right and 2 squares up. Which letter does it land on?", options: ["A", "B", "C", "D"], answer: "B", image: IMG.grid, explanation: "From Start move 3 squares right, then 2 squares up. That square has the letter B.", difficulty: 2, diagnostic: true },
          { key: "pos-y2-02", kind: "single", prompt: "What comes next?\n🔴🔵🔴🔵🔴 ?", options: ["🔵", "🔴", "🟢"], answer: "🔵", explanation: "The pattern goes red, blue, red, blue. After red comes blue.", difficulty: 1 },
          { key: "pos-y2-03", kind: "single", prompt: "What comes next?\n⭐⭐🌙 ⭐⭐🌙 ⭐⭐ ?", options: ["⭐", "🌙", "🔺"], answer: "🌙", explanation: "The repeating part is star, star, moon. We have had two stars, so the moon comes next.", difficulty: 2 },
          { key: "pos-y2-04", kind: "single", prompt: "An arrow points up ↑. It turns a quarter turn clockwise. Which way does it point now?", options: ["←", "↓", "→"], answer: "→", explanation: "Clockwise is the way the clock hands go, from up to the right. So it points right.", difficulty: 2, diagnostic: true },
          { key: "pos-y2-05", kind: "single", prompt: "Zoe does a quarter turn clockwise, then another quarter turn clockwise. What turn is that altogether?", options: ["a quarter turn", "a half turn", "a three-quarter turn", "a whole turn"], answer: "a half turn", explanation: "One quarter plus one quarter makes two quarters, which is a half turn.", difficulty: 2 },
          { key: "pos-y2-06", kind: "number", prompt: "How many right angles make a whole turn?", answer: 4, explanation: "A quarter turn is one right angle, so a whole turn is four right angles.", difficulty: 1 },
          { key: "pos-y2-07", kind: "single", prompt: "An arrow points up ↑. It turns a three-quarter turn clockwise. Which way does it point now?", options: ["←", "→", "↓", "↑"], answer: "←", explanation: "Turn clockwise one quarter at a time: up to right, right to down, down to left. Three quarters ends pointing left.", difficulty: 3 },
          { key: "pos-y2-08", kind: "single", prompt: "An arrow points down ↓. It does a half turn. Which way does it point now?", options: ["↓", "←", "↑", "→"], answer: "↑", explanation: "A half turn makes it face the opposite way. The opposite of down is up.", difficulty: 2 },
          { key: "pos-y2-09", kind: "single", prompt: "The pattern 🔺🔵🟩 repeats over and over. What is the 8th shape?", options: ["🔺", "🔵", "🟩"], answer: "🔵", explanation: "The pattern repeats every 3 shapes. The 6th shape is 🟩, so the 7th is 🔺 and the 8th is 🔵.", difficulty: 3 },
          { key: "pos-y2-10", kind: "single", prompt: "Turning the opposite way to the hands of a clock is called…", options: ["clockwise", "anticlockwise", "backwards"], answer: "anticlockwise", explanation: "Clockwise goes the same way as clock hands. The opposite way is anticlockwise.", difficulty: 1 },
        ],
      },
      flashcards: [
        { front: "A quarter turn is how many right angles?", back: "1" },
        { front: "A half turn is how many right angles?", back: "2" },
        { front: "A three-quarter turn is how many right angles?", back: "3" },
        { front: "Clockwise means…", back: "The same way as the hands of a clock" },
        { front: "Anticlockwise means…", back: "The opposite way to the hands of a clock" },
        { front: "Facing right →, a half turn makes you face…", back: "Left ←" },
        { front: "The part of a pattern that repeats is called the…", back: "Core" },
        { front: "On a grid, which way do we count first?", back: "Across, then up or down" },
        { front: "Facing down ↓, a quarter turn clockwise makes you face…", back: "Left ←" },
      ],
    },
  },
};
