// Run with tsx from server/ (see seedWorksheet() in the specs): marks a note as a worksheet by pointing it at an auto-marked quiz
// (`worksheetQuizId`) — exactly what the worksheet-quiz converter leaves behind. There are no worksheet PDFs.
//   npx tsx ../e2e/helpers/seedWorksheet.ts <tenantId> <noteId> <quizId>
import { db } from "../../server/src/firebase";

const [tenantId, noteId, quizId] = process.argv.slice(2);
if (!tenantId || !noteId || !quizId) { console.error("usage: seedWorksheet <tenantId> <noteId> <quizId>"); process.exit(2); }
(async () => {
  await db.collection("hubNotes").doc(noteId).update({ worksheetQuizId: quizId });
  console.log("seeded", noteId);
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
