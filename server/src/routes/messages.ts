import { Router } from "express";
import { z } from "zod";
import { FieldValue } from "firebase-admin/firestore";
import { db } from "../firebase";
import type { Role } from "../middleware/role";
import { emailNewMessage } from "../lib/emails";
import { webUrl } from "../lib/stripe";

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
const bodySchema = z.object({ body: z.string().trim().min(1).max(4_000), subject: z.string().trim().max(80).optional() });
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
// Pro-composer merge fields we can resolve for any recipient. (Per-booking ones
// like {ChildName}/{BookingRef} need booking context — see handoff §II.)
interface MergeVars { parentName?: string; providerName?: string; childName?: string; listingName?: string; sessionDate?: string; venueName?: string; bookingRef?: string }
function mergeText(text: string, v: MergeVars): string {
  return text
    .replace(/\{ParentName\}/gi, v.parentName ?? "")
    .replace(/\{ProviderName\}/gi, v.providerName ?? "")
    .replace(/\{ChildName\}/gi, v.childName ?? "")
    .replace(/\{ListingName\}/gi, v.listingName ?? "")
    .replace(/\{SessionDate\}/gi, v.sessionDate ?? "")
    .replace(/\{VenueName\}/gi, v.venueName ?? "")
    .replace(/\{BookingRef\}/gi, v.bookingRef ?? "");
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
  let list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Record<string, unknown>) })) as (Record<string, unknown> & { lastAt?: string; operatorHidden?: boolean })[];
  // A broadcast delivers into each family's thread so they receive + can reply,
  // but those threads stay hidden from the OPERATOR inbox until a family actually
  // replies (avoids N duplicate rows per bulk send). Parents always see theirs.
  if (auth.role !== "parent") list = list.filter((t) => t.operatorHidden !== true);
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
  let subject: string | undefined;

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
    subject = parsed.data.subject;
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
    subject = parsed.data.subject;
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
    // A deliberate 1:1 (either side) always shows in the operator inbox — this
    // is what surfaces a broadcast thread once a family replies.
    operatorHidden: false,
    ...(existing.exists ? {} : { createdAt: now, operatorUnread: 0, parentUnread: 0 }),
    // Subject is set once, by whoever opens the thread.
    ...(!existing.exists && subject ? { subject } : {}),
    // Bump the other side's unread.
    ...(from === "parent" ? { operatorUnread: FieldValue.increment(1) } : { parentUnread: FieldValue.increment(1) }),
  }, { merge: true });

  const msg = { threadId: id, tenantId, parentEmail, from, senderName, body, createdAt: now };
  const ref = await msgsCol.add(msg);

  // Outbound "you've got a new message" email to the RECIPIENT. Fire-and-forget;
  // an email failure must never fail the send. (Reply-by-email ingest = §JJ.)
  try {
    const pName = await tenantName(tenantId);
    if (from === "parent") {
      const t = (await db.collection("tenants").doc(tenantId).get()).data();
      // Prefer the custom notification address; fall back to the account email.
      const tEmail = (t?.notifyEmail as string) || (t?.email as string | undefined);
      if (tEmail && t?.emailOnNewMessage !== false) {
        emailNewMessage(tEmail, { providerName: pName, senderName, body, deepLink: webUrl });
      }
    } else {
      emailNewMessage(parentEmail, { providerName: pName, senderName, body, deepLink: `${webUrl}/custdash/messages` });
    }
  } catch { /* ignore — never block a message on email */ }

  res.status(201).json({ id: ref.id, ...msg });
});

