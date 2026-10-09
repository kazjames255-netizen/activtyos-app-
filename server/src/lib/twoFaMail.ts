import type { MailOutcome } from "./mailer";
import { BRAND } from "./brand";

// Pure helpers for the HQ sign-in code email (routes/twoFa.ts). Kept free of Firestore/network so the rules are unit-testable.

/** Fixed subject: must not depend on the (renameable, placeholder) brand name. The brand only appears in the body. */
export const TWO_FA_SUBJECT = "Your sign-in code";

export const twoFaHtml = (code: string, ttlMinutes: number, brand: string = BRAND): string => `
    <p>Your ${brand} platform sign-in code is:</p>
    <p style="font-size:28px;font-weight:800;letter-spacing:4px;">${code}</p>
    <p>This code expires in ${ttlMinutes} minutes. If you didn't request this, you can ignore this email.</p>
  `;

const SHAPE = /^[^\s@,]+@[^\s@.,]+(\.[^\s@.,]+)+$/;

/** HQ_2FA_FALLBACK_EMAILS: comma/space separated break-glass inboxes. Empty/unset => []. Invalid entries and the primary are dropped. */
export function parseFallbackEmails(raw: string | undefined, primary: string): string[] {
  const out: string[] = [];
  for (const a of (raw ?? "").split(/[,\s;]+/).map((s) => s.trim().toLowerCase())) {
    if (a && SHAPE.test(a) && a !== primary.toLowerCase() && !out.includes(a)) out.push(a);
  }
  return out;
}

export type Send = (to: string, subject: string, html: string) => Promise<MailOutcome>;

export interface TwoFaDelivery {
  /** True only when the transport really accepted the code for at least one inbox. "suppressed" does NOT count. */
  delivered: boolean;
  /** Which inbox class took it. */
  via: "primary" | "fallback" | null;
  /** Primary-send outcome kind, for logs/counters (never the code, never secrets). */
  primary: "sent" | "suppressed" | "failed";
  /** Short error CATEGORY of the primary send when it did not go out. */
  errorKind?: string;
  fallbackTried: number;
}

/** Short, single-line reason for a send that did not go out (truncated: no bodies, no long transport dumps). */
export const errorKindOf = (o: MailOutcome): string | undefined =>
  o.status === "sent" ? undefined
    : o.status === "suppressed" ? "suppressed (MAIL_LIVE off and recipient not in MAIL_ALLOWLIST)"
    : (o.error ?? "unknown").slice(0, 40).replace(/[\r\n]+/g, " ");

/** Send the code to the primary inbox; ONLY if that did not go out, also to each fallback inbox (default none). */
export async function deliverTwoFaCode(send: Send, primary: string, fallbacks: string[], subject: string, html: string): Promise<TwoFaDelivery> {
  const p = await send(primary, subject, html);
  if (p.status === "sent") return { delivered: true, via: "primary", primary: "sent", fallbackTried: 0 };
  let delivered = false;
  for (const to of fallbacks) {
    const f = await send(to, subject, html);
    if (f.status === "sent") delivered = true;
  }
  return { delivered, via: delivered ? "fallback" : null, primary: p.status, errorKind: errorKindOf(p), fallbackTried: fallbacks.length };
}
