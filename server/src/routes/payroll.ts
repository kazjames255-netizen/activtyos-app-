import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { db } from "../firebase";
import type { Role } from "../middleware/role";
import { loadSettings } from "../lib/tenantLibrary";
import { decryptField, encryptField } from "../lib/fieldCrypto";
import { addRunToYtd, getYtd, ukTaxYearOf } from "../lib/payrollYtd";
import { auditPayroll } from "../lib/payrollAudit";

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

// UK NI number, loosely validated (real prefix/suffix exclusions aren't
// enforced — HMRC's own list changes — just the shape: 2 letters, 6 digits,
// A–D). Spaces/dashes are stripped before storage.
const NI_RE = /^[A-Z]{2}\d{6}[A-D]$/;
const normalizeNi = (v: string) => v.trim().toUpperCase().replace(/[\s-]/g, "");

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
  // ── additive (item #39 pt.1) — all optional, all safe defaults, so an
  // employee record saved before this change round-trips unchanged. ──
  /** Plaintext NI number, ACCEPTED here only — never stored plaintext. When
   *  present it's encrypted into `niNumberEnc` before writing (see PUT
   *  /employees); when absent on an edit the previously-stored encrypted
   *  value is preserved, not wiped. */
  niNumber: z.string().trim().max(20).optional().refine((v) => !v || NI_RE.test(normalizeNi(v)), { message: "Not a valid NI number (2 letters, 6 digits, A–D), e.g. AB123456C" }),
  startDate: z.string().regex(DAY).optional(),
  leaveDate: z.string().regex(DAY).nullable().optional(),
  studentLoanPlan: z.enum(["none", "plan1", "plan2", "plan4", "plan5", "postgrad"]).optional().default("none"),
  director: z.boolean().optional().default(false),
  taxRegime: z.enum(["uk", "scotland", "wales"]).optional().default("uk"),
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

// Payroll-admin (item #39 pt.4): today every company/franchise/freelancer
// owner has full payroll access — same as every other screen. That's a real
// gap for a bigger team (bank details + NI for the whole payroll should not
// be every manager's business). settings.payrollAdmins — a list of user ids
// OR emails on the tenant's (or franchise's own) Setup — narrows it, but
// stays OFF (today's behaviour, unchanged) until a tenant actually sets it,
// so this is non-breaking for every tenant that hasn't configured it.
async function isPayrollAdmin(req: Request): Promise<boolean> {
  const auth = req.auth!;
  if (!auth.tenantId || !canManage(auth.role)) return false;
  let allow: unknown;
  try { allow = (await loadSettings(auth.tenantId, auth.franchiseId)).payrollAdmins; }
  catch (e) { console.error("[payroll] payrollAdmins lookup failed, falling back to role-only:", (e as Error).message); return true; }
  if (!Array.isArray(allow) || allow.length === 0) return true; // unset → today's rule (any owner-tier role)
  const uid = req.user?.uid, email = req.user?.email?.toLowerCase();
  return allow.some((x) => x === uid || (typeof x === "string" && email && x.toLowerCase() === email));
}

async function manager(req: Request, res: Response): Promise<string | null> {
  const auth = req.auth!;
  if (!auth.tenantId || !canManage(auth.role)) { res.status(403).json({ error: "Only a manager or owner can see payroll" }); return null; }
  if (!(await isPayrollAdmin(req))) { res.status(403).json({ error: "Only a payroll administrator can access payroll. Ask an owner to add you in Setup." }); return null; }
  return keyOf(auth.tenantId, auth.franchiseId);
}
const stripRun = (d: FirebaseFirestore.DocumentData) => { const { payKey: _k, tenantId: _t, franchiseId: _f, ...r } = d; return r; };
/** Employees as sent to the client: strip the encrypted NI blob, never the
 *  plaintext (there never is any past this point) — `hasNiNumber` tells the
 *  UI whether one is on file without revealing it. */
