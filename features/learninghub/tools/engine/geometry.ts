// Small geometry kernel for the tools engine. Pure functions, world units = millimetres, y grows DOWN (SVG),
// angles in degrees measured anticlockwise on screen from +x (so "up" is 90°). No DOM, no React — selftest-covered.

export type Pt = readonly [number, number];
export interface Seg { a: Pt; b: Pt }

export const EPS = 1e-9;
export const rad = (d: number) => (d * Math.PI) / 180;
export const deg = (r: number) => (r * 180) / Math.PI;
/** Normalise to [0, 360). */
export const norm360 = (d: number) => ((d % 360) + 360) % 360;
/** Normalise to (-180, 180]. */
export const norm180 = (d: number) => { const n = norm360(d); return n > 180 ? n - 360 : n; };
/** Smallest absolute difference between two directions, in [0, 180]. */
export const angDiff = (a: number, b: number) => Math.abs(norm180(a - b));
/** Difference between two LINE directions (a line has no arrow), in [0, 90]. */
export const lineAngDiff = (a: number, b: number) => { const d = norm360(a - b) % 180; return Math.min(d, 180 - d); };

export const add = (p: Pt, q: Pt): Pt => [p[0] + q[0], p[1] + q[1]];
export const sub = (p: Pt, q: Pt): Pt => [p[0] - q[0], p[1] - q[1]];
export const scale = (p: Pt, k: number): Pt => [p[0] * k, p[1] * k];
export const dot = (p: Pt, q: Pt) => p[0] * q[0] + p[1] * q[1];
export const cross = (p: Pt, q: Pt) => p[0] * q[1] - p[1] * q[0];
export const len = (p: Pt) => Math.hypot(p[0], p[1]);
export const dist = (p: Pt, q: Pt) => Math.hypot(p[0] - q[0], p[1] - q[1]);
export const mid = (p: Pt, q: Pt): Pt => [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
export const unit = (p: Pt): Pt => { const l = len(p); return l < EPS ? [1, 0] : [p[0] / l, p[1] / l]; };
/** Unit vector for a screen direction in degrees (anticlockwise, y-down: 90° = up). */
export const dirVec = (d: number): Pt => [Math.cos(rad(d)), -Math.sin(rad(d))];
/** Direction (degrees, same convention) from p to q. */
export const dirOf = (p: Pt, q: Pt) => norm360(deg(Math.atan2(-(q[1] - p[1]), q[0] - p[0])));
export const polar = (c: Pt, r: number, d: number): Pt => add(c, scale(dirVec(d), r));
/** Rotate p about c by d degrees anticlockwise on screen. */
export const rotateAbout = (p: Pt, c: Pt, d: number): Pt => {
  const v = sub(p, c), cs = Math.cos(rad(d)), sn = Math.sin(rad(d));
  // y-down: an anticlockwise screen rotation is x' = x cos + y sin, y' = -x sin + y cos.
  return [c[0] + v[0] * cs + v[1] * sn, c[1] - v[0] * sn + v[1] * cs];
};

/** Angle at vertex `o` from ray o→a to ray o→b, anticlockwise, in [0, 360). */
export const angleAt = (o: Pt, a: Pt, b: Pt) => norm360(dirOf(o, b) - dirOf(o, a));
/** The interior (smaller) angle at `o`, in [0, 180]. */
export const interiorAngle = (o: Pt, a: Pt, b: Pt) => angDiff(dirOf(o, a), dirOf(o, b));

/** Closest point on the SEGMENT to p. */
export function closestOnSeg(s: Seg, p: Pt): Pt {
  const ab = sub(s.b, s.a), l2 = dot(ab, ab);
  if (l2 < EPS) return s.a;
  const t = Math.max(0, Math.min(1, dot(sub(p, s.a), ab) / l2));
  return add(s.a, scale(ab, t));
}
/** Closest point on the infinite LINE through the segment. `t` is the parameter (0 = a, 1 = b). */
export function projectOnLine(s: Seg, p: Pt): { pt: Pt; t: number } {
  const ab = sub(s.b, s.a), l2 = dot(ab, ab);
  if (l2 < EPS) return { pt: s.a, t: 0 };
  const t = dot(sub(p, s.a), ab) / l2;
  return { pt: add(s.a, scale(ab, t)), t };
}
export const distToSeg = (s: Seg, p: Pt) => dist(closestOnSeg(s, p), p);
export const distToLine = (s: Seg, p: Pt) => dist(projectOnLine(s, p).pt, p);

/** Intersection of the infinite lines through two segments, or null when parallel. */
export function lineIntersect(s1: Seg, s2: Seg): Pt | null {
  const r = sub(s1.b, s1.a), q = sub(s2.b, s2.a), d = cross(r, q);
  if (Math.abs(d) < EPS) return null;
  const t = cross(sub(s2.a, s1.a), q) / d;
  return add(s1.a, scale(r, t));
}
/** Segment/segment intersection (proper or touching), or null. */
export function segIntersect(s1: Seg, s2: Seg): Pt | null {
  const r = sub(s1.b, s1.a), q = sub(s2.b, s2.a), d = cross(r, q);
  if (Math.abs(d) < EPS) return null;
  const t = cross(sub(s2.a, s1.a), q) / d, u = cross(sub(s2.a, s1.a), r) / d;
  if (t < -1e-9 || t > 1 + 1e-9 || u < -1e-9 || u > 1 + 1e-9) return null;
  return add(s1.a, scale(r, t));
}
/** Circle/circle intersection points (0, 1 or 2). */
export function circleCircle(c1: Pt, r1: number, c2: Pt, r2: number): Pt[] {
  const d = dist(c1, c2);
  if (d < EPS || d > r1 + r2 + 1e-9 || d < Math.abs(r1 - r2) - 1e-9) return [];
  const a = (r1 * r1 - r2 * r2 + d * d) / (2 * d);
  const h2 = r1 * r1 - a * a, h = h2 > 0 ? Math.sqrt(h2) : 0;
  const u = scale(sub(c2, c1), 1 / d), base = add(c1, scale(u, a));
  const perp: Pt = [-u[1], u[0]];
  return h < 1e-9 ? [base] : [add(base, scale(perp, h)), sub(base, scale(perp, h))];
}
/** Line (through the segment) / circle intersection points. */
export function lineCircle(s: Seg, c: Pt, r: number): Pt[] {
  const { pt } = projectOnLine(s, c), d = dist(pt, c);
  if (d > r + 1e-9) return [];
  const u = unit(sub(s.b, s.a)), h = Math.sqrt(Math.max(0, r * r - d * d));
  return h < 1e-9 ? [pt] : [add(pt, scale(u, h)), sub(pt, scale(u, h))];
}

/** The perpendicular bisector of a→b as a long segment through the midpoint (length `half*2`). */
export function perpBisector(a: Pt, b: Pt, half = 1000): Seg {
  const m = mid(a, b), u = unit(sub(b, a)), n: Pt = [-u[1], u[0]];
  return { a: add(m, scale(n, half)), b: sub(m, scale(n, half)) };
}
/** Direction (degrees) of the internal bisector at o of the angle a-o-b. */
export function bisectorDir(o: Pt, a: Pt, b: Pt) {
  const da = dirOf(o, a), delta = norm180(dirOf(o, b) - da);
  return norm360(da + delta / 2);
}
/** Is direction `d` (degrees) inside the arc that sweeps ANTICLOCKWISE from a0 to a1? */
export const inSweep = (d: number, a0: number, a1: number) => norm360(d - a0) <= norm360(a1 - a0) + 1e-9;

/** 3-figure bearing (clockwise from north, degrees in [0,360)) of q as seen from p. North = up on screen (−y). */
export const bearingOf = (p: Pt, q: Pt) => norm360(deg(Math.atan2(q[0] - p[0], -(q[1] - p[1]))));
/** The point at `distance` from p on a given bearing. */
export const fromBearing = (p: Pt, bearing: number, distance: number): Pt => [p[0] + distance * Math.sin(rad(bearing)), p[1] - distance * Math.cos(rad(bearing))];
export const backBearing = (b: number) => norm360(b + 180);
export const fmt3 = (b: number) => String(Math.round(norm360(b)) % 360).padStart(3, "0") + "°";

export const round = (n: number, dp = 0) => { const k = 10 ** dp; return Math.round(n * k) / k; };
export const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
