import { Router } from "express";
import { z } from "zod";
import { db } from "../../firebase";
import { canSeeStudent, canWriteRow, okId, requireEdit, resolveCtx, type HubCtx } from "../../lib/hubCore";
import { MAX_GROUPS, MAX_GROUP_MEMBERS, groupsCol, type Group, type GroupDoc } from "../../lib/hubGroups";
import { GROUP_COLOURS } from "../../lib/hubRules";
import { eligibleStudents, homeworkCol, lessonsCol, nowIso, tenantEnrolments } from "./teachingCommon";

// Learning Hub — STUDENT GROUPS (tutors only; families never see them). A named set of enrolled
// students for quick actions: homework `assignedGroupIds`, lessons `groupIds`. A child may be in many.
// Scope is the student scope (canSeeStudent): tenant-level tutors see every group, a franchise its own.

export const hubGroupsApi = Router();

const nameSchema = z.string().trim().min(1, "Give the group a name").max(60);
const colourSchema = z.enum(GROUP_COLOURS);
const createBody = z.object({ name: nameSchema, colour: colourSchema.default("blue"), childIds: z.array(z.string().min(1).max(100)).max(MAX_GROUP_MEMBERS).default([]) });
const patchBody = z.object({ name: nameSchema.optional(), colour: colourSchema.optional(), childIds: z.array(z.string().min(1).max(100)).max(MAX_GROUP_MEMBERS).optional() });

/** Stored group → row, with member names (members whose enrolment is gone or out of scope are dropped). */
async function rowOut(ctx: HubCtx, g: Group, students?: Map<string, { childName: string; active?: boolean }>) {
  const st = students ?? (await tenantEnrolments(ctx));
  const members = (g.childIds ?? []).filter((id) => st.has(id)).map((id) => ({ childId: id, childName: st.get(id)!.childName, active: st.get(id)!.active !== false }));
  return {
    id: g.id, name: g.name, colour: g.colour, childIds: members.map((m) => m.childId), members, count: members.length,
    franchiseId: g.franchiseId ?? null, createdByName: g.createdByName || "Your tutor", createdAt: g.createdAt, updatedAt: g.updatedAt,
  };
}

const allGroups = async (ctx: HubCtx): Promise<Group[]> =>
  (await groupsCol.where("tenantId", "==", ctx.tenantId).get()).docs.map((d) => ({ id: d.id, ...(d.data() as GroupDoc) })).filter((g) => canSeeStudent(ctx, g.franchiseId));

// GET /groups — every group in scope with its members.
hubGroupsApi.get("/groups", async (req, res) => {
  const ctx = await resolveCtx(req, res);
  if (!ctx || !requireEdit(ctx, res)) return;
  const [groups, students] = await Promise.all([allGroups(ctx), tenantEnrolments(ctx)]);
  const rows = await Promise.all(groups.map((g) => rowOut(ctx, g, students)));
  rows.sort((a, b) => a.name.localeCompare(b.name));
  res.json(rows);
});

// POST /groups {name, colour?, childIds}
hubGroupsApi.post("/groups", async (req, res) => {
  const ctx = await resolveCtx(req, res);
  if (!ctx || !requireEdit(ctx, res)) return;
  const parsed = createBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues }); return; }
  const b = parsed.data;
  const existing = await allGroups(ctx);
  if (existing.length >= MAX_GROUPS) { res.status(409).json({ error: `A hub can hold up to ${MAX_GROUPS} groups — tidy some away first` }); return; }
  if (existing.some((g) => (g.franchiseId ?? null) === ctx.franchiseId && g.name.toLowerCase() === b.name.toLowerCase())) { res.status(409).json({ error: "You already have a group with that name", code: "group_exists" }); return; }
  const students = await eligibleStudents(ctx, b.childIds);
  if (!students) { res.status(404).json({ error: "Student not found — groups are made of your enrolled students" }); return; }
  const now = nowIso();
  const doc: GroupDoc = { tenantId: ctx.tenantId, franchiseId: ctx.franchiseId, name: b.name, colour: b.colour, childIds: students.map((s) => s.childId), createdBy: ctx.uid, createdByName: ctx.name, createdAt: now, updatedAt: now };
  const ref = await groupsCol.add(doc);
  res.status(201).json(await rowOut(ctx, { id: ref.id, ...doc }));
});

