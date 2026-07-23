import type { Booking } from "../../../features/bookings/types";
import { sendMail } from "./mailer";
import { webUrl } from "./stripe";

// Booking email templates. Plain, inline-styled HTML — per-provider branding
// and sending domains come with the white-label milestone.

const gbp = (n: number) => `£${(Math.round(n * 100) / 100).toFixed(2)}`;

function layout(providerName: string, title: string, bodyHtml: string, b: Booking): string {
  return `
  <div style="font-family:system-ui,-apple-system,sans-serif;max-width:560px;margin:0 auto;color:#171534">
    <div style="padding:18px 0 10px;border-bottom:2px solid #1d3a8f">
      <strong style="font-size:18px">${providerName}</strong>
      <span style="color:#8a86a3;font-size:12px"> · via ActivityOS</span>
    </div>
    <h2 style="font-size:19px;margin:18px 0 6px">${title}</h2>
    ${bodyHtml}
    <table style="margin:14px 0;border-collapse:collapse;font-size:13.5px" cellpadding="0">
      <tr><td style="color:#8a86a3;padding:3px 14px 3px 0">Booking ref</td><td><b>${b.ref}</b></td></tr>
      <tr><td style="color:#8a86a3;padding:3px 14px 3px 0">Activity</td><td>${b.listing}</td></tr>
      <tr><td style="color:#8a86a3;padding:3px 14px 3px 0">Pass</td><td>${b.pass}</td></tr>
      <tr><td style="color:#8a86a3;padding:3px 14px 3px 0">Dates</td><td>${b.dates}</td></tr>
      <tr><td style="color:#8a86a3;padding:3px 14px 3px 0">Child</td><td>${b.kids?.length ? b.kids.map((k) => k.name).join(", ") : b.child}</td></tr>
      <tr><td style="color:#8a86a3;padding:3px 14px 3px 0">Total</td><td><b>${gbp(b.amount)}</b></td></tr>
    </table>
    <p style="color:#8a86a3;font-size:11.5px;margin-top:22px">
      You're receiving this because a booking was made with ${providerName}.
    </p>
  </div>`;
}

export function emailBookingRequestReceived(b: Booking, providerName: string): void {
  void sendMail(
    b.email,
    `Booking request received — ${b.listing} (${b.ref})`,
    layout(
      providerName,
      "We've got your booking request",
      `<p style="font-size:14px">Thanks ${b.booker} — your request is with ${providerName} for approval.
       You'll get another email as soon as it's confirmed. Payment is collected after approval.</p>`,
      b,
    ),
  );
}

export function emailPaymentLink(b: Booking, providerName: string): void {
  void sendMail(
    b.email,
    `Complete your booking — ${b.listing} (${b.ref})`,
    layout(
      providerName,
      "Your booking is reserved — payment link inside",
      `<p style="font-size:14px">Hi ${b.booker}, ${providerName} has reserved this booking for you.</p>
       <p><a href="${webUrl}/custdash/bookings?pay=${encodeURIComponent(b.ref)}" style="display:inline-block;background:#15b364;color:#fff;padding:10px 18px;border-radius:999px;text-decoration:none;font-weight:700;font-size:14px">Pay ${gbp(b.amount)} securely</a></p>
       <p style="color:#8a86a3;font-size:12px">The link opens your bookings — sign in and the card payment starts automatically.</p>`,
      b,
    ),
  );
}

export function emailBookingConfirmed(b: Booking, providerName: string): void {
  void sendMail(
    b.email,
    `Booking confirmed — ${b.listing} (${b.ref})`,
    layout(
      providerName,
      "You're booked in ✓",
      `<p style="font-size:14px">Great news ${b.booker} — ${providerName} has confirmed your booking. See you there!</p>`,
      b,
    ),
  );
}

export function emailBookingDeclined(b: Booking, providerName: string): void {
  void sendMail(
    b.email,
    `Booking update — ${b.listing} (${b.ref})`,
    layout(
      providerName,
      "Your booking request was declined",
      `<p style="font-size:14px">Sorry ${b.booker} — ${providerName} couldn't take this booking.
       Nothing has been charged. Feel free to browse other dates or activities.</p>`,
      b,
    ),
  );
}

export function emailRefundApproved(b: Booking, providerName: string): void {
  void sendMail(
    b.email,
    `Refund approved — ${b.listing} (${b.ref})`,
    layout(
      providerName,
      "Your refund is on its way",
      `<p style="font-size:14px">Hi ${b.booker} — ${providerName} approved the refund for this booking.
       ${b.cancel?.amount ? `Amount: <b>${gbp(b.cancel.amount)}</b>.` : ""}</p>`,
      b,
    ),
  );
}

export function emailPlaceOffered(b: Booking, providerName: string): void {
  const until = b.offerExpiresAt
    ? new Date(b.offerExpiresAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })
    : "";
  void sendMail(
    b.email,
    `A place has opened up — ${b.listing} (${b.ref})`,
    layout(
      providerName,
      "A place is yours if you want it",
      `<p style="font-size:14px">Good news ${b.booker} — a place has opened up on the dates you were
       waiting for, and it's being held for you <b>for 2 hours${until ? ` (until ${until})` : ""}</b>.</p>
       <p style="font-size:14px">Sign in to <b>My bookings</b> and accept the offer to take the place —
       if the hold runs out, it passes to the next family in the queue.</p>`,
      b,
    ),
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
}): void {
  const cta = p.existed ? "Sign in" : "Set your password";
  void sendMail(
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
  void sendMail(
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
  const refRows = scheme.details
    .map((d) => `<tr><td style="color:#8a86a3;padding:3px 14px 3px 0">${d.label}</td><td><b>${d.value}</b></td></tr>`)
    .join("");
  const sendBy = b.voucherSendBy
    ? new Date(`${b.voucherSendBy}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "long", timeZone: "UTC" })
    : null;
  void sendMail(
    b.email,
    `Pay by childcare voucher — ${b.listing} (${b.ref})`,
    layout(
      providerName,
      `Pay with ${scheme.name}`,
      `<p style="font-size:14px">Your place is held, ${b.booker}. Pay <b>${gbp(b.amount)}</b> through
        <b>${scheme.name}</b> on their own website, quoting:</p>
       <table style="margin:10px 0;border-collapse:collapse;font-size:13.5px" cellpadding="0">${refRows}
        <tr><td style="color:#8a86a3;padding:3px 14px 3px 0">Booking ref</td><td><b>${b.ref}</b></td></tr>
        <tr><td style="color:#8a86a3;padding:3px 14px 3px 0">Amount</td><td><b>${gbp(b.amount)}</b></td></tr></table>
       ${sendBy ? `<p style="font-size:14px"><b>Please send it by ${sendBy}</b> so it reaches ${providerName} in time to keep the place.</p>` : ""}
       <p style="color:#8a86a3;font-size:12px">Voucher money takes a few working days to arrive — the provider will mark your place paid once it lands.</p>`,
      b,
    ),
  );
}

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Notify a recipient (parent or operator) that they've got a new message. The
 * body is quoted inline and a button deep-links to the thread. Reply-by-email
 * ingest is not built yet (handoff §JJ), so we don't invite email replies. */
export function emailNewMessage(
  to: string,
  opts: { providerName: string; senderName: string; body: string; deepLink: string },
): void {
  void sendMail(
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
  );
}
