import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { db } from "../firebase";
import type { Role } from "../middleware/role";
import { buildPayslipPdf, taxYearFor, type PayslipLine, type PayslipRun } from "../lib/payslipPdf";
import { performEmailSend } from "../lib/emailSend";
import { tenantSender } from "../lib/sender";

// Real PDF payslips + email/bulk-send — docs/payroll-integrations-handoff.md
// §4 ("Payslips"). A SEPARATE router from routes/payroll.ts (which another
// agent owns tonight): it reads the same `payrollRuns` collection directly
// rather than importing anything from that file, and is mounted on the same
// "/api/payroll" prefix in index.ts (Express tries routers in order; none of
// these paths collide with payroll.ts's own).
//
// Persistence choice: the GENERATED PDF BYTES are cached in Firestore, one
// doc per (run, employee), the same small-file-in-a-doc convention
// routes/uploads.ts already uses for receipts (no Storage bucket yet). Once
// a payslip has been produced it must never silently drift even if the PDF
// layout code changes later — a re-download must return the exact document
// a payslip run once issued (HMRC retention: 3 years past tax-year end,
// proven by `taxYearEnd` below, which a future purge sweep can query on).
// Figures don't need separate persistence: the source run doc they're
// computed from is itself immutable (payroll.ts never overwrites a run).

export const payslips = Router();

const canManage = (role: Role) => role === "company" || role === "freelancer" || role === "franchise";
const keyOf = (tenantId: string, franchiseId: string | null) => (franchiseId ? `${tenantId}__fr__${franchiseId}` : tenantId);
const slug = (name: string) => name.trim().toLowerCase().replace(/\s+/g, "-");
const docSafe = (s: string) => s.replace(/\//g, "_");

const runs = db.collection("payrollRuns");
const pdfs = db.collection("payslipPdfs");

interface RunDoc { id: string; period: string; paidOn: string; lines: PayslipLine[]; payKey: string; publishedAt: string | null }

async function loadRun(key: string, runId: string): Promise<RunDoc | null> {
  const snap = await runs.doc(docSafe(`${key}_${runId}`)).get();
  if (!snap.exists || snap.get("payKey") !== key) return null;
  return snap.data() as RunDoc;
}

async function loadAllRuns(key: string): Promise<PayslipRun[]> {
  const snap = await runs.where("payKey", "==", key).get();
  return snap.docs.map((d) => d.data() as RunDoc);
}

/** Who's allowed to see employeeId's payslip on this run, for this caller.
 *  Managers (company/freelancer/franchise) see anyone on their own tenant's
 *  runs, published or not. Staff see only their OWN line, and only once the
 *  run is published — identical rule to GET /api/payroll/mine. */
async function authorize(req: Request, res: Response, key: string, run: RunDoc, employeeId: string): Promise<PayslipLine | null> {
  const auth = req.auth!;
  const line = run.lines.find((l) => (l.staffKey ?? l.id) === employeeId);
  if (!line) { res.status(404).json({ error: "No payslip for that employee on this run" }); return null; }
  if (canManage(auth.role) && auth.tenantId && keyOf(auth.tenantId, auth.franchiseId) === key) return line;
  if (auth.role === "staff" && auth.tenantId && keyOf(auth.tenantId, auth.franchiseId) === key) {
    if (!run.publishedAt) { res.status(403).json({ error: "This payslip hasn't been published yet" }); return null; }
    const name = req.user?.uid ? String((await db.collection("users").doc(req.user.uid).get()).get("name") ?? "").trim() : "";
    if (!name || slug(name) !== employeeId) { res.status(403).json({ error: "You can only view your own payslip" }); return null; }
    return line;
  }
  res.status(403).json({ error: "Forbidden" });
  return null;
}

async function providerName(tenantId: string | null): Promise<string> {
  const sender = await tenantSender(tenantId ?? undefined);
  return sender.name || "Your employer";
}

/** Cached-or-built PDF bytes for one (run, employee) pair. Built once, then
 *  served byte-identical forever after (see file-header note). */
async function getOrBuildPdf(key: string, run: RunDoc, line: PayslipLine, tenantId: string | null, franchiseId: string | null): Promise<Buffer> {
  const id = docSafe(`${key}_${run.id}_${line.staffKey ?? line.id}`);
  const ref = pdfs.doc(id);
  const existing = await ref.get();
  if (existing.exists) return Buffer.from(existing.get("b64") as string, "base64");

  const [allRuns, provider] = await Promise.all([loadAllRuns(key), providerName(tenantId)]);
  const bytes = buildPayslipPdf({ line, period: run.period, paidOn: run.paidOn, provider, allRuns });
  const ty = taxYearFor(run.paidOn);
  await ref.create({
    payKey: key,
    tenantId,
    franchiseId: franchiseId ?? null,
    runId: run.id,
    employeeId: line.staffKey ?? line.id,
    employeeName: line.name,
    period: run.period,
    paidOn: run.paidOn,
    // Retention marker (HMRC: 3 years past tax-year end) — a future purge
    // sweep queries on this, same as the task's other retention work tonight.
    taxYearEnd: ty.endDate,
    bytes: bytes.length,
    b64: bytes.toString("base64"),
    generatedAt: new Date().toISOString(),
  }).catch(async (e) => {
    // A concurrent request built it first — fine, just read what's there.
    if ((e as { code?: number }).code !== 6 /* ALREADY_EXISTS */) throw e;
  });
  return bytes;
}

// GET /api/payroll/runs/:runId/payslip/:employeeId/pdf — a real, persisted
// PDF payslip. Managers: any employee on their own tenant's run. Staff:
// their own line of a PUBLISHED run only (403/404 otherwise).
payslips.get("/runs/:runId/payslip/:employeeId/pdf", async (req, res) => {
  const auth = req.auth!;
  if (!auth.tenantId) { res.status(403).json({ error: "Forbidden" }); return; }
  const key = keyOf(auth.tenantId, auth.franchiseId);
  const run = await loadRun(key, String(req.params.runId));
  if (!run) { res.status(404).json({ error: "Pay run not found" }); return; }
  const line = await authorize(req, res, key, run, String(req.params.employeeId));
  if (!line) return;
  const bytes = await getOrBuildPdf(key, run, line, auth.tenantId, auth.franchiseId);
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `inline; filename="payslip-${slug(line.name)}-${run.period.replace(/[^a-z0-9]+/gi, "-")}.pdf"`);
  res.setHeader("Cache-Control", "private, no-store");
  res.send(bytes);
});

