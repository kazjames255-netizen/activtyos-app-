import { FieldValue } from "firebase-admin/firestore";
import { db } from "../firebase";
import { canSeeStudent, hubEnrolments, okId, type EnrolmentDoc, type HubCtx } from "./hubCore";

// Learning Hub — student groups: a tutor's named set of enrolled students, used for quick
// actions (set homework / schedule a lesson for a whole group). A group is just a list of
// child ids; the enrolment stays the source of truth for who is a student, so:
//  · members must be ACTIVE enrolments in the tutor's scope when added;
//  · a member who is un-enrolled / paused / erased is taken out (removeFromGroups);
//  · using a group expands to its members who are STILL active at that moment.

export const groupsCol = db.collection("hubGroups");
export const MAX_GROUPS = 100;
export const MAX_GROUP_MEMBERS = 100;

export interface GroupDoc {
  tenantId: string; franchiseId: string | null;
  name: string; colour: string; childIds: string[];
  createdBy: string; createdByName: string; createdAt: string; updatedAt: string;
}
export type Group = GroupDoc & { id: string };

/** A group this caller may use: same tenant and inside their student scope (a foreign id is a 404). */
export async function visibleGroups(ctx: HubCtx, ids: string[]): Promise<Group[] | null> {
  const uniq = [...new Set(ids)];
  if (uniq.some((id) => !okId(id))) return null;
  if (!uniq.length) return [];
  const snaps = await db.getAll(...uniq.map((id) => groupsCol.doc(id)));
  const out: Group[] = [];
  for (const s of snaps) {
    if (!s.exists || s.get("tenantId") !== ctx.tenantId || !canSeeStudent(ctx, s.get("franchiseId"))) return null;
    out.push({ id: s.id, ...(s.data() as GroupDoc) });
  }
  return out;
}

/** The union of these groups' members that are active enrolments the caller can see. */
export async function activeMembers(ctx: HubCtx, groups: Group[]): Promise<EnrolmentDoc[]> {
  const ids = [...new Set(groups.flatMap((g) => g.childIds ?? []))].filter(okId);
  if (!ids.length) return [];
  const snaps = await db.getAll(...ids.map((id) => hubEnrolments.doc(`${ctx.tenantId}__${id}`)));
  return snaps.filter((s) => s.exists).map((s) => s.data() as EnrolmentDoc).filter((e) => e.tenantId === ctx.tenantId && e.active !== false && canSeeStudent(ctx, e.franchiseId));
}

const chunks = <T,>(xs: T[], n: number) => Array.from({ length: Math.ceil(xs.length / n) }, (_, i) => xs.slice(i * n, i * n + n));

/** Take a child out of every group of a tenant (un-enrol / pause). */
export async function removeFromGroups(tenantId: string, childId: string): Promise<void> {
  try {
    const snap = await groupsCol.where("tenantId", "==", tenantId).get();
    const hit = snap.docs.filter((d) => ((d.get("childIds") as string[] | undefined) ?? []).includes(childId));
    for (const part of chunks(hit, 400)) {
      const b = db.batch();
      for (const d of part) b.update(d.ref, { childIds: FieldValue.arrayRemove(childId), updatedAt: new Date().toISOString() });
      await b.commit();
    }
  } catch (e) { console.error("[hub] group clean-up failed:", (e as Error).message); }
}