// POST /api/messages/from-booking — message a family in the context of a booking,
// so EVERY merge field resolves ({SessionDate}, {VenueName}, {BookingRef}, …).
const fromBookingSchema = z.object({
  ref: z.string().trim().min(1).max(60),
  body: z.string().trim().min(1).max(4_000),
  subject: z.string().trim().max(80).optional(),
  // preview=true resolves the merge fields and returns the text WITHOUT sending.
  preview: z.boolean().optional(),
});
messages.post("/from-booking", async (req, res) => {
  const tenantId = operatorTenant(req, res);
  if (!tenantId) return;
  const parsed = fromBookingSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues }); return; }
  const bkSnap = await db.collection("bookings").where("tenantId", "==", tenantId).where("ref", "==", parsed.data.ref).limit(1).get();
  if (bkSnap.empty) { res.status(404).json({ error: "Booking not found" }); return; }
  const b = bkSnap.docs[0].data() as { booker?: string; email?: string; child?: string; kids?: { name?: string }[]; listing?: string; dates?: string; ref?: string; listingId?: string };
  if (!b.email || !isEmail(b.email)) { res.status(400).json({ error: "That booking has no valid email to message." }); return; }

  const pName = await tenantName(tenantId);
  // Venue lives on the tenant's venues[], reached via the listing's venueId.
  // Bookings don't always store listingId, so fall back to matching the listing
  // by name within the tenant.
  let venueName = "";
  let venueId: string | undefined;
  if (b.listingId) venueId = (await db.collection("listings").doc(b.listingId).get()).data()?.venueId as string | undefined;
  if (!venueId && b.listing) {
    const ls = await db.collection("listings").where("tenantId", "==", tenantId).get();
    const match = ls.docs.find((d) => { const x = d.data() as { name?: string; title?: string }; return x.name === b.listing || x.title === b.listing; });
    venueId = match?.data()?.venueId as string | undefined;
  }
  if (venueId) {
    const venues = (await db.collection("tenants").doc(tenantId).get()).data()?.venues as { id: string; name: string }[] | undefined;
    venueName = venues?.find((v) => v.id === venueId)?.name ?? "";
  }
  const vars: MergeVars = {
    parentName: b.booker,
    providerName: pName,
    childName: b.kids?.length ? b.kids.map((k) => k.name).filter(Boolean).join(" & ") : b.child,
    listingName: b.listing,
    sessionDate: b.dates,
    venueName,
    bookingRef: b.ref,
  };
  const body = mergeText(parsed.data.body, vars);
  const mergedSubject = parsed.data.subject ? mergeText(parsed.data.subject, vars) : "";
  // Preview: return the resolved text (exactly what would send) without sending.
  if (parsed.data.preview) { res.json({ subject: mergedSubject, body }); return; }
  const email = b.email.toLowerCase();
  const parentName = b.booker ?? email;
  const id = threadId(tenantId, email);
  const now = new Date().toISOString();
  const tRef = threadsCol.doc(id);
  const existing = await tRef.get();
  const senderName = req.user?.name ?? "Provider";
  await tRef.set({
    tenantId,
    tenantName: existing.exists ? (existing.data()!.tenantName as string) : pName,
    parentEmail: email,
    parentName: existing.exists ? (existing.data()!.parentName as string) : parentName,
    lastBody: body,
    lastFrom: "operator",
    lastAt: now,
    operatorHidden: false,
    ...(existing.exists ? {} : { createdAt: now, operatorUnread: 0, parentUnread: 0, ...(mergedSubject ? { subject: mergedSubject } : {}) }),
    parentUnread: FieldValue.increment(1),
  }, { merge: true });
  await msgsCol.add({ threadId: id, tenantId, parentEmail: email, from: "operator", senderName, body, createdAt: now });
  try { emailNewMessage(email, { providerName: pName, senderName, body, deepLink: `${webUrl}/custdash/messages` }); } catch { /* email never blocks */ }
  res.status(201).json({ ok: true, threadId: id });
});

// ─── Notification settings ──────────────────────────────────────────────────
// GET/PUT the operator's "email me when I get a new message" preference (on the
// tenant doc; read by the send handler above).
const readSettings = (d?: FirebaseFirestore.DocumentData) => ({
  emailOnNewMessage: d?.emailOnNewMessage !== false,
  notifyEmail: (d?.notifyEmail as string) ?? "",
  accountEmail: (d?.email as string) ?? "", // shown as the fallback/placeholder
});
messages.get("/settings", async (req, res) => {
  const tenantId = operatorTenant(req, res);
  if (!tenantId) return;
  const snap = await db.collection("tenants").doc(tenantId).get();
  res.json(readSettings(snap.data()));
});
messages.put("/settings", async (req, res) => {
  const tenantId = operatorTenant(req, res);
  if (!tenantId) return;
  const patch: { emailOnNewMessage?: boolean; notifyEmail?: string } = {};
  if (req.body && "emailOnNewMessage" in req.body) patch.emailOnNewMessage = req.body.emailOnNewMessage !== false;
  if (req.body && "notifyEmail" in req.body) {
    const ne = String(req.body.notifyEmail ?? "").trim();
    if (ne && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(ne)) { res.status(400).json({ error: "That doesn’t look like a valid email." }); return; }
    patch.notifyEmail = ne; // "" clears it → falls back to the account email
  }
  const ref = db.collection("tenants").doc(tenantId);
  await ref.set(patch, { merge: true });
  res.json(readSettings((await ref.get()).data()));
});

