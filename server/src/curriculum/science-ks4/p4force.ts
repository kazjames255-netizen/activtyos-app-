// GCSE Physics — Forces (Year 10: motion, work, springs; Year 11: Newton's laws, stopping distance, momentum, moments).
import type { CTopic } from "../types";
import { N, S, W, yr } from "./_h";
import { VT } from "./_imgdata";

const IMG = ["p4force-vt.png", "A velocity–time graph for a car. The line rises steadily from 0 metres per second at 0 seconds to 20 metres per second at 10 seconds, stays flat at 20 metres per second until 30 seconds, then falls in a straight line to 0 metres per second at 35 seconds."] as [string, string];
const area = () => { let a = 0; for (let i = 1; i < VT.pts.length; i++) a += ((VT.pts[i][0] - VT.pts[i - 1][0]) * (VT.pts[i][1] + VT.pts[i - 1][1])) / 2; return a; };

export const TOPIC: CTopic = {
  key: "p4force", topic: "Physics — Forces", subject: "Science",
  years: {
    10: yr("p4force", 10, {
      obj: [
        "Distinguish scalar and vector quantities; describe forces as vectors.",
        "Calculate speed and average speed; interpret distance–time graphs.",
        "Calculate acceleration using a = Δv ÷ t; use v² − u² = 2as; interpret velocity–time graphs (gradient and area).",
        "Calculate work done W = F s; describe energy transfers by forces.",
        "Describe elastic and inelastic deformation; use F = k e, Eₑ = ½ k e² and the limit of proportionality.",
        "Required practical: investigate the extension of a spring.",
      ],
      note: ["GCSE Physics: motion, work and springs", `## Scalars and vectors
**Scalars** have only size (speed, distance, mass, energy). **Vectors** have size and direction (velocity, force, displacement, acceleration).

## Motion equations
| Quantity | Equation |
| --- | --- |
| Speed | v = s ÷ t |
| Acceleration | a = (v − u) ÷ t |
| Uniform acceleration | v² − u² = 2 a s |
| Work done | W = F s |
| Hooke's law | F = k e |
| Elastic energy | Eₑ = ½ k e² |

## Graphs
- **Distance–time**: gradient = speed; flat line = stationary.
- **Velocity–time**: gradient = **acceleration**; **area under the line = distance travelled**; flat line = constant velocity.

## Springs
A spring obeys **F = k e** (force proportional to extension) up to its **limit of proportionality**. Beyond it the graph curves, and past the elastic limit the spring is permanently deformed.

## Worked examples
- 100 m in 12.5 s: v = 100 ÷ 12.5 = **8 m/s**.
- 0 to 12 m/s in 4 s: a = 12 ÷ 4 = **3 m/s²**.
- 40 N pushes a box 5 m: W = 40 × 5 = **200 J**.
- A 10 N force stretches a spring 0.050 m: k = 10 ÷ 0.050 = **200 N/m**.

**Working scientifically:** in the spring practical, use a set square to read the ruler at eye level, and measure the extension (new length − original length) each time.`],
      quiz: "GCSE Physics: Forces quiz (Year 10)",
      qs: [
        S(1, "Which of these is a vector quantity?", "Force", ["Mass", "Speed", "Energy"], "A vector has direction as well as size. Force acts in a direction; mass, speed and energy do not.", {}),
        S(1, "What is the unit of force?", "Newton", ["Joule", "Watt", "Pascal"], "Force is measured in newtons (N).", {}),
        N(1, "A cyclist travels 300 m in 20 s at a constant speed. Calculate the speed in m/s.", 15, 0.05, "Speed = distance ÷ time = 300 ÷ 20 = 15 m/s.", () => 300 / 20),
        N(2, "Use the velocity–time graph. Calculate the acceleration of the car during the first 10 seconds, in m/s².", 2, 0.05, "Acceleration = gradient = change in velocity ÷ time = (20 − 0) ÷ 10 = 2 m/s².", () => (VT.pts[1][1] - VT.pts[0][1]) / (VT.pts[1][0] - VT.pts[0][0]), { img: IMG, diag: true }),
        N(2, "Use the graph. What distance does the car travel between 10 s and 30 s, in metres?", 400, 5, "Between 10 s and 30 s the velocity is constant at 20 m/s: distance = 20 × 20 = 400 m (area of the rectangle).", () => (VT.pts[2][0] - VT.pts[1][0]) * VT.pts[1][1], { img: IMG }),
        N(2, "Use the graph. What is the total distance travelled in 35 seconds, in metres?", 550, 5, "Area under the graph: first triangle ½ × 10 × 20 = 100 m; rectangle 400 m; last triangle ½ × 5 × 20 = 50 m. Total = 550 m.", () => area(), { img: IMG }),
        N(2, "Over the whole journey the car travels 550 m in 35 s. Calculate its average speed in m/s to 1 decimal place.", 15.7, 0.05, "Average speed = total distance ÷ total time = 550 ÷ 35 = 15.7 m/s.", () => area() / VT.pts[VT.pts.length - 1][0]),
        S(2, "What does the horizontal section of the velocity–time graph, between 10 s and 30 s, show?", "The car is moving at a constant speed", ["The car is stationary 20 m from the start", "The car is accelerating at a steady rate", "The car is decelerating at a steady rate"], "A flat velocity–time line means the velocity is not changing: constant speed of 20 m/s. A stationary object would be on the time axis at 0.", { img: IMG }),
        S(2, "What does a horizontal line on a distance–time graph show?", "The object is stationary", ["The object is moving at constant speed", "The object is accelerating", "The object is returning to its start"], "On a distance–time graph the gradient is speed. A gradient of zero means no speed: the object is at rest.", {}),
        N(2, "A force of 250 N pushes a trolley 12 m along the ground. Calculate the work done in joules.", 3000, 1, "Work done = force × distance = 250 × 12 = 3000 J.", () => 250 * 12, { diag: true }),
        N(3, "A ball accelerates uniformly from rest at 3.0 m/s² over a distance of 24 m. Calculate its final speed in m/s.", 12, 0.05, "v² − u² = 2 a s with u = 0: v² = 2 × 3.0 × 24 = 144, so v = 12 m/s.", () => Math.sqrt(2 * 3.0 * 24)),
        N(3, "A spring has a spring constant of 150 N/m and is stretched by 0.060 m. Calculate the elastic potential energy stored in joules.", 0.27, 0.005, "Eₑ = ½ k e² = 0.5 × 150 × 0.060² = 0.5 × 150 × 0.0036 = 0.27 J.", () => 0.5 * 150 * 0.06 ** 2),
        S(3, "A student plots force against extension for a spring. The line is straight and then starts to curve. What does the curve show?", "The spring has gone beyond its limit of proportionality", ["The spring has become a stronger spring with a larger spring constant", "The force has stopped increasing while the extension carries on growing", "The extension has been measured incorrectly at the larger loads"], "Hooke's law only applies up to the limit of proportionality. After that, extension increases faster than the force.", {}),
      ],
      cards: [
        ["Scalar vs vector", "Scalar: size only. Vector: size and direction."],
        ["Speed equation", "v = s ÷ t."],
        ["Acceleration equation", "a = (v − u) ÷ t."],
        ["Uniform acceleration equation", "v² − u² = 2 a s."],
        ["Gradient of a v–t graph", "Acceleration."],
        ["Area under a v–t graph", "Distance travelled."],
        ["Gradient of a d–t graph", "Speed."],
        ["Work done equation", "W = F s (joules)."],
        ["Hooke's law", "F = k e (up to the limit of proportionality)."],
        ["Elastic potential energy", "Eₑ = ½ k e²."],
        ["Extension of a spring", "New length − original length."],
        ["Typical walking speed", "About 1.5 m/s."],
      ],
    }),
    11: yr("p4force", 11, {
      obj: [
        "State and apply Newton's three laws; calculate F = m a and weight W = m g.",
        "Calculate the resultant of forces along a line; describe terminal velocity.",
        "Explain thinking, braking and stopping distances and the factors affecting them.",
        "Calculate momentum p = m v and use conservation of momentum in collisions and explosions.",
        "Triple stretch: moments, levers and gears; pressure in fluids.",
        "Explain how forces and energy link to the motion of vehicles.",
      ],
      note: ["GCSE Physics: Newton's laws, stopping distance and momentum", `## Newton's laws
1. An object stays at rest or moves at **constant velocity** unless a resultant force acts.
2. **F = m a**: resultant force = mass × acceleration.
3. When two objects interact the forces are **equal and opposite and act on different objects**.

## Equations
| Quantity | Equation |
| --- | --- |
| Newton's second law | F = m a |
| Weight | W = m g (g = 9.8 N/kg) |
| Momentum | p = m v |
| Moment | M = F × d (perpendicular distance) |
| Pressure | p = F ÷ A |

## Motion and safety
**Stopping distance = thinking distance + braking distance.** Thinking distance rises with speed, tiredness, alcohol and distractions; braking distance rises with speed, wet or icy roads, worn tyres or brakes and a heavy load. **Doubling speed doubles the thinking distance but quadruples the braking distance** (kinetic energy ∝ v²).

**Terminal velocity:** as an object falls, drag increases until it equals weight. The resultant force is zero, so the speed stays constant.

## Momentum
In a closed system, total momentum before = total momentum after.

## Worked examples
- 1200 kg accelerating at 1.5 m/s²: F = 1200 × 1.5 = **1800 N**.
- A 2.0 kg trolley at 3.0 m/s: p = **6.0 kg m/s**.
- A 60 N force at 0.25 m from a pivot: moment = **15 N m**.

**Working scientifically:** in an acceleration investigation, keep the mass constant and change the force, then keep the force constant and change the mass; plot a graph of acceleration against force.`],
      quiz: "GCSE Physics: Forces quiz (Year 11)",
      qs: [
        S(1, "According to Newton's first law, what happens to an object with no resultant force acting on it?", "It stays at rest or continues at constant velocity", ["It gradually slows down and comes to rest, because nothing is pushing it", "It accelerates constantly", "It moves in a circle at a steady speed"], "With a zero resultant force there is no acceleration: the object keeps its current velocity, which may be zero.", {}),
        S(1, "Which equation gives the weight of an object?", "Weight = mass × gravitational field strength", ["Weight = mass ÷ gravitational field strength", "Weight = mass × velocity", "Weight = mass + gravitational field strength"], "Weight is the force of gravity on a mass: W = m g.", {}),
        S(1, "Which factor increases a driver's thinking distance?", "Being tired", ["Worn brakes", "A wet road", "A heavy load"], "Thinking distance depends on reaction time, which is longer when tired, distracted or affected by alcohol. The others affect braking distance.", {}),
        N(2, "A car of mass 1500 kg accelerates at 2.4 m/s². Calculate the resultant force in newtons.", 3600, 1, "F = m × a = 1500 × 2.4 = 3600 N.", () => 1500 * 2.4, { diag: true }),
        N(2, "Calculate the weight of a 65 kg person. (g = 9.8 N/kg)", 637, 0.5, "Weight = m × g = 65 × 9.8 = 637 N.", () => 65 * 9.8),
        N(2, "A car of mass 1100 kg has a driving force of 900 N and total resistive forces of 350 N. Calculate its acceleration in m/s².", 0.5, 0.005, "Resultant = 900 − 350 = 550 N. a = F ÷ m = 550 ÷ 1100 = 0.50 m/s².", () => (900 - 350) / 1100),
        S(2, "When you push a wall with 50 N, the wall pushes back with 50 N. Why do these forces not cancel out?", "They act on different objects", ["They act in the same direction", "They are different sizes", "The wall exerts no force"], "Newton's third law pairs of forces are equal and opposite but act on different objects, so they cannot cancel each other.", {}),
        N(2, "Calculate the momentum of a 800 kg car moving at 12 m/s in kg m/s.", 9600, 1, "Momentum = mass × velocity = 800 × 12 = 9600 kg m/s.", () => 800 * 12, { diag: true }),
        S(2, "A driver doubles her speed from 15 m/s to 30 m/s. By what factor does the braking distance increase (same road and brakes)?", "4", ["2", "3", "8"], "Braking distance depends on kinetic energy, which is proportional to v². Doubling v gives 2² = 4 times the braking distance.", { chk: () => 2 ** 2 }),
        S(2, "A skydiver reaches terminal velocity. What is true?", "The resultant force is zero because drag equals weight", ["The drag is zero because the air is being pushed out of the way", "The weight has become zero so there is no downward force", "The skydiver is still accelerating downwards at 9.8 m/s²"], "Drag increases with speed until it equals weight. Then the resultant force is zero and the speed stays constant.", {}),
        N(3, "A 1.2 kg trolley moving at 2.0 m/s collides with and sticks to a stationary 0.80 kg trolley. Calculate the velocity of the two trolleys together in m/s.", 1.2, 0.01, "Momentum before = 1.2 × 2.0 = 2.4 kg m/s. After, mass = 2.0 kg: v = 2.4 ÷ 2.0 = 1.2 m/s.", () => (1.2 * 2.0) / (1.2 + 0.8)),
        N(3, "(Triple) A 40 N force acts 0.30 m from a pivot. What force at 0.60 m from the pivot on the other side would balance it, in newtons?", 20, 0.1, "Clockwise moment = anticlockwise moment: 40 × 0.30 = 12 N m. F × 0.60 = 12, so F = 20 N.", () => (40 * 0.3) / 0.6),
        W("Describe and explain the motion of a skydiver from leaving the aeroplane until landing safely with a parachute, in terms of the forces acting. [6 marks]", "Mark scheme (6): at the start weight is the only significant force, so she accelerates downwards (1); as speed increases the drag (air resistance) increases (1); resultant force falls so acceleration decreases (1); she reaches terminal velocity when drag equals weight, resultant zero, so constant velocity (1); when the parachute opens drag suddenly exceeds weight, so she decelerates (1); drag falls as she slows until drag equals weight again at a new, lower terminal velocity for landing (1)."),
      ],
      cards: [
        ["Newton's first law", "No resultant force: constant velocity (or at rest)."],
        ["Newton's second law", "F = m a."],
        ["Newton's third law", "Equal and opposite forces acting on different objects."],
        ["Weight equation", "W = m g (g = 9.8 N/kg on Earth)."],
        ["Stopping distance", "Thinking distance + braking distance."],
        ["Effect of doubling speed", "Thinking distance ×2; braking distance ×4."],
        ["Terminal velocity", "Drag = weight; resultant force zero; constant speed."],
        ["Momentum", "p = m v (kg m/s)."],
        ["Conservation of momentum", "Total momentum before = total after in a closed system."],
        ["Moment equation", "M = F × perpendicular distance."],
        ["Principle of moments", "Clockwise moments = anticlockwise moments when balanced."],
        ["Pressure equation (triple)", "p = F ÷ A."],
      ],
    }),
  },
};
