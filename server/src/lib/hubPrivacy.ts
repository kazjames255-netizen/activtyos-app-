import { FieldValue } from "firebase-admin/firestore";
import { db } from "../firebase";
import { forgetEnrolments } from "./hubCore";

// Learning Hub — a child's learning data and the two things GDPR needs of it:
//   · exportChildLearning — everything held about a parent's children, for
//     GET /api/privacy/export (routes/privacy.ts)
//   · eraseChildLearning  — remove it all when the parent deletes the child
//     (routes/my.ts DELETE /children/:id)
//
// Collections carrying a child's learning data (docs/learning-hub.md → Privacy):
//   hubEnrolments, hubSubmissions (+ the files a parent uploaded with them),
//   hubFlashcardReviews, hubAttempts + hubMastery (assessments), and a child's
//   attendance on / listing in hubLessons, hubHomework.assignedChildIds and hubGroups.childIds.

const chunks = <T,>(xs: T[], n = 10) => Array.from({ length: Math.ceil(xs.length / n) }, (_, i) => xs.slice(i * n, i * n + n));

type Doc = FirebaseFirestore.QueryDocumentSnapshot;
const byChildren = async (col: string, childIds: string[]): Promise<Doc[]> =>
  (await Promise.all(chunks(childIds).map((c) => db.collection(col).where("childId", "in", c).get()))).flatMap((q) => q.docs);
const plain = (d: Doc) => ({ id: d.id, ...d.data() });

/** Everything the Learning Hub holds about these children (a parent's own). */
export async function exportChildLearning(uid: string, childIds: string[]): Promise<Record<string, unknown[]>> {
  const kids = new Set(childIds);
  const [enrol, submissions, reviews, attempts, mastery, lessons] = await Promise.all([
    db.collection("hubEnrolments").where("parentUid", "==", uid).get(),
    byChildren("hubSubmissions", childIds),
    byChildren("hubFlashcardReviews", childIds),
    byChildren("hubAttempts", childIds),
    byChildren("hubMastery", childIds),
    Promise.all(chunks(childIds).map((c) => db.collection("hubLessons").where("childIds", "array-contains-any", c).get())).then((qs) => qs.flatMap((q) => q.docs)),
  ]);
  return {
    learningEnrolments: enrol.docs.map((d) => {
      const e = d.data();
      return { tenantId: e.tenantId, childId: e.childId, childName: e.childName, subjects: e.subjects ?? [], yearGroup: e.yearGroup ?? null, tutorName: e.tutorName ?? "", active: e.active !== false, enrolledAt: e.createdAt };
    }),
    // Each hand-in: what was written / attached (file names only — the files are on the family's screen), any quiz attempt, the tutor's mark and feedback.
    learningHomework: submissions.map((d) => {
      const s = d.data();
      return {
        id: d.id, tenantId: s.tenantId, homeworkId: s.homeworkId, childId: s.childId, status: s.status, text: s.text ?? "",
        attachments: ((s.attachments as { name?: string; contentType?: string; size?: number }[] | undefined) ?? []).map((a) => ({ name: a.name, contentType: a.contentType, size: a.size })),
        attemptId: s.attemptId ?? null, submittedAt: s.submittedAt ?? null, mark: s.mark ? { score: s.mark.score, max: s.mark.max, feedback: s.mark.feedback, markedAt: s.mark.markedAt } : null,
      };
    }),
    learningFlashcardReviews: reviews.map(plain),
    // An allow-list, NOT the raw doc: the stored attempt carries the question snapshot
    // with the answer key + explanations (and staff uids), which the family may only
    // see when the tutor's reveal rules allow — an export must not bypass them.
    learningAttempts: attempts.map((d) => {
      const a = d.data() as { answers?: { questionId?: string; response?: unknown; correct?: boolean | null; marksAwarded?: number; marksMax?: number; feedback?: string }[] } & Record<string, unknown>;
      return {
        id: d.id, tenantId: a.tenantId, assessmentId: a.assessmentId, assessmentTitle: a.assessmentTitle ?? null, assessmentType: a.assessmentType, subject: a.subject ?? null,
        childId: a.childId, status: a.status, scoreMarks: a.scoreMarks ?? null, maxMarks: a.maxMarks ?? null, pct: a.pct ?? null, byTopic: a.byTopic ?? null,
        startedAt: a.startedAt ?? null, submittedAt: a.submittedAt ?? null,
        answers: a.status === "in_progress" ? [] : (a.answers ?? []).map((x) => ({ questionId: x.questionId, response: x.response, correct: x.correct ?? null, marksAwarded: x.marksAwarded ?? null, marksMax: x.marksMax ?? null, feedback: x.feedback ?? "" })),
      };
    }),
    learningMastery: mastery.map(plain),
    // Live lessons: the lesson, and whether/when THEIR child joined — never another family's attendance.
    learningLessons: [...new Map(lessons.map((d) => [d.id, d])).values()].map((d) => {
      const l = d.data();
      const mine = (l.childIds as string[]).filter((c) => kids.has(c));
      return { id: d.id, tenantId: l.tenantId, title: l.title, startsAt: l.startsAt, durationMins: l.durationMins, status: l.status, tutorName: l.tutorName, attendance: mine.map((c) => ({ childId: c, joinedAt: l.attendance?.[c] ?? null })) };
    }),
  };
}

