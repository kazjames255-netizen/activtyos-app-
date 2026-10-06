// PURE rules for online sessions (extracted from onlineSessions.ts, behaviour unchanged). No database: see tests/regression/.
import { registerRows } from "./registerRows";
import type { Booking } from "../../../features/bookings/types";

/** Europe/London wall-clock date+time → the UTC instant (handles BST). */
export function ukWallToUtc(date: string, time: string): Date {
  const [y, mo, d] = date.split("-").map(Number);
  const [h, mi] = time.split(":").map(Number);
  const offsetMin = (at: Date) => {
    const p = Object.fromEntries(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }).formatToParts(at).map((x) => [x.type, x.value]));
    return (Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), Number(p.hour), Number(p.minute), Number(p.second)) - at.getTime()) / 60000;
  };
  const wall = Date.UTC(y, mo - 1, d, h, mi);
  let utc = wall - offsetMin(new Date(wall)) * 60000;
  utc = wall - offsetMin(new Date(utc)) * 60000;
  return new Date(utc);
}

/** Is this booking's child on this session today: confirmed, not cancelled/declined/waitlisted, on that date, and not left unpaid or refunded. */
export function bookingJoinable(b: Booking, date: string): boolean {
  if (b.status !== "Confirmed") return false;
  if (b.pay === "Unpaid" || b.pay === "Refunded" || b.pay === "Refund pending") return false;
  return registerRows(b, date).some((r) => r.expected);
}


/** Should the provider's OWN session link (Zoom etc.) be shown to a booked family right now? Only for an own-link listing that HAS a link, inside
 *  the join window (10 minutes before the start) unless the provider ticked "show the link straight away". Never in a public listing. */
export function ownLinkVisible(listing: { videoMode?: string; ownLink?: string; showLinkNow?: boolean }, windowOpen: boolean): boolean {
  return listing.videoMode === "own" && !!listing.ownLink && (windowOpen || listing.showLinkNow === true);
}
