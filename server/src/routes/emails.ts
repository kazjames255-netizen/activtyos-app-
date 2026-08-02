import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { db } from "../firebase";
import { performEmailSend, recordOpen, readUnsubToken } from "../lib/emailSend";
import { fromAddress, fromName } from "../lib/mailer";
import { ukNow } from "../lib/scheduler";
import { tenantSender } from "../lib/sender";
import type { Role } from "../middleware/role";

// Email (Communication) — the out-of-app channel. An operator emails their
// families: everyone who's booked, or one address. Reuses the transactional
// mailer. A `dryRun` returns who WOULD receive it (preview before a blast),
// and every real send is recorded in `emails` for a history/audit trail.
export const emails = Router();
const col = db.collection("emails");
const suppressCol = db.collection("emailSuppressions");
const canManage = (role: Role) => role === "company" || role === "freelancer" || role === "franchise";
const MAX_RECIPIENTS = 2000;

// Who may receive MARKETING — enforcing UK PECR consent, and it is NOT one
// rule for everyone (see AGENTS/handoff notes on marketing law):
//   • Booked families → the "soft opt-in": you sold them a place, so you may
//     market similar activities UNLESS they opted out. On by default.
//   • Not booked (enquiries / added under New Family / synced) → no sale, so
//     they need EXPLICIT opt-in (marketingOptIn === true). Off by default.
//   • A suppression (one-click unsubscribe) or marketingOptIn === false always
//     blocks, for everyone.
// Transactional mail (audience "one" — confirmations, payment links) ignores
// all of this. Returns a predicate; email is lowercased by the caller/inside.
async function marketBlock(tenantId: string): Promise<(email: string) => boolean> {
  const [sup, cust, bk] = await Promise.all([
    suppressCol.where("tenantId", "==", tenantId).get(),
    db.collection("customers").where("tenantId", "==", tenantId).get(),
    db.collection("bookings").where("tenantId", "==", tenantId).get(),
  ]);
  const suppressed = new Set<string>();
  for (const d of sup.docs) { const e = (d.data() as { email?: string }).email; if (e) suppressed.add(e.toLowerCase()); }
  const optIn = new Map<string, boolean>();
  for (const d of cust.docs) { const c = d.data() as { email?: string; marketingOptIn?: boolean }; if (c.email && typeof c.marketingOptIn === "boolean") optIn.set(c.email.toLowerCase(), c.marketingOptIn); }
  // "Booked" = holds or held a real place. Waitlisted / Offered is not a sale,
  // so those still need explicit opt-in.
  const booked = new Set<string>();
  for (const d of bk.docs) {
    const b = d.data() as { email?: string; status?: string };
    if (!b.email) continue;
    if (b.status === "Cancelled" || b.status === "Declined" || b.status === "Waitlisted" || b.status === "Offered") continue;
    booked.add(b.email.toLowerCase());
  }
  return (email: string): boolean => {
    const e = email.toLowerCase();
    if (suppressed.has(e)) return true;      // unsubscribed — always blocked
    if (optIn.get(e) === false) return true; // explicit opt-out — always blocked
    if (booked.has(e)) return false;         // soft opt-in — on unless opted out
    return optIn.get(e) !== true;            // never booked — needs explicit opt-in
  };
}

const sendSchema = z.object({
  subject: z.string().trim().min(1).max(200),
  body: z.string().trim().min(1).max(20_000),
  html: z.string().max(400_000).optional(),            // pre-rendered HTML (a designed post/newsletter) — sent as-is
  audience: z.enum(["all", "one"]).default("all"),
  to: z.string().trim().email().max(160).optional(),
  recipients: z.array(z.string().trim().email()).max(2000).optional(), // explicit "all" list (operator removed some)
  cc: z.string().trim().max(600).optional(),   // comma-separated Cc addresses
  bcc: z.string().trim().max(600).optional(),  // comma-separated Bcc addresses
  dryRun: z.boolean().default(false),
}).refine((s) => s.audience !== "one" || !!s.to, { message: "Provide a recipient address for a single email" });

// Split a comma/semicolon list into unique lower-cased email addresses.
const splitAddrs = (s?: string) => (s ?? "").split(/[,;]/).map((a) => a.trim().toLowerCase()).filter((a) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(a));

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

