// Shared helpers for the _chk_*.ts checkers: read a question's key back and compare with a recomputed value.
import type { CQuestion, CTopic } from "../types";
export const problems: string[] = [];
export let checks = 0;
const SUP: Record<string, string> = { "⁰": "0", "¹": "1", "²": "2", "³": "3", "⁴": "4", "⁵": "5", "⁶": "6", "⁷": "7", "⁸": "8", "⁹": "9", "⁻": "-", "⁺": "+" };
/** Numeric value of the question's key: `number` answers as given; single answers parse the leading number (handles −, ×10⁻⁵, "1.8 × 10^-5"). */
export function parseNum(s: string): number {
  let t = s.replace(/−/g, "-").replace(/\s+/g, " ").trim();
  t = t.replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹⁻⁺]+/g, (m) => "^" + [...m].map((c) => SUP[c]).join(""));
  const sci = t.match(/^(-?[\d.]+)\s*[×x]\s*10\^(-?\d+)/);
  if (sci) return Number(sci[1]) * 10 ** Number(sci[2]);
  const m = t.match(/-?\d[\d,]*\.?\d*/);
  if (!m) throw new Error("no number in: " + s);
  return Number(m[0].replace(/,/g, ""));
}
export function find(t: CTopic, key: string): CQuestion {
  for (const y of Object.values(t.years)) for (const q of y!.quiz.questions) if (q.key === key) return q;
  throw new Error("no question " + key);
}
export function keyNum(q: CQuestion): number {
  if (q.kind === "number") return q.answer as number;
  if (q.kind === "single") return parseNum(String(q.answer));
  throw new Error(q.key + ": not numeric kind");
}
/** Assert that question `key` has the numeric key `expected` (relative tolerance rel, absolute floor abs). */
export function expect(t: CTopic, key: string, expected: number, rel = 0.006, abs = 1e-9) {
  checks++;
  const q = find(t, key);
  const got = keyNum(q);
  if (Math.abs(got - expected) > Math.max(Math.abs(expected) * rel, abs)) problems.push(`${key}: key ${got} but recomputed ${expected}`);
  if (q.kind === "number" && (q.tolerance ?? 0) < 0) problems.push(`${key}: negative tolerance`);
}
/** Assert a plain condition (chemistry logic, note worked examples, graph readings…). */
export function ok(cond: boolean, msg: string) { checks++; if (!cond) problems.push(msg); }
export const close = (a: number, b: number, rel = 0.006, abs = 1e-9) => Math.abs(a - b) <= Math.max(Math.abs(b) * rel, abs);
/** Assert a recomputed value equals a number quoted in prose (notes/options), to the precision given. */
export function same(label: string, a: number, b: number, rel = 0.006, abs = 1e-9) { ok(close(a, b, rel, abs), `${label}: ${a} vs ${b}`); }
export function rightOption(t: CTopic, key: string): string { return String(find(t, key).answer); }
