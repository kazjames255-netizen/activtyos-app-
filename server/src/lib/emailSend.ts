import { FieldValue } from "firebase-admin/firestore";
import { db } from "../firebase";
import { sendMail } from "./mailer";

// The one-to-many send engine behind the Email page: POST /api/emails/send
// fires it directly, the scheduled-send sweep fires it at sendAt. Every send
// writes an `emails` history doc up front (status "sending"), delivers in the
// background, then records what actually happened — delivered count from the
// transport, opens from the tracking pixel. That history doc IS the campaign
// record the Campaigns/Analytics tabs read.

/** Where the API itself is reachable from an email client (the open pixel
 *  must resolve from the recipient's inbox, not from the web app). */
export const apiUrl = process.env.API_URL || "http://localhost:4000";

const esc = (s: string) => s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c] as string));

/** Plain-text body → the simple wrapped HTML the composer preview shows. */
export const bodyHtml = (body: string) =>
  `<div style="font-family:system-ui,sans-serif;font-size:15px;line-height:1.5;color:#111">${esc(body).replace(/\n/g, "<br>")}</div>`;

const pixel = (emailId: string, to: string) =>
  `<img src="${apiUrl}/api/emails/open/${emailId}?r=${encodeURIComponent(to)}" width="1" height="1" alt="" style="display:block;width:1px;height:1px;border:0">`;

// A per-recipient, tamper-evident unsubscribe token (tenant:email, base64url).
export const unsubToken = (tenantId: string, email: string) => Buffer.from(`${tenantId}:${email.toLowerCase()}`).toString("base64url");
export const readUnsubToken = (tok: string): { tenantId: string; email: string } | null => {
  try { const s = Buffer.from(tok, "base64url").toString("utf8"); const i = s.indexOf(":"); if (i < 0) return null; return { tenantId: s.slice(0, i), email: s.slice(i + 1) }; } catch { return null; }
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

const applyTokens = (s: string, ctx: Record<string, string>): string =>
  s.replace(/\{([A-Za-z]+)\}/g, (raw, t: string) => {
    const key = t.toLowerCase();
    return ctx[key] ?? TOKEN_FALLBACK[key] ?? raw;
  });

/** email → merge context, from each family's most relevant booking. */
async function mergeContexts(tenantId: string, recipients: string[]): Promise<Map<string, Record<string, string>>> {
  const today = new Date().toISOString().slice(0, 10);
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
  /** Recipients whose client fetched the open pixel. */
  openedBy: string[];
  scheduledId?: string;
}

/** Record the send, deliver in the background, and return the history doc
 *  immediately (the route responds without waiting on 2000 SMTP calls). */
export async function performEmailSend(input: EmailSendInput): Promise<{ id: string } & EmailHistoryDoc> {
  const html = input.html && input.html.trim() ? input.html : bodyHtml(input.body);
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
  };
  const ref = await db.collection("emails").add(doc);

  void (async () => {
    // Merge fields only cost a booking scan when the content actually uses them.
    const needsMerge = TOKEN_RE.test(`${input.subject} ${input.body} ${input.html ?? ""}`);
    const ctxs = needsMerge ? await mergeContexts(input.tenantId, input.recipients) : null;
    let delivered = 0;
    for (const to of input.recipients) {
      const ctx = ctxs?.get(to) ?? {};
      const subj = ctxs ? applyTokens(input.subject, ctx) : input.subject;
      const content = ctxs ? applyTokens(html, ctx) : html;
      const footer = input.audience === "all" ? unsubFooter(input.tenantId, to) : "";
      if (await sendMail(to, subj, content + footer + pixel(ref.id, to))) delivered++;
    }
    await ref.set({ delivered, status: "sent" }, { merge: true });
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
