// KS3 Maths — Geometry & Measures (Years 7–9). Original content aligned to the DfE National Curriculum KS3 programme of study (OGL v3.0).
// Answer keys are recomputed by _check_m2.ts — re-run it after ANY edit here. Pictures are drawn from _m2data.ts.
import type { CTopic } from "../types";

export const TOPIC: CTopic = {
  key: "geo",
  topic: "Geometry & Measures",
  subject: "Maths",
  years: {
    7: {
      year: 7,
      objectives: [
        "Apply the properties of angles at a point, on a straight line, and in triangles and quadrilaterals.",
        "Calculate the perimeter and area of rectangles, triangles and parallelograms, including composite shapes.",
        "Convert between metric units of length.",
      ],
      note: {
        title: "Year 7: angle facts, perimeter and area",
        body: `## What you need to know

- Angles on a **straight line** add up to **180°**. Angles **around a point** add up to **360°**.
- **Vertically opposite** angles (opposite each other where two lines cross) are equal.
- Angles in a **triangle** add to **180°**. Angles in a **quadrilateral** add to **360°**.
- **Perimeter** is the distance all the way round. **Area** is the space inside, measured in square units.
- Area of a rectangle = length × width. Area of a triangle = ½ × base × **perpendicular** height. Area of a parallelogram = base × perpendicular height.

## Worked example 1: angles

Two angles on a straight line are 125° and x. Then x = 180 − 125 = **55°**. In a triangle with angles 50° and 60°, the third angle is 180 − 110 = **70°**.

## Worked example 2: area

Triangle with base 12 cm and perpendicular height 5 cm: area = ½ × 12 × 5 = **30 cm²**. A parallelogram with base 9 cm and height 4 cm has area 9 × 4 = **36 cm²**. Use the upright height, not the slanted side.

## Worked example 3: units

2.4 km = 2.4 × 1,000 = **2,400 m**. And 350 cm = 350 ÷ 100 = **3.5 m**.

| Conversion | Rule |
| --- | --- |
| km to m | × 1,000 |
| m to cm | × 100 |
| cm to mm | × 10 |`,
      },
      quiz: {
        title: "Geometry & Measures: Year 7 quiz",
        questions: [
          {
            key: "geo-y7-01",
            kind: "number",
            prompt: "The diagram shows two angles on a straight line: one is 68° and the other is x. What is x, in degrees?",
            answer: 112,
            explanation: "Angles on a straight line add up to 180°. So x = 180 − 68 = 112.",
            difficulty: 1,
            image: { file: "geo-y7-straightline.png", alt: "A horizontal straight line with a slanted ray starting from a point on the line, making two angles. The smaller angle on the right is marked 68° and the larger angle on the left is marked x." },
          },
          {
            key: "geo-y7-02",
            kind: "single",
            prompt: "What do the angles around a point add up to?",
            options: ["180°", "360°", "90°", "270°"],
            answer: "360°",
            explanation: "A full turn around a point is 360°, so the angles around a point add up to 360°.",
            difficulty: 1,
          },
          {
            key: "geo-y7-03",
            kind: "number",
            prompt: "A rectangle is 9 cm long and 6 cm wide. What is its area in cm²?",
            answer: 54,
            explanation: "Area of a rectangle = length × width = 9 × 6 = 54 cm².",
            difficulty: 1,
          },
          {
            key: "geo-y7-04",
            kind: "number",
            prompt: "A triangle has two angles of 47° and 72°, as shown. What is the third angle x, in degrees?",
            answer: 61,
            explanation: "Angles in a triangle add up to 180°. 47 + 72 = 119, and 180 − 119 = 61.",
            difficulty: 2,
            diagnostic: true,
            image: { file: "geo-y7-triangle.png", alt: "A triangle with two of its angles marked 47° and 72° and the third angle at the top marked x." },
          },
          {
            key: "geo-y7-05",
            kind: "single",
            prompt: "A triangle has a base of 10 cm and a perpendicular height of 7 cm. What is its area?",
            options: ["35 cm²", "70 cm²", "17 cm²", "35 cm"],
            answer: "35 cm²",
            explanation: "Area of a triangle = ½ × base × height = ½ × 10 × 7 = 35 cm². Area is in square units.",
            difficulty: 2,
            diagnostic: true,
          },
          {
            key: "geo-y7-06",
            kind: "single",
            prompt: "Convert 3.5 km into metres.",
            options: ["3.5 m", "350 m", "35,000 m", "3,500 m"],
            answer: "3,500 m",
            explanation: "There are 1,000 m in 1 km, so multiply by 1,000: 3.5 × 1,000 = 3,500 m.",
            difficulty: 2,
          },
          {
            key: "geo-y7-07",
            kind: "number",
            prompt: "A parallelogram has a base of 8 cm, a perpendicular height of 5 cm and a slanted side of 6 cm. What is its area in cm²?",
            answer: 40,
            explanation: "Area of a parallelogram = base × perpendicular height = 8 × 5 = 40 cm². The slanted side of 6 cm is not needed.",
            difficulty: 2,
          },
          {
            key: "geo-y7-08",
            kind: "single",
            prompt: "Two angles in a quadrilateral are 90° and 110°. The other two angles are equal. What size is each of them?",
            options: ["160°", "80°", "70°", "100°"],
            answer: "80°",
            explanation: "Angles in a quadrilateral add to 360°. 360 − 90 − 110 = 160, and this is shared between two equal angles: 160 ÷ 2 = 80°.",
            difficulty: 2,
          },
          {
            key: "geo-y7-09",
            kind: "number",
            prompt: "A rectangle has a perimeter of 34 cm and a length of 12 cm. What is its area in cm²?",
            answer: 60,
            explanation: "Half the perimeter is 17, so length + width = 17 and the width is 17 − 12 = 5 cm. Area = 12 × 5 = 60 cm².",
            difficulty: 3,
          },
          {
            key: "geo-y7-10",
            kind: "single",
            prompt: "An L-shape is made by cutting a 3 cm by 2 cm rectangle out of the corner of an 8 cm by 5 cm rectangle. What is the area of the L-shape?",
            options: ["46 cm²", "6 cm²", "34 cm²", "40 cm²"],
            answer: "34 cm²",
            explanation: "Work out the big rectangle, 8 × 5 = 40 cm², then subtract the piece that was removed, 3 × 2 = 6 cm². 40 − 6 = 34 cm².",
            difficulty: 3,
          },
        ],
      },
      flashcards: [
        { front: "Angles on a straight line add up to ...", back: "180°" },
        { front: "Angles around a point add up to ...", back: "360°" },
        { front: "Angles in a triangle add up to ...", back: "180°" },
        { front: "Angles in a quadrilateral add up to ...", back: "360°" },
        { front: "Vertically opposite angles are ...", back: "Equal" },
        { front: "Area of a triangle", back: "½ × base × perpendicular height" },
        { front: "Area of a parallelogram", back: "base × perpendicular height" },
        { front: "1 km = ? m and 1 m = ? cm", back: "1,000 m and 100 cm" },
        { front: "What is perimeter?", back: "The total distance around the outside of a shape" },
        { front: "Why do we write area in cm² and not cm?", back: "Area counts squares 1 cm by 1 cm, so the units are squared" },
      ],
    },
    8: {
      year: 8,
      objectives: [
        "Calculate the area of trapezia and circles; calculate the circumference of a circle.",
        "Calculate the volume of right prisms, including cuboids and triangular prisms.",
        "Use a straight edge and compasses to do standard constructions, including the perpendicular bisector.",
        "Describe and transform shapes by reflection, rotation, translation and enlargement.",
      ],
      note: {
        title: "Year 8: circles, trapezia, prisms, constructions and transformations",
        body: `## What you need to know

- **Circle:** circumference C = πd = 2πr and area A = πr². Use π ≈ 3.14 unless told otherwise. Careful: the area formula needs the **radius**.
- **Trapezium:** area = ½ × (a + b) × h, where a and b are the parallel sides and h is the distance between them.
- **Prism:** volume = area of cross-section × length.
- **Transformations:** reflection (mirror line), rotation (centre, angle, direction), translation (slide) and enlargement (centre, scale factor). Reflections, rotations and translations keep the shape the same size (congruent).

## Worked example 1: circle

A circle has diameter 20 cm. Circumference = π × 20 = 3.14 × 20 = **62.8 cm**. A circle with radius 3 cm has area 3.14 × 3² = 3.14 × 9 = **28.26 cm²**.

## Worked example 2: trapezium and prism

Trapezium with parallel sides 5 cm and 9 cm and height 4 cm: ½ × (5 + 9) × 4 = **28 cm²**. A triangular prism whose triangle has base 5 cm and height 3 cm, and which is 8 cm long: cross-section = ½ × 5 × 3 = 7.5 cm², so volume = 7.5 × 8 = **60 cm³**.

## Worked example 3: rotation

Rotate (4, 1) by 90° anticlockwise about the origin: it moves to (−1, 4).

| Transformation | What changes? |
| --- | --- |
| Reflection | Position and orientation |
| Enlargement | Size |`,
      },
      quiz: {
        title: "Geometry & Measures: Year 8 quiz",
        questions: [
          {
            key: "geo-y8-01",
            kind: "single",
            prompt: "Which formula gives the circumference of a circle with diameter d?",
            options: ["C = πr²", "C = πd", "C = 2r", "C = π + d"],
            answer: "C = πd",
            explanation: "The circumference is the distance around, which is π times the diameter. πr² is the area formula.",
            difficulty: 1,
          },
          {
            key: "geo-y8-02",
            kind: "number",
            prompt: "What is the volume of a cuboid that is 5 cm long, 4 cm wide and 3 cm high? Give your answer in cm³.",
            answer: 60,
            explanation: "Volume = length × width × height = 5 × 4 × 3 = 60 cm³.",
            difficulty: 1,
          },
          {
            key: "geo-y8-03",
            kind: "single",
            prompt: "You construct the perpendicular bisector of a line AB using compasses. You draw arcs from A and from B with the same radius. Which statement is correct?",
            options: ["The radius must be exactly the length of AB", "The radius must be less than half of AB", "The arcs only cross if the radius is more than half of AB", "The radius must be exactly half of AB"],
            answer: "The arcs only cross if the radius is more than half of AB",
            explanation: "The arcs from A and B must overlap to cross. If the radius is less than half of AB they cannot meet, so the radius must be more than half.",
            difficulty: 1,
          },
          {
            key: "geo-y8-04",
            kind: "number",
            prompt: "The diagram shows a trapezium with parallel sides of 7 cm and 11 cm and a height of 5 cm. What is its area in cm²?",
            answer: 45,
            explanation: "Area = ½ × (a + b) × h = ½ × (7 + 11) × 5 = ½ × 18 × 5 = 45 cm².",
            difficulty: 2,
            diagnostic: true,
            image: { file: "geo-y8-trapezium.png", alt: "A trapezium with a horizontal top side of 7 cm and a longer horizontal bottom side of 11 cm. A dashed vertical line between them is labelled 5 cm." },
          },
          {
            key: "geo-y8-05",
            kind: "number",
            prompt: "Use π = 3.14. What is the area of a circle with radius 10 cm, in cm²?",
            answer: 314,
            explanation: "Area = πr² = 3.14 × 10² = 3.14 × 100 = 314 cm².",
            difficulty: 2,
          },
          {
            key: "geo-y8-06",
            kind: "number",
            prompt: "The diagram shows a triangular prism. The triangle has a base of 6 cm and a height of 4 cm, and the prism is 10 cm long. What is its volume in cm³?",
            answer: 120,
            explanation: "Cross-section area = ½ × 6 × 4 = 12 cm². Volume = cross-section × length = 12 × 10 = 120 cm³.",
            difficulty: 2,
            diagnostic: true,
            image: { file: "geo-y8-prism.png", alt: "A triangular prism drawn in 3D. The triangular end is right-angled with base 6 cm and vertical height 4 cm. The length of the prism, along the top, is labelled 10 cm." },
          },
          {
            key: "geo-y8-07",
            kind: "single",
            prompt: "Use π = 3.14. What is the circumference of a circle with diameter 14 cm?",
            options: ["87.92 cm", "153.86 cm", "14.14 cm", "43.96 cm"],
            answer: "43.96 cm",
            explanation: "Circumference = π × d = 3.14 × 14 = 43.96 cm. The other numbers come from using 2πd or the area formula.",
            difficulty: 2,
          },
          {
            key: "geo-y8-08",
            kind: "single",
            prompt: "The point (2, 1) is rotated 90° clockwise about the origin. Where does it end up?",
            options: ["(−1, 2)", "(−2, −1)", "(1, −2)", "(−2, 1)"],
            answer: "(1, −2)",
            explanation: "A 90° clockwise turn about the origin takes (x, y) to (y, −x). So (2, 1) goes to (1, −2).",
            difficulty: 2,
          },
          {
            key: "geo-y8-09",
            kind: "number",
            prompt: "Use π = 3.14. A semicircle has a diameter of 10 cm. What is its perimeter in cm (the curved edge plus the straight edge)?",
            answer: 25.7,
            tolerance: 0.01,
            explanation: "The curved edge is half a circumference: 3.14 × 10 ÷ 2 = 15.7 cm. Add the straight diameter of 10 cm to get 25.7 cm.",
            difficulty: 3,
          },
          {
            key: "geo-y8-10",
            kind: "single",
            prompt: "The point (3, 1) is enlarged by scale factor 3 with centre of enlargement (1, 1). What are the coordinates of its image?",
            options: ["(7, 1)", "(9, 3)", "(6, 2)", "(5, 1)"],
            answer: "(7, 1)",
            explanation: "From the centre (1, 1) the point is 2 across. Scale factor 3 makes that 6 across, so the image is at (1 + 6, 1) = (7, 1).",
            difficulty: 3,
          },
        ],
      },
      flashcards: [
        { front: "Circumference of a circle", back: "C = πd = 2πr" },
        { front: "Area of a circle", back: "A = πr² (use the radius)" },
        { front: "Radius vs diameter", back: "The diameter is twice the radius" },
        { front: "Area of a trapezium", back: "½ × (a + b) × h, where a and b are the parallel sides" },
        { front: "Volume of a prism", back: "Area of cross-section × length" },
        { front: "Perpendicular bisector: what does it do?", back: "Cuts a line exactly in half at 90°" },
        { front: "Which transformations keep a shape the same size?", back: "Reflection, rotation and translation" },
        { front: "What two things describe an enlargement?", back: "The scale factor and the centre of enlargement" },
        { front: "Rotation needs three things", back: "Centre, angle and direction (clockwise or anticlockwise)" },
        { front: "Volume of a cuboid", back: "length × width × height" },
      ],
    },
    9: {
      year: 9,
      objectives: [
        "Use Pythagoras' theorem in right-angled triangles.",
        "Use the trigonometric ratios sin, cos and tan in right-angled triangles (introduction).",
        "Use similarity and congruence: scale factors in similar shapes and the conditions for congruent triangles.",
        "Derive and use the sum of the interior angles of polygons and the exterior angles of regular polygons.",
      ],
      note: {
        title: "Year 9: Pythagoras, trigonometry, similar shapes and polygons",
        body: `## What you need to know

- **Pythagoras:** in a right-angled triangle, a² + b² = c², where c is the **hypotenuse** (the longest side, opposite the right angle).
- **Trigonometry (SOH CAH TOA):** sin θ = opposite ÷ hypotenuse, cos θ = adjacent ÷ hypotenuse, tan θ = opposite ÷ adjacent. Known values: sin 30° = 0.5, tan 45° = 1.
- **Similar shapes** have the same angles and sides in the same ratio; the ratio is the **scale factor**.
- **Congruent** triangles are identical: SSS, SAS, ASA or RHS.
- **Polygons:** interior angles add to (n − 2) × 180°. Exterior angles of any polygon add to 360°.

## Worked example 1: Pythagoras

Find the hypotenuse for shorter sides 8 cm and 15 cm: 8² + 15² = 64 + 225 = 289, and √289 = **17 cm**. Finding a shorter side: hypotenuse 25 and one side 7 gives 25² − 7² = 625 − 49 = 576, so the side is **24**.

## Worked example 2: trigonometry

A right-angled triangle has hypotenuse 14 cm and an angle of 30°. The side opposite the angle is 14 × sin 30° = 14 × 0.5 = **7 cm**.

## Worked example 3: similar shapes and polygons

Two similar triangles have matching sides of 3 cm and 12 cm, so the scale factor is 4. A side of 5 cm becomes **20 cm**. The interior angles of an octagon add to (8 − 2) × 180 = **1,080°**.

| Rule | Value |
| --- | --- |
| Exterior angle of regular n-gon | 360° ÷ n |`,
      },
      quiz: {
        title: "Geometry & Measures: Year 9 quiz",
        questions: [
          {
            key: "geo-y9-01",
            kind: "number",
            prompt: "The diagram shows a right-angled triangle with shorter sides 6 cm and 8 cm. What is the length of the hypotenuse x, in cm?",
            answer: 10,
            explanation: "Pythagoras: x² = 6² + 8² = 36 + 64 = 100, so x = √100 = 10 cm.",
            difficulty: 1,
            image: { file: "geo-y9-pythagoras.png", alt: "A right-angled triangle with a vertical side of 6 cm, a horizontal side of 8 cm and the long sloping side (hypotenuse) labelled x." },
          },
          {
            key: "geo-y9-02",
            kind: "single",
            prompt: "Which of these sets of numbers is a Pythagorean triple (the sides of a right-angled triangle)?",
            options: ["3, 4, 6", "5, 12, 13", "6, 8, 12", "7, 8, 9"],
            answer: "5, 12, 13",
            explanation: "Check a² + b² = c²: 5² + 12² = 25 + 144 = 169 = 13². None of the other sets work.",
            difficulty: 1,
          },
          {
            key: "geo-y9-03",
            kind: "single",
            prompt: "In a right-angled triangle, which ratio is sin θ?",
            options: ["adjacent ÷ hypotenuse", "opposite ÷ adjacent", "opposite ÷ hypotenuse", "hypotenuse ÷ opposite"],
            answer: "opposite ÷ hypotenuse",
            explanation: "SOH: Sine is Opposite over Hypotenuse. Cosine uses the adjacent side and tangent is opposite over adjacent.",
            difficulty: 1,
          },
          {
            key: "geo-y9-04",
            kind: "number",
            prompt: "A ladder 6.5 m long leans against a vertical wall. Its foot is 2.5 m from the wall. How high up the wall does it reach, in metres?",
            answer: 6,
            explanation: "The ladder is the hypotenuse: height² = 6.5² − 2.5² = 42.25 − 6.25 = 36, so the height is √36 = 6 m.",
            difficulty: 2,
            diagnostic: true,
          },
          {
            key: "geo-y9-05",
            kind: "number",
            prompt: "In the right-angled triangle the hypotenuse is 10 cm and one angle is 30°. Use sin 30° = 0.5 to find the length of the side x opposite the 30° angle, in cm.",
            answer: 5,
            explanation: "sin θ = opposite ÷ hypotenuse, so x = 10 × sin 30° = 10 × 0.5 = 5 cm.",
            difficulty: 2,
            image: { file: "geo-y9-trig.png", alt: "A right-angled triangle with hypotenuse labelled 10 cm, a 30° angle at the bottom left, and the vertical side opposite that angle labelled x." },
          },
          {
            key: "geo-y9-06",
            kind: "single",
            prompt: "Triangles ABC and DEF are similar. AB = 4 cm, AC = 6 cm and DE = 10 cm, as shown. What is the length DF (marked x)?",
            options: ["12", "8", "16", "15"],
            answer: "15",
            explanation: "The scale factor is 10 ÷ 4 = 2.5. So DF = 6 × 2.5 = 15 cm. Adding 6 to each side would not keep the shapes similar.",
            difficulty: 2,
            diagnostic: true,
            image: { file: "geo-y9-similar.png", alt: "Two similar triangles: a small triangle ABC with AB = 4 cm and AC = 6 cm, and a larger triangle DEF with DE = 10 cm and DF marked x." },
          },
          {
            key: "geo-y9-07",
            kind: "single",
            prompt: "Which of these is NOT enough on its own to prove two triangles are congruent?",
            options: ["AAA (three equal angles)", "SSS (three equal sides)", "SAS (two sides and the angle between)", "ASA (two angles and a side)"],
            answer: "AAA (three equal angles)",
            explanation: "Three equal angles only tell us the triangles have the same shape (similar), not the same size, so AAA does not prove congruence.",
            difficulty: 2,
          },
          {
            key: "geo-y9-08",
            kind: "number",
            prompt: "What is the sum of the interior angles of a hexagon, in degrees?",
            answer: 720,
            explanation: "A hexagon has 6 sides. (n − 2) × 180 = 4 × 180 = 720°.",
            difficulty: 2,
          },
          {
            key: "geo-y9-09",
            kind: "number",
            prompt: "Point A is at (1, 2) and point B is at (7, 10). How far apart are A and B?",
            answer: 10,
            explanation: "Across is 7 − 1 = 6 and up is 10 − 2 = 8. By Pythagoras the distance is √(6² + 8²) = √100 = 10.",
            difficulty: 3,
          },
          {
            key: "geo-y9-10",
            kind: "number",
            prompt: "Each interior angle of a regular polygon is 150°. How many sides does the polygon have?",
            answer: 12,
            explanation: "Each exterior angle is 180 − 150 = 30°. Exterior angles add to 360°, so the number of sides is 360 ÷ 30 = 12.",
            difficulty: 3,
          },
        ],
      },
      flashcards: [
        { front: "Pythagoras' theorem", back: "a² + b² = c², where c is the hypotenuse" },
        { front: "What is the hypotenuse?", back: "The longest side of a right-angled triangle, opposite the right angle" },
        { front: "SOH CAH TOA", back: "sin = opp/hyp, cos = adj/hyp, tan = opp/adj" },
        { front: "sin 30° = ?", back: "0.5" },
        { front: "tan 45° = ?", back: "1" },
        { front: "A well-known Pythagorean triple", back: "3, 4, 5 (and 8, 15, 17)" },
        { front: "What is a scale factor?", back: "The number you multiply lengths by to get the matching lengths in a similar shape" },
        { front: "Conditions for congruent triangles", back: "SSS, SAS, ASA, RHS" },
        { front: "Sum of interior angles of an n-sided polygon", back: "(n − 2) × 180°" },
        { front: "Exterior angle of a regular polygon with n sides", back: "360° ÷ n" },
      ],
    },
  },
};
