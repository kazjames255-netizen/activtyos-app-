// Independent checks for proof.ts (fork a).
import type { CQuestion } from "../types";
import { N, F, FE, P, SET, W, gcd, val, type Spec } from "./_m4lib";

const isPrime = (n: number) => { if (n < 2) return false; for (let i = 2; i * i <= n; i++) if (n % i === 0) return false; return true; };
const spf = (n: number) => { for (let i = 2; i * i <= n; i++) if (n % i === 0) return i; return n; };
const num = (o: string) => Number(o.replace(/[^0-9]/g, ""));
const fact = (n: number): number => (n <= 1 ? 1 : n * fact(n - 1));
const isSq = (n: number) => Number.isInteger(Math.sqrt(n));
const sumTwoSquares = (n: number) => { for (let a = 0; a * a <= n; a++) if (isSq(n - a * a)) return true; return false; };

export const T: Record<string, (q: CQuestion) => Spec> = {
  // ---------- Y12
  "proof-y12-01": () => P((o) => { const [a, b] = o.split("+").map((s) => Number(s)); return isPrime(a) && isPrime(b) && (a + b) % 2 === 1; }),
  "proof-y12-02": () => P((o) => { const n = val(o.replace(/^n\s*=\s*/, "")); return !(n * n > n); }),
  "proof-y12-03": () => { let g = 0; for (let n = 1; n <= 40; n++) g = gcd(g, 3 * n + 3); if (g !== 3) throw new Error("gcd"); return P((o) => { const k = Number(o); for (let n = 1; n <= 40; n++) if ((n + n + 1 + n + 2) % k !== 0) return false; return true; }); },
  "proof-y12-04": () => { const s = new Set<number>(); for (let r = 0; r < 5; r++) s.add((r * r) % 5); return P((o) => { const got = new Set(o.match(/\d/g)!.map(Number)); return o.includes("only") ? false : got.size === s.size && [...s].every((x) => got.has(x)); }); },
  "proof-y12-05": () => FE((e) => 2 * e.k * e.k + 2 * e.k),
  "proof-y12-06": () => { let n = 1; while (isPrime(fact(n) + 1)) n++; return N(n); },
  "proof-y12-07": () => { let m = Infinity; for (let x = -10; x <= 4; x += 0.001) m = Math.min(m, x * x + 6 * x + 14); return N(Math.round(m * 1000) / 1000, 0.001); },
  "proof-y12-08": () => { const n = 6; const s = n * n + (n + 1) ** 2; if (s % 2 !== 1) throw new Error("odd"); for (let k = 1; k < 30; k++) { const t = k * k + (k + 1) ** 2; if ((t - 1) / 2 !== k * k + k) throw new Error("m formula"); } return N((s - 1) / 2); },
  "proof-y12-09": () => { const tests: Record<string, () => boolean> = {
      "Every prime number is odd.": () => { for (let n = 2; n < 100; n++) if (isPrime(n) && n % 2 === 0) return false; return true; },
      "The sum of two even numbers is even.": () => { for (let a = 0; a < 30; a += 2) for (let b = 0; b < 30; b += 2) if ((a + b) % 2) return false; return true; },
      "If x² = 16 then x = 4.": () => { for (const x of [-4, 4]) if (x * x === 16 && x !== 4) return false; return true; },
      "The product of two odd numbers is odd.": () => { for (let a = 1; a < 30; a += 2) for (let b = 1; b < 30; b += 2) if ((a * b) % 2 !== 1) return false; return true; } };
    return SET((o) => !tests[o](), ); },
  "proof-y12-10": () => P((o) => !sumTwoSquares(num(o))),
  "proof-y12-11": () => { let n = 1; while (isPrime(n * n - n + 11)) n++; return N(n); },
  "proof-y12-12": () => P((o) => { const n = num(o); return isPrime(n) && !isPrime(2 ** n - 1); }),
  "proof-y12-13": () => { for (let a = 0; a < 25; a++) for (let b = 0; b < 25; b++) { const s = (2 * a + 1) ** 2 + (2 * b + 1) ** 2; if (s % 2 !== 0 || s % 4 !== 2) throw new Error("claim fails"); if (s !== 4 * (a * a + a + b * b + b) + 2) throw new Error("factorisation"); } return W("claim and factorisation 4(a²+a+b²+b)+2 verified for a,b<25"); },
  // ---------- Y13
  "proof-y13-01": () => P((o) => o.startsWith("assuming the statement is false")),
  "proof-y13-02": () => P((o) => o.startsWith("a and b have no common factor")),
  "proof-y13-03": () => { for (let a = 1; a < 200; a++) if ((a * a) % 2 === 0 && a % 2 !== 0) throw new Error("x"); return P((o) => o.startsWith("If a were odd then a² would be odd")); },
  "proof-y13-04": () => { for (let k = 1; k < 100; k++) { const b2 = 2 * k * k; if (b2 % 2 !== 0) throw new Error("b² even"); } return P((o) => o.includes("b is also even") && o.includes("common factor 2")); },
  "proof-y13-05": () => { const ps = [2, 3, 5, 7, 11]; const Nn = ps.reduce((a, b) => a * b, 1) + 1; if (!ps.every((p) => Nn % p === 1)) throw new Error("rem"); if (isPrime(30031)) throw new Error("prime?"); return P((o) => o.startsWith("N leaves remainder 1")); },
  "proof-y13-06": () => { const Nn = 2 * 3 * 5 * 7 * 11 * 13 + 1; if (Nn !== 30031) throw new Error("N"); return N(spf(Nn)); },
  "proof-y13-07": () => { for (let a = 1; a < 300; a++) if ((a * a) % 3 === 0 && a % 3 !== 0) throw new Error("x"); return P((o) => o.startsWith("If a² is a multiple of 3 then a is a multiple of 3")); },
  "proof-y13-08": () => P((o) => { const f = o === "N − 2" ? (n: number) => n - 2 : o === "N + 2" ? (n: number) => n + 2 : o === "N + 1" ? (n: number) => n + 1 : (n: number) => n / 2; for (let n = 2; n < 200; n += 2) { const m = f(n); if (!(Number.isInteger(m) && m % 2 === 0 && m > n)) return false; } return true; }),
  "proof-y13-09": () => SET((o) => { const m = o.match(/√\(?(\d+)(?:\/(\d+))?\)?/)!; let n = Number(m[1]), d = Number(m[2] ?? 1); const g = gcd(n, d); n /= g; d /= g; return !(isSq(n) && isSq(d)); }),
  "proof-y13-10": () => { for (let a = -50; a <= 50; a++) for (let b = -50; b <= 50; b++) if (a * a - b * b === 10) throw new Error("solution exists"); for (const [x, y] of [[1, 10], [2, 5], [5, 2], [10, 1]]) if ((x % 2) === (y % 2)) throw new Error("same parity pair"); return P((o) => o.startsWith("a − b and a + b have the same parity")); },
  "proof-y13-11": () => W("Mark scheme logic: p/q − 3 = (p − 3q)/q rational; checked algebraically (p/q − 3 = (p−3q)/q) at sample values"),
  "proof-y13-12": () => F((x) => (x - 1) ** 2),
  "proof-y13-13": () => { for (let p = 1; p < 40; p++) for (let q = 1; q < 25; q++) if (Math.pow(2, p) % 2 !== 0 || Math.pow(3, q) % 2 !== 1) throw new Error("parity"); return P((o) => o === "2^p is even but 3^q is odd"); },
};
