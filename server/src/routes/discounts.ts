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
  exclusive: z.boolean().optional(), // can't be combined with any other code
  // Reserve a code for one family (by email) — only they can redeem it, and
  // creating it messages + emails them.
  assignedTo: z.string().trim().email().max(160).optional(),
  assignedName: z.string().trim().max(120).optional(),
  // Reserve for a whole GROUP of families (e.g. "NHS parents"). The server
  // resolves the group's members into assignedEmails + assignedGroupName and
  // messages + emails each of them. "" clears the group.
  assignedGroupId: z.string().trim().max(60).optional(),
  active: z.boolean().default(true),
});

// Turn a code's listingId into a human scope line for the notification.
async function listingScopeText(tenantId: string, listingId?: string): Promise<string> {
  if (!listingId) return "all listings";
  const l = await db.collection("listings").doc(listingId).get();
  const title = l.exists && l.data()!.tenantId === tenantId ? (l.data()!.title as string | undefined) : undefined;
  return title ? `${title} only` : "one listing only";
}

// Message + email the family a code was assigned to. The message carries the
// code details as structured `coupon` metadata so the customer UI can show a
// clear, copyable code chip (not just prose).
async function notifyAssigned(tenantId: string, email: string, name: string | undefined, code: string, valueTxt: string, expiry?: string, scopeText = "all listings"): Promise<void> {
  const tName = (await db.collection("tenants").doc(tenantId).get()).data()?.name ?? "Your provider";
  const validity = expiry ? `valid until ${expiry}` : "no end date";
  const body = `🎉 ${tName} sent you a discount code!\n\nCode: ${code}\n${valueTxt} · ${scopeText} · ${validity}\n\nEnter it at checkout on your next booking — or find it any time under Coupons & discount codes.`;
  const coupon = { code, valueTxt, scope: scopeText, expiry: expiry ?? null };
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
  await db.collection("messages").add({ threadId: id, tenantId, parentEmail: el, from: "operator", senderName: tName, body, coupon, createdAt: now });
  try { emailNewMessage(el, { providerName: tName, senderName: tName, body, deepLink: `${webUrl}/custdash/messages`, tenantId }); } catch { /* email never blocks */ }
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

// ── Parent groups ─────────────────────────────────────────────────────────
// Named sets of families (e.g. "NHS parents") the operator can send a code to
// all at once. Kept with discount codes because that's what they power. Routes
// live BEFORE /:id so "groups" is never read as a code id.
const groupsCol = db.collection("customerGroups");
const groupSchema = z.object({
  name: z.string().trim().min(1).max(80),
  emails: z.array(z.string().trim().email().max(160)).max(5000).default([]),
});
const normEmails = (es: string[]) => [...new Set(es.map((e) => e.trim().toLowerCase()).filter(Boolean))];

// Message + email every member of a group about a code.
async function notifyEach(tenantId: string, emails: string[], code: string, valueTxt: string, expiry?: string, scopeText = "all listings"): Promise<void> {
  for (const em of emails) {
    try { await notifyAssigned(tenantId, em, undefined, code, valueTxt, expiry, scopeText); } catch { /* one bad address never blocks the rest */ }
  }
}
// Resolve a group id → {emails, name}, scoped to the tenant.
async function resolveGroup(tenantId: string, groupId: string): Promise<{ emails: string[]; name: string } | null> {
  const g = await groupsCol.doc(groupId).get();
  if (!g.exists || g.data()!.tenantId !== tenantId) return null;
  return { emails: normEmails((g.data()!.emails as string[]) ?? []), name: (g.data()!.name as string) ?? "Group" };
}

discounts.get("/groups", async (req, res) => {
  const tenantId = opScope(req, res);
  if (!tenantId) return;
  const snap = await groupsCol.where("tenantId", "==", tenantId).get();
  const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Record<string, unknown>) })) as (Record<string, unknown> & { name?: string })[];
  list.sort((a, b) => `${a.name ?? ""}`.localeCompare(`${b.name ?? ""}`));
  res.json(list);
});

discounts.post("/groups", async (req, res) => {
  const auth = req.auth!;
  if (!canManage(auth.role) || !auth.tenantId) { res.status(403).json({ error: "Requires an operator account" }); return; }
  const parsed = groupSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues }); return; }
  const doc = { name: parsed.data.name, emails: normEmails(parsed.data.emails), tenantId: auth.tenantId, createdAt: new Date().toISOString() };
  const ref = await groupsCol.add(doc);
  res.status(201).json({ id: ref.id, ...doc });
});

async function ownGroup(req: Request, id: string) {
  const auth = req.auth!;
  if (!canManage(auth.role) || !auth.tenantId) return { status: 403 as const };
  const snap = await groupsCol.doc(id).get();
  if (!snap.exists || snap.data()!.tenantId !== auth.tenantId) return { status: 404 as const };
  return { status: 200 as const, snap };
}

