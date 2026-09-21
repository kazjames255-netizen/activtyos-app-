// GCSE Physics — Magnetism & Electromagnetism (Year 11).
import type { CTopic } from "../types";
import { N, S, W, yr } from "./_h";
import { TRANSFORMER } from "./_imgdata";

const IMG = ["p4mag-transformer.png", "A transformer diagram. Two coils of wire are wound on opposite sides of a rectangular iron core. The left coil, the primary, has 460 turns and a 230 volt input. The right coil, the secondary, has 40 turns and its output voltage is shown as a question mark."] as [string, string];
const Vs = (Vp: number, Np: number, Ns: number) => (Vp * Ns) / Np;

export const TOPIC: CTopic = {
  key: "p4mag", topic: "Physics — Magnetism & Electromagnetism", subject: "Science",
  years: {
    11: yr("p4mag", 11, {
      obj: [
        "Describe permanent and induced magnets, magnetic fields and field patterns.",
        "Describe the magnetic field of a current-carrying wire, a solenoid and an electromagnet.",
        "Describe the motor effect; use Fleming's left-hand rule and F = B I l (higher tier); describe the electric motor.",
        "Describe electromagnetic induction, the generator effect, alternators and dynamos (triple).",
        "Describe loudspeakers and microphones (triple).",
        "Describe transformers and use V_p ÷ V_s = N_p ÷ N_s and V_p I_p = V_s I_s (triple).",
      ],
      note: ["GCSE Physics: magnets, motors and transformers", `## Magnetism
Like poles **repel**, unlike poles **attract**. **Iron, steel, cobalt and nickel** are magnetic. Field lines go from **north to south** and are closest where the field is strongest. A compass shows the field direction. A current in a wire produces a **magnetic field** in circles around it; a coil (**solenoid**) gives a field like a bar magnet. An **electromagnet** is made stronger by more turns, a larger current and an **iron core**.

## Motor effect
A wire carrying a current in a magnetic field feels a **force**. Fleming's left-hand rule: thumb = force, first finger = field, second finger = current. **F = B I l** (force in N, flux density in tesla, current in A, length in m). Reversing the current or the field reverses the force.

## Generator effect and transformers (triple)
Moving a wire in a magnetic field, or changing the field through a coil, **induces** a PD. Faster movement, a stronger magnet or more turns gives a larger PD. A **transformer** has two coils on an iron core:
V_p ÷ V_s = N_p ÷ N_s. A **step-up** transformer has more secondary turns. If 100% efficient, V_p I_p = V_s I_s.

| Quantity | Equation |
| --- | --- |
| Force on a wire | F = B I l |
| Transformer voltages | V_p ÷ V_s = N_p ÷ N_s |
| Power in = power out | V_p I_p = V_s I_s |

## Worked examples
- B = 0.50 T, I = 2.0 A, l = 0.10 m: F = 0.50 × 2.0 × 0.10 = **0.10 N**.
- 230 V across 1000 turns, secondary 100 turns: V_s = 230 × 100 ÷ 1000 = **23 V**.

**Working scientifically:** to map a magnetic field, place a plotting compass at several points and mark the direction of its needle.`],
      quiz: "GCSE Physics: Magnetism & Electromagnetism quiz",
      qs: [
        S(1, "What happens when two north poles of magnets are brought close together?", "They repel", ["They attract", "They do nothing", "They become south poles"], "Like poles repel and unlike poles attract.", {}),
        S(1, "Which of these materials is magnetic?", "Nickel", ["Aluminium", "Copper", "Plastic"], "Iron, steel, cobalt and nickel are the common magnetic materials. Aluminium and copper are not.", {}),
        S(1, "What surrounds a wire carrying an electric current?", "A magnetic field", ["An electric field only", "A region of static charge", "Nothing"], "A current produces a magnetic field around the wire, in circles centred on it.", {}),
        N(2, "Use the transformer diagram. Calculate the output potential difference in volts.", 20, 0.1, "Vp ÷ Vs = Np ÷ Ns so Vs = 230 × 40 ÷ 460 = 20 V.", () => Vs(TRANSFORMER.Vp, TRANSFORMER.Np, TRANSFORMER.Ns), { img: IMG, diag: true }),
        S(2, "Is the transformer in the diagram a step-up or a step-down transformer?", "Step-down", ["Step-up", "Neither, because it is an a.c. generator", "Neither, because the core is iron"], "The secondary has fewer turns (40) than the primary (460), so the output PD is lower: a step-down transformer.", { img: IMG, chk: () => (TRANSFORMER.Ns < TRANSFORMER.Np ? "Step-down" : "Step-up") }),
        S(2, "Which changes would make an electromagnet stronger?", "More turns of wire and an iron core", ["Fewer turns and a copper core", "A smaller current and more turns", "A plastic core and a larger current"], "The field is stronger with more turns, a larger current and an iron core.", {}),
        N(2, "A wire of length 0.30 m carries a current of 5.0 A at right angles to a magnetic field of flux density 0.040 T. Calculate the force on the wire in newtons.", 0.06, 0.001, "F = B × I × l = 0.040 × 5.0 × 0.30 = 0.060 N.", () => 0.04 * 5.0 * 0.3),
        S(2, "How could you reverse the direction of the force on a wire in the motor effect?", "Reverse the direction of the current", ["Use a thicker wire", "Increase the size of the current", "Use a longer wire"], "The force direction depends on the current and field directions. Reversing either one reverses the force.", {}),
        S(2, "Which change would increase the PD induced in a generator?", "Rotating the coil faster", ["Using a weaker magnet", "Using fewer turns of wire", "Rotating the coil more slowly"], "A faster rate of change of flux, a stronger magnet or more turns all increase the induced PD.", { diag: true }),
        N(2, "A transformer has 1150 turns on the primary coil connected to a 230 V supply. The output should be 12 V. Calculate the number of turns on the secondary coil.", 60, 0.5, "Ns = Np × Vs ÷ Vp = 1150 × 12 ÷ 230 = 60 turns.", () => (1150 * 12) / 230),
        N(3, "A transformer is 100% efficient. The 230 V primary supplies a current of 0.10 A. The secondary is 20 V. Calculate the current in the secondary coil, in amperes.", 1.15, 0.01, "Power in = power out: Vp × Ip = Vs × Is. 230 × 0.10 = 23 W, so Is = 23 ÷ 20 = 1.15 A.", () => (TRANSFORMER.Vp * 0.1) / Vs(TRANSFORMER.Vp, TRANSFORMER.Np, TRANSFORMER.Ns), { img: IMG }),
        S(3, "Why is the core of a transformer made of iron?", "Iron is easily magnetised and demagnetised and links the changing field of the primary to the secondary", ["Iron is a good electrical conductor, so it carries the current directly from the primary coil into the secondary coil", "Iron makes the current in the secondary direct current", "Iron increases the resistance of the coils so that less energy is wasted"], "The soft iron core concentrates the changing magnetic field so it passes through the secondary coil. There is no electrical connection between the coils.", {}),
        W("Explain how a simple d.c. electric motor works, including the role of the split-ring commutator. [6 marks]", "Mark scheme (6): a coil of wire lies in a magnetic field between two magnets (1); a current flows through the coil (1); the current in the coil in the field experiences a force (the motor effect) (1); the current flows in opposite directions on the two sides of the coil, so the forces are in opposite directions and the coil turns (1); the split-ring commutator reverses the current every half turn (1) so the forces keep the coil rotating in the same direction (1)."),
      ],
      cards: [
        ["Poles rule", "Like poles repel; unlike poles attract."],
        ["Magnetic materials", "Iron, steel, cobalt, nickel."],
        ["Field line direction", "From north pole to south pole."],
        ["Ways to strengthen an electromagnet", "More turns, larger current, iron core."],
        ["Motor effect", "A current-carrying wire in a magnetic field experiences a force."],
        ["Force on a wire", "F = B I l."],
        ["Fleming's left-hand rule", "Thumb: force, first finger: field, second finger: current."],
        ["Generator effect", "A PD is induced when a conductor moves in a field or the field changes."],
        ["Transformer equation", "Vp ÷ Vs = Np ÷ Ns."],
        ["100% efficient transformer", "Vp Ip = Vs Is."],
        ["Step-up vs step-down", "Step-up: more secondary turns; step-down: fewer."],
        ["Role of commutator", "Reverses the current every half turn to keep the motor spinning the same way."],
      ],
    }),
  },
};
