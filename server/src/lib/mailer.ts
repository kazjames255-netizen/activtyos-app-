import nodemailer, { type Transporter } from "nodemailer";
import type { Sender } from "./sender";

// Transactional email engine (product spec build item 9, minus per-provider
// sending domains for now).
//
//  - SMTP_HOST configured → real delivery through any SMTP provider
//    (Resend, Mailgun, SendGrid, Gmail app-password, …).
//  - Not configured → a throwaway Ethereal test inbox: mails are NOT
//    delivered, but every send logs a preview URL so the flows are fully
//    inspectable in development.
//
// Sends are fire-and-forget from the routes: an email failure must never
// fail a booking.

let transportPromise: Promise<{ t: Transporter; ethereal: boolean }> | null = null;

function getTransport() {
  if (!transportPromise) {
    if (process.env.SMTP_HOST) {
      const port = Number(process.env.SMTP_PORT || 587);
      transportPromise = Promise.resolve({
        t: nodemailer.createTransport({
          host: process.env.SMTP_HOST,
          port,
          secure: port === 465,
          auth: process.env.SMTP_USER
            ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
            : undefined,
        }),
        ethereal: false,
      });
    } else {
      transportPromise = nodemailer.createTestAccount().then((acc) => {
        console.log("[mail] no SMTP configured — using an Ethereal dev inbox (preview URLs below)");
        return {
          t: nodemailer.createTransport({
            host: acc.smtp.host,
            port: acc.smtp.port,
            secure: acc.smtp.secure,
            auth: { user: acc.user, pass: acc.pass },
          }),
          ethereal: true,
        };
      });
    }
  }
  return transportPromise;
}

// MAIL_FROM is the one authenticated identity ("ActivityOS <no-reply@…>" or a
// bare address). Its ADDRESS is fixed — providers only ever vary the display
// name in front of it (see lib/sender.ts).
const MAIL_FROM = process.env.MAIL_FROM || "ActivityOS <no-reply@activityos.local>";
const angled = MAIL_FROM.match(/<([^>]+)>/);
/** The platform's default From address. A tenant may override the LOCAL PART
 *  (see lib/sender.ts) — never the domain, which is the one we authenticate. */
export const fromAddress = (angled ? angled[1] : MAIL_FROM).trim();
/** The authenticated sending domain — everything after the last "@". */
export const fromDomain = fromAddress.slice(fromAddress.lastIndexOf("@") + 1);
/** The platform's own display name — used when no tenant identity applies. */
export const fromName = angled ? MAIL_FROM.slice(0, angled.index).trim().replace(/^"|"$/g, "") : "";

/** A file to attach — e.g. a child's EHCP plan on a booking notification.
 *  `content` is the raw bytes (Buffer) or a base64 string with `encoding`. */
export interface MailAttachment {
  filename: string;
  content: Buffer | string;
  contentType?: string;
  encoding?: string;
  /** Set to reference the file inline from the HTML as `cid:<value>` (e.g. an
   *  embedded logo) instead of showing it as a downloadable attachment. */
  cid?: string;
}

/** Returns true when the transport accepted the message — the campaign
 *  history uses it as the "delivered" count. Callers that don't care can
 *  keep treating this as fire-and-forget.
 *
 *  `sender` brands the mail for one provider: their name on the From line and
 *  their address on Reply-To. Omit it for platform mail. `opts.attachments`
 *  adds files (or inline `cid:` images). */
export async function sendMail(to: string, subject: string, html: string, sender?: Sender, opts?: { attachments?: MailAttachment[] }): Promise<boolean> {
  try {
    const { t, ethereal } = await getTransport();
    const info = await t.sendMail({
      // Object form so nodemailer does the quoting/MIME-encoding for names
      // with commas, quotes or accents.
      from: sender?.name || sender?.address
        ? { name: sender.name ?? fromName, address: sender.address ?? fromAddress }
        : MAIL_FROM,
      ...(sender?.replyTo ? { replyTo: sender.replyTo } : {}),
      to,
      subject,
      html,
      ...(opts?.attachments?.length ? { attachments: opts.attachments } : {}),
    });
    console.log(
      `[mail] "${subject}" → ${to}` +
        (sender?.name ? ` as "${sender.name}"` : "") +
        (sender?.replyTo ? ` (reply-to: ${sender.replyTo})` : "") +
        (ethereal ? ` (preview: ${nodemailer.getTestMessageUrl(info)})` : ""),
    );
    return true;
  } catch (e) {
    console.error(`[mail] failed to send "${subject}" to ${to}:`, e);
    return false;
  }
}
