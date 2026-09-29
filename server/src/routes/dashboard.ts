import { Router } from "express";
import { db } from "../firebase";
import { managerScope } from "../middleware/role";
import { blockSummary, type BlockDoc } from "../lib/blockDomain";
import { owedNow, isMoneyIn } from "../../../features/bookings/helpers";
import type { Booking, BookingStatus } from "../../../features/bookings/types";
import { ukToday } from "../lib/ukDate";
import { indexMissing, noteIndexMissing, withIndexFallback } from "../lib/firestoreNarrow";
import { whereInChunks } from "../lib/firestoreIn";

// ─────────────────────────────────────────────────────────────────────────
// Dashboard — the operator's landing screen. Pure read: it aggregates data
// the other routes already own (bookings, blocks, payments) into the handful
// of numbers a provider wants at 8am — who's in today, what's coming, what
// money came in this week and what's still owed. No new collection.
//
// READ BUDGET (backlog b36). This used to `.get()` bookings, blocks, listings
// and payments WHOLE, every load, every live refresh — a document read per row
// the tenant has ever stored. A provider with a season behind them never
// finished inside the client's 15s abort, and the Firestore bill (a free-tier
// 50k reads/day cap) was paid per dashboard open. Every figure below is now
// either an aggregation query, a query narrowed to the window it actually
// reports on, or — where it genuinely is an all-time figure — a scan with a
// field mask and the rows it can't possibly need filtered out server-side.
// The numbers are unchanged; see the note on each query for why.
// ─────────────────────────────────────────────────────────────────────────
export const dashboard = Router();

// "Outstanding" and "taken" use the SAME rules as the Finance page —
// owedNow() and isMoneyIn() in features/bookings/helpers.ts. This file had its
// own copy (a pay-label list that counted waitlisted places and skipped "Pay
// on the day"), and the two screens disagreed (acceptance d19s7).
const round2 = (n: number) => Math.round(n * 100) / 100;

// Every BookingStatus, and whether it counts as a LIVE booking (anything not
// cancelled or declined). The Record makes it exhaustive: add a status to the
// union and this stops compiling until it's classified.
//
// Queried as an `in` list rather than `not-in` on purpose — a disjunction of
// equalities is served by the automatic single-field indexes, so it needs no
// composite index, and it keeps cancelled history off the wire entirely.
const LIVE: Record<BookingStatus, boolean> = {
  "Approval needed": true,
  Confirmed: true,
  Waitlisted: true,
  Offered: true,
  Cancelled: false,
  Declined: false,
};
const LIVE_STATUSES = (Object.keys(LIVE) as BookingStatus[]).filter((s) => LIVE[s]);

// The only booking fields any figure on this screen reads. A field mask can't
// cut the read COUNT (Firestore bills a read per matched document either way)
// but it keeps kids/answers/notes/refundLog/sessions off the wire, which is
// most of a booking document and most of the latency.
const BOOKING_FIELDS = [
  "ref", "status", "amount", "amountPaid", "pay", "voucherReceiveBy",
  "createdAt", "listingId", "blockId", "franchiseId",
] as const;
const PAYMENT_FIELDS = ["amount", "status", "type", "createdAt", "paidAt", "refs"] as const;

/** A booking reduced to the fields the dashboard reads. */
interface BkLite {
  ref: string;
  status: BookingStatus;
  amount?: number;
  amountPaid?: number;
  pay?: string;
  voucherReceiveBy?: string;
  createdAt?: string;
  listingId?: string | null;
  blockId?: string | null;
  franchiseId?: string | null;
}
const lite = (d: FirebaseFirestore.QueryDocumentSnapshot): BkLite => {
  const b = d.data() as BkLite;
  return { ...b, ref: String(b.ref ?? "") };
};
/** owedNow's rules only touch status/amount/amountPaid/pay — all in the mask. */
const owed = (b: BkLite) => owedNow(b as unknown as Booking);

interface PayLite {
  amount?: number;
  status?: string;
  type?: string;
  createdAt?: string;
  paidAt?: string;
  refs?: string[];
}

