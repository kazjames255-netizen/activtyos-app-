// Independent expectations for rp.ts (Years 7–9). See _check_m2.ts.
import { D } from "./_m2data";
import { R, V, S, gcd, ev, only, setOf, opts, type EMap } from "./_m2lib";

const ratio = (o: string) => { const m = o.match(/^(\d+(?:\.\d+)?) : (\d+(?:\.\d+)?)$/); return m ? [Number(m[1]), Number(m[2])] : null; };
const sameRatio = (o: string, a: number, b: number) => { const r = ratio(o); return !!r && Math.abs(r[0] * b - r[1] * a) < 1e-9; };
const simplest = (o: string) => { const r = ratio(o); return !!r && Number.isInteger(r[0]) && Number.isInteger(r[1]) && gcd(r[0], r[1]) === 1; };

export const E: EMap = {
  // ---- Y7
  "rp-y7-01": (q) => only(q, (o) => sameRatio(o, 12, 18) && simplest(o)),
  "rp-y7-02": () => V((20 / (1 + 3)) * 1),
  "rp-y7-03": (q) => only(q, (o) => sameRatio(o, 12, 15) && simplest(o)),
  "rp-y7-04": () => { if (D.ratioBar.a !== 3 || D.ratioBar.b !== 5 || D.ratioBar.total !== 96) throw new Error("image data != prompt"); return V((D.ratioBar.total / (D.ratioBar.a + D.ratioBar.b)) * D.ratioBar.b); },
  "rp-y7-05": () => V((10 / 2) * 5),
  "rp-y7-06": () => V(R(2, 3 + 2)),
  "rp-y7-07": () => V((210 / (3 + 7)) * 7),
  "rp-y7-08": (q) => { const g = gcd(30, 150); const s = `${30 / g} : ${150 / g}`; for (const a of q.accepted ?? []) if (!(a.replace(/\s/g, "") === s.replace(/\s/g, "") || a === "1 to 5")) throw new Error("accepted mismatch"); return S(s); },
  "rp-y7-09": () => V((12 / (3 - 2)) * (2 + 3)),
  "rp-y7-10": (q) => setOf(q, (o) => sameRatio(o, 4, 10)),
  // ---- Y8
  "rp-y8-01": () => V((3.5 / 5) * 8), "rp-y8-02": () => V((300 / 4) * 6), "rp-y8-03": () => V((6 * 50000) / 100000),
  "rp-y8-04": (q) => {
    const parsed = opts(q).map((o) => { const m = o.match(/^([ABC]): (\d+) (g|kg) for £([\d.]+)$/); return m ? { o, ppg: Number(m[4]) / (Number(m[2]) * (m[3] === "kg" ? 1000 : 1)) } : null; }).filter(Boolean) as { o: string; ppg: number }[];
    const min = Math.min(...parsed.map((p) => p.ppg)); const best = parsed.filter((p) => Math.abs(p.ppg - min) < 1e-12);
    if (best.length !== 1) throw new Error("tie"); return S(best[0].o);
  },
  "rp-y8-05": () => V(75 * 1.2), "rp-y8-06": () => V((10 / 4) * 10), "rp-y8-07": () => V((6 * 200) / 80), "rp-y8-08": () => V((32 * 25) / 100),
  "rp-y8-09": () => V((9.6 / 80) * 120), "rp-y8-10": () => V(Math.floor(1500 / (240 / 3))),
  // ---- Y9
  "rp-y9-01": () => V(150 / 3),
  "rp-y9-02": (q) => only(q, (o) => { const m = o.match(/^density = (.+)$/); return !!m && ev(m[1].replace(/mass/g, "12").replace(/volume/g, "3")) === 4; }),
  "rp-y9-03": () => V(40 * 2.5),
  "rp-y9-04": () => { const [a, b] = D.dt.pts; return V((b[1] - a[1]) / (b[0] - a[0])); },
  "rp-y9-05": () => { const p = D.dt.pts; let m = 0; for (let i = 1; i < p.length; i++) if (p[i][1] === p[i - 1][1]) m += (p[i][0] - p[i - 1][0]) * 60; return V(m); },
  "rp-y9-06": () => V(540 / 200), "rp-y9-07": () => V((4 * 6) / 3), "rp-y9-08": () => V(72 / 3.6),
  "rp-y9-09": () => V(120 / (60 / 40 + 60 / 60)), "rp-y9-10": () => V((3 * 20) / 12),
};
