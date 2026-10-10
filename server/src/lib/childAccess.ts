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

/** The cheap form of childVisibleTo for ONE family (a dossier: the child plus the siblings): which of `childIds` this provider may
 *  see, using indexed queries only - the bookings naming those children, and the bookings of the family's email (where a joint
 *  booking keeps its other children in kids[]) - instead of reading every booking the tenant has. Also returns the in-scope
 *  bookings it found, so the caller does not read them again. Same scope rule as childVisibleTo (franchise, site, joined-themselves). */
export async function familyChildAccess(who: Who, childIds: string[], email?: string | null): Promise<{ visible: Set<string>; bookings: FirebaseFirestore.DocumentData[] }> {
  const visible = new Set<string>();
  const found = new Map<string, FirebaseFirestore.DocumentData>();
  if (!who.tenantId || !childIds.length) return { visible, bookings: [] };
  const franchiseId = (who.role === "franchise" || who.role === "staff") && who.franchiseId ? who.franchiseId : null;
  const site = await staffSiteScope(who);
  const inScope = (b: FirebaseFirestore.DocumentData) => (!franchiseId || (b.franchiseId ?? null) === franchiseId) && (!site || bookingInSite(b, site));
  const wanted = new Set(childIds);
  const docs: FirebaseFirestore.QueryDocumentSnapshot[] = [];
  for (let i = 0; i < childIds.length; i += 10) {
    docs.push(...(await db.collection("bookings").where("tenantId", "==", who.tenantId).where("childId", "in", childIds.slice(i, i + 10)).get()).docs);
  }
  const mail = (email ?? "").trim();
  if (mail) for (const e of new Set([mail.toLowerCase(), mail])) docs.push(...(await db.collection("bookings").where("tenantId", "==", who.tenantId).where("email", "==", e).get()).docs);
  for (const d of docs) {
    const b = d.data();
    if (!inScope(b)) continue;
    const touched = [b.childId, ...(Array.isArray(b.kids) ? b.kids.map((k: { childId?: string }) => k?.childId) : [])].filter((c): c is string => typeof c === "string" && wanted.has(c));
    if (!touched.length) continue;
    for (const c of touched) visible.add(c);
    found.set(d.id, b);
  }
  // A family that joined this provider themselves (tenant-wide accounts only, as in childVisibleTo).
  if (!franchiseId && !site && mail && childIds.some((c) => !visible.has(c))) {
    for (const e of new Set([mail.toLowerCase(), mail])) {
      const cust = await db.collection("customers").where("tenantId", "==", who.tenantId).where("email", "==", e).get();
      if (cust.docs.some((cd) => joinedThemselves(cd.data()))) { for (const c of childIds) visible.add(c); break; }
    }
  }
  return { visible, bookings: [...found.values()] };
}
