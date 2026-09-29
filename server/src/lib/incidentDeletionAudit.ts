import type { Request } from "express";
import { db } from "../firebase";

// A deleted safeguarding record with a DSL (designated safeguarding lead)
// decision must leave *some* trace — not the content, just that a
// DSL-decided record existed here and who removed it. One doc per delete
// in `incidentDeletionAudit`. Same fire-and-forget convention as
// lib/payrollAudit.ts, but this one is awaited (the delete itself is
// gated on it succeeding — see incidents.ts DELETE /:id): losing the
// audit trail silently defeats the point of writing it.

const col = db.collection("incidentDeletionAudit");

export async function auditIncidentDeletion(req: Request, id: string, rec: Record<string, unknown>): Promise<void> {
  const auth = req.auth;
  const entry = {
    incidentId: id,
    tenantId: auth?.tenantId ?? null,
    franchiseId: auth?.franchiseId ?? null,
    kind: rec.kind ?? null,
    childName: rec.childName ?? null,
    hadDslDecision: true,
    deletedBy: req.user?.email ?? req.user?.uid ?? null,
    deletedAt: new Date().toISOString(),
  };
  await col.add(entry);
}
