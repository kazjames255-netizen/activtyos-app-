import { db } from "../firebase";
import { okId } from "./hubCore";
import { attemptsCol, homeworkCol, notesCol, nowIso, submissionsCol } from "../routes/hub/teachingCommon";
import { pingHub } from "./hubPing";

// Homework <-> auto-marked attempts. A homework can list a legacy quiz (`assessmentId`) and any number of worksheets whose
// notes carry an auto-marked quiz (`worksheetQuizId`). The child's finished attempts at those, made FOR this homework, are
// the work; when every one is marked their total becomes the submission's mark (markedBy "auto"), which a tutor may override.

export interface HwAttempt { id: string; assessmentId: string; status: string; scoreMarks: number; maxMarks: number; submittedAt: string | null }

/** Quiz ids a homework needs done: the legacy quiz plus the auto-marked quiz of each interactive worksheet. */
export async function requiredQuizIds(tenantId: string, hw: { assessmentId?: string | null; worksheetNoteIds?: string[] }): Promise<{ legacy: string | null; worksheet: string[] }> {
  const ids = [...new Set(hw.worksheetNoteIds ?? [])].filter(okId);
  const worksheet: string[] = [];
  if (ids.length) {
    for (const n of await db.getAll(...ids.map((i) => notesCol.doc(i)), { fieldMask: ["tenantId", "worksheetQuizId", "worksheetFile"] })) {
      const q = n.exists && n.get("tenantId") === tenantId && n.get("worksheetFile") ? n.get("worksheetQuizId") : null;
      if (typeof q === "string" && q) worksheet.push(q);
    }
  }
  return { legacy: hw.assessmentId || null, worksheet: [...new Set(worksheet)] };
}

/** This child's newest finished attempt per quiz, made for this homework. */
export async function finishedFor(tenantId: string, homeworkId: string, childId: string): Promise<Map<string, HwAttempt>> {
  const snap = await attemptsCol.where("tenantId", "==", tenantId).where("childId", "==", childId).get();
  const out = new Map<string, HwAttempt>();
  for (const d of snap.docs) {
    if (d.get("homeworkId") !== homeworkId || d.get("status") === "in_progress") continue;
    const a: HwAttempt = { id: d.id, assessmentId: d.get("assessmentId"), status: d.get("status"), scoreMarks: Number(d.get("scoreMarks")) || 0, maxMarks: Number(d.get("maxMarks")) || 0, submittedAt: (d.get("submittedAt") as string | null) ?? null };
    const cur = out.get(a.assessmentId);
    if (!cur || (a.submittedAt ?? "") > (cur.submittedAt ?? "")) out.set(a.assessmentId, a);
  }
  return out;
}

/** The combined mark when every required quiz has a finished, fully marked attempt; otherwise null. */
export function combinedMark(required: string[], done: Map<string, HwAttempt>): { score: number; max: number } | null {
  if (!required.length) return null;
  let score = 0, max = 0;
  for (const q of required) {
    const a = done.get(q);
    if (!a || a.status !== "marked") return null;
    score += a.scoreMarks; max += a.maxMarks;
  }
  return max > 0 ? { score, max } : null;
}

export const autoMark = (m: { score: number; max: number }) => ({ score: m.score, max: m.max, feedback: "", markedBy: "auto", markedByName: "Automatic", markedAt: nowIso() });

/** After an attempt made for a homework is submitted or marked: refresh the (already handed-in) submission's automatic mark.
 *  Never overwrites a tutor's own mark; idempotent. */
export async function syncHomeworkMark(tenantId: string, homeworkId: string | null | undefined, childId: string | undefined): Promise<void> {
  if (!homeworkId || !childId || !okId(homeworkId)) return;
  try {
    const hw = await homeworkCol.doc(homeworkId).get();
    if (!hw.exists || hw.get("tenantId") !== tenantId) return;
    const subRef = submissionsCol.doc(`${homeworkId}__${childId}`);
    const sub = await subRef.get();
    if (!sub.exists || sub.get("tenantId") !== tenantId) return;
    const st = sub.get("status");
    const autoMarked = sub.get("mark.markedBy") === "auto";
    if (st === "assigned" || (st === "marked" && !autoMarked)) return;
    const req = await requiredQuizIds(tenantId, hw.data() as { assessmentId?: string | null; worksheetNoteIds?: string[] });
    const required = [...(req.legacy ? [req.legacy] : []), ...req.worksheet];
    const done = await finishedFor(tenantId, homeworkId, childId);
    const total = combinedMark(required, done);
    const attemptIds = required.map((q) => done.get(q)?.id).filter((x): x is string => !!x);
    if (total) {
      const cur = sub.get("mark") as { score: number; max: number } | null;
      if (st === "marked" && cur && cur.score === total.score && cur.max === total.max) return;
      await subRef.update({ status: "marked", mark: autoMark(total), attemptIds, updatedAt: nowIso() });
    } else if (autoMarked) {
      await subRef.update({ status: "submitted", mark: null, attemptIds, updatedAt: nowIso() }); // a retake now waits for marking
    } else return;
    pingHub(tenantId, "hubSubmissions");
  } catch { /* the attempt itself is saved; a later hand-in re-syncs */ }
}
