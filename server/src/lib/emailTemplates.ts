// Pure HTML/text builders for the customer-facing booking emails. No
// Firestore, no sendMail, no network: lib/emails.ts resolves branding, the
// listing's venue and the pay URL, then hands the results to these functions
// (which is also what lets tests/emails.test.mts check the content).
import type { Booking } from "../../../features/bookings/types";
import { BRAND } from "./brand";

export const gbp = (n: number) => `£${(Math.round(n * 100) / 100).toFixed(2)}`;

// Quotes too: this is also used inside attribute values (alt="…").
export function escapeHtml(s: string) {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

/** Every session date, 3-across (date over time) at small text. Session strings
 *  look like "Mon 20 Jul 2026 · 08:00 – 17:30". */
export function datesGridHtml(sessions: string[]): string {
  if (!sessions.length) return "<span style='color:#a7a3bd'>Dates to be confirmed</span>";
  // One line per day, stacked: side-by-side columns get squeezed or clipped on phones and in forwarded mail.
  return sessions.map((x) => {
    const [day, time] = x.split(" · ");
    return `<div style="padding:5px 0;border-bottom:1px solid #eef0f5;font-size:14px;line-height:1.35;color:#171534"><b>${escapeHtml(day ?? x)}</b>${time ? ` <span style="color:#6a6785">· ${escapeHtml(time)}</span>` : ""}</div>`;
  }).join("");
}

/** The customer booking-email shell: the PROVIDER's logo/name up top, all the
 *  session dates, a button straight to the booking, and "powered by ActivityOS"
 *  at the bottom. `hasLogo` gates the inline provider logo (cid:provider-logo).
 *  `title`/`bodyHtml` are HTML, inserted raw. */
export function layout(
  brand: { name: string; hasLogo: boolean },
  title: string,
  bodyHtml: string,
  b: Booking,
  ctx: { heroCid?: string; location?: string; homeVisit?: boolean; online?: boolean; joinInfo?: string; provided?: string[]; toBring?: string[]; mapCid?: string } = {},
  /** The web origin links are built on (emails.ts passes the live webUrl). */
  baseUrl = "",
): string {
  const kids = b.kids?.length ? b.kids.map((k) => k.name).join(", ") : b.child;
  const bookingUrl = `${baseUrl}/custdash/bookings?open=${encodeURIComponent(b.ref)}`;
  // Label above value, one block per row: a two-column table squeezed the values to the right on phones and dropped them entirely in
  // some clients when the mail was forwarded. Stacked blocks read the same everywhere.
  const row = (label: string, value: string) =>
    `<div style="padding:9px 0;border-bottom:1px solid #eef0f5"><div style="font-size:12px;line-height:1.3;color:#8a86a3;margin-bottom:2px">${escapeHtml(label)}</div><div style="font-size:15px;line-height:1.4;color:#171534">${value}</div></div>`;
  const header = brand.hasLogo
    ? `<img src="cid:provider-logo" alt="${escapeHtml(brand.name)}" style="max-height:48px;max-width:220px;display:inline-block" />`
    : `<span style="font-size:22px;font-weight:800;color:#1d3a8f">${escapeHtml(brand.name)}</span>`;
  const label = (t: string) => `<div style="font-size:12px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;color:#8a86a3;margin:20px 0 8px">${t}</div>`;
  const chips = (items: string[]) =>
    items.map((x) => `<span style="display:inline-block;background:#eef3ff;color:#1d3a8f;font-size:12.5px;font-weight:700;padding:5px 12px;border-radius:999px;margin:0 6px 6px 0">${escapeHtml(x)}</span>`).join("");
  return `
  <div style="margin:0;padding:0;background:#eef1f7">
  <div style="font-family:system-ui,-apple-system,'Segoe UI',sans-serif;background:#eef1f7;padding:24px 12px">
    <div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:18px;overflow:hidden;box-shadow:0 12px 34px -18px rgba(20,30,70,.4)">
      <div style="padding:24px 28px 20px;text-align:center;border-bottom:1px solid #eef0f5">${header}</div>
      ${ctx.heroCid ? `<img src="${ctx.heroCid}" alt="${escapeHtml(b.listing)}" width="600" style="display:block;width:100%;max-width:600px;height:auto;object-fit:cover;max-height:220px" />` : ""}
      <div style="padding:24px 28px 28px">
        <h1 style="font-size:22px;line-height:1.25;margin:0 0 14px;color:#171534">${title}</h1>
        ${bodyHtml}
        <div style="margin-top:16px">
          ${row("Activity", escapeHtml(b.listing))}
          ${row("Pass", escapeHtml(b.pass))}
          ${ctx.location ? row(ctx.homeVisit ? "We'll come to you at" : "Location", escapeHtml(ctx.location)) : ""}
          ${row("Child", escapeHtml(kids || "—"))}
          ${b.listPrice != null && (b.discountOff ?? 0) > 0 ? `${row("Price before discount", gbp(b.listPrice))}${row(`Discount${b.discountNames?.length ? ` (${b.discountNames.join(", ")})` : ""}`, `− ${gbp(b.discountOff ?? 0)}`)}` : ""}
          ${(b.addons ?? []).length ? row("Extras", (b.addonLines?.length && new Set(b.addonLines.map((l) => l.child)).size > 1 ? b.addonLines.map((l) => `${escapeHtml(l.label)} — ${gbp(l.price)} <span style="color:#8a86a3">(${escapeHtml(l.child)})</span>`) : (b.addons ?? []).map((a) => escapeHtml(a))).join("<br>")) : ""}
          ${row("Total", `<b>${gbp(b.amount)}</b>`)}
        </div>
        ${label("Dates &amp; times")}
        ${datesGridHtml(b.sessions ?? [])}
        ${ctx.mapCid ? `${label("Where")}<img src="${ctx.mapCid}" alt="Map of ${escapeHtml(ctx.location ?? b.listing)}" width="544" style="display:block;width:100%;max-width:544px;height:auto;border-radius:12px;border:1px solid #eef0f5" />${ctx.location ? `<div style="font-size:12px;color:#8a86a3;margin-top:6px">📍 ${escapeHtml(ctx.location)}</div>` : ""}` : ""}
        ${ctx.online && ctx.joinInfo ? `${label("How to join")}<div style="font-size:14px;line-height:1.6;color:#3d4763;white-space:pre-line">${escapeHtml(ctx.joinInfo)}</div>` : ""}
        ${ctx.provided && ctx.provided.length ? `${label("What's included")}<div>${chips(ctx.provided)}</div>` : ""}
        ${ctx.toBring && ctx.toBring.length ? `${label("What to bring")}<div>${chips(ctx.toBring)}</div>` : ""}
        <div style="text-align:center;margin:26px 0 4px">
          <a href="${bookingUrl}" style="display:inline-block;background:#15b364;color:#ffffff;padding:13px 32px;border-radius:999px;text-decoration:none;font-weight:800;font-size:15px;box-shadow:0 8px 20px -8px rgba(21,179,100,.6)">View my booking →</a>
        </div>
      </div>
      <div style="background:#f7f9fd;padding:16px 24px;text-align:center;border-top:1px solid #eef0f5">
        <img src="cid:aos-mark" width="15" height="15" alt="" style="vertical-align:middle;margin-right:6px;border-radius:4px;opacity:.9" />
        <span style="font-size:11.5px;color:#8a86a3;vertical-align:middle">Powered by <b style="color:#4a4763">${BRAND}</b></span>
        <div style="font-size:11px;color:#a7a3bd;margin-top:5px">You're receiving this because a booking was made with ${escapeHtml(brand.name)}.</div>
      </div>
    </div>
  </div>
  </div>`;
}

/** How to pay by bank transfer: the provider's own account and the reference to quote. */
export interface BankPayDetails { bankName?: string; accountName?: string; sortCode?: string; accountNumber?: string; reference: string; amount?: number }
export function bankPayHtml(bank: BankPayDetails): string {
  const row = (k: string, v?: string) => (v ? `<tr><td style="padding:3px 14px 3px 0;color:#6a6785;font-size:13px">${k}</td><td style="padding:3px 0;font-size:14px;font-weight:700;color:#171534">${escapeHtml(v)}</td></tr>` : "");
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:14px 0;border-collapse:separate"><tr><td style="background:#eef3ff;border-left:3px solid #1d3a8f;border-radius:6px;padding:12px 16px">
    <div style="font-size:11px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:#1d3a8f;margin-bottom:6px">Pay by bank transfer</div>
    <table role="presentation" cellpadding="0" cellspacing="0">${row("Bank", bank.bankName)}${row("Account name", bank.accountName)}${row("Sort code", bank.sortCode)}${row("Account number", bank.accountNumber)}${row("Payment reference", bank.reference)}${bank.amount != null ? row("Amount", `£${bank.amount.toFixed(2)}`) : ""}</table>
    <div style="font-size:12px;color:#6a6785;margin-top:6px">Please quote the reference exactly so your payment can be matched.</div>
  </td></tr></table>`;
}

/** What a customer booking email says, before the branded shell wraps it. */
export interface CustomerEmailSpec {
  subject: string;
  title: string;
  body: string;
  /** Pull in the listing's photo + venue (and, with whatIncluded/map, what's included / to bring / a venue map). */
  enrich?: { whatIncluded?: boolean; map?: boolean };
}

export function requestReceivedSpec(b: Booking, providerName: string): CustomerEmailSpec {
  return {
    subject: `Booking request received — ${b.listing}`,
    title: "We've got your booking request",
    body: `<p style="font-size:14px">Thanks ${escapeHtml(b.booker)} — your request is with ${escapeHtml(providerName)} for approval.
     You'll get another email as soon as it's confirmed. Payment is collected after approval.</p>`,
    enrich: {}, // hero photo + venue location
  };
}

export function waitlistJoinedSpec(b: Booking, providerName: string): CustomerEmailSpec {
  return {
    subject: `You're on the waiting list — ${b.listing}`,
    title: "You're on the waiting list",
    body: `<p style="font-size:14px">Hi ${escapeHtml(b.booker)} — the date you picked for ${escapeHtml(b.listing)} is full, so we've put you on ${escapeHtml(providerName)}'s waiting list.
     <b>Nothing to pay now.</b> If a place opens up we'll email you straight away, and you'll have a short time to accept it.</p>
     <p style="font-size:13px;color:#6a6785">You can leave the waiting list any time from My bookings.</p>`,
    enrich: {},
  };
}

