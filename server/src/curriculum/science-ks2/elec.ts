// KS2 Science — Electricity (Years 4 and 6). Original content aligned to the DfE National Curriculum (OGL v3.0).
// Which circuits light / how bright are recomputed by _check_s2.ts from _s2data.ts (the data that draws the images).
import type { CTopic } from "../types";

const C4_ALT = "Four circuit diagrams labelled A to D, each with a cell. A: a cell, a bulb and a closed switch in one loop. B: a cell, a bulb and an open switch. C: a cell and a bulb with a break in the wire on the right. D: a cell, two bulbs and a closed switch in one loop.";
const C6_ALT = "Four circuit diagrams labelled A to D, each with closed switch. A: one cell and one bulb. B: two cells and one bulb. C: one cell and two bulbs. D: three cells and one bulb.";
const SYM_ALT = "Six circuit symbols in boxes lettered A to F. A is a circle with a cross, B is a switch with the arm lifted away, C is one cell drawn as a long thin line and a short thick line, D is two cells in a row, E is a switch with the arm closed across the gap, and F is a circle with the letter M inside.";

export const TOPIC: CTopic = {
  key: "elec",
  topic: "Electricity",
  subject: "Science",
  years: {
    // ───────────────────────── YEAR 4 ─────────────────────────
    4: {
      year: 4,
      objectives: [
        "Identify common appliances that run on electricity.",
        "Construct a simple series electrical circuit, identifying and naming its basic parts, including cells, wires, bulbs, switches and buzzers.",
        "Identify whether or not a lamp will light in a simple series circuit, based on whether or not the lamp is part of a complete loop with a battery.",
        "Recognise that a switch opens and closes a circuit and associate this with whether or not a lamp lights in a simple series circuit.",
        "Recognise some common conductors and insulators, and associate metals with being good conductors.",
      ],
      note: {
        title: "Year 4: simple circuits, switches, conductors and insulators",
        body: `## Building a circuit
An electric current flows round a **complete loop**. A simple **series circuit** has:
- a **cell** (or battery) that pushes the current round,
- **wires** that carry the current,
- a **component** such as a bulb or a buzzer,
- often a **switch**.

The circuit must be a **complete loop with no gaps**. If there is any break, such as an open switch or a loose wire, nothing works.

## Switches
A **switch** opens or closes the circuit.
- **Closed** switch: the loop is complete and the bulb lights.
- **Open** switch: there is a gap, so the current stops and the bulb goes out.

**Worked example 1:** A torch has a cell, a bulb and a switch. Pressing the button closes the circuit and the bulb lights.

## Conductors and insulators
A **conductor** lets electricity pass through easily. Metals such as copper, iron and aluminium are good conductors. An **insulator** does not let electricity pass. Plastic, rubber, glass and wood are insulators.

| Material | Conductor or insulator? |
| --- | --- |
| Copper wire | Conductor |
| Plastic coating | Insulator |
| Iron nail | Conductor |
| Glass | Insulator |

**Worked example 2:** The metal pins of a plug are conductors. The plastic case is an insulator, so it is safe to hold.

**Worked example 3:** A bulb does not light in a circuit with a loose wire. You push the wire firmly into the holder to close the gap and the bulb lights.

**Safety:** never play with mains electricity. Only use batteries or cells for experiments.`,
      },
      quiz: {
        title: "Electricity: Year 4 quiz",
        questions: [
          { key: "elec-y4-01", kind: "multi", prompt: "Look at the four circuits. Which TWO circuits will light their bulbs?", options: ["A", "B", "C", "D"], answer: ["A", "D"], explanation: "A bulb lights only in a complete loop. A and D have closed loops. B has an open switch and C has a gap.", difficulty: 2, image: { file: "elec-circuits4.png", alt: C4_ALT } },
          { key: "elec-y4-02", kind: "single", prompt: "Look at circuit B. Why does its bulb not light?", options: ["The bulb is fitted upside down, so the current cannot get into it","There are too many wires", "The switch is open, so the circuit is not a complete loop", "The cell is too big"], answer: "The switch is open, so the circuit is not a complete loop", explanation: "An open switch leaves a gap in the circuit, so the current cannot flow round.", difficulty: 2, diagnostic: true, image: { file: "elec-circuits4.png", alt: C4_ALT } },
          { key: "elec-y4-03", kind: "single", prompt: "Look at circuit C. What stops the bulb from lighting?", options: ["A gap in the wire", "The switch is closed", "The bulb is missing", "There are too many cells"], answer: "A gap in the wire", explanation: "There is a break on the right-hand side of the circuit, so the loop is not complete.", difficulty: 2, image: { file: "elec-circuits4.png", alt: C4_ALT } },
          { key: "elec-y4-04", kind: "single", prompt: "Look at circuit D. What will happen to both bulbs if the switch is opened?", options: ["Only one bulb goes out", "Both bulbs get brighter", "Nothing changes", "Both bulbs go out"], answer: "Both bulbs go out", explanation: "It is a single loop, so opening the switch breaks the loop for everything in it.", difficulty: 3, image: { file: "elec-circuits4.png", alt: C4_ALT } },
          { key: "elec-y4-05", kind: "single", prompt: "Which of these is a good electrical conductor?", options: ["Rubber", "Plastic", "Copper", "Wood"], answer: "Copper", explanation: "Metals such as copper let electricity flow easily.", difficulty: 1 },
          { key: "elec-y4-06", kind: "single", prompt: "Why are electrical wires covered in plastic?", options: ["Plastic is a good conductor, so it helps the current flow","Plastic makes electricity", "Plastic is an insulator, so it keeps us safe", "Plastic makes the wire heavier"], answer: "Plastic is an insulator, so it keeps us safe", explanation: "Plastic does not let electricity pass, so touching the outside of the wire is safe.", difficulty: 2 },
          { key: "elec-y4-07", kind: "single", prompt: "What does a switch do in a circuit?", options: ["It stores electricity for the bulb to use later","It opens and closes the circuit", "It makes the bulb hotter", "It makes the cell stronger"], answer: "It opens and closes the circuit", explanation: "A switch makes or breaks the loop, so it can turn things on and off.", difficulty: 1 },
          { key: "elec-y4-08", kind: "short", prompt: "What is the name of the part of a circuit that pushes the current round? (one word)", answer: "cell", accepted: ["battery", "a cell", "the cell", "a battery", "the battery", "cells", "batteries", "cell.", "battery."], explanation: "The cell (or battery) gives the energy that makes the current flow.", difficulty: 1 },
          { key: "elec-y4-09", kind: "single", prompt: "Which of these is NOT an electrical insulator?", options: ["Steel key", "Wooden ruler", "Rubber eraser", "Plastic pen"], answer: "Steel key", explanation: "Steel is a metal, so it is a conductor. Wood, rubber and plastic are insulators.", difficulty: 2, diagnostic: true },
          { key: "elec-y4-10", kind: "single", prompt: "A pupil has a circuit with a gap in it and the bulb is off. She lays a metal paperclip across the gap and the bulb lights. Why?", options: ["The paperclip makes its own electricity to light the bulb","The paperclip is an insulator", "The paperclip is a conductor that completes the circuit", "The paperclip opens the switch"], answer: "The paperclip is a conductor that completes the circuit", explanation: "The metal paperclip lets current cross the gap, so the loop is complete.", difficulty: 3 },
        ],
      },
      flashcards: [
        { front: "What does a circuit need to work?", back: "A complete loop with no gaps, and a cell." },
        { front: "Series circuit", back: "One single loop that the current flows round." },
        { front: "Cell", back: "Pushes the electric current round the circuit." },
        { front: "Closed switch", back: "The circuit is complete, so the bulb lights." },
        { front: "Open switch", back: "There is a gap, so the current stops." },
        { front: "Conductor", back: "A material that lets electricity flow through it (metals)." },
        { front: "Insulator", back: "A material that does not let electricity flow (plastic, rubber, wood, glass)." },
        { front: "Why is a plug’s case plastic?", back: "Plastic is an insulator, so it is safe to touch." },
        { front: "Why is it dangerous to play with mains electricity?", back: "It can cause a serious shock. Only use cells and batteries." },
      ],
    },
    // ───────────────────────── YEAR 6 ─────────────────────────
    6: {
      year: 6,
      objectives: [
        "Associate the brightness of a lamp or the volume of a buzzer with the number and voltage of cells used in the circuit.",
        "Compare and give reasons for variations in how components function, including the brightness of bulbs, the loudness of buzzers and the on/off position of switches.",
        "Use recognised symbols when representing a simple circuit in a diagram.",
      ],
      note: {
        title: "Year 6: voltage, brightness and circuit symbols",
        body: `## Circuit symbols
Scientists draw circuits using **standard symbols**, with straight wires and square corners.

| Component | Symbol |
| --- | --- |
| Cell | One long thin line and one short thick line |
| Battery | Two or more cells in a row |
| Bulb (lamp) | A circle with a cross |
| Switch (open) | A line with the arm lifted away |
| Switch (closed) | A line with the arm closing the gap |
| Motor | A circle with the letter M |

## Voltage
**Voltage** is measured in **volts (V)**. It tells us how much push a cell gives the current. One cell is about 1.5 V. Cells joined in a row (in series) **add** their voltages, so two cells give about 3 V.

## Changing how components work
- **More cells** (or a higher voltage) makes a bulb **brighter** and a buzzer **louder**.
- **More bulbs** in the same loop share the energy, so each bulb is **dimmer**.
- An **open switch** breaks the loop, so all the components turn off.

**Worked example 1:** A bulb is connected to one 1.5 V cell. If you add a second cell in the same direction, the voltage becomes 3 V and the bulb is brighter.

**Worked example 2:** A buzzer is quiet with one cell. Adding another cell makes it louder. Adding another buzzer in the same loop makes each buzzer quieter.

**Worked example 3:** A circuit has a cell, a bulb and a switch. It will only light when the switch is closed.

**Working scientifically:** to test brightness fairly, change only the number of cells and keep the same bulb and wires.`,
      },
      quiz: {
        title: "Electricity: Year 6 quiz",
        questions: [
          { key: "elec-y6-01", kind: "single", prompt: "Look at the four circuits. Each has the same bulbs and cells. In which circuit is the bulb brightest?", options: ["A", "B", "C", "D"], answer: "D", explanation: "Brightness goes up with the voltage. Circuit D has three cells pushing on one bulb, more than any other.", difficulty: 2, diagnostic: true, image: { file: "elec-circuits6.png", alt: C6_ALT } },
          { key: "elec-y6-02", kind: "single", prompt: "Look at the four circuits. In which circuit are the bulbs dimmest?", options: ["A", "B", "C", "D"], answer: "C", explanation: "Circuit C has only one cell to share between two bulbs, so each bulb gets less energy and is dimmer.", difficulty: 2, image: { file: "elec-circuits6.png", alt: C6_ALT } },
          { key: "elec-y6-03", kind: "single", prompt: "Why is the bulb in circuit B brighter than the bulb in circuit A?", options: ["It has more cells, so a higher voltage", "It has a bigger bulb that gives out more light", "It has a longer wire", "Its switch is closed but A’s is open"], answer: "It has more cells, so a higher voltage", explanation: "B has two cells and A has one. More cells means more voltage, and that makes the bulb brighter.", difficulty: 2, diagnostic: true, image: { file: "elec-circuits6.png", alt: C6_ALT } },
          { key: "elec-y6-04", kind: "single", prompt: "Circuit C has one cell and two bulbs. Why is each bulb dimmer than the bulb in A?", options: ["Two bulbs have to share the energy from one cell", "Two bulbs make the cell stronger", "Two bulbs leave a gap in the circuit, so less current gets through", "The wires are too short"], answer: "Two bulbs have to share the energy from one cell", explanation: "The cell gives the same amount of push. With two bulbs in one loop, each gets less energy.", difficulty: 3, image: { file: "elec-circuits6.png", alt: C6_ALT } },
          { key: "elec-y6-05", kind: "single", prompt: "Look at the symbols. Which letter is the symbol for a bulb?", options: ["C", "F", "B", "A"], answer: "A", explanation: "A bulb (lamp) is drawn as a circle with a cross inside.", difficulty: 1, image: { file: "elec-symbols.png", alt: SYM_ALT } },
          { key: "elec-y6-06", kind: "single", prompt: "Look at the symbols. Which letter shows a switch that is open?", options: ["E", "B", "D", "A"], answer: "B", explanation: "In an open switch the arm is lifted away, leaving a gap. E shows a closed switch.", difficulty: 1, image: { file: "elec-symbols.png", alt: SYM_ALT } },
          { key: "elec-y6-07", kind: "short", prompt: "In the symbol chart, what component is shown by the circle with the letter M inside? (one word)", answer: "motor", accepted: ["a motor", "Motor", "the motor", "motor.", "electric motor", "an electric motor", "moter"], explanation: "A circle with an M is the symbol for an electric motor.", difficulty: 2, image: { file: "elec-symbols.png", alt: SYM_ALT } },
          { key: "elec-y6-08", kind: "single", prompt: "In which units do we measure the voltage of a cell?", options: ["Newtons", "Volts", "Metres", "Degrees Celsius"], answer: "Volts", explanation: "Voltage is measured in volts (V).", difficulty: 1 },
          { key: "elec-y6-09", kind: "single", prompt: "A buzzer in a circuit sounds too quiet. What could you do to make it louder?", options: ["Add a second buzzer in the same loop", "Open the switch", "Remove a cell", "Add another cell in the same loop"], answer: "Add another cell in the same loop", explanation: "More cells give a higher voltage, which makes a buzzer louder. Adding a second buzzer would make each one quieter.", difficulty: 2 },
          { key: "elec-y6-10", kind: "multi", prompt: "Which TWO changes would make a bulb dimmer?", options: ["Add a second bulb to the same loop", "Use a cell with a lower voltage", "Add another cell", "Use shorter wires"], answer: ["Add a second bulb to the same loop", "Use a cell with a lower voltage"], explanation: "A second bulb shares the energy and a lower-voltage cell gives less push. More cells make it brighter, and wire length makes no noticeable difference.", difficulty: 3 },
        ],
      },
      flashcards: [
        { front: "Symbol for a cell", back: "One long thin line and one short thick line." },
        { front: "Symbol for a battery", back: "Two or more cells in a row." },
        { front: "Symbol for a bulb", back: "A circle with a cross." },
        { front: "Symbol for a motor", back: "A circle with the letter M." },
        { front: "Symbol for an open switch", back: "A line with the arm lifted away, leaving a gap." },
        { front: "Unit of voltage", back: "Volts (V)." },
        { front: "More cells in a circuit…", back: "Higher voltage: brighter bulbs, louder buzzers." },
        { front: "More bulbs in the same loop…", back: "Each bulb is dimmer." },
        { front: "An open switch…", back: "Breaks the loop so everything switches off." },
        { front: "How should you draw a circuit?", back: "With standard symbols, straight wires and square corners." },
      ],
    },
  },
};
