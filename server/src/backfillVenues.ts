// One-off: give a tenant two venues (in its library) and point every listing
// that has no venue at one of them, round-robin — so the dashboard's location
// line + filter have real data. Idempotent: re-running only fills the gaps.
//   npx tsx src/backfillVenues.ts <tenantId>
import { db } from "./firebase";

const TID = process.argv[2];
if (!TID) { console.error("usage: tsx src/backfillVenues.ts <tenantId>"); process.exit(1); }

const VENUES = [
  { id: `venue-${TID}-loughton`, name: "Loughton Leisure Centre", address: "Traps Hill, Loughton IG10 1SZ", city: "Loughton" },
  { id: `venue-${TID}-buckhurst`, name: "Buckhurst Hill Sports Hall", address: "Queens Rd, Buckhurst Hill IG9 5BX", city: "Buckhurst Hill" },
];

async function run() {
  // Ensure the two venues exist in the library (merge with any already there).
  const libRef = db.collection("libraries").doc(TID);
  const lib = (await libRef.get()).data() as { venues?: { id: string }[] } | undefined;
  const venues = [...(lib?.venues ?? [])];
  const have = new Set(venues.map((v) => v.id));
  for (const v of VENUES) if (!have.has(v.id)) venues.push(v);
  await libRef.set({ tenantId: TID, venues }, { merge: true });

  // Assign a venue to every live listing that has none.
  const snap = await db.collection("listings").where("tenantId", "==", TID).get();
  const batch = db.batch();
  let i = 0, updated = 0;
  for (const d of snap.docs) {
    const data = d.data() as { venueId?: string | null; archived?: boolean };
    if (data.archived || data.venueId) continue;
    batch.update(d.ref, { venueId: VENUES[i % VENUES.length].id });
    i++; updated++;
  }
  if (updated) await batch.commit();
  console.log(`✓ ${TID}: ${venues.length} venues in library; assigned venueId to ${updated} listing(s).`);
  process.exit(0);
}
run().catch((e) => { console.error(e); process.exit(1); });
