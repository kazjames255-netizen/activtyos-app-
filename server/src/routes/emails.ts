import { createHmac, timingSafeEqual } from "node:crypto";
import { Router, raw, type Request, type Response } from "express";
import { z } from "zod";
import { db } from "../firebase";
import { performEmailSend, recordOpen, readUnsubToken } from "../lib/emailSend";
import { fromAddress, fromDomain, fromName } from "../lib/mailer";
import { ukNow } from "../lib/scheduler";
import { inboundAddress, inboundConfigured, inboundDomain, tenantSender } from "../lib/sender";
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
async function marketBlock(tenantId: string, scope?: string | null): Promise<(email: string) => boolean> {
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
  // so those still need explicit opt-in. Only bookings IN the active network
  // scope count, so a family booked only with another franchise isn't treated
  // as this scope's soft-opt-in.
  const booked = new Set<string>();
  for (const d of bk.docs) {
    const b = d.data() as { email?: string; status?: string; franchiseId?: string | null };
    if (!b.email || !inScope(b, scope)) continue;
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

// Head-office network scope for email reads/sends. Only a company (HO) account
// narrows the network via ?franchiseId=. Returns:
//   undefined → no scoping (whole network — the default, and every non-HO operator)
//   null      → head-office OWN locations only (bookings with no franchiseId)
//   string    → that one franchise
// A franchise account is always locked to its own franchiseId, whatever it asks for.
function netScope(req: Request): string | null | undefined {
  const auth = req.auth!;
  if (auth.role === "franchise" && auth.franchiseId) return auth.franchiseId;
  if (auth.role === "company") {
    const q = typeof req.query.franchiseId === "string" ? req.query.franchiseId.trim() : "";
    if (q === "__ho__") return null;
    if (q) return q;
  }
  return undefined;
}
const inScope = (b: { franchiseId?: string | null }, scope: string | null | undefined): boolean =>
  scope === undefined ? true : scope === null ? !b.franchiseId : b.franchiseId === scope;

// The distinct families (booker name + email) for a tenant — everyone who's
// booked and isn't cancelled/declined. This is the "all families" audience.
async function familyRecipients(tenantId: string, scope?: string | null): Promise<{ email: string; name: string }[]> {
  const snap = await db.collection("bookings").where("tenantId", "==", tenantId).get();
  const map = new Map<string, string>(); // email → booker name
  for (const d of snap.docs) {
    const b = d.data() as { email?: string; booker?: string; status?: string; franchiseId?: string | null };
    if (!b.email || b.status === "Cancelled" || b.status === "Declined" || !inScope(b, scope)) continue;
    const e = b.email.toLowerCase();
    if (!map.has(e)) map.set(e, (b.booker || "").trim() || e);
  }
  return [...map.entries()].map(([email, name]) => ({ email, name }));
}
const familyEmails = async (tenantId: string, scope?: string | null) => (await familyRecipients(tenantId, scope)).map((r) => r.email);

/** The recipient set a validated send/schedule input resolves to: the chosen
 *  base audience plus any Cc/Bcc addresses, deduped and lowercased. */
async function resolveRecipients(tenantId: string, input: z.infer<typeof sendSchema>, scope?: string | null): Promise<string[]> {
  let base = input.audience === "one"
    ? [input.to!.toLowerCase(), ...(input.recipients?.map((e) => e.toLowerCase()) ?? [])]
    : input.recipients?.length
      ? [...new Set(input.recipients.map((e) => e.toLowerCase()))]
      : await familyEmails(tenantId, scope);
  // Safety net: when head office has narrowed to a network (a franchise, or its
  // own locations), an explicitly-supplied blast list is kept WITHIN that
  // network — a family from another franchise can't be swept in by accident.
  if (input.audience !== "one" && input.recipients?.length && scope !== undefined) {
    const allowed = new Set(await familyEmails(tenantId, scope));
    base = base.filter((e) => allowed.has(e));
  }
  // Cc/Bcc are added to the recipient set (sends go out individually, so there
  // are no shared Cc/Bcc headers — real header-level Cc/Bcc is a mailer
  // enhancement).
  const set = [...new Set([...base, ...splitAddrs(input.cc), ...splitAddrs(input.bcc)])];
  // Marketing sends (a blast — anything that isn't a single "one" email) drop
  // anyone who unsubscribed or turned marketing consent off. PECR compliance.
  if (input.audience === "one") return set;
  const blocked = await marketBlock(tenantId, scope);
  return set.filter((e) => !blocked(e));
}

// GET /api/emails/audiences — live CRM segments, computed from bookings and
// the customer list at request time (never a stored mailing list). The
// front-end renders these on the Audiences tab and campaigns send to them.
emails.get("/audiences", async (req, res) => {
  const tenantId = opScope(req, res);
  if (!tenantId) return;
  const scope = netScope(req);
  const today = new Date().toISOString().slice(0, 10);
  const [bookings, customers] = await Promise.all([
    db.collection("bookings").where("tenantId", "==", tenantId).get(),
    db.collection("customers").where("tenantId", "==", tenantId).get(),
  ]);

  // Per family: do they hold anything current/upcoming, anything at all, a
  // waitlist place? A booking with no days field runs every session — treat
  // it as current. Only bookings in the active network scope count.
  const families = new Map<string, { active: boolean; past: boolean; waitlisted: boolean }>();
  for (const d of bookings.docs) {
    const b = d.data() as { email?: string; status?: string; days?: string[]; franchiseId?: string | null };
    if (!b.email?.includes("@") || !inScope(b, scope)) continue;
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
  // Enquiries live on the customer list with no booking, so they can't be
  // attributed to a network. In a scoped (own-locations / single-franchise)
  // view we omit them rather than guess.
  const enquiries = scope !== undefined ? [] : [...new Set(customers.docs
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
  const list = await familyRecipients(tenantId, netScope(req));
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
  res.json({ fromName: s.name ?? fromName, fromAddress: s.address ?? fromAddress, replyTo: s.replyTo ?? null });
});

// GET /api/emails/mailbox — the tenant's inbound (redirect) address and
// whether anything has actually arrived at it. A provider adds ONE redirect
// rule in Outlook/Gmail pointing here and their parent mail shows up in the
// in-app Inbox. `configured:false` means no INBOUND_EMAIL_DOMAIN is set up
// yet — the UI must say so rather than hand out an address that goes nowhere.
emails.get("/mailbox", async (req, res) => {
  const tenantId = opScope(req, res);
  if (!tenantId) return;
  const address = await inboundAddress(tenantId);
  const s = await readSummary(tenantId);
  res.json({ configured: inboundConfigured, address, received: s.received, lastAt: s.lastAt, pendingVerification: s.pending });
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

  const recipients = await resolveRecipients(auth.tenantId, input, netScope(req));
  if (recipients.length === 0) { res.status(400).json({ error: input.audience === "one" ? "Add at least one recipient address." : "No families to email yet — nobody matches this audience." }); return; }
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

  const recipients = await resolveRecipients(auth.tenantId, input, netScope(req));
  if (recipients.length === 0) { res.status(400).json({ error: input.audience === "one" ? "Add at least one recipient address." : "No families to email yet — nobody matches this audience." }); return; }
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

// How many messages the Inbox loads. The client filters folders in memory, so
// this is the whole working set — generous enough that nobody notices, small
// enough that the cost of opening the Inbox stops growing with mail history.
const MESSAGE_PAGE = 300;

/** Newest-first, capped. Wants a composite index (tenantId ASC, at DESC) —
 *  see firestore.indexes.json. Until that exists Firestore rejects the query,
 *  so fall back to the old full scan rather than break the Inbox; the warning
 *  says what to create and why it's worth it. */
let indexedFetchWorks = true;
async function recentMessages(tenantId: string): Promise<FirebaseFirestore.QueryDocumentSnapshot[]> {
  if (indexedFetchWorks) {
    try {
      return (await msgCol.where("tenantId", "==", tenantId).orderBy("at", "desc").limit(MESSAGE_PAGE).get()).docs;
    } catch (e) {
      indexedFetchWorks = false;
      console.warn(
        "[emails] no (tenantId, at desc) index on emailMessages — falling back to reading EVERY stored message per Inbox load."
        + ` Create the index to cap it at ${MESSAGE_PAGE}: ${(e as Error).message}`,
      );
    }
  }
  return (await msgCol.where("tenantId", "==", tenantId).get()).docs;
}

// GET /api/emails/messages — the recent window (client filters folders).
emails.get("/messages", async (req, res) => {
  const tenantId = opScope(req, res);
  if (!tenantId) return;
  const snap = { docs: await recentMessages(tenantId) };
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

/** Google's forwarding-confirmation mail → the code and one-click link inside
 *  it. Matched on Google's own sender first, with a subject fallback in case
 *  the inbound provider drops the address. */
function gmailConfirmation(fromEmail?: string, subject?: string, text?: string): { code?: string; link?: string } | null {
  const isGoogle = (fromEmail ?? "").toLowerCase().includes("forwarding-noreply@google.com")
    || /forwarding confirmation/i.test(subject ?? "");
  if (!isGoogle) return null;
  const body = text ?? "";
  return {
    // Gmail's confirmation codes are a long digit run; take the longest so a
    // stray number elsewhere in the mail can't win.
    code: (body.match(/\b\d{6,12}\b/g) ?? []).sort((a, b) => b.length - a.length)[0],
    link: body.match(/https?:\/\/mail\.google\.com\/\S+/)?.[0],
  };
}

type InboundInput = z.infer<typeof inboundSchema>;

/** Which provider does this message belong to? Null when nothing matches —
 *  shared by every inbound source, so they can't drift apart on the rules. */
async function resolveInboundTenant(input: InboundInput): Promise<string | null> {
  let tenantId = input.tenantId ?? null;
  if (!tenantId && input.to) {
    const addr = input.to.toLowerCase();
    for (const field of ["notifyEmail", "email"]) {
      const hit = await db.collection("tenants").where(field, "==", addr).limit(1).get();
      if (!hit.empty) { tenantId = hit.docs[0].id; break; }
    }
    // Either of OUR domains resolves by slug: the sending domain (a reply to
    // the address we sent as) or the inbound domain (a provider's redirect
    // rule). Both are ours, so the local part alone identifies the tenant.
    const ours = [fromDomain, inboundDomain].filter(Boolean);
    if (!tenantId && ours.some((d) => addr.endsWith(`@${d}`))) {
      const slug = addr.slice(0, addr.lastIndexOf("@"));
      const hit = await db.collection("tenants").where("sendingSlug", "==", slug).limit(1).get();
      if (!hit.empty) tenantId = hit.docs[0].id;
    }
  }
  if (!tenantId || !(await db.collection("tenants").doc(tenantId).get()).exists) return null;
  return tenantId;
}

// ── Mailbox summary ───────────────────────────────────────────────────────
// GET /api/emails/mailbox used to read EVERY stored message just to answer
// "how many, when was the last, is a setup code outstanding?" — and the Inbox
// re-asks on every realtime tick. That's a Firestore read per stored email per
// refresh, so the bill grew with a tenant's mail history rather than with
// their activity. One summary doc per tenant, maintained on write, makes it a
// single read forever.
const summaryCol = db.collection("mailboxSummary");

interface MailboxSummary {
  /** Total ever received. Never decremented — deleting a message doesn't mean
   *  mail never arrived, and the UI only asks "has anything come through?". */
  received: number;
  lastAt: string | null;
  /** Newest Gmail confirmation still outstanding, cleared once real mail
   *  arrives after it (proof that forwarding works). */
  pending: { code?: string; link?: string; at?: string } | null;
}

/** Fold one newly-received message into the tenant's summary. */
async function bumpSummary(tenantId: string, at: string, setup: { code?: string; link?: string } | null): Promise<void> {
  const ref = summaryCol.doc(tenantId);
  await db.runTransaction(async (tx) => {
    const cur = (await tx.get(ref)).data() as MailboxSummary | undefined;
    const next: MailboxSummary = {
      received: (cur?.received ?? 0) + 1,
      lastAt: !cur?.lastAt || at > cur.lastAt ? at : cur.lastAt,
      // A setup code becomes the outstanding one; ordinary mail clears it.
      pending: setup ? { ...setup, at } : null,
    };
    tx.set(ref, next, { merge: true });
  });
}

/** The tenant's summary, computed from scratch the first time (tenants that
 *  received mail before this existed have no doc yet) and cached from then on.
 *  That one-off scan is the ONLY time the collection is read in full. */
async function readSummary(tenantId: string): Promise<MailboxSummary> {
  const ref = summaryCol.doc(tenantId);
  const existing = (await ref.get()).data() as MailboxSummary | undefined;
  if (existing) return existing;

  const snap = await msgCol.where("tenantId", "==", tenantId).get();
  let lastAt: string | null = null;
  let pending: MailboxSummary["pending"] = null;
  let lastRealAt = "";
  for (const d of snap.docs) {
    const m = d.data() as { at?: string; verificationCode?: string; verificationLink?: string };
    if (m.at && (!lastAt || m.at > lastAt)) lastAt = m.at;
    if (m.verificationCode || m.verificationLink) {
      if (!pending?.at || (m.at ?? "") > pending.at) pending = { code: m.verificationCode, link: m.verificationLink, at: m.at };
    } else if ((m.at ?? "") > lastRealAt) {
      lastRealAt = m.at ?? "";
    }
  }
  // Same rule the write path applies: a code stops being outstanding once
  // ordinary mail arrives after it.
  if (pending && lastRealAt && (pending.at ?? "") <= lastRealAt) pending = null;

  const summary: MailboxSummary = { received: snap.size, lastAt, pending };
  await ref.set(summary, { merge: true }).catch(() => {});
  return summary;
}

/** File a received message against a provider. Returns the new message id. */
async function storeInbound(tenantId: string, input: InboundInput): Promise<{ id: string; setup: boolean }> {
  // Gmail won't start forwarding until someone confirms a code it emails to
  // the DESTINATION — which is us, a mailbox the provider can't open. Without
  // surfacing it, every Gmail provider dead-ends here. Flag the message and
  // lift the code out so the setup panel can show it.
  const setup = gmailConfirmation(input.fromEmail, input.subject, input.text);

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
    labels: setup ? ["Mailbox setup"] : ([] as string[]),
    ...(setup?.code ? { verificationCode: setup.code } : {}),
    ...(setup?.link ? { verificationLink: setup.link } : {}),
    unread: true,
    starred: !!setup,
    snoozedUntil: null,
    at: new Date().toISOString(),
  };
  const ref = await msgCol.add(doc);
  // Keep the summary in step. Never let it fail the delivery — a wrong count
  // is cosmetic, a dropped email isn't.
  await bumpSummary(tenantId, doc.at, setup ? { code: setup.code, link: setup.link } : null)
    .catch((e) => console.error(`[inbound] summary update failed for ${tenantId}:`, (e as Error).message));
  return { id: ref.id, setup: !!setup };
}

export const emailsInbound = Router();
emailsInbound.post("/", async (req, res) => {
  if (req.headers["x-inbound-secret"] !== INBOUND_SECRET) { res.status(401).json({ error: "Bad inbound secret" }); return; }
  const parsed = inboundSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues }); return; }

  const tenantId = await resolveInboundTenant(parsed.data);
  if (!tenantId) { res.status(404).json({ error: "No provider matches that address" }); return; }

  const { id, setup } = await storeInbound(tenantId, parsed.data);
  res.status(201).json({ id, ok: true, ...(setup ? { setup: true } : {}) });
});

// ── Resend inbound webhook (public) ───────────────────────────────────────
// Resend receives mail for our inbound domain (a *.resend.app catch-all, or a
// custom domain once one is pointed at them) and calls this on `email.received`.
//
// Two things make it more than a field rename over the generic endpoint above:
//   • The webhook carries METADATA ONLY — no body. The message itself has to be
//     fetched back from Resend's API with the id it gives us.
//   • It's signed (Svix), not shared-secret. Verification needs the RAW body,
//     so this mounts BEFORE express.json — same as the Stripe webhook.
//
// Local setup: cloudflared tunnel --url http://localhost:4000, point a Resend
// webhook at <public-url>/api/emails/inbound/resend for the `email.received`
// event, then put its signing secret in RESEND_WEBHOOK_SECRET and an API key
// in RESEND_API_KEY.
export const emailsResendInbound = Router();

/** Svix signature check — the scheme Resend's webhooks use.
 *  Signs "<id>.<timestamp>.<body>" with the base64 secret after its whsec_
 *  prefix; the header holds space-separated "v1,<sig>" candidates. */
function svixVerified(rawBody: Buffer, headers: Request["headers"], secret: string): boolean {
  const id = headers["svix-id"];
  const timestamp = headers["svix-timestamp"];
  const signature = headers["svix-signature"];
  if (typeof id !== "string" || typeof timestamp !== "string" || typeof signature !== "string") return false;

  // Reject stale deliveries — a captured request must not be replayable.
  const age = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (!Number.isFinite(age) || age > 300) return false;

  const key = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  const expected = createHmac("sha256", key).update(`${id}.${timestamp}.${rawBody.toString("utf8")}`).digest();
  // Any candidate matching is a pass — Svix sends several during key rotation.
  return signature.split(" ").some((part) => {
    const sig = part.startsWith("v1,") ? part.slice(3) : null;
    if (!sig) return false;
    const given = Buffer.from(sig, "base64");
    return given.length === expected.length && timingSafeEqual(given, expected);
  });
}

/** "Jane Patel <jane@example.com>" → both halves; a bare address works too. */
function parseAddress(value: string): { name: string; email?: string } {
  const angled = value.match(/^\s*(.*?)\s*<([^>]+)>\s*$/);
  if (angled) {
    const name = angled[1].replace(/^"|"$/g, "").trim();
    const email = angled[2].trim().toLowerCase();
    return { name: name || email, email };
  }
  const bare = value.trim();
  return bare.includes("@") ? { name: bare, email: bare.toLowerCase() } : { name: bare || "Unknown sender" };
}

interface ResendReceived {
  to?: string[];
  received_for?: string[];
  from?: string;
  subject?: string;
  text?: string | null;
  html?: string;
  attachments?: { filename?: string; size?: number }[];
}

emailsResendInbound.post("/", raw({ type: "application/json", limit: "5mb" }), async (req, res) => {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  const apiKey = process.env.RESEND_API_KEY;
  if (!secret || !apiKey) { res.status(503).json({ error: "Resend inbound not configured" }); return; }
  if (!Buffer.isBuffer(req.body) || !svixVerified(req.body, req.headers, secret)) {
    res.status(400).json({ error: "Bad signature" });
    return;
  }

  let event: { type?: string; data?: { email_id?: string } };
  try { event = JSON.parse(req.body.toString("utf8")); }
  catch { res.status(400).json({ error: "Bad payload" }); return; }
  // Anything that isn't a received email is acknowledged and ignored, so
  // Resend doesn't retry it forever.
  if (event.type !== "email.received" || !event.data?.email_id) { res.json({ ok: true, ignored: true }); return; }

  const fetched = await fetch(`https://api.resend.com/emails/receiving/${event.data.email_id}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  }).catch(() => null);
  if (!fetched?.ok) {
    // A failed fetch IS worth retrying — 500 asks Resend to redeliver.
    console.error(`[inbound] couldn't fetch ${event.data.email_id} from Resend: ${fetched?.status ?? "network error"}`);
    res.status(500).json({ error: "Couldn't fetch the message" });
    return;
  }
  const mail = (await fetched.json()) as ResendReceived;

  // `received_for` is the envelope recipient — the address mail was actually
  // delivered to. `to` is the header, which on a FORWARDED message still names
  // the provider's own mailbox, not us. Envelope first or forwarding breaks.
  const deliveredTo = mail.received_for?.[0] ?? mail.to?.[0];
  const sender = parseAddress(mail.from ?? "");

  const input: InboundInput = {
    to: deliveredTo,
    from: sender.name,
    fromEmail: sender.email,
    subject: mail.subject?.trim() || "(no subject)",
    text: mail.text ?? "",
    ...(mail.html ? { html: mail.html } : {}),
    ...(mail.attachments?.length
      ? { attachments: mail.attachments.map((a) => ({ name: a.filename ?? "attachment", size: a.size ? String(a.size) : undefined })) }
      : {}),
  };

  const tenantId = await resolveInboundTenant(input);
  if (!tenantId) {
    // Mail for an address no provider owns is a dead letter, not a failure —
    // 200 so Resend stops retrying, logged so it's diagnosable.
    console.warn(`[inbound] no provider matches ${deliveredTo ?? "(no recipient)"} — dropped`);
    res.json({ ok: true, ignored: true });
    return;
  }
  const { id, setup } = await storeInbound(tenantId, input);
  console.log(`[inbound] ${sender.email ?? sender.name} → ${deliveredTo} filed for ${tenantId}${setup ? " (mailbox setup code)" : ""}`);
  res.status(201).json({ id, ok: true });
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
