import type { Booking } from "../../../features/bookings/types";
import { db } from "../firebase";
import { autoEmailOn, type AutoEmailPrefs } from "./autoEmails";
import { sendMail, type MailAttachment } from "./mailer";
import { tenantSender } from "./sender";
import { webUrl } from "./stripe";
import { AOS_MARK_PNG_B64 } from "./brandLogo";

/** The ActivityOS mark as an inline (CID) attachment. Embedded rather than
 *  hot-linked so it renders in every client and regardless of environment —
 *  Gmail/Outlook strip SVG and data-URIs and can't reach a localhost URL. Any
 *  email that shows the mark must include this in its attachments. */
export function aosLogoAttachment(): MailAttachment {
  return { filename: "activityos.png", content: Buffer.from(AOS_MARK_PNG_B64, "base64"), contentType: "image/png", cid: "aos-mark" };
}

// Booking email templates. Plain, inline-styled HTML — per-provider sending
// domains come with the white-label milestone; until then every send carries
// the provider's name on the From line and their address on Reply-To
// (lib/sender.ts).

const gbp = (n: number) => `£${(Math.round(n * 100) / 100).toFixed(2)}`;

/** Send unless the provider has switched this category of automatic email off
 *  (Setup → Email → Automatic emails). Same fire-and-forget contract as
 *  sendMail: a suppressed or failed email never fails the booking. */
function sendGated(
  tenantId: string | undefined,
  key: keyof Pick<AutoEmailPrefs, "bookings" | "payments" | "waitlist">,
  to: string,
  subject: string,
  html: string,
  /** The name already rendered in the template — reused as the From name so
   *  the envelope and the letterhead can't disagree. */
  providerName?: string,
  /** Inline images / files the template references (e.g. cid:provider-logo,
   *  cid:aos-mark). */
  attachments?: MailAttachment[],
): void {
  void autoEmailOn(tenantId, key)
    .then(async (on) => {
      if (!on) { console.log(`[mail] "${subject}" → ${to} skipped (autoEmails.${key} off)`); return; }
      return sendMail(to, subject, html, await tenantSender(tenantId, providerName), attachments?.length ? { attachments } : undefined);
    })
    .catch((e) => console.error(`[mail] gate check failed for "${subject}":`, (e as Error).message));
}

/** Inline attachments a customer booking email needs: ActivityOS mark for the
 *  "powered by" footer, plus the provider's own logo when they have one. */
function brandAttachments(brand: { logo?: MailAttachment }): MailAttachment[] {
  return [aosLogoAttachment(), ...(brand.logo ? [brand.logo] : [])];
}

/** Ungated provider-branded send (account access, invites, message alerts —
 *  things an automatic-email toggle must never silence).
 *
 *  `replyTo: false` keeps the From name but leaves the Reply-To header unset:
 *  §JJ's reply-by-email ingest claims that header for thread routing
 *  (`reply+<threadId>@inbound.…`), so mail that will one day be repliable must
 *  not squat on it now. */
function sendAs(
  tenantId: string | undefined,
  providerName: string,
  to: string,
  subject: string,
  html: string,
  opts: { replyTo?: boolean } = {},
): void {
  void tenantSender(tenantId, providerName)
    .then((s) => sendMail(to, subject, html, opts.replyTo === false ? { name: s.name } : s))
    .catch((e) => console.error(`[mail] sender lookup failed for "${subject}":`, (e as Error).message));
}

/** Customer-facing branding: the PROVIDER's own logo (if they've uploaded one)
 *  as an inline cid attachment, else just their name. Customer emails carry the
 *  provider's identity — ActivityOS only appears as "powered by" in the footer. */
