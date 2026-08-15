// Milestones — a phased operational timeline for franchises. Head office owns a
// master template (phases → steps, each deep-linking into the app); every
// franchise sees it as their live timeline with progress. The recurring phases
// (plan / run / wrap a season) reset each season; one-time phases (launch setup,
// starting clubs) persist. Front-end demo model; backend owed.

export interface MStepLink { label: string; href: string }
export interface MStep { id: string; title: string; detail?: string; links?: MStepLink[] }

export type MPhaseWhen = "setup" | "before" | "during" | "after" | "clubs";
export const WHEN_LABEL: Record<MPhaseWhen, string> = {
  setup: "One-time · at launch",
  before: "Weeks before each season",
  during: "Camp & club days",
  after: "After each season",
  clubs: "Setting up term-time clubs",
};
export const WHEN_TONE: Record<MPhaseWhen, string> = { setup: "#1d3a8f", before: "#b45309", during: "#0f7a43", after: "#6d28d9", clubs: "#0e7490" };

export interface MPhase { id: string; title: string; subtitle?: string; when: MPhaseWhen; recurring: boolean; icon: string; steps: MStep[] }

// Progress: recurring phases are scored against the current season; one-time
// phases are scored once (persist across seasons).
export interface MProgress { season: string; doneSeason: string[]; doneOneTime: string[] }

export const emptyProgress = (season: string): MProgress => ({ season, doneSeason: [], doneOneTime: [] });
export const isStepDone = (p: MPhase, stepId: string, prog: MProgress) => (p.recurring ? prog.doneSeason : prog.doneOneTime).includes(stepId);
export const phaseDone = (p: MPhase, prog: MProgress) => { const set = p.recurring ? prog.doneSeason : prog.doneOneTime; return p.steps.filter((s) => set.includes(s.id)).length; };
export const phasePct = (p: MPhase, prog: MProgress) => (p.steps.length ? Math.round((phaseDone(p, prog) / p.steps.length) * 100) : 0);
export const phaseComplete = (p: MPhase, prog: MProgress) => p.steps.length > 0 && phaseDone(p, prog) === p.steps.length;
export function overallPct(phases: MPhase[], prog: MProgress) {
  const total = phases.reduce((a, p) => a + p.steps.length, 0);
  const done = phases.reduce((a, p) => a + phaseDone(p, prog), 0);
  return total ? Math.round((done / total) * 100) : 0;
}
// The phase a franchise is "at" — first incomplete phase (index), else last.
export function currentPhaseIndex(phases: MPhase[], prog: MProgress) {
  const i = phases.findIndex((p) => !phaseComplete(p, prog));
  return i === -1 ? phases.length - 1 : i;
}