export function paymentLinkSpec(b: Booking, providerName: string, payUrl: string): CustomerEmailSpec {
  return {
    subject: `Complete your booking — ${b.listing}`,
    title: "Your booking is reserved — payment inside",
    body: `<p style="font-size:14px">Hi ${escapeHtml(b.booker)}, ${escapeHtml(providerName)} has reserved this booking for you.</p>
     <p><a href="${payUrl}" style="display:inline-block;background:#1d3a8f;color:#fff;padding:10px 18px;border-radius:999px;text-decoration:none;font-weight:700;font-size:14px">Pay ${gbp(b.amount)} securely</a></p>
     <p style="color:#8a86a3;font-size:12px">No account or sign-in needed — the link opens a secure card payment for this booking.</p>`,
  };
}

export function bookingConfirmedSpec(b: Booking, providerName: string, bank?: BankPayDetails | null): CustomerEmailSpec {
  const closing = b.serviceAddress?.postcode
    ? `Great news ${escapeHtml(b.booker)} — ${escapeHtml(providerName)} has confirmed your booking. We'll come to you!`
    : `Great news ${escapeHtml(b.booker)} — ${escapeHtml(providerName)} has confirmed your booking. See you there!`;
  return {
    subject: `Booking confirmed — ${b.listing}`,
    title: "You're booked in ✓",
    body: `<p style="font-size:14px">${closing}</p>${bank ? bankPayHtml(bank) : ""}`,
    enrich: { whatIncluded: true, map: true }, // hero + location + what's included / to bring + venue map (skipped automatically for home-visit)
  };
}