// The distinct families (booker name + email) for a tenant — everyone who's
// booked and isn't cancelled/declined. This is the "all families" audience.
async function familyRecipients(tenantId: string): Promise<{ email: string; name: string }[]> {
  const snap = await db.collection("bookings").where("tenantId", "==", tenantId).get();
  const map = new Map<string, string>(); // email → booker name
  for (const d of snap.docs) {
    const b = d.data() as { email?: string; booker?: string; status?: string };
    if (!b.email || b.status === "Cancelled" || b.status === "Declined") continue;
    const e = b.email.toLowerCase();
    if (!map.has(e)) map.set(e, (b.booker || "").trim() || e);
  }
  return [...map.entries()].map(([email, name]) => ({ email, name }));
}
const familyEmails = async (tenantId: string) => (await familyRecipients(tenantId)).map((r) => r.email);

/** The recipient set a validated send/schedule input resolves to: the chosen
 *  base audience plus any Cc/Bcc addresses, deduped and lowercased. */
async function resolveRecipients(tenantId: string, input: z.infer<typeof sendSchema>): Promise<string[]> {
  const base = input.audience === "one"
    ? [input.to!.toLowerCase()]
    : input.recipients?.length
      ? [...new Set(input.recipients.map((e) => e.toLowerCase()))]
      : await familyEmails(tenantId);
  // Cc/Bcc are added to the recipient set (sends go out individually, so there
  // are no shared Cc/Bcc headers — real header-level Cc/Bcc is a mailer
  // enhancement).
  const set = [...new Set([...base, ...splitAddrs(input.cc), ...splitAddrs(input.bcc)])];
  // Marketing sends (a blast — anything that isn't a single "one" email) drop
  // anyone who unsubscribed or turned marketing consent off. PECR compliance.
  if (input.audience === "one") return set;
  const blocked = await marketBlock(tenantId);
  return set.filter((e) => !blocked(e));
}

// GET /api/emails/audiences — live CRM segments, computed from bookings and
// the customer list at request time (never a stored mailing list). The
// front-end renders these on the Audiences tab and campaigns send to them.
emails.get("/audiences", async (req, res) => {
  const tenantId = opScope(req, res);
  if (!tenantId) return;
  const today = new Date().toISOString().slice(0, 10);
  const [bookings, customers] = await Promise.all([
    db.collection("bookings").where("tenantId", "==", tenantId).get(),
    db.collection("customers").where("tenantId", "==", tenantId).get(),
  ]);

  // Per family: do they hold anything current/upcoming, anything at all, a
  // waitlist place? A booking with no days field runs every session — treat
  // it as current.
  const families = new Map<string, { active: boolean; past: boolean; waitlisted: boolean }>();
  for (const d of bookings.docs) {
    const b = d.data() as { email?: string; status?: string; days?: string[] };
    if (!b.email?.includes("@")) continue;
    const e = b.email.toLowerCase();
    const f = families.get(e) ?? { active: false, past: false, waitlisted: false };
    if (b.status === "Waitlisted" || b.status === "Offered") f.waitlisted = true;
    else if (b.status !== "Cancelled" && b.status !== "Declined") {
      const last = b.days?.length ? [...b.days].sort().pop()! : null;
      if (last && last < today) f.past = true;
      else f.active = true;
    }
    families.set(e, f);
  }
  const emailsOf = (pick: (f: { active: boolean; past: boolean; waitlisted: boolean }) => boolean) =>
    [...families.entries()].filter(([, f]) => pick(f)).map(([e]) => e);

  // email → display name, so the audience cards can show a person, not just an
  // address. Booker name (from a booking) wins; else the customer-record name.
  const nameOf = new Map<string, string>();
  for (const d of bookings.docs) {
    const b = d.data() as { email?: string; booker?: string };
    const e = b.email?.toLowerCase();
    if (e && b.booker?.trim() && !nameOf.has(e)) nameOf.set(e, b.booker.trim());
  }
  for (const d of customers.docs) {
    const c = d.data() as { email?: string; name?: string; firstName?: string; lastName?: string };
    const e = c.email?.toLowerCase();
    if (!e || nameOf.has(e)) continue;
    const nm = c.name?.trim() || [c.firstName, c.lastName].filter(Boolean).join(" ").trim();
    if (nm) nameOf.set(e, nm);
  }

  const all = emailsOf((f) => f.active || f.past);
  const past = emailsOf((f) => f.past && !f.active);
  const waitlisted = emailsOf((f) => f.waitlisted);
  // On the customer list (an enquiry, a phone-in, an operator add) but never
  // actually booked.
  const enquiries = [...new Set(customers.docs
    .map((d) => ((d.data() as { email?: string }).email ?? "").toLowerCase())
    .filter((e) => e.includes("@") && !families.has(e)))];

  // Marketing audiences exclude anyone who can't lawfully be marketed to, so the
  // count matches who will actually receive a campaign. Same split as the send
  // path (marketBlock): booked = soft opt-in (on unless opted out); never-booked
  // = needs explicit opt-in. Suppression / opt-out always blocks.
  const optIn = new Map<string, boolean>();
  for (const d of customers.docs) { const c = d.data() as { email?: string; marketingOptIn?: boolean }; if (c.email && typeof c.marketingOptIn === "boolean") optIn.set(c.email.toLowerCase(), c.marketingOptIn); }
  const sup = await suppressCol.where("tenantId", "==", tenantId).get();
  const suppressed = new Set<string>();
  for (const d of sup.docs) { const e = (d.data() as { email?: string }).email; if (e) suppressed.add(e.toLowerCase()); }
  const blockedFor = (e: string): boolean => {
    if (suppressed.has(e)) return true;
    if (optIn.get(e) === false) return true;
    const f = families.get(e);
    if (f && (f.active || f.past)) return false; // booked → soft opt-in
    return optIn.get(e) !== true;                // never booked → needs explicit opt-in
  };
  const keep = (es: string[]) => es.filter((e) => !blockedFor(e));
  const seg = (id: string, name: string, desc: string, es: string[]) => {
    const kept = keep(es);
    return { id, name, desc, count: kept.length, emails: kept, people: kept.map((e) => ({ email: e, name: nameOf.get(e) })) };
  };
  res.json([
    seg("all", "All families", "Everyone who has booked with you (not cancelled)", all),
    seg("active", "Active families", "Has a current or upcoming booking", emailsOf((f) => f.active)),
    seg("past", "Past customers", "Booked before, nothing current or upcoming — win-back material", past),
    seg("waitlisted", "Waitlisted", "Currently waiting or holding an offer for a place", waitlisted),
    seg("enquiries", "New enquiries (no booking)", "On your customer list but never booked", enquiries),
  ]);
});

