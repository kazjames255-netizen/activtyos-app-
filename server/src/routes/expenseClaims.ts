import { Router } from "express";
import { z } from "zod";
import { db } from "../firebase";
import type { Role } from "../middleware/role";
import { bareImageUrl, signImageUrl } from "../lib/signing";
import { notify } from "../lib/notify";

// Staff expense claims. A staff member claims back money they spent (mileage,
// kit, materials) with a receipt; a manager approves, declines or marks it
// paid. Approving puts it in Money out as an expense. Before this the staff
// screen kept claims on the phone only and the manager never saw them
// (acceptance test d24s8).
//   GET    /api/expense-claims          staff: their own · managers: everyone's
//   POST   /api/expense-claims          submit a claim (staff or manager for themselves)
//   PATCH  /api/expense-claims/:id      manager: approved | declined | paid
//   DELETE /api/expense-claims/:id      the claimant, while it's still waiting
export const expenseClaims = Router();
const col = db.collection("expenseClaims");
const canManage = (role: Role) => role === "company" || role === "freelancer" || role === "franchise";
const CATS = ["Travel & mileage", "Equipment", "Activity materials", "Food & catering", "Training", "Other"] as const;
const round2 = (n: number) => Math.round(n * 100) / 100;

const claimSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  category: z.enum(CATS),
  amount: z.number().positive().max(10_000),
  note: z.string().trim().max(500).default(""),
  receiptUrl: z.string().trim().max(600).optional(),
  receiptName: z.string().trim().max(200).optional(),
});

const sign = (c: Record<string, unknown>) => (c.receiptUrl ? { ...c, receiptUrl: signImageUrl(c.receiptUrl) } : c);
async function accountName(uid?: string) {
  if (!uid) return "";
  return String((await db.collection("users").doc(uid).get()).get("name") ?? "").trim();
}

expenseClaims.get("/", async (req, res) => {
  const auth = req.auth!;
  if (!auth.tenantId || !(canManage(auth.role) || auth.role === "staff")) { res.status(403).json({ error: "Forbidden" }); return; }
  const snap = await col.where("tenantId", "==", auth.tenantId).get();
  let list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Record<string, unknown>) })) as (Record<string, unknown> & { staffUid?: string; franchiseId?: string | null; submittedAt?: string })[];
  if (auth.role === "staff") list = list.filter((c) => c.staffUid === req.user?.uid);
  else if (auth.role === "franchise") list = list.filter((c) => (c.franchiseId ?? null) === auth.franchiseId);
  list.sort((a, b) => String(b.submittedAt ?? "").localeCompare(String(a.submittedAt ?? "")));
  res.json(list.map(sign));
});

expenseClaims.post("/", async (req, res) => {
  const auth = req.auth!;
  if (!auth.tenantId || !(canManage(auth.role) || auth.role === "staff")) { res.status(403).json({ error: "Forbidden" }); return; }
  const parsed = claimSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues }); return; }
  const name = (await accountName(req.user?.uid)) || req.user?.email || "Staff";
  const doc = {
    ...parsed.data,
    amount: round2(parsed.data.amount),
    ...(parsed.data.receiptUrl ? { receiptUrl: bareImageUrl(parsed.data.receiptUrl) } : {}),
    tenantId: auth.tenantId, franchiseId: auth.franchiseId ?? null,
    staffUid: req.user?.uid ?? null, staffName: name, staffEmail: req.user?.email ?? null,
    status: "submitted" as const, submittedAt: new Date().toISOString(),
  };
  const ref = await col.add(doc);
  res.status(201).json(sign({ id: ref.id, ...doc }));
  // Let the managers know there's a claim to look at.
  void notify({ tenantId: auth.tenantId, to: { kind: "tenant" }, category: "billing", title: `Expense claim from ${name}`, body: `£${doc.amount.toFixed(2)} · ${doc.category}${doc.note ? ` — ${doc.note}` : ""}`, href: "/company/expenses", ref: ref.id }).catch(() => {});
});

const statusSchema = z.object({ status: z.enum(["approved", "declined", "paid"]), reason: z.string().trim().max(300).optional() });
expenseClaims.patch("/:id", async (req, res) => {
  const auth = req.auth!;
  if (!auth.tenantId || !canManage(auth.role)) { res.status(403).json({ error: "Only a manager can approve claims" }); return; }
  const parsed = statusSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues }); return; }
  const ref = col.doc(req.params.id);
  const snap = await ref.get();
  const c = snap.data();
  if (!snap.exists || !c || c.tenantId !== auth.tenantId || (auth.role === "franchise" && (c.franchiseId ?? null) !== auth.franchiseId)) { res.status(404).json({ error: "Claim not found" }); return; }
  const now = new Date().toISOString();
  const by = req.user?.email ?? req.user?.uid ?? "manager";
  const patch: Record<string, unknown> = { status: parsed.data.status, [`${parsed.data.status}At`]: now, [`${parsed.data.status}By`]: by, ...(parsed.data.reason ? { reason: parsed.data.reason } : {}) };
  // Approved (or paid straight away) → it's money out: one expense row, once.
  if ((parsed.data.status === "approved" || parsed.data.status === "paid") && !c.expenseId) {
    const exp = await db.collection("expenses").add({
      tenantId: c.tenantId, franchiseId: c.franchiseId ?? null, date: c.date, category: c.category, amount: c.amount,
      supplier: c.staffName, notes: `Staff expense claim — ${c.staffName}${c.note ? `: ${c.note}` : ""}`,
      ...(c.receiptUrl ? { receiptUrl: c.receiptUrl } : {}), claimId: snap.id,
      createdBy: by, createdByName: req.user?.name ?? by, createdAt: now,
    });
    patch.expenseId = exp.id;
  }
  await ref.set(patch, { merge: true });
  const after = await ref.get();
  res.json(sign({ id: after.id, ...after.data() }));
});

expenseClaims.delete("/:id", async (req, res) => {
  const auth = req.auth!;
  const ref = col.doc(req.params.id);
  const snap = await ref.get();
  const c = snap.data();
  if (!snap.exists || !c || c.tenantId !== auth.tenantId) { res.status(404).json({ error: "Claim not found" }); return; }
  if (c.staffUid !== req.user?.uid || c.status !== "submitted") { res.status(403).json({ error: "Only a claim you made that's still waiting can be withdrawn" }); return; }
  await ref.delete();
  res.json({ ok: true });
});
