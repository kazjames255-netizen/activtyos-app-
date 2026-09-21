import { randomBytes } from "node:crypto";
import { Router } from "express";
import { z } from "zod";
import { db } from "../../firebase";
import { customerAreaOn } from "../../lib/customerArea";
import { canSeeStudent, canWriteRow, forgetEnrolments, hubConfig, hubEnrolments, okId, requireEdit, resolveCtx, type EnrolmentDoc } from "../../lib/hubCore";
import { forgetHub } from "../../lib/hubCache";
import { inList, yearGroupFromDob } from "../../lib/hubRules";
import { resolveTutor } from "./tutorsApi";

// Learning Hub — FAMILY INVITES (F13). A tutor whose family has never booked (a pure tutoring business) makes a link;
// the parent opens it while signed in to their parent account, picks which of THEIR children to enrol, and the enrolment
// is created for them. Nothing else about the family is created or exposed:
//  · the token is the secret (128 bits); it is bound to the FIRST parent account that accepts it (a link forwarded on can't be
//    used by someone else) and expires after 30 days; a tutor can revoke it any time;
//  · the parent can only enrol children on THEIR OWN account (children.parentUid), never anyone else's;
//  · no email is sent from here — the tutor shares the link themselves.

export const hubFamilyInvitesApi = Router();

const col = db.collection("hubFamilyInvites");
const TTL_MS = 30 * 86_400_000;

interface InviteDoc {
  tenantId: string; franchiseId: string | null;
  createdBy: string; createdByName: string; createdAt: string; expiresAt: string;
  forName: string; subjects: string[]; yearGroup: string | null;
  tutorUid: string | null; tutorName: string;
  claimedBy: string | null; claimedAt: string | null; childIds: string[]; childNames: string[];
  revoked: boolean;
}

const statusOf = (d: InviteDoc, now = Date.now()): "pending" | "claimed" | "expired" | "revoked" =>
  d.revoked ? "revoked" : d.claimedBy ? "claimed" : new Date(d.expiresAt).getTime() < now ? "expired" : "pending";

const createBody = z.object({
  forName: z.string().trim().max(120).default(""),
  subjects: z.array(z.string().trim().min(1).max(80)).max(30).default([]),
  yearGroup: z.string().trim().min(1).max(40).nullable().optional(),
  tutorUid: z.string().max(100).nullable().optional(),
});

const rowOut = (id: string, d: InviteDoc) => {
  const status = statusOf(d);
  return {
    // the token is a credential: only a link still to be used is handed back
    token: status === "pending" ? id : null, id, status, forName: d.forName, subjects: d.subjects, yearGroup: d.yearGroup ?? null, tutorName: d.tutorName,
    createdAt: d.createdAt, expiresAt: d.expiresAt, claimedAt: d.claimedAt, childNames: d.childNames ?? [],
  };
};

// POST /family-invites {forName?, subjects?, yearGroup?, tutorUid?} → {token, url, …}
hubFamilyInvitesApi.post("/family-invites", async (req, res) => {
  const ctx = await resolveCtx(req, res);
  if (!ctx || !requireEdit(ctx, res)) return;
  const parsed = createBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues }); return; }
  const b = parsed.data;
  let tutor: { uid: string | null; name: string } = req.auth!.role === "staff" ? { uid: ctx.uid, name: ctx.name } : { uid: null, name: "" };
  if (b.tutorUid) {
    const t = await resolveTutor(ctx, b.tutorUid);
    if (!t) { res.status(400).json({ error: "That tutor isn't on your team" }); return; }
    tutor = { uid: t.uid, name: t.name };
  } else if (b.tutorUid === null) tutor = { uid: null, name: "" };
  const now = Date.now();
  const token = randomBytes(16).toString("hex");
  const doc: InviteDoc = {
    tenantId: ctx.tenantId, franchiseId: ctx.franchiseId, createdBy: ctx.uid, createdByName: ctx.name, createdAt: new Date(now).toISOString(), expiresAt: new Date(now + TTL_MS).toISOString(),
    forName: b.forName, subjects: b.subjects, yearGroup: b.yearGroup ?? null, tutorUid: tutor.uid, tutorName: tutor.name,
    claimedBy: null, claimedAt: null, childIds: [], childNames: [], revoked: false,
  };
  await col.doc(token).set(doc);
  res.status(201).json({ ...rowOut(token, doc), token, url: `/custdash/learninghub?invite=${token}` });
});

