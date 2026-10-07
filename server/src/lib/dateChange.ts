// Pure rules for a family's date-change ("amend") request and the provider's
// approval of it. Extracted unchanged from routes/my.ts (POST /bookings/:ref/amend
// validation) and routes/bookings.ts (move-approve) so they can be unit-tested
// without Firestore. Behaviour-preserving.
import type { Booking } from "../../../features/bookings/types";
import { cashReceivedOf } from "../../../features/bookings/helpers";

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
export function applyMoveApprove(b: Booking, approveIndexes?: number[], reason?: string, opts: { fee?: number; selfService?: boolean } = {}): void {
  const req = b.dateChangeRequest;
  if (!req) return;
  // Approving twice (double click, stale tab) must not move anything again or burn the parent's amend limit.
  if (req.status !== "pending") return;
  const idxs = approveIndexes ?? req.moves.map((_, i) => i);
  // Remember where dates came FROM before anything moves: a refund's notice is judged on the earlier of the original and the current date,
  // so shuffling a booking later can't turn a 50% refund into 100%.
  const datesBefore = [...new Set([
    ...(b.days ?? []),
    ...((b.kids ?? []).flatMap((k) => k.dates ?? k.days ?? [])),
    ...((b.sessions ?? []).map(isoOfLabel).filter(Boolean) as string[]),
  ])].sort();
  const labelOfIso = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
  req.moves.forEach((m, i) => {
    const ok = idxs.includes(i);
    m.approved = ok;
    if (ok && m.from && m.to) {
      b.dayOrigin = b.dayOrigin ?? {};
      const origin = b.dayOrigin[m.from] ?? m.from;
      const keep = b.dayOrigin[m.to];
      b.dayOrigin[m.to] = keep && keep < origin ? keep : origin;
      if (m.from !== m.to) delete b.dayOrigin[m.from];
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
      // A per-day extra (the lunch for that day) moves with its day, or the register would show it on a day the child no longer attends.
      for (const l of b.addonLines ?? []) {
        if (!l.perDay || !l.days?.includes(m.from)) continue;
        if (kid && l.child.trim() !== kid.name.trim()) continue;
        l.days = l.days.map((d) => (d === m.from ? m.to! : d));
      }
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
  // Keep the booking's own `days` in step with its children's dates. A child with its own dates moved above, but b.days still listed the old day:
  // heldPlaces() only counts a child's dates that fall inside b.days, so the next cancel/move/approve read the booking as holding the OLD day
  // and the block's per-day counts drifted from what is really held. A day leaves b.days only when no live child still holds it, and the new
  // day joins it, so a booking whose children moved separately (or only one of them) stays exact.
  const liveKids = (b.kids ?? []).filter((k) => !k.cancelled);
  if (liveKids.some((k) => (k.dates?.length ?? k.days?.length ?? 0) > 0)) {
    const heldByKid = (k: { dates?: string[]; days?: string[]; cancelledDays?: string[] }) => (k.dates?.length ? k.dates : k.days ?? []).filter((d) => !(k.cancelledDays ?? []).includes(d));
    const stillHeld = new Set(liveKids.flatMap(heldByKid));
    const movedPairs = req.moves.filter((m, i) => idxs.includes(i) && m.from && m.to && m.from !== m.to);
    if (movedPairs.length && b.days?.length) {
      const next = new Set(b.days);
      for (const m of movedPairs) {
        if (!stillHeld.has(m.from)) next.delete(m.from);
        if (stillHeld.has(m.to!)) next.add(m.to!);
      }
      b.days = [...next].sort();
    }
  }
  if (datesBefore.length && req.moves.some((m, i) => idxs.includes(i) && m.from && m.to)) {
    const earliest = b.origFirstDate && b.origFirstDate < datesBefore[0] ? b.origFirstDate : datesBefore[0];
    b.origFirstDate = earliest;
  }
  b.amendMovesApproved = (b.amendMovesApproved ?? 0) + req.moves.filter((m, i) => idxs.includes(i) && m.from && m.to).length;
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
  if (opts.selfService) req.selfService = true;
  // Setup > Amending dates > admin fee: charged once, on a request that actually moved something.
  if (!req.feeCharged && req.moves.some((m, i) => idxs.includes(i) && m.from && m.to)) {
    const charged = addAmendFee(b, opts.fee);
    if (charged > 0) req.feeCharged = charged;
  }
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

/**
 * Setup > Amending dates > "most moves per booking". `used` is how many moves the provider has already approved on this booking;
 * a new request that would take it past `limit` is refused. 0 / unset = no limit.
 */
export function amendLimitError(moves: AmendMove[], used: number, limit: number | undefined): string | null {
  if (!limit || limit <= 0) return null;
  const asking = moves.filter((m) => m.from).length;
  if (asking === 0) return null;
  if (used >= limit) return `This booking has already had its ${limit} date change${limit === 1 ? "" : "s"}. Please contact the provider.`;
  if (used + asking > limit) return `This provider allows ${limit} date change${limit === 1 ? "" : "s"} per booking and ${used} ${used === 1 ? "has" : "have"} been used, so only ${limit - used} more can be requested.`;
  return null;
}

/**
 * Setup > Amending dates > "admin fee": add the fee to the booking's price and leave it OWING — the amount the family has already
 * paid is pinned in `amountPaid` first, so the new total shows a balance of exactly the fee (and the pay-link/Pay now ask for just that).
 * Nothing is charged on a free / funded (£0 or HAF) place, a cancelled booking, or when no fee is set. Returns the fee actually added.
 */
export function addAmendFee(b: Booking, fee: number | undefined): number {
  const f = Math.round((Number(fee) || 0) * 100) / 100;
  if (f <= 0 || (b.amount ?? 0) <= 0 || b.pay === "Funded" || b.status === "Cancelled" || b.status === "Declined") return 0;
  const received = cashReceivedOf(b);
  if (received > 0) b.amountPaid = received;
  b.amount = Math.round(((b.amount ?? 0) + f) * 100) / 100;
  if (b.pay === "Paid") b.pay = "Partially paid";
  b.amendFeesCharged = Math.round(((b.amendFeesCharged ?? 0) + f) * 100) / 100;
  return f;
}

/**
 * Setup > Amending dates > "allow moves to a cheaper session": when OFF, a move onto a day that costs less than the day given up is refused.
 * `priceOf(date)` is that day's per-day price, or undefined when the day carries no price of its own (then nothing can be compared and the move is allowed).
 */
export function amendCheaperError(moves: AmendMove[], priceOf: (date: string) => number | undefined, allowCheaper: boolean): string | null {
  if (allowCheaper) return null;
  for (const mv of moves) {
    if (!mv.from) continue;
    const was = priceOf(mv.from);
    const now = priceOf(mv.to);
    if (was === undefined || now === undefined) continue;
    if (now < was - 0.004) return `${prettyDay(mv.to)} costs less than ${prettyDay(mv.from)}. This provider doesn't allow moves to a cheaper session.`;
  }
  return null;
}
