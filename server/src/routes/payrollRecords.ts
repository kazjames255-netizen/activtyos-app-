import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { db } from "../firebase";
import type { Role } from "../middleware/role";
import { decryptField } from "../lib/fieldCrypto";
import { auditPayroll } from "../lib/payrollAudit";
import { rateLimit } from "../lib/rateLimit";
import { addRunToYtdOnce, getYtd, ukTaxYearOf, ytdPostsFor } from "../lib/payrollYtd";
import { buildPayrollDocPdf, maskNi } from "../lib/payrollDocsPdf";
import { tenantSender } from "../lib/sender";
import { nameIsUnique, requirePayrollAdmin } from "./payroll";

// Payroll records (item 39): YTD reconcile/repost (the store itself is
// lib/payrollYtd.ts, posted once per run+employee on approval) and the P60 /
// P45 documents. ADDITIVE: reads the same payrollConfig / payrollRuns /
// payrollYtd docs; never writes a run's figures. Managers go through the same
// payroll-admin allow-list as the rest of payroll; staff read ONLY their own.
// Issued documents are persisted byte-for-byte (`payrollDocs`) and immutable,
// like payslipPdfs. Audit entries never contain NI numbers.

export const payrollRecords = Router();
payrollRecords.use("/records", rateLimit("payroll-records", 60, 60_000, (r: Request) => r.user?.uid));

const canManage = (role: Role) => role === "company" || role === "freelancer" || role === "franchise";
const keyOf = (t: string, f: string | null) => (f ? `${t}__fr__${f}` : t);
const slug = (n: string) => n.trim().toLowerCase().replace(/\s+/g, "-");
const docSafe = (s: string) => s.replace(/\//g, "_");
const TY = /^\d{4}-\d{2}$/;
const runs = db.collection("payrollRuns");
const docs = db.collection("payrollDocs");
const taxYearEnd = (ty: string) => `${Number(ty.slice(0, 4)) + 1}-04-05`;
const today = () => new Date().toISOString().slice(0, 10);

type Emp = { id: string; name: string; taxCode?: string; niNumberEnc?: string; leaveDate?: string | null };
interface Who { key: string; tenantId: string; franchiseId: string | null; emp: Emp; own: boolean; manager: boolean }

/** Resolve who the caller may read: managers (payroll admins) any employee in their pay scope; staff only the employee that IS them. */
async function resolve(req: Request, res: Response, empId: string): Promise<Who | null> {
  const auth = req.auth!;
  if (!auth.tenantId) { res.status(403).json({ error: "Forbidden" }); return null; }
  const key = keyOf(auth.tenantId, auth.franchiseId);
  const employees = ((await db.collection("payrollConfig").doc(docSafe(key)).get()).get("employees") as Emp[] | undefined) ?? [];
  if (canManage(auth.role)) {
    if (!(await requirePayrollAdmin(req, res, "payroll records"))) return null;
    const emp = employees.find((e) => e.id === empId);
    if (!emp) { res.status(404).json({ error: "Employee not found" }); return null; }
    return { key, tenantId: auth.tenantId, franchiseId: auth.franchiseId ?? null, emp, own: false, manager: true };
  }
  if (auth.role === "staff") {
    const name = req.user?.uid ? String((await db.collection("users").doc(req.user.uid).get()).get("name") ?? "").trim() : "";
    const me = name ? slug(name) : "";
    const emp = me ? employees.find((e) => slug(e.name) === me) : undefined;
    if (!emp || (emp.id !== empId && slug(emp.name) !== empId) || !(await nameIsUnique(auth.tenantId, auth.franchiseId ?? null, me))) { res.status(403).json({ error: "You can only view your own payroll records" }); return null; }
    return { key, tenantId: auth.tenantId, franchiseId: auth.franchiseId ?? null, emp, own: true, manager: false };
  }
  res.status(403).json({ error: "Forbidden" });
  return null;
}

interface RunLite { id: string; paidOn: string; status?: string; publishedAt?: string | null; lines: { id?: string; staffKey?: string; taxCode?: string }[] }
async function runsFor(key: string, emp: Emp, taxYear: string): Promise<RunLite[]> {
  const snap = await runs.where("payKey", "==", key).get();
  return snap.docs.map((d) => d.data() as RunLite).filter((r) => r.status === "approved" && r.paidOn && ukTaxYearOf(r.paidOn) === taxYear && r.lines.some((l) => l.id === emp.id || (l.staffKey ?? l.id) === slug(emp.name)));
}
const lastCode = (rs: RunLite[], emp: Emp) => {
  const sorted = [...rs].sort((a, b) => a.paidOn.localeCompare(b.paidOn));
  const l = sorted.length ? sorted[sorted.length - 1].lines.find((x) => x.id === emp.id || (x.staffKey ?? x.id) === slug(emp.name)) : undefined;
  return l?.taxCode || emp.taxCode || "";
};
function niMaskOf(emp: Emp): string | null {
  if (!emp.niNumberEnc) return null;
  try { return maskNi(decryptField(emp.niNumberEnc)); } catch { return null; }
}
async function provider(tenantId: string): Promise<string> { return (await tenantSender(tenantId)).name || "Your employer"; }
function sendPdf(res: Response, bytes: Buffer, name: string) {
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `inline; filename="${name}"`);
  res.setHeader("Cache-Control", "private, no-store");
  res.send(bytes);
}
async function persisted(id: string): Promise<Buffer | null> {
  const s = await docs.doc(id).get();
  return s.exists ? Buffer.from(s.get("b64") as string, "base64") : null;
}
async function persist(id: string, w: Who, kind: "P60" | "P45", taxYear: string, bytes: Buffer, req: Request) {
  await docs.doc(id).create({ payKey: w.key, tenantId: w.tenantId, franchiseId: w.franchiseId, empId: w.emp.id, kind, taxYear, taxYearEnd: taxYearEnd(taxYear), bytes: bytes.length, b64: bytes.toString("base64"), generatedAt: new Date().toISOString(), generatedBy: req.user?.email ?? null })
    .catch((e) => { if ((e as { code?: number }).code !== 6) throw e; });
}