/** Delete every trace of a child's learning data (all providers). Best-effort per
 *  collection but each collection is cleared completely; safe to run twice. */
export async function eraseChildLearning(childId: string): Promise<void> {
  const del = async (col: string) => {
    const snap = await db.collection(col).where("childId", "==", childId).get();
    const subIds: string[] = [];
    for (const part of chunks(snap.docs, 400)) {
      const b = db.batch();
      for (const d of part) { b.delete(d.ref); if (col === "hubSubmissions") subIds.push(d.id); }
      await b.commit();
    }
    // The photos / PDFs a parent uploaded for a hand-in (attached or not) are personal data too.
    for (const part of chunks(subIds, 10)) {
      const files = await db.collection("images").where("submissionId", "in", part).get();
      for (const f of chunks(files.docs, 400)) { const b = db.batch(); for (const d of f) b.delete(d.ref); await b.commit(); }
    }
  };
  for (const col of ["hubEnrolments", "hubSubmissions", "hubFlashcardReviews", "hubAttempts", "hubMastery"]) await del(col);
  forgetEnrolments(); // the parent-enrolment cache must not keep granting hub access to an erased child

  // Shared docs: take the child out of them rather than deleting the tutor's lesson / homework.
  const lessons = await db.collection("hubLessons").where("childIds", "array-contains", childId).get();
  for (const part of chunks(lessons.docs, 400)) {
    const b = db.batch();
    for (const d of part) b.update(d.ref, { childIds: FieldValue.arrayRemove(childId), [`attendance.${childId}`]: FieldValue.delete() });
    await b.commit();
  }
  const groups = await db.collection("hubGroups").where("childIds", "array-contains", childId).get();
  for (const part of chunks(groups.docs, 400)) {
    const b = db.batch();
    for (const d of part) b.update(d.ref, { childIds: FieldValue.arrayRemove(childId) });
    await b.commit();
  }
  // A family invite remembers which child joined through it (id + first-name list): drop both.
  const invites = await db.collection("hubFamilyInvites").where("childIds", "array-contains", childId).get();
  for (const part of chunks(invites.docs, 400)) {
    const b = db.batch();
    for (const d of part) b.update(d.ref, { childIds: FieldValue.arrayRemove(childId), childNames: [] });
    await b.commit();
  }
  // Whiteboard drawings a child made on a live lesson (carry childId + first name only): take their elements off the board.
  const boards = await db.collection("hubBoards").where("childIds", "array-contains", childId).get();
  for (const d of boards.docs) {
    type El = { cid?: string };
    const pages = ((d.get("pages") as { elements?: El[] }[] | undefined) ?? []).map((p) => ({ ...p, elements: (p.elements ?? []).filter((e) => e.cid !== childId) }));
    const still = [...new Set(pages.flatMap((p) => p.elements.flatMap((e) => (e.cid ? [e.cid] : []))))];
    await d.ref.update({ pages, childIds: still });
  }
  const homework = await db.collection("hubHomework").where("assignedChildIds", "array-contains", childId).get();
  for (const part of chunks(homework.docs, 400)) {
    const b = db.batch();
    for (const d of part) b.update(d.ref, { assignedChildIds: FieldValue.arrayRemove(childId) });
    await b.commit();
  }
}