// GET /api/emails/recipients — the families the "all" blast would reach (name + email).
emails.get("/recipients", async (req, res) => {
  const tenantId = opScope(req, res);
  if (!tenantId) return;
  const list = await familyRecipients(tenantId);
  res.json({ count: list.length, families: list, sample: list.slice(0, 20).map((r) => r.email) });
});

// POST /api/emails/suppress — the operator removes a family from marketing
// (the ✕ in an audience card). Reversible: adds to the suppression list and
// flips the customer's marketing consent off, so they stop appearing in every
// audience — but the customer record itself is untouched.
emails.post("/suppress", async (req, res) => {
  const tenantId = opScope(req, res);
  if (!tenantId) return;
  const email = String((req.body as { email?: string }).email ?? "").trim().toLowerCase();
  if (!email.includes("@")) { res.status(400).json({ error: "A valid email is required" }); return; }
  const existing = await suppressCol.where("tenantId", "==", tenantId).where("email", "==", email).limit(1).get();
  if (existing.empty) await suppressCol.add({ tenantId, email, at: new Date().toISOString(), by: "operator" });
  const cust = await db.collection("customers").where("tenantId", "==", tenantId).where("email", "==", email).limit(1).get();
  if (!cust.empty) await cust.docs[0].ref.set({ marketingOptIn: false }, { merge: true });
  res.json({ ok: true, email });
});

// GET /api/emails/sender — the identity this tenant's mail goes out under, so
// the composer can show it before anything is sent. The address is the
// platform's for everyone (one authenticated sending domain); only the name
// and Reply-To are the provider's. See lib/sender.ts.
emails.get("/sender", async (req, res) => {
  const tenantId = opScope(req, res);
  if (!tenantId) return;
  const s = await tenantSender(tenantId);
  res.json({ fromName: s.name ?? fromName, fromAddress, replyTo: s.replyTo ?? null });
});

// GET /api/emails — the send history (operators).
emails.get("/", async (req, res) => {
  const tenantId = opScope(req, res);
  if (!tenantId) return;
  const snap = await col.where("tenantId", "==", tenantId).get();
  const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Record<string, unknown>) })) as (Record<string, unknown> & { createdAt?: string })[];
  list.sort((a, b) => (`${b.createdAt ?? ""}` < `${a.createdAt ?? ""}` ? -1 : 1));
  res.json(list);
});

