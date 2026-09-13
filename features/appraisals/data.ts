"use client";

// Appraisals store + seed + actions, and the "data-informed" signals that
// pull a person's real lateness / sickness / DBS from the other areas so a review
// is evidence-based. Matched to people by name.
//
// On the server since 13 Sept (/api/appraisals — server/src/routes/appraisals.ts):
// the keys below are this device's cache of it. Reviews save one by one (only
// what changed); templates / feedback / PIPs / 9-box save as a whole per part.
// A member of staff's device only ever holds their own reviews. The seeded
// reviews, notes, PIP and 9-box are the demo's only.
import { DEMO_STAFF } from "@/features/learning/credentials";
import { get as apiGet, post as apiPost, put as apiPut, isDemoMode } from "@/lib/api";
import {
  type Review, type ReviewTemplate, type FeedbackNote, type PIP, type Talent, type Competency, type BoxDef,
  type ReviewKind, isoDate, bradford, NINEBOX,
} from "@/lib/appraisals";

export const slug = (name: string) => name.trim().toLowerCase().replace(/\s+/g, "-");
const RK = "aos.appraisals.reviews.v1", TK = "aos.appraisals.templates.v1", FK = "aos.appraisals.feedback.v1", PK = "aos.appraisals.pips.v1", LK = "aos.appraisals.talent.v1", BK = "aos.appraisals.boxes.v1";
const read = <T,>(k: string): T | null => { try { return JSON.parse(localStorage.getItem(k) || "null"); } catch { return null; } };
const write = (k: string, v: unknown) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* ignore */ } };
const uid = () => (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : "id" + Math.floor(performance.now() * 1000));

// ── Server sync ─────────────────────────────────────────────────────────────
/** Fired when the server copy lands (re-read the cache) or a save fails (detail.error). */
export const APPRAISALS_EVENT = "aos:appraisals";
const announce = (error?: string) => { if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(APPRAISALS_EVENT, { detail: error ? { error } : {} })); };
/** JSON with keys in a fixed order (Firestore hands fields back in its own). */
const stable = (v: unknown): string => {
  if (Array.isArray(v)) return `[${v.map(stable).join(",")}]`;
  if (v && typeof v === "object") return `{${Object.keys(v as object).filter((k) => (v as Record<string, unknown>)[k] !== undefined).sort().map((k) => `${JSON.stringify(k)}:${stable((v as Record<string, unknown>)[k])}`).join(",")}}`;
  return JSON.stringify(v ?? null);
};
let serverReviews: Map<string, string> | null = null; // id → the server's copy — what a save is diffed against
type ConfigPart = "templates" | "feedback" | "pips" | "talent" | "boxes";
const CONFIG_KEY: Record<ConfigPart, string> = { templates: TK, feedback: FK, pips: PK, talent: LK, boxes: BK };
const pendingConfig = new Map<ConfigPart, ReturnType<typeof setTimeout>>();
/** Pull this team's appraisals into the cache. False = couldn't reach the server. */
export async function syncAppraisals(): Promise<boolean> {
  if (isDemoMode()) return true;
  try {
    const r = await apiGet<{ reviews: Review[]; templates: ReviewTemplate[] | null; feedback?: FeedbackNote[] | null; pips?: PIP[] | null; talent?: Talent[] | null; boxes?: Record<string, BoxDef> | null }>("/api/appraisals");
    serverReviews = new Map((r.reviews ?? []).map((x) => [x.id, stable(x)]));
    write(RK, r.reviews ?? []);
    // A part still waiting to save keeps this device's newer copy.
    const put = (part: ConfigPart, v: unknown) => { if (pendingConfig.has(part)) return; if (v == null) { try { localStorage.removeItem(CONFIG_KEY[part]); } catch { /* ignore */ } } else write(CONFIG_KEY[part], v); };
    put("templates", r.templates);
    // Staff get none of these — and a shared device drops any it was holding.
    put("feedback", r.feedback ?? []); put("pips", r.pips ?? []); put("talent", r.talent ?? []); put("boxes", r.boxes ?? null);
    announce();
    return true;
  } catch { return false; }
}
function saveConfig(part: ConfigPart, v: unknown) {
  if (isDemoMode()) return;
  const t = pendingConfig.get(part); if (t) clearTimeout(t);
  // Templates and the 9-box categories save as you type — once you pause.
  pendingConfig.set(part, setTimeout(() => {
    pendingConfig.delete(part);
    apiPut("/api/appraisals/config", { [part]: v }).catch((e) => announce(e instanceof Error ? e.message : "Couldn't save that change"));
  }, 600));
}
/** Staff: send my self-assessment (only that part of the review changes). */
export async function submitSelfAssessment(r: Review): Promise<void> {
  await apiPost(`/api/appraisals/reviews/${encodeURIComponent(r.id)}/self`, { text: r.self.text, ratings: r.self.ratings });
  await syncAppraisals();
}

