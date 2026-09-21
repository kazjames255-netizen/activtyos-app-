// Independent expectations for geo.ts (Years 7–9). See _check_m2.ts.
import { D } from "./_m2data";
import { R, V, S, only, opts, type EMap } from "./_m2lib";

const pt = (o: string) => { const m = o.replace(/−/g, "-").match(/^\((-?\d+), (-?\d+)\)$/); return m ? [+m[1], +m[2]] : null; };
const ptStr = (p: number[]) => `(${p[0] < 0 ? "−" : ""}${Math.abs(p[0])}, ${p[1] < 0 ? "−" : ""}${Math.abs(p[1])})`;

export const E: EMap = {
  // ---- Y7
  "geo-y7-01": () => { if (D.angLine.known !== 68) throw new Error("data"); return V(180 - D.angLine.known); },
  "geo-y7-02": () => V(360),
  "geo-y7-03": () => V(9 * 6),
  "geo-y7-04": () => { if (D.triAng.a !== 47 || D.triAng.b !== 72) throw new Error("data"); return V(180 - D.triAng.a - D.triAng.b); },
  "geo-y7-05": () => V(0.5 * 10 * 7),
  "geo-y7-06": () => V(3.5 * 1000),
  "geo-y7-07": () => V(8 * 5),
  "geo-y7-08": () => V((360 - 90 - 110) / 2),
  "geo-y7-09": () => { const w = 34 / 2 - 12; return V(12 * w); },
  "geo-y7-10": () => V(8 * 5 - 3 * 2),
  // ---- Y8
  "geo-y8-01": (q) => only(q, (o) => o === "C = πd"),
  "geo-y8-02": () => V(5 * 4 * 3),
  "geo-y8-03": (q) => only(q, (o) => o.startsWith("The arcs only cross if the radius is more than half")),
  "geo-y8-04": () => { if (D.trap.a !== 7 || D.trap.b !== 11 || D.trap.h !== 5) throw new Error("data"); return V(0.5 * (D.trap.a + D.trap.b) * D.trap.h); },
  "geo-y8-05": () => V(3.14 * 10 * 10),
  "geo-y8-06": () => { const p = D.prism; if (p.base !== 6 || p.height !== 4 || p.length !== 10) throw new Error("data"); return V(0.5 * p.base * p.height * p.length); },
  "geo-y8-07": () => V(3.14 * 14),
  "geo-y8-08": (q) => { const [x, y] = [2, 1]; const r = [y, -x]; return only(q, (o) => { const p = pt(o); return !!p && p[0] === r[0] && p[1] === r[1]; }); },
  "geo-y8-09": () => V(3.14 * 10 / 2 + 10),
  "geo-y8-10": (q) => { const c = [1, 1], p = [3, 1], k = 3; const r = [c[0] + k * (p[0] - c[0]), c[1] + k * (p[1] - c[1])]; return only(q, (o) => o === ptStr(r)); },
  // ---- Y9
  "geo-y9-01": () => { if (D.pyth.a !== 6 || D.pyth.b !== 8) throw new Error("data"); return V(Math.sqrt(D.pyth.a ** 2 + D.pyth.b ** 2)); },
  "geo-y9-02": (q) => only(q, (o) => { const [a, b, c] = o.split(", ").map(Number); return a * a + b * b === c * c; }),
  "geo-y9-03": (q) => only(q, (o) => o === "opposite ÷ hypotenuse"),
  "geo-y9-04": () => V(Math.sqrt(6.5 ** 2 - 2.5 ** 2)),
  "geo-y9-05": () => { if (D.trig.angle !== 30 || D.trig.hyp !== 10) throw new Error("data"); const s = Math.sin((30 * Math.PI) / 180); if (Math.abs(s - 0.5) > 1e-12) throw new Error("sin30"); return V(D.trig.hyp * 0.5); },
  "geo-y9-06": () => { const s = D.sim; if (s.ab !== 4 || s.ac !== 6 || s.de !== 10) throw new Error("data"); return V((s.ac * s.de) / s.ab); },
  "geo-y9-07": (q) => only(q, (o) => o.startsWith("AAA")),
  "geo-y9-08": () => V((6 - 2) * 180),
  "geo-y9-09": () => V(Math.hypot(7 - 1, 10 - 2)),
  "geo-y9-10": () => { let n = 0; for (let k = 3; k <= 100; k++) if (((k - 2) * 180) / k === 150) n = k; return V(n); },
};
void R; void S; void opts;
