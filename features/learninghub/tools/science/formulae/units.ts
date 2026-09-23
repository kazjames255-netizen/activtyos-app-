// Unit helpers for the formula calculator — PURE (no React, no DOM).
import { toSF } from "../../engine/quantity";
import type { Rng } from "../../engine/rng";

export { toSF };

/** [symbol, dimension, factor to the dimension's SI-style base]. */
const TABLE: [string, string, number][] = [
  ["km", "length", 1000], ["m", "length", 1], ["cm", "length", 0.01], ["mm", "length", 0.001], ["µm", "length", 1e-6], ["nm", "length", 1e-9],
  ["t", "mass", 1000], ["kg", "mass", 1], ["g", "mass", 0.001], ["mg", "mass", 1e-6],
  ["h", "time", 3600], ["min", "time", 60], ["s", "time", 1], ["ms", "time", 1e-3], ["µs", "time", 1e-6],
  ["MJ", "energy", 1e6], ["kJ", "energy", 1e3], ["J", "energy", 1],
  ["MW", "power", 1e6], ["kW", "power", 1e3], ["W", "power", 1],
  ["kN", "force", 1e3], ["N", "force", 1],
  ["MPa", "pressure", 1e6], ["kPa", "pressure", 1e3], ["Pa", "pressure", 1],
  ["kV", "voltage", 1e3], ["V", "voltage", 1], ["mV", "voltage", 1e-3],
  ["A", "current", 1], ["mA", "current", 1e-3], ["µA", "current", 1e-6],
  ["GHz", "frequency", 1e9], ["MHz", "frequency", 1e6], ["kHz", "frequency", 1e3], ["Hz", "frequency", 1],
  ["m³", "volume", 1], ["dm³", "volume", 1e-3], ["L", "volume", 1e-3], ["cm³", "volume", 1e-6], ["mL", "volume", 1e-6], ["mm³", "volume", 1e-9],
  ["m²", "area", 1], ["cm²", "area", 1e-4], ["mm²", "area", 1e-6],
  ["MΩ", "resistance", 1e6], ["kΩ", "resistance", 1e3], ["Ω", "resistance", 1],
  ["kC", "charge", 1e3], ["C", "charge", 1], ["mC", "charge", 1e-3],
  ["mol", "amount", 1], ["mmol", "amount", 1e-3],
  ["m/s", "speed", 1], ["km/h", "speed", 1 / 3.6], ["cm/s", "speed", 0.01], ["mph", "speed", 0.44704],
  ["m/s²", "acceleration", 1],
  ["kg/m³", "density", 1], ["g/cm³", "density", 1000],
  ["g/dm³", "concentration", 1], ["mg/cm³", "concentration", 1],
  ["N/kg", "gfield", 1],
  ["N/m", "spring", 1], ["N/cm", "spring", 100], ["N/mm", "spring", 1000],
  ["Nm", "moment", 1], ["Ncm", "moment", 0.01],
  ["J/kg°C", "shc", 1], ["kJ/kg°C", "shc", 1000],
  ["°C", "dtemp", 1], ["K", "dtemp", 1],
  ["g/mol", "molarmass", 1], ["kg/mol", "molarmass", 1000],
  ["%", "percent", 1],
];
const BY_SYMBOL = new Map(TABLE.map(([s, d, f]) => [s.trim(), { symbol: s.trim(), dim: d, factor: f }]));
const ALIAS: Record<string, string> = {
  "ms-1": "m/s", "m s-1": "m/s", "m s^-1": "m/s", "ms^-1": "m/s", "kmh-1": "km/h", "km/hr": "km/h", "ohm": "Ω", "ohms": "Ω", "u": "µ",
  "j/kgc": "J/kg°C", "j/kg°c": "J/kg°C", "j/(kg°c)": "J/kg°C", "j/kg c": "J/kg°C", "kj/kg°c": "kJ/kg°C", "kj/kgc": "kJ/kg°C",
  "n m": "Nm", "n cm": "Ncm", "sec": "s", "secs": "s", "hr": "h", "hrs": "h", "hour": "h", "hours": "h", "minute": "min", "minutes": "min", "second": "s", "seconds": "s",
  "litre": "L", "liter": "L", "litres": "L", "ml": "mL", "l": "L", "c": "°C", "degc": "°C", "°c": "°C", "deg c": "°C",
  "newton": "N", "newtons": "N", "joule": "J", "joules": "J", "watt": "W", "watts": "W", "volt": "V", "volts": "V", "amp": "A", "amps": "A", "metre": "m", "metres": "m", "meter": "m", "meters": "m",
};
export interface UnitInfo { symbol: string; dim: string; factor: number }

