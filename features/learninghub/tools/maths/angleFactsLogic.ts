// Angle facts (plan M-09): two parallel lines cut by a transversal make eight angles a–h. This is the pure maths of which are equal and which add to 180°,
// so the board can NAME the reason (exam marks go to the reason, not just the number).

/** a–d sit at the upper intersection (NE, NW, SW, SE), e–h at the lower one in the same order. */
export type Region = "a" | "b" | "c" | "d" | "e" | "f" | "g" | "h";
export const REGIONS: Region[] = ["a", "b", "c", "d", "e", "f", "g", "h"];
type Pos = "NE" | "NW" | "SW" | "SE";
const POS: Pos[] = ["NE", "NW", "SW", "SE"];
const where = (r: Region) => ({ upper: r <= "d", pos: POS[REGIONS.indexOf(r) % 4]! });

/** The size of region `r` when the transversal makes angle `theta` with the lines (measured to the right, above the line). */
export const angleOf = (r: Region, theta: number) => { const p = where(r).pos; return p === "NE" || p === "SW" ? theta : 180 - theta; };

export type Reason = "vertically opposite" | "angles on a straight line" | "corresponding" | "alternate" | "co-interior (allied)" | "same angle";
export interface Relation { reason: Reason | null; equal: boolean; sum180: boolean }
const OPP: Record<Pos, Pos> = { NE: "SW", SW: "NE", NW: "SE", SE: "NW" };

/** How region `b` relates to region `a`: the reason a pupil would write. null when there is no simple relationship (e.g. an angle and a non-related one). */
export function relation(a: Region, b: Region, theta: number): Relation {
  if (a === b) return { reason: "same angle", equal: true, sum180: false };
  const A = where(a), B = where(b), va = angleOf(a, theta), vb = angleOf(b, theta);
  const eq = Math.abs(va - vb) < 1e-9, sum = Math.abs(va + vb - 180) < 1e-9;
  let reason: Reason | null = null;
  if (A.upper === B.upper) reason = OPP[A.pos] === B.pos ? "vertically opposite" : "angles on a straight line";
  else if (A.pos === B.pos) reason = "corresponding";
  else if (OPP[A.pos] === B.pos) reason = "alternate";
  else {
    // different intersections, neither same nor opposite position: co-interior only when both lie BETWEEN the lines on the same side
    const between = (r: Region) => { const w = where(r); return w.upper ? w.pos === "SE" || w.pos === "SW" : w.pos === "NE" || w.pos === "NW"; };
    const side = (r: Region) => (where(r).pos === "NE" || where(r).pos === "SE" ? "R" : "L");
    reason = between(a) && between(b) && side(a) === side(b) ? "co-interior (allied)" : null;
  }
  return { reason, equal: eq, sum180: sum };
}
/** Every region that is equal to, or supplementary with, `a` and the reason — a complete "what can I say from this?" list. */
export const factsFrom = (a: Region, theta: number) => REGIONS.filter((r) => r !== a).map((r) => ({ region: r, ...relation(a, r, theta) })).filter((f) => f.reason);
