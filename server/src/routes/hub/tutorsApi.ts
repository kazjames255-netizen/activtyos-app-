import { Router } from "express";
import { db } from "../../firebase";
import { requireEdit, resolveCtx, type HubCtx } from "../../lib/hubCore";

// Learning Hub — WHO CAN TEACH (F11: per-tutor scoping). A multi-tutor business assigns each student a tutor
// (`tutorUid` on the enrolment) and each lesson carries the tutor who scheduled it. This lists the people a student
// can be assigned to: the tenant's own operator logins (owner + staff) inside the caller's scope.

export const hubTutorsApi = Router();

const TUTOR_ROLES = new Set(["company", "freelancer", "franchise", "staff"]);

export interface TutorRow { uid: string; name: string; role: string }

/** The logins in this caller's scope who can be a student's tutor. Switched-off accounts are left out.
 *  Tenant-level callers see head office's people plus every franchise's; a franchise (and its staff) only its own. */
export async function tutorsInScope(ctx: HubCtx): Promise<TutorRow[]> {
  const snap = await db.collection("users").where("tenantId", "==", ctx.tenantId).get();
  const out: TutorRow[] = [];
  for (const d of snap.docs) {
    const role = String(d.get("role") ?? "");
    if (!TUTOR_ROLES.has(role) || d.get("disabled") === true || d.get("deactivatedAt")) continue;
    const fr = (d.get("franchiseId") as string | null | undefined) ?? null;
    if (ctx.franchiseId !== null && fr !== ctx.franchiseId) continue;
    const name = String(d.get("name") ?? "").trim();
    out.push({ uid: d.id, name: name || String(d.get("email") ?? "").split("@")[0] || "Tutor", role });
  }
  out.sort((a, b) => a.name.localeCompare(b.name));
  return out;
}

/** A tutor the caller may name on a student: someone from `tutorsInScope`. → {uid,name}, or null. */
export async function resolveTutor(ctx: HubCtx, uid: string): Promise<{ uid: string; name: string } | null> {
  const hit = (await tutorsInScope(ctx)).find((t) => t.uid === uid);
  return hit ? { uid: hit.uid, name: hit.name } : null;
}

// GET /tutors — [{uid, name, role, me}] (tutors only; `me` marks the caller).
hubTutorsApi.get("/tutors", async (req, res) => {
  const ctx = await resolveCtx(req, res);
  if (!ctx || !requireEdit(ctx, res)) return;
  const list = await tutorsInScope(ctx);
  res.json(list.map((t) => ({ ...t, me: t.uid === ctx.uid })));
});
