// KS2 Maths — Geometry: Properties of Shapes (Years 3–6). Original content aligned to the DfE programme
// of study (Open Government Licence v3.0). Every computed answer is re-derived independently by
// _check_k3.ts — run it after ANY edit. Pictures live in scratch/curriculum-images/ks2maths/.
import type { CTopic } from "../types";

const IMG = {
  rightShapes: { file: "shape-right-angle-shapes.png", alt: "Four shapes labelled A to D. A is an equilateral triangle, B is a regular hexagon, C is a triangle with one square corner at its bottom left, and D is a rectangle." },
  parallel: { file: "shape-parallel-lines.png", alt: "Four straight lines labelled A to D. Line A is horizontal near the top. Line B is vertical on the right. Line C is horizontal near the bottom. Line D slopes upwards to the right in the middle of the picture." },
  lShape: { file: "shape-l-shape.png", alt: "An L-shaped figure with six straight sides, all meeting at square corners. It is like a rectangle with a smaller rectangle missing from its top right." },
  angleTypes: { file: "shape-angle-types.png", alt: "Three angles, each drawn as two lines meeting at a point. Angle A is narrow, smaller than a square corner. Angle B is wide, opening further than a square corner. Angle C is exactly a square corner, marked with a small square." },
  rhombus: { file: "shape-rhombus.png", alt: "A slanted four-sided shape shaped like a diamond, wider than it is tall. A small red tick mark on each of the four sides shows that all four sides are the same length. None of its corners is a square corner." },
  symmetry: { file: "shape-symmetry-complete.png", alt: "A square grid 10 squares wide and 5 tall with a dashed red vertical mirror line down the middle. On the left of the mirror line, 9 squares are shaded orange in a pattern that touches the mirror line. The right side of the grid is empty." },
  anglesLine: { file: "shape-angles-line.png", alt: "A straight horizontal line with a second line starting from a point on it and sloping up to the right. The angle on the left, between the sloping line and the straight line, is labelled 128 degrees. The angle on the right is labelled x." },
  anglesPoint: { file: "shape-angles-point.png", alt: "Four lines meet at one point in the middle, dividing the space all the way round into four angles. Going anticlockwise from the right, the angles are labelled 120 degrees, 95 degrees, 80 degrees and x." },
  rectDiagonal: { file: "shape-rectangle-diagonal.png", alt: "A rectangle ABCD with A at bottom left, B at bottom right, C at top right and D at top left, and a red diagonal from A to C. At corner A the angle between side AB and the diagonal is marked 32 degrees. The angle between the diagonal and side AD is marked x." },
  netPrism: { file: "shape-net-prism.png", alt: "A flat pattern (a net) made of three tall rectangles side by side in a row, with one triangle joined to the top edge of the middle rectangle and one triangle joined to its bottom edge. The triangles have three equal sides." },
  regularPolygons: { file: "shape-regular-polygons.png", alt: "Four shapes labelled A to D. A is a diamond-shaped four-sided figure with equal sides. B is a five-sided shape (a pentagon) that looks perfectly even, with all sides and all angles equal. C is a wide rectangle. D is a lopsided five-sided shape with sides of different lengths." },
  triangleAngles: { file: "shape-triangle-angles.png", alt: "A triangle sitting on a horizontal base. The angle at the bottom left is labelled 48 degrees, the angle at the bottom right is labelled 67 degrees and the angle at the top corner is labelled x." },
  circleParts: { file: "shape-circle-parts.png", alt: "A circle with its centre marked O. Three lines are drawn. Line P is a red straight line that goes across the circle from one edge to the opposite edge, passing through O. Line Q is a green line from O to the edge at the top right. Line R is a purple straight line joining two points on the edge near the bottom, and it does not pass through O." },
  quadAngles: { file: "shape-quadrilateral-angles.png", alt: "A four-sided shape (quadrilateral) with no equal sides. Three of its corner angles are labelled 105 degrees, 80 degrees and 92 degrees, and the fourth corner angle is labelled x." },
  vertOpp: { file: "shape-vertical-opposite.png", alt: "Two straight lines crossing each other, making four angles. The wide angle at the top left is labelled 112 degrees. The wide angle directly opposite it, at the bottom right, is labelled x." },
  cubeNets: { file: "shape-cube-nets.png", alt: "Four flat patterns of six squares labelled A to D. A is a row of four squares with one square above and one below the second square. B is a staircase of three pairs of squares stepping down to the right. C is a row of four squares with two squares side by side above the second and third squares of the row. D is a row of three squares joined at the end to a second row of three squares that steps down and to the right." },
};