// GET /api/payroll/records/:empId — what's available for this person: ended tax years with posted pay, and whether a P45 was issued.
payrollRecords.get("/records/:empId", async (req, res) => {
  const w = await resolve(req, res, String(req.params.empId)); if (!w) return;
  const snap = await db.collection("payrollYtd").where("payKey", "==", w.key).where("empId", "==", w.emp.id).get();
  const p45 = await docs.where("payKey", "==", w.key).where("empId", "==", w.emp.id).get();
  const issued = p45.docs.map((d) => d.data());
  res.json({
    employee: { id: w.emp.id, name: w.emp.name, leaveDate: w.emp.leaveDate ?? null },
    p60: snap.docs.map((d) => d.data()).filter((y) => y.runs > 0).map((y) => ({ taxYear: y.taxYear, ended: taxYearEnd(y.taxYear) < today(), gross: y.gross, paye: y.paye })).sort((a, b) => b.taxYear.localeCompare(a.taxYear)),
    p45: issued.filter((d) => d.kind === "P45").map((d) => ({ taxYear: d.taxYear, generatedAt: d.generatedAt })),
  });
});

// GET /api/payroll/records/:empId/p60?taxYear=2025-26[&preview=1] — PDF. Staff: own, ended year, all approved runs in it published. Managers: ended year, or ?preview=1 for a PROVISIONAL current-year copy (not stored).
payrollRecords.get("/records/:empId/p60", async (req, res) => {
  const w = await resolve(req, res, String(req.params.empId)); if (!w) return;
  const ty = typeof req.query.taxYear === "string" ? req.query.taxYear : "";
  if (!TY.test(ty)) { res.status(400).json({ error: "taxYear must look like 2025-26" }); return; }
  const ended = taxYearEnd(ty) < today();
  const preview = w.manager && req.query.preview === "1";
  if (!ended && !preview) { res.status(409).json({ error: `The ${ty} tax year hasn't ended yet — a P60 is issued after 5 April ${taxYearEnd(ty).slice(0, 4)}.` }); return; }
  const id = docSafe(`${w.key}_${w.emp.id}_P60_${ty}`);
  const ytd = await getYtd(w.key, w.emp.id, ty);
  if (!ytd || !ytd.runs) { res.status(404).json({ error: "No approved pay for that tax year" }); return; }
  const rs = await runsFor(w.key, w.emp, ty);
  if (w.own && rs.some((r) => !r.publishedAt)) { res.status(403).json({ error: "Your P60 isn't available yet — this year's pay runs haven't all been published." }); return; }
  let bytes = ended ? await persisted(id) : null;
  if (!bytes) {
    bytes = buildPayrollDocPdf({ kind: "P60", provider: await provider(w.tenantId), employeeName: w.emp.name, niMasked: niMaskOf(w.emp), taxCode: lastCode(rs, w.emp), taxYear: ty, totals: ytd, provisional: !ended, issuedOn: today() });
    if (ended) { await persist(id, w, "P60", ty, bytes, req); bytes = (await persisted(id)) ?? bytes; }
  }
  auditPayroll(req, w.key, "view-p60", { empId: w.emp.id, taxYear: ty, own: w.own, provisional: !ended });
  sendPdf(res, bytes, `p60-${slug(w.emp.name)}-${ty}.pdf`);
});

