import { db } from "../firebase";
import { ukToday } from "./ukDate";

// ── Merge fields: ONE resolver for every send path ────────────────────────
// {ParentName} {ChildName} {ProviderName} {ListingName} {SessionDate}
// {VenueName} {BookingRef}
//
// This used to live inside lib/emailSend.ts (bulk Email sends) with a second,
// weaker copy in routes/messages.ts (`mergeText`) — which is why a plain 1:1
// message went out with a literal "Hi {ParentName}" and a broadcast filled only
// 4 of the 7 tokens. Every path now resolves from here, so there is one source
// of truth for values AND for what happens when there's no data.
//
// FALLBACK RULE (never "undefined"/"null", never a raw {Token} in the family's
// copy): an unresolved merge field degrades to neutral prose, so a message that
// can't be personalised still reads like English — see TOKEN_FALLBACK. The one
// exception is {BookingRef}, which degrades to an EMPTY string: there is no
// sensible prose stand-in for a reference number. Braces that aren't one of the
// seven merge fields are left exactly as typed (they're the operator's own
// text, not a field we failed to fill).

export type MergeCtx = Record<string, string>;

export const TOKEN_RE = /\{(ParentName|ChildName|ProviderName|ListingName|SessionDate|VenueName|BookingRef)\}/i;

/** Cheap gate: only pay for the lookups when the content actually merges. */
export const hasMergeTokens = (...parts: (string | undefined)[]): boolean =>
  TOKEN_RE.test(parts.filter(Boolean).join(" "));

/** Neutral phrasing for a family we can't match to a booking — a message that
 *  reads a little generic beats one with {SessionDate} left in it. */
export const TOKEN_FALLBACK: Record<string, string> = {
  parentname: "there",
  childname: "your child",
  providername: "your activity provider",
  listingname: "your booking",
  sessiondate: "your booked dates",
  venuename: "the venue",
  bookingref: "",
};

// Merge values are PARENT-TYPED (their name, their child's name). Filled into
// HTML they're escaped — a child named `<a href=…>` used to become a live link
// in an email sent from the provider's own address. Subjects/plain bodies are
// plain text.
const escMerge = (v: string) => v.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));

export const applyTokens = (s: string, ctx: MergeCtx, html = false): string =>
  s.replace(/\{([A-Za-z]+)\}/g, (raw, t: string) => {
    const key = t.toLowerCase();
    const v = ctx[key] ?? TOKEN_FALLBACK[key];
    return v === undefined ? raw : html ? escMerge(v) : v;
  });

/** The booking fields every token is derived from. */
export interface BookingLike {
  email?: string;
  status?: string;
  booker?: string;
  child?: string;
  kids?: { name?: string }[];
  days?: string[];
  dates?: string;
  listing?: string;
  listingId?: string;
  ref?: string;
}

export interface TenantMergeBase {
  /** {ProviderName}: the display name the provider chose, else the account name. */
  providerName: string;
  /** The raw tenant doc name — what thread/email headers have always shown. */
  tenantName: string;
  venues: { id: string; name: string }[];
}

/** {ProviderName} + the tenant's venue list (venues live on the LIBRARY doc —
 *  routes/messages.ts used to look for them on the tenant doc, so {VenueName}
 *  never resolved on the booking path). Two doc reads, shared by a whole send. */
export async function tenantMergeBase(tenantId: string): Promise<TenantMergeBase> {
  const [tenant, lib] = await Promise.all([
    db.collection("tenants").doc(tenantId).get(),
    db.collection("libraries").doc(tenantId).get(),
  ]);
  const settings = (lib.data()?.settings ?? {}) as { providerName?: string };
  const tenantName = (tenant.exists ? (tenant.get("name") as string | undefined) : undefined) || "Your activity provider";
  return {
    providerName: settings.providerName?.trim() || tenantName,
    tenantName,
    venues: (lib.data()?.venues ?? []) as { id: string; name: string }[],
  };
}

/** Booking → venue name, cached per send. A booking doesn't always store
 *  listingId, so fall back to matching the listing by name within the tenant
 *  (that scan happens at most once per send, and only if it's needed). */
export function venueResolver(tenantId: string, base: TenantMergeBase) {
  const nameOf = (venueId?: string) => (venueId ? base.venues.find((v) => v.id === venueId)?.name ?? "" : "");
  const byListingId = new Map<string, string>();
  let byListingName: Map<string, string> | null = null;
  return async (b: BookingLike): Promise<string> => {
    if (b.listingId) {
      if (!byListingId.has(b.listingId)) {
        const l = await db.collection("listings").doc(b.listingId).get();
        byListingId.set(b.listingId, nameOf(l.exists ? (l.get("venueId") as string | undefined) : undefined));
      }
      const hit = byListingId.get(b.listingId)!;
      if (hit) return hit;
    }
    if (b.listing) {
      if (!byListingName) {
        byListingName = new Map();
        const ls = await db.collection("listings").where("tenantId", "==", tenantId).get();
        for (const d of ls.docs) {
          const x = d.data() as { name?: string; title?: string; venueId?: string };
          for (const n of [x.name, x.title]) if (n && !byListingName.has(n)) byListingName.set(n, x.venueId ?? "");
        }
      }
      return nameOf(byListingName.get(b.listing) || undefined);
    }
    return "";
  };
}

