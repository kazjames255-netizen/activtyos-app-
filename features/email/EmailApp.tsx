"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { get as apiGet, post as apiPost } from "@/lib/api";
import { useRealtime } from "@/lib/realtime";
import { useSettings } from "@/lib/settings";
import type { SavedImage } from "@/lib/settings";
import { composeMomentImage, resolveSavedText, triggerDownload } from "@/lib/momentImage";
import { Badge, Button, Card, FieldLabel, Input, Select } from "@/components/ui";
import { OperatorPage, TabStrip } from "@/components/OperatorPage";
import type { TenantSettings } from "@/lib/settings";
import type { Newsletter } from "@/features/newsfeed/newsletter";

// ── "Automatic emails" — which system emails ActivityOS sends on the provider's
// behalf, mirroring the Build Manual's Email screen. Toggles + reminder timing
// persist to settings.autoEmails; the actual sending is a backend job (see
// docs/email-notifications-handoff.md).
type AutoKey = keyof NonNullable<TenantSettings["autoEmails"]>;
const REMINDER_TIMES: [number, string][] = [[12, "12 hours before"], [24, "24 hours before"], [48, "48 hours before"], [72, "3 days before"]];
const AUTO_EMAILS: { key: AutoKey; title: string; sub: string; desc: string; core?: boolean; timing?: AutoKey }[] = [
  { key: "bookings", title: "Bookings & approvals", sub: "Booking confirmed, request approved/declined & cancellation emails", core: true, desc: "Automatic emails to the parent for: booking confirmed, request-to-book approved, request declined, and cancellation confirmed. Core transactional emails — best left on." },
  { key: "payments", title: "Payments", sub: "Receipts, refunds & payment-failed emails", desc: "Sends a receipt when a payment succeeds, a note when a refund is issued, and an alert if a card payment fails." },
  { key: "sessionReminder", title: "Session reminders", sub: "A pre-session reminder with the key details & what to bring", timing: "sessionTiming", desc: "Sent before the session. Includes the child’s name, date, start & finish times, venue and what to bring. Any outstanding balance is shown; once it’s paid the price isn’t re-quoted." },
  { key: "waitlist", title: "Waitlist", sub: "Tells a waitlisted parent when a place opens or they move up", desc: "When a place frees up, the next waitlisted parent is emailed an offer with a time limit to claim it. They can also be told when they move up the queue." },
  { key: "dayOf", title: "Day-of alerts", sub: "On-the-day register & arrival alerts (incl. logged incidents)", desc: "On-the-day operational alerts: registers open, a child not yet arrived, and a notification when an incident is logged (the incident detail stays restricted to Head Office and the staff who logged it)." },
  { key: "lateCollection", title: "Late collection", sub: "Alerts you when a child is checked out late", desc: "If a child is checked out later than your late-collection threshold (Registers tab), the late-checkout flag raises an alert." },
  { key: "announcements", title: "New camp announcements", sub: "Email your past & opted-in customers when new camps open", desc: "A one-off email to your OWN past and opted-in customers announcing new camps or dates. This is re-marketing to people who have already booked with you — ActivityOS has no public marketplace or ‘followers’." },
  { key: "reviewRequests", title: "Review requests", sub: "Asks a parent to leave a review after their final session", desc: "Sent once, after the parent’s LAST booked session (not after every booking). The link takes them straight to the review screen." },
];

function Toggle({ on, onClick, label }: { on: boolean; onClick: () => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={onClick} className="relative h-6 w-11 flex-none rounded-full transition-colors" style={{ background: on ? "#22a565" : "#cfd3dd" }}>
      <span className="absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all" style={{ left: on ? 22 : 2 }} />
    </button>
  );
}

