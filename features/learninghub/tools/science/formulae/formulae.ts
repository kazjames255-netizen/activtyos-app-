// An original library of GCSE / KS3 science formulae as data — PURE. Every variable can be solved for.
export type FormulaGroup = "Motion" | "Forces" | "Energy" | "Electricity" | "Waves" | "Matter" | "Chemistry";
export const GROUP_ORDER: FormulaGroup[] = ["Motion", "Forces", "Energy", "Electricity", "Waves", "Matter", "Chemistry"];
export const G_FIELD = 9.8; // N/kg — weight and gravitational potential energy

export interface FVar { sym: string; name: string; unit: string; /** typical range for question generation */ lo: number; hi: number }
export type Values = Record<string, number>;
export interface Triangle { top: string; bottom: [string, string] }
export interface Formula {
  id: string; name: string; group: FormulaGroup;
  /** Equation in words. */ words: string;
  /** Symbol form. */ symbol: string;
  /** Short real-world scene used when writing questions. */ scene: string;
  vars: FVar[];
  /** The subject of the formula as written (vars[0]). */ subject: string;
  /** For each variable, the equation rearranged to make it the subject ("v = d ÷ t"). */ rearranged: Record<string, string>;
  /** Formula triangle where the relation is a plain product / quotient. */ triangle?: Triangle;
  /** Extra constraint on a generated set of values. */ valid?: (v: Values) => boolean;
  /** Solve for `variable` given values for ALL the others. Returns NaN if one is missing / not allowed. */
  solveFor: (variable: string, values: Values) => number;
}

type Fn = (v: Values) => number;
interface Def { id: string; name: string; group: FormulaGroup; words: string; symbol: string; scene: string; vars: FVar[]; solve: Record<string, Fn>; rearranged: Record<string, string>; triangle?: Triangle; valid?: (v: Values) => boolean }
function build(d: Def): Formula {
  const subject = d.vars[0]!.sym;
  return {
    id: d.id, name: d.name, group: d.group, words: d.words, symbol: d.symbol, scene: d.scene, vars: d.vars, subject, rearranged: d.rearranged, triangle: d.triangle, valid: d.valid,
    solveFor: (variable, values) => {
      const fn = d.solve[variable];
      if (!fn) return NaN;
      for (const x of d.vars) if (x.sym !== variable && !Number.isFinite(values[x.sym])) return NaN;
      const r = fn(values);
      return Number.isFinite(r) ? r : NaN;
    },
  };
}
const raw = (d: Def): Def => d;
const v = (sym: string, name: string, unit: string, lo: number, hi: number): FVar => ({ sym, name, unit, lo, hi });

/** out = a × b (× c …). */
function prod(o: Omit<Def, "solve" | "rearranged" | "triangle" | "symbol" | "vars" | "valid"> & { vars: FVar[]; valid?: Def["valid"] }): Def {
  const [out, ...fs] = o.vars.map((x) => x.sym) as [string, ...string[]];
  const solve: Record<string, Fn> = { [out]: (x) => fs.reduce((p, f) => p * x[f]!, 1) };
  const rearranged: Record<string, string> = { [out]: `${out} = ${fs.join(" × ")}` };
  for (const f of fs) {
    const others = fs.filter((g) => g !== f);
    solve[f] = (x) => x[out]! / others.reduce((p, g) => p * x[g]!, 1);
    rearranged[f] = `${f} = ${out} ÷ ${others.length > 1 ? `(${others.join(" × ")})` : others[0]}`;
  }
  return { ...o, symbol: rearranged[out]!, solve, rearranged, triangle: fs.length === 2 ? { top: out, bottom: [fs[0]!, fs[1]!] } : undefined };
}
/** out = num ÷ den (× k). */
function quo(o: Omit<Def, "solve" | "rearranged" | "triangle" | "symbol" | "valid"> & { num: string; den: string; k?: number; valid?: Def["valid"] }): Def {
  const { num, den, k = 1, ...rest } = o;
  const out = o.vars[0]!.sym, tail = k === 1 ? "" : ` × ${k}`, div = k === 1 ? "" : ` ÷ ${k}`;
  const solve: Record<string, Fn> = {
    [out]: (x) => (x[num]! / x[den]!) * k,
    [num]: (x) => (x[out]! * x[den]!) / k,
    [den]: (x) => (x[num]! * k) / x[out]!,
  };
  const rearranged: Record<string, string> = { [out]: `${out} = ${num} ÷ ${den}${tail}`, [num]: `${num} = ${out} × ${den}${div}`, [den]: `${den} = ${num}${tail} ÷ ${out}` };
  return { ...rest, symbol: rearranged[out]!, solve, rearranged, triangle: k === 1 ? { top: num, bottom: [out, den] } : undefined };
}

