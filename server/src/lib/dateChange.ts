// Pure rules for a family's date-change ("amend") request and the provider's
// approval of it. Extracted unchanged from routes/my.ts (POST /bookings/:ref/amend
// validation) and routes/bookings.ts (move-approve) so they can be unit-tested
// without Firestore. Behaviour-preserving.
import type { Booking } from "../../../features/bookings/types";

export const prettyDay = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });

export type AmendMove = { childName?: string; childId?: string; from: string; to: string };

/**
 * The first reason a requested move can't be recorded, or null when it's fine.
 * `from` of "" is the undated "preferred date" shape (nothing to move off).
 * sessionDates: the block's running dates (null = no block context, skip).
 * dayFull: is the target day at its per-day capacity (only for per-day blocks).
 */
export function amendMoveError(
  mv: AmendMove,
  all: AmendMove[],
  ctx: { onBooking: Set<string>; todayUk: string; kidCount: number; sessionDates?: Set<string> | null; dayFull?: (date: string) => boolean },
): string | null {
  if (mv.from && !ctx.onBooking.has(mv.from)) return `${prettyDay(mv.from)} isn't on this booking`;
  if (mv.from === mv.to) return "That's the same date";
  if (mv.from && mv.from < ctx.todayUk) return `${prettyDay(mv.from)} has already passed`;
  if (mv.to < ctx.todayUk) return `${prettyDay(mv.to)} has already passed`;
  if (ctx.kidCount <= 1 && ctx.onBooking.has(mv.to) && !all.some((m) => m.from === mv.to)) return `This booking already covers ${prettyDay(mv.to)}`;
  if (ctx.sessionDates) {
    if (!ctx.sessionDates.has(mv.to)) return `This activity doesn't run on ${prettyDay(mv.to)}`;
    if (ctx.dayFull?.(mv.to)) return `${prettyDay(mv.to)} is full`;
  }
  return null;
}

/** Recover the ISO date from a session label ("Mon 27 Jul 2026 · …"). */
export const isoOfLabel = (s: string): string | null => {
  const mm = s.match(/(\d{1,2})\s+([A-Za-z]{3,})\s+(\d{4})/);
  if (!mm) return null;
  const d = new Date(`${mm[1]} ${mm[2]} ${mm[3]}`);
  return Number.isNaN(d.getTime()) ? null : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/** Apply the provider's approval (all moves, or just approveIndexes) to the booking, in place. */
export function applyMoveApprove(b: Booking, approveIndexes?: number[], reason?: string): void {
  const req = b.dateChangeRequest;
  if (!req) return;
  const idxs = approveIndexes ?? req.moves.map((_, i) => i);
  const labelOfIso = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
  req.moves.forEach((m, i) => {
    const ok = idxs.includes(i);
    m.approved = ok;
    if (ok && m.from && m.to) {
      const kid = b.kids?.find((k) => (m.childId && k.childId === m.childId) || k.name === m.childName);
      // Some kids[] rows (merged-basket bookings) only ever had `days`
      // written, not `dates` — treat either as the child's booked days
      // and always keep both in sync afterwards, or the child's own row
      // goes stale (register/partial-cancel read `dates`).
      const kidDays = kid?.dates?.length ? kid.dates : kid?.days;
      if (kid && kidDays?.length) {
        const moved = kidDays.map((d) => (d === m.from ? m.to! : d));
        kid.dates = moved; kid.days = moved;
      } else if (b.days?.length) b.days = b.days.map((d) => (d === m.from ? m.to! : d));
      // Bookings whose dates live only in `sessions` strings — move the
      // matching label, keeping its time suffix, so the change shows.
      if (b.sessions?.length) {
        b.sessions = b.sessions.map((s) => {
          if (isoOfLabel(s) !== m.from) return s;
          const suffix = s.includes(" · ") ? s.slice(s.indexOf(" · ")) : "";
          return `${labelOfIso(m.to!)}${suffix}`;
        }).sort((a, c) => ((isoOfLabel(a) ?? a) < (isoOfLabel(c) ?? c) ? -1 : 1));
      }
    }
  });
  // Refresh the headline date range from whatever dates it now holds.
  const allIso = [...new Set([
    ...(b.days ?? []),
    ...((b.kids ?? []).flatMap((k) => k.dates ?? [])),
    ...((b.sessions ?? []).map(isoOfLabel).filter(Boolean) as string[]),
  ])].sort();
  if (allIso.length) {
    const fmt = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
    b.dates = allIso.length === 1 ? fmt(allIso[0]) : `${fmt(allIso[0])} – ${fmt(allIso[allIso.length - 1])}`;
  }
  req.status = "approved";
  req.resolvedAt = new Date().toISOString();
  if (reason) req.reason = reason;
  b.note = idxs.length === req.moves.length ? "Date change approved." : "Date change partly approved.";
}

/**
 * Setup > Amending dates > "notice": a date can only be moved if it is at least `noticeHours` away. The family can still pick any
 * future date to move TO; it is the day they are giving up that must be far enough off. Judged from the start of that day (UK),
 * which is the strictest reading when a session time isn't known. Returns a plain-English reason, or null when allowed.
 */
export function amendNoticeError(moves: AmendMove[], noticeHours: number | undefined, nowMs: number): string | null {
  if (!noticeHours || noticeHours <= 0) return null;
  for (const mv of moves) {
    if (!mv.from) continue; // an undated "preferred date" gives nothing up
    const startMs = new Date(`${mv.from}T00:00:00Z`).getTime();
    if (Number.isNaN(startMs)) continue;
    if (startMs - nowMs < noticeHours * 3_600_000)
      return `${prettyDay(mv.from)} is too close to move. This provider needs at least ${noticeHours} hours' notice to move a date.`;
  }
  return null;
}