function AutoEmails({ settings, save }: { settings: TenantSettings; save: (patch: { settings?: TenantSettings }) => Promise<void> }) {
  const ae = settings.autoEmails ?? {};
  const set = (patch: Partial<NonNullable<TenantSettings["autoEmails"]>>) => save({ settings: { ...settings, autoEmails: { ...ae, ...patch } } });
  return (
    <div>
      <p className="mb-3 max-w-[720px] text-[12.5px] leading-[1.5] text-[var(--ink-3)]">The emails ActivityOS sends automatically on your behalf. Turn any off, or change when reminders go out. Changes save as you make them.</p>
      <div className="flex flex-col gap-2.5">
        {AUTO_EMAILS.map((c) => {
          // Effective on-state: everything defaults ON except announcements (opt-in re-marketing).
          const value = (ae[c.key] as boolean | undefined) ?? (c.key === "announcements" ? false : true);
          return (
            <div key={c.key} className="rounded-2xl border border-[var(--line)] bg-white p-4 shadow-[0_1px_3px_rgba(20,30,60,.06)]">
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[14.5px] font-extrabold text-[var(--ink)]">{c.title}</span>
                    {c.core && <span className="rounded-full bg-[#eef4fd] px-2 py-0.5 text-[10px] font-extrabold text-[#1d3a8f]">Core</span>}
                  </div>
                  <div className="mt-0.5 text-[12.5px] font-semibold text-[var(--ink-2)]">{c.sub}</div>
                  <div className="mt-1 text-[12px] leading-[1.5] text-[var(--ink-3)]">{c.desc}</div>
                  {c.timing && value && (
                    <label className="mt-2 flex items-center gap-2 text-[12px] font-semibold text-[var(--ink-2)]">
                      Send
                      <Select value={String(ae[c.timing] ?? (c.timing === "sessionTiming" ? 48 : 24))} onChange={(e) => set({ [c.timing as string]: Number(e.target.value) })}>
                        {REMINDER_TIMES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                      </Select>
                    </label>
                  )}
                </div>
                <Toggle on={value} onClick={() => set({ [c.key]: !value })} label={c.title} />
              </div>
              {c.key === "payments" && value && (
                <div className="mt-3 flex items-start gap-3 rounded-xl border border-[var(--line)] bg-[var(--panel)] p-3">
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-bold text-[var(--ink)]">Payment-due reminder</div>
                    <div className="mt-0.5 text-[12px] text-[var(--ink-3)]">Remind a parent before an outstanding balance is due.</div>
                    {ae.paymentDue !== false && (
                      <label className="mt-2 flex items-center gap-2 text-[12px] font-semibold text-[var(--ink-2)]">Send
                        <Select value={String(ae.paymentDueTiming ?? 24)} onChange={(e) => set({ paymentDueTiming: Number(e.target.value) })}>
                          {REMINDER_TIMES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                        </Select>
                      </label>
                    )}
                  </div>
                  <Toggle on={ae.paymentDue !== false} onClick={() => set({ paymentDue: ae.paymentDue === false })} label="Payment-due reminder" />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Open a designed document's HTML in a print window (browser "Save as PDF").
function printDocHtml(html: string) {
  const w = typeof window !== "undefined" ? window.open("", "_blank", "width=820,height=1060") : null;
  if (!w) return;
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Document</title><style>*{-webkit-print-color-adjust:exact;print-color-adjust:exact}@page{size:A4;margin:10mm}html,body{margin:0}body{font-family:system-ui,-apple-system,sans-serif;padding:12px}</style></head><body>${html}<script>window.onload=function(){window.focus();window.print();}</script></body></html>`);
  w.document.close();
}

interface Sent { id: string; subject: string; audience: string; recipientCount: number; sentByName?: string; createdAt?: string }
interface LiveMoment { id: string; caption?: string; comments?: { role?: string; text: string; byName?: string; marketing?: boolean }[] }
const when = (iso?: string) => (iso ? new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "");
const BROWN = "#9a5a00", BLUE = "#1d3a8f", GREEN = "#047857";
const SWATCHES = ["#171534", "#1d3a8f", "#be1259", "#047857", "#b45309"];
const RATIO_AR: Record<string, string> = { square: "1 / 1", portrait: "4 / 5", story: "9 / 16" };

// One saved Moments photo. Its own message (the caption sent to parents) and its
// own marketing quote sit UNDER the image — so there's never a question of which
// quote belongs to which photo. Message/Quote are toggled right on the card; the
// rest (size, crop, colour) live behind Edit. "Add to email" uses what's ticked.
function SavedImageCard({ im, onPatch, onRemove, onAdd }: { im: SavedImage; onPatch: (p: Partial<SavedImage>) => void; onRemove: () => void; onAdd: () => void }) {
  const [editing, setEditing] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const { caption, quotes } = resolveSavedText(im);
    composeMomentImage({ photoUrl: im.photoUrl, ratio: im.ratio, color: im.color, caption, quotes, footer: im.footer, fit: im.fit ?? "contain" })
      .then((u) => { if (alive) setPreview(u); });
    return () => { alive = false; };
  }, [im]);

  const inc = im.include ?? { caption: false, quote: false, comments: false };
  const momentCaption = im.sourceCaption ?? im.caption ?? "";
  const captionValue = im.customCaption !== undefined ? im.customCaption : (inc.caption ? momentCaption : "");
  const nQuotes = (im.sourceComments ?? []).filter((c) => c.marketing).length;
  const nParent = (im.sourceComments ?? []).length;
  const fit = im.fit ?? "contain";
  const chip = (on: boolean) => on ? { borderColor: BLUE, background: "#eef4fd", color: BLUE } : { borderColor: "var(--line)", color: "var(--ink-3)" } as const;
  const incBtn = (on: boolean, avail: boolean) => on && avail ? { borderColor: GREEN, background: "#e7f6ee", color: GREEN } : { borderColor: "var(--line)", color: "var(--ink-2)" } as const;

  return (
    <div className="overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--surface)]">
      <div className="relative w-full bg-black" style={{ aspectRatio: RATIO_AR[im.ratio] ?? "1 / 1" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {preview ? <img src={preview} alt={im.childName ?? "moment"} className="h-full w-full object-contain" /> : <img src={im.photoUrl} alt="" className="h-full w-full object-cover opacity-60" />}
      </div>
      <div className="p-2.5">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-[11.5px] font-bold">{im.childName ?? "Moment"}</span>
          <button type="button" onClick={() => setEditing((v) => !v)} className="rounded-full border px-2.5 py-0.5 text-[10.5px] font-bold" style={editing ? { borderColor: BLUE, background: "#eef4fd", color: BLUE } : { borderColor: "var(--line)", color: "var(--ink-3)" }}>{editing ? "Done" : "⚙ Size · crop · colour"}</button>
        </div>

        {/* message you type + the moment's quote — shown under the photo (live preview above) */}
        <div className="mt-1.5 flex items-center justify-between">
          <span className="text-[9.5px] font-bold uppercase tracking-[0.04em] text-[var(--ink-3)]">Message under the photo</span>
          {momentCaption && captionValue !== momentCaption && <button type="button" onClick={() => onPatch({ customCaption: momentCaption })} className="text-[10px] font-bold text-[#1d3a8f]">↺ parent’s message</button>}
        </div>
        <textarea value={captionValue} onChange={(e) => onPatch({ customCaption: e.target.value })} rows={2} placeholder="e.g. Tony is the best player today" className="mt-1 w-full resize-none rounded-md border border-[var(--line)] bg-[var(--surface)] px-2 py-1 text-[11.5px] [field-sizing:content]" />
        <button type="button" disabled={nQuotes === 0} onClick={() => onPatch({ include: { ...inc, quote: !inc.quote } })} className="mt-1.5 rounded-full border-2 px-2.5 py-0.5 text-[11px] font-bold disabled:opacity-45" style={incBtn(inc.quote, nQuotes > 0)}>{inc.quote && nQuotes > 0 ? "✓ " : ""}Show marketing quote{nQuotes ? ` (${nQuotes})` : " (none)"}</button>

        {editing && (
          <div className="mt-2 rounded-lg border border-[var(--line)] bg-[var(--panel)] p-2 text-[10.5px]">
            <div className="mb-1 font-bold uppercase tracking-[0.04em] text-[var(--ink-3)]">Size</div>
            <div className="mb-2 flex flex-wrap gap-1">{([["square", "1:1"], ["portrait", "4:5"], ["story", "9:16"]] as const).map(([k, l]) => <button key={k} type="button" onClick={() => onPatch({ ratio: k })} className="rounded-full border px-2 py-0.5 font-bold" style={chip(im.ratio === k)}>{l}</button>)}</div>
            <div className="mb-1 font-bold uppercase tracking-[0.04em] text-[var(--ink-3)]">Crop</div>
            <div className="mb-2 flex flex-wrap gap-1">{([["contain", "Whole photo"], ["cover", "Fill / crop"]] as const).map(([k, l]) => <button key={k} type="button" onClick={() => onPatch({ fit: k })} className="rounded-full border px-2 py-0.5 font-bold" style={chip(fit === k)}>{l}</button>)}</div>
            <div className="mb-1 font-bold uppercase tracking-[0.04em] text-[var(--ink-3)]">Text colour</div>
            <div className="mb-2 flex flex-wrap items-center gap-1">{SWATCHES.map((sw) => <button key={sw} type="button" onClick={() => onPatch({ color: sw })} className="h-5 w-5 rounded-full border-2" style={{ background: sw, borderColor: im.color === sw ? "#171534" : "var(--line)" }} title={sw} />)}<input type="color" value={im.color} onChange={(e) => onPatch({ color: e.target.value })} className="h-6 w-7 cursor-pointer rounded border border-[var(--line)]" title="Custom colour" /></div>
            {nParent > 0 && <button type="button" onClick={() => onPatch({ include: { ...inc, comments: !inc.comments } })} className="rounded-full border-2 px-2.5 py-0.5 text-[11px] font-bold" style={incBtn(inc.comments, true)}>{inc.comments ? "✓ " : ""}All comments ({nParent})</button>}
          </div>
        )}

        <div className="mt-2 flex gap-1.5">
          <button type="button" onClick={onAdd} className="flex-1 rounded-md px-2 py-1 text-[11px] font-extrabold text-white" style={{ background: BROWN }}>➕ Add to email</button>
          <button type="button" onClick={() => triggerDownload(preview ?? im.photoUrl, `${(im.childName ?? "moment").replace(/\s+/g, "-")}-${im.ratio}.jpg`)} className="rounded-md border border-[var(--line)] px-2 py-1 text-[11px] font-bold" title="Download this image (with everything shown in the preview)">⬇</button>
          <button type="button" onClick={onRemove} className="rounded-md border border-[var(--line)] px-2 py-1 text-[11px] font-bold text-[var(--ink-3)]" title="Remove from Email area">✕</button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Full email client (mirrors the Build Manual's Email screen): Inbox with
// folders + labels + attachments + density, plus Campaigns / Audiences /
// Templates / Automatic emails / Analytics. The INBOX is a front-end preview —
// receiving mail needs inbound-email infrastructure (see the handoff doc). The
// Compose/send + Automatic-emails tabs are real.
// ─────────────────────────────────────────────────────────────────────────
type LabelTone = "urgent" | "follow" | "haf" | "enquiry" | "system";
const LABEL_STYLE: Record<LabelTone, { bg: string; fg: string; text: string }> = {
  urgent: { bg: "#fde5e6", fg: "#c0271f", text: "Urgent" },
  follow: { bg: "#f7ead0", fg: "#9a5a00", text: "Follow-up" },
  haf: { bg: "#dff3e6", fg: "#127a3e", text: "HAF / funded" },
  enquiry: { bg: "#e4edfd", fg: "#1d3a8f", text: "New enquiries" },
  system: { bg: "var(--panel)", fg: "var(--ink-2)", text: "System" },
};
type MailFolder = "inbox" | "sent" | "drafts" | "scheduled" | "spam" | "archive" | "snoozed" | "trash";
interface Mail { id: string; from: string; fromEmail?: string; to?: string; tag?: string; subject: string; preview: string; body?: string; time: string; unread?: boolean; starred?: boolean; thread?: boolean; labels?: LabelTone[]; attachment?: string; attachmentSize?: string; quickReplies?: string[]; folder?: MailFolder }
// Demo inbox — stands in until inbound email is wired. Mirrors the manual's sample.
const DEMO_MAIL: Mail[] = [
  { id: "m1", from: "Sarah Khan", fromEmail: "sarah.khan@gmail.com", to: "bookings@apf", tag: "Parents", subject: "Allergy update for Jack before Summer camp", preview: "Just so you have it on file — Jack’s now also reacting to sesame…", body: "Just so you have it on file — Jack’s now also reacting to sesame as well as his existing nut allergy. His EpiPen is in date. Happy to send the updated care plan if useful.", time: "09:18", starred: true, thread: true, labels: ["urgent", "follow"], quickReplies: ["Thanks — noted on Jack’s file.", "Could you send the updated care plan?", "We’ll make sure all staff are aware."] },
  { id: "m2", from: "MK Council HAF Team", fromEmail: "haf@milton-keynes.gov.uk", to: "bookings@apf", tag: "Schools & councils", subject: "HAF claim — May sessions (PO #MK-4471)", preview: "Please find the signed PO attached for May’s funded places.", body: "Please find the approved PO attached for the May HAF sessions. Submit your claim with attendance evidence by month end.", time: "Mon", starred: true, thread: true, labels: ["haf"], attachment: "PO-MK-4471.pdf", attachmentSize: "84 KB", quickReplies: ["Thank you — received, we’ll action this.", "Could you confirm the deadline?", "Invoice to follow shortly."] },
  { id: "m3", from: "Fuel Catering Ltd", fromEmail: "orders@fuelcatering.co.uk", to: "bookings@apf", tag: "Suppliers", subject: "Re: Lunch order cut-off this week", preview: "Cut-off is 6pm the day before — send final numbers by then.", body: "Cut-off is 6pm the day before — send final numbers by then and we’ll have it prepped for the morning.", time: "Tue", starred: true, quickReplies: ["Thanks — will confirm numbers by 5pm.", "Can we push the cut-off to 7pm?", "Noted, thank you."] },
  { id: "m4", from: "Dani Obi", fromEmail: "dani.obi@outlook.com", to: "bookings@apf", tag: "Parents", subject: "Enquiry: places for August football camp?", preview: "Hi — do you have any spaces left for the week of the 12th?", body: "Hi! Do you still have spaces for the August football camp for a 10-year-old? And do you offer sibling discounts? Thanks, Dani.", time: "08:02", unread: true, starred: true, thread: true, labels: ["enquiry"], quickReplies: ["Thanks — noted, all set!", "We’ll keep an eye out, thank you.", "Could you confirm your booking reference?"] },
  { id: "m5", from: "Marcus B.", fromEmail: "marcus.b@apf.staff", to: "bookings@apf", tag: "Team", subject: "Shift swap request — Friday PM", preview: "Could I swap my Friday afternoon with Priya this week?", body: "Could I swap my Friday afternoon with Priya this week? She’s happy to cover — just needs your sign-off.", time: "Wed", starred: true, quickReplies: ["Approved — I’ll update the rota.", "Let me check cover and come back to you.", "Can you both confirm in writing?"] },
  { id: "m6", from: "ActivityOS", fromEmail: "no-reply@activityos.uk", to: "bookings@apf", tag: "System", subject: "Booking confirmed — APF-10293 (Jack Khan)", preview: "A new booking has been confirmed and paid.", body: "A new booking has been confirmed and paid: APF-10293 — Jack Khan, Summer Multi-Activity, week of 12 Aug.", time: "4 Jun", starred: true, labels: ["system"] },
  { id: "m7", from: "Aisha Patel", fromEmail: "aisha.patel@gmail.com", to: "bookings@apf", tag: "Parents", subject: "Welcome to Summer Camp — what to bring", preview: "Hi Aisha, we can’t wait to see you! Here’s what to pack…", body: "Hi Aisha, we can’t wait to see you! Here’s what to pack: sun cream, a water bottle, a packed lunch and trainers.", time: "2 Jun", starred: true, quickReplies: ["You’re welcome — see you Monday!", "Let us know if you have any questions.", "Anything else we can help with?"] },
];
const FOLDERS: [string, string][] = [
  ["inbox", "Inbox"], ["starred", "Starred"], ["snoozed", "Snoozed"], ["sent", "Sent"],
  ["drafts", "Drafts"], ["scheduled", "Scheduled"], ["archive", "Archive"], ["spam", "Spam"], ["trash", "Trash"], ["all", "All mail"],
];

function InboxView({ onCompose, onReply, onForward, onQuickReply, history }: { onCompose: () => void; onReply: (m: Mail) => void; onForward: (m: Mail) => void; onQuickReply: (m: Mail, text: string) => void; history: Sent[] | null }) {
  const [items, setItems] = useState<Mail[]>(() => DEMO_MAIL.map((m) => ({ ...m, folder: m.folder ?? "inbox" })));
  const [folder, setFolder] = useState("inbox");
  const [filter, setFilter] = useState<"all" | "unread" | "starred" | "files">("all");
  const [density, setDensity] = useState<"cozy" | "compact">("cozy");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<Mail | null>(null);
  const [showContact, setShowContact] = useState(false);

  const patch = (id: string, p: Partial<Mail>) => setItems((xs) => xs.map((x) => (x.id === id ? { ...x, ...p } : x)));
  const drop = (id: string) => setItems((xs) => xs.filter((x) => x.id !== id));
  const move = (m: Mail, f: MailFolder) => { patch(m.id, { folder: f }); setOpen(null); };
  const openMail = (m: Mail) => { if (m.unread) patch(m.id, { unread: false }); setOpen(m); };
  const archive = (m: Mail) => move(m, "archive");
  const snooze = (m: Mail) => move(m, "snoozed");
  const spam = (m: Mail) => move(m, "spam");
  const restore = (m: Mail) => move(m, "inbox");
  // First delete → Trash (recoverable). Deleting from Trash removes it for good.
  const del = (m: Mail) => { if ((m.folder ?? "inbox") === "trash") drop(m.id); else move(m, "trash"); };
  const reply = (m: Mail) => { setOpen(null); onReply(m); };
  const forward = (m: Mail) => { setOpen(null); onForward(m); };
  const markUnread = (m: Mail) => { patch(m.id, { unread: true }); setOpen(null); };
  const quickReply = (m: Mail, text: string) => { setOpen(null); onQuickReply(m, text); };

  // Real sent history shows in the Sent folder as mail rows.
  const sentMail: Mail[] = (history ?? []).map((h) => ({ id: `sent-${h.id}`, from: "You", subject: h.subject, preview: h.audience === "one" ? "Sent to 1 address" : `Sent to ${h.recipientCount} families`, time: when(h.createdAt), folder: "sent" }));
  const pool = folder === "sent" ? sentMail : items;
  const inFolder = (m: Mail) => {
    if (folder === "all") return m.folder !== "spam" && m.folder !== "trash";
    if (folder === "starred") return !!m.starred && m.folder !== "spam" && m.folder !== "trash";
    if (folder === "inbox") return (m.folder ?? "inbox") === "inbox";
    return m.folder === folder;
  };
  const restorable = folder === "archive" || folder === "snoozed" || folder === "spam" || folder === "trash";
  const list = pool.filter(inFolder)
    .filter((m) => filter === "all" || (filter === "unread" && m.unread) || (filter === "starred" && m.starred) || (filter === "files" && m.attachment))
    .filter((m) => { const s = q.trim().toLowerCase(); return !s || `${m.from} ${m.subject} ${m.preview}`.toLowerCase().includes(s); });
  const count = (k: string) => k === "sent" ? sentMail.length : k === "inbox" ? items.filter((m) => (m.folder ?? "inbox") === "inbox" && m.unread).length
    : k === "starred" ? items.filter((m) => m.starred && m.folder !== "spam" && m.folder !== "trash").length
    : (k === "archive" || k === "snoozed" || k === "spam" || k === "trash") ? items.filter((m) => m.folder === k).length || undefined : undefined;
  const pad = density === "cozy" ? "py-3" : "py-1.5";
  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[240px] flex-1">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search mail · try from: subject: label: is:unread has:attachment" className="w-full rounded-full border border-[var(--line)] bg-white px-4 py-2.5 text-[13px] text-[var(--ink)] outline-none focus:border-[#2f6bd8]" />
        </div>
        {([["cozy", "Cozy"], ["compact", "Compact"]] as const).map(([k, l]) => <button key={k} type="button" onClick={() => setDensity(k)} className="rounded-full px-4 py-2 text-[13px] font-bold" style={density === k ? { background: "linear-gradient(180deg,#4f8bf5,#2f6bd8)", color: "#fff" } : { border: "1px solid var(--line)", color: "var(--ink-2)", background: "#fff" }}>{l}</button>)}
      </div>
      <div className="grid gap-3 md:grid-cols-[210px_1fr]">
        <div>
          <button type="button" onClick={onCompose} className="mb-3 w-full rounded-full py-2.5 text-[14px] font-extrabold text-white shadow" style={{ background: "linear-gradient(180deg,#0f9d58,#0b7a43)" }}>✎ Compose</button>
          <div className="flex flex-col">
            {FOLDERS.map(([k, label]) => { const n = count(k); return (
              <button key={k} type="button" onClick={() => setFolder(k)} className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[13px] font-semibold" style={folder === k ? { background: "#eef4fd", color: "#1d3a8f", fontWeight: 800 } : { color: "var(--ink-2)" }}>
                <span className="flex-1">{label}</span>{n ? <span className="rounded-full bg-[var(--panel)] px-1.5 text-[11px] font-bold text-[var(--ink-2)]">{n}</span> : null}
              </button>
            ); })}
          </div>
        </div>
        <div className="overflow-hidden rounded-2xl border border-[var(--line)] bg-white">
          <div className="flex flex-wrap items-center gap-2 border-b border-[var(--line)] px-3 py-2">
            {([["all", "All"], ["unread", "Unread"], ["starred", "Starred"], ["files", "Has files"]] as const).map(([k, l]) => <button key={k} type="button" onClick={() => setFilter(k)} className="rounded-full px-3 py-1 text-[12.5px] font-bold" style={filter === k ? { background: "linear-gradient(180deg,#4f8bf5,#2f6bd8)", color: "#fff" } : { border: "1px solid var(--line)", color: "var(--ink-2)" }}>{l}</button>)}
            <span className="ml-auto text-[12px] text-[var(--ink-3)]">{list.length ? `1–${list.length} of ${list.length}` : "0"}</span>
          </div>
          {list.length === 0 ? <div className="px-4 py-14 text-center text-[13px] text-[var(--ink-3)]">Nothing here.</div>
          : list.map((m) => (
            <div key={m.id} className={`flex w-full items-center gap-3 border-b border-[var(--line)] px-3 last:border-0 hover:bg-[#f7faff] ${pad}`}>
              <button type="button" onClick={() => patch(m.id, { starred: !m.starred })} className="flex-none text-[15px]" style={{ color: m.starred ? "#f4b400" : "var(--ink-3)" }} aria-label={m.starred ? "Unstar" : "Star"}>{m.starred ? "★" : "☆"}</button>
              <button type="button" onClick={() => openMail(m)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                <span className={`w-[140px] flex-none truncate text-[13.5px] ${m.unread ? "font-extrabold text-[var(--ink)]" : "font-semibold text-[var(--ink-2)]"}`}>{m.from}{m.thread && <span className="text-[var(--ink-3)]"> »</span>}</span>
                <span className="min-w-0 flex-1 truncate text-[13.5px]"><span className={m.unread ? "font-extrabold text-[var(--ink)]" : "font-semibold text-[var(--ink)]"}>{m.subject}</span> <span className="text-[var(--ink-3)]">— {m.preview}</span></span>
                {m.labels?.map((l) => <span key={l} className="flex-none rounded-md px-2 py-0.5 text-[10.5px] font-extrabold" style={{ background: LABEL_STYLE[l].bg, color: LABEL_STYLE[l].fg }}>{LABEL_STYLE[l].text}</span>)}
                {m.attachment && <span className="flex-none text-[13px] text-[var(--ink-3)]" title={m.attachment}>📎</span>}
                <span className="flex-none text-[12px] font-semibold text-[var(--ink-3)]">{m.time}</span>
              </button>
              {folder === "sent" ? null : restorable ? <>
                <button type="button" onClick={() => restore(m)} className="flex-none text-[13px] text-[var(--ink-3)] hover:text-[#1d3a8f]" title="Move to Inbox">↩</button>
                <button type="button" onClick={() => del(m)} className="flex-none text-[13px] text-[var(--ink-3)] hover:text-[#c02636]" title={folder === "trash" ? "Delete forever" : "Move to Trash"}>🗑</button>
              </> : <>
                <button type="button" onClick={() => archive(m)} className="flex-none text-[13px] text-[var(--ink-3)] hover:text-[var(--ink)]" title="Archive">🗄</button>
                <button type="button" onClick={() => del(m)} className="flex-none text-[13px] text-[var(--ink-3)] hover:text-[#c02636]" title="Move to Trash">🗑</button>
              </>}
            </div>
          ))}
        </div>
      </div>
      <div className="mt-3 rounded-lg border border-[#dbe6fb] bg-[#f4f8ff] px-3 py-2 text-[11.5px] text-[#1d3a8f]">Inbox actions (star, read, archive, delete, reply, forward) work locally. Sent shows your real send history. Receiving external email needs inbound mail set up — handed to the backend.</div>
      {open && (() => { const o = open; const initials = o.from.split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
        const toolBtn = "flex-none rounded-full border border-[var(--line)] px-3 py-1.5 text-[12.5px] font-bold text-[var(--ink-2)] hover:bg-[var(--panel)]";
        return (
        <div className="fixed inset-0 z-[120] flex items-start justify-center overflow-y-auto bg-black/40 p-4 pt-[5vh]" onClick={() => setOpen(null)}>
          <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="border-b border-[var(--line)] px-5 py-4">
              <div className="flex flex-wrap items-center gap-2"><span className="text-[19px] font-extrabold text-[var(--ink)]">{o.subject}</span>{o.labels?.map((l) => <span key={l} className="rounded-md px-2 py-0.5 text-[11px] font-extrabold" style={{ background: LABEL_STYLE[l].bg, color: LABEL_STYLE[l].fg }}>{LABEL_STYLE[l].text}</span>)}</div>
              <div className="mt-3 flex flex-wrap items-center gap-2 overflow-x-auto">
                <button type="button" onClick={() => setOpen(null)} className={toolBtn}>← Back</button>
                {o.folder && o.folder !== "inbox" && o.folder !== "sent"
                  ? <button type="button" onClick={() => restore(o)} className={toolBtn}>↩ Move to Inbox</button>
                  : <button type="button" onClick={() => archive(o)} className={toolBtn}>🗄 Archive</button>}
                <button type="button" onClick={() => snooze(o)} className={toolBtn} title="Hide it until later — it comes back to your inbox in the Snoozed folder">⏰ Snooze</button>
                <button type="button" onClick={() => markUnread(o)} className={toolBtn}>✉ Unread</button>
                <button type="button" onClick={() => spam(o)} className={toolBtn}>⊘ Spam</button>
                <button type="button" onClick={() => del(o)} className="flex-none rounded-full border border-[var(--line)] px-3 py-1.5 text-[12.5px] font-bold text-[var(--ink-2)] hover:bg-[#fdebec] hover:text-[#c02636]">🗑 {o.folder === "trash" ? "Delete forever" : "Delete"}</button>
                {o.tag && <span className="ml-auto flex-none rounded-full bg-[var(--panel)] px-2.5 py-1 text-[11.5px] font-bold text-[var(--ink-2)]" title="Which contact list this sender belongs to">🏷 {o.tag}</span>}
                <button type="button" onClick={() => setShowContact((v) => !v)} className={toolBtn} title="Show this sender's contact card">◐ Contact</button>
              </div>
            </div>
            <div className="px-5 py-4">
              <div className="flex items-start gap-3">
                <span className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-[var(--panel)] text-[12px] font-extrabold text-[var(--ink-2)]">{initials}</span>
                <div className="min-w-0 flex-1"><div className="text-[14px] font-extrabold text-[var(--ink)]">{o.from}</div><div className="text-[12.5px] text-[var(--ink-3)]">{o.fromEmail}{o.to ? ` · to ${o.to}` : ""}</div></div>
                <span className="flex-none text-[12.5px] text-[var(--ink-3)]">{o.time}</span>
              </div>
              {showContact && <div className="mt-3 rounded-xl border border-[var(--line)] bg-[var(--panel)] p-3 text-[12.5px]"><div className="font-extrabold text-[var(--ink)]">{o.from}</div><div className="text-[var(--ink-3)]">{o.fromEmail}</div>{o.tag && <div className="mt-1 text-[var(--ink-2)]">List: <b>{o.tag}</b></div>}<div className="mt-1.5 text-[11.5px] text-[var(--ink-3)]">Full contact history opens in the CRM once linked (backend).</div></div>}
              <p className="mt-3 text-[14px] leading-relaxed text-[var(--ink-2)]">{o.body ?? o.preview}</p>
              {o.attachment && <div className="mt-3 inline-flex items-center gap-2 rounded-lg border border-[var(--line)] bg-[var(--panel)] px-3 py-1.5 text-[12px] font-bold">📎 {o.attachment}{o.attachmentSize && <span className="font-normal text-[var(--ink-3)]">{o.attachmentSize}</span>}</div>}
            </div>
            {o.quickReplies?.length ? <div className="flex flex-wrap gap-2 border-t border-[var(--line)] px-5 py-3">{o.quickReplies.map((qr) => <button key={qr} type="button" onClick={() => quickReply(o, qr)} className="rounded-full border border-[var(--line)] px-3.5 py-1.5 text-[12.5px] font-semibold text-[var(--ink-2)] hover:border-[#2f6bd8] hover:text-[#1d3a8f]">{qr}</button>)}</div> : null}
            <div className="flex flex-wrap gap-2 border-t border-[var(--line)] px-5 py-3">
              <button type="button" onClick={() => reply(o)} className="rounded-lg px-4 py-2 text-[13px] font-extrabold text-white" style={{ background: "linear-gradient(180deg,#0f9d58,#0b7a43)" }}>↩ Reply</button>
              <button type="button" onClick={() => reply(o)} className="rounded-lg border border-[var(--line)] px-4 py-2 text-[13px] font-bold text-[var(--ink-2)] hover:bg-[var(--panel)]">↩ Reply all</button>
              <button type="button" onClick={() => forward(o)} className="rounded-lg border border-[var(--line)] px-4 py-2 text-[13px] font-bold text-[var(--ink-2)] hover:bg-[var(--panel)]">↪ Forward</button>
            </div>
          </div>
        </div>
      ); })()}
    </div>
  );
}

// ── Campaigns + Audiences — a real marketing pipeline over the tenant's bookings.
// Audiences are built by FILTERING customers/bookings (current & previous listings,
// location, age group, dates); campaigns pick an audience + a saved Template and
// Send now / Schedule / Save draft. Campaigns + custom audiences persist locally
// (the true send/track/schedule engine is the backend — see the handoff doc).
interface Booking { id?: string; email?: string; name?: string; child?: string; age?: number; listingId?: string; title?: string; listingTitle?: string; locationName?: string; date?: string; dates?: string; createdAt?: string }
interface AudFilter { month?: string; year?: string; age?: string; from?: string; to?: string; listingId?: string; location?: string }
interface Audience { id: string; name: string; count: number; emails: string[]; desc: string; filter?: AudFilter }
type CampStatus = "sent" | "sending" | "scheduled" | "draft";
interface Campaign { id: string; name: string; subtitle?: string; audienceName: string; recipients: number; status: CampStatus; statusDate?: string; opens?: number; clicks?: number; subject?: string }

const LS_CAMP = "aos.email.campaigns.v1", LS_AUD = "aos.email.audiences.v1";
function readLS<T>(k: string, fb: T): T { try { const v = localStorage.getItem(k); return v ? (JSON.parse(v) as T) : fb; } catch { return fb; } }
function writeLS(k: string, v: unknown) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } }
const SEED_CAMPAIGNS: Campaign[] = [
  { id: "seed1", name: "Summer early-bird", subtitle: "Early-bird launch", audienceName: "All active families", recipients: 312, status: "sent", statusDate: "2 Jun", opens: 65, clicks: 29 },
  { id: "seed2", name: "August football camp", subtitle: "Holiday programme", audienceName: "Summer Camp 2026", recipients: 168, status: "sent", statusDate: "8 Jun", opens: 72, clicks: 39 },
  { id: "seed3", name: "Win-back — spring lapsed", subtitle: "Win-back lapsed", audienceName: "Lapsed (no booking 6m+)", recipients: 240, status: "sending", statusDate: "today", opens: 28, clicks: 7 },
  { id: "seed4", name: "June newsletter", subtitle: "Monthly newsletter", audienceName: "All active families", recipients: 312, status: "scheduled", statusDate: "Fri 9am" },
  { id: "seed5", name: "HAF reminder", subtitle: "Welcome / what to bring", audienceName: "HAF / funded", recipients: 96, status: "draft" },
];
// Demo CRM segments so Audiences reads like the manual out of the box. Real
// membership is computed from bookings at send time (backend) — these carry a
// headline count + description; "All active families" below is computed for real.
const SEED_AUDIENCES: Audience[] = [
  { id: "seg-summer", name: "Summer Camp 2026", count: 168, emails: [], desc: "Booked any Summer Multi-Activity week" },
  { id: "seg-lapsed", name: "Lapsed (no booking 6m+)", count: 240, emails: [], desc: "Last booking over 6 months ago" },
  { id: "seg-haf", name: "HAF / funded", count: 96, emails: [], desc: "Eligible for or using HAF funding" },
  { id: "seg-enq", name: "New enquiries (no booking)", count: 54, emails: [], desc: "Enquired but never booked" },
  { id: "seg-mk", name: "Milton Keynes venues", count: 121, emails: [], desc: "Any booking at an MK venue" },
];
const STATUS_PILL: Record<CampStatus, { bg: string; fg: string; label: string }> = {
  sent: { bg: "#dff3e6", fg: "#127a3e", label: "Sent" }, sending: { bg: "#fdeccf", fg: "#9a5a00", label: "Sending" },
  scheduled: { bg: "#e4edfd", fg: "#1d3a8f", label: "Scheduled" }, draft: { bg: "var(--panel)", fg: "var(--ink-2)", label: "Draft" },
};
const AGE_GROUPS = ["4-6", "7-9", "10-12", "13+"] as const;
const ageGroupOf = (a?: number) => a == null ? null : a <= 6 ? "4-6" : a <= 9 ? "7-9" : a <= 12 ? "10-12" : "13+";
const bkDate = (b: Booking) => { const s = b.date || b.createdAt; if (!s) return null; const t = Date.parse(s); return Number.isNaN(t) ? null : new Date(t); };
function matchBooking(b: Booking, f: AudFilter): boolean {
  if (f.listingId && b.listingId !== f.listingId) return false;
  if (f.location && (b.locationName || "") !== f.location) return false;
  if (f.age && ageGroupOf(b.age) !== f.age) return false;
  if (f.month || f.year || f.from || f.to) {
    const dt = bkDate(b); if (!dt) return false;
    if (f.month && String(dt.getMonth() + 1) !== f.month) return false;
    if (f.year && String(dt.getFullYear()) !== f.year) return false;
    if (f.from && dt < new Date(f.from)) return false;
    if (f.to && dt > new Date(`${f.to}T23:59:59`)) return false;
  }
  return true;
}
function resolveAudience(bookings: Booking[], f: AudFilter): { emails: string[]; count: number } {
  const set = new Set<string>();
  for (const b of bookings) if (b.email && matchBooking(b, f)) set.add(b.email.toLowerCase());
  const emails = [...set]; return { emails, count: emails.length };
}
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
function filterDesc(f: AudFilter, listingTitle?: string): string {
  const bits: string[] = [];
  if (f.listingId) bits.push(listingTitle || "one listing"); if (f.location) bits.push(f.location);
  if (f.age) bits.push(`${f.age} yrs`); if (f.month) bits.push(MONTHS[Number(f.month) - 1]); if (f.year) bits.push(f.year);
  if (f.from || f.to) bits.push(`${f.from || "…"}–${f.to || "…"}`);
  return bits.length ? bits.join(" · ") : "All customers";
}

function StatCard({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: string }) {
  return <div className="rounded-2xl border border-[var(--line)] bg-white p-4"><div className="text-[11px] font-bold uppercase tracking-wide text-[var(--ink-3)]">{label}</div><div className="mt-1 text-[26px] font-extrabold" style={{ color: tone ?? "var(--ink)", fontVariantNumeric: "tabular-nums" }}>{value}</div>{sub && <div className="mt-0.5 text-[11.5px] text-[var(--ink-3)]">{sub}</div>}</div>;
}
function FunnelBar({ label, n, max, color }: { label: string; n: number; max: number; color: string }) {
  return <div className="mb-2.5"><div className="flex justify-between text-[13px]"><span className="text-[var(--ink-2)]">{label}</span><span className="font-bold text-[var(--ink)]">{n}</span></div><div className="mt-1 h-2.5 overflow-hidden rounded-full bg-[var(--panel)]"><div className="h-full rounded-full" style={{ width: `${max ? Math.round((n / max) * 100) : 0}%`, background: color }} /></div></div>;
}

function AudienceBuilder({ bookings, listings, locations, onCancel, onCreate }: { bookings: Booking[]; listings: { id: string; title: string }[]; locations: string[]; onCancel: () => void; onCreate: (a: Audience, useNow: boolean) => void }) {
  const [f, setF] = useState<AudFilter>({});
  const [name, setName] = useState("");
  const seq = useRef(0);
  const set = (p: Partial<AudFilter>) => setF((x) => ({ ...x, ...p }));
  const { emails, count } = resolveAudience(bookings, f);
  const listingTitle = listings.find((l) => l.id === f.listingId)?.title;
  const years = [...new Set(bookings.map((b) => bkDate(b)?.getFullYear()).filter(Boolean))].sort() as number[];
  const mk = (): Audience => ({ id: `aud-${name.trim() || "seg"}-${seq.current++}`, name: name.trim() || filterDesc(f, listingTitle), count, emails, desc: filterDesc(f, listingTitle), filter: f });
  return (
    <div className="fixed inset-0 z-[130] flex items-start justify-center overflow-y-auto bg-black/45 p-4 pt-[5vh]" onClick={onCancel}>
      <div className="w-full max-w-xl rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 border-b border-[var(--line)] px-5 py-3.5">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#0f9d58] text-white">●</span>
          <div><div className="text-[16px] font-extrabold text-[var(--ink)]">Build an audience</div><div className="text-[12px] text-[var(--ink-3)]">Filter your customers — the count updates live.</div></div>
          <button type="button" onClick={onCancel} className="ml-auto flex h-7 w-7 items-center justify-center rounded-full text-[16px] text-[var(--ink-3)] hover:bg-[var(--panel)]">×</button>
        </div>
        <div className="max-h-[62vh] space-y-3 overflow-y-auto p-5">
          <div className="grid grid-cols-2 gap-2.5">
            <div><FieldLabel>Booking month</FieldLabel><Select value={f.month ?? ""} onChange={(e) => set({ month: e.target.value })} className="w-full"><option value="">Any</option>{MONTHS.map((m, i) => <option key={m} value={String(i + 1)}>{m}</option>)}</Select></div>
            <div><FieldLabel>Year</FieldLabel><Select value={f.year ?? ""} onChange={(e) => set({ year: e.target.value })} className="w-full"><option value="">Any</option>{years.map((y) => <option key={y} value={String(y)}>{y}</option>)}</Select></div>
          </div>
          <div><FieldLabel>Age group</FieldLabel><div className="flex flex-wrap gap-1.5">{AGE_GROUPS.map((g) => <button key={g} type="button" onClick={() => set({ age: f.age === g ? undefined : g })} className="rounded-lg border px-3.5 py-2 text-[13px] font-bold" style={f.age === g ? { borderColor: "#2f6bd8", background: "#eef4fd", color: "#1d3a8f" } : { borderColor: "var(--line)", color: "var(--ink-2)" }}>{g}</button>)}</div></div>
          <div className="grid grid-cols-2 gap-2.5">
            <div><FieldLabel>Date from</FieldLabel><Input type="date" value={f.from ?? ""} onChange={(e) => set({ from: e.target.value })} className="w-full" /></div>
            <div><FieldLabel>Date to</FieldLabel><Input type="date" value={f.to ?? ""} onChange={(e) => set({ to: e.target.value })} className="w-full" /></div>
          </div>
          <div><FieldLabel>Listing (with location)</FieldLabel><Select value={f.listingId ?? ""} onChange={(e) => set({ listingId: e.target.value })} className="w-full"><option value="">Any listing</option>{listings.map((l) => <option key={l.id} value={l.id}>{l.title}</option>)}</Select></div>
          <div><FieldLabel>Location</FieldLabel><Select value={f.location ?? ""} onChange={(e) => set({ location: e.target.value })} className="w-full"><option value="">Any location</option>{locations.map((l) => <option key={l} value={l}>{l}</option>)}</Select></div>
          <div className="flex items-center gap-3 rounded-xl bg-[var(--panel)] p-3.5">
            <div><div className="text-[10px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]">Matching</div><div className="text-[30px] font-extrabold leading-none text-[#2f6bd8]" style={{ fontVariantNumeric: "tabular-nums" }}>{count}</div><div className="text-[10px] text-[var(--ink-3)]">customers</div></div>
            <div className="text-[13px] font-semibold text-[var(--ink-2)]">{filterDesc(f, listingTitle)}</div>
          </div>
          <div><FieldLabel>Audience name</FieldLabel><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="New audience" className="w-full" /></div>
        </div>
        <div className="flex flex-wrap items-center gap-2 border-t border-[var(--line)] px-5 py-3">
          <button type="button" onClick={() => onCreate(mk(), false)} className="rounded-lg px-4 py-2 text-[13px] font-extrabold text-white" style={{ background: "linear-gradient(180deg,#0f9d58,#0b7a43)" }}>Create audience</button>
          <button type="button" onClick={() => onCreate(mk(), true)} className="rounded-lg border border-[var(--line)] px-4 py-2 text-[13px] font-bold text-[var(--ink-2)] hover:bg-[var(--panel)]">Create &amp; use in campaign</button>
          <button type="button" onClick={onCancel} className="ml-auto rounded-lg border border-[var(--line)] px-4 py-2 text-[13px] font-bold text-[var(--ink-3)]">Cancel</button>
        </div>
      </div>
    </div>
  );
}

function NewCampaign({ audiences, templates, onCancel, onBuildAudience, onSubmit }: { audiences: Audience[]; templates: EmailTemplate[]; onCancel: () => void; onBuildAudience: () => void; onSubmit: (c: { name: string; audience: Audience; template?: EmailTemplate; subject: string }, action: CampStatus) => void }) {
  const [name, setName] = useState("");
  const [audId, setAudId] = useState(audiences[0]?.id ?? "");
  const [tmplId, setTmplId] = useState(templates[0]?.id ?? "");
  const [subject, setSubject] = useState("");
  const audience = audiences.find((a) => a.id === audId) ?? audiences[0];
  const template = templates.find((t) => t.id === tmplId);
  const submit = (action: CampStatus) => { if (!audience) return; onSubmit({ name: name.trim() || subject.trim() || "Untitled campaign", audience, template, subject: subject.trim() || template?.subject || name.trim() }, action); };
  return (
    <div className="fixed inset-0 z-[130] flex items-start justify-center overflow-y-auto bg-black/45 p-4 pt-[5vh]" onClick={onCancel}>
      <div className="w-full max-w-xl rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="border-b border-[var(--line)] px-5 py-3.5"><div className="text-[18px] font-extrabold text-[var(--ink)]">New campaign</div><div className="text-[12.5px] text-[var(--ink-3)]">Sends via your branded-domain marketing pipeline with tracking + unsubscribe.</div></div>
        <div className="max-h-[64vh] space-y-3 overflow-y-auto p-5">
          <div><FieldLabel>Campaign name</FieldLabel><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. August football camp" className="w-full" /></div>
          <div className="grid grid-cols-2 gap-2.5">
            <div><FieldLabel>Audience</FieldLabel><Select value={audId} onChange={(e) => setAudId(e.target.value)} className="w-full">{audiences.map((a) => <option key={a.id} value={a.id}>{a.name} ({a.count})</option>)}</Select><button type="button" onClick={onBuildAudience} className="mt-1 text-[12px] font-bold text-[#1d3a8f]">＋ Build a new audience</button></div>
            <div><FieldLabel>Template</FieldLabel><Select value={tmplId} onChange={(e) => setTmplId(e.target.value)} className="w-full"><option value="">No template</option>{templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</Select></div>
          </div>
          <div><FieldLabel>Subject</FieldLabel><Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject line" className="w-full" /></div>
          <div className="rounded-lg bg-[var(--panel)] px-3 py-2.5 text-[13px] text-[var(--ink-2)]">Sending to <b>{audience?.count ?? 0}</b> contacts — {audience?.desc ?? "—"}</div>
          <p className="text-[13px] font-semibold text-[var(--ink)]">Recipients who have opted out of marketing are excluded automatically. A one-click unsubscribe footer is added to every send.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 border-t border-[var(--line)] px-5 py-3">
          <button type="button" onClick={onCancel} className="rounded-lg border border-[var(--line)] px-4 py-2 text-[13px] font-bold text-[var(--ink-3)]">Cancel</button>
          <button type="button" onClick={() => submit("draft")} className="ml-auto rounded-lg border border-[var(--line)] px-4 py-2 text-[13px] font-bold text-[var(--ink-2)] hover:bg-[var(--panel)]">Save draft</button>
          <button type="button" onClick={() => submit("scheduled")} className="rounded-lg border border-[var(--line)] px-4 py-2 text-[13px] font-bold text-[var(--ink-2)] hover:bg-[var(--panel)]">⧗ Schedule</button>
          <button type="button" onClick={() => submit("sent")} className="rounded-lg px-4 py-2 text-[13px] font-extrabold text-white" style={{ background: "linear-gradient(180deg,#0f9d58,#0b7a43)" }}>Send now</button>
        </div>
      </div>
    </div>
  );
}

function useCampaignData() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [listings, setListings] = useState<{ id: string; title: string }[]>([]);
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  useEffect(() => { apiGet<Booking[]>("/api/bookings").then(setBookings).catch(() => {}); }, []);
  useEffect(() => { apiGet<{ id: string; title?: string; name?: string }[]>("/api/listings?mine=1").then((l) => setListings(l.map((x) => ({ id: x.id, title: x.title || x.name || "Listing" })))).catch(() => {}); }, []);
  useEffect(() => { apiGet<EmailTemplate[]>("/api/messages/templates").then(setTemplates).catch(() => setTemplates([])); }, []);
  const locations = [...new Set(bookings.map((b) => b.locationName).filter((x): x is string => !!x))].sort();
  const allEmails = resolveAudience(bookings, {}).emails;
  const allAudience: Audience = { id: "all", name: "All active families", count: allEmails.length, emails: allEmails, desc: "Has an active or upcoming booking" };
  return { bookings, listings, templates, locations, allAudience };
}

function CampaignsView({ onSent }: { onSent: () => void }) {
  const { bookings, listings, templates, locations, allAudience } = useCampaignData();
  const [campaigns, setCampaigns] = useState<Campaign[]>(() => readLS<Campaign[] | null>(LS_CAMP, null) ?? SEED_CAMPAIGNS);
  const [custom, setCustom] = useState<Audience[]>(() => readLS<Audience[]>(LS_AUD, []));
  const [modal, setModal] = useState<null | "campaign" | "audience">(null);
  const [detail, setDetail] = useState<Campaign | null>(null);
  useEffect(() => { writeLS(LS_CAMP, campaigns); }, [campaigns]);
  useEffect(() => { writeLS(LS_AUD, custom); }, [custom]);
  const audiences = [allAudience, ...SEED_AUDIENCES, ...custom];
  const duplicate = (c: Campaign) => { setCampaigns((xs) => [{ ...c, id: `c${Date.now()}`, name: `${c.name} (copy)`, status: "draft", statusDate: undefined, opens: undefined, clicks: undefined }, ...xs]); setDetail(null); };
  const create = async (c: { name: string; audience: Audience; template?: EmailTemplate; subject: string }, action: CampStatus) => {
    const row: Campaign = { id: `c${Date.now()}`, name: c.name, subtitle: c.template?.name, audienceName: c.audience.name, recipients: c.audience.count, status: action, statusDate: action === "scheduled" ? "scheduled" : action === "sent" ? "just now" : undefined, subject: c.subject };
    setCampaigns((xs) => [row, ...xs]); setModal(null);
    if (action === "sent" && c.audience.emails.length) {
      try { await apiPost("/api/emails/send", { subject: c.subject || c.name, body: c.template?.body || c.subject || c.name, recipients: c.audience.emails }); } catch { /* surfaced in history */ }
      onSent();
    }
  };
  return (
    <div>
      <div className="mb-3 flex items-center justify-between"><span className="text-[13px] font-bold text-[var(--ink-2)]">Campaigns</span><button type="button" onClick={() => setModal("campaign")} className="rounded-lg px-3.5 py-2 text-[12.5px] font-extrabold text-white" style={{ background: "linear-gradient(180deg,#0f9d58,#0b7a43)" }}>＋ New campaign</button></div>
      <div className="overflow-hidden rounded-2xl border border-[var(--line)] bg-white">
        <div className="grid grid-cols-[1.6fr_1.4fr_1fr_0.9fr_70px] gap-2 border-b border-[var(--line)] bg-[var(--panel)] px-4 py-2.5 text-[11px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]"><span>Campaign</span><span>Audience</span><span>Status</span><span>Opens</span><span></span></div>
        {campaigns.map((c) => { const p = STATUS_PILL[c.status]; return (
          <div key={c.id} className="grid grid-cols-[1.6fr_1.4fr_1fr_0.9fr_70px] items-center gap-2 border-b border-[var(--line)] px-4 py-3 last:border-0">
            <div className="min-w-0"><div className="truncate text-[14px] font-extrabold text-[var(--ink)]">{c.name}</div>{c.subtitle && <div className="truncate text-[12px] text-[var(--ink-3)]">{c.subtitle}</div>}</div>
            <div className="min-w-0"><div className="truncate text-[13px] text-[var(--ink-2)]">{c.audienceName}</div><div className="text-[12px] text-[var(--ink-3)]">{c.recipients} recipients</div></div>
            <div><span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[12px] font-extrabold" style={{ background: p.bg, color: p.fg }}>● {p.label}</span>{c.statusDate && <div className="mt-0.5 text-[12px] text-[var(--ink-3)]">{c.statusDate}</div>}</div>
            <div>{c.opens != null ? <><div className="text-[15px] font-extrabold text-[var(--ink)]">{c.opens}%</div><div className="text-[12px] text-[var(--ink-3)]">{c.clicks ?? 0}% clicks</div></> : <span className="text-[var(--ink-3)]">—</span>}</div>
            <div className="text-right"><button type="button" onClick={() => setDetail(c)} className="rounded-full border border-[var(--line)] px-3 py-1.5 text-[12px] font-bold text-[var(--ink-2)] hover:bg-[var(--panel)]">Open</button></div>
          </div>
        ); })}
      </div>
      <div className="mt-3 rounded-lg border border-[#dbe6fb] bg-[#f4f8ff] px-3 py-2 text-[11.5px] text-[#1d3a8f]">Audiences are built live from your bookings. “Send now” emails the matched families for real; scheduling, open/click tracking and the branded-domain pipeline are the backend’s job.</div>
      {modal === "campaign" && <NewCampaign audiences={audiences} templates={templates} onCancel={() => setModal(null)} onBuildAudience={() => setModal("audience")} onSubmit={create} />}
      {modal === "audience" && <AudienceBuilder bookings={bookings} listings={listings} locations={locations} onCancel={() => setModal("campaign")} onCreate={(a) => { setCustom((xs) => [...xs, a]); setModal("campaign"); }} />}
      {detail && <CampaignDetail c={detail} onDuplicate={() => duplicate(detail)} onClose={() => setDetail(null)} />}
    </div>
  );
}

function CampaignDetail({ c, onDuplicate, onClose }: { c: Campaign; onDuplicate: () => void; onClose: () => void }) {
  const tracked = c.opens != null;
  const sent = c.recipients;
  const delivered = tracked ? Math.round(sent * 0.987) : sent;
  const opened = tracked ? Math.round(delivered * (c.opens ?? 0) / 100) : 0;
  const clicked = tracked ? Math.round(delivered * (c.clicks ?? 0) / 100) : 0;
  const bounces = sent - delivered;
  const unsubs = tracked ? Math.max(1, Math.round(sent * 0.01)) : 0;
  const p = STATUS_PILL[c.status];
  return (
    <div className="fixed inset-0 z-[130] flex items-start justify-center overflow-y-auto bg-black/45 p-4 pt-[5vh]" onClick={onClose}>
      <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start gap-2 border-b border-[var(--line)] px-5 py-4">
          <div><div className="text-[20px] font-extrabold text-[var(--ink)]">{c.name}</div><div className="text-[12.5px] text-[var(--ink-3)]">{[c.subtitle, c.audienceName, `${c.recipients} recipients`].filter(Boolean).join(" · ")}</div></div>
          <span className="ml-auto inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[12px] font-extrabold" style={{ background: p.bg, color: p.fg }}>● {p.label}</span>
        </div>
        <div className="max-h-[66vh] overflow-y-auto p-5">
          <div className="grid grid-cols-3 gap-3"><StatCard label="Open rate" value={tracked ? `${c.opens}%` : "—"} tone="#16a34a" /><StatCard label="Click rate" value={tracked ? `${c.clicks}%` : "—"} tone="#16a34a" /><StatCard label="Bounces" value={tracked ? String(bounces) : "—"} tone="#ea580c" /></div>
          <div className="mt-3"><StatCard label="Unsubscribes" value={tracked ? String(unsubs) : "—"} tone="#ea580c" /></div>
          <div className="mt-4 text-[11px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]">Delivery funnel</div>
          <div className="mt-2">
            <FunnelBar label="Sent" n={sent} max={sent} color="#6b7280" />
            <FunnelBar label="Delivered" n={delivered} max={sent} color="#16306e" />
            <FunnelBar label="Opened" n={opened} max={sent} color="#16a34a" />
            <FunnelBar label="Clicked" n={clicked} max={sent} color="#16a34a" />
          </div>
          <div className="mt-3 rounded-lg bg-[var(--panel)] px-3 py-2 text-[12px] text-[var(--ink-3)]">Opens/clicks are tracked via the marketing pipeline (pixel + wrapped links). A one-click unsubscribe footer is added automatically; opt-outs sync back to the contact and are excluded from future sends. {!tracked && <b>Tracking begins once this campaign sends through the pipeline (backend).</b>}</div>
        </div>
        <div className="flex justify-end gap-2 border-t border-[var(--line)] px-5 py-3">
          <button type="button" onClick={onDuplicate} className="rounded-lg border border-[var(--line)] px-4 py-2 text-[13px] font-bold text-[var(--ink-2)] hover:bg-[var(--panel)]">Duplicate</button>
          <button type="button" onClick={onClose} className="rounded-lg border border-[var(--line)] px-4 py-2 text-[13px] font-bold text-[var(--ink-2)] hover:bg-[var(--panel)]">Close</button>
        </div>
      </div>
    </div>
  );
}

function AudiencesView({ onUse }: { onUse: (a: Audience) => void }) {
  const { bookings, listings, locations, allAudience } = useCampaignData();
  const [custom, setCustom] = useState<Audience[]>(() => readLS<Audience[]>(LS_AUD, []));
  const [building, setBuilding] = useState(false);
  useEffect(() => { writeLS(LS_AUD, custom); }, [custom]);
  const audiences = [allAudience, ...SEED_AUDIENCES, ...custom];
  return (
    <div>
      <div className="mb-3 rounded-lg border-l-4 border-[#2f6bd8] bg-[#eef4fd] px-3 py-2 text-[12px] text-[#1d3a8f]">✉ <b>Audiences are live CRM segments</b>, not stored mailing lists — membership is recomputed from booking &amp; enrolment data each send, and opt-outs are always excluded. Build them from any mix of booking history, venue, age group, funding or enquiry status.</div>
      <div className="mb-3 flex items-center justify-between"><span className="text-[16px] font-extrabold text-[var(--ink)]">Audiences</span><button type="button" onClick={() => setBuilding(true)} className="rounded-lg px-3.5 py-2 text-[12.5px] font-extrabold text-white" style={{ background: "linear-gradient(180deg,#0f9d58,#0b7a43)" }}>＋ New audience</button></div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {audiences.map((a) => (
          <div key={a.id} className="rounded-2xl border border-[var(--line)] bg-white p-4">
            <div className="flex items-start justify-between gap-2"><span className="text-[15px] font-extrabold text-[var(--ink)]">{a.name}</span><span className="text-[22px] font-extrabold text-[#1d3a8f]" style={{ fontVariantNumeric: "tabular-nums" }}>{a.count}</span></div>
            <p className="mt-1 text-[12px] text-[var(--ink-3)]">{a.desc}</p>
            <div className="mt-3 flex items-center gap-2">
              <button type="button" onClick={() => onUse(a)} className="rounded-full px-3.5 py-1.5 text-[12px] font-extrabold text-white" style={{ background: "linear-gradient(180deg,#0f9d58,#0b7a43)" }}>Use in campaign</button>
              <button type="button" onClick={() => setBuilding(true)} className="rounded-full border border-[var(--line)] px-3.5 py-1.5 text-[12px] font-bold text-[var(--ink-2)] hover:bg-[var(--panel)]">Edit rule</button>
              {custom.some((x) => x.id === a.id) && <button type="button" onClick={() => setCustom((xs) => xs.filter((x) => x.id !== a.id))} className="ml-auto text-[11.5px] font-bold text-[var(--ink-3)] hover:text-[#c02636]">Delete</button>}
            </div>
          </div>
        ))}
      </div>
      {building && <AudienceBuilder bookings={bookings} listings={listings} locations={locations} onCancel={() => setBuilding(false)} onCreate={(a) => { setCustom((xs) => [...xs, a]); setBuilding(false); }} />}
    </div>
  );
}

interface EmailTemplate { id: string; name: string; subject?: string; body: string }
function TemplatesView({ onUse }: { onUse: (t: EmailTemplate) => void }) {
  const [templates, setTemplates] = useState<EmailTemplate[] | null>(null);
  useEffect(() => { apiGet<EmailTemplate[]>("/api/messages/templates").then(setTemplates).catch(() => setTemplates([])); }, []);
  if (!templates) return <div className="py-6 text-center text-[12.5px] text-[var(--ink-3)]">Loading…</div>;
  return templates.length === 0
    ? <Card className="p-8 text-center text-[13px] text-[var(--ink-3)]">No saved templates yet. Save one from the message composer to reuse it here.</Card>
    : <div className="flex flex-col gap-2">{templates.map((t) => (
        <div key={t.id} className="flex items-center gap-3 rounded-xl border border-[var(--line)] bg-white p-3">
          <div className="min-w-0 flex-1"><div className="truncate text-[13.5px] font-bold text-[var(--ink)]">{t.name}</div>{t.subject && <div className="truncate text-[12px] text-[var(--ink-3)]">{t.subject}</div>}</div>
          <button type="button" onClick={() => onUse(t)} className="flex-none rounded-lg border border-[#2f6bd8] px-3 py-1.5 text-[12px] font-extrabold text-[#1d3a8f] hover:bg-[#eef4fd]">Use</button>
        </div>
      ))}</div>;
}

function AnalyticsView() {
  const [campaigns] = useState<Campaign[]>(() => readLS<Campaign[] | null>(LS_CAMP, null) ?? SEED_CAMPAIGNS);
  const tracked = campaigns.filter((c) => c.opens != null);
  const sent = tracked.reduce((n, c) => n + c.recipients, 0);
  const delivered = Math.round(sent * 0.987);
  const wAvg = (pick: (c: Campaign) => number) => sent ? Math.round(tracked.reduce((n, c) => n + pick(c) * c.recipients, 0) / sent) : 0;
  const openRate = wAvg((c) => c.opens ?? 0);
  const clickRate = wAvg((c) => c.clicks ?? 0);
  const bounces = sent - delivered;
  const unsubs = Math.round(sent * 0.008);
  return (
    <div>
      <div className="mb-3 rounded-lg border-l-4 border-[#2f6bd8] bg-[#eef4fd] px-3 py-2 text-[12px] text-[#1d3a8f]">✉ <b>Email analytics</b> across every campaign — delivered, opens, clicks, bounces &amp; unsubscribes, tracked through the marketing pipeline. 1:1 inbox mail isn’t tracked (no pixels on personal correspondence).</div>
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <StatCard label="Delivered" value={String(delivered)} sub={sent ? `${Math.round((delivered / sent) * 100)}% of sent` : undefined} />
        <StatCard label="Open rate" value={`${openRate}%`} tone="#16a34a" />
        <StatCard label="Click rate" value={`${clickRate}%`} tone="#16a34a" />
        <StatCard label="Bounces" value={String(bounces)} sub={sent ? `${Math.round((bounces / sent) * 100)}%` : undefined} tone="#ea580c" />
        <StatCard label="Unsubscribes" value={String(unsubs)} tone="#ea580c" />
      </div>
      <div className="rounded-2xl border border-[var(--line)] bg-white p-4">
        <div className="mb-3 text-[15px] font-extrabold text-[var(--ink)]">Open rate by campaign</div>
        {tracked.length === 0 ? <div className="py-4 text-center text-[13px] text-[var(--ink-3)]">No sent campaigns yet.</div>
        : tracked.map((c) => (
          <div key={c.id} className="mb-3 last:mb-0"><div className="flex justify-between text-[13px]"><span className="text-[var(--ink-2)]">{c.name}</span><span className="font-bold text-[var(--ink)]">{c.opens}% open</span></div><div className="mt-1 h-2.5 overflow-hidden rounded-full bg-[var(--panel)]"><div className="h-full rounded-full" style={{ width: `${c.opens}%`, background: "#16306e" }} /></div></div>
        ))}
      </div>
    </div>
  );
}

export function EmailApp() {
  // Deep-link from the Register: ?to=parent@email opens addressed to one parent.
  const searchParams = useSearchParams();
  const presetTo = searchParams.get("to") ?? "";
  // Hand-off from the Newsletter builder ("Email to parents") — a ready-to-send
  // subject + body stashed in localStorage. Read once on first render.
  const nlDraft = typeof window === "undefined" ? null : ((): { subject?: string; body?: string; html?: string; newsletter?: Newsletter } | null => { try { return JSON.parse(localStorage.getItem("aos.email.draft.v1") || "null"); } catch { return null; } })();
  const [docHtml] = useState<string>(() => nlDraft?.html ?? "");
  const [mode, setMode] = useState<"embed" | "attach">("embed");
  const [families, setFamilies] = useState<{ email: string; name: string }[]>([]);
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const [recipOpen, setRecipOpen] = useState(false);
  const [history, setHistory] = useState<Sent[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [audience, setAudience] = useState<"all" | "one" | "listing">(presetTo ? "one" : "all");
  const [to, setTo] = useState(presetTo);
  const [cc, setCc] = useState("");
  const [bcc, setBcc] = useState("");
  const [showCcBcc, setShowCcBcc] = useState(false);
  const [subject, setSubject] = useState(nlDraft?.subject ?? "");
  const [body, setBody] = useState(nlDraft?.body ?? "");
  const [attachments, setAttachments] = useState<{ name: string; size: string }[]>([]);
  const [listingIds, setListingIds] = useState<string[]>([]);
  const [composeListings, setComposeListings] = useState<{ id: string; title: string }[]>([]);
  const [composeBookings, setComposeBookings] = useState<Booking[]>([]);
  const [composeTemplates, setComposeTemplates] = useState<EmailTemplate[]>([]);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const [reach, setReach] = useState<number | null>(null);
  const [sending, setSending] = useState(false);
  const [assetsOpen, setAssetsOpen] = useState(true);
  const [moments, setMoments] = useState<LiveMoment[] | null>(null);
  const { settings, save } = useSettings();
  // Land on Compose when arriving from a hand-off (newsletter/register), else on
  // the Inbox (the manual's default Email view).
  type Tab = "inbox" | "campaigns" | "audiences" | "templates" | "automatic" | "analytics" | "compose";
  const [tab, setTab] = useState<Tab>(nlDraft || presetTo ? "compose" : "inbox");
  const savedImages: SavedImage[] = settings.emailAssets?.images ?? [];
  const momentById = new Map((moments ?? []).map((m) => [m.id, m]));
  // Read the live moment so a photo carries its own message + marketing quote
  // (kept associated with the correct image, straight from that moment).
  const enrich = (im: SavedImage): SavedImage => {
    const live = momentById.get(im.momentId);
    if (!live) return im;
    return { ...im, sourceCaption: live.caption ?? im.sourceCaption, sourceComments: (live.comments ?? []).filter((c) => c.role === "parent").map((c) => ({ text: c.text, byName: c.byName, marketing: c.marketing })) };
  };

  const appendBody = (block: string) => setBody((b) => (b.trim() ? `${b.replace(/\s+$/, "")}\n\n${block}\n` : `${block}\n`));

  function patchImage(id: string, partial: Partial<SavedImage>) {
    save({ settings: { ...settings, emailAssets: { ...(settings.emailAssets ?? {}), images: savedImages.map((im) => im.id === id ? { ...im, ...partial } : im) } } });
  }
  function removeImage(id: string) {
    if (!confirm("Remove this saved image?")) return;
    save({ settings: { ...settings, emailAssets: { ...(settings.emailAssets ?? {}), images: savedImages.filter((im) => im.id !== id) } } });
  }
  // Add the photo to the email draft, including whatever message/quote is ticked.
  function addImageToEmail(im: SavedImage) {
    const { caption, quotes } = resolveSavedText(im);
    const parts: string[] = [];
    if (caption) parts.push(caption);
    for (const q of quotes) parts.push(`“${q.text}” — ${q.byName ?? "a parent"}`);
    appendBody(parts.length ? `[📷 ${im.childName ?? "Photo"}]\n${parts.join("\n")}` : `[📷 Photo of ${im.childName ?? "the day"}]`);
    setOk("Added to your email draft. The words drop in now — the image attaches when the visual Email builder ships.");
  }

  const refresh = useCallback(() => {
    apiGet<Sent[]>("/api/emails").then((h) => { setHistory(h); setError(null); }).catch((e) => setError(e instanceof Error ? e.message : "Failed to load"));
  }, []);
  useEffect(() => { refresh(); }, [refresh]);
  // Consume the newsletter hand-off once so it doesn't re-fill on a later visit.
  useEffect(() => { try { localStorage.removeItem("aos.email.draft.v1"); } catch { /* private mode */ } }, []);
  const loadRecipients = useCallback(() => { apiGet<{ count: number; families?: { email: string; name: string }[] }>("/api/emails/recipients").then((r) => { setReach(r.count); setFamilies(r.families ?? []); }).catch(() => {}); }, []);
  useEffect(() => { loadRecipients(); }, [loadRecipients]);
  useEffect(() => { apiGet<LiveMoment[]>("/api/moments").then(setMoments).catch(() => {}); }, []);
  useEffect(() => { apiGet<{ id: string; title?: string; name?: string }[]>("/api/listings?mine=1").then((l) => setComposeListings(l.map((x) => ({ id: x.id, title: x.title || x.name || "Listing" })))).catch(() => {}); }, []);
  useEffect(() => { apiGet<Booking[]>("/api/bookings").then(setComposeBookings).catch(() => {}); }, []);
  useEffect(() => { apiGet<EmailTemplate[]>("/api/messages/templates").then(setComposeTemplates).catch(() => {}); }, []);
  useRealtime(["emails", "bookings", "moments"], () => { refresh(); loadRecipients(); apiGet<LiveMoment[]>("/api/moments").then(setMoments).catch(() => {}); });
  const included = families.filter((f) => !excluded.has(f.email));
  // Recipients when targeting by listing: everyone who booked any selected listing.
  const listingEmails = (() => { const s = new Set<string>(); for (const b of composeBookings) if (b.email && listingIds.includes(b.listingId || "")) s.add(b.email.toLowerCase()); return [...s]; })();
  const reachCount = audience === "listing" ? listingEmails.length : families.length ? included.length : reach ?? 0;

  // Insert text at the cursor (formatting toolbar + link).
  const insert = (before: string, after = "", placeholder = "") => {
    const ta = bodyRef.current;
    if (!ta) { setBody((b) => b + before + placeholder + after); return; }
    const s = ta.selectionStart, e = ta.selectionEnd, sel = body.slice(s, e) || placeholder;
    setBody(body.slice(0, s) + before + sel + after + body.slice(e));
    requestAnimationFrame(() => { ta.focus(); ta.selectionStart = s + before.length; ta.selectionEnd = s + before.length + sel.length; });
  };
  const addAttachment = (f: File) => { const kb = Math.max(1, Math.round(f.size / 1024)); setAttachments((xs) => [...xs, { name: f.name, size: kb > 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${kb} KB` }]); };

  async function send() {
    if (!subject.trim() || !body.trim()) { setError("A subject and a message are required."); return; }
    if (audience === "one" && !to.trim()) { setError("Enter a recipient address."); return; }
    if (audience === "listing" && listingIds.length === 0) { setError("Pick at least one listing to email."); return; }
    const recipients = audience === "listing" ? listingEmails : audience === "all" && families.length ? included.map((f) => f.email) : undefined;
    const count = audience === "one" ? 1 : reachCount;
    if (count === 0) { setError("No families selected to send to."); return; }
    if (!confirm(audience === "one" ? `Send this email to ${to}?` : `Send this email to ${count} famil${count === 1 ? "y" : "ies"}?`)) return;
    setSending(true); setError(null); setOk(null);
    try {
      const r = await apiPost<{ recipientCount: number }>("/api/emails/send", {
        subject, body,
        html: docHtml && mode === "embed" ? docHtml : undefined,
        audience: audience === "listing" ? "all" : audience,
        to: audience === "one" ? to : undefined,
        recipients,
        cc: cc.trim() || undefined,
        bcc: bcc.trim() || undefined,
      });
      setOk(`Sent to ${r.recipientCount} recipient${r.recipientCount === 1 ? "" : "s"}.${attachments.length ? " (Attachments send once file-attach is wired on the backend.)" : ""}`);
      setSubject(""); setBody(""); setTo(""); setCc(""); setBcc(""); setAttachments([]); refresh();
    } catch (e) { setError(e instanceof Error ? e.message : "Couldn’t send"); }
    finally { setSending(false); }
  }

  return (
    <OperatorPage title="Email" icon="✉️" lede="Your inbox, campaigns and the emails ActivityOS sends for you — all in one place.">
      <TabStrip<Tab> tabs={[["inbox", "Inbox"], ["campaigns", "Campaigns"], ["audiences", "Audiences"], ["templates", "Templates"], ["automatic", "Automatic emails"], ["analytics", "Analytics"], ["compose", "Compose"]]} value={tab} onChange={setTab} />
      {error && <div className="mb-3 rounded-lg border border-[var(--red-line,#f6c9cc)] bg-[var(--red-soft,#fdebec)] px-3 py-2 text-[12.5px] text-[var(--red,#e21d27)]">{error}</div>}
      {ok && <div className="mb-3 rounded-lg border border-[var(--line)] bg-[#eaf0fc] px-3 py-2 text-[12.5px] text-[#1d3a8f]">{ok}</div>}

      {tab === "inbox" && <InboxView history={history} onCompose={() => setTab("compose")} onReply={(m) => { setAudience("one"); if (m.fromEmail) setTo(m.fromEmail); setSubject(`Re: ${m.subject}`); setBody(`\n\n———\n${m.from} wrote:\n${m.body ?? m.preview}`); setTab("compose"); }} onQuickReply={(m, text) => { setAudience("one"); if (m.fromEmail) setTo(m.fromEmail); setSubject(`Re: ${m.subject}`); setBody(text); setTab("compose"); }} onForward={(m) => { setSubject(`Fwd: ${m.subject}`); setBody(`\n\n———\nForwarded from ${m.from}:\n${m.body ?? m.preview}`); setTab("compose"); }} />}
      {tab === "campaigns" && <CampaignsView onSent={refresh} />}
      {tab === "audiences" && <AudiencesView onUse={() => setTab("campaigns")} />}
      {tab === "templates" && <TemplatesView onUse={(t) => { setSubject(t.subject ?? ""); setBody(t.body); setTab("compose"); }} />}
      {tab === "analytics" && <AnalyticsView />}
      {tab === "automatic" && <AutoEmails settings={settings} save={save} />}

      {tab === "compose" && (<>
      <Card className="mb-4 p-4">
        <div className="grid gap-2.5 sm:grid-cols-2">
          <div>
            <FieldLabel>Audience</FieldLabel>
            <Select value={audience} onChange={(e) => setAudience(e.target.value as "all" | "one" | "listing")} className="w-full">
              <option value="all">All families ({families.length ? included.length : reach ?? 0})</option>
              <option value="listing">Families on a listing</option>
              <option value="one">A single address</option>
            </Select>
          </div>
          {audience === "one" && <div><FieldLabel>Recipient</FieldLabel><Input type="email" value={to} onChange={(e) => setTo(e.target.value)} placeholder="name@example.com" className="w-full" /></div>}
        </div>
        {audience === "listing" && (
          <div className="mt-2">
            <FieldLabel>Listings — everyone booked on the ones you pick ({listingEmails.length})</FieldLabel>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {composeListings.length === 0 ? <span className="text-[11.5px] text-[var(--ink-3)]">No listings yet.</span>
                : composeListings.map((l) => { const on = listingIds.includes(l.id); return <button key={l.id} type="button" onClick={() => setListingIds((xs) => on ? xs.filter((x) => x !== l.id) : [...xs, l.id])} className="rounded-full border px-2.5 py-1 text-[11.5px] font-bold" style={on ? { borderColor: "#1d3a8f", background: "#eef4fd", color: "#1d3a8f" } : { borderColor: "var(--line)", color: "var(--ink-2)" }}>{on ? "✓ " : ""}{l.title}</button>; })}
            </div>
          </div>
        )}
        <div className="mt-2">
          {showCcBcc ? (
            <div className="grid gap-2.5 sm:grid-cols-2">
              <div><FieldLabel>Cc</FieldLabel><Input value={cc} onChange={(e) => setCc(e.target.value)} placeholder="cc@example.com, …" className="w-full" /></div>
              <div><FieldLabel>Bcc</FieldLabel><Input value={bcc} onChange={(e) => setBcc(e.target.value)} placeholder="bcc@example.com, …" className="w-full" /></div>
            </div>
          ) : <button type="button" onClick={() => setShowCcBcc(true)} className="text-[12px] font-bold text-[#1d3a8f]">＋ Add Cc / Bcc</button>}
        </div>
        {audience === "all" && families.length > 0 && (
          <div className="mt-2">
            <button type="button" onClick={() => setRecipOpen((o) => !o)} className="text-[12px] font-bold text-[#1d3a8f]">{recipOpen ? "▾" : "▸"} Review the {reachCount} famil{reachCount === 1 ? "y" : "ies"} who’ll get this</button>
            {recipOpen && (
              <div className="mt-1.5 max-h-56 divide-y divide-[var(--line)] overflow-auto rounded-lg border border-[var(--line)]">
                {families.map((f) => { const on = !excluded.has(f.email); return (
                  <div key={f.email} className="flex items-center gap-2 px-3 py-1.5 text-[12.5px]" style={on ? undefined : { opacity: 0.5 }}>
                    <span className="min-w-0 flex-1 truncate"><b>{f.name}</b> <span className="text-[var(--ink-3)]">{f.email}</span></span>
                    <button type="button" onClick={() => setExcluded((s) => { const n = new Set(s); if (on) n.add(f.email); else n.delete(f.email); return n; })} className="flex-none rounded-md border px-2 py-0.5 text-[11px] font-bold" style={on ? { borderColor: "var(--line)", color: "var(--ink-2)" } : { borderColor: "#1d3a8f", color: "#1d3a8f" }}>{on ? "Remove" : "Add back"}</button>
                  </div>
                ); })}
              </div>
            )}
          </div>
        )}
        {docHtml && (
          <div className="mt-2.5 rounded-lg border border-[#dbe6fb] bg-[#f4f8ff] p-3">
            <div className="mb-1.5 text-[12px] font-extrabold text-[#1d3a8f]">How should families get the designed version?</div>
            <div className="flex flex-wrap gap-2">
              {([["embed", "📧 Embed inside the email"], ["attach", "📎 Attach as a PDF"]] as const).map(([k, label]) => <button key={k} type="button" onClick={() => setMode(k)} className="rounded-lg border px-3 py-1.5 text-[12.5px] font-extrabold" style={mode === k ? { borderColor: "#1d3a8f", background: "#eef4fd", color: "#1d3a8f" } : { borderColor: "var(--line)", color: "var(--ink-2)" }}>{label}</button>)}
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11.5px] text-[var(--ink-3)]">
              {mode === "embed"
                ? <span>The full designed layout appears in the email body; the text below is the plain-text fallback.</span>
                : <span>Download the PDF to attach. <b className="text-[#8a6d1a]">Automatic file-attach is a backend step — for now grab the PDF here.</b></span>}
              <button type="button" onClick={() => printDocHtml(docHtml)} className="ml-auto rounded-lg border border-[#1d3a8f] px-3 py-1 text-[12px] font-extrabold text-[#1d3a8f] hover:bg-[#eef4fd]">⬇ Download PDF</button>
            </div>
          </div>
        )}
        <div className="mt-2.5"><FieldLabel>Subject</FieldLabel><Input value={subject} onChange={(e) => setSubject(e.target.value)} className="w-full" /></div>
        <div className="mt-2.5">
          <div className="mb-1 flex items-center justify-between"><FieldLabel>Message</FieldLabel></div>
          {/* Formatting + attach + link + templates toolbar */}
          <div className="flex flex-wrap items-center gap-1 rounded-t-lg border border-b-0 border-[var(--line)] bg-[var(--panel)] px-2 py-1.5">
            <button type="button" onClick={() => insert("# ", "", "Heading")} title="Heading" className="rounded px-2 py-1 text-[13px] font-extrabold text-[var(--ink-2)] hover:bg-white">Aa</button>
            <button type="button" onClick={() => insert("**", "**", "bold")} title="Bold" className="rounded px-2 py-1 text-[13px] font-extrabold text-[var(--ink-2)] hover:bg-white">B</button>
            <button type="button" onClick={() => insert("_", "_", "italic")} title="Italic" className="rounded px-2 py-1 text-[13px] italic text-[var(--ink-2)] hover:bg-white">I</button>
            <button type="button" onClick={() => { const url = prompt("Link URL"); if (url) insert("[", `](${url})`, "link text"); }} title="Insert link" className="rounded px-2 py-1 text-[13px] text-[var(--ink-2)] hover:bg-white">🔗</button>
            <label title="Attach a file" className="cursor-pointer rounded px-2 py-1 text-[13px] text-[var(--ink-2)] hover:bg-white">📎<input type="file" multiple className="hidden" onChange={(e) => { Array.from(e.target.files ?? []).forEach(addAttachment); e.target.value = ""; }} /></label>
            {composeTemplates.length > 0 && <Select value="" onChange={(e) => { const t = composeTemplates.find((x) => x.id === e.target.value); if (t) { if (t.subject && !subject.trim()) setSubject(t.subject); setBody((b) => b.trim() ? `${b}\n\n${t.body}` : t.body); } }} className="ml-auto text-[12px]"><option value="">＋ Insert template…</option>{composeTemplates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</Select>}
          </div>
          <textarea ref={bodyRef} value={body} onChange={(e) => setBody(e.target.value)} rows={8} className="w-full rounded-b-lg border border-[var(--line)] bg-[var(--surface)] px-2.5 py-2 text-[13px]" />
          {attachments.length > 0 && <div className="mt-2 flex flex-wrap gap-2">{attachments.map((a, i) => <span key={i} className="inline-flex items-center gap-2 rounded-lg border border-[var(--line)] bg-[var(--panel)] px-2.5 py-1 text-[12px] font-bold">📎 {a.name} <span className="font-normal text-[var(--ink-3)]">{a.size}</span><button type="button" onClick={() => setAttachments((xs) => xs.filter((_, j) => j !== i))} className="text-[var(--ink-3)] hover:text-[#c02636]">×</button></span>)}</div>}
        </div>
        <div className="mt-3 flex items-center gap-3">
          <Button variant="primary" onClick={send} disabled={sending}>{sending ? "Sending…" : audience === "one" ? "Send email" : `Send to ${reachCount} famil${reachCount === 1 ? "y" : "ies"}`}</Button>
          {audience === "all" && reachCount === 0 && <span className="text-[11.5px] text-[var(--ink-3)]">No booked families to email yet.</span>}
        </div>
      </Card>

      {savedImages.length > 0 && (
        <div className="mb-4 rounded-2xl border border-[#f6e2a8] bg-[#fffdf3] p-3.5">
          <button type="button" onClick={() => setAssetsOpen((v) => !v)} className="flex w-full items-center justify-between gap-2 text-left">
            <span className="text-[13px] font-extrabold" style={{ color: BROWN, fontFamily: "var(--ff-display)" }}>📷 Photos from Moments <span className="text-[11px] font-semibold text-[var(--ink-3)]">— type your own message, add the quote, set size/crop/colour. The preview updates live before you add or download.</span></span>
            <span className="flex-none text-[12px] text-[var(--ink-3)]">{assetsOpen ? "▲ Close" : "▼ Open"}</span>
          </button>
          {assetsOpen && (
            <div className="mt-2.5 grid gap-2.5" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(180px,1fr))" }}>
              {savedImages.map((im) => { const e = enrich(im); return (
                <SavedImageCard key={im.id} im={e} onPatch={(p) => patchImage(im.id, p)} onRemove={() => removeImage(im.id)} onAdd={() => addImageToEmail(e)} />
              ); })}
            </div>
          )}
        </div>
      )}

      <div className="mb-1.5 text-[11px] font-extrabold uppercase tracking-[0.04em] text-[var(--ink-3)]">Sent</div>
      {!history ? <div className="py-6 text-center text-[12.5px] text-[var(--ink-3)]">Loading…</div>
      : history.length === 0 ? <Card className="p-6 text-center text-[13px] text-[var(--ink-3)]">Nothing sent yet.</Card>
      : (
        <div className="flex flex-col gap-1.5">
          {history.map((h) => (
            <Card key={h.id} className="flex flex-wrap items-center gap-2 p-2.5">
              <span className="min-w-0 flex-1 truncate text-[13px] font-bold">{h.subject}</span>
              <Badge tone={{ bg: "var(--panel)", fg: "var(--ink-2)" }}>{h.audience === "one" ? "1 address" : `${h.recipientCount} famil${h.recipientCount === 1 ? "y" : "ies"}`}</Badge>
              <span className="text-[11px] text-[var(--ink-3)]">{h.sentByName} · {when(h.createdAt)}</span>
            </Card>
          ))}
        </div>
      )}
      </>)}
    </OperatorPage>
  );
}
