import { Router, type Request } from "express";
import { z } from "zod";
import { db } from "../firebase";
import type { Role } from "../middleware/role";

// Deployment — who works at which location (and which listings there).
//
// Team → Deployment kept this in the operator's browser only (localStorage
// "aos.locstaff.v2") and nothing else read it, so "only assigned staff offered
// for that site's shifts" never happened (acceptance test d23s1). It's stored
// here now, and the Schedule reads it when filling a shift.
//   GET /api/location-staff  → { staff: saved list | null, team: the joined staff
//                               (with the location/listing choice from their invite) }
//   PUT /api/location-staff  { staff } — save the whole list
// Managers only. Scope: tenant, or tenant__fr__franchise for a franchise.

export const locationStaff = Router();
const col = db.collection("locationStaff");
const canManage = (role: Role) => role === "company" || role === "freelancer" || role === "franchise";
const keyOf = (req: Request) => (req.auth!.franchiseId ? `${req.auth!.tenantId}__fr__${req.auth!.franchiseId}` : req.auth!.tenantId!);

const entry = z.object({
  id: z.string().min(1).max(120),
  name: z.string().trim().min(1).max(120),
  role: z.string().max(120).optional(),
  uid: z.string().max(128).optional(),
  // venue ids (from the library) and listing ids; empty listings = all listings at those sites
  sites: z.array(z.string().max(120)).max(500).default([]),
  listings: z.array(z.string().max(120)).max(1_000).default([]),
  // on the team but never placed — the Schedule applies no rule to them yet
  unset: z.boolean().optional(),
});

locationStaff.get("/", async (req, res) => {
  const auth = req.auth!;
  if (!auth.tenantId || !canManage(auth.role)) { res.status(403).json({ error: "Only a manager can see deployment" }); return; }
  const [doc, users] = await Promise.all([
    col.doc(keyOf(req)).get(),
    db.collection("users").where("tenantId", "==", auth.tenantId).where("role", "==", "staff").get(),
  ]);
  // Head office deploys its own staff; each franchise its own.
  const team = users.docs
    .filter((u) => u.get("disabled") !== true && ((u.get("franchiseId") as string | null | undefined) ?? null) === (auth.franchiseId ?? null))
    .map((u) => ({
      uid: u.id,
      name: String(u.get("name") ?? u.get("email") ?? "").trim(),
      role: String(u.get("jobTitle") ?? u.get("staffRole") ?? ""),
      assignment: (u.get("assignment") ?? null) as { mode: string; ids: string[] } | null,
    }))
    .filter((p) => p.name);
  res.json({ staff: (doc.get("staff") as unknown[] | undefined) ?? null, team });
});

locationStaff.put("/", async (req, res) => {
  const auth = req.auth!;
  if (!auth.tenantId || !canManage(auth.role)) { res.status(403).json({ error: "Only a manager can change deployment" }); return; }
  const parsed = z.object({ staff: z.array(entry).max(1_000) }).safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues }); return; }
  await col.doc(keyOf(req)).set({ tenantId: auth.tenantId, franchiseId: auth.franchiseId ?? null, staff: parsed.data.staff, updatedAt: new Date().toISOString(), updatedBy: req.user?.email ?? null });
  res.json({ ok: true });
});
