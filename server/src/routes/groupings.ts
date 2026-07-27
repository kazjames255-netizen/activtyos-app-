import { Router, type Request } from "express";
import { z } from "zod";
import { db } from "../firebase";
import type { Role } from "../middleware/role";

// ─────────────────────────────────────────────────────────────────────────
// Groupings (Register Phase 2) — the allocation board for a listing on a date:
// named/coloured groups, the children in each, staff assigned + a Lead, and a
// lock. Deliberately separate from the day register (the register stays a flat
// list). One doc per {listingId}_{date}, created lazily on first save.
// ─────────────────────────────────────────────────────────────────────────

export const groupings = Router();
const col = db.collection("groupings");
const canEdit = (role: Role) => role === "staff" || role === "company" || role === "freelancer" || role === "franchise";
const docId = (listingId: string, date: string) => `${listingId}_${date}`;

const groupSchema = z.object({
  id: z.string().max(40),
  name: z.string().trim().max(60),
  color: z.string().max(9).optional(),
  staff: z.array(z.string().trim().max(80)).max(20).optional(),
  lead: z.string().trim().max(80).optional(),
  childRefs: z.array(z.string().max(60)).max(200).optional(),
});
const boardSchema = z.object({
  locked: z.boolean().optional(),
  groups: z.array(groupSchema).max(40),
});

function tenantOf(req: Request): { role: Role; tenantId: string | null } | null {
  const auth = req.auth!;
  if (auth.role === "parent") return null;
  if (auth.role === "platform") { const t = typeof req.query.tenantId === "string" ? req.query.tenantId : null; return { role: auth.role, tenantId: t }; }
  return auth.tenantId ? { role: auth.role, tenantId: auth.tenantId } : null;
}

// GET /api/groupings?listingId=&date= — the board (empty groups if none yet).
groupings.get("/", async (req, res) => {
  const scope = tenantOf(req);
  if (!scope || !scope.tenantId) { res.status(403).json({ error: "Requires an operator or staff account" }); return; }
  const listingId = typeof req.query.listingId === "string" ? req.query.listingId : "";
  const date = typeof req.query.date === "string" ? req.query.date : "";
  if (!listingId || !date) { res.status(400).json({ error: "Pass ?listingId=&date=" }); return; }
  const snap = await col.doc(docId(listingId, date)).get();
  if (!snap.exists || snap.data()!.tenantId !== scope.tenantId) { res.json({ listingId, date, locked: false, groups: [] }); return; }
  const d = snap.data()!;
  res.json({ listingId, date, locked: d.locked ?? false, groups: d.groups ?? [] });
});

// PUT /api/groupings/:listingId/:date — save the whole board.
groupings.put("/:listingId/:date", async (req, res) => {
  const scope = tenantOf(req);
  if (!scope || !scope.tenantId || !canEdit(scope.role)) { res.status(403).json({ error: "Requires an operator or staff account" }); return; }
  const parsed = boardSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues }); return; }
  const { listingId, date } = req.params;
  // The listing must belong to the tenant.
  const listing = await db.collection("listings").doc(listingId).get();
  if (!listing.exists || listing.data()!.tenantId !== scope.tenantId) { res.status(404).json({ error: "Listing not found" }); return; }
  await col.doc(docId(listingId, date)).set({
    tenantId: scope.tenantId, listingId, date,
    locked: parsed.data.locked ?? false,
    groups: parsed.data.groups,
    updatedAt: new Date().toISOString(),
    updatedBy: req.user?.name ?? req.user?.email ?? "Staff",
  }, { merge: true });
  res.json({ ok: true });
});
