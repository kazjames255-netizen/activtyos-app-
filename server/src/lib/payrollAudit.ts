import type { Request } from "express";
import { db } from "../firebase";

// Immutable audit trail for the payroll feature (handoff §5: "immutable
// audit log — view/edit/approve/export/print, actor + timestamp"). One
// Firestore doc per action in `payrollAuditLog`. Fire-and-forget from inside
// the route handler, same convention as lib/notify.ts's `notify()` calls
// (`void notify(...).catch(...)`)  — an audit-log write must never be the
// reason a real payroll action fails or hangs for the person using it.

export type PayrollAction =
  | "view-employees" | "edit-employees" | "view-ni"
  | "create-run" | "approve-run" | "publish-run" | "unpublish-run";

const col = db.collection("payrollAuditLog");

/** Record one payroll action. Fire-and-forget: never await this from a route
 *  handler, never let it affect the response. */
export function auditPayroll(req: Request, payKey: string, action: PayrollAction, detail?: Record<string, unknown>): void {
  const auth = req.auth;
  const entry = {
    tenantId: auth?.tenantId ?? null,
    franchiseId: auth?.franchiseId ?? null,
    payKey,
    actor: req.user?.email ?? req.user?.uid ?? null,
    action,
    at: new Date().toISOString(),
    detail: detail ?? null,
  };
  void col.add(entry).catch((e) => console.error("[payrollAudit] write failed:", (e as Error).message));
}
