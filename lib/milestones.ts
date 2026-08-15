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

// Progress: each step (sub-target) carries a start/end date and a completion %,
// so the roadmap plots them as dated bars. Recurring phases reset each season.
export interface StepState { start?: string; end?: string; pct: number }
export interface MProgress { season: string; steps: Record<string, StepState> }

export const emptyProgress = (season: string): MProgress => ({ season, steps: {} });
export const stepState = (prog: MProgress, id: string): StepState => prog.steps[id] || { pct: 0 };
export const stepPct = (prog: MProgress, id: string) => prog.steps[id]?.pct ?? 0;
export const isStepDone = (_p: MPhase, stepId: string, prog: MProgress) => stepPct(prog, stepId) >= 100;
export const phaseDone = (p: MPhase, prog: MProgress) => p.steps.filter((s) => stepPct(prog, s.id) >= 100).length;
export const phasePct = (p: MPhase, prog: MProgress) => (p.steps.length ? Math.round(p.steps.reduce((a, s) => a + stepPct(prog, s.id), 0) / p.steps.length) : 0);
export const phaseComplete = (p: MPhase, prog: MProgress) => p.steps.length > 0 && phaseDone(p, prog) === p.steps.length;
export function overallPct(phases: MPhase[], prog: MProgress) {
  const all = phases.flatMap((p) => p.steps);
  return all.length ? Math.round(all.reduce((a, s) => a + stepPct(prog, s.id), 0) / all.length) : 0;
}
export function currentPhaseIndex(phases: MPhase[], prog: MProgress) {
  const i = phases.findIndex((p) => !phaseComplete(p, prog));
  return i === -1 ? phases.length - 1 : i;
}
// Date helpers + a phase's overall date window (earliest start → latest end).
export const isoDate = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
export const dparse = (s?: string): Date | null => (s ? new Date(`${s}T00:00:00`) : null);
export const fmtShort = (s?: string) => { const d = dparse(s); return d ? d.toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "—"; };
export function phaseWindow(p: MPhase, prog: MProgress): { start: Date; end: Date } | null {
  const starts: number[] = [], ends: number[] = [];
  p.steps.forEach((s) => { const st = prog.steps[s.id]; const a = dparse(st?.start), b = dparse(st?.end); if (a) starts.push(a.getTime()); if (b) ends.push(b.getTime()); });
  if (!starts.length || !ends.length) return null;
  return { start: new Date(Math.min(...starts)), end: new Date(Math.max(...ends)) };
}
