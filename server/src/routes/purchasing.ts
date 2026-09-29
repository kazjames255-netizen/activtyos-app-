import { Router, type Request } from "express";
import { z } from "zod";
import { db } from "../firebase";
import { sendMail } from "../lib/mailer";
import { tenantSender } from "../lib/sender";
import { renderMoneyDoc } from "../lib/moneyDoc";
import { buildPoPdf } from "../lib/moneyDocPdf";
import { applyHoNetFilter } from "../lib/franchiseScope";
import type { Role } from "../middleware/role";
import { ukToday, isRealDay } from "../lib/ukDate";
import { bareImageUrl, signImageUrl } from "../lib/signing";
import { splitClears, applyClears } from "../lib/patchClear";

// Purchasing (Money) — purchase orders & supplier invoices: what's on order,
// from whom, for how much, and where it is in the flow (draft → sent →
// received → paid). Operators only, tenant-scoped, realtime.
export const purchasing = Router();
const col = db.collection("purchaseOrders");
const canManage = (role: Role) => role === "company" || role === "freelancer" || role === "franchise";
const STATUSES = ["draft", "sent", "received", "paid", "cancelled"] as const;
const OUTSTANDING = new Set(["sent", "received"]); // committed money not yet paid

const isoDay = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected a date (YYYY-MM-DD)").refine(isRealDay, "Not a real calendar date");
const lineItemSchema = z.object({
  description: z.string().trim().max(200),
  qty: z.number().nonnegative().max(100_000).default(1),
  unitPrice: z.number().nonnegative().max(1_000_000).default(0),
});
const poSchema = z.object({
  kind: z.enum(["bill", "po"]).default("bill"),   // a supplier bill you owe, or a PO you raise
  supplier: z.string().trim().min(1).max(160),
  // A bill is a categorised outgoing (like an expense) so it can be folded into
  // the money-out/Expenses picture. POs carry it too for when they become a bill.
  category: z.string().trim().max(60).optional(),
  // Set when a PO has been turned into a (pending) expense, so it isn't added twice.
  expenseId: z.string().trim().max(60).optional(),
  supplierEmail: z.string().trim().max(160).optional(),
  supplierPhone: z.string().trim().max(60).optional(),
  supplierAddress: z.string().trim().max(400).optional(),
  reference: z.string().trim().max(80).optional(),
  date: isoDay,
  dueDate: isoDay.optional(),
  // PO-specific document fields (Deliver-to block + who raised it + free-text
  // comments to the supplier), mirroring a formal purchase order.
  deliveryAddress: z.string().trim().max(400).optional(),
  requestedBy: z.string().trim().max(120).optional(),
  comments: z.string().trim().max(2_000).optional(),
  amount: z.number().nonnegative().max(1_000_000).optional(),
  lineItems: z.array(lineItemSchema).max(50).optional(),
  status: z.enum(STATUSES).default("draft"),
  notes: z.string().trim().max(2_000).optional(),
  emailedAt: z.string().max(40).optional(),
  // The supplier invoice / PO document itself (image via /api/uploads, or a link).
  attachmentUrl: z.string().trim().max(600).optional(),
  // A standing order/invoice (e.g. a monthly retainer): fan out one per period.
  repeat: z.enum(["weekly", "fortnightly", "monthly"]).optional(),
  repeatUntil: isoDay.optional(),
  seriesId: z.string().trim().max(60).optional(),
});
const round2 = (n: number) => Math.round(n * 100) / 100;
// An uploaded bill/receipt is a PRIVATE file (photo or PDF): records store the
// bare /api/images/<id> link and every response re-signs it (lib/signing.ts),
// exactly like an expense receipt. Pasted outside links pass through untouched.
const signDoc = <T extends object>(p: T): T => { const a = (p as { attachmentUrl?: unknown }).attachmentUrl; return a ? { ...p, attachmentUrl: signImageUrl(a) } : p; };
type LineItem = z.infer<typeof lineItemSchema>;
// Line items are the source of truth for the total when present.
const totalOf = (lineItems: LineItem[] | undefined, fallback: number | undefined) =>
  lineItems && lineItems.length ? round2(lineItems.reduce((s, li) => s + li.qty * li.unitPrice, 0)) : round2(fallback ?? 0);
