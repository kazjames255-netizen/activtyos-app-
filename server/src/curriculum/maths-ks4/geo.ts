// GCSE Maths — Geometry & Measures (Years 10–11). Original content aligned to the DfE GCSE mathematics subject content (OGL v3.0).
// Answer keys are recomputed by _check_m3.ts — re-run it after ANY edit here.
import type { CTopic } from "../types";

export const TOPIC: CTopic = {
  key: "geo",
  topic: "Geometry & Measures",
  subject: "Maths",
  years: {
    10: {
      year: 10,
      objectives: [
        "Use angle facts: parallel lines, triangles, polygons (interior and exterior angles).",
        "Use Pythagoras' theorem in two dimensions.",
        "Use SOH CAH TOA to find sides and angles in right-angled triangles.",
        "Calculate areas and volumes of circles, cylinders, prisms, cones and spheres.",
        "Perform and describe transformations: reflection, rotation, translation and enlargement.",
      ],
      note: {
        title: "Year 10 Geometry: angles, Pythagoras, trigonometry and volume",
        body: `## What you need to know

**Angles.** Angles in a triangle add to 180°; on a straight line, 180°; around a point, 360°. Interior angles of an n-sided polygon add to **(n − 2) × 180°**. Exterior angles of any polygon add to 360°, so a regular polygon has exterior angle 360° ÷ n. With parallel lines, alternate angles are equal and co-interior angles add to 180°.

**Pythagoras.** In a right-angled triangle **a² + b² = c²**, where c is the hypotenuse (the longest side, opposite the right angle).

**Trigonometry.** Label the sides Hypotenuse, Opposite (to the angle) and Adjacent. **SOH CAH TOA:** sin θ = O/H, cos θ = A/H, tan θ = O/A. To find an angle, use the inverse: θ = sin⁻¹(O/H).

## Worked example 1: trig for a side
Hypotenuse 10, angle 40°, find the opposite: O = 10 × sin 40° = **6.43**.

## Worked example 2: trig for an angle
Opposite 5, adjacent 8: tan θ = 5/8, so θ = tan⁻¹(0.625) = **32.0°**.

## Worked example 3: volume
A cylinder with radius 3 and height 10: V = πr²h = π × 9 × 10 = **282.7** (1 d.p.).

| Shape | Area or volume |
| --- | --- |
| Circle | A = πr², C = 2πr |
| Prism / cylinder | cross-section × length |
| Cone | V = ⅓πr²h |
| Sphere | V = 4/3 πr³ |`,
      },
      quiz: {
        title: "Geometry & Measures: Year 10 GCSE quiz",
        questions: [
          {
            key: "geo-y10-01", kind: "number", difficulty: 1,
            prompt: "What is the sum of the interior angles of a hexagon, in degrees?",
            answer: 720,
            explanation: "Use (n − 2) × 180 with n = 6: 4 × 180 = 720°.",
          },
          {
            key: "geo-y10-02", kind: "number", difficulty: 1,
            prompt: "What is the size of one exterior angle of a regular pentagon, in degrees?",
            answer: 72,
            explanation: "Exterior angles add to 360°, and a regular pentagon has 5 equal ones: 360 ÷ 5 = 72°.",
          },
          {
            key: "geo-y10-03", kind: "number", difficulty: 1,
            prompt: "A right-angled triangle has shorter sides 9 cm and 12 cm. How long is the hypotenuse, in cm?",
            answer: 15,
            explanation: "Use Pythagoras: 9² + 12² = 81 + 144 = 225, and √225 = 15.",
          },
          {
            key: "geo-y10-04", kind: "number", difficulty: 2, diagnostic: true, tolerance: 0.01,
            prompt: "In the right-angled triangle shown, find the length x, in cm, correct to 2 decimal places.",
            answer: 6.88,
            explanation: "x is opposite the 35° angle and 12 cm is the hypotenuse, so use sine: x = 12 × sin 35° = 6.88 cm.",
            image: { file: "geo-y10-trig.png", alt: "A right-angled triangle ABC with the right angle at B at the bottom left. The hypotenuse AC is labelled 12 cm. The angle at A is marked 35 degrees. The side BC, opposite the 35 degree angle, is labelled x." },
          },
          {
            key: "geo-y10-05", kind: "number", difficulty: 2, diagnostic: true, tolerance: 0.05,
            prompt: "Work out the area of a circle with radius 7 cm. Give your answer to 1 decimal place, in cm².",
            answer: 153.9,
            explanation: "Area = πr² = π × 7² = 49π = 153.9 cm² (1 d.p.).",
          },
          {
            key: "geo-y10-06", kind: "number", difficulty: 2, tolerance: 0.05,
            prompt: "A cylinder has radius 5 cm and height 12 cm. Work out its volume to 1 decimal place, in cm³.",
            answer: 942.5,
            explanation: "V = πr²h = π × 25 × 12 = 300π = 942.5 cm³.",
          },
          {
            key: "geo-y10-07", kind: "number", difficulty: 2, tolerance: 0.05,
            prompt: "A right-angled triangle has an angle θ with opposite side 9 cm and adjacent side 14 cm. Find θ to 1 decimal place, in degrees.",
            answer: 32.7,
            explanation: "The sides given are opposite and adjacent, so use tan: tan θ = 9/14. Then θ = tan⁻¹(9/14) = 32.7°.",
          },
          {
            key: "geo-y10-08", kind: "single", difficulty: 2,
            prompt: "The point (8, −6) is enlarged with scale factor ½ from the origin. What are the coordinates of its image?",
            options: ["(−4, 3)", "(16, −12)", "(4, 3)", "(4, −3)"],
            answer: "(4, −3)",
            explanation: "From the origin, multiply each coordinate by the scale factor: ½ × 8 = 4 and ½ × (−6) = −3.",
          },
          {
            key: "geo-y10-09", kind: "single", difficulty: 2,
            prompt: "The point (1, 4) is reflected in the line x = 3. What are the coordinates of its image?",
            options: ["(−1, 4)", "(5, 4)", "(1, −4)", "(4, 5)"],
            answer: "(5, 4)",
            explanation: "The point is 2 units to the left of the mirror line x = 3, so its image is 2 units to the right, at x = 5. The y-coordinate is unchanged.",
          },
          {
            key: "geo-y10-10", kind: "number", difficulty: 3,
            prompt: "An isosceles triangle has two equal sides of 13 cm and a base of 10 cm. Work out its area, in cm².",
            answer: 60,
            explanation: "Split it into two right-angled triangles with base 5. The height is √(13² − 5²) = √144 = 12. Area = ½ × 10 × 12 = 60 cm².",
          },
          {
            key: "geo-y10-11", kind: "number", difficulty: 3, tolerance: 0.05,
            prompt: "A cone has base radius 3 cm and vertical height 4 cm. Work out its volume to 1 decimal place, in cm³.",
            answer: 37.7,
            explanation: "V = ⅓πr²h = ⅓ × π × 9 × 4 = 12π = 37.7 cm³.",
          },
          {
            key: "geo-y10-12", kind: "number", difficulty: 3,
            prompt: "Each interior angle of a regular polygon is 156°. How many sides does the polygon have?",
            answer: 15,
            explanation: "The exterior angle is 180° − 156° = 24°. The number of sides is 360 ÷ 24 = 15.",
          },
          {
            key: "geo-y10-13", kind: "written", difficulty: 3, marks: 3,
            prompt: "A triangle has sides 20 cm, 21 cm and 29 cm. Show that it is right-angled, and work out its area.",
            answer: "20² + 21² = 400 + 441 = 841 = 29², so it is right-angled. Area = ½ × 20 × 21 = 210 cm².",
            explanation: "Mark scheme (3 marks): 1 for 20² + 21² = 841; 1 for 29² = 841 and the conclusion that Pythagoras' theorem holds so the triangle is right-angled; 1 for the area ½ × 20 × 21 = 210 cm².",
          },
        ],
      },
      flashcards: [
        { front: "Sum of interior angles of an n-sided polygon", back: "(n − 2) × 180°" },
        { front: "Exterior angle of a regular n-gon", back: "360° ÷ n" },
        { front: "Pythagoras' theorem", back: "a² + b² = c², where c is the hypotenuse." },
        { front: "SOH CAH TOA", back: "sin = O/H, cos = A/H, tan = O/A." },
        { front: "To find an angle with trigonometry", back: "Use the inverse function, e.g. θ = tan⁻¹(O/A)." },
        { front: "Alternate angles (parallel lines)", back: "Equal (Z-shape)." },
        { front: "Co-interior angles (parallel lines)", back: "Add up to 180° (C-shape)." },
        { front: "Area and circumference of a circle", back: "A = πr², C = 2πr = πd" },
        { front: "Volume of a cylinder", back: "πr²h" },
        { front: "Volume of a cone", back: "⅓πr²h" },
        { front: "Volume of a sphere", back: "4/3 πr³" },
        { front: "Describing an enlargement", back: "Give the scale factor and the centre of enlargement." },
      ],
    },
    11: {
      year: 11,
      objectives: [
        "Apply and prove circle theorems.",
        "Use the sine rule, cosine rule and area = ½ab sin C in non-right-angled triangles.",
        "Calculate arc lengths, sector areas and angles in sectors.",
        "Use vectors in geometry: add, subtract, multiply by a scalar and prove results.",
        "Use similarity and scale factors for lengths, areas and volumes; solve problems in three dimensions using Pythagoras and trigonometry.",
      ],
      note: {
        title: "Year 11 Geometry: circle theorems, trig rules, vectors and 3D",
        body: `## What you need to know

**Circle theorems.** The angle at the centre is **twice** the angle at the circumference on the same arc. The angle in a semicircle is 90°. Angles in the same segment are equal. Opposite angles of a cyclic quadrilateral add to 180°. A tangent meets a radius at 90°.

**Non-right-angled triangles** (sides a, b, c opposite angles A, B, C):
- **Sine rule:** a/sin A = b/sin B (use with a pair of side and angle)
- **Cosine rule:** a² = b² + c² − 2bc cos A (two sides and the angle between)
- **Area** = ½ab sin C

**Arcs and sectors** are a fraction θ/360 of the circle: arc = θ/360 × 2πr, sector = θ/360 × πr².

**Similar shapes.** With length scale factor k: areas scale by **k²**, volumes by **k³**.

**Vectors.** Add and subtract by components. For OA = a and OB = b, AB = b − a.

## Worked example 1
Cosine rule: b = 7, c = 9, A = 60°: a² = 49 + 81 − 2 × 7 × 9 × 0.5 = 67, so a = **8.19**.

## Worked example 2
Sector radius 10, angle 72°: area = 72/360 × π × 100 = **62.8**.

## Worked example 3
Space diagonal of a 4 × 4 × 7 cuboid: √(16 + 16 + 49) = **9**.

| Result | Formula |
| --- | --- |
| Area scale | k² |
| Volume scale | k³ |
| Area of triangle | ½ab sin C |`,
      },
      quiz: {
        title: "Geometry & Measures: Year 11 GCSE quiz",
        questions: [
          {
            key: "geo-y11-01", kind: "number", difficulty: 1,
            prompt: "AB is a diameter of a circle and C is a point on the circumference. What is the size of angle ACB, in degrees?",
            answer: 90,
            explanation: "The angle in a semicircle is always 90°.",
          },
          {
            key: "geo-y11-02", kind: "single", difficulty: 1,
            prompt: "a = (3, 2) and b = (1, −4) are column vectors written as (x, y). Work out a + b.",
            options: ["(4, 2)", "(4, −6)", "(2, 6)", "(4, −2)"],
            answer: "(4, −2)",
            explanation: "Add the top numbers and the bottom numbers separately: 3 + 1 = 4 and 2 + (−4) = −2.",
          },
          {
            key: "geo-y11-03", kind: "number", difficulty: 1,
            prompt: "Two triangles are similar with a scale factor of 2.5. A side of the smaller triangle is 6 cm. How long is the matching side of the larger triangle, in cm?",
            answer: 15,
            explanation: "Multiply by the scale factor: 6 × 2.5 = 15 cm.",
          },
          {
            key: "geo-y11-04", kind: "number", difficulty: 2, diagnostic: true,
            prompt: "O is the centre of the circle. Work out the size of angle x, in degrees.",
            answer: 55,
            explanation: "The angle at the centre is twice the angle at the circumference on the same arc. So x = 110 ÷ 2 = 55°.",
            image: { file: "geo-y11-circ.png", alt: "A circle with centre O. Points A and B are on the circle, joined to O; the angle AOB at the centre is marked 110 degrees. A point C on the far side of the circle is joined to A and B, and the angle ACB is marked x." },
          },
          {
            key: "geo-y11-05", kind: "number", difficulty: 2, diagnostic: true, tolerance: 0.01,
            prompt: "Work out the length x, in cm, correct to 2 decimal places.",
            answer: 7.08,
            explanation: "Two sides and the angle between them are known, so use the cosine rule: x² = 8² + 11² − 2 × 8 × 11 × cos 40° = 50.17…, so x = 7.08 cm.",
            image: { file: "geo-y11-cos.png", alt: "A triangle with two sides labelled 8 cm and 11 cm meeting at a corner where the angle is marked 40 degrees. The third side, opposite the 40 degree angle, is labelled x." },
          },
          {
            key: "geo-y11-06", kind: "number", difficulty: 2, tolerance: 0.01,
            prompt: "In triangle ABC, side BC = 9 cm, angle A = 40° and angle B = 65°. Use the sine rule to find the length of side AC, in cm, correct to 2 decimal places.",
            answer: 12.69,
            explanation: "BC is opposite A and AC is opposite B. So AC/sin 65° = 9/sin 40°, giving AC = 9 × sin 65° ÷ sin 40° = 12.69 cm.",
          },
          {
            key: "geo-y11-07", kind: "number", difficulty: 2, tolerance: 0.01,
            prompt: "A sector has radius 6 cm and angle 60°. Work out the length of its arc, in cm, to 2 decimal places.",
            answer: 6.28,
            explanation: "The arc is 60/360 = 1/6 of the circumference: 1/6 × 2π × 6 = 2π = 6.28 cm.",
          },
          {
            key: "geo-y11-08", kind: "number", difficulty: 2, tolerance: 0.05,
            prompt: "A sector has radius 8 cm and angle 45°. Work out its area to 1 decimal place, in cm².",
            answer: 25.1,
            explanation: "The sector is 45/360 = 1/8 of the circle: 1/8 × π × 8² = 8π = 25.1 cm².",
          },
          {
            key: "geo-y11-09", kind: "number", difficulty: 2,
            prompt: "In a triangle, two sides are 10 cm and 13 cm and the angle between them is 30°. Work out the area of the triangle, in cm².",
            answer: 32.5,
            explanation: "Use area = ½ab sin C = ½ × 10 × 13 × sin 30° = 65 × 0.5 = 32.5 cm².",
          },
          {
            key: "geo-y11-10", kind: "number", difficulty: 3,
            prompt: "Two similar cans have heights 10 cm and 15 cm. The smaller can holds 400 ml. How much does the larger can hold, in ml? Type your answer as digits with no comma.",
            answer: 1350,
            explanation: "The length scale factor is 1.5. Volumes scale by the cube: 1.5³ = 3.375. So 400 × 3.375 = 1350 ml.",
          },
          {
            key: "geo-y11-11", kind: "number", difficulty: 3,
            prompt: "A cuboid measures 2 cm by 3 cm by 6 cm. Work out the length of its space diagonal, in cm.",
            answer: 7,
            explanation: "Use Pythagoras in 3D: d² = 2² + 3² + 6² = 4 + 9 + 36 = 49, so d = 7 cm.",
          },
          {
            key: "geo-y11-12", kind: "number", difficulty: 3, tolerance: 0.05,
            prompt: "A cuboid has a rectangular base 6 cm by 8 cm and a height of 5 cm. Find the angle between the space diagonal (from a bottom corner to the opposite top corner) and the base, to 1 decimal place.",
            answer: 26.6,
            explanation: "The diagonal of the base is √(6² + 8²) = 10 cm. In the right-angled triangle, tan θ = 5/10, so θ = tan⁻¹(0.5) = 26.6°.",
          },
          {
            key: "geo-y11-13", kind: "written", difficulty: 3, marks: 4,
            prompt: "OAB is a triangle with OA = a and OB = b. M is the midpoint of AB. (a) Write AB in terms of a and b. (b) Show that OM = ½(a + b).",
            answer: "(a) AB = −a + b = b − a. (b) AM = ½(b − a), so OM = OA + AM = a + ½(b − a) = ½a + ½b = ½(a + b).",
            explanation: "Mark scheme (4 marks): 1 for AB = b − a (via AO + OB); 1 for AM = ½(b − a); 1 for OM = OA + AM = a + ½(b − a); 1 for simplifying to ½(a + b).",
          },
          {
            key: "geo-y11-14", kind: "number", difficulty: 2,
            prompt: "Two similar shapes have lengths in the ratio 1 : 3. The smaller has an area of 5 cm². What is the area of the larger, in cm²?",
            answer: 45,
            explanation: "Areas scale by the square of the length scale factor: 3² = 9. So 5 × 9 = 45 cm².",
          },
        ],
      },
      flashcards: [
        { front: "Angle at the centre vs at the circumference", back: "The angle at the centre is twice the angle at the circumference (same arc)." },
        { front: "Angle in a semicircle", back: "90°" },
        { front: "Angles in the same segment", back: "Equal." },
        { front: "Cyclic quadrilateral", back: "Opposite angles add to 180°." },
        { front: "Tangent and radius", back: "They meet at 90°." },
        { front: "Sine rule", back: "a/sin A = b/sin B = c/sin C" },
        { front: "Cosine rule", back: "a² = b² + c² − 2bc cos A" },
        { front: "Area of any triangle", back: "½ab sin C" },
        { front: "Arc length and sector area", back: "θ/360 × 2πr and θ/360 × πr²" },
        { front: "Similar shapes: scale factor k", back: "Length × k, area × k², volume × k³." },
        { front: "Vector AB in terms of OA and OB", back: "AB = −OA + OB = b − a" },
        { front: "Space diagonal of a cuboid", back: "√(l² + w² + h²)" },
      ],
    },
  },
};