/**
 * The payment records that could count toward "taken this week", i.e. the ones
 * where `paidAt ?? createdAt` is inside the window.
 *
 * Two fields, so two range queries unioned: a record with a `paidAt` qualifies
 * on `paidAt` (a range filter also excludes documents missing the field, which
 * is exactly right), and one without qualifies on `createdAt`. The caller then
 * re-applies the original `(paidAt ?? createdAt) >= weekAgo` predicate, so the
 * union is a superset and the answer is identical to reading the collection.
 */
async function weekPayments(base: FirebaseFirestore.Query, weekAgo: string): Promise<PayLite[]> {
  const masked = base.select(...PAYMENT_FIELDS);
  const dedupe = (snaps: FirebaseFirestore.QuerySnapshot[]) => {
    const seen = new Map<string, PayLite>();
    for (const s of snaps) for (const d of s.docs) seen.set(d.id, d.data() as PayLite);
    return [...seen.values()];
  };
  return withIndexFallback(
    "payments by paidAt / createdAt",
    async () =>
      dedupe(
        await Promise.all([
          masked.where("paidAt", ">=", weekAgo).get(),
          masked.where("createdAt", ">=", weekAgo).get(),
        ]),
      ),
    // No index: one masked scan of the ledger — the same document count the
    // route always read, just without the fields it never used.
    async () => dedupe([await masked.get()]),
  );
}

/**
 * The two sets of bookings the screen needs: every LIVE booking (all time —
 * that's what "outstanding" and "live bookings" mean) and everything taken in
 * the last 7 days whatever its status ("new this week" counted a booking that
 * came in and was cancelled the same week, and still does).
 *
 * Without the createdAt index the two sets come out of ONE masked scan rather
 * than a narrow query plus a fallback scan — so an undeployed index costs
 * exactly what this route always cost, never more.
 */
async function bookingSets(
  masked: FirebaseFirestore.Query,
  weekAgo: string,
): Promise<{ live: FirebaseFirestore.QueryDocumentSnapshot[]; week: FirebaseFirestore.QueryDocumentSnapshot[] }> {
  const WHAT = "bookings by createdAt";
  const wide = async () => {
    const all = (await masked.get()).docs;
    return {
      live: all.filter((d) => LIVE[String(d.get("status")) as BookingStatus] === true),
      // Firestore's own createTime stands in for rows written before the app
      // recorded createdAt — which is what the route used to do here.
      week: all.filter((d) => String(d.get("createdAt") ?? d.createTime?.toDate().toISOString() ?? "") >= weekAgo),
    };
  };
  if (indexMissing(WHAT)) return wide();
  try {
    const [live, week] = await Promise.all([
      masked.where("status", "in", LIVE_STATUSES).get(),
      masked.where("createdAt", ">=", weekAgo).get(),
    ]);
    return { live: live.docs, week: week.docs };
  } catch (err) {
    noteIndexMissing(WHAT, err); // rethrows anything that isn't a missing index
    return wide();
  }
}

/**
 * Build the whole screen for one tenant under one lens. Everything that
 * decides WHAT to read (tenant, venue, franchise) is already resolved by the
 * caller, so two callers with the same three values get the same bytes — which
 * is what lets identical builds share one set of reads (see `coalesce`).
 */
