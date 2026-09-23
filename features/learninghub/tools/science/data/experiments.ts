// An original bank of KS3/KS4 practical datasets for the results-table-and-graph tool. Readings are generated once, deterministically
// (seeded noise around a known law, plus at most one planted anomaly), so every load is identical and the bank can be self-tested.
import { makeRng } from "../../engine/rng";
import type { Row } from "./graph";

export type Relationship = "linear" | "proportional" | "inverse" | "curve";
export interface Quantity { name: string; unit: string }
export interface Experiment {
  id: string; title: string; topic: string;
  independent: Quantity; dependent: Quantity; controls: string[];
  repeats: number; rows: Row[];
  relationship: Relationship;
  /** [rowIndex, repIndex] of the planted anomaly (none or one). */
  anomalies: [number, number][];
  /** Tutor prompt about the pattern (never contains the answer coordinates). */
  question: string;
}
interface Spec {
  id: string; title: string; topic: string; independent: Quantity; dependent: Quantity; controls: string[];
  xs: number[]; f: (x: number) => number; noise: number; dp: number; repeats?: number;
  relationship: Relationship; anomaly?: { row: number; rep: number; factor: number }; question: string; seed: number;
}
function build(s: Spec): Experiment {
  const rng = makeRng(s.seed), reps = s.repeats ?? 3, k = 10 ** s.dp;
  const rows: Row[] = s.xs.map((x, i) => ({
    x,
    reps: Array.from({ length: reps }, (_, j) => {
      let v = s.f(x) * (1 + rng.float(-s.noise, s.noise));
      if (s.anomaly && s.anomaly.row === i && s.anomaly.rep === j) v *= s.anomaly.factor;
      return Math.round(v * k) / k;
    }),
  }));
  return { id: s.id, title: s.title, topic: s.topic, independent: s.independent, dependent: s.dependent, controls: s.controls, repeats: reps, rows, relationship: s.relationship, anomalies: s.anomaly ? [[s.anomaly.row, s.anomaly.rep]] : [], question: s.question };
}
const q = (name: string, unit: string): Quantity => ({ name, unit });

