// KS5 Maths — Mechanics (Year 12 AS, Year 13 A2). Original content aligned to the DfE GCE AS and A-level mathematics subject content.
// g = 9.8 m s⁻² throughout. Answer keys are recomputed by _c_mech.ts — re-run after ANY edit here.
import type { CTopic } from "../types";
import { S, NUM, WR } from "./_h4";

export const TOPIC: CTopic = {
  key: "mech",
  topic: "Mechanics",
  subject: "Maths",
  years: {
    12: {
      year: 12,
      objectives: [
        "Use displacement–time, velocity–time and acceleration–time graphs; the gradient and area under a graph.",
        "Use the constant acceleration (SUVAT) equations, including vertical motion under gravity.",
        "Understand and use Newton's laws of motion: F = ma, weight W = mg and resultant force.",
        "Resolve forces into components and find resultants; solve equilibrium problems.",
        "Solve problems with connected particles (pulleys) using Newton's second law for each particle.",
      ],
      note: {
        title: "Year 12: kinematics, SUVAT and Newton's laws",
        body: `## Key ideas (g = 9.8 m s⁻²)

- **Graphs:** on a velocity–time graph the **gradient** is acceleration and the **area** is displacement. On a displacement–time graph the gradient is velocity.
- **SUVAT** (constant acceleration in a straight line):
  v = u + at, s = ut + ½at², s = ½(u + v)t, v² = u² + 2as.
  Choose the equation that has the three quantities you know and the one you want. Decide which direction is positive.
- **Newton's second law:** the resultant force F = ma. **Weight** W = mg.
- **Resolving:** a force F at angle θ to the horizontal has components F cos θ (horizontal) and F sin θ (vertical). Two perpendicular forces P and Q have resultant √(P² + Q²).
- **Equilibrium:** the resultant force is zero, so forces balance in every direction.
- **Connected particles:** apply F = ma to each particle. A string over a smooth pulley has the same tension on both sides, and both particles have the same acceleration.

## Worked example 1: SUVAT

A cyclist speeds up uniformly from 5 m s⁻¹ to 17 m s⁻¹ in 6 s.
a = (17 − 5)/6 = **2 m s⁻²**, and s = ½(5 + 17) × 6 = **66 m**.

## Worked example 2: Newton's second law

A car of mass 900 kg has a driving force of 2700 N and resistance of 900 N.
Resultant = 2700 − 900 = 1800 N, so a = 1800/900 = **2 m s⁻²**.

## Method

Draw a diagram, mark every force, choose a positive direction, then write one equation for each particle or direction.`,
      },
      quiz: {
        title: "Mechanics: Year 12 quiz",
        questions: [
          NUM("mech-y12-01", 1, "A car starts from rest and accelerates uniformly at 3 m s⁻² for 8 s. Find the distance travelled in metres.", 96, 0, "Use s = ut + ½at² with u = 0: s = ½ × 3 × 8² = 96 m."),
          NUM("mech-y12-02", 1, "A resultant force of 30 N acts on an object of mass 12 kg. Find its acceleration in m s⁻².", 2.5, 0, "F = ma, so a = 30/12 = 2.5 m s⁻²."),
          S("mech-y12-03", 1, "Taking g = 9.8 m s⁻², what is the weight of a 5 kg mass?", ["5 N", "0.51 N", "49 N", "4.9 N"], "49 N", "Weight = mass × g = 5 × 9.8 = 49 N."),
          NUM("mech-y12-04", 2, "A particle moving at 20 m s⁻¹ decelerates uniformly at 4 m s⁻² until it stops. Find the distance it travels in metres.", 50, 0, "Use v² = u² + 2as with v = 0 and a = −4: 0 = 400 − 8s, so s = 50 m.", { diagnostic: true }),
          NUM("mech-y12-05", 2, "A ball is thrown vertically upwards at 14 m s⁻¹. Taking g = 9.8 m s⁻² and ignoring air resistance, find the greatest height above the point of projection in metres.", 10, 0, "At the top v = 0. Then 0 = 14² − 2 × 9.8 × s, so s = 196/19.6 = 10 m."),
          NUM("mech-y12-06", 2, "The graph shows the velocity of a train over 20 seconds. Find the total distance travelled in metres.", 180, 0, "Distance is the area under the graph: ½ × 4 × 12 + 10 × 12 + ½ × 6 × 12 = 24 + 120 + 36 = 180 m.", { diagnostic: true, image: { file: "mech-y12-vt.png", alt: "A velocity–time graph. Velocity rises in a straight line from 0 at time 0 to 12 m per second at 4 seconds, stays at 12 until 14 seconds, then falls in a straight line to 0 at 20 seconds." } }),
          NUM("mech-y12-07", 2, "Two particles of mass 5 kg and 3 kg are joined by a light string over a smooth pulley and released from rest. Take g = 9.8 m s⁻². Find the acceleration in m s⁻², to 2 decimal places.", 2.45, 0.005, "The system is driven by the difference in weights: (5 − 3)g = (5 + 3)a, so a = 2 × 9.8/8 = 2.45."),
          S("mech-y12-08", 2, "Two forces of 6 N and 8 N act on a particle at right angles to each other. What is the magnitude of their resultant?", ["14 N", "2 N", "10 N", "48 N"], "10 N", "Use Pythagoras: √(6² + 8²) = √100 = 10 N."),
          NUM("mech-y12-09", 2, "A block of mass 5 kg on a smooth horizontal surface is pulled by a force of 40 N acting at 30° above the horizontal, as shown. Find its acceleration in m s⁻², to 2 decimal places.", 6.93, 0.005, "Only the horizontal component accelerates the block: 40 cos 30° = 34.64 N. Then a = 34.64/5 ≈ 6.93.", { image: { file: "mech-y12-force.png", alt: "A block on a horizontal surface with an arrow pointing up and to the right from the block, labelled 40 N, making an angle of 30 degrees with the horizontal. The block is labelled 5 kg." } }),
          S("mech-y12-10", 2, "A person of mass 60 kg stands in a lift that accelerates upwards at 1.5 m s⁻². Taking g = 9.8 m s⁻², what is the normal reaction from the floor?", ["588 N", "678 N", "498 N", "900 N"], "678 N", "Resultant upwards: R − 60 × 9.8 = 60 × 1.5, so R = 588 + 90 = 678 N."),
          NUM("mech-y12-11", 3, "For the pulley system in the diagram (5 kg and 3 kg masses, smooth pulley, light string), find the tension in the string in newtons, to 2 decimal places. Take g = 9.8 m s⁻².", 36.75, 0.005, "From the 3 kg mass: T − 3g = 3a with a = 2.45, so T = 29.4 + 7.35 = 36.75 N. (Check with the 5 kg mass: 49 − T = 5a gives the same.)", { image: { file: "mech-y12-pulley.png", alt: "A diagram of a smooth pulley fixed at the top with a light string passing over it. A block labelled 5 kg hangs on the left side and a block labelled 3 kg hangs on the right side." } }),
          NUM("mech-y12-12", 3, "A train starts from rest and accelerates uniformly at 0.5 m s⁻² for 40 s. It then travels at constant speed for 2 minutes, before decelerating uniformly at 1 m s⁻² to rest. Find the total distance travelled in metres. Type your answer as digits with no comma.", 3000, 0, "Speed after 40 s is 20 m s⁻¹. Distances: ½ × 20 × 40 = 400 m, then 20 × 120 = 2400 m, then 20²/(2 × 1) = 200 m. Total 3000 m."),
          WR("mech-y12-13", 3, "A particle moves in a straight line with constant acceleration a. Its velocity increases from u to v in time t. By considering the area under its velocity–time graph, show that s = ut + ½at².", 3, "Mark scheme (3 marks): (1) The graph is a straight line from (0, u) to (t, v) with v = u + at. (2) The area is a rectangle u × t plus a triangle ½ × t × (v − u). (3) Substitute v − u = at: s = ut + ½ × t × at = ut + ½at²."),
        ],
      },
      flashcards: [
        { front: "Gradient of a velocity–time graph", back: "Acceleration" },
        { front: "Area under a velocity–time graph", back: "Displacement (distance, if velocity does not change sign)" },
        { front: "The four SUVAT equations", back: "v = u + at; s = ut + ½at²; s = ½(u + v)t; v² = u² + 2as" },
        { front: "Newton's second law", back: "Resultant force F = ma" },
        { front: "Weight of a mass m", back: "W = mg (g = 9.8 m s⁻²)" },
        { front: "Components of force F at angle θ to the horizontal", back: "Horizontal F cos θ, vertical F sin θ" },
        { front: "Resultant of perpendicular forces P and Q", back: "√(P² + Q²)" },
        { front: "Particle in equilibrium", back: "Resultant force is zero in every direction" },
        { front: "String over a smooth pulley: tension and acceleration", back: "Same tension both sides; both particles have the same acceleration magnitude" },
        { front: "Vertical motion at the highest point", back: "Velocity is zero (v = 0), acceleration is still g downwards" },
      ],
    },
    13: {
      year: 13,
      objectives: [
        "Take moments about a point; solve problems on beams and rods in equilibrium, including tilting.",
        "Model projectile motion: resolve into horizontal and vertical components and use SUVAT in each; find range, time of flight and greatest height.",
        "Use the friction model F ≤ μR, including limiting equilibrium and rough inclined planes.",
        "Use calculus for variable acceleration: v = dr/dt, a = dv/dt, and integrate to find velocity and displacement.",
        "Use vectors (i and j) to describe position, velocity and acceleration.",
      ],
      note: {
        title: "Year 13: moments, projectiles, friction and calculus in mechanics",
        body: `## Key ideas (g = 9.8 m s⁻²)

- **Moment** = force × perpendicular distance from the pivot. For equilibrium the resultant force is zero and the **clockwise moments equal the anticlockwise moments** about any point. A uniform beam's weight acts at its centre. A beam is on the point of tilting when the reaction at one support is zero.
- **Projectiles:** horizontally, constant velocity u cos θ. Vertically, acceleration −g with initial speed u sin θ. Time of flight from and to the same level: 2u sin θ/g. Greatest height: (u sin θ)²/(2g). Range: u² sin 2θ/g.
- **Friction:** F ≤ μR. In **limiting equilibrium** F = μR. On a slope, R = mg cos α.
- **Calculus:** v = dr/dt and a = dv/dt. Integrate to reverse: v = ∫a dt and r = ∫v dt (find the constant from given values).
- **Vectors:** if r = x i + y j then v = (dx/dt) i + (dy/dt) j, and speed = √(vₓ² + v_y²).

## Worked example 1: friction

A 10 kg block rests on rough horizontal ground with μ = 0.25 and is pulled by a horizontal force of 30 N.
R = 10 × 9.8 = 98 N, so the maximum friction is 0.25 × 98 = 24.5 N.
30 > 24.5, so it moves: a = (30 − 24.5)/10 = **0.55 m s⁻²**.

## Worked example 2: a projectile

A ball is kicked at 12 m s⁻¹ at 50° above the horizontal from ground level.
Vertical speed: 12 sin 50° ≈ 9.19 m s⁻¹, so the time of flight is 2 × 9.19/9.8 ≈ **1.88 s**.
Horizontal distance: 12 cos 50° × 1.88 ≈ **14.5 m**.

## Reminder

In every problem, split the motion into perpendicular directions and use the same time t in each.`,
      },
      quiz: {
        title: "Mechanics: Year 13 quiz",
        questions: [
          NUM("mech-y13-01", 1, "A force of 25 N acts perpendicular to a spanner at a distance of 0.8 m from the nut. Find the moment about the nut in N m.", 20, 0, "Moment = force × perpendicular distance = 25 × 0.8 = 20 N m."),
          NUM("mech-y13-02", 1, "A ball is projected at 20 m s⁻¹ at 60° above the horizontal. Find the initial vertical component of its velocity in m s⁻¹, to 2 decimal places.", 17.32, 0.005, "The vertical component is 20 sin 60° = 20 × 0.8660 ≈ 17.32."),
          NUM("mech-y13-03", 1, "A block of mass 5 kg rests on rough horizontal ground with coefficient of friction 0.4. Taking g = 9.8 m s⁻², find the maximum (limiting) friction force in newtons.", 19.6, 0, "R = 5 × 9.8 = 49 N, so F max = μR = 0.4 × 49 = 19.6 N."),
          NUM("mech-y13-04", 2, "A uniform beam AB of length 6 m and weight 100 N rests horizontally on supports at A and B. A load of 40 N is placed 2 m from A, as shown. Find the reaction at B in newtons, to 1 decimal place.", 63.3, 0.05, "Take moments about A: R_B × 6 = 100 × 3 + 40 × 2 = 380, so R_B = 380/6 ≈ 63.3 N.", { diagnostic: true, image: { file: "mech-y13-beam.png", alt: "A horizontal beam AB of length 6 metres resting on a support at each end. A downward arrow at the centre of the beam is labelled 100 N. A second downward arrow 2 metres from A is labelled 40 N. The reactions at A and B are drawn as upward arrows." } }),
          NUM("mech-y13-05", 2, "A ball is kicked from level ground at 20 m s⁻¹ at 30° above the horizontal. Taking g = 9.8 m s⁻², find its horizontal range in metres, to 2 decimal places.", 35.35, 0.005, "Range = u² sin 2θ / g = 400 × sin 60° / 9.8 ≈ 35.35 m.", { diagnostic: true }),
          S("mech-y13-06", 2, "For the same kick (20 m s⁻¹ at 30° above the horizontal, g = 9.8 m s⁻²), what is the greatest height reached, in metres?", ["10.20", "2.55", "5.10", "20.41"], "5.10", "The vertical speed is 20 sin 30° = 10 m s⁻¹, so the greatest height is 10²/(2 × 9.8) ≈ 5.10 m."),
          S("mech-y13-07", 2, "A block is on the point of sliding down a rough plane inclined at 25° to the horizontal. What is the coefficient of friction μ?", ["0.466", "0.906", "0.423", "2.145"], "0.466", "In limiting equilibrium, μR = mg sin 25° with R = mg cos 25°. So μ = tan 25° ≈ 0.466.", { image: { file: "mech-y13-incline.png", alt: "A rough plane inclined at 25 degrees to the horizontal with a block resting on it. Arrows show the weight straight down, the normal reaction perpendicular to the plane and the friction force up the slope." } }),
          NUM("mech-y13-08", 2, "A particle moves in a straight line with velocity v = 3t² − 4t m s⁻¹. Find its acceleration at t = 2 s, in m s⁻².", 8, 0, "a = dv/dt = 6t − 4, and at t = 2 this is 8."),
          NUM("mech-y13-09", 2, "The velocity of a particle is v = 3t² − 4t m s⁻¹. Find its displacement from the starting point when t = 3 s, in metres.", 9, 0, "s = ∫ v dt = t³ − 2t² (with s = 0 at t = 0). At t = 3: 27 − 18 = 9 m."),
          NUM("mech-y13-10", 2, "A particle has position vector r = 2t² i + (3t − 1) j metres at time t seconds. Find its speed at t = 2 s, in m s⁻¹, to 3 decimal places.", 8.544, 0.0005, "v = dr/dt = 4t i + 3 j, which at t = 2 is 8i + 3j. The speed is √(64 + 9) = √73 ≈ 8.544."),
          NUM("mech-y13-11", 3, "A 4 kg block lies on a rough horizontal table with coefficient of friction 0.3. It is joined by a light string over a smooth pulley at the table edge to a 2 kg mass hanging freely. The system is released. Taking g = 9.8 m s⁻², find the acceleration in m s⁻², to 2 decimal places.", 1.31, 0.005, "Friction on the 4 kg block is 0.3 × 4 × 9.8 = 11.76 N. For the whole system: 2g − 11.76 = (4 + 2)a, so a = (19.6 − 11.76)/6 ≈ 1.31."),
          NUM("mech-y13-12", 3, "A uniform plank AB of length 8 m and mass 20 kg rests horizontally on two supports, one 1 m from A and the other 1 m from B. A man of mass 80 kg walks along the plank from A towards B. Find the greatest distance from A at which he can stand without the plank tilting, in metres.", 7.75, 0, "The plank is about to tip about the support at 7 m from A. Moments about it: 80g(x − 7) = 20g × (7 − 4) = 60g, so x − 7 = 0.75 and x = 7.75 m."),
          NUM("mech-y13-13", 3, "A stone is thrown horizontally at 12 m s⁻¹ from the top of a vertical cliff of height 45 m, as shown. Taking g = 9.8 m s⁻² and ignoring air resistance, find the horizontal distance from the foot of the cliff to where it lands, in metres, to 1 decimal place.", 36.4, 0.05, "Vertically 45 = ½ × 9.8 × t², so t = √(90/9.8) ≈ 3.03 s. Horizontally 12 × 3.03 ≈ 36.4 m.", { image: { file: "mech-y13-cliff.png", alt: "A cliff on the left with a stone thrown horizontally from its top edge, following a curved path downwards to level ground on the right. The cliff height is marked 45 m and the launch velocity arrow is labelled 12 metres per second." } }),
          WR("mech-y13-14", 3, "A projectile is launched from level ground with speed u at an angle θ above the horizontal. Show that its range is R = u² sin 2θ / g.", 4, "Mark scheme (4 marks): (1) Vertical motion: 0 = u sin θ × t − ½gt², so the time of flight is t = 2u sin θ / g. (2) Horizontal velocity is constant: u cos θ. (3) R = u cos θ × 2u sin θ / g = 2u² sin θ cos θ / g. (4) Using 2 sin θ cos θ = sin 2θ gives R = u² sin 2θ / g."),
        ],
      },
      flashcards: [
        { front: "Moment of a force about a point", back: "Force × perpendicular distance from the point" },
        { front: "Condition for equilibrium of a beam", back: "Resultant force zero and total clockwise moment = total anticlockwise moment" },
        { front: "A beam is about to tilt about a support when…", back: "The reaction at the other support becomes zero" },
        { front: "Projectile: horizontal motion", back: "Constant velocity u cos θ (no acceleration)" },
        { front: "Projectile: vertical motion", back: "Initial speed u sin θ, acceleration g downwards" },
        { front: "Time of flight and range from and to ground level", back: "2u sin θ / g and u² sin 2θ / g" },
        { front: "Friction model", back: "F ≤ μR, with F = μR in limiting equilibrium" },
        { front: "Normal reaction on a slope at angle α", back: "R = mg cos α (no other perpendicular forces)" },
        { front: "Velocity and acceleration from position", back: "v = dr/dt and a = dv/dt" },
        { front: "Displacement from velocity", back: "Integrate v with respect to t; use given values to find the constant" },
      ],
    },
  },
};
