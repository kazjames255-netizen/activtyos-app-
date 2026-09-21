// KS5 Maths — Vectors (Year 12 AS 2D and basic 3D, Year 13 A2 lines and scalar product in 3D). Original content aligned to the DfE GCE AS and A-level mathematics subject content.
// Answer keys are recomputed by _c_vec.ts — re-run after ANY edit here.
import type { CTopic } from "../types";
import { S, NUM, WR } from "./_h4";

export const TOPIC: CTopic = {
  key: "vec",
  topic: "Vectors",
  subject: "Maths",
  years: {
    12: {
      year: 12,
      objectives: [
        "Use vectors in two dimensions, in column form and in i, j form.",
        "Calculate the magnitude and direction of a vector, and convert between magnitude-direction and component form.",
        "Add and subtract vectors, multiply a vector by a scalar, and understand parallel vectors.",
        "Use position vectors and find the vector between two points.",
        "Use vectors to solve problems in pure mathematics and geometric proofs.",
        "Extend to three dimensions: magnitude of a vector and unit vectors.",
      ],
      note: {
        title: "Year 12: vectors in two and three dimensions",
        body: `## Key ideas

A **vector** has magnitude and direction. In two dimensions write it as a column (x, y) or as xi + yj, where i and j are unit vectors along the axes. In three dimensions add k.

- **Magnitude:** |xi + yj| = √(x² + y²), and in 3D |xi + yj + zk| = √(x² + y² + z²).
- **Direction:** the angle θ to the positive x-axis has tan θ = y/x. Check the quadrant.
- **Add and subtract** component by component. Multiplying by a scalar k scales every component.
- **Parallel vectors:** a is parallel to b if a = kb for some scalar k.
- **Position vector** of A is OA = a. The vector from A to B is **AB = b − a** (end minus start).
- **Unit vector** in the direction of a: a / |a|.
- **Midpoint** of AB has position vector ½(a + b).

## Worked example 1: vector between points

A(2, −3) and B(−1, 1). Then AB = b − a = (−1 − 2, 1 − (−3)) = (−3, 4), so AB = **−3i + 4j** and |AB| = √(9 + 16) = **5**.

## Worked example 2: 3D unit vector

Find the unit vector in the direction of i + 4j + 8k.
|i + 4j + 8k| = √(1 + 16 + 64) = 9.
The unit vector is **(1/9)(i + 4j + 8k)**.

## Geometric proofs

To prove a property, write each side of the figure in terms of two vectors (for example a and b), then compare. Points are collinear if AB = k × BC for a scalar k. Give a clear conclusion in words.

## Common slips

- Subtracting in the wrong order: AB = b − a, not a − b.
- Forgetting to check the quadrant when finding a direction angle.
- Treating a scalar multiple as a change of direction: a negative multiple reverses it.`,
      },
      quiz: {
        title: "Vectors: Year 12 quiz",
        questions: [
          NUM("vec-y12-01", 1, "Find the magnitude of the vector 5i + 12j.", 13, 0, "|5i + 12j| = √(25 + 144) = √169 = 13."),
          S("vec-y12-02", 1, "Given a = 2i + 3j and b = i − 4j, find a + b.", ["3i + 7j", "3i − j", "i + 7j", "3i + j"], "3i − j", "Add the i components: 2 + 1 = 3, and the j components: 3 + (−4) = −1."),
          S("vec-y12-03", 1, "The points A and B have position vectors a = i + j and b = 7i + 9j. Find the vector AB.", ["−6i − 8j", "8i + 10j", "6i + 8j", "4i + 5j"], "6i + 8j", "AB = b − a = (7 − 1)i + (9 − 1)j = 6i + 8j (end point minus start point)."),
          NUM("vec-y12-04", 2, "Find the magnitude of the vector 4i − 7j, to 2 decimal places.", 8.06, 0.005, "|4i − 7j| = √(16 + 49) = √65 ≈ 8.06.", { diagnostic: true }),
          NUM("vec-y12-05", 2, "The vector −2i + 3j is shown. Find the angle θ it makes with the positive x-axis, measured anticlockwise, in degrees to 1 decimal place.", 123.7, 0.05, "The vector points into the second quadrant. The acute angle with the negative x-axis is tan⁻¹(3/2) = 56.3°, so θ = 180° − 56.3° = 123.7°.", { image: { file: "vec-y12-grid.png", alt: "A grid with a vector drawn from the origin to the point (−2, 3), and an arc showing the angle θ measured anticlockwise from the positive x-axis to the vector." } }),
          S("vec-y12-06", 2, "Which vector is parallel to 6i − 9j?", ["4i + 6j", "3i + 2j", "−2i − 3j", "2i − 3j"], "2i − 3j", "6i − 9j = 3(2i − 3j), so 2i − 3j is a scalar multiple of it.", { diagnostic: true }),
          NUM("vec-y12-07", 2, "The vectors λi + 6j and 2i − 3j are parallel. Find λ.", -4, 0, "λi + 6j = k(2i − 3j) with −3k = 6, so k = −2 and λ = 2k = −4."),
          NUM("vec-y12-08", 2, "Given p = 2i − j and q = −5i + 4j, find |p + q| to 3 decimal places.", 4.243, 0.0005, "p + q = −3i + 3j, so |p + q| = √(9 + 9) = √18 = 3√2 ≈ 4.243."),
          NUM("vec-y12-09", 2, "Find the magnitude of the three-dimensional vector 2i − 3j + 6k.", 7, 0, "|v| = √(4 + 9 + 36) = √49 = 7."),
          NUM("vec-y12-10", 3, "A vector has magnitude 21 and points in the same direction as 2i − 3j + 6k. Find its k-component.", 18, 0, "The given vector has magnitude 7, so the required vector is 3 times it: 6i − 9j + 18k. The k-component is 18."),
          S("vec-y12-11", 3, "OA = a and OB = b. The point N lies on AB with AN : NB = 1 : 2. Find ON.", ["⅔a + ⅓b", "⅓a + ⅔b", "½a + ½b", "a + ⅓b"], "⅔a + ⅓b", "AB = b − a and AN = ⅓AB, so ON = a + ⅓(b − a) = ⅔a + ⅓b."),
          NUM("vec-y12-12", 3, "A(1, −2) and B(7, 10). The point P lies on AB with AP : PB = 2 : 1. Find the y-coordinate of P.", 6, 0, "AB = (6, 12) and AP = ⅔AB = (4, 8). So P = (1 + 4, −2 + 8) = (5, 6), and the y-coordinate is 6."),
          WR("vec-y12-13", 3, "OABC is a parallelogram with OA = a and OC = c. Prove that the diagonals OB and AC bisect each other.", 4, "Mark scheme (4 marks): (1) OB = OA + AB = a + c since AB = OC = c. (2) The midpoint of OB has position vector ½(a + c). (3) AC = c − a, so the midpoint of AC has position vector a + ½(c − a) = ½(a + c). (4) Both midpoints have the same position vector, so the diagonals meet at their common midpoint and bisect each other.", { image: { file: "vec-y12-parallelogram.png", alt: "A parallelogram OABC with O at the bottom left, A at the bottom right and C at the top left; the sides OA and OC are marked with arrows and labelled a and c, and the two diagonals OB and AC are drawn." } }),
        ],
      },
      flashcards: [
        { front: "Magnitude of xi + yj", back: "√(x² + y²)" },
        { front: "Magnitude of xi + yj + zk", back: "√(x² + y² + z²)" },
        { front: "Vector from A to B", back: "AB = b − a (end minus start)" },
        { front: "Unit vector in the direction of a", back: "a / |a|" },
        { front: "Test for parallel vectors", back: "One is a scalar multiple of the other: a = kb" },
        { front: "Midpoint of A and B (position vectors)", back: "½(a + b)" },
        { front: "Direction angle of xi + yj", back: "tan θ = y/x, then adjust for the quadrant" },
        { front: "Point dividing AB in the ratio m : n", back: "a + (m/(m + n))(b − a)" },
        { front: "What does a negative scalar multiple do?", back: "Reverses the direction of the vector" },
        { front: "Test for three collinear points A, B, C", back: "AB = k × BC for some scalar k" },
      ],
    },
    13: {
      year: 13,
      objectives: [
        "Use vectors in three dimensions, including magnitude, distance and diagonals of solids.",
        "Write the vector equation of a line r = a + λb and find a line through two points.",
        "Decide whether two lines are parallel, intersecting or skew, and find any point of intersection.",
        "Use the scalar (dot) product to find the angle between two vectors or lines and to test for perpendicularity.",
        "Use collinearity and find the perpendicular distance from a point to a line.",
      ],
      note: {
        title: "Year 13: lines and the scalar product in three dimensions",
        body: `## Key results

- **Line:** r = a + λb passes through the point with position vector a and has direction b. Different λ give different points.
- **Line through two points** A and B: r = a + λ(b − a).
- **Scalar product:** a · b = a₁b₁ + a₂b₂ + a₃b₃ = |a||b| cos θ, so cos θ = (a · b) / (|a||b|).
- **Perpendicular** vectors have a · b = 0.
- **Distance between two points:** the magnitude of the vector between them.
- **Two lines** are:
  1. **parallel** if their directions are multiples of each other;
  2. **intersecting** if they are not parallel and there is a common point;
  3. **skew** if they are not parallel and never meet (only possible in 3D).

## Testing for intersection

Set the two position vectors equal. Use two of the three component equations to find λ and μ, then check the third. If it holds, the lines meet, and substituting gives the point. If not, they are skew.

## Worked example 1: a line and its points

The line r = (2, −1, 4) + λ(1, 3, −2). When λ = 3 the point is (5, 8, −2). The point (4, 5, 0) lies on it: λ = 2 works in all three components.

## Worked example 2: an angle

Find the angle between the vectors (1, 1, 0) and (0, 1, 1).
a · b = 0 + 1 + 0 = 1, and |a| = |b| = √2.
cos θ = 1/2, so θ = **60°**.

## Common slips

- Using the wrong vector as the direction: it is b − a, not b.
- Concluding "intersect" after checking only two components. Always check the third.
- Forgetting that the angle between two lines is found from their direction vectors, and quoting the acute angle.`,
      },
      quiz: {
        title: "Vectors: Year 13 quiz",
        questions: [
          NUM("vec-y13-01", 1, "Find the scalar product of (2, −1, 3) and (4, 5, 1).", 6, 0, "2 × 4 + (−1) × 5 + 3 × 1 = 8 − 5 + 3 = 6."),
          S("vec-y13-02", 2, "Which is a vector equation of the line through A(1, 2, 3) and B(3, 2, 2)?", ["r = (1, 2, 3) + λ(3, 2, 2)", "r = (3, 2, 2) + λ(1, 2, 3)", "r = (1, 2, 3) + λ(2, 0, −1)", "r = (1, 2, 3) + λ(−2, 0, −1)"], "r = (1, 2, 3) + λ(2, 0, −1)", "The direction is AB = b − a = (2, 0, −1), and the line passes through A."),
          NUM("vec-y13-03", 1, "The vectors a = (1, −2, 3) and b = (−3, 6, −9) are parallel, with b = λa. Find λ.", -3, 0, "Compare components: −3 = λ × 1, so λ = −3 (and 6 = −3 × −2, −9 = −3 × 3 confirm it)."),
          NUM("vec-y13-04", 2, "Find the angle between the vectors (1, 2, 2) and (2, 3, 6), in degrees to 1 decimal place.", 17.8, 0.05, "a · b = 2 + 6 + 12 = 20, |a| = 3 and |b| = 7, so cos θ = 20/21 and θ ≈ 17.8°.", { diagnostic: true }),
          S("vec-y13-05", 2, "The lines l₁: r = (1, 2, 3) + λ(1, 1, 2) and l₂: r = (5, 0, 2) + μ(−2, 4, 5) are given. Which statement is correct?", ["The lines are parallel", "The lines intersect at (3, 4, 7)", "The lines intersect at (2, 3, 5)", "The lines are skew"], "The lines intersect at (3, 4, 7)", "Equating x and y: 1 + λ = 5 − 2μ and 2 + λ = 4μ give λ = 2, μ = 1. The z components agree: 3 + 4 = 7 = 2 + 5, so they meet at (3, 4, 7)."),
          S("vec-y13-06", 2, "The lines r = λ(1, 1, 0) and r = (0, 0, 1) + μ(1, −1, 0) are given. Which statement is correct?", ["The lines are parallel", "The lines intersect", "The lines are the same line", "The lines are skew"], "The lines are skew", "Their directions are not parallel. Equating x and y forces λ = μ = 0, but then z would need 0 = 1. So they never meet.", { diagnostic: true }),
          NUM("vec-y13-07", 2, "The point (k, 5, m) lies on the line r = (1, −1, 2) + λ(2, 3, −1). Find k + m.", 5, 0, "The y component gives −1 + 3λ = 5, so λ = 2. Then k = 1 + 4 = 5 and m = 2 − 2 = 0, so k + m = 5."),
          NUM("vec-y13-08", 1, "The cuboid OABCDEFG has OA = 4 along the x-axis, OC = 4 along the y-axis and OD = 7 along the z-axis. Find the length of the diagonal OF.", 9, 0, "OF = √(4² + 4² + 7²) = √81 = 9.", { image: { file: "vec-y13-cuboid.png", alt: "A cuboid drawn in perspective with corner O at the front bottom left and the edges from O along the x-axis, y-axis and z-axis labelled 4, 4 and 7. The opposite corner F is joined to O by a dashed diagonal." } }),
          NUM("vec-y13-09", 3, "Find the perpendicular distance from P(4, 1, 3) to the line r = (1, 2, 3) + λ(1, 1, 1), to 3 decimal places.", 2.944, 0.0005, "AP = (3, −1, 0). The distance is |AP × d| / |d| where d = (1, 1, 1): AP × d = (−1, −3, 4), magnitude √26, so the distance is √26/√3 ≈ 2.944."),
          NUM("vec-y13-10", 3, "Find the acute angle between the lines with directions (2, −1, 2) and (1, 4, 8), in degrees to 1 decimal place.", 58.8, 0.05, "a · b = 2 − 4 + 16 = 14, |a| = 3, |b| = 9, so cos θ = 14/27 and θ ≈ 58.8°."),
          NUM("vec-y13-11", 3, "The vectors (p, 2, −1) and (3, p, 4) are perpendicular. Find p as a decimal.", 0.8, 0, "The scalar product is zero: 3p + 2p − 4 = 0, so 5p = 4 and p = 0.8."),
          NUM("vec-y13-12", 2, "The points A(1, 2, 3), B(4, 5, 9) and C(k, 8, 15) are collinear. Find k.", 7, 0, "AB = (3, 3, 6) and AC = (k − 1, 6, 12) = 2AB. So k − 1 = 6 and k = 7."),
          WR("vec-y13-13", 3, "Show that the lines l₁: r = (1, 0, 2) + λ(2, 1, −1) and l₂: r = (3, 2, 1) + μ(1, −1, 1) are skew.", 4, "Mark scheme (4 marks): (1) The directions (2, 1, −1) and (1, −1, 1) are not multiples of each other, so the lines are not parallel. (2) Equate x and y: 1 + 2λ = 3 + μ and λ = 2 − μ. (3) Solving gives λ = 4/3 and μ = 2/3. (4) Check z: 2 − 4/3 = 2/3 for l₁ but 1 + 2/3 = 5/3 for l₂. These differ, so the lines never meet and are skew."),
        ],
      },
      flashcards: [
        { front: "Vector equation of a line", back: "r = a + λb (a = a point on it, b = direction)" },
        { front: "Line through points A and B", back: "r = a + λ(b − a)" },
        { front: "Scalar product in components", back: "a · b = a₁b₁ + a₂b₂ + a₃b₃" },
        { front: "Angle between two vectors", back: "cos θ = (a · b) / (|a||b|)" },
        { front: "Perpendicular test", back: "a · b = 0" },
        { front: "Parallel lines", back: "Direction vectors are scalar multiples" },
        { front: "What are skew lines?", back: "Not parallel and never meet (only in 3D)" },
        { front: "How do you test two lines for intersection?", back: "Equate components, solve for λ and μ using two, and check the third" },
        { front: "Distance from a point to a line", back: "|AP × d| / |d| (A on the line, d its direction)" },
        { front: "Length of a space diagonal of a cuboid a × b × c", back: "√(a² + b² + c²)" },
      ],
    },
  },
};