// POST /api/emails/send — send (or dry-run) to the chosen audience.
emails.post("/send", async (req, res) => {
  const auth = req.auth!;
  if (!canManage(auth.role) || !auth.tenantId) { res.status(403).json({ error: "Requires an operator account" }); return; }
  const parsed = sendSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues }); return; }
  const input = parsed.data;

  const recipients = await resolveRecipients(auth.tenantId, input);
  if (recipients.length === 0) { res.status(400).json({ error: "No families to email yet" }); return; }
  if (recipients.length > MAX_RECIPIENTS) { res.status(400).json({ error: `Too many recipients (${recipients.length}) — max ${MAX_RECIPIENTS}` }); return; }

  if (input.dryRun) { res.json({ dryRun: true, recipientCount: recipients.length, sample: recipients.slice(0, 20) }); return; }

  const doc = await performEmailSend({
    tenantId: auth.tenantId,
    subject: input.subject,
    body: input.body,
    html: input.html,
    recipients,
    audience: input.audience,
    sentBy: req.user?.email ?? "operator",
    sentByName: req.user?.name ?? req.user?.email ?? "Operator",
  });
  res.status(201).json(doc);
});

// ── Scheduled sends ───────────────────────────────────────────────────────
// The split Send button's "Schedule send": the FULL payload is captured now
// (recipients resolved at schedule time, like a dry-run freeze), persisted in
// `scheduledEmails`, and a sweep fires it through the same send engine at
// sendAt. Times are UK wall-clock, matching every other timing in the app.

const schedCol = db.collection("scheduledEmails");
const scheduleSchema = sendSchema.innerType().extend({
  sendAt: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/, "sendAt must be YYYY-MM-DDTHH:MM"),
}).refine((s) => s.audience !== "one" || !!s.to, { message: "Provide a recipient address for a single email" });

const nowStamp = () => { const { date, minutes } = ukNow(); return `${date}T${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`; };

// POST /api/emails/schedule — queue an email for a future UK wall-clock time.
emails.post("/schedule", async (req, res) => {
  const auth = req.auth!;
  if (!canManage(auth.role) || !auth.tenantId) { res.status(403).json({ error: "Requires an operator account" }); return; }
  const parsed = scheduleSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues }); return; }
  const input = parsed.data;
  const sendAt = input.sendAt.slice(0, 16);
  if (sendAt <= nowStamp()) { res.status(400).json({ error: "Pick a time in the future — or just press Send" }); return; }

  const recipients = await resolveRecipients(auth.tenantId, input);
  if (recipients.length === 0) { res.status(400).json({ error: "No families to email yet" }); return; }
  if (recipients.length > MAX_RECIPIENTS) { res.status(400).json({ error: `Too many recipients (${recipients.length}) — max ${MAX_RECIPIENTS}` }); return; }

  const doc = {
    tenantId: auth.tenantId,
    subject: input.subject,
    body: input.body,
    ...(input.html && input.html.trim() ? { html: input.html } : {}),
    recipients,
    recipientCount: recipients.length,
    audience: input.audience,
    sendAt,
    status: "scheduled" as const,
    createdBy: req.user?.email ?? "operator",
    createdByName: req.user?.name ?? req.user?.email ?? "Operator",
    createdAt: new Date().toISOString(),
  };
  const ref = await schedCol.add(doc);
  res.status(201).json({ id: ref.id, ...doc, recipients: undefined });
});

// GET /api/emails/scheduled — the tenant's queue (pending first, then recent).
emails.get("/scheduled", async (req, res) => {
  const tenantId = opScope(req, res);
  if (!tenantId) return;
  const snap = await schedCol.where("tenantId", "==", tenantId).get();
  const list = snap.docs
    .map((d) => { const { recipients: _r, ...rest } = d.data() as Record<string, unknown>; return { id: d.id, ...rest }; })
    .sort((a, b) => `${(a as { sendAt?: string }).sendAt}`.localeCompare(`${(b as { sendAt?: string }).sendAt}`));
  res.json(list);
});

// DELETE /api/emails/scheduled/:id — cancel a send that hasn't fired yet.
emails.delete("/scheduled/:id", async (req, res) => {
  const tenantId = opScope(req, res);
  if (!tenantId) return;
  const snap = await schedCol.doc(req.params.id).get();
  if (!snap.exists || snap.data()!.tenantId !== tenantId) { res.status(404).json({ error: "Scheduled email not found" }); return; }
  if (snap.data()!.status !== "scheduled") { res.status(409).json({ error: "This email has already been sent" }); return; }
  await snap.ref.set({ status: "cancelled", cancelledAt: new Date().toISOString() }, { merge: true });
  res.json({ ok: true });
});

