// GCSE Physics — Electricity (Year 10: circuits; Year 11: characteristics, mains, power, National Grid).
import type { CTopic } from "../types";
import { N, S, M, W, yr } from "./_h";
import { CIRC_PARALLEL, CIRC_SERIES, IV } from "./_imgdata";

const SER = ["p4elec-series.png", "A series circuit diagram: a 12 volt cell, an ammeter, a 4 ohm resistor R1 and an 8 ohm resistor R2 all in one loop. A voltmeter is connected in parallel across R2."] as [string, string];
const PAR = ["p4elec-parallel.png", "A parallel circuit diagram: a 12 volt cell connected across two branches side by side. One branch has a 6 ohm resistor and the other branch has a 3 ohm resistor."] as [string, string];
const IVI = ["p4elec-iv.png", "A current against potential difference graph with two lines from the origin up to 6 volts. Line A is a straight line reaching 0.6 amperes at 6 volts. Line B is a curve that rises steeply at first then flattens, reaching 0.75 amperes at 6 volts."] as [string, string];
const last = <T,>(a: T[]) => a[a.length - 1];

export const TOPIC: CTopic = {
  key: "p4elec", topic: "Physics — Electricity", subject: "Science",
  years: {
    10: yr("p4elec", 10, {
      obj: [
        "Use standard circuit symbols; draw and interpret circuit diagrams.",
        "Define current, potential difference and resistance; use I = Q ÷ t, E = QV and V = IR.",
        "Describe and calculate current, PD and resistance in series and parallel circuits.",
        "Explain how resistance depends on length and thickness of a wire.",
        "Required practical: investigate resistance of a wire and of components in series and parallel.",
      ],
      note: ["GCSE Physics: circuits, current, potential difference and resistance", `## Basic ideas
**Current** is the rate of flow of charge (in amperes). **Potential difference** (voltage) is the energy transferred per unit charge. **Resistance** opposes current.

| Quantity | Equation |
| --- | --- |
| Charge | Q = I t (coulombs) |
| Energy | E = Q V |
| Ohm's law | V = I R |

## Series and parallel
- **Series**: one loop. The **current is the same** everywhere; the supply PD is **shared**; resistances **add**: R = R₁ + R₂.
- **Parallel**: branches. The **PD is the same** across each branch; the currents **add** at the junction; the total resistance is **less than the smallest** branch.
- Ammeters go in **series**; voltmeters go in **parallel**.

A longer or thinner wire has a **higher** resistance.

## Worked examples
- 9 V cell with 5 Ω and 10 Ω in series: R = 15 Ω, I = 9 ÷ 15 = **0.60 A**.
- 2.0 A flows for 30 s: Q = 2.0 × 30 = **60 C**.
- 20 C passes through a 9 V component: E = 20 × 9 = **180 J**.

**Working scientifically:** in the wire practical, vary the length, take several readings of V and I, calculate R = V ÷ I, and plot a graph of resistance against length. Keep the current small to avoid heating the wire.`],
      quiz: "GCSE Physics: Electricity quiz (Year 10)",
      qs: [
        S(1, "What is the unit of potential difference?", "Volt", ["Ampere", "Ohm", "Coulomb"], "Potential difference is measured in volts. Current is in amperes, resistance in ohms and charge in coulombs.", {}),
        S(1, "How should an ammeter be connected in a circuit?", "In series with the component", ["In parallel with the component", "Across the cell only", "It does not matter"], "An ammeter measures the current through a component, so it must be in the same loop (in series). A voltmeter goes in parallel.", {}),
        S(1, "What can you say about the current at different points in a series circuit?", "It is the same everywhere", ["It is largest near the cell", "It is shared between the components", "It is used up by each component"], "Current is not used up. In a single loop the same charge flows past every point each second.", {}),
        N(2, "Use the series circuit in the diagram. Calculate the reading on the ammeter in amperes.", 1, 0.01, "Total resistance = 4 + 8 = 12 Ω. Current = V ÷ R = 12 ÷ 12 = 1.0 A.", () => CIRC_SERIES.V / (CIRC_SERIES.R1 + CIRC_SERIES.R2), { img: SER, diag: true }),
        N(2, "In the same circuit, calculate the reading on the voltmeter across the 8 Ω resistor, in volts.", 8, 0.05, "The current is 1.0 A. V = I × R = 1.0 × 8 = 8 V.", () => (CIRC_SERIES.V / (CIRC_SERIES.R1 + CIRC_SERIES.R2)) * CIRC_SERIES.R2, { img: SER }),
        N(2, "A current of 3.0 A flows through a lamp for 40 s. Calculate the charge that flows, in coulombs.", 120, 0.5, "Charge = current × time = 3.0 × 40 = 120 C.", () => 3.0 * 40, { diag: true }),
        N(2, "50 C of charge passes through a component with a potential difference of 6.0 V across it. Calculate the energy transferred, in joules.", 300, 1, "E = Q × V = 50 × 6.0 = 300 J.", () => 50 * 6.0),
        S(2, "What is true about the potential difference across each branch of a parallel circuit?", "It is the same across each branch and equal to the supply", ["It is shared between the branches", "It is zero in the branch with the larger resistor", "It is larger in the branch with the larger resistor"], "Each branch is connected directly across the supply, so each has the full supply PD. Currents differ if the resistances differ.", {}),
        M(2, "Which changes would INCREASE the resistance of a metal wire? Choose all that apply.", ["Making the wire longer", "Using a thinner wire of the same material"], ["Making the wire shorter", "Using a thicker wire of the same material"], "Resistance rises with length (more collisions on the way) and falls with a larger cross-sectional area (more paths for charge).", {}),
        N(3, "Use the parallel circuit in the diagram. Calculate the total current drawn from the cell, in amperes.", 6, 0.05, "Branch currents: 12 ÷ 6 = 2 A and 12 ÷ 3 = 4 A. Currents add at the junction: 2 + 4 = 6 A.", () => CIRC_PARALLEL.V / CIRC_PARALLEL.R1 + CIRC_PARALLEL.V / CIRC_PARALLEL.R2, { img: PAR }),
        S(3, "A resistor is added in parallel with a resistor already in a circuit. What happens to the total resistance?", "It decreases, because there is another path for the current", ["It increases, because there are more resistors", "It stays the same", "It becomes the sum of the resistances"], "More branches give the charge more routes, so the total current rises and the total resistance falls below the smallest branch.", {}),
        N(3, "A wire of length 0.40 m has a resistance of 4.0 Ω. Resistance is directly proportional to length for the same wire. Calculate the resistance of 1.5 m of the same wire, in ohms.", 15, 0.1, "Resistance per metre = 4.0 ÷ 0.40 = 10 Ω/m. For 1.5 m: 10 × 1.5 = 15 Ω.", () => 4.0 * (1.5 / 0.4)),
        S(3, "A lamp in series with a cell has a current of 0.50 A. A second identical lamp is added in series. Assuming the cell PD stays the same, what is the new current?", "0.25 A", ["0.50 A", "1.0 A", "0.75 A"], "The total resistance doubles (R + R = 2R) with the same PD, so by I = V ÷ R the current halves to 0.25 A.", { chk: () => 0.5 / 2 }),
      ],
      cards: [
        ["Charge equation", "Q = I × t."],
        ["Energy transferred equation", "E = Q × V."],
        ["Ohm's law", "V = I × R."],
        ["Series circuit: current, PD, resistance", "Same current; PD shared; resistances add."],
        ["Parallel circuit: current, PD", "PD same across branches; currents add."],
        ["Where to connect an ammeter / voltmeter", "Ammeter in series; voltmeter in parallel."],
        ["Effect of length on wire resistance", "Longer wire, larger resistance (directly proportional)."],
        ["Effect of thickness on wire resistance", "Thicker wire, smaller resistance."],
        ["Unit of resistance", "Ohm (Ω)."],
        ["Adding a resistor in parallel", "Total resistance decreases."],
        ["What is current?", "The rate of flow of charge, measured in amperes."],
        ["What is potential difference?", "Energy transferred per unit charge, measured in volts."],
      ],
    }),
    11: yr("p4elec", 11, {
      obj: [
        "Draw and interpret I–V characteristics of a resistor, a filament lamp and a diode; describe thermistors and LDRs.",
        "Describe mains electricity (a.c., 230 V, 50 Hz), and the live, neutral and earth wires and safety features (fuse, earthing).",
        "Calculate power using P = IV and P = I²R, and energy using E = Pt.",
        "Describe the National Grid and explain the role of step-up and step-down transformers.",
        "Required practical: investigate the I–V characteristic of a filament lamp and a resistor.",
        "Triple stretch: static electricity and electric fields.",
      ],
      note: ["GCSE Physics: I–V graphs, mains electricity and power", `## Characteristics
- **Resistor at constant temperature**: straight line through the origin (constant resistance, V = IR).
- **Filament lamp**: the line curves because the filament heats up and its resistance **increases** (ions vibrate more, more collisions with electrons).
- **Diode**: current flows one way only.
- **Thermistor**: resistance **falls** as temperature rises. **LDR**: resistance **falls** as light intensity rises.
At any point, resistance = V ÷ I read from the graph.

## Mains and safety
UK mains is **alternating current**, **230 V**, **50 Hz**. The **live** wire (brown) carries the alternating PD, the **neutral** (blue) completes the circuit, the **earth** (green and yellow) is a safety wire: if the live touches the metal casing the large current flows to earth and **blows the fuse**.

## Power and energy
| Quantity | Equation |
| --- | --- |
| Power | P = I V |
| Power | P = I² R |
| Energy | E = P t |

Worked examples: 0.50 A at 12 V gives P = **6 W**. A 2.0 A current through a 4.0 Ω heater gives P = 2.0² × 4.0 = **16 W**.

## The National Grid
**Step-up transformers** raise the PD for transmission; for the same power the **current falls**, so less energy is wasted as heat (P = I²R). **Step-down transformers** lower the PD for safe use in homes.

**Working scientifically:** vary the PD with a variable resistor or power supply, record the current, and repeat with the reversed connections. Take care that the current does not overheat the lamp.`],
      quiz: "GCSE Physics: Electricity quiz (Year 11)",
      qs: [
        S(1, "What is the potential difference of UK mains electricity?", "230 V", ["12 V", "23 V", "2300 V"], "UK domestic mains supply is about 230 V a.c. at 50 Hz.", {}),
        S(1, "What colour is the earth wire in a UK plug?", "Green and yellow", ["Brown", "Blue", "Red"], "The earth wire has green and yellow stripes. The live wire is brown and the neutral wire is blue.", {}),
        S(1, "What happens to the resistance of an LDR as the light intensity increases?", "It decreases", ["It increases", "It stays the same", "It becomes infinite"], "An LDR (light-dependent resistor) has high resistance in the dark and low resistance in bright light.", {}),
        N(2, "Line A on the graph is a resistor. Calculate its resistance at 6.0 V in ohms.", 10, 0.1, "From the graph the current at 6.0 V is 0.60 A. R = V ÷ I = 6.0 ÷ 0.60 = 10 Ω.", () => last(IV.V) / last(IV.resistor), { img: IVI }),
        N(2, "Curve B is a filament lamp. Calculate its resistance at 6.0 V in ohms.", 8, 0.1, "The current at 6.0 V is 0.75 A. R = 6.0 ÷ 0.75 = 8.0 Ω.", () => last(IV.V) / last(IV.lamp), { img: IVI, diag: true }),
        S(2, "Why does the filament lamp's I–V graph curve?", "As the filament heats up, its resistance increases", ["The lamp gets a higher potential difference", "The current stops flowing at higher voltage", "The resistance decreases as the filament gets hotter"], "Hotter ions vibrate more, colliding more with electrons, so the resistance rises. The gradient of the I–V line falls.", { img: IVI }),
        N(2, "A hairdryer draws a current of 5.0 A from the 230 V mains. Calculate its power in watts.", 1150, 1, "P = I × V = 5.0 × 230 = 1150 W.", () => 5.0 * 230),
        N(2, "A current of 3.0 A flows through a 10 Ω resistor. Calculate the power dissipated in watts.", 90, 0.1, "P = I² × R = 3.0² × 10 = 9.0 × 10 = 90 W.", () => 3.0 ** 2 * 10, { diag: true }),
        N(2, "A 1.2 kW toaster is switched on for 5 minutes. Calculate the energy transferred in kilojoules.", 360, 0.5, "1.2 kW = 1200 W and 5 min = 300 s. E = P × t = 1200 × 300 = 360 000 J = 360 kJ.", () => (1200 * 300) / 1000),
        S(2, "What is the purpose of the earth wire?", "If the live wire touches the metal case, a large current flows to earth and blows the fuse", ["It carries the current back to the power station once it has passed through the appliance, completing the circuit", "It supplies the 230 V to the appliance so that it can work at full power", "It prevents the current from changing direction so that the appliance receives direct current"], "The earth wire is a safety wire connected to the metal casing. A fault sends a large current through it, blowing the fuse and cutting the supply.", {}),
        S(3, "Why is electricity transmitted at very high potential difference in the National Grid?", "For the same power, a higher PD means a lower current, so less energy is wasted as heat", ["A higher PD makes the current larger, so more power reaches the homes at the end of the cables", "The resistance of the cables falls to zero when the PD across them is high enough", "It makes the electricity safer to use in homes, because a high PD supply is less likely to give an electric shock"], "P = IV so raising V lowers I for the same power. Heat loss is I²R, so it falls a lot.", {}),
        N(3, "Power lost in a cable = I² R. The current in a cable is reduced from 100 A to 10 A. By what factor does the power lost in the cable fall?", 100, 0.1, "Power lost depends on I². The current falls by a factor of 10, so I² falls by a factor of 10² = 100.", () => (100 / 10) ** 2),
        W("Describe how you would investigate the current–potential difference (I–V) characteristic of a filament lamp, and explain the shape of the graph you would expect. [6 marks]", "Mark scheme (6): circuit with cell/variable power supply, filament lamp and variable resistor in series, ammeter in series with the lamp (1); voltmeter in parallel across the lamp (1); change the PD in steps using the variable resistor and record V and I each time (1); reverse the connections to get negative values (1); plot I against V (1); curve is steep at first then flattens: as the current increases the filament heats up, its resistance increases (ions vibrate more, more collisions with electrons), so the gradient decreases (1)."),
      ],
      cards: [
        ["I–V graph of a resistor at constant temperature", "Straight line through the origin: constant resistance."],
        ["Why does a filament lamp's resistance increase?", "The filament heats up; ions vibrate more, more collisions with electrons."],
        ["Thermistor", "Resistance decreases as temperature increases."],
        ["LDR", "Resistance decreases as light intensity increases."],
        ["Diode", "Current flows in one direction only."],
        ["UK mains", "230 V a.c., 50 Hz."],
        ["Live, neutral and earth wire colours", "Brown, blue, green-and-yellow."],
        ["Purpose of a fuse", "Melts if the current is too large, breaking the circuit."],
        ["Power equations", "P = I V and P = I² R."],
        ["Energy transferred equation", "E = P t."],
        ["Step-up transformer in the National Grid", "Raises PD and lowers current, reducing heat loss in cables."],
        ["Step-down transformer", "Lowers PD for safe use in homes."],
      ],
    }),
  },
};
