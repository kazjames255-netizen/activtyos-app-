// READY-TO-RUN FIX (NOT run by the audit) — for the owner to run directly.
//
// Finding: 4 worksheet-authored quizzes (GCSE Science: rates of reaction / collision theory / surface area),
// on BOTH real tenants, were loaded with audience.yearGroups = ["Year 10"] while the lesson they belong to
// (hubNotes.lesson.year, confirmed against the actual lesson doc) is Year 11. Root cause: the worksheet-quiz
// pipeline's lesson-selection row for these 4 lessons carried the wrong `year` (10 instead of 11) — everything
// downstream (worksheetQuiz.ts stageLoad → yearLabelOf(cfg, r.year)) faithfully used that wrong value. This is
// a DATA issue only; the lessonId-field / audience-bypass CODE fixes verified fine (0 missing lessonId, 0 bad
// ref, across all 866 worksheet quizzes on both tenants; 0 audience mismatches in a 500-doc spread sample of
// general lesson exit-quizzes).
//
// Effect while wrong: the quiz plays fine for a Year 11 child (attempts.ts exempts a lesson's own quiz —
// `asm.lessonId` set — from the audience gate), but any year-filtered listing/count that reads `audience`
// directly (assessments.ts eligibleCount/audienceUnknownCount, tutor "Year 10" filters, etc.) misfiles it.
//
// This script ONLY touches the `audience` field of the 8 exact hubAssessments docs below (4 lessons × 2 real
// tenants), Year 10 -> Year 11, matching each doc's own lesson's actual year. Nothing else is touched.
//
// Usage:
//   cd server && npx tsx scratch/fix-worksheet-quiz-audience-year.ts            # dry run (default, no writes)
//   cd server && npx tsx scratch/fix-worksheet-quiz-audience-year.ts --apply    # writes, real tenants
import { db } from "../src/firebase";

const FIXES: { id: string; expectYear: number }[] = [
  { id: "ws-7jG2XO3cOD3VtoL8YfFY-the-rate-of-a-chemical-reaction-including-graphs", expectYear: 11 },
  { id: "ws-7jG2XO3cOD3VtoL8YfFY-collision-theory", expectYear: 11 },
  { id: "ws-7jG2XO3cOD3VtoL8YfFY-surface-area-and-rate-practical", expectYear: 11 },
  { id: "ws-7jG2XO3cOD3VtoL8YfFY-surface-area-and-rate-analysis", expectYear: 11 },
  { id: "ws-jYp5XNZGT7bgSUMuEgHN-the-rate-of-a-chemical-reaction-including-graphs", expectYear: 11 },
  { id: "ws-jYp5XNZGT7bgSUMuEgHN-collision-theory", expectYear: 11 },
  { id: "ws-jYp5XNZGT7bgSUMuEgHN-surface-area-and-rate-practical", expectYear: 11 },
  { id: "ws-jYp5XNZGT7bgSUMuEgHN-surface-area-and-rate-analysis", expectYear: 11 },
];

async function main() {
  const apply = process.argv.includes("--apply");
  for (const { id, expectYear } of FIXES) {
    const ref = db.collection("hubAssessments").doc(id);
    const snap = await ref.get();
    if (!snap.exists) { console.log(`SKIP ${id}: doc no longer exists`); continue; }
    const audience = snap.get("audience") as { yearGroups?: string[]; ageMin?: unknown; ageMax?: unknown } | undefined;
    const lessonId = snap.get("lessonId") as string | undefined;
    const wantLabel = `Year ${expectYear}`;
    if (audience?.yearGroups?.length === 1 && audience.yearGroups[0] === wantLabel) { console.log(`OK already ${wantLabel}: ${id}`); continue; }
    // Re-verify against the live lesson doc's own year before writing anything, in case the lesson has since changed.
    const lessonYear = lessonId ? (await db.collection("hubNotes").doc(lessonId).get()).get("lesson.year") : null;
    if (lessonYear !== expectYear) { console.log(`ABORT ${id}: expected lesson.year ${expectYear} but live lesson.year is ${lessonYear} — re-check before touching`); continue; }
    console.log(`${apply ? "APPLYING" : "WOULD APPLY"}: ${id} audience.yearGroups ${JSON.stringify(audience?.yearGroups)} -> ["${wantLabel}"]`);
    if (apply) await ref.update({ "audience.yearGroups": [wantLabel] });
  }
  console.log(apply ? "\nDone — writes applied." : "\nDry run only — pass --apply to write.");
}

main().catch((e) => { console.error(e); process.exit(1); });
