import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { db } from "../firebase";
import type { Role } from "../middleware/role";
import { toMinutes, ukNow } from "../lib/scheduler";

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
// An order line references EITHER a tenant-wide meal-option (legacy meal shop)
// OR a menu item from a listing's scheduled day-menu (the planner). When any
// line is a menuItemId the order must carry the listingId so the server can
// resolve that day's menu and price it.
const orderItemSchema = z.union([
  z.object({ optionId: z.string().min(1).max(60), qty: z.number().int().min(1).max(20) }),
  z.object({ menuItemId: z.string().min(1).max(60), qty: z.number().int().min(1).max(20) }),
]);
const orderSchema = z.object({
  tenantId: z.string().min(1).max(60),
  listingId: z.string().max(60).optional(),
  date: z.string().max(10),
  childName: z.string().trim().min(1).max(80),
  childId: z.string().max(60).optional(),
  items: z.array(orderItemSchema).min(1).max(20),
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

// GET /api/meal-orders/report — operator meal report. Meals are bought at
// checkout and stored on bookings (booking.mealItems + child + listingId), so
// this reads bookings, not the mealOrders collection. Returns a flat row per
// meal purchased; the client aggregates by day / week / listing / total.
mealOrders.get("/report", async (req, res) => {
  const tenantId = operatorScope(req, res);
  if (!tenantId) return;
  const snap = await db.collection("bookings").where("tenantId", "==", tenantId).get();
  const listingIds = new Set<string>();
  const rows: { listingId: string | null; date: string; child: string; dish: string; price: number }[] = [];
  for (const d of snap.docs) {
    const b = d.data() as { status?: string; child?: string; listingId?: string; mealItems?: { date: string; name: string; price: number }[] };
    if (b.status === "Cancelled") continue;
    for (const it of (b.mealItems ?? [])) rows.push({ listingId: b.listingId ?? null, date: it.date, child: b.child ?? "—", dish: it.name, price: round2(it.price) });
    if (b.listingId) listingIds.add(b.listingId);
  }
  const ids = [...listingIds];
  const lsnaps = ids.length ? await db.getAll(...ids.map((id) => db.collection("listings").doc(id))) : [];
  const lname = new Map(lsnaps.filter((s) => s.exists).map((s) => [s.id, (s.data()!.title as string) || (s.data()!.name as string) || "Listing"]));
  res.json(rows.map((r) => ({ ...r, listingName: r.listingId ? (lname.get(r.listingId) ?? "Listing") : "—" })));
});

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

  // The meal must be for one of the family's OWN children: a profile on the
  // account (childId, or a name matching one), or a child named on one of
  // their bookings with this provider. Free-typed strangers are rejected —
  // the operator side joins allergies/dietary off this identity.
  {
    const uid = req.user!.uid;
    let ok = false;
    if (input.childId) {
      const c = await db.collection("children").doc(input.childId).get();
      ok = c.exists && c.data()!.parentUid === uid;
      if (!ok) { res.status(403).json({ error: "That child isn't on your account" }); return; }
    } else {
      const name = input.childName.trim().toLowerCase();
      const kids = await db.collection("children").where("parentUid", "==", uid).get();
      ok = kids.docs.some((d) => ((d.data() as { name?: string }).name ?? "").trim().toLowerCase() === name);
      if (!ok) {
        const bs = await db.collection("bookings").where("tenantId", "==", input.tenantId).where("email", "==", email.toLowerCase()).get();
        ok = bs.docs.some((d) => {
          const b = d.data() as { child?: string; kids?: { name?: string }[] };
          return (b.child ?? "").trim().toLowerCase() === name || (b.kids ?? []).some((k) => (k.name ?? "").trim().toLowerCase() === name);
        });
      }
      if (!ok) { res.status(400).json({ error: "Pick one of your children — add their profile under My children if they're not listed" }); return; }
    }
  }

  // Settings → Meals: ordering can be switched off entirely, and the order
  // cut-off (hours before the day's first session) is enforced here — the
  // kitchen needs final numbers in time.
  {
    const lib = await db.collection("libraries").doc(input.tenantId).get();
    const meals = ((lib.data()?.settings as { meals?: { ordering?: boolean; orderCutoffHours?: number } } | undefined)?.meals ?? {});
    if (meals.ordering === false) { res.status(403).json({ error: "This provider isn't taking meal orders at the moment" }); return; }
    const cutoffHours = Number(meals.orderCutoffHours ?? 18);
    if (cutoffHours > 0 && /^\d{4}-\d{2}-\d{2}$/.test(input.date)) {
      // The day's earliest session start (09:00 when no block runs that day).
      // Single-field query only — tenantId== plus an endDate range would need
      // a composite index; a tenant's block list is small enough to filter here.
      const blocks = await db.collection("blocks").where("tenantId", "==", input.tenantId).get();
      let earliest: number | null = null;
      for (const b of blocks.docs) {
        for (const s of ((b.data() as { sessions?: { date: string; start: string }[] }).sessions ?? [])) {
          if (s.date !== input.date) continue;
          const m = toMinutes(s.start);
          if (m !== null && (earliest === null || m < earliest)) earliest = m;
        }
      }
      const { date: today, minutes: now } = ukNow();
      const nowAbs = Date.parse(`${today}T00:00:00Z`) + now * 60_000;
      const startAbs = Date.parse(`${input.date}T00:00:00Z`) + (earliest ?? 9 * 60) * 60_000;
      if (nowAbs > startAbs - cutoffHours * 3_600_000) {
        res.status(409).json({ error: `Meal ordering for that day has closed — orders need to be in ${cutoffHours} hours before the session` });
        return;
      }
    }
  }

  // Resolve every line from the server — the client never sends a price.
  type OrderLine = { name: string; price: number; qty: number; lineTotal: number; optionId?: string; menuItemId?: string; allergens?: string[] };
  const items: OrderLine[] = [];
  const usesMenu = input.items.some((i) => "menuItemId" in i);
  if (usesMenu) {
    // Ordering from a listing's scheduled day-menu (the planner). The listing
    // must offer meals on this date, and every line must be an item on that
    // day's menu — prices come from the menu, never the client.
    if (!input.listingId) { res.status(400).json({ error: "This order needs a listing" }); return; }
    const listingSnap = await db.collection("listings").doc(input.listingId).get();
    const listing = listingSnap.data();
    if (!listingSnap.exists || listing!.tenantId !== input.tenantId || !listing!.mealsEnabled) {
      res.status(400).json({ error: "That listing isn't offering meals" }); return;
    }
    const menuId = (listing!.mealPlan as Record<string, string> | undefined)?.[input.date];
    if (!menuId) { res.status(400).json({ error: "There's no menu set for that day" }); return; }
    const menuSnap = await db.collection("mealMenus").doc(menuId).get();
    if (!menuSnap.exists || menuSnap.data()!.tenantId !== input.tenantId) { res.status(400).json({ error: "That day's menu is unavailable — refresh" }); return; }
    const byId = new Map(((menuSnap.data()!.items ?? []) as { id: string; name: string; price: number; allergens?: string[] }[]).map((it) => [it.id, it]));
    for (const i of input.items) {
      if (!("menuItemId" in i)) { res.status(400).json({ error: "Mixed order types aren't supported" }); return; }
      const it = byId.get(i.menuItemId);
      if (!it) { res.status(400).json({ error: "One of the meals isn't on that day's menu any more — refresh" }); return; }
      const price = round2(it.price);
      items.push({ menuItemId: i.menuItemId, name: it.name, price, qty: i.qty, lineTotal: round2(price * i.qty), ...(it.allergens?.length ? { allergens: it.allergens } : {}) });
    }
  } else {
    const optionIds = input.items.map((i) => ("optionId" in i ? i.optionId : ""));
    const optionDocs = await db.getAll(...optionIds.map((id) => optionsCol.doc(id)));
    for (let idx = 0; idx < input.items.length; idx++) {
      const i = input.items[idx];
      if (!("optionId" in i)) { res.status(400).json({ error: "Mixed order types aren't supported" }); return; }
      const optDoc = optionDocs[idx];
      if (!optDoc.exists || optDoc.data()!.tenantId !== input.tenantId || optDoc.data()!.active === false) {
        res.status(400).json({ error: `One of the meals isn't available any more — refresh the menu` });
        return;
      }
      const price = round2(optDoc.data()!.price as number);
      items.push({ optionId: i.optionId, name: optDoc.data()!.name as string, price, qty: i.qty, lineTotal: round2(price * i.qty) });
    }
  }
  const total = round2(items.reduce((s, x) => s + x.lineTotal, 0));
  if (total <= 0) { res.status(400).json({ error: "Nothing to order" }); return; }

  const doc = {
    tenantId: input.tenantId,
    ...(input.listingId ? { listingId: input.listingId } : {}),
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
