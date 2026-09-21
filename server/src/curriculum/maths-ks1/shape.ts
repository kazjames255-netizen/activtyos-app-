// KS1 Maths — Geometry: Properties of Shapes (Years 1–2). Original content aligned to the DfE National Curriculum (OGL v3.0).
// Answer keys are recomputed by _check_m1.ts — re-run it after ANY edit here. Pictures: scratch/curriculum-images/maths-ks1/.
import type { CTopic } from "../types";

const IMG = {
  triangle: { file: "shape-triangle.png", alt: "A green flat shape with three straight sides and three corners, sitting on a flat bottom edge, with its top point a little to the right of the middle." },
  cuboid: { file: "shape-cuboid.png", alt: "A blue solid box shape drawn in perspective. It is longer than it is tall, with flat faces on the front, the top and the right side." },
  pentagon: { file: "shape-pentagon.png", alt: "A purple flat shape with straight sides of equal length, one flat side at the bottom and one point at the top." },
  hexagon: { file: "shape-hexagon.png", alt: "An orange flat shape with straight sides of equal length. It has a flat side at the top, a flat side at the bottom and a point on the left and on the right." },
  sym: { file: "shape-sym.png", alt: "Two shapes, each with a red dashed vertical line. A on the left: a house shape with a straight bottom and sides and a pointed roof, and the dashed line runs down through the middle of the roof point and the middle of the base. B on the right: a right-angled triangle with its straight edge on the left, and the dashed line is drawn upright through the middle of its bottom edge." },
};

