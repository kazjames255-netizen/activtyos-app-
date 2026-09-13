// Shared inbox bits — the stored-message shape, the plain-text extraction the
// previews depend on, and the demo inbox. Lifted out of EmailApp so the
// dashboard's Inbox card can show the SAME messages, previews and counts the
// Email page does without pulling the whole 2k-line Email surface into the
// dashboard bundle.

// A received message as the API stores it (see server routes/emails.ts —
// `emailMessages`, filled by the inbound webhook).
export interface ServerMail {
  id: string;
  from: string;
  fromEmail?: string;
  to?: string;
  subject: string;
  body?: string;
  html?: string;
  labels?: string[];
  attachments?: { name: string; size?: string }[];
  unread?: boolean;
  starred?: boolean;
  snoozedUntil?: string | null;
  folder?: string;
  at?: string;
}

// The named entities real mail actually uses — an em-dash left as "&mdash;"
// in a preview reads as a typo.
const ENTITIES: Record<string, string> = {
  nbsp: " ", amp: "&", lt: "<", gt: ">", quot: '"', apos: "'",
  mdash: "—", ndash: "–", hellip: "…", lsquo: "‘", rsquo: "’", ldquo: "“", rdquo: "”",
  pound: "£", euro: "€", copy: "©", reg: "®", trade: "™", middot: "·", bull: "•",
};

// HTML (from the rich editor, or an inbound mail) → a plain-text fallback.
//
// <style>/<script>/<head> go first, CONTENTS included: stripping tags alone
// leaves the stylesheet itself behind as text, which is why a marketing email
// from Mailchimp or Resend opened as a wall of `*{box-sizing:border-box}…`.
// Comments (and Outlook's `<!--[if mso]>` blocks) go the same way.
export function htmlToText(html: string): string {
  return html
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<(style|script|head|title)\b[^>]*>[\s\S]*?<\/\1>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n").replace(/<\/(p|div|h[1-6]|li|tr|table)>/gi, "\n").replace(/<li[^>]*>/gi, "• ")
    .replace(/<[^>]+>/g, "")
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)))
    .replace(/&(nbsp|amp|lt|gt|quot|apos|mdash|ndash|hellip|lsquo|rsquo|ldquo|rdquo|pound|euro|copy|reg|trade|middot|bull);/g,
      (m, e) => ENTITIES[e] ?? m)
    .replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n")
    .trim();
}

// Many emails (Gmail/Outlook) send the real content as HTML with only a sparse
// text/plain part — often just a "--" signature. Show whichever is fuller so the
// whole message is visible; both are rendered as plain text (linkified), never
// as raw HTML, so there's no XSS surface.
export function bestBody(m: ServerMail): string {
  const text = (m.body ?? "").trim();
  const fromHtml = m.html ? htmlToText(m.html) : "";
  return fromHtml.length > text.length ? fromHtml : text;
}

// One line of the message, collapsed — what a preview row shows.
export const previewOf = (m: ServerMail, chars = 120): string => bestBody(m).replace(/\s+/g, " ").slice(0, chars);

// A message counts as "in the inbox" unless it's been filed elsewhere; an
// absent folder is inbox (older docs predate the field).
export const inInbox = (m: ServerMail): boolean => (m.folder ?? "inbox") === "inbox";

// Demo inbox — shown only when the real inbox is empty, so the enquiry flow can be tried end-to-end.
export const DEMO_INBOX: ServerMail[] = [
  { id: "demo-1", from: "Sarah Thompson", fromEmail: "sarah.thompson@gmail.com", subject: "Summer camp availability?", body: "Hi, do you have any spaces left on your summer multi-activity camp in August? My daughter is 8. Thanks, Sarah", unread: true, folder: "inbox", at: "2026-07-31T08:42:00Z" },
  { id: "demo-2", from: "James Patel", fromEmail: "j.patel@outlook.com", subject: "After-school football", body: "Hello — I'm interested in the after-school football club in Milton Keynes for my two boys. What days does it run and how much is it? Cheers, James", unread: true, folder: "inbox", at: "2026-07-31T07:15:00Z" },
  { id: "demo-3", from: "Emma Wilson", fromEmail: "emmawilson88@icloud.com", subject: "Holiday club prices", body: "Could you send me a price list for the October holiday club please? Do you offer sibling discounts? Emma", unread: false, labels: ["enquiry"], folder: "inbox", at: "2026-07-30T16:20:00Z" },
  { id: "demo-4", from: "Tom Harris", fromEmail: "tomharris.mk@gmail.com", subject: "Two children — any spaces?", body: "Hi there, we've just moved to Aylesbury and I'm looking for holiday cover for my 6 and 9 year old. Do you have space and what are your hours? Tom", unread: true, folder: "inbox", at: "2026-07-30T11:03:00Z" },
  { id: "demo-5", from: "Priya Shah", fromEmail: "priya.shah@gmail.com", subject: "SEN support question", body: "Hello, my son has additional needs (ASD) — are your camps able to support him, and do you have 1:1 options? Thank you, Priya", unread: true, folder: "inbox", at: "2026-07-29T18:47:00Z" },
];
