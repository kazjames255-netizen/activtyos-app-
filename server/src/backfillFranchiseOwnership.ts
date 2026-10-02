import { db } from "./firebase";

// Franchise-ownership backfill (#5): bookings created before listing-ownership scoping carry no franchiseId, although
// the listing they were taken on belongs to a franchise — so that franchise's Bookings / Families / registers miss them.
// This stamps booking.franchiseId = <the listing's franchiseId> where the booking has none. Nothing else is touched,
// nothing is ever removed, bookings that already carry a franchiseId are left alone, listings with no owner (head office) are skipped.
//
//   npm --prefix server run backfill-franchise -- <tenantId>            DRY RUN (default): prints counts only, writes nothing
//   npm --prefix server run backfill-franchise -- <tenantId> --apply    writes (batched, idempotent: a re-run finds 0)
//
// One tenant at a time, always explicit. --apply on the two real tenants additionally needs ALLOW_REAL=1 in the environment.
const REAL = new Set(["7jG2XO3cOD3VtoL8YfFY", "jYp5XNZGT7bgSUMuEgHN"]);

async function main() {
  const args = process.argv.slice(2);
  const apply = args.includes("--apply");
  const tenantId = args.find((a) => !a.startsWith("--"));
  if (!tenantId) { console.error("usage: backfill-franchise <tenantId> [--apply]"); process.exit(2); }
  if (apply && REAL.has(tenantId) && process.env.ALLOW_REAL !== "1") { console.error("refusing --apply on a real tenant without ALLOW_REAL=1"); process.exit(4); }

  const [listings, blocks, bookings] = await Promise.all([
    db.collection("listings").where("tenantId", "==", tenantId).get(),
    db.collection("blocks").where("tenantId", "==", tenantId).get(),
    db.collection("bookings").where("tenantId", "==", tenantId).get(),
  ]);
  const owner = new Map<string, string>();
  for (const d of listings.docs) { const f = d.get("franchiseId"); if (typeof f === "string" && f) owner.set(d.id, f); }
  const blockListing = new Map(blocks.docs.map((d) => [d.id, String(d.get("listingId") ?? "")]));

  const todo: { ref: FirebaseFirestore.DocumentReference; franchiseId: string }[] = [];
  let already = 0, unowned = 0, unresolved = 0;
  for (const d of bookings.docs) {
    if (d.get("franchiseId")) { already++; continue; }
    const lid = (d.get("listingId") as string | undefined) || blockListing.get(String(d.get("blockId") ?? "")) || "";
    if (!lid) { unresolved++; continue; }
    const f = owner.get(lid);
    if (!f) { unowned++; continue; }
    todo.push({ ref: d.ref, franchiseId: f });
  }
  const byFranchise: Record<string, number> = {};
  for (const t of todo) byFranchise[t.franchiseId] = (byFranchise[t.franchiseId] ?? 0) + 1;
  console.log(JSON.stringify({ mode: apply ? "APPLY" : "DRY-RUN", tenantId, bookings: bookings.size, alreadyTagged: already, headOfficeOwned: unowned, noListing: unresolved, wouldTag: todo.length, byFranchise }));
  if (apply) {
    for (let i = 0; i < todo.length; i += 400) {
      const b = db.batch();
      for (const t of todo.slice(i, i + 400)) b.update(t.ref, { franchiseId: t.franchiseId });
      await b.commit();
    }
    console.log(`tagged ${todo.length}`);
  }
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