export const TOPIC: CTopic = {
  key: "shape",
  topic: "Geometry — Properties of Shapes",
  subject: "Maths",
  years: {
    1: {
      year: 1,
      objectives: [
        "Recognise and name common 2-D shapes: rectangles (including squares), circles and triangles.",
        "Recognise and name common 3-D shapes: cuboids (including cubes), pyramids and spheres.",
      ],
      note: {
        title: "Year 1: naming flat shapes and solid shapes",
        body: `## What to know

**2-D shapes** are flat. **3-D shapes** are solid, like things you can hold.

| 2-D shape | Sides | Corners | Look |
| --- | --- | --- | --- |
| circle | 1 curved side | 0 | round |
| triangle | 3 | 3 | pointy |
| square | 4 equal sides | 4 | all sides the same |
| rectangle | 4 | 4 | long and short sides |

A **square is a special rectangle** because it also has 4 corners and 4 straight sides.

| 3-D shape | Everyday example |
| --- | --- |
| sphere | a football |
| cube | a building block |
| cuboid | a cereal box |
| pyramid | a tent with a pointed top |

## Say it like this

"Count the sides. Count the corners. Is it flat or solid?"

## Worked example 1: name a flat shape

It has 3 straight sides and 3 corners. It is a **triangle**.

## Worked example 2: name a solid shape

A shoebox has flat faces and 8 corners. It is a **cuboid**.

## Worked example 3: sort

Which is round: a coin 🪙 or a book? A coin is round like a **circle**.

**Tip for grown-ups:** go on a shape hunt around your home.`,
      },
      quiz: {
        title: "Geometry — Properties of Shapes: Year 1 quiz",
        questions: [
          { key: "shape-y1-01", kind: "single", prompt: "What is the name of this shape?", options: ["circle", "square", "triangle", "rectangle"], answer: "triangle", image: IMG.triangle, explanation: "It has 3 straight sides and 3 corners. A shape with 3 sides is a triangle.", difficulty: 1 },
          { key: "shape-y1-02", kind: "single", prompt: "Which shape has 4 corners and 4 sides that are all the same length?", options: ["triangle", "square", "circle"], answer: "square", explanation: "A square has 4 equal sides and 4 corners. A triangle has 3 sides and a circle has none.", difficulty: 1 },
          { key: "shape-y1-03", kind: "single", prompt: "A football ⚽ is the shape of a…", options: ["sphere", "cube", "pyramid"], answer: "sphere", explanation: "A sphere is round like a ball.", difficulty: 1 },
          { key: "shape-y1-04", kind: "single", prompt: "What is the name of this 3-D shape?", options: ["sphere", "pyramid", "cuboid"], answer: "cuboid", image: IMG.cuboid, explanation: "It is a solid box shape with flat faces. That is a cuboid.", difficulty: 2, diagnostic: true },
          { key: "shape-y1-05", kind: "number", prompt: "How many sides does a rectangle have?", answer: 4, explanation: "A rectangle has 2 long sides and 2 short sides. That is 4 sides.", difficulty: 2, diagnostic: true },
          { key: "shape-y1-06", kind: "single", prompt: "A dice 🎲 is the shape of a…", options: ["cube", "sphere", "pyramid"], answer: "cube", explanation: "A dice has 6 flat faces that are all squares. That is a cube.", difficulty: 2 },
          { key: "shape-y1-07", kind: "single", prompt: "Which shape has no corners and no straight sides?", options: ["circle", "square", "triangle", "rectangle"], answer: "circle", explanation: "A circle is completely round. It has one curved side and no corners.", difficulty: 2 },
          { key: "shape-y1-08", kind: "multi", prompt: "Which of these are 3-D shapes? Choose two.", options: ["sphere", "circle", "cuboid", "triangle"], answer: ["sphere", "cuboid"], explanation: "3-D shapes are solid. A sphere and a cuboid are solid, but a circle and a triangle are flat.", difficulty: 2 },
          { key: "shape-y1-09", kind: "single", prompt: "Ali says: 'A square is not a rectangle.' What do you say?", options: ["He is right", "A square is a special rectangle", "A square is a circle"], answer: "A square is a special rectangle", explanation: "A square has 4 corners and 4 straight sides, just like a rectangle. It is a rectangle with all sides equal.", difficulty: 3 },
          { key: "shape-y1-10", kind: "single", prompt: "I have a point at the top and a flat bottom. I look like a tent ⛺. What 3-D shape am I?", options: ["sphere", "cuboid", "pyramid"], answer: "pyramid", explanation: "A pyramid has a point at the top and a flat base. It is not round like a sphere.", difficulty: 3 },
        ],
      },
      flashcards: [
        { front: "A shape with 3 sides", back: "Triangle" },
        { front: "A shape with 4 equal sides", back: "Square" },
        { front: "A shape with no corners", back: "Circle" },
        { front: "A football is a…", back: "Sphere" },
        { front: "A dice is a…", back: "Cube" },
        { front: "A cereal box is a…", back: "Cuboid" },
        { front: "A 3-D shape with a point at the top", back: "Pyramid" },
        { front: "How many corners does a triangle have?", back: "3" },
        { front: "2-D means…", back: "Flat" },
        { front: "3-D means…", back: "Solid (you can hold it)" },
      ],
    },
    2: {
      year: 2,
      objectives: [
        "Identify and describe the properties of 2-D shapes, including the number of sides and line symmetry in a vertical line.",
        "Identify and describe the properties of 3-D shapes, including the number of edges, vertices and faces.",
        "Identify 2-D shapes on the surface of 3-D shapes (for example a circle on a cylinder and a triangle on a pyramid).",
        "Compare and sort common 2-D and 3-D shapes and everyday objects.",
      ],
      note: {
        title: "Year 2: sides, corners, faces and lines of symmetry",
        body: `## What to know

**2-D shapes** are named by their number of sides: triangle (3), quadrilateral (4), **pentagon (5)**, **hexagon (6)**, **octagon (8)**.

**3-D shapes** have **faces** (the flat or curved surfaces), **edges** (where two faces meet) and **vertices** (corners).

| Shape | Faces | Edges | Vertices |
| --- | --- | --- | --- |
| cube | 6 | 12 | 8 |
| cuboid | 6 | 12 | 8 |
| square-based pyramid | 5 | 8 | 5 |
| cylinder | 3 (2 flat, 1 curved) | 2 | 0 |

A **line of symmetry** is a mirror line. If you fold the shape on the line, both halves fit exactly on top of each other. In Year 2 we look at **vertical** lines.

You can find 2-D shapes on the faces of 3-D shapes: the base of a cone is a circle, and the faces of a triangular prism include triangles.

## Say it like this

"Count the sides, then count the corners. If you fold it along the line, do both halves match?"

## Worked example 1: name by sides

A shape with 4 straight sides and 4 corners is a **quadrilateral**. Squares and rectangles are quadrilaterals.

## Worked example 2: faces and shapes on faces

A square-based pyramid, like the ones in Egypt, has 5 faces: 4 triangles and 1 square. So we can find triangles on a pyramid.

## Worked example 3: symmetry

A butterfly's wings match on both sides of a vertical line down the middle. That line is a **line of symmetry**.

**Tip for grown-ups:** fold paper shapes in half to test for symmetry.`,
      },
      quiz: {
        title: "Geometry — Properties of Shapes: Year 2 quiz",
        questions: [
          { key: "shape-y2-01", kind: "single", prompt: "What is the name of this shape?", options: ["hexagon", "octagon", "pentagon", "triangle"], answer: "pentagon", image: IMG.pentagon, explanation: "It has 5 straight sides. A shape with 5 sides is a pentagon.", difficulty: 1 },
          { key: "shape-y2-02", kind: "number", prompt: "How many sides does this shape have?", answer: 6, image: IMG.hexagon, explanation: "Count each straight side once: 6 sides. It is a hexagon.", difficulty: 1 },
          { key: "shape-y2-03", kind: "single", prompt: "A tin of beans 🥫 is the shape of a…", options: ["cone", "cylinder", "sphere", "cube"], answer: "cylinder", explanation: "A cylinder has 2 flat circles at the ends and a curved side, like a tin.", difficulty: 1 },
          { key: "shape-y2-04", kind: "number", prompt: "How many faces does a cube have?", answer: 6, explanation: "A cube has a top, a bottom and 4 sides. 1 + 1 + 4 = 6 faces.", difficulty: 2, diagnostic: true },
          { key: "shape-y2-05", kind: "number", prompt: "How many vertices (corners) does a cuboid have?", answer: 8, explanation: "A cuboid has 4 corners on the top and 4 corners on the bottom. 4 + 4 = 8.", difficulty: 2 },
          { key: "shape-y2-06", kind: "single", prompt: "Which picture has a dashed line that is a line of symmetry?", options: ["A", "B", "Both", "Neither"], answer: "A", image: IMG.sym, explanation: "Fold A along the dashed line and both halves match. B does not match because one side is much bigger than the other.", difficulty: 2, diagnostic: true },
          { key: "shape-y2-07", kind: "single", prompt: "The flat faces of a cylinder are which 2-D shape?", options: ["square", "circle", "triangle", "rectangle"], answer: "circle", explanation: "Look at the top and bottom of a tin. They are both circles.", difficulty: 2 },
          { key: "shape-y2-08", kind: "single", prompt: "Which shape has 8 sides?", options: ["hexagon", "pentagon", "square", "octagon"], answer: "octagon", explanation: "'Octa' means 8, like an octopus with 8 arms. An octagon has 8 sides.", difficulty: 2 },
          { key: "shape-y2-09", kind: "multi", prompt: "Which of these have a curved surface? Choose two.", options: ["cube", "cone", "cuboid", "sphere"], answer: ["cone", "sphere"], explanation: "A cone and a sphere both have a curved surface. A cube and a cuboid have only flat faces.", difficulty: 3 },
          { key: "shape-y2-10", kind: "single", prompt: "I have 1 flat face, 1 curved surface and 1 vertex. What am I?", options: ["cylinder", "sphere", "cone", "cuboid"], answer: "cone", explanation: "A cone has a flat circle at the bottom, a curved side and 1 point at the top.", difficulty: 3 },
        ],
      },
      flashcards: [
        { front: "How many sides has a pentagon?", back: "5" },
        { front: "How many sides has a hexagon?", back: "6" },
        { front: "How many sides has an octagon?", back: "8" },
        { front: "Faces of a cube", back: "6" },
        { front: "Edges of a cube", back: "12" },
        { front: "Vertices of a cube", back: "8" },
        { front: "Line of symmetry means…", back: "Both sides match when you fold the shape" },
        { front: "A vertex is a…", back: "Corner" },
        { front: "A 3-D shape with a flat circle and a point at the top", back: "Cone" },
        { front: "The base of a cone is which 2-D shape?", back: "A circle" },
      ],
    },
  },
};