export function bookingDeclinedSpec(b: Booking, providerName: string, reason?: string): CustomerEmailSpec {
  const note = reason?.trim()
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:14px 0;border-collapse:separate">
         <tr><td style="background:#fbf1f1;border-left:3px solid #d9736b;border-radius:6px;padding:11px 14px">
           <div style="font-size:11px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:#a1443c;margin-bottom:3px">Message from ${escapeHtml(providerName)}</div>
           <div style="font-size:14px;color:#4a2b28;white-space:pre-wrap">${escapeHtml(reason.trim())}</div>
         </td></tr>
       </table>`
    : "";
  return {
    subject: `Booking update — ${b.listing}`,
    title: "Your booking request was declined",
    body: `<p style="font-size:14px">Sorry ${escapeHtml(b.booker)} — ${escapeHtml(providerName)} couldn't take this booking.
     Nothing has been charged. Feel free to browse other dates or activities.</p>${note}`,
  };
}

export function refundApprovedSpec(b: Booking, providerName: string): CustomerEmailSpec {
  const toWallet = b.cancel?.refundTo === "wallet";
  const amt = b.cancel?.amount ? gbp(b.cancel.amount) : "";
  return {
    subject: toWallet ? `Wallet credit added — ${b.listing}` : `Refund approved — ${b.listing}`,
    title: toWallet ? "Your wallet credit is ready" : "Your refund is on its way",
    body: toWallet
      ? `<p style="font-size:14px">Hi ${escapeHtml(b.booker)} — ${escapeHtml(providerName)} approved your refund${amt ? ` of <b>${amt}</b>` : ""} as <b>wallet credit</b>.
         It&rsquo;s <b>already in your wallet</b> and ready to spend on your next booking — nothing else to do.</p>`
      : b.cancel?.refundVia === "offline"
        // A voucher / Tax-Free Childcare / cash booking: the app can't send it
        // back, and it was never on a card — don't say it's going there.
        ? `<p style="font-size:14px">Hi ${escapeHtml(b.booker)} — ${escapeHtml(providerName)} approved the refund for this booking${amt ? ` (<b>${amt}</b>)` : ""}.
           ${b.voucherScheme ? `It will be returned through <b>${escapeHtml(b.voucherScheme)}</b>, the way you paid.` : "They'll return it the way you paid."} If you have questions, reply to this email.</p>`
        : `<p style="font-size:14px">Hi ${escapeHtml(b.booker)} — ${escapeHtml(providerName)} approved the refund for this booking.
         ${amt ? `Amount: <b>${amt}</b>. It usually reaches your original payment method within 5–10 working days, depending on your bank.` : ""}</p>`,
  };
}

export function refundDeclinedSpec(b: Booking, providerName: string): CustomerEmailSpec {
  const amt = b.cancel?.amount ? gbp(b.cancel.amount) : "";
  return {
    subject: `Refund update — ${b.listing}`,
    title: "Your refund request was declined",
    body: `<p style="font-size:14px">Hi ${escapeHtml(b.booker)} — ${escapeHtml(providerName)} couldn&rsquo;t approve the refund${amt ? ` of <b>${amt}</b>` : ""} for this booking.
      Your cancellation still stands. If you&rsquo;d like to talk it through, reply to this email.</p>`,
  };
}

export function placeOfferedSpec(b: Booking, providerName: string, baseUrl: string): CustomerEmailSpec {
  const until = b.offerExpiresAt
    ? new Date(b.offerExpiresAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" }) // UK time, whatever the server's clock zone is
    : "";
  return {
    subject: `A place has opened up — ${b.listing}`,
    title: "A place is yours if you want it",
    body: `<p style="font-size:14px">Good news ${escapeHtml(b.booker)} — a place has opened up on the dates you were
     waiting for, and it's being held for you <b>for 2 hours${until ? ` (until ${until})` : ""}</b>.</p>
     <p style="font-size:14px"><b>One step to take it:</b> press the button, then accept and pay.
     If the hold runs out, the place passes to the next family in the queue.</p>
     <p><a href="${baseUrl}/custdash/bookings?pay=${encodeURIComponent(b.ref)}" style="display:inline-block;background:#1d3a8f;color:#fff;padding:12px 22px;border-radius:999px;text-decoration:none;font-weight:700;font-size:14px">Accept and pay</a></p>`,
  };
}

export function paymentReceivedSpec(b: Booking, providerName: string, opts: { label: string; amount: number; refs?: string[]; fullyPaid?: boolean }): CustomerEmailSpec {
  // One payment can settle several bookings (a basket spanning weeks): one email names them all.
  const many = (opts.refs?.length ?? 0) > 1;
  return {
    subject: `Payment received — ${b.listing}`,
    title: "Payment received ✓",
    body: `<p style="font-size:14px">Thanks ${escapeHtml(b.booker)} — ${escapeHtml(providerName)} has received your <b>${escapeHtml(opts.label)}</b>
      payment of <b>${gbp(opts.amount)}</b>. ${opts.fullyPaid === false ? "Thank you — we have recorded it against your booking" + (many ? "s" : "") : many ? "Your bookings are now fully paid" : "Your booking is now fully paid"}. Thank you!</p>${many ? `<p style="font-size:13px;color:#6a6785">Booking references: <b>${opts.refs!.map((r) => escapeHtml(r)).join(", ")}</b></p>` : ""}`,
    enrich: {}, // hero photo + venue location; the details table shows dates / who / total
  };
}

/** §H — the ONE email when an operator books for a family. Returns subject + html. */
export function familyBookingCreatedEmail(
  bookings: Booking[],
  providerName: string,
  opts: { accountCreated: boolean; passwordLink: string | null },
  payUrl: string,
  /** Where it happens (venue address, or the family's own address for a home visit). */
  venue?: string,
): { subject: string; html: string } {
  const b = bookings[0];
  const total = bookings.reduce((s, x) => s + x.amount, 0);
  const refs = bookings.map((x) => x.ref).join(", ");
  // The per-session lines carry the times ("Mon 05 Oct 2026 · 09:00 – 15:00"); fall back to the date range.
  const sessionLines = [...new Set(bookings.flatMap((x) => x.sessions ?? []))];
  return {
    subject: `Your booking with ${providerName} (${refs})`,
    html: `
  <div style="font-family:system-ui,-apple-system,sans-serif;max-width:560px;margin:0 auto;color:#171534">
    <div style="padding:18px 0 10px;border-bottom:2px solid #1d3a8f">
      <strong style="font-size:18px">${escapeHtml(providerName)}</strong>
      <span style="color:#8a86a3;font-size:12px"> · via ${BRAND}</span>
    </div>
    <h2 style="font-size:19px;margin:18px 0 6px">Your booking is confirmed</h2>
    <p style="font-size:14px">Hi ${escapeHtml(b.booker)} — ${escapeHtml(providerName)} has made this booking for you
      (you spoke to them, or they took it over the phone), and it now lives in your own
      ${BRAND} account so you can see it, pay it, and manage it any time.</p>
    <table style="margin:14px 0;border-collapse:collapse;font-size:13.5px" cellpadding="0">
      <tr><td style="color:#8a86a3;padding:3px 14px 3px 0">Booking ref${bookings.length > 1 ? "s" : ""}</td><td><b>${refs}</b></td></tr>
      <tr><td style="color:#8a86a3;padding:3px 14px 3px 0">Activity</td><td>${escapeHtml(b.listing)}</td></tr>
      <tr><td style="color:#8a86a3;padding:3px 14px 3px 0">Dates</td><td>${b.dates}</td></tr>
      ${sessionLines.length ? `<tr><td style="color:#8a86a3;padding:3px 14px 3px 0;vertical-align:top">Times</td><td>${sessionLines.map((x) => escapeHtml(x)).join("<br>")}</td></tr>` : ""}
      ${venue ? `<tr><td style="color:#8a86a3;padding:3px 14px 3px 0;vertical-align:top">Where</td><td>${escapeHtml(venue)}</td></tr>` : ""}
      <tr><td style="color:#8a86a3;padding:3px 14px 3px 0">Total</td><td><b>${gbp(total)}</b></td></tr>
    </table>
    ${total > 0
      ? `<p style="font-size:14px">Pay securely by card — no sign-in needed:</p>
    <p><a href="${payUrl}" style="display:inline-block;background:#15b364;color:#fff;padding:10px 18px;border-radius:999px;text-decoration:none;font-weight:700;font-size:14px">Pay ${gbp(total)}</a></p>`
      : `<p style="font-size:14px">There's nothing to pay for this booking.</p>`}
    ${
      opts.accountCreated && opts.passwordLink
        ? `<p style="font-size:14px"><b>Finish your details</b> — we created an account for you with this booking. Set a password to see your bookings and add your child&#39;s allergies, emergency contact and your address:</p>
           <p><a href="${opts.passwordLink}" style="display:inline-block;background:#1d3a8f;color:#fff;padding:10px 18px;border-radius:999px;text-decoration:none;font-weight:700;font-size:14px">Set my password</a></p>`
        : ""
    }
    <p style="color:#8a86a3;font-size:11.5px;margin-top:22px">
      You're receiving this because ${escapeHtml(providerName)} made a booking for this email address.
      If that wasn't you, reply and tell them.</p>
  </div>`,
  };
}

/** The provider's "customer asked to cancel" notice (bell + email): title,
 *  body and subject. `fmtMoney` is features/bookings/helpers' money(). */
export function cancellationRequestNotice(
  updated: Booking,
  fmtMoney: (n: number) => string,
): { title: string; body: string; subject: string } {
  const kids = [...new Set((updated.kids ?? []).map((k) => k.name).filter(Boolean))].join(", ") || updated.child || updated.booker;
  const amt = updated.cancel?.amount ?? 0;
  // Say WHERE the family asked the money to go — wallet, card, or a scheme.
  const vScheme = updated.voucherScheme;
  const isVoucher = !!vScheme || /voucher|tax-?free|tfc|childcare|haf/i.test(updated.method ?? "");
  const destTxt = updated.cancel?.refundTo === "wallet"
    ? "to their wallet"
    : isVoucher ? `via ${vScheme ?? (/tax-?free|tfc/i.test(updated.method ?? "") ? "Tax-Free Childcare" : "their voucher scheme")} (not a bank card)` : /bank|transfer/i.test(updated.method ?? "") ? "to their bank account" : "back to their card";
  const refundTxt = updated.cancel?.refund === "none" || amt <= 0
    ? "No refund is due under your cancellation policy."
    : `${fmtMoney(amt)} refund requested ${destTxt}.`;
  // What the parent told us: the reason they picked and/or what they typed in "Anything to add?" (the stock fallback isn't a reason).
  // The stored message also carries our own words (the stock "Cancelled by the parent." and the policy explanation in brackets): keep only the parent's.
  const said = (updated.cancel?.msg ?? "").replace(/^Cancelled by the parent\.?\s*/i, "").replace(/\s*\((?:Cancelled|Credit note|Within|Outside)[^)]*\)\s*$/i, "").replace(/^\s*[—-]\s*/, "").trim();
  const typed = said;
  const reasonPart = [updated.cancel?.reason, typed ? `"${typed}"` : ""].filter(Boolean).join(" — ");
  const reasonTxt = reasonPart ? ` Reason: ${reasonPart}${/[.!?]$/.test(reasonPart) ? "" : "."}` : "";
  return {
    title: `${updated.booker} asked to cancel — ${updated.listing}`,
    body: `Booking ${updated.ref} · ${updated.listing} · ${kids}${updated.dates ? ` · ${updated.dates}` : ""}.${reasonTxt} ${refundTxt}`,
    subject: `${updated.booker} — cancellation request`,
  };
}
