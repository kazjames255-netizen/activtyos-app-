import { db } from "../firebase";

// Site scope for STAFF: the sites (locations) or listings a member of staff was
// assigned to on their invite (Team & invites → users.assignment). Before
// 13 Sept nothing read it — a site lead assigned to one school saw, and could
// mark, every site's registers, and opened any child's card (acceptance
// d23s5). Same shape of rule as franchiseListingIds narrowing a franchise:
// a record is in scope when it hangs off one of these listings.
//
// Unscoped (today's behaviour): not staff, no assignment, mode "all" or
// "none" (not rostered to any site — office staff), or an assignment with no
// ids picked.

export interface SiteScope {
  listings: Set<string>;
  /** Blocks of those listings — operator-taken bookings carry only blockId. */
  blocks: Set<string>;
}

type Who = { role: string; tenantId?: string | null; assignment?: { mode: string; ids: string[] } | null };

export async function staffSiteScope(who: Who): Promise<SiteScope | null> {
  const a = who.assignment;
  if (who.role !== "staff" || !who.tenantId || !a || (a.mode !== "locations" && a.mode !== "listings") || !a.ids.length) return null;
  const ids = new Set(a.ids);
  const [listingsSnap, blocksSnap] = await Promise.all([
    db.collection("listings").where("tenantId", "==", who.tenantId).get(),
    db.collection("blocks").where("tenantId", "==", who.tenantId).get(),
  ]);
  // "locations" = venue ids (Setup → Locations); a listing is at the venue it names.
  const listings = new Set(
    a.mode === "listings"
      ? a.ids
      : listingsSnap.docs.filter((d) => ids.has(String(d.get("venueId") ?? ""))).map((d) => d.id),
  );
  const blocks = new Set(blocksSnap.docs.filter((d) => listings.has(String(d.get("listingId") ?? ""))).map((d) => d.id));
  return { listings, blocks };
}

/** Is this booking at one of the scope's sites? */
export function bookingInSite(b: { listingId?: string | null; blockId?: string | null }, scope: SiteScope): boolean {
  return (!!b.listingId && scope.listings.has(b.listingId)) || (!!b.blockId && scope.blocks.has(b.blockId));
}

/** The children booked at the scope's sites (siblings on a joint booking
 *  too) — like franchiseChildIds, for records that hang off a child rather
 *  than a listing (incidents, medication, moments, trips). */
export async function siteChildIds(tenantId: string, scope: SiteScope): Promise<Set<string>> {
  const snap = await db.collection("bookings").where("tenantId", "==", tenantId).get();
  const out = new Set<string>();
  for (const d of snap.docs) {
    const b = d.data() as { listingId?: string; blockId?: string; childId?: string; kids?: { childId?: string }[] };
    if (!bookingInSite(b, scope)) continue;
    if (b.childId) out.add(b.childId);
    for (const k of b.kids ?? []) if (k.childId) out.add(k.childId);
  }
  return out;
}

/** Is a child record (incident, medication, moment, trip) at one of the
 *  scope's sites: it names a listing or block there, or a child booked there.
 *  A record tied to none (no child, no session) isn't placed at the site. */
export function recordInSite(
  r: { listingId?: unknown; blockId?: unknown; childId?: unknown; childIds?: unknown },
  scope: SiteScope,
  kids: Set<string>,
): boolean {
  if (typeof r.listingId === "string" && scope.listings.has(r.listingId)) return true;
  if (typeof r.blockId === "string" && scope.blocks.has(r.blockId)) return true;
  if (typeof r.childId === "string" && kids.has(r.childId)) return true;
  return Array.isArray(r.childIds) && r.childIds.some((c) => typeof c === "string" && kids.has(c));
}

type Rec = Record<string, unknown>;
/** For a site-scoped member of staff: "may they see this child record?" — at
 *  one of their sites (recordInSite), or `ownedBy` says they made it
 *  themselves. null = unscoped, show everything as before. */
export async function siteRecordFilter(who: Who, ownedBy?: (r: Rec) => boolean): Promise<((r: Rec) => boolean) | null> {
  const site = await staffSiteScope(who);
  if (!site) return null;
  const kids = await siteChildIds(who.tenantId!, site);
  return (r) => recordInSite(r, site, kids) || !!ownedBy?.(r);
}