/** A visible-and-writable group, or a refusal already sent. */
async function editableGroup(ctx: HubCtx, id: string, res: import("express").Response): Promise<Group | null> {
  if (!okId(id)) { res.status(404).json({ error: "Group not found" }); return null; }
  const snap = await groupsCol.doc(id).get();
  if (!snap.exists || snap.get("tenantId") !== ctx.tenantId || !canSeeStudent(ctx, snap.get("franchiseId"))) { res.status(404).json({ error: "Group not found" }); return null; }
  if (!canWriteRow(ctx, snap.get("franchiseId"))) { res.status(403).json({ error: "That group belongs to head office" }); return null; }
  return { id: snap.id, ...(snap.data() as GroupDoc) };
}

// PUT /groups/:id — any subset of name / colour / childIds (childIds = the whole new membership).
hubGroupsApi.put("/groups/:id", async (req, res) => {
  const ctx = await resolveCtx(req, res);
  if (!ctx || !requireEdit(ctx, res)) return;
  const parsed = patchBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues }); return; }
  const cur = await editableGroup(ctx, req.params.id, res);
  if (!cur) return;
  const b = parsed.data;
  const patch: Partial<GroupDoc> = { updatedAt: nowIso() };
  if (b.name !== undefined) {
    const clash = (await allGroups(ctx)).some((g) => g.id !== cur.id && (g.franchiseId ?? null) === (cur.franchiseId ?? null) && g.name.toLowerCase() === b.name!.toLowerCase());
    if (clash) { res.status(409).json({ error: "You already have a group with that name", code: "group_exists" }); return; }
    patch.name = b.name;
  }
  if (b.colour !== undefined) patch.colour = b.colour;
  if (b.childIds !== undefined) {
    // Only NEW members have to be active students right now; existing ones are tidied when they leave.
    const want = [...new Set(b.childIds)];
    const fresh = want.filter((c) => !(cur.childIds ?? []).includes(c));
    if (!(await eligibleStudents(ctx, fresh))) { res.status(404).json({ error: "Student not found — groups are made of your enrolled students" }); return; }
    patch.childIds = want;
  }
  await groupsCol.doc(cur.id).update(patch);
  res.json(await rowOut(ctx, { ...cur, ...patch } as Group));
});

// DELETE /groups/:id — the group only; homework and lessons already sent to it keep their students.
hubGroupsApi.delete("/groups/:id", async (req, res) => {
  const ctx = await resolveCtx(req, res);
  if (!ctx || !requireEdit(ctx, res)) return;
  const cur = await editableGroup(ctx, req.params.id, res);
  if (!cur) return;
  await groupsCol.doc(cur.id).delete();
  // Tidy the "sent to group" labels (best-effort; the display just skips a group that no longer exists).
  void (async () => {
    try {
      for (const col of [homeworkCol, lessonsCol]) {
        const snap = await col.where("tenantId", "==", ctx.tenantId).get();
        const hit = snap.docs.filter((d) => ((d.get("groupIds") as string[] | undefined) ?? []).includes(cur.id));
        for (let i = 0; i < hit.length; i += 400) {
          const b = db.batch();
          for (const d of hit.slice(i, i + 400)) b.update(d.ref, { groupIds: (d.get("groupIds") as string[]).filter((g) => g !== cur.id) });
          await b.commit();
        }
      }
    } catch { /* best-effort */ }
  })();
  res.json({ ok: true });
});
