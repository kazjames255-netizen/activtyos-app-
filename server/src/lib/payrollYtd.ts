import { db } from "../firebase";

// Deliberately NOT imported from features/payroll/payCalc.ts: that pure-lib
// file imports "@/lib/holiday" (a Next.js path alias the server's own
// tsconfig — server/tsconfig.json — doesn't map), so pulling it into server
// code breaks `npm --prefix server run typecheck`. Same rounding, defined
// locally instead.
const r2 = (n: number) => Math.round((n || 0) * 100) / 100;

// Per-employee, per-UK-tax-year (6 Apr–5 Apr) CUMULATIVE payroll totals —
// the prerequisite for cumulative PAYE, P60 and P45 (docs/payroll-integrations-
// handoff.md §1). One doc per (tenant/franchise payKey, employee, tax year) in
// `payrollYtd`, updated by a transaction so two runs landing at once still add
// up correctly.
//
// Wired into APPROVAL, not creation: a pay run is created as a draft (item 6,
// segregation of duties) and can still be edited/discarded before a second
// person approves it, so counting it into a running annual total at draft time
// would let an abandoned run permanently inflate someone's YTD. The doc's
// "updated whenever a run is created" is read here as "whenever a run becomes
// real" — i.e. on POST /runs/:id/approve, the point a run is now immutable
// history (payroll.ts never overwrites an approved run).
//
// NOTE: `taxable` is approximated as gross pay. A true cumulative-taxable
// figure (net of the personal allowance actually used so far this tax year,
// K-code adjustments, etc.) needs the real tax-code/NI-category engine from
// handoff §1 ("Tax code + NI category driving the calc") — an explicitly
// separate task from this one. Don't build it here.

export interface YtdTotals {
  gross: number; taxable: number; paye: number; eeNi: number; erNi: number; eePension: number; erPension: number; net: number;
  runs: number;
}
export interface YtdRecord extends YtdTotals {
  payKey: string; tenantId: string; franchiseId: string | null; empId: string; taxYear: string; updatedAt: string;
}

const col = db.collection("payrollYtd");
const docId = (payKey: string, empId: string, taxYear: string) => `${payKey}_${empId}_${taxYear}`.replace(/\//g, "_");

/** The UK tax year a date falls in ("2026-27" for 2026-04-06..2027-04-05). */
export function ukTaxYearOf(dateISO: string): string {
  const d = new Date(`${dateISO}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) throw new Error(`ukTaxYearOf: invalid date ${dateISO}`);
  const y = d.getUTCFullYear(), m = d.getUTCMonth() + 1, day = d.getUTCDate();
  const startYear = m > 4 || (m === 4 && day >= 6) ? y : y - 1;
  return `${startYear}-${String((startYear + 1) % 100).padStart(2, "0")}`;
}

export interface RunLineAmounts { grossM: number; payeM: number; eeNiM: number; erNiM: number; eePenM: number; erPenM: number; netM: number }

/** Add one pay-run line's amounts onto the employee's running total for the
 *  tax year `paidOn` falls in. Idempotency is the caller's job (approve is a
 *  one-way status flip in payroll.ts, so this runs at most once per run). */
export async function addRunToYtd(
  payKey: string, tenantId: string, franchiseId: string | null, empId: string, paidOn: string, line: RunLineAmounts,
): Promise<YtdRecord> {
  const taxYear = ukTaxYearOf(paidOn);
  const ref = col.doc(docId(payKey, empId, taxYear));
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const prev = (snap.exists ? (snap.data() as YtdTotals) : null);
    const next: YtdRecord = {
      payKey, tenantId, franchiseId, empId, taxYear,
      gross: r2((prev?.gross ?? 0) + line.grossM),
      taxable: r2((prev?.taxable ?? 0) + line.grossM),
      paye: r2((prev?.paye ?? 0) + line.payeM),
      eeNi: r2((prev?.eeNi ?? 0) + line.eeNiM),
      erNi: r2((prev?.erNi ?? 0) + line.erNiM),
      eePension: r2((prev?.eePension ?? 0) + line.eePenM),
      erPension: r2((prev?.erPension ?? 0) + line.erPenM),
      net: r2((prev?.net ?? 0) + line.netM),
      runs: (prev?.runs ?? 0) + 1,
      updatedAt: new Date().toISOString(),
    };
    tx.set(ref, next, { merge: true });
    return next;
  });
}

/** Read one employee's YTD totals for a tax year — null if nothing posted
 *  yet. `taxYear` defaults to the tax year covering today. */
export async function getYtd(payKey: string, empId: string, taxYear?: string): Promise<YtdRecord | null> {
  const ty = taxYear || ukTaxYearOf(new Date().toISOString().slice(0, 10));
  const snap = await col.doc(docId(payKey, empId, ty)).get();
  return snap.exists ? (snap.data() as YtdRecord) : null;
}

// ── Idempotent, auditable posting (item 39a) ──────────────────────────────
// One ledger doc per (run, employee) in `payrollYtdPosts`, created in the SAME
// transaction that bumps the YTD total: a replay (retry, repost, double call)
// finds the ledger doc and changes nothing. The ledger is also the audit trail
// — it records what each run added, so the YTD can be re-derived/reconciled.
const posts = db.collection("payrollYtdPosts");
const postId = (payKey: string, runId: string, empId: string) => `${payKey}_${runId}_${empId}`.replace(/\//g, "_");

export async function addRunToYtdOnce(
  payKey: string, tenantId: string, franchiseId: string | null, runId: string, empId: string, paidOn: string, line: RunLineAmounts,
): Promise<{ posted: boolean; record: YtdRecord }> {
  const taxYear = ukTaxYearOf(paidOn);
  const ref = col.doc(docId(payKey, empId, taxYear));
  const pref = posts.doc(postId(payKey, runId, empId));
  return db.runTransaction(async (tx) => {
    const [snap, pSnap] = await Promise.all([tx.get(ref), tx.get(pref)]);
    const prev = (snap.exists ? (snap.data() as YtdTotals) : null);
    if (pSnap.exists) return { posted: false, record: snap.data() as YtdRecord };
    const next: YtdRecord = {
      payKey, tenantId, franchiseId, empId, taxYear,
      gross: r2((prev?.gross ?? 0) + line.grossM),
      taxable: r2((prev?.taxable ?? 0) + line.grossM),
      paye: r2((prev?.paye ?? 0) + line.payeM),
      eeNi: r2((prev?.eeNi ?? 0) + line.eeNiM),
      erNi: r2((prev?.erNi ?? 0) + line.erNiM),
      eePension: r2((prev?.eePension ?? 0) + line.eePenM),
      erPension: r2((prev?.erPension ?? 0) + line.erPenM),
      net: r2((prev?.net ?? 0) + line.netM),
      runs: (prev?.runs ?? 0) + 1,
      updatedAt: new Date().toISOString(),
    };
    tx.set(ref, next, { merge: true });
    tx.set(pref, { payKey, tenantId, franchiseId, runId, empId, taxYear, paidOn, ...line, postedAt: next.updatedAt });
    return { posted: true, record: next };
  });
}

/** Every ledger entry for an employee+tax year (for reconciliation). */
export async function ytdPostsFor(payKey: string, empId: string, taxYear: string) {
  const s = await posts.where("payKey", "==", payKey).where("empId", "==", empId).get();
  return s.docs.map((d) => d.data()).filter((p) => p.taxYear === taxYear);
}
/** Has this run/employee been posted to the ledger? */
export async function ytdPostExists(payKey: string, runId: string, empId: string): Promise<boolean> {
  return (await posts.doc(postId(payKey, runId, empId)).get()).exists;
}
