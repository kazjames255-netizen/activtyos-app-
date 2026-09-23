// Marking numbers WITH units (science/maths): "12.5 m/s", "3.2 × 10^4 J", significant figures — plan v2 checkers `numericUnitSF`, `sequence`, `setMatch`.
import { combine, type CheckResult } from "./marking";

export interface Quantity { value: number; unit: string }

const UNIT_ALIASES: Record<string, string> = {
  "m/s": "m/s", "ms-1": "m/s", "m s-1": "m/s", "m s^-1": "m/s", "ms^-1": "m/s", "metres per second": "m/s", "meters per second": "m/s",
  "km/h": "km/h", "kmh-1": "km/h", "mph": "mph", "n": "N", "newton": "N", "newtons": "N", "j": "J", "joule": "J", "joules": "J", "kj": "kJ", "w": "W", "watt": "W", "watts": "W", "kw": "kW",
  "pa": "Pa", "pascal": "Pa", "pascals": "Pa", "v": "V", "volt": "V", "volts": "V", "a": "A", "amp": "A", "amps": "A", "ampere": "A", "ohm": "Ω", "ohms": "Ω", "ω": "Ω",
  "kg": "kg", "g": "g", "mg": "mg", "m": "m", "cm": "cm", "mm": "mm", "km": "km", "s": "s", "sec": "s", "seconds": "s", "min": "min", "h": "h", "hz": "Hz", "khz": "kHz",
  "m/s2": "m/s²", "m/s^2": "m/s²", "ms-2": "m/s²", "m/s²": "m/s²", "n/kg": "N/kg", "kg/m3": "kg/m³", "kg/m^3": "kg/m³", "g/cm3": "g/cm³", "g/cm^3": "g/cm³",
  "°c": "°C", "c": "°C", "degrees c": "°C", "k": "K", "mol": "mol", "cm3": "cm³", "cm^3": "cm³", "m2": "m²", "m^2": "m²", "m3": "m³", "m^3": "m³", "%": "%", "°": "°", "degrees": "°",
};
export const normUnit = (u: string): string => { const k = u.trim().toLowerCase().replace(/\s+/g, " ").replace(/⁻¹/g, "-1").replace(/⁻²/g, "-2"); return UNIT_ALIASES[k] ?? UNIT_ALIASES[k.replace(/ /g, "")] ?? u.trim(); };

/** Parse "12.5 m/s", "3.2e4 J", "3.2 × 10^4 J", "1,200 g", "−4 °C". Returns null when there is no number. */
export function parseQuantity(input: string | number): { value: number; unit: string; sf: number } | null {
  if (typeof input === "number") return Number.isFinite(input) ? { value: input, unit: "", sf: sigFigsOf(String(input)) } : null;
  const s = input.trim().replace(/−|–/g, "-").replace(/,(?=\d{3}\b)/g, "").replace(/\s*[×x*]\s*10\s*\^?\s*(-?\d+)/i, "e$1");
  const m = /^(-?\d*\.?\d+(?:e-?\d+)?)\s*(.*)$/i.exec(s);
  if (!m) return null;
  const value = Number(m[1]);
  return Number.isFinite(value) ? { value, unit: normUnit(m[2] ?? ""), sf: sigFigsOf(m[1]!) } : null;
}
/** Significant figures as WRITTEN ("0.0450" → 3, "1200" → 2 (trailing zeros ambiguous), "3.20e4" → 3). */
export function sigFigsOf(text: string): number {
  const t = text.replace(/^[-+]/, "").replace(/e.*$/i, "");
  if (t.includes(".")) return t.replace(".", "").replace(/^0+/, "").length || 1;
  return t.replace(/^0+/, "").replace(/0+$/, "").length || 1;
}
/** Round to n significant figures. */
export const toSF = (v: number, n: number) => (v === 0 ? 0 : Number(v.toPrecision(Math.max(1, n))));

export interface QuantityOpts {
  /** Accept within ±pct % of the expected value (default 0 → uses sigFigs / abs). */
  tolPct?: number; abs?: number;
  /** Require the answer to be given to exactly this many significant figures (e.g. "3 s.f."), and check the rounding. */
  sigFigs?: number;
  /** Require the unit (default true when expected has one). */
  requireUnit?: boolean;
  marks?: { value: number; unit: number; sf: number };
}
export function checkQuantity(answer: string | number, expected: Quantity, o: QuantityOpts = {}): CheckResult {
  const m = { value: 1, unit: expected.unit ? 1 : 0, sf: o.sigFigs ? 1 : 0, ...(o.marks ?? {}) };
  const p = parseQuantity(answer);
  if (!p) return combine([{ label: "Give a number", ok: false, marks: m.value + m.unit + m.sf }]);
  const tol = o.abs ?? (o.tolPct ? Math.abs(expected.value) * (o.tolPct / 100) : Math.abs(expected.value) * 1e-9);
  const target = o.sigFigs ? toSF(expected.value, o.sigFigs) : expected.value;
  const valueOk = Math.abs(p.value - target) <= Math.max(tol, o.sigFigs ? Math.abs(target) * 1e-9 : 0) + 1e-12;
  const parts: Parameters<typeof combine>[0] = [{ label: "Correct value", ok: valueOk, marks: m.value, note: valueOk ? undefined : `you gave ${p.value}` }];
  if (expected.unit && (o.requireUnit ?? true)) { const unitOk = normUnit(expected.unit) === p.unit; parts.push({ label: `Unit ${expected.unit}`, ok: unitOk, marks: m.unit, note: unitOk ? undefined : p.unit ? `you wrote “${p.unit}”` : "no unit" }); }
  if (o.sigFigs) parts.push({ label: `${o.sigFigs} significant figures`, ok: valueOk && p.sf === o.sigFigs, marks: m.sf, note: valueOk && p.sf !== o.sigFigs ? `you gave ${p.sf}` : undefined });
  return combine(parts);
}

/** Put items in order: full credit for the exact sequence; otherwise credit per correct NEIGHBOUR pair (so one slip costs one mark, not all). */
export function checkSequence(answer: string[], expected: string[]): CheckResult {
  const marks = Math.max(1, expected.length - 1);
  const exact = answer.length === expected.length && answer.every((x, i) => x === expected[i]);
  if (exact) return combine([{ label: "In the right order", ok: true, marks }]);
  let ok = 0; for (let i = 0; i < expected.length - 1; i++) { const at = answer.indexOf(expected[i]!); if (at >= 0 && answer[at + 1] === expected[i + 1]) ok++; }
  return { score: ok, max: marks, feedback: [`${ok} of ${marks} steps are followed by the right one`], log: { answer, expected } };
}

/** Match pairs (label → target, item → category): one mark per correct pairing, wrong extra pairings lose nothing but earn nothing. */
export function checkSetMatch(answer: Record<string, string>, expected: Record<string, string>): CheckResult {
  const keys = Object.keys(expected);
  return combine(keys.map((k) => ({ label: `${k}`, ok: answer[k] === expected[k], marks: 1, note: answer[k] === undefined ? "not placed" : answer[k] === expected[k] ? undefined : `you put “${answer[k]}”` })));
}
