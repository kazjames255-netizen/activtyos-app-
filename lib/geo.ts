// Small geo helpers for franchise territory checks. Points are {lat,lng}.

export interface LatLng { lat: number; lng: number }
export interface TerritoryAreaGeo { rings: LatLng[] }

/** Ray-casting point-in-polygon. `ring` is the polygon's outer vertices. */
export function pointInPolygon(p: LatLng, ring: LatLng[]): boolean {
  if (!ring || ring.length < 3) return false;
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i].lng, yi = ring[i].lat;
    const xj = ring[j].lng, yj = ring[j].lat;
    const intersect = yi > p.lat !== yj > p.lat && p.lng < ((xj - xi) * (p.lat - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/** True if the point sits inside ANY of the territory areas. */
export function pointInAnyArea(p: LatLng, areas: TerritoryAreaGeo[]): boolean {
  return (areas ?? []).some((a) => pointInPolygon(p, a.rings));
}

// ── Overlap detection (approximate, for a front-end warning) ────────────────
function ccw(a: LatLng, b: LatLng, c: LatLng): boolean {
  return (c.lat - a.lat) * (b.lng - a.lng) > (b.lat - a.lat) * (c.lng - a.lng);
}
/** Do segments a-b and c-d cross? */
function segmentsIntersect(a: LatLng, b: LatLng, c: LatLng, d: LatLng): boolean {
  return ccw(a, c, d) !== ccw(b, c, d) && ccw(a, b, c) !== ccw(a, b, d);
}
/** Approximate polygon overlap: a vertex of one inside the other, or any edges cross. */
export function ringsOverlap(r1: LatLng[], r2: LatLng[]): boolean {
  if (r1.length < 3 || r2.length < 3) return false;
  if (r1.some((p) => pointInPolygon(p, r2))) return true;
  if (r2.some((p) => pointInPolygon(p, r1))) return true;
  for (let i = 0; i < r1.length; i++) {
    const a = r1[i], b = r1[(i + 1) % r1.length];
    for (let j = 0; j < r2.length; j++) {
      const c = r2[j], d = r2[(j + 1) % r2.length];
      if (segmentsIntersect(a, b, c, d)) return true;
    }
  }
  return false;
}
/** True if any area of A overlaps any area of B. */
export function areasOverlap(a: TerritoryAreaGeo[], b: TerritoryAreaGeo[]): boolean {
  return (a ?? []).some((x) => (b ?? []).some((y) => ringsOverlap(x.rings, y.rings)));
}
