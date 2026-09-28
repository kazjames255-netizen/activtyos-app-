// READ-ONLY audit of lesson EXIT quizzes (lesson.quizId -> hubAssessments), the general (non-worksheet) case,
// for the same two bug classes: missing lessonId field, audience mismatches. Also duplicate/orphan checks.
// No writes, ever. Run: cd server && npx tsx scratch/audit-lesson-quizzes.ts
import { db } from "../src/firebase";
import { findOakDeep } from "../src/oak/noOak";
import { shardedTenantRead } from "../src/lib/hubIndex";

const TENANTS = ["7jG2XO3cOD3VtoL8YfFY", "jYp5XNZGT7bgSUMuEgHN"];
const SAMPLE_PER_TENANT = 250; // "hundreds", not all — these tenants can hold thousands of lessons

async function main() {
  const log = (s: string) => console.log(s);

  for (const tenant of TENANTS) {
    log(`\n===== TENANT ${tenant} (lesson exit quizzes) =====`);
    const allNotesDocs = await shardedTenantRead(db.collection("hubNotes"), tenant, ["lesson.quizId", "lesson.year", "title", "topicId"]);
    const withQuiz = allNotesDocs.filter((d) => typeof d.get("lesson.quizId") === "string" && d.get("lesson.quizId"));
    log(`notes total: ${allNotesDocs.length}, with lesson.quizId: ${withQuiz.length}`);

    // sample spread across the set rather than just the first N
    const step = Math.max(1, Math.floor(withQuiz.length / SAMPLE_PER_TENANT));
    const sample = withQuiz.filter((_, i) => i % step === 0).slice(0, SAMPLE_PER_TENANT);
    log(`sampling ${sample.length} notes`);

    const quizIdToNoteIds = new Map<string, string[]>();
    for (const d of withQuiz) {
      const qid = d.get("lesson.quizId") as string;
      quizIdToNoteIds.set(qid, [...(quizIdToNoteIds.get(qid) ?? []), d.id]);
    }
    let dupCount = 0;
    for (const [qid, ids] of quizIdToNoteIds) if (ids.length > 1) { dupCount++; if (dupCount <= 20) log(`DUPLICATE LESSON-QUIZ LINK: quizId ${qid} referenced by lesson.quizId of multiple notes: ${ids.join(", ")}`); }
    if (dupCount > 20) log(`... (${dupCount} total duplicate quizId references, only first 20 shown)`);

    let missingLessonId = 0, badLessonIdRef = 0, audienceMismatch = 0, checked = 0, brokenRef = 0, brandHits = 0;
    for (const noteDoc of sample) {
      const quizId = noteDoc.get("lesson.quizId") as string;
      const asm = await db.collection("hubAssessments").doc(quizId).get();
      checked++;
      if (!asm.exists) { brokenRef++; log(`BROKEN REF: hubNotes/${noteDoc.id} lesson.quizId=${quizId} -> no such hubAssessments doc`); continue; }
      const a = asm.data() as Record<string, unknown>;
      if (typeof a.lessonId !== "string" || !a.lessonId) { missingLessonId++; log(`MISSING lessonId: hubAssessments/${quizId} (note ${noteDoc.id}, tenant ${tenant})`); }
      else if (a.lessonId !== noteDoc.id) { badLessonIdRef++; log(`WRONG lessonId: hubAssessments/${quizId}.lessonId=${a.lessonId} but referencing note is ${noteDoc.id}`); }

      const lessonYear = noteDoc.get("lesson.year") as unknown;
      const audience = a.audience as { yearGroups?: string[] } | undefined;
      if (lessonYear != null && audience?.yearGroups?.length) {
        const wantLabel = `year ${lessonYear}`.toLowerCase();
        if (!audience.yearGroups.some((y) => y.toLowerCase() === wantLabel)) { audienceMismatch++; log(`AUDIENCE MISMATCH: hubAssessments/${quizId} audience=${JSON.stringify(audience.yearGroups)} lesson.year=${lessonYear} (note ${noteDoc.id})`); }
      } else if (!audience?.yearGroups?.length) { audienceMismatch++; log(`AUDIENCE MISSING: hubAssessments/${quizId} (note ${noteDoc.id}, lesson.year=${String(lessonYear)})`); }

      const hits = findOakDeep(a, 5);
      if (hits.length) { brandHits++; log(`BRAND HIT (exit-quiz assessment): hubAssessments/${quizId} — ${hits.map((h) => `${h.path}: "${h.sample}"`).join(" | ")}`); }
    }
    log(`\n--- ${tenant} exit-quiz summary (sampled ${checked}/${withQuiz.length}) ---`);
    log(`brokenRef: ${brokenRef}, missingLessonId: ${missingLessonId}, badLessonIdRef: ${badLessonIdRef}, audienceMismatch/missing: ${audienceMismatch}, brandHits: ${brandHits}, duplicateQuizIdLinks: ${dupCount}`);
  }
  console.log("\n\nDONE");
}

main().catch((e) => { console.error(e); process.exit(1); });
