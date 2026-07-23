import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { db } from "../firebase";
import type { Role } from "../middleware/role";

// Meal ordering (parent-facing meals shop). Operators publish a menu of
// orderable meals (name + price); a parent who's booked with that provider
// builds a basket and places an order for a child on a date. Prices are ALWAYS
// server-computed. The order is placed Unpaid — the provider collects and
// records payment (online card capture reuses the deferred-Stripe pattern the
// booking checkout uses; not wired here yet). Tenant-scoped, realtime.
export const mealOptions = Router();
export const mealOrders = Router();
const optionsCol = db.collection("mealOptions");
const ordersCol = db.collection("mealOrders");
const canManage = (role: Role) => role === "company" || role === "freelancer" || role === "franchise";
const round2 = (n: number) => Math.round(n * 100) / 100;

async function hasBooking(tenantId: string, email: string) {
  const snap = await db.collection("bookings").where("tenantId", "==", tenantId).where("email", "==", email).limit(1).get();
  return !snap.empty;
}

// ── Meal options (the orderable menu) ─────────────────────────────────────
const optionSchema = z.object({
  name: z.string().trim().min(1).max(80),
  price: z.number().nonnegative().max(1000),
  description: z.string().trim().max(300).optional(),
  allergens: z.array(z.string().max(40)).max(20).optional(),
  active: z.boolean().default(true),
});

// GET /api/meal-options — operator: own menu; parent: a booked provider's
// active menu (?tenantId=); platform: ?tenantId=.
mealOptions.get("/", async (req, res) => {
  const auth = req.auth!;
  if (auth.role === "parent") {
    const email = req.user?.email;
    const tenantId = typeof req.query.tenantId === "string" ? req.query.tenantId : null;
    if (!email || !tenantId) { res.status(400).json({ error: "Pass ?tenantId=" }); return; }
    if (!(await hasBooking(tenantId, email))) { res.status(403).json({ error: "You can only order from a provider you've booked with" }); return; }
    const snap = await optionsCol.where("tenantId", "==", tenantId).where("active", "==", true).get();
    res.json(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Record<string, unknown>) })));
    return;
  }
  const tenantId = auth.role === "platform" ? (typeof req.query.tenantId === "string" ? req.query.tenantId : null) : auth.tenantId;
  if (!tenantId || (auth.role !== "platform" && !canManage(auth.role))) { res.status(403).json({ error: "Requires an operator account" }); return; }
  const snap = await optionsCol.where("tenantId", "==", tenantId).get();
  const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Record<string, unknown>) })) as (Record<string, unknown> & { name?: string })[];
  list.sort((a, b) => (`${a.name ?? ""}` < `${b.name ?? ""}` ? -1 : 1));
  res.json(list);
});

mealOptions.post("/", async (req, res) => {
  const auth = req.auth!;
  if (!canManage(auth.role) || !auth.tenantId) { res.status(403).json({ error: "Requires an operator account" }); return; }
  const parsed = optionSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues }); return; }
  const doc = { ...parsed.data, price: round2(parsed.data.price), tenantId: auth.tenantId, createdAt: new Date().toISOString() };
  const ref = await optionsCol.add(doc);
  res.status(201).json({ id: ref.id, ...doc });
});

async function ownOption(req: Request, id: string) {
  const auth = req.auth!;
  if (!canManage(auth.role) || !auth.tenantId) return { status: 403 as const };
  const snap = await optionsCol.doc(id).get();
  if (!snap.exists || snap.data()!.tenantId !== auth.tenantId) return { status: 404 as const };
  return { status: 200 as const, snap };
}

mealOptions.put("/:id", async (req, res) => {
  const o = await ownOption(req, req.params.id);
  if (o.status !== 200) { res.status(o.status).json({ error: o.status === 403 ? "Requires an operator account" : "Meal not found" }); return; }
  const parsed = optionSchema.partial().safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues }); return; }
  const patch = { ...parsed.data, ...(parsed.data.price !== undefined ? { price: round2(parsed.data.price) } : {}) };
  await o.snap.ref.set(patch, { merge: true });
  const after = await o.snap.ref.get();
  res.json({ id: after.id, ...after.data() });
});

mealOptions.delete("/:id", async (req, res) => {
  const o = await ownOption(req, req.params.id);
  if (o.status !== 200) { res.status(o.status).json({ error: o.status === 403 ? "Requires an operator account" : "Meal not found" }); return; }
  await o.snap.ref.delete();
  res.json({ ok: true });
});

// ── Meal orders ───────────────────────────────────────────────────────────
const orderSchema = z.object({
  tenantId: z.string().min(1).max(60),
  date: z.string().max(10),
  childName: z.string().trim().min(1).max(80),
  childId: z.string().max(60).optional(),
  items: z.array(z.object({ optionId: z.string().min(1).max(60), qty: z.number().int().min(1).max(20) })).min(1).max(20),
});

function operatorScope(req: Request, res: Response): string | null {
  const auth = req.auth!;
  if (auth.role === "platform") {
    const t = typeof req.query.tenantId === "string" ? req.query.tenantId : null;
    if (!t) { res.status(400).json({ error: "Platform: pass ?tenantId=" }); return null; }
    return t;
  }
  if (!canManage(auth.role) || !auth.tenantId) { res.status(403).json({ error: "Requires an operator account" }); return null; }
  return auth.tenantId;
}