// ─── Folders ──────────────────────────────────────────────────────────────
// Operator-only, tenant-shared folders to file conversations (e.g. "Resolved").
// A thread carries at most one `folderId`; unfiled threads are the Inbox.
const foldersCol = db.collection("messageFolders");
const folderNameSchema = z.object({ name: z.string().trim().min(1).max(60) });

// Guard: the caller is an operator with a tenant. Returns the tenantId or null
// (having already written the 403).
function operatorTenant(req: import("express").Request, res: import("express").Response): string | null {
  const auth = req.auth!;
  if (!(isOperator(auth.role) && auth.tenantId)) { res.status(403).json({ error: "Requires an operator account" }); return null; }
  return auth.tenantId;
}

// GET /api/messages/folders — this tenant's folders, newest name-sorted.
messages.get("/folders", async (req, res) => {
  const tenantId = operatorTenant(req, res);
  if (!tenantId) return;
  const snap = await foldersCol.where("tenantId", "==", tenantId).get();
  const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Record<string, unknown>) })) as (Record<string, unknown> & { name?: string })[];
  list.sort((a, b) => ((a.name ?? "") < (b.name ?? "") ? -1 : 1));
  res.json(list);
});

// POST /api/messages/folders — create a folder.
messages.post("/folders", async (req, res) => {
  const tenantId = operatorTenant(req, res);
  if (!tenantId) return;
  const parsed = folderNameSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues }); return; }
  const doc = { tenantId, name: parsed.data.name, createdAt: new Date().toISOString() };
  const ref = await foldersCol.add(doc);
  res.status(201).json({ id: ref.id, ...doc });
});

// PUT /api/messages/folders/:id — rename.
messages.put("/folders/:id", async (req, res) => {
  const tenantId = operatorTenant(req, res);
  if (!tenantId) return;
  const parsed = folderNameSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues }); return; }
  const ref = foldersCol.doc(req.params.id);
  const snap = await ref.get();
  if (!snap.exists || snap.data()!.tenantId !== tenantId) { res.status(404).json({ error: "Folder not found" }); return; }
  await ref.set({ name: parsed.data.name }, { merge: true });
  res.json({ id: ref.id, ...snap.data(), name: parsed.data.name });
});

// DELETE /api/messages/folders/:id — delete, and unfile its threads.
messages.delete("/folders/:id", async (req, res) => {
  const tenantId = operatorTenant(req, res);
  if (!tenantId) return;
  const ref = foldersCol.doc(req.params.id);
  const snap = await ref.get();
  if (!snap.exists || snap.data()!.tenantId !== tenantId) { res.status(404).json({ error: "Folder not found" }); return; }
  const filed = await threadsCol.where("tenantId", "==", tenantId).where("folderId", "==", req.params.id).get();
  await Promise.all(filed.docs.map((d) => d.ref.set({ folderId: FieldValue.delete() }, { merge: true })));
  await ref.delete();
  res.json({ ok: true });
});

// PUT /api/messages/threads/:id/folder — move a thread into a folder (or Inbox
// when folderId is null/empty). Operator-only, and only their own threads.
messages.put("/threads/:id/folder", async (req, res) => {
  const tenantId = operatorTenant(req, res);
  if (!tenantId) return;
  const folderId = typeof req.body?.folderId === "string" && req.body.folderId ? req.body.folderId : null;
  const tRef = threadsCol.doc(req.params.id);
  const tSnap = await tRef.get();
  if (!tSnap.exists || tSnap.data()!.tenantId !== tenantId) { res.status(404).json({ error: "Conversation not found" }); return; }
  if (folderId) {
    const fSnap = await foldersCol.doc(folderId).get();
    if (!fSnap.exists || fSnap.data()!.tenantId !== tenantId) { res.status(400).json({ error: "Unknown folder" }); return; }
  }
  await tRef.set({ folderId: folderId ?? FieldValue.delete() }, { merge: true });
  res.json({ ok: true, folderId });
});

