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
