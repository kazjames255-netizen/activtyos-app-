// A-level Physics — Electricity (Year 12 current electricity; Year 13 capacitors). Original content aligned to the DfE GCE AS/A-level physics subject content.
// Keys are recomputed by _chk_p5elec.ts — re-run _check_s7.ts after ANY edit here.
import type { CTopic } from "../types";
import { img, qb } from "./_h";

const q = qb("p5elec", 12);
const q13 = qb("p5elec", 13);
export const TOPIC: CTopic = {
  key: "p5elec",
  topic: "Physics — Electricity",
  subject: "Science",
  years: {
    12: {
      year: 12,
      subtopic: "A-level Year 12 (AS)",
      objectives: [
        "Charge and current: I = ΔQ/Δt and I = nAvq; potential difference, emf, resistance, Ohm's law.",
        "I–V characteristics of a resistor, filament lamp, diode, thermistor and LDR.",
        "Resistivity R = ρL/A; electrical power P = IV = I²R = V²/R; energy transferred.",
        "Series and parallel circuits, Kirchhoff's laws and potential dividers.",
        "Emf and internal resistance: ε = I(R + r) and V = ε − Ir.",
      ],
      note: {
        title: "Current, resistance, circuits and internal resistance",
        body: `## Key ideas

**Current** is the rate of flow of charge, I = ΔQ ÷ Δt. **Potential difference** is energy transferred per unit charge, V = W ÷ Q. **Resistance** R = V ÷ I; a component is **ohmic** if I ∝ V at constant temperature. A **filament lamp** curves because heating increases resistance; a **diode** conducts in one direction only; an **NTC thermistor** has resistance that falls as it warms.

At every junction, charge in = charge out (Kirchhoff 1). Around any loop, emf = sum of p.d.s (Kirchhoff 2). A real cell has **internal resistance** r, so the terminal p.d. drops as current is drawn: **V = ε − Ir**.

| Idea | Formula |
| --- | --- |
| Charge and current | Q = It, I = nAvq |
| Series resistors | R = R₁ + R₂ + … |
| Parallel resistors | 1 ÷ R = 1 ÷ R₁ + 1 ÷ R₂ + … |
| Resistivity | R = ρL ÷ A |
| Power | P = IV = I²R = V²÷R |
| Emf equation | ε = I(R + r) = V + Ir |
| Potential divider | Vout = Vin × R₂ ÷ (R₁ + R₂) |

## Worked example 1

Resistors of 30 Ω and 20 Ω are in parallel: 1 ÷ R = 1/30 + 1/20 = 1/12, so R = **12 Ω**.

## Worked example 2

A cell of emf 1.5 V and internal resistance 0.50 Ω drives a 4.5 Ω resistor. I = ε ÷ (R + r) = 1.5 ÷ 5.0 = 0.30 A, and the terminal p.d. is V = 1.5 − 0.30 × 0.50 = **1.35 V**.

## Worked example 3

A 60 W lamp runs on 230 V: I = P ÷ V = 60 ÷ 230 = **0.26 A**.`,
      },
      quiz: {
        title: "Electricity: Year 12 quiz",
        questions: [
          q.single(1, "One coulomb of charge passes a point when a current of 1 A flows for:", "1 s", ["1 minute", "1 ms", "1 hour"], "Current is charge per second, so Q = It: 1 A × 1 s = 1 C."),
          q.num(1, "An electric heater draws 8.0 A from a 230 V supply. Calculate its power, in W.", 1840, 1, "P = IV = 8.0 × 230 = 1840 W."),
          q.num(2, "A current of 0.75 A flows through a lamp for 2.0 minutes. Calculate the charge that flows, in C.", 90, 0.5, "Convert 2.0 minutes to 120 s. Q = It = 0.75 × 120 = 90 C.", { diag: true }),
          q.num(2, "A constantan wire has resistivity 4.9 × 10⁻⁷ Ω m, length 2.5 m and diameter 0.40 mm. Calculate its resistance, in Ω, to 3 significant figures.", 9.75, 0.05, "A = π(d ÷ 2)² = π(0.20 × 10⁻³)² = 1.257 × 10⁻⁷ m². R = ρL ÷ A = 4.9 × 10⁻⁷ × 2.5 ÷ 1.257 × 10⁻⁷ = 9.75 Ω."),
          q.num(2, "Look at the circuit. Calculate the reading on the ammeter, in A, to 2 significant figures.", 0.92, 0.01, "The 18 Ω and 9.0 Ω in parallel: 1 ÷ R = 1/18 + 1/9 = 1/6, so R = 6.0 Ω. Total resistance = 7.0 + 6.0 = 13 Ω. I = V ÷ R = 12 ÷ 13 = 0.92 A.", { diag: true, image: img("p5elec-y12-circuit.png", "A circuit diagram. A 12 volt cell on the left is connected in series with an ammeter and a 7.0 ohm resistor, followed by two resistors in parallel: one of 18 ohms and one of 9.0 ohms. The circuit is a complete loop.") }),
          q.num(2, "A car battery has emf 12.0 V and internal resistance 0.40 Ω. When the starter motor draws 15 A, what is the terminal potential difference, in V?", 6, 0.05, "The lost volts are Ir = 15 × 0.40 = 6.0 V. The terminal p.d. is V = ε − Ir = 12.0 − 6.0 = 6.0 V."),
          q.single(2, "The graph shows I–V characteristics of four components. Which curve, A, B, C or D, is for a filament lamp?", "B", ["A", "C", "D"], "As current rises the filament heats up, so its resistance V ÷ I increases: the curve bends toward the V axis (B). A is an ohmic resistor, C a diode and D an NTC thermistor.", { image: img("p5elec-y12-iv.png", "A graph of current against potential difference from minus 4 to plus 4 volts showing four curves labelled A to D. A is a straight line through the origin. B is a curve through the origin that becomes flatter as the voltage increases, in both directions. C stays at zero for negative voltage and up to about 0.6 volts, then rises steeply. D is a curve through the origin that becomes steeper as the voltage increases.") }),
          q.num(2, "Two resistors of 2.7 kΩ and 1.8 kΩ are connected in series across a 12 V supply. Calculate the p.d. across the 1.8 kΩ resistor, in V, to 2 significant figures.", 4.8, 0.05, "The p.d. divides in proportion to resistance: Vout = 12 × 1.8 ÷ (2.7 + 1.8) = 12 × 0.40 = 4.8 V."),
          q.num(3, "The graph shows terminal p.d. against current for a cell as the load is changed. Use the graph to determine the internal resistance of the cell, in Ω, to 2 significant figures.", 1.5, 0.1, "V = ε − Ir, so the gradient of a V–I graph is −r. The line falls from 6.0 V at 0 A to 1.5 V at 3.0 A, gradient = −4.5 ÷ 3.0 = −1.5, so r = 1.5 Ω.", { image: img("p5elec-y12-cell.png", "A graph of terminal potential difference in volts against current in amps for a cell. Points lie close to a straight downward-sloping line of best fit that starts at 6.0 volts on the vertical axis at zero current and falls to 1.5 volts at a current of 3.0 amps.") }),
          q.num(3, "A copper wire of diameter 1.2 mm carries a current of 3.5 A. Copper has 8.5 × 10²⁸ free electrons per m³. Calculate the mean drift velocity of the electrons, in mm s⁻¹, to 3 significant figures. (e = 1.60 × 10⁻¹⁹ C)", 0.228, 0.002, "A = π(0.60 × 10⁻³)² = 1.131 × 10⁻⁶ m². From I = nAvq, v = I ÷ (nAq) = 3.5 ÷ (8.5 × 10²⁸ × 1.131 × 10⁻⁶ × 1.60 × 10⁻¹⁹) = 2.28 × 10⁻⁴ m s⁻¹ = 0.228 mm s⁻¹."),
          q.num(3, "A 8.0 Ω resistor and a 12 Ω resistor are connected in parallel across a 9.0 V supply of negligible internal resistance. Calculate the total power dissipated, in W, to 3 significant figures.", 16.9, 0.1, "Each resistor has 9.0 V across it. P = V² ÷ R: 81 ÷ 8.0 = 10.1 W and 81 ÷ 12 = 6.75 W. Total = 16.9 W."),
          q.multi(2, "Which TWO changes would increase the resistance of a metal wire at constant temperature?", ["Doubling its length", "Halving its diameter"], ["Doubling the p.d. across it", "Replacing it with a wire of the same material and diameter but half the length"], "R = ρL ÷ A. Doubling L doubles R; halving the diameter reduces A to a quarter so R is four times larger. Changing the p.d. does not change R of an ohmic wire, and a shorter wire has less resistance."),
          q.single(2, "Why does the resistance of an NTC thermistor decrease when it is heated?", "More charge carriers are released, so the current for a given p.d. increases", ["The lattice atoms vibrate less at higher temperature, so the electrons flow through more easily", "The cross-sectional area of the thermistor increases as it expands, so its resistance falls", "The p.d. across it increases"], "In a semiconductor, heating frees more charge carriers, and this outweighs the extra lattice vibrations. More carriers means a larger current for the same p.d., so R falls."),
          q.written(3, "Describe an experiment to determine the emf and internal resistance of a cell. State what you would measure, how you would vary it, and how you would use a graph to find each quantity. [6 marks]", "Connect the cell in series with a variable resistor (rheostat) and ammeter, with a voltmeter across the cell terminals. Change the resistance in steps and record terminal p.d. V and current I each time; keep the current on for short times to avoid heating/cell exhaustion. Plot V against I; V = ε − Ir so the y-intercept is the emf and the gradient is −r; find the gradient using a large triangle.", "Mark scheme (max 6): circuit with cell, variable resistor and ammeter in series and a voltmeter across the cell; vary resistance and record V and I for at least 5 values; switch off between readings (or use short readings) to avoid cell warming or running down; plot V against I; V = ε − Ir compared with y = mx + c; emf = y-intercept (V at I = 0); internal resistance = −gradient (calculated using a large triangle on the best-fit line)."),
        ],
      },
      flashcards: [
        { front: "Definition of current", back: "Rate of flow of charge: I = ΔQ ÷ Δt. 1 A = 1 C s⁻¹." },
        { front: "Potential difference vs emf", back: "p.d. = energy transferred per coulomb to other forms; emf = energy per coulomb given to the charge by the source." },
        { front: "Ohm's law", back: "Current is proportional to p.d. at constant temperature (a straight line through the origin on an I–V graph)." },
        { front: "I–V graph of a filament lamp", back: "Curves toward the V-axis: resistance increases as the filament gets hotter." },
        { front: "Resistivity equation", back: "R = ρL ÷ A. Unit of ρ: Ω m." },
        { front: "Drift velocity equation", back: "I = nAvq (n = free electrons per m³)." },
        { front: "Kirchhoff's two laws", back: "1: charge in = charge out at a junction. 2: sum of emfs = sum of p.d.s in a closed loop." },
        { front: "Parallel resistors", back: "1 ÷ R = 1 ÷ R₁ + 1 ÷ R₂ …; the total is smaller than the smallest." },
        { front: "Terminal p.d. of a cell", back: "V = ε − Ir. The 'lost volts' Ir rise with current." },
        { front: "V–I graph for a cell: gradient and intercept", back: "Intercept = emf; gradient = −r." },
        { front: "Power formulae", back: "P = IV = I²R = V² ÷ R." },
      ],
    },
    13: {
      year: 13,
      subtopic: "A-level Year 13 (A2)",
      objectives: [
        "Capacitance C = Q/V; energy stored ½QV = ½CV² = Q²/2C.",
        "Capacitors in series and parallel.",
        "Charging and discharging through a resistor: exponential decay of Q, V and I; time constant τ = RC.",
        "Analysis of discharge graphs, including ln V against t, and applications (flash units, smoothing, timing).",
      ],
      note: {
        title: "Capacitors: charge, energy and exponential discharge",
        body: `## Key ideas

A **capacitor** stores charge: **C = Q ÷ V**, measured in farads (1 F = 1 C V⁻¹). The energy stored is the area under a Q–V graph: **E = ½QV = ½CV² = Q² ÷ 2C**. Capacitors in **parallel** add (C = C₁ + C₂); in **series**, 1 ÷ C = 1 ÷ C₁ + 1 ÷ C₂.

When a capacitor discharges through a resistor the current is largest at the start and decays exponentially:

Q = Q₀e^(−t/RC), V = V₀e^(−t/RC), I = I₀e^(−t/RC).

The **time constant** τ = RC is the time for the charge (or p.d.) to fall to 1/e (37%) of its initial value. The time for it to halve is **0.69 RC**. A graph of ln V against t is a straight line with gradient **−1 ÷ RC**.

| Idea | Formula |
| --- | --- |
| Capacitance | C = Q ÷ V |
| Energy stored | E = ½CV² |
| Parallel / series | C₁ + C₂ / 1 ÷ C = Σ(1 ÷ Cₙ) |
| Time constant | τ = RC |
| Discharge | V = V₀e^(−t/RC) |
| Half-life | t½ = 0.69 RC |

## Worked example 1

A 100 μF capacitor is charged to 5.0 V. Q = CV = 500 μC and E = ½CV² = **1.25 × 10⁻³ J**.

## Worked example 2

A 2.0 kΩ resistor discharges a 500 μF capacitor initially at 10 V. τ = RC = 1.0 s. After 2.0 s, V = 10e⁻² = **1.35 V**.`,
      },
      quiz: {
        title: "Electricity: Year 13 quiz (capacitors)",
        questions: [
          q13.single(1, "Which expression gives the unit of capacitance, the farad, in terms of other units?", "coulomb per volt", ["volt per coulomb", "joule per coulomb", "coulomb per second"], "C = Q ÷ V, so 1 F = 1 C V⁻¹."),
          q13.num(1, "A capacitor stores 2.4 mC of charge when the p.d. across it is 6.0 V. Calculate its capacitance, in μF.", 400, 1, "C = Q ÷ V = 2.4 × 10⁻³ ÷ 6.0 = 4.0 × 10⁻⁴ F = 400 μF."),
          q13.num(2, "A 470 μF capacitor is charged to 9.0 V. Calculate the energy stored, in mJ, to 3 significant figures.", 19, 0.05, "E = ½CV² = ½ × 470 × 10⁻⁶ × 9.0² = 0.0190 J = 19.0 mJ.", { diag: true }),
          q13.num(2, "A 220 μF capacitor discharges through a 47 kΩ resistor. Calculate the time constant, in s, to 3 significant figures.", 10.3, 0.05, "τ = RC = 47 × 10³ × 220 × 10⁻⁶ = 10.3 s."),
          q13.num(2, "The capacitor in the circuit is charged to 12 V and then the switch is closed so that it discharges through the resistor. Calculate the p.d. across the capacitor 30 s after the switch is closed, in V, to 3 significant figures.", 3.07, 0.02, "τ = RC = 22 × 10³ × 1000 × 10⁻⁶ = 22 s. V = V₀e^(−t/RC) = 12 × e^(−30/22) = 12 × 0.2555 = 3.07 V.", { diag: true, image: img("p5elec-y13-rc.png", "A circuit diagram of a capacitor discharging through a resistor. A 1000 microfarad capacitor is connected across a 22 kilohm resistor through a switch, with a voltmeter connected across the capacitor.") }),
          q13.num(2, "A 1.0 mF capacitor discharges through a 4.7 kΩ resistor. Calculate the time taken for its charge to fall to 25% of its initial value, in s, to 3 significant figures.", 6.52, 0.02, "τ = RC = 4.7 × 10³ × 1.0 × 10⁻³ = 4.7 s. Q = Q₀e^(−t/τ) so 0.25 = e^(−t/τ) and t = τ ln 4 = 4.7 × 1.386 = 6.52 s."),
          q13.num(2, "A 6.0 μF capacitor is connected in parallel with a combination of a 4.0 μF capacitor in series with a 12 μF capacitor. Calculate the total capacitance, in μF.", 9, 0.05, "Series part: 1 ÷ C = 1/4 + 1/12 = 1/3, so C = 3.0 μF. In parallel with 6.0 μF: total = 6.0 + 3.0 = 9.0 μF."),
          q13.num(3, "The graph shows how the p.d. across a 470 μF capacitor changes as it discharges through a resistor. Use the graph to find the resistance of the resistor, in kΩ, to 2 significant figures.", 6.4, 0.3, "V falls to 1/e of 9.0 V (3.3 V) at t = τ = 3.0 s. R = τ ÷ C = 3.0 ÷ 470 × 10⁻⁶ = 6.4 kΩ.", { image: img("p5elec-y13-discharge.png", "A graph of potential difference in volts against time in seconds for a discharging capacitor. The curve is a smooth exponential decay starting at 9.0 volts at time zero and falling towards zero over about 12 seconds.") }),
          q13.single(3, "A capacitor discharges through a resistor R. A graph of ln V against time t is a straight line. What is its gradient?", "−1 ÷ RC", ["−RC", "+1 ÷ RC", "−V₀ ÷ RC"], "Taking logs of V = V₀e^(−t/RC) gives ln V = ln V₀ − t ÷ RC. Compared with y = mx + c, the gradient is −1 ÷ RC and the intercept is ln V₀."),
          q13.num(3, "A camera flash uses a 120 μF capacitor charged to 300 V. All the stored energy is released in 1.0 ms. Calculate the average power of the flash, in W, to 2 significant figures.", 5400, 50, "E = ½CV² = ½ × 120 × 10⁻⁶ × 300² = 5.4 J. P = E ÷ t = 5.4 ÷ 1.0 × 10⁻³ = 5400 W."),
          q13.multi(2, "Which TWO statements about a capacitor discharging through a resistor are correct?", ["The p.d. across the capacitor falls exponentially", "The current has the same time constant as the charge and p.d."], ["The current stays constant until the capacitor is empty", "The p.d. falls linearly with time"], "The rate of discharge is proportional to the charge remaining, so Q, V and I all decay exponentially with the same time constant RC."),
          q13.num(3, "A 100 μF capacitor discharges through a resistor. The p.d. falls from 6.0 V to 2.2 V in 2.0 s. Calculate the resistance, in kΩ, to 3 significant figures.", 19.9, 0.1, "Ratio V₀ ÷ V = e^(t/RC), so t ÷ RC = ln(6.0 ÷ 2.2) = 1.003. RC = 2.0 ÷ 1.003 = 1.99 s. R = 1.99 ÷ 100 × 10⁻⁶ = 19.9 kΩ."),
          q13.single(2, "A capacitor discharges through a resistor. The resistance is doubled and the capacitance is unchanged. What happens to the time taken for the p.d. to fall to half its initial value?", "It doubles", ["It halves", "It stays the same", "It increases by a factor of 4"], "The time constant τ = RC is proportional to R, so doubling R doubles τ and doubles every discharge time, including the half-life 0.69 RC."),
          q13.written(3, "Describe how you would investigate the discharge of a capacitor through a resistor and use your results to determine the time constant of the circuit. [6 marks]", "Charge a capacitor from a known supply, then discharge it through a resistor while recording the p.d. with a voltmeter (or data logger) at regular time intervals with a stopwatch. Plot V against t, giving an exponential decay; find the time for the p.d. to fall to 37% of V₀ (= τ), or the half-life and use t½ = 0.69RC; or plot ln V against t, gradient −1/RC. Repeat, use a high-impedance voltmeter and choose RC large enough to time accurately.", "Mark scheme (max 6): circuit with capacitor, resistor, switch and voltmeter across the capacitor; charge the capacitor to a known p.d. then discharge through the resistor; record p.d. at regular time intervals (stopwatch or data logger); plot V against t (exponential curve) or ln V against t (straight line); time constant from the time to fall to V₀ ÷ e, or from the half-life (t½ = 0.69RC), or as −1 ÷ gradient of the ln V against t graph; improve accuracy by using a high-resistance voltmeter / long enough RC / repeating and averaging."),
        ],
      },
      flashcards: [
        { front: "Capacitance", back: "C = Q ÷ V (farad, F = C V⁻¹)." },
        { front: "Energy stored in a capacitor", back: "E = ½QV = ½CV² = Q² ÷ 2C (area under a Q–V graph)." },
        { front: "Capacitors in parallel and series", back: "Parallel: C = C₁ + C₂. Series: 1 ÷ C = 1 ÷ C₁ + 1 ÷ C₂." },
        { front: "Discharge equation", back: "Q = Q₀e^(−t/RC); V and I follow the same law." },
        { front: "Time constant", back: "τ = RC: the time for Q, V or I to fall to 1/e (37%) of its initial value." },
        { front: "Half-life of a discharge", back: "t½ = RC ln 2 = 0.69 RC." },
        { front: "ln V against t for a discharging capacitor", back: "Straight line, gradient −1 ÷ RC, intercept ln V₀." },
        { front: "Effect of doubling R on discharge time", back: "Time constant doubles, so discharge takes twice as long." },
        { front: "Initial discharge current", back: "I₀ = V₀ ÷ R." },
        { front: "Uses of capacitors", back: "Flash units (rapid energy release), smoothing rectified voltages, timing circuits, backup power." },
      ],
    },
  },
};
