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

/** Pay states that count as PAID for the join link: money received, nothing owed (Funded = a £0 / fully covered place), or paid and later part-released.
 *  Everything else (Unpaid, Invoice sent, Awaiting voucher payment, Partially paid, Pending, Refunded, Refund pending...) does NOT unlock the link. */
const JOIN_PAID = new Set(["Paid", "Funded", "Partially refunded"]);

/** Is this booking's child on this session today: confirmed, not cancelled/declined/waitlisted, on that date, and PAID (see JOIN_PAID). */
export function bookingJoinable(b: Booking, date: string): boolean {
  if (b.status !== "Confirmed") return false;
  if (!JOIN_PAID.has(String(b.pay))) return false;
  return registerRows(b, date).some((r) => r.expected);
}


/** Should the provider's OWN session link (Zoom etc.) be shown to a booked family right now? Only for an own-link listing that HAS a link, inside
 *  the join window (10 minutes before the start) unless the provider ticked "show the link straight away". Never in a public listing. */
export function ownLinkVisible(listing: { videoMode?: string; ownLink?: string; showLinkNow?: boolean }, windowOpen: boolean): boolean {
  return listing.videoMode === "own" && !!listing.ownLink && (windowOpen || listing.showLinkNow === true);
}

/** Confirmed, NOT yet paid (unpaid, invoice sent, awaiting a voucher, part-paid...; not refunded) and the child is on that day: the family should be told the join link unlocks once they pay. */
export function bookingAwaitingPayOnline(b: Booking, date: string): boolean {
  if (b.status !== "Confirmed" || JOIN_PAID.has(String(b.pay)) || b.pay === "Refunded" || b.pay === "Refund pending") return false;
  return registerRows(b, date).some((r) => r.expected);
}

/** May the confirmation EMAIL print the provider's own link? Only when the listing says "show the link straight away" AND the family has paid: an unpaid
 *  family is told it unlocks on payment (the link used to be printed under that very sentence). */
export function emailShowsOwnLink(listing: { videoMode?: string; ownLink?: string; showLinkNow?: boolean }, unpaid: boolean | undefined): boolean {
  return listing.videoMode === "own" && !!listing.ownLink && listing.showLinkNow === true && !unpaid;
}

/** Is this a usable own-session link: a full https URL (anything else is refused at publish: families tap it on a phone). */
export function validOwnLink(v: string | undefined | null): boolean {
  const s = (v ?? "").trim();
  if (!/^https:\/\/[^\s/$.?#][^\s]*$/i.test(s)) return false;
  try { return !!new URL(s).hostname.includes("."); } catch { return false; }
}

export type JoinState = "unpaid" | "early" | "early_own" | "waiting_host" | "open" | "finished" | "no_link";

/** What a family sees about joining one online session. ONE place decides it (the browser only draws it).
 *  unpaid: the join link is locked until the booking is paid. early: our room, window not open yet. early_own: the provider's own link, not shown yet.
 *  waiting_host: window open but the host has not started (children never enter an empty room). open: Join / Open link now. no_link: own-link
 *  listing without a link. finished: past the join window. */
export function joinState(p: { paid: boolean; mode: "platform" | "own"; now: number; opensAt: number; closesAt: number; hostLive: boolean; hasLink: boolean; showLinkNow?: boolean }): JoinState {
  if (p.now > p.closesAt) return "finished";
  if (!p.paid) return "unpaid";
  const open = p.now >= p.opensAt;
  if (p.mode === "own") {
    if (!p.hasLink) return "no_link";
    return open || p.showLinkNow === true ? "open" : "early_own";
  }
  if (!open) return "early";
  return p.hostLive ? "open" : "waiting_host";
}

/** The hosting choice a listing should carry: its own when it has one, "platform" (ActivityLane room) when its venue is the account's "online" place
 *  and nothing was chosen, otherwise none (a venue or home-visit listing). */
export function videoModeDefault(venues: { id: string; kind?: string }[] | undefined, venueId: string | undefined, current: string | undefined): "platform" | "own" | undefined {
  if (current === "platform" || current === "own") return current;
  if (!venueId) return undefined;
  return (venues ?? []).find((v) => v.id === venueId)?.kind === "online" ? "platform" : undefined;
}