// ── Templates ───────────────────────────────────────────────────────────────
const COACH_COMPS: Competency[] = [
  { id: "coach", label: "Coaching & activity delivery", desc: "Sessions are engaging, safe and well-run" },
  { id: "safeguard", label: "Safeguarding & child protection", desc: "Vigilant, follows policy, reports concerns" },
  { id: "reliability", label: "Reliability & punctuality", desc: "On time, dependable, good attendance" },
  { id: "teamwork", label: "Teamwork", desc: "Supports colleagues, positive team member" },
  { id: "parents", label: "Communication with parents", desc: "Clear, warm, professional" },
  { id: "planning", label: "Session planning & organisation", desc: "Prepared, resourced, adaptable" },
];
const LEAD_COMPS: Competency[] = [...COACH_COMPS, { id: "leadership", label: "Leadership & staff support", desc: "Guides the team, runs the site well" }];
export function seedTemplates(): ReviewTemplate[] {
  return [
    { id: "tpl-coach", name: "Coach appraisal", role: "Coach", competencies: COACH_COMPS },
    { id: "tpl-lead", name: "Lead / manager appraisal", role: "Lead", competencies: LEAD_COMPS },
  ];
}
export const loadTemplates = (): ReviewTemplate[] => { const s = read<ReviewTemplate[]>(TK); return Array.isArray(s) && s.length ? s : seedTemplates(); };
export const saveTemplates = (t: ReviewTemplate[]) => { write(TK, t); saveConfig("templates", t); };
export const templateFor = (role?: string) => loadTemplates().find((t) => t.role && role && t.role.toLowerCase() === role.toLowerCase()) || loadTemplates()[0];

