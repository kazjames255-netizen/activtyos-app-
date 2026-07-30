import nodemailer, { type Transporter } from "nodemailer";

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

/** Returns true when the transport accepted the message — the campaign
 *  history uses it as the "delivered" count. Callers that don't care can
 *  keep treating this as fire-and-forget. */
export async function sendMail(to: string, subject: string, html: string): Promise<boolean> {
  try {
    const { t, ethereal } = await getTransport();
    const info = await t.sendMail({
      from: process.env.MAIL_FROM || 'ActivityOS <no-reply@activityos.local>',
      to,
      subject,
      html,
    });
    console.log(
      `[mail] "${subject}" → ${to}` +
        (ethereal ? ` (preview: ${nodemailer.getTestMessageUrl(info)})` : ""),
    );
    return true;
  } catch (e) {
    console.error(`[mail] failed to send "${subject}" to ${to}:`, e);
    return false;
  }
}