const MAX_OCCURRENCES = 104;
function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + days); return d.toISOString().slice(0, 10);
}
/** Next date in a series. Monthly keeps the start's day-of-month, clamped to
 *  shorter months (31 Jan → 28 Feb → 31 Mar) — setUTCMonth rolled 31 Jan over
 *  to 3 Mar, skipped February and drifted every later occurrence. Same fix as
 *  expenses.ts / income.ts. */
function stepDate(iso: string, repeat: "weekly" | "fortnightly" | "monthly", anchorDay?: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  if (repeat === "monthly") {
    const day = anchorDay ?? d.getUTCDate();
    const y = d.getUTCFullYear(), m = d.getUTCMonth() + 1;
    const last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
    return new Date(Date.UTC(y, m, Math.min(day, last))).toISOString().slice(0, 10);
  }
  d.setUTCDate(d.getUTCDate() + (repeat === "fortnightly" ? 14 : 7));
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
  const auth = req.auth!;
  const tenantId = scope(req, res);
  if (!tenantId) return;
  const snap = await col.where("tenantId", "==", tenantId).get();
  const today = ukToday();
  let list = snap.docs
    .map((d) => ({ id: d.id, ...(d.data() as Record<string, unknown>) }) as Record<string, unknown> & { date?: string; dueDate?: string; amount?: number; status?: string; franchiseId?: string | null })
    .map((p) => ({ ...p, overdue: OUTSTANDING.has(p.status ?? "") && !!p.dueDate && (p.dueDate as string) < today }));
  // Franchise sees only its own purchase orders; head office sees the whole tenant.
  if (auth.role === "franchise") list = list.filter((p) => (p.franchiseId ?? null) === auth.franchiseId);
  list = applyHoNetFilter(list, auth.role, req.query.franchiseId); // head-office network scope
  list.sort((a, b) => (`${b.date ?? ""}` < `${a.date ?? ""}` ? -1 : 1));
  const outstanding = round2(list.filter((p) => OUTSTANDING.has(p.status ?? "")).reduce((s, p) => s + (p.amount ?? 0), 0));
  res.json({ items: list.map(signDoc), summary: { count: list.length, outstanding, overdue: list.filter((p) => p.overdue).length } });
});

purchasing.post("/", async (req, res) => {
  const auth = req.auth!;
  if (!canManage(auth.role) || !auth.tenantId) { res.status(403).json({ error: "Requires an operator account" }); return; }
  const parsed = poSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues }); return; }
  const { repeat, repeatUntil, seriesId: _ignore, ...rest } = parsed.data;
  if (rest.attachmentUrl) rest.attachmentUrl = bareImageUrl(rest.attachmentUrl);
  const meta = { tenantId: auth.tenantId, franchiseId: auth.role === "franchise" ? auth.franchiseId : null, createdBy: req.user?.email ?? "unknown", createdAt: new Date().toISOString() };
  const base = { ...rest, amount: totalOf(rest.lineItems, rest.amount), ...meta };

  if (repeat && repeatUntil && repeatUntil > rest.date) {
    const sid = col.doc().id;
    const dueOffset = rest.dueDate ? Math.round((Date.parse(`${rest.dueDate}T00:00:00Z`) - Date.parse(`${rest.date}T00:00:00Z`)) / 86_400_000) : null;
    const dates: string[] = [];
    for (let d = rest.date, i = 0; d <= repeatUntil && i < MAX_OCCURRENCES; d = stepDate(d, repeat, Number(rest.date.slice(8, 10))), i++) dates.push(d);
    const batch = db.batch();
    const items = dates.map((date) => {
      const ref = col.doc();
      const doc = { ...base, date, ...(dueOffset != null ? { dueDate: addDays(date, dueOffset) } : {}), repeat, repeatUntil, seriesId: sid };
      batch.set(ref, doc);
      return { id: ref.id, ...doc };
    });
    await batch.commit();
    res.status(201).json({ created: items.length, seriesId: sid, items: items.map(signDoc) });
    return;
  }

  const ref = await col.add(base);
  res.status(201).json(signDoc({ id: ref.id, ...base }));
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
  if (auth.role === "franchise" && (snap.data()!.franchiseId ?? null) !== auth.franchiseId) return { status: 404 as const };
  return { status: 200 as const, snap };
}