// GET /family-invites — this business's invites (a franchise sees its own), newest first.
hubFamilyInvitesApi.get("/family-invites", async (req, res) => {
  const ctx = await resolveCtx(req, res);
  if (!ctx || !requireEdit(ctx, res)) return;
  const snap = await col.where("tenantId", "==", ctx.tenantId).get();
  const rows = snap.docs.map((d) => ({ id: d.id, d: d.data() as InviteDoc })).filter((x) => canSeeStudent(ctx, x.d.franchiseId));
  rows.sort((a, b) => b.d.createdAt.localeCompare(a.d.createdAt));
  res.json(rows.slice(0, 100).map((x) => rowOut(x.id, x.d)));
});

// DELETE /family-invites/:token — revoke a link that hasn't been used (a used one is history and stays).
hubFamilyInvitesApi.delete("/family-invites/:token", async (req, res) => {
  const ctx = await resolveCtx(req, res);
  if (!ctx || !requireEdit(ctx, res)) return;
  const t = req.params.token;
  const snap = okId(t) ? await col.doc(t).get() : null;
  const d = snap?.exists ? (snap.data() as InviteDoc) : null;
  if (!snap || !d || d.tenantId !== ctx.tenantId || !canSeeStudent(ctx, d.franchiseId)) { res.status(404).json({ error: "Invite not found" }); return; }
  if (!canWriteRow(ctx, d.franchiseId)) { res.status(403).json({ error: "That invite belongs to head office" }); return; }
  if (d.claimedBy) { res.status(409).json({ error: "That invite has already been used" }); return; }
  await snap.ref.update({ revoked: true });
  res.json({ ok: true });
});

/** A usable invite for this parent, or a refusal already sent. */
async function usable(token: string, uid: string, res: import("express").Response) {
  const snap = okId(token) ? await col.doc(token).get() : null;
  const d = snap?.exists ? (snap.data() as InviteDoc) : null;
  if (!snap || !d) { res.status(404).json({ error: "That invite link isn't valid. Ask your tutor for a new one.", code: "invite_invalid" }); return null; }
  const st = statusOf(d);
  if (st === "revoked") { res.status(410).json({ error: "That invite was withdrawn. Ask your tutor for a new one.", code: "invite_revoked" }); return null; }
  if (st === "expired") { res.status(410).json({ error: "That invite has expired. Ask your tutor for a new one.", code: "invite_expired" }); return null; }
  if (d.claimedBy && d.claimedBy !== uid) { res.status(409).json({ error: "That invite has already been used by another account. Ask your tutor for a new one.", code: "invite_used" }); return null; }
  if (!(await customerAreaOn(d.tenantId, "learninghub", d.franchiseId))) { res.status(409).json({ error: "This tutor hasn't switched My Classroom on yet.", code: "feature_off" }); return null; }
  return { snap, d };
}

const parentOnly = (req: import("express").Request, res: import("express").Response) => {
  if (req.auth?.role !== "parent" || !req.user?.uid) { res.status(403).json({ error: "Open this link while signed in to your ActivityOS parent account." }); return null; }
  return req.user.uid;
};

// GET /family-invites/:token — a parent previews who is inviting them (and which of their children are already in).
hubFamilyInvitesApi.get("/family-invites/:token", async (req, res) => {
  const uid = parentOnly(req, res);
  if (!uid) return;
  const u = await usable(req.params.token, uid, res);
  if (!u) return;
  const [lib, ten] = await Promise.all([db.collection("libraries").doc(u.d.tenantId).get(), db.collection("tenants").doc(u.d.tenantId).get()]);
  const name = ((lib.get("settings.providerName") as string | undefined)?.trim() || (ten.get("name") as string | undefined)?.trim() || "Your tutor");
  res.json({ providerName: name, tutorName: u.d.tutorName, forName: u.d.forName, subjects: u.d.subjects, alreadyEnrolled: u.d.childIds });
});

