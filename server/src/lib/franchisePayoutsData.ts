// Franchise payouts - the Firestore side. ONE read of a tenant's bookings + listings, boiled down (liteOf) and kept for 60 seconds, so the royalty
// report, the payouts screen, a franchise's own statement and the head office overview do not each scan the whole tenant on every page load.
// (kitCache empties on any successful write, so a settle / refund shows straight away.)
import { db } from "../firebase";
import { fromDoc, type BookingDoc } from "./bookingDoc";
import { cached } from "./kitCache";
import { cleanHistory, DEFAULT_RATE, franchiseOf, liteOf, type LiteMoney, type RateStep } from "./franchisePayouts";

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

/** Every booking of the tenant that holds money, boiled down. Cached 60 seconds per tenant. */
export function loadLite(tenantId: string): Promise<LiteMoney[]> {
  return cached(`fpay:${tenantId}`, PAYOUT_CACHE_MS, async () => {
    const [bookingsSnap, listingsSnap] = await Promise.all([
      db.collection("bookings").where("tenantId", "==", tenantId).get(),
      db.collection("listings").where("tenantId", "==", tenantId).get(),
    ]);
    const listingFr = new Map<string, string | undefined>();
    for (const d of listingsSnap.docs) listingFr.set(d.id, (d.data() as { franchiseId?: string }).franchiseId);
    const out: LiteMoney[] = [];
    for (const d of bookingsSnap.docs) {
      const raw = d.data() as BookingDoc & { franchiseId?: string; listingId?: string };
      const l = liteOf({ b: fromDoc(raw), fid: franchiseOf(raw, listingFr) });
      if (l) out.push(l);
    }
    return out;
  });
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
