import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { db } from "../firebase";
import type { Role } from "../middleware/role";

// Payroll (the operator Payroll screen's store), on the server.
//
// The employee list was the demo cast (Marcus Bell & co.) kept in one
// browser's localStorage, pay runs too — a real member of staff who clocked
// hours could never be paid, and a second manager saw nothing. Now:
//   · employee PAY DETAILS (rate, hours, tax code, NI, pension) live in
//     `payrollConfig/{key}` alongside the per-period run adjustments; the
//     people themselves come from the real team on the screen;
//   · every approved pay run is its own doc in `payrollRuns` — never
//     overwritten (a payroll record is history), only published/unpublished;
//   · the timesheets a run is paid from are read here across a date range
//     (clockRecords is keyed per day; /api/timeclock only serves one day);
//   · staff read their OWN lines of PUBLISHED runs (GET /mine).
// Figures are estimates — the RTI/HMRC submission is the payroll provider's.
// Key: the tenant, or tenant__fr__franchise for a franchise (its own payroll).

export const payroll = Router();

const canManage = (role: Role) => role === "company" || role === "freelancer" || role === "franchise";
const keyOf = (tenantId: string, franchiseId: string | null) => (franchiseId ? `${tenantId}__fr__${franchiseId}` : tenantId);
const slug = (name: string) => name.trim().toLowerCase().replace(/\s+/g, "-");
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const cfg = (key: string) => db.collection("payrollConfig").doc(key.replace(/\//g, "_"));
const runs = db.collection("payrollRuns");

const empSchema = z.object({
  id: z.string().trim().min(1).max(120),
  name: z.string().trim().min(1).max(120),
  role: z.string().max(120).optional().default(""),
  op: z.string().max(160).optional().default(""),
  basis: z.enum(["hour", "year"]),
  rate: z.number().min(0).max(1_000_000),
  hpw: z.number().min(0).max(100),
  weeks: z.number().min(1).max(53),
  taxCode: z.string().trim().max(12),
  niCat: z.string().trim().max(2),
  pension: z.boolean(),
  paidFrom: z.enum(["contracted", "rota", "timesheet"]).optional(),
  source: z.enum(["team", "manual"]).optional(),
});
const itemSchema = z.object({ id: z.string().max(80), label: z.string().max(120), amount: z.number().min(-1_000_000).max(1_000_000) });
const adjustSchema = z.object({
  hours: z.number().min(0).max(1_000).nullable().optional(),
  taxCode: z.string().max(12).optional(),
  niCat: z.string().max(2).optional(),
  additions: z.array(itemSchema).max(50).optional(),
  deductions: z.array(itemSchema).max(50).optional(),
  override: z.object({ paye: z.number().nullable().optional(), eeNi: z.number().nullable().optional(), eePen: z.number().nullable().optional() }).optional(),
});

function manager(req: Request, res: Response): string | null {
  const auth = req.auth!;
  if (!auth.tenantId || !canManage(auth.role)) { res.status(403).json({ error: "Only a manager or owner can see payroll" }); return null; }
  return keyOf(auth.tenantId, auth.franchiseId);
}
const stripRun = (d: FirebaseFirestore.DocumentData) => { const { payKey: _k, tenantId: _t, franchiseId: _f, ...r } = d; return r; };

// GET /api/payroll — { employees, adjust, runs, settings } (managers).
payroll.get("/", async (req, res) => {
  const key = manager(req, res); if (!key) return;
  const [c, r] = await Promise.all([cfg(key).get(), runs.where("payKey", "==", key).get()]);
  const list = r.docs.map((d) => stripRun(d.data())).sort((a, b) => String(b.createdAt ?? "").localeCompare(String(a.createdAt ?? "")));
  res.json({ employees: c.get("employees") ?? null, adjust: c.get("adjust") ?? {}, runs: list, settings: { sickPay: c.get("settings.sickPay") === "ssp" ? "ssp" : "full" } });
});

// PUT /api/payroll/settings {sickPay} — the company's payroll rules. Sick pay:
// "full" = full contracted pay (default); "ssp" = SSP only — sick days are
// deducted like unpaid leave and SSP is added by the payroll provider (we
// don't calculate it). Decided by Kaz 13 Sept (s13-pay3).
payroll.put("/settings", async (req, res) => {
  const key = manager(req, res); if (!key) return;
  const parsed = z.object({ sickPay: z.enum(["full", "ssp"]) }).safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues }); return; }
  await cfg(key).set({ settings: { sickPay: parsed.data.sickPay }, tenantId: req.auth!.tenantId, franchiseId: req.auth!.franchiseId ?? null, updatedAt: new Date().toISOString(), updatedBy: req.user?.email ?? null }, { merge: true });
  res.json({ ok: true, settings: parsed.data });
});

// PUT /api/payroll/employees {employees} — pay details, saved whole.
payroll.put("/employees", async (req, res) => {
  const key = manager(req, res); if (!key) return;
  const parsed = z.object({ employees: z.array(empSchema).max(1_000) }).safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues }); return; }
  const ids = new Set<string>();
  for (const e of parsed.data.employees) { if (ids.has(e.id)) { res.status(400).json({ error: `${e.name} is on the list twice` }); return; } ids.add(e.id); }
  await cfg(key).set({ employees: parsed.data.employees, tenantId: req.auth!.tenantId, franchiseId: req.auth!.franchiseId ?? null, updatedAt: new Date().toISOString(), updatedBy: req.user?.email ?? null }, { merge: true });
  res.json({ ok: true });
});

