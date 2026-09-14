import { Router } from "express";
import { db } from "../firebase";
import { operatorScope, managerScope } from "../middleware/role";
import { fromDoc, type BookingDoc } from "../lib/bookingDoc";
import { blockSummary, type BlockDoc } from "../lib/blockDomain";
import { owedNow, isMoneyIn } from "../../../features/bookings/helpers";
import { ukToday } from "../lib/ukDate";

// ─────────────────────────────────────────────────────────────────────────
// Dashboard — the operator's landing screen. Pure read: it aggregates data
// the other routes already own (bookings, blocks, payments) into the handful
// of numbers a provider wants at 8am — who's in today, what's coming, what
// money came in this week and what's still owed. No new collection.
// ─────────────────────────────────────────────────────────────────────────
export const dashboard = Router();

// "Outstanding" and "taken" use the SAME rules as the Finance page —
// owedNow() and isMoneyIn() in features/bookings/helpers.ts. This file had its
// own copy (a pay-label list that counted waitlisted places and skipped "Pay
// on the day"), and the two screens disagreed (acceptance d19s7).
const round2 = (n: number) => Math.round(n * 100) / 100;

dashboard.get("/", async (req, res) => {
  const scope = managerScope(req, res);
  if (!scope) return;
  const tenantId = scope.role === "platform" && typeof req.query.tenantId === "string" ? req.query.tenantId : scope.tenantId;
  if (!tenantId) { res.status(400).json({ error: "No tenant in scope (platform: pass ?tenantId=)" }); return; }

  const [bookingsSnap, blocksSnap, listingsSnap, paymentsSnap] = await Promise.all([
    db.collection("bookings").where("tenantId", "==", tenantId).get(),
    db.collection("blocks").where("tenantId", "==", tenantId).get(),
    db.collection("listings").where("tenantId", "==", tenantId).get(),
    db.collection("payments").where("tenantId", "==", tenantId).get(),
  ]);

  const now = new Date();
  const today = ukToday(now);
  const weekAgo = new Date(now.getTime() - 7 * 86_400_000).toISOString();

  const title = new Map(listingsSnap.docs.map((d) => [d.id, (d.data() as { title?: string }).title ?? "Untitled"]));

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
  // A booking stores its blockId, not a listingId — resolve the listing via the
  // block so the venue / franchise lenses actually keep the bookings they own.
  // A booking stamped with the franchise's id counts too (dates-label bookings
  // with no block).
  const blockListing = new Map(blocksSnap.docs.map((d) => [d.id, (d.data() as BlockDoc).listingId] as const));
  const bookings = bookingsSnap.docs.map((d) => {
    const b = fromDoc(d.data() as BookingDoc);
    const raw = d.data() as { blockId?: string | null; franchiseId?: string | null };
    return { ...b, createdAt: b.createdAt ?? d.createTime?.toDate().toISOString() ?? "", _listingId: b.listingId ?? (raw.blockId ? blockListing.get(raw.blockId) ?? null : null), _franchiseId: raw.franchiseId ?? null };
  }).filter((b) => inVenue(b._listingId) || (!!franchiseId && !ownOnly && !venueId && b._franchiseId === franchiseId));
  // Payments only reference bookings by ref — a payment counts for the venue if
  // one of its refs belongs to a booking at that venue.
  const venueRefs = (venueId || franchiseId) ? new Set(bookings.map((b) => b.ref)) : null;
  const priceOf = new Map(bookingsSnap.docs.map((d) => { const b = d.data() as { ref?: string; amount?: number }; return [String(b.ref ?? ""), Number(b.amount) || 0] as const; }));
  const shareIn = (refs: string[]): number => {
    if (!venueRefs || !refs.length) return 1;
    const total = refs.reduce((n, r) => n + (priceOf.get(r) ?? 0), 0);
    const mine = refs.filter((r) => venueRefs.has(r));
    return total > 0 ? mine.reduce((n, r) => n + (priceOf.get(r) ?? 0), 0) / total : mine.length / refs.length;
  };
  const live = bookings.filter((b) => b.status !== "Cancelled" && b.status !== "Declined");
  const waitlist = bookings.filter((b) => b.status === "Waitlisted").length;
  const newThisWeek = bookings.filter((b) => (b.createdAt ?? "") >= weekAgo).length;
  const owing = bookings.filter((b) => owedNow(b) > 0);
  const outstanding = round2(owing.reduce((s, b) => s + owedNow(b), 0));
  const overdueVouchers = owing.filter((b) => b.pay === "Awaiting voucher payment" && !!b.voucherReceiveBy && b.voucherReceiveBy < today).length;
  const awaitingVoucher = owing.filter((b) => b.pay === "Awaiting voucher payment").length;

  // ── Money in this week (payment records, refunds excluded) ──
  const takenThisWeek = round2(
    paymentsSnap.docs
      .map((d) => d.data() as { amount?: number; status?: string; type?: string; createdAt?: string; paidAt?: string; refs?: string[] })
      // A card record is created when checkout STARTS; paidAt is when it paid.
      .filter((p) => isMoneyIn(p) && (p.paidAt ?? p.createdAt ?? "") >= weekAgo)
      .filter((p) => !venueRefs || (p.refs ?? []).some((r) => venueRefs.has(r)))
      // One card checkout can pay for bookings at several sites: under a site
      // lens, count only this site's share of it (by each booking's price) —
      // it was counted in full at every site it touched (acceptance d23s6).
      .reduce((s, p) => s + (p.amount ?? 0) * shareIn(p.refs ?? []), 0),
  );

  res.json({
    today: {
      date: today,
      booked: todaySessions.reduce((s, x) => s + x.booked, 0),
      sessions: todaySessions.map((s) => ({ listing: s.listing, start: s.start, end: s.end, booked: s.booked, capacity: s.capacity })),
    },
    next: next ? { date: next.date, start: next.start, end: next.end, listing: next.listing } : null,
    upcoming: upcoming.map((s) => ({ date: s.date, start: s.start, end: s.end, listing: s.listing, spotsLeft: s.spotsLeft })),
    byListing,
    bookings: { live: live.length, newThisWeek, waitlist },
    occupancy: { booked: openBooked, capacity: openCapacity, pct: openCapacity ? Math.round((openBooked / openCapacity) * 100) : 0 },
    money: { takenThisWeek, outstanding, overdueVouchers, awaitingVoucher },
    counts: {
      listings: allowedIds ? allowedIds.size : listingsSnap.size,
      activeBlocks: blocksSnap.docs.filter((d) => { const b = d.data() as BlockDoc; return b.open && inVenue(b.listingId); }).length,
    },
  });
});
