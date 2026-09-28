// Prints one Firestore game-session document as JSON, answer keys included — the e2e spec plays a run the way a
// perfect child would and needs the key the server holds (the browser never gets it). Run with tsx from server/:
//   npx tsx ../e2e/helpers/gameDoc.ts <collection> <docId>
import { db } from "../../server/src/firebase";

const [collection, id] = process.argv.slice(2);
if (!collection || !id) { console.error("usage: gameDoc <collection> <docId>"); process.exit(2); }
(async () => {
  const s = await db.collection(collection).doc(id).get();
  process.stdout.write(`\n@@DOC@@${JSON.stringify(s.exists ? s.data() : null)}@@END@@\n`);
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
