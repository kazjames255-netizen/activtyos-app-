// Where a floating tile may sit without covering the board's controls (pure — self-tested with `npx tsx features/learninghub/live/tileSpot.selftest.ts`).

const INSET = 16;
export interface R { x: number; y: number; w: number; h: number }
const overlaps = (a: R, b: R, pad = 8) => a.x < b.x + b.w + pad && a.x + a.w + pad > b.x && a.y < b.y + b.h + pad && a.y + a.h + pad > b.y;
/** The free spot nearest to (px, py) for a w×h tile inside the container, clear of every `avoid` rect (null = there is none). */
export function findSpot(px: number, py: number, w: number, h: number, box: { w: number; h: number }, avoid: R[]): { x: number; y: number } | null {
  if (!avoid.length) return { x: px, y: py };
  const free = (x: number, y: number) => !avoid.some((r) => overlaps({ x, y, w, h }, r));
  if (free(px, py)) return { x: px, y: py };
  const maxX = box.w - w - INSET, maxY = box.h - h - INSET;
  if (maxX < INSET || maxY < INSET) return null;
  let best: { x: number; y: number } | null = null, bd = Infinity;
  for (let y = INSET; y <= maxY + 0.5; y += 12) for (let x = INSET; x <= maxX + 0.5; x += 12) {
    const d = (x - px) ** 2 + (y - py) ** 2;
    if (d < bd && free(x, y)) { bd = d; best = { x, y }; }
  }
  return best;
}