const stripEmp = (e: Record<string, unknown>) => { const { niNumberEnc, ...r } = e as { niNumberEnc?: string }; return { ...r, hasNiNumber: !!niNumberEnc }; };

// GET /api/payroll — { employees, adjust, runs, settings } (managers).
payroll.get("/", async (req, res) => {
  const key = await manager(req, res); if (!key) return;
  const [c, r] = await Promise.all([cfg(key).get(), runs.where("payKey", "==", key).get()]);
  const list = r.docs.map((d) => stripRun(d.data())).sort((a, b) => String(b.createdAt ?? "").localeCompare(String(a.createdAt ?? "")));
  const employeesRaw = c.get("employees") as Record<string, unknown>[] | null;
  auditPayroll(req, key, "view-employees", { count: employeesRaw?.length ?? 0 });
  res.json({ employees: employeesRaw ? employeesRaw.map(stripEmp) : null, adjust: c.get("adjust") ?? {}, runs: list, settings: { sickPay: c.get("settings.sickPay") === "ssp" ? "ssp" : "full" } });
});

// PUT /api/payroll/settings {sickPay} — the company's payroll rules. Sick pay:
// "full" = full contracted pay (default); "ssp" = SSP only — sick days are
// deducted like unpaid leave and SSP is added by the payroll provider (we
// don't calculate it). Decided by Kaz 13 Sept (s13-pay3).
payroll.put("/settings", async (req, res) => {
  const key = await manager(req, res); if (!key) return;
  const parsed = z.object({ sickPay: z.enum(["full", "ssp"]) }).safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues }); return; }
  await cfg(key).set({ settings: { sickPay: parsed.data.sickPay }, tenantId: req.auth!.tenantId, franchiseId: req.auth!.franchiseId ?? null, updatedAt: new Date().toISOString(), updatedBy: req.user?.email ?? null }, { merge: true });
  res.json({ ok: true, settings: parsed.data });
});

// PUT /api/payroll/employees {employees} — pay details, saved whole. The NI
// number is the one field that's write-only from here: a PUT that omits it
// for an employee who already has one on file keeps the stored (encrypted)
// value rather than wiping it — the client never has the plaintext to send
// back, since GET never returns it (stripEmp).
payroll.put("/employees", async (req, res) => {
  const key = await manager(req, res); if (!key) return;
  const parsed = z.object({ employees: z.array(empSchema).max(1_000) }).safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues }); return; }
  const ids = new Set<string>();
  for (const e of parsed.data.employees) { if (ids.has(e.id)) { res.status(400).json({ error: `${e.name} is on the list twice` }); return; } ids.add(e.id); }
  const existing = (await cfg(key).get()).get("employees") as Record<string, unknown>[] | undefined;
  const existingEnc = new Map<string, string>();
  for (const e of existing ?? []) { const enc = (e as { niNumberEnc?: unknown }).niNumberEnc; if (typeof enc === "string" && enc) existingEnc.set(String(e.id), enc); }
  const employees = parsed.data.employees.map((e) => {
    const { niNumber, ...rest } = e;
    const niNumberEnc = niNumber ? encryptField(normalizeNi(niNumber)) : existingEnc.get(e.id);
    return { ...rest, ...(niNumberEnc ? { niNumberEnc } : {}) };
  });
  await cfg(key).set({ employees, tenantId: req.auth!.tenantId, franchiseId: req.auth!.franchiseId ?? null, updatedAt: new Date().toISOString(), updatedBy: req.user?.email ?? null }, { merge: true });
  auditPayroll(req, key, "edit-employees", { count: employees.length });
  res.json({ ok: true });
});

