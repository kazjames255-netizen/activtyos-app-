// PURE rules for the new-provider set-up emails (extracted from onboardingNudges.ts, behaviour unchanged).
export type Stage = "d1" | "d3" | "d5";
export interface Facts { hasListing: boolean; hasLiveListing: boolean; planStarted: boolean; payChosen: boolean }
export interface OpenSteps { listing: boolean; plan: boolean; pay: boolean }

export const STAGE_DAY: Record<Stage, number> = { d1: 1, d3: 3, d5: 5 };
export const STAGES: Stage[] = ["d1", "d3", "d5"];

/** What (if anything) to do for one stage given the facts. Pure, so it can be tested without a database. */
export function decide(stage: Stage, f: Facts): { send: boolean; open: OpenSteps } {
  const open: OpenSteps = { listing: !f.hasListing, plan: !f.planStarted, pay: !f.payChosen };
  if (f.hasLiveListing) return { send: false, open };                    // already live: the series is over
  if (stage === "d1") return { send: !f.hasListing, open };               // only asks for the first listing
  if (stage === "d3") return { send: open.listing || open.pay, open };    // checklist, only what is still open
  return { send: true, open };                                            // d5: not live yet, say what is left
}

