import { db } from "../firebase";

// A fixed-£ early-bird discount can be used once per family per season (once per listing when the listing has no
// season). A percentage early bird is never limited. The booking is stamped with the scope it used (earlyBirdScope),
// and a family's later bookings in the same scope get the early bird skipped. Cancelled/declined bookings don't count.
export const earlyBirdScopeOf = (listingId: string, seasonId?: string | null) => (seasonId ? `season:${seasonId}` : `listing:${listingId}`);

export async function earlyFixedUsed(tenantId: string, email: string | null | undefined, scope: string): Promise<boolean> {
  if (!email) return false;
  const snap = await db.collection("bookings").where("tenantId", "==", tenantId).where("email", "==", email).where("earlyBirdScope", "==", scope).get();
  return snap.docs.some((d) => !/cancel|declin/i.test(String(d.get("status") ?? "")));
}

/** The family's earlier booking that used the fixed-GBP early bird in this scope (so the page can link to it). */
export async function earlyFixedBooking(tenantId: string, email: string | null | undefined, scope: string): Promise<{ ref: string; unpaid: boolean } | null> {
  if (!email) return null;
  const snap = await db.collection("bookings").where("tenantId", "==", tenantId).where("email", "==", email).where("earlyBirdScope", "==", scope).get();
  const d = snap.docs.find((x) => !/cancel|declin/i.test(String(x.get("status") ?? "")));
  return d ? { ref: String(d.get("ref")), unpaid: String(d.get("pay") ?? "") === "Unpaid" } : null;
}

/** A short (30s) per-family lock taken while a booking that uses the fixed-GBP early bird is being created, so several
 *  simultaneous checkouts cannot all read "not used yet" and each take it. Losers are told to retry; by then the first
 *  booking is stamped and the normal check sees it. */
export async function claimEarlyBird(tenantId: string, email: string, scope: string): Promise<boolean> {
  const id = Buffer.from(`${tenantId}|${email.toLowerCase()}|${scope}`).toString("base64url").slice(0, 400);
  const ref = db.collection("earlyBirdClaims").doc(id);
  return db.runTransaction(async (tx) => {
    const cur = await tx.get(ref);
    if (cur.exists && Number(cur.get("expiresAt") ?? 0) > Date.now()) return false;
    tx.set(ref, { tenantId, email: email.toLowerCase(), scope, expiresAt: Date.now() + 30_000 });
    return true;
  });
}
