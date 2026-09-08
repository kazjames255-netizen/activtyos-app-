import { Router } from "express";
import { db } from "../firebase";
import { operatorScope } from "../middleware/role";
import { fromDoc, type BookingDoc } from "../lib/bookingDoc";
import { blockSummary, type BlockDoc } from "../lib/blockDomain";
import type { Booking } from "../../../features/bookings/types";

// ─────────────────────────────────────────────────────────────────────────
// Growth — the "Marketing strategies" page reimagined as a data-driven engine.
// Pure read: it reads the tenant's own bookings, blocks, families, reviews and
// posts, spots where numbers (and money) are being left on the table, and
// returns a ranked list of PLAYS. Each play carries a real signal, an estimated
// impact and the in-app view its action button should deep-link to. No writes,
// no new collection. Scoped like the dashboard (venue / franchise lenses).
// ─────────────────────────────────────────────────────────────────────────
export const growth = Router();

const DAY = 86_400_000;
const round2 = (n: number) => Math.round(n * 100) / 100;
const roundTo = (n: number, step: number) => Math.round(n / step) * step;
const WEEKDAY = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

// A booking that "counts" — holds a place, not cancelled/declined.
const LIVE = (b: Booking) => !["Cancelled", "Declined", "Refunded"].includes(b.status);

interface Play {
  id: string;
  icon: string;         // Tabler-ish name; the client maps it to its own glyph
  title: string;
  signal: string;       // the data fact (what we found)
  insight: string;      // why it matters
  impactLabel: string;  // headline shown on the card (£ or %)
  impactValue: number;  // £/score used only to RANK plays
  actionLabel: string;
  actionView: string;   // in-app view to deep-link to
  // When set, the button opens the Email campaign composer with THIS audience
  // pre-selected (a segment id the Email app knows: "all" / "seg-active" /
  // "seg-past" / "seg-waitlisted"). The composer then lets them pick a quick
  // template or build a full newsletter — same audience either way.
  audienceId?: string;
  // Optional second link (e.g. "set up a code first") for offer-led plays.
  secondary?: { label: string; view: string };
}

