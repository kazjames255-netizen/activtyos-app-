// KS3 Science — Physics: Electricity & Magnetism (Y8 circuits, current, series/parallel; Y9 resistance, V = IR, electromagnets).
// Original content aligned to the DfE KS3 programme of study (OGL v3.0). Calculation keys are recomputed by _check_s3.ts.
import type { CTopic } from "../types";
import { IMG } from "./_img";
import { sg, mu, sh, nm, build } from "./_h";

export const TOPIC: CTopic = {
  key: "pelec",
  topic: "Physics — Electricity & Magnetism",
  subject: "Science",
  years: {
    8: {
      year: 8,
      subtopic: "Year 8: circuits, current and potential difference",
      objectives: [
        "Electric current, measured in amperes, in circuits, series and parallel circuits, currents add where branches meet and current as flow of charge.",
        "Potential difference, measured in volts, battery and bulb ratings; resistance, measured in ohms.",
        "Circuit symbols and how to connect ammeters and voltmeters.",
        "Differences in resistance between conducting and insulating components (quantitative).",
      ],
      note: {
        title: "Year 8: electric circuits",
        body: `## Current, potential difference and resistance

**Current** is the flow of electric charge (electrons in a wire), measured in **amperes (A)** with an **ammeter** connected **in series**. **Potential difference** (voltage) is the energy transferred per unit charge, measured in **volts (V)** with a **voltmeter** connected **in parallel** across a component. **Resistance** (ohms, Ω) is how much a component opposes current.

## Series circuits

There is only one path. The **current is the same** everywhere. The cell's voltage is **shared** between components. Adding more lamps increases the total resistance, so the current falls and the lamps are dimmer. If one lamp breaks, all go out.

## Parallel circuits

There are branches. The **currents in the branches add up** to the current in the main wire. Each branch has the same potential difference as the cell. If one branch breaks, the others still work.

## Worked example

In a parallel circuit the main ammeter reads 1.2 A. One branch takes 0.7 A, so the other takes 1.2 − 0.7 = **0.5 A**.
Three 1.2 V cells in series give 3 × 1.2 = **3.6 V**.`,
      },
      quiz: {
        title: "Circuits: Year 8 quiz",
        questions: build("pelec", 8, [
          sg("Look at the circuit symbols. Which letter shows an ammeter?", "D", ["A", "B", "E", "F"], "An ammeter is a circle containing the letter A. The circle with a V is a voltmeter.", 1, { d: true, img: IMG.symbols }),
          sg("Look at the circuit symbols. Symbol C shows a switch. What does it look like when the switch is drawn like this?", "Open, so current cannot flow", ["Closed, so current can flow", "Broken, so it is a fuse", "Closed, so it is measuring current"], "The switch is drawn with a gap, so the circuit is incomplete.", 1, { img: IMG.symbols }),
          nm("Look at the series circuit. Ammeter A1 reads 0.40 A. What does ammeter A2 read, in amperes?", 0.4, "In a series circuit the current is the same at every point, so A2 also reads 0.40 A.", 1, { d: true, img: IMG.series, tol: 0.001 }),
          nm("Look at the parallel circuit. What does ammeter A3 read, in amperes?", 0.4, "The branch currents add up to the main current: A3 = 0.90 − 0.50 = 0.40 A.", 2, { img: IMG.parallel, tol: 0.001 }),
          mu("Which of these statements about connecting meters are correct?", ["Ammeters are connected in series", "Voltmeters are connected in parallel with the component", "Ammeters are connected in parallel", "Voltmeters are connected in series"], ["Ammeters are connected in series", "Voltmeters are connected in parallel with the component"], "An ammeter must have the current pass through it, but a voltmeter measures the difference across a component.", 2),
          sg("In a parallel circuit with two lamps on separate branches, one lamp breaks. What happens to the other lamp?", "It stays lit", ["It goes out", "It gets brighter than the cell allows", "It gets dimmer"], "Each branch is a separate path for current, so the other branch is not affected.", 2),
          sg("Three identical lamps are in series with a cell. A fourth identical lamp is added in series. What happens to the current?", "It decreases", ["It increases", "It stays the same", "It becomes zero"], "More lamps means more total resistance in the same circuit, so the current decreases.", 3),
          nm("A battery is made from four 1.5 V cells connected in series. What is the total potential difference, in volts?", 6, "Cells in series add their voltages: 4 × 1.5 = 6.0 V.", 2),
          sh("What is the unit of electric current?", "ampere", ["amp", "amps", "amperes", "A", "ampere (A)", "amperes (A)", "amp (A)", "amps (A)", "ampère", "ampères"], "Current is measured in amperes (amps), symbol A.", 1),
          sg("Why can a metal wire conduct electricity?", "It contains free electrons that can move through it", ["It contains free protons that flow", "It contains a liquid that flows through it", "Its atoms are all charged"], "Metals have delocalised electrons that are free to move, and this flow of charge is the current.", 2),
        ]),
      },
      flashcards: [
        { front: "Electric current is…", back: "The flow of electric charge (electrons in a wire); unit ampere (A)." },
        { front: "Potential difference: unit and meter", back: "Volts (V), measured with a voltmeter connected in parallel." },
        { front: "How is an ammeter connected?", back: "In series." },
        { front: "Current in a series circuit", back: "The same everywhere." },
        { front: "Current in a parallel circuit", back: "Branch currents add to the current in the main wire." },
        { front: "Cells in series", back: "Their voltages add." },
        { front: "More lamps in series: effect on current?", back: "Current decreases; lamps dimmer." },
        { front: "One lamp breaks in a parallel circuit", back: "The other branches keep working." },
        { front: "Unit of resistance", back: "Ohm (Ω)." },
        { front: "Symbol for a cell: which plate is longer?", back: "The long thin line is the positive (+) terminal." },
      ],
    },
    9: {
      year: 9,
      subtopic: "Year 9: resistance, V = IR and electromagnets",
      objectives: [
        "Resistance, measured in ohms, as the ratio of potential difference (p.d.) to current (V = I × R).",
        "Resistors in series: total resistance; the relationship between p.d. and current for a resistor.",
        "Magnetic fields and the effects of a current in a wire; the construction and strength of electromagnets and their uses.",
        "The magnetic effect of a current: a simple model of the DC motor.",
      ],
      note: {
        title: "Year 9: resistance and electromagnets",
        body: `## V = I × R

**Resistance** is the ratio of potential difference to current:

**potential difference (V) = current (A) × resistance (Ω)**

Rearranged: I = V ÷ R and R = V ÷ I. For a **resistor** at constant temperature, a graph of p.d. against current is a **straight line through the origin**: p.d. is **directly proportional** to current. Resistors in **series** add: R total = R₁ + R₂.

## Magnetism from electricity

A current in a wire produces a **magnetic field**. Reversing the current **reverses the direction** of the field. A coil of wire is a **solenoid**; with an **iron core** it is an **electromagnet**. An electromagnet is stronger with **more turns**, a **larger current** or an **iron core**. It can be **switched off**, so it is useful in scrapyard cranes, relays and electric bells. A **DC motor** uses the force on a current-carrying wire in a magnetic field.

## Worked examples

3.5 A through a 4.0 Ω resistor: V = 3.5 × 4.0 = **14 V**.
27 V across a 9.0 Ω resistor: I = 27 ÷ 9.0 = **3.0 A**.
Two resistors of 9 Ω and 4 Ω in series give R = 9 + 4 = **13 Ω**.`,
      },
      quiz: {
        title: "Resistance & Electromagnets: Year 9 quiz",
        questions: build("pelec", 9, [
          nm("Look at the circuit. The voltmeter reads 6.0 V and the ammeter reads 0.30 A. What is the resistance of R, in ohms?", 20, "R = V ÷ I = 6.0 ÷ 0.30 = 20 Ω.", 2, { d: true, img: IMG.vir }),
          nm("In the same circuit, R is replaced by a 40 Ω resistor and the battery stays the same (6.0 V). What does the ammeter now read, in amperes?", 0.15, "I = V ÷ R = 6.0 ÷ 40 = 0.15 A. Doubling the resistance halves the current.", 3, { img: IMG.vir, tol: 0.001 }),
          nm("A current of 2.0 A flows through a 12 Ω resistor. What is the potential difference across it, in volts?", 24, "V = I × R = 2.0 × 12 = 24 V.", 1, { d: true }),
          nm("A potential difference of 12 V across a resistor gives a current of 0.50 A. What is the resistance, in ohms?", 24, "R = V ÷ I = 12 ÷ 0.50 = 24 Ω.", 2),
          nm("What current flows when 6.0 V is applied across a 15 Ω resistor, in amperes?", 0.4, "I = V ÷ R = 6.0 ÷ 15 = 0.40 A.", 2, { tol: 0.001 }),
          sg("Two 10 Ω resistors are connected in series. What is the total resistance?", "20 Ω", ["5 Ω", "10 Ω", "100 Ω"], "In series, resistances add: 10 + 10 = 20 Ω.", 2),
          sg("Which change would make an electromagnet stronger?", "Adding more turns of wire to the coil", ["Using fewer turns of wire", "Reducing the current", "Replacing the iron core with a plastic rod"], "More turns, more current or an iron core all increase the strength of an electromagnet.", 1),
          sg("Why is an iron core placed inside the coil of an electromagnet?", "Iron becomes magnetised and strengthens the magnetic field", ["Iron reduces the resistance of the wire to zero so more current flows", "Iron stops the current from flowing", "Iron is a good insulator"], "The iron core is magnetised by the coil's field, which makes the total field much stronger.", 2),
          sg("What happens to the magnetic field around a wire if the direction of the current is reversed?", "The direction of the field reverses", ["The field disappears completely", "The field gets stronger but keeps its direction", "The field stays exactly the same"], "The field direction depends on the direction of the current.", 2),
          sg("A student plots p.d. against current for a resistor at constant temperature. The graph is a straight line through the origin. What does this show?", "The p.d. is directly proportional to the current, so the resistance is constant", ["The resistance increases as the current increases, so the resistor is heating up", "The p.d. is not related to the current", "The current is always zero"], "A straight line through the origin means V ∝ I, and the gradient equals the resistance.", 3),
        ]),
      },
      flashcards: [
        { front: "V = I × R: what do the letters stand for?", back: "Potential difference (V, volts), current (I, amperes), resistance (R, ohms)." },
        { front: "Rearrange to find current", back: "I = V ÷ R." },
        { front: "Rearrange to find resistance", back: "R = V ÷ I." },
        { front: "Resistors in series", back: "Total resistance = sum of the resistances." },
        { front: "V–I graph for a resistor at constant temperature", back: "A straight line through the origin (p.d. proportional to current)." },
        { front: "What produces a magnetic field around a wire?", back: "An electric current." },
        { front: "Three ways to make an electromagnet stronger", back: "More turns, larger current, iron core." },
        { front: "Advantage of an electromagnet over a permanent magnet", back: "It can be switched on and off and its strength can be changed." },
        { front: "Use of an electromagnet", back: "Scrapyard crane, electric bell, relay." },
        { front: "What does reversing the current do to the field?", back: "Reverses the direction of the field." },
      ],
    },
  },
};
