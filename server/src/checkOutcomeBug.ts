import "dotenv/config";
import { db } from "./firebase";
import { shardedTenantRead } from "./lib/hubIndex";
async function run() {
  const docs = await shardedTenantRead(db.collection("hubNotes"), "shared-library", ["title"]);
  const hits = docs.filter(d => (d.get("title") as string || "").toLowerCase().includes("acids with metals"));
  console.log(`${docs.length} notes, ${hits.length} match`);
  for (const h of hits.slice(0, 5)) console.log(" -", h.id, "|", h.get("title"));
}
run().catch(e => { console.error(e); process.exit(1); });
