import { randomBytes } from "node:crypto";
import { Router } from "express";
import { z } from "zod";
import { db } from "../firebase";
import { emailTeamInvite } from "../lib/emails";
import { webUrl } from "../lib/stripe";

// Invite links — how franchises and staff join a tenant. With an `email`
// the invite is delivered directly; without one the operator copies the
// link and sends it themselves.
//
//   POST /api/invites                    (operator) create → {token, url}
//   GET  /api/invites/:token             (public)   preview before signup
//   POST /api/invites/:token/accept      (authed)   join the tenant
export const invites = Router();

// Public preview — mounted separately WITHOUT auth (the token is the secret).
export const invitePreview = Router();

const col = db.collection("invites");

const createSchema = z.object({
  role: z.enum(["franchise", "staff"]),
  // Optional — when given, the invite is emailed to this address as well as
  // returned as a link.
  email: z.string().trim().email().max(160).optional(),
});

invites.post("/", async (req, res) => {
  const auth = req.auth!;
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues });
    return;
  }
  const invitedRole = parsed.data.role;
  // Who may invite whom: company → franchise|staff; franchise/freelancer → staff.
  const allowed =
    auth.role === "company" ||
    ((auth.role === "franchise" || auth.role === "freelancer") && invitedRole === "staff");
  if (!allowed || !auth.tenantId) {
    res.status(403).json({ error: "Your account cannot create this invite" });
    return;
  }

  const token = randomBytes(16).toString("hex");
  const sentTo = parsed.data.email ?? null;
  await col.doc(token).set({
    tenantId: auth.tenantId,
    role: invitedRole,
    createdBy: req.user!.uid,
    createdAt: new Date().toISOString(),
    usedBy: null,
    sentTo,
  });
  if (sentTo) {
    const tenant = await db.collection("tenants").doc(auth.tenantId).get();
    emailTeamInvite({
      to: sentTo,
      tenantName: (tenant.data()?.name as string | undefined) ?? "Your provider",
      role: invitedRole,
      link: `${webUrl}/signup?invite=${token}`,
      inviterName: req.user?.name ?? req.user?.email ?? undefined,
    });
  }
  res.status(201).json({ token, url: `/signup?invite=${token}`, sentTo });
});

// List this tenant's invites (same permission as creating them).
invites.get("/", async (req, res) => {
  const auth = req.auth!;
  if (!auth.tenantId || !["company", "franchise", "freelancer"].includes(auth.role)) {
    res.status(403).json({ error: "Your account cannot list invites" });
    return;
  }
  const snap = await col.where("tenantId", "==", auth.tenantId).get();
  const list = snap.docs.map((d) => ({
    token: d.id,
    ...(d.data() as { role: string; createdAt: string; usedBy: string | null }),
  }));
  list.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  res.json(list);
});

invitePreview.get("/:token", async (req, res) => {
  const snap = await col.doc(req.params.token).get();
  if (!snap.exists) {
    res.status(404).json({ error: "Invite not found" });
    return;
  }
  const d = snap.data()!;
  if (d.usedBy) {
    res.status(410).json({ error: "Invite already used" });
    return;
  }
  const tenant = await db.collection("tenants").doc(d.tenantId).get();
  res.json({
    role: d.role,
    tenantName: tenant.exists ? tenant.data()!.name : "Unknown provider",
  });
});

invites.post("/:token/accept", async (req, res) => {
  const user = req.user!;
  const inviteRef = col.doc(req.params.token);
  const userRef = db.collection("users").doc(user.uid);

  try {
    const result = await db.runTransaction(async (tx) => {
      const [inviteSnap, userSnap] = await Promise.all([tx.get(inviteRef), tx.get(userRef)]);
      if (!inviteSnap.exists) throw new HttpError(404, "Invite not found");
      const invite = inviteSnap.data()!;
      if (invite.usedBy) throw new HttpError(410, "Invite already used");
      if (userSnap.exists && userSnap.data()!.chosen)
        throw new HttpError(409, "Account type already set");

      tx.set(userRef, {
        email: user.email ?? null,
        role: invite.role,
        chosen: true,
        tenantId: invite.tenantId,
        // A franchise account IS its own franchise scope within the tenant.
        ...(invite.role === "franchise" ? { franchiseId: user.uid } : {}),
      });
      tx.update(inviteRef, { usedBy: user.uid, usedAt: new Date().toISOString() });
      return { role: invite.role, tenantId: invite.tenantId };
    });
    res.json(result);
  } catch (e) {
    if (e instanceof HttpError) res.status(e.status).json({ error: e.message });
    else throw e;
  }
});

class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
