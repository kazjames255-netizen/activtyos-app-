// KS5 Maths — Coordinate Geometry (Year 12 AS lines and circles, Year 13 A2 parametric equations). Original content aligned to the DfE GCE AS and A-level mathematics subject content.
// Answer keys are recomputed by _c_coord.ts (run via _check_m4.ts) — re-run after ANY edit here.
import type { CTopic } from "../types";
import { S, NUM, SH, WR, variants } from "./_h4";

export const TOPIC: CTopic = {
  key: "coord",
  topic: "Coordinate Geometry",
  subject: "Maths",
  years: {
    12: {
      year: 12,
      objectives: [
        "Use the equation of a straight line in the forms y = mx + c and y − y₁ = m(x − x₁); find gradients, midpoints and distances.",
        "Use the conditions for two straight lines to be parallel or perpendicular.",
        "Use and find the equation of a circle: (x − a)² + (y − b)² = r².",
        "Complete the square to find the centre and radius of a circle from its expanded equation.",
        "Use circle properties: tangent perpendicular to the radius, angle in a semicircle, perpendicular from the centre bisects a chord.",
        "Find where a line meets a circle and whether it is a tangent.",
      ],
      note: {
        title: "Year 12: straight lines and circles",
        body: `## Key formulae

- **Gradient** through (x₁, y₁) and (x₂, y₂): m = (y₂ − y₁)/(x₂ − x₁).
- **Line through a point:** y − y₁ = m(x − x₁).
- **Midpoint:** ((x₁ + x₂)/2, (y₁ + y₂)/2). **Distance:** √[(x₂ − x₁)² + (y₂ − y₁)²].
- **Parallel** lines have equal gradients; **perpendicular** gradients satisfy m₁m₂ = −1.
- **Circle:** centre (a, b), radius r: (x − a)² + (y − b)² = r².
- **Expanded form:** x² + y² + 2fx + 2gy + c = 0 has centre (−f, −g) and radius √(f² + g² − c); complete the square to find them.

## Circle facts

- The **tangent** at a point is perpendicular to the radius to that point.
- The angle in a **semicircle** is 90°.
- The line from the centre **perpendicular to a chord** bisects the chord.
- To find where a line meets a circle, substitute the line into the circle. The discriminant tells you: two roots (secant), one repeated root (tangent), none (misses).

## Worked example 1: a line through two points

Line through (−1, 4) and (3, 12). Gradient = (12 − 4)/(3 + 1) = 2. Then y − 4 = 2(x + 1), so **y = 2x + 6**.

## Worked example 2: centre and radius

x² + y² + 8x − 2y + 8 = 0. Complete the squares: (x + 4)² − 16 + (y − 1)² − 1 + 8 = 0, so (x + 4)² + (y − 1)² = 9. Centre **(−4, 1)**, radius **3**.

## Checking a tangent

Substitute the line into the circle. If the resulting quadratic has discriminant b² − 4ac = 0, the line touches at exactly one point.`,
      },
      quiz: {
        title: "Coordinate Geometry: Year 12 quiz",
        questions: [
          NUM("coord-y12-01", 1, "Find the gradient of the line through (1, 3) and (4, 12).", 3, 0, "Gradient = change in y ÷ change in x = (12 − 3)/(4 − 1) = 9/3 = 3."),
          SH("coord-y12-02", 1, "Find the midpoint of (2, −4) and (8, 6). Give your answer in the form (a, b).", "(5, 1)", variants("(5, 1)"), "Average the x-coordinates and the y-coordinates: ((2 + 8)/2, (−4 + 6)/2) = (5, 1)."),
          NUM("coord-y12-03", 1, "Find the distance between (1, 2) and (7, 10).", 10, 0, "Distance = √(6² + 8²) = √100 = 10."),
          S("coord-y12-04", 2, "Find the equation of the line through (2, 5) with gradient −3.", ["y = −3x + 5", "y = −3x + 11", "y = 3x − 1", "y = −3x − 1"], "y = −3x + 11", "y − 5 = −3(x − 2), so y = −3x + 6 + 5 = −3x + 11.", { diagnostic: true }),
          S("coord-y12-05", 2, "Find the equation of the line through (4, 1) that is perpendicular to y = 2x + 1.", ["y = −½x + 3", "y = −2x + 9", "y = ½x − 1", "y = −½x + 1"], "y = −½x + 3", "The perpendicular gradient is −1/2. Then y − 1 = −½(x − 4), so y = −½x + 2 + 1 = −½x + 3."),
          S("coord-y12-06", 2, "The circle x² + y² − 6x + 4y − 12 = 0 has which centre and radius?", ["centre (−3, 2), radius 5", "centre (3, −2), radius 25", "centre (3, −2), radius 5", "centre (−3, 2), radius 25"], "centre (3, −2), radius 5", "Complete the square: (x − 3)² + (y + 2)² = 12 + 9 + 4 = 25. The centre is (3, −2) and the radius is √25 = 5.", { diagnostic: true }),
          S("coord-y12-07", 2, "Which is the equation of the circle with centre (−1, 4) and radius 3?", ["(x − 1)² + (y + 4)² = 9", "(x + 1)² + (y − 4)² = 3", "(x − 1)² + (y + 4)² = 3", "(x + 1)² + (y − 4)² = 9"], "(x + 1)² + (y − 4)² = 9", "The equation is (x − a)² + (y − b)² = r², so with a = −1, b = 4 we get (x + 1)² + (y − 4)² = 3² = 9."),
          S("coord-y12-08", 1, "The circle (x − 2)² + (y − 2)² = 25 is given. Where is the point (5, 6)?", ["inside the circle", "on the circle", "outside the circle", "at the centre"], "on the circle", "Its squared distance from the centre (2, 2) is 3² + 4² = 25 = r², so it lies on the circle."),
          NUM("coord-y12-09", 2, "The tangent to x² + y² = 25 at (3, 4) crosses the y-axis at (0, k). Find k as a decimal.", 6.25, 0, "The radius to (3, 4) has gradient 4/3, so the tangent has gradient −3/4. Then y − 4 = −¾(x − 3) and at x = 0, y = 4 + 9/4 = 6.25."),
          NUM("coord-y12-10", 3, "The line y = x + k, with k > 0, is a tangent to the circle x² + y² = 8. Find k.", 4, 0, "Substituting gives 2x² + 2kx + k² − 8 = 0. A tangent needs discriminant 0: 4k² − 8(k² − 8) = 0, so k² = 16 and k = 4."),
          NUM("coord-y12-11", 3, "The line y = x + 3 cuts the circle (x − 1)² + (y − 2)² = 10 at two points, as shown. Find the length of the chord between them, to 3 decimal places.", 5.657, 0.0005, "Substitute: (x − 1)² + (x + 1)² = 10 gives 2x² + 2 = 10, so x = ±2 and the points are (2, 5) and (−2, 1). The distance is √(4² + 4²) = √32 ≈ 5.657.", { image: { file: "coord-y12-circle-line.png", alt: "A grid showing a circle with its centre marked at (1, 2) and a straight line of gradient 1 crossing the circle at two points, which are marked with dots." } }),
          NUM("coord-y12-12", 2, "A(−2, 1) and B(4, 5) are the ends of a diameter of a circle. Find the value of r², the square of the radius.", 13, 0, "The diameter length squared is 6² + 4² = 52, so the radius squared is 52 ÷ 4 = 13."),
          WR("coord-y12-13", 3, "The triangle ABC has vertices A(0, 0), B(4, 2) and C(−1, 2). Show that the triangle is right-angled and find its area.", 4, "Mark scheme (4 marks): (1) Gradient of AB = 2/4 = ½ and gradient of AC = 2/(−1) = −2. (2) Product = −1, so AB ⟂ AC and the angle at A is 90°. (3) AB = √20 and AC = √5. (4) Area = ½ × √20 × √5 = ½ × 10 = 5."),
        ],
      },
      flashcards: [
        { front: "Gradient through (x₁, y₁) and (x₂, y₂)", back: "(y₂ − y₁)/(x₂ − x₁)" },
        { front: "Equation of a line through (x₁, y₁) with gradient m", back: "y − y₁ = m(x − x₁)" },
        { front: "Midpoint of two points", back: "The average of the x's and the average of the y's" },
        { front: "Distance between two points", back: "√[(x₂ − x₁)² + (y₂ − y₁)²]" },
        { front: "Condition for perpendicular lines", back: "m₁ × m₂ = −1" },
        { front: "Equation of a circle, centre (a, b), radius r", back: "(x − a)² + (y − b)² = r²" },
        { front: "How do you find the centre from x² + y² + 2fx + 2gy + c = 0?", back: "Complete the square: centre (−f, −g), r² = f² + g² − c" },
        { front: "Tangent and radius", back: "The tangent is perpendicular to the radius at the point of contact" },
        { front: "Angle in a semicircle", back: "90°" },
        { front: "Discriminant when a line meets a circle at exactly one point", back: "b² − 4ac = 0 after substituting (tangent)" },
      ],
    },
    13: {
      year: 13,
      objectives: [
        "Understand and use parametric equations of curves and convert between parametric and Cartesian forms.",
        "Use parametric equations in modelling in a variety of contexts, such as projectile motion.",
        "Find points on a parametric curve and where it meets the axes or a line.",
        "Find the gradient of a parametric curve.",
      ],
      note: {
        title: "Year 13: parametric equations",
        body: `## What is a parametric curve?

Instead of y as a function of x, both coordinates are written in terms of a third variable, the **parameter** t: x = f(t), y = g(t). Each value of t gives one point, and as t changes the point traces out a curve.

## Converting to Cartesian form

1. **Substitution:** make t the subject of one equation and put it into the other.
2. **Trig identity:** if x and y involve sin t and cos t, use sin² t + cos² t = 1.
3. Other tricks: add, subtract or multiply the equations to cancel t (for example, x + y and x − y, or xy).

## Useful results

- **Circle:** x = a + r cos t, y = b + r sin t gives (x − a)² + (y − b)² = r².
- **Ellipse:** x = p cos t, y = q sin t gives x²/p² + y²/q² = 1.
- **Gradient:** dy/dx = (dy/dt) ÷ (dx/dt).
- To find where the curve meets an axis, set x = 0 or y = 0, solve for t, then evaluate the other coordinate.
- In **modelling**, t is often time: x is the horizontal distance and y the height.

## Worked example 1: substitution

x = 2t − 1, y = t² + 3. Then t = (x + 1)/2, so y = (x + 1)²/4 + 3.

## Worked example 2: trig identity

x = cos t + 2, y = 2 sin t. Then cos t = x − 2 and sin t = y/2. Using cos² t + sin² t = 1 gives **(x − 2)² + y²/4 = 1**, an ellipse centred at (2, 0).

## Checking

Substitute a value of t into both the parametric and the Cartesian equation. Both must give the same point.`,
      },
      quiz: {
        title: "Coordinate Geometry: Year 13 quiz",
        questions: [
          S("coord-y13-01", 1, "A curve has parametric equations x = 2t, y = t². What is its Cartesian equation?", ["y = 2x²", "y = 4x²", "y = x²/4", "y = x²/2"], "y = x²/4", "From x = 2t we get t = x/2, so y = (x/2)² = x²/4."),
          SH("coord-y13-02", 1, "A curve has x = t + 1 and y = 2t². Find the point on the curve when t = 3, in the form (a, b).", "(4, 18)", variants("(4, 18)"), "Substitute t = 3: x = 4 and y = 2 × 9 = 18."),
          S("coord-y13-03", 1, "The curve x = 3 cos t, y = 3 sin t is:", ["an ellipse", "a parabola", "a straight line", "a circle of radius 3"], "a circle of radius 3", "x² + y² = 9(cos² t + sin² t) = 9, which is a circle centred at the origin with radius 3."),
          S("coord-y13-04", 2, "A curve has x = t², y = 2t. Which Cartesian equation describes it?", ["y = 4x", "y² = 4x", "y = x²", "y² = 2x"], "y² = 4x", "y² = 4t² and x = t², so y² = 4x.", { diagnostic: true }),
          S("coord-y13-05", 2, "The curve x = 2 cos t, y = 3 sin t has Cartesian equation:", ["x² + y² = 13", "x²/9 + y²/4 = 1", "x²/4 + y²/9 = 1", "x/2 + y/3 = 1"], "x²/4 + y²/9 = 1", "cos t = x/2 and sin t = y/3, and cos² t + sin² t = 1 gives x²/4 + y²/9 = 1."),
          S("coord-y13-06", 2, "A curve has x = t − 1 and y = t². Find its Cartesian equation.", ["y = x² + 1", "y = (x − 1)²", "y = x² − 1", "y = (x + 1)²"], "y = (x + 1)²", "From x = t − 1, t = x + 1, so y = (x + 1)².", { diagnostic: true }),
          NUM("coord-y13-07", 2, "A curve has x = 2t + 1 and y = t² − 3. Where does it cross the y-axis? Give the y-coordinate as a decimal.", -2.75, 0, "On the y-axis x = 0, so 2t + 1 = 0 and t = −½. Then y = ¼ − 3 = −2.75."),
          NUM("coord-y13-08", 2, "A curve has x = 2t + 1 and y = t³. Find dy/dx when t = 2.", 6, 0, "dy/dt = 3t² = 12 and dx/dt = 2, so dy/dx = 12/2 = 6."),
          NUM("coord-y13-09", 2, "A ball follows the path x = 12t, y = 15t − 5t², for t ≥ 0 (x and y in metres, t in seconds). How far horizontally, in metres, has it travelled when it returns to the level y = 0?", 36, 0, "y = 5t(3 − t) = 0 gives t = 3 s (t = 0 is the start). Then x = 12 × 3 = 36 m."),
          NUM("coord-y13-10", 3, "For the same path x = 12t, y = 15t − 5t², find the greatest height reached, in metres.", 11.25, 0, "dy/dt = 15 − 10t = 0 gives t = 1.5. Then y = 22.5 − 11.25 = 11.25 m."),
          S("coord-y13-11", 3, "A curve has x = t + 1/t and y = t − 1/t. Which relationship between x and y holds for all t ≠ 0?", ["x² + y² = 4", "x² − y² = 4", "x + y = 4", "xy = 4"], "x² − y² = 4", "x² = t² + 2 + 1/t² and y² = t² − 2 + 1/t². Subtracting gives x² − y² = 4."),
          NUM("coord-y13-12", 3, "The curve x = 1 + 4 cos t, y = −2 + 4 sin t crosses the x-axis at two points. Find the larger x-coordinate, to 3 decimal places.", 4.464, 0.0005, "y = 0 gives sin t = ½, so cos t = ±√3/2. The larger x is 1 + 4 × (√3/2) = 1 + 2√3 ≈ 4.464."),
          WR("coord-y13-13", 3, "A curve has parametric equations x = 3t and y = t² + 2t. Show that its Cartesian equation is 9y = x² + 6x.", 3, "Mark scheme (3 marks): (1) t = x/3 from the first equation. (2) Substitute: y = x²/9 + 2x/3. (3) Multiply by 9: 9y = x² + 6x."),
        ],
      },
      flashcards: [
        { front: "What is a parameter?", back: "A third variable (often t) that gives both x and y: x = f(t), y = g(t)" },
        { front: "Two ways to eliminate the parameter", back: "Substitute t from one equation into the other; or use an identity such as sin² t + cos² t = 1" },
        { front: "Parametric form of a circle, centre (a, b), radius r", back: "x = a + r cos t, y = b + r sin t" },
        { front: "Parametric form of the ellipse x²/p² + y²/q² = 1", back: "x = p cos t, y = q sin t" },
        { front: "Gradient of a parametric curve", back: "dy/dx = (dy/dt) ÷ (dx/dt)" },
        { front: "How do you find where a parametric curve crosses the y-axis?", back: "Set x = 0, solve for t, then find y" },
        { front: "In projectile modelling, what are x and y?", back: "Horizontal distance and height at time t" },
        { front: "How do you check a Cartesian equation you have found?", back: "Substitute a value of t into both forms and compare the point" },
        { front: "Identity used with sin t and cos t", back: "sin² t + cos² t = 1" },
      ],
    },
  },
};
