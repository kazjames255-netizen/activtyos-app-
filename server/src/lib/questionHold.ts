/** True when any hold-if-No question (ids in `reviewNoQ`) was answered "No" (case/space-insensitive) in `answers`.
 *  Extracted verbatim from routes/my.ts so the rule can be unit tested. */
export function heldByNoAnswer(reviewNoQ: string[], answers?: Record<string, string> | null): boolean {
  return reviewNoQ.length > 0 && !!answers && reviewNoQ.some((qid) => (answers[qid] ?? "").trim().toLowerCase() === "no");
}