// ─── Broadcast: message every family booked on a listing ────────────────────
const broadcastsCol = db.collection("broadcasts");
const broadcastSchema = z.object({
  // Target by listing (everyone booked on it) and/or specific families by email.
  // A family reached more than once still only gets the message once.
  listings: z.array(z.string().trim().min(1).max(200)).max(50).default([]),
  // Not .email() here — a single malformed address must not reject the whole
  // send. Invalid ones are dropped below (and only known customers are kept).
  emails: z.array(z.string().trim().max(160)).max(500).default([]),
  // Families to drop from a listing broadcast (the operator un-ticked them).
  excludeEmails: z.array(z.string().trim().max(160)).max(2_000).default([]),
  body: z.string().trim().min(1).max(4_000),
  subject: z.string().trim().max(80).optional(),
}).refine((d) => d.listings.length + d.emails.length > 0, { message: "Pick at least one listing or family" });
const isEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

// POST /api/messages/listing-recipients — the families booked on the given
// listings (deduped), so the operator can review + un-tick before broadcasting.
messages.post("/listing-recipients", async (req, res) => {
  const tenantId = operatorTenant(req, res);
  if (!tenantId) return;
  const listings: string[] = Array.isArray(req.body?.listings) ? req.body.listings.map(String) : [];
  if (!listings.length) { res.json([]); return; }
  const wanted = new Set(listings);
  const bk = await db.collection("bookings").where("tenantId", "==", tenantId).get();
  const byEmail = new Map<string, { email: string; name: string; child?: string; listing?: string }>();
  bk.docs.forEach((d) => {
    const b = d.data() as { email?: string; booker?: string; listing?: string; child?: string };
    if (b.email && isEmail(b.email) && b.listing && wanted.has(b.listing)) {
      const el = b.email.toLowerCase();
      if (!byEmail.has(el)) byEmail.set(el, { email: el, name: b.booker ?? b.email, child: b.child, listing: b.listing });
    }
  });
  res.json([...byEmail.values()].sort((a, b) => (a.name < b.name ? -1 : 1)));
});
messages.post("/broadcast", async (req, res) => {
  const tenantId = operatorTenant(req, res);
  if (!tenantId) return;
  const parsed = broadcastSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues }); return; }
  const recipients = new Map<string, string>(); // email → best-known name (deduped)
  const childByEmail = new Map<string, string>(); // email → child name(s), for {ChildName}
  const wanted = new Set(parsed.data.listings);
  if (wanted.size) {
    const bk = await db.collection("bookings").where("tenantId", "==", tenantId).get();
    bk.docs.forEach((d) => {
      const b = d.data() as { email?: string; booker?: string; listing?: string; child?: string };
      if (b.email && isEmail(b.email) && b.listing && wanted.has(b.listing)) {
        const el = b.email.toLowerCase();
        recipients.set(el, b.booker ?? b.email);
        if (b.child) childByEmail.set(el, b.child);
      }
    });
  }
  if (parsed.data.emails.length) {
    // Only the tenant's own customers, and only valid addresses — never
    // arbitrary or malformed ones.
    const custSnap = await db.collection("customers").where("tenantId", "==", tenantId).get();
    const byEmail = new Map<string, string>();
    const kidsByEmail = new Map<string, string>();
    custSnap.docs.forEach((d) => {
      const c = d.data() as { email?: string; name?: string; children?: { name?: string }[] };
      if (c.email && isEmail(c.email)) {
        byEmail.set(c.email.toLowerCase(), c.name ?? c.email);
        const kids = (c.children ?? []).map((k) => k.name).filter(Boolean).join(" & ");
        if (kids) kidsByEmail.set(c.email.toLowerCase(), kids);
      }
    });
    for (const e of parsed.data.emails) {
      const el = e.toLowerCase();
      if (isEmail(el) && byEmail.has(el)) {
        recipients.set(el, byEmail.get(el)!);
        if (!childByEmail.has(el) && kidsByEmail.has(el)) childByEmail.set(el, kidsByEmail.get(el)!);
      }
    }
  }
  // Drop any families the operator un-ticked.
  for (const e of parsed.data.excludeEmails) recipients.delete(e.toLowerCase());
  if (recipients.size === 0) { res.status(400).json({ error: "No matching families to message" }); return; }
  const now = new Date().toISOString();
  const senderName = req.user?.name ?? "Provider";
  const tName = await tenantName(tenantId);
  // {ListingName} is only unambiguous when exactly one listing was targeted.
  const listingName = parsed.data.listings.length === 1 ? parsed.data.listings[0] : "";
  await Promise.all([...recipients].map(async ([email, name]) => {
    const id = threadId(tenantId, email);
    const tRef = threadsCol.doc(id);
    const existing = await tRef.get();
    const rbody = mergeText(parsed.data.body, { parentName: name, providerName: tName, childName: childByEmail.get(email), listingName });
    await tRef.set({
      tenantId,
      tenantName: existing.exists ? (existing.data()!.tenantName as string) : tName,
      parentEmail: email,
      parentName: existing.exists ? (existing.data()!.parentName as string) : name,
      lastBody: rbody,
      lastFrom: "operator",
      lastAt: now,
      // New threads born from a broadcast stay hidden from the operator inbox
      // until the family replies (a reply flips operatorHidden=false via the main
      // send handler). Existing threads keep whatever visibility they had.
      ...(existing.exists ? {} : { createdAt: now, operatorUnread: 0, parentUnread: 0, operatorHidden: true, ...(parsed.data.subject ? { subject: parsed.data.subject } : {}) }),
      parentUnread: FieldValue.increment(1),
    }, { merge: true });
    await msgsCol.add({ threadId: id, tenantId, parentEmail: email, from: "operator", senderName, body: rbody, createdAt: now, broadcast: true });
  }));
  // One record per bulk send — the single row the operator sees instead of N threads.
  await broadcastsCol.add({
    tenantId,
    body: parsed.data.body,
    subject: parsed.data.subject ?? "",
    sentAt: now,
    senderName,
    recipientCount: recipients.size,
    recipients: [...recipients].slice(0, 500).map(([email, name]) => ({ email, name })),
  });
  res.json({ ok: true, sent: recipients.size });
});

