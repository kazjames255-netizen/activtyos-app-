import { randomBytes } from "node:crypto";
import { Router } from "express";
import { z } from "zod";
import { auth as authAdmin, db } from "../firebase";
import { emailTeamInvite } from "../lib/emails";
import { webUrl } from "../lib/stripe";
import { notifyBilling, staffHeadroom, takesStaffSeat, updateMeteredQuantities, type SubRecord } from "../lib/billing";
import { forgetRevocation } from "../middleware/auth";
import { ukToday } from "../lib/ukDate";

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

// The head office's CURRENT display name — editable name lives in library
// settings (billing.businessName / providerName); the tenant doc's `name` is only
// the original sign-up value. Used on invite previews + the invitation emails so a
// later rename in Setup flows through everywhere.
async function resolveTenantName(tenantId: string): Promise<string> {
  const [tenant, lib] = await Promise.all([
    db.collection("tenants").doc(tenantId).get(),
    db.collection("libraries").doc(tenantId).get(),
  ]);
  const s = (lib.data()?.settings ?? {}) as { providerName?: string; billing?: { businessName?: string } };
  return (
    (s.billing?.businessName || "").trim() ||
    (s.providerName || "").trim() ||
    (tenant.exists ? (tenant.data()!.name as string) : "") ||
    "Your provider"
  );
}

// A drawn territory (one or more polygon areas). Points are {lat,lng} OBJECTS —
// Firestore forbids nested arrays, so a ring can't be an array-of-[lat,lng].
const territoryAreas = z.array(z.object({
  id: z.string().max(40), name: z.string().max(80), color: z.string().max(16),
  rings: z.array(z.object({ lat: z.number(), lng: z.number() })).max(4000),
})).max(50);

const createSchema = z.object({
  role: z.enum(["franchise", "staff"]),
  // Optional — when given, the invite is emailed to this address as well as
  // returned as a link.
  email: z.string().trim().email().max(160).optional(),
  // Franchise invites carry the granted business name + territory (e.g. "London"),
  // set by the head office. Stored on the invite, copied to the user on accept.
  franchiseName: z.string().trim().max(120).optional(),
  franchiseArea: z.string().trim().max(120).optional(),
  // Staff invites: who they are and what they'll do. Team & invites always
  // sent these; the schema dropped them, so the role and assigned listings
  // lived only in the inviting browser and never reached the person's account.
  name: z.string().trim().max(120).optional(),
  staffRole: z.string().trim().max(80).optional(),
  jobTitle: z.string().trim().max(120).optional(),
  assignment: z.object({
    mode: z.enum(["none", "all", "locations", "listings"]),
    ids: z.array(z.string().max(80)).max(200).default([]),
  }).optional(),
  /** Staff only: joins as a lead (see PATCH /:token/lead). */
  lead: z.boolean().optional(),
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

  // Plan enforcement (decision #4): a banded plan hard-caps team size — over
  // it, block with an upgrade prompt. The metered 76+ band has no cap (extra
  // heads bill +£1/staff on acceptance).
  const cap = await staffHeadroom(auth.tenantId);
  if (!cap.ok) {
    res.status(403).json({ error: cap.reason });
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
    // Which network a STAFF invite belongs to — a franchise's own staff carry its
    // franchiseId; a head-office invite is null. Lets head office separate its own
    // team from franchise staff (and link the franchises' staff records).
    franchiseId: auth.role === "franchise" ? auth.franchiseId : null,
    ...(invitedRole === "franchise"
      ? { franchiseName: parsed.data.franchiseName ?? null, franchiseArea: parsed.data.franchiseArea ?? null }
      : {
          name: parsed.data.name ?? null,
          staffRole: parsed.data.staffRole ?? null,
          jobTitle: parsed.data.jobTitle ?? null,
          assignment: parsed.data.assignment ?? null,
          lead: parsed.data.lead === true,
          status: "active",
        }),
  });
  if (sentTo) {
    const lib = await db.collection("libraries").doc(auth.tenantId).get();
    // Settings → Staff & workforce: a personal welcome line for staff invites.
    const inviteMessage = invitedRole === "staff"
      ? (((lib.data()?.settings as { staff?: { inviteMessage?: string } } | undefined)?.staff?.inviteMessage ?? "").trim() || undefined)
      : undefined;
    emailTeamInvite({
      to: sentTo,
      tenantName: await resolveTenantName(auth.tenantId),
      role: invitedRole,
      link: `${webUrl}/signup?invite=${token}`,
      inviterName: req.user?.name ?? req.user?.email ?? undefined,
      message: inviteMessage,
      tenantId: auth.tenantId,
    });
    await col.doc(token).set({ lastSentAt: new Date().toISOString() }, { merge: true });
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
  // A franchisee sees only the invites it created. Head office's invites — above
  // all an unused role:"franchise" token for a DIFFERENT franchisee — must never
  // be listed to one: `token` below IS the signup credential, so listing it is
  // equivalent to handing over the account. Invites carry franchiseId from
  // creation (see the POST handler), so this is just reading what's already there.
  const own = auth.role === "franchise"
    ? snap.docs.filter((d) => (d.data().franchiseId ?? null) === (auth.franchiseId ?? null))
    : snap.docs;
  const list = own.map((d) => {
    const x = d.data();
    return {
      token: d.id,
      role: x.role as string,
      createdAt: x.createdAt as string,
      usedBy: (x.usedBy ?? null) as string | null,
      usedAt: (x.usedAt ?? null) as string | null,
      sentTo: (x.sentTo ?? null) as string | null,
      lastSentAt: (x.lastSentAt ?? null) as string | null,
      franchiseName: (x.franchiseName ?? null) as string | null,
      franchiseArea: (x.franchiseArea ?? null) as string | null,
      franchiseTerritory: (x.franchiseTerritory ?? null) as { areas?: unknown[]; status?: string; by?: string } | null,
      name: (x.name ?? null) as string | null,
      staffRole: (x.staffRole ?? null) as string | null,
      jobTitle: (x.jobTitle ?? null) as string | null,
      assignment: (x.assignment ?? null) as { mode: string; ids: string[] } | null,
      lead: x.lead === true,
      franchiseId: (x.franchiseId ?? null) as string | null,
      status: (x.status ?? "active") as string,
    };
  });
  list.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  res.json(list);
});

