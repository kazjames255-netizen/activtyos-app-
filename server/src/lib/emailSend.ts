import { FieldValue } from "firebase-admin/firestore";
import { db } from "../firebase";
import { sendMailDetailed } from "./mailer";
import { tenantSender } from "./sender";

// The one-to-many send engine behind the Email page: POST /api/emails/send
// fires it directly, the scheduled-send sweep fires it at sendAt. Every send
// writes an `emails` history doc up front (status "sending"), delivers in the
// background, then records what actually happened — delivered count from the
// transport, opens from the tracking pixel. That history doc IS the campaign
// record the Campaigns/Analytics tabs read.

/** Where the API itself is reachable from an email client (the open pixel
 *  must resolve from the recipient's inbox, not from the web app). */
import { sign, verify } from "./signing";
import { ukToday } from "./ukDate";

export const apiUrl = process.env.API_URL || "http://localhost:4000";

const esc = (s: string) => s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c] as string));

/** Plain-text body → the simple wrapped HTML the composer preview shows. */
export const bodyHtml = (body: string) =>
  `<div style="font-family:system-ui,sans-serif;font-size:15px;line-height:1.5;color:#111">${esc(body).replace(/\n/g, "<br>")}</div>`;

const pixel = (emailId: string, to: string) =>
  `<img src="${apiUrl}/api/emails/open/${emailId}?r=${encodeURIComponent(to)}" width="1" height="1" alt="" style="display:block;width:1px;height:1px;border:0">`;

// A per-recipient unsubscribe token: base64url(tenant:email) + "." + HMAC.
// It used to be the base64 alone — and tenant ids are public (the provider
// directory returns them) — so anyone could unsubscribe any address from any
// provider. The signature makes it tamper-evident, which the old comment
// claimed and the code wasn't.
export const unsubToken = (tenantId: string, email: string) => {
  const body = `${tenantId}:${email.toLowerCase()}`;
  return `${Buffer.from(body).toString("base64url")}.${sign(`unsub:${body}`)}`;
};
/** Unsigned tokens are already sitting in inboxes, and an unsubscribe has to be
 *  honoured — so they're accepted until this date (30 days of sends), then
 *  refused. */
const LEGACY_UNSUB_UNTIL = "2026-10-12";
export const readUnsubToken = (tok: string): { tenantId: string; email: string; legacy?: boolean } | null => {
  try {
    const [b64, sig] = tok.split(".", 2);
    const s = Buffer.from(b64, "base64url").toString("utf8");
    const i = s.indexOf(":");
    if (i < 0) return null;
    const out = { tenantId: s.slice(0, i), email: s.slice(i + 1) };
    if (sig) return verify(`unsub:${s}`, sig) ? out : null;
    return ukToday() < LEGACY_UNSUB_UNTIL ? { ...out, legacy: true } : null;
  } catch { return null; }
};
// Every MARKETING email carries a one-click unsubscribe. Transactional mail (audience "one") doesn't.
const unsubFooter = (tenantId: string, to: string) => {
  const u = `${apiUrl}/api/emails/unsubscribe?u=${unsubToken(tenantId, to)}`;
  return `<div style="margin-top:26px;padding-top:14px;border-top:1px solid #e6ebf2;font-family:Arial,Helvetica,sans-serif;font-size:11px;line-height:1.5;color:#8a94a6;text-align:center">You're getting this because you're on our mailing list. <a href="${u}" style="color:#8a94a6;text-decoration:underline">Unsubscribe</a> at any time.</div>`;
};

// ── Per-recipient merge fields ────────────────────────────────────────────
// {ParentName}/{ChildName} and the booking-scoped {ListingName}/{SessionDate}/
// {VenueName}/{BookingRef} resolve per recipient from that family's most
// relevant booking (next upcoming, else latest past). This is what lets
// booking-scoped templates be used in bulk Email sends — nothing goes out
// with a raw {Token} in it.

const TOKEN_RE = /\{(ParentName|ChildName|ProviderName|ListingName|SessionDate|VenueName|BookingRef)\}/i;

/** Neutral phrasing for a family we can't match to a booking — an email that
 *  reads a little generic beats one with {SessionDate} left in it. */