async function buildDashboard(tenantId: string, venueId: string | null, franchiseId: string | null) {
  const now = new Date();
  const today = ukToday(now);
  const weekAgo = new Date(now.getTime() - 7 * 86_400_000).toISOString();

  const bookingsCol = db.collection("bookings").where("tenantId", "==", tenantId);
  const blocksCol = db.collection("blocks").where("tenantId", "==", tenantId);
  const paymentsCol = db.collection("payments").where("tenantId", "==", tenantId);
  const maskedBookings = bookingsCol.select(...BOOKING_FIELDS);

  // Whether a lens is on is decided by the query string alone, so it can steer
  // the reads before any of them run. A lens has to resolve each booking's
  // listing through its BLOCK, including through runs that finished long ago,
  // so it needs the whole blocks collection either way — reading the future
  // runs a second time on top would cost more than the old code did.
  const lensed = !!(venueId || franchiseId);

  const [listingsSnap, blocksSnap, bookings, payments, openBlockCount] = await Promise.all([
    // Listings are the smallest collection and every one of them is needed
    // (title for the session rows, venue/franchise for the lenses) — but only
    // those three fields, not the photos/description/pricing.
    db.collection("listings").where("tenantId", "==", tenantId).select("title", "venueId", "franchiseId").get(),
    // Runs with a session still to come. Every session-derived figure below
    // (today / next / upcoming / byListing / occupancy) filters to `date >=
    // today`, so a run that finished can't contribute to any of them. Same
    // endDate trick as lib/sweeps.ts upcomingBlocks().
    lensed
      ? blocksCol.get()
      : withIndexFallback("blocks by endDate", () => blocksCol.where("endDate", ">=", today).get(), () => blocksCol.get()),
    bookingSets(maskedBookings, weekAgo),
    weekPayments(paymentsCol, weekAgo),
    // "Active runs" with no lens: a number Firestore counts for us, instead of
    // reading every open run to find out how many there are. Under a lens it
    // has to be filtered by listing, so it's counted off the snapshot above.
    lensed ? Promise.resolve(0) : blocksCol.where("open", "==", true).count().get().then((s) => s.data().count),
  ]);

  const title = new Map(listingsSnap.docs.map((d) => [d.id, (d.data() as { title?: string }).title ?? "Untitled"]));

  // "__ho__" = the head office's OWN direct listings (no franchise owner).
  const ownOnly = franchiseId === "__ho__";
  const allowedIds: Set<string> | null = (venueId || franchiseId)
    ? new Set(listingsSnap.docs.filter((d) => {
        const l = d.data() as { venueId?: string | null; franchiseId?: string | null };
        const franchiseOk = !franchiseId || (ownOnly ? !l.franchiseId : l.franchiseId === franchiseId);
        return (!venueId || l.venueId === venueId) && franchiseOk;
      }).map((d) => d.id))
    : null;
  const inVenue = (listingId?: string | null) => !allowedIds || (listingId != null && allowedIds.has(listingId));

  // ── Active runs, and the block→listing map a lens needs ──
  // A booking stores its blockId, not a listingId, so under a lens the listing
  // has to be resolved through the block — which is why `lensed` already
  // fetched every run above; both come off that one snapshot. With no lens,
  // inVenue() is always true and nothing needs the map at all.
  const blockListing = new Map<string, string | null>(
    lensed ? blocksSnap.docs.map((d) => [d.id, (d.data() as BlockDoc).listingId ?? null]) : [],
  );
  const activeBlocks = lensed
    ? blocksSnap.docs.filter((d) => { const b = d.data() as BlockDoc; return !!b.open && inVenue(b.listingId); }).length
    : openBlockCount;

  /** The listing a booking belongs to — its own, else its run's. */
  const listingOf = (b: BkLite) => b.listingId ?? (b.blockId ? blockListing.get(b.blockId) ?? null : null);
  /** The lens test for a booking. A booking stamped with the franchise's id
   *  counts too (dates-label bookings with no block). */
  const inLens = (b: BkLite) =>
    inVenue(listingOf(b)) || (!!franchiseId && !ownOnly && !venueId && b.franchiseId === franchiseId);

  // ── Sessions across the tenant's open blocks (real dates + per-date counts) ──
  type Sess = { date: string; start: string; end: string; capacity: number; booked: number; spotsLeft: number; listing: string; open: boolean };
  const sessions: Sess[] = [];
  let openCapacity = 0, openBooked = 0;
  // Overall occupancy per LISTING across its open runs (not per pass/session).
  // Keyed by listingId, NOT the title string — two different listings can
  // share a name (e.g. two "After-School Football Club" sessions at
  // different venues/times), and keying by name silently merged their
  // capacity/booked/spotsLeft into one row and dropped the other entirely.
  const perListing = new Map<string, { listing: string; capacity: number; booked: number; spotsLeft: number; nextDate: string }>();
  for (const d of blocksSnap.docs) {
    const doc = d.data() as BlockDoc;
    if (!inVenue(doc.listingId)) continue;
    const sum = blockSummary(d.id, doc);
    const listing = title.get(doc.listingId) ?? "Untitled";
    const future = sum.sessions.filter((s) => s.date >= today);
    // Occupancy counts only runs still selling with sessions yet to happen.
    if (sum.open && future.length) {
      openCapacity += sum.capacity; openBooked += sum.bookedCount;
      const cur = perListing.get(doc.listingId) ?? { listing, capacity: 0, booked: 0, spotsLeft: 0, nextDate: "9999-99-99" };
      cur.capacity += sum.capacity; cur.booked += sum.bookedCount; cur.spotsLeft += sum.spotsLeft;
      const nd = future.map((s) => s.date).sort()[0];
      if (nd < cur.nextDate) cur.nextDate = nd;
      perListing.set(doc.listingId, cur);
    }
    for (const s of sum.sessions) sessions.push({ date: s.date, start: s.start, end: s.end, capacity: s.capacity, booked: s.bookedCount, spotsLeft: s.spotsLeft, listing, open: sum.open });
  }
  sessions.sort((a, b) => (`${a.date} ${a.start}` < `${b.date} ${b.start}` ? -1 : 1));

  const byListing = [...perListing.entries()]
    .map(([listingId, v]) => ({ listingId, listing: v.listing, capacity: v.capacity, booked: v.booked, spotsLeft: v.spotsLeft, pct: v.capacity ? Math.round((v.booked / v.capacity) * 100) : 0, nextDate: v.nextDate }))
    .sort((a, b) => (a.nextDate < b.nextDate ? -1 : 1))
    .slice(0, 8);

  const todaySessions = sessions.filter((s) => s.date === today);
  const upcoming = sessions.filter((s) => s.date >= today && s.open).slice(0, 6);
  const next = sessions.find((s) => s.date > today && s.open) ?? sessions.find((s) => s.date === today && s.open) ?? null;

  // ── Bookings ──
  const liveBookings = bookings.live.map(lite).filter(inLens);
  const newThisWeek = bookings.week.map(lite).filter(inLens).length;
  const waitlist = liveBookings.filter((b) => b.status === "Waitlisted").length;
  // Outstanding is deliberately an ALL-TIME figure (a debt doesn't age out),
  // and owedNow() is `max(0, amount − received)` per booking with `received`
  // derived from three fields — there's no Firestore aggregation for that. So
  // this stays a scan; what it no longer reads is cancelled/declined history
  // (which owes nothing by definition) or any field but the ten in the mask.
  const owing = liveBookings.filter((b) => owed(b) > 0);
  const outstanding = round2(owing.reduce((s, b) => s + owed(b), 0));
  const overdueVouchers = owing.filter((b) => b.pay === "Awaiting voucher payment" && !!b.voucherReceiveBy && b.voucherReceiveBy < today).length;
  const awaitingVoucher = owing.filter((b) => b.pay === "Awaiting voucher payment").length;

  // ── Money in this week (payment records, refunds excluded) ──
  // Payments only reference bookings by ref — a payment counts for the venue if
  // one of its refs belongs to a booking at that venue, and a card checkout
  // that paid for two sites is split by each booking's price. Both questions
  // are only ever asked about the refs on THIS week's payments, so look those
  // few bookings up by ref instead of mapping every booking the tenant ever
  // took. (Cancelled bookings count here — their money still came in — which
  // is why this can't reuse the live-bookings scan above.)
  let venueRefs: Set<string> | null = null;
  const priceOf = new Map<string, number>();
  if (lensed) {
    venueRefs = new Set<string>();
    const refs = [...new Set(payments.flatMap((p) => p.refs ?? []).filter(Boolean))];
    for (const d of refs.length ? await whereInChunks(maskedBookings, "ref", "in", refs) : []) {
      const b = lite(d);
      priceOf.set(b.ref, Number(b.amount) || 0);
      if (inLens(b)) venueRefs.add(b.ref);
    }
  }
  const shareIn = (refs: string[]): number => {
    if (!venueRefs || !refs.length) return 1;
    const total = refs.reduce((n, r) => n + (priceOf.get(r) ?? 0), 0);
    const mine = refs.filter((r) => venueRefs!.has(r));
    return total > 0 ? mine.reduce((n, r) => n + (priceOf.get(r) ?? 0), 0) / total : mine.length / refs.length;
  };

  const takenThisWeek = round2(
    payments
      // A card record is created when checkout STARTS; paidAt is when it paid.
      .filter((p) => isMoneyIn(p) && (p.paidAt ?? p.createdAt ?? "") >= weekAgo)
      .filter((p) => !venueRefs || (p.refs ?? []).some((r) => venueRefs!.has(r)))
      // One card checkout can pay for bookings at several sites: under a site
      // lens, count only this site's share of it (by each booking's price) —
      // it was counted in full at every site it touched (acceptance d23s6).
      .reduce((s, p) => s + (p.amount ?? 0) * shareIn(p.refs ?? []), 0),
  );

  return {
    today: {
      date: today,
      booked: todaySessions.reduce((s, x) => s + x.booked, 0),
      sessions: todaySessions.map((s) => ({ listing: s.listing, start: s.start, end: s.end, booked: s.booked, capacity: s.capacity })),
    },
    next: next ? { date: next.date, start: next.start, end: next.end, listing: next.listing } : null,
    upcoming: upcoming.map((s) => ({ date: s.date, start: s.start, end: s.end, listing: s.listing, spotsLeft: s.spotsLeft })),
    byListing,
    bookings: { live: liveBookings.length, newThisWeek, waitlist },
    occupancy: { booked: openBooked, capacity: openCapacity, pct: openCapacity ? Math.round((openBooked / openCapacity) * 100) : 0 },
    money: { takenThisWeek, outstanding, overdueVouchers, awaitingVoucher },
    counts: {
      listings: allowedIds ? allowedIds.size : listingsSnap.size,
      activeBlocks,
    },
  };
}

