import type { Booking } from "../../../features/bookings/types";
import { sendMail } from "./mailer";

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
       <p><a href="#" style="display:inline-block;background:#15b364;color:#fff;padding:10px 18px;border-radius:999px;text-decoration:none;font-weight:700;font-size:14px">Pay ${gbp(b.amount)} securely</a></p>
       <p style="color:#8a86a3;font-size:12px">(Online payment arrives with the Stripe milestone — this button is a placeholder.)</p>`,
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