// ── Inbox: the received-mail store ────────────────────────────────────────
// One `emailMessages` doc per received email. What lands here comes from the
// inbound webhook below (a provider mailbox forwarding into the API); the
// Sent and Scheduled folders are derived from `emails` history and
// `scheduledEmails`, so this store only holds mail that ARRIVED. Snoozes
// wake lazily at read time — no sweep needed for a folder listing.

const msgCol = db.collection("emailMessages");
const MSG_FOLDERS = ["inbox", "archive", "snoozed", "spam", "trash"] as const;

const msgPatchSchema = z.object({
  folder: z.enum(MSG_FOLDERS).optional(),
  unread: z.boolean().optional(),
  starred: z.boolean().optional(),
  labels: z.array(z.string().trim().max(30)).max(10).optional(),
  /** ISO time to snooze until — sets folder "snoozed"; null clears it. */
  snoozedUntil: z.string().max(40).nullable().optional(),
});

// GET /api/emails/messages — every received message (client filters folders).
emails.get("/messages", async (req, res) => {
  const tenantId = opScope(req, res);
  if (!tenantId) return;
  const snap = await msgCol.where("tenantId", "==", tenantId).get();
  const now = new Date().toISOString();
  const list = [] as (Record<string, unknown> & { id: string; at?: string })[];
  for (const d of snap.docs) {
    const m = d.data() as Record<string, unknown> & { folder?: string; snoozedUntil?: string | null };
    // A snooze that has run out returns to the inbox, unread again.
    if (m.folder === "snoozed" && m.snoozedUntil && m.snoozedUntil <= now) {
      await d.ref.set({ folder: "inbox", snoozedUntil: null, unread: true }, { merge: true });
      m.folder = "inbox"; m.snoozedUntil = null; (m as { unread?: boolean }).unread = true;
    }
    list.push({ id: d.id, ...m });
  }
  list.sort((a, b) => `${b.at ?? ""}`.localeCompare(`${a.at ?? ""}`));
  res.json(list);
});

// PATCH /api/emails/messages/:id — star/read/label/move/snooze.
emails.patch("/messages/:id", async (req, res) => {
  const tenantId = opScope(req, res);
  if (!tenantId) return;
  const parsed = msgPatchSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues }); return; }
  const snap = await msgCol.doc(req.params.id).get();
  if (!snap.exists || snap.data()!.tenantId !== tenantId) { res.status(404).json({ error: "Message not found" }); return; }
  const p = parsed.data;
  const update: Record<string, unknown> = { ...p };
  if (p.snoozedUntil) update.folder = "snoozed";
  if (p.snoozedUntil === null && snap.data()!.folder === "snoozed" && !p.folder) update.folder = "inbox";
  await snap.ref.set(update, { merge: true });
  const after = await snap.ref.get();
  res.json({ id: after.id, ...after.data() });
});

// DELETE /api/emails/messages/:id — permanent (the client trashes first).
emails.delete("/messages/:id", async (req, res) => {
  const tenantId = opScope(req, res);
  if (!tenantId) return;
  const snap = await msgCol.doc(req.params.id).get();
  if (!snap.exists || snap.data()!.tenantId !== tenantId) { res.status(404).json({ error: "Message not found" }); return; }
  await snap.ref.delete();
  res.json({ ok: true });
});

// ── Inbound email webhook (public) ────────────────────────────────────────
// Where a provider's mailbox lands mail into the app: point an inbound-parse
// route (SES / Postmark / Mailgun / Cloudflare Email Workers…) at this
// endpoint. Authenticated by a shared secret header, not a user token — the
// sender is a mail platform. The tenant is resolved from the To address
// (matching the tenant's notifyEmail/email) or an explicit tenantId the
// forwarding rule adds.
//
// INBOUND_EMAIL_SECRET must be set wherever this is exposed publicly; the
// dev fallback below only exists because there is no deployed environment
// yet (see PROD-READINESS.md).
const INBOUND_SECRET = process.env.INBOUND_EMAIL_SECRET || "dev-inbound";

