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
  const now = new Date().toISOString();
  const by = req.user?.name ?? req.user?.email ?? "Staff";
  const prev = o.snap.data() ?? {};
  const history = Array.isArray(prev.checks) ? (prev.checks as unknown[]) : [];
  // newest-first, keep the last 20
  const checks = [{ quantity: parsed.data.quantity, at: now, by }, ...history].slice(0, 20);
  await o.snap.ref.set({ quantity: parsed.data.quantity, lastCheckedAt: now, lastCheckedBy: by, checks, updatedAt: now }, { merge: true });
  const after = await o.snap.ref.get();
  res.json({ id: after.id, ...after.data() });
});

// Order more of an item — records the order on the item AND creates a matching
// expense in the Expenses ledger (same categories), so a reorder shows as
// money out. status "pending" = owed, "paid" = already paid.
const orderSchema = z.object({ quantity: z.number().nonnegative().max(1_000_000), cost: z.number().nonnegative().max(10_000_000), category: z.string().trim().min(1).max(60), supplier: z.string().trim().max(120).optional(), status: z.enum(["pending", "paid"]).default("pending") });
inventory.post("/:id/order", async (req, res) => {
  const auth = req.auth!;
  if (!canManage(auth.role)) { res.status(403).json({ error: "Only the provider can place an order" }); return; }
  const o = await own(req, req.params.id);
  if (o.status !== 200) { res.status(o.status).json({ error: o.status === 403 ? "Forbidden" : "Item not found" }); return; }
  const parsed = orderSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues }); return; }
  const { quantity, cost, category, supplier, status } = parsed.data;
  const now = new Date().toISOString();
  const item = o.snap.data()!;
  const meta = { tenantId: auth.tenantId, createdBy: req.user?.email ?? "unknown", createdByName: req.user?.name ?? req.user?.email ?? "Operator", createdAt: now };
  // create the expense (mirrors the expenses route's doc shape)
  const expRef = await db.collection("expenses").add({ date: now.slice(0, 10), category, amount: Math.round(cost * 100) / 100, supplier: supplier || undefined, notes: `Stock order — ${quantity} × ${item.name}`, status, ...meta });
  await o.snap.ref.set({ ordered: true, orderQty: quantity, orderCost: cost, orderCategory: category, orderSupplier: supplier ?? null, orderStatus: status, orderedAt: now, orderExpenseId: expRef.id, updatedAt: now }, { merge: true });
  const after = await o.snap.ref.get();
  res.json({ id: after.id, ...after.data() });
});

// Mark an order received — adds the ordered quantity into stock, stamps a
// check, and clears the order flags.
inventory.post("/:id/received", async (req, res) => {
  const o = await own(req, req.params.id);
  if (o.status !== 200) { res.status(o.status).json({ error: o.status === 403 ? "Forbidden" : "Item not found" }); return; }
  const item = o.snap.data()!;
  if (!item.ordered) { res.status(400).json({ error: "Nothing on order for this item" }); return; }
  const now = new Date().toISOString();
  const by = req.user?.name ?? req.user?.email ?? "Staff";
  const newQty = (item.quantity ?? 0) + (item.orderQty ?? 0);
  const history = Array.isArray(item.checks) ? (item.checks as unknown[]) : [];
  const checks = [{ quantity: newQty, at: now, by }, ...history].slice(0, 20);
  await o.snap.ref.set({ quantity: newQty, lastCheckedAt: now, lastCheckedBy: by, checks, ordered: false, orderQty: null, orderCost: null, orderCategory: null, orderSupplier: null, orderStatus: null, orderedAt: null, orderExpenseId: null, receivedAt: now, updatedAt: now }, { merge: true });
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
