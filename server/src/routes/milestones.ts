import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { db } from "../firebase";
import type { Role } from "../middleware/role";
import { defaultPhases } from "../lib/milestonePlan";
import { type MPhase, type MProgress, type MStep, type MAction, overallPct, phasePct, stepPctEff } from "../../../lib/milestones";

// ─────────────────────────────────────────────────────────────────────────
// Milestones — the operational roadmap head office writes and every franchise
// works through (features/milestones/MilestonesApp.tsx, two modes).
//
// Until now both halves lived in the BROWSER: `aos.milestones.template.v1` and
// `aos.milestones.progress.v1` in localStorage (features/milestones/data.ts).
// So head office's plan and a franchise's progress were never in the same place
// as each other — a franchisor could not see how a single franchise was doing
// (the HO screen showed `seedProgress()`, invented numbers), a franchise lost
// everything on a new device or a cleared browser, and because each browser
// seeded its own `crypto.randomUUID()` step ids, the two sides couldn't have
// been reconciled even by hand. (Acceptance p2-f13.)
//
// Two documents, mirroring the libraries convention (lib/tenantLibrary.ts):
//   milestones/{tenantId}                          — the head-office template
//   milestoneProgress/{tenantId}                   — head office's / a solo
//                                                    operator's own progress
//   milestoneProgress/{tenantId}__fr__{franchiseId} — one franchise's progress
//
// Scope:
//   company    — writes the template; reads EVERY franchise's progress
//                (?franchiseId=, plus the /franchises roll-up); writes its own.
//   freelancer — solo tenant: template + its own progress, no franchises.
//   franchise  — reads the template (never writes it), reads and writes ONLY
//                its own progress. A foreign ?franchiseId= is refused, not
//                silently widened.
//   staff / parent / platform — refused outright. Milestones is an owner's
//                screen (nav: company `ho-framework`, franchise `milestones`);
//                a coach's token used to be able to read anything the screens
//                merely hid, so this one is closed rather than read-only.
// ─────────────────────────────────────────────────────────────────────────

export const milestones = Router();

const TEMPLATES = db.collection("milestones");
const PROGRESS = db.collection("milestoneProgress");

/** Who owns the template: the tenant's owner account. */
const ownsTemplate = (role: Role) => role === "company" || role === "freelancer";
/** Who has a roadmap at all. */
const worksRoadmap = (role: Role) => ownsTemplate(role) || role === "franchise";

/** One franchise's progress doc, or the tenant's own (head office / solo). */
const progressId = (tenantId: string, franchiseId: string | null) =>
  franchiseId ? `${tenantId}__fr__${franchiseId}` : tenantId;

type Auth = { role: Role; tenantId: string; franchiseId: string | null };

/** Refuse anyone who has no roadmap before a single read happens. */
function scope(req: Request, res: Response): Auth | null {
  const auth = req.auth!;
  if (!worksRoadmap(auth.role) || !auth.tenantId) {
    res.status(403).json({ error: "Milestones are for a head office, a franchise or a solo operator" });
    return null;
  }
  if (auth.role === "franchise" && !auth.franchiseId) {
    res.status(403).json({ error: "Your account has no franchise — ask head office to re-send your invite" });
    return null;
  }
  return { role: auth.role, tenantId: auth.tenantId, franchiseId: auth.franchiseId };
}

/** Which franchise's progress this request is about.
 *  Head office may name one (`?franchiseId=`); `__ho__` / absent = its own.
 *  A franchise may only ever name itself. Returns `false` when refused. */
function targetFranchise(auth: Auth, q: unknown): string | null | false {
  const asked = typeof q === "string" ? q.trim() : "";
  if (auth.role === "franchise") {
    if (asked && asked !== auth.franchiseId) return false;
    return auth.franchiseId;
  }
  if (!asked || asked === "__ho__") return null;
  return asked;
}