// Guard: fetch a pending invite that belongs to this tenant. Returns the doc
// ref + data, or writes the right error and returns null.
async function ownPendingInvite(
  token: string,
  auth: { tenantId?: string | null; role: string; franchiseId?: string | null },
  res: import("express").Response,
) {
  const ref = col.doc(String(token));
  const snap = await ref.get();
  if (!snap.exists) { res.status(404).json({ error: "Invite not found" }); return null; }
  const d = snap.data()!;
  if (d.tenantId !== auth.tenantId || !["company", "franchise", "freelancer"].includes(auth.role)) {
    res.status(403).json({ error: "Not your invite" }); return null;
  }
  // Same tenant is NOT the same franchise. Without this, a franchisee could
  // resend head office's unused franchise invite to an address of its own
  // choosing (POST /:token/resend takes an email), or revoke a sibling's.
  if (auth.role === "franchise" && (d.franchiseId ?? null) !== (auth.franchiseId ?? null)) {
    res.status(403).json({ error: "Not your invite" }); return null;
  }
  return { ref, d };
}

// PATCH /api/invites/:token — head office sets (or clears) the granted territory
// and/or name/area on a not-yet-used franchise invite. This is the "I'll draw the
// patch myself" path: the territory rides on the invite and, on accept, is copied
// to the franchise as PROPOSED BY HEAD OFFICE for the new franchisee to approve.
const patchSchema = z.object({
  franchiseName: z.string().trim().max(120).optional(),
  franchiseArea: z.string().trim().max(120).optional(),
  franchiseTerritory: z.object({ areas: territoryAreas }).nullable().optional(),
});
invites.patch("/:token", async (req, res) => {
  const parsed = patchSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues }); return; }
  const found = await ownPendingInvite(req.params.token, req.auth!, res);
  if (!found) return;
  if (found.d.usedBy) { res.status(410).json({ error: "Invite already used" }); return; }
  const patch: Record<string, unknown> = {};
  if (parsed.data.franchiseName !== undefined) patch.franchiseName = parsed.data.franchiseName || null;
  if (parsed.data.franchiseArea !== undefined) patch.franchiseArea = parsed.data.franchiseArea || null;
  if (parsed.data.franchiseTerritory !== undefined) {
    patch.franchiseTerritory =
      parsed.data.franchiseTerritory && parsed.data.franchiseTerritory.areas.length
        ? { areas: parsed.data.franchiseTerritory.areas, status: "proposed", by: "ho" }
        : null;
  }
  await found.ref.set(patch, { merge: true });
  res.json({ ok: true });
});

