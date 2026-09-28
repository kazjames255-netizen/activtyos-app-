// READ-ONLY content-integrity audit of worksheet-authored quizzes on the two real tenants.
// No writes, ever. Run: cd server && npx tsx scratch/audit-worksheet-quizzes.ts
import { db } from "../src/firebase";
import { findOakDeep } from "../src/oak/noOak";
import { shardedTenantRead } from "../src/lib/hubIndex";

const TENANTS = ["7jG2XO3cOD3VtoL8YfFY", "jYp5XNZGT7bgSUMuEgHN"];

// Case-SENSITIVE on the bare English words: a case-insensitive \bTODO\b false-positives on legitimate
// Spanish/Italian/Portuguese content using "todo"/"tutto" as an ordinary word (found 28 Sep 2026 on a
// Spanish worksheet: "Llevé todo en una bolsa grande" — real content, not a placeholder).
const PLACEHOLDER_RE = /\b(TODO|TBD|FIXME|XXX)\b|lorem ipsum|PLACEHOLDER|\[insert|\[answer here\]|coming soon/;
const LATEX_RE = /\\(?:frac|times|div|sqrt|cdot|pm|leq|geq|neq|left|right|begin\{|end\{)|\$\$|\^\{|_\{/;

async function main() {
  const log = (s: string) => { console.log(s); };

  for (const tenant of TENANTS) {
    log(`\n===== TENANT ${tenant} =====`);

    // 1. All notes with a worksheet quiz attached. A raw collection-wide get() times out at real-tenant scale
    // (thousands of hubNotes docs, per hubIndex.ts's own note) — reuse the app's own sharded, field-masked reader.
    const allNotesDocs = await shardedTenantRead(db.collection("hubNotes"), tenant, ["worksheetQuizId", "lesson.year", "topicId", "title"]);
    const notesSnap = { docs: allNotesDocs.filter((d) => typeof d.get("worksheetQuizId") === "string" && d.get("worksheetQuizId")), size: 0 };
    notesSnap.size = notesSnap.docs.length;
    log(`notes total for tenant: ${allNotesDocs.length}, with worksheetQuizId: ${notesSnap.size}`);

    const noteById = new Map(notesSnap.docs.map((d) => [d.id, d]));
    const quizIdToNoteIds = new Map<string, string[]>();
    for (const d of notesSnap.docs) {
      const qid = d.get("worksheetQuizId") as string;
      quizIdToNoteIds.set(qid, [...(quizIdToNoteIds.get(qid) ?? []), d.id]);
    }
    for (const [qid, ids] of quizIdToNoteIds) {
      if (ids.length > 1) log(`DUPLICATE: worksheetQuizId ${qid} referenced by multiple notes: ${ids.join(", ")}`);
    }

    // 2. Every hubAssessments doc with wsQuiz:true for this tenant (catches orphans: quiz exists, no note points to it)
    const allAsmDocs = await shardedTenantRead(db.collection("hubAssessments"), tenant, ["wsQuiz", "lessonId", "audience", "questionIds", "title", "subject", "topicIds", "createdBy", "createdByName", "instructions", "type"]);
    const wsAsmDocs = allAsmDocs.filter((d) => d.get("wsQuiz") === true);
    const wsAsmSnap = { docs: wsAsmDocs, size: wsAsmDocs.length };
    log(`hubAssessments total for tenant: ${allAsmDocs.length}, with wsQuiz=true: ${wsAsmSnap.size}`);
    const pointedTo = new Set(notesSnap.docs.map((d) => d.get("worksheetQuizId") as string));
    const orphans = wsAsmSnap.docs.filter((d) => !pointedTo.has(d.id));
    for (const o of orphans) log(`ORPHAN: hubAssessments/${o.id} (wsQuiz) — no hubNotes doc points to it via worksheetQuizId`);

    // duplicate lesson check: two different worksheet quizzes both claiming the same lessonId
    const lessonIdToAsm = new Map<string, string[]>();
    for (const d of wsAsmSnap.docs) {
      const lid = d.get("lessonId") as string | undefined;
      if (lid) lessonIdToAsm.set(lid, [...(lessonIdToAsm.get(lid) ?? []), d.id]);
    }
    for (const [lid, ids] of lessonIdToAsm) if (ids.length > 1) log(`DUPLICATE LESSON: lessonId ${lid} claimed by multiple worksheet quizzes: ${ids.join(", ")}`);

    const asmById = new Map(wsAsmSnap.docs.map((d) => [d.id, d]));

    let missingLessonId = 0, badLessonIdRef = 0, audienceMismatch = 0, checkedAsm = 0;
    let totalQ = 0, brandHits = 0, placeholderHits = 0, missingExplain = 0, latexHits = 0, badAnswerKey = 0;

    for (const [noteId, noteDoc] of noteById) {
      const quizId = noteDoc.get("worksheetQuizId") as string;
      const asm = asmById.get(quizId) ?? (await db.collection("hubAssessments").doc(quizId).get());
      checkedAsm++;
      if (!asm.exists) { log(`BROKEN REF: hubNotes/${noteId} -> worksheetQuizId ${quizId} does not exist as a hubAssessments doc`); continue; }
      const a = asm.data() as Record<string, unknown>;

      // Bug class 1: missing lessonId field
      if (typeof a.lessonId !== "string" || !a.lessonId) { missingLessonId++; log(`MISSING lessonId: hubAssessments/${quizId} (tenant ${tenant}) — field is ${JSON.stringify(a.lessonId)}`); }
      else if (a.lessonId !== noteId) { badLessonIdRef++; log(`WRONG lessonId: hubAssessments/${quizId}.lessonId=${a.lessonId} but the note pointing to it is ${noteId}`); }

      // Bug class 2: audience mismatch — the quiz's audience.yearGroups should match the lesson's own year
      const lessonYear = noteDoc.get("lesson.year") as unknown;
      const audience = a.audience as { yearGroups?: string[] } | undefined;
      if (lessonYear != null && audience?.yearGroups?.length) {
        const wantLabel = `year ${lessonYear}`.toLowerCase();
        const has = audience.yearGroups.some((y) => y.toLowerCase() === wantLabel);
        if (!has) { audienceMismatch++; log(`AUDIENCE MISMATCH: hubAssessments/${quizId} audience=${JSON.stringify(audience.yearGroups)} but lesson.year=${lessonYear} (note ${noteId})`); }
      } else if (!audience?.yearGroups?.length) {
        audienceMismatch++; log(`AUDIENCE MISSING: hubAssessments/${quizId} has no audience.yearGroups (note ${noteId}, lesson.year=${String(lessonYear)})`);
      }

      const asmHits = findOakDeep(a, 5);
      if (asmHits.length) { brandHits++; log(`BRAND HIT (assessment): hubAssessments/${quizId} — ${asmHits.map((h) => `${h.path}: "${h.sample}"`).join(" | ")}`); }

      const qids = (a.questionIds as string[] | undefined) ?? [];
      if (!qids.length) continue;
      const chunks: string[][] = [];
      for (let i = 0; i < qids.length; i += 300) chunks.push(qids.slice(i, i + 300));
      for (const chunk of chunks) {
        const refs = chunk.map((id) => db.collection("hubQuestions").doc(id));
        const docs = await db.getAll(...refs);
        for (const qd of docs) {
          if (!qd.exists) { badAnswerKey++; log(`MISSING QUESTION DOC: ${qd.id} referenced by hubAssessments/${quizId}`); continue; }
          totalQ++;
          const q = qd.data() as Record<string, unknown>;

          const hits = findOakDeep(q, 5);
          if (hits.length) { brandHits++; log(`BRAND HIT: hubQuestions/${qd.id} (quiz ${quizId}) — ${hits.map((h) => `${h.path}: "${h.sample}"`).join(" | ")}`); }

          const flatText = JSON.stringify(q);
          if (PLACEHOLDER_RE.test(flatText)) { placeholderHits++; log(`PLACEHOLDER TEXT: hubQuestions/${qd.id} — matched ${PLACEHOLDER_RE.exec(flatText)?.[0]}`); }
          if (LATEX_RE.test(flatText)) { latexHits++; log(`LATEX SYNTAX (should be unicode): hubQuestions/${qd.id} — ${LATEX_RE.exec(flatText)?.[0]}`); }

          const isWritten = (q.answer === null || q.answer === undefined) && (!q.acceptedAnswers || (q.acceptedAnswers as unknown[]).length === 0);
          if (isWritten && (!q.explanation || String(q.explanation).trim().length < 3)) { missingExplain++; log(`MISSING EXPLANATION (written Q): hubQuestions/${qd.id}`); }
          if (!isWritten) {
            const opts = q.options as { id: string; text: string }[] | undefined;
            if (opts && opts.length) {
              const ans = q.answer;
              const validIds = new Set(opts.map((o) => o.id));
              const answerIds = Array.isArray(ans) ? ans : [ans];
              const bad = answerIds.some((x) => typeof x !== "string" || !validIds.has(x));
              if (bad) { badAnswerKey++; log(`BAD ANSWER KEY: hubQuestions/${qd.id} answer=${JSON.stringify(ans)} options=${JSON.stringify(opts.map((o) => o.id))}`); }
            }
            if (q.items !== undefined && (!q.items || (q.items as unknown[]).length < 2)) { badAnswerKey++; log(`BAD ORDER ITEMS: hubQuestions/${qd.id}`); }
            if (q.pairs !== undefined && (q.pairs as unknown[]).length < 2) { badAnswerKey++; log(`BAD MATCH PAIRS: hubQuestions/${qd.id}`); }
          }
        }
      }
    }

    log(`\n--- ${tenant} summary ---`);
    log(`assessments checked: ${checkedAsm}, questions checked: ${totalQ}`);
    log(`missingLessonId: ${missingLessonId}, badLessonIdRef: ${badLessonIdRef}, audienceMismatch/missing: ${audienceMismatch}`);
    log(`brandHits: ${brandHits}, placeholderHits: ${placeholderHits}, latexHits(should be 0): ${latexHits}, missingExplain: ${missingExplain}, badAnswerKey: ${badAnswerKey}`);
  }

  console.log("\n\nDONE");
}

main().catch((e) => { console.error(e); process.exit(1); });
