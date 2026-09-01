// One-off demo enrichment so the Finance "Add-ons" and "Insights" tabs have data:
//  · adds three add-ons to the library + attaches them to every listing
//  · puts add-ons on ~45% of bookings (est. add-on revenue + attach rate)
//  · gives every customer's child a sex (deterministic by name) for the gender split
// Idempotent-ish: safe to re-run; add-on picks are seeded, gender is name-derived.
//   npx tsx src/backfillMix.ts <tenantId>
import { db } from "./firebase";

const TID = process.argv[2];
if (!TID) { console.error("usage: tsx src/backfillMix.ts <tenantId>"); process.exit(1); }

const ADDONS = [
  { id: `addon-${TID}-lunch`, name: "Hot lunch", price: 4.5 },
  { id: `addon-${TID}-extended`, name: "Extended day", price: 8 },
  { id: `addon-${TID}-tshirt`, name: "Club T-shirt", price: 12 },
];
// Deterministic: same child name always resolves to the same sex.
const sexOf = (name: string): "boy" | "girl" => ([...name.toLowerCase()].reduce((a, c) => a + c.charCodeAt(0), 0) % 2 ? "boy" : "girl");
function rng(seed: number) { let s = seed >>> 0; return () => { s = (s + 0x6d2b79f5) >>> 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

async function run() {
  // 1) library add-ons (merge)
  const libRef = db.collection("libraries").doc(TID);
  const lib = (await libRef.get()).data() as { addons?: { id: string }[] } | undefined;
  const addons = [...(lib?.addons ?? [])];
  const have = new Set(addons.map((a) => a.id));
  for (const a of ADDONS) if (!have.has(a.id)) addons.push(a);
  await libRef.set({ tenantId: TID, addons }, { merge: true });

  // 2) attach add-ons to every live listing
  const lsnap = await db.collection("listings").where("tenantId", "==", TID).get();
  { const batch = db.batch(); for (const d of lsnap.docs) if (!(d.data() as { archived?: boolean }).archived) batch.update(d.ref, { addonIds: ADDONS.map((a) => a.id) }); await batch.commit(); }

  // 3) child sex on customers (deterministic by name)
  const csnap = await db.collection("customers").where("tenantId", "==", TID).get();
  { let batch = db.batch(), ops = 0; for (const d of csnap.docs) {
    const kids = (d.data() as { children?: { name?: string; sex?: string }[] }).children ?? [];
    if (!kids.length) continue;
    batch.update(d.ref, { children: kids.map((k) => ({ ...k, sex: k.sex ?? (k.name ? sexOf(k.name) : "boy") })) });
    if (++ops >= 400) { await batch.commit(); batch = db.batch(); ops = 0; }
  } if (ops) await batch.commit(); }

  // 4) add-ons on ~45% of bookings
  const bsnap = await db.collection("bookings").where("tenantId", "==", TID).get();
  const r = rng(0xB00C); let batch = db.batch(), ops = 0, withAddon = 0;
  for (const d of bsnap.docs) {
    if ((d.data() as { addons?: string[] }).addons?.length) { withAddon++; continue; }
    const picks = ADDONS.filter(() => r() < 0.5).map((a) => a.id);
    const addonsForBooking = r() < 0.45 ? (picks.length ? picks : [ADDONS[0].id]) : [];
    if (addonsForBooking.length) withAddon++;
    batch.update(d.ref, { addons: addonsForBooking });
    if (++ops >= 400) { await batch.commit(); batch = db.batch(); ops = 0; }
  }
  if (ops) await batch.commit();
  console.log(`✓ ${TID}: ${addons.length} add-ons in library; ${lsnap.size} listings attached; ${csnap.size} customers gendered; ${withAddon} bookings with add-ons.`);
  process.exit(0);
}
run().catch((e) => { console.error(e); process.exit(1); });
