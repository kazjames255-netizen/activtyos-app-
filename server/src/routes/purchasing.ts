import { Router, type Request } from "express";
import { z } from "zod";
import { db } from "../firebase";
import { sendMail } from "../lib/mailer";
import { renderMoneyDoc } from "../lib/moneyDoc";
import type { Role } from "../middleware/role";

// Purchasing (Money) — purchase orders & supplier invoices: what's on order,
// from whom, for how much, and where it is in the flow (draft → sent →
// received → paid). Operators only, tenant-scoped, realtime.
export const purchasing = Router();
const col = db.collection("purchaseOrders");
const canManage = (role: Role) => role === "company" || role === "freelancer" || role === "franchise";
const STATUSES = ["draft", "sent", "received", "paid", "cancelled"] as const;
const OUTSTANDING = new Set(["sent", "received"]); // committed money not yet paid

const lineItemSchema = z.object({
  description: z.string().trim().max(200),
  qty: z.number().nonnegative().default(1),
  unitPrice: z.number().nonnegative().default(0),
});
const poSchema = z.object({
  kind: z.enum(["bill", "po"]).default("bill"),   // a supplier bill you owe, or a PO you raise
  supplier: z.string().trim().min(1).max(160),
  supplierEmail: z.string().trim().max(160).optional(),
  reference: z.string().trim().max(80).optional(),
  date: z.string().max(10),
  dueDate: z.string().max(10).optional(),
  amount: z.number().nonnegative().optional(),
  lineItems: z.array(lineItemSchema).max(50).optional(),
  status: z.enum(STATUSES).default("draft"),
  notes: z.string().trim().max(2_000).optional(),
  emailedAt: z.string().max(40).optional(),
  // The supplier invoice / PO document itself (image via /api/uploads, or a link).
  attachmentUrl: z.string().trim().max(600).optional(),
  // A standing order/invoice (e.g. a monthly retainer): fan out one per period.
  repeat: z.enum(["weekly", "fortnightly", "monthly"]).optional(),
  repeatUntil: z.string().max(10).optional(),
  seriesId: z.string().trim().max(60).optional(),
});
const round2 = (n: number) => Math.round(n * 100) / 100;
type LineItem = z.infer<typeof lineItemSchema>;
// Line items are the source of truth for the total when present.
const totalOf = (lineItems: LineItem[] | undefined, fallback: number | undefined) =>
  lineItems && lineItems.length ? round2(lineItems.reduce((s, li) => s + li.qty * li.unitPrice, 0)) : round2(fallback ?? 0);
const MAX_OCCURRENCES = 104;
function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + days); return d.toISOString().slice(0, 10);
}
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
  const { repeat, repeatUntil, seriesId: _ignore, ...rest } = parsed.data;
  const meta = { tenantId: auth.tenantId, createdBy: req.user?.email ?? "unknown", createdAt: new Date().toISOString() };
  const base = { ...rest, amount: totalOf(rest.lineItems, rest.amount), ...meta };

  if (repeat && repeatUntil && repeatUntil > rest.date) {
    const sid = col.doc().id;
    const dueOffset = rest.dueDate ? Math.round((Date.parse(`${rest.dueDate}T00:00:00Z`) - Date.parse(`${rest.date}T00:00:00Z`)) / 86_400_000) : null;
    const dates: string[] = [];
    for (let d = rest.date, i = 0; d <= repeatUntil && i < MAX_OCCURRENCES; d = stepDate(d, repeat), i++) dates.push(d);
    const batch = db.batch();
    const items = dates.map((date) => {
      const ref = col.doc();
      const doc = { ...base, date, ...(dueOffset != null ? { dueDate: addDays(date, dueOffset) } : {}), repeat, repeatUntil, seriesId: sid };
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
purchasing.delete("/series/:seriesId", async (req, res) => {
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

purchasing.put("/:id", async (req, res) => {
  const o = await own(req, req.params.id);
  if (o.status !== 200) { res.status(o.status).json({ error: o.status === 403 ? "Requires an operator account" : "Order not found" }); return; }
  const parsed = poSchema.partial().safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues }); return; }
  const p = parsed.data;
  const patch = { ...p, ...(p.lineItems !== undefined ? { amount: totalOf(p.lineItems, p.amount) } : p.amount !== undefined ? { amount: round2(p.amount) } : {}) };
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

// Email this PO/bill to a supplier (real send via the shared mailer).
purchasing.post("/:id/email", async (req, res) => {
  const o = await own(req, req.params.id);
  if (o.status !== 200) { res.status(o.status).json({ error: o.status === 403 ? "Requires an operator account" : "Order not found" }); return; }
  const doc: Record<string, unknown> = { id: o.snap.id, ...(o.snap.data() as Record<string, unknown>) };
  const to = (typeof req.body?.to === "string" && req.body.to.trim()) || (doc.supplierEmail as string) || "";
  if (!to) { res.status(400).json({ error: "No email address to send to." }); return; }
  const tenant = await db.collection("tenants").doc(o.snap.data()!.tenantId as string).get();
  const billing = (tenant.data()?.settings as Record<string, unknown> | undefined)?.billing as Record<string, unknown> | undefined;
  const html = renderMoneyDoc("po", doc, billing);
  await sendMail(to, `Purchase order${doc.reference ? ` ${doc.reference}` : ""} from ${(billing?.businessName as string) || (tenant.data()?.name as string) || "your provider"}`, html);
  const emailedAt = new Date().toISOString();
  await o.snap.ref.set({ emailedAt }, { merge: true });
  res.json({ ok: true, emailedAt, to });
});