const inboundSchema = z.object({
  tenantId: z.string().trim().max(60).optional(),
  to: z.string().trim().max(160).optional(),
  from: z.string().trim().max(160).default("Unknown sender"),
  fromEmail: z.string().trim().email().max(160).optional(),
  subject: z.string().trim().max(300).default("(no subject)"),
  text: z.string().max(100_000).default(""),
  html: z.string().max(400_000).optional(),
  attachments: z.array(z.object({ name: z.string().max(200), size: z.string().max(20).optional() })).max(20).optional(),
}).refine((i) => i.tenantId || i.to, { message: "Provide tenantId or a To address" });

export const emailsInbound = Router();
emailsInbound.post("/", async (req, res) => {
  if (req.headers["x-inbound-secret"] !== INBOUND_SECRET) { res.status(401).json({ error: "Bad inbound secret" }); return; }
  const parsed = inboundSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues }); return; }
  const input = parsed.data;

  let tenantId = input.tenantId ?? null;
  if (!tenantId && input.to) {
    const addr = input.to.toLowerCase();
    for (const field of ["notifyEmail", "email"]) {
      const hit = await db.collection("tenants").where(field, "==", addr).limit(1).get();
      if (!hit.empty) { tenantId = hit.docs[0].id; break; }
    }
  }
  if (!tenantId || !(await db.collection("tenants").doc(tenantId).get()).exists) {
    res.status(404).json({ error: "No provider matches that address" });
    return;
  }

  const doc = {
    tenantId,
    folder: "inbox",
    from: input.from,
    ...(input.fromEmail ? { fromEmail: input.fromEmail.toLowerCase() } : {}),
    ...(input.to ? { to: input.to.toLowerCase() } : {}),
    subject: input.subject,
    body: input.text,
    ...(input.html ? { html: input.html } : {}),
    ...(input.attachments?.length ? { attachments: input.attachments } : {}),
    labels: [] as string[],
    unread: true,
    starred: false,
    snoozedUntil: null,
    at: new Date().toISOString(),
  };
  const ref = await msgCol.add(doc);
  res.status(201).json({ id: ref.id, ok: true });
});

// ── Open tracking (public) ────────────────────────────────────────────────
// The 1×1 pixel embedded in every send. Mounted before auth (a mail client
// carries no token). Always answers with the gif, whatever happens.
export const emailsOpen = Router();
const GIF = Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64");
emailsOpen.get("/:id", async (req, res) => {
  await recordOpen(req.params.id, typeof req.query.r === "string" ? req.query.r : "");
  res.set("Content-Type", "image/gif").set("Cache-Control", "no-store").send(GIF);
});

// One-click unsubscribe from a marketing email. Public (a mail client carries no
// token) — mounted before auth. Adds the address to the suppression list and,
// best-effort, flips the customer's marketing consent off.
export const emailsUnsub = Router();
const unsubPage = (title: string, msg: string) => `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title></head><body style="font-family:system-ui,-apple-system,Arial,sans-serif;background:#f4f7fc;margin:0;padding:44px 16px"><div style="max-width:440px;margin:0 auto;background:#fff;border-radius:18px;padding:30px;text-align:center;box-shadow:0 16px 44px -22px rgba(20,33,58,.5)"><div style="font-size:42px">✅</div><h1 style="font-size:21px;color:#16306e;margin:10px 0 8px">${title}</h1><p style="font-size:14px;color:#5b6472;line-height:1.55;margin:0">${msg}</p></div></body></html>`;
emailsUnsub.get("/", async (req, res) => {
  const parsed = readUnsubToken(typeof req.query.u === "string" ? req.query.u : "");
  if (!parsed) { res.status(400).set("Content-Type", "text/html").send(unsubPage("Link not valid", "This unsubscribe link couldn't be read. Reply to the email and we'll take you off the list by hand.")); return; }
  const email = parsed.email.toLowerCase();
  try {
    const existing = await suppressCol.where("tenantId", "==", parsed.tenantId).where("email", "==", email).limit(1).get();
    if (existing.empty) await suppressCol.add({ tenantId: parsed.tenantId, email, at: new Date().toISOString() });
    const cust = await db.collection("customers").where("tenantId", "==", parsed.tenantId).where("email", "==", email).limit(1).get();
    if (!cust.empty) await cust.docs[0].ref.set({ marketingOptIn: false }, { merge: true });
  } catch (e) { console.error(`[unsubscribe] ${email}:`, (e as Error).message); }
  res.set("Content-Type", "text/html").send(unsubPage("You're unsubscribed", `<b>${email}</b> won't get any more marketing emails from us. Booking confirmations and payment updates still come through — those aren't marketing.`));
});
