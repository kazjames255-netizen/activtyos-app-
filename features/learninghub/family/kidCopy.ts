import { useFamily } from "./FamilyContext";

// Kind child language (P-13) in ONE place. Only child screens (kid mode) use it, and only for children under Year 10:
// a teenager gets the same plain factual words a grown-up does. Rules: never "Late" or "Overdue" in front of a
// child; icon + word; no pass-mark arithmetic. Tutor and parent wording stays factual and is untouched.
// "Not quite" (a single wrong answer) is already kind and six specs assert it, so it is NOT in this table.

export type KidBand = "ks1" | "ks2" | "ks3" | "teen";

/** Year group text ("Year 5", "Reception", "Y3") to a band; null when it can't be read. */
export function bandOfYear(yearGroup: string | null | undefined): KidBand | null {
  if (!yearGroup) return null;
  if (/reception|nursery/i.test(yearGroup)) return "ks1";
  const n = Number(/(\d{1,2})/.exec(yearGroup)?.[1]);
  if (!Number.isFinite(n) || n < 0) return null;
  return n <= 2 ? "ks1" : n <= 6 ? "ks2" : n <= 9 ? "ks3" : "teen";
}

/** Graceful fallback: an unknown year is treated as KS2 (kind wording, a short list). */
export const bandOrDefault = (yearGroup: string | null | undefined): KidBand => bandOfYear(yearGroup) ?? "ks2";

/** Kind wording is on for a child's screen (kid mode) below Year 10. */
export function useKidCopy(yearGroup?: string | null): { kind: boolean; band: KidBand } {
  const kid = useFamily().kid;
  const band = bandOrDefault(yearGroup);
  return { kind: kid && band !== "teen", band };
}

export const KID_COPY = {
  waiting: "Waiting for you",
  waitingSince: (day: string) => `Waiting for you since ${day}`,
  handedIn: "Handed in",
  marked: "Marked",
  nearlyThere: "Nearly there. Have another go.",
  haveAnotherGo: "Have another go",
  homeworkWaiting: (n: number) => `${n} homework waiting for you`,
  loadFailed: "Oops! Let's try again.",
} as const;
