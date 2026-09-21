// Geometry — Position & Direction (KS2 Maths). Original content aligned to the DfE programme of study (OGL v3.0).
// Images are drawn from data in _k4data.ts by scratch/curriculum-images/gen-k4.ts; answers are re-checked by _check_k4.ts.
import type { CTopic } from "../types";

export const TOPIC: CTopic = {
  key: "pos",
  topic: "Geometry — Position & Direction",
  subject: "Maths",
  notIntroduced: { 3: "Introduced informally within shape work — no standalone strand until Year 4." },
  years: {
    4: {
      year: 4,
      objectives: [
        "Describe positions on a 2-D grid as coordinates in the first quadrant.",
        "Describe movements between positions as translations of a given unit to the left/right and up/down.",
        "Plot specified points and draw sides to complete a given polygon.",
      ],
      note: {
        title: "Coordinates and translations (first quadrant)",
        body: `## Reading and writing coordinates

A **coordinate pair** tells you exactly where a point is on a grid. It is written in brackets, like **(4, 7)**.

- The **first** number says how far to go **across** (along the bottom, the x-axis).
- The **second** number says how far to go **up** (up the side, the y-axis).

A helpful phrase: **"along the corridor, then up the stairs."** The point (0, 0) where the axes meet is called the **origin**. Remember that (2, 5) and (5, 2) are *different* points.

## Translations

A **translation** slides a point or shape to a new place. It does not turn or flip it. We describe it with a move right or left, then a move up or down.

- Moving **right** adds to the across number; moving **left** takes away.
- Moving **up** adds to the up number; moving **down** takes away.

## Worked examples

**Example 1.** Point A is 3 across and 5 up. Write its coordinates.
Across first: **A = (3, 5)**.

**Example 2.** Translate the point (1, 2) by 3 right and 4 up.
Across: 1 + 3 = 4. Up: 2 + 4 = 6. The new point is **(4, 6)**.

**Example 3.** Plot (1, 1), (4, 1) and (4, 3), then join the points in order and close the shape. You have drawn a **right-angled triangle**.`,
      },
      quiz: {
        title: "Position & Direction — Year 4 quiz",
        questions: [
          {
            key: "pos-y4-01", kind: "single", difficulty: 1, diagnostic: true,
            prompt: "The picture shows four points on a grid. What are the coordinates of point B?",
            options: ["(3, 6)", "(6, 3)", "(6, 6)", "(3, 3)"],
            answer: "(6, 3)",
            explanation: "Go across to 6 first, then up to 3, so B is at (6, 3). Always read across first, then up.",
            image: { file: "pos-y4-grid.png", alt: "A grid with both axes numbered 0 to 8 and four labelled points A, B, C and D scattered across it." },
          },
          {
            key: "pos-y4-02", kind: "single", difficulty: 1,
            prompt: "In the coordinates (4, 7), what does the first number, 4, tell you?",
            options: ["How many squares to go across", "How many squares to go up", "How many squares there are in total", "The size of the shape"],
            answer: "How many squares to go across",
            explanation: "The first number is always how far to go across along the bottom axis. The second number is how far to go up.",
          },
          {
            key: "pos-y4-03", kind: "single", difficulty: 1,
            prompt: "This treasure map is drawn on a grid. Which place is at (3, 6)?",
            options: ["Boat", "Cave", "Palm tree", "Lighthouse"],
            answer: "Lighthouse",
            explanation: "Go across 3, then up 6, and you find the lighthouse. The boat is at (6, 3), which has the two numbers the wrong way round.",
            image: { file: "pos-y4-map.png", alt: "A treasure map drawn on a grid numbered 0 to 8 on both axes, with four labelled places: a lighthouse, a boat, a cave and a palm tree." },
          },
          {
            key: "pos-y4-04", kind: "single", difficulty: 2,
            prompt: "A, B and C are three corners of a rectangle. What are the coordinates of the fourth corner?",
            options: ["(5, 2)", "(2, 6)", "(2, 5)", "(6, 6)"],
            answer: "(2, 5)",
            explanation: "The missing corner is directly above A, so it has A's across number, 2. It is level with C, so it has C's up number, 5. That gives (2, 5).",
            image: { file: "pos-y4-rect.png", alt: "A grid numbered 0 to 8 across and 0 to 7 up. Three corners of a rectangle are marked A, B and C, with a line drawn from A to B and from B to C. The fourth corner is missing." },
          },
          {
            key: "pos-y4-05", kind: "single", difficulty: 2, diagnostic: true,
            prompt: "Point P moves to point Q. Which describes this translation?",
            options: ["2 right and 4 up", "4 right and 2 up", "4 right and 2 down", "6 right and 5 up"],
            answer: "4 right and 2 up",
            explanation: "Across: P is at 2 and Q is at 6, so it moves 4 to the right. Up: P is at 3 and Q is at 5, so it moves 2 up.",
            image: { file: "pos-y4-move.png", alt: "A grid numbered 0 to 8 across and 0 to 7 up with two labelled points, P and Q. Q is to the right of and higher than P." },
          },
          {
            key: "pos-y4-06", kind: "multi", difficulty: 2,
            prompt: "Which of these points are exactly 4 squares up from the bottom axis? Choose all that apply.",
            options: ["(2, 4)", "(4, 2)", "(7, 4)", "(4, 7)"],
            answer: ["(2, 4)", "(7, 4)"],
            explanation: "The second number says how far up. Points with a 4 as the second number are 4 squares up, so (2, 4) and (7, 4) are correct.",
          },
          {
            key: "pos-y4-07", kind: "single", difficulty: 2,
            prompt: "You plot the points (1, 1), (4, 1), (4, 4) and (1, 4) and join them in order. What shape do you draw?",
            options: ["A square with sides of 3 squares", "A rectangle that is longer than it is tall", "A triangle", "A square with sides of 4 squares"],
            answer: "A square with sides of 3 squares",
            explanation: "Each side goes from 1 to 4, which is 3 squares, and all four sides match. That makes a square with sides of 3 squares.",
          },
          {
            key: "pos-y4-08", kind: "number", difficulty: 2,
            prompt: "Point A is at (2, 3) and point B is at (7, 3). How many squares apart are the two points?",
            answer: 5,
            explanation: "Both points are 3 squares up, so only the across number changes. Count from 2 to 7: 7 − 2 = 5 squares.",
          },
          {
            key: "pos-y4-09", kind: "short", difficulty: 3,
            prompt: "A corner of a shape is at (2, 1). The shape is translated 4 right and 3 up, and then translated 1 left and 2 down. Where is the corner now? Write it like (3, 4).",
            answer: "(5, 2)",
            accepted: ["5,2", "(5,2)", "5, 2"],
            explanation: "Follow the across number: 2 + 4 − 1 = 5. Follow the up number: 1 + 3 − 2 = 2. The corner ends at (5, 2).",
          },
          {
            key: "pos-y4-10", kind: "single", difficulty: 3,
            prompt: "Triangle ABT is moved 2 squares right and 1 square up. What are the new coordinates of corner T?",
            options: ["(5, 4)", "(4, 7)", "(1, 4)", "(5, 6)"],
            answer: "(5, 6)",
            explanation: "First read T from the grid: (3, 5). Moving 2 right gives 3 + 2 = 5 and moving 1 up gives 5 + 1 = 6, so T moves to (5, 6).",
            image: { file: "pos-y4-triangle.png", alt: "A grid numbered 0 to 8 on both axes with a shaded triangle. Its corners are labelled A and B along the bottom, and T at the top." },
          },
        ],
      },
      flashcards: [
        { front: "What does the coordinate pair (4, 7) mean?", back: "Go 4 across, then 7 up." },
        { front: "Which number comes first in a coordinate pair?", back: "The across number (x). The up number (y) comes second." },
        { front: "Memory trick for coordinates", back: "\"Along the corridor, then up the stairs.\" Across first, up second." },
        { front: "What is the origin?", back: "The point (0, 0), where the two axes meet." },
        { front: "Are (2, 5) and (5, 2) the same point?", back: "No. (2, 5) is 2 across and 5 up. (5, 2) is 5 across and 2 up." },
        { front: "What is a translation?", back: "Sliding a point or shape to a new place without turning or flipping it." },
        { front: "Translate (1, 4) by 3 right and 2 up.", back: "(4, 6). Add 3 to the across number and 2 to the up number." },
        { front: "What do you do to the coordinates to move left?", back: "Take away from the first (across) number." },
        { front: "What do you do to the coordinates to move down?", back: "Take away from the second (up) number." },
        { front: "How do you draw a polygon from coordinates?", back: "Plot each corner, then join them in order with straight lines and close the shape." },
        { front: "The point (3, 0) is how far up?", back: "0 squares up. It sits on the bottom axis, 3 across from the origin." },
      ],
    },
    5: {
      year: 5,
      objectives: [
        "Identify, describe and represent the position of a shape following a reflection on a 2-D grid (first quadrant).",
        "Identify, describe and represent the position of a shape following a translation on a 2-D grid (first quadrant).",
        "Know that a shape's size and shape stay the same after a reflection or translation.",
      ],
      note: {
        title: "Reflections and translations",
        body: `## Two ways to move a shape

**Reflection** flips a shape over a **mirror line**. The reflected shape (the **image**) is the same size and shape, but it faces the opposite way.

**Translation** slides a shape without turning or flipping it. Every corner moves the same distance in the same direction.

## The mirror-line rule

Every point and its image are the **same distance from the mirror line**, on opposite sides.

- In a **vertical** mirror line the *across* number changes and the *up* number stays the same.
- In a **horizontal** mirror line the *up* number changes and the *across* number stays the same.
- A corner that touches the mirror line stays exactly where it is.

## Worked examples

**Example 1.** Reflect the point (3, 2) in a vertical mirror line through 6 on the bottom axis.
The point is 3 squares left of the line, so the image is 3 squares right: 6 + 3 = 9. The image is at **(9, 2)**.

**Example 2.** Reflect (3, 1) in a horizontal mirror line at height 4.
The point is 3 below the line, so the image is 3 above: 4 + 3 = 7. The image is at **(3, 7)**.

**Example 3.** Describe how a shape moves if its corner (1, 3) goes to (5, 5).
Across: 1 to 5 is 4 to the right. Up: 3 to 5 is 2 up. The translation is **4 right and 2 up**.

Tip: move each corner one at a time, then join them up.`,
      },
      quiz: {
        title: "Position & Direction — Year 5 quiz",
        questions: [
          {
            key: "pos-y5-01", kind: "single", difficulty: 1, diagnostic: true,
            prompt: "Point P is reflected in the mirror line. What are the coordinates of its image?",
            options: ["(7, 4)", "(8, 4)", "(2, 8)", "(5, 4)"],
            answer: "(8, 4)",
            explanation: "P is 3 squares to the left of the mirror line, so its image is 3 squares to the right of it: 5 + 3 = 8 across. It stays 4 up.",
            image: { file: "pos-y5-mirror.png", alt: "A grid numbered 0 to 10 across and 0 to 7 up. A dashed vertical mirror line runs up the grid, and a single point P is marked to the left of it." },
          },
          {
            key: "pos-y5-02", kind: "single", difficulty: 1,
            prompt: "A shape is reflected in a mirror line. What stays the same?",
            options: ["Its position on the grid", "Which way round it faces", "Its size and shape", "Its distance from the left edge"],
            answer: "Its size and shape",
            explanation: "A reflection only flips the shape. It stays the same size and the same shape, but it moves to the other side of the mirror line and faces the opposite way.",
          },
          {
            key: "pos-y5-03", kind: "single", difficulty: 1,
            prompt: "A shape slides 4 squares to the right without turning or flipping. What is this movement called?",
            options: ["A reflection", "A translation", "A rotation", "An enlargement"],
            answer: "A translation",
            explanation: "Sliding a shape in a straight line, with no turning or flipping, is called a translation.",
          },
          {
            key: "pos-y5-04", kind: "single", difficulty: 2, diagnostic: true,
            prompt: "Shape A is translated to shape B. Which describes the translation?",
            options: ["5 right and 3 down", "3 right and 5 down", "5 right and 3 up", "5 left and 3 down"],
            answer: "5 right and 3 down",
            explanation: "Compare matching corners. The bottom-left corner of A is at (1, 5) and of B is at (6, 2), so it moves 5 to the right and 3 down.",
            image: { file: "pos-y5-translate.png", alt: "A grid numbered 0 to 10 across and 0 to 8 up. A blue four-sided shape labelled A is near the top left, and an identical orange shape labelled B is lower and further right." },
          },
          {
            key: "pos-y5-05", kind: "single", difficulty: 2,
            prompt: "The blue shape is reflected in the dashed mirror line. Which picture shows the correct reflection?",
            options: ["Picture A", "Picture B", "Picture C", "Picture D"],
            answer: "Picture C",
            explanation: "A reflection is flipped and each corner is the same distance from the mirror as its partner. In C the tall side is 3 squares from the mirror, like the original. A has just slid, B is too far away and D is upside down.",
            image: { file: "pos-y5-panels.png", alt: "Four small grids labelled A to D. Each shows the same blue right-angled triangle on the left of a dashed vertical mirror line, and an orange triangle on the right that is a possible reflection. Only one orange triangle is a correct mirror image." },
          },
          {
            key: "pos-y5-06", kind: "single", difficulty: 2,
            prompt: "The triangle is reflected in the horizontal mirror line. What are the coordinates of the image of corner X?",
            options: ["(2, 7)", "(7, 2)", "(2, 8)", "(2, 6)"],
            answer: "(2, 7)",
            explanation: "X is 2 squares below the mirror line (5 − 3 = 2), so its image is 2 squares above it: 5 + 2 = 7. The across number stays 2, so the image is at (2, 7).",
            image: { file: "pos-y5-hmirror.png", alt: "A grid numbered 0 to 8 across and 0 to 9 up. A dashed horizontal mirror line runs across the grid high up. Below it is a shaded triangle with its top corner labelled X." },
          },
          {
            key: "pos-y5-07", kind: "single", difficulty: 2,
            prompt: "A rectangle has corners at (2, 1), (5, 1), (5, 3) and (2, 3). It is translated 4 squares right and 2 squares up. Where does the corner (5, 3) move to?",
            options: ["(7, 7)", "(9, 3)", "(6, 5)", "(9, 5)"],
            answer: "(9, 5)",
            explanation: "Moving 4 right adds 4 to the across number: 5 + 4 = 9. Moving 2 up adds 2 to the up number: 3 + 2 = 5. The corner moves to (9, 5).",
          },
          {
            key: "pos-y5-08", kind: "short", difficulty: 3,
            prompt: "The point (1, 2) is translated 3 right and 4 up. It is then reflected in a vertical mirror line that goes up through 6 on the bottom axis. What are its final coordinates? Write it like (3, 4).",
            answer: "(8, 6)",
            accepted: ["8,6", "(8,6)", "8, 6"],
            explanation: "After the translation the point is at (1 + 3, 2 + 4) = (4, 6). That is 2 squares left of the mirror line at 6, so the image is 2 squares to the right: (8, 6).",
          },
          {
            key: "pos-y5-09", kind: "single", difficulty: 3,
            prompt: "The triangle is reflected in the mirror line, which runs along one of its sides. The triangle and its reflection are put together. What shape do they make?",
            options: ["An isosceles triangle", "A right-angled triangle", "A rectangle", "A kite"],
            answer: "An isosceles triangle",
            explanation: "The reflection has corners (3, 1), (3, 5) and (5, 1). Together with the original they make one triangle with corners (1, 1), (5, 1) and (3, 5), which has two equal sloping sides, so it is isosceles.",
            image: { file: "pos-y5-touch.png", alt: "A grid numbered 0 to 6 on both axes. A shaded right-angled triangle has its upright side lying along a dashed vertical mirror line." },
          },
          {
            key: "pos-y5-10", kind: "multi", difficulty: 2,
            prompt: "Which of these statements about reflection are true? Choose all that apply.",
            options: [
              "Each corner is the same distance from the mirror line as its image",
              "The reflected shape is larger than the original",
              "The image is a mirror picture on the opposite side of the mirror line",
              "The shape slides across without flipping",
            ],
            answer: [
              "Each corner is the same distance from the mirror line as its image",
              "The image is a mirror picture on the opposite side of the mirror line",
            ],
            explanation: "A reflection keeps the size the same and makes a mirror picture on the other side, with matching distances from the mirror line. Sliding without flipping is a translation.",
          },
        ],
      },
      flashcards: [
        { front: "What is a reflection?", back: "A flip of a shape over a mirror line. The image is the same size and shape but faces the opposite way." },
        { front: "The distance rule for reflections", back: "Each point and its image are the same distance from the mirror line, on opposite sides." },
        { front: "Vertical mirror line: which coordinate changes?", back: "The across (first) number changes. The up (second) number stays the same." },
        { front: "Horizontal mirror line: which coordinate changes?", back: "The up (second) number changes. The across (first) number stays the same." },
        { front: "Reflect (1, 3) in a vertical mirror line through 4.", back: "(7, 3). It is 3 left of the line, so the image is 3 to the right." },
        { front: "What is a translation?", back: "Sliding a shape without turning or flipping it. Every corner moves the same way." },
        { front: "Translate (3, 2) by 4 right and 1 up.", back: "(7, 3)." },
        { front: "How do you describe a translation?", back: "Say the left/right move and the up/down move, e.g. \"5 right and 3 down\"." },
        { front: "A corner of a shape touches the mirror line. Where is its image?", back: "In exactly the same place, because it is 0 squares from the line." },
        { front: "What stays the same after a reflection or translation?", back: "The size and shape of the figure. Only its position (and, for a reflection, which way it faces) changes." },
        { front: "Tip for reflecting a shape", back: "Reflect each corner separately, then join the new corners in the same order." },
      ],
    },
    6: {
      year: 6,
      objectives: [
        "Describe positions on the full coordinate grid (all four quadrants).",
        "Draw and translate simple shapes on the coordinate plane.",
        "Reflect simple shapes in the axes.",
      ],
      note: {
        title: "The full coordinate grid",
        body: `## Four quadrants

Extend the axes past zero and you get a grid with **four quadrants**. The axes cross at the **origin (0, 0)**.

- **Right** of the origin: the across number (x) is positive. **Left**: negative.
- **Above** the origin: the up number (y) is positive. **Below**: negative.
- A point on the **x-axis** has y = 0. A point on the **y-axis** has x = 0.

| Part of the grid | x | y |
| --- | --- | --- |
| Top right | positive | positive |
| Top left | negative | positive |
| Bottom left | negative | negative |
| Bottom right | positive | negative |

## Transformations

- **Translation:** add or subtract from each coordinate. Moving left or down makes numbers smaller.
- **Reflect in the y-axis (the vertical axis):** the across number changes sign, e.g. (5, 1) becomes (−5, 1).
- **Reflect in the x-axis (the horizontal axis):** the up number changes sign, e.g. (5, 1) becomes (5, −1).

## Worked examples

**Example 1.** Translate (−2, 3) by 4 right and 5 down.
−2 + 4 = 2 and 3 − 5 = −2, so the point moves to **(2, −2)**.

**Example 2.** Reflect (−3, 2) in the x-axis.
The across number stays the same and the up number changes sign: **(−3, −2)**.

**Example 3.** How far is (−3, 2) from (4, −2) across the grid?
Across: from −3 to 4 is 7. Up/down: from 2 to −2 is 4. When crossing zero, *add* the distances on each side.`,
      },
      quiz: {
        title: "Position & Direction — Year 6 quiz",
        questions: [
          {
            key: "pos-y6-01", kind: "single", difficulty: 1, diagnostic: true,
            prompt: "What are the coordinates of point B?",
            options: ["(4, −3)", "(−3, 4)", "(−4, 3)", "(4, 3)"],
            answer: "(−4, 3)",
            explanation: "B is 4 squares to the left of the origin, so the across number is −4, and 3 squares up, so the up number is 3. That gives (−4, 3).",
            image: { file: "pos-y6-grid.png", alt: "A coordinate grid with both axes numbered from −6 to 6, showing all four quadrants, with four labelled points A, B, C and D." },
          },
          {
            key: "pos-y6-02", kind: "single", difficulty: 1,
            prompt: "Which point is in the bottom-left part of the grid, where both coordinates are negative?",
            options: ["Point C", "Point A", "Point B", "Point D"],
            answer: "Point C",
            explanation: "Both coordinates negative means left of the origin and below it. Only point C is in that bottom-left part of the grid.",
            image: { file: "pos-y6-grid.png", alt: "A coordinate grid with both axes numbered from −6 to 6, showing all four quadrants, with four labelled points A, B, C and D." },
          },
          {
            key: "pos-y6-03", kind: "single", difficulty: 2,
            prompt: "Which of these points lies on the y-axis?",
            options: ["(−4, 0)", "(4, 4)", "(−4, −4)", "(0, −4)"],
            answer: "(0, −4)",
            explanation: "A point on the y-axis has not moved left or right, so its across number is 0. (0, −4) is 4 squares below the origin.",
          },
          {
            key: "pos-y6-04", kind: "single", difficulty: 2, diagnostic: true,
            prompt: "Triangle PQR is translated 5 squares right and 3 squares down. What are the new coordinates of corner R?",
            options: ["(−8, 1)", "(1, 2)", "(2, 1)", "(2, 7)"],
            answer: "(2, 1)",
            explanation: "R is at (−3, 4). Add 5 to the across number: −3 + 5 = 2. Take 3 from the up number: 4 − 3 = 1. So R moves to (2, 1).",
            image: { file: "pos-y6-triangle.png", alt: "A coordinate grid numbered from −6 to 6 on both axes. A shaded triangle sits in the top-left part of the grid. Its corners are labelled P and Q along the bottom and R at the top." },
          },
          {
            key: "pos-y6-05", kind: "single", difficulty: 2,
            prompt: "The triangle is reflected in the x-axis. What are the coordinates of the image of corner P?",
            options: ["(−4, −4)", "(4, 4)", "(4, −4)", "(−4, −5)"],
            answer: "(−4, −4)",
            explanation: "Reflecting in the x-axis flips the shape up or down. P is at (−4, 4): the across number stays −4 and the up number changes sign to −4.",
            image: { file: "pos-y6-reflect.png", alt: "A coordinate grid numbered from −6 to 6 on both axes. A shaded triangle is in the top-left part of the grid, with one corner labelled P." },
          },
          {
            key: "pos-y6-06", kind: "single", difficulty: 2,
            prompt: "A, B and C are three corners of a rectangle. What are the coordinates of the fourth corner?",
            options: ["(3, −3)", "(−3, −3)", "(−3, 3)", "(−3, −4)"],
            answer: "(−3, −3)",
            explanation: "The missing corner is directly below A, so its across number is A's, −3. It is level with C, so its up number is C's, −3. That gives (−3, −3).",
            image: { file: "pos-y6-rect.png", alt: "A coordinate grid numbered from −6 to 6 on both axes. Three corners of a rectangle are marked A, B and C. A is on the left above the x-axis, B is on the right at the same height, and C is directly below B, below the x-axis. Lines join A to B and B to C." },
          },
          {
            key: "pos-y6-07", kind: "single", difficulty: 1,
            prompt: "How do you get from the origin (0, 0) to the point (−2, 5)?",
            options: ["2 right and 5 up", "2 left and 5 up", "2 left and 5 down", "5 left and 2 up"],
            answer: "2 left and 5 up",
            explanation: "A negative across number means moving left, and a positive up number means moving up. So go 2 left and 5 up.",
          },
          {
            key: "pos-y6-08", kind: "single", difficulty: 2,
            prompt: "Point P moves to point Q. Which describes this translation?",
            options: ["1 right and 4 down", "4 right and 5 down", "5 right and 2 down", "5 right and 4 down"],
            answer: "5 right and 4 down",
            explanation: "Across: from −2 to 3 is 5 to the right. Up/down: from 3 down to −1 is 3 + 1 = 4 down. When you cross zero, add the two distances rather than subtracting.",
            image: { file: "pos-y6-move.png", alt: "A coordinate grid numbered from −6 to 6 on both axes with two labelled points. P is in the top-left part of the grid and Q is in the bottom-right part." },
          },
          {
            key: "pos-y6-09", kind: "single", difficulty: 3,
            prompt: "A triangle has corners at (1, 2), (4, 2) and (1, 6). It is reflected in the y-axis and then translated 2 squares down. Where does the corner (4, 2) end up?",
            options: ["(4, 0)", "(−4, 0)", "(−4, 4)", "(−6, 2)"],
            answer: "(−4, 0)",
            explanation: "Reflecting in the y-axis changes the sign of the across number, so (4, 2) becomes (−4, 2). Moving 2 down gives 2 − 2 = 0, so the corner ends at (−4, 0).",
          },
          {
            key: "pos-y6-10", kind: "single", difficulty: 3,
            prompt: "Points E and F are joined by a straight line. What are the coordinates of the midpoint of the line?",
            options: ["(−2, 1)", "(3, 1)", "(1, 1)", "(−1, 1)"],
            answer: "(−1, 1)",
            explanation: "E is at (−4, 1) and F is at (2, 1), so the line is 6 squares long and the midpoint is 3 squares from each end: −4 + 3 = −1. The midpoint is (−1, 1).",
            image: { file: "pos-y6-mid.png", alt: "A coordinate grid numbered from −6 to 6 on both axes. Two points, E on the left and F on the right, are joined by a horizontal line that lies just above the x-axis and crosses the y-axis." },
          },
        ],
      },
      flashcards: [
        { front: "Where is the origin?", back: "(0, 0), where the x-axis and y-axis cross." },
        { front: "What signs do the coordinates have in the top-left part of the grid?", back: "x is negative and y is positive, e.g. (−3, 2)." },
        { front: "What signs do the coordinates have in the bottom-right part of the grid?", back: "x is positive and y is negative, e.g. (3, −2)." },
        { front: "What signs do the coordinates have in the bottom-left part?", back: "Both negative, e.g. (−3, −2)." },
        { front: "What is special about points on the y-axis?", back: "Their across number (x) is 0, e.g. (0, −4)." },
        { front: "What is special about points on the x-axis?", back: "Their up number (y) is 0, e.g. (5, 0)." },
        { front: "Reflect (5, 1) in the y-axis.", back: "(−5, 1). The across number changes sign." },
        { front: "Reflect (5, 1) in the x-axis.", back: "(5, −1). The up number changes sign." },
        { front: "Translate (−1, 2) by 3 left and 4 down.", back: "(−4, −2)." },
        { front: "Moving from −4 to 2 across the grid: how far?", back: "6. When you cross zero, add the distances on each side (4 + 2)." },
        { front: "How do you find the midpoint of two points on a horizontal line?", back: "Add the two across numbers and halve them, e.g. (−6 + 2) ÷ 2 = −2." },
      ],
    },
  },
};
