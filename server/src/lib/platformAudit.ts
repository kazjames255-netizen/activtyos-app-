import type { Request } from "express";
import { db } from "../firebase";

/**
 * One append-only trail for the sensitive things HQ does that are not "acting as" someone
 * (that has its own `impersonationLog`): revealing bank details, looking accounts up, deleting a lead, marking a request handled.
 * Who (verified token, never the body), what, which tenant/target, when. Never content: no bank numbers, no message text.
 * Throws when the row cannot be written: callers that hand out something sensitive let that stop them (fail closed).
 */
export async function platformAudit(req: Request, kind: string, data: Record<string, unknown> = {}): Promise<void> {
  await db.collection("platformAudit").add({ kind, byUid: req.user?.uid ?? null, byEmail: req.user?.email ?? null, ...data, at: new Date().toISOString() });
}

/** Same row, but a failure is only logged (for lookups where refusing the page would do more harm than a missing trace). */
export async function platformAuditBestEffort(req: Request, kind: string, data: Record<string, unknown> = {}): Promise<void> {
  try { await platformAudit(req, kind, data); } catch (e) { console.error(`[platformAudit] ${kind} not recorded:`, (e as Error).message); }
}
