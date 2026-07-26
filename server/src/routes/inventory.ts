import { Router, type Request } from "express";
import { z } from "zod";
import { db } from "../firebase";
import type { Role } from "../middleware/role";

// Inventory — the operator's kit & stock: what they hold, where it's stored,
// how many, which season it belongs to, and when it was last counted. Supports
// a stock-check (updates the count + auto-stamps the time) and carrying a
// season's items over to the next. Tenant-scoped; operators + staff use.
export const inventory = Router();
const col = db.collection("inventory");
const canUse = (role: Role) => role === "staff" || role === "company" || role === "freelancer" || role === "franchise";
const canManage = (role: Role) => role === "company" || role === "freelancer" || role === "franchise";

const itemSchema = z.object({
  name: z.string().trim().min(1).max(160),
  category: z.string().trim().max(80).optional(),
  location: z.string().trim().max(120).optional(),
  quantity: z.number().nonnegative().max(1_000_000).default(0),
  unit: z.string().trim().max(24).optional(),
  minQty: z.number().nonnegative().max(1_000_000).optional(),
  season: z.string().trim().max(60).optional(),
  notes: z.string().trim().max(2_000).optional(),
});

inventory.get("/", async (req, res) => {
  const auth = req.auth!;
  if (!auth.tenantId || !canUse(auth.role)) { res.status(403).json({ error: "Forbidden" }); return; }
  const snap = await col.where("tenantId", "==", auth.tenantId).get();
  const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Record<string, unknown>) })) as (Record<string, unknown> & { name?: string })[];
  list.sort((a, b) => (`${a.name}` < `${b.name}` ? -1 : 1));
  res.json(list);
});

inventory.post("/", async (req, res) => {
  const auth = req.auth!;
  if (!auth.tenantId || !canUse(auth.role)) { res.status(403).json({ error: "Forbidden" }); return; }
  const parsed = itemSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues }); return; }
  const doc = { ...parsed.data, tenantId: auth.tenantId, createdBy: req.user?.email ?? "unknown", createdByName: req.user?.name ?? req.user?.email ?? "Staff", createdAt: new Date().toISOString(), lastCheckedAt: null as string | null, lastCheckedBy: null as string | null };
  const ref = await col.add(doc);
  res.status(201).json({ id: ref.id, ...doc });
});

async function own(req: Request, id: string) {
  const auth = req.auth!;
  if (!auth.tenantId || !canUse(auth.role)) return { status: 403 as const };
  const snap = await col.doc(id).get();
  if (!snap.exists || snap.data()!.tenantId !== auth.tenantId) return { status: 404 as const };
  return { status: 200 as const, snap };
}

inventory.put("/:id", async (req, res) => {
  const o = await own(req, req.params.id);
  if (o.status !== 200) { res.status(o.status).json({ error: o.status === 403 ? "Forbidden" : "Item not found" }); return; }
  const parsed = itemSchema.partial().safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues }); return; }
  await o.snap.ref.set({ ...parsed.data, updatedAt: new Date().toISOString() }, { merge: true });
  const after = await o.snap.ref.get();
  res.json({ id: after.id, ...after.data() });
});

// Stock check — record the counted quantity and auto-stamp who/when.
const checkSchema = z.object({ quantity: z.number().nonnegative().max(1_000_000) });
inventory.post("/:id/check", async (req, res) => {
  const o = await own(req, req.params.id);
  if (o.status !== 200) { res.status(o.status).json({ error: o.status === 403 ? "Forbidden" : "Item not found" }); return; }
  const parsed = checkSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues }); return; }
  await o.snap.ref.set({ quantity: parsed.data.quantity, lastCheckedAt: new Date().toISOString(), lastCheckedBy: req.user?.name ?? req.user?.email ?? "Staff", updatedAt: new Date().toISOString() }, { merge: true });
  const after = await o.snap.ref.get();
  res.json({ id: after.id, ...after.data() });
});

inventory.delete("/:id", async (req, res) => {
  const o = await own(req, req.params.id);
  if (o.status !== 200) { res.status(o.status).json({ error: o.status === 403 ? "Forbidden" : "Item not found" }); return; }
  if (!canManage(req.auth!.role)) { res.status(403).json({ error: "Only the provider can delete an item" }); return; }
  await o.snap.ref.delete();
  res.json({ ok: true });
});

// Carry a season's items over to the next — copies each item (kit definition +
// current count) into the new season so you don't re-enter everything. Resets
// the last-checked stamp so the new season starts unchecked.
const carrySchema = z.object({ fromSeason: z.string().min(1).max(60), toSeason: z.string().trim().min(1).max(60) });
inventory.post("/carry-over", async (req, res) => {
  const auth = req.auth!;
  if (!auth.tenantId || !canManage(auth.role)) { res.status(403).json({ error: "Forbidden" }); return; }
  const parsed = carrySchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues }); return; }
  const { fromSeason, toSeason } = parsed.data;
  const snap = await col.where("tenantId", "==", auth.tenantId).where("season", "==", fromSeason).get();
  if (snap.empty) { res.json({ copied: 0 }); return; }
  const now = new Date().toISOString();
  const batch = db.batch();
  snap.docs.forEach((d) => {
    const src = d.data();
    const ref = col.doc();
    batch.set(ref, { name: src.name, category: src.category ?? null, location: src.location ?? null, quantity: src.quantity ?? 0, unit: src.unit ?? null, minQty: src.minQty ?? null, notes: src.notes ?? null, season: toSeason, tenantId: auth.tenantId, createdBy: req.user?.email ?? "unknown", createdByName: req.user?.name ?? "Staff", createdAt: now, lastCheckedAt: null, lastCheckedBy: null, carriedFrom: fromSeason });
  });
  await batch.commit();
  res.json({ copied: snap.size });
});