// ── Reviews ─────────────────────────────────────────────────────────────────
function blankRatings(role?: string) { return templateFor(role).competencies.map((c) => ({ id: c.id })); }
export function seedReviews(): Review[] {
  const now = new Date(); const d = (off: number) => { const x = new Date(now); x.setDate(x.getDate() + off); return isoDate(x); };
  const S = DEMO_STAFF; const by = (n: string) => S.find((x) => x.name === n)!;
  const mk = (name: string, kind: ReviewKind, due: string, status: Review["status"], appraiser: string, extra: Partial<Review> = {}): Review => {
    const s = by(name); const tpl = templateFor(s.role);
    return { id: uid(), staffId: slug(name), name, role: s.role, op: s.op, appraiser, kind, templateId: tpl.id, due, status, self: { done: false, ratings: blankRatings(s.role) }, manager: { ratings: blankRatings(s.role) }, goals: [], signoff: {}, createdAt: now.toISOString(), ...extra };
  };
  return [
    mk("Marcus Bell", "annual", d(9), "manager", "You", { self: { done: true, text: "Strong year — happy to take on more lead responsibility.", ratings: COACH_COMPS.map((c, i) => ({ id: c.id, rating: (i % 2 ? 4 : 5) as 4 | 5 })) }, manager: { text: "Excellent lead. Grow the mentoring side.", ratings: LEAD_COMPS.map((c) => ({ id: c.id, rating: 4 })) }, goals: [{ id: uid(), title: "Mentor two new coaches this season", status: "progress", progress: 40, due: d(90) }, { id: uid(), title: "Complete Designated Safeguarding Lead training", status: "open", due: d(60) }] }),
    mk("Jess Patel", "probation", d(-2), "self", "Marcus Bell", { self: { done: false, ratings: blankRatings("Coach") } }),
    mk("Aisha Rahman", "6-month", d(21), "scheduled", "You"),
    mk("Tom Lewis", "annual", d(-20), "complete", "Aisha Rahman", { manager: { text: "Solid, reliable coach.", ratings: COACH_COMPS.map((c) => ({ id: c.id, rating: 4 })) }, self: { done: true, ratings: COACH_COMPS.map((c) => ({ id: c.id, rating: 4 })) }, signoff: { managerAt: d(-20), staffAt: d(-19) } }),
    mk("Priya Khan", "probation", d(5), "scheduled", "You"),
  ];
}
export const loadReviews = (): Review[] => { const s = read<Review[]>(RK); return Array.isArray(s) ? s : isDemoMode() ? seedReviews() : []; };
/** Save the list: the cache now, and each new or changed review to the server. */
export const saveReviews = (r: Review[]) => {
  write(RK, r);
  if (isDemoMode()) return;
  // Never diff against nothing — every cached review would read as new.
  if (!serverReviews) { announce("Couldn't reach the server — that change isn't saved"); return; }
  const changed = r.filter((x) => serverReviews!.get(x.id) !== stable(x));
  if (!changed.length) return;
  void Promise.allSettled(changed.map((x) => apiPut(`/api/appraisals/reviews/${encodeURIComponent(x.id)}`, x))).then((res) => {
    const bad = res.find((x) => x.status === "rejected") as PromiseRejectedResult | undefined;
    if (bad) announce(bad.reason instanceof Error ? bad.reason.message : "Couldn't save that change");
    // Finish on the server's version — a refused change rolls back on screen.
    return syncAppraisals();
  });
};

// ── Feedback log ────────────────────────────────────────────────────────────
export function seedFeedback(): FeedbackNote[] {
  const now = Date.now(); const ago = (days: number) => new Date(now - days * 86400000).toISOString();
  return [
    { id: uid(), staffId: slug("Marcus Bell"), name: "Marcus Bell", kind: "kudos", text: "Handled a tricky parent complaint calmly and fairly. Great example to the team.", at: ago(4), by: "You" },
    { id: uid(), staffId: slug("Tom Lewis"), name: "Tom Lewis", kind: "supervision", text: "Monthly 1:1 — settling in well, wants more football sessions.", at: ago(12), by: "You" },
    { id: uid(), staffId: slug("Priya Khan"), name: "Priya Khan", kind: "concern", text: "Second late arrival this month — flagged for the review.", at: ago(6), by: "You" },
  ];
}
export const loadFeedback = (): FeedbackNote[] => { const s = read<FeedbackNote[]>(FK); return Array.isArray(s) ? s : isDemoMode() ? seedFeedback() : []; };
export const saveFeedback = (f: FeedbackNote[]) => { write(FK, f); saveConfig("feedback", f); };

// ── PIPs ────────────────────────────────────────────────────────────────────
export function seedPIPs(): PIP[] {
  const now = new Date(); const d = (off: number) => { const x = new Date(now); x.setDate(x.getDate() + off); return isoDate(x); };
  const s = DEMO_STAFF.find((x) => x.name === "Priya Khan");
  return [{
    id: uid(), staffId: slug("Priya Khan"), name: "Priya Khan", role: s?.role, op: s?.op,
    concern: "Repeated lateness and an overdue safeguarding refresher are affecting the team and cover.",
    support: "Weekly 1:1 with the site lead; paid time allocated for training; buddy on shift.",
    consequence: "If targets aren't met by the review date, the plan may be extended once or escalated to a formal capability process.",
    owner: "Site lead",
    targets: [
      { id: uid(), text: "Arrive at least 10 minutes before every shift", measure: "Clock-in record shows no late marks", met: false },
      { id: uid(), text: "Complete Safeguarding Level 2 refresher", measure: "Certificate uploaded to Documents", met: true },
      { id: uid(), text: "No unexplained absences", measure: "All absence pre-agreed or self-certified", met: false },
    ],
    checkIns: [{ id: uid(), date: d(-3), note: "First check-in — safeguarding booked; two on-time shifts this week. Encouraged." }],
    start: d(-7), end: d(23), status: "open",
  }];
}
const normalisePIP = (p: PIP): PIP => ({ ...p, targets: Array.isArray(p.targets) ? p.targets : [], checkIns: Array.isArray(p.checkIns) ? p.checkIns : [] });
export const loadPIPs = (): PIP[] => { const s = read<PIP[]>(PK); return (Array.isArray(s) ? s : isDemoMode() ? seedPIPs() : []).map(normalisePIP); };
export const savePIPs = (p: PIP[]) => { write(PK, p); saveConfig("pips", p); };