// ── the template ─────────────────────────────────────────────────────────
const linkSchema = z.object({ label: z.string().trim().max(80), href: z.string().trim().max(400) });
const actionSchema = z.object({ id: z.string().trim().min(1).max(80), title: z.string().trim().max(240) });
const stepSchema = z.object({
  id: z.string().trim().min(1).max(80),
  title: z.string().trim().max(240),
  detail: z.string().trim().max(2_000).optional(),
  links: z.array(linkSchema).max(12).optional(),
  actions: z.array(actionSchema).max(60).optional(),
});
const phaseSchema = z.object({
  id: z.string().trim().min(1).max(80),
  title: z.string().trim().max(160),
  subtitle: z.string().trim().max(400).optional(),
  when: z.enum(["setup", "before", "during", "after", "clubs"]),
  recurring: z.boolean(),
  icon: z.string().max(16).optional(),
  steps: z.array(stepSchema).max(80),
});
const templateSchema = z.object({ phases: z.array(phaseSchema).max(40) });

type TemplateDoc = { tenantId: string; phases: MPhase[]; version: number; updatedAt: string | null; updatedBy: string | null };

/** The tenant's template, seeded from the default plan on first read.
 *  Seeded server-side ON PURPOSE: the front end used to fall back to its own
 *  `seedTemplate()` with random ids per browser, so head office and a franchise
 *  each invented a different plan and no progress could ever line up. */
async function loadTemplate(tenantId: string): Promise<TemplateDoc> {
  const ref = TEMPLATES.doc(tenantId);
  const snap = await ref.get();
  if (snap.exists) {
    const d = snap.data() as Partial<TemplateDoc>;
    return {
      tenantId,
      phases: (d.phases as MPhase[] | undefined) ?? [],
      version: typeof d.version === "number" ? d.version : 1,
      updatedAt: (d.updatedAt as string | undefined) ?? null,
      updatedBy: (d.updatedBy as string | undefined) ?? null,
    };
  }
  const doc: TemplateDoc = { tenantId, phases: defaultPhases(), version: 1, updatedAt: null, updatedBy: null };
  await ref.set({ ...doc, seededAt: new Date().toISOString() });
  return doc;
}

// ── progress ─────────────────────────────────────────────────────────────
const actStateSchema = z.object({
  done: z.boolean().optional(),
  status: z.enum(["todo", "prog", "done"]).optional(),
  priority: z.enum(["low", "med", "high", "urgent"]).optional(),
  note: z.string().trim().max(2_000).optional(),
  assignee: z.string().trim().max(160).optional(),
  due: z.string().trim().max(24).optional(),
  taskId: z.string().trim().max(120).optional(),
});
const stepStateSchema = z.object({
  start: z.string().trim().max(24).optional(),
  end: z.string().trim().max(24).optional(),
  pct: z.number().min(0).max(100),
  actions: z.record(actStateSchema).optional(),
});
const progressSchema = z.object({
  season: z.string().trim().max(120).optional(),
  steps: z.record(stepStateSchema),
  // A franchise's OWN extra checklist items under a head-office task. They go
  // here rather than into the template, which is head office's alone to edit.
  extras: z.record(z.array(actionSchema).max(60)).optional(),
});

type Snapshot = { season: string; overall: number; at: string };
type ProgressDoc = MProgress & {
  tenantId: string;
  franchiseId: string | null;
  extras: Record<string, MAction[]>;
  history: Snapshot[];
  updatedAt: string | null;
  updatedBy: string | null;
};

const emptyProgressDoc = (tenantId: string, franchiseId: string | null): ProgressDoc => ({
  tenantId, franchiseId, season: "This season", steps: {}, extras: {}, history: [], updatedAt: null, updatedBy: null,
});

async function loadProgress(tenantId: string, franchiseId: string | null): Promise<ProgressDoc> {
  const snap = await PROGRESS.doc(progressId(tenantId, franchiseId)).get();
  if (!snap.exists) return emptyProgressDoc(tenantId, franchiseId);
  const d = snap.data() as Partial<ProgressDoc>;
  return {
    tenantId,
    franchiseId,
    season: d.season || "This season",
    steps: (d.steps as MProgress["steps"] | undefined) ?? {},
    extras: (d.extras as Record<string, MAction[]> | undefined) ?? {},
    history: (d.history as Snapshot[] | undefined) ?? [],
    updatedAt: (d.updatedAt as string | undefined) ?? null,
    updatedBy: (d.updatedBy as string | undefined) ?? null,
  };
}

/** The phases as this franchise sees them: head office's steps plus the extra
 *  actions the franchise added itself. Roll-ups score against THIS, so a
 *  franchise's own checklist counts towards its completion. */
