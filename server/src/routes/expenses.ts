import { Router, type Request } from "express";
import { z } from "zod";
import { db } from "../firebase";
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
});
const round2 = (n: number) => Math.round(n * 100) / 100;

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
  const doc = { ...parsed.data, amount: round2(parsed.data.amount), tenantId: auth.tenantId, createdBy: req.user?.email ?? "unknown", createdByName: req.user?.name ?? req.user?.email ?? "Operator", createdAt: new Date().toISOString() };
  const ref = await col.add(doc);
  res.status(201).json({ id: ref.id, ...doc });
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
  res.json({ ok: true });
});