const acceptBody = z.object({ childId: z.string().min(1).max(100) });

// POST /family-invites/:token/accept {childId} — enrol one of the parent's OWN children with the inviting tutor.
hubFamilyInvitesApi.post("/family-invites/:token/accept", async (req, res) => {
  const uid = parentOnly(req, res);
  if (!uid) return;
  const parsed = acceptBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Choose which child to enrol" }); return; }
  const u = await usable(req.params.token, uid, res);
  if (!u) return;
  const { d } = u;
  const childId = parsed.data.childId;
  const child = okId(childId) ? await db.collection("children").doc(childId).get() : null;
  if (!child?.exists || child.get("parentUid") !== uid || child.get("archived") === true) { res.status(404).json({ error: "Child not found on your account" }); return; }
  const parentEmail = (((await db.collection("users").doc(uid).get()).get("email") as string | undefined) ?? "").trim().toLowerCase();
  const ref = hubEnrolments.doc(`${d.tenantId}__${childId}`);
  const prev = await ref.get();
  if (prev.exists && prev.get("tenantId") !== d.tenantId) { res.status(404).json({ error: "Child not found on your account" }); return; }
  // A tutor who paused this child decided that; a still-valid invite link must not undo it. They re-enrol from the roster.
  if (prev.exists && prev.get("active") === false) { res.status(409).json({ error: "This child's place with this tutor is paused. Ask the tutor to reactivate it." }); return; }
  const dob = typeof child.get("dob") === "string" && child.get("dob") ? (child.get("dob") as string) : null;
  const cfg = await hubConfig(d.tenantId, d.franchiseId);
  const yg = d.yearGroup
    ? { yearGroup: inList(cfg.yearGroups, d.yearGroup) ?? d.yearGroup, yearGroupAuto: false }
    : { yearGroup: yearGroupFromDob(dob, cfg.yearGroups), yearGroupAuto: true };
  const now = new Date().toISOString();
  const alreadyActive = prev.exists && prev.get("active") !== false;
  const doc: EnrolmentDoc = {
    tenantId: d.tenantId, franchiseId: prev.exists ? ((prev.get("franchiseId") as string | null) ?? null) : d.franchiseId,
    childId, childName: (child.get("name") as string) ?? "", parentUid: uid, parentEmail,
    // A child who is already in keeps what the tutor set for them; a new (or re-activated) one gets what the invite says.
    subjects: alreadyActive ? ((prev.get("subjects") as string[] | undefined) ?? []) : d.subjects,
    tutorUid: alreadyActive ? ((prev.get("tutorUid") as string | null) ?? null) : d.tutorUid, tutorName: alreadyActive ? ((prev.get("tutorName") as string | undefined) ?? "") : d.tutorName,
    active: true, ...(alreadyActive && prev.get("yearGroup") !== undefined ? { yearGroup: (prev.get("yearGroup") as string | null) ?? null, yearGroupAuto: prev.get("yearGroupAuto") === true } : yg),
    createdBy: prev.exists ? (prev.get("createdBy") as string) : d.createdBy, createdAt: prev.exists ? (prev.get("createdAt") as string) : now, updatedAt: now,
  };
  const carried: Partial<EnrolmentDoc> = {};
  if (prev.exists && Array.isArray(prev.get("diagnosticWaived"))) carried.diagnosticWaived = prev.get("diagnosticWaived");
  if (prev.exists && Array.isArray(prev.get("retakeGrants"))) carried.retakeGrants = prev.get("retakeGrants");
  await ref.set({ ...doc, ...carried });
  await u.snap.ref.update({
    claimedBy: uid, claimedAt: d.claimedAt ?? now,
    childIds: [...new Set([...(d.childIds ?? []), childId])], childNames: [...new Set([...(d.childNames ?? []), doc.childName])],
  });
  forgetHub(d.tenantId, "roster"); forgetEnrolments();
  res.status(prev.exists ? 200 : 201).json({ ok: true, tenantId: d.tenantId, childId, childName: doc.childName });
});