// POST /api/invites/:token/resend — re-email the invitation. Uses the address
// already on the invite, or a new one passed in the body (also saved).
const resendSchema = z.object({ email: z.string().trim().email().max(160).optional() });
invites.post("/:token/resend", async (req, res) => {
  const auth = req.auth!;
  const parsed = resendSchema.safeParse(req.body ?? {});
  const found = await ownPendingInvite(req.params.token, req.auth!, res);
  if (!found) return;
  if (found.d.usedBy) { res.status(410).json({ error: "This franchise has already joined." }); return; }
  const to = (parsed.success && parsed.data.email) || (found.d.sentTo as string | null);
  if (!to) { res.status(400).json({ error: "No email on this invite — add one to send it." }); return; }
  emailTeamInvite({
    to,
    tenantName: await resolveTenantName(auth.tenantId!),
    role: found.d.role,
    link: `${webUrl}/signup?invite=${req.params.token}`,
    inviterName: req.user?.name ?? req.user?.email ?? undefined,
    tenantId: auth.tenantId ?? undefined,
  });
  await found.ref.set({ sentTo: to, lastSentAt: new Date().toISOString() }, { merge: true });
  res.json({ sentTo: to });
});

// PATCH /api/invites/:token/status {status} — switch a team member off (or back
// on). This is the route Team & invites has always called; until 12 Sept it
// didn't exist, the call 404'd silently, and "Deactivate" changed a flag in the
// operator's browser while the person kept full access to children's records.
// Now it disables the account they joined with: every API call is refused
// (middleware/role.ts attachRole) and their sessions are revoked.
const statusSchema = z.object({ status: z.enum(["active", "deactivated"]) });
/** Unassign a person's shifts from today on, in every rota of this tenant
 *  (head office's and each franchise's). Returns how many were released. */
async function releaseFutureShifts(tenantId: string, name: string): Promise<number> {
  const who = name.trim().toLowerCase();
  if (!who) return 0;
  const rotas = await db.collection("rotas").where("tenantId", "==", tenantId).get();
  const today = ukToday();
  let n = 0;
  for (const r of rotas.docs) {
    const ids = new Set(((r.get("staff") as { id: string; name?: string }[] | undefined) ?? []).filter((m) => String(m.name ?? "").trim().toLowerCase() === who).map((m) => m.id));
    if (!ids.size) continue;
    const shifts = await db.collection("rotaShifts").where("rotaKey", "==", r.id).get();
    const batch = db.batch();
    for (const sh of shifts.docs) {
      if (!ids.has(sh.get("staffId")) || String(sh.get("date") ?? "") < today) continue;
      batch.update(sh.ref, { staffId: null, releasedFrom: name, releasedAt: new Date().toISOString() });
      n++;
    }
    await batch.commit();
    if (n) await r.ref.set({ updatedAt: new Date().toISOString() }, { merge: true });
  }
  return n;
}

