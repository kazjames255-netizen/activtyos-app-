// Server-side twin of the checkout's required child-question rule (CF-005).
// The UI blocks a booking whose child has a required provider question
// unanswered, but a race (the child added before the provider's settings had
// loaded) or a direct API call skips that — so the booking endpoint re-checks.
// Mirrors lib/settings.ts questionsFor + components/QuestionFields
// unansweredRequired; kept dependency-free (that module is a React client file).

export type ChildQ = {
  id: string; label?: string; required?: boolean; hidden?: boolean; ask?: string;
  minAge?: number; maxAge?: number; scope?: "all" | string[];
};

const ageOn = (dob: string | undefined, iso: string): number | null => {
  if (!dob || !iso) return null;
  const b = new Date(`${dob}T00:00:00Z`), on = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(b.getTime()) || Number.isNaN(on.getTime())) return null;
  let age = on.getUTCFullYear() - b.getUTCFullYear();
  const m = on.getUTCMonth() - b.getUTCMonth();
  if (m < 0 || (m === 0 && on.getUTCDate() < b.getUTCDate())) age -= 1;
  return age;
};

/** Labels of the REQUIRED questions that apply to this child on this listing and have no answer. */
export function missingRequiredQuestions(opts: {
  questions: ChildQ[];
  listingId: string;
  /** ISO dob (YYYY-MM-DD) when known; age-gated questions are skipped without one. */
  dob?: string;
  /** First day attended, ISO. */
  runFrom: string;
  /** Every answer we hold for this booking: the child's stored ones plus this booking's. */
  answers: Record<string, string>;
  /** False when the child has no saved record: their "once" answers can't be seen, so only "every" questions are checked. */
  saved: boolean;
}): string[] {
  const age = ageOn(opts.dob, opts.runFrom);
  return opts.questions
    .filter((q) => {
      if (q.hidden || !q.required) return false;
      if (q.ask !== "every" && !opts.saved) return false;
      if (q.minAge !== undefined || q.maxAge !== undefined) {
        if (age === null) return false;
        if (q.minAge !== undefined && age < q.minAge) return false;
        if (q.maxAge !== undefined && age > q.maxAge) return false;
      }
      if (!q.scope || q.scope === "all") return true;
      return q.scope.includes(opts.listingId);
    })
    .filter((q) => !(opts.answers[q.id] ?? "").trim())
    .map((q) => q.label || q.id);
}
