import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { db } from "../firebase";
import type { Role } from "../middleware/role";
import { checkCode, normaliseCode, type DiscountCodeDoc } from "../lib/discountCodes";

// Discount codes (Marketing) — operators create/manage promo codes; a parent
// validates one against their basket before checkout (the actual apply happens
// in POST /api/my/bookings, sharing lib/discountCodes so preview == charge).
export const discounts = Router();
const col = db.collection("discountCodes");
const canManage = (role: Role) => role === "company" || role === "freelancer" || role === "franchise";

const codeBase = z.object({
  code: z.string().trim().min(2).max(40),
  type: z.enum(["percent", "amount"]),
  value: z.number().positive().max(100_000),
  minSpend: z.number().nonnegative().optional(),
  expiry: z.string().max(10).optional(),
  usageLimit: z.number().int().positive().max(1_000_000).optional(),
  active: z.boolean().default(true),
});
const pctCheck = (c: { type?: string; value?: number }) => c.type !== "percent" || (c.value ?? 0) <= 100;
const codeSchema = codeBase.refine(pctCheck, { message: "A percentage can't exceed 100" });

function opScope(req: Request, res: Response): string | null {
  const auth = req.auth!;
  if (auth.role === "platform") {
    const t = typeof req.query.tenantId === "string" ? req.query.tenantId : null;
    if (!t) { res.status(400).json({ error: "Platform: pass ?tenantId=" }); return null; }
    return t;
  }
  if (!canManage(auth.role) || !auth.tenantId) { res.status(403).json({ error: "Requires an operator account" }); return null; }
  return auth.tenantId;
}

// GET /api/discounts — the tenant's codes (operators).
discounts.get("/", async (req, res) => {
  const tenantId = opScope(req, res);
  if (!tenantId) return;
  const snap = await col.where("tenantId", "==", tenantId).get();
  const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Record<string, unknown>) })) as (Record<string, unknown> & { createdAt?: string })[];
  list.sort((a, b) => (`${b.createdAt ?? ""}` < `${a.createdAt ?? ""}` ? -1 : 1));
  res.json(list);
});

discounts.post("/", async (req, res) => {
  const auth = req.auth!;
  if (!canManage(auth.role) || !auth.tenantId) { res.status(403).json({ error: "Requires an operator account" }); return; }
  const parsed = codeSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues }); return; }
  const code = normaliseCode(parsed.data.code);
  const dupe = await col.where("tenantId", "==", auth.tenantId).where("code", "==", code).limit(1).get();
  if (!dupe.empty) { res.status(409).json({ error: "You already have a code with that name" }); return; }
  const doc = { ...parsed.data, code, tenantId: auth.tenantId, usedCount: 0, createdAt: new Date().toISOString() };
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

discounts.put("/:id", async (req, res) => {
  const o = await own(req, req.params.id);
  if (o.status !== 200) { res.status(o.status).json({ error: o.status === 403 ? "Requires an operator account" : "Code not found" }); return; }
  const parsed = codeBase.partial().refine(pctCheck).safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues }); return; }
  const patch = { ...parsed.data, ...(parsed.data.code ? { code: normaliseCode(parsed.data.code) } : {}) };
  await o.snap.ref.set(patch, { merge: true });
  const after = await o.snap.ref.get();
  res.json({ id: after.id, ...after.data() });
});

discounts.delete("/:id", async (req, res) => {
  const o = await own(req, req.params.id);
  if (o.status !== 200) { res.status(o.status).json({ error: o.status === 403 ? "Requires an operator account" : "Code not found" }); return; }
  await o.snap.ref.delete();
  res.json({ ok: true });
});

// POST /api/discounts/validate — a signed-in parent checks a code against a
// subtotal before checkout. Read-only preview; the redemption happens at
// booking time. Any authed user may call it (they need a tenant + a subtotal).
const validateSchema = z.object({ tenantId: z.string().min(1).max(60), code: z.string().trim().min(1).max(40), subtotal: z.number().nonnegative() });
discounts.post("/validate", async (req, res) => {
  const parsed = validateSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues }); return; }
  const snap = await col.where("tenantId", "==", parsed.data.tenantId).where("code", "==", normaliseCode(parsed.data.code)).limit(1).get();
  if (snap.empty) { res.json({ valid: false, reason: "That code isn’t recognised" }); return; }
  const check = checkCode(snap.docs[0].data() as DiscountCodeDoc, parsed.data.subtotal, new Date().toISOString().slice(0, 10));
  if (!check.ok) { res.json({ valid: false, reason: check.reason }); return; }
  res.json({ valid: true, code: normaliseCode(parsed.data.code), off: check.off });
});
