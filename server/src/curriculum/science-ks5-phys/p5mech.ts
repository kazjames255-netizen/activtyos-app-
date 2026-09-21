// A-level Physics — Mechanics & Materials (Year 12). Original content aligned to the DfE GCE AS/A-level physics subject content.
// Keys are recomputed by _chk_p5mech.ts — re-run _check_s7.ts after ANY edit here.
import type { CTopic } from "../types";
import { img, qb } from "./_h";

const q = qb("p5mech", 12);
export const TOPIC: CTopic = {
  key: "p5mech",
  topic: "Physics — Mechanics & Materials",
  subject: "Science",
  years: {
    12: {
      year: 12,
      subtopic: "A-level Year 12 (AS)",
      objectives: [
        "Scalars and vectors; resolving vectors; equilibrium of forces and moments.",
        "Kinematics: displacement–time and velocity–time graphs and the equations of uniform acceleration; free fall and projectile motion.",
        "Newton's laws of motion; weight, friction, drag and terminal velocity.",
        "Work, energy and power; conservation of energy; efficiency.",
        "Momentum, impulse and conservation of momentum in collisions and explosions.",
        "Hooke's law, stress, strain and the Young modulus; elastic strain energy.",
      ],
      note: {
        title: "Kinematics, forces, energy, momentum and the Young modulus",
        body: `## Key ideas

**Vectors** have size and direction (displacement, velocity, force); **scalars** have size only (speed, mass, energy). On a **velocity–time graph** the gradient is acceleration and the area is displacement. Newton's second law: **resultant force F = ma** (equivalently the rate of change of momentum). **Momentum** p = mv is conserved in any collision when no external force acts. **Kinetic energy** is conserved only in elastic collisions.

Materials: **stress** σ = F ÷ A and **strain** ε = ΔL ÷ L. The **Young modulus** E = σ ÷ ε is the gradient of the linear part of a stress–strain graph. **Elastic energy** = ½FΔL = area under a force–extension graph.

| Idea | Formula |
| --- | --- |
| Uniform acceleration | v = u + at, s = ut + ½at², v² = u² + 2as |
| Momentum, impulse | p = mv, FΔt = Δp |
| Work, power | W = Fs cosθ, P = W ÷ t = Fv |
| Energy | KE = ½mv², ΔGPE = mgΔh |
| Young modulus | E = (F ÷ A) ÷ (ΔL ÷ L) |
| Moments | clockwise moments = anticlockwise moments |

Use g = 9.81 m s⁻².

## Worked example 1

A car brakes from 25 m s⁻¹ to rest over 50 m. From v² = u² + 2as: 0 = 625 + 2a(50), so a = **−6.25 m s⁻²**.

## Worked example 2

A 2.0 kg trolley moving at 3.0 m s⁻¹ collides with a stationary 1.0 kg trolley and they stick together. Momentum: 6.0 = 3.0v, so v = **2.0 m s⁻¹**.

## Worked example 3

A steel wire of length 2.0 m and area 1.0 × 10⁻⁶ m² extends by 1.0 mm under 100 N. Stress = 1.0 × 10⁸ Pa, strain = 5.0 × 10⁻⁴, so E = **2.0 × 10¹¹ Pa**.`,
      },
      quiz: {
        title: "Mechanics & Materials: Year 12 quiz",
        questions: [
          q.single(1, "Which of these quantities is a vector?", "velocity", ["speed", "mass", "kinetic energy"], "Velocity has direction as well as magnitude. Speed, mass and energy have magnitude only."),
          q.num(1, "A resultant force acts on a car of mass 1200 kg and gives it an acceleration of 2.5 m s⁻². Calculate the resultant force, in N.", 3000, 1, "F = ma = 1200 × 2.5 = 3000 N."),
          q.num(2, "A cyclist moving at 12 m s⁻¹ accelerates uniformly at 1.5 m s⁻² for 8.0 s. Calculate the distance travelled in this time, in m.", 144, 1, "s = ut + ½at² = 12 × 8.0 + ½ × 1.5 × 8.0² = 96 + 48 = 144 m.", { diag: true }),
          q.num(2, "A car accelerates uniformly from rest at 3.2 m s⁻² over a distance of 45 m. Calculate its final speed, in m s⁻¹, to 3 significant figures.", 17, 0.05, "v² = u² + 2as = 0 + 2 × 3.2 × 45 = 288, so v = √288 = 17.0 m s⁻¹."),
          q.num(2, "A ball is kicked horizontally at 12 m s⁻¹ from the edge of a cliff 20 m high. Ignoring air resistance, calculate the horizontal distance from the cliff at which it lands, in m, to 3 significant figures. (g = 9.81 m s⁻²)", 24.2, 0.1, "Vertical motion from rest: 20 = ½ × 9.81 × t², so t = 2.02 s. Horizontal speed stays 12 m s⁻¹, so distance = 12 × 2.02 = 24.2 m.", { diag: true }),
          q.num(2, "The graph shows the velocity of a train against time as it moves between two stations. Calculate the distance between the stations, in m.", 117, 2, "Distance = area under the graph = ½ × 6 × 9 + 8 × 9 + ½ × 4 × 9 = 27 + 72 + 18 = 117 m.", { image: img("p5mech-y12-vt.png", "A velocity against time graph for a train. Velocity rises in a straight line from 0 to 9 metres per second between 0 and 6 seconds, stays constant at 9 metres per second until 14 seconds, then falls in a straight line to 0 at 18 seconds.") }),
          q.num(2, "A 2.0 kg trolley moving at 6.0 m s⁻¹ collides with a stationary 4.0 kg trolley and the two stick together. Calculate their common speed after the collision, in m s⁻¹.", 2, 0.05, "Momentum is conserved: 2.0 × 6.0 = (2.0 + 4.0) v, so v = 12 ÷ 6.0 = 2.0 m s⁻¹."),
          q.num(2, "A crane lifts a 240 kg load through a vertical height of 15 m in 20 s at constant speed. Calculate the useful power output of the crane, in W, to 3 significant figures. (g = 9.81 m s⁻²)", 1770, 5, "Work done = mgh = 240 × 9.81 × 15 = 35 316 J. Power = work ÷ time = 35 316 ÷ 20 = 1770 W."),
          q.num(2, "A copper wire of length 1.8 m and cross-sectional area 6.0 × 10⁻⁷ m² is stretched by a force of 60 N and extends by 1.5 mm. Calculate the Young modulus of copper, in units of 10¹¹ Pa, to 2 significant figures.", 1.2, 0.05, "Stress = 60 ÷ 6.0 × 10⁻⁷ = 1.0 × 10⁸ Pa. Strain = 1.5 × 10⁻³ ÷ 1.8 = 8.33 × 10⁻⁴. E = stress ÷ strain = 1.2 × 10¹¹ Pa."),
          q.num(3, "A 6.0 kg block slides down a rough slope inclined at 25° to the horizontal. A frictional force of 10 N acts up the slope. Calculate the resultant force on the block down the slope, in N, to 3 significant figures. (g = 9.81 m s⁻²)", 14.9, 0.1, "Component of weight down the slope = mg sin25° = 6.0 × 9.81 × 0.4226 = 24.9 N. Resultant = 24.9 − 10 = 14.9 N.", { image: img("p5mech-y12-incline.png", "A block on a slope that rises to the right at an angle of 25 degrees to the horizontal. Arrows show the weight of the block acting vertically downwards, the normal reaction perpendicular to the slope, and a friction force of 10 newtons acting up the slope. The block has mass 6.0 kilograms.") }),
          q.num(3, "A 1.5 kg trolley moving at 8.0 m s⁻¹ collides with a stationary 2.5 kg trolley and they stick together. Calculate the kinetic energy lost in the collision, in J.", 30, 0.5, "Common speed: v = 1.5 × 8.0 ÷ 4.0 = 3.0 m s⁻¹. KE before = ½ × 1.5 × 8.0² = 48 J. KE after = ½ × 4.0 × 3.0² = 18 J. Lost = 30 J."),
          q.num(3, "A 0.45 kg ball hits a wall at 6.0 m s⁻¹ and rebounds along the same line at 4.0 m s⁻¹. The contact lasts 0.030 s. Calculate the average force on the ball, in N.", 150, 1, "Take rebound as the positive direction: Δp = 0.45 × (4.0 − (−6.0)) = 4.5 N s. F = Δp ÷ Δt = 4.5 ÷ 0.030 = 150 N."),
          q.num(2, "A uniform metre rule balances at its 50 cm mark. A 0.20 N weight hangs from the 10 cm mark. At which mark, in cm, must a 0.50 N weight hang to keep the rule balanced?", 66, 0.5, "Moments about the pivot: 0.20 × 40 = 0.50 × x, so x = 16 cm from the pivot, on the far side. That is the 50 + 16 = 66 cm mark."),
          q.written(3, "Describe how you would determine the Young modulus of a metal wire in the laboratory. Include the measurements you would take, how you would minimise uncertainties, and how you would use your results to find the Young modulus. [6 marks]", "Clamp a long thin wire (about 2 m) horizontally over a pulley with a hanging masses holder; measure the original length L with a metre rule and the diameter with a micrometer at several places to find A = πd²/4; add masses in equal steps, measuring the extension with a marker and scale (or vernier) each time, then unload to check for elastic behaviour; F = mg; plot force against extension in the linear region; gradient = F/ΔL, so E = gradient × L/A. Use a long wire and thin diameter to increase extension; avoid the wire kinking; wear goggles.", "Mark scheme (max 6): measure the original length with a metre rule (and use a long wire to give a larger extension); measure the diameter with a micrometer at several places and average to find the area A = πd² ÷ 4; add known weights in steps (F = mg) and measure the extension each time; check for elastic behaviour by unloading; plot force against extension (or stress against strain) and find the gradient of the straight-line region; E = gradient × L ÷ A (or the gradient of the stress–strain graph); safety: goggles or a sandbox to catch the falling masses."),
        ],
      },
      flashcards: [
        { front: "Vector vs scalar", back: "Vector = magnitude + direction (velocity, force). Scalar = magnitude only (speed, energy)." },
        { front: "Meaning of a v–t graph: gradient and area", back: "Gradient = acceleration; area under the graph = displacement." },
        { front: "The three uniform acceleration equations", back: "v = u + at; s = ut + ½at²; v² = u² + 2as." },
        { front: "Projectile motion (no air resistance)", back: "Horizontal velocity constant; vertical acceleration g downwards. Treat the two directions independently." },
        { front: "Newton's second law", back: "Resultant force = rate of change of momentum: F = ma for constant mass." },
        { front: "Impulse", back: "FΔt = Δp = area under a force–time graph." },
        { front: "Conservation of momentum", back: "Total momentum before = after, provided no external resultant force acts." },
        { front: "Elastic vs inelastic collision", back: "Elastic: kinetic energy conserved. Inelastic: some KE transferred to other forms (momentum is still conserved)." },
        { front: "Power", back: "P = W ÷ t = Fv." },
        { front: "Young modulus", back: "E = stress ÷ strain = (F ÷ A) ÷ (ΔL ÷ L); unit Pa; gradient of stress–strain graph." },
        { front: "Elastic strain energy", back: "½FΔL = ½kΔL² = area under the force–extension graph." },
        { front: "Principle of moments", back: "For equilibrium the sum of clockwise moments = sum of anticlockwise moments about any point." },
      ],
    },
  },
};