async function customerBrand(
  tenantId: string | undefined,
  providerName: string,
): Promise<{ name: string; logo?: MailAttachment }> {
  if (!tenantId) return { name: providerName };
  try {
    const lib = await db.collection("libraries").doc(tenantId).get();
    const logoUrl = ((lib.data()?.settings as { billing?: { logoUrl?: string } } | undefined)?.billing?.logoUrl) || undefined;
    const imgId = logoUrl?.match(/\/api\/images\/([^/?#]+)/)?.[1];
    if (imgId) {
      const img = (await db.collection("images").doc(imgId).get()).data() as { contentType?: string; b64?: string } | undefined;
      if (img?.b64) return { name: providerName, logo: { filename: "logo", content: Buffer.from(img.b64, "base64"), contentType: img.contentType || "image/png", cid: "provider-logo" } };
    }
  } catch { /* fall back to the name */ }
  return { name: providerName };
}

/** Every session date, 3-across (date over time) at small text. Session strings
 *  look like "Mon 20 Jul 2026 · 08:00 – 17:30". */
function datesGridHtml(sessions: string[]): string {
  if (!sessions.length) return "<span style='color:#a7a3bd'>Dates to be confirmed</span>";
  const cell = (s: string) => {
    const [day, time] = s.split(" · ");
    return `<td width="33%" style="padding:3px 10px 6px 0;vertical-align:top">
      <div style="font-size:12px;font-weight:700;color:#171534;white-space:nowrap">${escapeHtml(day ?? s)}</div>
      ${time ? `<div style="font-size:11px;color:#8a86a3;white-space:nowrap">${escapeHtml(time)}</div>` : ""}
    </td>`;
  };
  const rows: string[] = [];
  for (let i = 0; i < sessions.length; i += 3) {
    const cells = sessions.slice(i, i + 3).map(cell);
    while (cells.length < 3) cells.push(`<td width="33%"></td>`);
    rows.push(`<tr>${cells.join("")}</tr>`);
  }
  return `<table cellpadding="0" cellspacing="0" style="border-collapse:collapse;width:100%">${rows.join("")}</table>`;
}

/** The customer booking-email shell: the PROVIDER's logo/name up top, all the
 *  session dates, a button straight to the booking, and "powered by ActivityOS"
 *  at the bottom. `hasLogo` gates the inline provider logo (cid:provider-logo).
 *  `title`/`bodyHtml` are HTML, inserted raw. */
function layout(brand: { name: string; hasLogo: boolean }, title: string, bodyHtml: string, b: Booking): string {
  const kids = b.kids?.length ? b.kids.map((k) => k.name).join(", ") : b.child;
  const bookingUrl = `${webUrl}/custdash/bookings?open=${encodeURIComponent(b.ref)}`;
  const row = (label: string, value: string) =>
    `<tr>
      <td style="padding:7px 16px 7px 0;font-size:12.5px;color:#8a86a3;white-space:nowrap;vertical-align:top">${escapeHtml(label)}</td>
      <td style="padding:7px 0;font-size:13.5px;color:#171534;border-bottom:1px solid #eef0f5">${value}</td>
    </tr>`;
  const header = brand.hasLogo
    ? `<img src="cid:provider-logo" alt="${escapeHtml(brand.name)}" style="max-height:48px;max-width:220px;display:inline-block" />`
    : `<span style="font-size:22px;font-weight:800;color:#1d3a8f">${escapeHtml(brand.name)}</span>`;
  return `
  <div style="margin:0;padding:0;background:#eef1f7">
  <div style="font-family:system-ui,-apple-system,'Segoe UI',sans-serif;background:#eef1f7;padding:24px 12px">
    <div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:18px;overflow:hidden;box-shadow:0 12px 34px -18px rgba(20,30,70,.4)">
      <div style="padding:24px 28px 20px;text-align:center;border-bottom:1px solid #eef0f5">${header}</div>
      <div style="padding:24px 28px 28px">
        <h1 style="font-size:22px;line-height:1.25;margin:0 0 14px;color:#171534">${title}</h1>
        ${bodyHtml}
        <table cellpadding="0" cellspacing="0" style="border-collapse:collapse;width:100%;margin-top:16px">
          ${row("Booking ref", `<b>${escapeHtml(b.ref)}</b>`)}
          ${row("Activity", escapeHtml(b.listing))}
          ${row("Pass", escapeHtml(b.pass))}
          ${row("Child", escapeHtml(kids || "—"))}
          ${row("Total", `<b>${gbp(b.amount)}</b>`)}
        </table>
        <div style="font-size:12px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;color:#8a86a3;margin:20px 0 8px">Dates &amp; times</div>
        ${datesGridHtml(b.sessions ?? [])}
        <div style="text-align:center;margin:26px 0 4px">
          <a href="${bookingUrl}" style="display:inline-block;background:#15b364;color:#ffffff;padding:13px 32px;border-radius:999px;text-decoration:none;font-weight:800;font-size:15px;box-shadow:0 8px 20px -8px rgba(21,179,100,.6)">View my booking →</a>
        </div>
      </div>
      <div style="background:#f7f9fd;padding:16px 24px;text-align:center;border-top:1px solid #eef0f5">
        <img src="cid:aos-mark" width="15" height="15" alt="" style="vertical-align:middle;margin-right:6px;border-radius:4px;opacity:.9" />
        <span style="font-size:11.5px;color:#8a86a3;vertical-align:middle">Powered by <b style="color:#4a4763">ActivityOS</b></span>
        <div style="font-size:11px;color:#a7a3bd;margin-top:5px">You're receiving this because a booking was made with ${escapeHtml(brand.name)}.</div>
      </div>
    </div>
  </div>
  </div>`;
}

/** Build + send a customer booking email through the branded shell — resolves
 *  the provider's logo, wraps the body in layout(), attaches the marks. */
function sendCustomerEmail(
  b: Booking,
  providerName: string,
  key: "bookings" | "payments" | "waitlist",
  subject: string,
  title: string,
  body: string,
): void {
  void (async () => {
    const brand = await customerBrand(b.tenantId, providerName);
    sendGated(
      b.tenantId,
      key,
      b.email,
      subject,
      layout({ name: brand.name, hasLogo: !!brand.logo }, title, body, b),
      providerName,
      brandAttachments(brand),
    );
  })().catch((e) => console.error(`[mail] "${subject}" build failed:`, (e as Error).message));
}

export function emailBookingRequestReceived(b: Booking, providerName: string): void {
  sendCustomerEmail(
    b, providerName, "bookings",
    `Booking request received — ${b.listing} (${b.ref})`,
    "We've got your booking request",
    `<p style="font-size:14px">Thanks ${b.booker} — your request is with ${providerName} for approval.
     You'll get another email as soon as it's confirmed. Payment is collected after approval.</p>`,
  );
}

export function emailPaymentLink(b: Booking, providerName: string): void {
  sendCustomerEmail(
    b, providerName, "bookings",
    `Complete your booking — ${b.listing} (${b.ref})`,
    "Your booking is reserved — payment inside",
    `<p style="font-size:14px">Hi ${b.booker}, ${providerName} has reserved this booking for you.</p>
     <p><a href="${webUrl}/custdash/bookings?pay=${encodeURIComponent(b.ref)}" style="display:inline-block;background:#1d3a8f;color:#fff;padding:10px 18px;border-radius:999px;text-decoration:none;font-weight:700;font-size:14px">Pay ${gbp(b.amount)} securely</a></p>
     <p style="color:#8a86a3;font-size:12px">Signing in from the link starts the card payment automatically.</p>`,
  );
}

export function emailBookingConfirmed(b: Booking, providerName: string): void {
  sendCustomerEmail(
    b, providerName, "bookings",
    `Booking confirmed — ${b.listing} (${b.ref})`,
    "You're booked in ✓",
    `<p style="font-size:14px">Great news ${b.booker} — ${providerName} has confirmed your booking. See you there!</p>`,
  );
}

export function emailBookingDeclined(b: Booking, providerName: string): void {
  sendCustomerEmail(
    b, providerName, "bookings",
    `Booking update — ${b.listing} (${b.ref})`,
    "Your booking request was declined",
    `<p style="font-size:14px">Sorry ${b.booker} — ${providerName} couldn't take this booking.
     Nothing has been charged. Feel free to browse other dates or activities.</p>`,
  );
}

export function emailRefundApproved(b: Booking, providerName: string): void {
  sendCustomerEmail(
    b, providerName, "payments",
    `Refund approved — ${b.listing} (${b.ref})`,
    "Your refund is on its way",
    `<p style="font-size:14px">Hi ${b.booker} — ${providerName} approved the refund for this booking.
     ${b.cancel?.amount ? `Amount: <b>${gbp(b.cancel.amount)}</b>.` : ""}</p>`,
  );
}

export function emailPlaceOffered(b: Booking, providerName: string): void {
  const until = b.offerExpiresAt
    ? new Date(b.offerExpiresAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })
    : "";
  sendCustomerEmail(
    b, providerName, "waitlist",
    `A place has opened up — ${b.listing} (${b.ref})`,
    "A place is yours if you want it",
    `<p style="font-size:14px">Good news ${b.booker} — a place has opened up on the dates you were
     waiting for, and it's being held for you <b>for 2 hours${until ? ` (until ${until})` : ""}</b>.</p>
     <p style="font-size:14px">Sign in to <b>My bookings</b> and accept the offer to take the place —
     if the hold runs out, it passes to the next family in the queue.</p>`,
  );
}


/**
 * "You can see what's on" — the invite an operator sends after a phone
 * enquiry. Carries a set-password link, never a password.
 *
 * Says who created the account and why, because an unexplained login is
 * indistinguishable from a phishing email — and tells them how to be rid of
 * it, which is both courteous and the lawful basis for having made it.
 */
export function emailSignUpInvite(p: {
  to: string;
  firstName: string;
  providerName: string;
  link: string;
  existed: boolean;
  tenantId?: string;
}): void {
  const cta = p.existed ? "Sign in" : "Set your password";
  sendAs(
    p.tenantId,
    p.providerName,
    p.to,
    `${p.providerName} — see what's coming up`,
    `<div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#171534">
      <h2 style="font-size:19px;margin:0 0 10px">Hi ${p.firstName}, here's your account</h2>
      <p style="font-size:14px;line-height:1.55;margin:0 0 14px">
        ${p.existed
          ? `You already have an ActivityOS account, so ${p.providerName}'s listings are waiting for you when you sign in.`
          : `${p.providerName} set up an account for you after your enquiry, so you can see every session they're running, with dates and places left.`}
      </p>
      <p style="margin:0 0 16px">
        <a href="${p.link}" style="display:inline-block;background:#2f6bd8;color:#fff;padding:11px 20px;border-radius:999px;text-decoration:none;font-weight:700;font-size:14px">${cta}</a>
      </p>
      <p style="font-size:12.5px;line-height:1.55;color:#5b6478;margin:0 0 8px">
        We haven't set a password for you — that link lets you choose your own. Your name and
        email are already filled in, so there's nothing to type twice.
      </p>
      <p style="font-size:11.5px;line-height:1.5;color:#8a8fa3;margin:0">
        Didn't ask for this? Ignore this email and nothing happens, or reply and we'll delete
        the account.
      </p>
    </div>`,
  );
}

/** Team/franchise invite — the join link, who sent it and what it grants.
 * The link is the secret; it can only be used once. */
export function emailTeamInvite(p: {
  to: string;
  tenantName: string;
  role: "franchise" | "staff";
  link: string;
  inviterName?: string;
  /** Settings → Staff & workforce: a personal welcome line from the provider. */
  message?: string;
  tenantId?: string;
}): void {
  const what =
    p.role === "franchise"
      ? `run your own franchise area inside ${p.tenantName}`
      : `join the ${p.tenantName} team as staff`;
  sendAs(
    p.tenantId,
    p.tenantName,
    p.to,
    `${p.tenantName} — you're invited`,
    `<div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#171534">
      <h2 style="font-size:19px;margin:0 0 10px">Join ${p.tenantName} on ActivityOS</h2>
      <p style="font-size:14px;line-height:1.55;margin:0 0 14px">
        ${p.inviterName ? `${p.inviterName} has invited you` : "You've been invited"} to ${what}.
        The button below creates your account and links it to theirs — nothing to configure.
      </p>
      ${p.message ? `<blockquote style="border-left:3px solid #cdddf7;margin:0 0 14px;padding:6px 0 6px 14px;color:#4a4763;font-size:14px;line-height:1.55;white-space:pre-wrap">${escapeHtml(p.message)}</blockquote>` : ""}
      <p style="margin:0 0 16px">
        <a href="${p.link}" style="display:inline-block;background:#2f6bd8;color:#fff;padding:11px 20px;border-radius:999px;text-decoration:none;font-weight:700;font-size:14px">Accept the invite</a>
      </p>
      <p style="font-size:11.5px;line-height:1.5;color:#8a8fa3;margin:0">
        The link works once. Not expecting this? Ignore it and nothing happens.
      </p>
    </div>`,
  );
}

/** §H — the ONE email when an operator books for a family: confirmation +
 * set-your-password (new accounts) + pay link. Deliberately NO child data:
 * a mistyped address must never leak a child's details. */
export function emailFamilyBookingCreated(
  bookings: Booking[],
  providerName: string,
  opts: { accountCreated: boolean; passwordLink: string | null },
): void {
  const b = bookings[0];
  const total = bookings.reduce((s, x) => s + x.amount, 0);
  const refs = bookings.map((x) => x.ref).join(", ");
  const payUrl = `${webUrl}/custdash/bookings?pay=${encodeURIComponent(b.ref)}`;
  // When the booking just created their account this email carries the ONLY
  // set-password link the family will ever get — the bookings toggle can
  // silence a courtesy confirmation, never account access.
  const send = opts.accountCreated && opts.passwordLink
    ? (to: string, subject: string, html: string) => sendAs(b.tenantId, providerName, to, subject, html)
    : (to: string, subject: string, html: string) => sendGated(b.tenantId, "bookings", to, subject, html, providerName);
  send(
    b.email,
    `Your booking with ${providerName} (${refs})`,
    `
  <div style="font-family:system-ui,-apple-system,sans-serif;max-width:560px;margin:0 auto;color:#171534">
    <div style="padding:18px 0 10px;border-bottom:2px solid #1d3a8f">
      <strong style="font-size:18px">${providerName}</strong>
      <span style="color:#8a86a3;font-size:12px"> · via ActivityOS</span>
    </div>
    <h2 style="font-size:19px;margin:18px 0 6px">Your booking is confirmed</h2>
    <p style="font-size:14px">Hi ${b.booker} — ${providerName} has made this booking for you
      (you spoke to them, or they took it over the phone), and it now lives in your own
      ActivityOS account so you can see it, pay it, and manage it any time.</p>
    <table style="margin:14px 0;border-collapse:collapse;font-size:13.5px" cellpadding="0">
      <tr><td style="color:#8a86a3;padding:3px 14px 3px 0">Booking ref${bookings.length > 1 ? "s" : ""}</td><td><b>${refs}</b></td></tr>
      <tr><td style="color:#8a86a3;padding:3px 14px 3px 0">Activity</td><td>${b.listing}</td></tr>
      <tr><td style="color:#8a86a3;padding:3px 14px 3px 0">Dates</td><td>${b.dates}</td></tr>
      <tr><td style="color:#8a86a3;padding:3px 14px 3px 0">Total</td><td><b>${gbp(total)}</b></td></tr>
    </table>
    ${
      opts.accountCreated && opts.passwordLink
        ? `<p style="font-size:14px"><b>First, set your password</b> — we created your account for this booking:</p>
           <p><a href="${opts.passwordLink}" style="display:inline-block;background:#1d3a8f;color:#fff;padding:10px 18px;border-radius:999px;text-decoration:none;font-weight:700;font-size:14px">Set my password</a></p>`
        : ""
    }
    ${total > 0
      ? `<p style="font-size:14px">Then pay securely by card:</p>
    <p><a href="${payUrl}" style="display:inline-block;background:#15b364;color:#fff;padding:10px 18px;border-radius:999px;text-decoration:none;font-weight:700;font-size:14px">Pay ${gbp(total)}</a></p>`
      : `<p style="font-size:14px">There's nothing to pay for this booking.</p>`}
    <p style="color:#8a86a3;font-size:11.5px;margin-top:22px">
      You're receiving this because ${providerName} made a booking for this email address.
      If that wasn't you, reply and tell them.</p>
  </div>`,
  );
}

/** §Q — childcare voucher instructions: the scheme, its reference(s), the
 * amount and the deadline. Re-sendable from the booking (people lose it). */
export function emailVoucherInstructions(
  b: Booking,
  providerName: string,
  scheme: { name: string; details: { label: string; value: string }[] },
): void {
  const isUrl = (d: { label: string; value: string }) => /website|url|link|portal/i.test(d.label) || /^https?:\/\//i.test(d.value);
  const refRows = scheme.details
    .map((d) => `<tr><td style="color:#8a86a3;padding:3px 14px 3px 0">${d.label}</td><td>${isUrl(d) ? `<a href="${/^https?:\/\//i.test(d.value) ? d.value : `https://${d.value}`}" style="color:#2f6bd8;font-weight:700">${d.value}</a>` : `<b>${d.value}</b>`}</td></tr>`)
    .join("");
  const sendBy = b.voucherSendBy
    ? new Date(`${b.voucherSendBy}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "long", timeZone: "UTC" })
    : null;
  sendCustomerEmail(
    b, providerName, "payments",
    `Pay by childcare voucher — ${b.listing} (${b.ref})`,
    `Pay with ${scheme.name}`,
    `<p style="font-size:14px">Your place is held, ${b.booker}. Pay <b>${gbp(b.amount)}</b> through
      <b>${scheme.name}</b> on their own website, quoting:</p>
     <table style="margin:10px 0;border-collapse:collapse;font-size:13.5px" cellpadding="0">${refRows}
      <tr><td style="color:#8a86a3;padding:3px 14px 3px 0">Booking ref</td><td><b>${b.ref}</b></td></tr>
      <tr><td style="color:#8a86a3;padding:3px 14px 3px 0">Amount</td><td><b>${gbp(b.amount)}</b></td></tr></table>
     ${sendBy ? `<p style="font-size:14px"><b>Please send it by ${sendBy}</b> so it reaches ${providerName} in time to keep the place.</p>` : ""}
     <p style="color:#8a86a3;font-size:12px">Voucher money takes a few working days to arrive — the provider will mark your place paid once it lands.</p>`,
  );
}

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// ── The provider's "new booking" email ────────────────────────────────────
// A richly-presented, email-client-safe (tables + inline styles) notification
// for the provider's team: the ActivityOS brand at the top, the listing's
// photo + name, every attendee with their age, allergies, medical and SEND /
// additional-needs notes, a payment breakdown, and a button that opens the
// exact booking. Any EHCP plans ride along as real attachments (added by the
// caller). The button href is the literal `{{VIEW_URL}}` token — notify()
// swaps it for the resolved, portal-correct deep link at send time.

export interface NewBookingAttendee {
  name: string;
  age?: number;
  ticket?: string;
  allergies?: string;
  medical?: string;
  dietary?: string;
  /** SEND / additional needs, free text. */
  send?: string;
  /** The child's EHCP/SEND plan file id, when one is on file. The email links
   *  STRAIGHT to the secure viewer (/plan/:id) — the plan is never attached
   *  (special-category data); the viewer re-checks access server-side. */
  ehcpFileId?: string;
}

export interface NewBookingEmailArgs {
  providerName: string;
  /** "New booking" | "Booking request" | "Waitlist join". */
  kind: string;
  bookerName: string;
  listingName: string;
  /** Absolute URL of the listing's hero image, if it has one. */
  listingImage?: string;
  /** Pass / ticket line, e.g. "SUMMER WEEK 2 (3RD–7TH AUGUST) 9AM–5:30PM". */
  pass?: string;
  /** Human session lines, e.g. "Mon 03 August 2026: 09:00 – 17:30". */
  sessions: string[];
  attendees: NewBookingAttendee[];
  /** Venue name + address, if resolvable. */
  location?: string;
  cardAmount: number;
  childcareAmount: number;
  childcareLabel?: string; // e.g. "Tax-Free Childcare" / "Childcare vouchers"
  total: number;
  /** The parent-visible booking id (#03073…). */
  bookingId: string;
  ref: string;
  needsApproval?: boolean;
}

function detailRow(label: string, valueHtml: string): string {
  return `
    <tr>
      <td style="padding:12px 0 2px;font-size:12px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;color:#8a86a3">${escapeHtml(label)}</td>
    </tr>
    <tr>
      <td style="padding:0 0 12px;font-size:14.5px;line-height:1.5;color:#171534;border-bottom:1px solid #eef0f5">${valueHtml}</td>
    </tr>`;
}

function attendeeCard(a: NewBookingAttendee): string {
  const health = [a.allergies && `Allergies — ${escapeHtml(a.allergies)}`, a.medical && `Medical — ${escapeHtml(a.medical)}`, a.dietary && `Dietary — ${escapeHtml(a.dietary)}`]
    .filter(Boolean)
    .join("<br>");
  const line = (label: string, valueHtml: string, tint: string) =>
    `<div style="margin-top:8px">
       <span style="display:inline-block;font-size:11px;font-weight:800;letter-spacing:.03em;text-transform:uppercase;color:${tint}">${label}</span>
       <div style="font-size:13.5px;line-height:1.5;color:#3b3860;margin-top:1px">${valueHtml}</div>
     </div>`;
  return `
  <div style="border:1px solid #eef0f5;border-radius:14px;padding:14px 16px;margin:0 0 12px;background:#fbfcfe">
    <div style="font-size:15px;font-weight:800;color:#171534">${escapeHtml(a.name)}${a.age != null ? `<span style="color:#8a86a3;font-weight:600"> · age ${a.age}</span>` : ""}${a.ticket ? `<span style="color:#8a86a3;font-weight:600"> · ${escapeHtml(a.ticket)}</span>` : ""}</div>
    ${line("🩺 Health &amp; allergies", health || "<span style='color:#a7a3bd'>None recorded</span>", "#1d3a8f")}
    ${line("🧩 SEND &amp; additional needs", a.send ? escapeHtml(a.send) : "<span style='color:#a7a3bd'>None recorded — worth asking the family</span>", "#8a3ffb")}
    ${a.ehcpFileId ? `<a href="${webUrl}/plan/${encodeURIComponent(a.ehcpFileId)}" style="margin-top:9px;display:inline-block;background:#eef3ff;color:#1d3a8f;font-size:12px;font-weight:700;padding:6px 12px;border-radius:999px;text-decoration:none">📎 Open ${escapeHtml(a.name)}'s EHCP plan →</a>` : ""}
  </div>`;
}

export function newBookingProviderEmail(a: NewBookingEmailArgs): string {
  const money = (n: number) => `£${(Math.round(n * 100) / 100).toFixed(2)}`;
  const heading =
    a.kind === "Waitlist join" ? "New waitlist join"
    : a.kind === "Booking request" ? "New booking request"
    : "You have a new booking";

  // Every date in a 3-across grid (date over time, small text) so even a long
  // run stays short and tidy. Session strings look like
  // "Mon 20 Jul 2026 · 08:00 – 17:30".
  const dateCell = (s: string) => {
    const [day, time] = s.split(" · ");
    return `<td width="33%" style="padding:3px 10px 6px 0;vertical-align:top">
      <div style="font-size:12px;font-weight:700;color:#171534;white-space:nowrap">${escapeHtml(day ?? s)}</div>
      ${time ? `<div style="font-size:11px;color:#8a86a3;white-space:nowrap">${escapeHtml(time)}</div>` : ""}
    </td>`;
  };
  const dateRows: string[] = [];
  for (let i = 0; i < a.sessions.length; i += 3) {
    const cells = a.sessions.slice(i, i + 3).map(dateCell);
    while (cells.length < 3) cells.push(`<td width="33%"></td>`); // keep columns aligned
    dateRows.push(`<tr>${cells.join("")}</tr>`);
  }
  const sessionsHtml = a.sessions.length
    ? `<table cellpadding="0" cellspacing="0" style="border-collapse:collapse;width:100%">${dateRows.join("")}</table>`
    : "<span style='color:#a7a3bd'>Dates to be confirmed</span>";

  // Only show a payment line that actually has money against it — a card-only
  // booking shouldn't display "Childcare payment £0", and vice versa.
  const payRows = ([
    ...(a.cardAmount > 0 ? [["Card payment", money(a.cardAmount)]] : []),
    ...(a.childcareAmount > 0 ? [[a.childcareLabel || "Childcare payment", money(a.childcareAmount)]] : []),
  ] as [string, string][])
    .map(
      ([l, v]) =>
        `<tr><td style="padding:5px 0;font-size:13.5px;color:#4a4763">${escapeHtml(l)}</td><td style="padding:5px 0;font-size:13.5px;text-align:right;color:#171534">${v}</td></tr>`,
    )
    .join("");

  return `
  <div style="margin:0;padding:0;background:#eef1f7">
  <div style="font-family:system-ui,-apple-system,'Segoe UI',sans-serif;background:#eef1f7;padding:24px 12px">
    <div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:18px;overflow:hidden;box-shadow:0 12px 34px -18px rgba(20,30,70,.4)">

      <!-- ActivityOS brand header — the real mark, embedded inline (cid) so it
           renders in every client (see aosLogoAttachment). -->
      <div style="background:linear-gradient(120deg,#16306e 0%,#274ba3 55%,#3f78d8 100%);padding:18px 24px;text-align:center">
        <img src="cid:aos-mark" width="26" height="26" alt="" style="vertical-align:middle;margin-right:9px;border-radius:7px" />
        <span style="font-size:21px;font-weight:800;letter-spacing:.2px;color:#ffffff;vertical-align:middle">Activity<span style="color:#EE1F63">OS</span></span>
      </div>

      ${a.listingImage
        ? `<img src="${a.listingImage}" alt="${escapeHtml(a.listingName)}" width="600" style="display:block;width:100%;max-width:600px;height:auto;object-fit:cover;max-height:230px" />`
        : ""}

      <div style="padding:26px 28px 30px">
        <div style="font-size:12px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#3f78d8">${escapeHtml(a.providerName)}</div>
        <h1 style="font-size:23px;line-height:1.25;margin:4px 0 2px;color:#171534">${heading}</h1>
        <div style="font-size:15px;font-weight:700;color:#4a4763;margin-top:6px">${escapeHtml(a.listingName)}</div>

        <p style="font-size:14.5px;line-height:1.6;color:#3b3860;margin:16px 0 4px">
          Hi ${escapeHtml(a.providerName)}, <b>${escapeHtml(a.bookerName)}</b> has ${a.kind === "Booking request" ? "requested a place on" : a.kind === "Waitlist join" ? "joined the waiting list for" : "booked"} <b>${escapeHtml(a.listingName)}</b>${a.needsApproval ? " — this one needs your approval." : "."}
        </p>

        <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-top:14px">
          ${detailRow("Booker", escapeHtml(a.bookerName))}
          ${a.pass ? detailRow("Listing", `${escapeHtml(a.listingName)}<br><span style="color:#8a86a3;font-size:13px">${escapeHtml(a.pass)}</span>`) : detailRow("Listing", escapeHtml(a.listingName))}
          ${detailRow("Dates & times", sessionsHtml)}
          ${a.location ? detailRow("Location", escapeHtml(a.location)) : ""}
        </table>

        <div style="font-size:12px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;color:#8a86a3;margin:20px 0 10px">Attendees &amp; profile notes</div>
        ${a.attendees.map(attendeeCard).join("")}

        <!-- Payment -->
        <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:18px 0 6px;background:#f7f9fd;border-radius:12px">
          <tr><td style="padding:14px 16px 4px" colspan="2"><span style="font-size:12px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;color:#8a86a3">Payment</span></td></tr>
          <tr><td colspan="2" style="padding:0 16px"><table width="100%" cellpadding="0" cellspacing="0">${payRows}
            <tr><td style="padding:9px 0 3px;border-top:1px solid #e3e8f2;font-size:15px;font-weight:800;color:#171534">Total</td><td style="padding:9px 0 3px;border-top:1px solid #e3e8f2;font-size:15px;font-weight:800;text-align:right;color:#171534">${money(a.total)}</td></tr>
          </table></td></tr>
          <tr><td colspan="2" style="padding:8px 16px 14px;font-size:12.5px;color:#8a86a3">Booking ID <b style="color:#4a4763">${escapeHtml(a.bookingId)}</b> · Ref <b style="color:#4a4763">${escapeHtml(a.ref)}</b></td></tr>
        </table>

        <!-- View booking button (direct to this booking) -->
        <div style="text-align:center;margin:24px 0 6px">
          <a href="{{VIEW_URL}}" style="display:inline-block;background:#15b364;color:#ffffff;padding:14px 34px;border-radius:999px;text-decoration:none;font-weight:800;font-size:15px;box-shadow:0 8px 20px -8px rgba(21,179,100,.6)">View booking →</a>
        </div>
        <p style="text-align:center;font-size:12px;color:#a7a3bd;margin:6px 0 0">Opens this exact booking in ActivityOS.</p>
      </div>

      <div style="background:#f7f9fd;padding:16px 24px;text-align:center;border-top:1px solid #eef0f5">
        <span style="font-size:11.5px;color:#8a86a3">You're receiving this because you're on ${escapeHtml(a.providerName)}'s team on ActivityOS.</span>
      </div>
    </div>
  </div>
  </div>`;
}

/** Notify a recipient (parent or operator) that they've got a new message. The
 * body is quoted inline and a button deep-links to the thread. Reply-by-email
 * ingest is not built yet (handoff §JJ), so we don't invite email replies. */
export function emailNewMessage(
  to: string,
  opts: { providerName: string; senderName: string; body: string; deepLink: string; tenantId?: string },
): void {
  sendAs(
    opts.tenantId,
    opts.providerName,
    to,
    `New message from ${opts.senderName}`,
    `
  <div style="font-family:system-ui,-apple-system,sans-serif;max-width:560px;margin:0 auto;color:#171534">
    <div style="padding:18px 0 10px;border-bottom:2px solid #1d3a8f">
      <strong style="font-size:18px">${escapeHtml(opts.providerName)}</strong>
      <span style="color:#8a86a3;font-size:12px"> · via ActivityOS</span>
    </div>
    <h2 style="font-size:19px;margin:18px 0 6px">New message from ${escapeHtml(opts.senderName)}</h2>
    <blockquote style="border-left:3px solid #cdddf7;margin:12px 0;padding:6px 0 6px 14px;color:#4a4763;white-space:pre-wrap;font-size:14px">${escapeHtml(opts.body)}</blockquote>
    <p><a href="${opts.deepLink}" style="display:inline-block;background:#1d3a8f;color:#fff;padding:10px 18px;border-radius:999px;text-decoration:none;font-weight:700;font-size:14px">Take me to the message</a></p>
    <p style="color:#8a86a3;font-size:11.5px;margin-top:22px">You're receiving this because you have a conversation on ActivityOS.</p>
  </div>`,
    // Reply-To stays free for §JJ's per-thread reply address.
    { replyTo: false },
  );
}