growth.get("/", async (req, res) => {
  const scope = operatorScope(req, res);
  if (!scope) return;
  const tenantId = scope.role === "platform" && typeof req.query.tenantId === "string" ? req.query.tenantId : scope.tenantId;
  if (!tenantId) { res.status(400).json({ error: "No tenant in scope" }); return; }

  const [bookingsSnap, blocksSnap, listingsSnap, reviewsSnap, postsSnap, memSnap, customersSnap] = await Promise.all([
    db.collection("bookings").where("tenantId", "==", tenantId).get(),
    db.collection("blocks").where("tenantId", "==", tenantId).get(),
    db.collection("listings").where("tenantId", "==", tenantId).get(),
    db.collection("reviews").where("tenantId", "==", tenantId).get(),
    db.collection("posts").where("tenantId", "==", tenantId).get(),
    db.collection("memberships").where("tenantId", "==", tenantId).get(),
    db.collection("customers").where("tenantId", "==", tenantId).get(),
  ]);

  const now = Date.now();
  const today = new Date(now).toISOString().slice(0, 10);
  const in30 = new Date(now + 30 * DAY).toISOString().slice(0, 10);

  // Operator-tunable segment thresholds (passed from the page, with sensible
  // defaults + clamps). "New" = first booked within N days · "Lapsed" = no
  // booking for N months · "Loyal" = at least N bookings.
  const clampInt = (v: unknown, lo: number, hi: number, dflt: number) => { const n = parseInt(String(v), 10); return isNaN(n) ? dflt : Math.min(hi, Math.max(lo, n)); };
  const newDays = clampInt(req.query.newDays, 7, 365, 30);
  const lapsedMonths = clampInt(req.query.lapsedMonths, 1, 36, 3);
  const loyalMin = clampInt(req.query.loyalMin, 2, 20, 2);

  // Scope lens: franchise (own "__ho__" = no franchise owner) and/or venue,
  // resolved to the set of listing ids we're allowed to count. Same rule the
  // dashboard uses so figures line up across the app.
  const franchiseId = scope.role === "franchise" ? scope.franchiseId
    : (typeof req.query.franchiseId === "string" && req.query.franchiseId ? req.query.franchiseId : null);
  const venueId = typeof req.query.venueId === "string" && req.query.venueId ? req.query.venueId : null;
  const ownOnly = franchiseId === "__ho__";
  const allowedIds: Set<string> | null = (venueId || franchiseId)
    ? new Set(listingsSnap.docs.filter((d) => {
        const l = d.data() as { venueId?: string | null; franchiseId?: string | null };
        const frOk = !franchiseId || (ownOnly ? !l.franchiseId : l.franchiseId === franchiseId);
        return (!venueId || l.venueId === venueId) && frOk;
      }).map((d) => d.id))
    : null;

  // Live listings (within the franchise/venue scope) — the options for the page's
  // "filter by listing" control. Computed BEFORE the single-listing narrowing.
  const listingOptions = listingsSnap.docs
    .filter((d) => {
      const l = d.data() as { status?: string; franchiseId?: string | null; venueId?: string | null };
      const frOk = !franchiseId || (ownOnly ? !l.franchiseId : l.franchiseId === franchiseId);
      return frOk && (!venueId || l.venueId === venueId) && (l.status ?? "live") === "live" && (!allowedIds || allowedIds.has(d.id));
    })
    .map((d) => ({ id: d.id, name: ((d.data() as { name?: string; title?: string }).name || (d.data() as { title?: string }).title || "Listing") }))
    .sort((a, b) => a.name.localeCompare(b.name));

  // ?listingId= narrows EVERYTHING (families, segments, audiences, listings, plays)
  // to one listing — "the Summer Camp world". Intersected with the franchise scope.
  const pickListing = typeof req.query.listingId === "string" && req.query.listingId ? req.query.listingId : null;
  const effectiveIds: Set<string> | null = pickListing
    ? new Set(allowedIds ? [pickListing].filter((id) => allowedIds.has(id)) : [pickListing])
    : allowedIds;
  const inScope = (listingId?: string | null) => !effectiveIds || (listingId != null && effectiveIds.has(listingId));
  // Franchise/venue scope IGNORING the single-listing focus — used to build each
  // family's OVERALL lifecycle, so a focused listing's families keep their real
  // new/loyal/lapsed status and can never exceed the all-listings totals.
  const frInScope = (listingId?: string | null) => !allowedIds || (listingId != null && allowedIds.has(listingId));

  const allLive = bookingsSnap.docs.map((d) => fromDoc(d.data() as BookingDoc)).filter(LIVE);
  const bookings = allLive.filter((b) => inScope(b.listingId));   // listing-scoped when focused
  const live = bookings;
  const liveFr = pickListing ? allLive.filter((b) => frInScope(b.listingId)) : bookings; // franchise-wide lifecycle

  // ── Money baselines ──────────────────────────────────────────────────────
  const paidAmounts = live.map((b) => b.amount ?? 0).filter((n) => n > 0);
  const avgSeatValue = paidAmounts.length ? paidAmounts.reduce((a, b) => a + b, 0) / paidAmounts.length : 0;

  // Per-listing average booking value + title, for "revenue at stake" and cards.
  const sumByListing = new Map<string, { sum: number; n: number }>();
  for (const b of live) { const lid = b.listingId; if (!lid || !(b.amount && b.amount > 0)) continue; const c = sumByListing.get(lid) ?? { sum: 0, n: 0 }; c.sum += b.amount; c.n += 1; sumByListing.set(lid, c); }
  const avgForListing = (lid: string) => { const c = sumByListing.get(lid); return c && c.n ? c.sum / c.n : avgSeatValue; };
  const titleOf = new Map(listingsSnap.docs.map((d) => [d.id, ((d.data() as { title?: string; name?: string }).title || (d.data() as { name?: string }).name || "Untitled listing")]));

  // ── Families (by email) ────────────────────────────────────────────────────
  // Lifecycle from the family's FULL history (franchise-wide), then — when a listing
  // is focused — show only families who booked that listing, with their overall
  // new/loyal/lapsed bucket intact.
  const famAll = new Map<string, { bookings: number; firstMs: number; lastMs: number; spend: number }>();
  for (const b of liveFr) {
    const email = (b.email || "").toLowerCase();
    if (!email) continue;
    const ms = b.createdAt ? Date.parse(b.createdAt) : now;
    const t = isNaN(ms) ? now : ms;
    const cur = famAll.get(email) ?? { bookings: 0, firstMs: t, lastMs: 0, spend: 0 };
    cur.bookings += 1;
    cur.spend += b.amount ?? 0;
    cur.lastMs = Math.max(cur.lastMs, t);
    cur.firstMs = Math.min(cur.firstMs, t);
    famAll.set(email, cur);
  }
  const focusEmails = pickListing ? new Set(live.map((b) => (b.email || "").toLowerCase()).filter(Boolean)) : null;
  const fam = focusEmails ? new Map([...famAll].filter(([e]) => focusEmails.has(e))) : famAll;
  const families = [...fam.values()];
  const listSize = families.length;
  const repeatFamilies = families.filter((f) => f.bookings >= 2).length;
  const repeatRate = listSize ? Math.round((repeatFamilies / listSize) * 100) : 0;
  const avgSpendPerFamily = listSize ? families.reduce((a, f) => a + f.spend, 0) / listSize : 0;

  // ── Audience segmentation — ONE clean partition (each family in exactly one
  // bucket) used by BOTH the segmentation bar AND the advice cards, so every
  // number reconciles. Priority: lapsed → new (first booked ≤30d) → loyal (2+) → one-time.
  const LAPSED_MS = now - lapsedMonths * 30 * DAY, NEW_MS = now - newDays * DAY;
  const isLapsed = (f: { lastMs: number }) => f.lastMs > 0 && f.lastMs < LAPSED_MS;
  const bucketOf = (f: { bookings: number; firstMs: number; lastMs: number }) =>
    isLapsed(f) ? "lapsed" : f.firstMs >= NEW_MS ? "new" : f.bookings >= loyalMin ? "loyal" : "onetime";
  const bkt = { new: 0, onetime: 0, loyal: 0, lapsed: 0 } as Record<string, number>;
  for (const f of families) bkt[bucketOf(f)] += 1;
  const segLapsed = bkt.lapsed, segLoyal = bkt.loyal, segOneTime = bkt.onetime, segNew = bkt.new;
  const waitEmails = new Set<string>();
  for (const b of live) { if ((b.status === "Waitlisted" || b.status === "Offered") && b.email) waitEmails.add(b.email.toLowerCase()); }
  const enquiryEmails = new Set(customersSnap.docs
    .map((d) => ((d.data() as { email?: string }).email ?? "").toLowerCase())
    .filter((e) => e.includes("@") && !famAll.has(e)));

  // ── Sessions across open blocks (occupancy + the fill signal + weekday mix) ──
  let openCap = 0, openBooked = 0;
  let empty30 = 0, lowSessions30 = 0, low30Value = 0;
  const wdBooked = new Array(7).fill(0), wdCap = new Array(7).fill(0);
  // Per-listing future occupancy (for the "your listings" cards + advice).
  const perListing = new Map<string, { cap: number; booked: number; spots: number; next: string }>();
  for (const d of blocksSnap.docs) {
    const doc = d.data() as BlockDoc;
    if (!inScope(doc.listingId)) continue;
    const sum = blockSummary(d.id, doc);
    if (!sum.open) continue;
    const lid = doc.listingId || "";
    for (const s of sum.sessions) {
      if (s.date < today) continue;
      openCap += s.capacity; openBooked += s.bookedCount;
      const wd = new Date(`${s.date}T00:00:00Z`).getUTCDay();
      wdBooked[wd] += s.bookedCount; wdCap[wd] += s.capacity;
      const pl = perListing.get(lid) ?? { cap: 0, booked: 0, spots: 0, next: "9999-99-99" };
      pl.cap += s.capacity; pl.booked += s.bookedCount; pl.spots += s.spotsLeft;
      if (s.date < pl.next) pl.next = s.date;
      perListing.set(lid, pl);
      if (s.date <= in30 && s.capacity > 0) {
        const pct = s.bookedCount / s.capacity;
        if (pct < 0.7) { empty30 += s.spotsLeft; lowSessions30 += 1; low30Value += s.spotsLeft * avgSeatValue; }
      }
    }
  }
  const occupancy = openCap ? Math.round((openBooked / openCap) * 100) : 0;

  // ── Reviews & last post ─────────────────────────────────────────────────────
  const reviewDocs = reviewsSnap.docs.map((d) => d.data() as { franchiseId?: string | null });
  const reviews = reviewDocs.filter((r) => !franchiseId || (ownOnly ? !r.franchiseId : r.franchiseId === franchiseId)).length;
  // "Attended" = the booking's LAST session date has passed (kids have actually
  // been), not merely booked. These are the families worth asking for a review.
  const attended = live.filter((b) => { const last = b.days?.length ? [...b.days].sort().pop()! : null; return !!last && last < today; }).length;

  const postTimes = postsSnap.docs
    .map((d) => d.data() as { createdAt?: string; franchiseId?: string | null })
    .filter((p) => !franchiseId || (ownOnly ? !p.franchiseId : p.franchiseId === franchiseId))
    .map((p) => (p.createdAt ? Date.parse(p.createdAt) : 0))
    .filter((n) => n > 0);
  const lastPostMs = postTimes.length ? Math.max(...postTimes) : 0;
  const daysSincePost = lastPostMs ? Math.floor((now - lastPostMs) / DAY) : null;

  // ── Memberships ─────────────────────────────────────────────────────────────
  const memEmails = new Set(memSnap.docs.map((d) => (d.data() as { email?: string }).email?.toLowerCase()).filter(Boolean));
  const regularsNotMembers = [...fam.entries()].filter(([email, f]) => f.bookings >= 3 && !memEmails.has(email)).length;

  // ── Lapsed families: booked, but not within the lapsed window ───────────────
  const lapsed = segLapsed;

  // ── Build the plays (only when there's a real signal) ───────────────────────
  const plays: Play[] = [];

  if (empty30 > 0) {
    plays.push({
      id: "fill-empty", icon: "calendar-stats", title: "Fill your quiet sessions",
      signal: `${empty30} empty ${empty30 === 1 ? "space" : "spaces"} across ${lowSessions30} ${lowSessions30 === 1 ? "session" : "sessions"} in the next 30 days`,
      insight: "Sessions under 70% full rarely fill themselves — an early-bird or flash code brings them forward.",
      impactLabel: `£${roundTo(low30Value, 10).toLocaleString()} within reach`, impactValue: low30Value,
      actionLabel: "Email families an offer", actionView: "email", audienceId: "seg-active",
      secondary: { label: "＋ set up an early-bird code", view: "marketing" },
    });
  }
  if (lapsed >= 3) {
    const winBack = lapsed * avgSpendPerFamily * 0.2;
    plays.push({
      id: "lapsed", icon: "mail-heart", title: "Win back lapsed families",
      signal: `${lapsed} families booked with you before but not in the last ${lapsedMonths} months`,
      insight: "A short, personal ‘we miss you’ offer to this exact list typically wins back around 1 in 5.",
      impactLabel: `£${roundTo(winBack, 10).toLocaleString()} within reach`, impactValue: winBack,
      actionLabel: "Email them an offer", actionView: "email", audienceId: "seg-past",
      secondary: { label: "＋ add a win-back code", view: "marketing" },
    });
  }
  if (attended >= 5 && reviews < Math.max(10, attended * 0.15)) {
    plays.push({
      id: "reviews", icon: "star", title: "Turn happy families into reviews",
      signal: `${attended} bookings have finished (the children attended) but you have only ${reviews} ${reviews === 1 ? "review" : "reviews"}`,
      insight: "Listings with strong review counts convert far more browsers — and it costs nothing to ask.",
      impactLabel: "More enquiries", impactValue: attended * avgSeatValue * 0.05,
      actionLabel: "Email a review request", actionView: "email", audienceId: "all",
      secondary: { label: "Open Reviews", view: "reviews" },
    });
  }
  if (regularsNotMembers >= 2) {
    plays.push({
      id: "memberships", icon: "crown", title: "Put your regulars on a plan",
      signal: `${regularsNotMembers} regular families (3+ bookings) aren't on a membership`,
      insight: "Members book more often and stay longer — a plan turns your best families into steady income.",
      impactLabel: `${regularsNotMembers} to convert`, impactValue: regularsNotMembers * avgSpendPerFamily * 0.15,
      actionLabel: "Email your regulars", actionView: "email", audienceId: "seg-active",
      secondary: { label: "Set up membership tiers", view: "memberships" },
    });
  }
  if (daysSincePost == null || daysSincePost >= 14) {
    plays.push({
      id: "re-engage", icon: "speakerphone", title: "Re-engage your list",
      signal: daysSincePost == null
        ? `You haven't posted an update yet — you have ${listSize} families to reach`
        : `Your last update was ${daysSincePost} days ago — you have ${listSize} families to reach`,
      insight: "Providers who post regularly stay top-of-mind and see more repeat bookings.",
      impactLabel: `${listSize} families`, impactValue: listSize * 2,
      actionLabel: "Send a newsletter", actionView: "email", audienceId: "all",
      secondary: { label: "Post to the newsfeed instead", view: "newsfeed" },
    });
  }
  // Midweek dip — the quietest weekday vs the busiest, among days you actually run.
  {
    const fills = wdCap.map((c, i) => ({ wd: i, fill: c > 0 ? wdBooked[i] / c : -1 })).filter((x) => x.fill >= 0);
    if (fills.length >= 2) {
      const lo = fills.reduce((a, b) => (b.fill < a.fill ? b : a));
      const hi = fills.reduce((a, b) => (b.fill > a.fill ? b : a));
      const gap = Math.round((hi.fill - lo.fill) * 100);
      if (gap >= 20) {
        plays.push({
          id: "midweek", icon: "calendar-week", title: `Beat the ${WEEKDAY[lo.wd]} dip`,
          signal: `${WEEKDAY[lo.wd]}s run ${gap}% emptier than ${WEEKDAY[hi.wd]}s`,
          insight: "A day-specific offer smooths demand and lifts the sessions that need it most.",
          impactLabel: `${gap}% gap to close`, impactValue: gap * avgSeatValue,
          actionLabel: `Email a ${WEEKDAY[lo.wd]} offer`, actionView: "email", audienceId: "seg-active",
          secondary: { label: "＋ set up a midweek code", view: "marketing" },
        });
      }
    }
  }

  plays.sort((a, b) => b.impactValue - a.impactValue);

  // ── Audiences: who's in your world + what to do with each (advice + email link).
  // `base:true` = part of your booked base (these four sum to listSize + match the
  // segmentation bar). `base:false` = side lists that are NOT booked yet. ──
  const audienceDefs = [
    { key: "new", emoji: "🌱", label: "New this month", count: segNew, base: true, blurb: `First booked in the last ${newDays} days`, advice: "Make a great first impression: a welcome email and a nudge toward their next booking or a sibling place.", audienceId: "seg-active", goal: "welcome", tone: "blue" },
    { key: "onetime", emoji: "🔁", label: "One-time families", count: segOneTime, base: true, blurb: "Booked once — not yet regulars", advice: "Convert them with a returning-family discount or a taster of a different activity.", audienceId: "seg-active", goal: "winback", tone: "sky" },
    { key: "loyal", emoji: "💛", label: "Loyal families", count: segLoyal, base: true, blurb: `Booked ${loyalMin}+ times — your best customers`, advice: "Reward loyalty: offer a membership, early access to new dates, or a thank-you code.", audienceId: "seg-active", goal: "membership", tone: "green" },
    { key: "lapsed", emoji: "💤", label: "Lapsed families", count: segLapsed, base: true, blurb: `No booking in ${lapsedMonths}+ months`, advice: "Win them back with a personal 'we've missed you' offer before they forget you.", audienceId: "seg-past", goal: "winback", tone: "red" },
    { key: "enquiries", emoji: "📩", label: "New enquiries", count: enquiryEmails.size, base: false, blurb: "Interested but never booked", advice: "Send a warm welcome with a first-booking incentive — only to those who've opted in to marketing.", audienceId: "seg-enquiries", goal: "welcome", tone: "amber" },
    { key: "waitlisted", emoji: "⏳", label: "Waitlisted", count: waitEmails.size, base: false, blurb: "Waiting or holding an offer", advice: "Tell them the moment a place opens, or offer an alternative date so they don't drift away.", audienceId: "seg-waitlisted", goal: "", tone: "purple" },
  ];
  const audiences = audienceDefs.filter((a) => a.count > 0);
  // The segmentation bar reads the SAME partition buckets the cards use.
  const segments = [
    { key: "new", label: "New", count: bkt.new, tone: "blue" },
    { key: "onetime", label: "One-time", count: bkt.onetime, tone: "sky" },
    { key: "loyal", label: "Loyal", count: bkt.loyal, tone: "green" },
    { key: "lapsed", label: "Lapsed", count: bkt.lapsed, tone: "red" },
  ].filter((s) => s.count > 0);

  // ── Listings: fill, revenue at stake, and a specific recommendation per listing ──
  const listings = [...perListing.entries()]
    .filter(([, v]) => v.cap > 0 && v.spots > 0)
    .map(([lid, v]) => {
      const pct = Math.round((v.booked / v.cap) * 100);
      const revenueAtStake = Math.round(v.spots * avgForListing(lid));
      const health = pct < 50 ? "quiet" : pct < 85 ? "filling" : "full";
      const advice = health === "quiet"
        ? "Running quiet. Email active families an early-bird, and win back families who came to this before — a limited code creates urgency."
        : health === "filling"
          ? "Filling nicely. Nudge your waitlist and recent enquiries to close out the last places."
          : "Almost full — protect your margin. Open a waitlist, add a session, or hold prices firm rather than discounting.";
      return {
        id: lid, title: titleOf.get(lid) ?? "Listing", nextDate: v.next === "9999-99-99" ? null : v.next,
        capacity: v.cap, booked: v.booked, spotsLeft: v.spots, pct, revenueAtStake, health,
        advice, audienceId: health === "full" ? undefined : "seg-active", goal: health === "full" ? undefined : "fill",
      };
    })
    .sort((a, b) => b.revenueAtStake - a.revenueAtStake)
    .slice(0, 8);

  const revenueWithinReach = roundTo(low30Value + segLapsed * avgSpendPerFamily * 0.2, 10);

  res.json({
    stats: { occupancy, repeatRate, reviews, listSize, revenueWithinReach },
    thresholds: { newDays, lapsedMonths, loyalMin },
    listingOptions,
    listingId: pickListing,
    segments,
    audiences,
    listings,
    plays: plays.map(({ impactValue, ...p }) => ({ ...p, impactValue: round2(impactValue) })),
  });
});