const SPECS: Spec[] = [
  { id: "spring-mass", title: "Stretching a spring with masses", topic: "Forces", independent: q("Mass hung on spring", "g"), dependent: q("Extension of spring", "mm"), controls: ["same spring", "same ruler, read at eye level", "wait for the spring to stop bouncing"],
    xs: [50, 100, 150, 200, 250, 300], f: (m) => 0.26 * m, noise: 0.025, dp: 1, relationship: "proportional", anomaly: { row: 3, rep: 1, factor: 1.35 }, seed: 101, question: "What happens to the extension each time the mass goes up by the same amount?" },
  { id: "ohmic-resistor", title: "Current through a fixed resistor", topic: "Electricity", independent: q("Potential difference", "V"), dependent: q("Current", "mA"), controls: ["same resistor", "wire kept cool by switching off between readings", "same ammeter"],
    xs: [1, 2, 3, 4, 5, 6], f: (v) => 21.3 * v, noise: 0.02, dp: 1, relationship: "proportional", seed: 102, question: "Is the current proportional to the potential difference? How can you tell from the graph?" },
  { id: "cooling-water", title: "Cooling of hot water", topic: "Energy", independent: q("Time", "min"), dependent: q("Temperature of water", "°C"), controls: ["same volume of water", "same beaker and lid", "same room"],
    xs: [0, 2, 4, 6, 8, 10, 12], f: (t) => 20 + 62 * Math.exp(-t / 9), noise: 0.012, dp: 1, relationship: "curve", anomaly: { row: 4, rep: 2, factor: 0.8 }, seed: 103, question: "Is the water cooling fastest at the start or the end? Explain using the steepness of the curve." },
  { id: "rate-conc", title: "Rate of reaction and acid concentration", topic: "Chemistry: rates", independent: q("Concentration of acid", "mol/dm³"), dependent: q("Rate of gas production", "cm³/s"), controls: ["same mass of magnesium", "same volume of acid", "same temperature"],
    xs: [0.2, 0.4, 0.6, 0.8, 1.0, 1.2], f: (c) => 2.1 * c, noise: 0.025, dp: 2, relationship: "proportional", anomaly: { row: 2, rep: 0, factor: 1.4 }, seed: 104, question: "What does the graph say happens to the rate when the concentration doubles?" },
  { id: "bounce-height", title: "Bounce height of a ball", topic: "Energy", independent: q("Drop height", "cm"), dependent: q("Bounce height", "cm"), controls: ["same ball", "same hard floor", "read bounce at eye level against a metre rule"],
    xs: [20, 40, 60, 80, 100], f: (h) => 0.62 * h, noise: 0.03, dp: 1, repeats: 4, relationship: "proportional", seed: 105, question: "What fraction of the drop height does the ball bounce back to? Where did the rest of the energy go?" },
  { id: "plant-light", title: "Plant growth and distance from a lamp", topic: "Biology: photosynthesis", independent: q("Distance from lamp", "cm"), dependent: q("Growth in a week", "mm"), controls: ["same type of seedling", "same water each day", "same lamp"],
    xs: [10, 20, 30, 40, 50, 60], f: (d) => 900 / d, noise: 0.025, dp: 1, relationship: "inverse", seed: 106, question: "As the lamp moves further away what happens to the growth? Is the pattern a straight line?" },
  { id: "trolley-steady", title: "Trolley at steady speed", topic: "Motion", independent: q("Time", "s"), dependent: q("Distance travelled", "m"), controls: ["same trolley", "level track", "same fan-cart push"],
    xs: [1, 2, 3, 4, 5, 6], f: (t) => 0.35 * t, noise: 0.025, dp: 2, relationship: "proportional", anomaly: { row: 1, rep: 2, factor: 0.7 }, seed: 107, question: "What does the gradient of a distance-time graph tell you?" },
  { id: "trolley-ramp", title: "Trolley speeding up down a ramp", topic: "Motion", independent: q("Time", "s"), dependent: q("Distance down ramp", "m"), controls: ["same ramp angle", "same trolley", "timing gates at each distance"],
    xs: [0.5, 1.0, 1.5, 2.0, 2.5, 3.0], f: (t) => 0.42 * t * t, noise: 0.03, dp: 3, relationship: "curve", seed: 108, question: "Why does the line curve upwards rather than being straight?" },
  { id: "rubber-band", title: "Stretching a rubber band", topic: "Forces", independent: q("Force", "N"), dependent: q("Extension", "cm"), controls: ["same rubber band", "same starting length", "measure from the same mark"],
    xs: [1, 2, 3, 4, 5, 6, 7], f: (n) => 1.1 * n + 0.09 * n ** 3 / 2, noise: 0.02, dp: 2, relationship: "curve", anomaly: { row: 5, rep: 0, factor: 1.25 }, seed: 109, question: "Does the rubber band obey Hooke's law? Look at the shape of the graph." },
  { id: "filament-lamp", title: "Current through a filament lamp", topic: "Electricity", independent: q("Potential difference", "V"), dependent: q("Current", "mA"), controls: ["same lamp", "same ammeter", "switch off between readings"],
    xs: [1, 2, 3, 4, 5, 6], f: (v) => 58 * Math.sqrt(v), noise: 0.02, dp: 1, relationship: "curve", seed: 110, question: "What happens to the resistance as the filament gets hotter?" },
  { id: "pendulum-length", title: "Swing time of a pendulum", topic: "Motion", independent: q("Length of string", "cm"), dependent: q("Time for one swing", "s"), controls: ["same bob mass", "same small angle of release", "time 10 swings and divide by 10"],
    xs: [20, 40, 60, 80, 100], f: (l) => 2 * Math.PI * Math.sqrt(l / 100 / 9.81), noise: 0.015, dp: 2, relationship: "curve", anomaly: { row: 2, rep: 1, factor: 1.25 }, seed: 111, question: "Does doubling the length double the time for a swing?" },
  { id: "gas-pressure", title: "Pressure of a trapped gas", topic: "Particles", independent: q("Volume of gas", "cm³"), dependent: q("Pressure", "kPa"), controls: ["same temperature", "same amount of trapped air", "let the gauge settle"],
    xs: [20, 25, 30, 40, 50, 60], f: (v) => 4800 / v, noise: 0.02, dp: 0, relationship: "inverse", seed: 112, question: "When the volume is halved what happens to the pressure?" },
  { id: "salt-solubility", title: "Solubility of a salt", topic: "Chemistry: solutions", independent: q("Water temperature", "°C"), dependent: q("Mass dissolved in 100 g water", "g"), controls: ["same mass of water", "stir the same way", "add salt until no more dissolves"],
    xs: [10, 20, 30, 40, 50, 60, 70], f: (t) => 24 + 0.55 * t, noise: 0.015, dp: 1, relationship: "linear", anomaly: { row: 4, rep: 2, factor: 0.8 }, seed: 113, question: "The line does not pass through the origin. What does the intercept tell you?" },
  { id: "catalase-temp", title: "Enzyme activity and temperature", topic: "Biology: enzymes", independent: q("Temperature", "°C"), dependent: q("Bubbles of oxygen in a minute", ""), controls: ["same volume of hydrogen peroxide", "same piece of liver", "water bath held steady"],
    xs: [10, 20, 30, 40, 50, 60], f: (t) => 18 + 132 * Math.exp(-(((t - 38) / 14) ** 2)), noise: 0.02, dp: 0, relationship: "curve", seed: 114, question: "Why does the rate fall after a peak? Where would you draw the curve (not a straight line)?" },
  { id: "wire-resistance", title: "Resistance of a wire", topic: "Electricity", independent: q("Length of wire", "cm"), dependent: q("Resistance", "Ω"), controls: ["same wire material and thickness", "low current so the wire stays cool", "same meter"],
    xs: [20, 40, 60, 80, 100], f: (l) => 0.055 * l, noise: 0.025, dp: 2, relationship: "proportional", seed: 115, question: "What happens to the resistance when the wire is twice as long?" },
  { id: "photosynthesis-lamp", title: "Pondweed bubbles and lamp distance", topic: "Biology: photosynthesis", independent: q("Distance of lamp", "cm"), dependent: q("Bubbles per minute", ""), controls: ["same piece of pondweed", "same water temperature", "count for the same length of time"],
    xs: [10, 15, 20, 30, 40], f: (d) => 6400 / (d * d), noise: 0.025, dp: 1, relationship: "inverse", anomaly: { row: 1, rep: 0, factor: 1.4 }, seed: 116, question: "The bubbles fall quickly and then level out. What does this tell you about the effect of light?" },
];
export const EXPERIMENTS: Experiment[] = SPECS.map(build);
export const experimentById = (id: string) => EXPERIMENTS.find((e) => e.id === id);
