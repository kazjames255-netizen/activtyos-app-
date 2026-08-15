// Staff appraisals & performance — model + pure helpers (front-end demo).
// Covers review cycles (probation / 3-month / 6-month / annual / supervision),
// role-based templates of rated competencies, a two-sided review (self +
// manager), SMART goals, an ongoing feedback/supervision log, PIPs, and a 9-box
// talent grid. Data-informed: the review surfaces lateness / absence / training
// / DBS pulled from the other areas. Real per-user store + e-sign + notifications
// are Amir's (docs/appraisals-handoff.md).

export type Rating = 1 | 2 | 3 | 4 | 5;
export const RATING_LABEL: Record<Rating, string> = { 1: "Needs support", 2: "Developing", 3: "Meets", 4: "Strong", 5: "Exceptional" };

export interface Competency { id: string; label: string; desc?: string }
export interface ReviewTemplate { id: string; name: string; role?: string; competencies: Competency[] }

export type ReviewKind = "probation" | "3-month" | "6-month" | "annual" | "supervision";
export const KIND_LABEL: Record<ReviewKind, string> = { probation: "Probation review", "3-month": "3-month review", "6-month": "6-month review", annual: "Annual appraisal", supervision: "Supervision 1:1" };
export type ReviewStatus = "scheduled" | "self" | "manager" | "signoff" | "complete";
export const STATUS_LABEL: Record<ReviewStatus, string> = { scheduled: "Scheduled", self: "Self-assessment", manager: "Manager review", signoff: "Awaiting sign-off", complete: "Complete" };

export interface CompScore { id: string; rating?: Rating; note?: string }
export interface Goal { id: string; title: string; detail?: string; due?: string; status: "open" | "progress" | "done" | "carried"; progress?: number; compId?: string }
export const GOAL_STATUS_LABEL: Record<Goal["status"], string> = { open: "Not started", progress: "In progress", done: "Achieved", carried: "Carried over" };
export type BoxDef = { label: string; tone: string; action: string };
export interface Review {
  id: string; staffId: string; name: string; role?: string; op?: string;
  appraiser?: string; // who conducts the review — sees & edits the manager form
  kind: ReviewKind; templateId?: string; due: string; status: ReviewStatus;
  self: { done: boolean; text?: string; ratings: CompScore[] };
  manager: { text?: string; ratings: CompScore[] };
  goals: Goal[];
  signoff: { managerAt?: string; staffAt?: string };
  probationOutcome?: "pass" | "extend" | "fail";
  createdAt: string;
}

export type FeedbackKind = "kudos" | "concern" | "supervision";
export const FB_META: Record<FeedbackKind, { label: string; icon: string; tone: string }> = {
  kudos: { label: "Kudos", icon: "🌟", tone: "#0f7a43" },
  concern: { label: "Concern", icon: "⚠️", tone: "#c0392b" },
  supervision: { label: "Supervision note", icon: "🗒️", tone: "#1d3a8f" },
};
export interface FeedbackNote { id: string; staffId: string; name: string; kind: FeedbackKind; text: string; at: string; by?: string }

export type PIPStatus = "open" | "met" | "extended" | "escalated" | "closed";
export const PIP_STATUS_LABEL: Record<PIPStatus, string> = { open: "Active", met: "Targets met", extended: "Extended", escalated: "Escalated", closed: "Closed" };
export const PIP_STATUS_TONE: Record<PIPStatus, string> = { open: "#f59e0b", met: "#0f7a43", extended: "#3f7ae0", escalated: "#c0392b", closed: "#64748b" };
export interface PIPTarget { id: string; text: string; measure?: string; met: boolean }
export interface PIPCheckIn { id: string; date: string; note: string }
export interface PIP {
  id: string; staffId: string; name: string; role?: string; op?: string;
  concern: string; support: string; consequence?: string; owner?: string; reviewId?: string;
  targets: PIPTarget[]; checkIns: PIPCheckIn[];
  start: string; end: string; status: PIPStatus;
  actions?: string; // legacy free-text, superseded by targets
}
export const pipProgress = (p: PIP) => { const t = p.targets || []; return t.length ? Math.round((t.filter((x) => x.met).length / t.length) * 100) : 0; };

// 9-box: performance (x) × potential (y), each low/medium/high (1..3)
export interface Talent { staffId: string; performance: 1 | 2 | 3; potential: 1 | 2 | 3 }
export const NINEBOX: Record<string, { label: string; tone: string; action: string }> = {
  "3-3": { label: "Star", tone: "#0f7a43", action: "Stretch & retain — succession candidate" }, "3-2": { label: "High performer", tone: "#12b76a", action: "Grow — give more scope" }, "3-1": { label: "Trusted pro", tone: "#3f7ae0", action: "Reward & keep doing what works" },
  "2-3": { label: "High potential", tone: "#12b76a", action: "Invest — coach toward a bigger role" }, "2-2": { label: "Core", tone: "#3f7ae0", action: "Develop steadily — the backbone" }, "2-1": { label: "Effective", tone: "#64748b", action: "Maintain — recognise reliability" },
  "1-3": { label: "Enigma / develop", tone: "#f59e0b", action: "Diagnose the block — new role or support?" }, "1-2": { label: "Inconsistent", tone: "#f59e0b", action: "Set clear expectations & follow up" }, "1-1": { label: "Under-performing", tone: "#c0392b", action: "Consider a PIP — act, don't ignore" },
};
export const nineBoxCell = (t: { performance: number; potential: number }) => NINEBOX[`${t.performance}-${t.potential}`];

// ── Helpers ─────────────────────────────────────────────────────────────────
export const isoDate = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
export const fmtDate = (iso?: string) => (iso ? new Date(`${iso}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—");
export const daysUntil = (iso: string) => Math.round((new Date(`${iso}T00:00:00`).getTime() - Date.now()) / 86400000);
export const isOverdue = (r: Review) => r.status !== "complete" && daysUntil(r.due) < 0;

// average manager rating across scored competencies (falls back to self)
export function overallScore(r: Review): number | null {
  const src = r.manager.ratings.some((c) => c.rating) ? r.manager.ratings : r.self.ratings;
  const vals = src.map((c) => c.rating).filter((n): n is Rating => !!n);
  return vals.length ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10 : null;
}

// Bradford factor from a list of sickness spells (S² × D) — a common absence flag
export function bradford(spells: number[]): number { const S = spells.length; const D = spells.reduce((a, b) => a + b, 0); return S * S * D; }
export const bradfordTone = (b: number) => (b >= 200 ? "#c0392b" : b >= 51 ? "#f59e0b" : "#0f7a43");
