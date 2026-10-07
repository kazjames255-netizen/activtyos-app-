// Simulates other providers editing listings/blocks while a parent has Browse open: touches the throwaway listing's doc N times, 2.5 s apart.
import fs from "node:fs";
import { db } from "../../../server/src/firebase";
const A = JSON.parse(fs.readFileSync(new URL("./accounts.json", import.meta.url), "utf8"));
const n = Number(process.argv[2] || 4);
for (let i = 0; i < n; i++) {
  await new Promise((r) => setTimeout(r, 2500));
  await db.collection("listings").doc(A.listingId).update({ qaTouch: Date.now() });
  const b = await db.collection("blocks").where("listingId", "==", A.listingId).limit(1).get();
  if (!b.empty) await b.docs[0].ref.update({ qaTouch: Date.now() });
}
process.exit(0);
