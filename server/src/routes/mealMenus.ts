import { Router } from "express";
import { z } from "zod";
import { db } from "../firebase";
import type { Role } from "../middleware/role";

// Saved-menu library (Phase 1 of the meal planner). A menu is a reusable, named
// set of meal items (name + price + allergens). Operators build a library here,
// then (Phase 2) drag menus onto a listing's days. Tenant-scoped, realtime.
export const mealMenus = Router();
const menusCol = db.collection("mealMenus");
const canManage = (role: Role) => role === "company" || role === "freelancer" || role === "franchise";
const round2 = (n: number) => Math.round(n * 100) / 100;

const itemSchema = z.object({
  id: z.string().trim().min(1).max(60),
  name: z.string().trim().min(1).max(80),
  price: z.number().nonnegative().max(1000),
  allergens: z.array(z.string().max(40)).max(20).default([]),
  description: z.string().trim().max(200).optional(),
});
const menuSchema = z.object({
  name: z.string().trim().min(1).max(80),
  items: z.array(itemSchema).max(40).default([]),
});

const normItems = (items: z.infer<typeof itemSchema>[]) => items.map((i) => ({ ...i, price: round2(i.price) }));

// GET /api/meal-menus — the tenant's saved menus (operator/staff).
mealMenus.get("/", async (req, res) => {
  const auth = req.auth!;
  if (!auth.tenantId) { res.status(403).json({ error: "Requires a tenant account" }); return; }
  const snap = await menusCol.where("tenantId", "==", auth.tenantId).get();
  const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Record<string, unknown>) })) as (Record<string, unknown> & { name?: string })[];
  list.sort((a, b) => ((a.name ?? "") < (b.name ?? "") ? -1 : 1));
  res.json(list);
});

// POST /api/meal-menus — create a saved menu.
mealMenus.post("/", async (req, res) => {
  const auth = req.auth!;
  if (!auth.tenantId || !canManage(auth.role)) { res.status(403).json({ error: "Requires an operator account" }); return; }
  const parsed = menuSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues }); return; }
  const doc = { name: parsed.data.name, items: normItems(parsed.data.items), tenantId: auth.tenantId, createdAt: new Date().toISOString() };
  const ref = await menusCol.add(doc);
  res.status(201).json({ id: ref.id, ...doc });
});

// PUT /api/meal-menus/:id — rename / edit items.
mealMenus.put("/:id", async (req, res) => {
  const auth = req.auth!;
  if (!auth.tenantId || !canManage(auth.role)) { res.status(403).json({ error: "Requires an operator account" }); return; }
  const ref = menusCol.doc(req.params.id);
  const snap = await ref.get();
  if (!snap.exists || snap.data()!.tenantId !== auth.tenantId) { res.status(404).json({ error: "Menu not found" }); return; }
  const parsed = menuSchema.partial().safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues }); return; }
  const patch = { ...parsed.data, ...(parsed.data.items ? { items: normItems(parsed.data.items) } : {}) };
  await ref.set(patch, { merge: true });
  res.json({ id: ref.id, ...(await ref.get()).data() });
});

// DELETE /api/meal-menus/:id
mealMenus.delete("/:id", async (req, res) => {
  const auth = req.auth!;
  if (!auth.tenantId || !canManage(auth.role)) { res.status(403).json({ error: "Requires an operator account" }); return; }
  const ref = menusCol.doc(req.params.id);
  const snap = await ref.get();
  if (!snap.exists || snap.data()!.tenantId !== auth.tenantId) { res.status(404).json({ error: "Menu not found" }); return; }
  await ref.delete();
  res.json({ ok: true });
});