const DEFS: Def[] = [
  quo({ id: "speed", name: "Speed", group: "Motion", words: "speed = distance ÷ time", scene: "A cyclist rides along a straight cycle path.", num: "d", den: "t",
    vars: [v("v", "speed", "m/s", 1, 40), v("d", "distance travelled", "m", 10, 5000), v("t", "time taken", "s", 2, 600)] }),
  quo({ id: "acceleration", name: "Acceleration", group: "Motion", words: "acceleration = change in velocity ÷ time", scene: "A tram pulls away from a stop.", num: "Δv", den: "t",
    vars: [v("a", "acceleration", "m/s²", 0.5, 12), v("Δv", "change in velocity", "m/s", 2, 40), v("t", "time taken", "s", 1, 20)] }),
  raw({ id: "period", name: "Frequency and period", group: "Waves", words: "frequency = 1 ÷ time period", symbol: "f = 1 ÷ T", scene: "A pendulum swings back and forth in a science lab.",
    vars: [v("f", "frequency", "Hz", 0.5, 1000), v("T", "time period", "s", 0.001, 2)],
    solve: { f: (x) => 1 / x.T!, T: (x) => 1 / x.f! }, rearranged: { f: "f = 1 ÷ T", T: "T = 1 ÷ f" }, triangle: undefined }),
  prod({ id: "force", name: "Force (Newton's second law)", group: "Forces", words: "force = mass × acceleration", scene: "A trolley is pushed along a smooth bench.",
    vars: [v("F", "resultant force", "N", 5, 2000), v("m", "mass", "kg", 0.5, 1500), v("a", "acceleration", "m/s²", 0.5, 12)] }),
  prod({ id: "weight", name: "Weight", group: "Forces", words: "weight = mass × gravitational field strength", scene: "A rock sample is weighed on a newton meter on Earth.",
    vars: [v("W", "weight", "N", 5, 900), v("m", "mass", "kg", 0.5, 90), v("g", "gravitational field strength", "N/kg", G_FIELD, G_FIELD)] }),
  quo({ id: "pressure", name: "Pressure", group: "Forces", words: "pressure = force ÷ area", scene: "A box rests on a table top.", num: "F", den: "A",
    vars: [v("p", "pressure", "Pa", 100, 500000), v("F", "force", "N", 10, 2000), v("A", "area", "m²", 0.001, 2)] }),
  prod({ id: "moment", name: "Moment of a force", group: "Forces", words: "moment = force × perpendicular distance from the pivot", scene: "A spanner is used to turn a stiff nut.",
    vars: [v("M", "moment", "Nm", 1, 500), v("F", "force", "N", 5, 500), v("d", "perpendicular distance from the pivot", "m", 0.05, 3)] }),
  prod({ id: "spring", name: "Spring (Hooke's law)", group: "Forces", words: "force = spring constant × extension", scene: "A spring hangs from a clamp stand in a lab.",
    vars: [v("F", "force", "N", 1, 100), v("k", "spring constant", "N/m", 5, 500), v("e", "extension", "m", 0.01, 0.5)] }),
  prod({ id: "work", name: "Work done", group: "Energy", words: "work done = force × distance moved", scene: "A worker drags a crate across a warehouse floor.",
    vars: [v("W", "work done", "J", 10, 50000), v("F", "force", "N", 5, 2000), v("d", "distance moved", "m", 1, 100)] }),
  raw({ id: "ke", name: "Kinetic energy", group: "Energy", words: "kinetic energy = ½ × mass × speed²", symbol: "E = ½ × m × v²", scene: "A skateboarder rolls down a ramp.",
    vars: [v("E", "kinetic energy", "J", 1, 500000), v("m", "mass", "kg", 0.1, 1500), v("v", "speed", "m/s", 1, 30)],
    solve: { E: (x) => 0.5 * x.m! * x.v! ** 2, m: (x) => (2 * x.E!) / x.v! ** 2, v: (x) => Math.sqrt((2 * x.E!) / x.m!) },
    rearranged: { E: "E = ½ × m × v²", m: "m = 2 × E ÷ v²", v: "v = √(2 × E ÷ m)" } }),
  prod({ id: "gpe", name: "Gravitational potential energy", group: "Energy", words: "gravitational potential energy = mass × gravitational field strength × height", scene: "A climber carries a rucksack up a cliff path.",
    vars: [v("E", "gravitational potential energy", "J", 5, 50000), v("m", "mass", "kg", 0.5, 80), v("g", "gravitational field strength", "N/kg", G_FIELD, G_FIELD), v("h", "height gained", "m", 0.5, 50)] }),
  quo({ id: "power-work", name: "Power (from work done)", group: "Energy", words: "power = work done ÷ time", scene: "A motor lifts a load in a workshop.", num: "W", den: "t",
    vars: [v("P", "power", "W", 5, 5000), v("W", "work done", "J", 50, 100000), v("t", "time taken", "s", 1, 600)] }),
  quo({ id: "power-energy", name: "Power (from energy transferred)", group: "Energy", words: "power = energy transferred ÷ time", scene: "A kettle heats water in a kitchen.", num: "E", den: "t",
    vars: [v("P", "power", "W", 5, 5000), v("E", "energy transferred", "J", 50, 500000), v("t", "time taken", "s", 1, 600)] }),
  quo({ id: "efficiency", name: "Efficiency", group: "Energy", words: "efficiency (%) = useful energy out ÷ total energy in × 100", scene: "A small electric motor lifts a weight.", num: "U", den: "T", k: 100,
    vars: [v("η", "efficiency", "%", 5, 95), v("U", "useful energy transferred", "J", 5, 500), v("T", "total energy supplied", "J", 10, 1000)], valid: (x) => x.U! < x.T! && x.U! / x.T! > 0.04 }),
  prod({ id: "shc", name: "Specific heat capacity", group: "Energy", words: "energy change = mass × specific heat capacity × temperature change", scene: "A block of metal is warmed by an electric heater.",
    vars: [v("ΔE", "thermal energy change", "J", 100, 500000), v("m", "mass", "kg", 0.1, 5), v("c", "specific heat capacity", "J/kg°C", 130, 4200), v("Δθ", "temperature change", "°C", 1, 80)] }),
  prod({ id: "ohm", name: "Ohm's law", group: "Electricity", words: "potential difference = current × resistance", scene: "A resistor is connected in a simple circuit.",
    vars: [v("V", "potential difference", "V", 1, 24), v("I", "current", "A", 0.05, 10), v("R", "resistance", "Ω", 1, 1000)] }),
  prod({ id: "charge", name: "Charge flow", group: "Electricity", words: "charge = current × time", scene: "A lamp is left on in a circuit.",
    vars: [v("Q", "charge", "C", 1, 3000), v("I", "current", "A", 0.05, 10), v("t", "time", "s", 1, 600)] }),
  prod({ id: "power-iv", name: "Electrical power", group: "Electricity", words: "power = current × potential difference", scene: "A hairdryer is plugged into a mains socket.",
    vars: [v("P", "power", "W", 1, 3000), v("I", "current", "A", 0.05, 13), v("V", "potential difference", "V", 1.5, 240)] }),
  prod({ id: "energy-pt", name: "Energy transferred (power × time)", group: "Electricity", words: "energy transferred = power × time", scene: "A heater is switched on in a cold room.",
    vars: [v("E", "energy transferred", "J", 10, 3000000), v("P", "power", "W", 10, 3000), v("t", "time", "s", 1, 3600)] }),
  prod({ id: "energy-qv", name: "Energy transferred (charge × p.d.)", group: "Electricity", words: "energy transferred = charge × potential difference", scene: "Charge flows through a battery-powered buzzer.",
    vars: [v("E", "energy transferred", "J", 1.5, 230000), v("Q", "charge", "C", 1, 1000), v("V", "potential difference", "V", 1.5, 230)] }),
  prod({ id: "wave", name: "Wave speed", group: "Waves", words: "wave speed = frequency × wavelength", scene: "Ripples travel across a ripple tank.",
    vars: [v("v", "wave speed", "m/s", 0.1, 340), v("f", "frequency", "Hz", 1, 5000), v("λ", "wavelength", "m", 0.01, 100)] }),
  quo({ id: "magnification", name: "Magnification", group: "Waves", words: "magnification = image size ÷ real (object) size", scene: "A student views a cell through a microscope.", num: "I", den: "O",
    vars: [v("M", "magnification", "", 2, 400), v("I", "image size", "mm", 1, 200), v("O", "real size", "mm", 0.01, 20)] }),
  quo({ id: "density", name: "Density", group: "Matter", words: "density = mass ÷ volume", scene: "A solid block is measured in a materials lab.", num: "m", den: "V",
    vars: [v("ρ", "density", "kg/m³", 500, 19000), v("m", "mass", "kg", 0.05, 5000), v("V", "volume", "m³", 0.00005, 2)] }),
  quo({ id: "moles", name: "Moles", group: "Chemistry", words: "moles = mass ÷ relative formula mass", scene: "A chemist weighs out a sample of a compound.", num: "m", den: "Mr",
    vars: [v("n", "amount", "mol", 0.001, 5), v("m", "mass", "g", 1, 500), v("Mr", "relative formula mass", "g/mol", 2, 250)] }),
  quo({ id: "concentration", name: "Concentration", group: "Chemistry", words: "concentration = mass of solute ÷ volume of solution", scene: "A technician dissolves a solid to make a solution.", num: "m", den: "V",
    vars: [v("c", "concentration", "g/dm³", 1, 300), v("m", "mass of solute", "g", 0.1, 100), v("V", "volume of solution", "dm³", 0.05, 2)] }),
  quo({ id: "yield", name: "Percentage yield", group: "Chemistry", words: "percentage yield = actual yield ÷ theoretical yield × 100", scene: "A student makes a salt by neutralisation and dries the crystals.", num: "A", den: "T", k: 100,
    vars: [v("Y", "percentage yield", "%", 5, 100), v("A", "actual yield", "g", 0.5, 50), v("T", "theoretical yield", "g", 1, 100)], valid: (x) => x.A! <= x.T! && x.A! / x.T! > 0.04 }),
  raw({ id: "pct-change", name: "Percentage change", group: "Chemistry", words: "percentage change = (new value − old value) ÷ old value × 100", symbol: "p = (N − O) ÷ O × 100", scene: "A student records the mass of a sample before and after an experiment.",
    vars: [v("p", "percentage change", "%", -90, 300), v("N", "new value", "", 5, 500), v("O", "old value", "", 5, 500)],
    solve: { p: (x) => ((x.N! - x.O!) / x.O!) * 100, N: (x) => x.O! * (1 + x.p! / 100), O: (x) => x.N! / (1 + x.p! / 100) },
    rearranged: { p: "p = (N − O) ÷ O × 100", N: "N = O × (1 + p ÷ 100)", O: "O = N ÷ (1 + p ÷ 100)" },
    valid: (x) => Math.abs(x.N! - x.O!) / x.O! > 0.02 && x.N! / x.O! < 5 }),
];
// The pupil-facing symbol for the unknown subject in `build`-made entries is already set above; prod/quo entries carry vars[0] as subject.

export const FORMULAE: Formula[] = DEFS.map(build);
export const formulaById = (id: string): Formula | undefined => FORMULAE.find((f) => f.id === id);
export const formulaeByGroup = (g: FormulaGroup): Formula[] => FORMULAE.filter((f) => f.group === g);
export const varOf = (f: Formula, sym: string): FVar => f.vars.find((x) => x.sym === sym) ?? f.vars[0]!;