discounts.put("/groups/:id", async (req, res) => {
  const o = await ownGroup(req, req.params.id);
  if (o.status !== 200) { res.status(o.status).json({ error: o.status === 403 ? "Requires an operator account" : "Group not found" }); return; }
  const parsed = groupSchema.partial().safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues }); return; }
  const patch: Record<string, unknown> = { ...parsed.data, ...(parsed.data.emails ? { emails: normEmails(parsed.data.emails) } : {}) };
  await o.snap.ref.set(patch, { merge: true });
  const after = await o.snap.ref.get();
  res.json({ id: after.id, ...after.data() });
});

discounts.delete("/groups/:id", async (req, res) => {
  const o = await ownGroup(req, req.params.id);
  if (o.status !== 200) { res.status(o.status).json({ error: o.status === 403 ? "Requires an operator account" : "Group not found" }); return; }
  await o.snap.ref.delete();
  res.json({ ok: true });
});

// ── Automatic (no-code) discounts ──────────────────────────────────────────
// Rules that apply at checkout with no code: "multi-person" (e.g. siblings) and
// "multi-session". CRUD lives here; the checkout engine applies them (handoff:
// wire into lib/discountCodes / my.ts pricing — multi-person first, then
// multi-session, always giving the booker the best price). Routes BEFORE /:id.
const autoCol = db.collection("autoDiscounts");
const autoBase = z.object({
  kind: z.enum(["person", "session"]),          // multi-person (siblings) | multi-session
  from: z.number().int().min(2).max(50),        // person: from the Nth person; session: more than N sessions
  mode: z.enum(["flat", "pct"]),                // £ off | % off
  value: z.number().positive().max(100_000),
  listingIds: z.array(z.string().trim().max(60)).max(500).nullable().default(null), // null/[] = all listings
  active: z.boolean().default(true),
});
const autoPctOk = (r: { mode?: string; value?: number }) => r.mode !== "pct" || (r.value ?? 0) <= 100;
const autoSchema = autoBase.refine(autoPctOk, { message: "A percentage can't exceed 100" });

discounts.get("/auto", async (req, res) => {
  const tenantId = opScope(req, res);
  if (!tenantId) return;
  const snap = await autoCol.where("tenantId", "==", tenantId).get();
  const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Record<string, unknown>) })) as (Record<string, unknown> & { createdAt?: string })[];
  list.sort((a, b) => `${a.createdAt ?? ""}`.localeCompare(`${b.createdAt ?? ""}`));
  res.json(list);
});

discounts.post("/auto", async (req, res) => {
  const auth = req.auth!;
  if (!canManage(auth.role) || !auth.tenantId) { res.status(403).json({ error: "Requires an operator account" }); return; }
  const parsed = autoSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues }); return; }
  const doc = { ...parsed.data, tenantId: auth.tenantId, createdAt: new Date().toISOString() };
  const ref = await autoCol.add(doc);
  res.status(201).json({ id: ref.id, ...doc });
});

async function ownAuto(req: Request, id: string) {
  const auth = req.auth!;
  if (!canManage(auth.role) || !auth.tenantId) return { status: 403 as const };
  const snap = await autoCol.doc(id).get();
  if (!snap.exists || snap.data()!.tenantId !== auth.tenantId) return { status: 404 as const };
  return { status: 200 as const, snap };
}

discounts.put("/auto/:id", async (req, res) => {
  const o = await ownAuto(req, req.params.id);
  if (o.status !== 200) { res.status(o.status).json({ error: o.status === 403 ? "Requires an operator account" : "Rule not found" }); return; }
  const parsed = autoBase.partial().safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues }); return; }
  if (!autoPctOk(parsed.data)) { res.status(400).json({ error: "A percentage can't exceed 100" }); return; }
  await o.snap.ref.set(parsed.data, { merge: true });
  const after = await o.snap.ref.get();
  res.json({ id: after.id, ...after.data() });
});

discounts.delete("/auto/:id", async (req, res) => {
  const o = await ownAuto(req, req.params.id);
  if (o.status !== 200) { res.status(o.status).json({ error: o.status === 403 ? "Requires an operator account" : "Rule not found" }); return; }
  await o.snap.ref.delete();
  res.json({ ok: true });
});