const TOKEN_FALLBACK: Record<string, string> = {
  parentname: "there",
  childname: "your child",
  listingname: "your booking",
  sessiondate: "your booked dates",
  venuename: "the venue",
  bookingref: "",
};

// Merge values are PARENT-TYPED (their name, their child's name). Filled into
// HTML they're escaped — a child named `<a href=…>` used to become a live link
// in an email sent from the provider's own address. Subjects are plain text.
const escMerge = (v: string) => v.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
const applyTokens = (s: string, ctx: Record<string, string>, html = false): string =>
  s.replace(/\{([A-Za-z]+)\}/g, (raw, t: string) => {
    const key = t.toLowerCase();
    const v = ctx[key] ?? TOKEN_FALLBACK[key];
    return v === undefined ? raw : html ? escMerge(v) : v;
  });

/** email → merge context, from each family's most relevant booking. */
async function mergeContexts(tenantId: string, recipients: string[]): Promise<Map<string, Record<string, string>>> {
  // UK wall clock: in BST a UTC "today" is yesterday until 01:00, which put a
  // session happening TODAY in the "upcoming" bucket for {SessionDate}.
  const today = ukToday();
  const wanted = new Set(recipients);
  const [tenant, lib, bookings] = await Promise.all([
    db.collection("tenants").doc(tenantId).get(),
    db.collection("libraries").doc(tenantId).get(),
    db.collection("bookings").where("tenantId", "==", tenantId).get(),
  ]);
  const settings = (lib.data()?.settings ?? {}) as { providerName?: string };
  const providerName = settings.providerName?.trim() || (tenant.get("name") as string | undefined) || "Your activity provider";
  const venues = ((lib.data()?.venues ?? []) as { id: string; name: string }[]);

  type B = { email?: string; status?: string; booker?: string; child?: string; kids?: { name?: string }[]; days?: string[]; dates?: string; listing?: string; listingId?: string; ref?: string };
  const best = new Map<string, { b: B; firstUpcoming: string | null; last: string }>();
  for (const d of bookings.docs) {
    const b = d.data() as B;
    const e = (b.email ?? "").toLowerCase();
    if (!wanted.has(e) || b.status === "Cancelled" || b.status === "Declined") continue;
    const days = (b.days ?? []).slice().sort();
    const firstUpcoming = days.find((x) => x >= today) ?? null;
    const last = days[days.length - 1] ?? "";
    const cur = best.get(e);
    // Prefer a booking with an upcoming session (soonest first); otherwise
    // the most recently finished one.
    const wins = !cur
      || (firstUpcoming && (!cur.firstUpcoming || firstUpcoming < cur.firstUpcoming))
      || (!cur.firstUpcoming && !firstUpcoming && last > cur.last);
    if (wins) best.set(e, { b, firstUpcoming, last });
  }

  const listingVenue = new Map<string, string>();
  const ctxs = new Map<string, Record<string, string>>();
  for (const [email, { b }] of best) {
    if (b.listingId && !listingVenue.has(b.listingId)) {
      const l = await db.collection("listings").doc(b.listingId).get();
      const venueId = l.exists ? (l.get("venueId") as string | undefined) : undefined;
      listingVenue.set(b.listingId, venues.find((v) => v.id === venueId)?.name ?? "");
    }
    ctxs.set(email, {
      providername: providerName,
      parentname: (b.booker ?? "").split(/\s+/)[0] || "there",
      childname: b.kids?.length ? b.kids.map((k) => k.name).filter(Boolean).join(", ") : (b.child ?? "your child"),
      listingname: b.listing ?? "your booking",
      sessiondate: b.dates ?? "your booked dates",
      ...(b.listingId && listingVenue.get(b.listingId) ? { venuename: listingVenue.get(b.listingId)! } : {}),
      ...(b.ref ? { bookingref: b.ref } : {}),
    });
  }
  // Everyone still gets {ProviderName} even with no booking on file.
  for (const r of recipients) if (!ctxs.has(r)) ctxs.set(r, { providername: providerName });
  return ctxs;
}