// GET /api/payroll/employees/:id/ni — decrypt and reveal ONE employee's NI
// number. Never part of a listing (item #39 pt.2): a payroll admin has to
// explicitly ask for it, and every ask is audited.
payroll.get("/employees/:id/ni", async (req, res) => {
  const key = await manager(req, res); if (!key) return;
  const id = String(req.params.id);
  const employees = ((await cfg(key).get()).get("employees") as Record<string, unknown>[] | undefined) ?? [];
  const emp = employees.find((e) => e.id === id);
  const enc = emp && typeof (emp as { niNumberEnc?: unknown }).niNumberEnc === "string" ? (emp as { niNumberEnc: string }).niNumberEnc : null;
  if (!emp) { res.status(404).json({ error: "Not found" }); return; }
  auditPayroll(req, key, "view-ni", { empId: id });
  if (!enc) { res.json({ niNumber: null }); return; }
  try { res.json({ niNumber: decryptField(enc) }); }
  catch (e) { console.error("[payroll] NI decrypt failed:", (e as Error).message); res.status(500).json({ error: "Could not decrypt this employee's NI number" }); }
});

// PUT /api/payroll/adjust {period, adjust} — one period's per-person run
// adjustments (overtime, bonus, manual hours…); adjust null clears the period.
payroll.put("/adjust", async (req, res) => {
  const key = await manager(req, res); if (!key) return;
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

// POST /api/payroll/runs — record a DRAFT run. Never overwrites: a second
// run for the same period is a second record. Segregation of duties (item
// #39 pt.6): a run created here is NOT yet approved — POST .../approve
// (below) has to be actioned by someone else before it can be published to
// staff. This is a behaviour change: earlier callers (and PayrollApp.tsx)
// were built when "approve" and "create" were the same click — see the
// approve route's comment and payroll-integrations-handoff.md report.
const lineSchema = z.object({ id: z.string().min(1).max(120), name: z.string().max(120), grossM: z.number(), netM: z.number() }).passthrough();
payroll.post("/runs", async (req, res) => {
  const key = await manager(req, res); if (!key) return;
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
  const doc = { ...JSON.parse(JSON.stringify(parsed.data)), id, status: "draft", createdAt: now, createdBy: req.user?.email ?? null, approvedAt: null, approvedBy: null, publishedAt: null, payKey: key, tenantId: req.auth!.tenantId, franchiseId: req.auth!.franchiseId ?? null };
  await runs.doc(`${key}_${id}`.replace(/\//g, "_")).create(doc);
  auditPayroll(req, key, "create-run", { runId: id, period: parsed.data.period, lines: parsed.data.lines.length });
  res.status(201).json(stripRun(doc));
});

// POST /api/payroll/runs/:id/approve — flips a draft run to approved.
// Segregation of duties: the approver must be a DIFFERENT person from
// whoever created it (checked by signed-in email; a run with no recorded
// creator — none predate this field — can't fail that check, so it's
// approvable by anyone with access, same as before this change). This is
// also where the employee/tax-year YTD store (item #39 pt.3) is updated —
// see server/src/lib/payrollYtd.ts's header comment for why that happens
// HERE and not at draft creation.
payroll.post("/runs/:id/approve", async (req, res) => {
  const key = await manager(req, res); if (!key) return;
  const ref = runs.doc(`${key}_${String(req.params.id)}`.replace(/\//g, "_"));
  const snap = await ref.get();
  if (!snap.exists || snap.get("payKey") !== key) { res.status(404).json({ error: "Not found" }); return; }
  if (snap.get("status") === "approved") { res.status(400).json({ error: "This run is already approved." }); return; }
  const createdBy = (snap.get("createdBy") as string | null) ?? null;
  const approver = req.user?.email ?? null;
  if (createdBy && approver && createdBy.toLowerCase() === approver.toLowerCase()) {
    res.status(403).json({ error: "Segregation of duties: someone other than whoever created this run has to approve it." });
    return;
  }
  const now = new Date().toISOString();
  await ref.set({ status: "approved", approvedAt: now, approvedBy: approver }, { merge: true });
  const tenantId = String(snap.get("tenantId") ?? req.auth!.tenantId);
  const franchiseId = (snap.get("franchiseId") as string | null) ?? req.auth!.franchiseId ?? null;
  const paidOn = String(snap.get("paidOn"));
  const lines = (snap.get("lines") as { id?: string; grossM?: number; payeM?: number; eeNiM?: number; erNiM?: number; eePenM?: number; erPenM?: number; netM?: number }[] | undefined) ?? [];
  try {
    await Promise.all(lines.filter((l) => l.id).map((l) => addRunToYtd(key, tenantId, franchiseId, String(l.id), paidOn, {
      grossM: l.grossM ?? 0, payeM: l.payeM ?? 0, eeNiM: l.eeNiM ?? 0, erNiM: l.erNiM ?? 0, eePenM: l.eePenM ?? 0, erPenM: l.erPenM ?? 0, netM: l.netM ?? 0,
    })));
  } catch (e) {
    // The run IS approved (that write already committed) — a YTD failure
    // shouldn't un-approve it or make the caller think the approval failed.
    // Logged loudly because a missed YTD update needs a human to fix it.
    console.error(`[payroll] YTD update failed for approved run ${req.params.id} (${key}):`, (e as Error).message);
  }
  auditPayroll(req, key, "approve-run", { runId: req.params.id });
  const updated = await ref.get();
  res.json(stripRun(updated.data()!));
});

// POST /api/payroll/runs/:id/publish {published} — show (or stop showing) a
// run's payslips to the staff on it. A run must be APPROVED first — this is
// what actually closes the segregation-of-duties loop: without it, a single
// person could still create a draft and publish it straight to staff without
// a second approver ever being involved.
payroll.post("/runs/:id/publish", async (req, res) => {
  const key = await manager(req, res); if (!key) return;
  const parsed = z.object({ published: z.boolean() }).safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues }); return; }
  const ref = runs.doc(`${key}_${String(req.params.id)}`.replace(/\//g, "_"));
  const snap = await ref.get();
  if (!snap.exists || snap.get("payKey") !== key) { res.status(404).json({ error: "Not found" }); return; }
  if (parsed.data.published && snap.get("status") !== "approved") { res.status(400).json({ error: "Approve this run before publishing it to staff." }); return; }
  const publishedAt = parsed.data.published ? new Date().toISOString() : null;
  await ref.set({ publishedAt, publishedBy: parsed.data.published ? req.user?.email ?? null : null }, { merge: true });
  auditPayroll(req, key, parsed.data.published ? "publish-run" : "unpublish-run", { runId: req.params.id });
  res.json({ ok: true, publishedAt });
});

// GET /api/payroll/ytd/:empId?taxYear=YYYY-YY — one employee's cumulative
// totals for a tax year (defaults to the current one). Prerequisite reads
// for P60/P45, not built here (item #39 pt.3 is the store only).
payroll.get("/ytd/:empId", async (req, res) => {
  const key = await manager(req, res); if (!key) return;
  const taxYearQ = typeof req.query.taxYear === "string" ? req.query.taxYear : undefined;
  if (taxYearQ && !/^\d{4}-\d{2}$/.test(taxYearQ)) { res.status(400).json({ error: "taxYear must look like 2026-27" }); return; }
  const ytd = await getYtd(key, String(req.params.empId), taxYearQ);
  res.json(ytd ?? { empId: req.params.empId, taxYear: taxYearQ ?? ukTaxYearOf(new Date().toISOString().slice(0, 10)), gross: 0, taxable: 0, paye: 0, eeNi: 0, erNi: 0, eePension: 0, erPension: 0, net: 0, runs: 0 });
});

// GET /api/payroll/timesheets?from=&to= — clock records for a pay period
// (managers). One equality query per day, like /api/timeclock, so no index.
payroll.get("/timesheets", async (req, res) => {
  const key = await manager(req, res); if (!key) return;
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
