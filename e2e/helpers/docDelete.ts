// Deletes ONE Firestore document (Admin SDK) — e2e cleanup of throwaway docs only. Refuses the two real tenants' docs.
//   npx tsx ../e2e/helpers/docDelete.ts <collection> <docId>      (run from server/)
import { db } from "../../server/src/firebase";

const REAL = new Set(["7jG2XO3cOD3VtoL8YfFY", "jYp5XNZGT7bgSUMuEgHN"]);
const [collection, id] = process.argv.slice(2);
if (!collection || !id) { console.error("usage: docDelete <collection> <docId>"); process.exit(2); }
(async () => {
  const ref = db.collection(collection).doc(id);
  const s = await ref.get();
  if (!s.exists) { process.stdout.write("\n@@DOC@@absent@@END@@\n"); process.exit(0); }
  if (REAL.has(String(s.get("tenantId")))) { console.error("refusing to delete a real tenant's document"); process.exit(4); }
  await ref.delete();
  process.stdout.write("\n@@DOC@@deleted@@END@@\n");
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