export interface EmailSendInput {
  tenantId: string;
  subject: string;
  body: string;
  /** Pre-rendered designed document (post/newsletter) — sent as-is. */
  html?: string;
  /** Resolved, deduped, lowercased. The caller owns audience resolution. */
  recipients: string[];
  audience: "all" | "one";
  sentBy: string;
  sentByName: string;
  /** Set when fired from the scheduled queue, for provenance. */
  scheduledId?: string;
}

export interface EmailHistoryDoc {
  tenantId: string;
  subject: string;
  body: string;
  audience: "all" | "one";
  recipientCount: number;
  sentBy: string;
  sentByName: string;
  createdAt: string;
  /** "sending" until every recipient's transport hand-off settles. */
  status: "sending" | "sent";
  delivered: number;
  /** Not sent because mail isn't live for that address (MAIL_LIVE/MAIL_ALLOWLIST). */
  suppressed?: number;
  /** The transport rejected these. */
  failed?: number;
  /** Recipients whose client fetched the open pixel. */
  openedBy: string[];
  scheduledId?: string;
  /** The identity this campaign went out under (lib/sender.ts) — recorded so
   *  "who did this come from?" is answerable from the history alone. */
  fromName?: string;
  replyTo?: string;
}

/** Record the send, deliver in the background, and return the history doc
 *  immediately (the route responds without waiting on 2000 SMTP calls). */
export async function performEmailSend(input: EmailSendInput): Promise<{ id: string } & EmailHistoryDoc> {
  const html = input.html && input.html.trim() ? input.html : bodyHtml(input.body);
  // Resolved ONCE for the whole blast — it's the same provider for all 2000
  // recipients, and per-recipient lookups would double the reads of a send.
  const sender = await tenantSender(input.tenantId);
  const doc: EmailHistoryDoc = {
    tenantId: input.tenantId,
    subject: input.subject,
    body: input.body,
    audience: input.audience,
    recipientCount: input.recipients.length,
    sentBy: input.sentBy,
    sentByName: input.sentByName,
    createdAt: new Date().toISOString(),
    status: "sending",
    delivered: 0,
    openedBy: [],
    ...(input.scheduledId ? { scheduledId: input.scheduledId } : {}),
    ...(sender.name ? { fromName: sender.name } : {}),
    ...(sender.replyTo ? { replyTo: sender.replyTo } : {}),
  };
  const ref = await db.collection("emails").add(doc);

  void (async () => {
    // Merge fields only cost a booking scan when the content actually uses them.
    const needsMerge = TOKEN_RE.test(`${input.subject} ${input.body} ${input.html ?? ""}`);
    const ctxs = needsMerge ? await mergeContexts(input.tenantId, input.recipients) : null;
    let delivered = 0;
    // Suppressed ≠ delivered: with MAIL_LIVE off the message never left the
    // building, and the history must not claim it did (backlog b33).
    let suppressed = 0;
    let failed = 0;
    for (const to of input.recipients) {
      const ctx = ctxs?.get(to) ?? {};
      const subj = ctxs ? applyTokens(input.subject, ctx) : input.subject;
      const content = ctxs ? applyTokens(html, ctx, true) : html;
      const footer = input.audience === "all" ? unsubFooter(input.tenantId, to) : "";
      const outcome = await sendMailDetailed(to, subj, content + footer + pixel(ref.id, to), sender);
      if (outcome.status === "sent") delivered++;
      else if (outcome.status === "suppressed") suppressed++;
      else failed++;
    }
    await ref.set({ delivered, suppressed, failed, status: "sent" }, { merge: true });
  })().catch((e) => console.error(`[email] delivery recording failed for ${ref.id}:`, (e as Error).message));

  return { id: ref.id, ...doc };
}

/** The open pixel landed — remember who. Idempotent (arrayUnion), and quiet:
 *  tracking must never error at a mail client. */
export async function recordOpen(emailId: string, recipient: string): Promise<void> {
  const r = recipient.trim().toLowerCase();
  if (!emailId || !r) return;
  await db.collection("emails").doc(emailId)
    .update({ openedBy: FieldValue.arrayUnion(r) })
    .catch(() => {});
}