// GET /api/discounts — the tenant's codes (operators).
discounts.get("/", async (req, res) => {
  const auth = req.auth!;
  const tenantId = opScope(req, res);
  if (!tenantId) return;
  const snap = await col.where("tenantId", "==", tenantId).get();
  let list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Record<string, unknown>) })) as (Record<string, unknown> & { createdAt?: string; franchiseId?: string | null })[];
  // A franchise manages only its own discount codes; head office sees all.
  if (auth.role === "franchise") list = list.filter((c) => (c.franchiseId ?? null) === auth.franchiseId);
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
  // Reserve for a group → snapshot its members onto the code.
  const grp = parsed.data.assignedGroupId ? await resolveGroup(auth.tenantId, parsed.data.assignedGroupId) : null;
  const doc = { ...parsed.data, code, tenantId: auth.tenantId, franchiseId: auth.role === "franchise" ? auth.franchiseId : null, usedCount: 0, createdAt: new Date().toISOString(),
    ...(grp ? { assignedEmails: grp.emails, assignedGroupName: grp.name } : {}) };
  const ref = await col.add(doc);
  const valueTxt = valueTxtOf(parsed.data.type, parsed.data.value);
  const scopeText = await listingScopeText(auth.tenantId, parsed.data.listingId);
  if (parsed.data.assignedTo) await notifyAssigned(auth.tenantId, parsed.data.assignedTo, parsed.data.assignedName, code, valueTxt, parsed.data.expiry, scopeText);
  if (grp?.emails.length) await notifyEach(auth.tenantId, grp.emails, code, valueTxt, parsed.data.expiry, scopeText);
  res.status(201).json({ id: ref.id, ...doc });
});

async function own(req: Request, id: string) {
  const auth = req.auth!;
  if (!canManage(auth.role) || !auth.tenantId) return { status: 403 as const };
  const snap = await col.doc(id).get();
  if (!snap.exists || snap.data()!.tenantId !== auth.tenantId) return { status: 404 as const };
  if (auth.role === "franchise" && (snap.data()!.franchiseId ?? null) !== auth.franchiseId) return { status: 404 as const };
  return { status: 200 as const, snap };
}

discounts.put("/:id", async (req, res) => {
  const o = await own(req, req.params.id);
  if (o.status !== 200) { res.status(o.status).json({ error: o.status === 403 ? "Requires an operator account" : "Code not found" }); return; }
  const parsed = codeBase.partial().refine(pctCheck).safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues }); return; }
  const patch: Record<string, unknown> = { ...parsed.data, ...(parsed.data.code ? { code: normaliseCode(parsed.data.code) } : {}) };
  const prevAssigned = (o.snap.data()!.assignedTo as string | undefined)?.toLowerCase();
  const prevGroupId = o.snap.data()!.assignedGroupId as string | undefined;
  const tenantId = o.snap.data()!.tenantId as string;
  // Reserve-for-group changed on edit → re-snapshot members (or clear).
  let notifyGroupEmails: string[] = [];
  if (parsed.data.assignedGroupId !== undefined && parsed.data.assignedGroupId !== prevGroupId) {
    if (parsed.data.assignedGroupId) {
      const grp = await resolveGroup(tenantId, parsed.data.assignedGroupId);
      if (grp) { patch.assignedEmails = grp.emails; patch.assignedGroupName = grp.name; notifyGroupEmails = grp.emails; }
    } else {
      patch.assignedEmails = FieldValue.delete();
      patch.assignedGroupName = FieldValue.delete();
    }
  }
  await o.snap.ref.set(patch, { merge: true });
  const after = await o.snap.ref.get();
  const a = after.data()!;
  const valueTxt = valueTxtOf(a.type as string, a.value as number);
  const scopeText = await listingScopeText(tenantId, a.listingId as string | undefined);
  // Newly assigned (or reassigned) via edit → tell the family / the group.
  if (parsed.data.assignedTo && parsed.data.assignedTo.toLowerCase() !== prevAssigned) {
    await notifyAssigned(a.tenantId as string, parsed.data.assignedTo, a.assignedName as string | undefined, a.code as string, valueTxt, a.expiry as string | undefined, scopeText);
  }
  if (notifyGroupEmails.length) await notifyEach(tenantId, notifyGroupEmails, a.code as string, valueTxt, a.expiry as string | undefined, scopeText);
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
  // Referral / new-customer rules — enforced HERE too (not just at booking) so a
  // family isn't shown the discount applied in the preview and then rejected at
  // checkout. Mirrors the checks in POST /api/my/bookings.
  if (data.referral && data.referrerEmail && email && data.referrerEmail.toLowerCase() === email.toLowerCase()) {
    res.json({ valid: false, reason: "You can’t use your own referral link" }); return;
  }
  if (data.newCustomerOnly && email) {
    const prior = await db.collection("bookings").where("email", "==", email.toLowerCase()).where("tenantId", "==", parsed.data.tenantId).limit(1).get();
    if (!prior.empty) { res.json({ valid: false, reason: "This code is for new customers only" }); return; }
  }
  const check = checkCode(data, parsed.data.subtotal, new Date().toISOString().slice(0, 10), { email, listingId: parsed.data.listingId, attendees: parsed.data.attendees });
  if (!check.ok) { res.json({ valid: false, reason: check.reason }); return; }
  res.json({ valid: true, code: normaliseCode(parsed.data.code), off: check.off, exclusive: !!data.exclusive });
});
