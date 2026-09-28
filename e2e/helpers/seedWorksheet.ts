// Run with tsx from server/ (see seedWorksheet() in the specs): gives a note an Oak-style worksheet PDF in Storage + the
// note pointers (`worksheetFile`, optional `worksheetQuizId`), exactly what oak/worksheetBulk.ts leaves behind.
//   npx tsx ../e2e/helpers/seedWorksheet.ts <tenantId> <noteId> [quizId]
import { db } from "../../server/src/firebase";
import { putWorksheetObject } from "../../server/src/lib/worksheetStorage";

const [tenantId, noteId, quizId] = process.argv.slice(2);
if (!tenantId || !noteId) { console.error("usage: seedWorksheet <tenantId> <noteId> [quizId]"); process.exit(2); }
const text = "E2E worksheet: question 1";
const pdf = Buffer.from(`%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 300 200]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>endobj\n4 0 obj<</Length ${text.length + 40}>>stream\nBT /F1 14 Tf 20 100 Td (${text}) Tj ET\nendstream\nendobj\n5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj\ntrailer<</Root 1 0 R/Size 6>>\n%%EOF\n`);
(async () => {
  await putWorksheetObject(tenantId, noteId, pdf);
  await db.collection("hubNotes").doc(noteId).update({ worksheetFile: { name: "e2e-worksheet.pdf", size: pdf.length, pages: 1 }, ...(quizId ? { worksheetQuizId: quizId } : {}) });
  console.log("seeded", noteId);
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