// GET /api/messages/broadcasts — the operator's bulk sends (one row each).
messages.get("/broadcasts", async (req, res) => {
  const tenantId = operatorTenant(req, res);
  if (!tenantId) return;
  const snap = await broadcastsCol.where("tenantId", "==", tenantId).get();
  const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Record<string, unknown>) })) as (Record<string, unknown> & { sentAt?: string })[];
  list.sort((a, b) => (`${b.sentAt ?? ""}` < `${a.sentAt ?? ""}` ? -1 : 1));
  res.json(list);
});

// ─── Message templates (Pro composer — canned messages) ─────────────────────
const templatesCol = db.collection("messageTemplates");
const templateSchema = z.object({
  name: z.string().trim().min(1).max(80),
  subject: z.string().trim().max(80).optional(),
  body: z.string().trim().min(1).max(4_000),
});
// Built-in presets every provider gets for free (Head Office-owned). They're
// returned by GET /templates with `preset:` ids and aren't stored per tenant —
// so they can be inserted/duplicated but not edited/deleted in place. A provider
// who wants their own wording duplicates one (creates a normal tenant template).
const DEFAULT_TEMPLATES = [
  { id: "preset:booking-confirmation", name: "Booking confirmation", subject: "Your booking is confirmed, {ChildName}!",
    body: "Hi {ParentName},\n\n{ChildName}’s place on {ListingName} is confirmed for {SessionDate} at {VenueName}. Drop-off opens 15 minutes before the start.\n\nSee you there!" },
  { id: "preset:session-reminder", name: "Session reminder", subject: "{ListingName} starts soon, {ChildName}!",
    body: "Hi {ParentName},\n\nJust a reminder that {ChildName} is booked onto {ListingName} on {SessionDate} at {VenueName}. Please bring a packed lunch and a water bottle." },
  { id: "preset:review-request", name: "Thank you / review request", subject: "How was {ChildName}’s time with us?",
    body: "Hi {ParentName},\n\nThanks for booking {ListingName}. We’d love a quick review of how {ChildName} got on — it really helps other families." },
  { id: "preset:waitlist-offer", name: "Waitlist offer", subject: "A space has opened on {ListingName}",
    body: "Hi {ParentName},\n\nGood news — a space has opened for {ChildName} on {ListingName} ({SessionDate}). This offer is held for 24 hours — claim it from your dashboard." },
  { id: "preset:payment-reminder", name: "Payment reminder", subject: "Balance due for {ListingName}",
    body: "Hi {ParentName},\n\nA friendly reminder that a balance is outstanding for {ChildName}’s booking on {ListingName}. You can pay securely from your dashboard." },
  { id: "preset:welcome", name: "Welcome / first booking", subject: "Welcome to {ProviderName}!",
    body: "Hi {ParentName},\n\nWelcome! Your account is ready and {ChildName} is all set. Manage bookings, receipts and messages any time from your dashboard." },
] as const;
messages.get("/templates", async (req, res) => {
  const tenantId = operatorTenant(req, res);
  if (!tenantId) return;
  // First visit: seed the provider's own editable copies of the presets, once.
  // (Head-Office-owned defaults → each tenant gets their own to edit/delete.)
  const tRef = db.collection("tenants").doc(tenantId);
  const tSnap = await tRef.get();
  if (!tSnap.data()?.templatesSeeded) {
    const now = new Date().toISOString();
    const batch = db.batch();
    for (const t of DEFAULT_TEMPLATES) batch.set(templatesCol.doc(), { tenantId, name: t.name, subject: t.subject, body: t.body, createdAt: now });
    batch.set(tRef, { templatesSeeded: true }, { merge: true });
    await batch.commit();
  }
  const snap = await templatesCol.where("tenantId", "==", tenantId).get();
  const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Record<string, unknown>) })) as (Record<string, unknown> & { name?: string })[];
  list.sort((a, b) => ((a.name ?? "") < (b.name ?? "") ? -1 : 1));
  res.json(list);
});
messages.post("/templates", async (req, res) => {
  const tenantId = operatorTenant(req, res);
  if (!tenantId) return;
  const parsed = templateSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues }); return; }
  const doc = { tenantId, name: parsed.data.name, subject: parsed.data.subject ?? "", body: parsed.data.body, createdAt: new Date().toISOString() };
  const ref = await templatesCol.add(doc);
  res.status(201).json({ id: ref.id, ...doc });
});
messages.put("/templates/:id", async (req, res) => {
  const tenantId = operatorTenant(req, res);
  if (!tenantId) return;
  if (req.params.id.startsWith("preset:")) { res.status(400).json({ error: "Presets can’t be edited — duplicate one to make your own." }); return; }
  const parsed = templateSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues }); return; }
  const ref = templatesCol.doc(req.params.id);
  const snap = await ref.get();
  if (!snap.exists || snap.data()!.tenantId !== tenantId) { res.status(404).json({ error: "Template not found" }); return; }
  await ref.set({ name: parsed.data.name, subject: parsed.data.subject ?? "", body: parsed.data.body }, { merge: true });
  res.json({ id: ref.id, ...snap.data(), name: parsed.data.name, subject: parsed.data.subject ?? "", body: parsed.data.body });
});
messages.delete("/templates/:id", async (req, res) => {
  const tenantId = operatorTenant(req, res);
  if (!tenantId) return;
  const ref = templatesCol.doc(req.params.id);
  const snap = await ref.get();
  if (!snap.exists || snap.data()!.tenantId !== tenantId) { res.status(404).json({ error: "Template not found" }); return; }
  await ref.delete();
  res.json({ ok: true });
});

