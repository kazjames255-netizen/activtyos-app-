// One-off: remove every Oak worksheet PDF (Storage tenants/<tid>/oak-worksheets/*.pdf) and the `worksheetFile` pointer on hubNotes.
// The auto-marked quiz (`worksheetQuizId`) is left untouched. Kaz dropped the PDF feature.
//
//   cd server && npx tsx src/oak/removeWorksheetPdfs.ts            (dry: counts per tenant, deletes nothing)
//   cd server && npx tsx src/oak/removeWorksheetPdfs.ts --delete   (deletes; REFUSES if either real tenant holds any)
import { FieldValue } from "firebase-admin/firestore";
import { db } from "../firebase";
import { slideBucket } from "../lib/slideStorage";
import { refreshNotesIndex } from "./refreshNotesIndex";

const REAL = new Set(["7jG2XO3cOD3VtoL8YfFY", "jYp5XNZGT7bgSUMuEgHN"]);
const DELETE = process.argv.includes("--delete");

async function main() {
  const [files] = await slideBucket().getFiles({ prefix: "tenants/" });
  const objs = files.filter((f) => /^tenants\/[^/]+\/oak-worksheets\/.+/.test(f.name));
  const objByTenant = new Map<string, string[]>();
  for (const f of objs) { const t = f.name.split("/")[1]!; (objByTenant.get(t) ?? objByTenant.set(t, []).get(t)!).push(f.name); }

  const noteSnap = await db.collection("hubNotes").select("tenantId", "worksheetFile", "worksheetQuizId").get();
  const notesByTenant = new Map<string, string[]>();
  let quizNotes = 0;
  for (const d of noteSnap.docs) {
    if (d.get("worksheetQuizId")) quizNotes++;
    if (!d.get("worksheetFile")) continue;
    const t = d.get("tenantId") as string;
    (notesByTenant.get(t) ?? notesByTenant.set(t, []).get(t)!).push(d.id);
  }

  const tenants = [...new Set([...objByTenant.keys(), ...notesByTenant.keys()])];
  console.log(`hubNotes scanned: ${noteSnap.size} (with worksheetQuizId: ${quizNotes}); storage PDFs: ${objs.length}`);
  for (const t of tenants) console.log(`  ${t}${REAL.has(t) ? "  [REAL]" : ""}: ${objByTenant.get(t)?.length ?? 0} PDFs in Storage, ${notesByTenant.get(t)?.length ?? 0} notes with worksheetFile`);
  const realHit = tenants.filter((t) => REAL.has(t));
  if (realHit.length) { console.log(`STOP: real tenant(s) hold worksheet PDFs: ${realHit.join(", ")} — not deleting anything.`); process.exit(2); }
  if (!DELETE) { console.log("dry run — pass --delete to remove"); return; }

  let delObjs = 0, delFields = 0;
  for (const f of objs) { await f.delete({ ignoreNotFound: true }); delObjs++; }
  for (const [t, ids] of notesByTenant) {
    for (let i = 0; i < ids.length; i += 400) {
      const b = db.batch();
      for (const id of ids.slice(i, i + 400)) b.update(db.collection("hubNotes").doc(id), { worksheetFile: FieldValue.delete() });
      await b.commit(); delFields += Math.min(400, ids.length - i);
    }
    await refreshNotesIndex(t).catch(() => false);
  }
  console.log(`deleted ${delObjs} Storage PDFs, cleared worksheetFile on ${delFields} notes`);
}
main().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