invites.patch("/:token/status", async (req, res) => {
  const parsed = statusSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues }); return; }
  const found = await ownPendingInvite(req.params.token, req.auth!, res);
  if (!found) return;
  const off = parsed.data.status === "deactivated";
  // Switching someone back ON takes a place on the plan again (a joined
  // account re-enabled, or a withdrawn invite re-opened) — same cap as a new
  // invite (acceptance test d19s6). Switching off is never blocked.
  if (!off && found.d.role === "staff" && found.d.status === "deactivated") {
    const cap = await staffHeadroom(req.auth!.tenantId!);
    if (!cap.ok) { res.status(403).json({ error: cap.reason }); return; }
  }
  let released = 0;
  const uid = found.d.usedBy as string | null;
  const at = new Date().toISOString();
  await found.ref.set({ status: parsed.data.status, statusAt: at, statusBy: req.user?.email ?? req.user?.uid ?? null }, { merge: true });
  if (uid) {
    // Only ever the account that joined through THIS invite, in THIS tenant.
    const u = await db.collection("users").doc(uid).get();
    if (u.exists && u.get("tenantId") === req.auth!.tenantId) {
      await u.ref.set({ disabled: off, disabledAt: off ? at : null, disabledBy: off ? (req.user?.email ?? req.user?.uid ?? null) : null }, { merge: true });
      if (off) { await authAdmin.revokeRefreshTokens(uid).catch((e) => console.error("[invites] revoke:", (e as Error).message)); forgetRevocation(uid); }
      // Their future shifts go back to "needs staff" rather than sitting on a
      // rota under someone who's left (acceptance test d16s6).
      if (off) released = await releaseFutureShifts(req.auth!.tenantId!, String(u.get("name") ?? found.d.name ?? "")).catch(() => 0);
    }
  }
  res.json({ ok: true, status: parsed.data.status, account: uid ? (off ? "disabled" : "enabled") : "not joined yet", ...(released ? { shiftsReleased: released } : {}) });
});

// PATCH /api/invites/:token/lead — make a member of staff a lead (or not).
// Every "leads only" setting (medication doses, trip planning, group
// assignment) was enforced as "no staff at all" because the server had no
// idea who the leads were. The flag lives on the invite and on the account
// that joined through it.
const leadSchema = z.object({ lead: z.boolean() });
invites.patch("/:token/lead", async (req, res) => {
  const parsed = leadSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues }); return; }
  const found = await ownPendingInvite(req.params.token, req.auth!, res);
  if (!found) return;
  if (found.d.role !== "staff") { res.status(400).json({ error: "Only staff can be leads" }); return; }
  await found.ref.set({ lead: parsed.data.lead }, { merge: true });
  const uid = found.d.usedBy as string | null;
  if (uid) {
    const u = await db.collection("users").doc(uid).get();
    if (u.exists && u.get("tenantId") === req.auth!.tenantId && u.get("role") === "staff") await u.ref.set({ lead: parsed.data.lead }, { merge: true });
  }
  res.json({ ok: true, lead: parsed.data.lead });
});

// DELETE /api/invites/:token — revoke a pending invite (link stops working).
// A joined franchise can't be deleted this way.
invites.delete("/:token", async (req, res) => {
  const found = await ownPendingInvite(req.params.token, req.auth!, res);
  if (!found) return;
  if (found.d.usedBy) { res.status(409).json({ error: "This franchise has already joined — can't delete the invite." }); return; }
  await found.ref.delete();
  res.json({ ok: true });
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
  // Tell a staff invitee the plan is full BEFORE they make an account for
  // nothing (acceptance re-checks it for real — see the accept route).
  if (d.role === "staff" && d.status !== "deactivated") {
    const full = await planFull(d.tenantId as string);
    if (full) {
      void tellOwnerPlanFull(snap.ref, d, full.limit);
      res.status(409).json({ error: planFullMessage(await resolveTenantName(d.tenantId)), code: "plan_full" });
      return;
    }
  }
  // Show the head office's CURRENT name. The editable business name lives in the
  // library settings (settings.billing.businessName / providerName) — the tenant
  // doc's `name` is only the original sign-up value, so a later rename in
  // onboarding/Setup wouldn't show here if we used it. Mirror tenants.ts's order.
  const [tenant, lib] = await Promise.all([
    db.collection("tenants").doc(d.tenantId).get(),
    db.collection("libraries").doc(d.tenantId).get(),
  ]);
  const s = (lib.data()?.settings ?? {}) as { providerName?: string; billing?: { businessName?: string } };
  const tenantName =
    (s.billing?.businessName || "").trim() ||
    (s.providerName || "").trim() ||
    (tenant.exists ? (tenant.data()!.name as string) : "") ||
    "Unknown provider";
  const terr = d.franchiseTerritory as { areas?: unknown[]; by?: string } | undefined;
  res.json({
    role: d.role,
    tenantName,
    ...(d.role === "franchise"
      ? {
          franchiseName: d.franchiseName ?? null,
          franchiseArea: d.franchiseArea ?? null,
          // True when head office has already drawn the patch — the franchisee will
          // APPROVE it after joining rather than draw their own.
          territoryByHo: !!(terr?.areas?.length && terr.by === "ho"),
        }
      : {}),
  });
});

