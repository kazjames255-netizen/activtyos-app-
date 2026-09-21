// A-level Physics — Circular Motion & Oscillations (Year 13). Original content aligned to the DfE GCE AS/A-level physics subject content.
// Keys are recomputed by _chk_p5circ.ts — re-run _check_s7.ts after ANY edit here.
import type { CTopic } from "../types";
import { img, qb } from "./_h";

const q = qb("p5circ", 13);
export const TOPIC: CTopic = {
  key: "p5circ",
  topic: "Physics — Circular Motion & Oscillations",
  subject: "Science",
  years: {
    13: {
      year: 13,
      subtopic: "A-level Year 13 (A2)",
      objectives: [
        "Radian measure, angular speed ω = 2π/T = v/r, and uniform circular motion.",
        "Centripetal acceleration a = v²/r = ω²r and centripetal force F = mv²/r = mω²r.",
        "Simple harmonic motion: a = −ω²x, x = A cos ωt, v = ±ω√(A² − x²); graphs of x, v and a against time.",
        "Periods of a mass–spring system T = 2π√(m/k) and a simple pendulum T = 2π√(l/g); energy exchange in SHM.",
        "Free and forced oscillations, damping and resonance.",
      ],
      note: {
        title: "Circular motion and simple harmonic motion",
        body: `## Key ideas

An object in **uniform circular motion** has constant speed but changing velocity, so it accelerates towards the centre. Its **angular speed** is ω = 2π ÷ T = v ÷ r, and the resultant force must be a **centripetal force** F = mv² ÷ r = mω²r directed to the centre.

In **simple harmonic motion** (SHM) the acceleration is proportional to the displacement and directed towards equilibrium: **a = −ω²x**. The displacement is x = A cos ωt, the maximum speed ωA occurs at equilibrium, and the maximum acceleration ω²A at the ends. The total energy ½mω²A² is constant, exchanging between kinetic and potential. Damping removes energy; **resonance** is a large amplitude when the driving frequency equals the natural frequency.

| Idea | Formula |
| --- | --- |
| Angular speed | ω = 2π ÷ T = 2πf |
| Centripetal force | F = mv² ÷ r = mω²r |
| SHM | a = −ω²x, x = A cos ωt |
| Speed | v = ±ω√(A² − x²), vmax = ωA |
| Mass on a spring | T = 2π√(m ÷ k) |
| Simple pendulum | T = 2π√(l ÷ g) |
| Energy | E = ½mω²A² |

## Worked example 1

A 0.50 kg ball moves in a circle of radius 1.2 m at 3.0 m s⁻¹. F = mv² ÷ r = 0.50 × 9.0 ÷ 1.2 = **3.75 N**.

## Worked example 2

A 0.40 kg mass hangs on a spring of stiffness 25 N m⁻¹. T = 2π√(0.40 ÷ 25) = **0.79 s**, so f = 1.3 Hz.

## Worked example 3

For T = 0.50 s, ω = 2π ÷ 0.50 = **12.6 rad s⁻¹**.`,
      },
      quiz: {
        title: "Circular Motion & Oscillations: Year 13 quiz",
        questions: [
          q.single(1, "The diagram shows an object moving anticlockwise at constant speed in a circle. Which arrow shows the direction of its acceleration?", "B", ["A", "C", "D"], "In uniform circular motion the acceleration (and the resultant force) is always directed towards the centre of the circle, arrow B.", { image: img("p5circ-y13-arrows.png", "A circle with its centre marked, and a dot on the circumference at the upper right. Four arrows start from the dot: A points along the tangent in the direction of travel (anticlockwise), B points straight towards the centre, C points directly away from the centre, and D points along the tangent opposite to the direction of travel.") }),
          q.num(1, "A turntable rotates at 45 revolutions per minute. Calculate its angular speed, in rad s⁻¹, to 3 significant figures.", 4.71, 0.01, "45 rev min⁻¹ = 0.75 rev s⁻¹ = 0.75 × 2π rad s⁻¹ = 4.71 rad s⁻¹."),
          q.num(2, "A car of mass 1200 kg travels round a bend of radius 40 m at 15 m s⁻¹. Calculate the centripetal force needed, in N.", 6750, 5, "F = mv² ÷ r = 1200 × 15² ÷ 40 = 1200 × 225 ÷ 40 = 6750 N.", { diag: true }),
          q.num(2, "A satellite orbits the Earth in a circle of radius 7.0 × 10⁶ m with a period of 5900 s. Calculate its orbital speed, in km s⁻¹, to 3 significant figures.", 7.45, 0.01, "v = 2πr ÷ T = 2π × 7.0 × 10⁶ ÷ 5900 = 7.45 × 10³ m s⁻¹ = 7.45 km s⁻¹."),
          q.num(2, "A 0.25 kg mass oscillates on a spring of stiffness 40 N m⁻¹. Calculate the period of the oscillations, in s, to 3 significant figures.", 0.497, 0.002, "T = 2π√(m ÷ k) = 2π√(0.25 ÷ 40) = 2π × 0.0791 = 0.497 s.", { diag: true }),
          q.num(2, "A simple pendulum has length 1.50 m. Calculate its period for small oscillations, in s, to 3 significant figures. (g = 9.81 m s⁻²)", 2.46, 0.01, "T = 2π√(l ÷ g) = 2π√(1.50 ÷ 9.81) = 2π × 0.391 = 2.46 s."),
          q.num(3, "The graph shows the displacement of an oscillating trolley against time. Use it to calculate the maximum speed of the trolley, in m s⁻¹, to 3 significant figures.", 0.157, 0.003, "From the graph A = 6.0 cm = 0.060 m and T = 2.4 s. ω = 2π ÷ T = 2.618 rad s⁻¹. vmax = ωA = 2.618 × 0.060 = 0.157 m s⁻¹.", { image: img("p5circ-y13-shm.png", "A graph of displacement in centimetres against time in seconds for an oscillating trolley. The curve is a smooth cosine wave starting at its maximum positive displacement at time zero, crossing zero, reaching a minimum, and returning to the starting value after one full period. The vertical axis runs from minus 8 to plus 8 centimetres.") }),
          q.num(2, "A mass performs SHM with amplitude 0.080 m and angular frequency 5.0 rad s⁻¹. Calculate its speed when its displacement is 0.050 m, in m s⁻¹, to 3 significant figures.", 0.312, 0.002, "v = ω√(A² − x²) = 5.0 × √(0.080² − 0.050²) = 5.0 × √0.0039 = 5.0 × 0.0624 = 0.312 m s⁻¹."),
          q.num(3, "A 0.30 kg mass performs SHM with amplitude 0.040 m at a frequency of 2.5 Hz. Calculate the maximum resultant force on the mass, in N, to 3 significant figures.", 2.96, 0.02, "ω = 2πf = 15.71 rad s⁻¹. amax = ω²A = 246.7 × 0.040 = 9.87 m s⁻². F = ma = 0.30 × 9.87 = 2.96 N."),
          q.single(2, "For an undamped mass–spring oscillator, which statement about energy is correct?", "The total energy stays constant; the kinetic energy is greatest at the equilibrium position", ["The total energy is greatest at the equilibrium position, where the speed is highest, and least at the extremes", "The kinetic energy is greatest at maximum displacement, because the restoring force is largest there", "The potential energy is greatest at the equilibrium position"], "Energy is exchanged between kinetic and potential forms but the sum is constant. At the equilibrium position the speed is a maximum so KE is a maximum and elastic PE is zero."),
          q.num(3, "A 0.50 kg mass performs SHM with amplitude 0.10 m and angular frequency 6.0 rad s⁻¹. Calculate its kinetic energy when the displacement is 0.060 m, in J, to 3 significant figures.", 0.0576, 0.0003, "KE = ½mω²(A² − x²) = ½ × 0.50 × 36 × (0.010 − 0.0036) = 9.0 × 0.0064 = 0.0576 J."),
          q.multi(2, "Which TWO statements describe simple harmonic motion?", ["The acceleration is proportional to the displacement and directed towards the equilibrium position", "The period does not depend on the amplitude"], ["The resultant force has constant magnitude", "The speed is greatest at maximum displacement"], "SHM requires a restoring force proportional to displacement (a = −ω²x). Then T = 2π ÷ ω is independent of amplitude, and the speed is greatest at equilibrium, not at the ends."),
          q.single(2, "A wine glass shatters when a note of a particular pitch is played near it. This is an example of:", "resonance: the driving frequency equals the natural frequency of the glass", ["damping: the sound waves remove energy from the glass", "diffraction of the sound waves around the glass", "a stationary wave with no amplitude at the glass"], "When the driving frequency matches the natural frequency, energy is transferred most efficiently and the amplitude of oscillation becomes very large."),
          q.written(3, "A mass m hangs on a light spring of stiffness k and is displaced vertically and released. Show that the motion is simple harmonic and derive an expression for the period T. [6 marks]", "For a horizontal/vertical spring the resultant force is F = −kx (Hooke's law: the restoring force is proportional to displacement x from equilibrium and opposite in direction). By Newton's second law ma = −kx so a = −(k/m)x. SHM is defined by a = −ω²x, so the motion is SHM with ω² = k/m. Then T = 2π/ω = 2π√(m/k). (For a vertical spring the weight only shifts the equilibrium position.)", "Mark scheme (max 6): resultant force is proportional to displacement and acts towards equilibrium, F = −kx (for a vertical spring, weight is balanced at equilibrium so only the extension beyond that gives F); Newton's second law F = ma; ma = −kx so a = −(k ÷ m)x; a ∝ −x is the definition of SHM (a = −ω²x); ω² = k ÷ m, so ω = √(k ÷ m); T = 2π ÷ ω = 2π√(m ÷ k)."),
        ],
      },
      flashcards: [
        { front: "Angular speed", back: "ω = θ ÷ t = 2π ÷ T = 2πf = v ÷ r (rad s⁻¹)." },
        { front: "Centripetal acceleration and force", back: "a = v² ÷ r = ω²r; F = mv² ÷ r = mω²r; both directed to the centre." },
        { front: "Is a body in uniform circular motion accelerating?", back: "Yes: its speed is constant but its velocity direction changes, so acceleration is towards the centre." },
        { front: "Condition for SHM", back: "a = −ω²x: acceleration proportional to displacement and directed towards equilibrium." },
        { front: "SHM displacement and speed", back: "x = A cos ωt; v = ±ω√(A² − x²); vmax = ωA at equilibrium." },
        { front: "Maximum acceleration in SHM", back: "amax = ω²A, at maximum displacement." },
        { front: "Period of a mass on a spring", back: "T = 2π√(m ÷ k)." },
        { front: "Period of a simple pendulum", back: "T = 2π√(l ÷ g) for small angles." },
        { front: "Energy in SHM", back: "Total E = ½mω²A²; KE ↔ PE exchange; KE max at equilibrium, PE max at the ends." },
        { front: "Resonance", back: "Driving frequency = natural frequency: large amplitude. Light damping gives a sharper, taller peak." },
        { front: "Damping types", back: "Light: amplitude decays gradually. Critical: returns fastest with no overshoot. Heavy: slow return." },
      ],
    },
  },
};
