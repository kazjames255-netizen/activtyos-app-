// Display-only translation of the appraisal label maps in lib/appraisals.ts
// (the stored keys — "probation", "self", 3-3 … — stay canonical English).
// Nine-box names are provider-editable and stored: they are translated only
// while they still equal the shipped defaults.
import { tNow } from "@/lib/i18n/provider";
import { NINEBOX, type BoxDef, type ReviewKind, type ReviewStatus, type Rating, type Goal, type PIP, type FeedbackKind } from "@/lib/appraisals";

const KIND: Record<ReviewKind, string> = { probation: "staffp.aprKindProbation", "3-month": "staffp.aprKind3m", "6-month": "staffp.aprKind6m", annual: "staffp.aprKindAnnual", supervision: "staffp.aprKindSupervision" };
const STATUS: Record<ReviewStatus, string> = { scheduled: "staffp.aprStScheduled", self: "staffp.aprStSelf", manager: "staffp.aprStManager", signoff: "staffp.aprStSignoff", complete: "staffp.aprStComplete" };
const GOAL: Record<Goal["status"], string> = { open: "staffp.aprGoalOpen", progress: "staffp.aprGoalProgress", done: "staffp.aprGoalDone", carried: "staffp.aprGoalCarried" };
const PIPST: Record<PIP["status"], string> = { open: "p8wf.aprPipStOpen", met: "p8wf.aprPipStMet", extended: "p8wf.aprPipStExtended", escalated: "p8wf.aprPipStEscalated", closed: "p8wf.aprPipStClosed" };
const FB: Record<FeedbackKind, string> = { kudos: "p8wf.aprFbKudos", concern: "p8wf.aprFbConcern", supervision: "p8wf.aprFbSupervision" };

export const kindL = (k: ReviewKind) => tNow(KIND[k]);
export const statusL = (s: ReviewStatus) => tNow(STATUS[s]);
export const ratingL = (n: Rating) => tNow(`staffp.aprRate${n}`);
export const goalL = (s: Goal["status"]) => tNow(GOAL[s]);
export const pipL = (s: PIP["status"]) => tNow(PIPST[s]);
export const fbL = (k: FeedbackKind) => tNow(FB[k]);
export const lvl = (n: 1 | 2 | 3, form: "short" | "long" = "long") => tNow(n === 1 ? "p8wf.aprLvLow" : n === 2 ? (form === "short" ? "p8wf.aprLvMed" : "p8wf.aprLvMedium") : "p8wf.aprLvHigh");
export const boxLabel = (key: string, b: BoxDef) => (NINEBOX[key] && b.label === NINEBOX[key].label ? tNow(`p8wf.aprBox${key.replace("-", "")}`) : b.label);
export const boxAction = (key: string, b: BoxDef) => (NINEBOX[key] && b.action === NINEBOX[key].action ? tNow(`p8wf.aprAct${key.replace("-", "")}`) : b.action);

import { useI18n } from "@/lib/i18n/provider";
/** `T("aprX")` = the p8wf.aprX catalogue entry; re-renders on language change. */
export function useAp() {
  const { t, locale } = useI18n();
  const T = (k: string, v?: Record<string, string | number>) => t(`p8wf.${k}`, v);
  return { T, t, locale, aL: (a: string) => (a === "You" ? T("aprYou") : a) };
}
