// Milestones — a phased operational timeline for franchises. Head office owns a
// master template (phases → steps, each deep-linking into the app); every
// franchise sees it as their live timeline with progress. The recurring phases
// (plan / run / wrap a season) reset each season; one-time phases (launch setup,
// starting clubs) persist. Front-end demo model; backend owed.

export interface MStepLink { label: string; href: string }
// A task's checklist item — HO defines the title; a franchise fills in who/when,
// ticks it off, and can optionally push it into the Task Manager.
export interface MAction { id: string; title: string }
export interface MStep { id: string; title: string; detail?: string; links?: MStepLink[]; actions?: MAction[] }

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
// Per-action state a franchise fills in — Task-Manager style: status, note,
// who, when, and whether it's been pushed into the Task Manager.
// Tasks (inside a main action) mirror the Task Manager: To do / In progress / Done.
export type ActStatus = "todo" | "prog" | "done";
export const ACT_STATUS: Record<ActStatus, { label: string; tone: string }> = { todo: { label: "To do", tone: "#3b82f6" }, prog: { label: "In progress", tone: "#f59e0b" }, done: { label: "Done", tone: "#16b364" } };
const ACT_WEIGHT: Record<ActStatus, number> = { todo: 0, prog: 0.5, done: 1 };
export type ActPrio = "low" | "med" | "high" | "urgent";
export const ACT_PRIO: Record<ActPrio, { label: string; tone: string }> = { urgent: { label: "Urgent", tone: "#ef4444" }, high: { label: "High", tone: "#f59e0b" }, med: { label: "Medium", tone: "#3b82f6" }, low: { label: "Low", tone: "#8a93a6" } };
export interface ActState { done?: boolean; status?: ActStatus; priority?: ActPrio; note?: string; assignee?: string; due?: string; taskId?: string }
export interface StepState { start?: string; end?: string; pct: number; actions?: Record<string, ActState> }
export interface MProgress { season: string; steps: Record<string, StepState> }

export const emptyProgress = (season: string): MProgress => ({ season, steps: {} });
export const stepState = (prog: MProgress, id: string): StepState => prog.steps[id] || { pct: 0 };
export const actState = (prog: MProgress, stepId: string, actId: string): ActState => prog.steps[stepId]?.actions?.[actId] || {};
export const actStatus = (x?: ActState): ActStatus => x?.status || (x?.done ? "done" : "todo");
export const stepPct = (prog: MProgress, id: string) => prog.steps[id]?.pct ?? 0;
export const actionsDone = (step: MStep, prog: MProgress) => (step.actions || []).filter((a) => actStatus(prog.steps[step.id]?.actions?.[a.id]) === "done").length;
// A task's effective completion: weighted (met = 1, in-progress = ½) across its
// actions if it has any, else its own %.
export const stepPctEff = (step: MStep, prog: MProgress) => {
  const acts = step.actions || [];
  if (!acts.length) return prog.steps[step.id]?.pct ?? 0;
  const sum = acts.reduce((t, a) => t + ACT_WEIGHT[actStatus(prog.steps[step.id]?.actions?.[a.id])], 0);
  return Math.round((sum / acts.length) * 100);
};
export const isStepDone = (_p: MPhase, stepId: string, prog: MProgress) => stepPct(prog, stepId) >= 100;
export const phaseDone = (p: MPhase, prog: MProgress) => p.steps.filter((s) => stepPctEff(s, prog) >= 100).length;
export const phasePct = (p: MPhase, prog: MProgress) => (p.steps.length ? Math.round(p.steps.reduce((a, s) => a + stepPctEff(s, prog), 0) / p.steps.length) : 0);
export const phaseComplete = (p: MPhase, prog: MProgress) => p.steps.length > 0 && phaseDone(p, prog) === p.steps.length;
export function overallPct(phases: MPhase[], prog: MProgress) {
  const all = phases.flatMap((p) => p.steps);
  return all.length ? Math.round(all.reduce((a, s) => a + stepPctEff(s, prog), 0) / all.length) : 0;
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