/** One booking → the seven values. Absent values are simply left out, so
 *  applyTokens' fallback (above) decides how they read. */
export function bookingCtx(base: TenantMergeBase, b: BookingLike, venueName = ""): MergeCtx {
  const kids = (b.kids ?? []).map((k) => k.name).filter(Boolean).join(" & ");
  return {
    providername: base.providerName,
    // First name only: "Hi Sarah," reads better than "Hi Sarah Jones,".
    ...(b.booker?.trim() ? { parentname: b.booker.trim().split(/\s+/)[0] } : {}),
    ...(kids || b.child ? { childname: kids || b.child! } : {}),
    ...(b.listing ? { listingname: b.listing } : {}),
    ...(b.dates ? { sessiondate: b.dates } : {}),
    ...(venueName ? { venuename: venueName } : {}),
    ...(b.ref ? { bookingref: b.ref } : {}),
  };
}

/** Parent-level values we know without a booking (a customer record, or the
 *  name the operator is addressing). Booking-scoped tokens fall back. */
export function familyCtx(base: TenantMergeBase, hints: { parentName?: string; childName?: string }): MergeCtx {
  return {
    providername: base.providerName,
    ...(hints.parentName?.trim() ? { parentname: hints.parentName.trim().split(/\s+/)[0] } : {}),
    ...(hints.childName?.trim() ? { childname: hints.childName.trim() } : {}),
  };
}

const live = (b: BookingLike) => b.status !== "Cancelled" && b.status !== "Declined";

/** The family's most relevant booking: the soonest one with a session still to
 *  come, else the most recently finished. (UK wall clock: in BST a UTC "today"
 *  is yesterday until 01:00, which put a session happening TODAY in the
 *  "upcoming" bucket for {SessionDate}.) */
export function pickBest(bookings: BookingLike[], today = ukToday()): BookingLike | null {
  let best: { b: BookingLike; firstUpcoming: string | null; last: string } | null = null;
  for (const b of bookings) {
    if (!live(b)) continue;
    const days = (b.days ?? []).slice().sort();
    const firstUpcoming = days.find((x) => x >= today) ?? null;
    const last = days[days.length - 1] ?? "";
    const wins = !best
      || (firstUpcoming && (!best.firstUpcoming || firstUpcoming < best.firstUpcoming))
      || (!best.firstUpcoming && !firstUpcoming && last > best.last);
    if (wins) best = { b, firstUpcoming, last };
  }
  return best?.b ?? null;
}

/** email → merge context for a BULK send, one context per RECIPIENT, from that
 *  family's most relevant booking. Callers that have already read the tenant's
 *  bookings pass them in so the send doesn't scan the collection twice. */
export async function mergeContexts(
  tenantId: string,
  recipients: string[],
  opts: { bookings?: FirebaseFirestore.QuerySnapshot; base?: TenantMergeBase } = {},
): Promise<Map<string, MergeCtx>> {
  const wanted = new Set(recipients.map((r) => r.toLowerCase()));
  const [base, bookings] = await Promise.all([
    opts.base ? Promise.resolve(opts.base) : tenantMergeBase(tenantId),
    opts.bookings ? Promise.resolve(opts.bookings) : db.collection("bookings").where("tenantId", "==", tenantId).get(),
  ]);
  const mine = new Map<string, BookingLike[]>();
  for (const d of bookings.docs) {
    const b = d.data() as BookingLike;
    const e = (b.email ?? "").toLowerCase();
    if (!wanted.has(e)) continue;
    (mine.get(e) ?? mine.set(e, []).get(e)!).push(b);
  }
  const venueFor = venueResolver(tenantId, base);
  const ctxs = new Map<string, MergeCtx>();
  for (const [email, list] of mine) {
    const b = pickBest(list);
    if (b) ctxs.set(email, bookingCtx(base, b, await venueFor(b)));
  }
  // Everyone still gets {ProviderName} even with no booking on file.
  for (const r of wanted) if (!ctxs.has(r)) ctxs.set(r, { providername: base.providerName });
  return ctxs;
}

/** ONE family's context, for a 1:1 send. Indexed query on (tenantId, email) —
 *  a single message must never scan the whole bookings collection. `hints` are
 *  the parent/child names the caller already has (e.g. the customer record),
 *  used where the family has no booking to read them from. */
export async function mergeContextForEmail(
  tenantId: string,
  email: string,
  hints: { parentName?: string; childName?: string } = {},
): Promise<MergeCtx> {
  const [base, snap] = await Promise.all([
    tenantMergeBase(tenantId),
    db.collection("bookings").where("tenantId", "==", tenantId).where("email", "==", email.toLowerCase()).get(),
  ]);
  const b = pickBest(snap.docs.map((d) => d.data() as BookingLike));
  if (!b) return familyCtx(base, hints);
  const venueFor = venueResolver(tenantId, base);
  // The booking wins where it has a value; the caller's hints fill the gaps.
  return { ...familyCtx(base, hints), ...bookingCtx(base, b, await venueFor(b)) };
}