function phasesFor(phases: MPhase[], extras: Record<string, MAction[]>): MPhase[] {
  if (!Object.keys(extras).length) return phases;
  return phases.map((p) => ({
    ...p,
    steps: p.steps.map((s): MStep => (extras[s.id]?.length ? { ...s, actions: [...(s.actions ?? []), ...extras[s.id]] } : s)),
  }));
}

/** Where a franchise has got to — the numbers head office actually wants. */
function rollup(phases: MPhase[], prog: ProgressDoc) {
  const seen = phasesFor(phases, prog.extras);
  const byPhase = seen.map((p) => ({ id: p.id, title: p.title, when: p.when, recurring: p.recurring, pct: phasePct(p, prog), steps: p.steps.length, done: p.steps.filter((s) => stepPctEff(s, prog) >= 100).length }));
  const steps = seen.flatMap((p) => p.steps);
  return {
    overall: overallPct(seen, prog),
    stepsTotal: steps.length,
    stepsDone: steps.filter((s) => stepPctEff(s, prog) >= 100).length,
    phases: byPhase,
    // The phase they're on — the first that isn't finished.
    currentPhase: byPhase.find((p) => p.done < p.steps)?.title ?? byPhase[byPhase.length - 1]?.title ?? null,
  };
}

/** The franchise ids in this tenant, with their display names (same derivation
 *  as routes/franchises.ts — a franchise is a role on a user, not a document). */
async function franchiseList(tenantId: string): Promise<{ franchiseId: string; name: string }[]> {
  const snap = await db.collection("users").where("tenantId", "==", tenantId).where("role", "==", "franchise").get();
  const by = new Map<string, string>();
  for (const d of snap.docs) {
    const u = d.data();
    const fid = (u.franchiseId as string) || d.id;
    if (!by.has(fid)) by.set(fid, (u.franchiseName as string) || (u.name as string) || "Franchise");
  }
  return [...by.entries()].map(([franchiseId, name]) => ({ franchiseId, name }));
}

// GET /api/milestones — the template + one roadmap's progress, in one call.
// `?franchiseId=<id>` lets head office drill into a franchise (its own with
// `__ho__` or nothing). A franchise always gets its own, whatever it asks for.
milestones.get("/", async (req, res) => {
  const auth = scope(req, res);
  if (!auth) return;
  const target = targetFranchise(auth, req.query.franchiseId);
  if (target === false) { res.status(403).json({ error: "That's another franchise's progress" }); return; }
  if (target && auth.role !== "franchise") {
    const known = await franchiseList(auth.tenantId);
    if (!known.some((f) => f.franchiseId === target)) { res.status(404).json({ error: "No such franchise in this network" }); return; }
  }
  const [template, progress] = await Promise.all([loadTemplate(auth.tenantId), loadProgress(auth.tenantId, target)]);
  res.json({
    template,
    progress,
    canEditTemplate: ownsTemplate(auth.role),
    // Head office's own progress is read/write; a franchise's is its own.
    canEditProgress: target === null || auth.role === "franchise",
    rollup: rollup(template.phases, progress),
  });
});

// PUT /api/milestones/template — head office (or a solo operator) rewrites the
// plan every franchise follows. A franchise is refused: its edits used to land
// in its own localStorage and look like they had been published.
milestones.put("/template", async (req, res) => {
  const auth = scope(req, res);
  if (!auth) return;
  if (!ownsTemplate(auth.role)) { res.status(403).json({ error: "Only head office can change the milestones template" }); return; }
  const parsed = templateSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues }); return; }
  const ids = parsed.data.phases.flatMap((p) => p.steps.map((s) => s.id));
  if (new Set(ids).size !== ids.length) { res.status(400).json({ error: "Two tasks share an id — progress is keyed by task id, so they must be unique" }); return; }
  const prev = await loadTemplate(auth.tenantId);
  const doc: TemplateDoc = {
    tenantId: auth.tenantId,
    phases: parsed.data.phases as MPhase[],
    version: prev.version + 1,
    updatedAt: new Date().toISOString(),
    updatedBy: req.user?.email ?? req.user?.uid ?? null,
  };
  await TEMPLATES.doc(auth.tenantId).set(doc);
  res.json(doc);
});

