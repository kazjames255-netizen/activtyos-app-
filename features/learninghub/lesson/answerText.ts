import type { Option } from "../shared-assess/api";

/** The correct answer of a checked question as a sentence fragment ("B, C" → the option texts, a pairing list, a sequence…).
 *  `correct` is whatever the server revealed (`correctAnswer`), in the shape of its marking rule. Returns "" when nothing to show. */
export function describeAnswer(correct: unknown, options?: Option[]): string {
  if (correct === null || correct === undefined) return "";
  // A picture-only option has no text to quote, so name it by its letter ("option B"), matching the tile's label.
  const byId = new Map((options ?? []).map((o, i) => [o.id, o.text || `option ${"ABCDEFGHIJ"[i] ?? i + 1}`] as const));
  if (typeof correct === "string") return byId.get(correct) ?? correct;
  if (typeof correct === "number") return String(correct);
  if (Array.isArray(correct)) {
    if (correct.every((x) => typeof x === "string")) {
      const parts = (correct as string[]).map((x) => byId.get(x) ?? x);
      // A list of option ids is a multi-choice key; a list of plain strings is an ordering (the correct sequence).
      return (options?.length ? parts.map((p) => p.replace(/[.!\s]+$/, "")).join("; ") : parts.map((p, i) => `${i + 1}) ${p}`).join("  "));
    }
    return correct.map((p) => {
      const o = (p ?? {}) as Record<string, unknown>;
      return typeof o.term === "string" && typeof o.definition === "string" ? `${o.term} → ${o.definition}` : "";
    }).filter(Boolean).join("; ");
  }
  return "";
}
