// Oak quiz text carries inline LaTeX ("$$\frac{3}{4}$$", "cm$$^3$$", "$$x$$"). The hub renders plain text, so the
// importer converts the common cases to readable Unicode ("3/4", "cm³", "x"). A span it can't convert faithfully
// (matrices, arrays, unknown commands) is left EXACTLY as Oak wrote it, and the caller is told (`hasMath`), so a
// future renderer can pick those up. Pure functions; no I/O.

const SYMBOLS: Record<string, string> = {
  times: "×", div: "÷", pi: "π", leq: "≤", le: "≤", geq: "≥", ge: "≥", neq: "≠", ne: "≠", approx: "≈", pm: "±",
  circ: "°", theta: "θ", Delta: "Δ", Omega: "Ω", alpha: "α", beta: "β", xi: "ξ", propto: "∝", equiv: "≡",
  cup: "∪", cap: "∩", cdot: "·", prime: "′", mapsto: "→", emptyset: "∅", triangle: "△", square: "□", star: "★",
  uparrow: "↑", quad: " ", space: " ", left: "", right: "", big: "", bigg: "",
  sin: "sin", cos: "cos", tan: "tan", arcsin: "sin⁻¹", arccos: "cos⁻¹", arctan: "tan⁻¹",
};
const WRAP = new Set(["text", "mathbf", "mathrm", "textbf", "mathit", "operatorname", "mathsf"]);
const SUP: Record<string, string> = { "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹", "+": "⁺", "-": "⁻", "−": "⁻", "=": "⁼", "(": "⁽", ")": "⁾", n: "ⁿ", i: "ⁱ" };
const SUB: Record<string, string> = { "0": "₀", "1": "₁", "2": "₂", "3": "₃", "4": "₄", "5": "₅", "6": "₆", "7": "₇", "8": "₈", "9": "₉", "+": "₊", "-": "₋", "=": "₌", "(": "₍", ")": "₎", a: "ₐ", e: "ₑ", h: "ₕ", i: "ᵢ", j: "ⱼ", k: "ₖ", l: "ₗ", m: "ₘ", n: "ₙ", o: "ₒ", p: "ₚ", r: "ᵣ", s: "ₛ", t: "ₜ", u: "ᵤ", v: "ᵥ", x: "ₓ" };

class Unsupported extends Error {}

/** The `{...}` group (or single command / char) starting at i → [raw inner text, index after it]. */
function group(s: string, i: number): [string, number] {
  while (s[i] === " ") i++;
  if (i >= s.length) return ["", i];
  if (s[i] === "{") {
    let d = 0;
    for (let j = i; j < s.length; j++) {
      if (s[j] === "{") d++;
      else if (s[j] === "}" && --d === 0) return [s.slice(i + 1, j), j + 1];
    }
    throw new Unsupported("unbalanced");
  }
  if (s[i] === "\\") { const m = /^\\[a-zA-Z]+/.exec(s.slice(i)); const len = m ? m[0].length : 2; return [s.slice(i, i + len), i + len]; }
  return [s[i], i + 1];
}
/** Split on a top-level (depth 0) command; returns null when absent. */
function splitTop(s: string, cmd: string): [string, string] | null {
  let d = 0;
  for (let i = 0; i < s.length; i++) {
    if (s[i] === "{") d++;
    else if (s[i] === "}") d--;
    else if (d === 0 && s.startsWith(cmd, i) && !/[a-zA-Z]/.test(s[i + cmd.length] ?? "")) return [s.slice(0, i), s.slice(i + cmd.length)];
  }
  return null;
}
const simple = (t: string) => /^[A-Za-z0-9.°′]+$/.test(t);
const frac = (a: string, b: string) => `${simple(a) ? a : `(${a})`}/${simple(b) ? b : `(${b})`}`;
const script = (t: string, map: Record<string, string>, mark: string) => {
  if (t === "°" || t === "o" && mark === "^") return "°"; // ^o / ^\circ = degrees
  return [...t].every((c) => map[c]) ? [...t].map((c) => map[c]).join("") : mark === "_" && /^\(?[a-z]{1,3}\)?$/.test(t) ? t : `${mark}${t.length > 1 ? `(${t})` : t}`;
};

function conv(s: string): string {
  const over = splitTop(s, "\\over");
  if (over) return frac(conv(over[0]).trim(), conv(over[1]).trim());
  const choose = splitTop(s, "\\choose");
  if (choose) return `(${conv(choose[0]).trim()} choose ${conv(choose[1]).trim()})`;
  let out = "";
  for (let i = 0; i < s.length;) {
    const c = s[i];
    if (c === "\\") {
      const m = /^\\([a-zA-Z]+)/.exec(s.slice(i));
      if (!m) { // escaped punctuation: "\ " "\," "\%" "\{" …
        const n = s[i + 1] ?? "";
        if (n === "\\") throw new Unsupported("row break");
        out += /[ ,;:!]/.test(n) ? " " : n; i += 2; continue;
      }
      const cmd = m[1]; i += m[0].length;
      if (cmd === "frac" || cmd === "dfrac") { const [a, j] = group(s, i); const [b, k] = group(s, j); const A = conv(a).trim(), B = conv(b).trim(); if (/\d$/.test(out) && /^\d/.test(A)) out += " "; out += frac(A, B); i = k; }
      else if (cmd === "sqrt") {
        let idx = ""; while (s[i] === " ") i++;
        if (s[i] === "[") { const e = s.indexOf("]", i); if (e < 0) throw new Unsupported("sqrt"); idx = s.slice(i + 1, e); i = e + 1; }
        const [a, j] = group(s, i); const A = conv(a).trim(); i = j;
        out += (idx === "3" ? "∛" : idx === "4" ? "∜" : idx ? `${script(idx, SUP, "^")}√` : "√") + (simple(A) ? A : `(${A})`);
      }
      else if (WRAP.has(cmd)) { const [a, j] = group(s, i); out += conv(a); i = j; }
      else if (cmd === "overrightarrow") { const [a, j] = group(s, i); out += `${conv(a)}⃗`; i = j; }
      else if (cmd === "dot") { const [a, j] = group(s, i); out += `${conv(a)}̇`; i = j; }
      else if (cmd === "unicode") { const [a, j] = group(s, i); const cp = parseInt(a.replace(/^x/i, ""), 16); if (!Number.isFinite(cp)) throw new Unsupported("unicode"); out += String.fromCodePoint(cp); i = j; }
      else if (cmd in SYMBOLS) { out += SYMBOLS[cmd]; if ((cmd === "left" || cmd === "right" || cmd === "big" || cmd === "bigg") && s[i] === ".") i++; }
      else throw new Unsupported(cmd);
    } else if (c === "^" || c === "_") {
      const [a, j] = group(s, i + 1); out += script(conv(a).trim(), c === "^" ? SUP : SUB, c); i = j;
    } else if (c === "{") { const [a, j] = group(s, i); out += conv(a); i = j; }
    else if (c === "}") i++;
    else { out += c; i++; }
  }
  return out;
}

export interface MathResult { text: string; converted: number; residual: number }
/** Replace every `$$…$$` span in `t` with plain Unicode; leaves a span raw (and counts it) when it can't. */
export function convertMath(t: string): MathResult {
  let converted = 0, residual = 0;
  const text = t.replace(/\${2,}([^$]*?)\${2,}/g, (whole, inner: string) => {
    try { const r = conv(inner).replace(/\s+/g, " ").trim(); converted++; return r; }
    catch { residual++; return whole; }
  });
  return { text, converted, residual };
}
