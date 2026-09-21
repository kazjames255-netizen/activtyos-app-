// A-level Physics — Fields (Year 13). Original content aligned to the DfE GCE AS/A-level physics subject content.
// Keys are recomputed by _chk_p5field.ts — re-run _check_s7.ts after ANY edit here.
import type { CTopic } from "../types";
import { img, qb } from "./_h";

const q = qb("p5field", 13);
export const TOPIC: CTopic = {
  key: "p5field",
  topic: "Physics — Fields",
  subject: "Science",
  years: {
    13: {
      year: 13,
      subtopic: "A-level Year 13 (A2)",
      objectives: [
        "Gravitational fields: Newton's law F = GMm/r², field strength g = GM/r², circular orbits and Kepler's third law; escape speed.",
        "Electric fields: Coulomb's law, E = F/Q, E = V/d for a uniform field, field of a point charge; motion of charges in fields.",
        "Magnetic fields: force on a current-carrying conductor F = BIL, force on a moving charge F = Bqv and circular paths.",
        "Electromagnetic induction: flux Φ = BA, flux linkage NΦ, Faraday's and Lenz's laws, and the transformer.",
      ],
      note: {
        title: "Gravitational, electric and magnetic fields and induction",
        body: `## Key ideas

A **field** is a region where a force acts on a mass or charge. Field lines show direction; closer lines mean a stronger field. Gravity between masses is always attractive; the electric force between charges can attract or repel. In a uniform electric field between plates, **E = V ÷ d**.

**Magnetic fields** exert a force on a current or moving charge at right angles to both the field and the motion. A charge moving perpendicular to a uniform field follows a circle. When magnetic flux linkage through a coil **changes**, an emf is induced: **ε = −N ΔΦ ÷ Δt** (Faraday), and the direction opposes the change (**Lenz**), an expression of conservation of energy.

| Idea | Formula |
| --- | --- |
| Gravitational force and field | F = GMm ÷ r², g = GM ÷ r² |
| Orbit (circular) | v² = GM ÷ r, T² ∝ r³ |
| Coulomb's law | F = Q₁Q₂ ÷ (4πε₀r²) |
| Field of a point charge | E = Q ÷ (4πε₀r²) |
| Force in magnetic field | F = BIL sinθ, F = Bqv |
| Circular path | r = mv ÷ (Bq) |
| Faraday's law | ε = −N ΔΦ ÷ Δt |
| Ideal transformer | Vₛ ÷ Vₚ = Nₛ ÷ Nₚ |
| Constants | G = 6.67 × 10⁻¹¹ N m² kg⁻², ε₀ = 8.85 × 10⁻¹² F m⁻¹ |

## Worked example 1

Earth (M = 5.97 × 10²⁴ kg, R = 6.37 × 10⁶ m): g = GM ÷ R² = **9.81 N kg⁻¹**.

## Worked example 2

A wire of length 0.10 m carries 5.0 A perpendicular to a 0.40 T field: F = BIL = **0.20 N**.

## Worked example 3

A coil of 100 turns has its flux changed by 2.0 mWb in 0.50 s: ε = 100 × 2.0 × 10⁻³ ÷ 0.50 = **0.40 V**.`,
      },
      quiz: {
        title: "Fields: Year 13 quiz",
        questions: [
          q.single(1, "The diagram shows the electric field lines near a small charged sphere X. What is the sign of the charge on X?", "negative", ["positive", "neutral", "It cannot be determined"], "Electric field lines point in the direction of the force on a positive test charge. Lines pointing inwards towards X show a positive charge is attracted, so X is negative.", { image: img("p5field-y13-lines.png", "A small filled circle labelled X at the centre with eight straight field lines radiating outwards from it in equal angular steps. Each line has an arrowhead pointing inwards towards the circle.") }),
          q.num(1, "A straight wire of length 0.40 m carries a current of 3.0 A at right angles to a uniform magnetic field of flux density 0.25 T. Calculate the force on the wire, in N.", 0.3, 0.005, "F = BIL = 0.25 × 3.0 × 0.40 = 0.30 N."),
          q.num(2, "Mars has mass 6.42 × 10²³ kg and radius 3.39 × 10⁶ m. Calculate the gravitational field strength at its surface, in N kg⁻¹, to 3 significant figures. (G = 6.67 × 10⁻¹¹ N m² kg⁻²)", 3.73, 0.02, "g = GM ÷ r² = 6.67 × 10⁻¹¹ × 6.42 × 10²³ ÷ (3.39 × 10⁶)² = 3.73 N kg⁻¹.", { diag: true }),
          q.num(2, "A satellite orbits Earth (mass 5.97 × 10²⁴ kg) in a circle of radius 4.22 × 10⁷ m. Use v² = GM ÷ r to find its orbital period, in hours, to 3 significant figures. (G = 6.67 × 10⁻¹¹ N m² kg⁻²)", 24, 0.05, "v = √(GM ÷ r) = 3070 m s⁻¹. T = 2πr ÷ v = 2π × 4.22 × 10⁷ ÷ 3070 = 8.63 × 10⁴ s = 24.0 hours (a geostationary orbit)."),
          q.num(2, "Two small point charges of +3.0 nC and −5.0 nC are 4.0 cm apart in air. Calculate the magnitude of the force between them, in μN, to 3 significant figures. (ε₀ = 8.85 × 10⁻¹² F m⁻¹)", 84.3, 0.2, "F = Q₁Q₂ ÷ (4πε₀r²) = 3.0 × 10⁻⁹ × 5.0 × 10⁻⁹ ÷ (4π × 8.85 × 10⁻¹² × 0.040²) = 8.43 × 10⁻⁵ N = 84.3 μN. The force is attractive."),
          q.num(3, "An electron is between two parallel plates 2.0 cm apart with a potential difference of 400 V. Calculate its acceleration, in units of 10¹⁵ m s⁻², to 3 significant figures. (e = 1.60 × 10⁻¹⁹ C, electron mass 9.11 × 10⁻³¹ kg)", 3.51, 0.02, "E = V ÷ d = 400 ÷ 0.020 = 2.0 × 10⁴ V m⁻¹. F = eE = 3.2 × 10⁻¹⁵ N. a = F ÷ m = 3.2 × 10⁻¹⁵ ÷ 9.11 × 10⁻³¹ = 3.51 × 10¹⁵ m s⁻²."),
          q.num(2, "A proton travels at 2.0 × 10⁶ m s⁻¹ at right angles to a uniform magnetic field of flux density 0.10 T. Calculate the radius of its circular path, in m, to 3 significant figures. (proton mass 1.67 × 10⁻²⁷ kg, e = 1.60 × 10⁻¹⁹ C)", 0.209, 0.002, "The magnetic force provides the centripetal force: Bqv = mv²/r, so r = mv ÷ (Bq) = 1.67 × 10⁻²⁷ × 2.0 × 10⁶ ÷ (0.10 × 1.60 × 10⁻¹⁹) = 0.209 m."),
          q.num(2, "A coil of 200 turns has its magnetic flux reduced uniformly from 4.0 mWb to zero in 0.020 s. Calculate the magnitude of the induced emf, in V.", 40, 0.5, "ε = N ΔΦ ÷ Δt = 200 × 4.0 × 10⁻³ ÷ 0.020 = 40 V.", { diag: true }),
          q.num(3, "The graph shows how the flux linkage through a coil changes with time. Calculate the magnitude of the emf induced between 0.60 s and 1.00 s, in V, to 2 significant figures.", 1.5, 0.05, "The induced emf is the gradient of the flux-linkage graph: |ε| = ΔNΦ ÷ Δt = 0.60 ÷ (1.00 − 0.60) = 1.5 V.", { image: img("p5field-y13-flux.png", "A graph of flux linkage in weber turns against time in seconds. The line rises straight from 0 to 0.60 weber turns between 0 and 0.20 seconds, stays constant at 0.60 until 0.60 seconds, then falls in a straight line to zero at 1.00 seconds.") }),
          q.num(3, "Calculate the minimum speed needed to escape from Earth's surface, in km s⁻¹, to 3 significant figures. (M = 5.97 × 10²⁴ kg, R = 6.37 × 10⁶ m, G = 6.67 × 10⁻¹¹ N m² kg⁻²; escape speed v = √(2GM ÷ R))", 11.2, 0.05, "v = √(2GM ÷ R) = √(2 × 3.982 × 10¹⁴ ÷ 6.37 × 10⁶) = √(1.25 × 10⁸) = 1.12 × 10⁴ m s⁻¹ = 11.2 km s⁻¹."),
          q.single(2, "A magnet is pushed into a coil. According to Lenz's law, the induced current flows so that:", "it opposes the motion of the magnet, in agreement with conservation of energy", ["it helps the magnet move into the coil, so the magnet gains kinetic energy as it falls through", "it produces no magnetic field of its own", "it flows in the same direction around the coil whichever pole enters first"], "The induced current produces a magnetic field opposing the change in flux, so work must be done to push the magnet in: that work becomes electrical energy."),
          q.num(3, "An ideal transformer is connected to a 230 V supply and delivers 4.0 A at 12 V. Calculate the current in the primary coil, in A, to 3 significant figures.", 0.209, 0.002, "For an ideal transformer power in = power out: VₚIₚ = VₛIₛ. Iₚ = 12 × 4.0 ÷ 230 = 0.209 A."),
          q.multi(2, "Which TWO of these statements are correct?", ["The gravitational force between two masses is always attractive", "Electric field lines start on positive charges and end on negative charges"], ["Electric fields exert a force only on moving charges", "Gravitational field lines around a point mass point radially outwards"], "Mass has only one 'sign' so gravity always attracts. Electric field lines run from positive to negative charge and act on any charge, moving or not; gravitational field lines point inwards to the mass."),
          q.written(3, "A bar magnet is pushed at constant speed into a long solenoid connected to a sensitive voltmeter. Explain, using Faraday's and Lenz's laws, why a voltage is induced, what happens to the reading if the magnet is pushed in faster, and what happens when the magnet stops moving. [6 marks]", "The magnet's field links the turns of the coil; moving it changes the magnetic flux linkage through the coil. By Faraday's law the induced emf is proportional to the rate of change of flux linkage, ε = −NΔΦ/Δt, so an emf appears only while the flux linkage changes. Pushing faster increases dΦ/dt, so the emf is larger and lasts for a shorter time. When the magnet is stationary the flux linkage is constant, so the emf is zero. Lenz's law: the induced current creates a field that opposes the change (a repelling pole at the entrance), so work done pushing the magnet is transferred to electrical energy, consistent with conservation of energy.", "Mark scheme (max 6): the magnet's motion changes the magnetic flux linking the coil (flux linkage NΦ); Faraday's law: induced emf is equal to the rate of change of flux linkage (ε = NΔΦ ÷ Δt); faster movement gives a greater rate of change and therefore a larger emf (for a shorter time); no relative motion gives no change in flux linkage so zero emf; Lenz's law: the induced current's magnetic field opposes the change; this shows conservation of energy (work is done against the opposing force)."),
        ],
      },
      flashcards: [
        { front: "Newton's law of gravitation", back: "F = GMm ÷ r², attractive; G = 6.67 × 10⁻¹¹ N m² kg⁻²." },
        { front: "Gravitational field strength of a point mass", back: "g = GM ÷ r² (N kg⁻¹), directed towards the mass." },
        { front: "Circular orbit condition", back: "GMm ÷ r² = mv² ÷ r, so v² = GM ÷ r and T² ∝ r³ (Kepler)." },
        { front: "Geostationary satellite", back: "Orbit above the equator with period 24 h, moving west to east; radius about 4.22 × 10⁷ m." },
        { front: "Coulomb's law", back: "F = Q₁Q₂ ÷ (4πε₀r²): attractive for opposite charges, repulsive for like charges." },
        { front: "Uniform electric field", back: "E = V ÷ d between parallel plates; field lines parallel and equally spaced." },
        { front: "Force on a wire in a magnetic field", back: "F = BIL sinθ (Fleming's left-hand rule gives direction)." },
        { front: "Radius of a charged particle's path in a magnetic field", back: "r = mv ÷ (Bq)." },
        { front: "Faraday's law", back: "Induced emf = rate of change of flux linkage: ε = N ΔΦ ÷ Δt." },
        { front: "Lenz's law", back: "The induced current opposes the change that produced it (conservation of energy)." },
        { front: "Ideal transformer", back: "Vₛ ÷ Vₚ = Nₛ ÷ Nₚ and VₚIₚ = VₛIₛ." },
      ],
    },
  },
};