// PUT /api/milestones/progress — save MY progress. Head office and a solo
// operator save their own; a franchise saves its own. Nobody saves anyone
// else's: a franchise's progress is the franchise's record.
milestones.put("/progress", async (req, res) => {
  const auth = scope(req, res);
  if (!auth) return;
  const target = targetFranchise(auth, req.query.franchiseId);
  if (target === false) { res.status(403).json({ error: "That's another franchise's progress" }); return; }
  if (target !== null && auth.role !== "franchise") { res.status(403).json({ error: "A franchise's progress is its own — head office can read it, not write it" }); return; }
  const parsed = progressSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues }); return; }
  const cur = await loadProgress(auth.tenantId, target);
  const doc: ProgressDoc = {
    ...cur,
    season: parsed.data.season ?? cur.season,
    steps: parsed.data.steps as MProgress["steps"],
    extras: (parsed.data.extras as Record<string, MAction[]> | undefined) ?? cur.extras,
    updatedAt: new Date().toISOString(),
    updatedBy: req.user?.email ?? req.user?.uid ?? null,
  };
  await PROGRESS.doc(progressId(auth.tenantId, target)).set(doc);
  res.json(doc);
});

// POST /api/milestones/season — "Start a new season". The reset is a RULE, so
// it happens here rather than in the browser: snapshot where the old season
// finished, then clear the recurring phases only (a one-time launch phase is
// done once and stays done — acceptance p2-l11). Dates are kept: they're the
// franchise's plan, not its progress.
milestones.post("/season", async (req, res) => {
  const auth = scope(req, res);
  if (!auth) return;
  const target = targetFranchise(auth, req.query.franchiseId);
  if (target === false) { res.status(403).json({ error: "That's another franchise's progress" }); return; }
  if (target !== null && auth.role !== "franchise") { res.status(403).json({ error: "A franchise starts its own season" }); return; }
  const parsed = z.object({ season: z.string().trim().min(1).max(120) }).safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues }); return; }
  const [template, cur] = await Promise.all([loadTemplate(auth.tenantId), loadProgress(auth.tenantId, target)]);
  const recurring = new Set(template.phases.filter((p) => p.recurring).flatMap((p) => p.steps.map((s) => s.id)));
  const steps = Object.fromEntries(Object.entries(cur.steps).map(([id, st]) => {
    if (!recurring.has(id)) return [id, st];
    const actions = st.actions
      ? Object.fromEntries(Object.entries(st.actions).map(([aid, a]) => [aid, { assignee: a.assignee, due: a.due, priority: a.priority, status: "todo" as const }]))
      : undefined;
    return [id, { ...st, pct: 0, ...(actions ? { actions } : {}) }];
  }));
  const snapshot: Snapshot = { season: cur.season, overall: rollup(template.phases, cur).overall, at: new Date().toISOString().slice(0, 10) };
  const doc: ProgressDoc = {
    ...cur,
    season: parsed.data.season,
    steps,
    history: [snapshot, ...cur.history].slice(0, 12),
    updatedAt: new Date().toISOString(),
    updatedBy: req.user?.email ?? req.user?.uid ?? null,
  };
  await PROGRESS.doc(progressId(auth.tenantId, target)).set(doc);
  res.json(doc);
});

// GET /api/milestones/franchises — how the whole network is doing: one row per
// franchise, plus head office's own. Company only (a solo operator has no
// network; a franchise has no business seeing its siblings). This is the view
// the franchisor never had — the HO screen showed invented sample progress.
milestones.get("/franchises", async (req, res) => {
  const auth = scope(req, res);
  if (!auth) return;
  if (auth.role !== "company") { res.status(403).json({ error: "Head office only" }); return; }
  const [template, list] = await Promise.all([loadTemplate(auth.tenantId), franchiseList(auth.tenantId)]);
  const rows = await Promise.all([null, ...list.map((f) => f.franchiseId)].map(async (fid) => {
    const prog = await loadProgress(auth.tenantId, fid);
    return {
      franchiseId: fid,
      name: fid ? (list.find((f) => f.franchiseId === fid)?.name ?? "Franchise") : "Head office (own)",
      season: prog.season,
      started: !!prog.updatedAt,
      updatedAt: prog.updatedAt,
      ...rollup(template.phases, prog),
    };
  }));
  res.json({ version: template.version, franchises: rows });
});
