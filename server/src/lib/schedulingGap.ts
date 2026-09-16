// Freelancer manual scheduling-gap check (foundational build — product
// decision: freelancers do NOT get algorithmic travel-time buffers; smarter
// company/franchise travel-buffer logic is explicitly out of scope here).
// Instead a freelancer listing carries a plain "minimum gap between sessions"
// (minutes, default 30, freelancer-editable) — enforced as a no-overlap-plus-
// gap check across the freelancer's own bookings that day.

/** "HH:MM" → minutes since midnight. Non-numeric input is treated as 0. */
function toMinutes(hhmm: string | undefined): number {
  const m = /^(\d{1,2}):(\d{2})/.exec((hhmm ?? "").trim());
  if (!m) return 0;
  return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
}

/** True when [aStart,aEnd] and [bStart,bEnd] don't overlap AND are at least
 *  `gapMinutes` apart. Sessions that touch exactly at the gap are allowed. */
export function sessionsClearGap(
  aStart: string,
  aEnd: string,
  bStart: string,
  bEnd: string,
  gapMinutes: number,
): boolean {
  const as = toMinutes(aStart);
  const ae = toMinutes(aEnd);
  const bs = toMinutes(bStart);
  const be = toMinutes(bEnd);
  return ae + gapMinutes <= bs || be + gapMinutes <= as;
}