// POST /api/payroll/runs/:runId/payslip/email {employeeId?} — a manager
// emails one employee's payslip, or every employee on the run when
// `employeeId` is omitted. Reuses performEmailSend (lib/emailSend.ts) — the
// same engine the Email page and scheduled sweeps already send through —
// once PER employee, since each attachment is that person's own PDF.
payslips.post("/runs/:runId/payslip/email", async (req, res) => {
  const auth = req.auth!;
  if (!auth.tenantId || !canManage(auth.role)) { res.status(403).json({ error: "Only a manager or owner can send payslips" }); return; }
  const parsed = z.object({ employeeId: z.string().max(160).optional() }).safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues }); return; }
  const key = keyOf(auth.tenantId, auth.franchiseId);
  const run = await loadRun(key, String(req.params.runId));
  if (!run) { res.status(404).json({ error: "Pay run not found" }); return; }

  const targets = parsed.data.employeeId
    ? run.lines.filter((l) => (l.staffKey ?? l.id) === parsed.data.employeeId)
    : run.lines;
  if (!targets.length) { res.status(404).json({ error: "No matching employee on this run" }); return; }

  // Name → email, from the tenant's real users (same slug the /mine route
  // matches staff by), so an employee's payslip goes to THEIR account email,
  // never a free-text address.
  const usersSnap = await db.collection("users").where("tenantId", "==", auth.tenantId).get();
  const emailByKey = new Map<string, string>();
  for (const d of usersSnap.docs) {
    const franchiseOk = !auth.franchiseId || d.get("franchiseId") === auth.franchiseId || !d.get("franchiseId");
    const name = String(d.get("name") ?? "").trim();
    const email = String(d.get("email") ?? "").trim();
    if (name && email && franchiseOk) emailByKey.set(slug(name), email);
  }

  const provider = await providerName(auth.tenantId);
  const results: { employeeId: string; name: string; status: string }[] = [];
  for (const line of targets) {
    const empKey = line.staffKey ?? line.id;
    const to = emailByKey.get(empKey);
    if (!to) { results.push({ employeeId: empKey, name: line.name, status: "no account email on file" }); continue; }
    const bytes = await getOrBuildPdf(key, run, line, auth.tenantId, auth.franchiseId);
    await performEmailSend({
      tenantId: auth.tenantId,
      subject: `Your payslip · ${run.period}`,
      body: `Hi ${line.name.split(" ")[0] || line.name},\n\nYour payslip for ${run.period} (paid ${run.paidOn}) is attached as a PDF.\n\nThis is an estimated payslip for planning — see the note on the PDF itself.\n\n${provider}`,
      recipients: [to],
      audience: "one",
      sentBy: req.user?.email ?? auth.tenantId,
      sentByName: req.user?.name ?? provider,
      attachments: [{ filename: `payslip-${slug(line.name)}-${run.period.replace(/[^a-z0-9]+/gi, "-")}.pdf`, content: bytes, contentType: "application/pdf" }],
    });
    results.push({ employeeId: empKey, name: line.name, status: "sent" });
  }
  res.json({ ok: true, sent: results.filter((r) => r.status === "sent").length, results });
});
