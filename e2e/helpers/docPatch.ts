// Merges a JSON patch into ONE Firestore document (Admin SDK) and prints the resulting doc — e2e uses it to age a timestamp the API only
// ever sets to "now" (e.g. make the tutor's last presence in a room 2 hours old). Test data only; refuses the two real tenants' docs.
//   npx tsx ../e2e/helpers/docPatch.ts <collection> <docId> '<json patch>'      (run from server/)
import { db } from "../../server/src/firebase";

const REAL = new Set(["7jG2XO3cOD3VtoL8YfFY", "jYp5XNZGT7bgSUMuEgHN"]);
const [collection, id, json] = process.argv.slice(2);
if (!collection || !id || !json) { console.error("usage: docPatch <collection> <docId> '<json>'"); process.exit(2); }
(async () => {
  const ref = db.collection(collection).doc(id);
  const before = await ref.get();
  if (!before.exists) { console.error("no such doc"); process.exit(3); }
  if (REAL.has(String(before.get("tenantId")))) { console.error("refusing to patch a real tenant's document"); process.exit(4); }
  await ref.update(JSON.parse(json));
  process.stdout.write(`\n@@DOC@@${JSON.stringify((await ref.get()).data())}@@END@@\n`);
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