// ── One build per tenant+lens at a time ─────────────────────────────────
// The screen refetches on every realtime nudge for bookings, blocks, listings
// and payments — and one parent checkout moves two or three of those, so a
// single booking used to kick off two or three IDENTICAL dashboard builds
// inside the same second, for every manager with the screen open, each paying
// the full set of reads. A request that arrives while an identical build is
// already running now waits for that one and shares its result. Nothing is
// held after the build finishes, so no figure is ever staler than a request
// that simply started a moment earlier — this is deduplication, not a cache.
type DashPayload = Awaited<ReturnType<typeof buildDashboard>>;
const inFlight = new Map<string, Promise<DashPayload>>();

function coalesce(key: string, run: () => Promise<DashPayload>): Promise<DashPayload> {
  const running = inFlight.get(key);
  if (running) return running;
  const p = run().finally(() => { if (inFlight.get(key) === p) inFlight.delete(key); });
  inFlight.set(key, p);
  return p;
}

dashboard.get("/", async (req, res) => {
  const scope = managerScope(req, res);
  if (!scope) return;
  const tenantId = scope.role === "platform" && typeof req.query.tenantId === "string" ? req.query.tenantId : scope.tenantId;
  if (!tenantId) { res.status(400).json({ error: "No tenant in scope (platform: pass ?tenantId=)" }); return; }

  // Optional location lens: ?venueId= narrows every figure to the listings at
  // one venue. Blocks/bookings carry listingId; payments only carry booking
  // refs, so we intersect them with the venue's booking refs further down.
  const venueId = typeof req.query.venueId === "string" && req.query.venueId ? req.query.venueId : null;
  // Optional franchise lens: ?franchiseId= narrows every figure to the listings
  // OWNED by that franchise (head office "view as franchise X"). Combined with
  // the venue lens as an intersection of allowed listing ids.
  //
  // A FRANCHISE always gets its own lens — the query param was optional and a
  // franchise that didn't send it (or sent another's id) got every figure in
  // the company: head office's revenue and its siblings'. Same rule as growth.ts.
  const franchiseId = scope.role === "franchise" ? (scope.franchiseId ?? "__no_franchise__")
    : (typeof req.query.franchiseId === "string" && req.query.franchiseId ? req.query.franchiseId : null);

  // Access control has already run (managerScope + the tenant resolution
  // above); the key covers everything that can change the BYTES, so sharing a
  // build can never hand one account another's scope.
  res.json(await coalesce(`${tenantId} ${venueId ?? ""} ${franchiseId ?? ""}`,
    () => buildDashboard(tenantId, venueId, franchiseId)));
});
