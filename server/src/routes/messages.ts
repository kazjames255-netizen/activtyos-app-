import { Router } from "express";
import { z } from "zod";
import { FieldValue } from "firebase-admin/firestore";
import { db } from "../firebase";
import type { Role } from "../middleware/role";

// ─────────────────────────────────────────────────────────────────────────
// Messages (Communication) — 1:1 threads between a provider (tenant) and a
// parent. One thread per (tenant, parent) pair, keyed deterministically so
// both sides land in the same conversation. Either side can open a thread,
// but only with someone they have a booking relationship with — an operator
// can message a family that booked them; a parent can message a provider
// they've booked. Unread counts are kept per side.
// ─────────────────────────────────────────────────────────────────────────
export const messages = Router();
const threadsCol = db.collection("threads");
const msgsCol = db.collection("messages");
const isOperator = (role: Role) => role === "staff" || role === "company" || role === "freelancer" || role === "franchise";

const threadId = (tenantId: string, email: string) => `${tenantId}__${email.toLowerCase()}`;
const bodySchema = z.object({ body: z.string().trim().min(1).max(4_000) });
const startOperatorSchema = bodySchema.extend({ parentEmail: z.string().trim().email().max(160), parentName: z.string().trim().max(120).optional() });
const startParentSchema = bodySchema.extend({ tenantId: z.string().min(1).max(60) });

async function tenantName(tenantId: string) {
  const t = await db.collection("tenants").doc(tenantId).get();
  return (t.exists && (t.data()!.name as string)) || "Your activity provider";
}
async function hasBooking(tenantId: string, email: string) {
  const snap = await db.collection("bookings").where("tenantId", "==", tenantId).where("email", "==", email).limit(1).get();
  return !snap.empty;
}
// An operator may message anyone in their own customer list, booking or not —
// the customer list is who they've chosen to work with. Case-insensitive so a
// mixed-case stored email still matches the lowercased recipient.
async function isMyCustomer(tenantId: string, email: string) {
  const e = email.toLowerCase();
  const snap = await db.collection("customers").where("tenantId", "==", tenantId).get();
  return snap.docs.some((d) => ((d.data().email as string | undefined) ?? "").toLowerCase() === e);
}

// GET /api/messages/threads — the caller's conversations (newest activity first).
messages.get("/threads", async (req, res) => {
  const auth = req.auth!;
  let snap;
  if (auth.role === "parent") {
    const email = req.user?.email;
    if (!email) { res.status(400).json({ error: "Account has no email address" }); return; }
    snap = await threadsCol.where("parentEmail", "==", email.toLowerCase()).get();
  } else if (isOperator(auth.role) && auth.tenantId) {
    snap = await threadsCol.where("tenantId", "==", auth.tenantId).get();
  } else { res.status(403).json({ error: "Requires a parent or operator account" }); return; }
  const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Record<string, unknown>) })) as (Record<string, unknown> & { lastAt?: string })[];
  list.sort((a, b) => (`${b.lastAt ?? ""}` < `${a.lastAt ?? ""}` ? -1 : 1));
  res.json(list);
});

// GET /api/messages/threads/:id — the messages, and mark my side read.
messages.get("/threads/:id", async (req, res) => {
  const auth = req.auth!;
  const ref = threadsCol.doc(req.params.id);
  const snap = await ref.get();
  if (!snap.exists) { res.status(404).json({ error: "Conversation not found" }); return; }
  const t = snap.data() as { tenantId: string; parentEmail: string };
  const email = req.user?.email?.toLowerCase();
  const mine = auth.role === "parent" ? t.parentEmail === email : isOperator(auth.role) && t.tenantId === auth.tenantId;
  if (!mine) { res.status(404).json({ error: "Conversation not found" }); return; }
  const msgs = await msgsCol.where("threadId", "==", req.params.id).get();
  const list = msgs.docs.map((d) => ({ id: d.id, ...(d.data() as Record<string, unknown>) })) as (Record<string, unknown> & { createdAt?: string })[];
  list.sort((a, b) => (`${a.createdAt ?? ""}` < `${b.createdAt ?? ""}` ? -1 : 1));
  await ref.set(auth.role === "parent" ? { parentUnread: 0 } : { operatorUnread: 0 }, { merge: true });
  res.json({ thread: { id: snap.id, ...t, ...snap.data() }, messages: list });
});

// POST /api/messages — send (creating the thread if needed).
messages.post("/", async (req, res) => {
  const auth = req.auth!;
  let tenantId: string, parentEmail: string, parentName: string, from: "operator" | "parent";

  if (auth.role === "parent") {
    const parsed = startParentSchema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: parsed.error.issues }); return; }
    const email = req.user?.email;
    if (!email) { res.status(400).json({ error: "Account has no email address" }); return; }
    tenantId = parsed.data.tenantId;
    if (!(await hasBooking(tenantId, email))) { res.status(403).json({ error: "You can only message a provider you've booked with" }); return; }
    parentEmail = email.toLowerCase();
    parentName = req.user?.name ?? email;
    from = "parent";
    req.body = parsed.data;
  } else if (isOperator(auth.role) && auth.tenantId) {
    const parsed = startOperatorSchema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: parsed.error.issues }); return; }
    tenantId = auth.tenantId;
    parentEmail = parsed.data.parentEmail.toLowerCase();
    if (!(await isMyCustomer(tenantId, parentEmail)) && !(await hasBooking(tenantId, parentEmail))) {
      res.status(400).json({ error: "You can only message your own customers or families who've booked" });
      return;
    }
    parentName = parsed.data.parentName ?? parsed.data.parentEmail;
    from = "operator";
  } else { res.status(403).json({ error: "Requires a parent or operator account" }); return; }

  const body = (req.body as { body: string }).body.trim();
  const id = threadId(tenantId, parentEmail);
  const now = new Date().toISOString();
  const tRef = threadsCol.doc(id);
  const existing = await tRef.get();
  const senderName = from === "parent" ? parentName : (req.user?.name ?? "Provider");

  await tRef.set({
    tenantId,
    tenantName: existing.exists ? (existing.data()!.tenantName as string) : await tenantName(tenantId),
    parentEmail,
    parentName,
    lastBody: body,
    lastFrom: from,
    lastAt: now,
    ...(existing.exists ? {} : { createdAt: now, operatorUnread: 0, parentUnread: 0 }),
    // Bump the other side's unread.
    ...(from === "parent" ? { operatorUnread: FieldValue.increment(1) } : { parentUnread: FieldValue.increment(1) }),
  }, { merge: true });

  const msg = { threadId: id, tenantId, parentEmail, from, senderName, body, createdAt: now };
  const ref = await msgsCol.add(msg);
  res.status(201).json({ id: ref.id, ...msg });
});