// GET /api/meal-orders — parent: own orders; operator: the tenant's (?date=).
mealOrders.get("/", async (req, res) => {
  const auth = req.auth!;
  if (auth.role === "parent") {
    const email = req.user?.email;
    if (!email) { res.status(400).json({ error: "Account has no email address" }); return; }
    const snap = await ordersCol.where("parentEmail", "==", email.toLowerCase()).get();
    const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Record<string, unknown>) })) as (Record<string, unknown> & { createdAt?: string })[];
    list.sort((a, b) => (`${b.createdAt ?? ""}` < `${a.createdAt ?? ""}` ? -1 : 1));
    res.json(list);
    return;
  }
  const tenantId = operatorScope(req, res);
  if (!tenantId) return;
  let q = ordersCol.where("tenantId", "==", tenantId) as FirebaseFirestore.Query;
  if (typeof req.query.date === "string") q = q.where("date", "==", req.query.date);
  const snap = await q.get();
  const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Record<string, unknown>) })) as (Record<string, unknown> & { createdAt?: string })[];
  list.sort((a, b) => (`${b.createdAt ?? ""}` < `${a.createdAt ?? ""}` ? -1 : 1));
  res.json(list);
});

// POST /api/meal-orders — a parent places an order (prices computed here).
mealOrders.post("/", async (req, res) => {
  const auth = req.auth!;
  if (auth.role !== "parent") { res.status(403).json({ error: "Only families place meal orders" }); return; }
  const email = req.user?.email;
  if (!email) { res.status(400).json({ error: "Account has no email address" }); return; }
  const parsed = orderSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues }); return; }
  const input = parsed.data;
  if (!(await hasBooking(input.tenantId, email))) { res.status(403).json({ error: "You can only order from a provider you've booked with" }); return; }

  // Resolve every option from the server — the client never sends a price.
  const optionDocs = await db.getAll(...input.items.map((i) => optionsCol.doc(i.optionId)));
  const items: { optionId: string; name: string; price: number; qty: number; lineTotal: number }[] = [];
  for (let idx = 0; idx < input.items.length; idx++) {
    const i = input.items[idx];
    const optDoc = optionDocs[idx];
    if (!optDoc.exists || optDoc.data()!.tenantId !== input.tenantId || optDoc.data()!.active === false) {
      res.status(400).json({ error: `One of the meals isn't available any more — refresh the menu` });
      return;
    }
    const price = round2(optDoc.data()!.price as number);
    items.push({ optionId: i.optionId, name: optDoc.data()!.name as string, price, qty: i.qty, lineTotal: round2(price * i.qty) });
  }
  const total = round2(items.reduce((s, x) => s + x.lineTotal, 0));
  if (total <= 0) { res.status(400).json({ error: "Nothing to order" }); return; }

  const doc = {
    tenantId: input.tenantId,
    parentEmail: email.toLowerCase(),
    parentName: req.user?.name ?? email,
    childName: input.childName,
    ...(input.childId ? { childId: input.childId } : {}),
    date: input.date,
    items,
    total,
    status: "placed" as const,
    pay: "Unpaid" as const,
    amountPaid: 0,
    createdAt: new Date().toISOString(),
  };
  const ref = await ordersCol.add(doc);
  res.status(201).json({ id: ref.id, ...doc });
});

// POST /api/meal-orders/:id/pay — the provider records payment (Paid).
mealOrders.post("/:id/pay", async (req, res) => {
  const auth = req.auth!;
  if (!canManage(auth.role) || !auth.tenantId) { res.status(403).json({ error: "Requires an operator account" }); return; }
  const snap = await ordersCol.doc(req.params.id).get();
  if (!snap.exists || snap.data()!.tenantId !== auth.tenantId) { res.status(404).json({ error: "Order not found" }); return; }
  if (snap.data()!.status === "cancelled") { res.status(409).json({ error: "This order was cancelled" }); return; }
  await snap.ref.set({ pay: "Paid", amountPaid: snap.data()!.total ?? 0, paidAt: new Date().toISOString() }, { merge: true });
  const after = await snap.ref.get();
  res.json({ id: after.id, ...after.data() });
});

// POST /api/meal-orders/:id/cancel — the parent (own, unpaid) or the provider.
mealOrders.post("/:id/cancel", async (req, res) => {
  const auth = req.auth!;
  const snap = await ordersCol.doc(req.params.id).get();
  if (!snap.exists) { res.status(404).json({ error: "Order not found" }); return; }
  const o = snap.data() as { tenantId: string; parentEmail: string; pay: string };
  const email = req.user?.email?.toLowerCase();
  const isOperator = canManage(auth.role) && auth.tenantId === o.tenantId;
  const isOwner = auth.role === "parent" && o.parentEmail === email;
  if (!isOperator && !isOwner) { res.status(404).json({ error: "Order not found" }); return; }
  if (isOwner && o.pay === "Paid") { res.status(409).json({ error: "This order is paid — ask the provider to cancel it" }); return; }
  await snap.ref.set({ status: "cancelled" }, { merge: true });
  res.json({ ok: true });
});
