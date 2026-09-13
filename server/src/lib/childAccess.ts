import { db } from "../firebase";
import { bookingInSite, staffSiteScope } from "./siteScope";

// "Can this provider account see this child?" — one rule for every route that
// takes a childId from a provider (the child card, incidents, medication).
// Children are shared across providers (a parent's account holds them), so a
// childId on its own proves nothing: without this, provider A could file an
// incident or add a medicine against provider B's child and pull B's family
// details back out through the dossier.

/** A customer record the family created themselves (followed the provider or
 *  signed up through its booking link) — not one a provider typed in, which
 *  anyone could do with any email address. */
export const joinedThemselves = (c: FirebaseFirestore.DocumentData) =>
  c.followedByParent === true || c.marketingSource === "Signed up through the provider's booking link";

type Who = { tenantId?: string | null; role: string; franchiseId?: string | null; assignment?: { mode: string; ids: string[] } | null };

/** True when the child is booked with this tenant (with the account's own
 *  franchise, for a franchise and its staff), or — tenant-wide accounts only —
 *  the child's family joined this provider themselves. */
export async function childVisibleTo(who: Who, childId: string | null | undefined): Promise<boolean> {
  if (!who.tenantId || !childId) return false;
  const franchiseId = (who.role === "franchise" || who.role === "staff") && who.franchiseId ? who.franchiseId : null;
  // Staff assigned to certain sites (a site lead) see only those sites' children.
  const site = await staffSiteScope(who);
  const inScope = (b: FirebaseFirestore.DocumentData) => (!franchiseId || (b.franchiseId ?? null) === franchiseId) && (!site || bookingInSite(b, site));

  const direct = await db.collection("bookings").where("tenantId", "==", who.tenantId).where("childId", "==", childId).get();
  if (direct.docs.some((d) => inScope(d.data()))) return true;
  // A sibling on a joint booking is only in kids[] (the booking's childId is the first child).
  const all = await db.collection("bookings").where("tenantId", "==", who.tenantId).get();
  if (all.docs.some((d) => { const b = d.data(); return inScope(b) && Array.isArray(b.kids) && b.kids.some((k: { childId?: string }) => k?.childId === childId); })) return true;

  // The customer list is tenant-wide, so it can't place a child in a franchise.
  if (franchiseId || site) return false;
  const child = await db.collection("children").doc(childId).get();
  const parentUid = child.exists ? (child.get("parentUid") as string | undefined) : undefined;
  if (!parentUid) return false;
  const u = await db.collection("users").doc(parentUid).get();
  const email = ((u.exists ? (u.get("email") as string | undefined) : "") ?? "").trim();
  if (!email) return false;
  for (const e of new Set([email.toLowerCase(), email])) {
    const cust = await db.collection("customers").where("tenantId", "==", who.tenantId).where("email", "==", e).get();
    if (cust.docs.some((cd) => joinedThemselves(cd.data()))) return true;
  }
  return false;
}