// ─── ActivityOS support channel (operator ↔ platform/HQ) ────────────────────
// A separate conversation from customer messages. HQ (platform portal) reading
// and replying is still to build (handoff §BB.2); this is the operator side.
const supportCol = db.collection("supportMessages");
const supportTopics = ["general", "billing", "bug", "feature", "onboarding", "compliance"] as const;
const supportSchema = z.object({
  body: z.string().trim().min(1).max(4_000),
  topic: z.enum(supportTopics).optional(),
  subject: z.string().trim().max(80).optional(),
});
messages.get("/support", async (req, res) => {
  const tenantId = operatorTenant(req, res);
  if (!tenantId) return;
  const snap = await supportCol.where("tenantId", "==", tenantId).get();
  const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Record<string, unknown>) })) as (Record<string, unknown> & { createdAt?: string })[];
  list.sort((a, b) => (`${a.createdAt ?? ""}` < `${b.createdAt ?? ""}` ? -1 : 1));
  res.json(list);
});
messages.post("/support", async (req, res) => {
  const tenantId = operatorTenant(req, res);
  if (!tenantId) return;
  const parsed = supportSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues }); return; }
  const doc = {
    tenantId,
    tenantName: await tenantName(tenantId),
    from: "tenant" as const,
    senderName: req.user?.name ?? "Operator",
    topic: parsed.data.topic ?? "general",
    subject: parsed.data.subject ?? "",
    body: parsed.data.body,
    createdAt: new Date().toISOString(),
  };
  const ref = await supportCol.add(doc);
  res.status(201).json({ id: ref.id, ...doc });
});