// ── Talent (9-box) ──────────────────────────────────────────────────────────
export function seedTalent(): Talent[] {
  const map: Record<string, [1 | 2 | 3, 1 | 2 | 3]> = { "Marcus Bell": [3, 3], "Jess Patel": [2, 3], "Aisha Rahman": [3, 2], "Tom Lewis": [2, 2], "Priya Khan": [1, 2], "Dan Reed": [3, 1] };
  return DEMO_STAFF.map((s) => ({ staffId: slug(s.name), performance: (map[s.name]?.[0] ?? 2), potential: (map[s.name]?.[1] ?? 2) }));
}
export const loadTalent = (): Talent[] => { const s = read<Talent[]>(LK); return Array.isArray(s) && s.length ? s : isDemoMode() ? seedTalent() : []; };
export const saveTalent = (t: Talent[]) => { write(LK, t); saveConfig("talent", t); };

// ── 9-box categories (editable) ─────────────────────────────────────────────
export const loadBoxes = (): Record<string, BoxDef> => { const s = read<Record<string, BoxDef>>(BK); return s && Object.keys(s).length === 9 ? s : { ...NINEBOX }; };
export const saveBoxes = (b: Record<string, BoxDef>) => { write(BK, b); saveConfig("boxes", b); };
export const resetBoxes = () => saveBoxes({ ...NINEBOX });
export const BOX_TONES = ["#0f7a43", "#12b76a", "#3f7ae0", "#64748b", "#f59e0b", "#c0392b"];

// ── Data-informed signals (pulled from the other areas) ─────────────────────
export interface Signals { late: number; sicknessDays: number; sicknessSpells: number; bradford: number; dbs: string; pfa: string }
export function signalsFor(name: string): Signals {
  const nm = name.trim().toLowerCase(); const out: Signals = { late: 0, sicknessDays: 0, sicknessSpells: 0, bradford: 0, dbs: "—", pfa: "—" };
  // lateness — from the clock store
  try { const clk = read<Record<string, { name?: string; lateMin?: number }>>("aos.timeclock.v1") || {}; const r = Object.values(clk).find((x) => (x.name || "").trim().toLowerCase() === nm); if (r?.lateMin) out.late = 1; } catch { /* ignore */ }
  // sickness — from the holiday absences store (this leave year)
  try {
    const abs = read<{ name: string; kind: string; status: string; days: number }[]>("aos.holiday.absences.v1") || [];
    const mine = abs.filter((a) => a && (a.name || "").trim().toLowerCase() === nm && a.kind === "sickness" && a.status !== "declined" && a.status !== "cancelled");
    out.sicknessSpells = mine.length; out.sicknessDays = mine.reduce((a, b) => a + (b.days || 0), 0);
    out.bradford = bradford(mine.map((m) => m.days || 1));
  } catch { /* ignore */ }
  // DBS / first aid — from the shared roster (the demo cast's, in the demo only)
  const s = isDemoMode() ? DEMO_STAFF.find((x) => x.name.trim().toLowerCase() === nm) : undefined; if (s) { out.dbs = s.dbs; out.pfa = s.pfa; }
  return out;
}