// POST /api/payroll/records/:empId/p45 — a manager issues the leaver's P45 (needs a leaveDate on the employee). Stored once; re-issuing returns the original.
payrollRecords.post("/records/:empId/p45", async (req, res) => {
  const w = await resolve(req, res, String(req.params.empId)); if (!w) return;
  if (!w.manager) { res.status(403).json({ error: "Only a manager can issue a P45" }); return; }
  const leave = w.emp.leaveDate;
  if (!leave) { res.status(409).json({ error: "Set a leaving date on this employee before issuing a P45." }); return; }
  const ty = ukTaxYearOf(leave);
  const ytd = await getYtd(w.key, w.emp.id, ty);
  if (!ytd || !ytd.runs) { res.status(404).json({ error: "No approved pay in the tax year of the leaving date" }); return; }
  const id = docSafe(`${w.key}_${w.emp.id}_P45_${ty}`);
  let bytes = await persisted(id);
  const fresh = !bytes;
  if (!bytes) {
    bytes = buildPayrollDocPdf({ kind: "P45", provider: await provider(w.tenantId), employeeName: w.emp.name, niMasked: niMaskOf(w.emp), taxCode: lastCode(await runsFor(w.key, w.emp, ty), w.emp), taxYear: ty, totals: ytd, leaveDate: leave, issuedOn: today() });
    await persist(id, w, "P45", ty, bytes, req); bytes = (await persisted(id)) ?? bytes;
  }
  auditPayroll(req, w.key, "issue-p45", { empId: w.emp.id, taxYear: ty, reissue: !fresh });
  sendPdf(res, bytes, `p45-${slug(w.emp.name)}.pdf`);
});

// GET /api/payroll/records/:empId/p45 — the issued P45 (manager, or the leaver themself). 404 until a manager has issued it.
payrollRecords.get("/records/:empId/p45", async (req, res) => {
  const w = await resolve(req, res, String(req.params.empId)); if (!w) return;
  const snap = await docs.where("payKey", "==", w.key).where("empId", "==", w.emp.id).get();
  const d = snap.docs.find((x) => x.get("kind") === "P45");
  if (!d) { res.status(404).json({ error: "No P45 has been issued" }); return; }
  auditPayroll(req, w.key, "view-p45", { empId: w.emp.id, own: w.own });
  sendPdf(res, Buffer.from(d.get("b64") as string, "base64"), `p45-${slug(w.emp.name)}.pdf`);
});