purchasing.put("/:id", async (req, res) => {
  const o = await own(req, req.params.id);
  if (o.status !== 200) { res.status(o.status).json({ error: o.status === 403 ? "Requires an operator account" : "Order not found" }); return; }
  // null = remove that optional field (an edit that blanks the reference/notes/attachment/due date must stick).
  const { body, clear } = splitClears(req.body, ["category", "supplierEmail", "supplierPhone", "supplierAddress", "reference", "dueDate", "deliveryAddress", "requestedBy", "comments", "notes", "attachmentUrl"]);
  const parsed = poSchema.partial().safeParse(body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues }); return; }
  const p = parsed.data;
  if (p.attachmentUrl) p.attachmentUrl = bareImageUrl(p.attachmentUrl);
  const patch: Record<string, unknown> = { ...p, ...(p.lineItems !== undefined ? { amount: totalOf(p.lineItems, p.amount) } : p.amount !== undefined ? { amount: round2(p.amount) } : {}) };
  const before = o.snap.data() as Record<string, unknown>;
  // Marking a PO/bill "received" is a real Money-out event: goods/services
  // landed, so it belongs in the expenses picture automatically — it must
  // not silently vanish until someone remembers to press "Add to expenses"
  // (p2-m26). Skip if it's already linked (expenseId) so re-saving never
  // double-books it.
  if (patch.status === "received" && before.status !== "received" && !before.expenseId && !patch.expenseId) {
    const amount = (patch.amount as number | undefined) ?? (before.amount as number) ?? 0;
    const expenseBase = {
      tenantId: before.tenantId,
      franchiseId: before.franchiseId ?? null,
      date: ukToday(),
      category: (before.category as string) || "Supplies",
      amount: round2(amount),
      supplier: (before.supplier as string) || undefined,
      notes: `From PO${before.reference ? ` ${before.reference}` : ""}`,
      status: "pending" as const,
      dueDate: clear.includes("dueDate") ? undefined : (patch.dueDate as string | undefined) ?? (before.dueDate as string | undefined),
      createdBy: req.user?.email ?? "unknown",
      createdByName: req.user?.name ?? req.user?.email ?? "Operator",
      createdAt: new Date().toISOString(),
    };
    const expenseRef = await db.collection("expenses").add(expenseBase);
    patch.expenseId = expenseRef.id;
  }
  applyClears(patch, clear); // after the received→expense hand-off above, which reads patch.dueDate
  await o.snap.ref.set(patch, { merge: true });
  const after = await o.snap.ref.get();
  res.json(signDoc({ id: after.id, ...(after.data() as Record<string, unknown>) }));
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
  // A supplier replying to a PO must reach the provider who raised it.
  const sender = await tenantSender(o.snap.data()!.tenantId as string, (billing?.businessName as string) || undefined);
  // Attach a real PDF of the PO — the email body alone isn't something a
  // supplier can file/print as the order document (p2-m26).
  const pdfBytes = buildPoPdf(doc, billing);
  const filename = `po-${(doc.reference as string) || o.snap.id}.pdf`.replace(/[^a-z0-9.\-]+/gi, "-");
  await sendMail(
    to,
    `Purchase order${doc.reference ? ` ${doc.reference}` : ""} from ${(billing?.businessName as string) || (tenant.data()?.name as string) || "your provider"}`,
    html,
    sender,
    { attachments: [{ filename, content: pdfBytes, contentType: "application/pdf" }] },
  );
  const emailedAt = new Date().toISOString();
  await o.snap.ref.set({ emailedAt }, { merge: true });
  res.json({ ok: true, emailedAt, to });
});
