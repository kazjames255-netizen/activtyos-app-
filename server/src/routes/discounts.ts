import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { FieldValue } from "firebase-admin/firestore";
import { db } from "../firebase";
import type { Role } from "../middleware/role";
import { checkCode, normaliseCode, type DiscountCodeDoc } from "../lib/discountCodes";
import { emailNewMessage } from "../lib/emails";
import { webUrl } from "../lib/stripe";

// Discount codes (Marketing) — operators create/manage promo codes; a parent
// validates one against their basket before checkout (the actual apply happens
// in POST /api/my/bookings, sharing lib/discountCodes so preview == charge).
export const discounts = Router();
const col = db.collection("discountCodes");
const canManage = (role: Role) => role === "company" || role === "freelancer" || role === "franchise";

const codeBase = z.object({
  code: z.string().trim().min(2).max(40),
  type: z.enum(["percent", "amount", "perAttendee"]),
  value: z.number().positive().max(100_000),
  minSpend: z.number().nonnegative().optional(),
  expiry: z.string().max(10).optional(),
  usageLimit: z.number().int().positive().max(1_000_000).optional(),
  listingId: z.string().trim().max(60).optional(), // scope to one listing
  perCustomerLimit: z.boolean().optional(), // one use per customer
  // Reserve a code for one family (by email) — only they can redeem it, and
  // creating it messages + emails them.
  assignedTo: z.string().trim().email().max(160).optional(),
  assignedName: z.string().trim().max(120).optional(),
  active: z.boolean().default(true),
});

// Message + email the family a code was assigned to.
async function notifyAssigned(tenantId: string, email: string, name: string | undefined, code: string, valueTxt: string, expiry?: string): Promise<void> {
  const tName = (await db.collection("tenants").doc(tenantId).get()).data()?.name ?? "Your provider";
  const body = `🎉 You've got a discount code from ${tName}: ${code} — ${valueTxt}. Enter it at checkout on your next booking${expiry ? ` (valid until ${expiry})` : ""}.`;
  const el = email.toLowerCase();
  const id = `${tenantId}__${el}`;
  const now = new Date().toISOString();
  const tRef = db.collection("threads").doc(id);
  const existing = await tRef.get();
  await tRef.set({
    tenantId,
    tenantName: existing.exists ? existing.data()!.tenantName : tName,
    parentEmail: el,
    parentName: existing.exists ? existing.data()!.parentName : (name || el),
    lastBody: body, lastFrom: "operator", lastAt: now, operatorHidden: false,
    ...(existing.exists ? {} : { createdAt: now, operatorUnread: 0, parentUnread: 0 }),
    parentUnread: FieldValue.increment(1),
  }, { merge: true });
  await db.collection("messages").add({ threadId: id, tenantId, parentEmail: el, from: "operator", senderName: tName, body, createdAt: now });
  try { emailNewMessage(el, { providerName: tName, senderName: tName, body, deepLink: `${webUrl}/custdash/messages` }); } catch { /* email never blocks */ }
}
const pctCheck = (c: { type?: string; value?: number }) => c.type !== "percent" || (c.value ?? 0) <= 100;
const valueTxtOf = (type: string, value: number) => (type === "percent" ? `${value}% off` : type === "perAttendee" ? `£${value} off per child` : `£${value} off`);
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
  if (parsed.data.assignedTo) {
    const valueTxt = valueTxtOf(parsed.data.type, parsed.data.value);
    await notifyAssigned(auth.tenantId, parsed.data.assignedTo, parsed.data.assignedName, code, valueTxt, parsed.data.expiry);
  }
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
  const prevAssigned = (o.snap.data()!.assignedTo as string | undefined)?.toLowerCase();
  await o.snap.ref.set(patch, { merge: true });
  const after = await o.snap.ref.get();
  const a = after.data()!;
  // Newly assigned (or reassigned) via edit → tell the family.
  if (parsed.data.assignedTo && parsed.data.assignedTo.toLowerCase() !== prevAssigned) {
    const valueTxt = valueTxtOf(a.type as string, a.value as number);
    await notifyAssigned(a.tenantId as string, parsed.data.assignedTo, a.assignedName as string | undefined, a.code as string, valueTxt, a.expiry as string | undefined);
  }
  res.json({ id: after.id, ...a });
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
const validateSchema = z.object({
  tenantId: z.string().min(1).max(60),
  code: z.string().trim().min(1).max(40),
  subtotal: z.number().nonnegative(),
  listingId: z.string().trim().max(60).optional(),
  attendees: z.number().int().positive().max(100).optional(),
});
discounts.post("/validate", async (req, res) => {
  const parsed = validateSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues }); return; }
  const snap = await col.where("tenantId", "==", parsed.data.tenantId).where("code", "==", normaliseCode(parsed.data.code)).limit(1).get();
  if (snap.empty) { res.json({ valid: false, reason: "That code isn’t recognised" }); return; }
  const doc = snap.docs[0];
  const data = doc.data() as DiscountCodeDoc;
  const email = req.user?.email;
  // One-per-customer needs a DB read (checkCode is pure) — do it here.
  if (data.perCustomerLimit && email) {
    const prior = await db.collection("discountRedemptions").where("codeId", "==", doc.id).where("email", "==", email.toLowerCase()).limit(1).get();
    if (!prior.empty) { res.json({ valid: false, reason: "You’ve already used this code" }); return; }
  }
  const check = checkCode(data, parsed.data.subtotal, new Date().toISOString().slice(0, 10), { email, listingId: parsed.data.listingId, attendees: parsed.data.attendees });
  if (!check.ok) { res.json({ valid: false, reason: check.reason }); return; }
  res.json({ valid: true, code: normaliseCode(parsed.data.code), off: check.off });
});