// GET /api/payroll/ytd/:empId/reconcile?taxYear= — manager: stored YTD vs the sum of the per-run ledger vs the sum of approved runs. Read-only.
payrollRecords.get("/ytd/:empId/reconcile", async (req, res) => {
  const auth = req.auth!;
  if (!auth.tenantId || !canManage(auth.role) || !(await requirePayrollAdmin(req, res))) { if (!res.headersSent) res.status(403).json({ error: "Forbidden" }); return; }
  const key = keyOf(auth.tenantId, auth.franchiseId ?? null);
  const empId = String(req.params.empId);
  const ty = typeof req.query.taxYear === "string" && TY.test(req.query.taxYear) ? req.query.taxYear : ukTaxYearOf(today());
  const [ytd, posts, rs] = await Promise.all([getYtd(key, empId, ty), ytdPostsFor(key, empId, ty), runs.where("payKey", "==", key).get()]);
  const r2 = (n: number) => Math.round(n * 100) / 100;
  const sum = (xs: Record<string, number>[], f: string) => r2(xs.reduce((a, x) => a + (Number(x[f]) || 0), 0));
  const approved = rs.docs.map((d) => d.data()).filter((r) => r.status === "approved" && r.paidOn && ukTaxYearOf(String(r.paidOn)) === ty);
  const lines = approved.flatMap((r) => ((r.lines ?? []) as Record<string, number & string>[]).filter((l) => l.id === empId).map((l) => ({ ...l, runId: r.id })));
  const f = (x: { gross?: number } | null) => x?.gross ?? 0;
  const out = { taxYear: ty, stored: { gross: f(ytd), paye: ytd?.paye ?? 0, runs: ytd?.runs ?? 0 }, ledger: { gross: sum(posts as never, "grossM"), paye: sum(posts as never, "payeM"), runs: posts.length }, approvedRuns: { gross: sum(lines as never, "grossM"), paye: sum(lines as never, "payeM"), runs: lines.length }, unposted: lines.filter((l) => !posts.some((p) => p.runId === l.runId)).map((l) => l.runId) };
  auditPayroll(req, key, "reconcile-ytd", { empId, taxYear: ty });
  res.json({ ...out, note: "Runs approved before the per-run ledger existed have no ledger entry; 'stored' vs 'approvedRuns' is the authoritative comparison for those." });
});

// POST /api/payroll/ytd/repost — manager: retry YTD posting for approved runs flagged ytdPostFailed. Idempotent per run+employee (never double-counts).
payrollRecords.post("/ytd/repost", async (req, res) => {
  const auth = req.auth!;
  if (!auth.tenantId || !canManage(auth.role) || !(await requirePayrollAdmin(req, res))) { if (!res.headersSent) res.status(403).json({ error: "Forbidden" }); return; }
  const parsed = z.object({}).passthrough().safeParse(req.body ?? {});
  if (!parsed.success) { res.status(400).json({ error: "Bad request" }); return; }
  const key = keyOf(auth.tenantId, auth.franchiseId ?? null);
  const snap = await runs.where("payKey", "==", key).where("ytdPostFailed", "==", true).get();
  let posted = 0, skipped = 0;
  for (const d of snap.docs) {
    if (d.get("status") !== "approved") continue;
    const lines = (d.get("lines") ?? []) as { id?: string; grossM?: number; payeM?: number; eeNiM?: number; erNiM?: number; eePenM?: number; erPenM?: number; netM?: number }[];
    for (const l of lines.filter((x) => x.id)) {
      const r = await addRunToYtdOnce(key, auth.tenantId, auth.franchiseId ?? null, String(d.get("id")), String(l.id), String(d.get("paidOn")), { grossM: l.grossM ?? 0, payeM: l.payeM ?? 0, eeNiM: l.eeNiM ?? 0, erNiM: l.erNiM ?? 0, eePenM: l.eePenM ?? 0, erPenM: l.erPenM ?? 0, netM: l.netM ?? 0 });
      if (r.posted) posted++; else skipped++;
    }
    await d.ref.set({ ytdPostFailed: false }, { merge: true });
  }
  auditPayroll(req, key, "repost-ytd", { runs: snap.size, posted, skipped });
  res.json({ runs: snap.size, posted, skipped });
});
