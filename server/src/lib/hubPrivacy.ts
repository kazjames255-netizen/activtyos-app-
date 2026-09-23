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

/** THE complete list of Learning Hub collections and how each relates to a child (P-11). `hubSelfTest5.ts` fails if
 *  any `hub*` collection used anywhere in server/src is missing here, or if a child-keyed one is not wired into BOTH
 *  eraseChildLearning and exportChildLearning below. Adding a collection that holds child data = add it here AND to
 *  erase/export, or the self-test goes red.
 *    delete  — docs keyed by `childId`, removed on erase
 *    scrub   — shared docs that list the child: the child is taken out, the doc stays
 *    none    — never holds a child's data (tutor content, aggregate counts, cache pings) */
export const HUB_COLLECTION_PRIVACY: Record<string, { how: "delete" | "scrub" | "none"; note: string }> = {
  hubEnrolments: { how: "delete", note: "childId" },
  hubSubmissions: { how: "delete", note: "childId (+ images with submissionId)" },
  hubFlashcardReviews: { how: "delete", note: "childId" },
  hubAttempts: { how: "delete", note: "childId" },
  hubMastery: { how: "delete", note: "childId" },
  hubDoubts: { how: "delete", note: "childId; the child's questions to the tutor" },
  hubFlashcardAssignments: { how: "delete", note: "childId" },
  hubLessons: { how: "scrub", note: "childIds, attendance.<id>, liveAnswers.<id>" },
  hubGroups: { how: "scrub", note: "childIds" },
  hubFamilyInvites: { how: "scrub", note: "childIds + childNames" },
  hubBoards: { how: "scrub", note: "child's drawn elements (cid) and their image docs" },
  hubHomework: { how: "scrub", note: "assignedChildIds" },
  hubToolStates: { how: "delete", note: "ownerKey == childId, ownerType child" },
  hubAssessments: { how: "none", note: "tutor content" },
  hubBoardTemplates: { how: "none", note: "never carries a student's work" },
  hubFlashcards: { how: "none", note: "tutor content" },
  hubNcTags: { how: "none", note: "curriculum tags" },
  hubNotes: { how: "none", note: "tutor content" },
  hubPings: { how: "none", note: "realtime cache pings" },
  hubQuestions: { how: "none", note: "tutor content" },
  hubToolEvents: { how: "none", note: "aggregate counts only" },
  hubTopics: { how: "none", note: "tutor content" },
};
/** Non-hub collections a child's hub activity also touches (erased/exported here too). */
export const HUB_RELATED_COLLECTIONS = ["images", "notifications"] as const;

const chunks = <T,>(xs: T[], n = 10) => Array.from({ length: Math.ceil(xs.length / n) }, (_, i) => xs.slice(i * n, i * n + n));

type Doc = FirebaseFirestore.QueryDocumentSnapshot;
const byChildren = async (col: string, childIds: string[]): Promise<Doc[]> =>
  (await Promise.all(chunks(childIds).map((c) => db.collection(col).where("childId", "in", c).get()))).flatMap((q) => q.docs);
const plain = (d: Doc) => ({ id: d.id, ...d.data() });

