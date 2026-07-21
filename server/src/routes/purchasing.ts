import { Router, type Request } from "express";
import { z } from "zod";
import { db } from "../firebase";
import type { Role } from "../middleware/role";

// Purchasing (Money) — purchase orders & supplier invoices: what's on order,
// from whom, for how much, and where it is in the flow (draft → sent →
// received → paid). Operators only, tenant-scoped, realtime.
export const purchasing = Router();
const col = db.collection("purchaseOrders");
const canManage = (role: Role) => role === "company" || role === "freelancer" || role === "franchise";
const STATUSES = ["draft", "sent", "received", "paid", "cancelled"] as const;
const OUTSTANDING = new Set(["sent", "received"]); // committed money not yet paid

const poSchema = z.object({
  supplier: z.string().trim().min(1).max(160),
  reference: z.string().trim().max(80).optional(),
  date: z.string().max(10),
  dueDate: z.string().max(10).optional(),
  amount: z.number().nonnegative(),
  status: z.enum(STATUSES).default("draft"),
  notes: z.string().trim().max(2_000).optional(),
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

purchasing.get("/", async (req, res) => {
  const tenantId = scope(req, res);
  if (!tenantId) return;
  const snap = await col.where("tenantId", "==", tenantId).get();
  const today = new Date().toISOString().slice(0, 10);
  const list = snap.docs
    .map((d) => ({ id: d.id, ...(d.data() as Record<string, unknown>) }) as Record<string, unknown> & { date?: string; dueDate?: string; amount?: number; status?: string })
    .map((p) => ({ ...p, overdue: OUTSTANDING.has(p.status ?? "") && !!p.dueDate && (p.dueDate as string) < today }));
  list.sort((a, b) => (`${b.date ?? ""}` < `${a.date ?? ""}` ? -1 : 1));
  const outstanding = round2(list.filter((p) => OUTSTANDING.has(p.status ?? "")).reduce((s, p) => s + (p.amount ?? 0), 0));
  res.json({ items: list, summary: { count: list.length, outstanding, overdue: list.filter((p) => p.overdue).length } });
});

purchasing.post("/", async (req, res) => {
  const auth = req.auth!;
  if (!canManage(auth.role) || !auth.tenantId) { res.status(403).json({ error: "Requires an operator account" }); return; }
  const parsed = poSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues }); return; }
  const doc = { ...parsed.data, amount: round2(parsed.data.amount), tenantId: auth.tenantId, createdBy: req.user?.email ?? "unknown", createdAt: new Date().toISOString() };
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

purchasing.put("/:id", async (req, res) => {
  const o = await own(req, req.params.id);
  if (o.status !== 200) { res.status(o.status).json({ error: o.status === 403 ? "Requires an operator account" : "Order not found" }); return; }
  const parsed = poSchema.partial().safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues }); return; }
  const patch = { ...parsed.data, ...(parsed.data.amount !== undefined ? { amount: round2(parsed.data.amount) } : {}) };
  await o.snap.ref.set(patch, { merge: true });
  const after = await o.snap.ref.get();
  res.json({ id: after.id, ...after.data() });
});

purchasing.delete("/:id", async (req, res) => {
  const o = await own(req, req.params.id);
  if (o.status !== 200) { res.status(o.status).json({ error: o.status === 403 ? "Requires an operator account" : "Order not found" }); return; }
  await o.snap.ref.delete();
  res.json({ ok: true });
});