/** Find a unit from what a pupil typed ("cm3", "km/h", "kW", "ohm", "m s-1"). null if unknown; "" is the dimensionless unit. */
export function findUnit(text: string): UnitInfo | null {
  let s = text.trim().replace(/\^?3$/, (m, off: number, all: string) => (/m$/i.test(all.slice(0, off)) ? "³" : m)).replace(/\^?2$/, (m, off: number, all: string) => (/[ms]$/i.test(all.slice(0, off)) ? "²" : m));
  s = s.replace(/^u(?=[mgsA])/, "µ").replace(/μ/g, "µ");
  if (s === "") return { symbol: "", dim: "none", factor: 1 };
  const exact = BY_SYMBOL.get(s);
  if (exact) return exact;
  const alias = ALIAS[s.toLowerCase()];
  if (alias) return BY_SYMBOL.get(alias) ?? null;
  const lower = s.toLowerCase();
  for (const [sym, info] of BY_SYMBOL) if (sym.toLowerCase() === lower) return info;
  return null;
}

/** Unit choices sharing the dimension of `unit` (for a selector). Dimensionless → [""]. */
export function unitOptions(unit: string): string[] {
  const u = findUnit(unit);
  if (!u || u.dim === "none") return [unit];
  return [...BY_SYMBOL.values()].filter((x) => x.dim === u.dim).sort((a, b) => b.factor - a.factor).map((x) => x.symbol);
}

/** Convert between two units of the same dimension; null when they are not compatible (e.g. cm → s). */
export function convertUnit(value: number, from: string, to: string): number | null {
  const a = findUnit(from), b = findUnit(to);
  if (!a || !b || a.dim !== b.dim) return null;
  return (value * a.factor) / b.factor;
}

const SUP: Record<string, string> = { "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹", "-": "⁻" };
export const superscript = (n: number | string): string => String(n).replace(/[0-9-]/g, (c) => SUP[c] ?? c);

/** Standard form: 32000 → "3.2 × 10⁴". `sf` (optional) fixes the number of significant figures shown ("3.20 × 10⁴"). */
export function standardForm(v: number, sf?: number): string {
  if (!Number.isFinite(v)) return String(v);
  if (v === 0) return "0";
  const [m, e] = (sf ? v.toExponential(Math.max(0, sf - 1)) : v.toExponential()).split("e");
  return `${m} × 10${superscript(Number(e))}`;
}

/** Round to n s.f. and WRITE it to n s.f. (trailing zeros kept): 2.5 @3 → "2.50"; 12000 @3 → "1.20 × 10⁴". */
export function formatSF(v: number, sf: number): string {
  if (!Number.isFinite(v)) return String(v);
  if (v === 0) return "0";
  const n = Math.max(1, sf), exp = Number(v.toExponential(n - 1).split("e")[1]);
  if (exp >= n || exp < -3) return standardForm(v, n);
  return v.toFixed(Math.max(0, n - 1 - exp));
}
/** A tidy number for showing given values: plain, or standard form when very big / small. */
export function formatNum(v: number): string {
  if (!Number.isFinite(v)) return String(v);
  if (v === 0) return "0";
  const a = Math.abs(v);
  if (a >= 1e6 || a < 1e-3) return standardForm(toSF(v, 10));
  return String(toSF(v, 10));
}

/** Read what a pupil typed into a value box: "20", "20 cm", "3.2 × 10^4", "3e4 J". A typed unit beats the selector. Returns the value in `baseUnit`. */
export function readValue(text: string, selectedUnit: string, baseUnit: string): { value: number; unit: string } | { error: string } {
  const s = text.trim().replace(/−|–/g, "-").replace(/,(?=\d{3}\b)/g, "").replace(/\s*[×x*]\s*10\s*\^?\s*(-?\d+)/i, "e$1").replace(/\s*[×x*]\s*10([⁰¹²³⁴⁵⁶⁷⁸⁹⁻]+)/, (_m, sup: string) => "e" + [...sup].map((c) => Object.keys(SUP).find((k) => SUP[k] === c) ?? "").join(""));
  const m = /^(-?\d*\.?\d+(?:e-?\d+)?)\s*(.*)$/i.exec(s);
  if (!m) return { error: "Type a number" };
  const n = Number(m[1]);
  if (!Number.isFinite(n)) return { error: "Type a number" };
  const typed = (m[2] ?? "").trim();
  const unit = typed || selectedUnit;
  const c = convertUnit(n, unit, baseUnit);
  if (c === null) return baseUnit === "" && !typed ? { value: n, unit: "" } : { error: `“${unit}” does not match ${baseUnit || "a plain number"}` };
  return { value: c, unit };
}

/** A "sensible" random value in [lo, hi]: log-spread when the range is wide, rounded to `sf` s.f., always inside the range. */
export function sensibleValue(rng: Rng, lo: number, hi: number, sf = 2): number {
  if (lo === hi) return lo;
  const raw = hi / lo > 20 ? Math.exp(rng.float(Math.log(lo), Math.log(hi))) : rng.float(lo, hi);
  return Math.min(hi, Math.max(lo, toSF(raw, sf)));
}
export const sensibleValues = (rng: Rng, ranges: { lo: number; hi: number }[], sf = 2): number[] => ranges.map((r) => sensibleValue(rng, r.lo, r.hi, sf));