/** Everything the Learning Hub holds about these children (a parent's own). */
export async function exportChildLearning(uid: string, childIds: string[]): Promise<Record<string, unknown[]>> {
  const kids = new Set(childIds);
  const arr = async (col: string, f: string, c: string[]) => (await db.collection(col).where(f, "array-contains-any", c).get()).docs;
  const [enrol, submissions, reviews, attempts, mastery, lessons, doubts, assignments, groups, invites, boards, homework, toolStates] = await Promise.all([
    db.collection("hubEnrolments").where("parentUid", "==", uid).get(),
    byChildren("hubSubmissions", childIds),
    byChildren("hubFlashcardReviews", childIds),
    byChildren("hubAttempts", childIds),
    byChildren("hubMastery", childIds),
    Promise.all(chunks(childIds).map((c) => db.collection("hubLessons").where("childIds", "array-contains-any", c).get())).then((qs) => qs.flatMap((q) => q.docs)),
    byChildren("hubDoubts", childIds),
    byChildren("hubFlashcardAssignments", childIds),
    Promise.all(chunks(childIds).map((c) => arr("hubGroups", "childIds", c))).then((x) => x.flat()),
    Promise.all(chunks(childIds).map((c) => arr("hubFamilyInvites", "childIds", c))).then((x) => x.flat()),
    Promise.all(chunks(childIds).map((c) => arr("hubBoards", "childIds", c))).then((x) => x.flat()),
    Promise.all(chunks(childIds).map((c) => arr("hubHomework", "assignedChildIds", c))).then((x) => x.flat()),
    Promise.all(chunks(childIds).map((c) => db.collection("hubToolStates").where("ownerKey", "in", c).get())).then((qs) => qs.flatMap((q) => q.docs)),
  ]);
  const emails = [...new Set(enrol.docs.map((d) => String(d.get("parentEmail") ?? "").trim().toLowerCase()).filter(Boolean))];
  const bell = (await Promise.all(emails.map((e) => db.collection("notifications").where("email", "==", e).where("category", "==", "learning").get()))).flatMap((q) => q.docs);
  const uniq = <T extends { id: string }>(xs: T[]) => [...new Map(xs.map((x) => [x.id, x])).values()];
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
    learningLessons: uniq(lessons).map((d) => {
      const l = d.data();
      const mine = (l.childIds as string[]).filter((c) => kids.has(c));
      // The child's own live answers in a remote lesson (their position and in-progress answer), never a classmate's.
      const live = (l.liveAnswers ?? {}) as Record<string, Record<string, unknown>>;
      return {
        id: d.id, tenantId: l.tenantId, title: l.title, startsAt: l.startsAt, durationMins: l.durationMins, status: l.status, tutorName: l.tutorName,
        attendance: mine.map((c) => ({ childId: c, joinedAt: l.attendance?.[c] ?? null })),
        liveAnswers: mine.filter((c) => live[c]).map((c) => ({ childId: c, ...live[c] })),
      };
    }),
    // Questions the child asked their tutor (and the replies in those threads).
    learningDoubts: doubts.map((d) => {
      const x = d.data();
      return {
        id: d.id, tenantId: x.tenantId, lessonTitle: x.lessonTitle ?? null, childId: x.childId, childName: x.childName,
        messages: ((x.messages as { from?: string; text?: string; byName?: string; at?: string }[] | undefined) ?? []).map((m) => ({ from: m.from, text: m.text, byName: m.byName, at: m.at })),
        createdAt: x.createdAt,
      };
    }),
    learningFlashcardAssignments: assignments.map((d) => { const x = d.data(); return { id: d.id, tenantId: x.tenantId, childId: x.childId, topicId: x.topicId, assignedAt: x.assignedAt }; }),
    learningGroups: uniq(groups).map((d) => { const x = d.data(); return { id: d.id, tenantId: x.tenantId, name: x.name, childIds: (x.childIds as string[]).filter((c) => kids.has(c)) }; }),
    learningInvites: uniq(invites).map((d) => { const x = d.data(); return { id: d.id, tenantId: x.tenantId, forName: x.forName ?? null, claimedAt: x.claimedAt ?? null, childIds: ((x.childIds as string[]) ?? []).filter((c) => kids.has(c)) }; }),
    // Whiteboards: only what THEIR child drew (element type and time, not the tutor's or classmates' marks).
    learningBoards: uniq(boards).map((d) => {
      const pages = (d.get("pages") as { elements?: { cid?: string; k?: string }[] }[] | undefined) ?? [];
      const mine = pages.flatMap((p) => (p.elements ?? []).filter((e) => e.cid && kids.has(e.cid)));
      return { id: d.id, tenantId: d.get("tenantId"), lessonId: d.get("lessonId"), updatedAt: d.get("updatedAt"), childElements: mine.length, kinds: [...new Set(mine.map((e) => e.k))] };
    }),
    learningHomeworkAssignments: uniq(homework).map((d) => { const x = d.data(); return { id: d.id, tenantId: x.tenantId, title: x.title, instructions: x.instructions ?? "", dueAt: x.dueAt, setBy: x.createdByName ?? null, createdAt: x.createdAt }; }),
    learningToolStates: toolStates.filter((d) => d.get("ownerType") === "child").map((d) => ({ id: d.id, tenantId: d.get("tenantId"), toolId: d.get("toolId"), contextType: d.get("contextType"), contextId: d.get("contextId"), state: d.get("state") ?? null, updatedAt: d.get("updatedAt") ?? null })),
    learningNotifications: uniq(bell).map((d) => { const n = d.data(); return { id: d.id, tenantId: n.tenantId, title: n.title, body: n.body, at: n.at }; }),
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
  // Learn who to look for in the bell BEFORE the enrolments (which carry the parent's email) and doubts go.
  const parentEmails = [...new Set((await db.collection("hubEnrolments").where("childId", "==", childId).get()).docs.map((d) => String(d.get("parentEmail") ?? "").trim().toLowerCase()).filter(Boolean))];
  const doubtIds = (await db.collection("hubDoubts").where("childId", "==", childId).get()).docs.map((d) => d.id);
  for (const col of ["hubEnrolments", "hubSubmissions", "hubFlashcardReviews", "hubAttempts", "hubMastery", "hubDoubts", "hubFlashcardAssignments"]) await del(col);
  // Bell entries about this child: a tutor alert about one of their questions (ref = the doubt id), and the family's
  // own learning alerts whose deep link is for this child alone (`child=<id>`; multi-child alerts name several kids
  // and are left - see 11-open-questions.md).
  const bellDocs: FirebaseFirestore.QueryDocumentSnapshot[] = [];
  for (const part of chunks(doubtIds, 10)) bellDocs.push(...(await db.collection("notifications").where("ref", "in", part).get()).docs);
  for (const e of parentEmails) {
    const q = await db.collection("notifications").where("email", "==", e).where("category", "==", "learning").get();
    bellDocs.push(...q.docs.filter((d) => String(d.get("href") ?? "").includes(`child=${childId}`)));
  }
  for (const part of chunks([...new Map(bellDocs.map((d) => [d.id, d])).values()], 400)) { const b = db.batch(); for (const d of part) b.delete(d.ref); await b.commit(); }
  forgetEnrolments(); // the parent-enrolment cache must not keep granting hub access to an erased child

  // Shared docs: take the child out of them rather than deleting the tutor's lesson / homework.
  const lessons = await db.collection("hubLessons").where("childIds", "array-contains", childId).get();
  for (const part of chunks(lessons.docs, 400)) {
    const b = db.batch();
    for (const d of part) b.update(d.ref, { childIds: FieldValue.arrayRemove(childId), [`attendance.${childId}`]: FieldValue.delete(), [`liveAnswers.${childId}`]: FieldValue.delete() });
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
    // Pictures the child added to the board are their data too: delete the image docs behind their elements.
    const imageIds = ((d.get("pages") as { elements?: (El & { imageId?: string })[] }[] | undefined) ?? []).flatMap((p) => (p.elements ?? []).filter((e) => e.cid === childId && e.imageId).map((e) => e.imageId!));
    for (const part of chunks([...new Set(imageIds)], 400)) {
      const b = db.batch();
      for (const id of part) if (!/[/]/.test(id)) b.delete(db.collection("images").doc(id));
      await b.commit();
    }
    await d.ref.update({ pages, childIds: still });
  }
  // A child's autosaved tool work (Tools tab): keyed by the child, so erase it with them.
  const toolStates = await db.collection("hubToolStates").where("ownerKey", "==", childId).get();
  for (const part of chunks(toolStates.docs, 400)) {
    const b = db.batch();
    for (const d of part) if (d.get("ownerType") === "child") b.delete(d.ref);
    await b.commit();
  }
  const homework = await db.collection("hubHomework").where("assignedChildIds", "array-contains", childId).get();
  for (const part of chunks(homework.docs, 400)) {
    const b = db.batch();
    for (const d of part) b.update(d.ref, { assignedChildIds: FieldValue.arrayRemove(childId) });
    await b.commit();
  }
}