// PUT /api/payroll/adjust {period, adjust} — one period's per-person run
// adjustments (overtime, bonus, manual hours…); adjust null clears the period.
payroll.put("/adjust", async (req, res) => {
  const key = manager(req, res); if (!key) return;
  const parsed = z.object({ period: z.string().trim().min(1).max(120), adjust: z.record(z.string().max(120), adjustSchema).nullable() }).safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues }); return; }
  const ref = cfg(key);
  await db.runTransaction(async (tx) => {
    const all = { ...((await tx.get(ref)).get("adjust") ?? {}) } as Record<string, unknown>;
    if (parsed.data.adjust && Object.keys(parsed.data.adjust).length) all[parsed.data.period] = JSON.parse(JSON.stringify(parsed.data.adjust));
    else delete all[parsed.data.period];
    tx.set(ref, { adjust: all, tenantId: req.auth!.tenantId, franchiseId: req.auth!.franchiseId ?? null, updatedAt: new Date().toISOString() }, { merge: true });
  });
  res.json({ ok: true });
});

// POST /api/payroll/runs — record an approved run. Never overwrites: a
// second run for the same period is a second record.
const lineSchema = z.object({ id: z.string().min(1).max(120), name: z.string().max(120), grossM: z.number(), netM: z.number() }).passthrough();
payroll.post("/runs", async (req, res) => {
  const key = manager(req, res); if (!key) return;
  const parsed = z.object({
    period: z.string().trim().min(1).max(120),
    paidOn: z.string().regex(DAY),
    freq: z.enum(["weekly", "fortnightly", "fourweekly", "monthly"]).optional(),
    hoursBasis: z.string().max(20).optional(),
    window: z.object({ start: z.string().regex(DAY), end: z.string().regex(DAY) }).optional(),
    lines: z.array(lineSchema).min(1).max(1_000),
  }).safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues }); return; }
  const now = new Date().toISOString();
  const id = "pr_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const doc = { ...JSON.parse(JSON.stringify(parsed.data)), id, status: "approved", createdAt: now, createdBy: req.user?.email ?? null, publishedAt: null, payKey: key, tenantId: req.auth!.tenantId, franchiseId: req.auth!.franchiseId ?? null };
  await runs.doc(`${key}_${id}`.replace(/\//g, "_")).create(doc);
  res.status(201).json(stripRun(doc));
});

// POST /api/payroll/runs/:id/publish {published} — show (or stop showing) a
// run's payslips to the staff on it.
payroll.post("/runs/:id/publish", async (req, res) => {
  const key = manager(req, res); if (!key) return;
  const parsed = z.object({ published: z.boolean() }).safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues }); return; }
  const ref = runs.doc(`${key}_${String(req.params.id)}`.replace(/\//g, "_"));
  const snap = await ref.get();
  if (!snap.exists || snap.get("payKey") !== key) { res.status(404).json({ error: "Not found" }); return; }
  const publishedAt = parsed.data.published ? new Date().toISOString() : null;
  await ref.set({ publishedAt, publishedBy: parsed.data.published ? req.user?.email ?? null : null }, { merge: true });
  res.json({ ok: true, publishedAt });
});

// GET /api/payroll/timesheets?from=&to= — clock records for a pay period
// (managers). One equality query per day, like /api/timeclock, so no index.
payroll.get("/timesheets", async (req, res) => {
  const key = manager(req, res); if (!key) return;
  const from = String(req.query.from ?? ""), to = String(req.query.to ?? "");
  if (!DAY.test(from) || !DAY.test(to) || to < from) { res.status(400).json({ error: "from=YYYY-MM-DD&to=YYYY-MM-DD required" }); return; }
  const days: string[] = [];
  for (let d = new Date(`${from}T12:00:00Z`); d.toISOString().slice(0, 10) <= to; d.setUTCDate(d.getUTCDate() + 1)) {
    days.push(d.toISOString().slice(0, 10));
    if (days.length > 62) { res.status(400).json({ error: "A pay period can't be longer than 62 days" }); return; }
  }
  const snaps = await Promise.all(days.map((day) => db.collection("clockRecords").where("key", "==", key).where("day", "==", day).get()));
  res.json(snaps.flatMap((s) => s.docs.map((d) => { const { key: _k, tenantId: _t, franchiseId: _f, uid: _u, ...r } = d.data(); return r; })));
});

// GET /api/payroll/mine — the signed-in person's own payslips: their line of
// every PUBLISHED run, as PayRun[] (one line each) so the payslip + YTD render
// as-is. Matched by the account name the manager set (the same slug the
// timeclock and rota use), never the token's display name.
payroll.get("/mine", async (req, res) => {
  const auth = req.auth!;
  if (!auth.tenantId || !(auth.role === "staff" || canManage(auth.role))) { res.status(403).json({ error: "Forbidden" }); return; }
  const name = req.user?.uid ? String((await db.collection("users").doc(req.user.uid).get()).get("name") ?? "").trim() : "";
  if (!name) { res.json([]); return; }
  const me = slug(name);
  const snap = await runs.where("payKey", "==", keyOf(auth.tenantId, auth.franchiseId)).get();
  const out = snap.docs
    .map((d) => d.data())
    .filter((r) => !!r.publishedAt)
    .map((r) => ({ ...stripRun(r), lines: ((r.lines ?? []) as { id?: string; staffKey?: string }[]).filter((l) => (l.staffKey ?? l.id) === me) }))
    .filter((r) => r.lines.length > 0)
    .sort((a, b) => String((b as { paidOn?: string }).paidOn ?? "").localeCompare(String((a as { paidOn?: string }).paidOn ?? "")));
  res.json(out);
});