const acceptSchema = z.object({
  // A joining franchise may confirm/complete the business name + area the head office granted.
  franchiseName: z.string().trim().max(120).optional(),
  franchiseArea: z.string().trim().max(120).optional(),
  // Optional proposed territory drawn at registration (points are {lat,lng} objects — Firestore forbids nested arrays).
  franchiseTerritory: z.object({
    areas: z.array(z.object({
      id: z.string().max(40), name: z.string().max(80), color: z.string().max(16),
      rings: z.array(z.object({ lat: z.number(), lng: z.number() })).max(4000),
    })).max(50),
    status: z.enum(["draft", "proposed", "agreed"]).optional(),
  }).optional(),
});

invites.post("/:token/accept", async (req, res) => {
  const user = req.user!;
  const body = acceptSchema.safeParse(req.body ?? {});
  const override = body.success ? body.data : {};
  const inviteRef = col.doc(req.params.token);
  const userRef = db.collection("users").doc(user.uid);

  try {
    const result = await db.runTransaction(async (tx) => {
      const [inviteSnap, userSnap] = await Promise.all([tx.get(inviteRef), tx.get(userRef)]);
      if (!inviteSnap.exists) throw new HttpError(404, "Invite not found");
      const invite = inviteSnap.data()!;
      if (invite.usedBy) throw new HttpError(410, "Invite already used");
      if (invite.status === "deactivated") throw new HttpError(410, "This invite has been withdrawn");
      // Bound to the address it was sent to. A forwarded link used to be an
      // account with access to children's records for whoever clicked it.
      const sentTo = String(invite.sentTo ?? "").trim().toLowerCase();
      if (sentTo && sentTo !== String(user.email ?? "").trim().toLowerCase())
        throw new HttpError(403, `This invite was sent to ${sentTo}. Sign up with that address, or ask for a new invite.`);
      if (userSnap.exists && userSnap.data()!.chosen)
        throw new HttpError(409, "Account type already set");
      // The plan's staff cap, re-checked at the moment of joining — creation
      // counts pending invites, but a downgrade, a re-enabled leaver or
      // invites sent before that rule can still leave more invites than
      // places (acceptance test d19s6). Read inside the transaction so two
      // people accepting at once can't both take the last place.
      if (invite.role === "staff") {
        const [tenantSnap, teamSnap] = await Promise.all([
          tx.get(db.collection("tenants").doc(invite.tenantId)),
          tx.get(db.collection("users").where("tenantId", "==", invite.tenantId)),
        ]);
        const limit = (tenantSnap.get("subscription") as SubRecord | undefined)?.staffLimit;
        if (limit !== null && limit !== undefined && teamSnap.docs.filter((u) => u.id !== user.uid && takesStaffSeat(u)).length >= limit)
          throw new PlanFullError(limit, invite);
      }

      tx.set(userRef, {
        email: user.email ?? null,
        role: invite.role,
        chosen: true,
        tenantId: invite.tenantId,
        // A franchise account IS its own franchise scope within the tenant.
        // Carry the head-office-granted business name + territory onto the record.
        ...(invite.role === "franchise"
          ? (() => {
              const fName = override.franchiseName || invite.franchiseName || null;
              const fArea = override.franchiseArea || invite.franchiseArea || null;
              // Territory ownership is two-sided:
              //  · franchise draws at sign-up → PROPOSED BY THE FRANCHISE (head office agrees)
              //  · head office drew it on the invite → PROPOSED BY HEAD OFFICE (the franchise approves)
              // Either way it starts "proposed"; the OTHER party signs it off.
              const invTerr = invite.franchiseTerritory as { areas?: unknown[] } | undefined;
              const terr = override.franchiseTerritory
                ? { areas: override.franchiseTerritory.areas, status: override.franchiseTerritory.areas.length ? "proposed" : "draft", by: "franchise" }
                : invTerr?.areas?.length
                  ? { areas: invTerr.areas, status: "proposed", by: "ho" }
                  : null;
              return { franchiseId: user.uid, franchiseName: fName, franchiseArea: fArea, ...(fName ? { name: fName } : {}), ...(terr ? { franchiseTerritory: terr } : {}) };
            })()
          : {
              // A franchise's own staff are scoped to that franchise — without
              // its franchiseId they could read head office's and every sibling
              // franchise's children. Plus the role and assignment chosen on
              // the invite, which used to be dropped on the floor.
              franchiseId: invite.franchiseId ?? null,
              ...(invite.name ? { name: invite.name } : {}),
              ...(invite.staffRole ? { staffRole: invite.staffRole } : {}),
              ...(invite.jobTitle ? { jobTitle: invite.jobTitle } : {}),
              ...(invite.assignment ? { assignment: invite.assignment } : {}),
              lead: invite.lead === true,
            }),
      });
      tx.update(inviteRef, { usedBy: user.uid, usedAt: new Date().toISOString() });
      return { role: invite.role, tenantId: invite.tenantId };
    });
    // The cap was re-checked above; acceptance also updates the metered
    // quantities (76+ staff overage, franchise locations) so the next invoice
    // reflects the new head-count. Fire-and-forget: a Stripe hiccup must
    // never block someone joining a team.
    void updateMeteredQuantities(result.tenantId).catch((e) =>
      console.error("[invites] metered update failed:", (e as Error).message),
    );
    res.json(result);
  } catch (e) {
    if (e instanceof PlanFullError) {
      // The invite stays unused, so the same link works once there's room.
      void tellOwnerPlanFull(inviteRef, e.invite, e.limit);
      res.status(409).json({ error: planFullMessage(await resolveTenantName(String(e.invite.tenantId))), code: "plan_full" });
    } else if (e instanceof HttpError) res.status(e.status).json({ error: e.message });
    else throw e;
  }
});

