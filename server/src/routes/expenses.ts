import { Router, type Request } from "express";
import { z } from "zod";
import { db } from "../firebase";
import { FieldValue } from "firebase-admin/firestore";
import type { Role } from "../middleware/role";

// Expenses (Money) — the provider's outgoings: what was spent, on what, with
// an optional receipt. Operators only (Money is not a staff surface).
// Tenant-scoped, realtime. Platform reads with ?tenantId=.
export const expenses = Router();
const col = db.collection("expenses");
const canManage = (role: Role) => role === "company" || role === "freelancer" || role === "franchise";

const expenseSchema = z.object({
  date: z.string().max(10),
  category: z.string().trim().min(1).max(60),
  amount: z.number().nonnegative(),
  supplier: z.string().trim().max(120).optional(),
  notes: z.string().trim().max(1_000).optional(),
  receiptUrl: z.string().trim().max(600).optional(),
  // Money-out status: a "pending" expense is money you owe (what used to be a
  // bill); "paid" is money that's left. Due date + paidAt support the pending
  // workflow. Defaults to paid so a plain logged spend needs nothing extra.
  status: z.enum(["pending", "paid"]).default("paid"),
  dueDate: z.string().max(10).optional(),
  paidAt: z.string().max(40).optional(),
  // A recurring cost (e.g. weekly venue hire): the client sends the cadence +
  // an end date, and POST materialises one row per occurrence sharing a
  // seriesId so the whole run can be badged and deleted together.
  repeat: z.enum(["weekly", "fortnightly", "monthly"]).optional(),
  repeatUntil: z.string().max(10).optional(),
  seriesId: z.string().trim().max(60).optional(),
});
const round2 = (n: number) => Math.round(n * 100) / 100;
const MAX_OCCURRENCES = 104; // 2 years of weekly — a runaway guard, not a limit users hit
function stepDate(iso: string, repeat: "weekly" | "fortnightly" | "monthly"): string {
  const d = new Date(`${iso}T00:00:00Z`);
  if (repeat === "monthly") d.setUTCMonth(d.getUTCMonth() + 1);
  else d.setUTCDate(d.getUTCDate() + (repeat === "fortnightly" ? 14 : 7));
  return d.toISOString().slice(0, 10);
}

function scope(req: Request, res: import("express").Response): string | null {
  const auth = req.auth!;
  if (auth.role === "platform") {
    const t = typeof req.query.tenantId === "string" ? req.query.tenantId : null;
    if (!t) { res.status(400).json({ error: "Platform: pass ?tenantId=" }); return null; }
    return t;
  }
  if (!canManage(auth.role) || !auth.tenantId) { res.status(403).json({ error: "Requires an operator account" }); return null; }
  return auth.tenantId;
}

expenses.get("/", async (req, res) => {
  const tenantId = scope(req, res);
  if (!tenantId) return;
  const snap = await col.where("tenantId", "==", tenantId).get();
  const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Record<string, unknown>) })) as (Record<string, unknown> & { date?: string; amount?: number; category?: string })[];
  list.sort((a, b) => (`${b.date ?? ""}` < `${a.date ?? ""}` ? -1 : 1));
  const byCategory: Record<string, number> = {};
  for (const e of list) byCategory[e.category ?? "Other"] = round2((byCategory[e.category ?? "Other"] ?? 0) + (e.amount ?? 0));
  res.json({ items: list, summary: { total: round2(list.reduce((s, e) => s + (e.amount ?? 0), 0)), count: list.length, byCategory } });
});

expenses.post("/", async (req, res) => {
  const auth = req.auth!;
  if (!canManage(auth.role) || !auth.tenantId) { res.status(403).json({ error: "Requires an operator account" }); return; }
  const parsed = expenseSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues }); return; }
  const { repeat, repeatUntil, seriesId: _ignore, ...rest } = parsed.data;
  const meta = { tenantId: auth.tenantId, createdBy: req.user?.email ?? "unknown", createdByName: req.user?.name ?? req.user?.email ?? "Operator", createdAt: new Date().toISOString() };
  const base = { ...rest, amount: round2(rest.amount), ...meta };

  // Recurring: fan out one row per occurrence, all sharing a fresh seriesId.
  if (repeat && repeatUntil && repeatUntil > rest.date) {
    const sid = col.doc().id;
    const dates: string[] = [];
    for (let d = rest.date, i = 0; d <= repeatUntil && i < MAX_OCCURRENCES; d = stepDate(d, repeat), i++) dates.push(d);
    const batch = db.batch();
    const items = dates.map((date) => {
      const ref = col.doc();
      const doc = { ...base, date, repeat, repeatUntil, seriesId: sid };
      batch.set(ref, doc);
      return { id: ref.id, ...doc };
    });
    await batch.commit();
    res.status(201).json({ created: items.length, seriesId: sid, items });
    return;
  }

  const ref = await col.add(base);
  res.status(201).json({ id: ref.id, ...base });
});

// Delete a whole recurring series in one go.
expenses.delete("/series/:seriesId", async (req, res) => {
  const auth = req.auth!;
  if (!canManage(auth.role) || !auth.tenantId) { res.status(403).json({ error: "Requires an operator account" }); return; }
  const snap = await col.where("tenantId", "==", auth.tenantId).where("seriesId", "==", req.params.seriesId).get();
  if (snap.empty) { res.status(404).json({ error: "Series not found" }); return; }
  const batch = db.batch();
  snap.docs.forEach((d) => batch.delete(d.ref));
  await batch.commit();
  res.json({ ok: true, deleted: snap.size });
});

async function own(req: Request, id: string) {
  const auth = req.auth!;
  if (!canManage(auth.role) || !auth.tenantId) return { status: 403 as const };
  const snap = await col.doc(id).get();
  if (!snap.exists || snap.data()!.tenantId !== auth.tenantId) return { status: 404 as const };
  return { status: 200 as const, snap };
}

expenses.put("/:id", async (req, res) => {
  const o = await own(req, req.params.id);
  if (o.status !== 200) { res.status(o.status).json({ error: o.status === 403 ? "Requires an operator account" : "Expense not found" }); return; }
  const parsed = expenseSchema.partial().safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues }); return; }
  const patch = { ...parsed.data, ...(parsed.data.amount !== undefined ? { amount: round2(parsed.data.amount) } : {}) };
  await o.snap.ref.set(patch, { merge: true });
  const after = await o.snap.ref.get();
  res.json({ id: after.id, ...after.data() });
});

expenses.delete("/:id", async (req, res) => {
  const o = await own(req, req.params.id);
  if (o.status !== 200) { res.status(o.status).json({ error: o.status === 403 ? "Requires an operator account" : "Expense not found" }); return; }
  await o.snap.ref.delete();
  // Unlink any PO that was turned into this expense, so it can be re-added.
  const tenantId = o.snap.data()!.tenantId as string;
  const linked = await db.collection("purchaseOrders").where("tenantId", "==", tenantId).where("expenseId", "==", req.params.id).get();
  await Promise.all(linked.docs.map((d) => d.ref.update({ expenseId: FieldValue.delete() })));
  res.json({ ok: true });
});
