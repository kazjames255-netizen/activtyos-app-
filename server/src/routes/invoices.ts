import { Router, type Request } from "express";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { db } from "../firebase";
import type { Role } from "../middleware/role";

// Invoices (Money — INCOMING / accounts receivable) — a bill the provider
// SENDS a customer (parent) to collect payment, optionally tied to a booking.
// Each carries an unguessable payToken so the parent can open a public pay
// page. Operators only for management; the pay page is public by token.
//
// Online card payment isn't wired yet (no Stripe) — the pay page shows the
// amount + the provider's manual pay methods, and the provider marks it paid.
export const invoices = Router();
export const invoicePublic = Router();
const col = db.collection("invoices");
const canManage = (role: Role) => role === "company" || role === "freelancer" || role === "franchise";
const STATUSES = ["draft", "sent", "paid", "cancelled"] as const;
const OWED = new Set(["sent"]); // sent-but-unpaid is money still to collect

const invoiceSchema = z.object({
  customerName: z.string().trim().min(1).max(160),
  customerEmail: z.string().trim().max(160).optional(),
  bookingRef: z.string().trim().max(80).optional(),
  description: z.string().trim().max(300).optional(),
  amount: z.number().nonnegative(),
  date: z.string().max(10),
  dueDate: z.string().max(10).optional(),
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

invoices.get("/", async (req, res) => {
  const tenantId = scope(req, res);
  if (!tenantId) return;
  const snap = await col.where("tenantId", "==", tenantId).get();
  const today = new Date().toISOString().slice(0, 10);
  const thisYear = today.slice(0, 4);
  const list = snap.docs
    .map((d) => ({ id: d.id, ...(d.data() as Record<string, unknown>) }) as Record<string, unknown> & { date?: string; dueDate?: string; amount?: number; status?: string })
    .map((p) => ({ ...p, overdue: OWED.has(p.status ?? "") && !!p.dueDate && (p.dueDate as string) < today }));
  list.sort((a, b) => (`${b.date ?? ""}` < `${a.date ?? ""}` ? -1 : 1));
  const outstanding = round2(list.filter((p) => OWED.has(p.status ?? "")).reduce((s, p) => s + (p.amount ?? 0), 0));
  const collected = round2(list.filter((p) => p.status === "paid" && (p.date ?? "").slice(0, 4) === thisYear).reduce((s, p) => s + (p.amount ?? 0), 0));
  res.json({ items: list, summary: { count: list.length, outstanding, collected, overdue: list.filter((p) => p.overdue).length } });
});

invoices.post("/", async (req, res) => {
  const auth = req.auth!;
  if (!canManage(auth.role) || !auth.tenantId) { res.status(403).json({ error: "Requires an operator account" }); return; }
  const parsed = invoiceSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues }); return; }
  const doc = { ...parsed.data, amount: round2(parsed.data.amount), payToken: randomUUID(), tenantId: auth.tenantId, createdBy: req.user?.email ?? "unknown", createdAt: new Date().toISOString() };
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

invoices.put("/:id", async (req, res) => {
  const o = await own(req, req.params.id);
  if (o.status !== 200) { res.status(o.status).json({ error: o.status === 403 ? "Requires an operator account" : "Invoice not found" }); return; }
  const parsed = invoiceSchema.partial().safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues }); return; }
  const patch = { ...parsed.data, ...(parsed.data.amount !== undefined ? { amount: round2(parsed.data.amount) } : {}) };
  await o.snap.ref.set(patch, { merge: true });
  const after = await o.snap.ref.get();
  res.json({ id: after.id, ...after.data() });
});

invoices.delete("/:id", async (req, res) => {
  const o = await own(req, req.params.id);
  if (o.status !== 200) { res.status(o.status).json({ error: o.status === 403 ? "Requires an operator account" : "Invoice not found" }); return; }
  await o.snap.ref.delete();
  res.json({ ok: true });
});

// ── Public pay page (no auth; found by unguessable token) ──────────────────
invoicePublic.get("/:token", async (req, res) => {
  const snap = await col.where("payToken", "==", req.params.token).limit(1).get();
  if (snap.empty) { res.status(404).json({ error: "This payment link isn’t valid." }); return; }
  const inv = snap.docs[0].data() as Record<string, unknown>;
  const tenant = await db.collection("tenants").doc(inv.tenantId as string).get();
  const settings = (tenant.exists && (tenant.data()!.settings as Record<string, unknown>)) || {};
  const provider = (settings.providerName as string) || (tenant.data()?.name as string) || "Your provider";
  const payMethods = Array.isArray(settings.payMethods) && settings.payMethods.length ? settings.payMethods : ["Bank transfer", "Tax-Free Childcare", "Childcare vouchers"];
  res.json({
    provider, amount: inv.amount ?? 0, description: inv.description ?? null, reference: inv.bookingRef ?? null,
    status: inv.status ?? "sent", dueDate: inv.dueDate ?? null, customerName: inv.customerName ?? null,
    // Manual methods the parent can pay by today; card is pending Stripe.
    payMethods, cardEnabled: false,
  });
});