// ── Plan full at the joining end ─────────────────────────────────────────
/** The staff cap is reached (active staff, not counting pending invites —
 *  this IS a pending invite being used). null = there's room / no cap. */
async function planFull(tenantId: string): Promise<{ limit: number } | null> {
  const t = await db.collection("tenants").doc(tenantId).get();
  const limit = (t.get("subscription") as SubRecord | undefined)?.staffLimit;
  if (limit === null || limit === undefined) return null;
  const team = await db.collection("users").where("tenantId", "==", tenantId).get();
  return team.docs.filter(takesStaffSeat).length >= limit ? { limit } : null;
}

const planFullMessage = (tenantName: string) =>
  `${tenantName}'s ActivityOS plan is full right now, so you can't join just yet. We've let them know — once they free up a place or upgrade, this same invite link will work.`;

/** Tell the owner someone couldn't join. At most once a day per invite — the
 *  preview is public and runs on every page load. Never throws. */
async function tellOwnerPlanFull(ref: FirebaseFirestore.DocumentReference, invite: FirebaseFirestore.DocumentData, limit: number): Promise<void> {
  try {
    const last = Date.parse(String(invite.capBlockedAt ?? ""));
    if (last && Date.now() - last < 86_400_000) return;
    await ref.set({ capBlockedAt: new Date().toISOString() }, { merge: true });
    const who = String(invite.name || invite.sentTo || "A new member of staff");
    await notifyBilling(
      String(invite.tenantId),
      "Someone couldn't join — your plan is full",
      `${who} tried to accept their staff invite, but all ${limit} staff place${limit === 1 ? "" : "s"} on your plan are taken. Upgrade your band in Money → Subscription, or switch off someone who has left in Team & invites — their invite link will then work.`,
    );
  } catch (e) {
    console.error("[invites] plan-full notice failed:", (e as Error).message);
  }
}

class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

class PlanFullError extends HttpError {
  constructor(public limit: number, public invite: FirebaseFirestore.DocumentData) {
    super(409, "plan_full");
  }
}
