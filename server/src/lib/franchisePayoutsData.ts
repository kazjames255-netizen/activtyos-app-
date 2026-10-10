// Franchise payouts - the Firestore side. ONE read of a tenant's bookings + listings, boiled down (liteOf) and kept for 60 seconds, so the royalty
// report, the payouts screen, a franchise's own statement and the head office overview do not each scan the whole tenant on every page load.
// (kitCache empties on any successful write, so a settle / refund shows straight away.)
import { db } from "../firebase";
import { fromDoc, type BookingDoc } from "./bookingDoc";
import { cached } from "./kitCache";
import { isMoneyIn } from "../../../features/bookings/helpers";
import { cleanHistory, DEFAULT_RATE, eventRows, franchiseOf, ukDay, type LiteMoney, type PayEvent, type RateStep } from "./franchisePayouts";

export const PAYOUT_CACHE_MS = 60_000;

export interface SplitSettings { basis: "revenue" | "perBooking"; rate: number; perBookingFee: number; history: RateStep[] }

/** The tenant's royalty settings: current rate, basis, and the rate history (a pre-history tenant has none: the current rate then applies to all time). */
export function settingsOf(data: Record<string, unknown> | undefined): SplitSettings {
  const s = (data?.splitFees ?? {}) as { basis?: string; rate?: number; perBookingFee?: number; history?: unknown };
  return {
    basis: s.basis === "perBooking" ? "perBooking" : "revenue",
    rate: typeof s.rate === "number" ? s.rate : DEFAULT_RATE,
    perBookingFee: typeof s.perBookingFee === "number" ? s.perBookingFee : 0,
    history: cleanHistory(s.history),
  };
}
export async function loadSettings(tenantId: string): Promise<SplitSettings> {
  const t = await db.collection("tenants").doc(tenantId).get();
  return settingsOf(t.exists ? (t.data() as Record<string, unknown>) : undefined);
}

async function readLite(tenantId: string): Promise<LiteMoney[]> {
  const [bookingsSnap, listingsSnap, paySnap] = await Promise.all([
    db.collection("bookings").where("tenantId", "==", tenantId).get(),
    db.collection("listings").where("tenantId", "==", tenantId).get(),
    db.collection("payments").where("tenantId", "==", tenantId).get(),
  ]);
  const listingFr = new Map<string, string | undefined>();
  for (const d of listingsSnap.docs) listingFr.set(d.id, (d.data() as { franchiseId?: string }).franchiseId);
  // The payments ledger dates the money: a card payment by paidAt (when it paid), an offline one by the date it was recorded as received.
  const paysByRef = new Map<string, PayEvent[]>();
  for (const d of paySnap.docs) {
    const p = d.data() as { refs?: string[]; amount?: number; type?: string; status?: string; paidAt?: string; createdAt?: string };
    if (!isMoneyIn(p) || !p.refs?.length || !(Number(p.amount) > 0)) continue;
    const day = ukDay(p.paidAt ?? p.createdAt);
    for (const r of p.refs) (paysByRef.get(r) ?? paysByRef.set(r, []).get(r)!).push({ day, amount: Number(p.amount) / p.refs.length });
  }
  const out: LiteMoney[] = [];
  for (const d of bookingsSnap.docs) {
    const raw = d.data() as BookingDoc & { franchiseId?: string; listingId?: string };
    const b = fromDoc(raw);
    const changed = d.updateTime ? ukDay(d.updateTime.toDate().toISOString()) : null;
    out.push(...eventRows({ b, fid: franchiseOf(raw, listingFr), pays: paysByRef.get(b.ref), fallbackDay: ukDay(b.createdAt) ?? changed }));
  }
  return out;
}

/** Every money event of the tenant, boiled down. Cached 60 seconds per tenant (any write, webhook or sweep clears it); `fresh` always reads again. */
export function loadLite(tenantId: string, opts: { fresh?: boolean } = {}): Promise<LiteMoney[]> {
  if (opts.fresh) return readLite(tenantId);
  return cached(`fpay:${tenantId}`, PAYOUT_CACHE_MS, () => readLite(tenantId));
}

/** franchiseId -> display name, from the franchise accounts. */
export async function franchiseNames(tenantId: string): Promise<Map<string, string>> {
  const snap = await db.collection("users").where("tenantId", "==", tenantId).where("role", "==", "franchise").get();
  const m = new Map<string, string>();
  for (const d of snap.docs) {
    const u = d.data() as { name?: string; email?: string; franchiseId?: string; franchiseName?: string; franchiseArea?: string };
    // Prefer the head-office-granted franchise identity (e.g. "APF Activity Camps · London") over the account holder's personal name.
    const label = [u.franchiseName || u.name, u.franchiseArea].filter(Boolean).join(" · ") || u.email || "Franchise";
    m.set(u.franchiseId ?? d.id, label);
  }
  return m;
}

/** A listing whose bookings already sit in a SETTLED period of its franchise cannot be handed to another franchise: that would silently change a closed
 *  settlement. Returns the message to show, or null when it is fine. A booking's money is never dated before the day it was made, so a listing
 *  whose earliest money booking is after the last settled day is safe. */
export async function reassignBlockedBySettlement(tenantId: string, listingId: string, oldFranchiseId: string): Promise<string | null> {
  const settled = await db.collection("franchiseSettlements").where("tenantId", "==", tenantId).where("franchiseId", "==", oldFranchiseId).get();
  if (settled.empty) return null;
  const lastTo = settled.docs.map((d) => String(d.get("to"))).sort().pop()!;
  const blockIds = (await db.collection("blocks").where("tenantId", "==", tenantId).where("listingId", "==", listingId).get()).docs.map((d) => d.id);
  const docs = new Map<string, FirebaseFirestore.QueryDocumentSnapshot>();
  for (const d of (await db.collection("bookings").where("tenantId", "==", tenantId).where("listingId", "==", listingId).get()).docs) docs.set(d.id, d);
  for (let i = 0; i < blockIds.length; i += 30)
    for (const d of (await db.collection("bookings").where("tenantId", "==", tenantId).where("blockId", "in", blockIds.slice(i, i + 30)).get()).docs) docs.set(d.id, d);
  const hit = [...docs.values()].some((d) => {
    const b = fromDoc(d.data() as BookingDoc);
    const day = ukDay(b.createdAt) ?? (d.updateTime ? ukDay(d.updateTime.toDate().toISOString()) : null);
    return eventRows({ b, fid: oldFranchiseId, fallbackDay: day }).length > 0 && (!day || day <= lastTo);
  });
  return hit ? `This listing has bookings in a payout period that is already settled (up to ${lastTo}). Moving it to another franchise would change a settled payout, so it cannot be moved.` : null;
}