export const TOPIC: CTopic = {
  key: "shape",
  topic: "Geometry — Properties of Shapes",
  subject: "Maths",
  years: {
    // ───────────────────────────── YEAR 3 ─────────────────────────────
    3: {
      year: 3,
      objectives: [
        "Draw 2-D shapes and make 3-D shapes using modelling materials; recognise 3-D shapes in different orientations and describe them",
        "Recognise angles as a property of shape or a description of a turn",
        "Identify right angles; recognise that two right angles make a half-turn, three make three quarters of a turn and four a complete turn",
        "Identify whether angles are greater than or less than a right angle",
        "Identify horizontal and vertical lines and pairs of perpendicular and parallel lines",
      ],
      note: {
        title: "Shapes, right angles and lines",
        body: `## Angles and turns

An **angle** is the amount of turn between two lines that meet at a point. A **right angle** is a square corner. It is a **quarter turn**.

- 2 right angles = a **half turn**
- 3 right angles = **three-quarters** of a turn
- 4 right angles = a **full turn**

An angle smaller than a right angle is **acute**. An angle bigger than a right angle is **obtuse**.

## Lines

- **Horizontal** lines go straight across, like the horizon. **Vertical** lines go straight up and down.
- **Parallel** lines always stay the same distance apart and never meet.
- **Perpendicular** lines meet at a right angle.

## 3-D shapes

A cube has 6 faces, 12 edges and 8 vertices (corners). A cuboid has the same numbers. A square-based pyramid has 5 faces, 8 edges and 5 vertices.

## Worked examples

**1. Counting right angles.** A rectangle has **4** right angles. An equilateral triangle has none.

**2. Turning.** Mia faces east and turns a quarter turn clockwise. Like a clock hand going from 3 to 6, she now faces **south**.

**3. Edges.** A square-based pyramid has 4 edges round its base, plus 4 edges up to the point: 4 + 4 = **8 edges**.`,
      },
      quiz: {
        title: "Year 3 Properties of Shapes quiz",
        questions: [
          {
            key: "shape-y3-01",
            kind: "single",
            prompt: "How many sides does a hexagon have?",
            options: ["5", "6", "8", "7"],
            answer: "6",
            explanation: "The word 'hexagon' comes from 'hex', meaning six. A hexagon has 6 straight sides.",
            difficulty: 1,
          },
          {
            key: "shape-y3-02",
            kind: "single",
            prompt: "Which shape has exactly one right angle?",
            options: ["Shape A", "Shape B", "Shape D", "Shape C"],
            answer: "Shape C",
            explanation: "A right angle is a square corner. Shape C has one square corner, the rectangle D has four, and A and B have none.",
            difficulty: 1,
            diagnostic: true,
            image: IMG.rightShapes,
          },
          {
            key: "shape-y3-03",
            kind: "single",
            prompt: "How many faces does a cube have?",
            options: ["6", "8", "12", "4"],
            answer: "6",
            explanation: "A cube has 6 square faces: the top, the bottom and four sides.",
            difficulty: 1,
          },
          {
            key: "shape-y3-04",
            kind: "single",
            prompt: "Line A is horizontal. Which other line is parallel to line A?",
            options: ["Line B", "Line D", "Line C", "None of them"],
            answer: "Line C",
            explanation: "Parallel lines run in the same direction and never meet. Line C is horizontal like line A, but B is vertical and D slopes.",
            difficulty: 2,
            diagnostic: true,
            image: IMG.parallel,
          },
          {
            key: "shape-y3-05",
            kind: "single",
            prompt: "Two lines meet at a right angle. What word describes these lines?",
            options: ["Parallel", "Perpendicular", "Horizontal", "Vertical"],
            answer: "Perpendicular",
            explanation: "Lines that meet at a right angle (90°) are perpendicular. Parallel lines never meet at all.",
            difficulty: 2,
          },
          {
            key: "shape-y3-06",
            kind: "single",
            prompt: "Ali faces north. He turns clockwise through one right angle. Which way is he facing now?",
            options: ["West", "South", "North", "East"],
            answer: "East",
            explanation: "One right angle is a quarter turn. A quarter turn clockwise from north (like a clock hand moving from 12 to 3) points east.",
            difficulty: 2,
          },
          {
            key: "shape-y3-07",
            kind: "multi",
            prompt: "Which of these shapes have at least one pair of parallel sides? Select all that apply.",
            options: ["Square", "Rectangle", "Equilateral triangle", "Regular pentagon"],
            answer: ["Square", "Rectangle"],
            explanation: "The opposite sides of a square and of a rectangle are parallel. A triangle has no parallel sides and neither has a regular pentagon.",
            difficulty: 2,
          },
          {
            key: "shape-y3-08",
            kind: "single",
            prompt: "How many edges does a cuboid have?",
            options: ["6", "8", "10", "12"],
            answer: "12",
            explanation: "A cuboid has 4 edges round the top face, 4 round the bottom face and 4 joining them: 4 + 4 + 4 = 12.",
            difficulty: 2,
          },
          {
            key: "shape-y3-09",
            kind: "number",
            prompt: "How many of this shape's corners are right angles? Count only the corners that measure exactly 90° inside the shape.",
            answer: 5,
            explanation: "Going round the L, five of the corners are square (90°). The corner at the inside of the L is bigger than a right angle inside the shape, so it does not count.",
            difficulty: 3,
            image: IMG.lShape,
          },
          {
            key: "shape-y3-10",
            kind: "number",
            prompt: "A triangular prism has 2 triangular faces and 3 rectangular faces. How many edges does it have?",
            answer: 9,
            explanation: "Each triangle has 3 edges, so the two triangles have 3 + 3 = 6 edges. Three more edges join the triangles together: 6 + 3 = 9.",
            difficulty: 3,
          },
        ],
      },
      flashcards: [
        { front: "What is a right angle?", back: "A square corner. It measures 90° and is a quarter turn." },
        { front: "How many right angles make a half turn? A full turn?", back: "2 right angles make a half turn. 4 make a full turn." },
        { front: "What is an acute angle? What is an obtuse angle?", back: "Acute is smaller than a right angle. Obtuse is bigger than a right angle." },
        { front: "What are parallel lines?", back: "Lines that always stay the same distance apart and never meet." },
        { front: "What are perpendicular lines?", back: "Lines that meet at a right angle." },
        { front: "Horizontal or vertical: which goes straight up and down?", back: "Vertical lines go straight up and down. Horizontal lines go straight across." },
        { front: "How many sides do a pentagon, hexagon and octagon have?", back: "5, 6 and 8." },
        { front: "How many faces, edges and vertices does a cube have?", back: "6 faces, 12 edges and 8 vertices." },
        { front: "How many faces does a triangular prism have?", back: "5: two triangles and three rectangles." },
        { front: "Facing east, you turn a quarter turn clockwise. Which way do you face?", back: "South." },
      ],
    },

    // ───────────────────────────── YEAR 4 ─────────────────────────────
    4: {
      year: 4,
      objectives: [
        "Compare and classify geometric shapes, including quadrilaterals and triangles, based on their properties and sizes",
        "Identify acute and obtuse angles and compare and order angles up to two right angles by size",
        "Identify lines of symmetry in 2-D shapes presented in different orientations",
        "Complete a simple symmetric figure with respect to a specific line of symmetry",
      ],
      note: {
        title: "Classifying shapes, angles and symmetry",
        body: `## Angles

- **Acute** angle: less than 90°.
- **Right** angle: exactly 90°.
- **Obtuse** angle: more than 90° but less than 180°.
- A **straight line** is 180°.

## Classifying triangles and quadrilaterals

| Shape | Key properties |
| --- | --- |
| Equilateral triangle | 3 equal sides, 3 equal angles |
| Isosceles triangle | exactly 2 equal sides |
| Scalene triangle | no equal sides |
| Square | 4 equal sides, 4 right angles |
| Rectangle | 4 right angles, opposite sides equal |
| Rhombus | 4 equal sides, opposite angles equal |
| Parallelogram | opposite sides equal and parallel |
| Trapezium | exactly one pair of parallel sides |

A square is a special kind of rectangle, and also a special kind of rhombus.

## Symmetry

A **line of symmetry** splits a shape into two halves that match exactly, like a mirror. A square has 4 lines of symmetry and a rectangle that is not a square has 2. To complete a symmetric figure, reflect each point the **same distance** on the other side of the mirror line.

## Worked examples

**1. Naming.** A shape has 4 equal sides and 4 right angles: it is a **square**.

**2. Ordering angles.** A right angle is 90°. So acute < right < obtuse.

**3. Symmetry.** A pattern has 7 squares on one side of the mirror line. The reflection adds 7 more, so there are **14** in total.`,
      },
      quiz: {
        title: "Year 4 Properties of Shapes quiz",
        questions: [
          {
            key: "shape-y4-01",
            kind: "single",
            prompt: "What type of angle is smaller than a right angle?",
            options: ["Obtuse", "Acute", "Reflex", "Straight"],
            answer: "Acute",
            explanation: "An angle smaller than 90° is acute. An obtuse angle is bigger than 90° but smaller than 180°.",
            difficulty: 1,
          },
          {
            key: "shape-y4-02",
            kind: "single",
            prompt: "How many lines of symmetry does a square have?",
            options: ["1", "2", "4", "8"],
            answer: "4",
            explanation: "A square can be folded along its 2 diagonals and along 2 lines through the middles of opposite sides. That makes 4 lines of symmetry.",
            difficulty: 1,
            diagnostic: true,
          },
          {
            key: "shape-y4-03",
            kind: "single",
            prompt: "A triangle has exactly two sides that are the same length. What is it called?",
            options: ["Scalene", "Equilateral", "Isosceles", "Quadrilateral"],
            answer: "Isosceles",
            explanation: "An isosceles triangle has exactly two equal sides. An equilateral triangle has three equal sides and a scalene triangle has none.",
            difficulty: 2,
          },
          {
            key: "shape-y4-04",
            kind: "single",
            prompt: "Which of the angles A, B or C is an obtuse angle?",
            options: ["A", "B", "C", "None of them"],
            answer: "B",
            explanation: "An obtuse angle is bigger than a right angle but smaller than a straight line. A is narrower than a square corner, C is exactly a square corner, and B is wider than one.",
            difficulty: 2,
            image: IMG.angleTypes,
          },
          {
            key: "shape-y4-05",
            kind: "single",
            prompt: "Ella draws this shape. All four sides are the same length but the corners are not right angles. What is the shape called?",
            options: ["Square", "Kite", "Rectangle", "Rhombus"],
            answer: "Rhombus",
            explanation: "A four-sided shape with all sides equal is a rhombus. It would only be a square if all four angles were right angles as well.",
            difficulty: 2,
            diagnostic: true,
            image: IMG.rhombus,
          },
          {
            key: "shape-y4-06",
            kind: "multi",
            prompt: "Which of these quadrilaterals always have four right angles? Select all that apply.",
            options: ["Square", "Rectangle", "Rhombus", "Parallelogram"],
            answer: ["Square", "Rectangle"],
            explanation: "Squares and rectangles always have four right angles. A rhombus and a parallelogram can be slanted, so their angles are not always 90°.",
            difficulty: 2,
          },
          {
            key: "shape-y4-07",
            kind: "number",
            prompt: "The dashed red line is a mirror line. The orange squares on the left will be reflected to the right of it. How many orange squares will there be altogether when the pattern is complete?",
            answer: 18,
            explanation: "Count the orange squares on the left: 2 + 1 + 3 + 1 + 2 = 9. The reflection makes a matching 9 on the right, so 9 + 9 = 18.",
            difficulty: 2,
            image: IMG.symmetry,
          },
          {
            key: "shape-y4-08",
            kind: "single",
            prompt: "Which of these capital letters has a line of symmetry?",
            options: ["F", "R", "G", "H"],
            answer: "H",
            explanation: "A line of symmetry splits a shape into two matching halves. H can be folded down the middle, but F, R and G cannot.",
            difficulty: 1,
          },
          {
            key: "shape-y4-09",
            kind: "single",
            prompt: "Maya says, 'Every square is a rectangle.' Ravi says, 'Every rectangle is a square.' Who is correct?",
            options: ["Only Maya", "Only Ravi", "Both of them", "Neither of them"],
            answer: "Only Maya",
            explanation: "A rectangle has four right angles, and every square has those, so squares are rectangles. But a rectangle can have unequal sides, so not every rectangle is a square.",
            difficulty: 3,
          },
          {
            key: "shape-y4-10",
            kind: "single",
            prompt: "Angle P is a right angle, angle Q is acute and angle R is obtuse. Which list shows them in order from smallest to largest?",
            options: ["P, Q, R", "Q, R, P", "R, P, Q", "Q, P, R"],
            answer: "Q, P, R",
            explanation: "An acute angle is less than 90°, a right angle is exactly 90° and an obtuse angle is more than 90°. So the order is Q, P, R.",
            difficulty: 3,
          },
        ],
      },
      flashcards: [
        { front: "What is an acute angle?", back: "An angle less than 90° (smaller than a right angle)." },
        { front: "What is an obtuse angle?", back: "An angle more than 90° but less than 180°." },
        { front: "How many degrees are in a straight line?", back: "180°." },
        { front: "What is an isosceles triangle?", back: "A triangle with exactly 2 equal sides (and 2 equal angles)." },
        { front: "What is an equilateral triangle?", back: "A triangle with 3 equal sides and 3 equal angles." },
        { front: "What is a scalene triangle?", back: "A triangle with no equal sides." },
        { front: "What is a rhombus?", back: "A quadrilateral with 4 equal sides. Opposite angles are equal." },
        { front: "What is a trapezium?", back: "A quadrilateral with exactly one pair of parallel sides." },
        { front: "What is a line of symmetry?", back: "A line that splits a shape into two halves that match exactly, like a mirror." },
        { front: "How do you complete a symmetric figure?", back: "Reflect every point the same distance on the other side of the mirror line." },
        { front: "Is a square a rectangle?", back: "Yes. A square is a rectangle with four equal sides." },
      ],
    },

    // ───────────────────────────── YEAR 5 ─────────────────────────────
    5: {
      year: 5,
      objectives: [
        "Identify 3-D shapes, including cubes and other cuboids, from 2-D representations",
        "Know that angles are measured in degrees; estimate and compare acute, obtuse and reflex angles",
        "Draw given angles, and measure them in degrees",
        "Identify angles at a point and one whole turn (total 360°), angles at a point on a straight line and half a turn (total 180°), and other multiples of 90°",
        "Use the properties of rectangles to deduce related facts and find missing lengths and angles",
        "Distinguish between regular and irregular polygons based on reasoning about equal sides and angles",
      ],
      note: {
        title: "Angles in degrees, rectangles and regular polygons",
        body: `## Measuring angles

Angles are measured in **degrees (°)** with a protractor. A full turn is 360°, a half turn (straight line) is 180° and a right angle is 90°.

- **Acute:** less than 90°. **Obtuse:** between 90° and 180°. **Reflex:** between 180° and 360°.

## Angle facts

- Angles **on a straight line** add up to **180°**.
- Angles **around a point** add up to **360°**.
- Every corner of a **rectangle** is 90°, and opposite sides are equal.

## Polygons and 3-D shapes

A **regular polygon** has all its sides equal **and** all its angles equal. Any polygon that is not like this is **irregular**. A **net** is a flat pattern that folds up to make a 3-D shape: for example, six squares joined edge to edge can fold into a cube.

## Worked examples

**1. On a line.** One angle is 115° and the other is x. x = 180° − 115° = **65°**.

**2. At a point.** Angles 110°, 85° and 90° meet with x. 110 + 85 + 90 = 285, so x = 360° − 285° = **75°**.

**3. Rectangle.** A diagonal makes 41° with one side. The corner is 90°, so the angle with the other side is 90° − 41° = **49°**.`,
      },
      quiz: {
        title: "Year 5 Properties of Shapes quiz",
        questions: [
          {
            key: "shape-y5-01",
            kind: "single",
            prompt: "How many degrees are there in a right angle?",
            options: ["45°", "180°", "360°", "90°"],
            answer: "90°",
            explanation: "A right angle is a quarter of a full turn. 360° ÷ 4 = 90°.",
            difficulty: 1,
          },
          {
            key: "shape-y5-02",
            kind: "single",
            prompt: "The angles on the straight line are 128° and x. What is x?",
            options: ["62°", "52°", "232°", "28°"],
            answer: "52°",
            explanation: "Angles on a straight line add up to 180°. So x = 180° − 128° = 52°.",
            difficulty: 1,
            diagnostic: true,
            image: IMG.anglesLine,
          },
          {
            key: "shape-y5-03",
            kind: "single",
            prompt: "What do the angles around a point add up to?",
            options: ["360°", "180°", "270°", "90°"],
            answer: "360°",
            explanation: "Angles around a point make one full turn, and a full turn is 360°.",
            difficulty: 1,
          },
          {
            key: "shape-y5-04",
            kind: "number",
            prompt: "Four angles meet at a point: 120°, 95°, 80° and x. What is x, in degrees?",
            answer: 65,
            explanation: "Angles at a point add up to 360°. 120 + 95 + 80 = 295, so x = 360 − 295 = 65°.",
            difficulty: 2,
            image: IMG.anglesPoint,
          },
          {
            key: "shape-y5-05",
            kind: "single",
            prompt: "ABCD is a rectangle. The diagonal AC makes an angle of 32° with side AB. What is angle x, between the diagonal and side AD?",
            options: ["32°", "148°", "68°", "58°"],
            answer: "58°",
            explanation: "Every corner of a rectangle is 90°. The 32° angle and x fit together to make the corner at A, so x = 90° − 32° = 58°.",
            difficulty: 2,
            image: IMG.rectDiagonal,
          },
          {
            key: "shape-y5-06",
            kind: "single",
            prompt: "A rectangle is 12 cm long and has a perimeter of 40 cm. How wide is it?",
            options: ["28 cm", "8 cm", "16 cm", "4 cm"],
            answer: "8 cm",
            explanation: "The length and width together make half the perimeter: 40 ÷ 2 = 20 cm. So the width is 20 − 12 = 8 cm.",
            difficulty: 2,
          },
          {
            key: "shape-y5-07",
            kind: "single",
            prompt: "This flat pattern (a net) is folded up. Which 3-D shape does it make?",
            options: ["Cuboid", "Square-based pyramid", "Triangular prism", "Triangular-based pyramid"],
            answer: "Triangular prism",
            explanation: "The three rectangles wrap round to make the sides, and the two triangles become the ends. That makes a triangular prism.",
            difficulty: 2,
            diagnostic: true,
            image: IMG.netPrism,
          },
          {
            key: "shape-y5-08",
            kind: "single",
            prompt: "Which of these shapes is a regular polygon?",
            options: ["Shape A", "Shape C", "Shape D", "Shape B"],
            answer: "Shape B",
            explanation: "A regular polygon has all sides equal and all angles equal. Only B has both: A has equal sides but unequal angles, and C has equal angles but unequal sides.",
            difficulty: 2,
            image: IMG.regularPolygons,
          },
          {
            key: "shape-y5-09",
            kind: "number",
            prompt: "ABCD is a rectangle. Side AB is 14 cm long and the perimeter of the rectangle is 46 cm. What is the area of the rectangle in cm²?",
            answer: 126,
            explanation: "AB + BC is half the perimeter: 46 ÷ 2 = 23, so BC = 23 − 14 = 9 cm. The area is 14 × 9 = 126 cm².",
            difficulty: 3,
          },
          {
            key: "shape-y5-10",
            kind: "number",
            prompt: "Five equal angles meet at a point. What size is each angle, in degrees?",
            answer: 72,
            explanation: "Angles at a point add up to 360°. Share them equally between 5 angles: 360 ÷ 5 = 72°.",
            difficulty: 3,
          },
          {
            key: "shape-y5-11",
            kind: "single",
            prompt: "An angle is a little smaller than a right angle. Which is the best estimate of its size?",
            options: ["20°", "80°", "110°", "170°"],
            answer: "80°",
            explanation: "A right angle is 90°, so an angle a little smaller is just under 90°. Of the choices, 80° is the best estimate.",
            difficulty: 2,
          },
          {
            key: "shape-y5-12",
            kind: "single",
            prompt: "An angle measures 250°. What type of angle is it?",
            options: ["Acute", "Obtuse", "Right", "Reflex"],
            answer: "Reflex",
            explanation: "A reflex angle is bigger than 180° (a straight line) but smaller than 360°. 250° is in that range, so it is reflex.",
            difficulty: 1,
          },
        ],
      },
      flashcards: [
        { front: "How many degrees in a right angle? A straight line? A full turn?", back: "90°, 180° and 360°." },
        { front: "What are acute, obtuse and reflex angles?", back: "Acute: less than 90°. Obtuse: between 90° and 180°. Reflex: between 180° and 360°." },
        { front: "Angles on a straight line add up to…?", back: "180°. Find a missing angle by subtracting from 180°." },
        { front: "Angles around a point add up to…?", back: "360°. Find a missing angle by subtracting the others from 360°." },
        { front: "What are the angles of a rectangle?", back: "All four corners are 90°." },
        { front: "Perimeter of a rectangle is 36 cm and length 11 cm. How do you find the width?", back: "Half the perimeter is 18 cm, so width = 18 − 11 = 7 cm." },
        { front: "What is a regular polygon?", back: "A polygon with all sides equal and all angles equal." },
        { front: "What is an irregular polygon?", back: "A polygon whose sides or angles are not all equal." },
        { front: "What is a net?", back: "A flat pattern that folds up to make a 3-D shape." },
        { front: "A net of six squares folds up into which 3-D shape?", back: "A cube." },
        { front: "Which tool do you use to measure an angle?", back: "A protractor. Line up the centre and the baseline, then read the correct scale." },
      ],
    },

    // ───────────────────────────── YEAR 6 ─────────────────────────────
    6: {
      year: 6,
      objectives: [
        "Draw 2-D shapes using given dimensions and angles",
        "Recognise, describe and build simple 3-D shapes, including making nets",
        "Compare and classify geometric shapes based on their properties and sizes and find unknown angles in any triangles, quadrilaterals and regular polygons",
        "Illustrate and name parts of circles, including radius, diameter and circumference, and know that the diameter is twice the radius",
        "Recognise angles where they meet at a point, are on a straight line, or are vertically opposite, and find missing angles",
      ],
      note: {
        title: "Angle rules, circles and nets",
        body: `## Angle sums

- The angles in a **triangle** add up to **180°**.
- The angles in a **quadrilateral** add up to **360°**.
- The angles in any polygon with n sides add up to (n − 2) × 180°. A regular polygon has equal angles, so divide the total by n.
- Angles **on a straight line** add up to 180° and angles **at a point** to 360°.
- **Vertically opposite** angles (across from each other where two lines cross) are **equal**.

## Circles

The **radius** goes from the centre to the edge. The **diameter** goes across the circle through the centre, so it is **twice** the radius. The **circumference** is the distance all the way round. A **chord** joins two points on the edge.

## Nets

A net folds up to make a 3-D shape. A cube has 11 different nets, all made of 6 squares. To draw shapes accurately, use a ruler and protractor.

## Worked examples

**1. Triangle.** Angles 52° and 71°: 52 + 71 = 123, so the third angle is 180° − 123° = **57°**.

**2. Quadrilateral.** Angles 95°, 70° and 110°: they add to 275°, so the fourth angle is 360° − 275° = **85°**.

**3. Regular decagon (10 sides).** Angle sum = (10 − 2) × 180° = 1,440°. Each angle = 1,440° ÷ 10 = **144°**.`,
      },
      quiz: {
        title: "Year 6 Properties of Shapes quiz",
        questions: [
          {
            key: "shape-y6-01",
            kind: "single",
            prompt: "What do the three angles in any triangle add up to?",
            options: ["90°", "180°", "270°", "360°"],
            answer: "180°",
            explanation: "The angles inside every triangle add up to 180°.",
            difficulty: 1,
          },
          {
            key: "shape-y6-02",
            kind: "single",
            prompt: "Find the size of angle x in the triangle.",
            options: ["55°", "75°", "65°", "115°"],
            answer: "65°",
            explanation: "Angles in a triangle add up to 180°. 48 + 67 = 115, so x = 180° − 115° = 65°.",
            difficulty: 1,
            diagnostic: true,
            image: IMG.triangleAngles,
          },
          {
            key: "shape-y6-03",
            kind: "single",
            prompt: "Which line is the diameter of the circle?",
            options: ["Line P", "Line Q", "Line R", "Point O"],
            answer: "Line P",
            explanation: "The diameter is a straight line across the circle that passes through the centre O. Q is a radius (centre to the edge) and R is a chord that misses the centre.",
            difficulty: 1,
            image: IMG.circleParts,
          },
          {
            key: "shape-y6-04",
            kind: "number",
            prompt: "Find the size of angle x in the quadrilateral, in degrees.",
            answer: 83,
            explanation: "Angles in a quadrilateral add up to 360°. 105 + 80 + 92 = 277, so x = 360 − 277 = 83°.",
            difficulty: 2,
            image: IMG.quadAngles,
          },
          {
            key: "shape-y6-05",
            kind: "single",
            prompt: "Two straight lines cross. One angle is 112°. What is the size of angle x, directly opposite it?",
            options: ["68°", "78°", "248°", "112°"],
            answer: "112°",
            explanation: "Vertically opposite angles (across from each other where two lines cross) are equal, so x = 112°.",
            difficulty: 2,
            diagnostic: true,
            image: IMG.vertOpp,
          },
          {
            key: "shape-y6-06",
            kind: "number",
            prompt: "The angles inside a pentagon add up to 540°. Four of its angles are 100°, 110°, 120° and 90°. What is the fifth angle, in degrees?",
            answer: 120,
            explanation: "Add the four known angles: 100 + 110 + 120 + 90 = 420. The fifth angle is 540 − 420 = 120°.",
            difficulty: 2,
          },
          {
            key: "shape-y6-07",
            kind: "single",
            prompt: "Which of these flat patterns will NOT fold up to make a cube?",
            options: ["A", "B", "C", "D"],
            answer: "C",
            explanation: "In C four squares meet around one corner, but only three faces can meet at a corner of a cube, so two squares would overlap and one face would be missing. A, B and D all fold up into a cube.",
            difficulty: 2,
            image: IMG.cubeNets,
          },
          {
            key: "shape-y6-08",
            kind: "single",
            prompt: "What is the size of each angle inside a regular hexagon?",
            options: ["120°", "108°", "135°", "60°"],
            answer: "120°",
            explanation: "A hexagon splits into 4 triangles, so its angles add up to 4 × 180° = 720°. Divide by the 6 equal angles: 720 ÷ 6 = 120°.",
            difficulty: 3,
          },
          {
            key: "shape-y6-09",
            kind: "number",
            prompt: "The three angles of a triangle are x, 2x and 3x. What is the size of the largest angle, in degrees?",
            answer: 90,
            explanation: "x + 2x + 3x = 6x, and the angles add up to 180°, so x = 30°. The largest angle is 3x = 3 × 30 = 90°.",
            difficulty: 3,
          },
          {
            key: "shape-y6-10",
            kind: "multi",
            prompt: "Which statements about a circle are true? Select all that apply.",
            options: [
              "The diameter is twice as long as the radius",
              "A chord that passes through the centre is a diameter",
              "Every chord is as long as the diameter",
              "The circumference is the distance across the circle through the centre",
            ],
            answer: ["The diameter is twice as long as the radius", "A chord that passes through the centre is a diameter"],
            explanation: "The diameter is 2 × the radius, and a chord through the centre is a diameter. A chord that misses the centre is shorter, and the circumference is the distance all the way round.",
            difficulty: 2,
          },
        ],
      },
      flashcards: [
        { front: "Angles in a triangle add up to…?", back: "180°." },
        { front: "Angles in a quadrilateral add up to…?", back: "360°." },
        { front: "How do you find the angle sum of a polygon with n sides?", back: "(n − 2) × 180°. A pentagon: 3 × 180° = 540°." },
        { front: "How do you find one angle of a regular polygon?", back: "Work out the angle sum, then divide by the number of sides. Regular decagon: 1,440° ÷ 10 = 144°." },
        { front: "What are vertically opposite angles?", back: "Angles across from each other where two straight lines cross. They are equal." },
        { front: "Angles on a straight line and angles at a point add up to…?", back: "180° on a straight line and 360° at a point." },
        { front: "What are the radius, diameter and circumference of a circle?", back: "Radius: centre to edge. Diameter: across through the centre (twice the radius). Circumference: distance round the edge." },
        { front: "What is a chord?", back: "A straight line joining two points on a circle's edge. The longest chord is the diameter." },
        { front: "How many different nets does a cube have?", back: "11. Each is made of 6 squares joined edge to edge." },
        { front: "Why can't a 2 by 2 block of squares be a net of a cube?", back: "Four squares would meet at one corner, but only three faces meet at a cube's corner, so two overlap and a face is missing." },
        { front: "How do you draw a triangle from two angles and one side?", back: "Draw the side with a ruler, then use a protractor to draw each angle at the ends of that side." },
      ],
    },
  },
};
