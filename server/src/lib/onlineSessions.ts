import { db } from "../firebase";
import { librarySnap } from "./tenantLibrary";
import { fromDoc, type BookingDoc } from "./bookingDoc";
import { registerRows } from "./registerRows";
import { ukWallToUtc, bookingJoinable } from "./onlineRules";
export { ukWallToUtc, bookingJoinable };
import { effectiveSettings } from "../middleware/access";
import { firstOff } from "../../../lib/accessMap";
import type { Booking } from "../../../features/bookings/types";

// Online sessions: a listing whose place is the account's "Online" venue runs as video sessions. One session = one listing on one date.
// The session doc (collection onlineSessions, id `${listingId}_${date}`) is created lazily on the first start/join and is owned by the server:
// it holds the private video room, who has joined, and whether the host has started. No recording exists or is planned.

export const sessionsCol = db.collection("onlineSessions");
export const sessionId = (listingId: string, date: string) => `${listingId}_${date}`;

export interface ListingLite {
  id: string; tenantId: string; franchiseId?: string | null; name: string; title?: string;
  venueId?: string | null; blockId?: string | null; status?: string;
  videoMode?: "platform" | "own"; ownLink?: string; showLinkNow?: boolean; maxJoiners?: string;
}

/** The listing, when it is an online listing (its venue is the account's "online" place). */
export async function onlineListing(listingId: string): Promise<ListingLite | null> {
  if (!listingId || listingId.includes("/")) return null;
  const snap = await db.collection("listings").doc(listingId).get();
  if (!snap.exists) return null;
  const l = { id: snap.id, ...(snap.data() as Omit<ListingLite, "id">) };
  if (!l.venueId) return null;
  const lib = await librarySnap(l.tenantId, l.franchiseId ?? null);
  const venues = ((lib.data() as { venues?: { id: string; kind?: string }[] } | undefined)?.venues ?? []);
  return venues.find((v) => v.id === l.venueId)?.kind === "online" ? l : null;
}

const toMins = (t: string) => { const [h, m] = t.split(":").map(Number); return h * 60 + (m || 0); };

/** When the session on `date` starts and how long it lasts: the booking's chosen timing (period) from the listing's block bundle, else the longest period, else 09:00 for 60 min. */
export async function sessionTimes(listing: ListingLite, date: string, timing?: string | null): Promise<{ startsAt: Date; durationMins: number; label: string }> {
  let start = "09:00", finish = "10:00";
  try {
    if (listing.blockId) {
      const b = await db.collection("blockBundles").doc(listing.blockId).get();
      const ids = ((b.data() as { periodIds?: string[] } | undefined)?.periodIds ?? []).slice(0, 12);
      if (ids.length) {
        const snaps = await db.getAll(...ids.map((id) => db.collection("periods").doc(id)));
        const periods = snaps.filter((s) => s.exists && s.get("tenantId") === listing.tenantId).map((s) => s.data() as { title: string; start: string; finish: string });
        const pick = (timing && periods.find((p) => p.title === timing)) || [...periods].sort((a, b2) => (toMins(b2.finish) - toMins(b2.start)) - (toMins(a.finish) - toMins(a.start)))[0];
        if (pick?.start && pick?.finish) { start = pick.start; finish = pick.finish; }
      }
    }
  } catch { /* keep the default */ }
  const dur = Math.max(15, toMins(finish) - toMins(start));
  return { startsAt: ukWallToUtc(date, start), durationMins: dur, label: start };
}

/** Every confirmed booking that holds this session. */
export async function bookingsFor(listingId: string, date: string): Promise<Booking[]> {
  const snap = await db.collection("bookings").where("listingId", "==", listingId).get();
  return snap.docs.map((d) => fromDoc(d.data() as BookingDoc)).filter((b) => bookingJoinable(b, date));
}

/** Is the Teaching Hub switched on for this provider (opt-in module)? */
export async function hubOn(tenantId: string, franchiseId: string | null): Promise<boolean> {
  try {
    const features = (await effectiveSettings(tenantId, franchiseId)).features as Record<string, unknown> | undefined;
    return !firstOff(features, ["learninghub"]) && features?.learninghub === true;
  } catch { return false; }
}

/** The "how to join" wording for emails: our own room points to My bookings from 10 minutes before; an own link is shown only when the listing says so. Never an address. */
export async function onlineJoinText(listing: ListingLite & { videoMode?: string }, date: string | undefined, timing?: string | null, venueNote?: string, unpaid?: boolean): Promise<string> {
  const day = date ?? ukDay();
  const t = await sessionTimes(listing, day, timing);
  const opens = new Date(t.startsAt.getTime() - 10 * 60_000);
  const clock = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", hour: "numeric", minute: "2-digit", hour12: true }).format(opens).replace(" ", "").toLowerCase();
  const dayLabel = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", weekday: "short", day: "numeric", month: "short" }).format(t.startsAt);
  const lines: string[] = [];
  // Not paid yet: say so first. The join link / button is locked until the booking is paid (card in My bookings, or when the provider marks a bank transfer received).
  if (unpaid) lines.push("Your join link unlocks once your booking is paid: pay by card in My bookings, or it unlocks as soon as your provider marks your bank transfer as received.");
  if (listing.videoMode === "own") {
    if (listing.ownLink && listing.showLinkNow) lines.push(`Your session link: ${listing.ownLink}`);
    else lines.push(`Your session link appears in My bookings from ${clock} on ${dayLabel}, 10 minutes before the start.`);
  } else {
    lines.push(`Join from My bookings from ${clock} on ${dayLabel}. Press "Join session", with your camera on, as soon as your host has started.`);
  }
  if (venueNote) lines.push(venueNote);
  return lines.join("\n");
}
const ukDay = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London" }).format(new Date());
