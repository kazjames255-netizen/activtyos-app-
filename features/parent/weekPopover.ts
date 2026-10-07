// Pure helpers for the "Your family week" day-tile popover (kept out of the component so they can be tested).

/** Bookings on one day, earliest start first (a booking with no time sorts last, ties keep their order). */
export function sortByStart<T>(items: T[], timeOf: (x: T) => string | null | undefined): T[] {
  const key = (x: T) => {
    const m = /(\d{1,2}):(\d{2})/.exec(timeOf(x) ?? "");
    return m ? Number(m[1]) * 60 + Number(m[2]) : 24 * 60 + 1;
  };
  return items.map((x, i) => ({ x, i, k: key(x) })).sort((a, b) => a.k - b.k || a.i - b.i).map((e) => e.x);
}

export interface PopPos { left: number; top?: number; bottom?: number; above: boolean }

/** Where to put the popover next to a tile: centred under it, kept inside the viewport, flipped above it when there is no room below. */
export function popoverPlacement(rect: { left: number; right: number; top: number; bottom: number }, vw: number, vh: number, rows: number, width = 264): PopPos {
  const est = 28 + Math.max(1, rows) * 96; // a rough height: padding + one block per booking
  const mid = (rect.left + rect.right) / 2;
  const left = Math.max(8, Math.min(vw - width - 8, mid - width / 2));
  const roomBelow = vh - rect.bottom - 8;
  const above = roomBelow < est && rect.top > roomBelow;
  return above ? { left, bottom: vh - rect.top + 8, above } : { left, top: rect.bottom + 8, above };
}
